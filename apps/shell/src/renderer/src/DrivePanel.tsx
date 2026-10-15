import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import type {
  DriveApi,
  DriveEntry,
  DriveEntryType,
  DriveErrorKind,
  DriveListingRequest,
  DriveUiState,
} from '../../shared/drive-api'
import { driveUiText, type DriveStringKey } from './i18n/strings-drive'
import iconDocx from './assets/file-docx.svg'
import iconXlsx from './assets/file-xlsx.svg'
import iconPptx from './assets/file-pptx.svg'
import iconPdf from './assets/file-pdf.svg'
import iconMd from './assets/file-md.svg'
import iconHtml from './assets/file-html.svg'
import iconMindmap from './assets/file-mindmap.svg'
import iconHwp from './assets/file-hwp.svg'
import './drive.css'

declare global {
  interface Window {
    /** Google Drive (decision 0033; src/preload/index.ts) */
    aiOfficeDrive?: DriveApi
  }
}

const ICONS: Partial<Record<DriveEntryType, string>> = {
  document: iconDocx,
  spreadsheet: iconXlsx,
  presentation: iconPptx,
  pdf: iconPdf,
  markdown: iconMd,
  html: iconHtml,
  mindmap: iconMindmap,
  hwp: iconHwp,
}

const ERROR_KEYS: Record<DriveErrorKind | 'unsupported' | 'disk', DriveStringKey> = {
  'not-connected': 'driveErrNotConnected',
  'not-found': 'driveErrNotFound',
  forbidden: 'driveErrForbidden',
  'too-large': 'driveErrTooLarge',
  'rate-limit': 'driveErrRateLimit',
  network: 'driveErrNetwork',
  unsupported: 'driveUnsupported',
  disk: 'driveErrDisk',
}

type Place = 'mine' | 'shared' | 'recent'

interface Crumb {
  id: string
  name: string
}

