/**
 * Agent mode on Claude Code, driven by a fake CLI: the command line, the
 * session files, the tool-list check, permission prompts and their answers,
 * and stopping. Nothing here reaches a real `claude`.
 */
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { PassThrough, Writable } from 'node:stream'
import type { SpawnOptions } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import {
  claudeAgentAction,
  claudeAgentInitProblem,
  claudeAgentLaunchArgs,
  claudeAgentSettings,
  claudeRulePath,
  startClaudeAgentSession,
  type AgentSessionEvent,
  type AgentSessionOptions,
} from '../src/agent-session'
import type { SubscriptionProgram } from '../src/subscription'

const PROGRAM: SubscriptionProgram = {
  provider: 'claude-code',
  command: 'C:\\fake\\claude.exe',
  prefixArgs: [],
  env: {},
  entry: 'C:\\fake\\claude.exe',
  source: 'path',
}

class FakeClaude extends EventEmitter {
  readonly pid = 4242
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly lines: Array<Record<string, any>> = []
  readonly stdin: Writable
  exited = false
  private pending = ''

  constructor(private readonly onLine: (child: FakeClaude, line: Record<string, any>) => void) {
    super()
    this.stdin = new Writable({
      write: (chunk: Buffer, _encoding, done) => {
        this.pending += chunk.toString('utf8')
        const parts = this.pending.split('\n')
        this.pending = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.trim()) continue
          const line = JSON.parse(part) as Record<string, any>
          this.lines.push(line)
          this.onLine(this, line)
        }
        done()
      },
    })
  }

  send(...events: unknown[]): void {
    for (const event of events) if (!this.exited) this.stdout.write(`${JSON.stringify(event)}\n`)
  }

  exit(code: number | null = 0): void {
    if (this.exited) return
    this.exited = true
    this.stdout.end()
    this.stderr.end()
    setImmediate(() => this.emit('close', code, null))
  }

  kill(): boolean {
    return true
  }
}

const INIT = {
  type: 'system',
  subtype: 'init',
  tools: ['Bash', 'Edit', 'Glob', 'Grep', 'PowerShell', 'Read', 'Skill', 'Write'],
  mcp_servers: [],
  model: 'claude-test',
  skills: ['ieum-skills:probe'],
}

function options(overrides: Partial<AgentSessionOptions> = {}): AgentSessionOptions {
  return {
    projectRoot: 'C:\\Users\\me\\Project',
    mode: 'ask-commands',
    model: '',
    instructions: 'Answer in Korean.',
    openDocuments: ['C:\\Users\\me\\Project\\open.md'],
    protectedPaths: ['C:\\Users\\me\\.codex'],
    sessionDir: 'C:\\Temp\\session-1',
    ...overrides,
  }
}

interface Harness {
  child: FakeClaude
  events: AgentSessionEvent[]
  spawnCalls: Array<{ command: string; args: string[]; options: SpawnOptions }>
  files: Map<string, string>
  killTree: ReturnType<typeof vi.fn>
}

