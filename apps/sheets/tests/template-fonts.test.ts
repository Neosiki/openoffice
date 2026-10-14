// The bundled template fonts in the sheets editor: listed in the font pickers even
// though the OS enumeration cannot see them, registered on the grid canvas by URL at
// boot and fetched only when used, served from the one folder (listed files only),
// and declared to the PDF export / print page from the same folder.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import { TEMPLATE_FONT_FAMILY_NAMES, TEMPLATE_FONTS } from '@genoffice/ui/template-fonts'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => resolve(import.meta.dirname, '..'),
  },
  protocol: { handle: () => {} },
}))

import { DOCX_MEDIA_SCHEME_PRIVILEGE } from '@genoffice/electron-utils/renderer-scheme'
import {
  sheetsTemplateFontsDir,
  templateFontFaceCss,
  templateFontResponse,
  withTemplateFontFaces,
} from '../src/main/template-fonts'
import { fontFamilyGroups } from '../src/renderer/system-fonts'
import {
  isTemplateFontFamily,
  loadTemplateFontsFor,
  registerTemplateFonts,
  workbookTemplateFontUses,
} from '../src/renderer/template-fonts'
import {
  TEMPLATE_FONT_FACE_REGISTRATIONS,
  TEMPLATE_FONT_FILES,
  TEMPLATE_FONT_SCHEME,
  templateFontUrl,
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

describe('registerTemplateFonts (grid canvas, at boot)', () => {
  it('registers every face by URL without reading a byte', () => {
    const created: { family: string; source: unknown; weight: string | undefined }[] = []
    const added: unknown[] = []
    const loads = vi.fn()
    class Face {
      constructor(family: string, source: unknown, descriptors: FontFaceDescriptors) {
        created.push({ family, source, weight: descriptors.weight })
      }
      load = loads
    }
    const families = registerTemplateFonts(
      { add: (face: FontFace) => (added.push(face), undefined as never) },
      Face as unknown as typeof FontFace,
    )
    expect(added).toHaveLength(TEMPLATE_FONT_FACE_REGISTRATIONS.length)
    expect(loads).not.toHaveBeenCalled()
    expect(created).toEqual(
      TEMPLATE_FONT_FACE_REGISTRATIONS.map(({ family, file, weight }) => ({
        family,
        source: `url("${templateFontUrl(file)}")`,
        weight,
      })),
    )
    expect(created).toContainEqual({
      family: 'Pretendard SemiBold',
      source: 'url("genoffice-docx-media://template-fonts/Pretendard-SemiBold.otf")',
      weight: '400',
    })
    expect(created).toContainEqual({
      family: 'Playfair Display',
      source: 'url("genoffice-docx-media://template-fonts/PlayfairDisplay%5Bwght%5D.ttf")',
      weight: '400 900',
    })
    expect(families).toEqual(expect.arrayContaining([...TEMPLATE_FONT_FAMILY_NAMES]))
  })
})

const plain = {
  italic: false,
  underline: false,
  strikethrough: false,
  wrapText: false,
  diagonalUp: false,
  diagonalDown: false,
}

describe('loading a face only when it is used', () => {
  it('asks the font set for the bundled families a workbook names, at their weights', async () => {
    const requested: string[] = []
    const fonts = { load: async (font: string) => (requested.push(font), []) }
    const uses = workbookTemplateFontUses({
      styles: [
        { fontFamily: 'Calibri', bold: false, ...plain },
        { fontFamily: 'Pretendard', bold: true, ...plain },
        { fontFamily: 'Gowun Batang', bold: false, ...plain },
      ],
      normalFontName: 'Pretendard SemiBold',
      themeFonts: { major: 'Bebas Neue', minor: 'Calibri' },
    })
    await loadTemplateFontsFor(uses, fonts as unknown as FontFaceSet)
    expect(requested.sort()).toEqual([
      '400 16px "Bebas Neue"',
      '400 16px "Gowun Batang"',
      '400 16px "Pretendard SemiBold"',
      '700 16px "Pretendard"',
    ])
  })

  it('loads nothing for a workbook without bundled families', async () => {
    const load = vi.fn()
    const uses = workbookTemplateFontUses({
      styles: [{ fontFamily: 'Calibri', bold: true, ...plain }],
    })
    await loadTemplateFontsFor(uses, { load } as unknown as FontFaceSet)
    expect(load).not.toHaveBeenCalled()
  })

  it('counts the bundled families as available before they load', () => {
    expect(isTemplateFontFamily('"Gowun Dodum"')).toBe(true)
    expect(isTemplateFontFamily('pretendard semibold')).toBe(true)
    expect(isTemplateFontFamily('Calibri')).toBe(false)
  })
})

describe('serving the bundled files (main)', () => {
  it('resolves the folder to the checkout in a dev run', () => {
    expect(sheetsTemplateFontsDir()).toBe(FOLDER)
  })

  it('reads a file only when its URL is requested, brackets in the name included', async () => {
    const read = vi.fn((path: string) => Promise.resolve(new Uint8Array(readFileSync(path))))
    const url = templateFontUrl('PlayfairDisplay[wght].ttf')
    expect(read).not.toHaveBeenCalled()
    const response = await templateFontResponse(url, FOLDER, read)
    expect(read).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledWith(join(FOLDER, 'PlayfairDisplay[wght].ttf'))
    expect(response!.status).toBe(200)
    expect(response!.headers.get('Content-Type')).toBe('font/ttf')
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const bytes = Buffer.from(await response!.arrayBuffer())
    expect(bytes.equals(readFileSync(join(FOLDER, 'PlayfairDisplay[wght].ttf')))).toBe(true)
  })

  it('serves only the listed files', async () => {
    const read = vi.fn(() => Promise.resolve(new Uint8Array(4)))
    const urls = [
      'genoffice-docx-media://template-fonts/README.md',
      'genoffice-docx-media://template-fonts/Pretendard-OFL.txt',
      'genoffice-docx-media://template-fonts/..%2F..%2Fpackage.json',
      'genoffice-docx-media://template-fonts/%2E%2E/README.md',
      `genoffice-docx-media://${'a'.repeat(64)}/Pretendard-Bold.otf`,
      'genoffice-app://template-fonts/Pretendard-Bold.otf',
      'not a url',
    ]
    for (const url of urls) expect(await templateFontResponse(url, FOLDER, read)).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('answers 404 when the folder lacks a listed file', async () => {
    const url = templateFontUrl('Pretendard-Bold.otf')
    const response = await templateFontResponse(url, FOLDER, () =>
      Promise.reject(new Error('missing')),
    )
    expect(response!.status).toBe(404)
  })

  it('names files on the URLs the Word editor serves them on inside the shell', async () => {
    // the shell's docs main owns the media scheme; sheets asks it for the same URLs
    // (imported by a computed path: the docs module is outside this app's typecheck)
    const docsProtocol = pathToFileURL(
      resolve(import.meta.dirname, '../../docs/src/main/template-font-protocol.ts'),
    ).href
    const docs = (await import(/* @vite-ignore */ docsProtocol)) as {
      templateFontResponse(url: string, dir: string): Promise<Response | null>
    }
    for (const file of TEMPLATE_FONT_FILES) {
      const response = await docs.templateFontResponse(templateFontUrl(file), FOLDER)
      expect(response?.status, file).toBe(200)
    }
    expect(TEMPLATE_FONT_SCHEME).toBe(DOCX_MEDIA_SCHEME_PRIVILEGE.scheme)
  })

  it('lets the sheets page load fonts from that scheme', () => {
    const html = readFileSync(resolve(import.meta.dirname, '../src/renderer/index.html'), 'utf8')
    const fontSrc = /font-src ([^;"]+)/.exec(html)?.[1] ?? ''
    expect(fontSrc.split(/\s+/)).toContain(`${TEMPLATE_FONT_SCHEME}:`)
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
