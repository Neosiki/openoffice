/**
 * Crash-recovery copies of mind maps, on the main-process side (spec "work is
 * not lost", 1, 2, 5.4, 7).
 *
 * The renderer makes a copy's bytes (what a save would write now) and hands
 * them over; they go through the shared recovery store into
 * `<userData>/mindmap-autosave`. The user's file and folders are never
 * written here: a map with a file keeps one copy under the hash of its path,
 * an untitled map one copy under an id of its own (`untitled/<id>.xmind`).
 *
 * Each view remembers which copies are its own: the ones it wrote and the one
 * it was restored from. Those, and only those, go when its map is saved
 * ('saved'), dropped with "Don't Save" ('dontSave') or closed without unsaved
 * changes ('closedClean'). A view whose renderer crashed, or one closed while
 * the app is ending, deletes nothing (the store refuses during shutdown).
 */
import { readFileSync } from 'node:fs'
import { app, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import {
  createRecoveryStore,
  isUntitledIdentity,
  newUntitledRecoveryId,
  resolveRecoveryOnOpen,
} from '@genoffice/electron-utils'
import type {
  RecoveryDeleteReason,
  RecoveryIdentity,
  RecoveryOpenUntitledRequest,
  RecoveryStore,
  RecoveryWriteResult,
} from '@genoffice/electron-utils'
import { getUiLang } from '@genoffice/i18n'

const KIND = 'mindmap' as const
const MAP_EXTENSION = '.xmind'

let store: RecoveryStore | null = null

/** The shared store over this app's data folder. */
export function mindmapRecoveryStore(): RecoveryStore {
  store ??= createRecoveryStore({ userDataDir: () => app.getPath('userData') })
  return store
}

interface ViewRecovery {
  /** the id of this view's untitled copy, made at the first copy of an untitled map */
  untitledId?: string
  /** this view's copies, by copy path */
  owned: Map<string, RecoveryIdentity>
  /** the first Save As suggestion of a restored map whose file is gone */
  saveAsDefault?: string
  /** the tab title a restored untitled copy came with */
  title?: string
  /** what the shell already decided for the file this view opens next */
  decision?: 'restore' | 'original'
  /** the renderer crashed: its copies outlive the view */
  crashed?: boolean
}

const views = new Map<number, ViewRecovery>()

function stateOf(wcId: number): ViewRecovery {
  let state = views.get(wcId)
  if (!state) {
    state = { owned: new Map() }
    views.set(wcId, state)
  }
  return state
}

export function fileRecoveryIdentity(filePath: string): RecoveryIdentity {
  return { kind: KIND, filePath }
}

/** The copy a view writes now: its file's, or (untitled) its own id's, made on first use. */
export function viewRecoveryIdentity(wcId: number, savePath: string | undefined): RecoveryIdentity {
  if (savePath) return fileRecoveryIdentity(savePath)
  const state = stateOf(wcId)
  state.untitledId ??= newUntitledRecoveryId()
  return { kind: KIND, untitledId: state.untitledId, ext: MAP_EXTENSION }
}

function own(wcId: number, identity: RecoveryIdentity): void {
  stateOf(wcId).owned.set(mindmapRecoveryStore().copyPath(identity), identity)
}

/** Whether another live view holds this copy (the same map open in two panes). */
function ownedElsewhere(wcId: number, identity: RecoveryIdentity): boolean {
  const key = mindmapRecoveryStore().copyPath(identity)
  for (const [other, state] of views) {
    if (other !== wcId && !state.crashed && state.owned.has(key)) return true
  }
  return false
}

/**
 * Keep `bytes` as the view's copy. The copy counts as the view's own before
 * it is written, so a save arriving meanwhile cancels the write instead of
 * being outlived by it. Rejects on a disk error (the renderer backs off).
 */
export function writeViewCopy(
  wcId: number,
  savePath: string | undefined,
  bytes: Uint8Array,
  untitledTitle: () => string,
): Promise<RecoveryWriteResult> {
  const identity = viewRecoveryIdentity(wcId, savePath)
  own(wcId, identity)
  const title = isUntitledIdentity(identity) ? (stateOf(wcId).title ?? untitledTitle()) : undefined
  return mindmapRecoveryStore().writeCopy(
    identity,
    Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    title === undefined ? {} : { title },
  )
}

function deleteOwned(wcId: number, reason: RecoveryDeleteReason): void {
  const state = views.get(wcId)
  if (!state) return
  const recovery = mindmapRecoveryStore()
  for (const [key, identity] of state.owned) {
    if (recovery.deleteCopy(identity, reason) === 'deleted') state.owned.delete(key)
  }
}

/** The view's map reached the disk: its copies go, and it is no longer untitled. */
export function viewSaved(wcId: number): void {
  deleteOwned(wcId, 'saved')
  const state = views.get(wcId)
  if (!state) return
  state.untitledId = undefined
  state.saveAsDefault = undefined
  state.title = undefined
}

/** "Don't Save" (close prompt, or a tool closing the map without saving): the copies go. */
export function viewDropped(wcId: number): void {
  deleteOwned(wcId, 'dontSave')
}

export function viewCrashed(wcId: number): void {
  stateOf(wcId).crashed = true
}

/**
 * The view is gone. Closed without unsaved changes, it takes its copies with
 * it; with unsaved changes, after a crash or while the app is ending, they stay.
 */
export function viewGone(wcId: number, dirty: boolean): void {
  const state = views.get(wcId)
  if (state && !state.crashed && !dirty) deleteOwned(wcId, 'closedClean')
  views.delete(wcId)
}

/** The identity of the copy the view writes, for the shell's session record and crash reopen; null for no view. */
export function viewRecoveryIdentityIfAny(
  wcId: number,
  savePath: string | undefined,
): RecoveryIdentity | null {
  if (!views.has(wcId) && !savePath) return null
  return viewRecoveryIdentity(wcId, savePath)
}

/** First Save As suggestion of a restored map whose file is gone. */
export function viewSaveAsDefault(wcId: number): string | undefined {
  return views.get(wcId)?.saveAsDefault
}

export function setViewSaveAsDefault(wcId: number, path: string): void {
  stateOf(wcId).saveAsDefault = path
}

/** The shell decided the recovery question for the file this view opens next. */
export function setViewOpenDecision(wcId: number, decision: 'restore' | 'original'): void {
  stateOf(wcId).decision = decision
}

/**
 * Before a file's content is loaded: the copy's bytes when the map is to be
 * restored, null to open the file as saved. The shell's decision is taken as
 * it is; otherwise "restore" chosen in the launch list restores without
 * asking, and an undecided or "later" copy asks first, naming the file (Esc
 * and closing the box restore). A copy another pane is working on is not
 * asked about: that pane holds the work.
 */
export async function resolveViewOpen(
  wcId: number,
  filePath: string,
  parent: BrowserWindow | null,
): Promise<Uint8Array | null> {
  const state = stateOf(wcId)
  const decision = state.decision
  state.decision = undefined
  if (decision === 'original') return null
  const identity = fileRecoveryIdentity(filePath)
  if (ownedElsewhere(wcId, identity)) return null
  const recovery = mindmapRecoveryStore()
  if (decision === 'restore' && recovery.copyInfo(identity)) {
    recovery.setCopyState(identity, 'restoreChosen')
  }
  const result = await resolveRecoveryOnOpen({
    store: recovery,
    identity,
    dialog,
    parent,
    lang: getUiLang(),
  })
  if (result.action !== 'restore') return null
  own(wcId, identity)
  return new Uint8Array(result.bytes)
}

/**
 * A copy to open in this (untitled) view: its bytes, read now so they can be
 * queued before the renderer asks. Later copies of the view go to the same
 * untitled slot; a copy of a file whose file is gone is kept until the map is
 * saved, dropped or closed clean, and its path is offered by the first Save As.
 */
export function takeUntitledCopy(
  wcId: number,
  request: RecoveryOpenUntitledRequest,
): Uint8Array | null {
  const recovery = mindmapRecoveryStore()
  let bytes: Buffer
  try {
    bytes = readFileSync(recovery.copyPath(request.copy))
  } catch {
    return null
  }
  recovery.markCopyLoaded(request.copy)
  const state = stateOf(wcId)
  own(wcId, request.copy)
  if (isUntitledIdentity(request.copy) && request.copy.ext === MAP_EXTENSION) {
    state.untitledId = request.copy.untitledId
  }
  state.title = request.title
  if (request.saveAsDefaultPath) state.saveAsDefault = request.saveAsDefaultPath
  return new Uint8Array(bytes)
}

/** The view's file was renamed on disk: its copy follows the new path. */
export async function viewFileRenamed(
  wcId: number,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const state = views.get(wcId)
  const recovery = mindmapRecoveryStore()
  const from = fileRecoveryIdentity(oldPath)
  const key = recovery.copyPath(from)
  if (!state?.owned.has(key)) return
  try {
    const bytes = await recovery.readCopy(from)
    if (bytes) {
      const to = fileRecoveryIdentity(newPath)
      own(wcId, to)
      await recovery.writeCopy(to, bytes)
    }
  } catch (err) {
    console.warn('[mindmap] the recovery copy could not follow the renamed file:', err)
    return
  }
  // the content now lives under the new path; the old entry would only offer it twice
  if (recovery.deleteCopy(from, 'discarded') === 'deleted') state.owned.delete(key)
}
