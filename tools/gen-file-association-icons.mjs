/**
 * Generates every file-type icon the app ships, from one drawing defined in
 * this script:
 *
 *   apps/shell/src/renderer/src/assets/file-<type>.svg
 *       the home screen, Drive browser and tab strip icons (imported by
 *       Home.tsx, DriveBrowser.tsx and TabBar.tsx)
 *   apps/shell/build/<type>.ico / <type>.icns
 *       the per-type document icons electron-builder bakes into the OS file
 *       associations (apps/shell/electron-builder.cjs fileAssociations `icon`
 *       field) and that build/installer.nsh points the Open-With ProgIds at
 *   apps/shell/src/main/assets/menu-<type>.png / menu-<type>@2x.png
 *       the native window-menu icons (16 px and its retina copy)
 *   apps/<app>/src/renderer/assets/file-<kind>.png (and the mind map's
 *   src/renderer/ai/assets copy)
 *       the AI panel's attachment-card icons, one identical set per editor
 *
 * The icons form one family, a notebook page: a colored binding spine on the
 * left, joined to the page by link loops (the "ieum", the join, of the
 * product name), and a pictogram of the content in the same color on the
 * page. From 40 px up the page also carries the format's file extension.
 * Formats are told apart by spine color, pictogram and extension, never by a
 * vendor's logo, monogram or signature glyph. The attachment kinds that are
 * not one format (image, video, audio, plain document, unknown file) use the
 * same page with their own pictogram and no extension.
 *
 * Each SVG holds three drawings an embedded media query picks from by the
 * size the image is drawn at (media queries inside an SVG evaluate against
 * its own viewport): below SMALL_MAX_PX a 16 px drawing on whole pixels
 * (spine and pictogram only), up to LABEL_MIN_PX a mid-size drawing with the
 * link loops, and from LABEL_MIN_PX the full drawing with the extension. One
 * file therefore serves the 16 px tab and the 256 px Explorer view alike.
 *
 * The extension text and the Hangul syllable on the HWP icon are converted to
 * outlines from Pretendard Bold (SIL OFL 1.1, packages/ui/template-fonts,
 * listed in NOTICE), so the icons do not depend on the fonts installed where
 * they are shown.
 *
 * Edit the FORMATS / GENERIC tables or the drawing below, never the generated
 * files, then run:
 *   node tools/gen-file-association-icons.mjs
 *
 * Optional: `--preview <file.png>` also writes a contact sheet (every icon at
 * 16/20/24/32/48/64/96/256 px on light and dark backgrounds); `--no-write`
 * skips writing into the repo. The sheet is never part of the repo.
 *
 * The SVG is rasterized with the system Chrome (or Edge) through
 * playwright-core. The ICO and ICNS containers are written by hand (the same
 * container code as tools/gen-brand-assets.mjs), so the script runs on any
 * host OS.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL_FONT = join(root, 'packages/ui/template-fonts/Pretendard-Bold.otf')

// ── the family ──────────────────────────────────────────────────────────────

/**
 * One entry per format icon: the extension shown on the page, the spine and
 * pictogram color, and the pictogram. Formats that share an icon
 * (xlsm/xls/csv/tsv on xlsx, hwpx on hwp, htm on html, markdown on md, odt
 * on docx) are mapped in Home.tsx, DriveBrowser.tsx and electron-builder.cjs.
 * Colors are our own palette, deliberately away from any vendor's brand
 * color.
 */
const FORMATS = {
  docx: { label: 'DOCX', color: '#4757C9', picto: 'paragraphs' }, // indigo
  xlsx: { label: 'XLSX', color: '#11806F', picto: 'grid' }, // teal green
  pptx: { label: 'PPTX', color: '#C26A12', picto: 'screen' }, // amber
  pdf: { label: 'PDF', color: '#B3263E', picto: 'seal' }, // crimson
  hwp: { label: 'HWP', color: '#1179A6', picto: 'syllable' }, // cyan blue
  md: { label: 'MD', color: '#323D4D', picto: 'hash' }, // slate
  html: { label: 'HTML', color: '#8A40BD', picto: 'tag' }, // violet
  mindmap: { label: 'XMIND', color: '#B83A7A', picto: 'branches' }, // berry
  txt: { label: 'TXT', color: '#7A8392', picto: 'lines' }, // gray
  json: { label: 'JSON', color: '#8A6A0C', picto: 'braces' }, // ochre
}

