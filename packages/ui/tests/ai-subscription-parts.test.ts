/** @vitest-environment jsdom */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultAiSettings,
  selectAiProvider,
  type AiSettings,
  type AiSubscriptionProviderId,
  type AiSubscriptionState,
  type AiSubscriptionStatus,
  type AiSubscriptionStatuses,
} from '@genoffice/ai-provider'
import { AiBlockedNotice } from '../src/AiBlockedNotice'
import { AiModelPicker, type AiModelPickerBridge } from '../src/AiModelPicker'
import { AiConnectPrompt, AiSubscriptionCard } from '../src/AiSubscriptionCard'
import {
  AiCodexNotice,
  AiFirstConnectionNotice,
  AiInputTruncatedNotice,
  AiMeteredWarning,
} from '../src/AiSubscriptionNotices'
import { AiSubscriptionUsageLine } from '../src/AiSubscriptionUsageLine'
import { formatAiResetTime } from '../src/ai-subscription'
import { AI_SUBSCRIPTION_STRINGS } from '../src/strings-ai-subscription'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const en = AI_SUBSCRIPTION_STRINGS.en

const status = (
  provider: AiSubscriptionProviderId,
  state: AiSubscriptionState,
  extra: Partial<AiSubscriptionStatus> = {},
): AiSubscriptionStatus => ({ provider, state, meteredAccepted: false, ...extra })

function cardActions() {
  return {
    onInstall: vi.fn(),
    onLogin: vi.fn(),
    onRecheck: vi.fn(),
    onAcceptMetered: vi.fn(),
    onOpenInstallHelp: vi.fn(),
  }
}

const actionsShown = () =>
  [...host.querySelectorAll<HTMLElement>('[data-action]')].map((el) => el.dataset.action)
const click = (selector: string) =>
  act(() => host.querySelector<HTMLButtonElement>(selector)!.click())

