// The AI panel under the subscription contract: a refusal for a missing
// connection shows the connect cards instead of an error line, a blocked run
// offers "continue with ...", the first run on a subscription waits for the
// notice, and usage / a cut input reported by the main process are shown.
// Every request goes to a mocked preload bridge: no provider is started.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Editor } from '@tiptap/core'
import type { AiSubscriptionState, SubscriptionStatusMap } from '@genoffice/ai-provider/browser'
import { editorExtensions } from '../src/renderer/editor/extensions'
import { AiPanel } from '../src/renderer/ai/AiPanel'
import {
  AI_PROVIDERS,
  type AiProviderId,
  type AiSettings,
  type AiStreamChunk,
  type AiStreamRequest,
} from '../src/shared/ipc'

type ChunkListener = (chunk: AiStreamChunk) => void

function settingsWith(
  provider: AiSettings['provider'],
  patch: Partial<AiSettings> = {},
): AiSettings {
  return {
    provider,
    providers: Object.fromEntries(
      AI_PROVIDERS.map((p) => [
        p.id,
        p.id === provider
          ? { apiKey: 'k', model: p.defaultModel || 'm' }
          : { apiKey: '', model: p.defaultModel },
      ]),
    ) as AiSettings['providers'],
    ...patch,
  }
}

function statuses(claude: AiSubscriptionState, codex: AiSubscriptionState): SubscriptionStatusMap {
  return {
    'claude-code': { provider: 'claude-code', state: claude, meteredAccepted: false },
    codex: { provider: 'codex', state: codex, meteredAccepted: false },
  }
}

function createEditor(): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: editorExtensions,
    content: {
      type: 'doc',
      content: [
        {
          type: 'docParagraph',
          attrs: { docxIndex: 0 },
          content: [{ type: 'text', text: 'EVs market research' }],
        },
      ],
    },
  })
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i++) await flush()
  })
}

interface Harness {
  container: HTMLElement
  requests: AiStreamRequest[]
  setAiSettings: ReturnType<typeof vi.fn>
  recheck: ReturnType<typeof vi.fn>
  send(text: string): Promise<void>
  cleanup(): void
}

/**
 * Mount the panel over a mocked bridge. `answer` plays the main process for
 * each request: it gets the request and a function to emit chunks with.
 */
async function mountPanel(options: {
  settings: AiSettings
  subscription?: SubscriptionStatusMap
  /** what the settings file holds, when it differs from the panel's copy */
  fileSettings?: AiSettings
  answer: (
    request: AiStreamRequest,
    emit: (chunk: Omit<AiStreamChunk, 'requestId'>) => void,
  ) => void
}): Promise<Harness> {
  const editor = createEditor()
  let listener: ChunkListener | null = null
  const requests: AiStreamRequest[] = []
  const setAiSettings = vi.fn(async () => {})
  const recheck = vi.fn(async () => options.subscription)
  const win = window as unknown as Record<string, unknown>
  win.desktop = {
    onAiStream: (l: ChunkListener) => {
      listener = l
      return () => {
        listener = null
      }
    },
    aiStream: vi.fn(async (request: AiStreamRequest) => {
      requests.push(request)
      options.answer(request, (chunk) =>
        listener?.({ ...chunk, requestId: request.requestId } as AiStreamChunk),
      )
    }),
    aiStreamCancel: vi.fn(async () => {}),
    setAiSettings,
    ...(options.fileSettings ? { getAiSettings: async () => options.fileSettings } : {}),
    openAiModelSettings: vi.fn(async () => {}),
  }
  if (options.subscription) {
    win.aiOfficeSubscription = {
      statuses: async () => options.subscription,
      recheck,
      login: vi.fn(async () => ({ ok: true })),
      install: vi.fn(async () => ({ ok: true })),
      setMeteredAccepted: vi.fn(async () => ({ ok: true, statuses: options.subscription })),
      onChanged: () => () => {},
    }
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() =>
    root.render(
      createElement(AiPanel, {
        editor,
        blocks: [],
        settings: options.settings,
        open: true,
        onExpand: () => {},
        onCollapse: () => {},
      }),
    ),
  )
  // the subscription statuses arrive asynchronously
  await settle()
  return {
    container,
    requests,
    setAiSettings,
    recheck,
    send: async (text) => {
      const textarea = container.querySelector<HTMLTextAreaElement>('.ai-input-box textarea')!
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
      act(() => {
        setter.call(textarea, text)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => container.querySelector<HTMLButtonElement>('.ai-send-btn')!.click())
      await settle()
    },
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
      editor.destroy()
    },
  }
}

beforeAll(() => {
  // jsdom's opaque origin has no localStorage; the panel reads it at mount
  let store: Record<string, string> = {}
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        store = {}
      },
    },
  })
  Element.prototype.scrollTo ??= () => {}
})

