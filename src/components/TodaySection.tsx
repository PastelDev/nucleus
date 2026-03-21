import { useState } from 'react'
import type { Task, CalendarEvent, Section } from '../lib/types'
import { uid, today, greeting, dailyQuote } from '../lib/helpers'

interface Props {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  events: CalendarEvent[]
  setSection: (s: Section) => void
}

export default function TodaySection({ tasks, setTasks, events, setSection }: Props) {
  const [newTask, setNewTask] = useState('')
  const td = today()
  const todayTasks = tasks.filter(t => t.date === td)
  const todayEvents = events.filter(e => e.date === td).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const done = todayTasks.filter(t => t.done).length
  const dq = dailyQuote()

  const add = () => {
    if (!newTask.trim()) return
    setTasks(p => [{ id: uid(), text: newTask.trim(), done: false, date: td }, ...p])
    setNewTask('')
  }

  return (
    <div style={{ maxWidth: 660, margin: '0 auto', padding: '44px 28px' }}>
      {/* Date & greeting */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.18em',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 6,
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <h1 style={{
          fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0,
          letterSpacing: '-0.035em', fontFamily: 'var(--font-heading)',
        }}>
          {greeting()}, Stelios
        </h1>
      </div>

      {/* Quote */}
      <div style={{
        background: 'linear-gradient(135deg, #16102e, #1c1640)',
        border: '1px solid #2a1e50', borderRadius: 16, padding: '22px 26px', marginBottom: 36,
      }}>
        <div style={{ fontSize: '1rem', color: 'var(--accent-light)', fontStyle: 'italic', lineHeight: 1.65 }}>
          "{dq.t}"
        </div>
        <div style={{ fontSize: '0.76rem', color: '#504870', marginTop: 10, fontWeight: 600 }}>
          — {dq.a}
        </div>
      </div>

      {/* Tasks */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>
            Today's Tasks
          </span>
          {todayTasks.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: '#606088' }}>
              <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{done}</span> / {todayTasks.length}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {todayTasks.length > 0 && (
          <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(done / todayTasks.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
              borderRadius: 2, transition: 'width 0.4s ease',
            }} />
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Add a task for today..."
            style={{
              flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text-primary)',
              fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={add} style={{
            background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)',
            padding: '10px 18px', color: '#fff', cursor: 'pointer', fontWeight: 700,
            fontSize: '0.85rem', fontFamily: 'inherit',
          }}>Add</button>
        </div>

        {/* Empty state */}
        {todayTasks.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: '0.88rem', textAlign: 'center', padding: '18px 0' }}>
            No tasks yet — add one above
          </div>
        )}

        {/* Task list */}
        {todayTasks.map(task => (
          <div key={task.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: 'var(--bg-surface)', borderRadius: 'var(--radius)', marginBottom: 5,
            border: '1px solid var(--border)',
          }}>
            <button onClick={() => setTasks(p => p.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={{
              width: 20, height: 20, flexShrink: 0, borderRadius: 6,
              border: `2px solid ${task.done ? 'var(--accent)' : '#2e2e48'}`,
              background: task.done ? 'var(--accent)' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, transition: 'all 0.15s',
            }}>
              {task.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><path d="M20 6L9 17l-5-5" /></svg>}
            </button>
            <span style={{
              flex: 1, color: task.done ? '#3a3a5a' : 'var(--text-secondary)',
              textDecoration: task.done ? 'line-through' : 'none', fontSize: '0.9rem',
            }}>{task.text}</span>
            <button onClick={() => setTasks(p => p.filter(t => t.id !== task.id))} style={{
              background: 'none', border: 'none', color: 'var(--text-faint)',
              cursor: 'pointer', padding: '0 2px', fontSize: '1rem',
            }}>×</button>
          </div>
        ))}
      </div>

      {/* Today's events (clickable → calendar) */}
      {todayEvents.length > 0 && (
        <div>
          <div
            onClick={() => setSection('calendar')}
            style={{
              fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.14em',
              textTransform: 'uppercase', fontWeight: 700, marginBottom: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            Today's Events
            <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>→ view all</span>
          </div>
          {todayEvents.map(ev => (
            <div key={ev.id} onClick={() => setSection('calendar')} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${ev.color}`, borderRadius: '0 10px 10px 0',
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 5, cursor: 'pointer', transition: 'background 0.12s',
            }}>
              {ev.time && <span style={{ color: '#606080', fontSize: '0.78rem', fontWeight: 600, minWidth: 40 }}>{ev.time}</span>}
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{ev.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
