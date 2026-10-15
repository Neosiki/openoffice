/**
 * The login a user starts from a card: on Windows the CLI's window stays hidden
 * and the sign-in happens in the browser the CLI opens; pressing again while it
 * runs opens the window, for a code the browser hands back. The statuses carry
 * which of the two is under way, so every card can say what to do.
 */
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAiSettings } from '../src/providers'
import {
  createSubscriptionIpcDeps,
  launchSubscriptionLogin,
  subscriptionStatusMapOf,
  type SubscriptionIpcDeps,
  type SubscriptionProgram,
  type SubscriptionStatusMap,
} from '../src/subscription'
import type { AiSubscriptionProviderId } from '../src/types'

class FakeChild extends EventEmitter {
  constructor(readonly pid: number) {
    super()
  }
  kill(): boolean {
    return true
  }
  unref(): void {}
}

const WINDOWS = { SystemRoot: 'C:\\Windows' }

function program(provider: AiSubscriptionProviderId): SubscriptionProgram {
  const command = provider === 'codex' ? 'C:\\npm\\codex.exe' : 'C:\\npm\\claude.exe'
  return { provider, command, prefixArgs: [], env: {}, entry: command, source: 'npm' }
}

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'login-window-'))
})
afterEach(async () => {
  vi.useRealTimers()
  await rm(dir, { recursive: true, force: true })
})

function app(platform: NodeJS.Platform = 'win32'): {
  deps: SubscriptionIpcDeps
  scripts: string[]
  children: FakeChild[]
  ended: FakeChild[]
  broadcasts: SubscriptionStatusMap[]
  checks: () => number
} {
  const scripts: string[] = []
  const children: FakeChild[] = []
  const ended: FakeChild[] = []
  const broadcasts: SubscriptionStatusMap[] = []
  let checks = 0
  const deps = createSubscriptionIpcDeps({
    getSettings: () => defaultAiSettings(),
    setMeteredAccepted: () => undefined,
    dataDir: dir,
    detect: async (provider) => {
      checks++
      return { provider, state: 'signed-out' }
    },
    listModels: async () => undefined,
    locate: async (provider) => program(provider),
    spawn: ((_command: string, args: string[]) => {
      scripts.push(args.at(-1) ?? '')
      const child = new FakeChild(1000 + children.length)
      children.push(child)
      return child
    }) as never,
    platform,
    killTree: (child) => {
      ended.push(child as FakeChild)
      ;(child as FakeChild).emit('exit', 1, null)
    },
    hiddenLoginTimeoutMs: 1000,
  })
  deps.service.onChange((statuses) => broadcasts.push(statuses))
  return { deps, scripts, children, ended, broadcasts, checks: () => checks }
}

