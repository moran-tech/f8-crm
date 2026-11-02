export const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100)
export const percent = (value: number, total: number) => total > 0 ? Math.round(value / total * 100) : 0
export const barWidth = (value: number, total: number) => Math.min(100, percent(value, total))

export function eventDate(date: string, options?: Intl.DateTimeFormatOptions) {
  if (!date) return 'Date to be confirmed'
  const parsed = new Date(date.length === 10 ? `${date}T12:00:00` : date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-CA', options ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

export function safeContactLink(contact: string): string | undefined {
  const trimmed = contact.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !/[:?#]/.test(trimmed)) return `mailto:${trimmed}`
  try {
    const url = new URL(trimmed)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
  } catch { /* Non-link contact values are rendered as plain text. */ }
  return undefined
}

export function safeEmailLink(email: string): string | undefined {
  const value = email.trim()
  // Only a single, plain mailbox, no URL schemes, query strings, or encoded headers.
  return /^[a-z0-9.!_+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value)
    && value.length <= 254 && !value.startsWith('.') && !value.includes('..')
    ? `mailto:${value}` : undefined
}
