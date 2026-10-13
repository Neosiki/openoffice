/**
 * What the AI panel decides from the subscription contract, kept apart from
 * the component so it can be tested without a browser: when the first
 * connection notice is due, how a failed run is shown, what "continue with …"
 * stores, and which usage reports are kept.
 */
import {
  isSubscriptionProvider,
  selectAiProvider,
  type AiProviderChoice,
  type AiRunErrorKind,
  type AiSubscriptionProviderId,
  type AiSubscriptionStatuses,
  type AiSubscriptionUsage,
} from '@genoffice/ai-provider/browser'
import type { IpcStreamError } from '@genoffice/agent-core'
import { aiContinueOption, isAiBlockedRunKind, withAiProviderSelection } from '@genoffice/ui'
import type { AiSettings } from '../../shared/ipc'

/** The machine-readable cause of a failed run, as the error chunk carried it */
export interface RunErrorCause {
  kind: AiRunErrorKind
  provider?: AiSubscriptionProviderId
  /** epoch milliseconds */
  resetsAt?: number
}

/**
 * The cause of the failure the loop just reported. The transport hands over
 * the structured copy right before the message, so the two are matched by
 * text: a failure that did not come from the transport has no cause.
 */
export function runErrorCauseOf(
  failure: IpcStreamError | null,
  message: string,
): RunErrorCause | undefined {
  if (!failure?.kind || failure.message !== message) return undefined
  return {
    kind: failure.kind,
    ...(failure.provider ? { provider: failure.provider } : {}),
    ...(failure.resetsAt !== undefined ? { resetsAt: failure.resetsAt } : {}),
  }
}

/** Causes that may rest on an out-of-date connection status: worth looking again */
const RECHECK_KINDS: readonly AiRunErrorKind[] = [
  'not-connected',
  'not-installed',
  'signed-out',
  'metered-not-accepted',
  'needs-update',
]

export function shouldRecheckAfter(cause: RunErrorCause | undefined): boolean {
  return !!cause && RECHECK_KINDS.includes(cause.kind)
}

/** How the error of the latest reply is shown */
export interface RunErrorView {
  /** the reason and, when another subscription can run, the "continue with …" button */
  blockedNotice: boolean
  /** the connect cards (the prompt itself shows nothing once a provider can run) */
  connectPrompt: boolean
  /** the plain error line */
  errorLine: boolean
}

/**
 * A cause that means "this connection cannot go on" gets the blocked notice
 * and the connect prompt instead of an error line, on the latest reply only:
 * older ones are history and offer no actions. When nothing at all can run
 * (`not-connected`) the connect prompt is the whole answer, unless another
 * subscription is ready to continue on.
 */
export function runErrorView(
  cause: RunErrorCause | undefined,
  isLatest: boolean,
  choice: AiProviderChoice,
  settings: Pick<AiSettings, 'meteredAccepted'>,
  statuses: AiSubscriptionStatuses,
): RunErrorView {
  if (!cause || !isLatest || !isAiBlockedRunKind(cause.kind)) {
    return { blockedNotice: false, connectPrompt: false, errorLine: true }
  }
  const canContinue = aiContinueOption(settings, statuses, cause.provider) !== null
  return {
    blockedNotice: cause.kind !== 'not-connected' || canContinue,
    connectPrompt: !choice.connected,
    errorLine: false,
  }
}

/**
 * True when the next run would be the first one on a subscription and the
 * notice about what leaves the PC has not been acknowledged yet. A key
 * provider, or no usable provider at all, never asks for it.
 */
export function firstConnectionNoticeDue(
  settings: Pick<
    AiSettings,
    'provider' | 'providers' | 'meteredAccepted' | 'subscriptionNoticeSeen'
  >,
  statuses: AiSubscriptionStatuses,
): boolean {
  if (settings.subscriptionNoticeSeen === true) return false
  const choice = selectAiProvider(settings, statuses)
  return choice.connected && isSubscriptionProvider(choice.provider)
}

/** The settings after "continue with …": that provider becomes the stored selection */
export function settingsContinuingWith(
  settings: AiSettings,
  provider: AiSubscriptionProviderId,
): AiSettings {
  return withAiProviderSelection(settings, {
    provider,
    // an empty model is the CLI's own default
    model: settings.providers?.[provider]?.model ?? '',
  })
}

/** The usage reports with the newest one per provider and window */
export function mergeSubscriptionUsage(
  known: readonly AiSubscriptionUsage[],
  reported: readonly AiSubscriptionUsage[],
): AiSubscriptionUsage[] {
  const latest = new Map<string, AiSubscriptionUsage>()
  for (const entry of [...known, ...reported])
    latest.set(`${entry.provider}:${entry.window}`, entry)
  return [...latest.values()]
}
