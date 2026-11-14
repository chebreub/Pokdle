# Capture : progression de collection et présentation

## Périmètre
- DA existante conservée : décors des six zones, crème, violet, jaune.
- Progression par zone fondée sur la possession actuelle, normale ou shiny. Filtres manquants/possédés, pagination, chaînes vérifiées proches d'être complétées.
- Relecture de la collection à chaque ouverture ; erreur et réponse périmée gérées sans présenter un faux compteur.
- Résultat : progression dans la zone renvoyée par le serveur, chaîne existante, accès à la fiche d'un doublon échangeable, choix du partenaire existant.
- Scène : nom lisible, choix de Ball compact, ombre du lancer, effets moins envahissants et nettoyage du sillage lorsque l'animation est interrompue.
- Sons GO existants et timings conservés. Aucun changement serveur, taux, récompense, stock ou règle de rencontre.

## Validation
- `npm run build` : OK.
- `npm test` : 1 166 réussis, 103 ignorés, aucun échec.
- Six nouveaux tests couvrent possession distincte, rafraîchissement après échange/relâchement, erreurs, réponses hors ordre, pagination, chaînes vérifiées et doublons.
- `git diff --check` : OK.

## Recette visuelle restant nécessaire avant fusion
Le navigateur distant ne peut pas joindre le serveur local (connexion refusée). La recette visuelle n'est donc pas déclarée validée ; la PR reste en brouillon.

Vérifier sur PC et mobile (390 px et petite hauteur), thèmes clair/sombre :
1. Six zones, choix au hasard, filtres, pagination, focus clavier et fermeture.
2. Rencontre normale/shiny, deux ou trois Balls, stocks nuls, trois lancers, fuite.
3. Animation complète et passage rapide : aucune particule persistante ; sons synchronisés et réglage animations réduites respecté.
4. Capture initiale, doublon, variante shiny, partenaire, album et rencontre suivante.
5. Capture légendaire/prestige et reprise d'une rencontre ouverte : ne pas afficher une progression de zone sans données.

Les chiffres de progression indiquent une possession actuelle, pas l'historique cumulatif. Les chaînes de trois espèces réutilisent les relations vérifiées du projet ; elles ne prétendent pas représenter toutes les branches d'évolution.

## Correction après retour utilisateur (14 novembre)
L'habillage ajouté par la PR #415 dénotait avec le site. Suppression des surcharges de palette violette, des fonds de cartes, du bandeau rouge, des CTA jaunes et des nouvelles dimensions de scène/Balls. Les composants historiques reprennent leur style ; seuls les nouveaux blocs de collection reçoivent des styles additionnels dans la palette existante. La plaque de nom superposée au décor est retirée.

Animation : anneau convergent pendant l'absorption, onde au contact du sol, secousses progressivement plus amples avec ombre mobile, voyant rouge pendant la secousse puis vert à la capture. Effets exécutés dans les étapes existantes, sans changement des durées, sons ou règles. Les anneaux sont retirés à la fin ou lorsqu'on passe l'animation ; le mode réduit ne les crée pas.

Validation locale : compilation, syntaxe des deux fichiers JS et 8 tests ciblés réussis. Le navigateur natif a également été essayé : il ne peut pas joindre le serveur local. Pas de validation visuelle revendiquée.