async function start(
  onUser: (child: FakeClaude, line: Record<string, any>) => void,
  overrides: Partial<AgentSessionOptions> = {},
  onOther?: (child: FakeClaude, line: Record<string, any>) => void,
) {
  const events: AgentSessionEvent[] = []
  const spawnCalls: Harness['spawnCalls'] = []
  const files = new Map<string, string>()
  let child!: FakeClaude
  const killTree = vi.fn((target: { pid?: number }) => {
    if (target === child) child.exit(null)
  })
  const session = await startClaudeAgentSession(options(overrides), (event) => events.push(event), {
    resolveProgram: async () => PROGRAM,
    registry: null,
    platform: 'win32',
    baseEnv: { PATH: 'C:\\Windows', ANTHROPIC_API_KEY: 'sk-should-not-pass' },
    killTree,
    writeFile: async (path, data) => {
      files.set(path, data)
    },
    spawn: (command, args, spawnOptions) => {
      spawnCalls.push({ command, args, options: spawnOptions })
      child = new FakeClaude((fake, line) => {
        if (line.type === 'control_request' && line.request?.subtype === 'initialize') {
          fake.send({
            type: 'control_response',
            response: { subtype: 'success', request_id: line.request_id, response: {} },
          })
        } else if (line.type === 'user') onUser(fake, line)
        else onOther?.(fake, line)
      })
      return child
    },
  })
  return { session, harness: { child, events, spawnCalls, files, killTree } as Harness }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

describe('the command line and the session files', () => {
  it('turns on the agent tools, keeps user settings out, and puts no path or token on it', () => {
    const args = claudeAgentLaunchArgs({
      model: 'sonnet',
      mode: 'ask-commands',
      settingsFile: 'C:\\Temp\\s\\claude-settings.json',
      mcpConfigFile: 'C:\\Temp\\s\\claude-mcp.json',
      skillBundleDir: 'C:\\Temp\\skills',
    })
    expect(args).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--restricted',
      '--strict-mcp-config',
      '--setting-sources',
      '',
      '--tools',
      'Read,Edit,Write,Glob,Grep,Bash,PowerShell,Skill',
      '--permission-prompts',
      'host',
      '--permission-prompt-tool',
      'stdio',
      '--permission-mode',
      'default',
      '--settings',
      'C:\\Temp\\s\\claude-settings.json',
      '--mcp-config',
      'C:\\Temp\\s\\claude-mcp.json',
      '--plugin-dir',
      'C:\\Temp\\skills',
      '--add-dir',
      'C:\\Temp\\skills',
      '--no-session-persistence',
      '--model',
      'sonnet',
    ])
    expect(args).not.toContain('--dangerously-skip-permissions')
    expect(args).not.toContain('bypassPermissions')
  })

  it('runs a trusted project in the CLI auto mode, never bypassing permissions', () => {
    const args = claudeAgentLaunchArgs({ model: '', mode: 'trust-project', settingsFile: 's.json' })
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('auto')
    expect(args).not.toContain('--model')
  })

  it('refuses a model name that could read as something else', () => {
    expect(() =>
      claudeAgentLaunchArgs({ model: '--evil', mode: 'ask-commands', settingsFile: 's.json' }),
    ).toThrow(/Invalid Claude Code model name/)
  })

  it('writes Windows paths in the rule form and skips paths a rule cannot carry', () => {
    expect(claudeRulePath('C:\\Users\\me\\.codex', 'win32')).toBe('//c/Users/me/.codex')
    expect(claudeRulePath('C:\\a (1)\\b.md', 'win32')).toBeUndefined()
    expect(claudeRulePath('/home/me/.codex', 'linux')).toBe('//home/me/.codex')
  })

  it('blocks reads outside the folder, protected folders, and writes to open documents', () => {
    const settings = claudeAgentSettings(
      { openDocuments: ['C:\\P\\open.md'], protectedPaths: ['C:\\Users\\me\\.codex'] },
      'win32',
    )
    expect(settings).toEqual({
      permissions: {
        blockReadsOutsideWorkingDirectories: true,
        deny: [
          'Read(//c/Users/me/.codex)',
          'Read(//c/Users/me/.codex/**)',
          'Edit(//c/Users/me/.codex)',
          'Edit(//c/Users/me/.codex/**)',
          'Write(//c/Users/me/.codex)',
          'Write(//c/Users/me/.codex/**)',
          'Edit(//c/P/open.md)',
          'Write(//c/P/open.md)',
        ],
      },
    })
  })
})