describe('AiSubscriptionCard', () => {
  const render = (s: AiSubscriptionStatus, actions = cardActions()) => {
    act(() => root.render(createElement(AiSubscriptionCard, { status: s, lang: 'en', ...actions })))
    return actions
  }
  const statusText = () => host.querySelector('.ai-sub-card-status')!.textContent
  const notes = () => [...host.querySelectorAll('.ai-sub-note')].map((el) => el.textContent)

  it('checking: says so and offers nothing', () => {
    render(status('claude-code', 'checking'))
    expect(host.querySelector('.ai-sub-card-name')!.textContent).toBe('Claude')
    expect(statusText()).toBe(en.cardChecking)
    expect(actionsShown()).toEqual([])
  })

  it('not-installed: install button, the terminal note, and the official instructions', () => {
    const actions = render(status('codex', 'not-installed'))
    expect(host.querySelector('.ai-sub-card-name')!.textContent).toBe('Codex')
    expect(statusText()).toBe(en.cardNotInstalled)
    expect(notes()).toEqual(["OpenAI's official install command runs in a new terminal window."])
    expect(actionsShown()).toEqual(['install', 'install-help'])
    click('[data-action="install"]')
    expect(actions.onInstall).toHaveBeenCalledExactlyOnceWith('codex')
    click('[data-action="install-help"]')
    expect(actions.onOpenInstallHelp).toHaveBeenCalledExactlyOnceWith('codex')
  })

  it('signed-out: login button', () => {
    const actions = render(status('claude-code', 'signed-out'))
    expect(statusText()).toBe(en.cardSignedOut)
    expect(notes()).toEqual(["The sign-in page that opens is Anthropic's own."])
    expect(actionsShown()).toEqual(['login'])
    click('[data-action="login"]')
    expect(actions.onLogin).toHaveBeenCalledExactlyOnceWith('claude-code')
  })

  it('ready: connected, with the plan name when given', () => {
    render(status('claude-code', 'ready'))
    expect(statusText()).toBe('Connected')
    expect(actionsShown()).toEqual([])
    render(status('claude-code', 'ready', { planName: 'max' }))
    expect(statusText()).toBe('Connected · max')
    expect(host.querySelector('.ai-sub-card')!.getAttribute('data-tone')).toBe('ok')
  })

  it('metered: cost warning, what it means, and "use anyway"', () => {
    const actions = render(status('codex', 'metered'))
    expect(statusText()).toBe(en.cardMetered)
    expect(notes()).toEqual([en.meteredWarning, en.meteredMeaning])
    expect(actionsShown()).toEqual(['accept-metered'])
    const button = host.querySelector<HTMLButtonElement>('[data-action="accept-metered"]')!
    expect(button.textContent).toBe('Use anyway')
    // paying is never the highlighted default
    expect(button.classList.contains('primary')).toBe(false)
    click('[data-action="accept-metered"]')
    expect(actions.onAcceptMetered).toHaveBeenCalledExactlyOnceWith('codex')
  })

  it('metered and accepted: keeps the warning, drops the choice', () => {
    render(status('codex', 'metered', { meteredAccepted: true }))
    expect(statusText()).toBe(en.cardMeteredAccepted)
    expect(notes()).toEqual([en.meteredWarning])
    expect(actionsShown()).toEqual([])
  })

  it('error: says what went wrong in our own words, with a re-check button', () => {
    const actions = render(
      status('claude-code', 'error', {
        error: 'needs-update: The Claude Code program is too old',
      }),
    )
    expect(statusText()).toBe(en.cardError)
    expect(host.querySelector('.ai-sub-detail')!.textContent).toBe(
      'The Claude program on this PC is too old. Update it, then check again.',
    )
    expect(actionsShown()).toEqual(['recheck'])
    click('[data-action="recheck"]')
    expect(actions.onRecheck).toHaveBeenCalledExactlyOnceWith('claude-code')
  })

  it('error: one sentence per kind, naming the provider, never the raw detail', () => {
    const cases = [
      {
        error: 'needs-update: The Codex program is too old',
        raw: 'The Codex program is too old',
        en: 'The Codex program on this PC is too old. Update it, then check again.',
        ko: '이 PC의 Codex 프로그램 버전이 낮습니다. 업데이트한 뒤 다시 확인하세요.',
      },
      {
        error: 'timeout: The status check did not answer in 20000 ms',
        raw: '20000',
        en: 'The Codex program did not answer in time. Check again in a moment.',
        ko: 'Codex 프로그램이 제때 응답하지 않았습니다. 잠시 뒤 다시 확인하세요.',
      },
      {
        error: 'failed: spawn C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd ENOENT',
        raw: 'ENOENT',
        en: 'Something went wrong while checking Codex. Check again.',
        ko: 'Codex 연결을 확인하는 중에 문제가 생겼습니다. 다시 확인해 보세요.',
      },
    ]
    for (const c of cases) {
      for (const lang of ['en', 'ko'] as const) {
        const props = { status: status('codex', 'error', { error: c.error }), lang }
        act(() => root.render(createElement(AiSubscriptionCard, { ...props, ...cardActions() })))
        expect(host.querySelector('.ai-sub-detail')!.textContent).toBe(c[lang])
        expect(host.textContent).not.toContain(c.raw)
        expect(host.textContent).not.toMatch(/needs-update|timeout:|failed:|spawn|AppData/)
        expect(actionsShown()).toEqual(['recheck'])
      }
    }
  })

  it('error: a status text of an unknown shape is still not shown', () => {
    render(status('claude-code', 'error', { error: 'Error: EACCES C:\\Program Files\\claude.exe' }))
    expect(host.querySelector('.ai-sub-detail')!.textContent).toBe(
      'Something went wrong while checking Claude. Check again.',
    )
    expect(host.textContent).not.toContain('EACCES')
  })

  it('marks the provider with the neutral AI glyph, never a vendor logo', () => {
    render(status('codex', 'ready'))
    expect(host.querySelectorAll('.ai-sub-card-mark svg')).toHaveLength(1)
    expect(host.querySelector('.gs-provider-logo')).toBeNull()
  })

  it('keeps the buttons inert while an action is in flight', () => {
    const actions = cardActions()
    act(() =>
      root.render(
        createElement(AiSubscriptionCard, {
          status: status('codex', 'not-installed'),
          lang: 'en',
          disabled: true,
          ...actions,
        }),
      ),
    )
    expect(host.querySelector<HTMLButtonElement>('[data-action="install"]')!.disabled).toBe(true)
    // reading the instructions is always possible
    expect(host.querySelector<HTMLButtonElement>('[data-action="install-help"]')!.disabled).toBe(
      false,
    )
  })

  it('renders in the ui language', () => {
    act(() =>
      root.render(
        createElement(AiSubscriptionCard, {
          status: status('codex', 'metered'),
          lang: 'ko',
          ...cardActions(),
        }),
      ),
    )
    expect(host.querySelector('[data-action="accept-metered"]')!.textContent).toBe('그래도 사용')
    expect(notes()[0]).toBe('구독이 아니라 쓴 만큼 요금이 나갑니다.')
  })
})

