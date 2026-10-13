// Contract between the shell renderer (Settings) and the main process for the
// subscription providers (Claude, Codex). The request channels and payloads are
// the shared ones from @genoffice/ai-provider; the main-process handlers are
// registered once for the whole app by the docs main, never by the shell.

import {
  AI_SUBSCRIPTION_PROVIDERS,
  checkingSubscriptionStatus,
} from '@genoffice/ai-provider/browser'
import type {
  AiSubscriptionProviderId,
  AiSubscriptionState,
  AiSubscriptionStatus,
  SubscriptionLaunchFailure,
  SubscriptionLaunchResult,
  SubscriptionMeteredResult,
  SubscriptionStatusMap,
} from '@genoffice/ai-provider/browser'

/** exposed on `window.aiOfficeSubscription` by the shell preload */
export interface SubscriptionApi {
  /** the last known connection statuses (`checking` until a first check answered) */
  statuses(): Promise<SubscriptionStatusMap>
  /** look again (both providers when none is named) and answer when done */
  recheck(providers?: AiSubscriptionProviderId[]): Promise<SubscriptionStatusMap>
  /** open the program's own sign-in */
  login(provider: AiSubscriptionProviderId): Promise<SubscriptionLaunchResult>
  /** run the vendor's official install command in a visible terminal window */
  install(provider: AiSubscriptionProviderId): Promise<SubscriptionLaunchResult>
  /** "use anyway" for a metered login (or take that back) */
  setMeteredAccepted(
    provider: AiSubscriptionProviderId,
    accepted: boolean,
  ): Promise<SubscriptionMeteredResult>
  /** whether this build can generate images through the Codex subscription */
  codexImageAvailable(): Promise<boolean>
  /** the statuses changed (any window, any cause); returns an unsubscribe */
  onChanged(handler: (statuses: SubscriptionStatusMap) => void): () => void
  /** open the vendor's install instructions in the default browser */
  openInstallHelp(provider: AiSubscriptionProviderId): Promise<void>
}

/** Channels the shell main process itself answers (the shared ones are not listed here) */
export const SHELL_SUBSCRIPTION_CHANNELS = {
  /** (AiSubscriptionProviderId) → void: open the vendor's install page */
  openInstallHelp: 'home:open-subscription-install-help',
} as const

const STATES: readonly AiSubscriptionState[] = [
  'checking',
  'not-installed',
  'signed-out',
  'ready',
  'metered',
  'error',
]

const LAUNCH_FAILURES: readonly SubscriptionLaunchFailure[] = [
  'not-installed',
  'unsupported',
  'failed',
  'invalid',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Both providers `checking`: what is shown while nothing has answered */
export function checkingSubscriptionStatuses(): SubscriptionStatusMap {
  return {
    'claude-code': checkingSubscriptionStatus('claude-code'),
    codex: checkingSubscriptionStatus('codex'),
  }
}

export function isSubscriptionProviderId(value: unknown): value is AiSubscriptionProviderId {
  return (AI_SUBSCRIPTION_PROVIDERS as readonly unknown[]).includes(value)
}

/**
 * An IPC answer as a status map with both providers present. A provider whose
 * entry is missing or malformed reads as `checking`, so a renderer never has
 * to guard against a half-filled answer.
 */
export function subscriptionStatusMapOf(result: unknown): SubscriptionStatusMap {
  const raw = isRecord(result) ? result : {}
  const statusOf = (provider: AiSubscriptionProviderId): AiSubscriptionStatus => {
    const status = raw[provider]
    if (!isRecord(status) || !STATES.includes(status.state as AiSubscriptionState)) {
      return checkingSubscriptionStatus(provider)
    }
    return {
      ...(status as unknown as AiSubscriptionStatus),
      provider,
      meteredAccepted: status.meteredAccepted === true,
    }
  }
  return { 'claude-code': statusOf('claude-code'), codex: statusOf('codex') }
}

/**
 * An IPC answer as a launch result; anything unreadable is a plain failure.
 * The spawn error text is left behind: it can carry an executable path, and the
 * UI shows its own translated sentence instead.
 */
export function subscriptionLaunchResultOf(result: unknown): SubscriptionLaunchResult {
  const raw = isRecord(result) ? result : {}
  if (raw.ok === true) return { ok: true }
  const reason = LAUNCH_FAILURES.includes(raw.reason as SubscriptionLaunchFailure)
    ? (raw.reason as SubscriptionLaunchFailure)
    : 'failed'
  return {
    ok: false,
    reason,
    ...(typeof raw.installUrl === 'string' ? { installUrl: raw.installUrl } : {}),
  }
}
