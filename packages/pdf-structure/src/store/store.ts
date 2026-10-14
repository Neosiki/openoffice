/**
 * The result store (spec §6): AI-read pages, translations and unfinished job
 * records kept on this PC until the user deletes them. The app and the
 * terminal command share one store and may write it at the same time.
 *
 * Layout under `<userData>/pdf-store/`:
 *
 *   docs/<docHash>/ai-read/<pageFp>.json
 *   docs/<docHash>/translations/<lang>/translation.json          provider, model
 *   docs/<docHash>/translations/<lang>/blocks/<pageFp>/<textHash>.<occurrence>.json
 *   docs/<docHash>/jobs/ai-read.json | translate.<lang>.json
 *
 * Every file is one entry, written whole and atomically (files.ts); the same
 * entry is last-writer-wins. An entry that cannot be read or does not have the
 * expected shape counts as absent, so the job simply produces it again.
 */
import { isAbsolute, join } from 'node:path'
import type { InlineRun } from '../tree/types'
import { folderSize, listNames, readJson, removeFolder, writeJsonAtomic } from './files'
import { blockKeyString, type TranslationBlockKey } from './keys'

/** the store's folder inside the user-data folder */
export const STORE_DIR_NAME = 'pdf-store'

/** a job record refreshed this recently counts as running (spec §10) */
export const JOB_RUNNING_WINDOW_MS = 30_000

const FORMAT = 1

// ── entry types ──

/** the AI's reading of one page, as the page-reading job produces it (opaque here) */
export interface AiReadPayload {
  /** payload format version, owned by the producer */
  version: number
  [key: string]: unknown
}

export interface AiReadPageEntry {
  pageFingerprint: string
  payload: AiReadPayload
  provider?: string
  model?: string
  /** epoch ms of the write */
  savedAt: number
}

export interface TranslationMetaInput {
  /** AI provider id that translates this document into the language */
  provider: string
  model: string
}

/** translated: `text` (and optionally `runs`) replace the source; failed: the source stays */
export type TranslationBlockStatus = 'translated' | 'failed'

export interface TranslationBlockInput {
  key: TranslationBlockKey
  status: TranslationBlockStatus
  /** translated text; required when status is 'translated' */
  text?: string
  /** translated text with its marks restored, when the producer has them */
  runs?: InlineRun[]
  /** why the block stayed in the source language */
  reason?: string
}

export interface TranslationBlockEntry extends TranslationBlockInput {
  savedAt: number
}

export interface StoredTranslation {
  lang: string
  /** null when the translation's own record is missing or unreadable */
  provider: string | null
  model: string | null
  /** keyed by blockKeyString(key) */
  blocks: Map<string, TranslationBlockEntry>
}

export type JobKind = 'ai-read' | 'translate'
export type JobState = 'idle' | 'running' | 'stopped' | 'complete'
/** spec §10: rate-limit | cancelled | failures | interrupted | an existing errorCode */
export type JobLastError = 'rate-limit' | 'cancelled' | 'failures' | 'interrupted' | (string & {})

export interface JobProgress {
  done: number
  total: number
}

export interface JobRecordInput {
  kind: JobKind
  /** target language; required for 'translate' */
  lang?: string
  /** what the job says about itself; 'idle' is only ever derived */
  state: Exclude<JobState, 'idle'>
  last_error?: JobLastError
  /** epoch ms when a rate limit lifts */
  resetsAt?: number
  /** result files the job wrote */
  outputs?: string[]
  progress?: JobProgress
}

export interface JobStatus {
  kind: JobKind
  lang?: string
  /**
   * idle: no record. running: recorded as running and refreshed within the
   * running window. A running record gone stale is a job whose process ended
   * without saying so: stopped, last_error 'interrupted'.
   */
  state: JobState
  last_error?: JobLastError
  resetsAt?: number
  outputs: string[]
  progress?: JobProgress
  /** epoch ms of the last write (the heartbeat) */
  updatedAt?: number
}

