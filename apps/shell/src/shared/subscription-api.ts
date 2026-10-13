// Contract between the shell renderer (Settings) and the main process for the
// subscription providers (Claude, Codex). The request channels and payloads are
// the shared ones from @genoffice/ai-provider; the main-process handlers are
// registered once for the whole app by the docs main, never by the shell.

import type {
  AiSubscriptionProviderId,
  SubscriptionLaunchResult,
  SubscriptionMeteredResult,
  SubscriptionStatusMap,
} from '@genoffice/ai-provider/browser'

// Reading an IPC answer is the same in every app: one implementation, in the shared contract
export {
  checkingSubscriptionStatuses,
  isSubscriptionProviderId,
  subscriptionLaunchResultOf,
  subscriptionStatusMapOf,
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
