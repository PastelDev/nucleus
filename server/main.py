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

DATA_ROOT_DIR = Path(__file__).parent.parent / "data"
USER_DATA_DIR = DATA_ROOT_DIR / "user"
BACKGROUND_DIR = USER_DATA_DIR / "backgrounds"
MEMORIES_DIR = USER_DATA_DIR / "memories"
MEMORIES_AGENT_DIR = MEMORIES_DIR / "agent"
MEMORIES_AGENT_LOG_DIR = MEMORIES_AGENT_DIR / "log"
MEMORIES_USER_DIR = MEMORIES_DIR / "user"

LEGACY_USER_PATHS = [
    "ai-agent.local.md",
    "ai-agent.md",
    "ai-chats.json",
    "ai-memories.md",
    "artefacts.json",
    "config.json",
    "events.json",
    "notes.json",
    "pomodoro.json",
    "tasks.json",
    "theme-settings.json",
    "backgrounds",
    "generated",
    "me",
    "memories",
    "whiteboards",
]


def ensure_dir(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)


def migrate_legacy_user_data():
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for rel_path in LEGACY_USER_PATHS:
        legacy = DATA_ROOT_DIR / rel_path
        target = USER_DATA_DIR / rel_path
        if not legacy.exists() or target.exists():
            continue
        ensure_dir(target)
        shutil.move(str(legacy), str(target))


def media_type_for_path(path: Path):
    ext = path.suffix.lower()
    ct_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".ogg": "video/ogg",
    }
    return ct_map.get(ext, "application/octet-stream")


def resolve_memory_path(filepath: str):
    clean = filepath[9:] if filepath.startswith("memories/") else filepath
    full = (MEMORIES_DIR / clean).resolve()
    if not str(full).startswith(str(MEMORIES_DIR.resolve())):
        return None
    return full


def build_memory_tree(dir_path: Path, path_prefix: str):
    files = []
    directories = []
    if not dir_path.exists():
        return {"path": path_prefix, "name": dir_path.name, "files": files, "directories": directories}

    for child in sorted(dir_path.iterdir(), key=lambda entry: (entry.is_file(), entry.name.lower())):
        child_path = f"{path_prefix}/{child.name}"
        if child.is_dir():
            directories.append(build_memory_tree(child, child_path))
        elif child.suffix.lower() == ".md":
            files.append({
                "path": child_path,
                "name": child.name,
                "content": child.read_text(encoding="utf-8"),
                "updatedAt": int(child.stat().st_mtime * 1000),
            })

    return {"path": path_prefix, "name": dir_path.name, "files": files, "directories": directories}


def write_agent_memory(content: str):
    ensure_dir(MEMORIES_AGENT_DIR / "index.md")
    current = (MEMORIES_AGENT_DIR / "index.md").read_text(encoding="utf-8") if (MEMORIES_AGENT_DIR / "index.md").exists() else ""
    (MEMORIES_AGENT_DIR / "index.md").write_text(content, encoding="utf-8")
    if current.strip() == content.strip():
        return

    MEMORIES_AGENT_LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = int(time.time() * 1000)
    readable = time.strftime("%Y-%m-%d %H:%M:%S")
    log_path = MEMORIES_AGENT_LOG_DIR / f"{stamp}.md"
    log_path.write_text(f"# Memory Update\n\nUpdated: {readable}\n\n{content}\n", encoding="utf-8")


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
    full = (USER_DATA_DIR / filepath).resolve()
    if not str(full).startswith(str(USER_DATA_DIR.resolve())):
        return JSONResponse({"error": "invalid path"}, 403)
    if not full.exists():
        return JSONResponse({"error": "not found"}, 404)
    content = full.read_text(encoding="utf-8")
    if full.suffix == ".json":
        return JSONResponse(json.loads(content))
    return PlainTextResponse(content)


@app.put("/api/data/{filepath:path}")
async def write_data(filepath: str, request: Request):
    full = (USER_DATA_DIR / filepath).resolve()
    if not str(full).startswith(str(USER_DATA_DIR.resolve())):
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
    hist_dir = USER_DATA_DIR / scope / board_id / "history"
    if not hist_dir.exists():
        return JSONResponse([])
    files = sorted(hist_dir.glob("*.json"), reverse=True)
    return JSONResponse([f.stem for f in files])


