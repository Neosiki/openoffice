import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AgentTransport } from '@genoffice/agent-core'
import type { Lang } from '@genoffice/i18n'
import type {
  AddFolderResult,
  CreateProjectResult,
  ProjectEditor,
  ProjectId,
  ProjectListItem,
  ProjectNotice,
} from '@genoffice/project-store'
import {
  ProjectChatMenu,
  ProjectFolderHintLine,
  ProjectMemoryConsolidatedLine,
  ProjectMemoryEventLine,
  ProjectNoticeLine,
  ProjectNoticeList,
  ProjectPicker,
  ProjectToolSummaryLine,
  consolidateProjectMemory,
  memoryLinesOf,
  undoProjectMemoryConsolidation,
  useProjectChat,
  windowProjectFolderBridge,
  type AiSendGate,
  type ProjectChat,
  type ProjectChatEntry,
  type ProjectChatLoop,
  type ProjectChatOpened,
  type ProjectMemoryLine,
} from '@genoffice/ui'

/**
 * The project folder in this editor's AI panel (spec 5.1-5.7): the project
 * chip under the input, the chat menu in the header, the notice lines, and
 * the memory and other-editor lines under a message. The chat itself is
 * `useProjectChat`; this wires its state to the shared components and to the
 * window's `projectFolderApi`. Without that bridge (a test, an older preload)
 * nothing here shows and the panel keeps its per-document chat.
 */

export interface ProjectPanelOptions {
  editor: ProjectEditor
  lang: Lang
  /** a reply runs: the chip and the chat menu are locked, other windows' messages wait */
  busy: boolean
  /** the panel's loop (it may not exist yet) */
  loop: () => ProjectChatLoop | null | undefined
  /** the transport the chat sends with ("[Tidy up]" uses the same provider path) */
  transport: () => AgentTransport | null | undefined
  /** the send gate right now */
  gate: () => AiSendGate
  /**
   * Replace the transcript and the loop's history with this chat (or go back
   * to the document's). `initial`: the panel just started; a send made
   * meanwhile (a request handed over to a new tab) may already be running.
   */
  onOpen: (opened: ProjectChatOpened, initial: boolean) => void
  /** another window recorded a message in the open chat; never called while a reply runs */
  onRemoteMessage: (entry: ProjectChatEntry) => void
  /** the panel's "new chat" (the chat menu offers it too) */
  onNewChat: () => void
}

/** A tool record as a panel keeps it */
interface ProjectToolRecord {
  readonly name?: string | undefined
  readonly output?: string | undefined
  readonly isError?: boolean | undefined
}

/** What a message carries for the project lines under it */
export interface ProjectMessageParts {
  readonly tools?: readonly ProjectToolRecord[] | undefined
  /** the memory lines a reopened project chat gave the message */
  readonly memory?: readonly ProjectMemoryLine[] | undefined
  readonly otherEditorTools?: ProjectChatEntry['otherEditorTools'] | undefined
}

export interface ProjectPanel {
  readonly chat: ProjectChat
  /** await right before `loop.run`: feeds other windows' messages and reads the project context */
  prepareSend(): Promise<void>
  /** after the run (done, stopped or failed) */
  finishSend(): void
  /** the chat menu for the panel header; null without a chosen project */
  readonly header: ReactNode
  /** the project chip for `AiComposer.footerBelow`; null without the bridge */
  readonly footer: ReactNode
  /** hint, unwritable and context notices; null when there is none */
  readonly notices: ReactNode
  /** the other-editor summary and memory lines of one message */
  messageParts(parts: ProjectMessageParts): ReactNode
}

interface ShownNotices {
  readonly projectId: ProjectId | null
  readonly list: readonly ProjectNotice[]
}

interface Consolidated {
  readonly projectId: ProjectId
  readonly before: number
  readonly after: number
  readonly backupName: string
}

const NO_NOTICES: ShownNotices = { projectId: null, list: [] }

const memoryKey = (line: ProjectMemoryLine): string => `${line.kind}\n${line.text}`

const baseName = (fileRef: string | undefined): string | undefined =>
  fileRef ? (fileRef.split(/[\\/]/).pop() ?? fileRef) : undefined

