/**
 * Repair a damaged PDF (the PDF tools window, decision 0030): PDFium reads
 * the file leniently, rebuilding a broken cross-reference table as it goes,
 * and writes it out again in full. Runs in the shell's PDF job process.
 */

/** the PDFium calls this needs */
export interface RepairPdfium {
  HEAPU8: Uint8Array
  _malloc(size: number): number
  _free(ptr: number): void
  _FPDF_LoadMemDocument(ptr: number, size: number, password: number): number
  _FPDF_CloseDocument(doc: number): void
  _FPDF_GetPageCount(doc: number): number
  _FPDF_GetLastError(): number
  _PDFiumExt_OpenFileWriter(): number
  _PDFiumExt_CloseFileWriter(writer: number): void
  _PDFiumExt_GetFileWriterSize(writer: number): number
  _PDFiumExt_GetFileWriterData(writer: number, buffer: number, size: number): number
  _FPDF_SaveAsCopy(doc: number, writer: number, flags: number): number
}

/** FPDF_ERR_PASSWORD */
const ERR_PASSWORD = 4
/** FPDF_NO_INCREMENTAL: write the whole file, not an update appended to the old one */
const NO_INCREMENTAL = 2

export class RepairFailedError extends Error {
  constructor(readonly reason: 'unreadable' | 'encrypted') {
    super(
      reason === 'encrypted' ? 'the PDF is password-protected' : 'PDFium could not read the PDF',
    )
  }
}

/** Whether `password` opens `bytes` (PDFium reads AES-256 too): 'wrong-password' only for that */
export function pdfiumOpens(
  m: RepairPdfium,
  bytes: Uint8Array,
  password: string,
): 'ok' | 'wrong-password' | 'unreadable' {
  const ptr = m._malloc(bytes.length)
  const pw = Buffer.from(`${password}\0`, 'utf8')
  const pwPtr = m._malloc(pw.length)
  if (!ptr || !pwPtr) {
    if (ptr) m._free(ptr)
    if (pwPtr) m._free(pwPtr)
    return 'unreadable'
  }
  try {
    m.HEAPU8.set(bytes, ptr)
    m.HEAPU8.set(pw, pwPtr)
    const doc = m._FPDF_LoadMemDocument(ptr, bytes.length, pwPtr)
    if (doc) {
      m._FPDF_CloseDocument(doc)
      return 'ok'
    }
    return m._FPDF_GetLastError() === ERR_PASSWORD ? 'wrong-password' : 'unreadable'
  } finally {
    // the password's copy in the WebAssembly heap is wiped before it is freed
    m.HEAPU8.fill(0, pwPtr, pwPtr + pw.length)
    m._free(pwPtr)
    m._free(ptr)
  }
}

/** `bytes` written out again by PDFium, and its page count */
export function repairPdfBytes(
  m: RepairPdfium,
  bytes: Uint8Array,
): { bytes: Uint8Array; pages: number } {
  const ptr = m._malloc(bytes.length)
  if (!ptr) throw new RepairFailedError('unreadable')
  try {
    m.HEAPU8.set(bytes, ptr)
    const doc = m._FPDF_LoadMemDocument(ptr, bytes.length, 0)
    if (!doc) {
      throw new RepairFailedError(
        m._FPDF_GetLastError() === ERR_PASSWORD ? 'encrypted' : 'unreadable',
      )
    }
    try {
      const pages = m._FPDF_GetPageCount(doc)
      if (pages < 1) throw new RepairFailedError('unreadable')
      const writer = m._PDFiumExt_OpenFileWriter()
      try {
        if (!m._FPDF_SaveAsCopy(doc, writer, NO_INCREMENTAL)) {
          throw new RepairFailedError('unreadable')
        }
        const size = m._PDFiumExt_GetFileWriterSize(writer)
        const buf = m._malloc(size)
        try {
          m._PDFiumExt_GetFileWriterData(writer, buf, size)
          return { bytes: Uint8Array.from(m.HEAPU8.subarray(buf, buf + size)), pages }
        } finally {
          m._free(buf)
        }
      } finally {
        m._PDFiumExt_CloseFileWriter(writer)
      }
    } finally {
      m._FPDF_CloseDocument(doc)
    }
  } finally {
    m._free(ptr)
  }
}
