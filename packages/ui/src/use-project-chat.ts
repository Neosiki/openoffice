import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { AgentMessage } from '@genoffice/agent-core'
import type {
  AppendProjectChatArgs,
  ChatMessage,
  LegacyDocumentChat,
  ProjectApi,
  ProjectChatAppendedEvent,
  ProjectChatListItem,
  ProjectChatMessage,
  ProjectChatRef,
  ProjectEditor,
  ProjectFolderApi,
  ProjectId,
  ProjectMemoryEditResult,
  ProjectSelection,
  ProjectWriteResult,
  ToolActivity,
  UnregisteredProjectHint,
} from '@genoffice/project-store'
import {
  createProjectRun,
  forgetMemoryLine,
  memoryLinesOf,
  windowProjectFolderBridge,
  type ProjectMemoryLine,
  type ProjectRun,
  type ProjectRunPrepared,
  type ProjectSkillBridge,
} from './project-skill'

/**
 * The chat side of project folders in one AI panel (spec 5.3): which chat
 * the panel shows, where its messages are recorded, and what another window
 * with the same chat open adds.
 *
 * With no project chosen (or no bridge) nothing here applies: `persist`
 * returns false and `newChat` returns false, and the panel keeps its
 * per-document chat exactly as before (spec 7.6). With a project chosen the
 * chat lives in the project folder; "earlier chats of this document" are
 * continued in the old per-document store (spec 5.3.4).
 *
 * The panel owns its transcript and its loop. This module tells it what to
 * show (`onOpen`, `onRemoteMessage`) and, right before each send, feeds the
 * other window's finished exchanges into the loop's history and prepares the
 * project skill's snapshot (`prepareSend`); `finishSend` ends the run.
 */

/** The bridge calls the chat uses (plus the skill's, for the run it shares) */
export type ProjectChatBridge = ProjectSkillBridge &
  Pick<
    ProjectFolderApi,
    | 'getSelection'
    | 'setSelection'
    | 'listChats'
    | 'newChat'
    | 'openChat'
    | 'appendChat'
    | 'renameChat'
    | 'deleteChat'
    | 'editMemory'
    | 'onChatMessageAppended'
    | 'onOpenChat'
  > & {
    /**
     * Adds this window's (just saved) document to a chat's `documents`
     * (spec 5.3.6). Not part of the bridge contract yet; called when present.
     */
    attachDocument?: ((args: ProjectChatRef) => Promise<ProjectWriteResult>) | undefined
  }

/** The per-document chat store calls an earlier chat is continued with */
export type LegacyChatApi = Pick<ProjectApi, 'loadChat' | 'appendChat'>

/** The window's `projectApi` (the per-document chat store) when it carries the calls */
export function windowLegacyChatApi(): LegacyChatApi | null {
  const api = (globalThis as { projectApi?: Partial<LegacyChatApi> }).projectApi
  return typeof api?.loadChat === 'function' && typeof api.appendChat === 'function'
    ? (api as LegacyChatApi)
    : null
}

/** What the hook needs of the panel's AgentLoop */
export interface ProjectChatLoop {
  readonly busy: boolean
  appendHistory(messages: readonly AgentMessage[]): number
}

/** One message as a panel shows it */
export interface ProjectChatEntry {
  seq: number
  ts: string
  role: 'user' | 'assistant'
  text: string
  /** the editor (or home) that wrote it */
  editor: ProjectEditor
  fileRef?: string
  /** tool records, only when this editor wrote them */
  tools?: ToolActivity[]
  /** tools another editor ran: shown as one line, never expanded (spec 5.3.2) */
  otherEditorTools?: { editor: ProjectEditor; fileRef?: string; count: number }
  /** "remembered / changed / removed" lines, whichever editor wrote them (spec 5.6) */
  memory: ProjectMemoryLine[]
  attachments?: ChatMessage['attachments']
  scope?: ChatMessage['scope']
  skills?: ChatMessage['skills']
}

/** The chat a panel shows now */
export type ProjectActiveChat =
  | {
      kind: 'project'
      projectId: ProjectId
      chatId: ProjectId
      /** '' until the first message titles it */
      title: string
      /** written by another install ("other PC") */
      foreign: boolean
      /** no file yet: the first assistant reply creates it */
      isNew: boolean
    }
  /** this document's chat from before project folders, continued in the old store */
  | { kind: 'legacy'; legacy: LegacyDocumentChat }

