import type { zh } from './zh'

export const nl = {
  cardChecking: 'Controleren…',
  cardNotInstalled: 'Niet geïnstalleerd',
  cardSignedOut: 'Niet aangemeld',
  cardReady: 'Verbonden',
  cardReadyPlan: 'Verbonden · {plan}',
  cardMetered: 'Aangemeld, maar niet met een abonnement',
  cardMeteredAccepted: 'In gebruik · betaald per verbruik',
  cardError: 'De verbinding kon niet worden gecontroleerd',
  actionInstall: 'Installeren',
  actionLogin: 'Aanmelden',
  actionRecheck: 'Opnieuw controleren',
  actionAcceptMetered: 'Toch gebruiken',
  actionInstallHelp: 'Officiële installatiehandleiding',
  actionOpenSettings: 'Instellingen openen',
  actionDismiss: 'Sluiten',
  installNote:
    'De officiële installatieopdracht van {vendor} wordt uitgevoerd in een nieuw terminalvenster.',
  loginNote: 'De aanmeldpagina die wordt geopend is van {vendor} zelf.',
  meteredWarning: 'Dit is geen abonnement: je betaalt voor wat je gebruikt.',
  meteredMeaning:
    'Deze aanmelding gebruikt een API-sleutel of een account met betaling per verbruik, of het type kon niet worden vastgesteld. Met ‘Toch gebruiken’ draait AI via deze verbinding en wordt elk verzoek bij dat account in rekening gebracht.',
  connectTitle: 'Koppel een abonnement om AI te gebruiken',
  connectBody:
    'AI draait op het Claude- of Codex-abonnement dat je al hebt. Een API-sleutel is niet nodig.',
  connectProviderTitle: 'De verbinding {provider} is nu niet bruikbaar',
  connectKeyBody:
    'De configuratie van {provider} is nog niet af. Rond die af in Instellingen of kies een andere AI.',
  errNotConnected: 'Er is geen AI verbonden. Koppel eerst een Claude- of Codex-abonnement.',
  errNotInstalled: 'Het programma {provider} is niet gevonden op deze pc.',
  errSignedOut: 'De aanmelding bij {provider} is verlopen. Meld je opnieuw aan om door te gaan.',
  errRateLimit: 'De limiet van het abonnement {provider} is bereikt.',
  errRateLimitReset:
    'De limiet van het abonnement {provider} is bereikt. Deze wordt om {time} hersteld.',
  errUnsafeTools:
    'Het programma {provider} is gestart met eigen hulpmiddelen ingeschakeld; de uitvoering is uit veiligheid gestopt.',
  errMeteredNotAccepted:
    'De verbinding {provider} wordt per verbruik betaald en je hebt die nog niet toegestaan. Kies ‘Toch gebruiken’ in de verbindingsinstellingen om deze te gebruiken.',
  errNeedsUpdate:
    'Het programma {provider} is te oud voor deze functie. Werk het bij en probeer het opnieuw.',
  errHeadlessLimit: 'De uurlimiet voor automatische verzoeken is bereikt.',
  errHeadlessLimitReset:
    'De uurlimiet voor automatische verzoeken is bereikt. Verzoeken zijn weer mogelijk om {time}.',
  continueWith: 'Doorgaan met {provider}',
  continueMeteredNote:
    'De verbinding {provider} is geen abonnement: doorgaan wordt per verbruik in rekening gebracht.',
  usageLine: '{percent}% gebruikt · herstelt om {time}',
  usageWindowFiveHour: 'Limiet per 5 uur',
  usageWindowSevenDay: 'Limiet per 7 dagen',
  noticeTitle: 'Voordat je AI met je abonnement gebruikt',
  noticeSend:
    'De inhoud van het document en je gesprek worden onder je eigen account naar Anthropic of OpenAI verzonden.',
  noticeTraining:
    'Of die inhoud wordt gebruikt om AI te trainen, wordt bepaald door de instellingen van je eigen account bij dat bedrijf.',
  noticeCodexHistory:
    'Deze app zet het opslaan van de gespreksgeschiedenis in Codex uit, maar Codex kan nog steeds eigen diagnostische logboeken op deze pc bewaren.',
  noticeAck: 'Begrepen',
  codexNotice:
    'Een Codex-abonnement gebruiken in een app is geen methode die OpenAI officieel aanbeveelt.',
  truncatedNotice: 'De invoer was te lang; een deel is afgekapt voordat deze werd verzonden.',
  pickerAuto: 'Automatisch',
  pickerAutoUsing: 'Automatisch · {provider}',
  pickerDefaultModel: 'Standaardmodel',
  pickerSubscription: 'Abonnement',
  pickerPaid: 'Betaald',
  pickerPaidTitle: 'Betaald per verbruik, valt niet onder een abonnement',
  pickerNotConnected: 'AI koppelen',
} satisfies Record<keyof typeof zh, string>