describe('the login started from a card', () => {
  it('first signs in in the browser, with the CLI window hidden', async () => {
    const running = app()
    expect(await running.deps.launchLogin('claude-code')).toEqual({ ok: true })
    expect(running.scripts).toHaveLength(1)
    expect(running.scripts[0]).toContain('-WindowStyle Hidden')
    expect(running.deps.service.getStatuses()['claude-code'].signingIn).toBe('browser')
    expect(running.deps.service.getStatuses().codex.signingIn).toBeUndefined()
    expect(running.broadcasts.at(-1)!['claude-code'].signingIn).toBe('browser')
  })

  it('pressed again, ends the hidden login and opens the window for a code', async () => {
    const running = app()
    await running.deps.launchLogin('claude-code')
    await running.deps.launchLogin('claude-code')
    expect(running.ended).toEqual([running.children[0]])
    expect(running.scripts).toHaveLength(2)
    expect(running.scripts[1]).toContain('-WindowStyle Normal')
    // the hidden login's end does not take the mark of the window that replaced it
    expect(running.deps.service.getStatuses()['claude-code'].signingIn).toBe('window')
  })

  it('pressed while the window is open, starts nothing more', async () => {
    const running = app()
    await running.deps.launchLogin('codex')
    await running.deps.launchLogin('codex')
    expect(await running.deps.launchLogin('codex')).toEqual({ ok: true })
    expect(running.scripts).toHaveLength(2)
  })

  it('once the login ends, clears the mark and looks at the provider again', async () => {
    const running = app()
    await running.deps.launchLogin('claude-code')
    const before = running.checks()
    running.children[0]!.emit('exit', 0, null)
    expect(running.deps.service.getStatuses()['claude-code'].signingIn).toBeUndefined()
    await vi.waitFor(() => expect(running.checks()).toBeGreaterThan(before))
    // the next press starts in the browser again
    await running.deps.launchLogin('claude-code')
    expect(running.scripts.at(-1)).toContain('-WindowStyle Hidden')
  })

  it('ends a browser sign-in nobody finishes', async () => {
    vi.useFakeTimers()
    const running = app()
    await running.deps.launchLogin('claude-code')
    vi.advanceTimersByTime(1000)
    expect(running.ended).toEqual([running.children[0]])
    expect(running.deps.service.getStatuses()['claude-code'].signingIn).toBeUndefined()
  })

  it('a window the user opened has no time limit', async () => {
    vi.useFakeTimers()
    const running = app()
    await running.deps.launchLogin('claude-code')
    await running.deps.launchLogin('claude-code')
    vi.advanceTimersByTime(60 * 60_000)
    expect(running.ended).toEqual([running.children[0]])
    expect(running.deps.service.getStatuses()['claude-code'].signingIn).toBe('window')
  })

  it('a login that could not start leaves no mark', async () => {
    const deps = createSubscriptionIpcDeps({
      getSettings: () => defaultAiSettings(),
      setMeteredAccepted: () => undefined,
      dataDir: dir,
      detect: async (provider) => ({ provider, state: 'not-installed' }),
      listModels: async () => undefined,
      locate: async () => null,
      platform: 'win32',
    })
    expect(await deps.launchLogin('codex')).toMatchObject({ ok: false, reason: 'not-installed' })
    expect(deps.service.getStatuses().codex.signingIn).toBeUndefined()
  })

  it('elsewhere there is no window to open: a second press changes nothing', async () => {
    const running = app('linux')
    await running.deps.launchLogin('codex')
    await running.deps.launchLogin('codex')
    expect(running.children).toHaveLength(1)
    expect(running.ended).toEqual([])
    expect(running.deps.service.getStatuses().codex.signingIn).toBe('browser')
  })
})

describe('the hidden login itself', () => {
  it('is the same constant script with only the window style changed', async () => {
    const scripts: string[] = []
    for (const window of ['hidden', 'visible'] as const) {
      await launchSubscriptionLogin('claude-code', {
        locate: async () => program('claude-code'),
        spawn: ((_command: string, args: string[]) => {
          scripts.push(args.at(-1) ?? '')
          return new FakeChild(7)
        }) as never,
        platform: 'win32',
        baseEnv: WINDOWS,
        registry: null,
        window,
      })
    }
    expect(scripts[0]).toContain('-WindowStyle Hidden')
    expect(scripts[1]).toContain('-WindowStyle Normal')
    expect(scripts[0]!.replace('Hidden', 'Normal')).toBe(scripts[1])
  })

  it('hands the caller a way to end it', async () => {
    const ended: unknown[] = []
    let stop: (() => void) | undefined
    const child = new FakeChild(8)
    await launchSubscriptionLogin('codex', {
      locate: async () => program('codex'),
      spawn: (() => child) as never,
      platform: 'win32',
      baseEnv: WINDOWS,
      registry: null,
      killTree: (tree) => void ended.push(tree),
      onStarted: (s) => (stop = s),
    })
    expect(ended).toEqual([])
    stop!()
    expect(ended).toEqual([child])
  })
})

describe('the mark as a window reads it', () => {
  it('passes the two known values and drops anything else', () => {
    const map = (signingIn: unknown) =>
      subscriptionStatusMapOf({
        'claude-code': { provider: 'claude-code', state: 'signed-out', signingIn },
      })['claude-code'].signingIn
    expect(map('browser')).toBe('browser')
    expect(map('window')).toBe('window')
    expect(map('yes')).toBeUndefined()
    expect(map(true)).toBeUndefined()
  })
})
