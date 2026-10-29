import type { zh } from './zh'

export const it = {
  navProjects: 'Progetti',
  intro:
    'Rendi una cartella un progetto: documenti, istruzioni, memoria e chat diventano il contesto del pannello IA. Tutto resta dentro quella cartella.',
  emptyHint: 'Ancora nessun progetto. Creane uno o aggiungi una cartella che usi già.',
  newNameLabel: 'Nome del nuovo progetto',
  create: 'Crea',
  cancel: 'Annulla',
  createExists: 'Esiste già una cartella con quel nome, quindi non è stato creato nulla: {path}',
  createInvalidName: 'Quel nome non si può usare per una cartella. Inserisci un altro nome.',
  createUnwritable: 'Impossibile creare la cartella. Prova a crearla altrove.',
  refusedDriveRoot:
    'Un’intera unità non può essere un progetto. Scegli una cartella al suo interno.',
  refusedUserHome:
    'L’intera cartella utente non può essere un progetto. Scegli una cartella al suo interno.',
  refusedProtected:
    'Questa cartella è usata dall’app o da un programma di IA, quindi non può essere un progetto.',
  refusedContainsProtected:
    'Questa cartella contiene una cartella usata dall’app o da un programma di IA, quindi non può essere un progetto.',
  refusedNotFolder: 'Impossibile leggere questa cartella.',
  refusedDifferentProject:
    'Quella cartella appartiene a un altro progetto, quindi non è cambiato nulla.',
  backToList: 'Tutti i progetti',
  projectNameLabel: 'Nome del progetto',
  saveName: 'Salva nome',
  renameHint: 'La cartella mantiene il suo nome.',
  openInExplorer: 'Apri in Esplora file',
  openInFinder: 'Mostra nel Finder',
  trustUse: 'Istruzioni e memoria vengono inviate all’IA',
  trustWithout: 'In uso senza istruzioni',
  trustWithoutDesc:
    'Istruzioni, memoria e chat di altri PC non vengono inviate all’IA, e non si raccoglie memoria.',
  trustUnconfirmed: 'Questa cartella non è ancora stata confermata',
  retry: 'Riprova',
  relocate: 'Scegli di nuovo la cartella',
  missingNote: 'Cartella non trovata. Se l’hai spostata, scegli la nuova posizione.',
  tabsLabel: 'Contenuto del progetto',
  tabInstructions: 'Istruzioni',
  tabMemory: 'Memoria',
  tabFiles: 'File',
  tabChats: 'Chat',
  instructionsDesc:
    'Regole di lavoro che l’IA segue in questo progetto. Accompagnano ogni richiesta di un pannello IA con questo progetto scelto.',
  instructionsPlaceholder:
    'Per esempio: scrivere i rapporti in tono formale e le date come 30 ott 2026.',
  save: 'Salva',
  saved: 'Salvato.',
  saveUnwritable: 'Impossibile scrivere in questa cartella, quindi non è stato salvato nulla.',
  alsoRead: 'Letti insieme',
  readAgentsFiles: 'Leggi come istruzioni anche AGENTS.md e CLAUDE.md in cima alla cartella',
  withoutNotSent:
    'Questo progetto è in uso senza istruzioni, quindi per ora non viene inviato all’IA.',
  memoryDesc:
    'Note che l’IA ha preso durante le chat. Elimina ciò che è sbagliato o non serve più.',
  memoryEnabled: 'Raccogli memoria',
  memoryEnabledDesc:
    'Se disattivata, l’IA non scrive nulla di nuovo. La memoria esistente viene ancora letta.',
  memoryLength: '{count} voci · {chars} caratteri',
  memoryEmpty: 'Ancora nessuna memoria.',
  memoryEditAll: 'Modifica tutto',
  memoryEditLabel: 'Tutta la memoria',
  memoryConflict: 'Ci sono copie da conflitto di sincronizzazione: {names}',
  consolidating: 'Riordino in corso…',
  stop: 'Ferma',
  consolidateConnect: 'Nessuna IA utilizzabile è collegata. Collegane una, poi premi di nuovo.',
  openAiSettings: 'Apri impostazioni IA',
  consolidateChecking: 'Verifica della connessione IA in corso. Premi di nuovo tra poco.',
  consolidateNotice: 'Leggi prima l’avviso sulla connessione IA, poi premi di nuovo.',
  consolidateNothing: 'Non c’è memoria da riordinare.',
  consolidateWithout:
    'Questo progetto è in uso senza istruzioni, quindi la sua memoria non può essere inviata all’IA. Passa all’uso delle istruzioni qui sopra per riordinarla.',
  consolidateFailed: 'Impossibile riordinare. La memoria è invariata.',
  consolidateStopped: 'Fermato. La memoria è invariata.',
  consolidateUndone: 'Tornato a com’era prima del riordino.',
  undoFailed: 'Impossibile annullare.',
  removeMemoryAria: 'Elimina questa memoria: {text}',
  filesDesc:
    'File che l’IA può vedere in questo progetto. I file nascosti e la cartella .ieumoffice sono esclusi.',
  filesEmpty: 'Non ci sono file che l’IA può vedere.',
  filesLoadFailed: 'Impossibile leggere l’elenco dei file.',
  filesCount: '{count} file',
  loadMore: 'Mostra altro',
  noExt: 'Nessun tipo',
  notOnPc: 'Non su questo PC',
  notOnPcTitle:
    'Questo file è solo nel cloud. Se l’IA vuole leggerlo, ti viene chiesto prima di scaricarlo.',
  hideFromAi: 'Nascondi all’IA',
  hideFromAiAria: 'Nascondi all’IA: {name}',
  ignoredTitle: 'File nascosti all’IA',
  ignoredDesc:
    'Questo elenco appare solo in questa schermata. Annulla per far rivedere un file all’IA.',
  ignoredEmpty: 'Nessuno.',
  restoreAria: 'Annulla: {name}',
  chatsDesc:
    'Le chat di questo progetto. Fai clic su una per continuarla nel pannello IA dell’ultimo documento che l’ha usata.',
  deleteConfirm: 'Spostare la chat «{title}» nel cestino?',
  actionFailed: 'Non ha funzionato. Riprova.',
  loadFailed: 'Impossibile leggere il progetto.',
} satisfies Record<keyof typeof zh, string>
