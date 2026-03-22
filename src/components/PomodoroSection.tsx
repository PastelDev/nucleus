import { useState, useEffect, useRef } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { PomodoroSettings } from '../lib/types'

interface Props {
  settings: PomodoroSettings
  setSettings: Dispatch<SetStateAction<PomodoroSettings>>
  focusTopic: string
  setFocusTopic: (v: string) => void
  preventSleep: boolean
  setPreventSleep: (v: boolean) => void
}

type PomMode = 'work' | 'short' | 'long'

const getDuration = (mode: PomMode, settings: PomodoroSettings) =>
  ({ work: settings.work, short: settings.short, long: settings.long }[mode]) * 60

const getModeLabel = (mode: PomMode) =>
  ({ work: 'Focus', short: 'Short Break', long: 'Long Break' }[mode])

export default function PomodoroSection({ settings, setSettings, focusTopic, setFocusTopic, preventSleep, setPreventSleep }: Props) {
  const [mode, setMode] = useState<PomMode>('work')
  const [timeLeft, setTimeLeft] = useState(settings.work * 60)
  const [running, setRunning] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const modeRef = useRef(mode)
  const settingsRef = useRef(settings)
  const sessionsRef = useRef(completedSessions)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { sessionsRef.current = completedSessions }, [completedSessions])

  useEffect(() => {
    if (!running) setTimeLeft(getDuration(mode, settings))
  }, [settings, mode, running])

  useEffect(() => {
    const applyWakeLock = async () => {
      if (preventSleep) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch { /* unsupported */ }
      } else {
        if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null }
      }
    }
    applyWakeLock()
  }, [preventSleep])

  useEffect(() => {
    const onVisibility = async () => {
      if (preventSleep && document.visibilityState === 'visible' && !wakeLockRef.current) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [preventSleep])

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
    return () => { if (intRef.current) clearInterval(intRef.current) }
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
  const radius = 108
  const circumference = 2 * Math.PI * radius
  const accent = mode === 'work' ? 'var(--accent)' : mode === 'short' ? 'var(--green)' : 'var(--blue)'
  const cycleDots = Array.from({ length: Math.max(1, settings.rounds) }, (_, index) => index + 1)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', padding: '24px 32px' }}>

      {/* Settings gear button */}
      <button
        onClick={() => setSettingsOpen(true)}
        title="Settings"
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 6,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Focusing on */}
      <div style={{ width: '100%', maxWidth: 480, marginBottom: 20 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 7 }}>
          Focusing on
        </div>
        <input
          type="text"
          placeholder="What are you working on?"
          value={focusTopic}
          onChange={(e) => setFocusTopic(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 11,
            padding: '11px 14px',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            fontWeight: 600,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', borderRadius: 12, padding: 4, marginBottom: 22 }}>
        {([['work', 'Work'], ['short', 'Short Break'], ['long', 'Long Break']] as [PomMode, string][]).map(([value, label]) => (
          <button key={value} onClick={() => switchMode(value)} style={{
            background: mode === value ? accent : 'transparent',
            border: 'none',
            borderRadius: 9,
            padding: '8px 16px',
            color: mode === value ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.8rem',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div style={{ position: 'relative', marginBottom: 22 }}>
        <svg width={256} height={256} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={128} cy={128} r={radius} stroke="var(--bg-elevated)" strokeWidth={12} fill="none" />
          <circle
            cx={128}
            cy={128}
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
          <div style={{ fontSize: '3.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.05em', lineHeight: 1, fontFamily: 'var(--font-heading)' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 9, textTransform: 'uppercase', letterSpacing: '0.13em', fontWeight: 700 }}>
            {getModeLabel(mode)}
          </div>
          {focusTopic && (
            <div style={{ fontSize: '0.75rem', color: accent, marginTop: 5, fontWeight: 600, maxWidth: 150, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {focusTopic}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={resetCurrent} style={secondaryButton}>Reset</button>
        <button onClick={() => setRunning((c) => !c)} style={{ ...primaryButton, background: accent }}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={skipToNext} style={secondaryButton}>Skip</button>
      </div>

      {/* Cycle dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {cycleDots.map((step) => {
          const active = completedSessions % Math.max(1, settings.rounds) >= step || (completedSessions % Math.max(1, settings.rounds) === 0 && completedSessions > 0 && step === Math.max(1, settings.rounds))
          return (
            <div key={step} style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: active ? accent : 'var(--bg-elevated)',
              transition: 'background 0.3s ease',
            }} />
          )
        })}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 5 }}>
          {completedSessions} session{completedSessions !== 1 ? 's' : ''} done
        </span>
      </div>

      {/* Settings popup */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: '24px 26px',
              width: 360,
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
          >
            {/* Popup header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>Settings</div>
              <button
                onClick={() => setSettingsOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Prevent sleep toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 700 }}>Prevent computer from sleeping</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>Keeps the screen awake while you focus</div>
              </div>
              <button
                onClick={() => setPreventSleep(!preventSleep)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  background: preventSleep ? accent : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                  marginLeft: 16,
                  transition: 'background 0.2s',
                }}
                aria-label="Toggle prevent sleep"
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: preventSleep ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border)', marginBottom: 18 }} />

            {/* Timer settings */}
            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
              Timer (minutes)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                ['work', 'Work'],
                ['short', 'Short Break'],
                ['long', 'Long Break'],
                ['rounds', 'Rounds'],
              ] as [keyof PomodoroSettings, string][]).map(([key, label]) => (
                <label key={key} style={{ display: 'grid', gap: 5 }}>
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
      )}
    </div>
  )
}

const primaryButton: CSSProperties = {
  border: 'none',
  borderRadius: 11,
  padding: '11px 38px',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '0.95rem',
  minWidth: 120,
  fontFamily: 'inherit',
}

const secondaryButton: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 11,
  padding: '11px 22px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: 'inherit',
}

const numberInput: CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 9,
  padding: '9px 11px',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}
