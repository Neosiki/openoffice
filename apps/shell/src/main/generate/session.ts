/**
 * One open generate window's state and actions, without Electron: the window
 * module wires the dependencies (file reads, the open tabs, the new tab) and
 * pushes `state()` to the renderer after every change.
 *
 * Rules held here:
 * - "make" re-reads every material first and goes ahead only with at least
 *   one readable material, none open with unsaved changes, and no more than
 *   the cap (8.3, 8.4). Unreadable ones are left out with their reasons.
 * - A document never saved cannot be material; it is listed with that reason,
 *   and once it is saved (its tab now has a path) it becomes a normal row.
 * - "make" opens the new tab with the request queued for it, once, and closes
 *   the window. A second press while one is in flight does nothing. No run
 *   starts here.
 */
import type { Lang } from '@genoffice/i18n'
import type {
  AiTargetKind,
  GenerateHandoff,
  GenerateWindowState,
  MaterialView,
} from '../../shared/generate-api'
import { defaultGeneratePrompt } from '../../shared/generate-default-prompts'
import { MAX_IMAGE_MATERIAL_BYTES, MAX_MATERIAL_BYTES, MAX_MATERIALS } from './limits'
import {
  IMAGE_MATERIAL_EXTS,
  materialKey,
  summarizeMaterials,
  untitledMaterial,
  type MaterialStatus,
} from './materials'
import { isAiTargetKind, prepareGenerateRequest } from './request'

/** where a row came from: a file, or an open document that was never saved */
export type MaterialRef = { path: string } | { untitled: { webContentsId: number; title: string } }

export interface GenerateSessionDeps {
  lang(): Lang
  inspect(path: string): Promise<MaterialStatus>
  /**
   * For a never-saved document: its path now (it was saved since), null while
   * it is still untitled.
   */
  pathOfUntitled(webContentsId: number): Promise<string | null>
  /** whether this path's open document can be saved in place, or only shown */
  saveActionFor(path: string): Promise<'save' | 'show'>
  /** save the open document behind `path`; `shown` = its tab was brought forward instead */
  saveMaterial(path: string): Promise<'saved' | 'shown' | 'failed'>
  /** bring a never-saved document's tab forward so the user can save it */
  showUntitled(webContentsId: number): Promise<void>
  /** open the new untitled tab with the request queued for it (throws when it cannot) */
  openTargetTab(handoff: GenerateHandoff): void
  push(state: GenerateWindowState): void
  close(): void
  newId(): string
  now(): number
  /** a dirty flag can lag a save by a beat: when to look again (tests pass 0) */
  recheckDelayMs?: number
}

interface Row {
  key: string
  ref: MaterialRef
  /** null while being read */
  status: MaterialStatus | null
  saveAction?: 'save' | 'show'
}

function keyOf(ref: MaterialRef): string {
  return 'path' in ref ? materialKey(ref.path) : `untitled:${ref.untitled.webContentsId}`
}

export class GenerateSession {
  private rows: Row[] = []
  private kind: AiTargetKind
  private making = false
  private closed = false
  private readonly saving = new Set<string>()
  private failure: GenerateWindowState['failure'] = null
  private inFlight = 0

  constructor(
    private readonly deps: GenerateSessionDeps,
    init: { refs: readonly MaterialRef[]; kind?: AiTargetKind },
  ) {
    this.kind = init.kind ?? 'slides'
    this.appendRefs(init.refs)
  }

  get isClosed(): boolean {
    return this.closed
  }

  /** start over with a new set of materials (the window was opened again from an entry point) */
  async reset(refs: readonly MaterialRef[], kind?: AiTargetKind): Promise<void> {
    this.rows = []
    if (kind) this.kind = kind
    this.failure = null
    this.appendRefs(refs)
    await this.refresh()
  }

  state(): GenerateWindowState {
    const statuses = this.rows.flatMap((r) => (r.status ? [r.status] : []))
    const summary = summarizeMaterials(statuses, this.kind)
    const checking = this.inFlight > 0 || this.rows.some((r) => !r.status)
    const materials: MaterialView[] = this.rows.map((row) => this.viewOf(row))
    return {
      lang: this.deps.lang(),
      kind: this.kind,
      materials,
      readyCount: summary.ready.length,
      totalBytes: summary.totalBytes,
      notices: summary.notices,
      tooMany: summary.tooMany,
      canMake: summary.canMake && !checking && !this.making && this.saving.size === 0,
      checking,
      making: this.making,
      saving: [...this.saving],
      failure: this.failure,
      limits: {
        maxMaterials: MAX_MATERIALS,
        maxMaterialMb: Math.round(MAX_MATERIAL_BYTES / 1024 / 1024),
        maxImageMb: Math.round(MAX_IMAGE_MATERIAL_BYTES / 1024 / 1024),
      },
    }
  }

  private viewOf(row: Row): MaterialView {
    const name = 'path' in row.ref ? (row.status?.name ?? row.ref.path) : row.ref.untitled.title
    const path = 'path' in row.ref ? row.ref.path : undefined
    const s = row.status
    if (!s) return { key: row.key, name, ...(path ? { path } : {}), state: 'checking' }
    const base = {
      key: row.key,
      name: s.name,
      ...(path ? { path } : {}),
      ...(s.sizeBytes !== undefined ? { sizeBytes: s.sizeBytes } : {}),
    }
    if (s.problem) {
      const limit = IMAGE_MATERIAL_EXTS.has(s.ext) ? MAX_IMAGE_MATERIAL_BYTES : MAX_MATERIAL_BYTES
      return {
        ...base,
        state: 'excluded',
        problem: s.problem,
        ...(s.problem === 'too-large' ? { limitMb: Math.round(limit / 1024 / 1024) } : {}),
        ...(s.problem === 'untitled' ? { saveAction: 'show' as const } : {}),
      }
    }
    if (s.unsaved) return { ...base, state: 'unsaved', saveAction: row.saveAction ?? 'show' }
    return { ...base, state: 'ready' }
  }

