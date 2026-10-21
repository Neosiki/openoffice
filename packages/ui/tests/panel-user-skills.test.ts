import { describe, expect, it, vi } from 'vitest'
import type { Lang } from '@genoffice/i18n'
import type { SkillProposal } from '@genoffice/agent-core'
import { panelUserSkills } from '../src/use-skill-proposals'

const bridge = (views: unknown[]) => ({
  list: vi.fn(async () => views),
  aiRead: vi.fn(async (id: string) => ({
    ok: true,
    skill: { id, name: 'meeting-minutes', title: 'meeting-minutes', body: 'b', files: [] },
  })),
  aiReadFile: vi.fn(async () => ({ ok: true, text: 't' })),
  onChanged: () => () => {},
})

const VIEW = {
  id: 'builtin:meeting-minutes',
  source: 'builtin',
  name: 'meeting-minutes',
  title: 'meeting-minutes',
  description: 'd',
  enabled: true,
  invoke: 'auto',
}

describe('panelUserSkills', () => {
  it('adds nothing in a window without the skills bridge', () => {
    expect(
      panelUserSkills({ lang: () => 'en', messages: () => [], onProposal: () => {}, bridge: null }),
    ).toEqual([])
  })

  it('words the tool rows in the UI language, builtins by their shown title', async () => {
    let lang: Lang = 'ko'
    const proposals: SkillProposal[] = []
    const [skill] = panelUserSkills({
      lang: () => lang,
      messages: () => [],
      onProposal: (p) => proposals.push(p),
      bridge: bridge([VIEW]),
    })
    await vi.waitFor(() =>
      expect(skill!.systemPrompt).toContain('builtin:meeting-minutes | 회의록 정리'),
    )
    const used = await skill!.executeTool({
      id: 'c1',
      name: 'use_skill',
      input: { id: 'builtin:meeting-minutes' },
    })
    expect(used.summary).toBe('회의록 정리 스킬을 썼습니다')
    lang = 'en'
    const proposed = await skill!.executeTool({
      id: 'c2',
      name: 'propose_skill',
      input: { title: 'Minutes', description: 'd', body: 'b' },
    })
    expect(proposed.summary).toBe('Skill proposal: Minutes')
    expect(proposals).toHaveLength(1)
  })
})
