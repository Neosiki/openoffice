/**
 * The person's skills between the screens and the shell's main process: the
 * channel names, the shapes that cross them, and the checks both ends run on
 * what they receive. The main process alone reads and writes skill folders;
 * the screens and the editors' AI only ask. No Electron here (plain data).
 */

/** The renderer-exposed bridge name every window shares */
export const USER_SKILLS_BRIDGE_KEY = 'aiOfficeUserSkills'

export const USER_SKILLS_CHANNELS = {
  list: 'skills:list',
  read: 'skills:read',
  setState: 'skills:set-state',
  hideBuiltin: 'skills:hide-builtin',
  unhideBuiltins: 'skills:unhide-builtins',
  remove: 'skills:remove',
  copyToMine: 'skills:copy-to-mine',
  suggestName: 'skills:suggest-name',
  checkName: 'skills:check-name',
  save: 'skills:save',
  saveFromCard: 'skills:save-from-card',
  importFolder: 'skills:import-folder',
  importZip: 'skills:import-zip',
  importGitHub: 'skills:import-github',
  cancelImport: 'skills:cancel-import',
  install: 'skills:install',
  checkUpdate: 'skills:check-update',
  applyUpdate: 'skills:apply-update',
  cancelUpdate: 'skills:cancel-update',
  exportInfo: 'skills:export-info',
  exportZip: 'skills:export-zip',
  openFolder: 'skills:open-folder',
  aiRead: 'skills:ai-read',
  aiReadFile: 'skills:ai-read-file',
  openSettings: 'skills:open-settings',
  agentNotice: 'skills:agent-notice',
  agentNoticeSeen: 'skills:agent-notice-seen',
  /** main → every window: the list or a state changed; read the list again */
  changed: 'skills:changed',
} as const

/** Stored source values (spec 10.1); never renamed */
export type UserSkillSourceValue = 'builtin' | 'app' | 'user' | 'plugin' | 'codex' | 'project'

export type UserSkillInvokeValue = 'auto' | 'manual'

export type UserSkillUnreadable = 'no-frontmatter' | 'bad-name' | 'too-large' | 'unreadable'

/** One skill as the screens see it (no folder paths) */
export interface UserSkillView {
  /** `source:name`, `plugin:<plugin>:<name>` */
  id: string
  source: UserSkillSourceValue
  plugin: string | undefined
  name: string
  /** `metadata.ieum-title`, else the name */
  title: string
  description: string
  enabled: boolean
  invoke: UserSkillInvokeValue
  /** a builtin the person hid; it is off */
  hidden: boolean
  hasScripts: boolean
  /** the template path inside the skill folder (`assets/...`), when the skill names one */
  template: string | undefined
  templateExists: boolean
  /** a builtin only the agent window uses */
  agentOnly: boolean
  unreadable: UserSkillUnreadable | undefined
  files: number
  bytes: number
  /** installed from GitHub: where from */
  github: { repo: string; ref: string; path: string; commit: string } | undefined
  /** the skill lives in the app's own folder (`~/.ieumoffice/skills`) */
  owned: boolean
  /** what the more-menu offers (spec 5.1) */
  can: {
    edit: boolean
    copyToMine: boolean
    export: boolean
    checkUpdate: boolean
    openFolder: boolean
    /** to the OS trash (own skills) */
    remove: boolean
    /** builtins are hidden instead of removed */
    hide: boolean
  }
  /** enabled but pushed back by an enabled skill of the same name: that skill's identifier */
  shadowedBy: string | undefined
}

/** A skill's text for the read-only view and the editor */
export interface UserSkillContent {
  id: string
  name: string
  title: string
  description: string
  /** SKILL.md after the front matter */
  body: string
  template: string | undefined
  /** every file in the folder, `/` between parts */
  files: Array<{ rel: string; size: number }>
}

export type UserSkillNameProblem =
  'empty' | 'too-long' | 'characters' | 'hyphen-edge' | 'double-hyphen' | 'reserved'

