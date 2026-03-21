/**
 * Minimal markdown renderer for notes and AI chat.
 */
export default function Markdown({ text }: { text: string }) {
  if (!text) return null
  return (
    <div style={{ lineHeight: 1.8, fontSize: '0.92rem' }}>
      {text.split('\n').map((ln, i) => {
        if (/^### /.test(ln))
          return <div key={i} style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--accent-light)', marginTop: 10, fontFamily: 'var(--font-heading)' }}>{ln.slice(4)}</div>
        if (/^## /.test(ln))
          return <div key={i} style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-light)', marginTop: 14, fontFamily: 'var(--font-heading)' }}>{ln.slice(3)}</div>
        if (/^# /.test(ln))
          return <div key={i} style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)', marginTop: 16, fontFamily: 'var(--font-heading)' }}>{ln.slice(2)}</div>
        if (/^- \[x\] /.test(ln))
          return <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}><span style={{ color: 'var(--accent)' }}>✓</span><span style={{ textDecoration: 'line-through', color: '#555575' }}>{ln.slice(6)}</span></div>
        if (/^- \[ \] /.test(ln))
          return <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}><span style={{ color: 'var(--text-faint)' }}>○</span><span style={{ color: 'var(--text-secondary)' }}>{ln.slice(6)}</span></div>
        if (/^- /.test(ln))
          return <div key={i} style={{ display: 'flex', gap: 8, marginTop: 4 }}><span style={{ color: 'var(--accent)' }}>•</span><span style={{ color: 'var(--text-secondary)' }}>{ln.slice(2)}</span></div>
        if (!ln.trim())
          return <div key={i} style={{ height: 6 }} />
        const p = ln
          .replace(/\*\*(.+?)\*\*/g, "<strong style='color:var(--text-primary);font-weight:700'>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em style='color:var(--accent-light)'>$1</em>")
          .replace(/`(.+?)`/g, "<code style='background:var(--bg-input);padding:1px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.82em;color:var(--accent-light)'>$1</code>")
        return <div key={i} style={{ color: 'var(--text-secondary)', marginTop: 2 }} dangerouslySetInnerHTML={{ __html: p }} />
      })}
    </div>
  )
}
