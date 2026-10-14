// The bundled template fonts in the sheets editor: listed in the font pickers even
// though the OS enumeration cannot see them, registered on the grid canvas from the
// bundled files, and declared to the PDF export / print page from the same folder.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TEMPLATE_FONT_FAMILY_NAMES, TEMPLATE_FONTS } from '@genoffice/ui/template-fonts'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => resolve(import.meta.dirname, '..'),
  },
}))

import {
  readTemplateFontFile,
  sheetsTemplateFontsDir,
  templateFontFaceCss,
  withTemplateFontFaces,
} from '../src/main/template-fonts'
import { fontFamilyGroups } from '../src/renderer/system-fonts'
import { registerTemplateFonts } from '../src/renderer/template-fonts'
import {
  TEMPLATE_FONT_FACE_REGISTRATIONS,
  TEMPLATE_FONT_FILES,
} from '../src/shared/template-font-faces'
import { registeredCellFontAliases } from '../src/renderer/cell-font-fallback'

const FOLDER = resolve(import.meta.dirname, '../../../packages/ui/template-fonts')

/** what a machine reports when none of the bundled families is installed */
const SYSTEM_WITHOUT_TEMPLATES = [
  'Arial',
  'Calibri',
  'Malgun Gothic',
  'Segoe UI',
  'Times New Roman',
]

describe('font list', () => {
  it('keeps every bundled family in the pickers when the OS does not report it', () => {
    const groups = fontFamilyGroups(SYSTEM_WITHOUT_TEMPLATES, null)
    for (const family of TEMPLATE_FONT_FAMILY_NAMES) expect(groups.common).toContain(family)
    // and still hides a list candidate the machine lacks
    expect(groups.common).not.toContain('Hiragino Sans')
  })

  it('keeps the bundled families out of the system section', () => {
    const groups = fontFamilyGroups([...SYSTEM_WITHOUT_TEMPLATES, 'Pretendard'], null)
    expect(groups.system).not.toContain('Pretendard')
    expect(groups.common.filter((f) => f === 'Pretendard')).toHaveLength(1)
  })
})

describe('template font faces', () => {
  it('registers every bundled face under its family, from its own file', () => {
    for (const { family, faces } of TEMPLATE_FONTS) {
      for (const face of faces) {
        expect(TEMPLATE_FONT_FACE_REGISTRATIONS).toContainEqual(
          expect.objectContaining({ family, file: face.file }),
        )
      }
    }
    for (const file of TEMPLATE_FONT_FILES) expect(existsSync(join(FOLDER, file))).toBe(true)
  })

  it('registers Pretendard SemiBold as Pretendard 600 and as its own Office family', () => {
    const semiBold = TEMPLATE_FONT_FACE_REGISTRATIONS.filter(
      (face) => face.file === 'Pretendard-SemiBold.otf',
    )
    expect(semiBold).toEqual([
      { family: 'Pretendard', file: 'Pretendard-SemiBold.otf', weight: '600' },
      { family: 'Pretendard SemiBold', file: 'Pretendard-SemiBold.otf', weight: '400' },
    ])
  })

  it('registers the variable Playfair Display across its weight range', () => {
    expect(
      TEMPLATE_FONT_FACE_REGISTRATIONS.filter((face) => face.family === 'Playfair Display'),
    ).toEqual([
      { family: 'Playfair Display', file: 'PlayfairDisplay[wght].ttf', weight: '400 900' },
    ])
  })

  it('lets the bundled Playfair Display win over its stand-in alias', () => {
    const aliased = registeredCellFontAliases().map((alias) => alias.family)
    expect(aliased).not.toContain('Playfair Display')
    expect(aliased).toContain('Merriweather')
  })
})

