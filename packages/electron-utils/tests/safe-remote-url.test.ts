import { describe, expect, it, vi } from 'vitest'
import { fetchWithSsrfGuard, isBlockedAddress, isSafeRemoteUrl } from '../src/safe-remote-url'

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '169.254.169.254', // cloud metadata
    '10.1.2.3',
    '172.20.0.5',
    '192.168.1.1',
    '0.0.0.0',
    '100.64.0.1',
    '255.255.255.255',
  ])('blocks non-public IPv4 %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(['::1', '::', 'fe80::1', 'fd00::1', 'ff02::1'])('blocks non-public IPv6 %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  // URL normalizes [::ffff:127.0.0.1] to ::ffff:7f00:1, so the hex form must be
  // classified through the IPv4 rules rather than read as a plain IPv6 address
  it.each([
    '::ffff:7f00:1', // ::ffff:127.0.0.1
    '::ffff:a9fe:a9fe', // ::ffff:169.254.169.254
    '::ffff:a00:1', // ::ffff:10.0.0.1
    '::7f00:1', // deprecated IPv4-compatible ::127.0.0.1
    '::a9fe:a9fe',
  ])('blocks IPv4-mapped/compatible form %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2001:4860:4860::8888'])(
    'allows public address %s',
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false)
    },
  )

  it('treats non-addresses as unsafe', () => {
    expect(isBlockedAddress('example.com')).toBe(true)
    expect(isBlockedAddress('')).toBe(true)
  })
})

describe('isSafeRemoteUrl', () => {
  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'ftp://example.com/x.png',
  ])('rejects non-http scheme %s', async (url) => {
    await expect(isSafeRemoteUrl(url)).resolves.toBe(false)
  })

  it.each([
    'http://127.0.0.1/x.png',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/x.png',
    'http://[::ffff:127.0.0.1]/x.png',
    'http://10.0.0.1/x.png',
  ])('rejects literal internal target %s', async (url) => {
    await expect(isSafeRemoteUrl(url)).resolves.toBe(false)
  })

  it.each([
    'http://localhost:8080/x.png',
    'http://foo.localhost/x.png',
    'http://printer.local/x.png',
    'http://metadata.internal/x.png',
  ])('rejects internal hostname %s', async (url) => {
    await expect(isSafeRemoteUrl(url)).resolves.toBe(false)
  })

  it.each([
    'http://localhost./x.png',
    'http://LOCALHOST./x.png',
    'http://printer.local./x.png',
    'http://metadata.internal./x.png',
  ])('rejects trailing-dot internal hostname %s without DNS', async (url) => {
    await expect(isSafeRemoteUrl(url)).resolves.toBe(false)
  })

  it('rejects malformed input and non-strings', async () => {
    await expect(isSafeRemoteUrl('not a url')).resolves.toBe(false)
    await expect(isSafeRemoteUrl(undefined)).resolves.toBe(false)
    await expect(isSafeRemoteUrl(42)).resolves.toBe(false)
  })

  it('allows a public literal address', async () => {
    await expect(isSafeRemoteUrl('https://8.8.8.8/x.png')).resolves.toBe(true)
  })
})

