/**
 * The patched rhwp engine in vendor/rhwp-core (decision 0045), run in node like
 * the editor runs it. Each case is a public reproduction saved by Hangul 2024
 * (its text replaced by filler): the page layout must keep the relations Hangul
 * draws, not pixel positions. The title-table-then-inline-table case is the
 * first reproduction with its inline table moved into the next paragraph. Both
 * title-table files then lost two white labels that stripping the pictures had
 * left invisible on white paper (rhwp's hidden-text check flagged them).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'

const require = createRequire(import.meta.url)
const CORE = dirname(require.resolve('@rhwp/core'))

beforeAll(async () => {
  await init({ module_or_path: readFileSync(join(CORE, 'rhwp_bg.wasm')) })
})

interface Node {
  type: string
  pi?: number
  ci?: number
  bbox?: { x: number; y: number; w: number; h: number }
  children?: Node[]
}

interface Box {
  type: string
  pi: number
  ci?: number
  top: number
  bottom: number
}

/** Tables, pictures and body text lines of one page; nothing inside a table. */
function boxes(doc: HwpDocument, page: number): Box[] {
  const out: Box[] = []
  const walk = (node: Node) => {
    const owned = node.pi !== undefined && node.pi < 1e9 && node.bbox
    if (owned && ['Table', 'Image', 'TextLine'].includes(node.type)) {
      out.push({
        type: node.type,
        pi: node.pi!,
        ci: node.ci,
        top: node.bbox!.y,
        bottom: node.bbox!.y + node.bbox!.h,
      })
    }
    if (node.type !== 'Table') for (const child of node.children ?? []) walk(child)
  }
  walk(JSON.parse(doc.getPageRenderTree(page)) as Node)
  return out
}

/** The footnote separator's top and the body text lines' bottoms on one page. */
function footnoteAndBody(doc: HwpDocument, page: number) {
  const root = JSON.parse(doc.getPageRenderTree(page)) as Node
  const area = root.children?.find((child) => child.type === 'FootnoteArea')
  const separator = area?.children?.find((child) => child.type === 'Line')?.bbox?.y
  const bottoms: number[] = []
  const walk = (node: Node) => {
    if (node.type === 'TextLine' && node.bbox) bottoms.push(node.bbox.y + node.bbox.h)
    else if (node.type !== 'Table') for (const child of node.children ?? []) walk(child)
  }
  for (const body of root.children?.filter((child) => child.type === 'Body') ?? []) walk(body)
  return { separator, bottoms }
}

function open(name: string): HwpDocument {
  return new HwpDocument(new Uint8Array(readFileSync(join(__dirname, 'fixtures', name))))
}

describe('vendored rhwp engine', () => {
  it('is the build its manifest records', () => {
    const manifest = JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8'))
    expect(manifest.version).toMatch(/^0\.8\.7-ieum\.\d+$/)
    const wasm = readFileSync(join(CORE, 'rhwp_bg.wasm'))
    expect(createHash('sha256').update(wasm).digest('hex')).toBe(manifest.rhwp.wasmSha256)
  })

  it('puts an inline table below the paper-anchored Square table of the same paragraph', () => {
    // A title table anchored to the paper with Square wrap fills the body
    // width; the paragraph's own treat-as-char table cannot sit beside it, so
    // Hangul puts that line below the title's outer box and continues there.
    const doc = open('paper-square-table-tac-host.hwpx')
    expect(doc.pageCount()).toBe(1)
    const page = boxes(doc, 0)
    const hostTables = page.filter((b) => b.type === 'Table' && b.pi === 0)
    expect(hostTables).toHaveLength(2)
    const [square, inline] = [...hostTables].sort((a, b) => a.top - b.top)
    // the title's outer bottom margin is 4251 HWPUNIT
    expect(inline.top).toBeGreaterThanOrEqual(square.bottom + (4251 * 96) / 7200 - 0.5)

    const after = page.filter((b) => b.pi > 0).sort((a, b) => a.top - b.top)
    expect(after.some((b) => b.type === 'Table')).toBe(true)
    for (const box of after) expect(box.top).toBeGreaterThanOrEqual(inline.bottom - 0.5)
    for (let i = 1; i < after.length; i++) {
      expect(after[i].top).toBeGreaterThanOrEqual(after[i - 1].bottom - 0.5)
    }

    // the page's footnote stays below the body text
    const { separator, bottoms } = footnoteAndBody(doc, 0)
    expect(separator).toBeDefined()
    expect(bottoms.length).toBeGreaterThan(0)
    for (const bottom of bottoms) expect(bottom).toBeLessThanOrEqual(separator! + 0.5)
  })

  it('starts a page below its title table when the first stored line says so', () => {
    // The page opens with a paragraph that holds only the paper-anchored Square
    // title table. Its stored line starts at the title's outer bottom and the
    // next paragraph's treat-as-char table one line lower; Hangul draws both
    // there instead of at the body top, where the table covered the title.
    const doc = open('title-table-then-inline-table.hwpx')
    expect(doc.pageCount()).toBe(1)
    const page = boxes(doc, 0)
    const square = page.find((b) => b.type === 'Table' && b.pi === 0)
    const inline = page.find((b) => b.type === 'Table' && b.pi === 1)
    expect(square).toBeDefined()
    expect(inline).toBeDefined()
    // the title's outer bottom margin (4251) plus the host's stored line (1600), in HWPUNIT
    expect(inline!.top).toBeCloseTo(square!.bottom + ((4251 + 1600) * 96) / 7200, 0)

    const after = page.filter((b) => b.pi > 1).sort((a, b) => a.top - b.top)
    expect(after.length).toBeGreaterThan(0)
    for (const box of after) expect(box.top).toBeGreaterThanOrEqual(inline!.bottom - 0.5)
    for (let i = 1; i < after.length; i++) {
      expect(after[i].top).toBeGreaterThanOrEqual(after[i - 1].bottom - 0.5)
    }
  })

  it('moves a picture after a stored page reset to the next page with its lines', () => {
    // Paragraph 10 restarts its stored line positions at its third line: Hangul
    // breaks the page there, and its Square picture (anchored after that line)
    // goes to the next page instead of being drawn over the first page.
    const doc = open('square-picture-after-page-reset.hwpx')
    expect(doc.pageCount()).toBe(2)
    const [first, second] = [boxes(doc, 0), boxes(doc, 1)]
    const lines = (page: Box[]) => page.filter((b) => b.type === 'TextLine' && b.pi === 10)
    expect(lines(first)).toHaveLength(2)
    expect(lines(second)).toHaveLength(2)
    expect(first.some((b) => b.type === 'Image')).toBe(false)
    const picture = second.filter((b) => b.type === 'Image' && b.pi === 10)
    expect(picture).toHaveLength(1)
    const lastLine = Math.max(...lines(second).map((b) => b.bottom))
    expect(picture[0].top).toBeGreaterThanOrEqual(lastLine - 0.5)
  })
})
