import { useEffect, useState } from 'react'

interface ToolCallMsg {
  toolName?: string
  toolArgs?: Record<string, unknown>
  screenshotB64?: string
  toolStatus?: 'running' | 'done' | 'denied'
  toolReason?: string
}

interface Props {
  calls: ToolCallMsg[]
  defaultCollapsed?: boolean
}

export default function ThinkingBlock({ calls, defaultCollapsed = true }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const isActive = calls.some((call) => call.toolStatus === 'running')
  const hasDenied = calls.some((call) => call.toolStatus === 'denied')

  useEffect(() => {
    setCollapsed(defaultCollapsed)
  }, [defaultCollapsed])

  if (calls.length === 0) return null

  return (
    <div style={{
      marginBottom: 9,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      maxWidth: '95%',
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 11px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '0.7rem',
          fontFamily: 'inherit',
          fontStyle: 'italic',
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            transition: 'transform 0.2s ease',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            flexShrink: 0,
          }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span>
          {isActive
            ? 'Thinking…'
            : hasDenied
              ? `Tool blocked${calls.length > 1 ? 's' : ''}`
              : collapsed
                ? `Used ${calls.length} tool${calls.length > 1 ? 's' : ''}`
                : 'Tool activity'
          }
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '0.62rem', fontStyle: 'normal' }}>
          {calls.map(c => c.toolName).filter(Boolean).join(', ')}
        </span>
      </button>

      {/* Expandable content */}
      <div style={{
        maxHeight: collapsed ? 0 : 600,
        opacity: collapsed ? 0 : 1,
        overflow: 'hidden',
        transition: 'max-height 0.25s ease, opacity 0.2s ease',
      }}>
        <div style={{
          padding: '0 11px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {calls.map((call, i) => (
            <div key={i} style={{
              padding: '6px 9px',
              background: 'var(--bg-elevated)',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: call.toolArgs && Object.keys(call.toolArgs).length ? 4 : 0,
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: call.toolStatus === 'denied' ? 'var(--orange)' : call.toolStatus === 'done' ? 'var(--green)' : 'var(--accent)', flexShrink: 0,
                }} />
                <span style={{
                  color: call.toolStatus === 'denied' ? 'var(--orange)' : 'var(--accent-light)',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: '0.68rem',
                  fontStyle: 'italic',
                }}>
                  {call.toolName}()
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '0.62rem', fontStyle: 'normal' }}>
                  {call.toolStatus === 'running' ? 'running' : call.toolStatus === 'denied' ? 'denied' : 'done'}
                </span>
              </div>
              {call.toolArgs && Object.entries(call.toolArgs).slice(0, 3).map(([k, v]) => (
                <div key={k} style={{
                  color: 'var(--text-faint)',
                  paddingLeft: 11,
                  lineHeight: 1.5,
                  fontSize: '0.65rem',
                  fontStyle: 'italic',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}:</span>{' '}
                  {String(v).slice(0, 50)}
                </div>
              ))}
              {call.screenshotB64 && (
                <img
                  src={`data:image/jpeg;base64,${call.screenshotB64}`}
                  alt="Screenshot"
                  style={{
                    width: '100%',
                    borderRadius: 4,
                    marginTop: 5,
                    border: '1px solid var(--border)',
                    display: 'block',
                  }}
                />
              )}
              {call.toolReason && (
                <div style={{ color: 'var(--orange)', paddingLeft: 11, lineHeight: 1.5, fontSize: '0.65rem' }}>
                  reason: {call.toolReason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
