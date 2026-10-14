/// Bundled template fonts on the grid canvas. Main reads each file from the one
/// installed folder and hands the bytes over; here they become document FontFaces.
/// Canvas fillText never triggers a font load and Univer measures a cell once, so
/// main.tsx registers these before the first skeleton, like the Carlito aliases.

import { TEMPLATE_FONT_FACE_REGISTRATIONS } from '../shared/template-font-faces'

export type ReadTemplateFontFile = (file: string) => Promise<Uint8Array<ArrayBuffer>>

/// Each file is read once (Pretendard SemiBold backs two families). A file that
/// cannot be read or parsed leaves its families on the fallback chain; the rest
/// still register.
export async function registerTemplateFonts(
  read: ReadTemplateFontFile,
  fonts: Pick<FontFaceSet, 'add'> = document.fonts,
): Promise<void> {
  const files = new Map<string, Promise<Uint8Array<ArrayBuffer> | null>>()
  const bytesOf = (file: string) => {
    let pending = files.get(file)
    if (!pending) {
      pending = read(file).catch(() => null)
      files.set(file, pending)
    }
    return pending
  }
  await Promise.all(
    TEMPLATE_FONT_FACE_REGISTRATIONS.map(async ({ family, file, weight }) => {
      const bytes = await bytesOf(file)
      if (!bytes) return
      try {
        const face = new FontFace(family, bytes, { weight })
        fonts.add(face)
        await face.load()
      } catch {
        /* unparseable file: the family keeps its fallback chain */
      }
    }),
  )
}
