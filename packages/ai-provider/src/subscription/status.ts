/**
 * Reading the connection status of a subscription CLI from what the CLI itself
 * reports. Everything here is asynchronous, so a slow CLI never freezes the UI,
 * and both providers are asked at the same time.
 *
 * The CLIs also report who is signed in (email, organisation). Those fields are
 * never copied out of the parsed output: the result names the kind of login and
 * the plan, nothing that identifies the account.
 */
import { AI_SUBSCRIPTION_PROVIDERS } from '../providers'
import type {
  AiSubscriptionLoginMethod,
  AiSubscriptionProviderId,
  AiSubscriptionState,
} from '../types'
import { subscriptionStatusErrorText, type SubscriptionStatusErrorKind } from './contract'
import {
  locateSubscriptionProgram,
  subscriptionProviderLabel,
  type SubscriptionLocator,
  type SubscriptionProgram,
} from './locate'
import {
  runSubscriptionProgram,
  type SubscriptionCommandResult,
  type SubscriptionRunner,
} from './process'

/** A status check that has not answered by then is an `error` */
export const SUBSCRIPTION_STATUS_TIMEOUT_MS = 20_000

/**
 * Oldest CLI version the app works with; an older one is reported as "needs
 * update". Claude Code: 2.1.248 introduced `--restricted`, which the bridge
 * runs with (`claude auth status` itself exists since 2.1.41). The version is
 * read before anything else is asked, because a Claude too old to know `auth`
 * would take "auth status" as a prompt. Codex has no floor: an old Codex
 * rejects `login status` as an unknown subcommand, which reads as "needs
 * update" too.
 */
export const SUBSCRIPTION_MIN_VERSIONS: Record<AiSubscriptionProviderId, string | null> = {
  'claude-code': '2.1.248',
  codex: null,
}

/** What a CLI says about its login, with the account identity left out */
export type SubscriptionLogin =
  | { signedIn: false }
  | {
      signedIn: true
      loginMethod: AiSubscriptionLoginMethod
      /** plan the CLI names, for display */
      planName?: string
      /**
       * The CLI's own name for the kind of login (`api_key/firstParty`,
       * `chatgpt`, …). Tells one kind of login from another without naming an
       * account; a metered acceptance is remembered against it.
       */
      loginKind: string
    }

/**
 * Outcome of one status check, before the stored metered acceptance is applied.
 * `state` is never `checking`: that is the status of a provider not checked yet.
 */
export interface SubscriptionDetection {
  provider: AiSubscriptionProviderId
  state: Exclude<AiSubscriptionState, 'checking'>
  version?: string
  loginMethod?: AiSubscriptionLoginMethod
  planName?: string
  error?: string
  loginKind?: string
}

/**
 * Raw result of the Codex app-server's `account/read`, supplied by the Codex
 * bridge. Its email is dropped by `codexAccountInfo`.
 */
export type CodexAccountSource = (context: {
  /** the configured Codex path, as stored in the settings */
  configuredPath: string | undefined
  signal: AbortSignal
}) => Promise<unknown>

export interface SubscriptionDetectOptions {
  /** the user's own path to the CLI (the Codex `cliPath` setting) */
  configuredPath?: string | undefined
  timeoutMs?: number | undefined
  locate?: SubscriptionLocator | undefined
  run?: SubscriptionRunner | undefined
  /** overrides the source set with `setCodexAccountSource`; null turns it off */
  codexAccount?: CodexAccountSource | null | undefined
}

export type SubscriptionDetector = (
  provider: AiSubscriptionProviderId,
  options?: SubscriptionDetectOptions,
) => Promise<SubscriptionDetection>

const MAX_LABEL_LENGTH = 40
const MAX_ERROR_DETAIL_LENGTH = 300

/** A short display/label value: plain characters only, bounded */
function label(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/[^\w.+ -]/g, '').trim()
  return cleaned ? cleaned.slice(0, MAX_LABEL_LENGTH) : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Remove what could identify an account or act as a credential from CLI output
 * before it becomes an error detail: email addresses, ids, keys and tokens.
 */
