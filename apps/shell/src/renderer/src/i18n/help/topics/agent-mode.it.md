# Modalità agente

L'agente prende come progetto una cartella che scegli tu ed esegue in quella cartella il Claude Code o il Codex di questo PC. L'IA legge da sola il materiale della cartella, crea nuovi file, usa skill e script e modifica i documenti aperti in GenOffice. Usalo per i lavori che attingono a molto materiale.

## Prima di iniziare

- Un abbonamento Claude o un abbonamento ChatGPT collegato in **Impostazioni ▸ IA**. L'argomento «Connessione con abbonamento» spiega come fare.
- Una cartella con il tuo materiale. Non si possono scegliere un'intera unità, tutta la tua cartella utente né le cartelle con dati di accesso o delle app.

## Avviare una sessione

1. In Home, fai clic sulla scheda **Agente**. La finestra dell'agente si apre a parte.
2. Fai clic su **Scegli una cartella…** per selezionare la cartella del progetto. Le cartelle usate di recente sono elencate in **Cartelle recenti**.
3. In **Programma**, scegli Claude Code o Codex. Un programma non collegato non si può scegliere.
4. In **Quando chiederti conferma**, scegli come l'agente ti chiede il permesso (tabella qui sotto).
5. La prima volta, leggi **Prima di iniziare** e fai clic su **Ho capito**.
6. Fai clic su **Avvia**, scrivi che cosa vuoi far fare e fai clic su **Invia**.

Una finestra è una sessione. Se chiudi la finestra o fai clic su **Interrompi**, la sessione termina e si chiude anche il programma che GenOffice ha avviato per essa. Una sessione termina anche dopo 30 minuti senza alcun invio.

## Come chiede l'agente

| Scelta                                             | Procede da solo                                                                    | Chiede prima                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Chiedi prima di ogni comando** (predefinita)     | Leggere e scrivere file nella cartella del progetto, modificare i documenti aperti | Eseguire un comando o uno script, leggere fuori dalla cartella del progetto      |
| **Chiedi prima di scrivere e di eseguire comandi** | Leggere file nella cartella del progetto, modificare i documenti aperti            | Scrivere un file, eseguire un comando o uno script, leggere fuori dalla cartella |
| **Fidati di questo progetto**                      | Quasi tutto                                                                        | Leggere fuori dalla cartella del progetto                                        |

Quando l'agente chiede, la finestra mostra che cosa vuole fare (il comando completo, il percorso del file). Fai clic su **Consenti** o **Rifiuta**.

Qualunque cosa tu scelga, l'agente non:

- Sovrascrive il file di un documento aperto in una scheda di GenOffice. I documenti aperti vengono modificati tramite l'app, quindi la modifica compare subito nell'editor e l'annullamento dell'editor la toglie.
- Scrive fuori dalla cartella del progetto.
- Tocca i dati di accesso di Claude o di Codex, né la cartella dei dati di GenOffice.

## Claude Code e Codex

- **Codex** esegue i comandi nel proprio spazio isolato, compresi quelli che consenti. Può scrivere solo nella cartella del progetto, internet è bloccato e non può leggere i tuoi file personali fuori dal progetto. All'avvio di una sessione, GenOffice verifica prima che questo isolamento funzioni su questo PC, e non parte se non funziona.
- **Claude Code** non può isolare i comandi su Windows. Un comando che consenti può raggiungere l'intero PC e internet. Per questo, con **Fidati di questo progetto**, è il revisore di Claude Code stesso a controllare ogni azione al posto tuo.

Un documento che qualcuno ti ha inviato può contenere istruzioni nascoste che dicono all'IA di fare altro. In una cartella con materiale che non conosci, usa una delle scelte che chiedono.

## Note di progetto e skill

- Se la cartella contiene un `CLAUDE.md` o un `AGENTS.md`, il suo contenuto viene dato all'agente come istruzioni. Scrivici ciò che deve valere ogni volta: il tono, i termini, il formato dei documenti da creare.
- Claude Code riceve una copia delle skill che si trovano in questi punti: `.claude/skills` nella cartella del progetto, `.ieumoffice/skills` e `.claude/skills` nella tua cartella utente, e le skill dei plugin Claude installati. Il numero di skill disponibili compare sotto la riga che indica l'avvio della sessione.
- Codex legge da solo la propria cartella delle skill.
- I programmi usati dagli script di una skill (Python e così via) devono essere installati su questo PC.

## Nuovi file e documenti aperti

- I nuovi file creati dall'agente vengono salvati nella cartella del progetto. Fai clic su **Apri** su quella riga del registro di avanzamento per aprire il file in una scheda di GenOffice.
- Per far modificare un documento aperto, aprilo prima in GenOffice e indicane il nome nella richiesta.
- Un documento che apri durante una sessione si può modificare a partire dal messaggio successivo.

## Privacy e consumo

- Ciò che hai nascosto all'IA resta nascosto solo quando è l'app a leggere per l'agente un documento aperto in GenOffice. I file che l'agente legge da solo dalla cartella vengono inviati così come sono.
- L'agente lavora in molti passaggi, quindi consuma più limite del tuo abbonamento rispetto al pannello IA. Quando il limite è esaurito, la richiesta non va a buon fine; l'agente non passa mai a un'altra IA né a una connessione a pagamento.

## Se qualcosa va storto

| Che cosa dice la finestra                                | Che cosa fare                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Non connesso**                                         | Accedi a quel programma da **Impostazioni ▸ IA**.                 |
| **Questa cartella non può essere usata**                 | Scegli una cartella che contenga solo il tuo materiale di lavoro. |
| **Codex non riesce ad aprire su questo PC la sandbox**   | Aggiorna Windows oppure scegli Claude Code.                       |
| **Il limite del tuo abbonamento è esaurito**             | Invia di nuovo quando il limite si azzera.                        |
| **Il programma è troppo vecchio per la modalità agente** | Aggiorna quel programma, poi fai clic su **Nuova sessione**.      |
