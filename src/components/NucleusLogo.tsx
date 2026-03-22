interface Props {
  size?: number
  className?: string
}

export default function NucleusLogo({ size = 30, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="nuc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent, #7c3aed)" />
          <stop offset="100%" stopColor="var(--accent-light, #a78bfa)" />
        </linearGradient>
        <linearGradient id="nuc-inner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-light, #a78bfa)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--accent, #7c3aed)" stopOpacity="0.6" />
        </linearGradient>
        <filter id="nuc-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Outer hexagon */}
      <polygon
        points="50,5 91,27.5 91,72.5 50,95 9,72.5 9,27.5"
        fill="none"
        stroke="url(#nuc-grad)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Middle hexagon */}
      <polygon
        points="50,22 75,36 75,64 50,78 25,64 25,36"
        fill="url(#nuc-inner)"
        fillOpacity="0.15"
        stroke="url(#nuc-grad)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Inner hexagon */}
      <polygon
        points="50,38 62,44.5 62,55.5 50,62 38,55.5 38,44.5"
        fill="url(#nuc-grad)"
        fillOpacity="0.6"
        stroke="url(#nuc-grad)"
        strokeWidth="2"
        strokeLinejoin="round"
        filter="url(#nuc-glow)"
      />
      {/* Center dot */}
      <circle cx="50" cy="50" r="4" fill="url(#nuc-grad)" />
    </svg>
  )
}
