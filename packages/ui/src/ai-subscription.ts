/**
 * What the subscription-connection parts show, as plain data: which lines and
 * buttons a connection state gets, which other connection a blocked run may
 * continue on, which usage windows are worth a line, and the wording of a run
 * error. The components in this package only lay these results out, so the
 * rules are testable without a DOM and every editor reaches the same answer.
 */
import {
  AI_PROVIDERS,
  AI_SUBSCRIPTION_PROVIDERS,
  isSubscriptionProvider,
  subscriptionConnection,
  subscriptionStatusErrorKind,
  type AiProviderChoice,
  type AiProviderId,
  type AiRunErrorKind,
  type AiSettings,
  type AiSubscriptionProviderId,
  type AiSubscriptionState,
  type AiSubscriptionStatus,
  type AiSubscriptionStatuses,
  type AiSubscriptionUsage,
  type AiUsageWindow,
  type SubscriptionStatusErrorKind,
} from '@genoffice/ai-provider/browser'
import { htmlLang, type Lang } from '@genoffice/i18n'
import { aiSubscriptionText, type AiSubscriptionStringKey } from './strings-ai-subscription'

/** Subscription providers are named in plain text only: no vendor mark, no CLI product name */
const SUBSCRIPTION_NAMES: Record<AiSubscriptionProviderId, string> = {
  'claude-code': 'Claude',
  codex: 'Codex',
}

const SUBSCRIPTION_VENDORS: Record<AiSubscriptionProviderId, string> = {
  'claude-code': 'Anthropic',
  codex: 'OpenAI',
}

/** The vendor's own install instructions, opened when the install command cannot run */
export const AI_SUBSCRIPTION_INSTALL_HELP_URLS: Record<AiSubscriptionProviderId, string> = {
  'claude-code': 'https://code.claude.com/docs/en/setup',
  codex: 'https://developers.openai.com/codex/cli',
}

/** Usage at or above this share of a window is shown; below it the panel stays quiet */
export const AI_SUBSCRIPTION_USAGE_THRESHOLD = 0.8

/** "Claude" / "Codex" */
export function aiSubscriptionProviderName(provider: AiSubscriptionProviderId): string {
  return SUBSCRIPTION_NAMES[provider]
}

/** The company whose install command and sign-in page a subscription provider uses */
export function aiSubscriptionVendorName(provider: AiSubscriptionProviderId): string {
  return SUBSCRIPTION_VENDORS[provider]
}

/** A provider's name as shown in these parts; an absent or unknown id reads as plain "AI" */
export function aiProviderDisplayName(provider: AiProviderId | undefined): string {
  if (isSubscriptionProvider(provider)) return SUBSCRIPTION_NAMES[provider]
  return AI_PROVIDERS.find((m) => m.id === provider)?.label ?? 'AI'
}

// ---- connect card ----

export type AiSubscriptionCardAction =
  'install' | 'install-help' | 'login' | 'accept-metered' | 'recheck'

export type AiSubscriptionCardTone = 'neutral' | 'ok' | 'warning' | 'error'

export interface AiSubscriptionCardView {
  readonly provider: AiSubscriptionProviderId
  readonly state: AiSubscriptionState
  readonly tone: AiSubscriptionCardTone
  /** the one-line state: checking, not installed, connected … */
  readonly statusKey: AiSubscriptionStringKey
  /** plan name the CLI reported, on `ready` */
  readonly planName?: string | undefined
  /** explanatory lines under the state, in order */
  readonly noteKeys: readonly AiSubscriptionStringKey[]
  /**
   * what went wrong, on `error`: a sentence of ours chosen by the kind of
   * failure. The status's own text (English, possibly naming a path) is never shown.
   */
  readonly detailKey?: AiSubscriptionStringKey | undefined
  /** buttons and links, in order; the first one is the primary action */
  readonly actions: readonly AiSubscriptionCardAction[]
}

const STATUS_ERROR_KEYS: Record<SubscriptionStatusErrorKind, AiSubscriptionStringKey> = {
  'needs-update': 'cardErrNeedsUpdate',
  timeout: 'cardErrTimeout',
  failed: 'cardErrFailed',
}

