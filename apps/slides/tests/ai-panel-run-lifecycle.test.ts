import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const agentHarness = vi.hoisted(() => ({
  events: null as null | {
    onToolExecuted?: (event: {
      call: { id: string; name: string; input: unknown }
      execution: { summary: string; output?: string; isError?: boolean; mutated?: boolean }
    }) => void
    onDone?: (result: { text: string; cancelled: boolean; turnLimit: boolean }) => void
  },
  run: vi.fn(),
  cancel: vi.fn(),
  reset: vi.fn(),
  restore: vi.fn(),
}))

vi.mock('@genoffice/agent-core', async () => {
  const actual =
    await vi.importActual<typeof import('@genoffice/agent-core')>('@genoffice/agent-core')
  return {
    ...actual,
    AgentLoop: class MockAgentLoop {
      busy = false

      constructor(options: { events?: typeof agentHarness.events }) {
        agentHarness.events = options.events ?? null
      }

      run(...args: unknown[]) {
        agentHarness.run(...args)
      }

      cancel() {
        agentHarness.cancel()
      }

      reset() {
        agentHarness.reset()
      }

      restore(...args: unknown[]) {
        agentHarness.restore(...args)
      }
    },
  }
})

// react-konva's node entry requires the native 'canvas' package; these tests do not draw.
vi.mock('react-konva', () => {
  const stub = () => null
  return {
    Stage: stub,
    Layer: stub,
    Rect: stub,
    Group: stub,
    Transformer: stub,
    Line: stub,
    Arrow: stub,
    Text: stub,
    Ellipse: stub,
    Image: stub,
    Path: stub,
    Circle: stub,
    Arc: stub,
  }
})

import { AiPanel } from '../src/renderer/ai/AiPanel'
import { AI_PROVIDERS, type AiSettings, type AttachmentMeta } from '../src/shared/ipc'

const settings: AiSettings = {
  provider: 'anthropic',
  providers: Object.fromEntries(
    // a key provider that can run: the panel starts nothing while no provider is connected
    AI_PROVIDERS.map((provider) => [
      provider.id,
      { apiKey: provider.id === 'anthropic' ? 'test-key' : '', model: provider.defaultModel },
    ]),
  ) as AiSettings['providers'],
}

const mountedRoots: Array<{ root: Root; container: HTMLElement }> = []

function mount(element: React.ReactElement): { root: Root; container: HTMLElement } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  mountedRoots.push({ root, container })
  return { root, container }
}

function panelProps(overrides: Record<string, unknown> = {}) {
  return {
    slides: [],
    current: 0,
    selectedIds: [],
    images: new Map<string, HTMLImageElement>(),
    applySlide: () => {},
    applyDeck: () => {},
    fitWidthPx: 960,
    settings,
    open: true,
    onExpand: () => {},
    onCollapse: () => {},
    ...overrides,
  }
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function installSlidesApi(): void {
  Object.defineProperty(window, 'slidesApi', {
    configurable: true,
    value: {
      beginHistoryBatch: vi.fn(async () => false),
      endHistoryBatch: vi.fn(async () => null),
      aiLogRunFailure: vi.fn(async () => undefined),
    },
  })
}

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})

beforeEach(() => {
  agentHarness.events = null
  agentHarness.run.mockReset()
  agentHarness.cancel.mockReset()
  agentHarness.reset.mockReset()
  agentHarness.restore.mockReset()
  installSlidesApi()
  Object.defineProperty(window, 'projectApi', { configurable: true, value: undefined })
  Object.defineProperty(window, 'desktop', {
    configurable: true,
    value: { readAttachmentImage: vi.fn(async () => ({ ok: false })) },
  })
})

