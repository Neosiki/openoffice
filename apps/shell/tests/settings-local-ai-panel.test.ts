/**
 * @vitest-environment jsdom
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_MEDIA_PROVIDERS,
  AI_PROVIDERS,
  AI_SEARCH_PROVIDERS,
  defaultAiSettings,
} from '@genoffice/ai-provider'
import type { AiCustomEndpoint, AiSettings } from '@genoffice/ai-provider/browser'
import type { HomeApi } from '../src/shared/home-api'
import type { SubscriptionApi } from '../src/shared/subscription-api'
import { LocaleProvider } from '../src/renderer/src/locale'
import { SettingsModal, withAdvancedCustomSave } from '../src/renderer/src/SettingsModal'

/**
 * The local AI card in Settings → AI. It lays out what local-ai.ts decides:
 * servers, model lists with what is known and unknown, model profiles, the
 * four-row connection test, and saving that never changes the AI in use.
 */

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
let stored: AiSettings
let settingsListeners: Array<() => void>
let setAiSettings: ReturnType<typeof vi.fn<(settings: AiSettings) => Promise<void>>>
let getLocalModels: ReturnType<typeof vi.fn>
let inspectLocalModel: ReturnType<typeof vi.fn>
let testLocalModel: ReturnType<typeof vi.fn>
let unhandled: unknown[]
const onUnhandled = (reason: unknown) => unhandled.push(reason)

const LOCAL_A: AiCustomEndpoint = {
  id: 'local-a',
  name: 'Ollama',
  baseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: '',
  model: 'qwen3:8b',
  models: ['qwen3:8b', 'llama3'],
  kind: 'local',
  modelProfiles: {
    'qwen3:8b': {
      contextLength: 32_768,
      contextSource: 'server',
      tools: true,
      toolsSource: 'server',
      vision: true,
      visionSource: 'server',
    },
  },
  timeoutMs: 300_000,
}

const LOCAL_B: AiCustomEndpoint = {
  id: 'local-b',
  name: 'LM Studio',
  baseUrl: 'http://127.0.0.1:1234/v1',
  apiKey: '',
  model: 'qwen2.5:7b',
  models: ['qwen2.5:7b'],
  kind: 'local',
  timeoutMs: 120_000,
}

function settingsWith(patch: Partial<AiSettings> = {}): AiSettings {
  return { ...defaultAiSettings(), ...patch }
}

function install(
  settings: AiSettings,
  handlers: Partial<
    Record<'getLocalModels' | 'inspectLocalModel' | 'testLocalModel', unknown>
  > = {},
): void {
  stored = settings
  settingsListeners = []
  setAiSettings = vi.fn(async (next: AiSettings) => {
    stored = next
    for (const listener of settingsListeners) listener()
  })
  getLocalModels = vi.fn(async () => ({ ok: true, server: 'ollama', models: [] }))
  inspectLocalModel = vi.fn(async () => ({ ok: true, profile: {} }))
  testLocalModel = vi.fn(async () => ({
    server: { status: 'pass' },
    model: { status: 'pass' },
    chat: { status: 'pass' },
    tools: { status: 'pass' },
    checkedAt: Date.now(),
    elapsedMs: 12,
  }))
  window.aiOffice = {
    getTheme: async () => 'system',
    getDefaultSaveDir: async () => '',
    getAutoSaveDefault: async () => ({ on: false, updatedAt: 0 }),
    getAiPanelPrefs: async () => ({ fontSize: 'default', customFontSize: 14, spellcheck: true }),
    getUpdateChannel: async () => 'stable',
    getAppVersion: async () => '1.0.0',
    getAiProviders: () => AI_PROVIDERS.map((meta) => ({ ...meta, defaultBaseUrl: '' })),
    getAiMediaProviders: () => AI_MEDIA_PROVIDERS,
    getAiSearchProviders: () => AI_SEARCH_PROVIDERS,
    getAiSettings: async () => stored,
    setAiSettings,
    onAiSettingsChanged: (handler: () => void) => {
      settingsListeners.push(handler)
      return () => {
        settingsListeners = settingsListeners.filter((listener) => listener !== handler)
      }
    },
    getCodexModels: async () => ({ models: [], defaultModel: '' }),
    getFileSearchSettings: async () => null,
    getLocalModels,
    inspectLocalModel,
    testLocalModel,
    ...handlers,
  } as unknown as HomeApi
  const checking = {
    'claude-code': {
      provider: 'claude-code',
      state: 'checking',
      meteredAccepted: false,
    },
    codex: { provider: 'codex', state: 'checking', meteredAccepted: false },
  }
  window.aiOfficeSubscription = {
    statuses: async () => checking,
    recheck: async () => checking,
    login: async () => ({ ok: true }),
    logout: async () => ({ ok: true }),
    install: async () => ({ ok: true }),
    setMeteredAccepted: async () => ({ ok: true, statuses: checking }),
    codexImageAvailable: async () => false,
    onChanged: () => () => undefined,
    openInstallHelp: async () => undefined,
  } as unknown as SubscriptionApi
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  unhandled = []
  process.on('unhandledRejection', onUnhandled)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  process.off('unhandledRejection', onUnhandled)
  delete window.aiOfficeSubscription
})

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve()
  })
}

