import type { IpcStreamError, IpcStreamErrorCause } from '@genoffice/agent-core'
import {
  AI_SUBSCRIPTION_PROVIDERS,
  isSubscriptionProvider,
  selectAiProvider,
} from '@genoffice/ai-provider/browser'
import type {
  AiProviderChoice,
  AiSettings,
  AiSubscriptionProviderId,
  AiSubscriptionStatuses,
  AiSubscriptionUsage,
} from '@genoffice/ai-provider/browser'
import { isAiBlockedRunKind, withAiProviderSelection } from '@genoffice/ui'

/**
 * What the AI panel does with a request, from the stored settings and the
 * connection statuses. The main process decides again when the request arrives;
 * this only chooses what the panel shows in place of an error.
 */
export type AiPanelGate =
  /** a provider can run */
  | { kind: 'ready'; choice: Extract<AiProviderChoice, { connected: true }> }
  /** settings or a status check have not answered yet: send, the main process decides */
  | { kind: 'pending' }
  /** a subscription is about to be used for the first time: show the notice before anything is sent */
  | { kind: 'notice'; choice: Extract<AiProviderChoice, { connected: true }> }
  /** nothing can run: show the connect prompt instead of sending */
  | { kind: 'connect'; choice: Extract<AiProviderChoice, { connected: false }> }

/** A status check that has not reported yet may still turn "not connected" into "connected" */
function connectionPending(
  choice: Extract<AiProviderChoice, { connected: false }>,
  statuses: AiSubscriptionStatuses,
): boolean {
  if (choice.reason === 'checking') return true
  if (choice.selection !== 'auto') return false
  return AI_SUBSCRIPTION_PROVIDERS.some((id) => (statuses[id]?.state ?? 'checking') === 'checking')
}

export function aiPanelGate(
  settings: AiSettings | null,
  statuses: AiSubscriptionStatuses,
): AiPanelGate {
  if (!settings) return { kind: 'pending' }
  const choice = selectAiProvider(settings, statuses)
  if (!choice.connected) {
    return connectionPending(choice, statuses) ? { kind: 'pending' } : { kind: 'connect', choice }
  }
  if (isSubscriptionProvider(choice.provider) && settings.subscriptionNoticeSeen !== true) {
    return { kind: 'notice', choice }
  }
  return { kind: 'ready', choice }
}

/** Whether a request may leave the panel in this state */
export function gateAllowsSend(gate: AiPanelGate): boolean {
  return gate.kind === 'ready' || gate.kind === 'pending'
}

/** A failed turn whose connection cannot go on: shown as a blocked notice instead of an error line */
export interface BlockedRun extends IpcStreamErrorCause {
  /** the localized text of the failure, kept as the fallback wording */
  message: string
}

export function blockedRunOf(error: IpcStreamError | null | undefined): BlockedRun | null {
  if (!error || !isAiBlockedRunKind(error.kind)) return null
  return {
    kind: error.kind,
    ...(error.provider ? { provider: error.provider } : {}),
    ...(error.resetsAt !== undefined ? { resetsAt: error.resetsAt } : {}),
    message: error.message,
  }
}

/**
 * The blocked cause of the turn that just failed with `message`. The transport
 * reports the structured cause right before the loop gets the same text, so a
 * cause whose text differs belongs to an earlier stream and is ignored.
 */
export function blockedRunFor(
  message: string,
  error: IpcStreamError | null | undefined,
): BlockedRun | null {
  return error?.message === message ? blockedRunOf(error) : null
}

/**
 * The page and brief writers retry a reply that came back empty. A blocked
 * connection would only fail the same way again (and spend a request doing so).
 */
export function writerMayRetry(error: IpcStreamError | null | undefined): boolean {
  return blockedRunOf(error) === null
}

/** "Continue with …": that provider becomes the stored selection, on the model it already had */
export function withContinueProvider(
  settings: AiSettings,
  provider: AiSubscriptionProviderId,
): AiSettings {
  return withAiProviderSelection(settings, {
    provider,
    model: settings.providers[provider]?.model ?? '',
  })
}

/** Acknowledging the first-connection notice is remembered in the shared AI settings */
export function withSubscriptionNoticeSeen(settings: AiSettings): AiSettings {
  return { ...settings, subscriptionNoticeSeen: true }
}

/**
 * The latest usage report per provider and window. A turn may report one
 * window at a time, so a new report replaces only its own window; a window
 * whose reset time has passed is dropped (its figure no longer holds).
 */
export function mergeSubscriptionUsage(
  current: readonly AiSubscriptionUsage[],
  reported: readonly AiSubscriptionUsage[],
  now: number = Date.now(),
): AiSubscriptionUsage[] {
  const latest = new Map<string, AiSubscriptionUsage>()
  for (const entry of [...current, ...reported]) {
    latest.set(`${entry.provider}:${entry.window}`, entry)
  }
  return [...latest.values()].filter((entry) => entry.resetsAt > now)
}
