import { useEffect, useRef } from 'react'
import type { PomBgType, Artefact } from '../lib/types'

interface Props {
  type: PomBgType
  params: Record<string, number>
  imageSrc?: string
  artefacts?: Artefact[]
}

export default function PomodoroBackground({ type, params, imageSrc, artefacts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (type === 'none' || type === 'custom-image') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let running = true

    if (type === 'starfield') runStarfield(ctx, canvas, params, () => running)
    else if (type === 'pixel-galaxy') runPixelGalaxy(ctx, canvas, params, () => running)
    else if (type === 'fractal') runFractal(ctx, canvas, params, () => running)
    else if (type === 'evolving-shapes') runEvolvingShapes(ctx, canvas, params, () => running)

    return () => {
      running = false
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [type, params])

  if (type === 'none') return null

  if (type === 'custom-image' && imageSrc) {
    // Artefact-based background
    if (imageSrc.startsWith('artefact:') && artefacts) {
      const artId = imageSrc.replace('artefact:', '')
      const art = artefacts.find(a => a.id === artId)
      if (!art) return null
      const blob = new Blob(
        [art.type === 'react'
          ? `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="https://unpkg.com/react@18/umd/react.production.min.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body,#root{width:100%;height:100%;overflow:hidden;background:#0a0a12}</style></head><body><div id="root"></div><script type="text/babel">${art.code};\nconst _C = typeof App !== 'undefined' ? App : (typeof default_1 !== 'undefined' ? default_1 : () => React.createElement('div','App not found'));\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(_C));</script></body></html>`
          : art.code],
        { type: 'text/html' }
      )
      const url = URL.createObjectURL(blob)
      return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
          <iframe
            src={url}
            title="bg"
            sandbox="allow-scripts"
            style={{ width: '100%', height: '100%', border: 'none', opacity: 0.4, pointerEvents: 'none' }}
          />
        </div>
      )
    }
    // Image URL or data URL
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        overflow: 'hidden', borderRadius: 'inherit',
      }}>
        <img
          src={imageSrc}
          alt=""
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: 0.3,
            animation: 'pom-bg-drift 30s ease-in-out infinite alternate',
          }}
        />
        <style>{`@keyframes pom-bg-drift { 0% { transform: scale(1.05); } 100% { transform: scale(1.15) translate(-2%, -1%); } }`}</style>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 0,
        width: '100%', height: '100%',
        borderRadius: 'inherit',
        opacity: 0.4,
      }}
    />
  )
}

