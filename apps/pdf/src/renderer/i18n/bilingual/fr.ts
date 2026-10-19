import type { zh } from './zh'

export const fr = {
  blToggle: 'Traduction en regard',
  blToggleTip:
    'Affiche la traduction enregistrée à côté de chaque page. L’activer n’envoie rien à une IA.',
  blLanguage: 'Langue de la traduction',
  blStoredLangs: 'Traductions enregistrées',
  blOtherLangs: 'Autres langues',
  blLoading: 'Lecture de la structure du document… ({done}/{total} pages)',
  blLoadingStart: 'Lecture de la structure du document…',
  blFailed:
    'Impossible de lire la structure du document : la colonne de traduction ne peut pas s’afficher.',
  blUnavailable:
    'La colonne de traduction n’est pas disponible : le fichier n’est pas enregistré, ou cette fenêtre ne peut pas lire la structure du document.',
  blUnsavedPages: 'Enregistrez pour aligner la colonne de traduction sur les pages',
  blContinued: 'Suite de la page précédente',
  blCollapseAsk: 'Replier la colonne de traduction ?',
  blCollapse: 'Replier',
  blKeep: 'Laisser',
  blExpand: 'Déplier la colonne de traduction',
  blFontSmaller: 'Texte de traduction plus petit',
  blFontLarger: 'Texte de traduction plus grand',
  blResize: 'Redimensionner la colonne de traduction',
  blClose: 'Désactiver la traduction en regard',
  blPageHeader: 'Page {page}',
  blPageCount: 'Traduit {translated}/{units}',
  blNoText: 'Cette page n’a pas de texte à traduire.',
  blPendingTip: 'Pas encore traduit (texte source).',
  blFailedTip: 'Ce paragraphe n’a pas pu être traduit (texte source).',
  blEditedTip: 'Traduction modifiée par une personne.',
} satisfies Record<keyof typeof zh, string>
