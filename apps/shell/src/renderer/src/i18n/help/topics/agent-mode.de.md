# Agentenmodus

Der Agent nimmt einen Ordner Ihrer Wahl als Projekt und führt darin Claude Code oder Codex von diesem PC aus. Die KI liest die Unterlagen im Ordner selbst, erstellt neue Dateien, nutzt Skills und Skripte und bearbeitet die in GenOffice geöffneten Dokumente. Nutzen Sie ihn für Arbeiten, die auf viel Material zurückgreifen.

## Bevor Sie beginnen

- Ein Claude-Abonnement oder ein ChatGPT-Abonnement, verbunden unter **Einstellungen ▸ KI**. Wie das geht, erklärt das Thema „Abonnement-Verbindung“.
- Ein Ordner mit Ihren Unterlagen. Ein ganzes Laufwerk, Ihr gesamter Benutzerordner und Ordner mit Anmelde- oder App-Daten lassen sich nicht wählen.

## Eine Sitzung starten

1. Klicken Sie in der linken Seitenleiste der Startseite auf **Agent**. Das Agentenfenster öffnet sich separat.
2. Wählen Sie über **Ordner wählen…** den Projektordner. Kürzlich verwendete Ordner stehen unter **Zuletzt verwendete Ordner**.
3. Wählen Sie unter **Programm** Claude Code oder Codex. Ein Programm, das nicht verbunden ist, lässt sich nicht wählen.
4. Legen Sie unter **Wann nachfragen** fest, wie der Agent um Erlaubnis fragt (Tabelle unten).
5. Lesen Sie beim ersten Mal **Bevor Sie beginnen** und klicken Sie auf **Verstanden**.
6. Klicken Sie auf **Starten**, schreiben Sie, was erledigt werden soll, und klicken Sie auf **Senden**.

Ein Fenster ist eine Sitzung. Wenn Sie das Fenster schließen oder auf **Stoppen** klicken, endet die Sitzung, und das Programm, das GenOffice dafür gestartet hat, wird ebenfalls beendet. Eine Sitzung endet außerdem, wenn 30 Minuten lang nichts gesendet wird.

## Wie der Agent nachfragt

| Auswahl                                | Läuft direkt                                                                 | Fragt zuerst                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Vor jedem Befehl fragen** (Standard) | Dateien im Projektordner lesen und schreiben, geöffnete Dokumente bearbeiten | Einen Befehl oder ein Skript ausführen, außerhalb des Projektordners lesen                |
| **Vor Schreiben und Befehlen fragen**  | Dateien im Projektordner lesen, geöffnete Dokumente bearbeiten               | Eine Datei schreiben, einen Befehl oder ein Skript ausführen, außerhalb des Ordners lesen |
| **Diesem Projekt vertrauen**           | Fast alles                                                                   | Außerhalb des Projektordners lesen                                                        |

Wenn der Agent fragt, zeigt das Fenster, was er tun will (den vollständigen Befehl, den Dateipfad). Klicken Sie auf **Erlauben** oder **Ablehnen**.

Unabhängig von Ihrer Auswahl tut der Agent Folgendes nie:

- Die Datei eines Dokuments überschreiben, das in einem GenOffice-Tab geöffnet ist. Geöffnete Dokumente werden über die App bearbeitet; die Änderung erscheint daher sofort im Editor, und das Rückgängigmachen im Editor nimmt sie zurück.
- Außerhalb des Projektordners schreiben.
- Die Anmeldedaten von Claude oder Codex oder den Datenordner von GenOffice anrühren.

## Claude Code und Codex

- **Codex** führt Befehle in seinem eigenen abgeschotteten Bereich aus, auch die, die Sie erlauben. Es kann nur in den Projektordner schreiben, das Internet ist gesperrt, und Ihre persönlichen Dateien außerhalb des Projekts kann es nicht lesen. Beim Start einer Sitzung prüft GenOffice zuerst, ob diese Abschottung auf diesem PC funktioniert, und startet nicht, wenn das nicht der Fall ist.
- **Claude Code** kann Befehle unter Windows nicht abschotten. Ein Befehl, den Sie erlauben, kann den ganzen PC und das Internet erreichen. Deshalb prüft bei **Diesem Projekt vertrauen** der eigene Prüfer von Claude Code jede Aktion an Ihrer Stelle.

Ein Dokument, das Ihnen jemand geschickt hat, kann versteckte Anweisungen enthalten, die die KI zu etwas anderem verleiten. Wählen Sie in einem Ordner mit Unterlagen, die Sie nicht kennen, eine der Optionen, die nachfragen.

## Projekthinweise und Skills

- Enthält der Ordner eine `CLAUDE.md` oder `AGENTS.md`, erhält der Agent deren Inhalt als Anweisung. Halten Sie dort fest, was jedes Mal gelten soll: Tonfall, Begriffe, das Format der zu erstellenden Dokumente.
- Claude Code erhält eine Kopie der Skills an diesen Orten: `.claude/skills` im Projektordner, `.ieumoffice/skills` und `.claude/skills` in Ihrem Benutzerordner sowie die Skills installierter Claude-Plugins. Die Zahl der verfügbaren Skills erscheint unter der Zeile, die den Start der Sitzung meldet.
- Codex liest seinen eigenen Skills-Ordner selbst.
- Programme, die die Skripte eines Skills verwenden (Python usw.), müssen auf diesem PC installiert sein.

## Neue Dateien und geöffnete Dokumente

- Neue Dateien, die der Agent erstellt, werden im Projektordner gespeichert. Klicken Sie in der betreffenden Zeile des Verlaufsprotokolls auf **Öffnen**, um die Datei in einem GenOffice-Tab zu öffnen.
- Soll ein geöffnetes Dokument bearbeitet werden, öffnen Sie es zuerst in GenOffice und nennen Sie es in Ihrer Anfrage.
- Ein Dokument, das Sie während einer Sitzung öffnen, lässt sich ab Ihrer nächsten Nachricht bearbeiten.

## Datenschutz und Verbrauch

- Was Sie vor der KI verborgen haben, bleibt nur dann verborgen, wenn die App ein in GenOffice geöffnetes Dokument für den Agenten liest. Dateien, die der Agent selbst aus dem Ordner liest, werden unverändert gesendet.
- Der Agent arbeitet in vielen Schritten und verbraucht daher mehr von Ihrem Abo-Limit als der KI-Bereich. Ist das Limit aufgebraucht, schlägt die Anfrage fehl; der Agent wechselt nie zu einer anderen KI oder zu einer kostenpflichtigen Verbindung.

## Wenn etwas schiefgeht

| Was im Fenster steht                                                                 | Was zu tun ist                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **Nicht verbunden**                                                                  | Melden Sie sich unter **Einstellungen ▸ KI** bei diesem Programm an.      |
| **Dieser Ordner kann nicht verwendet werden**                                        | Wählen Sie einen Ordner, der nur Ihre Arbeitsunterlagen enthält.          |
| **Codex kann auf diesem PC die Sandbox, die seine Befehle abschottet, nicht öffnen** | Aktualisieren Sie Windows oder wählen Sie Claude Code.                    |
| **Das Limit Ihres Abos ist aufgebraucht**                                            | Senden Sie erneut, sobald das Limit zurückgesetzt ist.                    |
| **Das Programm ist zu alt für den Agentenmodus**                                     | Aktualisieren Sie das Programm und klicken Sie dann auf **Neue Sitzung**. |
