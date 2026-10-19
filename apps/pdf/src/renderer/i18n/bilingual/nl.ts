import type { zh } from './zh'

export const nl = {
  blToggle: 'Vertaling naast elkaar',
  blToggleTip:
    'Toont de opgeslagen vertaling naast elke pagina. Inschakelen stuurt niets naar een AI.',
  blLanguage: 'Taal van de vertaling',
  blStoredLangs: 'Opgeslagen vertalingen',
  blOtherLangs: 'Andere talen',
  blLoading: 'Documentstructuur lezen… ({done}/{total} pagina’s)',
  blLoadingStart: 'Documentstructuur lezen…',
  blFailed:
    'De documentstructuur kon niet worden gelezen, dus de vertaalkolom kan niet worden getoond.',
  blUnavailable:
    'De vertaalkolom is niet beschikbaar: het bestand is niet opgeslagen, of dit venster kan de documentstructuur niet lezen.',
  blUnsavedPages: 'Sla op om de vertaalkolom op de pagina’s af te stemmen',
  blContinued: 'Vervolg van de vorige pagina',
  blCollapseAsk: 'Vertaalkolom inklappen?',
  blCollapse: 'Inklappen',
  blKeep: 'Laten staan',
  blExpand: 'Vertaalkolom uitklappen',
  blFontSmaller: 'Kleinere vertaaltekst',
  blFontLarger: 'Grotere vertaaltekst',
  blResize: 'Breedte van de vertaalkolom aanpassen',
  blClose: 'Vertaling naast elkaar uitschakelen',
  blPageHeader: 'Pagina {page}',
  blPageCount: 'Vertaald {translated}/{units}',
  blNoText: 'Deze pagina heeft geen tekst om te vertalen.',
  blPendingTip: 'Nog niet vertaald (brontekst).',
  blFailedTip: 'Deze alinea kon niet worden vertaald (brontekst).',
  blEditedTip: 'Vertaling bewerkt door een persoon.',
} satisfies Record<keyof typeof zh, string>
