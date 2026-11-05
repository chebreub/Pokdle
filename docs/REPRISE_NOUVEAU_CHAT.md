# Reprendre Pokédle dans un nouveau chat — Guide et prompt de transfert

Ce fichier est le **point de départ autonome** pour un nouveau chat ChatGPT, Claude ou une autre session ayant accès au dépôt. Le projet est déjà développé et le travail actuel doit poursuivre **le plan existant**, pas recommencer de zéro.

## Ordre de lecture obligatoire

1. **[Plan d'amélioration](PLAN_AMELIORATION_POKEDLE.md)** — décisions produit, garde-fous, 43 tâches actives et leurs identifiants.
2. **[État d'avancement](ETAT_AVANCEMENT_POKEDLE.md)** — pourcentage, PR, contrôles effectués et prochaine action à vérifier.
3. **[Audit UX, gameplay et fidélisation — 05/11/2026](audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md)** — analyses d'utilisation, ergonomie PC/mobile, gameplay, Pokédex et diffusion.
4. **[Audit économie, captures et rareté — 05/11/2026](audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md)** — taux en vigueur, chiffres historiques, voies des 1 025 espèces et propositions soumises à validation.
5. **[Plan rareté des 1 025 Pokémon](PLAN_RARETE_1025.md)** et **[diagnostic tactile mobile](qa/MOBILE_TACTILE.md)** pour les chantiers associés.
6. **[Index des audits historiques](audits/README.md)**, au besoin : ces analyses sont **datées** et certains constats y sont déjà corrigés par les PR suivantes.
7. **Dernier GitHub `main` + PR ouvertes/fusionnées + checks exacts** : les documents sont une photographie, non une synchronisation en temps réel.

## Prompt prêt à copier-coller dans un nouveau chat

> Tu reprends le développement de mon jeu Pokémon **Pokédle**, sans refaire d'audit général et sans repartir de zéro.
>
> **Dépôt GitHub :** https://github.com/chebreub/Pokdle  
> **Site :** https://pokdle.fr/ (ancienne adresse : https://pokdle.onrender.com/)  
> **Technologies :** Node.js, Express, JavaScript, PostgreSQL, Socket.IO ; interface web responsive ; build esbuild ; Render.
>
> **Première tâche obligatoire :** lis les documents suivants dans le dépôt, dans cet ordre :
>
> 1. docs/PLAN_AMELIORATION_POKEDLE.md
> 2. docs/ETAT_AVANCEMENT_POKEDLE.md
> 3. docs/audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md
> 4. docs/audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md
> 5. docs/PLAN_RARETE_1025.md et docs/qa/MOBILE_TACTILE.md
> 6. docs/audits/README.md si tu as besoin de consulter les anciens audits.
>
> Ces fichiers rassemblent la stratégie, l'audit approfondi, les chiffres disponibles, l'équilibrage des captures, la liste des priorités, les décisions produit, la progression et les points bloquants.
>
> **Vérifie ensuite** le dernier commit de `main`, les PR ouvertes et celles fusionnées depuis la dernière photographie ; ne suppose jamais que le document d'avancement est plus récent que GitHub. Prends connaissance des tests déjà présents avant toute modification. Ne reconstitue pas d'anciens chiffres d'administration à partir de suppositions ; les agrégats du 22/10 au 04/11 sont historiques et l'export brut n'est pas dans Git.
>
> **État documenté le 05/11/2026 :** 1 tâche terminée sur 43 (2,3 %) et deux en cours. PR #260 (plan + diagnostics) et PR #261 (protection des séries 5/10/20) fusionnées ; PR #264 (filtres masquant Party Room) ouverte avec CI Node et navigateur vertes au dernier contrôle, **à revérifier**. Le bug tactile Qui est-ce ? n'a pas été reproduit sur iPhone réel ; ne l'annonce pas corrigé.
>
> **Objectif :** poursuivre le plan de manière incrémentale, d'abord les problèmes concrets de fiabilité et de sauvegarde, puis l'expérience de jeu, le Pokédex, les captures et enfin le partage naturel et l'acquisition de joueurs. Les neuf générations Pokémon sont conservées : le commentaire sur Kokiyas/Gen 9 était une plaisanterie et **ne constitue pas une demande de changement produit**.
>
> **Méthode de travail :**
>
> - Comprends le comportement actuel avant de modifier quoi que ce soit. **Ne développe pas ce qui existe déjà** (Wordle longueur exacte, la première lettre de Stat Mystère après 5 essais, la grille compétitive, animations de capture existantes, etc.).
> - Travaille par **petits lots** et PR distinctes, tests ciblés + régression, CI verte sur le commit exact, revue avant fusion. Distingue ce qui a été lu, testé en navigateur, et réellement vérifié sur Safari iPhone / Render.
> - **Ne modifie jamais directement le JS généré App/script.js** ; travaille sur App/src/… puis passe par le build du projet. Respecte les sources existantes et la délégation des événements.
> - Préserve absolument les comptes, sauvegardes, inventaires, Pokédollars, Balls, captures, découvertes et les résultats historiques. Pas de suppression massive du stockage local ni de migration destructive ; tester l'isolation multi-comptes.
> - Les récompenses et l'anti-triche doivent rester vérifiés côté serveur. **Ne modifie pas les probabilités shiny/capture, les prix, l'attribution de Balls, les expéditions ou Drattak sur de simples hypothèses**. Les variantes d'équilibrage figurant dans l'audit sont des **propositions à simuler et faire valider**.
> - Sur mobile, ne cache pas un bug en ajoutant des z-index ou pointer-events globaux. Tout geste facultatif a un bouton équivalent et ne consomme pas de ressource par erreur.
> - Les anciennes analyses de juin/septembre sont historiques : vérifie toujours si un constat a été corrigé dans le code actuel ou une PR fusionnée.
> - Évite toute écriture de données personnelles, clés, exports d'admin non anonymisés ou fichiers sensibles dans Git.
>
> **À la fin de chaque PR :** mettre à jour docs/PLAN_AMELIORATION_POKEDLE.md et docs/ETAT_AVANCEMENT_POKEDLE.md, avec les cases réelles [x]/[~]/[ ], numéro de PR, SHA, preuve CI, points réellement non vérifiés et la prochaine action concrète. Recalculer le pourcentage **tâches terminées / 43**, hors l'action stationnée, tant que le périmètre n'a pas été modifié.
>
> **Maintenant :** vérifie si la PR #264 est toujours ouverte et fusionnable ; si oui, traite-la avant de démarrer de nouveaux travaux. Ensuite, attaque **LOG-02** (record zéro dans Qui est-ce ? et cohérence de fusion de profils) dans un lot isolé, puis LOG-04 et SAVE-01 selon les dépendances. Le P0 tactile peut nécessiter une vraie reproduction sur le téléphone d'origine ; garde-le ouvert sans l'inventer.
>
> **Compte rendu demandé pour chaque étape :** ce qui a été fait, fichiers modifiés, tests exacts et leurs résultats, lien PR, fusion oui/non, état réel du déploiement, risques restant et prochaine tâche. Pour les questions simples « Suite ? » ou « Go », reprends le dernier état GitHub et exécute le prochain lot pertinent plutôt que répéter un audit global.

## Règle de décision et de sécurité

- **Source de vérité technique = GitHub `main` + code + tests et PR au moment où l'on agit.**
- **Source de vérité produit = décisions et priorités du plan**, révisées explicitement quand l'utilisateur tranche.
- **Progression = uniquement les tâches terminées, vérifiées et intégrées**, pas les PR simplement rédigées.
- **Statistiques = export daté, grain correct, dénominateurs vérifiables**, jamais un « taux de conversion » improvisé.
- **Les expériences d'équilibrage ne sont pas des instructions de déploiement.**
- En cas de nouveau besoin urgent, ouvrir un lot séparé, noter pourquoi la priorité a changé, puis reprendre le plan.

## Reprise après ce chantier documentaire

Si les nouveaux fichiers n'ont pas encore été intégrés à `main`, **commencer par cette branche** :

```text
docs/audits-plan-reprise-20261105
```

La Pull Request documentaire sera mentionnée dans le message du chat qui a créé les fichiers. **Ne pas recopier les audits à nouveau si cette branche ou sa PR existe déjà.**
