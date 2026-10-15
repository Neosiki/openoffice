/**
 * The styles of a new ODT made from a docx: the document defaults
 * (`w:docDefaults` → `style:default-style`), one common paragraph style per
 * docx paragraph style (its resolved look; the default style is `Standard`),
 * and one page layout and master page per distinct page setup.
 *
 * Page geometry follows the page layer's mapping in reverse: ODF (and
 * Hancom) put the header inside the top margin, so
 *   fo:margin-top = w:header, header height = w:top − w:header
 * (the bottom likewise), and a page without a header keeps w:top as margin.
 */
import type {
  DocDefaults,
  ParaFormat,
  ParsedDoc,
  SectionSettings,
  StyleDisplay,
  TabStop,
} from '@genoffice/docx-engine'
import { PrefixMap, escapeXmlAttr } from '../../core/xml'
import { twipsToLength } from '../../page/geometry'
import { numFmtToOdf } from '../../text/lists'
import {
  type AttrOverrides,
  type TextFormat,
  paraKeys,
  paraOverrides,
  textKeys,
  textOverrides,
} from '../../text/props'
import { editStyleXml, newStyleXml } from '../../text/style-xml'

const IDENTITY = new PrefixMap()

/** Font families used by the styles (declared as font faces). */
export class FontSet {
  readonly families = new Set<string>()
  face = (family: string): string => {
    this.families.add(family)
    return family
  }
  decls(): string {
    return [...this.families]
      .map(
        (f) =>
          `<style:font-face style:name="${escapeXmlAttr(f)}" svg:font-family="${escapeXmlAttr(/\s/.test(f) ? `'${f}'` : f)}"/>`,
      )
      .join('')
  }
}

/** Paragraph properties of a format, every value it states written out. */
export function paragraphProps(format: ParaFormat): { attrs: AttrOverrides; tabs?: string } {
  const keys = paraKeys(format)
  const set = (Object.keys(keys) as Array<keyof typeof keys>).filter((k) => {
    const v = keys[k]
    return v !== null && v !== false
  })
  if (format.spaceBefore === 0 && !set.includes('spaceBefore')) set.push('spaceBefore')
  const empty = paraKeys({})
  const { attrs, tabStops } = paraOverrides(set, format, format.indentLeft ?? 0, empty)
  const out: AttrOverrides = {}
  for (const [k, v] of Object.entries(attrs)) if (v !== null) out[k] = v
  return { attrs: out, ...(tabStops ? { tabs: tabStops } : {}) }
}

/** Text properties of a format, every value it states written out. */
export function textProps(format: TextFormat, fonts: FontSet): AttrOverrides {
  const keys = textKeys(format)
  const set = (Object.keys(keys) as Array<keyof typeof keys>).filter((k) => {
    const v = keys[k]
    return v !== null && v !== false
  })
  const attrs = textOverrides(set, keys, fonts.face)
  const out: AttrOverrides = {}
  for (const [k, v] of Object.entries(attrs)) if (v !== null) out[k] = v
  // an explicit "not bold" / "not italic" of a style overrides its parent's
  if (format.bold === false) Object.assign(out, trio('font-weight', 'normal'))
  if (format.italic === false) Object.assign(out, trio('font-style', 'normal'))
  return out
}

const trio = (base: string, value: string): AttrOverrides => ({
  [`fo:${base}`]: value,
  [`style:${base}-asian`]: value,
  [`style:${base}-complex`]: value,
})

function paraFormatOf(d: StyleDisplay): ParaFormat {
  const f: ParaFormat = {}
  if (d.align) f.align = d.align
  if (d.indentLeftTwips !== undefined) f.indentLeft = d.indentLeftTwips
  if (d.indentRightTwips !== undefined) f.indentRight = d.indentRightTwips
  if (d.indentFirstLineTwips !== undefined) f.indentFirstLine = d.indentFirstLineTwips
  if (d.spaceBeforeTwips !== undefined) f.spaceBefore = d.spaceBeforeTwips
  if (d.spaceAfterTwips !== undefined) f.spaceAfter = d.spaceAfterTwips
  if (d.lineRule === 'exact' || d.lineRule === 'atLeast') {
    if (d.lineRawTwips) {
      f.lineRule = d.lineRule
      f.lineRawTwips = d.lineRawTwips
    }
  } else if (d.lineSpacing) {
    f.lineRule = 'auto'
    f.lineSpacing = d.lineSpacing
  }
  if (d.keepNext) f.keepNext = true
  if (d.keepLines) f.keepLines = true
  if (d.pageBreakBefore) f.pageBreakBefore = true
  if (d.shadingFill && d.shadingFill !== 'auto') f.shadingFill = d.shadingFill
  if (d.tabStops?.length) f.tabStops = d.tabStops.filter((t: TabStop) => !t.rel)
  return f
}

