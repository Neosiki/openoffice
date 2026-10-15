/**
 * docx → new ODT (`docxToOdt`): the package is standard, the result re-reads
 * (through `odtToDocx`) with the same paragraphs, text, tables, drawables,
 * notes, page geometry, headers and document defaults as the source, objects
 * become pictures (rendered, fallback, or a label box) and the report lists
 * what changed.
 */
import { parseDocx } from '@genoffice/docx-engine'
import { describe, expect, it } from 'vitest'
import { docxToOdt, odtToDocx, odtToText } from '../src'
import { openOdt, readOdtPackage } from '../src/core'
import { textOf } from './helpers/api'
import { buildDocx, chartRun, p, sectPr, shapeRun } from './helpers/build-docx'
import { kitchenSink, TOC } from './helpers/docx-fixtures'
import { signature } from './helpers/docx-signature'
import { PNG_1X1 } from './helpers/hancom-sample'
import { PNG_GREY } from './helpers/objects-fixtures'

async function convert(spec: Parameters<typeof buildDocx>[0], options = {}) {
  const docx = await buildDocx(spec)
  const { odtBytes, report } = await docxToOdt(docx, options)
  const back = await odtToDocx(odtBytes)
  return {
    docx,
    odtBytes,
    report,
    source: await parseDocx(docx),
    reread: await parseDocx(back.docxBytes),
    pkg: await readOdtPackage(odtBytes),
  }
}

const byFeature = (report: Array<{ kind: string; feature: string; count: number }>) =>
  Object.fromEntries(report.map((r) => [`${r.kind}:${r.feature}`, r.count]))

describe('docxToOdt: the package', () => {
  it('is standard: mimetype first and stored, ODF 1.3, every entry in the manifest', async () => {
    const { pkg, odtBytes } = await convert(kitchenSink())
    expect(pkg.mimetypeFirst).toBe(true)
    expect(pkg.mimetypeStored).toBe(true)
    for (const part of ['content.xml', 'styles.xml', 'meta.xml'])
      expect(textOf(pkg, part)).toMatch(/office:version="1\.3"/)
    const manifest = textOf(pkg, 'META-INF/manifest.xml')
    expect(manifest).toContain('manifest:version="1.3"')
    for (const e of pkg.entries) {
      if (e.name === 'mimetype' || e.name === 'META-INF/manifest.xml') continue
      expect(manifest).toContain(`manifest:full-path="${e.name}"`)
    }
    // it opens as a received ODT
    const doc = await openOdt(odtBytes)
    expect(doc.officeVersion).toBe('1.3')
  })
})

describe('docxToOdt: faithful content', () => {
  it('re-reads with the same paragraphs, text, tables, drawables, notes and pages', async () => {
    const spec = kitchenSink()
    spec.body = TOC + spec.body
    const { source, reread } = await convert(spec)
    const a = signature(source)
    const b = signature(reread)
    expect(b.paragraphs).toBe(a.paragraphs)
    expect(b.text).toBe(a.text.replace('지운', ''))
    expect(b.tables).toEqual(a.tables)
    expect(b.drawables).toBe(a.drawables)
    expect(b.notes).toEqual(a.notes)
    expect(b.pages).toEqual(a.pages)
    expect(b.headers).toEqual(a.headers)
    expect(b.defaults).toEqual(a.defaults)
  })

  it('keeps headings, lists, links, styles and character formatting', async () => {
    const spec = kitchenSink()
    spec.body =
      p('제목', '<w:pStyle w:val="Heading1"/>') +
      '<w:p><w:hyperlink r:id="rIdLink"><w:r><w:t>링크</w:t></w:r></w:hyperlink></w:p>' +
      p(
        '빨강 큰 글',
        '<w:jc w:val="center"/><w:spacing w:line="360" w:lineRule="auto"/>',
        '<w:color w:val="FF0000"/><w:sz w:val="28"/><w:i/>',
      ) +
      sectPr()
    spec.extra = [
      {
        rId: 'rIdLink',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        path: 'word/unused.xml',
        data: '<x/>',
        contentType: 'application/xml',
      },
    ]
    const { reread } = await convert(spec)
    const blocks = reread.blocks.filter((b) => !b.hidden)
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    const heading = reread.styles.get(blocks[0].styleId as string)?.display
    expect(heading).toMatchObject({ sizeHalfPoints: 32, bold: true, fontAscii: 'Arial' })
    const run = blocks[2].runs?.[0]
    expect(run).toMatchObject({
      text: '빨강 큰 글',
      color: 'FF0000',
      sizeHalfPoints: 28,
      italic: true,
    })
    expect(blocks[2].format).toMatchObject({ align: 'center', lineSpacing: 1.5 })
  })

  it('writes each page section with its own master page and header', async () => {
    const { pkg } = await convert(kitchenSink())
    const styles = textOf(pkg, 'styles.xml')
    const content = textOf(pkg, 'content.xml')
    expect(styles).toMatch(
      /<style:master-page style:name="Standard"[^>]*><style:header><text:p[^>]*>머리글 하나/,
    )
    expect(styles).toMatch(
      /<style:master-page style:name="MP2"[^>]*><style:header><text:p[^>]*>머리글 둘/,
    )
    expect(styles).toMatch(/style:print-orientation="landscape"/)
    // the second section starts at its heading
    const heading = /<text:h text:style-name="([^"]+)"[^>]*>둘째 구역/.exec(content)?.[1]
    expect(content).toMatch(new RegExp(`style:name="${heading}"[^>]*style:master-page-name="MP2"`))
  })

  it('keeps the header distance and the top margin apart (geometry)', async () => {
    const body =
      p('본문') +
      '<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="3540" w:right="1440" w:bottom="1440" w:left="1440" w:header="3660" w:footer="720" w:gutter="0"/></w:sectPr>'
    const { reread, pkg } = await convert({
      body,
      parts: { rIdH: { kind: 'header', inner: p('머리') } },
    })
    const styles = textOf(pkg, 'styles.xml')
    expect(styles).toContain('fo:margin-top="6.244cm"')
    const s = reread.blocks.length ? signature(reread).pages[0] : ''
    expect(s.split(',').slice(3, 4)).toEqual(['3540'])
  })

  it('folds continuous sections into the page run and reports columns', async () => {
    const body =
      p('하나') +
      `<w:p><w:pPr>${sectPr('<w:type w:val="continuous"/>')}</w:pPr><w:r><w:t>둘</w:t></w:r></w:p>` +
      p('셋') +
      sectPr('<w:type w:val="continuous"/><w:cols w:num="2" w:space="720"/>')
    const { report, reread } = await convert({ body })
    expect(byFeature(report)['converted:columns']).toBe(1)
    expect(signature(reread).pages.length).toBe(1)
  })
})

