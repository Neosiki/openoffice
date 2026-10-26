import { readFileSync, writeFileSync } from 'node:fs'
import JSZip from 'jszip'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { legacyCsvCharset } from '../src/formats/csv'
import { run, tempDir } from './helpers'

// "품목,금액\n라떼,5000\n" as Korean Excel saves CSV: code page 949, no BOM
const CP949 = new Uint8Array([
  199, 176, 184, 241, 44, 177, 221, 190, 215, 10, 182, 243, 182, 188, 44, 53, 48, 48, 48, 10,
])

describe('CSV in the legacy charset of the machine', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('picks the charset from GENOFFICE_LANG, then the locale variables', () => {
    expect(legacyCsvCharset({ GENOFFICE_LANG: 'ko' })).toBe('euc-kr')
    expect(legacyCsvCharset({ LANG: 'ko_KR.UTF-8' })).toBe('euc-kr')
    expect(legacyCsvCharset({ LC_ALL: 'ja_JP.UTF-8', LANG: 'ko_KR.UTF-8' })).toBe('shift_jis')
    expect(legacyCsvCharset({ GENOFFICE_LANG: 'zh' })).toBe('gb18030')
    expect(legacyCsvCharset({ GENOFFICE_LANG: 'en' })).toBeUndefined()
  })

  it('reads a Korean Excel CSV as Korean on a Korean machine', async () => {
    vi.stubEnv('GENOFFICE_LANG', 'ko')
    const dir = tempDir()
    const csv = join(dir, 'menu.csv')
    writeFileSync(csv, CP949)
    const conv = await run(['convert', csv, '--to', 'xlsx', '--json'])
    expect(conv.code).toBe(0)
    // the workbook is checked as XML: reading it back needs the Rust xlsx engine
    const zip = await JSZip.loadAsync(readFileSync(conv.json().output_path))
    const xml = Object.keys(zip.files)
      .filter((name) => name.startsWith('xl/') && name.endsWith('.xml'))
      .map((name) => zip.file(name)!.async('string'))
    const text = (await Promise.all(xml)).join('')
    for (const word of ['품목', '금액', '라떼']) expect(text).toContain(word)
  })
})
