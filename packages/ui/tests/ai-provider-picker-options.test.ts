import { describe, expect, it } from 'vitest'
import {
  AI_PROVIDERS,
  defaultAiSettings,
  selectAiProvider,
  type AiSettings,
  type AiSubscriptionProviderId,
  type AiSubscriptionState,
  type AiSubscriptionStatus,
  type AiSubscriptionStatuses,
} from '@genoffice/ai-provider'
import {
  aiProviderPickerGroups,
  aiProviderPickerSelection,
  withAiProviderSelection,
} from '../src/ai-model-picker-options'

const status = (
  provider: AiSubscriptionProviderId,
  state: AiSubscriptionState,
  extra: Partial<AiSubscriptionStatus> = {},
): AiSubscriptionStatus => ({ provider, state, meteredAccepted: false, ...extra })

const ready: AiSubscriptionStatuses = {
  'claude-code': status('claude-code', 'ready'),
  codex: status('codex', 'ready'),
}

const anthropicModels = AI_PROVIDERS.find((m) => m.id === 'anthropic')!.models
const claudeModels = AI_PROVIDERS.find((m) => m.id === 'claude-code')!.models

function withAnthropicKey(settings: AiSettings = defaultAiSettings()): AiSettings {
  settings.providers.anthropic = { apiKey: 'k', model: anthropicModels[0]! }
  return settings
}

/** a metered login counts as accepted only with both the stored flag and the status flag */
function acceptedMetered(provider: AiSubscriptionProviderId): {
  settings: AiSettings
  status: AiSubscriptionStatus
} {
  const settings = defaultAiSettings()
  settings.meteredAccepted = { [provider]: true }
  return { settings, status: status(provider, 'metered', { meteredAccepted: true }) }
}

