/**
 * The rules behind the local AI card, as plain functions over the settings:
 * server presets, address and timeout checks, saving and deleting a server,
 * model-profile merges and what the card shows for a saved server.
 *
 * Pure on purpose: no DOM, no React, no network. The card only lays these
 * results out. Two rules decide almost every function here.
 *
 * - Saving or testing never changes the selected AI or switches the active
 *   server. Only the user chooses those.
 * - A value the user set outranks what a server or a test reports. A value
 *   nobody reported stays unknown, which is never the same as `false`.
 */
import {
  DEFAULT_LOCAL_TIMEOUT_MS,
  MAX_LOCAL_TIMEOUT_MS,
  MIN_LOCAL_TIMEOUT_MS,
  localContextTokensOf,
  localEndpointTimeoutMs,
  newCustomEndpointId,
  removeCustomEndpoint,
  resolveCustomEndpoints,
} from '@genoffice/ai-provider/browser'
import type {
  AiCustomEndpoint,
  AiLocalModelProfile,
  AiSettings,
} from '@genoffice/ai-provider/browser'

export type LocalPreset = 'ollama' | 'lmstudio' | 'vllm' | 'other'

export interface LocalPresetDefaults {
  readonly name: string
  readonly baseUrl: string
}

/** The address each preset offers. "other" leaves the fields to the user. */
export const LOCAL_PRESETS: Record<LocalPreset, LocalPresetDefaults> = {
  ollama: { name: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1' },
  lmstudio: { name: 'LM Studio', baseUrl: 'http://127.0.0.1:1234/v1' },
  vllm: { name: 'vLLM', baseUrl: 'http://127.0.0.1:8000/v1' },
  other: { name: '', baseUrl: '' },
}

/** The preset order the card offers; the server kind is the user's choice, never inferred for saving. */
export const LOCAL_PRESET_IDS: readonly LocalPreset[] = ['ollama', 'lmstudio', 'vllm', 'other']

const KNOWN_PRESETS: readonly LocalPreset[] = ['ollama', 'lmstudio', 'vllm']

export const MAX_LOCAL_BASE_URL_LENGTH = 2_048

/** What the address or timeout check found; the card turns the code into its own sentence. */
export type LocalValidationCode =
  'empty' | 'scheme' | 'too-long' | 'credentials' | 'shape' | 'range'

export type LocalValidation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: LocalValidationCode }

/** The form values of one server. `id` is blank until the server is saved. */
export interface LocalEndpointDraft {
  id: string
  preset: LocalPreset
  name: string
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
  /** the last advertised model list; omitted means "keep the stored one" */
  models?: string[] | undefined
  /** per-model profiles; omitted means "keep the stored ones" */
  modelProfiles?: Record<string, AiLocalModelProfile> | undefined
}

export interface ApplyLocalPresetOptions {
  /** overwrite a name and address the user typed; the user asked for the preset defaults */
  replace?: boolean | undefined
}

// ── the server list ───────────────────────────────────────

/** The saved local servers, in registration order. A server from before `kind` existed is not local. */
export function localEndpoints(settings: AiSettings): AiCustomEndpoint[] {
  return (settings.customEndpoints ?? []).filter((endpoint) => endpoint.kind === 'local')
}

function presetDefaults(preset: LocalPreset): LocalPresetDefaults {
  return LOCAL_PRESETS[preset] ?? LOCAL_PRESETS.other
}

/** A blank form for a new server of the chosen kind: a partial draft is allowed. */
export function newLocalDraft(preset: LocalPreset): LocalEndpointDraft {
  const defaults = presetDefaults(preset)
  return {
    id: '',
    preset,
    name: defaults.name,
    baseUrl: defaults.baseUrl,
    apiKey: '',
    model: '',
    timeoutMs: DEFAULT_LOCAL_TIMEOUT_MS,
  }
}

function isPresetName(name: string): boolean {
  const value = name.trim()
  return value !== '' && KNOWN_PRESETS.some((preset) => LOCAL_PRESETS[preset].name === value)
}

function isPresetAddress(baseUrl: string): boolean {
  const value = baseUrl.trim()
  return value !== '' && KNOWN_PRESETS.some((preset) => LOCAL_PRESETS[preset].baseUrl === value)
}

/**
 * The form draft after the user picks a server kind. A blank field, or a name
 * and address that still hold another preset's defaults, follows the new
 * preset; anything the user typed stays until `replace` is set.
 */
