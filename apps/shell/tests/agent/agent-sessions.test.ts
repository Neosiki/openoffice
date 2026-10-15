/**
 * Agent sessions in the shell (decision 0032): which folders may be a project,
 * what a session starts with, who may drive it, and what the window is shown.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentSession,
  AgentSessionEvent,
  AgentSessionOptions,
} from '@genoffice/ai-provider/agent-session'
import type { AiSettings, AiSubscriptionStatus } from '@genoffice/ai-provider'
import { normalizeAiSettings } from '@genoffice/ai-provider'
import {
  agentInstructions,
  agentProtectedPaths,
  createAgentManager,
  openableProjectFile,
  projectFolderProblem,
} from '../../src/main/agent/agent-sessions'
import {
  AGENT_RECENT_LIMIT,
  normalizeAgentPrefs,
  withRecentFolder,
} from '../../src/shared/agent-api'
import {
  EMPTY_AGENT_LOG,
  agentLogAfterAnswer,
  agentLogAfterSend,
  agentLogWith,
} from '../../src/renderer/src/agent/agent-log'

vi.mock('electron', () => ({
  BrowserWindow: class {},
  dialog: {},
  ipcMain: { handle: vi.fn() },
  shell: {},
}))
const { agentConnections, agentEventView } = await import('../../src/main/agent/agent-window')

const roots: string[] = []
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-shell-test-'))
  roots.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const ready = (provider: 'claude-code' | 'codex'): AiSubscriptionStatus =>
  ({ provider, state: 'ready', meteredAccepted: false }) as AiSubscriptionStatus

describe('project folders', () => {
  it('takes a folder of the person’s work', () => {
    const home = temp()
    const project = join(home, 'Documents', 'Report')
    mkdirSync(project, { recursive: true })
    expect(
      projectFolderProblem(
        project,
        home,
        agentProtectedPaths(home, join(home, 'AppData', 'IeumOffice')),
      ),
    ).toBeUndefined()
  })

  it('refuses a drive root, the home folder, a parent of a protected folder, and a protected folder', () => {
    const home = temp()
    const userData = join(home, 'AppData', 'IeumOffice')
    mkdirSync(join(home, '.codex'), { recursive: true })
    mkdirSync(userData, { recursive: true })
    const guards = agentProtectedPaths(home, userData)
    expect(projectFolderProblem(join(home, '..', '..').slice(0, 3), home, guards)).toBeDefined()
    expect(projectFolderProblem(home, home, guards)).toBe('home-folder')
    expect(projectFolderProblem(join(home, 'AppData'), home, guards)).toBe('protected')
    expect(projectFolderProblem(join(home, '.codex'), home, guards)).toBe('protected')
  })

  it('refuses a relative path, a missing folder and a file', () => {
    const home = temp()
    writeFileSync(join(home, 'a.txt'), 'x')
    expect(projectFolderProblem('relative', home, [])).toBe('not-absolute')
    expect(projectFolderProblem(join(home, 'missing'), home, [])).toBe('missing')
    expect(projectFolderProblem(join(home, 'a.txt'), home, [])).toBe('not-a-folder')
  })

  it('opens only existing files inside the project', () => {
    const project = temp()
    writeFileSync(join(project, 'out.pptx'), 'x')
    expect(openableProjectFile(project, 'out.pptx')).toBe(join(project, 'out.pptx'))
    expect(openableProjectFile(project, join(project, '..', 'elsewhere.pptx'))).toBeUndefined()
    expect(openableProjectFile(project, 'missing.pptx')).toBeUndefined()
  })
})

describe('instructions', () => {
  it('adds the project notes for Claude, and only CLAUDE.md for Codex (it reads AGENTS.md itself)', async () => {
    const project = temp()
    writeFileSync(join(project, 'CLAUDE.md'), 'Use formal Korean.')
    writeFileSync(join(project, 'AGENTS.md'), 'Agents file.')
    const claude = await agentInstructions('claude-code', project, 'ko', true)
    expect(claude).toContain('Use formal Korean.')
    expect(claude).toContain('Agents file.')
    expect(claude).toContain('ieumoffice-editor')
    expect(claude).toContain('"ko"')
    const codex = await agentInstructions('codex', project, 'ko', false)
    expect(codex).toContain('Use formal Korean.')
    expect(codex).not.toContain('Agents file.')
    expect(codex).not.toContain('ieumoffice-editor')
  })
})

function fakeSession(): AgentSession & { sent: string[]; stopped: number } {
  return {
    provider: 'claude-code',
    sent: [],
    stopped: 0,
    async send(text) {
      this.sent.push(text)
    },
    answer: vi.fn(),
    setOpenDocuments: vi.fn(),
    stop() {
      this.stopped++
    },
  }
}

function manager(
  overrides: {
    statuses?: Record<string, AiSubscriptionStatus>
    settings?: Partial<AiSettings>
  } = {},
) {
  const home = temp()
  const project = join(home, 'Project')
  mkdirSync(project)
  const session = fakeSession()
  const claude = vi.fn(
    async (_options: AgentSessionOptions, _onEvent: (e: AgentSessionEvent) => void) => session,
  )
  const codex = vi.fn(async (_options: AgentSessionOptions & { meteredAccepted: boolean }) => ({
    ...session,
    provider: 'codex' as const,
  }))
  const emitted: Array<[number, string, AgentSessionEvent]> = []
  const mcpStop = vi.fn(async () => undefined)
  const m = createAgentManager({
    runners: { claude, codex },
    statuses: () =>
      overrides.statuses ?? { 'claude-code': ready('claude-code'), codex: ready('codex') },
    aiSettings: () => ({ ...normalizeAiSettings({ providers: {} }), ...overrides.settings }),
    openDocuments: () => [join(project, 'open.docx')],
    userData: join(home, 'AppData', 'IeumOffice'),
    homeDir: home,
    language: () => 'ko',
    startAppMcp: async () => ({ url: 'http://127.0.0.1:5/mcp', token: 't', stop: mcpStop }),
    buildSkills: async () => join(home, 'skills'),
    emit: (owner, id, event) => emitted.push([owner, id, event]),
  })
  return { m, project, home, session, claude, codex, emitted, mcpStop }
}

describe('starting a session', () => {
  it('starts Claude in the project with skills, the app MCP server and the protected folders', async () => {
    const { m, project, home, claude } = manager()
    const result = await m.start(1, {
      provider: 'claude-code',
      projectRoot: project,
      mode: 'ask-commands',
    })
    expect(result.ok).toBe(true)
    const options = claude.mock.calls[0]![0]
    expect(options).toMatchObject({
      projectRoot: project,
      mode: 'ask-commands',
      skillBundleDir: join(home, 'skills'),
      appMcp: { url: 'http://127.0.0.1:5/mcp', token: 't' },
      openDocuments: [join(project, 'open.docx')],
    })
    expect(options.protectedPaths).toContain(join(home, '.codex'))
    expect(options.protectedPaths).toContain(join(home, 'AppData', 'IeumOffice'))
  })

  it('gives Codex no skill copy, and passes on a metered login the person accepted', async () => {
    const { m, project, codex } = manager({
      statuses: {
        codex: {
          provider: 'codex',
          state: 'metered',
          meteredAccepted: true,
        } as AiSubscriptionStatus,
      },
      settings: { meteredAccepted: { codex: true } },
    })
    await m.start(1, { provider: 'codex', projectRoot: project, mode: 'trust-project' })
    expect(codex.mock.calls[0]![0]).toMatchObject({
      meteredAccepted: true,
      skillBundleDir: undefined,
    })
  })

  it('refuses a program that is not connected, and a metered login only half accepted', async () => {
    const signedOut = manager({ statuses: {} })
    expect(
      await signedOut.m.start(1, {
        provider: 'claude-code',
        projectRoot: signedOut.project,
        mode: 'ask-commands',
      }),
    ).toEqual({ ok: false, reason: 'not-connected' })
    const half = manager({
      statuses: {
        codex: {
          provider: 'codex',
          state: 'metered',
          meteredAccepted: true,
        } as AiSubscriptionStatus,
      },
      settings: { meteredAccepted: {} },
    })
    expect(
      await half.m.start(1, { provider: 'codex', projectRoot: half.project, mode: 'ask-commands' }),
    ).toEqual({
      ok: false,
      reason: 'not-connected',
    })
    expect(half.codex).not.toHaveBeenCalled()
  })

  it('refuses a folder that cannot be a project before anything starts', async () => {
    const { m, home, claude } = manager()
    expect(
      await m.start(1, { provider: 'claude-code', projectRoot: home, mode: 'ask-commands' }),
    ).toEqual({
      ok: false,
      reason: 'bad-folder',
    })
    expect(claude).not.toHaveBeenCalled()
  })

  it('reports a runner that fails and cleans up after it', async () => {
    const { m, project, claude, mcpStop } = manager()
    claude.mockRejectedValueOnce(Object.assign(new Error('nope'), { kind: 'unsafe-tools' }))
    const result = await m.start(1, {
      provider: 'claude-code',
      projectRoot: project,
      mode: 'ask-commands',
    })
    expect(result).toMatchObject({ ok: false, reason: 'start-failed', kind: 'unsafe-tools' })
    expect(mcpStop).toHaveBeenCalled()
  })
})

describe('driving a session', () => {
  it('lets only its window send, answer and stop', async () => {
    const { m, project, session } = manager()
    const result = await m.start(1, {
      provider: 'claude-code',
      projectRoot: project,
      mode: 'ask-commands',
    })
    if (!result.ok) throw new Error('did not start')
    await expect(m.send(2, result.sessionId, 'hi')).rejects.toThrow()
    m.stop(2, result.sessionId)
    expect(session.stopped).toBe(0)
    await m.send(1, result.sessionId, 'hi')
    expect(session.sent).toEqual(['hi'])
    expect(session.setOpenDocuments).toHaveBeenCalled()
  })

  it('forwards events to its window and cleans up when the session ends', async () => {
    const { m, project, claude, emitted, mcpStop } = manager()
    const result = await m.start(7, {
      provider: 'claude-code',
      projectRoot: project,
      mode: 'ask-commands',
    })
    if (!result.ok) throw new Error('did not start')
    const onEvent = claude.mock.calls[0]![1]
    onEvent({ type: 'text', text: 'hello' })
    onEvent({ type: 'ended' })
    expect(emitted.map(([owner, , event]) => [owner, event.type])).toEqual([
      [7, 'text'],
      [7, 'ended'],
    ])
    expect(mcpStop).toHaveBeenCalled()
    expect(m.projectRootOf(7, result.sessionId)).toBeUndefined()
  })

  it('ends a window’s sessions when the window goes', async () => {
    const { m, project, session } = manager()
    await m.start(3, { provider: 'claude-code', projectRoot: project, mode: 'ask-commands' })
    m.stopOwner(3)
    expect(session.stopped).toBe(1)
  })
})

describe('what the window is shown', () => {
  it('drops error messages and the provider of a request', () => {
    expect(
      agentEventView({ type: 'error', kind: 'rate-limit', message: 'C:\\Users\\me secret' }),
    ).toEqual({
      type: 'error',
      kind: 'rate-limit',
    })
    expect(
      agentEventView({
        type: 'permission',
        request: {
          id: 'r',
          provider: 'codex',
          kind: 'command',
          tool: 'x',
          command: 'dir',
          paths: [],
        },
      }),
    ).toEqual({
      type: 'permission',
      id: 'r',
      action: { kind: 'command', tool: 'x', command: 'dir', paths: [] },
    })
    expect(
      agentEventView({ type: 'started', provider: 'claude-code', skills: ['a', 'b'] }),
    ).toMatchObject({ skills: 2 })
  })

  it('offers a program only when it is ready or a metered login is fully accepted', () => {
    const metered = {
      provider: 'claude-code',
      state: 'metered',
      meteredAccepted: true,
    } as AiSubscriptionStatus
    expect(
      agentConnections({ 'claude-code': metered }, { 'claude-code': false })['claude-code'],
    ).toBe('unavailable')
    expect(
      agentConnections({ 'claude-code': metered }, { 'claude-code': true })['claude-code'],
    ).toBe('metered-accepted')
    expect(agentConnections({ 'claude-code': ready('claude-code') }, {})['claude-code']).toBe(
      'ready',
    )
    expect(agentConnections({}, {})['claude-code']).toBe('checking')
  })

  it('offers Codex now that its sessions are contained, and blocks a program on the block list', () => {
    expect(agentConnections({ codex: ready('codex') }, {}).codex).toBe('ready')
    expect(agentConnections({ codex: ready('codex') }, {}, ['codex']).codex).toBe('blocked')
    expect(agentConnections({}, {}, ['codex']).codex).toBe('blocked')
  })
})

describe('preferences', () => {
  it('reads unknown values as defaults and keeps the recent list short and unique', () => {
    expect(
      normalizeAgentPrefs({
        provider: 'gpt',
        mode: 'yolo',
        recentFolders: ['a', 'a', 3],
        warningAccepted: 1.5,
      }),
    ).toEqual({
      provider: 'claude-code',
      mode: 'ask-commands',
      recentFolders: ['a'],
      warningAccepted: 0,
    })
    let prefs = normalizeAgentPrefs({})
    for (let i = 0; i < AGENT_RECENT_LIMIT + 3; i++) prefs = withRecentFolder(prefs, `C:\\p${i}`)
    prefs = withRecentFolder(prefs, 'c:\\P5')
    expect(prefs.recentFolders).toHaveLength(AGENT_RECENT_LIMIT)
    expect(prefs.recentFolders[0]).toBe('c:\\P5')
    expect(prefs.recentFolders.filter((f) => f.toLowerCase() === 'c:\\p5')).toHaveLength(1)
  })
})

describe('the window log', () => {
  it('replaces a running tool line with its outcome and drops answered requests', () => {
    const action = { kind: 'command' as const, tool: 'Bash', command: 'dir', paths: [] }
    let log = agentLogAfterSend(EMPTY_AGENT_LOG, 'go')
    log = agentLogWith(log, { type: 'tool', action, status: 'running' })
    log = agentLogWith(log, { type: 'permission', id: 'p1', action })
    log = agentLogAfterAnswer(log, 'p1')
    log = agentLogWith(log, { type: 'tool', action, status: 'done' })
    log = agentLogWith(log, { type: 'turn-done', ok: true })
    expect(log.entries).toEqual([
      { kind: 'you', text: 'go' },
      { kind: 'tool', action, status: 'done' },
    ])
    expect(log.pending).toEqual([])
    expect(log.busy).toBe(false)
  })

  it('marks a failed turn and the end', () => {
    let log = agentLogWith(EMPTY_AGENT_LOG, { type: 'turn-done', ok: false })
    log = agentLogWith(log, { type: 'ended' })
    expect(log.entries.map((entry) => entry.kind)).toEqual(['turn-failed', 'ended'])
    expect(log.ended).toBe(true)
  })
})
