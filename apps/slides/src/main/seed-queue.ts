/**
 * The queue behind a new slides tab that starts with a given deck (spec 8.6,
 * "convert without AI"): the shell queues the deck's bytes for the new tab's
 * webContents, and `seed-deck.ts` takes them once when that tab opens. Kept
 * apart from the opening code so the shell can queue without loading the
 * editor's layout machinery.
 */
import type { HandoffWebContents } from '@genoffice/electron-utils/generate-handoff'

/** queued decks by webContents id: one per new tab at most */
const seeds = new Map<number, Uint8Array>()

/** queue a deck for a new tab; dropped when the tab goes away before taking it */
export function queueSlidesSeedFor(contents: HandoffWebContents, deck: Uint8Array): void {
  if (contents.isDestroyed()) return
  const id = contents.id
  seeds.set(id, deck)
  contents.once('destroyed', () => seeds.delete(id))
}

/** the deck queued for this webContents, once; null afterwards and for any other view */
export function takeSlidesSeed(webContentsId: number): Uint8Array | null {
  const deck = seeds.get(webContentsId) ?? null
  seeds.delete(webContentsId)
  return deck
}
