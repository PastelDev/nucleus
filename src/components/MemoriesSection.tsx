import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MemoryDirectoryNode, MemoryFileNode, MemoryTree } from '../lib/types'
import * as store from '../lib/storage'
import Markdown from './Markdown'
import SurfaceFrame from './SurfaceFrame'

interface Props {
  memoriesMd: string
  setMemoriesMd: (value: string) => void
}

function flattenFiles(dir: MemoryDirectoryNode): MemoryFileNode[] {
  return [...dir.files, ...dir.directories.flatMap(flattenFiles)]
}

function findFile(dir: MemoryDirectoryNode, path: string): MemoryFileNode | null {
  for (const file of dir.files) {
    if (file.path === path) return file
  }
  for (const child of dir.directories) {
    const file = findFile(child, path)
    if (file) return file
  }
  return null
}

function titleForFile(file: MemoryFileNode | null, tree: MemoryTree | null) {
  if (!file) return 'Memories'
  if (file.path === tree?.overviewPath) return 'Overview'
  if (file.path === tree?.agentSummaryPath) return 'Agent Summary'
  return file.name.replace(/\.md$/i, '')
}

function createUserMemoryTemplate(name: string) {
  return `# ${name}\n\nAdd context you want the assistant to remember.\n`
}

export default function MemoriesSection({ memoriesMd, setMemoriesMd }: Props) {
  const [tree, setTree] = useState<MemoryTree | null>(null)
  const [selectedPath, setSelectedPath] = useState<string>('memories/index.md')
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = async (nextPath?: string) => {
    setLoading(true)
    const nextTree = await store.loadMemoryTree()
    setTree(nextTree)
    const allFiles = flattenFiles(nextTree.root)
    const preferred = nextPath || selectedPath || nextTree.overviewPath
    const selected = allFiles.find((file) => file.path === preferred) ?? allFiles[0] ?? null
    setSelectedPath(selected?.path ?? nextTree.overviewPath)
    setDraft(selected?.content ?? '')
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!tree) return
    if (selectedPath !== tree.agentSummaryPath) return
    setDraft(memoriesMd)
  }, [memoriesMd, selectedPath, tree])

  const selectedFile = useMemo(() => (tree ? findFile(tree.root, selectedPath) : null), [selectedPath, tree])
  const isLogFile = !!selectedFile?.path.includes('/log/')
  const canDelete = !!selectedFile && !isLogFile && selectedFile.path.startsWith('memories/user/')
  const canEdit = !!selectedFile && !isLogFile

  useEffect(() => {
    setDraft(selectedFile?.content ?? '')
    setEditMode(false)
  }, [selectedFile?.path])

  const saveCurrent = async () => {
    if (!selectedFile) return
    await store.saveMD(selectedFile.path, draft)
    if (tree && selectedFile.path === tree.agentSummaryPath) {
      setMemoriesMd(draft)
    }
    setEditMode(false)
    await reload(selectedFile.path)
  }

  const createUserFile = async () => {
    const rawName = window.prompt('Name for the new memory file?', 'new-memory')
    if (!rawName) return
    const slug = rawName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'new-memory'
    const path = `memories/user/${slug}.md`
    await store.saveMD(path, createUserMemoryTemplate(rawName.trim()))
    await reload(path)
    setEditMode(true)
  }

  const deleteCurrent = async () => {
    if (!selectedFile || !canDelete) return
    if (!window.confirm(`Delete "${selectedFile.name}"?`)) return
    await store.deleteMemoryFile(selectedFile.path)
    await reload(tree?.overviewPath)
  }

  const renderDirectory = (dir: MemoryDirectoryNode, depth = 0) => {
    const files = [...dir.files].sort((a, b) => a.name.localeCompare(b.name))
    const directories = [...dir.directories].sort((a, b) => a.name.localeCompare(b.name))
    return (
      <div key={dir.path} style={{ display: 'grid', gap: 4 }}>
        {dir.path !== 'memories' && (
          <div style={{ paddingLeft: 12 + depth * 12, fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
            {dir.name}
          </div>
        )}
        {files.map((file) => {
          const active = selectedPath === file.path
          return (
            <button
              key={file.path}
              onClick={() => setSelectedPath(file.path)}
              style={{
                textAlign: 'left',
                border: 'none',
                borderRadius: 10,
                padding: `9px 12px 9px ${12 + depth * 12}px`,
                background: active ? 'var(--accent-surface)' : 'transparent',
                color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                fontWeight: active ? 700 : 500,
              }}
            >
              {titleForFile(file, tree)}
            </button>
          )
        })}
        {directories.map((child) => renderDirectory(child, depth + 1))}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      <SurfaceFrame
        targetId="panel:memories-browser"
        role="panel"
        glass="panel"
        style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}
        contentStyle={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.98rem', fontFamily: 'var(--font-heading)' }}>Memories</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 6, lineHeight: 1.5 }}>
            Folder-backed markdown memory for the assistant and for you.
          </div>
          <button onClick={createUserFile} style={{ marginTop: 12, width: '100%', border: 'none', borderRadius: 10, padding: '10px 12px', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
            New User Memory
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 10px 14px' }}>
          {loading && <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem', padding: '8px 10px' }}>Loading memories…</div>}
          {!loading && tree && renderDirectory(tree.root)}
        </div>
      </SurfaceFrame>

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '26px 32px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Memory File</div>
            <h2 style={{ margin: '10px 0 4px', fontSize: '1.5rem', letterSpacing: '-0.03em', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              {titleForFile(selectedFile, tree)}
            </h2>
            <div style={{ color: 'var(--text-faint)', fontSize: '0.74rem' }}>{selectedFile?.path ?? 'No file selected'}</div>
          </div>
          {selectedFile && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {editMode ? (
                <>
                  <button onClick={saveCurrent} style={primaryBtn}>Save</button>
                  <button onClick={() => { setDraft(selectedFile.content); setEditMode(false) }} style={ghostBtn}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setEditMode(true)} disabled={!canEdit} style={{ ...ghostBtn, opacity: canEdit ? 1 : 0.45 }}>
                  {canEdit ? 'Edit' : 'Read Only'}
                </button>
              )}
              {canDelete && <button onClick={deleteCurrent} style={{ ...ghostBtn, color: 'var(--red)' }}>Delete</button>}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 32px 36px' }}>
          {!selectedFile && !loading && (
            <div style={{ color: 'var(--text-faint)', fontSize: '0.88rem' }}>Select a memory file from the left.</div>
          )}
          {selectedFile && editMode && (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              style={{
                width: '100%',
                minHeight: 520,
                borderRadius: 16,
                border: '1px solid var(--border-focus)',
                background: 'color-mix(in srgb, var(--bg-input) 92%, transparent)',
                color: 'var(--text-primary)',
                outline: 'none',
                padding: 18,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.84rem',
                lineHeight: 1.8,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          )}
          {selectedFile && !editMode && (
            <div style={{ minHeight: 220 }}>
              <Markdown text={draft || selectedFile.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: 'inherit',
}

const ghostBtn: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 14px',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontWeight: 600,
  fontFamily: 'inherit',
}
