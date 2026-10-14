/**
 * The app's own plugin inside the rhwp-studio editor: the document operations
 * the AI panel needs, done on the editor's live document.
 *
 * It runs in the studio's realm, not in the app renderer, and is bundled into
 * the studio build (scripts/build-studio.mjs; the studio-plugin-allow patch
 * lets the studio load it). It imports nothing from the studio and knows only
 * the shape of the plugin host: `read` for lookups, `transaction` for every
 * change. One transaction is one undo step in the editor's own history and is
 * rolled back whole when it throws, so a change the AI makes is undone like a
 * change the user makes.
 *
 * Everything returned crosses to the app renderer by structured clone.
 */

export const AGENT_PLUGIN_ID = 'ieum-agent'

/** Matches listed back to the caller when a search is ambiguous. */
const MAX_LISTED_MATCHES = 20
/** Characters of surrounding text shown with each listed match. */
const CONTEXT_CHARS = 30
/** Most history steps one undo call takes back. */
const MAX_UNDO_STEPS = 200
/** Most paragraphs one insert call adds. */
const MAX_INSERTED_PARAGRAPHS = 100
/** Most cells a new table holds. */
const MAX_TABLE_CELLS = 400
/** Characters of a removed paragraph handed back, for the panel's list of changes. */
const MAX_REPORTED_CHARS = 200
/** Tables one listTables call lists. */
const MAX_LISTED_TABLES = 200
/** Cells one readTable call returns; a longer table is read on from the row it names. */
const MAX_READ_CELLS = 600
/** Characters of one cell handed back by readTable. */
const MAX_CELL_CHARS = 300
/** Cells one fillCells call sets. */
const MAX_FILLED_CELLS = 400
/** Lines of text one cell is given. */
const MAX_CELL_LINES = 50
/** Lookups one walk over the document spends on finding tables inside table cells. */
const MAX_NESTED_LOOKUPS = 20000
/** Objects tried in one cell paragraph when looking for a table inside it. */
const NESTED_CONTROLS_TRIED = 3
/** How deep tables inside tables are followed. */
const MAX_TABLE_DEPTH = 3
/** Cells and characters of a table shown in the list of tables. */
const PREVIEW_CELLS = 5
const PREVIEW_CHARS = 24
/** Lines one readText looks for inside other lines of the plain-text export before adding them. */
const MAX_CONTAINMENT_CHECKS = 2000
/** Font sizes a format request may ask for, in points. */
const MIN_FONT_PT = 4
const MAX_FONT_PT = 200
/** Line spacings a format request may ask for, in percent of the font height. */
const MIN_LINE_SPACING = 50
const MAX_LINE_SPACING = 500

/** What the engine says when a paragraph has no object at the place asked for. */
const NO_OBJECT_THERE = '범위 초과'

const parse = (json) => JSON.parse(json)

/** A replacement stays inside one paragraph: no line breaks or other control characters. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

/** The engine throws plain strings; give every failure a message the bridge can carry. */
function asError(thrown) {
  if (thrown instanceof Error) return thrown
  return fail('ENGINE_ERROR', String(thrown))
}

/**
 * The cell a match sits in, as the engine's by-path calls want it: one entry
 * per nesting level, outermost first. Null for a match in the body.
 */
function cellPathOf(hit) {
  if (Array.isArray(hit.cellPath) && hit.cellPath.length > 0) {
    return hit.cellPath.map((entry) => ({
      controlIndex: entry.controlIndex,
      cellIndex: entry.cellIndex,
      cellParaIndex: entry.cellParaIndex,
    }))
  }
  const cell = hit.cellContext
  if (!cell) return null
  return [{ controlIndex: cell.ctrlIdx, cellIndex: cell.cellIdx, cellParaIndex: cell.cellPara }]
}

/** Text inside an equation is a script, not prose: it has no replace path here. */
const isReplaceable = (hit) => hit.equationControl === undefined

function contextOf(doc, hit) {
  const start = Math.max(0, hit.charOffset - CONTEXT_CHARS)
  const path = cellPathOf(hit)
  if (path) {
    const json = JSON.stringify(path)
    const length = doc.getCellParagraphLengthByPath(hit.sec, hit.para, json)
    const count = Math.min(length - start, hit.length + CONTEXT_CHARS * 2)
    return count > 0 ? doc.getTextInCellByPath(hit.sec, hit.para, json, start, count) : ''
  }
  const length = doc.getParagraphLength(hit.sec, hit.para)
  const count = Math.min(length - start, hit.length + CONTEXT_CHARS * 2)
  return count > 0 ? doc.getTextRange(hit.sec, hit.para, start, count) : ''
}

function describe(doc, hit, index) {
  const row = { occurrence: index + 1, inTable: Boolean(hit.cellContext) }
  if (!isReplaceable(hit)) return { ...row, replaceable: false }
  try {
    return { ...row, context: contextOf(doc, hit) }
  } catch {
    // the surrounding text is a courtesy; the match itself is still valid
    return row
  }
}

function searchAll(doc, find) {
  if (typeof find !== 'string' || find.length === 0) {
    throw fail('BAD_ARGUMENT', 'find must be a non-empty string')
  }
  return parse(doc.searchAllText(find, true, true))
}

function checkReplacement(replacement) {
  if (typeof replacement !== 'string' || CONTROL_CHARS.test(replacement)) {
    throw fail('BAD_ARGUMENT', 'replacement must be one line of plain text')
  }
}

function expectOk(json, what) {
  const result = parse(json)
  if (result && result.ok === false) throw fail('ENGINE_REFUSED', `the editor refused to ${what}`)
}

function replaceHit(doc, hit, replacement) {
  const path = cellPathOf(hit)
  if (!path) {
    expectOk(doc.replaceText(hit.sec, hit.para, hit.charOffset, hit.length, replacement), 'replace')
    return
  }
  // the engine's one-call cell replace only takes very short text (it serves typing), so a
  // cell is rewritten as delete + insert; inside one transaction that is still one undo step
  const json = JSON.stringify(path)
  expectOk(
    doc.deleteTextInCellByPath(hit.sec, hit.para, json, hit.charOffset, hit.length),
    'delete',
  )
  if (replacement.length > 0) {
    expectOk(
      doc.insertTextInCellByPath(hit.sec, hit.para, json, hit.charOffset, replacement),
      'insert',
    )
  }
}

/**
 * The run of paragraphs a match sits in (the body of a section, or one table cell) with the
 * engine calls that address a paragraph of it by index. `index` is the matched paragraph.
 */
