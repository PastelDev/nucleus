/* ── App sections ── */
export type Section = 'today' | 'notes' | 'boards' | 'memories' | 'calendar' | 'pomodoro' | 'settings' | 'ai-settings' | 'artefacts'

/* ── Board collections ── */
export type BoardScope = 'whiteboards' | 'me'
export type BoardCollection = 'boards' | 'personal'

/* ── Appearance surfaces ── */
export type SurfaceRole = 'appShell' | 'page' | 'panel' | 'popup'
export type SurfaceTargetId =
  | 'app-shell'
  | `page:${Section}`
  | `panel:${string}`
  | `popup:${string}`

export type BackgroundBlendMode = 'normal' | 'screen' | 'overlay' | 'soft-light' | 'lighten'
export type BackgroundAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
export type BackgroundMediaType = 'image' | 'video'
export type BackgroundMediaFit = 'cover' | 'contain'
export type BackgroundGradientStyle = 'theme-orbit' | 'theme-rings' | 'theme-mesh'
export type BackgroundSimulationEngine = 'starfield' | 'linked-particles' | 'game-of-life' | 'evolving-shapes'

export interface BackgroundPresetBase {
  id: string
  name: string
  kind: 'gradient' | 'simulation' | 'media' | 'artefact'
  opacity: number
  blur: number
  blendMode: BackgroundBlendMode
  builtin?: boolean
}

export interface GradientBackgroundPreset extends BackgroundPresetBase {
  kind: 'gradient'
  gradient: {
    style: BackgroundGradientStyle
    intensity: number
    motion: number
    softness: number
  }
}

export interface SimulationBackgroundPreset extends BackgroundPresetBase {
  kind: 'simulation'
  simulation: {
    engine: BackgroundSimulationEngine
    speed: number
    density: number
    detail: number
  }
}

export interface MediaBackgroundPreset extends BackgroundPresetBase {
  kind: 'media'
  media: {
    src: string
    mediaType: BackgroundMediaType
    fit: BackgroundMediaFit
    drift: number
    muted: boolean
    loop: boolean
    playbackRate: number
  }
}

export interface ArtefactBackgroundPreset extends BackgroundPresetBase {
  kind: 'artefact'
  artefact: {
    artefactId: string
    scale: number
    injectTheme: boolean
  }
}

export type BackgroundPreset =
  | GradientBackgroundPreset
  | SimulationBackgroundPreset
  | MediaBackgroundPreset
  | ArtefactBackgroundPreset

export interface BackgroundOrnament {
  id: string
  presetId: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  blur: number
  zIndex: number
  blendMode: BackgroundBlendMode
  anchor: BackgroundAnchor
  locked?: boolean
}

export interface BackgroundAssignment {
  presetId: string | null
  opacity: number
  blur: number
  ornaments: BackgroundOrnament[]
}

export interface GlassPreset {
  tint: number
  blur: number
  saturation: number
  border: number
  glow: number
  shadow: number
  specular: number
  noise: number
}

export interface GlassSettings {
  panel: GlassPreset
  floating: GlassPreset
  popup: GlassPreset
}

/* ── Tasks ── */
export interface Task {
  id: string
  text: string
  done: boolean
  date: string // YYYY-MM-DD
}

/* ── Calendar events ── */
export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'yearly'

export interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  color: string
  recurrence?: EventRecurrence
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
export type ShapeType = 'rect' | 'circle' | 'arrow' | 'line'

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

/* ── Artefacts ── */
export type ArtefactType = 'html' | 'react'

export interface Artefact {
  id: string
  title: string
  type: ArtefactType
  code: string
  createdAt: number
  updatedAt: number
}

/* ── Pomodoro ── */
export interface PomodoroSettings {
  work: number
  short: number
  long: number
  rounds: number
  bgType?: 'none' | 'starfield' | 'pixel-galaxy' | 'fractal' | 'evolving-shapes' | 'custom-image'
  bgParams?: Record<string, number>
  bgImageSrc?: string
}

/* ── Theme settings ── */
export interface ThemeDefinition {
  id: string
  name: string
  builtin?: boolean
  font: string
  fontHeading: string
  fontMono: string
  bgDeep: string
  bgSidebar: string
  bgSurface: string
  bgElevated: string
  bgInput: string
  boardBg: string
  boardGrid: string
  border: string
  borderSubtle: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textFaint: string
  textGhost: string
  accent: string
  accentLight: string
  green: string
  blue: string
  red: string
  orange: string
  pink: string
  surfaceDefaults: Record<SurfaceRole, BackgroundAssignment>
  glass: GlassSettings
}

export interface ThemeSettings {
  activeThemeId: string
  themes: ThemeDefinition[]
  backgroundPresets: BackgroundPreset[]
  surfaceOverrides: Record<string, BackgroundAssignment>
}

/* ── Memories ── */
export interface MemoryFileNode {
  path: string
  name: string
  content: string
  updatedAt: number
}

export interface MemoryDirectoryNode {
  path: string
  name: string
  files: MemoryFileNode[]
  directories: MemoryDirectoryNode[]
}

export interface MemoryTree {
  root: MemoryDirectoryNode
  overviewPath: string
  agentSummaryPath: string
}

/* ── AI config ── */
export interface AIConfig {
  apiKey: string
  model: string
  openaiKey: string
  permMode: 'allow' | 'ask' | 'custom'
  permCustom: Record<string, true>  // tool names auto-allowed in custom mode
}

/* ── App state ── */
export interface AppState {
  tasks: Task[]
  events: CalendarEvent[]
  notes: Note[]
  pomSettings: PomodoroSettings
  themeSettings: ThemeSettings
  aiConfig: AIConfig
  agentMd: string
  memoriesMd: string
}
