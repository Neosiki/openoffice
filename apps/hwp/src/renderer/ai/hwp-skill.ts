import type { AgentSkill, AgentToolCall, AgentToolDef, ToolExecution } from '@genoffice/agent-core'
import { brandText, type Params } from '@genoffice/i18n'
import type {
  AgentMatch,
  AgentParagraphFormat,
  AgentPlaceRefusal,
  AgentWhere,
} from '../../../studio-plugin/agent-plugin.mjs'
import type { AgentBridge } from './agent-bridge'
import type { StringKey } from '../i18n/locale'

/** Document text attached to every user message; longer documents are read on demand. */
export const CONTEXT_MAX_CHARS = 8000
/** Most text one read_document call returns. */
export const READ_PAGE_CHARS = 24000
const CONTEXT_MAX_FIELDS = 40
/** Longest quote of document text inside an activity label. */
const LABEL_QUOTE_CHARS = 24
/** Longest text of an added or removed paragraph kept for the panel's list of changes. */
const CHANGE_TEXT_CHARS = 200

/** One change a run made to the document, as the panel lists it. */
export interface HwpChange {
  kind: 'replace' | 'replaceAll' | 'field' | 'insert' | 'delete' | 'table' | 'format'
  /** the replaced, removed or formatted text, or the field name; empty for something added */
  from: string
  /** the new text (for a table its first row, for a format what was set); empty for something removed */
  to: string
  /** places changed (more than one only for replaceAll) */
  count: number
}

export interface HwpSkillDeps {
  bridge: AgentBridge
  /** activity labels, in the UI language */
  label(key: StringKey, params?: Params): string
  /** called once for every change that went into the document (one undo step each) */
  onChange(change: HwpChange): void
}

export interface HwpSkill {
  skill: AgentSkill
  /**
   * Read the document state the next user message is sent with. The loop
   * builds its context synchronously, so the panel awaits this before a run.
   */
  refreshContext(): Promise<void>
}

const SYSTEM_PROMPT = [
  brandText(
    'You are the assistant inside the GenOffice editor for Hangul word processor documents (HWP / HWPX), the format most Korean public offices write in.',
    'en',
  ),
  'You work on the document that is open in the editor, through tools.',
  '',
  '## What the tools can do',
  '- Read the text of the document, table cells included (read_document, find_text).',
  '- Replace a piece of text with another (replace_text, replace_all). The new text takes the formatting of the text it replaces.',
  '- Add new paragraphs next to an existing one, in the body or inside a table cell, or at the end of the document (insert_paragraphs). Remove a paragraph (delete_paragraph).',
  '- Add a table of plain-text cells, with a header row when the first row names the columns (insert_table).',
  '- Change formatting: bold, italic, underline, strikethrough, font size, text colour and highlight of a piece of text (format_text); alignment and line spacing of a paragraph, and the character formatting of a whole paragraph (format_paragraph).',
  '- Fill the form fields of the document (list_fields, fill_field). In Hangul these are called 누름틀. A field is picked by its number in list_fields, because several fields often share one name.',
  '',
  '## What they cannot do',
  '- You cannot change the font family, styles, numbering, indents, borders or cell shading, or the page layout. You cannot add or change pictures, or add, remove or merge rows and columns of an existing table.',
  '- One piece of text is always one line: a line break inside a text argument is refused. Several paragraphs are several strings in one insert_paragraphs call.',
  '- When the user asks for something the tools cannot do, say so plainly instead of approximating it.',
  '',
  '## How new paragraphs look',
  '- A new paragraph is made the way pressing Enter makes one: it takes the formatting of the paragraph you anchor it to. So anchor it to a paragraph that looks the way the new one should: body text next to body text, a list item next to list items, never next to a title unless a title is what you are adding.',
  '- This is not markdown. Write the text exactly as it should appear, with no #, **, or markdown bullets. Korean official documents mark their levels with characters such as □, ㅇ, -, * or 1. / 가. at the start of the line: continue the scheme the document already uses, including its leading spaces.',
  '- Write a longer addition as several paragraphs in one insert_paragraphs call, in order. An empty string is an empty line.',
  '',
  '## Formatting rules',
  '- Format only what the user asked for. Do not restyle text on your own: a new paragraph already looks like its neighbour, and official documents keep one look throughout.',
  '- When new content needs a look of its own (a heading, an emphasised line), insert the text first, then format it with a second call.',
  '- For emphasis prefer bold. Use colour and highlight only when the user asks for them.',
  '- To take formatting away, pass false (bold, italic, underline, strikethrough) or "none" (highlight).',
  '',
  '## Editing rules',
  '- Text you pass to find or anchor must match the document exactly: letters, spaces and punctuation. Copy it from what you read; never retype it from memory.',
  '- Change as little as possible: find the shortest piece that says what must change and is still unambiguous. When it occurs more than once, call find_text and pass the occurrence you mean, or use replace_all when every occurrence should change.',
  '- To reword part of a paragraph use replace_text. Do not delete a paragraph and insert a new one for that: the paragraph would lose formatting that differs inside it.',
  '- Leave numbers, dates, names, amounts and legal references as they are unless the user asks to change them.',
  '- Never invent a fact to fill a field or a blank. Fill what the user gave you and ask for the rest in one question.',
  '- Where the text shows the guide of an empty form field (for example "이곳을 마우스로 누르고 내용을 입력하세요."), that is not document text: fill it with fill_field, not with replace_text.',
  '- For proofreading or rewording requests, read the text first, then fix each place with its own replace_text call.',
  '- If a tool says the text was not found, read that part of the document again before trying anything else.',
  '- If a tool says an object is in the way (a table, a picture or a form field sits in that paragraph), pick the paragraph before or after it as the anchor, or tell the user.',
  '',
  '## Conversation',
  '- Answer questions about the document directly, without changing it.',
  '- Keep replies short. After editing, say in a sentence or two what you changed. The panel lists every change and lets the user take the whole run back.',
].join('\n')

