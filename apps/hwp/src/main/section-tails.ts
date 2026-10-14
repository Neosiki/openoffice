import { createHash } from 'node:crypto'
import {
  CTRL_HEADER,
  DOC_INFO,
  LIST_HEADER,
  PARA_HEADER,
  PARA_TEXT,
  SECTION,
  openHwp,
  recordsOf,
  rewriteStreams,
  sectionCount,
  streamOf,
} from './hwp5-file'
import type { HwpRecord, OpenedHwp } from './hwp5-file'

/**
 * HWP 5 keeps some content of a section after the section's last paragraph, one level
 * below the body: the master pages beyond the first (a list header, then that page's
 * paragraphs) and the memos (a memo record, a list header, the memo's paragraphs). rhwp
 * 0.8.7 writes a section anew (any section the user changed) without the memos and
 * without the master pages of some kinds, and Hancom Hangul refuses to open a file whose
 * section lost them. A section nobody changed is written from its original bytes and keeps
 * them.
 *
 * So the tail of every section is kept when a file is opened, and on save the lists the
 * saved section lacks are put back among the ones it has, in their original order. What
 * the engine does not write it cannot save, whatever the editor did to it, so the bytes of
 * the opened file are the best there is for those lists; a list the engine did write is
 * left as the engine wrote it. A memo is put back only while the document still holds the
 * field it hangs on: the user may have deleted that text. (Memos sit after the last
 * section, whichever section their field is in.) What the lists refer to by position
 * (shapes, fonts, pictures in DocInfo) must still be at the same position in the saved
 * file; when that cannot be shown, nothing is put back.
 *
 * This is the one place the module touches bytes the engine serialized (decision 0012).
 */

const ID_MAPPINGS = 17
const FACE_NAME = 19
const MEMO_LIST = 93
/** DocInfo records the body refers to by their position among records of the same tag */
const FIRST_ID_TAG = 18
const LAST_ID_TAG = 26
/** Fonts are numbered within their language; ID_MAPPINGS counts them from its second number. */
const FONT_LANGUAGES = 7
/** How a memo's field in the body starts, in the text of its command: MEMO/<n>/<memo number>/ */
const MEMO_COMMAND = Buffer.from('MEMO/', 'utf16le')
const MAX_COMMAND_DIGITS = 12
/** A master page's list header: paragraph count, properties, width and height come first. */
const MASTER_PAGE_KIND_AT = 16

/** One list after the body: a master page or a memo, with everything below it. */
interface TailList {
  /**
   * what tells it from the other lists of its section, however its content was rewritten:
   * a memo's number, or what a master page's header says after its sizes (which pages it
   * is for)
   */
  key: string
  bytes: Buffer
  /** for a memo, the number the field in the body names it by */
  memo?: number
}

/** What is kept of an opened file to put its section tails back on save. */
export interface SectionTails {
  /** number of body sections of the opened file */
  sections: number
  /** the lists after the last paragraph, by section index; only sections that have any */
  tails: Map<number, TailList[]>
  /** a digest of each DocInfo record the body can refer to, in order, by kind */
  ids: Map<string, string[]>
  /** names of the binary data streams (pictures) of the opened file */
  binData: string[]
}

export type RestoreSkip = 'unreadable' | 'sections' | 'ids' | 'bin-data'

export interface RestoreResult {
  /** the bytes to write: the saved bytes themselves when nothing was put back */
  bytes: Uint8Array
  /** lists that were put back */
  restored: number
  /** lists were missing and were not put back, and why */
  skipped?: RestoreSkip
}

interface SectionTail {
  /** where the body ends in the stream */
  bodyEnd: number
  lists: TailList[]
}

/** Adds the numbers of the memos a section has a field for. */
function memosAnchoredIn(body: Buffer, found: Set<number>): void {
  let at = body.indexOf(MEMO_COMMAND)
  while (at >= 0) {
    // two numbers, each closed by a slash, in two-byte characters; the second is the memo's
    let cursor = at + MEMO_COMMAND.length
    const numbers: number[] = []
    while (numbers.length < 2) {
      let digits = ''
      while (digits.length <= MAX_COMMAND_DIGITS && cursor + 1 < body.length) {
        const unit = body.readUInt16LE(cursor)
        if (unit < 0x30 || unit > 0x39) break
        digits += String.fromCharCode(unit)
        cursor += 2
      }
      if (!digits || cursor + 1 >= body.length || body.readUInt16LE(cursor) !== 0x2f) break
      numbers.push(Number(digits))
      cursor += 2
    }
    if (numbers.length === 2) found.add(numbers[1]!)
    at = body.indexOf(MEMO_COMMAND, at + MEMO_COMMAND.length)
  }
}

