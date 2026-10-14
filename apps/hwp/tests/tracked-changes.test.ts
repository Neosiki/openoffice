/**
 * Telling an HWP file with tracked changes from one without: the header property and the
 * second copy of the body, on files built from a document the real engine exports.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import * as CFB from 'cfb'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'
import { hasTrackedChanges } from '../src/main/tracked-changes'

const require = createRequire(import.meta.url)

beforeAll(async () => {
  const wasm = join(dirname(require.resolve('@rhwp/core')), 'rhwp_bg.wasm')
  await init({ module_or_path: readFileSync(wasm) })
})

function exported(): Uint8Array {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  doc.insertText(0, 0, 0, '본문')
  const bytes = doc.exportHwp()
  doc.free()
  return bytes
}

/** The file with the tracked-changes property set and/or a view copy of the body added. */
function variant(
  file: Uint8Array,
  options: { property?: boolean; viewCopy?: boolean },
): Uint8Array {
  const cfb = CFB.read(Buffer.from(file), { type: 'buffer' })
  if (options.property) {
    const header = Buffer.from(CFB.find(cfb, '/FileHeader')!.content as Uint8Array)
    header.writeUInt32LE(header.readUInt32LE(36) | 0x4000, 36)
    CFB.utils.cfb_add(cfb, '/FileHeader', header)
  }
  if (options.viewCopy) {
    const body = Buffer.from(CFB.find(cfb, '/BodyText/Section0')!.content as Uint8Array)
    CFB.utils.cfb_add(cfb, '/ViewText/Section0', body)
  }
  return new Uint8Array(CFB.write(cfb, { type: 'buffer' }) as Buffer)
}

describe('hasTrackedChanges', () => {
  it('is false for an ordinary document', () => {
    expect(hasTrackedChanges(exported())).toBe(false)
  })

  it('is true when the header says so and the view copy of the body is there', () => {
    expect(hasTrackedChanges(variant(exported(), { property: true, viewCopy: true }))).toBe(true)
  })

  it('takes both: the property alone or the copy alone is not it', () => {
    expect(hasTrackedChanges(variant(exported(), { property: true }))).toBe(false)
    expect(hasTrackedChanges(variant(exported(), { viewCopy: true }))).toBe(false)
  })

  it('is false for bytes that are not an HWP file', () => {
    expect(hasTrackedChanges(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false)
    expect(hasTrackedChanges(new Uint8Array(0))).toBe(false)
  })
})
