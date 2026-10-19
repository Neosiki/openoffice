/**
 * Passage cards in the PDF editor (reading-assist spec 4.2): the "explain" and
 * "translate" requests from the selection bar (E / T) and the Ask-AI chips,
 * the card beside the passage and its actions.
 *
 * Sending follows the shared rules: a request is one tool-less model call over
 * `ai:stream`, asked through the send gate (`useAiSendGate`) like the AI panel,
 * on the provider `documentJobRoute` picks; a request in front of "not
 * connected" shows the connect prompt and sends nothing. The same passage
 * opens its stored card without sending; only "Regenerate" sends again and
 * overwrites that card. Nothing is sent on open or scroll.
 *
 * "Keep as note" adds a pending /Text note through the editor's note path and
 * registers a save confirmation: the card shows "waiting for save" and the
 * store hears `savedAsNote` only after a PDF save that wrote the note.
 *
 * Imperative handle for the editor and the annotation panel: `request`,
 * `open`, `close`. The cards themselves are the `PassageCards` instance.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { AiSettings } from '@genoffice/ai-provider/browser'
import type { Lang } from '@genoffice/i18n'
import {
  AiConnectPrompt,
  AiFirstConnectionNotice,
  useAiSendGate,
  type AiModelPickerBridge,
} from '@genoffice/ui'
import type { PassageCard } from '../../../../../packages/pdf-structure/src/store/reading'
import { defaultTargetLanguage } from '../../../../../packages/pdf-structure/src/translate/language'
import type { AskAnchorRect } from '../AiAskPopover'
import type { TFunc } from '../i18n/locale'
import type { NoteInput } from '../note-threads'
import { useSubscriptionConnection } from '../ai/useSubscriptionConnection'
import { createModelCall } from '../doc-jobs/model-call'
import { documentJobRoute } from '../doc-jobs/route'
import { passageHeading, passageNoteDrawing } from './passage-cards'
import type { PassageAsk, PassageCards, PassageSource, PreparedPassage } from './passage-controller'
import type { PassageKind } from './passage-prompt'
import { PassageCardView, type PassageCardBody, type PassageNoteState } from './PassageCard'
import type { SaveConfirmations } from './save-confirmations'

const SETTINGS_BRIDGE: AiModelPickerBridge = {
  getSettings: () => window.pdfApi.getAiSettings(),
  setSettings: (settings) => window.pdfApi.setAiSettings(settings),
  onSettingsChanged: (handler) => window.pdfApi.onAiSettingsChanged(handler),
  openModelSettings: () => window.pdfApi.openAiModelSettings().catch(() => {}),
}

/** a passage selected on one page */
export interface PassageSelection {
  /** original page index (0-based) */
  origIdx: number
  /** the passage on that page, PDF user space */
  quads: number[][]
  excerpt: string
  /** where the card opens (viewport coordinates) */
  anchor: AskAnchorRect
}

/** what "Ask more in the AI panel" hands to the AI window's selection chip */
export interface PassageFollowUpRequest {
  origIdx: number
  excerpt: string
  heading: string
  answer: string
}

export interface PassageReadingProps {
  cards: PassageCards
  confirmations: SaveConfirmations
  lang: Lang
  t: TFunc
  /** the document cannot be edited: "Keep as note" is refused */
  readOnly: boolean
  /** the document title sent with a passage ('' when none) */
  title: string
  /** an original page's text as the PDF.js text layer reads it */
  pageText: (origIdx: number) => Promise<string>
  /** add a pending note through the editor's note path; its pending id, or null */
  addNote: (note: NoteInput) => string | null
  /** the pending note still exists (an undone note no longer waits for a save) */
  hasPendingDrawing: (id: string) => boolean
  /** the author of notes a person adds (OS account name; '' → the save's default) */
  author: string
  noteColor: [number, number, number]
  /** a target language as the user reads it, in the UI language */
  languageName: (code: string) => string
  onAskInPanel: (followUp: PassageFollowUpRequest) => void
  onNotice: (message: string) => void
  /**
   * Extension slot: more actions on a ready card, shown between "Ask more in
   * the AI panel" and "Regenerate" (the notes task adds "Add to note").
   */
  cardActions?: (card: PassageCard) => ReactNode
}

