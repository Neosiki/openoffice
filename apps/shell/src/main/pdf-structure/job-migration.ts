/**
 * Carry unfinished job records to the new document hash after an in-app save
 * (spec §6, §9): the store's migrateDocument copies results but not job
 * records, and without them the "continue the unfinished job?" offer would
 * not appear for the saved file. Built on the store's public API only.
 *
 * A record already in the new document wins when it is at least as recent
 * (same rule as the result migration), so running this again is harmless.
 * A job still running elsewhere stays 'running' and, unless its owner moves
 * its heartbeat to the new hash, turns 'stopped' / 'interrupted' once the
 * running window passes.
 */
import type { JobRecordInput, ResultStore } from '../../../../../packages/pdf-structure/src/store'

export async function migrateUnfinishedJobs(
  store: Pick<ResultStore, 'unfinishedJobs' | 'readJob' | 'writeJob'>,
  oldDocHash: string,
  newDocHash: string,
): Promise<number> {
  if (oldDocHash === newDocHash) return 0
  let moved = 0
  for (const job of await store.unfinishedJobs(oldDocHash)) {
    if (job.state !== 'running' && job.state !== 'stopped') continue
    const current = await store.readJob(newDocHash, job.kind, job.lang)
    if (current.state !== 'idle' && (current.updatedAt ?? 0) >= (job.updatedAt ?? 0)) continue
    const record: JobRecordInput = { kind: job.kind, state: job.state, outputs: job.outputs }
    if (job.lang !== undefined) record.lang = job.lang
    if (job.last_error !== undefined) record.last_error = job.last_error
    if (job.resetsAt !== undefined) record.resetsAt = job.resetsAt
    if (job.progress !== undefined) record.progress = job.progress
    await store.writeJob(newDocHash, record)
    moved++
  }
  return moved
}
