/**
 * Saving a book (spec §6, invariant §12.1). The zip is written anew:
 *
 * - `mimetype` first, stored, with no extra field; added when the original
 *   lacks it (its content is kept when it has one);
 * - every other entry in the original archive order, with its original date,
 *   compression method and, when unchanged, its original compressed bytes;
 * - an edited chapter is its original decoded text with only the given range
 *   replacements applied, encoded back with its original encoding and BOM;
 * - an EPUB 3 package document gets its `dcterms:modified` value set to the
 *   save time, as one more range replacement (or one inserted `meta` line).
 *   An EPUB 2 package document is never touched.
 *
 * Nothing is serialised from a tree. When no entry's text would change the
 * result says so and the caller must not write the file at all.
 */
import JSZip from 'jszip'
import { decodeEntryText, encodeEntryText, type EpubTextEncoding } from './encoding'
import { openEpub, type EpubOpenOptions } from './open'
import { normalizeZipPath } from './paths'
import { applyReplacements, validateReplacements, type RangeReplacement } from './ranges'
import { checkWellFormed, parseXml, type XmlElement } from './xml-positions'

/** Range replacements per entry path, each against that entry's decoded text. */
export type EpubChapterEdits =
  | ReadonlyMap<string, readonly RangeReplacement[]>
  | Readonly<Record<string, readonly RangeReplacement[]>>

export interface EpubSaveOptions extends EpubOpenOptions {
  /** the save time for `dcterms:modified`; the current time when left out */
  now?: () => Date
}

/**
 * Why a save was refused. Nothing is written in any of these cases.
 * - `not-opened`: the original bytes do not open as a book
 * - `unknown-entry`: an edit names a path the archive does not have
 * - `broken`: the entry was not well-formed (or not valid in its encoding) to
 *   begin with; such an entry is never edited
 * - `invalid-replacements`: the replacements overlap or fall outside the text
 * - `not-well-formed`: the entry is not well-formed after the replacements
 */
export type EpubSaveRefusalReason =
  'not-opened' | 'unknown-entry' | 'broken' | 'invalid-replacements' | 'not-well-formed'

export type EpubSaveResult =
  /** nothing changed: do not write the file */
  | { ok: true; changed: false }
  | {
      ok: true
      changed: true
      bytes: Uint8Array
      /** archive paths of the edited entries whose text changed, in archive order */
      changedChapters: string[]
    }
  | {
      ok: false
      reason: EpubSaveRefusalReason
      /** the entry the refusal is about; null for `not-opened` */
      path: string | null
      /** English, for the log; not for the screen */
      detail: string
    }

const MIMETYPE = 'mimetype'
const MIMETYPE_CONTENT = 'application/epub+zip'
const MODIFIED_PROPERTY = 'dcterms:modified'

type Compression = 'STORE' | 'DEFLATE'

/** JSZip keeps a loaded entry's compressed bytes here until it is replaced. */
interface LoadedData {
  compression?: { magic?: string }
}

const loadedData = (file: JSZip.JSZipObject): LoadedData | undefined =>
  (file as unknown as { _data?: LoadedData })._data

/**
 * What to hand JSZip for an unchanged entry: its loaded compressed data, which
 * JSZip copies through as is when the compression method stays the same, or
 * the content itself should that data not be there.
 */
async function unchangedData(file: JSZip.JSZipObject): Promise<Uint8Array> {
  const data = loadedData(file)
  if (data?.compression?.magic !== undefined) return data as Uint8Array
  return new Uint8Array(await file.async('uint8array'))
}

function compressionOf(file: JSZip.JSZipObject): Compression {
  return loadedData(file)?.compression?.magic === '\x00\x00' ? 'STORE' : 'DEFLATE'
}

/** `YYYY-MM-DDThh:mm:ssZ` in UTC, as `dcterms:modified` wants it. */
export function formatModifiedTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z')
}

const XML_ENTITY_NAMES = new Set(['amp', 'lt', 'gt', 'quot', 'apos'])

