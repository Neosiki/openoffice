// @vitest-environment node
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubscriptionStatusMap } from '@genoffice/ai-provider/browser'
import { PDF_CHANNELS } from '../src/shared/ipc'

type Handler = (event: { sender: FakeContents }, ...args: any[]) => any
const handlers = new Map<string, Handler>()
let lastContents: FakeContents
let nextId = 500
class FakeContents {
  id = ++nextId
  once = vi.fn()
  on = vi.fn()
  setWindowOpenHandler = vi.fn()
  loadURL = vi.fn()
  loadFile = vi.fn()
  isDestroyed = () => false
  send = vi.fn()
}
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    whenReady: () => new Promise(() => {}),
    getPath: (name: string) => join('/fake', name),
  },
  dialog: {},
  shell: {},
  BrowserWindow: { fromWebContents: () => null },
  WebContentsView: class {
    webContents = (lastContents = new FakeContents())
  },
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: (channel: string, fn: Handler) => handlers.set(channel, fn),
    removeHandler: vi.fn(),
  },
}))

const generateImageTool = vi.fn()
vi.mock('@genoffice/ai-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@genoffice/ai-search')>()),
  generateImageTool: (...args: unknown[]) => generateImageTool(...args),
}))

const sharedSubscriptionStatuses = vi.fn()
vi.mock('@genoffice/ai-provider/subscription', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@genoffice/ai-provider/subscription')>()),
  sharedSubscriptionStatuses: () => sharedSubscriptionStatuses(),
}))

import { createPdfView } from '../src/main/pdf-main'

const STATUSES: SubscriptionStatusMap = {
  'claude-code': { provider: 'claude-code', state: 'signed-out', meteredAccepted: false },
  codex: {
    provider: 'codex',
    state: 'ready',
    loginMethod: 'subscription',
    meteredAccepted: false,
  },
}

describe('pdf:generate-image handler', () => {
  beforeEach(() => {
    generateImageTool.mockReset()
    sharedSubscriptionStatuses.mockReset()
  })

  it('runs as a screen request with the live subscription statuses', async () => {
    generateImageTool.mockResolvedValue({ url: 'file:///fake/out.png' })
    sharedSubscriptionStatuses.mockReturnValue(STATUSES)
    createPdfView('/docs/report.pdf')
    const result = await handlers.get(PDF_CHANNELS.generateImage)!(
      { sender: lastContents },
      { prompt: 'a red kite', aspectRatio: '16:9' },
    )
    expect(result).toEqual({ url: 'file:///fake/out.png' })
    expect(generateImageTool).toHaveBeenCalledTimes(1)
    const [settingsPath, op, options] = generateImageTool.mock.calls[0]!
    expect(settingsPath).toBe(join('/fake', 'userData', 'ai-settings.json'))
    expect(op).toEqual({ prompt: 'a red kite', aspectRatio: '16:9' })
    expect(options.context).toEqual({ path: 'screen', statuses: STATUSES })
    // no leftover of the removed signed-out message hook
    expect(options).not.toHaveProperty('notLoggedInError')
    expect(Array.isArray(options.mediaRoots)).toBe(true)
  })

  it('reads the statuses at request time, not at registration', async () => {
    generateImageTool.mockResolvedValue({ error: 'unavailable', errorCode: 'unavailable' })
    createPdfView('/docs/report.pdf')
    const call = () =>
      handlers.get(PDF_CHANNELS.generateImage)!({ sender: lastContents }, { prompt: 'x' })

    sharedSubscriptionStatuses.mockReturnValue({})
    expect(await call()).toEqual({ error: 'unavailable', errorCode: 'unavailable' })
    expect(generateImageTool.mock.calls[0]![2].context).toEqual({ path: 'screen', statuses: {} })

    sharedSubscriptionStatuses.mockReturnValue(STATUSES)
    await call()
    expect(generateImageTool.mock.calls[1]![2].context).toEqual({
      path: 'screen',
      statuses: STATUSES,
    })
  })

  it('normalises a malformed request instead of throwing', async () => {
    generateImageTool.mockResolvedValue({ error: 'prompt must not be empty' })
    sharedSubscriptionStatuses.mockReturnValue({})
    createPdfView('/docs/report.pdf')
    await handlers.get(PDF_CHANNELS.generateImage)!({ sender: lastContents }, undefined)
    expect(generateImageTool.mock.calls[0]![1]).toEqual({ prompt: '', aspectRatio: undefined })
  })
})