export interface MigrateInput {
  /** hash of the file bytes before the in-app save */
  oldDocHash: string
  /** hash of the saved file bytes */
  newDocHash: string
  /** page fingerprints of the saved document, any order */
  pageFingerprints: readonly string[]
}

export interface MigrateResult {
  aiReadPages: number
  translationBlocks: number
  /** languages that received anything */
  languages: string[]
}

export interface ResultStoreOptions {
  /** clock for savedAt / heartbeats, epoch ms */
  now?: () => number
  /** see JOB_RUNNING_WINDOW_MS */
  runningWindowMs?: number
}

// ── validation ──

const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/

/** a key used as a path segment: letters, digits, '-', '_' only */
function seg(value: string, what: string): string {
  if (typeof value !== 'string' || !SEGMENT.test(value)) {
    throw new TypeError(`result store: invalid ${what} ${JSON.stringify(value)}`)
  }
  return value
}

const isValidSeg = (value: unknown): value is string =>
  typeof value === 'string' && SEGMENT.test(value)

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const optStr = (v: unknown) => v === undefined || isStr(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)

function asAiRead(raw: unknown, pageFp: string): AiReadPageEntry | null {
  if (!isRecord(raw) || raw.format !== FORMAT || raw.pageFingerprint !== pageFp) return null
  if (!isRecord(raw.payload) || !isNum(raw.payload.version) || !isNum(raw.savedAt)) return null
  if (!optStr(raw.provider) || !optStr(raw.model)) return null
  const entry: AiReadPageEntry = {
    pageFingerprint: pageFp,
    payload: raw.payload as AiReadPayload,
    savedAt: raw.savedAt,
  }
  if (isStr(raw.provider)) entry.provider = raw.provider
  if (isStr(raw.model)) entry.model = raw.model
  return entry
}

function asMeta(raw: unknown, lang: string): (TranslationMetaInput & { savedAt: number }) | null {
  if (!isRecord(raw) || raw.format !== FORMAT || raw.lang !== lang) return null
  if (!isStr(raw.provider) || !isStr(raw.model) || !isNum(raw.savedAt)) return null
  return { provider: raw.provider, model: raw.model, savedAt: raw.savedAt }
}

function asBlock(raw: unknown, expect: TranslationBlockKey): TranslationBlockEntry | null {
  if (!isRecord(raw) || raw.format !== FORMAT || !isRecord(raw.key) || !isNum(raw.savedAt)) {
    return null
  }
  const k = raw.key
  if (
    k.pageFingerprint !== expect.pageFingerprint ||
    k.textHash !== expect.textHash ||
    k.occurrence !== expect.occurrence
  ) {
    return null
  }
  if (raw.status !== 'translated' && raw.status !== 'failed') return null
  if (raw.status === 'translated' && !isStr(raw.text)) return null
  if (!optStr(raw.text) || !optStr(raw.reason)) return null
  if (raw.runs !== undefined && !Array.isArray(raw.runs)) return null
  const entry: TranslationBlockEntry = {
    key: { ...expect },
    status: raw.status,
    savedAt: raw.savedAt,
  }
  if (isStr(raw.text)) entry.text = raw.text
  if (Array.isArray(raw.runs)) entry.runs = raw.runs as InlineRun[]
  if (isStr(raw.reason)) entry.reason = raw.reason
  return entry
}

interface StoredJob extends JobRecordInput {
  outputs: string[]
  updatedAt: number
}

function asJob(raw: unknown, kind: JobKind, lang: string | undefined): StoredJob | null {
  if (!isRecord(raw) || raw.format !== FORMAT || raw.kind !== kind) return null
  if (kind === 'translate' ? raw.lang !== lang : raw.lang !== undefined) return null
  if (raw.state !== 'running' && raw.state !== 'stopped' && raw.state !== 'complete') return null
  if (!isNum(raw.updatedAt) || !isStringArray(raw.outputs) || !optStr(raw.last_error)) return null
  if (raw.resetsAt !== undefined && !isNum(raw.resetsAt)) return null
  const p = raw.progress
  if (p !== undefined && !(isRecord(p) && isNum(p.done) && isNum(p.total))) return null
  const job: StoredJob = { kind, state: raw.state, outputs: raw.outputs, updatedAt: raw.updatedAt }
  if (lang !== undefined) job.lang = lang
  if (isStr(raw.last_error)) job.last_error = raw.last_error
  if (isNum(raw.resetsAt)) job.resetsAt = raw.resetsAt
  if (isRecord(p)) job.progress = { done: p.done as number, total: p.total as number }
  return job
}