export function scrubSubscriptionOutput(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[redacted]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[redacted]')
    .replace(/\b(sk|pk|rk|key|tok|sess)-[\w*.-]{6,}/gi, '[redacted]')
    .replace(/\b[\w+/=-]{32,}\b/g, '[redacted]')
}

function detail(text: string): string {
  const line =
    text
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find(Boolean) ?? ''
  return scrubSubscriptionOutput(line).slice(0, MAX_ERROR_DETAIL_LENGTH)
}

// ── Claude Code: `claude auth status --json` ──

const CLAUDE_METERED_METHODS = new Set(['api_key', 'api_key_helper', 'third_party'])

/**
 * Read `loggedIn`, `authMethod`, `apiProvider` and `subscriptionType` from the
 * CLI's JSON; every other field (email, organisation, directories) is ignored.
 * A subscription is reported only for a claude.ai login on Anthropic's own API
 * that names a plan. Null when the output is not the expected JSON.
 */
export function parseClaudeAuthStatus(stdout: string): SubscriptionLogin | null {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed: Record<string, unknown> | undefined
  try {
    parsed = asRecord(JSON.parse(stdout.slice(start, end + 1)))
  } catch {
    return null
  }
  if (!parsed || typeof parsed.loggedIn !== 'boolean') return null
  if (!parsed.loggedIn) return { signedIn: false }
  const authMethod = label(parsed.authMethod) ?? 'unknown'
  const apiProvider = label(parsed.apiProvider)
  const planName = label(parsed.subscriptionType)
  const loginKind = `${authMethod}/${apiProvider ?? 'unknown'}`
  if (CLAUDE_METERED_METHODS.has(authMethod) || (apiProvider && apiProvider !== 'firstParty')) {
    return { signedIn: true, loginMethod: 'metered', loginKind }
  }
  if (authMethod === 'claude.ai' && apiProvider === 'firstParty' && planName) {
    return { signedIn: true, loginMethod: 'subscription', planName, loginKind }
  }
  return { signedIn: true, loginMethod: 'unknown', loginKind }
}

// ── Codex: `codex login status` ──

/**
 * Read the one line `codex login status` prints (on stderr). Only the kind of
 * login is taken from it; the masked API key that follows on the API-key line
 * is not kept. Null when no known line is present.
 */
export function parseCodexLoginStatus(output: string): SubscriptionLogin | null {
  if (/\bNot logged in\b/i.test(output)) return { signedIn: false }
  const match = /\bLogged in using ([^\r\n]*)/i.exec(output)
  if (!match) return null
  const how = match[1]!.toLowerCase()
  if (how.startsWith('chatgpt')) {
    return { signedIn: true, loginMethod: 'subscription', loginKind: 'chatgpt' }
  }
  if (/^(an )?api key/.test(how)) {
    return { signedIn: true, loginMethod: 'metered', loginKind: 'api-key' }
  }
  if (how.includes('bedrock')) {
    return { signedIn: true, loginMethod: 'metered', loginKind: 'bedrock' }
  }
  if (how.includes('workload identity')) {
    return { signedIn: true, loginMethod: 'metered', loginKind: 'workload-identity' }
  }
  const kind = (label(how) ?? 'unknown').replace(/\s+/g, '-')
  return { signedIn: true, loginMethod: 'unknown', loginKind: kind }
}

// ── Codex: the app-server's account/read ──

/**
 * The login `account/read` describes: `{ account: { type: 'chatgpt', planType }
 * | { type: 'apiKey' } | null, requiresOpenaiAuth }`. The account's email is
 * not read. Null when the value is not an `account/read` result.
 */
export function codexAccountInfo(accountRead: unknown): SubscriptionLogin | null {
  const result = asRecord(accountRead)
  if (!result) return null
  const account = asRecord(result.account)
  if (!account) {
    if (result.requiresOpenaiAuth === true) return { signedIn: false }
    // no account and none required: Codex is pointed at some other model provider
    return { signedIn: true, loginMethod: 'unknown', loginKind: 'no-account' }
  }
  if (account.type === 'chatgpt') {
    const planName = label(account.planType)
    return {
      signedIn: true,
      loginMethod: 'subscription',
      ...(planName && planName !== 'unknown' ? { planName } : {}),
      loginKind: 'chatgpt',
    }
  }
  if (account.type === 'apiKey') {
    return { signedIn: true, loginMethod: 'metered', loginKind: 'api-key' }
  }
  const kind = (label(account.type) ?? 'unknown').replace(/\s+/g, '-')
  return { signedIn: true, loginMethod: 'unknown', loginKind: kind }
}

