/**
 * Agent mode on Codex, driven by a fake app-server: the thread's sandbox and
 * permissions, the login and MCP checks, approval requests and their answers.
 * Nothing here reaches a real `codex`.
 */
import { EventEmitter } from 'node:events'
import { PassThrough, Writable } from 'node:stream'
import type { SpawnOptions } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import {
  codexAgentAction,
  codexAgentApprovalPolicy,
  codexAgentFilesystem,
  codexAgentLaunchArgs,
  codexAgentThreadParams,
  startCodexAgentSession,
  type AgentSessionEvent,
  type CodexAgentSessionOptions,
} from '../src/agent-session'
import type { SubscriptionProgram } from '../src/subscription'

const PROGRAM: SubscriptionProgram = {
  provider: 'codex',
  command: 'C:\\fake\\codex.exe',
  prefixArgs: [],
  env: {},
  entry: 'C:\\fake\\codex.exe',
  source: 'path',
}

type Handler = (server: FakeCodex, params: any, id: number) => unknown

class FakeCodex extends EventEmitter {
  readonly pid = 777
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly received: Array<Record<string, any>> = []
  readonly stdin: Writable
  exited = false
  private pending = ''

  constructor(private readonly handlers: Record<string, Handler>) {
    super()
    this.stdin = new Writable({
      write: (chunk: Buffer, _encoding, done) => {
        this.pending += chunk.toString('utf8')
        const parts = this.pending.split('\n')
        this.pending = parts.pop() ?? ''
        for (const part of parts) if (part.trim()) this.receive(JSON.parse(part))
        done()
      },
    })
  }

  private receive(message: Record<string, any>): void {
    this.received.push(message)
    if (typeof message.method !== 'string' || message.id === undefined) return
    const handler = this.handlers[message.method]
    if (!handler) {
      this.send({ id: message.id, result: {} })
      return
    }
    const result = handler(this, message.params, message.id)
    if (result !== undefined) this.send({ id: message.id, result })
  }

  send(message: unknown): void {
    if (!this.exited) this.stdout.write(`${JSON.stringify(message)}\n`)
  }

  exit(code: number | null = 0): void {
    if (this.exited) return
    this.exited = true
    this.stdout.end()
    setImmediate(() => this.emit('close', code, null))
  }

  kill(): boolean {
    return true
  }
}

const baseHandlers = (overrides: Record<string, Handler> = {}): Record<string, Handler> => ({
  initialize: () => ({ userAgent: 'codex' }),
  'account/read': () => ({ account: { type: 'chatgpt', planType: 'plus' } }),
  'config/read': () => ({ config: { mcp_servers: { github: { command: 'x' } } } }),
  'model/list': () => ({ data: [{ id: 'gpt-x', isDefault: true }] }),
  'thread/start': () => ({
    thread: { id: 'th1' },
    activePermissionProfile: { id: 'ieumoffice-agent' },
  }),
  'mcpServerStatus/list': () => ({
    data: [{ name: 'github', runtimeStatus: 'disabled', tools: {} }],
  }),
  'turn/start': () => ({ turn: { id: 'tu1' } }),
  ...overrides,
})

function options(overrides: Partial<CodexAgentSessionOptions> = {}): CodexAgentSessionOptions {
  return {
    projectRoot: 'C:\\Users\\me\\Project',
    mode: 'ask-commands',
    model: '',
    instructions: 'Answer in Korean.',
    openDocuments: ['C:\\Users\\me\\Project\\open.md'],
    protectedPaths: ['C:\\Users\\me\\.codex'],
    sessionDir: 'C:\\Temp\\session-2',
    meteredAccepted: false,
    ...overrides,
  }
}

