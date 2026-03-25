import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'
import type {
  Artefact,
  BackgroundOrnament,
  BackgroundPreset,
  SurfaceRole,
  ThemeDefinition,
} from '../lib/types'
import { useAppearance } from './AppearanceProvider'

interface Props {
  targetId: string
  role?: SurfaceRole
  editMode?: boolean
  selectedOrnamentId?: string | null
  onSelectOrnament?: (ornamentId: string | null) => void
  onChangeOrnament?: (ornamentId: string, patch: Partial<BackgroundOrnament>) => void
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export default function SurfaceBackground({
  targetId,
  role,
  editMode = false,
  selectedOrnamentId = null,
  onSelectOrnament,
  onChangeOrnament,
}: Props) {
  const { resolveAssignment, findPreset, activeTheme } = useAppearance()
  const assignment = resolveAssignment(targetId, role)
  const basePreset = findPreset(assignment.presetId)
  const ornaments = useMemo(
    () => [...assignment.ornaments]
      .map((ornament) => ({ ornament, preset: findPreset(ornament.presetId) }))
      .filter((entry): entry is { ornament: BackgroundOrnament; preset: BackgroundPreset } => !!entry.preset)
      .sort((a, b) => a.ornament.zIndex - b.ornament.zIndex),
    [assignment.ornaments, findPreset],
  )

  return (
    <div
      data-surface-background="1"
      onPointerDown={() => onSelectOrnament?.(null)}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: editMode ? 'auto' : 'none',
        zIndex: 'var(--z-background)',
      }}
    >
      {basePreset && (
        <PresetLayer
          preset={basePreset}
          theme={activeTheme}
          opacity={assignment.opacity * basePreset.opacity}
          blur={assignment.blur + basePreset.blur}
          blendMode={basePreset.blendMode}
          inert
        />
      )}

      {ornaments.map(({ ornament, preset }) => (
        <EditableOrnament
          key={ornament.id}
          ornament={ornament}
          preset={preset}
          theme={activeTheme}
          selected={selectedOrnamentId === ornament.id}
          editMode={editMode}
          onSelect={onSelectOrnament}
          onChange={onChangeOrnament}
        />
      ))}
    </div>
  )
}

function EditableOrnament({
  ornament,
  preset,
  theme,
  selected,
  editMode,
  onSelect,
  onChange,
}: {
  ornament: BackgroundOrnament
  preset: BackgroundPreset
  theme: ThemeDefinition
  selected: boolean
  editMode: boolean
  onSelect?: (ornamentId: string | null) => void
  onChange?: (ornamentId: string, patch: Partial<BackgroundOrnament>) => void
}) {
  const dragRef = useRef<{ x: number; y: number; w: number; h: number; clientX: number; clientY: number } | null>(null)

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editMode || ornament.locked) return
    event.stopPropagation()
    onSelect?.(ornament.id)
    const parent = event.currentTarget.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    dragRef.current = {
      x: ornament.x,
      y: ornament.y,
      w: rect.width,
      h: rect.height,
      clientX: event.clientX,
      clientY: event.clientY,
    }

    const onMove = (move: PointerEvent) => {
      if (!dragRef.current) return
      onChange?.(ornament.id, {
        x: clamp(dragRef.current.x + ((move.clientX - dragRef.current.clientX) / dragRef.current.w) * 100, 0, 100),
        y: clamp(dragRef.current.y + ((move.clientY - dragRef.current.clientY) / dragRef.current.h) * 100, 0, 100),
      })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editMode) return
    event.stopPropagation()
    const parent = event.currentTarget.parentElement?.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    dragRef.current = {
      x: ornament.w,
      y: ornament.h,
      w: rect.width,
      h: rect.height,
      clientX: event.clientX,
      clientY: event.clientY,
    }

    const onMove = (move: PointerEvent) => {
      if (!dragRef.current) return
      onChange?.(ornament.id, {
        w: clamp(dragRef.current.x + ((move.clientX - dragRef.current.clientX) / dragRef.current.w) * 100, 6, 100),
        h: clamp(dragRef.current.y + ((move.clientY - dragRef.current.clientY) / dragRef.current.h) * 100, 6, 100),
      })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      onPointerDown={startDrag}
      onClick={(event) => {
        if (!editMode) return
        event.stopPropagation()
        onSelect?.(ornament.id)
      }}
      style={{
        position: 'absolute',
        left: `${ornament.x}%`,
        top: `${ornament.y}%`,
        width: `${ornament.w}%`,
        height: `${ornament.h}%`,
        transform: `${anchorTransform(ornament.anchor)} rotate(${ornament.rotation}deg)`,
        transformOrigin: 'center',
        opacity: ornament.opacity,
        filter: ornament.blur > 0 ? `blur(${ornament.blur}px)` : undefined,
        mixBlendMode: ornament.blendMode,
        pointerEvents: editMode ? 'auto' : 'none',
        cursor: editMode && !ornament.locked ? 'grab' : 'default',
        outline: selected ? '1px solid var(--accent-light)' : 'none',
        boxShadow: selected ? '0 0 0 1px var(--accent), 0 0 0 4px rgba(124,58,237,0.12)' : 'none',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <PresetLayer
        preset={preset}
        theme={theme}
        opacity={ornament.opacity * preset.opacity}
        blur={ornament.blur + preset.blur}
        blendMode={preset.blendMode}
        inert
      />
      {selected && editMode && (
        <button
          type="button"
          onPointerDown={startResize}
          style={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            width: 14,
            height: 14,
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.75)',
            background: 'var(--accent)',
            cursor: 'nwse-resize',
            zIndex: 2,
          }}
        />
      )}
    </div>
  )
}

