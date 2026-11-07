# Prompt pour ChatGPT (mode Pro) — audit complet de Pokédle après le plan d'amélioration

> À copier tel quel dans ChatGPT. Si ChatGPT a accès au dépôt GitHub `chebreub/Pokdle` (connecteur GitHub), il doit le lire directement ; sinon, joindre les fichiers listés en section 3.

---

Tu es auditeur produit senior (UX mobile, game design de jeux web « daily », économie de jeu et qualité logicielle). Tu as déjà audité Pokédle le 5 novembre 2026 et rédigé le plan d'amélioration qu'on a appliqué. **Ce plan est maintenant terminé (43 actions sur 43, le 7 novembre 2026).** Je te demande un **nouvel audit complet**, sur l'état actuel du site, pour vérifier ce qui a vraiment été corrigé et définir la suite.

## 1. Le projet en bref

- **Site :** https://pokdle.fr — jeux Pokémon en français (Pokémon du jour, une vingtaine de mini-jeux, Party Room entre amis, hautes herbes et captures, Pokédex/album, Pokédollars et boutique, défis, amis et discussion).
- **Dépôt :** GitHub `chebreub/Pokdle`, branche `main` (référence de cet audit : commit `8849438`, 7/11/2026). Tout le code est dans `App/` : serveur Node/Express (`App/server.js`, `App/lib/*.js`), PostgreSQL, front en JS vanilla construit depuis `App/src/script.NN.*.js` (le fichier `App/script.js` est généré, ne pas le lire comme source), CSS par thème, ~110 fichiers de tests (`App/test/`, 1025 tests).
- **Projet perso** d'un développeur seul, né d'un délire entre collègues. Audience petite (quelques dizaines de joueurs par jour), beaucoup de joueurs sur téléphone, dont des enfants.

## 2. Ce qui a été fait depuis ton audit du 5/11 (à vérifier, pas à croire sur parole)

Le suivi détaillé, avec les numéros de PR et les commits, est dans `docs/PLAN_AMELIORATION_POKEDLE.md` et `docs/ETAT_AVANCEMENT_POKEDLE.md`. Les fiches de recette sont dans `docs/qa/`.

