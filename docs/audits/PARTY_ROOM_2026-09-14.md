# Party Room — Numéro mystère et nouvelle interface

## Livraison

- Nouveau mode multijoueur `nearest`, nommé **Numéro mystère** dans le site.
- Numéro national tiré au sort parmi les espèces des générations sélectionnées ; formes alternatives exclues.
- Une proposition de Pokémon par joueur, verrouillée après validation. La sélection dans l'autocomplétion ne valide pas automatiquement ce mode.
- Propositions adverses masquées jusqu'à la révélation. Numéros et écarts révélés ensemble.
- Le plus petit écart gagne 100 points ; tous les ex æquo gagnent 100 points. Aucun bonus de rapidité. Absence de réponse : 0 point.
- Fin de manche quand tous les joueurs présents ont répondu, après 30 secondes ou à la demande de l'hôte.
- Scores calculés exclusivement sur le serveur, sans appel externe. Rejets des réponses tardives, des anciennes manches, des formes et générations non autorisées ; attribution des points une seule fois.
- Départ : retrait du socket, transfert d'hôte, résolution si tous les joueurs restants ont répondu.

## Interface

Salon clair/sombre suivant les paramètres existants. Accueil avec création/invitation distinctes, six cartes de modes, paramètres regroupés, un bouton principal de lancement, classement séparé. Plateau de jeu placé avant le classement sur mobile. Proposition enregistrée explicitement affichée, résultats avec sprite/numéro/écart/points. Boutons tactiles, choix sélectionné accessible via `aria-pressed`, erreurs de proposition près du champ. L'ancien empilement de styles Party est remplacé par une feuille ciblée ; les badges du catalogue sont conservés.

## Vérification

Commande réussie :

```sh
node --test test/party-nearest.test.js test/gameplay-regressions.test.js test/navigation.test.js test/oauth-state.test.js
node --check server.js
node build.mjs
```

**38 tests réussis**, dont 12 nouveaux couvrant le moteur, la confidentialité de la sérialisation et les véritables gestionnaires Socket.IO : égalités, sélection exacte, double soumission, chronomètre, hôte, déconnexion, huit joueurs, remise à zéro, ancien numéro de manche et changement de mode après la fin.

Tests navigateur sur serveur local, deux onglets :

- Partie complète de cinq manches, salon J2SKD, Numéro mystère.
- #952 : Pikachu #025 (écart 927) contre Mew #151 (écart 801), victoire de Mew, 100 points.
- #313 : Pikachu des deux côtés, égalité et 100 points chacun.
- Proposition inconnue refusée ; sélection d'une suggestion puis validation explicite.
- #435 : seul Mew proposé ; expiration réelle des 30 secondes, 100 points au répondant, 0 à l'absent.
- Manche sans proposition terminée par l'hôte : aucun point.
- Cinquième manche, podium et cumul 300–200 ; relance à 0–0, manche 1/5.
- Test du mode existant Combo de types après redémarrage du serveur et chargement de la nouvelle interface.
- Vues claires et sombres ; salon mobile à 320 px et 390 px, ordinateur. Pas de débordement global mesuré : 305/305 et 375/375 px (largeur utile/largeur du contenu).
- Correction puis contrôle visuel du bouton d'invitation à 320 px.

## Portée

Les vérifications mobiles utilisent une fenêtre CSS intégrée à Chrome, pas des téléphones iOS/Android physiques. La couverture à huit joueurs est automatisée ; le parcours navigateur utilise deux joueurs. Les cinq autres modes ne font pas tous l'objet d'une partie complète dans cette livraison. Les limites générales du précédent audit (Discord, ROM, Draft Arènes) ne sont pas modifiées.

## Correctif après retour utilisateur — validation des suggestions

Un clic sur une suggestion dans Numéro mystère remplissait le champ sans soumettre, contrairement aux autres modes Party. Sans seconde validation, le serveur clôturait donc la manche sans proposition. La capture utilisateur est compatible avec ce parcours ; elle ne permet pas d'exclure un problème réseau distinct.

La sélection soumet désormais immédiatement, par clic ou Entrée sur une suggestion surlignée. Le bouton reste disponible pour un nom tapé directement. Le texte de confirmation indique « réponse enregistrée » après confirmation serveur. Une saisie rejetée reste dans le champ.

Quatre tests de régression ajoutés : sélection sans second clic, Entrée sur suggestion, saisie directe rejetée conservée, soumission en cours protégée et confirmation enregistrée. Les deux premiers échouaient avant correction. Vérification finale : 23 tests ciblés réussis (sélection, moteur Party et navigation), build réussi.

Navigateur, salon local L82MU, deux joueurs, cible #704 : clic sur Pikachu puis clic sur Mew, sans cliquer sur le bouton de validation. Confirmation Pikachu visible avant la réponse adverse ; résultat avec les deux Pokémon, écarts 679 et 553, victoire de Mew +100 points.

## Duel privé et réponse exacte — 14 septembre 2026

- Le serveur Duel ne transmet plus les noms, sprites ou indices des propositions adverses, pendant la partie comme après la fin. Chaque joueur conserve son propre historique.
- La jauge partage la meilleure proximité d'un essai : neuf critères de même poids, correspondance partielle à demi-point. Elle ne redescend pas ; 100 % est réservé à la bonne espèce (99 % maximum sinon).
- Numéro mystère révèle désormais le nom, le sprite et le numéro exacts à la fin de chaque manche, même sans réponse parfaite ou sans aucune proposition. La carte est masquée à la manche suivante.
- Présentation responsive de la jauge et correction du contraste des descriptions dans le thème sombre.

Validation : 36 tests ciblés passent (Duel, sérialisation privée, Party nearest, sélection et régressions de jeu). Build et vérification syntaxique réussis. Deux sessions navigateur réelles : Pikachu puis Roucool donnent 39 % puis 44 % chez l'adversaire sans révéler leurs noms ; Ronflex reste visible uniquement dans l'historique de son joueur, avec 33 % partagé. Numéro #213 : propositions Pikachu/Ronflex, révélation Caratroc, puis disparition de la carte à la manche 2. Contrôles CSS aux largeurs 320 et 390 px, thème clair et sombre, sans débordement horizontal du document. Ce contrôle en fenêtre intégrée ne remplace pas un essai sur téléphone physique.
