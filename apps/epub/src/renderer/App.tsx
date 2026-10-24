/**
 * The EPUB editor: reading (spec §3 refusals and notices, §4 reading).
 *
 * The book stays in the main process. This screen opens it, reads one
 * chapter at a time over IPC and draws it in a sandboxed frame
 * (`ChapterFrame`) as a cleaned copy whose blocks carry their engine ids
 * (`reader/chapter-html.ts`). Around it: the ribbon, the table of contents or
 * the in-book search on the left, and the status line.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EpubTocEntry } from '@genoffice/epub-engine'
import type { Params } from '@genoffice/i18n'
import { epubAssetUrl } from '../shared/asset-url'
import { EPUB_VIEW_PREFS_DEFAULT } from '../shared/ipc'
import type {
  EpubBookSummary,
  EpubChapterResult,
  EpubMenuCommand,
  EpubOpenFileResult,
  EpubReadOnlyReason,
  EpubViewPrefs,
  SaveMode,
} from '../shared/ipc'
import { openableLink } from '../shared/links'
import { ChapterFrame, type FrameWheel } from './components/ChapterFrame'
import { Ribbon } from './components/Ribbon'
import { IconBlockedBook, IconNext, IconPrev } from './components/icons'
import { SearchPane, TocPane, type SearchView } from './components/SidePanes'
import { useI18n, type StringKey } from './i18n/locale'
import { buildTextIndex, rangeOf, searchBook } from './reader/book-search'
import { buildChapterHtml } from './reader/chapter-html'
import {
  applyViewCss,
  blockElement,
  fragmentElement,
  scrollToElement,
  scrollToEnd,
  scrollToStart,
  showHit,
  topBlockId,
  type ChapterTarget,
} from './reader/frame-dom'
import { routeLink } from './reader/links'
import {
  OVERSCROLL_IDLE,
  currentTocEntry,
  firstReadingIndex,
  nextReadingIndex,
  overscroll,
} from './reader/navigation'
import { stepFontScale, viewPrefsCss, type FrameColors } from './reader/view-prefs'

type Phase =
  | { kind: 'loading' }
  | { kind: 'no-book' }
  | { kind: 'refused'; reason: Extract<EpubOpenFileResult, { status: 'refused' }>['reason'] }
  | {
      kind: 'open'
      book: EpubBookSummary
      assetBase: string
      readOnly: EpubReadOnlyReason | null
    }

type OkChapter = Extract<EpubChapterResult, { ok: true }>

interface ShownChapter {
  spineIndex: number
  chapter: OkChapter
  html: string
  /** remounts the frame for every load */
  key: number
}

interface Notice {
  key: StringKey
  params?: Params
}

/** How long the reader rests before the reading position is remembered. */
const POSITION_DELAY_MS = 700
/** How long a passing notice stays in the status line. */
const NOTICE_MS = 6000

const REFUSAL_TEXT: Record<Extract<Phase, { kind: 'refused' }>['reason'], StringKey> = {
  damaged: 'refusedDamaged',
  'too-large': 'refusedDamaged',
  'not-epub': 'refusedNotEpub',
  drm: 'refusedDrm',
  unreadable: 'refusedUnreadable',
}

const READ_ONLY_TEXT: Record<EpubReadOnlyReason, StringKey> = {
  'fixed-layout-book': 'readOnlyFixedBook',
  'fixed-layout-chapter': 'readOnlyFixedChapter',
  'broken-chapter': 'readOnlyBroken',
}

const SEARCH_IDLE: SearchView = {
  running: false,
  done: 0,
  total: 0,
  hits: [],
  truncated: false,
  unreadable: 0,
  finished: false,
}

/** The frame's colours: the page's `--epub-*` properties and search tokens (styles.css), with system colours as a fallback. */
function frameColors(): FrameColors {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    paper: read('--epub-paper', 'Canvas'),
    ink: read('--epub-ink', 'CanvasText'),
    nightPaper: read('--epub-night-paper', 'Canvas'),
    nightInk: read('--epub-night-ink', 'CanvasText'),
    nightLink: read('--epub-night-link', 'LinkText'),
    hitBg: read('--search-hit-active-bg', 'Mark'),
    hitInk: read('--search-hit-active-ink', 'MarkText'),
  }
}

/** The reading text of a chapter as the frame will show it (the search's view of a chapter). */
function chapterReadingText(chapter: OkChapter, assetBase: string): string {
  const html = buildChapterHtml({
    source: chapter.source,
    broken: chapter.broken,
    blocks: chapter.broken ? [] : chapter.blocks,
    baseUrl: epubAssetUrl(assetBase, chapter.path),
  })
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return buildTextIndex(doc.body).text
}

