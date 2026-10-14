/**
 * The editor's small dialogs: a yes/no question, and the editors for a
 * topic's labels, note and link. Everything a file or the user wrote is drawn
 * as text.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n/locale'

function Modal(p: { title: string; onCancel(): void; children: ReactNode; kind: string }) {
  return (
    <div
      className="mm-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) p.onCancel()
      }}
    >
      <div
        className="mm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        data-dialog={p.kind}
        onKeyDown={(e) => {
          // keys typed here are not shortcuts of the map behind
          e.stopPropagation()
          if (e.key === 'Escape') p.onCancel()
        }}
      >
        <h2 className="mm-modal-title">{p.title}</h2>
        {p.children}
      </div>
    </div>
  )
}

export interface ConfirmRequest {
  kind: 'delete-sheet' | 'delete-hidden'
  title: string
  body: string
  confirmLabel: string
}

/** A question with a destructive answer. Cancel is the default: Enter does not delete. */
export function ConfirmDialog(p: { request: ConfirmRequest; onAnswer(ok: boolean): void }) {
  const { t } = useI18n()
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => cancel.current?.focus(), [])
  return (
    <Modal title={p.request.title} kind={p.request.kind} onCancel={() => p.onAnswer(false)}>
      <p className="mm-modal-body">{p.request.body}</p>
      <div className="mm-modal-actions">
        <button
          ref={cancel}
          type="button"
          className="mm-btn"
          data-action="confirm-cancel"
          onClick={() => p.onAnswer(false)}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="mm-btn danger"
          data-action="confirm-ok"
          onClick={() => p.onAnswer(true)}
        >
          {p.request.confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export type TopicField = 'label' | 'note' | 'link'

export interface TopicFieldRequest {
  field: TopicField
  topicId: string
  /** the value as it is now: labels joined by ", ", the note, or the link */
  value: string
}

/**
 * Edits one field of a topic. `onSubmit` answers whether the value was taken;
 * a link that is not a web or mail address is turned down and the dialog says
 * so. An empty value removes the field.
 */
export function TopicFieldDialog(p: {
  request: TopicFieldRequest
  onSubmit(value: string): boolean
  onClose(): void
}) {
  const { t } = useI18n()
  const [value, setValue] = useState(p.request.value)
  const [refused, setRefused] = useState(false)
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [])

  const { field: kind } = p.request
  const title = kind === 'label' ? t('tbLabel') : kind === 'note' ? t('tbNote') : t('tbLink')
  const submit = (next: string): void => {
    if (p.onSubmit(next)) p.onClose()
    else setRefused(true)
  }
  const shared = {
    ref: field,
    className: 'mm-field',
    value,
    'aria-label': title,
    'aria-invalid': refused || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value)
      setRefused(false)
    },
  }
  return (
    <Modal title={title} kind={`topic-${kind}`} onCancel={p.onClose}>
      {kind === 'note' ? (
        <textarea {...shared} rows={6} />
      ) : (
        <input
          {...shared}
          type="text"
          spellCheck={false}
          placeholder={kind === 'link' ? 'https://' : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(value)
          }}
        />
      )}
      {kind !== 'note' && (
        <p
          className={`mm-modal-hint${refused ? ' error' : ''}`}
          role={refused ? 'alert' : undefined}
        >
          {kind === 'label' ? t('labelHint') : refused ? t('linkInvalid') : t('linkHint')}
        </p>
      )}
      <div className="mm-modal-actions">
        {p.request.value !== '' && (
          <button
            type="button"
            className="mm-btn mm-btn-start"
            data-action="field-remove"
            onClick={() => submit('')}
          >
            {t('btnRemove')}
          </button>
        )}
        <button type="button" className="mm-btn" data-action="field-cancel" onClick={p.onClose}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className="mm-btn primary"
          data-action="field-ok"
          onClick={() => submit(value)}
        >
          {t('btnOk')}
        </button>
      </div>
    </Modal>
  )
}

/** One line told once after a file opened; the user closes it. */
export function Notice(p: { kind: string; text: string; onClose(): void }) {
  const { t } = useI18n()
  return (
    <div className="mm-notice" role="status" data-notice={p.kind}>
      <span className="mm-notice-text">{p.text}</span>
      <button
        type="button"
        className="mm-notice-close"
        data-action="notice-close"
        onClick={p.onClose}
      >
        {t('btnClose')}
      </button>
    </div>
  )
}