const BLOCK_FILE = /^([A-Za-z0-9_-]{1,128})\.(\d{1,9})\.json$/
const JOB_FILE = /^(?:ai-read|translate\.([A-Za-z0-9_-]{1,128}))\.json$/

// ── the store ──

/**
 * Root of the store. Pass the user-data folder of THIS program:
 * - the app: Electron `app.getPath('userData')`
 * - the terminal command and MCP server: `genofficeUserDataDir(env)` from
 *   packages/cli/src/gui.ts (the folder `aiDataDir(env)` in cloud.ts also
 *   resolves to), so both write the same store.
 * Never `~/.genoffice`: that folder belongs to the original program and is
 * neither read nor written; the constructor refuses it.
 *
 * The store lives in one subfolder (`STORE_DIR_NAME`); deleteAll removes only
 * that subfolder, never the user-data folder around it.
 */
export class ResultStore {
  /** absolute path of the store folder */
  readonly dir: string
  private readonly now: () => number
  private readonly runningWindowMs: number

  constructor(userDataDir: string, options: ResultStoreOptions = {}) {
    if (!isAbsolute(userDataDir)) {
      throw new TypeError(`result store: the user-data folder must be absolute: ${userDataDir}`)
    }
    if (userDataDir.split(/[\\/]/).some((part) => part.toLowerCase() === '.genoffice')) {
      throw new TypeError('result store: ~/.genoffice belongs to the original program')
    }
    this.dir = join(userDataDir, STORE_DIR_NAME)
    this.now = options.now ?? Date.now
    this.runningWindowMs = options.runningWindowMs ?? JOB_RUNNING_WINDOW_MS
  }

  // ── paths (exposed for diagnostics and tests) ──

  documentDir(docHash: string): string {
    return join(this.dir, 'docs', seg(docHash, 'document hash'))
  }

  aiReadPagePath(docHash: string, pageFp: string): string {
    return join(this.documentDir(docHash), 'ai-read', `${seg(pageFp, 'page fingerprint')}.json`)
  }

  translationDir(docHash: string, lang: string): string {
    return join(this.documentDir(docHash), 'translations', seg(lang, 'language'))
  }

  translationMetaPath(docHash: string, lang: string): string {
    return join(this.translationDir(docHash, lang), 'translation.json')
  }

  translationBlockPath(docHash: string, lang: string, key: TranslationBlockKey): string {
    if (!Number.isInteger(key.occurrence) || key.occurrence < 0) {
      throw new TypeError(`result store: invalid block occurrence ${key.occurrence}`)
    }
    return join(
      this.translationDir(docHash, lang),
      'blocks',
      seg(key.pageFingerprint, 'page fingerprint'),
      `${seg(key.textHash, 'text hash')}.${key.occurrence}.json`,
    )
  }

  jobPath(docHash: string, kind: JobKind, lang?: string): string {
    const name = kind === 'ai-read' ? 'ai-read' : `translate.${seg(lang ?? '', 'language')}`
    return join(this.documentDir(docHash), 'jobs', `${name}.json`)
  }

  // ── AI-read pages ──

  async writeAiReadPage(
    docHash: string,
    pageFp: string,
    payload: AiReadPayload,
    meta: { provider?: string; model?: string } = {},
  ): Promise<void> {
    if (!isRecord(payload) || !isNum(payload.version)) {
      throw new TypeError('result store: an AI-read payload needs a numeric version')
    }
    await this.putAiRead(docHash, {
      pageFingerprint: pageFp,
      payload,
      ...meta,
      savedAt: this.now(),
    })
  }

