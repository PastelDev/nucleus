import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type {
  Artefact,
  BackgroundAssignment,
  BackgroundPreset,
  SurfaceRole,
  ThemeSettings,
} from '../lib/types'
import {
  findBackgroundPreset,
  getActiveTheme,
  getSurfaceRole,
  resolveSurfaceAssignment,
} from '../lib/theme'

interface BackgroundPreview {
  previewId: string
  targetId: string
  role: SurfaceRole
  assignment: BackgroundAssignment
  preset?: BackgroundPreset | null
}

interface AppearanceContextValue {
  themeSettings: ThemeSettings
  setThemeSettings: Dispatch<SetStateAction<ThemeSettings>>
  artefacts: Artefact[]
  activeTheme: ReturnType<typeof getActiveTheme>
  preview: BackgroundPreview | null
  resolveAssignment: (targetId: string, role?: SurfaceRole) => BackgroundAssignment
  findPreset: (presetId: string | null | undefined) => BackgroundPreset | null
  upsertPreset: (preset: BackgroundPreset) => void
  updatePreset: (presetId: string, patch: Partial<BackgroundPreset>) => void
  assignSurface: (targetId: string, assignment: BackgroundAssignment) => void
  resetSurfaceOverride: (targetId: string) => void
  previewSurface: (draft: BackgroundPreview) => void
  clearPreview: () => void
  savePreview: (nextName?: string) => BackgroundPreview | null
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

interface Props {
  themeSettings: ThemeSettings
  setThemeSettings: Dispatch<SetStateAction<ThemeSettings>>
  artefacts: Artefact[]
  children: ReactNode
}

export function AppearanceProvider({ themeSettings, setThemeSettings, artefacts, children }: Props) {
  const [preview, setPreview] = useState<BackgroundPreview | null>(null)
  const activeTheme = useMemo(() => getActiveTheme(themeSettings), [themeSettings])

  const findPreset = useCallback((presetId: string | null | undefined) => {
    if (!presetId) return null
    if (preview?.preset?.id === presetId) return preview.preset
    return findBackgroundPreset(themeSettings, presetId)
  }, [preview?.preset, themeSettings])

  const resolveAssignmentForTarget = useCallback((targetId: string, role?: SurfaceRole) => {
    if (preview && preview.targetId === targetId) return preview.assignment
    return resolveSurfaceAssignment(themeSettings, targetId, role ?? getSurfaceRole(targetId))
  }, [preview, themeSettings])

  const upsertPreset = useCallback((preset: BackgroundPreset) => {
    setThemeSettings((current) => {
      const exists = current.backgroundPresets.some((entry) => entry.id === preset.id)
      return {
        ...current,
        backgroundPresets: exists
          ? current.backgroundPresets.map((entry) => (entry.id === preset.id ? { ...entry, ...preset } : entry))
          : [...current.backgroundPresets, preset],
      }
    })
  }, [setThemeSettings])

  const updatePreset = useCallback((presetId: string, patch: Partial<BackgroundPreset>) => {
    if (preview?.preset?.id === presetId) {
      setPreview((current) => current?.preset?.id === presetId
        ? { ...current, preset: { ...current.preset, ...patch } as BackgroundPreset }
        : current)
    }
    setThemeSettings((current) => ({
      ...current,
      backgroundPresets: current.backgroundPresets.map((entry) => (entry.id === presetId ? { ...entry, ...patch } as BackgroundPreset : entry)),
    }))
  }, [preview?.preset?.id, setThemeSettings])

  const assignSurface = useCallback((targetId: string, assignment: BackgroundAssignment) => {
    setThemeSettings((current) => ({
      ...current,
      surfaceOverrides: {
        ...current.surfaceOverrides,
        [targetId]: {
          ...assignment,
          ornaments: assignment.ornaments.map((ornament) => ({ ...ornament })),
        },
      },
    }))
  }, [setThemeSettings])

  const resetSurfaceOverride = useCallback((targetId: string) => {
    setThemeSettings((current) => {
      const nextOverrides = { ...current.surfaceOverrides }
      delete nextOverrides[targetId]
      return { ...current, surfaceOverrides: nextOverrides }
    })
  }, [setThemeSettings])

  const previewSurface = useCallback((draft: BackgroundPreview) => {
    setPreview({
      ...draft,
      assignment: {
        ...draft.assignment,
        ornaments: draft.assignment.ornaments.map((ornament) => ({ ...ornament })),
      },
      preset: draft.preset ? { ...draft.preset } : draft.preset,
    })
  }, [])

  const clearPreview = useCallback(() => setPreview(null), [])

  const savePreview = useCallback((nextName?: string) => {
    if (!preview) return null
    const saved = {
      ...preview,
      preset: preview.preset
        ? {
            ...preview.preset,
            name: nextName?.trim() || preview.preset.name,
          }
        : preview.preset,
    }

    if (saved.preset) upsertPreset(saved.preset)
    assignSurface(saved.targetId, {
      ...saved.assignment,
      presetId: saved.preset?.id ?? saved.assignment.presetId,
    })
    setPreview(null)
    return saved
  }, [assignSurface, preview, upsertPreset])

  const value = useMemo<AppearanceContextValue>(() => ({
    themeSettings,
    setThemeSettings,
    artefacts,
    activeTheme,
    preview,
    resolveAssignment: resolveAssignmentForTarget,
    findPreset,
    upsertPreset,
    updatePreset,
    assignSurface,
    resetSurfaceOverride,
    previewSurface,
    clearPreview,
    savePreview,
  }), [
    activeTheme,
    artefacts,
    assignSurface,
    clearPreview,
    findPreset,
    preview,
    previewSurface,
    resolveAssignmentForTarget,
    resetSurfaceOverride,
    savePreview,
    setThemeSettings,
    themeSettings,
    updatePreset,
    upsertPreset,
  ])

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider')
  return value
}
