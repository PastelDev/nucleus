import { useState, useEffect, useRef, useCallback } from 'react'

type ClockMode = 'digital' | 'analog'
type ClockSize = 'small' | 'medium' | 'large'

const SIZE_MAP: Record<ClockSize, number> = { small: 120, medium: 180, large: 260 }
const SIZES: ClockSize[] = ['small', 'medium', 'large']

interface Props {
  visible: boolean
  onClose: () => void
}

interface Persisted {
  x: number
  y: number
  size: ClockSize
  mode: ClockMode
}

const LS_KEY = 'nucleus-floating-clock'

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { x: window.innerWidth - 220, y: 24, size: 'medium', mode: 'digital' }
}

function savePersisted(p: Persisted) {
  localStorage.setItem(LS_KEY, JSON.stringify(p))
}

export default function FloatingClock({ visible, onClose }: Props) {
  const [persisted, setPersisted] = useState<Persisted>(loadPersisted)
  const [now, setNow] = useState(new Date())
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [visible])

  const save = useCallback((update: Partial<Persisted>) => {
    setPersisted(p => {
      const next = { ...p, ...update }
      savePersisted(next)
      return next
    })
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    dragOffset.current = { x: e.clientX - persisted.x, y: e.clientY - persisted.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const nx = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dragOffset.current.x))
      const ny = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - dragOffset.current.y))
      setPersisted(p => ({ ...p, x: nx, y: ny }))
    }
    const onUp = (ev: MouseEvent) => {
      dragging.current = false
      const nx = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dragOffset.current.x))
      const ny = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - dragOffset.current.y))
      save({ x: nx, y: ny })
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const cycleSize = () => {
    const idx = SIZES.indexOf(persisted.size)
    save({ size: SIZES[(idx + 1) % SIZES.length] })
  }

  const toggleMode = () => {
    save({ mode: persisted.mode === 'digital' ? 'analog' : 'digital' })
  }

  if (!visible) return null

  const w = SIZE_MAP[persisted.size]
  const h = persisted.mode === 'analog' ? w : w * 0.55
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()

  return (
    <div
      className="glass-surface glass-floating"
      onMouseDown={onMouseDown}
      style={{
        position: 'fixed',
        left: persisted.x,
        top: persisted.y,
        width: w,
        height: h,
        zIndex: 'var(--z-floating)',
        borderRadius: 16,
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        transition: 'width 0.2s ease, height 0.2s ease',
      }}
    >
      {/* Controls row */}
      <div style={{
        position: 'absolute', top: 5, right: 5,
        display: 'flex', gap: 3, opacity: 0.5,
      }}>
        <button onClick={cycleSize} title="Resize" style={ctrlBtn}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
        <button onClick={onClose} title="Hide clock" style={ctrlBtn}>×</button>
      </div>

      {persisted.mode === 'digital' ? (
        <div onDoubleClick={toggleMode} title="Double-click to switch clock mode" style={{ cursor: 'pointer', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: w * 0.18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}>
            {String(hours).padStart(2, '0')}
            <span style={{ opacity: seconds % 2 ? 0.3 : 1, transition: 'opacity 0.3s' }}>:</span>
            {String(minutes).padStart(2, '0')}
            <span style={{ opacity: seconds % 2 ? 0.3 : 1, transition: 'opacity 0.3s' }}>:</span>
            {String(seconds).padStart(2, '0')}
          </div>
          <div style={{
            fontSize: w * 0.065,
            color: 'var(--text-muted)',
            marginTop: 4,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      ) : (
        <AnalogClock
          hours={hours}
          minutes={minutes}
          seconds={seconds}
          size={w * 0.75}
          onDoubleClick={toggleMode}
        />
      )}
    </div>
  )
}

function AnalogClock({ hours, minutes, seconds, size, onDoubleClick }: {
  hours: number; minutes: number; seconds: number; size: number; onDoubleClick: () => void
}) {
  const r = size / 2
  const cx = r
  const cy = r

  const hourAngle = ((hours % 12) + minutes / 60) * 30 - 90
  const minuteAngle = (minutes + seconds / 60) * 6 - 90
  const secondAngle = seconds * 6 - 90

  const hand = (angle: number, length: number, width: number, color: string) => {
    const rad = (angle * Math.PI) / 180
    return (
      <line
        x1={cx} y1={cy}
        x2={cx + Math.cos(rad) * length}
        y2={cy + Math.sin(rad) * length}
        stroke={color} strokeWidth={width} strokeLinecap="round"
      />
    )
  }

  return (
    <svg width={size} height={size} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
      <title>Double-click to switch clock mode</title>
      {/* Face */}
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="var(--text-faint)" strokeWidth="1.5" />
      {/* Hour markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 - 90) * Math.PI / 180
        const outer = r - 6
        const inner = i % 3 === 0 ? r - 16 : r - 12
        return (
          <line
            key={i}
            x1={cx + Math.cos(angle) * inner}
            y1={cy + Math.sin(angle) * inner}
            x2={cx + Math.cos(angle) * outer}
            y2={cy + Math.sin(angle) * outer}
            stroke="var(--text-muted)"
            strokeWidth={i % 3 === 0 ? 2 : 1}
            strokeLinecap="round"
          />
        )
      })}
      {/* Hands */}
      {hand(hourAngle, r * 0.5, 3, 'var(--text-primary)')}
      {hand(minuteAngle, r * 0.7, 2, 'var(--text-secondary)')}
      {hand(secondAngle, r * 0.75, 1, 'var(--accent)')}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="var(--accent)" />
    </svg>
  )
}

const ctrlBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  padding: '2px 4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}
