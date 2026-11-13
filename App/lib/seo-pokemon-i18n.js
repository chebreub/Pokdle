'use strict';
// 🌐 Traduction, lot 6a (13/11/2026) : les 1025 pages Google des Pokémon en anglais et en espagnol,
// /en/pokemon/<nom anglais> et /es/pokemon/<nom espagnol>. Mêmes faits que la page française
// (lib/seo-pokemon.js) : seuls les mots changent. Noms officiels des Pokémon (i18n/pokemon-names.json),
// des types, des régions et des jeux ; rien n'est traduit « maison » quand un nom officiel existe.
const fs = require('fs');
const path = require('path');
const seoPokemon = require('./seo-pokemon');

const NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', 'pokemon-names.json'), 'utf8'));
const LANGS = ['en', 'es'];

const TYPES = {
  fr: ['Acier', 'Combat', 'Dragon', 'Eau', 'Feu', 'Fée', 'Glace', 'Insecte', 'Normal', 'Plante', 'Poison', 'Psy', 'Roche', 'Sol', 'Spectre', 'Ténèbres', 'Vol', 'Électrik'],
  en: ['Steel', 'Fighting', 'Dragon', 'Water', 'Fire', 'Fairy', 'Ice', 'Bug', 'Normal', 'Grass', 'Poison', 'Psychic', 'Rock', 'Ground', 'Ghost', 'Dark', 'Flying', 'Electric'],
  es: ['Acero', 'Lucha', 'Dragón', 'Agua', 'Fuego', 'Hada', 'Hielo', 'Bicho', 'Normal', 'Planta', 'Veneno', 'Psíquico', 'Roca', 'Tierra', 'Fantasma', 'Siniestro', 'Volador', 'Eléctrico'],
};
const COLORS = {
  fr: ['Blanc', 'Bleu', 'Brun', 'Gris', 'Jaune', 'Noir', 'Rose', 'Rouge', 'Vert', 'Violet'],
  en: ['White', 'Blue', 'Brown', 'Gray', 'Yellow', 'Black', 'Pink', 'Red', 'Green', 'Purple'],
  es: ['Blanco', 'Azul', 'Marrón', 'Gris', 'Amarillo', 'Negro', 'Rosa', 'Rojo', 'Verde', 'Morado'],
};
const HABITATS = {
  fr: ['Eau douce', 'Forêt', 'Grotte', 'Mer', 'Montagne', 'Prairie', 'Rare', 'Sentier accidenté', 'Urbain'],
  en: ['Fresh water', 'Forest', 'Cave', 'Sea', 'Mountain', 'Grassland', 'Rare', 'Rough terrain', 'Urban'],
  es: ['Agua dulce', 'Bosque', 'Cueva', 'Mar', 'Montaña', 'Pradera', 'Raro', 'Terreno agreste', 'Urbano'],
};
const REGIONS = { Unys: { en: 'Unova', es: 'Teselia' } };
const GAMES = {
  'Rouge et Bleu': ['Red and Blue', 'Rojo y Azul'], 'Or et Argent': ['Gold and Silver', 'Oro y Plata'],
  'Rubis et Saphir': ['Ruby and Sapphire', 'Rubí y Zafiro'], 'Diamant et Perle': ['Diamond and Pearl', 'Diamante y Perla'],
  'Noir et Blanc': ['Black and White', 'Negro y Blanco'], 'X et Y': ['X and Y', 'X e Y'], 'Soleil et Lune': ['Sun and Moon', 'Sol y Luna'],
  'Épée et Bouclier': ['Sword and Shield', 'Espada y Escudo'], 'Écarlate et Violet': ['Scarlet and Violet', 'Escarlata y Púrpura'],
  'Ultra-Soleil et Ultra-Lune': ['Ultra Sun and Ultra Moon', 'Ultrasol y Ultraluna'], 'Pokémon GO': ['Pokémon GO', 'Pokémon GO'],
  'Épée et Bouclier — L’île solitaire de l’Armure': ['Sword and Shield — The Isle of Armor', 'Espada y Escudo — La isla de la armadura'],
  'Épée et Bouclier — Les terres enneigées de la Couronne': ['Sword and Shield — The Crown Tundra', 'Espada y Escudo — Las nieves de la corona'],
  'Légendes Pokémon : Arceus': ['Pokémon Legends: Arceus', 'Leyendas Pokémon: Arceus'],
  'Écarlate et Violet — raids événementiels': ['Scarlet and Violet — event raids', 'Escarlata y Púrpura — teraincursiones de evento'],
  'Écarlate et Violet — Le Masque Turquoise': ['Scarlet and Violet — The Teal Mask', 'Escarlata y Púrpura — La máscara turquesa'],
  'Écarlate et Violet — Le Disque Indigo': ['Scarlet and Violet — The Indigo Disk', 'Escarlata y Púrpura — El disco índigo'],
  'Écarlate et Violet — épilogue du Trésor enfoui de la Zone Zéro': ['Scarlet and Violet — The Hidden Treasure of Area Zero epilogue', 'Escarlata y Púrpura — epílogo de El tesoro oculto del Área Cero'],
};
const STATS = { en: ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'], es: ['PS', 'Ataque', 'Defensa', 'At. Esp.', 'Def. Esp.', 'Velocidad'] };
const STAGES = { 'Forme de base': ['Base form', 'Forma base'], 'Première évolution': ['First evolution', 'Primera evolución'], 'Deuxième évolution': ['Second evolution', 'Segunda evolución'] };

const idx = (lang) => (lang === 'en' ? 0 : 1);
const fromList = (table, value, lang) => { const i = table.fr.indexOf(value); return i >= 0 ? table[lang][i] : value; };
const type = (t, lang) => fromList(TYPES, t, lang);
const region = (r, lang) => (r && REGIONS[r] ? REGIONS[r][lang] : r);
const game = (g, lang) => (GAMES[g] ? GAMES[g][idx(lang)] : g);
const num = (n, lang) => Number(n).toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: 1 });
const list = (items, lang) => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + (lang === 'en' ? ' and ' : ' y ') + items[items.length - 1]);
const ordinal = (n, lang) => (lang === 'en' ? n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th') : n + '.ª');

function nameOf(p, lang) {
  const id = Number(p.id);
  return (lang === 'es' && NAMES.es[id]) || NAMES.en[id] || p.name;
}
// One slug per Pokémon and per language (a clash would take its number, like the French pages).
const SLUGS = { en: new Map(), es: new Map() };
const BY_SLUG = { en: new Map(), es: new Map() };
for (const lang of LANGS) {
  for (const p of seoPokemon.BASE) {
    let slug = seoPokemon.slugify(nameOf(p, lang)) || String(p.id);
    if (BY_SLUG[lang].has(slug)) slug += '-' + p.id;
    SLUGS[lang].set(p.id, slug);
    BY_SLUG[lang].set(slug, p);
  }
}
const pokemonPath = (id, lang) => '/' + lang + '/pokemon/' + SLUGS[lang].get(Number(id));
// Every language version of a Pokémon page, for the hreflang tags.
const alternates = (id) => ({ fr: seoPokemon.pokemonPath(id), en: pokemonPath(id, 'en'), es: pokemonPath(id, 'es') });

// The French facts, with every word in the page's language.
function facts(p, lang) {
  const f = seoPokemon.facts(p);
  const tr = (arr) => arr.map((t) => type(t, lang));
  return {
    ...f,
    name: nameOf(p, lang), path: pokemonPath(p.id, lang),
    types: tr(f.types), region: region(f.region, lang), generationRegion: region(f.generationRegion, lang), firstGames: game(f.firstGames, lang),
    color: f.color ? fromList(COLORS, f.color, lang) : f.color, habitat: f.habitat ? fromList(HABITATS, f.habitat, lang) : f.habitat,
    stage: f.stage && STAGES[f.stage] ? STAGES[f.stage][idx(lang)] : f.stage,
    stats: f.stats ? f.stats.map((st, i) => ({ label: STATS[lang][i], value: st.value })) : null,
    weak: { x4: tr(f.weak.x4), x2: tr(f.weak.x2), half: tr(f.weak.half), quarter: tr(f.weak.quarter), none: tr(f.weak.none) },
    frTypes: f.types, weakFr: f.weak,
    prev: f.prev, next: f.next, sameType: f.sameType,
  };
}

function intro(f, lang) {
  if (lang === 'en') {
    const kind = f.mythical ? 'a Mythical ' : f.legendary ? 'a Legendary ' : 'a ';
    return f.name + ' is ' + kind + f.types.join('/') + '-type ' + (f.starter ? 'starter ' : '') + 'Pokémon from Generation ' + f.gen + (f.region ? ' (' + f.region + ' region)' : '') + ', No. ' + f.id + ' in the National Pokédex. ' +
      'It is ' + num(f.height, lang) + ' m tall and weighs ' + num(f.weight, lang) + ' kg.' +
      (f.weak.x4.length ? ' It is especially weak to ' + list(f.weak.x4, lang) + ' moves (4× damage).' : f.weak.x2.length ? ' It is weak to ' + list(f.weak.x2, lang) + ' moves.' : ' It has no type weakness.');
  }
  const kind = f.mythical ? 'un Pokémon singular' : f.legendary ? 'un Pokémon legendario' : f.starter ? 'un Pokémon inicial' : 'un Pokémon';
  return f.name + ' es ' + kind + ' de tipo ' + list(f.types, lang) + ' de la ' + ordinal(f.gen, lang) + ' generación' + (f.region ? ' (región de ' + f.region + ')' : '') + ', n.º ' + f.id + ' de la Pokédex Nacional. ' +
    'Mide ' + num(f.height, lang) + ' m y pesa ' + num(f.weight, lang) + ' kg.' +
    (f.weak.x4.length ? ' Es muy débil a los ataques de tipo ' + list(f.weak.x4, lang) + ' (daño ×4).' : f.weak.x2.length ? ' Es débil a los ataques de tipo ' + list(f.weak.x2, lang) + '.' : ' No tiene ninguna debilidad de tipo.');
}

function faq(f, lang) {
  const weakAll = f.weak.x4.concat(f.weak.x2);
  if (lang === 'en') return [
    ['What type is ' + f.name + '?', f.name + ' is a ' + f.types.join('/') + ' type Pokémon.'],
    ['What is ' + f.name + ' weak to?', weakAll.length
      ? f.name + ' is weak to ' + list(weakAll, lang) + ' moves' + (f.weak.x4.length ? ' (4× against ' + list(f.weak.x4, lang) + ')' : '') + '.' + (f.weak.none.length ? ' ' + list(f.weak.none, lang) + ' moves have no effect on it.' : '')
      : f.name + ' has no weakness.'],
    ['What generation is ' + f.name + ' from?', f.name + ' is from Generation ' + f.gen + (f.region ? ' (' + f.region + ' region)' : '') + '. First games: ' + f.firstGames + ' (' + f.year + ').'],
    ['How tall and heavy is ' + f.name + '?', f.name + ' is ' + num(f.height, lang) + ' m tall and weighs ' + num(f.weight, lang) + ' kg.'],
  ];
  return [
    ['¿De qué tipo es ' + f.name + '?', f.name + ' es de tipo ' + list(f.types, lang) + '.'],
    ['¿Cuáles son las debilidades de ' + f.name + '?', weakAll.length
      ? f.name + ' es débil a los ataques de tipo ' + list(weakAll, lang) + (f.weak.x4.length ? ' (×4 contra ' + list(f.weak.x4, lang) + ')' : '') + '.' + (f.weak.none.length ? ' Los ataques de tipo ' + list(f.weak.none, lang) + ' no le afectan.' : '')
      : f.name + ' no tiene ninguna debilidad.'],
    ['¿De qué generación es ' + f.name + '?', f.name + ' es de la ' + ordinal(f.gen, lang) + ' generación' + (f.region ? ' (región de ' + f.region + ')' : '') + '. Primeros juegos: ' + f.firstGames + ' (' + f.year + ').'],
    ['¿Cuánto mide y pesa ' + f.name + '?', f.name + ' mide ' + num(f.height, lang) + ' m y pesa ' + num(f.weight, lang) + ' kg.'],
  ];
}

function dailyClues(f, lang) {
  const L = lang === 'en'
    ? ['Generation', 'Type 1', 'Type 2', 'Habitat', 'Color', 'Stage', 'Height', 'Weight', 'None']
    : ['Generación', 'Tipo 1', 'Tipo 2', 'Hábitat', 'Color', 'Etapa', 'Altura', 'Peso', 'Ninguno'];
  return [[L[0], 'Gen ' + f.gen + ' (' + f.generationRegion + ')'], [L[1], f.types[0]], [L[2], f.types[1] || L[8]], [L[3], f.habitat || '—'],
    [L[4], f.color || '—'], [L[5], f.stage || '—'], [L[6], num(f.height, lang) + ' m'], [L[7], num(f.weight, lang) + ' kg']];
}

// The words of the page around the facts.
const UI = {
  en: {
    locale: 'en_GB', nav: ['Pokémon', 'Play'], footer: 'Pokédle is a free fan project, ad-free, not affiliated with Nintendo, Game Freak or The Pokémon Company. Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.',
    footerLinks: ['Home', 'All 1025 Pokémon', 'Version française'], support: '☕ Support Pokédle',
    kicker: (f) => 'Pokémon No. ' + f.id + ' · Generation ' + f.gen, tags: ['Legendary', 'Mythical', 'Starter Pokémon'],
    play: '▶ Guess the Pokémon of the day', dex: 'Its Pokédex entry', free: 'Free, no ads, no sign-up.', art: ', official artwork',
    sheet: (n) => n + ' at a glance', facts: ['Number', 'Generation', 'Height', 'Weight', 'Color', 'Habitat', 'Stage', 'First games'], no: 'No. ',
    weakTitle: (n) => n + ' weaknesses and resistances', weakLead: (n, t) => 'What moves of each type do to ' + n + ' (' + t + '), based on the type chart.',
    weakRows: ['Very weak (4×)', 'Weak (2×)', 'Resists (½×)', 'Resists well (¼×)', 'Immune (0×)'], stats: 'Base stats', total: 'Total',
    guessTitle: 'Guess it in Pokédle', guessLead: (n) => 'In the Pokémon of the day, each guess compares these clues with the mystery Pokémon. If ' + n + ' is the answer, here is what you need to find:',
    games: ['Pixelated Pokémon', 'Guess the Pokémon', 'Pokémon Cry'], faq: 'Frequently asked questions', sameType: (t) => 'More ' + t + ' type Pokémon', genLink: (g) => 'Generation ' + g + ' Pokémon',
    title: (f) => f.name + ' (No. ' + f.id + '): ' + f.types.join('/') + ' type, weaknesses, height and weight · Pokédle',
    description: (f, w) => f.name + ', Pokémon No. ' + f.id + ', ' + f.types.join('/') + ' type (Generation ' + f.gen + (f.region ? ', ' + f.region : '') + ').' + (w.length ? ' Weak to ' + w.join(', ') + '.' : '') + ' Height, weight, stats and clues to guess it.',
    pageName: (n) => n + ': types, weaknesses, height and weight',
    hubTitle: 'List of all 1025 Pokémon by generation: types and weaknesses · Pokédle', hubH1: 'All 1025 Pokémon',
    hubLead: 'Every Pokémon, generation by generation, each with its types, weaknesses, height, weight, stats and the clues to guess it in the Pokémon of the day.',
    hubDescription: 'The list of all 1025 Pokémon from Generation 1 to 9, with a page for each: types, weaknesses and resistances, height, weight, stats and Pokémon of the day clues.',
    hubGen: (g, r, n) => 'Generation ' + g + ' · ' + r + ' · ' + n + ' Pokémon',
  },
  es: {
    locale: 'es_ES', nav: ['Pokémon', 'Jugar'], footer: 'Pokédle es un proyecto fan gratuito, sin anuncios, sin relación con Nintendo, Game Freak ni The Pokémon Company. Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.',
    footerLinks: ['Inicio', 'Los 1025 Pokémon', 'Version française'], support: '☕ Apoyar Pokédle',
    kicker: (f) => 'Pokémon n.º ' + f.id + ' · ' + ordinal(f.gen, 'es') + ' generación', tags: ['Legendario', 'Singular', 'Pokémon inicial'],
    play: '▶ Adivinar el Pokémon del día', dex: 'Su ficha en la Pokédex', free: 'Gratis, sin anuncios, sin registro.', art: ', ilustración oficial',
    sheet: (n) => 'Ficha de ' + n, facts: ['Número', 'Generación', 'Altura', 'Peso', 'Color', 'Hábitat', 'Etapa', 'Primeros juegos'], no: 'n.º ',
    weakTitle: (n) => 'Debilidades y resistencias de ' + n, weakLead: (n, t) => 'Lo que hacen a ' + n + ' (' + t + ') los ataques de cada tipo, según la tabla de tipos.',
    weakRows: ['Muy débil (×4)', 'Débil (×2)', 'Resiste (×½)', 'Resiste mucho (×¼)', 'Inmune (×0)'], stats: 'Estadísticas base', total: 'Total',
    guessTitle: 'Adivínalo en Pokédle', guessLead: (n) => 'En el Pokémon del día, cada intento compara estas pistas con las del Pokémon misterioso. Si ' + n + ' es la respuesta, esto es lo que hay que encontrar:',
    games: ['Pokémon pixelado', 'Adivina el Pokémon', 'Grito Pokémon'], faq: 'Preguntas frecuentes', sameType: (t) => 'Otros Pokémon de tipo ' + t, genLink: (g) => 'Pokémon de la ' + ordinal(g, 'es') + ' generación',
    title: (f) => f.name + ' (n.º ' + f.id + '): tipo ' + f.types.join('/') + ', debilidades, altura y peso · Pokédle',
    description: (f, w) => f.name + ', Pokémon n.º ' + f.id + ' de tipo ' + list(f.types, 'es') + ' (' + ordinal(f.gen, 'es') + ' generación' + (f.region ? ', ' + f.region : '') + ').' + (w.length ? ' Débil contra ' + w.join(', ') + '.' : '') + ' Altura, peso, estadísticas y pistas para adivinarlo.',
    pageName: (n) => n + ': tipos, debilidades, altura y peso',
    hubTitle: 'Lista de los 1025 Pokémon por generación: tipos y debilidades · Pokédle', hubH1: 'Los 1025 Pokémon',
    hubLead: 'Todos los Pokémon, generación por generación, cada uno con sus tipos, debilidades, altura, peso, estadísticas y las pistas para adivinarlo en el Pokémon del día.',
    hubDescription: 'La lista de los 1025 Pokémon de la 1.ª a la 9.ª generación, con una ficha para cada uno: tipos, debilidades y resistencias, altura, peso, estadísticas y pistas del Pokémon del día.',
    hubGen: (g, r, n) => ordinal(g, 'es') + ' generación · ' + r + ' · ' + n + ' Pokémon',
  },
};

module.exports = { LANGS, UI, TYPES, type, SLUGS, BY_SLUG, nameOf, pokemonPath, alternates, facts, intro, faq, dailyClues, region, num };