/** The character formatting a format tool takes, as schema properties. */
const TEXT_FORMAT_SCHEMA = {
  bold: { type: 'boolean' },
  italic: { type: 'boolean' },
  underline: { type: 'boolean' },
  strikethrough: { type: 'boolean' },
  size: { type: 'number', description: 'font size in points' },
  color: { type: 'string', description: 'text colour as #RRGGBB' },
  highlight: {
    type: 'string',
    description: 'highlight colour as #RRGGBB, or "none" to remove a highlight',
  },
}

const TOOLS: AgentToolDef[] = [
  {
    name: 'read_document',
    description:
      'Read the text of the open document in reading order, table cells included. Returns up to ' +
      `${READ_PAGE_CHARS} characters from offset; call again with the next offset for a longer document.`,
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', minimum: 0, description: 'character to start from (default 0)' },
      },
    },
  },
  {
    name: 'find_text',
    description:
      'List where a piece of text occurs: how many times, and each occurrence with the text around it. Exact and case-sensitive.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'the text to look for' } },
      required: ['text'],
    },
  },
  {
    name: 'replace_text',
    description:
      'Replace one occurrence of a piece of text. Without occurrence the text must occur exactly once; with it, that occurrence (1-based, as listed by find_text) is replaced. An empty replacement deletes the text.',
    inputSchema: {
      type: 'object',
      properties: {
        find: { type: 'string', description: 'the exact text to replace, within one paragraph' },
        replace: { type: 'string', description: 'the new text, one line' },
        occurrence: { type: 'integer', minimum: 1 },
      },
      required: ['find', 'replace'],
    },
  },
  {
    name: 'replace_all',
    description: 'Replace every occurrence of a piece of text in the whole document.',
    inputSchema: {
      type: 'object',
      properties: {
        find: { type: 'string', description: 'the exact text to replace, within one paragraph' },
        replace: { type: 'string', description: 'the new text, one line' },
      },
      required: ['find', 'replace'],
    },
  },
  {
    name: 'insert_paragraphs',
    description:
      'Add new paragraphs after or before the paragraph that contains the anchor text, or at the end of the document. They take the formatting of that paragraph. Works inside table cells too: the new paragraphs go into the same cell.',
    inputSchema: {
      type: 'object',
      properties: {
        where: {
          type: 'string',
          enum: ['after', 'before', 'end'],
          description: '"end" is the end of the document and needs no anchor',
        },
        anchor: {
          type: 'string',
          description: 'exact text found in the paragraph to add next to (not needed for "end")',
        },
        occurrence: { type: 'integer', minimum: 1 },
        paragraphs: {
          type: 'array',
          items: { type: 'string' },
          description: 'the new paragraphs in order, each one line; "" is an empty line',
        },
      },
      required: ['where', 'paragraphs'],
    },
  },
  {
    name: 'delete_paragraph',
    description:
      'Remove the whole paragraph that contains a piece of text. A paragraph that holds a table, a picture or a form field is not removed.',
    inputSchema: {
      type: 'object',
      properties: {
        find: { type: 'string', description: 'exact text found in the paragraph to remove' },
        occurrence: { type: 'integer', minimum: 1 },
      },
      required: ['find'],
    },
  },
  {
    name: 'insert_table',
    description:
      'Add a table after or before the paragraph that contains the anchor text, or at the end of the document. Cells are plain one-line text; short rows are padded with empty cells. The table takes the font of that paragraph. It cannot be put inside a cell of another table.',
    inputSchema: {
      type: 'object',
      properties: {
        where: { type: 'string', enum: ['after', 'before', 'end'] },
        anchor: { type: 'string', description: 'exact text found in the paragraph to add next to' },
        occurrence: { type: 'integer', minimum: 1 },
        rows: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } },
          description: 'the rows from top to bottom, each a list of cell texts',
        },
        header: {
          type: 'boolean',
          description: 'the first row names the columns: it is made bold, centred and shaded',
        },
      },
      required: ['where', 'rows'],
    },
  },
  {
    name: 'format_text',
    description:
      'Change the character formatting of a piece of text: one occurrence, or every occurrence with all. Only the properties you pass change.',
    inputSchema: {
      type: 'object',
      properties: {
        find: { type: 'string', description: 'the exact text to format, within one paragraph' },
        occurrence: { type: 'integer', minimum: 1 },
        all: { type: 'boolean', description: 'format every occurrence of the text' },
        ...TEXT_FORMAT_SCHEMA,
      },
      required: ['find'],
    },
  },
  {
    name: 'format_paragraph',
    description:
      'Change the formatting of the whole paragraph that contains a piece of text: its alignment and line spacing, and character formatting for all of its text. Only the properties you pass change.',
    inputSchema: {
      type: 'object',
      properties: {
        find: { type: 'string', description: 'exact text found in the paragraph to format' },
        occurrence: { type: 'integer', minimum: 1 },
        align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
        line_spacing: { type: 'number', description: 'line spacing in percent, for example 160' },
        ...TEXT_FORMAT_SCHEMA,
      },
      required: ['find'],
    },
  },
  {
    name: 'list_fields',
    description:
      'List the form fields (누름틀) of the document in document order: number, name, the guide text shown while empty, and the current value.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'fill_field',
    description:
      'Set the value of one form field, picked by its number from list_fields. The value is one line of text.',
    inputSchema: {
      type: 'object',
      properties: {
        field: { type: 'integer', minimum: 1, description: 'the field number from list_fields' },
        value: { type: 'string' },
      },
      required: ['field', 'value'],
    },
  },
]

