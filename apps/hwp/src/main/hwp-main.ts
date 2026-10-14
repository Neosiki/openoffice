import { existsSync } from 'node:fs'
import { copyFile, readFile, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { BrowserWindow, WebContentsView, app, dialog, ipcMain, shell } from 'electron'
import type { WebContents } from 'electron'
import {
  contextMenuLabels,
  installContextMenu,
  installNavigationGuard,
  installRendererProtocol,
  registerRendererScheme,
  rendererUrl,
  safeExternalUrl,
  showSaveDialogWithMemory,
} from '@genoffice/electron-utils'
import { hwpToText } from '@genoffice/file-parse'
import { getUiLang } from '@genoffice/i18n'
import { registerHwpAttachmentIpc } from './attachments-ipc'
import { atomicWriteFile } from './atomic-write'
import { tm } from './dialog-strings'
import { backupPathFor, bytesMatchFormat, needsBackup, withFormatExtension } from './save-plan'
import { HWP_CHANNELS, MAX_HWP_SAVE_BYTES, hwpFormatOfPath } from '../shared/ipc'
import type { BeginSaveResult, CommitSaveResult, HwpFormat, SaveMode } from '../shared/ipc'

interface RuntimePaths {
  preloadPath: string
  rendererUrl?: string
  rendererFile?: string
}

let runtime: RuntimePaths = { preloadPath: '' }

export function configureHwpRuntime(paths: RuntimePaths): void {
  runtime = paths
}

/** Open path per view, queued at tab creation; the renderer consumes it after mount.
 * Kept until the view is destroyed so a reload consumes it again. */
const openPathByWc = new Map<number, string>()
/** File paths granted to each view; readFile only allows these */
const allowedByWc = new Map<number, Set<string>>()
/** Current save target per view */
const savePathByWc = new Map<number, string>()
/** Unsaved-changes flags mirrored from the renderer; drives the save prompt before closing a tab/window */
const dirtyByWc = new Set<number>()
const closeSaveWaiters = new Map<number, (ok: boolean) => void>()
/** Resolvers for menu- and shortcut-triggered saves, settled when the renderer's save ends */
const saveWaiters = new Map<number, (ok: boolean) => void>()
const readBytesWaiters = new Map<number, (result: unknown) => void>()
const readTextInFlight = new Map<number, Promise<string>>()
/** Target a view resolved with beginSave and has not committed yet */
const pendingSaveByWc = new Map<number, { path: string; format: HwpFormat }>()
/** Paths each view has already written this session; their first overwrite kept a backup */
const writtenByWc = new Map<number, Set<string>>()

/** Fired after a save lands on a NEW path (Save As); the shell syncs tab title, recents, projects */
let fileSavedHook: ((wc: WebContents, path: string) => void) | null = null

export function setHwpFileSavedHook(hook: (wc: WebContents, path: string) => void): void {
  fileSavedHook = hook
}

export function hwpIsDirty(webContentsId: number): boolean {
  return dirtyByWc.has(webContentsId)
}

/** The file was renamed on disk: follow it, so the next save lands on the new name */
export function hwpFileRenamed(contents: WebContents, oldPath: string, newPath: string): void {
  const wcId = contents.id
  if (savePathByWc.get(wcId) === oldPath) savePathByWc.set(wcId, newPath)
  if (openPathByWc.get(wcId) === oldPath) openPathByWc.set(wcId, newPath)
  const allowed = allowedByWc.get(wcId)
  if (allowed?.has(oldPath)) allowed.add(newPath)
}

/**
 * Close guard: true means proceed with closing. Clean → true; dirty →
 * Save / Don't Save / Cancel. On Save, ask the renderer to export + write
 * and await the result; a canceled or failed save keeps the tab open.
 */
export async function requestHwpClose(
  contents: WebContents,
  parent?: BrowserWindow | null,
): Promise<boolean> {
  if (!dirtyByWc.has(contents.id) || contents.isDestroyed()) return true
  const options = {
    type: 'warning' as const,
    message: tm('closeUnsavedMsg'),
    detail: tm('closeUnsavedDetail'),
    buttons: [tm('btnSave'), tm('btnDontSave'), tm('btnCancel')],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  }
  const { response } =
    parent && !parent.isDestroyed()
      ? await dialog.showMessageBox(parent, options)
      : await dialog.showMessageBox(options)
  if (response === 2) return false
  if (response === 1) return true
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      closeSaveWaiters.delete(contents.id)
      resolve(false)
    }, 120_000)
    closeSaveWaiters.set(contents.id, (ok) => {
      clearTimeout(timer)
      resolve(ok)
    })
    contents.send(HWP_CHANNELS.closeSaveRequest)
  })
}

