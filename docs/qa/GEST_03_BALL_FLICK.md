# GEST-03 (option) — Lancer la Ball d'un geste : protocole

**Objet :** lancer la Ball en la glissant vers le haut, en option, sans rien changer aux chances ni aux dépenses. Accord de Kayan le 07/11 (« Go »).

## Règles
- **Réglage « Lancer la Ball d'un geste »** dans Paramètres, **désactivé par défaut**.
- Quand il est activé, une Ball est posée en bas de la scène des hautes herbes. Le conseil « 👆 Glisse la Ball vers le haut pour la lancer » s'affiche 2 fois au plus. **Les boutons Poké Ball / Super Ball restent.**
- La Ball glissée est celle choisie en dernier avec les boutons, sinon la première disponible.
- Un glissement vers le haut d'au moins 80 px, plutôt vertical, puis lâché appelle **exactement la même fonction que le bouton** (`wildThrow`, donc `/api/wild/throw`) : même serveur, même chance de capture.
- Un geste trop court, vers le bas, de côté ou annulé **ne dépense rien** : aucune Ball ne part sans lancer, et la Ball revient en place.

## Contrôles
- `App/test/gest03-ball-flick.test.js` :
  - seuils du geste ;
  - un seul chemin de lancer (`wildThrow`), aucun appel réseau propre ;
  - geste annulé sans effet ;
  - réglage désactivé par défaut.
- Chromium (iPhone 13 émulé), avec un faux lancer qui compte les appels :
  - réglage désactivé : pas de Ball à glisser ;
  - geste court, vers le bas, de côté : **0 lancer** ;
  - vrai glissement vers le haut : **1 lancer**, avec la Ball disponible.
- `npm test` avec PostgreSQL local : tous verts. **Aucune recette sur iPhone physique revendiquée.**
