/**
 * File primitives of the result store: atomic whole-file JSON writes and
 * reads that never throw.
 *
 * A write goes to a uniquely named temp file beside the target, is flushed,
 * then renamed over the target. Readers therefore see either the previous
 * entry or the new one, never a torn file, and two processes writing the same
 * entry end with whichever rename came last.
 */
import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, rm, stat, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/**
 * A store write failed (disk full, permissions, a file in the way). The job
 * that hit it stops and reports it (spec "보관소 쓰기 실패"). The entry that
 * was there before the failed write is left as it was.
 */
export class StoreWriteError extends Error {
  readonly code = 'store-write-failed' as const
  /** Node error code of the cause (ENOSPC, EACCES, ENOTDIR, …), 'unknown' without one */
  readonly errno: string
  readonly path: string

  constructor(path: string, cause: unknown) {
    const errno = (cause as NodeJS.ErrnoException | undefined)?.code ?? 'unknown'
    super(`result store write failed (${errno}): ${path}`, { cause })
    this.name = 'StoreWriteError'
    this.errno = errno
    this.path = path
  }
}

/** temp files start with a dot; listings skip them */
export const isTempName = (name: string): boolean => name.startsWith('.')

// Windows refuses a rename onto a file another process is replacing or has
// just opened; those clear within milliseconds.
const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY'])
const RENAME_ATTEMPTS = 10
const READ_ATTEMPTS = 4
// cloud-sync folders and some filesystems refuse fsync; only durability suffers
const TOLERATED_SYNC = new Set(['EPERM', 'EACCES', 'EBUSY', 'EINVAL', 'ENOSYS', 'ENOTSUP'])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const codeOf = (e: unknown): string => (e as NodeJS.ErrnoException | undefined)?.code ?? ''
const backoff = (attempt: number) => sleep(Math.min(5 * 2 ** attempt, 250) * (0.5 + Math.random()))

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const data = JSON.stringify(value)
  const dir = dirname(path)
  const tmp = join(dir, `.${basename(path)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`)
  let created = false
  try {
    await mkdir(dir, { recursive: true })
    const handle = await open(tmp, 'wx')
    created = true
    try {
      await handle.writeFile(data, 'utf8')
      await handle.sync().catch((e: unknown) => {
        if (!TOLERATED_SYNC.has(codeOf(e))) throw e
      })
    } finally {
      await handle.close()
    }
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(tmp, path)
        return
      } catch (e) {
        if (!RETRYABLE.has(codeOf(e)) || attempt >= RENAME_ATTEMPTS - 1) throw e
        await backoff(attempt)
      }
    }
  } catch (e) {
    if (created) await unlink(tmp).catch(() => {})
    throw new StoreWriteError(path, e)
  }
}

/** parsed JSON, or undefined when the file is missing, unreadable or not JSON */
export async function readJson(path: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as unknown
    } catch (e) {
      // a file being replaced can refuse an open for a moment on Windows
      if (RETRYABLE.has(codeOf(e)) && attempt < READ_ATTEMPTS - 1) {
        await backoff(attempt)
        continue
      }
      return undefined
    }
  }
}

/** entry names of a folder, temp files left out; empty when it cannot be read */
export async function listNames(dir: string, kind: 'file' | 'dir'): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => !isTempName(e.name) && (kind === 'file' ? e.isFile() : e.isDirectory()))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/** byte total of every file below a folder; files that vanish mid-walk count 0 */
export async function folderSize(dir: string): Promise<number> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  let total = 0
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) total += await folderSize(p)
    else if (e.isFile())
      total += await stat(p).then(
        (s) => s.size,
        () => 0,
      )
  }
  return total
}

export async function removeFolder(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  } catch (e) {
    throw new StoreWriteError(dir, e)
  }
}
