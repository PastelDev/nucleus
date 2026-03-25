import { useState, useEffect } from 'react'
import type { Section, Task, CalendarEvent, Note, PomodoroSettings, AIConfig, ThemeSettings, Artefact } from './lib/types'
import * as store from './lib/storage'
import { applyTheme, createDefaultThemeSettings, getActiveTheme, migrateLegacyPomodoroBackground } from './lib/theme'

import Sidebar from './components/Sidebar'
import TodaySection from './components/TodaySection'
import NotesSection from './components/NotesSection'
import BoardsSection from './components/BoardsSection'
import MemoriesSection from './components/MemoriesSection'
import CalendarSection from './components/CalendarSection'
import PomodoroSection from './components/PomodoroSection'
import AIPanel from './components/AIPanel'
import AISettingsSection from './components/AISettingsSection'
import SettingsSection from './components/SettingsSection'
import ArtefactsSection from './components/ArtefactsSection'
import NucleusLogo from './components/NucleusLogo'
import FloatingClock from './components/FloatingClock'
import { AppearanceProvider } from './components/AppearanceProvider'
import SurfaceFrame from './components/SurfaceFrame'

const DEFAULT_AGENT_MD = `# Nucleus AI Agent

You are **Nucleus**, an intelligent productivity assistant embedded in the Nucleus app. You control the app through tools.

## Behavior Rules
1. When asked to do something in the app — **DO IT** using tools, don't explain how
2. After tool calls, confirm briefly (1-2 sentences)
3. Chain tools when needed (e.g. create note -> navigate to notes)
4. Use \`get_current_view_content\` to read what's on screen before editing
5. Use \`update_memories\` to remember user preferences and important context
6. Navigate to the relevant section after creating content when it makes sense
7. Before generating images, describe your planned prompt to the user and ask for confirmation. For batch generation with multiple prompts, list all prompts first. Only call generate_image after the user approves.
8. When iteration feedback is received from generate_image, immediately refine the prompt based on the feedback and call generate_image again with use_previous_generation: true to use the previous images as reference.
9. If this model does not support vision and the user uploads images, ask them to describe the content. Their uploaded images can still be used as references for image generation via use_uploaded_references: true.

## Tone
Sharp, helpful, minimal. Skip filler. Get to the point.
`

const DEFAULT_MEMORIES_MD = `# Agent Memories

*No memories yet.*

I update this as I learn about you — preferences, working style, and important context.
`

const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = { work: 25, short: 5, long: 15, rounds: 4 }

