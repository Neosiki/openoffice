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
import type {
  AiSettings,
  AiSubscriptionProviderId,
  AiSubscriptionStatus,
  SubscriptionStatusMap,
} from '@genoffice/ai-provider'
import type { HomeApi } from '../src/shared/home-api'
import type { SubscriptionApi } from '../src/shared/subscription-api'
import { LocaleProvider } from '../src/renderer/src/locale'
import { SettingsModal } from '../src/renderer/src/SettingsModal'
import type { SettingsTarget } from '../src/renderer/src/SettingsModal'

/**
 * The AI part of the settings dialog, in the real modal: the subscription
 * connection is what shows, everything that takes a key sits under Advanced,
 * and what gets saved carries nothing of the removed provider.
 */

const HEADLESS_WARNING =
  'Neither company recommends letting a program use your subscription automatically, and your account may be restricted.'

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
/** what the settings file holds; `ai:set-settings` replaces it */
let stored: AiSettings
let setAiSettings: ReturnType<typeof vi.fn<(settings: AiSettings) => Promise<void>>>
let settingsListeners: Array<() => void>
let unhandled: unknown[]
const onUnhandled = (reason: unknown) => unhandled.push(reason)

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  settingsListeners = []
  unhandled = []
  process.on('unhandledRejection', onUnhandled)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  process.off('unhandledRejection', onUnhandled)
  delete window.aiOfficeSubscription
})

function status(
  provider: AiSubscriptionProviderId,
  state: AiSubscriptionStatus['state'],
  extra: Partial<AiSubscriptionStatus> = {},
): AiSubscriptionStatus {
  return { provider, state, meteredAccepted: false, ...extra }
}

function statusMap(
  claude: AiSubscriptionStatus['state'],
  codex: AiSubscriptionStatus['state'],
): SubscriptionStatusMap {
  return { 'claude-code': status('claude-code', claude), codex: status('codex', codex) }
}

function installHome(settings: AiSettings): void {
  stored = settings
  setAiSettings = vi.fn(async (next: AiSettings) => {
    stored = next
    for (const listener of settingsListeners) listener()
  })
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
  } as unknown as HomeApi
}

interface SubscriptionMock extends SubscriptionApi {
  emit: (statuses: SubscriptionStatusMap) => void
}

function installSubscription(
  statuses: SubscriptionStatusMap,
  options: { codexImage?: boolean; launchOk?: boolean } = {},
): { [K in keyof SubscriptionApi]: ReturnType<typeof vi.fn> } & Pick<SubscriptionMock, 'emit'> {
  let current = statuses
  const listeners = new Set<(next: SubscriptionStatusMap) => void>()
  const launch = async () =>
    options.launchOk === false ? { ok: false, reason: 'failed' as const } : { ok: true }
  const api = {
    statuses: vi.fn(async () => current),
    recheck: vi.fn(async () => current),
    login: vi.fn(launch),
    install: vi.fn(launch),
    setMeteredAccepted: vi.fn(async (provider: AiSubscriptionProviderId, accepted: boolean) => {
      current = { ...current, [provider]: { ...current[provider], meteredAccepted: accepted } }
      return { ok: true, statuses: current }
    }),
    codexImageAvailable: vi.fn(async () => options.codexImage === true),
    onChanged: vi.fn((handler: (next: SubscriptionStatusMap) => void) => {
      listeners.add(handler)
      return () => listeners.delete(handler)
    }),
    openInstallHelp: vi.fn(async () => undefined),
    emit: (next: SubscriptionStatusMap) => {
      current = next
      for (const listener of listeners) listener(next)
    },
  }
  window.aiOfficeSubscription = api as unknown as SubscriptionApi
  return api
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve()
  })
}

async function openModal(target?: SettingsTarget): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        LocaleProvider,
        { initial: 'en' },
        createElement(SettingsModal, { onClose: vi.fn(), target }),
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