describe('aiProviderPickerGroups', () => {
  it('lists nothing while no subscription is connected and no key is filled in', () => {
    expect(aiProviderPickerGroups(defaultAiSettings(), {})).toEqual([])
    expect(
      aiProviderPickerGroups(defaultAiSettings(), {
        'claude-code': status('claude-code', 'signed-out'),
        codex: status('codex', 'not-installed'),
      }),
    ).toEqual([])
  })

  it('puts the automatic entry and the subscriptions before the key providers', () => {
    const groups = aiProviderPickerGroups(withAnthropicKey(), ready)
    expect(groups.map((g) => [g.kind, g.id])).toEqual([
      ['auto', 'auto'],
      ['subscription', 'claude-code'],
      ['subscription', 'codex'],
      ['key', 'anthropic'],
    ])
  })

  it('names subscriptions in plain text and offers the CLI default before the catalog', () => {
    const groups = aiProviderPickerGroups(defaultAiSettings(), ready)
    expect(groups.find((g) => g.id === 'claude-code')).toEqual({
      kind: 'subscription',
      id: 'claude-code',
      label: 'Claude',
      models: ['', ...claudeModels],
      metered: false,
    })
    expect(groups.find((g) => g.id === 'codex')).toEqual({
      kind: 'subscription',
      id: 'codex',
      label: 'Codex',
      models: [''],
      metered: false,
    })
  })

  it('keeps a stored model that is not in the catalog selectable', () => {
    const settings = defaultAiSettings()
    settings.providers.codex = { apiKey: '', model: 'gpt-next', cliPath: '' }
    const codex = aiProviderPickerGroups(settings, ready).find((g) => g.id === 'codex')!
    expect(codex.models).toEqual(['', 'gpt-next'])
  })

  it('lists a key provider only once its settings are filled in', () => {
    const settings = defaultAiSettings()
    expect(aiProviderPickerGroups(settings, ready).some((g) => g.kind === 'key')).toBe(false)
    // a key without a model, and a model without a key, are both unfinished
    settings.providers.anthropic = { apiKey: 'k', model: '' }
    settings.providers.openai = { apiKey: '', model: 'gpt-x' }
    expect(aiProviderPickerGroups(settings, ready).some((g) => g.kind === 'key')).toBe(false)
    settings.providers.anthropic = { apiKey: 'k', model: 'claude-next' }
    const key = aiProviderPickerGroups(settings, ready).filter((g) => g.kind === 'key')
    expect(key.map((g) => g.id)).toEqual(['anthropic'])
    expect(key[0]!.models).toEqual(['claude-next', ...anthropicModels])
    expect(key[0]!.metered).toBe(false)
  })

  it('never lists a provider config stored under an id this build does not know', () => {
    const settings = defaultAiSettings()
    const stored = settings.providers as Record<string, { apiKey: string; model: string }>
    stored['retired-provider'] = { apiKey: 'k', model: 'claude-opus-5-5' }
    const ids: string[] = aiProviderPickerGroups(settings, ready).map((g) => g.id)
    expect(ids).not.toContain('retired-provider')
  })

  it('lists an accepted metered login with a cost marker', () => {
    const { settings, status: claude } = acceptedMetered('claude-code')
    const groups = aiProviderPickerGroups(settings, { 'claude-code': claude })
    expect(groups.map((g) => [g.kind, g.id, g.metered])).toEqual([
      ['subscription', 'claude-code', true],
    ])
  })

  it('leaves a metered login out until the user accepted it', () => {
    const metered = { 'claude-code': status('claude-code', 'metered') }
    expect(aiProviderPickerGroups(defaultAiSettings(), metered)).toEqual([])
    // the stored flag alone is not enough: the status must carry it too
    const stale = defaultAiSettings()
    stale.meteredAccepted = { 'claude-code': true }
    expect(aiProviderPickerGroups(stale, metered)).toEqual([])
    // and neither is the status flag without the stored one
    expect(
      aiProviderPickerGroups(defaultAiSettings(), {
        'claude-code': status('claude-code', 'metered', { meteredAccepted: true }),
      }),
    ).toEqual([])
  })

  describe('the automatic entry', () => {
    const autoOf = (settings: AiSettings, statuses: AiSubscriptionStatuses) =>
      aiProviderPickerGroups(settings, statuses).find((g) => g.kind === 'auto')

    it('resolves to Claude while both subscriptions are ready', () => {
      expect(autoOf(defaultAiSettings(), ready)).toEqual({
        kind: 'auto',
        id: 'auto',
        label: 'Claude',
        models: [],
        metered: false,
        resolved: 'claude-code',
      })
    })

    it('resolves to Codex when Claude is not ready', () => {
      const auto = autoOf(defaultAiSettings(), {
        'claude-code': status('claude-code', 'signed-out'),
        codex: status('codex', 'ready'),
      })
      expect(auto?.resolved).toBe('codex')
      expect(auto?.label).toBe('Codex')
    })

    it('skips an accepted metered Claude for a ready Codex', () => {
      const { settings, status: claude } = acceptedMetered('claude-code')
      const statuses = { 'claude-code': claude, codex: status('codex', 'ready') }
      expect(autoOf(settings, statuses)?.resolved).toBe('codex')
      // the metered login stays selectable on its own, marked as paid
      const groups = aiProviderPickerGroups(settings, statuses)
      expect(groups.find((g) => g.id === 'claude-code')?.metered).toBe(true)
    })

    it('is absent while it would resolve to nothing', () => {
      // key providers and metered logins are never automatic candidates
      const { settings, status: claude } = acceptedMetered('claude-code')
      expect(autoOf(withAnthropicKey(settings), { 'claude-code': claude })).toBeUndefined()
      expect(autoOf(withAnthropicKey(), {})).toBeUndefined()
    })

    it('reflects the stored selection, not the entry the user is on', () => {
      const settings = withAnthropicKey()
      settings.provider = 'anthropic'
      expect(autoOf(settings, ready)?.resolved).toBe('claude-code')
    })
  })

  it('lists nothing that selectAiProvider would refuse', () => {
    const { settings, status: claude } = acceptedMetered('claude-code')
    withAnthropicKey(settings)
    settings.providers.openai = { apiKey: '', model: 'gpt-x' }
    settings.providers.gemini = { apiKey: 'k', model: '' }
    settings.customEndpoints = [
      {
        id: 'a',
        name: 'Ollama',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: '',
        model: 'llama3',
      },
      { id: 'c', name: 'Empty', baseUrl: '', apiKey: '', model: 'm' },
    ]
    const fixtures: AiSubscriptionStatuses[] = [
      {},
      ready,
      { 'claude-code': claude, codex: status('codex', 'ready') },
      { 'claude-code': claude, codex: status('codex', 'metered') },
      { 'claude-code': status('claude-code', 'error', { error: 'boom' }) },
      { 'claude-code': status('claude-code', 'checking'), codex: status('codex', 'signed-out') },
    ]
    for (const statuses of fixtures) {
      const groups = aiProviderPickerGroups(settings, statuses)
      expect(groups.length).toBeGreaterThan(0)
      for (const group of groups) {
        for (const model of group.models.length > 0 ? group.models : ['']) {
          const next = withAiProviderSelection(settings, {
            provider: group.id,
            endpoint: group.endpoint,
            model,
          })
          const choice = selectAiProvider(next, statuses)
          expect(choice.connected, `${group.id}:${model}`).toBe(true)
          if (choice.connected) expect(choice.metered, group.id).toBe(group.metered)
        }
      }
    }
  })
})