/** Attachment kinds that are not a single format: same page, no extension. */
const GENERIC = {
  image: { color: '#2E8A57', picto: 'picture' },
  video: { color: '#6A4FC4', picto: 'play' },
  voice: { color: '#C0702A', picto: 'wave' },
  document: { color: '#6B7280', picto: 'lines' },
  general: { color: '#8A93A2', picto: 'none' },
}

// Rendered sizes (CSS px) up to SMALL_MAX_PX draw the 16 px drawing; from
// LABEL_MIN_PX the full drawing with the extension; the mid-size one between.
const SMALL_MAX_PX = 23.98
const LABEL_MIN_PX = 40

const PAGE_FILL = '#FFFFFF'
const PAGE_STROKE = '#9AA3AF'
const LINK_FILL = '#FFFFFF'

// ── outputs ─────────────────────────────────────────────────────────────────

const SVG_DIR = 'apps/shell/src/renderer/src/assets'
const BUILD_DIR = 'apps/shell/build'
const MENU_DIR = 'apps/shell/src/main/assets'
const MENU_TYPES = ['docx', 'xlsx', 'pptx', 'pdf', 'md', 'html', 'mindmap', 'hwp']

/** attachment-card file name -> icon key (FORMATS or GENERIC) */
const ATTACHMENT_ICONS = {
  'file-word.png': 'docx',
  'file-excel.png': 'xlsx',
  'file-ppt.png': 'pptx',
  'file-pdf.png': 'pdf',
  'file-image.png': 'image',
  'file-video.png': 'video',
  'file-voice.png': 'voice',
  'file-document.png': 'document',
  'file-general.png': 'general',
}
/** editor asset folder -> the attachment icons that folder carries */
const ATTACHMENT_DIRS = {
  'apps/docs/src/renderer/assets': Object.keys(ATTACHMENT_ICONS),
  'apps/sheets/src/renderer/assets': Object.keys(ATTACHMENT_ICONS),
  'apps/slides/src/renderer/assets': Object.keys(ATTACHMENT_ICONS),
  'apps/html/src/renderer/assets': Object.keys(ATTACHMENT_ICONS),
  'apps/hwp/src/renderer/assets': Object.keys(ATTACHMENT_ICONS).filter(
    (name) => name !== 'file-video.png' && name !== 'file-voice.png',
  ),
  'apps/mindmap/src/renderer/ai/assets': Object.keys(ATTACHMENT_ICONS).filter(
    (name) => name !== 'file-video.png' && name !== 'file-voice.png',
  ),
}
// The cards draw these at 22-26 CSS px; the 48 px bitmap is the 2x copy.
const ATTACHMENT_CSS_PX = 24

const WIN_SIZES = [16, 24, 32, 48, 64, 128, 256]
// macOS icons carry the standard app-icon grid margin (824/1024 content, same
// treatment as build/icon-mac.png) so they sit at the same optical size as
// neighboring icons in Finder. Windows icons are conventionally full-bleed.
const MAC_CONTENT_RATIO = 824 / 1024
// ICNS entries in the order iconutil writes them: [OSType, canvas px, format].
// The two smallest slots must be packed ARGB; the rest are embedded PNGs.
const ICNS_ENTRIES = [
  ['ic12', 64, 'png'],
  ['ic07', 128, 'png'],
  ['ic13', 256, 'png'],
  ['ic08', 256, 'png'],
  ['ic04', 16, 'argb'],
  ['ic14', 512, 'png'],
  ['ic09', 512, 'png'],
  ['ic05', 32, 'argb'],
  ['ic10', 1024, 'png'],
  ['ic11', 32, 'png'],
]