let codexAccountSource: CodexAccountSource | null = null

/**
 * Let the Codex bridge supply `account/read` to the status check (plan name,
 * and a second opinion on the kind of login). Pass null to remove it.
 */
export function setCodexAccountSource(source: CodexAccountSource | null): void {
  codexAccountSource = source
}

/**
 * Two readings of the same login. The more expensive reading wins: metered if
 * either says so, a subscription only if both do.
 */
function mergeLogins(cli: SubscriptionLogin, account: SubscriptionLogin | null): SubscriptionLogin {
  if (!account || !cli.signedIn) return cli
  if (!account.signedIn) return account
  if (cli.loginMethod === 'metered') return cli
  if (account.loginMethod === 'metered') return account
  if (cli.loginMethod === 'subscription' && account.loginMethod === 'subscription') {
    return account.planName ? { ...cli, planName: account.planName } : cli
  }
  return cli.loginMethod === 'unknown' ? cli : account
}

// ── From CLI answers to a state ──

function errorDetection(
  provider: AiSubscriptionProviderId,
  kind: SubscriptionStatusErrorKind,
  text: string,
  version?: string,
): SubscriptionDetection {
  return {
    provider,
    state: 'error',
    ...(version ? { version } : {}),
    error: subscriptionStatusErrorText(kind, text),
  }
}

/**
 * The one place a login becomes a state. `ready` only for a subscription
 * login; a metered login and one of unknown kind are both `metered`.
 */
function loginDetection(
  provider: AiSubscriptionProviderId,
  version: string | undefined,
  login: SubscriptionLogin,
): SubscriptionDetection {
  const base = { provider, ...(version ? { version } : {}) }
  if (!login.signedIn) return { ...base, state: 'signed-out' }
  const subscription = login.loginMethod === 'subscription'
  return {
    ...base,
    state: subscription ? 'ready' : 'metered',
    loginMethod: login.loginMethod,
    ...(subscription && login.planName ? { planName: login.planName } : {}),
    loginKind: login.loginKind,
  }
}

function parseVersion(output: string): string | undefined {
  return /\d+\.\d+\.\d+/.exec(output)?.[0]
}

