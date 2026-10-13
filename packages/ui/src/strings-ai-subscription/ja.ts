import type { zh } from './zh'

export const ja = {
  aiAssistant: 'AI アシスタント',
  cardChecking: '確認中…',
  cardNotInstalled: '未インストール',
  cardSignedOut: '未ログイン',
  cardReady: '接続済み',
  cardReadyPlan: '接続済み · {plan}',
  cardMetered: 'ログイン済みですが、サブスクリプションではありません',
  cardMeteredAccepted: '使用中 · 従量課金',
  cardError: '接続を確認できませんでした',
  cardErrNeedsUpdate:
    'この PC の {provider} のプログラムが古すぎます。更新してから、もう一度確認してください。',
  cardErrTimeout:
    '{provider} のプログラムから時間内に応答がありませんでした。しばらくしてから、もう一度確認してください。',
  cardErrFailed: '{provider} の確認中に問題が発生しました。もう一度確認してください。',
  actionInstall: 'インストール',
  actionLogin: 'ログイン',
  actionRecheck: '再確認',
  actionAcceptMetered: 'それでも使用',
  actionInstallHelp: '公式のインストール手順',
  actionOpenSettings: '設定を開く',
  actionDismiss: '閉じる',
  installNote: '{vendor} の公式インストールコマンドが新しいターミナルウィンドウで実行されます。',
  loginNote: '開くログイン画面は {vendor} のものです。',
  meteredWarning: 'サブスクリプションではなく、使った分だけ料金が発生します。',
  meteredMeaning:
    'API キーまたは従量課金のアカウントでログインしているか、ログイン方法を確認できませんでした。「それでも使用」を選ぶと AI がこの接続で動作し、リクエストのたびにそのアカウントへ課金されます。',
  connectTitle: 'AI を使うにはサブスクリプションを接続してください',
  connectBody:
    'お持ちの Claude または Codex のサブスクリプションで AI を利用します。API キーは不要です。',
  connectProviderTitle: '{provider} の接続は現在使用できません',
  connectKeyBody:
    '{provider} の設定がまだ完了していません。設定で完了するか、別の AI を選んでください。',
  errNotConnected:
    '接続されている AI がありません。先に Claude または Codex のサブスクリプションを接続してください。',
  errNotInstalled: 'この PC で {provider} のプログラムが見つかりませんでした。',
  errSignedOut: '{provider} のログインが切れました。もう一度ログインしてから続けてください。',
  errRateLimit: '{provider} のサブスクリプションの上限に達しました。',
  errRateLimitReset:
    '{provider} のサブスクリプションの上限に達しました。{time} にリセットされます。',
  errUnsafeTools:
    '{provider} のプログラムが独自のツールを有効にしたまま起動したため、安全のため実行を停止しました。',
  errMeteredNotAccepted:
    '{provider} の接続は従量課金のログインで、まだ許可されていません。接続設定で「それでも使用」を選ぶと使えます。',
  errNeedsUpdate:
    '{provider} のプログラムが古く、この機能を利用できません。更新してからもう一度お試しください。',
  errHeadlessLimit: '自動呼び出しの 1 時間あたりの上限に達しました。',
  errHeadlessLimitReset:
    '自動呼び出しの 1 時間あたりの上限に達しました。{time} から再び利用できます。',
  continueWith: '{provider} で続行',
  continueMeteredNote:
    '{provider} の接続はサブスクリプションではありません。続行すると使った分だけ料金が発生します。',
  usageLine: '{percent}% 使用 · {time} にリセット',
  usageWindowFiveHour: '5 時間の上限',
  usageWindowSevenDay: '7 日間の上限',
  noticeTitle: 'サブスクリプションで AI を使う前に',
  noticeSend: '文書の内容と会話は、ご自身のアカウントで Anthropic または OpenAI に送信されます。',
  noticeTraining:
    'その内容が AI の学習に使われるかどうかは、その会社でのご自身のアカウント設定によって決まります。',
  noticeCodexHistory:
    'このアプリは Codex の会話履歴の保存をオフにしますが、Codex が独自の診断ログをこの PC に残す場合があります。',
  noticeAck: 'わかりました',
  codexNotice:
    'アプリ内で Codex のサブスクリプションを使うことは、OpenAI が公式に推奨している方法ではありません。',
  truncatedNotice: '入力が長すぎたため、一部を切り詰めて送信しました。',
  pickerAuto: '自動',
  pickerAutoUsing: '自動 · {provider}',
  pickerDefaultModel: '既定のモデル',
  pickerSubscription: 'サブスクリプション',
  pickerPaid: '有料',
  pickerPaidTitle: 'サブスクリプション対象外で、使った分だけ課金されます',
  pickerNotConnected: 'AI を接続',
} satisfies Record<keyof typeof zh, string>
