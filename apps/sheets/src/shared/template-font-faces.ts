/// The bundled template fonts as the faces the sheets editor registers. The grid
/// canvas (renderer FontFaces built from the file bytes) and the PDF export / print
/// window (@font-face rules naming the files) both read this one table, so the
/// page prints in the font the grid drew.

import { TEMPLATE_FONTS } from '@genoffice/ui/template-fonts'

export interface TemplateFontFaceRegistration {
  /** the family a cell names (Office's name for the face) */
  readonly family: string
  /** file name in the template font folder */
  readonly file: string
  /** CSS font-weight descriptor: one weight, or a variable file's "min max" range */
  readonly weight: string
}

/// Every face under its family at its own weight. A face Office lists as a family
/// of its own (`Pretendard SemiBold`) is registered there too, as that family's
/// regular face: a cell naming that family draws it, and bold on top is
/// synthesized the way Office does it.
export const TEMPLATE_FONT_FACE_REGISTRATIONS: readonly TemplateFontFaceRegistration[] =
  TEMPLATE_FONTS.flatMap(({ family, faces }) =>
    faces.flatMap((face) => {
      const weight = face.variableWeight
        ? `${face.variableWeight.min} ${face.variableWeight.max}`
        : String(face.weight)
      const own = { family, file: face.file, weight }
      return face.officeFamily === family
        ? [own]
        : [own, { family: face.officeFamily, file: face.file, weight: '400' }]
    }),
  )

/** Each bundled font file once. */
export const TEMPLATE_FONT_FILES: readonly string[] = [
  ...new Set(TEMPLATE_FONT_FACE_REGISTRATIONS.map((face) => face.file)),
]

/** Every family a cell can name and get a bundled face for (lowercase, as CSS matches). */
export const TEMPLATE_FONT_FAMILY_KEYS: ReadonlySet<string> = new Set(
  TEMPLATE_FONT_FACE_REGISTRATIONS.map((face) => face.family.toLowerCase()),
)
