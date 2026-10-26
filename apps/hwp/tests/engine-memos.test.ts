/**
 * The memo API of the vendored rhwp engine (vendor/rhwp-core/patches/0016):
 * reading Hancom memos, inserting/editing/removing them in a body paragraph,
 * a table cell and a text box, and keeping them across HWP/HWPX saves.
 *
 * `memo-source.hwp` is rhwp's public reproduction `samples/issue5866/memo_field_hwp5.hwp`
 * saved by Hancom Hangul: one memo ("수정", author CDC) whose field spans many
 * paragraphs. The other documents are built with the engine itself.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'
import { fieldKindsOf, restoreFieldKinds } from '../src/main/field-kinds'
import { sectionTailsOf, restoreSectionTails } from '../src/main/section-tails'
import { openHwp, recordsOf, SECTION, streamOf } from '../src/main/hwp5-file'

const require = createRequire(import.meta.url)
const FIXTURES = join(__dirname, 'fixtures')

beforeAll(async () => {
  const wasm = join(dirname(require.resolve('@rhwp/core')), 'rhwp_bg.wasm')
  await init({ module_or_path: readFileSync(wasm) })
})

interface Memo {
  id: number
  index: number
  author: string
  date: string | null
  text: string
  place: string
  sectionIndex: number
  paraIndex: number | null
  startCharIdx: number | null
  endCharIdx: number | null
  path: { type: string; controlIndex: number; cellIndex?: number; paraIndex: number }[] | null
  page: number
  editable: boolean
  readOnlyReason: string | null
}

interface MemoError {
  ok: false
  code: string
  message: string
}

const memos = (doc: HwpDocument): Memo[] => JSON.parse(doc.getMemoList()) as Memo[]

function open(name: string): HwpDocument {
  return new HwpDocument(new Uint8Array(readFileSync(join(FIXTURES, name))))
}

function blank(text: string): HwpDocument {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  doc.insertText(0, 0, 0, text)
  return doc
}

/** The engine throws the memo error envelope as a string. */
function errorOf(fn: () => unknown): MemoError {
  try {
    fn()
  } catch (thrown) {
    return JSON.parse(String(thrown)) as MemoError
  }
  throw new Error('the call was expected to fail')
}

const insert = (doc: HwpDocument, start: number, end: number, author: string, text: string) =>
  JSON.parse(doc.insertMemo(0, 0, start, end, JSON.stringify({ author, text }))) as {
    ok: true
    id: number
    index: number
  }

const insertAtPath = (
  doc: HwpDocument,
  section: number,
  para: number,
  path: string,
  start: number,
  end: number,
  author: string,
  text: string,
) =>
  JSON.parse(
    doc.insertMemoByPath(section, para, path, start, end, JSON.stringify({ author, text })),
  ) as { ok: true; id: number; index: number }

