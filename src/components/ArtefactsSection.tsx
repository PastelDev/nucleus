import { useState, useEffect, useRef } from 'react'
import type { Artefact, ArtefactType } from '../lib/types'
import { uid } from '../lib/helpers'

interface Props {
  artefacts: Artefact[]
  setArtefacts: React.Dispatch<React.SetStateAction<Artefact[]>>
}

type ViewMode = 'split' | 'code' | 'preview'

/* ── Syntax highlighting ── */

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function span(color: string, content: string) {
  return `<span style="color:${color}">${content}</span>`
}

const C = {
  comment:  'var(--text-faint)',
  tag:      'var(--accent)',
  tagName:  'var(--accent-light)',
  attrName: 'var(--orange)',
  attrVal:  'var(--green)',
  keyword:  'var(--accent)',
  number:   'var(--blue)',
  brace:    'var(--orange)',
}

const JS_KEYWORDS = new Set([
  'function','const','let','var','return','if','else','import','export',
  'default','class','extends','new','this','typeof','instanceof','async',
  'await','from','true','false','null','undefined','of','in','for','while',
  'do','switch','case','break','continue','throw','try','catch','finally',
])

function colorizeAttrs(raw: string): string {
  let result = ''
  let i = 0
  while (i < raw.length) {
    if (/\s/.test(raw[i])) { result += raw[i++]; continue }
    let nameEnd = i
    while (nameEnd < raw.length && !/[\s=]/.test(raw[nameEnd])) nameEnd++
    if (nameEnd > i) result += span(C.attrName, esc(raw.slice(i, nameEnd)))
    i = nameEnd
    if (i >= raw.length || raw[i] !== '=') continue
    result += '='
    i++
    if (i >= raw.length) break
    if (raw[i] === '"' || raw[i] === "'") {
      const q = raw[i]
      let j = i + 1
      while (j < raw.length && raw[j] !== q) j++
      result += span(C.attrVal, esc(raw.slice(i, j + 1)))
      i = j + 1
    } else if (raw[i] === '{') {
      let depth = 0, j = i
      while (j < raw.length) {
        if (raw[j] === '{') depth++
        else if (raw[j] === '}') { depth--; if (depth === 0) { j++; break } }
        j++
      }
      result += span(C.brace, esc(raw.slice(i, j)))
      i = j
    } else {
      let j = i
      while (j < raw.length && !/\s/.test(raw[j])) j++
      result += span(C.attrVal, esc(raw.slice(i, j)))
      i = j
    }
  }
  return result
}

function colorizeOpenTag(raw: string): string {
  const m = /^<([\w.:-]+)/.exec(raw)
  if (!m) return esc(raw)
  const name = m[1]
  const selfClose = raw.endsWith('/>')
  const gt = selfClose ? '/>' : '>'
  const attrs = raw.slice(1 + name.length, raw.length - gt.length)
  return span(C.tag, '&lt;') + span(C.tagName, esc(name)) + colorizeAttrs(attrs) + span(C.tag, esc(gt))
}

function advanceToTagEnd(code: string, start: number): number {
  let j = start, inStr: string | null = null
  while (j < code.length) {
    const ch = code[j]
    if (inStr) { if (ch === inStr) inStr = null }
    else { if (ch === '"' || ch === "'") inStr = ch; else if (ch === '>') return j + 1 }
    j++
  }
  return j
}

function highlightHTML(code: string): string {
  let result = '', i = 0
  while (i < code.length) {
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i); const close = end === -1 ? code.length : end + 3
      result += span(C.comment, esc(code.slice(i, close))); i = close; continue
    }
    if (code.startsWith('<!', i)) {
      const close = code.indexOf('>', i) + 1 || code.length
      result += span(C.comment, esc(code.slice(i, close))); i = close; continue
    }
    if (code.startsWith('</', i) && i + 2 < code.length && /[\w]/.test(code[i + 2])) {
      const close = code.indexOf('>', i) + 1 || code.length
      const tagStr = code.slice(i, close)
      const m = /^<\/([\w.:-]+)/.exec(tagStr)
      result += m ? span(C.tag, '&lt;/') + span(C.tagName, esc(m[1])) + span(C.tag, '&gt;') : esc(tagStr)
      i = close; continue
    }
    if (code[i] === '<' && i + 1 < code.length && /[\w]/.test(code[i + 1])) {
      const close = advanceToTagEnd(code, i + 1)
      result += colorizeOpenTag(code.slice(i, close)); i = close; continue
    }
    let j = i + 1
    while (j < code.length && code[j] !== '<') j++
    result += esc(code.slice(i, j)); i = j
  }
  return result
}

