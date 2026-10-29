import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { csvTable, isoDateSerial } from '../src/formats/xlsx'
import { run, tempDir } from './helpers'
import { cells, part } from './xlsx-helpers'

describe('CSV dates around the 1900 leap-day discontinuity', () => {
  it.each([
    ['1900-01-01', 1],
    ['1900-01-31', 31],
    ['1900-02-01', 32],
    ['1900-02-28', 59],
    ['1900-01-01 12:00', 1.5],
    ['1900-02-28T23:59:59', 59 + 86399 / 86400],
    ['1900-03-01', 61],
    ['1900-03-01 06:00', 61.25],
    ['2000-02-29', 36585],
    ['2024-01-01', 45292],
  ])('maps %s to serial %s', (date, expected) => {
    expect(isoDateSerial(date)?.serial).toBeCloseTo(expected, 10)
  })
  it.each(['1900-02-29', '1900-02-30', '2023-02-29', '1900-01-01 24:00', 'not a date'])(
    'retains invalid date text %s',
    (text) => {
      expect(isoDateSerial(text)).toBeUndefined()
      expect(csvTable(Buffer.from(text), 'Data').rows).toEqual([[text]])
    },
  )
  it('writes early and modern date serials with their original date/time formats', async () => {
    const dir = tempDir()
    const source = join(dir, 'dates.csv')
    const text = '1900-01-01,1900-02-28 12:00:00,1900-03-01,2024-01-01'
    writeFileSync(source, text)
    const out = join(dir, 'dates.xlsx')
    const result = await run(['create', '--type', 'xlsx', '--from', source, '--out', out, '--json'])
    expect(result.code).toBe(0)
    const actual = await cells(out, 'xl/worksheets/sheet1.xml')
    expect([...actual.values()].map((cell) => cell.value)).toEqual([1, 59.5, 61, 45292])
    expect(await part(out, 'xl/styles.xml')).toContain('yyyy-mm-dd hh:mm:ss')
    expect(await part(out, 'xl/styles.xml')).toContain('yyyy-mm-dd')
    expect(readFileSync(source, 'utf-8')).toBe(text)
  })
})
