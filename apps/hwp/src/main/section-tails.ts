import { createHash } from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import * as CFB from 'cfb'

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

const SECTION = (index: number): string => `/BodyText/Section${index}`
const FILE_HEADER = '/FileHeader'
const DOC_INFO = '/DocInfo'
const SIGNATURE = 'HWP Document File'
/** FileHeader properties: the streams are deflated / encrypted / a distribution copy */
const COMPRESSED = 0x1
const ENCRYPTED = 0x2
const DISTRIBUTION = 0x4
const ID_MAPPINGS = 17
const FACE_NAME = 19
const PARA_HEADER = 66
const PARA_TEXT = 67
const CTRL_HEADER = 71
const LIST_HEADER = 72
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
/** A document has few sections; this only bounds the walk over a malformed container. */
const MAX_SECTIONS = 4096

interface HwpRecord {
  tag: number
  level: number
  start: number
  /** where its payload starts */
  body: number
  end: number
}

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

/** The records of a stream, or null when the bytes are not a whole list of records. */
function recordsOf(data: Buffer): HwpRecord[] | null {
  const out: HwpRecord[] = []
  let at = 0
  while (at < data.length) {
    if (at + 4 > data.length) return null
    const start = at
    const word = data.readUInt32LE(at)
    let size = word >>> 20
    at += 4
    if (size === 0xfff) {
      if (at + 4 > data.length) return null
      size = data.readUInt32LE(at)
      at += 4
    }
    const body = at
    at += size
    if (at > data.length) return null
    out.push({ tag: word & 0x3ff, level: (word >>> 10) & 0x3ff, start, body, end: at })
  }
  return out
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

interface OpenedHwp {
  cfb: CFB.CFB$Container
  compressed: boolean
}

/** A plain HWP 5 container, or null: not one, or one whose streams are not readable here. */
function openHwp(file: Uint8Array): OpenedHwp | null {
  const cfb = CFB.read(Buffer.from(file.buffer, file.byteOffset, file.byteLength), {
    type: 'buffer',
  })
  const header = CFB.find(cfb, FILE_HEADER)
  if (!header?.content || header.content.length < 40) return null
  const bytes = Buffer.from(header.content as Uint8Array)
  if (bytes.toString('latin1', 0, SIGNATURE.length) !== SIGNATURE) return null
  const flags = bytes.readUInt32LE(36)
  if (flags & (ENCRYPTED | DISTRIBUTION)) return null
  // a second copy of the body for viewing: which copy the engine reads is not known here
  if (cfb.FullPaths.some((path) => /\/ViewText\//i.test(path))) return null
  return { cfb, compressed: (flags & COMPRESSED) !== 0 }
}

function streamOf(opened: OpenedHwp, path: string): Buffer | null {
  const entry = CFB.find(opened.cfb, path)
  if (!entry?.content) return null
  const raw = Buffer.from(entry.content as Uint8Array)
  return opened.compressed ? inflateRawSync(raw) : raw
}

function sectionCount(opened: OpenedHwp): number {
  let count = 0
  while (count < MAX_SECTIONS && CFB.find(opened.cfb, SECTION(count))) count++
  return count
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

const SECTOR = 512
const MINI_SECTOR = 64
const FAT_PER_SECTOR = SECTOR / 4
const END_OF_CHAIN = 0xfffffffe
const FREE = 0xffffffff
/** FAT sectors the header itself lists; more are listed in a chain of sectors of their own */
const HEADER_FAT_SLOTS = 109
/** The library puts a stream of its own, by this name, into every container it writes. */
const LIBRARY_MARKER = 'Sh33tJ5'

/**
 * The container as a file. Two things the library does are undone, because the document
 * is the user's and rhwp must read it back whole:
 * - it adds a marker stream of its own unless it finds one. An unused entry by that name
 *   at the end of the directory is found, and dropped again before anything is written.
 * - it fills the unused entries of the sector tables with "end of chain" rather than
 *   "free". Hangul reads that; rhwp's strict reader does not, and falls back to a reader
 *   that leaves out the preview picture, the summary and the scripts on the next save.
 */
function writeContainer(cfb: CFB.CFB$Container): Buffer {
  cfb.FileIndex.push({ name: LIBRARY_MARKER, type: 0 } as CFB.CFB$Entry)
  cfb.FullPaths.push(cfb.FullPaths[0] + LIBRARY_MARKER)
  const file = CFB.write(cfb, { type: 'buffer' }) as Buffer
  const sectors = (file.length - SECTOR) / SECTOR
  const sectorAt = (index: number): number => SECTOR + index * SECTOR
  const freeFrom = (tableSectors: number[], used: number): void => {
    tableSectors.forEach((sector, nth) => {
      for (let slot = 0; slot < FAT_PER_SECTOR; slot++) {
        const at = sectorAt(sector) + slot * 4
        if (nth * FAT_PER_SECTOR + slot >= used && file.readUInt32LE(at) === END_OF_CHAIN) {
          file.writeUInt32LE(FREE, at)
        }
      }
    })
  }
  // the sectors of the FAT: the header lists the first ones, a chain of sectors the rest
  const fatSectors: number[] = []
  for (let slot = 0; slot < HEADER_FAT_SLOTS; slot++) {
    const sector = file.readUInt32LE(76 + slot * 4)
    if (sector < sectors) fatSectors.push(sector)
  }
  let more = file.readUInt32LE(68)
  for (let guard = 0; more < sectors && guard < sectors; guard++) {
    for (let slot = 0; slot < FAT_PER_SECTOR - 1; slot++) {
      const sector = file.readUInt32LE(sectorAt(more) + slot * 4)
      if (sector < sectors) fatSectors.push(sector)
    }
    more = file.readUInt32LE(sectorAt(more) + (FAT_PER_SECTOR - 1) * 4)
  }
  const next = (sector: number): number => {
    const table = fatSectors[Math.floor(sector / FAT_PER_SECTOR)]
    return table === undefined
      ? END_OF_CHAIN
      : file.readUInt32LE(sectorAt(table) + (sector % FAT_PER_SECTOR) * 4)
  }
  // the mini FAT is a chain in the FAT; the size of the root entry says how much of it is used
  const miniSectors: number[] = []
  let mini = file.readUInt32LE(60)
  for (let guard = 0; mini < sectors && guard < sectors; guard++) {
    miniSectors.push(mini)
    mini = next(mini)
  }
  const rootSize = file.readUInt32LE(sectorAt(file.readUInt32LE(48)) + 120)
  freeFrom(miniSectors, Math.ceil(rootSize / MINI_SECTOR))
  freeFrom(fatSectors, sectors)
  return file
}

/** The storages and streams of a container; its unused directory entries are not among them. */
const pathsOf = (opened: OpenedHwp): string[] =>
  opened.cfb.FullPaths.filter((_path, index) => opened.cfb.FileIndex[index]?.type !== 0)

/** The two containers hold the same streams with the same bytes; `changed` ones hold these. */
function sameStreams(before: OpenedHwp, after: OpenedHwp, changed: Map<string, Buffer>): boolean {
  const paths = pathsOf(before)
  const now = pathsOf(after)
  if (paths.length !== now.length || !paths.every((path) => now.includes(path))) return false
  const root = paths[0] ?? ''
  for (const path of paths) {
    // a storage holds no bytes of its own: that it is still there was checked above
    if (path.endsWith('/')) continue
    const name = `/${path.slice(root.length)}`
    const was = CFB.find(before.cfb, name)
    const is = CFB.find(after.cfb, name)
    if (!was || !is || was.type !== is.type) return false
    const meant = changed.get(name)
    if (meant) {
      const back = streamOf(after, name)
      if (!back || !back.equals(meant)) return false
    } else if (
      !Buffer.from((was.content ?? []) as Uint8Array).equals(
        Buffer.from((is.content ?? []) as Uint8Array),
      )
    ) {
      return false
    }
  }
  return true
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

    const changed = new Map<string, Buffer>()
    for (const { index, data } of due) {
      const entry = CFB.find(opened.cfb, SECTION(index))
      if (!entry) return untouched('unreadable')
      const content = opened.compressed ? deflateRawSync(data) : data
      entry.content = content
      entry.size = content.length
      changed.set(SECTION(index), data)
    }
    const written = writeContainer(opened.cfb)
    // read back what will be written: the same streams as the engine wrote, each with the
    // same bytes, except the changed sections, which hold exactly what was meant
    const check = openHwp(written)
    if (!check || !sameStreams(opened, check, changed)) return untouched('unreadable')
    return {
      bytes: new Uint8Array(written.buffer, written.byteOffset, written.byteLength),
      restored,
    }
  } catch {
    return untouched('unreadable')
  }
}
