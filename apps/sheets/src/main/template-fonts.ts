/// The bundled template fonts on the main side: the answer to a renderer's
/// template-font URL (one listed file, read when a face is first used), and the
/// @font-face rules the hidden PDF export / print window needs (it loads the print
/// HTML from a temp file with scripting off, so it only sees fonts the page itself
/// declares). Both read the one installed folder (templateFontsDir); nothing is
/// copied, downloaded or installed into the OS.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { app, protocol } from 'electron'

import { templateFontsDir } from '@genoffice/electron-utils/template-fonts-dir'

import {
  TEMPLATE_FONT_FACE_REGISTRATIONS,
  TEMPLATE_FONT_SCHEME,
  templateFontFileOf,
} from '../shared/template-font-faces'

const FONT_MIME: Readonly<Record<string, string>> = { ttf: 'font/ttf', otf: 'font/otf' }

/// The installed folder (resources/template-fonts), or the checkout's in a dev run.
/// The app path is the shell's when this code runs inside the shell and the sheets
/// app's when it runs alone; both sit two levels below the repo root.
export function sheetsTemplateFontsDir(): string {
  return templateFontsDir({
    isPackaged: app.isPackaged,
    getAppPath: () => app.getAppPath(),
    resourcesPath: process.resourcesPath,
  })
}

/// The answer to a template-font URL: the listed file read from `dir`, or 404 when
/// the folder lacks it (the cell's chain then falls back like for any missing font).
/// Null for every other URL. Only listed names reach the disk, so no path escapes.
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
      // fonts load in CORS mode; the renderer's origin is another scheme (or a dev server)
      'Access-Control-Allow-Origin': '*',
    },
  })
}

/// A standalone sheets app answers the template-font URLs itself (after app ready;
/// registerRendererScheme already made the scheme privileged). Inside the shell the
/// Word editor's main owns this scheme and serves the same files on the same URLs,
/// so the shell must not call this.
export function installStandaloneTemplateFontProtocol(): void {
  const dir = sheetsTemplateFontsDir()
  protocol.handle(TEMPLATE_FONT_SCHEME, async (request) => {
    return (await templateFontResponse(request.url, dir)) ?? new Response(null, { status: 404 })
  })
}

/// The rules name the files by file URL: the export window loads its page from a
/// file URL too, and the browser fetches only the faces the page's text uses.
/// pathToFileURL percent-encodes what a CSS string cannot hold (`"`, brackets,
/// spaces), so the URL sits safely inside url("…").
export function templateFontFaceCss(dir: string): string {
  return TEMPLATE_FONT_FACE_REGISTRATIONS.map(
    ({ family, file, weight }) =>
      `@font-face { font-family: '${family}'; src: url("${pathToFileURL(join(dir, file)).href}"); font-weight: ${weight}; }`,
  ).join('\n')
}

/** The print HTML with the bundled faces declared ahead of its own styles. */
export function withTemplateFontFaces(html: string, dir: string): string {
  const style = `<style>\n${templateFontFaceCss(dir)}\n</style>`
  // after <head>, else after the doctype (a style ahead of it would switch the page to quirks mode)
  const anchor = /<head\b[^>]*>/i.exec(html) ?? /^\s*<!doctype[^>]*>/i.exec(html)
  const at = anchor ? anchor.index + anchor[0].length : 0
  return html.slice(0, at) + style + html.slice(at)
}
