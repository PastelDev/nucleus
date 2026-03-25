import { useState, useEffect, useRef } from 'react'
import type { Note, CalendarEvent, Task, PomodoroSettings, Section, AIConfig, Artefact, BackgroundPreset, BoardCollection, BoardScope } from '../lib/types'
import { uid, today } from '../lib/helpers'
import * as store from '../lib/storage'
import { listEventOccurrencesInRange, recurrenceLabel } from '../lib/calendar'
import { SURFACE_TARGET_OPTIONS, getSurfaceRole } from '../lib/theme'
import Markdown from './Markdown'
import NucleusLogo from './NucleusLogo'
import ThinkingBlock from './ThinkingBlock'
import SurfaceFrame from './SurfaceFrame'
import { useAppearance } from './AppearanceProvider'

const SURFACE_TARGET_IDS = SURFACE_TARGET_OPTIONS.map((entry) => entry.id)

/* ── Tool definitions ── */
const AI_TOOLS = [
  { type: 'function', function: { name: 'navigate_to', description: 'Switch to a different section of the app', parameters: { type: 'object', properties: { section: { type: 'string', enum: ['today', 'notes', 'boards', 'memories', 'calendar', 'pomodoro', 'ai-settings', 'artefacts'] } }, required: ['section'] } } },
  { type: 'function', function: { name: 'create_calendar_event', description: 'Create a new event on the calendar, optionally recurring daily, weekly, or yearly.', parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string' }, color: { type: 'string' }, recurrence: { type: 'string', enum: ['none', 'daily', 'weekly', 'yearly'] } }, required: ['title', 'date'] } } },
  { type: 'function', function: { name: 'set_pomodoro', description: 'Configure Pomodoro timer durations', parameters: { type: 'object', properties: { work_minutes: { type: 'number' }, short_break_minutes: { type: 'number' }, long_break_minutes: { type: 'number' }, rounds_count: { type: 'number' }, navigate: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'create_note', description: 'Create a new note with markdown content', parameters: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'content'] } } },
  { type: 'function', function: { name: 'edit_note', description: 'Edit an existing note by its ID', parameters: { type: 'object', properties: { note_id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['note_id'] } } },
  { type: 'function', function: { name: 'create_task', description: 'Add a task to Today view', parameters: { type: 'object', properties: { text: { type: 'string' }, date: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'get_current_view_content', description: 'Read the live context summary (all sections overview)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'read_note', description: 'Read the full content of a specific note by ID', parameters: { type: 'object', properties: { note_id: { type: 'string' } }, required: ['note_id'] } } },
  { type: 'function', function: { name: 'get_all_tasks', description: 'Get tasks filtered by date range', parameters: { type: 'object', properties: { date_from: { type: 'string', description: 'YYYY-MM-DD, optional' }, date_to: { type: 'string', description: 'YYYY-MM-DD, optional' } } } } },
  { type: 'function', function: { name: 'get_all_events', description: 'Get calendar events filtered by date range', parameters: { type: 'object', properties: { date_from: { type: 'string' }, date_to: { type: 'string' } } } } },
  { type: 'function', function: { name: 'read_board', description: 'Read items from a board by ID.', parameters: { type: 'object', properties: { board_id: { type: 'string' } }, required: ['board_id'] } } },
  { type: 'function', function: { name: 'update_memories', description: 'Update agent memories with important context', parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } },
  { type: 'function', function: { name: 'generate_image', description: 'Generate image(s) with OpenAI gpt-image-1. User will preview before placement. Requires OpenAI key.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'] }, quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, n: { type: 'integer', minimum: 1, maximum: 4 }, collection: { type: 'string', enum: ['boards', 'personal'] }, board_id: { type: 'string' }, include_in_context: { type: 'boolean', description: 'If true and model supports vision, pass generated images back as AI context so you can see them' }, reference_path: { type: 'string', description: 'Path of a previously generated image to use as visual reference for generation' }, use_uploaded_references: { type: 'boolean', description: "Use the user's most recently uploaded images as generation reference (works even without vision)" }, use_previous_generation: { type: 'boolean', description: 'Use the most recently generated images as reference for iteration' } }, required: ['prompt'] } } },
  { type: 'function', function: { name: 'generate_images_batch', description: 'Generate multiple images from different prompts. User will preview before placement.', parameters: { type: 'object', properties: { prompts: { type: 'array', items: { type: 'string' } }, size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'] }, quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, collection: { type: 'string', enum: ['boards', 'personal'] }, board_id: { type: 'string' }, include_in_context: { type: 'boolean', description: 'If true and model supports vision, pass generated images back as AI context so you can see them' }, reference_path: { type: 'string', description: 'Path of a previously generated image to use as visual reference' }, use_uploaded_references: { type: 'boolean', description: "Use the user's most recently uploaded images as generation reference" }, use_previous_generation: { type: 'boolean', description: 'Use the most recently generated images as reference for iteration' } }, required: ['prompts'] } } },
  { type: 'function', function: { name: 'create_artefact', description: 'Create a new HTML or React (JSX) artefact in the Artefacts panel. Use type "html" for plain HTML/CSS/JS and "react" for JSX components (exports a default App component).', parameters: { type: 'object', properties: { title: { type: 'string' }, type: { type: 'string', enum: ['html', 'react'] }, code: { type: 'string', description: 'Full HTML document or React JSX code. For react, write a function App() {} and export it as default or just define it — it will be rendered automatically.' }, artefact_id: { type: 'string', description: 'ID of an existing artefact to update instead of creating new' } }, required: ['title', 'type', 'code'] } } },
  { type: 'function', function: { name: 'delete_note', description: 'Permanently delete a note by ID', parameters: { type: 'object', properties: { note_id: { type: 'string' } }, required: ['note_id'] } } },
  { type: 'function', function: { name: 'delete_event', description: 'Permanently delete a calendar event by ID', parameters: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] } } },
  { type: 'function', function: { name: 'delete_task', description: 'Permanently delete a task by ID', parameters: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } } },
  { type: 'function', function: { name: 'complete_task', description: 'Mark a task as done or not done', parameters: { type: 'object', properties: { task_id: { type: 'string' }, done: { type: 'boolean' } }, required: ['task_id', 'done'] } } },
  { type: 'function', function: { name: 'set_focus_topic', description: 'Set the focus topic for the Pomodoro timer', parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] } } },
  { type: 'function', function: { name: 'set_prevent_sleep', description: 'Enable or disable screen sleep prevention', parameters: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } } },
  { type: 'function', function: { name: 'capture_screen', description: 'Capture a screenshot of all screens', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'create_board', description: 'Create a new board in the shared Boards area.', parameters: { type: 'object', properties: { collection: { type: 'string', enum: ['boards', 'personal'] }, name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'read_artefact', description: 'Read the full code of an artefact by ID', parameters: { type: 'object', properties: { artefact_id: { type: 'string' } }, required: ['artefact_id'] } } },
  { type: 'function', function: { name: 'delete_artefact', description: 'Permanently delete an artefact by ID', parameters: { type: 'object', properties: { artefact_id: { type: 'string' } }, required: ['artefact_id'] } } },
  { type: 'function', function: { name: 'toggle_clock', description: 'Show or hide the floating clock', parameters: { type: 'object', properties: { visible: { type: 'boolean' } }, required: ['visible'] } } },
  { type: 'function', function: { name: 'list_background_presets', description: 'List available background presets and surface targets.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'preview_surface_background', description: 'Preview a background on a specific app surface without saving it yet.', parameters: { type: 'object', properties: { surface_target: { type: 'string', enum: SURFACE_TARGET_IDS }, preset_id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string', enum: ['gradient', 'simulation', 'media', 'artefact'] }, style: { type: 'string', enum: ['theme-orbit', 'theme-rings', 'theme-mesh'] }, engine: { type: 'string', enum: ['starfield', 'linked-particles', 'game-of-life', 'evolving-shapes'] }, media_src: { type: 'string' }, media_type: { type: 'string', enum: ['image', 'video'] }, artefact_id: { type: 'string' }, opacity: { type: 'number' }, blur: { type: 'number' }, blend_mode: { type: 'string', enum: ['normal', 'screen', 'overlay', 'soft-light', 'lighten'] }, speed: { type: 'number' }, density: { type: 'number' } }, required: ['surface_target'] } } },
  { type: 'function', function: { name: 'save_background_preset', description: 'Persist the currently previewed background preset after approval.', parameters: { type: 'object', properties: { preview_id: { type: 'string' }, name: { type: 'string' } }, required: ['preview_id'] } } },
  { type: 'function', function: { name: 'assign_surface_background', description: 'Assign an existing background preset to a page, panel, popup, or the app shell.', parameters: { type: 'object', properties: { surface_target: { type: 'string', enum: SURFACE_TARGET_IDS }, preset_id: { type: 'string' }, opacity: { type: 'number' }, blur: { type: 'number' } }, required: ['surface_target'] } } },
  { type: 'function', function: { name: 'update_background_params', description: 'Update either a saved preset or the currently previewed background draft.', parameters: { type: 'object', properties: { preview_id: { type: 'string' }, preset_id: { type: 'string' }, name: { type: 'string' }, opacity: { type: 'number' }, blur: { type: 'number' }, blend_mode: { type: 'string', enum: ['normal', 'screen', 'overlay', 'soft-light', 'lighten'] }, style: { type: 'string', enum: ['theme-orbit', 'theme-rings', 'theme-mesh'] }, engine: { type: 'string', enum: ['starfield', 'linked-particles', 'game-of-life', 'evolving-shapes'] }, media_src: { type: 'string' }, media_type: { type: 'string', enum: ['image', 'video'] }, artefact_id: { type: 'string' }, speed: { type: 'number' }, density: { type: 'number' } } } } },
]

