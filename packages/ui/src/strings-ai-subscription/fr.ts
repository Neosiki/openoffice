import type { zh } from './zh'

export const fr = {
  aiAssistant: 'Assistant IA',
  cardChecking: 'Vérification…',
  cardNotInstalled: 'Non installé',
  cardSignedOut: 'Non connecté',
  cardReady: 'Connecté',
  cardReadyPlan: 'Connecté · {plan}',
  cardMetered: 'Connecté, mais pas avec un abonnement',
  cardMeteredAccepted: 'En service · facturé à l’usage',
  cardError: 'Impossible de vérifier la connexion',
  cardErrNeedsUpdate:
    'Le programme {provider} installé sur ce PC est trop ancien. Mettez-le à jour, puis vérifiez à nouveau.',
  cardErrTimeout:
    "Le programme {provider} n'a pas répondu à temps. Vérifiez à nouveau dans un instant.",
  cardErrFailed:
    'Un problème est survenu lors de la vérification de {provider}. Vérifiez à nouveau.',
  actionInstall: 'Installer',
  actionLogin: 'Se connecter',
  actionRecheck: 'Vérifier à nouveau',
  actionAcceptMetered: 'Utiliser quand même',
  actionInstallHelp: 'Guide d’installation officiel',
  actionOpenSettings: 'Ouvrir les paramètres',
  actionDismiss: 'Fermer',
  installNote:
    'La commande d’installation officielle de {vendor} s’exécute dans une nouvelle fenêtre de terminal.',
  loginNote: 'La page de connexion qui s’ouvre est celle de {vendor}.',
  meteredWarning: 'Ce n’est pas un abonnement : vous payez ce que vous consommez.',
  meteredMeaning:
    'Cette connexion utilise une clé API ou un compte facturé à l’usage, ou son type n’a pas pu être confirmé. « Utiliser quand même » permet à l’IA de fonctionner avec cette connexion, et chaque requête est facturée à ce compte.',
  connectTitle: 'Connectez un abonnement pour utiliser l’IA',
  connectBody:
    'L’IA fonctionne avec l’abonnement Claude ou Codex que vous avez déjà. Aucune clé API n’est nécessaire.',
  connectProviderTitle: 'La connexion {provider} n’est pas utilisable pour le moment',
  connectKeyBody:
    'La configuration de {provider} n’est pas terminée. Terminez-la dans les paramètres ou choisissez une autre IA.',
  errNotConnected: 'Aucune IA n’est connectée. Connectez d’abord un abonnement Claude ou Codex.',
  errNotInstalled: 'Le programme {provider} est introuvable sur ce PC.',
  errSignedOut: 'La connexion à {provider} a expiré. Reconnectez-vous pour continuer.',
  errRateLimit: 'La limite de l’abonnement {provider} est atteinte.',
  errRateLimitReset:
    'La limite de l’abonnement {provider} est atteinte. Réinitialisation à {time}.',
  errUnsafeTools:
    'Le programme {provider} a démarré avec ses propres outils activés ; l’exécution a été arrêtée par sécurité.',
  errMeteredNotAccepted:
    'La connexion {provider} est facturée à l’usage et vous ne l’avez pas encore autorisée. Choisissez « Utiliser quand même » dans les paramètres de connexion pour l’utiliser.',
  errNeedsUpdate:
    'Le programme {provider} est trop ancien pour cette fonction. Mettez-le à jour puis réessayez.',
  errHeadlessLimit: 'La limite horaire des requêtes automatiques est atteinte.',
  errHeadlessLimitReset:
    'La limite horaire des requêtes automatiques est atteinte. Les requêtes seront de nouveau possibles à {time}.',
  continueWith: 'Continuer avec {provider}',
  continueMeteredNote:
    'La connexion {provider} n’est pas un abonnement : continuer est facturé à l’usage.',
  usageLine: '{percent} % utilisés · réinitialisation à {time}',
  usageWindowFiveHour: 'Limite sur 5 heures',
  usageWindowSevenDay: 'Limite sur 7 jours',
  noticeTitle: 'Avant d’utiliser l’IA avec votre abonnement',
  noticeSend:
    'Le contenu du document et votre conversation sont envoyés à Anthropic ou à OpenAI sous votre propre compte.',
  noticeTraining:
    'L’utilisation de ce contenu pour entraîner l’IA dépend des paramètres de votre propre compte auprès de cette société.',
  noticeCodexHistory:
    'Cette application désactive l’enregistrement de l’historique des conversations de Codex, mais Codex peut tout de même conserver ses propres journaux de diagnostic sur ce PC.',
  noticeAck: 'Compris',
  codexNotice:
    'Utiliser un abonnement Codex dans une application n’est pas une méthode officiellement recommandée par OpenAI.',
  truncatedNotice: 'L’entrée était trop longue : une partie a été coupée avant l’envoi.',
  pickerAuto: 'Automatique',
  pickerAutoUsing: 'Automatique · {provider}',
  pickerDefaultModel: 'Modèle par défaut',
  pickerSubscription: 'Abonnement',
  pickerPaid: 'Payant',
  pickerPaidTitle: 'Facturé à l’usage, non couvert par un abonnement',
  pickerNotConnected: 'Connecter l’IA',
} satisfies Record<keyof typeof zh, string>
