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
];

module.exports = { GUIDES, TYPE_CHART, TYPE_ICONS, PUBLISHED };
