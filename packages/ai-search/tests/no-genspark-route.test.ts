/**
 * No search or media request may reach the Genspark modules any more. They
 * are still in the tree (src/gsk.ts, src/genoffice-auth.ts) for callers that
 * have not migrated; this file goes away together with them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// a signed-in Genspark CLI that would answer every request: nothing may ask it
vi.mock('../src/gsk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/gsk')>()),
  hasGskAuth: vi.fn(() => true),
  gskApiKey: vi.fn(() => 'gsk-key'),
  gskWebSearch: vi.fn(async () => ({
    results: [{ title: 'gsk', url: 'https://gsk.example.com', snippet: '' }],
  })),
  gskImageSearch: vi.fn(async () => [
    { title: 'gsk', imageUrl: 'https://gsk.example.com/a.png', sourceUrl: '', source: 'gsk' },
  ]),
  gskGenerateImage: vi.fn(async () => ({ url: 'https://gsk.example.com/a.png', taskId: '1' })),
  gskAnalyzeMedia: vi.fn(async () => 'from genspark'),
  gskTranscribe: vi.fn(async () => 'from genspark'),
}))
vi.mock('../src/genoffice-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/genoffice-auth')>()),
  genofficeApiKey: vi.fn(() => 'gsk-key'),
  loadGenofficeAuth: vi.fn(() => null),
  ensureGenofficeLogin: vi.fn(),
  startGenofficeLogin: vi.fn(() => false),
}))
vi.mock('../src/parallel-mcp', () => ({ parallelMcpSearch: vi.fn(async () => null) }))
vi.mock('@genoffice/ai-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@genoffice/ai-provider')>()),
  analyzeMediaWithProvider: vi.fn(async () => 'from the key provider'),
  generateImageWithProvider: vi.fn(async () => ({
    bytes: new Uint8Array([137, 80, 78, 71]),
    mime: 'image/png',
  })),
  streamForProvider: vi.fn(async () => {}),
}))

import * as genofficeAuth from '../src/genoffice-auth'
import * as gsk from '../src/gsk'
import {
  aiToolCapabilities,
  analyzeMediaTool,
  generateImageTool,
  imageSearch,
  imageSearchTool,
  readAiSettingsFile,
  webSearch,
  webSearchTool,
} from '../src/index'
import { dataUrl, keyMedia, status, writeSettings } from './routing-helpers'

const GSK_CALLS = [
  gsk.hasGskAuth,
  gsk.gskApiKey,
  gsk.gskWebSearch,
  gsk.gskImageSearch,
  gsk.gskGenerateImage,
  gsk.gskAnalyzeMedia,
  gsk.gskTranscribe,
  genofficeAuth.genofficeApiKey,
  genofficeAuth.loadGenofficeAuth,
  genofficeAuth.ensureGenofficeLogin,
  genofficeAuth.startGenofficeLogin,
].map((fn) => vi.mocked(fn))

/** every settings shape that used to lead to Genspark */
const SETTINGS = [
  () => writeSettings(),
  () =>
    writeSettings({
      gskToolsEnabled: true,
      search: { provider: 'genspark' },
      media: {
        imageProvider: 'genspark',
        analysisProvider: 'genspark',
        videoAnalysisProvider: 'genspark',
        providers: {},
      },
    }),
  () => writeSettings({ provider: 'genspark' }),
  // a key provider for everything: the old route was also the fallback of a failing key
  () =>
    writeSettings({
      search: { provider: 'serper', providers: { serper: { apiKey: 'k' } } },
      media: keyMedia(
        { imageProvider: 'openai', analysisProvider: 'openai', videoAnalysisProvider: 'gemini' },
        'openai',
        'gemini',
      ),
    }),
  () => '/nonexistent/ai-settings.json',
]

const CONTEXTS = [
  undefined,
  { path: 'screen' as const, statuses: { codex: status('codex', 'ready') } },
  { path: 'headless' as const, statuses: { codex: status('codex', 'ready') } },
]

beforeEach(() => {
  for (const key of ['SERPER_API_KEY', 'SERPLY_API_KEY', 'TAVILY_API_KEY', 'PARALLEL_API_KEY']) {
    vi.stubEnv(key, '')
  }
  // every backend is down: the old route was the first one asked and the last resort
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 500 })),
  )
  for (const call of GSK_CALLS) call.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the Genspark modules', () => {
  it('are not asked by a search, whatever the settings and options say', async () => {
    for (const settings of SETTINGS) {
      await webSearchTool(settings(), 'office suites')
      await imageSearchTool(settings(), 'office suites')
    }
    for (const options of [undefined, true, { useGsk: true }] as const) {
      await webSearch('office suites', 3, options)
      await imageSearch('office suites', 3, options)
    }
    for (const call of GSK_CALLS) expect(call).not.toHaveBeenCalled()
  })

  it('are not asked by generate_image', async () => {
    for (const settings of SETTINGS) {
      for (const context of CONTEXTS) {
        await generateImageTool(
          settings(),
          { prompt: 'a logo', model: 'fal-bria-rmbg', transparentBackground: true },
          { notLoggedInError: 'sign in first', context },
        )
      }
    }
    for (const call of GSK_CALLS) expect(call).not.toHaveBeenCalled()
  })

  it('are not asked by analyze_media, for images, video or an oversized request', async () => {
    const requests = [
      [dataUrl(8, 'image/png')],
      [dataUrl(8, 'video/mp4')],
      [dataUrl(8, 'audio/mpeg')],
      // over the item budget: this used to be handed back to the old route
      Array.from({ length: 13 }, () => dataUrl(8)),
    ]
    for (const settings of SETTINGS) {
      for (const context of CONTEXTS) {
        for (const mediaUrls of requests) {
          await analyzeMediaTool(settings(), { mediaUrls, requirements: 'describe' }, { context })
        }
      }
    }
    for (const call of GSK_CALLS) expect(call).not.toHaveBeenCalled()
  })

  it('are not asked by the capability report', () => {
    for (const settings of SETTINGS) {
      for (const context of CONTEXTS) {
        aiToolCapabilities(readAiSettingsFile(settings()), context)
      }
    }
    for (const call of GSK_CALLS) expect(call).not.toHaveBeenCalled()
  })
})