const NOT_FOUND_HELP =
  'Not found; nothing was changed. The text must match exactly (letters, spaces, punctuation) and lie inside one paragraph or one table cell. Read that part of the document again. The guide text of an empty form field is not document text: use fill_field for it.'
const IN_TABLE_HELP =
  'Nothing was changed: that paragraph is inside a table cell, and a table cannot be put inside another table here. Anchor the new table to a paragraph of the body text, or add the content to the cell as paragraphs.'
const HAS_OBJECTS_HELP =
  'Nothing was changed: a table, a picture or a form field sits in that paragraph, and the change would have moved or removed it. Use the paragraph before or after it as the anchor, or tell the user.'
const ONE_LINE_HELP =
  'Text with a line break cannot be searched or inserted: a replacement stays inside one paragraph or table cell. Split the change into one call per paragraph.'

const hasLineBreak = (text: string) => /[\r\n]/.test(text)

const isWhere = (value: unknown): value is AgentWhere =>
  value === 'after' || value === 'before' || value === 'end'

const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')

/** Text of a change as the panel lists it: one line, cut when long. */
function changeText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > CHANGE_TEXT_CHARS ? `${flat.slice(0, CHANGE_TEXT_CHARS)}…` : flat
}

const TOGGLE_LABELS = {
  bold: 'aiFmtBold',
  italic: 'aiFmtItalic',
  underline: 'aiFmtUnderline',
  strikethrough: 'aiFmtStrike',
} as const satisfies Record<string, StringKey>

