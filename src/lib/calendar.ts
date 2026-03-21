import type { CalendarEvent, EventRecurrence } from './types'

export interface CalendarOccurrence extends CalendarEvent {
  occurrenceDate: string
  recurrence: EventRecurrence
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseDateKey(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function formatDateKey(value: number): string {
  return new Date(value).toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  return formatDateKey(parseDateKey(date) + days * DAY_MS)
}

export function getEventRecurrence(event: CalendarEvent): EventRecurrence {
  return event.recurrence || 'none'
}

export function recurrenceLabel(recurrence: EventRecurrence): string {
  return recurrence === 'none' ? 'One time' : recurrence[0].toUpperCase() + recurrence.slice(1)
}

export function eventOccursOnDate(event: CalendarEvent, date: string): boolean {
  const recurrence = getEventRecurrence(event)
  if (date < event.date) return false
  if (recurrence === 'none') return event.date === date
  if (recurrence === 'daily') return true

  const diffDays = Math.floor((parseDateKey(date) - parseDateKey(event.date)) / DAY_MS)
  if (recurrence === 'weekly') return diffDays % 7 === 0

  const [, startMonth, startDay] = event.date.split('-')
  const [, targetMonth, targetDay] = date.split('-')
  return startMonth === targetMonth && startDay === targetDay
}

export function listEventOccurrencesForDate(events: CalendarEvent[], date: string): CalendarOccurrence[] {
  return events
    .filter((event) => eventOccursOnDate(event, date))
    .map((event) => ({
      ...event,
      recurrence: getEventRecurrence(event),
      occurrenceDate: date,
    }))
    .sort((a, b) => {
      const timeCompare = (a.time || '').localeCompare(b.time || '')
      if (timeCompare !== 0) return timeCompare
      return a.title.localeCompare(b.title)
    })
}

export function listEventOccurrencesInRange(
  events: CalendarEvent[],
  startDate: string,
  endDate: string,
  limit = 200,
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = []
  for (const event of events) {
    const recurrence = getEventRecurrence(event)
    if (recurrence === 'none') {
      if (event.date >= startDate && event.date <= endDate) {
        out.push({ ...event, recurrence, occurrenceDate: event.date })
      }
      continue
    }

    if (recurrence === 'daily') {
      let date = startDate > event.date ? startDate : event.date
      while (date <= endDate) {
        out.push({ ...event, recurrence, occurrenceDate: date })
        date = addDays(date, 1)
      }
      continue
    }

    if (recurrence === 'weekly') {
      let date = event.date
      if (date < startDate) {
        const diffDays = Math.floor((parseDateKey(startDate) - parseDateKey(date)) / DAY_MS)
        date = addDays(date, diffDays + ((7 - (diffDays % 7)) % 7))
      }
      while (date <= endDate) {
        out.push({ ...event, recurrence, occurrenceDate: date })
        date = addDays(date, 7)
      }
      continue
    }

    const [startYear, startMonth, startDay] = event.date.split('-').map(Number)
    const [rangeStartYear] = startDate.split('-').map(Number)
    const [rangeEndYear] = endDate.split('-').map(Number)
    for (let year = Math.max(startYear, rangeStartYear); year <= rangeEndYear; year += 1) {
      const occurrenceDate = `${year}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
      if (occurrenceDate >= startDate && occurrenceDate >= event.date && occurrenceDate <= endDate) {
        out.push({ ...event, recurrence, occurrenceDate })
      }
    }
  }

  return out
    .sort((a, b) => {
      const dateCompare = a.occurrenceDate.localeCompare(b.occurrenceDate)
      if (dateCompare !== 0) return dateCompare
      const timeCompare = (a.time || '').localeCompare(b.time || '')
      if (timeCompare !== 0) return timeCompare
      return a.title.localeCompare(b.title)
    })
    .slice(0, limit)
}
