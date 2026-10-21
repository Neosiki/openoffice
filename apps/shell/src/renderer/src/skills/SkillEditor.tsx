import { useEffect, useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import type { UserSkillsBridge } from '@genoffice/electron-utils/user-skills-bridge'
import type {
  UserSkillSaveInput,
  UserSkillView,
} from '@genoffice/electron-utils/user-skills-channels'
import { skillsText, type SkillsStringKey } from '../i18n/strings-skills'
import { SkillDialog } from './SkillDialog'
import { failureKey, formatSkillSize, nameProblemKey, skillDisplayTitle } from './skills-model'

export type SkillEditorMode = 'view' | 'edit' | 'new'

/** wait this long after the last keystroke before asking the main process about a name */
const NAME_CHECK_DELAY_MS = 250

const TITLE_KEY: Record<SkillEditorMode, SkillsStringKey> = {
  view: 'editorView',
  edit: 'editorEdit',
  new: 'editorNew',
}

/**
 * Read-only view, edit of an own skill, or a new skill (spec 5.1). Title,
 * description and body are edited here; the name sits under Advanced and is
 * checked as it is typed; the other files are listed and changed in the folder.
 */
export function SkillEditor({
  api,
  mode,
  view,
  lang,
  locale,
  onClose,
  onSaved,
}: {
  api: UserSkillsBridge
  mode: SkillEditorMode
  view?: UserSkillView | undefined
  lang: Lang
  locale: string
  onClose: () => void
  onSaved: () => void
}) {
  const s = (key: SkillsStringKey, params?: Record<string, string | number>) =>
    skillsText(lang, key, params)
  const readOnly = mode === 'view'
  const [loading, setLoading] = useState(mode !== 'new')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const [originalName, setOriginalName] = useState('')
  /** the person typed a name of their own (a new skill's name is otherwise made from the title) */
  const [nameTouched, setNameTouched] = useState(false)
  const [suggested, setSuggested] = useState('')
  const [files, setFiles] = useState<Array<{ rel: string; size: number }>>([])
  const [advanced, setAdvanced] = useState(false)
  const [nameProblem, setNameProblem] = useState<string | null>(null)
  const [checkingName, setCheckingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorKey, setErrorKey] = useState<SkillsStringKey | null>(null)
  const viewId = view?.id

  useEffect(() => {
    if (mode === 'new' || !viewId) return
    let live = true
    void api.read(viewId).then((answer) => {
      if (!live) return
      setLoading(false)
      if (!answer.ok) {
        setErrorKey(failureKey(answer.reason) ?? 'failGeneric')
        return
      }
      const { skill } = answer
      setTitle(skill.title)
      setDescription(skill.description)
      setBody(skill.body)
      setName(skill.name)
      setOriginalName(skill.name)
      setFiles(skill.files)
    })
    return () => {
      live = false
    }
  }, [api, mode, viewId])

  // a new skill: the name the title would get, shown until the person types one
  useEffect(() => {
    if (mode !== 'new' || nameTouched) return
    let live = true
    const handle = setTimeout(() => {
      if (!title.trim()) {
        setSuggested('')
        return
      }
      void api.suggestName(title).then((next) => {
        if (live) setSuggested(next)
      })
    }, NAME_CHECK_DELAY_MS)
    return () => {
      live = false
      clearTimeout(handle)
    }
  }, [api, mode, title, nameTouched])

  const nameChanged = mode === 'edit' ? name !== originalName : nameTouched && name.trim() !== ''

  useEffect(() => {
    if (readOnly || !nameChanged) {
      setNameProblem(null)
      setCheckingName(false)
      return
    }
    let live = true
    setCheckingName(true)
    const handle = setTimeout(() => {
      void api.checkName(name, viewId).then((answer) => {
        if (!live) return
        setCheckingName(false)
        setNameProblem(answer.ok ? null : answer.problem)
      })
    }, NAME_CHECK_DELAY_MS)
    return () => {
      live = false
      clearTimeout(handle)
    }
  }, [api, readOnly, nameChanged, name, viewId])

  const canSave =
    !readOnly &&
    !loading &&
    !saving &&
    !checkingName &&
    !nameProblem &&
    title.trim() !== '' &&
    description.trim() !== '' &&
    body.trim() !== ''

  const save = async () => {
    if (!canSave) return
    const input: UserSkillSaveInput = { title, description, body }
    if (mode === 'edit' && viewId) input.id = viewId
    if (nameChanged) input.name = name.trim()
    setSaving(true)
    setErrorKey(null)
    const answer = await api.save(input)
    setSaving(false)
    if (answer.ok) {
      onSaved()
      return
    }
    setErrorKey(failureKey(answer.reason) ?? 'failGeneric')
  }

  const label = s(TITLE_KEY[mode])
  const heading = view ? skillDisplayTitle(view, lang) : ''

  return (
    <SkillDialog
      label={label}
      onCancel={onClose}
      footer={
        readOnly ? (
          <button type="button" className="set-btn" onClick={onClose}>
            {s('close')}
          </button>
        ) : (
          <>
            <button type="button" className="set-btn" onClick={onClose}>
              {s('cancel')}
            </button>
            <button
              type="button"
              className="set-btn primary"
              disabled={!canSave}
              onClick={() => void save()}
            >
              {s('save')}
            </button>
          </>
        )
      }
    >
      {heading && mode !== 'new' && <div className="skl-editor-heading">{heading}</div>}
      {mode === 'new' && <p className="set-field-desc skl-editor-hint">{s('createHint')}</p>}
      {loading ? (
        <p className="set-field-desc">{s('loading')}</p>
      ) : (
        <>
          <label className="skl-field">
            <span className="skl-field-label">{s('fieldTitle')}</span>
            <input
              className="skl-input"
              value={title}
              readOnly={readOnly}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="skl-field">
            <span className="skl-field-label">{s('fieldDescription')}</span>
            <textarea
              className="skl-input skl-textarea-short"
              rows={2}
              value={description}
              readOnly={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
            {!readOnly && <span className="set-field-desc">{s('fieldDescriptionHint')}</span>}
          </label>
          <label className="skl-field">
            <span className="skl-field-label">{s('fieldBody')}</span>
            <textarea
              className="skl-input skl-textarea-body"
              rows={12}
              value={body}
              readOnly={readOnly}
              spellCheck={false}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          {readOnly ? (
            <div className="skl-field">
              <span className="skl-field-label">{s('fieldName')}</span>
              <code className="skl-name">{name}</code>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="set-adv-toggle"
                aria-expanded={advanced}
                onClick={() => setAdvanced((was) => !was)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path
                    d="M3.5 2 6.5 5l-3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {s('advanced')}
              </button>
              {advanced && (
                <label className="skl-field">
                  <span className="skl-field-label">{s('fieldName')}</span>
                  <input
                    className="skl-input"
                    data-field="name"
                    value={name}
                    placeholder={mode === 'new' ? suggested : undefined}
                    spellCheck={false}
                    aria-invalid={nameProblem ? true : undefined}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameTouched(true)
                    }}
                  />
                  {nameProblem ? (
                    <span className="set-field-desc skl-error">
                      {s(nameProblemKey(nameProblem))}
                    </span>
                  ) : (
                    <span className="set-field-desc">
                      {mode === 'new' && !nameChanged && suggested
                        ? s('nameAuto', { name: suggested })
                        : s('nameHint')}
                    </span>
                  )}
                </label>
              )}
            </>
          )}

          {mode !== 'new' && (
            <div className="skl-field">
              <span className="skl-field-label">{s('files')}</span>
              {files.length === 0 ? (
                <span className="set-field-desc">{s('filesNone')}</span>
              ) : (
                <ul className="skl-files">
                  {files.map((file) => (
                    <li key={file.rel}>
                      <code>{file.rel}</code>
                      <span className="set-field-desc">{formatSkillSize(file.size, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {view?.can.openFolder && (
                <div className="skl-files-actions">
                  {mode === 'edit' && <span className="set-field-desc">{s('filesHint')}</span>}
                  <button
                    type="button"
                    className="set-btn"
                    onClick={() => void api.openFolder(view.id)}
                  >
                    {s('actOpenFolder')}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {errorKey && (
        <p className="set-field-desc skl-error" role="alert">
          {s(errorKey)}
        </p>
      )}
    </SkillDialog>
  )
}
