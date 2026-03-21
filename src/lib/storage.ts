/**
 * File-backed storage client.
 * All reads/writes go through the FastAPI server at /api.
 */

const BASE = '/api'

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

/* ── Generic JSON files ── */

export async function loadJSON<T>(filename: string, fallback: T): Promise<T> {
  try {
    return await request<T>(`/data/${filename}`)
  } catch {
    return fallback
  }
}

export async function saveJSON<T>(filename: string, data: T): Promise<void> {
  await request(`/data/${filename}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/* ── Markdown files ── */

export async function loadMD(filename: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(`${BASE}/data/${filename}`)
    if (!res.ok) return fallback
    return await res.text()
  } catch {
    return fallback
  }
}

export async function saveMD(filename: string, content: string): Promise<void> {
  await fetch(`${BASE}/data/${filename}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/markdown' },
    body: content,
  })
}

/* ── Board operations ── */

import type { BoardIndex, Board, WBItem } from './types'

export async function loadBoardIndex(scope: 'whiteboards' | 'me'): Promise<BoardIndex> {
  return loadJSON<BoardIndex>(`${scope}/index.json`, { boards: [] })
}

export async function saveBoardIndex(scope: 'whiteboards' | 'me', index: BoardIndex): Promise<void> {
  return saveJSON(`${scope}/index.json`, index)
}

export async function loadBoard(scope: 'whiteboards' | 'me', boardId: string): Promise<Board | null> {
  try {
    return await request<Board>(`/data/${scope}/${boardId}/board.json`)
  } catch {
    return null
  }
}

export async function saveBoard(scope: 'whiteboards' | 'me', board: Board): Promise<void> {
  await saveJSON(`${scope}/${board.id}/board.json`, board)
}

export async function saveBoardSnapshot(scope: 'whiteboards' | 'me', board: Board): Promise<void> {
  const ts = Date.now()
  await saveJSON(`${scope}/${board.id}/history/${ts}.json`, board)
}

export async function loadBoardHistory(scope: 'whiteboards' | 'me', boardId: string): Promise<string[]> {
  try {
    return await request<string[]>(`/boards/${scope}/${boardId}/history`)
  } catch {
    return []
  }
}

/* ── Image upload ── */

export async function uploadImage(scope: 'whiteboards' | 'me', boardId: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/boards/${scope}/${boardId}/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.path // relative path to use as src
}

/* ── AI config (separate, gitignored) ── */

export async function loadAIConfig(): Promise<{ apiKey: string; model: string }> {
  return loadJSON('config.json', { apiKey: '', model: 'stepfun/step-3.5-flash:free' })
}

export async function saveAIConfig(config: { apiKey: string; model: string }): Promise<void> {
  return saveJSON('config.json', config)
}
