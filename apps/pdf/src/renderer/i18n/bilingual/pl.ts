import type { zh } from './zh'

export const pl = {
  blToggle: 'Tłumaczenie obok',
  blToggleTip:
    'Pokazuje zapisane tłumaczenie obok każdej strony. Samo włączenie niczego nie wysyła do AI.',
  blLanguage: 'Język tłumaczenia',
  blStoredLangs: 'Zapisane tłumaczenia',
  blOtherLangs: 'Inne języki',
  blLoading: 'Odczytywanie struktury dokumentu… ({done}/{total} stron)',
  blLoadingStart: 'Odczytywanie struktury dokumentu…',
  blFailed:
    'Nie udało się odczytać struktury dokumentu, więc nie można pokazać kolumny tłumaczenia.',
  blUnavailable:
    'Kolumna tłumaczenia jest niedostępna: plik nie jest zapisany albo to okno nie może odczytać struktury dokumentu.',
  blUnsavedPages: 'Zapisz, aby wyrównać kolumnę tłumaczenia ze stronami',
  blContinued: 'Ciąg dalszy z poprzedniej strony',
  blCollapseAsk: 'Zwinąć kolumnę tłumaczenia?',
  blCollapse: 'Zwiń',
  blKeep: 'Zostaw',
  blExpand: 'Rozwiń kolumnę tłumaczenia',
  blFontSmaller: 'Mniejszy tekst tłumaczenia',
  blFontLarger: 'Większy tekst tłumaczenia',
  blResize: 'Zmień szerokość kolumny tłumaczenia',
  blClose: 'Wyłącz tłumaczenie obok',
  blPageHeader: 'Strona {page}',
  blPageCount: 'Przetłumaczono {translated}/{units}',
  blNoText: 'Na tej stronie nie ma tekstu do przetłumaczenia.',
  blPendingTip: 'Jeszcze nieprzetłumaczone (tekst oryginalny).',
  blFailedTip: 'Nie udało się przetłumaczyć tego akapitu (tekst oryginalny).',
  blEditedTip: 'Tłumaczenie poprawione przez człowieka.',
} satisfies Record<keyof typeof zh, string>
