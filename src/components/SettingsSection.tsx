import { useState } from 'react'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import type { ThemeDefinition, ThemeSettings } from '../lib/types'
import { FONT_PRESETS, getActiveTheme } from '../lib/theme'
import { uid } from '../lib/helpers'

interface Props {
  themeSettings: ThemeSettings
  setThemeSettings: Dispatch<SetStateAction<ThemeSettings>>
}

type ThemeField = keyof ThemeDefinition

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

export default function SettingsSection({ themeSettings, setThemeSettings }: Props) {
  const activeTheme = getActiveTheme(themeSettings)
  const [newThemeName, setNewThemeName] = useState(`${activeTheme.name} Copy`)

  const updateActiveTheme = (patch: Partial<ThemeDefinition>) => {
    setThemeSettings((current) => ({
      ...current,
      themes: current.themes.map((theme) =>
        theme.id === current.activeThemeId ? { ...theme, ...patch } : theme,
      ),
    }))
  }

  const duplicateTheme = () => {
    const name = newThemeName.trim() || `${activeTheme.name} Copy`
    const nextTheme = { ...activeTheme, id: uid(), name }
    setThemeSettings((current) => ({
      activeThemeId: nextTheme.id,
      themes: [...current.themes, nextTheme],
    }))
    setNewThemeName(`${name} Copy`)
  }

  const deleteTheme = () => {
    if (themeSettings.themes.length <= 1) return
    setThemeSettings((current) => {
      const themes = current.themes.filter((theme) => theme.id !== current.activeThemeId)
      return {
        activeThemeId: themes[0].id,
        themes,
      }
    })
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '34px 28px 50px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.6rem', letterSpacing: '-0.03em', margin: '0 0 8px', fontFamily: 'var(--font-heading)' }}>
            Appearance Settings
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 620, lineHeight: 1.6, fontSize: '0.92rem' }}>
            Change fonts, tune interface colors, style the board canvas, and save named themes you can switch between later.
          </p>
        </div>

        <div style={{ minWidth: 260, flex: '0 0 320px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder="New theme name"
              style={textInput}
            />
            <button onClick={duplicateTheme} style={primaryButton}>
              Save As New
            </button>
          </div>
          <button onClick={deleteTheme} disabled={themeSettings.themes.length <= 1} style={{ ...ghostButton, opacity: themeSettings.themes.length <= 1 ? 0.45 : 1 }}>
            Delete Active Theme
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <section style={panel}>
            <div style={sectionLabel}>Themes</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {themeSettings.themes.map((theme) => {
                const active = theme.id === themeSettings.activeThemeId
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
                      {active && <div style={{ color: 'var(--accent-light)', fontSize: '0.72rem', fontWeight: 700 }}>Active</div>}
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

          <section style={panel}>
            <div style={sectionLabel}>Live Preview</div>
            <div style={{
              borderRadius: 18,
              padding: 18,
              background: activeTheme.bgSurface,
              color: activeTheme.textPrimary,
              border: `1px solid ${activeTheme.border}`,
              boxShadow: 'var(--shadow)',
            }}>
              <div style={{ fontFamily: activeTheme.fontHeading, fontSize: '1.15rem', fontWeight: 800, marginBottom: 8 }}>
                {activeTheme.name}
              </div>
              <div style={{ fontFamily: activeTheme.font, lineHeight: 1.6, color: activeTheme.textSecondary, marginBottom: 14 }}>
                Headings, body text, canvas background, and accent tones update instantly while you edit.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '8px 12px', borderRadius: 999, background: activeTheme.accent, color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Accent</span>
                <span style={{ padding: '8px 12px', borderRadius: 999, background: activeTheme.bgElevated, border: `1px solid ${activeTheme.border}`, color: activeTheme.textSecondary, fontSize: '0.78rem' }}>Surface</span>
                <span style={{ padding: '8px 12px', borderRadius: 999, background: activeTheme.boardBg, border: `1px solid ${activeTheme.boardGrid}`, color: activeTheme.textSecondary, fontSize: '0.78rem' }}>Board</span>
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={panel}>
            <div style={sectionLabel}>Theme Metadata</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Field label="Theme Name">
                <input value={activeTheme.name} onChange={(e) => updateActiveTheme({ name: e.target.value })} style={textInput} />
              </Field>
              <Field label="Body Font">
                <input value={activeTheme.font} onChange={(e) => updateActiveTheme({ font: e.target.value })} style={textInput} />
              </Field>
              <Field label="Heading Font">
                <input value={activeTheme.fontHeading} onChange={(e) => updateActiveTheme({ fontHeading: e.target.value })} style={textInput} />
              </Field>
              <Field label="Mono Font">
                <input value={activeTheme.fontMono} onChange={(e) => updateActiveTheme({ fontMono: e.target.value })} style={textInput} />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {FONT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => updateActiveTheme({
                    font: preset.font,
                    fontHeading: preset.fontHeading,
                    fontMono: preset.fontMono,
                  })}
                  style={ghostButton}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          {COLOR_GROUPS.map((group) => (
            <section key={group.title} style={panel}>
              <div style={sectionLabel}>{group.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                {group.fields.map((field) => (
                  <ColorField
                    key={field.key}
                    label={field.label}
                    value={activeTheme[field.key] as string}
                    onChange={(value) => updateActiveTheme({ [field.key]: value } as Partial<ThemeDefinition>)}
                  />
                ))}
              </div>
            </section>
          ))}
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 50, height: 42, border: 'none', borderRadius: 10, background: 'transparent', cursor: 'pointer' }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={textInput}
        />
      </div>
    </Field>
  )
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
  marginBottom: 14,
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