/**
 * The lists after the body of a section. Null when what follows the last paragraph is
 * something else than master pages and memos: then the section is left alone.
 */
function tailOf(data: Buffer, records: HwpRecord[]): SectionTail | null {
  let lastBody = -1
  for (let index = records.length - 1; index >= 0; index--) {
    const record = records[index]!
    if (record.tag === PARA_HEADER && record.level === 0) {
      lastBody = index
      break
    }
  }
  if (lastBody < 0) return { bodyEnd: data.length, lists: [] }
  // the paragraph's own records are one level below it: its text, shapes and controls
  let first = lastBody + 1
  while (first < records.length) {
    const record = records[first]!
    if (record.level === 1 && (record.tag < PARA_TEXT || record.tag > CTRL_HEADER)) break
    first++
  }
  if (first === records.length) return { bodyEnd: data.length, lists: [] }

  const lists: TailList[] = []
  let index = first
  while (index < records.length) {
    const head = records[index]!
    if (head.level !== 1) return null
    let next = index + 1
    let memo: number | undefined
    if (head.tag === MEMO_LIST) {
      const list = records[next]
      if (!list || list.level !== 1 || list.tag !== LIST_HEADER) return null
      if (head.end - head.body < 4) return null
      memo = data.readUInt32LE(head.body)
      next++
    } else if (head.tag !== LIST_HEADER) {
      return null
    }
    const key =
      memo === undefined
        ? `page:${data.toString('hex', Math.min(head.body + MASTER_PAGE_KIND_AT, head.end), head.end)}`
        : `memo:${memo}`
    // everything up to the next list belongs to this one
    while (next < records.length) {
      const record = records[next]!
      if (record.level === 0) return null
      if (record.level === 1 && (record.tag === LIST_HEADER || record.tag === MEMO_LIST)) break
      next++
    }
    const end = next < records.length ? records[next]!.start : data.length
    lists.push({
      key,
      bytes: Buffer.from(data.subarray(head.start, end)),
      ...(memo === undefined ? {} : { memo }),
    })
    index = next
  }
  return { bodyEnd: records[first]!.start, lists }
}

/**
 * Digests of the DocInfo records the body refers to by number, in order, by kind. Fonts
 * are numbered within their language, so each language is a kind of its own.
 */
function idsOf(opened: OpenedHwp): Map<string, string[]> | null {
  const data = streamOf(opened, DOC_INFO)
  const records = data ? recordsOf(data) : null
  if (!data || !records) return null
  const mappings = records.find((record) => record.tag === ID_MAPPINGS)
  if (!mappings) return null
  const payload = data.subarray(mappings.body, mappings.end)
  if (payload.length < 4 * (1 + FONT_LANGUAGES)) return null
  // the font of position n belongs to the language whose count covers n
  const fontLanguage: number[] = []
  for (let language = 0; language < FONT_LANGUAGES; language++) {
    const count = payload.readInt32LE(4 * (1 + language))
    if (count < 0 || count > records.length) return null
    for (let n = 0; n < count; n++) fontLanguage.push(language)
  }
  const ids = new Map<string, string[]>()
  let fonts = 0
  for (const record of records) {
    if (record.tag < FIRST_ID_TAG || record.tag > LAST_ID_TAG) continue
    let kind = String(record.tag)
    if (record.tag === FACE_NAME) {
      const language = fontLanguage[fonts++]
      if (language === undefined) return null
      kind = `font${language}`
    }
    const digest = createHash('sha1').update(data.subarray(record.start, record.end)).digest('hex')
    const list = ids.get(kind)
    if (list) list.push(digest)
    else ids.set(kind, [digest])
  }
  if (fonts !== fontLanguage.length) return null
  return ids
}

const binDataOf = (opened: OpenedHwp): string[] =>
  opened.cfb.FullPaths.filter((path) => /\/BinData\/[^/]+$/.test(path)).map((path) =>
    path.slice(path.lastIndexOf('/') + 1).toLowerCase(),
  )

/**
 * The section tails of a file as it was opened; null when it has none to keep (the common
 * case), is not an HWP 5 file, or cannot be read here. Never throws: opening a document
 * does not depend on this.
 */
