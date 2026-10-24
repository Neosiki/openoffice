/**
 * Carrying stored translations over an in-app save (spec §8). The save
 * changes the file bytes and so the document key, but not the chapter paths
 * the fingerprints are made from: the store's `migrateDocument` copies the
 * blocks of every fingerprint the saved book still has, and a block whose
 * text did not change keeps its key in the saved book.
 */
import type { MigrateInput, TranslationBlockKey } from '@genoffice/pdf-structure/store'
import type { EpubBook } from '../types'
import { EPUB_METADATA_FINGERPRINT, epubChapterFingerprint } from './keys'
import { epubTranslationUnits } from './units'

export interface EpubMigrationInfo extends MigrateInput {
  /** the keys of every unit of the saved book (all chapters, title and contents) */
  blockKeys: TranslationBlockKey[]
}

/**
 * The input of `ResultStore.migrateDocument` for a saved book: the title and
 * contents fingerprint and every spine chapter's, plus the block keys the
 * saved book has.
 */
export async function epubMigrationInfo(
  saved: EpubBook,
  hashes: { oldDocHash: string; newDocHash: string },
): Promise<EpubMigrationInfo> {
  const fingerprints = [EPUB_METADATA_FINGERPRINT]
  for (const item of saved.spine.items) {
    const fp = epubChapterFingerprint(item.path)
    if (!fingerprints.includes(fp)) fingerprints.push(fp)
  }
  const { units } = await epubTranslationUnits(saved)
  return {
    oldDocHash: hashes.oldDocHash,
    newDocHash: hashes.newDocHash,
    pageFingerprints: fingerprints,
    blockKeys: units.map((u) => u.key),
  }
}
