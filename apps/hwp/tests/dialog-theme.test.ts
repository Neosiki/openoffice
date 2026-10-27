// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import {
  DIALOG_THEME_ATTRIBUTE,
  DIALOG_THEME_CSS,
  DIALOG_THEME_STYLE_ID,
  DIALOG_THEME_VERSION,
  installDialogTheme,
} from '../studio-plugin/dialog-theme.mjs'

function page(): Document {
  return new JSDOM('<!doctype html><html><head></head><body></body></html>').window.document
}

describe('HWP dialog design system', () => {
  it('installs one style sheet and turns the skin on', () => {
    const doc = page()
    expect(installDialogTheme(doc)).toBe(true)

    const style = doc.getElementById(DIALOG_THEME_STYLE_ID)
    expect(style?.tagName).toBe('STYLE')
    expect(style?.textContent).toBe(DIALOG_THEME_CSS)
    expect(doc.documentElement.getAttribute(DIALOG_THEME_ATTRIBUTE)).toBe(
      String(DIALOG_THEME_VERSION),
    )
  })

  it('does not stack a second style sheet when called again', () => {
    const doc = page()
    installDialogTheme(doc)
    installDialogTheme(doc)
    const sheets = doc.querySelectorAll(`#${DIALOG_THEME_STYLE_ID}`)
    expect(sheets).toHaveLength(1)
    expect(sheets[0]?.textContent).toBe(DIALOG_THEME_CSS)
  })

  it('replaces stale styles after a dev reload', () => {
    const doc = page()
    installDialogTheme(doc)
    const style = doc.getElementById(DIALOG_THEME_STYLE_ID)!
    style.textContent = ':root {}'
    installDialogTheme(doc)
    expect(style.textContent).toBe(DIALOG_THEME_CSS)
  })

  it("leaves the user's oldschool studio skin alone, and follows a later switch", async () => {
    const doc = page()
    doc.documentElement.setAttribute('data-theme-skin', 'oldschool')
    expect(installDialogTheme(doc)).toBe(false)
    expect(doc.documentElement.hasAttribute(DIALOG_THEME_ATTRIBUTE)).toBe(false)

    doc.documentElement.removeAttribute('data-theme-skin')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(doc.documentElement.getAttribute(DIALOG_THEME_ATTRIBUTE)).toBe(
      String(DIALOG_THEME_VERSION),
    )

    doc.documentElement.setAttribute('data-theme-skin', 'oldschool')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(doc.documentElement.hasAttribute(DIALOG_THEME_ATTRIBUTE)).toBe(false)
  })

  it('has the same token names in both themes', () => {
    const tokens = (block: string): string[] =>
      [...block.matchAll(/--ieum-dialog-[a-z-]+/g)].map((m) => m[0])
    const lightStart = DIALOG_THEME_CSS.indexOf(':root[data-ieum-dialog-theme] {')
    const darkStart = DIALOG_THEME_CSS.indexOf(
      ":root[data-ieum-dialog-theme][data-theme-effective='dark'] {",
    )
    const motionStart = DIALOG_THEME_CSS.indexOf('3. Motion')
    expect(lightStart).toBeGreaterThan(-1)
    expect(darkStart).toBeGreaterThan(lightStart)
    expect(motionStart).toBeGreaterThan(darkStart)

    const light = new Set(tokens(DIALOG_THEME_CSS.slice(lightStart, darkStart)))
    const dark = new Set(tokens(DIALOG_THEME_CSS.slice(darkStart, motionStart)))
    // A dark block may leave shape/motion tokens alone, but every name it
    // overrides must exist in the light block (a typo would paint one theme).
    expect([...dark].every((name) => light.has(name))).toBe(true)
    expect(dark.size).toBeGreaterThan(15)
  })

  it('keeps the app-side memo modal tokens in step with the iframe skin', () => {
    const appCss = readFileSync(
      join(__dirname, '..', 'src', 'renderer', 'dialog-theme.css'),
      'utf8',
    )
    const declarations = (block: string): Map<string, string> => {
      const found = new Map<string, string>()
      for (const match of block.matchAll(/--ieum-dialog-[a-z-]+\s*:\s*([^;]+);/g)) {
        const name = match[0].slice(0, match[0].indexOf(':')).trim()
        found.set(name, match[1].replace(/\s+/g, ' ').trim())
      }
      return found
    }

    const lightStart = DIALOG_THEME_CSS.indexOf(':root[data-ieum-dialog-theme] {')
    const darkStart = DIALOG_THEME_CSS.indexOf(
      ":root[data-ieum-dialog-theme][data-theme-effective='dark'] {",
    )
    const motionStart = DIALOG_THEME_CSS.indexOf('3. Motion')
    const iframeLight = declarations(DIALOG_THEME_CSS.slice(lightStart, darkStart))
    const iframeDark = declarations(DIALOG_THEME_CSS.slice(darkStart, motionStart))

    const appLightStart = appCss.indexOf(':root {')
    const appDarkStart = appCss.indexOf("[data-theme='dark'] {")
    const appMediaStart = appCss.indexOf('@media (prefers-color-scheme: dark)')
    const appLight = declarations(appCss.slice(appLightStart, appDarkStart))
    const appDark = declarations(appCss.slice(appDarkStart, appMediaStart))
    const appFallback = declarations(
      appCss.slice(appMediaStart, appCss.indexOf('/* ─', appMediaStart)),
    )

    expect(Object.fromEntries(appLight)).toEqual(Object.fromEntries(iframeLight))
    expect(Object.fromEntries(appDark)).toEqual(Object.fromEntries(iframeDark))
    expect(Object.fromEntries(appFallback)).toEqual(Object.fromEntries(appDark))
    expect(appCss).toContain('.memo-modal')
    expect(appCss).toContain('.memo-textarea')
    expect(appCss).toContain('.memo-modal-actions .memo-button-primary')
  })

  it('keeps every colour after the token blocks behind a token', () => {
    const motion = DIALOG_THEME_CSS.indexOf('3. Motion')
    const componentCss = DIALOG_THEME_CSS.slice(motion)
    expect(componentCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(componentCss).not.toMatch(/rgba?\(/)
  })

  it('still matches the studio class names when the cached source is present', () => {
    const require = createRequire(import.meta.url)
    const version = (require('@rhwp/core/package.json') as { version: string }).version
    const ui = join(
      __dirname,
      '..',
      'node_modules',
      '.cache',
      'rhwp-studio',
      version,
      'rhwp-studio',
      'src',
      'ui',
    )
    const dialog = join(ui, 'dialog.ts')
    if (!existsSync(dialog)) return

    const source = (name: string) => readFileSync(join(ui, name), 'utf8')
    const base = source('dialog.ts')
    for (const name of [
      'dialog-wrap',
      'dialog-title',
      'dialog-close',
      'dialog-body',
      'dialog-footer',
      'dialog-btn',
      'dialog-btn-primary',
    ]) {
      expect(base).toContain(name)
    }

    const cell = source('table-cell-props-dialog.ts')
    for (const name of [
      'dialog-tabs',
      'dialog-tab',
      'dialog-tab-panel',
      'dialog-section',
      'dialog-row',
      'dialog-label',
      'dialog-input',
      'dialog-select',
      'dialog-checkbox',
      'dialog-btn-group',
    ]) {
      expect(cell).toContain(name)
    }

    const field = source('field-insert-dialog.ts')
    for (const name of [
      'field-edit-body',
      'field-edit-panel',
      'field-edit-label',
      'field-edit-input',
      'field-edit-textarea',
      'field-edit-checkbox-row',
    ]) {
      expect(field).toContain(name)
    }
  })

  it('styles the shared skeleton, the memo form and the cell-properties dialog', () => {
    for (const selector of [
      '.dialog-wrap',
      '.dialog-title',
      '.dialog-tabs',
      '.dialog-btn-primary',
      '.dialog-input',
      '.field-edit-textarea',
      '.tcp-all-spinner-btn',
      '.find-dialog',
      '.find-dialog-input',
    ]) {
      expect(DIALOG_THEME_CSS).toContain(selector)
    }
    expect(DIALOG_THEME_CSS).toContain('--ieum-dialog-accent-ink: #ffffff;')
    expect(DIALOG_THEME_CSS).toContain('--ieum-dialog-accent-ink: #111a2b;')
  })
})