// ── drawing ─────────────────────────────────────────────────────────────────
// 256-unit canvas. The 16 px drawing sits on a 16-unit grid (one pixel at
// 16 px) with the page outline centered half a pixel inside, so the 16 px
// menu and tab icons land on whole pixels.

const num = (value) => Number(value.toFixed(2))

/** Mix a #RRGGBB color toward `target` (0 black, 255 white) by `amount` (0..1). */
function mix(hex, target, amount) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const mixed = channels.map((c) => Math.round(c + (target - c) * amount))
  return `#${mixed
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function roundedRectPath({ left, top, right, bottom, radius: r }) {
  return [
    `M${left + r} ${top}`,
    `H${right - r}`,
    `A${r} ${r} 0 0 1 ${right} ${top + r}`,
    `V${bottom - r}`,
    `A${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H${left + r}`,
    `A${r} ${r} 0 0 1 ${left} ${bottom - r}`,
    `V${top + r}`,
    `A${r} ${r} 0 0 1 ${left + r} ${top}`,
    'Z',
  ].join('')
}

/** The binding spine: the page's left part, following its rounded left corners. */
function spinePath({ left, top, bottom, radius: r, spine }) {
  return [
    `M${left + r} ${top}`,
    `H${spine}`,
    `V${bottom}`,
    `H${left + r}`,
    `A${r} ${r} 0 0 1 ${left} ${bottom - r}`,
    `V${top + r}`,
    `A${r} ${r} 0 0 1 ${left + r} ${top}`,
    'Z',
  ].join('')
}

const font = opentype.parse(readFileSync(LABEL_FONT).buffer)
const LABEL_TRACKING = 0.03

/**
 * The text as one outline path, centered on (cx, cy) by its cap height and
 * scaled down when it would be wider than maxWidth.
 */
function labelPath(text, { cx, cy, capHeight, maxWidth }) {
  const capUnits = font.tables.os2.sCapHeight || font.unitsPerEm * 0.7
  let size = (capHeight * font.unitsPerEm) / capUnits
  const widthAt = (s) =>
    font.getAdvanceWidth(text, s, { kerning: true }) + LABEL_TRACKING * s * (text.length - 1)
  if (widthAt(size) > maxWidth) size *= maxWidth / widthAt(size)
  const cap = (capUnits * size) / font.unitsPerEm
  const glyphs = font.stringToGlyphs(text)
  let x = cx - widthAt(size) / 2
  const baseline = cy + cap / 2
  const parts = []
  glyphs.forEach((glyph, i) => {
    parts.push(glyph.getPath(x, baseline, size).toPathData(2))
    x += (glyph.advanceWidth * size) / font.unitsPerEm + LABEL_TRACKING * size
    if (i < glyphs.length - 1) {
      x += (font.getKerningValue(glyph, glyphs[i + 1]) * size) / font.unitsPerEm
    }
  })
  return parts.join('')
}

/** One character's outline, scaled to fit and centered in a box. */
function fittedGlyphPath(char, { x, y, w, h }) {
  const path = font.getPath(char, 0, 0, 100)
  const box = path.getBoundingBox()
  const scale = Math.min(w / (box.x2 - box.x1), h / (box.y2 - box.y1))
  const left = x + (w - (box.x2 - box.x1) * scale) / 2 - box.x1 * scale
  const top = y + (h - (box.y2 - box.y1) * scale) / 2 - box.y1 * scale
  return {
    d: path.toPathData(2),
    transform: `translate(${num(left)} ${num(top)}) scale(${num(scale)})`,
  }
}

/**
 * The pictogram vocabulary, drawn in box `b` with color `fg` and stroke `sw`;
 * `bg` is the page color under it (for cut-outs). `small` drops detail that
 * cannot survive 16 px.
 */
function pictogram(kind, b, fg, bg, sw, small) {
  const X = (u) => num(b.x + b.w * u)
  const Y = (u) => num(b.y + b.h * u)
  const line = (x1, y1, x2, y2, width = sw) =>
    `<path d="M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}" stroke="${fg}" stroke-width="${num(width)}" stroke-linecap="round"/>`
  const stroke = (d, width = sw) =>
    `<path d="${d}" stroke="${fg}" stroke-width="${num(width)}" stroke-linecap="round" stroke-linejoin="round"/>`
  const rect = (x, y, w, h, r, fill = fg) =>
    `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(r)}" fill="${fill}"/>`
  switch (kind) {
    case 'paragraphs':
      // a heading and body text
      if (small)
        return line(0, 0.1, 0.6, 0.1, sw * 1.4) + line(0, 0.5, 1, 0.5) + line(0, 0.88, 0.78, 0.88)
      return (
        line(0, 0.06, 0.58, 0.06, sw * 1.6) +
        line(0, 0.36, 1, 0.36) +
        line(0, 0.6, 1, 0.6) +
        line(0, 0.84, 0.7, 0.84)
      )
    case 'lines':
      if (small) return line(0, 0.1, 1, 0.1) + line(0, 0.5, 0.66, 0.5) + line(0, 0.9, 1, 0.9)
      return (
        line(0, 0.06, 1, 0.06) +
        line(0, 0.34, 0.8, 0.34) +
        line(0, 0.62, 1, 0.62) +
        line(0, 0.9, 0.48, 0.9)
      )
    case 'grid': {
      // a block of cells
      const cols = small ? [0.5] : [0.36, 0.68]
      const rows = small ? [0.5] : [0.34, 0.67]
      const gap = small ? Math.max(sw * 0.7, 16) : Math.max(sw * 0.55, 7)
      let out = rect(X(0), Y(0), b.w, b.h, sw * 0.6)
      for (const c of cols) out += rect(X(c) - gap / 2, Y(0), gap, b.h, 0, bg)
      for (const r of rows) out += rect(X(0), Y(r) - gap / 2, b.w, gap, 0, bg)
      return out
    }
    case 'screen': {
      // a presentation screen on a stand, with a rising bar chart
      const fh = small ? 0.8 : 0.74
      let out = `<rect x="${num(X(0) + sw / 2)}" y="${num(Y(0) + sw / 2)}" width="${num(b.w - sw)}" height="${num(b.h * fh - sw)}" rx="${num(sw * 0.8)}" stroke="${fg}" stroke-width="${num(sw)}"/>`
      const bars = small
        ? [
            [0.36, 0.5],
            [0.64, 0.3],
          ]
        : [
            [0.3, 0.52],
            [0.5, 0.36],
            [0.7, 0.2],
          ]
      const bw = b.w * (small ? 0.16 : 0.12)
      for (const [cx, top] of bars) {
        const y0 = Y(top * fh) + sw * 0.1
        const y1 = Y(fh) - sw * 1.6
        out += rect(X(cx) - bw / 2, y0, bw, Math.max(y1 - y0, 4), Math.min(bw / 3, 4))
      }
      return (
        out +
        line(0.5, fh, 0.5, 0.98, sw * 0.9) +
        (small ? '' : line(0.34, 0.98, 0.66, 0.98, sw * 0.9))
      )
    }
    case 'seal': {
      // a finished page: text lines and a round seal
      const r = small ? 0.32 : 0.26
      const R = b.w * r
      const cx = X(1) - R
      const cy = Y(1) - R
      const text = small
        ? line(0, 0.1, 1, 0.1) + line(0, 0.42, 0.4, 0.42)
        : line(0, 0.06, 1, 0.06) + line(0, 0.3, 0.84, 0.3) + line(0, 0.54, 0.34, 0.54)
      return (
        text +
        `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(R - sw / 2)}" stroke="${fg}" stroke-width="${num(sw)}"/>` +
        `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(Math.max(R * 0.36, 5))}" fill="${fg}"/>`
      )
    }
    case 'syllable': {
      // a plain Hangul syllable: Korean text, nothing more. At 16 px the font
      // outline turns to a blot, so the two letters are drawn as strokes there.
      if (small) {
        return stroke(
          `M${X(0)} ${Y(0.2)}H${X(0.46)}Q${X(0.46)} ${Y(0.7)} ${X(0.02)} ${Y(0.94)}` +
            `M${X(0.8)} ${Y(0.02)}V${Y(0.98)}M${X(0.8)} ${Y(0.5)}H${X(1)}`,
          sw * 0.85,
        )
      }
      const glyph = fittedGlyphPath('가', b)
      return `<path transform="${glyph.transform}" d="${glyph.d}" fill="${fg}"/>`
    }
    case 'hash':
      return stroke(
        `M${X(0.38)} ${Y(0.02)}L${X(0.28)} ${Y(0.98)}M${X(0.76)} ${Y(0.02)}L${X(0.66)} ${Y(0.98)}` +
          `M${X(0.06)} ${Y(0.32)}H${X(0.98)}M${X(0.02)} ${Y(0.68)}H${X(0.94)}`,
      )
    case 'tag':
      return stroke(
        `M${X(0.28)} ${Y(0.16)}L${X(0.02)} ${Y(0.5)}L${X(0.28)} ${Y(0.84)}M${X(0.72)} ${Y(0.16)}L${X(0.98)} ${Y(0.5)}L${X(0.72)} ${Y(0.84)}` +
          (small ? '' : `M${X(0.58)} ${Y(0.06)}L${X(0.42)} ${Y(0.94)}`),
      )
    case 'braces': {
      const brace = (side) => {
        const bx = (u) => (side < 0 ? X(u) : X(1 - u))
        return (
          `M${bx(0.38)} ${Y(0.04)}C${bx(0.22)} ${Y(0.04)} ${bx(0.22)} ${Y(0.1)} ${bx(0.22)} ${Y(0.2)}V${Y(0.36)}` +
          `C${bx(0.22)} ${Y(0.44)} ${bx(0.16)} ${Y(0.5)} ${bx(0.04)} ${Y(0.5)}C${bx(0.16)} ${Y(0.5)} ${bx(0.22)} ${Y(0.56)} ${bx(0.22)} ${Y(0.64)}` +
          `V${Y(0.8)}C${bx(0.22)} ${Y(0.9)} ${bx(0.22)} ${Y(0.96)} ${bx(0.38)} ${Y(0.96)}`
        )
      }
      return (
        stroke(brace(-1) + brace(1)) +
        (small ? '' : `<circle cx="${X(0.5)}" cy="${Y(0.5)}" r="${num(sw * 0.75)}" fill="${fg}"/>`)
      )
    }
    case 'branches': {
      // a central topic with three branches
      let out = stroke(
        `M${X(0.25)} ${Y(0.5)}C${X(0.5)} ${Y(0.5)} ${X(0.5)} ${Y(0.14)} ${X(0.78)} ${Y(0.14)}` +
          `M${X(0.25)} ${Y(0.5)}H${X(0.78)}M${X(0.25)} ${Y(0.5)}C${X(0.5)} ${Y(0.5)} ${X(0.5)} ${Y(0.86)} ${X(0.78)} ${Y(0.86)}`,
        sw * 0.8,
      )
      out += `<circle cx="${X(0.2)}" cy="${Y(0.5)}" r="${num(b.w * 0.2)}" fill="${fg}"/>`
      for (const y of [0.14, 0.5, 0.86]) {
        out += `<circle cx="${X(0.86)}" cy="${Y(y)}" r="${num(b.w * (small ? 0.13 : 0.105))}" fill="${fg}"/>`
      }
      return out
    }
    case 'picture': {
      // a framed picture: a sun over two hills
      const inset = sw / 2
      return (
        `<rect x="${num(X(0) + inset)}" y="${num(Y(0) + inset)}" width="${num(b.w - sw)}" height="${num(b.h - sw)}" rx="${num(sw * 0.8)}" stroke="${fg}" stroke-width="${num(sw)}"/>` +
        (small
          ? ''
          : `<circle cx="${X(0.32)}" cy="${Y(0.32)}" r="${num(b.h * 0.1)}" fill="${fg}"/>`) +
        `<path d="M${X(0)} ${Y(1)}L${X(0.4)} ${Y(0.5)}L${X(0.62)} ${Y(0.74)}L${X(0.76)} ${Y(0.6)}L${X(1)} ${Y(0.9)}V${Y(1)}Z" fill="${fg}"/>`
      )
    }
    case 'play': {
      // a play triangle in a rounded frame
      const t = Math.min(b.w, b.h) * 0.24
      const cx = X(0.53)
      const cy = Y(0.5)
      return (
        rect(X(0), Y(0.1), b.w, b.h * 0.8, sw * 1.2) +
        `<path d="M${num(cx - t * 0.8)} ${num(cy - t)}L${num(cx + t)} ${num(cy)}L${num(cx - t * 0.8)} ${num(cy + t)}Z" fill="${bg}" stroke="${bg}" stroke-width="${num(sw * 0.5)}" stroke-linejoin="round"/>`
      )
    }
    case 'wave': {
      // a sound wave: rounded bars
      const heights = small ? [0.5, 1, 0.6] : [0.35, 0.75, 1, 0.6, 0.3]
      const step = b.w / heights.length
      const bw = Math.min(step * 0.62, sw * 1.3)
      return heights
        .map((h, i) => {
          const bh = Math.max(bw, b.h * h)
          return rect(X(0) + step * i + (step - bw) / 2, Y(0.5) - bh / 2, bw, bh, bw / 2)
        })
        .join('')
    }
    default:
      return ''
  }
}

