# Pokédle — État d'avancement du plan d'amélioration

**Photographie vérifiée : 5 novembre 2026.**  
**Dépôt :** [chebreub/Pokdle](https://github.com/chebreub/Pokdle) ; base de travail documentaire : commit `b86a4e3e7b6e08836c1174960864254809f40726` sur `main`.  
**Référence des tâches :** [PLAN_AMELIORATION_POKEDLE.md](PLAN_AMELIORATION_POKEDLE.md).  
**Audits associés :** [UX/gameplay/fidélisation](audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md) et [économie/captures/rareté](audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md).

## Synthèse à retenir

**4 tâches terminées sur 43 actions actives = 9,3 %** du plan au sens strict des cases validées et fusionnées.

| Statut | Nombre | Règle |
| --- | ---: | --- |
| **Terminé et intégré à main** | **4** | Action vérifiée, PR fusionnée |
| **En cours / investigation / PR ouverte** | **2** | BUG-MOB-01 et SAVE-01 |
| **Non commencé / à conduire ou à décider** | **37** | Dont certaines propositions économiques soumises à validation préalable |
| **Stationné et exclu du total** | **1** | NIV-01, proposition née d'une plaisanterie sur Kokiyas, à ne pas programmer |
| **Dénominateur suivi** | **43** | 7 + 8 + 5 + 4 + 8 + 5 + 4 + 2 |

**Formule explicite :** (4 actions terminées / 43 actions actives) × 100 = **9,3023 %, arrondi à 9,3 %**.

> **Limites du pourcentage :** chacune des 43 actions a le même poids dans ce calcul, même si certaines représentent une modification de quelques lignes et d'autres plusieurs semaines de travail / arbitrages. Ce n'est **ni** le pourcentage de fonctionnalités déjà présentes sur le site, **ni** une estimation des heures restantes. Les travaux de préparation et de documentation ne gonflent pas artificiellement le nombre de correctifs livrés.

## Répartition par chantier

| Lot | Périmètre | Terminées / actives | Part terminée | Travail réalisé ou engagé |
| --- | --- | ---: | ---: | --- |
| 0 | Ergonomie mobile / PC et mesures | 0 / 7 | 0 % | Protocole et test tactile en place, BUG-MOB-01 non reproduit sur téléphone réel |
| 1 | Fiabilité des jeux et sauvegardes | 4 / 8 | 50 % | LOG-01 à LOG-04 terminés |
| 2 | Gameplay, pédagogie, découverte | 0 / 5 | 0 % | Recommandations documentées, rien de nouveau livré dans ce plan |
| 3 | Pokédex et collection | 0 / 4 | 0 % | Définition des voies et états à clarifier |
| 4 | Économie et rencontres | 0 / 8 | 0 % | Règles existantes auditées ; propositions de changement **non approuvées** |
| 5 | Invitations et diffusion | 0 / 5 | 0 % | Proposition d'un parcours Dessine-le direct |
| 6 | Gestes et animations | 0 / 4 | 0 % | Dépend d'abord de la robustesse tactile |
| 7 | Testeurs externes et acquisition | 0 / 2 | 0 % | À préparer après stabilisation |
| **Total** | | **4 / 43** | **9,3 %** | NIV-01 stationné exclu |

## Journal GitHub vérifié

| PR | Réalisation | Statut GitHub | Validation |
| --- | --- | --- | --- |
| [#260](https://github.com/chebreub/Pokdle/pull/260) | Plan permanent, diagnostic tactile sur navigateur et protocole réel | **Fusionnée** ; merge `000728c` | Node + navigateur complets verts ; **bug iPhone non reproduit** |
| [#261](https://github.com/chebreub/Pokdle/pull/261) | LOG-01 : protection des séries 5/10/20 | **Fusionnée** ; merge `646d83c` | Tests Node + navigateur verts |
| [#262](https://github.com/chebreub/Pokdle/pull/262) | Journal et document de reprise des premiers lots | **Fusionnée** ; merge `b327a4d` | Documentation uniquement |
| [#263](https://github.com/chebreub/Pokdle/pull/263) | Clôture documentaire de LOG-01 dans le plan | **Fusionnée** ; merge `b86a4e3` | Mise à jour du plan |
| [#264](https://github.com/chebreub/Pokdle/pull/264) | LOG-03 : filtre solo ne doit plus cacher la Party Room | **Fusionnée** ; merge `cfa0d021` | [Tests Node verts](https://github.com/chebreub/Pokdle/actions/runs/42024332274) et [suite navigateur verte](https://github.com/chebreub/Pokdle/actions/runs/42024332512) sur le head `9dfd42f4dce2` |

**LOG-03 intégré** : #264 a été fusionnée après CI verte ; la recette sur iPhone réel concerne toujours BUG-MOB-01. Un autre chat doit **reconsulter GitHub** : ce tableau est une photographie, pas un suivi automatique.

## Lot intégré — LOG-02

[PR #266](https://github.com/chebreub/Pokdle/pull/266) fusionnée, merge `9a68b84f`. Valeur `0` conservée comme record valide via `quiEstCeRecorded`, sans migration des anciens profils : les anciennes valeurs positives restent des records ; un zéro ancien sans indicateur reste indéterminé et n'est pas inventé. Tests de fusion multi-appareils, nouvelle victoire à zéro et affichage ajoutés. CI Node [verte](https://github.com/chebreub/Pokdle/actions/runs/42034302915) et navigateur/base de données [verte](https://github.com/chebreub/Pokdle/actions/runs/42034303017) sur le head `7af64f8`. Le total intégré passe à **3/43 = 7,0 %**.

## Lot intégré — LOG-04

[PR #268](https://github.com/chebreub/Pokdle/pull/268) fusionnée, merge `d8c87fe7`. Une combinaison erronée de quatre Pokémon ne consomme qu'une erreur par partie, y compris après mélange. Message joueur explicite, tests Node et Playwright. CI [Node verte](https://github.com/chebreub/Pokdle/actions/runs/42036602850) et [navigateur/base de données verte](https://github.com/chebreub/Pokdle/actions/runs/42036604853) sur le head `ed9b57f8`. Aucun changement aux 4 erreurs autorisées, récompenses ni sauvegardes. Progression intégrée **4/43 = 9,3 %** ; prochaine tâche **SAVE-01**.

### Diagnostic supplémentaire — BUG-MOB-01

Suite `tools/mobile_touch_quality.py` élargie à **Poké-Connections** en plus de « Qui est-ce ? », avec frappes réelles aux coordonnées, contrôles de sélection et réouverture après navigation/mélange. **Cause candidate ciblée** : un toast de résultat invisible restait tactile (`.gamefeel-result-card { pointer-events:auto }` sous parent à `opacity:0`). [PR #271](https://github.com/chebreub/Pokdle/pull/271) ajoute le test caché/visible/caché et limite l'interception à la carte visible. **CI Node et navigateur vertes sur #271, mais validation sur l'appareil de Jade toujours nécessaire** ; le problème peut avoir plusieurs causes. Progression intégrée **4/43 = 9,3 %** inchangée tant que non clôturé.

## SAVE-01 — en validation

[PR #270](https://github.com/chebreub/Pokdle/pull/270) : sauvegarde versionnée locale de la série par compte, par mode et par générations sélectionnées, avec reprise au bon numéro de manche. Le premier contrôle CI a échoué sur une confusion entre une manche de série et une ancienne sauvegarde Daily ; la condition de validation a été corrigée et un test protège les sauvegardes Daily et classiques contre leur suppression lors d'une reprise. Un échec navigateur sur le sélecteur de générations a aussi été corrigé en conservant séparément les séries de groupes différents. **CI complète et fusion du dernier head encore à contrôler**. Aucun transfert de cette série entre deux appareils n'est revendiqué. Progression intégrée **4/43 = 9,3 %** jusqu'à fusion.

## Risques et verrous à connaître

**P0 — BUG-MOB-01.** Signalement de zones basses non cliquables sur téléphone dans Qui est-ce ?. L'émulation tactile Chromium/WebKit passe, mais ni le modèle ni le navigateur ayant échoué ne sont connus. **En attente de preuve sur appareil réel ; ne pas ajouter de patch de calques arbitraire.**

**P1 — Synchronisation et reprise.** LOG-01 évite un redémarrage accidentel mais **SAVE-01 n'est pas terminé** : une série entamée doit être récupérable après rechargement et rester isolée par compte. Ne pas effacer l'état existant.

**P1 — Record zéro Qui est-ce ? (corrigé).** LOG-02 intégré dans #266 ; un ancien zéro sans indicateur reste indéterminé, mais les nouveaux records et les fusions de profils sont couverts par les tests.

**P1 — Économie.** Aucun changement aux taux shiny, capture, prix, capacités, légendaires ou Drattak dans ce plan sans simulations et accord sur les règles. Le 05/11 est la frontière 1/150 → 1/500 pour le shiny, donc ne pas regrouper sans distinction les chiffres avant/après.

## Suite opérationnelle recommandée

1. **LOG-03 terminé dans #264.** CI Node et navigateur vertes sur le head exact, merge `cfa0d021`. Le point tactile réel reste ouvert.
2. **LOG-02 intégré via PR #266** : tests Node et navigateur verts, merge `9a68b84f`. Un ancien zéro sans indicateur demeure ambigu, aucune migration inventée.
3. **LOG-04 intégré via PR #268** ; approfondir **SAVE-01** (sauvegarde atomique et reprise de la totalité d'une série, sans mélanger les comptes).
4. Pendant ce temps, collecter si possible une **reproduction réelle BUG-MOB-01** avec modèle et navigateur. Ce P0 ne doit pas être « résolu » fictivement pour accélérer le plan.
5. Passer ensuite au gameplay, Pokédex, captures et invitations dans l'ordre des dépendances ; une PR sensible par lot.

**Après chaque fusion :** recenser les actions gagnées, recalculer le % avec la même formule, mettre le lien et SHA de PR, consigner la CI, et identifier la **prochaine action unique** dans le plan.

## Transmission entre chats

Le fichier [REPRISE_NOUVEAU_CHAT.md](REPRISE_NOUVEAU_CHAT.md) fournit un prompt autonome à copier-coller. Il renvoie aux deux audits, au plan des 43 tâches, au présent état, aux contraintes de sécurité et à la méthode de vérification GitHub.

**Aucune modification de gameplay, de base de données ou de production n'est incluse dans cette branche documentaire.**