export type UserSkillsFailReason =
  | 'not-found'
  /** not one of the app's own skills (delete, edit, export, update) */
  | 'not-owned'
  | 'disabled'
  | 'agent-only'
  | 'unreadable'
  /** the path leads outside the skill folder */
  | 'outside'
  | 'not-text'
  | 'too-large'
  | 'bad-name'
  | 'empty-title'
  | 'empty-description'
  | 'empty-body'
  /** the app's skills folder already has a skill of that name */
  | 'name-taken'
  /** copy to mine: the name is taken; ask, then call again with `overwrite` */
  | 'exists'
  /** a hidden builtin cannot be turned on before it is shown again */
  | 'hidden'
  /** the template is not a document the app's editors open, or cannot be read */
  | 'bad-template'
  /** the request came from a window that may not do this */
  | 'not-allowed'
  | 'invalid'
  | 'cancelled'
  /** another import or update is running for this window */
  | 'busy'
  | 'failed'
  // import, update and export (the core's error kinds)
  | 'bad-address'
  | 'rate-limited'
  | 'network'
  | 'unsafe'
  | 'no-skills'
  | 'needs-choice'
  | 'not-installable'
  | 'invalid-source'
  | 'not-github'

export type UserSkillsFail = { ok: false; reason: UserSkillsFailReason; problem?: string }

export type UserSkillsResult<T extends object = object> = ({ ok: true } & T) | UserSkillsFail

/** Settings editor: a new skill (no `id`) or an edit of one of the app's own skills */
export interface UserSkillSaveInput {
  id?: string | undefined
  title: string
  /** a new skill without one gets a name made from the title */
  name?: string | undefined
  description: string
  body: string
}

/** The template a skill card saves along (spec 5.6) */
export interface UserSkillTemplateInput {
  /** the document's bytes (an edited copy that is not on disk) */
  bytes?: Uint8Array | undefined
  /** or the document file to copy */
  sourcePath?: string | undefined
  /** the file name under `assets/`, with the extension */
  fileName: string
}

/** A skill card's save (spec 5.6) */
export interface UserSkillCardSaveInput {
  title: string
  name: string
  description: string
  body: string
  invoke: UserSkillInvokeValue
  template?: UserSkillTemplateInput | undefined
  /** the skill being changed; none for a new skill */
  targetId?: string | undefined
  /** replace an own skill of the same name when copying another source's skill */
  overwrite?: boolean | undefined
}

/** One found skill of an import preview (spec 5.2) */
export interface UserSkillImportCandidateView {
  key: string
  rel: string
  name: string
  title: string
  description: string
  files: number
  bytes: number
  hasScripts: boolean
  hasTemplate: boolean
  urls: string[]
  urlCount: number
  license: string | undefined
  collision: boolean
  problem: UserSkillUnreadable | 'duplicate' | undefined
}

export interface UserSkillImportPreview {
  /** pass to install or cancelImport */
  token: string
  origin:
    | { kind: 'folder' }
    | { kind: 'zip' }
    | { kind: 'github'; repo: string; ref: string; commit: string; path: string }
  candidates: UserSkillImportCandidateView[]
  rootLicense: string | undefined
}

export type UserSkillCollisionChoice = 'replace' | 'skip'

export interface UserSkillInstallRequest {
  token: string
  /** candidate keys the person checked */
  selected: string[]
  /** for checked candidates whose name is taken */
  onCollision: Record<string, UserSkillCollisionChoice>
}

export type UserSkillUpdateCheck =
  | { ok: true; status: 'up-to-date'; locallyEdited: boolean }
  | {
      ok: true
      status: 'changed'
      token: string
      locallyEdited: boolean
      changedFiles: Array<{ rel: string; change: 'added' | 'removed' | 'modified' }>
      candidate: UserSkillImportCandidateView
    }
  | UserSkillsFail

/** What `use_skill` gets (spec 5.8) */
export interface UserSkillAiRead {
  id: string
  name: string
  title: string
  /** SKILL.md after the front matter */
  body: string
  /** the text files of the folder besides SKILL.md, `/` between parts */
  files: string[]
  /** the template path when the skill names one and the file is there */
  template: string | undefined
  hasScripts: boolean
}

// ---- checks ------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, max = 1_000_000): string | undefined {
  return typeof value === 'string' && value.length <= max ? value : undefined
}

/** A skill identifier as the screens send it: short text with a `:` */
export function skillIdOf(value: unknown): string | undefined {
  const id = text(value, 512)
  return id && id.includes(':') ? id : undefined
}