/**
 * Hides named references XML does not define (`&nbsp;` in a title) behind
 * filler of the same length, so the package can be read for positions only.
 */
function maskUndefinedEntities(text: string): string {
  return text.replace(/&([A-Za-z_][\w.-]*);/g, (match, name: string) =>
    XML_ENTITY_NAMES.has(name) ? match : 'x'.repeat(match.length),
  )
}

const prefixOf = (name: string): string => {
  const colon = name.indexOf(':')
  return colon < 0 ? '' : name.slice(0, colon + 1)
}

const elementChildren = (el: XmlElement): XmlElement[] =>
  el.children.filter((c): c is XmlElement => c.type === 'element')

const attribute = (el: XmlElement, name: string): string | undefined =>
  el.attributes.find((a) => a.name === name)?.value

/**
 * The range replacements that set an EPUB 3 package document's
 * `dcterms:modified` to `timestamp`: the value of each such `meta` that does
 * not refine another element, or one inserted `meta` line at the end of
 * `metadata` when there is none. Null when the package has no `metadata`.
 */
export function modifiedReplacements(
  opfText: string,
  timestamp: string,
): RangeReplacement[] | null {
  const parsed = parseXml(maskUndefinedEntities(opfText))
  if (!parsed.ok) return null
  const metadata = elementChildren(parsed.doc.root).find((el) => el.local === 'metadata')
  if (!metadata) return null

  const metas = elementChildren(metadata).filter(
    (el) =>
      el.local === 'meta' &&
      attribute(el, 'property')?.trim() === MODIFIED_PROPERTY &&
      attribute(el, 'refines') === undefined,
  )
  if (metas.length > 0) {
    return metas.map((el) =>
      el.selfClosing
        ? { start: el.end - 2, end: el.end, text: `>${timestamp}</${el.name}>` }
        : { start: el.startTagEnd, end: el.endTagStart, text: timestamp },
    )
  }

  const meta = `${prefixOf(metadata.name)}meta`
  const line = `<${meta} property="${MODIFIED_PROPERTY}">${timestamp}</${meta}>`
  if (metadata.selfClosing) {
    return [{ start: metadata.end - 2, end: metadata.end, text: `>${line}</${metadata.name}>` }]
  }
  const at = metadata.endTagStart
  const lineStart = opfText.lastIndexOf('\n', at - 1) + 1
  if (lineStart === 0 || /\S/.test(opfText.slice(lineStart, at))) {
    return [{ start: at, end: at, text: line }]
  }
  const newline = opfText[lineStart - 2] === '\r' ? '\r\n' : '\n'
  const last = elementChildren(metadata).at(-1)
  let indent = opfText.slice(lineStart, at)
  if (last) {
    const lastLineStart = opfText.lastIndexOf('\n', last.start - 1) + 1
    const before = opfText.slice(lastLineStart, last.start)
    if (!/\S/.test(before)) indent = before
  }
  return [{ start: lineStart, end: lineStart, text: `${indent}${line}${newline}` }]
}

const refusal = (
  reason: EpubSaveRefusalReason,
  path: string | null,
  detail: string,
): EpubSaveResult => ({ ok: false, reason, path, detail })

function editEntries(edits: EpubChapterEdits): [string, readonly RangeReplacement[]][] {
  return edits instanceof Map
    ? [...(edits as ReadonlyMap<string, readonly RangeReplacement[]>)]
    : Object.entries(edits as Readonly<Record<string, readonly RangeReplacement[]>>)
}

/** The archive's own name for `path`: exact, else ignoring case (as opening does). */
function entryName(zip: JSZip, path: string): string | null {
  const normalized = normalizeZipPath(path)
  const exact = zip.files[normalized]
  if (exact && !exact.dir) return normalized
  const lower = normalized.toLowerCase()
  for (const file of Object.values(zip.files)) {
    if (!file.dir && file.name.toLowerCase() === lower) return file.name
  }
  return null
}

