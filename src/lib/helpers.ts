export const uid = (): string => Math.random().toString(36).slice(2, 10)

export const today = (): string => new Date().toISOString().slice(0, 10)

export const fmtDate = (d: string): string =>
  new Date(d + 'T12:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

export const greeting = (): string => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const QUOTES = [
  { t: 'The secret of getting ahead is getting started.', a: 'Mark Twain' },
  { t: 'Focus on being productive instead of busy.', a: 'Tim Ferriss' },
  { t: 'Simplicity is the ultimate sophistication.', a: 'Leonardo da Vinci' },
  { t: 'It does not matter how slowly you go as long as you do not stop.', a: 'Confucius' },
  { t: 'The best way to predict the future is to create it.', a: 'Peter Drucker' },
  { t: 'Done is better than perfect.', a: 'Sheryl Sandberg' },
  { t: 'Energy, not time, is the fundamental currency.', a: 'Tony Schwartz' },
]

export const dailyQuote = () => QUOTES[new Date().getDay() % QUOTES.length]

/* Whiteboard colors */
export const STICKY_COLORS = [
  '#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#a78bfa',
  '#fb923c', '#f87171', '#4ade80', '#e879f9', '#38bdf8',
]

export const EVENT_PALETTE = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']

export const PEN_COLORS = ['#a78bfa', '#f472b6', '#34d399', '#60a5fa', '#fbbf24', '#f87171', '#ffffff', '#7c3aed']

export const WB_SIZE = { w: 6000, h: 4500 }

export const arrPts = (x1: number, y1: number, x2: number, y2: number, s = 13): string => {
  const a = Math.atan2(y2 - y1, x2 - x1)
  return `${x2},${y2} ${x2 - s * Math.cos(a - Math.PI / 6)},${y2 - s * Math.sin(a - Math.PI / 6)} ${x2 - s * Math.cos(a + Math.PI / 6)},${y2 - s * Math.sin(a + Math.PI / 6)}`
}
