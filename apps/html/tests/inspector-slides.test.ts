import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'
import rawInspector from '../src/renderer/preview/inspector.js?raw'
import { readSlideReport } from '../src/renderer/preview/inspector-protocol'

const inspectorSource = rawInspector.replace('__GX_VERSION__', '1')

const ONE_AT_A_TIME_CSS = `<style>.slide { display: none } .slide.active { display: block }</style>`

/** A deck that shows one slide at a time and turns it on the arrow keys, keeping its own index. */
const KEYED_DECK = `<!doctype html><html><head>${ONE_AT_A_TIME_CSS}</head><body>
  <div class="deck">
    <div class="slide active" data-gx-sid="1"><h1 data-gx-sid="2">One</h1></div>
    <div class="slide" data-gx-sid="3"><h1 data-gx-sid="4">Two</h1></div>
    <div class="slide" data-gx-sid="5"><h1 data-gx-sid="6">Three</h1></div>
  </div>
  <script>
    window.deckIndex = 0
    const slides = document.querySelectorAll('.slide')
    const show = (i) => {
      window.deckIndex = Math.max(0, Math.min(slides.length - 1, i))
      slides.forEach((s, n) => s.classList.toggle('active', n === window.deckIndex))
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(window.deckIndex + 1)
      if (e.key === 'ArrowLeft') show(window.deckIndex - 1)
    })
  </script>
</body></html>`

/** The same deck without any key handling: only its classes say which slide shows. */
const KEYLESS_DECK = `<!doctype html><html><head>${ONE_AT_A_TIME_CSS}</head><body>
  <div class="slide active" data-gx-sid="1">One</div>
  <div class="slide" data-gx-sid="2">Two</div>
  <div class="slide" data-gx-sid="3">Three</div>
</body></html>`

const REVEAL_DECK = `<!doctype html><html><body>
  <div class="reveal"><div class="slides">
    <section>One</section><section>Two</section><section>Three</section><section>Four</section>
  </div></div>
  <script>
    window.revealCalls = []
    let at = 0
    window.Reveal = {
      slide: (h) => { window.revealCalls.push(h); at = h },
      getIndices: () => ({ h: at, v: 0 }),
    }
  </script>
</body></html>`

const STACKED_DECK = `<!doctype html><html><body>
  <section data-gx-sid="1">One</section>
  <section data-gx-sid="2">Two</section>
  <section data-gx-sid="3">Three</section>
</body></html>`

const SINGLE_SLIDE = `<!doctype html><html><body><div class="slide">Only</div></body></html>`

const W = 1000
const H = 600

let dom: JSDOM | null = null

afterEach(() => {
  dom?.window.close()
  dom = null
})

type Layout = 'overlap' | 'stacked'

/**
 * jsdom lays nothing out: give each element the box a browser would. Overlapping slides all
 * fill the viewport when shown; stacked sections sit a screen each, one under the other.
 */
function openPage(html: string, layout: Layout = 'overlap') {
  dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true })
  const { window } = dom
  Object.defineProperty(window, 'innerWidth', { value: W, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: H, configurable: true })
  const scrolled: string[] = []
  window.Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.textContent?.trim() ?? '')
  }
  window.Element.prototype.getBoundingClientRect = function (this: Element) {
    const none = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
    if (window.getComputedStyle(this).display === 'none') return none as DOMRect
    let top = 0
    if (layout === 'stacked' && this.tagName === 'SECTION') {
      const sections = Array.from(window.document.querySelectorAll('body > section'))
      top = sections.indexOf(this) * H
    }
    const box = { x: 0, y: top, top, left: 0, right: W, bottom: top + H, width: W, height: H }
    return { ...box, toJSON: () => box } as DOMRect
  }
  const messages: Array<Record<string, unknown>> = []
  window.addEventListener('message', (e) => {
    if (e.data && typeof e.data.type === 'string') messages.push(e.data)
  })
  const script = window.document.createElement('script')
  script.textContent = inspectorSource
  window.document.body.appendChild(script)
  const send = (data: unknown) => window.dispatchEvent(new window.MessageEvent('message', { data }))
  const lastSlides = () => [...messages].reverse().find((m) => m.type === 'gx:slides')
  /** waits until the frame has reported a deck that satisfies `test` */
  const slidesWhere = async (test: (m: Record<string, unknown>) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const last = lastSlides()
      if (last && test(last)) return last
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(`no matching gx:slides report; last: ${JSON.stringify(lastSlides())}`)
  }
  const shown = () =>
    Array.from(window.document.querySelectorAll('.slide'))
      .map((el, i) => (el.classList.contains('active') ? i : -1))
      .filter((i) => i >= 0)
  return { window, send, messages, slidesWhere, shown, scrolled }
}

