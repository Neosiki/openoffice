/**
 * Functions later work plugs into the structure-job process. While one is
 * null its operation answers 'not-available'; plugging it in is the only
 * change needed (the channels, the process protocol and the handlers are in
 * place).
 */
import type { PdfiumModule } from '../../../../../packages/pdf2docx/src'
import type { DocumentTree } from '../../../../../packages/pdf-structure/src/tree/types'
import type { PdfStructuredTextPage } from '../../../../pdf/src/shared/ipc'

/**
 * Structured text for the AI read path (spec §2): one entry per analyzed
 * page, in page order. The formatter lives in
 * packages/pdf-structure/src/structured-text.
 */
export type StructuredTextFormatter = (tree: DocumentTree) => PdfStructuredTextPage[]

export const structuredTextFormatter: StructuredTextFormatter | null = null

export interface TranslatedPdfWriteInput {
  /** initialized PDFium */
  pdfium: PdfiumModule
  /** the source PDF bytes (never written back to the source) */
  pdf: Uint8Array
  password?: string
  /** the request's payload, as the renderer sent it */
  payload: unknown
  onProgress: (done: number, total: number) => void
}

export interface TranslatedPdfWriteOutput {
  /** the translated PDF; the job writes it to the picked target */
  pdf: Uint8Array
  /** passed back to the caller untouched */
  report: unknown
}

/** Translated PDF write-back (spec §8). */
export type TranslatedPdfWriter = (
  input: TranslatedPdfWriteInput,
) => Promise<TranslatedPdfWriteOutput>

export const translatedPdfWriter: TranslatedPdfWriter | null = null