export function applyPreset(
  draft: LocalEndpointDraft,
  preset: LocalPreset,
  options?: ApplyLocalPresetOptions,
): LocalEndpointDraft {
  const defaults = presetDefaults(preset)
  const replace = options?.replace === true
  const takeName =
    defaults.name !== '' && (replace || !draft.name.trim() || isPresetName(draft.name))
  const takeAddress =
    defaults.baseUrl !== '' && (replace || !draft.baseUrl.trim() || isPresetAddress(draft.baseUrl))
  const timeout = normalizeTimeoutMs(draft.timeoutMs)
  return {
    ...draft,
    preset,
    name: takeName ? defaults.name : draft.name,
    baseUrl: takeAddress ? defaults.baseUrl : draft.baseUrl,
    timeoutMs: timeout.ok ? timeout.value : DEFAULT_LOCAL_TIMEOUT_MS,
  }
}

/** The form values of a saved server; the timeout reads as the 300,000 default when it is unusable. */
export function localEndpointDraft(endpoint: AiCustomEndpoint): LocalEndpointDraft {
  return {
    id: endpoint.id,
    preset: localPresetOf(endpoint.baseUrl),
    name: endpoint.name,
    baseUrl: endpoint.baseUrl,
    apiKey: endpoint.apiKey,
    model: endpoint.model,
    timeoutMs: localEndpointTimeoutMs(endpoint),
    ...(endpoint.models ? { models: [...endpoint.models] } : {}),
    ...(endpoint.modelProfiles
      ? {
          modelProfiles: Object.fromEntries(
            Object.entries(endpoint.modelProfiles).map(([model, profile]) => [
              model,
              { ...profile },
            ]),
          ),
        }
      : {}),
  }
}

/** The preset whose default address this is; anything else stays "other". */
function localPresetOf(baseUrl: string): LocalPreset {
  for (const preset of KNOWN_PRESETS) {
    const normalized = normalizeLocalBaseUrl(baseUrl, preset)
    if (normalized.ok && normalized.value === LOCAL_PRESETS[preset].baseUrl) return preset
  }
  return 'other'
}

// ── address and timeout ───────────────────────────────────

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//

/**
 * A server address ready to store. A scheme-less address gets `http://`, the
 * trailing slashes go, and a known preset with no path gets `/v1`. Requests
 * never reach a host through credentials in the address, so those are refused
 * rather than split off. The card shows the reason from the returned code.
 */
export function normalizeLocalBaseUrl(raw: unknown, preset: LocalPreset): LocalValidation<string> {
  if (typeof raw !== 'string') return { ok: false, code: 'shape' }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, code: 'empty' }
  if (trimmed.length > MAX_LOCAL_BASE_URL_LENGTH) return { ok: false, code: 'too-long' }

  const candidate = SCHEME_RE.test(trimmed) ? trimmed : `http://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, code: 'shape' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, code: 'scheme' }
  }
  if (url.username || url.password) return { ok: false, code: 'credentials' }
  // a base address has no query or fragment to keep; accepting one would hide it from the request path
  if (url.search || url.hash) return { ok: false, code: 'shape' }
  if (!url.hostname) return { ok: false, code: 'shape' }

  let path = url.pathname.replace(/\/+$/, '')
  if (KNOWN_PRESETS.includes(preset) && path === '') path = '/v1'
  const normalized = `${url.protocol}//${url.host}${path}`
  if (normalized.length > MAX_LOCAL_BASE_URL_LENGTH) return { ok: false, code: 'too-long' }
  return { ok: true, value: normalized }
}

/**
 * A whole number of milliseconds inside 60,000..600,000. An absent or blank
 * value means the 300,000 default; anything else that does not fit is a range
 * error, and the caller does not save it.
 */
export function normalizeTimeoutMs(raw: unknown): LocalValidation<number> {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: true, value: DEFAULT_LOCAL_TIMEOUT_MS }
  }
  const value = typeof raw === 'string' ? Number(raw.trim()) : raw
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < MIN_LOCAL_TIMEOUT_MS ||
    value > MAX_LOCAL_TIMEOUT_MS
  ) {
    return { ok: false, code: 'range' }
  }
  return { ok: true, value }
}

// ── saving and deleting ───────────────────────────────────

function normalizedModels(raw: readonly string[] | undefined): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const models: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const model = entry.trim()
    if (!model || seen.has(model)) continue
    seen.add(model)
    models.push(model)
  }
  return models
}

