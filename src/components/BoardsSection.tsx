import { useState } from 'react'
import type { BoardCollection } from '../lib/types'
import { boardCollectionToScope } from '../lib/storage'
import WhiteboardEngine from './WhiteboardEngine'

const COLLECTIONS: Array<{ id: BoardCollection; label: string; description: string }> = [
  { id: 'boards', label: 'Boards', description: 'General boards and project canvases' },
  { id: 'personal', label: 'Personal', description: 'Legacy personal boards from the old Me area' },
]

export default function BoardsSection() {
  const [collection, setCollection] = useState<BoardCollection>(() => {
    const saved = localStorage.getItem('nucleus-board-collection')
    return saved === 'personal' ? 'personal' : 'boards'
  })

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px 0', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 16, background: 'color-mix(in srgb, var(--bg-elevated) 88%, transparent)', border: '1px solid var(--border-subtle)' }}>
          {COLLECTIONS.map((entry) => {
            const active = collection === entry.id
            return (
              <button
                key={entry.id}
                onClick={() => {
                  setCollection(entry.id)
                  localStorage.setItem('nucleus-board-collection', entry.id)
                }}
                style={{
                  border: 'none',
                  borderRadius: 12,
                  padding: '8px 14px',
                  background: active ? 'var(--accent-surface)' : 'transparent',
                  color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 600,
                  fontFamily: 'inherit',
                  minWidth: 112,
                }}
                title={entry.description}
              >
                {entry.label}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <WhiteboardEngine
          scope={boardCollectionToScope(collection)}
          title={collection === 'boards' ? 'Boards' : 'Personal Boards'}
        />
      </div>
    </div>
  )
}
