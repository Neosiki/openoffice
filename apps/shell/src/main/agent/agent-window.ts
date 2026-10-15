import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { productName, type Lang } from '@genoffice/i18n'
import { safeExternalUrl } from '@genoffice/electron-utils'
import type { AgentSessionEvent } from '@genoffice/ai-provider/agent-session'
import type { AiSubscriptionProviderId, AiSubscriptionStatus } from '@genoffice/ai-provider'
import {
  AGENT_BLOCKED_PROVIDERS,
  AGENT_CHANNELS,
  AGENT_MODES,
  AGENT_PROVIDERS,
  AGENT_WARNING_VERSION,
  normalizeAgentPrefs,
  withRecentFolder,
  type AgentConnection,
  type AgentEventView,
  type AgentInit,
  type AgentMode,
  type AgentPrefs,
  type AgentProvider,
  type AgentStartResponse,
} from '../../shared/agent-api'
import { AGENT_HOME_OPEN_CHANNEL } from '../../shared/agent-home-channel'
import { agentText } from '../../renderer/src/i18n/strings-agent'
import { createAgentManager, openableProjectFile, type AgentManagerDeps } from './agent-sessions'

/**
 * The agent window (decision 0032): a window of its own beside the main one,
 * so the person can watch an open document change while the agent works. It
 * owns its sessions; closing it ends them.
 */

export interface AgentWindowDeps extends Omit<AgentManagerDeps, 'emit' | 'language' | 'statuses'> {
  parentWindow(): BrowserWindow | null
  lang(): Lang
  theme(): 'light' | 'dark' | 'system'
  statuses(): Partial<Record<AiSubscriptionProviderId, AiSubscriptionStatus>>
  readPrefs(): AgentPrefs
  writePrefs(prefs: AgentPrefs): void
  /** open a file in a tab; false when nothing could open it */
  openPath(path: string): boolean
}

let deps: AgentWindowDeps | null = null
let win: BrowserWindow | null = null
let manager: ReturnType<typeof createAgentManager> | null = null
let ipcRegistered = false

/** What the window shows of an event: no program output beyond the model's own words */
export function agentEventView(event: AgentSessionEvent): AgentEventView {
  switch (event.type) {
    case 'started':
      return {
        type: 'started',
        provider: event.provider,
        model: event.model,
        skills: event.skills.length,
      }
    case 'permission': {
      const { id, provider: _provider, ...action } = event.request
      return { type: 'permission', id, action }
    }
    case 'error':
      // the message can carry program output (paths, diagnostics); the window shows the kind
      return { type: 'error', kind: event.kind }
    default:
      return event
  }
}

/** Whether each program can start a session now, as the window offers it */
export function agentConnections(
  statuses: Partial<Record<AiSubscriptionProviderId, AiSubscriptionStatus>>,
  meteredAccepted: Partial<Record<AiSubscriptionProviderId, boolean>> | undefined,
  blocked: readonly AgentProvider[] = AGENT_BLOCKED_PROVIDERS,
): Record<AgentProvider, AgentConnection> {
  const out = {} as Record<AgentProvider, AgentConnection>
  for (const provider of AGENT_PROVIDERS) {
    const status = statuses[provider]
    if (blocked.includes(provider)) out[provider] = 'blocked'
    else if (!status || status.state === 'checking') out[provider] = 'checking'
    else if (status.state === 'ready') out[provider] = 'ready'
    else if (
      status.state === 'metered' &&
      status.meteredAccepted === true &&
      meteredAccepted?.[provider] === true
    ) {
      out[provider] = 'metered-accepted'
    } else out[provider] = 'unavailable'
  }
  return out
}

function ownerOf(event: IpcMainInvokeEvent): number | null {
  return win && !win.isDestroyed() && event.sender === win.webContents ? event.sender.id : null
}

function registerIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.handle(AGENT_CHANNELS.getInit, (event): AgentInit | null => {
    if (ownerOf(event) === null || !deps) return null
    return {
      lang: deps.lang(),
      prefs: deps.readPrefs(),
      connections: agentConnections(deps.statuses(), deps.aiSettings().meteredAccepted),
    }
  })

  ipcMain.handle(AGENT_CHANNELS.getTheme, () => deps?.theme() ?? 'system')

  // Home opens the window; nothing else may
  ipcMain.handle(AGENT_HOME_OPEN_CHANNEL, (event) => {
    const home = deps?.parentWindow()
    if (!home || home.isDestroyed() || event.sender !== home.webContents) return
    openAgentWindow()
  })

  ipcMain.handle(AGENT_CHANNELS.pickFolder, async (event): Promise<string | null> => {
    if (ownerOf(event) === null || !win) return null
    const picked = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return picked.canceled || !picked.filePaths[0] ? null : picked.filePaths[0]
  })

  ipcMain.handle(AGENT_CHANNELS.setPrefs, (event, update: unknown): AgentPrefs | null => {
    if (ownerOf(event) === null || !deps) return null
    const current = deps.readPrefs()
    const patch = normalizeAgentPrefs({
      ...current,
      ...(update && typeof update === 'object' ? update : {}),
    })
    // the window cannot add folders to the list or claim a newer warning than it showed
    const next: AgentPrefs = {
      ...patch,
      recentFolders: current.recentFolders.filter((f) => patch.recentFolders.includes(f)),
      warningAccepted: Math.min(patch.warningAccepted, AGENT_WARNING_VERSION),
    }
    deps.writePrefs(next)
    return next
  })

  ipcMain.handle(
    AGENT_CHANNELS.start,
    async (event, request: unknown): Promise<AgentStartResponse> => {
      const owner = ownerOf(event)
      if (owner === null || !deps || !manager) return { ok: false, reason: 'start-failed' }
      const value = (request && typeof request === 'object' ? request : {}) as Record<
        string,
        unknown
      >
      const provider = value.provider as AgentProvider
      const mode = value.mode as AgentMode
      const folder = typeof value.folder === 'string' ? value.folder : ''
      if (!AGENT_PROVIDERS.includes(provider) || !AGENT_MODES.includes(mode)) {
        return { ok: false, reason: 'start-failed' }
      }
      if (AGENT_BLOCKED_PROVIDERS.includes(provider))
        return { ok: false, reason: 'provider-blocked' }
      const prefs = deps.readPrefs()
      // the warning is a precondition the main process checks, not only the window
      if (prefs.warningAccepted < AGENT_WARNING_VERSION)
        return { ok: false, reason: 'not-accepted' }
      const result = await manager.start(owner, { provider, mode, projectRoot: folder })
      if (!result.ok) return { ok: false, reason: result.reason, kind: result.kind }
      deps.writePrefs(withRecentFolder({ ...prefs, provider, mode }, folder))
      return { ok: true, sessionId: result.sessionId }
    },
  )

  ipcMain.handle(AGENT_CHANNELS.send, async (event, sessionId: unknown, text: unknown) => {
    const owner = ownerOf(event)
    if (owner === null || !manager || typeof sessionId !== 'string' || typeof text !== 'string')
      return false
    if (!text.trim()) return false
    try {
      await manager.send(owner, sessionId, text)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(
    AGENT_CHANNELS.answer,
    (event, sessionId: unknown, requestId: unknown, allow: unknown) => {
      const owner = ownerOf(event)
      if (
        owner === null ||
        !manager ||
        typeof sessionId !== 'string' ||
        typeof requestId !== 'string'
      )
        return
      manager.answer(
        owner,
        sessionId,
        requestId,
        allow === true ? { allow: true } : { allow: false },
      )
    },
  )

  ipcMain.handle(AGENT_CHANNELS.stop, (event, sessionId: unknown) => {
    const owner = ownerOf(event)
    if (owner === null || !manager || typeof sessionId !== 'string') return
    manager.stop(owner, sessionId)
  })

  ipcMain.handle(AGENT_CHANNELS.openFile, (event, sessionId: unknown, path: unknown) => {
    const owner = ownerOf(event)
    if (
      owner === null ||
      !manager ||
      !deps ||
      typeof sessionId !== 'string' ||
      typeof path !== 'string'
    ) {
      return false
    }
    const root = manager.projectRootOf(owner, sessionId)
    const file = root ? openableProjectFile(root, path) : undefined
    return file ? deps.openPath(file) : false
  })
}

export function configureAgentWindow(next: AgentWindowDeps): void {
  deps = next
  manager = createAgentManager({
    ...next,
    statuses: () => next.statuses(),
    language: () => next.lang(),
    emit: (ownerId, sessionId, event) => {
      if (!win || win.isDestroyed() || win.webContents.id !== ownerId) return
      win.webContents.send(AGENT_CHANNELS.event, { sessionId, event: agentEventView(event) })
    },
  })
  registerIpc()
}

export function openAgentWindow(): void {
  const d = deps
  if (!d) throw new Error('the agent window is not configured')
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return
  }
  const lang = d.lang()
  const next = new BrowserWindow({
    width: 560,
    height: 760,
    minWidth: 440,
    minHeight: 520,
    show: false,
    center: true,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: `${agentText(lang, 'windowTitle')} - ${productName(lang)}`,
    webPreferences: {
      preload: join(__dirname, '../preload/agent.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win = next
  const ownerId = next.webContents.id
  next.removeMenu()
  next.webContents.setWindowOpenHandler(({ url }) => {
    const target = safeExternalUrl(url)
    if (target) void shell.openExternal(target)
    return { action: 'deny' }
  })
  next.once('ready-to-show', () => next.show())
  next.on('closed', () => {
    manager?.stopOwner(ownerId)
    if (win === next) win = null
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    void next.loadURL(`${process.env.ELECTRON_RENDERER_URL}/agent.html`)
  } else {
    void next.loadFile(join(__dirname, '../renderer/agent.html'))
  }
}

/** The app is quitting: every session ends with it */
export function stopAgentSessions(): void {
  manager?.stopAll()
}
