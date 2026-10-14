/**
 * The sheets of a document: adding one, renaming one, deleting one.
 *
 * These are edits of the source tree made straight from the sheet tabs, not
 * through a reconciled state, and the editor's undo does not cover them. Each
 * marks the document changed only when it changed something.
 */

import { newSheet, type NewSheetOptions } from './create'
import type { XmindDocument } from './document'

/**
 * Why a sheet edit was not made.
 *
 * - `no-such-sheet`: the document has no sheet at that position.
 * - `last-sheet`: a file holds at least one sheet, so the last one stays.
 * - `bad-title`: the title is not text.
 */
export type SheetEditProblem = 'no-such-sheet' | 'last-sheet' | 'bad-title'

export type SheetEditResult = { ok: true } | { ok: false; problem: SheetEditProblem }

/**
 * Adds a sheet after the others and returns its position. The sheet is the one
 * `newSheet` makes: one central topic, and the default theme when one is
 * registered. The titles come from the caller, which knows the user's language.
 */
export function addSheet(document: XmindDocument, options: NewSheetOptions): number {
  document.sheets.push(newSheet(options))
  document.markChanged()
  return document.sheets.length - 1
}

/** Gives a sheet another title. The title it already has changes nothing. */
export function renameSheet(
  document: XmindDocument,
  index: number,
  title: string,
): SheetEditResult {
  const sheet = sheetAt(document, index)
  if (!sheet) return { ok: false, problem: 'no-such-sheet' }
  if (typeof title !== 'string') return { ok: false, problem: 'bad-title' }
  if (sheet.title !== title) {
    sheet.title = title
    document.markChanged()
  }
  return { ok: true }
}

/**
 * Deletes a sheet with everything on it, shown or not. The sheets after it move
 * up one position. The last sheet of a document cannot be deleted.
 */
export function deleteSheet(document: XmindDocument, index: number): SheetEditResult {
  if (!sheetAt(document, index)) return { ok: false, problem: 'no-such-sheet' }
  if (document.sheets.length === 1) return { ok: false, problem: 'last-sheet' }
  document.sheets.splice(index, 1)
  document.markChanged()
  return { ok: true }
}

function sheetAt(document: XmindDocument, index: number) {
  return Number.isInteger(index) ? document.sheets[index] : undefined
}