/** One entry of a zip, read through its central directory. */
function zipEntry(zip: Uint8Array, name: string): string {
  const buf = Buffer.from(zip)
  let end = buf.length - 22
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end -= 1
  let at = buf.readUInt32LE(end + 16)
  const count = buf.readUInt16LE(end + 10)
  for (let i = 0; i < count; i += 1) {
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    if (buf.toString('utf8', at + 46, at + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const data = buf.subarray(start, start + size)
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8')
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`no ${name}`)
}

/** Rewrite one entry of a zip, keeping every other entry as it was. */
function replaceZipEntry(zip: Uint8Array, name: string, content: string): Uint8Array {
  const src = Buffer.from(zip)
  let end = src.length - 22
  while (end >= 0 && src.readUInt32LE(end) !== 0x06054b50) end -= 1
  const count = src.readUInt16LE(end + 10)
  let at = src.readUInt32LE(end + 16)
  interface Entry {
    name: string
    flags: number
    method: number
    time: number
    date: number
    crc: number
    size: number
    rawSize: number
    data: Buffer
  }
  const entries: Entry[] = []
  for (let i = 0; i < count; i += 1) {
    const flags = src.readUInt16LE(at + 8)
    const method = src.readUInt16LE(at + 10)
    const time = src.readUInt16LE(at + 12)
    const date = src.readUInt16LE(at + 14)
    const crc = src.readUInt32LE(at + 16)
    const size = src.readUInt32LE(at + 20)
    const rawSize = src.readUInt32LE(at + 24)
    const nameLen = src.readUInt16LE(at + 28)
    const extraLen = src.readUInt16LE(at + 30)
    const commentLen = src.readUInt16LE(at + 32)
    const local = src.readUInt32LE(at + 42)
    const name = src.toString('utf8', at + 46, at + 46 + nameLen)
    const start = local + 30 + src.readUInt16LE(local + 26) + src.readUInt16LE(local + 28)
    entries.push({
      name,
      flags,
      method,
      time,
      date,
      crc,
      size,
      rawSize,
      data: src.subarray(start, start + size),
    })
    at += 46 + nameLen + extraLen + commentLen
  }

  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    let { method, crc, size, rawSize } = entry
    let data = entry.data
    if (entry.name === name) {
      const raw = Buffer.from(content, 'utf8')
      method = 8
      data = deflateRawSync(raw)
      size = data.length
      rawSize = raw.length
      crc = crc32(raw) >>> 0
    }
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(entry.flags, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(entry.time, 10)
    local.writeUInt16LE(entry.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(size, 18)
    local.writeUInt32LE(rawSize, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, nameBytes, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(entry.flags, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(entry.time, 12)
    central.writeUInt16LE(entry.date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(size, 20)
    central.writeUInt32LE(rawSize, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const centralOffset = offset
  for (const part of centralParts) offset += part.length

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(offset - centralOffset, 12)
  eocd.writeUInt32LE(centralOffset, 16)
  return new Uint8Array(Buffer.concat([...localParts, ...centralParts, eocd]))
}

function sectionOf(bytes: Uint8Array): Buffer {
  const opened = openHwp(bytes)
  expect(opened).not.toBeNull()
  const section = streamOf(opened!, SECTION(0))
  expect(section).not.toBeNull()
  return section!
}

const MEMO_END = Buffer.from([0x04, 0x00, 0x65, 0x6d, 0x25, 0x00])

/** Memo numbers carried by the HWP5 closing markers of a section. */
function memoEndNumbers(section: Buffer): number[] {
  const numbers: number[] = []
  let at = section.indexOf(MEMO_END)
  while (at >= 0) {
    numbers.push(section.readUInt16LE(at + 10))
    at = section.indexOf(MEMO_END, at + 2)
  }
  return numbers
}

/** The body paragraph that holds the memo's closing marker in the sample. */
function paragraphOfMemoEnd(section: Buffer): number {
  const records = recordsOf(section)
  expect(records).not.toBeNull()
  let paragraph = -1
  for (const record of records!) {
    if (record.tag === 66 && record.level === 0) paragraph += 1
    if (record.tag === 67 && section.subarray(record.body, record.end).includes(MEMO_END)) {
      return paragraph
    }
  }
  throw new Error('memo end paragraph not found')
}

/** A one-cell table in body paragraph 1. */
function tableDocument(): { doc: HwpDocument; path: string } {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  doc.insertText(0, 0, 0, 'title')
  doc.splitParagraph(0, 0, doc.getParagraphLength(0, 0))
  doc.pasteHtml(0, 1, 0, '<table><tr><td>cell text</td></tr></table>')
  return { doc, path: JSON.stringify([{ controlIndex: 0, cellIndex: 0, cellParaIndex: 0 }]) }
}

/** A text box in body paragraph 0 with the text `box text`. */
function textBoxDocument(): { doc: HwpDocument; path: string } {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  doc.insertText(0, 0, 0, 'anchor')
  const created = JSON.parse(
    doc.createShapeControl(
      JSON.stringify({
        sectionIdx: 0,
        paraIdx: 0,
        charOffset: 6,
        width: 8000,
        height: 3000,
        shapeType: 'textbox',
        textWrap: 'Square',
      }),
    ),
  ) as { controlIdx: number }
  const path = JSON.stringify([
    { controlIndex: created.controlIdx, cellIndex: 0, cellParaIndex: 0 },
  ])
  doc.insertTextInCellByPath(0, 0, path, 0, 'box text')
  return { doc, path }
}

describe('reading memos', () => {
  it('reads the Hancom HWP sample memo', () => {
    const doc = open('memo-source.hwp')
    const list = memos(doc)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      index: 1,
      author: 'CDC',
      date: null,
      text: '수정',
      place: 'body',
      sectionIndex: 0,
      editable: true,
      readOnlyReason: null,
    })
    expect(list[0]!.id).not.toBe(0)
    expect(list[0]!.paraIndex).toBe(256)
    // The memo spans paragraphs; the readable anchor is its opening character.
    expect(list[0]!.startCharIdx).toBe(0)
    expect(list[0]!.endCharIdx).toBe(0)
    expect(list[0]!.path).toBeNull()
    expect(list[0]!.page).toBeGreaterThan(0)
  })

  it('keeps the memo through a generated HWPX round-trip', () => {
    const doc = open('memo-source.hwp')
    const before = memos(doc)[0]!
    const reopened = new HwpDocument(doc.exportHwpx())
    const after = memos(reopened)[0]!
    expect(after).toMatchObject({
      index: before.index,
      author: before.author,
      text: before.text,
      place: before.place,
      sectionIndex: before.sectionIndex,
      startCharIdx: before.startCharIdx,
      endCharIdx: before.endCharIdx,
      editable: before.editable,
    })
    expect(after.id).toBe(before.id)
  })

  it('keeps the memo through HWP and HWPX saves and across formats', () => {
    const doc = open('memo-source.hwp')
    const body = memos(doc)[0]!
    const hwp = new HwpDocument(doc.exportHwp())
    expect(memos(hwp)[0]).toMatchObject({ author: 'CDC', text: '수정', index: 1 })
    const hwpx = new HwpDocument(doc.exportHwpx())
    expect(memos(hwpx)[0]).toMatchObject({ author: 'CDC', text: '수정', index: 1 })
    const back = new HwpDocument(hwpx.exportHwp())
    expect(memos(back)[0]).toMatchObject({ author: 'CDC', text: '수정', index: 1 })
    expect(body.text).toBe('수정')
  })

  it('writes the memo number into the HWP5 closing marker after HWPX', () => {
    const doc = open('memo-source.hwp')
    const throughHwpx = new HwpDocument(doc.exportHwpx()).exportHwp()
    const numbers = memoEndNumbers(sectionOf(throughHwpx))
    expect(numbers).toContain(1)
    expect(numbers).not.toContain(0)
  })

  it('orders a range-less memo before a ranged memo in the same paragraph', () => {
    const doc = open('memo-source.hwp')
    const multi = memos(doc)[0]!
    JSON.parse(doc.insertMemo(0, multi.paraIndex!, 3, 5, JSON.stringify({ text: 'ranged' })))
    const list = memos(doc)
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ text: '수정', startCharIdx: 0, endCharIdx: 0 })
    expect(list[1]).toMatchObject({ text: 'ranged', startCharIdx: 3, endCharIdx: 5 })
  })
})

describe('editing memos', () => {
  it('inserts, edits and removes a body memo', () => {
    const doc = blank('hello world')
    const created = insert(doc, 0, 5, 'tester', 'first\nsecond')
    expect(created.index).toBe(1)
    expect(created.id).not.toBe(0)
    let list = memos(doc)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: created.id,
      index: 1,
      author: 'tester',
      text: 'first\nsecond',
      place: 'body',
      paraIndex: 0,
      startCharIdx: 0,
      endCharIdx: 5,
      editable: true,
      readOnlyReason: null,
    })

    expect(JSON.parse(doc.setMemoText(created.id, '바뀐 글\n\n끝\n'))).toEqual({ ok: true })
    expect(doc.pageCount()).toBe(1)
    list = memos(doc)
    expect(list[0]).toMatchObject({
      author: 'tester',
      date: null,
      text: '바뀐 글\n\n끝\n',
      editable: true,
    })
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(memos(new HwpDocument(bytes))[0]).toMatchObject({
        author: 'tester',
        text: '바뀐 글\n\n끝\n',
      })
    }

    // A zero-length anchor at the end of the text.
    const anchor = insert(doc, 11, 11, '', 'empty anchor')
    expect(memos(doc)[1]).toMatchObject({
      id: anchor.id,
      startCharIdx: 11,
      endCharIdx: 11,
    })

    expect(JSON.parse(doc.removeMemo(created.id))).toEqual({ ok: true })
    expect(JSON.parse(doc.removeMemo(anchor.id))).toEqual({ ok: true })
    expect(memos(doc)).toEqual([])
    expect(JSON.parse(doc.getTextFileUnicode())).toContain('hello world')
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(memos(new HwpDocument(bytes))).toEqual([])
    }
  })

  it('keeps a memo when its whole anchor is replaced with text', () => {
    for (const [replacement, endCharIdx] of [
      ['HELLO', 5],
      ['hi', 2],
      ['HELLOOOO', 8],
    ] as const) {
      const doc = blank('hello')
      const created = insert(doc, 0, 5, 'tester', 'memo body')
      expect(JSON.parse(doc.replaceText(0, 0, 0, 5, replacement))).toMatchObject({ ok: true })
      const list = memos(doc)
      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({
        id: created.id,
        author: 'tester',
        text: 'memo body',
        startCharIdx: 0,
        endCharIdx,
      })
      for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
        expect(memos(new HwpDocument(bytes))[0]).toMatchObject({
          id: created.id,
          author: 'tester',
          text: 'memo body',
          startCharIdx: 0,
          endCharIdx,
        })
      }
    }
  })

  it('removes a memo when its whole anchor is replaced with empty text', () => {
    const doc = blank('hello')
    insert(doc, 0, 5, 'tester', 'memo body')
    expect(JSON.parse(doc.replaceText(0, 0, 0, 5, ''))).toMatchObject({ ok: true })
    expect(memos(doc)).toEqual([])
  })

  it('keeps a memo when text inside its anchor is replaced', () => {
    const doc = blank('hello')
    const created = insert(doc, 0, 5, 'tester', 'memo body')
    expect(JSON.parse(doc.replaceText(0, 0, 1, 3, 'ipp'))).toMatchObject({ ok: true })
    expect(JSON.parse(doc.getTextFileUnicode())).toContain('hippo')
    expect(memos(doc)[0]).toMatchObject({
      id: created.id,
      author: 'tester',
      text: 'memo body',
      startCharIdx: 0,
      endCharIdx: 5,
    })
  })

  it('keeps a memo through replaceAll', () => {
    const doc = blank('hello')
    const created = insert(doc, 0, 5, 'tester', 'memo body')
    expect(JSON.parse(doc.replaceAll('hello', 'HELLO', true))).toMatchObject({ ok: true })
    expect(memos(doc)[0]).toMatchObject({
      id: created.id,
      author: 'tester',
      text: 'memo body',
      startCharIdx: 0,
      endCharIdx: 5,
    })
  })

  it('removes a memo through replaceAll with empty text', () => {
    const doc = blank('hello')
    insert(doc, 0, 5, 'tester', 'memo body')
    expect(JSON.parse(doc.replaceAll('hello', '', true))).toMatchObject({ ok: true })
    expect(memos(doc)).toEqual([])
  })

  it('replaces a cell memo anchor without removing the memo', () => {
    const { doc, path } = tableDocument()
    const created = insertAtPath(doc, 0, 1, path, 0, 4, 'cell author', 'cell memo')
    expect(
      JSON.parse(doc.replaceTextInCellDeferredPagination(0, 1, 0, 0, 0, 0, 4, 'CELL')),
    ).toMatchObject({ ok: true })
    expect(memos(doc)[0]).toMatchObject({
      id: created.id,
      author: 'cell author',
      text: 'cell memo',
      place: 'tableCell',
      startCharIdx: 0,
      endCharIdx: 4,
    })
  })

  it('replaces a text-box memo anchor without removing the memo', () => {
    const { doc, path } = textBoxDocument()
    const controlIndex = (JSON.parse(path) as { controlIndex: number }[])[0]!.controlIndex
    const created = insertAtPath(doc, 0, 0, path, 0, 3, 'box author', 'box memo')
    expect(
      JSON.parse(
        doc.replaceTextInCellDeferredPagination(0, 0, controlIndex, 0, 0, 0, 3, 'BOXX'),
      ),
    ).toMatchObject({ ok: true })
    expect(memos(doc)[0]).toMatchObject({
      id: created.id,
      author: 'box author',
      text: 'box memo',
      place: 'textBox',
      startCharIdx: 0,
      endCharIdx: 4,
    })
  })

  it('does not remove a non-memo field when its whole text is replaced', () => {
    const doc = blank('hello')
    doc.insertClickHereField(0, 0, 0, 'guide', '', 'name', false)
    const before = JSON.parse(doc.getFieldList()) as { fieldId: number }[]
    expect(before).toHaveLength(1)
    doc.replaceText(0, 0, 0, 5, 'HELLO')
    const after = JSON.parse(doc.getFieldList()) as { fieldId: number }[]
    expect(after).toHaveLength(1)
    expect(after[0]!.fieldId).toBe(before[0]!.fieldId)
  })

  it('deletes a body memo when its whole anchor text is deleted', () => {
    const doc = blank('hello world')
    insert(doc, 0, 5, 'tester', 'memo body')
    expect(JSON.parse(doc.deleteText(0, 0, 0, 5))).toMatchObject({ ok: true })
    expect(memos(doc)).toEqual([])
    expect(JSON.parse(doc.getTextFileUnicode())).toContain(' world')
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(memos(new HwpDocument(bytes))).toEqual([])
    }
  })

  it('deletes a body memo through deleteRange', () => {
    const doc = blank('hello world')
    insert(doc, 0, 5, 'tester', 'memo body')
    expect(JSON.parse(doc.deleteRange(0, 0, 0, 0, 5))).toMatchObject({ ok: true })
    expect(memos(doc)).toEqual([])
  })

  it('keeps a memo whose anchor text is only partly deleted', () => {
    const doc = blank('hello world')
    const created = insert(doc, 0, 5, 'tester', 'memo body')
    doc.deleteText(0, 0, 1, 2)
    const list = memos(doc)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: created.id,
      text: 'memo body',
      startCharIdx: 0,
      endCharIdx: 3,
    })
  })

  it('deletes a table-cell memo when its whole anchor text is deleted', () => {
    const { doc, path } = tableDocument()
    insertAtPath(doc, 0, 1, path, 0, 4, 'cell author', 'cell memo')
    expect(JSON.parse(doc.deleteTextInCell(0, 1, 0, 0, 0, 0, 4))).toMatchObject({ ok: true })
    expect(memos(doc)).toEqual([])
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(memos(new HwpDocument(bytes))).toEqual([])
    }
  })

  it('deletes a text-box memo when its whole anchor text is deleted', () => {
    const { doc, path } = textBoxDocument()
    insertAtPath(doc, 0, 0, path, 0, 3, 'box author', 'box memo')
    expect(JSON.parse(doc.deleteTextInCellByPath(0, 0, path, 0, 3))).toMatchObject({ ok: true })
    expect(memos(doc)).toEqual([])
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(memos(new HwpDocument(bytes))).toEqual([])
    }
  })

  it('does not delete a non-memo field when its text is deleted', () => {
    const doc = blank('hello')
    doc.insertClickHereField(0, 0, 0, 'guide', '', 'name', false)
    expect(JSON.parse(doc.getFieldList())).toHaveLength(1)
    doc.deleteText(0, 0, 0, 5)
    expect(JSON.parse(doc.getFieldList())).toHaveLength(1)
  })

  it('inserts, edits and removes a memo in a table cell', () => {
    const { doc, path } = tableDocument()
    const created = insertAtPath(doc, 0, 1, path, 0, 4, 'cell author', 'cell memo')
    expect(memos(doc)[0]).toMatchObject({
      id: created.id,
      index: 1,
      author: 'cell author',
      text: 'cell memo',
      place: 'tableCell',
      sectionIndex: 0,
      paraIndex: 1,
      startCharIdx: 0,
      endCharIdx: 4,
      path: [{ type: 'cell', controlIndex: 0, cellIndex: 0, paraIndex: 0 }],
      editable: true,
    })
    expect(JSON.parse(doc.setMemoText(created.id, '칸 메모\n둘째 줄'))).toEqual({ ok: true })
    expect(doc.pageCount()).toBe(1)
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(memos(new HwpDocument(bytes))[0]).toMatchObject({
        author: 'cell author',
        text: '칸 메모\n둘째 줄',
        place: 'tableCell',
      })
    }
    expect(JSON.parse(doc.removeMemo(created.id))).toEqual({ ok: true })
    expect(memos(doc)).toEqual([])
    expect(memos(new HwpDocument(doc.exportHwp()))).toEqual([])
  })

  it('inserts, edits and removes a memo in a text box', () => {
    const { doc, path } = textBoxDocument()
    const created = insertAtPath(doc, 0, 0, path, 0, 3, 'box author', 'box memo')
    const memo = memos(doc)[0]!
    expect(memo).toMatchObject({
      id: created.id,
      author: 'box author',
      text: 'box memo',
      place: 'textBox',
      sectionIndex: 0,
      paraIndex: 0,
      startCharIdx: 0,
      endCharIdx: 3,
      editable: true,
    })
    expect(memo.path).toEqual([
      { type: 'textbox', controlIndex: JSON.parse(path)[0].controlIndex, paraIndex: 0 },
    ])
    expect(JSON.parse(doc.setMemoText(created.id, '상자 메모'))).toEqual({ ok: true })
    expect(doc.pageCount()).toBe(1)
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(memos(new HwpDocument(bytes))[0]).toMatchObject({
        author: 'box author',
        text: '상자 메모',
        place: 'textBox',
      })
    }
    expect(JSON.parse(doc.removeMemo(created.id))).toEqual({ ok: true })
    expect(memos(doc)).toEqual([])
    expect(memos(new HwpDocument(doc.exportHwpx()))).toEqual([])
  })

  it('keeps a non-memo multi-paragraph field end after editing', () => {
    const doc = blank('first')
    doc.splitParagraph(0, 0, doc.getParagraphLength(0, 0))
    doc.insertText(0, 1, 0, 'second')
    const hwpx = doc.exportHwpx()
    let xml = zipEntry(hwpx, 'Contents/section0.xml')

    const firstStart = xml.indexOf('<hp:p ')
    const firstEnd = xml.indexOf('</hp:p>', firstStart)
    const secondStart = xml.indexOf('<hp:p ', firstEnd)
    const secondRunEnd = xml.indexOf('</hp:run>', secondStart)
    expect(secondRunEnd).toBeGreaterThan(secondStart)
    xml =
      xml.slice(0, secondRunEnd) +
      '<hp:ctrl><hp:fieldEnd beginIDRef="777"/></hp:ctrl>' +
      xml.slice(secondRunEnd)
    const firstRunEnd = xml.indexOf('</hp:run>', firstStart)
    expect(firstRunEnd).toBeGreaterThan(firstStart)
    xml =
      xml.slice(0, firstRunEnd) +
      '<hp:ctrl><hp:fieldBegin id="777" type="CLICK_HERE" name="" editable="0" dirty="0"/></hp:ctrl>' +
      xml.slice(firstRunEnd)

    const opened = new HwpDocument(replaceZipEntry(hwpx, 'Contents/section0.xml', xml))
    // A change forces the section to be written from the model.
    opened.insertText(0, 1, 0, 'X')
    const section = sectionOf(opened.exportHwp())
    // Generic HWP5 closing marker for `%clk`.
    expect(section.includes(Buffer.from([0x04, 0x00, 0x6b, 0x6c, 0x63, 0x25]))).toBe(true)
  })

  it('keeps HWPX header, footer and note memo bodies through HWP', () => {
    const places = HwpDocument.createEmpty()
    places.createBlankDocument()
    places.insertText(0, 0, 0, 'body')
    places.createHeaderFooter(0, true, 0)
    places.createHeaderFooter(0, false, 0)
    places.insertTextInHeaderFooter(0, true, 0, 0, 0, 'header text')
    places.insertTextInHeaderFooter(0, false, 0, 0, 0, 'footer text')
    const footnote = JSON.parse(places.insertFootnote(0, 0, 0)) as { controlIdx: number }
    places.insertTextInFootnote(0, 0, footnote.controlIdx, 0, 0, 'footnote text')
    const endnote = JSON.parse(places.insertEndnote(0, 0, 0)) as { controlIdx: number }
    places.insertTextInFootnote(0, 0, endnote.controlIdx, 0, 0, 'endnote text')

    const hwpx = places.exportHwpx()
    let xml = zipEntry(hwpx, 'Contents/section0.xml')

    const memoDoc = blank('anchor')
    insert(memoDoc, 0, 6, 'ctx', 'header memo body')
    const memoXml = zipEntry(memoDoc.exportHwpx(), 'Contents/section0.xml')
    const beginStart = memoXml.indexOf('<hp:fieldBegin')
    const beginEnd = memoXml.indexOf('</hp:fieldBegin>', beginStart) + '</hp:fieldBegin>'.length
    expect(beginStart).toBeGreaterThanOrEqual(0)
    const beginTemplate = memoXml.slice(beginStart, beginEnd)

    let fieldId = 900_000
    const inject = (source: string, tag: string, marker: string): string => {
      const start = source.indexOf(`<hp:${tag} `)
      const end = source.indexOf(`</hp:${tag}>`, start)
      expect(start).toBeGreaterThanOrEqual(0)
      expect(end).toBeGreaterThan(start)
      const block = source.slice(start, end)
      const markerAt = block.indexOf(`<hp:t>${marker}</hp:t>`)
      expect(markerAt).toBeGreaterThanOrEqual(0)
      const runEnd = block.indexOf('</hp:run>', markerAt)
      expect(runEnd).toBeGreaterThanOrEqual(0)
      const at = start + runEnd + '</hp:run>'.length
      const id = fieldId++
      const begin = beginTemplate.replace(/ id="\d+"/, ` id="${id}"`)
      return (
        source.slice(0, at) +
        `<hp:ctrl>${begin}</hp:ctrl>` +
        '<hp:run charPrIDRef="0"><hp:t> anchor</hp:t></hp:run>' +
        `<hp:ctrl><hp:fieldEnd beginIDRef="${id}"/></hp:ctrl>` +
        source.slice(at)
      )
    }

    xml = inject(xml, 'header', 'header text')
    xml = inject(xml, 'footer', 'footer text')
    xml = inject(xml, 'footNote', 'footnote text')
    xml = inject(xml, 'endNote', 'endnote text')

    const doc = new HwpDocument(replaceZipEntry(hwpx, 'Contents/section0.xml', xml))
    const placesSeen = ['header', 'footer', 'footnote', 'endnote'].sort()
    const before = memos(doc)
    expect(before).toHaveLength(4)
    expect(before.map((memo) => memo.place).sort()).toEqual(placesSeen)
    for (const memo of before) {
      expect(memo).toMatchObject({
        text: 'header memo body',
        editable: false,
        readOnlyReason: 'unsupported_place',
      })
    }

    const reopened = new HwpDocument(doc.exportHwp())
    const after = memos(reopened)
    expect(after).toHaveLength(4)
    expect(after.map((memo) => memo.place).sort()).toEqual(placesSeen)
    for (const memo of after) {
      expect(memo).toMatchObject({
        text: 'header memo body',
        editable: false,
        readOnlyReason: 'unsupported_place',
      })
    }
  })

  it('removes a memo that spans paragraphs and keeps its anchor text', () => {
    const doc = open('memo-source.hwp')
    const memo = memos(doc)[0]!
    const pages = doc.pageCount()
    expect(JSON.parse(doc.removeMemo(memo.id))).toEqual({ ok: true })
    expect(memos(doc)).toEqual([])
    expect(doc.pageCount()).toBe(pages)
    expect(JSON.parse(doc.getTextFileUnicode())).toContain('4. 코로나19')
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      const reopened = new HwpDocument(bytes)
      expect(memos(reopened)).toEqual([])
      expect(JSON.parse(reopened.getTextFileUnicode())).toContain('4. 코로나19')
    }
  })

  it('drops a copied multi-paragraph memo anchor when its closing paragraph is outside the selection', () => {
    const doc = open('memo-source.hwp')
    const memo = memos(doc)[0]!
    const last = doc.getParagraphCount(0) - 1
    doc.splitParagraph(0, last, doc.getParagraphLength(0, last))
    const target = doc.getParagraphCount(0) - 1
    doc.insertText(0, target, 0, 'target ')
    doc.copySelection(0, memo.paraIndex!, 0, memo.paraIndex!, 1_000_000)
    const pasted = JSON.parse(doc.pasteInternal(0, target, 7)) as { containsField: boolean }
    expect(pasted.containsField).toBe(false)
    expect(memos(doc)).toHaveLength(1)
    const reopened = new HwpDocument(doc.exportHwp())
    expect(memos(reopened)).toHaveLength(1)
  })

  it('copies and pastes a complete multi-paragraph memo with a new number and end marker', () => {
    const doc = open('memo-source.hwp')
    const memo = memos(doc)[0]!
    const endPara = paragraphOfMemoEnd(sectionOf(readFileSync(join(FIXTURES, 'memo-source.hwp'))))
    const last = doc.getParagraphCount(0) - 1
    doc.splitParagraph(0, last, doc.getParagraphLength(0, last))
    const target = doc.getParagraphCount(0) - 1
    doc.insertText(0, target, 0, 'target ')
    doc.copySelection(0, memo.paraIndex!, 0, endPara, 1_000_000)
    const pasted = JSON.parse(doc.pasteInternal(0, target, 7)) as { containsField: boolean }
    expect(pasted.containsField).toBe(true)
    const list = memos(doc)
    expect(list).toHaveLength(2)
    const copied = list.find((entry) => entry.paraIndex === target)!
    expect(copied).toMatchObject({
      author: 'CDC',
      text: '수정',
      place: 'body',
      editable: true,
    })
    expect(copied.index).toBe(2)
    expect(copied.id).not.toBe(memo.id)
    const numbers = memoEndNumbers(sectionOf(doc.exportHwp()))
    expect(numbers.filter((number) => number === 1)).toHaveLength(1)
    expect(numbers.filter((number) => number === 2)).toHaveLength(1)
    const reopened = new HwpDocument(doc.exportHwp())
    expect(memos(reopened)).toHaveLength(2)
    expect(memos(reopened).map((entry) => entry.index).sort()).toEqual([1, 2])
  })

  it('marks a memo with mixed formatting read-only but still removes it', () => {
    const doc = blank('formatted')
    const created = insert(doc, 0, 3, 'fmt', 'old body')
    const hwpx = doc.exportHwpx()
    let xml = zipEntry(hwpx, 'Contents/section0.xml')
    const begin = xml.indexOf('type="MEMO"')
    const end = xml.indexOf('</hp:fieldBegin>', begin)
    expect(begin).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(begin)
    const block = xml.slice(begin, end)
    const run = '<hp:run charPrIDRef="0"><hp:t>old body</hp:t></hp:run>'
    expect(block).toContain(run)
    xml =
      xml.slice(0, begin) +
      block.replace(
        run,
        '<hp:run charPrIDRef="0"><hp:t>old </hp:t></hp:run>' +
          '<hp:run charPrIDRef="1"><hp:t>body</hp:t></hp:run>',
      ) +
      xml.slice(end)
    const reopened = new HwpDocument(replaceZipEntry(hwpx, 'Contents/section0.xml', xml))
    const memo = memos(reopened)[0]!
    expect(memo.id).toBe(created.id)
    expect(memo.editable).toBe(false)
    expect(memo.readOnlyReason).toBe('formatted')
    expect(errorOf(() => reopened.setMemoText(memo.id, 'new')).code).toBe('memo_read_only')
    expect(JSON.parse(reopened.removeMemo(memo.id))).toEqual({ ok: true })
  })

  it('copies and pastes a memo with a new id and number', () => {
    const doc = blank('source text')
    doc.splitParagraph(0, 0, doc.getParagraphLength(0, 0))
    doc.insertText(0, 1, 0, 'target ')
    const created = insert(doc, 0, 6, 'copier', 'copy body')
    doc.copySelection(0, 0, 0, 0, doc.getParagraphLength(0, 0))
    const pasted = JSON.parse(doc.pasteInternal(0, 1, 7)) as { containsField: boolean }
    expect(pasted.containsField).toBe(true)
    const list = memos(doc)
    expect(list).toHaveLength(2)
    expect(list[1]).toMatchObject({
      author: 'copier',
      text: 'copy body',
      place: 'body',
      paraIndex: 1,
      startCharIdx: 7,
      endCharIdx: 13,
      editable: true,
    })
    expect(list[1]!.id).not.toBe(created.id)
    expect(list[1]!.index).toBe(2)
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      const reopened = memos(new HwpDocument(bytes))
      expect(reopened).toHaveLength(2)
      expect(new Set(reopened.map((memo) => memo.id)).size).toBe(2)
      expect(reopened.map((memo) => memo.index)).toEqual([1, 2])
    }
  })
})