/** What the panel shows after a chat was opened or the project changed */
export type ProjectChatOpened =
  | ({
      kind: 'project'
      entries: ProjectChatEntry[]
      /** role and text only: what the loop gets (`loop.reset()` then `loop.restore(model)`) */
      model: AgentMessage[]
    } & Omit<Extract<ProjectActiveChat, { kind: 'project' }>, 'kind'>)
  | {
      kind: 'legacy'
      legacy: LegacyDocumentChat
      entries: ProjectChatEntry[]
      model: AgentMessage[]
    }
  /** "no project" was chosen: show this document's per-document chat as before */
  | { kind: 'document' }

/** One message to record (main fills seq, time, editor, origin and the chat info) */
export type ProjectChatRecord = Omit<AppendProjectChatArgs, 'projectId' | 'chatId'>

export interface ProjectChatState {
  /** this window has the project folder bridge */
  available: boolean
  /** the window's selection is known (until then messages go the old way) */
  ready: boolean
  /** the chosen project; null: no project */
  projectId: ProjectId | null
  /** the document sits under an unregistered project folder: offer "[use]" */
  hint: UnregisteredProjectHint | null
  chat: ProjectActiveChat | null
  /** this project's chats for the [chat ▾] list, newest first */
  chats: ProjectChatListItem[]
  /** "earlier chats of this document" */
  legacy: LegacyDocumentChat | null
  /** `.ieumoffice/` cannot be written: chats and memory are not saved (spec 5.7) */
  unwritable: boolean
}

export interface ProjectChatOptions {
  /** the editor this panel belongs to ('home' for the home ask panel) */
  editor: ProjectEditor
  /** tests inject one; the default is the window's `projectFolderApi` */
  bridge?: ProjectChatBridge | null | undefined
  /** tests inject one; the default is the window's `projectApi` */
  legacyApi?: LegacyChatApi | null | undefined
  /** the panel's loop (it may not exist yet) */
  loop: () => ProjectChatLoop | null | undefined
  /** replace the transcript (and the loop's history) with this chat */
  onOpen: (opened: ProjectChatOpened) => void
  /** another window recorded a message in the open chat: show it now */
  onRemoteMessage?: ((entry: ProjectChatEntry) => void) | undefined
  /** most recent messages to load when a chat opens (default 200) */
  messageLimit?: number | undefined
}

export interface ProjectChatController {
  readonly run: ProjectRun | null
  getState(): ProjectChatState
  subscribe(listener: () => void): () => void
  /** use the latest callbacks (the hook calls it every render) */
  update(options: ProjectChatOptions): void
  /** read the window's selection and open its chat; listen to main's events */
  start(): Promise<void>
  dispose(): void
  /** choose a project (null: "no project"); a different one starts a new chat (spec 5.3.5) */
  selectProject(projectId: ProjectId | null): Promise<void>
  /** open a chat of the chosen project */
  openChat(chatId: ProjectId): Promise<boolean>
  /** continue "earlier chats of this document" */
  openLegacy(): Promise<boolean>
  /** "New chat": true when a project chat was started; false leaves it to the panel (spec 5.3.7) */
  newChat(): Promise<boolean>
  refreshChats(): Promise<void>
  renameChat(chatId: ProjectId, title: string): Promise<ProjectWriteResult | null>
  deleteChat(chatId: ProjectId): Promise<ProjectWriteResult | null>
  /**
   * Record a message of the open chat. True: recorded here (project or earlier
   * chat). False: no project chat applies, use the per-document store as before.
   */
  persist(record: ProjectChatRecord): boolean
  /** resolves when every record handed to `persist` so far was written (or failed) */
  settled(): Promise<void>
  /**
   * Right before a send: feed the other window's finished exchanges into the
   * loop, then read the project context and open the run scope.
   */
  prepareSend(): Promise<ProjectRunPrepared>
  /** after the run (done, stopped or failed): close the run scope, feed what arrived meanwhile */
  finishSend(): Promise<void>
  /** the document was saved (first save, save as): chat and choice stay (spec 5.3.6) */
  documentSaved(): Promise<void>
  /** "[remove]" on a memory line */
  forgetMemory(line: ProjectMemoryLine): Promise<ProjectMemoryEditResult | null>
}

const DEFAULT_MESSAGE_LIMIT = 200

