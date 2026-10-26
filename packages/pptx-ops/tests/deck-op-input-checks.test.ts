/**
 * Inputs that used to write a deck PowerPoint reports as damaged: a page size
 * outside its 1-56 inch range, and a slide listed twice in the section list.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createBlankPptx, openPptx, type OpenedPptx } from '@genoffice/pptx-engine'
import { runTxn } from '../src/ops/executor'
import '../src/ops/index'

let opened: OpenedPptx

beforeEach(async () => {
  opened = await openPptx(await createBlankPptx())
  const r = runTxn(opened, { ops: [{ op: 'addBlankSlide', target: { slide: 0 } }] })
  expect(r.applied).toBe(true)
  expect(opened.deck.slides).toHaveLength(2)
})

const sections = (...lists: number[][]) => ({
  op: 'setSections',
  sections: lists.map((slideIndices, i) => ({
    id: `{6F1D2B0A-4C3E-4F58-9A21-0D7E5B3C9A1${i}}`,
    name: `Part ${i + 1}`,
    slideIndices,
  })),
})

describe('setSlideSize input checks', () => {
  it.each([
    [10, 10],
    [999_999_999, 999_999_999],
    [12_192_000.5, 6_858_000],
    [914_399, 6_858_000],
  ])('rejects %s x %s', (cx, cy) => {
    const r = runTxn(opened, { ops: [{ op: 'setSlideSize', cx, cy }] })
    expect(r.applied).toBe(false)
    expect(r.failures![0]!.error).toMatch(/whole number of EMU from 914400/)
  })

  it('still accepts the common sizes', () => {
    const r = runTxn(opened, { ops: [{ op: 'setSlideSize', cx: 9_144_000, cy: 6_858_000 }] })
    expect(r.applied).toBe(true)
  })
})

describe('setSections input checks', () => {
  it('rejects a slide listed in two sections', () => {
    const r = runTxn(opened, { ops: [sections([0, 1], [1])] })
    expect(r.applied).toBe(false)
    expect(r.failures![0]!.error).toMatch(/slide 1 is listed in more than one place/)
  })

  it('rejects a slide listed twice in one section', () => {
    const r = runTxn(opened, { ops: [sections([0, 0])] })
    expect(r.applied).toBe(false)
    expect(r.failures![0]!.error).toMatch(/slide 0 is listed in more than one place/)
  })

  it('rejects a slide index the deck does not have', () => {
    const r = runTxn(opened, { ops: [sections([0], [7])] })
    expect(r.applied).toBe(false)
    expect(r.failures![0]!.error).toMatch(/slide index 7 is out of range/)
  })

  it('rejects an index that is not a whole number', () => {
    const r = runTxn(opened, { ops: [sections([0.5])] })
    expect(r.applied).toBe(false)
    expect(r.failures![0]!.error).toMatch(/whole numbers from 0/)
  })

  it('accepts a slide added earlier in the same batch', () => {
    const r = runTxn(opened, {
      ops: [{ op: 'addBlankSlide', target: { slide: 1 } }, sections([0, 1], [2])],
    })
    expect(r.applied).toBe(true)
  })

  it('accepts a section split of the existing slides', () => {
    const r = runTxn(opened, { ops: [sections([0], [1])] })
    expect(r.applied).toBe(true)
  })
})
