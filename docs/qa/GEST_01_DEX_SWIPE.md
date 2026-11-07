# GEST-01 — Glisser entre les fiches du Pokédex : protocole

**Objet :** passer d'une fiche Pokémon à la suivante d'un geste, sur téléphone, en gardant des flèches visibles. Maquette validée par Kayan le 07/11.

## Constat
Sur téléphone, les boutons « Précédent / Suivant » de la fiche Pokédex sont en bas de la fiche, hors de l'écran.

## Règles
- **Téléphone seulement** (largeur ≤ 640 px, le même seuil que la fiche plein écran). Sur PC, Précédent / Suivant sont déjà visibles en haut de la fiche, donc rien ne change.
- **Flèches ‹ ›** de 44 px de chaque côté de l'image, toujours visibles et désactivées en bout de liste. Les noms des voisins sont affichés dessous (« ← #24 Arbok · #26 Raichu → »). Les boutons du bas restent.
- **Glisser sur l'image seulement**. Le reste de la fiche défile normalement (`touch-action: pan-y`), et un mouvement surtout vertical reste un défilement.
- On change de fiche au-delà du quart de la largeur (au moins 40 px), s'il y a un voisin. Sinon la fiche revient en place.
- Même navigation que les boutons : le filtre en cours est suivi (« Ma collection », types, recherche…).
- En « Animations réduites », la fiche change sans effet de glissement. La souris ne déclenche pas le geste : sur PC, on clique.
- Le conseil « 👆 Glisse pour passer au suivant » s'affiche **2 fois au plus**, et plus du tout une fois le geste utilisé (clé locale `pokedle_dex_swipe_hint_v1`).
- Rien n'est envoyé au serveur.

## Contrôles
- `App/test/gest01-dex-swipe.test.js` :
  - seuils du geste : longueur, diagonale, bout de liste ;
  - téléphone seulement, image seulement, défilement gardé, animations réduites respectées, aucun appel réseau ;
  - conseil limité à 2 affichages.
- Chromium (iPhone 13 émulé) :
  - un vrai glissement tactile vers la gauche passe de Pikachu au Pokémon suivant de la liste ;
  - un glissement de 36 px ne change rien ;
  - pas de défilement horizontal.
- PC 1366 px : la fiche ne change pas.
- `npm test` avec PostgreSQL local : 1018/1018. **Aucune recette sur iPhone physique revendiquée** : le geste est à confirmer sur un vrai téléphone, comme BUG-MOB-01.
