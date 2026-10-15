import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * The PDF tools window (decision 0030) on the built app: Home's card opens it,
 * a tool takes its files from the main process's open dialog, writes where the
 * save dialog points, refuses to write over a source, and opens its result in a
 * PDF tab; an editor-only card opens the picked PDF in a PDF tab. The main
 * process's file dialogs are replaced with queues the test fills, so no native
 * dialog appears. Nothing here uses AI.
 */

/** where the screenshots for review go (defaults to e2e/artifacts/screenshots) */
const EVIDENCE_DIR = process.env.PDF_TOOLS_EVIDENCE_DIR
const shot = (name: string) =>
  EVIDENCE_DIR ? join(EVIDENCE_DIR, `${name}.png`) : screenshotPath(name)

async function makePdf(path: string, sizes: [number, number][]): Promise<void> {
  const doc = await PDFDocument.create()
  for (const size of sizes) doc.addPage(size)
  await writeFile(path, await doc.save({ useObjectStreams: false }))
}

const sha = async (path: string) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex')

/** the next answers of the main process's open and save dialogs; an empty queue cancels */
async function queueDialogs(
  app: ElectronApplication,
  answers: { open?: string[][]; save?: string[] },
): Promise<void> {
  await app.evaluate(({ dialog }, next) => {
    const g = globalThis as Record<string, unknown>
    g.__pdfToolsOpen = [...(next.open ?? [])]
    g.__pdfToolsSave = [...(next.save ?? [])]
    dialog.showOpenDialog = (async () => {
      const paths = (g.__pdfToolsOpen as string[][]).shift()
      return paths ? { canceled: false, filePaths: paths } : { canceled: true, filePaths: [] }
    }) as never
    dialog.showSaveDialog = (async () => {
      const path = (g.__pdfToolsSave as string[]).shift()
      return path ? { canceled: false, filePath: path } : { canceled: true, filePath: '' }
    }) as never
  }, answers)
}

async function pdfPages(app: ElectronApplication): Promise<number> {
  let count = 0
  for (const candidate of app.windows()) {
    const href = await candidate.evaluate(() => window.location.href).catch(() => '')
    if (href.includes('://pdf/')) count++
  }
  return count
}

async function openToolsWindow(app: ElectronApplication, home: Page, card: RegExp): Promise<Page> {
  await home.getByRole('button', { name: card }).click()
  const tools = await waitForPageWithUrl(app, 'pdf-tools.html')
  await expect(tools.locator('.pt-title')).toBeVisible()
  return tools
}

