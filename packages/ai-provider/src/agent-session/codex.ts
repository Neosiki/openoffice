/**
 * Agent mode on Codex (decision 0032): a Codex app-server of the session's own
 * runs one thread in the project folder with Codex's tools on, inside Codex's
 * sandbox, and asks the app before it goes beyond it.
 *
 * What keeps it contained:
 * - a permission profile of the session: the project folder is writable, the
 *   documents open in tabs are read-only, protected folders cannot be read,
 *   and there is no network. Codex enforces it in its own sandbox (on Windows,
 *   the restricted-token sandbox). A thread that does not report the profile
 *   as active is ended rather than run under looser rules;
 * - the same configuration overrides as the brain-only bridge (no user hooks,
 *   plugins, apps or memories), except that skill instructions are on;
 * - every user MCP server switched off for the thread, the app's own server
 *   added, and the attached list checked afterwards;
 * - the login checked before the thread opens: a metered login runs only when
 *   the person accepted it.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  CODEX_CONFIG_OVERRIDES,
  activePermissionProfileId,
  attachBoundedRpcStdout,
  codexAttachedMcpServers,
  codexMcpServerOverrides,
  codexRunError,
} from '../codex-app-server'
import { isPlainObject } from '../protocols/shared'
import { AiRunError } from '../run-error'
import { resolveSubscriptionProgram, type SubscriptionProgram } from '../subscription/locate'
import {
  killProcessTree,
  spawnSubscriptionProgram,
  type SubscriptionChildRegistry,
  type SubscriptionSpawn,
} from '../subscription/process'
import { codexAccountInfo } from '../subscription/status'
import { APP_MCP_SERVER_NAME } from './claude'
import { agentPolicyVerdict } from './policy'
import type {
  AgentAction,
  AgentPermissionAnswer,
  AgentPermissionMode,
  AgentSession,
  AgentSessionEvent,
  AgentSessionOptions,
} from './types'

const PROVIDER = 'codex'
export const CODEX_AGENT_PROFILE = 'ieumoffice-agent'
const REQUEST_TIMEOUT_MS = 30_000
const DIAGNOSTIC_LIMIT = 4_000
const DEFAULT_IDLE_MS = 30 * 60_000
const MAX_MCP_STATUS_PAGES = 10

/** The brain-only overrides with skill instructions turned on */
export function codexAgentLaunchArgs(): string[] {
  const overrides = CODEX_CONFIG_OVERRIDES.map((override) =>
    override.startsWith('skills.include_instructions=')
      ? 'skills.include_instructions=true'
      : override,
  )
  return [
    'app-server',
    ...overrides.flatMap((override) => ['-c', override]),
    '--listen',
    'stdio://',
  ]
}

/**
 * Codex's approval policy for the person's choice. The sandbox is on in all
 * three: `on-request` lets Codex work inside it and ask to go beyond it;
 * `untrusted` asks before anything but known-safe reads; `never` does not ask,
 * and what the sandbox does not allow simply fails.
 */
export function codexAgentApprovalPolicy(
  mode: AgentPermissionMode,
): 'on-request' | 'untrusted' | 'never' {
  switch (mode) {
    case 'ask-commands':
      return 'on-request'
    case 'ask-writes':
      return 'untrusted'
    case 'trust-project':
      return 'never'
  }
}

/**
 * The session's file-system rules. Codex's Windows sandbox needs read access
 * from the root to start, so reading is open except where it is taken away.
 */
export function codexAgentFilesystem(
  options: Pick<
    AgentSessionOptions,
    'projectRoot' | 'openDocuments' | 'protectedPaths' | 'skillBundleDir'
  >,
): Record<string, 'read' | 'write' | 'none'> {
  const filesystem: Record<string, 'read' | 'write' | 'none'> = { ':root': 'read' }
  filesystem[options.projectRoot] = 'write'
  for (const path of options.openDocuments) filesystem[path] = 'read'
  for (const path of options.protectedPaths) filesystem[path] = 'none'
  return filesystem
}

