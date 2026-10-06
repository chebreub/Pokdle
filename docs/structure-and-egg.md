# Parcours de jeu et Œuf mystère

Les quatre lots sont livrés séparément : coque de jeu, extension aux modes,
accueil/classement/connexion, puis Œuf mystère. Les modifications sont additives ;
les contrôleurs existants conservent les comparaisons, minuteries et scores.

## Décisions sur le brief

- Le Daily reste sans limite d’essais. Pas de compteur `/6`, de silhouette au
  cinquième essai ni de nouvelles flèches sur génération/stade : ce seraient de
  nouveaux indices. Taille/poids conservent ±0,3 m / ±15 kg et leurs directions.
- Combo de types reste une course de 60 secondes avec plusieurs réponses
  possibles. Une comparaison avec une cible unique serait une autre règle.
- Stat Mystère conserve les six statistiques, le total et les données réellement
  disponibles. Les valeurs manquantes restent inconnues pendant le chargement.
- Les compteurs de résultat issus de l’historique sont explicitement récents
  (stockage existant limité à 120 entrées). Les séries Daily utilisent les vrais
  compteurs persistants. Aucun bonus de points fictif.
- La Ligue existante rassemble trois disciplines et donne un badge de maîtrise.
  Le classement global ne mélange pas des unités différentes.

## Œuf : garanties serveur

`App/lib/egg-mystery.js` crée trois tables sans modifier les tables existantes :
`egg_rounds`, `egg_guesses`, `egg_rewards`. Il utilise PostgreSQL et
`SESSION_SECRET`, déjà utilisés par les comptes. Sans ces services, le mode
affiche une indisponibilité explicite et ne simule pas de progression.

Le Pokémon appartient aux espèces ordinaires 1–1025, sans formes alternatives.
Le secret et le compagnon offert sont tirés indépendamment. Aucune valeur du
secret n’est envoyée comme champ caché : seuls les indices débloqués et les
propositions publiques, dont la bonne après résolution, sont publiés.

Un verrou transactionnel sur la manche sérialise les validations. Le quota,
l’unicité des propositions, la victoire et le gain sont validés dans la même
transaction. Une erreur de récompense annule aussi la victoire et la proposition.
L’attribution est stockée dans une table indépendante du profil modifiable par
le client. Les reprises et réclamations répétées n’attribuent pas de doublon.

Invité : cookie aléatoire signé HttpOnly + empreinte HMAC de l’adresse IP, sans
fingerprinting du navigateur ni stockage de l’IP brute. Compte : quota par
identifiant authentifié, incluant la proposition invitée de ce même navigateur.
Une connexion partagée ne retire pas les propositions des autres comptes.

Les quotas changent à minuit à Paris. Les manches changent le lundi à minuit à
Paris, y compris lors des passages heure d’été/hiver. Cette horloge est séparée
du Daily et de la Ligue existants. L’Œuf n’écrit aucun score de classement.

Le gagnant invité conserve une preuve signée dans ce navigateur et peut réclamer
son gain après connexion. Les compagnons et insignes attribués apparaissent dans
le profil et peuvent devenir le partenaire existant. Si le compagnon est déjà
possédé, le serveur choisit une autre espèce disponible ; l’insigne de l’enquête
reste unique même pour un collectionneur ayant déjà toutes les espèces.

## Validation et captures

- `npm run build` et `npm test`.
- `egg-mystery.test.js` : heure de Paris/DST, signature, seuils d’indices ; avec
  `QA_DATABASE_URL`, vraie base PostgreSQL isolée pour quotas, duplication
  concurrente, gagnant unique, récompense alternative, rollback, réclamation et
  changement de semaine.
- `tools/browser_quality.py` : six largeurs, champs/suggestions/résultats,
  absence de débordement, filtres, connexion invitée et Œuf
  (initial, quota atteint, trouvé, sombre). Captures 1366×768 et 390×844 dans
  l’artefact de chaque PR. Les fixtures UI n’exposent aucune solution serveur.
- Référence avant refonte structurelle : PR 82, commit
  `a0e18dc32037cd62e83d7cd12230326ac4a544ca`, captures du workflow 37447499348.
  Le workflow recapture aussi cette version dans un checkout temporaire, sans
  accès aux comptes ni à la base, en 1366×768 et 390×844. L’artefact
  `structure-before` contient ces captures aux dimensions identiques.

Type icons © James Watkins, MIT. Les fichiers et la licence sont dans
`App/img/type-icons/`.