describe('AiConnectPrompt', () => {
  const render = (
    settings: AiSettings,
    statuses: AiSubscriptionStatuses,
    extra: { onOpenSettings?: () => void } = {},
  ) => {
    const actions = cardActions()
    act(() =>
      root.render(
        createElement(AiConnectPrompt, {
          choice: selectAiProvider(settings, statuses),
          statuses,
          lang: 'en',
          ...actions,
          ...extra,
        }),
      ),
    )
    return actions
  }
  const cards = () =>
    [...host.querySelectorAll<HTMLElement>('.ai-sub-card')].map((el) => [
      el.dataset.provider,
      el.dataset.state,
    ])

  it('renders nothing once a provider can run', () => {
    render(defaultAiSettings(), { codex: status('codex', 'ready') })
    expect(host.innerHTML).toBe('')
  })

  it('asks for a subscription and offers both, each with its own action', () => {
    const actions = render(defaultAiSettings(), {
      'claude-code': status('claude-code', 'signed-out'),
      codex: status('codex', 'not-installed'),
    })
    expect(host.querySelector('.ai-sub-prompt-title')!.textContent).toBe(en.connectTitle)
    expect(host.querySelector('.ai-sub-prompt-body')!.textContent).toBe(en.connectBody)
    expect(cards()).toEqual([
      ['claude-code', 'signed-out'],
      ['codex', 'not-installed'],
    ])
    click('[data-provider="claude-code"] [data-action="login"]')
    expect(actions.onLogin).toHaveBeenCalledExactlyOnceWith('claude-code')
    click('[data-provider="codex"] [data-action="install"]')
    expect(actions.onInstall).toHaveBeenCalledExactlyOnceWith('codex')
  })

  it('shows a provider that has not reported yet as checking', () => {
    render(defaultAiSettings(), {})
    expect(cards()).toEqual([
      ['claude-code', 'checking'],
      ['codex', 'checking'],
    ])
  })

  it('shows only the selected subscription when that one cannot run', () => {
    render(
      { ...defaultAiSettings(), provider: 'codex' },
      { 'claude-code': status('claude-code', 'ready'), codex: status('codex', 'metered') },
    )
    expect(host.querySelector('.ai-sub-prompt-title')!.textContent).toBe(
      'The Codex connection cannot be used right now',
    )
    expect(cards()).toEqual([['codex', 'metered']])
    expect(actionsShown()).toEqual(['accept-metered'])
  })

  it('sends an unfinished key provider to the settings page', () => {
    const onOpenSettings = vi.fn()
    render({ ...defaultAiSettings(), provider: 'gemini' }, {}, { onOpenSettings })
    expect(host.querySelector('.ai-sub-prompt-body')!.textContent).toBe(
      'The Gemini setup is not finished. Complete it in Settings, or choose another AI.',
    )
    expect(cards()).toEqual([])
    click('[data-action="open-settings"]')
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})

describe('AiConnectPrompt attention', () => {
  const notConnected = { 'claude-code': status('claude-code', 'signed-out') }
  const prompt = (statuses: AiSubscriptionStatuses, attention?: number) =>
    createElement(AiConnectPrompt, {
      choice: selectAiProvider(defaultAiSettings(), statuses),
      statuses,
      lang: 'en',
      attention,
      ...cardActions(),
    })
  let scrolled: Element[]
  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this)
    }
  })
  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  it('stays where it is until a send was answered by it', () => {
    act(() => root.render(prompt(notConnected)))
    act(() => root.render(prompt(notConnected, 0)))
    expect(scrolled).toEqual([])
  })

  it('scrolls itself into view each time a send was answered by it', () => {
    act(() => root.render(prompt(notConnected, 0)))
    act(() => root.render(prompt(notConnected, 1)))
    expect(scrolled).toEqual([host.querySelector('.ai-sub-prompt')])
    // an unrelated re-render does not scroll again
    act(() => root.render(prompt(notConnected, 1)))
    expect(scrolled).toHaveLength(1)
    act(() => root.render(prompt(notConnected, 2)))
    expect(scrolled).toHaveLength(2)
  })

  it('scrolls when it appears for a send made just before', () => {
    const ready = { 'claude-code': status('claude-code', 'ready') }
    act(() => root.render(prompt(ready, 1)))
    expect(host.querySelector('.ai-sub-prompt')).toBeNull()
    expect(scrolled).toEqual([])
    act(() => root.render(prompt(notConnected, 1)))
    expect(scrolled).toEqual([host.querySelector('.ai-sub-prompt')])
  })

  it('does not fail where the host cannot scroll', () => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    expect(() => act(() => root.render(prompt(notConnected, 1)))).not.toThrow()
  })
})

