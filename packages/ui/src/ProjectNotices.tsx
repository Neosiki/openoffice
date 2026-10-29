import React from 'react'
import type { Lang } from '@genoffice/i18n'
import type {
  ProjectEditor,
  ProjectMemoryOp,
  ProjectNotice,
  ProjectScreenSection,
  UnregisteredProjectHint,
} from '@genoffice/project-store'
import {
  projectConsolidatedText,
  projectEditorLabel,
  projectMemoryEventText,
  projectNoticeActionLabel,
  projectNoticeView,
  projectToolSummaryText,
} from './project-panel-model'
import { IconClose, IconProjectEditor, IconProjectFolder } from './project-icons'
import { projectPanelText } from './strings-project-panel'
import './project-panel.css'

function DismissButton({ lang, onDismiss }: { lang: Lang; onDismiss: () => void }) {
  const label = projectPanelText(lang, 'dismiss')
  return (
    <button
      type="button"
      className="ai-project-notice-close"
      aria-label={label}
      title={label}
      onClick={onDismiss}
    >
      <IconClose size={12} />
    </button>
  )
}

/**
 * One project notice in the AI panel: instructions or memory changed
 * outside the app ("[View]"), memory grown long ("[Tidy up]"), instructions
 * cut, the folder cannot be written, or the one-time sync folder notice. The
 * button shows only when its handler is given; the caller decides how long
 * the line stays (`onDismiss` adds a close button).
 */
export function ProjectNoticeLine({
  lang,
  notice,
  onView,
  onConsolidate,
  onDismiss,
}: {
  readonly lang: Lang
  readonly notice: ProjectNotice
  /** "[View]": open the home project screen at that section */
  readonly onView?: ((section: ProjectScreenSection) => void) | undefined
  /** "[Tidy up]": run the person-triggered memory consolidation */
  readonly onConsolidate?: (() => void) | undefined
  readonly onDismiss?: (() => void) | undefined
}): React.JSX.Element {
  const view = projectNoticeView(lang, notice)
  const action = view.action
  const handler =
    action?.type === 'view'
      ? onView && (() => onView(action.section))
      : action?.type === 'consolidate'
        ? onConsolidate
        : undefined
  return (
    <div
      className={`ai-project-notice${view.tone === 'warning' ? ' warning' : ''}`}
      role="status"
      data-notice={notice.kind}
    >
      <span className="ai-project-notice-text">{view.text}</span>
      {action && handler && (
        <button type="button" className="ai-project-link" onClick={handler}>
          {projectNoticeActionLabel(lang, action)}
        </button>
      )}
      {onDismiss && <DismissButton lang={lang} onDismiss={onDismiss} />}
    </div>
  )
}

/** Several notices, one line each, in the order given */
export function ProjectNoticeList({
  lang,
  notices,
  onView,
  onConsolidate,
  onDismiss,
}: {
  readonly lang: Lang
  readonly notices: readonly ProjectNotice[]
  readonly onView?: ((section: ProjectScreenSection) => void) | undefined
  readonly onConsolidate?: (() => void) | undefined
  /** Called with the dismissed notice's index */
  readonly onDismiss?: ((index: number) => void) | undefined
}): React.JSX.Element | null {
  if (notices.length === 0) return null
  return (
    <div className="ai-project-notices">
      {notices.map((notice, index) => (
        <ProjectNoticeLine
          key={`${notice.kind}-${index}`}
          lang={lang}
          notice={notice}
          onView={onView}
          onConsolidate={onConsolidate}
          onDismiss={onDismiss ? () => onDismiss(index) : undefined}
        />
      ))}
    </div>
  )
}

/**
 * "This document is in the '<name>' project folder [Use]": the document sits
 * under an unregistered folder holding `.ieumoffice/project.json`. Shown above
 * the project chip; nothing is used until the person presses [Use].
 */
export function ProjectFolderHintLine({
  lang,
  hint,
  onUse,
  onDismiss,
}: {
  readonly lang: Lang
  readonly hint: UnregisteredProjectHint
  readonly onUse: () => void
  readonly onDismiss?: (() => void) | undefined
}): React.JSX.Element {
  return (
    <div className="ai-project-notice ai-project-hint" role="status" title={hint.folderPath}>
      <span className="ai-project-notice-icon">
        <IconProjectFolder size={13} />
      </span>
      <span className="ai-project-notice-text" dir="auto">
        {projectPanelText(lang, 'folderHint', { name: hint.name })}
      </span>
      <button type="button" className="ai-project-link" onClick={onUse}>
        {projectPanelText(lang, 'useFolder')}
      </button>
      {onDismiss && <DismissButton lang={lang} onDismiss={onDismiss} />}
    </div>
  )
}

/**
 * A memory line in the chat, written when `project_remember` changed
 * `memory.md`: "Remembered: … [Remove]", "Memory changed: …" or "Memory
 * removed: …". [Remove] shows only for an added entry and only with `onRemove`.
 */
export function ProjectMemoryEventLine({
  lang,
  change,
  onRemove,
}: {
  readonly lang: Lang
  readonly change: ProjectMemoryOp
  /** Removes the added entry from `memory.md` */
  readonly onRemove?: (() => void) | undefined
}): React.JSX.Element {
  return (
    <div className="ai-project-event" data-memory-op={change.op}>
      <span className="ai-project-event-text" dir="auto">
        {projectMemoryEventText(lang, change)}
      </span>
      {change.op === 'add' && onRemove && (
        <button type="button" className="ai-project-link" onClick={onRemove}>
          {projectPanelText(lang, 'removeMemory')}
        </button>
      )}
    </div>
  )
}

/** "Memory tidied up (N → M entries) [Undo]" after a person-triggered consolidation */
export function ProjectMemoryConsolidatedLine({
  lang,
  before,
  after,
  onUndo,
}: {
  readonly lang: Lang
  readonly before: number
  readonly after: number
  /** Restores the backup written before the consolidation */
  readonly onUndo?: (() => void) | undefined
}): React.JSX.Element {
  return (
    <div className="ai-project-event" role="status">
      <span className="ai-project-event-text">{projectConsolidatedText(lang, before, after)}</span>
      {onUndo && (
        <button type="button" className="ai-project-link" onClick={onUndo}>
          {projectPanelText(lang, 'undo')}
        </button>
      )}
    </div>
  )
}

/**
 * The one-line summary standing in for another editor's tool records in a
 * reopened chat ("Ran tools 3 times in HWP 'report.hwp'"). It never expands.
 */
export function ProjectToolSummaryLine({
  lang,
  editor,
  documentName,
  count,
}: {
  readonly lang: Lang
  readonly editor: ProjectEditor
  /** Absent for the home ask panel and untitled documents */
  readonly documentName?: string | undefined
  readonly count: number
}): React.JSX.Element {
  return (
    <div className="ai-project-event ai-project-tool-summary">
      <span className="ai-project-event-icon" title={projectEditorLabel(lang, editor)}>
        <IconProjectEditor editor={editor} size={12} />
      </span>
      <span className="ai-project-event-text" dir="auto">
        {projectToolSummaryText(lang, { editor, documentName, count })}
      </span>
    </div>
  )
}
