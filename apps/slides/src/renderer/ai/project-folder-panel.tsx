import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AgentTransport } from '@genoffice/agent-core'
import type { Lang } from '@genoffice/i18n'
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
  undoProjectMemoryConsolidation,
  useProjectChat,
  windowProjectFolderBridge,
  type AiSendGate,
  type ProjectChat,
  type ProjectChatEntry,
  type ProjectChatLoop,
  type ProjectChatOpened,
  type ProjectMemoryLine,
  type ProjectPickerProps,
  type ProjectRunPrepared,
} from '@genoffice/ui'

/**
 * The project folder parts of this editor's AI panel (spec 5.1–5.7): the
 * project chip under the input, the chat menu in the header, the notice
 * lines, and the memory and tool-summary lines inside the chat.
 *
 * The chat logic is the shared `useProjectChat`; this file wires it to the
 * window's bridge and renders the shared components. Without the bridge (an
 * older preload, a test) every part renders nothing and every call falls
 * through, so the panel behaves exactly as before (spec 7.6).
 */

type ProjectListItem = ProjectPickerProps['projects'][number]
type ProjectNotice = Extract<ProjectRunPrepared, { status: 'ok' }>['notices'][number]
type ProjectEditor = ProjectChatEntry['editor']
/** Another editor's tool records on a reopened message, shown as one line */
export type OtherEditorTools = NonNullable<ProjectChatEntry['otherEditorTools']>

export interface ProjectFolderPanelOptions {
  editor: ProjectEditor
  lang: Lang
  /** a reply runs: remote messages wait, the chip and the chat menu are locked */
  busy: boolean
  /** the panel's loop (it may not exist yet) */
  loop: () => ProjectChatLoop | null | undefined
  /** show this chat (or go back to the per-document chat) */
  onOpen: (opened: ProjectChatOpened) => void
  /** messages another window recorded in the open chat, in arrival order; never during a reply */
  onRemoteMessages: (entries: ProjectChatEntry[]) => void
  /** "New chat" in the chat menu: the panel's own new-chat button */
  onNewChat: () => void
  /**
   * What "[Tidy up]" sends with. Resolves null when nothing can be sent now
   * (the send gate showed what holds it); the panel's gate stays the gate.
   */
  consolidation: () => Promise<{ transport: AgentTransport; gate: () => AiSendGate } | null>
}

export interface ProjectFolderPanel {
  readonly chat: ProjectChat
  /**
   * Right before `loop.run` (after the panel's send gate): reads the project
   * context for this request and shows its notices.
   */
  prepareSend(): Promise<ProjectRunPrepared>
  /** after the run ended (done, stopped or failed) */
  finishSend(): void
  /** the chip for the row under the input; null without the bridge */
  readonly picker: ReactNode
  /** the header's chat menu; null while no project is chosen */
  readonly chatMenu: ReactNode
  /** the folder hint, shown above the chip row; null when there is none */
  readonly hint: ReactNode
  /** notice lines (changed, long, cut, sync folder, unwritable, tidied up); null when none */
  readonly notices: ReactNode
  /** the memory lines of one message */
  memoryLines(lines: readonly ProjectMemoryLine[] | undefined): ReactNode
  /** the one-line summary of another editor's tools on one message */
  toolSummary(tools: OtherEditorTools | undefined): ReactNode
}

function baseName(fileRef: string | undefined): string | undefined {
  if (!fileRef) return undefined
  return fileRef.split(/[\\/]/).filter(Boolean).at(-1)
}

