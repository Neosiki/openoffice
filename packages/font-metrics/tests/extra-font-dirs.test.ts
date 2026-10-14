// Fonts the app ships (the design templates' folder) are not in a system font folder,
// so the caller names their folder; every lookup then sees them beside the installed
// fonts. Without a named folder the index is the system scan alone, as before.
import { closeSync, openSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TEMPLATE_FONTS } from '@genoffice/ui/template-fonts'

import {
  configureExtraFontDirs,
  familyInfoFor,
  familyVerticalMetrics,
  findSystemFont,
  isFamilyInstalled,
} from '../src/index'
import { getFontIndex, readTable, readTableDir } from '../src/sfnt'

const FOLDER = resolve(import.meta.dirname, '../../ui/template-fonts')

afterEach(() => configureExtraFontDirs([]))

/** hhea ascender/descender/lineGap and unitsPerEm read straight from the file */
function hheaOf(file: string) {
  const fd = openSync(join(FOLDER, file), 'r')
  try {
    const tables = readTableDir(fd, 0)!
    const head = readTable(fd, tables, 'head', 512)!
    const hhea = readTable(fd, tables, 'hhea', 512)!
    return {
      unitsPerEm: head.readUInt16BE(18),
      hheaAscender: hhea.readInt16BE(4),
      hheaDescender: hhea.readInt16BE(6),
      hheaLineGap: hhea.readInt16BE(8),
    }
  } finally {
    closeSync(fd)
  }
}

const inFolder = (path: string) => resolve(path).startsWith(FOLDER)

// each configure call rescans the system font folders, slow on a busy machine
describe('configureExtraFontDirs', { timeout: 30_000 }, () => {
  it('finds the vertical metrics of every bundled family once the folder is named', () => {
    const names = TEMPLATE_FONTS.flatMap((f) => [f.family, ...f.faces.map((x) => x.officeFamily)])
    // an installed copy answers first (the folder only fills gaps), and its version's
    // metrics may differ from the shipped file's
    configureExtraFontDirs([])
    const installed = new Set(names.filter((name) => isFamilyInstalled(name)))
    configureExtraFontDirs([FOLDER])
    for (const family of TEMPLATE_FONTS) {
      const officeFamilies = new Set(family.faces.map((f) => f.officeFamily))
      for (const name of new Set([family.family, ...officeFamilies])) {
        // the face a lookup of this name settles on: the regular one, else the only one
        const faces = family.faces.filter((f) => f.officeFamily === name || name === family.family)
        const face = faces.find((f) => f.weight === 400) ?? faces[0]!
        const m = familyVerticalMetrics(name)
        expect(m, name).not.toBeNull()
        if (!installed.has(name)) expect(m).toMatchObject(hheaOf(face.file))
        expect(isFamilyInstalled(name)).toBe(true)
      }
    }
  })

  it('reads a bundled face by its PostScript name, bracketed variable file included', () => {
    configureExtraFontDirs([FOLDER])
    expect(findSystemFont('PlayfairDisplay-Regular', 'Playfair Display')).not.toBeNull()
    expect(findSystemFont('Pretendard-SemiBold', 'Pretendard SemiBold')).not.toBeNull()
  })

  it('gives the pickers the Hangul coverage of the bundled Korean families', async () => {
    configureExtraFontDirs([FOLDER])
    const korean = TEMPLATE_FONTS.filter((f) => f.script === 'korean').map((f) => f.family)
    const info = new Map(await familyInfoFor(korean))
    for (const family of korean) expect(info.get(family)?.hangul, family).toBe(true)
  })

  it('indexes only the system folders when no folder is named', () => {
    configureExtraFontDirs([FOLDER])
    expect([...getFontIndex().byPs.values()].some((f) => inFolder(f.path))).toBe(true)
    configureExtraFontDirs([])
    const index = getFontIndex()
    const faces = [...index.byPs.values(), ...[...index.byFamily.values()].flat()]
    expect(faces.some((f) => inFolder(f.path))).toBe(false)
  })
})
