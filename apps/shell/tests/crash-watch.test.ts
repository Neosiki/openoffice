import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Crash watch (src/main/crash-watch.ts): what gets recorded, and when the user
 * is told that an open document's renderer died. Electron's app is an event
 * emitter here; the message box answers the first button.
 */

const userData = mkdtempSync(join(tmpdir(), 'crash-watch-'))
const { fakeApp, showMessageBox } = vi.hoisted(() => ({
  fakeApp: {} as EventEmitter & { getPath: (name: string) => string },
  showMessageBox: vi.fn(async () => ({ response: 0, checkboxChecked: false })),
}))

vi.mock('electron', async () => {
  const { EventEmitter: Emitter } = await import('node:events')
  Object.setPrototypeOf(fakeApp, Emitter.prototype)
  Emitter.call(fakeApp)
  fakeApp.getPath = () => userData
  return { app: fakeApp, dialog: { showMessageBox } }
})

vi.mock('../src/main/renderer-disposal', () => ({
  wasReleasedRenderer: (id: number) => id === 99,
}))

import { shouldPromptForGoneRenderer, startCrashWatch } from '../src/main/crash-watch'
import type { CrashedDocument } from '../src/main/crash-watch'

const docs = new Map<number, CrashedDocument>()
const closeDocument = vi.fn(() => true)
const reopen = vi.fn()

startCrashWatch({
  prompt: true,
  editorOf: (wc) => docs.get(wc.id)?.kind ?? 'other',
  documentOf: (wc) => docs.get(wc.id) ?? null,
  parentWindow: () => null,
  closeDocument,
  reopen,
  t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
})

const logFile = join(userData, 'crash-log.jsonl')
const lines = () =>
  existsSync(logFile)
    ? readFileSync(logFile, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
    : []

function fakeWc(id: number) {
  return { id, isDestroyed: () => false, reload: vi.fn() }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  rmSync(logFile, { force: true })
  docs.clear()
  vi.clearAllMocks()
})

afterAll(() => rmSync(userData, { recursive: true, force: true }))

describe('crash watch', () => {
  it('records a crashed document renderer with its editor, and offers to reopen it', async () => {
    const wc = fakeWc(1)
    docs.set(1, { kind: 'docs', title: 'plan.docx', filePath: 'C:\\Users\\me\\plan.docx' })
    fakeApp.emit('render-process-gone', {}, wc, { reason: 'oom', exitCode: -536870904 })
    await flush()
    expect(lines()).toEqual([
      expect.objectContaining({
        kind: 'renderer',
        reason: 'oom',
        exitCode: -536870904,
        editor: 'docs',
      }),
    ])
    // the title is shown to the user, but never written to the log
    expect(readFileSync(logFile, 'utf8')).not.toContain('plan')
    expect(showMessageBox).toHaveBeenCalledTimes(1)
    expect(closeDocument).toHaveBeenCalledWith(wc)
    expect(reopen).toHaveBeenCalledWith('C:\\Users\\me\\plan.docx')
  })

  it('reloads a slides renderer (the deck lives in the main process)', async () => {
    const wc = fakeWc(2)
    docs.set(2, { kind: 'slides', title: 'deck.pptx', filePath: 'C:\\deck.pptx' })
    fakeApp.emit('render-process-gone', {}, wc, { reason: 'crashed', exitCode: 2 })
    await flush()
    expect(wc.reload).toHaveBeenCalledTimes(1)
    expect(closeDocument).not.toHaveBeenCalled()
  })

  it('only closes an untitled document', async () => {
    const wc = fakeWc(3)
    docs.set(3, { kind: 'markdown', title: 'Untitled' })
    fakeApp.emit('render-process-gone', {}, wc, { reason: 'crashed', exitCode: 2 })
    await flush()
    expect(closeDocument).toHaveBeenCalledWith(wc)
    expect(reopen).not.toHaveBeenCalled()
  })

  it('records but does not prompt for Home or for a renderer the app killed', async () => {
    fakeApp.emit('render-process-gone', {}, fakeWc(4), { reason: 'crashed', exitCode: 2 })
    docs.set(5, { kind: 'slides', title: 'deck.pptx' })
    fakeApp.emit('render-process-gone', {}, fakeWc(5), { reason: 'killed', exitCode: 1 })
    await flush()
    expect(lines().map((l) => l.reason)).toEqual(['crashed', 'killed'])
    expect(showMessageBox).not.toHaveBeenCalled()
  })

  it('ignores clean exits and the closed tabs the shell ended itself', async () => {
    docs.set(6, { kind: 'docs', title: 'a.docx' })
    fakeApp.emit('render-process-gone', {}, fakeWc(6), { reason: 'clean-exit', exitCode: 0 })
    fakeApp.emit('render-process-gone', {}, fakeWc(99), { reason: 'killed', exitCode: 1 })
    await flush()
    expect(lines()).toEqual([])
    expect(showMessageBox).not.toHaveBeenCalled()
  })

  it('records a GPU process crash, but not the utility processes the app ends', () => {
    fakeApp.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed', exitCode: 3 })
    fakeApp.emit('child-process-gone', {}, { type: 'Utility', reason: 'killed', exitCode: 1 })
    fakeApp.emit('child-process-gone', {}, { type: 'Utility', reason: 'clean-exit', exitCode: 0 })
    expect(lines()).toEqual([
      expect.objectContaining({ kind: 'child-process', process: 'GPU', reason: 'crashed' }),
    ])
  })

  it('records an unhandled rejection by its class only', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.emit(
      'unhandledRejection',
      new RangeError('C:\\Users\\me\\secret.docx'),
      Promise.resolve(),
    )
    expect(lines()).toEqual([
      expect.objectContaining({ kind: 'main-rejection', reason: 'RangeError' }),
    ])
    expect(readFileSync(logFile, 'utf8')).not.toContain('secret')
    warn.mockRestore()
  })

  it('prompts for real failures only', () => {
    expect(shouldPromptForGoneRenderer('crashed')).toBe(true)
    expect(shouldPromptForGoneRenderer('oom')).toBe(true)
    expect(shouldPromptForGoneRenderer('killed')).toBe(false)
    expect(shouldPromptForGoneRenderer('clean-exit')).toBe(false)
  })
})
