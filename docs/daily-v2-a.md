# Pokémon du jour v2 — lot A

Le Daily est joué via le serveur pour tous, avec une même cible commune. L'Illimité reste local et sans classement. Ce lot conserve les neuf critères, leurs couleurs et les tolérances de 0,3 m / 15 kg.

## Comportement

- `GET /api/daily` : état de la partie, JOUR #n, date Paris, prochain reset, essais et comparaisons. Aucune réponse avant une victoire ou un abandon.
- `POST /api/daily/guess` : identifiant du Pokémon, jour et compte attendu ; validation, comparaison et enregistrement atomiques. Les doublons et reprises renvoient l'état enregistré.
- `POST /api/daily/abandon` : fin définitive, réponse révélée, aucun résultat classé. La série s'interrompt immédiatement.
- `GET /api/daily-stats/today` : victoires et abandons réellement enregistrés dans Postgres. Les anciens signalements déclaratifs sont désactivés.
- Invités : cookie signé HttpOnly/SameSite=Lax, partie conservée par identifiant. Aucun score classé ni contribution du Daily à la ligue. Limitation des POST à 20/min par identité et 120/min par IP, des GET à 90/min et 240/min (par processus). Les IP ne sont pas stockées.
- La connexion reprend une partie invitée en cours. Une partie invitée déjà terminée reste hors classement ; elle ne permet pas de rejouer après avoir vu la réponse. Elle ne double pas la distribution.
- Si le serveur est indisponible, le jeu explique l'erreur et propose une reprise. Aucun calcul local de la cible du jour.

## Calendrier et migration

Minuit Europe/Paris, changements d'heure compris, pour le jeu, l'accueil, le compte à rebours et le classement Daily du jour. Une requête qui franchit minuit est annulée ; elle ne consomme pas la partie suivante.

L'origine de la numérotation est le 23 mars 2026 : premier commit Git de mise en ligne contenant le Daily (`30af7a7`). Le 6 octobre correspond à JOUR #198. Ce repère est établi par Git ; l'accès à la première ligne de la base de production n'est pas disponible ici.

Les tables `daily_settings`, `daily_rounds` et `daily_plays` sont créées sans supprimer les anciens résultats. Le jour de bascule et le jour UTC de l'ancien tirage sont enregistrés une seule fois. La cible déjà publique de cette journée est conservée afin de reprendre les parties existantes ; sa confidentialité ne peut pas être rétablie rétroactivement. **Les tirages secrets commencent au minuit Paris suivant la bascule.** Ils utilisent l'aléatoire cryptographique du serveur, sans répétition sur une fenêtre de 365 jours à partir de cette bascule.

Les sessions de comptes existantes sont reprises, les records en essais restent en place, les séries sont calculées depuis les victoires serveur. Les victoires déjà validées le jour de bascule alimentent la distribution même si leurs propriétaires ne rouvrent pas le site ; leur migration ne les compte pas deux fois. Les anciennes parties invitées uniquement locales ne peuvent pas être certifiées : l'interface recharge désormais l'état serveur.

Un cookie identifie un navigateur, pas une personne. Effacer le cookie crée une nouvelle identité invitée ; les limitations par IP réduisent les abus. Les invités restent exclus de la compétition. Les comptes conservent leur partie même après suppression du stockage local ou changement d'appareil.

## Suite déjà validée, hors de ce lot

Le classement Daily restera essais → indices consultés → temps. Le nouveau score et les indices seront ajoutés dans leurs lots respectifs. Le calcul de ligue validé sera :

| Essais | Base ligue |
| --- | --- |
| 1 | 200 |
| 2 | 180 |
| 3 | 160 |
| 4 | 140 |
| 5 | 120 |
| 6 | 100 |
| 7 | 80 |
| 8 | 60 |
| 9 et plus | 40 |
| Abandon | 0 |

Victoire : −10 par indice consulté, +10 pour la question bonus, +10 de rapidité, résultat plafonné à 200 et plancher à 40. La ligue conserve trois disciplines et 600 points maximum. Aucun de ces nouveaux bonus ni indices n'est activé dans le lot A.

## Vérification

- Tests du calendrier Paris, des deux changements d'heure et de la numérotation.
- Parité des comparaisons avec l'Illimité existant.
- Base PostgreSQL réelle en CI : cible partagée, secret absent, répétition interdite après fin, reprise après redémarrage, migration, abandon, invités exclus, distribution, série, idempotence, annulation atomique et passage de minuit pendant un verrou.
- Tests du client : coupure, timeout, double clic, réponse tardive après navigation/connexion/minuit, instantané invalide et absence de repli local.
- Captures et parcours navigateur à 360, 390, 768, 1366×768, 1920 et 2560 px : indisponibilité, début, reprise, abandon et victoire. Les réponses Daily sont simulées pour ces seuls tests visuels ; la persistance est testée séparément sur PostgreSQL.
