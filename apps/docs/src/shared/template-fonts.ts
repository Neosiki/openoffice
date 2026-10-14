/**
 * Where the Word editor's renderer loads the design templates' bundled fonts from.
 * The files ship once in the installer (resources/template-fonts) and are never
 * build assets: the renderer names them by URL on docs' secure media scheme and the
 * main process serves exactly the listed files out of the folder (templateFontsDir).
 */
import { LAZY_MEDIA_SCHEME } from '@genoffice/docx-engine/lazy-media'
import { TEMPLATE_FONTS } from '@genoffice/ui/template-fonts'

/** the URL host the template fonts are served under (never a 64-hex lazy-media hash) */
export const TEMPLATE_FONT_HOST = 'template-fonts'

const FILES: ReadonlySet<string> = new Set(
  TEMPLATE_FONTS.flatMap((family) => family.faces.map((face) => face.file)),
)

/** the URL of a bundled font file; the name is encoded (`PlayfairDisplay[wght].ttf`) */
export function templateFontUrl(file: string): string {
  return `${LAZY_MEDIA_SCHEME}://${TEMPLATE_FONT_HOST}/${encodeURIComponent(file)}`
}

/** The listed font file a URL names, or null for any other URL (other hosts, unlisted names). */
export function templateFontFileOf(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${LAZY_MEDIA_SCHEME}:` || parsed.hostname !== TEMPLATE_FONT_HOST) {
    return null
  }
  let name: string
  try {
    name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  } catch {
    return null
  }
  return FILES.has(name) ? name : null
}
