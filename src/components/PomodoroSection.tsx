import { useState, useEffect, useRef, useCallback } from 'react'
import type { PomodoroSettings } from '../lib/types'

interface Props {
  settings: PomodoroSettings
  setSettings: React.Dispatch<React.SetStateAction<PomodoroSettings>>
}

type PomMode = 'work' | 'break' | 'longbreak'

export default function PomodoroSection({ settings, setSettings }: Props) {
  const [mode, setMode] = useState<PomMode>('work')
  const [mins, setMins] = useState(settings.work)
  const [secs, setSecs] = useState(0)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dur = useCallback(
    () => ({ work: settings.work, break: settings.short, longbreak: settings.long }[mode]),
    [mode, settings],
  )

  useEffect(() => {
    if (!running) { setMins(dur()); setSecs(0) }
  }, [settings])

  useEffect(() => {
    if (running) {
      intRef.current = setInterval(() => {
        setSecs(s => {
          if (s === 0) {
            setMins(m => {
              if (m === 0) { setRunning(false); if (mode === 'work') setSessions(n => n + 1); return 0 }
              return m - 1
            })
            return 59
          }
          return s - 1
        })
      }, 1000)
    }
    return () => { if (intRef.current) clearInterval(intRef.current) }
  }, [running, mode])

  const switchMode = (m: PomMode) => {
    if (intRef.current) clearInterval(intRef.current)
    setRunning(false); setMode(m)
    const d = { work: settings.work, break: settings.short, longbreak: settings.long }[m]
    setMins(d); setSecs(0)
  }

  const reset = () => { setRunning(false); setMins(dur()); setSecs(0) }

  const total = dur() * 60
  const elapsed = total - (mins * 60 + secs)
  const pct = Math.min(elapsed / total, 1)
  const R = 90, circ = 2 * Math.PI * R
  const acc = mode === 'work' ? 'var(--accent)' : mode === 'break' ? 'var(--green)' : 'var(--blue)'

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.6rem', letterSpacing: '-0.03em', margin: '0 0 30px', fontFamily: 'var(--font-heading)' }}>
        Focus Timer
      </h2>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 5, background: 'var(--bg-surface)', borderRadius: 13, padding: 5, marginBottom: 44 }}>
        {([['work', 'Work'], ['break', 'Short Break'], ['longbreak', 'Long Break']] as [PomMode, string][]).map(([m, l]) => (
          <button key={m} onClick={() => switchMode(m)} style={{
            background: mode === m ? acc : 'transparent', border: 'none', borderRadius: 10,
            padding: '8px 16px', color: mode === m ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s', fontFamily: 'inherit',
          }}>{l}</button>
        ))}
      </div>

      {/* Timer ring */}
      <div style={{ position: 'relative', marginBottom: 36 }}>
        <svg width={224} height={224} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={112} cy={112} r={R} stroke="#161625" strokeWidth={11} fill="none" />
          <circle cx={112} cy={112} r={R} stroke={acc} strokeWidth={11} fill="none"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.85s ease, stroke 0.35s ease' }} />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <div style={{ fontSize: '3.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.05em', lineHeight: 1, fontFamily: 'var(--font-heading)' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
            {mode === 'work' ? 'Focus' : mode === 'break' ? 'Short Break' : 'Long Break'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 30 }}>
        <button onClick={reset} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '12px 22px', color: '#9090b0', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
        }}>Reset</button>
        <button onClick={() => setRunning(!running)} style={{
          background: acc, border: 'none', borderRadius: 12, padding: '12px 40px',
          color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '1.05rem',
          minWidth: 130, fontFamily: 'inherit', transition: 'background 0.3s',
        }}>{running ? 'Pause' : 'Start'}</button>
      </div>

      {/* Session dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: '50%',
            background: sessions >= i ? acc : 'var(--bg-elevated)',
            transition: 'background 0.3s',
          }} />
        ))}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>
          {sessions} session{sessions !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Custom durations */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
        padding: '20px 24px', width: '100%', boxSizing: 'border-box',
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>
          Custom Durations (min)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {([['work', 'Work'], ['short', 'Short Break'], ['long', 'Long Break']] as [keyof PomodoroSettings, string][]).map(([k, l]) => (
            <div key={k}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 6 }}>{l}</div>
              <input type="number" min={1} max={120} value={settings[k]}
                onChange={e => setSettings(p => ({ ...p, [k]: Math.max(1, parseInt(e.target.value) || 1) }))}
                style={{
                  width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