function nav(label: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>('.set-nav-item')].find(
    (button) => button.textContent?.trim() === label,
  )
}

function button(text: string, scope: ParentNode = host): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  )
}

function card(provider: AiSubscriptionProviderId): HTMLElement {
  return host.querySelector<HTMLElement>(`.ai-sub-card[data-provider="${provider}"]`)!
}

function dropdown(label: string): HTMLButtonElement | null {
  return host.querySelector<HTMLButtonElement>(`.gs-dd-btn[aria-label="${label}"]`)
}

/** the labels a dropdown offers, with the ones that cannot be picked */
async function optionsOf(label: string): Promise<{ label: string; disabled: boolean }[]> {
  const trigger = dropdown(label)
  await click(trigger)
  const options = [...host.querySelectorAll<HTMLButtonElement>('.gs-dd-pop [role="option"]')].map(
    (option) => ({
      label: option.getAttribute('aria-label') ?? option.textContent ?? '',
      disabled: option.disabled || option.getAttribute('aria-disabled') === 'true',
    }),
  )
  await click(trigger)
  return options
}

async function pick(label: string, option: string): Promise<void> {
  await click(dropdown(label))
  const target = [...host.querySelectorAll<HTMLButtonElement>('.gs-dd-pop [role="option"]')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent) === option,
  )
  await click(target)
}

async function openAiSection(): Promise<void> {
  await click(nav('AI'))
}

async function openAdvanced(): Promise<void> {
  await click(host.querySelector('.set-adv-toggle'))
}

function tab(label: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>('.set-adv-tab')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )
}

function lastSaved(): AiSettings {
  return setAiSettings.mock.calls.at(-1)![0]
}

/** a settings file from before the subscription providers: everything on a provider this build does not know */
function legacySettings(): AiSettings {
  const settings = defaultAiSettings()
  return {
    ...settings,
    provider: 'retired-provider',
    retiredSwitch: false,
    media: {
      ...settings.media!,
      imageProvider: 'retired-provider',
      analysisProvider: 'retired-provider',
      videoAnalysisProvider: 'retired-provider',
    },
    search: { ...settings.search!, provider: 'retired-provider' },
  } as unknown as AiSettings
}

function withOpenAiKey(settings: AiSettings): AiSettings {
  return {
    ...settings,
    providers: { ...settings.providers, openai: { apiKey: 'sk-test', model: 'gpt-test' } },
  }
}

// ── what shows by default, and what sits under Advanced ───

