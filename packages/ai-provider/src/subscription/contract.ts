/**
 * What the renderers and the main side agree on for the subscription providers:
 * IPC channel names, the payloads that travel on them, and the few fixed values
 * the UI shows (install command, install page). Browser-safe: this file imports
 * types only, so preload and renderer bundles can use it as is.
 */
import type {
  AiSubscriptionModel,
  AiSubscriptionProviderId,
  AiSubscriptionState,
  AiSubscriptionStatus,
} from '../types'

/** Request channels are invoked by the renderer; `changed` is sent from main to every window */
export const SUBSCRIPTION_IPC_CHANNELS = {
  /** () → SubscriptionStatusMap: the last known statuses, `checking` until a first check answered */
  statuses: 'ai:subscription-statuses',
  /** (SubscriptionRecheckRequest?) → SubscriptionStatusMap: look again, answer when done */
  recheck: 'ai:subscription-recheck',
  /** (SubscriptionProviderRequest) → SubscriptionLaunchResult: open the CLI's own login */
  login: 'ai:subscription-login',
  /** (SubscriptionProviderRequest) → SubscriptionLaunchResult: run the CLI's own logout, then look again */
  logout: 'ai:subscription-logout',
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
 * Why a login, logout or install could not be started (a logout: or did not
 * succeed). `not-installed`: no program to sign in to. `unsupported`: no vendor
 * command for this system. `invalid`: the request did not name a subscription
 * provider.
 */
export type SubscriptionLaunchFailure = 'not-installed' | 'unsupported' | 'failed' | 'invalid'

export interface SubscriptionLaunchResult {
  /**
   * the window was opened (what the user does in it shows up in the next status
   * check), or the logout command ran to its end
   */
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
  [SUBSCRIPTION_IPC_CHANNELS.logout]: {
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

// ---------------------------------------------------------------------------
// Reading IPC answers. A renderer cannot trust what comes back over IPC (no
// handler registered yet, an older main, a half-filled object), so every answer
// goes through these before it reaches the UI.
// ---------------------------------------------------------------------------

/** Listed here (not imported) so this file keeps importing types only */
const SUBSCRIPTION_PROVIDER_IDS: readonly AiSubscriptionProviderId[] = ['claude-code', 'codex']

const SUBSCRIPTION_STATES: readonly AiSubscriptionState[] = [
  'checking',
  'not-installed',
  'signed-out',
  'ready',
  'metered',
  'error',
]

const SUBSCRIPTION_LAUNCH_FAILURES: readonly SubscriptionLaunchFailure[] = [
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
  return (SUBSCRIPTION_PROVIDER_IDS as readonly unknown[]).includes(value)
}

// ---------------------------------------------------------------------------
// The two display values a status carries from a CLI's own answer: who is
// signed in, and which models there are. Both are checked here, where the
// status is built and again where a renderer reads it: a value of any other
// shape is absent, never passed on as it came.
// ---------------------------------------------------------------------------

/** An e-mail address is at most this long; a longer value is not one */
export const SUBSCRIPTION_ACCOUNT_MAX_LENGTH = 254

/** One address and nothing around it: no display name, no brackets, no second line */
const ACCOUNT_PATTERN = /^[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63})+$/u

/**
 * The account a CLI names, when it is an e-mail address. Anything else (free
 * text, an organisation name, a value of another type) is absent.
 */
export function subscriptionAccountOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const account = value.trim()
  return account.length <= SUBSCRIPTION_ACCOUNT_MAX_LENGTH && ACCOUNT_PATTERN.test(account)
    ? account
    : undefined
}

/** Most models a status lists; what a CLI lists beyond that is left out */
export const SUBSCRIPTION_MODELS_MAX = 50

const SUBSCRIPTION_MODEL_LABEL_MAX = 80

/**
 * A model alias or id as the CLIs take it. The stored selection is handed to
 * the CLI, so a listed id is held to the shape the bridges accept: nothing
 * that could read as an option.
 */
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,127}$/

function modelIdOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  return MODEL_ID_PATTERN.test(id) ? id : undefined
}

/** A display name on one line, without control characters, of bounded length */
function modelLabelOf(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\p{Cc}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SUBSCRIPTION_MODEL_LABEL_MAX)
}

/**
 * A model list as a status carries it: the listed fields only, ids the CLI
 * could be given, names trimmed and bounded, one entry per id, at most
 * `SUBSCRIPTION_MODELS_MAX` entries. The entry with an empty id stands for the
 * CLI's own default and is kept only when it tells what that resolves to.
 * Absent when nothing usable is left.
 */
export function subscriptionModelsOf(value: unknown): AiSubscriptionModel[] | undefined {
  if (!Array.isArray(value)) return undefined
  const models: AiSubscriptionModel[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (models.length >= SUBSCRIPTION_MODELS_MAX) break
    if (!isRecord(entry)) continue
    const isDefaultEntry = entry.id === ''
    const id = isDefaultEntry ? '' : modelIdOf(entry.id)
    if (id === undefined || seen.has(id)) continue
    const resolved = modelIdOf(entry.resolved)
    if (isDefaultEntry && !resolved) continue
    seen.add(id)
    models.push({
      id,
      label: modelLabelOf(entry.label) || id || (resolved as string),
      ...(resolved ? { resolved } : {}),
      ...(isDefaultEntry || entry.isDefault === true ? { isDefault: true } : {}),
    })
  }
  return models.length > 0 ? models : undefined
}

/**
 * An IPC answer as a status map with both providers present. A provider whose
 * entry is missing or malformed reads as `checking`, so a renderer never has
 * to guard against a half-filled answer. The account and the model list pass
 * only when they have their shape, and only on a state that names a login.
 */
export function subscriptionStatusMapOf(result: unknown): SubscriptionStatusMap {
  const raw = isRecord(result) ? result : {}
  const statusOf = (provider: AiSubscriptionProviderId): AiSubscriptionStatus => {
    const status = raw[provider]
    if (!isRecord(status) || !SUBSCRIPTION_STATES.includes(status.state as AiSubscriptionState)) {
      return checkingSubscriptionStatus(provider)
    }
    const read: AiSubscriptionStatus = {
      ...(status as unknown as AiSubscriptionStatus),
      provider,
      meteredAccepted: status.meteredAccepted === true,
    }
    const signedIn = read.state === 'ready' || read.state === 'metered'
    const account = signedIn ? subscriptionAccountOf(status.account) : undefined
    const models = signedIn ? subscriptionModelsOf(status.models) : undefined
    delete read.account
    delete read.models
    if (account) read.account = account
    if (models) read.models = models
    return read
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
  const reason = SUBSCRIPTION_LAUNCH_FAILURES.includes(raw.reason as SubscriptionLaunchFailure)
    ? (raw.reason as SubscriptionLaunchFailure)
    : 'failed'
  return {
    ok: false,
    reason,
    ...(typeof raw.installUrl === 'string' ? { installUrl: raw.installUrl } : {}),
  }
}

/** An IPC answer to "use anyway": accepted only on a literal `true`, the statuses always a full map */
export function subscriptionMeteredResultOf(result: unknown): SubscriptionMeteredResult {
  const raw = isRecord(result) ? result : {}
  return { ok: raw.ok === true, statuses: subscriptionStatusMapOf(raw.statuses) }
}
