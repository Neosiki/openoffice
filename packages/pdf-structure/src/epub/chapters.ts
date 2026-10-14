/**
 * Chapter split (spec §5): one XHTML file per level-1 heading; level 2 when
 * there is no level-1 heading; one file when there is neither.
 */
import type { HeadingBlock, TreeBlock } from '../tree/types'

export interface Chapter {
  /** the heading that opened the chapter; absent on front matter / single-file books */
  heading?: HeadingBlock
  blocks: TreeBlock[]
}

/**
 * a bilingual tree's translated block right after its original: it belongs
 * with the original (same chapter, same nav entry, same list item)
 */
export const isPairedTranslation = (block: TreeBlock, previous: TreeBlock | undefined): boolean =>
  block.translationOf !== undefined && previous?.id === block.translationOf

/** iterate blocks with the previous non-page-break block */
export function* withPrevious(
  blocks: readonly TreeBlock[],
): Generator<[TreeBlock, TreeBlock | undefined]> {
  let previous: TreeBlock | undefined
  for (const b of blocks) {
    yield [b, previous]
    if (b.kind !== 'pageBreak') previous = b
  }
}

export function splitLevel(blocks: readonly TreeBlock[]): 1 | 2 | undefined {
  let has2 = false
  for (const [b, prev] of withPrevious(blocks)) {
    if (b.kind !== 'heading' || isPairedTranslation(b, prev)) continue
    if (b.level === 1) return 1
    if (b.level === 2) has2 = true
  }
  return has2 ? 2 : undefined
}

export function splitChapters(blocks: readonly TreeBlock[]): Chapter[] {
  const level = splitLevel(blocks)
  const chapters: Chapter[] = []
  let current: Chapter = { blocks: [] }
  for (const [b, prev] of withPrevious(blocks)) {
    if (level && b.kind === 'heading' && b.level === level && !isPairedTranslation(b, prev)) {
      // page markers right before the heading open the new chapter
      const carry: TreeBlock[] = []
      while (current.blocks[current.blocks.length - 1]?.kind === 'pageBreak') {
        carry.unshift(current.blocks.pop()!)
      }
      if (current.heading || current.blocks.length > 0) chapters.push(current)
      current = { heading: b, blocks: [...carry, b] }
    } else {
      current.blocks.push(b)
    }
  }
  if (current.heading || current.blocks.length > 0 || chapters.length === 0) chapters.push(current)
  return chapters
}
