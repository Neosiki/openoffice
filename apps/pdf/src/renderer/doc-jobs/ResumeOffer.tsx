/**
 * "Unfinished 〈translation (language) / AI reading〉 N% — continue?" (spec
 * §9), shown once when a document opens with unfinished job records. It only
 * offers: nothing starts unless the user presses Continue, and Continue leads
 * to the job's own pre-start confirmation. Generic over the job kind and the
 * translation language (AI page reading and translation share it).
 */
import type { ReactElement } from 'react'
import type { JobStatus } from '../../../../../packages/pdf-structure/src/store/store'
import type { TFunc } from '../i18n/locale'
import { jobPercent } from './job-text'

export interface ResumeOfferProps {
  /** the unfinished jobs on offer, first shown first */
  jobs: readonly JobStatus[]
  t: TFunc
  /** a translation's target language as the user reads it */
  languageName: (lang: string) => string
  onContinue: (job: JobStatus) => void
  onDismiss: (job: JobStatus) => void
}

/** the offer line of one unfinished job */
export function resumeOfferText(
  job: JobStatus,
  t: TFunc,
  languageName: (lang: string) => string,
): string {
  const percent = jobPercent(job.progress)
  return job.kind === 'translate'
    ? t('jobResumeTranslate', { language: languageName(job.lang ?? ''), percent })
    : t('jobResumeAiRead', { percent })
}

export function ResumeOffer({
  jobs,
  t,
  languageName,
  onContinue,
  onDismiss,
}: ResumeOfferProps): ReactElement | null {
  const job = jobs[0]
  if (!job) return null
  return (
    <div
      className="pdf-job-strip pdf-job-resume"
      role="status"
      data-resume-kind={job.kind}
      {...(job.lang ? { 'data-resume-lang': job.lang } : {})}
    >
      <div className="pdf-job-strip-text">
        <span className="pdf-job-strip-title">{resumeOfferText(job, t, languageName)}</span>
      </div>
      <button
        type="button"
        className="pdf-modal-btn primary"
        data-action="resume-job"
        onClick={() => onContinue(job)}
      >
        {t('jobResumeContinue')}
      </button>
      <button
        type="button"
        className="pdf-modal-btn"
        data-action="dismiss-resume"
        onClick={() => onDismiss(job)}
      >
        {t('jobResumeLater')}
      </button>
    </div>
  )
}
