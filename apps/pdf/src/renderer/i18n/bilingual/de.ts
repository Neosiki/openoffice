import type { zh } from './zh'

export const de = {
  blToggle: 'Übersetzung nebeneinander',
  blToggleTip:
    'Zeigt die gespeicherte Übersetzung neben jeder Seite. Das Einschalten sendet nichts an eine KI.',
  blLanguage: 'Sprache der Übersetzung',
  blStoredLangs: 'Gespeicherte Übersetzungen',
  blOtherLangs: 'Weitere Sprachen',
  blLoading: 'Dokumentstruktur wird gelesen … ({done}/{total} Seiten)',
  blLoadingStart: 'Dokumentstruktur wird gelesen …',
  blFailed:
    'Die Dokumentstruktur konnte nicht gelesen werden, daher kann die Übersetzungsspalte nicht angezeigt werden.',
  blUnavailable:
    'Die Übersetzungsspalte ist nicht verfügbar: Die Datei ist nicht gespeichert, oder dieses Fenster kann die Dokumentstruktur nicht lesen.',
  blUnsavedPages: 'Speichern, um die Übersetzungsspalte an den Seiten auszurichten',
  blContinued: 'Fortsetzung von der vorherigen Seite',
  blCollapseAsk: 'Übersetzungsspalte einklappen?',
  blCollapse: 'Einklappen',
  blKeep: 'Beibehalten',
  blExpand: 'Übersetzungsspalte ausklappen',
  blFontSmaller: 'Übersetzungstext kleiner',
  blFontLarger: 'Übersetzungstext größer',
  blResize: 'Breite der Übersetzungsspalte ändern',
  blClose: 'Übersetzung nebeneinander ausschalten',
  blPageHeader: 'Seite {page}',
  blPageCount: 'Übersetzt {translated}/{units}',
  blNoText: 'Diese Seite enthält keinen Text zum Übersetzen.',
  blPendingTip: 'Noch nicht übersetzt (Originaltext).',
  blFailedTip: 'Dieser Absatz konnte nicht übersetzt werden (Originaltext).',
  blEditedTip: 'Von einer Person bearbeitete Übersetzung.',
} satisfies Record<keyof typeof zh, string>