test.describe('PDF tools window', () => {
  test('merge, split, refusing a source, and opening results and editor cards in tabs', async () => {
    test.setTimeout(180_000)
    const dir = await mkdtemp(join(tmpdir(), 'genoffice-pdf-tools-e2e-'))
    const a = join(dir, 'a.pdf')
    const b = join(dir, 'b.pdf')
    const bad = join(dir, 'bad.pdf')
    const merged = join(dir, 'merged.pdf')
    const parts = join(dir, 'parts')
    await makePdf(a, [
      [300, 400],
      [300, 400],
      [300, 400],
    ])
    await makePdf(b, [
      [500, 200],
      [500, 200],
    ])
    await writeFile(bad, 'not a pdf')
    await mkdir(parts)
    if (EVIDENCE_DIR) await mkdir(EVIDENCE_DIR, { recursive: true })
    const before = { a: await sha(a), b: await sha(b) }

    const launched = await launchShell({ onboardingSeen: true, videoDir: 'pdf-tools-window' })
    const { app, page } = launched
    try {
      const tools = await openToolsWindow(app, page, /PDF tools/)
      await expect(
        tools.getByText('These tools work only on this PC and do not use AI.'),
      ).toBeVisible()
      await tools.screenshot({ path: shot('pdf-tools-home-en') })

      // merge: an unreadable pick is named and left out, the order can change
      await tools.getByRole('button', { name: /Merge PDF/ }).click()
      await queueDialogs(app, { open: [[a, bad], [b]], save: [merged] })
      await tools.getByRole('button', { name: 'Choose PDF', exact: true }).click()
      await expect(tools.getByText('bad.pdf: could not be read as a PDF.')).toBeVisible()
      await expect(tools.locator('.pt-item')).toHaveCount(1)
      const run = tools.getByRole('button', { name: 'Save as new file' })
      await expect(run).toBeDisabled()
      await tools.getByRole('button', { name: 'Add more PDFs' }).click()
      await expect(tools.locator('.pt-item')).toHaveCount(2)
      await tools.locator('.pt-item').nth(1).getByRole('button', { name: 'Move up' }).click()
      await expect(tools.locator('.pt-item-name').first()).toHaveText('b.pdf')
      await tools.screenshot({ path: shot('pdf-tools-merge-en') })
      await run.click()
      await expect(tools.getByText('Made a new file: merged.pdf')).toBeVisible()
      const out = await PDFDocument.load(await readFile(merged))
      expect(out.getPageCount()).toBe(5)
      expect(out.getPage(0).getWidth()).toBe(500)
      expect(out.getPage(2).getWidth()).toBe(300)
      await tools.screenshot({ path: shot('pdf-tools-merge-done-en') })

      // the result opens in a PDF tab
      const tabsBefore = await pdfPages(app)
      await tools.getByRole('button', { name: 'Open in a tab' }).click()
      await expect.poll(() => pdfPages(app), { timeout: 30_000 }).toBe(tabsBefore + 1)

      // saving over a source is refused and writes nothing
      await queueDialogs(app, { save: [a] })
      await run.click()
      await expect(
        tools.getByText('You cannot save over a source file. Choose another name.'),
      ).toBeVisible()

      // split: one file per page, into a folder the dialog picks
      await tools.getByRole('button', { name: 'All tools' }).click()
      await tools.getByRole('button', { name: /Split PDF/ }).click()
      await queueDialogs(app, { open: [[a], [parts]] })
      await tools.getByRole('button', { name: 'Choose PDF', exact: true }).click()
      await expect(tools.getByText('3 pages', { exact: false })).toBeVisible()
      await tools.getByRole('button', { name: 'Save as new file' }).click()
      await expect(tools.getByText('Made 3 files.')).toBeVisible()
      for (const n of [1, 2, 3]) {
        const part = await PDFDocument.load(await readFile(join(parts, `a-${n}.pdf`)))
        expect(part.getPageCount()).toBe(1)
      }

      // an editor-only card opens the picked PDF in a PDF tab
      await tools.getByRole('button', { name: 'All tools' }).click()
      await tools.getByRole('button', { name: /Crop pages/ }).click()
      await expect(
        tools.getByText('Open the PDF in the editor, then choose this in the ribbon.'),
      ).toBeVisible()
      const tabsBeforeEditor = await pdfPages(app)
      await queueDialogs(app, { open: [[b]] })
      await tools.getByRole('button', { name: 'Open a PDF' }).click()
      await expect.poll(() => pdfPages(app), { timeout: 30_000 }).toBe(tabsBeforeEditor + 1)

      // sources were only read
      expect(await sha(a)).toBe(before.a)
      expect(await sha(b)).toBe(before.b)
      expect(existsSync(join(parts, 'a-4.pdf'))).toBe(false)

      await Promise.all([
        tools.waitForEvent('close'),
        tools.getByRole('button', { name: 'Close', exact: true }).click(),
      ])
    } finally {
      await closeAndSaveVideo(launched, 'pdf-tools-window')
    }
  })

  test('the window in Korean', async () => {
    test.setTimeout(90_000)
    if (EVIDENCE_DIR) await mkdir(EVIDENCE_DIR, { recursive: true })
    const launched = await launchShell({
      onboardingSeen: true,
      lang: 'ko',
      videoDir: 'pdf-tools-window-ko',
    })
    try {
      const tools = await openToolsWindow(launched.app, launched.page, /PDF 도구/)
      await expect(
        tools.getByText('이 도구들은 이 PC 안에서만 처리하며 AI를 쓰지 않습니다.'),
      ).toBeVisible()
      await tools.screenshot({ path: shot('pdf-tools-home-ko') })
    } finally {
      await closeAndSaveVideo(launched, 'pdf-tools-window-ko')
    }
  })
})