/* ── Starfield ── */
function runStarfield(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, params: Record<string, number>, alive: () => boolean) {
  const count = params.density || 150
  const speed = params.speed || 0.5
  const stars: Array<{ x: number; y: number; z: number; size: number }> = []

  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      z: Math.random() * 1000,
      size: Math.random() * 1.5 + 0.5,
    })
  }

  const draw = () => {
    if (!alive()) return
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2

    for (const star of stars) {
      star.z -= speed * 2
      if (star.z <= 0) {
        star.x = Math.random() * 2000 - 1000
        star.y = Math.random() * 2000 - 1000
        star.z = 1000
      }
      const sx = (star.x / star.z) * 300 + cx
      const sy = (star.y / star.z) * 300 + cy
      const r = (1 - star.z / 1000) * star.size * 2
      const alpha = 1 - star.z / 1000

      if (sx < 0 || sx > w || sy < 0 || sy > h) continue

      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(0.3, r), 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 200, 255, ${alpha})`
      ctx.fill()
    }

    requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  draw()
}

/* ── Pixel Galaxy ── */
function runPixelGalaxy(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, params: Record<string, number>, alive: () => boolean) {
  const count = params.density || 80
  const speed = params.speed || 0.3
  const pixels: Array<{ x: number; y: number; vx: number; vy: number; hue: number; size: number }> = []

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * 200 + 50
    pixels.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      vx: Math.cos(angle + Math.PI / 2) * (Math.random() * 0.5 + 0.2),
      vy: Math.sin(angle + Math.PI / 2) * (Math.random() * 0.5 + 0.2),
      hue: 240 + Math.random() * 80,
      size: Math.random() * 3 + 1,
    })
  }

  let t = 0
  const draw = () => {
    if (!alive()) return
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2
    t += 0.01 * speed

    for (const p of pixels) {
      const angle = Math.atan2(p.y, p.x)
      const dist = Math.sqrt(p.x * p.x + p.y * p.y)
      const rotSpeed = 0.002 * speed * (200 / (dist + 50))
      const newAngle = angle + rotSpeed
      p.x = Math.cos(newAngle) * dist
      p.y = Math.sin(newAngle) * dist

      const sx = p.x + cx
      const sy = p.y + cy
      const pixelSize = Math.max(2, p.size)

      ctx.fillStyle = `hsla(${p.hue + t * 20}, 70%, 60%, 0.8)`
      ctx.fillRect(Math.round(sx / pixelSize) * pixelSize, Math.round(sy / pixelSize) * pixelSize, pixelSize, pixelSize)
    }

    requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  draw()
}

/* ── Fractal (Julia set animation) ── */
function runFractal(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, params: Record<string, number>, alive: () => boolean) {
  const speed = params.speed || 0.5
  let t = 0

  const draw = () => {
    if (!alive()) return
    const w = canvas.width
    const h = canvas.height
    const imgData = ctx.createImageData(w, h)
    const data = imgData.data

    // Animate c parameter for Julia set
    const cr = -0.7 + Math.sin(t) * 0.15
    const ci = 0.27015 + Math.cos(t * 0.7) * 0.1
    const maxIter = 40
    const scale = 3.0 / Math.min(w, h)

    for (let py = 0; py < h; py += 2) {
      for (let px = 0; px < w; px += 2) {
        let zr = (px - w / 2) * scale
        let zi = (py - h / 2) * scale
        let iter = 0

        while (zr * zr + zi * zi < 4 && iter < maxIter) {
          const tmp = zr * zr - zi * zi + cr
          zi = 2 * zr * zi + ci
          zr = tmp
          iter++
        }

        const ratio = iter / maxIter
        const r = Math.floor(ratio * 100 + 30)
        const g = Math.floor(ratio * 60 + 10)
        const b = Math.floor(ratio * 200 + 50)

        // Fill 2x2 block for performance
        for (let dy = 0; dy < 2 && py + dy < h; dy++) {
          for (let dx = 0; dx < 2 && px + dx < w; dx++) {
            const idx = ((py + dy) * w + (px + dx)) * 4
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
            data[idx + 3] = iter === maxIter ? 0 : 180
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0)
    t += 0.003 * speed
    requestAnimationFrame(draw)
  }
  draw()
}

/* ── Evolving Shapes ── */
function runEvolvingShapes(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, params: Record<string, number>, alive: () => boolean) {
  const count = params.density || 12
  const speed = params.speed || 0.5
  const shapes: Array<{
    x: number; y: number; r: number; sides: number
    rotation: number; rotSpeed: number; hue: number; phase: number
  }> = []

  for (let i = 0; i < count; i++) {
    shapes.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 40 + 20,
      sides: Math.floor(Math.random() * 4) + 3,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02 * speed,
      hue: 240 + Math.random() * 80,
      phase: Math.random() * Math.PI * 2,
    })
  }

  let t = 0
  const draw = () => {
    if (!alive()) return
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)'
    ctx.fillRect(0, 0, w, h)

    for (const s of shapes) {
      s.rotation += s.rotSpeed
      const morphSides = s.sides + Math.sin(t * speed + s.phase) * 1.5
      const actualSides = Math.max(3, Math.round(morphSides))
      const sx = s.x * w
      const sy = s.y * h
      const sizeOscillation = 1 + Math.sin(t * 0.5 * speed + s.phase) * 0.3

      ctx.beginPath()
      for (let i = 0; i <= actualSides; i++) {
        const angle = (i / actualSides) * Math.PI * 2 + s.rotation
        const r = s.r * sizeOscillation
        const px = sx + Math.cos(angle) * r
        const py = sy + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.strokeStyle = `hsla(${s.hue + t * 10}, 60%, 50%, 0.4)`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    t += 0.02
    requestAnimationFrame(draw)
  }
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  draw()
}