function anchorTransform(anchor: BackgroundOrnament['anchor']) {
  switch (anchor) {
    case 'top-right':
      return 'translate(-100%, 0)'
    case 'bottom-left':
      return 'translate(0, -100%)'
    case 'bottom-right':
      return 'translate(-100%, -100%)'
    case 'center':
      return 'translate(-50%, -50%)'
    default:
      return 'translate(0, 0)'
  }
}

function PresetLayer({
  preset,
  theme,
  opacity,
  blur,
  blendMode,
  inert = false,
}: {
  preset: BackgroundPreset
  theme: ThemeDefinition
  opacity: number
  blur: number
  blendMode: CSSProperties['mixBlendMode']
  inert?: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        mixBlendMode: blendMode,
        pointerEvents: inert ? 'none' : 'auto',
      }}
    >
      {preset.kind === 'gradient' && <GradientLayer preset={preset} theme={theme} />}
      {preset.kind === 'simulation' && <SimulationLayer preset={preset} theme={theme} />}
      {preset.kind === 'media' && <MediaLayer preset={preset} />}
      {preset.kind === 'artefact' && <ArtefactLayer preset={preset} theme={theme} />}
    </div>
  )
}

function GradientLayer({ preset, theme }: { preset: Extract<BackgroundPreset, { kind: 'gradient' }>; theme: ThemeDefinition }) {
  const accentStrong = `${theme.accent}bb`
  const accentSoft = `${theme.accentLight}66`
  const blue = `${theme.blue}66`
  const pink = `${theme.pink}4a`
  const baseStyle: CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden' }

  if (preset.gradient.style === 'theme-rings') {
    return (
      <div style={baseStyle}>
        <div
          className="bg-motion-slow"
          style={{
            position: 'absolute',
            inset: '-25%',
            backgroundImage: `radial-gradient(circle at center, transparent 0 22%, ${accentStrong} 22.5%, transparent 23%, transparent 38%, ${blue} 38.5%, transparent 39%, transparent 54%, ${accentSoft} 54.5%, transparent 55%)`,
            filter: 'blur(6px)',
            transform: `rotate(${preset.gradient.motion * 18}deg) scale(${1 + preset.gradient.intensity * 0.08})`,
          }}
        />
      </div>
    )
  }

  if (preset.gradient.style === 'theme-mesh') {
    return (
      <div style={baseStyle}>
        <div
          className="bg-motion-medium"
          style={{
            position: 'absolute',
            inset: '-20%',
            backgroundImage: `
              radial-gradient(circle at 18% 20%, ${accentStrong}, transparent 34%),
              radial-gradient(circle at 82% 18%, ${blue}, transparent 28%),
              radial-gradient(circle at 54% 80%, ${pink}, transparent 34%),
              linear-gradient(135deg, ${theme.bgDeep}, transparent 65%)
            `,
            filter: `blur(${18 * preset.gradient.softness}px) saturate(1.15)`,
          }}
        />
      </div>
    )
  }

  return (
    <div style={baseStyle}>
      <div
        className="bg-motion-fast"
        style={{
          position: 'absolute',
          inset: '-28%',
          backgroundImage: `
            radial-gradient(circle at 16% 24%, ${accentStrong}, transparent 30%),
            radial-gradient(circle at 80% 22%, ${blue}, transparent 28%),
            radial-gradient(circle at 50% 82%, ${accentSoft}, transparent 34%),
            linear-gradient(160deg, ${theme.bgDeep}, ${theme.bgSurface})
          `,
          filter: `blur(${22 * preset.gradient.softness}px)`,
        }}
      />
    </div>
  )
}

