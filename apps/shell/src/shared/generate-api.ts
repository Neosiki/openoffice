// Contract between the generate window ("make a new document from these
// files"), Home's entry points and the shell main process. The window is a
// small separate BrowserWindow (it has to show above editor tabs, which are
// views drawn over the shell's own page), with its own preload
// (src/preload/generate.ts) and renderer entry (src/renderer/generate.html).
//
// No AI runs from here. "Make" opens a new untitled tab of the chosen kind and
// leaves the request queued for that tab to take exactly once; the editor in
// that tab starts the run through its usual send gate.

import type { Lang } from '@genoffice/i18n'

/** `ai`: an editor's AI writes the new document. `convert`: no AI (8.6, a later task) */
export type GenerateMode = 'ai' | 'convert'

/** what the AI can make; each is a new untitled tab of that editor */
export const AI_TARGET_KINDS = ['slides', 'html', 'mindmap'] as const
export type AiTargetKind = (typeof AI_TARGET_KINDS)[number]

/**
 * Conversions without AI (8.6): one source of a fixed type to one target.
 * Validation only for now; executing them is a later task.
 */
export const CONVERT_KINDS = [
  'mindmap-to-markdown',
  'mindmap-to-slides',
  'markdown-to-mindmap',
] as const
export type ConvertKind = (typeof CONVERT_KINDS)[number]

/** 8.1: the one shape every entry point builds */
export interface GenerateRequest {
  mode: GenerateMode
  kind: AiTargetKind | ConvertKind
  /** absolute file paths; at least one */
  materials: string[]
  /** what the user wrote; may be empty. Always empty for `convert` */
  text: string
}

/**
 * What a new tab takes, once (8.5). The receiving editor attaches the
 * materials to its AI panel, puts `text` in the composer and starts the run
 * through its normal send gate — a missing connection blocks it there and
 * leaves the text and the attachments in place.
 */
export interface GenerateHandoff {
  /** unique per press of "make" */
  id: string
  mode: 'ai'
  target: AiTargetKind
  /** the readable materials, in the order the window listed them */
  materials: Array<{ path: string; name: string }>
  /** the user's words, or the kind's default request when they wrote none */
  text: string
  /** true when `text` is the default request (the box was left empty) */
  defaultText: boolean
  /** when "make" was pressed, ms since epoch */
  createdAt: number
}

/** why a file was left out of the materials */
export type MaterialProblem = 'missing' | 'unsupported' | 'too-large' | 'unreadable' | 'untitled'

/** one row of the window's material list */
export interface MaterialView {
  /** stable id within the window: the path, or `untitled:<webContentsId>` */
  key: string
  name: string
  /** absent for a document that was never saved */
  path?: string
  /** size on disk; absent when the file could not be read */
  sizeBytes?: number
  /**
   * ready: goes into the request. unsaved: open with unsaved changes, blocks
   * "make" until saved. excluded: left out, see `problem`. checking: being read.
   */
  state: 'ready' | 'unsaved' | 'excluded' | 'checking'
  problem?: MaterialProblem
  /** with `too-large`: the cap this file is over, in MB */
  limitMb?: number
  /**
   * How the window helps with an unsaved or untitled row: `save` saves it in
   * place, `show` brings its tab forward so the user saves it there.
   */
  saveAction?: 'save' | 'show'
}

export interface GenerateWindowState {
  lang: Lang
  kind: AiTargetKind
  materials: MaterialView[]
  /** rows in state `ready` */
  readyCount: number
  /** total size of the ready rows */
  totalBytes: number
  /** 8.7: neither blocks "make" */
  notices: { usage: boolean; longMaterial: boolean }
  /** more rows than the count cap: remove some before "make" */
  tooMany: boolean
  /** at least one ready row, none unsaved, not too many, nothing in flight */
  canMake: boolean
  /** a status read is running */
  checking: boolean
  /** "make" was pressed and the tab is being opened */
  making: boolean
  /** keys of rows whose save is running */
  saving: string[]
  /** the last action that failed, shown once */
  failure: 'make' | 'save' | null
  limits: { maxMaterials: number; maxMaterialMb: number; maxImageMb: number }
}

export const GENERATE_CHANNELS = {
  // window → main
  getState: 'generate:get-state',
  getTheme: 'generate:get-theme',
  setKind: 'generate:set-kind',
  addMaterials: 'generate:add-materials',
  removeMaterial: 'generate:remove-material',
  saveMaterial: 'generate:save-material',
  refresh: 'generate:refresh',
  make: 'generate:make',
  cancel: 'generate:cancel',
  // main → window
  state: 'generate:state',
  // home → main: GENERATE_HOME_CHANNELS (generate-home-channels.ts)
} as const

/** what the generate window's preload exposes (`window.aiOfficeGenerateWindow`) */
export interface GenerateWindowApi {
  getState(): Promise<GenerateWindowState | null>
  onState(handler: (state: GenerateWindowState) => void): () => void
  /** the UI theme switched anywhere (same broadcast every window gets) */
  onThemeChanged(handler: (theme: 'light' | 'dark' | 'system') => void): () => void
  getTheme(): Promise<'light' | 'dark' | 'system'>
  setKind(kind: AiTargetKind): Promise<void>
  /** file picker in the main process; picked files join the list */
  addMaterials(): Promise<void>
  removeMaterial(key: string): Promise<void>
  saveMaterial(key: string): Promise<void>
  refresh(): Promise<void>
  /** true when the new tab was opened (the window then closes) */
  make(text: string): Promise<boolean>
  cancel(): Promise<void>
}

/** what Home's preload exposes (`window.aiOfficeGenerate`) */
export interface GenerateHomeApi {
  /** the selection bar and the file-row menu: these files */
  openWithPaths(paths: string[]): Promise<void>
  /** the Starred view's group: every file in it */
  openWithGroup(group: string): Promise<void>
}
