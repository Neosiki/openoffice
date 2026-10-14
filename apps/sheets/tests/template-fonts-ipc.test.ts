// sheets:template-font-data hands a sheets tab the bytes of one bundled font file
// from the installed folder: only to a registered tab, only for a bundled file.
// Electron, the sidecar and the subscription status check are mocked.
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../src/shared/ipc-channels'

type Handler = (event: { sender: FakeContents }, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
let lastContents: FakeContents
let nextId = 900
class FakeContents extends EventEmitter {
  id = ++nextId
  isDestroyed = () => false
  setWindowOpenHandler = vi.fn()
  loadURL = vi.fn()
  send = vi.fn()
}

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    getName: () => 'sheets-test',
    getVersion: () => '0',
    getAppPath: () => resolve(import.meta.dirname, '..'),
    isPackaged: false,
    on: () => {},
    once: () => {},
    whenReady: () => new Promise(() => {}),
  },
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: () => {},
    removeHandler: () => {},
  },
  BrowserWindow: class {},
  Menu: { buildFromTemplate: () => ({}), setApplicationMenu: () => {} },
  WebContentsView: class {
    webContents = (lastContents = new FakeContents())
  },
  desktopCapturer: {},
  dialog: {},
  net: {},
  screen: {},
  session: {},
  shell: {},
  systemPreferences: {},
  webContents: { getAllWebContents: () => [], fromId: () => null },
}))

vi.mock('../src/main/xlsx-sidecar-client', () => ({
  XlsxSidecarClient: class {
    start(): void {}
    onProcessExit(): void {}
  },
}))

vi.mock('@genoffice/ai-provider/subscription', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@genoffice/ai-provider/subscription')>()),
  ensureSubscriptionIpc: () => ({}),
  sharedSubscriptionStatuses: () => ({}),
}))

import { createSheetsView } from '../src/main/sheets-main'

const FOLDER = resolve(import.meta.dirname, '../../../packages/ui/template-fonts')

function fontData(sender: FakeContents, file: unknown) {
  return handlers.get(IPC_CHANNELS.templateFontData)!({ sender }, file)
}

describe('sheets:template-font-data', () => {
  it('hands a sheets tab the bundled file bytes, also for the shell-hosted view', async () => {
    // the shell builds its sheets views without the standalone AI handlers
    createSheetsView({ includeAiHandlers: false })
    const bytes = (await fontData(lastContents, 'Pretendard-SemiBold.otf')) as Buffer
    expect(bytes.equals(readFileSync(join(FOLDER, 'Pretendard-SemiBold.otf')))).toBe(true)
  })

  it('refuses a sender that is not a sheets tab', () => {
    expect(() => fontData(new FakeContents(), 'Pretendard-Regular.otf')).toThrow(
      'Untrusted IPC sender.',
    )
  })

  it('refuses a name outside the bundled files', async () => {
    createSheetsView({ includeAiHandlers: false })
    await expect(fontData(lastContents, '../../../package.json')).rejects.toThrow()
    await expect(fontData(lastContents, 'Pretendard-OFL.txt')).rejects.toThrow()
    await expect(Promise.resolve().then(() => fontData(lastContents, 42))).rejects.toThrow()
  })
})