function MediaLayer({ preset }: { preset: Extract<BackgroundPreset, { kind: 'media' }> }) {
  const drift = preset.media.drift > 0 ? `bg-drift ${28 / preset.media.drift}s ease-in-out infinite alternate` : undefined

  if (preset.media.mediaType === 'video') {
    return (
      <video
        src={preset.media.src}
        autoPlay
        muted={preset.media.muted}
        loop={preset.media.loop}
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: preset.media.fit,
          animation: drift,
        }}
      />
    )
  }

  return (
    <img
      src={preset.media.src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: preset.media.fit,
        animation: drift,
      }}
    />
  )
}

function ArtefactLayer({ preset, theme }: { preset: Extract<BackgroundPreset, { kind: 'artefact' }>; theme: ThemeDefinition }) {
  const { artefacts } = useAppearance()
  const art = artefacts.find((entry) => entry.id === preset.artefact.artefactId)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!art) {
      setUrl(null)
      return
    }

    const blob = new Blob(
      [buildArtefactDocument(art, theme, preset.artefact.injectTheme)],
      { type: 'text/html' },
    )
    const nextUrl = URL.createObjectURL(blob)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [art, preset.artefact.injectTheme, theme])

  if (!art || !url) return null

  return (
    <iframe
      src={url}
      title={preset.name}
      sandbox="allow-scripts"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: 'transparent',
        transform: `scale(${preset.artefact.scale})`,
        transformOrigin: 'center',
      }}
    />
  )
}