export default function App() {
  const [section, setSection] = useState<Section>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [artefacts, setArtefacts] = useState<Artefact[]>([])
  const [pomSettings, setPomSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS)
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(createDefaultThemeSettings())
  const [aiConfig, setAiConfig] = useState<AIConfig>({ apiKey: '', model: 'stepfun/step-3.5-flash:free', openaiKey: '', permMode: 'allow', permCustom: {} })
  const [agentMd, setAgentMd] = useState(DEFAULT_AGENT_MD)
  const [memoriesMd, setMemoriesMd] = useState(DEFAULT_MEMORIES_MD)
  const [focusTopic, setFocusTopic] = useState('')
  const [preventSleep, setPreventSleep] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [clockVisible, setClockVisible] = useState(() => localStorage.getItem('nucleus-clock-visible') === '1')
  const [ready, setReady] = useState(false)

  /* ── Load all data on mount ── */
  useEffect(() => {
    (async () => {
      const [t, e, n, arts, p, theme, cfg, agent, mem] = await Promise.all([
        store.loadJSON<Task[]>('tasks.json', []),
        store.loadJSON<CalendarEvent[]>('events.json', []),
        store.loadJSON<Note[]>('notes.json', []),
        store.loadJSON<Artefact[]>('artefacts.json', []),
        store.loadJSON<Partial<PomodoroSettings>>('pomodoro.json', DEFAULT_POMODORO_SETTINGS),
        store.loadThemeSettings(),
        store.loadAIConfig(),
        store.loadMD('ai-agent.local.md', '').then(local => local || store.loadMD('ai-agent.md', DEFAULT_AGENT_MD)),
        store.loadAgentMemorySummary(DEFAULT_MEMORIES_MD),
      ])
      const migrated = migrateLegacyPomodoroBackground(theme, p)
      setTasks(t); setEvents(e); setNotes(n); setArtefacts(arts); setPomSettings({ ...DEFAULT_POMODORO_SETTINGS, ...migrated.pomodoroSettings })
      setThemeSettings(migrated.themeSettings)
      setAiConfig(cfg); setAgentMd(agent); setMemoriesMd(mem)
      if (migrated.didMigrate) {
        store.saveThemeSettings(migrated.themeSettings)
        store.saveJSON('pomodoro.json', { ...DEFAULT_POMODORO_SETTINGS, ...migrated.pomodoroSettings })
      }
      setReady(true)
    })()
  }, [])

  /* ── Auto-save on state change ── */
  useEffect(() => { if (ready) store.saveJSON('artefacts.json', artefacts) }, [artefacts, ready])
  useEffect(() => { if (ready) store.saveJSON('tasks.json', tasks) }, [tasks, ready])
  useEffect(() => { if (ready) store.saveJSON('events.json', events) }, [events, ready])
  useEffect(() => { if (ready) store.saveJSON('notes.json', notes) }, [notes, ready])
  useEffect(() => { if (ready) store.saveJSON('pomodoro.json', pomSettings) }, [pomSettings, ready])
  useEffect(() => { if (ready) store.saveThemeSettings(themeSettings) }, [themeSettings, ready])
  useEffect(() => { if (ready) store.saveAIConfig(aiConfig) }, [aiConfig, ready])
  useEffect(() => { if (ready) store.saveMD('ai-agent.local.md', agentMd) }, [agentMd, ready])
  useEffect(() => { applyTheme(getActiveTheme(themeSettings)) }, [themeSettings])

  /* ── Loading screen ── */
  if (!ready) return (
    <div style={{ height: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 12, animation: 'nuc-spin 2s linear infinite', display: 'inline-block' }}><NucleusLogo size={48} /></div>
        <div style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Loading Nucleus...</div>
      </div>
    </div>
  )

  return (
    <AppearanceProvider themeSettings={themeSettings} setThemeSettings={setThemeSettings} artefacts={artefacts}>
      <SurfaceFrame
        targetId="app-shell"
        role="appShell"
        style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg-deep)' }}
        contentStyle={{ display: 'flex', height: '100%', width: '100%' }}
      >
        <Sidebar
          section={section} setSection={setSection}
          aiOpen={aiOpen} setAiOpen={setAiOpen}
          collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed}
          clockVisible={clockVisible} setClockVisible={v => { setClockVisible(v); localStorage.setItem('nucleus-clock-visible', v ? '1' : '0') }}
        />
        <FloatingClock visible={clockVisible} onClose={() => { setClockVisible(false); localStorage.setItem('nucleus-clock-visible', '0') }} />

        <SurfaceFrame
          targetId={`page:${section}`}
          role="page"
          className="nuc-section"
          style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}
          contentStyle={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}
        >
          {section === 'today' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <TodaySection tasks={tasks} setTasks={setTasks} events={events} setSection={setSection} />
            </div>
          )}
          {section === 'notes' && <NotesSection notes={notes} setNotes={setNotes} />}
          {section === 'boards' && <BoardsSection />}
          {section === 'memories' && <MemoriesSection memoriesMd={memoriesMd} setMemoriesMd={setMemoriesMd} />}
          {section === 'calendar' && <CalendarSection events={events} setEvents={setEvents} />}
          {section === 'pomodoro' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
              <PomodoroSection settings={pomSettings} setSettings={setPomSettings} focusTopic={focusTopic} setFocusTopic={setFocusTopic} preventSleep={preventSleep} setPreventSleep={setPreventSleep} artefacts={artefacts} />
            </div>
          )}
          {section === 'artefacts' && (
            <ArtefactsSection artefacts={artefacts} setArtefacts={setArtefacts} />
          )}
          {section === 'settings' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SettingsSection themeSettings={themeSettings} setThemeSettings={setThemeSettings} />
            </div>
          )}
          {section === 'ai-settings' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AISettingsSection
                notes={notes} events={events} tasks={tasks}
                section={section} pomSettings={pomSettings}
                agentMd={agentMd} setAgentMd={setAgentMd}
                memoriesMd={memoriesMd} setMemoriesMd={setMemoriesMd}
                aiConfig={aiConfig} setAiConfig={setAiConfig}
              />
            </div>
          )}
        </SurfaceFrame>

        {aiOpen && (
          <AIPanel
            notes={notes} events={events} tasks={tasks}
            artefacts={artefacts} setArtefacts={setArtefacts}
            section={section} pomSettings={pomSettings}
            setNotes={setNotes} setEvents={setEvents} setTasks={setTasks}
            setSection={setSection} setPomSettings={setPomSettings}
            agentMd={agentMd} memoriesMd={memoriesMd} setMemoriesMd={setMemoriesMd}
            aiConfig={aiConfig}
            focusTopic={focusTopic} setFocusTopic={setFocusTopic}
            preventSleep={preventSleep} setPreventSleep={setPreventSleep}
            clockVisible={clockVisible}
            setClockVisible={v => { setClockVisible(v); localStorage.setItem('nucleus-clock-visible', v ? '1' : '0') }}
            onClose={() => setAiOpen(false)}
          />
        )}
      </SurfaceFrame>
    </AppearanceProvider>
  )
}
