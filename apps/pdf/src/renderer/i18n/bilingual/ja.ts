import type { zh } from './zh'

export const ja = {
  blToggle: '対訳表示',
  blToggleTip:
    '各ページの右に保存済みの翻訳を並べて表示します。表示をオンにするだけでは AI に何も送信しません。',
  blLanguage: '翻訳の言語',
  blStoredLangs: '保存済みの翻訳',
  blOtherLangs: 'その他の言語',
  blLoading: '文書の構造を読み取っています…（{done}/{total} ページ）',
  blLoadingStart: '文書の構造を読み取っています…',
  blFailed: '文書の構造を読み取れなかったため、翻訳欄を表示できません。',
  blUnavailable:
    '翻訳欄を表示できません。ファイルが保存されていないか、このウィンドウでは文書の構造を読み取れません。',
  blUnsavedPages: '保存すると翻訳欄がページに揃います',
  blContinued: '前のページから続く',
  blCollapseAsk: '翻訳欄を折りたたみますか？',
  blCollapse: '折りたたむ',
  blKeep: 'そのままにする',
  blExpand: '翻訳欄を広げる',
  blFontSmaller: '翻訳の文字を小さく',
  blFontLarger: '翻訳の文字を大きく',
  blResize: '翻訳欄の幅を調整',
  blClose: '対訳表示をオフにする',
  blPageHeader: '{page} ページ',
  blPageCount: '翻訳済み {translated}/{units}',
  blNoText: 'このページには翻訳する文字がありません。',
  blPendingTip: 'まだ翻訳されていません（原文）。',
  blFailedTip: 'この段落は翻訳できませんでした（原文）。',
  blEditedTip: '人が修正した翻訳です。',
} satisfies Record<keyof typeof zh, string>