function buildArtefactDocument(artefact: Artefact, theme: ThemeDefinition, injectTheme: boolean) {
  const rootCss = injectTheme ? `
    :root{
      --bg-deep:${theme.bgDeep};
      --bg-surface:${theme.bgSurface};
      --bg-elevated:${theme.bgElevated};
      --border:${theme.border};
      --accent:${theme.accent};
      --accent-light:${theme.accentLight};
      --text-primary:${theme.textPrimary};
      --text-secondary:${theme.textSecondary};
      --text-muted:${theme.textMuted};
      --font:${theme.font};
      --font-heading:${theme.fontHeading};
      --font-mono:${theme.fontMono};
    }
  ` : ''

  const shared = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>
          *{box-sizing:border-box}
          html,body,#root{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}
          body{font-family:${theme.font};color:${theme.textPrimary}}
          ${rootCss}
        </style>
      </head>
      <body>
        <div id="root"></div>
  `

  if (artefact.type === 'react') {
    return `${shared}
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script type="text/babel">
          ${artefact.code}
          const _App = typeof App !== 'undefined'
            ? App
            : (typeof default_1 !== 'undefined' ? default_1 : () => React.createElement('div', null, 'App not found'));
          ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(_App));
        </script>
      </body>
    </html>`
  }

  return artefact.code.includes('<html') ? artefact.code : `${shared}${artefact.code}</body></html>`
}

function SimulationLayer({ preset, theme }: { preset: Extract<BackgroundPreset, { kind: 'simulation' }>; theme: ThemeDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const resize = () => {
      canvas.width = Math.max(1, canvas.offsetWidth)
      canvas.height = Math.max(1, canvas.offsetHeight)
    }
    resize()
    window.addEventListener('resize', resize)

    let running = true
    const animate = !reduceMotion

    if (preset.simulation.engine === 'starfield') runStarfield(ctx, canvas, preset, theme, () => running, animate, frameRef)
    else if (preset.simulation.engine === 'linked-particles') runLinkedParticles(ctx, canvas, preset, theme, () => running, animate, frameRef)
    else if (preset.simulation.engine === 'game-of-life') runGameOfLife(ctx, canvas, preset, theme, () => running, animate, frameRef)
    else runEvolvingShapes(ctx, canvas, preset, theme, () => running, animate, frameRef)

    return () => {
      running = false
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [preset, theme])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}

function runStarfield(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  preset: Extract<BackgroundPreset, { kind: 'simulation' }>,
  theme: ThemeDefinition,
  alive: () => boolean,
  animate: boolean,
  frameRef: MutableRefObject<number>,
) {
  const count = Math.round(preset.simulation.density)
  const speed = preset.simulation.speed
  const stars = Array.from({ length: count }, () => ({
    x: Math.random() * 2000 - 1000,
    y: Math.random() * 2000 - 1000,
    z: Math.random() * 1000,
    size: Math.random() * 1.6 + 0.35,
  }))
  const starRgb = hex(theme.accentLight)

  const draw = () => {
    if (!alive()) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    for (const star of stars) {
      if (animate) star.z -= speed * 2.4
      if (star.z <= 0) {
        star.x = Math.random() * 2000 - 1000
        star.y = Math.random() * 2000 - 1000
        star.z = 1000
      }

      const sx = (star.x / star.z) * 280 + w / 2
      const sy = (star.y / star.z) * 280 + h / 2
      const radius = Math.max(0.25, (1 - star.z / 1000) * star.size * 2.2)
      if (sx < 0 || sx > w || sy < 0 || sy > h) continue

      ctx.beginPath()
      ctx.arc(sx, sy, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${starRgb.r}, ${starRgb.g}, ${starRgb.b}, ${0.15 + (1 - star.z / 1000) * 0.85})`
      ctx.fill()
    }

    if (animate) frameRef.current = requestAnimationFrame(draw)
  }

  draw()
}

function runLinkedParticles(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  preset: Extract<BackgroundPreset, { kind: 'simulation' }>,
  theme: ThemeDefinition,
  alive: () => boolean,
  animate: boolean,
  frameRef: MutableRefObject<number>,
) {
  const count = Math.round(preset.simulation.density)
  const speed = preset.simulation.speed * 0.35
  const points = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * speed,
    vy: (Math.random() - 0.5) * speed,
  }))
  const dot = hex(theme.accentLight)
  const line = hex(theme.blue)

  const draw = () => {
    if (!alive()) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    for (const point of points) {
      if (animate) {
        point.x += point.vx / 100
        point.y += point.vy / 100
        if (point.x < 0 || point.x > 1) point.vx *= -1
        if (point.y < 0 || point.y > 1) point.vy *= -1
      }
    }

    for (let i = 0; i < points.length; i++) {
      const a = points[i]
      const ax = a.x * w
      const ay = a.y * h

      ctx.beginPath()
      ctx.arc(ax, ay, 1.8 + preset.simulation.detail, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${dot.r}, ${dot.g}, ${dot.b}, 0.72)`
      ctx.fill()

      for (let j = i + 1; j < points.length; j++) {
        const b = points[j]
        const dx = ax - b.x * w
        const dy = ay - b.y * h
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 160) continue
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(b.x * w, b.y * h)
        ctx.strokeStyle = `rgba(${line.r}, ${line.g}, ${line.b}, ${0.12 * (1 - dist / 160)})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    if (animate) frameRef.current = requestAnimationFrame(draw)
  }

  draw()
}

