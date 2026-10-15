# Mode agent

L’agent prend comme projet un dossier que vous choisissez et lance dans ce dossier le Claude Code ou le Codex de ce PC. L’IA lit elle-même le contenu du dossier, crée de nouveaux fichiers, utilise des compétences et des scripts, et modifie les documents ouverts dans GenOffice. Servez-vous-en pour un travail qui s’appuie sur beaucoup de sources.

## Avant de commencer

- Un abonnement Claude ou un abonnement ChatGPT connecté dans **Paramètres ▸ IA**. La rubrique « Connexion par abonnement » explique comment faire.
- Un dossier qui rassemble vos sources. Un lecteur entier, la totalité de votre dossier personnel et les dossiers de données de connexion ou d’application ne peuvent pas être choisis.

## Démarrer une session

1. Sur l’accueil, cliquez sur la carte **Agent**. La fenêtre de l’agent s’ouvre à part.
2. Cliquez sur **Choisir un dossier…** pour sélectionner le dossier du projet. Les dossiers utilisés récemment figurent sous **Dossiers récents**.
3. Sous **Programme**, choisissez Claude Code ou Codex. Un programme qui n’est pas connecté ne peut pas être choisi.
4. Sous **Quand vous demander**, choisissez la façon dont l’agent vous demande l’autorisation (tableau ci-dessous).
5. La première fois, lisez **Avant de commencer** et cliquez sur **J’ai compris**.
6. Cliquez sur **Démarrer**, écrivez ce que vous voulez faire faire, puis cliquez sur **Envoyer**.

Une fenêtre correspond à une session. Fermer la fenêtre ou cliquer sur **Arrêter** met fin à la session, et le programme que GenOffice a lancé pour elle s’arrête aussi. Une session prend également fin après 30 minutes sans aucun envoi.

## Comment l’agent vous demande

| Choix                                           | Se fait directement                                                                   | Demande d’abord                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Demander avant chaque commande** (par défaut) | Lire et écrire des fichiers dans le dossier du projet, modifier les documents ouverts | Exécuter une commande ou un script, lire hors du dossier du projet          |
| **Demander avant l’écriture et les commandes**  | Lire des fichiers dans le dossier du projet, modifier les documents ouverts           | Écrire un fichier, exécuter une commande ou un script, lire hors du dossier |
| **Faire confiance à ce projet**                 | Presque tout                                                                          | Lire hors du dossier du projet                                              |

Quand l’agent demande, la fenêtre montre ce qu’il veut faire (la commande complète, le chemin du fichier). Cliquez sur **Autoriser** ou **Refuser**.

Quel que soit votre choix, l’agent ne peut pas :

- Écraser le fichier d’un document ouvert dans un onglet GenOffice. Les documents ouverts sont modifiés par l’intermédiaire de l’application : la modification apparaît aussitôt dans l’éditeur, et la fonction Annuler de l’éditeur la défait.
- Écrire hors du dossier du projet.
- Toucher aux données de connexion de Claude ou de Codex, ni au dossier de données de GenOffice.

## Claude Code et Codex

- **Codex** exécute les commandes dans son propre espace isolé, y compris celles que vous autorisez. Il ne peut écrire que dans le dossier du projet, Internet lui est fermé, et il ne peut pas lire vos fichiers personnels hors du projet. Au début d’une session, GenOffice vérifie d’abord que cet isolement fonctionne sur ce PC, et ne démarre pas si ce n’est pas le cas.
- **Claude Code** ne peut pas isoler les commandes sous Windows. Une commande que vous autorisez peut atteindre tout le PC et Internet. C’est pourquoi, avec **Faire confiance à ce projet**, c’est le propre vérificateur de Claude Code qui contrôle chaque action à votre place.

Un document que quelqu’un vous a envoyé peut contenir des instructions cachées qui poussent l’IA à faire autre chose. Dans un dossier dont vous ne connaissez pas le contenu, choisissez une des options qui vous demandent.

## Notes de projet et compétences

- Si le dossier contient un `CLAUDE.md` ou un `AGENTS.md`, son contenu est transmis à l’agent comme instructions. Notez-y ce qui doit valoir à chaque fois : le ton, les termes, le format des documents à produire.
- Claude Code reçoit une copie des compétences situées à ces endroits : `.claude/skills` dans le dossier du projet, `.ieumoffice/skills` et `.claude/skills` dans votre dossier personnel, et les compétences des plugins Claude installés. Le nombre de compétences disponibles s’affiche sous la ligne qui annonce le démarrage de la session.
- Codex lit lui-même son propre dossier de compétences.
- Les programmes dont se servent les scripts d’une compétence (Python, etc.) doivent être installés sur ce PC.

## Nouveaux fichiers et documents ouverts

- Les nouveaux fichiers créés par l’agent sont enregistrés dans le dossier du projet. Cliquez sur **Ouvrir** sur la ligne correspondante du journal de progression pour ouvrir le fichier dans un onglet GenOffice.
- Pour faire modifier un document ouvert, ouvrez-le d’abord dans GenOffice et nommez-le dans votre demande.
- Un document que vous ouvrez pendant une session peut être modifié à partir de votre message suivant.

## Confidentialité et consommation

- Ce que vous avez masqué pour l’IA ne reste masqué que lorsque l’application lit pour l’agent un document ouvert dans GenOffice. Les fichiers que l’agent lit lui-même dans le dossier sont envoyés tels quels.
- L’agent travaille en de nombreuses étapes : il consomme donc davantage la limite de votre abonnement que le panneau IA. Quand la limite est atteinte, la demande échoue ; l’agent ne passe jamais à une autre IA ni à une connexion payante.

## En cas de problème

| Ce qu’indique la fenêtre                              | Que faire                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| **Non connecté**                                      | Connectez-vous à ce programme dans **Paramètres ▸ IA**.             |
| **Ce dossier ne peut pas être utilisé**               | Choisissez un dossier qui ne contient que vos documents de travail. |
| **Codex ne peut pas ouvrir sur ce PC le bac à sable** | Mettez Windows à jour ou choisissez Claude Code.                    |
| **La limite de votre abonnement est atteinte**        | Renvoyez la demande une fois la limite réinitialisée.               |
| **Le programme est trop ancien pour le mode agent**   | Mettez ce programme à jour, puis cliquez sur **Nouvelle session**.  |
