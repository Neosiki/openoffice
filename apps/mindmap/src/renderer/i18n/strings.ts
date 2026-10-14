import { appStrings } from './strings-app'

/**
 * Every dictionary of the editor, merged per language. A new domain (the AI
 * panel's `i18n/ai/`) gets its own aggregator and is spread in here beside
 * `appStrings`; the per-language shards are never merged into one object.
 */
export const strings = {
  zh: { ...appStrings.zh },
  en: { ...appStrings.en },
  ja: { ...appStrings.ja },
  ko: { ...appStrings.ko },
  fr: { ...appStrings.fr },
  de: { ...appStrings.de },
  es: { ...appStrings.es },
  th: { ...appStrings.th },
  id: { ...appStrings.id },
  ru: { ...appStrings.ru },
  ar: { ...appStrings.ar },
  pt: { ...appStrings.pt },
  it: { ...appStrings.it },
  pl: { ...appStrings.pl },
  cs: { ...appStrings.cs },
  nl: { ...appStrings.nl },
  ms: { ...appStrings.ms },
  he: { ...appStrings.he },
  hi: { ...appStrings.hi },
  vi: { ...appStrings.vi },
  'zh-TW': { ...appStrings['zh-TW'] },
}