describe('what the CLI reports at the start', () => {
  it('accepts the tools it was given and the app MCP server', () => {
    expect(claudeAgentInitProblem(INIT)).toBeUndefined()
    expect(
      claudeAgentInitProblem({
        ...INIT,
        tools: [...INIT.tools, 'mcp__ieumoffice-editor__read_document'],
        mcp_servers: [{ name: 'ieumoffice-editor', status: 'connected' }],
      }),
    ).toBeUndefined()
  })

  it('refuses any other tool or MCP server', () => {
    expect(claudeAgentInitProblem({ ...INIT, tools: [...INIT.tools, 'WebFetch'] })).toMatch(/tools/)
    expect(
      claudeAgentInitProblem({ ...INIT, tools: [...INIT.tools, 'mcp__github__create_issue'] }),
    ).toMatch(/tools/)
    expect(
      claudeAgentInitProblem({ ...INIT, mcp_servers: [{ name: 'github', status: 'connected' }] }),
    ).toMatch(/MCP server/)
    expect(claudeAgentInitProblem({ ...INIT, tools: undefined })).toMatch(/tool list/)
  })

  it('reads what each tool call does', () => {
    expect(claudeAgentAction('Write', { file_path: 'a.md', content: 'x' })).toMatchObject({
      kind: 'write',
      paths: ['a.md'],
    })
    expect(claudeAgentAction('PowerShell', { command: 'dir', description: 'list' })).toMatchObject({
      kind: 'command',
      command: 'dir',
      reason: 'list',
    })
    expect(claudeAgentAction('mcp__ieumoffice-editor__apply_ops', {})).toMatchObject({
      kind: 'app-tool',
    })
  })
})

