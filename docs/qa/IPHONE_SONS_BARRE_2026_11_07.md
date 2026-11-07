# iPhone : sons en retard et barre de saisie sous le menu (7/11/2026, retours de Kayan)

## 1. Sons des hautes herbes
- Constat : la 1re rencontre a ses sons. Après être sorti puis revenu dans le mode, il ne reste que le cri. Les autres sons
  arrivent tous d'un coup quand on change d'appli puis qu'on revient sur Pokédle.
- Cause : sur iPhone, le cri (un `<audio>`) met en pause le moteur des effets (`AudioContext` « suspended » ou
  « interrupted »). Les sons demandés ensuite attendent et sortent tous au retour dans l'appli. L'ancien code ne
  relançait que l'état « suspended », et seulement au moment d'un son, souvent hors d'un toucher (refusé par iOS).
- Correction (`src/script.10c.pokedex-effects.js`) : chaque toucher, clic ou touche relance le moteur. Un moteur fermé
  est recréé. Si le moteur est en pause loin d'un toucher (plus de 1,5 s), le son est sauté au lieu d'attendre : plus
  jamais de rafale en retard.

## 2. Barre « Tape un nom de Pokémon… »
- Constat : plus on fait d'essais, plus la barre descend, jusqu'à passer sous le menu du bas.
- Cause : chaque essai ajoute une carte au-dessus de la barre ; Chrome garde la page en place, Safari ne le fait pas.
- Correction (`src/script.10jb.guess-bar-anchor.js`) : sur téléphone, après chaque nouvel essai, si la barre est sous
  le menu (ou sous le clavier), la page remonte juste assez pour qu'elle soit entière. Rien ne bouge si elle est
  visible. Vérifié dans Chromium en coupant l'ancrage du défilement comme Safari : barre 570–698 sous le menu (594)
  avant, 458–586 après.

## Tests
- `test/ios-sound-guessbar-2026-11-07.test.js` ; `npm test` avec PostgreSQL : 1025/1025.

## À revérifier sur iPhone
1. Hautes herbes : quitter le mode, revenir, rencontre puis lancer : apparition, lancer, secousses, capture entendus au bon moment.
2. Pokémon du jour ou Classique : après 6 essais, la barre et « Deviner » restent au-dessus du menu.
