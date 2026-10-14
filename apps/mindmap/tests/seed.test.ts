// @vitest-environment node
/**
 * A new map tab that starts with given content (spec 8.6, "convert without
 * AI": markdown read as an outline, 4.9). The main side hands it to its own
 * tab once; the renderer side builds an untitled map from it with the
 * engine's reader, unsaved until written, with body paragraphs as the note of
 * the topic above.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (...args: never[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: never[]) => unknown) => handlers.set(channel, fn),
  },
}))

import { noteText } from '@genoffice/xmind-engine'
import { MINDMAP_CHANNELS } from '../src/shared/ipc'
import { queueMindmapSeedFor, registerMindmapSeedIpc } from '../src/main/seed-main'
import { seededMap } from '../src/renderer/document/open'

class FakeContents {
  destroyed = false
  private onDestroyed: (() => void) | null = null
  constructor(readonly id: number) {}
  isDestroyed(): boolean {
    return this.destroyed
  }
  once(_event: 'destroyed', listener: () => void): void {
    this.onDestroyed = listener
  }
  destroy(): void {
    this.destroyed = true
    this.onDestroyed?.()
  }
}

const fileViews = new Set<number>()
const take = (id: number) =>
  (
    handlers.get(MINDMAP_CHANNELS.seedTake) as unknown as (e: { sender: { id: number } }) => unknown
  )({ sender: { id } })

beforeEach(() => {
  handlers.clear()
  fileViews.clear()
  registerMindmapSeedIpc({ opensFile: (id) => fileViews.has(id) })
})

describe('mindmap:seed-take', () => {
  it('hands the content to its own tab once; a reload or another tab takes nothing', () => {
    const tab = new FakeContents(7)
    queueMindmapSeedFor(tab, { outline: '# Lesson\n\n- A\n' })
    expect(take(8)).toBeNull()
    expect(take(7)).toEqual({ outline: '# Lesson\n\n- A\n' })
    expect(take(7)).toBeNull()
  })

  it('never hands content to a view made for a file, and drops it with a closed tab', () => {
    const fileTab = new FakeContents(9)
    queueMindmapSeedFor(fileTab, { outline: 'x' })
    fileViews.add(9)
    expect(take(9)).toBeNull()
    const closed = new FakeContents(10)
    queueMindmapSeedFor(closed, { outline: 'x' })
    closed.destroy()
    expect(take(10)).toBeNull()
  })
})

describe('the seeded map', () => {
  it('reads the outline into an unsaved map, body paragraphs as notes', async () => {
    const session = await seededMap(
      {
        outline: [
          '# Lesson',
          '',
          '## Warm-up',
          '',
          'A paragraph about it.',
          '',
          '- Question {{Name}}',
          '',
        ].join('\n'),
      },
      'Untitled',
    )
    expect(session.dirty).toBe(true)
    const [tab] = session.tabs()
    expect(tab!.title).toBe('Lesson')
    // the single outermost topic is the central topic (4.9)
    const warmUp = session.sheet(tab!.key).rootTopic
    expect(warmUp.title).toBe('Warm-up')
    expect(noteText(warmUp.notes)).toContain('A paragraph about it.')
    expect(warmUp.children!.attached![0]!.title).toBe('Question {{Name}}')
  })

  it('names a sheet without a heading with the untitled text', async () => {
    const session = await seededMap({ outline: '- one\n- two\n' }, 'Sans titre')
    const [tab] = session.tabs()
    expect(tab!.title).toBe('Sans titre')
    expect(session.sheet(tab!.key).rootTopic.title).toBe('Sans titre')
  })
})
