/**
 * The skills an agent session gives Claude Code (decision 0032). The CLI runs
 * with `--restricted`, which keeps every user setting out, skills included;
 * reading the user's settings instead would also run their hooks. So the app
 * copies the skill folders themselves into one plugin folder of its own and
 * passes that with `--plugin-dir`. Hooks, MCP definitions, agents and commands
 * of installed plugins are not copied.
 *
 * The copy is kept between sessions and only changed skills are copied again:
 * a person's skills can run to hundreds of megabytes. It is also handed to the
 * CLI as a working folder (`--add-dir`) so that a skill's scripts may run;
 * writing there changes the copy only, and the next session restores it.
 */
import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type AgentSkillSourceKind = 'project' | 'app' | 'user' | 'plugin'

/** A folder whose child folders are skills (each with a `SKILL.md`) */
export interface AgentSkillSource {
  kind: AgentSkillSourceKind
  dir: string
  /** the plugin a plugin source came from */
  plugin?: string | undefined
}

export interface AgentSkillEntry {
  name: string
  source: AgentSkillSourceKind
  plugin?: string | undefined
}

export type AgentSkillSkipReason =
  'too-large' | 'no-frontmatter' | 'bad-name' | 'unreadable' | 'duplicate'

export interface AgentSkillBundle {
  /** the plugin folder for `--plugin-dir` */
  dir: string
  skills: AgentSkillEntry[]
  skipped: Array<AgentSkillEntry & { reason: AgentSkillSkipReason }>
}

export const AGENT_SKILL_PLUGIN_NAME = 'ieum-skills'
const MANIFEST_FILE = '.ieum-skills.json'
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
/**
 * Names never read from any source: the upstream program's skill (this app
 * reads nothing the upstream registered) and this app's own command-line skill,
 * which steers to the terminal command instead of the session's tools.
 */
const RESERVED_SKILL_NAMES: ReadonlySet<string> = new Set(['genoffice', 'ieumoffice'])
export const MAX_AGENT_SKILL_BYTES = 64 * 1024 * 1024
const MAX_AGENT_SKILL_FILES = 5_000
/** project skills win over the app's, the app's over the person's, theirs over plugins' */
const PRIORITY: readonly AgentSkillSourceKind[] = ['project', 'app', 'user', 'plugin']

export interface AgentSkillSourceOptions {
  homeDir: string
  projectRoot: string
  /** the app's own skills folder (`~/.ieumoffice/skills`) */
  appSkillsDir: string
}

/**
 * Where skills are, in priority order. Installed plugins are read from Claude
 * Code's list of installed plugins, which names each plugin's folder; only the
 * `skills` folder under it is used.
 */
export async function agentSkillSources(
  options: AgentSkillSourceOptions,
): Promise<AgentSkillSource[]> {
  const sources: AgentSkillSource[] = [
    { kind: 'project', dir: join(options.projectRoot, '.claude', 'skills') },
    { kind: 'app', dir: options.appSkillsDir },
    { kind: 'user', dir: join(options.homeDir, '.claude', 'skills') },
  ]
  try {
    const installed = JSON.parse(
      await readFile(join(options.homeDir, '.claude', 'plugins', 'installed_plugins.json'), 'utf8'),
    ) as { plugins?: Record<string, Array<{ installPath?: unknown }>> }
    for (const [plugin, installs] of Object.entries(installed.plugins ?? {})) {
      const path = Array.isArray(installs) ? installs.at(-1)?.installPath : undefined
      if (typeof path === 'string' && path) {
        sources.push({ kind: 'plugin', dir: join(path, 'skills'), plugin: plugin.split('@')[0] })
      }
    }
  } catch {
    // no plugins installed, or a list this version cannot read: plugin skills are left out
  }
  return sources
}

interface FileFacts {
  files: number
  bytes: number
  signature: string
}

