import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoApi } from '../src/api/demo.ts'

test('demo contains 25 obviously fictional people and three CAD payments', async () => {
  const api = createDemoApi(0)
  const people = await api.people({})
  assert.equal(people.length, 25)
  assert.ok(people.every(person => person.name.startsWith('Demo ') && person.contact.endsWith('@example.invalid')))
  assert.equal(people.filter(person => person.paid === 'yes').length, 3)
  assert.ok(people.filter(person => person.paid === 'yes').every(person => person.amount_cents === 3755))
  assert.ok(people.some(person => person.platforms.length > 1))
  assert.equal((await api.events()).length, 2)
})

test('overview distinguishes outreach payments and all registrations', async () => {
  const overview = await createDemoApi(0).overview('eoy-mixer')
  assert.equal(overview.paid_total, 3)
  assert.equal(overview.funnel.paid, 2)
  assert.equal(overview.revenue_cents, 11265)
  assert.equal(overview.funnel.invited, overview.invited.people.length)
  assert.ok(overview.platforms.some(row => row.platform === 'linkedin_connection'))
  assert.ok(overview.platforms.reduce((total, row) => total + row.invited, 0) > overview.funnel.invited)
})

test('search, event, platform, kind, and status filters compose', async () => {
  const api = createDemoApi(0)
  assert.equal((await api.people({ q: 'AMBER', event: 'eoy-mixer', platform: 'linkedin_dm', status: 'paid' })).length, 1)
  assert.equal((await api.people({ event: 'coffee-social' })).length, 6)
  assert.equal((await api.people({ kind: 'partner' })).length, 1)
  assert.equal((await api.people({ status: 'not_contacted' })).length, 2)
  assert.ok((await api.people({ status: 'no_reply' })).every(person => person.replied === 'no'))
  assert.equal((await api.people({ q: 'no such fictional person' })).length, 0)
})

test('edits propagate through detail, people, and overview; APIs are isolated', async () => {
  const api = createDemoApi(0)
  const before = await api.overview('eoy-mixer')
  await api.updatePerson('2', {
    notes: 'Fictional follow-up',
    events: [{ event_key: 'eoy-mixer', paid: 'yes', amount_cents: 3755, signed_up: 'yes', response: 'yes', replied: 'yes' }],
  })
  assert.equal((await api.person('2')).person.notes, 'Fictional follow-up')
  assert.equal((await api.people({ event: 'eoy-mixer', status: 'paid' })).length, 4)
  const after = await api.overview('eoy-mixer')
  assert.equal(after.funnel.paid, before.funnel.paid + 1)
  assert.equal(after.revenue_cents, before.revenue_cents + 3755)
  assert.equal((await createDemoApi(0).overview('eoy-mixer')).paid_total, 3)
  const copy = await api.person('2')
  copy.person.notes = 'Not persisted without a PATCH'
  assert.equal((await api.person('2')).person.notes, 'Fictional follow-up')
})

test('missing demo IDs and events fail predictably', async () => {
  const api = createDemoApi(0)
  await assert.rejects(api.person('not-real'), /could not be found/)
  await assert.rejects(api.overview('not-real'), /could not be found/)
})
