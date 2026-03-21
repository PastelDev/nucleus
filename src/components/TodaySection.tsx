import { useState, useEffect } from 'react'
import type { Task, CalendarEvent, Section } from '../lib/types'
import { uid, today, greeting } from '../lib/helpers'
import { listEventOccurrencesForDate, recurrenceLabel } from '../lib/calendar'

interface Props {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  events: CalendarEvent[]
  setSection: (s: Section) => void
}

interface APOD {
  title: string
  url: string
  hdurl?: string
  explanation: string
  media_type: string
  date: string
}

export default function TodaySection({ tasks, setTasks, events, setSection }: Props) {
  const [newTask, setNewTask] = useState('')
  const [apod, setApod] = useState<APOD | null>(null)
  const [apodExpanded, setApodExpanded] = useState(false)
  const td = today()
  const todayTasks = tasks.filter(t => t.date === td)
  const todayEvents = listEventOccurrencesForDate(events, td)
  const done = todayTasks.filter(t => t.done).length

  useEffect(() => {
    const cacheKey = 'nucleus-apod-' + new Date().toISOString().slice(0, 10)
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { setApod(JSON.parse(cached)); return }
    fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY')
      .then(r => r.json())
      .then(d => { setApod(d); sessionStorage.setItem(cacheKey, JSON.stringify(d)) })
      .catch(() => {})
  }, [])

  const add = () => {
    if (!newTask.trim()) return
    setTasks(p => [{ id: uid(), text: newTask.trim(), done: false, date: td }, ...p])
    setNewTask('')
  }

  return (
    <div style={{ maxWidth: 660, margin: '0 auto', padding: '44px 28px' }}>
      {/* Date & greeting */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.035em', fontFamily: 'var(--font-heading)' }}>
          {greeting()}
        </h1>
      </div>

      {/* NASA APOD */}
      {apod && apod.media_type === 'image' && (
        <div style={{ marginBottom: 28, borderRadius: 16, overflow: 'hidden', border: '1px solid #1e1540', background: '#0d0a20' }}>
          <div
            onClick={() => setApodExpanded(!apodExpanded)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <img
              src={apod.url}
              alt={apod.title}
              style={{
                width: '100%',
                height: apodExpanded ? 'auto' : 200,
                objectFit: 'cover',
                display: 'block',
                transition: 'height 0.3s',
              }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(7,4,18,0.92) 0%, transparent 55%)',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '0.6rem', color: '#7060a0', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>NASA · Image of the Day</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e0d0ff', letterSpacing: '-0.01em' }}>{apod.title}</div>
            </div>
          </div>
          {apodExpanded && (
            <div style={{ padding: '12px 16px 16px' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.7 }}>
                {apod.explanation.slice(0, 380)}{apod.explanation.length > 380 ? '…' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>Today's Tasks</span>
          {todayTasks.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: '#606088' }}>
              <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{done}</span> / {todayTasks.length}
            </span>
          )}
        </div>

        {todayTasks.length > 0 && (
          <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(done / todayTasks.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
              borderRadius: 2, transition: 'width 0.4s ease',
            }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Add a task for today..."
            style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={add} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '10px 18px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit' }}>Add</button>
        </div>

        {todayTasks.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: '0.88rem', textAlign: 'center', padding: '18px 0' }}>No tasks yet — add one above</div>
        )}

        {todayTasks.map(task => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', marginBottom: 5, border: '1px solid var(--border)' }}>
            <button onClick={() => setTasks(p => p.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={{
              width: 20, height: 20, flexShrink: 0, borderRadius: 6,
              border: `2px solid ${task.done ? 'var(--accent)' : '#2e2e48'}`,
              background: task.done ? 'var(--accent)' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, transition: 'all 0.15s',
            }}>
              {task.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><path d="M20 6L9 17l-5-5" /></svg>}
            </button>
            <span style={{ flex: 1, color: task.done ? '#3a3a5a' : 'var(--text-secondary)', textDecoration: task.done ? 'line-through' : 'none', fontSize: '0.9rem' }}>{task.text}</span>
            <button onClick={() => setTasks(p => p.filter(t => t.id !== task.id))} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '0 2px', fontSize: '1rem' }}>×</button>
          </div>
        ))}
      </div>

      {/* Today's Events — always visible */}
      <div>
        <div onClick={() => setSection('calendar')} style={{
          fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.14em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 12,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Today's Events
          <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 400 }}>→ view calendar</span>
        </div>
        {todayEvents.length === 0 ? (
          <div style={{
            color: 'var(--text-faint)', fontSize: '0.84rem', padding: '14px 16px',
            background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            textAlign: 'center', cursor: 'pointer',
          }} onClick={() => setSection('calendar')}>No events today — click to add one</div>
        ) : (
          todayEvents.map(ev => (
            <div key={ev.id} onClick={() => setSection('calendar')} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${ev.color}`, borderRadius: '0 10px 10px 0',
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 5, cursor: 'pointer',
            }}>
              {ev.time && <span style={{ color: '#606080', fontSize: '0.78rem', fontWeight: 600, minWidth: 40 }}>{ev.time}</span>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{ev.title}</span>
                {ev.recurrence !== 'none' && <span style={{ color: 'var(--accent-light)', fontSize: '0.68rem' }}>{recurrenceLabel(ev.recurrence)}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