describe('docxToOdt: objects become pictures', () => {
  it('uses the fallback picture when there is one, else a label box', async () => {
    const spec = {
      body:
        `<w:p>${shapeRun(1270000, 635000, 'rIdFallback')}</w:p>` +
        `<w:p>${shapeRun(1270000, 635000, null, 21)}</w:p>` +
        `<w:p>${chartRun(2743200, 1371600)}</w:p>` +
        sectPr(),
      media: { rIdFallback: { name: 'fallback.png', data: PNG_GREY } },
    }
    const { pkg, report } = await convert(spec)
    const content = textOf(pkg, 'content.xml')
    const frames = content.match(/<draw:frame\b[\s\S]*?<\/draw:frame>/g) ?? []
    expect(frames.length).toBe(3)
    expect(frames[0]).toMatch(/<draw:image xlink:href="Pictures\/io_1\.png"/)
    expect(frames[0]).toMatch(/svg:width="3\.528cm" svg:height="1\.764cm"/)
    expect(frames[1]).toMatch(/<draw:text-box><text:p[^>]*>Shape<\/text:p>/)
    expect(frames[2]).toMatch(/<draw:text-box><text:p[^>]*>Chart<\/text:p>/)
    expect(pkg.get('Pictures/io_1.png')?.bytes).toEqual(PNG_GREY)
    expect(byFeature(report)).toMatchObject({ 'converted:shape': 2, 'converted:chart': 1 })
  })

  it('uses the pictures the editor rendered', async () => {
    const spec = {
      body: `<w:p>${chartRun(2743200, 1371600)}</w:p><w:p><w:r><w:t>식 </w:t></w:r><m:oMath><m:r><m:t>x</m:t></m:r></m:oMath></w:p>${sectPr()}`,
    }
    const { pkg } = await convert(spec, {
      renderedObjects: {
        '0': { png: PNG_GREY, widthEmu: 1800000, heightEmu: 900000 },
        '1:0': { png: PNG_1X1, widthEmu: 360000, heightEmu: 180000 },
      },
    })
    const content = textOf(pkg, 'content.xml')
    expect(content).not.toContain('<draw:text-box>')
    expect(content).toMatch(/svg:width="5(?:\.0+)?cm" svg:height="2\.50*cm"/)
    // (the run's trailing space is not preserved in this docx: no xml:space)
    expect(content).toMatch(/식<draw:frame[^>]*svg:width="1(?:\.0+)?cm"/)
    expect(pkg.entries.filter((e) => e.name.startsWith('Pictures/')).length).toBe(2)
  })
})

describe('docxToOdt: report', () => {
  it('lists converted and dropped features', async () => {
    const spec = kitchenSink()
    spec.body = TOC + spec.body
    spec.settings = '<w:mirrorMargins/>'
    const { report } = await convert(spec)
    expect(byFeature(report)).toMatchObject({
      'converted:toc': 1,
      'converted:chart': 1,
      'converted:equation': 2,
      'converted:shape': 2,
      'converted:mirror_margins': 1,
      'dropped:revision': 2,
    })
    for (const r of report) expect(r.count).toBeGreaterThan(0)
  })

  it('reports comments as dropped', async () => {
    const body =
      '<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>메모 달린 글</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>' +
      sectPr()
    const spec = {
      body,
      extra: [
        {
          rId: 'rIdComments',
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
          path: 'word/comments.xml',
          data: '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="a"><w:p><w:r><w:t>메모</w:t></w:r></w:p></w:comment></w:comments>',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
        },
      ],
    }
    const { report, odtBytes } = await convert(spec)
    expect(byFeature(report)['dropped:comment']).toBe(1)
    expect(await odtToText(odtBytes)).toBe('메모 달린 글')
  })
})