describe('the default view', () => {
  it('lists one AI entry in the navigation, with no separate media section', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'signed-out'))
    await openModal()
    const labels = [...host.querySelectorAll('.set-nav-item')].map((item) =>
      item.textContent?.trim(),
    )
    expect(labels).toEqual(['Account', 'AI', 'General', 'Integrations', 'About'])
  })

  it('shows both subscription cards and no key input', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'signed-out'))
    await openModal()
    await openAiSection()

    expect(card('claude-code').dataset.state).toBe('ready')
    expect(card('codex').dataset.state).toBe('signed-out')
    expect(host.querySelectorAll('.ai-sub-card')).toHaveLength(2)

    expect(host.querySelector('input[type="password"]')).toBeNull()
    expect(host.querySelector('#set-ai-key')).toBeNull()
    expect(host.querySelector('.set-input')).toBeNull()
    expect(host.textContent).not.toContain('API Key')
    expect(host.querySelector('.set-adv-toggle')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps the key panes under Advanced, one area at a time', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    await openAdvanced()

    expect(host.querySelector('.set-adv-toggle')?.getAttribute('aria-expanded')).toBe('true')
    // the key provider pane: key, base URL, output cap
    expect(host.querySelector('#set-ai-key')).not.toBeNull()
    expect(host.querySelector('#set-ai-max-tokens')).not.toBeNull()
    expect(host.querySelector('#set-ai-search-key')).toBeNull()

    await click(tab('AI Media & Search'))
    expect(host.querySelector('#set-ai-key')).toBeNull()
    expect(host.querySelector('#set-ai-search-key')).not.toBeNull()
    expect(host.textContent).toContain('Image generation')
    expect(host.textContent).toContain('Video analysis')

    // closing Advanced takes every key field out again
    await openAdvanced()
    expect(host.querySelector('input[type="password"]')).toBeNull()
  })

  it('does not offer Claude in the key pane', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    await openAdvanced()
    const labels = (await optionsOf('Provider')).map((option) => option.label)
    expect(labels).not.toContain('Claude Code')
    // "Claude" here is the Anthropic key provider; Codex stays for the path of a custom install
    expect(labels).toContain('Codex CLI')
    expect(labels).toContain('OpenAI')
  })

  it('opens straight on the Advanced media area when an outside entry point asks for it', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal({ section: 'aiMedia', block: 'rerank' })
    expect(nav('AI')?.classList.contains('active')).toBe(true)
    expect(host.querySelector('.set-adv-toggle')?.getAttribute('aria-expanded')).toBe('true')
    expect(tab('AI Media & Search')?.getAttribute('aria-selected')).toBe('true')
    expect(host.querySelector('#set-ai-search-key')).not.toBeNull()
  })

  it('shows where each subscription stands in the account section', async () => {
    installHome(defaultAiSettings())
    installSubscription({
      'claude-code': status('claude-code', 'ready', { planName: 'max' }),
      codex: status('codex', 'not-installed'),
    })
    await openModal()
    const rows = [...host.querySelectorAll<HTMLElement>('.set-field[data-provider]')]
    expect(rows.map((row) => row.textContent)).toEqual([
      'ClaudeConnected · max',
      'CodexNot installed',
    ])
    expect(host.textContent).not.toMatch(/credits/i)

    await click(button('Manage connections'))
    expect(nav('AI')?.classList.contains('active')).toBe(true)
    expect(host.querySelectorAll('.ai-sub-card')).toHaveLength(2)
  })
})

// ── which AI to use ───────────────────────────────────────

