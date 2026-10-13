/**
 * The connection statuses of the subscription providers as the app holds them:
 * the last answer of each CLI, combined with the user's stored acceptance of a
 * metered login. One instance lives in the main process; the IPC helper puts it
 * in front of the renderers.
 */
import { AI_SUBSCRIPTION_PROVIDERS } from '../providers'
import type { AiSettings, AiSubscriptionProviderId, AiSubscriptionStatus } from '../types'
import {
  checkingSubscriptionStatus,
  type SubscriptionMeteredResult,
  type SubscriptionStatusMap,
} from './contract'
import {
  meteredLoginFingerprint,
  reconcileMeteredAcceptance,
  type MeteredAcceptanceStore,
} from './metered'
import {
  detectSubscriptionLogin,
  type SubscriptionDetection,
  type SubscriptionDetector,
} from './status'

type MaybePromise<T> = T | Promise<T>

export interface SubscriptionStatusServiceDeps {
  /** the AI settings as stored right now (Codex `cliPath`, `meteredAccepted`) */
  getSettings(): MaybePromise<Pick<AiSettings, 'providers' | 'meteredAccepted'>>
  /** persist `AiSettings.meteredAccepted[provider]` */
  setMeteredAccepted(provider: AiSubscriptionProviderId, accepted: boolean): MaybePromise<void>
  /** where the kind of login an acceptance was given for is remembered */
  acceptanceStore: MeteredAcceptanceStore
  /** `detectSubscriptionLogin` when absent */
  detect?: SubscriptionDetector | undefined
  /** called with a fresh copy whenever a status changes */
  onChange?: ((statuses: SubscriptionStatusMap) => void) | undefined
  timeoutMs?: number | undefined
}

export interface SubscriptionStatusService {
  /** The last known statuses; `checking` for a provider no check has answered for yet */
  getStatuses(): SubscriptionStatusMap
  /**
   * Ask the CLIs again (both, at the same time, unless `providers` narrows it)
   * and resolve with the new statuses. Calls that overlap share one check.
   */
  check(providers?: AiSubscriptionProviderId[]): Promise<SubscriptionStatusMap>
  /**
   * Record or withdraw "use anyway". Accepting is refused (`ok: false`) unless
   * the provider's last detected state is `metered`.
   */
  setMeteredAccepted(
    provider: AiSubscriptionProviderId,
    accepted: boolean,
  ): Promise<SubscriptionMeteredResult>
  onChange(listener: (statuses: SubscriptionStatusMap) => void): () => void
}

/** A detection as the status the contract defines: no field beyond those it lists */
function toStatus(
  detection: SubscriptionDetection,
  meteredAccepted: boolean,
): AiSubscriptionStatus {
  return {
    provider: detection.provider,
    state: detection.state,
    ...(detection.version ? { version: detection.version } : {}),
    ...(detection.loginMethod ? { loginMethod: detection.loginMethod } : {}),
    ...(detection.planName ? { planName: detection.planName } : {}),
    meteredAccepted: detection.state === 'metered' && meteredAccepted,
    ...(detection.state === 'error' && detection.error ? { error: detection.error } : {}),
  }
}

export function createSubscriptionStatusService(
  deps: SubscriptionStatusServiceDeps,
): SubscriptionStatusService {
  const detect = deps.detect ?? detectSubscriptionLogin
  const statuses = Object.fromEntries(
    AI_SUBSCRIPTION_PROVIDERS.map((provider) => [provider, checkingSubscriptionStatus(provider)]),
  ) as SubscriptionStatusMap
  const detections = new Map<AiSubscriptionProviderId, SubscriptionDetection>()
  const inFlight = new Map<AiSubscriptionProviderId, Promise<void>>()
  const listeners = new Set<(statuses: SubscriptionStatusMap) => void>()
  if (deps.onChange) listeners.add(deps.onChange)
  // both providers share the settings and the acceptance file: one change at a time
  let acceptanceQueue: Promise<unknown> = Promise.resolve()

  const snapshot = (): SubscriptionStatusMap => ({ ...statuses })
  const announce = (): void => {
    const current = snapshot()
    for (const listener of listeners) {
      try {
        listener(current)
      } catch {
        /* one listener must not stop the others */
      }
    }
  }
  const queued = <T>(task: () => Promise<T>): Promise<T> => {
    const run = acceptanceQueue.then(task, task)
    acceptanceQueue = run.catch(() => undefined)
    return run
  }

  const applyDetection = (detection: SubscriptionDetection): Promise<void> =>
    queued(async () => {
      const provider = detection.provider
      let accepted: boolean
      try {
        const settings = await deps.getSettings()
        const record = await deps.acceptanceStore.read()
        const stored = settings.meteredAccepted?.[provider] === true
        const outcome = reconcileMeteredAcceptance(detection, {
          accepted: stored,
          fingerprint: record[provider],
        })
        accepted = outcome.meteredAccepted
        if (outcome.clear) {
          if (stored) await deps.setMeteredAccepted(provider, false)
          if (record[provider]) {
            delete record[provider]
            await deps.acceptanceStore.write(record)
          }
        }
      } catch {
        // an acceptance that cannot be read back is not an acceptance
        accepted = false
      }
      detections.set(provider, detection)
      statuses[provider] = toStatus(detection, accepted)
      announce()
    })

  const checkOne = (provider: AiSubscriptionProviderId): Promise<void> => {
    const running = inFlight.get(provider)
    if (running) return running
    const task = (async () => {
      let detection: SubscriptionDetection
      try {
        const settings = await deps.getSettings()
        detection = await detect(provider, {
          configuredPath: settings.providers?.[provider]?.cliPath,
          timeoutMs: deps.timeoutMs,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        detection = { provider, state: 'error', error: `failed: ${message}` }
      }
      await applyDetection(detection)
    })().finally(() => inFlight.delete(provider))
    inFlight.set(provider, task)
    return task
  }

  return {
    getStatuses: snapshot,
    async check(providers) {
      const wanted = providers?.length ? providers : AI_SUBSCRIPTION_PROVIDERS
      await Promise.all(wanted.map((provider) => checkOne(provider)))
      return snapshot()
    },
    setMeteredAccepted(provider, accepted) {
      return queued(async () => {
        const detection = detections.get(provider)
        const fingerprint = detection ? meteredLoginFingerprint(detection) : null
        if (accepted && (!detection || !fingerprint)) return { ok: false, statuses: snapshot() }
        try {
          const record = await deps.acceptanceStore.read()
          if (accepted && fingerprint) record[provider] = fingerprint
          else delete record[provider]
          await deps.acceptanceStore.write(record)
          await deps.setMeteredAccepted(provider, accepted)
        } catch {
          return { ok: false, statuses: snapshot() }
        }
        if (detection) statuses[provider] = toStatus(detection, accepted)
        announce()
        return { ok: true, statuses: snapshot() }
      })
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
