import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import {
  defaultAiSettings,
  type AiSettings,
  type AiStreamChunk,
  type AiStreamRequest,
  type AiSubscriptionProviderId,
  type AiSubscriptionState,
} from '@genoffice/ai-provider'
import type { SubscriptionStatusMap } from '@genoffice/ai-provider/browser'
import { aiRunErrorText, aiSubscriptionText } from '@genoffice/ui'
import { AiPanel, type HtmlAiDeps } from '../src/renderer/ai/AiPanel'
import { buildParseMap, type ParseMap } from '../src/renderer/document/parse-map'

/**
 * The panel end to end, against a scripted main process: what the user sees
 * when nothing is connected, the first time a subscription is used, and when a
 * run is stopped by its connection. The provider itself is never reached — the
 * stream channel is the fake below.
 */

// the panel's own language outside a LocaleProvider is the app default
const LANG = 'zh'
const DOC = '<!doctype html><html><head><title>T</title></head><body><h1>Hello</h1></body></html>'

const statusMap = (
  claude: AiSubscriptionState,
  codex: AiSubscriptionState,
): SubscriptionStatusMap => ({
  'claude-code': { provider: 'claude-code', state: claude, meteredAccepted: false },
  codex: { provider: 'codex', state: codex, meteredAccepted: false },
})

type Reply = (request: AiStreamRequest, nth: number) => Array<Partial<AiStreamChunk>>

function fakeMain(opts: { settings: AiSettings; statuses: SubscriptionStatusMap; reply?: Reply }) {
  let settings = opts.settings
  const settingsListeners = new Set<() => void>()
  let streamListener: ((chunk: AiStreamChunk) => void) | null = null
  const requests: AiStreamRequest[] = []
  const saved: AiSettings[] = []
  const subscription = {
    statuses: vi.fn(async () => opts.statuses),
    recheck: vi.fn(async () => opts.statuses),
    login: vi.fn(async (_provider: AiSubscriptionProviderId) => ({ ok: true })),
    install: vi.fn(async (_provider: AiSubscriptionProviderId) => ({ ok: true })),
    setMeteredAccepted: vi.fn(async () => ({ ok: true, statuses: opts.statuses })),
    onChanged: () => () => undefined,
    openInstallHelp: vi.fn(async () => undefined),
  }
  const htmlApi = {
    getAiSettings: async () => settings,
    setAiSettings: async (next: AiSettings) => {
      settings = next
      saved.push(next)
      for (const listener of settingsListeners) listener()
    },
    onAiSettingsChanged: (handler: () => void) => {
      settingsListeners.add(handler)
      return () => settingsListeners.delete(handler)
    },
    openAiModelSettings: vi.fn(async () => undefined),
    setAiPanelPrefs: vi.fn(async () => ({})),
    subscription,
    onAiStream: (listener: (chunk: AiStreamChunk) => void) => {
      streamListener = listener
      return () => {
        streamListener = null
      }
    },
    aiStream: async (request: AiStreamRequest) => {
      requests.push(request)
      const chunks = opts.reply?.(request, requests.length) ?? [
        { type: 'delta', text: 'ok' },
        { type: 'done' },
      ]
      for (const chunk of chunks) {
        streamListener?.({ requestId: request.requestId, ...chunk } as AiStreamChunk)
      }
    },
    aiStreamCancel: async () => undefined,
  }
  return { htmlApi, subscription, requests, saved }
}

function fakeDeps(): HtmlAiDeps {
  let map: ParseMap | null = null
  return {
    access: {
      getText: () => DOC,
      getVersion: () => 1,
      getMap: () => (map ??= buildParseMap(DOC, 1, null)),
      getLastManualVersion: () => 0,
      getFilePath: () => null,
      getSelectedSid: () => null,
      applyOps: () => ({ ok: true, ranges: [] }),
      replaceAll: () => undefined,
    },
    getSnapshot: () => ({ text: DOC }),
    restoreSnapshot: () => undefined,
    onPrompt: () => undefined,
    onRunDone: () => undefined,
    clearHighlights: () => undefined,
    navigateTo: () => undefined,
    onBriefConfirmed: () => undefined,
    previewDraft: () => undefined,
  }
}

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // jsdom has no layout: the chat's stick-to-bottom scroll has nothing to do here
  Element.prototype.scrollTo = () => undefined
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  delete (window as { htmlApi?: unknown }).htmlApi
  vi.unstubAllGlobals()
})