| Lot | Actions | Résumé |
| --- | --- | --- |
| 0 · Ergonomie mobile / PC | BUG-MOB-01, MOB-02 à MOB-05, PC-01, PC-02, DATA-01 | Zone basse non cliquable corrigée (confirmée par la joueuse qui l'avait signalée), commandes visibles avec le clavier, en-tête du téléphone, plateau PC, raccourcis clavier ; barre de saisie gardée au-dessus du menu sur Safari (#333) |
| 1 · Fiabilité | LOG-01 à 04, SAVE-01, FX-02, DATA-02, DATA-04 | Journal des parties, sauvegarde/synchro, rétention J+1/J+7 dans `/admin/stats` |
| 2 · Gameplay et découverte | NIV-02, SER-01, MEDIA-01, DISC-01, DISC-02 | Paliers d'aide, séries, médias de secours, carte « À découvrir aujourd'hui », quêtes du jour plus variées |
| 3 · Pokédex et collection | DEX-01 à 04 | Vu / capturé / possédé, voies d'obtention, filtres |
| 4 · Économie et rencontres | ECO-01 à 08 | Simulation, Drattak, expédition, coffres, statistiques, récompenses ; **ECO-03 : la meilleure partie du jour compte (30 → 60 → 90 ₽, plafond 90 ₽ par jeu et 2 000 ₽ par jour inchangés)** |
| 5 · Invitations | PART-01 à 04, DATA-03 | Invitation directe Dessine-le !, défis « même partie », carte de capture à partager, recherche d'échanges, entonnoir de partage mesuré |
| 6 · Gestes et animations | FX-01, GEST-01 à 03 | Réglage Animations (Normales / Rapides / Réduites), glisser entre fiches du Pokédex, poignée pour fermer les fenêtres, lancer de Ball au doigt (facultatif) |
| 7 · Diffusion | GROW-02 | Vidéos courtes publiées par le propriétaire ; GROW-01 (test guidé avec des inconnus) mis de côté par choix |

Correctifs récents à regarder de près : sons des hautes herbes sur iPhone (le cri mettait en pause les effets : #329, #333), économie ECO-03 (`coinPlay` dans `App/lib/poke-balls.js`, #332).

## 3. Ce que tu dois lire

1. Tes deux audits précédents : `docs/audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md` et `docs/audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md`.
2. Le plan et son état : `docs/PLAN_AMELIORATION_POKEDLE.md`, `docs/ETAT_AVANCEMENT_POKEDLE.md`, `docs/qa/*.md`.
3. Le code qui fait foi : `App/src/`, `App/lib/`, `App/server.js`, `App/test/`, et les CSS (`App/*.css`).
4. Le site en ligne https://pokdle.fr, sur téléphone (largeur 360–430 px) et sur PC.
5. Le contrôle Osytools du 7/11 (87/100 : vitesse 65, accessibilité 81) et nos premières vérifications : `docs/audits/OSYTOOLS_2026-11-07.md`. Intègre ses 5 points dans ton plan.
6. Si je te les joins : captures et export de `/admin/stats` (période, jeux, rétention, économie). Sans ces chiffres, ne jamais inventer de statistiques.

## 4. Ce que j'attends

**A. Vérification du plan (action par action).** Pour chacune des 43 actions : *vraiment fait* / *fait partiellement* / *pas fait ou régressé*, avec la preuve (fichier et fonction, test, ou observation sur le site). Signale tout écart entre ce que disent les docs et ce que fait le code.

**B. Nouvel audit complet**, mêmes rubriques que tes audits du 5/11 :
1. Ergonomie téléphone et PC (premier toucher, clavier, barres système, fenêtres, lisibilité, thème sombre).
2. Fiabilité (sauvegardes, synchro entre appareils, reprise après rechargement, erreurs réseau, page ouverte pendant une mise en ligne).
3. Gameplay et pédagogie de chaque famille de jeux (difficulté, rejouabilité, retours d'erreur).
4. Collection, Pokédex, hautes herbes, captures et rareté.
5. Économie (Balls, Pokédollars, boutique, plafonds, expédition, échanges) : inflation, triche possible, modes encore déclarés par le navigateur.
6. Social et sécurité des échanges (amis, discussion, défis, signalements) — beaucoup de joueurs sont des enfants.
7. Fidélisation (raisons de revenir demain, notifications, séries).
8. Performance (poids des pages, temps de chargement sur téléphone), accessibilité, SEO.
9. Risques juridiques (nom et images Pokémon, sons officiels de capture, émulateur GBA/DS où le joueur charge son propre fichier).

**C. Un nouveau plan court**, priorisé P0 à P3, avec des identifiants (comme le précédent), pour chaque action : le problème constaté, la preuve, la correction proposée, le critère d'acceptation testable, l'effort (S/M/L) et le risque.

## 5. Règles à respecter dans tes propositions

- **Pas de musique** (choix personnel et religieux) ; sons d'effets oui. **Pas de voix IA, pas d'images IA** : uniquement les artworks officiels.
- **Ne propose aucun changement de prix, de taux de capture, de probabilité de shiny ou de récompense sans le marquer « à décider par le propriétaire »** et sans chiffrer l'effet.
- Direction artistique « cosy » à garder : fond crème `#FFF8EF`, encre `#2E2A33`, bleu `#4069E0`, jaune `#FFD45C` réservé au Pokémon du jour, lavande Party `#7C5BD6`, polices Fredoka / Nunito ; jamais la couleur seule pour un résultat.
- Respecter « réduire les animations » ; une animation ne doit jamais retarder l'action suivante.
- Le secret du Pokémon du jour ne passe jamais par le navigateur.
- **Pas d'afflux massif voulu pour l'instant** : pas de plan de pub ; pas de serveur Discord tant qu'il y a moins de 100 joueurs par jour ; pas de chat public.
- Ne propose pas une fonctionnalité qui existe déjà : vérifie dans le code avant.
- Ne propose pas d'émuler la 3DS (pas réaliste dans un navigateur, risque Nintendo) ; donne plutôt ton avis sur le risque de l'émulateur existant.
- Distingue toujours tes niveaux de preuve : [code], [site], [stat], [signal], [hypothèse].

## 6. Format de la réponse

1. Résumé décisionnel en 10 lignes maximum : ce qui va bien, les 5 problèmes les plus importants.
2. Tableau de vérification des 43 actions.
3. L'audit par rubrique.
4. Le nouveau plan (tableau).
5. Les questions que tu dois me poser avant de commencer, s'il y en a.

Écris en français, simplement, sans jargon inutile. Les deux fichiers d'audit doivent pouvoir être enregistrés dans `docs/audits/` sous les noms `AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-XX.md` et `AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-XX.md`, et le plan sous `docs/PLAN_AMELIORATION_POKEDLE_V2.md`.
