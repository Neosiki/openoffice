/**
 * "In the file" states are confirmed by a successful PDF save (reading-assist
 * spec 3.5). A feature that adds an annotation for something it keeps in the
 * result store (a passage card kept as a note, an accepted AI highlight)
 * registers a confirmation under the annotation's pending id. When a save that
 * wrote that annotation succeeds, and after the store migration moved the
 * results to the saved file's hash, the confirmation runs with that new hash
 * and writes the confirmed state there. Until then the screen shows "waiting
 * for save"; a document closed without saving writes nothing, because the
 * confirmations only live in the tab.
 *
 * One instance per tab; not tied to any feature.
 */

/** writes the confirmed state under the saved file's document hash */
export type SaveConfirmation = (docHash: string) => Promise<void> | void

export interface SaveConfirmations {
  /** wait for a save that writes annotation `annotId`; replaces an earlier one for the same id */
  register(annotId: string, confirm: SaveConfirmation): void
  /** forget a waiting confirmation (the annotation was removed before any save) */
  cancel(annotId: string): void
  isPending(annotId: string): boolean
  pendingIds(): string[]
  /** told when the waiting set changes */
  subscribe(listener: () => void): () => void
  /**
   * After a successful PDF save and the store migration: run the confirmations
   * of the annotations the save wrote, under the hash `docHash` resolves to
   * (asked only when one is due). When it resolves to null nothing runs and
   * they keep waiting. A failing confirmation does not stop the others.
   */
  afterSave(written: Iterable<string>, docHash: () => Promise<string | null>): Promise<void>
}

export function createSaveConfirmations(): SaveConfirmations {
  const waiting = new Map<string, SaveConfirmation>()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of [...listeners]) listener()
  }
  return {
    register(annotId, confirm) {
      waiting.set(annotId, confirm)
      notify()
    },
    cancel(annotId) {
      if (waiting.delete(annotId)) notify()
    },
    isPending: (annotId) => waiting.has(annotId),
    pendingIds: () => [...waiting.keys()],
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async afterSave(written, docHash) {
      const writtenSet = new Set(written)
      const due = [...waiting].filter(([id]) => writtenSet.has(id))
      if (due.length === 0) return
      const hash = await docHash().catch(() => null)
      if (!hash) return
      for (const [id, confirm] of due) {
        // a later registration for the same id (written by a later save) stays
        if (waiting.get(id) === confirm) waiting.delete(id)
      }
      notify()
      for (const [, confirm] of due) {
        try {
          await confirm(hash)
        } catch {
          // the annotation is in the file either way; the store just does not say so
        }
      }
      notify()
    },
  }
}