/** let the panel's promise chains (settings read, status read, stream chunks) settle */
async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function mountPanel(main: ReturnType<typeof fakeMain>) {
  Object.assign(window, { htmlApi: main.htmlApi })
  act(() =>
    root.render(
      createElement(AiPanel, {
        deps: fakeDeps(),
        filePath: null,
        editQueue: [],
        onQueueEditInstruction: () => undefined,
        onQueueRemove: () => undefined,
        onQueueClear: () => undefined,
        onQueueFocus: () => undefined,
        onQueueConsume: () => undefined,
        onCollapse: () => undefined,
      }),
    ),
  )
  await settle()
}

const composer = () => host.querySelector<HTMLTextAreaElement>('.ai-input-box textarea')!

async function sendMessage(text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  act(() => {
    setter?.call(composer(), text)
    composer().dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => host.querySelector<HTMLButtonElement>('.ai-send-btn')!.click())
  await settle()
}

const ready = (patch: Partial<AiSettings> = {}): AiSettings => ({
  ...defaultAiSettings(),
  subscriptionNoticeSeen: true,
  ...patch,
})

describe('AI panel without a connection', () => {
  it('shows the connect prompt with both cards and sends nothing', async () => {
    const main = fakeMain({ settings: ready(), statuses: statusMap('signed-out', 'not-installed') })
    await mountPanel(main)
    const prompt = host.querySelector('.ai-sub-prompt')
    expect(prompt).not.toBeNull()
    expect(prompt!.querySelectorAll('.ai-sub-card')).toHaveLength(2)

    await sendMessage('make it blue')
    expect(main.requests).toHaveLength(0)
    // the request is not lost: it stays in the composer, and no error bubble appears
    expect(composer().value).toBe('make it blue')
    expect(host.querySelector('.ai-msg-error')).toBeNull()
  })

  it('wires the card actions to the subscription bridge', async () => {
    const main = fakeMain({ settings: ready(), statuses: statusMap('signed-out', 'not-installed') })
    await mountPanel(main)
    const card = (provider: string) =>
      host.querySelector(`.ai-sub-card[data-provider="${provider}"]`)!
    act(() =>
      card('claude-code').querySelector<HTMLButtonElement>('[data-action="login"]')!.click(),
    )
    await settle()
    expect(main.subscription.login).toHaveBeenCalledWith('claude-code')
    act(() => card('codex').querySelector<HTMLButtonElement>('[data-action="install"]')!.click())
    await settle()
    expect(main.subscription.install).toHaveBeenCalledWith('codex')
  })

  it('shows nothing and lets the main process decide while the statuses are unknown', async () => {
    const main = fakeMain({
      settings: ready(),
      statuses: statusMap('checking', 'checking'),
      reply: () => [{ type: 'error', errorCode: 'not-connected' }],
    })
    await mountPanel(main)
    expect(host.querySelector('.ai-sub-prompt')).toBeNull()

    await sendMessage('make it blue')
    expect(main.requests).toHaveLength(1)
    // the answer is the blocked notice with the shared wording, not a raw error line
    const notice = host.querySelector('.ai-sub-blocked')
    expect(notice).not.toBeNull()
    expect(notice!.textContent).toContain(aiRunErrorText(LANG, { kind: 'not-connected' }))
  })
})

describe('AI panel on a first subscription use', () => {
  it('holds the request until the notice is acknowledged, then remembers it', async () => {
    const main = fakeMain({
      settings: ready({ subscriptionNoticeSeen: false }),
      statuses: statusMap('ready', 'not-installed'),
    })
    await mountPanel(main)
    expect(host.querySelector('.ai-sub-first')).not.toBeNull()
    expect(host.querySelector('.ai-sub-prompt')).toBeNull()
    // Codex keeps no conversation history on this PC, so the notice does not claim it does
    expect(host.querySelector('.ai-sub-first')!.textContent).not.toContain(
      aiSubscriptionText(LANG, 'noticeCodexHistory'),
    )

    await sendMessage('make it blue')
    expect(main.requests).toHaveLength(0)

    act(() => host.querySelector<HTMLButtonElement>('.ai-sub-first button')!.click())
    await settle()
    expect(main.saved.at(-1)?.subscriptionNoticeSeen).toBe(true)
    expect(host.querySelector('.ai-sub-first')).toBeNull()

    await sendMessage('make it blue')
    expect(main.requests).toHaveLength(1)
  })
})

describe('AI panel when a run is blocked', () => {
  it('shows the reason and continues on the other subscription only when asked', async () => {
    const resetsAt = Date.now() + 2 * 60 * 60 * 1000
    const main = fakeMain({
      settings: ready(),
      statuses: statusMap('ready', 'ready'),
      reply: (_request, nth) =>
        nth === 1
          ? [
              {
                type: 'error',
                error: 'raw CLI text',
                errorCode: 'rate-limit',
                errorProvider: 'claude-code',
                errorResetsAt: resetsAt,
              },
            ]
          : [{ type: 'delta', text: 'done on the other one' }, { type: 'done' }],
    })
    await mountPanel(main)
    await sendMessage('make it blue')

    // one request, stopped: nothing switched on its own
    expect(main.requests).toHaveLength(1)
    expect(main.saved).toHaveLength(0)
    const notice = host.querySelector('.ai-sub-blocked')!
    expect(notice.getAttribute('data-kind')).toBe('rate-limit')
    expect(notice.textContent).toContain(
      aiRunErrorText(LANG, { kind: 'rate-limit', provider: 'claude-code', resetsAt }),
    )
    expect(notice.textContent).not.toContain('raw CLI text')

    const button = notice.querySelector<HTMLButtonElement>('[data-action="continue-with"]')!
    expect(button.getAttribute('data-provider')).toBe('codex')
    act(() => button.click())
    await settle()

    // the selection is stored (so the model picker shows it) and the same request runs again
    expect(main.saved.at(-1)?.provider).toBe('codex')
    expect(main.requests).toHaveLength(2)
    expect(main.requests[1]!.settings.provider).toBe('codex')
    const sent = (request: AiStreamRequest) =>
      request.messages.filter((m) => m.role === 'user').at(-1)?.text
    expect(sent(main.requests[1]!)).toContain('make it blue')
    expect(host.querySelector('.ai-sub-blocked')).toBeNull()
    expect(host.textContent).toContain('done on the other one')
  })

  it('stops the run where the brief writer was blocked, without a retry or another turn', async () => {
    const main = fakeMain({
      settings: ready(),
      statuses: statusMap('ready', 'ready'),
      reply: (_request, nth) =>
        nth === 1
          ? [
              {
                type: 'tool-call',
                toolCall: { id: 'c1', name: 'plan_page', input: { mode: 'redesign' } },
              },
              { type: 'done' },
            ]
          : [
              {
                type: 'error',
                error: 'raw',
                errorCode: 'signed-out',
                errorProvider: 'claude-code',
              },
            ],
    })
    await mountPanel(main)
    await sendMessage('rebuild the whole page')

    // the chat turn, then exactly one brief-writer request: no second attempt, no turn after it
    expect(main.requests).toHaveLength(2)
    expect(main.requests[1]!.tools ?? []).toHaveLength(0)
    const notice = host.querySelector('.ai-sub-blocked')!
    expect(notice.getAttribute('data-kind')).toBe('signed-out')
    expect(notice.textContent).toContain(
      aiRunErrorText(LANG, { kind: 'signed-out', provider: 'claude-code' }),
    )
    expect(
      notice.querySelector('[data-action="continue-with"]')!.getAttribute('data-provider'),
    ).toBe('codex')
    // the composer is usable again
    expect(host.querySelector('.ai-stop-btn')).toBeNull()
  })

  it('keeps an ordinary failure as a plain error line', async () => {
    const main = fakeMain({
      settings: ready(),
      statuses: statusMap('ready', 'ready'),
      reply: () => [{ type: 'error', errorCode: 'network' }],
    })
    await mountPanel(main)
    await sendMessage('make it blue')
    expect(host.querySelector('.ai-sub-blocked')).toBeNull()
    expect(host.querySelector('.ai-msg-error')).not.toBeNull()
  })
})

describe('AI panel during a turn', () => {
  it('shows subscription usage from 80% and the input-truncated notice', async () => {
    const resetsAt = Date.now() + 60 * 60 * 1000
    const main = fakeMain({
      settings: ready(),
      statuses: statusMap('ready', 'ready'),
      reply: () => [
        { type: 'input-truncated' },
        {
          type: 'subscription-usage',
          subscriptionUsage: [
            { provider: 'claude-code', window: 'five_hour', utilization: 0.83, resetsAt },
            { provider: 'claude-code', window: 'seven_day', utilization: 0.4, resetsAt },
          ],
        },
        { type: 'delta', text: 'ok' },
        { type: 'done' },
      ],
    })
    await mountPanel(main)
    expect(host.querySelector('.ai-subscription-usage')).toBeNull()
    await sendMessage('make it blue')

    const usage = host.querySelectorAll('.ai-subscription-usage-item')
    expect(usage).toHaveLength(1)
    expect(usage[0]!.getAttribute('data-window')).toBe('five_hour')
    expect(usage[0]!.textContent).toContain('83')
    expect(host.querySelector('.ai-sub-truncated')).not.toBeNull()
  })

  it('names no vendor in the panel header', async () => {
    const main = fakeMain({ settings: ready(), statuses: statusMap('ready', 'ready') })
    await mountPanel(main)
    expect(host.querySelector('.ai-panel-title')!.textContent).toBe('AI')
  })
})