function textFormatOf(d: {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  sizeHalfPoints?: number
  font?: string
  fontAscii?: string
  eastAsiaFont?: string
  csFont?: string
  charSpacingTwips?: number
  caps?: 'all' | 'small' | 'none'
  shading?: string
}): TextFormat {
  const f: TextFormat = {}
  if (d.bold !== undefined) f.bold = d.bold
  if (d.italic !== undefined) f.italic = d.italic
  if (d.underline) f.underline = true
  if (d.strike) f.strike = true
  if (d.color && d.color !== 'auto') f.color = d.color
  if (d.sizeHalfPoints) f.sizeHalfPoints = d.sizeHalfPoints
  const latin = d.fontAscii ?? d.font
  if (latin) f.fontAscii = latin
  if (d.eastAsiaFont) f.eastAsiaFont = d.eastAsiaFont
  if (d.eastAsiaFont ?? d.font) f.font = d.eastAsiaFont ?? d.font
  if (d.csFont) f.fontCs = d.csFont
  if (d.charSpacingTwips) f.charSpacingTwips = d.charSpacingTwips
  if (d.caps && d.caps !== 'none') f.caps = d.caps
  if (d.shading) f.shading = d.shading
  return f
}

function styleXml(
  name: string,
  family: string,
  extra: AttrOverrides,
  para: { attrs: AttrOverrides; tabs?: string } | null,
  text: AttrOverrides | null,
  element = 'style:style',
): string {
  const props: Record<string, AttrOverrides> = {}
  if (para && (Object.keys(para.attrs).length || para.tabs))
    props['style:paragraph-properties'] = para.attrs
  if (text && Object.keys(text).length) props['style:text-properties'] = text
  let base = newStyleXml(name, family, null)
  if (element !== 'style:style') base = `<${element} style:family="${family}"></${element}>`
  return editStyleXml(base, IDENTITY, {
    attrs: extra,
    props,
    ...(para?.tabs ? { tabStops: para.tabs } : {}),
  })
}

const LANG = (tag: string | undefined, suffix: '' | '-asian' | '-complex'): AttrOverrides => {
  if (!tag) return {}
  const [language, country] = tag.split('-')
  const out: AttrOverrides = {}
  const lk = suffix ? `style:language${suffix}` : 'fo:language'
  const ck = suffix ? `style:country${suffix}` : 'fo:country'
  if (language) out[lk] = language.toLowerCase()
  if (country) out[ck] = country.toUpperCase()
  return out
}

/** `style:default-style` for paragraphs from the docx document defaults. */
export function defaultStyleXml(defaults: DocDefaults | undefined, fonts: FontSet): string {
  const d = defaults ?? {}
  const format: ParaFormat = {}
  if (d.lineRule === 'exact' || d.lineRule === 'atLeast') {
    if (d.lineRawTwips) {
      format.lineRule = d.lineRule
      format.lineRawTwips = d.lineRawTwips
    }
  } else if (d.lineSpacing) {
    format.lineRule = 'auto'
    format.lineSpacing = d.lineSpacing
  }
  format.spaceBefore = d.spaceBeforeTwips ?? 0
  format.spaceAfter = d.spaceAfterTwips ?? 0
  const para = paragraphProps(format)
  if (!para.attrs['fo:line-height'] && !para.attrs['style:line-height-at-least'])
    para.attrs['fo:line-height'] = '100%'
  const text = textProps(
    textFormatOf({
      bold: d.bold,
      italic: d.italic,
      color: d.color,
      // Word's built-in default when no size is stated
      sizeHalfPoints: d.sizeHalfPoints ?? 20,
      // Word's built-in Latin face when the document names none
      fontAscii: d.asciiFont ?? 'Times New Roman',
      eastAsiaFont: d.eastAsiaFont,
      csFont: d.csFont,
    }),
    fonts,
  )
  Object.assign(text, LANG(d.lang, ''), LANG(d.eastAsiaLang, '-asian'))
  return styleXml('', 'paragraph', {}, para, text, 'style:default-style')
}

/** Common paragraph styles: docx style id → ODF style name. */
export interface ParagraphStyles {
  xml: string
  names: Map<string, string>
  /** the ODF name of the docx default paragraph style */
  base: string
}

