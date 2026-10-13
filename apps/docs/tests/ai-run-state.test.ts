// What the AI panel decides from the subscription contract: when the first
// connection notice is due, how a failed run is shown, what "continue with ..."
// stores, and which usage reports are kept.
import { describe, expect, it } from 'vitest'
import {
  selectAiProvider,
  type AiSubscriptionState,
  type AiSubscriptionStatus,
  type AiSubscriptionStatuses,
} from '@genoffice/ai-provider/browser'
import { AI_PROVIDERS, type AiSettings } from '../src/shared/ipc'
import {
  firstConnectionNoticeDue,
  mergeSubscriptionUsage,
  runErrorCauseOf,
  runErrorView,
  settingsContinuingWith,
  shouldRecheckAfter,
} from '../src/renderer/ai/run-state'
import { subscriptionLaunchResultOf, subscriptionStatusMapOf } from '../src/shared/subscription-api'

function settings(patch: Partial<AiSettings> = {}): AiSettings {
  return {
    provider: 'auto',
    providers: Object.fromEntries(
      AI_PROVIDERS.map((p) => [p.id, { apiKey: '', model: p.defaultModel }]),
    ) as AiSettings['providers'],
    ...patch,
  }
}

function status(
  provider: 'claude-code' | 'codex',
  state: AiSubscriptionState,
  meteredAccepted = false,
): AiSubscriptionStatus {
  return { provider, state, meteredAccepted }
}

const CLAUDE_READY: AiSubscriptionStatuses = { 'claude-code': status('claude-code', 'ready') }
const CODEX_READY: AiSubscriptionStatuses = { codex: status('codex', 'ready') }

describe('runErrorCauseOf', () => {
  it('takes the cause of the failure the transport just reported', () => {
    expect(
      runErrorCauseOf(
        { kind: 'rate-limit', provider: 'codex', resetsAt: 99, message: 'limit' },
        'limit',
      ),
    ).toEqual({ kind: 'rate-limit', provider: 'codex', resetsAt: 99 })
  })

  it('has no cause for a failure without a kind or with another text', () => {
    expect(runErrorCauseOf({ message: 'HTTP 500' }, 'HTTP 500')).toBeUndefined()
    expect(runErrorCauseOf({ kind: 'signed-out', message: 'old' }, 'new')).toBeUndefined()
    expect(runErrorCauseOf(null, 'anything')).toBeUndefined()
  })
})

describe('runErrorView', () => {
  const connected = selectAiProvider(settings(), CLAUDE_READY)
  const notConnected = selectAiProvider(settings(), {})

  it('keeps the plain error line for a failure without a blocking cause', () => {
    const plain = { blockedNotice: false, connectPrompt: false, errorLine: true }
    expect(runErrorView(undefined, true, connected, settings(), CLAUDE_READY)).toEqual(plain)
    expect(runErrorView({ kind: 'network' }, true, connected, settings(), CLAUDE_READY)).toEqual(
      plain,
    )
    expect(runErrorView({ kind: 'timeout' }, true, notConnected, settings(), {})).toEqual(plain)
  })

  it('shows only the connect prompt when nothing at all can run', () => {
    expect(runErrorView({ kind: 'not-connected' }, true, notConnected, settings(), {})).toEqual({
      blockedNotice: false,
      connectPrompt: true,
      errorLine: false,
    })
  })

  it('shows the reason of a used-up limit, without connect cards while connected', () => {
    expect(
      runErrorView(
        { kind: 'rate-limit', provider: 'claude-code' },
        true,
        connected,
        settings(),
        CLAUDE_READY,
      ),
    ).toEqual({ blockedNotice: true, connectPrompt: false, errorLine: false })
  })

  it('shows both the reason and the connect card of a selected provider that stopped working', () => {
    const picked = settings({ provider: 'claude-code' })
    const statuses = { 'claude-code': status('claude-code', 'signed-out'), ...CODEX_READY }
    expect(
      runErrorView(
        { kind: 'signed-out', provider: 'claude-code' },
        true,
        selectAiProvider(picked, statuses),
        picked,
        statuses,
      ),
    ).toEqual({ blockedNotice: true, connectPrompt: true, errorLine: false })
  })

  it('keeps the notice for not-connected when another subscription can continue', () => {
    const picked = settings({ provider: 'openai' })
    expect(
      runErrorView(
        { kind: 'not-connected' },
        true,
        selectAiProvider(picked, CODEX_READY),
        picked,
        CODEX_READY,
      ),
    ).toEqual({ blockedNotice: true, connectPrompt: true, errorLine: false })
  })

  it('leaves older replies as plain history', () => {
    expect(
      runErrorView({ kind: 'rate-limit', provider: 'codex' }, false, connected, settings(), {}),
    ).toEqual({ blockedNotice: false, connectPrompt: false, errorLine: true })
  })
})

