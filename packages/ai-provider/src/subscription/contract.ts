/**
 * What the renderers and the main side agree on for the subscription providers:
 * IPC channel names, the payloads that travel on them, and the few fixed values
 * the UI shows (install command, install page). Browser-safe: this file imports
 * types only, so preload and renderer bundles can use it as is.
 */
import type { AiSubscriptionProviderId, AiSubscriptionState, AiSubscriptionStatus } from '../types'

/** Request channels are invoked by the renderer; `changed` is sent from main to every window */
export const SUBSCRIPTION_IPC_CHANNELS = {
  /** () → SubscriptionStatusMap: the last known statuses, `checking` until a first check answered */
  statuses: 'ai:subscription-statuses',
  /** (SubscriptionRecheckRequest?) → SubscriptionStatusMap: look again, answer when done */
  recheck: 'ai:subscription-recheck',
  /** (SubscriptionProviderRequest) → SubscriptionLaunchResult: open the CLI's own login */
  login: 'ai:subscription-login',
  /** (SubscriptionProviderRequest) → SubscriptionLaunchResult: run the vendor install command */
  install: 'ai:subscription-install',
  /** (SubscriptionMeteredRequest) → SubscriptionMeteredResult: "use anyway" for a metered login */
  metered: 'ai:subscription-metered',
  /** () → boolean: whether this build can generate images through the Codex subscription */
  codexImage: 'ai:subscription-codex-image',
  /** event, payload SubscriptionStatusMap: the statuses changed */
  changed: 'ai:subscription-changed',
} as const

export type SubscriptionIpcChannel =
  (typeof SUBSCRIPTION_IPC_CHANNELS)[keyof typeof SUBSCRIPTION_IPC_CHANNELS]

/** Both providers, always present */
export type SubscriptionStatusMap = Record<AiSubscriptionProviderId, AiSubscriptionStatus>

export interface SubscriptionRecheckRequest {
  /** absent: both */
  providers?: AiSubscriptionProviderId[]
}

export interface SubscriptionProviderRequest {
  provider: AiSubscriptionProviderId
}

export interface SubscriptionMeteredRequest {
  provider: AiSubscriptionProviderId
  accepted: boolean
}

/**
 * Why a login or install could not be started. `not-installed`: no program to
 * sign in to. `unsupported`: no vendor command for this system. `invalid`: the
 * request did not name a subscription provider.
 */
export type SubscriptionLaunchFailure = 'not-installed' | 'unsupported' | 'failed' | 'invalid'

export interface SubscriptionLaunchResult {
  /** the window was opened; what the user does in it shows up in the next status check */
  ok: boolean
  reason?: SubscriptionLaunchFailure
  error?: string
  /** the vendor's install page, when installing by hand is the way forward */
  installUrl?: string
}

export interface SubscriptionMeteredResult {
  /** false when there is no metered login to accept */
  ok: boolean
  statuses: SubscriptionStatusMap
}

/** Request and response of every channel, for typed preload bridges */
export interface SubscriptionIpcContract {
  [SUBSCRIPTION_IPC_CHANNELS.statuses]: { request: void; response: SubscriptionStatusMap }
  [SUBSCRIPTION_IPC_CHANNELS.recheck]: {
    request: SubscriptionRecheckRequest | undefined
    response: SubscriptionStatusMap
  }
  [SUBSCRIPTION_IPC_CHANNELS.login]: {
    request: SubscriptionProviderRequest
    response: SubscriptionLaunchResult
  }
  [SUBSCRIPTION_IPC_CHANNELS.install]: {
    request: SubscriptionProviderRequest
    response: SubscriptionLaunchResult
  }
  [SUBSCRIPTION_IPC_CHANNELS.metered]: {
    request: SubscriptionMeteredRequest
    response: SubscriptionMeteredResult
  }
  [SUBSCRIPTION_IPC_CHANNELS.codexImage]: { request: void; response: boolean }
  [SUBSCRIPTION_IPC_CHANNELS.changed]: { request: never; response: SubscriptionStatusMap }
}

/**
 * The vendor's own install command, run as is in a terminal window. Shown next
 * to the install button so the user sees what will run.
 */
export const SUBSCRIPTION_INSTALL_COMMANDS = {
  'claude-code': 'irm https://claude.ai/install.ps1 | iex',
  codex: 'winget install OpenAI.Codex',
} as const satisfies Record<AiSubscriptionProviderId, string>

/** The vendor's install instructions, linked when the command cannot run or fails */
export const SUBSCRIPTION_INSTALL_URLS = {
  'claude-code': 'https://code.claude.com/docs/en/setup',
  codex: 'https://developers.openai.com/codex/cli',
} as const satisfies Record<AiSubscriptionProviderId, string>

/** The status of a provider nothing is known about yet */
export function checkingSubscriptionStatus(
  provider: AiSubscriptionProviderId,
): AiSubscriptionStatus {
  return { provider, state: 'checking', meteredAccepted: false }
}

/**
 * An `error` status starts its text with one of these, so the UI can show its
 * own translated sentence: the CLI must be updated, the check got no answer, or
 * it failed some other way. The rest of the text is an English detail.
 */
export type SubscriptionStatusErrorKind = 'needs-update' | 'timeout' | 'failed'

export function subscriptionStatusErrorText(
  kind: SubscriptionStatusErrorKind,
  detail: string,
): string {
  return `${kind}: ${detail}`
}

/** Which kind of error an `error` status reports; null for every other state */
export function subscriptionStatusErrorKind(status: {
  state: AiSubscriptionState
  error?: string | undefined
}): SubscriptionStatusErrorKind | null {
  if (status.state !== 'error') return null
  const text = status.error ?? ''
  if (text.startsWith('needs-update:')) return 'needs-update'
  if (text.startsWith('timeout:')) return 'timeout'
  return 'failed'
}
