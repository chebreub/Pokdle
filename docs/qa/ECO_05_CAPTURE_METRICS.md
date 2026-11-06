# ECO-05 — Statistiques de rencontres et de capture fiables

**Statut : intégré.** [PR #305](https://github.com/chebreub/Pokdle/pull/305) fusionnée au commit `dd79cd26f82ff7f75d0a35ac1ba36820bfd27946` après CI Node, PostgreSQL et navigateur vertes ; progression globale **23/43 = 53,5 %**. Cette instrumentation ne modifie aucune règle économique.

## Source de vérité et grain

- **Ancien historique conservé :** `wild_encounters` continue à fournir ses totaux existants (rencontres, captures, fuites, shiny, Balls utilisées). Ces chiffres historiques **ne sont pas** présentés comme la nouvelle analyse par tentative.
- **Nouvelles mesures seulement :** à chaque lancer réel validé par le serveur, `capture_stats_daily` enregistre **un compteur agrégé**, pas une ligne de joueur ou de rencontre.
- Six dimensions **indépendantes** sont incrémentées pour le même lancer : version des règles shiny, espèce cible, classe du taux de capture, type de Ball, rang du lancer (1–3), type de rencontre (`wild` / `legend` / `prestige`).
- Les catégories de classe reprennent les taux de capture du catalogue : `rare` si taux inférieur à 45, `moderate` pour 45 à 119, `common` à partir de 120. Ces seuils **ne changent pas** le calcul de capture.
- La version `shiny-1-150` / `shiny-1-500` provient du **jour d'ouverture** de la rencontre, pas de l'heure de consultation ni du jour du lancer. Une rencontre conservée ECO-08 ne change pas de version en étant reprise.
- Le jour d'agrégation est celui du **lancer serveur en Europe/Paris**. Les rapports affichent des périodes allant jusqu'à 90 jours.

## Exactitude et compatibilité

L'incrément a lieu dans la transaction du lancer de Ball. Un reçu `actionId` rejoué est servi depuis `ball_actions` sans deuxième incrément, sans nouveau tirage ni nouvelle dépense. Une transaction annulée annule aussi ses métriques. Si l'agrégat ne peut pas être écrit, un SAVEPOINT protège la capture et le débit de Ball : le serveur trace une alerte technique **sans identifiant utilisateur** et continue. Les statistiques peuvent alors être incomplètes, mais le gameplay reste prioritaire.

`CREATE TABLE IF NOT EXISTS` ajoute une table dédiée, sans modifier, supprimer ou recalculer les lignes de `wild_encounters`, `ball_gains`, `coin_ledger`, `ball_actions`, Pokédex ou profils. Aucun backfill fictif. Les taux shiny 1/500 à compter du 05/11/2026, la formule de capture, les trois tentatives et les prix restent inchangés.

## Confidentialité et lecture

- **Aucune** colonne identité, compte, adresse IP, session, identifiant de rencontre, actionId ou timestamp individuel.
- Une ligne agrégée contient uniquement un **jour**, une **dimension**, un **segment**, le nombre de lancers et le nombre de captures.
- Une dimension ne peut pas être croisée avec une autre pour reconstruire la trajectoire d'un joueur.
- Les résultats par espèce n'apparaissent dans l'export et dans l'administration qu'à partir de **10 lancers** sur la période, avec 20 espèces affichées au plus. Les petits effectifs sont supprimés de cette ventilation.
- Les chiffres par Ball sont des taux observés, **pas les probabilités officielles** : le choix des cibles, le type de rencontre, les changements de règles et les petits échantillons créent des biais.
- La nouvelle métrique concerne uniquement les lancers effectués **après la mise en service**. Un total partiel n'est pas comparé directement aux captures historiques complètes.

## Recette

- `App/test/eco05-capture-stats.test.js` : agrégations unidimensionnelles, suppression des espèces rares, aucune donnée nominative, conversion JSON, écran d'administration.
- Base PostgreSQL **isolée** : captures des deux versions shiny, refus d'un double comptage au rejeu de reçu, exactitude de l'ordre 1/2, Ball dépensée une fois, intégrité des tables historiques.
- Test de défaillance : suppression de la table de statistiques **uniquement dans un schéma de test éphémère** pour confirmer que la capture reste fonctionnelle.
- CI existante Node et navigateur/base à valider sur le commit de PR exact ; validation sur iPhone réel et déploiement Render non revendiqués.

**Critère de clôture :** PR fusionnée après contrôles satisfaisants, compteurs du plan actualisés et distinction entre historique et mesures prospectives documentée.