describe('shouldRecheckAfter', () => {
  it('looks again after a connection refusal, not after a limit or a transient failure', () => {
    expect(shouldRecheckAfter({ kind: 'signed-out', provider: 'codex' })).toBe(true)
    expect(shouldRecheckAfter({ kind: 'not-connected' })).toBe(true)
    expect(shouldRecheckAfter({ kind: 'rate-limit', provider: 'codex' })).toBe(false)
    expect(shouldRecheckAfter({ kind: 'network' })).toBe(false)
    expect(shouldRecheckAfter(undefined)).toBe(false)
  })
})

describe('firstConnectionNoticeDue', () => {
  it('is due before the first run on a subscription', () => {
    expect(firstConnectionNoticeDue(settings(), CLAUDE_READY)).toBe(true)
    expect(firstConnectionNoticeDue(settings({ provider: 'codex' }), CODEX_READY)).toBe(true)
  })

  it('is not due once acknowledged', () => {
    expect(firstConnectionNoticeDue(settings({ subscriptionNoticeSeen: true }), CLAUDE_READY)).toBe(
      false,
    )
  })

  it('is not due while nothing is connected or a key provider is selected', () => {
    expect(firstConnectionNoticeDue(settings(), {})).toBe(false)
    const base = settings({ provider: 'openai' })
    const keyed = {
      ...base,
      providers: { ...base.providers, openai: { apiKey: 'sk-test', model: 'some-model' } },
    }
    expect(firstConnectionNoticeDue(keyed, CLAUDE_READY)).toBe(false)
  })
})

describe('settingsContinuingWith', () => {
  it('stores the provider as the selection and keeps its stored model', () => {
    const base = settings({ provider: 'claude-code' })
    const next = settingsContinuingWith(
      { ...base, providers: { ...base.providers, codex: { apiKey: '', model: 'gpt-5.1-codex' } } },
      'codex',
    )
    expect(next.provider).toBe('codex')
    expect(next.providers.codex.model).toBe('gpt-5.1-codex')
    // the choice now resolves to that provider: the model picker shows it
    expect(selectAiProvider(next, CODEX_READY)).toMatchObject({
      connected: true,
      provider: 'codex',
    })
  })
})

describe('mergeSubscriptionUsage', () => {
  it('keeps the newest report per provider and window', () => {
    const merged = mergeSubscriptionUsage(
      [
        { provider: 'claude-code', window: 'five_hour', utilization: 0.5, resetsAt: 1 },
        { provider: 'claude-code', window: 'seven_day', utilization: 0.2, resetsAt: 2 },
      ],
      [{ provider: 'claude-code', window: 'five_hour', utilization: 0.9, resetsAt: 3 }],
    )
    expect(merged).toHaveLength(2)
    expect(merged.find((u) => u.window === 'five_hour')).toMatchObject({
      utilization: 0.9,
      resetsAt: 3,
    })
    expect(merged.find((u) => u.window === 'seven_day')?.utilization).toBe(0.2)
  })
})

describe('subscription IPC answers', () => {
  it('reads a missing or malformed answer as still checking', () => {
    const checking = { provider: 'claude-code', state: 'checking', meteredAccepted: false }
    expect(subscriptionStatusMapOf(undefined)['claude-code']).toEqual(checking)
    expect(subscriptionStatusMapOf({ 'claude-code': { state: 'bogus' } })['claude-code']).toEqual(
      checking,
    )
    expect(subscriptionStatusMapOf({}).codex.state).toBe('checking')
  })

  it('keeps a well-formed status and never trusts a non-boolean acceptance', () => {
    const map = subscriptionStatusMapOf({
      codex: { provider: 'codex', state: 'metered', meteredAccepted: 'yes', planName: 'plus' },
    })
    expect(map.codex).toMatchObject({ state: 'metered', meteredAccepted: false, planName: 'plus' })
  })

  it('drops the spawn error text of a failed launch', () => {
    expect(subscriptionLaunchResultOf({ ok: true })).toEqual({ ok: true })
    expect(
      subscriptionLaunchResultOf({ ok: false, reason: 'not-installed', error: 'C:\\x\\codex.exe' }),
    ).toEqual({ ok: false, reason: 'not-installed' })
    expect(subscriptionLaunchResultOf(null)).toEqual({ ok: false, reason: 'failed' })
  })
})
