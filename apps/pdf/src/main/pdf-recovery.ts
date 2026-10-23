/**
 * Crash recovery for the PDF editor (spec 1-3, 5.4, 7).
 *
 * A PDF tab's unsaved work is its pending edits in the renderer on top of the
 * file on disk. A recovery copy is what a save would write at that moment
 * (the edits applied by the save path), kept in the app data folder through
 * the shared store; the original file is never written by any of this.
 *
 * Opening a file with a copy asks the per-file question before the renderer
 * reads anything. Restoring keeps the copy's bytes in memory for that view:
 * the view reads them instead of the file, every save starts from them, and
 * the original path stays the save target. The first save in place writes
 * them (plus any newer edits) to the original and ends the restore.
 *
 * Untitled documents (a skill template's copy, a restored untitled copy) are
 * temp files the tab edits; their copies live under an untitled identity
 * until the first save picks a file.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { BrowserWindow } from 'electron'
import {
  isUntitledIdentity,
  newUntitledRecoveryId,
  resolveRecoveryOnOpen,
  unprotectableNoticeText,
  type RecoveryIdentity,
  type RecoveryMessageBox,
  type RecoveryStore,
} from '@genoffice/electron-utils'

export type PdfRecoveryWriteResult = 'written' | 'superseded' | 'skipped' | 'failed'

/** the sender of an IPC call or the view's contents; only the id is required */
export interface PdfRecoveryContents {
  id: number
}

export interface PdfRecoveryDeps {
  /** the shared store, or null when the app data folder is unavailable */
  store(): RecoveryStore | null
  dialog: RecoveryMessageBox
  /** the window the per-file question sits over */
  parentOf(contents: PdfRecoveryContents): BrowserWindow | null
  lang(): string
  /** a skill template's untitled copy (a temp file, not the user's document) */
  isUntitledCopyPath(path: string): boolean
  /** where a restored untitled copy's working file goes (never a user folder) */
  workDir(): string
}

interface ViewRecovery {
  /** the path whose recovery question this view has answered */
  resolvedPath: string | null
  resolving: Promise<void> | null
  /** the shell already decided for this path (launch list) */
  decision: { path: string; decision: 'restore' | 'original' } | null
  /** restored copy bytes for `path`: what the view reads and saves start from */
  restored: { path: string; bytes: Uint8Array } | null
  /** opened from a copy and not saved since: the tab starts with unsaved changes */
  unsavedFromCopy: boolean
  /** untitled document: its working path, identity and tab title */
  untitled: {
    path: string
    identity: RecoveryIdentity
    title: string
    saveAsDefaultPath?: string
  } | null
  /** the copy this view wrote or loaded ('closedClean' only deletes that one) */
  ownedCopy: RecoveryIdentity | null
  unprotectable: boolean
  noticeShown: boolean
  /** the renderer asked for its open path at least once */
  consumed: boolean
  crashed: boolean
}

const sameIdentity = (a: RecoveryIdentity, b: RecoveryIdentity): boolean =>
  isUntitledIdentity(a)
    ? isUntitledIdentity(b) && a.untitledId === b.untitledId
    : !isUntitledIdentity(b) && a.filePath === b.filePath

export type PdfRecovery = ReturnType<typeof createPdfRecovery>