describe('selection under the subscription contract', () => {
  it('reads the automatic selection and what it runs on', () => {
    const settings = defaultAiSettings()
    settings.providers['claude-code'] = { apiKey: '', model: 'sonnet' }
    expect(aiProviderPickerSelection(settings, ready)).toEqual({
      provider: 'auto',
      model: 'sonnet',
      resolved: 'claude-code',
      metered: false,
    })
    expect(aiProviderPickerSelection(settings, {})).toEqual({
      provider: 'auto',
      model: '',
      resolved: undefined,
      metered: false,
    })
  })

  it('reads an unknown provider id as the automatic selection', () => {
    const settings = { ...defaultAiSettings(), provider: 'retired-provider' as never }
    expect(aiProviderPickerSelection(settings, ready).provider).toBe('auto')
  })

  it('picking a subscription model stores the provider and the model', () => {
    const start = defaultAiSettings()
    const next = withAiProviderSelection(start, { provider: 'codex', model: 'gpt-next' })
    expect(next.provider).toBe('codex')
    expect(next.providers.codex.model).toBe('gpt-next')
    expect(aiProviderPickerSelection(next, ready)).toEqual({
      provider: 'codex',
      model: 'gpt-next',
      resolved: 'codex',
      metered: false,
    })
    // the input is not mutated
    expect(start.provider).toBe('auto')
    expect(start.providers.codex.model).toBe('')
  })

  it('picking the automatic entry only changes the selection', () => {
    const start = withAiProviderSelection(defaultAiSettings(), {
      provider: 'codex',
      model: 'gpt-next',
    })
    const next = withAiProviderSelection(start, { provider: 'auto', model: '' })
    expect(next.provider).toBe('auto')
    expect(next.providers.codex.model).toBe('gpt-next')
  })

  it('marks an accepted metered selection as paid and keeps a blocked one unresolved', () => {
    const { settings, status: claude } = acceptedMetered('claude-code')
    const picked = withAiProviderSelection(settings, { provider: 'claude-code', model: 'opus' })
    expect(aiProviderPickerSelection(picked, { 'claude-code': claude })).toEqual({
      provider: 'claude-code',
      model: 'opus',
      resolved: 'claude-code',
      metered: true,
    })
    // a selection that cannot run is reported as it is, never replaced by another provider
    const blocked = aiProviderPickerSelection(picked, {
      'claude-code': status('claude-code', 'signed-out'),
      codex: status('codex', 'ready'),
    })
    expect(blocked.provider).toBe('claude-code')
    expect(blocked.resolved).toBeUndefined()
  })

  it('picking a model on a saved custom endpoint activates that endpoint', () => {
    const settings: AiSettings = {
      ...defaultAiSettings(),
      customEndpoints: [
        { id: 'a', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'm1' },
        { id: 'b', name: '', baseUrl: 'https://gw.example.com/v1', apiKey: 'k', model: 'm2' },
      ],
      customEndpoint: 'a',
    }
    const next = withAiProviderSelection(settings, {
      provider: 'custom',
      endpoint: 'b',
      model: 'm2',
    })
    expect(aiProviderPickerSelection(next, {})).toEqual({
      provider: 'custom',
      endpoint: 'b',
      model: 'm2',
      resolved: 'custom',
      metered: false,
    })
  })
})
