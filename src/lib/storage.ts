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

import type { Board, BoardCollection, BoardIndex, BoardScope, MemoryTree, ThemeSettings } from './types'
import { createDefaultThemeSettings, normalizeThemeSettings } from './theme'

const BOARD_COLLECTION_TO_SCOPE: Record<BoardCollection, BoardScope> = {
  boards: 'whiteboards',
  personal: 'me',
}

export function boardCollectionToScope(collection: BoardCollection): BoardScope {
  return BOARD_COLLECTION_TO_SCOPE[collection]
}

export function boardScopeToCollection(scope: BoardScope): BoardCollection {
  return scope === 'me' ? 'personal' : 'boards'
}

export async function loadBoardIndex(scope: BoardScope): Promise<BoardIndex> {
  return loadJSON<BoardIndex>(`${scope}/index.json`, { boards: [] })
}

export async function saveBoardIndex(scope: BoardScope, index: BoardIndex): Promise<void> {
  return saveJSON(`${scope}/index.json`, index)
}

export async function loadBoard(scope: BoardScope, boardId: string): Promise<Board | null> {
  try {
    return await request<Board>(`/data/${scope}/${boardId}/board.json`)
  } catch {
    return null
  }
}

export async function saveBoard(scope: BoardScope, board: Board): Promise<void> {
  await saveJSON(`${scope}/${board.id}/board.json`, board)
}

export async function saveBoardSnapshot(scope: BoardScope, board: Board): Promise<void> {
  const ts = Date.now()
  await saveJSON(`${scope}/${board.id}/history/${ts}.json`, board)
}

export async function loadBoardHistory(scope: BoardScope, boardId: string): Promise<string[]> {
  try {
    return await request<string[]>(`/boards/${scope}/${boardId}/history`)
  } catch {
    return []
  }
}

export async function loadBoardIndices() {
  const [whiteboards, me] = await Promise.all([
    loadBoardIndex('whiteboards'),
    loadBoardIndex('me'),
  ])
  return { whiteboards, me }
}

export async function resolveBoardScope(boardId: string): Promise<BoardScope | null> {
  const { whiteboards, me } = await loadBoardIndices()
  if (whiteboards.boards.some((board) => board.id === boardId)) return 'whiteboards'
  if (me.boards.some((board) => board.id === boardId)) return 'me'
  return null
}

export async function loadBoardById(boardId: string): Promise<{ scope: BoardScope; board: Board } | null> {
  const scope = await resolveBoardScope(boardId)
  if (!scope) return null
  const board = await loadBoard(scope, boardId)
  return board ? { scope, board } : null
}

/* ── Image upload ── */

export async function uploadImage(scope: BoardScope, boardId: string, file: File): Promise<string> {
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

export async function uploadBackgroundAsset(file: File): Promise<{ path: string; name: string; mediaType: 'image' | 'video' }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/backgrounds/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Background upload failed')
  return res.json()
}

/* ── AI config (separate, gitignored) ── */

export async function loadAIConfig(): Promise<import('./types').AIConfig> {
  return loadJSON('config.json', { apiKey: '', model: 'stepfun/step-3.5-flash:free', openaiKey: '', permMode: 'allow', permCustom: {} })
}

export async function saveAIConfig(config: import('./types').AIConfig): Promise<void> {
  return saveJSON('config.json', config)
}

export async function loadThemeSettings(): Promise<ThemeSettings> {
  const raw = await loadJSON<ThemeSettings>('theme-settings.json', createDefaultThemeSettings())
  return normalizeThemeSettings(raw)
}

export async function saveThemeSettings(settings: ThemeSettings): Promise<void> {
  return saveJSON('theme-settings.json', settings)
}

/* ── Memories ── */

export async function loadMemoryTree(): Promise<MemoryTree> {
  return request<MemoryTree>('/memories/tree')
}

export async function loadAgentMemorySummary(fallback: string): Promise<string> {
  return loadMD('memories/agent/index.md', fallback)
}

export async function saveAgentMemorySummary(content: string, appendLog = false): Promise<void> {
  if (!appendLog) {
    await saveMD('memories/agent/index.md', content)
    return
  }
  await request('/memories/agent', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function deleteMemoryFile(filepath: string): Promise<void> {
  await fetch(`${BASE}/memories/${filepath}`, { method: 'DELETE' })
}

/* ── AI chat history ── */

export async function loadChats<T>(): Promise<T[]> {
  return loadJSON<T[]>('ai-chats.json', [])
}

export async function saveChats<T>(sessions: T[]): Promise<void> {
  return saveJSON('ai-chats.json', sessions)
}
