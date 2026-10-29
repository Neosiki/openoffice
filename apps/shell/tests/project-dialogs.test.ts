import { describe, expect, it, vi } from 'vitest'
import { LANGS } from '@genoffice/i18n'
import type { ProjectTrustPrompt } from '@genoffice/project-store'
import { createCachedCloudResolver } from '../src/main/projects/cloud-cache'
import {
  PROJECT_DIALOG_STRINGS,
  TRUST_CHATS_SHOWN,
  TRUST_TEXT_SHOWN_CHARS,
  downloadPromptOptions,
  folderPickerOptions,
  newProjectDialogOptions,
  shownText,
  trustAnswerOf,
  trustPromptOptions,
  useExistingPromptOptions,
} from '../src/main/projects/project-dialog-text'

const prompt = (over: Partial<ProjectTrustPrompt> = {}): ProjectTrustPrompt => ({
  projectId: 'p1',
  name: 'Report',
  folderPath: 'C:\\Users\\me\\Report',
  instructions: null,
  memory: null,
  agents: null,
  claude: null,
  foreignChats: [],
  ...over,
})

describe('project dialog texts', () => {
  it('fill every language with the same keys', () => {
    const keys = Object.keys(PROJECT_DIALOG_STRINGS.zh).sort()
    for (const lang of LANGS) {
      const dict = PROJECT_DIALOG_STRINGS[lang] as Record<string, string>
      expect(Object.keys(dict).sort(), lang).toEqual(keys)
      for (const key of keys) expect(dict[key]?.trim(), `${lang}.${key}`).toBeTruthy()
    }
  })

  it('say the download question as the spec words it in Korean', () => {
    expect(downloadPromptOptions('ko', '보고서.hwp').message).toBe(
      '‘보고서.hwp’은 PC에 없어 내려받아야 합니다. 내려받을까요?',
    )
  })
})

describe('the trust prompt (spec 5.10)', () => {
  it('shows each text this install did not write, cut for display', () => {
    const long = 'x'.repeat(TRUST_TEXT_SHOWN_CHARS + 50)
    const options = trustPromptOptions(
      'en',
      prompt({ instructions: long, memory: '- likes tables', agents: 'AGENTS', claude: null }),
    )
    const detail = options.detail ?? ''
    expect(detail).toContain(`${'x'.repeat(TRUST_TEXT_SHOWN_CHARS)}…`)
    expect(detail).not.toContain('x'.repeat(TRUST_TEXT_SHOWN_CHARS + 1))
    expect(detail).toContain('- likes tables')
    expect(detail).toContain('— AGENTS.md —\nAGENTS')
    expect(detail).not.toContain('CLAUDE.md')
    expect(options.message).toContain('Report')
  })

  it('lists the chats from other PCs by title and counts the rest', () => {
    const chats = Array.from({ length: TRUST_CHATS_SHOWN + 3 }, (_, i) => ({
      id: `c${i}`,
      title: i === 0 ? '' : `Chat ${i}`,
      updatedAt: '2026-10-29T09:00:00.000Z',
    }))
    const detail = trustPromptOptions('en', prompt({ foreignChats: chats })).detail ?? ''
    expect(detail).toContain('Chats written on other PCs')
    expect(detail).toContain('• (untitled)')
    expect(detail).toContain('• Chat 1 (')
    expect(detail).not.toContain(`Chat ${TRUST_CHATS_SHOWN}`)
    expect(detail).toContain('…and 3 more')
  })

  it('offers use / use without / cancel, with cancel as the default and the close answer', () => {
    const options = trustPromptOptions('ko', prompt())
    expect(options.buttons).toEqual(['쓰기', '지침 없이 쓰기', '취소'])
    expect(options.defaultId).toBe(2)
    expect(options.cancelId).toBe(2)
    expect([0, 1, 2, -1, 9].map(trustAnswerOf)).toEqual(['use', 'without', null, null, null])
  })

  it('cuts by whole characters', () => {
    expect(shownText('가나다라', 2)).toBe('가나…')
    expect(shownText('  ok  ', 5)).toBe('ok')
  })
})

describe('the other dialogs', () => {
  it('make download the first button and cancel the default', () => {
    const options = downloadPromptOptions('en', 'a.docx')
    expect(options.buttons).toEqual(['Download', 'Cancel'])
    expect(options.defaultId).toBe(1)
    expect(options.cancelId).toBe(1)
  })

  it('ask before using an existing folder and show where it is', () => {
    const options = useExistingPromptOptions('ko', 'D:\\문서\\예산')
    expect(options.message).toBe('이 폴더를 프로젝트로 쓸까요?')
    expect(options.detail).toBe('D:\\문서\\예산')
    expect(options.cancelId).toBe(1)
  })

  it('title the new project dialog and start it at the given place', () => {
    const options = newProjectDialogOptions('ko', 'D:\\문서\\새 프로젝트')
    expect(options.title).toBe('새 프로젝트')
    expect(options.defaultPath).toBe('D:\\문서\\새 프로젝트')
  })

  it('pick folders only', () => {
    for (const purpose of ['add', 'relocate', 'parent'] as const) {
      expect(folderPickerOptions('en', purpose).properties).toContain('openDirectory')
    }
  })
})

describe('the cached "not on this PC" check for the context list', () => {
  it('asks the detector once for paths it has a fresh answer for', async () => {
    let now = 0
    const detect = vi.fn(
      async (paths: readonly string[]) => new Map(paths.map((p) => [p, p === 'b'])),
    )
    const cached = createCachedCloudResolver(detect, { ttlMs: 1000, now: () => now })
    expect([...(await cached(['a', 'b']))]).toEqual([
      ['a', false],
      ['b', true],
    ])
    now = 500
    await cached(['a', 'b', 'c'])
    expect(detect).toHaveBeenLastCalledWith(['c'])
    expect(detect).toHaveBeenCalledTimes(2)
    now = 1500
    await cached(['a'])
    expect(detect).toHaveBeenLastCalledWith(['a'])
  })

  it('does not remember a failed run', async () => {
    const detect = vi
      .fn<(paths: readonly string[]) => Promise<Map<string, boolean>>>()
      .mockRejectedValueOnce(new Error('no detector'))
      .mockResolvedValueOnce(new Map([['a', false]]))
    const cached = createCachedCloudResolver(detect)
    await expect(cached(['a'])).rejects.toThrow('no detector')
    expect(await cached(['a'])).toEqual(new Map([['a', false]]))
  })
})