describe('"AI to use"', () => {
  it('lists auto, the usable subscriptions and configured key providers only', async () => {
    installHome(withOpenAiKey(defaultAiSettings()))
    installSubscription(statusMap('ready', 'metered'))
    await openModal()
    await openAiSection()
    expect(dropdown('AI to use')?.textContent).toBe('Automatic · Claude')
    expect(await optionsOf('AI to use')).toEqual([
      { label: 'Automatic · Claude', disabled: false },
      { label: 'Claude · Subscription', disabled: false },
      { label: 'OpenAI', disabled: false },
    ])
  })

  it('writes the explicit provider id, then auto again', async () => {
    installHome(withOpenAiKey(defaultAiSettings()))
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()

    await pick('AI to use', 'Codex · Subscription')
    expect(lastSaved().provider).toBe('codex')
    expect(dropdown('AI to use')?.textContent).toBe('Codex · Subscription')

    await pick('AI to use', 'OpenAI')
    expect(lastSaved().provider).toBe('openai')

    await pick('AI to use', 'Automatic · Claude')
    expect(lastSaved().provider).toBe('auto')
    expect(setAiSettings).toHaveBeenCalledTimes(3)
  })

  it('lists an accepted metered login with a cost marker and warns while it is in use', async () => {
    installHome({ ...defaultAiSettings(), provider: 'codex', meteredAccepted: { codex: true } })
    installSubscription({
      'claude-code': status('claude-code', 'signed-out'),
      codex: status('codex', 'metered', { meteredAccepted: true }),
    })
    await openModal()
    await openAiSection()
    expect(await optionsOf('AI to use')).toEqual([
      { label: 'Automatic', disabled: false },
      { label: 'Codex · Paid', disabled: false },
    ])
    expect(host.querySelector('.ai-sub-metered')).not.toBeNull()
  })

  it('shows a stored selection that cannot run without offering it, and says so', async () => {
    installHome({ ...defaultAiSettings(), provider: 'codex' })
    installSubscription(statusMap('ready', 'metered'))
    await openModal()
    await openAiSection()
    expect(dropdown('AI to use')?.textContent).toBe('Codex · cannot be used right now')
    expect(await optionsOf('AI to use')).toEqual([
      { label: 'Automatic · Claude', disabled: false },
      { label: 'Claude · Subscription', disabled: false },
      { label: 'Codex · cannot be used right now', disabled: true },
    ])
    expect(host.querySelector('[data-ai-blocked]')?.textContent).toBe(
      'The Codex connection cannot be used right now',
    )
    // nothing moved to another provider on its own
    expect(setAiSettings).not.toHaveBeenCalled()
  })

  it('says a connection is needed while auto resolves to nothing', async () => {
    installHome(withOpenAiKey(defaultAiSettings()))
    installSubscription(statusMap('signed-out', 'not-installed'))
    await openModal()
    await openAiSection()
    // a configured key provider is offered, but auto never lands on it
    expect(dropdown('AI to use')?.textContent).toBe('Automatic')
    expect(host.querySelector('[data-ai-blocked]')?.textContent).toBe(
      'Connect a subscription to use AI',
    )
  })

  it('shows the Codex line only where Codex can be chosen', async () => {
    installHome(defaultAiSettings())
    const subscription = installSubscription(statusMap('ready', 'signed-out'))
    await openModal()
    await openAiSection()
    expect(host.querySelector('.ai-sub-codex')).toBeNull()

    await act(async () => subscription.emit(statusMap('ready', 'ready')))
    await flush()
    expect(host.querySelector('.ai-sub-codex')).not.toBeNull()
    expect((await optionsOf('AI to use')).map((option) => option.label)).toContain(
      'Codex · Subscription',
    )
  })

  it('re-opens the first-connection notice without writing anything', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    expect(host.querySelector('.ai-sub-first')).toBeNull()
    await click(button('View again'))
    expect(host.querySelector('.ai-sub-first')?.textContent).toContain(
      'sent to Anthropic or OpenAI under your own account',
    )
    await click(button('Dismiss'))
    expect(host.querySelector('.ai-sub-first')).toBeNull()
    expect(setAiSettings).not.toHaveBeenCalled()
  })
})

// ── the connect cards ─────────────────────────────────────

