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

/**
 * This window's request times, oldest first. A missing or damaged file reads
 * as no requests: the ledger is a courtesy limit on the user's own machine,
 * and a broken file must not lock them out. A time in the future (the clock
 * was set back) counts as now, so it cannot hold a slot longer than a window.
 */
function readLedger(dir: string, limits: Limits): number[] {
  let stored: unknown
  try {
    stored = JSON.parse(readFileSync(join(dir, HEADLESS_LEDGER_FILE), 'utf-8'))
  } catch {
    return []
  }
  const runs: unknown =
    typeof stored === 'object' && stored !== null ? (stored as { runs?: unknown }).runs : undefined
  if (!Array.isArray(runs)) return []
  const now = limits.now()
  return runs
    .filter((time): time is number => typeof time === 'number' && Number.isFinite(time))
    .map((time) => Math.min(time, now))
    .filter((time) => time > now - limits.windowMs)
    .sort((a, b) => a - b)
}

/** Written whole through a rename, so a crash mid-write cannot wipe the count. */
function writeLedger(dir: string, runs: number[]): void {
  const path = join(dir, HEADLESS_LEDGER_FILE)
  const content = JSON.stringify({ version: 1, runs })
  const temp = `${path}.${randomUUID()}.tmp`
  writeFileSync(temp, content)
  try {
    renameSync(temp, path)
  } catch {
    // Windows refuses the rename while a scanner holds the old file open: write in place
    removeIfExists(temp)
    writeFileSync(path, content)
  }
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

/** How much of this window's allowance is used. Reads only; takes no slot and no lock. */
export function headlessSubscriptionUsage(
  dataDir: string,
  options: HeadlessLimitOptions = {},
): HeadlessSubscriptionUsage {
  const limits = limitsOf(options)
  const runs = readLedger(dataDir, limits)
  const resetsAt = resetTime(runs, limits)
  return {
    used: runs.length,
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
 * used up, without waiting and without running. The slot is taken when the
 * request starts, so a request that fails still counts: it reached the
 * subscription.
 */
export async function runHeadlessSubscriptionCall<T>(
  dataDir: string,
  run: () => Promise<T>,
  options: HeadlessCallOptions = {},
): Promise<T> {
  const limits = limitsOf(options)
  mkdirSync(dataDir, { recursive: true })
  // over the limit there is nothing to queue for: answer before waiting for a turn
  const early = resetTime(readLedger(dataDir, limits), limits)
  if (early !== undefined) throw limitError(early, limits)
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
    const runs = readLedger(dataDir, limits)
    const resetsAt = resetTime(runs, limits)
    if (resetsAt !== undefined) throw limitError(resetsAt, limits)
    writeLedger(dataDir, [...runs, limits.now()])
    return await run()
  } finally {
    release()
  }
}
