import { describe, expect, it, vi } from 'vitest'
import { runSave, type SaveEditorPort } from '../src/renderer/save-flow'
import type { BeginSaveResult, CommitSaveResult, TabSpot } from '../src/shared/ipc'

const HWP = Uint8Array.from([1, 2, 3])
const HWPX = Uint8Array.from([4, 5, 6])

function editor(overrides: Partial<SaveEditorPort> = {}): SaveEditorPort {
  return {
    isPasswordProtected: vi.fn(async () => false),
    exportHwp: vi.fn(async () => HWP),
    exportHwpx: vi.fn(async () => HWPX),
    exportHwpVerify: vi.fn(async () => ({
      pageCountBefore: 3,
      pageCountAfter: 3,
      recovered: true,
    })),
    measureTabs: vi.fn(async (spots: TabSpot[]) =>
      spots.map((spot) => (spot.tab === 0 ? { width: 4000, type: 0, fill: 0 } : null)),
    ),
    notifySaved: vi.fn(async () => ({ ok: true })),
    ...overrides,
  }
}

function api(
  begin: BeginSaveResult,
  commit: CommitSaveResult = { ok: true, path: 'C:/d/a.hwp' },
  tabs: TabSpot[] = [],
) {
  return {
    beginSave: vi.fn(async () => begin),
    newTabs: vi.fn(async () => tabs),
    commitSave: vi.fn(async () => commit),
    abortSave: vi.fn(),
  }
}

const SPOTS: TabSpot[] = [
  { sec: 0, para: 1, cells: [], tab: 0, tabs: 2 },
  { sec: 0, para: 1, cells: [], tab: 1, tabs: 2 },
]

