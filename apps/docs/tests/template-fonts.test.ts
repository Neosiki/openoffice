// The design templates' bundled fonts in the Word editor: listed in the font pickers,
// registered under their real names from the one shipped copy (no build asset),
// served by the main process from the template folder, measured with their own
// metrics, and present in every window that prints or exports (the same renderer).
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { LANGS } from '@genoffice/i18n'
import { TEMPLATE_FONTS, TEMPLATE_FONT_FAMILY_NAMES } from '@genoffice/ui/template-fonts'
import { configureExtraFontDirs, familyVerticalMetrics } from '@genoffice/font-metrics'

import { templateFontResponse } from '../src/main/template-font-protocol'
import { templateFontFileOf, templateFontUrl } from '../src/shared/template-fonts'
import { fontFamiliesFor } from '../src/renderer/font-list'
import { checkMissingFonts } from '../src/renderer/font-check'
import {
  cssFontFamily,
  isFontAvailable,
  isTemplateFontFamily,
  lineHeightFactor,
  noteTemplateFontFamilies,
} from '../src/renderer/line-metrics'
import { familiesForInfo } from '../src/renderer/system-fonts'
import {
  TEMPLATE_LINE_FACTORS,
  registerTemplateFonts,
  templateFontFaceSpecs,
} from '../src/renderer/template-fonts'

const DOCS = resolve(import.meta.dirname, '..')
const FOLDER = resolve(DOCS, '../../packages/ui/template-fonts')
const FILES = TEMPLATE_FONTS.flatMap((f) => f.faces.map((face) => face.file))
const OFFICE_FAMILIES = [
  ...new Set(TEMPLATE_FONTS.flatMap((f) => [f.family, ...f.faces.map((x) => x.officeFamily)])),
]

class FakeFace {
  constructor(
    readonly family: string,
    readonly source: string,
    readonly descriptors: FontFaceDescriptors,
  ) {}
}

function register() {
  const added: FakeFace[] = []
  const families = registerTemplateFonts(
    { add: (face: FontFace) => added.push(face as unknown as FakeFace) },
    FakeFace as unknown as typeof FontFace,
  )
  return { added, families }
}

/** hhea total (ascender - descender + lineGap) over unitsPerEm, read from the file */
function hheaBox(path: string): number {
  const b = readFileSync(path)
  const table = (tag: string) => {
    for (let i = 0; i < b.readUInt16BE(4); i++) {
      const at = 12 + 16 * i
      if (b.toString('latin1', at, at + 4) === tag) return b.readUInt32BE(at + 8)
    }
    throw new Error(`${path} lacks ${tag}`)
  }
  const head = table('head')
  const hhea = table('hhea')
  const box = b.readInt16BE(hhea + 4) - b.readInt16BE(hhea + 6) + b.readInt16BE(hhea + 8)
  return box / b.readUInt16BE(head + 18)
}

/** the file a registered face's `url("…")` source loads */
const fileOfSource = (source: string) => templateFontFileOf(/^url\("(.+)"\)$/.exec(source)![1]!)

afterAll(() => noteTemplateFontFamilies([]))

describe('template fonts in the font list', () => {
  it('lists every bundled family in every UI language, whatever the OS reports', () => {
    for (const lang of LANGS) {
      const list = fontFamiliesFor(lang)
      for (const family of TEMPLATE_FONT_FAMILY_NAMES) expect(list, lang).toContain(family)
    }
  })

  it('asks the main process about the bundled families too (Hangul coverage, Korean name)', () => {
    expect(familiesForInfo([])).toEqual(expect.arrayContaining([...TEMPLATE_FONT_FAMILY_NAMES]))
    const asked = familiesForInfo(['Arial', 'Pretendard'])
    expect(asked.slice(0, 2)).toEqual(['Arial', 'Pretendard'])
    expect(asked.filter((f) => f === 'Pretendard')).toHaveLength(1)
  })
})

