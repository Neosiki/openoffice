/**
 * The AI panel's side of the subscription contract: what stands between the
 * user and a run (connect first, read the first-connection notice), what a
 * failed run says about its connection, and the live connection statuses.
 *
 * Every bridge call is allowed to fail. The main-process handlers are
 * registered once per process by whichever module gets there first, and an
 * older preload exposes nothing at all; in both cases the statuses simply stay
 * `checking`. Nothing here throws or leaves a rejected promise behind.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isSubscriptionProvider,
  selectAiProvider,
  type AiProviderChoice,
  type AiProviderId,
  type AiRunErrorKind,
  type AiSettings,
  type AiSubscriptionProviderId,
  type AiSubscriptionStatuses,
  type SubscriptionStatusMap,
} from '@genoffice/ai-provider/browser'
import type { IpcStreamError } from '@genoffice/agent-core'
import {
  AI_SUBSCRIPTION_INSTALL_HELP_URLS,
  isAiBlockedRunKind,
  withAiProviderSelection,
  type AiSubscriptionCardActions,
} from '@genoffice/ui'
import type { AiToolCapabilities } from '../../shared/ipc'
import { checkingSubscriptionStatuses, type SubscriptionApi } from '../../shared/subscription-api'

// ---- what stands between the user and a run ----

export type AiPanelGate =
  /** no provider can run: show the connect prompt instead of starting (or failing) a run */
  | { kind: 'connect'; choice: AiProviderChoice }
  /** a subscription provider is about to be used for the first time: the notice comes first */
  | { kind: 'first-notice'; provider: AiSubscriptionProviderId }
  | { kind: 'ready'; provider: AiProviderId }

export function aiPanelGate(
  settings: Pick<
    AiSettings,
    'provider' | 'providers' | 'meteredAccepted' | 'subscriptionNoticeSeen'
  >,
  statuses: AiSubscriptionStatuses,
): AiPanelGate {
  const choice = selectAiProvider(settings, statuses)
  if (!choice.connected) return { kind: 'connect', choice }
  if (isSubscriptionProvider(choice.provider) && settings.subscriptionNoticeSeen !== true) {
    return { kind: 'first-notice', provider: choice.provider }
  }
  return { kind: 'ready', provider: choice.provider }
}

/**
 * Nothing can run, but only because a status check has not answered yet: the
 * selected subscription is still being checked, or (under `auto`) one of the
 * two is. An unfinished key provider waits for no check.
 */
export function gateStillChecking(gate: AiPanelGate, statuses: AiSubscriptionStatuses): boolean {
  if (gate.kind !== 'connect' || gate.choice.connected) return false
  if (gate.choice.reason === 'checking') return true
  return (
    gate.choice.reason === 'no-subscription' &&
    Object.values(statuses).some((status) => status?.state === 'checking')
  )
}

/**
 * Whether the connect prompt is on screen. While the first status check is
 * still running it stays hidden — it would flash up and vanish at every start
 * — unless the user already tried to run something.
 */
export function connectPromptVisible(
  gate: AiPanelGate,
  statuses: AiSubscriptionStatuses,
  attempted: boolean,
): boolean {
  if (gate.kind !== 'connect') return false
  return attempted || !gateStillChecking(gate, statuses)
}

/**
 * Whether a request made while nothing could run is kept until something can:
 * in front of the first-connection notice (acknowledging it starts the run),
 * and while the status check is still running (a moment later the answer is
 * in). A request made in front of a real "not connected" is dropped: after a
 * sign-in that can take minutes, a run must be asked for again.
 */
export function gateKeepsRequest(gate: AiPanelGate, statuses: AiSubscriptionStatuses): boolean {
  return gate.kind === 'first-notice' || gateStillChecking(gate, statuses)
}

/** The settings to save once the first-connection notice was acknowledged */
export function withSubscriptionNoticeSeen(settings: AiSettings): AiSettings {
  return { ...settings, subscriptionNoticeSeen: true }
}

// ---- a run that stopped because its connection cannot go on ----

export interface BlockedRun {
  kind: AiRunErrorKind
  provider?: AiProviderId
  /** epoch milliseconds: when a used-up limit resets */
  resetsAt?: number
}

/** The blocked-run notice for a failed turn; null for every failure that keeps the plain error line */
export function blockedRunOf(error: IpcStreamError | null | undefined): BlockedRun | null {
  if (!error || !isAiBlockedRunKind(error.kind)) return null
  return {
    kind: error.kind,
    ...(error.provider !== undefined ? { provider: error.provider } : {}),
    ...(error.resetsAt !== undefined ? { resetsAt: error.resetsAt } : {}),
  }
}