  async readAiReadPage(docHash: string, pageFp: string): Promise<AiReadPageEntry | null> {
    if (!isValidSeg(docHash) || !isValidSeg(pageFp)) return null
    return asAiRead(await readJson(this.aiReadPagePath(docHash, pageFp)), pageFp)
  }

  /** every readable AI-read page of the document, keyed by page fingerprint */
  async readAiReadPages(docHash: string): Promise<Map<string, AiReadPageEntry>> {
    const out = new Map<string, AiReadPageEntry>()
    if (!isValidSeg(docHash)) return out
    for (const name of await listNames(join(this.documentDir(docHash), 'ai-read'), 'file')) {
      const fp = name.endsWith('.json') ? name.slice(0, -5) : ''
      if (!isValidSeg(fp)) continue
      const entry = await this.readAiReadPage(docHash, fp)
      if (entry) out.set(fp, entry)
    }
    return out
  }

  private async putAiRead(docHash: string, entry: AiReadPageEntry): Promise<void> {
    const path = this.aiReadPagePath(docHash, entry.pageFingerprint)
    await writeJsonAtomic(path, { format: FORMAT, ...entry })
  }

  // ── translations ──

  /** record (or replace) who translates this document into `lang` */
  async writeTranslationMeta(
    docHash: string,
    lang: string,
    meta: TranslationMetaInput,
  ): Promise<void> {
    if (!isStr(meta.provider) || !isStr(meta.model)) {
      throw new TypeError('result store: a translation needs provider and model')
    }
    await this.putMeta(docHash, lang, { ...meta, savedAt: this.now() })
  }

  async writeTranslationBlock(
    docHash: string,
    lang: string,
    block: TranslationBlockInput,
  ): Promise<void> {
    if (block.status !== 'translated' && block.status !== 'failed') {
      throw new TypeError(`result store: invalid block status ${String(block.status)}`)
    }
    if (block.status === 'translated' && !isStr(block.text)) {
      throw new TypeError('result store: a translated block needs its text')
    }
    await this.putBlock(docHash, lang, { ...block, savedAt: this.now() })
  }

  /** each block is its own entry; on failure the earlier ones stay written */
  async writeTranslationBlocks(
    docHash: string,
    lang: string,
    blocks: readonly TranslationBlockInput[],
  ): Promise<void> {
    for (const b of blocks) await this.writeTranslationBlock(docHash, lang, b)
  }

  /** the stored translation into `lang`, or null when there is none */
  async readTranslation(docHash: string, lang: string): Promise<StoredTranslation | null> {
    if (!isValidSeg(docHash) || !isValidSeg(lang)) return null
    if (!(await this.listTranslations(docHash)).includes(lang)) return null
    const meta = asMeta(await readJson(this.translationMetaPath(docHash, lang)), lang)
    const blocks = new Map<string, TranslationBlockEntry>()
    for (const b of await this.readBlocks(docHash, lang)) {
      blocks.set(blockKeyString(b.key), b)
    }
    return { lang, provider: meta?.provider ?? null, model: meta?.model ?? null, blocks }
  }

  /** languages this document has a stored translation for */
  async listTranslations(docHash: string): Promise<string[]> {
    if (!isValidSeg(docHash)) return []
    const names = await listNames(join(this.documentDir(docHash), 'translations'), 'dir')
    return names.filter(isValidSeg)
  }

  /** drop the translation into `lang` ("처음부터 다시 번역" replaces it) */
  async deleteTranslation(docHash: string, lang: string): Promise<void> {
    await removeFolder(this.translationDir(docHash, lang))
  }

  private async putMeta(
    docHash: string,
    lang: string,
    meta: TranslationMetaInput & { savedAt: number },
  ): Promise<void> {
    await writeJsonAtomic(this.translationMetaPath(docHash, lang), {
      format: FORMAT,
      lang,
      provider: meta.provider,
      model: meta.model,
      savedAt: meta.savedAt,
    })
  }

