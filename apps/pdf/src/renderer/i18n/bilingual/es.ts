import type { zh } from './zh'

export const es = {
  blToggle: 'Traducción en paralelo',
  blToggleTip:
    'Muestra la traducción guardada junto a cada página. Activarla no envía nada a una IA.',
  blLanguage: 'Idioma de la traducción',
  blStoredLangs: 'Traducciones guardadas',
  blOtherLangs: 'Otros idiomas',
  blLoading: 'Leyendo la estructura del documento… ({done}/{total} páginas)',
  blLoadingStart: 'Leyendo la estructura del documento…',
  blFailed:
    'No se pudo leer la estructura del documento, así que no se puede mostrar la columna de traducción.',
  blUnavailable:
    'La columna de traducción no está disponible: el archivo no está guardado o esta ventana no puede leer la estructura del documento.',
  blUnsavedPages: 'Guarda para alinear la columna de traducción con las páginas',
  blContinued: 'Continúa de la página anterior',
  blCollapseAsk: '¿Contraer la columna de traducción?',
  blCollapse: 'Contraer',
  blKeep: 'Dejar así',
  blExpand: 'Expandir la columna de traducción',
  blFontSmaller: 'Texto de traducción más pequeño',
  blFontLarger: 'Texto de traducción más grande',
  blResize: 'Cambiar el ancho de la columna de traducción',
  blClose: 'Desactivar la traducción en paralelo',
  blPageHeader: 'Página {page}',
  blPageCount: 'Traducido {translated}/{units}',
  blNoText: 'Esta página no tiene texto para traducir.',
  blPendingTip: 'Aún sin traducir (texto original).',
  blFailedTip: 'No se pudo traducir este párrafo (texto original).',
  blEditedTip: 'Traducción editada por una persona.',
} satisfies Record<keyof typeof zh, string>
