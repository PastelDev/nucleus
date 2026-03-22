import { useState } from 'react'
import type { CalendarEvent, EventRecurrence } from '../lib/types'
import { uid, today, fmtDate, EVENT_PALETTE } from '../lib/helpers'
import { listEventOccurrencesForDate, recurrenceLabel } from '../lib/calendar'

interface Props {
  events: CalendarEvent[]
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>
}

export default function CalendarSection({ events, setEvents }: Props) {
  const [vd, setVd] = useState(new Date())
  const [selDay, setSelDay] = useState<number | null>(null)
  const [nev, setNev] = useState<{ title: string; time: string; color: string; recurrence: EventRecurrence }>({ title: '', time: '', color: '#7c3aed', recurrence: 'none' })
  const [dragId, setDragId] = useState<string | null>(null)

  const yr = vd.getFullYear(), mo = vd.getMonth()
  const firstDow = new Date(yr, mo, 1).getDay()
  const daysInMo = new Date(yr, mo + 1, 0).getDate()
  const dk = (d: number) => `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const dayEvs = (d: number) => listEventOccurrencesForDate(events, dk(d))
  const isToday = (d: number) => dk(d) === today()

  const addEv = () => {
    if (!nev.title.trim() || !selDay) return
    setEvents(p => [...p, { id: uid(), ...nev, date: dk(selDay) }])
    setNev({ title: '', time: '', color: '#7c3aed', recurrence: 'none' })
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let i = 1; i <= daysInMo; i++) cells.push(i)

  const selEvs = selDay ? listEventOccurrencesForDate(events, dk(selDay)) : []

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Calendar grid */}
      <div style={{ flex: 1, padding: '24px 28px 12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
          <h2 style={{
            margin: 0, color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.5rem',
            letterSpacing: '-0.03em', fontFamily: 'var(--font-heading)',
          }}>{vd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={() => setVd(new Date(yr, mo - 1))} style={navBtn}>‹</button>
            <button onClick={() => { setVd(new Date()); setSelDay(new Date().getDate()) }} style={{ ...navBtn, fontSize: '0.78rem', fontWeight: 600 }}>Today</button>
            <button onClick={() => setVd(new Date(yr, mo + 1))} style={navBtn}>›</button>
          </div>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3, flexShrink: 0 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Grid — fills remaining height */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', gap: 3, minHeight: 0 }}>
          {cells.map((d, i) => (
            <div key={i}
              onDragOver={d ? e => e.preventDefault() : undefined}
              onDrop={d && dragId ? () => { setEvents(p => p.map(ev => ev.id === dragId ? { ...ev, date: dk(d) } : ev)); setDragId(null) } : undefined}
              onClick={() => d && setSelDay(d === selDay ? null : d)}
              style={{
                background: d ? (selDay === d ? 'var(--accent-surface)' : 'var(--bg-surface)') : 'transparent',
                borderRadius: 'var(--radius)', padding: '8px 10px',
                cursor: d ? 'pointer' : 'default',
                border: `1px solid ${selDay === d ? 'var(--border-focus)' : d ? 'var(--border)' : 'transparent'}`,
                transition: 'background 0.12s, border-color 0.12s',
                overflow: 'hidden',
              }}>
              {d && (
                <>
                  <div style={{
                    fontSize: '0.8rem', fontWeight: isToday(d) ? 700 : 500,
                    color: isToday(d) ? '#fff' : 'var(--text-muted)',
                    background: isToday(d) ? 'var(--accent)' : 'transparent',
                    borderRadius: '50%', width: 24, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 4,
                  }}>{d}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayEvs(d).slice(0, 3).map(ev => (
                      <div key={`${ev.id}-${ev.occurrenceDate}`} draggable onDragStart={() => setDragId(ev.id)} style={{
                        fontSize: '0.65rem', background: ev.color + '28',
                        borderLeft: `2px solid ${ev.color}`, color: ev.color,
                        borderRadius: '0 3px 3px 0', padding: '2px 5px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab',
                        fontWeight: 500,
                      }}>{ev.recurrence !== 'none' ? '↻ ' : ''}{ev.time ? `${ev.time} ` : ''}{ev.title}</div>
                    ))}
                    {dayEvs(d).length > 3 && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', paddingLeft: 5 }}>+{dayEvs(d).length - 3} more</div>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ paddingTop: 8, fontSize: '0.68rem', color: 'var(--text-ghost)', textAlign: 'center', flexShrink: 0 }}>
          Drag events to reschedule · Click a day to add
        </div>
      </div>

      {/* Day detail panel */}
      {selDay && (
        <div style={{
          width: 252, borderLeft: '1px solid var(--border)', padding: '22px 16px',
          overflow: 'auto', flexShrink: 0, background: 'var(--bg-sidebar)',
        }}>
          <div style={{ fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>
            {fmtDate(dk(selDay))}
          </div>

          {/* Add event form */}
          <div style={{ marginBottom: 18 }}>
            <input value={nev.title} onChange={e => setNev(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addEv()}
              placeholder="Event title..."
              style={{ ...inputStyle, marginBottom: 6 }} />
            <input value={nev.time} onChange={e => setNev(p => ({ ...p, time: e.target.value }))}
              placeholder="Time (14:30)"
              style={{ ...inputStyle, marginBottom: 9 }} />
            <select
              value={nev.recurrence}
              onChange={e => setNev(p => ({ ...p, recurrence: e.target.value as EventRecurrence }))}
              style={{ ...inputStyle, marginBottom: 9, appearance: 'none' }}
            >
              <option value="none">One time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {EVENT_PALETTE.map(c => (
                <button key={c} onClick={() => setNev(p => ({ ...p, color: c }))} style={{
                  width: 22, height: 22, borderRadius: '50%', background: c,
                  border: `2px solid ${nev.color === c ? '#fff' : 'transparent'}`,
                  cursor: 'pointer', padding: 0,
                }} />
              ))}
            </div>
            <button onClick={addEv} style={{
              width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 9,
              padding: 9, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem', fontFamily: 'inherit',
            }}>Add Event</button>
          </div>

          {/* Event list */}
          {selEvs.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.83rem', textAlign: 'center', marginTop: 10 }}>No events</div>
          ) : (
            selEvs.map(ev => (
              <div key={ev.id} className="liquid-glass-subtle" style={{
                borderRadius: 'var(--radius)', padding: '10px 12px',
                marginBottom: 6, borderLeft: `3px solid ${ev.color}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', fontWeight: 600 }}>{ev.title}</div>
                  {ev.time && <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem', marginTop: 2 }}>{ev.time}</div>}
                  {ev.recurrence !== 'none' && <div style={{ color: 'var(--accent-light)', fontSize: '0.7rem', marginTop: 2 }}>{recurrenceLabel(ev.recurrence)}</div>}
                </div>
                <button onClick={() => setEvents(p => p.filter(e => e.id !== ev.id))} style={{
                  background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '1rem', padding: 0,
                }}>×</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '6px 14px', color: '#9090b0', cursor: 'pointer', fontWeight: 700,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.84rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