function containerOf(doc, hit) {
  const { sec, para } = hit
  const path = cellPathOf(hit)
  if (!path) {
    return {
      index: para,
      inTable: false,
      count: () => doc.getParagraphCount(sec),
      length: (k) => doc.getParagraphLength(sec, k),
      text: (k, count) => (count > 0 ? doc.getTextRange(sec, k, 0, count) : ''),
      // tables, pictures and the like sit in a paragraph without being its text; each one
      // has a place among the characters (the first paragraph of a document always holds
      // some: its section and column definitions)
      objectPositions: (k) => parse(doc.getControlTextPositions(sec, k)),
      split: (k, offset) => expectOk(doc.splitParagraph(sec, k, offset), 'split the paragraph'),
      font: (k) => fontOf(() => doc.getCharPropertiesAt(sec, k, 0)),
      // an empty paragraph after k without splitting k: it takes k's paragraph formatting
      addAfter: (k) => expectOk(doc.insertParagraph(sec, k + 1), 'add a paragraph'),
      insert: (k, text) => expectOk(doc.insertText(sec, k, 0, text), 'insert'),
      deleteText: (k, count) => expectOk(doc.deleteText(sec, k, 0, count), 'delete'),
      deleteRange: (k1, o1, k2, o2) => expectOk(doc.deleteRange(sec, k1, o1, k2, o2), 'delete'),
      pasteHtml: (k, html) => expectOk(doc.pasteHtml(sec, k, 0, html), 'insert the table'),
      formatChars: (k, start, end, json) =>
        expectOk(doc.applyCharFormat(sec, k, start, end, json), 'format the text'),
      formatParagraph: (k, json) =>
        expectOk(doc.applyParaFormat(sec, k, json), 'format the paragraph'),
    }
  }
  const last = path[path.length - 1]
  const at = (k) => JSON.stringify([...path.slice(0, -1), { ...last, cellParaIndex: k }])
  return {
    index: last.cellParaIndex,
    inTable: true,
    count: () => doc.getCellParagraphCountByPath(sec, para, at(0)),
    length: (k) => doc.getCellParagraphLengthByPath(sec, para, at(k)),
    text: (k, count) => (count > 0 ? doc.getTextInCellByPath(sec, para, at(k), 0, count) : ''),
    // the engine cannot be asked this for a cell paragraph; the before/after check of the
    // callers (keepingObjects) is what protects an object there
    objectPositions: () => [],
    font: (k) => fontOf(() => doc.getCellCharPropertiesAtByPath(sec, para, at(k), 0)),
    split: (k, offset) =>
      expectOk(doc.splitParagraphInCellByPath(sec, para, at(k), offset), 'split the paragraph'),
    insert: (k, text) => expectOk(doc.insertTextInCellByPath(sec, para, at(k), 0, text), 'insert'),
    deleteText: (k, count) =>
      expectOk(doc.deleteTextInCellByPath(sec, para, at(k), 0, count), 'delete'),
    deleteRange: (k1, o1, k2, o2) =>
      expectOk(doc.deleteRangeInCellByPath(sec, para, at(k1), k1, o1, k2, o2), 'delete'),
    pasteHtml: (k, html) =>
      expectOk(doc.pasteHtmlInCellByPath(sec, para, at(k), 0, html), 'insert the table'),
    formatChars: (k, start, end, json) =>
      expectOk(
        doc.applyCharFormatInCellByPath(sec, para, at(k), start, end, json),
        'format the text',
      ),
    // the engine formats a cell paragraph by table and cell number only, which cannot name
    // a cell of a table inside another table's cell
    formatParagraph:
      path.length === 1
        ? (k, json) =>
            expectOk(
              doc.applyParaFormatInCell(sec, para, last.controlIndex, last.cellIndex, k, json),
              'format the paragraph',
            )
        : null,
  }
}

/**
 * What an edit must leave alone: the objects of the document and the field values. An edit
 * that fills cells names the fields it sets itself (`ignore`, by field id); the value of a
 * named cell is its text, so those are not watched then either.
 */
