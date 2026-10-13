import type { zh } from './zh'

export const en = {
  aiAssistant: 'AI Assistant',
  cardChecking: 'Checking…',
  cardNotInstalled: 'Not installed',
  cardSignedOut: 'Not signed in',
  cardReady: 'Connected',
  cardReadyPlan: 'Connected · {plan}',
  cardMetered: 'Signed in, but not with a subscription',
  cardMeteredAccepted: 'In use · charged by usage',
  cardError: 'The connection could not be checked',
  cardErrNeedsUpdate: 'The {provider} program on this PC is too old. Update it, then check again.',
  cardErrTimeout: 'The {provider} program did not answer in time. Check again in a moment.',
  cardErrFailed: 'Something went wrong while checking {provider}. Check again.',
  actionInstall: 'Install',
  actionLogin: 'Sign in',
  actionRecheck: 'Check again',
  actionAcceptMetered: 'Use anyway',
  actionInstallHelp: 'Official install guide',
  actionOpenSettings: 'Open settings',
  actionDismiss: 'Dismiss',
  actionSwitchAccount: 'Sign in with another account',
  actionLogout: 'Sign out',
  installNote: "{vendor}'s official install command runs in a new terminal window.",
  loginNote: "The sign-in page that opens is {vendor}'s own.",
  meteredWarning: 'This is not a subscription: you are charged for what you use.',
  meteredMeaning:
    'This login is an API key or a pay-as-you-go account, or its type could not be confirmed. "Use anyway" lets AI run on this connection, and every request is billed to that account.',
  connectTitle: 'Connect a subscription to use AI',
  connectBody:
    'AI runs on the Claude or Codex subscription you already have. No API key is needed.',
  connectProviderTitle: 'The {provider} connection cannot be used right now',
  connectKeyBody:
    'The {provider} setup is not finished. Complete it in Settings, or choose another AI.',
  errNotConnected: 'No AI is connected. Connect a Claude or Codex subscription first.',
  errNotInstalled: 'The {provider} program was not found on this PC.',
  errSignedOut: 'The {provider} sign-in has expired. Sign in again to continue.',
  errRateLimit: 'The {provider} subscription limit has been used up.',
  errRateLimitReset: 'The {provider} subscription limit has been used up. It resets at {time}.',
  errUnsafeTools:
    'The {provider} program started with its own tools turned on, so the run was stopped for safety.',
  errMeteredNotAccepted:
    'The {provider} connection is a pay-as-you-go login that you have not allowed yet. Choose "Use anyway" in the connection settings to use it.',
  errNeedsUpdate: 'The {provider} program is too old for this feature. Update it and try again.',
  errHeadlessLimit: 'The hourly limit for automatic requests has been reached.',
  errHeadlessLimitReset:
    'The hourly limit for automatic requests has been reached. Requests are possible again at {time}.',
  continueWith: 'Continue with {provider}',
  continueMeteredNote:
    'The {provider} connection is not a subscription: continuing is charged by usage.',
  usageLine: '{percent}% used · resets at {time}',
  usageWindowFiveHour: '5-hour limit',
  usageWindowSevenDay: '7-day limit',
  noticeTitle: 'Before you use AI with your subscription',
  noticeSend:
    'Document content and your conversation are sent to Anthropic or OpenAI under your own account.',
  noticeTraining:
    'Whether that content is used to train AI is decided by your own account settings at that company.',
  noticeCodexHistory:
    'This app turns off conversation history saving in Codex, but Codex may still keep its own diagnostic logs on this PC.',
  noticeAck: 'Got it',
  codexNotice:
    'Using a Codex subscription inside an app is not a method officially recommended by OpenAI.',
  truncatedNotice: 'The input was too long, so part of it was cut off before sending.',
  pickerAuto: 'Automatic',
  pickerAutoUsing: 'Automatic · {provider}',
  pickerAutoUsingModel: 'Automatic · {provider} · {model}',
  pickerDefaultModel: 'Default model',
  pickerDefaultModelNamed: 'Default model · {model}',
  pickerSubscription: 'Subscription',
  pickerPaid: 'Paid',
  pickerPaidTitle: 'Charged by usage, not covered by a subscription',
  pickerNotConnected: 'Connect AI',
} satisfies Record<keyof typeof zh, string>
