import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createApi, normalizeDetail, normalizeOverview, normalizePerson } from '../src/api/client.ts'
import { isValidSession, readSession, saveSession } from '../src/api/auth.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const validSession = () => ({ token: 'test-only-fake-token', expiresAt: new Date(Date.now() + 60_000).toISOString() })

test('normalizers tolerate missing fields without inventing status', () => {
  const person = normalizePerson({ id: 12, name: 'Demo Test', platforms: ['email', 'email'], replied: true, paid: false, amount_cents: -10 })
  assert.equal(person.id, '12')
  assert.deepEqual(person.platforms, ['email'])
  assert.equal(person.replied, 'yes')
  assert.equal(person.paid, 'no')
  assert.equal(person.response, 'unknown')
  assert.equal(person.signed_up, 'unknown')
  assert.equal(person.amount_cents, 0)
  assert.deepEqual(normalizeOverview(null).funnel, { invited: 0, replied: 0, yes: 0, paid: 0 })
  assert.equal(normalizePerson({ replied: 'n/a' }).replied, 'n/a')
})

test('overview accepts invitee aliases and numeric counts', () => {
  for (const key of ['people', 'contacts', 'list']) {
    const data = normalizeOverview({
      event: { event_key: 'eoy-mixer', event_name: 'Demo Mixer' },
      invited: { count: '2', [key]: [{ id: 1, name: 'Demo One' }] },
      funnel: { invited: '2', replied: '1', said_yes: '1', paid: '1' },
      revenue_cents: '3755', platforms: [{ key: 'email', invited: '2', replied: '1' }],
      unexpected: { ignored: true },
    })
    assert.equal(data.invited.people[0]?.id, '1')
    assert.equal(data.invited.count, 2)
    assert.equal(data.funnel.yes, 1)
    assert.equal(data.paid_total, 1)
    assert.equal(data.revenue_cents, 3755)
    assert.equal(data.platforms[0]?.platform, 'email')
    assert.equal(data.event.key, 'eoy-mixer')
  }
  assert.equal(normalizeOverview({ invited_people: [{ id: 'fake' }] }).invited.people.length, 1)
})

test('detail normalizes statuses and touch history independently', () => {
  const detail = normalizeDetail({
    person: { id: 1, name: 'Demo Person', notes: 'Fictional', extra: 'ignored' },
    events: [{ key: 'eoy-mixer', name: 'Demo Mixer', paid: 'yes', amount_cents: '3755' }],
    touch_history: [{ platform: 'email', replied: false, contacted: true, date: '2026-10-31' }],
  })
  assert.equal(detail.person.notes, 'Fictional')
  assert.equal(detail.events[0]?.amount_cents, 3755)
  assert.equal(detail.events[0]?.replied, 'unknown')
  assert.equal(detail.touches[0]?.date_text, '2026-10-31')
  assert.equal(detail.touches[0]?.contacted, 'yes')
})

test('authenticated requests encode filters and IDs and send bearer token', async () => {
  const requests: { url: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options })
    return Response.json(String(url).includes('/people?') ? { people: [{ id: 1 }] } : { person: { id: 'a/b' } })
  }
  const api = createApi(validSession)
  await api.people({ q: 'Demo & Fake', event: 'eoy-mixer', status: 'paid', platform: 'email' })
  await api.updatePerson('a/b', { notes: 'Fictional edit' })
  assert.match(requests[0]!.url, /q=Demo\+%26\+Fake/)
  assert.match(requests[0]!.url, /event=eoy-mixer/)
  assert.match(requests[1]!.url, /\/people\/a%2Fb$/)
  assert.equal(requests[1]!.options?.method, 'PATCH')
  assert.equal(requests[1]!.options?.cache, 'no-store')
  assert.equal((requests[0]!.options!.headers as Record<string, string>).Authorization, 'Bearer test-only-fake-token')
  assert.deepEqual(JSON.parse(requests[1]!.options?.body as string), { notes: 'Fictional edit' })
})

test('login sends no bearer token and validates expiry', async () => {
  let headers: Record<string, string> = {}
  let body = ''
  globalThis.fetch = async (_url, options) => {
    headers = options?.headers as Record<string, string>
    body = options?.body as string
    return Response.json(validSession())
  }
  const api = createApi(() => null)
  assert.ok((await api.login('fake-test-password')).token)
  assert.deepEqual(JSON.parse(body), { password: 'fake-test-password' })
  assert.equal(headers.Authorization, undefined)
  globalThis.fetch = async () => Response.json({ token: 'fake', expiresAt: '2000-01-01' })
  await assert.rejects(api.login('fake-test-password'), /valid session/)
})

test('401 and expired sessions trigger logout; login 401 does not', async () => {
  let unauthorized = 0
  let requests = 0
  globalThis.fetch = async () => { requests++; return new Response(null, { status: 401 }) }
  const api = createApi(validSession, () => unauthorized++)
  await assert.rejects(api.events(), /session has expired/)
  assert.equal(unauthorized, 1)
  await assert.rejects(api.login('fake'), /password/)
  assert.equal(unauthorized, 1)
  const expired = createApi(() => ({ token: 'fake', expiresAt: '2000-01-01' }), () => unauthorized++)
  await assert.rejects(expired.events(), /session has expired/)
  assert.equal(unauthorized, 2)
  assert.equal(requests, 2)
})

test('network, server, and malformed JSON errors have retryable messages', async () => {
  const api = createApi(validSession)
  globalThis.fetch = async () => { throw new Error('secret internal diagnostic') }
  await assert.rejects(api.events(), /Check your connection/)
  globalThis.fetch = async () => new Response('invalid', { status: 200 })
  await assert.rejects(api.events(), /unreadable response/)
  globalThis.fetch = async () => new Response('private server trace', { status: 500 })
  await assert.rejects(api.events(), /Please try again/)
})

test('events can be bare arrays or wrapped', async () => {
  const api = createApi(validSession)
  for (const value of [[{ key: 'fake', name: 'Demo Event' }], { events: [{ key: 'fake' }] }]) {
    globalThis.fetch = async () => Response.json(value)
    assert.equal((await api.events())[0]?.key, 'fake')
  }
})

test('session validation rejects corrupt/expired storage and supports sign out', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    configurable: true,
  })
  assert.equal(isValidSession({ token: 'fake', expiresAt: 'bad date' }), false)
  assert.equal(isValidSession({ token: '', expiresAt: '2099-01-01' }), false)
  saveSession(validSession())
  assert.ok(readSession())
  saveSession(null)
  assert.equal(readSession(), null)
  storage.set('f8-crm-session', '{"token":"fake","expiresAt":"2000-01-01"}')
  assert.equal(readSession(), null)
  assert.equal(storage.size, 0)
  storage.set('f8-crm-session', 'bad json')
  assert.equal(readSession(), null)
  assert.equal(storage.size, 0)
  Reflect.deleteProperty(globalThis, 'localStorage')
})
