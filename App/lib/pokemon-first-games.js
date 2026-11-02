'use strict';
// Pokémon introduced after their generation's launch. These are display facts only: never change
// generation numbers used by games, saves or the album. Years refer to the introducing version.
// Sources: official Pokémon/Nintendo release announcements, grouped with the entries below.
const releases = [
  // https://press.pokemon.com/en/Items/Schedule/Video-Game?types=2
  { ids: [803, 804, 805, 806, 807], games: 'Ultra-Soleil et Ultra-Lune', year: 2017 },
  // https://pokemongo.com/fr/news/meltan-announcement ; https://pokemongo.com/fr/news/melmetal
  { ids: [808, 809], games: 'Pokémon GO', year: 2018, region: null },
  // https://en-americas-support.nintendo.com/app/answers/detail/a_id/48554
  { ids: [891, 892, 893], games: 'Épée et Bouclier — L’île solitaire de l’Armure', year: 2020 },
  { ids: [894, 895, 896, 897, 898], games: 'Épée et Bouclier — Les terres enneigées de la Couronne', year: 2020 },
  // https://www.nintendo.com/us/whatsnew/pokemon-legends-arceus-is-available-now/
  { ids: [899, 900, 901, 902, 903, 904, 905], games: 'Légendes Pokémon : Arceus', year: 2022, region: 'Hisui' },
  // https://press.pokemon.com/en-NZ/Pokemon-Day-2023-Announcement
  { ids: [1009, 1010], games: 'Écarlate et Violet — raids événementiels', year: 2023 },
  // https://en-americas-support.nintendo.com/app/answers/detail/a_id/61306/
  { ids: [1011, 1012, 1013, 1014, 1015, 1016, 1017], games: 'Écarlate et Violet — Le Masque Turquoise', year: 2023, region: 'Septentria' },
  { ids: [1018, 1019, 1020, 1021, 1022, 1023, 1024], games: 'Écarlate et Violet — Le Disque Indigo', year: 2023 },
  // https://press.pokemon.com/en-AU/Mythical-Pokemon-from-Kitakami-Discovered
  { ids: [1025], games: 'Écarlate et Violet — épilogue du Trésor enfoui de la Zone Zéro', year: 2024, region: 'Septentria' },
];

module.exports = new Map(releases.flatMap(({ ids, ...facts }) => ids.map((id) => [id, Object.freeze(facts)])));
