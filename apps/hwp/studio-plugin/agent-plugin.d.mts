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

export type AgentReplaceResult =
  | { ok: true; count: number; inTable: boolean }
  | {
      ok: false
      reason: 'not_found' | 'ambiguous' | 'no_such_occurrence' | 'unsupported_place'
      count: number
      matches?: AgentMatch[]
    }

export type AgentReplaceAllResult =
  { ok: true; count: number } | { ok: false; reason: 'not_found'; count: 0 }

/** Why a paragraph edit did nothing: the anchor could not be decided, or an object is in the way. */
export interface AgentPlaceRefusal {
  ok: false
  reason: 'not_found' | 'ambiguous' | 'no_such_occurrence' | 'unsupported_place' | 'has_objects'
  count: number
  matches?: AgentMatch[]
}

/** Where a paragraph edit goes relative to the anchor paragraph; "end" is the end of the document. */
export type AgentWhere = 'after' | 'before' | 'end'

export type AgentInsertResult = { ok: true; count: number; inTable: boolean } | AgentPlaceRefusal

export type AgentDeleteResult =
  | {
      ok: true
      /** the removed text, cut to a few hundred characters */
      text: string
      /** the paragraph kept its place as an empty line (the first of its cell or section) */
      emptied: boolean
      inTable: boolean
    }
  | AgentPlaceRefusal

export type AgentTableResult =
  | { ok: true; rows: number; cols: number; inTable: boolean }
  | AgentPlaceRefusal
  /** the anchor is inside a table cell, where a table cannot be made */
  | { ok: false; reason: 'in_table'; count: number }

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
  { ok: true; name: string } | { ok: false; reason: 'no_such_field'; count: number }

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
  ): AgentTableResult
  listFields(): AgentField[]
  fillField(field: number, value: string): AgentFillResult
  undo(steps: number, expectedForeign: number): AgentUndoResult
}

/** The part of the studio's plugin host this plugin uses. */
export interface AgentPluginHost {
  read<T>(fn: (doc: never) => T): T
  transaction<T>(label: string, fn: (tx: { doc(): never; deferPagination(): void }) => T): T
  events: { on(name: 'document-changed', handler: () => void): unknown }
  automation: { execute(command: string): { ok?: boolean } | null | undefined }
}

export declare const agentPlugin: {
  id: typeof AGENT_PLUGIN_ID
  apiVersion: 1
  activate(host: AgentPluginHost): AgentPluginSurface
}

export default agentPlugin