describe('the connect cards', () => {
  it('reads the statuses and checks again when the dialog opens', async () => {
    installHome(defaultAiSettings())
    const subscription = installSubscription(statusMap('ready', 'ready'))
    await openModal()
    expect(subscription.statuses).toHaveBeenCalledTimes(1)
    expect(subscription.recheck).toHaveBeenCalledTimes(1)
    expect(subscription.recheck).toHaveBeenCalledWith(undefined)
    expect(subscription.onChanged).toHaveBeenCalledTimes(1)
  })

  it('runs the install, then checks again each time the window regains focus', async () => {
    installHome(defaultAiSettings())
    const subscription = installSubscription(statusMap('not-installed', 'ready'))
    await openModal()
    await openAiSection()
    subscription.recheck.mockClear()

    // nothing was started yet: coming back to the window checks nothing
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(subscription.recheck).not.toHaveBeenCalled()

    await click(button('Install', card('claude-code')))
    expect(subscription.install).toHaveBeenCalledWith('claude-code')

    await act(async () => window.dispatchEvent(new Event('focus')))
    await flush()
    expect(subscription.recheck).toHaveBeenCalledWith(['claude-code'])

    // the install finished: the card moves on and the focus checks stop
    await act(async () => subscription.emit(statusMap('signed-out', 'ready')))
    await flush()
    expect(card('claude-code').dataset.state).toBe('signed-out')
    subscription.recheck.mockClear()
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(subscription.recheck).not.toHaveBeenCalled()
  })

  it('wires sign-in, check-again, the install guide and "use anyway"', async () => {
    installHome(defaultAiSettings())
    const subscription = installSubscription({
      'claude-code': status('claude-code', 'signed-out'),
      codex: status('codex', 'metered'),
    })
    await openModal()
    await openAiSection()

    await click(button('Sign in', card('claude-code')))
    expect(subscription.login).toHaveBeenCalledWith('claude-code')

    await click(button('Use anyway', card('codex')))
    expect(subscription.setMeteredAccepted).toHaveBeenCalledWith('codex', true)
    expect(card('codex').textContent).toContain('In use · charged by usage')

    await act(async () =>
      subscription.emit({
        'claude-code': status('claude-code', 'error', { error: 'timeout: no answer' }),
        codex: status('codex', 'not-installed'),
      }),
    )
    await flush()
    subscription.recheck.mockClear()
    await click(button('Check again', card('claude-code')))
    expect(subscription.recheck).toHaveBeenCalledWith(['claude-code'])

    await click(button('Official install guide', card('codex')))
    expect(subscription.openInstallHelp).toHaveBeenCalledWith('codex')
  })

  it('says so when an install could not be started, without the raw error', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('not-installed', 'ready'), { launchOk: false })
    await openModal()
    await openAiSection()
    await click(button('Install', card('claude-code')))
    const failed = host.querySelector('.set-sub-failed[data-provider="claude-code"]')
    expect(failed?.textContent).toContain('The install command could not be started.')
  })
})

// ── the automatic-requests switch ─────────────────────────

describe('automatic requests', () => {
  function headlessSwitch(): HTMLButtonElement {
    return host.querySelector<HTMLButtonElement>(
      '.set-switch[aria-label="Let automatic requests use a subscription"]',
    )!
  }

  it('is off by default and turns on only after the warning is passed', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    await openAdvanced()

    expect(headlessSwitch().getAttribute('aria-checked')).toBe('false')
    expect(host.textContent).not.toContain(HEADLESS_WARNING)

    await click(headlessSwitch())
    // the warning is up and nothing has been saved
    expect(host.querySelector('.set-adv-confirm')?.textContent).toContain(HEADLESS_WARNING)
    expect(headlessSwitch().getAttribute('aria-checked')).toBe('false')
    expect(setAiSettings).not.toHaveBeenCalled()

    await click(button('Cancel', host.querySelector('.set-adv-confirm')!))
    expect(host.querySelector('.set-adv-confirm')).toBeNull()
    expect(setAiSettings).not.toHaveBeenCalled()

    await click(headlessSwitch())
    await click(button('Turn on anyway'))
    expect(lastSaved().headlessSubscriptionEnabled).toBe(true)
    expect(headlessSwitch().getAttribute('aria-checked')).toBe('true')
    // the warning stays in sight while the switch is on
    expect(host.textContent).toContain(HEADLESS_WARNING)
  })

  it('turns off at once, with no question asked', async () => {
    installHome({ ...defaultAiSettings(), headlessSubscriptionEnabled: true })
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    await openAdvanced()
    expect(headlessSwitch().getAttribute('aria-checked')).toBe('true')

    await click(headlessSwitch())
    expect(host.querySelector('.set-adv-confirm')).toBeNull()
    expect(lastSaved().headlessSubscriptionEnabled).toBe(false)
  })

  it('shows the warning in the wording the product specifies, in Korean', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          { initial: 'ko' },
          createElement(SettingsModal, { onClose: vi.fn(), target: { section: 'aiModel' } }),
        ),
      )
      await Promise.resolve()
    })
    await flush()
    await openAdvanced()
    await click(host.querySelector('.set-switch[role="switch"]'))
    expect(host.querySelector('.set-adv-confirm')?.textContent).toContain(
      '프로그램이 자동으로 구독을 쓰는 것은 두 회사가 권장하지 않으며, 계정에 제한이 걸릴 수 있습니다.',
    )
  })
})

