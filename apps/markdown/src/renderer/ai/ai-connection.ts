/**
 * What the AI panel does under the subscription contract, as plain functions:
 * whether a send may start, which run errors get the blocked notice, what the
 * settings look like after "continue with …" or after the first-connection
 * notice was acknowledged, and whether generate_image is offered. The panel
 * only lays these answers out, so the rules are testable without a DOM.
 */
import type { IpcStreamError } from '@genoffice/agent-core'
import {
  isSubscriptionProvider,
  selectAiProvider,
  type AiProviderChoice,
  type AiProviderId,
  type AiSettings,
  type AiSubscriptionProviderId,
  type AiSubscriptionStatuses,
} from '@genoffice/ai-provider/browser'
import type { AiToolCapabilities } from '@genoffice/ai-search'
import { isAiBlockedRunKind, withAiProviderSelection, type AiBlockedRunKind } from '@genoffice/ui'

/**
 * What pressing send leads to. `connect`: no provider can run, the connect
 * prompt is shown instead of a run. `notice`: a subscription is about to be
 * used for the first time, the first-connection notice comes first.
 */
export type AiSendGate =
  | { action: 'run' }
  | { action: 'connect'; choice: Extract<AiProviderChoice, { connected: false }> }
  | { action: 'notice'; provider: AiSubscriptionProviderId }

/**
 * The gate for the current settings and statuses. While either is still
 * unknown (nothing read yet) the send goes through: the main process resolves
 * the provider itself and answers with the cause when none can run.
 */
export function aiSendGate(
  settings: AiSettings | null,
  statuses: AiSubscriptionStatuses | null,
): AiSendGate {
  if (!settings || !statuses) return { action: 'run' }
  const choice = selectAiProvider(settings, statuses)
  if (!choice.connected) return { action: 'connect', choice }
  if (isSubscriptionProvider(choice.provider) && settings.subscriptionNoticeSeen !== true) {
    return { action: 'notice', provider: choice.provider }
  }
  return { action: 'run' }
}

/** A run that stopped because its connection cannot go on (rendered as the blocked notice) */
export interface AiBlockedRun {
  kind: AiBlockedRunKind
  /** the provider the run was blocked on, when the error named one */
  provider?: AiProviderId
  /** epoch milliseconds: when a used-up limit resets */
  resetsAt?: number
}

/**
 * The blocked-run cause behind an error message, or undefined for every other
 * failure. `error` is the transport's structured copy of its last failure; it
 * counts only when it is the failure this message came from.
 */
export function blockedRunOf(
  error: IpcStreamError | null | undefined,
  message: string,
): AiBlockedRun | undefined {
  if (!error || error.message !== message || !isAiBlockedRunKind(error.kind)) return undefined
  return {
    kind: error.kind,
    ...(error.provider ? { provider: error.provider } : {}),
    ...(typeof error.resetsAt === 'number' ? { resetsAt: error.resetsAt } : {}),
  }
}

/** Settings after "continue with …": that provider becomes the selection, on the model it already had */
export function withContinueProvider(
  settings: AiSettings,
  provider: AiSubscriptionProviderId,
): AiSettings {
  return withAiProviderSelection(settings, {
    provider,
    model: settings.providers?.[provider]?.model ?? '',
  })
}

/** Settings after the first-connection notice was acknowledged */
export function withSubscriptionNoticeSeen(settings: AiSettings): AiSettings {
  return { ...settings, subscriptionNoticeSeen: true }
}

/**
 * Whether generate_image can run right now, asked from the main process.
 * Anything short of a positive answer — no handler registered yet, a failed
 * call, a malformed answer — reads as unavailable.
 */
export async function readImageGenerationAvailable(
  read: () => Promise<AiToolCapabilities | null>,
): Promise<boolean> {
  try {
    const capabilities = await read()
    return capabilities?.imageGeneration?.available === true
  } catch {
    return false
  }
}
