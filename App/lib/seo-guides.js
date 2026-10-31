'use strict';
// The guides (/guides/<slug>), step 2 of the plan (31/10/2026): long pages that answer what players
// search for, with a button to the game. Every rule stated here is checked against the game code
// (test/seo-guides-2026-10-31.test.js): the daily comparison, the points and the type chart.

// The modern type chart (Gen 6+), the same as TYPE_EFFECTIVENESS in src/script.04.jeu-pokedex.js.
const TYPE_CHART = Object.freeze({
  Normal: { super: [], not: ['Roche', 'Acier'], no: ['Spectre'] },
  Feu: { super: ['Plante', 'Glace', 'Insecte', 'Acier'], not: ['Feu', 'Eau', 'Roche', 'Dragon'], no: [] },
  Eau: { super: ['Feu', 'Sol', 'Roche'], not: ['Eau', 'Plante', 'Dragon'], no: [] },
  Plante: { super: ['Eau', 'Sol', 'Roche'], not: ['Feu', 'Plante', 'Poison', 'Vol', 'Insecte', 'Dragon', 'Acier'], no: [] },
  Électrik: { super: ['Eau', 'Vol'], not: ['Plante', 'Électrik', 'Dragon'], no: ['Sol'] },
  Glace: { super: ['Plante', 'Sol', 'Vol', 'Dragon'], not: ['Feu', 'Eau', 'Glace', 'Acier'], no: [] },
  Combat: { super: ['Normal', 'Glace', 'Roche', 'Ténèbres', 'Acier'], not: ['Poison', 'Vol', 'Psy', 'Insecte', 'Fée'], no: ['Spectre'] },
  Poison: { super: ['Plante', 'Fée'], not: ['Poison', 'Sol', 'Roche', 'Spectre'], no: ['Acier'] },
  Sol: { super: ['Feu', 'Électrik', 'Poison', 'Roche', 'Acier'], not: ['Plante', 'Insecte'], no: ['Vol'] },
  Vol: { super: ['Plante', 'Combat', 'Insecte'], not: ['Électrik', 'Roche', 'Acier'], no: [] },
  Psy: { super: ['Combat', 'Poison'], not: ['Psy', 'Acier'], no: ['Ténèbres'] },
  Insecte: { super: ['Plante', 'Psy', 'Ténèbres'], not: ['Feu', 'Combat', 'Poison', 'Vol', 'Spectre', 'Acier', 'Fée'], no: [] },
  Roche: { super: ['Feu', 'Glace', 'Vol', 'Insecte'], not: ['Combat', 'Sol', 'Acier'], no: [] },
  Spectre: { super: ['Psy', 'Spectre'], not: ['Ténèbres'], no: ['Normal'] },
  Dragon: { super: ['Dragon'], not: ['Acier'], no: ['Fée'] },
  Ténèbres: { super: ['Psy', 'Spectre'], not: ['Combat', 'Ténèbres', 'Fée'], no: [] },
  Acier: { super: ['Glace', 'Roche', 'Fée'], not: ['Feu', 'Eau', 'Électrik', 'Acier'], no: [] },
  Fée: { super: ['Combat', 'Dragon', 'Ténèbres'], not: ['Feu', 'Poison', 'Acier'], no: [] },
});
// The site's own type icons (img/type-icons/<name>.svg).
const TYPE_ICONS = Object.freeze({
  Normal: 'normal', Feu: 'fire', Eau: 'water', Plante: 'grass', Électrik: 'electric', Glace: 'ice', Combat: 'fighting', Poison: 'poison', Sol: 'ground',
  Vol: 'flying', Psy: 'psychic', Insecte: 'bug', Roche: 'rock', Spectre: 'ghost', Dragon: 'dragon', Ténèbres: 'dark', Acier: 'steel', Fée: 'fairy',
});

const PUBLISHED = '2026-10-31';