describe('AiBlockedNotice', () => {
  const now = new Date(2026, 9, 13, 12, 0).getTime()
  const resetsAt = new Date(2026, 9, 13, 17, 10).getTime()
  const both: AiSubscriptionStatuses = {
    'claude-code': status('claude-code', 'ready'),
    codex: status('codex', 'ready'),
  }
  const render = (props: Partial<Parameters<typeof AiBlockedNotice>[0]>) => {
    const onContinueWith = vi.fn()
    act(() =>
      root.render(
        createElement(AiBlockedNotice, {
          kind: 'rate-limit',
          settings: defaultAiSettings(),
          statuses: {},
          lang: 'en',
          onContinueWith,
          ...props,
        }),
      ),
    )
    return onContinueWith
  }
  const reason = () => host.querySelector('.ai-sub-blocked-reason')?.textContent
  const button = () => host.querySelector<HTMLButtonElement>('[data-action="continue-with"]')

  it('gives the reason with the reset time and offers the other ready subscription', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const onContinueWith = render({ provider: 'claude-code', resetsAt, statuses: both })
    expect(reason()).toBe(
      `The Claude subscription limit has been used up. It resets at ${formatAiResetTime('en', resetsAt, now)}.`,
    )
    expect(button()!.textContent).toBe('Continue with Codex')
    expect(host.querySelector('[data-note="continueMeteredNote"]')).toBeNull()
    click('[data-action="continue-with"]')
    expect(onContinueWith).toHaveBeenCalledExactlyOnceWith('codex')
  })

  it('adds a cost note when the only other connection is an accepted metered login', () => {
    const settings = defaultAiSettings()
    settings.meteredAccepted = { codex: true }
    const onContinueWith = render({
      kind: 'signed-out',
      provider: 'claude-code',
      settings,
      statuses: {
        'claude-code': status('claude-code', 'signed-out'),
        codex: status('codex', 'metered', { meteredAccepted: true }),
      },
    })
    expect(reason()).toBe(en.errSignedOut.replace('{provider}', 'Claude'))
    expect(button()!.textContent).toBe('Continue with Codex')
    expect(host.querySelector('[data-note="continueMeteredNote"]')!.textContent).toBe(
      'The Codex connection is not a subscription: continuing is charged by usage.',
    )
    click('[data-action="continue-with"]')
    expect(onContinueWith).toHaveBeenCalledExactlyOnceWith('codex')
  })

  it('offers no button when only key providers could take over', () => {
    const settings = defaultAiSettings()
    settings.providers.anthropic = { apiKey: 'k', model: 'claude-next' }
    settings.providers.openai = { apiKey: 'k', model: 'gpt-x' }
    render({
      provider: 'claude-code',
      settings,
      statuses: { 'claude-code': status('claude-code', 'ready') },
    })
    expect(reason()).toBe('The Claude subscription limit has been used up.')
    expect(button()).toBeNull()
    expect(host.textContent).not.toMatch(/Continue with/)
  })

  it('offers no button for a metered login the user has not accepted', () => {
    render({
      provider: 'claude-code',
      statuses: {
        'claude-code': status('claude-code', 'ready'),
        codex: status('codex', 'metered'),
      },
    })
    expect(button()).toBeNull()
  })

  it('words each blocking kind', () => {
    const cases = [
      ['not-installed', 'codex', en.errNotInstalled.replace('{provider}', 'Codex')],
      ['needs-update', 'codex', en.errNeedsUpdate.replace('{provider}', 'Codex')],
      ['metered-not-accepted', 'codex', en.errMeteredNotAccepted.replace('{provider}', 'Codex')],
      ['unsafe-tools', undefined, en.errUnsafeTools.replace('{provider}', 'Claude')],
      ['not-connected', undefined, en.errNotConnected],
    ] as const
    for (const [kind, provider, text] of cases) {
      render({ kind, provider })
      expect(reason(), kind).toBe(text)
      expect(host.querySelector('.ai-sub-blocked')!.getAttribute('data-kind')).toBe(kind)
    }
  })

  it('treats a tool-carrying Claude start as blocked on Claude', () => {
    render({ kind: 'unsafe-tools', statuses: both })
    expect(button()!.dataset.provider).toBe('codex')
  })

  it('shows the carried message for a transient failure, without a switch button', () => {
    render({ kind: 'network', message: 'Network error', provider: 'claude-code', statuses: both })
    expect(reason()).toBe('Network error')
    expect(button()).toBeNull()
  })
})