export function useProjectPanel(options: ProjectPanelOptions): ProjectPanel {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const { lang, busy } = options
  const [bridge] = useState(() => windowProjectFolderBridge())
  const busyRef = useRef(busy)
  busyRef.current = busy
  /** other windows' messages that arrived while a reply ran */
  const heldRemoteRef = useRef<ProjectChatEntry[]>([])
  const [notices, setNotices] = useState<ShownNotices>(NO_NOTICES)
  const [consolidated, setConsolidated] = useState<Consolidated | null>(null)
  const [consolidating, setConsolidating] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)
  const [forgotten, setForgotten] = useState<ReadonlySet<string>>(() => new Set())
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [defaultParentFolder, setDefaultParentFolder] = useState<string | undefined>(undefined)
  const chatRef = useRef<ProjectChat | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const chat = useProjectChat({
    editor: options.editor,
    loop: options.loop,
    onOpen: (opened) => {
      heldRemoteRef.current = []
      setForgotten(new Set())
      // the selection is read once at the start; it opens before `ready`
      optionsRef.current.onOpen(opened, !chatRef.current?.ready)
    },
    onRemoteMessage: (entry) => {
      if (busyRef.current) heldRemoteRef.current.push(entry)
      else optionsRef.current.onRemoteMessage(entry)
    },
  })
  chatRef.current = chat

  // the reply ended: what other windows wrote meanwhile shows after it
  useEffect(() => {
    if (busy || heldRemoteRef.current.length === 0) return
    const held = heldRemoteRef.current
    heldRemoteRef.current = []
    for (const entry of held) optionsRef.current.onRemoteMessage(entry)
  }, [busy])

  const refreshProjects = useCallback(() => {
    if (!bridge) return
    bridge.listProjects().then(
      (list) => {
        if (mountedRef.current) setProjects(list)
      },
      () => {},
    )
  }, [bridge])

  useEffect(() => {
    if (!bridge) return
    refreshProjects()
    bridge.getDefaultParentFolder().then(
      (folder) => {
        if (mountedRef.current) setDefaultParentFolder(folder)
      },
      () => {},
    )
  }, [bridge, refreshProjects])

  // a new hint (another document, another folder) shows again
  useEffect(() => setHintDismissed(false), [chat.hint])

  /** a folder was added or a project created: list it and choose it */
  const adopt = (result: AddFolderResult | CreateProjectResult): void => {
    if (result.status !== 'added' && result.status !== 'created') return
    refreshProjects()
    if (result.status === 'added' && result.notices.length > 0) {
      setNotices({ projectId: result.project.id, list: result.notices })
    }
    void chatRef.current?.selectProject(result.project.id)
  }

  const prepareSend = async (): Promise<void> => {
    const prepared = await chat.prepareSend()
    if (prepared.status !== 'ok' || !mountedRef.current) return
    const projectId = prepared.context.projectId
    // "unwritable" has its own line; a sync-folder notice stays until it is closed
    const fresh = prepared.notices.filter((n) => n.kind !== 'unwritable')
    setNotices((prev) => {
      const kept =
        prev.projectId === projectId ? prev.list.filter((n) => n.kind === 'sync-folder') : []
      const added = fresh.filter((n) => n.kind !== 'sync-folder' || kept.length === 0)
      return { projectId, list: [...kept, ...added] }
    })
  }

  const finishSend = (): void => {
    void chat.finishSend()
  }

  const consolidate = async (): Promise<void> => {
    const projectId = chatRef.current?.projectId
    const transport = optionsRef.current.transport()
    if (!projectId || !transport || consolidating) return
    setConsolidating(true)
    try {
      const result = await consolidateProjectMemory({
        projectId,
        transport,
        gate: () => optionsRef.current.gate(),
      })
      if (result.status === 'ok' && mountedRef.current) {
        setConsolidated({
          projectId,
          before: result.before,
          after: result.after,
          backupName: result.backupName,
        })
        setNotices((prev) => ({
          ...prev,
          list: prev.list.filter((n) => n.kind !== 'memory-long'),
        }))
      }
    } finally {
      if (mountedRef.current) setConsolidating(false)
    }
  }

  const undoConsolidation = async (): Promise<void> => {
    const done = consolidated
    if (!bridge || !done) return
    const result = await undoProjectMemoryConsolidation(bridge, done.projectId, done.backupName)
    if (result.status === 'ok' && mountedRef.current) setConsolidated(null)
  }

  const forget = async (line: ProjectMemoryLine): Promise<void> => {
    const result = await chat.forgetMemory(line)
    if (!result || !mountedRef.current) return
    // an entry no longer in the memory is as good as removed
    if (result.status === 'ok' || result.reason === 'not-found') {
      setForgotten((prev) => new Set(prev).add(memoryKey(line)))
    }
  }

  const projectId = chat.projectId
  const active = chat.chat

  const header: ReactNode = projectId ? (
    <ProjectChatMenu
      lang={lang}
      chats={chat.chats}
      currentChatId={active?.kind === 'project' && !active.isNew ? active.chatId : null}
      currentTitle={active?.kind === 'project' && active.title ? active.title : undefined}
      legacy={chat.legacy}
      legacyActive={active?.kind === 'legacy'}
      disabled={busy}
      onOpen={() => void chat.refreshChats()}
      onSelect={(chatId) => void chat.openChat(chatId)}
      onNewChat={() => optionsRef.current.onNewChat()}
      onRename={(chatId, title) => void chat.renameChat(chatId, title)}
      onDelete={(chatId) => void chat.deleteChat(chatId)}
      onSelectLegacy={() => void chat.openLegacy()}
    />
  ) : null

  const footer: ReactNode =
    chat.available && bridge ? (
      <ProjectPicker
        lang={lang}
        projects={projects}
        selectedId={projectId}
        disabled={busy || !chat.ready}
        onOpen={refreshProjects}
        defaultParentFolder={defaultParentFolder}
        onSelect={(id) => void chat.selectProject(id)}
        onCreate={(name, { otherPlace }) =>
          void bridge.createProject({ name, otherPlace }).then(adopt, () => {})
        }
        onAddFolder={() => void bridge.addFolder().then(adopt, () => {})}
        onRelocate={(id) => void bridge.relocateProject({ projectId: id }).then(adopt, () => {})}
        onSetPinned={(id, pinned) =>
          void bridge.setPinned({ projectId: id, pinned }).then(refreshProjects, () => {})
        }
        onOpenInFileManager={(id) =>
          void bridge.openInFileManager({ projectId: id }).catch(() => {})
        }
        onRemoveFromList={(id) =>
          void bridge.removeFromList({ projectId: id }).then(
            () => {
              refreshProjects()
              // the list entry and its per-document choices are gone: back to "no project"
              if (chatRef.current?.projectId === id) void chat.selectProject(null)
            },
            () => {},
          )
        }
      />
    ) : null

  const shown = notices.projectId !== null && notices.projectId === projectId ? notices.list : []
  const hint = chat.hint && !hintDismissed ? chat.hint : null
  const consolidatedShown =
    consolidated && consolidated.projectId === projectId ? consolidated : null
  const unwritable = !!projectId && chat.unwritable
  const noticesNode: ReactNode =
    hint || unwritable || shown.length > 0 || consolidatedShown ? (
      <div className="ai-project-notices">
        {hint && bridge && (
          <ProjectFolderHintLine
            lang={lang}
            hint={hint}
            onUse={() => void bridge.adoptFolderHint().then(adopt, () => {})}
            onDismiss={() => setHintDismissed(true)}
          />
        )}
        {unwritable && <ProjectNoticeLine lang={lang} notice={{ kind: 'unwritable' }} />}
        <ProjectNoticeList
          lang={lang}
          notices={shown}
          onView={(section) => {
            if (bridge && projectId) void bridge.openProjectScreen({ projectId, section })
          }}
          onConsolidate={busy || consolidating ? undefined : () => void consolidate()}
          onDismiss={(index) =>
            setNotices((prev) => ({ ...prev, list: prev.list.filter((_, i) => i !== index) }))
          }
        />
        {consolidatedShown && (
          <ProjectMemoryConsolidatedLine
            lang={lang}
            before={consolidatedShown.before}
            after={consolidatedShown.after}
            onUndo={() => void undoConsolidation()}
          />
        )}
      </div>
    ) : null

  const messageParts = (parts: ProjectMessageParts): ReactNode => {
    const lines =
      parts.memory ??
      memoryLinesOf(
        parts.tools?.map((tool) => ({
          name: tool.name ?? '',
          ...(tool.output !== undefined ? { output: tool.output } : {}),
          ...(tool.isError !== undefined ? { isError: tool.isError } : {}),
        })),
      )
    const other = parts.otherEditorTools
    if (lines.length === 0 && !other) return null
    return (
      <>
        {other && (
          <ProjectToolSummaryLine
            lang={lang}
            editor={other.editor}
            documentName={baseName(other.fileRef)}
            count={other.count}
          />
        )}
        {lines.map((line, i) => (
          <ProjectMemoryEventLine
            key={`${i}-${memoryKey(line)}`}
            lang={lang}
            change={line.change}
            onRemove={
              line.kind === 'added' && projectId && !forgotten.has(memoryKey(line))
                ? () => void forget(line)
                : undefined
            }
          />
        ))}
      </>
    )
  }

  return {
    chat,
    prepareSend,
    finishSend,
    header,
    footer,
    notices: noticesNode,
    messageParts,
  }
}