/* ── Context builder ── */
const genCtx = (sec: Section, notes: Note[], events: CalendarEvent[], tasks: Task[], pom: PomodoroSettings, artefacts: Artefact[]) => {
  const td = today()
  let c = `# Nucleus — Live Context\nSection: **${sec}** | Today: ${td}\n\n`
  const tt = tasks.filter(t => t.date === td)
  c += `## Today Tasks (${tt.length})\n${tt.map(t => `- [${t.done ? 'x' : ' '}] ${t.text} (id:${t.id})`).join('\n') || '_none_'}\n\n`
  c += `## Notes (${notes.length})\n${notes.slice(0, 15).map(n => `- "${n.title}" id:${n.id} tags:[${(n.tags || []).join(',')}]`).join('\n') || '_none_'}\n\n`
  const rangeEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const ue = listEventOccurrencesInRange(events, td, rangeEnd, 10)
  c += `## Upcoming Events\n${ue.map(e => `- ${e.occurrenceDate}${e.time ? ' ' + e.time : ''}: ${e.title} (${recurrenceLabel(e.recurrence)}) (id:${e.id})`).join('\n') || '_none_'}\n\n`
  c += `## Pomodoro\nWork: ${pom.work}min | Short: ${pom.short}min | Long: ${pom.long}min\n\n`
  c += `## Artefacts (${artefacts.length})\n${artefacts.slice(0, 10).map(a => `- "${a.title}" (${a.type}) id:${a.id}`).join('\n') || '_none_'}\n`
  return c
}

/* ── Chat session types ── */
interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  msgs: Msg[]
  apiMsgs: any[]
}

/* ── Message types ── */
interface Msg {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_denied' | 'image_preview'
  content: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  toolStatus?: 'running' | 'done' | 'denied'
  toolReason?: string
  imagePaths?: string[]
  imageArgs?: Record<string, unknown>
  imageStatus?: 'inserted' | 'discarded' | 'iterating'
  refImgs?: string[]  // base64 data URLs for user messages with images
  screenshotB64?: string
}

interface PendingApproval {
  toolName: string
  toolArgs: Record<string, unknown>
  resolve: (decision: { approved: boolean; reason?: string }) => void
}

interface PendingImg {
  paths: string[]
  args: Record<string, unknown>
  resolve: (action: 'insert' | 'discard' | 'iterate', iterPrompt?: string) => void
}

interface Props {
  notes: Note[]; events: CalendarEvent[]; tasks: Task[]
  artefacts: Artefact[]
  section: Section; pomSettings: PomodoroSettings
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setArtefacts: React.Dispatch<React.SetStateAction<Artefact[]>>
  setSection: (s: Section) => void
  setPomSettings: React.Dispatch<React.SetStateAction<PomodoroSettings>>
  agentMd: string; memoriesMd: string
  setMemoriesMd: (v: string) => void
  aiConfig: AIConfig
  focusTopic: string; preventSleep: boolean
  setFocusTopic: (v: string) => void; setPreventSleep: (v: boolean) => void
  clockVisible: boolean; setClockVisible: (v: boolean) => void
  onClose: () => void
}

