import type { Section } from '../lib/types'
import NucleusLogo from './NucleusLogo'

interface NavItem {
  id: Section
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { id: 'today', label: 'Today', icon: 'M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { id: 'notes', label: 'Notes', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { id: 'whiteboard', label: 'Board', icon: 'M2 3a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zm3 16h14M8 17v2M16 17v2' },
  { id: 'me', label: 'Me', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  { id: 'calendar', label: 'Calendar', icon: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18' },
  { id: 'pomodoro', label: 'Focus', icon: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2' },
  { id: 'artefacts', label: 'Artefacts', icon: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm0 5h16M8 3v5' },
  { id: 'settings', label: 'Settings', icon: 'M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z' },
]

interface Props {
  section: Section
  setSection: (s: Section) => void
  aiOpen: boolean
  setAiOpen: (v: boolean) => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  clockVisible: boolean
  setClockVisible: (v: boolean) => void
}

export default function Sidebar({ section, setSection, aiOpen, setAiOpen, collapsed, setCollapsed, clockVisible, setClockVisible }: Props) {
  const w = collapsed ? 52 : 196

  return (
    <div style={{
      width: w,
      flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: collapsed ? '20px 6px 16px' : '20px 9px 16px',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div
        className="liquid-glass-subtle"
        style={{
          padding: collapsed ? '8px 4px' : '8px 10px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          cursor: 'pointer',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 12,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <NucleusLogo size={28} />
        </div>
        {!collapsed && (
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: '1.1rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}>Nucleus</span>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(item => {
          const active = section === item.id
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 'var(--radius)',
                border: 'none',
                background: active ? 'var(--accent-surface)' : 'transparent',
                color: active ? 'var(--accent-light)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: active ? 700 : 500,
                textAlign: 'left',
                transition: 'all 0.12s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = '#12122a'
                  e.currentTarget.style.color = '#888898'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={active ? 2.3 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {!collapsed && (
                <>
                  {item.label}
                  {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                </>
              )}
            </button>
          )
        })}
      </nav>

      {/* AI bottom section */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* AI Settings */}
        <button
          onClick={() => setSection('ai-settings')}
          title={collapsed ? 'AI Settings' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '10px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius)', border: 'none',
            background: section === 'ai-settings' ? 'var(--accent-surface)' : 'transparent',
            color: section === 'ai-settings' ? 'var(--accent-light)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.88rem',
            fontWeight: section === 'ai-settings' ? 700 : 500,
            textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5.2-3 6.5V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.5 14.2 5 12 5 9a7 7 0 0 1 7-7zM9 22h6" />
          </svg>
          {!collapsed && (
            <>AI Settings{section === 'ai-settings' && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}</>
          )}
        </button>
        {/* Clock toggle */}
        <button
          onClick={() => setClockVisible(!clockVisible)}
          title={collapsed ? 'Clock' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '10px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius)', border: 'none',
            background: clockVisible ? 'var(--accent-surface)' : 'transparent',
            color: clockVisible ? 'var(--accent-light)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.88rem',
            fontWeight: clockVisible ? 700 : 500,
            textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          {!collapsed && (
            <>Clock{clockVisible && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}</>
          )}
        </button>
        {/* AI Chat toggle */}
        <button
          onClick={() => setAiOpen(!aiOpen)}
          title={collapsed ? 'AI Chat' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '10px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius)', border: 'none',
            background: aiOpen ? 'var(--accent-surface)' : 'transparent',
            color: aiOpen ? 'var(--accent-light)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.88rem',
            fontWeight: aiOpen ? 700 : 500,
            textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {!collapsed && (
            <>AI Chat{aiOpen && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}</>
          )}
        </button>
      </div>

      {/* Version */}
      {!collapsed && (
        <div style={{ padding: '8px 12px 0', fontSize: '0.62rem', color: 'var(--text-ghost)' }}>
          Nucleus v2.0
        </div>
      )}
    </div>
  )
}