async function openAi(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        LocaleProvider,
        { initial: 'en' },
        createElement(SettingsModal, { onClose: vi.fn(), target: { section: 'aiModel' } }),
      ),
    )
    await Promise.resolve()
  })
  await flush()
}

async function click(el: Element | null | undefined): Promise<void> {
  expect(el).toBeTruthy()
  await act(async () => {
    ;(el as HTMLElement).click()
    await Promise.resolve()
  })
  await flush()
}

function button(text: string, scope: ParentNode = host): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  )
}

function input(id: string): HTMLInputElement {
  return host.querySelector<HTMLInputElement>(`#${id}`)!
}

async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )!.set!
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
  await flush()
}

async function choose(el: HTMLSelectElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
  })
  await flush()
}

async function pick(label: string, option: string): Promise<void> {
  const trigger = host.querySelector<HTMLButtonElement>(`.gs-dd-btn[aria-label="${label}"]`)
  await click(trigger)
  const target = [...host.querySelectorAll<HTMLButtonElement>('.gs-dd-pop [role="option"]')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent) === option,
  )
  await click(target)
}

async function openServer(id = 'local-a'): Promise<void> {
  await click(host.querySelector(`[data-local-server="${id}"] .set-local-server-main`))
}

async function pickModel(id = 'qwen3:8b'): Promise<void> {
  await click(host.querySelector(`[data-local-model="${id}"]`))
}