/** Size, file count and a signature of every file's path, size and time, without reading contents */
async function folderFacts(dir: string): Promise<FileFacts | undefined> {
  const hash = createHash('sha256')
  let files = 0
  let bytes = 0
  const walk = async (current: string, rel: string): Promise<boolean> => {
    let entries: Dirent[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return false
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const path = join(current, entry.name)
      const relPath = `${rel}/${entry.name}`
      if (entry.isDirectory()) {
        if (!(await walk(path, relPath))) return false
        continue
      }
      const info = await stat(path).catch(() => undefined)
      if (!info?.isFile()) continue
      files++
      bytes += info.size
      if (files > MAX_AGENT_SKILL_FILES || bytes > MAX_AGENT_SKILL_BYTES) return true
      hash.update(`${relPath}\0${info.size}\0${Math.round(info.mtimeMs)}\n`)
    }
    return true
  }
  if (!(await walk(dir, ''))) return undefined
  return { files, bytes, signature: hash.digest('hex') }
}

async function hasFrontmatter(skillDir: string): Promise<boolean> {
  try {
    const text = await readFile(join(skillDir, 'SKILL.md'), 'utf8')
    return /^\uFEFF?---\r?\n/.test(text)
  } catch {
    return false
  }
}

type Manifest = Record<string, { signature: string; copied: string }>

/**
 * Bring the plugin folder in line with the sources: copy new and changed
 * skills, restore a copy that was changed in place, drop skills that are gone.
 */
export async function buildAgentSkillBundle(
  sources: AgentSkillSource[],
  bundleDir: string,
): Promise<AgentSkillBundle> {
  const skillsDir = join(bundleDir, 'skills')
  await mkdir(join(bundleDir, '.claude-plugin'), { recursive: true })
  await mkdir(skillsDir, { recursive: true })
  await writeFile(
    join(bundleDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: AGENT_SKILL_PLUGIN_NAME, version: '1.0.0' }),
  )
  let manifest: Manifest
  try {
    manifest = JSON.parse(await readFile(join(bundleDir, MANIFEST_FILE), 'utf8')) as Manifest
  } catch {
    manifest = {}
  }

  const ordered = [...sources].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))
  const skills: AgentSkillEntry[] = []
  const skipped: AgentSkillBundle['skipped'] = []
  const taken = new Set<string>()
  const next: Manifest = {}

  for (const source of ordered) {
    let entries: Dirent[]
    try {
      entries = await readdir(source.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const entryInfo: AgentSkillEntry = {
        name: entry.name,
        source: source.kind,
        plugin: source.plugin,
      }
      if (RESERVED_SKILL_NAMES.has(entry.name.toLowerCase())) continue
      const from = join(source.dir, entry.name)
      if (!SKILL_NAME.test(entry.name)) {
        skipped.push({ ...entryInfo, reason: 'bad-name' })
        continue
      }
      if (taken.has(entry.name.toLowerCase())) {
        skipped.push({ ...entryInfo, reason: 'duplicate' })
        continue
      }
      if (!(await hasFrontmatter(from))) {
        skipped.push({ ...entryInfo, reason: 'no-frontmatter' })
        continue
      }
      const facts = await folderFacts(from)
      if (!facts) {
        skipped.push({ ...entryInfo, reason: 'unreadable' })
        continue
      }
      if (facts.files > MAX_AGENT_SKILL_FILES || facts.bytes > MAX_AGENT_SKILL_BYTES) {
        skipped.push({ ...entryInfo, reason: 'too-large' })
        continue
      }
      taken.add(entry.name.toLowerCase())
      const to = join(skillsDir, entry.name)
      const previous = manifest[entry.name]
      const copy = previous?.signature === facts.signature ? await folderFacts(to) : undefined
      if (!copy || copy.signature !== previous?.copied) {
        await rm(to, { recursive: true, force: true })
        try {
          await cp(from, to, { recursive: true, dereference: true, errorOnExist: false })
        } catch {
          await rm(to, { recursive: true, force: true })
          taken.delete(entry.name.toLowerCase())
          skipped.push({ ...entryInfo, reason: 'unreadable' })
          continue
        }
      }
      const copied = await folderFacts(to)
      next[entry.name] = { signature: facts.signature, copied: copied?.signature ?? '' }
      skills.push(entryInfo)
    }
  }

  for (const name of await readdir(skillsDir).catch(() => [] as string[])) {
    if (!next[name]) await rm(join(skillsDir, name), { recursive: true, force: true })
  }
  await writeFile(join(bundleDir, MANIFEST_FILE), JSON.stringify(next))
  return { dir: bundleDir, skills, skipped }
}