// ── media providers ───────────────────────────────────────

describe('media providers', () => {
  async function openMedia(): Promise<void> {
    await openModal({ section: 'aiMedia' })
  }

  it('offers the Codex subscription for images only when the main process says it can', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'), { codexImage: false })
    await openMedia()
    const without = (await optionsOf('Image generation')).map((option) => option.label)
    expect(without).not.toContain('Codex subscription')
    expect(without[0]).toBe('None selected')
    // the stored default (the Codex subscription) reads as "none" in such a build
    expect(dropdown('Image generation')?.textContent).toBe('None selected')
    expect(host.querySelector('section .ai-sub-codex')).toBeNull()
  })

  it('lists and selects the Codex subscription when it is available', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'), { codexImage: true })
    await openMedia()
    const labels = (await optionsOf('Image generation')).map((option) => option.label)
    expect(labels.slice(0, 2)).toEqual(['Codex subscription', 'None selected'])
    expect(dropdown('Image generation')?.textContent).toBe('Codex subscription')
    // no key rows for a selection that needs none, and the Codex line is shown
    expect(host.querySelector('#set-ai-image-key')).toBeNull()
    expect(host.querySelector('section .ai-sub-codex')).not.toBeNull()
  })

  it('defaults image analysis to the chat AI and video analysis to none', async () => {
    installHome(legacySettings())
    installSubscription(statusMap('ready', 'ready'))
    await openMedia()
    expect(dropdown('Image analysis')?.textContent).toBe('Ask the current AI directly')
    expect(dropdown('Video analysis')?.textContent).toBe('None selected')
    expect((await optionsOf('Image analysis'))[0]!.label).toBe('Ask the current AI directly')
    expect((await optionsOf('Video analysis'))[0]!.label).toBe('None selected')
    expect(host.querySelector('#set-ai-analysis-key')).toBeNull()
    expect(host.querySelector('#set-ai-video-key')).toBeNull()
  })

  it('shows the key rows once a key provider is picked, and saves the pick', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await openMedia()
    const keyProvider = (await optionsOf('Image analysis'))[1]!.label
    await pick('Image analysis', keyProvider)
    expect(host.querySelector('#set-ai-analysis-key')).not.toBeNull()

    await click(button('Save'))
    const id = AI_MEDIA_PROVIDERS.find((meta) => meta.label === keyProvider)!.id
    expect(lastSaved().media?.analysisProvider).toBe(id)
  })
})

// ── what gets saved ───────────────────────────────────────

describe('saving', () => {
  function expectClean(saved: AiSettings): void {
    expect('retiredSwitch' in saved).toBe(false)
    expect(saved.provider).toBe('auto')
    expect(saved.media).toMatchObject({
      imageProvider: 'codex',
      analysisProvider: 'chat',
      videoAnalysisProvider: 'none',
    })
    expect(saved.search?.provider).toBe('parallel')
  }

  it('an edit in the visible part writes no removed selection and no cloud-tools switch', async () => {
    installHome(legacySettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    // opening the screen alone rewrites nothing
    expect(setAiSettings).not.toHaveBeenCalled()
    expect(dropdown('AI to use')?.textContent).toBe('Automatic · Claude')

    await openAdvanced()
    await click(host.querySelector('.set-switch[role="switch"]'))
    await click(button('Turn on anyway'))
    expectClean(lastSaved())
  })

  it('a key pane save writes no removed selection either, and keeps the AI in use', async () => {
    installHome(legacySettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    await openAdvanced()

    // fill in a key for a provider: that must not switch the AI in use to it
    await pick('Provider', 'OpenAI')
    const key = host.querySelector<HTMLInputElement>('#set-ai-key')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(key, 'sk-typed')
      key.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    await click(button('Save'))

    const saved = lastSaved()
    expectClean(saved)
    expect(saved.providers.openai.apiKey).toBe('sk-typed')
    // configured now: selectable above, still not selected
    expect((await optionsOf('AI to use')).map((option) => option.label)).toContain('OpenAI')
    expect(dropdown('AI to use')?.textContent).toBe('Automatic · Claude')
  })

  it('a key pane save does not undo a selection made while its draft was open', async () => {
    installHome(defaultAiSettings())
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    await openAdvanced()

    const cap = host.querySelector<HTMLInputElement>('#set-ai-max-tokens')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(cap, '9216')
      cap.dispatchEvent(new Event('input', { bubbles: true }))
      cap.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      await Promise.resolve()
    })
    // the pane holds an unsaved draft; the selection above is saved at once
    await pick('AI to use', 'Codex · Subscription')
    expect(lastSaved().provider).toBe('codex')

    await click(button('Save'))
    expect(lastSaved()).toMatchObject({ provider: 'codex', maxOutputTokens: 9216 })
  })
})

