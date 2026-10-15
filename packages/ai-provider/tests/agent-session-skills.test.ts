/**
 * The skill copy an agent session hands Claude Code: which skills go in, which
 * win on a shared name, what is left out, and what is copied again.
 */
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  agentSkillSources,
  buildAgentSkillBundle,
  type AgentSkillSource,
} from '../src/agent-session'

const roots: string[] = []
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-skills-test-'))
  roots.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function skill(base: string, name: string, body = 'Do the thing.', frontmatter = true): string {
  const dir = join(base, name)
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(
    join(dir, 'SKILL.md'),
    `${frontmatter ? `---\nname: ${name}\ndescription: test\n---\n` : ''}${body}\n`,
  )
  writeFileSync(join(dir, 'scripts', 'run.js'), 'console.log(1)\n')
  return dir
}

describe('where skills come from', () => {
  it('lists the project, the app, the person, then each installed plugin', async () => {
    const home = temp()
    mkdirSync(join(home, '.claude', 'plugins'), { recursive: true })
    writeFileSync(
      join(home, '.claude', 'plugins', 'installed_plugins.json'),
      JSON.stringify({
        version: 2,
        plugins: { 'hwp@market': [{ installPath: join(home, 'cache', 'hwp', '1') }] },
      }),
    )
    const sources = await agentSkillSources({ homeDir: home, projectRoot: 'P', appSkillsDir: 'A' })
    expect(sources).toEqual([
      { kind: 'project', dir: join('P', '.claude', 'skills') },
      { kind: 'app', dir: 'A' },
      { kind: 'user', dir: join(home, '.claude', 'skills') },
      { kind: 'plugin', dir: join(home, 'cache', 'hwp', '1', 'skills'), plugin: 'hwp' },
    ])
  })

  it('goes on without plugins when their list is missing or unreadable', async () => {
    const home = temp()
    const sources = await agentSkillSources({ homeDir: home, projectRoot: 'P', appSkillsDir: 'A' })
    expect(sources.map((source) => source.kind)).toEqual(['project', 'app', 'user'])
  })
})

describe('the bundle', () => {
  it('copies skills with their scripts into a plugin folder', async () => {
    const user = temp()
    skill(user, 'pdf')
    const bundle = temp()
    const result = await buildAgentSkillBundle([{ kind: 'user', dir: user }], bundle)
    expect(result.skills).toEqual([{ name: 'pdf', source: 'user', plugin: undefined }])
    expect(
      JSON.parse(readFileSync(join(bundle, '.claude-plugin', 'plugin.json'), 'utf8')).name,
    ).toBe('ieum-skills')
    expect(existsSync(join(bundle, 'skills', 'pdf', 'scripts', 'run.js'))).toBe(true)
  })

  it('lets the project skill win over the person and plugins on the same name', async () => {
    const project = temp()
    const user = temp()
    const plugin = temp()
    skill(project, 'report', 'project version')
    skill(user, 'report', 'user version')
    skill(plugin, 'report', 'plugin version')
    const bundle = temp()
    const sources: AgentSkillSource[] = [
      { kind: 'plugin', dir: plugin, plugin: 'x' },
      { kind: 'user', dir: user },
      { kind: 'project', dir: project },
    ]
    const result = await buildAgentSkillBundle(sources, bundle)
    expect(result.skills).toEqual([{ name: 'report', source: 'project', plugin: undefined }])
    expect(result.skipped.map((entry) => [entry.source, entry.reason])).toEqual([
      ['user', 'duplicate'],
      ['plugin', 'duplicate'],
    ])
    expect(readFileSync(join(bundle, 'skills', 'report', 'SKILL.md'), 'utf8')).toContain(
      'project version',
    )
  })

  it('leaves out a folder without front matter or with an odd name', async () => {
    const user = temp()
    skill(user, 'plain', 'no header', false)
    skill(user, 'bad name')
    const result = await buildAgentSkillBundle([{ kind: 'user', dir: user }], temp())
    expect(result.skills).toEqual([])
    expect(result.skipped.map((entry) => entry.reason).sort()).toEqual([
      'bad-name',
      'no-frontmatter',
    ])
  })

  it('copies a changed skill again, restores an edited copy, and drops one that is gone', async () => {
    const user = temp()
    const dir = skill(user, 'deck', 'v1')
    skill(user, 'old')
    const bundle = temp()
    await buildAgentSkillBundle([{ kind: 'user', dir: user }], bundle)

    writeFileSync(join(dir, 'SKILL.md'), '---\nname: deck\ndescription: test\n---\nv2 longer\n')
    const later = new Date(Date.now() + 5_000)
    utimesSync(join(dir, 'SKILL.md'), later, later)
    rmSync(join(user, 'old'), { recursive: true })
    await buildAgentSkillBundle([{ kind: 'user', dir: user }], bundle)
    expect(readFileSync(join(bundle, 'skills', 'deck', 'SKILL.md'), 'utf8')).toContain('v2')
    expect(existsSync(join(bundle, 'skills', 'old'))).toBe(false)

    // the session wrote into its copy; the next build puts the source back
    writeFileSync(join(bundle, 'skills', 'deck', 'scripts', 'run.js'), 'tampered and longer\n')
    await buildAgentSkillBundle([{ kind: 'user', dir: user }], bundle)
    expect(readFileSync(join(bundle, 'skills', 'deck', 'scripts', 'run.js'), 'utf8')).toBe(
      'console.log(1)\n',
    )
  })

  it('skips a source folder that does not exist', async () => {
    const result = await buildAgentSkillBundle(
      [{ kind: 'project', dir: join(temp(), 'missing') }],
      temp(),
    )
    expect(result).toMatchObject({ skills: [], skipped: [] })
  })
})
