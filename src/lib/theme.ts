import type { ThemeDefinition, ThemeSettings } from './types'

const DEFAULT_THEME: ThemeDefinition = {
  id: 'nucleus-midnight',
  name: 'Midnight Bloom',
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
}

const BUILTIN_THEMES: ThemeDefinition[] = [
  DEFAULT_THEME,
  {
    id: 'sunwash',
    name: 'Sunwash',
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
  },
  {
    id: 'graphite',
    name: 'Graphite Signal',
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
  },
]

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

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
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, '0')).join('')}`
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

function normalizeTheme(theme: Partial<ThemeDefinition>, fallbackId: string, fallbackName: string): ThemeDefinition {
  return {
    ...DEFAULT_THEME,
    ...theme,
    id: theme.id?.trim() || fallbackId,
    name: theme.name?.trim() || fallbackName,
  }
}

export function createDefaultThemeSettings(): ThemeSettings {
  return {
    activeThemeId: BUILTIN_THEMES[0].id,
    themes: BUILTIN_THEMES.map((theme) => ({ ...theme })),
  }
}

export function normalizeThemeSettings(raw?: Partial<ThemeSettings> | null): ThemeSettings {
  if (!raw?.themes?.length) {
    return createDefaultThemeSettings()
  }

  const themes = raw.themes.map((theme, index) =>
    normalizeTheme(theme, theme.id || `theme-${index + 1}`, theme.name || `Theme ${index + 1}`),
  )
  const activeThemeId = themes.some((theme) => theme.id === raw.activeThemeId)
    ? (raw.activeThemeId as string)
    : themes[0].id

  return { activeThemeId, themes }
}

export function getActiveTheme(settings: ThemeSettings): ThemeDefinition {
  return settings.themes.find((theme) => theme.id === settings.activeThemeId) ?? settings.themes[0] ?? { ...DEFAULT_THEME }
}

export function getThemeCssVariables(theme: ThemeDefinition): Record<string, string> {
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
  }
}

export function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement
  const vars = getThemeCssVariables(theme)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}
