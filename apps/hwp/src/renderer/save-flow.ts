import type { HwpApi, HwpFormat, MeasuredTab, SaveMode, TabMeasure, TabSpot } from '../shared/ipc'

/** The part of the embedded editor a save needs. */
export interface SaveEditorPort {
  /** the open document was unlocked with a password; the exports below would write it without one */
  isPasswordProtected(): Promise<boolean>
  exportHwp(): Promise<Uint8Array>
  exportHwpx(): Promise<Uint8Array>
  /** serialize to HWP, reload the result inside the engine, report whether it came back whole */
  exportHwpVerify(): Promise<{
    pageCountBefore: number
    pageCountAfter: number
    recovered: boolean
  }>
  /** how the editor lays out the given tabs; null for one it cannot measure */
  measureTabs(spots: TabSpot[]): Promise<(TabMeasure | null)[]>
  /** clear the editor's unsaved state after the host stored the bytes */
  notifySaved(fileName?: string): Promise<unknown>
}

export type SaveOutcome =
  /** `tailsLost`: written, but without some master pages or memos the opened file had */
  | { kind: 'saved'; path: string; backupPath?: string; tailsLost?: true }
  | { kind: 'canceled' }
  /**
   * Nothing was written.
   * `protected`: the document has a password this save path cannot keep.
   * `tracked`: the document has tracked changes this save path cannot keep.
   * `verify`: the engine could not read back what it was about to write.
   */
  | {
      kind: 'failed'
      reason: 'protected' | 'tracked' | 'verify' | 'export' | 'write'
      detail?: string
    }

const fileNameOf = (path: string) => path.split(/[\\/]/).pop() ?? path

const detailOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** the main process's refusal reason while a copy pair holds the disk version (hwp-main.ts) */
const EXTERNAL_MODIFIED = 'hwp: external-modified'

/**
 * The widths for the tabs the engine wrote without one (Hangul would draw them with none,
 * decision 0026), as the editor lays them out. A save never fails on this: whatever cannot
 * be measured is written as the engine wrote it.
 */
async function measuredTabs(
  editor: SaveEditorPort,
  api: Pick<HwpApi, 'newTabs'>,
  bytes: Uint8Array,
  format: HwpFormat,
): Promise<MeasuredTab[]> {
  try {
    const spots = await api.newTabs(bytes, format)
    if (spots.length === 0) return []
    const measures = await editor.measureTabs(spots)
    return spots.flatMap((spot, index) => {
      const measure = measures[index]
      return measure ? [{ ...spot, ...measure }] : []
    })
  } catch {
    return []
  }
}

/**
 * One save, start to finish: the main process decides where and in which
 * format, the editor exports, the main process writes. The file on disk is
 * only replaced by bytes the engine could produce; a failed export leaves it
 * untouched.
 */
export async function runSave(
  editor: SaveEditorPort,
  api: Pick<HwpApi, 'beginSave' | 'newTabs' | 'commitSave' | 'abortSave'>,
  mode: SaveMode,
): Promise<SaveOutcome> {
  // before any dialog: a protected document is not saved under any name
  try {
    if (await editor.isPasswordProtected()) {
      api.abortSave()
      return { kind: 'failed', reason: 'protected' }
    }
  } catch (error) {
    api.abortSave()
    return { kind: 'failed', reason: 'export', detail: detailOf(error) }
  }

  const begin = await api.beginSave(mode)
  if (!begin.ok) {
    return begin.reason === 'tracked'
      ? { kind: 'failed', reason: 'tracked' }
      : { kind: 'failed', reason: 'write', detail: begin.error }
  }
  if ('canceled' in begin) return { kind: 'canceled' }

  let bytes: Uint8Array
  try {
    if (begin.format === 'hwp') {
      const verify = await editor.exportHwpVerify()
      if (!verify.recovered || verify.pageCountBefore !== verify.pageCountAfter) {
        api.abortSave()
        return { kind: 'failed', reason: 'verify' }
      }
      bytes = await editor.exportHwp()
    } else {
      bytes = await editor.exportHwpx()
    }
  } catch (error) {
    api.abortSave()
    return { kind: 'failed', reason: 'export', detail: detailOf(error) }
  }

  const commit = await api.commitSave(bytes, await measuredTabs(editor, api, bytes, begin.format))
  if (!commit.ok) {
    // a same-document copy holds the disk version: the main process refused
    // the write (a deferred autosave or a declined overwrite prompt) — that is
    // a cancel, not a failure, and nothing lands in a notice
    if (commit.error === EXTERNAL_MODIFIED) return { kind: 'canceled' }
    return { kind: 'failed', reason: 'write', detail: commit.error }
  }
  // the file is already written; a failed notification only leaves the editor's own dirty flag set
  await editor.notifySaved(fileNameOf(commit.path)).catch(() => {})
  return {
    kind: 'saved',
    path: commit.path,
    ...(commit.backupPath ? { backupPath: commit.backupPath } : {}),
    ...(commit.tailsLost ? { tailsLost: true as const } : {}),
  }
}