export function useProjectFolderPanel(options: ProjectFolderPanelOptions): ProjectFolderPanel {
  const { lang, busy } = options
  const optionsRef = useRef(options)
  optionsRef.current = options
  const busyRef = useRef(busy)
  busyRef.current = busy
  /** the full bridge for the chip's actions; read once, like the chat hook does */
  const [bridge] = useState(() => windowProjectFolderBridge())

  /** remote messages that arrived during a reply: shown once it ends */
  const remoteRef = useRef<ProjectChatEntry[]>([])
  const flushRemote = () => {
    if (busyRef.current || remoteRef.current.length === 0) return
    const batch = remoteRef.current
    remoteRef.current = []
    optionsRef.current.onRemoteMessages(batch)
  }

  const chat = useProjectChat({
    editor: options.editor,
    loop: options.loop,
    onOpen: (opened) => {
      remoteRef.current = []
      optionsRef.current.onOpen(opened)
    },
    onRemoteMessage: (entry) => {
      remoteRef.current.push(entry)
      flushRemote()
    },
  })
  // a reply ended: show what another window recorded meanwhile
  useEffect(() => {
    flushRemote()
  }, [busy])

  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [defaultParentFolder, setDefaultParentFolder] = useState<string | undefined>(undefined)
  const [notices, setNotices] = useState<ProjectNotice[]>([])
  const [hintDismissed, setHintDismissed] = useState(false)
  const [consolidating, setConsolidating] = useState(false)
  const [consolidated, setConsolidated] = useState<{
    projectId: string
    before: number
    after: number
    backupName: string
  } | null>(null)
  /** memory entries removed from this panel: their [Remove] goes away */
  const [forgotten, setForgotten] = useState<ReadonlySet<string>>(() => new Set())

  const refreshProjects = () => {
    if (!bridge) return
    void bridge.listProjects().then(setProjects, () => {})
    void bridge.getDefaultParentFolder().then(setDefaultParentFolder, () => {})
  }
  useEffect(() => {
    refreshProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per bridge
  }, [bridge])

  /** one-time notices of a folder just added (the sync folder notice), for when it is chosen */
  const addedNoticesRef = useRef<{ projectId: string; notices: ProjectNotice[] } | null>(null)

  // another project: its notices and lines do not carry over
  useEffect(() => {
    const added = addedNoticesRef.current
    addedNoticesRef.current = null
    setNotices(added && added.projectId === chat.projectId ? added.notices : [])
    setConsolidated(null)
    setHintDismissed(false)
    setForgotten(new Set())
  }, [chat.projectId])

  /** a folder came into the list (added, created, relocated, adopted): choose it */
  const chooseAdded = (result: Awaited<ReturnType<NonNullable<typeof bridge>['addFolder']>>) => {
    refreshProjects()
    if (result.status !== 'added') return
    if (result.project.id === chat.projectId) {
      if (result.notices.length > 0) setNotices(result.notices)
      return
    }
    addedNoticesRef.current = { projectId: result.project.id, notices: result.notices }
    void chat.selectProject(result.project.id)
  }

  const consolidate = async () => {
    const projectId = chat.projectId
    if (!projectId || consolidating) return
    const how = await optionsRef.current.consolidation()
    if (!how) return
    setConsolidating(true)
    try {
      const result = await consolidateProjectMemory({
        projectId,
        transport: how.transport,
        gate: how.gate,
      })
      if (result.status === 'ok') {
        setConsolidated({ projectId, ...result })
        setNotices((prev) => prev.filter((n) => n.kind !== 'memory-long'))
      } else if (result.status === 'unwritable') {
        setNotices((prev) => [
          ...prev.filter((n) => n.kind !== 'unwritable'),
          { kind: 'unwritable' },
        ])
      }
    } finally {
      setConsolidating(false)
    }
  }

  const forget = async (line: ProjectMemoryLine) => {
    const result = await chat.forgetMemory(line)
    if (!result) return
    if (result.status === 'ok' || result.reason === 'not-found') {
      setForgotten((prev) => new Set(prev).add(line.text))
    }
  }

  const projectId = chat.projectId
  const active = chat.chat

  const picker: ReactNode =
    bridge && chat.available ? (
      <ProjectPicker
        lang={lang}
        projects={projects}
        selectedId={projectId}
        disabled={busy}
        defaultParentFolder={defaultParentFolder}
        onOpen={refreshProjects}
        onSelect={(id) => void chat.selectProject(id)}
        onCreate={(name, { otherPlace }) => {
          void bridge.createProject({ name, otherPlace }).then((result) => {
            if (result.status === 'created') {
              refreshProjects()
              void chat.selectProject(result.project.id)
            } else if (result.status === 'added') {
              chooseAdded(result)
            } else {
              refreshProjects()
            }
          }, refreshProjects)
        }}
        onAddFolder={() => void bridge.addFolder().then(chooseAdded, refreshProjects)}
        onRelocate={(id) =>
          void bridge.relocateProject({ projectId: id }).then(chooseAdded, refreshProjects)
        }
        onSetPinned={(id, pinned) =>
          void bridge.setPinned({ projectId: id, pinned }).then(refreshProjects, refreshProjects)
        }
        onOpenInFileManager={(id) =>
          void bridge.openInFileManager({ projectId: id }).catch(() => {})
        }
        onRemoveFromList={(id) => {
          void bridge
            .removeFromList({ projectId: id })
            .then(() => (id === chat.projectId ? chat.selectProject(null) : undefined))
            .finally(refreshProjects)
        }}
      />
    ) : null

  const chatMenu: ReactNode =
    projectId && active ? (
      <ProjectChatMenu
        lang={lang}
        chats={chat.chats}
        currentChatId={active.kind === 'project' && !active.isNew ? active.chatId : null}
        currentTitle={active.kind === 'project' ? active.title : undefined}
        legacy={chat.legacy}
        legacyActive={active.kind === 'legacy'}
        disabled={busy}
        onOpen={() => void chat.refreshChats()}
        onSelect={(id) => void chat.openChat(id)}
        onNewChat={() => optionsRef.current.onNewChat()}
        onRename={(id, title) => void chat.renameChat(id, title)}
        onDelete={(id) => void chat.deleteChat(id)}
        onSelectLegacy={() => void chat.openLegacy()}
      />
    ) : null

  const hint: ReactNode =
    bridge && chat.hint && !projectId && !hintDismissed ? (
      <ProjectFolderHintLine
        lang={lang}
        hint={chat.hint}
        onUse={() => void bridge.adoptFolderHint().then(chooseAdded, refreshProjects)}
        onDismiss={() => setHintDismissed(true)}
      />
    ) : null

  const shown = notices.filter((n) => n.kind !== 'unwritable' || !chat.unwritable)
  const noticeLines: ReactNode =
    projectId && (shown.length > 0 || chat.unwritable || consolidated) ? (
      <div className="ai-project-notices">
        {chat.unwritable && <ProjectNoticeLine lang={lang} notice={{ kind: 'unwritable' }} />}
        <ProjectNoticeList
          lang={lang}
          notices={shown}
          onView={(section) =>
            void bridge?.openProjectScreen({ projectId, section }).catch(() => {})
          }
          onConsolidate={busy || consolidating ? undefined : () => void consolidate()}
          onDismiss={(index) => setNotices((prev) => prev.filter((n) => n !== shown[index]))}
        />
        {consolidated && consolidated.projectId === projectId && (
          <ProjectMemoryConsolidatedLine
            lang={lang}
            before={consolidated.before}
            after={consolidated.after}
            onUndo={
              bridge
                ? () =>
                    void undoProjectMemoryConsolidation(
                      bridge,
                      consolidated.projectId,
                      consolidated.backupName,
                    ).then(
                      () => setConsolidated(null),
                      () => {},
                    )
                : undefined
            }
          />
        )}
      </div>
    ) : null

  return {
    chat,
    async prepareSend() {
      const prepared = await chat.prepareSend()
      setNotices(prepared.status === 'ok' ? prepared.notices : [])
      return prepared
    },
    finishSend() {
      void chat.finishSend()
    },
    picker,
    chatMenu,
    hint,
    notices: noticeLines,
    memoryLines(lines) {
      if (!lines || lines.length === 0) return null
      return lines.map((line, i) => (
        <ProjectMemoryEventLine
          key={`memory-${i}`}
          lang={lang}
          change={line.change}
          onRemove={
            projectId && line.kind === 'added' && !forgotten.has(line.text)
              ? () => void forget(line)
              : undefined
          }
        />
      ))
    },
    toolSummary(tools) {
      if (!tools) return null
      return (
        <ProjectToolSummaryLine
          lang={lang}
          editor={tools.editor}
          documentName={baseName(tools.fileRef)}
          count={tools.count}
        />
      )
    },
  }
}
