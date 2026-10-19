/**
 * The editor's wiring of passage cards: one `PassageCards` per tab over the
 * shell's store channel, (re)read when the open file is ready, and the step a
 * successful PDF save runs after the store migration.
 */
import { useEffect, useMemo, useRef } from 'react'
import { PassageCards } from './passage-controller'
import type { SaveConfirmations } from './save-confirmations'

export function usePassageCards(o: {
  filePath: string
  password: string | undefined
  /** the UI language: an explanation is written in it */
  lang: string
  /** the document is loaded (an encrypted one only after its password) */
  ready: boolean
}): PassageCards {
  const live = useRef(o)
  live.current = o
  const cards = useMemo(
    () =>
      new PassageCards({
        store: window.pdfApi?.store ?? null,
        file: () => {
          const { filePath, password } = live.current
          return filePath
            ? { path: filePath, ...(password !== undefined ? { password } : {}) }
            : null
        },
        uiLang: () => live.current.lang,
      }),
    [],
  )
  // reads the store only: opening a document never sends anything
  useEffect(() => {
    if (o.ready && o.filePath) void cards.load()
  }, [cards, o.ready, o.filePath])
  return cards
}

/**
 * After a successful PDF save and the store migration (reading-assist spec
 * 3.5): confirm what the save wrote under the saved file's hash, then read the
 * cards again (new hash, pages found again by fingerprint).
 */
export async function afterReadingSave(
  confirmations: SaveConfirmations,
  cards: PassageCards,
  written: Iterable<string>,
): Promise<void> {
  await confirmations.afterSave(written, () => cards.freshDocHash())
  await cards.load()
}
