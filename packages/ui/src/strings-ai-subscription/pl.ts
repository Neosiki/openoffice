import type { zh } from './zh'

export const pl = {
  aiAssistant: 'Asystent AI',
  cardChecking: 'Sprawdzanie…',
  cardNotInstalled: 'Nie zainstalowano',
  cardSignedOut: 'Nie zalogowano',
  cardReady: 'Połączono',
  cardReadyPlan: 'Połączono · {plan}',
  cardMetered: 'Zalogowano, ale nie w ramach subskrypcji',
  cardMeteredAccepted: 'W użyciu · opłata za zużycie',
  cardError: 'Nie udało się sprawdzić połączenia',
  cardErrNeedsUpdate:
    'Program {provider} na tym komputerze jest zbyt stary. Zaktualizuj go, a potem sprawdź ponownie.',
  cardErrTimeout: 'Program {provider} nie odpowiedział na czas. Sprawdź ponownie za chwilę.',
  cardErrFailed: 'Podczas sprawdzania {provider} wystąpił problem. Sprawdź ponownie.',
  actionInstall: 'Zainstaluj',
  actionLogin: 'Zaloguj się',
  actionRecheck: 'Sprawdź ponownie',
  actionAcceptMetered: 'Użyj mimo to',
  actionInstallHelp: 'Oficjalna instrukcja instalacji',
  actionOpenSettings: 'Otwórz ustawienia',
  actionDismiss: 'Zamknij',
  actionSwitchAccount: 'Zaloguj się na inne konto',
  actionLogout: 'Wyloguj się',
  installNote:
    'Oficjalne polecenie instalacji firmy {vendor} zostanie uruchomione w nowym oknie terminala.',
  loginNote: 'Strona logowania, która się otworzy, należy do firmy {vendor}.',
  meteredWarning: 'To nie jest subskrypcja: płacisz za faktyczne zużycie.',
  meteredMeaning:
    'To logowanie korzysta z klucza API lub konta rozliczanego za zużycie albo nie udało się ustalić jego rodzaju. Po wybraniu „Użyj mimo to” AI będzie działać przez to połączenie, a każde żądanie obciąży to konto.',
  connectTitle: 'Połącz AI, aby zacząć',
  connectBody:
    'AI działa w ramach subskrypcji Claude lub Codex, którą już masz. Klucz API nie jest potrzebny.',
  connectProviderTitle: 'Połączenie {provider} jest teraz niedostępne',
  connectKeyBody:
    'Konfiguracja dostawcy {provider} nie została ukończona. Dokończ ją w Ustawieniach lub wybierz inne AI.',
  errNotConnected:
    'Żadne AI nie jest połączone. Najpierw połącz subskrypcję Claude lub Codex albo darmowe AI.',
  errNotInstalled: 'Na tym komputerze nie znaleziono programu {provider}.',
  errSignedOut: 'Logowanie do {provider} wygasło. Zaloguj się ponownie, aby kontynuować.',
  errRateLimit: 'Limit subskrypcji {provider} został wyczerpany.',
  errRateLimitReset: 'Limit subskrypcji {provider} został wyczerpany. Odnowi się o {time}.',
  errUnsafeTools:
    'Program {provider} uruchomił się z włączonymi własnymi narzędziami, więc ze względów bezpieczeństwa zatrzymano działanie.',
  errMeteredNotAccepted:
    'Połączenie {provider} jest rozliczane za zużycie i nie zostało jeszcze dopuszczone. Aby z niego korzystać, wybierz „Użyj mimo to” w ustawieniach połączenia.',
  errNeedsUpdate:
    'Program {provider} jest zbyt stary dla tej funkcji. Zaktualizuj go i spróbuj ponownie.',
  errHeadlessLimit: 'Osiągnięto godzinny limit żądań automatycznych.',
  errHeadlessLimitReset:
    'Osiągnięto godzinny limit żądań automatycznych. Będą znów możliwe o {time}.',
  connectFreeHint: 'Nie masz subskrypcji? W Ustawieniach połączysz darmowe AI w około minutę.',
  actionConnectFree: 'Połącz darmowe AI',
  errFreeLimit:
    'Dzisiejszy darmowy limit został wykorzystany. Spróbuj ponownie jutro lub wybierz inne AI w Ustawieniach.',
  errFreeLimitReset:
    'Dzisiejszy darmowy limit został wykorzystany. Możesz znów korzystać o {time}.',
  continueWith: 'Kontynuuj z {provider}',
  continueMeteredNote:
    'Połączenie {provider} nie jest subskrypcją: dalsza praca jest płatna za zużycie.',
  usageLine: 'Wykorzystano {percent}% · odnowienie o {time}',
  usageWindowFiveHour: 'Limit 5-godzinny',
  usageWindowSevenDay: 'Limit 7-dniowy',
  noticeTitle: 'Zanim użyjesz AI w ramach subskrypcji',
  noticeSend:
    'Treść dokumentu i rozmowa są wysyłane do Anthropic lub OpenAI z Twojego własnego konta.',
  noticeTraining:
    'To, czy te treści służą do trenowania AI, zależy od ustawień Twojego konta w danej firmie.',
  noticeCodexHistory:
    'Ta aplikacja wyłącza zapisywanie historii rozmów w Codex, ale Codex może nadal przechowywać własne dzienniki diagnostyczne na tym komputerze.',
  noticePdfWholeDocument:
    'W edytorze PDF odczytywanie stron przez AI i tłumaczenie dokumentu mogą wysyłać obrazy stron i cały tekst dokumentu.',
  noticeAck: 'Rozumiem',
  codexNotice:
    'Korzystanie z subskrypcji Codex wewnątrz aplikacji nie jest metodą oficjalnie zalecaną przez OpenAI.',
  truncatedNotice:
    'Dane wejściowe były zbyt długie, więc ich część została obcięta przed wysłaniem.',
  pickerAuto: 'Automatycznie',
  pickerAutoUsing: 'Automatycznie · {provider}',
  pickerAutoUsingModel: 'Automatycznie · {provider} · {model}',
  pickerDefaultModel: 'Model domyślny',
  pickerDefaultModelNamed: 'Model domyślny · {model}',
  pickerSubscription: 'Subskrypcja',
  pickerPaid: 'Płatne',
  pickerPaidTitle: 'Opłata za zużycie, nieobjęte subskrypcją',
  pickerNotConnected: 'Połącz AI',
} satisfies Record<keyof typeof zh, string>
