import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { templateFontFileOf } from '../shared/template-fonts'

const FONT_MIME: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf' }

/**
 * The answer to a template-font URL (shared/template-fonts.ts): the listed file read
 * from `dir`, or 404 when the folder lacks it (the renderer's chain then falls back
 * like for any missing font). Null for every other URL, which the media scheme's other
 * handlers own. Only listed file names reach the disk, so no path escapes `dir`.
 */
export async function templateFontResponse(
  url: string,
  dir: string,
  read: (path: string) => Promise<Uint8Array> = readFile,
): Promise<Response | null> {
  const file = templateFontFileOf(url)
  if (!file) return null
  let bytes: Uint8Array
  try {
    bytes = await read(join(dir, file))
  } catch {
    return new Response(null, { status: 404 })
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': FONT_MIME[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'font/sfnt',
      'Content-Length': String(bytes.byteLength),
      // fonts load in CORS mode; the dev renderer is an http://localhost origin
      'Access-Control-Allow-Origin': '*',
    },
  })
}