const ncName = (id: string, taken: Set<string>): string => {
  let base = id.replace(/[^A-Za-z0-9_.-]/g, '_')
  if (!/^[A-Za-z_]/.test(base)) base = `S_${base}`
  let name = base
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}_${n}`
  taken.add(name.toLowerCase())
  return name
}

export function paragraphStylesXml(parsed: ParsedDoc, fonts: FontSet): ParagraphStyles {
  const names = new Map<string, string>()
  const taken = new Set<string>(['standard'])
  let out = ''
  const styles = [...parsed.styles.values()].filter((s) => s.type === 'paragraph')
  const def = styles.find((s) => s.isDefault) ?? styles.find((s) => s.styleId === 'Normal')
  const write = (styleId: string, name: string, display: string | null) => {
    const info = parsed.styles.get(styleId)
    const d = info?.display ?? {}
    const extra: AttrOverrides = { 'style:class': 'text' }
    if (display && display !== name) extra['style:display-name'] = display
    if (info?.headingLevel) extra['style:default-outline-level'] = String(info.headingLevel)
    out += styleXml(
      name,
      'paragraph',
      extra,
      paragraphProps(paraFormatOf(d)),
      textProps(textFormatOf(d), fonts),
    )
    names.set(styleId, name)
  }
  if (def) write(def.styleId, 'Standard', def.name && def.name !== 'Normal' ? def.name : null)
  else out += '<style:style style:name="Standard" style:family="paragraph" style:class="text"/>'
  for (const s of styles) {
    if (s === def) continue
    const display = s.name ? s.name.replace(/^heading (\d)$/, 'Heading $1') : s.styleId
    write(s.styleId, ncName(s.styleId, taken), display)
  }
  return { xml: out, names, base: 'Standard' }
}

// ---------------------------------------------------------------------------
// Pages

/** What one master page needs. */
export interface MasterSpec {
  name: string
  layoutName: string
  settings: SectionSettings
  header: boolean
  footer: boolean
  /** region name → inner XML placeholder (filled later) */
  regions: Array<
    'header' | 'header-left' | 'header-first' | 'footer' | 'footer-left' | 'footer-first'
  >
  numFormat: string | null
  mirrored: boolean
}

export function pageLayoutXml(spec: MasterSpec): string {
  const s = spec.settings
  const len = (twips: number) => twipsToLength(Math.max(0, twips))
  const left = s.marginLeft + (s.gutterAtTop ? 0 : (s.gutter ?? 0))
  const top = s.marginTop + (s.gutterAtTop ? (s.gutter ?? 0) : 0)
  const headerDist = Math.min(s.headerDist ?? top, top)
  const footerDist = Math.min(s.footerDist ?? s.marginBottom, s.marginBottom)
  const page: Record<string, string> = {
    'fo:page-width': len(s.pageWidth),
    'fo:page-height': len(s.pageHeight),
    'style:print-orientation': s.orientation,
    'fo:margin-top': len(spec.header ? headerDist : top),
    'fo:margin-bottom': len(spec.footer ? footerDist : s.marginBottom),
    'fo:margin-left': len(left),
    'fo:margin-right': len(s.marginRight),
  }
  if (spec.numFormat) page['style:num-format'] = numFmtToOdf(spec.numFormat)
  const attrs = Object.entries(page)
    .map(([k, v]) => ` ${k}="${escapeXmlAttr(v)}"`)
    .join('')
  // the band height is what remains of the docx edge after the written margin, so
  // margin + height reads back as the exact docx value
  const band = (
    present: boolean,
    edge: number,
    margin: string,
    spacing: 'fo:margin-bottom' | 'fo:margin-top',
  ) => {
    if (!present) return ''
    const height = Math.max(0, (edge * 2.54) / 1440 - parseFloat(margin))
    return `<style:header-footer-properties svg:height="${height.toFixed(4)}cm" ${spacing}="0cm"/>`
  }
  return (
    `<style:page-layout style:name="${escapeXmlAttr(spec.layoutName)}"${spec.mirrored ? ' style:page-usage="mirrored"' : ''}>` +
    `<style:page-layout-properties${attrs}/>` +
    `<style:header-style>${band(spec.header, top, page['fo:margin-top'], 'fo:margin-bottom')}</style:header-style>` +
    `<style:footer-style>${band(spec.footer, s.marginBottom, page['fo:margin-bottom'], 'fo:margin-top')}</style:footer-style>` +
    '</style:page-layout>'
  )
}

export function masterPageXml(spec: MasterSpec): string {
  const regions = spec.regions.map((r) => `<style:${r}/>`).join('')
  return `<style:master-page style:name="${escapeXmlAttr(spec.name)}" style:page-layout-name="${escapeXmlAttr(spec.layoutName)}">${regions}</style:master-page>`
}
