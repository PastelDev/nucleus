import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import type {
  BackgroundAssignment,
  BackgroundOrnament,
  BackgroundPreset,
  GlassPreset,
  ThemeDefinition,
  ThemeSettings,
} from '../lib/types'
import { uid } from '../lib/helpers'
import {
  FONT_PRESETS,
  SURFACE_TARGET_OPTIONS,
  createBlankCustomTheme,
  getActiveTheme,
  getBuiltinTheme,
  getSurfaceRole,
  getSurfaceTargetLabel,
  isBuiltinPresetId,
  isBuiltinThemeId,
} from '../lib/theme'
import * as storage from '../lib/storage'
import { useAppearance } from './AppearanceProvider'
import RangeSlider from './RangeSlider'
import SurfaceBackground from './SurfaceBackground'

interface Props {
  themeSettings: ThemeSettings
  setThemeSettings: Dispatch<SetStateAction<ThemeSettings>>
}

type ThemeField = keyof ThemeDefinition
type GlassVariant = keyof ThemeDefinition['glass']
type SettingsPane = 'themes' | 'surfaces' | 'presets' | 'glass' | 'typography'

const COLOR_GROUPS: Array<{ title: string; fields: Array<{ key: ThemeField; label: string }> }> = [
  {
    title: 'Backgrounds',
    fields: [
      { key: 'bgDeep', label: 'App Background' },
      { key: 'bgSidebar', label: 'Sidebar' },
      { key: 'bgSurface', label: 'Surface' },
      { key: 'bgElevated', label: 'Elevated' },
      { key: 'bgInput', label: 'Inputs' },
      { key: 'boardBg', label: 'Board Canvas' },
      { key: 'boardGrid', label: 'Board Grid' },
    ],
  },
  {
    title: 'Text And Borders',
    fields: [
      { key: 'textPrimary', label: 'Primary Text' },
      { key: 'textSecondary', label: 'Secondary Text' },
      { key: 'textMuted', label: 'Muted Text' },
      { key: 'textFaint', label: 'Faint Text' },
      { key: 'textGhost', label: 'Ghost Text' },
      { key: 'border', label: 'Border' },
      { key: 'borderSubtle', label: 'Subtle Border' },
    ],
  },
  {
    title: 'Accents',
    fields: [
      { key: 'accent', label: 'Accent' },
      { key: 'accentLight', label: 'Accent Light' },
      { key: 'green', label: 'Green' },
      { key: 'blue', label: 'Blue' },
      { key: 'red', label: 'Red' },
      { key: 'orange', label: 'Orange' },
      { key: 'pink', label: 'Pink' },
    ],
  },
]

const GLASS_FIELDS: Array<{ key: keyof GlassPreset; label: string; min: number; max: number; step: number }> = [
  { key: 'tint', label: 'Tint', min: 0, max: 0.8, step: 0.01 },
  { key: 'blur', label: 'Blur', min: 0, max: 40, step: 1 },
  { key: 'saturation', label: 'Saturation', min: 1, max: 2.2, step: 0.05 },
  { key: 'border', label: 'Border', min: 0, max: 0.3, step: 0.01 },
  { key: 'glow', label: 'Glow', min: 0, max: 0.35, step: 0.01 },
  { key: 'specular', label: 'Specular', min: 0, max: 0.25, step: 0.01 },
  { key: 'noise', label: 'Noise', min: 0, max: 0.2, step: 0.01 },
]

