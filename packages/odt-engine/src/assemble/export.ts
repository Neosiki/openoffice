import type { ConversionReport } from './report'
export interface RenderedObject {
  png: Uint8Array
  widthEmu: number
  heightEmu: number
}
export interface DocxToOdtOptions {
  renderedObjects?: Record<string, RenderedObject>
}
export interface DocxToOdtResult {
  odtBytes: Uint8Array
  report: ConversionReport
}
export async function docxToOdt(
  _docx: Uint8Array,
  _options: DocxToOdtOptions = {},
): Promise<DocxToOdtResult> {
  throw new Error('not yet')
}
