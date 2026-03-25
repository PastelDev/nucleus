import type { CSSProperties } from 'react'

interface Props {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
}

function formatValue(value: number, step: number) {
  if (step >= 1) return String(Math.round(value))
  if (step >= 0.1) return value.toFixed(1)
  return value.toFixed(2)
}

export default function RangeSlider({ value, min, max, step, onChange, disabled = false }: Props) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100

  return (
    <div style={{ display: 'grid', gap: 8, opacity: disabled ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, position: 'relative', height: 34, display: 'flex', alignItems: 'center' }}>
          <div style={track} />
          <div style={{ ...fill, width: `${pct}%` }} />
          <input
            className="nuc-range-input"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            style={input}
          />
        </div>
        <div style={valueBadge}>{formatValue(value, step)}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-faint)', fontSize: '0.65rem', letterSpacing: '0.02em' }}>
        <span>{formatValue(min, step)}</span>
        <span>{formatValue(max, step)}</span>
      </div>
    </div>
  )
}

const track: CSSProperties = {
  position: 'absolute',
  inset: '50% 0 auto',
  height: 8,
  borderRadius: 999,
  transform: 'translateY(-50%)',
  background: 'color-mix(in srgb, var(--bg-elevated) 86%, transparent)',
  border: '1px solid color-mix(in srgb, var(--border) 84%, transparent)',
  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.28)',
}

const fill: CSSProperties = {
  position: 'absolute',
  inset: '50% auto auto 0',
  height: 8,
  borderRadius: 999,
  transform: 'translateY(-50%)',
  background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 72%, white), var(--accent))',
  boxShadow: '0 0 18px color-mix(in srgb, var(--accent) 34%, transparent)',
  pointerEvents: 'none',
}

const input: CSSProperties = {
  position: 'relative',
  width: '100%',
  margin: 0,
  background: 'transparent',
  appearance: 'none',
  WebkitAppearance: 'none',
  height: 34,
  cursor: 'pointer',
}

const valueBadge: CSSProperties = {
  minWidth: 62,
  padding: '7px 10px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'color-mix(in srgb, var(--bg-elevated) 86%, transparent)',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  fontWeight: 700,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
}