/**
 * The settings with this server replaced (same id) or appended. `customEndpoint`
 * and the selected provider are left alone: a new server is never activated,
 * unlike `upsertCustomEndpoint`. The only exception is the first server in a
 * file that never had one, where the resolver mirrors it as the active
 * candidate without changing `provider`.
 *
 * The current endpoints are resolved first so a server from a pre-list
 * `providers.custom` slot is kept rather than overwritten by this save.
 */
export function saveLocalDraft(settings: AiSettings, draft: LocalEndpointDraft): AiSettings {
  const address = normalizeLocalBaseUrl(draft.baseUrl, draft.preset)
  // an address that cannot be saved leaves the file exactly as it was
  if (!address.ok) return settings

  const base = resolveCustomEndpoints(settings)
  const endpoints = base.customEndpoints ?? []
  const draftId = draft.id.trim()
  const existing = draftId ? endpoints.find((endpoint) => endpoint.id === draftId) : undefined
  const timeout = normalizeTimeoutMs(draft.timeoutMs)
  const models = draft.models !== undefined ? normalizedModels(draft.models) : existing?.models
  const profiles = draft.modelProfiles !== undefined ? draft.modelProfiles : existing?.modelProfiles
  const id = existing?.id ?? (draftId || newCustomEndpointId())

  const endpoint: AiCustomEndpoint = {
    id,
    name: draft.name.trim(),
    baseUrl: address.value,
    apiKey: draft.apiKey.trim(),
    model: draft.model.trim(),
    kind: 'local',
    timeoutMs: timeout.ok ? timeout.value : DEFAULT_LOCAL_TIMEOUT_MS,
    ...(models && models.length > 0 ? { models } : {}),
    ...(profiles && Object.keys(profiles).length > 0 ? { modelProfiles: profiles } : {}),
  }
  const customEndpoints = existing
    ? endpoints.map((entry) => (entry.id === existing.id ? endpoint : entry))
    : [...endpoints, endpoint]
  return resolveCustomEndpoints({ ...base, customEndpoints })
}

/**
 * Remove one local server. When it is the active one the selection becomes
 * explicitly empty and the mirror is cleared, so no other saved server is
 * called without the user choosing it.
 */
export function removeLocalEndpoint(settings: AiSettings, id: string): AiSettings {
  return removeCustomEndpoint(settings, id, { fallback: false })
}

/**
 * The model to keep when the card re-reads the settings before saving. The
 * composer may have changed the model while the form was open; if the card
 * did not touch the model (`draft.model` still equals the value loaded with
 * the form), the latest value wins. A model the user picked in the card wins.
 */
export function mergeLoadedModel(
  draft: Pick<LocalEndpointDraft, 'model'>,
  loadedModel: string,
  latestModel: string,
): string {
  return draft.model === loadedModel ? latestModel : draft.model
}

// ── profiles ──────────────────────────────────────────────

/** What a server inspection can report about one model; absent means unknown. */
export interface LocalInspection {
  contextLength?: number | undefined
  runningContextLength?: number | undefined
  tools?: boolean | undefined
  vision?: boolean | undefined
}

function isCheckTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * The profile with what a server inspection reported. A value whose source is
 * `user` is never replaced. A running model's actual context wins over the
 * advertised ceiling, and the ceiling is kept only when the two differ.
 */
export function applyInspection(
  profile: AiLocalModelProfile,
  inspection: LocalInspection,
): AiLocalModelProfile {
  const next: AiLocalModelProfile = { ...profile }

  if (profile.contextSource !== 'user') {
    const running = localContextTokensOf(inspection.runningContextLength)
    const advertised = localContextTokensOf(inspection.contextLength)
    if (running !== undefined) {
      next.contextLength = running
      next.contextSource = 'server'
      if (advertised !== undefined && advertised !== running) {
        next.maxContextLength = advertised
      } else {
        delete next.maxContextLength
      }
    } else if (advertised !== undefined) {
      next.contextLength = advertised
      next.contextSource = 'server'
      delete next.maxContextLength
    }
  }

  if (typeof inspection.tools === 'boolean' && profile.toolsSource !== 'user') {
    next.tools = inspection.tools
    next.toolsSource = 'server'
  }
  if (typeof inspection.vision === 'boolean' && profile.visionSource !== 'user') {
    next.vision = inspection.vision
    next.visionSource = 'server'
  }
  return next
}

