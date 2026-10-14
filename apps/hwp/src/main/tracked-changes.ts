import * as CFB from 'cfb'

const SIGNATURE = 'HWP Document File'
/** FileHeader property: the document keeps a record of changes */
const TRACKED = 0x4000

/**
 * Whether an HWP file carries tracked changes: the property in its header, and the second
 * copy of the body (`ViewText`) Hangul keeps for them.
 *
 * Such a document is not saved here. rhwp 0.8.7 reads the copy that still holds the
 * deleted text, as ordinary text, and writes neither the record of changes nor that copy:
 * saved as HWP the file keeps the property without the copy and Hancom Hangul refuses to
 * open it, and saved as HWPX the tracked changes are gone and the deleted text is back in
 * the document. Never throws; a file that cannot be read here is not held back.
 */
export function hasTrackedChanges(file: Uint8Array): boolean {
  try {
    const cfb = CFB.read(Buffer.from(file.buffer, file.byteOffset, file.byteLength), {
      type: 'buffer',
    })
    const header = CFB.find(cfb, '/FileHeader')
    if (!header?.content || header.content.length < 40) return false
    const bytes = Buffer.from(header.content as Uint8Array)
    if (bytes.toString('latin1', 0, SIGNATURE.length) !== SIGNATURE) return false
    if ((bytes.readUInt32LE(36) & TRACKED) === 0) return false
    return cfb.FullPaths.some((path) => /\/ViewText\//i.test(path))
  } catch {
    return false
  }
}
