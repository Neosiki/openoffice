import type { zh } from './zh'

export const de = {
  loading: 'Dokument wird geöffnet…',
  noDocument: 'In diesem Tab ist kein Dokument geöffnet.',
  editorFailed: 'Der Editor konnte nicht gestartet werden.',
  openFailed: 'Das Dokument konnte nicht geöffnet werden.',
  saveFailed: 'Das Dokument konnte nicht gespeichert werden.',
  saveVerifyFailed:
    'Es wurde nichts gespeichert: Die zu schreibende Kopie stimmte beim Zurücklesen nicht mit dem angezeigten Dokument überein. Versuchen Sie „Speichern unter“, um eine neue Datei zu schreiben.',
  saveProtected:
    'Nicht gespeichert: Dieses Dokument ist kennwortgeschützt, und beim Speichern hier würde es ohne Kennwort geschrieben.',
  backupKept: 'Gespeichert. Die vorherige Version wurde als {name} aufbewahrt.',
  dismiss: 'Schließen',
  aiOpenAssistant: 'KI-Assistent öffnen',
  aiNewChat: 'Neuer Chat',
  aiCollapsePanel: 'Panel einklappen',
  aiEmptyTitle: 'Fragen Sie zu diesem Dokument',
  aiThinking: 'Denkt nach',
  aiWorking: 'Arbeitet',
  aiStopped: 'Gestoppt',
  aiNoReply: '(keine Antwort)',
  aiTurnLimit: 'Schrittlimit pro Lauf erreicht — senden Sie eine weitere Anweisung.',
  aiTruncatedNote:
    '(Die Antwort wurde durch das Längenlimit abgeschnitten und ist möglicherweise unvollständig.)',
  aiUnknownError: 'KI-Anfrage fehlgeschlagen, bitte erneut versuchen',
  aiTimeoutError: 'Zeitüberschreitung der KI-Antwort',
  aiCreditsExhausted: 'Guthaben aufgebraucht — beim KI-Anbieter aufladen',
  aiNetworkError:
    'Netzwerkproblem: Der KI-Dienst ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut',
  aiOverloadedError: 'Der KI-Dienst ist derzeit überlastet — bitte gleich erneut versuchen',
  aiUndelivered: 'Nicht gesendet',
  aiRetry: 'Erneut versuchen',
  aiHintIdle: 'Enter zum Senden, Umschalt+Enter für neue Zeile',
  aiHintBusy: 'Antwortet…',
  aiSend: 'Senden',
  aiStop: 'Stopp',
  aiWorkedSteps: 'Erledigt · {n} Schritte',
  aiGroupWorking: 'In Arbeit…',
  aiCopyReplyTitle: 'Antwort kopieren',
  aiEmptyBody:
    'Stellen Sie Fragen zum Text, lassen Sie Formulierungen glätten oder Formularfelder ausfüllen. Jede Änderung wird hier aufgelistet und lässt sich in einem Schritt zurücknehmen.',
  aiComposerPlaceholder:
    'Fragen Sie etwas zu diesem Dokument oder sagen Sie, was geändert werden soll…',
  aiStarterSummarize: 'Zusammenfassen',
  aiStarterSummarizePrompt: 'Fasse dieses Dokument kurz zusammen, nur die Kernpunkte.',
  aiStarterProofread: 'Rechtschreibung und Leerzeichen korrigieren',
  aiStarterProofreadPrompt:
    'Finde die Rechtschreib- und Leerzeichenfehler in diesem Dokument und korrigiere sie.',
  aiToolRead: 'Dokument gelesen',
  aiToolFind: 'Nach „{text}“ gesucht · {count} gefunden',
  aiToolFields: 'Formularfelder geprüft · {count}',
  aiToolFill: 'Feld „{name}“ ausgefüllt',
  aiToolInsert: 'Absätze hinzugefügt: {count}',
  aiToolDelete: 'Absatz entfernt · {text}',
  aiToolTable: 'Tabelle eingefügt · {rows} × {cols}',
  aiToolNotDone: 'Nicht ausgeführt · {what}',
  aiChangesTitle: 'Änderungen am Dokument: {count}',
  aiRevert: 'Diese Änderungen zurücknehmen',
  aiReverted: 'Änderungen zurückgenommen',
  aiRevertRefused:
    'Diese Änderungen konnten nicht zusammen zurückgenommen werden. Wurde das Dokument danach bearbeitet, verwenden Sie „Rückgängig“ im Editor (Ctrl+Z).',
} satisfies Record<keyof typeof zh, string>
