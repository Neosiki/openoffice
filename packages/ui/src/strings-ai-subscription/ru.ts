import type { zh } from './zh'

export const ru = {
  cardChecking: 'Проверка…',
  cardNotInstalled: 'Не установлено',
  cardSignedOut: 'Вход не выполнен',
  cardReady: 'Подключено',
  cardReadyPlan: 'Подключено · {plan}',
  cardMetered: 'Вход выполнен, но не по подписке',
  cardMeteredAccepted: 'Используется · оплата по расходу',
  cardError: 'Не удалось проверить подключение',
  actionInstall: 'Установить',
  actionLogin: 'Войти',
  actionRecheck: 'Проверить снова',
  actionAcceptMetered: 'Всё равно использовать',
  actionInstallHelp: 'Официальная инструкция по установке',
  actionOpenSettings: 'Открыть настройки',
  actionDismiss: 'Закрыть',
  installNote: 'Официальная команда установки от {vendor} будет выполнена в новом окне терминала.',
  loginNote: 'Откроется страница входа, принадлежащая {vendor}.',
  meteredWarning: 'Это не подписка: плата взимается за фактическое использование.',
  meteredMeaning:
    'Вход выполнен с ключом API или через аккаунт с оплатой по расходу, либо способ входа не удалось определить. Вариант «Всё равно использовать» разрешает ИИ работать через это подключение, и каждый запрос оплачивается с этого аккаунта.',
  connectTitle: 'Подключите подписку, чтобы пользоваться ИИ',
  connectBody:
    'ИИ работает по подписке Claude или Codex, которая у вас уже есть. Ключ API не нужен.',
  connectProviderTitle: 'Подключение {provider} сейчас недоступно',
  connectKeyBody:
    'Настройка {provider} не завершена. Завершите её в настройках или выберите другой ИИ.',
  errNotConnected: 'Ни один ИИ не подключён. Сначала подключите подписку Claude или Codex.',
  errNotInstalled: 'Программа {provider} не найдена на этом компьютере.',
  errSignedOut: 'Вход в {provider} истёк. Войдите снова, чтобы продолжить.',
  errRateLimit: 'Лимит подписки {provider} исчерпан.',
  errRateLimitReset: 'Лимит подписки {provider} исчерпан. Он обновится в {time}.',
  errUnsafeTools:
    'Программа {provider} запустилась с включёнными собственными инструментами, поэтому выполнение остановлено в целях безопасности.',
  errMeteredNotAccepted:
    'Подключение {provider} оплачивается по расходу, и вы его ещё не разрешили. Чтобы пользоваться им, выберите «Всё равно использовать» в настройках подключения.',
  errNeedsUpdate:
    'Программа {provider} слишком старая для этой функции. Обновите её и повторите попытку.',
  errHeadlessLimit: 'Достигнут почасовой лимит автоматических запросов.',
  errHeadlessLimitReset:
    'Достигнут почасовой лимит автоматических запросов. Они снова будут доступны в {time}.',
  continueWith: 'Продолжить с {provider}',
  continueMeteredNote:
    'Подключение {provider} не является подпиской: продолжение оплачивается по расходу.',
  usageLine: 'Использовано {percent}% · обновление в {time}',
  usageWindowFiveHour: 'Лимит на 5 часов',
  usageWindowSevenDay: 'Лимит на 7 дней',
  noticeTitle: 'Прежде чем использовать ИИ по подписке',
  noticeSend:
    'Содержимое документа и ваша переписка отправляются в Anthropic или OpenAI от имени вашего собственного аккаунта.',
  noticeTraining:
    'Используется ли это содержимое для обучения ИИ, определяют настройки вашего аккаунта в этой компании.',
  noticeCodexHistory: 'Codex может сохранять содержимое переписки на этом компьютере.',
  noticeAck: 'Понятно',
  codexNotice:
    'Использование подписки Codex внутри приложения не является способом, который официально рекомендует OpenAI.',
  truncatedNotice: 'Ввод был слишком длинным, поэтому перед отправкой его часть была обрезана.',
  pickerAuto: 'Автоматически',
  pickerAutoUsing: 'Автоматически · {provider}',
  pickerDefaultModel: 'Модель по умолчанию',
  pickerSubscription: 'Подписка',
  pickerPaid: 'Платно',
  pickerPaidTitle: 'Оплата по расходу, не входит в подписку',
  pickerNotConnected: 'Подключить ИИ',
} satisfies Record<keyof typeof zh, string>