describe('AiSubscriptionUsageLine', () => {
  const now = new Date(2026, 9, 13, 12, 0).getTime()
  const resetsAt = new Date(2026, 9, 13, 17, 10).getTime()
  const time = formatAiResetTime('en', resetsAt, now)

  it('renders nothing below the threshold', () => {
    act(() =>
      root.render(
        createElement(AiSubscriptionUsageLine, {
          usage: [{ provider: 'claude-code', window: 'five_hour', utilization: 0.5, resetsAt }],
          lang: 'en',
          now,
        }),
      ),
    )
    expect(host.innerHTML).toBe('')
  })

  it('shows "N% used · resets at <time>" for each window over it', () => {
    act(() =>
      root.render(
        createElement(AiSubscriptionUsageLine, {
          usage: [
            { provider: 'claude-code', window: 'five_hour', utilization: 0.86, resetsAt },
            { provider: 'claude-code', window: 'seven_day', utilization: 0.08, resetsAt },
          ],
          lang: 'en',
          now,
        }),
      ),
    )
    const items = [...host.querySelectorAll<HTMLElement>('.ai-subscription-usage-item')]
    expect(items.map((el) => el.textContent)).toEqual([`86% used · resets at ${time}`])
    expect(items[0]!.title).toBe('Claude · 5-hour limit')
  })

  it('follows a tuned threshold', () => {
    act(() =>
      root.render(
        createElement(AiSubscriptionUsageLine, {
          usage: [{ provider: 'codex', window: 'seven_day', utilization: 0.5, resetsAt }],
          lang: 'en',
          threshold: 0.4,
          now,
        }),
      ),
    )
    expect(host.querySelector('.ai-subscription-usage-item')!.textContent).toBe(
      `50% used · resets at ${time}`,
    )
  })
})

