/**
 * Rules behind the project-folder parts of the AI panel (decision 0088): what
 * the project list shows and in which order, what the chat menu shows, and
 * which sentence each notice or event line says. Pure functions; the
 * components only lay these out.
 */
import { htmlLang, type Lang } from '@genoffice/i18n'
import type {
  LegacyDocumentChat,
  ProjectChatListItem,
  ProjectEditor,
  ProjectId,
  ProjectListItem,
  ProjectMemoryOp,
  ProjectNotice,
  ProjectScreenSection,
} from '@genoffice/project-store'
import { projectPanelText, type ProjectPanelStringKey } from './strings-project-panel'

// ────────────────────────────────────────────────────────────
// Matching
// ────────────────────────────────────────────────────────────

/**
 * Search text in a comparable form: trimmed, NFC (macOS paths arrive
 * decomposed), lowercased. Empty means "no filter".
 */
export function projectSearchKey(text: string): string {
  return text.normalize('NFC').trim().toLocaleLowerCase()
}

function includesKey(haystack: string, key: string): boolean {
  return haystack.normalize('NFC').toLocaleLowerCase().includes(key)
}

/** Whether a project matches the search text by name or folder path */
export function projectMatchesQuery(project: ProjectListItem, query: string): boolean {
  const key = projectSearchKey(query)
  if (!key) return true
  return includesKey(project.name, key) || includesKey(project.path, key)
}

function timeOf(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

// ────────────────────────────────────────────────────────────
// Project list
// ────────────────────────────────────────────────────────────

/** One row of the project list, top to bottom */
export type ProjectPickerItem =
  /** "'<name>' new project": only when the search text matches no project */
  | { readonly kind: 'create'; readonly name: string }
  | {
      readonly kind: 'project'
      readonly project: ProjectListItem
      readonly group: 'pinned' | 'recent'
    }
  /** "+ New project" */
  | { readonly kind: 'new' }
  /** "Add folder" */
  | { readonly kind: 'add-folder' }
  /** "No project" */
  | { readonly kind: 'none' }

/**
 * The project list for a search text. Pinned projects come first in name
 * order (they stay put), then the others by last use, newest first. A search
 * text that matches no project puts "'<text>' new project" on top. The fixed
 * rows ("+ New project", "Add folder", "No project") always follow.
 */
export function projectPickerItems(
  projects: readonly ProjectListItem[],
  query: string,
  lang: Lang = 'en',
): ProjectPickerItem[] {
  const seen = new Set<ProjectId>()
  const matched = projects.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return projectMatchesQuery(p, query)
  })
  const collator = new Intl.Collator(htmlLang(lang), { sensitivity: 'base', numeric: true })
  const pinned = matched
    .filter((p) => p.pinned)
    .sort((a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id))
  const recent = matched
    .filter((p) => !p.pinned)
    .sort(
      (a, b) =>
        timeOf(b.lastUsedAt) - timeOf(a.lastUsedAt) ||
        collator.compare(a.name, b.name) ||
        a.id.localeCompare(b.id),
    )
  const items: ProjectPickerItem[] = []
  const name = query.normalize('NFC').trim()
  if (name && matched.length === 0) items.push({ kind: 'create', name })
  for (const project of pinned) items.push({ kind: 'project', project, group: 'pinned' })
  for (const project of recent) items.push({ kind: 'project', project, group: 'recent' })
  items.push({ kind: 'new' }, { kind: 'add-folder' }, { kind: 'none' })
  return items
}

/** The row highlighted when the list opens: the chosen project, else "No project" when none is chosen, else the top row */
export function projectPickerInitialIndex(
  items: readonly ProjectPickerItem[],
  selectedId: ProjectId | null,
): number {
  const index = items.findIndex((item) =>
    selectedId === null
      ? item.kind === 'none'
      : item.kind === 'project' && item.project.id === selectedId,
  )
  return index >= 0 ? index : 0
}

/** What activating a row asks the caller to do */
export type ProjectPickerAction =
  | { readonly type: 'select'; readonly projectId: ProjectId | null }
  /** A missing folder: the caller opens a folder picker to relocate it */
  | { readonly type: 'relocate'; readonly projectId: ProjectId }
  /** "+ New project" (no name) or "'<name>' new project" */
  | { readonly type: 'create'; readonly name?: string }
  | { readonly type: 'add-folder' }

