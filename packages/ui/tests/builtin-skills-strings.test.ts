import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LANGS, type Lang } from '@genoffice/i18n'
import {
  BUILTIN_SKILL_NAMES,
  BUILTIN_SKILL_STRINGS,
  builtinSkillDesc,
  builtinSkillTitle,
  isBuiltinSkillName,
  type BuiltinSkillStringKey,
} from '../src/strings-builtin-skills'

const KEYS = Object.keys(BUILTIN_SKILL_STRINGS.zh) as BuiltinSkillStringKey[]

/** Languages written in another script: a value equal to the English one is an untranslated copy */
const NON_LATIN: readonly Lang[] = ['zh', 'ja', 'ko', 'th', 'ru', 'ar', 'he', 'hi', 'zh-TW']

const MANIFEST = join(__dirname, '../../../apps/shell/resources/builtin-skills/builtin-skills.json')

describe('BUILTIN_SKILL_STRINGS', () => {
  it('covers all 21 ui languages', () => {
    expect(LANGS).toHaveLength(21)
    expect(Object.keys(BUILTIN_SKILL_STRINGS).sort()).toEqual([...LANGS].sort())
  })

  it('has a title and a description key for every built-in skill', () => {
    const expected = BUILTIN_SKILL_NAMES.flatMap((name) => [
      `builtinSkillTitle.${name}`,
      `builtinSkillDesc.${name}`,
    ])
    expect([...KEYS].sort()).toEqual(expected.sort())
  })

  it('has every key, non-empty, in every language', () => {
    for (const lang of LANGS) {
      const dict = BUILTIN_SKILL_STRINGS[lang] as Record<string, string>
      expect(Object.keys(dict).sort(), lang).toEqual([...KEYS].sort())
      for (const key of KEYS) {
        expect(dict[key]?.trim().length, `${lang}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('is translated, not copied from English, in every non-Latin-script language', () => {
    for (const lang of NON_LATIN) {
      for (const key of KEYS) {
        expect(BUILTIN_SKILL_STRINGS[lang][key], `${lang}.${key}`).not.toBe(
          BUILTIN_SKILL_STRINGS.en[key],
        )
      }
    }
  })

  it('names no vendor product in any title or description', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        expect(BUILTIN_SKILL_STRINGS[lang][key], `${lang}.${key}`).not.toMatch(
          /claude|anthropic|openai|chatgpt|codex/i,
        )
      }
    }
  })

  it('resolves titles and descriptions through the accessors', () => {
    expect(builtinSkillTitle('ko', 'meeting-minutes')).toBe('회의록 정리')
    expect(builtinSkillTitle('ko', 'internal-comms')).toBe('공지·소식지·FAQ 쓰기')
    expect(builtinSkillTitle('ko', 'humanizer')).toBe('AI 티 없애기(영어 글 기준)')
    expect(builtinSkillTitle('ko', 'copy-editing')).toBe('문장 다듬기(영어 글 기준)')
    expect(builtinSkillTitle('ko', 'find-skills')).toBe('스킬 찾기')
    expect(builtinSkillDesc('en', 'find-skills')).toMatch(/agent window/)
    expect(isBuiltinSkillName('humanizer')).toBe(true)
    expect(isBuiltinSkillName('docx')).toBe(false)
  })

  it('lists the same skills as the shipped builtin-skills.json', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { name: string }[]
    expect(manifest.map((e) => e.name).sort()).toEqual([...BUILTIN_SKILL_NAMES].sort())
  })
})
