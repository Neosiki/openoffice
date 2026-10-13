import {
  AI_PROVIDERS,
  AI_SUBSCRIPTION_PROVIDERS,
  activeProvider,
  customEndpointLabel,
  isKeyProviderConfigured,
  isSubscriptionProvider,
  providerSelectionOf,
  resolveCustomEndpoints,
  selectAiProvider,
  subscriptionConnection,
  upsertCustomEndpoint,
  type AiProviderId,
  type AiProviderSelection,
  type AiSettings,
  type AiSubscriptionStatuses,
} from '@genoffice/ai-provider/browser'
import { aiProviderDisplayName, aiSubscriptionProviderName } from './ai-subscription'

export interface AiModelPickerGroup {
  readonly id: AiProviderId
  /** set on custom groups: one group per saved endpoint */
  readonly endpoint?: string | undefined
  readonly label: string
  readonly models: readonly string[]
}

export interface AiModelPickerSelection {
  readonly provider: AiProviderId
  readonly endpoint?: string | undefined
  readonly model: string
}

/**
 * Providers the composer chip may switch to: Genspark while signed in, every
 * other vendor once its settings pass the same usability test the chat path
 * applies (`activeProvider`), so picking a row never lands on a 401. A model
 * typed into the settings page that is not in the catalog is listed first.
 */
export function aiModelPickerGroups(input: AiSettings, gskLoggedIn: boolean): AiModelPickerGroup[] {
  const settings = resolveCustomEndpoints(input)
  const groups: AiModelPickerGroup[] = []
  for (const meta of AI_PROVIDERS) {
    if (meta.id === 'custom') {
      for (const ep of settings.customEndpoints ?? []) {
        if (!ep.baseUrl || !ep.model) continue
        const models = [ep.model, ...(ep.models ?? []).filter((m) => m !== ep.model)]
        groups.push({
          id: meta.id,
          endpoint: ep.id,
          label: customEndpointLabel(ep, meta.label),
          models,
        })
      }
      continue
    }
    const config = settings.providers?.[meta.id]
    const stored = config?.model?.trim() ?? ''
    // CLI vendors pass activeProvider unconfigured (the binary auto-discovers);
    // list them only once the settings page holds a model or a path
    const usable =
      meta.id === 'genspark'
        ? gskLoggedIn
        : meta.needsCliPath
          ? Boolean(stored || config?.cliPath?.trim())
          : activeProvider({ ...settings, provider: meta.id }) === meta.id
    if (!usable) continue
    const models = stored && !meta.models.includes(stored) ? [stored, ...meta.models] : meta.models
    if (models.length === 0 && !meta.needsCliPath) continue
    groups.push({ id: meta.id, label: meta.label, models })
  }
  return groups
}

export function aiModelPickerSelection(input: AiSettings): AiModelPickerSelection {
  const settings = resolveCustomEndpoints(input)
  const provider = activeProvider(settings)
  const meta = AI_PROVIDERS.find((m) => m.id === provider)
  const model = settings.providers?.[provider]?.model?.trim() || meta?.defaultModel || ''
  if (provider === 'custom' && settings.customEndpoint) {
    return { provider, endpoint: settings.customEndpoint, model }
  }
  return { provider, model }
}

export function withAiModelSelection(input: AiSettings, pick: AiModelPickerSelection): AiSettings {
  const settings = resolveCustomEndpoints(input)
  if (pick.provider === 'custom' && pick.endpoint) {
    const ep = settings.customEndpoints?.find((e) => e.id === pick.endpoint)
    if (ep) {
      return {
        ...upsertCustomEndpoint(settings, { ...ep, model: pick.model }, true),
        provider: 'custom',
      }
    }
  }
  const config = settings.providers[pick.provider] ?? { apiKey: '', model: '' }
  return {
    ...settings,
    provider: pick.provider,
    providers: { ...settings.providers, [pick.provider]: { ...config, model: pick.model } },
  }
}

/** One block of the composer chip's list under the subscription contract */
export interface AiProviderPickerGroup {
  /** `auto`: the "automatic" entry; `subscription`: a vendor CLI login; `key`: an API-key provider */
  readonly kind: 'auto' | 'subscription' | 'key'
  readonly id: AiProviderSelection
  /** set on custom groups: one group per saved endpoint */
  readonly endpoint?: string | undefined
  /** the provider's name; on `auto`, the name of the provider it resolves to */
  readonly label: string
  /** selectable models; '' is the CLI's own default. Empty on `auto`, which is a single entry */
  readonly models: readonly string[]
  /** an accepted metered login: listed, but marked as costing money */
  readonly metered: boolean
  /** `auto` only: the provider requests run on right now */
  readonly resolved?: AiProviderId | undefined
}

