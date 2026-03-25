# Nucleus

Nucleus is a local-first productivity workspace built with React, Vite, and a small FastAPI backend. It combines notes, boards, focus tools, artefacts, theme editing, and an in-app AI assistant that can operate the workspace through explicit tools.

## What It Includes

- AI chat with live tool activity, approvals, denied-tool feedback, and memory updates
- Notes with glass surfaces and inline rename/edit states
- Unified Boards navigation for shared boards and personal boards
- Folder-backed Memories browser backed by markdown files
- Focus timer with configurable visuals and settings popup
- Artefacts workspace with HTML/React preview modes
- Appearance system with theme library, surface assignment, preset library, glass tuning, and typography controls

## Tech Stack

- Frontend: React 19, TypeScript, Vite
- Backend: FastAPI, Uvicorn
- Storage: file-backed local data under `data/user/`

## Run Locally

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
python -m pip install fastapi uvicorn httpx python-multipart pillow
```

Run the API server:

```bash
cd server
python main.py
```

Run the frontend:

```bash
npm run dev
```

The frontend expects the FastAPI server under `/api`. In local development, run both from this repo so the Vite app can talk to the backend.

## Build

```bash
npm run build
python -m py_compile server/main.py
```

## Data Ownership And Git Safety

This repo now separates shipped app data from runtime user data clearly.

- `data/user/` is the runtime write location used by the app server.
- `data/user/` is gitignored and must never be committed.
- Boards, notes, tasks, events, artefacts, AI chat history, AI config, uploaded backgrounds, generated images, and memories all live under `data/user/`.
- Built-in themes and built-in background presets are app-owned and defined in [src/lib/theme.ts](C:/Users/user/Desktop/Planning/nucleus/src/lib/theme.ts).
- `data/config.example.json` is the tracked example config.
- Legacy runtime files directly under `data/` are still ignored and are migrated into `data/user/` on server startup when needed.

See [data/README.md](C:/Users/user/Desktop/Planning/nucleus/data/README.md) for the storage split in one place.

## Important Paths

- Frontend entry: [src/App.tsx](C:/Users/user/Desktop/Planning/nucleus/src/App.tsx)
- AI panel: [src/components/AIPanel.tsx](C:/Users/user/Desktop/Planning/nucleus/src/components/AIPanel.tsx)
- Appearance system: [src/components/SettingsSection.tsx](C:/Users/user/Desktop/Planning/nucleus/src/components/SettingsSection.tsx)
- Theme and built-in preset definitions: [src/lib/theme.ts](C:/Users/user/Desktop/Planning/nucleus/src/lib/theme.ts)
- Storage client: [src/lib/storage.ts](C:/Users/user/Desktop/Planning/nucleus/src/lib/storage.ts)
- API server: [server/main.py](C:/Users/user/Desktop/Planning/nucleus/server/main.py)

## Runtime Data Layout

These paths are created and maintained locally under `data/user/`:

- `ai-agent.md` and `ai-agent.local.md`
- `config.json`
- `theme-settings.json`
- `ai-chats.json`
- `memories/index.md`
- `memories/agent/index.md`
- `memories/agent/log/*.md`
- `memories/user/*.md`
- `whiteboards/`
- `me/`
- `backgrounds/uploads/`
- `backgrounds/generated/`

## Notes For Contributors

- Built-in themes and presets are intentionally read-only in the UI.
- Custom themes and presets should get new ids and persist as non-built-ins.
- Legacy preset ids should not be treated as built-ins.
- If you add new runtime storage, keep it under `data/user/` and update `.gitignore` plus the docs.