/**
 * The settings after "continue with <provider>": that provider becomes the
 * stored selection (so the model picker shows it), on the model it already had.
 */
export function withContinuedProvider(
  settings: AiSettings,
  provider: AiSubscriptionProviderId,
): AiSettings {
  return withAiProviderSelection(settings, {
    provider,
    model: settings.providers[provider]?.model ?? '',
  })
}

// ---- which tools have a route ----

/** The skill's tool gates from the main process's capability report; nothing is offered before it answered */
export function toolGatesOf(capabilities: AiToolCapabilities | null | undefined): {
  imageGeneration: boolean
  mediaAnalysis: boolean
} {
  return {
    imageGeneration: capabilities?.imageGeneration.available === true,
    mediaAnalysis:
      capabilities?.imageAnalysis.available === true ||
      capabilities?.videoAnalysis.available === true,
  }
}

// ---- live connection statuses ----

/** the answer of a bridge call, or null when there is no bridge, no handler, or the call failed */
async function attempt<T>(call: (api: SubscriptionApi) => Promise<T>): Promise<T | null> {
  const api = window.slidesApi?.aiSubscription
  if (!api) return null
  try {
    return await call(api)
  } catch {
    return null
  }
}

export interface SubscriptionConnection {
  readonly statuses: SubscriptionStatusMap
  /** an action is in flight: the cards keep their buttons but ignore them */
  readonly busy: boolean
  /** read the last known statuses again (cheap: no program is started) */
  readonly refresh: () => void
  readonly actions: AiSubscriptionCardActions
}

/**
 * Live connection state for as long as the panel is mounted: the last known
 * statuses are read when it mounts, follow the main process's change events,
 * and are checked again each time the window regains focus after a sign-in or
 * an install was started, since both happen in another window.
 */
export function useSubscriptionConnection(): SubscriptionConnection {
  const [statuses, setStatuses] = useState<SubscriptionStatusMap>(checkingSubscriptionStatuses)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const statusesRef = useRef(statuses)
  statusesRef.current = statuses
  /** providers with a sign-in or install under way, and the state each was in when it started */
  const launched = useRef(new Map<AiSubscriptionProviderId, string>())

  const apply = useCallback((next: SubscriptionStatusMap | null | undefined) => {
    if (!next || !alive.current) return
    for (const [provider, state] of launched.current) {
      if (next[provider].state !== state) launched.current.delete(provider)
    }
    setStatuses(next)
  }, [])

  const refresh = useCallback(() => {
    void attempt((api) => api.statuses()).then(apply)
  }, [apply])

  const check = useCallback(
    (providers?: AiSubscriptionProviderId[]) =>
      attempt((api) => api.recheck(providers)).then(apply),
    [apply],
  )

  useEffect(() => {
    alive.current = true
    refresh()
    let off: (() => void) | undefined
    try {
      off = window.slidesApi?.aiSubscription?.onChanged(apply)
    } catch {
      // no event source: the statuses still follow the reads above
    }
    const onFocus = () => {
      if (launched.current.size > 0) void check([...launched.current.keys()])
      else refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      alive.current = false
      window.removeEventListener('focus', onFocus)
      off?.()
    }
  }, [apply, check, refresh])

  const during = useCallback((work: Promise<unknown>) => {
    setBusy(true)
    void work.finally(() => {
      if (alive.current) setBusy(false)
    })
  }, [])

  const launch = useCallback(
    (kind: 'install' | 'login', provider: AiSubscriptionProviderId) => {
      during(
        attempt((api) => (kind === 'install' ? api.install(provider) : api.login(provider))).then(
          (result) => {
            if (result?.ok) launched.current.set(provider, statusesRef.current[provider].state)
            // nothing was started: show what the connection really is
            else return check([provider])
          },
        ),
      )
    },
    [check, during],
  )

  const actions = useMemo<AiSubscriptionCardActions>(
    () => ({
      onInstall: (provider) => launch('install', provider),
      onLogin: (provider) => launch('login', provider),
      onRecheck: (provider) => during(check([provider])),
      onAcceptMetered: (provider) =>
        during(
          attempt((api) => api.setMeteredAccepted(provider, true)).then((r) => apply(r?.statuses)),
        ),
      onOpenInstallHelp: (provider) => {
        // routed to the system browser by the main process's window-open handler
        window.open(AI_SUBSCRIPTION_INSTALL_HELP_URLS[provider], '_blank', 'noreferrer')
      },
    }),
    [apply, check, during, launch],
  )

  return { statuses, busy, refresh, actions }
}