/** Geometry of the three drawings. */
const SIZES = {
  // 16 px: the outline covers whole pixels (1..2 and 14..15), the spine
  // ends on a pixel edge; no loops, no text
  small: {
    page: { left: 24, top: 8, right: 232, bottom: 248, radius: 28, spine: 96 },
    stroke: 16,
    picto: { x: 120, y: 56, w: 92, h: 144 },
    generic: { x: 120, y: 72, w: 92, h: 112 },
    pictoStroke: 22,
    links: [],
  },
  // 24-39 px: two link loops join spine and page
  mid: {
    page: { left: 26, top: 12, right: 230, bottom: 244, radius: 24, spine: 82 },
    stroke: 10,
    picto: { x: 116, y: 60, w: 92, h: 136 },
    generic: { x: 116, y: 74, w: 92, h: 108 },
    pictoStroke: 18,
    links: [72, 184],
    linkStroke: 8,
  },
  // 40 px and up: the full drawing with the extension
  large: {
    page: { left: 26, top: 12, right: 230, bottom: 244, radius: 24, spine: 82 },
    stroke: 7,
    picto: { x: 120, y: 48, w: 86, h: 90 },
    generic: { x: 118, y: 72, w: 90, h: 112 },
    pictoStroke: 12,
    links: [80, 176],
    linkStroke: 6,
    label: { cx: 163, cy: 198, capHeight: 28, maxWidth: 86 },
  },
}

