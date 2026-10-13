import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createEditor } from '@rhwp/editor'
import type { RhwpEditor } from '@rhwp/editor'
import type { Params } from '@genoffice/i18n'
import {
  AiMark,
  aiPanelInitiallyOpen,
  aiSubscriptionText,
  rememberAiPanelOpen,
} from '@genoffice/ui'
import { AiPanel } from './ai/AiPanel'
import { createAgentBridge } from './ai/agent-bridge'
import { useI18n, type StringKey } from './i18n/locale'
import { runSave, type SaveEditorPort } from './save-flow'
import { PASSWORD_FLAG } from '../../scripts/rhwp-patches.mjs'
import { STUDIO_SETTINGS_KEY, seededStudioSettings, studioUrl } from './studio-settings'
import type { SaveMode, UiTheme } from '../shared/ipc'

/**
 * booting: the editor itself is starting. loading: the editor is up and working
 * on the document; it stays visible, because this is where it may ask for a
 * document password. empty: editor up, no file queued for this view.
 */
type Phase = 'booting' | 'loading' | 'ready' | 'empty' | 'failed'

interface Notice {
  tone: 'info' | 'error'
  key: StringKey
  params?: Params
  /** untranslated cause from the engine or the file system, shown under the message */
  detail?: string
}

/** How often the editor is asked whether the document has unsaved changes. */
const DIRTY_POLL_MS = 400
/** How often a document that has not arrived yet is looked for. */
const ARRIVAL_POLL_MS = 1000
/** How long a confirmation stays up; errors stay until dismissed. */
const INFO_NOTICE_MS = 8000
/** Where the open / collapsed state of the AI panel is remembered. */
const AI_OPEN_KEY = 'hwpapp.showAi'

const fileNameOf = (path: string) => path.split(/[\\/]/).pop() ?? path
const detailOf = (error: unknown) => (error instanceof Error ? error.message : String(error))
/**
 * The bridge gives up on a load after a minute, but the editor may still be
 * waiting on the user (the password prompt has no deadline). That is not a
 * failed open: the document can still arrive.
 */
const isBridgeTimeout = (error: unknown) =>
  error instanceof Error && error.message.startsWith('Request timeout')

function savePortOf(editor: RhwpEditor): SaveEditorPort {
  return {
    isPasswordProtected: async () => {
      const flag = (await editor.commands.context())[PASSWORD_FLAG]
      // a build without the flag cannot tell, and must not write as if it could
      if (typeof flag !== 'boolean')
        throw new Error('the editor did not report password protection')
      return flag
    },
    exportHwp: () => editor.exportHwp(),
    exportHwpx: () => editor.exportHwpx(),
    exportHwpVerify: () => editor.exportHwpVerify(),
    notifySaved: (fileName) => editor.notifySaved(fileName),
  }
}

