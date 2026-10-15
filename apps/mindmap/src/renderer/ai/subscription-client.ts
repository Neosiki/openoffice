/**
 * The AI panel's side of the subscription connection: the live statuses of the
 * two providers and the actions of their connect cards.
 *
 * Every call is allowed to fail. The main-process handlers are registered by
 * another module of the app (the docs main), a standalone run has none, and a
 * preload from an older build exposes nothing at all; in each case the statuses
 * simply stay `checking` and an action does nothing. Nothing here throws or
 * leaves a rejected promise behind.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AiSubscriptionProviderId,
  AiSubscriptionState,
  SubscriptionStatusMap,
} from '@genoffice/ai-provider/browser'
import type { MindmapApi } from '../../shared/ipc'
import type { MindmapSubscriptionApi } from '../../shared/subscription-api'
import { checkingSubscriptionStatuses } from '../../shared/subscription-api'

export interface SubscriptionConnection {
  readonly statuses: SubscriptionStatusMap
  /** an action is in flight: the cards keep their buttons but ignore them */
  readonly busy: boolean
  readonly install: (provider: AiSubscriptionProviderId) => void
  readonly login: (provider: AiSubscriptionProviderId) => void
  readonly recheck: (provider: AiSubscriptionProviderId) => void
  readonly acceptMetered: (provider: AiSubscriptionProviderId) => void
  readonly openInstallHelp: (provider: AiSubscriptionProviderId) => void
}

/** a preload from an older build exposes no subscription API */
function subscriptionApi(): MindmapSubscriptionApi | undefined {
  return (window.mindmapApi as Partial<MindmapApi> | undefined)?.subscription
}

/** the answer of an API call, or null when there is no API, no handler, or the call failed */
export async function attemptSubscription<T>(
  call: (api: MindmapSubscriptionApi) => Promise<T>,
): Promise<T | null> {
  const api = subscriptionApi()
  if (!api) return null
  try {
    return await call(api)
  } catch {
    return null
  }
}

/**
 * Live connection state for as long as the panel is mounted: the statuses are
 * read once, follow the main process's change events, and are checked again
 * each time the window regains focus after a login or an install was started,
 * since both happen in another window.
 */
export function useSubscriptionConnection(): SubscriptionConnection {
  const [statuses, setStatuses] = useState<SubscriptionStatusMap>(checkingSubscriptionStatuses)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const statusesRef = useRef(statuses)
  statusesRef.current = statuses
  /** providers with a login or install under way, and the state each was in when it started */
  const launched = useRef(new Map<AiSubscriptionProviderId, AiSubscriptionState>())

  const apply = useCallback((next: SubscriptionStatusMap | null) => {
    if (!next || !alive.current) return
    for (const [provider, state] of launched.current) {
      if (next[provider].state !== state) launched.current.delete(provider)
    }
    setStatuses(next)
  }, [])

  const check = useCallback(
    (providers?: AiSubscriptionProviderId[]) =>
      attemptSubscription((api) => api.recheck(providers)).then(apply),
    [apply],
  )

  useEffect(() => {
    alive.current = true
    void attemptSubscription((api) => api.statuses()).then(apply)
    let off: (() => void) | undefined
    try {
      off = subscriptionApi()?.onChanged(apply)
    } catch {
      // no event source: the statuses still follow the checks
    }
    const onFocus = () => {
      if (launched.current.size > 0) void check([...launched.current.keys()])
    }
    window.addEventListener('focus', onFocus)
    return () => {
      alive.current = false
      window.removeEventListener('focus', onFocus)
      off?.()
    }
  }, [apply, check])

  const launch = useCallback(
    (kind: 'install' | 'login', provider: AiSubscriptionProviderId) => {
      setBusy(true)
      void attemptSubscription((api) =>
        kind === 'install' ? api.install(provider) : api.login(provider),
      )
        .then((result) => {
          if (!alive.current) return
          if (result?.ok) {
            launched.current.set(provider, statusesRef.current[provider].state)
            return
          }
          // a sign-in that found no program means the shown status is out of date
          if (result?.reason === 'not-installed') void check([provider])
        })
        .finally(() => {
          if (alive.current) setBusy(false)
        })
    },
    [check],
  )

  const install = useCallback(
    (provider: AiSubscriptionProviderId) => launch('install', provider),
    [launch],
  )
  const login = useCallback(
    (provider: AiSubscriptionProviderId) => launch('login', provider),
    [launch],
  )
  const recheck = useCallback(
    (provider: AiSubscriptionProviderId) => {
      setBusy(true)
      void check([provider]).finally(() => {
        if (alive.current) setBusy(false)
      })
    },
    [check],
  )
  const acceptMetered = useCallback(
    (provider: AiSubscriptionProviderId) => {
      setBusy(true)
      void attemptSubscription((api) => api.setMeteredAccepted(provider, true))
        .then((result) => apply(result?.statuses ?? null))
        .finally(() => {
          if (alive.current) setBusy(false)
        })
    },
    [apply],
  )
  const openInstallHelp = useCallback((provider: AiSubscriptionProviderId) => {
    void attemptSubscription((api) => api.openInstallHelp(provider))
  }, [])

  return { statuses, busy, install, login, recheck, acceptMetered, openInstallHelp }
}
