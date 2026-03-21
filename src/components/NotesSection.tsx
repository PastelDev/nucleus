import { useState } from 'react'
import type { Note } from '../lib/types'
import { uid } from '../lib/helpers'
import Markdown from './Markdown'

interface Props {
  notes: Note[]
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>
}

export default function NotesSection({ notes, setNotes }: Props) {
  const [selId, setSelId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [tagInp, setTagInp] = useState('')

  const sel = notes.find(n => n.id === selId)
  const tags = [...new Set(notes.flatMap(n => n.tags || []))]
  const list = notes.filter(n => {
    const ms = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
    const mt = !filterTag || (n.tags || []).includes(filterTag)
    return ms && mt
  })

  const newNote = () => {
    const n: Note = { id: uid(), title: 'Untitled', content: '', tags: [], createdAt: Date.now() }
    setNotes(p => [n, ...p])
    setSelId(n.id)
    setEditMode(true)
  }

  const upd = (id: string, patch: Partial<Note>) => setNotes(p => p.map(n => n.id === id ? { ...n, ...patch } : n))
  const del = (id: string) => { setNotes(p => p.filter(n => n.id !== id)); setSelId(null) }

  const addTag = () => {
    const t = tagInp.trim().toLowerCase().replace(/\s+/g, '-')
    if (!t || !sel) return
    upd(sel.id, { tags: [...new Set([...(sel.tags || []), t])] })
    setTagInp('')
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar list */}
      <div style={{
        width: 248, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#09090f',
      }}>
        <div style={{ padding: '20px 14px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>Notes</span>
            <button onClick={newNote} style={{
              background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '5px 12px',
              color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
            }}>+ New</button>
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{
              width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.82rem',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Tags filter */}
        {tags.length > 0 && (
          <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button onClick={() => setFilterTag('')} style={{
              fontSize: '0.68rem', padding: '2px 9px', borderRadius: 20,
              border: '1px solid #252540', background: !filterTag ? 'var(--accent-surface)' : 'transparent',
              color: !filterTag ? 'var(--accent-light)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
            }}>All</button>
            {tags.map(t => (
              <button key={t} onClick={() => setFilterTag(filterTag === t ? '' : t)} style={{
                fontSize: '0.68rem', padding: '2px 9px', borderRadius: 20,
                border: '1px solid #252540', background: filterTag === t ? 'var(--accent-surface)' : 'transparent',
                color: filterTag === t ? 'var(--accent-light)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
              }}>#{t}</button>
            ))}
          </div>
        )}

        {/* Notes list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {list.length === 0 && (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.84rem', textAlign: 'center', marginTop: 24, padding: '0 12px' }}>No notes yet.</div>
          )}
          {list.map(n => (
            <div key={n.id} onClick={() => { setSelId(n.id); setEditMode(false) }} style={{
              padding: '10px 12px', borderRadius: 'var(--radius)', marginBottom: 3, cursor: 'pointer',
              background: selId === n.id ? 'var(--accent-surface)' : 'transparent',
              border: `1px solid ${selId === n.id ? 'var(--border-focus)' : 'transparent'}`,
              transition: 'all 0.1s',
            }}>
              <div style={{
                fontWeight: 600, color: selId === n.id ? '#d4c4ff' : 'var(--text-secondary)',
                fontSize: '0.86rem', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{n.title || 'Untitled'}</div>
              <div style={{
                fontSize: '0.73rem', color: 'var(--text-muted)',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{n.content.replace(/[#*`\-[\]]/g, '').slice(0, 70)}</div>
              {(n.tags || []).length > 0 && (
                <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {n.tags.map(t => <span key={t} style={{ fontSize: '0.63rem', background: '#1a1035', color: '#7060a0', padding: '1px 7px', borderRadius: 10 }}>#{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Note detail */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!sel ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: 14 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <div style={{ fontSize: '0.9rem', marginBottom: 16 }}>Select or create a note</div>
            <button onClick={newNote} style={{
              background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)',
              padding: '10px 22px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit',
            }}>New Note</button>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '32px 40px', maxWidth: 760 }}>
            {/* Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 16 }}>
              {editMode ? (
                <input
                  value={sel.title} onChange={e => upd(sel.id, { title: e.target.value })}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)',
                    letterSpacing: '-0.03em', fontFamily: 'var(--font-heading)',
                  }}
                />
              ) : (
                <h1 style={{
                  margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)',
                  letterSpacing: '-0.03em', flex: 1, fontFamily: 'var(--font-heading)',
                }}>{sel.title || 'Untitled'}</h1>
              )}
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button onClick={() => setEditMode(!editMode)} style={{
                  background: editMode ? 'var(--accent)' : 'var(--bg-elevated)', border: 'none', borderRadius: 8,
                  padding: '7px 14px', color: editMode ? '#fff' : '#888898', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                }}>{editMode ? 'Preview' : 'Edit'}</button>
                <button onClick={() => del(sel.id)} style={{
                  background: 'none', border: '1px solid #252538', borderRadius: 8,
                  padding: '7px 10px', color: '#44334a', cursor: 'pointer',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22, alignItems: 'center' }}>
              {(sel.tags || []).map(t => (
                <span key={t} style={{
                  background: 'var(--accent-surface)', color: 'var(--accent-light)', fontSize: '0.74rem',
                  padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5,
                  border: '1px solid var(--border-focus)',
                }}>
                  #{t}
                  <button onClick={() => upd(sel.id, { tags: sel.tags.filter(x => x !== t) })} style={{
                    background: 'none', border: 'none', color: '#7060a0', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.85rem',
                  }}>×</button>
                </span>
              ))}
              <input
                value={tagInp} onChange={e => setTagInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="+ tag"
                style={{
                  background: 'transparent', border: '1px dashed #252540', borderRadius: 20,
                  padding: '3px 10px', color: 'var(--text-muted)', fontSize: '0.72rem', outline: 'none', width: 70, fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Content */}
            {editMode ? (
              <textarea
                value={sel.content} onChange={e => upd(sel.id, { content: e.target.value })}
                placeholder="Start writing...\n\n# Heading\n## Sub heading\n**bold**  *italic*  `code`\n- list item\n- [ ] task\n- [x] done task"
                style={{
                  width: '100%', minHeight: 420, background: 'var(--bg-input)',
                  border: '1px solid var(--border)', borderRadius: 12, padding: 18,
                  color: 'var(--text-secondary)', fontSize: '0.92rem', fontFamily: 'inherit',
                  lineHeight: 1.8, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{ minHeight: 200 }}>
                {sel.content
                  ? <Markdown text={sel.content} />
                  : <div style={{ color: 'var(--text-faint)', fontStyle: 'italic', fontSize: '0.9rem' }}>Empty — click Edit to write.</div>
                }
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  )
}