function objectsOf(doc, ignore = null) {
  const fields = parse(doc.getFieldList())
  const watched = ignore
    ? fields.filter((field) => field.cellField !== true && !ignore.has(field.fieldId))
    : fields
  return {
    controls: parse(doc.getControls()).length,
    fields: JSON.stringify(watched.map((field) => field.value ?? '')),
  }
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const ALIGNMENTS = ['left', 'center', 'right', 'justify']
const TOGGLES = ['bold', 'italic', 'underline', 'strikethrough']

/**
 * A format request as the engine's property lists. Only what was asked for is set, so
 * everything else about the text stays as it is. `chars` and `paragraph` are null when
 * the request holds nothing of that kind.
 */
function formatOf(format, allowParagraph) {
  if (!format || typeof format !== 'object' || Array.isArray(format)) {
    throw fail('BAD_ARGUMENT', 'format must be an object')
  }
  const chars = {}
  for (const key of TOGGLES) {
    if (format[key] === undefined || format[key] === null) continue
    if (typeof format[key] !== 'boolean') throw fail('BAD_ARGUMENT', `${key} must be true or false`)
    chars[key] = format[key]
  }
  if (format.size !== undefined && format.size !== null) {
    if (
      typeof format.size !== 'number' ||
      !(format.size >= MIN_FONT_PT && format.size <= MAX_FONT_PT)
    ) {
      throw fail('BAD_ARGUMENT', `size must be ${MIN_FONT_PT} to ${MAX_FONT_PT} points`)
    }
    // the engine counts in hundredths of a point
    chars.fontSize = Math.round(format.size * 100)
  }
  if (format.color !== undefined && format.color !== null) {
    if (typeof format.color !== 'string' || !HEX_COLOR.test(format.color)) {
      throw fail('BAD_ARGUMENT', 'color must look like #RRGGBB')
    }
    chars.textColor = format.color.toLowerCase()
  }
  if (format.highlight !== undefined && format.highlight !== null) {
    const none = format.highlight === 'none'
    if (!none && (typeof format.highlight !== 'string' || !HEX_COLOR.test(format.highlight))) {
      throw fail('BAD_ARGUMENT', 'highlight must look like #RRGGBB, or be "none"')
    }
    // no highlight is a white one: the engine has no other way to say it here
    chars.shadeColor = none ? '#ffffff' : format.highlight.toLowerCase()
  }
  const paragraph = {}
  if (format.align !== undefined && format.align !== null) {
    if (!ALIGNMENTS.includes(format.align)) {
      throw fail('BAD_ARGUMENT', `align must be one of ${ALIGNMENTS.join(', ')}`)
    }
    paragraph.alignment = format.align
  }
  if (format.lineSpacing !== undefined && format.lineSpacing !== null) {
    const percent = format.lineSpacing
    if (
      typeof percent !== 'number' ||
      !(percent >= MIN_LINE_SPACING && percent <= MAX_LINE_SPACING)
    ) {
      throw fail(
        'BAD_ARGUMENT',
        `lineSpacing must be ${MIN_LINE_SPACING} to ${MAX_LINE_SPACING} percent`,
      )
    }
    paragraph.lineSpacing = Math.round(percent)
    paragraph.lineSpacingType = 'Percent'
  }
  const hasChars = Object.keys(chars).length > 0
  const hasParagraph = Object.keys(paragraph).length > 0
  if (hasParagraph && !allowParagraph) {
    throw fail('BAD_ARGUMENT', 'align and lineSpacing belong to a whole paragraph')
  }
  if (!hasChars && !hasParagraph) throw fail('BAD_ARGUMENT', 'format names nothing to change')
  return {
    chars: hasChars ? JSON.stringify(chars) : null,
    paragraph: hasParagraph ? JSON.stringify(paragraph) : null,
  }
}

function checkWhere(where) {
  if (where !== 'after' && where !== 'before' && where !== 'end') {
    throw fail('BAD_ARGUMENT', 'where must be "after", "before" or "end"')
  }
}

function checkParagraphs(paragraphs) {
  const valid =
    Array.isArray(paragraphs) &&
    paragraphs.length > 0 &&
    paragraphs.length <= MAX_INSERTED_PARAGRAPHS &&
    paragraphs.every((text) => typeof text === 'string' && !CONTROL_CHARS.test(text))
  if (!valid) {
    throw fail(
      'BAD_ARGUMENT',
      `paragraphs must be 1 to ${MAX_INSERTED_PARAGRAPHS} strings, each one line of plain text`,
    )
  }
}

/** The rows as a rectangle of one-line strings, short rows padded with empty cells. */
function tableOf(rows) {
  const valid =
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.every(
      (row) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((cell) => typeof cell === 'string' && !CONTROL_CHARS.test(cell)),
    )
  const cols = valid ? Math.max(...rows.map((row) => row.length)) : 0
  if (!valid || rows.length * cols > MAX_TABLE_CELLS) {
    throw fail(
      'BAD_ARGUMENT',
      `rows must be a non-empty list of rows of one-line strings, at most ${MAX_TABLE_CELLS} cells`,
    )
  }
  return rows.map((row) => [...row, ...Array(cols - row.length).fill('')])
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The look of a new table's cells: a thin black line all round and the inner margins Hangul
 * gives a new table. Left out, the engine makes a table with no lines and no margins.
 * These are document content, not app chrome: the same in the light and the dark theme.
 */
const TABLE_CELL_STYLE = 'border:0.4pt solid #000000;padding:1.41pt 5.1pt'
/** Fill of a header row. Document content as well. */
const TABLE_HEADER_FILL = '#e5e5e5'
/** Top plus bottom cell margin of TABLE_CELL_STYLE, in points. */
const TABLE_CELL_MARGIN_PT = 2.82
/** Line height of a table cell relative to its font size (the engine's default line spacing). */
const TABLE_LINE_SPACING = 1.6
/** Font size assumed for a table when the paragraph next to it does not tell. */
const DEFAULT_FONT_PT = 10

/** The font of the text at the start of a paragraph, for a table that should match it. */
function fontOf(read) {
  try {
    const props = parse(read())
    // the name goes into a style attribute: nothing that could end it
    const family =
      typeof props.fontFamily === 'string' ? props.fontFamily.replace(/["';<>]/g, '') : ''
    const points = Number(props.fontSize) / 100
    return { family, points: points > 0 ? points : DEFAULT_FONT_PT }
  } catch {
    // the table is still made, in the document's default font
    return { family: '', points: DEFAULT_FONT_PT }
  }
}

/**
 * The engine builds a table from pasted HTML, the way it does for a paste from the
 * clipboard. Left to itself it uses the document's default font and a row too low for
 * one line, so each cell carries the font of the paragraph the table is put next to and a
 * height that fits a line of it (a cell whose text wraps still grows).
 */
function tableHtml(table, font, header) {
  const height = Math.round((font.points * TABLE_LINE_SPACING + TABLE_CELL_MARGIN_PT) * 10) / 10
  const text = [
    font.family ? `font-family:${font.family};mso-fareast-font-family:${font.family}` : '',
    `font-size:${font.points}pt`,
  ]
    .filter(Boolean)
    .join(';')
  const box = `${TABLE_CELL_STYLE};height:${height}pt`
  const cell = (value) =>
    `<td style="${box}"><span style="${text}">${escapeHtml(value)}</span></td>`
  // a header cell the way Hangul documents usually have it: bold, centred, on light grey;
  // as <th> the engine also marks it as a title cell, which repeats on the next page
  const head = (value) =>
    `<th style="${box};background-color:${TABLE_HEADER_FILL}"><p style="text-align:center">` +
    `<span style="${text};font-weight:bold">${escapeHtml(value)}</span></p></th>`
  const rows = table.map(
    (row, index) => `<tr>${row.map(header && index === 0 ? head : cell).join('')}</tr>`,
  )
  return `<table>${rows.join('')}</table>`
}

/** Which match a replace call means, or the reason it cannot be decided. */
const ENTITY = /&#(\d+);|&#x([0-9a-fA-F]+);/g

/** The engine's plain-text export writes some characters as numeric references. */
const decodeEntities = (text) =>
  text.replace(ENTITY, (_match, dec, hex) =>
    String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)),
  )

const squash = (text) => text.replace(/\s+/g, ' ').trim()

/**
 * The document as plain text in reading order, one paragraph a line. The base is the
 * engine's own export, which reaches everything that holds text (text boxes, tables inside
 * cells, notes) and shows an empty form field by its guide text. That export leaves out
 * whole tables in some documents, though, and now and then a body paragraph. So the
 * paragraphs of the body and of its tables are walked as well, and each one the export does
 * not have is put in after the last line that it does have.
 *
 * A paragraph that holds a click-here field is not compared: the export writes the field's
 * guide into it, so the two never match and the line would come out twice.
 */
function textOf(doc) {
  const flat = decodeEntities(parse(doc.getTextFileText()))
  const lines = flat.split(/\r?\n/)
  // where each line of the export is: its places in order, one per occurrence
  const places = new Map()
  lines.forEach((line, index) => {
    const key = squash(line)
    if (!key) return
    const list = places.get(key)
    if (list) list.push(index)
    else places.set(key, [index])
  })
  const fielded = new Set()
  for (const field of parse(doc.getFieldList())) {
    const where = field.location
    // only a click-here field has a guide; a cross-reference or a link is ordinary text
    if (field.fieldType !== 'clickhere' || field.cellField === true || !where) continue
    const path = Array.isArray(where.path) ? where.path : []
    const cell = path[0]
    fielded.add(
      cell && cell.type === 'cell'
        ? `${where.sectionIndex}/${where.paraIndex}/${cell.controlIndex}.${cell.cellIndex}.${cell.paraIndex}`
        : `${where.sectionIndex}/${where.paraIndex}`,
    )
  }

  /** occurrences of a line already matched */
  const taken = new Map()
  /** lines put in, by the line of the export they follow (-1: in front of everything) */
  const extras = new Map()
  let pointer = -1
  let checks = MAX_CONTAINMENT_CHECKS
  let bare = null
  const match = (key) => {
    const list = places.get(key)
    const used = taken.get(key) ?? 0
    if (!list || used >= list.length) return false
    taken.set(key, used + 1)
    pointer = Math.max(pointer, list[used])
    return true
  }
  const add = (text) => {
    const bucket = extras.get(pointer)
    if (bucket) bucket.push(text)
    else extras.set(pointer, [text])
  }
  /** One walked paragraph: found in the export, or put in. */
  const see = (text) => {
    const key = squash(text)
    if (!key || match(key)) return
    // part of a longer line of the export (a paragraph with an equation or a note in it)
    if (checks > 0) {
      checks -= 1
      bare ??= flat.replace(/\s+/g, '')
      if (bare.includes(key.replace(/\s+/g, ''))) return
    }
    add(text.trim())
  }

  const sections = doc.getSectionCount()
  for (let sec = 0; sec < sections; sec++) {
    const paragraphs = doc.getParagraphCount(sec)
    for (let para = 0; para < paragraphs; para++) {
      const length = doc.getParagraphLength(sec, para)
      if (length > 0 && !fielded.has(`${sec}/${para}`)) see(doc.getTextRange(sec, para, 0, length))
      const controls = parse(doc.getControlTextPositions(sec, para)).length
      for (let ctrl = 0; ctrl < controls; ctrl++) {
        let dims
        try {
          dims = parse(doc.getTableDimensions(sec, para, ctrl))
        } catch {
          continue
        }
        const texts = []
        for (let cell = 0; cell < dims.cellCount; cell++) {
          const count = doc.getCellParagraphCount(sec, para, ctrl, cell)
          for (let k = 0; k < count; k++) {
            if (fielded.has(`${sec}/${para}/${ctrl}.${cell}.${k}`)) continue
            const size = doc.getCellParagraphLength(sec, para, ctrl, cell, k)
            if (size > 0) texts.push(doc.getTextInCell(sec, para, ctrl, cell, k, 0, size))
          }
        }
        // a table the export skipped whole goes in whole: a short cell ("1", "예") would
        // otherwise count as found wherever those characters occur in the document
        const known = texts.some((text) => {
          const list = places.get(squash(text))
          return Boolean(list) && (taken.get(squash(text)) ?? 0) < list.length
        })
        for (const text of texts) {
          if (known) see(text)
          else if (squash(text)) add(text.trim())
        }
      }
    }
  }
  if (extras.size === 0) return lines.join('\n')
  const out = [...(extras.get(-1) ?? [])]
  lines.forEach((line, index) => {
    out.push(line)
    const more = extras.get(index)
    if (more) out.push(...more)
  })
  return out.join('\n')
}

/**
 * A table is named by a path like a cell is: one entry per nesting level, the last one
 * holding the table's place among the objects of its paragraph. This is the address of
 * paragraph `k` of cell `cell` of that table.
 */
const cellAt = (path, cell, k) => [
  ...path.slice(0, -1),
  { controlIndex: path[path.length - 1].controlIndex, cellIndex: cell, cellParaIndex: k },
]

const tableKey = (sec, para, path) =>
  [
    sec,
    para,
    ...path.slice(0, -1).map((e) => `${e.controlIndex}.${e.cellIndex}.${e.cellParaIndex}`),
    path[path.length - 1].controlIndex,
  ].join('/')

/**
 * Every table of the document in reading order, a table inside a cell right after the table
 * it sits in. The engine lists the objects of a body paragraph but not those of a cell
 * paragraph, so a table inside a cell is found by asking for it; `partial` says the budget
 * for that ran out and tables inside cells may be missing from the end of the list.
 */
function tablesOf(doc) {
  const tables = []
  let lookups = MAX_NESTED_LOOKUPS
  const dimensions = (sec, para, path) => {
    try {
      return parse(doc.getTableDimensionsByPath(sec, para, JSON.stringify(path)))
    } catch {
      // not a table: a picture, a text box, a section definition
      return null
    }
  }
  const add = (sec, para, path, dims, parent, depth) => {
    const index = tables.length
    tables.push({
      sec,
      para,
      path,
      rows: dims.rowCount,
      cols: dims.colCount,
      cells: dims.cellCount,
      parent,
    })
    if (depth >= MAX_TABLE_DEPTH) return
    for (let cell = 0; cell < dims.cellCount && lookups > 0; cell++) {
      const paragraphs = doc.getCellParagraphCountByPath(
        sec,
        para,
        JSON.stringify(cellAt(path, cell, 0)),
      )
      for (let k = 0; k < paragraphs && lookups > 0; k++) {
        for (let inner = 0; inner < NESTED_CONTROLS_TRIED; inner++) {
          lookups -= 1
          const innerPath = [
            ...cellAt(path, cell, k),
            { controlIndex: inner, cellIndex: 0, cellParaIndex: 0 },
          ]
          const innerDims = dimensions(sec, para, innerPath)
          if (innerDims) add(sec, para, innerPath, innerDims, index, depth + 1)
        }
      }
    }
  }
  const sections = doc.getSectionCount()
  for (let sec = 0; sec < sections; sec++) {
    const paragraphs = doc.getParagraphCount(sec)
    for (let para = 0; para < paragraphs; para++) {
      const controls = parse(doc.getControlTextPositions(sec, para)).length
      for (let ctrl = 0; ctrl < controls; ctrl++) {
        const path = [{ controlIndex: ctrl, cellIndex: 0, cellParaIndex: 0 }]
        const dims = dimensions(sec, para, path)
        if (dims) add(sec, para, path, dims, null, 1)
      }
    }
  }
  return { tables, partial: lookups <= 0 }
}

/** The cells of a table with the place each takes: zero-based row and column, and its spans. */
function gridOf(doc, table) {
  const cells = []
  for (let cell = 0; cell < table.cells; cell++) {
    const info = parse(
      doc.getCellInfoByPath(table.sec, table.para, JSON.stringify(cellAt(table.path, cell, 0))),
    )
    cells.push({
      cell,
      row: info.row,
      col: info.col,
      rowSpan: info.rowSpan || 1,
      colSpan: info.colSpan || 1,
    })
  }
  return cells
}

/** The paragraphs of one cell, addressed like the paragraphs a match sits in. */
const cellBox = (doc, table, cell) =>
  containerOf(doc, { sec: table.sec, para: table.para, cellPath: cellAt(table.path, cell, 0) })

function paragraphsOf(box) {
  const texts = []
  const count = box.count()
  for (let k = 0; k < count; k++) texts.push(box.text(k, box.length(k)))
  return texts
}

/**
 * Whether a cell holds an object: a picture, a shape, a table of its own. Such a cell can
 * be without a single character and still not be empty, and text written into it lands on
 * top of the picture. The engine does not list the objects of a cell paragraph, but asked
 * for a table there it answers "out of range" only when the paragraph holds no object at
 * all. Should that wording change, every cell reads as holding one and nothing is written:
 * the safe side, and the engine tests fail.
 */
function cellHoldsObject(doc, table, cell) {
  const paragraphs = doc.getCellParagraphCountByPath(
    table.sec,
    table.para,
    JSON.stringify(cellAt(table.path, cell, 0)),
  )
  for (let k = 0; k < paragraphs; k++) {
    const first = [
      ...cellAt(table.path, cell, k),
      { controlIndex: 0, cellIndex: 0, cellParaIndex: 0 },
    ]
    try {
      doc.getTableDimensionsByPath(table.sec, table.para, JSON.stringify(first))
      return true
    } catch (thrown) {
      if (!String(thrown).includes(NO_OBJECT_THERE)) return true
    }
  }
  return false
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text)

/**
 * The click-here fields that sit directly in a table cell, by table and cell. A cell that
 * holds one is filled through the field: text typed beside an empty field would leave its
 * guide text standing next to the answer.
 */
function fieldsByCell(doc) {
  const byCell = new Map()
  parse(doc.getFieldList()).forEach((field, index) => {
    if (field.cellField === true) return
    const where = field.location
    const path = where && Array.isArray(where.path) ? where.path : []
    if (path.length === 0 || path.some((entry) => entry.type !== 'cell')) return
    const cells = path.map((entry) => ({
      controlIndex: entry.controlIndex,
      cellIndex: entry.cellIndex,
      cellParaIndex: entry.paraIndex,
    }))
    const key = `${tableKey(where.sectionIndex, where.paraIndex, cells)}:${cells[cells.length - 1].cellIndex}`
    const entry = {
      number: index + 1,
      fieldId: field.fieldId,
      value: field.value ?? '',
      guide: field.guide ?? '',
    }
    const list = byCell.get(key)
    if (list) list.push(entry)
    else byCell.set(key, [entry])
  })
  return byCell
}

/** An empty field shows its guide text, which the engine also reports as its value. */
const fieldIsEmpty = (field) => field.value === '' || field.value === field.guide

/** What fillCells was asked to write: 1-based places, and the text of each as lines. */
function checkCells(cells) {
  if (!Array.isArray(cells) || cells.length === 0 || cells.length > MAX_FILLED_CELLS) {
    throw fail('BAD_ARGUMENT', `cells must be a list of 1 to ${MAX_FILLED_CELLS} entries`)
  }
  return cells.map((entry) => {
    const { row, col, text } = entry ?? {}
    if (!Number.isInteger(row) || row < 1 || !Number.isInteger(col) || col < 1) {
      throw fail('BAD_ARGUMENT', 'row and col count from 1 and are whole numbers')
    }
    if (typeof text !== 'string') throw fail('BAD_ARGUMENT', 'the text of a cell must be a string')
    const lines = text.split(/\r?\n/)
    if (lines.length > MAX_CELL_LINES || lines.some((line) => CONTROL_CHARS.test(line))) {
      throw fail('BAD_ARGUMENT', `a cell takes plain text of at most ${MAX_CELL_LINES} lines`)
    }
    return { row, col, lines }
  })
}

function pickHit(hits, occurrence) {
  if (hits.length === 0) return { reason: 'not_found' }
  if (occurrence === undefined || occurrence === null) {
    return hits.length === 1 ? { hit: hits[0] } : { reason: 'ambiguous' }
  }
  if (!Number.isInteger(occurrence) || occurrence < 1 || occurrence > hits.length) {
    return { reason: 'no_such_occurrence' }
  }
  return { hit: hits[occurrence - 1] }
}

export const agentPlugin = {
  id: AGENT_PLUGIN_ID,
  apiVersion: 1,

  activate(host) {
    // counts the changes this plugin did not make (the user typing, the editor's own undo):
    // the panel takes back a run only while this has not moved since the run ended, because
    // the editor's history is one stack and anything on top of the run would be undone first
    let foreign = 0
    let own = false
    // the text is read for every request; it only changes when the document does
    let text = null
    host.events.on('document-changed', () => {
      text = null
      if (!own) foreign += 1
    })

    const guarded =
      (fn) =>
      (...args) => {
        try {
          return fn(...args)
        } catch (thrown) {
          throw asError(thrown)
        }
      }

    /** One change of this plugin: one undo step, not counted as foreign. */
    const change = (label, fn) => {
      own = true
      // not left to the editor's event alone: a stale text would send the model after
      // words that are no longer there
      text = null
      try {
        return host.transaction(label, (tx) => {
          tx.deferPagination()
          return fn(tx.doc())
        })
      } finally {
        own = false
      }
    }

    const listMatches = (doc, hits) =>
      hits.slice(0, MAX_LISTED_MATCHES).map((hit, index) => describe(doc, hit, index))

    /**
     * A new paragraph is made by splitting the one next to it, the way Enter does, so that
     * it takes that paragraph's formatting. Where an object sits at the split, though, the
     * engine may carry it into the new paragraph (it depends on the kind of object). So:
     * "before" is only done in a paragraph without objects, and "after" a paragraph whose
     * object sits at its end (a table on a line of its own, typically) adds an empty
     * paragraph behind it instead of splitting (`plain`).
     */
    const guardObjects = (box, where, count) => {
      const positions = box.objectPositions(box.index)
      if (where === 'before') {
        return positions.length > 0
          ? { refusal: { ok: false, reason: 'has_objects', count } }
          : { box }
      }
      const plain = positions.some((position) => position >= box.length(box.index))
      return { box, plain }
    }

    /** Make an empty paragraph after paragraph `k` of `box`; its index is k + 1. */
    const openAfter = (box, k, plain) => {
      if (plain) box.addAfter(k)
      else box.split(k, box.length(k))
    }

    /**
     * The paragraph a paragraph edit works on: the one `anchor` occurs in, or for "end" the
     * last paragraph of the document. `box` addresses it; without one, `refusal` says why.
     */
    const locate = (doc, anchor, occurrence, where) => {
      if (where === 'end') {
        const sec = doc.getSectionCount() - 1
        return guardObjects(
          containerOf(doc, { sec, para: doc.getParagraphCount(sec) - 1 }),
          where,
          1,
        )
      }
      const hits = searchAll(doc, anchor)
      const picked = pickHit(hits, occurrence)
      const reason = !picked.hit
        ? picked.reason
        : !isReplaceable(picked.hit)
          ? 'unsupported_place'
          : null
      if (reason) {
        return {
          refusal: {
            ok: false,
            reason,
            count: hits.length,
            ...(reason === 'ambiguous' ? { matches: listMatches(doc, hits) } : {}),
          },
        }
      }
      return guardObjects(containerOf(doc, picked.hit), where, hits.length)
    }

    /**
     * Run a paragraph edit that must not cost the document an object or a field value. The
     * edit calls `mustKeep(before, after)`; when something is gone it throws, the editor
     * rolls the whole change back, and the call answers `has_objects` instead of failing.
     */
    const keepingObjects = (edit) => {
      let lost = false
      const mustKeep = (before, after) => {
        if (before.controls === after.controls && before.fields === after.fields) return
        lost = true
        throw fail('HAS_OBJECTS', 'the change would remove an object of the document')
      }
      try {
        return edit(mustKeep)
      } catch (thrown) {
        if (lost) return { ok: false, reason: 'has_objects', count: 1 }
        throw thrown
      }
    }

    return {
      foreignChanges: () => foreign,

      /** The whole document as plain text, table cells included, in reading order. */
      readText: guarded(() => {
        text ??= host.read(textOf)
        return text
      }),

      /** Where a piece of text occurs. Exact, case-sensitive. */
      findText: guarded((find) =>
        host.read((doc) => {
          const hits = searchAll(doc, find)
          return { count: hits.length, matches: listMatches(doc, hits) }
        }),
      ),

      /**
       * Replace one occurrence of `find`. Without `occurrence` the text must occur exactly
       * once; with it (1-based) that occurrence is replaced. Formatting around the replaced
       * span stays as it was.
       */
      replaceText: guarded((find, replacement, occurrence) => {
        checkReplacement(replacement)
        // decided on a read first: a transaction is only opened for a change that will happen
        const refusal = host.read((doc) => {
          const hits = searchAll(doc, find)
          const picked = pickHit(hits, occurrence)
          if (picked.hit && isReplaceable(picked.hit)) return null
          const reason = picked.hit ? 'unsupported_place' : picked.reason
          return {
            ok: false,
            reason,
            count: hits.length,
            ...(reason === 'ambiguous' ? { matches: listMatches(doc, hits) } : {}),
          }
        })
        if (refusal) return refusal
        return change('replace', (doc) => {
          const hits = searchAll(doc, find)
          const { hit } = pickHit(hits, occurrence)
          if (!hit || !isReplaceable(hit)) throw fail('CHANGED', 'the document changed mid-call')
          replaceHit(doc, hit, replacement)
          return { ok: true, count: hits.length, inTable: Boolean(hit.cellContext) }
        })
      }),

      /** Replace every occurrence of `find` outside equations, last match first. */
      replaceAllText: guarded((find, replacement) => {
        checkReplacement(replacement)
        const total = host.read((doc) => searchAll(doc, find).filter(isReplaceable).length)
        if (total === 0) return { ok: false, reason: 'not_found', count: 0 }
        return change('replace-all', (doc) => {
          // back to front, so replacing one match never moves the offset of one still to do
          const hits = searchAll(doc, find).filter(isReplaceable).reverse()
          for (const hit of hits) replaceHit(doc, hit, replacement)
          return { ok: true, count: hits.length }
        })
      }),

      /**
       * Add new paragraphs next to the paragraph `anchor` occurs in (`where` "after" or
       * "before"), or after the last paragraph of the document ("end"). They are made the way
       * Enter makes one, so they take the paragraph and character formatting of that paragraph.
       */
      insertParagraphs: guarded((anchor, occurrence, where, paragraphs) => {
        checkWhere(where)
        checkParagraphs(paragraphs)
        const refusal = host.read((doc) => locate(doc, anchor, occurrence, where).refusal ?? null)
        if (refusal) return refusal
        return keepingObjects((mustKeep) =>
          change('insert-paragraphs', (doc) => {
            const { box, plain } = locate(doc, anchor, occurrence, where)
            if (!box) throw fail('CHANGED', 'the document changed mid-call')
            const before = objectsOf(doc)
            const texts = [...paragraphs]
            let at = box.index
            if (where === 'before') {
              // splitting at the start leaves an empty paragraph in front, formatted like this one
              box.split(at, 0)
              const first = texts.shift()
              if (first) box.insert(at, first)
            }
            for (const text of texts) {
              // only the anchor can hold an object; the paragraphs made here are plain text
              openAfter(box, at, plain && at === box.index)
              at += 1
              if (text) box.insert(at, text)
            }
            mustKeep(before, objectsOf(doc))
            return { ok: true, count: paragraphs.length, inTable: box.inTable }
          }),
        )
      }),

      /**
       * Remove the paragraph `find` occurs in. A paragraph that holds a table, a picture or
       * a form field is left alone: removing it would take the object with it.
       */
      deleteParagraph: guarded((find, occurrence) => {
        const refusal = host.read((doc) => {
          const { box, refusal: why } = locate(doc, find, occurrence, 'after')
          if (!box) return why
          // the first paragraph is only emptied, which the check after the change covers
          const removed = box.index > 0 && box.count() > 1
          return removed && box.objectPositions(box.index).length > 0
            ? { ok: false, reason: 'has_objects', count: 1 }
            : null
        })
        if (refusal) return refusal
        return keepingObjects((mustKeep) =>
          change('delete-paragraph', (doc) => {
            const { box } = locate(doc, find, occurrence, 'after')
            if (!box) throw fail('CHANGED', 'the document changed mid-call')
            const before = objectsOf(doc)
            const k = box.index
            const length = box.length(k)
            const text = box.text(k, Math.min(length, MAX_REPORTED_CHARS))
            // the first paragraph of a cell or section has nothing in front to close up
            // against, and joining it with the next one would hand that one its formatting:
            // it keeps its place as an empty line
            const emptied = k === 0 || box.count() === 1
            if (emptied) box.deleteText(k, length)
            // from the end of the paragraph in front to the end of this one: the paragraph
            // goes, and the ones around it keep their own formatting
            else box.deleteRange(k - 1, box.length(k - 1), k, length)
            mustKeep(before, objectsOf(doc))
            return { ok: true, text, emptied, inTable: box.inTable }
          }),
        )
      }),

      /**
       * Add a table of plain-text cells, placed like insertParagraphs places a paragraph,
       * in the body text only: the engine does not lay out a table made inside the cell of
       * another one (its cells come out in one row, without lines).
       */
      insertTable: guarded((anchor, occurrence, where, rows, header) => {
        checkWhere(where)
        const table = tableOf(rows)
        const refusal = host.read((doc) => {
          const { box, refusal: why } = locate(doc, anchor, occurrence, where)
          if (!box) return why
          return box.inTable ? { ok: false, reason: 'in_table', count: 1 } : null
        })
        if (refusal) return refusal
        return keepingObjects((mustKeep) =>
          change('insert-table', (doc) => {
            const { box, plain } = locate(doc, anchor, occurrence, where)
            if (!box) throw fail('CHANGED', 'the document changed mid-call')
            const before = objectsOf(doc)
            let at = box.index
            // read before the paragraph is split: the table is to look like the text beside it
            const font = box.font(at)
            if (where === 'before') box.split(at, 0)
            else {
              openAfter(box, at, plain)
              at += 1
            }
            box.pasteHtml(at, tableHtml(table, font, header === true))
            const after = objectsOf(doc)
            // the new table is an object of its own; nothing that was there may be gone
            mustKeep(before, { ...after, controls: Math.min(after.controls, before.controls) })
            return { ok: true, rows: table.length, cols: table[0].length, inTable: box.inTable }
          }),
        )
      }),

      /**
       * Change the character formatting of one occurrence of `find`, or with `all` of every
       * occurrence. Only the named properties change; the text itself is not touched.
       */
      formatText: guarded((find, occurrence, all, format) => {
        const { chars } = formatOf(format, false)
        const targets = (doc) => {
          const hits = searchAll(doc, find)
          if (all === true) {
            const usable = hits.filter(isReplaceable)
            return usable.length > 0
              ? { hits: usable }
              : { refusal: { ok: false, reason: 'not_found', count: 0 } }
          }
          const picked = pickHit(hits, occurrence)
          if (picked.hit && isReplaceable(picked.hit)) return { hits: [picked.hit] }
          const reason = picked.hit ? 'unsupported_place' : picked.reason
          return {
            refusal: {
              ok: false,
              reason,
              count: hits.length,
              ...(reason === 'ambiguous' ? { matches: listMatches(doc, hits) } : {}),
            },
          }
        }
        const refusal = host.read((doc) => targets(doc).refusal ?? null)
        if (refusal) return refusal
        return keepingObjects((mustKeep) =>
          change('format-text', (doc) => {
            const { hits } = targets(doc)
            if (!hits) throw fail('CHANGED', 'the document changed mid-call')
            const before = objectsOf(doc)
            for (const hit of hits) {
              const box = containerOf(doc, hit)
              box.formatChars(box.index, hit.charOffset, hit.charOffset + hit.length, chars)
            }
            mustKeep(before, objectsOf(doc))
            return { ok: true, count: hits.length }
          }),
        )
      }),

      /**
       * Change the formatting of the whole paragraph `find` occurs in: its alignment and
       * line spacing, and the character formatting of all its text.
       */
      formatParagraph: guarded((find, occurrence, format) => {
        const { chars, paragraph } = formatOf(format, true)
        const plan = (doc) => {
          const hits = searchAll(doc, find)
          const picked = pickHit(hits, occurrence)
          const refuse = (reason) => ({
            refusal: {
              ok: false,
              reason,
              count: hits.length,
              ...(reason === 'ambiguous' ? { matches: listMatches(doc, hits) } : {}),
            },
          })
          if (!picked.hit) return refuse(picked.reason)
          if (!isReplaceable(picked.hit)) return refuse('unsupported_place')
          const box = containerOf(doc, picked.hit)
          return paragraph && !box.formatParagraph ? refuse('unsupported_place') : { box }
        }
        const refusal = host.read((doc) => plan(doc).refusal ?? null)
        if (refusal) return refusal
        return keepingObjects((mustKeep) =>
          change('format-paragraph', (doc) => {
            const { box } = plan(doc)
            if (!box) throw fail('CHANGED', 'the document changed mid-call')
            const before = objectsOf(doc)
            const length = box.length(box.index)
            if (chars && length > 0) box.formatChars(box.index, 0, length, chars)
            if (paragraph) box.formatParagraph(box.index, paragraph)
            mustKeep(before, objectsOf(doc))
            return { ok: true, inTable: box.inTable }
          }),
        )
      }),

      /**
       * The tables of the document in reading order, numbered from 1; a table inside a cell
       * comes right after the table it sits in. The number is what readTable and fillCells
       * take.
       */
      listTables: guarded(() =>
        host.read((doc) => {
          const { tables, partial } = tablesOf(doc)
          const near = (table) => {
            if (table.parent !== null) return ''
            // the line the table follows usually says what it is
            for (let k = table.para; k >= 0 && k > table.para - 4; k--) {
              const length = doc.getParagraphLength(table.sec, k)
              if (length > 0) {
                return clip(doc.getTextRange(table.sec, k, 0, length).trim(), PREVIEW_CHARS * 2)
              }
            }
            return ''
          }
          const preview = (table) => {
            const texts = []
            for (let cell = 0; cell < table.cells && cell < 12; cell++) {
              const text = paragraphsOf(cellBox(doc, table, cell))
                .join(' ')
                .trim()
              if (text) texts.push(clip(text, PREVIEW_CHARS))
              if (texts.length === PREVIEW_CELLS) break
            }
            return texts
          }
          return {
            count: tables.length,
            partial,
            tables: tables.slice(0, MAX_LISTED_TABLES).map((table, index) => ({
              table: index + 1,
              rows: table.rows,
              cols: table.cols,
              ...(table.parent === null ? {} : { inTable: table.parent + 1 }),
              near: near(table),
              preview: preview(table),
            })),
          }
        }),
      ),

      /**
       * The cells of table `number` row by row, from row `fromRow` (1-based). A merged cell
       * is listed once, at its first place, with its spans. A long table comes in parts:
       * `nextRow` is the row to go on from.
       */
      readTable: guarded((number, fromRow) =>
        host.read((doc) => {
          const { tables } = tablesOf(doc)
          const table = Number.isInteger(number) ? tables[number - 1] : undefined
          if (!table) return { ok: false, reason: 'no_such_table', count: tables.length }
          const first = Number.isInteger(fromRow) && fromRow > 1 ? fromRow - 1 : 0
          const grid = gridOf(doc, table)
            .filter((cell) => cell.row >= first)
            .sort((a, b) => a.row - b.row || a.col - b.col)
          // whole rows only, and always at least one
          let end = grid.length
          if (grid.length > MAX_READ_CELLS) {
            const cut = grid[MAX_READ_CELLS].row
            end = grid.findIndex((cell) => cell.row === cut)
            if (end === 0) end = grid.findIndex((cell) => cell.row !== cut)
            if (end < 0) end = grid.length
          }
          const fields = fieldsByCell(doc)
          const key = tableKey(table.sec, table.para, table.path)
          const cells = grid.slice(0, end).map((place) => {
            const held = fields.get(`${key}:${place.cell}`)
            return {
              row: place.row + 1,
              col: place.col + 1,
              ...(place.rowSpan > 1 ? { rowSpan: place.rowSpan } : {}),
              ...(place.colSpan > 1 ? { colSpan: place.colSpan } : {}),
              text: clip(paragraphsOf(cellBox(doc, table, place.cell)).join('\n'), MAX_CELL_CHARS),
              ...(held ? { fields: held.map((field) => field.number) } : {}),
              ...(!held && cellHoldsObject(doc, table, place.cell) ? { object: true } : {}),
            }
          })
          return {
            ok: true,
            table: number,
            rows: table.rows,
            cols: table.cols,
            cells,
            ...(end < grid.length ? { nextRow: grid[end].row + 1 } : {}),
          }
        }),
      ),

      /**
       * Write text into cells of table `number`, all of them in one undo step or none.
       * `cells` is a list of { row, col, text } with 1-based places; a place inside a merged
       * cell means that cell. A line break in the text starts a new paragraph in the cell.
       * The text takes the formatting the cell already has. A cell that holds text is only
       * written over with `overwrite`; a cell that holds one click-here field is filled
       * through the field; a cell that holds a picture or another object is never written.
       */
      fillCells: guarded((number, cells, overwrite) => {
        const wanted = checkCells(cells)
        const plan = (doc) => {
          const { tables } = tablesOf(doc)
          const table = Number.isInteger(number) ? tables[number - 1] : undefined
          if (!table)
            return { refusal: { ok: false, reason: 'no_such_table', count: tables.length } }
          const grid = gridOf(doc, table)
          const fields = fieldsByCell(doc)
          const key = tableKey(table.sec, table.para, table.path)
          const targets = []
          const missing = []
          const occupied = []
          const fielded = []
          const holding = []
          const taken = new Set()
          for (const want of wanted) {
            const at = { row: want.row, col: want.col }
            const place = grid.find(
              (cell) =>
                want.row - 1 >= cell.row &&
                want.row - 1 < cell.row + cell.rowSpan &&
                want.col - 1 >= cell.col &&
                want.col - 1 < cell.col + cell.colSpan,
            )
            if (!place) {
              missing.push(at)
              continue
            }
            if (taken.has(place.cell)) {
              throw fail('BAD_ARGUMENT', `two entries name the same cell (${want.row}.${want.col})`)
            }
            taken.add(place.cell)
            const held = fields.get(`${key}:${place.cell}`) ?? []
            if (held.length > 1) {
              fielded.push({ ...at, fields: held.map((field) => field.number) })
              continue
            }
            if (held.length === 1) {
              const field = held[0]
              if (!fieldIsEmpty(field) && overwrite !== true) {
                occupied.push({ ...at, text: clip(field.value, MAX_REPORTED_CHARS) })
              } else targets.push({ ...want, cell: place.cell, field })
              continue
            }
            if (cellHoldsObject(doc, table, place.cell)) {
              holding.push(at)
              continue
            }
            const texts = paragraphsOf(cellBox(doc, table, place.cell))
            if (texts.join('').trim() !== '' && overwrite !== true) {
              occupied.push({ ...at, text: clip(texts.join(' ').trim(), MAX_REPORTED_CHARS) })
            } else {
              // blanks typed into a cell to be filled in are written over like an empty cell
              targets.push({ ...want, cell: place.cell, clear: texts.some((text) => text !== '') })
            }
          }
          const refuse = (reason, list) => ({
            refusal: { ok: false, reason, cells: list, rows: table.rows, cols: table.cols },
          })
          if (missing.length > 0) return refuse('no_such_cell', missing)
          if (fielded.length > 0) return refuse('has_fields', fielded)
          if (holding.length > 0) return refuse('holds_object', holding)
          if (occupied.length > 0) return refuse('occupied', occupied)
          return { table, targets }
        }
        const refusal = host.read((doc) => plan(doc).refusal ?? null)
        if (refusal) return refusal
        return keepingObjects((mustKeep) =>
          change('fill-cells', (doc) => {
            const { table, targets } = plan(doc)
            if (!targets) throw fail('CHANGED', 'the document changed mid-call')
            const own = new Set(targets.filter((t) => t.field).map((t) => t.field.fieldId))
            const before = objectsOf(doc, own)
            for (const target of targets) {
              if (target.field) {
                // a field holds one line
                expectOk(
                  doc.setFieldValue(target.field.fieldId, target.lines.join(' ')),
                  'fill the field',
                )
                continue
              }
              const box = cellBox(doc, table, target.cell)
              if (target.clear) {
                const last = box.count() - 1
                if (last > 0) box.deleteRange(0, 0, last, box.length(last))
                else box.deleteText(0, box.length(0))
              }
              target.lines.forEach((line, k) => {
                // a further line is a further paragraph, made like Enter makes one
                if (k > 0 && k >= box.count()) box.split(k - 1, box.length(k - 1))
                if (line) box.insert(k, line)
              })
            }
            mustKeep(before, objectsOf(doc, own))
            return { ok: true, table: number, count: targets.length }
          }),
        )
      }),

      /**
       * The form fields of the document in document order. Names repeat in real forms (a
       * field nobody named carries its guide text), so a field is addressed by its number.
       */
      listFields: guarded(() =>
        host.read((doc) =>
          parse(doc.getFieldList()).map((field, index) => ({
            field: index + 1,
            name: field.name ?? '',
            guide: field.guide ?? '',
            value: field.value ?? '',
            // a named table cell is filled like a field but is not one the user clicks into
            inCell: field.cellField === true,
          })),
        ),
      ),

      /** Set the value of the field with this number (1-based, as listed by listFields). */
      fillField: guarded((number, value) => {
        checkReplacement(value)
        const count = host.read((doc) => parse(doc.getFieldList()).length)
        if (!Number.isInteger(number) || number < 1 || number > count) {
          return { ok: false, reason: 'no_such_field', count }
        }
        return change('fill-field', (doc) => {
          const field = parse(doc.getFieldList())[number - 1]
          if (!field) throw fail('CHANGED', 'the document changed mid-call')
          expectOk(doc.setFieldValue(field.fieldId, value), 'fill the field')
          return { ok: true, name: field.name ?? '' }
        })
      }),

      /**
       * Undo the last `steps` changes through the editor's own history, but only while
       * `expectedForeign` still equals foreignChanges(): the check and the undo happen here,
       * in one go, so nothing can slip in between them.
       */
      undo: guarded((steps, expectedForeign) => {
        if (!Number.isInteger(steps) || steps < 1 || steps > MAX_UNDO_STEPS) {
          throw fail('BAD_ARGUMENT', 'steps must be a small positive integer')
        }
        if (expectedForeign !== foreign) return { ok: false, reason: 'changed', undone: 0 }
        let undone = 0
        own = true
        text = null
        try {
          for (let i = 0; i < steps; i++) {
            const result = host.automation.execute('edit:undo')
            if (!result || result.ok !== true) break
            undone += 1
          }
        } finally {
          own = false
        }
        return { ok: undone === steps, undone }
      }),
    }
  },
}

export default agentPlugin
