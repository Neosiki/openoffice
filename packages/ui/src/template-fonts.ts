/**
 * The one font set the slide, document and sheet design templates share.
 *
 * The files live in packages/ui/template-fonts/ (outside src/, so no editor build
 * imports them as an asset) and ship once in the installer as resources/template-fonts
 * (apps/shell/electron-builder.cjs); main-process code finds the folder through
 * templateFontsDir in @genoffice/electron-utils/template-fonts-dir. Every file is the
 * distributor's own, unmodified: no subsetting, no renaming, so the family a document
 * stores is the one a machine with the real font installed resolves. The folder holds
 * only these files, each family's license text and README.md, which records the
 * license evidence and the downloaded versions.
 *
 * Plain data with no Node or DOM imports: renderer and main-process code both read it.
 */

export type TemplateFontScript = 'korean' | 'latin'

export interface TemplateFontFace {
  /** file name in the folder, exactly as the distributor names it */
  readonly file: string
  /** OS/2 weight class: the face's weight, or a variable file's default instance */
  readonly weight: number
  /** the wght range of a variable file; absent for a static face */
  readonly variableWeight?: { readonly min: number; readonly max: number }
  /**
   * The face's family (name ID 1): the name Office lists the face under and stores in
   * a document. It equals the family for regular and bold faces; a face outside the
   * regular/bold pair is its own family there (`Pretendard SemiBold`).
   */
  readonly officeFamily: string
}

export interface TemplateFontFamily {
  /** the family exactly as the font's name table states it (typographic family, else family) */
  readonly family: string
  readonly script: TemplateFontScript
  readonly faces: readonly TemplateFontFace[]
  /** SPDX identifier, confirmed from the distributor's license file */
  readonly license: 'OFL-1.1'
  /** the license text shipped in the folder */
  readonly licenseFile: string
  /** the distributor's license file that was read */
  readonly licenseUrl: string
  /** the original distributor */
  readonly distributorUrl: string
  /** the exact source of the files: the distributor's tree at the downloaded commit or tag */
  readonly sourceUrl: string
  /** the version the files report (name ID 5) */
  readonly version: string
  /** the day the files were downloaded (ISO date) */
  readonly downloaded: string
}

/** The readme beside the font files: font, license, distributor, version and date. */
export const TEMPLATE_FONTS_README = 'README.md'

/**
 * Budget for the font files together (raw bytes). The installer compresses them, so its
 * growth is smaller still; the budget bounds what lands on disk. Tune it here.
 */
export const TEMPLATE_FONTS_MAX_BYTES = 45 * 1024 * 1024

const DOWNLOADED = '2026-10-14'
const GOOGLE_FONTS = 'https://github.com/google/fonts'
const GOOGLE_FONTS_COMMIT = '66928797f271fed5ee428544e7229685e2d90127'
const googleFonts = (dir: string) => ({
  distributorUrl: `${GOOGLE_FONTS}/tree/main/ofl/${dir}`,
  sourceUrl: `${GOOGLE_FONTS}/tree/${GOOGLE_FONTS_COMMIT}/ofl/${dir}`,
  licenseUrl: `${GOOGLE_FONTS}/blob/${GOOGLE_FONTS_COMMIT}/ofl/${dir}/OFL.txt`,
})

