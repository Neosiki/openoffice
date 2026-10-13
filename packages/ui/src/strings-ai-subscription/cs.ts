import type { zh } from './zh'

export const cs = {
  aiAssistant: 'Asistent AI',
  cardChecking: 'Probíhá kontrola…',
  cardNotInstalled: 'Není nainstalováno',
  cardSignedOut: 'Nepřihlášeno',
  cardReady: 'Připojeno',
  cardReadyPlan: 'Připojeno · {plan}',
  cardMetered: 'Přihlášeno, ale ne přes předplatné',
  cardMeteredAccepted: 'Používá se · účtováno podle spotřeby',
  cardError: 'Připojení se nepodařilo ověřit',
  cardErrNeedsUpdate:
    'Program {provider} v tomto počítači je příliš starý. Aktualizujte ho a zkontrolujte znovu.',
  cardErrTimeout: 'Program {provider} neodpověděl včas. Zkontrolujte to za chvíli znovu.',
  cardErrFailed: 'Při kontrole {provider} došlo k potížím. Zkontrolujte to znovu.',
  actionInstall: 'Nainstalovat',
  actionLogin: 'Přihlásit se',
  actionRecheck: 'Zkontrolovat znovu',
  actionAcceptMetered: 'Přesto použít',
  actionInstallHelp: 'Oficiální návod k instalaci',
  actionOpenSettings: 'Otevřít nastavení',
  actionDismiss: 'Zavřít',
  installNote: 'Oficiální instalační příkaz společnosti {vendor} se spustí v novém okně terminálu.',
  loginNote: 'Přihlašovací stránka, která se otevře, patří společnosti {vendor}.',
  meteredWarning: 'Toto není předplatné: platíte podle skutečné spotřeby.',
  meteredMeaning:
    'Toto přihlášení používá klíč API nebo účet s platbou podle spotřeby, případně se jeho typ nepodařilo zjistit. Volbou „Přesto použít“ poběží AI přes toto připojení a každý požadavek se naúčtuje tomuto účtu.',
  connectTitle: 'Chcete-li používat AI, připojte předplatné',
  connectBody: 'AI běží na předplatném Claude nebo Codex, které už máte. Klíč API není potřeba.',
  connectProviderTitle: 'Připojení {provider} teď nelze použít',
  connectKeyBody:
    'Nastavení poskytovatele {provider} není dokončeno. Dokončete ho v Nastavení, nebo zvolte jinou AI.',
  errNotConnected: 'Není připojena žádná AI. Nejprve připojte předplatné Claude nebo Codex.',
  errNotInstalled: 'Program {provider} nebyl na tomto počítači nalezen.',
  errSignedOut: 'Přihlášení k {provider} vypršelo. Přihlaste se znovu a pokračujte.',
  errRateLimit: 'Limit předplatného {provider} je vyčerpán.',
  errRateLimitReset: 'Limit předplatného {provider} je vyčerpán. Obnoví se v {time}.',
  errUnsafeTools:
    'Program {provider} se spustil se zapnutými vlastními nástroji, proto byl běh z bezpečnostních důvodů zastaven.',
  errMeteredNotAccepted:
    'Připojení {provider} se účtuje podle spotřeby a zatím jste ho nepovolili. Chcete-li ho používat, zvolte v nastavení připojení „Přesto použít“.',
  errNeedsUpdate:
    'Program {provider} je pro tuto funkci příliš starý. Aktualizujte ho a zkuste to znovu.',
  errHeadlessLimit: 'Byl dosažen hodinový limit automatických požadavků.',
  errHeadlessLimitReset:
    'Byl dosažen hodinový limit automatických požadavků. Znovu budou možné v {time}.',
  continueWith: 'Pokračovat s {provider}',
  continueMeteredNote:
    'Připojení {provider} není předplatné: pokračování se účtuje podle spotřeby.',
  usageLine: 'Využito {percent} % · obnoví se v {time}',
  usageWindowFiveHour: '5hodinový limit',
  usageWindowSevenDay: '7denní limit',
  noticeTitle: 'Než začnete AI používat s předplatným',
  noticeSend:
    'Obsah dokumentu a konverzace se odesílají společnosti Anthropic nebo OpenAI pod vaším vlastním účtem.',
  noticeTraining:
    'Zda se tento obsah použije k trénování AI, určuje nastavení vašeho účtu u dané společnosti.',
  noticeCodexHistory:
    'Tato aplikace vypíná ukládání historie konverzací v Codexu, Codex však může v tomto počítači dál uchovávat vlastní diagnostické protokoly.',
  noticeAck: 'Rozumím',
  codexNotice:
    'Používání předplatného Codex uvnitř aplikace není způsob, který OpenAI oficiálně doporučuje.',
  truncatedNotice: 'Vstup byl příliš dlouhý, proto byla jeho část před odesláním oříznuta.',
  pickerAuto: 'Automaticky',
  pickerAutoUsing: 'Automaticky · {provider}',
  pickerDefaultModel: 'Výchozí model',
  pickerSubscription: 'Předplatné',
  pickerPaid: 'Placené',
  pickerPaidTitle: 'Účtováno podle spotřeby, nekryje to předplatné',
  pickerNotConnected: 'Připojit AI',
} satisfies Record<keyof typeof zh, string>