const ALIGN_LABELS = {
  left: 'aiFmtAlignLeft',
  center: 'aiFmtAlignCenter',
  right: 'aiFmtAlignRight',
  justify: 'aiFmtAlignJustify',
} as const satisfies Record<string, StringKey>

/**
 * The format a call asks for: the properties the model actually sent. What they may hold
 * is checked by the editor, which answers a bad value with a message the model can act on.
 */
function formatArgs(call: AgentToolCall): AgentParagraphFormat {
  const format: Record<string, unknown> = {}
  for (const key of [
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'size',
    'color',
    'highlight',
  ]) {
    const value = call.input[key]
    if (value !== undefined && value !== null) format[key] = value
  }
  if (call.input.align !== undefined && call.input.align !== null) format.align = call.input.align
  const spacing = call.input.line_spacing
  if (spacing !== undefined && spacing !== null) format.lineSpacing = spacing
  return format as AgentParagraphFormat
}

/** A format as the panel lists it: what was set, in the UI language. */
function describeFormat(
  format: AgentParagraphFormat,
  label: (key: StringKey, params?: Params) => string,
): string {
  const parts: string[] = []
  if (format.align) parts.push(label(ALIGN_LABELS[format.align]))
  for (const key of Object.keys(TOGGLE_LABELS) as (keyof typeof TOGGLE_LABELS)[]) {
    if (format[key] === undefined) continue
    const name = label(TOGGLE_LABELS[key])
    parts.push(format[key] ? name : label('aiFmtOff', { name }))
  }
  if (format.size !== undefined) parts.push(`${format.size}pt`)
  if (format.color !== undefined) parts.push(`${label('aiFmtColor')} ${format.color}`)
  if (format.highlight !== undefined) {
    const name = label('aiFmtHighlight')
    parts.push(
      format.highlight === 'none' ? label('aiFmtOff', { name }) : `${name} ${format.highlight}`,
    )
  }
  if (format.lineSpacing !== undefined) {
    parts.push(`${label('aiFmtLineSpacing')} ${format.lineSpacing}%`)
  }
  return parts.join(' · ')
}

/** Why a paragraph edit did nothing, as the model reads it. */
function placeRefusal(result: AgentPlaceRefusal): string {
  switch (result.reason) {
    case 'ambiguous':
      return (
        `The text occurs ${result.count} times; nothing was changed. Pass occurrence to say which paragraph you mean.\n` +
        matchLines(result.matches ?? [], result.count)
      )
    case 'no_such_occurrence':
      return `occurrence must be between 1 and ${result.count}; nothing was changed.`
    case 'unsupported_place':
      return 'That text is inside an equation, which is not a paragraph that can be edited here.'
    case 'has_objects':
      return HAS_OBJECTS_HELP
    default:
      return NOT_FOUND_HELP
  }
}

function quote(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > LABEL_QUOTE_CHARS ? `${flat.slice(0, LABEL_QUOTE_CHARS)}…` : flat
}

function matchLine(match: AgentMatch): string {
  const place = match.inTable ? ' (in a table)' : ''
  if (match.replaceable === false) return `#${match.occurrence}${place}: inside an equation`
  return `#${match.occurrence}${place}: …${match.context ?? ''}…`
}

function matchLines(matches: AgentMatch[], count: number): string {
  const lines = matches.map(matchLine)
  if (count > matches.length) lines.push(`(only the first ${matches.length} are listed)`)
  return lines.join('\n')
}

/** A replacement as an activity label; it reads the same in every language. */
const arrow = (from: string, to: string) => `“${quote(from)}” → “${quote(to)}”`

