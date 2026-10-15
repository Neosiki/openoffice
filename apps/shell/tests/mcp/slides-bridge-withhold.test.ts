/**
 * The slides bridge's readout for agent sessions (decision 0032): withheld runs
 * and withheld elements read as their `{{label}}`, the outside MCP readout is
 * unchanged, and a deck that withholds anything says so.
 */
import { describe, expect, it, vi } from 'vitest'

const sessions = new Map<number, unknown>()

vi.mock('electron', () => ({ webContents: { fromId: () => null } }))
vi.mock('../../../slides/src/main/slides-main', () => ({
  applySessionTxn: vi.fn(),
  saveSessionDeckTo: vi.fn(),
}))
vi.mock('../../../slides/src/main/session-state', () => ({
  sessions,
  attachedIds: () => [],
}))

const { createSlidesControl, elementWithholds } = await import('../../src/main/mcp/slides-bridge')

const box = { offset: { x: 0, y: 0, cx: 100, cy: 100 } }
const para = (...runs: Array<{ text: string; redact?: string }>) => ({ runs })

function deck(elements: unknown[]) {
  return {
    opened: {
      deck: {
        size: { cx: 12192000, cy: 6858000 },
        slides: [{ id: 's1', path: 'ppt/slides/slide1.xml', elements }],
      },
    },
  }
}

const withheldRun = {
  id: 'e1',
  type: 'text',
  transform: box,
  text: { paragraphs: [para({ text: 'Salary: ' }, { text: '5,000', redact: 'pay' })] },
}
const withheldShape = {
  id: 'e2',
  type: 'shape',
  redact: 'secret box',
  transform: box,
  text: { paragraphs: [para({ text: 'hidden words' })] },
}
const table = {
  id: 'e3',
  type: 'table',
  transform: box,
  rows: [
    [
      { text: { paragraphs: [para({ text: 'Name' })] } },
      { text: { paragraphs: [para({ text: 'Kim', redact: 'person' })] } },
    ],
  ],
}
const plain = {
  id: 'e4',
  type: 'text',
  transform: box,
  text: { paragraphs: [para({ text: 'Hello' })] },
}

const control = createSlidesControl({ openBlankTab: () => 1 })

function texts(readout: unknown): unknown[] {
  return (
    readout as { slides: Array<{ elements: Array<{ text?: unknown }> }> }
  ).slides[0]!.elements.map((el) => el.text)
}

describe('the withholding readout', () => {
  it('reads withheld runs, elements and table cells as their labels', async () => {
    sessions.set(7, deck([withheldRun, withheldShape, table, plain]))
    const readout = await control.readDeck(7, { withhold: true })
    expect(texts(readout)).toEqual([
      'Salary: {{pay}}',
      '{{secret box}}',
      'Name | {{person}}',
      'Hello',
    ])
    expect(JSON.stringify(readout)).not.toContain('5,000')
    expect(JSON.stringify(readout)).not.toContain('hidden words')
    expect(JSON.stringify(readout)).not.toContain('Kim')
  })

  it('leaves the outside readout as it was', async () => {
    sessions.set(8, deck([withheldRun, plain]))
    expect(texts(await control.readDeck(8))).toEqual(['Salary: 5,000', 'Hello'])
  })

  it('tells whether a deck withholds anything', async () => {
    sessions.set(9, deck([plain]))
    sessions.set(10, deck([plain, table]))
    expect(await control.deckWithholds!(9)).toBe(false)
    expect(await control.deckWithholds!(10)).toBe(true)
    expect(
      elementWithholds({
        id: 'g',
        type: 'group',
        transform: box,
        children: [withheldShape],
      } as never),
    ).toBe(true)
  })
})