export default function App() {
  const { lang, t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<RhwpEditor | null>(null)
  const savingRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('booting')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [aiOpen, setAiOpen] = useState(() => aiPanelInitiallyOpen(AI_OPEN_KEY))
  /** the AI panel's way into the document: the app's plugin inside the editor */
  const agentBridge = useMemo(() => createAgentBridge(() => editorRef.current), [])

  useEffect(() => {
    rememberAiPanelOpen(AI_OPEN_KEY, aiOpen)
  }, [aiOpen])

  // boot the editor once and load the file queued for this view
  useEffect(() => {
    let disposed = false
    let editor: RhwpEditor | null = null
    void (async () => {
      try {
        const [path, theme, lang] = await Promise.all([
          window.hwpApi.consumePending(),
          window.hwpApi.getTheme().catch((): UiTheme => 'system'),
          window.hwpApi.getLanguage(),
        ])
        // the studio reads its settings before first paint, so they are seeded before it exists
        localStorage.setItem(
          STUDIO_SETTINGS_KEY,
          seededStudioSettings(localStorage.getItem(STUDIO_SETTINGS_KEY), theme),
        )
        editor = await createEditor(hostRef.current!, { studioUrl: studioUrl(lang) })
        if (disposed) {
          editor.destroy()
          return
        }
        editorRef.current = editor
        if (!path) {
          setPhase('empty')
          return
        }
        setPhase('loading')
        const bytes = await window.hwpApi.readFile(path)
        await editor.loadFile(bytes, fileNameOf(path), { skipUnsavedGuard: true })
        if (!disposed) setPhase('ready')
      } catch (error) {
        if (disposed) return
        if (editor && isBridgeTimeout(error)) return
        setPhase('failed')
        setNotice({
          tone: 'error',
          key: editor ? 'openFailed' : 'editorFailed',
          detail: detailOf(error),
        })
      }
    })()
    return () => {
      disposed = true
      editorRef.current = null
      editor?.destroy()
    }
  }, [])

  // a document can arrive after the load call gave up or failed (a password
  // entered late, a second try in the editor's own prompt): notice it and go on
  useEffect(() => {
    if (phase !== 'loading' && phase !== 'failed') return
    const timer = setInterval(() => {
      void editorRef.current?.commands
        .context()
        .then((context) => {
          if (context.hasDocument !== true) return
          setPhase('ready')
          setNotice((current) => (current?.key === 'openFailed' ? null : current))
        })
        .catch(() => {})
    }, ARRIVAL_POLL_MS)
    return () => clearInterval(timer)
  }, [phase])

  // mirror the editor's unsaved state to the main process, which owns the close prompt
  useEffect(() => {
    if (phase !== 'ready') return
    const editor = editorRef.current
    if (!editor) return
    let reported = false
    let asking = false
    const check = async () => {
      if (asking || savingRef.current) return
      asking = true
      try {
        const dirty = (await editor.commands.context()).isDirty === true
        if (dirty !== reported) {
          reported = dirty
          window.hwpApi.setDirty(dirty)
        }
      } catch {
        // the editor is going away; the next tick or the unmount settles it
      } finally {
        asking = false
      }
    }
    const timer = setInterval(() => void check(), DIRTY_POLL_MS)
    // an edit followed at once by closing the tab must not slip between two ticks
    const frame = editor.element.contentWindow
    const soon = () => setTimeout(() => void check(), 50)
    const events = [
      'keydown',
      'keyup',
      'input',
      'compositionend',
      'pointerup',
      'paste',
      'cut',
      'drop',
    ] as const
    for (const name of events) frame?.addEventListener(name, soon, true)
    return () => {
      clearInterval(timer)
      for (const name of events) frame?.removeEventListener(name, soon, true)
    }
  }, [phase])

  const save = useCallback(async (mode: SaveMode): Promise<boolean> => {
    const editor = editorRef.current
    if (!editor || savingRef.current) return false
    savingRef.current = true
    try {
      const outcome = await runSave(savePortOf(editor), window.hwpApi, mode)
      if (outcome.kind === 'saved') {
        setNotice(
          outcome.backupPath
            ? { tone: 'info', key: 'backupKept', params: { name: fileNameOf(outcome.backupPath) } }
            : null,
        )
        return true
      }
      if (outcome.kind === 'failed') {
        setNotice({
          tone: 'error',
          key:
            outcome.reason === 'protected'
              ? 'saveProtected'
              : outcome.reason === 'verify'
                ? 'saveVerifyFailed'
                : 'saveFailed',
          ...(outcome.detail ? { detail: outcome.detail } : {}),
        })
      }
      return false
    } finally {
      savingRef.current = false
    }
  }, [])

  // saves asked for by the menu, the shortcut and the close prompt
  useEffect(() => {
    const canSave = () => phase === 'ready' && !savingRef.current
    const offSave = window.hwpApi.onSaveRequest((mode) => {
      // the main process is waiting on this request; decline it rather than leave it hanging
      if (!canSave()) {
        window.hwpApi.abortSave()
        return
      }
      void (async () => {
        // a plain Save with nothing to write does nothing; ask the editor now
        // rather than trust the polled flag, which may not have seen the last key
        const dirty =
          mode === 'saveAs' ||
          (await editorRef.current?.commands
            .context()
            .then((context) => context.isDirty !== false)
            .catch(() => true))
        if (dirty) await save(mode)
        else window.hwpApi.abortSave()
      })()
    })
    const offClose = window.hwpApi.onCloseSaveRequest(() => {
      if (!canSave()) window.hwpApi.sendCloseSaveResult(false)
      else void save('save').then((ok) => window.hwpApi.sendCloseSaveResult(ok))
    })
    return () => {
      offSave()
      offClose()
    }
  }, [phase, save])

  // keep the editor's own chrome on the app theme
  useEffect(
    () =>
      window.hwpApi.onThemeChanged((theme) => {
        void editorRef.current?.commands.execute(`view:theme-${theme}`).catch(() => {})
      }),
    [],
  )

  useEffect(() => {
    if (notice?.tone !== 'info') return
    const timer = setTimeout(() => setNotice(null), INFO_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <div className="hwp-app" data-phase={phase}>
      <div className="app-main">
        {/* the assistant works on an open document, so it appears with one */}
        {phase === 'ready' && (
          <div className={`ai-dock${aiOpen ? '' : ' collapsed'}`}>
            {!aiOpen && (
              <button
                type="button"
                className="ai-rail ai-entry"
                data-tip={t('aiOpenAssistant')}
                aria-label={aiSubscriptionText(lang, 'aiAssistant')}
                onClick={() => setAiOpen(true)}
              >
                <AiMark size={22} />
              </button>
            )}
            <AiPanel bridge={agentBridge} onCollapse={() => setAiOpen(false)} />
          </div>
        )}
        <div className="hwp-stage">
          <div ref={hostRef} className="hwp-editor-host" />
          {phase === 'booting' && <div className="hwp-cover">{t('loading')}</div>}
          {phase === 'empty' && <div className="hwp-cover">{t('noDocument')}</div>}
          {notice && (
            <div
              className={`hwp-notice hwp-notice-${notice.tone}`}
              role={notice.tone === 'error' ? 'alert' : 'status'}
            >
              <div className="hwp-notice-text">
                <span>{t(notice.key, notice.params)}</span>
                {notice.detail && <span className="hwp-notice-detail">{notice.detail}</span>}
              </div>
              <button
                type="button"
                className="hwp-notice-close"
                aria-label={t('dismiss')}
                onClick={() => setNotice(null)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