/**
 * Menu / shortcut Save and Save As: ask the renderer to export and save.
 * Resolves true only when bytes were written. The request always goes to the
 * renderer, even when the mirrored dirty flag says clean: that flag can lag a
 * keystroke behind, and Ctrl+S right after typing must still save. The
 * renderer asks the editor itself and declines a save with nothing to write.
 */
export function requestHwpSave(contents: WebContents, mode: SaveMode): Promise<boolean> {
  if (contents.isDestroyed()) return Promise.resolve(false)
  // one save at a time per view: a request arriving while one is in flight is declined
  if (saveWaiters.has(contents.id)) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      saveWaiters.delete(contents.id)
      resolve(false)
    }, 120_000)
    saveWaiters.set(contents.id, (ok) => {
      clearTimeout(timer)
      resolve(ok)
    })
    contents.send(HWP_CHANNELS.saveRequest, mode)
  })
}

/** How long a live read may take; a large document exports in well under this. */
const READ_TEXT_TIMEOUT_MS = 30_000
/** How often the request is sent again while the renderer has not answered. */
const READ_TEXT_RETRY_MS = 250

/**
 * The text of the document as it is in the editor now, unsaved edits included
 * (for the MCP tool that reads open documents). The renderer exports the
 * document's bytes and the shared reader turns them into text, so an open
 * document reads the same as one read from disk.
 *
 * One read per view at a time: a second caller shares the first one's answer.
 * The request is re-sent until the renderer answers, because its listener is
 * registered while it mounts and a request sent before that is dropped.
 */
export function hwpReadText(contents: WebContents): Promise<string> {
  if (contents.isDestroyed()) return Promise.reject(new Error('the document is no longer open'))
  const wcId = contents.id
  const inFlight = readTextInFlight.get(wcId)
  if (inFlight) return inFlight
  const request = new Promise<string>((resolve, reject) => {
    let settled = false
    const settle = (finish: () => void): void => {
      if (settled) return
      settled = true
      clearInterval(retry)
      clearTimeout(timer)
      readBytesWaiters.delete(wcId)
      readTextInFlight.delete(wcId)
      finish()
    }
    const retry = setInterval(() => {
      if (contents.isDestroyed()) {
        settle(() => reject(new Error('the document is no longer open')))
        return
      }
      if (!answered) contents.send(HWP_CHANNELS.readBytesRequest)
    }, READ_TEXT_RETRY_MS)
    const timer = setTimeout(
      () => settle(() => reject(new Error('timed out reading the document'))),
      READ_TEXT_TIMEOUT_MS,
    )
    // the first answer is the one that counts: re-sent requests may produce more
    let answered = false
    readBytesWaiters.set(wcId, (result) => {
      if (answered) return
      answered = true
      const raw = (result ?? {}) as { ok?: unknown; bytes?: unknown; error?: unknown }
      if (raw.ok !== true || !(raw.bytes instanceof Uint8Array)) {
        const error = typeof raw.error === 'string' ? raw.error : 'the editor returned no document'
        settle(() => reject(new Error(error)))
        return
      }
      hwpToText(raw.bytes).then(
        (text) => settle(() => resolve(text)),
        (error: unknown) =>
          settle(() => reject(error instanceof Error ? error : new Error(String(error)))),
      )
    })
    contents.send(HWP_CHANNELS.readBytesRequest)
  })
  readTextInFlight.set(wcId, request)
  return request
}

function settleSave(wcId: number, ok: boolean): void {
  const waiter = saveWaiters.get(wcId)
  saveWaiters.delete(wcId)
  waiter?.(ok)
}

