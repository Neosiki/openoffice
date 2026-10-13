/**
 * The connection statuses of the subscription providers as the app holds them:
 * the last answer of each CLI, combined with the user's stored acceptance of a
 * metered login. One instance lives in the main process; the IPC helper puts it
 * in front of the renderers.
 *
 * A status also carries two things for display that a CLI tells about a login
 * it is signed in with: the account, and the list of its models. The list is
 * read after the status and added when it arrives, so it never delays or fails
 * a check.
 */
import { AI_SUBSCRIPTION_PROVIDERS } from '../providers'
import type {
  AiSettings,
  AiSubscriptionModel,
  AiSubscriptionProviderId,
  AiSubscriptionStatus,
} from '../types'
import {
  checkingSubscriptionStatus,
  subscriptionAccountOf,
  subscriptionModelsOf,
  subscriptionStatusErrorText,
  type SubscriptionMeteredResult,
  type SubscriptionStatusMap,
} from './contract'
import {
  meteredLoginFingerprint,
  reconcileMeteredAcceptance,
  type MeteredAcceptanceStore,
} from './metered'
import type { SubscriptionModelLister } from './models'
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
  /**
   * Reads the model list of a provider that can run. Absent: no list is read,
   * and nothing beyond the status check is started (the headless callers).
   */
  listModels?: SubscriptionModelLister | undefined
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

/** A login is known for these states: the account and the model list belong to them alone */
function signedIn(detection: SubscriptionDetection): boolean {
  return detection.state === 'ready' || detection.state === 'metered'
}

/** A detection as the status the contract defines: no field beyond those it lists */
function toStatus(
  detection: SubscriptionDetection,
  meteredAccepted: boolean,
  models?: AiSubscriptionModel[] | undefined,
): AiSubscriptionStatus {
  // a detection can come from an injected detector: its account is checked again
  const account = signedIn(detection) ? subscriptionAccountOf(detection.account) : undefined
  return {
    provider: detection.provider,
    state: detection.state,
    ...(detection.version ? { version: detection.version } : {}),
    ...(detection.loginMethod ? { loginMethod: detection.loginMethod } : {}),
    ...(detection.planName ? { planName: detection.planName } : {}),
    ...(account ? { account } : {}),
    ...(signedIn(detection) && models?.length ? { models } : {}),
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
  /** the list each CLI gave last; kept for the process, replaced when a later reading differs */
  const models = new Map<AiSubscriptionProviderId, AiSubscriptionModel[]>()
  /** counts the logins seen per provider: a list read for an earlier login is not used */
  const loginEpoch = new Map<AiSubscriptionProviderId, number>()
  /** the login a model reading under way belongs to */
  const modelReading = new Map<AiSubscriptionProviderId, number>()
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
      if (detection.state === 'signed-out' || detection.state === 'not-installed') {
        // whoever signs in next gets a list of their own
        models.delete(provider)
        loginEpoch.set(provider, (loginEpoch.get(provider) ?? 0) + 1)
      }
      statuses[provider] = toStatus(detection, accepted, models.get(provider))
      announce()
    })

  /**
   * Read the provider's model list, off to the side of the check that asked.
   * The status is already out; the list is added to it, with a change event,
   * only when it differs from the one at hand. One reading at a time.
   */
  const refreshModels = (provider: AiSubscriptionProviderId, configuredPath?: string): void => {
    const listModels = deps.listModels
    if (!listModels) return
    const epoch = loginEpoch.get(provider) ?? 0
    if (modelReading.get(provider) === epoch) return
    modelReading.set(provider, epoch)
    void Promise.resolve()
      .then(() => listModels(provider, { configuredPath }))
      .then(subscriptionModelsOf, () => undefined)
      .then((list) => {
        if (modelReading.get(provider) === epoch) modelReading.delete(provider)
        // read for a login that is gone, or nothing read: what is shown stays
        if (!list || (loginEpoch.get(provider) ?? 0) !== epoch) return
        if (JSON.stringify(models.get(provider)) === JSON.stringify(list)) return
        models.set(provider, list)
        const detection = detections.get(provider)
        if (!detection || !signedIn(detection)) return
        statuses[provider] = toStatus(detection, statuses[provider].meteredAccepted, list)
        announce()
      })
  }

  const checkOne = (provider: AiSubscriptionProviderId): Promise<void> => {
    const running = inFlight.get(provider)
    if (running) return running
    const task = (async () => {
      let detection: SubscriptionDetection
      let configuredPath: string | undefined
      try {
        const settings = await deps.getSettings()
        configuredPath = settings.providers?.[provider]?.cliPath
        detection = await detect(provider, {
          configuredPath,
          timeoutMs: deps.timeoutMs,
        })
      } catch {
        // a fixed text: the message of the failure may carry what a CLI printed
        detection = {
          provider,
          state: 'error',
          error: subscriptionStatusErrorText('failed', 'The status check failed'),
        }
      }
      await applyDetection(detection)
      if (signedIn(detection)) refreshModels(provider, configuredPath)
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
        if (detection) statuses[provider] = toStatus(detection, accepted, models.get(provider))
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
