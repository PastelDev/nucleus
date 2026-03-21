import { useState } from 'react'
import type { AIConfig, Note, CalendarEvent, Task, PomodoroSettings, Section } from '../lib/types'
import { today } from '../lib/helpers'
import * as store from '../lib/storage'

const TOOL_NAMES = [
  { name: 'navigate_to', label: 'Navigate', safe: true },
  { name: 'get_current_view_content', label: 'Read View', safe: true },
  { name: 'create_task', label: 'Create Task', safe: false },
  { name: 'create_note', label: 'Create Note', safe: false },
  { name: 'edit_note', label: 'Edit Note', safe: false },
  { name: 'create_calendar_event', label: 'Create Event', safe: false },
  { name: 'set_pomodoro', label: 'Set Pomodoro', safe: false },
  { name: 'update_memories', label: 'Update Memories', safe: false },
  { name: 'generate_image', label: 'Generate Image', safe: false },
  { name: 'generate_images_batch', label: 'Generate Images (Batch)', safe: false },
]

interface Props {
  notes: Note[]; events: CalendarEvent[]; tasks: Task[]
  section: Section; pomSettings: PomodoroSettings
  agentMd: string; setAgentMd: (v: string) => void
  memoriesMd: string; setMemoriesMd: (v: string) => void
  aiConfig: AIConfig; setAiConfig: (v: AIConfig) => void
}