export interface PassageReadingHandle {
  /** E / T, or an Ask-AI chip: open the stored card of the passage, or ask through the gate */
  request(kind: PassageKind, selection: PassageSelection): void
  /** open a stored card (dotted mark, annotation panel); never sends */
  open(id: string, anchor?: AskAnchorRect): void
  close(): void
}

/** one send waiting for, or past, the gate */
interface Job {
  seq: number
  run: (signal: AbortSignal) => Promise<PassageCard>
}

type View =
  | {
      kind: 'job'
      job: Job
      phase: 'waiting' | 'working' | 'connect' | 'failed'
      message?: string
      heading: string
      excerpt: string
      anchor: AskAnchorRect
    }
  | { kind: 'card'; id: string; anchor: AskAnchorRect }

/** the card when none was anchored (opened from a panel): the upper middle of the window */
const centerAnchor = (): AskAnchorRect => {
  const x = window.innerWidth / 2
  const y = Math.max(80, window.innerHeight / 4)
  return { left: x, top: y, right: x, bottom: y }
}

export const PassageReading = forwardRef<PassageReadingHandle, PassageReadingProps>(
  function PassageReading(props, ref): ReactElement | null {
    const { cards, confirmations, lang, t, readOnly } = props
    const snap = useSyncExternalStore(cards.subscribe, cards.snapshot)
    useSyncExternalStore(confirmations.subscribe, () => confirmations.pendingIds().join('\u0000'))
    const connection = useSubscriptionConnection()
    const [settings, setSettings] = useState<AiSettings | null>(null)
    const [view, setView] = useState<View | null>(null)
    const viewRef = useRef(view)
    viewRef.current = view
    const propsRef = useRef(props)
    propsRef.current = props
    const statusesRef = useRef(connection.statuses)
    statusesRef.current = connection.statuses
    const jobSeq = useRef(0)
    const aborts = useRef(new Set<AbortController>())
    /** card id → the pending id of the note "Keep as note" added */
    const keptNotes = useRef(new Map<string, string>())

    useEffect(() => {
      let alive = true
      const refresh = () => {
        void window.pdfApi
          ?.getAiSettings()
          .then((next) => {
            if (alive) setSettings(next)
          })
          .catch(() => {})
      }
      refresh()
      const off = window.pdfApi?.onAiSettingsChanged(refresh)
      const running = aborts.current
      return () => {
        alive = false
        off?.()
        // the tab goes away: its card calls stop (the shell ends their streams)
        for (const abort of running) abort.abort()
        running.clear()
      }
    }, [])

    /** one tool-less call on the provider the shared rules pick now */
    const ask: PassageAsk = async (request, signal) => {
      const current = await window.pdfApi.getAiSettings()
      const route = documentJobRoute(current, statusesRef.current)
      if (route.state !== 'ready') throw new Error(propsRef.current.t('rdNeedsConnection'))
      const call = createModelCall({
        settings: () => route.settings,
        lang: () => propsRef.current.lang,
      })
      const text = await call(request, signal)
      return { text, provider: route.provider, model: route.model }
    }

    const start = (job: Job) => {
      const abort = new AbortController()
      aborts.current.add(abort)
      setView((v) => (v?.kind === 'job' && v.job === job ? { ...v, phase: 'working' } : v))
      void job
        .run(abort.signal)
        .then((card) => {
          const v = viewRef.current
          if (v === null || (v.kind === 'job' && v.job === job)) {
            setView({ kind: 'card', id: card.id, anchor: v?.anchor ?? centerAnchor() })
          }
        })
        .catch((err: unknown) => {
          if (abort.signal.aborted) return
          const message = err instanceof Error ? err.message : String(err)
          setView((v) =>
            v?.kind === 'job' && v.job === job ? { ...v, phase: 'failed', message } : v,
          )
        })
        .finally(() => aborts.current.delete(abort))
    }
    const startRef = useRef(start)
    startRef.current = start

    const sendGate = useAiSendGate<Job>({
      settings,
      statuses: connection.statuses,
      store: SETTINGS_BRIDGE,
      start: (job) => startRef.current(job),
      onSettingsSaved: (next) => setSettings(next),
    })

    /** show the job's card and ask the gate; it starts now, later, or not at all */
    const submit = (job: Job, heading: string, excerpt: string, anchor: AskAnchorRect) => {
      setView({ kind: 'job', job, phase: 'waiting', heading, excerpt, anchor })
      if (sendGate.admit(job)) {
        start(job)
        return
      }
      if (sendGate.peek().kind === 'connect') {
        setView((v) => (v?.kind === 'job' && v.job === job ? { ...v, phase: 'connect' } : v))
      }
    }

    const sourceOf = async (
      origIdx: number,
      quads: number[][],
      excerpt: string,
    ): Promise<PassageSource> => {
      const p = propsRef.current
      const pageText = await p.pageText(origIdx).catch(() => '')
      return { origIdx, quads, excerpt, pageText, title: p.title }
    }

    const request = async (kind: PassageKind, sel: PassageSelection) => {
      const p = propsRef.current
      if (!p.cards.available) {
        p.onNotice(p.t('rdUnavailable'))
        return
      }
      const source = await sourceOf(sel.origIdx, sel.quads, sel.excerpt)
      const target =
        kind === 'translate'
          ? defaultTargetLanguage(p.lang, source.pageText || sel.excerpt)
          : undefined
      const prepared = await p.cards.prepare(kind, target, source)
      if (!prepared) {
        p.onNotice(p.t(p.cards.docHash ? 'rdNoPage' : 'rdUnavailable'))
        return
      }
      if ('existing' in prepared) {
        setView({ kind: 'card', id: prepared.existing.id, anchor: sel.anchor })
        return
      }
      const ready: PreparedPassage = prepared
      const job: Job = {
        seq: ++jobSeq.current,
        run: (signal) => propsRef.current.cards.generate(ready, ask, signal),
      }
      submit(
        job,
        passageHeading({ kind, lang: target }, p.t, p.languageName),
        sel.excerpt,
        sel.anchor,
      )
    }

    const regenerate = async (card: PassageCard, anchor: AskAnchorRect) => {
      const p = propsRef.current
      const origIdx = p.cards.pageOf(card) ?? card.page - 1
      const source = await sourceOf(origIdx, card.quads, card.excerpt)
      const job: Job = {
        seq: ++jobSeq.current,
        run: (signal) => propsRef.current.cards.regenerate(card.id, source, ask, signal),
      }
      submit(job, passageHeading(card, p.t, p.languageName), card.excerpt, anchor)
    }

    useImperativeHandle(ref, () => ({
      request(kind, selection) {
        void request(kind, selection)
      },
      open(id, anchor) {
        if (!propsRef.current.cards.get(id)) return
        setView({ kind: 'card', id, anchor: anchor ?? centerAnchor() })
      },
      close() {
        setView(null)
      },
    }))

    const noteStateOf = (card: PassageCard): PassageNoteState => {
      if (card.savedAsNote) return 'saved'
      const noteId = keptNotes.current.get(card.id)
      return noteId && confirmations.isPending(noteId) && props.hasPendingDrawing(noteId)
        ? 'pending'
        : 'none'
    }

    const keepAsNote = (card: PassageCard) => {
      const p = propsRef.current
      if (p.readOnly || noteStateOf(card) !== 'none') return
      const origIdx = p.cards.pageOf(card)
      if (origIdx === null) {
        p.onNotice(p.t('rdNoPage'))
        return
      }
      const noteId = p.addNote(
        passageNoteDrawing({
          card,
          origIdx,
          heading: passageHeading(card, p.t, p.languageName),
          author: p.author,
          color: p.noteColor,
          now: Date.now(),
        }),
      )
      if (!noteId) return
      const earlier = keptNotes.current.get(card.id)
      if (earlier) confirmations.cancel(earlier)
      keptNotes.current.set(card.id, noteId)
      // the store hears of the note only once a save wrote it, under the saved file's hash
      confirmations.register(noteId, (docHash) =>
        propsRef.current.cards.confirmNote(card.id, docHash),
      )
    }

    const remove = async (card: PassageCard) => {
      const p = propsRef.current
      const noteId = keptNotes.current.get(card.id)
      if (noteId) confirmations.cancel(noteId)
      keptNotes.current.delete(card.id)
      setView(null)
      await p.cards.remove(card.id)
    }

    const copy = (card: PassageCard) => {
      const p = propsRef.current
      void navigator.clipboard
        ?.writeText(card.text)
        .then(() => p.onNotice(p.t('rdCopied')))
        .catch(() => {})
    }

    // a card deleted elsewhere, or the document changed: close what no longer exists
    const openCard = view?.kind === 'card' ? snap.cards.find((c) => c.id === view.id) : undefined
    useEffect(() => {
      if (view?.kind === 'card' && !openCard) setView(null)
    }, [view, openCard])

    const heldNotice =
      sendGate.noticeDue && view?.kind === 'job' && view.phase === 'waiting' ? (
        <AiFirstConnectionNotice
          lang={lang}
          codexKeepsHistory
          sendsWholeDocument
          onAcknowledge={sendGate.acknowledgeNotice}
        />
      ) : null

    if (!view || (view.kind === 'card' && !openCard)) return heldNotice

    let body: PassageCardBody
    let heading: string
    let excerpt: string
    if (view.kind === 'card') {
      const card = openCard!
      body = { kind: 'card', card, note: noteStateOf(card) }
      heading = passageHeading(card, t, props.languageName)
      excerpt = card.excerpt
    } else {
      heading = view.heading
      excerpt = view.excerpt
      body =
        view.phase === 'failed'
          ? { kind: 'failed', message: view.message ?? '' }
          : view.phase === 'connect' && sendGate.connectChoice
            ? {
                kind: 'connect',
                prompt: (
                  <AiConnectPrompt
                    choice={sendGate.connectChoice}
                    statuses={connection.statuses}
                    lang={lang}
                    disabled={connection.busy}
                    attention={sendGate.connectAttention}
                    onOpenSettings={() => void window.pdfApi.openAiModelSettings().catch(() => {})}
                    onInstall={connection.install}
                    onLogin={connection.login}
                    onRecheck={connection.recheck}
                    onAcceptMetered={connection.acceptMetered}
                    onOpenInstallHelp={connection.openInstallHelp}
                  />
                ),
              }
            : { kind: 'busy', phase: view.phase === 'working' ? 'working' : 'waiting' }
    }

    return (
      <>
        <PassageCardView
          t={t}
          heading={heading}
          excerpt={excerpt}
          anchor={view.anchor}
          body={body}
          readOnly={readOnly}
          extraActions={openCard && props.cardActions ? props.cardActions(openCard) : undefined}
          onCopy={() => openCard && copy(openCard)}
          onKeepAsNote={() => openCard && keepAsNote(openCard)}
          onAskInPanel={() => {
            if (!openCard) return
            const p = propsRef.current
            p.onAskInPanel({
              origIdx: p.cards.pageOf(openCard) ?? openCard.page - 1,
              excerpt: openCard.excerpt,
              heading: passageHeading(openCard, p.t, p.languageName),
              answer: openCard.text,
            })
          }}
          onRegenerate={() => {
            if (openCard) {
              void regenerate(openCard, view.anchor)
              return
            }
            // a failed send: try the same request again, through the gate
            if (view.kind === 'job') submit(view.job, view.heading, view.excerpt, view.anchor)
          }}
          onDelete={() => openCard && void remove(openCard)}
          onClose={() => setView(null)}
        />
        {heldNotice}
      </>
    )
  },
)
