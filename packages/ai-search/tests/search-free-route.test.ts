import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/parallel-mcp', () => ({ parallelMcpSearch: vi.fn() }))

import { defaultAiSettings, normalizeAiSettings } from '@genoffice/ai-provider'
import { imageSearch, webSearch } from '../src/index'
import { parallelMcpSearch } from '../src/parallel-mcp'
import { imageSearchTool, searchOptionsFromSettings, webSearchTool } from '../src/search-tools'
import { writeSettings } from './routing-helpers'

const parallelFree = vi.mocked(parallelMcpSearch)
const KEY_ENV = [
  'SERPER_API_KEY',
  'SERPLY_API_KEY',
  'TAVILY_API_KEY',
  'PARALLEL_API_KEY',
  'EXA_API_KEY',
  'FIRECRAWL_API_KEY',
]

const DUCK_HTML = '<a class="result__a" href="https://duck.example.com">Duck</a>'
const DUCK_IMAGES = {
  results: [
    { title: 'Duck', image: 'https://duck.example.com/a.png', url: 'https://duck.example.com' },
  ],
}

/** DuckDuckGo answers; every keyed backend would fail the test by being asked */
function stubDuckDuckGo() {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = String(input)
    if (url.startsWith('https://html.duckduckgo.com/')) return new Response(DUCK_HTML)
    if (url.startsWith('https://duckduckgo.com/i.js')) return Response.json(DUCK_IMAGES)
    if (url.startsWith('https://duckduckgo.com/')) return new Response('vqd="123-456"')
    throw new Error(`unexpected request to ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeEach(() => {
  for (const key of KEY_ENV) vi.stubEnv(key, '')
  parallelFree.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the default search route', () => {
  it('is the keyless chain for fresh settings and for a file that names the removed provider', () => {
    const free = { useGsk: false, parallelKey: '', prefer: 'parallel' }
    expect(searchOptionsFromSettings(normalizeAiSettings(undefined))).toEqual(free)
    // the stored default before the subscription providers existed
    expect(defaultAiSettings().search?.provider).toBe('genspark')
    expect(searchOptionsFromSettings(defaultAiSettings())).toEqual(free)
    expect(searchOptionsFromSettings({ ...defaultAiSettings(), gskToolsEnabled: false })).toEqual(
      free,
    )
  })

  it('asks free Parallel search first', async () => {
    const fetch = stubDuckDuckGo()
    parallelFree.mockResolvedValue({
      results: [{ title: 'P', url: 'https://parallel.example.com', excerpts: ['one'] }],
    })
    const r = await webSearchTool(writeSettings(), 'office suites', 3)
    expect(r).toEqual({
      results: [{ title: 'P', url: 'https://parallel.example.com', snippet: 'one' }],
      method: 'parallel',
    })
    expect(parallelFree).toHaveBeenCalledWith('office suites')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('falls to DuckDuckGo when free Parallel search fails', async () => {
    stubDuckDuckGo()
    parallelFree.mockRejectedValue(new Error('mcp down'))
    const r = await webSearchTool(writeSettings(), 'office suites', 3)
    expect(r).toEqual({
      results: [{ title: 'Duck', url: 'https://duck.example.com', snippet: '' }],
      method: 'duckduckgo',
    })
  })

  it('searches images without a key', async () => {
    stubDuckDuckGo()
    const r = await imageSearchTool(writeSettings(), 'ducks', 3)
    expect(r.method).toBe('duckduckgo')
    expect(r.images).toEqual([
      {
        title: 'Duck',
        imageUrl: 'https://duck.example.com/a.png',
        sourceUrl: 'https://duck.example.com',
        source: 'duck.example.com',
      },
    ])
  })

  it('is what a settings file that selected the removed provider gets', async () => {
    stubDuckDuckGo()
    parallelFree.mockResolvedValue(null)
    const settings = writeSettings({ gskToolsEnabled: true, search: { provider: 'genspark' } })
    expect((await webSearchTool(settings, 'q')).method).toBe('duckduckgo')
    expect((await imageSearchTool(settings, 'q')).method).toBe('duckduckgo')
  })
})

describe('webSearch / imageSearch called directly', () => {
  it('ignores the old useGsk option, in every spelling', async () => {
    stubDuckDuckGo()
    parallelFree.mockResolvedValue(null)
    for (const options of [undefined, true, { useGsk: true }, {}] as const) {
      expect((await webSearch('q', 3, options)).method).toBe('duckduckgo')
      expect((await imageSearch('q', 3, options)).method).toBe('duckduckgo')
    }
  })
})

describe('a key search provider the user selected', () => {
  it('runs first, with the free chain behind it', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input)
      if (url === 'https://google.serper.dev/search') {
        return Response.json({ organic: [{ title: 'S', link: 'https://s.example.com' }] })
      }
      throw new Error(`unexpected request to ${url}`)
    })
    vi.stubGlobal('fetch', fetch)
    const settings = writeSettings({
      search: { provider: 'serper', providers: { serper: { apiKey: 'user-key' } } },
    })
    const r = await webSearchTool(settings, 'q', 3)
    expect(r.method).toBe('serper')
    expect(new Headers(fetch.mock.calls[0]![1]!.headers).get('X-API-KEY')).toBe('user-key')
    expect(parallelFree).not.toHaveBeenCalled()
  })
})
