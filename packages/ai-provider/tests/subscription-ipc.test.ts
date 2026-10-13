/**
 * The one IPC contract every editor shares for the subscription providers:
 * channel names and payloads importable from renderer code, and the main-side
 * helper that routes each channel.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as browser from '../src/browser'
import * as root from '../src/index'
import {
  SUBSCRIPTION_IPC_CHANNELS,
  checkingSubscriptionStatus,
  registerSubscriptionIpc,
  subscriptionStatusErrorKind,
  type SubscriptionIpcDeps,
  type SubscriptionLaunchResult,
  type SubscriptionMeteredResult,
  type SubscriptionStatusMap,
} from '../src/subscription'
import type { AiSubscriptionProviderId } from '../src/types'

type Handler = (event: unknown, ...args: unknown[]) => unknown

class FakeIpcMain {
  handlers = new Map<string, Handler>()
  handle(channel: string, handler: Handler): void {
    if (this.handlers.has(channel)) throw new Error(`second handler for ${channel}`)
    this.handlers.set(channel, handler)
  }
  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel)
    if (!handler) throw new Error(`no handler for ${channel}`)
    return Promise.resolve(handler({ sender: {} }, ...args))
  }
}

const READY: SubscriptionStatusMap = {
  'claude-code': {
    provider: 'claude-code',
    state: 'ready',
    version: '2.1.287',
    loginMethod: 'subscription',
    planName: 'max',
    meteredAccepted: false,
  },
  codex: { provider: 'codex', state: 'signed-out', version: '0.159.2', meteredAccepted: false },
}

function setup(): {
  ipc: FakeIpcMain
  log: string[]
  broadcasts: Array<[string, unknown]>
  deps: SubscriptionIpcDeps
  emitChange: (statuses: SubscriptionStatusMap) => void
} {
  const log: string[] = []
  const broadcasts: Array<[string, unknown]> = []
  const listeners = new Set<(statuses: SubscriptionStatusMap) => void>()
  const deps: SubscriptionIpcDeps = {
    service: {
      getStatuses: () => {
        log.push('getStatuses')
        return READY
      },
      check: async (providers) => {
        log.push(`check:${providers ? providers.join(',') : 'all'}`)
        return READY
      },
      setMeteredAccepted: async (provider, accepted): Promise<SubscriptionMeteredResult> => {
        log.push(`metered:${provider}:${accepted}`)
        return { ok: true, statuses: READY }
      },
      onChange: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    launchLogin: async (provider): Promise<SubscriptionLaunchResult> => {
      log.push(`login:${provider}`)
      return { ok: true }
    },
    launchInstall: async (provider): Promise<SubscriptionLaunchResult> => {
      log.push(`install:${provider}`)
      return { ok: true }
    },
    broadcast: (channel, payload) => broadcasts.push([channel, payload]),
  }
  return {
    ipc: new FakeIpcMain(),
    log,
    broadcasts,
    deps,
    emitChange: (statuses) => {
      for (const listener of listeners) listener(statuses)
    },
  }
}

describe('the channel names', () => {
  it('are one set of distinct names under ai:subscription', () => {
    expect(SUBSCRIPTION_IPC_CHANNELS).toEqual({
      statuses: 'ai:subscription-statuses',
      recheck: 'ai:subscription-recheck',
      login: 'ai:subscription-login',
      install: 'ai:subscription-install',
      metered: 'ai:subscription-metered',
      changed: 'ai:subscription-changed',
    })
    const names = Object.values(SUBSCRIPTION_IPC_CHANNELS)
    expect(new Set(names).size).toBe(names.length)
  })

  it('come from a file a renderer bundle can import: no Node, no Electron', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/subscription/contract.ts', import.meta.url)),
      'utf8',
    )
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])
    expect(imports.length).toBeGreaterThan(0)
    for (const specifier of imports) {
      expect(specifier.startsWith('node:')).toBe(false)
      expect(specifier).not.toBe('electron')
      expect(specifier).toMatch(/^\.\.?\//)
    }
    expect(source).not.toMatch(/\bprocess\.|\brequire\(/)
  })

  it('are exported from the browser entry and the root entry alike', () => {
    for (const name of [
      'SUBSCRIPTION_IPC_CHANNELS',
      'SUBSCRIPTION_INSTALL_COMMANDS',
      'SUBSCRIPTION_INSTALL_URLS',
      'checkingSubscriptionStatus',
      'subscriptionStatusErrorKind',
    ] as const) {
      expect(browser[name]).toBeDefined()
      expect(browser[name]).toBe(root[name])
    }
    expect(browser.SUBSCRIPTION_IPC_CHANNELS).toBe(SUBSCRIPTION_IPC_CHANNELS)
  })

  it('the browser entry does not pull in the Node side of the module', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/browser.ts', import.meta.url)),
      'utf8',
    )
    const subscriptionImports = [...source.matchAll(/from\s+'(\.\/subscription[^']*)'/g)].map(
      (match) => match[1],
    )
    expect([...new Set(subscriptionImports)]).toEqual(['./subscription/contract'])
  })
})

describe('the contract helpers', () => {
  it('checkingSubscriptionStatus is the status before any answer', () => {
    expect(checkingSubscriptionStatus('codex')).toEqual({
      provider: 'codex',
      state: 'checking',
      meteredAccepted: false,
    })
  })

  it('subscriptionStatusErrorKind tells the UI which error text to show', () => {
    const error = (text?: string) => ({ state: 'error' as const, error: text })
    expect(subscriptionStatusErrorKind(error('needs-update: Claude Code 1.0.0 is too old'))).toBe(
      'needs-update',
    )
    expect(subscriptionStatusErrorKind(error('timeout: no answer within 20 s'))).toBe('timeout')
    expect(subscriptionStatusErrorKind(error('failed: spawn EACCES'))).toBe('failed')
    expect(subscriptionStatusErrorKind(error())).toBe('failed')
    expect(subscriptionStatusErrorKind({ state: 'ready' })).toBeNull()
  })
})

describe('registerSubscriptionIpc', () => {
  it('registers a handler for each request channel and none for the event channel', () => {
    const { ipc, deps } = setup()
    registerSubscriptionIpc(ipc, deps)
    expect([...ipc.handlers.keys()].sort()).toEqual(
      [
        SUBSCRIPTION_IPC_CHANNELS.statuses,
        SUBSCRIPTION_IPC_CHANNELS.recheck,
        SUBSCRIPTION_IPC_CHANNELS.login,
        SUBSCRIPTION_IPC_CHANNELS.install,
        SUBSCRIPTION_IPC_CHANNELS.metered,
      ].sort(),
    )
  })

  it('routes get-statuses to the cached statuses', async () => {
    const { ipc, deps, log } = setup()
    registerSubscriptionIpc(ipc, deps)
    expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.statuses)).toEqual(READY)
    expect(log).toEqual(['getStatuses'])
  })

  it('a window that asks before anything was checked gets "checking" and starts the first check', async () => {
    const { ipc, deps, log } = setup()
    const unchecked: SubscriptionStatusMap = {
      'claude-code': checkingSubscriptionStatus('claude-code'),
      codex: READY.codex,
    }
    deps.service.getStatuses = () => unchecked
    registerSubscriptionIpc(ipc, deps)
    expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.statuses)).toEqual(unchecked)
    expect(log).toEqual(['check:all'])
  })

  it('routes re-check to a fresh check, for all providers or the ones named', async () => {
    const { ipc, deps, log } = setup()
    registerSubscriptionIpc(ipc, deps)
    expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.recheck)).toEqual(READY)
    await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.recheck, { providers: ['codex'] })
    await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.recheck, { providers: ['codex', 'gpt', 7] })
    await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.recheck, { providers: 'codex' })
    expect(log).toEqual(['check:all', 'check:codex', 'check:codex', 'check:all'])
  })

  it('routes launch-login and launch-install to their launchers', async () => {
    const { ipc, deps, log } = setup()
    registerSubscriptionIpc(ipc, deps)
    expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.login, { provider: 'claude-code' })).toEqual({
      ok: true,
    })
    expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.install, { provider: 'codex' })).toEqual({
      ok: true,
    })
    expect(log).toEqual(['login:claude-code', 'install:codex'])
  })

  it('routes set-metered-acceptance to the service', async () => {
    const { ipc, deps, log } = setup()
    registerSubscriptionIpc(ipc, deps)
    const result = await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.metered, {
      provider: 'codex',
      accepted: true,
    })
    expect(result).toEqual({ ok: true, statuses: READY })
    expect(log).toEqual(['metered:codex:true'])
  })

  it('rejects payloads a renderer should not be able to send', async () => {
    const { ipc, deps, log } = setup()
    registerSubscriptionIpc(ipc, deps)
    const bad: unknown[] = [
      undefined,
      null,
      'codex',
      {},
      { provider: 'anthropic' },
      { provider: 'codex; calc.exe' },
      { provider: ['codex'] },
    ]
    for (const payload of bad) {
      expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.login, payload)).toMatchObject({
        ok: false,
        reason: 'invalid',
      })
      expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.install, payload)).toMatchObject({
        ok: false,
        reason: 'invalid',
      })
      expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.metered, payload)).toMatchObject({
        ok: false,
      })
    }
    // acceptance needs a real boolean: a truthy string is not consent
    expect(
      await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.metered, { provider: 'codex', accepted: 'true' }),
    ).toMatchObject({ ok: false, statuses: READY })
    expect(log.filter((entry) => !entry.startsWith('getStatuses'))).toEqual([])
  })

  it('a launcher that throws becomes a failed result, not a rejected call', async () => {
    const { ipc, deps } = setup()
    deps.launchLogin = async () => {
      throw new Error('boom')
    }
    registerSubscriptionIpc(ipc, deps)
    expect(await ipc.invoke(SUBSCRIPTION_IPC_CHANNELS.login, { provider: 'codex' })).toMatchObject({
      ok: false,
      reason: 'failed',
    })
  })

  it('announces status changes on the event channel', () => {
    const { ipc, deps, broadcasts, emitChange } = setup()
    registerSubscriptionIpc(ipc, deps)
    emitChange(READY)
    expect(broadcasts).toEqual([[SUBSCRIPTION_IPC_CHANNELS.changed, READY]])
  })

  it('unregisters everything it registered', () => {
    const { ipc, deps, broadcasts, emitChange } = setup()
    const unregister = registerSubscriptionIpc(ipc, deps)
    unregister()
    expect(ipc.handlers.size).toBe(0)
    emitChange(READY)
    expect(broadcasts).toEqual([])
  })

  it('the provider ids in the payload types are the subscription ids', () => {
    const providers: AiSubscriptionProviderId[] = ['claude-code', 'codex']
    expect(Object.keys(READY).sort()).toEqual(providers.sort())
  })
})