// ── no handler behind the bridge ──────────────────────────

describe('without the main-process handlers', () => {
  async function settle(): Promise<void> {
    await flush()
    // an unhandled rejection is reported a macrotask later
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }

  it('treats rejected calls as "still checking" and stays usable', async () => {
    installHome(defaultAiSettings())
    const rejected = (channel: string) => () =>
      Promise.reject(new Error(`No handler registered for '${channel}'`))
    window.aiOfficeSubscription = {
      statuses: rejected('ai:subscription-statuses'),
      recheck: rejected('ai:subscription-recheck'),
      login: rejected('ai:subscription-login'),
      install: rejected('ai:subscription-install'),
      setMeteredAccepted: rejected('ai:subscription-metered'),
      codexImageAvailable: rejected('ai:subscription-codex-image'),
      onChanged: () => () => undefined,
      openInstallHelp: rejected('home:open-subscription-install-help'),
    } as unknown as SubscriptionApi

    await openModal()
    await openAiSection()
    expect(card('claude-code').dataset.state).toBe('checking')
    expect(card('codex').dataset.state).toBe('checking')
    expect(dropdown('AI to use')?.textContent).toBe('Automatic')

    // the rest of the screen still works: the media area opens without Codex
    await openAdvanced()
    await click(tab('AI Media & Search'))
    expect((await optionsOf('Image generation')).map((option) => option.label)).not.toContain(
      'Codex subscription',
    )
    await settle()
    expect(unhandled).toEqual([])
  })

  it('renders when the preload exposes no subscription bridge at all', async () => {
    installHome(defaultAiSettings())
    delete window.aiOfficeSubscription
    await openModal()
    expect(host.querySelectorAll('.set-field[data-provider]')).toHaveLength(2)
    await openAiSection()
    expect(host.querySelectorAll('.ai-sub-card[data-state="checking"]')).toHaveLength(2)
    await settle()
    expect(unhandled).toEqual([])
  })

  it('survives a bridge whose event subscription throws', async () => {
    installHome(defaultAiSettings())
    const subscription = installSubscription(statusMap('ready', 'ready'))
    subscription.onChanged.mockImplementation(() => {
      throw new Error('no event source')
    })
    await openModal()
    await openAiSection()
    expect(card('claude-code').dataset.state).toBe('ready')
    await settle()
    expect(unhandled).toEqual([])
  })

  it('renders the AI section when the settings cannot be read', async () => {
    installHome(defaultAiSettings())
    ;(window.aiOffice as unknown as { getAiSettings: () => Promise<never> }).getAiSettings = () =>
      Promise.reject(new Error("No handler registered for 'ai:get-settings'"))
    installSubscription(statusMap('ready', 'ready'))
    await openModal()
    await openAiSection()
    expect(host.querySelectorAll('.ai-sub-card')).toHaveLength(2)
    expect(dropdown('AI to use')).toBeNull()
    await settle()
    expect(unhandled).toEqual([])
  })
})
