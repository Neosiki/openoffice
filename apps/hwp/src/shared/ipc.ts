import type { AiSettings, AiStreamChunk, AiStreamRequest } from '@genoffice/ai-provider'
import type { Lang } from '@genoffice/i18n'
import type { AiPanelPrefs } from '@genoffice/ui'
import type { SubscriptionApi } from './subscription-api'

export const HWP_CHANNELS = {
  consumePending: 'hwp:consume-pending',
  readFile: 'hwp:read-file',
  beginSave: 'hwp:begin-save',
  commitSave: 'hwp:commit-save',
  abortSave: 'hwp:abort-save',
  saveRequest: 'hwp:save-request',
  dirtyChanged: 'hwp:dirty-changed',
  closeSaveRequest: 'hwp:close-save-request',
  closeSaveResult: 'hwp:close-save-result',
  // channels below are served once by the shell for every editor
  getLanguage: 'app:get-language',
  languageChanged: 'app:language-changed',
  getTheme: 'app:get-theme',
  themeChanged: 'app:theme-changed',
  getAiPanelPrefs: 'app:get-ai-panel-prefs',
  setAiPanelPrefs: 'app:set-ai-panel-prefs',
  aiPanelPrefsChanged: 'app:ai-panel-prefs-changed',
} as const

/**
 * The shared AI host. Its handlers are registered once for the whole app by
 * the docs main (registerAiIpc); this editor registers none of them.
 */
export const AI_CHANNELS = {
  getSettings: 'ai:get-settings',
  setSettings: 'ai:set-settings',
  settingsChanged: 'ai:settings-changed',
  openModelSettings: 'ai:open-model-settings',
  stream: 'ai:stream',
  streamChunk: 'ai:stream-chunk',
  streamCancel: 'ai:stream-cancel',
} as const

export type UiTheme = 'light' | 'dark' | 'system'
export type SaveMode = 'save' | 'saveAs'

/** The two container formats the editor writes. A document is saved back in the format of its file name. */
export type HwpFormat = 'hwp' | 'hwpx'

/** Format a path is written in, or null when its extension is neither. */
export function hwpFormatOfPath(path: string): HwpFormat | null {
  const match = /\.(hwpx?)$/i.exec(path)
  return match ? (match[1].toLowerCase() as HwpFormat) : null
}

/** Largest document the save channel accepts; far above real documents, below what would stall the process. */
export const MAX_HWP_SAVE_BYTES = 512 * 1024 * 1024

export type BeginSaveResult =
  | { ok: true; path: string; format: HwpFormat }
  | { ok: true; canceled: true }
  | { ok: false; error: string }

export type CommitSaveResult =
  /** `backupPath` is set when this save was the first to overwrite the file and the previous bytes were kept */
  { ok: true; path: string; backupPath?: string } | { ok: false; error: string }

export interface HwpApi {
  /** path queued for this view when its tab was created; null for a view opened without a file */
  consumePending(): Promise<string | null>
  readFile(path: string): Promise<Uint8Array>
  /** resolve where and in which format this save goes (shows the dialog for Save As) */
  beginSave(mode: SaveMode): Promise<BeginSaveResult>
  /** write the exported bytes to the target `beginSave` resolved */
  commitSave(bytes: Uint8Array): Promise<CommitSaveResult>
  /** the renderer could not produce bytes for a save it began */
  abortSave(): void
  setDirty(dirty: boolean): void
  onSaveRequest(handler: (mode: SaveMode) => void): () => void
  onCloseSaveRequest(handler: () => void): () => void
  sendCloseSaveResult(ok: boolean): void
  getLanguage(): Promise<Lang>
  onLanguageChanged(handler: (lang: Lang) => void): () => void
  getTheme(): Promise<UiTheme>
  onThemeChanged(handler: (theme: UiTheme) => void): () => void
  /** AI panel side and text size (Settings › General in the shell) */
  getAiPanelPrefs(): Promise<AiPanelPrefs>
  setAiPanelPrefs(patch: Partial<AiPanelPrefs>): Promise<AiPanelPrefs>
  onAiPanelPrefsChanged(handler: (prefs: AiPanelPrefs) => void): () => void
  getAiSettings(): Promise<AiSettings>
  setAiSettings(settings: AiSettings): Promise<void>
  /** ai-settings.json was rewritten by any renderer; re-read it */
  onAiSettingsChanged(handler: () => void): () => void
  /** shell only: switch to Home and open Settings › AI Model (rejects in standalone) */
  openAiModelSettings(): Promise<void>
  /** subscription connections (Claude, Codex): statuses and the connect-card actions */
  aiSubscription: SubscriptionApi
  aiStream(request: AiStreamRequest): Promise<void>
  aiStreamCancel(requestId: string): Promise<void>
  onAiStream(handler: (chunk: AiStreamChunk) => void): () => void
}
