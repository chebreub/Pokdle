# Recette Pokédle — 7 septembre 2026

Base : `6be408389579611d4e9b1a2dfaca08a0835977fa` (main, après la correction des thèmes).

## Conclusion

Les parcours testés ont permis de corriger des défauts réels de navigation, d’affichage mobile et de calcul des scores multijoueurs. Ce contrôle ne constitue pas une certification de tous les appareils et de toutes les combinaisons de jeu. Draft Arènes reste expérimental : les combats sont explicitement désactivés dans le code depuis le 11 juin, en attente de refonte. L’interface explique maintenant cette limite au lieu de promettre un combat inaccessible.

## Corrections de ce lot

- Mobile : les formulaires de devinette masqués ne réapparaissent plus dans le Quiz, le Duel de poids ou après une fin de partie. La sélection de génération du draft respecte aussi son état masqué.
- Pokédex mobile : une carte ouvre directement la fiche. Le bouton « Tous les Pokémon » revient à la liste et à la sélection. La fiche n’est plus cachée après une longue liste de cartes.
- Duel de poids : bouton « Nouvelle manche » après réponse ; suppression des panneaux et bandeaux du mode précédent.
- Zoom progressif : nom cohérent entre catalogue et aide (anciennement « Silhouette »).
- Images : les callbacks de secours du Cri, du Mystère et du résultat capturent leur URL, sans relire un Pokémon global devenu nul après changement de mode. Les callbacks des panneaux fermés sont détachés.
- Historique navigateur : restauration en mémoire des variantes de devinette, du Quiz et du Duel de poids, sans tirer une nouvelle cible ni recompter une partie.
- Duel live : refus des Pokémon déjà proposés côté serveur et restauration de la liste côté client après reconnexion. Une sortie retire la socket de la room et empêche les anciens états de réapparaître. Le résultat ne peut plus s’ouvrir au-dessus d’un autre écran ; il reste défilable sur mobile, avec des icônes et contrastes adaptés. La revanche est désactivée lorsque la room est incomplète.
- Stat Auction : aucune manche à zéro fictif si les statistiques serveur manquent ; réessai possible. Verrouillage des allocations pendant le chargement et rejet des doublons/réponses périmées. Déconnexion = forfait explicite, transfert de l’hôte et possibilité de rouvrir un lobby disponible.
- Higher or Lower 1v1 : attente de l’accusé de réception serveur avant score/révélation/paire suivante. Les statistiques absentes ne deviennent plus une égalité donnant un point. Rejet des réponses concurrentes et arrivées après le chronomètre. Déconnexion = forfait avec conservation des côtés et arrêt du timer.
- Stat Clash : si les statistiques ne chargent pas, retour au lobby avec explication plutôt qu’une fausse égalité enregistrée comme résultat.
- Party Room : effacement du message de la manche précédente lors du changement de manche.

## Parcours réellement contrôlés

Deux onglets de navigateur indépendants côté session/socket, sur un serveur de prévisualisation local ; profils invités de test. Les onglets partagent le stockage local du navigateur. La matrice ci-dessous précise la profondeur de chaque contrôle.

