import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeAiSettings,
  type AiSettings,
  type AiSubscriptionState,
  type SubscriptionStatusMap,
} from '@genoffice/ai-provider/browser'
import { AiPanel, type MarkdownAiDeps } from '../src/renderer/ai/AiPanel'

// The panel under the subscription contract, mounted against a fake preload
// bridge. No provider is ever called: the fake `aiStream` only records the
// request, and the test plays the main process's chunks back.

interface StreamRequest {
  requestId: string
  settings: AiSettings
  system: string
  tools: Array<{ name: string }>
}

type Chunk = Record<string, unknown> & { type: string }

const statusMap = (claude: AiSubscriptionState, codex: AiSubscriptionState) =>
  ({
    'claude-code': { provider: 'claude-code', state: claude, meteredAccepted: false },
    codex: { provider: 'codex', state: codex, meteredAccepted: false },
  }) as SubscriptionStatusMap

function installBridge(options: {
  settings?: Partial<AiSettings>
  statuses?: SubscriptionStatusMap
  /** omit: the capability handler is not registered (the invoke rejects) */
  imageGeneration?: boolean
}) {
  let settings: AiSettings = { ...normalizeAiSettings(undefined), ...options.settings }
  const settingsListeners = new Set<() => void>()
  const streamListeners = new Set<(chunk: Chunk) => void>()
  const requests: StreamRequest[] = []
  const subscription = {
    statuses: vi.fn(async () => options.statuses ?? statusMap('checking', 'checking')),
    recheck: vi.fn(async () => options.statuses ?? statusMap('checking', 'checking')),
    login: vi.fn(async () => ({ ok: true })),
    install: vi.fn(async () => ({ ok: true })),
    setMeteredAccepted: vi.fn(async () => ({ ok: true, statuses: options.statuses })),
    onChanged: vi.fn(() => () => {}),
    openInstallHelp: vi.fn(async () => {}),
  }
  const api = {
    getAiSettings: vi.fn(async () => settings),
    setAiSettings: vi.fn(async (next: AiSettings) => {
      settings = next
      settingsListeners.forEach((listener) => listener())
    }),
    onAiSettingsChanged: (listener: () => void) => {
      settingsListeners.add(listener)
      return () => settingsListeners.delete(listener)
    },
    openAiModelSettings: vi.fn(async () => {}),
    setAiPanelPrefs: vi.fn(async () => ({})),
    aiStream: vi.fn(async (request: StreamRequest) => {
      requests.push(request)
    }),
    aiStreamCancel: vi.fn(async () => {}),
    onAiStream: (listener: (chunk: Chunk) => void) => {
      streamListeners.add(listener)
      return () => streamListeners.delete(listener)
    },
    aiSubscription: subscription,
    aiToolCapabilities: vi.fn(async () => {
      if (options.imageGeneration === undefined) {
        throw new Error("No handler registered for 'ai:tool-capabilities'")
      }
      return { imageGeneration: { available: options.imageGeneration } }
    }),
  }
  Object.defineProperty(window, 'markdownApi', { configurable: true, value: api })
  Object.defineProperty(window, 'projectApi', { configurable: true, value: undefined })
  return {
    api,
    subscription,
    requests,
    emit: (chunk: Chunk) => [...streamListeners].forEach((listener) => listener(chunk)),
  }
}

const mounted: Array<{ root: Root; container: HTMLElement }> = []

/** let the promise chains of a mount, a click or a played-back chunk settle */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function mountPanel(): Promise<HTMLElement> {
  const deps: MarkdownAiDeps = {
    getEditor: () => null,
    getFrontmatter: () => '',
    setFrontmatter: () => {},
    getSnapshot: () => ({ body: '', frontmatter: '' }),
    restoreSnapshot: () => {},
    onRunDone: () => {},
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(createElement(AiPanel, { deps, filePath: null, onCollapse: () => {} })))
  mounted.push({ root, container })
  await settle()
  return container
}

async function sendMessage(container: HTMLElement, text: string): Promise<void> {
  const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setter.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => container.querySelector<HTMLButtonElement>('.ai-send-btn')!.click())
  await settle()
}

async function click(container: HTMLElement, selector: string): Promise<void> {
  const target = container.querySelector<HTMLElement>(selector)
  expect(target, selector).not.toBeNull()
  act(() => target!.click())
  await settle()
}

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.unstubAllGlobals()
})

