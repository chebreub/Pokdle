# Index des audits Pokédle

**Consulter d'abord les audits de novembre pour comprendre les priorités actuelles.** Les documents plus anciens ci-dessous restent conservés pour la traçabilité mais sont des photographies **à leur date de rédaction**. Ils ne sont ni une liste de défauts encore actifs ni une invitation à refaire des corrections déjà fusionnées.

## Audits et analyses de continuité — 5 novembre 2026

| Fichier | Sujet et utilisation |
| --- | --- |
| [Audit UX, gameplay et fidélisation](AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md) | Retour utilisateur, usage des modes, ergonomie mobile/PC, fiabilité, replayabilité, Pokédex, invitation |
| [Audit économie, capture et rareté](AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md) | Récompenses, prix, chances actuelles, shiny, 1 025 espèces, expédition, Drattak et expérimentations non approuvées |
| [Plan de développement](../PLAN_AMELIORATION_POKEDLE.md) | Backlog identifiant par identifiant, décisions et conditions de clôture |
| [État d'avancement](../ETAT_AVANCEMENT_POKEDLE.md) | Progression chiffrée, statut des PR et prochaine tâche |
| [Guide de transfert vers un nouveau chat](../REPRISE_NOUVEAU_CHAT.md) | Ordre de lecture et prompt directement utilisable |

**Provenance des chiffres des rapports de novembre :** huit captures agrégées du tableau de bord et un export JSON économique anonyme de la période **22/10 au 04/11**, fournis dans la conversation d'origine. Les fichiers bruts ne sont pas archivés ici ; la revalidation quantitative nécessite un nouvel export ou la copie originelle, avec le même périmètre. N'ajouter aucun identifiant ou export admin sensible au dépôt.

## Audits historiques à préserver

| Date | Fichier existant | Précaution |
| --- | --- | --- |
| 10/06/2026 | [Audit technique et produit général](AUDIT_Pokedle_2026-06-10.md) | Certaines métriques et descriptions correspondent à un code antérieur ; relire main |
| 10/06/2026 | [Audit DA](AUDIT_DA_2026-06-10.md) | Contexte historique, ne pas traiter toutes les recommandations comme ouvertes |
| 11/06/2026 | [Audit DA v2](AUDIT_DA_2026-06-11_v2.md) | Version ultérieure de l'analyse DA |
| 11/06/2026 | [Audit Draft combat](AUDIT_DRAFT_COMBAT_2026-06-11.md) | Modes / règles pouvant avoir changé depuis |
| 11/06/2026 | [Audit modes](AUDIT_MODES_2026-06-11.md) | Catalogue ancien : vérifier les modes réellement disponibles |
| 07/09/2026 | [Corrections](CORRECTIONS_2026-09-07.md) | Historique de correctifs, pas backlog automatiquement réactivé |
| 07/09/2026 | [Recette gameplay](GAMEPLAY_QA_2026-09-07.md) | Conditions des tests d'alors uniquement |
| 07/09/2026 | [Mobile](MOBILE_2026-09-07.md) | Recette locale et responsive, pas certification Safari réel |
| 07/09/2026 | [Thème / références](THEME_REFERENCE_REVIEW_2026-09-07.md) | Direction visuelle datée |
| 07/09/2026 | [Visual refresh](VISUAL_REFRESH_2026-09-07.md) | Historique d'améliorations déjà introduites |
| 14/09/2026 | [Party Room](PARTY_ROOM_2026-09-14.md) | Fonctionnement et QA à leur date ; vérifier code et PR récents |

## Règles d'utilisation dans un nouveau chat

1. Lire [REPRISE_NOUVEAU_CHAT.md](../REPRISE_NOUVEAU_CHAT.md) puis le plan, l'état et les **deux audits actuels**.
2. Contrôler dernier SHA de `main` et les PR ouvertes/fusionnées avant d'agir.
3. Vérifier tout problème historique dans le code courant. Ne pas supposer qu'un constat de juin ou de septembre existe encore.
4. Créer une PR limitée, la tester, puis mettre à jour les **deux** fichiers de suivi après fusion.
5. Ne pas incorporer des statistiques ou des fichiers privés d'administration au dépôt.

**Les études, les hypothèses et les demandes à arbitrer ne sont jamais automatiquement des fonctionnalités approuvées.**
