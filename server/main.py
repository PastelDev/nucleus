"""
Nucleus API server.
File-backed storage for all app data.
"""
import base64
import json
import os
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, UploadFile, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

DATA_DIR = Path(__file__).parent.parent / "data"


def ensure_dir(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(application: FastAPI):
    await init_data()
    yield


app = FastAPI(title="Nucleus API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Generic data file read/write ────────────────────────────────────────────

@app.get("/api/data/{filepath:path}")
async def read_data(filepath: str):
    full = (DATA_DIR / filepath).resolve()
    if not str(full).startswith(str(DATA_DIR.resolve())):
        return JSONResponse({"error": "invalid path"}, 403)
    if not full.exists():
        return JSONResponse({"error": "not found"}, 404)
    content = full.read_text(encoding="utf-8")
    if full.suffix == ".json":
        return JSONResponse(json.loads(content))
    return PlainTextResponse(content)


@app.put("/api/data/{filepath:path}")
async def write_data(filepath: str, request: Request):
    full = (DATA_DIR / filepath).resolve()
    if not str(full).startswith(str(DATA_DIR.resolve())):
        return JSONResponse({"error": "invalid path"}, 403)
    ensure_dir(full)
    ct = request.headers.get("content-type", "")
    body = await request.body()
    if "json" in ct:
        # validate JSON, then write pretty
        data = json.loads(body)
        full.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    else:
        full.write_text(body.decode("utf-8"), encoding="utf-8")
    return JSONResponse({"ok": True})


# ── Board history listing ────────────────────────────────────────────────────

@app.get("/api/boards/{scope}/{board_id}/history")
async def list_board_history(scope: str, board_id: str):
    if scope not in ("whiteboards", "me"):
        return JSONResponse({"error": "invalid scope"}, 400)
    hist_dir = DATA_DIR / scope / board_id / "history"
    if not hist_dir.exists():
        return JSONResponse([])
    files = sorted(hist_dir.glob("*.json"), reverse=True)
    return JSONResponse([f.stem for f in files])


@app.get("/api/boards/{scope}/{board_id}/history/{snapshot_id}")
async def load_board_snapshot(scope: str, board_id: str, snapshot_id: str):
    if scope not in ("whiteboards", "me"):
        return JSONResponse({"error": "invalid scope"}, 400)
    p = DATA_DIR / scope / board_id / "history" / f"{snapshot_id}.json"
    if not p.exists():
        return JSONResponse({"error": "not found"}, 404)
    return JSONResponse(json.loads(p.read_text(encoding="utf-8")))


# ── Image upload ─────────────────────────────────────────────────────────────

@app.post("/api/boards/{scope}/{board_id}/upload")
async def upload_image(scope: str, board_id: str, file: UploadFile = File(...)):
    if scope not in ("whiteboards", "me"):
        return JSONResponse({"error": "invalid scope"}, 400)
    assets_dir = DATA_DIR / scope / board_id / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    # sanitize filename
    safe_name = f"{int(time.time())}_{file.filename.replace(os.sep, '_')}"
    dest = assets_dir / safe_name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    rel_path = f"/api/assets/{scope}/{board_id}/{safe_name}"
    return JSONResponse({"path": rel_path, "name": file.filename})


# ── Serve uploaded assets ────────────────────────────────────────────────────

@app.get("/api/assets/{scope}/{board_id}/{filename}")
async def serve_asset(scope: str, board_id: str, filename: str):
    p = DATA_DIR / scope / board_id / "assets" / filename
    if not p.exists():
        return JSONResponse({"error": "not found"}, 404)
    # guess content type
    ext = p.suffix.lower()
    ct_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp"}
    ct = ct_map.get(ext, "application/octet-stream")
    return Response(content=p.read_bytes(), media_type=ct)


# ── AI image generation ──────────────────────────────────────────────────────

@app.post("/api/generate-image")
async def generate_image(request: Request):
    body = await request.json()
    openai_key = body.get("openai_key", "")
    if not openai_key:
        return JSONResponse({"error": "No OpenAI API key provided"}, status_code=400)

    scope = body.get("scope")
    board_id = body.get("board_id")
    size = body.get("size", "1024x1024")
    quality = body.get("quality", "auto")

    # batch = list of different prompts; single = one prompt with optional n
    prompts_list = body.get("prompts")
    if prompts_list:
        jobs = [(p, 1) for p in prompts_list]
    else:
        jobs = [(body.get("prompt", ""), body.get("n", 1))]

    paths = []
    async with httpx.AsyncClient(timeout=180) as client:
        for prompt, n in jobs:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                json={"model": "gpt-image-1.5", "prompt": prompt, "size": size, "quality": quality, "n": n},
            )
            data = resp.json()
            if "error" in data:
                return JSONResponse({"error": data["error"]["message"]}, status_code=400)
            for img in data.get("data", []):
                img_bytes = base64.b64decode(img["b64_json"])
                fname = f"ai_{int(time.time() * 1000)}.png"
                if scope and board_id:
                    assets_dir = DATA_DIR / scope / board_id / "assets"
                    assets_dir.mkdir(parents=True, exist_ok=True)
                    (assets_dir / fname).write_bytes(img_bytes)
                    paths.append(f"/api/assets/{scope}/{board_id}/{fname}")
                else:
                    out_dir = DATA_DIR / "generated"
                    out_dir.mkdir(parents=True, exist_ok=True)
                    (out_dir / fname).write_bytes(img_bytes)
                    paths.append(f"/api/data/generated/{fname}")

    return JSONResponse({"paths": paths})


# ── Delete board ─────────────────────────────────────────────────────────────

@app.delete("/api/boards/{scope}/{board_id}")
async def delete_board(scope: str, board_id: str):
    if scope not in ("whiteboards", "me"):
        return JSONResponse({"error": "invalid scope"}, 400)
    board_dir = DATA_DIR / scope / board_id
    if board_dir.exists():
        shutil.rmtree(board_dir)
    return JSONResponse({"ok": True})


# ── Init default data ────────────────────────────────────────────────────────

async def init_data():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # ensure default files exist
    defaults = {
        "tasks.json": "[]",
        "events.json": "[]",
        "notes.json": "[]",
        "artefacts.json": "[]",
        "pomodoro.json": '{"work": 25, "short": 5, "long": 15}',
        "config.json": '{"apiKey": "", "model": "stepfun/step-3.5-flash:free", "openaiKey": ""}',
        "ai-agent.md": DEFAULT_AGENT_MD,
        "ai-memories.md": DEFAULT_MEMORIES_MD,
        "whiteboards/index.json": '{"boards": []}',
        "me/index.json": json.dumps(DEFAULT_ME_INDEX, indent=2),
    }
    for path, content in defaults.items():
        full = DATA_DIR / path
        if not full.exists():
            ensure_dir(full)
            full.write_text(content, encoding="utf-8")

    # create default me sub-boards
    me_index = json.loads((DATA_DIR / "me/index.json").read_text(encoding="utf-8"))
    for b in me_index.get("boards", []):
        board_file = DATA_DIR / "me" / b["id"] / "board.json"
        if not board_file.exists():
            ensure_dir(board_file)
            board = {
                "id": b["id"],
                "name": b["name"],
                "parentId": b.get("parentId"),
                "items": [],
                "createdAt": int(time.time() * 1000),
                "updatedAt": int(time.time() * 1000),
            }
            board_file.write_text(json.dumps(board, indent=2), encoding="utf-8")


DEFAULT_AGENT_MD = """# Nucleus AI Agent

You are **Nucleus**, an intelligent productivity assistant embedded in the Nucleus app. You control the app through tools.

## Behavior Rules
1. When asked to do something in the app — **DO IT** using tools, don't explain how
2. After tool calls, confirm briefly (1-2 sentences)
3. Chain tools when needed (e.g. create note -> navigate to notes)
4. Use `get_current_view_content` to read what's on screen before editing
5. Use `update_memories` to remember user preferences and important context
6. Navigate to the relevant section after creating content when it makes sense

## Tone
Sharp, helpful, minimal. Skip filler. Get to the point.
"""

DEFAULT_MEMORIES_MD = """# Agent Memories

*No memories yet.*

I update this as I learn about you — preferences, working style, and important context.
"""

DEFAULT_ME_INDEX = {
    "boards": [
        {"id": "physics-math", "name": "Physics & Math"},
        {"id": "school", "name": "School"},
        {"id": "reading", "name": "Reading"},
        {"id": "projects", "name": "Projects"},
        {"id": "sleep-routine", "name": "Sleep & Routine"},
        {"id": "home-time", "name": "Home Time"},
    ]
}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
