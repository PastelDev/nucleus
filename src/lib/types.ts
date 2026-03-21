/* ── App sections ── */
export type Section = 'today' | 'notes' | 'whiteboard' | 'me' | 'calendar' | 'pomodoro'

/* ── Tasks ── */
export interface Task {
  id: string
  text: string
  done: boolean
  date: string // YYYY-MM-DD
}

/* ── Calendar events ── */
export interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  color: string
}

/* ── Notes ── */
export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
}

/* ── Whiteboard items ── */
export type WBItemType = 'sticky' | 'textbox' | 'shape' | 'path' | 'image'
export type ShapeType = 'rect' | 'circle' | 'arrow'

export interface WBItemBase {
  id: string
  type: WBItemType
}

export interface WBSticky extends WBItemBase {
  type: 'sticky'
  x: number; y: number; w: number; h: number
  content: string
  color: string
}

export interface WBTextbox extends WBItemBase {
  type: 'textbox'
  x: number; y: number; w: number; h: number
  content: string
  color: string
}

export interface WBShape extends WBItemBase {
  type: 'shape'
  shapeType: ShapeType
  x: number; y: number
  w?: number; h?: number
  x2?: number; y2?: number
  color: string
  fill?: string
}

export interface WBPath extends WBItemBase {
  type: 'path'
  d: string
  color: string
  sw: number
}

export interface WBImage extends WBItemBase {
  type: 'image'
  x: number; y: number; w: number; h: number
  src: string // relative path into assets/
  name: string
}

export type WBItem = WBSticky | WBTextbox | WBShape | WBPath | WBImage

/* ── Board (whiteboard or me sub-board) ── */
export interface Board {
  id: string
  name: string
  parentId?: string // for sub-boards
  items: WBItem[]
  createdAt: number
  updatedAt: number
}

export interface BoardIndex {
  boards: { id: string; name: string; parentId?: string }[]
}

/* ── Pomodoro ── */
export interface PomodoroSettings {
  work: number
  short: number
  long: number
}

/* ── AI config ── */
export interface AIConfig {
  apiKey: string
  model: string
  openaiKey: string
}

/* ── App state ── */
export interface AppState {
  tasks: Task[]
  events: CalendarEvent[]
  notes: Note[]
  pomSettings: PomodoroSettings
  aiConfig: AIConfig
  agentMd: string
  memoriesMd: string
}