describe('fetchWithSsrfGuard', () => {
  const res = (status: number, location?: string) =>
    new Response(null, {
      status,
      headers: location ? { location } : undefined,
    })

  it('rejects a redirect from a public host to an internal address', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(302, 'http://169.254.169.254/latest/meta-data/'))
    const out = await fetchWithSsrfGuard('https://8.8.8.8/start.png', { fetchImpl })
    expect(out).toBeNull()
    // the internal hop is never requested
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://8.8.8.8/start.png')
  })

  it('follows a redirect between public hosts and returns the final response', async () => {
    const final = new Response('ok', { status: 200 })
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(301, 'https://1.1.1.1/final.png'))
      .mockResolvedValueOnce(final)
    const out = await fetchWithSsrfGuard('https://8.8.8.8/start.png', { fetchImpl })
    expect(out).toBe(final)
    expect(fetchImpl.mock.calls[1][0]).toBe('https://1.1.1.1/final.png')
  })

  it('resolves relative Location headers against the current URL', async () => {
    const final = new Response('ok', { status: 200 })
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(302, '/moved.png'))
      .mockResolvedValueOnce(final)
    await fetchWithSsrfGuard('https://8.8.8.8/a/b.png', { fetchImpl })
    expect(fetchImpl.mock.calls[1][0]).toBe('https://8.8.8.8/moved.png')
  })

  it('gives up on a redirect loop instead of following forever', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(302, 'https://8.8.8.8/loop.png'))
    const out = await fetchWithSsrfGuard('https://8.8.8.8/loop.png', {
      fetchImpl,
      maxRedirects: 3,
    })
    expect(out).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(4) // initial + 3 hops
  })

  it('normalizes a non-finite redirect budget instead of looping forever', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(302, 'https://8.8.8.8/loop.png'))
    const out = await fetchWithSsrfGuard('https://8.8.8.8/loop.png', {
      fetchImpl,
      maxRedirects: Infinity,
    })
    expect(out).toBeNull()
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(11) // default 5, hard cap 10
  })

  it('returns null when a redirect has no Location header', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(302))
    await expect(fetchWithSsrfGuard('https://8.8.8.8/x.png', { fetchImpl })).resolves.toBeNull()
  })

  it('passes headers through and disables automatic redirects', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('ok', { status: 200 }))
    await fetchWithSsrfGuard('https://8.8.8.8/x.png', {
      fetchImpl,
      headers: { 'User-Agent': 'test-agent' },
    })
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { 'User-Agent': 'test-agent' },
      redirect: 'manual',
    })
  })

  it('never requests a target that fails the initial check', async () => {
    const fetchImpl = vi.fn()
    await expect(
      fetchWithSsrfGuard('http://169.254.169.254/latest/meta-data/', { fetchImpl }),
    ).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not request anything when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn()
    const out = await fetchWithSsrfGuard('https://8.8.8.8/x.png', {
      fetchImpl,
      signal: controller.signal,
    })
    expect(out).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('passes the signal to every hop', async () => {
    const controller = new AbortController()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(301, 'https://1.1.1.1/final.png'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    await fetchWithSsrfGuard('https://8.8.8.8/start.png', {
      fetchImpl,
      signal: controller.signal,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    for (const call of fetchImpl.mock.calls) {
      expect(call[1]).toMatchObject({ signal: controller.signal, redirect: 'manual' })
    }
  })

  it('stops the redirect chain when the signal aborts between hops', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      controller.abort()
      return res(302, 'https://1.1.1.1/next.png')
    })
    const out = await fetchWithSsrfGuard('https://8.8.8.8/start.png', {
      fetchImpl,
      signal: controller.signal,
    })
    expect(out).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns null when an in-flight request is aborted', async () => {
    const controller = new AbortController()
    let markStarted = (): void => {}
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const fetchImpl = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          markStarted()
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          )
        }),
    ) as unknown as typeof fetch
    const pending = fetchWithSsrfGuard('https://8.8.8.8/x.png', {
      fetchImpl,
      signal: controller.signal,
    })
    await started
    controller.abort()
    await expect(pending).resolves.toBeNull()
  })

  it('chooses headers per hop and reports the hop URL and index', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(302, 'https://1.1.1.1/final.txt'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const headersForHop = vi.fn((url: string, hop: number) =>
      url.startsWith('https://api.github.com/')
        ? { Authorization: `Bearer token-${hop}` }
        : undefined,
    )
    await fetchWithSsrfGuard('https://api.github.com/repos/x', {
      fetchImpl,
      headers: { Accept: 'text/plain' },
      headersForHop,
    })
    expect(headersForHop.mock.calls).toEqual([
      ['https://api.github.com/repos/x', 0],
      ['https://1.1.1.1/final.txt', 1],
    ])
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer token-0' },
    })
    // The redirect target is not api.github.com, so the token is not sent there.
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ headers: { Accept: 'text/plain' } })
  })

  it('uses an empty per-hop header set instead of static headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('ok', { status: 200 }))
    await fetchWithSsrfGuard('https://8.8.8.8/x.png', {
      fetchImpl,
      headers: { 'User-Agent': 'test-agent' },
      headersForHop: () => ({}),
    })
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: {} })
  })

  it('keeps static headers on every hop when headersForHop is absent', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(302, 'https://1.1.1.1/final.png'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    await fetchWithSsrfGuard('https://8.8.8.8/start.png', {
      fetchImpl,
      headers: { 'User-Agent': 'test-agent' },
    })
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: { 'User-Agent': 'test-agent' } })
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ headers: { 'User-Agent': 'test-agent' } })
  })
})