let harness: Harness | null = null
afterEach(() => {
  harness?.cleanup()
  harness = null
  const win = window as unknown as Record<string, unknown>
  delete win.desktop
  delete win.aiOfficeSubscription
})

describe('AI panel: failed runs', () => {
  it('keeps the plain error line for a key provider failure', async () => {
    harness = await mountPanel({
      settings: settingsWith('gemini' satisfies AiProviderId),
      answer: (_request, emit) => emit({ type: 'error', error: 'HTTP 429: rate limit' }),
    })
    await harness.send('summarize this')
    const { container } = harness
    expect(container.querySelector('.ai-msg-error')?.textContent).toContain('HTTP 429')
    expect(container.querySelector('.ai-sub-blocked')).toBeNull()
    expect(container.querySelector('.ai-sub-prompt')).toBeNull()
  })

  it('shows the connect cards instead of an error when nothing is connected', async () => {
    harness = await mountPanel({
      settings: settingsWith('auto'),
      subscription: statuses('not-installed', 'signed-out'),
      answer: (_request, emit) =>
        emit({ type: 'error', error: 'No AI is connected.', errorCode: 'not-connected' }),
    })
    await harness.send('summarize this')
    const { container } = harness
    expect(container.querySelector('.ai-msg-error')).toBeNull()
    expect(container.querySelector('.ai-sub-prompt')).not.toBeNull()
    expect(container.querySelectorAll('.ai-sub-card')).toHaveLength(2)
    expect(container.querySelector('[data-action="install"]')).not.toBeNull()
    expect(container.querySelector('[data-action="login"]')).not.toBeNull()
    // the refusal may rest on an out-of-date status: the panel looks again
    expect(harness.recheck).toHaveBeenCalled()
  })

  it('shows only the card of a selected subscription that cannot run', async () => {
    harness = await mountPanel({
      settings: settingsWith('codex', { subscriptionNoticeSeen: true }),
      subscription: statuses('not-installed', 'signed-out'),
      answer: (_request, emit) =>
        emit({
          type: 'error',
          error: 'Codex is not signed in.',
          errorCode: 'signed-out',
          errorProvider: 'codex',
        }),
    })
    await harness.send('summarize this')
    const cards = harness.container.querySelectorAll('.ai-sub-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]?.getAttribute('data-provider')).toBe('codex')
    // the reason is told, but there is nothing to continue on
    expect(harness.container.querySelector('.ai-sub-blocked')).not.toBeNull()
    expect(harness.container.querySelector('[data-action="continue-with"]')).toBeNull()
  })

  it('offers to continue on the other subscription and reruns the request there', async () => {
    harness = await mountPanel({
      settings: settingsWith('claude-code', { subscriptionNoticeSeen: true }),
      subscription: statuses('ready', 'ready'),
      answer: (request, emit) => {
        if (request.settings.provider === 'claude-code') {
          emit({
            type: 'error',
            error: 'limit reached',
            errorCode: 'rate-limit',
            errorProvider: 'claude-code',
            errorResetsAt: Date.now() + 3_600_000,
          })
        } else {
          emit({ type: 'delta', text: 'done on the other one' })
          emit({ type: 'done' })
        }
      },
    })
    await harness.send('summarize this')
    const { container } = harness
    expect(container.querySelector('.ai-msg-error')).toBeNull()
    // connected: the reason and the button, no connect cards
    expect(container.querySelector('.ai-sub-prompt')).toBeNull()
    const button = container.querySelector<HTMLButtonElement>(
      '.ai-sub-blocked [data-action="continue-with"]',
    )
    expect(button?.getAttribute('data-provider')).toBe('codex')

    act(() => button!.click())
    await settle()
    // the selection is stored (the model picker follows the settings file)...
    expect(harness.setAiSettings).toHaveBeenCalledTimes(1)
    expect(harness.setAiSettings.mock.calls[0]?.[0]).toMatchObject({ provider: 'codex' })
    // ...and the same request ran again on it
    expect(harness.requests).toHaveLength(2)
    expect(harness.requests[1]?.settings.provider).toBe('codex')
    expect(container.textContent).toContain('done on the other one')
    expect(container.querySelector('.ai-sub-blocked')).toBeNull()
  })

  it('never offers a key provider to continue on', async () => {
    const base = settingsWith('claude-code', { subscriptionNoticeSeen: true })
    harness = await mountPanel({
      settings: {
        ...base,
        providers: { ...base.providers, openai: { apiKey: 'sk-test', model: 'some-model' } },
      },
      subscription: statuses('ready', 'signed-out'),
      answer: (_request, emit) =>
        emit({
          type: 'error',
          error: 'limit reached',
          errorCode: 'rate-limit',
          errorProvider: 'claude-code',
        }),
    })
    await harness.send('summarize this')
    expect(harness.container.querySelector('.ai-sub-blocked')).not.toBeNull()
    expect(harness.container.querySelector('[data-action="continue-with"]')).toBeNull()
  })
})

describe('AI panel: first connection notice', () => {
  it('holds the first run on a subscription until the notice is acknowledged', async () => {
    harness = await mountPanel({
      settings: settingsWith('auto'),
      subscription: statuses('ready', 'not-installed'),
      answer: (_request, emit) => {
        emit({ type: 'delta', text: 'hello' })
        emit({ type: 'done' })
      },
    })
    await harness.send('summarize this')
    const { container } = harness
    // nothing left the PC yet
    expect(harness.requests).toHaveLength(0)
    const notice = container.querySelector('.ai-sub-first')
    expect(notice).not.toBeNull()
    // Codex history is not kept (ephemeral threads): that sentence is not shown
    expect(notice?.querySelectorAll('li')).toHaveLength(2)

    act(() => notice!.querySelector<HTMLButtonElement>('button')!.click())
    await settle()
    expect(harness.setAiSettings.mock.calls[0]?.[0]).toMatchObject({ subscriptionNoticeSeen: true })
    expect(harness.requests).toHaveLength(1)
    expect(harness.requests[0]?.settings.subscriptionNoticeSeen).toBe(true)
    expect(container.querySelector('.ai-sub-first')).toBeNull()
    expect(container.textContent).toContain('hello')
  })

  it('writes the acknowledgement over the latest settings file, as complete settings', async () => {
    const panelCopy = settingsWith('auto')
    // another window saved a key after this panel read its copy
    const fileSettings: AiSettings = {
      ...panelCopy,
      providers: { ...panelCopy.providers, openai: { apiKey: 'sk-newer', model: 'some-model' } },
    }
    harness = await mountPanel({
      settings: panelCopy,
      fileSettings,
      subscription: statuses('ready', 'not-installed'),
      answer: (_request, emit) => emit({ type: 'done' }),
    })
    await harness.send('summarize this')
    const ack = harness.container.querySelector<HTMLButtonElement>('.ai-sub-first button')!
    act(() => ack.click())
    await settle()
    expect(harness.setAiSettings).toHaveBeenCalledTimes(1)
    const written = harness.setAiSettings.mock.calls[0]?.[0] as AiSettings
    expect(written.subscriptionNoticeSeen).toBe(true)
    expect(written.providers.openai.apiKey).toBe('sk-newer')
    // a whole settings object, never a one-field patch
    expect(written.provider).toBe('auto')
    expect(Object.keys(written.providers).length).toBe(AI_PROVIDERS.length)
  })

  it('does not ask again once acknowledged, nor for a key provider', async () => {
    harness = await mountPanel({
      settings: settingsWith('auto', { subscriptionNoticeSeen: true }),
      subscription: statuses('ready', 'ready'),
      answer: (_request, emit) => emit({ type: 'done' }),
    })
    await harness.send('summarize this')
    expect(harness.requests).toHaveLength(1)
    expect(harness.container.querySelector('.ai-sub-first')).toBeNull()
    harness.cleanup()

    harness = await mountPanel({
      settings: settingsWith('gemini'),
      subscription: statuses('ready', 'ready'),
      answer: (_request, emit) => emit({ type: 'done' }),
    })
    await harness.send('summarize this')
    expect(harness.requests).toHaveLength(1)
    expect(harness.container.querySelector('.ai-sub-first')).toBeNull()
  })
})

describe('AI panel: usage and cut input', () => {
  it('shows a usage window at or above the threshold and the cut-input notice', async () => {
    harness = await mountPanel({
      settings: settingsWith('claude-code', { subscriptionNoticeSeen: true }),
      subscription: statuses('ready', 'ready'),
      answer: (_request, emit) => {
        emit({
          type: 'subscription-usage',
          subscriptionUsage: [
            {
              provider: 'claude-code',
              window: 'five_hour',
              utilization: 0.91,
              resetsAt: Date.now() + 3_600_000,
            },
            {
              provider: 'claude-code',
              window: 'seven_day',
              utilization: 0.3,
              resetsAt: Date.now() + 86_400_000,
            },
          ],
        })
        emit({ type: 'input-truncated' })
        emit({ type: 'delta', text: 'ok' })
        emit({ type: 'done' })
      },
    })
    await harness.send('summarize this')
    const { container } = harness
    const usage = container.querySelectorAll('.ai-subscription-usage-item')
    expect(usage).toHaveLength(1)
    expect(usage[0]?.getAttribute('data-window')).toBe('five_hour')
    expect(usage[0]?.textContent).toContain('91')
    expect(container.querySelector('.ai-sub-truncated')).not.toBeNull()
  })

  it('shows nothing while no subscription reports usage', async () => {
    harness = await mountPanel({
      settings: settingsWith('gemini'),
      answer: (_request, emit) => emit({ type: 'done' }),
    })
    await harness.send('summarize this')
    expect(harness.container.querySelector('.ai-subscription-usage')).toBeNull()
    expect(harness.container.querySelector('.ai-sub-truncated')).toBeNull()
  })
})
