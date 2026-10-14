// @vitest-environment node
/**
 * The dictionaries: 21 languages, one key set, real translations. A missing
 * key is a type error already (each shard is checked against `zh`); these
 * tests catch what the types cannot.
 */
import { describe, expect, it } from 'vitest'
import { LANGS } from '@genoffice/i18n'
import { strings } from '../src/renderer/i18n/strings'
import { mapStrings } from '../src/renderer/i18n/map-strings'

const placeholders = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort()
const keys = Object.keys(strings.zh) as (keyof typeof strings.zh)[]

describe('the editor dictionaries', () => {
  it('cover all 21 languages with the same keys and no empty text', () => {
    expect(Object.keys(strings).sort()).toEqual([...LANGS].sort())
    for (const lang of LANGS) {
      expect(Object.keys(strings[lang]).sort(), lang).toEqual([...keys].sort())
      for (const key of keys) expect(strings[lang][key].trim(), `${lang}.${key}`).not.toBe('')
    }
  })

  it('keep the same placeholders in every language', () => {
    for (const lang of LANGS) {
      for (const key of keys) {
        expect(placeholders(strings[lang][key]), `${lang}.${key}`).toEqual(
          placeholders(strings.en[key]),
        )
      }
    }
  })

  it('are translated: a language with its own script does not carry the English sentence', () => {
    const ownScript: (keyof typeof strings)[] = [
      'zh',
      'zh-TW',
      'ja',
      'ko',
      'th',
      'ru',
      'ar',
      'he',
      'hi',
    ]
    for (const lang of ownScript) {
      for (const key of keys) {
        const english = strings.en[key]
        // short technical words (OK, a bare placeholder) may coincide; sentences may not
        if (english.length < 8) continue
        expect(strings[lang][key], `${lang}.${key}`).not.toBe(english)
      }
    }
  })

  it('name no other product: the file format is not a product name of this editor', () => {
    for (const lang of LANGS) {
      for (const key of keys) {
        expect(strings[lang][key], `${lang}.${key}`).not.toMatch(/xmind/i)
        expect(strings[lang][key], `${lang}.${key}`).not.toMatch(/IeumOffice|이음오피스/)
      }
    }
  })

  it('give the map its own menu in every language, all twelve entries', () => {
    for (const lang of LANGS) {
      const menu = mapStrings(lang).menu
      expect(Object.keys(menu).sort(), lang).toEqual(
        [
          'addChild',
          'addParent',
          'addSibling',
          'cancelFocus',
          'clickTips',
          'focus',
          'link',
          'linkBidirectional',
          'moveDown',
          'moveUp',
          'removeNode',
          'summary',
        ].sort(),
      )
      for (const text of Object.values(menu)) expect(text.trim(), lang).not.toBe('')
      if (lang !== 'en') expect(menu.addChild, lang).not.toBe(mapStrings('en').menu.addChild)
    }
  })
})
