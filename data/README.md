# Data Layout

`data/` is split into tracked app-owned files and gitignored runtime user data.

## Tracked

- `config.example.json` is the example AI config template.
- Built-in themes and built-in background presets are defined in `src/lib/theme.ts`, not in runtime JSON.
- Any future repo-owned example or preset assets should stay outside `data/user/`.

## Gitignored Runtime Data

- `data/user/` is the only runtime write location used by the app server.
- Notes, tasks, events, artefacts, boards, memories, AI chat history, AI config, uploaded backgrounds, and generated images all live under `data/user/`.

## Legacy Paths

- Old runtime paths directly under `data/` are still ignored during migration.
- On startup, the server migrates legacy runtime files into `data/user/` when the new location does not already exist.