describe('a session', () => {
  it('starts in the project folder, sanitised, with its instructions in the setup request', async () => {
    const { session, harness } = await start(() => undefined, {
      appMcp: { url: 'http://127.0.0.1:3093/mcp', token: 'tok-123' },
    })
    const call = harness.spawnCalls[0]!
    expect(call.command).toBe('C:\\fake\\claude.exe')
    expect(call.options.cwd).toBe('C:\\Users\\me\\Project')
    expect(call.options.shell).toBeFalsy()
    expect((call.options.env ?? {}).ANTHROPIC_API_KEY).toBeUndefined()
    expect(call.args.join(' ')).not.toContain('tok-123')
    // the session joins with the host's separator, so the key is built the same way
    expect(harness.files.get(join('C:\\Temp\\session-1', 'claude-mcp.json'))).toContain(
      'Bearer tok-123',
    )
    expect(harness.child.lines[0]).toMatchObject({
      type: 'control_request',
      request: { subtype: 'initialize', appendSystemPrompt: 'Answer in Korean.' },
    })
    session.stop()
  })

  it('passes text and tool lines on, and ends a turn on the result', async () => {
    const { session, harness } = await start((child) => {
      child.send(
        INIT,
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Looking.' },
              { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.md' } },
            ],
          },
        },
        {
          type: 'user',
          message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] },
        },
        { type: 'result', subtype: 'success', is_error: false, result: 'done' },
      )
    })
    await session.send('Summarise a.md')
    await tick()
    expect(harness.events).toEqual([
      {
        type: 'started',
        provider: 'claude-code',
        model: 'claude-test',
        skills: ['ieum-skills:probe'],
      },
      { type: 'text', text: 'Looking.' },
      {
        type: 'tool',
        action: expect.objectContaining({ kind: 'read', tool: 'Read' }),
        status: 'running',
      },
      {
        type: 'tool',
        action: expect.objectContaining({ kind: 'read', tool: 'Read' }),
        status: 'done',
      },
      { type: 'turn-done', ok: true },
    ])
    expect(harness.child.lines.at(-1)).toMatchObject({
      type: 'user',
      message: { content: [{ type: 'text', text: 'Summarise a.md' }] },
    })
    session.stop()
  })

  it('stops when the CLI starts with a tool it was not given', async () => {
    const { session, harness } = await start((child) => {
      child.send({ ...INIT, tools: [...INIT.tools, 'WebFetch'] })
    })
    await session.send('hi')
    await tick()
    expect(harness.events).toContainEqual(
      expect.objectContaining({ type: 'error', kind: 'unsafe-tools' }),
    )
    expect(harness.events.at(-1)).toEqual({ type: 'ended' })
    expect(harness.killTree).toHaveBeenCalled()
  })

  it('answers a write inside the project itself, and refuses one to an open document', async () => {
    const { session, harness } = await start((child) => {
      child.send(
        INIT,
        {
          type: 'control_request',
          request_id: 'r1',
          request: {
            subtype: 'can_use_tool',
            tool_name: 'Write',
            input: { file_path: 'C:\\Users\\me\\Project\\new.md' },
          },
        },
        {
          type: 'control_request',
          request_id: 'r2',
          request: {
            subtype: 'can_use_tool',
            tool_name: 'Edit',
            input: { file_path: 'C:\\Users\\me\\Project\\OPEN.md' },
            tool_use_id: 'u2',
          },
        },
      )
    })
    await session.send('write')
    await tick()
    const responses = harness.child.lines.filter((line) => line.type === 'control_response')
    expect(responses[0]).toMatchObject({
      response: {
        request_id: 'r1',
        response: {
          behavior: 'allow',
          updatedInput: { file_path: 'C:\\Users\\me\\Project\\new.md' },
        },
      },
    })
    expect(responses[1]).toMatchObject({
      response: { request_id: 'r2', response: { behavior: 'deny' } },
    })
    expect(responses[1]!.response.response.message).toMatch(/ieumoffice-editor/)
    expect(harness.events.some((event) => event.type === 'permission')).toBe(false)
    session.stop()
  })

  it('asks the person about a command and passes the answer back', async () => {
    const { session, harness } = await start((child) => {
      child.send(INIT, {
        type: 'control_request',
        request_id: 'r9',
        request: {
          subtype: 'can_use_tool',
          tool_name: 'Bash',
          input: { command: 'node make.js', description: 'build the deck' },
          tool_use_id: 'u9',
        },
      })
    })
    await session.send('make it')
    await tick()
    const asked = harness.events.find((event) => event.type === 'permission')
    expect(asked).toMatchObject({
      type: 'permission',
      request: {
        id: 'r9',
        provider: 'claude-code',
        kind: 'command',
        command: 'node make.js',
        reason: 'build the deck',
      },
    })
    session.answer('r9', { allow: false })
    await tick()
    expect(harness.child.lines.at(-1)).toMatchObject({
      type: 'control_response',
      response: { request_id: 'r9', response: { behavior: 'deny' } },
    })
    // an answer to a request that is no longer pending writes nothing
    const count = harness.child.lines.length
    session.answer('r9', { allow: true })
    expect(harness.child.lines.length).toBe(count)
    session.stop()
  })

  it('refuses a permission prompt that comes before the tool list', async () => {
    const { session, harness } = await start((child) => {
      child.send({
        type: 'control_request',
        request_id: 'r1',
        request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'dir' } },
      })
    })
    await session.send('hi')
    await tick()
    expect(harness.events).toContainEqual(
      expect.objectContaining({ type: 'error', kind: 'unsafe-tools' }),
    )
  })

  it('reports a failed turn and stays open for the next message', async () => {
    let turns = 0
    const { session, harness } = await start((child) => {
      turns++
      if (turns === 1) {
        child.send(INIT, {
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          api_error_status: 429,
          result: 'limit reached',
        })
      } else child.send({ type: 'result', subtype: 'success', is_error: false, result: 'ok' })
    })
    await session.send('one')
    await tick()
    expect(harness.events).toContainEqual({ type: 'turn-done', ok: false })
    expect(harness.events).toContainEqual(
      expect.objectContaining({ type: 'error', kind: 'rate-limit' }),
    )
    await session.send('two')
    await tick()
    expect(harness.events.at(-1)).toEqual({ type: 'turn-done', ok: true })
    session.stop()
  })

  it('does not take a second message while one is being answered', async () => {
    const { session } = await start(() => undefined)
    await session.send('one')
    await expect(session.send('two')).rejects.toThrow(/still answering/)
    session.stop()
  })

  it('ends the process tree when stopped, and reports it once', async () => {
    const { session, harness } = await start(() => undefined)
    session.stop()
    session.stop()
    await tick()
    expect(harness.killTree).toHaveBeenCalledTimes(1)
    expect(harness.events.filter((event) => event.type === 'ended')).toHaveLength(1)
    await expect(session.send('late')).rejects.toThrow(/ended/)
  })

  it('reports a CLI that exits by itself', async () => {
    const { session, harness } = await start((child) => {
      child.stderr.write('boom')
      child.exit(3)
    })
    await session.send('hi')
    await tick()
    await tick()
    expect(harness.events).toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(harness.events.at(-1)).toEqual({ type: 'ended' })
  })
})
