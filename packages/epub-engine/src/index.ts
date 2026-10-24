/**
 * EPUB engine. Each module adds its own export lines below.
 */
export {}
export { openEpub, EPUB_ZIP_LIMITS } from './open'
export type { EpubOpenOptions } from './open'
export type {
  EpubBook,
  EpubBookInfo,
  EpubIdentifier,
  EpubLayout,
  EpubManifestItem,
  EpubMetadata,
  EpubObfuscatedFont,
  EpubOpenResult,
  EpubRefusalReason,
  EpubSpine,
  EpubSpineItem,
  EpubToc,
  EpubTocEntry,
} from './types'
export { directoryOf, fileNameOf, hasUrlScheme, normalizeZipPath, resolveHref } from './paths'
export type { ResolvedHref } from './paths'
export {
  ADOBE_FONT_OBFUSCATION,
  IDPF_FONT_OBFUSCATION,
  deobfuscateFont,
  fontObfuscationKey,
  isFontObfuscationAlgorithm,
  obfuscateFont,
  obfuscateFontWithKey,
} from './fonts'
export type { FontObfuscationAlgorithm } from './fonts'
export { decodeEntryText, encodeEntryText } from './encoding'
export type { DecodedText, EpubTextEncoding } from './encoding'
export { cssDeclaresVerticalWriting, isVerticalWritingMode } from './writing-mode'
export * from './xml-positions'
export * from './ranges'
export * from './blocks'
export {
  blockNotation,
  blockPlainText,
  checkNotation,
  escapeNotationText,
  newBlockNotationToXhtml,
  notationToXhtml,
  type BlockNotation,
  type MarkSource,
  type NotationContext,
  type NotationOptions,
  type NotationResult,
  type PlaceholderSource,
} from './notation'
export * from './edits'
export * from './text'
