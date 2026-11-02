import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { replaceHashRoute, watchHashRoute } from '../src/hashRoute.ts'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalHashChangeEvent = Object.getOwnPropertyDescriptor(globalThis, 'HashChangeEvent')
afterEach(() => {
  for (const [key, descriptor] of [['window', originalWindow], ['HashChangeEvent', originalHashChangeEvent]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

function browser() {
  const entries = [{ hash: '#/overview', state: { unrelated: true } as Record<string, unknown> | null }]
  let position = 0
  let allowed = true
  let prompts = 0
  const changes: string[] = []
  const target = new EventTarget()
  const notify = () => {
    target.dispatchEvent(new Event('popstate'))
    target.dispatchEvent(new Event('hashchange'))
  }
  const history = {
    get state() { return entries[position]!.state },
    replaceState(state: Record<string, unknown>, _unused: string, url?: string) {
      entries[position] = { hash: url ? new URL(url, 'https://example.test').hash : entries[position]!.hash, state }
    },
    go(delta: number) {
      assert.notEqual(delta, 0, 'Cancelling navigation must not reload the document')
      const next = position + delta
      assert.ok(next >= 0 && next < entries.length)
      queueMicrotask(() => { position = next; notify() })
    },
  }
  const fakeWindow = Object.assign(target, {
    history,
    location: { get hash() { return entries[position]!.hash }, pathname: '/f8-crm/', search: '?demo=1' },
  })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  Object.defineProperty(globalThis, 'HashChangeEvent', { configurable: true, value: Event })
  const stop = watchHashRoute(() => { prompts++; return allowed }, hash => changes.push(hash))
  return {
    entries, changes, history, stop,
    get hash() { return entries[position]!.hash },
    get position() { return position },
    get prompts() { return prompts },
    allow(value: boolean) { allowed = value },
    push(hash: string) {
      entries.splice(position + 1, entries.length, { hash, state: null })
      position++
      notify()
    },
    async go(delta: number) { history.go(delta); await new Promise<void>(done => setImmediate(done)) },
    async settle() { await new Promise<void>(done => setImmediate(done)) },
  }
}

test('cancelled browser Back restores its position without rewriting or duplicating entries', async () => {
  const page = browser()
  page.push('#/sponsors')
  page.push('#/sponsors/demo-sponsor-1')
  page.allow(false)
  await page.go(-1)
  assert.equal(page.hash, '#/sponsors/demo-sponsor-1')
  assert.equal(page.position, 2)
  assert.deepEqual(page.entries.map(entry => entry.hash), ['#/overview', '#/sponsors', '#/sponsors/demo-sponsor-1'])
  assert.equal(page.prompts, 3)
  await page.go(-1)
  assert.equal(page.prompts, 4)
  assert.equal(page.position, 2)
  page.allow(true)
  await page.go(-1)
  assert.equal(page.hash, '#/sponsors')
  await page.go(-1)
  assert.equal(page.hash, '#/overview')
  assert.equal(page.history.state?.unrelated, true)
})

test('cancelled forward and multi-entry traversals restore the original position', async () => {
  const page = browser()
  page.push('#/sponsors')
  page.push('#/sponsors/demo-sponsor-1')
  page.allow(false)
  await page.go(-2)
  assert.equal(page.position, 2)
  page.allow(true)
  await page.go(-1)
  page.allow(false)
  await page.go(1)
  assert.equal(page.hash, '#/sponsors')
  assert.equal(page.position, 1)
  assert.equal(page.entries[2]!.hash, '#/sponsors/demo-sponsor-1')
})

test('in-app Back still confirms, keeps edits on cancel, and navigates on accept', async () => {
  const page = browser()
  page.push('#/sponsors/demo-sponsor-1')
  page.allow(false)
  page.push('#/sponsors')
  await page.settle()
  assert.equal(page.hash, '#/sponsors/demo-sponsor-1')
  assert.equal(page.position, 1)
  assert.equal(page.prompts, 2)
  page.allow(true)
  page.push('#/sponsors')
  assert.equal(page.hash, '#/sponsors')
  assert.equal(page.prompts, 3)
  assert.deepEqual(page.changes, ['#/sponsors/demo-sponsor-1', '#/sponsors'])
})

test('replacing a submitted form preserves history indexes and Back skips the form', async () => {
  const page = browser()
  page.push('#/sponsors')
  page.push('#/sponsors/new')
  replaceHashRoute('#/sponsors/demo-sponsor-16')
  assert.equal(page.entries.length, 3)
  assert.equal(page.hash, '#/sponsors/demo-sponsor-16')
  page.allow(false)
  await page.go(-1)
  assert.equal(page.position, 2)
  page.allow(true)
  await page.go(-1)
  assert.equal(page.hash, '#/sponsors')
  page.stop()
  page.push('#/people')
  assert.equal(page.changes.at(-1), '#/sponsors')
})