@app.get("/api/boards/{scope}/{board_id}/history/{snapshot_id}")
async def load_board_snapshot(scope: str, board_id: str, snapshot_id: str):
    if scope not in ("whiteboards", "me"):
        return JSONResponse({"error": "invalid scope"}, 400)
    p = USER_DATA_DIR / scope / board_id / "history" / f"{snapshot_id}.json"
    if not p.exists():
        return JSONResponse({"error": "not found"}, 404)
    return JSONResponse(json.loads(p.read_text(encoding="utf-8")))


# ── Image upload ─────────────────────────────────────────────────────────────

@app.post("/api/boards/{scope}/{board_id}/upload")
async def upload_image(scope: str, board_id: str, file: UploadFile = File(...)):
    if scope not in ("whiteboards", "me"):
        return JSONResponse({"error": "invalid scope"}, 400)
    assets_dir = USER_DATA_DIR / scope / board_id / "assets"
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
    p = USER_DATA_DIR / scope / board_id / "assets" / filename
    if not p.exists():
        return JSONResponse({"error": "not found"}, 404)
    return Response(content=p.read_bytes(), media_type=media_type_for_path(p))


# ── Shared background assets ────────────────────────────────────────────────

@app.post("/api/backgrounds/upload")
async def upload_background_asset(file: UploadFile = File(...)):
    assets_dir = BACKGROUND_DIR / "uploads"
    assets_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{int(time.time())}_{file.filename.replace(os.sep, '_')}"
    dest = assets_dir / safe_name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    media_type = "video" if file.content_type and file.content_type.startswith("video/") else "image"
    return JSONResponse({
        "path": f"/api/background-assets/uploads/{safe_name}",
        "name": file.filename,
        "mediaType": media_type,
    })


@app.get("/api/background-assets/{filepath:path}")
async def serve_background_asset(filepath: str):
    full = (BACKGROUND_DIR / filepath).resolve()
    if not str(full).startswith(str(BACKGROUND_DIR.resolve())):
        return JSONResponse({"error": "invalid path"}, 403)
    if not full.exists():
        return JSONResponse({"error": "not found"}, 404)
    return Response(content=full.read_bytes(), media_type=media_type_for_path(full))


# ── Memories ────────────────────────────────────────────────────────────────

@app.get("/api/memories/tree")
async def load_memories_tree():
    return JSONResponse({
        "root": build_memory_tree(MEMORIES_DIR, "memories"),
        "overviewPath": "memories/index.md",
        "agentSummaryPath": "memories/agent/index.md",
    })


@app.post("/api/memories/agent")
async def save_agent_memory(request: Request):
    body = await request.json()
    content = body.get("content", "").strip()
    write_agent_memory(content or DEFAULT_MEMORIES_MD)
    return JSONResponse({"ok": True})


@app.delete("/api/memories/{filepath:path}")
async def delete_memory(filepath: str):
    full = resolve_memory_path(filepath)
    if not full or not full.exists():
        return JSONResponse({"error": "not found"}, 404)
    if full.is_dir():
        return JSONResponse({"error": "directory deletion not supported"}, 400)
    full.unlink()
    return JSONResponse({"ok": True})


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
    reference_paths = body.get("reference_paths", [])
    reference_base64_images = body.get("reference_base64_images", [])

    # Resolve reference image bytes (first one wins)
    ref_bytes: bytes | None = None
    if reference_paths:
        ref_path_str = reference_paths[0]
        # strip leading /api/data/ or /api/assets/ to get a local path
        if ref_path_str.startswith("/api/data/"):
            local = USER_DATA_DIR / ref_path_str[len("/api/data/"):]
        elif ref_path_str.startswith("/api/assets/"):
            parts = ref_path_str[len("/api/assets/"):].split("/", 2)
            if len(parts) == 3:
                local = USER_DATA_DIR / parts[0] / parts[1] / "assets" / parts[2]
            else:
                local = None
        else:
            local = None
        if local and local.exists():
            ref_bytes = local.read_bytes()
    elif reference_base64_images:
        ref_bytes = base64.b64decode(reference_base64_images[0])

    # batch = list of different prompts; single = one prompt with optional n
    prompts_list = body.get("prompts")
    if prompts_list:
        jobs = [(p, 1) for p in prompts_list]
    else:
        jobs = [(body.get("prompt", ""), body.get("n", 1))]

    paths = []
    b64_images = []
    async with httpx.AsyncClient(timeout=180) as client:
        for prompt, n in jobs:
            if ref_bytes:
                # Use images/edits endpoint with reference image
                import io as _io
                files = {"image": ("reference.png", _io.BytesIO(ref_bytes), "image/png")}
                data_fields = {"model": "gpt-image-1", "prompt": prompt, "n": str(n), "size": size}
                resp = await client.post(
                    "https://api.openai.com/v1/images/edits",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    files=files,
                    data=data_fields,
                )
            else:
                resp = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={"model": "gpt-image-1", "prompt": prompt, "size": size, "quality": quality, "n": n},
                )
            data = resp.json()
            if "error" in data:
                return JSONResponse({"error": data["error"]["message"]}, status_code=400)
            for img in data.get("data", []):
                img_bytes = base64.b64decode(img["b64_json"])
                b64_images.append(img["b64_json"])
                fname = f"ai_{int(time.time() * 1000)}.png"
                if scope and board_id:
                    assets_dir = USER_DATA_DIR / scope / board_id / "assets"
                    assets_dir.mkdir(parents=True, exist_ok=True)
                    (assets_dir / fname).write_bytes(img_bytes)
                    paths.append(f"/api/assets/{scope}/{board_id}/{fname}")
                else:
                    out_dir = BACKGROUND_DIR / "generated"
                    out_dir.mkdir(parents=True, exist_ok=True)
                    (out_dir / fname).write_bytes(img_bytes)
                    paths.append(f"/api/background-assets/generated/{fname}")

    return JSONResponse({"paths": paths, "b64_images": b64_images})


