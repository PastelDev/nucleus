export const uid = (): string => Math.random().toString(36).slice(2, 10)

export const today = (): string => new Date().toISOString().slice(0, 10)

export const fmtDate = (d: string): string =>
  new Date(d + 'T12:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

export const greeting = (): string => {
  const now = new Date()
  const h = now.getHours()
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const seed = now.getDate() + now.getMonth() * 31 // changes daily

  let pool: string[]

  if (h >= 0 && h < 6) {
    // Late night
    pool = [
      "What's on your mind tonight?",
      'Hello, night owl',
      "How's it going?",
      'Still going strong?',
      'Up late again?',
      'Good to see you',
    ]
  } else if (h < 12) {
    // Morning
    const daySpecific: Record<number, string[]> = {
      1: ['Happy Monday', "New week, let's go"],
      2: ['Happy Tuesday'],
      3: ['Happy Wednesday', 'Halfway through the week'],
      4: ['Happy Thursday', 'Almost there'],
      5: ['Happy Friday', 'That Friday feeling'],
      6: ['Happy Saturday', 'Welcome to the weekend', "What's on your mind?"],
      0: ['Happy Sunday', 'Sunday session?', 'Welcome to the weekend'],
    }
    pool = [
      'Good morning',
      'Welcome back',
      'Hey there',
      'Coffee and focus time?',
      "What's on your list today?",
      'Ready to get things done?',
      ...(daySpecific[day] || []),
    ]
  } else if (h < 17) {
    // Afternoon
    pool = [
      'Good afternoon',
      'Back at it',
      "What's new?",
      'How is the day going?',
      'Afternoon check-in',
      "What's on your list?",
      'Making progress?',
      'Hi, how are you?',
    ]
  } else if (h < 21) {
    // Evening
    pool = [
      'Good evening',
      'Evening',
      'How was your day?',
      'Winding down?',
      'End-of-day review?',
      "What's left on the list?",
      'returns!',
    ]
  } else {
    // Late evening (9pm–midnight)
    pool = [
      "What's on your mind tonight?",
      'Hello, night owl',
      'Still going?',
      'Evening wind-down?',
      'One more thing before bed?',
      'Good to see you',
    ]
  }

  return pool[seed % pool.length]
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