export default function SettingsSection({ themeSettings, setThemeSettings }: Props) {
  const {
    artefacts,
    findPreset,
    resolveAssignment,
    assignSurface,
    resetSurfaceOverride,
    updatePreset,
    upsertPreset,
  } = useAppearance()
  const activeTheme = getActiveTheme(themeSettings)
  const [newThemeName, setNewThemeName] = useState(`${activeTheme.name} Copy`)
  const [activePane, setActivePane] = useState<SettingsPane>('themes')
  const [selectedTarget, setSelectedTarget] = useState<string>('app-shell')
  const [librarySelectionId, setLibrarySelectionId] = useState<string | null>(themeSettings.backgroundPresets[0]?.id ?? null)
  const [selectedOrnamentId, setSelectedOrnamentId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)

  const selectedRole = getSurfaceRole(selectedTarget)
  const hasOverride = !!themeSettings.surfaceOverrides[selectedTarget]
  const surfaceAssignment = resolveAssignment(selectedTarget, selectedRole)
  const selectedLibraryPreset = findPreset(librarySelectionId || surfaceAssignment.presetId || themeSettings.backgroundPresets[0]?.id)
  const selectedOrnament = surfaceAssignment.ornaments.find((ornament) => ornament.id === selectedOrnamentId) ?? null
  const presets = useMemo(() => themeSettings.backgroundPresets, [themeSettings.backgroundPresets])
  const activeThemeIsBuiltin = !!activeTheme.builtin || isBuiltinThemeId(activeTheme.id)
  const presetIsBuiltin = !!selectedLibraryPreset && (!!selectedLibraryPreset.builtin || isBuiltinPresetId(selectedLibraryPreset.id))

  const updateActiveTheme = (patch: Partial<ThemeDefinition>) => {
    if (activeThemeIsBuiltin) return
    setThemeSettings((current) => ({
      ...current,
      themes: current.themes.map((theme) =>
        theme.id === current.activeThemeId ? { ...theme, ...patch } : theme,
      ),
    }))
  }

  const updateGlass = (variant: GlassVariant, patch: Partial<GlassPreset>) => {
    updateActiveTheme({
      glass: {
        ...activeTheme.glass,
        [variant]: {
          ...activeTheme.glass[variant],
          ...patch,
        },
      },
    })
  }

  const updateSurfaceDefault = (patch: Partial<BackgroundAssignment>) => {
    if (activeThemeIsBuiltin) return
    updateActiveTheme({
      surfaceDefaults: {
        ...activeTheme.surfaceDefaults,
        [selectedRole]: {
          ...surfaceAssignment,
          ...patch,
        },
      },
    })
  }

  const mutatePreset = (presetId: string, patch: Partial<BackgroundPreset>) => {
    if (isBuiltinPresetId(presetId)) return
    updatePreset(presetId, patch)
  }

  const applyAssignmentPatch = (patch: Partial<BackgroundAssignment>) => {
    const next = { ...surfaceAssignment, ...patch }
    if (hasOverride) assignSurface(selectedTarget, next)
    else updateSurfaceDefault(next)
  }

  const setUseOverride = (enabled: boolean) => {
    if (enabled) assignSurface(selectedTarget, surfaceAssignment)
    else resetSurfaceOverride(selectedTarget)
  }

  const updateOrnaments = (nextOrnaments: BackgroundOrnament[]) => {
    applyAssignmentPatch({ ornaments: nextOrnaments })
  }

  const updateSelectedOrnament = (patch: Partial<BackgroundOrnament>) => {
    if (!selectedOrnament) return
    updateOrnaments(surfaceAssignment.ornaments.map((ornament) => (
      ornament.id === selectedOrnament.id ? { ...ornament, ...patch } : ornament
    )))
  }

  const addOrnamentFromPreset = (presetId: string) => {
    const ornament: BackgroundOrnament = {
      id: uid(),
      presetId,
      x: 50,
      y: 50,
      w: 28,
      h: 28,
      rotation: 0,
      opacity: 0.78,
      blur: 0,
      zIndex: surfaceAssignment.ornaments.length + 1,
      blendMode: 'screen',
      anchor: 'center',
      locked: false,
    }
    updateOrnaments([...surfaceAssignment.ornaments, ornament])
    setSelectedOrnamentId(ornament.id)
    setEditMode(true)
  }

  const duplicateTheme = () => {
    const name = newThemeName.trim() || `${activeTheme.name} Copy`
    const nextTheme = { ...activeTheme, id: uid(), name, builtin: false }
    setThemeSettings((current) => ({
      ...current,
      activeThemeId: nextTheme.id,
      themes: [...current.themes, nextTheme],
    }))
    setNewThemeName(`${name} Copy`)
  }

  const createBlankTheme = () => {
    const name = newThemeName.trim() || 'New Theme'
    const nextTheme = createBlankCustomTheme(uid(), name)
    setThemeSettings((current) => ({
      ...current,
      activeThemeId: nextTheme.id,
      themes: [...current.themes, nextTheme],
    }))
    setNewThemeName(`${name} Copy`)
  }

  const deleteTheme = () => {
    if (themeSettings.themes.length <= 1 || activeThemeIsBuiltin) return
    setThemeSettings((current) => {
      const themes = current.themes.filter((theme) => theme.id !== current.activeThemeId)
      return {
        ...current,
        activeThemeId: themes[0].id,
        themes,
      }
    })
  }

  const restoreBuiltinTheme = () => {
    if (!activeThemeIsBuiltin) return
    const builtinTheme = getBuiltinTheme(activeTheme.id)
    if (!builtinTheme) return
    setThemeSettings((current) => ({
      ...current,
      themes: current.themes.map((theme) => theme.id === activeTheme.id ? builtinTheme : theme),
    }))
  }

  const duplicatePreset = (preset: BackgroundPreset) => {
    const nextPreset = { ...preset, id: uid(), name: `${preset.name} Copy`, builtin: false }
    upsertPreset(nextPreset)
    setLibrarySelectionId(nextPreset.id)
  }

  const deletePreset = (presetId: string) => {
    if (isBuiltinPresetId(presetId)) return
    setThemeSettings((current) => ({
      ...current,
      backgroundPresets: current.backgroundPresets.filter((preset) => preset.id !== presetId),
      surfaceOverrides: Object.fromEntries(
        Object.entries(current.surfaceOverrides).map(([target, assignment]) => [
          target,
          assignment.presetId === presetId ? { ...assignment, presetId: null } : assignment,
        ]),
      ),
      themes: current.themes.map((theme) => ({
        ...theme,
        surfaceDefaults: Object.fromEntries(
          Object.entries(theme.surfaceDefaults).map(([role, assignment]) => [
            role,
            assignment.presetId === presetId ? { ...assignment, presetId: null } : assignment,
          ]),
        ) as ThemeDefinition['surfaceDefaults'],
      })),
    }))
    if (librarySelectionId === presetId) setLibrarySelectionId(themeSettings.backgroundPresets.find((preset) => preset.id !== presetId)?.id ?? null)
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const uploaded = await storage.uploadBackgroundAsset(file)
    const preset: BackgroundPreset = {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ''),
      builtin: false,
      kind: 'media',
      opacity: 0.92,
      blur: 0,
      blendMode: 'normal',
      media: {
        src: uploaded.path,
        mediaType: uploaded.mediaType,
        fit: 'cover',
        drift: 0.12,
        muted: true,
        loop: true,
        playbackRate: 1,
      },
    }
    upsertPreset(preset)
    setLibrarySelectionId(preset.id)
    event.target.value = ''
  }

  const createPresetFromArtefact = (artefactId: string) => {
    const artefact = artefacts.find((entry) => entry.id === artefactId)
    if (!artefact) return
    const preset: BackgroundPreset = {
      id: uid(),
      name: `${artefact.title} Background`,
      builtin: false,
      kind: 'artefact',
      opacity: 0.88,
      blur: 0,
      blendMode: 'normal',
      artefact: {
        artefactId,
        scale: 1,
        injectTheme: true,
      },
    }
    upsertPreset(preset)
    setLibrarySelectionId(preset.id)
  }

  const previewGlassClass = selectedRole === 'popup'
    ? 'glass-surface glass-popup'
    : selectedRole === 'panel'
      ? 'glass-surface glass-panel'
      : null

  const paneOptions: Array<{ id: SettingsPane; label: string; description: string }> = [
    { id: 'themes', label: 'Theme Library', description: 'Choose themes, duplicate them, and tune core colors.' },
    { id: 'surfaces', label: 'Surface Assignment', description: 'Assign backgrounds to pages, panels, and popups.' },
    { id: 'presets', label: 'Preset Library', description: 'Manage reusable media, gradients, simulations, and artefacts.' },
    { id: 'glass', label: 'Glass', description: 'Tune liquid panel and popup opacity, blur, glow, and border.' },
    { id: 'typography', label: 'Typography', description: 'Control theme fonts and heading systems.' },
  ]

  const themeLibrarySection = (
    <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={sectionLabel}>Theme Library</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: 4 }}>
            Built-ins are read-only. Duplicate or create a blank theme to customize.
          </div>
        </div>
        <div style={statusPill(activeThemeIsBuiltin ? 'builtin' : 'custom')}>
          {activeThemeIsBuiltin ? 'Built-in' : 'Custom'}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {themeSettings.themes.map((theme) => {
          const active = theme.id === themeSettings.activeThemeId
          const builtin = !!theme.builtin || isBuiltinThemeId(theme.id)
          return (
            <button
              key={theme.id}
              onClick={() => {
                setThemeSettings((current) => ({ ...current, activeThemeId: theme.id }))
                setNewThemeName(`${theme.name} Copy`)
              }}
              style={{
                ...themeCard,
                borderColor: active ? theme.accent : 'var(--border)',
                boxShadow: active ? `0 0 0 1px ${theme.accent}` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>{theme.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 4 }}>{theme.fontHeading}</div>
                </div>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                  {active && <div style={{ color: 'var(--accent-light)', fontSize: '0.72rem', fontWeight: 700 }}>Active</div>}
                  <div style={statusPill(builtin ? 'builtin' : 'custom')}>{builtin ? 'Built-in' : 'Custom'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {[theme.bgDeep, theme.bgSurface, theme.accent, theme.textPrimary].map((color) => (
                  <span key={color} style={{ width: 22, height: 22, borderRadius: 999, background: color, border: '1px solid rgba(255,255,255,0.14)' }} />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )

  const presetLibrarySection = (
    <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={sectionLabel}>Preset Library</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: 4 }}>
            Shipped presets are locked. Duplicate one or create a new source to edit it.
          </div>
        </div>
        {selectedLibraryPreset && (
          <div style={statusPill(presetIsBuiltin ? 'builtin' : 'custom')}>
            {presetIsBuiltin ? 'Built-in' : 'Custom'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => uploadRef.current?.click()} style={primaryButton}>Upload Media</button>
        <button onClick={() => selectedLibraryPreset && duplicatePreset(selectedLibraryPreset)} disabled={!selectedLibraryPreset} style={{ ...ghostButton, opacity: selectedLibraryPreset ? 1 : 0.45 }}>
          Duplicate
        </button>
      </div>
      <input ref={uploadRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleUpload} />

      {artefacts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            Create From Artefact
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {artefacts.slice(0, 4).map((artefact) => (
              <button key={artefact.id} onClick={() => createPresetFromArtefact(artefact.id)} style={surfaceBtn}>
                {artefact.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
        {presets.map((preset) => {
          const builtin = !!preset.builtin || isBuiltinPresetId(preset.id)
          return (
            <button
              key={preset.id}
              onClick={() => setLibrarySelectionId(preset.id)}
              style={{
                ...surfaceBtn,
                borderColor: librarySelectionId === preset.id ? 'var(--accent)' : 'var(--border)',
                background: librarySelectionId === preset.id ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                color: librarySelectionId === preset.id ? 'var(--accent-light)' : 'var(--text-secondary)',
              }}
            >
              <span style={{ display: 'grid', gap: 4, textAlign: 'left' }}>
                <span>{preset.name}</span>
                <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem' }}>{builtin ? 'Built-in preset' : 'Custom preset'}</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>{preset.kind}</span>
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '34px 28px 50px', display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.6rem', letterSpacing: '-0.03em', margin: '0 0 8px', fontFamily: 'var(--font-heading)' }}>
            Appearance Settings
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 760, lineHeight: 1.6, fontSize: '0.92rem' }}>
            Split into focused subviews so theme work, surfaces, presets, glass, and typography no longer compete for the same space.
          </p>
        </div>

        <section style={{ ...panel, minWidth: 280, flex: '0 0 360px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={sectionLabel}>Active Theme</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800, marginTop: 6 }}>{activeTheme.name}</div>
            </div>
            <div style={statusPill(activeThemeIsBuiltin ? 'builtin' : 'custom')}>
              {activeThemeIsBuiltin ? 'Built-in' : 'Custom'}
            </div>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>
            {activeThemeIsBuiltin
              ? 'Built-in themes are locked. Duplicate one or create a blank theme before editing.'
              : 'Custom themes can be renamed, tuned, and deleted without changing the shipped presets.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={newThemeName} onChange={(e) => setNewThemeName(e.target.value)} placeholder="New theme name" style={textInput} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={createBlankTheme} style={ghostButton}>Create Blank</button>
            <button onClick={duplicateTheme} style={primaryButton}>Duplicate Active</button>
            {activeThemeIsBuiltin ? (
              <button onClick={restoreBuiltinTheme} style={ghostButton}>Restore Built-in</button>
            ) : (
              <button
                onClick={deleteTheme}
                disabled={themeSettings.themes.length <= 1}
                style={{ ...ghostButton, color: 'var(--red)', opacity: themeSettings.themes.length <= 1 ? 0.45 : 1 }}
              >
                Delete Active
              </button>
            )}
          </div>
        </section>
      </div>

      <section style={{ ...panel, padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {paneOptions.map((pane) => {
            const active = activePane === pane.id
            return (
              <button
                key={pane.id}
                onClick={() => setActivePane(pane.id)}
                style={{
                  ...surfaceBtn,
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  minHeight: 84,
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  background: active ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                  color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                }}
              >
                <span style={{ fontWeight: 700 }}>{pane.label}</span>
                <span style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.5, textAlign: 'left' }}>
                  {pane.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            activePane === 'surfaces'
              ? '290px minmax(0, 1fr) 360px'
              : activePane === 'presets'
                ? '0 minmax(0, 1fr) 360px'
                : activePane === 'themes'
                  ? '290px minmax(0, 1fr) 0'
                  : '290px 0 360px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {(activePane === 'themes' || activePane === 'glass' || activePane === 'typography') && themeLibrarySection}

          <section style={{ ...panel, display: activePane === 'surfaces' ? 'block' : 'none' }}>
            <div style={sectionLabel}>Surfaces</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {SURFACE_TARGET_OPTIONS.map((target) => {
                const active = selectedTarget === target.id
                const overridden = !!themeSettings.surfaceOverrides[target.id]
                return (
                  <button
                    key={target.id}
                    onClick={() => {
                      setSelectedTarget(target.id)
                      setSelectedOrnamentId(null)
                    }}
                    style={{
                      ...surfaceBtn,
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                      background: active ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                      color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                    }}
                  >
                    <span>{target.label}</span>
                    <span style={{ color: overridden ? 'var(--orange)' : 'var(--text-faint)', fontSize: '0.68rem', fontWeight: 700 }}>
                      {overridden ? 'Override' : target.role}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={{ ...panel, display: activePane === 'surfaces' ? 'block' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={sectionLabel}>Surface Preview</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{getSurfaceTargetLabel(selectedTarget)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setUseOverride(!hasOverride)} style={ghostButton}>
                  {hasOverride ? 'Use Theme Default' : 'Create Override'}
                </button>
                <button onClick={() => setEditMode((current) => !current)} style={primaryButton}>
                  {editMode ? 'Finish Edit Mode' : 'Edit Background'}
                </button>
              </div>
            </div>

            <div
              className={previewGlassClass || undefined}
              style={{
                position: 'relative',
                height: 320,
                borderRadius: 18,
                border: '1px solid var(--border)',
                overflow: 'hidden',
                background: selectedRole === 'appShell' ? 'var(--bg-deep)' : 'transparent',
              }}
            >
              <SurfaceBackground
                targetId={selectedTarget}
                role={selectedRole}
                editMode={editMode}
                selectedOrnamentId={selectedOrnamentId}
                onSelectOrnament={setSelectedOrnamentId}
                onChangeOrnament={(ornamentId, patch) => {
                  updateOrnaments(surfaceAssignment.ornaments.map((ornament) => (
                    ornament.id === ornamentId ? { ...ornament, ...patch } : ornament
                  )))
                }}
              />
              <div style={{ position: 'relative', zIndex: 'var(--z-content)', height: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
                {selectedRole === 'popup' ? (
                  <div style={{ width: 280, borderRadius: 16, padding: 18 }} className="glass-surface glass-popup">
                    <div style={{ fontSize: '0.8rem', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Popup Preview</div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginTop: 10 }}>Elevated Glass</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5, fontSize: '0.85rem' }}>
                      Popups sit above the clock and inherit a stronger glass preset than regular panels.
                    </div>
                  </div>
                ) : selectedRole === 'panel' ? (
                  <div style={{ width: 280, display: 'grid', gap: 10 }}>
                    {['Pinned surface', 'Liquid panel', 'Background aware'].map((label) => (
                      <div key={label} className="glass-surface glass-panel" style={{ borderRadius: 14, padding: '12px 14px' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.88rem' }}>{label}</div>
                        <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.76rem' }}>Panel surfaces can now have defaults or per-panel overrides.</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ width: '100%', maxWidth: 520 }}>
                    <div style={{ fontSize: '0.72rem', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Page Preview</div>
                    <div style={{ fontSize: '2rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginTop: 12 }}>Backgrounds For Every Surface</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6, fontSize: '0.92rem', maxWidth: 460 }}>
                      Theme defaults cover the shell, pages, panels, and popups. Turn on edit mode to drag and resize decorative layers. Outside edit mode, the background is locked.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
              <Field label={hasOverride ? 'Override preset' : `${selectedRole} default`}>
                <select value={surfaceAssignment.presetId ?? ''} onChange={(e) => applyAssignmentPatch({ presetId: e.target.value || null })} style={textInput}>
                  <option value="">No base background</option>
                  {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
              </Field>
              <Field label="Surface opacity">
                <RangeInput value={surfaceAssignment.opacity} min={0} max={1} step={0.01} onChange={(value) => applyAssignmentPatch({ opacity: value })} />
              </Field>
              <Field label="Surface blur">
                <RangeInput value={surfaceAssignment.blur} min={0} max={18} step={1} onChange={(value) => applyAssignmentPatch({ blur: value })} />
              </Field>
            </div>
          </section>

          <section style={{ ...panel, display: activePane === 'surfaces' ? 'block' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={sectionLabel}>Ornaments</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Add extra background elements and place them in edit mode.</div>
              </div>
              <button
                onClick={() => selectedLibraryPreset && addOrnamentFromPreset(selectedLibraryPreset.id)}
                disabled={!selectedLibraryPreset}
                style={{ ...primaryButton, opacity: selectedLibraryPreset ? 1 : 0.45 }}
              >
                Add Selected Preset
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 16 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {surfaceAssignment.ornaments.length === 0 && (
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.82rem', padding: '6px 0' }}>No ornaments yet.</div>
                )}
                {surfaceAssignment.ornaments.map((ornament) => (
                  <button
                    key={ornament.id}
                    onClick={() => { setSelectedOrnamentId(ornament.id); setEditMode(true) }}
                    style={{
                      ...surfaceBtn,
                      justifyContent: 'space-between',
                      borderColor: selectedOrnamentId === ornament.id ? 'var(--accent)' : 'var(--border)',
                      background: selectedOrnamentId === ornament.id ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                      color: selectedOrnamentId === ornament.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                    }}
                  >
                    <span>{findPreset(ornament.presetId)?.name ?? ornament.presetId}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{ornament.anchor}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {selectedOrnament ? (
                  <>
                    <Field label="Anchor">
                      <select value={selectedOrnament.anchor} onChange={(e) => updateSelectedOrnament({ anchor: e.target.value as BackgroundOrnament['anchor'] })} style={textInput}>
                        {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].map((anchor) => (
                          <option key={anchor} value={anchor}>{anchor}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="X">
                      <RangeInput value={selectedOrnament.x} min={0} max={100} step={1} onChange={(value) => updateSelectedOrnament({ x: value })} />
                    </Field>
                    <Field label="Y">
                      <RangeInput value={selectedOrnament.y} min={0} max={100} step={1} onChange={(value) => updateSelectedOrnament({ y: value })} />
                    </Field>
                    <Field label="Width">
                      <RangeInput value={selectedOrnament.w} min={6} max={80} step={1} onChange={(value) => updateSelectedOrnament({ w: value })} />
                    </Field>
                    <Field label="Height">
                      <RangeInput value={selectedOrnament.h} min={6} max={80} step={1} onChange={(value) => updateSelectedOrnament({ h: value })} />
                    </Field>
                    <Field label="Rotation">
                      <RangeInput value={selectedOrnament.rotation} min={-180} max={180} step={1} onChange={(value) => updateSelectedOrnament({ rotation: value })} />
                    </Field>
                    <Field label="Opacity">
                      <RangeInput value={selectedOrnament.opacity} min={0} max={1} step={0.01} onChange={(value) => updateSelectedOrnament({ opacity: value })} />
                    </Field>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => updateSelectedOrnament({ locked: !selectedOrnament.locked })} style={ghostButton}>
                        {selectedOrnament.locked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        onClick={() => {
                          updateOrnaments(surfaceAssignment.ornaments.filter((ornament) => ornament.id !== selectedOrnament.id))
                          setSelectedOrnamentId(null)
                        }}
                        style={{ ...ghostButton, color: 'var(--red)' }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Select an ornament to fine-tune its position, size, opacity, and anchor.
                  </div>
                )}
              </div>
            </div>
          </section>

          {COLOR_GROUPS.map((group) => (
            <section key={group.title} style={{ ...panel, display: activePane === 'themes' ? 'block' : 'none' }}>
              <div style={sectionLabel}>{group.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                {group.fields.map((field) => (
                  <ColorField
                    key={field.key}
                    label={field.label}
                    value={activeTheme[field.key] as string}
                    onChange={(value) => updateActiveTheme({ [field.key]: value } as Partial<ThemeDefinition>)}
                    disabled={activeThemeIsBuiltin}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 16, gridColumn: activePane === 'presets' ? '2 / span 2' : undefined }}>
          {(activePane === 'surfaces' || activePane === 'presets') && presetLibrarySection}

          {selectedLibraryPreset && (
            <section style={{ ...panel, display: activePane === 'presets' ? 'block' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <div style={sectionLabel}>Preset Editor</div>
                {!presetIsBuiltin && (
                  <button onClick={() => deletePreset(selectedLibraryPreset.id)} style={{ ...ghostButton, color: 'var(--red)' }}>Delete</button>
                )}
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <Field label="Preset Name">
                  <input value={selectedLibraryPreset.name} onChange={(e) => mutatePreset(selectedLibraryPreset.id, { name: e.target.value })} style={textInput} disabled={presetIsBuiltin} />
                </Field>

                <Field label="Blend Mode">
                  <select value={selectedLibraryPreset.blendMode} onChange={(e) => mutatePreset(selectedLibraryPreset.id, { blendMode: e.target.value as BackgroundPreset['blendMode'] })} style={textInput} disabled={presetIsBuiltin}>
                    {['normal', 'screen', 'overlay', 'soft-light', 'lighten'].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                </Field>

                <Field label="Base Opacity">
                  <RangeInput value={selectedLibraryPreset.opacity} min={0} max={1} step={0.01} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { opacity: value })} disabled={presetIsBuiltin} />
                </Field>

                <Field label="Blur">
                  <RangeInput value={selectedLibraryPreset.blur} min={0} max={18} step={1} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { blur: value })} disabled={presetIsBuiltin} />
                </Field>

                {selectedLibraryPreset.kind === 'gradient' && (
                  <>
                    <Field label="Style">
                      <select value={selectedLibraryPreset.gradient.style} onChange={(e) => mutatePreset(selectedLibraryPreset.id, { gradient: { ...selectedLibraryPreset.gradient, style: e.target.value as typeof selectedLibraryPreset.gradient.style } } as Partial<BackgroundPreset>)} style={textInput} disabled={presetIsBuiltin}>
                        {['theme-orbit', 'theme-rings', 'theme-mesh'].map((style) => <option key={style} value={style}>{style}</option>)}
                      </select>
                    </Field>
                    <Field label="Intensity">
                      <RangeInput value={selectedLibraryPreset.gradient.intensity} min={0} max={1.4} step={0.01} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { gradient: { ...selectedLibraryPreset.gradient, intensity: value } } as Partial<BackgroundPreset>)} disabled={presetIsBuiltin} />
                    </Field>
                    <Field label="Motion">
                      <RangeInput value={selectedLibraryPreset.gradient.motion} min={0} max={1.4} step={0.01} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { gradient: { ...selectedLibraryPreset.gradient, motion: value } } as Partial<BackgroundPreset>)} disabled={presetIsBuiltin} />
                    </Field>
                  </>
                )}

                {selectedLibraryPreset.kind === 'simulation' && (
                  <>
                    <Field label="Engine">
                      <select value={selectedLibraryPreset.simulation.engine} onChange={(e) => mutatePreset(selectedLibraryPreset.id, { simulation: { ...selectedLibraryPreset.simulation, engine: e.target.value as typeof selectedLibraryPreset.simulation.engine } } as Partial<BackgroundPreset>)} style={textInput} disabled={presetIsBuiltin}>
                        {['starfield', 'linked-particles', 'game-of-life', 'evolving-shapes'].map((engine) => <option key={engine} value={engine}>{engine}</option>)}
                      </select>
                    </Field>
                    <Field label="Speed">
                      <RangeInput value={selectedLibraryPreset.simulation.speed} min={0.05} max={2} step={0.01} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { simulation: { ...selectedLibraryPreset.simulation, speed: value } } as Partial<BackgroundPreset>)} disabled={presetIsBuiltin} />
                    </Field>
                    <Field label="Density">
                      <RangeInput value={selectedLibraryPreset.simulation.density} min={4} max={320} step={1} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { simulation: { ...selectedLibraryPreset.simulation, density: value } } as Partial<BackgroundPreset>)} disabled={presetIsBuiltin} />
                    </Field>
                  </>
                )}

                {selectedLibraryPreset.kind === 'media' && (
                  <>
                    <Field label="Source">
                      <input value={selectedLibraryPreset.media.src} onChange={(e) => mutatePreset(selectedLibraryPreset.id, { media: { ...selectedLibraryPreset.media, src: e.target.value } } as Partial<BackgroundPreset>)} style={textInput} disabled={presetIsBuiltin} />
                    </Field>
                    <Field label="Fit">
                      <select value={selectedLibraryPreset.media.fit} onChange={(e) => mutatePreset(selectedLibraryPreset.id, { media: { ...selectedLibraryPreset.media, fit: e.target.value as typeof selectedLibraryPreset.media.fit } } as Partial<BackgroundPreset>)} style={textInput} disabled={presetIsBuiltin}>
                        <option value="cover">cover</option>
                        <option value="contain">contain</option>
                      </select>
                    </Field>
                    <Field label="Drift">
                      <RangeInput value={selectedLibraryPreset.media.drift} min={0} max={2} step={0.01} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { media: { ...selectedLibraryPreset.media, drift: value } } as Partial<BackgroundPreset>)} disabled={presetIsBuiltin} />
                    </Field>
                  </>
                )}

                {selectedLibraryPreset.kind === 'artefact' && (
                  <>
                    <Field label="Artefact">
                      <select value={selectedLibraryPreset.artefact.artefactId} onChange={(e) => mutatePreset(selectedLibraryPreset.id, { artefact: { ...selectedLibraryPreset.artefact, artefactId: e.target.value } } as Partial<BackgroundPreset>)} style={textInput} disabled={presetIsBuiltin}>
                        {artefacts.map((artefact) => <option key={artefact.id} value={artefact.id}>{artefact.title}</option>)}
                      </select>
                    </Field>
                    <Field label="Scale">
                      <RangeInput value={selectedLibraryPreset.artefact.scale} min={0.25} max={2.5} step={0.01} onChange={(value) => mutatePreset(selectedLibraryPreset.id, { artefact: { ...selectedLibraryPreset.artefact, scale: value } } as Partial<BackgroundPreset>)} disabled={presetIsBuiltin} />
                    </Field>
                  </>
                )}

                <button onClick={() => applyAssignmentPatch({ presetId: selectedLibraryPreset.id })} style={primaryButton}>
                  Apply To {getSurfaceTargetLabel(selectedTarget)}
                </button>
              </div>
            </section>
          )}

          <section style={{ ...panel, display: activePane === 'glass' ? 'block' : 'none' }}>
            <div style={sectionLabel}>Glass Tuning</div>
            <div style={{ display: 'grid', gap: 14 }}>
              {(['panel', 'floating', 'popup'] as GlassVariant[]).map((variant) => (
                <div key={variant} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, display: 'grid', gap: 10 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, textTransform: 'capitalize' }}>{variant}</div>
                  {GLASS_FIELDS.map((field) => (
                    <Field key={field.key} label={field.label}>
                      <RangeInput
                        value={activeTheme.glass[variant][field.key]}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        onChange={(value) => updateGlass(variant, { [field.key]: value } as Partial<GlassPreset>)}
                        disabled={activeThemeIsBuiltin}
                      />
                    </Field>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...panel, display: activePane === 'typography' ? 'block' : 'none' }}>
            <div style={sectionLabel}>Typography</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="Theme Name">
                <input value={activeTheme.name} onChange={(e) => updateActiveTheme({ name: e.target.value })} style={textInput} disabled={activeThemeIsBuiltin} />
              </Field>
              <Field label="Body Font">
                <input value={activeTheme.font} onChange={(e) => updateActiveTheme({ font: e.target.value })} style={textInput} disabled={activeThemeIsBuiltin} />
              </Field>
              <Field label="Heading Font">
                <input value={activeTheme.fontHeading} onChange={(e) => updateActiveTheme({ fontHeading: e.target.value })} style={textInput} disabled={activeThemeIsBuiltin} />
              </Field>
              <Field label="Mono Font">
                <input value={activeTheme.fontMono} onChange={(e) => updateActiveTheme({ fontMono: e.target.value })} style={textInput} disabled={activeThemeIsBuiltin} />
              </Field>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FONT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => updateActiveTheme({
                      font: preset.font,
                      fontHeading: preset.fontHeading,
                      fontMono: preset.fontMono,
                    })}
                    disabled={activeThemeIsBuiltin}
                    style={{ ...ghostButton, opacity: activeThemeIsBuiltin ? 0.5 : 1 }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function RangeInput({
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return <RangeSlider value={value} min={min} max={max} step={step} onChange={onChange} disabled={disabled} />
}

function ColorField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ width: 50, height: 42, border: 'none', borderRadius: 10, background: 'transparent', cursor: 'pointer' }}
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} style={textInput} disabled={disabled} />
      </div>
    </Field>
  )
}

function statusPill(kind: 'builtin' | 'custom' | 'override' | 'default'): CSSProperties {
  if (kind === 'builtin') {
    return {
      ...pillBase,
      color: 'var(--blue)',
      background: 'color-mix(in srgb, var(--blue) 18%, transparent)',
      borderColor: 'color-mix(in srgb, var(--blue) 28%, var(--border))',
    }
  }
  if (kind === 'custom') {
    return {
      ...pillBase,
      color: 'var(--green)',
      background: 'color-mix(in srgb, var(--green) 18%, transparent)',
      borderColor: 'color-mix(in srgb, var(--green) 28%, var(--border))',
    }
  }
  if (kind === 'override') {
    return {
      ...pillBase,
      color: 'var(--orange)',
      background: 'color-mix(in srgb, var(--orange) 18%, transparent)',
      borderColor: 'color-mix(in srgb, var(--orange) 28%, var(--border))',
    }
  }
  return {
    ...pillBase,
    color: 'var(--text-muted)',
    background: 'color-mix(in srgb, var(--bg-elevated) 84%, transparent)',
    borderColor: 'var(--border)',
  }
}

const panel: CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
}

const sectionLabel: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontWeight: 700,
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const textInput: CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: '0.88rem',
  outline: 'none',
  fontFamily: 'inherit',
}

const primaryButton: CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const ghostButton: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontWeight: 600,
  fontFamily: 'inherit',
}

const themeCard: CSSProperties = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const surfaceBtn: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '10px 12px',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  fontFamily: 'inherit',
}
