import { useState, useEffect } from 'react'
import type { Section, Task, CalendarEvent, Note, PomodoroSettings, AIConfig } from './lib/types'
import * as store from './lib/storage'

import Sidebar from './components/Sidebar'
import TodaySection from './components/TodaySection'
import NotesSection from './components/NotesSection'
import WhiteboardSection from './components/WhiteboardSection'
import MeSection from './components/MeSection'
import CalendarSection from './components/CalendarSection'
import PomodoroSection from './components/PomodoroSection'
import AIPanel from './components/AIPanel'

const DEFAULT_AGENT_MD = `# Nucleus AI Agent

You are **Nucleus**, an intelligent productivity assistant embedded in the Nucleus app. You control the app through tools.

## Behavior Rules
1. When asked to do something in the app — **DO IT** using tools, don't explain how
2. After tool calls, confirm briefly (1-2 sentences)
3. Chain tools when needed (e.g. create note -> navigate to notes)
4. Use \`get_current_view_content\` to read what's on screen before editing
5. Use \`update_memories\` to remember user preferences and important context
6. Navigate to the relevant section after creating content when it makes sense

## Tone
Sharp, helpful, minimal. Skip filler. Get to the point.
`

const DEFAULT_MEMORIES_MD = `# Agent Memories

*No memories yet.*

I update this as I learn about you — preferences, working style, and important context.
`

export default function App() {
  const [section, setSection] = useState<Section>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [pomSettings, setPomSettings] = useState<PomodoroSettings>({ work: 25, short: 5, long: 15 })
  const [aiConfig, setAiConfig] = useState<AIConfig>({ apiKey: '', model: 'stepfun/step-3.5-flash:free' })
  const [agentMd, setAgentMd] = useState(DEFAULT_AGENT_MD)
  const [memoriesMd, setMemoriesMd] = useState(DEFAULT_MEMORIES_MD)
  const [aiOpen, setAiOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  /* ── Load all data on mount ── */
  useEffect(() => {
    (async () => {
      const [t, e, n, p, cfg, agent, mem] = await Promise.all([
        store.loadJSON<Task[]>('tasks.json', []),
        store.loadJSON<CalendarEvent[]>('events.json', []),
        store.loadJSON<Note[]>('notes.json', []),
        store.loadJSON<PomodoroSettings>('pomodoro.json', { work: 25, short: 5, long: 15 }),
        store.loadAIConfig(),
        store.loadMD('ai-agent.md', DEFAULT_AGENT_MD),
        store.loadMD('ai-memories.md', DEFAULT_MEMORIES_MD),
      ])
      setTasks(t); setEvents(e); setNotes(n); setPomSettings(p)
      setAiConfig(cfg); setAgentMd(agent); setMemoriesMd(mem)
      setReady(true)
    })()
  }, [])

  /* ── Auto-save on state change ── */
  useEffect(() => { if (ready) store.saveJSON('tasks.json', tasks) }, [tasks, ready])
  useEffect(() => { if (ready) store.saveJSON('events.json', events) }, [events, ready])
  useEffect(() => { if (ready) store.saveJSON('notes.json', notes) }, [notes, ready])
  useEffect(() => { if (ready) store.saveJSON('pomodoro.json', pomSettings) }, [pomSettings, ready])
  useEffect(() => { if (ready) store.saveMD('ai-agent.md', agentMd) }, [agentMd, ready])
  useEffect(() => { if (ready) store.saveMD('ai-memories.md', memoriesMd) }, [memoriesMd, ready])

  /* ── Loading screen ── */
  if (!ready) return (
    <div style={{ height: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: 12, animation: 'nuc-spin 2s linear infinite' }}>✦</div>
        <div style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Loading Nucleus...</div>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <Sidebar
        section={section} setSection={setSection}
        aiOpen={aiOpen} setAiOpen={setAiOpen}
        collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed}
      />

      {/* Main content */}
      <div className="nuc-section" key={section} style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0 }}>
        {section === 'today' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <TodaySection tasks={tasks} setTasks={setTasks} events={events} setSection={setSection} />
          </div>
        )}
        {section === 'notes' && <NotesSection notes={notes} setNotes={setNotes} />}
        {section === 'whiteboard' && <WhiteboardSection />}
        {section === 'me' && <MeSection />}
        {section === 'calendar' && <CalendarSection events={events} setEvents={setEvents} />}
        {section === 'pomodoro' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <PomodoroSection settings={pomSettings} setSettings={setPomSettings} />
          </div>
        )}
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <AIPanel
          notes={notes} events={events} tasks={tasks}
          section={section} pomSettings={pomSettings}
          setNotes={setNotes} setEvents={setEvents} setTasks={setTasks}
          setSection={setSection} setPomSettings={setPomSettings}
          agentMd={agentMd} setAgentMd={setAgentMd}
          memoriesMd={memoriesMd} setMemoriesMd={setMemoriesMd}
          aiConfig={aiConfig} setAiConfig={setAiConfig}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  )
}
