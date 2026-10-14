/**
 * Opening a map: bytes in, a session out, or the reason there is none.
 *
 * Only a file that opens as `ok` becomes a session. Every other result is a
 * status the screen shows as a message; there is no document, so nothing can
 * be saved over the file (the main process refuses as well).
 */
import { createXmindDocument, openXmind, type XmindOpenStatus } from '@genoffice/xmind-engine'
import { DocumentSession } from './session'

export type OpenFailure = Exclude<XmindOpenStatus, 'ok'>

/** What to tell the user once after a file opened. */
export interface OpenNotices {
  /** preserve-only elements in the file; 0 when there are none */
  preserved: number
  /** a sheet carries a theme this app did not write and is drawn with the default look */
  unknownTheme: boolean
}

export type OpenedMap =
  { status: 'ok'; session: DocumentSession; notices: OpenNotices } | { status: OpenFailure }

export async function openMapBytes(bytes: Uint8Array): Promise<OpenedMap> {
  const opened = await openXmind(bytes)
  if (opened.status !== 'ok') return { status: opened.status }
  const session = new DocumentSession(opened.document)
  return {
    status: 'ok',
    session,
    notices: { preserved: session.preservedTotal(), unknownTheme: session.hasUnknownTheme() },
  }
}

/** A new map: one sheet, one central topic, the default theme. The titles come in the user's language. */
export async function newMap(titles: {
  sheetTitle: string
  rootTitle: string
}): Promise<DocumentSession> {
  return new DocumentSession(await createXmindDocument(titles))
}