function settle(): Promise<void> {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

describe('the local AI card', () => {
  it('shows the empty state and where it sits: after the free cards, before "AI to use"', async () => {
    install(settingsWith())
    await openAi()
    expect(host.textContent).toContain('No local server is registered yet')
    expect(button('Add server')).toBeTruthy()
    const card = host.querySelector('[data-local-ai]')!
    const free = host.querySelector('.free-ai-title')!
    const use = host.querySelector('.set-field[data-ai-use]')
    expect(card).toBeTruthy()
    expect(free.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    if (use) {
      expect(card.compareDocumentPosition(use) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    // opening the card alone sends nothing
    expect(getLocalModels).not.toHaveBeenCalled()
    expect(setAiSettings).not.toHaveBeenCalled()
  })

  it('adds a server with the preset name and address, and keeps typed values', async () => {
    install(settingsWith())
    await openAi()
    await click(button('Add server'))
    expect(input('set-local-name').value).toBe('Ollama')
    expect(input('set-local-address').value).toBe('http://127.0.0.1:11434/v1')

    await click(button('LM Studio'))
    expect(input('set-local-name').value).toBe('LM Studio')
    expect(input('set-local-address').value).toBe('http://127.0.0.1:1234/v1')

    await type(input('set-local-name'), 'My box')
    await click(button('vLLM'))
    expect(input('set-local-name').value).toBe('My box')
    expect(input('set-local-address').value).toBe('http://127.0.0.1:8000/v1')
    expect(getLocalModels).not.toHaveBeenCalled()
  })

  it('lists the saved servers, their status, model count and the one in use', async () => {
    install(
      settingsWith({
        provider: 'custom',
        customEndpoints: [LOCAL_A, LOCAL_B],
        customEndpoint: 'local-a',
      }),
    )
    await openAi()
    const row = host.querySelector('[data-local-server="local-a"]')!
    expect(row.textContent).toContain('Ollama')
    expect(row.textContent).toContain('http://127.0.0.1:11434/v1')
    expect(row.textContent).toContain('Not checked')
    expect(row.textContent).toContain('2 models')
    expect(row.textContent).toContain('In use')
    expect(host.querySelector('[data-local-server="local-b"]')?.textContent).toContain('1 model')

    // selecting a server asks the network nothing
    await openServer()
    expect(getLocalModels).not.toHaveBeenCalled()
    expect(testLocalModel).not.toHaveBeenCalled()
    expect(inspectLocalModel).not.toHaveBeenCalled()
  })

  it('shows the model list with what is known and marks unknown values as needing a check', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }))
    await openAi()
    await openServer()
    const models = [...host.querySelectorAll<HTMLElement>('[data-local-model]')]
    expect(models.map((el) => el.dataset.localModel)).toEqual(['qwen3:8b', 'llama3'])
    const first = models[0]!
    expect(first.textContent).toContain('qwen3:8b')
    expect(first.textContent).toContain('32768')
    expect(first.textContent).toContain('Supported')
    // llama3 has no profile: tools and vision are unknown, not false
    expect(models[1]!.textContent).toContain('Needs checking')
    expect(models[1]!.textContent).not.toContain('Not supported')
  })

  it('accepts a manually typed model id when the list is empty', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }))
    await openAi()
    await openServer()
    await type(input('set-local-model'), 'manual-model')
    expect(input('set-local-model').value).toBe('manual-model')
    expect(host.querySelector('[data-local-profile]')?.textContent).toContain('manual-model')
  })

  it('edits the profile tri-state and shows where each value came from', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }))
    await openAi()
    await openServer()
    await pickModel()
    const tools = host.querySelector<HTMLSelectElement>('select[data-local-profile-tools]')!
    expect(tools.value).toBe('true')
    expect(host.querySelector('[data-local-source-tools]')?.textContent).toBe('Server')

    await choose(tools, 'false')
    expect(host.querySelector('[data-local-source-tools]')?.textContent).toBe('User')
    expect(host.textContent).toContain('This model does not edit documents directly')

    const vision = host.querySelector<HTMLSelectElement>('select[data-local-profile-vision]')!
    await choose(vision, 'false')
    expect(host.querySelector('[data-local-source-vision]')?.textContent).toBe('User')
    expect(host.textContent).toContain('Image input is not supported')
    expect(host.textContent).toContain('Attaching images may fail')

    // the context field records the user as the source
    await type(input('set-local-context'), '8192')
    expect(host.querySelector('[data-local-source-context]')?.textContent).toBe('User')
  })

  it('shows the four test rows, treats no tool call as unconfirmed, and saves nothing', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }))
    testLocalModel.mockResolvedValue({
      server: { status: 'pass' },
      model: { status: 'pass' },
      chat: { status: 'pass' },
      tools: { status: 'fail', code: 'no-tool-call' },
      checkedAt: 1_700_000_000_000,
      elapsedMs: 34,
      models: [{ id: 'qwen3:8b' }, { id: 'mistral' }],
    })
    await openAi()
    await openServer()
    await click(button('Test connection'))

    const rows = [...host.querySelectorAll<HTMLElement>('[data-local-test-check]')]
    expect(rows.map((el) => el.dataset.localTestCheck)).toEqual([
      'server',
      'model',
      'chat',
      'tools',
    ])
    expect(rows.map((el) => el.dataset.state)).toEqual(['pass', 'pass', 'pass', 'unconfirmed'])
    expect(rows[3]!.textContent).toContain('Not confirmed')
    expect(host.textContent).toContain('No tool call was seen')
    expect(host.querySelector('[data-local-model="mistral"]')).toBeTruthy()
    // a test on the unsaved draft writes no settings
    expect(setAiSettings).not.toHaveBeenCalled()
  })

  it('reports invalid test input as an invalid-input answer, not a connection failure', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }))
    testLocalModel.mockResolvedValue({
      server: { status: 'skip' },
      model: { status: 'skip' },
      chat: { status: 'skip' },
      tools: { status: 'skip' },
      checkedAt: 1,
      elapsedMs: 0,
      inputError: 'shape',
    })
    await openAi()
    await openServer()
    await click(button('Test connection'))
    expect(host.textContent).toContain('The input was not valid')
    expect(host.querySelectorAll('[data-local-test-check][data-state="skip"]')).toHaveLength(4)
  })

  it('saves a server without changing the AI or the active server', async () => {
    install(
      settingsWith({
        provider: 'custom',
        customEndpoints: [LOCAL_A],
        customEndpoint: 'local-a',
      }),
    )
    await openAi()
    await click(button('Add server'))
    await type(input('set-local-name'), 'Lab')
    await type(input('set-local-address'), 'http://127.0.0.1:9000/v1')
    await type(input('set-local-model'), 'lab-model')
    await click(button('Save'))

    expect(stored.provider).toBe('custom')
    expect(stored.customEndpoint).toBe('local-a')
    expect(stored.customEndpoints).toHaveLength(2)
    const added = stored.customEndpoints!.find((entry) => entry.name === 'Lab')!
    expect(added).toMatchObject({ model: 'lab-model', kind: 'local' })
  })

  it('deletes the active server only after a confirmation and selects no other one', async () => {
    install(
      settingsWith({
        provider: 'custom',
        customEndpoints: [LOCAL_A, LOCAL_B],
        customEndpoint: 'local-a',
      }),
    )
    await openAi()
    await openServer('local-a')
    await click(button('Delete'))
    const dialog = host.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('This server is in use')
    // nothing removed until confirmed
    expect(stored.customEndpoints).toHaveLength(2)

    await click(button('Delete', dialog!))
    expect(stored.provider).toBe('custom')
    expect(stored.customEndpoint).toBe('')
    expect(stored.customEndpoints?.map((entry) => entry.id)).toEqual(['local-b'])
    expect(host.textContent).toContain('Not connected')
  })

  it('keeps the persisted model list as "last checked" when the server is offline', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }))
    getLocalModels.mockResolvedValue({ ok: false, errorCode: 'unreachable' })
    await openAi()
    await openServer()
    await click(button('Refresh model list'))

    const row = host.querySelector('[data-local-server="local-a"]')!
    expect(row.dataset.state).toBe('offline')
    expect(row.textContent).toContain('Offline')
    expect(row.textContent).toContain('Last checked')
    expect(host.querySelector('[data-local-model="qwen3:8b"]')).toBeTruthy()
    expect(setAiSettings).not.toHaveBeenCalled()
  })

  it('says "Cannot be used" when the bridge is missing, and keeps the saved servers', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }), {
      getLocalModels: undefined,
      inspectLocalModel: undefined,
      testLocalModel: undefined,
    })
    await openAi()
    expect(host.textContent).toContain('Cannot be used')
    expect(host.querySelector('[data-local-server="local-a"]')?.textContent).toContain('Ollama')
    await openServer()
    expect(input('set-local-name').value).toBe('Ollama')
    await click(button('Refresh model list'))
    await click(button('Test connection'))
    await settle()
    expect(unhandled).toEqual([])
  })

  it('keeps the saved data when a handler answers with a broken shape', async () => {
    install(settingsWith({ customEndpoints: [LOCAL_A], customEndpoint: 'local-a' }))
    getLocalModels.mockResolvedValue('not a result')
    await openAi()
    await openServer()
    await click(button('Refresh model list'))
    expect(host.textContent).toContain('Cannot be used')
    expect(host.querySelector('[data-local-server="local-a"]')?.textContent).toContain('Ollama')
    expect(host.querySelector('[data-local-model="qwen3:8b"]')).toBeTruthy()
    await settle()
    expect(unhandled).toEqual([])
  })

  it('checks a model profile on the server and keeps user values', async () => {
    const userProfile = {
      ...LOCAL_A,
      modelProfiles: {
        'qwen3:8b': {
          tools: true,
          toolsSource: 'user' as const,
          vision: false,
          visionSource: 'user' as const,
        },
      },
    }
    install(settingsWith({ customEndpoints: [userProfile], customEndpoint: 'local-a' }))
    inspectLocalModel.mockResolvedValue({
      ok: true,
      profile: { contextLength: 131_072, runningContextLength: 8_192, tools: false, vision: true },
    })
    await openAi()
    await openServer()
    await click(button('Check on server again'))

    expect(inspectLocalModel).toHaveBeenCalledWith({
      baseUrl: LOCAL_A.baseUrl,
      model: 'qwen3:8b',
      server: 'ollama',
    })
    // user values win; context had no user value, so the server fills it
    expect(host.querySelector<HTMLSelectElement>('select[data-local-profile-tools]')!.value).toBe(
      'true',
    )
    expect(host.querySelector<HTMLSelectElement>('select[data-local-profile-vision]')!.value).toBe(
      'false',
    )
    expect(input('set-local-context').value).toBe('8192')
    expect(host.querySelector('[data-local-source-context]')?.textContent).toBe('Server')
    // inspection does not save on its own
    expect(setAiSettings).not.toHaveBeenCalled()
  })
})

