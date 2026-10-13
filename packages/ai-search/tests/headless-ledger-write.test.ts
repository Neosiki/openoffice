import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// the ledger is replaced through a rename: this file makes that rename fail
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, renameSync: vi.fn(actual.renameSync) }
})

import {
  HEADLESS_LEDGER_FILE,
  HEADLESS_LOCK_FILE,
  runHeadlessSubscriptionCall,
} from '../src/headless-ledger'
import { tempDir } from './routing-helpers'

const rename = vi.mocked(renameSync)
const FAST = { pollMs: 5 }

function refuse(code: string): never {
  throw Object.assign(new Error(`${code}: operation not permitted, rename`), { code })
}

afterEach(() => {
  rename.mockReset()
})

describe('a ledger that cannot be replaced', () => {
  it('fails the request before it reaches the subscription, and leaves no half-written file', async () => {
    const dir = tempDir()
    rename.mockImplementation(() => refuse('EPERM'))
    const run = vi.fn(async () => 'ran')
    await expect(runHeadlessSubscriptionCall(dir, run, FAST)).rejects.toThrow(/ledger/i)
    expect(run).not.toHaveBeenCalled()
    expect(rename).toHaveBeenCalled()
    // no ledger, no temporary file, and the turn is free again
    expect(readdirSync(dir)).toEqual([])
    expect(existsSync(join(dir, HEADLESS_LOCK_FILE))).toBe(false)
  })

  it('keeps the count that was there, byte for byte', async () => {
    const dir = tempDir()
    const path = join(dir, HEADLESS_LEDGER_FILE)
    const before = JSON.stringify({ version: 1, runs: [Date.now() - 60_000] })
    writeFileSync(path, before)
    rename.mockImplementation(() => refuse('EBUSY'))
    const run = vi.fn(async () => 'ran')
    await expect(runHeadlessSubscriptionCall(dir, run, FAST)).rejects.toThrow(/ledger/i)
    expect(run).not.toHaveBeenCalled()
    expect(readFileSync(path, 'utf-8')).toBe(before)
    expect(readdirSync(dir)).toEqual([HEADLESS_LEDGER_FILE])
  })

  it('does not report the failure as the hourly limit', async () => {
    rename.mockImplementation(() => refuse('EPERM'))
    const error = await runHeadlessSubscriptionCall(tempDir(), async () => 'ran', FAST).catch(
      (err: unknown) => err,
    )
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toMatchObject({ kind: 'headless-limit' })
  })

  it('gets through a refusal that passes, as a scanner holding the file does', async () => {
    const dir = tempDir()
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
    rename
      .mockImplementationOnce(() => refuse('EPERM'))
      .mockImplementationOnce(() => refuse('EBUSY'))
      .mockImplementation(actual.renameSync)
    expect(await runHeadlessSubscriptionCall(dir, async () => 'ran', FAST)).toBe('ran')
    expect(rename).toHaveBeenCalledTimes(3)
    const { runs } = JSON.parse(readFileSync(join(dir, HEADLESS_LEDGER_FILE), 'utf-8'))
    expect(runs).toHaveLength(1)
    expect(readdirSync(dir)).toEqual([HEADLESS_LEDGER_FILE])
  })
})
