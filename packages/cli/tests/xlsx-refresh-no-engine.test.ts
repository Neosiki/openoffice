import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { run, tempDir } from './helpers'

vi.mock('../src/resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/resources')>()),
  xlsxSidecarPath: () => null,
}))

describe('sheet apply without the xlsx engine', () => {
  it('says the formulas that read an edited cell were not refreshed', async () => {
    const dir = tempDir()
    const table = join(dir, 't.json')
    writeFileSync(table, JSON.stringify([[2, '=A1*10']]))
    const out = join(dir, 't.xlsx')
    expect((await run(['create', '--type', 'xlsx', '--from', table, '--out', out])).code).toBe(0)
    const ops = join(dir, 'ops.json')
    writeFileSync(ops, JSON.stringify([{ op: 'set_cell', address: 'A1', value: 5 }]))
    const applied = await run(['sheet', 'apply', out, '--ops', ops, '--json'])
    expect(applied.code).toBe(0)
    expect(JSON.stringify(applied.json())).toContain('dependent_formulas_not_refreshed')
  })

  it('stays quiet when the batch cannot change a value', async () => {
    const dir = tempDir()
    const table = join(dir, 't.json')
    writeFileSync(table, JSON.stringify([[2, '=A1*10']]))
    const out = join(dir, 't.xlsx')
    await run(['create', '--type', 'xlsx', '--from', table, '--out', out])
    const ops = join(dir, 'ops.json')
    writeFileSync(
      ops,
      JSON.stringify([{ op: 'set_col_width', column: 'A', widthPx: 120, count: 1 }]),
    )
    const applied = await run(['sheet', 'apply', out, '--ops', ops, '--json'])
    expect(applied.code).toBe(0)
    expect(JSON.stringify(applied.json())).not.toContain('dependent_formulas_not_refreshed')
  })
})
