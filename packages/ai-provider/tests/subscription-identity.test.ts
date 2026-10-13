/**
 * Nothing the CLI prints about the account may leave the status check: not in
 * the status, not in an error text, not in the acceptance file. These cases
 * feed output that is NOT in the expected shape, where a "scrub the known
 * patterns" approach lets an organisation name through.
 */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultAiSettings } from '../src/providers'
import {
  METERED_LOGIN_FINGERPRINTS,
  SUBSCRIPTION_LOGIN_KINDS,
  SUBSCRIPTION_METERED_FILE,
  codexAccountInfo,
  createMeteredAcceptanceFileStore,
  createSubscriptionStatusService,
  detectSubscriptionLogin,
  meteredLoginFingerprint,
  parseClaudeAuthStatus,
  parseCodexLoginStatus,
  subscriptionStatusErrorKind,
  type MeteredAcceptanceRecord,
  type SubscriptionCommandResult,
  type SubscriptionDetection,
  type SubscriptionProgram,
  type SubscriptionRunner,
} from '../src/subscription'
import type { AiSubscriptionProviderId } from '../src/types'

/** Pieces of the fake identities used below, including how a slug of them would look */
const IDENTIFIERS = [
  'jun.il',
  'school.kr',
  'ilschool',
  'acme',
  'hagwon',
  'seoul',
  'someone',
  'example.com',
  '0f8fad5b',
  'sk-proj',
]

function expectNoIdentity(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase()
  for (const identifier of IDENTIFIERS) expect(text).not.toContain(identifier)
}

function program(provider: AiSubscriptionProviderId): SubscriptionProgram {
  const command = provider === 'codex' ? '/fake/codex' : '/fake/claude'
  return { provider, command, prefixArgs: [], env: {}, entry: command, source: 'path' }
}

const found = async (provider: AiSubscriptionProviderId) => program(provider)

function cli(status: SubscriptionCommandResult | Error, version: string): SubscriptionRunner {
  return async (_program, args) => {
    if (args[0] === '--version') return { code: 0, stdout: version, stderr: '' }
    if (status instanceof Error) throw status
    return status
  }
}

const claude = (status: SubscriptionCommandResult | Error): Promise<SubscriptionDetection> =>
  detectSubscriptionLogin('claude-code', {
    locate: found,
    run: cli(status, '2.1.287 (Claude Code)\n'),
  })

const codex = (status: SubscriptionCommandResult | Error): Promise<SubscriptionDetection> =>
  detectSubscriptionLogin('codex', { locate: found, run: cli(status, 'codex-cli 0.159.2\n') })

const UNRECOGNISED_CODEX_LINE = 'Logged in using access token for jun.il@school.kr (Acme Org)\n'

