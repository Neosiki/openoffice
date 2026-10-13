import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCodexImageGenerationAvailable } from '@genoffice/ai-provider'
import {
  detectSubscriptionLogin,
  type SubscriptionDetection,
} from '@genoffice/ai-provider/subscription'
import * as aiSearch from '@genoffice/ai-search'
import { run, tempDir } from './helpers'

// capabilities asks the subscription CLIs for their status when a subscription could answer;
// the check is replaced so no test starts a real one
const fakes = vi.hoisted(() => ({ detect: vi.fn() }))

vi.mock('@genoffice/ai-provider/subscription', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@genoffice/ai-provider/subscription')>()),
  detectSubscriptionLogin: fakes.detect,
}))

const READY: Record<string, SubscriptionDetection> = {
  'claude-code': { provider: 'claude-code', state: 'ready', loginMethod: 'subscription' },
  codex: { provider: 'codex', state: 'ready', loginMethod: 'subscription' },
}

const IMAGE_GENERATION_HINT =
  'Image generation is unavailable: add an image provider key under Settings > AI > Advanced. Use image search for imagery instead.'
const IMAGE_ANALYSIS_HINT =
  'Image analysis is unavailable: select an image analysis provider key under Settings > AI > Advanced. Command-line and integration requests use a subscription login only after that is turned on under Settings > AI > Advanced.'
const VIDEO_ANALYSIS_HINT =
  'Video and audio analysis is unavailable: it needs a key provider that reads video (for example Gemini), selected as the video analysis provider under Settings > AI > Advanced.'

beforeEach(() => {
  expect(vi.isMockFunction(detectSubscriptionLogin)).toBe(true)
  fakes.detect.mockReset()
  fakes.detect.mockImplementation(async (provider: string) => READY[provider])
})
afterEach(() => {
  vi.restoreAllMocks()
  aiSearch.registerCodexImageGenerator(null)
  setCodexImageGenerationAvailable(false)
})

// a real settings file always carries the chat provider block; without it every section resets to defaults
function settingsFile(dir: string, settings: Record<string, unknown>): string {
  const path = join(dir, 'ai-settings.json')
  writeFileSync(path, JSON.stringify({ provider: 'auto', providers: {}, ...settings }))
  return path
}

function envFor(settings: string, app = ''): NodeJS.ProcessEnv {
  return { ...process.env, GENOFFICE_AI_SETTINGS: settings, GENOFFICE_APP_BIN: app }
}

