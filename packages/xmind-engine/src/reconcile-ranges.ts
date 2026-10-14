/**
 * Summaries and boundaries across a change of branches.
 *
 * Both name the branches they cover by position: `"(first,last)"` in the list
 * of branches of the topic that carries the record. A position means nothing
 * once branches were added, deleted or moved, so before reconciling each range
 * is turned into the topics it covers, and afterwards it is written again from
 * where those topics now are:
 *
 * - a record whose covered branches are all gone is removed, and for a summary
 *   its summary topic with it;
 * - covered branches that no longer sit side by side shrink the range to the
 *   run that holds the first of them;
 * - a branch that moved to another topic counts as gone from the range.
 *
 * A range that cannot be read, or that reaches past the branches, is never
 * rewritten, and neither is any range of a topic whose branches did not change.
 */

import { type JsonRecord, recordsOf } from './tree-walk'
import type { XmindTopic } from './types'
import { formatRange, parseRange } from './view'

type RangeKey = 'summaries' | 'boundaries'

interface CoveringRecord {
  key: RangeKey
  record: JsonRecord
  start: number
  end: number
  /** ids of the branches inside the range, in branch order */
  covered: string[]
}

/** The ranges on one topic, as the topics they cover, taken before anything changes. */
export interface RangeSnapshot {
  owner: XmindTopic
  /** ids of the owner's branches at the time */
  branches: string[]
  records: CoveringRecord[]
}

/** Null for a topic that carries no range to keep track of. */
export function snapshotRanges(owner: XmindTopic): RangeSnapshot | null {
  const branches = branchIds(owner)
  const records: CoveringRecord[] = []
  for (const key of ['summaries', 'boundaries'] as const) {
    for (const record of recordsOf(owner[key])) {
      const range = parseRange(record.range)
      if (!range || range.end >= branches.length) continue
      const covered = branches.slice(range.start, range.end + 1)
      records.push({ key, record, start: range.start, end: range.end, covered })
    }
  }
  return records.length > 0 ? { owner, branches, records } : null
}

/**
 * Writes the ranges of a snapshot again for the branches the owner has now.
 * Records in `settled` already carry positions the state gave them and are
 * left alone, and so is a record that is no longer on the owner.
 */
export function rewriteRanges(snapshot: RangeSnapshot, settled: ReadonlySet<JsonRecord>): void {
  const { owner } = snapshot
  const branches = branchIds(owner)
  if (sameTexts(snapshot.branches, branches)) return
  for (const { key, record, start, end, covered } of snapshot.records) {
    const list = owner[key]
    if (settled.has(record) || !Array.isArray(list) || !list.includes(record)) continue
    const range = rangeOver(covered, branches)
    if (!range) {
      if (key === 'summaries') removeSummary(owner, record)
      else removeRecord(owner, key, record)
    } else if (range.start !== start || range.end !== end) {
      record.range = formatRange(range.start, range.end)
    }
  }
}

/**
 * Where the covered topics are among the branches now: the unbroken run of
 * them around the first one that is still there. Null when none is.
 */
function rangeOver(covered: readonly string[], branches: readonly string[]) {
  const position = new Map(branches.map((id, index) => [id, index]))
  const stillThere = new Set(covered.filter((id) => position.has(id)))
  const first = covered.find((id) => stillThere.has(id))
  if (first === undefined) return null
  let start = position.get(first)!
  let end = start
  while (start > 0 && stillThere.has(branches[start - 1]!)) start--
  while (end < branches.length - 1 && stillThere.has(branches[end + 1]!)) end++
  return { start, end }
}

/** Puts a summary on a topic: its record among `summaries`, its topic among the summary topics. */
export function addSummary(owner: XmindTopic, record: JsonRecord, summaryTopic: XmindTopic): void {
  if (Array.isArray(owner.summaries)) owner.summaries.push(record)
  else owner.summaries = [record]
  const children = (owner.children ??= {})
  if (children.summary) children.summary.push(summaryTopic)
  else children.summary = [summaryTopic]
}

/**
 * Takes a summary off a topic: its record, and its summary topic with all that
 * hangs under it, unless another record of the topic names the same one.
 */
export function removeSummary(owner: XmindTopic, record: JsonRecord): void {
  removeRecord(owner, 'summaries', record)
  const { topicId } = record
  if (recordsOf(owner.summaries).some((other) => other.topicId === topicId)) return
  const children = owner.children
  if (!children?.summary) return
  const rest = children.summary.filter((summaryTopic) => summaryTopic.id !== topicId)
  if (rest.length === children.summary.length) return
  if (rest.length > 0) children.summary = rest
  else delete children.summary
  dropEmptyChildren(owner)
}

/** Removes one record from a list on a topic. A list left empty goes too: the format writes none. */
function removeRecord(owner: XmindTopic, key: RangeKey, record: JsonRecord): void {
  const list = owner[key]
  if (!Array.isArray(list) || !list.includes(record)) return
  const rest = list.filter((entry) => entry !== record)
  if (rest.length > 0) owner[key] = rest
  else delete owner[key]
}

/** Drops `children` once the last list in it is gone. */
export function dropEmptyChildren(topic: XmindTopic): void {
  if (topic.children && Object.keys(topic.children).length === 0) delete topic.children
}

function branchIds(topic: XmindTopic): string[] {
  return (topic.children?.attached ?? []).map((branch) => branch.id)
}

function sameTexts(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((text, index) => text === b[index])
}
