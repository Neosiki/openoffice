import { describe, expect, it } from 'vitest'
import type { SlideComment } from '../src/shared/ipc'
import {
  commentNavigationTarget,
  commentsRefreshPlan,
  countComments,
  groupCommentsBySlide,
} from '../src/renderer/comments-view'

const comment = (authorId: number, idx: number, text = `c${authorId}-${idx}`): SlideComment => ({
  authorId,
  author: `Author ${authorId}`,
  initials: `A${authorId}`,
  dt: '2026-01-01T00:00:00.000Z',
  idx,
  text,
})

describe('groupCommentsBySlide', () => {
  it('keeps deck order and skips pages without comments', () => {
    const all = [[], [comment(1, 1)], [], [comment(1, 2), comment(2, 1)], []]
    expect(groupCommentsBySlide(all)).toEqual([
      { slideIndex: 1, comments: [comment(1, 1)] },
      { slideIndex: 3, comments: [comment(1, 2), comment(2, 1)] },
    ])
  })

  it('includes hidden slides, whose comments arrive like any other page’s', () => {
    const hidden = [comment(4, 1, 'hidden page note')]
    expect(groupCommentsBySlide([[], [], hidden])).toEqual([{ slideIndex: 2, comments: hidden }])
  })

  it('keeps comment identity (authorId, idx) untouched', () => {
    const c = comment(7, 3)
    expect(groupCommentsBySlide([[c]])[0]!.comments[0]).toBe(c)
  })

  it('returns no groups for an empty deck or a deck without comments', () => {
    expect(groupCommentsBySlide([])).toEqual([])
    expect(groupCommentsBySlide([[], []])).toEqual([])
  })
})

describe('countComments', () => {
  it('counts every page including empty and hidden ones', () => {
    expect(countComments([])).toBe(0)
    expect(countComments([[], [comment(1, 1)], [comment(1, 2), comment(1, 3)]])).toBe(3)
  })
})

describe('commentNavigationTarget', () => {
  it('accepts every page that still exists', () => {
    expect(commentNavigationTarget(0, 3)).toBe(0)
    expect(commentNavigationTarget(2, 3)).toBe(2)
  })

  it('ignores stale targets instead of jumping to an unrelated page', () => {
    expect(commentNavigationTarget(3, 3)).toBeNull()
    expect(commentNavigationTarget(-1, 3)).toBeNull()
    expect(commentNavigationTarget(0, 0)).toBeNull()
  })

  it('rejects malformed indexes', () => {
    expect(commentNavigationTarget(1.5, 3)).toBeNull()
    expect(commentNavigationTarget(Number.NaN, 3)).toBeNull()
  })
})

describe('commentsRefreshPlan', () => {
  it('re-reads the current page list and the all-pages list together', () => {
    for (const reason of ['open', 'page', 'annotations', 'mutation', 'deck-changed'] as const) {
      const plan = commentsRefreshPlan(reason)
      expect(plan.currentPage, reason).toBe(true)
      expect(plan.allPages, reason).toBe(true)
    }
  })

  it('lets undo/redo refresh notes too', () => {
    expect(commentsRefreshPlan('annotations').notes).toBe(true)
    expect(commentsRefreshPlan('open').notes).toBe(true)
  })

  it('leaves notes drafts alone for comment mutations and sibling deck changes', () => {
    expect(commentsRefreshPlan('mutation').notes).toBe(false)
    expect(commentsRefreshPlan('deck-changed').notes).toBe(false)
  })
})
