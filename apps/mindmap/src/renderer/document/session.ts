/**
 * One open map: the engine's document, its sheets, and the history of each
 * sheet's source tree.
 *
 * The document is the only thing that can produce bytes to save, and the
 * source tree inside it is the authority: the screen is brought in line with
 * it, never the other way round.
 *
 * History. Reconciling sees results, not actions, so it cannot bring back what
 * a deleted topic carried that the editor never showed (unknown keys, a
 * picture, floating topics, the branches under a summary). Every step of the
 * drawing library's history therefore has a copy of the sheet's source tree
 * from before and after it. Undo and redo put the matching copy back whole;
 * they do not reconcile. The copies are kept per sheet, so the history of one
 * sheet never reaches another.
 *
 * Putting a copy back does not mark the document changed: it goes into the
 * live tree, which the document compares with the file it holds. An edit that
 * is undone therefore still saves as the file's own bytes.
 */
import {
  addSheet,
  checkContentStructure,
  countPreservedInDocument,
  countPreservedWithTopics,
  deleteSheet,
  isRecord,
  type NewSheetOptions,
  reconcileSheet,
  type ReconcileResult,
  recogniseSheetTheme,
  renameSheet,
  type SheetEditResult,
  sheetsToOutline,
  sheetToView,
  type ViewSheet,
  type XmindDocument,
  type XmindSheet,
} from '@genoffice/xmind-engine'

/** A sheet as the tabs show it. `key` stays the same while the sheet lives; `index` moves when a sheet before it is deleted. */
export interface SheetTab {
  key: string
  index: number
  title: string
}

export interface ApplyOptions {
  /** true for a change the drawing library recorded in its history; false for one it did not (folding, the layout) */
  step: boolean
  /** ids of relationships whose curve the user moved */
  reshapedRelationships?: readonly string[]
}

export interface SaveBytesOptions {
  /** a new preview picture (PNG); the picture in the file stays when left out */
  thumbnail?: Uint8Array | null
}

/**
 * Keys of a sheet that undo and redo leave as they are: they are changed
 * outside the map's history (the sheet tabs, the theme panel), so a step back
 * in the map must not take them back with it.
 */
export const SHEET_KEYS_OUTSIDE_HISTORY: readonly string[] = ['title', 'theme']

/** The most steps kept per sheet; older ones can no longer be undone. */
export const MAX_HISTORY_STEPS = 200

interface SheetEntry {
  key: string
  /** `snapshots[n]` is the sheet after `n` steps; `snapshots[cursor]` is where the sheet stands */
  snapshots: XmindSheet[]
  cursor: number
  /** the tree changed without a step since `snapshots[cursor]` was taken */
  stale: boolean
}

let nextKey = 0

export class DocumentSession {
  readonly #document: XmindDocument
  #entries: SheetEntry[]
  /** bytes were produced that hold changes the disk does not have yet */
  #unwritten = false
  readonly #listeners = new Set<() => void>()

  constructor(document: XmindDocument) {
    this.#document = document
    this.#entries = document.sheets.map(() => newEntry())
  }

  /** The engine's document. Later work (themes, pictures) reads and edits the tree through it. */
  get document(): XmindDocument {
    return this.#document
  }