/** The spec table of connection states: what one provider's card shows in each of the six */
export function aiSubscriptionCardView(status: AiSubscriptionStatus): AiSubscriptionCardView {
  const base = { provider: status.provider, state: status.state }
  switch (status.state) {
    case 'checking':
      return { ...base, tone: 'neutral', statusKey: 'cardChecking', noteKeys: [], actions: [] }
    case 'not-installed':
      return {
        ...base,
        tone: 'neutral',
        statusKey: 'cardNotInstalled',
        noteKeys: ['installNote'],
        actions: ['install', 'install-help'],
      }
    case 'signed-out':
      return {
        ...base,
        tone: 'neutral',
        statusKey: 'cardSignedOut',
        noteKeys: ['loginNote'],
        actions: ['login'],
      }
    case 'ready': {
      const planName = status.planName?.trim() || undefined
      return {
        ...base,
        tone: 'ok',
        statusKey: planName ? 'cardReadyPlan' : 'cardReady',
        planName,
        noteKeys: [],
        actions: [],
      }
    }
    case 'metered':
      // an accepted login keeps the cost warning in sight, without the choice
      return status.meteredAccepted
        ? {
            ...base,
            tone: 'warning',
            statusKey: 'cardMeteredAccepted',
            noteKeys: ['meteredWarning'],
            actions: [],
          }
        : {
            ...base,
            tone: 'warning',
            statusKey: 'cardMetered',
            noteKeys: ['meteredWarning', 'meteredMeaning'],
            actions: ['accept-metered'],
          }
    case 'error':
      return {
        ...base,
        tone: 'error',
        statusKey: 'cardError',
        noteKeys: [],
        detailKey: STATUS_ERROR_KEYS[subscriptionStatusErrorKind(status) ?? 'failed'],
        actions: ['recheck'],
      }
  }
}

/** A provider whose check has not reported yet reads as `checking` */
export function aiSubscriptionStatusOf(
  statuses: AiSubscriptionStatuses,
  provider: AiSubscriptionProviderId,
): AiSubscriptionStatus {
  return statuses[provider] ?? { provider, state: 'checking', meteredAccepted: false }
}

// ---- not-connected prompt ----

export interface AiConnectPromptView {
  readonly titleKey: AiSubscriptionStringKey
  readonly bodyKey?: AiSubscriptionStringKey | undefined
  /** `{provider}` for the title and body: the selected provider that cannot run */
  readonly providerName?: string | undefined
  /** connect cards to offer, in order */
  readonly providers: readonly AiSubscriptionProviderId[]
  /** a key provider is selected but not filled in: the way out is the settings page */
  readonly settings: boolean
}

/**
 * What an AI panel shows in place of an error while no provider can run; null
 * once one can. `auto` offers both subscriptions, a selected subscription only
 * its own card (a selection is never replaced by another provider), a selected
 * key provider the way to its settings.
 */
export function aiConnectPromptView(choice: AiProviderChoice): AiConnectPromptView | null {
  if (choice.connected) return null
  if (!choice.provider) {
    return {
      titleKey: 'connectTitle',
      bodyKey: 'connectBody',
      providers: AI_SUBSCRIPTION_PROVIDERS,
      settings: false,
    }
  }
  const providerName = aiProviderDisplayName(choice.provider)
  if (isSubscriptionProvider(choice.provider)) {
    return {
      titleKey: 'connectProviderTitle',
      providerName,
      providers: [choice.provider],
      settings: false,
    }
  }
  return {
    titleKey: 'connectProviderTitle',
    bodyKey: 'connectKeyBody',
    providerName,
    providers: [],
    settings: true,
  }
}

// ---- blocked run ----

/** Run errors that mean "this connection cannot go on", as opposed to a transient failure */
export const AI_BLOCKED_RUN_KINDS = [
  'rate-limit',
  'signed-out',
  'not-installed',
  'needs-update',
  'metered-not-accepted',
  'unsafe-tools',
  'not-connected',
] as const satisfies readonly AiRunErrorKind[]

export type AiBlockedRunKind = (typeof AI_BLOCKED_RUN_KINDS)[number]

export function isAiBlockedRunKind(kind: unknown): kind is AiBlockedRunKind {
  return (AI_BLOCKED_RUN_KINDS as readonly unknown[]).includes(kind)
}

export interface AiContinueOption {
  readonly provider: AiSubscriptionProviderId
  /** an accepted metered login: the button carries a cost note */
  readonly metered: boolean
}

/**
 * The other connection a blocked run may be continued on, if any: a subscription
 * provider that is `ready`, else one on a metered login the user already
 * accepted. Never the blocked provider itself and never a key provider — the
 * user switches by pressing the button, nothing switches on its own.
 */
export function aiContinueOption(
  settings: Pick<AiSettings, 'meteredAccepted'>,
  statuses: AiSubscriptionStatuses,
  blocked?: AiProviderId | undefined,
): AiContinueOption | null {
  const others = AI_SUBSCRIPTION_PROVIDERS.filter((id) => id !== blocked)
  const connectionOf = (id: AiSubscriptionProviderId) =>
    subscriptionConnection(settings, statuses[id])
  const ready = others.find((id) => connectionOf(id) === 'subscription')
  if (ready) return { provider: ready, metered: false }
  const metered = others.find((id) => connectionOf(id) === 'metered')
  return metered ? { provider: metered, metered: true } : null
}

// ---- run error wording ----

