import { app, dialog } from 'electron'
import type { BrowserWindow, RenderProcessGoneDetails, WebContents } from 'electron'
import { join } from 'node:path'
import { appendCrashLog, CRASH_LOG_FILE, errorReason } from './crash-log'
import type { CrashEntry } from './crash-log'
import { wasReleasedRenderer } from './renderer-disposal'

/**
 * Records abnormal process ends in `<userData>/crash-log.jsonl` (see
 * crash-log.ts for what a line may hold) and tells the user when the renderer
 * of an open document dies. Before this, a renderer or GPU crash left no trace
 * anywhere: a tester could only say "the app closed by itself".
 */

export type CrashStringKey =
  'crashTitle' | 'crashBody' | 'crashReopen' | 'crashReload' | 'crashClose' | 'crashLater'

export interface CrashedDocument {
  kind: string
  title: string
  filePath?: string
}

export interface CrashWatchOptions {
  /** editor family for the log line: 'docs', 'sheets', …, 'home', 'other' */
  editorOf: (wc: WebContents) => string
  /** the open document a renderer shows; null for chrome renderers (Home, dialogs) */
  documentOf: (wc: WebContents) => CrashedDocument | null
  parentWindow: (wc: WebContents) => BrowserWindow | null
  /** close the document's tab or window with no save prompt (its renderer, which
   *  held the unsaved state, is gone); true once it is closed */
  closeDocument: (wc: WebContents) => boolean
  reopen: (filePath: string) => void
  t: (key: CrashStringKey, params?: Record<string, string | number>) => string
  /** false for unattended runs (headless export): record only, never prompt */
  prompt: boolean
}

/** a normal exit is not a failure */
const NOT_A_CRASH = new Set(['clean-exit'])

/** whether a gone renderer warrants telling the user (the app's own kills do not) */
export function shouldPromptForGoneRenderer(reason: string): boolean {
  return reason !== 'clean-exit' && reason !== 'killed'
}

export function crashLogPath(): string {
  return join(app.getPath('userData'), CRASH_LOG_FILE)
}

function record(entry: CrashEntry): void {
  appendCrashLog(crashLogPath(), entry)
}

export function startCrashWatch(options: CrashWatchOptions): void {
  // the *Monitor* event only observes: Electron's own uncaught-exception
  // handling (an error box, the app keeps running) stays exactly as it was
  process.on('uncaughtExceptionMonitor', (error) => {
    record({ kind: 'main-exception', reason: errorReason(error) })
  })
  process.on('unhandledRejection', (error) => {
    record({ kind: 'main-rejection', reason: errorReason(error) })
    // a listener silences Node's own warning, so keep it on the console
    console.warn('[main] unhandled rejection:', error)
  })

  app.on('child-process-gone', (_event, details) => {
    if (NOT_A_CRASH.has(details.reason)) return
    // utility processes (document jobs, converters) are ended on purpose all the time
    if (details.reason === 'killed' && details.type === 'Utility') return
    record({
      kind: 'child-process',
      reason: details.reason,
      exitCode: details.exitCode,
      process: details.type,
    })
  })

  const prompting = new Set<number>()
  app.on('render-process-gone', (_event, wc: WebContents, details: RenderProcessGoneDetails) => {
    // a closed document's renderer the shell ended to free its memory
    if (wasReleasedRenderer(wc.id)) return
    if (NOT_A_CRASH.has(details.reason)) return
    let editor = 'other'
    try {
      editor = options.editorOf(wc)
    } catch {
      /* keep 'other' */
    }
    record({ kind: 'renderer', reason: details.reason, exitCode: details.exitCode, editor })
    if (!options.prompt || !shouldPromptForGoneRenderer(details.reason)) return
    void promptForCrashedDocument(wc, options, prompting)
  })
}

async function promptForCrashedDocument(
  wc: WebContents,
  options: CrashWatchOptions,
  prompting: Set<number>,
): Promise<void> {
  if (wc.isDestroyed() || prompting.has(wc.id)) return
  const doc = options.documentOf(wc)
  if (!doc) return
  prompting.add(wc.id)
  try {
    // slides keeps the open deck in the main process, so a reload brings it all back
    const action: 'reload' | 'reopen' | 'close' =
      doc.kind === 'slides' ? 'reload' : doc.filePath ? 'reopen' : 'close'
    const actionLabel =
      action === 'reload'
        ? options.t('crashReload')
        : action === 'reopen'
          ? options.t('crashReopen')
          : options.t('crashClose')
    const dialogOptions = {
      type: 'warning' as const,
      message: options.t('crashTitle'),
      detail: options.t('crashBody', { title: doc.title }),
      buttons: [actionLabel, options.t('crashLater')],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }
    const parent = options.parentWindow(wc)
    const { response } =
      parent && !parent.isDestroyed()
        ? await dialog.showMessageBox(parent, dialogOptions)
        : await dialog.showMessageBox(dialogOptions)
    if (response !== 0 || wc.isDestroyed()) return
    if (action === 'reload') {
      wc.reload()
      return
    }
    const gone = options.closeDocument(wc)
    if (gone && action === 'reopen' && doc.filePath) options.reopen(doc.filePath)
  } catch {
    /* a failed prompt leaves the tab as it is */
  } finally {
    prompting.delete(wc.id)
  }
}