export const TEMPLATE_FONTS: readonly TemplateFontFamily[] = [
  {
    family: 'Pretendard',
    script: 'korean',
    faces: [
      { file: 'Pretendard-Regular.otf', weight: 400, officeFamily: 'Pretendard' },
      { file: 'Pretendard-SemiBold.otf', weight: 600, officeFamily: 'Pretendard SemiBold' },
      { file: 'Pretendard-Bold.otf', weight: 700, officeFamily: 'Pretendard' },
    ],
    license: 'OFL-1.1',
    licenseFile: 'Pretendard-OFL.txt',
    licenseUrl:
      'https://github.com/orioncactus/pretendard/blob/v1.3.9/packages/pretendard/dist/LICENSE.txt',
    distributorUrl: 'https://github.com/orioncactus/pretendard',
    sourceUrl:
      'https://github.com/orioncactus/pretendard/tree/v1.3.9/packages/pretendard/dist/public/static',
    version: '1.309',
    downloaded: DOWNLOADED,
  },
  {
    family: 'Noto Serif KR',
    script: 'korean',
    faces: [
      { file: 'NotoSerifKR-Regular.otf', weight: 400, officeFamily: 'Noto Serif KR' },
      { file: 'NotoSerifKR-Bold.otf', weight: 700, officeFamily: 'Noto Serif KR' },
    ],
    license: 'OFL-1.1',
    licenseFile: 'NotoSerifKR-OFL.txt',
    licenseUrl:
      'https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Serif/LICENSE',
    distributorUrl: 'https://github.com/notofonts/noto-cjk',
    sourceUrl:
      'https://github.com/notofonts/noto-cjk/tree/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Serif/SubsetOTF/KR',
    version: '2.003',
    downloaded: DOWNLOADED,
  },
  {
    family: 'Black Han Sans',
    script: 'korean',
    faces: [{ file: 'BlackHanSans-Regular.ttf', weight: 400, officeFamily: 'Black Han Sans' }],
    license: 'OFL-1.1',
    licenseFile: 'BlackHanSans-OFL.txt',
    ...googleFonts('blackhansans'),
    version: '1.001',
    downloaded: DOWNLOADED,
  },
  {
    family: 'Do Hyeon',
    script: 'korean',
    faces: [{ file: 'DoHyeon-Regular.ttf', weight: 400, officeFamily: 'Do Hyeon' }],
    license: 'OFL-1.1',
    licenseFile: 'DoHyeon-OFL.txt',
    ...googleFonts('dohyeon'),
    version: '1.001',
    downloaded: DOWNLOADED,
  },
  {
    // the distributor publishes a Regular only
    family: 'Gowun Dodum',
    script: 'korean',
    faces: [{ file: 'GowunDodum-Regular.ttf', weight: 400, officeFamily: 'Gowun Dodum' }],
    license: 'OFL-1.1',
    licenseFile: 'GowunDodum-OFL.txt',
    licenseUrl:
      'https://github.com/yangheeryu/Gowun-Dodum/blob/6d9ef10fc745cf3b0a4aba02dad1c740f94d029b/OFL.txt',
    distributorUrl: 'https://github.com/yangheeryu/Gowun-Dodum',
    sourceUrl:
      'https://github.com/yangheeryu/Gowun-Dodum/tree/6d9ef10fc745cf3b0a4aba02dad1c740f94d029b/fonts/ttf',
    version: '2.000',
    downloaded: DOWNLOADED,
  },
  {
    family: 'Gowun Batang',
    script: 'korean',
    faces: [
      { file: 'GowunBatang-Regular.ttf', weight: 400, officeFamily: 'Gowun Batang' },
      { file: 'GowunBatang-Bold.ttf', weight: 700, officeFamily: 'Gowun Batang' },
    ],
    license: 'OFL-1.1',
    licenseFile: 'GowunBatang-OFL.txt',
    licenseUrl:
      'https://github.com/yangheeryu/Gowun-Batang/blob/4e73f5a9a004927220354f4b68a4c720da538147/OFL.txt',
    distributorUrl: 'https://github.com/yangheeryu/Gowun-Batang',
    sourceUrl:
      'https://github.com/yangheeryu/Gowun-Batang/tree/4e73f5a9a004927220354f4b68a4c720da538147/fonts/ttf',
    version: '2.000',
    downloaded: DOWNLOADED,
  },
  {
    family: 'Bebas Neue',
    script: 'latin',
    faces: [{ file: 'BebasNeue-Regular.ttf', weight: 400, officeFamily: 'Bebas Neue' }],
    license: 'OFL-1.1',
    licenseFile: 'BebasNeue-OFL.txt',
    ...googleFonts('bebasneue'),
    version: '2.000',
    downloaded: DOWNLOADED,
  },
  {
    family: 'Space Grotesk',
    script: 'latin',
    faces: [{ file: 'SpaceGrotesk-Bold.ttf', weight: 700, officeFamily: 'Space Grotesk' }],
    license: 'OFL-1.1',
    licenseFile: 'SpaceGrotesk-OFL.txt',
    licenseUrl:
      'https://github.com/floriankarsten/space-grotesk/blob/03507d024a01282884232081fc6011c09ff4e849/OFL.txt',
    distributorUrl: 'https://github.com/floriankarsten/space-grotesk',
    sourceUrl:
      'https://github.com/floriankarsten/space-grotesk/tree/03507d024a01282884232081fc6011c09ff4e849/fonts/ttf/static',
    version: '2.000',
    downloaded: DOWNLOADED,
  },
  {
    // the distributor ships Playfair Display as a variable font only; Bold is wght 700
    family: 'Playfair Display',
    script: 'latin',
    faces: [
      {
        file: 'PlayfairDisplay[wght].ttf',
        weight: 400,
        variableWeight: { min: 400, max: 900 },
        officeFamily: 'Playfair Display',
      },
    ],
    license: 'OFL-1.1',
    licenseFile: 'PlayfairDisplay-OFL.txt',
    ...googleFonts('playfairdisplay'),
    version: '1.203',
    downloaded: DOWNLOADED,
  },
  {
    family: 'Archivo Black',
    script: 'latin',
    faces: [{ file: 'ArchivoBlack-Regular.ttf', weight: 400, officeFamily: 'Archivo Black' }],
    license: 'OFL-1.1',
    licenseFile: 'ArchivoBlack-OFL.txt',
    ...googleFonts('archivoblack'),
    version: '1.006',
    downloaded: DOWNLOADED,
  },
]

/** The bundled families, e.g. for a picker's `knownAvailable` (the OS enumeration cannot see them). */
export const TEMPLATE_FONT_FAMILY_NAMES: readonly string[] = TEMPLATE_FONTS.map((f) => f.family)