// The 9 generations: region, first games (year of release in Japan) and their national numbers.
const GENERATIONS = Object.freeze([
  { gen: 1, region: 'Kanto', games: 'Rouge et Bleu', year: 1996, from: 1, to: 151 },
  { gen: 2, region: 'Johto', games: 'Or et Argent', year: 1999, from: 152, to: 251 },
  { gen: 3, region: 'Hoenn', games: 'Rubis et Saphir', year: 2002, from: 252, to: 386 },
  { gen: 4, region: 'Sinnoh', games: 'Diamant et Perle', year: 2006, from: 387, to: 493 },
  { gen: 5, region: 'Unys', games: 'Noir et Blanc', year: 2010, from: 494, to: 649 },
  { gen: 6, region: 'Kalos', games: 'X et Y', year: 2013, from: 650, to: 721 },
  { gen: 7, region: 'Alola', games: 'Soleil et Lune', year: 2016, from: 722, to: 809 },
  { gen: 8, region: 'Galar', games: 'Épée et Bouclier', year: 2019, from: 810, to: 905 },
  { gen: 9, region: 'Paldea', games: 'Écarlate et Violet', year: 2022, from: 906, to: 1025 },
]);
// The three starters of each generation (Plante, Feu, Eau); each line ends two numbers later.
const STARTERS = Object.freeze([[1, 4, 7], [152, 155, 158], [252, 255, 258], [387, 390, 393], [495, 498, 501], [650, 653, 656], [722, 725, 728], [810, 813, 816], [906, 909, 912]]);
// Legendary and mythical Pokémon by the official categories. With the Ultra Beasts and six
// Paradox Pokémon they make the « Légendes » of the site (POKEDEX_LEGENDARY_IDS, LEGENDARY_IDS).
const LEGENDARIES = Object.freeze({
  1: [144, 145, 146, 150], 2: [243, 244, 245, 249, 250], 3: [377, 378, 379, 380, 381, 382, 383, 384],
  4: [480, 481, 482, 483, 484, 485, 486, 487, 488], 5: [638, 639, 640, 641, 642, 643, 644, 645, 646], 6: [716, 717, 718],
  7: [772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800], 8: [888, 889, 890, 891, 892, 894, 895, 896, 897, 898, 905],
  9: [1001, 1002, 1003, 1004, 1007, 1008, 1014, 1015, 1016, 1017, 1024],
});
const MYTHICALS = Object.freeze([151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721, 801, 802, 807, 808, 809, 893, 1025]);
const ULTRA_BEASTS = Object.freeze([793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);
const PARADOX_LEGENDS = Object.freeze([1009, 1010, 1020, 1021, 1022, 1023]);

const GUIDES = [
  {
    slug: 'methode-pokemon-du-jour', sprite: 65, ogImage: '/og-image.png', name: 'La méthode du Pokémon du jour',
    short: 'Lire les indices et trouver le Pokémon mystère en peu d’essais.',
    title: 'Pokémon du jour : la méthode pour le trouver vite | Pokédle',
    description: 'Comment lire les indices du Pokémon du jour, quoi proposer au premier essai et comment éliminer les candidats pour le trouver en peu d’essais.',
    h1: 'Pokémon du jour : la méthode pour le trouver en peu d’essais',
    lead: 'Le Pokémon du jour se trouve toujours : il n’y a pas de limite d’essais. Mais pour marquer le plus de points, il faut le trouver vite. Voici comment lire les indices et choisir tes propositions.',
    cta: { href: '/?jeu=pokemon-du-jour', label: 'Jouer au Pokémon du jour' },
    games: ['pokemon-du-jour', 'devine-le-pokemon', 'wordle-pokemon'],
    sections: [
      {
        h2: 'Ce que disent les 9 indices',
        p: ['Chaque proposition est comparée au Pokémon mystère. Vert : c’est juste. Orange : c’est proche. Gris : c’est faux.'],
        list: [
          'Génération : juste ou faux. La pastille « ↑ plus récente » ou « ↓ plus ancienne » dit dans quel sens chercher.',
          'Forme : le Pokémon mystère est toujours une forme de base. Proposer une Méga ou une forme régionale met ce critère au faux.',
          'Types 1 et 2 : vert si le type est à la même place, orange s’il existe mais à l’autre place.',
          'Habitat : juste ou faux.',
          'Couleur : vert si les couleurs sont les mêmes, orange si une couleur est en commun.',
          'Stade d’évolution : juste ou faux.',
          'Taille : vert si identique, orange à 0,3 m près, avec une flèche vers le haut ou vers le bas.',
          'Poids : vert si identique, orange à 15 kg près, avec une flèche vers le haut ou vers le bas.',
        ],
      },
      {
        h2: 'Le premier essai',
        p: ['Ton premier essai sert surtout à couper le Pokédex en deux. Choisis un Pokémon :'],
        list: [
          'de génération 4 ou 5 : la flèche de génération te dit tout de suite si le mystère est plus ancien ou plus récent ;',
          'avec deux types : tu testes deux types d’un coup ;',
          'de taille et de poids moyens, pour que les flèches t’orientent dans les deux sens ;',
          'dans sa forme de base, puisque le mystère n’est jamais une Méga ni une forme régionale.',
        ],
      },
      {
        h2: 'Éliminer plutôt que deviner',
        p: [
          'Tant que tu as plusieurs pistes, propose un Pokémon qui teste quelque chose de nouveau : un autre type, un autre habitat, une autre couleur. Un essai qui confirme ce que tu sais déjà ne t’apprend rien.',
          'Combine les flèches : si la taille dit « plus grand » et le poids « plus léger », le Pokémon mystère est grand et léger. Ça élimine vite les colosses et les petits Pokémon lourds.',
          'Le carnet d’enquête, à côté du jeu, garde ce que tu as appris, avec la fourchette de générations encore possible. Relis-le avant chaque essai.',
        ],
      },
      {
        h2: 'Les points et les indices',
        list: [
          '40 points si tu trouves du premier coup, 2 de moins par essai en plus, et au moins 4 points dès que tu trouves.',
          'Un indice coûte 4 points : garde-les pour quand tu bloques vraiment.',
          'Abandonner révèle la réponse et termine le défi du jour, sans point.',
        ],
      },
      {
        h2: 'Ta série et la chasse au shiny',
        list: [
          'Chaque jour trouvé allonge ta série. Avec un compte Discord, Google ou Twitch, elle te suit sur tous tes appareils.',
          'Chaque Pokémon du jour trouvé rejoint ta collection, avec une chance d’être shiny : 1 sur 40, 1 sur 30 dès 7 jours de série, 1 sur 20 dès 30 jours.',
          'Le Pokémon change à minuit, heure de Paris, et ne revient pas avant un an.',
        ],
      },
    ],
    faq: [
      ['Le Pokémon du jour peut-il être une Méga-Évolution ?', 'Non : le Pokémon mystère est toujours une forme de base. Les formes spéciales servent seulement à proposer.'],
      ['Que veut dire une case orange ?', 'Que tu es proche : le bon type mais à l’autre place, une couleur en commun, une taille à 0,3 m près ou un poids à 15 kg près.'],
      ['Combien de points peut-on gagner ?', 'Jusqu’à 40 au premier essai, puis 2 de moins par essai supplémentaire et 4 de moins par indice, avec au moins 4 points quand tu trouves.'],
    ],
  },
  {
    slug: 'table-des-types-pokemon', sprite: 493, ogImage: '/img/og/table-des-types.jpg', name: 'La table des types expliquée',
    short: 'Qui bat qui, les faiblesses ×4, les immunités et le tableau complet.',
    title: 'Table des types Pokémon : forces et faiblesses | Pokédle',
    description: 'Les 18 types Pokémon expliqués simplement : qui bat qui, les doubles faiblesses ×4, les 8 immunités et un tableau complet type par type.',
    h1: 'La table des types Pokémon expliquée simplement',
    lead: 'Feu bat Plante, Eau bat Feu… mais Sol ne touche pas Vol, et Glace fait ×4 sur Dracolosse. Voici tout ce qu’il faut savoir sur les 18 types, avec le tableau complet.',
    cta: { href: '/?jeu=table-des-types', label: 'Ouvrir la table des types' },
    games: ['table-des-types', 'combo-de-types', 'team-builder'],
    sections: [
      {
        h2: 'Les bases : ×2, ×½ et ×0',
        list: [
          'Super efficace : l’attaque fait deux fois plus de dégâts (×2).',
          'Pas très efficace : elle en fait moitié moins (×½).',
          'Aucun effet : l’attaque ne fait rien du tout (×0).',
          'Dans tous les autres cas, les dégâts sont normaux (×1).',
        ],
      },
      {
        h2: 'Les doubles types : ×4 et ×¼',
        p: [
          'Quand un Pokémon a deux types, on multiplie les deux effets. Glace contre Dracolosse (Dragon et Vol) : ×2 puis ×2, soit ×4. Plante contre Dracaufeu (Feu et Vol) : ×½ puis ×½, soit ×¼.',
          'Une immunité l’emporte toujours : si un des deux types ne craint pas l’attaque, le résultat est ×0.',
        ],
      },
      {
        h2: 'Les 8 immunités à connaître',
        list: [
          'Normal et Combat ne touchent pas Spectre.',
          'Spectre ne touche pas Normal.',
          'Sol ne touche pas Vol.',
          'Électrik ne touche pas Sol.',
          'Psy ne touche pas Ténèbres.',
          'Poison ne touche pas Acier.',
          'Dragon ne touche pas Fée.',
        ],
      },
      { h2: 'Le tableau type par type', p: ['Pour chaque type d’attaque : contre qui il est super efficace, pas très efficace, ou sans effet.'], table: 'types' },
      {
        h2: 'Les types les plus utiles en attaque',
        p: ['Combat et Sol sont super efficaces contre 5 types chacun. Feu, Glace et Roche suivent avec 4. À l’inverse, Normal n’est super efficace contre aucun type.'],
      },
      {
        h2: 'Le bonus du même type',
        p: ['Une attaque du même type que le Pokémon qui la lance fait 1,5 fois plus de dégâts. C’est pour ça qu’un Pokémon Feu préfère les attaques Feu.'],
      },
      {
        h2: 'Selon les générations',
        p: ['Les types Acier et Ténèbres sont arrivés en 2e génération, le type Fée en 6e. Sur Pokédle, la table des types propose les trois époques : Gen 1, Gen 2 à 5, et Gen 6 et plus.'],
      },
    ],
    faq: [
      ['Combien y a-t-il de types Pokémon ?', '18 types depuis la 6e génération et l’arrivée du type Fée.'],
      ['Qu’est-ce qui bat le type Fée ?', 'Poison et Acier sont super efficaces contre Fée. Fée, lui, est super efficace contre Combat, Dragon et Ténèbres.'],
      ['Quel type ne touche pas les Pokémon Vol ?', 'Sol : ses attaques n’ont aucun effet sur les Pokémon Vol.'],
      ['Qu’est-ce qu’une faiblesse ×4 ?', 'Quand une attaque est super efficace contre les deux types d’un Pokémon, ses dégâts sont multipliés par 4, comme Glace contre Dracolosse.'],
    ],
  },
  {
    slug: 'generations-pokemon', sprite: 251, ogImage: '/img/og/ordre-pokedex.jpg', name: 'Les 9 générations Pokémon',
    short: 'Régions, jeux, années et numéros de chaque génération.',
    title: 'Les 9 générations Pokémon : régions et jeux | Pokédle',
    description: 'De Kanto à Paldea : les 9 générations Pokémon, leurs régions, leurs premiers jeux, leur année et les numéros du Pokédex de chacune.',
    h1: 'Les 9 générations Pokémon, de Kanto à Paldea',
    lead: 'Depuis 1996, chaque génération apporte une nouvelle région et de nouveaux Pokémon : 1025 en tout, sur 9 générations. Voici le tableau complet, avec les numéros du Pokédex de chacune.',
    cta: { href: '/?jeu=ordre-pokedex', label: 'S’entraîner à l’Ordre Pokédex' },
    games: ['ordre-pokedex', 'speedrun-pokedex', 'quiz-pokemon'],
    sections: [
      { h2: 'Le tableau des générations', p: ['Les années sont celles de la sortie au Japon. Les numéros sont ceux du Pokédex national.'], table: 'generations' },
      {
        h2: 'Reconnaître la génération d’un Pokémon',
        list: [
          'Son numéro du Pokédex national le dit tout de suite : de 1 à 151 pour la 1re, de 152 à 251 pour la 2e, et ainsi de suite.',
          'Presque chaque génération s’ouvre sur ses trois starters : Bulbizarre (n° 1), Germignon (n° 152), Arcko (n° 252)… Seule exception, la 5e commence par Victini (n° 494).',
          'Les formes régionales (Alola, Galar, Hisui, Paldea) gardent le numéro du Pokémon d’origine.',
          'Les Méga-Évolutions, apparues en 6e génération, ne sont pas de nouveaux Pokémon : elles gardent le numéro du Pokémon qui évolue.',
        ],
      },
      {
        h2: 'Sur Pokédle',
        p: ['Le bouton « Générations » de l’accueil limite les jeux compatibles aux générations que tu choisis. Dans le Pokémon du jour, la pastille de génération te dit s’il faut chercher plus ancien ou plus récent.'],
      },
    ],
    faq: [
      ['Combien y a-t-il de générations Pokémon ?', '9, de Kanto (1996) à Paldea (2022), pour 1025 Pokémon en tout.'],
      ['Quelle génération a le plus de Pokémon ?', 'La 5e, celle d’Unys, avec 156 nouveaux Pokémon.'],
      ['Quelle génération en a le moins ?', 'La 6e, celle de Kalos, avec 72 nouveaux Pokémon.'],
    ],
  },
  {
    slug: 'starters-pokemon', sprite: 4, ogImage: '/img/og/devine-le-pokemon.jpg', name: 'Les starters Pokémon',
    short: 'Les 27 starters de chaque génération et leur évolution finale.',
    title: 'Les starters Pokémon de chaque génération | Pokédle',
    description: 'Les 27 starters Pokémon, de Bulbizarre à Coiffeton : génération par génération, avec leurs types et leur évolution finale, et le triangle Plante, Feu, Eau.',
    h1: 'Les starters Pokémon de chaque génération',
    lead: 'Au début de chaque aventure, on choisit un Pokémon parmi trois : un Plante, un Feu et un Eau. Voici les 27 starters, de Kanto à Paldea, avec leur évolution finale.',
    cta: { href: '/?jeu=devine-le-pokemon', label: 'Deviner des Pokémon' },
    games: ['devine-le-pokemon', 'evolution-pokemon', 'pokemon-pixelise'],
    sections: [
      {
        h2: 'Le triangle Plante, Feu, Eau',
        p: ['Plante bat Eau, Eau bat Feu, Feu bat Plante : chaque starter a un avantage contre un des deux autres, et une faiblesse contre le troisième. C’est pour ça que le rival choisit souvent celui qui bat le tien.'],
      },
      { h2: 'Les starters génération par génération', p: ['Chaque starter, puis son évolution finale.'], table: 'starters' },
      {
        h2: 'Quelques curiosités',
        list: [
          'Seuls deux starters ont deux types dès le départ : Bulbizarre (Plante et Poison) et Brindibou (Plante et Vol).',
          'Trois starters Feu finissent Feu et Combat : Braségali, Simiabraz et Roitiflam.',
          '10 évolutions finales sur 27 n’ont qu’un seul type, comme Tortank ou Typhlosion.',
        ],
      },
    ],
    faq: [
      ['Combien y a-t-il de starters Pokémon ?', '27 : trois par génération, sur 9 générations.'],
      ['Quels sont les starters de la 9e génération ?', 'Poussacha (Plante), Chochodile (Feu) et Coiffeton (Eau), dans Écarlate et Violet.'],
      ['Quel starter choisir ?', 'Il n’y a pas de mauvais choix : chacun a un avantage contre un des deux autres. Prends celui que tu préfères !'],
    ],
  },
  {
    slug: 'pokemon-legendaires', sprite: 150, ogImage: '/img/og/pokedex.jpg', name: 'Les Pokémon légendaires',
    short: 'Les 71 légendaires et 23 fabuleux, génération par génération.',
    title: 'Pokémon légendaires et fabuleux : la liste | Pokédle',
    description: 'La liste des Pokémon légendaires et fabuleux de chaque génération, de Mewtwo à Terapagos, avec la différence entre légendaire, fabuleux et Ultra-Chimère.',
    h1: 'Les Pokémon légendaires et fabuleux, génération par génération',
    lead: 'Mewtwo, Lugia, Rayquaza, Arceus… Les légendaires sont les Pokémon les plus rares de chaque région. Voici la liste complète des 71 légendaires et des 23 fabuleux.',
    cta: { href: '/?jeu=pokedex', label: 'Ouvrir le Pokédex' },
    games: ['pokedex', 'grille-pokemon', 'devine-le-pokemon'],
    sections: [
      {
        h2: 'Légendaire ou fabuleux ?',
        p: ['Les légendaires sont des Pokémon rares, souvent uniques dans leur jeu et liés à l’histoire de leur région. Les fabuleux (on dit aussi « mythiques ») sont encore plus rares : on les obtenait surtout lors d’évènements, comme Mew ou Celebi.'],
      },
      { h2: 'Les légendaires génération par génération', legendaries: true },
      { h2: 'Les 23 Pokémon fabuleux', pokemon: 'mythicals' },
      {
        h2: 'Et les Ultra-Chimères ?',
        p: ['Venues d’un autre monde dans Soleil et Lune, puis Ultra-Soleil et Ultra-Lune, les 11 Ultra-Chimères (Zéroïd, Mouscoto, Pierroteknik…) ne sont ni légendaires ni fabuleuses, mais on les range souvent avec eux.'],
      },
      {
        h2: 'Sur Pokédle',
        p: ['Le filtre « Légendes » du Pokédex et le critère « Légendaire ou fabuleux » de la Grille du jour regroupent les 71 légendaires, les 23 fabuleux, les 11 Ultra-Chimères et six Pokémon Paradoxe, soit 111 Pokémon.'],
      },
    ],
    faq: [
      ['Combien y a-t-il de Pokémon légendaires ?', '71 légendaires et 23 fabuleux, sur les 1025 Pokémon des 9 générations.'],
      ['Quel est le premier Pokémon fabuleux ?', 'Mew, le n° 151, caché dans les premiers jeux Rouge et Bleu.'],
      ['Quelle génération a le plus de légendaires ?', 'Les 7e, 8e et 9e générations, avec 11 légendaires chacune.'],
    ],
  },
];

module.exports = { GUIDES, TYPE_CHART, TYPE_ICONS, PUBLISHED, GENERATIONS, STARTERS, LEGENDARIES, MYTHICALS, ULTRA_BEASTS, PARADOX_LEGENDS };