function highlightJSX(code: string): string {
  let result = '', i = 0
  while (i < code.length) {
    // Single-line comment
    if (code.startsWith('//', i)) {
      const end = code.indexOf('\n', i); const close = end === -1 ? code.length : end
      result += span(C.comment, esc(code.slice(i, close))); i = close; continue
    }
    // Block comment
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i); const close = end === -1 ? code.length : end + 2
      result += span(C.comment, esc(code.slice(i, close))); i = close; continue
    }
    // JSX comment
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i); const close = end === -1 ? code.length : end + 3
      result += span(C.comment, esc(code.slice(i, close))); i = close; continue
    }
    // String literals
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i]; let j = i + 1
      while (j < code.length && code[j] !== q && code[j] !== '\n') { if (code[j] === '\\') j++; j++ }
      result += span(C.attrVal, esc(code.slice(i, j + 1))); i = j + 1; continue
    }
    // Template literals
    if (code[i] === '`') {
      let j = i + 1
      while (j < code.length && code[j] !== '`') { if (code[j] === '\\') j++; j++ }
      result += span(C.attrVal, esc(code.slice(i, j + 1))); i = j + 1; continue
    }
    // JSX closing tag
    if (code.startsWith('</', i) && i + 2 < code.length && /[\w]/.test(code[i + 2])) {
      const close = code.indexOf('>', i) + 1 || code.length
      const m = /^<\/([\w.:-]+)/.exec(code.slice(i, close))
      result += m ? span(C.tag, '&lt;/') + span(C.tagName, esc(m[1])) + span(C.tag, '&gt;') : esc(code.slice(i, close))
      i = close; continue
    }
    // JSX opening tag
    if (code[i] === '<' && i + 1 < code.length && /[\w]/.test(code[i + 1])) {
      const close = advanceToTagEnd(code, i + 1)
      result += colorizeOpenTag(code.slice(i, close)); i = close; continue
    }
    // Numbers
    if (/\d/.test(code[i]) && (i === 0 || !/[\w$]/.test(code[i - 1]))) {
      let j = i; while (j < code.length && /[\d.xXa-fA-F]/.test(code[j])) j++
      result += span(C.number, esc(code.slice(i, j))); i = j; continue
    }
    // Words / keywords
    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i; while (j < code.length && /[\w$]/.test(code[j])) j++
      const word = code.slice(i, j)
      result += JS_KEYWORDS.has(word) ? span(C.keyword, esc(word)) : esc(word)
      i = j; continue
    }
    // JSX expression braces
    if (code[i] === '{' || code[i] === '}') { result += span(C.brace, esc(code[i])); i++; continue }
    result += esc(code[i]); i++
  }
  return result
}

function highlightCode(code: string, type: ArtefactType): string {
  return type === 'html' ? highlightHTML(code) : highlightJSX(code)
}

/* ── Preview builder ── */

