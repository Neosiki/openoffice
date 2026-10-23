import { useEffect, useMemo, useRef } from 'react'
import type { PdfApi, SavePdfRequest } from '../../shared/ipc'
import {
  createRecoveryCopyScheduler,
  type RecoveryCopyOptions,
  type RecoveryCopyScheduler,
} from './copy-scheduler'

type RecoveryApi = Pick<
  PdfApi,
  'writeRecoveryCopy' | 'onRecoveryFlushRequest' | 'sendRecoveryFlushDone'
>

export interface RecoveryCopiesOptions {
  /** unsaved changes a copy can hold (not a password or encrypted document) */
  wanted(): boolean
  /** a save, Save As or redaction is writing right now */
  busy(): boolean
  /** the edits as a save request for the open file */
  request(): SavePdfRequest | null
}

/** keyboard and pointer input that edits: a copy round waits for a pause in it */
const INPUT_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'input'] as const

/**
 * Crash-recovery copies of the open PDF's unsaved edits (spec 1). The main
 * process applies the edits the way a save would and keeps the result in the
 * app data folder; the file itself is never written. Answers the scheduler:
 * `bump` when the edits change, `invalidate` after a save.
 */
export function useRecoveryCopies(
  options: RecoveryCopiesOptions,
  api: RecoveryApi | undefined = window.pdfApi,
  timing?: RecoveryCopyOptions,
): RecoveryCopyScheduler {
  const latest = useRef(options)
  latest.current = options
  const apiRef = useRef(api)
  apiRef.current = api
  const timingRef = useRef(timing)

  const scheduler = useMemo(
    () =>
      createRecoveryCopyScheduler(
        {
          wanted: () => !!apiRef.current?.writeRecoveryCopy && latest.current.wanted(),
          busy: () => latest.current.busy(),
          write: async () => {
            const request = latest.current.request()
            const write = apiRef.current?.writeRecoveryCopy
            if (!request || !write) return 'skipped'
            return write(request)
          },
        },
        timingRef.current,
      ),
    [],
  )

  useEffect(() => {
    scheduler.start()
    const note = () => scheduler.noteInput()
    const move = (event: PointerEvent) => {
      // a drag (drawing, moving a page or a box) is input; hovering is not
      if (event.buttons !== 0) scheduler.noteInput()
    }
    for (const type of INPUT_EVENTS) window.addEventListener(type, note, true)
    window.addEventListener('pointermove', move, true)
    const off = apiRef.current?.onRecoveryFlushRequest?.(() => {
      void scheduler.flushNow().finally(() => apiRef.current?.sendRecoveryFlushDone?.())
    })
    return () => {
      scheduler.stop()
      for (const type of INPUT_EVENTS) window.removeEventListener(type, note, true)
      window.removeEventListener('pointermove', move, true)
      off?.()
    }
  }, [scheduler])

  return scheduler
}
