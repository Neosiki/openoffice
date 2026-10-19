/**
 * Pure view helpers for the comments pane's page/all-pages modes.
 *
 * The pane itself only displays what the main process reports; grouping the
 * per-slide lists, resolving a click's target page and deciding which lists a
 * refresh signal invalidates are pure (and therefore tested without JSDOM).
 * Hidden slides need no special case here: their comments arrive in the same
 * per-slide array, and the deck order is the array order.
 */
import type { SlideComment } from '../shared/ipc'

/** Which slice of the deck the comments pane shows. */
export type CommentsMode = 'page' | 'all'

/** One page's comments in the all-pages list. */
export interface CommentSlideGroup {
  slideIndex: number
  comments: SlideComment[]
}

/**
 * Deck-order groups that actually carry comments. `all` is indexed like the
 * deck (one array per slide, empty included), so the page number comes from
 * the outer index even when earlier pages have no comments.
 */
export function groupCommentsBySlide(all: SlideComment[][]): CommentSlideGroup[] {
  const groups: CommentSlideGroup[] = []
  all.forEach((comments, slideIndex) => {
    if (comments.length > 0) groups.push({ slideIndex, comments })
  })
  return groups
}

/** Total comments in the deck (drives empty states and count labels). */
export function countComments(all: SlideComment[][]): number {
  let total = 0
  for (const comments of all) total += comments.length
  return total
}

/**
 * Page the deck should move to when a group header or card is clicked.
 * Returns null for a stale target (the page was removed or the index is not a
 * real page), so the caller keeps the current page instead of jumping
 * somewhere unrelated.
 */
export function commentNavigationTarget(slideIndex: number, slideCount: number): number | null {
  if (!Number.isInteger(slideIndex)) return null
  if (slideIndex < 0 || slideIndex >= slideCount) return null
  return slideIndex
}

/**
 * Why the comment lists are being re-read.
 *  - open: a deck was opened
 *  - page: the current page changed
 *  - annotations: undo/redo (notes and comments are outside RenderSlide)
 *  - mutation: a comment was added or deleted
 *  - deck-changed: a sibling window / app MCP changed the shared deck
 */
export type CommentsRefreshReason = 'open' | 'page' | 'annotations' | 'mutation' | 'deck-changed'

/** What a refresh signal invalidates. */
export interface CommentsRefreshPlan {
  /** Re-read the current page's list (it also drives the ribbon badge) */
  currentPage: boolean
  /** Re-read every page's list (the all-pages view) */
  allPages: boolean
  /**
   * The signal also invalidates speaker notes. Undo/redo and deck opens do;
   * comment mutations and a sibling window's deck change must leave a notes
   * draft alone, so App must not bump its annotations nonce for those.
   */
  notes: boolean
}

/**
 * Every refresh reason re-reads the current page and the all-pages list
 * together; only the notes side differs. Keeping this in one place stops a
 * new signal from silently refreshing one list but not the ribbon badge.
 */
export function commentsRefreshPlan(reason: CommentsRefreshReason): CommentsRefreshPlan {
  return {
    currentPage: true,
    allPages: true,
    notes: reason === 'open' || reason === 'page' || reason === 'annotations',
  }
}
