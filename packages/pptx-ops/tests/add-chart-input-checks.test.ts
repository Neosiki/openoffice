/**
 * addChart used to accept data the chart builder drops without a word: text
 * values, a short value list and an unknown kind (drawn as columns) all gave a
 * chart that quietly lacked data, and a non-text label threw a TypeError.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createBlankPptx, openPptx, type OpenedPptx } from '@genoffice/pptx-engine'
import { runTxn } from '../src/ops/executor'
import '../src/ops/index'

let opened: OpenedPptx

beforeEach(async () => {
  opened = await openPptx(await createBlankPptx())
})

const chart = (over: Record<string, unknown>) => ({
  op: 'addChart',
  target: { slide: 0 },
  kind: 'bar',
  categories: ['Q1', 'Q2'],
  series: [{ name: 'Revenue', values: [120, 135] }],
  offset: { x: 914400, y: 914400, cx: 5000000, cy: 3000000 },
  ...over,
})

const failure = (over: Record<string, unknown>): string => {
  const r = runTxn(opened, { ops: [chart(over)] })
  expect(r.applied).toBe(false)
  return r.failures![0]!.error
}

describe('addChart input checks', () => {
  it('rejects an unknown kind instead of drawing columns', () => {
    expect(failure({ kind: 'sparkle' })).toMatch(/unknown "kind" "sparkle"; use one of bar, /)
  })

  it('rejects a value that is neither a number nor null', () => {
    expect(failure({ series: [{ name: 'Revenue', values: [120, '135'] }] })).toMatch(
      /series\[0\]\.values\[1\] must be a number or null for a gap, got "135"/,
    )
  })

  it('rejects fewer or more values than categories', () => {
    expect(failure({ series: [{ name: 'Revenue', values: [120] }] })).toMatch(
      /series\[0\] has 1 values for 2 categories/,
    )
    expect(failure({ series: [{ name: 'Revenue', values: [1, 2, 3] }] })).toMatch(
      /series\[0\] has 3 values for 2 categories/,
    )
  })

  it('rejects a category that is not text and a series without a name', () => {
    expect(failure({ categories: [2023, 2024] })).toMatch(/categories\[0\] must be text/)
    expect(failure({ series: [{ values: [1, 2] }] })).toMatch(/series\[0\] needs "name"/)
  })

  it('still accepts a gap, a stacked kind and a scatter chart', () => {
    for (const over of [
      { series: [{ name: 'Revenue', values: [120, null] }] },
      { kind: 'barStacked' },
      { kind: 'scatter', categories: ['1', '2'] },
    ]) {
      expect(runTxn(opened, { ops: [chart(over)] }).applied).toBe(true)
    }
  })
})