export default function AISettingsSection({
  notes, events, tasks, section, pomSettings,
  agentMd, setAgentMd, memoriesMd, setMemoriesMd,
  aiConfig, setAiConfig,
}: Props) {
  const [agEdit, setAgEdit] = useState(false)
  const [agBuf, setAgBuf] = useState(agentMd)
  const [memEdit, setMemEdit] = useState(false)
  const [memBuf, setMemBuf] = useState(memoriesMd)

  const updateConfig = (patch: Partial<AIConfig>) => {
    const next = { ...aiConfig, ...patch }
    setAiConfig(next)
    store.saveJSON('config.json', next)
  }

  const td = today()
  const ctx = [
    `Section: ${section} | Today: ${td}`,
    `Tasks today: ${tasks.filter(t => t.date === td).length}`,
    `Notes: ${notes.length}`,
    `Events (upcoming): ${events.filter(e => e.date >= td).length}`,
    `Pomodoro: ${pomSettings.work}min work`,
  ].join('\n')

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px' }}>
      <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.5rem', letterSpacing: '-0.03em', margin: '0 0 32px', fontFamily: 'var(--font-heading)' }}>
        AI Settings
      </h2>

      {/* Keys & Model */}
      <Section title="API Keys & Model">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="OpenRouter API Key (chat)" hint="From openrouter.ai — powers the AI chat">
            <input
              type="password" value={aiConfig.apiKey}
              onChange={e => updateConfig({ apiKey: e.target.value })}
              placeholder="sk-or-v1-..."
              style={inp}
            />
          </Field>
          <Field label="OpenAI API Key (images)" hint="From platform.openai.com — powers image generation">
            <input
              type="password" value={aiConfig.openaiKey}
              onChange={e => updateConfig({ openaiKey: e.target.value })}
              placeholder="sk-..."
              style={inp}
            />
          </Field>
          <Field label="Model ID" hint="Any OpenRouter model ID">
            <input
              value={aiConfig.model}
              onChange={e => updateConfig({ model: e.target.value })}
              placeholder="stepfun/step-3.5-flash:free"
              style={inp}
            />
          </Field>
        </div>
      </Section>

      {/* Permissions */}
      <Section title="Tool Permissions">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>How the AI handles tool execution:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['allow', 'ask', 'custom'] as const).map(m => (
              <button key={m} onClick={() => updateConfig({ permMode: m })} style={{
                padding: '7px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem',
                border: `1px solid ${aiConfig.permMode === m ? 'var(--accent)' : 'var(--border)'}`,
                background: aiConfig.permMode === m ? 'var(--accent-surface)' : 'var(--bg-elevated)',
                color: aiConfig.permMode === m ? 'var(--accent-light)' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {m === 'allow' ? 'Allow All (default)' : m === 'ask' ? 'Ask Always' : 'Custom'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 8 }}>
            {aiConfig.permMode === 'allow' && 'All tools run automatically. Image generation always shows a preview.'}
            {aiConfig.permMode === 'ask' && 'Every tool call asks for your approval before running.'}
            {aiConfig.permMode === 'custom' && 'Configure per-tool below. Image generation always shows a preview regardless.'}
          </div>
        </div>
        {aiConfig.permMode === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {TOOL_NAMES.map(t => {
              const allowed = !!aiConfig.permCustom?.[t.name]
              return (
                <div key={t.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', background: 'var(--bg-surface)', borderRadius: 8,
                  border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-faint)' }}>{t.name}</div>
                  </div>
                  <button onClick={() => {
                    const next = { ...aiConfig.permCustom }
                    if (allowed) delete next[t.name]; else next[t.name] = true
                    updateConfig({ permCustom: next })
                  }} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: '0.73rem', fontWeight: 700,
                    border: `1px solid ${allowed ? 'var(--green)' : 'var(--border)'}`,
                    background: allowed ? '#0d1a0d' : 'transparent',
                    color: allowed ? 'var(--green)' : 'var(--text-faint)',
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}>{allowed ? 'Allow' : 'Ask'}</button>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* AGENT.md */}
      <Section title="Agent Prompt">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          {agEdit ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setAgentMd(agBuf); setAgEdit(false); store.saveMD('ai-agent.local.md', agBuf) }} style={saveBtn}>Save</button>
              <button onClick={() => { setAgBuf(agentMd); setAgEdit(false) }} style={cancelBtn}>Cancel</button>
            </div>
          ) : <button onClick={() => { setAgBuf(agentMd); setAgEdit(true) }} style={editBtn}>Edit</button>}
        </div>
        {agEdit
          ? <textarea value={agBuf} onChange={e => setAgBuf(e.target.value)} style={mdArea} />
          : <pre style={mdPre}>{agentMd}</pre>
        }
      </Section>

      {/* MEMORIES.md */}
      <Section title="Agent Memories">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          {memEdit ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setMemoriesMd(memBuf); setMemEdit(false); store.saveMD('ai-memories.md', memBuf) }} style={{ ...saveBtn, background: 'var(--green)' }}>Save</button>
              <button onClick={() => { setMemBuf(memoriesMd); setMemEdit(false) }} style={cancelBtn}>Cancel</button>
            </div>
          ) : <button onClick={() => { setMemBuf(memoriesMd); setMemEdit(true) }} style={editBtn}>Edit</button>}
        </div>
        {memEdit
          ? <textarea value={memBuf} onChange={e => setMemBuf(e.target.value)} style={mdArea} />
          : <pre style={mdPre}>{memoriesMd}</pre>
        }
      </Section>

      {/* Live context snapshot */}
      <Section title="Live Context Snapshot">
        <pre style={{ ...mdPre, color: 'var(--text-faint)' }}>{ctx}</pre>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 5 }}>{label}</div>
      {hint && <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: '0.86rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const saveBtn: React.CSSProperties = { fontSize: '0.75rem', background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '5px 14px', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const cancelBtn: React.CSSProperties = { fontSize: '0.75rem', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }
const editBtn: React.CSSProperties = { fontSize: '0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', color: '#606080', cursor: 'pointer', fontFamily: 'inherit' }
const mdArea: React.CSSProperties = { width: '100%', minHeight: 200, background: '#0b0b14', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical', padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: 1.7, outline: 'none', boxSizing: 'border-box' }
const mdPre: React.CSSProperties = { margin: 0, padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }
