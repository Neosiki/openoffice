/**
 * Limits on subscription use from the automatic-call path (command line,
 * MCP): one request at a time, and a fixed number an hour.
 *
 * Every CLI command is its own process, so neither limit can live in memory.
 * Both are kept in the data directory: a lock file that one request holds
 * for as long as it runs, and a ledger of the start times of the last hour's
 * requests, read and written only while holding the lock.
 *
 * A process can die holding the lock. The holder refreshes the lock file's
 * modification time while it runs; a lock whose process is gone, or whose
 * heartbeat stopped and stays stopped, is taken over.
 *
 * The count fails closed. A ledger whose content is damaged counts as a
 * used-up allowance until one window after it was last written, and a
 * request whose slot cannot be written down is not run.
 */

import { randomUUID } from 'node:crypto'
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { AiRunError } from '@genoffice/ai-provider'

/** Subscription requests the automatic-call path may start per window (spec default: 20 an hour). */
export const HEADLESS_SUBSCRIPTION_MAX_PER_HOUR = 20
export const HEADLESS_SUBSCRIPTION_WINDOW_MS = 60 * 60 * 1000
/** A lock not refreshed for this long belongs to a process that died or hung. */
export const HEADLESS_LOCK_STALE_MS = 60_000
/** How often the holder refreshes its lock; several beats fit in the stale time. */
export const HEADLESS_LOCK_HEARTBEAT_MS = 10_000
/** How often a waiting request looks at the lock again. */
export const HEADLESS_LOCK_POLL_MS = 250
/** How long a request waits for its turn before it gives up with a timeout. */
export const HEADLESS_QUEUE_TIMEOUT_MS = 30 * 60 * 1000

/** How long the file system may keep refusing the lock file before the request fails. */
const LOCK_DENIED_GRACE_MS = 5_000

/** Start times (epoch ms) of the requests of the last window, under the data directory. */
export const HEADLESS_LEDGER_FILE = 'headless-subscription-ledger.json'
/** Held by the one request that is running, under the data directory. */
export const HEADLESS_LOCK_FILE = 'headless-subscription.lock'

export interface HeadlessLimitOptions {
  maxPerHour?: number | undefined
  windowMs?: number | undefined
  /** clock for the ledger; lock freshness always follows the file system's clock */
  now?: (() => number) | undefined
}

export interface HeadlessCallOptions extends HeadlessLimitOptions {
  staleMs?: number | undefined
  heartbeatMs?: number | undefined
  pollMs?: number | undefined
  queueTimeoutMs?: number | undefined
  /** stops the wait for a turn; a request that already started is the caller's to cancel */
  signal?: AbortSignal | undefined
  isProcessAlive?: ((pid: number) => boolean) | undefined
}

export interface HeadlessSubscriptionUsage {
  used: number
  limit: number
  /** epoch ms at which the next slot frees; only when the limit is reached */
  resetsAt?: number
}

interface Limits {
  maxPerHour: number
  windowMs: number
  now: () => number
}

function limitsOf(options: HeadlessLimitOptions): Limits {
  return {
    maxPerHour: options.maxPerHour ?? HEADLESS_SUBSCRIPTION_MAX_PER_HOUR,
    windowMs: options.windowMs ?? HEADLESS_SUBSCRIPTION_WINDOW_MS,
    now: options.now ?? Date.now,
  }
}

function errorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined
}

// ── ledger ──────────────────────────────────────────────────────────

/** What the ledger file says about this window. */
type Ledger =
  /** request times of this window, oldest first; a missing file is first use and reads as none */
  | { kind: 'ok'; runs: number[] }
  /** the content is not a ledger: the count is unknown, so the allowance counts as used up */
  | { kind: 'damaged'; resetsAt: number }
  /** the file is there but could not be read just now */
  | { kind: 'unreadable'; error: unknown }

const LEDGER_RENAME_ATTEMPTS = 5
const LEDGER_RENAME_RETRY_MS = 20

/** The request times a ledger file holds, or null when its content is not a ledger. */
function parseLedger(raw: string): number[] | null {
  let stored: unknown
  try {
    stored = JSON.parse(raw)
  } catch {
    return null
  }
  const runs: unknown =
    typeof stored === 'object' && stored !== null ? (stored as { runs?: unknown }).runs : undefined
  if (!Array.isArray(runs)) return null
  return runs.every((time) => typeof time === 'number' && Number.isFinite(time))
    ? (runs as number[])
    : null
}

/**
 * Reads the ledger. Damaged content must not erase the count, and must not
 * lock the user out for good either: it is taken as "the allowance was used
 * up when this file was last written", so requests are refused until one
 * window after the file's modification time and a fresh ledger starts then.
 * A time in the future (the clock was set back) counts as now, so nothing
 * holds a slot for longer than a window.
 */
function readLedger(dir: string, limits: Limits): Ledger {
  const path = join(dir, HEADLESS_LEDGER_FILE)
  const now = limits.now()
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (error) {
    return errorCode(error) === 'ENOENT' ? { kind: 'ok', runs: [] } : { kind: 'unreadable', error }
  }
  const runs = parseLedger(raw)
  if (runs) {
    return {
      kind: 'ok',
      runs: runs
        .map((time) => Math.min(time, now))
        .filter((time) => time > now - limits.windowMs)
        .sort((a, b) => a - b),
    }
  }
  let writtenAt = now
  try {
    writtenAt = Math.min(Math.round(statSync(path).mtimeMs), now)
  } catch {
    /* gone or unreadable since the read: the full window from now */
  }
  const resetsAt = writtenAt + limits.windowMs
  return resetsAt > now ? { kind: 'damaged', resetsAt } : { kind: 'ok', runs: [] }
}

/**
 * Replaces the ledger whole or not at all: the new content goes to a
 * temporary file that is renamed over the old one, and nothing is ever
 * written in place, so neither a crash nor a refused rename can leave half a
 * ledger behind. A rename that keeps being refused fails the request here,
 * before it runs.
 */
async function writeLedger(dir: string, runs: number[]): Promise<void> {
  const path = join(dir, HEADLESS_LEDGER_FILE)
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, JSON.stringify({ version: 1, runs }))
    for (let attempt = 1; ; attempt++) {
      try {
        renameSync(temp, path)
        return
      } catch (err) {
        // Windows refuses the rename for a moment while a scanner holds the old file open
        const code = errorCode(err)
        const passing = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
        if (!passing || attempt >= LEDGER_RENAME_ATTEMPTS) throw err
        await sleep(LEDGER_RENAME_RETRY_MS, undefined)
      }
    }
  } catch (err) {
    removeIfExists(temp)
    throw ledgerError('record the request in', err)
  }
}

/** The request is not run when the count cannot be kept. */
function ledgerError(action: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new Error(
    `Cannot ${action} the ledger of subscription requests from the command line and integrations, so the request was not run (${detail})`,
  )
}

/** When the next slot frees, or undefined while one is free. */
function resetTime(runs: number[], limits: Limits): number | undefined {
  if (runs.length < limits.maxPerHour) return undefined
  return runs[runs.length - limits.maxPerHour]! + limits.windowMs
}

function limitError(resetsAt: number, limits: Limits): AiRunError {
  return new AiRunError(
    'headless-limit',
    `Subscription use from the command line and integrations is limited to ${limits.maxPerHour} requests per hour; the next one is possible at ${new Date(resetsAt).toISOString()}`,
    { resetsAt },
  )
}

function damagedError(resetsAt: number): AiRunError {
  return new AiRunError(
    'headless-limit',
    `The ledger of subscription requests from the command line and integrations is damaged, so this hour's allowance counts as used up; the next request is possible at ${new Date(resetsAt).toISOString()}`,
    { resetsAt },
  )
}

/**
 * How much of this window's allowance is used. Reads only; takes no slot and
 * no lock. A ledger that is damaged or cannot be read reports the allowance
 * as used up, as a request would find it.
 */
export function headlessSubscriptionUsage(
  dataDir: string,
  options: HeadlessLimitOptions = {},
): HeadlessSubscriptionUsage {
  const limits = limitsOf(options)
  const ledger = readLedger(dataDir, limits)
  if (ledger.kind !== 'ok') {
    return {
      used: limits.maxPerHour,
      limit: limits.maxPerHour,
      resetsAt: ledger.kind === 'damaged' ? ledger.resetsAt : limits.now() + limits.windowMs,
    }
  }
  const resetsAt = resetTime(ledger.runs, limits)
  return {
    used: ledger.runs.length,
    limit: limits.maxPerHour,
    ...(resetsAt !== undefined ? { resetsAt } : {}),
  }
}

// ── lock ────────────────────────────────────────────────────────────

interface LockState {
  /** file content as read; identifies one acquisition */
  raw: string
  pid: number | undefined
  mtimeMs: number
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM: the process exists but belongs to someone else
    return errorCode(err) === 'EPERM'
  }
}

function readLock(path: string): LockState | null {
  try {
    const mtimeMs = statSync(path).mtimeMs
    const raw = readFileSync(path, 'utf-8')
    let pid: number | undefined
    try {
      const parsed: unknown = JSON.parse(raw)
      const value =
        typeof parsed === 'object' && parsed !== null ? (parsed as { pid?: unknown }).pid : 0
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) pid = value
    } catch {
      /* written by a holder that died mid-write: only its age can tell */
    }
    return { raw, pid, mtimeMs }
  } catch {
    return null
  }
}

/**
 * Creates `path` only if it does not exist: `held` when another request has
 * it, `denied` when the file system refused without a lock being there.
 */
function createExclusive(path: string, content: string): 'created' | 'held' | 'denied' {
  try {
    writeFileSync(path, content, { flag: 'wx' })
    return 'created'
  } catch (err) {
    const code = errorCode(err)
    if (code === 'EEXIST') return 'held'
    // Windows answers EPERM / EBUSY while the previous holder's delete is still pending
    if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
      return readLock(path) ? 'held' : 'denied'
    }
    throw err
  }
}

function removeIfExists(path: string): void {
  try {
    unlinkSync(path)
  } catch {
    /* already gone, or another process is removing it */
  }
}

interface LockOptions {
  staleMs: number
  heartbeatMs: number
  pollMs: number
  queueTimeoutMs: number
  signal: AbortSignal | undefined
  isProcessAlive: (pid: number) => boolean
}

/** A lock whose heartbeat looked stopped, remembered until the next look confirms it. */
interface Suspect {
  raw: string
  mtimeMs: number
  since: number
}

/**
 * Removes a lock whose holder is gone, and returns what the caller should
 * remember for its next look.
 *
 * A holder whose process no longer exists is gone for certain. A silent
 * heartbeat alone is not proof: the holder may have been suspended (the
 * machine slept) and be about to carry on. Such a lock is only suspected at
 * first, and taken over when one full heartbeat later it has still not moved.
 *
 * Two waiters can decide to remove the same lock; if both simply deleted it,
 * the slower one would delete the fresh lock the faster one had taken
 * meanwhile. So the removal is done under a second, momentary lock, and only
 * after reading the lock again and finding it unchanged.
 */
function takeOverStaleLock(
  path: string,
  o: LockOptions,
  suspect: Suspect | undefined,
): Suspect | undefined {
  const seen = readLock(path)
  if (!seen) return undefined
  const gone = seen.pid !== undefined && !o.isProcessAlive(seen.pid)
  if (!gone) {
    if (Date.now() - seen.mtimeMs <= o.staleMs) return undefined
    if (suspect?.raw !== seen.raw || suspect.mtimeMs !== seen.mtimeMs) {
      return { raw: seen.raw, mtimeMs: seen.mtimeMs, since: Date.now() }
    }
    if (Date.now() - suspect.since < o.heartbeatMs) return suspect
  }
  const guard = `${path}.takeover`
  if (createExclusive(guard, String(process.pid)) !== 'created') {
    // a waiter that died inside the few lines below left the guard behind
    const left = readLock(guard)
    if (left && Date.now() - left.mtimeMs > o.staleMs) removeIfExists(guard)
    return suspect
  }
  try {
    const again = readLock(path)
    if (again && again.raw === seen.raw && (gone || again.mtimeMs === seen.mtimeMs)) {
      removeIfExists(path)
    }
  } finally {
    removeIfExists(guard)
  }
  return undefined
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError(signal))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function abortError(signal: AbortSignal | undefined): Error {
  const reason: unknown = signal?.reason
  return reason instanceof Error ? reason : new Error('The request was cancelled')
}

/** Waits for the lock and takes it. Returns the function that gives it back. */
async function acquireLock(dir: string, o: LockOptions): Promise<() => void> {
  const path = join(dir, HEADLESS_LOCK_FILE)
  const content = JSON.stringify({ token: randomUUID(), pid: process.pid, acquiredAt: Date.now() })
  const deadline = Date.now() + o.queueTimeoutMs
  let deniedSince: number | undefined
  let suspect: Suspect | undefined
  for (;;) {
    if (o.signal?.aborted) throw abortError(o.signal)
    let attempt = createExclusive(path, content)
    if (attempt === 'held') {
      suspect = takeOverStaleLock(path, o, suspect)
      attempt = createExclusive(path, content)
    }
    if (attempt === 'created') break
    if (attempt === 'denied') {
      // a pending delete clears within moments; a refusal that lasts is a directory we cannot write
      deniedSince ??= Date.now()
      if (Date.now() - deniedSince > LOCK_DENIED_GRACE_MS) {
        throw new Error(`Cannot create the lock file ${path}`)
      }
    } else {
      deniedSince = undefined
    }
    if (Date.now() >= deadline) {
      throw new AiRunError(
        'timeout',
        'Timed out waiting for another subscription request from the command line or an integration to finish',
      )
    }
    await sleep(o.pollMs, o.signal)
  }
  const heartbeat = setInterval(() => {
    // refresh only our own lock: after a takeover it is someone else's
    if (readLock(path)?.raw !== content) return
    try {
      const now = new Date()
      utimesSync(path, now, now)
    } catch {
      /* the lock is gone; release() will find out */
    }
  }, o.heartbeatMs)
  heartbeat.unref()
  return () => {
    clearInterval(heartbeat)
    if (readLock(path)?.raw === content) removeIfExists(path)
  }
}

// ── entry point ─────────────────────────────────────────────────────

/**
 * Runs one subscription request of the automatic-call path: waits until no
 * other such request is running (in this or any other process), takes one
 * slot of this hour's allowance, and runs it.
 *
 * Throws AiRunError('headless-limit', …, { resetsAt }) when the allowance is
 * used up or the ledger is damaged, without waiting and without running, and
 * a plain Error when the ledger cannot be read or replaced. The slot is taken
 * when the request starts, so a request that fails still counts: it reached
 * the subscription.
 */
export async function runHeadlessSubscriptionCall<T>(
  dataDir: string,
  run: () => Promise<T>,
  options: HeadlessCallOptions = {},
): Promise<T> {
  const limits = limitsOf(options)
  mkdirSync(dataDir, { recursive: true })
  // over the limit there is nothing to queue for: answer before waiting for a turn.
  // A ledger that could not be read just now is read again under the lock.
  const early = readLedger(dataDir, limits)
  if (early.kind === 'damaged') throw damagedError(early.resetsAt)
  const earlyReset = early.kind === 'ok' ? resetTime(early.runs, limits) : undefined
  if (earlyReset !== undefined) throw limitError(earlyReset, limits)
  const release = await acquireLock(dataDir, {
    staleMs: options.staleMs ?? HEADLESS_LOCK_STALE_MS,
    heartbeatMs: options.heartbeatMs ?? HEADLESS_LOCK_HEARTBEAT_MS,
    pollMs: options.pollMs ?? HEADLESS_LOCK_POLL_MS,
    queueTimeoutMs: options.queueTimeoutMs ?? HEADLESS_QUEUE_TIMEOUT_MS,
    signal: options.signal,
    isProcessAlive: options.isProcessAlive ?? defaultIsProcessAlive,
  })
  try {
    // the count that decides: nobody else writes the ledger while we hold the lock
    const ledger = readLedger(dataDir, limits)
    if (ledger.kind === 'damaged') throw damagedError(ledger.resetsAt)
    if (ledger.kind === 'unreadable') throw ledgerError('read', ledger.error)
    const resetsAt = resetTime(ledger.runs, limits)
    if (resetsAt !== undefined) throw limitError(resetsAt, limits)
    await writeLedger(dataDir, [...ledger.runs, limits.now()])
    return await run()
  } finally {
    release()
  }
}