let ipcRegistered = false

function registerHwpIpc(): void {
  registerHwpAttachmentIpc()
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.handle(HWP_CHANNELS.consumePending, (e) => openPathByWc.get(e.sender.id) ?? null)

  ipcMain.handle(HWP_CHANNELS.readFile, async (e, path: unknown) => {
    if (typeof path !== 'string' || !allowedByWc.get(e.sender.id)?.has(path)) {
      throw new Error('hwp: path not granted to this view')
    }
    const info = await stat(path)
    if (info.size > MAX_HWP_SAVE_BYTES) throw new Error('hwp: file is too large to open')
    return await readFile(path)
  })

  ipcMain.handle(HWP_CHANNELS.beginSave, async (e, mode: unknown): Promise<BeginSaveResult> => {
    const wcId = e.sender.id
    pendingSaveByWc.delete(wcId)
    try {
      const current = savePathByWc.get(wcId)
      const currentFormat = current ? hwpFormatOfPath(current) : null
      let target: string
      if (mode !== 'saveAs' && current && currentFormat) {
        target = current
      } else {
        const win =
          BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getFocusedWindow() ?? undefined
        const fallback: HwpFormat = currentFormat ?? 'hwp'
        const picked = await showSaveDialogWithMemory(dialog, win, {
          title: tm('dlgSaveTitle'),
          ...(current ? { defaultPath: join(dirname(current), basename(current)) } : {}),
          // the document's own format first, so it is the dialog's default type
          filters: [
            {
              name: tm('filterHwp'),
              extensions: fallback === 'hwpx' ? ['hwpx', 'hwp'] : ['hwp', 'hwpx'],
            },
          ],
        })
        if (picked.canceled || !picked.filePath) {
          settleSave(wcId, false)
          return { ok: true, canceled: true }
        }
        target = withFormatExtension(picked.filePath, fallback)
      }
      const format = hwpFormatOfPath(target)
      if (!format) throw new Error('hwp: no save format for this file name')
      pendingSaveByWc.set(wcId, { path: target, format })
      return { ok: true, path: target, format }
    } catch (err) {
      settleSave(wcId, false)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(HWP_CHANNELS.commitSave, async (e, data: unknown): Promise<CommitSaveResult> => {
    const wcId = e.sender.id
    const pending = pendingSaveByWc.get(wcId)
    pendingSaveByWc.delete(wcId)
    const done = (result: CommitSaveResult): CommitSaveResult => {
      settleSave(wcId, result.ok)
      return result
    }
    if (!pending) return done({ ok: false, error: 'hwp: no save in progress' })
    if (!(data instanceof Uint8Array) || data.length === 0 || data.length > MAX_HWP_SAVE_BYTES) {
      return done({ ok: false, error: 'hwp: bad save request' })
    }
    if (!bytesMatchFormat(data, pending.format)) {
      return done({ ok: false, error: `hwp: exported bytes are not a ${pending.format} file` })
    }
    try {
      const target = pending.path
      const written = writtenByWc.get(wcId) ?? new Set<string>()
      let backupPath: string | undefined
      if (needsBackup(target, existsSync(target), written)) {
        backupPath = backupPathFor(target)
        await copyFile(target, backupPath)
      }
      await atomicWriteFile(target, Buffer.from(data.buffer, data.byteOffset, data.byteLength))
      written.add(target)
      writtenByWc.set(wcId, written)
      const isNewPath = savePathByWc.get(wcId) !== target
      savePathByWc.set(wcId, target)
      // keep the reload path in sync: a stale openPathByWc would make a
      // reloaded renderer load the OLD file and then save it over the new one
      openPathByWc.set(wcId, target)
      const allowed = allowedByWc.get(wcId) ?? new Set<string>()
      allowed.add(target)
      allowedByWc.set(wcId, allowed)
      dirtyByWc.delete(wcId)
      if (isNewPath) fileSavedHook?.(e.sender, target)
      return done({ ok: true, path: target, ...(backupPath ? { backupPath } : {}) })
    } catch (err) {
      return done({ ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  })

  ipcMain.on(HWP_CHANNELS.abortSave, (e) => {
    pendingSaveByWc.delete(e.sender.id)
    settleSave(e.sender.id, false)
  })

  ipcMain.on(HWP_CHANNELS.dirtyChanged, (e, dirty: unknown) => {
    if (dirty === true) dirtyByWc.add(e.sender.id)
    else dirtyByWc.delete(e.sender.id)
  })

  ipcMain.on(HWP_CHANNELS.closeSaveResult, (e, ok: unknown) => {
    const waiter = closeSaveWaiters.get(e.sender.id)
    closeSaveWaiters.delete(e.sender.id)
    waiter?.(ok === true)
  })

  ipcMain.on(HWP_CHANNELS.readBytesResult, (e, result: unknown) => {
    readBytesWaiters.get(e.sender.id)?.(result)
  })

  // Language channel shared with other modules; removeHandler tolerates duplicate registration
  ipcMain.removeHandler(HWP_CHANNELS.getLanguage)
  ipcMain.handle(HWP_CHANNELS.getLanguage, () => getUiLang())
}

/**
 * The editor runs in an iframe that swallows Ctrl+S before the page or the
 * application menu can see it, so the shortcut is taken here, ahead of both.
 */
function installSaveShortcut(wc: WebContents): void {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat || input.alt) return
    const mod = process.platform === 'darwin' ? input.meta : input.control
    if (!mod || input.code !== 'KeyS') return
    event.preventDefault()
    void requestHwpSave(wc, input.shift ? 'saveAs' : 'save')
  })
}

function grantAndTrack(wc: WebContents, openPath?: string | null): void {
  const wcId = wc.id
  if (openPath && existsSync(openPath)) {
    openPathByWc.set(wcId, openPath)
    savePathByWc.set(wcId, openPath)
    allowedByWc.set(wcId, new Set([openPath]))
  }
  installSaveShortcut(wc)
  // the embedded editor vetoes unload while it holds unsaved edits; closing is decided by
  // requestHwpClose, which has already asked the user by the time the page unloads
  wc.on('will-prevent-unload', (event) => event.preventDefault())
  wc.setWindowOpenHandler(({ url }) => {
    const target = safeExternalUrl(url, { allowedProtocols: ['http:', 'https:', 'mailto:'] })
    if (target) void shell.openExternal(target)
    return { action: 'deny' }
  })
  wc.once('destroyed', () => {
    openPathByWc.delete(wcId)
    allowedByWc.delete(wcId)
    savePathByWc.delete(wcId)
    dirtyByWc.delete(wcId)
    pendingSaveByWc.delete(wcId)
    writtenByWc.delete(wcId)
    closeSaveWaiters.get(wcId)?.(false)
    closeSaveWaiters.delete(wcId)
    settleSave(wcId, false)
  })
}

export function createHwpView(openPath?: string | null): WebContentsView {
  registerHwpIpc()
  const view = new WebContentsView({
    webPreferences: {
      preload: runtime.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  grantAndTrack(view.webContents, openPath)
  void view.webContents.loadURL(rendererUrl(runtime.rendererUrl, 'hwp'))
  return view
}

/** Standalone window mode: `npm run dev -w @genoffice/hwp`, document path passed via argv */
export function startHwpStandalone(): void {
  registerRendererScheme()
  installNavigationGuard(app)
  installContextMenu(app, () => contextMenuLabels(getUiLang()))
  configureHwpRuntime({
    preloadPath: join(__dirname, '../preload/index.js'),
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    rendererFile: join(__dirname, '../renderer/index.html'),
  })
  void app.whenReady().then(() => {
    installRendererProtocol({ hwp: join(__dirname, '../renderer') })
    registerHwpIpc()
    const win = new BrowserWindow({
      width: 1280,
      height: 900,
      webPreferences: {
        preload: runtime.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    const argPath = process.argv.slice(1).find((a) => /\.hwpx?$/i.test(a) && existsSync(a))
    grantAndTrack(win.webContents, argPath)
    void win.loadURL(rendererUrl(runtime.rendererUrl, 'hwp'))
  })
  app.on('window-all-closed', () => app.quit())
}