  private async putBlock(docHash: string, lang: string, b: TranslationBlockEntry): Promise<void> {
    const path = this.translationBlockPath(docHash, lang, b.key)
    const entry: Record<string, unknown> = {
      format: FORMAT,
      key: {
        pageFingerprint: b.key.pageFingerprint,
        textHash: b.key.textHash,
        occurrence: b.key.occurrence,
      },
      status: b.status,
      savedAt: b.savedAt,
    }
    if (b.text !== undefined) entry.text = b.text
    if (b.runs !== undefined) entry.runs = b.runs
    if (b.reason !== undefined) entry.reason = b.reason
    await writeJsonAtomic(path, entry)
  }

  private async readBlocks(
    docHash: string,
    lang: string,
    onlyPages?: ReadonlySet<string>,
  ): Promise<TranslationBlockEntry[]> {
    const out: TranslationBlockEntry[] = []
    const root = join(this.translationDir(docHash, lang), 'blocks')
    for (const fp of await listNames(root, 'dir')) {
      if (!isValidSeg(fp) || (onlyPages && !onlyPages.has(fp))) continue
      for (const name of await listNames(join(root, fp), 'file')) {
        const m = BLOCK_FILE.exec(name)
        if (!m) continue
        const key = { pageFingerprint: fp, textHash: m[1]!, occurrence: Number(m[2]) }
        const entry = asBlock(await readJson(join(root, fp, name)), key)
        if (entry) out.push(entry)
      }
    }
    return out
  }

  // ── job records ──

  /** write the job's record; every write is also its heartbeat */
  async writeJob(docHash: string, job: JobRecordInput): Promise<void> {
    if (job.kind !== 'ai-read' && job.kind !== 'translate') {
      throw new TypeError(`result store: invalid job kind ${String(job.kind)}`)
    }
    if (job.kind === 'translate' && !isValidSeg(job.lang)) {
      throw new TypeError('result store: a translate job needs a valid language')
    }
    if (job.state !== 'running' && job.state !== 'stopped' && job.state !== 'complete') {
      throw new TypeError(`result store: invalid job state ${String(job.state)}`)
    }
    const lang = job.kind === 'translate' ? job.lang : undefined
    const record: Record<string, unknown> = {
      format: FORMAT,
      kind: job.kind,
      state: job.state,
      outputs: [...(job.outputs ?? [])],
      updatedAt: this.now(),
    }
    if (lang !== undefined) record.lang = lang
    if (job.last_error !== undefined) record.last_error = job.last_error
    if (job.resetsAt !== undefined) record.resetsAt = job.resetsAt
    if (job.progress !== undefined) {
      record.progress = { done: job.progress.done, total: job.progress.total }
    }
    await writeJsonAtomic(this.jobPath(docHash, job.kind, lang), record)
  }

  /**
   * refresh a running job's heartbeat. False (and nothing written) when the
   * record is missing, unreadable or not running.
   */
  async heartbeatJob(docHash: string, kind: JobKind, lang?: string): Promise<boolean> {
    const stored = await this.readStoredJob(docHash, kind, lang)
    if (!stored || stored.state !== 'running') return false
    const { updatedAt: _ignored, ...rest } = stored
    await this.writeJob(docHash, rest)
    return true
  }

  async readJob(docHash: string, kind: JobKind, lang?: string): Promise<JobStatus> {
    const stored = await this.readStoredJob(docHash, kind, lang)
    if (stored) return this.resolveJob(stored)
    const idle: JobStatus = { kind, state: 'idle', outputs: [] }
    if (kind === 'translate' && lang !== undefined) idle.lang = lang
    return idle
  }

  /** every readable job record of the document */
  async listJobs(docHash: string): Promise<JobStatus[]> {
    if (!isValidSeg(docHash)) return []
    const out: JobStatus[] = []
    for (const name of await listNames(join(this.documentDir(docHash), 'jobs'), 'file')) {
      const m = JOB_FILE.exec(name)
      if (!m) continue
      const stored = await this.readStoredJob(docHash, m[1] ? 'translate' : 'ai-read', m[1])
      if (stored) out.push(this.resolveJob(stored))
    }
    return out
  }

  /** jobs not complete (running elsewhere, or stopped) — the source of the resume offer */
  async unfinishedJobs(docHash: string): Promise<JobStatus[]> {
    return (await this.listJobs(docHash)).filter((j) => j.state !== 'complete')
  }

  private async readStoredJob(
    docHash: string,
    kind: JobKind,
    lang: string | undefined,
  ): Promise<StoredJob | null> {
    if (!isValidSeg(docHash)) return null
    if (kind === 'translate' && !isValidSeg(lang)) return null
    const effectiveLang = kind === 'translate' ? lang : undefined
    return asJob(await readJson(this.jobPath(docHash, kind, effectiveLang)), kind, effectiveLang)
  }

  private resolveJob(stored: StoredJob): JobStatus {
    const status: JobStatus = {
      kind: stored.kind,
      state: stored.state,
      outputs: stored.outputs,
      updatedAt: stored.updatedAt,
    }
    if (stored.lang !== undefined) status.lang = stored.lang
    if (stored.last_error !== undefined) status.last_error = stored.last_error
    if (stored.resetsAt !== undefined) status.resetsAt = stored.resetsAt
    if (stored.progress !== undefined) status.progress = stored.progress
    if (stored.state === 'running' && this.now() - stored.updatedAt > this.runningWindowMs) {
      status.state = 'stopped'
      status.last_error ??= 'interrupted'
    }
    return status
  }

  // ── migration on in-app save ──

  /**
   * After an in-app save changed the file hash, copy the AI-read pages and
   * translation blocks whose page fingerprint the saved document still has.
   * Matching is by fingerprint, so reordered pages carry over too. An entry
   * already in the new document is replaced only by a newer one, so this can
   * run again when a job that started before the save finishes. Old entries
   * stay; job records are not copied.
   */
  async migrateDocument(input: MigrateInput): Promise<MigrateResult> {
    const result: MigrateResult = { aiReadPages: 0, translationBlocks: 0, languages: [] }
    const { oldDocHash, newDocHash } = input
    seg(newDocHash, 'document hash')
    if (!isValidSeg(oldDocHash) || oldDocHash === newDocHash) return result
    const pages = new Set(input.pageFingerprints.filter(isValidSeg))

    for (const [fp, entry] of await this.readAiReadPages(oldDocHash)) {
      if (!pages.has(fp)) continue
      const current = await this.readAiReadPage(newDocHash, fp)
      if (current && current.savedAt >= entry.savedAt) continue
      await this.putAiRead(newDocHash, entry)
      result.aiReadPages++
    }

    for (const lang of await this.listTranslations(oldDocHash)) {
      let touched = false
      const meta = asMeta(await readJson(this.translationMetaPath(oldDocHash, lang)), lang)
      if (meta) {
        const current = asMeta(await readJson(this.translationMetaPath(newDocHash, lang)), lang)
        if (!current || current.savedAt < meta.savedAt) {
          await this.putMeta(newDocHash, lang, meta)
          touched = true
        }
      }
      for (const block of await this.readBlocks(oldDocHash, lang, pages)) {
        const current = asBlock(
          await readJson(this.translationBlockPath(newDocHash, lang, block.key)),
          block.key,
        )
        if (current && current.savedAt >= block.savedAt) continue
        await this.putBlock(newDocHash, lang, block)
        result.translationBlocks++
        touched = true
      }
      if (touched) result.languages.push(lang)
    }
    return result
  }

  // ── delete and size ──

  /** remove everything stored for one document */
  async deleteDocument(docHash: string): Promise<void> {
    await removeFolder(this.documentDir(docHash))
  }

  /** remove the whole store folder (and nothing outside it) */
  async deleteAll(): Promise<void> {
    await removeFolder(this.dir)
  }

  /** bytes on disk, for one document or for the whole store */
  async size(docHash?: string): Promise<number> {
    if (docHash === undefined) return folderSize(this.dir)
    return isValidSeg(docHash) ? folderSize(this.documentDir(docHash)) : 0
  }
}