describe('the Advanced Custom save', () => {
  it('keeps the latest model, the other endpoints and the local-only fields', () => {
    const latest: AiSettings = settingsWith({
      customEndpoints: [{ ...LOCAL_A, model: 'latest-model' }, LOCAL_B],
      customEndpoint: 'local-b',
    })
    const draft: AiSettings = settingsWith({
      customEndpoints: [{ ...LOCAL_A, name: 'Renamed', model: 'loaded-model' }],
      customEndpoint: 'local-a',
    })
    const edited = { ...LOCAL_A, name: 'Renamed', model: 'loaded-model' }
    const next = withAdvancedCustomSave(draft, latest, edited, 'loaded-model', [])

    expect(next.customEndpoints?.map((entry) => entry.id)).toEqual(['local-a', 'local-b'])
    const kept = next.customEndpoints!.find((entry) => entry.id === 'local-a')!
    expect(kept).toMatchObject({
      name: 'Renamed',
      // the form did not change the model: the latest file wins
      model: 'latest-model',
      kind: 'local',
      modelProfiles: LOCAL_A.modelProfiles,
      timeoutMs: 300_000,
    })
    expect(next.customEndpoint).toBe('local-b')
    expect(next.provider).toBe('auto')
  })

  it('uses the model the form changed and applies deletions from the pane', () => {
    const latest: AiSettings = settingsWith({
      customEndpoints: [LOCAL_A, LOCAL_B],
      customEndpoint: 'local-a',
    })
    const draft: AiSettings = settingsWith({
      customEndpoints: [{ ...LOCAL_A, model: 'typed-model' }],
      customEndpoint: 'local-a',
    })
    const next = withAdvancedCustomSave(
      draft,
      latest,
      { ...LOCAL_A, model: 'typed-model' },
      LOCAL_A.model,
      ['local-b'],
    )
    expect(next.customEndpoints?.map((entry) => entry.id)).toEqual(['local-a'])
    expect(next.customEndpoints![0]!.model).toBe('typed-model')
  })

  it('writes through the pane without dropping an endpoint added while it was open', async () => {
    install(
      settingsWith({
        provider: 'auto',
        customEndpoints: [LOCAL_A],
        customEndpoint: 'local-a',
      }),
    )
    await openAi()
    await click(host.querySelector('.set-adv-toggle'))
    await pick('Provider', 'Custom')
    const name = host.querySelector<HTMLInputElement>('#set-ai-endpoint-name')!
    expect(name.value).toBe('Ollama')
    await type(name, 'Renamed')

    // another window saves a server and changes the model this pane is not editing
    const added: AiCustomEndpoint = {
      id: 'local-c',
      name: 'Lab',
      baseUrl: 'http://127.0.0.1:9000/v1',
      apiKey: '',
      model: 'lab-model',
      kind: 'local',
      timeoutMs: 120_000,
    }
    stored = {
      ...stored,
      customEndpoints: [{ ...LOCAL_A, model: 'latest-model' }, LOCAL_B, added],
      customEndpoint: 'local-a',
    }
    await click(button('Save'))

    expect(stored.customEndpoints?.map((entry) => entry.id)).toEqual([
      'local-a',
      'local-b',
      'local-c',
    ])
    const kept = stored.customEndpoints!.find((entry) => entry.id === 'local-a')!
    expect(kept).toMatchObject({
      name: 'Renamed',
      model: 'latest-model',
      kind: 'local',
      modelProfiles: LOCAL_A.modelProfiles,
      timeoutMs: 300_000,
    })
    expect(stored.provider).toBe('auto')
  })
})