function drawing(key, size) {
  const spec = FORMATS[key] ?? GENERIC[key]
  const geometry = SIZES[size]
  const { page } = geometry
  const outline = roundedRectPath(page)
  const box = FORMATS[key] ? geometry.picto : geometry.generic
  let out = `<path d="${outline}" fill="${PAGE_FILL}"/>`
  out += pictogram(spec.picto, box, spec.color, PAGE_FILL, geometry.pictoStroke, size === 'small')
  if (FORMATS[key] && geometry.label) {
    out += `<path d="${labelPath(spec.label, geometry.label)}" fill="${spec.color}"/>`
  }
  out += `<path d="${spinePath(page)}" fill="${spec.color}"/>`
  out += `<path d="${outline}" stroke="${PAGE_STROKE}" stroke-width="${geometry.stroke}" stroke-linejoin="round"/>`
  for (const y of geometry.links) {
    out += `<rect x="${page.spine - 20}" y="${y - 10}" width="40" height="20" rx="10" fill="${LINK_FILL}" stroke="${mix(spec.color, 0, 0.35)}" stroke-width="${geometry.linkStroke}"/>`
  }
  return out
}

function svgFor(key) {
  return [
    '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<!-- generated by tools/gen-file-association-icons.mjs: edit the script, not this file -->',
    '<style>.s,.m{display:none}' +
      `@media (max-width:${SMALL_MAX_PX}px){.l{display:none}.s{display:inline}}` +
      `@media (min-width:${SMALL_MAX_PX + 0.01}px) and (max-width:${LABEL_MIN_PX - 0.02}px){.l{display:none}.m{display:inline}}</style>`,
    `<g class="l">${drawing(key, 'large')}</g>`,
    `<g class="m">${drawing(key, 'mid')}</g>`,
    `<g class="s">${drawing(key, 'small')}</g>`,
    '</svg>',
    '',
  ].join('\n')
}

