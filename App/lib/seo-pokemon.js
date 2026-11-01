'use strict';
// Une page Google par Pokémon (01/11/2026, idée tirée de l'étude HoloPocket : 23 700 pages, une par
// carte). /pokemon/<nom> : types, génération, taille, poids, faiblesses et résistances calculées
// avec la table des types des guides, stats de base, les indices du Pokémon du jour pour le deviner,
// et des liens vers les jeux. Tout vient des données du site : rien n'est inventé.
const fs = require('fs');
const path = require('path');
const { TYPE_CHART, GENERATIONS, STARTERS, LEGENDARIES, MYTHICALS } = require('./seo-guides');

const POKEMON_LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
const BASE = POKEMON_LIST.filter((p) => !p.isAltForm && p.id >= 1 && p.id <= 1025).sort((a, b) => a.id - b.id);
const STATS = require('../base-stats.json');
const STAT_LABELS = ['PV', 'Attaque', 'Défense', 'Attaque Spé.', 'Défense Spé.', 'Vitesse'];

function slugify(name) {
  return String(name).replace(/♀/g, ' f').replace(/♂/g, ' m').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// One slug per Pokémon; a clash (none today) would take its number.
const SLUGS = new Map();
const BY_SLUG = new Map();
for (const p of BASE) {
  let slug = slugify(p.name) || String(p.id);
  if (BY_SLUG.has(slug)) slug += '-' + p.id;
  SLUGS.set(p.id, slug);
  BY_SLUG.set(slug, p);
}
const pokemonPath = (id) => '/pokemon/' + SLUGS.get(Number(id));

const STARTER_IDS = new Set(STARTERS.flat());
const LEGENDARY_IDS = new Set(Object.values(LEGENDARIES).flat());
const MYTHICAL_IDS = new Set(MYTHICALS);

// How much each attacking type hurts this Pokémon (both of its types multiply).
function weaknesses(p) {
  const types = [p.type1, p.type2].filter(Boolean);
  const out = { x4: [], x2: [], half: [], quarter: [], none: [] };
  for (const [attack, row] of Object.entries(TYPE_CHART)) {
    let m = 1;
    for (const t of types) m *= row.no.includes(t) ? 0 : row.super.includes(t) ? 2 : row.not.includes(t) ? 0.5 : 1;
    if (m === 0) out.none.push(attack);
    else if (m === 4) out.x4.push(attack);
    else if (m === 2) out.x2.push(attack);
    else if (m === 0.5) out.half.push(attack);
    else if (m === 0.25) out.quarter.push(attack);
  }
  return out;
}

const STAGE_LABELS = { 1: 'Forme de base', 2: 'Première évolution', 3: 'Deuxième évolution' };
const fr = (n, digits = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: digits });
const listFr = (items) => items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1];

function facts(p) {
  const gen = GENERATIONS[p.gen - 1] || { region: '', games: '', year: '' };
  const stats = Array.isArray(STATS[String(p.id)]) ? STATS[String(p.id)] : null;
  const w = weaknesses(p);
  const types = [p.type1, p.type2].filter(Boolean);
  return {
    id: p.id, name: p.name, slug: SLUGS.get(p.id), path: pokemonPath(p.id), types,
    gen: p.gen, region: gen.region, firstGames: gen.games, year: gen.year,
    height: p.height, weight: p.weight, color: p.color, habitat: p.habitat,
    stage: STAGE_LABELS[p.stage] || null,
    starter: STARTER_IDS.has(p.id), legendary: LEGENDARY_IDS.has(p.id), mythical: MYTHICAL_IDS.has(p.id),
    stats: stats ? STAT_LABELS.map((label, i) => ({ label, value: Number(stats[i]) || 0 })) : null,
    total: stats ? stats.reduce((sum, v) => sum + (Number(v) || 0), 0) : null,
    weak: w,
    prev: BASE[BASE.indexOf(p) - 1] || null,
    next: BASE[BASE.indexOf(p) + 1] || null,
    sameType: BASE.filter((o) => o.id !== p.id && (o.type1 === p.type1 || o.type2 === p.type1)).sort((a, b) => Math.abs(a.id - p.id) - Math.abs(b.id - p.id)).slice(0, 8).sort((a, b) => a.id - b.id),
  };
}

// The page's own sentences, built from its facts (the same sentence for every Pokémon would be thin).
function intro(f) {
  const kind = f.mythical ? 'un Pokémon fabuleux' : f.legendary ? 'un Pokémon légendaire' : f.starter ? 'un Pokémon de départ' : 'un Pokémon';
  const typeText = f.types.length > 1 ? 'de type ' + f.types.join(' et ') : 'de type ' + f.types[0];
  return f.name + ' est ' + kind + ' ' + typeText + ' de la ' + f.gen + (f.gen === 1 ? 're' : 'e') + ' génération (région de ' + f.region + '), n° ' + f.id + ' du Pokédex national. ' +
    'Il mesure ' + fr(f.height) + ' m pour ' + fr(f.weight) + ' kg.' +
    (f.weak.x4.length ? ' Il craint surtout les attaques ' + listFr(f.weak.x4) + ' (dégâts ×4).' : f.weak.x2.length ? ' Il est faible face aux attaques ' + listFr(f.weak.x2) + '.' : ' Il n’a aucune faiblesse de type.');
}
function faq(f) {
  const weakAll = f.weak.x4.concat(f.weak.x2);
  return [
    ['Quel est le type de ' + f.name + ' ?', f.name + ' est de type ' + f.types.join(' et ') + '.'],
    ['Quelles sont les faiblesses de ' + f.name + ' ?', weakAll.length
      ? f.name + ' est faible face aux attaques ' + listFr(weakAll) + (f.weak.x4.length ? ' (×4 contre ' + listFr(f.weak.x4) + ')' : '') + '.' + (f.weak.none.length ? ' Les attaques ' + listFr(f.weak.none) + ' ne lui font rien.' : '')
      : f.name + ' n’a aucune faiblesse.'],
    ['De quelle génération est ' + f.name + ' ?', f.name + ' vient de la ' + f.gen + (f.gen === 1 ? 're' : 'e') + ' génération (région de ' + f.region + ', ' + f.firstGames + ', ' + f.year + ').'],
    ['Combien mesure et pèse ' + f.name + ' ?', f.name + ' mesure ' + fr(f.height) + ' m et pèse ' + fr(f.weight) + ' kg.'],
  ];
}
// The clues of the Pokémon du jour (lib/daily-comparison.js compares exactly these).
function dailyClues(f) {
  return [
    ['Génération', 'Gen ' + f.gen + ' (' + f.region + ')'],
    ['Type 1', f.types[0]],
    ['Type 2', f.types[1] || 'Aucun'],
    ['Habitat', f.habitat || '—'],
    ['Couleur', f.color || '—'],
    ['Stade', f.stage || '—'],
    ['Taille', fr(f.height) + ' m'],
    ['Poids', fr(f.weight) + ' kg'],
  ];
}

module.exports = { BASE, SLUGS, BY_SLUG, pokemonPath, slugify, weaknesses, facts, intro, faq, dailyClues, STAT_LABELS };
