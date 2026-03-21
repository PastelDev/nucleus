import { useState, useEffect, useRef } from 'react'
import type { Note, CalendarEvent, Task, PomodoroSettings, Section, AIConfig } from '../lib/types'
import { uid, today } from '../lib/helpers'
import * as store from '../lib/storage'
import Markdown from './Markdown'

/* ── Tool definitions ── */
const AI_TOOLS = [
  { type: 'function', function: { name: 'navigate_to', description: 'Switch to a different section of the app', parameters: { type: 'object', properties: { section: { type: 'string', enum: ['today', 'notes', 'whiteboard', 'me', 'calendar', 'pomodoro', 'ai-settings'] } }, required: ['section'] } } },
  { type: 'function', function: { name: 'create_calendar_event', description: 'Create a new event on the calendar', parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string' }, color: { type: 'string' } }, required: ['title', 'date'] } } },
  { type: 'function', function: { name: 'set_pomodoro', description: 'Configure Pomodoro timer durations', parameters: { type: 'object', properties: { work_minutes: { type: 'number' }, short_break_minutes: { type: 'number' }, long_break_minutes: { type: 'number' }, navigate: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'create_note', description: 'Create a new note with markdown content', parameters: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'content'] } } },
  { type: 'function', function: { name: 'edit_note', description: 'Edit an existing note by its ID', parameters: { type: 'object', properties: { note_id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['note_id'] } } },
  { type: 'function', function: { name: 'create_task', description: 'Add a task to Today view', parameters: { type: 'object', properties: { text: { type: 'string' }, date: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'get_current_view_content', description: 'Read all content visible in the current section', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'update_memories', description: 'Update agent memories with important context', parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } },
  { type: 'function', function: { name: 'generate_image', description: 'Generate image(s) with OpenAI gpt-image-1.5. User will preview before placement. Requires OpenAI key.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'] }, quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, n: { type: 'integer', minimum: 1, maximum: 4 }, scope: { type: 'string', enum: ['whiteboards', 'me'] }, board_id: { type: 'string' } }, required: ['prompt'] } } },
  { type: 'function', function: { name: 'generate_images_batch', description: 'Generate multiple images from different prompts. User will preview before placement.', parameters: { type: 'object', properties: { prompts: { type: 'array', items: { type: 'string' } }, size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'] }, quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, scope: { type: 'string', enum: ['whiteboards', 'me'] }, board_id: { type: 'string' } }, required: ['prompts'] } } },
]

/* ── Context builder ── */
const genCtx = (sec: Section, notes: Note[], events: CalendarEvent[], tasks: Task[], pom: PomodoroSettings) => {
  const td = today()
  let c = `# Nucleus — Live Context\nSection: **${sec}** | Today: ${td}\n\n`
  const tt = tasks.filter(t => t.date === td)
  c += `## Today Tasks (${tt.length})\n${tt.map(t => `- [${t.done ? 'x' : ' '}] ${t.text} (id:${t.id})`).join('\n') || '_none_'}\n\n`
  c += `## Notes (${notes.length})\n${notes.slice(0, 15).map(n => `- "${n.title}" id:${n.id} tags:[${(n.tags || []).join(',')}]`).join('\n') || '_none_'}\n\n`
  const ue = events.filter(e => e.date >= td).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10)
  c += `## Upcoming Events\n${ue.map(e => `- ${e.date}${e.time ? ' ' + e.time : ''}: ${e.title} (id:${e.id})`).join('\n') || '_none_'}\n\n`
  c += `## Pomodoro\nWork: ${pom.work}min | Short: ${pom.short}min | Long: ${pom.long}min\n`
  return c
}

/* ── Message types ── */
interface Msg {
  role: 'user' | 'assistant' | 'tool_call' | 'image_preview'
  content: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  imagePaths?: string[]
  imageArgs?: Record<string, unknown>
  imageStatus?: 'inserted' | 'discarded' | 'iterating'
  refImgs?: string[]  // base64 data URLs for user messages with images
}

interface PendingApproval {
  toolName: string
  toolArgs: Record<string, unknown>
  resolve: (approved: boolean) => void
}

interface PendingImg {
  paths: string[]
  args: Record<string, unknown>
  resolve: (action: 'insert' | 'discard' | 'iterate', iterPrompt?: string) => void
}

interface Props {
  notes: Note[]; events: CalendarEvent[]; tasks: Task[]
  section: Section; pomSettings: PomodoroSettings
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setSection: (s: Section) => void
  setPomSettings: React.Dispatch<React.SetStateAction<PomodoroSettings>>
  agentMd: string; memoriesMd: string
  setMemoriesMd: (v: string) => void
  aiConfig: AIConfig
  onClose: () => void
}

export default function AIPanel({
  notes, events, tasks, section, pomSettings,
  setNotes, setEvents, setTasks, setSection, setPomSettings,
  agentMd, memoriesMd, setMemoriesMd,
  aiConfig, onClose,
}: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [apiMsgs, setApiMsgs] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [refImages, setRefImages] = useState<string[]>([])
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)
  const [pendingImg, setPendingImg] = useState<PendingImg | null>(null)
  const [iterInput, setIterInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgMsgIdxRef = useRef<number>(-1)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pendingApproval, pendingImg])

  const ctxText = genCtx(section, notes, events, tasks, pomSettings)

  /* ── Permission check ── */
  const needsApproval = (name: string) => {
    if (name === 'generate_image' || name === 'generate_images_batch') return false // image has own preview
    if (aiConfig.permMode === 'allow') return false
    if (aiConfig.permMode === 'ask') return true
    return !aiConfig.permCustom?.[name]
  }

  const requestApproval = (name: string, args: Record<string, unknown>): Promise<boolean> =>
    new Promise(resolve => setPendingApproval({ toolName: name, toolArgs: args, resolve }))

  /* ── Image generation + preview ── */
  const generateAndPreview = async (args: any, isBatch: boolean): Promise<any> => {
    if (!aiConfig.openaiKey) return { error: 'No OpenAI API key — add it in AI Settings' }
    const payload: any = {
      openai_key: aiConfig.openaiKey,
      size: args.size || '1024x1024',
      quality: args.quality || 'auto',
    }
    if (isBatch) payload.prompts = args.prompts
    else { payload.prompt = args.prompt; payload.n = args.n || 1 }
    if (args.scope && args.board_id) { payload.scope = args.scope; payload.board_id = args.board_id }

    const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.error) return { error: data.error }

    // Add preview message and wait for user action
    const imgIdx = msgs.length + (pendingApproval ? 1 : 0)
    imgMsgIdxRef.current = imgIdx
    setMsgs(p => [...p, { role: 'image_preview', content: '', imagePaths: data.paths, imageArgs: args }])

    const action = await new Promise<{ type: 'insert' | 'discard' | 'iterate'; iterPrompt?: string }>(
      resolve => setPendingImg({ paths: data.paths, args, resolve: (type, iterPrompt) => resolve({ type, iterPrompt }) })
    )
    setPendingImg(null)
    setIterInput('')

    if (action.type === 'discard') {
      setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'discarded' } : m))
      return { ok: true, placed: false, message: 'Images discarded by user' }
    }

    if (action.type === 'insert' && args.scope && args.board_id) {
      setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'inserted' } : m))
      const board = await store.loadBoard(args.scope as 'whiteboards' | 'me', args.board_id)
      if (board) {
        const newImgs = (data.paths as string[]).map((src, i) => ({
          id: uid(), type: 'image' as const, x: 200 + i * 540, y: 200, w: 512, h: 512, src, name: `AI Image ${i + 1}`,
        }))
        await store.saveBoard(args.scope as 'whiteboards' | 'me', { ...board, items: [...board.items, ...newImgs], updatedAt: Date.now() });
        (window as any).__nucleusSelectBoard = { scope: args.scope, boardId: args.board_id }
        setSection(args.scope === 'me' ? 'me' : 'whiteboard')
        window.dispatchEvent(new CustomEvent('nucleus:select-board', { detail: { scope: args.scope, boardId: args.board_id } }))
      }
      return { ok: true, placed: true, paths: data.paths, count: data.paths.length }
    }

    if (action.type === 'insert') {
      setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'inserted' } : m))
      return { ok: true, placed: false, paths: data.paths, note: 'No board specified — images generated but not placed' }
    }

    // iterate
    setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'iterating' } : m))
    return { ok: true, placed: false, iterate_with: action.iterPrompt, message: 'User wants to refine — use iterate_with as feedback to regenerate' }
  }

  /* ── Tool executor ── */
  const exec = async (name: string, args: any): Promise<any> => {
    if (needsApproval(name)) {
      const approved = await requestApproval(name, args)
      setPendingApproval(null)
      if (!approved) return { error: 'Denied by user' }
    }

    switch (name) {
      case 'navigate_to': setSection(args.section); return { ok: true }
      case 'create_calendar_event': {
        const ev: CalendarEvent = { id: uid(), title: args.title, date: args.date, time: args.time || '', color: args.color || '#7c3aed' }
        setEvents(p => [...p, ev]); return { ok: true, event_id: ev.id }
      }
      case 'set_pomodoro': {
        const u = { ...pomSettings }
        if (args.work_minutes) u.work = args.work_minutes
        if (args.short_break_minutes) u.short = args.short_break_minutes
        if (args.long_break_minutes) u.long = args.long_break_minutes
        setPomSettings(u)
        if (args.navigate) setSection('pomodoro')
        return { ok: true, settings: u }
      }
      case 'create_note': {
        const n: Note = { id: uid(), title: args.title, content: args.content || '', tags: args.tags || [], createdAt: Date.now() }
        setNotes(p => [n, ...p]); return { ok: true, note_id: n.id }
      }
      case 'edit_note': {
        let found = false
        setNotes(p => p.map(n => {
          if (n.id !== args.note_id) return n
          found = true
          return { ...n, ...(args.title ? { title: args.title } : {}), ...(args.content !== undefined ? { content: args.content } : {}), ...(args.tags ? { tags: args.tags } : {}) }
        }))
        return found ? { ok: true } : { ok: false, error: 'Note not found' }
      }
      case 'create_task': {
        const t: Task = { id: uid(), text: args.text, done: false, date: args.date || today() }
        setTasks(p => [t, ...p]); return { ok: true, task_id: t.id }
      }
      case 'get_current_view_content': return { section, content: ctxText }
      case 'update_memories': setMemoriesMd(args.content); return { ok: true }
      case 'generate_image': return generateAndPreview(args, false)
      case 'generate_images_batch': return generateAndPreview(args, true)
      default: return { error: `Unknown tool: ${name}` }
    }
  }

  /* ── Send message ── */
  const send = async () => {
    if (!input.trim() || loading || !aiConfig.apiKey) return
    const userText = input.trim()
    const attachments = [...refImages]
    setInput(''); setRefImages([]); setLoading(true)

    // Build user message for display
    setMsgs(p => [...p, { role: 'user', content: userText, refImgs: attachments.length ? attachments : undefined }])

    // Build API message (with images if any)
    const userContent: any = attachments.length
      ? [{ type: 'text', text: userText }, ...attachments.map(b64 => ({ type: 'image_url', image_url: { url: b64 } }))]
      : userText
    const sys = `${agentMd}\n\n## Current App Context\n${ctxText}\n\n## Your Memories\n${memoriesMd}`
    let ms = [...apiMsgs, { role: 'user', content: userContent }]

    try {
      for (let iter = 0; iter < 8; iter++) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}`, 'HTTP-Referer': 'https://nucleus.app' },
          body: JSON.stringify({ model: aiConfig.model, messages: [{ role: 'system', content: sys }, ...ms], tools: AI_TOOLS, tool_choice: 'auto' }),
        })
        const data = await res.json()
        if (data.error) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${data.error.message}` }]); break }
        const msg = data.choices[0].message
        ms = [...ms, msg]
        if (!msg.tool_calls?.length) { setMsgs(p => [...p, { role: 'assistant', content: msg.content || 'Done.' }]); break }
        if (msg.content) setMsgs(p => [...p, { role: 'assistant', content: msg.content }])

        const results: any[] = []
        for (const tc of msg.tool_calls) {
          let a: any; try { a = JSON.parse(tc.function.arguments) } catch { a = {} }
          setMsgs(p => [...p, { role: 'tool_call', content: '', toolName: tc.function.name, toolArgs: a }])
          const r = await exec(tc.function.name, a)
          results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r) })
        }
        ms = [...ms, ...results]
      }
      setApiMsgs(ms)
    } catch (e: any) { setMsgs(p => [...p, { role: 'assistant', content: `Connection error: ${e.message}` }]) }
    setLoading(false)
  }

  /* ── Image upload handler ── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setRefImages(p => [...p, ev.target?.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const hasKey = !!aiConfig.apiKey

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: '#09090f' }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>AI Chat</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: 1 }}>
            {hasKey ? aiConfig.model : <span style={{ color: '#7c3a3a' }}>No API key — configure in AI Settings</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => setMsgs([])} title="Clear chat" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 6px' }}>Clear</button>
          <button onClick={() => setSection('ai-settings')} title="AI Settings" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, fontFamily: 'inherit' }}>⚙ Settings</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 4px' }}>×</button>
        </div>
      </div>

      {/* Permission mode indicator */}
      <div style={{ padding: '6px 14px', background: '#0a0a14', borderBottom: '1px solid #0e0e1c', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: aiConfig.permMode === 'allow' ? 'var(--green)' : aiConfig.permMode === 'ask' ? '#f59e0b' : 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.63rem', color: 'var(--text-faint)' }}>
          {aiConfig.permMode === 'allow' ? 'Auto-execute all' : aiConfig.permMode === 'ask' ? 'Ask for each tool' : 'Custom permissions'}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.82rem', marginTop: 44, lineHeight: 1.9, padding: '0 8px' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: 12, color: '#1e1a35' }}>✦</div>
            Ask me anything — I can control the app, create content, generate images, and more.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 9, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'tool_call' ? (
              <div style={{ background: '#0e0e1c', border: '1px solid #1a1535', borderRadius: 8, padding: '8px 11px', fontSize: '0.72rem', maxWidth: '95%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: m.toolArgs && Object.keys(m.toolArgs).length ? 5 : 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--accent-light)', fontFamily: 'monospace', fontWeight: 700 }}>{m.toolName}()</span>
                </div>
                {m.toolArgs && Object.entries(m.toolArgs).slice(0, 4).map(([k, v]) => (
                  <div key={k} style={{ color: 'var(--text-faint)', paddingLeft: 12, lineHeight: 1.6 }}>
                    <span style={{ color: '#504870' }}>{k}:</span> {String(v).slice(0, 50)}
                  </div>
                ))}
              </div>
            ) : m.role === 'image_preview' ? (
              <div style={{ background: '#0c0c1e', border: '1px solid #1e1540', borderRadius: 10, padding: 10, maxWidth: '97%', width: '97%' }}>
                <div style={{ fontSize: '0.68rem', color: '#7060a0', marginBottom: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {m.imageStatus === 'inserted' ? '✓ Inserted to board' : m.imageStatus === 'discarded' ? '✕ Discarded' : m.imageStatus === 'iterating' ? '↻ Iterating...' : 'Generated Images'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                  {(m.imagePaths || []).map((p, j) => (
                    <img key={j} src={p} alt={`Generated ${j + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, display: 'block', border: '1px solid #1e1540' }} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                maxWidth: '93%',
                background: m.role === 'user' ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '9px 12px',
                color: m.role === 'user' ? '#d4c4ff' : 'var(--text-secondary)',
                fontSize: '0.83rem', lineHeight: 1.65,
                border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
              }}>
                {m.refImgs?.map((src, j) => <img key={j} src={src} style={{ width: '100%', borderRadius: 6, marginBottom: 6, display: 'block' }} />)}
                {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 4, padding: '6px 0' }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: `nuc-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Approval card */}
      {pendingApproval && (
        <div style={{ margin: '0 10px 8px', background: '#12102a', border: '1px solid #2a1e50', borderRadius: 10, padding: '12px 14px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', color: '#a09070', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>PERMISSION REQUEST</div>
          <div style={{ fontFamily: 'monospace', color: 'var(--accent-light)', fontSize: '0.8rem', marginBottom: 6 }}>{pendingApproval.toolName}()</div>
          {Object.entries(pendingApproval.toolArgs).slice(0, 3).map(([k, v]) => (
            <div key={k} style={{ fontSize: '0.7rem', color: 'var(--text-faint)', paddingLeft: 8, lineHeight: 1.7 }}>
              {k}: <span style={{ color: 'var(--text-muted)' }}>{String(v).slice(0, 60)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button onClick={() => pendingApproval.resolve(true)} style={{ flex: 1, padding: '7px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>Allow</button>
            <button onClick={() => pendingApproval.resolve(false)} style={{ flex: 1, padding: '7px', background: 'none', border: '1px solid #2a2040', borderRadius: 7, color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>Deny</button>
          </div>
        </div>
      )}

      {/* Image preview card */}
      {pendingImg && (
        <div style={{ margin: '0 10px 8px', background: '#0c0c1e', border: '1px solid #1e1540', borderRadius: 10, padding: '12px 14px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', color: '#7060a0', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>REVIEW GENERATED IMAGES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6, marginBottom: 10 }}>
            {pendingImg.paths.map((p, i) => (
              <img key={i} src={p} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '1px solid #1e1540' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => pendingImg.resolve('insert')} style={{ flex: 1, padding: '7px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {pendingImg.args.scope ? 'Insert to Board' : 'Accept'}
            </button>
            <button onClick={() => pendingImg.resolve('discard')} style={{ padding: '7px 12px', background: 'none', border: '1px solid #2a2040', borderRadius: 7, color: 'var(--text-faint)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <input
              value={iterInput} onChange={e => setIterInput(e.target.value)}
              placeholder="Feedback to iterate..."
              onKeyDown={e => { if (e.key === 'Enter' && iterInput.trim()) pendingImg.resolve('iterate', iterInput.trim()) }}
              style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', color: 'var(--text-secondary)', fontSize: '0.73rem', outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              onClick={() => { if (iterInput.trim()) pendingImg.resolve('iterate', iterInput.trim()) }}
              disabled={!iterInput.trim()}
              style={{ padding: '6px 10px', background: '#1e1540', border: 'none', borderRadius: 6, color: '#7060a0', fontSize: '0.73rem', cursor: 'pointer', fontFamily: 'inherit', opacity: iterInput.trim() ? 1 : 0.4 }}
            >↻</button>
          </div>
        </div>
      )}

      {/* Reference image thumbnails */}
      {refImages.length > 0 && (
        <div style={{ padding: '6px 12px 0', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          {refImages.map((src, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={src} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              <button onClick={() => setRefImages(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, background: '#1a0d20', border: 'none', borderRadius: '50%', width: 14, height: 14, color: '#a0a0c0', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} title="Attach image reference" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 9px', color: 'var(--text-faint)', cursor: 'pointer', flexShrink: 0, lineHeight: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
        </button>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={hasKey ? 'Ask or command...' : 'Add API key in AI Settings'}
          disabled={!hasKey}
          style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '0.84rem', outline: 'none', fontFamily: 'inherit', opacity: hasKey ? 1 : 0.5 }}
        />
        <button onClick={send} disabled={loading || !input.trim() || !hasKey} style={{
          background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '9px 12px',
          color: '#fff', cursor: 'pointer', opacity: loading || !input.trim() || !hasKey ? 0.35 : 1,
          flexShrink: 0, transition: 'opacity 0.15s', lineHeight: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
    </div>
  )
}
