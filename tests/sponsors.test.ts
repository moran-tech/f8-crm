import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { ApiError, createApi, normalizeSponsor, normalizeSponsorSummary } from '../src/api/client.ts'
import { createDemoApi } from '../src/api/demo.ts'
import { plainDate, sponsorAmount, sponsorStatuses } from '../src/sponsors.ts'
import { eventDate, safeEmailLink } from '../src/utils.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const validSession = () => ({ token: 'fake-sponsor-test-token', expiresAt: new Date(Date.now() + 60_000).toISOString() })

test('sponsor normalization tolerates nulls, bad enums, dates, and numeric strings', () => {
  const sponsor = normalizeSponsor({
    id: 4, event_key: 'eoy-mixer', business_name: 'Demo Business', contact_name: null,
    status: 'confirmed', level: 'gold', amount_cents: '50000', date_pitched: '2026-12-05',
    follow_up_date: '2026-02-30', unexpected: true,
  })
  assert.equal(sponsor.id, '4')
  assert.equal(sponsor.amount_cents, 50_000)
  assert.equal(sponsor.date_pitched, '2026-12-05')
  assert.equal(sponsor.follow_up_date, null)
  assert.equal(sponsor.contact_name, null)
  assert.equal(sponsor.status, 'confirmed')
  assert.equal(sponsor.level, 'gold')
  assert.equal(normalizeSponsor(null).amount_cents, null)
  assert.equal(normalizeSponsor({ amount_cents: 0 }).amount_cents, 0)
  const bad = normalizeSponsor({ status: 'paid', level: 'diamond', email: {}, amount_cents: -1 })
  assert.equal(bad.status, 'not_contacted')
  assert.equal(bad.level, null)
  assert.equal(bad.email, null)
  assert.equal(bad.amount_cents, 0)
  assert.equal(normalizeSponsorSummary(null).platinum.taken, false)
  const summary = normalizeSponsorSummary({
    total: '3', by_status: { confirmed: '1', replied: -2 }, committed_cents: '50000',
    platinum: { taken: true, holder: { id: 4, business_name: 'Demo Business', status: 'interested' } },
    levels: { platinum: '1', gold: '1' }, follow_ups_due: '2',
  })
  assert.equal(summary.total, 3)
  assert.equal(summary.by_status.confirmed, 1)
  assert.equal(summary.by_status.replied, 0)
  assert.equal(summary.platinum.holder?.id, '4')
  assert.equal(summary.levels.platinum, 1)
  assert.equal(summary.follow_ups_due, 2)
  assert.equal(normalizeSponsorSummary({ platinum: { taken: 'false', holder: null } }).platinum.taken, false)
})

test('sponsor requests follow wrapped contracts, encode IDs and filters, preserve null clears', async () => {
  const requests: { url: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    const path = String(url)
    requests.push({ url: path, options })
    return Response.json(path.includes('/summary?') ? { event_key: 'eoy-mixer', total: '1' }
      : path.includes('/sponsors?') ? { sponsors: [{ id: 'fake/id' }, {}, null] }
        : { sponsor: { id: 'fake/id', business_name: 'Demo Business' } })
  }
  const api = createApi(validSession)
  assert.equal((await api.sponsors({ q: 'Demo & Fake', status: 'interested', event: 'eoy-mixer' })).length, 1)
  assert.equal((await api.sponsor('fake/id')).id, 'fake/id')
  await api.createSponsor({ business_name: 'Demo Business', event_key: 'eoy-mixer', amount_cents: 0 })
  await api.updateSponsor('fake/id', { notes: null, level: null, amount_cents: null })
  assert.equal((await api.sponsorSummary('eoy-mixer')).total, 1)
  assert.match(requests[0]!.url, /q=Demo\+%26\+Fake&status=interested&event=eoy-mixer/)
  assert.match(requests[1]!.url, /\/sponsors\/fake%2Fid$/)
  assert.equal(requests[2]!.options?.method, 'POST')
  assert.equal(requests[3]!.options?.method, 'PATCH')
  assert.deepEqual(JSON.parse(requests[3]!.options?.body as string), { notes: null, level: null, amount_cents: null })
  assert.match(requests[4]!.url, /\/sponsors\/summary\?event=eoy-mixer$/)
  for (const request of requests) {
    assert.equal((request.options!.headers as Record<string, string>).Authorization, 'Bearer fake-sponsor-test-token')
    assert.equal(request.options?.cache, 'no-store')
  }
})

