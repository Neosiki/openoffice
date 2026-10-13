import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

type IpcHandler = (event: { sender: { id: number } }, ...args: unknown[]) => unknown

const handlers = new Map<string, IpcHandler>()
const generateImageTool = vi.fn(async (..._args: unknown[]) => ({ url: 'file:///generated.png' }))
const statuses = {
  'claude-code': { provider: 'claude-code', state: 'ready', meteredAccepted: false },
  codex: { provider: 'codex', state: 'ready', meteredAccepted: false },
}

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => tmpdir()),
    on: vi.fn(),
    quit: vi.fn(),
    whenReady: vi.fn(() => new Promise(() => {})),
  },
  BrowserWindow: class {
    static fromWebContents() {
      return null
    }
    static getFocusedWindow() {
      return null
    }
  },
  dialog: { showMessageBox: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => handlers.set(channel, handler)),
    on: vi.fn((channel: string, handler: IpcHandler) => handlers.set(channel, handler)),
    removeHandler: vi.fn(),
  },
  net: { fetch: vi.fn() },
  protocol: { handle: vi.fn() },
  shell: { openExternal: vi.fn() },
  WebContentsView: class {
    webContents = {
      id: 1,
      isDestroyed: vi.fn(() => false),
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      once: vi.fn(),
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    }
  },
}))

vi.mock('@genoffice/electron-utils', () => ({
  configuredDefaultSaveDir: vi.fn(() => tmpdir()),
  contextMenuLabels: vi.fn(() => ({})),
  installContextMenu: vi.fn(),
  installNavigationGuard: vi.fn(),
  rendererUrl: vi.fn(() => 'genoffice-app://markdown/index.html'),
  safeExternalUrl: vi.fn(() => null),
  showOpenDialogWithMemory: vi.fn(),
  showSaveDialogWithMemory: vi.fn(),
}))

vi.mock('@genoffice/ai-search', () => ({
  generateImageTool: (...args: unknown[]) => generateImageTool(...args),
  documentMediaRoots: vi.fn(() => ['/doc-dir']),
}))

// the process-wide statuses of the subscription service (registered by the docs main in the shell)
vi.mock('@genoffice/ai-provider/subscription', () => ({
  sharedSubscriptionStatuses: vi.fn(() => statuses),
}))

import { createMarkdownView } from '../src/main/markdown-main'
import { MARKDOWN_CHANNELS } from '../src/shared/ipc'

describe('markdown:ai-generate-image', () => {
  it('calls the image tool on the screen path with the live subscription statuses', async () => {
    const view = createMarkdownView(null)
    const handler = handlers.get(MARKDOWN_CHANNELS.aiGenerateImage)
    expect(handler).toBeDefined()

    const result = await handler!(
      { sender: view.webContents as never },
      { prompt: 'a lighthouse at dusk', aspectRatio: '16:9' },
    )

    expect(result).toEqual({ url: 'file:///generated.png' })
    expect(generateImageTool).toHaveBeenCalledTimes(1)
    const [settingsPath, op, options] = generateImageTool.mock.calls[0]!
    expect(settingsPath).toBe(join(tmpdir(), 'ai-settings.json'))
    expect(op).toEqual({ prompt: 'a lighthouse at dusk', aspectRatio: '16:9' })
    expect(options).toEqual({
      mediaRoots: ['/doc-dir'],
      context: { path: 'screen', statuses },
    })
    // no login gate of a removed provider is passed along any more
    expect(options).not.toHaveProperty('notLoggedInError')
  })
})
