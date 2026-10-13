import { describe, expect, it } from 'vitest'
import { LANGS, type Lang } from '@genoffice/i18n'
import {
  AI_SUBSCRIPTION_STRINGS,
  aiSubscriptionText,
  type AiSubscriptionStringKey,
} from '../src/strings-ai-subscription'

const KEYS = Object.keys(AI_SUBSCRIPTION_STRINGS.en) as AiSubscriptionStringKey[]

/** Languages written in another script: a value equal to the English one is an untranslated copy */
const NON_LATIN: readonly Lang[] = ['zh', 'ja', 'ko', 'th', 'ru', 'ar', 'he', 'hi', 'zh-TW']

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('AI_SUBSCRIPTION_STRINGS', () => {
  it('covers all 21 ui languages', () => {
    expect(LANGS).toHaveLength(21)
    expect(Object.keys(AI_SUBSCRIPTION_STRINGS).sort()).toEqual([...LANGS].sort())
  })

  it('has every key, non-empty, in every language', () => {
    expect(KEYS.length).toBeGreaterThan(40)
    for (const lang of LANGS) {
      const dict = AI_SUBSCRIPTION_STRINGS[lang] as Record<string, string>
      expect(Object.keys(dict).sort(), lang).toEqual([...KEYS].sort())
      for (const key of KEYS) {
        expect(dict[key]?.trim().length, `${lang}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('is translated, not copied from English, in every non-Latin-script language', () => {
    for (const lang of NON_LATIN) {
      for (const key of KEYS) {
        expect(AI_SUBSCRIPTION_STRINGS[lang][key], `${lang}.${key}`).not.toBe(
          AI_SUBSCRIPTION_STRINGS.en[key],
        )
      }
    }
  })

  it('carries text in the language’s own script in every non-Latin-script language', () => {
    // a sentence left in English would be all ASCII once the names and placeholders are removed
    for (const lang of NON_LATIN) {
      for (const key of KEYS) {
        const own = AI_SUBSCRIPTION_STRINGS[lang][key].replace(/\{\w+\}/g, '').replace(/[ -~]/g, '')
        expect(own.replace(/[·…]/g, '').length, `${lang}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('is translated in the Latin-script languages too', () => {
    for (const lang of LANGS) {
      if (lang === 'en' || NON_LATIN.includes(lang)) continue
      const same = KEYS.filter(
        (key) => AI_SUBSCRIPTION_STRINGS[lang][key] === AI_SUBSCRIPTION_STRINGS.en[key],
      )
      expect(same, lang).toEqual([])
    }
  })

  it('keeps the same placeholders as English in every language', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        expect(placeholders(AI_SUBSCRIPTION_STRINGS[lang][key]), `${lang}.${key}`).toEqual(
          placeholders(AI_SUBSCRIPTION_STRINGS.en[key]),
        )
      }
    }
  })

  it('names the vendors in text and never as a feature of this product', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        const text = AI_SUBSCRIPTION_STRINGS[lang][key]
        expect(text, `${lang}.${key}`).not.toMatch(/Claude Code|Genspark|GenOffice/)
      }
      // the two notices keep the company names as they are written
      expect(AI_SUBSCRIPTION_STRINGS[lang].noticeSend, lang).toMatch(/Anthropic/)
      expect(AI_SUBSCRIPTION_STRINGS[lang].noticeSend, lang).toMatch(/OpenAI/)
      expect(AI_SUBSCRIPTION_STRINGS[lang].codexNotice, lang).toMatch(/Codex/)
      expect(AI_SUBSCRIPTION_STRINGS[lang].codexNotice, lang).toMatch(/OpenAI/)
      expect(AI_SUBSCRIPTION_STRINGS[lang].noticeCodexHistory, lang).toMatch(/Codex/)
    }
  })
})

describe('aiSubscriptionText', () => {
  it('fills the placeholders', () => {
    expect(aiSubscriptionText('en', 'continueWith', { provider: 'Codex' })).toBe(
      'Continue with Codex',
    )
    expect(aiSubscriptionText('ko', 'continueWith', { provider: 'Codex' })).toBe('Codex로 계속')
    expect(aiSubscriptionText('en', 'installNote', { vendor: 'OpenAI' })).toBe(
      "OpenAI's official install command runs in a new terminal window.",
    )
  })
})
