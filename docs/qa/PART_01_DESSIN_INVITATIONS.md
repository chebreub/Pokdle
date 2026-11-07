# PART-01 — Invitation directe à Dessine-le ! (Pokédle)

**État :** en PR ; ne compter PART-01 dans le total des 43 actions qu'après tests GitHub verts, fusion et vérification du nouveau `main`.

## Parcours retenu

1. Le joueur clique sur **Dessine-le !** depuis « À plusieurs », saisit un **pseudo** et crée le salon. Le serveur crée directement un salon en mode `dessin` : aucun changement de jeu asynchrone n'est nécessaire après la création.
2. Il clique sur **Copier l'invitation**. Le lien `https://pokdle.fr/?party=ABCDE&game=dessin` comporte seulement un code de salon et la désignation du jeu ; jamais un jeton de reconnexion ou une identité. Les autres jeux continuent de générer les anciens liens `?party=ABCDE`.
3. L'ami ouvre le lien sur téléphone ou PC : l'écran Party Room s'ouvre, le code est prérempli, et le serveur indique si l'invitation Dessine-le est valable. **Aucun compte n'est exigé** : seul un pseudo est demandé, et le bouton Rejoindre reste la confirmation de l'utilisateur.
4. Le serveur recontrôle le mode attendu au moment de `party:join-room` (pas uniquement lors de l'aperçu). Une invitation devenue obsolète ne peut donc pas envoyer le joueur dans un autre jeu après modification par l'hôte.
5. L'aperçu distingue explicitement : **invitation expirée** (salon supprimé ou vide), **jeu changé**, **partie démarrée** et **salon complet**. La fenêtre de reconnexion d'une place existante et les liens génériques existants sont conservés.

## Autorité et confidentialité

- Le code est un pointeur vers un salon **en mémoire** sur le serveur : il est valide tant qu'un salon rejointable existe. Il ne constitue ni une réservation, ni un accès à un jeu terminé, ni un compte.
- L'événement `party:invite-preview` dispose d'une limite distincte (8 demandes par socket et 30 par IP sur 30 secondes), afin que la consultation du lien ne consomme pas la limite de création/entrée `room-join` et ne communique que `code`, `gameMode` et `seatsLeft` ; pas de pseudo, identifiants, scores, secret Pokémon ou `resumeToken`.
- Les règles de capacité 2–8 joueurs, contrôle serveur du pseudo, impossibilité de rejoindre une partie déjà démarrée, rôle de l'hôte, et récompenses restent inchangées.
- Les salons vides sont annoncés expirés même pendant la courte période précédant leur nettoyage serveur. Aucune migration, nouvelle donnée utilisateur ou modification de sauvegardes.

## Régressions attendues

- `App/test/part01-party-invites.test.js` : statuts purs, absence de données privées et branchement des vérifications serveur.
- `App/test/home-party-2026-10-31.test.js` : création directe `dessin` sans second événement `party:set-mode`.
- `tools/part01_invite_quality.py` : véritable parcours de deux navigateurs en invité sur Chromium mobile et WebKit desktop : création, copie du lien, aperçu, entrée sans compte, changement de mode refusé, ancien lien générique préservé, expiration après sortie.
- Les tests de régression du site ainsi que `Browser and database quality` doivent être **verts sur le dernier head** avant fusion. Test Render et recette sur iPhone physique distincts et non revendiqués.

## Hors périmètre

Pas de création de compte obligatoire, de nouvelle fonctionnalité sociale, d'invitation persistante en PostgreSQL, de modification du chat, des récompenses, des Pokédollars, de la capture, du Pokédex ni d'accès public à un secret de partie.