const NO_FORMAT_HELP =
  'Name at least one property to change: bold, italic, underline, strikethrough, size, color, highlight, and for a paragraph align or line_spacing.'
const WHERE_HELP =
  'where must be "after", "before" or "end"; with "after" and "before" an anchor text is needed.'

/** Where a paragraph edit goes, or null when the call does not say so. */
function placeArgs(
  call: AgentToolCall,
): { where: AgentWhere; anchor: string; occurrence: number | null } | null {
  const { where, occurrence } = call.input
  const anchor = textArg(call, 'anchor') ?? ''
  if (!isWhere(where)) return null
  if (where !== 'end' && (!anchor || hasLineBreak(anchor))) return null
  return { where, anchor, occurrence: typeof occurrence === 'number' ? occurrence : null }
}

/** The string argument `key`, or null when the model did not send one. */
function textArg(call: AgentToolCall, key: string): string | null {
  const value = call.input[key]
  return typeof value === 'string' ? value : null
}

export function createHwpSkill(deps: HwpSkillDeps): HwpSkill {
  const { bridge, label } = deps
  let context = ''

  const bad = (call: AgentToolCall, output: string): ToolExecution => ({
    output,
    isError: true,
    // named by what the call was about, which the user recognizes; the tool name is the fallback
    summary: label('aiToolNotDone', {
      what: quote(
        textArg(call, 'find') ??
          textArg(call, 'text') ??
          textArg(call, 'anchor') ??
          (typeof call.input.field === 'number' ? `#${call.input.field}` : call.name),
      ),
    }),
  })

  const run = async (call: AgentToolCall): Promise<ToolExecution> => {
    switch (call.name) {
      case 'read_document': {
        const text = await bridge.readText()
        const raw = call.input.offset
        const offset =
          typeof raw === 'number' && Number.isInteger(raw) && raw > 0
            ? Math.min(raw, text.length)
            : 0
        const end = Math.min(text.length, offset + READ_PAGE_CHARS)
        const more = end < text.length ? `\n[more: call read_document with offset ${end}]` : ''
        return {
          output: `Characters ${offset}–${end} of ${text.length}.\n${text.slice(offset, end)}${more}`,
          summary: label('aiToolRead'),
        }
      }
      case 'find_text': {
        const text = textArg(call, 'text')
        if (!text) return bad(call, 'text must be a non-empty string')
        if (hasLineBreak(text)) return bad(call, ONE_LINE_HELP)
        const found = await bridge.findText(text)
        return {
          output:
            found.count === 0
              ? 'No occurrence.'
              : `${found.count} occurrence(s).\n${matchLines(found.matches, found.count)}`,
          summary: label('aiToolFind', { text: quote(text), count: found.count }),
        }
      }
      case 'replace_text': {
        const find = textArg(call, 'find')
        const replace = textArg(call, 'replace')
        if (!find || replace === null) return bad(call, 'find and replace must be strings')
        if (hasLineBreak(find) || hasLineBreak(replace)) return bad(call, ONE_LINE_HELP)
        const occurrence = call.input.occurrence
        const result = await bridge.replaceText(
          find,
          replace,
          typeof occurrence === 'number' ? occurrence : null,
        )
        if (result.ok) {
          deps.onChange({ kind: 'replace', from: find, to: replace, count: 1 })
          return {
            output: result.inTable ? 'Replaced (in a table cell).' : 'Replaced.',
            mutated: true,
            summary: arrow(find, replace),
          }
        }
        if (result.reason === 'ambiguous') {
          return bad(
            call,
            `The text occurs ${result.count} times; nothing was changed. Pass occurrence to pick one, or use replace_all.\n` +
              matchLines(result.matches ?? [], result.count),
          )
        }
        if (result.reason === 'no_such_occurrence') {
          return bad(call, `occurrence must be between 1 and ${result.count}; nothing was changed.`)
        }
        if (result.reason === 'unsupported_place') {
          return bad(call, 'That occurrence is inside an equation, which cannot be edited here.')
        }
        return bad(call, NOT_FOUND_HELP)
      }
      case 'replace_all': {
        const find = textArg(call, 'find')
        const replace = textArg(call, 'replace')
        if (!find || replace === null) return bad(call, 'find and replace must be strings')
        if (hasLineBreak(find) || hasLineBreak(replace)) return bad(call, ONE_LINE_HELP)
        const result = await bridge.replaceAllText(find, replace)
        if (!result.ok) return bad(call, NOT_FOUND_HELP)
        deps.onChange({ kind: 'replaceAll', from: find, to: replace, count: result.count })
        return {
          output: `Replaced ${result.count} occurrence(s).`,
          mutated: true,
          summary: `${arrow(find, replace)} ×${result.count}`,
        }
      }
      case 'insert_paragraphs': {
        const place = placeArgs(call)
        const paragraphs = call.input.paragraphs
        if (!place) return bad(call, WHERE_HELP)
        if (!isTextList(paragraphs))
          return bad(call, 'paragraphs must be a non-empty list of strings')
        if (paragraphs.some(hasLineBreak)) return bad(call, ONE_LINE_HELP)
        const result = await bridge.insertParagraphs(
          place.anchor,
          place.occurrence,
          place.where,
          paragraphs,
        )
        if (!result.ok) return bad(call, placeRefusal(result))
        deps.onChange({
          kind: 'insert',
          from: '',
          to: changeText(paragraphs.filter(Boolean).join(' ⏎ ')),
          count: 1,
        })
        return {
          output: `Added ${result.count} paragraph(s)${result.inTable ? ' in the table cell' : ''}.`,
          mutated: true,
          summary: label('aiToolInsert', { count: result.count }),
        }
      }
      case 'delete_paragraph': {
        const find = textArg(call, 'find')
        if (!find) return bad(call, 'find must be a non-empty string')
        if (hasLineBreak(find)) return bad(call, ONE_LINE_HELP)
        const occurrence = call.input.occurrence
        const result = await bridge.deleteParagraph(
          find,
          typeof occurrence === 'number' ? occurrence : null,
        )
        if (!result.ok) return bad(call, placeRefusal(result))
        deps.onChange({ kind: 'delete', from: changeText(result.text), to: '', count: 1 })
        return {
          output: result.emptied
            ? 'The paragraph was emptied. It is the first paragraph of its cell or section, so its empty line stays.'
            : 'Removed the paragraph.',
          mutated: true,
          summary: label('aiToolDelete', { text: quote(result.text) }),
        }
      }
      case 'insert_table': {
        const place = placeArgs(call)
        const rows = call.input.rows
        if (!place) return bad(call, WHERE_HELP)
        if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isTextList)) {
          return bad(
            call,
            'rows must be a non-empty list of rows, each a non-empty list of strings',
          )
        }
        if (rows.some((row) => row.some(hasLineBreak))) return bad(call, ONE_LINE_HELP)
        const result = await bridge.insertTable(
          place.anchor,
          place.occurrence,
          place.where,
          rows,
          call.input.header === true,
        )
        if (!result.ok) {
          return bad(call, result.reason === 'in_table' ? IN_TABLE_HELP : placeRefusal(result))
        }
        deps.onChange({
          kind: 'table',
          from: '',
          to: changeText(rows[0]!.join(' | ')),
          count: 1,
        })
        return {
          output: `Added a table of ${result.rows} row(s) and ${result.cols} column(s).`,
          mutated: true,
          summary: label('aiToolTable', { rows: result.rows, cols: result.cols }),
        }
      }
      case 'format_text': {
        const find = textArg(call, 'find')
        if (!find) return bad(call, 'find must be a non-empty string')
        if (hasLineBreak(find)) return bad(call, ONE_LINE_HELP)
        const format = formatArgs(call)
        if (Object.keys(format).length === 0) return bad(call, NO_FORMAT_HELP)
        const occurrence = call.input.occurrence
        const result = await bridge.formatText(
          find,
          typeof occurrence === 'number' ? occurrence : null,
          call.input.all === true,
          format,
        )
        if (!result.ok) {
          return bad(
            call,
            result.reason === 'ambiguous'
              ? `The text occurs ${result.count} times; nothing was changed. Pass occurrence to pick one, or all to format every one.\n` +
                  matchLines(result.matches ?? [], result.count)
              : placeRefusal(result),
          )
        }
        deps.onChange({
          kind: 'format',
          from: changeText(find),
          to: describeFormat(format, label),
          count: result.count,
        })
        return {
          output: `Formatted ${result.count} occurrence(s).`,
          mutated: true,
          summary: label('aiToolFormat', { text: quote(find) }),
        }
      }
      case 'format_paragraph': {
        const find = textArg(call, 'find')
        if (!find) return bad(call, 'find must be a non-empty string')
        if (hasLineBreak(find)) return bad(call, ONE_LINE_HELP)
        const format = formatArgs(call)
        if (Object.keys(format).length === 0) return bad(call, NO_FORMAT_HELP)
        const occurrence = call.input.occurrence
        const result = await bridge.formatParagraph(
          find,
          typeof occurrence === 'number' ? occurrence : null,
          format,
        )
        if (!result.ok) {
          return bad(
            call,
            result.reason === 'unsupported_place'
              ? 'Nothing was changed: the alignment and line spacing of that paragraph cannot be set here (it is inside an equation, or in a table inside another table). Its character formatting can still be changed with format_text.'
              : placeRefusal(result),
          )
        }
        deps.onChange({
          kind: 'format',
          from: changeText(find),
          to: describeFormat(format, label),
          count: 1,
        })
        return {
          output: `Formatted the paragraph${result.inTable ? ' in the table cell' : ''}.`,
          mutated: true,
          summary: label('aiToolFormat', { text: quote(find) }),
        }
      }
      case 'list_fields': {
        const fields = await bridge.listFields()
        return {
          output:
            fields.length === 0
              ? 'This document has no form fields.'
              : JSON.stringify(fields, null, 1),
          summary: label('aiToolFields', { count: fields.length }),
        }
      }
      case 'fill_field': {
        const field = call.input.field
        const value = textArg(call, 'value')
        if (typeof field !== 'number' || value === null) {
          return bad(call, 'field must be a number from list_fields and value a string')
        }
        if (hasLineBreak(value)) return bad(call, ONE_LINE_HELP)
        const result = await bridge.fillField(field, value)
        if (!result.ok) {
          return bad(
            call,
            result.count === 0
              ? 'This document has no form fields.'
              : `There is no field ${field}: the document has ${result.count}. Call list_fields for the numbers.`,
          )
        }
        // by number first: names repeat, and a field nobody named has none
        const name = [`#${field}`, result.name.trim()].filter(Boolean).join(' ')
        deps.onChange({ kind: 'field', from: name, to: value, count: 1 })
        return {
          output: 'Filled.',
          mutated: true,
          summary: label('aiToolFill', { name: quote(name) }),
        }
      }
      default:
        return bad(call, `unknown tool: ${call.name}`)
    }
  }

  return {
    skill: {
      id: 'hwp',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      buildContext: () => context,
      executeTool: async (call) => {
        try {
          return await run(call)
        } catch (error) {
          // the editor refused or is gone: the model gets the cause and can say so
          return bad(call, error instanceof Error ? error.message : String(error))
        }
      },
    },
    refreshContext: async () => {
      try {
        const [text, fields] = await Promise.all([bridge.readText(), bridge.listFields()])
        // numbered: the number is what fill_field takes, and names repeat
        const names = fields
          .slice(0, CONTEXT_MAX_FIELDS)
          .map((field) => `${field.field}. ${field.name || field.guide || '(unnamed)'}`)
        const whole = text.length <= CONTEXT_MAX_CHARS
        context = [
          '## Open document',
          `Length: ${text.length} characters.`,
          fields.length === 0
            ? 'Form fields: none.'
            : `Form fields (${fields.length}): ${names.join(', ')}${fields.length > names.length ? ', …' : ''}`,
          whole
            ? 'Text (complete):'
            : `Text (the first ${CONTEXT_MAX_CHARS} characters; read_document returns the rest):`,
          whole ? text : text.slice(0, CONTEXT_MAX_CHARS),
        ].join('\n')
      } catch {
        // without a readable document the model is told so and can still answer
        context = '## Open document\nThe document could not be read right now.'
      }
    },
  }
}
