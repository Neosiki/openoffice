/**
 * The ask panel's decisions under the subscription contract, kept free of React
 * so they can be tested on their own: what pressing send does, when a failed
 * run is shown as a blocked notice, and the settings "continue with" writes.
 * The editors' AI panels follow the same rules.
 */
import { selectAiProvider } from '@genoffice/ai-provider/browser'
import type {
  AiProviderId,
  AiSettings,
  AiSubscriptionProviderId,
  AiSubscriptionStatuses,
} from '@genoffice/ai-provider/browser'
import type { IpcStreamError } from '@genoffice/agent-core'
import { isAiBlockedRunKind, withAiProviderSelection, type AiBlockedRunKind } from '@genoffice/ui'

/**
 * What a send does right now.
 * `connect`: no provider can run — the connect prompt is shown and nothing is sent.
 * `notice`: the first-connection notice is up and not acknowledged yet — nothing is sent.
 * `run`: the question goes out.
 */
export type AskSendGate = 'connect' | 'notice' | 'run'

/**
 * `noticeDue` is the home screen's own answer (it shows the notice over this
 * panel), so the panel holds back exactly as long as that dialog is owed.
 * Settings not read yet = let the main process answer.
 */
export function askSendGate(
  settings: AiSettings | null,
  statuses: AiSubscriptionStatuses,
  noticeDue: boolean,
): AskSendGate {
  if (settings && !selectAiProvider(settings, statuses).connected) return 'connect'
  return noticeDue ? 'notice' : 'run'
}

/** Why a run stopped, when its connection cannot go on (shown as the blocked notice) */
export interface AskBlockedRun {
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
export function askBlockedRunOf(error: IpcStreamError | null | undefined): AskBlockedRun | null {
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
 * selection (so Settings shows it as the AI in use), keeping the model it last used.
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
