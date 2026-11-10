// Génère pub/q6-content.json : les 33 quiz courts (ni intrus ni évolutions, à la demande de Kayan) du 12 au 22/11/2026 (« node pub/q6-gen.js »).
// Les réponses sont calculées avec les vraies données (assets/q5data.json, tiré de App/pokemon.js et
// App/base-stats.json) ; seules les évolutions sont écrites à la main. Tirages à graine fixe.
const fs = require('fs');
const D = require('../assets/q5data.json'); // id: [nom, types, poids, taille, gen, stats]
const ID = Object.fromEntries(Object.entries(D).map(([k, v]) => [v[0], +k]));
const id = (name) => { if (!(name in ID)) throw new Error('nom inconnu ' + name); return ID[name]; };
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tot = (i) => D[i][5].reduce((a, b) => a + b, 0);
const STATS = ['PV', 'Attaque', 'Défense', 'Atq. Spé.', 'Déf. Spé.', 'Vitesse'];
const TYPES = ['Normal', 'Feu', 'Eau', 'Plante', 'Électrik', 'Glace', 'Combat', 'Poison', 'Sol', 'Vol', 'Psy', 'Insecte', 'Roche', 'Spectre', 'Dragon', 'Ténèbres', 'Acier', 'Fée'];
const used = new Set();

// Pools : Pokémon connus (pas de légendaires) et légendaires / fabuleux.
const POOL = [3, 6, 9, 25, 26, 31, 34, 38, 59, 62, 65, 68, 76, 94, 121, 130, 131, 134, 135, 136, 143, 149, 154, 157, 160, 181, 186, 196, 197, 208, 212, 214, 229, 248, 254, 257, 260, 282, 306, 330, 334, 350, 359, 373, 376, 389, 392, 395, 445, 448, 460, 461, 462, 464, 466, 467, 468, 470, 471, 472, 473, 475, 478, 497, 500, 503, 530, 553, 571, 609, 612, 635, 637, 658, 700, 706, 724, 727, 730, 745, 778, 784, 812, 815, 818, 823, 887, 908, 911, 914];
const LEG = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 480, 481, 482, 483, 484, 485, 486, 487, 488, 491, 638, 639, 640, 641, 642, 643, 644, 645, 646, 716, 717, 718, 785, 786, 787, 788, 791, 792, 800, 888, 889, 890, 891, 892, 894, 895, 896, 897, 898, 1001, 1002, 1003, 1004, 1007, 1008];