/** The live Drive state from the main process; null until it answers */
export function useDriveState(): DriveUiState | null {
  const [state, setState] = useState<DriveUiState | null>(null)
  useEffect(() => {
    const api = window.aiOfficeDrive
    if (!api) {
      setState({ state: 'unavailable' })
      return
    }
    let live = true
    void api.state().then(
      (s) => live && setState(s),
      () => live && setState({ state: 'unavailable' }),
    )
    const off = api.onStateChanged((s) => setState(s))
    return () => {
      live = false
      off()
    }
  }, [])
  return state
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 5.5c0-.8.7-1.5 1.5-1.5h3.6l1.6 1.8h6.8c.8 0 1.5.7 1.5 1.5v7.2c0 .8-.7 1.5-1.5 1.5H4c-.8 0-1.5-.7-1.5-1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OtherIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 2.5h6.5L15 6v11.5H5z M11.5 2.5V6H15"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DriveNavIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.6 2h4.8l3.9 6.7-2.4 4.3H4.1L1.7 8.7z M5.6 2l3.9 6.7h4.8 M10.4 2 4.1 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DrivePanel({
  lang,
  dateLocale,
  onOpenSettings,
}: {
  lang: Lang
  dateLocale: string
  /** Settings → Integrations, where Drive is connected */
  onOpenSettings: () => void
}) {
  const t = (key: DriveStringKey, params?: Record<string, string>) => driveUiText(lang, key, params)
  const state = useDriveState()
  const [place, setPlace] = useState<Place>('mine')
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState<string | null>(null)
  const [files, setFiles] = useState<DriveEntry[]>([])
  const [nextPage, setNextPage] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<DriveStringKey | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const request = useRef(0)

  const connected = state?.state === 'connected'

  const listing = useCallback((): DriveListingRequest => {
    if (searched) return { kind: 'search', text: searched }
    if (place === 'shared' && crumbs.length === 0) return { kind: 'shared' }
    if (place === 'recent') return { kind: 'recent' }
    return { kind: 'folder', folderId: crumbs.at(-1)?.id ?? 'root' }
  }, [searched, place, crumbs])

  const load = useCallback(
    async (more?: string) => {
      const api = window.aiOfficeDrive
      if (!api || !connected) return
      const id = ++request.current
      setLoading(true)
      setError(null)
      const result = await api.list(listing(), more).catch(() => null)
      if (id !== request.current) return
      setLoading(false)
      if (!result || !result.ok) {
        setError(ERROR_KEYS[result?.kind ?? 'network'])
        if (!more) setFiles([])
        return
      }
      setFiles((prev) => (more ? [...prev, ...result.files] : result.files))
      setNextPage(result.nextPageToken)
    },
    [connected, listing],
  )

  useEffect(() => {
    void load()
  }, [load])

  const choosePlace = (next: Place) => {
    setPlace(next)
    setCrumbs([])
    setSearched(null)
    setQuery('')
  }

  const open = async (entry: DriveEntry) => {
    if (entry.type === 'folder') {
      setSearched(null)
      setQuery('')
      setCrumbs((c) => [...c, { id: entry.id, name: entry.name }])
      return
    }
    const api = window.aiOfficeDrive
    if (!api || !entry.openable || opening) return
    setOpening(entry.id)
    setError(null)
    const result = await api.open(entry.id).catch(() => null)
    setOpening(null)
    if (!result || !result.ok) setError(ERROR_KEYS[result?.kind ?? 'network'])
  }

  if (!state || state.state === 'unavailable') return <main className="content drive-panel" />

  if (!connected) {
    return (
      <main className="content drive-panel">
        <h2 className="drive-title">{t('driveNav')}</h2>
        <div className="drive-empty-card">
          <div className="drive-empty-title">{t('driveNotConnectedTitle')}</div>
          <p className="drive-empty-body">{t('driveNotConnectedBody')}</p>
          {state.state === 'disconnected' && state.expired && (
            <p className="drive-warn">{t('driveExpired')}</p>
          )}
          <button className="drive-primary" onClick={onOpenSettings}>
            {t('driveOpenSettings')}
          </button>
        </div>
      </main>
    )
  }

  const title = searched
    ? t('driveSearchResults', { q: searched })
    : (crumbs.at(-1)?.name ??
      (place === 'shared'
        ? t('driveShared')
        : place === 'recent'
          ? t('driveRecent')
          : t('driveMyDrive')))

  return (
    <main className="content drive-panel">
      <div className="drive-head">
        <h2 className="drive-title">{t('driveNav')}</h2>
        <span className="drive-account">{state.email || state.name}</span>
      </div>
      <div className="drive-toolbar">
        <div className="filter-pills" role="tablist">
          {(['mine', 'shared', 'recent'] as const).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={place === p && !searched}
              className={`filter-pill${place === p && !searched ? ' active' : ''}`}
              onClick={() => choosePlace(p)}
            >
              {p === 'mine'
                ? t('driveMyDrive')
                : p === 'shared'
                  ? t('driveShared')
                  : t('driveRecent')}
            </button>
          ))}
        </div>
        <form
          className="drive-search"
          onSubmit={(e) => {
            e.preventDefault()
            const q = query.trim()
            setCrumbs([])
            setSearched(q || null)
          }}
        >
          <input
            type="search"
            value={query}
            placeholder={t('driveSearchPlaceholder')}
            aria-label={t('driveSearchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <button className="drive-ghost" onClick={() => void load()} disabled={loading}>
          {t('driveRefresh')}
        </button>
      </div>

      {(crumbs.length > 0 || searched) && (
        <nav className="drive-crumbs" aria-label={title}>
          <button
            className="drive-crumb"
            onClick={() => {
              setCrumbs([])
              setSearched(null)
              setQuery('')
            }}
          >
            {place === 'shared'
              ? t('driveShared')
              : place === 'recent'
                ? t('driveRecent')
                : t('driveMyDrive')}
          </button>
          {crumbs.map((c, i) => (
            <span key={c.id} className="drive-crumb-item">
              <span className="drive-crumb-sep">›</span>
              <button className="drive-crumb" onClick={() => setCrumbs(crumbs.slice(0, i + 1))}>
                {c.name}
              </button>
            </span>
          ))}
          {searched && (
            <span className="drive-crumb-item">
              <span className="drive-crumb-sep">›</span>
              <span className="drive-crumb-current">{title}</span>
            </span>
          )}
        </nav>
      )}

      {error && (
        <p className="drive-warn" role="alert">
          {t(error)}
        </p>
      )}

      <ul className="drive-list" aria-busy={loading}>
        {files.map((entry) => {
          const icon = ICONS[entry.type]
          const disabled = entry.type !== 'folder' && !entry.openable
          const note = disabled
            ? t('driveUnsupported')
            : entry.google
              ? t('driveGoogleNote')
              : !entry.canEdit && entry.type !== 'folder'
                ? t('driveReadOnlyNote')
                : undefined
          return (
            <li key={entry.id}>
              <button
                className="drive-row"
                disabled={disabled || opening !== null}
                title={note}
                onClick={() => void open(entry)}
              >
                <span className="drive-icon">
                  {entry.type === 'folder' ? (
                    <FolderIcon />
                  ) : icon ? (
                    <img src={icon} alt="" width={20} height={20} />
                  ) : (
                    <OtherIcon />
                  )}
                </span>
                <span className="drive-name">{entry.name}</span>
                {entry.google && <span className="drive-badge">{t('driveGoogleBadge')}</span>}
                {!entry.canEdit && entry.type !== 'folder' && (
                  <span className="drive-badge">{t('driveReadOnly')}</span>
                )}
                <span className="drive-date">
                  {opening === entry.id
                    ? t('driveOpening')
                    : entry.modifiedTime
                      ? new Date(entry.modifiedTime).toLocaleDateString(dateLocale)
                      : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {!loading && files.length === 0 && !error && <p className="drive-muted">{t('driveEmpty')}</p>}
      {loading && <p className="drive-muted">{t('driveLoading')}</p>}
      {!loading && nextPage && (
        <button className="drive-ghost drive-more" onClick={() => void load(nextPage)}>
          {t('driveLoadMore')}
        </button>
      )}
    </main>
  )
}