export interface AiProviderPickerSelection {
  readonly provider: AiProviderSelection
  readonly endpoint?: string | undefined
  readonly model: string
}

export interface AiProviderPickerCurrent extends AiProviderPickerSelection {
  /** the provider requests run on right now; absent while none can */
  readonly resolved?: AiProviderId | undefined
  /** that provider is an accepted metered login */
  readonly metered: boolean
}

/**
 * What the composer chip may switch to under the subscription contract, in
 * display order: the automatic entry while it resolves to a subscription, the
 * subscription providers that can run (a ready login, or a metered one the
 * user accepted — marked as paid), then every key provider whose settings are
 * filled in. Each entry passes `selectAiProvider` once picked, so a row never
 * lands on the not-connected prompt.
 */
export function aiProviderPickerGroups(
  input: AiSettings,
  statuses: AiSubscriptionStatuses,
): AiProviderPickerGroup[] {
  const settings = resolveCustomEndpoints(input)
  const groups: AiProviderPickerGroup[] = []
  const auto = selectAiProvider({ ...settings, provider: 'auto' }, statuses)
  if (auto.connected) {
    groups.push({
      kind: 'auto',
      id: 'auto',
      label: aiProviderDisplayName(auto.provider),
      models: [],
      metered: false,
      resolved: auto.provider,
    })
  }
  for (const id of AI_SUBSCRIPTION_PROVIDERS) {
    const connection = subscriptionConnection(settings, statuses[id])
    if (!connection) continue
    const catalog = AI_PROVIDERS.find((m) => m.id === id)?.models ?? []
    const stored = settings.providers?.[id]?.model?.trim() ?? ''
    groups.push({
      kind: 'subscription',
      id,
      label: aiSubscriptionProviderName(id),
      models: ['', ...(stored && !catalog.includes(stored) ? [stored] : []), ...catalog],
      metered: connection === 'metered',
    })
  }
  for (const meta of AI_PROVIDERS) {
    if (isSubscriptionProvider(meta.id)) continue
    if (meta.id === 'custom') {
      for (const ep of settings.customEndpoints ?? []) {
        if (!ep.baseUrl || !ep.model) continue
        const models = [ep.model, ...(ep.models ?? []).filter((m) => m !== ep.model)]
        groups.push({
          kind: 'key',
          id: meta.id,
          endpoint: ep.id,
          label: customEndpointLabel(ep, meta.label),
          models,
          metered: false,
        })
      }
      continue
    }
    if (!isKeyProviderConfigured(settings, meta.id)) continue
    const stored = settings.providers[meta.id].model.trim()
    const models = meta.models.includes(stored) ? meta.models : [stored, ...meta.models]
    groups.push({ kind: 'key', id: meta.id, label: meta.label, models, metered: false })
  }
  return groups
}

/** The stored selection and what it runs on right now */
export function aiProviderPickerSelection(
  input: AiSettings,
  statuses: AiSubscriptionStatuses,
): AiProviderPickerCurrent {
  const settings = resolveCustomEndpoints(input)
  const provider = providerSelectionOf(settings)
  const choice = selectAiProvider(settings, statuses)
  const resolved = choice.connected ? choice.provider : undefined
  const target = provider === 'auto' ? resolved : provider
  const model = (target && settings.providers?.[target]?.model?.trim()) || ''
  return {
    provider,
    ...(provider === 'custom' && settings.customEndpoint
      ? { endpoint: settings.customEndpoint }
      : {}),
    model,
    resolved,
    metered: choice.connected && choice.metered,
  }
}

/** Settings after picking an entry: the provider selection and, for a provider, its model */
export function withAiProviderSelection(
  input: AiSettings,
  pick: AiProviderPickerSelection,
): AiSettings {
  if (pick.provider === 'auto') return { ...input, provider: 'auto' }
  return withAiModelSelection(input, {
    provider: pick.provider,
    endpoint: pick.endpoint,
    model: pick.model,
  })
}