describe('genoffice capabilities', () => {
  it('pins the shape for a machine with nothing set: free search, the rest unavailable with its hint', async () => {
    const dir = tempDir()
    const settings = join(dir, 'missing.json')
    const r = await run(['capabilities', '--json'], { env: envFor(settings) })
    expect(r.code).toBe(0)
    expect(r.json()).toEqual({
      status: 'ok',
      command: 'capabilities',
      // a checkout finds its own development build; an installed command line may find no app
      summary: expect.stringMatching(
        /^available: search, image_search(, app)?; unavailable: image_generation, image_analysis, video_analysis(, app)?$/,
      ),
      detail: {
        search: { available: true, via: 'parallel', route: 'free' },
        image_search: { available: true, via: 'duckduckgo', route: 'free' },
        image_generation: {
          available: false,
          via: null,
          route: null,
          message: IMAGE_GENERATION_HINT,
        },
        media_analysis: { available: false, via: null, route: null, message: IMAGE_ANALYSIS_HINT },
        image_analysis: { available: false, via: null, route: null, message: IMAGE_ANALYSIS_HINT },
        video_analysis: { available: false, via: null, route: null, message: VIDEO_ANALYSIS_HINT },
        automatic_calls: { subscription_enabled: false },
        app: { available: expect.any(Boolean) },
        settings_path: settings,
      },
    })
    // the switch is off and no CLI is selected: nothing is asked of them
    expect(fakes.detect).not.toHaveBeenCalled()
  })

  it('answers with the text the tools themselves answer with', async () => {
    const dir = tempDir()
    const env = { ...envFor(join(dir, 'missing.json')), GENOFFICE_AUDIT_LOG: 'off' }
    const photo = join(dir, 'photo.png')
    writeFileSync(photo, 'not really a png')
    const caps = (await run(['capabilities', '--json'], { env })).json().detail
    const image = await run(['image', 'a cat', '--out', join(dir, 'cat.png'), '--json'], { env })
    expect(image.json().message).toBe(caps.image_generation.message)
    const media = await run(['media', photo, '--json'], { env })
    expect(media.json().message).toBe(caps.image_analysis.message)
  })

  it('reports key routes by provider', async () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'bin'))
    const settings = settingsFile(dir, {
      search: {
        provider: 'serper',
        providers: { serper: { apiKey: 'k' }, tavily: { apiKey: '' } },
      },
      media: {
        imageProvider: 'openai',
        analysisProvider: 'openai',
        videoAnalysisProvider: 'gemini',
        providers: {
          openai: { apiKey: 'sk', imageModel: 'gpt-image-1' },
          gemini: { apiKey: 'g' },
        },
      },
    })
    const r = await run(['capabilities', '--json'], {
      env: envFor(settings, join(dir, 'bin', 'app')),
    })
    expect(r.code).toBe(0)
    const d = r.json().detail
    expect(d.search).toEqual({ available: true, via: 'serper', route: 'key' })
    expect(d.image_search).toEqual({ available: true, via: 'serper', route: 'key' })
    expect(d.image_generation).toEqual({ available: true, via: 'openai', route: 'key' })
    expect(d.image_analysis).toEqual({ available: true, via: 'openai', route: 'key' })
    expect(d.media_analysis).toEqual(d.image_analysis)
    expect(d.video_analysis).toEqual({ available: true, via: 'gemini', route: 'key' })
    expect(d.app.available).toBe(true)
    expect(r.json().summary).toBe(
      'available: search, image_search, image_generation, image_analysis, video_analysis, app',
    )
    expect(fakes.detect).not.toHaveBeenCalled()
  })

  it('counts a Serply key as search + image search', async () => {
    const settings = settingsFile(tempDir(), {
      search: { provider: 'serply', providers: { serply: { apiKey: 'k' } } },
    })
    const d = (await run(['capabilities', '--json'], { env: envFor(settings) })).json().detail
    expect(d.search).toEqual({ available: true, via: 'serply', route: 'key' })
    expect(d.image_search).toEqual({ available: true, via: 'serply', route: 'key' })
  })

  it.each(['tavily', 'parallel'])(
    '%s with a key answers web search, images stay on the free route',
    async (provider) => {
      const settings = settingsFile(tempDir(), {
        search: { provider, providers: { [provider]: { apiKey: 'test-key' } } },
      })
      const d = (await run(['capabilities', '--json'], { env: envFor(settings) })).json().detail
      expect(d.search).toEqual({ available: true, via: provider, route: 'key' })
      expect(d.image_search).toEqual({ available: true, via: 'duckduckgo', route: 'free' })
    },
  )

  it('falls back to media_analysis from video when only video analysis is set up', async () => {
    const settings = settingsFile(tempDir(), {
      media: { videoAnalysisProvider: 'gemini', providers: { gemini: { apiKey: 'g' } } },
    })
    const d = (await run(['capabilities', '--json'], { env: envFor(settings) })).json().detail
    expect(d.image_analysis.available).toBe(false)
    expect(d.video_analysis).toEqual({ available: true, via: 'gemini', route: 'key' })
    expect(d.media_analysis).toEqual(d.video_analysis)
  })

  it('reports the subscription routes and the hourly allowance when the switch is on', async () => {
    setCodexImageGenerationAvailable(true)
    aiSearch.registerCodexImageGenerator(async () => ({ url: 'https://example.invalid/x.png' }))
    const dir = tempDir()
    const settings = settingsFile(dir, { headlessSubscriptionEnabled: true })
    const first = (await run(['capabilities', '--json'], { env: envFor(settings) })).json().detail
    expect(first.image_generation).toEqual({ available: true, via: 'codex', route: 'subscription' })
    expect(first.image_analysis).toEqual({
      available: true,
      via: 'claude-code',
      route: 'subscription',
    })
    expect(first.media_analysis).toEqual(first.image_analysis)
    expect(first.video_analysis.available).toBe(false)
    expect(first.automatic_calls).toEqual({
      subscription_enabled: true,
      used: 0,
      limit: 20,
      remaining: 20,
    })
    expect(fakes.detect.mock.calls.map((call) => call[0]).sort()).toEqual(['claude-code', 'codex'])

    for (let i = 0; i < aiSearch.HEADLESS_SUBSCRIPTION_MAX_PER_HOUR; i++) {
      await aiSearch.runHeadlessSubscriptionCall(dir, async () => undefined)
    }
    const spent = (await run(['capabilities', '--json'], { env: envFor(settings) })).json().detail
    expect(spent.automatic_calls).toEqual({
      subscription_enabled: true,
      used: 20,
      limit: 20,
      remaining: 0,
      resetsAt: expect.any(Number),
    })
    expect(spent.automatic_calls.resetsAt).toBeGreaterThan(Date.now())
    // a used-up allowance is an error of the request, not a missing capability
    expect(spent.image_analysis.available).toBe(true)
  })

  it('reports a signed-out subscription as unavailable even with the switch on', async () => {
    fakes.detect.mockImplementation(async (provider: string) => ({ provider, state: 'signed-out' }))
    const settings = settingsFile(tempDir(), { headlessSubscriptionEnabled: true })
    const d = (await run(['capabilities', '--json'], { env: envFor(settings) })).json().detail
    expect(d.image_analysis).toMatchObject({ available: false, via: null, route: null })
    expect(d.image_analysis.message).toContain('no AI provider is connected')
    expect(d.automatic_calls.subscription_enabled).toBe(true)
  })

  it('makes no network call and starts no model: only the status check may run', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const analyze = vi.spyOn(aiSearch, 'analyzeMediaTool')
    const generate = vi.spyOn(aiSearch, 'generateImageTool')
    const web = vi.spyOn(aiSearch, 'webSearchTool')
    const settings = settingsFile(tempDir(), { headlessSubscriptionEnabled: true })
    expect((await run(['capabilities', '--json'], { env: envFor(settings) })).code).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(analyze).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
    expect(web).not.toHaveBeenCalled()
  })
})
