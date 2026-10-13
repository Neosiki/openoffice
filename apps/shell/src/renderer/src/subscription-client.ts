/**
 * The renderer's side of the subscription connection: the live statuses of the
 * two providers and the actions of their connect cards.
 *
 * Every call is allowed to fail. The main-process handlers are registered by
 * another module of the app, and a preload from an older build exposes nothing
 * at all; in both cases the statuses simply stay `checking` and an action
 * reports that it could not start. Nothing here throws or leaves a rejected
 * promise behind.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AiSubscriptionProviderId,
  AiSubscriptionState,
  SubscriptionStatusMap,
} from '@genoffice/ai-provider/browser'
import type { SubscriptionApi } from '../../shared/subscription-api'
import { checkingSubscriptionStatuses } from '../../shared/subscription-api'

declare global {
  interface Window {
    aiOfficeSubscription?: SubscriptionApi
  }
}

/** a login or install that could not be started */
export type SubscriptionLaunchKind = 'install' | 'login'

export interface SubscriptionConnection {
  readonly statuses: SubscriptionStatusMap
  /** an action is in flight: the cards keep their buttons but ignore them */
  readonly busy: boolean
  /** per provider: the launch that could not be started, until the next attempt */
  readonly failed: Partial<Record<AiSubscriptionProviderId, SubscriptionLaunchKind>>
  /** this build can generate images through the Codex subscription */
  readonly codexImageAvailable: boolean
  readonly install: (provider: AiSubscriptionProviderId) => void
  readonly login: (provider: AiSubscriptionProviderId) => void
  readonly recheck: (provider: AiSubscriptionProviderId) => void
  /** read the last known statuses again without starting a check (another view may have changed them) */
  readonly refresh: () => void
  /** "use anyway" on a metered login; resolves once the answer is in */
  readonly acceptMetered: (provider: AiSubscriptionProviderId) => Promise<void>
  readonly openInstallHelp: (provider: AiSubscriptionProviderId) => void
}

/** the answer of an API call, or null when there is no API, no handler, or the call failed */
async function attempt<T>(call: (api: SubscriptionApi) => Promise<T>): Promise<T | null> {
  const api = window.aiOfficeSubscription
  if (!api) return null
  try {
    return await call(api)
  } catch {
    return null
  }
}

/**
 * Live connection state for as long as the calling component is mounted (the
 * settings dialog, the app frame): the statuses are read and re-checked when it opens, follow
 * the main process's change events, and are checked again each time the window
 * regains focus after a login or an install was started, since both happen in
 * another window.
 */
export function useSubscriptionConnection(): SubscriptionConnection {
  const [statuses, setStatuses] = useState<SubscriptionStatusMap>(checkingSubscriptionStatuses)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<SubscriptionConnection['failed']>({})
  const [codexImageAvailable, setCodexImageAvailable] = useState(false)
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
      attempt((api) => api.recheck(providers)).then(apply),
    [apply],
  )

  useEffect(() => {
    alive.current = true
    void attempt((api) => api.statuses()).then(apply)
    void check()
    void attempt((api) => api.codexImageAvailable()).then((available) => {
      if (alive.current) setCodexImageAvailable(available === true)
    })
    let off: (() => void) | undefined
    try {
      off = window.aiOfficeSubscription?.onChanged(apply)
    } catch {
      // no event source: the statuses still follow the checks above
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
    (kind: SubscriptionLaunchKind, provider: AiSubscriptionProviderId) => {
      setBusy(true)
      setFailed((current) => ({ ...current, [provider]: undefined }))
      void attempt((api) => (kind === 'install' ? api.install(provider) : api.login(provider)))
        .then((result) => {
          if (!alive.current) return
          if (result?.ok) {
            launched.current.set(provider, statusesRef.current[provider].state)
            return
          }
          setFailed((current) => ({ ...current, [provider]: kind }))
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
  const refresh = useCallback(() => {
    void attempt((api) => api.statuses()).then(apply)
  }, [apply])
  const acceptMetered = useCallback(
    async (provider: AiSubscriptionProviderId) => {
      setBusy(true)
      const result = await attempt((api) => api.setMeteredAccepted(provider, true))
      apply(result?.statuses ?? null)
      if (alive.current) setBusy(false)
    },
    [apply],
  )
  const openInstallHelp = useCallback((provider: AiSubscriptionProviderId) => {
    void attempt((api) => api.openInstallHelp(provider))
  }, [])

  return {
    statuses,
    busy,
    failed,
    codexImageAvailable,
    install,
    login,
    recheck,
    refresh,
    acceptMetered,
    openInstallHelp,
  }
}