test('sponsor conflicts and validation errors are clear without reflecting server diagnostics', async () => {
  const api = createApi(validSession)
  globalThis.fetch = async () => Response.json({ error: 'platinum_taken', holder: { id: 1, business_name: 'Demo Holder' } }, { status: 409 })
  await assert.rejects(api.createSponsor({ business_name: 'Demo Prospect' }), (cause: unknown) =>
    cause instanceof ApiError && cause.code === 'platinum_taken' && cause.status === 409 && /already taken by Demo Holder/.test(cause.message))
  globalThis.fetch = async () => Response.json({ error: 'duplicate' }, { status: 409 })
  await assert.rejects(api.updateSponsor('fake', {}), /business name already exists/)
  globalThis.fetch = async () => Response.json({ error: 'private internal diagnostic' }, { status: 400 })
  await assert.rejects(api.createSponsor({ business_name: '' }), /Check the sponsor fields/)
  globalThis.fetch = async () => new Response('bad json', { status: 409 })
  await assert.rejects(api.updateSponsor('fake', {}), /changed while you were editing/)
})

test('sponsor 401 uses existing logout flow', async () => {
  let logouts = 0
  const api = createApi(validSession, () => logouts++)
  globalThis.fetch = async () => new Response(null, { status: 401 })
  await assert.rejects(api.sponsors({}), /session has expired/)
  await assert.rejects(api.sponsorSummary('eoy-mixer'), /session has expired/)
  assert.equal(logouts, 2)
})

test('demo sponsors are fictional, cover all statuses, and compose filters', async () => {
  const api = createDemoApi(0)
  const list = await api.sponsors({ event: 'eoy-mixer' })
  assert.equal(list.length, 15)
  assert.ok(list.every(item => item.business_name.endsWith('(demo)') && item.email?.endsWith('@example.com')))
  assert.deepEqual(new Set(list.map(item => item.status)), new Set(sponsorStatuses.map(item => item.value)))
  assert.ok(list.some(item => item.status === 'confirmed' && item.level === 'gold'))
  assert.equal((await api.sponsors({ q: 'mOonbeam', status: 'pitched', event: 'eoy-mixer' })).length, 1)
  assert.equal((await api.sponsors({ q: 'not-a-fake-business' })).length, 0)
  assert.equal((await api.sponsors({ event: 'another-event' })).length, 0)
  const summary = await api.sponsorSummary('eoy-mixer')
  assert.equal(summary.total, 15)
  assert.equal(Object.values(summary.by_status).reduce((sum, value) => sum + value), 15)
  assert.equal(summary.committed_cents, list.filter(item => item.status === 'confirmed').reduce((sum, item) => sum + (item.amount_cents ?? 0), 0))
  assert.equal(summary.pipeline_cents, list.filter(item => item.status === 'interested').reduce((sum, item) => sum + (item.amount_cents ?? 0), 0))
  assert.ok(summary.follow_ups_due > 0)
  assert.deepEqual(summary.platinum, { taken: false, holder: null })
})

test('demo POST, partial PATCH, null clears, isolation, and summary recalculation', async () => {
  const api = createDemoApi(0)
  const created = await api.createSponsor({ business_name: 'Demo Test Business', status: 'interested', level: 'gold', amount_cents: 50_000 })
  assert.equal(created.event_key, 'eoy-mixer')
  assert.equal(created.contact_name, null)
  const before = await api.sponsorSummary('eoy-mixer')
  await api.updateSponsor(created.id, { status: 'confirmed', notes: 'Demo notes', amount_cents: 70_050, source: 'Demo source' })
  const after = await api.sponsorSummary('eoy-mixer')
  assert.equal(after.committed_cents, before.committed_cents + 70_050)
  assert.equal(after.pipeline_cents, before.pipeline_cents - 50_000)
  await api.updateSponsor(created.id, { notes: null, level: null, amount_cents: null, source: null })
  const cleared = await api.sponsor(created.id)
  assert.equal(cleared.notes, null)
  assert.equal(cleared.level, null)
  assert.equal(cleared.amount_cents, null)
  assert.equal(cleared.source, null)
  assert.equal(cleared.status, 'confirmed')
  cleared.business_name = 'Changed local copy'
  assert.equal((await api.sponsor(created.id)).business_name, 'Demo Test Business')
  assert.equal((await createDemoApi(0).sponsorSummary('eoy-mixer')).total, 15)
  await assert.rejects(api.sponsor('missing'), /could not be found/)
})