describe('slides the preview finds', () => {
  it('reports a deck of named slides and the one on show', async () => {
    const { slidesWhere } = openPage(KEYED_DECK)
    const report = await slidesWhere((m) => m.count === 3)
    expect(readSlideReport(report)).toEqual({ count: 3, current: 0, width: W, height: H })
  })

  it('turns a keyed deck with its own keys, so its own index follows', async () => {
    const { window, send, slidesWhere, shown } = openPage(KEYED_DECK)
    await slidesWhere((m) => m.count === 3)
    send({ type: 'gx:goToSlide', index: 2 })
    await slidesWhere((m) => m.current === 2)
    expect(shown()).toEqual([2])
    expect((window as unknown as { deckIndex: number }).deckIndex).toBe(2)
    send({ type: 'gx:goToSlide', index: 1 })
    await slidesWhere((m) => m.current === 1)
    expect((window as unknown as { deckIndex: number }).deckIndex).toBe(1)
  })

  it('keeps the keys it hands the deck away from its own shortcuts', async () => {
    const { send, messages, slidesWhere } = openPage(KEYED_DECK)
    await slidesWhere((m) => m.count === 3)
    // with an element selected, ArrowRight would otherwise select its first child
    send({ type: 'gx:select', sid: 2 })
    send({ type: 'gx:goToSlide', index: 2 })
    await slidesWhere((m) => m.current === 2)
    expect(messages.filter((m) => m.type === 'gx:keyCommand')).toEqual([])
  })

  it('moves the classes of the shown slide when the deck answers no key', async () => {
    const { send, slidesWhere, shown } = openPage(KEYLESS_DECK)
    await slidesWhere((m) => m.count === 3)
    send({ type: 'gx:goToSlide', index: 1 })
    await slidesWhere((m) => m.current === 1)
    expect(shown()).toEqual([1])
  })

  it('asks reveal.js for the slide', async () => {
    const { window, send, slidesWhere } = openPage(REVEAL_DECK)
    await slidesWhere((m) => m.count === 4)
    send({ type: 'gx:goToSlide', index: 3 })
    await slidesWhere((m) => m.current === 3)
    expect((window as unknown as { revealCalls: number[] }).revealCalls).toEqual([3])
  })

  it('scrolls to a section of a deck stacked a screen at a time', async () => {
    const { send, slidesWhere, scrolled } = openPage(STACKED_DECK, 'stacked')
    await slidesWhere((m) => m.count === 3)
    send({ type: 'gx:goToSlide', index: 2 })
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(scrolled).toEqual(['Three'])
  })

  it('reports a page with a single slide as no deck', async () => {
    const { slidesWhere } = openPage(SINGLE_SLIDE)
    const report = await slidesWhere(() => true)
    expect(report.count).toBe(0)
  })

  it('turns a thumbnail frame to its slide and hides its scrollbars', async () => {
    const { window, send, slidesWhere, shown } = openPage(KEYED_DECK)
    send({ type: 'gx:setMode', mode: 'browse' })
    send({ type: 'gx:thumbnail', slide: 1 })
    await slidesWhere((m) => m.current === 1)
    expect(shown()).toEqual([1])
    const styles = Array.from(window.document.querySelectorAll('style[data-gx-inspector]'))
    expect(styles.some((style) => style.textContent?.includes('scrollbar'))).toBe(true)
  })
})

describe('readSlideReport', () => {
  it('takes small whole numbers only', () => {
    expect(readSlideReport({ count: 4, current: 9, width: 800, height: 450 })).toEqual({
      count: 4,
      current: 3,
      width: 800,
      height: 450,
    })
    expect(readSlideReport({ count: -1, current: 0, width: 800, height: 450 })).toBeNull()
    expect(readSlideReport({ count: 2, current: 0.5, width: 800, height: 450 })).toBeNull()
    expect(readSlideReport({ count: 2, current: 0, width: 0, height: 450 })).toBeNull()
    expect(readSlideReport({ count: '2', current: 0, width: 800, height: 450 })).toBeNull()
  })
})
