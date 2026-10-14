/**
 * @genoffice/pdf-structure/store — the result store (spec §6). Node-only
 * (node:fs, node:crypto), so it is its own package entry and is not exported
 * from the package root. `keys.ts` is pure and may be imported directly by
 * environment-free code.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export {
  ResultStore,
  STORE_DIR_NAME,
  JOB_RUNNING_WINDOW_MS,
  type AiReadPayload,
  type AiReadPageEntry,
  type JobKind,
  type JobLastError,
  type JobProgress,
  type JobRecordInput,
  type JobState,
  type JobStatus,
  type MigrateInput,
  type MigrateResult,
  type ResultStoreOptions,
  type StoredTranslation,
  type TranslationBlockEntry,
  type TranslationBlockInput,
  type TranslationBlockStatus,
  type TranslationMetaInput,
} from './store'
export { StoreWriteError } from './files'
export {
  blockKeyString,
  normalizeSourceText,
  translationBlockKeys,
  type TranslationBlockKey,
} from './keys'

/** document key: SHA-256 hex of the file bytes */
export function documentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** documentHash of a file, streamed */
export function documentHashOfFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}
