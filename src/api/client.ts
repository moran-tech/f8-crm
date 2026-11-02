import { config } from '../config.ts'
import { authExpiredEvent, isValidSession, saveSession } from './auth.ts'
import { plainDate, sponsorEvent, sponsorLevels, sponsorStatuses } from '../sponsors.ts'
import type {
  Answer, CrmApi, CrmEvent, EventStatus, Overview, PersonDetail,
  PersonSummary, Response, Session, Sponsor, SponsorSummary, Touch,
} from './types.ts'

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback
const count = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback
}
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const strings = (value: unknown): string[] => [...new Set(array(value).map(item => text(item)).filter(Boolean))]
const answer = (value: unknown): Answer =>
  value === true ? 'yes' : value === false ? 'no'
    : ['yes', 'no', 'unknown', 'n/a'].includes(text(value)) ? value as Answer : 'unknown'
const response = (value: unknown): Response =>
  ['yes', 'maybe', 'no', 'unknown'].includes(text(value)) ? value as Response : 'unknown'

export function normalizeEvent(value: unknown): CrmEvent {
  const item = record(value)
  return {
    key: text(item.key ?? item.event_key),
    name: text(item.name ?? item.event_name, 'Untitled event'),
    date: text(item.date),
    venue: text(item.venue),
  }
}

export function normalizePerson(value: unknown): PersonSummary {
  const item = record(value)
  return {
    id: text(item.id),
    name: text(item.name, 'Unnamed contact'),
    contact: text(item.contact),
    organization: text(item.organization),
    kind: text(item.kind),
    platforms: strings(item.platforms),
    events: strings(item.events),
    replied: answer(item.replied),
    response: response(item.response),
    paid: answer(item.paid),
    signed_up: answer(item.signed_up),
    amount_cents: count(item.amount_cents),
    last_touch_date: text(item.last_touch_date),
  }
}

export function normalizeEventStatus(value: unknown): EventStatus {
  const item = record(value)
  return {
    event_key: text(item.event_key ?? item.key),
    event_name: text(item.event_name ?? item.name ?? item.event_key, 'Event'),
    replied: answer(item.replied),
    response: response(item.response),
    paid: answer(item.paid),
    signed_up: answer(item.signed_up),
    amount_cents: count(item.amount_cents),
    notes: text(item.notes),
  }
}

function normalizeTouch(value: unknown, index: number): Touch {
  const item = record(value)
  return {
    id: text(item.id, `touch-${index}`),
    platform: text(item.platform, 'other'),
    platform_label: text(item.platform_label),
    event_key: text(item.event_key),
    event_label: text(item.event_label),
    date_text: text(item.date_text ?? item.date),
    message_summary: text(item.message_summary),
    reply_summary: text(item.reply_summary),
    replied: answer(item.replied),
    outreach_status: text(item.outreach_status),
    contacted: answer(item.contacted),
    source: text(item.source),
    notes: text(item.notes),
  }
}

export function normalizeDetail(value: unknown): PersonDetail {
  const data = record(value)
  const person = record(data.person ?? value)
  return {
    person: { ...normalizePerson(person), type: text(person.type), notes: text(person.notes) },
    events: array(data.events ?? person.events).filter(item => typeof item === 'object')
      .map(normalizeEventStatus).filter(item => item.event_key),
    touches: array(data.touches ?? data.touch_history).map(normalizeTouch),
  }
}

export function normalizeOverview(value: unknown): Overview {
  const data = record(value)
  const invited = record(data.invited)
  const people = array(invited.people ?? invited.contacts ?? invited.list ?? data.invited_people ?? data.people)
    .map(normalizePerson).filter(person => person.id)
  const funnel = record(data.funnel)
  return {
    event: normalizeEvent(data.event),
    invited: { count: count(invited.count ?? funnel.invited, people.length), people },
    funnel: {
      invited: count(funnel.invited ?? invited.count, people.length),
      replied: count(funnel.replied),
      yes: count(funnel.yes ?? funnel.said_yes),
      paid: count(funnel.paid),
    },
    paid_total: count(data.paid_total, count(funnel.paid)),
    signed_up_total: count(data.signed_up_total),
    revenue_cents: count(data.revenue_cents),
    platforms: array(data.platforms).map(value => {
      const item = record(value)
      return {
        platform: text(item.platform ?? item.key, 'other'),
        invited: count(item.invited),
        replied: count(item.replied),
        yes: count(item.yes ?? item.said_yes),
        paid: count(item.paid),
      }
    }),
    partners: { count: count(record(data.partners).count) },
  }
}

const nullableText = (value: unknown): string | null => text(value) || null
const sponsorStatus = (value: unknown): Sponsor['status'] =>
  sponsorStatuses.find(status => status.value === value)?.value ?? 'not_contacted'

export function normalizeSponsor(value: unknown): Sponsor {
  const item = record(value)
  return {
    id: text(item.id),
    event_key: text(item.event_key, sponsorEvent),
    business_name: text(item.business_name, 'Unnamed business'),
    contact_name: nullableText(item.contact_name),
    email: nullableText(item.email),
    category: nullableText(item.category),
    area: nullableText(item.area),
    date_pitched: plainDate(item.date_pitched),
    status: sponsorStatus(item.status),
    level: sponsorLevels.find(level => level.value === item.level)?.value ?? null,
    amount_cents: item.amount_cents == null || item.amount_cents === '' ? null : count(item.amount_cents),
    follow_up_date: plainDate(item.follow_up_date),
    notes: nullableText(item.notes),
    source: nullableText(item.source),
    created_at: text(item.created_at),
    updated_at: text(item.updated_at),
  }
}

