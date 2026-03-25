import type {
  BackgroundAssignment,
  BackgroundPreset,
  GlassPreset,
  GlassSettings,
  PomodoroSettings,
  Section,
  SurfaceRole,
  SurfaceTargetId,
  ThemeDefinition,
  ThemeSettings,
} from './types'

type SurfaceTargetOption = {
  id: SurfaceTargetId
  label: string
  role: SurfaceRole
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const clamp255 = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

const DEFAULT_ASSIGNMENT: BackgroundAssignment = {
  presetId: null,
  opacity: 1,
  blur: 0,
  ornaments: [],
}

const DEFAULT_GLASS: GlassSettings = {
  panel: {
    tint: 0.22,
    blur: 18,
    saturation: 1.35,
    border: 0.11,
    glow: 0.1,
    shadow: 0.2,
    specular: 0.08,
    noise: 0.04,
  },
  floating: {
    tint: 0.34,
    blur: 24,
    saturation: 1.5,
    border: 0.14,
    glow: 0.16,
    shadow: 0.26,
    specular: 0.1,
    noise: 0.05,
  },
  popup: {
    tint: 0.58,
    blur: 30,
    saturation: 1.7,
    border: 0.22,
    glow: 0.24,
    shadow: 0.38,
    specular: 0.16,
    noise: 0.08,
  },
}

const BUILTIN_PRESETS: BackgroundPreset[] = [
  {
    id: 'bg-theme-orbit',
    name: 'Theme Orbit',
    builtin: true,
    kind: 'gradient',
    opacity: 1,
    blur: 0,
    blendMode: 'normal',
    gradient: { style: 'theme-orbit', intensity: 0.72, motion: 0.7, softness: 0.7 },
  },
  {
    id: 'bg-theme-rings',
    name: 'Theme Rings',
    builtin: true,
    kind: 'gradient',
    opacity: 1,
    blur: 0,
    blendMode: 'screen',
    gradient: { style: 'theme-rings', intensity: 0.68, motion: 0.42, softness: 0.8 },
  },
  {
    id: 'bg-theme-mesh',
    name: 'Theme Mesh',
    builtin: true,
    kind: 'gradient',
    opacity: 1,
    blur: 0,
    blendMode: 'normal',
    gradient: { style: 'theme-mesh', intensity: 0.8, motion: 0.52, softness: 0.76 },
  },
  {
    id: 'bg-sim-starfield',
    name: 'Starfield',
    builtin: true,
    kind: 'simulation',
    opacity: 0.92,
    blur: 0,
    blendMode: 'screen',
    simulation: { engine: 'starfield', speed: 0.4, density: 140, detail: 0.5 },
  },
  {
    id: 'bg-sim-linked-particles',
    name: 'Linked Particles',
    builtin: true,
    kind: 'simulation',
    opacity: 0.78,
    blur: 0,
    blendMode: 'screen',
    simulation: { engine: 'linked-particles', speed: 0.42, density: 54, detail: 0.58 },
  },
  {
    id: 'bg-sim-game-of-life',
    name: 'Game Of Life',
    builtin: true,
    kind: 'simulation',
    opacity: 0.6,
    blur: 0,
    blendMode: 'soft-light',
    simulation: { engine: 'game-of-life', speed: 0.34, density: 42, detail: 0.44 },
  },
  {
    id: 'bg-sim-evolving-shapes',
    name: 'Evolving Shapes',
    builtin: true,
    kind: 'simulation',
    opacity: 0.74,
    blur: 0,
    blendMode: 'screen',
    simulation: { engine: 'evolving-shapes', speed: 0.5, density: 18, detail: 0.52 },
  },
]

const DEFAULT_SURFACE_DEFAULTS: Record<SurfaceRole, BackgroundAssignment> = {
  appShell: { presetId: 'bg-theme-orbit', opacity: 1, blur: 0, ornaments: [] },
  page: { presetId: 'bg-theme-mesh', opacity: 0.78, blur: 0, ornaments: [] },
  panel: { presetId: 'bg-theme-rings', opacity: 0.46, blur: 8, ornaments: [] },
  popup: { presetId: 'bg-theme-rings', opacity: 0.62, blur: 10, ornaments: [] },
}

export const FONT_PRESETS = [
  {
    id: 'modern',
    label: 'Modern',
    font: "'Segoe UI', 'Trebuchet MS', sans-serif",
    fontHeading: "'Aptos Display', 'Segoe UI', sans-serif",
    fontMono: "'Cascadia Code', 'Courier New', monospace",
  },
  {
    id: 'editorial',
    label: 'Editorial',
    font: "'Aptos', 'Segoe UI', sans-serif",
    fontHeading: "'Georgia', 'Times New Roman', serif",
    fontMono: "'Consolas', 'Courier New', monospace",
  },
  {
    id: 'technical',
    label: 'Technical',
    font: "'Bahnschrift', 'Segoe UI', sans-serif",
    fontHeading: "'Bahnschrift', 'Segoe UI', sans-serif",
    fontMono: "'JetBrains Mono', 'Consolas', monospace",
  },
]

export const SURFACE_TARGET_OPTIONS: SurfaceTargetOption[] = [
  { id: 'app-shell', label: 'App Shell', role: 'appShell' },
  { id: 'page:today', label: 'Today Page', role: 'page' },
  { id: 'page:notes', label: 'Notes Page', role: 'page' },
  { id: 'page:boards', label: 'Boards Page', role: 'page' },
  { id: 'page:memories', label: 'Memories Page', role: 'page' },
  { id: 'page:calendar', label: 'Calendar Page', role: 'page' },
  { id: 'page:pomodoro', label: 'Focus Page', role: 'page' },
  { id: 'page:artefacts', label: 'Artefacts Page', role: 'page' },
  { id: 'page:settings', label: 'Appearance Page', role: 'page' },
  { id: 'page:ai-settings', label: 'AI Settings Page', role: 'page' },
  { id: 'panel:sidebar', label: 'Sidebar Panel', role: 'panel' },
  { id: 'panel:notes-sidebar', label: 'Notes Sidebar Panel', role: 'panel' },
  { id: 'panel:memories-browser', label: 'Memories Browser Panel', role: 'panel' },
  { id: 'panel:ai-chat', label: 'AI Chat Panel', role: 'panel' },
  { id: 'panel:calendar-detail', label: 'Calendar Detail Panel', role: 'panel' },
  { id: 'panel:whiteboard-sidebar', label: 'Board Sidebar Panel', role: 'panel' },
  { id: 'panel:artefacts-sidebar', label: 'Artefacts Sidebar Panel', role: 'panel' },
  { id: 'popup:pomodoro-settings', label: 'Focus Settings Popup', role: 'popup' },
]

const DEFAULT_THEME: ThemeDefinition = {
  id: 'nucleus-midnight',
  name: 'Midnight Bloom',
  builtin: true,
  font: "'Segoe UI', 'Trebuchet MS', sans-serif",
  fontHeading: "'Aptos Display', 'Segoe UI', sans-serif",
  fontMono: "'Cascadia Code', 'Courier New', monospace",
  bgDeep: '#0a0a12',
  bgSidebar: '#07070e',
  bgSurface: '#10101c',
  bgElevated: '#151523',
  bgInput: '#0d0d18',
  boardBg: '#0a0a12',
  boardGrid: '#1b1b2b',
  border: '#1c1c2c',
  borderSubtle: '#151525',
  textPrimary: '#f0effa',
  textSecondary: '#c7c6dd',
  textMuted: '#676784',
  textFaint: '#434360',
  textGhost: '#242438',
  accent: '#7c3aed',
  accentLight: '#b49af8',
  green: '#059669',
  blue: '#2563eb',
  red: '#dc2626',
  orange: '#d97706',
  pink: '#db2777',
  surfaceDefaults: cloneSurfaceDefaults(DEFAULT_SURFACE_DEFAULTS),
  glass: cloneGlassSettings(DEFAULT_GLASS),
}

const BUILTIN_THEMES: ThemeDefinition[] = [
  DEFAULT_THEME,
  {
    id: 'sunwash',
    name: 'Sunwash',
    builtin: true,
    font: "'Segoe UI', 'Helvetica Neue', sans-serif",
    fontHeading: "'Georgia', 'Times New Roman', serif",
    fontMono: "'Consolas', 'Courier New', monospace",
    bgDeep: '#f3eadf',
    bgSidebar: '#eadbc8',
    bgSurface: '#fff7ee',
    bgElevated: '#f7ecdf',
    bgInput: '#fff4e9',
    boardBg: '#fbf3e9',
    boardGrid: '#dbc8ad',
    border: '#d9c2a1',
    borderSubtle: '#e5d1b7',
    textPrimary: '#2c2117',
    textSecondary: '#5b4433',
    textMuted: '#8a705a',
    textFaint: '#b1967e',
    textGhost: '#d9c8ba',
    accent: '#b85c38',
    accentLight: '#d77e5a',
    green: '#4f7a52',
    blue: '#4976a8',
    red: '#b24747',
    orange: '#c68a2d',
    pink: '#b8577b',
    surfaceDefaults: cloneSurfaceDefaults(DEFAULT_SURFACE_DEFAULTS),
    glass: cloneGlassSettings(DEFAULT_GLASS),
  },
  {
    id: 'graphite',
    name: 'Graphite Signal',
    builtin: true,
    font: "'Aptos', 'Segoe UI', sans-serif",
    fontHeading: "'Bahnschrift', 'Segoe UI', sans-serif",
    fontMono: "'JetBrains Mono', 'Consolas', monospace",
    bgDeep: '#121416',
    bgSidebar: '#0e1011',
    bgSurface: '#181c1f',
    bgElevated: '#1d2226',
    bgInput: '#15181b',
    boardBg: '#111416',
    boardGrid: '#263039',
    border: '#263039',
    borderSubtle: '#1d252c',
    textPrimary: '#eef3f5',
    textSecondary: '#c0d0d8',
    textMuted: '#7b8c95',
    textFaint: '#54636c',
    textGhost: '#2d3740',
    accent: '#0ea5a4',
    accentLight: '#68d6d5',
    green: '#10b981',
    blue: '#3b82f6',
    red: '#ef4444',
    orange: '#f59e0b',
    pink: '#ec4899',
    surfaceDefaults: cloneSurfaceDefaults(DEFAULT_SURFACE_DEFAULTS),
    glass: cloneGlassSettings(DEFAULT_GLASS),
  },
]

function normalizeHex(hex: string): string {
  const trimmed = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
  }
  return '#000000'
}