describe('template font URLs', () => {
  it('names every listed file and maps the URL back to it, the bracketed file included', () => {
    for (const file of FILES) expect(templateFontFileOf(templateFontUrl(file))).toBe(file)
    expect(templateFontUrl('PlayfairDisplay[wght].ttf')).toContain('PlayfairDisplay%5Bwght%5D.ttf')
    expect(templateFontFileOf(templateFontUrl('PlayfairDisplay[wght].ttf'))).toBe(
      'PlayfairDisplay[wght].ttf',
    )
  })

  it('refuses unlisted names, other hosts and lazy-media URLs', () => {
    expect(templateFontFileOf(templateFontUrl('README.md'))).toBeNull()
    expect(templateFontFileOf(templateFontUrl('../../package.json'))).toBeNull()
    expect(templateFontFileOf('genoffice-docx-media://template-fonts/..%2F..%2Fpackage.json')).toBe(
      null,
    )
    expect(templateFontFileOf(`genoffice-docx-media://${'a'.repeat(64)}/word/media/a.png`)).toBe(
      null,
    )
    expect(templateFontFileOf('genoffice-app://template-fonts/BebasNeue-Regular.ttf')).toBeNull()
    expect(templateFontFileOf('not a url')).toBeNull()
  })

  it('serves the shipped bytes from the template folder, with CORS for the dev origin', async () => {
    const file = 'BebasNeue-Regular.ttf'
    const res = await templateFontResponse(templateFontUrl(file), FOLDER)
    expect(res?.status).toBe(200)
    expect(res?.headers.get('Content-Type')).toBe('font/ttf')
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = new Uint8Array(await res!.arrayBuffer())
    expect(Buffer.from(body).equals(readFileSync(join(FOLDER, file)))).toBe(true)
    const otf = await templateFontResponse(templateFontUrl('Pretendard-SemiBold.otf'), FOLDER)
    expect(otf?.headers.get('Content-Type')).toBe('font/otf')
  })

  it('answers 404 when the folder lacks the file and leaves other URLs alone', async () => {
    const missing = await templateFontResponse(
      templateFontUrl('BebasNeue-Regular.ttf'),
      join(FOLDER, 'no-such-folder'),
    )
    expect(missing?.status).toBe(404)
    expect(await templateFontResponse('genoffice-docx-media://handoff/x', FOLDER)).toBeNull()
  })

  it('the renderer page may load fonts from the media scheme', () => {
    const html = readFileSync(join(DOCS, 'src/renderer/index.html'), 'utf8')
    const fontSrc = /font-src ([^;"]+)/.exec(html)?.[1] ?? ''
    expect(fontSrc.split(/\s+/)).toContain('genoffice-docx-media:')
  })
})

describe('template font registration', () => {
  it('registers every face from its shipped file under its real family', () => {
    const { added, families } = register()
    expect(added).toHaveLength(templateFontFaceSpecs().length)
    for (const face of added) expect(FILES).toContain(fileOfSource(face.source))
    for (const family of TEMPLATE_FONTS) {
      for (const f of family.faces) {
        const own = added.find(
          (x) => x.family === family.family && fileOfSource(x.source) === f.file,
        )
        expect(own, f.file).toBeDefined()
      }
    }
    expect(families.sort()).toEqual([...OFFICE_FAMILIES].sort())
  })

  it('registers Pretendard SemiBold at 600 in Pretendard and as its own Office family', () => {
    const { added } = register()
    const semi = added.filter((x) => fileOfSource(x.source) === 'Pretendard-SemiBold.otf')
    expect(semi.map((x) => [x.family, x.descriptors.weight])).toEqual([
      ['Pretendard', '600'],
      ['Pretendard SemiBold', '400'],
    ])
  })

  it('registers the variable Playfair Display file over its weight range', () => {
    const { added } = register()
    const playfair = added.filter((x) => x.family === 'Playfair Display')
    expect(playfair).toHaveLength(1)
    expect(fileOfSource(playfair[0]!.source)).toBe('PlayfairDisplay[wght].ttf')
    expect(playfair[0]!.descriptors.weight).toBe('400 900')
  })

  it('heads each family chain with the registered face, not a substitute', () => {
    const { added } = register()
    for (const family of OFFICE_FAMILIES) {
      const head = cssFontFamily(family).split(',')[0]!.replace(/^'|'$/g, '')
      expect(head, family).toBe(family)
      expect(added.some((x) => x.family === head)).toBe(true)
      expect(isTemplateFontFamily(family)).toBe(true)
      expect(isFontAvailable(family)).toBe(true)
    }
    // a declared Noto Serif KR renders real now: no theme-Latin substitution ahead of it
    expect(cssFontFamily('Noto Serif KR')).not.toContain('KR Theme Latin GO')
  })

  it('does not report a registered family as missing', () => {
    register()
    expect(checkMissingFonts([...OFFICE_FAMILIES])).toEqual([])
  })

  it('does nothing without a font loading API', () => {
    expect(registerTemplateFonts(undefined, undefined)).toEqual([])
  })
})

describe('template font metrics', () => {
  afterAll(() => configureExtraFontDirs([]))

  it('font-metrics reads every bundled family from the folder it is given', () => {
    configureExtraFontDirs([FOLDER])
    for (const family of OFFICE_FAMILIES)
      expect(familyVerticalMetrics(family), family).not.toBe(null)
  })

  it('lays each family out with the line box of its own shipped file', () => {
    register()
    for (const family of OFFICE_FAMILIES) {
      const owner = TEMPLATE_FONTS.find(
        (f) => f.family === family || f.faces.some((x) => x.officeFamily === family),
      )!
      const faces = owner.faces.filter((x) => x.officeFamily === family || owner.family === family)
      const file = (faces.find((x) => x.weight === 400) ?? faces[0]!).file
      const hhea = hheaBox(join(FOLDER, file))
      const korean = owner.script === 'korean'
      const expected = Math.round(hhea * (korean ? 1.3 : 1) * 1e4) / 1e4
      expect(TEMPLATE_LINE_FACTORS[family], family).toBe(expected)
      expect(lineHeightFactor(family), family).toBe(expected)
    }
  })

  it('leaves the line factors alone while the faces are not registered', () => {
    noteTemplateFontFamilies([])
    expect(lineHeightFactor('Gowun Batang')).toBe(1.3029)
    expect(lineHeightFactor('Pretendard')).toBe(1.172)
  })
})

describe('template fonts in print and export', () => {
  it('registers the faces when the renderer starts, before the app renders', () => {
    // print and PDF export run in the editor's own renderer, and the headless export
    // window loads the same page, so this one registration covers all three
    const main = readFileSync(join(DOCS, 'src/renderer/main.tsx'), 'utf8')
    const at = main.indexOf('registerTemplateFonts()')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(main.indexOf('createRoot('))
  })

  it('serves the folder from the docs media scheme the shell and standalone hosts register', () => {
    const docsMain = readFileSync(join(DOCS, 'src/main/docs-main.ts'), 'utf8')
    expect(docsMain).toMatch(/configureExtraFontDirs\(\[\s*\w+/)
    expect(docsMain).toMatch(/registerLazyMediaProtocol\(\s*\w+/)
  })
})
