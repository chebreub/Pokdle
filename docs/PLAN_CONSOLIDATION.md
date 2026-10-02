# Pokédle — suivi du plan de consolidation

Base de travail : `df288ea9efa4dc9485988039c3ed1a44267d4451` (Pokédex Final Polish).
Livraison : PR #48. Ce document permet de reprendre le travail sans recommencer une refonte.

## Décisions conservées

Pokédle reste un jeu clair bleu/blanc. Accueil, Jouer, Entre amis, Pokédex et Profil restent les destinations principales. L'Encyclopédie est l'entrée normale du Pokédex ; Ma collection reste accessible explicitement. Aucun nouveau système monétaire, aucun nouveau mode et aucune suppression de progression dans cette livraison.

## État par lot

| Lot | Livré ici | Suite distincte, non déclarée terminée |
| --- | --- | --- |
| R0 — Référence | Parcours Chromium à cinq largeurs, captures et rapports reproductibles dans la CI | Recette de la version réellement déployée, connexion Discord réelle et appareils iOS |
| R1 — Fiabilité | Erreurs de classement distinctes des listes vides ; messages connecté/non classé ; délais réseau bornés ; réponses tardives ignorées ; Daily synchronisé par compte et date ; requêtes simultanées regroupées ; transaction et clé unique côté PostgreSQL ; retour des fiches verrouillées | Validation de la partie entière côté serveur, identité du propriétaire des sauvegardes locales et passage à minuit pendant une manche |
| R2 — Présentation | Correction des barres audio, cadrage des miniatures, icônes de recommandations, navigation tablette, conflits CSS ciblés et contrôles de débordement | Réduction globale de la dette CSS, revue exhaustive du contraste et du clavier |
| R3 — Accueil/catalogue | Résumé compact du Daily terminé ; accès aux autres jeux ; barre de recherche/filtres correctement dimensionnée ; boutons Solo/Amis et recommandations lisibles | Regroupement Standard/PRO avec conservation des anciens liens, personnalisation des recommandations |
| R4 — Jeu/résultats | Largeur contrôlée sur les parcours testés, classement/résultat clarifiés, navigation et états vide/en cours/fin contrôlés sur les jeux couverts | Revue complète de chaque famille, chaque variante et de toutes les animations de récompenses |
| R5 — Multijoueur | Entrée Party Room moins encombrée ; création, invitation, choix du mode, manche et départ testés avec deux clients invités | Campagne huit joueurs, coupures/reconnexions de chaque mode et comportement de changement d'hôte |
| R6 — Pokédex/profil | Encyclopédie et collection préservées ; retour mobile depuis les fiches normales et verrouillées ; arrivée Profil contrôlée | Réorganisation complémentaire des missions/paramètres/Builder seulement après défaut observé |
| R7 — Validation | Tests Node, PostgreSQL de test, Chromium cinq largeurs, mode sombre/tablette, deux clients ; dépendances revues ; workflow sans écriture du dépôt | Safari/Firefox, mesures terrain LCP/INP/CLS et suivi de production |
| R8 — Extension facultative | Aucune extension intégrée | Grille solo en prototype séparé uniquement après stabilisation ; autres idées en réserve |

## Ordre de reprise

1. Vérifier Render après fusion sur les mêmes parcours, sans nouvelle refonte.
2. Compléter la recette réelle Discord et mobile, corriger uniquement les défauts reproduits.
3. Revoir l'identité compte/sauvegardes et les parties Daily à la frontière UTC avant de renforcer le classement compétitif.
4. Traiter les variantes Standard/PRO et les réglages uniquement avec des tests conservant historique, liens et records.
5. Le prototype de grille solo reste facultatif et hors de la livraison de fiabilisation.

## Validation et garde-fous

Voir `docs/qa/README.md` pour le protocole et ses limites. Aucun mot de passe utilisateur ni cookie de production n'est utilisé. La migration ajoute une colonne nullable et un index unique aux événements de classement ; elle ne supprime pas les anciens résultats. Déduplication et transaction ne signifient pas validation anti-triche de la partie : le serveur accepte encore des métriques clientes plausibles.

Ne pas fusionner un changement de rendu sur la seule présence de chaînes CSS dans un test. Les contrôles navigateur doivent passer sur la révision de la PR, puis les captures être relues. Les exceptions ou fonctionnalités non testées doivent rester signalées, pas transformées en promesses de fonctionnement.
