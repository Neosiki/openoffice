export declare const AGENT_PLUGIN_ID: 'ieum-agent'

/** One place a searched text occurs. */
export interface AgentMatch {
  /** 1-based position among all matches, in reading order */
  occurrence: number
  inTable: boolean
  /** the match with some text around it; absent when it could not be read */
  context?: string
  /** false for text inside an equation, which has no replace path */
  replaceable?: false
}

export interface AgentFindResult {
  count: number
  /** the first matches only; `count` is the real total */
  matches: AgentMatch[]
}

/**
 * Where a change is, for the editor to show: the paragraph (for a cell, the body paragraph
 * its table sits in and the path to the cell paragraph), and a run of characters in it.
 */
export interface AgentPlace {
  sec: number
  para: number
  path?: { controlIndex: number; cellIndex: number; cellParaIndex: number }[]
  offset: number
  length: number
}

export type AgentReplaceResult =
  | { ok: true; count: number; inTable: boolean; place: AgentPlace }
  | {
      ok: false
      reason: 'not_found' | 'ambiguous' | 'no_such_occurrence' | 'unsupported_place'
      count: number
      matches?: AgentMatch[]
    }

export type AgentReplaceAllResult =
  { ok: true; count: number; place: AgentPlace } | { ok: false; reason: 'not_found'; count: 0 }

/** Why a paragraph edit did nothing: the anchor could not be decided, or an object is in the way. */
export interface AgentPlaceRefusal {
  ok: false
  reason: 'not_found' | 'ambiguous' | 'no_such_occurrence' | 'unsupported_place' | 'has_objects'
  count: number
  matches?: AgentMatch[]
}

/** Where a paragraph edit goes relative to the anchor paragraph; "end" is the end of the document. */
export type AgentWhere = 'after' | 'before' | 'end'

export type AgentInsertResult =
  { ok: true; count: number; inTable: boolean; place: AgentPlace } | AgentPlaceRefusal

export type AgentDeleteResult =
  | {
      ok: true
      /** the removed text, cut to a few hundred characters */
      text: string
      /** the paragraph kept its place as an empty line (the first of its cell or section) */
      emptied: boolean
      inTable: boolean
      place: AgentPlace
    }
  | AgentPlaceRefusal

export type AgentTableResult =
  | { ok: true; rows: number; cols: number; inTable: boolean; place: AgentPlace }
  | AgentPlaceRefusal
  /** the anchor is inside a table cell, where a table cannot be made */
  | { ok: false; reason: 'in_table'; count: number }

/** Character formatting to change; what is left out stays as it is. */
export interface AgentTextFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  /** font size in points */
  size?: number
  /** text colour, #RRGGBB */
  color?: string
  /** highlight colour, #RRGGBB, or "none" to take it away */
  highlight?: string
}

/** Formatting of a whole paragraph: its own properties, and character formatting for all its text. */
export interface AgentParagraphFormat extends AgentTextFormat {
  align?: 'left' | 'center' | 'right' | 'justify'
  /** line spacing in percent of the font height */
  lineSpacing?: number
}

export type AgentFormatTextResult =
  | { ok: true; count: number; place: AgentPlace }
  | {
      ok: false
      reason: 'not_found' | 'ambiguous' | 'no_such_occurrence' | 'unsupported_place' | 'has_objects'
      count: number
      matches?: AgentMatch[]
    }

export type AgentFormatParagraphResult =
  { ok: true; inTable: boolean; place: AgentPlace } | AgentPlaceRefusal

/** One table of the document, as listTables lists it. */
export interface AgentTableSummary {
  /** 1-based position among all tables in reading order; what readTable and fillCells take */
  table: number
  rows: number
  cols: number
  /** the number of the table whose cell this one sits in; absent for a table of the body */
  inTable?: number
  /** the line of text the table follows, cut short; empty when there is none close by */
  near: string
  /** the text of its first cells that hold any, each cut short */
  preview: string[]
}

export interface AgentTableList {
  /** all tables found; `tables` holds the first ones only */
  count: number
  /** the search for tables inside table cells ran out of budget: some may be missing */
  partial: boolean
  tables: AgentTableSummary[]
}

/** One cell of a table. A merged cell is listed once, at its first row and column. */
export interface AgentTableCell {
  /** 1-based */
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  /** the paragraphs of the cell joined by line breaks, cut when long */
  text: string
  /** numbers (as in listFields) of the click-here fields that sit in the cell */
  fields?: number[]
  /** a picture, a shape or a table sits in the cell or floats over it: not empty, whatever its text */
  object?: true
}

export type AgentReadTableResult =
  | {
      ok: true
      table: number
      rows: number
      cols: number
      cells: AgentTableCell[]
      /** the table goes on: the row to read from next */
      nextRow?: number
    }
  | { ok: false; reason: 'no_such_table'; count: number }

/** Text for one cell: 1-based place, and the text (a line break starts a new paragraph). */
export interface AgentCellText {
  row: number
  col: number
  text: string
}