describe('output that is not in the expected shape', () => {
  it('malformed JSON naming an organisation does not reach the error text', async () => {
    const detection = await claude({
      code: 0,
      stdout:
        '{"loggedIn":"yes","authMethod":"claude.ai","email":"someone@example.com","orgId":"0f8fad5b-d9cb-469f-a165-70867728950e","orgName":"Acme Hagwon Seoul","subscriptionType":"max"}',
      stderr: '',
    })
    expect(detection.state).toBe('error')
    expect(subscriptionStatusErrorKind(detection)).toBe('failed')
    expectNoIdentity(detection)
  })

  it('a stderr line naming an organisation does not reach the error text', async () => {
    const forClaude = await claude({
      code: 1,
      stdout: '',
      stderr: 'Error: organization Acme Hagwon Seoul has disabled Claude Code\n',
    })
    expect(forClaude.state).toBe('error')
    expectNoIdentity(forClaude)

    const forCodex = await codex({
      code: 1,
      stdout: '',
      stderr: 'Error checking login status: workspace Acme Hagwon Seoul requires SSO\n',
    })
    expect(forCodex.state).toBe('error')
    expectNoIdentity(forCodex)
  })

  it('an error text holds only what the code chose: the kind, a fixed sentence, safe facts', async () => {
    const texts = new Set<string>()
    for (const stderr of [
      'Acme Hagwon Seoul',
      'someone@example.com is not allowed',
      'x'.repeat(50),
    ]) {
      texts.add((await codex({ code: 1, stdout: '', stderr })).error!)
    }
    // whatever the CLI printed, the text is the same one
    expect([...texts]).toEqual(['failed: Codex did not report its login status (exit code 1)'])
  })

  it('a program that cannot be started is reported by its error code, not its message', async () => {
    const failure = Object.assign(
      new Error('spawn C:\\Users\\jun.il\\AppData\\Roaming\\npm\\claude.exe ENOENT'),
      { code: 'ENOENT' },
    )
    const detection = await codex(failure)
    expect(detection.state).toBe('error')
    expect(detection.error).toContain('ENOENT')
    expectNoIdentity(detection)

    const odd = await codex(Object.assign(new Error('Acme Hagwon Seoul'), { code: 'acme seoul' }))
    expectNoIdentity(odd)
  })

  it('a lookup that fails is reported the same way', async () => {
    const detection = await detectSubscriptionLogin('claude-code', {
      locate: async () => {
        throw new Error('EACCES: permission denied, scandir C:\\Users\\jun.il\\.local\\bin')
      },
      run: cli({ code: 0, stdout: '', stderr: '' }, ''),
    })
    expect(detection.state).toBe('error')
    expectNoIdentity(detection)
  })

  it('an unrecognised Codex login line contributes nothing but "unknown"', async () => {
    const detection = await codex({ code: 0, stdout: '', stderr: UNRECOGNISED_CODEX_LINE })
    expect(detection).toMatchObject({ state: 'metered', loginMethod: 'unknown' })
    expectNoIdentity(detection)
    expect(SUBSCRIPTION_LOGIN_KINDS).toContain(detection.loginKind)
    expect(parseCodexLoginStatus('Logged in using a brand new method for Acme Org')).toEqual({
      signedIn: true,
      loginMethod: 'unknown',
      loginKind: 'unknown',
    })
  })

  it('an unrecognised account type or plan from the app-server contributes nothing either', () => {
    const odd = codexAccountInfo({
      account: { type: 'jun.il@school.kr Acme Org', planType: 'Acme Hagwon Seoul' },
    })
    expect(odd).toEqual({ signedIn: true, loginMethod: 'unknown', loginKind: 'unknown' })
    const plan = codexAccountInfo({
      account: { type: 'chatgpt', email: 'jun.il@school.kr', planType: 'Acme Hagwon Seoul' },
    })
    expect(plan).toEqual({ signedIn: true, loginMethod: 'subscription', loginKind: 'chatgpt' })
  })

  it('Claude fields with unexpected values are not copied either', async () => {
    const parsed = parseClaudeAuthStatus(
      JSON.stringify({
        loggedIn: true,
        authMethod: 'sso for jun.il@school.kr',
        apiProvider: 'Acme Hagwon Seoul',
        subscriptionType: 'Acme Hagwon Seoul',
      }),
    )
    expectNoIdentity(parsed)
    expect(parsed).toMatchObject({ signedIn: true, loginMethod: 'metered' })

    // a plan name is a short identifier such as "max"; anything else is not shown
    const plan = await claude({
      code: 0,
      stdout: JSON.stringify({
        loggedIn: true,
        authMethod: 'claude.ai',
        apiProvider: 'firstParty',
        subscriptionType: 'Acme Hagwon Seoul',
      }),
      stderr: '',
    })
    expectNoIdentity(plan)
    expect(plan).toMatchObject({ state: 'metered', loginMethod: 'unknown' })
    expect(plan.planName).toBeUndefined()
  })
})

