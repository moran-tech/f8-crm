import assert from 'node:assert/strict'
import { test } from 'node:test'
import { barWidth, eventDate, money, percent, safeContactLink } from '../src/utils.ts'

test('contact links reject script URLs and unsafe email header syntax', () => {
  assert.equal(safeContactLink('javascript:alert(1)'), undefined)
  assert.equal(safeContactLink('data:text/html,hi'), undefined)
  assert.equal(safeContactLink('demo@example.invalid'), 'mailto:demo@example.invalid')
  assert.equal(safeContactLink('demo@example.invalid?subject=test'), undefined)
  assert.equal(safeContactLink('https://example.invalid/demo'), 'https://example.invalid/demo')
  assert.equal(safeContactLink('A contact without a link'), undefined)
})

test('formatters handle zero totals, over-counts, CAD, and date-only values', () => {
  assert.equal(percent(0, 0), 0)
  assert.equal(percent(1, 4), 25)
  assert.equal(barWidth(7, 4), 100)
  assert.equal(money(3755), '$37.55')
  assert.match(eventDate('2026-12-05'), /Dec 5/)
  assert.equal(eventDate('not a date'), 'not a date')
})