test('Platinum has one non-declined holder per event; failures are atomic', async () => {
  const api = createDemoApi(0)
  const first = await api.createSponsor({ business_name: 'Demo Platinum Holder', level: 'platinum', status: 'interested', amount_cents: 100_000 })
  const second = await api.createSponsor({ business_name: 'Demo Silver Prospect', level: 'silver', amount_cents: 30_000 })
  await assert.rejects(api.updateSponsor(second.id, { level: 'platinum', business_name: 'Should not save' }), /already taken by Demo Platinum Holder/)
  assert.equal((await api.sponsor(second.id)).level, 'silver')
  assert.equal((await api.sponsor(second.id)).business_name, 'Demo Silver Prospect')
  await assert.rejects(api.createSponsor({ business_name: 'Demo Extra Platinum', level: 'platinum' }), /already taken/)
  assert.equal((await api.sponsorSummary('eoy-mixer')).total, 17)
  await api.updateSponsor(first.id, { status: 'confirmed' })
  assert.equal((await api.sponsorSummary('eoy-mixer')).platinum.holder?.status, 'confirmed')
  await api.createSponsor({ business_name: 'Demo Other Event', event_key: 'other', level: 'platinum' })
  await api.updateSponsor(first.id, { status: 'declined' })
  assert.equal((await api.sponsorSummary('eoy-mixer')).platinum.taken, false)
  await api.updateSponsor(second.id, { level: 'platinum' })
  await assert.rejects(api.updateSponsor(first.id, { status: 'interested' }), /already taken/)
  await api.updateSponsor(second.id, { level: null })
  assert.equal((await api.sponsorSummary('eoy-mixer')).platinum.taken, false)
})

test('demo duplicate and validation rules reject invalid writes without losing data', async () => {
  const api = createDemoApi(0)
  const item = (await api.sponsors({}))[0]!
  await assert.rejects(api.createSponsor({ business_name: `  ${item.business_name.toUpperCase()} ` }), /already exists/)
  await assert.rejects(api.updateSponsor(item.id, { business_name: '' }), (cause: unknown) => cause instanceof ApiError && cause.status === 400)
  await assert.rejects(api.updateSponsor(item.id, { amount_cents: -1 }), /Check the sponsor fields/)
  await assert.rejects(api.updateSponsor(item.id, { date_pitched: '2026-02-30' }), /Check the sponsor fields/)
  await assert.rejects(api.updateSponsor('missing', { notes: null }), /could not be found/)
  assert.equal((await api.sponsor(item.id)).business_name, item.business_name)
  assert.equal((await api.sponsorSummary('eoy-mixer')).total, 15)
})

test('plain dates do not shift across timezones; cents and email links are safe', () => {
  assert.equal(plainDate('2026-12-05'), '2026-12-05')
  for (const bad of ['2026-02-30', '2026-12-05T00:00:00Z', '12/05/2026', '', null]) assert.equal(plainDate(bad), null)
  const previous = process.env.TZ
  try {
    for (const zone of ['America/Vancouver', 'Pacific/Honolulu', 'Pacific/Kiritimati']) {
      process.env.TZ = zone
      assert.match(eventDate('2026-12-05', { day: 'numeric', month: 'long' }), /December 5/)
    }
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
  assert.equal(sponsorAmount(''), null)
  assert.equal(sponsorAmount('700.50'), 70_050)
  assert.equal(sponsorAmount('0'), 0)
  for (const invalid of ['-1', '0.001', '1e3', 'NaN', '1,000', '9007199254740991']) assert.equal(sponsorAmount(invalid), undefined)
  assert.equal(safeEmailLink(' demo.test+one@example.com '), 'mailto:demo.test+one@example.com')
  for (const unsafe of ['javascript:hi@example.com', 'https://example.com', 'a@example.com?subject=bad', 'a@example.com%0ABcc:x', 'a\n@example.com', 'a..b@example.com']) assert.equal(safeEmailLink(unsafe), undefined)
})
