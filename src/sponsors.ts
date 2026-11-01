import type { SponsorLevel, SponsorStatus } from './api/types.ts'

export const sponsorEvent = 'eoy-mixer'
export const sponsorStatuses: { value: SponsorStatus; label: string; color: string }[] = [
  { value: 'not_contacted', label: 'Not contacted', color: 'neutral' },
  { value: 'pitched', label: 'Pitched', color: 'blue' },
  { value: 'replied', label: 'Replied', color: 'purple' },
  { value: 'interested', label: 'Interested', color: 'amber' },
  { value: 'confirmed', label: 'Confirmed', color: 'green' },
  { value: 'declined', label: 'Declined', color: 'rose' },
]
export const sponsorLevels: { value: SponsorLevel; label: string; cents: number }[] = [
  { value: 'platinum', label: 'Platinum', cents: 100_000 },
  { value: 'gold', label: 'Gold', cents: 50_000 },
  { value: 'silver', label: 'Silver', cents: 30_000 },
]

/** Calendar dates stay dates, never UTC timestamps. Reject invalid dates too. */
export function plainDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value
}

/** Undefined means invalid; null clears the optional amount. */
export function sponsorAmount(value: string): number | null | undefined {
  if (!value.trim()) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined
  const cents = Math.round(Number(value) * 100)
  return Number.isSafeInteger(cents) ? cents : undefined
}