export type AgentFillCellsResult =
  | { ok: true; table: number; count: number; place: AgentPlace }
  | { ok: false; reason: 'no_such_table'; count: number }
  | {
      ok: false
      /**
       * no_such_cell: the places are outside the table. occupied: the cells hold text and
       * overwrite was not given. has_fields: the cells hold several form fields each.
       * holds_object: the cells hold a picture or another object.
       */
      reason: 'no_such_cell' | 'occupied' | 'has_fields' | 'holds_object'
      cells: { row: number; col: number; text?: string; fields?: number[] }[]
      rows: number
      cols: number
    }
  /** the change would have removed an object of the document, and was rolled back */
  | { ok: false; reason: 'has_objects'; count: number }

export interface AgentField {
  /** 1-based position in the document; what fillField takes */
  field: number
  /** not unique: a field nobody named carries its guide text */
  name: string
  guide: string
  value: string
  /** a named table cell rather than a click-here field */
  inCell: boolean
}

export type AgentFillResult =
  | { ok: true; name: string; place?: AgentPlace }
  | { ok: false; reason: 'no_such_field'; count: number }

/** Rows or columns of a table. */
export type AgentTableLines = 'rows' | 'columns'

/** Why a row or column call did nothing. */
export type AgentTableLinesRefusal =
  | { ok: false; reason: 'no_such_table'; count: number }
  | {
      ok: false
      /**
       * nested: the table sits inside a cell of another table, where the engine cannot add
       * or remove lines. no_such_line: the row or column is outside the table.
       * would_empty: nothing would be left of the table.
       */
      reason: 'nested' | 'no_such_line' | 'would_empty'
      rows: number
      cols: number
    }
  | {
      ok: false
      /** cells of those lines hold a picture or another object */
      reason: 'holds_object'
      cells: { row: number; col: number }[]
      rows: number
      cols: number
    }
  | { ok: false; reason: 'has_objects'; count: number }

export type AgentAddLinesResult =
  | {
      ok: true
      table: number
      /** the size of the table now */
      rows: number
      cols: number
      /** 1-based number of the first new row or column */
      first: number
      count: number
      place?: AgentPlace
    }
  | AgentTableLinesRefusal

export type AgentRemoveLinesResult =
  | {
      ok: true
      table: number
      rows: number
      cols: number
      count: number
      /** the text that went with them, cut to a few hundred characters */
      text: string
      place: AgentPlace
    }
  | AgentTableLinesRefusal

export type AgentUndoResult =
  { ok: boolean; undone: number } | { ok: false; reason: 'changed'; undone: 0 }

/** What the plugin answers to, by method name (the studio's `plugins.invoke`). */
export interface AgentPluginSurface {
  foreignChanges(): number
  readText(): string
  findText(find: string): AgentFindResult
  replaceText(find: string, replacement: string, occurrence?: number | null): AgentReplaceResult
  replaceAllText(find: string, replacement: string): AgentReplaceAllResult
  insertParagraphs(
    anchor: string,
    occurrence: number | null,
    where: AgentWhere,
    paragraphs: string[],
  ): AgentInsertResult
  deleteParagraph(find: string, occurrence: number | null): AgentDeleteResult
  insertTable(
    anchor: string,
    occurrence: number | null,
    where: AgentWhere,
    rows: string[][],
    header?: boolean,
  ): AgentTableResult
  formatText(
    find: string,
    occurrence: number | null,
    all: boolean,
    format: AgentTextFormat,
  ): AgentFormatTextResult
  formatParagraph(
    find: string,
    occurrence: number | null,
    format: AgentParagraphFormat,
  ): AgentFormatParagraphResult
  listTables(): AgentTableList
  readTable(table: number, fromRow?: number | null): AgentReadTableResult
  fillCells(table: number, cells: AgentCellText[], overwrite: boolean): AgentFillCellsResult
  addTableLines(
    table: number,
    what: AgentTableLines,
    at: number,
    where: 'after' | 'before',
    count: number,
  ): AgentAddLinesResult
  removeTableLines(
    table: number,
    what: AgentTableLines,
    at: number,
    count: number,
  ): AgentRemoveLinesResult
  reveal(place: AgentPlace): { ok: boolean }
  listFields(): AgentField[]
  fillField(field: number, value: string): AgentFillResult
  undo(steps: number, expectedForeign: number): AgentUndoResult
}

/** The part of the studio's plugin host this plugin uses. */
export interface AgentPluginHost {
  read<T>(fn: (doc: never) => T): T
  transaction<T>(label: string, fn: (tx: { doc(): never; deferPagination(): void }) => T): T
  events: { on(name: 'document-changed', handler: () => void): unknown }
  automation: {
    execute(command: string, params?: unknown): { ok?: boolean } | null | undefined
    registerCommand?(command: {
      id: string
      label: string
      execute(services: never, params?: never): void
    }): void
  }
}

export declare const agentPlugin: {
  id: typeof AGENT_PLUGIN_ID
  apiVersion: 1
  activate(host: AgentPluginHost): AgentPluginSurface
}

export default agentPlugin