function versionAtLeast(version: string, minimum: string): boolean {
  const have = version.split('.').map(Number)
  const need = minimum.split('.').map(Number)
  for (let index = 0; index < need.length; index++) {
    const difference = (have[index] ?? 0) - (need[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}

const UNKNOWN_COMMAND =
  /unknown (command|option)|unrecognized (subcommand|option)|unexpected argument/i

function failureDetail(error: unknown): string {
  return detail(error instanceof Error ? error.message : String(error))
}

const STATUS_ARGS: Record<AiSubscriptionProviderId, string[]> = {
  'claude-code': ['auth', 'status', '--json'],
  codex: ['login', 'status'],
}

function parseStatus(
  provider: AiSubscriptionProviderId,
  result: SubscriptionCommandResult,
): SubscriptionLogin | null {
  return provider === 'claude-code'
    ? parseClaudeAuthStatus(result.stdout)
    : parseCodexLoginStatus(`${result.stderr}\n${result.stdout}`)
}

async function inspect(
  provider: AiSubscriptionProviderId,
  options: SubscriptionDetectOptions,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<SubscriptionDetection> {
  const name = subscriptionProviderLabel(provider)
  let program: SubscriptionProgram | null
  try {
    program = await (options.locate ?? locateSubscriptionProgram)(provider, {
      configuredPath: options.configuredPath,
    })
  } catch (error) {
    return errorDetection(provider, 'failed', failureDetail(error))
  }
  if (!program) return { provider, state: 'not-installed' }

  const run = options.run ?? runSubscriptionProgram
  const ask = (args: string[]): Promise<SubscriptionCommandResult> =>
    run(program, args, { signal, timeoutMs })
  const minimum = SUBSCRIPTION_MIN_VERSIONS[provider]

  let version: string | undefined
  let status: SubscriptionCommandResult
  let account: SubscriptionLogin | null = null
  try {
    if (minimum) {
      // version first: nothing else is asked of a CLI that may not know the question
      version = parseVersion((await ask(['--version'])).stdout)
      if (!version) {
        return errorDetection(provider, 'failed', `${name} did not report its version`)
      }
      if (!versionAtLeast(version, minimum)) {
        return errorDetection(
          provider,
          'needs-update',
          `${name} ${version} is too old; version ${minimum} or newer is required`,
          version,
        )
      }
      status = await ask(STATUS_ARGS[provider])
    } else {
      const source = options.codexAccount === undefined ? codexAccountSource : options.codexAccount
      const [versionResult, statusResult, accountResult] = await Promise.all([
        ask(['--version']).catch(() => null),
        ask(STATUS_ARGS[provider]),
        provider === 'codex' && source
          ? source({ configuredPath: options.configuredPath, signal }).catch(() => null)
          : null,
      ])
      version = versionResult ? parseVersion(versionResult.stdout) : undefined
      status = statusResult
      account = codexAccountInfo(accountResult)
    }
  } catch (error) {
    return errorDetection(provider, 'failed', failureDetail(error), version)
  }

  const login = parseStatus(provider, status)
  if (!login) {
    const output = `${status.stderr}\n${status.stdout}`
    if (UNKNOWN_COMMAND.test(output)) {
      return errorDetection(
        provider,
        'needs-update',
        `${name}${version ? ` ${version}` : ''} is too old to report its login status`,
        version,
      )
    }
    const said = detail(status.stderr) || detail(status.stdout)
    return errorDetection(
      provider,
      'failed',
      `${name} did not report its login status${said ? `: ${said}` : ''}`,
      version,
    )
  }
  return loginDetection(provider, version, mergeLogins(login, account))
}

/**
 * The connection status of one provider, from the CLI itself: is it installed,
 * signed in, and on what kind of login. Never rejects: every failure, a check
 * that outlasts `timeoutMs` included, is an `error` detection.
 */
export const detectSubscriptionLogin: SubscriptionDetector = async (provider, options = {}) => {
  const timeoutMs = options.timeoutMs ?? SUBSCRIPTION_STATUS_TIMEOUT_MS
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<SubscriptionDetection>((resolve) => {
    timer = setTimeout(() => {
      resolve(
        errorDetection(
          provider,
          'timeout',
          `${subscriptionProviderLabel(provider)} did not answer within ${Math.round(timeoutMs / 1000)} s`,
        ),
      )
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      inspect(provider, options, controller.signal, timeoutMs).catch(
        (error): SubscriptionDetection => errorDetection(provider, 'failed', failureDetail(error)),
      ),
      deadline,
    ])
  } finally {
    clearTimeout(timer)
    // ends whatever the check still has running, on a timeout and otherwise
    controller.abort()
  }
}

/** Both providers, checked at the same time */
export async function detectSubscriptionLogins(
  options: SubscriptionDetectOptions & {
    /** per provider; overrides `configuredPath` */
    configuredPaths?: Partial<Record<AiSubscriptionProviderId, string | undefined>> | undefined
    detect?: SubscriptionDetector | undefined
  } = {},
): Promise<Record<AiSubscriptionProviderId, SubscriptionDetection>> {
  const { configuredPaths, detect = detectSubscriptionLogin, ...rest } = options
  const detections = await Promise.all(
    AI_SUBSCRIPTION_PROVIDERS.map((provider) =>
      detect(provider, {
        ...rest,
        ...(configuredPaths ? { configuredPath: configuredPaths[provider] } : {}),
      }),
    ),
  )
  return Object.fromEntries(
    detections.map((detection) => [detection.provider, detection]),
  ) as Record<AiSubscriptionProviderId, SubscriptionDetection>
}