function buildPreview(a: Artefact): string {
  if (a.type === 'html') return a.code
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body { margin: 0; font-family: sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
${a.code}
    try {
      const el = typeof App !== 'undefined'
        ? React.createElement(App)
        : React.createElement('div', { style: { padding: 16, color: '#888' } }, 'Define a function named App() to render your component.')
      ReactDOM.createRoot(document.getElementById('root')).render(el)
    } catch(e) {
      document.getElementById('root').innerHTML = '<pre style="color:red;padding:16px;margin:0">' + e.message + '</pre>'
    }
  </script>
</body>
</html>`
}

/* ── Component ── */

export default function ArtefactsSection({ artefacts, setArtefacts }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('split')
  const [titleBuf, setTitleBuf] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const sel = artefacts.find(a => a.id === selected) ?? null

  useEffect(() => {
    if (artefacts.length > 0 && !selected) setSelected(artefacts[0].id)
  }, [artefacts, selected])

  useEffect(() => {
    if (sel) setTitleBuf(sel.title)
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Artefact>) => {
    setArtefacts(p => p.map(a => a.id === selected ? { ...a, ...patch, updatedAt: Date.now() } : a))
  }

  const createNew = () => {
    const a: Artefact = {
      id: uid(), title: 'Untitled', type: 'html',
      code: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <style>\n    body { margin: 0; font-family: sans-serif; padding: 24px; }\n  </style>\n</head>\n<body>\n  <h1>Hello, world!</h1>\n</body>\n</html>',
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    setArtefacts(p => [a, ...p])
    setSelected(a.id)
  }

  const deleteArtefact = (id: string) => {
    const a = artefacts.find(x => x.id === id)
    if (!a) return
    if (!window.confirm(`Delete "${a.title}"?`)) return
    const remaining = artefacts.filter(x => x.id !== id)
    setArtefacts(remaining)
    if (selected === id) setSelected(remaining[0]?.id ?? null)
  }

  const commitRename = (id: string) => {
    const draft = renameDraft.trim()
    if (draft) setArtefacts(p => p.map(a => a.id === id ? { ...a, title: draft, updatedAt: Date.now() } : a))
    setRenamingId(null)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const code = (ev.target?.result as string) ?? ''
      const type: ArtefactType = file.name.endsWith('.html') ? 'html' : 'react'
      const title = file.name.replace(/\.[^.]+$/, '')
      const a: Artefact = { id: uid(), title, type, code, createdAt: Date.now(), updatedAt: Date.now() }
      setArtefacts(p => [a, ...p])
      setSelected(a.id)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const commitTitle = () => {
    if (sel && titleBuf.trim() && titleBuf !== sel.title) update({ title: titleBuf.trim() })
  }

  const syncScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const editorShared: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.7,
    padding: '16px 18px', margin: 0,
    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    tabSize: 2, overflowWrap: 'break-word',
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      {/* ── Left sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-sidebar)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
            Artefacts
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={createNew} style={btnPrimary}>+ New</button>
            <button onClick={() => fileRef.current?.click()} style={btnSecondary} title="Upload .html, .jsx, .tsx, .js">Upload</button>
          </div>
          <input ref={fileRef} type="file" accept=".html,.jsx,.tsx,.js" style={{ display: 'none' }} onChange={handleUpload} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
          {artefacts.length === 0 && (
            <div style={{ padding: '20px 8px', fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center' }}>
              No artefacts yet
            </div>
          )}
          {artefacts.map(a => (
            <div
              key={a.id}
              style={{ position: 'relative', marginBottom: 1 }}
              onMouseEnter={() => setHoveredId(a.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {renamingId === a.id ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={e => setRenameDraft(e.target.value)}
                  onBlur={() => commitRename(a.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(a.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--bg-input)', border: '1px solid var(--accent)',
                    borderRadius: 7, padding: '6px 10px',
                    color: 'var(--text-primary)', fontSize: '0.82rem',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              ) : (
                <button
                  onClick={() => setSelected(a.id)}
                  onDoubleClick={() => { setSelected(a.id); setRenamingId(a.id); setRenameDraft(a.title) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 10px',
                    paddingRight: hoveredId === a.id ? 30 : 10,
                    borderRadius: 7, border: 'none',
                    background: selected === a.id ? 'var(--accent-surface)' : 'transparent',
                    color: selected === a.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: selected === a.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {a.title}
                  </span>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em',
                    color: a.type === 'react' ? 'var(--blue)' : 'var(--green)',
                    background: a.type === 'react' ? 'rgba(41,97,219,0.12)' : 'rgba(5,150,105,0.12)',
                    padding: '2px 5px', borderRadius: 4, flexShrink: 0, textTransform: 'uppercase',
                  }}>
                    {a.type === 'react' ? 'JSX' : 'HTML'}
                  </span>
                </button>
              )}

              {/* Delete on hover */}
              {hoveredId === a.id && renamingId !== a.id && (
                <button
                  onClick={e => { e.stopPropagation(); deleteArtefact(a.id) }}
                  title="Delete"
                  style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    width: 20, height: 20, borderRadius: 4, border: 'none',
                    background: 'var(--bg-elevated)', color: 'var(--red)',
                    cursor: 'pointer', fontSize: '0.7rem', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      {!sel ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
          Create or select an artefact
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            background: 'var(--bg-surface)',
          }}>
            <input
              value={titleBuf}
              onChange={e => setTitleBuf(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => e.key === 'Enter' && commitTitle()}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 700,
                fontFamily: 'var(--font-heading)',
              }}
            />
            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {(['html', 'react'] as ArtefactType[]).map(t => (
                <button key={t} onClick={() => update({ type: t })} style={{
                  padding: '4px 10px', borderRadius: 6, border: `1px solid ${sel.type === t ? (t === 'react' ? 'var(--blue)' : 'var(--green)') : 'var(--border)'}`,
                  background: sel.type === t ? (t === 'react' ? 'rgba(41,97,219,0.12)' : 'rgba(5,150,105,0.12)') : 'transparent',
                  color: sel.type === t ? (t === 'react' ? 'var(--blue)' : 'var(--green)') : 'var(--text-faint)',
                  cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontFamily: 'inherit',
                }}>
                  {t === 'react' ? 'JSX' : 'HTML'}
                </button>
              ))}
            </div>
            {/* View mode */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 7, padding: 3, flexShrink: 0 }}>
              {(['split', 'code', 'preview'] as ViewMode[]).map(m => (
                <button key={m} onClick={() => setView(m)} style={{
                  padding: '4px 10px', borderRadius: 5, border: 'none',
                  background: view === m ? 'var(--accent-surface)' : 'transparent',
                  color: view === m ? 'var(--accent-light)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.73rem', fontWeight: view === m ? 700 : 500,
                  fontFamily: 'inherit', textTransform: 'capitalize',
                }}>
                  {m}
                </button>
              ))}
            </div>
            <button onClick={() => setPreviewKey(k => k + 1)} title="Refresh preview" style={iconBtn}>↺</button>
          </div>

          {/* Editor + Preview */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {/* Code editor with syntax highlighting */}
            {(view === 'split' || view === 'code') && (
              <div style={{
                flex: view === 'code' ? 1 : '0 0 50%',
                borderRight: view === 'split' ? '1px solid var(--border-subtle)' : 'none',
                position: 'relative', overflow: 'hidden',
                background: 'var(--bg-deep)',
              }}>
                {/* Highlighted layer */}
                <pre
                  ref={preRef}
                  dangerouslySetInnerHTML={{ __html: highlightCode(sel.code, sel.type) + '\n ' }}
                  style={{
                    ...editorShared,
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />
                {/* Editable layer */}
                <textarea
                  ref={textareaRef}
                  value={sel.code}
                  onChange={e => update({ code: e.target.value })}
                  onScroll={syncScroll}
                  spellCheck={false}
                  style={{
                    ...editorShared,
                    color: 'transparent',
                    caretColor: 'var(--text-secondary)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    zIndex: 2,
                    overflow: 'auto',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const t = e.currentTarget
                      const s = t.selectionStart, en = t.selectionEnd
                      const v = t.value
                      t.value = v.slice(0, s) + '  ' + v.slice(en)
                      t.selectionStart = t.selectionEnd = s + 2
                      update({ code: t.value })
                    }
                  }}
                />
              </div>
            )}

            {/* Preview pane */}
            {(view === 'split' || view === 'preview') && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                {sel.type === 'react' && (
                  <div style={{
                    padding: '4px 10px', fontSize: '0.65rem', color: 'var(--text-faint)',
                    background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                  }}>
                    React preview requires internet (loads React + Babel from CDN)
                  </div>
                )}
                <iframe
                  key={previewKey}
                  srcDoc={buildPreview(sel)}
                  sandbox="allow-scripts"
                  style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
                  title="Artefact preview"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '6px 0', borderRadius: 7, border: 'none',
  background: 'var(--accent)', color: '#fff', cursor: 'pointer',
  fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '6px 0', borderRadius: 7,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-muted)', cursor: 'pointer',
  fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
}

const iconBtn: React.CSSProperties = {
  padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.8rem', flexShrink: 0,
}
