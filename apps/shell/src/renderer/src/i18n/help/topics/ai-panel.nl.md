# Het AI-assistentpaneel

Elke editor kan het AI-paneel oproepen: selecteer iets, geef een instructie en zie het gestreamde resultaat.

## Openen en gebruiken

- Het paneel heeft een verbonden AI nodig. Is er geen verbonden, dan toont het de verbindingskaarten in plaats van een foutmelding; zie [Abonnementsverbinding](help://subscription).
- Instappen: de **AI-knop** op het lint van elke editor, **Vraag AI** in contextmenu's, of Vraag AI op de markeringsbalk.
- Beschrijf de taak in gewone taal (herschrijf dit / maak deze kolom percentages / herbereken deze pagina...) en druk op Enter.
- Antwoorden worden **gestreamd** weergegeven; heeft de AI gereedschap nodig (het document lezen, het bewerken), dan voert het dat uit en gaat het door tot het klaar is.
- **Stop**: onderbreek de huidige beurt op elk moment.
- **Wachtrij**: terwijl een antwoord binnenstroomt, zet Enter uw bericht in de wachtrij in plaats van het weg te gooien — een strook boven het invoerveld telt ze; open hem om te bewerken, verwijderen, herordenen, pauzeren of wissen. Het volgende bericht verstuurt zichzelf wanneer de beurt eindigt; Esc stopt nog steeds de beurt.

## Welke AI antwoordt

- De modellenlijst onder in het paneel toont de AI die in gebruik is en laat je een andere kiezen: eerst je abonnementen, daarna de providers met een sleutel die je hebt ingesteld.
- Zodra je 80% of meer van een abonnementslimiet hebt gebruikt, verschijnt in het paneel een regel zoals "85% gebruikt · herstelt om 15:00".
- Wordt een verzoek gestopt — de limiet is bereikt of de aanmelding is verlopen — dan zegt het paneel waarom en schakelt het niet vanzelf over op een andere AI. Is je andere abonnement verbonden, dan biedt een knop **Doorgaan met …** dat aan.

## Wat het kan

- **Docs**: herschrijven/uitbreiden/vertalen/samenvatten, tabellen en afbeeldingen invoegen, opmaak aanpassen; elke beurt maakt eerst een momentopname.
- **Sheets**: formules, gegevens invullen, bulktransformaties, opmaak.
- **Slides**: de hele presentatie genereren, indeling bijstellen, teksten herschrijven.
- **PDF**: vragen en antwoorden en samenvattingen op basis van geselecteerde tekst of pagina's.
- **Markdown / HTML**: herschrijven, uitbreiden, vertalen.
- **Start ▸ Ask AI** antwoordt uit uw bestanden met ster en citeert ze — het kennisbank-paneel heeft een eigen sectie in het hoofdstuk Start, en het AI-paneel van Docs heeft dezelfde vaardigheid.

## Terugdraaien en veiligheid

- Het paneel in Docs houdt een **versielijst** bij: één momentopname per beurt, je kunt naar elke terug en die terugstap is zelf met Ctrl+Z ongedaan te maken. Momentopnamen blijven bestaan als je het document opnieuw opent.
- AI-bewerkingen lopen via dezelfde bewerkingsroute als handmatige bewerkingen (ongedaan te maken, pas bij opslaan vastgelegd) — niets slaat je opslagbevestiging over.

## Een selectie voor de AI verbergen

- In Slides, HTML en Markdown kan een selectie uit het zicht van het model worden gehouden: rechtsklik ▸ **Selectie voor AI verbergen**, geef de placeholder een naam, en het model leest `{{naam}}` op zijn plaats. (Markdown activeert het item met de oog-uit-schakelaar op zijn lint; die van HTML zit in het bronpaneel.)
- Het bestand houdt de echte tekst — opslaan, exporteren en afdrukken blijven onaangetast, en de markering overleeft het opnieuw openen. Hetzelfde item maakt zichtbaar (Markdown krijgt een apart item **Selectie weer aan AI tonen**).
- HTML verbergt elementinhouden, attribuutwaarden en stringliteraalss in scripts; de gerenderde pagina verandert nooit.
- Slides verbergt ook hele afbeeldingen, video's en audio, en een dia met verborgen inhoud wordt nooit als screenshot verstuurd: de automatische lay-outcontrole slaat de pagina over en meldt dat.
- Dit geldt alleen voor de AI in de app — de CLI, MCP-tools en headless-export lezen het bestand rechtstreeks en zien de tekst nog steeds.

## Privacy

- Instructies en de relevante documentinhoud gaan naar de **AI die je gebruikt**: naar Anthropic of OpenAI onder je eigen account als je een abonnement gebruikt, of naar de provider waarvan je de sleutel hebt ingevuld. Is er geen AI verbonden, dan wordt er niets verstuurd.
- Of de inhoud bij een abonnement wordt gebruikt om AI te trainen, wordt bepaald door de instellingen van je eigen account bij dat bedrijf.
- Lokale bestanden worden nergens anders heen geüpload; API-sleutels worden opgeslagen in het instellingenbestand van de app op deze machine en alleen in aanvraagheaders verzonden.