export function codexAgentThreadParams(
  options: AgentSessionOptions,
  model: string,
  userMcpServers: Record<string, { enabled: false }>,
): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = { ...userMcpServers }
  if (options.appMcp) {
    mcpServers[APP_MCP_SERVER_NAME] = {
      url: options.appMcp.url,
      http_headers: { Authorization: `Bearer ${options.appMcp.token}` },
    }
  }
  return {
    model,
    cwd: options.projectRoot,
    approvalPolicy: codexAgentApprovalPolicy(options.mode),
    serviceName: CODEX_AGENT_PROFILE,
    developerInstructions: options.instructions,
    ephemeral: true,
    config: {
      default_permissions: CODEX_AGENT_PROFILE,
      permissions: { [CODEX_AGENT_PROFILE]: { filesystem: codexAgentFilesystem(options) } },
      mcp_servers: mcpServers,
    },
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

/** What a Codex approval request asks for, in the policy's terms */
export function codexAgentAction(
  method: string,
  params: Record<string, unknown>,
  fileChangePaths: ReadonlyMap<string, string[]>,
): AgentAction {
  if (method === 'item/commandExecution/requestApproval') {
    return {
      kind: 'command',
      tool: 'commandExecution',
      command: text(params.command) ?? '',
      cwd: text(params.cwd),
      paths: [],
      reason: text(params.reason),
    }
  }
  if (method === 'item/fileChange/requestApproval') {
    const itemId = text(params.itemId) ?? ''
    const grantRoot = text(params.grantRoot)
    return {
      kind: 'write',
      tool: 'fileChange',
      paths: [...(fileChangePaths.get(itemId) ?? []), ...(grantRoot ? [grantRoot] : [])],
      reason: text(params.reason),
    }
  }
  return { kind: 'other', tool: method, paths: [], reason: text(params.reason) }
}

function itemAction(item: Record<string, unknown>): AgentAction | undefined {
  if (item.type === 'commandExecution') {
    return {
      kind: 'command',
      tool: 'commandExecution',
      command: text(item.command) ?? '',
      cwd: text(item.cwd),
      paths: [],
    }
  }
  if (item.type === 'fileChange') {
    const changes = Array.isArray(item.changes) ? item.changes : []
    const paths = changes.flatMap((change) =>
      isPlainObject(change) && text(change.path) ? [change.path as string] : [],
    )
    return { kind: 'write', tool: 'fileChange', paths }
  }
  if (item.type === 'mcpToolCall') {
    return {
      kind: 'app-tool',
      tool: `${text(item.server) ?? ''}:${text(item.tool) ?? ''}`,
      paths: [],
    }
  }
  return undefined
}

function itemStatus(item: Record<string, unknown>): 'done' | 'failed' | 'denied' {
  const status = text(item.status)
  if (status === 'declined') return 'denied'
  if (status === 'failed') return 'failed'
  return 'done'
}

export interface CodexAgentDeps {
  resolveProgram?:
    ((configuredPath: string | undefined) => Promise<SubscriptionProgram>) | undefined
  spawn?: SubscriptionSpawn | undefined
  registry?: SubscriptionChildRegistry | null | undefined
  baseEnv?: NodeJS.ProcessEnv | undefined
  killTree?: ((child: { readonly pid?: number | undefined }) => void) | undefined
  idleMs?: number | undefined
  platform?: NodeJS.Platform | undefined
}

export interface CodexAgentSessionOptions extends AgentSessionOptions {
  /** the person accepted a metered login for Codex (settings and the acceptance record agree) */
  meteredAccepted: boolean
}

export async function startCodexAgentSession(
  options: CodexAgentSessionOptions,
  onEvent: (event: AgentSessionEvent) => void,
  deps: CodexAgentDeps = {},
): Promise<AgentSession> {
  const platform = deps.platform ?? process.platform
  const program = await (
    deps.resolveProgram ??
    ((configuredPath) => resolveSubscriptionProgram(PROVIDER, { configuredPath }))
  )(options.cliPath)
  let child: ChildProcessWithoutNullStreams
  try {
    // the session folder as working directory: no project configuration of wherever the app
    // was started applies to the process; the thread's own folder is given per thread
    child = spawnSubscriptionProgram(program, codexAgentLaunchArgs(), {
      cwd: options.sessionDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      baseEnv: deps.baseEnv,
      spawn: deps.spawn,
      registry: deps.registry,
      platform,
    }) as ChildProcessWithoutNullStreams
  } catch (error) {
    throw (error as NodeJS.ErrnoException)?.code === 'ENOENT'
      ? new AiRunError('not-installed', 'Codex CLI was not found', { provider: PROVIDER })
      : error
  }
  const killTree = deps.killTree ?? ((target) => killProcessTree(target, { force: true }))

  let openDocuments = [...options.openDocuments]
  let ended = false
  let stopping = false
  let threadId = ''
  let turnId = ''
  let busy = false
  let stderr = ''
  let nextId = 1
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let reportedError: unknown
  const rpcPending = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  /** approval requests waiting for the person, by the id shown to them */
  const pending = new Map<string, { rpcId: number | string }>()
  const fileChangePaths = new Map<string, string[]>()

  const emit = (event: AgentSessionEvent): void => {
    if (!ended) onEvent(event)
  }
  const writeLine = (message: unknown): void => {
    if (!ended && child.stdin.writable) child.stdin.write(`${JSON.stringify(message)}\n`)
  }
  const end = (error?: Error): void => {
    if (ended) return
    if (error) {
      onEvent({
        type: 'error',
        kind: error instanceof AiRunError ? error.kind : undefined,
        message: error.message,
      })
    }
    ended = true
    clearTimeout(idleTimer)
    for (const request of rpcPending.values()) {
      clearTimeout(request.timer)
      request.reject(error ?? new Error('The agent session has ended'))
    }
    rpcPending.clear()
    pending.clear()
    onEvent({ type: 'ended' })
  }
  const stopNow = (error?: Error): void => {
    stopping = true
    killTree(child)
    end(error)
  }
  const armIdle = (): void => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => stopNow(), deps.idleMs ?? DEFAULT_IDLE_MS)
    idleTimer.unref?.()
  }
  const request = (method: string, params: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (ended) {
        reject(new Error('The agent session has ended'))
        return
      }
      const id = nextId++
      const timer = setTimeout(() => {
        rpcPending.delete(id)
        reject(new Error(`Codex app-server request timed out: ${method}`))
      }, REQUEST_TIMEOUT_MS)
      timer.unref?.()
      rpcPending.set(id, { resolve, reject, timer })
      writeLine({ method, id, params })
    })

  const answerApproval = (rpcId: number | string, accept: boolean): void => {
    writeLine({ id: rpcId, result: { decision: accept ? 'accept' : 'decline' } })
  }

  const onServerRequest = (message: Record<string, unknown>): void => {
    const rpcId = message.id as number | string
    const method = message.method as string
    const params = isPlainObject(message.params) ? message.params : {}
    if (
      method === 'item/commandExecution/requestApproval' ||
      method === 'item/fileChange/requestApproval'
    ) {
      const action = codexAgentAction(method, params, fileChangePaths)
      const verdict = agentPolicyVerdict(action, {
        mode: options.mode,
        projectRoot: options.projectRoot,
        openDocuments,
        protectedPaths: options.protectedPaths,
        skillBundleDir: options.skillBundleDir,
        platform,
      })
      if (verdict.decision === 'allow') {
        answerApproval(rpcId, true)
        return
      }
      if (verdict.decision === 'deny') {
        // Codex reports the declined item itself, which the panel shows as denied
        answerApproval(rpcId, false)
        return
      }
      const id = randomUUID()
      pending.set(id, { rpcId })
      emit({ type: 'permission', request: { ...action, id, provider: PROVIDER } })
      return
    }
    // anything else (more permissions, questions, attestation, sign-in tokens) is not the
    // app's to grant: refuse it instead of leaving Codex waiting
    writeLine({
      id: rpcId,
      error: { code: -32601, message: `Unsupported server request: ${method}` },
    })
  }

  const onNotification = (method: string, params: Record<string, unknown>): void => {
    switch (method) {
      case 'mcpServer/startupStatus/updated': {
        const name = text(params.name)
        const status = text(params.status)
        if ((status === 'starting' || status === 'ready') && name !== APP_MCP_SERVER_NAME) {
          stopNow(
            new AiRunError('unsafe-tools', 'Codex started an MCP server that was switched off'),
          )
        }
        return
      }
      case 'item/started': {
        const item = isPlainObject(params.item) ? params.item : undefined
        if (!item) return
        const action = itemAction(item)
        if (item.type === 'fileChange' && typeof item.id === 'string' && action) {
          fileChangePaths.set(item.id, action.paths)
        }
        if (action) emit({ type: 'tool', action, status: 'running' })
        return
      }
      case 'item/completed': {
        const item = isPlainObject(params.item) ? params.item : undefined
        if (!item) return
        if (item.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim()) {
          emit({ type: 'text', text: item.text })
          return
        }
        const action = itemAction(item)
        if (action) emit({ type: 'tool', action, status: itemStatus(item) })
        if (typeof item.id === 'string') fileChangePaths.delete(item.id)
        return
      }
      case 'turn/started': {
        const turn = isPlainObject(params.turn) ? params.turn : undefined
        if (typeof turn?.id === 'string') turnId = turn.id
        return
      }
      case 'turn/completed': {
        busy = false
        turnId = ''
        armIdle()
        const turn = isPlainObject(params.turn) ? params.turn : undefined
        if (turn?.status === 'failed') {
          const error = codexRunError(turn.error ?? reportedError)
          reportedError = undefined
          emit({ type: 'turn-done', ok: false })
          emit({
            type: 'error',
            kind: error instanceof AiRunError ? error.kind : undefined,
            message: error.message,
          })
          return
        }
        reportedError = undefined
        emit({ type: 'turn-done', ok: turn?.status !== 'interrupted' })
        return
      }
      case 'error':
        // a retried stream is still live; a warning arrives the same way, so only the turn's
        // own outcome decides
        if (params.willRetry !== true)
          reportedError = isPlainObject(params.error) ? params.error : params
        return
    }
  }

  const onLine = (line: string): void => {
    let message: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(line)
      if (!isPlainObject(parsed)) return
      message = parsed
    } catch {
      return
    }
    if (typeof message.method === 'string' && message.id !== undefined) {
      onServerRequest(message)
      return
    }
    if (typeof message.id === 'number') {
      const waiting = rpcPending.get(message.id)
      if (!waiting) return
      clearTimeout(waiting.timer)
      rpcPending.delete(message.id)
      if (message.error !== undefined) {
        const detail =
          isPlainObject(message.error) && typeof message.error.message === 'string'
            ? message.error.message
            : 'error'
        waiting.reject(new Error(`Codex app-server: ${detail}`))
      } else waiting.resolve(message.result)
      return
    }
    if (typeof message.method === 'string') {
      onNotification(message.method, isPlainObject(message.params) ? message.params : {})
    }
  }

  attachBoundedRpcStdout({ stdout: child.stdout, kill: () => killTree(child) }, onLine, (error) =>
    stopNow(error),
  )
  child.stdin.on('error', () => undefined)
  child.stderr.on('data', (chunk: Buffer) => {
    const next = stderr + chunk.toString()
    stderr = next.length <= DIAGNOSTIC_LIMIT ? next : next.slice(-DIAGNOSTIC_LIMIT)
  })
  child.once('error', (error) =>
    end(
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? new AiRunError('not-installed', 'Codex CLI was not found', { provider: PROVIDER })
        : error,
    ),
  )
  child.once('close', (code: number | null) => {
    const detail = stderr.trim()
    end(
      stopping
        ? undefined
        : new Error(`Codex app-server exited (${code ?? 'unknown'})${detail ? `: ${detail}` : ''}`),
    )
  })

  try {
    await request('initialize', {
      clientInfo: { name: CODEX_AGENT_PROFILE, title: 'Agent session', version: '0.1.0' },
      capabilities: { experimentalApi: false, requestAttestation: false },
    })
    writeLine({ method: 'initialized' })

    const login = codexAccountInfo(await request('account/read', { refreshToken: false }))
    if (!login || !login.signedIn) {
      throw new AiRunError('signed-out', 'Codex is not signed in', { provider: PROVIDER })
    }
    if (login.loginMethod !== 'subscription' && !options.meteredAccepted) {
      throw new AiRunError(
        'metered-not-accepted',
        'Codex is signed in with a login that is billed by usage, which has not been accepted',
        { provider: PROVIDER },
      )
    }

    let userMcpServers: Record<string, { enabled: false }>
    try {
      userMcpServers = codexMcpServerOverrides(
        await request('config/read', { includeLayers: false, cwd: options.projectRoot }),
      )
    } catch {
      throw new AiRunError('unsafe-tools', 'Codex could not report its configured MCP servers')
    }
    delete (userMcpServers as Record<string, unknown>)[APP_MCP_SERVER_NAME]

    const model = options.model.trim() || (await defaultModel(request))
    const started = await request(
      'thread/start',
      codexAgentThreadParams(options, model, userMcpServers),
    )
    if (activePermissionProfileId(started) !== CODEX_AGENT_PROFILE) {
      throw new AiRunError(
        'unsafe-tools',
        'Codex did not apply the session permissions; nothing was run',
      )
    }
    const thread =
      isPlainObject(started) && isPlainObject(started.thread) ? started.thread : undefined
    threadId = typeof thread?.id === 'string' ? thread.id : ''
    if (!threadId) throw new Error('Codex app-server did not return a thread id')

    let cursor: string | null = null
    const attached: string[] = []
    for (let page = 0; page < MAX_MCP_STATUS_PAGES; page++) {
      const result = await request('mcpServerStatus/list', {
        threadId,
        detail: 'toolsAndAuthOnly',
        cursor,
        limit: 100,
      })
      attached.push(...codexAttachedMcpServers(result))
      const next = isPlainObject(result) ? result.nextCursor : undefined
      cursor = typeof next === 'string' && next ? next : null
      if (!cursor) break
    }
    if (cursor !== null || attached.some((name) => name !== APP_MCP_SERVER_NAME)) {
      throw new AiRunError('unsafe-tools', 'Codex attached an MCP server the app did not give it')
    }
    emit({ type: 'started', provider: PROVIDER, model, skills: [] })
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error))
    stopNow()
    throw failure
  }
  armIdle()

  return {
    provider: PROVIDER,
    async send(message: string): Promise<void> {
      if (ended) throw new Error('The agent session has ended')
      if (busy) throw new Error('The agent is still answering the previous message')
      busy = true
      clearTimeout(idleTimer)
      try {
        await request('turn/start', {
          threadId,
          input: [{ type: 'text', text: message, text_elements: [] }],
        })
      } catch (error) {
        busy = false
        armIdle()
        throw error
      }
    },
    answer(id: string, answer: AgentPermissionAnswer): void {
      const waiting = pending.get(id)
      if (!waiting) return
      pending.delete(id)
      answerApproval(waiting.rpcId, answer.allow)
    },
    setOpenDocuments(paths: string[]): void {
      openDocuments = [...paths]
    },
    stop(): void {
      if (ended) return
      if (threadId && turnId)
        writeLine({ method: 'turn/interrupt', id: nextId++, params: { threadId, turnId } })
      stopNow()
    },
  }
}

async function defaultModel(
  request: (method: string, params: unknown) => Promise<unknown>,
): Promise<string> {
  const result = await request('model/list', { cursor: null, limit: 100, includeHidden: false })
  const data = isPlainObject(result) && Array.isArray(result.data) ? result.data : []
  let first = ''
  for (const value of data) {
    if (!isPlainObject(value) || value.hidden === true) continue
    const id = text(value.id) ?? text(value.model) ?? ''
    if (!id) continue
    if (value.isDefault === true) return id
    first ||= id
  }
  if (!first) throw new Error('Codex listed no model, so there is no default model to run with')
  return first
}
