/**
 * Agent mode (decision 0032): the user's Claude Code or Codex runs with its own
 * tools in a project folder the user chose, instead of answering one turn with
 * no tools. These are the shapes the session runners and the app share.
 */
import type { AiRunErrorKind, AiSubscriptionProviderId } from '../types'

/**
 * When the app asks the person before the program acts.
 * - `ask-commands`: file edits inside the project folder go ahead; every command asks.
 * - `ask-writes`: file edits and commands both ask.
 * - `trust-project`: nothing asks. Codex still runs commands in its sandbox; Claude
 *   (no command sandbox on Windows) runs in its own `auto` mode, where a second
 *   model reviews each action.
 */
export type AgentPermissionMode = 'ask-commands' | 'ask-writes' | 'trust-project'

export const AGENT_PERMISSION_MODES: readonly AgentPermissionMode[] = [
  'ask-commands',
  'ask-writes',
  'trust-project',
]

export const DEFAULT_AGENT_PERMISSION_MODE: AgentPermissionMode = 'ask-commands'

export function isAgentPermissionMode(value: unknown): value is AgentPermissionMode {
  return typeof value === 'string' && (AGENT_PERMISSION_MODES as readonly string[]).includes(value)
}

/** What a program asked to do, reduced to what the policy and the dialog need */
export type AgentActionKind =
  /** read a file or list a folder */
  | 'read'
  /** create, edit or delete a file */
  | 'write'
  /** run a command or a script */
  | 'command'
  /** a tool of the app's own MCP server (open documents) */
  | 'app-tool'
  /** load a skill's instructions */
  | 'skill'
  | 'other'

export interface AgentAction {
  kind: AgentActionKind
  /** the program's own tool name (`Bash`, `Write`, `commandExecution`, …) */
  tool: string
  /** the full command line, for a command */
  command?: string | undefined
  /** absolute paths the action names, when the program said so */
  paths: string[]
  /** the folder a command runs in, when the program said so */
  cwd?: string | undefined
  /** the program's own explanation, when it gave one */
  reason?: string | undefined
}

/** A request shown to the person; `id` is answered with `AgentPermissionAnswer` */
export interface AgentPermissionRequest extends AgentAction {
  id: string
  provider: AiSubscriptionProviderId
}

export type AgentPermissionAnswer = { allow: true } | { allow: false; message?: string | undefined }

/** What the policy decided before anyone is asked */
export type AgentPolicyVerdict =
  { decision: 'allow' } | { decision: 'ask' } | { decision: 'deny'; reason: AgentDenyReason }

export type AgentDenyReason =
  /** a path outside the project folder (and outside the session's skill copy) */
  | 'outside-project'
  /** a file open in a tab: the editor holds its state, the app's tools edit it */
  | 'open-document'
  /** sign-in stores, the original app's folder, the app's own data */
  | 'protected-path'

export type AgentSessionEvent =
  /** the program reported what it runs with; the session checked it */
  | {
      type: 'started'
      provider: AiSubscriptionProviderId
      model?: string | undefined
      skills: string[]
    }
  /** a complete piece of the program's answer */
  | { type: 'text'; text: string }
  /** the program used a tool (shown as a line in the panel) */
  | { type: 'tool'; action: AgentAction; status: 'running' | 'done' | 'failed' | 'denied' }
  /** the program wants an answer before it goes on */
  | { type: 'permission'; request: AgentPermissionRequest }
  /** the program finished answering one message; the session stays open for the next */
  | { type: 'turn-done'; ok: boolean }
  /** the session ended with a failure; `kind` follows the app's run errors */
  | { type: 'error'; kind?: AiRunErrorKind | undefined; message: string }
  /** the program is gone (stopped, failed, or idle) */
  | { type: 'ended' }

export interface AgentSessionOptions {
  /** absolute path of the project folder; the program's working directory */
  projectRoot: string
  mode: AgentPermissionMode
  /** model id as the program takes it; empty for the program's default */
  model: string
  /** the user's own path to the CLI (settings), if any */
  cliPath?: string | undefined
  /** text the app adds to the program's own instructions (language, app tools, project notes) */
  instructions: string
  /** absolute paths of documents open in tabs, at the start; kept current with `setOpenDocuments` */
  openDocuments: string[]
  /** absolute paths the program must not read or write (sign-in stores, app data, …) */
  protectedPaths: string[]
  /** a folder of skill copies made for this session (`buildAgentSkillBundle`), if any */
  skillBundleDir?: string | undefined
  /** the app's own MCP server for open documents, if the session may use it */
  appMcp?: { url: string; token: string } | undefined
  /** a folder the session may write its own files into (settings, MCP config) */
  sessionDir: string
}

export interface AgentSession {
  readonly provider: AiSubscriptionProviderId
  /** send the person's next message; resolves when the program accepted it */
  send(text: string): Promise<void>
  /** answer a pending permission request */
  answer(id: string, answer: AgentPermissionAnswer): void
  /** the documents open in tabs changed */
  setOpenDocuments(paths: string[]): void
  /** stop now: the program and everything it started are ended */
  stop(): void
}