// ── containers ──────────────────────────────────────────────────────────────

/** ICO container with PNG-compressed entries (supported since Vista). */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(16 * entries.length)
  let offset = header.length + dir.length
  entries.forEach(({ size, png }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o) // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2) // palette
    dir.writeUInt8(0, o + 3) // reserved
    dir.writeUInt16LE(1, o + 4) // planes
    dir.writeUInt16LE(32, o + 6) // bpp
    dir.writeUInt32LE(png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += png.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

/**
 * ICNS run-length coding for one 8-bit channel: a control byte below 128
 * copies the next (n + 1) literal bytes, a control byte of 128 or more repeats
 * the next byte (n - 125) times (runs of 3..130).
 */
function packIcnsChannel(channel) {
  const out = []
  const runLength = (from) => {
    let n = 1
    while (from + n < channel.length && n < 130 && channel[from + n] === channel[from]) n++
    return n
  }
  let i = 0
  while (i < channel.length) {
    const run = runLength(i)
    if (run >= 3) {
      out.push(run + 125, channel[i])
      i += run
      continue
    }
    const start = i
    while (i < channel.length && i - start < 128 && runLength(i) < 3) i++
    out.push(i - start - 1, ...channel.subarray(start, i))
  }
  return Buffer.from(out)
}

/** `ARGB` ICNS payload from straight-alpha RGBA pixels (planar A, R, G, B). */
function buildIcnsArgb(rgba) {
  const pixels = rgba.length / 4
  const planes = [3, 0, 1, 2].map((channelOffset) => {
    const plane = Buffer.alloc(pixels)
    for (let p = 0; p < pixels; p++) plane[p] = rgba[p * 4 + channelOffset]
    return packIcnsChannel(plane)
  })
  return Buffer.concat([Buffer.from('ARGB', 'latin1'), ...planes])
}

function buildIcns(chunks) {
  const parts = chunks.map(({ type, data }) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, 4, 'latin1')
    head.writeUInt32BE(data.length + 8, 4)
    return Buffer.concat([head, data])
  })
  const body = Buffer.concat(parts)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 4, 'latin1')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