export type LocalCheckStatus = 'pass' | 'fail' | 'skip'

export type LocalCheckCode =
  'unreachable' | 'timeout' | 'http' | 'shape' | 'model-missing' | 'no-chat' | 'no-tool-call'

export interface LocalCheck {
  status: LocalCheckStatus
  code?: LocalCheckCode | undefined
}

export interface LocalModelSummary {
  id: string
  sizeBytes?: number | undefined
  parameterSize?: string | undefined
  quantization?: string | undefined
}

export type LocalServerKind = 'ollama' | 'openai-compatible'

export interface LocalTestResult {
  server: LocalCheck
  model: LocalCheck
  chat: LocalCheck
  tools: LocalCheck
  checkedAt: number
  elapsedMs: number
  models?: LocalModelSummary[] | undefined
  serverKind?: LocalServerKind | undefined
  /** invalid IPC input: every check is skip */
  inputError?: 'shape' | undefined
}

/**
 * The profile after a connection test. A passed tool check is the only report
 * that can say `tools: true`, and it cannot replace a user's value. A missing
 * tool call is not a failure of the model's tools support, so it changes
 * nothing; no check ever writes `tools: false`.
 *
 * `checkedAt` means "the last check that got an answer": only a passed server
 * check (the model list was read) records it. A failed attempt leaves the old
 * value, so the card does not present an unreachable server as just checked.
 */
export function applyTestResult(
  profile: AiLocalModelProfile,
  result: LocalTestResult,
): AiLocalModelProfile {
  const next: AiLocalModelProfile = { ...profile }
  if (result.inputError === 'shape') return next
  if (result.server.status === 'pass' && isCheckTime(result.checkedAt)) {
    next.checkedAt = result.checkedAt
  }
  if (result.tools.status === 'pass' && profile.toolsSource !== 'user') {
    next.tools = true
    next.toolsSource = 'test'
  }
  return next
}

// ── what the card shows ───────────────────────────────────

export type LocalDiscoveryErrorCode = 'unreachable' | 'timeout' | 'http' | 'shape'

export type LocalDiscoveryResult =
  | { ok: true; server: LocalServerKind; models: LocalModelSummary[] }
  | { ok: false; errorCode: LocalDiscoveryErrorCode; status?: number }

/** What the card last heard about one server in this open screen. */
export type LocalServerProbe = 'unknown' | 'checking' | LocalDiscoveryResult | undefined

export type LocalServerState = 'unknown' | 'checking' | 'online' | 'offline' | 'error'

export interface LocalServerStatus {
  state: LocalServerState
  /** the number of models the last successful probe listed; absent when it did not succeed */
  modelCount?: number | undefined
}

/**
 * The status line of one server. Nothing is stored: the settings screen starts
 * every server at "unknown" and only a user action probes it. A server that
 * cannot be reached is offline; an HTTP or shape error is an error.
 */
export function localServerStatus(last: LocalServerProbe): LocalServerStatus {
  if (last === undefined || last === 'unknown') return { state: 'unknown' }
  if (last === 'checking') return { state: 'checking' }
  if (last.ok) return { state: 'online', modelCount: last.models.length }
  return last.errorCode === 'unreachable' || last.errorCode === 'timeout'
    ? { state: 'offline' }
    : { state: 'error' }
}

export type LocalTestCheck = 'server' | 'model' | 'chat' | 'tools'

/** Four display states: a missing tool call is "not confirmed", not a failure. */
export type LocalTestState = 'pass' | 'fail' | 'skip' | 'unconfirmed'

export interface LocalTestRow {
  check: LocalTestCheck
  state: LocalTestState
  code?: LocalCheckCode | undefined
}

const TEST_CHECKS: readonly LocalTestCheck[] = ['server', 'model', 'chat', 'tools']

/** The four test rows in the order the card shows them. */
export function localTestView(result: LocalTestResult): LocalTestRow[] {
  if (result.inputError === 'shape') {
    return TEST_CHECKS.map((check) => ({ check, state: 'skip' as const }))
  }
  return TEST_CHECKS.map((check) => {
    const entry = result[check]
    const state =
      check === 'tools' && entry.status === 'fail' && entry.code === 'no-tool-call'
        ? 'unconfirmed'
        : entry.status
    return { check, state, ...(entry.code ? { code: entry.code } : {}) }
  })
}