/**
 * Writes `original` again with the edits applied (see the module comment).
 * The original passes the zip gate again here; it is never changed.
 */
export async function saveEpub(
  original: Uint8Array,
  edits: EpubChapterEdits,
  options: EpubSaveOptions = {},
): Promise<EpubSaveResult> {
  const opened = await openEpub(original, options)
  if (!opened.ok) return refusal('not-opened', null, `${opened.reason}: ${opened.detail}`)
  const book = opened.book
  const zip = await JSZip.loadAsync(new Uint8Array(original))

  // Merge the edits per archive entry.
  const wanted = new Map<string, RangeReplacement[]>()
  for (const [path, replacements] of editEntries(edits)) {
    if (replacements.length === 0) continue
    const name = entryName(zip, path)
    if (name === null) return refusal('unknown-entry', path, `the archive has no entry ${path}`)
    wanted.set(name, [...(wanted.get(name) ?? []), ...replacements])
  }

  // Apply them; an entry whose text comes out the same is not changed.
  const texts = new Map<string, { text: string; encoding: EpubTextEncoding }>()
  for (const [name, replacements] of wanted) {
    const decoded = decodeEntryText(new Uint8Array(await zip.files[name]!.async('uint8array')))
    if (!decoded.valid) return refusal('broken', name, `${name} is not valid ${decoded.encoding}`)
    const before = checkWellFormed(decoded.text)
    if (!before.ok) {
      return refusal('broken', name, `${name} was not well-formed: ${before.error}`)
    }
    const problem = validateReplacements(replacements, decoded.text.length)
    if (problem) return refusal('invalid-replacements', name, `${name}: ${problem}`)
    const text = applyReplacements(decoded.text, replacements)
    if (text === decoded.text) continue
    const after = checkWellFormed(text)
    if (!after.ok) {
      return refusal('not-well-formed', name, `${name} after the edit: ${after.error}`)
    }
    texts.set(name, { text, encoding: decoded.encoding })
  }
  if (texts.size === 0) return { ok: true, changed: false }
  const changedChapters = Object.keys(zip.files).filter((name) => texts.has(name))
  const now = (options.now ?? (() => new Date()))()

  // EPUB 3: stamp the save time into the package document.
  if (book.version === '3') {
    const decoded = texts.get(book.opfPath) ?? (await book.readText(book.opfPath))!
    if ('valid' in decoded && !decoded.valid) {
      return refusal('broken', book.opfPath, `${book.opfPath} is not valid ${decoded.encoding}`)
    }
    const replacements = modifiedReplacements(decoded.text, formatModifiedTimestamp(now))
    if (replacements === null) {
      return refusal('broken', book.opfPath, `${book.opfPath} has no metadata to stamp`)
    }
    texts.set(book.opfPath, {
      text: applyReplacements(decoded.text, replacements),
      encoding: decoded.encoding,
    })
  }

  const out = new JSZip()
  const mimetype = zip.files[MIMETYPE]
  if (mimetype && !mimetype.dir) {
    out.file(MIMETYPE, await unchangedData(mimetype), {
      compression: 'STORE',
      date: mimetype.date,
      createFolders: false,
    })
  } else {
    out.file(MIMETYPE, MIMETYPE_CONTENT, { compression: 'STORE', date: now, createFolders: false })
  }
  for (const file of Object.values(zip.files)) {
    if (file.name === MIMETYPE && !file.dir) continue
    const common = {
      date: file.date,
      comment: file.comment,
      dosPermissions: file.dosPermissions,
      unixPermissions: file.unixPermissions,
      createFolders: false,
    }
    if (file.dir) {
      out.file(file.name, null, { ...common, dir: true })
      continue
    }
    const edited = texts.get(file.name)
    const data = edited ? encodeEntryText(edited.text, edited.encoding) : await unchangedData(file)
    out.file(file.name, data, { ...common, compression: compressionOf(file), binary: true })
  }
  const bytes = await out.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return { ok: true, changed: true, bytes, changedChapters }
}
