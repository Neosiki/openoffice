import type { zh } from './zh'

export const en = {
  blToggle: 'Translation side by side',
  blToggleTip:
    'Show the stored translation beside each page. Turning this on sends nothing to an AI.',
  blLanguage: 'Translation language',
  blStoredLangs: 'Stored translations',
  blOtherLangs: 'Other languages',
  blLoading: 'Reading the document structure… ({done}/{total} pages)',
  blLoadingStart: 'Reading the document structure…',
  blFailed: 'The document structure could not be read, so the translation column cannot be shown.',
  blUnavailable:
    'The translation column is not available: the file is not saved, or this window cannot read the document structure.',
  blUnsavedPages: 'Save to line the translation column up with the pages',
  blContinued: 'Continued from the previous page',
  blCollapseAsk: 'Fold the translation column?',
  blCollapse: 'Fold',
  blKeep: 'Keep',
  blExpand: 'Unfold the translation column',
  blFontSmaller: 'Smaller translation text',
  blFontLarger: 'Larger translation text',
  blResize: 'Resize the translation column',
  blClose: 'Turn off translation side by side',
  blPageHeader: 'Page {page}',
  blPageCount: 'Translated {translated}/{units}',
  blNoText: 'This page has no text to translate.',
  blPendingTip: 'Not translated yet (source text).',
  blFailedTip: 'This paragraph could not be translated (source text).',
  blEditedTip: 'Translation edited by a person.',
} satisfies Record<keyof typeof zh, string>
