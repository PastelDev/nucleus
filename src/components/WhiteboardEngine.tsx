import { useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { WBItem, WBSticky, WBTextbox, WBShape, WBImage, Board, BoardIndex } from '../lib/types'
import { uid, WB_SIZE, STICKY_COLORS, PEN_COLORS, arrPts } from '../lib/helpers'
import * as storage from '../lib/storage'

const WB_TOOLS = [
  { id: 'select', label: 'Select / Pan', icon: 'M5 3l14 9-7 1-3 7z' },
  { id: 'sticky', label: 'Sticky Note', icon: 'M14 2H6a2 2 0 0 0-2 2v16l4-4h12V4a2 2 0 0 0-2-2z' },
  { id: 'textbox', label: 'Text Box', icon: 'M4 7V4h16v3M9 20h6M12 4v16' },
  { id: 'rect', label: 'Rectangle', icon: 'M3 3h18v18H3z' },
  { id: 'circle', label: 'Ellipse', icon: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z' },
  { id: 'arrow', label: 'Arrow', icon: 'M5 12h14M12 5l7 7-7 7' },
  { id: 'pen', label: 'Pen', icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' },
  { id: 'image', label: 'Image', icon: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z' },
] as const

type ToolId = (typeof WB_TOOLS)[number]['id']
type ShapeTool = 'rect' | 'circle' | 'arrow'
type Scope = 'whiteboards' | 'me'

interface Props {
  scope: Scope
  title?: string
}

interface DragState {
  id: string
  ox: number
  oy: number
  ox2?: number
  oy2?: number
  sx: number
  sy: number
}

interface ResizeState {
  id: string
  ow: number
  oh: number
  sx: number
  sy: number
}

interface PanningState {
  sx: number
  sy: number
  px: number
  py: number
}

interface CreatingState {
  type: ShapeTool
  sx: number
  sy: number
  ex: number
  ey: number
}

interface PenState {
  pts: Array<{ x: number; y: number }>
  color: string
  sw: number
}

const STROKE_OPTIONS = [1, 2, 4, 6]

function cloneItems(source: WBItem[]): WBItem[] {
  return JSON.parse(JSON.stringify(source)) as WBItem[]
}

function sameItems(a: WBItem[], b: WBItem[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function WhiteboardEngine({ scope, title }: Props) {
  const [index, setIndex] = useState<BoardIndex>({ boards: [] })
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [items, setItems] = useState<WBItem[]>([])
  const [boardMeta, setBoardMeta] = useState<Board | null>(null)
  const [newBoardName, setNewBoardName] = useState('')
  const [renameBoardId, setRenameBoardId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [historyList, setHistoryList] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const viewRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef(items)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gestureSnapshotRef = useRef<WBItem[] | null>(null)
  const textEditHistoryRef = useRef<string | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)

  const [pan, setPan] = useState({ x: 80, y: 80 })
  const [zoom, setZoom] = useState(1)
  const [tool, setTool] = useState<ToolId>('select')
  const [selId, setSelId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [resize, setResize] = useState<ResizeState | null>(null)
  const [panning, setPanning] = useState<PanningState | null>(null)
  const [creating, setCreating] = useState<CreatingState | null>(null)
  const [penPath, setPenPath] = useState<PenState | null>(null)
  const [inkColor, setInkColor] = useState('#a78bfa')
  const [inkW, setInkW] = useState(2)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [showStrokeMenu, setShowStrokeMenu] = useState(false)
  const [undoStack, setUndoStack] = useState<WBItem[][]>([])
  const [redoStack, setRedoStack] = useState<WBItem[][]>([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const activeBoard = index.boards.find((board) => board.id === activeBoardId) ?? null
  const parentBoard = activeBoard?.parentId ? index.boards.find((board) => board.id === activeBoard.parentId) ?? null : null
  const rootBoards = index.boards.filter((board) => !board.parentId)
  const subBoards = useCallback((parentId: string) => index.boards.filter((board) => board.parentId === parentId), [index.boards])

  const pushUndoSnapshot = useCallback((snapshot = itemsRef.current) => {
    setUndoStack((current) => [...current.slice(-49), cloneItems(snapshot)])
    setRedoStack([])
  }, [])

  const beginGestureHistory = useCallback((snapshot = itemsRef.current) => {
    gestureSnapshotRef.current = cloneItems(snapshot)
  }, [])

  const finishGestureHistory = useCallback((nextItems: WBItem[]) => {
    const snapshot = gestureSnapshotRef.current
    gestureSnapshotRef.current = null
    if (!snapshot || sameItems(snapshot, nextItems)) return
    setUndoStack((current) => [...current.slice(-49), snapshot])
    setRedoStack([])
  }, [])

  const undo = useCallback(() => {
    setUndoStack((current) => {
      if (current.length === 0) return current
      const previous = current[current.length - 1]
      setRedoStack((redo) => [...redo.slice(-49), cloneItems(itemsRef.current)])
      setItems(cloneItems(previous))
      setSelId(null)
      setEditId(null)
      return current.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setRedoStack((current) => {
      if (current.length === 0) return current
      const next = current[current.length - 1]
      setUndoStack((undoItems) => [...undoItems.slice(-49), cloneItems(itemsRef.current)])
      setItems(cloneItems(next))
      setSelId(null)
      setEditId(null)
      return current.slice(0, -1)
    })
  }, [])

  useEffect(() => {
    storage.loadBoardIndex(scope).then((loadedIndex) => {
      setIndex(loadedIndex)
      const pending = (window as Window & { __nucleusSelectBoard?: { scope: Scope; boardId: string } }).__nucleusSelectBoard
      if (pending && pending.scope === scope) {
        delete (window as Window & { __nucleusSelectBoard?: { scope: Scope; boardId: string } }).__nucleusSelectBoard
        const target = loadedIndex.boards.find((board) => board.id === pending.boardId)
        setActiveBoardId(target?.id ?? loadedIndex.boards[0]?.id ?? null)
      } else {
        setActiveBoardId(loadedIndex.boards[0]?.id ?? null)
      }
    })
  }, [scope])

  useEffect(() => {
    const handler = (event: CustomEvent<{ scope: Scope; boardId: string }>) => {
      if (event.detail.scope !== scope) return
      if (event.detail.boardId === activeBoardId) {
        storage.loadBoard(scope, event.detail.boardId).then((board) => {
          if (!board) return
          setItems(board.items)
          setBoardMeta(board)
        })
      } else {
        setActiveBoardId(event.detail.boardId)
      }
    }

    window.addEventListener('nucleus:select-board', handler as EventListener)
    return () => window.removeEventListener('nucleus:select-board', handler as EventListener)
  }, [scope, activeBoardId])

  useEffect(() => {
    if (!activeBoardId) {
      setItems([])
      setBoardMeta(null)
      setUndoStack([])
      setRedoStack([])
      setSelId(null)
      setEditId(null)
      return
    }

    storage.loadBoard(scope, activeBoardId).then((board) => {
      if (board) {
        setItems(board.items)
        setBoardMeta(board)
      } else {
        setItems([])
        setBoardMeta(null)
      }
      setUndoStack([])
      setRedoStack([])
      setSelId(null)
      setEditId(null)
      setShowHistory(false)
      setHistoryList([])
      gestureSnapshotRef.current = null
      textEditHistoryRef.current = null
    })
  }, [activeBoardId, scope])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!activeBoardId || !boardMeta) return
      const updated: Board = { ...boardMeta, items: itemsRef.current, updatedAt: Date.now() }
      storage.saveBoard(scope, updated)
      setBoardMeta(updated)
    }, 450)
  }, [activeBoardId, boardMeta, scope])

  useEffect(() => {
    if (activeBoardId && boardMeta) scheduleSave()
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [items, activeBoardId, boardMeta, scheduleSave])

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (toolbarRef.current?.contains(event.target as Node)) return
      setShowColorMenu(false)
      setShowStrokeMenu(false)
    }

    window.addEventListener('pointerdown', closeMenus)
    return () => window.removeEventListener('pointerdown', closeMenus)
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const modifier = event.ctrlKey || event.metaKey

      if (modifier && !typing) {
        const key = event.key.toLowerCase()
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault()
          undo()
          return
        }
        if (key === 'y' || (key === 'z' && event.shiftKey)) {
          event.preventDefault()
          redo()
          return
        }
      }

      if (typing) return

      if ((event.key === 'Delete' || event.key === 'Backspace') && selId && editId !== selId) {
        pushUndoSnapshot()
        setItems((current) => current.filter((item) => item.id !== selId))
        setSelId(null)
      }
      if (event.key === 'Escape') {
        setSelId(null)
        setEditId(null)
        setTool('select')
        setShowColorMenu(false)
        setShowStrokeMenu(false)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selId, editId, pushUndoSnapshot, undo, redo])

  const createBoard = async (parentId?: string) => {
    const name = newBoardName.trim() || 'Untitled Board'
    const id = uid()
    const board: Board = { id, name, parentId, items: [], createdAt: Date.now(), updatedAt: Date.now() }
    const nextIndex = { boards: [...index.boards, { id, name, parentId }] }
    await storage.saveBoard(scope, board)
    await storage.saveBoardIndex(scope, nextIndex)
    setIndex(nextIndex)
    setActiveBoardId(id)
    setNewBoardName('')
  }

  const renameBoard = async (boardId: string, rawName: string) => {
    const nextName = rawName.trim() || 'Untitled Board'
    const currentEntry = index.boards.find((board) => board.id === boardId)
    if (!currentEntry || currentEntry.name === nextName) {
      setRenameBoardId(null)
      return
    }

    const nextIndex = {
      boards: index.boards.map((board) => board.id === boardId ? { ...board, name: nextName } : board),
    }
    setIndex(nextIndex)
    await storage.saveBoardIndex(scope, nextIndex)

    if (boardMeta?.id === boardId) {
      const updated: Board = { ...boardMeta, name: nextName, updatedAt: Date.now() }
      setBoardMeta(updated)
      await storage.saveBoard(scope, updated)
    } else {
      const board = await storage.loadBoard(scope, boardId)
      if (board) {
        await storage.saveBoard(scope, { ...board, name: nextName, updatedAt: Date.now() })
      }
    }

    setRenameBoardId(null)
  }

  const deleteBoard = async (boardId: string) => {
    const toRemove = new Set<string>()
    const collect = (parentId: string) => {
      toRemove.add(parentId)
      index.boards.filter((board) => board.parentId === parentId).forEach((board) => collect(board.id))
    }

    collect(boardId)
    for (const id of toRemove) {
      await storage.saveJSON(`${scope}/${id}/board.json`, null).catch(() => {})
    }

    const nextIndex = { boards: index.boards.filter((board) => !toRemove.has(board.id)) }
    await storage.saveBoardIndex(scope, nextIndex)
    setIndex(nextIndex)
    setRenameBoardId(null)

    if (activeBoardId && toRemove.has(activeBoardId)) {
      setActiveBoardId(nextIndex.boards[0]?.id ?? null)
    }
  }

  const saveSnapshot = async () => {
    if (!boardMeta) return
    const updated: Board = { ...boardMeta, items, updatedAt: Date.now() }
    await storage.saveBoardSnapshot(scope, updated)
    const history = await storage.loadBoardHistory(scope, boardMeta.id)
    setHistoryList(history)
    setShowHistory(true)
  }

  const loadSnapshot = async (snapshotId: string) => {
    if (!activeBoardId) return
    try {
      const res = await fetch(`/api/boards/${scope}/${activeBoardId}/history/${snapshotId}`)
      if (!res.ok) return
      const board: Board = await res.json()
      pushUndoSnapshot()
      setItems(board.items)
      setBoardMeta((current) => current ? { ...current, updatedAt: Date.now() } : board)
      setSelId(null)
    } catch {
      // ignore snapshot fetch errors
    }
  }

  const exportSVG = () => {
    if (!viewRef.current) return
    const svg = viewRef.current.querySelector('[data-export-svg="1"]')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${boardMeta?.name || 'board'}.svg`
    link.click()
  }

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = viewRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    }
  }, [pan, zoom])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !activeBoardId || !viewRef.current) return

    const path = await storage.uploadImage(scope, activeBoardId, file)
    const rect = viewRef.current.getBoundingClientRect()
    const { x, y } = toCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const image: WBImage = { id: uid(), type: 'image', x, y, w: 320, h: 220, src: path, name: file.name }
    pushUndoSnapshot()
    setItems((current) => [...current, image])
    setSelId(image.id)
    setTool('select')
    event.target.value = ''
  }

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 0.88 : 1.13
    const nextZoom = Math.max(0.15, Math.min(4, zoom * factor))
    const rect = viewRef.current!.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    setPan((current) => ({
      x: cx - (cx - current.x) * (nextZoom / zoom),
      y: cy - (cy - current.y) * (nextZoom / zoom),
    }))
    setZoom(nextZoom)
  }

  const updateTextItem = (itemId: string, content: string) => {
    if (textEditHistoryRef.current !== itemId) {
      pushUndoSnapshot()
      textEditHistoryRef.current = itemId
    }
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, content } as WBItem : item))
  }

  const onViewDown = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement
    if (target !== viewRef.current && !target.closest('[data-wb-bg]')) return

    setShowColorMenu(false)
    setShowStrokeMenu(false)

    const { x, y } = toCanvas(event.clientX, event.clientY)
    if (tool === 'select') {
      setSelId(null)
      setPanning({ sx: event.clientX, sy: event.clientY, px: pan.x, py: pan.y })
      return
    }

    if (tool === 'sticky') {
      const sticky: WBSticky = {
        id: uid(),
        type: 'sticky',
        x,
        y,
        w: 210,
        h: 160,
        content: '',
        color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
      }
      pushUndoSnapshot()
      setItems((current) => [...current, sticky])
      setSelId(sticky.id)
      setEditId(sticky.id)
      setTool('select')
      return
    }

    if (tool === 'textbox') {
      const textbox: WBTextbox = {
        id: uid(),
        type: 'textbox',
        x,
        y,
        w: 240,
        h: 60,
        content: 'Type here...',
        color: '#ffffff',
      }
      pushUndoSnapshot()
      setItems((current) => [...current, textbox])
      setSelId(textbox.id)
      setEditId(textbox.id)
      setTool('select')
      return
    }

    if (tool === 'image') {
      imgInputRef.current?.click()
      return
    }

    if (tool === 'pen') {
      beginGestureHistory()
      setPenPath({ pts: [{ x, y }], color: inkColor, sw: inkW })
      viewRef.current?.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'rect' || tool === 'circle' || tool === 'arrow') {
      beginGestureHistory()
      setCreating({ type: tool, sx: x, sy: y, ex: x, ey: y })
      viewRef.current?.setPointerCapture(event.pointerId)
    }
  }

  const onViewMove = (event: React.PointerEvent) => {
    const { x, y } = toCanvas(event.clientX, event.clientY)
    if (panning) {
      setPan({ x: panning.px + (event.clientX - panning.sx), y: panning.py + (event.clientY - panning.sy) })
      return
    }

    if (drag) {
      const dx = x - drag.sx
      const dy = y - drag.sy
      setItems((current) => current.map((item) => {
        if (item.id !== drag.id) return item
        if (item.type === 'shape' && item.shapeType === 'arrow') {
          return { ...item, x: drag.ox + dx, y: drag.oy + dy, x2: (drag.ox2 ?? item.x2 ?? 0) + dx, y2: (drag.oy2 ?? item.y2 ?? 0) + dy }
        }
        return { ...item, x: drag.ox + dx, y: drag.oy + dy } as WBItem
      }))
      return
    }

    if (resize) {
      setItems((current) => current.map((item) =>
        item.id === resize.id
          ? { ...item, w: Math.max(90, resize.ow + (x - resize.sx)), h: Math.max(50, resize.oh + (y - resize.sy)) } as WBItem
          : item,
      ))
      return
    }

    if (penPath) {
      setPenPath((current) => current ? { ...current, pts: [...current.pts, { x, y }] } : current)
      return
    }

    if (creating) {
      setCreating((current) => current ? { ...current, ex: x, ey: y } : current)
    }
  }

  const onViewUp = () => {
    if (panning) {
      setPanning(null)
      return
    }

    if (drag) {
      const nextItems = itemsRef.current
      setDrag(null)
      finishGestureHistory(nextItems)
      return
    }

    if (resize) {
      const nextItems = itemsRef.current
      setResize(null)
      finishGestureHistory(nextItems)
      return
    }

    if (penPath && penPath.pts.length > 2) {
      const d = penPath.pts.reduce((path, point, index) =>
        index === 0 ? `M${point.x} ${point.y}` : `${path} L${point.x} ${point.y}`,
      '')
      const nextItems = [...itemsRef.current, { id: uid(), type: 'path', d, color: penPath.color, sw: penPath.sw } as WBItem]
      setItems(nextItems)
      finishGestureHistory(nextItems)
    } else if (penPath) {
      finishGestureHistory(itemsRef.current)
    }
    setPenPath(null)

    if (creating) {
      const { type, sx, sy, ex, ey } = creating
      const distance = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
      if (distance > 8) {
        let item: WBItem
        if (type === 'arrow') {
          item = { id: uid(), type: 'shape', shapeType: 'arrow', x: sx, y: sy, x2: ex, y2: ey, color: inkColor }
        } else {
          item = {
            id: uid(),
            type: 'shape',
            shapeType: type,
            x: Math.min(sx, ex),
            y: Math.min(sy, ey),
            w: Math.abs(ex - sx),
            h: Math.abs(ey - sy),
            color: inkColor,
            fill: `${inkColor}28`,
          }
        }
        const nextItems = [...itemsRef.current, item]
        setItems(nextItems)
        setSelId(item.id)
        finishGestureHistory(nextItems)
      } else {
        finishGestureHistory(itemsRef.current)
      }
      setCreating(null)
      setTool('select')
    }
  }

  const startItemDrag = (event: ReactPointerEvent, item: WBSticky | WBTextbox | WBShape | WBImage) => {
    event.stopPropagation()
    if (editId === item.id) return
    beginGestureHistory()
    const { x, y } = toCanvas(event.clientX, event.clientY)
    setSelId(item.id)
    setDrag({ id: item.id, ox: item.x, oy: item.y, ox2: 'x2' in item ? item.x2 : undefined, oy2: 'y2' in item ? item.y2 : undefined, sx: x, sy: y })
  }

  const startResize = (event: ReactPointerEvent, item: WBSticky | WBTextbox | WBImage) => {
    event.stopPropagation()
    beginGestureHistory()
    const { x, y } = toCanvas(event.clientX, event.clientY)
    setResize({ id: item.id, ow: item.w, oh: item.h, sx: x, sy: y })
  }

  const deleteSelectedItem = () => {
    if (!selId) return
    pushUndoSnapshot()
    setItems((current) => current.filter((item) => item.id !== selId))
    setSelId(null)
  }

  const previewShape = () => {
    if (!creating) return null
    const { type, sx, sy, ex, ey } = creating
    const x = Math.min(sx, ex)
    const y = Math.min(sy, ey)
    const w = Math.abs(ex - sx)
    const h = Math.abs(ey - sy)
    const preview = { stroke: inkColor, strokeWidth: 2, strokeDasharray: '6 3', fill: `${inkColor}22` }
    if (type === 'rect') return <rect x={x} y={y} width={w} height={h} rx={4} {...preview} />
    if (type === 'circle') return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...preview} />
    return (
      <>
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={inkColor} strokeWidth={2} strokeDasharray="6 3" />
        <polygon points={arrPts(sx, sy, ex, ey)} fill={inkColor} />
      </>
    )
  }

  const renderBoardRow = (board: BoardIndex['boards'][number], nested = false) => {
    const active = activeBoardId === board.id
    const children = subBoards(board.id)
    const renaming = renameBoardId === board.id

    return (
      <div key={board.id}>
        <div
          onClick={() => setActiveBoardId(board.id)}
          style={{
            ...boardRow,
            padding: nested ? '6px 10px 6px 24px' : '8px 10px',
            background: active ? 'var(--accent-surface)' : 'transparent',
            color: active ? 'var(--accent-light)' : nested ? 'var(--text-secondary)' : 'var(--text-primary)',
            fontWeight: active ? 700 : nested ? 500 : 600,
          }}
        >
          {renaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onBlur={() => renameBoard(board.id, renameDraft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') renameBoard(board.id, renameDraft)
                if (event.key === 'Escape') setRenameBoardId(null)
              }}
              onClick={(event) => event.stopPropagation()}
              style={boardNameInput}
            />
          ) : (
            <span
              onDoubleClick={(event) => {
                event.stopPropagation()
                setRenameBoardId(board.id)
                setRenameDraft(board.name)
              }}
              style={boardNameButton}
              title="Double-click to rename"
            >
              {board.name}
            </span>
          )}

          {children.length > 0 && !nested && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>{children.length}</span>
          )}
        </div>

        {!nested && children.map((child) => renderBoardRow(child, true))}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-sidebar)',
        minHeight: 0,
      }}>
        <div style={{ padding: '16px 12px 10px' }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem', fontFamily: 'var(--font-heading)', marginBottom: 12 }}>
            {title || 'Boards'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newBoardName}
              onChange={(event) => setNewBoardName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && createBoard()}
              placeholder="New board..."
              style={miniInput}
            />
            <button type="button" onClick={() => createBoard()} style={miniPrimaryButton}>
              +
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px 10px' }}>
          {rootBoards.map((board) => renderBoardRow(board))}
          {rootBoards.length === 0 && (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.78rem', textAlign: 'center', marginTop: 22, padding: '0 8px' }}>
              No boards yet. Create one above.
            </div>
          )}
        </div>

        {activeBoardId && (
          <div style={{ padding: '10px', borderTop: '1px solid var(--border)', display: 'grid', gap: 6 }}>
            <button type="button" onClick={() => createBoard(activeBoardId)} style={actionBtn}>
              + Sub-board
            </button>
            <button type="button" onClick={saveSnapshot} style={actionBtn}>
              Save Snapshot
            </button>
            <button
              type="button"
              onClick={() => {
                storage.loadBoardHistory(scope, activeBoardId).then((history) => {
                  setHistoryList(history)
                  setShowHistory((current) => !current)
                })
              }}
              style={actionBtn}
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
            <button type="button" onClick={exportSVG} style={actionBtn}>
              Export SVG
            </button>
            <button type="button" onClick={() => deleteBoard(activeBoardId)} style={{ ...actionBtn, color: 'var(--red)' }}>
              Delete Board
            </button>
          </div>
        )}

        {showHistory && historyList.length > 0 && (
          <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--border)', maxHeight: 180, overflowY: 'auto' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Snapshots
            </div>
            {historyList.map((timestamp) => (
              <button
                type="button"
                key={timestamp}
                onClick={() => loadSnapshot(timestamp)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  padding: '5px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.74rem',
                }}
              >
                {new Date(Number.parseInt(timestamp, 10)).toLocaleString()}
              </button>
            ))}
          </div>
        )}
      </div>

      {!activeBoardId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '0.9rem' }}>
          Select or create a board
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            ref={toolbarRef}
            style={{
              minHeight: 58,
              flexShrink: 0,
              background: 'var(--bg-sidebar)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              overflowX: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 10, flexShrink: 0 }}>
              {parentBoard && (
                <>
                  <button type="button" onClick={() => setActiveBoardId(parentBoard.id)} style={crumbButton}>
                    {parentBoard.name}
                  </button>
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>›</span>
                </>
              )}
              {renameBoardId === activeBoardId ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={() => { if (activeBoardId) renameBoard(activeBoardId, renameDraft) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && activeBoardId) renameBoard(activeBoardId, renameDraft)
                    if (event.key === 'Escape') setRenameBoardId(null)
                  }}
                  style={{ ...boardNameInput, minWidth: 140 }}
                />
              ) : (
                <span
                  onDoubleClick={() => {
                    if (!activeBoard) return
                    setRenameBoardId(activeBoard.id)
                    setRenameDraft(activeBoard.name)
                  }}
                  style={{ ...crumbButton, color: 'var(--accent-light)', fontWeight: 700, cursor: 'default' }}
                  title="Double-click to rename"
                >
                  {activeBoard?.name}
                </span>
              )}
            </div>

            {WB_TOOLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                title={entry.label}
                onClick={() => {
                  setTool(entry.id)
                  if (entry.id === 'image') imgInputRef.current?.click()
                }}
                style={{
                  ...toolButton,
                  background: tool === entry.id ? 'var(--accent-surface)' : 'transparent',
                  color: tool === entry.id ? 'var(--accent-light)' : 'var(--text-muted)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={entry.icon} />
                </svg>
              </button>
            ))}

            <div style={divider} />

            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setShowColorMenu((current) => !current)
                  setShowStrokeMenu(false)
                }}
                style={{
                  ...toolButton,
                  width: 'auto',
                  padding: '0 10px',
                  gap: 8,
                  color: showColorMenu ? 'var(--accent-light)' : 'var(--text-secondary)',
                  background: showColorMenu ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                  borderColor: showColorMenu ? 'var(--accent)' : 'var(--border)',
                }}
                title="Color menu"
              >
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: `conic-gradient(${PEN_COLORS.join(', ')})`, border: '1px solid rgba(255,255,255,0.2)' }} />
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: inkColor, border: '2px solid rgba(255,255,255,0.7)' }} />
              </button>
              {showColorMenu && (
                <div style={popover}>
                  {PEN_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setInkColor(color)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: inkColor === color ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                        border: `1px solid ${inkColor === color ? 'var(--accent)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.22)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setShowStrokeMenu((current) => !current)
                  setShowColorMenu(false)
                }}
                style={{
                  ...toolButton,
                  width: 'auto',
                  padding: '0 10px',
                  gap: 8,
                  color: showStrokeMenu ? 'var(--accent-light)' : 'var(--text-secondary)',
                  background: showStrokeMenu ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                  borderColor: showStrokeMenu ? 'var(--accent)' : 'var(--border)',
                }}
                title="Stroke menu"
              >
                <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Stroke</span>
                <span style={{ width: 22, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={{ width: 18, height: inkW, borderRadius: 999, background: inkColor }} />
                </span>
              </button>
              {showStrokeMenu && (
                <div style={{ ...popover, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {STROKE_OPTIONS.map((width) => (
                    <button
                      type="button"
                      key={width}
                      onClick={() => setInkW(width)}
                      style={{
                        ...strokeOptionButton,
                        justifyContent: 'center',
                        minWidth: 48,
                        borderColor: inkW === width ? 'var(--accent)' : 'var(--border)',
                        background: inkW === width ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                      }}
                    >
                      <span style={{ width: 30, height: width, borderRadius: 999, background: inkColor }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={divider} />

            <button type="button" onClick={undo} disabled={undoStack.length === 0} style={{ ...ghostChip, opacity: undoStack.length === 0 ? 0.42 : 1 }}>
              Undo
            </button>
            <button type="button" onClick={redo} disabled={redoStack.length === 0} style={{ ...ghostChip, opacity: redoStack.length === 0 ? 0.42 : 1 }}>
              Redo
            </button>

            <div style={{ flex: 1 }} />

            {selId && (
              <button type="button" onClick={deleteSelectedItem} style={{ ...ghostChip, color: 'var(--red)', borderColor: 'var(--border)' }}>
                Delete
              </button>
            )}

            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', flexShrink: 0 }}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => {
                setPan({ x: 80, y: 80 })
                setZoom(1)
              }}
              style={ghostChip}
            >
              Reset View
            </button>
          </div>

          <div
            ref={viewRef}
            data-wb-bg="1"
            onPointerDown={onViewDown}
            onPointerMove={onViewMove}
            onPointerUp={onViewUp}
            onWheel={handleWheel}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              cursor: tool === 'select' ? 'default' : 'crosshair',
              touchAction: 'none',
              background: 'var(--board-bg)',
            }}
          >
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <pattern
                  id={`dots-${scope}`}
                  x={pan.x % (20 * zoom)}
                  y={pan.y % (20 * zoom)}
                  width={20 * zoom}
                  height={20 * zoom}
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx={1} cy={1} r={0.9} fill="var(--board-grid)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#dots-${scope})`} />
            </svg>

            <div
              style={{
                position: 'absolute',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                width: WB_SIZE.w,
                height: WB_SIZE.h,
              }}
            >
              <svg
                data-export-svg="1"
                style={{ position: 'absolute', inset: 0, width: WB_SIZE.w, height: WB_SIZE.h, pointerEvents: 'none', overflow: 'visible' }}
              >
                {items.filter((item) => item.type === 'path').map((item) => (
                  <path
                    key={item.id}
                    d={item.d}
                    stroke={item.color}
                    strokeWidth={item.sw || 2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: selId === item.id ? `drop-shadow(0 0 4px ${item.color})` : 'none' }}
                  />
                ))}

                {items.filter((item) => item.type === 'shape').map((item) => {
                  const selected = selId === item.id
                  const strokeWidth = selected ? 2.5 : 1.5
                  const onPointerDown = (event: ReactPointerEvent) => startItemDrag(event, item)

                  if (item.shapeType === 'rect') {
                    return (
                      <rect
                        key={item.id}
                        x={item.x}
                        y={item.y}
                        width={item.w}
                        height={item.h}
                        rx={5}
                        fill={item.fill}
                        stroke={item.color}
                        strokeWidth={strokeWidth}
                        style={{ pointerEvents: 'all', cursor: 'move', filter: selected ? `drop-shadow(0 0 6px ${item.color}55)` : 'none' }}
                        onPointerDown={onPointerDown}
                      />
                    )
                  }

                  if (item.shapeType === 'circle') {
                    return (
                      <ellipse
                        key={item.id}
                        cx={item.x + (item.w || 0) / 2}
                        cy={item.y + (item.h || 0) / 2}
                        rx={(item.w || 0) / 2}
                        ry={(item.h || 0) / 2}
                        fill={item.fill}
                        stroke={item.color}
                        strokeWidth={strokeWidth}
                        style={{ pointerEvents: 'all', cursor: 'move' }}
                        onPointerDown={onPointerDown}
                      />
                    )
                  }

                  return (
                    <g key={item.id} style={{ pointerEvents: 'all', cursor: 'move' }} onPointerDown={onPointerDown}>
                      <line x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} stroke={item.color} strokeWidth={strokeWidth} />
                      <polygon points={arrPts(item.x, item.y, item.x2!, item.y2!)} fill={item.color} />
                    </g>
                  )
                })}

                {penPath && penPath.pts.length > 1 && (
                  <path
                    d={penPath.pts.reduce((path, point, index) => index === 0 ? `M${point.x} ${point.y}` : `${path} L${point.x} ${point.y}`, '')}
                    stroke={penPath.color}
                    strokeWidth={penPath.sw}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {previewShape()}
              </svg>

              {items.filter((item) => item.type === 'sticky' || item.type === 'textbox' || item.type === 'image').map((item) => {
                if (item.type === 'image') {
                  return (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                        left: item.x,
                        top: item.y,
                        width: item.w,
                        height: item.h,
                        border: selId === item.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 10,
                        overflow: 'hidden',
                        cursor: 'move',
                        boxShadow: selId === item.id ? '0 0 0 2px var(--accent-glow)' : 'none',
                        background: 'var(--bg-elevated)',
                      }}
                      onPointerDown={(event) => startItemDrag(event, item)}
                    >
                      <img src={item.src} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                      {selId === item.id && (
                        <div style={resizeHandle} onPointerDown={(event) => startResize(event, item)} />
                      )}
                    </div>
                  )
                }

                const selected = selId === item.id
                const editing = editId === item.id
                const isSticky = item.type === 'sticky'

                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: item.x,
                      top: item.y,
                      width: item.w,
                      minHeight: item.h,
                      background: isSticky ? item.color : 'transparent',
                      border: isSticky ? 'none' : `1px dashed ${selected ? 'var(--accent)' : 'var(--text-faint)'}`,
                      borderRadius: isSticky ? 12 : 4,
                      padding: isSticky ? 14 : 6,
                      boxShadow: selected
                        ? (isSticky ? '0 0 0 2px var(--accent), 2px 6px 20px rgba(0,0,0,0.4)' : '0 0 0 2px var(--accent)')
                        : (isSticky ? '2px 5px 16px rgba(0,0,0,0.35)' : 'none'),
                      cursor: 'move',
                      userSelect: editing ? 'text' : 'none',
                      boxSizing: 'border-box',
                    }}
                    onPointerDown={(event) => startItemDrag(event, item)}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      setEditId(item.id)
                      setSelId(item.id)
                      textEditHistoryRef.current = null
                    }}
                  >
                    {isSticky && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, borderRadius: '12px 12px 0 0', background: 'rgba(0,0,0,0.12)' }} />
                    )}

                    {editing ? (
                      <textarea
                        autoFocus
                        value={item.content}
                        onChange={(event) => updateTextItem(item.id, event.target.value)}
                        onBlur={() => {
                          setEditId(null)
                          textEditHistoryRef.current = null
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        style={{
                          width: '100%',
                          minHeight: item.h - 28,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          resize: 'none',
                          color: isSticky ? '#1a1a2e' : 'var(--text-primary)',
                          fontSize: '0.92rem',
                          fontFamily: 'inherit',
                          cursor: 'text',
                          lineHeight: 1.6,
                        }}
                      />
                    ) : (
                      <div style={{
                        color: isSticky ? '#1a1a2e' : 'var(--text-primary)',
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                        minHeight: 36,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        pointerEvents: 'none',
                      }}>
                        {item.content || <span style={{ opacity: 0.35 }}>Double-click to edit</span>}
                      </div>
                    )}

                    {selected && <div style={resizeHandle} onPointerDown={(event) => startResize(event, item)} />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
    </div>
  )
}

const divider: CSSProperties = {
  width: 1,
  height: 22,
  background: 'var(--border)',
  margin: '0 2px',
  flexShrink: 0,
}

const toolButton: CSSProperties = {
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.12s',
  fontFamily: 'inherit',
}

const popover: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 'calc(100% + 8px)',
  transform: 'translateY(-50%)',
  zIndex: 20,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 10,
  display: 'flex',
  gap: 8,
  boxShadow: 'var(--shadow-lg)',
}

const ghostChip: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '8px 12px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.78rem',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
}

const strokeOptionButton: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '6px 8px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
}

const actionBtn: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '7px 9px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '0.74rem',
  fontFamily: 'inherit',
  textAlign: 'left',
}

const miniInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  color: 'var(--text-primary)',
  fontSize: '0.78rem',
  outline: 'none',
  fontFamily: 'inherit',
}

const miniPrimaryButton: CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 8,
  padding: '0 12px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 700,
  fontFamily: 'inherit',
}

const boardRow: CSSProperties = {
  borderRadius: 9,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 2,
}

const boardNameButton: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  textAlign: 'left',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  font: 'inherit',
}

const boardNameInput: CSSProperties = {
  width: '100%',
  minWidth: 0,
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 8px',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  outline: 'none',
  fontFamily: 'inherit',
}

const crumbButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.76rem',
  whiteSpace: 'nowrap',
}

const resizeHandle: CSSProperties = {
  position: 'absolute',
  bottom: -5,
  right: -5,
  width: 12,
  height: 12,
  background: 'var(--accent)',
  borderRadius: 3,
  cursor: 'se-resize',
  zIndex: 10,
}
