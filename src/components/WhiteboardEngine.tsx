import { useState, useEffect, useRef, useCallback } from 'react'
import type { WBItem, WBSticky, WBTextbox, WBShape, WBImage, Board, BoardIndex } from '../lib/types'
import { uid, WB_SIZE, STICKY_COLORS, PEN_COLORS, arrPts } from '../lib/helpers'
import * as storage from '../lib/storage'

/* ── Tool definitions ── */
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

interface Props {
  scope: 'whiteboards' | 'me'
  title?: string
}

export default function WhiteboardEngine({ scope, title }: Props) {
  /* ── Board management state ── */
  const [index, setIndex] = useState<BoardIndex>({ boards: [] })
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [items, setItems] = useState<WBItem[]>([])
  const [boardMeta, setBoardMeta] = useState<Board | null>(null)
  const [newBoardName, setNewBoardName] = useState('')
  const [historyList, setHistoryList] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)

  /* ── Canvas state ── */
  const viewRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 80, y: 80 })
  const [zoom, setZoom] = useState(1)
  const [tool, setTool] = useState('select')
  const [selId, setSelId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [drag, setDrag] = useState<any>(null)
  const [resize, setResize] = useState<any>(null)
  const [panning, setPanning] = useState<any>(null)
  const [creating, setCreating] = useState<any>(null)
  const [penPath, setPenPath] = useState<any>(null)
  const [inkColor, setInkColor] = useState('#a78bfa')
  const [inkW, setInkW] = useState(2)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Load index on mount ── */
  useEffect(() => {
    storage.loadBoardIndex(scope).then(idx => {
      setIndex(idx)
      if (idx.boards.length > 0) setActiveBoardId(idx.boards[0].id)
    })
  }, [scope])

  /* ── Load board when active changes ── */
  useEffect(() => {
    if (!activeBoardId) { setItems([]); setBoardMeta(null); return }
    storage.loadBoard(scope, activeBoardId).then(b => {
      if (b) { setItems(b.items); setBoardMeta(b) }
      else { setItems([]); setBoardMeta(null) }
    })
  }, [activeBoardId, scope])

  /* ── Debounced save ── */
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!activeBoardId || !boardMeta) return
      const updated: Board = { ...boardMeta, items, updatedAt: Date.now() }
      storage.saveBoard(scope, updated)
      setBoardMeta(updated)
    }, 800)
  }, [activeBoardId, boardMeta, items, scope])

  useEffect(() => {
    if (activeBoardId && boardMeta) scheduleSave()
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [items])

  /* ── Board CRUD ── */
  const createBoard = async (parentId?: string) => {
    const name = newBoardName.trim() || 'Untitled Board'
    const id = uid()
    const board: Board = { id, name, parentId, items: [], createdAt: Date.now(), updatedAt: Date.now() }
    const newIdx = { boards: [...index.boards, { id, name, parentId }] }
    await storage.saveBoard(scope, board)
    await storage.saveBoardIndex(scope, newIdx)
    setIndex(newIdx)
    setActiveBoardId(id)
    setNewBoardName('')
  }

  const deleteBoard = async (id: string) => {
    // also remove sub-boards
    const toRemove = new Set<string>()
    const collect = (pid: string) => {
      toRemove.add(pid)
      index.boards.filter(b => b.parentId === pid).forEach(b => collect(b.id))
    }
    collect(id)
    for (const rid of toRemove) {
      await storage.saveJSON(`${scope}/${rid}/board.json`, null).catch(() => {})
    }
    const newIdx = { boards: index.boards.filter(b => !toRemove.has(b.id)) }
    await storage.saveBoardIndex(scope, newIdx)
    setIndex(newIdx)
    if (activeBoardId && toRemove.has(activeBoardId)) {
      setActiveBoardId(newIdx.boards[0]?.id || null)
    }
  }

  const saveSnapshot = async () => {
    if (!boardMeta) return
    const updated: Board = { ...boardMeta, items, updatedAt: Date.now() }
    await storage.saveBoardSnapshot(scope, updated)
    const hist = await storage.loadBoardHistory(scope, boardMeta.id)
    setHistoryList(hist)
  }

  const loadSnapshot = async (snapshotId: string) => {
    if (!activeBoardId) return
    const snap = await storage.loadBoard(scope, activeBoardId) // placeholder, we need snapshot endpoint
    try {
      const res = await fetch(`/api/boards/${scope}/${activeBoardId}/history/${snapshotId}`)
      if (res.ok) {
        const board: Board = await res.json()
        setItems(board.items)
      }
    } catch { /* ignore */ }
  }

  /* ── Export ── */
  const exportSVG = () => {
    if (!viewRef.current) return
    const svg = viewRef.current.querySelector('svg:nth-of-type(2)')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${boardMeta?.name || 'board'}.svg`
    a.click()
  }

  /* ── Image upload ── */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeBoardId) return
    const path = await storage.uploadImage(scope, activeBoardId, file)
    const { x, y } = toCanvas(viewRef.current!.getBoundingClientRect().width / 2, viewRef.current!.getBoundingClientRect().height / 2)
    const item: WBImage = { id: uid(), type: 'image', x, y, w: 300, h: 200, src: path, name: file.name }
    setItems(p => [...p, item])
    setSelId(item.id)
    setTool('select')
    e.target.value = ''
  }

  /* ── Canvas helpers ── */
  const toCanvas = useCallback((cx: number, cy: number) => {
    const r = viewRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom }
  }, [pan, zoom])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const f = e.deltaY > 0 ? 0.88 : 1.13
    const nz = Math.max(0.15, Math.min(4, zoom * f))
    const r = viewRef.current!.getBoundingClientRect()
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    setPan(p => ({ x: cx - (cx - p.x) * (nz / zoom), y: cy - (cy - p.y) * (nz / zoom) }))
    setZoom(nz)
  }

  const onViewDown = (e: React.PointerEvent) => {
    if (e.target !== viewRef.current && !(e.target as HTMLElement).closest('[data-wb-bg]')) return
    const { x, y } = toCanvas(e.clientX, e.clientY)
    if (tool === 'select') { setSelId(null); setPanning({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }); return }
    if (tool === 'sticky') {
      const item: WBSticky = { id: uid(), type: 'sticky', x, y, w: 190, h: 155, content: '', color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)] }
      setItems(p => [...p, item]); setSelId(item.id); setEditId(item.id); setTool('select'); return
    }
    if (tool === 'textbox') {
      const item: WBTextbox = { id: uid(), type: 'textbox', x, y, w: 220, h: 55, content: 'Type here...', color: '#ffffff' }
      setItems(p => [...p, item]); setSelId(item.id); setTool('select'); return
    }
    if (tool === 'image') { imgInputRef.current?.click(); return }
    if (tool === 'pen') {
      setPenPath({ pts: [{ x, y }], color: inkColor, sw: inkW })
      viewRef.current!.setPointerCapture(e.pointerId); return
    }
    if (['rect', 'circle', 'arrow'].includes(tool)) {
      setCreating({ type: tool, sx: x, sy: y, ex: x, ey: y })
      viewRef.current!.setPointerCapture(e.pointerId); return
    }
  }

  const onViewMove = (e: React.PointerEvent) => {
    const { x, y } = toCanvas(e.clientX, e.clientY)
    if (panning) { setPan({ x: panning.px + (e.clientX - panning.sx), y: panning.py + (e.clientY - panning.sy) }); return }
    if (drag) {
      const dx = x - drag.sx, dy = y - drag.sy
      setItems(p => p.map(it => {
        if (it.id !== drag.id) return it
        if (it.type === 'shape' && (it as WBShape).shapeType === 'arrow') return { ...it, x: drag.ox + dx, y: drag.oy + dy, x2: drag.ox2 + dx, y2: drag.oy2 + dy }
        return { ...it, x: drag.ox + dx, y: drag.oy + dy } as WBItem
      })); return
    }
    if (resize) {
      setItems(p => p.map(it => it.id === resize.id ? { ...it, w: Math.max(90, resize.ow + (x - resize.sx)), h: Math.max(50, resize.oh + (y - resize.sy)) } as WBItem : it)); return
    }
    if (penPath) { setPenPath((p: any) => ({ ...p, pts: [...p.pts, { x, y }] })); return }
    if (creating) { setCreating((p: any) => ({ ...p, ex: x, ey: y })) }
  }

  const onViewUp = (e: React.PointerEvent) => {
    if (panning) { setPanning(null); return }
    if (drag) { setDrag(null); return }
    if (resize) { setResize(null); return }
    if (penPath && penPath.pts.length > 2) {
      const d = penPath.pts.reduce((a: string, p: any, i: number) => i === 0 ? `M${p.x} ${p.y}` : `${a} L${p.x} ${p.y}`, '')
      setItems(p => [...p, { id: uid(), type: 'path', d, color: penPath.color, sw: penPath.sw }])
    }
    setPenPath(null)
    if (creating) {
      const { type, sx, sy, ex, ey } = creating
      const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
      if (dist > 8) {
        let item: WBItem
        if (type === 'arrow') item = { id: uid(), type: 'shape', shapeType: 'arrow', x: sx, y: sy, x2: ex, y2: ey, color: inkColor }
        else item = { id: uid(), type: 'shape', shapeType: type, x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy), color: inkColor, fill: inkColor + '28' }
        setItems(p => [...p, item]); setSelId(item.id)
      }
      setCreating(null); setTool('select')
    }
  }

  const startItemDrag = (e: React.PointerEvent, item: any) => {
    e.stopPropagation()
    if (editId === item.id) return
    const c = toCanvas(e.clientX, e.clientY)
    setSelId(item.id)
    setDrag({ id: item.id, ox: item.x, oy: item.y, ox2: item.x2, oy2: item.y2, sx: c.x, sy: c.y })
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId && editId !== selId) {
        setItems(p => p.filter(i => i.id !== selId)); setSelId(null)
      }
      if (e.key === 'Escape') { setSelId(null); setEditId(null); setTool('select') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selId, editId])

  const previewShape = () => {
    if (!creating) return null
    const { type, sx, sy, ex, ey } = creating
    const x = Math.min(sx, ex), y = Math.min(sy, ey), w = Math.abs(ex - sx), h = Math.abs(ey - sy)
    const s = { stroke: inkColor, strokeWidth: 2, strokeDasharray: '6 3', fill: inkColor + '22' }
    if (type === 'rect') return <rect x={x} y={y} width={w} height={h} rx={4} {...s} />
    if (type === 'circle') return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...s} />
    if (type === 'arrow') return <><line x1={sx} y1={sy} x2={ex} y2={ey} stroke={inkColor} strokeWidth={2} strokeDasharray="6 3" /><polygon points={arrPts(sx, sy, ex, ey)} fill={inkColor} /></>
    return null
  }

  /* ── Board tree helpers ── */
  const rootBoards = index.boards.filter(b => !b.parentId)
  const subBoards = (parentId: string) => index.boards.filter(b => b.parentId === parentId)
  const activeBoard = index.boards.find(b => b.id === activeBoardId)
  const parentBoard = activeBoard?.parentId ? index.boards.find(b => b.id === activeBoard.parentId) : null

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Board list sidebar */}
      <div style={{
        width: 200, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: '#09090f', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 12px 8px' }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font-heading)', marginBottom: 10 }}>
            {title || 'Boards'}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={newBoardName} onChange={e => setNewBoardName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBoard()}
              placeholder="New board..."
              style={{
                flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: '0.75rem',
                outline: 'none', fontFamily: 'inherit', minWidth: 0,
              }} />
            <button onClick={() => createBoard()} style={{
              background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '4px 8px',
              color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
            }}>+</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
          {rootBoards.map(b => (
            <div key={b.id}>
              <div onClick={() => setActiveBoardId(b.id)} style={{
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem',
                background: activeBoardId === b.id ? 'var(--accent-surface)' : 'transparent',
                color: activeBoardId === b.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                fontWeight: activeBoardId === b.id ? 700 : 500, marginBottom: 1,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                {subBoards(b.id).length > 0 && (
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 4 }}>
                    {subBoards(b.id).length}
                  </span>
                )}
              </div>
              {/* Sub-boards */}
              {subBoards(b.id).map(sb => (
                <div key={sb.id} onClick={() => setActiveBoardId(sb.id)} style={{
                  padding: '5px 10px 5px 24px', borderRadius: 6, cursor: 'pointer', fontSize: '0.76rem',
                  background: activeBoardId === sb.id ? 'var(--accent-surface)' : 'transparent',
                  color: activeBoardId === sb.id ? 'var(--accent-light)' : 'var(--text-muted)',
                  fontWeight: activeBoardId === sb.id ? 600 : 400, marginBottom: 1,
                }}>
                  {sb.name}
                </div>
              ))}
            </div>
          ))}
          {rootBoards.length === 0 && (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.78rem', textAlign: 'center', marginTop: 20, padding: '0 8px' }}>
              No boards yet. Create one above.
            </div>
          )}
        </div>

        {/* Actions */}
        {activeBoardId && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => createBoard(activeBoardId)} style={actionBtn}>
              + Sub-board
            </button>
            <button onClick={saveSnapshot} style={actionBtn}>
              Save Snapshot
            </button>
            <button onClick={() => {
              storage.loadBoardHistory(scope, activeBoardId).then(h => { setHistoryList(h); setShowHistory(!showHistory) })
            }} style={actionBtn}>
              {showHistory ? 'Hide' : 'Show'} History
            </button>
            <button onClick={exportSVG} style={actionBtn}>
              Export SVG
            </button>
            <button onClick={() => deleteBoard(activeBoardId)} style={{ ...actionBtn, color: '#604060', borderColor: '#2a1a2a' }}>
              Delete Board
            </button>
          </div>
        )}

        {/* History panel */}
        {showHistory && historyList.length > 0 && (
          <div style={{ padding: '6px 10px 10px', borderTop: '1px solid var(--border)', maxHeight: 150, overflowY: 'auto' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Snapshots</div>
            {historyList.map(ts => (
              <div key={ts} onClick={() => loadSnapshot(ts)} style={{
                fontSize: '0.7rem', color: 'var(--text-secondary)', padding: '3px 6px',
                cursor: 'pointer', borderRadius: 4, marginBottom: 1,
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {new Date(parseInt(ts)).toLocaleString()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Canvas area */}
      {!activeBoardId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '0.9rem' }}>
          Select or create a board
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{
            height: 52, flexShrink: 0, background: '#09090f', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 3, padding: '0 14px', overflowX: 'auto',
          }}>
            {/* Breadcrumb */}
            {parentBoard && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8, flexShrink: 0 }}>
                <span onClick={() => setActiveBoardId(parentBoard.id)} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {parentBoard.name}
                </span>
                <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>›</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-light)', fontWeight: 600 }}>{activeBoard?.name}</span>
                <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
              </div>
            )}

            {WB_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => { setTool(t.id); if (t.id === 'image') imgInputRef.current?.click() }}
                style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 9, border: 'none',
                  background: tool === t.id ? 'var(--accent-surface)' : 'transparent',
                  color: tool === t.id ? 'var(--accent-light)' : 'var(--text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
              </button>
            ))}

            <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 6px', flexShrink: 0 }} />
            {PEN_COLORS.map(c => (
              <button key={c} onClick={() => setInkColor(c)} style={{
                width: 18, height: 18, borderRadius: '50%', background: c,
                border: `2px solid ${inkColor === c ? '#fff' : 'transparent'}`,
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }} />
            ))}
            <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 6px', flexShrink: 0 }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', flexShrink: 0 }}>Stroke</span>
            {[1, 2, 4, 6].map(w => (
              <button key={w} onClick={() => setInkW(w)} style={{
                width: 22, height: 22, borderRadius: '50%', background: 'transparent',
                border: `${w}px solid ${inkW === w ? 'var(--accent-light)' : 'var(--text-faint)'}`,
                cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'all 0.1s',
              }} />
            ))}
            <div style={{ flex: 1 }} />
            {selId && (
              <button onClick={() => { setItems(p => p.filter(i => i.id !== selId)); setSelId(null) }} style={{
                background: 'none', border: '1px solid #2a1a2a', borderRadius: 8, padding: '4px 10px',
                color: '#604060', cursor: 'pointer', fontSize: '0.73rem', fontFamily: 'inherit', flexShrink: 0,
              }}>Delete</button>
            )}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginLeft: 6, flexShrink: 0 }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => { setPan({ x: 80, y: 80 }); setZoom(1) }} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7,
              padding: '4px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem',
              fontFamily: 'inherit', marginLeft: 6, flexShrink: 0,
            }}>Reset</button>
          </div>

          {/* Canvas */}
          <div ref={viewRef} data-wb-bg="1"
            onPointerDown={onViewDown} onPointerMove={onViewMove} onPointerUp={onViewUp} onWheel={handleWheel}
            style={{
              flex: 1, overflow: 'hidden', position: 'relative',
              cursor: tool === 'select' ? 'default' : 'crosshair',
              touchAction: 'none', background: '#0a0a12',
            }}>
            {/* Dot grid */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <pattern id={`dots-${scope}`} x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)} width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
                  <circle cx={1} cy={1} r={0.9} fill="#1c1c2e" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#dots-${scope})`} />
            </svg>

            {/* Items layer */}
            <div style={{ position: 'absolute', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: WB_SIZE.w, height: WB_SIZE.h }}>
              <svg style={{ position: 'absolute', top: 0, left: 0, width: WB_SIZE.w, height: WB_SIZE.h, pointerEvents: 'none', overflow: 'visible' }}>
                {/* Paths */}
                {items.filter(i => i.type === 'path').map(it => {
                  const p = it as any
                  return <path key={it.id} d={p.d} stroke={p.color} strokeWidth={p.sw || 2} fill="none" strokeLinecap="round" strokeLinejoin="round"
                    style={{ filter: selId === it.id ? `drop-shadow(0 0 4px ${p.color})` : 'none' }} />
                })}
                {/* Shapes */}
                {items.filter(i => i.type === 'shape').map(it => {
                  const s = it as WBShape
                  const sel = selId === it.id, sw = sel ? 2.5 : 1.5
                  const dn = (e: React.PointerEvent) => { e.stopPropagation(); const c = toCanvas(e.clientX, e.clientY); setSelId(it.id); setDrag({ id: it.id, ox: s.x, oy: s.y, ox2: s.x2, oy2: s.y2, sx: c.x, sy: c.y }) }
                  if (s.shapeType === 'rect') return <rect key={it.id} x={s.x} y={s.y} width={s.w} height={s.h} rx={5} fill={s.fill} stroke={s.color} strokeWidth={sw} style={{ pointerEvents: 'all', cursor: 'move', filter: sel ? `drop-shadow(0 0 6px ${s.color}55)` : 'none' }} onPointerDown={dn} />
                  if (s.shapeType === 'circle') return <ellipse key={it.id} cx={s.x + (s.w || 0) / 2} cy={s.y + (s.h || 0) / 2} rx={(s.w || 0) / 2} ry={(s.h || 0) / 2} fill={s.fill} stroke={s.color} strokeWidth={sw} style={{ pointerEvents: 'all', cursor: 'move' }} onPointerDown={dn} />
                  if (s.shapeType === 'arrow') return <g key={it.id} style={{ pointerEvents: 'all', cursor: 'move' }} onPointerDown={dn}><line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={sw} /><polygon points={arrPts(s.x, s.y, s.x2!, s.y2!)} fill={s.color} /></g>
                  return null
                })}
                {/* Pen preview */}
                {penPath && penPath.pts.length > 1 && (
                  <path d={penPath.pts.reduce((a: string, p: any, i: number) => i === 0 ? `M${p.x} ${p.y}` : `${a} L${p.x} ${p.y}`, '')}
                    stroke={penPath.color} strokeWidth={penPath.sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {previewShape()}
              </svg>

              {/* Sticky notes, textboxes, images */}
              {items.filter(i => ['sticky', 'textbox', 'image'].includes(i.type)).map(it => {
                if (it.type === 'image') {
                  const img = it as WBImage
                  return (
                    <div key={it.id} style={{
                      position: 'absolute', left: img.x, top: img.y, width: img.w, height: img.h,
                      border: selId === it.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 8, overflow: 'hidden', cursor: 'move', boxShadow: selId === it.id ? '0 0 0 2px var(--accent)' : 'none',
                    }} onPointerDown={e => startItemDrag(e, it)}>
                      <img src={img.src} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                      {selId === it.id && (
                        <div style={{ position: 'absolute', bottom: -5, right: -5, width: 12, height: 12, background: 'var(--accent)', borderRadius: 3, cursor: 'se-resize', zIndex: 10 }}
                          onPointerDown={e => { e.stopPropagation(); const c = toCanvas(e.clientX, e.clientY); setResize({ id: it.id, ow: img.w, oh: img.h, sx: c.x, sy: c.y }) }} />
                      )}
                    </div>
                  )
                }
                const item = it as WBSticky | WBTextbox
                return (
                  <div key={it.id} style={{
                    position: 'absolute', left: item.x, top: item.y, width: item.w, minHeight: item.h,
                    background: it.type === 'sticky' ? item.color : 'transparent',
                    border: it.type === 'textbox' ? `1px dashed ${selId === it.id ? 'var(--accent)' : 'var(--text-faint)'}` : 'none',
                    borderRadius: it.type === 'sticky' ? 10 : 4,
                    padding: it.type === 'sticky' ? 14 : 6,
                    boxShadow: selId === it.id
                      ? (it.type === 'sticky' ? '0 0 0 2px var(--accent), 2px 6px 20px rgba(0,0,0,0.6)' : '0 0 0 2px var(--accent)')
                      : (it.type === 'sticky' ? '2px 5px 16px rgba(0,0,0,0.5)' : 'none'),
                    cursor: 'move', userSelect: editId === it.id ? 'text' : 'none',
                    boxSizing: 'border-box', transition: 'box-shadow 0.15s',
                  }}
                    onPointerDown={e => startItemDrag(e, item)}
                    onDoubleClick={e => { e.stopPropagation(); setEditId(it.id); setSelId(it.id) }}
                  >
                    {it.type === 'sticky' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, borderRadius: '10px 10px 0 0', background: 'rgba(0,0,0,0.12)' }} />}
                    {editId === it.id ? (
                      <textarea autoFocus value={item.content}
                        onChange={e => setItems(p => p.map(i => i.id === it.id ? { ...i, content: e.target.value } as WBItem : i))}
                        onBlur={() => setEditId(null)} onPointerDown={e => e.stopPropagation()}
                        style={{
                          width: '100%', minHeight: item.h - 28, background: 'transparent',
                          border: 'none', outline: 'none', resize: 'none',
                          color: it.type === 'sticky' ? '#1a1a2e' : 'var(--text-primary)',
                          fontSize: '0.9rem', fontFamily: 'inherit', cursor: 'text', lineHeight: 1.6,
                        }} />
                    ) : (
                      <div style={{
                        color: it.type === 'sticky' ? '#1a1a2e' : 'var(--text-primary)',
                        fontSize: '0.9rem', lineHeight: 1.6, minHeight: 36,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', pointerEvents: 'none',
                      }}>{item.content || <span style={{ opacity: 0.35 }}>Double-click to edit</span>}</div>
                    )}
                    {selId === it.id && (
                      <div style={{
                        position: 'absolute', bottom: -5, right: -5, width: 12, height: 12,
                        background: 'var(--accent)', borderRadius: 3, cursor: 'se-resize', zIndex: 10,
                      }} onPointerDown={e => {
                        e.stopPropagation(); const c = toCanvas(e.clientX, e.clientY)
                        setResize({ id: it.id, ow: item.w, oh: item.h, sx: c.x, sy: c.y })
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer hint */}
          <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-ghost)', padding: '5px 0', background: '#09090f', flexShrink: 0 }}>
            Scroll to zoom · Drag canvas to pan · Double-click sticky/textbox to edit · Delete key removes selected
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  padding: '4px 8px', color: 'var(--text-muted)', cursor: 'pointer',
  fontSize: '0.7rem', fontFamily: 'inherit', textAlign: 'left',
}
