import type { Lang } from '@genoffice/i18n'

/**
 * The agent window (decision 0032): channels and the shapes the window and the
 * shell main share. The window's preload (src/preload/agent.ts) is the only
 * caller of these channels; Home only opens the window.
 */

export const AGENT_CHANNELS = {
  getInit: 'agent-window:get-init',
  pickFolder: 'agent-window:pick-folder',
  setPrefs: 'agent-window:set-prefs',
  start: 'agent-window:start',
  send: 'agent-window:send',
  answer: 'agent-window:answer',
  stop: 'agent-window:stop',
  openFile: 'agent-window:open-file',
  getTheme: 'agent-window:get-theme',
  /** main → window: one session event */
  event: 'agent-window:event',
} as const

/** Home → main: open (or focus) the agent window */
export const AGENT_HOME_OPEN_CHANNEL = 'home:open-agent-window'

export type AgentProvider = 'claude-code' | 'codex'
export type AgentMode = 'ask-commands' | 'ask-writes' | 'trust-project'

export const AGENT_PROVIDERS: readonly AgentProvider[] = ['claude-code', 'codex']
export const AGENT_MODES: readonly AgentMode[] = ['ask-commands', 'ask-writes', 'trust-project']

/** Bump when the first-use warning says something new: an older consent no longer counts */
export const AGENT_WARNING_VERSION = 1

export interface AgentPrefs {
  provider: AgentProvider
  mode: AgentMode
  /** most recent first, at most `AGENT_RECENT_LIMIT` */
  recentFolders: string[]
  /** the warning version the person accepted; 0 for none */
  warningAccepted: number
}

export const AGENT_RECENT_LIMIT = 8

export const DEFAULT_AGENT_PREFS: AgentPrefs = {
  provider: 'claude-code',
  mode: 'ask-commands',
  recentFolders: [],
  warningAccepted: 0,
}

/** The connection of each program as the window needs it to offer a start */
export type AgentConnection = 'ready' | 'metered-accepted' | 'unavailable' | 'checking'

export interface AgentInit {
  lang: Lang
  prefs: AgentPrefs
  connections: Record<AgentProvider, AgentConnection>
}

export type AgentStartResponse =
  | { ok: true; sessionId: string }
  | {
      ok: false
      reason: 'bad-folder' | 'not-connected' | 'start-failed' | 'not-accepted'
      kind?: string | undefined
    }

/** What a tool line or a permission request shows; paths and commands are shown as they are */
export interface AgentActionView {
  kind: 'read' | 'write' | 'command' | 'app-tool' | 'skill' | 'other'
  tool: string
  command?: string | undefined
  paths: string[]
  reason?: string | undefined
}

export type AgentEventView =
  | { type: 'started'; provider: AgentProvider; model?: string | undefined; skills: number }
  | { type: 'text'; text: string }
  | { type: 'tool'; action: AgentActionView; status: 'running' | 'done' | 'failed' | 'denied' }
  | { type: 'permission'; id: string; action: AgentActionView }
  | { type: 'turn-done'; ok: boolean }
  | { type: 'error'; kind?: string | undefined }
  | { type: 'ended' }

export interface AgentEventPayload {
  sessionId: string
  event: AgentEventView
}

export interface AgentWindowApi {
  getInit(): Promise<AgentInit>
  getTheme(): Promise<'light' | 'dark' | 'system'>
  onThemeChanged(handler: (theme: 'light' | 'dark' | 'system') => void): () => void
  /** the folder dialog; null when cancelled */
  pickFolder(): Promise<string | null>
  setPrefs(prefs: Partial<AgentPrefs>): Promise<AgentPrefs>
  start(request: {
    provider: AgentProvider
    mode: AgentMode
    folder: string
  }): Promise<AgentStartResponse>
  send(sessionId: string, text: string): Promise<boolean>
  answer(sessionId: string, requestId: string, allow: boolean): Promise<void>
  stop(sessionId: string): Promise<void>
  /** open a file of the session's project folder in a tab */
  openFile(sessionId: string, path: string): Promise<boolean>
  onEvent(handler: (payload: AgentEventPayload) => void): () => void
}

export function normalizeAgentPrefs(raw: unknown): AgentPrefs {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const provider = AGENT_PROVIDERS.includes(value.provider as AgentProvider)
    ? (value.provider as AgentProvider)
    : DEFAULT_AGENT_PREFS.provider
  const mode = AGENT_MODES.includes(value.mode as AgentMode)
    ? (value.mode as AgentMode)
    : DEFAULT_AGENT_PREFS.mode
  const recentFolders = Array.isArray(value.recentFolders)
    ? [
        ...new Set(
          value.recentFolders.filter((f): f is string => typeof f === 'string' && f.length > 0),
        ),
      ].slice(0, AGENT_RECENT_LIMIT)
    : []
  const warningAccepted =
    typeof value.warningAccepted === 'number' && Number.isInteger(value.warningAccepted)
      ? value.warningAccepted
      : 0
  return { provider, mode, recentFolders, warningAccepted }
}

/** `folder` first, without its older copy */
export function withRecentFolder(prefs: AgentPrefs, folder: string): AgentPrefs {
  const rest = prefs.recentFolders.filter((f) => f.toLowerCase() !== folder.toLowerCase())
  return { ...prefs, recentFolders: [folder, ...rest].slice(0, AGENT_RECENT_LIMIT) }
}