| Fonction | Parcours et observation |
| --- | --- |
| Pokémon du jour / Illimité | Entrée invalide sans essai consommé ; proposition Pikachu ; conservation de l’essai après détour par le Pokédex ; abandon ; résultat ; reprise en illimité. |
| Zoom / Pixelisé | Lancement, proposition, abandon, cible révélée et actions de fin ; pas de débordement horizontal en vue mobile testée. |
| Description | Description chargée ; mauvaise réponse puis Osselait correct ; victoire en deux essais ; copie du résultat. |
| Cri | Bouton de lecture, état de chargement puis retour au bouton ; abandon. Écoute acoustique non validée. |
| Stat mystère | Affichage des six statistiques et total, abandon et révélation. Régression de callback d’image corrigée. |
| Quiz | Quinze questions terminées, compteur 5/15, relance réinitialisée ; retest du formulaire mobile absent. Retour du Pokédex à la même question (Crapustule) sans relance. |
| Intrus | Bonne réponse Poissoroy, explication et cartes désactivées ; nouvelle énigme. |
| Évolution | Chenipan → Chrysacier → Papilusion, victoire avec Chrysacier. |
| Ordre Pokédex | Aéromite entre Mimitoss et Taupiqueur ; réponse sans accent acceptée. |
| Duel de poids | Révélation après réponse ; bouton Nouvelle manche utilisable ; formulaire Deviner absent. |
| Connections | Quatre erreurs, défaite, groupes révélés et nouvelle partie disponible. Victoire complète non testée. |
| Higher or Lower solo | Erreur en mode infini, révélation, score final, replay vers le choix de mode. |
| Speedrun | Session réelle de 60 secondes, passage par Entrée vide, saisie invalide sans point, expiration et écran de résultat. |
| Draft Score Attack solo | Six choix terminés : moyenne 449, record enregistré, six membres visibles, nouvelle partie et partage disponibles. |
| Draft Arènes | Six choix terminés, équipe et analyse (moyenne 424) affichées. Combats désactivés par le drapeau existant `DRAFT_BATTLE_ENABLED = false`, non réactivés dans ce lot. |
| Pokédex | Recherche Dracaufeu, formes Méga, fiche/statistiques/talents ; liste et fiche contrôlées en petit format ; thème clair et sombre ; retour de fiche à liste. |
| Team Builder | Sélecteur, recherche Pikachu, ajout au slot, choix Orbe Vie ; export copié avec Pokémon, objet, talent, nature et EV. |
| Table des types | Changement Gen 6+ vers Gen 1, filtre offensif Feu, absence de débordement global dans la largeur testée. |
| Profil / Succès / Historique | Lecture des statistiques, progression des succès, historique et filtre des modes. Réinitialisation du profil non déclenchée. |
| Duel live 1v1 | Création/jonction ; essai reçu par l’adversaire ; rechargement et reprise avec un essai ; doublon bloqué ; reset de l’hôte laissant un écran vide propre ; victoire par forfait de l’autre joueur et revanche désactivée. |
| Party Room | Deux joueurs, cinq manches Combo de types ; Airmure marque 155, Charmina 140 ; fin manuelle et expiration ; classement final 155–140, relance disponible. |
| Stat Auction 1v1 | Création/jonction/lancement ; bug des scores nuls reproduit ; retest : erreur explicite, manche 1 conservée, aucun point, validation réactivée ; rechargement de l’adversaire → forfait ; relance en lobby 1/2 avec hôte transféré. |
| Stat Clash 1v1 | Création/jonction, format Best of 3, handicaps désactivés, démarrage synchronisé et boutons de statistiques ; source de stats serveur indisponible dans l’environnement. Chemin de repli corrigé et testé automatiquement. |
| Higher or Lower 1v1 | Deux onglets, paire identique, course 60s et résultat final. Bug d’attribution de point à une erreur reproduit. Retest : score 0 conservé, même paire, erreur récupérable ; rechargement adverse → forfait explicite. |

## Vérification automatique

`node --test test/gameplay-regressions.test.js test/navigation.test.js test/oauth-state.test.js` : **26 tests réussis**.

Ils couvrent notamment les identifiants Pokémon répétés, les sorties de room, la grâce de reconnexion du Duel, cinq manches d’enchères avec scores calculés côté serveur, les allocations répétées, les réponses concurrentes/périmées, les données absentes, le transfert d’hôte, le callback d’image et le retour navigateur. Les calculs normaux de Stat Auction et Higher or Lower sont vérifiés avec des statistiques synthétiques contrôlées ; ces tests ne prétendent pas vérifier une disponibilité réseau externe.

`node --check server.js`, `node build.mjs` et `git diff --check` réussissent. La compilation recolle les huit morceaux JavaScript puis minifie les fichiers distribués et versionne leurs URL.

## Limites de validation

- Vues CSS intégrées, principalement 390 px et contrôle ciblé à 320 px pour le Pokédex, avec inspection de la version bureau. Ce n’est pas une émulation iOS/Android ni un test de clavier tactile, de safe area ou de navigateur Safari réel.
- Les statistiques PokéAPI étaient accessibles côté navigateur mais indisponibles côté serveur local lors de plusieurs duels. Les erreurs sont maintenant explicites ; les parcours normaux calculés sont couverts par tests à données contrôlées. Une partie réelle après déploiement doit encore confirmer la disponibilité de cette dépendance depuis Render.
- Pas de connexion à un compte Discord réel ni de test des classements authentifiés. Les tests OAuth purs réussissent. La suite de routes HTTP d’authentification n’a pas été relancée avec succès dans cet environnement (autorisation réseau annulée au démarrage du test initial).
- Pas de ROM fournie pour valider un jeu dans l’émulateur.
- Pas de campagne complète de tous les combats Draft, du duel Draft Score Attack, des variantes PRO, de chaque mini-jeu Party à huit joueurs, ni des flux d’import/export de tous les formats du Builder.
- Seul le Duel de devinette reprend automatiquement sa room après un rechargement. Stat Auction et Higher or Lower terminent désormais par forfait ; il ne faut pas annoncer une reconnexion transparente de tous les modes.

Le site est plus fiable avec ce lot, mais ces limites empêchent de l’annoncer « entièrement finalisé ».