describe('notices', () => {
  const lines = () =>
    [...host.querySelectorAll('.ai-sub-first-list li')].map((el) => el.textContent)

  it('first connection: where content goes and who decides about training', () => {
    act(() => root.render(createElement(AiFirstConnectionNotice, { lang: 'en' })))
    expect(host.querySelector('.ai-sub-first-title')!.textContent).toBe(en.noticeTitle)
    expect(lines()).toEqual([en.noticeSend, en.noticeTraining])
    expect(host.querySelector('button')).toBeNull()
  })

  it('first connection: adds the Codex history sentence only when asked to', () => {
    const onAcknowledge = vi.fn()
    act(() =>
      root.render(
        createElement(AiFirstConnectionNotice, {
          lang: 'en',
          codexKeepsHistory: true,
          onAcknowledge,
        }),
      ),
    )
    expect(lines()).toEqual([en.noticeSend, en.noticeTraining, en.noticeCodexHistory])
    click('button')
    expect(onAcknowledge).toHaveBeenCalledOnce()
  })

  it('Codex: the one line about OpenAI’s recommendation', () => {
    act(() => root.render(createElement(AiCodexNotice, { lang: 'en' })))
    expect(host.textContent).toBe(
      'Using a Codex subscription inside an app is not a method officially recommended by OpenAI.',
    )
    act(() => root.render(createElement(AiCodexNotice, { lang: 'ko' })))
    expect(host.textContent).toBe(
      '앱에서 Codex 구독을 쓰는 것은 OpenAI가 공식 권장하는 방식이 아닙니다.',
    )
  })

  it('metered: the cost warning, with its meaning on request', () => {
    act(() => root.render(createElement(AiMeteredWarning, { lang: 'en' })))
    expect(host.textContent).toBe(en.meteredWarning)
    act(() => root.render(createElement(AiMeteredWarning, { lang: 'en', explain: true })))
    expect(host.textContent).toBe(`${en.meteredWarning} ${en.meteredMeaning}`)
  })

  it('truncated input: says so and can be dismissed', () => {
    const onDismiss = vi.fn()
    act(() => root.render(createElement(AiInputTruncatedNotice, { lang: 'en', onDismiss })))
    expect(host.querySelector('.ai-sub-notice-text')!.textContent).toBe(en.truncatedNotice)
    click('button')
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('AiModelPicker under the subscription contract', () => {
  const ready: AiSubscriptionStatuses = {
    'claude-code': status('claude-code', 'ready'),
    codex: status('codex', 'ready'),
  }
  async function mount(settings: AiSettings, subscriptionStatuses?: AiSubscriptionStatuses) {
    const setSettings = vi.fn<(next: AiSettings) => Promise<void>>(async () => {})
    const bridge: AiModelPickerBridge = {
      getSettings: async () => settings,
      setSettings,
    }
    await act(async () => {
      root.render(createElement(AiModelPicker, { bridge, lang: 'en', subscriptionStatuses }))
    })
    return setSettings
  }
  const chip = () => host.querySelector('.ai-model-chip-text')!.textContent
  const heads = () =>
    [...host.querySelectorAll('.ai-model-group-head')].map((el) =>
      [...el.querySelectorAll(':scope > span')].map((span) => span.textContent).filter(Boolean),
    )
  const open = () => click('.ai-model-chip')

  it('shows what the automatic selection resolves to and lists subscriptions first', async () => {
    const settings = defaultAiSettings()
    settings.providers.anthropic = { apiKey: 'k', model: 'claude-next' }
    settings.providers['claude-code'] = { apiKey: '', model: 'sonnet' }
    await mount(settings, ready)
    expect(chip()).toBe('Automatic · Claude')
    open()
    const auto = host.querySelector('.ai-model-auto')!
    expect(auto.textContent).toBe('Automatic · Claude')
    // the automatic entry is the selection, whatever model the provider under it has stored
    expect(
      [...host.querySelectorAll('.ai-model-item[aria-selected="true"]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(['Automatic · Claude'])
    // the same vendor's subscription and API key are told apart in text
    expect(heads()).toEqual([['Claude', 'Subscription'], ['Codex', 'Subscription'], ['Claude']])
    // subscription groups carry the neutral mark; only the key provider keeps its own
    const marks = [...host.querySelectorAll('.ai-model-group-head .gs-provider-logo')]
    expect(marks.map((el) => el.querySelector('svg')!.getAttribute('viewBox'))).toHaveLength(3)
    expect(marks[0]!.innerHTML).toBe(marks[1]!.innerHTML)
    expect(marks[2]!.innerHTML).not.toBe(marks[0]!.innerHTML)
  })

  it('picking a model yields the provider selection and the model', async () => {
    const setSettings = await mount(defaultAiSettings(), ready)
    open()
    const rows = [...host.querySelectorAll<HTMLButtonElement>('.ai-model-item')]
    expect(rows.map((el) => el.textContent)).toEqual([
      'Automatic · Claude',
      'Default model',
      'opus',
      'sonnet',
      'haiku',
      'Default model',
    ])
    await act(async () => rows[3]!.click())
    expect(setSettings).toHaveBeenCalledOnce()
    const saved = setSettings.mock.calls[0]![0]
    expect(saved.provider).toBe('claude-code')
    expect(saved.providers['claude-code'].model).toBe('sonnet')
    expect(chip()).toBe('sonnet')
  })

  it('writes a pick onto the settings stored now, not onto the copy it last read', async () => {
    const read = defaultAiSettings()
    // the settings page stored a key and the acknowledged notice after the picker read its copy
    const stored = defaultAiSettings()
    stored.providers.openai = { apiKey: 'stored-later', model: 'gpt-later' }
    stored.subscriptionNoticeSeen = true
    let current = read
    const setSettings = vi.fn<(next: AiSettings) => Promise<void>>(async () => {})
    const bridge: AiModelPickerBridge = { getSettings: async () => current, setSettings }
    await act(async () => {
      root.render(createElement(AiModelPicker, { bridge, lang: 'en', subscriptionStatuses: ready }))
    })
    current = stored
    open()
    const rows = [...host.querySelectorAll<HTMLButtonElement>('.ai-model-item')]
    await act(async () => rows[3]!.click())

    expect(setSettings).toHaveBeenCalledOnce()
    const saved = setSettings.mock.calls[0]![0]
    expect(saved.provider).toBe('claude-code')
    expect(saved.providers['claude-code'].model).toBe('sonnet')
    expect(saved.providers.openai).toEqual({ apiKey: 'stored-later', model: 'gpt-later' })
    expect(saved.subscriptionNoticeSeen).toBe(true)
    expect(chip()).toBe('sonnet')
  })

  it('still shows and writes a pick when the stored settings cannot be read', async () => {
    let fail = false
    const setSettings = vi.fn<(next: AiSettings) => Promise<void>>(async () => {})
    const bridge: AiModelPickerBridge = {
      getSettings: async () => {
        if (fail) throw new Error('no handler')
        return defaultAiSettings()
      },
      setSettings,
    }
    await act(async () => {
      root.render(createElement(AiModelPicker, { bridge, lang: 'en', subscriptionStatuses: ready }))
    })
    fail = true
    open()
    const rows = [...host.querySelectorAll<HTMLButtonElement>('.ai-model-item')]
    await act(async () => rows[3]!.click())
    expect(setSettings).toHaveBeenCalledOnce()
    expect(setSettings.mock.calls[0]![0].provider).toBe('claude-code')
    expect(chip()).toBe('sonnet')
  })

  it('marks an accepted metered login as paid, in the list and on the chip', async () => {
    const settings = defaultAiSettings()
    settings.provider = 'claude-code'
    settings.meteredAccepted = { 'claude-code': true }
    await mount(settings, {
      'claude-code': status('claude-code', 'metered', { meteredAccepted: true }),
    })
    expect(chip()).toBe('Claude')
    expect(host.querySelector('.ai-model-chip .ai-model-cost')!.textContent).toBe('Paid')
    open()
    expect(heads()).toEqual([['Claude', 'Paid']])
    expect(host.querySelector('.ai-model-auto')).toBeNull()
  })

  it('says to connect while the selection cannot run', async () => {
    await mount(defaultAiSettings(), { 'claude-code': status('claude-code', 'signed-out') })
    expect(chip()).toBe('Connect AI')
    open()
    expect(host.querySelectorAll('.ai-model-item:not(.ai-model-manage)')).toHaveLength(0)
  })

  describe('the Codex line', () => {
    const codexLine = () => [...host.querySelectorAll('.ai-sub-codex')].map((el) => el.textContent)

    it('is shown with the Codex subscription group, in that group', async () => {
      await mount(defaultAiSettings(), ready)
      // nothing is said before the list is open
      expect(codexLine()).toEqual([])
      open()
      expect(codexLine()).toEqual([en.codexNotice])
      const note = host.querySelector('.ai-sub-codex')!
      expect(note.classList.contains('compact')).toBe(true)
      const group = note.closest('.ai-model-group')!
      expect(group.querySelector('.ai-model-group-head')!.textContent).toContain('Codex')
      // it is a line of text, not something to pick
      expect(note.closest('.ai-model-item')).toBeNull()
      expect(note.getAttribute('role')).toBe('note')
    })

    it('follows the UI language', async () => {
      const bridge: AiModelPickerBridge = {
        getSettings: async () => defaultAiSettings(),
        setSettings: async () => {},
      }
      await act(async () => {
        root.render(
          createElement(AiModelPicker, { bridge, lang: 'ko', subscriptionStatuses: ready }),
        )
      })
      open()
      expect(codexLine()).toEqual([AI_SUBSCRIPTION_STRINGS.ko.codexNotice])
    })

    it('is shown for an accepted metered Codex login too', async () => {
      const settings = defaultAiSettings()
      settings.meteredAccepted = { codex: true }
      await mount(settings, { codex: status('codex', 'metered', { meteredAccepted: true }) })
      open()
      expect(heads()).toEqual([['Codex', 'Paid']])
      expect(codexLine()).toEqual([en.codexNotice])
    })

    it('is absent while Codex is not listed', async () => {
      await mount(defaultAiSettings(), {
        'claude-code': status('claude-code', 'ready'),
        codex: status('codex', 'signed-out'),
      })
      open()
      expect(heads()).toEqual([['Claude', 'Subscription']])
      expect(codexLine()).toEqual([])
    })

    it('is not shown for a key provider that merely carries the name', async () => {
      const settings = defaultAiSettings()
      settings.provider = 'custom'
      settings.customEndpoints = [
        { id: 'ep1', name: 'Codex', baseUrl: 'http://localhost:1234/v1', apiKey: '', model: 'm1' },
      ]
      settings.customEndpoint = 'ep1'
      await mount(settings, { 'claude-code': status('claude-code', 'ready') })
      open()
      expect(heads().flat()).toContain('Codex')
      expect(codexLine()).toEqual([])
    })

    it('is absent without subscription statuses, which list no subscription group', async () => {
      const settings = defaultAiSettings()
      settings.provider = 'codex'
      settings.providers.codex = { apiKey: '', model: 'gpt-next' }
      await mount(settings)
      open()
      expect(heads()).toEqual([])
      expect(codexLine()).toEqual([])
    })
  })

  it('lists only the key providers without subscription statuses', async () => {
    const settings = defaultAiSettings()
    settings.provider = 'anthropic'
    settings.providers.anthropic = { apiKey: 'k', model: 'claude-next' }
    const setSettings = await mount(settings)
    expect(chip()).toBe('claude-next')
    open()
    expect(heads()).toEqual([['Claude']])
    expect(host.querySelector('.ai-model-auto')).toBeNull()
    const rows = [...host.querySelectorAll<HTMLButtonElement>('.ai-model-item')]
    await act(async () => rows[1]!.click())
    expect(setSettings.mock.calls[0]![0].provider).toBe('anthropic')
  })
})
