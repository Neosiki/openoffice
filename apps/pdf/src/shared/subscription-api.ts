// Contract between the pdf renderer (AI panel) and the main process for the
// subscription providers (Claude, Codex). The request channels and payloads are
// the shared ones from @genoffice/ai-provider; their main-process handlers are
// registered once for the whole app by the docs main (pdf registers none), so
// every answer is read defensively: a missing handler is "still checking".

import { checkingSubscriptionStatus } from '@genoffice/ai-provider/browser'
import type {
  AiSubscriptionProviderId,
  AiSubscriptionState,
  AiSubscriptionStatus,
  SubscriptionLaunchFailure,
  SubscriptionLaunchResult,
  SubscriptionMeteredResult,
  SubscriptionStatusMap,
} from '@genoffice/ai-provider/browser'

/** exposed as `window.pdfApi.subscription` by the pdf preload (same shape as the shell's) */
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
  /** the statuses changed (any window, any cause); returns an unsubscribe */
  onChanged(handler: (statuses: SubscriptionStatusMap) => void): () => void
  /** open the vendor's install instructions in the default browser */
  openInstallHelp(provider: AiSubscriptionProviderId): Promise<void>
}

/** shell-registered: (AiSubscriptionProviderId) → void, opens the vendor's install page */
export const SUBSCRIPTION_INSTALL_HELP_CHANNEL = 'home:open-subscription-install-help'

/**
 * PROVISIONAL channel name. The docs main (the app-wide AI host) answers it
 * with `aiToolCapabilities(settings, { path: 'screen', statuses })`; the name
 * was not final when this was written, so it lives in this one constant and
 * is read through `imageGenerationAvailableOf` only.
 */
export const AI_TOOL_CAPABILITIES_CHANNEL = 'ai:tool-capabilities'

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

/**
 * An IPC answer as a status map with both providers present. A provider whose
 * entry is missing or malformed reads as `checking`, so the renderer never has
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

/** An IPC answer as a metered-acceptance result */
export function subscriptionMeteredResultOf(result: unknown): SubscriptionMeteredResult {
  const raw = isRecord(result) ? result : {}
  return { ok: raw.ok === true, statuses: subscriptionStatusMapOf(raw.statuses) }
}

/**
 * Whether the tool-capabilities answer says an image can be generated right
 * now. Anything else — no handler, an older build, a malformed answer — reads
 * as unavailable, so generate_image is never offered on a guess.
 */
export function imageGenerationAvailableOf(capabilities: unknown): boolean {
  if (!isRecord(capabilities)) return false
  const image = capabilities.imageGeneration
  return isRecord(image) && image.available === true
}