describe('AiPanel under the subscription contract', () => {
  it('shows the connect prompt and starts no run while nothing is connected', async () => {
    const bridge = installBridge({ statuses: statusMap('signed-out', 'not-installed') })
    const container = await mountPanel()

    const prompt = container.querySelector('.ai-sub-prompt')
    expect(prompt?.getAttribute('data-reason')).toBe('no-subscription')

    await sendMessage(container, 'summarize this')
    expect(bridge.api.aiStream).not.toHaveBeenCalled()
    // the request stays in the composer for after the connection is made
    expect(container.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('summarize this')
    expect(container.querySelector('.ai-msg-user')).toBeNull()

    await click(container, '.ai-sub-prompt [data-action="login"]')
    expect(bridge.subscription.login).toHaveBeenCalledWith('claude-code')
    await click(container, '.ai-sub-prompt [data-action="install"]')
    expect(bridge.subscription.install).toHaveBeenCalledWith('codex')
  })

  it('reads a bridge without subscription handlers as still checking', async () => {
    const bridge = installBridge({})
    bridge.subscription.statuses.mockRejectedValue(new Error('No handler registered'))
    const container = await mountPanel()

    expect(container.querySelector('.ai-sub-prompt')).not.toBeNull()
    await sendMessage(container, 'hello')
    expect(bridge.api.aiStream).not.toHaveBeenCalled()
  })

  it('holds the first subscription run until the first-connection notice is acknowledged', async () => {
    const bridge = installBridge({ statuses: statusMap('ready', 'not-installed') })
    const container = await mountPanel()

    expect(container.querySelector('.ai-sub-prompt')).toBeNull()
    expect(container.querySelector('.ai-sub-first')).not.toBeNull()
    await sendMessage(container, 'first request')
    expect(bridge.api.aiStream).not.toHaveBeenCalled()

    await click(container, '.ai-sub-first .ai-sub-btn')
    expect(bridge.api.setAiSettings).toHaveBeenCalledTimes(1)
    expect(bridge.api.setAiSettings.mock.calls[0]![0].subscriptionNoticeSeen).toBe(true)
    expect(container.querySelector('.ai-sub-first')).toBeNull()

    await sendMessage(container, 'first request')
    expect(bridge.api.aiStream).toHaveBeenCalledTimes(1)
  })

  it('renders a blocked run with a continue button that switches the provider and reruns', async () => {
    const bridge = installBridge({
      settings: { subscriptionNoticeSeen: true },
      statuses: statusMap('ready', 'ready'),
    })
    const container = await mountPanel()
    await sendMessage(container, 'rewrite the intro')
    expect(bridge.requests).toHaveLength(1)

    act(() =>
      bridge.emit({
        requestId: bridge.requests[0]!.requestId,
        type: 'error',
        error: 'rate limited',
        errorCode: 'rate-limit',
        errorProvider: 'claude-code',
        errorResetsAt: Date.now() + 3_600_000,
      }),
    )
    await settle()

    const notice = container.querySelector('.ai-sub-blocked')
    expect(notice?.getAttribute('data-kind')).toBe('rate-limit')
    // the shared wording, not the raw message of the chunk
    expect(notice?.textContent).not.toContain('rate limited')
    expect(container.querySelector('.ai-msg-error')).toBeNull()

    await click(container, '.ai-sub-blocked [data-action="continue-with"][data-provider="codex"]')
    expect(bridge.api.setAiSettings).toHaveBeenCalledTimes(1)
    expect(bridge.api.setAiSettings.mock.calls[0]![0].provider).toBe('codex')
    expect(bridge.requests).toHaveLength(2)
    expect(bridge.requests[1]!.settings.provider).toBe('codex')
    // the notice belongs to the run that stopped: it is gone once the rerun is under way
    expect(container.querySelector('.ai-sub-blocked')).toBeNull()
  })

  it('keeps a transient failure as a plain error line', async () => {
    const bridge = installBridge({
      settings: { subscriptionNoticeSeen: true },
      statuses: statusMap('ready', 'ready'),
    })
    const container = await mountPanel()
    await sendMessage(container, 'hello')

    act(() =>
      bridge.emit({
        requestId: bridge.requests[0]!.requestId,
        type: 'error',
        errorCode: 'network',
      }),
    )
    await settle()

    expect(container.querySelector('.ai-sub-blocked')).toBeNull()
    expect(container.querySelector('.ai-msg-error')).not.toBeNull()
  })

  it('shows subscription usage near the limit and tells when the input was cut', async () => {
    const bridge = installBridge({
      settings: { subscriptionNoticeSeen: true },
      statuses: statusMap('ready', 'ready'),
    })
    const container = await mountPanel()
    await sendMessage(container, 'hello')
    const requestId = bridge.requests[0]!.requestId

    expect(container.querySelector('.ai-subscription-usage-item')).toBeNull()
    expect(container.querySelector('.ai-sub-truncated')).toBeNull()
    act(() => {
      bridge.emit({
        requestId,
        type: 'subscription-usage',
        subscriptionUsage: [
          {
            provider: 'claude-code',
            window: 'five_hour',
            utilization: 0.91,
            resetsAt: Date.now() + 60_000,
          },
          {
            provider: 'claude-code',
            window: 'seven_day',
            utilization: 0.2,
            resetsAt: Date.now() + 60_000,
          },
        ],
      })
      bridge.emit({ requestId, type: 'input-truncated' })
    })
    await settle()

    const usage = container.querySelectorAll('.ai-subscription-usage-item')
    expect(usage).toHaveLength(1)
    expect(usage[0]!.getAttribute('data-window')).toBe('five_hour')
    expect(container.querySelector('.ai-sub-truncated')).not.toBeNull()
  })

  it('offers generate_image only when the main process reports an image route', async () => {
    const withRoute = installBridge({
      settings: { subscriptionNoticeSeen: true },
      statuses: statusMap('ready', 'ready'),
      imageGeneration: true,
    })
    let container = await mountPanel()
    await sendMessage(container, 'draw a cat')
    expect(withRoute.requests[0]!.tools.map((tool) => tool.name)).toContain('generate_image')

    // no capability handler registered: unavailable, the tool is not offered
    const withoutHandler = installBridge({
      settings: { subscriptionNoticeSeen: true },
      statuses: statusMap('ready', 'ready'),
    })
    container = await mountPanel()
    await sendMessage(container, 'draw a cat')
    const request = withoutHandler.requests[0]!
    expect(request.tools.map((tool) => tool.name)).not.toContain('generate_image')
    expect(request.system).toContain('generate_image is currently unavailable')
  })

  it('names the product, not the upstream project, in the system prompt', async () => {
    const bridge = installBridge({
      settings: { subscriptionNoticeSeen: true },
      statuses: statusMap('ready', 'ready'),
    })
    const container = await mountPanel()
    await sendMessage(container, 'hello')
    expect(bridge.requests[0]!.system).toContain('IeumOffice Markdown')
    expect(bridge.requests[0]!.system).not.toContain('GenOffice')
  })
})