// 4 Pokémon proches sur une stat, un seul meilleur (ou pire).
function grid(pool, s, dir, spread) {
  const val = (i) => (s === 't' ? tot(i) : D[i][5][s]);
  for (let tries = 0; tries < 20000; tries++) {
    const free = pool.filter((i) => tries > 10000 || !used.has(i)), c0 = shuffle(free)[0];
    const near = shuffle(free.filter((i) => i !== c0 && Math.abs(val(i) - val(c0)) <= spread / 2));
    if (near.length < 3) continue;
    const c = shuffle([c0, ...near.slice(0, 3)]), v = c.map(val);
    const best = dir > 0 ? Math.max(...v) : Math.min(...v);
    if (v.filter((x) => x === best).length !== 1 || Math.max(...v) - Math.min(...v) > spread) continue;
    c.forEach((i) => used.add(i));
    return { o: c, s, dir, a: v.indexOf(best), h: (dir > 0 ? 'Le plus de ' : 'Le moins de ') + (s === 't' ? 'stats au total' : STATS[s]) };
  }
  throw new Error('grille introuvable ' + s);
}
// Chaîne de 6 : écarts de 1 à 15, sans égalité.
function chain(s) {
  for (let tries = 0; tries < 200000; tries++) {
    const c = [shuffle(POOL)[0]];
    const val = (i) => (s === 't' ? tot(i) : D[i][5][s]);
    while (c.length < 6) {
      const nx = shuffle(POOL.filter((i) => !c.includes(i) && Math.abs(val(i) - val(c[c.length - 1])) <= 15 && val(i) !== val(c[c.length - 1])))[0];
      if (!nx) break; c.push(nx);
    }
    if (c.length < 6) continue;
    c.forEach((i) => used.add(i));
    return c;
  }
  throw new Error('chaîne introuvable');
}
// Paires pièges : celui qui a l'air plus gros est plus léger (poids), etc.
function pairs(kind, n) {
  const out = [];
  for (let tries = 0; out.length < n && tries < 200000; tries++) {
    const [a, b] = shuffle(POOL.concat(LEG).filter((i) => tries > 2000 || !used.has(i))).slice(0, 2); if (b === undefined) continue;
    if (kind === 'lourd') { const [wa, wb, ha, hb] = [D[a][2], D[b][2], D[a][3], D[b][3]]; if (wa === wb || (wa > wb) === (ha > hb) || Math.abs(wa - wb) / Math.max(wa, wb) > 0.6) continue; }
    if (kind === 'grand') { const [wa, wb, ha, hb] = [D[a][2], D[b][2], D[a][3], D[b][3]]; if (ha === hb || (ha > hb) === (wa > wb) || Math.abs(ha - hb) / Math.max(ha, hb) > 0.4) continue; }
    if (kind === 'premier') { const g = Math.abs(a - b); if (g < 3 || g > 40 || D[a][4] === D[b][4]) continue; }
    used.add(a); used.add(b); out.push([a, b]);
  }
  return out.map(([a, b]) => {
    const v = (i) => (kind === 'lourd' ? D[i][2] : kind === 'grand' ? D[i][3] : -i);
    return { o: [a, b], a: v(a) > v(b) ? 0 : 1 };
  });
}
// Quel est son type : la vraie paire + 3 leurres plausibles.
function typeQ(name) {
  const i = id(name), t = D[i][1], opts = [t];
  const other = () => shuffle(TYPES.filter((x) => !t.includes(x)))[0];
  const cand = [[t[0]], t[1] ? [t[1]] : [t[0], other()], [t[0], other()], [t[1] || other(), other()], [other(), t[1] || t[0]]];
  for (const c of shuffle(cand)) { if (opts.length === 4) break; if (!opts.some((o) => o.join() === c.join())) opts.push(c); }
  const o = shuffle(opts); return { id: i, o, a: o.findIndex((x) => x.join() === t.join()) };
}
// Image floue / zoom / silhouette : 4 noms, la réponse en premier dans la liste écrite.
function nameQ(list) { const ids = list.map(id), o = shuffle(ids); return { id: ids[0], o, a: o.indexOf(ids[0]), f: [0.35 + rnd() * 0.3, 0.3 + rnd() * 0.3] }; }
function vfQ(name, kind, val) {
  const i = id(name), d = D[i];
  const ok = kind === 'type' ? d[1].includes(val) : kind === 'lourd' ? d[2] > val : d[4] === val;
  const txt = kind === 'type' ? name + ' est de type ' + val : kind === 'lourd' ? name + ' pèse plus de ' + val + ' kg' : name + ' vient de la Gen ' + val;
  return { id: i, txt, a: ok ? 0 : 1 };
}

