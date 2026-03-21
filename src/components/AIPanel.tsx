import { useState, useEffect, useRef } from 'react'
import type { Note, CalendarEvent, Task, WBItem, PomodoroSettings, Section, AIConfig } from '../lib/types'
import { uid, today, STICKY_COLORS } from '../lib/helpers'
import * as store from '../lib/storage'
import Markdown from './Markdown'

/* ── AI tool definitions ── */
const AI_TOOLS = [
  { type: 'function', function: { name: 'navigate_to', description: 'Switch to a different section of the app', parameters: { type: 'object', properties: { section: { type: 'string', enum: ['today', 'notes', 'whiteboard', 'me', 'calendar', 'pomodoro'] } }, required: ['section'] } } },
  { type: 'function', function: { name: 'create_calendar_event', description: 'Create a new event on the calendar', parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string' }, color: { type: 'string' } }, required: ['title', 'date'] } } },
  { type: 'function', function: { name: 'set_pomodoro', description: 'Configure Pomodoro timer durations and optionally navigate to Focus', parameters: { type: 'object', properties: { work_minutes: { type: 'number' }, short_break_minutes: { type: 'number' }, long_break_minutes: { type: 'number' }, navigate: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'create_note', description: 'Create a new note with markdown content', parameters: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'content'] } } },
  { type: 'function', function: { name: 'edit_note', description: 'Edit an existing note by its ID', parameters: { type: 'object', properties: { note_id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['note_id'] } } },
  { type: 'function', function: { name: 'create_task', description: 'Add a task to Today view', parameters: { type: 'object', properties: { text: { type: 'string' }, date: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'get_current_view_content', description: 'Read all content and data visible in the current section', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'update_memories', description: 'Update memories to persist important information about the user', parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } },
  { type: 'function', function: { name: 'generate_image', description: 'Generate image(s) with OpenAI gpt-image-1.5 and place them on a whiteboard or Me board. Requires OpenAI key. Use for concept art, diagrams, visuals, covers, and creative assets.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'Detailed image description' }, size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'], description: 'square | landscape | portrait' }, quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, n: { type: 'integer', description: 'Number of images 1-4', minimum: 1, maximum: 4 }, scope: { type: 'string', enum: ['whiteboards', 'me'], description: 'Board section to place image in' }, board_id: { type: 'string', description: 'Board ID to place image on' } }, required: ['prompt'] } } },
  { type: 'function', function: { name: 'generate_images_batch', description: 'Generate multiple images from different prompts and place them on a board. Each prompt produces one image.', parameters: { type: 'object', properties: { prompts: { type: 'array', items: { type: 'string' }, description: 'List of image prompts, one per image' }, size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'] }, quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, scope: { type: 'string', enum: ['whiteboards', 'me'] }, board_id: { type: 'string' } }, required: ['prompts'] } } },
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
  c += `## Pomodoro Config\nWork: ${pom.work}min | Short: ${pom.short}min | Long: ${pom.long}min\n`
  return c
}

interface Props {
  notes: Note[]
  events: CalendarEvent[]
  tasks: Task[]
  section: Section
  pomSettings: PomodoroSettings
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setSection: (s: Section) => void
  setPomSettings: React.Dispatch<React.SetStateAction<PomodoroSettings>>
  agentMd: string
  setAgentMd: (v: string) => void
  memoriesMd: string
  setMemoriesMd: (v: string) => void
  aiConfig: AIConfig
  setAiConfig: (v: AIConfig) => void
  onClose: () => void
}

interface Msg {
  role: 'user' | 'assistant' | 'tool_call'
  content: string
}

export default function AIPanel({
  notes, events, tasks, section, pomSettings,
  setNotes, setEvents, setTasks, setSection, setPomSettings,
  agentMd, setAgentMd, memoriesMd, setMemoriesMd,
  aiConfig, setAiConfig, onClose,
}: Props) {
  const [tab, setTab] = useState<'chat' | 'context' | 'agent'>('chat')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [apiMsgs, setApiMsgs] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ctxText, setCtxText] = useState('')
  const [ctxLocked, setCtxLocked] = useState(false)
  const [agEdit, setAgEdit] = useState(false)
  const [agBuf, setAgBuf] = useState(agentMd)
  const [memEdit, setMemEdit] = useState(false)
  const [memBuf, setMemBuf] = useState(memoriesMd)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => {
    if (!ctxLocked) setCtxText(genCtx(section, notes, events, tasks, pomSettings))
  }, [section, notes, events, tasks, pomSettings, ctxLocked])

  /* ── Tool execution ── */
  const exec = async (name: string, args: any) => {
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
      case 'update_memories': setMemoriesMd(args.content); setMemBuf(args.content); return { ok: true }
      case 'generate_image':
      case 'generate_images_batch': {
        if (!aiConfig.openaiKey) return { error: 'OpenAI API key not set — add it in the config bar below the model ID' }
        const payload: any = {
          openai_key: aiConfig.openaiKey,
          size: args.size || '1024x1024',
          quality: args.quality || 'auto',
        }
        if (name === 'generate_images_batch') payload.prompts = args.prompts
        else { payload.prompt = args.prompt; payload.n = args.n || 1 }
        if (args.scope && args.board_id) { payload.scope = args.scope; payload.board_id = args.board_id }
        const genRes = await fetch('/api/generate-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const genData = await genRes.json()
        if (genData.error) return { error: genData.error }
        if (args.scope && args.board_id && genData.paths?.length) {
          const board = await store.loadBoard(args.scope as 'whiteboards' | 'me', args.board_id)
          if (board) {
            const newImgs = (genData.paths as string[]).map((src, i) => ({
              id: uid(), type: 'image' as const,
              x: 200 + i * 540, y: 200, w: 512, h: 512, src, name: `AI Image ${i + 1}`,
            }))
            await store.saveBoard(args.scope as 'whiteboards' | 'me', { ...board, items: [...board.items, ...newImgs], updatedAt: Date.now() })
            ;(window as any).__nucleusSelectBoard = { scope: args.scope, boardId: args.board_id }
            setSection(args.scope === 'me' ? 'me' : 'whiteboard')
            window.dispatchEvent(new CustomEvent('nucleus:select-board', { detail: { scope: args.scope, boardId: args.board_id } }))
          }
        }
        return { ok: true, paths: genData.paths, count: genData.paths.length }
      }
      default: return { error: `Unknown tool: ${name}` }
    }
  }

  /* ── Send message ── */
  const send = async () => {
    if (!input.trim() || loading || !aiConfig.apiKey) return
    const userText = input.trim()
    setInput(''); setLoading(true)
    setMsgs(p => [...p, { role: 'user', content: userText }])
    const sys = `${agentMd}\n\n## Current App Context\n${ctxText}\n\n## Your Memories\n${memoriesMd}`
    let ms = [...apiMsgs, { role: 'user', content: userText }]

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
        const names = msg.tool_calls.map((tc: any) => tc.function.name).join(', ')
        setMsgs(p => [...p, { role: 'tool_call', content: `tools: ${names}` }])
        if (msg.content) setMsgs(p => [...p, { role: 'assistant', content: msg.content }])
        const results = await Promise.all(msg.tool_calls.map(async (tc: any) => {
          let a: any; try { a = JSON.parse(tc.function.arguments) } catch { a = {} }
          const r = await exec(tc.function.name, a)
          return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r) }
        }))
        ms = [...ms, ...results]
      }
      setApiMsgs(ms)
    } catch (e: any) { setMsgs(p => [...p, { role: 'assistant', content: `Connection error: ${e.message}` }]) }
    setLoading(false)
  }

  /* ── Config save helper ── */
  const updateConfig = (patch: Partial<AIConfig>) => {
    const next = { ...aiConfig, ...patch }
    setAiConfig(next)
    store.saveJSON('config.json', next)
  }

  return (
    <div style={{
      width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', background: '#09090f',
    }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 14px 0' }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>AI Assistant</div>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-faint)', marginTop: 2 }}>{aiConfig.model}</div>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <button onClick={() => setMsgs([])} title="Clear chat" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.74rem', padding: '3px 6px' }}>Clear</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 5px' }}>×</button>
          </div>
        </div>
        <div style={{ display: 'flex', padding: '8px 14px 0', gap: 2 }}>
          {(['chat', 'context', 'agent'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              color: tab === t ? 'var(--accent-light)' : 'var(--text-muted)',
              cursor: 'pointer', padding: '5px 12px 8px', fontSize: '0.8rem',
              fontWeight: tab === t ? 700 : 500, transition: 'all 0.15s', fontFamily: 'inherit',
              textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #0e0e18', background: '#0b0b14', display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={aiConfig.apiKey} onChange={e => updateConfig({ apiKey: e.target.value })} type="password"
                placeholder="OpenRouter key..."
                style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 9px', color: 'var(--text-secondary)', fontSize: '0.72rem', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
              <input value={aiConfig.model} onChange={e => updateConfig({ model: e.target.value })}
                placeholder="Model ID"
                style={{ width: 114, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 9px', color: 'var(--text-secondary)', fontSize: '0.72rem', outline: 'none', fontFamily: 'inherit', flexShrink: 0 }} />
            </div>
            <input value={aiConfig.openaiKey} onChange={e => updateConfig({ openaiKey: e.target.value })} type="password"
              placeholder="OpenAI key (for image generation)..."
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 9px', color: 'var(--text-secondary)', fontSize: '0.72rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.82rem', marginTop: 44, lineHeight: 1.9, padding: '0 8px' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 12, color: '#1e1a35' }}>✦</div>
                I can create events, write notes, configure your timer, navigate sections — just ask.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ marginBottom: 9, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'tool_call' ? (
                  <div style={{ fontSize: '0.7rem', color: '#5040a0', background: 'var(--bg-surface)', border: '1px solid #1a1530', borderRadius: 8, padding: '4px 10px' }}>{m.content}</div>
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
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 7, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask or command..."
              style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '0.84rem', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={send} disabled={loading || !input.trim() || !aiConfig.apiKey} style={{
              background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '9px 12px',
              color: '#fff', cursor: 'pointer', opacity: loading || !input.trim() || !aiConfig.apiKey ? 0.35 : 1,
              flexShrink: 0, transition: 'opacity 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </>
      )}

      {/* ── CONTEXT TAB ── */}
      {tab === 'context' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Live context sent to AI</span>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={ctxLocked} onChange={e => setCtxLocked(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> Override
            </label>
          </div>
          <div style={{ padding: '4px 14px 6px', flexShrink: 0 }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Auto-refreshes from your app data. Check "Override" to edit manually.
            </div>
          </div>
          <textarea value={ctxText} onChange={e => { setCtxText(e.target.value); setCtxLocked(true) }}
            style={{
              flex: 1, background: '#0b0b14', border: 'none', resize: 'none', padding: 14,
              color: ctxLocked ? 'var(--text-secondary)' : '#3a3a58', fontSize: '0.73rem',
              fontFamily: 'var(--font-mono)', lineHeight: 1.75, outline: 'none',
            }} />
        </div>
      )}

      {/* ── AGENT TAB ── */}
      {tab === 'agent' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* AGENT.md */}
          <div style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
            <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-light)' }}>AGENT.md</span>
                <div style={{ fontSize: '0.63rem', color: 'var(--text-faint)', marginTop: 1 }}>System prompt & behavior rules</div>
              </div>
              {agEdit ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setAgentMd(agBuf); setAgEdit(false); store.saveMD('ai-agent.md', agBuf) }} style={saveBtn}>Save</button>
                  <button onClick={() => { setAgBuf(agentMd); setAgEdit(false) }} style={cancelBtn}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setAgBuf(agentMd); setAgEdit(true) }} style={editBtn}>Edit</button>
              )}
            </div>
            {agEdit ? (
              <textarea value={agBuf} onChange={e => setAgBuf(e.target.value)} style={mdTextarea} />
            ) : (
              <pre style={mdPre}>{agentMd}</pre>
            )}
          </div>

          {/* MEMORIES.md */}
          <div style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
            <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--green)' }}>MEMORIES.md</span>
                <div style={{ fontSize: '0.63rem', color: 'var(--text-faint)', marginTop: 1 }}>Persistent user context</div>
              </div>
              {memEdit ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setMemoriesMd(memBuf); setMemEdit(false); store.saveMD('ai-memories.md', memBuf) }} style={{ ...saveBtn, background: 'var(--green)' }}>Save</button>
                  <button onClick={() => { setMemBuf(memoriesMd); setMemEdit(false) }} style={cancelBtn}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setMemBuf(memoriesMd); setMemEdit(true) }} style={editBtn}>Edit</button>
              )}
            </div>
            {memEdit ? (
              <textarea value={memBuf} onChange={e => setMemBuf(e.target.value)} style={mdTextarea} />
            ) : (
              <pre style={mdPre}>{memoriesMd}</pre>
            )}
          </div>

          {/* Tools list */}
          <div>
            <div style={{ padding: '12px 14px 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', fontWeight: 800, color: '#60a5fa' }}>Tools</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>{AI_TOOLS.length} available</span>
            </div>
            {AI_TOOLS.map(t => (
              <div key={t.function.name} style={{ padding: '8px 14px', borderTop: '1px solid #0e0e1c' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--accent-light)', marginBottom: 3 }}>{t.function.name}()</div>
                <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{t.function.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const saveBtn: React.CSSProperties = { fontSize: '0.7rem', background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '3px 10px', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const cancelBtn: React.CSSProperties = { fontSize: '0.7rem', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }
const editBtn: React.CSSProperties = { fontSize: '0.7rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', color: '#606080', cursor: 'pointer', fontFamily: 'inherit' }
const mdTextarea: React.CSSProperties = { width: '100%', minHeight: 180, background: '#0b0b14', border: 'none', borderTop: '1px solid var(--bg-elevated)', resize: 'vertical', padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.73rem', fontFamily: 'monospace', lineHeight: 1.7, outline: 'none', boxSizing: 'border-box' }
const mdPre: React.CSSProperties = { margin: 0, padding: '4px 14px 14px', color: 'var(--text-muted)', fontSize: '0.71rem', fontFamily: 'monospace', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