export function projectPickerAction(item: ProjectPickerItem): ProjectPickerAction {
  switch (item.kind) {
    case 'create':
      return { type: 'create', name: item.name }
    case 'project':
      return item.project.missing
        ? { type: 'relocate', projectId: item.project.id }
        : { type: 'select', projectId: item.project.id }
    case 'new':
      return { type: 'create' }
    case 'add-folder':
      return { type: 'add-folder' }
    case 'none':
      return { type: 'select', projectId: null }
  }
}

/** Next highlighted row for ↑/↓ (wrapping), Home and End */
export function stepIndex(
  current: number,
  count: number,
  key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
): number {
  if (count <= 0) return 0
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  const delta = key === 'ArrowDown' ? 1 : -1
  return (((current + delta) % count) + count) % count
}

/** The chip's text: the chosen project's name, "No project", or a generic label while the list is not loaded */
export function projectChipText(
  lang: Lang,
  projects: readonly ProjectListItem[],
  selectedId: ProjectId | null,
): string {
  if (selectedId === null) return projectPanelText(lang, 'noProject')
  const found = projects.find((p) => p.id === selectedId)
  return found?.name || projectPanelText(lang, 'projectFallback')
}

// ────────────────────────────────────────────────────────────
// Chat menu
// ────────────────────────────────────────────────────────────

/** One row of the chat menu, top to bottom */
export type ProjectChatMenuItem =
  | { readonly kind: 'new' }
  | { readonly kind: 'chat'; readonly chat: ProjectChatListItem }
  /** "Earlier chat of this document" (the project-store chat from before projects) */
  | { readonly kind: 'legacy'; readonly legacy: LegacyDocumentChat }

/** Chats matching the search text by title, newest `updatedAt` first */
export function projectChatRows(
  chats: readonly ProjectChatListItem[],
  query: string,
): ProjectChatListItem[] {
  const key = projectSearchKey(query)
  return chats
    .filter((c) => !key || includesKey(c.title, key))
    .sort((a, b) => timeOf(b.updatedAt) - timeOf(a.updatedAt) || a.id.localeCompare(b.id))
}

/** [New chat] on top, the matching chats, then the earlier document chat when there is one */
export function projectChatMenuItems(
  chats: readonly ProjectChatListItem[],
  query: string,
  legacy: LegacyDocumentChat | null | undefined,
): ProjectChatMenuItem[] {
  const items: ProjectChatMenuItem[] = [{ kind: 'new' }]
  for (const chat of projectChatRows(chats, query)) items.push({ kind: 'chat', chat })
  if (legacy) items.push({ kind: 'legacy', legacy })
  return items
}

/** The chat button's text */
export function projectChatTitle(
  lang: Lang,
  chats: readonly ProjectChatListItem[],
  currentChatId: ProjectId | null,
  options: { readonly legacyActive?: boolean; readonly currentTitle?: string } = {},
): string {
  if (options.legacyActive) return projectPanelText(lang, 'legacyChat')
  const found = currentChatId ? chats.find((c) => c.id === currentChatId) : undefined
  const title = (found?.title ?? options.currentTitle ?? '').trim()
  if (title) return title
  return found ? projectPanelText(lang, 'untitledChat') : projectPanelText(lang, 'newChat')
}

const EDITOR_KEY: Record<ProjectEditor, ProjectPanelStringKey> = {
  docs: 'editorDocs',
  sheets: 'editorSheets',
  slides: 'editorSlides',
  pdf: 'editorPdf',
  markdown: 'editorMarkdown',
  html: 'editorHtml',
  mindmap: 'editorMindmap',
  hwp: 'editorHwp',
  epub: 'editorEpub',
  home: 'editorHome',
}

/** The editor's name as the panel shows it ("Docs", "HWP", "Home", …) */
export function projectEditorLabel(lang: Lang, editor: ProjectEditor): string {
  return projectPanelText(lang, EDITOR_KEY[editor] ?? 'editorDocs')
}

/**
 * When a chat was last used, said briefly in the reader's language: "now",
 * "5 minutes ago", "yesterday", then a short date (with the year when it is
 * not this year). An unreadable time gives ''.
 */