const V = {};
const N = (k) => k; // lisibilité
V.zoom1 = { mode: 'zoom', qs: [['Amphinobi', 'Croâporal', 'Lucario', 'Zoroark'], ['Noctali', 'Mentali', 'Nymphali', 'Givrali'], ['Lugulabre', 'Ectoplasma', 'Mélancolux', 'Funécire'], ['Archéduc', 'Brindibou', 'Efflèche', 'Noarfang'], ['Miraidon', 'Koraidon', 'Zekrom', 'Électhor']].map(nameQ) };
V.zoom2 = { mode: 'zoom', qs: [['Dracaufeu', 'Reptincel', 'Dracolosse', 'Ptéra'], ['Gardevoir', 'Gallame', 'Kirlia', 'Mélodelfe'], ['Carchacrok', 'Carmache', 'Drattak', 'Libégon'], ['Togekiss', 'Togetic', 'Altaria', 'Lugia'], ['Darkrai', 'Spectrum', 'Branette', 'Lugulabre']].map(nameQ) };
V.zoom3 = { mode: 'zoom', qs: [['Absol', 'Zoroark', 'Feunard', 'Noctali'], ['Galvagon', 'Raichu', 'Voltali', 'Électrode'], ['Noadkoko', 'Simularbre', 'Florizarre', 'Phyllali'], ['Scarhino', 'Cizayox', 'Insécateur', 'Rhinastoc'], ['Kyogre', 'Groudon', 'Wailord', 'Lokhlass']].map(nameQ) };
V.zoom4 = { mode: 'zoom', qs: [['Mewtwo', 'Mew', 'Deoxys', 'Gallame'], ['Lokhlass', 'Léviator', 'Aquali', 'Wailord'], ['Libégon', 'Vibraninf', 'Carchacrok', 'Altaria'], ['Arcanin', 'Caninos', 'Feunard', 'Pyroli'], ['Necrozma', 'Lunala', 'Solgaleo', 'Deoxys']].map(nameQ) };
V.zoom5 = { mode: 'zoom', qs: [['Ronflex', 'Goinfrex', 'Ursaring', 'Wailord'], ['Mentali', 'Nymphali', 'Noctali', 'Mew'], ['Tyranocif', 'Ymphect', 'Rhinastoc', 'Groudon'], ['Typhlosion', 'Dracaufeu', 'Arcanin', 'Feunard'], ['Rayquaza', 'Léviator', 'Dracolosse', 'Kyurem']].map(nameQ) };
V.pixel1 = { mode: 'pixel', qs: [['Dracolosse', 'Draco', 'Dracaufeu', 'Altaria'], ['Mimiqui', 'Pikachu', 'Togedemaru', 'Raichu'], ['Ronflex', 'Goinfrex', 'Ursaring', 'Wailord'], ['Lucario', 'Riolu', 'Zoroark', 'Amphinobi'], ['Celebi', 'Mew', 'Jirachi', 'Phyllali']].map(nameQ) };
V.pixel2 = { mode: 'pixel', qs: [['Ectoplasma', 'Spectrum', 'Branette', 'Noctali'], ['Cizayox', 'Insécateur', 'Scarhino', 'Hachécateur'], ['Nymphali', 'Mentali', 'Mélofée', 'Togekiss'], ['Tyranocif', 'Rhinastoc', 'Ossatueur', 'Groudon'], ['Archéduc', 'Noarfang', 'Efflèche', 'Ptéra']].map(nameQ) };
V.pixel3 = { mode: 'pixel', qs: [['Amphinobi', 'Lucario', 'Zoroark', 'Noctali'], ['Métalosse', 'Steelix', 'Galeking', 'Cizayox'], ['Gallame', 'Gardevoir', 'Lucario', 'Mentali'], ['Ékaïser', 'Carchacrok', 'Drattak', 'Muplodocus'], ['Lanssorien', 'Trioxhydre', 'Drattak', 'Ékaïser']].map(nameQ) };
V.pixel4 = { mode: 'pixel', qs: [['Léviator', 'Magicarpe', 'Dracolosse', 'Lokhlass'], ['Feunard', 'Goupix', 'Arcanin', 'Pyroli'], ['Galeking', 'Steelix', 'Rhinastoc', 'Métalosse'], ['Togekiss', 'Togetic', 'Altaria', 'Artikodin'], ['Ho-Oh', 'Sulfura', 'Lugia', 'Dracaufeu']].map(nameQ) };
V.silh1 = { mode: 'silh', qs: [['Lugia', 'Ho-Oh', 'Artikodin', 'Rayquaza'], ['Florizarre', 'Noadkoko', 'Phyllali', 'Herbizarre'], ['Ossatueur', 'Osselait', 'Kangourex', 'Ronflex'], ['Tarinorme', 'Galeking', 'Steelix', 'Simularbre'], ['Zoroark', 'Absol', 'Lucario', 'Feunard']].map(nameQ) };
V.silh2 = { mode: 'silh', qs: [['Arcanin', 'Feunard', 'Caninos', 'Pyroli'], ['Gardevoir', 'Gallame', 'Kirlia', 'Mentali'], ['Léviator', 'Dracolosse', 'Rayquaza', 'Lokhlass'], ['Togedemaru', 'Pikachu', 'Raichu', 'Pichu'], ['Cresselia', 'Darkrai', 'Lunala', 'Mew']].map(nameQ) };
V.silh3 = { mode: 'silh', qs: [['Dracaufeu', 'Dracolosse', 'Drattak', 'Carchacrok'], ['Lucario', 'Riolu', 'Zoroark', 'Amphinobi'], ['Wailord', 'Lokhlass', 'Kyogre', 'Léviator'], ['Noctali', 'Mentali', 'Nymphali', 'Absol'], ['Solgaleo', 'Lunala', 'Arcanin', 'Necrozma']].map(nameQ) };
V.type2 = { mode: 'type', qs: ['Ékaïser', 'Corvaillus', 'Pyrobut', 'Miascarade', 'Palmaval'].map(typeQ) };
V.type3 = { mode: 'type', qs: ['Lanssorien', 'Scalproie', 'Trioxhydre', 'Togekiss', 'Archéduc'].map(typeQ) };
V.type4 = { mode: 'type', qs: ['Ptéra', 'Steelix', 'Crustabri', 'Altaria', 'Lugia'].map(typeQ) };
V.pixel5 = { mode: 'pixel', qs: [['Scarhino', 'Cizayox', 'Rhinastoc', 'Insécateur'], ['Mélodelfe', 'Mélofée', 'Rondoudou', 'Leveinard'], ['Typhlosion', 'Feunard', 'Dracaufeu', 'Arcanin'], ['Kyurem', 'Artikodin', 'Givrali', 'Lokhlass'], ['Deoxys', 'Mewtwo', 'Mew', 'Jirachi']].map(nameQ) };
V.vf1 = { mode: 'vf', qs: [vfQ('Dracaufeu', 'type', 'Dragon'), vfQ('Ronflex', 'lourd', 400), vfQ('Mimiqui', 'type', 'Fée'), vfQ('Lucario', 'gen', 3), vfQ('Ectoplasma', 'type', 'Poison')] };
V.vf2 = { mode: 'vf', qs: [vfQ('Léviator', 'type', 'Dragon'), vfQ('Gardevoir', 'type', 'Fée'), vfQ('Wailord', 'lourd', 500), vfQ('Togekiss', 'gen', 2), vfQ('Carchacrok', 'type', 'Sol')] };
// Avant les tirages, on réserve les Pokémon déjà utilisés ci-dessus pour varier.
for (const k in V) for (const q of V[k].qs) [q.id, ...(q.o || []).filter((x) => typeof x === 'number')].forEach((i) => i && used.add(i));
V.plus1 = { mode: 'grid', qs: [5, 5, 5, 5, 5].map((s) => grid(POOL, s, 1, 25)), title: 'QUI EST LE<br>PLUS RAPIDE ?' };
V.plus2 = { mode: 'grid', qs: [4, 2, 3, 1, 0].map((s) => grid(POOL, s, 1, 25)), title: 'QUI A LE<br>PLUS DE… ?' };
V.plus3 = { mode: 'grid', qs: [0, 1, 2, 3, 4].map((s) => grid(POOL, s, 1, 25)), title: 'QUI A LE<br>PLUS DE… ?' };
V.moins1 = { mode: 'grid', qs: [5, 1, 3, 2, 0].map((s) => grid(POOL, s, -1, 25)), title: 'QUI A LE<br>MOINS DE… ?' };
V.moins2 = { mode: 'grid', qs: [2, 0, 4, 5, 1].map((s) => grid(POOL, s, -1, 25)), title: 'QUI A LE<br>MOINS DE… ?' };
V.legend1 = { mode: 'grid', legend: true, qs: [3, 1, 5, 't', 0].map((s) => grid(LEG, s, 1, 25)), title: 'LÉGENDAIRES :<br>QUI A LE PLUS ?' };
V.legend2 = { mode: 'grid', legend: true, qs: [5, 2, 4, 1, 3].map((s) => grid(LEG, s, 1, 25)), title: 'LÉGENDAIRES :<br>QUI A LE PLUS ?' };
V.pom2 = { mode: 'pom', s: 1, chain: chain(1) };
V.pom3 = { mode: 'pom', s: 5, chain: chain(5) };
V.pom4 = { mode: 'pom', s: 't', chain: chain('t') };
V.premier1 = { mode: 'pair', kind: 'premier', qs: pairs('premier', 5) };
V.premier2 = { mode: 'pair', kind: 'premier', qs: pairs('premier', 5) };
V.grand1 = { mode: 'pair', kind: 'grand', qs: pairs('grand', 5) };
V.grand2 = { mode: 'pair', kind: 'grand', qs: pairs('grand', 5) };
V.lourd2 = { mode: 'lourd', qs: pairs('lourd', 5) };