describe('the kind of login is one of a closed set of constants', () => {
  const claudeOutputs = [
    { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max' },
    { loggedIn: true, authMethod: 'api_key', apiProvider: 'firstParty' },
    { loggedIn: true, authMethod: 'api_key_helper', apiProvider: 'firstParty' },
    { loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty' },
    { loggedIn: true, authMethod: 'third_party', apiProvider: 'bedrock' },
    { loggedIn: true, authMethod: 'third_party', apiProvider: 'vertex' },
    { loggedIn: true, authMethod: 'third_party', apiProvider: 'foundry' },
    { loggedIn: true, authMethod: 'third_party', apiProvider: 'anthropicAws' },
    { loggedIn: true, authMethod: 'third_party', apiProvider: 'anthropicGoogleCloud' },
    { loggedIn: true, authMethod: 'third_party', apiProvider: 'mantle' },
    { loggedIn: true, authMethod: 'none', apiProvider: 'gateway' },
    { loggedIn: true, authMethod: 'jun.il@school.kr', apiProvider: 'Acme Org' },
    { loggedIn: true, authMethod: 42, apiProvider: { name: 'Acme' } },
    { loggedIn: true },
  ]
  const codexLines = [
    'Logged in using ChatGPT',
    'Logged in using an API key - sk-proj-***ABCD',
    'Logged in using Amazon Bedrock API key',
    'Logged in using Amazon Bedrock AWS access keys',
    'Logged in using workload identity',
    'Logged in using access token',
    'Logged in using personal access token',
    UNRECOGNISED_CODEX_LINE,
    'Logged in using jun.il@school.kr',
    'Logged in using ',
  ]
  const accounts = [
    { account: { type: 'chatgpt', planType: 'plus' } },
    { account: { type: 'apiKey' } },
    { account: null, requiresOpenaiAuth: false },
    { account: { type: 'Acme Org' } },
    { account: { type: 7 } },
  ]

  it('whatever the CLI prints', () => {
    const kinds: Array<string | undefined> = []
    for (const output of claudeOutputs) {
      const login = parseClaudeAuthStatus(JSON.stringify(output))
      kinds.push(login?.signedIn ? login.loginKind : undefined)
    }
    for (const line of codexLines) {
      const login = parseCodexLoginStatus(line)
      kinds.push(login?.signedIn ? login.loginKind : undefined)
    }
    for (const account of accounts) {
      const login = codexAccountInfo(account)
      kinds.push(login?.signedIn ? login.loginKind : undefined)
    }
    const seen = kinds.filter((kind) => kind !== undefined)
    expect(seen.length).toBeGreaterThan(20)
    for (const kind of seen) expect(SUBSCRIPTION_LOGIN_KINDS).toContain(kind)
    expectNoIdentity(seen)
  })

  it('every fingerprint is one of the listed values, whatever the detection carries', () => {
    expect(METERED_LOGIN_FINGERPRINTS.length).toBe(SUBSCRIPTION_LOGIN_KINDS.length * 2)
    for (const fingerprint of METERED_LOGIN_FINGERPRINTS) {
      expect(fingerprint).toMatch(/^(metered|unknown):[A-Za-z_./-]+$/)
    }
    const kinds = [
      ...SUBSCRIPTION_LOGIN_KINDS,
      'access-token-for-jun.ilschool.kr-acme-or',
      'jun.il@school.kr',
      'Acme Hagwon Seoul',
      '',
      undefined,
    ]
    for (const loginMethod of ['metered', 'unknown'] as const) {
      for (const loginKind of kinds) {
        const fingerprint = meteredLoginFingerprint({
          provider: 'codex',
          state: 'metered',
          loginMethod,
          ...(loginKind === undefined ? {} : { loginKind }),
        })
        expect(METERED_LOGIN_FINGERPRINTS).toContain(fingerprint)
        expectNoIdentity(fingerprint)
      }
    }
    // a kind outside the set collapses to the one fixed token
    expect(
      meteredLoginFingerprint({
        provider: 'codex',
        state: 'metered',
        loginMethod: 'unknown',
        loginKind: 'access-token-for-jun.ilschool.kr-acme-or',
      }),
    ).toBe('unknown:unknown')
  })
})

describe('accepting a metered login of an unrecognised kind', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'subscription-identity-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes no part of the CLI line to the acceptance file, the settings or the status', async () => {
    const settings = defaultAiSettings()
    const written: MeteredAcceptanceRecord[] = []
    const fileStore = createMeteredAcceptanceFileStore(dir)
    const service = createSubscriptionStatusService({
      getSettings: () => settings,
      setMeteredAccepted: (provider, accepted) => {
        settings.meteredAccepted = { ...settings.meteredAccepted, [provider]: accepted }
      },
      acceptanceStore: {
        read: () => fileStore.read(),
        write: async (record) => {
          written.push({ ...record })
          await fileStore.write(record)
        },
      },
      detect: (provider, options) =>
        detectSubscriptionLogin(provider, {
          ...options,
          locate: async (id) => (id === 'codex' ? program(id) : null),
          run: cli({ code: 0, stdout: '', stderr: UNRECOGNISED_CODEX_LINE }, 'codex-cli 0.159.2\n'),
        }),
    })
    const checked = await service.check()
    expect(checked.codex).toMatchObject({ state: 'metered', loginMethod: 'unknown' })
    const accepted = await service.setMeteredAccepted('codex', true)
    expect(accepted.ok).toBe(true)
    expect(accepted.statuses.codex.meteredAccepted).toBe(true)

    expect(written).toEqual([{ codex: 'unknown:unknown' }])
    expect(METERED_LOGIN_FINGERPRINTS).toContain(written[0]!.codex)
    for (const name of await readdir(dir)) {
      expectNoIdentity(await readFile(join(dir, name), 'utf8'))
    }
    expectNoIdentity([checked, accepted, settings.meteredAccepted, written])
    // and the acceptance still holds on the next check of the same login
    expect((await service.check()).codex.meteredAccepted).toBe(true)
  })

  it('the acceptance file takes and gives back only listed fingerprints', async () => {
    const store = createMeteredAcceptanceFileStore(dir)
    await store.write({
      codex: 'unknown:access-token-for-jun.ilschool.kr-acme-or',
      'claude-code': 'metered:api_key/firstParty',
    })
    const onDisk = await readFile(join(dir, SUBSCRIPTION_METERED_FILE), 'utf8')
    expectNoIdentity(onDisk)
    expect(JSON.parse(onDisk)).toEqual({ 'claude-code': 'metered:api_key/firstParty' })

    // a file written by an earlier build is read without the leaked value
    const { writeFile } = await import('node:fs/promises')
    await writeFile(
      join(dir, SUBSCRIPTION_METERED_FILE),
      JSON.stringify({ codex: 'unknown:access-token-for-jun.ilschool.kr-acme-or' }),
    )
    expect(await store.read()).toEqual({})
  })

  it('a detection that throws is reported with a fixed text', async () => {
    const service = createSubscriptionStatusService({
      getSettings: () => defaultAiSettings(),
      setMeteredAccepted: () => undefined,
      acceptanceStore: { read: async () => ({}), write: async () => undefined },
      detect: async () => {
        throw new Error('could not read the session of jun.il@school.kr (Acme Hagwon Seoul)')
      },
    })
    const statuses = await service.check()
    expect(statuses.codex.state).toBe('error')
    expect(subscriptionStatusErrorKind(statuses.codex)).toBe('failed')
    expectNoIdentity(statuses)
  })
})
