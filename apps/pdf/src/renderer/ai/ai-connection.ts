/**
 * The AI panel's decisions under the subscription contract, kept free of React
 * so they can be tested on their own: what pressing send does, when a failed
 * run is shown as a blocked notice, and the settings each button writes.
 */
import {
  isSubscriptionProvider,
  selectAiProvider,
  type AiProviderId,
  type AiSettings,
  type AiSubscriptionProviderId,
  type AiSubscriptionStatuses,
  type AiSubscriptionUsage,
} from '@genoffice/ai-provider/browser'
import type { IpcStreamError } from '@genoffice/agent-core'
import { isAiBlockedRunKind, withAiProviderSelection, type AiBlockedRunKind } from '@genoffice/ui'

/**
 * What a send does right now.
 * `connect`: no provider can run — the connect prompt is shown and nothing is sent.
 * `notice`: a subscription provider is about to be used for the first time — the
 * first-connection notice is shown and the request waits for its acknowledgement.
 * `run`: the request goes out.
 */
export type AiSendGate = 'connect' | 'notice' | 'run'

export function aiSendGate(settings: AiSettings, statuses: AiSubscriptionStatuses): AiSendGate {
  const choice = selectAiProvider(settings, statuses)
  if (!choice.connected) return 'connect'
  return isSubscriptionProvider(choice.provider) && !settings.subscriptionNoticeSeen
    ? 'notice'
    : 'run'
}

/** Why a run stopped, when its connection cannot go on (shown as the blocked notice) */
export interface AiBlockedRun {
  kind: AiBlockedRunKind
  /** the provider the run was blocked on, when the error names one */
  provider?: AiProviderId
  /** epoch milliseconds: when a used-up limit resets */
  resetsAt?: number
}

/**
 * The blocked-run view of a stream failure, or null for a failure that keeps
 * the plain error line (timeouts, network, overload, provider messages).
 */
export function aiBlockedRunOf(error: IpcStreamError | null | undefined): AiBlockedRun | null {
  if (!error || !isAiBlockedRunKind(error.kind)) return null
  return {
    kind: error.kind,
    ...(error.provider ? { provider: error.provider } : {}),
    ...(typeof error.resetsAt === 'number' && Number.isFinite(error.resetsAt)
      ? { resetsAt: error.resetsAt }
      : {}),
  }
}

/**
 * Settings after "continue with <provider>": that provider becomes the stored
 * selection (so the model picker shows it), keeping the model it last used.
 */
export function withContinuedProvider(
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
 * The usage windows known so far after a new report: one entry per provider
 * and window, the newer report replacing the older one. A turn may report its
 * windows one at a time, so a report never drops the windows it does not name.
 */
export function mergeSubscriptionUsage(
  known: readonly AiSubscriptionUsage[],
  reported: readonly AiSubscriptionUsage[],
): AiSubscriptionUsage[] {
  const sameWindow = (a: AiSubscriptionUsage, b: AiSubscriptionUsage) =>
    a.provider === b.provider && a.window === b.window
  const latest = reported.filter(
    (entry, index) => !reported.slice(index + 1).some((later) => sameWindow(entry, later)),
  )
  return [...known.filter((entry) => !latest.some((next) => sameWindow(entry, next))), ...latest]
}