function runGameOfLife(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  preset: Extract<BackgroundPreset, { kind: 'simulation' }>,
  theme: ThemeDefinition,
  alive: () => boolean,
  animate: boolean,
  frameRef: MutableRefObject<number>,
) {
  const cellSize = Math.max(8, Math.round(26 - preset.simulation.density * 0.12))
  const cols = Math.ceil(canvas.width / cellSize)
  const rows = Math.ceil(canvas.height / cellSize)
  let grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() > 0.78 ? 1 : 0)))
  const aliveColor = hex(theme.accentLight)
  const gridColor = hex(theme.borderSubtle)
  let last = performance.now()

  const step = () => {
    const next = grid.map((row, y) => row.map((cell, x) => {
      let neighbours = 0
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue
          neighbours += grid[(y + oy + rows) % rows][(x + ox + cols) % cols]
        }
      }
      if (cell && (neighbours === 2 || neighbours === 3)) return 1
      if (!cell && neighbours === 3) return 1
      return 0
    }))
    grid = next
  }

  const draw = (now = performance.now()) => {
    if (!alive()) return
    if (animate && now - last > 120 / preset.simulation.speed) {
      step()
      last = now
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!grid[y][x]) continue
        ctx.fillStyle = `rgba(${aliveColor.r}, ${aliveColor.g}, ${aliveColor.b}, 0.4)`
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1)
      }
    }
    ctx.strokeStyle = `rgba(${gridColor.r}, ${gridColor.g}, ${gridColor.b}, 0.08)`
    for (let x = 0; x < cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cellSize, 0)
      ctx.lineTo(x * cellSize, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cellSize)
      ctx.lineTo(canvas.width, y * cellSize)
      ctx.stroke()
    }

    if (animate) frameRef.current = requestAnimationFrame(draw)
  }

  draw()
}

function runEvolvingShapes(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  preset: Extract<BackgroundPreset, { kind: 'simulation' }>,
  theme: ThemeDefinition,
  alive: () => boolean,
  animate: boolean,
  frameRef: MutableRefObject<number>,
) {
  const count = Math.max(4, Math.round(preset.simulation.density))
  const speed = preset.simulation.speed
  const accent = hex(theme.accentLight)
  const blue = hex(theme.blue)
  const shapes = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 42 + 16,
    sides: Math.floor(Math.random() * 5) + 3,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.018 * speed,
    phase: Math.random() * Math.PI * 2,
  }))
  let t = 0

  const draw = () => {
    if (!alive()) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const shape of shapes) {
      if (animate) shape.rotation += shape.rotSpeed
      const sx = shape.x * canvas.width
      const sy = shape.y * canvas.height
      const sides = Math.max(3, Math.round(shape.sides + Math.sin(t + shape.phase) * preset.simulation.detail * 2))
      const scale = 1 + Math.sin(t * 0.8 + shape.phase) * 0.22

      ctx.beginPath()
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + shape.rotation
        const radius = shape.r * scale
        const px = sx + Math.cos(angle) * radius
        const py = sy + Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      const mix = (Math.sin(t + shape.phase) + 1) / 2
      ctx.strokeStyle = `rgba(${Math.round(accent.r * mix + blue.r * (1 - mix))}, ${Math.round(accent.g * mix + blue.g * (1 - mix))}, ${Math.round(accent.b * mix + blue.b * (1 - mix))}, 0.42)`
      ctx.lineWidth = 1.4
      ctx.stroke()
    }
    if (animate) t += 0.02 * speed
    if (animate) frameRef.current = requestAnimationFrame(draw)
  }

  draw()
}

function hex(color: string) {
  const safe = color.startsWith('#') ? color.slice(1) : color
  const value = safe.length === 3
    ? safe.split('').map((part) => part + part).join('')
    : safe
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}