function entryOf(
  m: ChatMessage & { editor?: ProjectEditor },
  editor: ProjectEditor,
): ProjectChatEntry {
  const by = m.editor ?? editor
  const own = by === editor
  const tools = m.tools ?? []
  return {
    seq: m.seq,
    ts: m.ts,
    role: m.role,
    text: m.text,
    editor: by,
    ...(m.fileRef ? { fileRef: m.fileRef } : {}),
    ...(own && tools.length > 0 ? { tools } : {}),
    ...(!own && tools.length > 0
      ? {
          otherEditorTools: {
            editor: by,
            ...(m.fileRef ? { fileRef: m.fileRef } : {}),
            count: tools.length,
          },
        }
      : {}),
    memory: memoryLinesOf(tools),
    ...(m.attachments ? { attachments: m.attachments } : {}),
    ...(m.scope ? { scope: m.scope } : {}),
    ...(m.skills ? { skills: m.skills } : {}),
  }
}

const modelOf = (messages: readonly ChatMessage[]): AgentMessage[] =>
  messages.map((m) => ({ role: m.role, text: m.text }))

const INITIAL_STATE: ProjectChatState = {
  available: false,
  ready: false,
  projectId: null,
  hint: null,
  chat: null,
  chats: [],
  legacy: null,
  unwritable: false,
}