# ── Screenshot ───────────────────────────────────────────────────────────────

@app.get("/api/screenshot")
async def screenshot():
    from PIL import ImageGrab
    import io
    img = ImageGrab.grab(all_screens=True)
    max_width = 1920
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return JSONResponse({"b64": b64})


# ── Delete board ─────────────────────────────────────────────────────────────

@app.delete("/api/boards/{scope}/{board_id}")
async def delete_board(scope: str, board_id: str):
    if scope not in ("whiteboards", "me"):
        return JSONResponse({"error": "invalid scope"}, 400)
    board_dir = USER_DATA_DIR / scope / board_id
    if board_dir.exists():
        shutil.rmtree(board_dir)
    return JSONResponse({"ok": True})


# ── Init default data ────────────────────────────────────────────────────────

async def init_data():
    DATA_ROOT_DIR.mkdir(parents=True, exist_ok=True)
    migrate_legacy_user_data()
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKGROUND_DIR.mkdir(parents=True, exist_ok=True)
    MEMORIES_DIR.mkdir(parents=True, exist_ok=True)
    MEMORIES_AGENT_DIR.mkdir(parents=True, exist_ok=True)
    MEMORIES_AGENT_LOG_DIR.mkdir(parents=True, exist_ok=True)
    MEMORIES_USER_DIR.mkdir(parents=True, exist_ok=True)
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
        "memories/index.md": DEFAULT_MEMORY_INDEX_MD,
        "memories/agent/index.md": DEFAULT_MEMORIES_MD,
        "whiteboards/index.json": '{"boards": []}',
        "me/index.json": json.dumps(DEFAULT_ME_INDEX, indent=2),
    }
    for path, content in defaults.items():
        full = USER_DATA_DIR / path
        if not full.exists():
            ensure_dir(full)
            full.write_text(content, encoding="utf-8")

    legacy_memory = USER_DATA_DIR / "ai-memories.md"
    agent_summary = MEMORIES_AGENT_DIR / "index.md"
    if legacy_memory.exists() and agent_summary.exists():
        legacy_text = legacy_memory.read_text(encoding="utf-8").strip()
        current_text = agent_summary.read_text(encoding="utf-8").strip()
        if legacy_text and current_text in ("", DEFAULT_MEMORIES_MD.strip()):
            write_agent_memory(legacy_text)

    # create default me sub-boards
    me_index = json.loads((USER_DATA_DIR / "me/index.json").read_text(encoding="utf-8"))
    for b in me_index.get("boards", []):
        board_file = USER_DATA_DIR / "me" / b["id"] / "board.json"
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

DEFAULT_MEMORY_INDEX_MD = """# Memories

This panel shows the assistant's working memory as markdown files.

- `agent/index.md` is the current memory summary used by the AI.
- `agent/log/` stores dated memory updates created by the AI.
- `user/` is for your own memory files and notes.
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