afterEach(() => {
  for (const { root, container } of mountedRoots.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.restoreAllMocks()
})

describe('AiPanel agent run lifecycle (slides)', () => {
  it('persists a successful tool-only run so reopening can restore the completed turn', async () => {
    const appendChat = vi.fn(async () => undefined)
    Object.defineProperty(window, 'projectApi', {
      configurable: true,
      value: {
        resolveChat: vi.fn(async () => ({ projectId: 'default', chatId: 'deck-chat' })),
        loadChat: vi.fn(async () => []),
        appendChat,
        rebindChat: vi.fn(async () => ({ projectId: 'default', chatId: 'deck-chat' })),
      },
    })

    mount(createElement(AiPanel, panelProps({ currentFilePath: '/tmp/deck.pptx' })))
    await flushEffects()
    appendChat.mockClear()

    expect(agentHarness.events).not.toBeNull()
    act(() => {
      agentHarness.events!.onToolExecuted?.({
        call: { id: 'tool-1', name: 'apply_ops', input: { op: 'set_fill' } },
        execution: { summary: 'Changed the title fill', output: 'ok', mutated: true },
      })
      agentHarness.events!.onDone?.({ text: '', cancelled: false, turnLimit: false })
    })
    await flushEffects()

    expect(appendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'default',
        chatId: 'deck-chat',
        role: 'assistant',
        text: '',
        tools: [
          expect.objectContaining({
            name: 'apply_ops',
            summary: 'Changed the title fill',
            output: 'ok',
          }),
        ],
      }),
    )
  })

  it('keeps readable images and continues the run when another attachment read rejects', async () => {
    const readAttachmentImage = vi.fn(async (path: string) => {
      if (path.endsWith('good.png')) return { ok: true, base64: 'AAAA', mime: 'image/png' }
      throw new Error('attachment bridge unavailable')
    })
    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: { readAttachmentImage },
    })
    const attachments: AttachmentMeta[] = [
      { path: '/tmp/good.png', name: 'good.png', ext: 'png', sizeBytes: 128 },
      { path: '/tmp/bad.png', name: 'bad.png', ext: 'png', sizeBytes: 128 },
    ]

    mount(
      createElement(
        AiPanel,
        panelProps({
          preset: {
            text: 'Polish this slide',
            nonce: 1,
            autoRun: true,
            attachments,
          },
        }),
      ),
    )
    await flushEffects()

    expect(readAttachmentImage).toHaveBeenCalledWith('/tmp/good.png')
    expect(readAttachmentImage).toHaveBeenCalledWith('/tmp/bad.png')
    expect(agentHarness.run).toHaveBeenCalledWith('Polish this slide', [
      { base64: 'AAAA', mime: 'image/png' },
    ])
  })
})

describe('AiPanel subscription gate (slides)', () => {
  type State = 'checking' | 'not-installed' | 'signed-out' | 'ready' | 'metered' | 'error'
  const statusMap = (claude: State, codex: State) => ({
    'claude-code': { provider: 'claude-code', state: claude, meteredAccepted: false },
    codex: { provider: 'codex', state: codex, meteredAccepted: false },
  })
  const autoSettings: AiSettings = { ...settings, provider: 'auto' }
  const preset = { text: 'Polish this slide', nonce: 1, autoRun: true }

  /** the bridge with a subscription API answering `statuses`, plus a settings writer to watch */
  function installSubscription(statuses: ReturnType<typeof statusMap>) {
    const setAiSettings = vi.fn(async () => undefined)
    const api = window.slidesApi as unknown as Record<string, unknown>
    api.setAiSettings = setAiSettings
    api.aiSubscription = {
      statuses: vi.fn(async () => statuses),
      recheck: vi.fn(async () => statuses),
      login: vi.fn(async () => ({ ok: true })),
      install: vi.fn(async () => ({ ok: true })),
      setMeteredAccepted: vi.fn(async () => ({ ok: true, statuses })),
      onChanged: vi.fn(() => () => {}),
    }
    return { setAiSettings }
  }

  it('nothing connected → the connect prompt replaces the run, and no error line is shown', async () => {
    installSubscription(statusMap('signed-out', 'not-installed'))
    const { container } = mount(
      createElement(AiPanel, panelProps({ settings: autoSettings, preset })),
    )
    await flushEffects()

    expect(agentHarness.run).not.toHaveBeenCalled()
    expect(container.querySelector('.ai-sub-prompt')).not.toBeNull()
    expect(container.querySelectorAll('.ai-sub-card')).toHaveLength(2)
    expect(container.querySelector('.ai-msg-error')).toBeNull()
    expect(container.querySelector('.ai-sub-first')).toBeNull()
  })

  it('a request made while the status check is running starts once a provider is ready', async () => {
    // the notice was read earlier, so nothing but the status check stands in front of the run
    installSubscription(statusMap('ready', 'signed-out'))
    const seen: AiSettings = { ...autoSettings, subscriptionNoticeSeen: true }
    const { container } = mount(createElement(AiPanel, panelProps({ settings: seen, preset })))
    await flushEffects()

    expect(agentHarness.run).toHaveBeenCalledTimes(1)
    expect(agentHarness.run).toHaveBeenCalledWith('Polish this slide', [])
    expect(container.querySelector('.ai-sub-prompt')).toBeNull()
  })

  it('first use of a subscription → the notice comes first; acknowledging saves it and starts the request', async () => {
    const { setAiSettings } = installSubscription(statusMap('ready', 'signed-out'))
    const { container } = mount(
      createElement(AiPanel, panelProps({ settings: autoSettings, preset })),
    )
    await flushEffects()

    expect(agentHarness.run).not.toHaveBeenCalled()
    const notice = container.querySelector('.ai-sub-first')
    expect(notice).not.toBeNull()
    expect(container.querySelector('.ai-sub-prompt')).toBeNull()

    await act(async () => {
      notice!.querySelector('button')!.click()
    })
    await flushEffects()

    expect(setAiSettings).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'auto', subscriptionNoticeSeen: true }),
    )
    expect(agentHarness.run).toHaveBeenCalledTimes(1)
    expect(agentHarness.run).toHaveBeenCalledWith('Polish this slide', [])
    expect(container.querySelector('.ai-sub-first')).toBeNull()
  })
})