export function sectionTailsOf(file: Uint8Array): SectionTails | null {
  try {
    const opened = openHwp(file)
    if (!opened) return null
    const sections = sectionCount(opened)
    const tails = new Map<number, TailList[]>()
    for (let index = 0; index < sections; index++) {
      const data = streamOf(opened, SECTION(index))
      const records = data ? recordsOf(data) : null
      if (!data || !records) return null
      const tail = tailOf(data, records)
      if (tail && tail.lists.length > 0) tails.set(index, tail.lists)
    }
    if (tails.size === 0) return null
    const ids = idsOf(opened)
    if (!ids) return null
    return { sections, tails, ids, binData: binDataOf(opened) }
  } catch {
    return null
  }
}

/** Every record the lists can refer to is where it was: the saved lists start with the kept ones. */
function idsKept(kept: Map<string, string[]>, saved: Map<string, string[]>): boolean {
  for (const [kind, digests] of kept) {
    const now = saved.get(kind) ?? []
    if (now.length < digests.length) return false
    if (!digests.every((digest, index) => now[index] === digest)) return false
  }
  return true
}

/**
 * The kept lists in their order, each one as the saved section has it when it has it.
 * Lists only the saved section has follow. A kept memo whose field is gone from the body
 * stays out. `missing` counts the lists put back.
 */
function mergeLists(
  kept: TailList[],
  saved: TailList[],
  anchored: () => Set<number>,
): { lists: TailList[]; missing: number } {
  const left = [...saved]
  const lists: TailList[] = []
  let missing = 0
  for (const list of kept) {
    const at = left.findIndex((candidate) => candidate.key === list.key)
    if (at >= 0) {
      lists.push(left.splice(at, 1)[0]!)
    } else if (list.memo === undefined || anchored().has(list.memo)) {
      lists.push(list)
      missing++
    }
  }
  return { lists: [...lists, ...left], missing }
}

/**
 * The saved bytes with the kept lists put back in the sections that lack them. The saved
 * bytes come back untouched when no section lacks one, and when putting them back cannot
 * be shown to be right (`skipped`). Never throws: a save does not fail on this.
 */
export function restoreSectionTails(saved: Uint8Array, kept: SectionTails): RestoreResult {
  const untouched = (skipped?: RestoreSkip): RestoreResult => ({
    bytes: saved,
    restored: 0,
    ...(skipped ? { skipped } : {}),
  })
  try {
    const opened = openHwp(saved)
    if (!opened) return untouched('unreadable')
    const due: { index: number; data: Buffer }[] = []
    let restored = 0
    // the memos that still have their field, looked up in every section the first time asked
    let anchored: Set<number> | null = null
    const memosAnchored = (): Set<number> => {
      if (anchored) return anchored
      anchored = new Set<number>()
      const count = sectionCount(opened)
      for (let index = 0; index < count; index++) {
        const section = streamOf(opened, SECTION(index))
        if (section) memosAnchoredIn(section, anchored)
      }
      return anchored
    }
    for (const [index, lists] of kept.tails) {
      const data = streamOf(opened, SECTION(index))
      const records = data ? recordsOf(data) : null
      const tail = data && records ? tailOf(data, records) : null
      if (!data || !tail) return untouched('unreadable')
      const merged = mergeLists(lists, tail.lists, memosAnchored)
      if (merged.missing === 0) continue
      restored += merged.missing
      due.push({
        index,
        data: Buffer.concat([
          data.subarray(0, tail.bodyEnd),
          ...merged.lists.map((list) => list.bytes),
        ]),
      })
    }
    if (due.length === 0) return untouched()
    if (sectionCount(opened) !== kept.sections) return untouched('sections')
    const ids = idsOf(opened)
    if (!ids) return untouched('unreadable')
    if (!idsKept(kept.ids, ids)) return untouched('ids')
    const binData = new Set(binDataOf(opened))
    if (!kept.binData.every((name) => binData.has(name))) return untouched('bin-data')

    // read back what will be written: the same streams as the engine wrote, each with the
    // same bytes, except the changed sections, which hold exactly what was meant
    const written = rewriteStreams(
      opened,
      new Map(due.map(({ index, data }) => [SECTION(index), data])),
    )
    if (!written) return untouched('unreadable')
    return {
      bytes: new Uint8Array(written.buffer, written.byteOffset, written.byteLength),
      restored,
    }
  } catch {
    return untouched('unreadable')
  }
}
