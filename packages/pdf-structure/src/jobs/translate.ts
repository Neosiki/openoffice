/**
 * The document translation job (spec §8) on the job engine. Blocks already
 * in the stored translation (translated or failed) are skipped; the rest are
 * cut into batches by the caller's `batch` (about 2,500 tokens each), one
 * call per batch. Each batch's blocks are stored together once it returns.
 * The translation's provider and model are recorded before its first block.
 */
import type { TextUnit } from '../tree/derive'
import type { InlineRun } from '../tree/types'
import type { TranslationBlockInput } from '../store/store'
import { blockKeyString, translationBlockKeys, type TranslationBlockKey } from '../store/keys'
import type { DocumentJobStore } from './engine'
import { JobUnitFailure } from './errors'
import {
  startDocumentJob,
  type DocumentJobEstimate,
  type DocumentJobHandle,
  type JobModelChoice,
  type ProviderChange,
  type StartDocumentJobOptions,
} from './job'

/** a block to translate: a tree text unit or anything with its runs and page */
export type TranslationSourceBlock = Pick<TextUnit, 'runs' | 'pageFingerprint' | 'page'>

export interface TranslationJobItem<B> {
  block: B
  /** the block's key in the store */
  key: TranslationBlockKey
}

/** the result for one block of a batch, in the batch's order */
export type TranslationBlockResult =
  | { status: 'translated'; text: string; runs?: InlineRun[] }
  /** the block stays in the source language (spec §8: placeholders kept failing) */
  | { status: 'failed'; reason: string }

export interface TranslationJobInput<B extends TranslationSourceBlock> {
  docHash: string
  /** target language code */
  lang: string
  /** every block of the confirmed page range, in reading order */
  blocks: readonly B[]
  /** cut the pending blocks into batches (each non-empty, all blocks once, in order) */
  batch: (items: readonly TranslationJobItem<B>[]) => TranslationJobItem<B>[][]
  model: JobModelChoice
  store: Pick<
    DocumentJobStore,
    | 'readTranslation'
    | 'writeTranslationMeta'
    | 'writeTranslationBlocks'
    | 'deleteTranslation'
    | 'writeJob'
  >
  /** start over: the stored translation is replaced (the user confirmed it) */
  restart?: boolean
}

export interface TranslationJobPlan<B> {
  estimate: DocumentJobEstimate
  batches: TranslationJobItem<B>[][]
}

type PlanInput<B extends TranslationSourceBlock> = Omit<TranslationJobInput<B>, 'store'> & {
  store: Pick<DocumentJobStore, 'readTranslation'>
}

export async function planTranslationJob<B extends TranslationSourceBlock>(
  input: PlanInput<B>,
): Promise<TranslationJobPlan<B>> {
  const keys = translationBlockKeys(input.blocks)
  const stored = input.restart ? null : await input.store.readTranslation(input.docHash, input.lang)
  const pending: TranslationJobItem<B>[] = []
  input.blocks.forEach((block, i) => {
    const key = keys[i]!
    if (!stored?.blocks.has(blockKeyString(key))) pending.push({ block, key })
  })
  const batches = pending.length > 0 ? input.batch(pending) : []
  const batched = batches.reduce((n, b) => n + b.length, 0)
  if (batches.some((b) => b.length === 0) || batched !== pending.length) {
    throw new TypeError('translation job: the batches must hold every pending block once')
  }

  let providerChange: ProviderChange | null = null
  if (
    stored &&
    stored.blocks.size > 0 &&
    (stored.provider !== input.model.provider || stored.model !== input.model.model)
  ) {
    providerChange = {
      stored: { provider: stored.provider, model: stored.model },
      next: { ...input.model },
    }
  }

  const done = input.blocks.length - pending.length
  return {
    batches,
    estimate: {
      kind: 'translate',
      lang: input.lang,
      calls: batches.length,
      pending: pending.length,
      done,
      total: input.blocks.length,
      model: { ...input.model },
      providerChange,
    },
  }
}

/** the pre-start confirmation data: calls, blocks already translated, provider change */
export async function estimateTranslationJob<B extends TranslationSourceBlock>(
  input: PlanInput<B>,
): Promise<DocumentJobEstimate> {
  return (await planTranslationJob(input)).estimate
}

export interface StartTranslationJobOptions<B extends TranslationSourceBlock>
  extends TranslationJobInput<B>, StartDocumentJobOptions<TranslationJobItem<B>[]> {
  /** translate one batch; one result per block, in order */
  callModel: (
    batch: TranslationJobItem<B>[],
    signal: AbortSignal,
  ) => Promise<TranslationBlockResult[]>
}

const isResult = (r: unknown): r is TranslationBlockResult => {
  if (typeof r !== 'object' || r === null) return false
  const v = r as Record<string, unknown>
  if (v.status === 'translated') return typeof v.text === 'string'
  return v.status === 'failed' && typeof v.reason === 'string'
}

function toInput(key: TranslationBlockKey, r: TranslationBlockResult): TranslationBlockInput {
  if (r.status === 'failed') return { key, status: 'failed', reason: r.reason }
  const input: TranslationBlockInput = { key, status: 'translated', text: r.text }
  if (r.runs !== undefined) input.runs = r.runs
  return input
}

/** start translating; throws DocumentJobBusyError when the document has a job */
export function startTranslationJob<B extends TranslationSourceBlock>(
  o: StartTranslationJobOptions<B>,
): DocumentJobHandle<TranslationJobItem<B>[]> {
  type Batch = TranslationJobItem<B>[]
  return startDocumentJob<Batch, TranslationBlockResult[]>(
    { ...o, kind: 'translate' },
    async (signal) => {
      if (o.restart && !signal.aborted) await o.store.deleteTranslation(o.docHash, o.lang)
      const { batches, estimate } = await planTranslationJob({ ...o, restart: false })
      let meta: Promise<void> | null = null
      return {
        store: o.store,
        units: batches,
        unitSize: (batch) => batch.length,
        doneBefore: estimate.done,
        total: estimate.total,
        callModel: async (batch, callSignal) => {
          const results = await o.callModel(batch, callSignal)
          if (!Array.isArray(results) || results.length !== batch.length) {
            throw new JobUnitFailure('result-mismatch')
          }
          if (!results.every(isResult)) throw new JobUnitFailure('result-mismatch')
          return results
        },
        persist: async (batch, results) => {
          meta ??= o.store.writeTranslationMeta(o.docHash, o.lang, {
            provider: o.model.provider,
            model: o.model.model,
          })
          await meta
          await o.store.writeTranslationBlocks(
            o.docHash,
            o.lang,
            batch.map((item, i) => toInput(item.key, results[i]!)),
          )
        },
      }
    },
  )
}
