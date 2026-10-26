import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hwpPresentationKeyOf } from '../src/renderer/presentation-keys'

/**
 * HWP reserves bare F5 for Hancom's table-cell selection. Modified F5 keys
 * still enter the presenter, which uses fullscreen and the rhwp chrome API.
 */
describe('HWP presentation wiring', () => {
  const app = readFileSync(resolve(process.cwd(), 'src/renderer/App.tsx'), 'utf8')
  const styles = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8')
  const key = (overrides = {}) => ({
    key: 'F5',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  })

  it('leaves bare F5 to table-cell selection and presents with Ctrl/Shift+F5', () => {
    expect(hwpPresentationKeyOf(key(), false)).toBeNull()
    expect(hwpPresentationKeyOf(key({ ctrlKey: true }), false)).toBe('present-windowed')
    expect(hwpPresentationKeyOf(key({ metaKey: true }), false)).toBe('present-windowed')
    expect(hwpPresentationKeyOf(key({ shiftKey: true }), false)).toBe('present-windowed')
    expect(hwpPresentationKeyOf(key(), true)).toBe('exit')
  })

  it('uses the editor chrome API and fullscreen for the presenter', () => {
    expect(app).toContain('hwpPresentationKeyOf')
    expect(app).toContain('editor.chrome.get()')
    expect(app).toContain('menu: false, toolbar: false, statusbar: false')
    expect(app).toContain('requestFullscreen')
  })

  it('marks the app while presenting and hides the dock and notices', () => {
    expect(app).toContain('hwp-presenting')
    expect(styles).toContain('.hwp-app.hwp-presenting .ai-dock')
    expect(styles).toContain('.hwp-app.hwp-presenting .hwp-notice')
  })
})