// ── rasterizing ─────────────────────────────────────────────────────────────

/** Prefer an installed Chrome, then Edge, then a Playwright-managed Chromium. */
async function launchBrowser() {
  const failures = []
  for (const options of [{ channel: 'chrome' }, { channel: 'msedge' }, {}]) {
    try {
      return await chromium.launch({ ...options, headless: true })
    } catch (error) {
      failures.push(`${options.channel ?? 'bundled chromium'}: ${String(error).split('\n')[0]}`)
    }
  }
  throw new Error(`No Chromium-based browser could be launched:\n  ${failures.join('\n  ')}`)
}

const dataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

/**
 * Lays the SVG out as an <img> of contentSize CSS px, centered on a
 * transparent square of canvasSize CSS px, and screenshots it on a page whose
 * device scale factor sets the output resolution. Laying the image out at its
 * display size is what makes the SVG's media query pick the variant meant
 * for that size; the browser rasterizes the vector at the target resolution.
 * Returns the PNG and its straight-alpha RGBA pixels (for packed ICNS slots).
 */
async function rasterize(page, svg, canvasSize, contentSize) {
  await page.setViewportSize({ width: canvasSize, height: canvasSize })
  await page.setContent(
    `<body style="margin:0;background:transparent"><div style="width:${canvasSize}px;height:${canvasSize}px;display:flex;align-items:center;justify-content:center">` +
      `<img src="${dataUrl(svg)}" width="${contentSize}" height="${contentSize}"></div></body>`,
  )
  await page.locator('img').evaluate((img) => img.decode())
  const png = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: canvasSize, height: canvasSize },
  })
  return { png, rgba: PNG.sync.read(png).data }
}