export default function App(): React.JSX.Element {
  const { t } = useI18n()
  const api = window.epubApi
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [prefs, setPrefs] = useState<EpubViewPrefs>(EPUB_VIEW_PREFS_DEFAULT)
  const [shown, setShown] = useState<ShownChapter | null>(null)
  const [chapterFailed, setChapterFailed] = useState<number | null>(null)
  const [side, setSide] = useState<'toc' | 'search' | null>('toc')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [closeMenus, setCloseMenus] = useState(0)
  const [search, setSearch] = useState<SearchView>(SEARCH_IDLE)
  const [activeHit, setActiveHit] = useState(-1)
  const [searchFocus, setSearchFocus] = useState(0)

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const shownRef = useRef(shown)
  shownRef.current = shown
  const frameDocRef = useRef<Document | null>(null)
  const pendingTargetRef = useRef<ChapterTarget>({ kind: 'start' })
  const loadTokenRef = useRef(0)
  const positionTimerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const overscrollRef = useRef(OVERSCROLL_IDLE)
  const searchTokenRef = useRef(0)
  const searchTextCache = useRef(new Map<number, { path: string; version: number; text: string }>())

  const book = phase.kind === 'open' ? phase.book : null

  const flash = useCallback((next: Notice | null) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    setNotice(next)
    noticeTimerRef.current = next
      ? window.setTimeout(() => {
          noticeTimerRef.current = null
          setNotice(null)
        }, NOTICE_MS)
      : null
  }, [])

  // ---- reading position ----

  const rememberPosition = useCallback(() => {
    const doc = frameDocRef.current
    const current = shownRef.current
    if (!doc || !current) return
    api.setReadPosition({ spineIndex: current.spineIndex, blockId: topBlockId(doc) })
  }, [api])

  const schedulePosition = useCallback(() => {
    if (positionTimerRef.current !== null) window.clearTimeout(positionTimerRef.current)
    positionTimerRef.current = window.setTimeout(() => {
      positionTimerRef.current = null
      rememberPosition()
    }, POSITION_DELAY_MS)
  }, [rememberPosition])

  // ---- moving through the book ----

  const applyTarget = useCallback((doc: Document, target: ChapterTarget) => {
    switch (target.kind) {
      case 'start':
        scrollToStart(doc)
        break
      case 'end':
        scrollToEnd(doc)
        break
      case 'block': {
        const el = blockElement(doc, target.id)
        if (el) scrollToElement(el)
        else scrollToStart(doc)
        break
      }
      case 'fragment': {
        const el = fragmentElement(doc, target.id)
        if (el) scrollToElement(el)
        else scrollToStart(doc)
        break
      }
      case 'hit': {
        const range = rangeOf(doc, buildTextIndex(doc.body), target.start, target.length)
        if (range) showHit(doc, range)
        break
      }
    }
  }, [])

  /** Shows chapter `spineIndex` and puts the reader at `target`. */
  const goTo = useCallback(
    async (spineIndex: number, target: ChapterTarget) => {
      const open = phaseRef.current
      if (open.kind !== 'open') return
      overscrollRef.current = OVERSCROLL_IDLE
      const current = shownRef.current
      const doc = frameDocRef.current
      if (current && current.spineIndex === spineIndex && doc) {
        loadTokenRef.current++
        applyTarget(doc, target)
        schedulePosition()
        return
      }
      const token = ++loadTokenRef.current
      const chapter = await api.readChapter(spineIndex)
      if (token !== loadTokenRef.current) return
      if (!chapter.ok) {
        frameDocRef.current = null
        setShown(null)
        setChapterFailed(spineIndex)
        return
      }
      const html = buildChapterHtml({
        source: chapter.source,
        broken: chapter.broken,
        blocks: chapter.broken ? [] : chapter.blocks,
        baseUrl: epubAssetUrl(open.assetBase, chapter.path),
        viewCss: viewPrefsCss(prefsRef.current, frameColors()),
      })
      pendingTargetRef.current = target
      frameDocRef.current = null
      setChapterFailed(null)
      setShown({ spineIndex, chapter, html, key: token })
    },
    [api, applyTarget, schedulePosition],
  )

  const turn = useCallback(
    (dir: 1 | -1) => {
      const open = phaseRef.current
      const current = shownRef.current
      if (open.kind !== 'open' || !current) return
      const next = nextReadingIndex(open.book.spine, current.spineIndex, dir)
      if (next !== null) void goTo(next, { kind: dir > 0 ? 'start' : 'end' })
    },
    [goTo],
  )

  // ---- opening ----

  useEffect(() => {
    let alive = true
    void (async () => {
      const path = await api.consumePending().catch(() => null)
      if (!alive) return
      if (!path) {
        setPhase({ kind: 'no-book' })
        return
      }
      const opened = await api
        .openFile(path)
        .catch((): EpubOpenFileResult => ({ status: 'refused', reason: 'unreadable' }))
      if (!alive) return
      if (opened.status === 'refused') {
        setPhase({ kind: 'refused', reason: opened.reason })
        return
      }
      const state = await api.getReadingState().catch(() => null)
      if (!alive) return
      if (state) setPrefs(state.viewPrefs)
      const next: Phase = {
        kind: 'open',
        book: opened.book,
        assetBase: opened.assetBase,
        readOnly: opened.readOnly,
      }
      phaseRef.current = next
      setPhase(next)
      const spine = opened.book.spine
      const remembered = state?.position
      if (remembered && remembered.spineIndex < spine.length) {
        void goTo(
          remembered.spineIndex,
          remembered.blockId ? { kind: 'block', id: remembered.blockId } : { kind: 'start' },
        )
      } else if (spine.length > 0) {
        void goTo(firstReadingIndex(spine), { kind: 'start' })
      }
    })()
    return () => {
      alive = false
    }
  }, [api, goTo])

  // ---- view settings ----

  const updatePrefs = useCallback(
    (patch: Partial<EpubViewPrefs>) => {
      setPrefs((prev) => ({ ...prev, ...patch }))
      void api
        .setViewPrefs(patch)
        .then(setPrefs)
        .catch(() => {})
    },
    [api],
  )

  useEffect(() => api.onViewPrefsChanged(setPrefs), [api])

  useEffect(() => {
    const doc = frameDocRef.current
    if (doc) applyViewCss(doc, viewPrefsCss(prefs, frameColors()))
  }, [prefs])

  // ---- search ----

  const openSearch = useCallback(() => {
    if (phaseRef.current.kind !== 'open') return
    setSide('search')
    setSearchFocus((n) => n + 1)
  }, [])

  const runSearch = useCallback(
    async (query: string) => {
      const open = phaseRef.current
      if (open.kind !== 'open') return
      const token = ++searchTokenRef.current
      const total = open.book.spine.length
      setActiveHit(-1)
      setSearch({ ...SEARCH_IDLE, running: true, total })
      const result = await searchBook({
        query,
        chapterCount: total,
        isCancelled: () => token !== searchTokenRef.current,
        onProgress: (done) => {
          if (token === searchTokenRef.current) {
            setSearch((prev) => ({ ...prev, done }))
          }
        },
        chapterText: async (i) => {
          const chapter = await api.readChapter(i).catch(() => null)
          if (!chapter || !chapter.ok) return null
          const cached = searchTextCache.current.get(i)
          if (cached && cached.path === chapter.path && cached.version === chapter.version) {
            return cached.text
          }
          const text = chapterReadingText(chapter, open.assetBase)
          searchTextCache.current.set(i, { path: chapter.path, version: chapter.version, text })
          return text
        },
      })
      if (token !== searchTokenRef.current || result.cancelled) return
      setSearch({
        running: false,
        done: total,
        total,
        hits: result.hits,
        truncated: result.truncated,
        unreadable: result.unreadable.length,
        finished: query.trim() !== '',
      })
    },
    [api],
  )

  const pickHit = useCallback(
    (index: number) => {
      const hit = search.hits[index]
      if (!hit) return
      setActiveHit(index)
      void goTo(hit.spineIndex, { kind: 'hit', start: hit.start, length: hit.length })
    },
    [search.hits, goTo],
  )

  // ---- saving (the editing screen sends its pending edits before these) ----

  const save = useCallback(
    async (mode: SaveMode): Promise<boolean> => {
      if (phaseRef.current.kind !== 'open') return false
      flash({ key: 'saving' })
      try {
        const result = await api.save({ mode })
        if (!result.ok) {
          flash({ key: result.error === 'external-modified' ? 'saveConflict' : 'saveFailed' })
          return false
        }
        if ('canceled' in result) {
          flash(null)
          return false
        }
        flash({ key: result.written ? 'saved' : 'savedUnchanged' })
        return true
      } catch {
        flash({ key: 'saveFailed' })
        return false
      }
    },
    [api, flash],
  )

  useEffect(
    () =>
      api.onSaveRequest((mode) => {
        if (phaseRef.current.kind !== 'open') {
          api.sendSaveRequestAck(false)
          return
        }
        void save(mode)
      }),
    [api, save],
  )

  useEffect(
    () =>
      api.onCloseSaveRequest(() => {
        void save('save').then((ok) => api.sendCloseSaveResult(ok))
      }),
    [api, save],
  )

  // ---- commands from the menu, keys, the shell ----

  const onMenuCommand = useCallback(
    (command: EpubMenuCommand) => {
      switch (command) {
        case 'find':
          openSearch()
          break
        case 'zoom-in':
          updatePrefs({ fontScale: stepFontScale(prefsRef.current.fontScale, 1) })
          break
        case 'zoom-out':
          updatePrefs({ fontScale: stepFontScale(prefsRef.current.fontScale, -1) })
          break
        case 'zoom-reset':
          updatePrefs({ fontScale: 1 })
          break
        // undo, redo, replace and translate-book belong to the editing and translating screens
        default:
          break
      }
    },
    [openSearch, updatePrefs],
  )
  const menuCommandRef = useRef(onMenuCommand)
  menuCommandRef.current = onMenuCommand
  useEffect(() => api.onMenuCommand((command) => menuCommandRef.current(command)), [api])

  useEffect(() => api.onChromePressed(() => setCloseMenus((n) => n + 1)), [api])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSearch])

  useEffect(
    () => () => {
      if (positionTimerRef.current !== null) {
        window.clearTimeout(positionTimerRef.current)
        rememberPosition()
      }
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    },
    [rememberPosition],
  )

  // ---- the frame ----

  const onFrameReady = useCallback(
    (doc: Document) => {
      frameDocRef.current = doc
      applyViewCss(doc, viewPrefsCss(prefsRef.current, frameColors()))
      applyTarget(doc, pendingTargetRef.current)
      schedulePosition()
    },
    [applyTarget, schedulePosition],
  )

  const onFrameLink = useCallback(
    (href: string | null) => {
      const open = phaseRef.current
      const current = shownRef.current
      if (open.kind !== 'open' || !current) return
      const route = routeLink(
        href,
        epubAssetUrl(open.assetBase, current.chapter.path),
        open.assetBase,
        open.book.spine.map((item) => item.path),
      )
      if (route.kind === 'chapter') {
        void goTo(
          route.spineIndex,
          route.fragment ? { kind: 'fragment', id: route.fragment } : { kind: 'start' },
        )
      } else if (route.kind === 'outside') {
        if (!openableLink(route.url)) {
          flash({ key: 'linkNotOpened', params: { url: route.url } })
          return
        }
        void api
          .openLink(route.url)
          .then((opened) => {
            if (!opened) flash({ key: 'linkNotOpened', params: { url: route.url } })
          })
          .catch(() => {})
      }
    },
    [api, goTo, flash],
  )

  const onFrameWheel = useCallback(
    (wheel: FrameWheel) => {
      const step = overscroll(overscrollRef.current, { ...wheel, time: performance.now() })
      overscrollRef.current = step.state
      if (step.turn) turn(step.turn)
    },
    [turn],
  )

  const onFrameKey = useCallback(
    (e: KeyboardEvent, edges: { atStart: boolean; atEnd: boolean }) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openSearch()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const forward = e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)
      const backward = e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)
      if (forward && edges.atEnd) {
        e.preventDefault()
        turn(1)
      } else if (backward && edges.atStart) {
        e.preventDefault()
        turn(-1)
      }
    },
    [openSearch, turn],
  )

  const onFramePress = useCallback(() => setCloseMenus((n) => n + 1), [])

  // ---- what is drawn ----

  const tocEntries = book?.toc.entries ?? []
  const tocCurrent = shown ? currentTocEntry(tocEntries, shown.spineIndex) : -1
  const chapterNames = useMemo(() => {
    const names = new Map<number, string>()
    for (const entry of book?.toc.entries ?? []) {
      if (entry.spineIndex !== null && !names.has(entry.spineIndex) && entry.title.trim()) {
        names.set(entry.spineIndex, entry.title.trim())
      }
    }
    return names
  }, [book])

  const onTocPick = useCallback(
    (entry: EpubTocEntry) => {
      if (entry.spineIndex === null) return
      void goTo(
        entry.spineIndex,
        entry.fragment ? { kind: 'fragment', id: entry.fragment } : { kind: 'start' },
      )
    },
    [goTo],
  )

  if (phase.kind === 'loading') {
    return (
      <div className="epub-app">
        <div className="center-note">{t('loading')}</div>
      </div>
    )
  }

  if (phase.kind === 'no-book') {
    return (
      <div className="epub-app">
        <div className="center-note">{t('noBook')}</div>
      </div>
    )
  }

  if (phase.kind === 'refused') {
    return (
      <div className="epub-app">
        <div className="epub-refusal" role="alert" data-reason={phase.reason}>
          <IconBlockedBook />
          <div className="epub-refusal-title">{t('refusedTitle')}</div>
          <div className="epub-refusal-text">{t(REFUSAL_TEXT[phase.reason])}</div>
        </div>
      </div>
    )
  }

  const spine = phase.book.spine
  const readOnly: EpubReadOnlyReason | null = phase.readOnly ?? shown?.chapter.readOnly ?? null
  const prevIndex = shown ? nextReadingIndex(spine, shown.spineIndex, -1) : null
  const nextIndex = shown ? nextReadingIndex(spine, shown.spineIndex, 1) : null

  return (
    <div className="epub-app">
      <Ribbon
        hasBook
        prefs={prefs}
        searchOpen={side === 'search'}
        tocOpen={side === 'toc'}
        closeMenusSignal={closeMenus}
        onSave={() => void save('save')}
        onSaveAs={() => void save('saveAs')}
        onFind={() => (side === 'search' ? setSide(null) : openSearch())}
        onFontScale={(fontScale) => updatePrefs({ fontScale })}
        onFontStep={(dir) => updatePrefs({ fontScale: stepFontScale(prefs.fontScale, dir) })}
        onLineHeight={(lineHeight) => updatePrefs({ lineHeight })}
        onToggleDark={() => updatePrefs({ dark: !prefs.dark })}
        onToggleToc={() => setSide((s) => (s === 'toc' ? null : 'toc'))}
      />
      <div className="epub-main">
        {side === 'toc' && (
          <TocPane
            entries={tocEntries}
            current={tocCurrent}
            onPick={onTocPick}
            onClose={() => setSide(null)}
          />
        )}
        {side === 'search' && (
          <SearchPane
            view={search}
            active={activeHit}
            focusSignal={searchFocus}
            chapterName={(i) => chapterNames.get(i) ?? t('chapterLabel', { n: i + 1 })}
            onSearch={(query) => void runSearch(query)}
            onPick={pickHit}
            onClose={() => {
              searchTokenRef.current++
              setSide(null)
            }}
          />
        )}
        <section className="epub-reader">
          {readOnly && shown && (
            <div className="epub-chapter-notice" role="note" data-reason={readOnly}>
              {t(READ_ONLY_TEXT[readOnly])}
            </div>
          )}
          <div className="epub-frame-wrap">
            {shown ? (
              <ChapterFrame
                key={shown.key}
                html={shown.html}
                title={chapterNames.get(shown.spineIndex) ?? t('chapterFrame')}
                onReady={onFrameReady}
                onLink={onFrameLink}
                onWheel={onFrameWheel}
                onScroll={schedulePosition}
                onKeyDown={onFrameKey}
                onPress={onFramePress}
              />
            ) : (
              <div className="center-note">
                {chapterFailed !== null ? t('chapterFailed') : t('loading')}
              </div>
            )}
          </div>
          <div className="epub-turn-bar">
            <button
              type="button"
              className="epub-turn"
              data-action="prev-chapter"
              disabled={prevIndex === null}
              onClick={() => turn(-1)}
            >
              <IconPrev />
              {t('prevChapter')}
            </button>
            <button
              type="button"
              className="epub-turn"
              data-action="next-chapter"
              disabled={nextIndex === null}
              onClick={() => turn(1)}
            >
              {t('nextChapter')}
              <IconNext />
            </button>
          </div>
        </section>
      </div>
      <footer className="epub-status" aria-live="polite">
        <span className="epub-status-chapter">
          {shown ? t('statusChapter', { n: shown.spineIndex + 1, total: spine.length }) : ''}
        </span>
        {readOnly && (
          <span className="epub-status-readonly" data-reason={readOnly}>
            {t(READ_ONLY_TEXT[readOnly])}
          </span>
        )}
        <span className="epub-status-spacer" />
        {notice && <span className="epub-status-notice">{t(notice.key, notice.params)}</span>}
      </footer>
    </div>
  )
}