async function start(
  handlers: Record<string, Handler>,
  overrides: Partial<CodexAgentSessionOptions> = {},
) {
  const events: AgentSessionEvent[] = []
  const spawnCalls: Array<{ command: string; args: string[]; options: SpawnOptions }> = []
  let server!: FakeCodex
  const killTree = vi.fn((target: { pid?: number }) => {
    if (target === server) server.exit(null)
  })
  const run = startCodexAgentSession(options(overrides), (event) => events.push(event), {
    resolveProgram: async () => PROGRAM,
    registry: null,
    platform: 'win32',
    baseEnv: { PATH: 'C:\\Windows', OPENAI_API_KEY: 'sk-no' },
    killTree,
    spawn: (command, args, spawnOptions) => {
      spawnCalls.push({ command, args, options: spawnOptions })
      server = new FakeCodex(handlers)
      return server
    },
  })
  return { run, events, spawnCalls, killTree, server: () => server }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

describe('the launch and the thread', () => {
  it('keeps the brain-only overrides and turns skill instructions on', () => {
    const args = codexAgentLaunchArgs()
    expect(args).toContain('features.hooks=false')
    expect(args).toContain('features.plugins=false')
    expect(args).toContain('skills.include_instructions=true')
    expect(args).not.toContain('skills.include_instructions=false')
    expect(args.slice(-2)).toEqual(['--listen', 'stdio://'])
  })

  it('maps each choice to an approval policy, with the sandbox on in all of them', () => {
    expect(codexAgentApprovalPolicy('ask-commands')).toBe('on-request')
    expect(codexAgentApprovalPolicy('ask-writes')).toBe('untrusted')
    expect(codexAgentApprovalPolicy('trust-project')).toBe('never')
    const params = codexAgentThreadParams(options({ mode: 'trust-project' }), 'gpt-x', {})
    expect(params).not.toHaveProperty('sandbox')
    expect((params.config as any).default_permissions).toBe('ieumoffice-agent')
  })

  it('writes the project, keeps open documents read-only and protected folders unreadable', () => {
    expect(codexAgentFilesystem(options())).toEqual({
      ':root': 'read',
      'C:\\Users\\me\\Project': 'write',
      'C:\\Users\\me\\Project\\open.md': 'read',
      'C:\\Users\\me\\.codex': 'none',
    })
  })

  it('switches user MCP servers off and adds the app one with its token', () => {
    const params = codexAgentThreadParams(
      options({ appMcp: { url: 'http://127.0.0.1:3093/mcp', token: 'tok' } }),
      'gpt-x',
      { github: { enabled: false } },
    )
    expect((params.config as any).mcp_servers).toEqual({
      github: { enabled: false },
      'ieumoffice-editor': {
        url: 'http://127.0.0.1:3093/mcp',
        http_headers: { Authorization: 'Bearer tok' },
      },
    })
    expect(params.developerInstructions).toBe('Answer in Korean.')
    expect(params.ephemeral).toBe(true)
  })

  it('reads the paths of a file change from the item that announced it', () => {
    const action = codexAgentAction(
      'item/fileChange/requestApproval',
      { itemId: 'i1', reason: 'save' },
      new Map([['i1', ['C:\\Users\\me\\Project\\a.md']]]),
    )
    expect(action).toMatchObject({
      kind: 'write',
      paths: ['C:\\Users\\me\\Project\\a.md'],
      reason: 'save',
    })
  })
})

describe('starting a session', () => {
  it('opens a thread in the project folder, sanitised, after checking login and MCP', async () => {
    const { run, spawnCalls, server } = await start(baseHandlers())
    const session = await run
    expect(spawnCalls[0]!.options.cwd).toBe('C:\\Temp\\session-2')
    expect((spawnCalls[0]!.options.env ?? {}).OPENAI_API_KEY).toBeUndefined()
    const methods = server().received.map((message) => message.method)
    expect(methods).toEqual([
      'initialize',
      'initialized',
      'account/read',
      'config/read',
      'model/list',
      'thread/start',
      'mcpServerStatus/list',
    ])
    const thread = server().received.find((message) => message.method === 'thread/start')!
    expect(thread.params).toMatchObject({
      model: 'gpt-x',
      cwd: 'C:\\Users\\me\\Project',
      approvalPolicy: 'on-request',
      config: { mcp_servers: { github: { enabled: false } } },
    })
    session.stop()
  })

  it('refuses a metered login the person did not accept, before any thread', async () => {
    const { run, server } = await start(
      baseHandlers({ 'account/read': () => ({ account: { type: 'apiKey' } }) }),
    )
    await expect(run).rejects.toMatchObject({ kind: 'metered-not-accepted' })
    expect(server().received.some((message) => message.method === 'thread/start')).toBe(false)
  })

  it('runs a metered login the person accepted', async () => {
    const { run } = await start(
      baseHandlers({ 'account/read': () => ({ account: { type: 'apiKey' } }) }),
      { meteredAccepted: true },
    )
    const session = await run
    session.stop()
  })

  it('refuses a signed-out Codex', async () => {
    const { run } = await start(
      baseHandlers({ 'account/read': () => ({ requiresOpenaiAuth: true }) }),
    )
    await expect(run).rejects.toMatchObject({ kind: 'signed-out' })
  })

  it('refuses a thread that runs without the session permissions', async () => {
    const { run, killTree } = await start(
      baseHandlers({
        'thread/start': () => ({ thread: { id: 'th1' }, activePermissionProfile: null }),
      }),
    )
    await expect(run).rejects.toMatchObject({ kind: 'unsafe-tools' })
    expect(killTree).toHaveBeenCalled()
  })

  it('refuses a thread with a user MCP server still attached', async () => {
    const { run } = await start(
      baseHandlers({
        'mcpServerStatus/list': () => ({
          data: [{ name: 'github', runtimeStatus: 'ready', tools: {} }],
        }),
      }),
    )
    await expect(run).rejects.toMatchObject({ kind: 'unsafe-tools' })
  })
})

describe('a running session', () => {
  it('passes messages and tool lines on and ends the turn', async () => {
    const { run, events, server } = await start(
      baseHandlers({
        'turn/start': (fake) => {
          setImmediate(() => {
            fake.send({ method: 'turn/started', params: { turn: { id: 'tu1' } } })
            fake.send({
              method: 'item/started',
              params: {
                item: {
                  type: 'commandExecution',
                  id: 'c1',
                  command: 'dir',
                  cwd: 'C:\\Users\\me\\Project',
                },
              },
            })
            fake.send({
              method: 'item/completed',
              params: {
                item: { type: 'commandExecution', id: 'c1', command: 'dir', status: 'completed' },
              },
            })
            fake.send({
              method: 'item/completed',
              params: { item: { type: 'agentMessage', text: 'Done.' } },
            })
            fake.send({
              method: 'turn/completed',
              params: { turn: { id: 'tu1', status: 'completed' } },
            })
          })
          return { turn: { id: 'tu1' } }
        },
      }),
    )
    const session = await run
    await session.send('list the folder')
    await tick()
    await tick()
    expect(events).toEqual([
      { type: 'started', provider: 'codex', model: 'gpt-x', skills: [] },
      {
        type: 'tool',
        action: expect.objectContaining({ kind: 'command', command: 'dir' }),
        status: 'running',
      },
      {
        type: 'tool',
        action: expect.objectContaining({ kind: 'command', command: 'dir' }),
        status: 'done',
      },
      { type: 'text', text: 'Done.' },
      { type: 'turn-done', ok: true },
    ])
    expect(server().received.find((message) => message.method === 'turn/start')!.params).toEqual({
      threadId: 'th1',
      input: [{ type: 'text', text: 'list the folder', text_elements: [] }],
    })
    session.stop()
  })

  it('asks the person about a command that needs approval, and answers Codex', async () => {
    const { run, events, server } = await start(
      baseHandlers({
        'turn/start': (fake) => {
          setImmediate(() =>
            fake.send({
              id: 'srv-1',
              method: 'item/commandExecution/requestApproval',
              params: {
                itemId: 'c1',
                command: 'curl.exe https://example.com',
                reason: 'needs network',
              },
            }),
          )
          return { turn: { id: 'tu1' } }
        },
      }),
    )
    const session = await run
    await session.send('fetch')
    await tick()
    const asked = events.find((event) => event.type === 'permission')
    expect(asked).toMatchObject({
      request: { provider: 'codex', kind: 'command', reason: 'needs network' },
    })
    session.answer((asked as any).request.id, { allow: true })
    expect(server().received.at(-1)).toEqual({ id: 'srv-1', result: { decision: 'accept' } })
    session.stop()
  })

  it('declines a change to an open document without asking', async () => {
    const { run, events, server } = await start(
      baseHandlers({
        'turn/start': (fake) => {
          setImmediate(() => {
            fake.send({
              method: 'item/started',
              params: {
                item: {
                  type: 'fileChange',
                  id: 'f1',
                  changes: [{ path: 'C:\\Users\\me\\Project\\open.md', kind: 'update', diff: '' }],
                },
              },
            })
            fake.send({
              id: 'srv-2',
              method: 'item/fileChange/requestApproval',
              params: { itemId: 'f1' },
            })
          })
          return { turn: { id: 'tu1' } }
        },
      }),
    )
    const session = await run
    await session.send('edit')
    await tick()
    await tick()
    expect(server().received.at(-1)).toEqual({ id: 'srv-2', result: { decision: 'decline' } })
    expect(events.some((event) => event.type === 'permission')).toBe(false)
    session.stop()
  })

  it('refuses requests it does not grant, such as wider permissions or sign-in tokens', async () => {
    const { run, server } = await start(
      baseHandlers({
        'turn/start': (fake) => {
          setImmediate(() => {
            fake.send({ id: 'srv-3', method: 'item/permissions/requestApproval', params: {} })
            fake.send({ id: 'srv-4', method: 'account/chatgptAuthTokens/refresh', params: {} })
          })
          return { turn: { id: 'tu1' } }
        },
      }),
    )
    const session = await run
    await session.send('x')
    await tick()
    await tick()
    const replies = server().received.filter(
      (message) => message.id === 'srv-3' || message.id === 'srv-4',
    )
    expect(replies).toHaveLength(2)
    for (const reply of replies) expect(reply.error).toMatchObject({ code: -32601 })
    session.stop()
  })

  it('reports a failed turn with its kind', async () => {
    const { run, events } = await start(
      baseHandlers({
        'turn/start': (fake) => {
          setImmediate(() =>
            fake.send({
              method: 'turn/completed',
              params: {
                turn: {
                  id: 'tu1',
                  status: 'failed',
                  error: { message: 'usage limit', codexErrorInfo: 'usageLimitExceeded' },
                },
              },
            }),
          )
          return { turn: { id: 'tu1' } }
        },
      }),
    )
    const session = await run
    await session.send('x')
    await tick()
    expect(events).toContainEqual({ type: 'turn-done', ok: false })
    expect(events).toContainEqual(expect.objectContaining({ type: 'error' }))
    session.stop()
  })

  it('stops a switched-off MCP server that starts anyway', async () => {
    const { run, events } = await start(
      baseHandlers({
        'turn/start': (fake) => {
          setImmediate(() =>
            fake.send({
              method: 'mcpServer/startupStatus/updated',
              params: { name: 'github', status: 'starting' },
            }),
          )
          return { turn: { id: 'tu1' } }
        },
      }),
    )
    const session = await run
    await session.send('x')
    await tick()
    expect(events).toContainEqual(expect.objectContaining({ type: 'error', kind: 'unsafe-tools' }))
    expect(events.at(-1)).toEqual({ type: 'ended' })
  })

  it('ends the process tree when stopped', async () => {
    const { run, killTree, events } = await start(baseHandlers())
    const session = await run
    session.stop()
    session.stop()
    expect(killTree).toHaveBeenCalledTimes(1)
    expect(events.filter((event) => event.type === 'ended')).toHaveLength(1)
  })
})