function hexToRgb(hex: string) {
  const safe = normalizeHex(hex)
  return {
    r: Number.parseInt(safe.slice(1, 3), 16),
    g: Number.parseInt(safe.slice(3, 5), 16),
    b: Number.parseInt(safe.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => clamp255(value).toString(16).padStart(2, '0')).join('')}`
}

function mixColor(from: string, to: string, ratio: number) {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const inv = 1 - ratio
  return rgbToHex(a.r * inv + b.r * ratio, a.g * inv + b.g * ratio, a.b * inv + b.b * ratio)
}

function alpha(color: string, opacity: number) {
  const { r, g, b } = hexToRgb(color)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

function normalizeAssignment(raw?: Partial<BackgroundAssignment> | null): BackgroundAssignment {
  return {
    presetId: raw?.presetId ?? DEFAULT_ASSIGNMENT.presetId,
    opacity: clamp(raw?.opacity ?? DEFAULT_ASSIGNMENT.opacity, 0, 1),
    blur: Math.max(0, raw?.blur ?? DEFAULT_ASSIGNMENT.blur),
    ornaments: Array.isArray(raw?.ornaments) ? raw!.ornaments.map((ornament) => ({
      id: ornament.id || `ornament-${Math.random().toString(36).slice(2, 8)}`,
      presetId: ornament.presetId,
      x: clamp(ornament.x ?? 50, -100, 100),
      y: clamp(ornament.y ?? 50, -100, 100),
      w: clamp(ornament.w ?? 28, 4, 100),
      h: clamp(ornament.h ?? 28, 4, 100),
      rotation: ornament.rotation ?? 0,
      opacity: clamp(ornament.opacity ?? 0.9, 0, 1),
      blur: Math.max(0, ornament.blur ?? 0),
      zIndex: ornament.zIndex ?? 1,
      blendMode: ornament.blendMode ?? 'normal',
      anchor: ornament.anchor ?? 'top-left',
      locked: ornament.locked ?? false,
    })) : [],
  }
}

function cloneSurfaceDefaults(defaults: Record<SurfaceRole, BackgroundAssignment>) {
  return {
    appShell: normalizeAssignment(defaults.appShell),
    page: normalizeAssignment(defaults.page),
    panel: normalizeAssignment(defaults.panel),
    popup: normalizeAssignment(defaults.popup),
  }
}

function normalizeGlassPreset(raw?: Partial<GlassPreset> | null, fallback: GlassPreset = DEFAULT_GLASS.panel): GlassPreset {
  return {
    tint: clamp(raw?.tint ?? fallback.tint, 0, 1),
    blur: Math.max(0, raw?.blur ?? fallback.blur),
    saturation: clamp(raw?.saturation ?? fallback.saturation, 1, 2.5),
    border: clamp(raw?.border ?? fallback.border, 0, 1),
    glow: clamp(raw?.glow ?? fallback.glow, 0, 1),
    shadow: clamp(raw?.shadow ?? fallback.shadow, 0, 1),
    specular: clamp(raw?.specular ?? fallback.specular, 0, 1),
    noise: clamp(raw?.noise ?? fallback.noise, 0, 1),
  }
}

function cloneGlassSettings(glass: GlassSettings): GlassSettings {
  return {
    panel: normalizeGlassPreset(glass.panel, DEFAULT_GLASS.panel),
    floating: normalizeGlassPreset(glass.floating, DEFAULT_GLASS.floating),
    popup: normalizeGlassPreset(glass.popup, DEFAULT_GLASS.popup),
  }
}

function normalizeBackgroundPreset(raw: BackgroundPreset): BackgroundPreset {
  const presetId = raw.id?.trim() || `preset-${Math.random().toString(36).slice(2, 8)}`
  const base = {
    id: presetId,
    name: raw.name?.trim() || 'Untitled Background',
    opacity: clamp(raw.opacity ?? 1, 0, 1),
    blur: Math.max(0, raw.blur ?? 0),
    blendMode: raw.blendMode ?? 'normal',
    builtin: isBuiltinPresetId(presetId),
  }

  if (raw.kind === 'gradient') {
    return {
      ...base,
      kind: 'gradient',
      gradient: {
        style: raw.gradient?.style ?? 'theme-orbit',
        intensity: clamp(raw.gradient?.intensity ?? 0.7, 0, 1.4),
        motion: clamp(raw.gradient?.motion ?? 0.5, 0, 1.4),
        softness: clamp(raw.gradient?.softness ?? 0.7, 0, 1.4),
      },
    }
  }

  if (raw.kind === 'simulation') {
    return {
      ...base,
      kind: 'simulation',
      simulation: {
        engine: raw.simulation?.engine ?? 'starfield',
        speed: clamp(raw.simulation?.speed ?? 0.5, 0.05, 2),
        density: clamp(raw.simulation?.density ?? 80, 4, 320),
        detail: clamp(raw.simulation?.detail ?? 0.5, 0.05, 1.5),
      },
    }
  }

  if (raw.kind === 'media') {
    return {
      ...base,
      kind: 'media',
      media: {
        src: raw.media?.src ?? '',
        mediaType: raw.media?.mediaType ?? 'image',
        fit: raw.media?.fit ?? 'cover',
        drift: clamp(raw.media?.drift ?? 0, 0, 2),
        muted: raw.media?.muted ?? true,
        loop: raw.media?.loop ?? true,
        playbackRate: clamp(raw.media?.playbackRate ?? 1, 0.1, 3),
      },
    }
  }

  return {
    ...base,
    kind: 'artefact',
    artefact: {
      artefactId: raw.artefact?.artefactId ?? '',
      scale: clamp(raw.artefact?.scale ?? 1, 0.25, 2.5),
      injectTheme: raw.artefact?.injectTheme ?? true,
    },
  }
}

function normalizeTheme(theme: Partial<ThemeDefinition>, fallbackId: string, fallbackName: string): ThemeDefinition {
  const themeId = theme.id?.trim() || fallbackId
  return {
    ...DEFAULT_THEME,
    ...theme,
    id: themeId,
    name: theme.name?.trim() || fallbackName,
    builtin: isBuiltinThemeId(themeId),
    surfaceDefaults: cloneSurfaceDefaults({
      ...DEFAULT_SURFACE_DEFAULTS,
      ...theme.surfaceDefaults,
    } as Record<SurfaceRole, BackgroundAssignment>),
    glass: {
      panel: normalizeGlassPreset(theme.glass?.panel ?? DEFAULT_GLASS.panel, DEFAULT_GLASS.panel),
      floating: normalizeGlassPreset(theme.glass?.floating ?? DEFAULT_GLASS.floating, DEFAULT_GLASS.floating),
      popup: normalizeGlassPreset(theme.glass?.popup ?? DEFAULT_GLASS.popup, DEFAULT_GLASS.popup),
    },
  }
}

function normalizeSurfaceOverrides(raw?: Record<string, BackgroundAssignment> | null) {
  const next: Record<string, BackgroundAssignment> = {}
  for (const [key, assignment] of Object.entries(raw ?? {})) {
    const mappedKey = key === 'page:whiteboard'
      ? 'page:boards'
      : key === 'page:me'
        ? 'page:memories'
        : key
    next[mappedKey] = normalizeAssignment(assignment)
  }
  return next
}

function getLegacySurfaceTarget(section: Section): SurfaceTargetId {
  return `page:${section}`
}

function ensurePreset(settings: ThemeSettings, preset: BackgroundPreset) {
  const existing = settings.backgroundPresets.some((entry) => entry.id === preset.id)
  if (existing) return settings
  return {
    ...settings,
    backgroundPresets: [...settings.backgroundPresets, normalizeBackgroundPreset(preset)],
  }
}

export function createDefaultThemeSettings(): ThemeSettings {
  return {
    activeThemeId: BUILTIN_THEMES[0].id,
    themes: BUILTIN_THEMES.map((theme) => normalizeTheme(theme, theme.id, theme.name)),
    backgroundPresets: BUILTIN_PRESETS.map((preset) => normalizeBackgroundPreset(preset)),
    surfaceOverrides: {},
  }
}

export function normalizeThemeSettings(raw?: Partial<ThemeSettings> | null): ThemeSettings {
  const defaults = createDefaultThemeSettings()
  const rawThemes = raw?.themes?.length ? raw.themes : defaults.themes
  const themes = rawThemes.map((theme, index) =>
    normalizeTheme(theme, theme.id || `theme-${index + 1}`, theme.name || `Theme ${index + 1}`),
  )
  const activeThemeId = themes.some((theme) => theme.id === raw?.activeThemeId)
    ? (raw?.activeThemeId as string)
    : themes[0].id

  const presetMap = new Map<string, BackgroundPreset>()
  for (const preset of defaults.backgroundPresets) presetMap.set(preset.id, normalizeBackgroundPreset(preset))
  for (const preset of raw?.backgroundPresets ?? []) presetMap.set(preset.id, normalizeBackgroundPreset(preset as BackgroundPreset))

  return {
    activeThemeId,
    themes,
    backgroundPresets: [...presetMap.values()],
    surfaceOverrides: normalizeSurfaceOverrides(raw?.surfaceOverrides),
  }
}

export function getActiveTheme(settings: ThemeSettings): ThemeDefinition {
  return settings.themes.find((theme) => theme.id === settings.activeThemeId) ?? settings.themes[0] ?? { ...DEFAULT_THEME }
}

export function isBuiltinThemeId(themeId: string | undefined) {
  return BUILTIN_THEMES.some((theme) => theme.id === themeId)
}

export function isBuiltinPresetId(presetId: string | undefined) {
  return BUILTIN_PRESETS.some((preset) => preset.id === presetId)
}

export function createBlankCustomTheme(id: string, name: string): ThemeDefinition {
  return normalizeTheme(
    {
      ...DEFAULT_THEME,
      id,
      name,
      builtin: false,
    },
    id,
    name,
  )
}

export function getBuiltinTheme(themeId: string) {
  const theme = BUILTIN_THEMES.find((entry) => entry.id === themeId)
  return theme ? normalizeTheme(theme, theme.id, theme.name) : null
}

export function getBuiltinPreset(presetId: string) {
  const preset = BUILTIN_PRESETS.find((entry) => entry.id === presetId)
  return preset ? normalizeBackgroundPreset(preset) : null
}

export function getSurfaceTargetLabel(targetId: string) {
  return SURFACE_TARGET_OPTIONS.find((entry) => entry.id === targetId)?.label ?? targetId
}

export function getSurfaceRole(targetId: string): SurfaceRole {
  return SURFACE_TARGET_OPTIONS.find((entry) => entry.id === targetId)?.role
    ?? (targetId === 'app-shell'
      ? 'appShell'
      : targetId.startsWith('popup:')
        ? 'popup'
        : targetId.startsWith('panel:')
          ? 'panel'
          : 'page')
}

export function resolveSurfaceAssignment(settings: ThemeSettings, targetId: string, role = getSurfaceRole(targetId)): BackgroundAssignment {
  const override = settings.surfaceOverrides[targetId]
  if (override) return normalizeAssignment(override)
  const activeTheme = getActiveTheme(settings)
  return normalizeAssignment(activeTheme.surfaceDefaults[role])
}

export function findBackgroundPreset(settings: ThemeSettings, presetId: string | null | undefined) {
  if (!presetId) return null
  return settings.backgroundPresets.find((preset) => preset.id === presetId) ?? null
}

export function migrateLegacyPomodoroBackground(themeSettings: ThemeSettings, pomodoro: Partial<PomodoroSettings>) {
  const hadLegacy = !!(pomodoro.bgType || pomodoro.bgImageSrc || (pomodoro.bgParams && Object.keys(pomodoro.bgParams).length))
  if (!hadLegacy) return { themeSettings, pomodoroSettings: pomodoro, didMigrate: false }

  let nextSettings = { ...themeSettings, backgroundPresets: [...themeSettings.backgroundPresets], surfaceOverrides: { ...themeSettings.surfaceOverrides } }
  const speed = pomodoro.bgParams?.speed ?? 0.45
  const density = pomodoro.bgParams?.density ?? 80
  let presetId: string | null = null

  switch (pomodoro.bgType) {
    case 'none':
      presetId = null
      break
    case 'starfield':
      presetId = 'legacy-pomodoro-starfield'
      nextSettings = ensurePreset(nextSettings, {
        id: presetId,
        name: 'Migrated Focus Starfield',
        kind: 'simulation',
        opacity: 0.92,
        blur: 0,
        blendMode: 'screen',
        simulation: { engine: 'starfield', speed, density, detail: 0.5 },
      })
      break
    case 'evolving-shapes':
      presetId = 'legacy-pomodoro-shapes'
      nextSettings = ensurePreset(nextSettings, {
        id: presetId,
        name: 'Migrated Focus Shapes',
        kind: 'simulation',
        opacity: 0.8,
        blur: 0,
        blendMode: 'screen',
        simulation: { engine: 'evolving-shapes', speed, density: Math.max(8, density / 12), detail: 0.52 },
      })
      break
    case 'pixel-galaxy':
      presetId = 'legacy-pomodoro-galaxy'
      nextSettings = ensurePreset(nextSettings, {
        id: presetId,
        name: 'Migrated Focus Particles',
        kind: 'simulation',
        opacity: 0.82,
        blur: 0,
        blendMode: 'screen',
        simulation: { engine: 'linked-particles', speed, density: Math.max(16, density / 4), detail: 0.58 },
      })
      break
    case 'fractal':
      presetId = 'legacy-pomodoro-fractal'
      nextSettings = ensurePreset(nextSettings, {
        id: presetId,
        name: 'Migrated Focus Rings',
        kind: 'gradient',
        opacity: 0.82,
        blur: 0,
        blendMode: 'screen',
        gradient: { style: 'theme-rings', intensity: 0.8, motion: speed, softness: 0.82 },
      })
      break
    case 'custom-image':
      if (pomodoro.bgImageSrc) {
        presetId = 'legacy-pomodoro-media'
        const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(pomodoro.bgImageSrc)
        nextSettings = ensurePreset(nextSettings, {
          id: presetId,
          name: 'Migrated Focus Media',
          kind: 'media',
          opacity: 0.82,
          blur: 0,
          blendMode: 'normal',
          media: {
            src: pomodoro.bgImageSrc,
            mediaType: isVideo ? 'video' : 'image',
            fit: 'cover',
            drift: 0.1,
            muted: true,
            loop: true,
            playbackRate: 1,
          },
        })
      }
      break
    default:
      presetId = null
  }

  nextSettings.surfaceOverrides[getLegacySurfaceTarget('pomodoro')] = normalizeAssignment({
    presetId,
    opacity: 1,
    blur: 0,
    ornaments: [],
  })

  const { bgType: _bgType, bgParams: _bgParams, bgImageSrc: _bgImageSrc, ...cleanPomodoro } = pomodoro
  return {
    themeSettings: nextSettings,
    pomodoroSettings: cleanPomodoro,
    didMigrate: true,
  }
}

export function getThemeCssVariables(theme: ThemeDefinition): Record<string, string> {
  const panelGlass = theme.glass.panel
  const floatingGlass = theme.glass.floating
  const popupGlass = theme.glass.popup
  const glassBase = mixColor(theme.bgSurface, theme.accent, 0.12)
  const popupBase = mixColor(theme.bgSurface, theme.accent, 0.32)
  const floatingBase = mixColor(theme.bgSurface, theme.accent, 0.16)

  return {
    '--bg-deep': theme.bgDeep,
    '--bg-sidebar': theme.bgSidebar,
    '--bg-surface': theme.bgSurface,
    '--bg-elevated': theme.bgElevated,
    '--bg-input': theme.bgInput,
    '--board-bg': theme.boardBg,
    '--board-grid': theme.boardGrid,
    '--border': theme.border,
    '--border-subtle': theme.borderSubtle,
    '--border-focus': mixColor(theme.accent, theme.bgDeep, 0.45),
    '--text-primary': theme.textPrimary,
    '--text-secondary': theme.textSecondary,
    '--text-muted': theme.textMuted,
    '--text-faint': theme.textFaint,
    '--text-ghost': theme.textGhost,
    '--accent': theme.accent,
    '--accent-light': theme.accentLight,
    '--accent-surface': mixColor(theme.accent, theme.bgDeep, 0.78),
    '--accent-glow': alpha(theme.accent, 0.28),
    '--green': theme.green,
    '--blue': theme.blue,
    '--red': theme.red,
    '--orange': theme.orange,
    '--pink': theme.pink,
    '--font': theme.font,
    '--font-heading': theme.fontHeading,
    '--font-mono': theme.fontMono,
    '--glass-panel-bg': alpha(glassBase, panelGlass.tint),
    '--glass-panel-border': alpha(theme.textPrimary, panelGlass.border),
    '--glass-panel-shadow': alpha(theme.bgDeep, panelGlass.shadow),
    '--glass-panel-glow': alpha(theme.accent, panelGlass.glow),
    '--glass-panel-specular': alpha('#ffffff', panelGlass.specular),
    '--glass-panel-noise': alpha(theme.textPrimary, panelGlass.noise),
    '--glass-panel-blur': `${panelGlass.blur}px`,
    '--glass-panel-saturate': `${panelGlass.saturation}`,
    '--glass-floating-bg': alpha(floatingBase, floatingGlass.tint),
    '--glass-floating-border': alpha(theme.textPrimary, floatingGlass.border),
    '--glass-floating-shadow': alpha(theme.bgDeep, floatingGlass.shadow),
    '--glass-floating-glow': alpha(theme.accent, floatingGlass.glow),
    '--glass-floating-specular': alpha('#ffffff', floatingGlass.specular),
    '--glass-floating-noise': alpha(theme.textPrimary, floatingGlass.noise),
    '--glass-floating-blur': `${floatingGlass.blur}px`,
    '--glass-floating-saturate': `${floatingGlass.saturation}`,
    '--glass-popup-bg': alpha(popupBase, Math.max(0.58, popupGlass.tint)),
    '--glass-popup-border': alpha(theme.textPrimary, popupGlass.border),
    '--glass-popup-shadow': alpha(theme.bgDeep, popupGlass.shadow),
    '--glass-popup-glow': alpha(theme.accent, popupGlass.glow),
    '--glass-popup-specular': alpha('#ffffff', popupGlass.specular),
    '--glass-popup-noise': alpha(theme.textPrimary, popupGlass.noise),
    '--glass-popup-blur': `${popupGlass.blur}px`,
    '--glass-popup-saturate': `${popupGlass.saturation}`,
    '--z-background': '0',
    '--z-content': '1',
    '--z-floating': '30',
    '--z-popover': '60',
    '--z-modal': '90',
  }
}

export function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement
  const vars = getThemeCssVariables(theme)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}