export function normalizeSponsorSummary(value: unknown): SponsorSummary {
  const item = record(value)
  const byStatus = record(item.by_status)
  const levels = record(item.levels)
  const platinum = record(item.platinum)
  const holder = record(platinum.holder)
  return {
    event_key: text(item.event_key, sponsorEvent),
    total: count(item.total),
    by_status: {
      not_contacted: count(byStatus.not_contacted), pitched: count(byStatus.pitched),
      replied: count(byStatus.replied), interested: count(byStatus.interested),
      confirmed: count(byStatus.confirmed), declined: count(byStatus.declined),
    },
    committed_cents: count(item.committed_cents),
    pipeline_cents: count(item.pipeline_cents),
    platinum: {
      taken: platinum.taken === true,
      holder: holder.id != null ? {
        id: text(holder.id), business_name: text(holder.business_name, 'another sponsor'), status: sponsorStatus(holder.status),
      } : null,
    },
    levels: { platinum: count(levels.platinum), gold: count(levels.gold), silver: count(levels.silver) },
    follow_ups_due: count(item.follow_ups_due),
  }
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function createApi(getSession: () => Session | null, onUnauthorized?: () => void): CrmApi {
  async function request(path: string, options: RequestInit = {}, authenticated = true): Promise<unknown> {
    const session = getSession()
    function expire() {
      saveSession(null)
      onUnauthorized?.()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(authExpiredEvent))
    }
    if (authenticated && !isValidSession(session)) {
      expire()
      throw new ApiError('Your session has expired. Please sign in again.', 401)
    }
    let result: globalThis.Response
    try {
      result = await fetch(`${config.apiBase}${path}`, {
        ...options,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(authenticated && session ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      throw new ApiError('Could not reach the CRM. Check your connection and try again.', 0)
    }
    if (result.status === 401) {
      if (authenticated) expire()
      throw new ApiError(authenticated ? 'Your session has expired. Please sign in again.' : 'That password didn’t work. Try again.', 401)
    }
    if (!result.ok) {
      if (path.startsWith('/crm/sponsors') && [400, 409].includes(result.status)) {
        const data = record(await result.json().catch(() => null))
        const code = text(data.error)
        const message = code === 'platinum_taken'
          ? `Platinum is already taken by ${text(record(data.holder).business_name, 'another sponsor')}. Choose another level.`
          : code === 'duplicate' ? 'A sponsor with this business name or email already exists'
            : result.status === 400 ? 'Check the sponsor fields and try again. The CRM could not validate these details.'
              : 'This sponsor changed while you were editing. Check the details and try again.'
        throw new ApiError(message, result.status, code)
      }
      throw new ApiError(result.status === 404 ? 'This record could not be found.' : 'The CRM could not complete that request. Please try again.', result.status)
    }
    try {
      return await result.json()
    } catch {
      throw new ApiError('The CRM returned an unreadable response. Please try again.', result.status)
    }
  }

  return {
    async login(password) {
      const data = record(await request('/crm/login', { method: 'POST', body: JSON.stringify({ password }) }, false))
      const session = { token: text(data.token), expiresAt: text(data.expiresAt) }
      if (!isValidSession(session)) throw new ApiError('The server did not return a valid session.', 0)
      return session
    },
    async events() {
      const data = await request('/crm/events')
      return array(Array.isArray(data) ? data : record(data).events).map(normalizeEvent).filter(event => event.key)
    },
    async people(filters) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
      const data = await request(`/crm/people?${params}`)
      return array(Array.isArray(data) ? data : record(data).people).map(normalizePerson).filter(person => person.id)
    },
    async person(id) {
      return normalizeDetail(await request(`/crm/people/${encodeURIComponent(id)}`))
    },
    async updatePerson(id, patch) {
      return normalizeDetail(await request(`/crm/people/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      }))
    },
    async overview(event) {
      return normalizeOverview(await request(`/crm/overview?${new URLSearchParams({ event })}`))
    },
    async sponsors(filters) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
      const data = record(await request(`/crm/sponsors?${params}`))
      return array(data.sponsors).map(normalizeSponsor).filter(sponsor => sponsor.id)
    },
    async sponsor(id) {
      return normalizeSponsor(record(await request(`/crm/sponsors/${encodeURIComponent(id)}`)).sponsor)
    },
    async createSponsor(input) {
      return normalizeSponsor(record(await request('/crm/sponsors', {
        method: 'POST', body: JSON.stringify(input),
      })).sponsor)
    },
    async updateSponsor(id, patch) {
      return normalizeSponsor(record(await request(`/crm/sponsors/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      })).sponsor)
    },
    async sponsorSummary(event) {
      return normalizeSponsorSummary(await request(`/crm/sponsors/summary?${new URLSearchParams({ event })}`))
    },
  }
}