describe('registerTemplateFonts (grid canvas)', () => {
  const created: { family: string; source: unknown; weight: string | undefined }[] = []

  beforeEach(() => {
    created.length = 0
    vi.stubGlobal(
      'FontFace',
      class {
        constructor(family: string, source: unknown, descriptors?: FontFaceDescriptors) {
          created.push({ family, source, weight: descriptors?.weight })
        }
        load() {
          return Promise.resolve(this)
        }
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds a FontFace per registration from the bytes main hands over, reading each file once', async () => {
    const reads: string[] = []
    const added: unknown[] = []
    await registerTemplateFonts(
      async (file) => {
        reads.push(file)
        return new Uint8Array(readFileSync(join(FOLDER, file)))
      },
      { add: (face) => (added.push(face), undefined as never) },
    )
    expect([...reads].sort()).toEqual([...TEMPLATE_FONT_FILES].sort())
    expect(added).toHaveLength(TEMPLATE_FONT_FACE_REGISTRATIONS.length)
    expect(created.map(({ family, weight }) => ({ family, weight }))).toEqual(
      expect.arrayContaining([
        { family: 'Pretendard', weight: '600' },
        { family: 'Pretendard SemiBold', weight: '400' },
        { family: 'Playfair Display', weight: '400 900' },
        { family: 'Gowun Dodum', weight: '400' },
      ]),
    )
    const semiBold = created.filter(({ family, weight }) =>
      family === 'Pretendard SemiBold' ? true : family === 'Pretendard' && weight === '600',
    )
    expect(semiBold).toHaveLength(2)
    expect(semiBold[0]!.source).toBe(semiBold[1]!.source)
  })

  it('keeps the other families when one file cannot be read', async () => {
    await registerTemplateFonts(
      async (file) => {
        if (file === 'BebasNeue-Regular.ttf') throw new Error('gone')
        return new Uint8Array(4)
      },
      { add: () => undefined as never },
    )
    const families = new Set(created.map((face) => face.family))
    expect(families.has('Bebas Neue')).toBe(false)
    expect(families.has('Pretendard')).toBe(true)
  })
})

describe('template font folder (main)', () => {
  it('resolves to the checkout folder in a dev run', () => {
    expect(sheetsTemplateFontsDir()).toBe(FOLDER)
  })

  it('reads a bundled file, brackets in the name included', async () => {
    const bytes = await readTemplateFontFile(FOLDER, 'PlayfairDisplay[wght].ttf')
    expect(bytes.equals(readFileSync(join(FOLDER, 'PlayfairDisplay[wght].ttf')))).toBe(true)
  })

  it('refuses any name outside the bundled list', async () => {
    await expect(readTemplateFontFile(FOLDER, 'README.md')).rejects.toThrow()
    await expect(
      readTemplateFontFile(FOLDER, '../template-fonts/Pretendard-Bold.otf'),
    ).rejects.toThrow()
  })
})

describe('template font faces for PDF export and print', () => {
  it('declares every registration with a file URL into the folder', () => {
    const css = templateFontFaceCss(FOLDER)
    const rules = [
      ...css.matchAll(
        /@font-face \{ font-family: '([^']+)'; src: url\("([^"]+)"\); font-weight: ([^;]+); \}/g,
      ),
    ]
    expect(rules.map(([, family, , weight]) => ({ family, weight }))).toEqual(
      TEMPLATE_FONT_FACE_REGISTRATIONS.map(({ family, weight }) => ({ family, weight })),
    )
    for (const [, , url] of rules) expect(existsSync(fileURLToPath(url!))).toBe(true)
    expect(css).toContain('PlayfairDisplay%5Bwght%5D.ttf')
  })

  it('puts the faces inside the print page head, ahead of its own styles', () => {
    const html =
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>body{}</style></head><body>x</body></html>'
    const out = withTemplateFontFaces(html, FOLDER)
    expect(out.startsWith('<!doctype html><html lang="ko"><head><style>')).toBe(true)
    expect(out.indexOf("font-family: 'Pretendard SemiBold'")).toBeLessThan(out.indexOf('body{}'))
    expect(out.endsWith('<body>x</body></html>')).toBe(true)
  })

  it('keeps a page without a head in standards mode', () => {
    const out = withTemplateFontFaces('<!doctype html><p>x</p>', FOLDER)
    expect(out.startsWith('<!doctype html><style>')).toBe(true)
  })
})