export function createPdfRecovery(deps: PdfRecoveryDeps) {
  const views = new Map<number, ViewRecovery>()

  function view(id: number): ViewRecovery {
    let state = views.get(id)
    if (!state) {
      state = {
        resolvedPath: null,
        resolving: null,
        decision: null,
        restored: null,
        unsavedFromCopy: false,
        untitled: null,
        ownedCopy: null,
        unprotectable: false,
        noticeShown: false,
        consumed: false,
        crashed: false,
      }
      views.set(id, state)
    }
    return state
  }

  function store(): RecoveryStore | null {
    try {
      return deps.store()
    } catch {
      return null
    }
  }

  /** the identity this view's copies of `path` are written under */
  function identityFor(id: number, path: string): RecoveryIdentity {
    const state = view(id)
    if (state.untitled?.path === path) return state.untitled.identity
    if (deps.isUntitledCopyPath(path)) {
      // a skill template's copy: an untitled document whose copy has its own slot
      state.untitled = {
        path,
        identity: { kind: 'pdf', untitledId: newUntitledRecoveryId(), ext: '.pdf' },
        title: basename(path),
      }
      return state.untitled.identity
    }
    return { kind: 'pdf', filePath: path }
  }

  async function resolve(contents: PdfRecoveryContents, path: string): Promise<void> {
    const state = view(contents.id)
    if (state.untitled?.path === path || deps.isUntitledCopyPath(path)) {
      state.resolvedPath = path
      return
    }
    const recoveryStore = store()
    if (!recoveryStore) {
      state.resolvedPath = path
      return
    }
    const identity: RecoveryIdentity = { kind: 'pdf', filePath: path }
    const decided = state.decision?.path === path ? state.decision.decision : null
    state.decision = null
    let bytes: Buffer | null = null
    try {
      if (decided === 'restore') {
        if (recoveryStore.openPlan(identity).action !== 'none') {
          bytes = await recoveryStore.readCopy(identity)
          if (bytes) recoveryStore.markCopyLoaded(identity)
        }
      } else if (decided !== 'original') {
        const answer = await resolveRecoveryOnOpen({
          store: recoveryStore,
          identity,
          dialog: deps.dialog,
          parent: deps.parentOf(contents),
          lang: deps.lang(),
        })
        if (answer.action === 'restore') bytes = answer.bytes
      }
    } catch (err) {
      // an unreadable copy is kept; the file opens as saved
      console.warn('[pdf] recovery open failed:', err)
      bytes = null
    }
    if (bytes) {
      state.restored = { path, bytes: new Uint8Array(bytes) }
      state.unsavedFromCopy = true
      state.ownedCopy = identity
    }
    state.resolvedPath = path
  }

  return {
    /**
     * The common case without waiting: true when `path` needs no question for
     * this view (already answered, untitled, or no copy), which is then
     * recorded; false when `resolveOnOpen` has to run.
     */
    resolvedNow(contents: PdfRecoveryContents, path: string): boolean {
      const state = view(contents.id)
      if (state.resolving) return false
      if (state.resolvedPath === path) return true
      if (state.decision?.path === path) return false
      let none = true
      if (state.untitled?.path !== path && !deps.isUntitledCopyPath(path)) {
        try {
          const plan = store()?.openPlan({ kind: 'pdf', filePath: path })
          none = !plan || plan.action === 'none'
        } catch {
          // no readable store: the file opens as saved
          none = true
        }
      }
      if (none) state.resolvedPath = path
      return none
    },

    /**
     * Before the renderer reads `path`: answer the recovery question once per
     * view and path (the per-file prompt, or the shell's decision). Nothing of
     * the document is loaded before this resolves.
     */
    async resolveOnOpen(contents: PdfRecoveryContents, path: string): Promise<void> {
      const state = view(contents.id)
      state.consumed = true
      while (state.resolving) await state.resolving
      if (state.resolvedPath === path) return
      const running = resolve(contents, path).finally(() => {
        if (state.resolving === running) state.resolving = null
      })
      state.resolving = running
      await running
    },

    /** the renderer asked for its file (with or without one to open) */
    markConsumed(id: number): void {
      view(id).consumed = true
    },

    /** the renderer asked for its file already: a later open has to reload the view */
    hasConsumed(id: number): boolean {
      return views.get(id)?.consumed ?? false
    },

    /** the shell decided for `path` (launch list) before the view reads it */
    setDecision(id: number, path: string, decision: 'restore' | 'original'): void {
      const state = view(id)
      state.decision = { path, decision }
      if (state.resolvedPath === path) state.resolvedPath = null
      state.restored = null
      state.unsavedFromCopy = false
    },

    /** the restored copy's bytes when this view shows `path` from a copy */
    viewBytes(id: number, path: string): Uint8Array | null {
      const restored = views.get(id)?.restored
      return restored && restored.path === path ? restored.bytes : null
    },

    /** whether the view's document came from a copy and has not been saved since */
    unsavedFromCopy(id: number, path: string): boolean {
      const state = views.get(id)
      if (!state?.unsavedFromCopy) return false
      return state.restored?.path === path || state.untitled?.path === path
    },

    /**
     * Write the copy of `path` for this view. `serialize` produces the bytes a
     * save would write; the write ticket is taken before it runs, so a save
     * (which deletes the copy) landing meanwhile wins.
     */
    async writeCopy(
      id: number,
      path: string,
      serialize: () => Promise<Uint8Array>,
    ): Promise<PdfRecoveryWriteResult> {
      const state = view(id)
      if (state.unprotectable || state.resolvedPath !== path || state.resolving) return 'skipped'
      const recoveryStore = store()
      if (!recoveryStore) return 'skipped'
      try {
        const identity = identityFor(id, path)
        const ticket = recoveryStore.beginWrite(identity)
        const bytes = await serialize()
        const title = state.untitled?.path === path ? state.untitled.title : basename(path)
        const result = await recoveryStore.writeCopy(identity, Buffer.from(bytes), {
          title,
          ticket,
        })
        if (result === 'written') state.ownedCopy = identity
        return result
      } catch (err) {
        console.warn('[pdf] recovery copy failed:', err)
        return 'failed'
      }
    },

    /**
     * A save in place of `path` succeeded. A file document's copy is deleted
     * and the restore ends (the disk now holds the bytes). An untitled
     * document only saved into its working file, not to a place the user
     * chose: its copy is refreshed from what was written instead.
     */
    async savedInPlace(
      id: number,
      path: string,
      written: () => Promise<Uint8Array>,
    ): Promise<void> {
      const state = view(id)
      if (state.restored?.path === path) state.restored = null
      // the renderer's pending state is in the written file now, as for any save
      state.unsavedFromCopy = false
      if (state.untitled?.path === path) {
        if (state.unprotectable) return
        const recoveryStore = store()
        if (!recoveryStore) return
        try {
          const identity = state.untitled.identity
          const ticket = recoveryStore.beginWrite(identity)
          const result = await recoveryStore.writeCopy(identity, Buffer.from(await written()), {
            title: state.untitled.title,
            ticket,
          })
          if (result === 'written') state.ownedCopy = identity
        } catch (err) {
          console.warn('[pdf] recovery copy failed:', err)
        }
        return
      }
      const identity: RecoveryIdentity = { kind: 'pdf', filePath: path }
      try {
        store()?.deleteCopy(identity, 'saved')
      } catch {
        // the save succeeded; a copy left behind is offered again, never lost
      }
      if (state.ownedCopy && sameIdentity(state.ownedCopy, identity)) state.ownedCopy = null
    },

    /** an untitled document was saved to `target`, which is now the tab's file */
    adopted(id: number, oldPath: string, target: string): void {
      const state = view(id)
      const untitled = state.untitled?.path === oldPath ? state.untitled : null
      if (untitled) {
        try {
          store()?.deleteCopy(untitled.identity, 'saved')
        } catch {
          // a copy left behind is offered again, never lost
        }
        if (state.ownedCopy && sameIdentity(state.ownedCopy, untitled.identity)) {
          state.ownedCopy = null
        }
        state.untitled = null
      }
      state.unsavedFromCopy = false
      state.restored = null
      state.resolvedPath = target
    },

    /** "Save As" default for an untitled document whose original went missing */
    saveAsDefaultPath(id: number, path: string): string | undefined {
      const untitled = views.get(id)?.untitled
      return untitled?.path === path ? untitled.saveAsDefaultPath : undefined
    },

    /** the user chose "Don't Save" for the view's document */
    dontSave(id: number, path: string | undefined): void {
      if (!path) return
      try {
        store()?.deleteCopy(identityFor(id, path), 'dontSave')
      } catch {
        // nothing to undo: the tab closes without saving either way
      }
      const state = view(id)
      state.ownedCopy = null
    },

    /**
     * The view's file moved (the shell renamed it): the copy and the restore
     * follow the new path.
     */
    async renamed(id: number, oldPath: string, newPath: string): Promise<void> {
      const state = views.get(id)
      if (!state) return
      if (state.resolvedPath === oldPath) state.resolvedPath = newPath
      if (state.restored?.path === oldPath) state.restored = { ...state.restored, path: newPath }
      const owned = state.ownedCopy
      if (!owned || isUntitledIdentity(owned) || owned.filePath !== oldPath) return
      const recoveryStore = store()
      if (!recoveryStore) return
      const next: RecoveryIdentity = { kind: 'pdf', filePath: newPath }
      try {
        const bytes = await recoveryStore.readCopy(owned)
        if (!bytes) return
        if (
          (await recoveryStore.writeCopy(next, bytes, { title: basename(newPath) })) === 'written'
        ) {
          state.ownedCopy = next
          recoveryStore.deleteCopy(owned, 'discarded')
        }
      } catch (err) {
        console.warn('[pdf] recovery copy move failed:', err)
      }
    },

    /**
     * Load an untitled copy (or a copy whose original is missing) into a
     * view: its bytes become a working file outside the user's folders, which
     * the view opens as an untitled document with unsaved changes. Answers
     * the working path, or null when the copy cannot be read.
     */
    async openUntitled(
      id: number,
      request: { copy: RecoveryIdentity; title: string; saveAsDefaultPath?: string },
    ): Promise<string | null> {
      const recoveryStore = store()
      if (!recoveryStore || request.copy.kind !== 'pdf') return null
      const bytes = await recoveryStore.readCopy(request.copy)
      if (!bytes) return null
      const dir = deps.workDir()
      await mkdir(dir, { recursive: true })
      const path = join(dir, `${randomUUID()}.pdf`)
      await writeFile(path, bytes)
      recoveryStore.markCopyLoaded(request.copy)
      const state = view(id)
      state.untitled = {
        path,
        identity: request.copy,
        title: request.title,
        ...(request.saveAsDefaultPath ? { saveAsDefaultPath: request.saveAsDefaultPath } : {}),
      }
      state.restored = null
      state.unsavedFromCopy = true
      state.ownedCopy = request.copy
      state.resolvedPath = path
      return path
    },

    /**
     * The renderer reports whether the open document cannot get a safe copy
     * (a password or encrypted PDF). Answers the one-time notice for this
     * tab, or null when there is nothing (more) to say.
     */
    reportUnprotectable(id: number, unprotectable: boolean): string | null {
      const state = view(id)
      state.unprotectable = unprotectable
      if (!unprotectable || state.noticeShown) return null
      state.noticeShown = true
      return unprotectableNoticeText(deps.lang())
    },

    isUnprotectable(id: number): boolean {
      return views.get(id)?.unprotectable ?? false
    },

    markCrashed(id: number): void {
      view(id).crashed = true
    },

    /**
     * The view is gone. A tab that closed with no unsaved changes deletes the
     * copy it wrote; a crashed or still-dirty view keeps it, and the store
     * refuses this delete while the app is ending.
     */
    destroyed(id: number, dirty: boolean): void {
      const state = views.get(id)
      views.delete(id)
      if (!state?.ownedCopy || dirty || state.crashed) return
      try {
        store()?.deleteCopy(state.ownedCopy, 'closedClean')
      } catch {
        // kept: offered again at the next launch
      }
    },
  }
}