export function projectRelativeTime(iso: string, now: number, lang: Lang): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const locale = htmlLang(lang)
  const seconds = Math.round((t - now) / 1000)
  const abs = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (abs < 45) return rtf.format(0, 'second')
  if (abs < 45 * 60) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 22 * 3600) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 6 * 86400) return rtf.format(Math.round(seconds / 86400), 'day')
  const sameYear = new Date(t).getFullYear() === new Date(now).getFullYear()
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(t)
}

/** The full time, for a tooltip */
export function projectFullTime(iso: string, lang: Lang): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Intl.DateTimeFormat(htmlLang(lang), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(t)
}

// ────────────────────────────────────────────────────────────
// Notice and event lines
// ────────────────────────────────────────────────────────────

/** The button a notice line offers */
export type ProjectNoticeAction =
  /** "[View]": opens the home project screen at that section */
  | { readonly type: 'view'; readonly section: ProjectScreenSection }
  /** "[Tidy up]": the person-triggered memory consolidation */
  | { readonly type: 'consolidate' }

export interface ProjectNoticeView {
  readonly text: string
  /** `warning` for what loses data (chats and memory not saved); `info` otherwise */
  readonly tone: 'info' | 'warning'
  readonly action?: ProjectNoticeAction
}

/** What a notice line says and offers */
export function projectNoticeView(lang: Lang, notice: ProjectNotice): ProjectNoticeView {
  switch (notice.kind) {
    case 'instructions-changed':
      return {
        text: projectPanelText(lang, 'instructionsChanged'),
        tone: 'info',
        action: { type: 'view', section: 'instructions' },
      }
    case 'memory-changed':
      return {
        text: projectPanelText(lang, 'memoryChanged'),
        tone: 'info',
        action: { type: 'view', section: 'memory' },
      }
    case 'memory-long':
      return {
        text: projectPanelText(lang, 'memoryLong'),
        tone: 'info',
        action: { type: 'consolidate' },
      }
    case 'instructions-truncated':
      return { text: projectPanelText(lang, 'instructionsTruncated'), tone: 'info' }
    case 'unwritable':
      return { text: projectPanelText(lang, 'unwritable'), tone: 'warning' }
    case 'sync-folder':
      // the service is never named: "that service" in every language
      return { text: projectPanelText(lang, 'syncFolder'), tone: 'info' }
  }
}

/** The label of a notice action's button */
export function projectNoticeActionLabel(lang: Lang, action: ProjectNoticeAction): string {
  return projectPanelText(lang, action.type === 'view' ? 'view' : 'consolidate')
}

/** "Remembered: …", "Memory changed: …" or "Memory removed: …" for one `project_remember` change */
export function projectMemoryEventText(lang: Lang, change: ProjectMemoryOp): string {
  switch (change.op) {
    case 'add':
      return projectPanelText(lang, 'memoryAdded', { text: change.text })
    case 'replace':
      return projectPanelText(lang, 'memoryReplaced', { text: change.new })
    case 'remove':
      return projectPanelText(lang, 'memoryRemoved', { text: change.text })
  }
}

/** "Memory tidied up (N → M entries)" */
export function projectConsolidatedText(lang: Lang, before: number, after: number): string {
  return projectPanelText(lang, 'memoryConsolidated', { before, after })
}

/**
 * The one-line summary of another editor's tool records in a reopened chat:
 * "Ran tools 3 times in HWP 'report.hwp'". `documentName` is absent for the
 * home ask panel and untitled documents.
 */
export function projectToolSummaryText(
  lang: Lang,
  summary: {
    readonly editor: ProjectEditor
    readonly documentName?: string | undefined
    readonly count: number
  },
): string {
  const editor = projectEditorLabel(lang, summary.editor)
  const name = summary.documentName?.trim()
  const one = summary.count === 1
  if (name) {
    return projectPanelText(lang, one ? 'toolSummaryOne' : 'toolSummary', {
      editor,
      name,
      count: summary.count,
    })
  }
  return projectPanelText(lang, one ? 'toolSummaryNoNameOne' : 'toolSummaryNoName', {
    editor,
    count: summary.count,
  })
}