  tabs(): SheetTab[] {
    return this.#entries.map((entry, index) => ({
      key: entry.key,
      index,
      title:
        typeof this.#document.sheets[index]?.title === 'string'
          ? (this.#document.sheets[index]!.title as string)
          : '',
    }))
  }

  /** The sheet's position in the file, or -1 when the sheet is gone. */
  indexOf(key: string): number {
    return this.#entries.findIndex((entry) => entry.key === key)
  }

  /** The source tree of a sheet. Read it; edit it only through the engine. */
  sheet(key: string): XmindSheet {
    return this.#document.sheets[this.#at(key).index]!
  }

  view(key: string): ViewSheet {
    const { index } = this.#at(key)
    return sheetToView(this.#document.sheets[index]!, index)
  }

  /**
   * Makes the source tree match the state the screen shows. The answer says
   * whether the screen has to be drawn again (see the engine's
   * `reconcileSheet`).
   */
  apply(key: string, state: ViewSheet, options: ApplyOptions): ReconcileResult {
    const { entry, index } = this.#at(key)
    const sheet = this.#document.sheets[index]!
    let before: XmindSheet | undefined
    if (options.step) {
      before =
        entry.snapshots.length === 0 || entry.stale
          ? structuredClone(sheet)
          : entry.snapshots[entry.cursor]!
    }
    const result = reconcileSheet(this.#document, index, state, {
      reshapedRelationships: options.reshapedRelationships,
    })
    const changed = result.ok && result.changed
    if (before) {
      // A refused state is a step too: the library recorded one, and the two histories must stay in line.
      entry.snapshots.length = entry.cursor + 1
      entry.snapshots[entry.cursor] = before
      entry.snapshots.push(changed ? structuredClone(this.#document.sheets[index]!) : before)
      entry.cursor++
      entry.stale = false
      if (entry.snapshots.length > MAX_HISTORY_STEPS + 1) {
        entry.snapshots.shift()
        entry.cursor--
      }
    } else if (changed) {
      entry.stale = true
    }
    if (changed) this.#notify()
    return result
  }

  canUndo(key: string): boolean {
    const entry = this.#entries.find((candidate) => candidate.key === key)
    return !!entry && entry.cursor > 0
  }

  canRedo(key: string): boolean {
    const entry = this.#entries.find((candidate) => candidate.key === key)
    return !!entry && entry.cursor < entry.snapshots.length - 1
  }

  /** One step back: the sheet's source tree as it was before the step. Null when there is none. */
  undo(key: string): ViewSheet | null {
    if (!this.canUndo(key)) return null
    this.#at(key).entry.cursor--
    return this.restoreStep(key)
  }

  /** One step forward again. Null when there is none. */
  redo(key: string): ViewSheet | null {
    if (!this.canRedo(key)) return null
    this.#at(key).entry.cursor++
    return this.restoreStep(key)
  }

  /**
   * Puts the copy of the current step back into the source tree and returns
   * its view. Also the way back when the screen turned out to show something
   * else after an undo: the copy is the truth, and the screen is drawn from it.
   */
  restoreStep(key: string): ViewSheet {
    const { entry, index } = this.#at(key)
    const snapshot = entry.snapshots[entry.cursor]
    if (snapshot) {
      restoreSheet(this.#document, index, snapshot)
      entry.stale = false
      this.#notify()
    }
    return this.view(key)
  }

  // ---- sheets: straight edits of the tree, outside the map's history ----

  addSheet(options: NewSheetOptions): SheetTab {
    const index = addSheet(this.#document, options)
    this.#entries.push(newEntry())
    this.#notify()
    return this.tabs()[index]!
  }

  renameSheet(key: string, title: string): SheetEditResult {
    const index = this.indexOf(key)
    const result = renameSheet(this.#document, index, title)
    if (result.ok) this.#notify()
    return result
  }

  /** Deletes a sheet with everything on it. Asking the user first is the caller's part (`sheet-actions.ts`). */
  deleteSheet(key: string): SheetEditResult {
    const index = this.indexOf(key)
    const result = deleteSheet(this.#document, index)
    if (result.ok) {
      this.#entries.splice(index, 1)
      this.#notify()
    }
    return result
  }

  // ---- what the editor does not show ----

  /** How many preserve-only elements the file holds. */
  preservedTotal(): number {
    return countPreservedInDocument(this.#document).total
  }

  /** How many preserve-only elements would go with these topics (or summaries, by summary topic id). */
  preservedWith(key: string, topicIds: readonly string[]): number {
    return countPreservedWithTopics(this.sheet(key), topicIds)
  }

  /** Whether a sheet carries a theme this app did not write: it is drawn with the default look. */
  hasUnknownTheme(): boolean {
    return this.#document.sheets.some(
      (sheet) =>
        isRecord(sheet.theme) &&
        Object.keys(sheet.theme).length > 0 &&
        recogniseSheetTheme(sheet) === null,
    )
  }

  // ---- output ----

  /** Whether the map holds changes the disk does not have. A new map nobody touched is not dirty. */
  get dirty(): boolean {
    return this.#unwritten || this.#document.changed
  }

  /**
   * The bytes of the file as it stands. Unchanged since it was opened or last
   * saved: the very bytes of that file. Producing bytes does not make the map
   * clean; only `markWritten` does, once they are on disk.
   */
  async produceBytes(options: SaveBytesOptions = {}): Promise<Uint8Array> {
    const changed = this.#document.changed
    const bytes = await this.#document.save({ thumbnail: options.thumbnail })
    if (changed) this.#unwritten = true
    return bytes
  }

  /** The bytes last produced reached the disk. */
  markWritten(): void {
    this.#unwritten = false
    this.#notify()
  }

  /** The whole map as outline text, unsaved edits included. */
  outline(): string {
    return sheetsToOutline(this.#document.sheets)
  }

  /** Calls `listener` after every change of the tree and after a save was reported. Returns the way to stop. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #at(key: string): { entry: SheetEntry; index: number } {
    const index = this.indexOf(key)
    if (index < 0) throw new Error(`mindmap: there is no sheet ${key}`)
    return { entry: this.#entries[index]!, index }
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener()
  }
}

function newEntry(): SheetEntry {
  return { key: `sheet-${++nextKey}`, snapshots: [], cursor: 0, stale: false }
}

/**
 * Puts a copy of a sheet in the live sheet's place without marking the
 * document changed. The copy moves into the object the document already
 * holds, key by key and in the copy's order, the way reconciling does it; the
 * keys changed outside the map's history and the layout keep their live value.
 */
function restoreSheet(document: XmindDocument, index: number, snapshot: XmindSheet): void {
  const live = document.sheets[index]
  if (!live) throw new Error(`mindmap: there is no sheet ${index}`)
  const next = structuredClone(snapshot)
  for (const key of SHEET_KEYS_OUTSIDE_HISTORY) carryOver(live, next, key)
  // the layout is picked outside the library's history as well
  carryOver(live.rootTopic, next.rootTopic, 'structureClass')
  const check = checkContentStructure([next])
  if (!check.ok) throw new Error(`mindmap: cannot restore the sheet, ${check.problem}`)
  for (const key of Object.keys(live)) delete live[key]
  for (const [key, value] of Object.entries(next)) {
    // defined, not assigned: a key named `__proto__` must stay a key of the file
    Object.defineProperty(live, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }
}

function carryOver(from: Record<string, unknown>, to: Record<string, unknown>, key: string): void {
  if (Object.hasOwn(from, key)) to[key] = from[key]
  else delete to[key]
}