describe('runSave', () => {
  it('hands the main process the widths the editor measured for the tabs it found', async () => {
    const ed = editor()
    const host = api({ ok: true, path: 'C:/d/a.hwpx', format: 'hwpx' }, undefined, SPOTS)
    await runSave(ed, host, 'save')
    expect(host.newTabs).toHaveBeenCalledWith(HWPX, 'hwpx')
    expect(ed.measureTabs).toHaveBeenCalledWith(SPOTS)
    // a tab the editor could not measure is left out
    expect(host.commitSave).toHaveBeenCalledWith(HWPX, [
      { ...SPOTS[0], width: 4000, type: 0, fill: 0 },
    ])
  })

  it('treats the copy-pair deferral as a cancel, not a failure', async () => {
    // the main process refuses the write while a sibling copy holds the disk
    // version (a deferred autosave or a declined overwrite): the renderer must
    // stay silent instead of showing a save failure with an internal string
    const ed = editor()
    const host = api(
      { ok: true, path: 'C:/d/a.hwp', format: 'hwp' },
      {
        ok: false,
        error: 'hwp: external-modified',
      },
    )
    await expect(runSave(ed, host, 'save')).resolves.toEqual({ kind: 'canceled' })
    expect(ed.notifySaved).not.toHaveBeenCalled()
  })

  it('saves without widths when measuring fails', async () => {
    const ed = editor({
      measureTabs: vi.fn(async () => {
        throw new Error('the editor is not ready')
      }),
    })
    const host = api({ ok: true, path: 'C:/d/a.hwp', format: 'hwp' }, undefined, SPOTS)
    const outcome = await runSave(ed, host, 'save')
    expect(outcome).toEqual({ kind: 'saved', path: 'C:/d/a.hwp' })
    expect(host.commitSave).toHaveBeenCalledWith(HWP, [])
  })

  it('does not ask the editor when no tab lacks a width', async () => {
    const ed = editor()
    const host = api({ ok: true, path: 'C:/d/a.hwp', format: 'hwp' })
    await runSave(ed, host, 'save')
    expect(ed.measureTabs).not.toHaveBeenCalled()
  })

  it('writes nothing for a document with tracked changes, and says why', async () => {
    const ed = editor()
    const host = api({
      ok: false,
      error: 'hwp: the document has tracked changes',
      reason: 'tracked',
    })
    const outcome = await runSave(ed, host, 'saveAs')
    expect(outcome).toEqual({ kind: 'failed', reason: 'tracked' })
    expect(ed.exportHwp).not.toHaveBeenCalled()
    expect(ed.exportHwpx).not.toHaveBeenCalled()
    expect(host.commitSave).not.toHaveBeenCalled()
  })

  it('reports a save that could not carry master pages or memos over', async () => {
    const ed = editor()
    const host = api(
      { ok: true, path: 'C:/d/a.hwp', format: 'hwp' },
      { ok: true, path: 'C:/d/a.hwp', backupPath: 'C:/d/a.hwp.bak', tailsLost: true },
    )
    const outcome = await runSave(ed, host, 'save')
    expect(outcome).toEqual({
      kind: 'saved',
      path: 'C:/d/a.hwp',
      backupPath: 'C:/d/a.hwp.bak',
      tailsLost: true,
    })
    // the file is written: the editor is told so
    expect(ed.notifySaved).toHaveBeenCalledWith('a.hwp')
  })

  it('writes HWP bytes only after the engine read its own output back whole', async () => {
    const ed = editor()
    const host = api({ ok: true, path: 'C:/d/a.hwp', format: 'hwp' })
    const outcome = await runSave(ed, host, 'save')
    expect(outcome).toEqual({ kind: 'saved', path: 'C:/d/a.hwp' })
    expect(ed.exportHwpVerify).toHaveBeenCalledOnce()
    expect(host.commitSave).toHaveBeenCalledWith(HWP, [])
    expect(ed.notifySaved).toHaveBeenCalledWith('a.hwp')
    expect(host.abortSave).not.toHaveBeenCalled()
  })

  it('exports HWPX for an hwpx target and reports the backup the write kept', async () => {
    const ed = editor()
    const host = api(
      { ok: true, path: 'C:\\d\\a.hwpx', format: 'hwpx' },
      { ok: true, path: 'C:\\d\\a.hwpx', backupPath: 'C:\\d\\a.hwpx.bak' },
    )
    const outcome = await runSave(ed, host, 'save')
    expect(outcome).toEqual({
      kind: 'saved',
      path: 'C:\\d\\a.hwpx',
      backupPath: 'C:\\d\\a.hwpx.bak',
    })
    expect(ed.exportHwpx).toHaveBeenCalledOnce()
    expect(ed.exportHwp).not.toHaveBeenCalled()
    expect(ed.exportHwpVerify).not.toHaveBeenCalled()
    expect(ed.notifySaved).toHaveBeenCalledWith('a.hwpx')
  })

  it('writes nothing when the HWP read-back loses pages', async () => {
    const ed = editor({
      exportHwpVerify: vi.fn(async () => ({
        pageCountBefore: 9,
        pageCountAfter: 8,
        recovered: true,
      })),
    })
    const host = api({ ok: true, path: 'C:/d/a.hwp', format: 'hwp' })
    expect(await runSave(ed, host, 'save')).toEqual({ kind: 'failed', reason: 'verify' })
    expect(host.commitSave).not.toHaveBeenCalled()
    expect(host.abortSave).toHaveBeenCalledOnce()
    expect(ed.notifySaved).not.toHaveBeenCalled()
  })

  it('writes nothing when the engine could not reload its output at all', async () => {
    const ed = editor({
      exportHwpVerify: vi.fn(async () => ({
        pageCountBefore: 9,
        pageCountAfter: 9,
        recovered: false,
      })),
    })
    const host = api({ ok: true, path: 'C:/d/a.hwp', format: 'hwp' })
    expect(await runSave(ed, host, 'save')).toEqual({ kind: 'failed', reason: 'verify' })
    expect(host.commitSave).not.toHaveBeenCalled()
  })

  it('releases the pending save when the export throws', async () => {
    const ed = editor({
      exportHwpx: vi.fn(async () => {
        throw new Error('serializer failed')
      }),
    })
    const host = api({ ok: true, path: 'C:/d/a.hwpx', format: 'hwpx' })
    expect(await runSave(ed, host, 'save')).toEqual({
      kind: 'failed',
      reason: 'export',
      detail: 'serializer failed',
    })
    expect(host.abortSave).toHaveBeenCalledOnce()
    expect(host.commitSave).not.toHaveBeenCalled()
  })

  it('never writes a password-protected document, under its own name or a new one', async () => {
    for (const mode of ['save', 'saveAs'] as const) {
      const ed = editor({ isPasswordProtected: vi.fn(async () => true) })
      const host = api({ ok: true, path: 'C:/d/a.hwpx', format: 'hwpx' })
      expect(await runSave(ed, host, mode)).toEqual({ kind: 'failed', reason: 'protected' })
      // no dialog, no export, no write; the waiting main process is released
      expect(host.beginSave).not.toHaveBeenCalled()
      expect(ed.exportHwpx).not.toHaveBeenCalled()
      expect(host.commitSave).not.toHaveBeenCalled()
      expect(host.abortSave).toHaveBeenCalledOnce()
    }
  })

  it('does not write when the editor cannot say whether the document is protected', async () => {
    const ed = editor({
      isPasswordProtected: vi.fn(async () => {
        throw new Error('the editor did not report password protection')
      }),
    })
    const host = api({ ok: true, path: 'C:/d/a.hwp', format: 'hwp' })
    expect(await runSave(ed, host, 'save')).toEqual({
      kind: 'failed',
      reason: 'export',
      detail: 'the editor did not report password protection',
    })
    expect(host.beginSave).not.toHaveBeenCalled()
    expect(host.commitSave).not.toHaveBeenCalled()
    expect(host.abortSave).toHaveBeenCalledOnce()
  })

  it('stops quietly when the Save As dialog is canceled', async () => {
    const ed = editor()
    const host = api({ ok: true, canceled: true })
    expect(await runSave(ed, host, 'saveAs')).toEqual({ kind: 'canceled' })
    expect(ed.exportHwp).not.toHaveBeenCalled()
    expect(ed.exportHwpx).not.toHaveBeenCalled()
    expect(host.commitSave).not.toHaveBeenCalled()
  })

  it('keeps the editor dirty when the write fails', async () => {
    const ed = editor()
    const host = api(
      { ok: true, path: 'C:/d/a.hwp', format: 'hwp' },
      { ok: false, error: 'EACCES: permission denied' },
    )
    expect(await runSave(ed, host, 'save')).toEqual({
      kind: 'failed',
      reason: 'write',
      detail: 'EACCES: permission denied',
    })
    expect(ed.notifySaved).not.toHaveBeenCalled()
  })

  it('still counts as saved when the editor cannot be told', async () => {
    const ed = editor({
      notifySaved: vi.fn(async () => {
        throw new Error('bridge closed')
      }),
    })
    const host = api({ ok: true, path: 'C:/d/a.hwp', format: 'hwp' })
    expect(await runSave(ed, host, 'save')).toEqual({ kind: 'saved', path: 'C:/d/a.hwp' })
  })
})
