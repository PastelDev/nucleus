import type { CSSProperties, ReactNode } from 'react'
import type { SurfaceRole } from '../lib/types'
import SurfaceBackground from './SurfaceBackground'

interface Props {
  targetId: string
  role?: SurfaceRole
  glass?: 'panel' | 'floating' | 'popup' | null
  style?: CSSProperties
  contentStyle?: CSSProperties
  className?: string
  children: ReactNode
}

export default function SurfaceFrame({
  targetId,
  role,
  glass = null,
  style,
  contentStyle,
  className,
  children,
}: Props) {
  return (
    <div
      className={[
        className,
        glass ? `glass-${glass}` : null,
        glass ? 'glass-surface' : null,
      ].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        ...style,
      }}
    >
      <SurfaceBackground targetId={targetId} role={role} />
      <div style={{ position: 'relative', zIndex: 'var(--z-content)', ...contentStyle }}>
        {children}
      </div>
    </div>
  )
}
