/**
 * Structured text of an AI-read page from its stored payload (spec §2: a
 * page read by AI is read from what the AI returned). The store keeps the
 * payload opaque; this reads it leniently: content blocks shaped like tree
 * blocks go through the same formatter, a plain `text` field is used as is,
 * and parts it does not recognize are skipped. The payload is document data
 * only; nothing in it is followed as an instruction.
 */
import type {
  CaptionBlock,
  FootnoteDef,
  InlineRun,
  ParagraphBlock,
  TableCell,
  TreeBlock,
  TreeTable,
} from '../tree/types'
import { formatStructuredPage } from './format'

type Rec = Record<string, unknown>

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isInt = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function runOf(v: unknown): InlineRun | null {
  if (!isRecord(v)) return null
  switch (v.kind) {
    case 'text':
      return isStr(v.text) ? { kind: 'text', text: v.text } : null
    case 'footnoteRef':
      // AI content marks a note by its printed label
      return isStr(v.id) && v.id !== '' ? { kind: 'footnoteRef', id: v.id, marker: v.id } : null
    case 'math':
      return isStr(v.latex) ? { kind: 'math', latex: v.latex } : null
    case 'lineBreak':
      return { kind: 'lineBreak' }
    default:
      return null
  }
}

const runsOf = (v: unknown): InlineRun[] =>
  Array.isArray(v) ? v.map(runOf).filter((r): r is InlineRun => r !== null) : []

function tableOf(v: unknown): TreeTable | null {
  if (!isRecord(v) || !isInt(v.rowCount, 0) || !isInt(v.colCount, 0) || !Array.isArray(v.cells))
    return null
  const { rowCount, colCount } = v
  const cells: TableCell[] = []
  for (const c of v.cells) {
    if (!isRecord(c) || !isInt(c.row, 0, rowCount - 1) || !isInt(c.col, 0, colCount - 1)) continue
    cells.push({
      row: c.row,
      col: c.col,
      rowSpan: isInt(c.rowSpan, 1) ? c.rowSpan : 1,
      colSpan: isInt(c.colSpan, 1) ? c.colSpan : 1,
      paragraphs: Array.isArray(c.paragraphs) ? c.paragraphs.map(runsOf) : [],
    })
  }
  return { rowCount, colCount, cells }
}

/** tree blocks of one AI-read page; null when the payload has no block list */
function blocksOf(payload: Rec, page: number): TreeBlock[] | null {
  if (!Array.isArray(payload.blocks)) return null
  let n = 0
  const head = () => ({ id: `p${page}.ai${++n}`, page, pageFingerprint: '', source: 'ai' as const })
  const captionOf = (v: unknown): CaptionBlock | undefined =>
    isRecord(v)
      ? {
          ...head(),
          kind: 'caption',
          position: v.position === 'above' ? 'above' : 'below',
          runs: runsOf(v.runs),
        }
      : undefined
  const out: TreeBlock[] = []
  for (const b of payload.blocks) {
    if (!isRecord(b)) continue
    switch (b.kind) {
      case 'heading': {
        const level = isInt(b.level, 1) ? (Math.min(b.level, 6) as 1 | 2 | 3 | 4 | 5 | 6) : 1
        out.push({ ...head(), kind: 'heading', level, levelSource: 'ai', runs: runsOf(b.runs) })
        break
      }
      case 'paragraph':
        out.push({ ...head(), kind: 'paragraph', runs: runsOf(b.runs) })
        break
      case 'listItem':
        out.push({
          ...head(),
          kind: 'listItem',
          ordered: b.ordered === true,
          level: isInt(b.level, 0) ? b.level : 0,
          ...(isStr(b.marker) ? { marker: b.marker } : {}),
          runs: runsOf(b.runs),
        })
        break
      case 'math':
        if (isStr(b.latex)) out.push({ ...head(), kind: 'math', latex: b.latex })
        break
      case 'table': {
        const table = tableOf(b.table)
        if (!table) break
        const caption = captionOf(b.caption)
        out.push({ ...head(), kind: 'table', table, ...(caption ? { caption } : {}) })
        break
      }
      case 'figure': {
        const caption = captionOf(b.caption)
        out.push({
          ...head(),
          kind: 'image',
          data: new Uint8Array(0),
          mime: 'image/png',
          pixelWidth: 0,
          pixelHeight: 0,
          widthPt: 0,
          heightPt: 0,
          placeholder: true,
          ...(caption ? { caption } : {}),
        })
        break
      }
    }
  }
  return out
}

function footnotesOf(payload: Rec, page: number): FootnoteDef[] {
  if (!Array.isArray(payload.footnotes)) return []
  const out: FootnoteDef[] = []
  for (const f of payload.footnotes) {
    if (!isRecord(f) || !isStr(f.label) || f.label === '') continue
    const paragraphs = Array.isArray(f.paragraphs) ? f.paragraphs.map(runsOf) : []
    out.push({
      id: f.label,
      marker: f.label,
      page,
      pageFingerprint: '',
      blocks: paragraphs.map((runs, k): ParagraphBlock => ({
        id: `p${page}.fn-${f.label}.${k + 1}`,
        page,
        pageFingerprint: '',
        source: 'ai',
        kind: 'paragraph',
        runs,
      })),
    })
  }
  return out
}

/**
 * Structured text of an AI-read page (1-based original page number), or null
 * when the payload holds neither content blocks nor a text field.
 */
export function aiReadPayloadText(payload: unknown, page: number): string | null {
  if (!isRecord(payload)) return null
  const blocks = blocksOf(payload, page)
  if (blocks) {
    return formatStructuredPage({ page, blocks, footnotes: footnotesOf(payload, page) })
  }
  return isStr(payload.text) ? payload.text.trim() : null
}