export default function AIPanel({
  notes, events, tasks, artefacts, section, pomSettings,
  setNotes, setEvents, setTasks, setArtefacts, setSection, setPomSettings,
  agentMd, memoriesMd, setMemoriesMd,
  aiConfig, focusTopic, setFocusTopic, preventSleep, setPreventSleep,
  clockVisible: _clockVisible, setClockVisible, onClose,
}: Props) {
  const {
    themeSettings,
    preview,
    previewSurface,
    savePreview,
    clearPreview,
    assignSurface,
    updatePreset,
    findPreset,
    resolveAssignment,
  } = useAppearance()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [apiMsgs, setApiMsgs] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState<string | null>(null)
  const [refImages, setRefImages] = useState<string[]>([])
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)
  const [approvalReason, setApprovalReason] = useState('')
  const [approvalReasonChip, setApprovalReasonChip] = useState('')
  const [pendingImg, setPendingImg] = useState<PendingImg | null>(null)
  const [iterInput, setIterInput] = useState('')
  const [showCtx, setShowCtx] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [supportsVision, setSupportsVision] = useState<boolean | null>(null)
  const currentSessionId = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgMsgIdxRef = useRef<number>(-1)
  const uploadedRefsRef = useRef<string[]>([])
  const lastGeneratedPathsRef = useRef<string[]>([])

  // Resizable panel
  const [panelW, setPanelW] = useState(() => {
    const s = localStorage.getItem('nucleus-ai-panel-w')
    const def = Math.min(380, Math.max(280, Math.round(window.innerWidth * 0.22)))
    return s ? Math.max(260, Math.min(600, Number(s))) : def
  })
  const [dragHov, setDragHov] = useState(false)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, w: 0 })
  const latestW = useRef(panelW)

  const startDrag = (e: { preventDefault(): void; clientX: number }) => {
    e.preventDefault()
    dragging.current = true
    dragStart.current = { x: e.clientX, w: panelW }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      // Dragging left edge: moving left increases width
      const nw = Math.max(260, Math.min(600, dragStart.current.w - (ev.clientX - dragStart.current.x)))
      latestW.current = nw
      setPanelW(nw)
    }
    const onUp = () => {
      dragging.current = false
      localStorage.setItem('nucleus-ai-panel-w', String(latestW.current))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, streamingMsg, pendingApproval, pendingImg])

  // Load sessions on mount
  useEffect(() => {
    store.loadChats<ChatSession>().then(saved => setSessions(saved))
  }, [])

  // Detect vision support when model or key changes
  useEffect(() => {
    if (!aiConfig.apiKey || !aiConfig.model) { setSupportsVision(null); return }
    let cancelled = false
    fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${aiConfig.apiKey}` },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const found = (data.data as any[])?.find((m: any) => m.id === aiConfig.model)
        const modality: string = found?.architecture?.modality || ''
        setSupportsVision(modality.includes('image'))
      })
      .catch(() => { if (!cancelled) setSupportsVision(null) })
    return () => { cancelled = true }
  }, [aiConfig.model, aiConfig.apiKey])

  const activeTools = supportsVision ? AI_TOOLS : AI_TOOLS.filter(t => t.function.name !== 'capture_screen')
  const approvalReasonChoices = ['Not now', 'Too risky', 'Need more context', 'Do it manually']

  const ctxText = genCtx(section, notes, events, tasks, pomSettings, artefacts)
    + (focusTopic ? `\n## Focus Session\nFocusing on: "${focusTopic}"\n` : '')
    + `\nPrevent sleep: ${preventSleep}\n`
    + (uploadedRefsRef.current.length > 0 ? `\n## Uploaded Reference Images\n${uploadedRefsRef.current.length} image(s) available — use use_uploaded_references: true in generate_image to use them as reference\n` : '')

  const buildBackgroundPreset = (args: any): BackgroundPreset => {
    if (args.kind === 'media' || args.media_src) {
      return {
        id: args.preset_id || `preview-${uid()}`,
        name: args.name || 'Preview Media',
        kind: 'media',
        opacity: args.opacity ?? 0.92,
        blur: args.blur ?? 0,
        blendMode: args.blend_mode || 'normal',
        media: {
          src: args.media_src || '',
          mediaType: args.media_type || 'image',
          fit: 'cover',
          drift: 0.12,
          muted: true,
          loop: true,
          playbackRate: 1,
        },
      }
    }

    if (args.kind === 'artefact' || args.artefact_id) {
      return {
        id: args.preset_id || `preview-${uid()}`,
        name: args.name || 'Preview Artefact',
        kind: 'artefact',
        opacity: args.opacity ?? 0.88,
        blur: args.blur ?? 0,
        blendMode: args.blend_mode || 'normal',
        artefact: {
          artefactId: args.artefact_id || '',
          scale: 1,
          injectTheme: true,
        },
      }
    }

    if (args.kind === 'simulation' || args.engine) {
      return {
        id: args.preset_id || `preview-${uid()}`,
        name: args.name || 'Preview Simulation',
        kind: 'simulation',
        opacity: args.opacity ?? 0.82,
        blur: args.blur ?? 0,
        blendMode: args.blend_mode || 'screen',
        simulation: {
          engine: args.engine || 'starfield',
          speed: args.speed ?? 0.4,
          density: args.density ?? 80,
          detail: 0.5,
        },
      }
    }

    return {
      id: args.preset_id || `preview-${uid()}`,
      name: args.name || 'Preview Gradient',
      kind: 'gradient',
      opacity: args.opacity ?? 1,
      blur: args.blur ?? 0,
      blendMode: args.blend_mode || 'normal',
      gradient: {
        style: args.style || 'theme-orbit',
        intensity: 0.74,
        motion: args.speed ?? 0.58,
        softness: 0.72,
      },
    }
  }

  const patchBackgroundPreset = (preset: BackgroundPreset, args: any): BackgroundPreset => {
    const base = {
      ...preset,
      name: args.name ?? preset.name,
      opacity: args.opacity ?? preset.opacity,
      blur: args.blur ?? preset.blur,
      blendMode: args.blend_mode ?? preset.blendMode,
    }
    if (base.kind === 'gradient') {
      return {
        ...base,
        gradient: {
          ...base.gradient,
          style: args.style ?? base.gradient.style,
          motion: args.speed ?? base.gradient.motion,
        },
      }
    }
    if (base.kind === 'simulation') {
      return {
        ...base,
        simulation: {
          ...base.simulation,
          engine: args.engine ?? base.simulation.engine,
          speed: args.speed ?? base.simulation.speed,
          density: args.density ?? base.simulation.density,
        },
      }
    }
    if (base.kind === 'media') {
      return {
        ...base,
        media: {
          ...base.media,
          src: args.media_src ?? base.media.src,
          mediaType: args.media_type ?? base.media.mediaType,
        },
      }
    }
    return {
      ...base,
      artefact: {
        ...base.artefact,
        artefactId: args.artefact_id ?? base.artefact.artefactId,
      },
    }
  }

  const hasPresetPatch = (args: any) => (
    args.name !== undefined
    || args.blend_mode !== undefined
    || args.style !== undefined
    || args.engine !== undefined
    || args.media_src !== undefined
    || args.media_type !== undefined
    || args.artefact_id !== undefined
    || args.speed !== undefined
    || args.density !== undefined
  )

  /* ── Permission check ── */
  const needsApproval = (name: string) => {
    if (name === 'generate_image' || name === 'generate_images_batch') return false // image has own preview
    if (aiConfig.permMode === 'allow') return false
    if (aiConfig.permMode === 'ask') return true
    return !aiConfig.permCustom?.[name]
  }

  const requestApproval = (name: string, args: Record<string, unknown>): Promise<{ approved: boolean; reason?: string }> =>
    new Promise(resolve => {
      setApprovalReason('')
      setApprovalReasonChip('')
      setPendingApproval({ toolName: name, toolArgs: args, resolve })
    })

  const resolveBoardScopeForArgs = async (args: { collection?: BoardCollection; board_id?: string }): Promise<BoardScope | null> => {
    if (args.collection) return store.boardCollectionToScope(args.collection)
    if (!args.board_id) return null
    return store.resolveBoardScope(args.board_id)
  }

  /* ── Image generation + preview ── */
  const generateAndPreview = async (args: any, isBatch: boolean): Promise<any> => {
    try {
      if (!aiConfig.openaiKey) return { error: 'No OpenAI API key — add it in AI Settings' }
      const payload: any = {
        openai_key: aiConfig.openaiKey,
        size: args.size || '1024x1024',
        quality: args.quality || 'auto',
      }
      if (isBatch) payload.prompts = args.prompts
      else { payload.prompt = args.prompt; payload.n = args.n || 1 }
      const boardScope = await resolveBoardScopeForArgs(args)
      if (boardScope && args.board_id) { payload.scope = boardScope; payload.board_id = args.board_id }
      if (args.reference_path) payload.reference_paths = [args.reference_path]
      // Auto-reference last generated images if iterating
      if (args.use_previous_generation && lastGeneratedPathsRef.current.length > 0) {
        payload.reference_paths = lastGeneratedPathsRef.current
      }
      if (args.use_uploaded_references && uploadedRefsRef.current.length > 0) {
        payload.reference_base64_images = uploadedRefsRef.current.map(d => d.split(',')[1] || d)
      }

      const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.error) return { error: data.error }

      // Track generated paths for iteration
      lastGeneratedPathsRef.current = data.paths || []

      // Add preview message and wait for user action
      const imgIdx = msgs.length + (pendingApproval ? 1 : 0)
      imgMsgIdxRef.current = imgIdx
      setMsgs(p => [...p, { role: 'image_preview', content: '', imagePaths: data.paths, imageArgs: args }])

      const action = await new Promise<{ type: 'insert' | 'discard' | 'iterate'; iterPrompt?: string }>(
        resolve => setPendingImg({ paths: data.paths, args, resolve: (type, iterPrompt) => resolve({ type, iterPrompt }) })
      )

      const promptUsed = isBatch ? (args.prompts || []).join('; ') : (args.prompt || '')

      // Always pass images to vision models (no include_in_context gate)
      const ctxImages = (supportsVision && data.b64_images) ? data.b64_images : undefined

      // Base result for non-vision models
      const nonVisionInfo = !supportsVision ? {
        images_generated: true,
        vision_unavailable: true,
        prompt_used: promptUsed,
        image_count: (data.paths || []).length,
        user_can_see_images: true,
        note: 'Images are visible to the user in the chat. You cannot see them. Ask the user to describe what they see if you need visual feedback. Use use_previous_generation: true to iterate on these images.',
      } : {}

      if (action.type === 'discard') {
        setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'discarded' } : m))
        return { ok: true, placed: false, message: 'Images discarded by user', ...nonVisionInfo }
      }

      if (action.type === 'insert' && boardScope && args.board_id) {
        setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'inserted' } : m))
        const board = await store.loadBoard(boardScope, args.board_id)
        if (board) {
          const newImgs = (data.paths as string[]).map((src, i) => ({
            id: uid(), type: 'image' as const, x: 200 + i * 540, y: 200, w: 512, h: 512, src, name: `AI Image ${i + 1}`,
          }))
          await store.saveBoard(boardScope, { ...board, items: [...board.items, ...newImgs], updatedAt: Date.now() });
          ;(window as any).__nucleusSelectBoard = { scope: boardScope, boardId: args.board_id }
          setSection('boards')
          window.dispatchEvent(new CustomEvent('nucleus:select-board', { detail: { scope: boardScope, boardId: args.board_id } }))
        }
        return { ok: true, placed: true, paths: data.paths, count: data.paths.length, ...nonVisionInfo, ...(ctxImages ? { _context_images: ctxImages } : {}) }
      }

      if (action.type === 'insert') {
        setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'inserted' } : m))
        return { ok: true, placed: false, paths: data.paths, note: 'No board specified — images generated but not placed', ...nonVisionInfo, ...(ctxImages ? { _context_images: ctxImages } : {}) }
      }

      // iterate
      setMsgs(p => p.map((m, i) => i === imgMsgIdxRef.current ? { ...m, imageStatus: 'iterating' } : m))
      return { ok: true, placed: false, iterate_with: action.iterPrompt, message: 'User wants to refine — use iterate_with as feedback to regenerate. Call generate_image again with use_previous_generation: true and the refined prompt.', ...nonVisionInfo }
    } catch (e: any) {
      return { error: `Image generation error: ${e.message}` }
    } finally {
      setPendingImg(null)
      setIterInput('')
    }
  }

  /* ── Tool executor ── */
  const exec = async (name: string, args: any): Promise<any> => {
    if (needsApproval(name)) {
      const decision = await requestApproval(name, args)
      setPendingApproval(null)
      setApprovalReason('')
      setApprovalReasonChip('')
      if (!decision.approved) {
        return {
          error: 'Denied by user',
          denied: true,
          reason: decision.reason || null,
          next_step: 'Acknowledge the denial, explain what you can do instead, and ask one short follow-up only if you still need something from the user.',
        }
      }
    }

    switch (name) {
      case 'navigate_to': setSection(args.section); return { ok: true }
      case 'create_calendar_event': {
        const ev: CalendarEvent = { id: uid(), title: args.title, date: args.date, time: args.time || '', color: args.color || '#7c3aed', recurrence: args.recurrence || 'none' }
        setEvents(p => [...p, ev]); return { ok: true, event_id: ev.id }
      }
      case 'set_pomodoro': {
        const u = { ...pomSettings }
        if (args.work_minutes) u.work = args.work_minutes
        if (args.short_break_minutes) u.short = args.short_break_minutes
        if (args.long_break_minutes) u.long = args.long_break_minutes
        if (args.rounds_count) u.rounds = args.rounds_count
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
      case 'read_note': {
        const n = notes.find(x => x.id === args.note_id)
        return n ? { id: n.id, title: n.title, content: n.content, tags: n.tags } : { error: 'Note not found' }
      }
      case 'get_all_tasks': {
        let filtered = tasks
        if (args.date_from) filtered = filtered.filter(t => t.date >= args.date_from)
        if (args.date_to) filtered = filtered.filter(t => t.date <= args.date_to)
        return { tasks: filtered.map(t => ({ id: t.id, text: t.text, done: t.done, date: t.date })) }
      }
      case 'get_all_events': {
        const dateFrom = args.date_from || today()
        const dateTo = args.date_to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const occurrences = listEventOccurrencesInRange(events, dateFrom, dateTo, 200)
        return {
          events: occurrences.map(e => ({
            id: e.id,
            title: e.title,
            date: e.occurrenceDate,
            time: e.time,
            color: e.color,
            recurrence: e.recurrence,
            series_start: e.date,
          })),
        }
      }
      case 'read_board': {
        const resolved = await store.loadBoardById(args.board_id)
        return resolved
          ? { id: resolved.board.id, name: resolved.board.name, items: resolved.board.items, collection: store.boardScopeToCollection(resolved.scope) }
          : { error: 'Board not found' }
      }
      case 'update_memories':
        setMemoriesMd(args.content)
        await store.saveAgentMemorySummary(args.content, true)
        return { ok: true }
      case 'generate_image': return generateAndPreview(args, false)
      case 'generate_images_batch': return generateAndPreview(args, true)
      case 'create_artefact': {
        if (args.artefact_id) {
          let found = false
          setArtefacts(p => p.map(a => {
            if (a.id !== args.artefact_id) return a
            found = true
            return { ...a, title: args.title ?? a.title, type: args.type ?? a.type, code: args.code, updatedAt: Date.now() }
          }))
          if (found) { setSection('artefacts'); return { ok: true, artefact_id: args.artefact_id } }
        }
        const a: Artefact = { id: uid(), title: args.title, type: args.type || 'html', code: args.code, createdAt: Date.now(), updatedAt: Date.now() }
        setArtefacts(p => [a, ...p])
        setSection('artefacts')
        return { ok: true, artefact_id: a.id }
      }
      case 'delete_note': {
        let found = false
        setNotes(p => p.filter(n => { if (n.id === args.note_id) { found = true; return false } return true }))
        return found ? { ok: true } : { error: 'Note not found' }
      }
      case 'delete_event': {
        let found = false
        setEvents(p => p.filter(e => { if (e.id === args.event_id) { found = true; return false } return true }))
        return found ? { ok: true } : { error: 'Event not found' }
      }
      case 'delete_task': {
        let found = false
        setTasks(p => p.filter(t => { if (t.id === args.task_id) { found = true; return false } return true }))
        return found ? { ok: true } : { error: 'Task not found' }
      }
      case 'complete_task': {
        let found = false
        setTasks(p => p.map(t => { if (t.id !== args.task_id) return t; found = true; return { ...t, done: !!args.done } }))
        return found ? { ok: true } : { error: 'Task not found' }
      }
      case 'set_focus_topic': setFocusTopic(args.topic); return { ok: true, topic: args.topic }
      case 'set_prevent_sleep': setPreventSleep(args.enabled); return { ok: true, enabled: args.enabled }
      case 'capture_screen': {
        const res = await fetch('/api/screenshot')
        const data = await res.json()
        return { ok: true, _screenshot_b64: data.b64 }
      }
      case 'create_board': {
        const boardId = uid()
        const newBoard = { id: boardId, name: args.name, items: [], createdAt: Date.now(), updatedAt: Date.now() }
        const collection = (args.collection as BoardCollection | undefined) || 'boards'
        const scope = store.boardCollectionToScope(collection)
        const index = await store.loadBoardIndex(scope)
        await store.saveBoardIndex(scope, { ...index, boards: [...index.boards, { id: boardId, name: args.name }] })
        await store.saveBoard(scope, newBoard)
        setSection('boards')
        window.dispatchEvent(new CustomEvent('nucleus:select-board', { detail: { scope, boardId } }))
        return { ok: true, board_id: boardId, name: args.name, collection }
      }
      case 'read_artefact': {
        const a = artefacts.find(x => x.id === args.artefact_id)
        return a ? { id: a.id, title: a.title, type: a.type, code: a.code } : { error: 'Artefact not found' }
      }
      case 'delete_artefact': {
        let found = false
        setArtefacts(p => p.filter(a => { if (a.id === args.artefact_id) { found = true; return false } return true }))
        return found ? { ok: true } : { error: 'Artefact not found' }
      }
      case 'toggle_clock': setClockVisible(!!args.visible); return { ok: true, visible: !!args.visible }
      case 'list_background_presets': {
        return {
          presets: themeSettings.backgroundPresets.map((preset) => ({
            id: preset.id,
            name: preset.name,
            kind: preset.kind,
          })),
          surface_targets: SURFACE_TARGET_OPTIONS.map((target) => {
            const assignment = resolveAssignment(target.id, target.role)
            return {
              id: target.id,
              label: target.label,
              role: target.role,
              current_preset_id: assignment.presetId,
              has_override: !!themeSettings.surfaceOverrides[target.id],
            }
          }),
          preview: preview ? {
            preview_id: preview.previewId,
            surface_target: preview.targetId,
            preset_id: preview.preset?.id ?? preview.assignment.presetId,
            name: preview.preset?.name ?? findPreset(preview.assignment.presetId)?.name ?? null,
          } : null,
        }
      }
      case 'preview_surface_background': {
        const targetId = args.surface_target
        const role = getSurfaceRole(targetId)
        const currentAssignment = resolveAssignment(targetId, role)
        const previewId = preview && preview.targetId === targetId ? preview.previewId : `preview-${uid()}`

        let draftPreset: BackgroundPreset | null = null
        let presetId: string | null = null

        if (args.preset_id) {
          const existingPreset = findPreset(args.preset_id)
          if (!existingPreset) return { error: 'Preset not found' }
          presetId = existingPreset.id
          draftPreset = hasPresetPatch(args) ? patchBackgroundPreset(existingPreset, args) : null
        } else {
          draftPreset = buildBackgroundPreset(args)
          presetId = draftPreset.id
        }

        if (draftPreset) presetId = draftPreset.id

        previewSurface({
          previewId,
          targetId,
          role,
          assignment: {
            ...currentAssignment,
            presetId,
            opacity: typeof args.opacity === 'number' ? args.opacity : currentAssignment.opacity,
            blur: typeof args.blur === 'number' ? args.blur : currentAssignment.blur,
          },
          preset: draftPreset,
        })

        return {
          ok: true,
          preview_id: previewId,
          surface_target: targetId,
          preset_id: presetId,
          role,
        }
      }
      case 'save_background_preset': {
        if (!preview || preview.previewId !== args.preview_id) return { error: 'Preview not found' }
        const saved = savePreview(args.name)
        return saved ? {
          ok: true,
          preview_id: args.preview_id,
          surface_target: saved.targetId,
          preset_id: saved.preset?.id ?? saved.assignment.presetId,
          name: saved.preset?.name ?? null,
        } : { error: 'Preview not found' }
      }
      case 'assign_surface_background': {
        const targetId = args.surface_target
        const role = getSurfaceRole(targetId)
        const currentAssignment = resolveAssignment(targetId, role)
        const nextPresetId = args.preset_id ?? null
        if (nextPresetId && !themeSettings.backgroundPresets.some((preset) => preset.id === nextPresetId)) {
          return { error: 'Preset not found' }
        }
        assignSurface(targetId, {
          ...currentAssignment,
          presetId: nextPresetId,
          opacity: typeof args.opacity === 'number' ? args.opacity : currentAssignment.opacity,
          blur: typeof args.blur === 'number' ? args.blur : currentAssignment.blur,
        })
        if (preview?.targetId === targetId) clearPreview()
        return {
          ok: true,
          surface_target: targetId,
          preset_id: nextPresetId,
        }
      }
      case 'update_background_params': {
        if (args.preview_id) {
          if (!preview || preview.previewId !== args.preview_id) return { error: 'Preview not found' }
          const currentPreview = preview
          const basePreset = preview.preset ?? findPreset(preview.assignment.presetId)
          previewSurface({
            ...currentPreview,
            assignment: {
              ...currentPreview.assignment,
              opacity: typeof args.opacity === 'number' ? args.opacity : currentPreview.assignment.opacity,
              blur: typeof args.blur === 'number' ? args.blur : currentPreview.assignment.blur,
            },
            preset: basePreset ? patchBackgroundPreset(basePreset, args) : currentPreview.preset,
          })
          return { ok: true, preview_id: args.preview_id }
        }

        if (!args.preset_id) return { error: 'Provide preview_id or preset_id' }
        const preset = themeSettings.backgroundPresets.find((entry) => entry.id === args.preset_id)
        if (!preset) return { error: 'Preset not found' }
        updatePreset(args.preset_id, patchBackgroundPreset(preset, args))
        return { ok: true, preset_id: args.preset_id }
      }
      default: return { error: `Unknown tool: ${name}` }
    }
  }

  /* ── Send message ── */
  const send = async () => {
    if (!input.trim() || loading || !aiConfig.apiKey) return
    const userText = input.trim()
    const attachments = [...refImages]
    if (attachments.length > 0) uploadedRefsRef.current = attachments
    setInput(''); setRefImages([]); setLoading(true)

    // Build user message for display
    setMsgs(p => [...p, { role: 'user', content: userText, refImgs: attachments.length ? attachments : undefined }])

    // Build API message (with images if any)
    let userContent: any
    if (attachments.length && supportsVision) {
      userContent = [{ type: 'text', text: userText }, ...attachments.map(b64 => ({ type: 'image_url', image_url: { url: b64 } }))]
    } else if (attachments.length && !supportsVision) {
      userContent = `${userText}\n\n[User attached ${attachments.length} image(s). You cannot see them because this model does not support vision. Ask the user to describe the image content. The images are available as reference for image generation — use use_uploaded_references: true in generate_image to use them.]`
    } else {
      userContent = userText
    }
    const sys = `${agentMd}\n\n## Current App Context\n${ctxText}\n\n## Your Memories\n${memoriesMd}`
    let ms = [...apiMsgs, { role: 'user', content: userContent }]

    try {
      while (true) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}`, 'HTTP-Referer': 'https://nucleus.app' },
          body: JSON.stringify({ model: aiConfig.model, messages: [{ role: 'system', content: sys }, ...ms], tools: activeTools, tool_choice: 'auto', stream: true }),
        })

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}))
          setMsgs(p => [...p, { role: 'assistant', content: `Error: ${err.error?.message || res.statusText}` }])
          break
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let streamedText = ''
        const tcMap: Record<number, { id: string; name: string; args: string }> = {}

        setStreamingMsg('')

        outer: while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()!
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') break outer
            let chunk: any
            try { chunk = JSON.parse(raw) } catch { continue }
            if (chunk.error) { setStreamingMsg(null); setMsgs(p => [...p, { role: 'assistant', content: `Error: ${chunk.error.message}` }]); break outer }
            const delta = chunk.choices?.[0]?.delta
            if (!delta) continue
            if (delta.content) {
              streamedText += delta.content
              setStreamingMsg(streamedText)
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!tcMap[idx]) tcMap[idx] = { id: '', name: '', args: '' }
                if (tc.id) tcMap[idx].id = tc.id
                if (tc.function?.name) tcMap[idx].name = tc.function.name
                if (tc.function?.arguments) tcMap[idx].args += tc.function.arguments
              }
            }
          }
        }

        setStreamingMsg(null)

        const toolCalls = Object.entries(tcMap)
          .sort((a, b) => +a[0] - +b[0])
          .map(([, tc]) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } }))

        const apiMsg: any = { role: 'assistant', content: streamedText || null }
        if (toolCalls.length) apiMsg.tool_calls = toolCalls
        ms = [...ms, apiMsg]

        if (streamedText) setMsgs(p => [...p, { role: 'assistant', content: streamedText }])

        if (!toolCalls.length) {
          if (!streamedText) setMsgs(p => [...p, { role: 'assistant', content: 'Done.' }])
          break
        }

        const results: any[] = []
        for (const tc of toolCalls) {
          let a: any; try { a = JSON.parse(tc.function.arguments) } catch { a = {} }
          let toolMsgIndex = -1
          setMsgs(p => {
            toolMsgIndex = p.length
            return [...p, { role: 'tool_call', content: '', toolName: tc.function.name, toolArgs: a, toolStatus: 'running' }]
          })
          const r = await exec(tc.function.name, a)
          setMsgs(p => p.map((msg, idx) => idx === toolMsgIndex ? {
            ...msg,
            toolStatus: r.denied ? 'denied' : 'done',
            toolReason: r.reason || undefined,
            screenshotB64: r._screenshot_b64 ?? msg.screenshotB64,
          } : msg))
          if (r.denied) {
            setMsgs(p => [...p, {
              role: 'tool_denied',
              content: r.reason
                ? `You denied \`${tc.function.name}()\` — ${r.reason}`
                : `You denied \`${tc.function.name}()\`.`,
            }])
          }
          if (r._screenshot_b64) {
            const { _screenshot_b64, ...rRest } = r
            const toolContent: any = [
              { type: 'text', text: JSON.stringify({ ...rRest, screenshot: 'attached' }) },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${r._screenshot_b64}` } },
            ]
            results.push({ role: 'tool', tool_call_id: tc.id, content: toolContent })
          } else if (r._context_images) {
            const { _context_images, ...rRest } = r
            const toolContent: any = [
              { type: 'text', text: JSON.stringify(rRest) },
              ...(_context_images as string[]).map((b64: string) => ({
                type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` },
              })),
            ]
            results.push({ role: 'tool', tool_call_id: tc.id, content: toolContent })
          } else {
            results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(r) })
          }
        }
        ms = [...ms, ...results]
      }
      setApiMsgs(ms)
      // Auto-save session after completed AI turn
      setMsgs(currentMsgs => {
        setSessions(currentSessions => {
          const now = Date.now()
          if (!currentSessionId.current) {
            currentSessionId.current = uid()
          }
          const title = currentMsgs.find(m => m.role === 'user')?.content?.slice(0, 60) || 'Chat'
          const existing = currentSessions.find(s => s.id === currentSessionId.current)
          let updated: ChatSession[]
          if (existing) {
            updated = currentSessions.map(s => s.id === currentSessionId.current
              ? { ...s, msgs: currentMsgs, apiMsgs: ms, updatedAt: now }
              : s)
          } else {
            updated = [{ id: currentSessionId.current!, title, createdAt: now, updatedAt: now, msgs: currentMsgs, apiMsgs: ms }, ...currentSessions]
          }
          store.saveChats(updated)
          return updated
        })
        return currentMsgs
      })
    } catch (e: any) { setStreamingMsg(null); setMsgs(p => [...p, { role: 'assistant', content: `Connection error: ${e.message}` }]) }
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
    <SurfaceFrame
      targetId="panel:ai-chat"
      role="panel"
      glass="panel"
      style={{ width: panelW, flexShrink: 0, borderLeft: '1px solid var(--border)', position: 'relative' }}
      contentStyle={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {/* Left drag handle */}
      <div
        onMouseDown={startDrag}
        onMouseEnter={() => setDragHov(true)}
        onMouseLeave={() => setDragHov(false)}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          cursor: 'col-resize', zIndex: 10,
          background: dragHov ? 'var(--accent)' : 'transparent',
          transition: 'background 0.15s',
        }}
      />
      {/* Header */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>AI Chat</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: 1 }}>
            {hasKey ? aiConfig.model : <span style={{ color: 'var(--red)' }}>No API key — configure in AI Settings</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => {
            // Save current session before clearing
            if (msgs.length > 0) {
              const now = Date.now()
              if (!currentSessionId.current) currentSessionId.current = uid()
              const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 60) || 'Chat'
              setSessions(prev => {
                const existing = prev.find(s => s.id === currentSessionId.current)
                let updated: ChatSession[]
                if (existing) {
                  updated = prev.map(s => s.id === currentSessionId.current ? { ...s, msgs, apiMsgs, updatedAt: now } : s)
                } else {
                  updated = [{ id: currentSessionId.current!, title, createdAt: now, updatedAt: now, msgs, apiMsgs }, ...prev]
                }
                store.saveChats(updated)
                return updated
              })
            }
            setMsgs([]); setApiMsgs([]); currentSessionId.current = null
          }} title="Clear chat" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 6px' }}>Clear</button>
          <button onClick={() => setShowHistory(v => !v)} style={{ background: showHistory ? 'var(--accent-surface)' : 'none', border: `1px solid ${showHistory ? 'var(--accent)' : 'var(--border)'}`, color: showHistory ? 'var(--accent-light)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, fontFamily: 'inherit' }}>History</button>
          <button onClick={() => setShowCtx(v => !v)} style={{ background: showCtx ? 'var(--accent-surface)' : 'none', border: `1px solid ${showCtx ? 'var(--accent)' : 'var(--border)'}`, color: showCtx ? 'var(--accent-light)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, fontFamily: 'inherit' }}>Context</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 4px' }}>×</button>
        </div>
      </div>

      {/* Permission mode indicator */}
      <div style={{ padding: '6px 14px', background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: aiConfig.permMode === 'allow' ? 'var(--green)' : aiConfig.permMode === 'ask' ? 'var(--orange)' : 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.63rem', color: 'var(--text-faint)' }}>
          {aiConfig.permMode === 'allow' ? 'Auto-execute all' : aiConfig.permMode === 'ask' ? 'Ask for each tool' : 'Custom permissions'}
        </span>
        {aiConfig.apiKey && aiConfig.model && (
          <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: supportsVision === true ? 'var(--green)' : supportsVision === false ? 'var(--text-faint)' : 'var(--text-ghost)', display: 'flex', alignItems: 'center', gap: 3 }}>
            {supportsVision === true ? '● Vision' : supportsVision === false ? '○ No vision' : '○ …'}
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', position: 'relative' }}>
        {/* History overlay */}
        {showHistory && (
          <div className="glass-surface glass-popup" style={{ position: 'absolute', inset: 0, zIndex: 'var(--z-popover)', overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Chat History</div>
            {sessions.length === 0 && <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>No saved sessions yet.</div>}
            {[...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 6, cursor: 'pointer' }}
                onClick={() => { setMsgs(s.msgs); setApiMsgs(s.apiMsgs); currentSessionId.current = s.id; setShowHistory(false) }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: 2 }}>{new Date(s.updatedAt).toLocaleString()}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setSessions(prev => { const updated = prev.filter(x => x.id !== s.id); store.saveChats(updated); return updated }) }} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '1rem', padding: '2px 4px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {/* Context overlay */}
        {showCtx && (
          <div className="glass-surface glass-popup" style={{ position: 'absolute', inset: 0, zIndex: 'var(--z-popover)', overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Live Context</div>
            <pre style={{ margin: 0, color: 'var(--text-faint)', fontSize: '0.73rem', fontFamily: 'monospace', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 }}>{ctxText}</pre>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>This context is automatically injected into every AI request. Use tools like read_note, get_all_tasks, get_all_events, read_board for full data.</div>
          </div>
        )}
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.84rem', marginTop: 52, lineHeight: 1.9, padding: '0 12px' }}>
            <div style={{ marginBottom: 14, opacity: 0.3 }}><NucleusLogo size={36} /></div>
            Ask for changes, planning, notes, images, boards, or appearance previews.
          </div>
        )}
        {(() => {
          // Group consecutive tool_call messages into ThinkingBlocks
          const grouped: Array<{ type: 'msg'; msg: Msg; idx: number } | { type: 'thinking'; calls: Msg[]; startIdx: number }> = []
          let i = 0
          while (i < msgs.length) {
            if (msgs[i].role === 'tool_call') {
              const calls: Msg[] = []
              const startIdx = i
              while (i < msgs.length && msgs[i].role === 'tool_call') { calls.push(msgs[i]); i++ }
              grouped.push({ type: 'thinking', calls, startIdx })
            } else {
              grouped.push({ type: 'msg', msg: msgs[i], idx: i })
              i++
            }
          }
          return grouped.map((g, gi) => {
            if (g.type === 'thinking') {
              return <ThinkingBlock key={`t-${g.startIdx}`} calls={g.calls} defaultCollapsed={!g.calls.some(call => call.toolStatus === 'running')} />
            }
            const m = g.msg
            return (
          <div key={gi} style={{ marginBottom: 9, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'image_preview' ? (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, maxWidth: '97%', width: '97%' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--accent-light)', marginBottom: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {m.imageStatus === 'inserted' ? '✓ Inserted to board' : m.imageStatus === 'discarded' ? '✕ Discarded' : m.imageStatus === 'iterating' ? '↻ Iterating...' : 'Generated Images'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                  {(m.imagePaths || []).map((p, j) => (
                    <img key={j} src={p} alt={`Generated ${j + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, display: 'block', border: '1px solid var(--border)' }} />
                  ))}
                </div>
              </div>
            ) : m.role === 'tool_denied' ? (
              <div style={{
                maxWidth: '94%',
                background: 'color-mix(in srgb, var(--orange) 10%, var(--bg-elevated))',
                borderRadius: '14px 14px 14px 4px',
                padding: '10px 12px',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                lineHeight: 1.6,
                border: '1px solid color-mix(in srgb, var(--orange) 42%, var(--border))',
              }}>
                {m.content}
              </div>
            ) : (
              <div style={{
                maxWidth: '94%',
                background: m.role === 'user' ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '11px 13px',
                color: m.role === 'user' ? '#d4c4ff' : 'var(--text-secondary)',
                fontSize: '0.84rem', lineHeight: 1.7,
                border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
              }}>
                {m.refImgs?.map((src, j) => <img key={j} src={src} style={{ width: '100%', borderRadius: 6, marginBottom: 6, display: 'block' }} />)}
                {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
              </div>
            )}
          </div>
            )
          })
        })()}
        {streamingMsg !== null && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
            <div style={{
              maxWidth: '94%', padding: '10px 12px', borderRadius: 14, fontSize: '0.84rem', lineHeight: 1.65,
              background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            }}>
              {streamingMsg ? <Markdown text={streamingMsg} /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Thinking…</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: `nuc-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {loading && streamingMsg === null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Working…</span>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: `nuc-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Approval card */}
      {pendingApproval && (
        <div style={{ margin: '0 10px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-focus)', borderRadius: 14, padding: '14px 14px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--orange)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>PERMISSION REQUEST</div>
          <div style={{ fontFamily: 'monospace', color: 'var(--accent-light)', fontSize: '0.8rem', marginBottom: 6 }}>{pendingApproval.toolName}()</div>
          {Object.entries(pendingApproval.toolArgs).slice(0, 3).map(([k, v]) => (
            <div key={k} style={{ fontSize: '0.7rem', color: 'var(--text-faint)', paddingLeft: 8, lineHeight: 1.7 }}>
              {k}: <span style={{ color: 'var(--text-muted)' }}>{String(v).slice(0, 60)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {approvalReasonChoices.map((reason) => {
              const active = approvalReasonChip === reason
              return (
                <button
                  key={reason}
                  onClick={() => {
                    setApprovalReasonChip(active ? '' : reason)
                    if (!approvalReason) setApprovalReason(active ? '' : reason)
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: `1px solid ${active ? 'var(--orange)' : 'var(--border)'}`,
                    background: active ? 'color-mix(in srgb, var(--orange) 12%, transparent)' : 'transparent',
                    color: active ? 'var(--orange)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontFamily: 'inherit',
                  }}
                >
                  {reason}
                </button>
              )
            })}
          </div>
          <input
            value={approvalReason}
            onChange={(event) => setApprovalReason(event.target.value)}
            placeholder="Optional reason to send back to the assistant"
            style={{ width: '100%', marginTop: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', color: 'var(--text-secondary)', fontSize: '0.76rem', outline: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button onClick={() => pendingApproval.resolve({ approved: true })} style={{ flex: 1, padding: '8px', background: 'var(--accent)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>Allow</button>
            <button onClick={() => pendingApproval.resolve({ approved: false, reason: approvalReason.trim() || approvalReasonChip || undefined })} style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>Deny</button>
          </div>
        </div>
      )}

      {/* Image preview card */}
      {pendingImg && (
        <div style={{ margin: '0 10px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-light)', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>REVIEW GENERATED IMAGES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6, marginBottom: 10, maxHeight: 260, overflowY: 'auto' }}>
            {pendingImg.paths.map((p, i) => (
              <img key={i} src={p} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => pendingImg.resolve('insert')} style={{ flex: 1, padding: '7px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {pendingImg.args.board_id ? 'Insert to Board' : 'Accept'}
            </button>
            <button onClick={() => pendingImg.resolve('discard')} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-faint)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
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
              style={{ padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: '0.73rem', cursor: 'pointer', fontFamily: 'inherit', opacity: iterInput.trim() ? 1 : 0.4 }}
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
              <button onClick={() => setRefImages(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '50%', width: 14, height: 14, color: 'var(--text-secondary)', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="glass-surface glass-floating" style={{ padding: '12px', margin: '0 8px 8px', borderRadius: 18, display: 'flex', gap: 10, flexShrink: 0, alignItems: 'flex-end' }}>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} title="Attach image reference" style={{ background: 'color-mix(in srgb, var(--bg-elevated) 80%, transparent)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0, lineHeight: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
        </button>
        <textarea
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder={hasKey ? 'Message Nucleus…' : 'Add API key in AI Settings'}
          disabled={!hasKey}
          rows={3}
          style={{ flex: 1, minHeight: 76, maxHeight: 180, resize: 'vertical', background: 'color-mix(in srgb, var(--bg-surface) 86%, transparent)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', color: 'var(--text-primary)', fontSize: '0.86rem', lineHeight: 1.55, outline: 'none', fontFamily: 'inherit', opacity: hasKey ? 1 : 0.5 }}
        />
        <button onClick={send} disabled={loading || !input.trim() || !hasKey} style={{
          background: 'var(--accent)', border: 'none', borderRadius: 14, padding: '12px 13px',
          color: '#fff', cursor: 'pointer', opacity: loading || !input.trim() || !hasKey ? 0.35 : 1,
          flexShrink: 0, transition: 'opacity 0.15s', lineHeight: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
    </SurfaceFrame>
  )
}
