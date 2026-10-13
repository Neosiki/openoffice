/**
 * Main-process side of the subscription IPC contract: one handler per request
 * channel, wired to whatever the caller injects. Nothing here imports Electron,
 * so an app passes its `ipcMain` and the tests pass a stand-in.
 */
import { codexImageGenerationAvailable } from '../image-backend'
import { isSubscriptionProvider } from '../provider-selection'
import type { AiSettings, AiSubscriptionProviderId } from '../types'
import {
  SUBSCRIPTION_INSTALL_URLS,
  SUBSCRIPTION_IPC_CHANNELS,
  type SubscriptionLaunchResult,
  type SubscriptionMeteredResult,
  type SubscriptionStatusMap,
} from './contract'
import { launchSubscriptionInstall, launchSubscriptionLogin } from './launch'
import { createMeteredAcceptanceFileStore } from './metered'
import { createSubscriptionStatusService, type SubscriptionStatusService } from './service'

/** The part of Electron's `ipcMain` this helper uses */
export interface SubscriptionIpcMain {
  handle(channel: string, listener: (event: any, ...args: any[]) => unknown): void
  removeHandler?(channel: string): void
}

export interface SubscriptionIpcDeps {
  service: SubscriptionStatusService
  launchLogin(provider: AiSubscriptionProviderId): Promise<SubscriptionLaunchResult>
  launchInstall(provider: AiSubscriptionProviderId): Promise<SubscriptionLaunchResult>
  /** send an event to every window; called with the `changed` channel when a status changes */
  broadcast?: ((channel: string, payload: SubscriptionStatusMap) => void) | undefined
}

function providerOf(payload: unknown): AiSubscriptionProviderId | null {
  const provider =
    payload && typeof payload === 'object' ? (payload as { provider?: unknown }).provider : null
  return isSubscriptionProvider(provider) ? provider : null
}

function failure(error: unknown, provider: AiSubscriptionProviderId): SubscriptionLaunchResult {
  return {
    ok: false,
    reason: 'failed',
    error: error instanceof Error ? error.message : String(error),
    installUrl: SUBSCRIPTION_INSTALL_URLS[provider],
  }
}

/**
 * Register the request channels of `SUBSCRIPTION_IPC_CHANNELS` on `ipcMain`
 * and forward status changes to the `changed` channel. Payloads come from a
 * renderer and are checked here: an unknown provider is answered with
 * `invalid`, never passed on. Returns a function that undoes the registration.
 */
export function registerSubscriptionIpc(
  ipcMain: SubscriptionIpcMain,
  deps: SubscriptionIpcDeps,
): () => void {
  const { service } = deps
  const launch =
    (start: (provider: AiSubscriptionProviderId) => Promise<SubscriptionLaunchResult>) =>
    async (_event: unknown, payload: unknown): Promise<SubscriptionLaunchResult> => {
      const provider = providerOf(payload)
      if (!provider) return { ok: false, reason: 'invalid' }
      try {
        return await start(provider)
      } catch (error) {
        return failure(error, provider)
      }
    }

  const handlers: Record<string, (event: unknown, payload?: unknown) => unknown> = {
    [SUBSCRIPTION_IPC_CHANNELS.statuses]: () => {
      const statuses = service.getStatuses()
      // a window that asks before anything was checked starts the first check; the answer
      // arrives on the `changed` channel (overlapping checks share one run)
      if (Object.values(statuses).some((status) => status.state === 'checking')) {
        void service.check().catch(() => undefined)
      }
      return statuses
    },
    [SUBSCRIPTION_IPC_CHANNELS.recheck]: (_event, payload) => {
      const requested =
        payload && typeof payload === 'object'
          ? (payload as { providers?: unknown }).providers
          : undefined
      const providers = Array.isArray(requested) ? requested.filter(isSubscriptionProvider) : []
      return service.check(providers.length > 0 ? providers : undefined)
    },
    // a function per call, so a launcher replaced on `deps` later is the one that runs
    [SUBSCRIPTION_IPC_CHANNELS.login]: (event, payload) =>
      launch((provider) => deps.launchLogin(provider))(event, payload),
    [SUBSCRIPTION_IPC_CHANNELS.install]: (event, payload) =>
      launch((provider) => deps.launchInstall(provider))(event, payload),
    [SUBSCRIPTION_IPC_CHANNELS.metered]: async (
      _event,
      payload,
    ): Promise<SubscriptionMeteredResult> => {
      const provider = providerOf(payload)
      const accepted = (payload as { accepted?: unknown } | null | undefined)?.accepted
      // consent is a real boolean from the UI, not anything truthy
      if (!provider || typeof accepted !== 'boolean') {
        return { ok: false, statuses: service.getStatuses() }
      }
      return service.setMeteredAccepted(provider, accepted)
    },
    // true only in a process that loaded the Codex image backend (it registers itself on import)
    [SUBSCRIPTION_IPC_CHANNELS.codexImage]: () => codexImageGenerationAvailable(),
  }
  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)
  const stopListening = deps.broadcast
    ? service.onChange((statuses) => deps.broadcast?.(SUBSCRIPTION_IPC_CHANNELS.changed, statuses))
    : () => undefined
  return () => {
    stopListening()
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler?.(channel)
  }
}

export interface SubscriptionIpcSetup {
  /** the AI settings as stored right now */
  getSettings(): Pick<AiSettings, 'providers' | 'meteredAccepted'>
  /** persist `AiSettings.meteredAccepted[provider]` */
  setMeteredAccepted(provider: AiSubscriptionProviderId, accepted: boolean): void | Promise<void>
  /** the app's userData directory: the metered acceptance record is kept here */
  dataDir: string
  broadcast?: ((channel: string, payload: SubscriptionStatusMap) => void) | undefined
}

/**
 * The real dependencies for `registerSubscriptionIpc`: a status service over
 * the app's settings, and the launchers. After a login window closes the
 * provider is checked again, so the UI follows without being asked.
 */
export function createSubscriptionIpcDeps(setup: SubscriptionIpcSetup): SubscriptionIpcDeps {
  const service = createSubscriptionStatusService({
    getSettings: setup.getSettings,
    setMeteredAccepted: setup.setMeteredAccepted,
    acceptanceStore: createMeteredAcceptanceFileStore(setup.dataDir),
  })
  return {
    service,
    launchLogin: (provider) =>
      launchSubscriptionLogin(provider, {
        configuredPath: setup.getSettings().providers?.[provider]?.cliPath,
        onExit: () => void service.check([provider]).catch(() => undefined),
      }),
    launchInstall: (provider) => launchSubscriptionInstall(provider),
    broadcast: setup.broadcast,
  }
}
