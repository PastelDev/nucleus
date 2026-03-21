import { useState, useEffect, useRef } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { PomodoroSettings } from '../lib/types'

interface Props {
  settings: PomodoroSettings
  setSettings: Dispatch<SetStateAction<PomodoroSettings>>
}

type PomMode = 'work' | 'short' | 'long'

const getDuration = (mode: PomMode, settings: PomodoroSettings) =>
  ({ work: settings.work, short: settings.short, long: settings.long }[mode]) * 60

const getModeLabel = (mode: PomMode) =>
  ({ work: 'Focus', short: 'Short Break', long: 'Long Break' }[mode])

export default function PomodoroSection({ settings, setSettings }: Props) {
  const [mode, setMode] = useState<PomMode>('work')
  const [timeLeft, setTimeLeft] = useState(settings.work * 60)
  const [running, setRunning] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const modeRef = useRef(mode)
  const settingsRef = useRef(settings)
  const sessionsRef = useRef(completedSessions)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { sessionsRef.current = completedSessions }, [completedSessions])

  useEffect(() => {
    if (!running) setTimeLeft(getDuration(mode, settings))
  }, [settings, mode, running])

  const transitionTo = (nextMode: PomMode, autoStart: boolean) => {
    setMode(nextMode)
    setTimeLeft(getDuration(nextMode, settingsRef.current))
    setRunning(autoStart)
  }

  const completeInterval = () => {
    if (modeRef.current === 'work') {
      const nextCompleted = sessionsRef.current + 1
      setCompletedSessions(nextCompleted)
      const breakMode: PomMode = nextCompleted % Math.max(1, settingsRef.current.rounds) === 0 ? 'long' : 'short'
      transitionTo(breakMode, true)
      return
    }
    transitionTo('work', true)
  }

  useEffect(() => {
    if (!running) return
    intRef.current = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(intRef.current!)
          setTimeout(completeInterval, 0)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => {
      if (intRef.current) clearInterval(intRef.current)
    }
  }, [running])

  const switchMode = (nextMode: PomMode) => {
    if (intRef.current) clearInterval(intRef.current)
    setRunning(false)
    setMode(nextMode)
    setTimeLeft(getDuration(nextMode, settings))
  }

  const resetCurrent = () => {
    setRunning(false)
    setTimeLeft(getDuration(mode, settings))
  }

  const skipToNext = () => {
    if (intRef.current) clearInterval(intRef.current)
    setRunning(false)
    completeInterval()
  }

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const total = getDuration(mode, settings)
  const pct = Math.min((total - timeLeft) / total, 1)
  const radius = 92
  const circumference = 2 * Math.PI * radius
  const accent = mode === 'work' ? 'var(--accent)' : mode === 'short' ? 'var(--green)' : 'var(--blue)'
  const nextBreakIsLong = (completedSessions + 1) % Math.max(1, settings.rounds) === 0
  const cycleDots = Array.from({ length: Math.max(1, settings.rounds) }, (_, index) => index + 1)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '38px 24px 54px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.7rem', letterSpacing: '-0.03em', margin: '0 0 10px', fontFamily: 'var(--font-heading)' }}>
        Pomodoro Flow
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, textAlign: 'center', maxWidth: 560, marginBottom: 28 }}>
        Work and break sessions now cycle like a real pomodoro timer. Finish a focus session and the timer rolls straight into the next break.
      </p>

      <div style={{ display: 'flex', gap: 5, background: 'var(--bg-surface)', borderRadius: 13, padding: 5, marginBottom: 32 }}>
        {([['work', 'Work'], ['short', 'Short Break'], ['long', 'Long Break']] as [PomMode, string][]).map(([value, label]) => (
          <button key={value} onClick={() => switchMode(value)} style={{
            background: mode === value ? accent : 'transparent',
            border: 'none',
            borderRadius: 10,
            padding: '9px 16px',
            color: mode === value ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.82rem',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 30 }}>
        <svg width={232} height={232} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={116} cy={116} r={radius} stroke="var(--bg-elevated)" strokeWidth={12} fill="none" />
          <circle
            cx={116}
            cy={116}
            r={radius}
            stroke={accent}
            strokeWidth={12}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <div style={{ fontSize: '3.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.05em', lineHeight: 1, fontFamily: 'var(--font-heading)' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.13em', fontWeight: 700 }}>
            {getModeLabel(mode)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={resetCurrent} style={secondaryButton}>Reset</button>
        <button onClick={() => setRunning((current) => !current)} style={{ ...primaryButton, background: accent }}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={skipToNext} style={secondaryButton}>Skip</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30, flexWrap: 'wrap', justifyContent: 'center' }}>
        {cycleDots.map((step) => {
          const active = completedSessions % Math.max(1, settings.rounds) >= step || (completedSessions % Math.max(1, settings.rounds) === 0 && completedSessions > 0 && step === Math.max(1, settings.rounds))
          return (
            <div key={step} style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: active ? 'var(--accent)' : 'var(--bg-elevated)',
              transition: 'background 0.3s ease',
            }} />
          )
        })}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>
          {completedSessions} completed focus session{completedSessions !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 22,
      }}>
        <div style={infoCard}>
          <div style={infoLabel}>Current Phase</div>
          <div style={infoValue}>{getModeLabel(mode)}</div>
          <div style={infoText}>
            {mode === 'work' ? 'Stay on task until the bell.' : 'Use the break before the next focus block starts.'}
          </div>
        </div>
        <div style={infoCard}>
          <div style={infoLabel}>Next Automatic Switch</div>
          <div style={infoValue}>
            {mode === 'work' ? (nextBreakIsLong ? 'Long Break' : 'Short Break') : 'Focus'}
          </div>
          <div style={infoText}>
            {mode === 'work'
              ? `After this focus block, session ${completedSessions + 1} moves into ${nextBreakIsLong ? 'a long reset' : 'a short reset'}.`
              : 'Breaks roll back into work automatically unless you pause.'}
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '22px 24px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>
          Pomodoro Settings
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
          {([
            ['work', 'Work'],
            ['short', 'Short Break'],
            ['long', 'Long Break'],
            ['rounds', 'Rounds'],
          ] as [keyof PomodoroSettings, string][]).map(([key, label]) => (
            <label key={key} style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{label}</span>
              <input
                type="number"
                min={1}
                max={key === 'rounds' ? 12 : 120}
                value={settings[key]}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  [key]: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                }))}
                style={numberInput}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

const primaryButton: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '12px 42px',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '1rem',
  minWidth: 132,
  fontFamily: 'inherit',
}

const secondaryButton: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '12px 24px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: 'inherit',
}

const infoCard: CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: '18px 20px',
}

const infoLabel: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 700,
  marginBottom: 8,
}

const infoValue: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: '1.15rem',
  fontWeight: 800,
  fontFamily: 'var(--font-heading)',
  marginBottom: 8,
}

const infoText: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.86rem',
  lineHeight: 1.6,
}

const numberInput: CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: '0.92rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}