export function invokeOf(value: unknown): UserSkillInvokeValue | undefined {
  return value === 'auto' || value === 'manual' ? value : undefined
}

/** A state change: on/off and when it is used; nothing else */
export function statePatchOf(
  value: unknown,
): { enabled?: boolean; invoke?: UserSkillInvokeValue } | undefined {
  if (!isRecord(value)) return undefined
  const patch: { enabled?: boolean; invoke?: UserSkillInvokeValue } = {}
  if (typeof value.enabled === 'boolean') patch.enabled = value.enabled
  const invoke = invokeOf(value.invoke)
  if (invoke) patch.invoke = invoke
  return patch.enabled === undefined && patch.invoke === undefined ? undefined : patch
}

/** Longest SKILL.md body the app writes (well under the folder limit) */
export const USER_SKILL_BODY_MAX = 2_000_000

export function saveInputOf(value: unknown): UserSkillSaveInput | undefined {
  if (!isRecord(value)) return undefined
  const title = text(value.title, 10_000)
  const description = text(value.description, 100_000)
  const body = text(value.body, USER_SKILL_BODY_MAX)
  if (title === undefined || description === undefined || body === undefined) return undefined
  const id = value.id === undefined ? undefined : skillIdOf(value.id)
  if (value.id !== undefined && !id) return undefined
  const name = value.name === undefined ? undefined : text(value.name, 512)
  if (value.name !== undefined && name === undefined) return undefined
  return { id, title, name, description, body }
}

/** Largest template a card may hand over (the folder limit) */
export const USER_SKILL_TEMPLATE_MAX_BYTES = 64 * 1024 * 1024

function templateOf(value: unknown): UserSkillTemplateInput | undefined | null {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) return null
  const fileName = text(value.fileName, 1024)
  if (!fileName) return null
  const bytes = value.bytes
  const sourcePath = value.sourcePath === undefined ? undefined : text(value.sourcePath, 4096)
  if (bytes !== undefined) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > USER_SKILL_TEMPLATE_MAX_BYTES) {
      return null
    }
    return { bytes, fileName }
  }
  if (!sourcePath) return null
  return { sourcePath, fileName }
}

export function cardSaveInputOf(value: unknown): UserSkillCardSaveInput | undefined {
  if (!isRecord(value)) return undefined
  const title = text(value.title, 10_000)
  const name = text(value.name, 512)
  const description = text(value.description, 100_000)
  const body = text(value.body, USER_SKILL_BODY_MAX)
  const invoke = invokeOf(value.invoke) ?? 'auto'
  if (title === undefined || name === undefined || description === undefined) return undefined
  if (body === undefined) return undefined
  const template = templateOf(value.template)
  if (template === null) return undefined
  const targetId = value.targetId === undefined ? undefined : skillIdOf(value.targetId)
  if (value.targetId !== undefined && !targetId) return undefined
  return {
    title,
    name,
    description,
    body,
    invoke,
    template,
    targetId,
    overwrite: value.overwrite === true,
  }
}

export function installRequestOf(value: unknown): UserSkillInstallRequest | undefined {
  if (!isRecord(value)) return undefined
  const token = text(value.token, 128)
  if (!token || !Array.isArray(value.selected)) return undefined
  const selected = value.selected.filter(
    (key): key is string => typeof key === 'string' && key.length <= 4096,
  )
  const onCollision: Record<string, UserSkillCollisionChoice> = {}
  if (isRecord(value.onCollision)) {
    for (const [key, choice] of Object.entries(value.onCollision)) {
      if (choice === 'replace' || choice === 'skip') onCollision[key] = choice
    }
  }
  return { token, selected, onCollision }
}

/** A list answer as the screen reads it: an array of skill views, else none */
export function skillViewsOf(value: unknown): UserSkillView[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is UserSkillView =>
      isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string',
  )
}

/** Any answer that should be a result: a malformed one is a failure */
export function skillsResultOf<T extends object>(value: unknown): UserSkillsResult<T> {
  if (isRecord(value) && typeof value.ok === 'boolean') return value as UserSkillsResult<T>
  return { ok: false, reason: 'failed' }
}
