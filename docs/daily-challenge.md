# Défi quotidien et bilan du parcours

Quatrième épreuve après Enquête, Wordle et Dossier. Rotation quotidienne : Zoom
progressif, Cri et Pixelisé. Dix espèces de base distinctes, tirées une fois en base
et communes aux comptes et aux invités. Les formes restent acceptées en proposition.

Le bouton Commencer démarre trois minutes, contrôlées côté serveur. Six propositions
maximum par Pokémon : 3 points au premier essai, 2 au deuxième ou au troisième,
puis 1 jusqu’au sixième. Six erreurs
rapportent 0 et passent au Pokémon suivant. Génération après deux erreurs, types
après quatre ; cadrage élargi ou pixels affinés à chaque erreur. Le chrono continue
pendant les corrections et après fermeture. Les points déjà obtenus restent acquis
à expiration, maximum 30. Abandon : 0 point pour cette épreuve.

Réponse et fichiers médias détenus par le serveur : le navigateur reçoit les
images transformées ou le cri via une URL sans identifiant d’espèce, uniquement
pour sa manche actuelle. L’image originale n’est jamais envoyée pour Zoom/Pixelisé.
Caches bornés des sources et transformations ; une erreur média permet de réessayer.
La reconnaissance de l’image ou du cri fait partie des règles : ce mécanisme ne
prétend pas empêcher une personne de reconnaître le contenu avec d’autres outils.

Sauvegarde Postgres, cookie Daily existant, migrations à la connexion, verrou de
ligne individuel, réponses idempotentes. Une réponse ne restaure pas les étapes
précédentes. Invités exclus des classements, y compris une partie invitée déjà finie
avant connexion. Changement de jour Paris pendant une transaction : rollback.

Le bilan présente les quatre scores sans changer la Ligue. Barème sur 100 points
entiers, défini une seule fois dans lib/daily-points.js (serveur et SQL) :
- Enquête (40) : 40 au premier essai, −2 par essai supplémentaire, −4 par indice
  consulté, au moins 4 si trouvé ; 0 sinon.
- Wordle (10) : 10, 8, 6, 4, 2, 1 selon l’essai gagnant ; 0 sinon.
- Dossier (20) : une par bonne réponse, bonus compris.
- Défi (30) : 3, 2, 2, 1, 1, 1 selon l’essai, pour dix Pokémon.
Maximum du bilan : 100 points. Au démarrage, les parties du Défi enregistrées sous
l’ancien barème (6 à 1) sont recalculées depuis leurs réponses, ainsi que leurs
records ; Enquête et Wordle sont calculés à la lecture. Le classement global exige quatre épreuves terminées
et enregistrées au même compte. Un abandon conserve les points des autres épreuves.
Invité ou résultat terminé avant connexion : bilan visible, hors classement global.

Classements Défi et Parcours : points décroissants, temps total croissant ; périodes
Aujourd’hui / 7 derniers jours / Records. Les deux dernières retiennent le meilleur
parcours de chaque joueur dans la période, sans additionner les journées. Le calcul
vient des tables de parties, aucun résultat déclaratif accepté du navigateur.

API : GET /api/daily/challenge, POST start/guess/abandon sous ce chemin,
GET /api/daily/challenge/media et /summary. Identité, jour et index validés serveur.

Validation ciblée : daily-challenge.test.js + tests existants Daily, Wordle et Dossier,
PostgreSQL pour tirage, reprises, migration, chrono, indices, doubles réponses,
rollback des scores et minuit Paris. challenge_quality.py teste le client avec des
réponses API contrôlées sur Chromium/WebKit à 1366×768 et 390×844 : démarrage, focus,
saisie pendant une réponse, indices, erreurs réseau, six erreurs, médias et bilan.
Les captures de ce test utilisent un média synthétique, pas une cible de production.
Le workflow évite les parcours Party et catalogue lorsque tout le diff appartient
au Daily. Aucun mode Critère, Culture ou Sprint ajouté dans ce lot.