/** The chat logic without React (the hook wraps it; tests drive it directly) */
export function createProjectChatController(initial: ProjectChatOptions): ProjectChatController {
  let options = initial
  const bridge: ProjectChatBridge | null =
    options.bridge !== undefined ? options.bridge : windowProjectFolderBridge()
  const legacyApi = options.legacyApi !== undefined ? options.legacyApi : windowLegacyChatApi()
  let state: ProjectChatState = { ...INITIAL_STATE, available: !!bridge }
  const listeners = new Set<() => void>()
  const setState = (patch: Partial<ProjectChatState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  /** bumped by every chat switch; work that awaited across one is dropped */
  let epoch = 0
  /** seqs of the open chat already shown (own records and opened messages) */
  let known = new Set<number>()
  /** another window's question still waiting for its answer */
  let pendingUser: AgentMessage | null = null
  /** another window's finished exchanges, not yet in the loop */
  let modelQueue: AgentMessage[] = []
  /** records are written one after another, in the order they were handed over */
  let writes: Promise<void> = Promise.resolve()
  let unsubscribe: Array<() => void> = []

  const markUnwritable = () => {
    if (!state.unwritable) setState({ unwritable: true })
    run?.markUnwritable()
  }

  const run = bridge
    ? createProjectRun({
        bridge,
        projectId: () => state.projectId,
        onUnwritable: () => {
          if (!state.unwritable) setState({ unwritable: true })
        },
      })
    : null

  const resetTracking = (messages: readonly ChatMessage[] = []) => {
    known = new Set(messages.map((m) => m.seq))
    const last = messages.at(-1)
    pendingUser = last?.role === 'user' ? { role: 'user', text: last.text } : null
    modelQueue = []
  }

  const flush = () => {
    if (modelQueue.length === 0) return
    const loop = options.loop()
    if (!loop || loop.busy) return
    const batch = modelQueue
    modelQueue = []
    loop.appendHistory(batch)
  }

  const refreshChats = async () => {
    const projectId = state.projectId
    if (!bridge || !projectId) return
    let listed
    try {
      listed = await bridge.listChats({ projectId })
    } catch {
      return
    }
    if (state.projectId !== projectId) return
    const chat = state.chat
    const title =
      chat?.kind === 'project' ? listed.chats.find((c) => c.id === chat.chatId)?.title : undefined
    setState({
      chats: listed.chats,
      legacy: listed.legacy,
      ...(chat?.kind === 'project' && title !== undefined && title !== chat.title
        ? { chat: { ...chat, title } }
        : {}),
    })
  }

  const startNewChat = async (projectId: ProjectId, mine: number): Promise<boolean> => {
    if (!bridge) return false
    let chatId: ProjectId
    try {
      chatId = (await bridge.newChat({ projectId })).chatId
    } catch {
      return false
    }
    if (mine !== epoch) return false
    resetTracking()
    const chat = {
      kind: 'project' as const,
      projectId,
      chatId,
      title: '',
      foreign: false,
      isNew: true,
    }
    setState({ chat })
    options.onOpen({ ...chat, entries: [], model: [] })
    void refreshChats()
    return true
  }

  const openProjectChat = async (
    projectId: ProjectId,
    chatId: ProjectId,
    mine: number,
  ): Promise<boolean> => {
    if (!bridge) return false
    let opened
    try {
      opened = await bridge.openChat({
        projectId,
        chatId,
        limit: options.messageLimit ?? DEFAULT_MESSAGE_LIMIT,
      })
    } catch {
      opened = { status: 'not-found' as const }
    }
    if (mine !== epoch) return false
    if (opened.status !== 'ok') {
      await startNewChat(projectId, mine)
      return false
    }
    const messages: ProjectChatMessage[] = opened.messages
    resetTracking(messages)
    const chat = {
      kind: 'project' as const,
      projectId,
      chatId,
      title: opened.info.title,
      foreign: opened.foreign,
      isNew: false,
    }
    setState({ chat })
    options.onOpen({
      ...chat,
      entries: messages.map((m) => entryOf(m, options.editor)),
      model: modelOf(messages),
    })
    void refreshChats()
    return true
  }

  /** set the selection; with `openChatId`, open that chat instead of starting a new one */
  const choose = async (projectId: ProjectId | null, openChatId?: ProjectId): Promise<void> => {
    if (!bridge) return
    const mine = ++epoch
    let selection: ProjectSelection
    try {
      selection = await bridge.setSelection({ projectId })
    } catch {
      return
    }
    if (mine !== epoch) return
    resetTracking()
    setState({
      projectId: selection.projectId,
      hint: selection.unregisteredProjectHint ?? null,
      chat: null,
      chats: [],
      legacy: null,
      unwritable: false,
    })
    if (!selection.projectId) {
      options.onOpen({ kind: 'document' })
      return
    }
    if (openChatId && selection.projectId === projectId) {
      await openProjectChat(selection.projectId, openChatId, mine)
    } else {
      await startNewChat(selection.projectId, mine)
    }
  }

  const onAppended = (event: ProjectChatAppendedEvent) => {
    const chat = state.chat
    if (chat?.kind !== 'project') return
    if (event.projectId !== chat.projectId || event.chatId !== chat.chatId) return
    const message = event.message
    if (known.has(message.seq)) return
    known.add(message.seq)
    options.onRemoteMessage?.(entryOf(message, options.editor))
    if (message.role === 'user') {
      pendingUser = { role: 'user', text: message.text }
    } else if (pendingUser) {
      modelQueue.push(pendingUser, { role: 'assistant', text: message.text })
      pendingUser = null
    }
    void refreshChats()
  }

  const onOpenChat = (event: ProjectChatRef) => {
    if (event.projectId === state.projectId) {
      void controller.openChat(event.chatId)
    } else {
      void choose(event.projectId, event.chatId)
    }
  }

  const controller: ProjectChatController = {
    run,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update(next) {
      options = next
    },
    async start() {
      if (!bridge) {
        setState({ ready: true })
        return
      }
      for (const off of unsubscribe) off()
      unsubscribe = [bridge.onChatMessageAppended(onAppended), bridge.onOpenChat(onOpenChat)]
      const mine = ++epoch
      let selection: ProjectSelection
      try {
        selection = await bridge.getSelection()
      } catch {
        selection = { projectId: null, initialChatId: null }
      }
      if (mine !== epoch) return
      setState({ projectId: selection.projectId, hint: selection.unregisteredProjectHint ?? null })
      if (selection.projectId) {
        if (selection.initialChatId) {
          await openProjectChat(selection.projectId, selection.initialChatId, mine)
        } else {
          await startNewChat(selection.projectId, mine)
        }
      }
      setState({ ready: true })
    },
    dispose() {
      epoch++
      for (const off of unsubscribe) off()
      unsubscribe = []
      void run?.finish()
    },
    async selectProject(projectId) {
      if (!bridge || projectId === state.projectId) return
      await choose(projectId)
    },
    async openChat(chatId) {
      const projectId = state.projectId
      if (!projectId) return false
      return openProjectChat(projectId, chatId, ++epoch)
    },
    async openLegacy() {
      const legacy = state.legacy
      if (!legacy || !legacyApi) return false
      const mine = ++epoch
      let messages: ChatMessage[]
      try {
        messages = await legacyApi.loadChat({
          projectId: legacy.projectId,
          chatId: legacy.chatId,
          limit: options.messageLimit ?? DEFAULT_MESSAGE_LIMIT,
        })
      } catch {
        return false
      }
      if (mine !== epoch) return false
      resetTracking()
      setState({ chat: { kind: 'legacy', legacy } })
      options.onOpen({
        kind: 'legacy',
        legacy,
        entries: messages.map((m) => entryOf(m, options.editor)),
        model: modelOf(messages),
      })
      return true
    },
    async newChat() {
      const projectId = state.projectId
      if (!bridge || !projectId) return false
      return startNewChat(projectId, ++epoch)
    },
    refreshChats,
    async renameChat(chatId, title) {
      const projectId = state.projectId
      if (!bridge || !projectId) return null
      const result = await bridge.renameChat({ projectId, chatId, title })
      if (result.status === 'unwritable') markUnwritable()
      await refreshChats()
      return result
    },
    async deleteChat(chatId) {
      const projectId = state.projectId
      if (!bridge || !projectId) return null
      const result = await bridge.deleteChat({ projectId, chatId })
      if (result.status === 'unwritable') markUnwritable()
      const chat = state.chat
      if (result.status === 'ok' && chat?.kind === 'project' && chat.chatId === chatId) {
        await startNewChat(projectId, ++epoch)
      }
      await refreshChats()
      return result
    },
    persist(record) {
      if (!state.ready) return false
      const chat = state.chat
      if (!chat) return false
      if (chat.kind === 'legacy') {
        if (!legacyApi) return false
        const { legacy } = chat
        writes = writes.then(() =>
          legacyApi
            .appendChat({ ...record, projectId: legacy.projectId, chatId: legacy.chatId })
            .catch(() => undefined),
        )
        return true
      }
      if (!bridge) return false
      const ref = { projectId: chat.projectId, chatId: chat.chatId }
      writes = writes.then(async () => {
        try {
          const result = await bridge.appendChat({ ...record, ...ref })
          if (result.status === 'unwritable') {
            markUnwritable()
            return
          }
          known.add(result.message.seq)
          if (record.role === 'assistant' && result.status === 'saved') {
            const now = state.chat
            if (now?.kind === 'project' && now.chatId === ref.chatId && now.isNew) {
              setState({ chat: { ...now, isNew: false } })
            }
            void refreshChats()
          }
        } catch {
          // the message is not saved: say so (spec 7.9) instead of dropping it silently
          markUnwritable()
        }
      })
      return true
    },
    settled: () => writes,
    async prepareSend() {
      flush()
      if (!run) return { status: 'none' }
      return run.prepare()
    },
    async finishSend() {
      await run?.finish()
      flush()
    },
    async documentSaved() {
      const chat = state.chat
      if (!bridge?.attachDocument || chat?.kind !== 'project') return
      await writes
      try {
        const result = await bridge.attachDocument({
          projectId: chat.projectId,
          chatId: chat.chatId,
        })
        if (result.status === 'unwritable') markUnwritable()
      } catch {
        markUnwritable()
      }
    },
    async forgetMemory(line) {
      const projectId = state.projectId
      if (!bridge || !projectId) return null
      const result = await forgetMemoryLine(bridge, projectId, line)
      if (result.status === 'refused' && result.reason === 'unwritable') markUnwritable()
      return result
    },
  }
  return controller
}

/** The hook's answer: the state to render plus the controller's actions */
export type ProjectChat = ProjectChatState &
  Omit<ProjectChatController, 'getState' | 'subscribe' | 'update' | 'start' | 'dispose'>

/**
 * The project chat of an AI panel; see `createProjectChatController`. The
 * bridge and the per-document store are read once, when the panel mounts.
 */
export function useProjectChat(options: ProjectChatOptions): ProjectChat {
  const ref = useRef<ProjectChatController | null>(null)
  if (!ref.current) ref.current = createProjectChatController(options)
  const controller = ref.current
  controller.update(options)
  useEffect(() => {
    void controller.start()
    return () => controller.dispose()
  }, [controller])
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const actions = useMemo(
    () => ({
      run: controller.run,
      selectProject: controller.selectProject,
      openChat: controller.openChat,
      openLegacy: controller.openLegacy,
      newChat: controller.newChat,
      refreshChats: controller.refreshChats,
      renameChat: controller.renameChat,
      deleteChat: controller.deleteChat,
      persist: controller.persist,
      settled: controller.settled,
      prepareSend: controller.prepareSend,
      finishSend: controller.finishSend,
      documentSaved: controller.documentSaved,
      forgetMemory: controller.forgetMemory,
    }),
    [controller],
  )
  return { ...state, ...actions }
}