/** What a failed run says about its cause (agent-core's IpcStreamErrorCause satisfies it) */
export interface AiRunErrorCause {
  readonly kind: AiRunErrorKind
  /** the provider the error is about */
  readonly provider?: AiProviderId | undefined
  /** epoch milliseconds: when the limit resets or calls are allowed again */
  readonly resetsAt?: number | undefined
}

/**
 * A reset time as the user reads it: the clock time while it falls on today,
 * with the date in front once it does not (a 7-day window resets days ahead).
 */
export function formatAiResetTime(lang: Lang, resetsAt: number, now: number = Date.now()): string {
  const at = new Date(resetsAt)
  const today = new Date(now)
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate()
  return new Intl.DateTimeFormat(
    htmlLang(lang),
    sameDay
      ? { hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  ).format(at)
}

/**
 * The localized message for a run error of the subscription contract, so every
 * editor words it the same way. Returns undefined for the kinds each editor
 * already words itself (`timeout`, `credits`, `network`, `overloaded`), which
 * makes it usable directly as the transport's `errorText` option.
 */
export function aiRunErrorText(
  lang: Lang,
  cause: AiRunErrorCause,
  now?: number,
): string | undefined {
  const hasTime = typeof cause.resetsAt === 'number' && Number.isFinite(cause.resetsAt)
  const time = hasTime ? formatAiResetTime(lang, cause.resetsAt as number, now) : ''
  // only Claude can start with tools of its own, and the error names no provider
  const provider = aiProviderDisplayName(
    cause.provider ?? (cause.kind === 'unsafe-tools' ? 'claude-code' : undefined),
  )
  switch (cause.kind) {
    case 'not-connected':
      return aiSubscriptionText(lang, 'errNotConnected')
    case 'not-installed':
      return aiSubscriptionText(lang, 'errNotInstalled', { provider })
    case 'signed-out':
      return aiSubscriptionText(lang, 'errSignedOut', { provider })
    case 'rate-limit':
      return hasTime
        ? aiSubscriptionText(lang, 'errRateLimitReset', { provider, time })
        : aiSubscriptionText(lang, 'errRateLimit', { provider })
    case 'unsafe-tools':
      return aiSubscriptionText(lang, 'errUnsafeTools', { provider })
    case 'metered-not-accepted':
      return aiSubscriptionText(lang, 'errMeteredNotAccepted', { provider })
    case 'needs-update':
      return aiSubscriptionText(lang, 'errNeedsUpdate', { provider })
    case 'headless-limit':
      return hasTime
        ? aiSubscriptionText(lang, 'errHeadlessLimitReset', { time })
        : aiSubscriptionText(lang, 'errHeadlessLimit')
    default:
      return undefined
  }
}

// ---- usage ----

const USAGE_WINDOWS: readonly AiUsageWindow[] = ['five_hour', 'seven_day']

/**
 * The usage windows worth showing: those at or above the threshold, one per
 * provider and window (the latest report wins), subscription order first and
 * the shorter window before the longer one.
 */
export function aiSubscriptionUsageAlerts(
  usage: readonly AiSubscriptionUsage[],
  threshold: number = AI_SUBSCRIPTION_USAGE_THRESHOLD,
): AiSubscriptionUsage[] {
  const latest = new Map<string, AiSubscriptionUsage>()
  for (const entry of usage) latest.set(`${entry.provider}:${entry.window}`, entry)
  return [...latest.values()]
    .filter((entry) => Number.isFinite(entry.utilization) && entry.utilization >= threshold)
    .sort(
      (a, b) =>
        AI_SUBSCRIPTION_PROVIDERS.indexOf(a.provider) -
          AI_SUBSCRIPTION_PROVIDERS.indexOf(b.provider) ||
        USAGE_WINDOWS.indexOf(a.window) - USAGE_WINDOWS.indexOf(b.window),
    )
}

/** 0.83 → 83; clamped to 0..100 */
export function aiUsagePercent(utilization: number): number {
  return Math.max(0, Math.min(100, Math.round(utilization * 100)))
}

/** "83% used · resets at 5:10 PM" */
export function aiSubscriptionUsageText(
  lang: Lang,
  usage: Pick<AiSubscriptionUsage, 'utilization' | 'resetsAt'>,
  now?: number,
): string {
  return aiSubscriptionText(lang, 'usageLine', {
    percent: aiUsagePercent(usage.utilization),
    time: formatAiResetTime(lang, usage.resetsAt, now),
  })
}

/** "Claude · 5-hour limit": which window a usage line is about */
export function aiSubscriptionUsageLabel(
  lang: Lang,
  usage: Pick<AiSubscriptionUsage, 'provider' | 'window'>,
): string {
  const window = aiSubscriptionText(
    lang,
    usage.window === 'seven_day' ? 'usageWindowSevenDay' : 'usageWindowFiveHour',
  )
  return `${aiSubscriptionProviderName(usage.provider)} · ${window}`
}
