import type { zh } from './zh'

export const it = {
  blToggle: 'Traduzione a fronte',
  blToggleTip:
    'Mostra la traduzione salvata accanto a ogni pagina. Attivarla non invia nulla a un’IA.',
  blLanguage: 'Lingua della traduzione',
  blStoredLangs: 'Traduzioni salvate',
  blOtherLangs: 'Altre lingue',
  blLoading: 'Lettura della struttura del documento… ({done}/{total} pagine)',
  blLoadingStart: 'Lettura della struttura del documento…',
  blFailed:
    'Impossibile leggere la struttura del documento: la colonna della traduzione non può essere mostrata.',
  blUnavailable:
    'La colonna della traduzione non è disponibile: il file non è salvato oppure questa finestra non può leggere la struttura del documento.',
  blUnsavedPages: 'Salva per allineare la colonna della traduzione alle pagine',
  blContinued: 'Continua dalla pagina precedente',
  blCollapseAsk: 'Comprimere la colonna della traduzione?',
  blCollapse: 'Comprimi',
  blKeep: 'Lascia così',
  blExpand: 'Espandi la colonna della traduzione',
  blFontSmaller: 'Testo della traduzione più piccolo',
  blFontLarger: 'Testo della traduzione più grande',
  blResize: 'Ridimensiona la colonna della traduzione',
  blClose: 'Disattiva la traduzione a fronte',
  blPageHeader: 'Pagina {page}',
  blPageCount: 'Tradotti {translated}/{units}',
  blNoText: 'Questa pagina non ha testo da tradurre.',
  blPendingTip: 'Non ancora tradotto (testo originale).',
  blFailedTip: 'Impossibile tradurre questo paragrafo (testo originale).',
  blEditedTip: 'Traduzione modificata da una persona.',
} satisfies Record<keyof typeof zh, string>
