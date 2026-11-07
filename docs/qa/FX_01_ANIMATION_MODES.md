# FX-01 — Réglage « Animations » : protocole

**Objet :** laisser chaque joueur choisir la durée des animations, sans rien changer aux résultats. Maquette validée par Kayan le 07/11.

## Règles
- Dans Paramètres, un réglage **Animations** à trois choix remplace l'interrupteur « Réduire les animations » :
  - **Normales** : comme avant ;
  - **⚡ Rapides** : les mêmes animations deux fois plus courtes. Ça vaut pour les minuteries, les animations Web et les animations CSS de la capture, du cadeau, des coffres et des nouvelles entrées du Pokédex ;
  - **Réduites** : l'ancien interrupteur, le résultat s'affiche tout de suite.
- **Compatibilité** : un joueur qui avait coché « Réduire » est en « Réduites » ; les autres sont en « Normales ». La clé `reduceMotion` reste synchronisée, donc le reste du site se comporte comme avant.
- Le réglage « réduire les animations » **du système** reste prioritaire.
- **Correctif** : l'animation de capture des hautes herbes suivait seulement le réglage du téléphone. Elle suit maintenant celui du site.
- « **Passer ›** » existe dès le lancer de la Ball et coupe l'animation. **Le résultat est déjà décidé par le serveur** : passer ou accélérer ne change jamais la chance de capture.
- Les célébrations de niveau ne font pas partie de ce périmètre.

## Contrôles
- `App/test/fx01-animation-modes.test.js` :
  - la compatibilité avec l'ancien interrupteur ;
  - la priorité du réglage système ;
  - l'enregistrement et la classe `anim-fast` ;
  - les durées divisées par deux, et toutes les minuteries de la capture mises à l'échelle ;
  - les hautes herbes qui suivent le réglage du site ;
  - l'ancienne case remplacée.
- Mesure dans Chromium (iPhone 13 émulé) : une capture dure **6,6 s** en Normales, **3,4 s** en Rapides et est **immédiate** en Réduites. « Passer › » est visible et coupe l'animation en 0,2 s.
- `npm test` avec PostgreSQL local : 1015/1015. **Aucune recette sur iPhone physique revendiquée.**