describe('the engine writes Hancom memo identity', () => {
  it('writes %unk + %%me and a numbered MEMO_LIST in HWP', () => {
    const doc = blank('hello')
    const created = insert(doc, 0, 2, 'tester', 'memo body')
    const section = sectionOf(doc.exportHwp())
    const records = recordsOf(section)
    expect(records).not.toBeNull()

    const control = records!.find(
      (record) =>
        record.tag === 71 && record.level === 1 && section.readUInt32LE(record.body) === 0x25756e6b,
    )
    expect(control).toBeDefined()
    const commandLength = section.readUInt16LE(control!.body + 4 + 4 + 1)
    const command = section
      .subarray(control!.body + 4 + 4 + 1 + 2, control!.body + 4 + 4 + 1 + 2 + commandLength * 2)
      .toString('utf16le')
    expect(command).toMatch(/^MEMO\/65535\/1\//)
    expect(command).toContain('/tester/\\;;')

    // Hancom's opening character is %%me even though the control record is %unk.
    expect(
      section.includes(Buffer.from([0x03, 0x00, 0x65, 0x6d, 0x25, 0x25, 0x00, 0x00])),
    ).toBe(true)
    // ...and the closing marker is the memo-specific one with the memo number (1).
    expect(
      section.includes(
        Buffer.from([0x04, 0x00, 0x65, 0x6d, 0x25, 0x00, 0x01, 0xff, 0xff, 0x00, 0x01, 0x00]),
      ),
    ).toBe(true)

    const memoList = records!.find((record) => record.tag === 93 && record.level === 1)
    expect(memoList).toBeDefined()
    expect(section.readUInt32LE(memoList!.body)).toBe(created.index)

    const xml = zipEntry(doc.exportHwpx(), 'Contents/section0.xml')
    expect(xml).toContain('type="MEMO"')
    expect(xml).toContain('<hp:stringParam name="Author">tester</hp:stringParam>')
    expect(xml).toContain('<hp:integerParam name="Number">1</hp:integerParam>')
    expect(xml).toMatch(/<hp:subList[^>]*>[\s\S]*memo body/)
  })

  it('leaves the section-tail and field-kind workarounds alone', () => {
    const original = new Uint8Array(readFileSync(join(FIXTURES, 'memo-source.hwp')))
    const doc = new HwpDocument(original)
    const memo = memos(doc)[0]!
    doc.setMemoText(memo.id, '복구 본문')

    const kinds = fieldKindsOf(original)
    const tails = sectionTailsOf(original)
    expect(kinds).not.toBeNull()
    expect(tails).not.toBeNull()

    const kindResult = restoreFieldKinds(doc.exportHwp(), kinds!)
    expect(kindResult.restored).toBe(0)
    const tailResult = restoreSectionTails(kindResult.bytes, tails!)
    expect(tailResult.skipped).toBeUndefined()
    expect(tailResult.restored).toBe(0)

    const reopened = new HwpDocument(tailResult.bytes)
    expect(memos(reopened)[0]).toMatchObject({ author: 'CDC', text: '복구 본문', index: 1 })
  })

  it('saves a document without memos as before', () => {
    const original = new Uint8Array(readFileSync(join(FIXTURES, 'format-copy-table.hwp')))
    const doc = new HwpDocument(original)
    expect(doc.getMemoList()).toBe('[]')
    expect(Buffer.compare(Buffer.from(doc.exportHwp()), Buffer.from(original))).toBe(0)
  })
})

describe('memo errors', () => {
  const expectProtected = (doc: HwpDocument, id: number) => {
    const memo = memos(doc)[0]!
    expect(memo).toMatchObject({
      id,
      editable: false,
      readOnlyReason: 'protected',
      text: 'memo body',
    })
    expect(errorOf(() => doc.insertMemo(0, 0, 0, 0, '{}')).code).toBe('memo_read_only')
    expect(errorOf(() => doc.setMemoText(memo.id, 'new')).code).toBe('memo_read_only')
    expect(errorOf(() => doc.removeMemo(memo.id)).code).toBe('memo_read_only')
  }

  it('treats password-protected HWP documents as read-only', () => {
    const doc = blank('protected')
    const created = insert(doc, 0, 0, 'tester', 'memo body')
    const encrypted = doc.exportHwpWithPassword('secret')
    expectProtected(HwpDocument.openWithPassword(encrypted, 'secret'), created.id)
  })

  it('treats password-protected HWPX documents as read-only', () => {
    const doc = blank('protected')
    const created = insert(doc, 0, 0, 'tester', 'memo body')
    const encrypted = doc.exportHwpxWithPassword('secret')
    expectProtected(HwpDocument.openWithPassword(encrypted, 'secret'), created.id)
  })

  it('rejects missing paragraphs and paths as invalid ranges', () => {
    const doc = blank('abcdef')
    expect(errorOf(() => doc.insertMemo(99, 0, 0, 1, '{}')).code).toBe('memo_invalid_range')
    expect(errorOf(() => doc.insertMemo(0, 99, 0, 1, '{}')).code).toBe('memo_invalid_range')
    expect(errorOf(() => doc.insertMemoByPath(0, 0, 'not json', 0, 1, '{}')).code).toBe(
      'memo_invalid_range',
    )
    expect(errorOf(() => doc.insertMemoByPath(0, 0, '[]', 0, 1, '{}')).code).toBe(
      'memo_invalid_range',
    )
    expect(
      errorOf(() =>
        doc.insertMemoByPath(
          0,
          0,
          JSON.stringify([{ controlIndex: 0, cellIndex: 0, cellParaIndex: 0 }]),
          0,
          1,
          '{}',
        ),
      ).code,
    ).toBe('memo_invalid_range')
  })

  it('rejects overlapping ranges, bad ranges, long text and unknown ids', () => {
    const doc = blank('abcdef')
    expect(insert(doc, 1, 3, '', 'first').index).toBe(1)

    expect(errorOf(() => doc.insertMemo(0, 0, 2, 4, '{}')).code).toBe('memo_overlap')
    // A zero-length anchor on the boundary does not overlap.
    expect(insert(doc, 3, 3, '', 'boundary').index).toBe(2)
    expect(errorOf(() => doc.insertMemo(0, 0, 4, 2, '{}')).code).toBe('memo_invalid_range')
    // This API takes one paragraph; a range past its end is invalid.
    expect(errorOf(() => doc.insertMemo(0, 0, 2, 99, '{}')).code).toBe('memo_invalid_range')
    expect(
      errorOf(() => doc.insertMemo(0, 0, 6, 6, JSON.stringify({ text: '가'.repeat(100001) })))
        .code,
    ).toBe('memo_text_too_long')
    expect(
      errorOf(() => doc.insertMemo(0, 0, 6, 6, JSON.stringify({ author: '가'.repeat(65) }))).code,
    ).toBe('memo_invalid_author')
    expect(errorOf(() => doc.setMemoText(999, 'x')).code).toBe('memo_not_found')
    expect(errorOf(() => doc.removeMemo(999)).code).toBe('memo_not_found')
  })
})