// zoom5 avait 4 fois « D » : on décale les réponses.
const rot = (q, n) => { for (let k = 0; k < n; k++) q.o.push(q.o.shift()); q.a = q.o.indexOf(q.id); };
rot(V.zoom5.qs[0], 2); rot(V.zoom5.qs[1], 3); rot(V.zoom5.qs[3], 1);
// Les 3 du 11/11 refaites avec la nouvelle fin (mêmes questions, mêmes réponses).
V.type1 = { mode: 'type', qs: [[184, [['Eau'], ['Eau', 'Fée'], ['Eau', 'Normal'], ['Fée']]], [131, [['Eau', 'Psy'], ['Glace'], ['Eau', 'Dragon'], ['Eau', 'Glace']]], [464, [['Sol', 'Roche'], ['Roche', 'Acier'], ['Sol'], ['Roche']]], [777, [['Électrik'], ['Électrik', 'Fée'], ['Acier', 'Normal'], ['Électrik', 'Acier']]], [778, [['Spectre', 'Ténèbres'], ['Spectre', 'Fée'], ['Fée'], ['Spectre', 'Normal']]]].map(([i, o]) => ({ id: i, o, a: o.findIndex((x) => x.join() === D[i][1].join()) })) };
V.pom1 = { mode: 'pom', s: 't', chain: [448, 282, 609, 553, 658, 196] };
V.lourd1 = { mode: 'lourd', qs: [[376, 321], [292, 291], [790, 383], [208, 143], [384, 149]].map(([a, b]) => ({ o: [a, b], a: D[a][2] > D[b][2] ? 0 : 1 })) };
fs.writeFileSync(__dirname + '/q6-content.json', JSON.stringify(V));
// Résumé lisible pour vérifier les réponses.
const nm = (i) => D[i][0];
for (const [k, v] of Object.entries(V)) {
  const ans = v.qs ? v.qs.map((q) => 'ABCD'[q.a] + ' ' + (q.o ? (typeof q.o[0] === 'number' ? q.o.map(nm).join('/') : q.o.map((o) => o.join('+')).join(' | ')) : nm(q.id) + ' « ' + q.txt + ' »') + (q.h ? ' [' + q.h + ']' : '') + (q.id && q.o ? ' → ' + nm(q.id) : ''))
    : v.chain.map((i) => nm(i) + ' ' + (v.s === 't' ? tot(i) : D[i][5][v.s]));
  console.log('\n' + k + ' (' + v.mode + (v.kind ? ' ' + v.kind : '') + ')\n  ' + ans.join('\n  '));
}