  private push(): void {
    if (!this.closed) this.deps.push(this.state())
  }

  private appendRefs(refs: readonly MaterialRef[]): Row[] {
    const added: Row[] = []
    for (const ref of refs) {
      if ('path' in ref && (typeof ref.path !== 'string' || !ref.path)) continue
      const key = keyOf(ref)
      if (this.rows.some((r) => r.key === key)) continue
      const row: Row = { key, ref, status: null }
      this.rows.push(row)
      added.push(row)
    }
    return added
  }

  /** read one row again; a row removed meanwhile is left alone */
  private async inspectRow(row: Row): Promise<void> {
    if ('untitled' in row.ref) {
      const { webContentsId, title } = row.ref.untitled
      const savedPath = await this.deps.pathOfUntitled(webContentsId).catch(() => null)
      if (savedPath) {
        const key = materialKey(savedPath)
        if (this.rows.some((r) => r !== row && r.key === key)) {
          this.rows = this.rows.filter((r) => r !== row)
          return
        }
        row.ref = { path: savedPath }
        row.key = key
      } else {
        row.status = untitledMaterial(webContentsId, title)
        return
      }
    }
    const path = (row.ref as { path: string }).path
    const status = await this.deps.inspect(path)
    const saveAction = status.unsaved
      ? await this.deps.saveActionFor(path).catch(() => 'show' as const)
      : undefined
    if (!this.rows.includes(row)) return
    row.status = { ...status, key: row.key }
    row.saveAction = saveAction
  }

  private async inspectRows(rows: readonly Row[]): Promise<void> {
    this.inFlight++
    this.push()
    try {
      await Promise.all(rows.map((row) => this.inspectRow(row)))
    } finally {
      this.inFlight--
      this.push()
    }
  }

  /** read every row again (window focus, after a save, before "make") */
  async refresh(): Promise<void> {
    await this.inspectRows([...this.rows])
  }

  setKind(kind: unknown): void {
    if (!isAiTargetKind(kind) || this.making) return
    this.kind = kind
    this.failure = null
    this.push()
  }

  async addPaths(paths: readonly unknown[]): Promise<void> {
    if (this.making) return
    this.failure = null
    const refs = paths
      .filter((p): p is string => typeof p === 'string' && !!p)
      .map((path) => ({ path }))
    const added = this.appendRefs(refs)
    if (added.length > 0) await this.inspectRows(added)
    else this.push()
  }

  remove(key: unknown): void {
    if (typeof key !== 'string' || this.making) return
    this.rows = this.rows.filter((r) => r.key !== key)
    this.failure = null
    this.push()
  }

  async save(key: unknown): Promise<void> {
    const row = this.rows.find((r) => r.key === key)
    if (!row || this.making || this.saving.has(row.key)) return
    this.failure = null
    if ('untitled' in row.ref) {
      await this.deps.showUntitled(row.ref.untitled.webContentsId)
      this.push()
      return
    }
    const rowKey = row.key
    this.saving.add(rowKey)
    this.push()
    let result: 'saved' | 'shown' | 'failed'
    try {
      result = await this.deps.saveMaterial(row.ref.path)
    } catch {
      result = 'failed'
    }
    this.saving.delete(rowKey)
    if (result === 'failed') this.failure = 'save'
    await this.inspectRows([row])
    // a tab can report its clean state a moment after the write lands
    if (result === 'saved' && row.status?.unsaved) {
      await new Promise((r) => setTimeout(r, this.deps.recheckDelayMs ?? 600))
      if (this.rows.includes(row)) await this.inspectRows([row])
    }
  }

  /**
   * "make": read everything again, then open the new tab with the request
   * queued for it and close the window. False (and nothing opened) when the
   * materials do not allow it any more.
   */
  async make(text: unknown): Promise<boolean> {
    if (this.closed || this.making || typeof text !== 'string') return false
    this.making = true
    this.failure = null
    this.push()
    try {
      await this.refresh()
      const candidates = this.rows.filter((r) => r.status && !r.status.problem && 'path' in r.ref)
      const prepared = await prepareGenerateRequest(
        {
          mode: 'ai',
          kind: this.kind,
          materials: candidates.map((r) => (r.ref as { path: string }).path),
          text,
        },
        (path) => this.deps.inspect(path),
      )
      if (!prepared.ok) return this.stopMaking(false)
      const trimmed = text.trim()
      const handoff: GenerateHandoff = {
        id: this.deps.newId(),
        mode: 'ai',
        target: this.kind,
        materials: prepared.ready.map((s) => ({ path: s.path!, name: s.name })),
        text: trimmed || defaultGeneratePrompt(this.deps.lang(), this.kind),
        defaultText: !trimmed,
        createdAt: this.deps.now(),
      }
      this.deps.openTargetTab(handoff)
      this.closed = true
      this.deps.close()
      return true
    } catch {
      this.failure = 'make'
      return this.stopMaking(false)
    }
  }

  private stopMaking(result: boolean): boolean {
    this.making = false
    this.push()
    return result
  }
}