// ── main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const previewFlag = args.indexOf('--preview')
const previewFile = previewFlag === -1 ? null : args[previewFlag + 1]
if (previewFlag !== -1 && !previewFile) throw new Error('--preview needs an output file path')
const writeRepo = !args.includes('--no-write')

function write(relativePath, data) {
  if (!writeRepo) return
  const target = join(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
  console.log(`wrote ${relativePath}`)
}

/** Contact sheet: every icon at the sizes the app and the OS draw it. */
async function writePreview(page, svgs, outFile) {
  const sizes = [16, 20, 24, 32, 48, 64, 96, 256]
  const row = (key, svg) =>
    `<div style="display:flex;align-items:flex-end;gap:14px;padding:8px 0"><div style="width:72px;font:12px sans-serif">${key}</div>` +
    sizes.map((s) => `<img src="${dataUrl(svg)}" width="${s}" height="${s}">`).join('') +
    '</div>'
  const block = (background, color) =>
    `<div style="background:${background};color:${color};padding:16px 24px">` +
    [...svgs].map(([key, svg]) => row(key, svg)).join('') +
    '</div>'
  await page.setViewportSize({ width: 1500, height: 900 })
  await page.setContent(
    `<body style="margin:0;display:flex">${block('#f3f3f3', '#1f1f1f')}${block('#1e1e1e', '#e8e8e8')}</body>`,
  )
  writeFileSync(outFile, await page.screenshot({ fullPage: true }))
  console.log(`wrote preview ${outFile}`)
}

const svgs = new Map(
  [...Object.keys(FORMATS), ...Object.keys(GENERIC)].map((key) => [key, svgFor(key)]),
)

const browser = await launchBrowser()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  // retina copies: laid out at the display size, rendered at twice the pixels
  const page2x = await browser.newPage({ deviceScaleFactor: 2 })

  for (const key of Object.keys(FORMATS)) {
    const svg = svgs.get(key)
    write(`${SVG_DIR}/file-${key}.svg`, svg)

    const win = []
    for (const size of WIN_SIZES) {
      win.push({ size, png: (await rasterize(page, svg, size, size)).png })
    }
    write(`${BUILD_DIR}/${key}.ico`, buildIco(win))

    const mac = new Map()
    for (const size of new Set(ICNS_ENTRIES.map(([, size]) => size))) {
      mac.set(size, await rasterize(page, svg, size, Math.round(size * MAC_CONTENT_RATIO)))
    }
    write(
      `${BUILD_DIR}/${key}.icns`,
      buildIcns(
        ICNS_ENTRIES.map(([type, size, format]) => ({
          type,
          data: format === 'argb' ? buildIcnsArgb(mac.get(size).rgba) : mac.get(size).png,
        })),
      ),
    )

    if (MENU_TYPES.includes(key)) {
      write(`${MENU_DIR}/menu-${key}.png`, (await rasterize(page, svg, 16, 16)).png)
      write(`${MENU_DIR}/menu-${key}@2x.png`, (await rasterize(page2x, svg, 16, 16)).png)
    }
  }

  const attachments = new Map()
  for (const [name, key] of Object.entries(ATTACHMENT_ICONS)) {
    const { png } = await rasterize(page2x, svgs.get(key), ATTACHMENT_CSS_PX, ATTACHMENT_CSS_PX)
    attachments.set(name, png)
  }
  for (const [dir, names] of Object.entries(ATTACHMENT_DIRS)) {
    for (const name of names) write(`${dir}/${name}`, attachments.get(name))
  }

  if (previewFile) await writePreview(page, svgs, resolve(previewFile))
} finally {
  await browser.close()
}
