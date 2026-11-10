// Zoom v2 (10/11/2026, après l'avis de Kayan : « Pokémon évidents, on voit la couleur ») : à lancer APRÈS
// q6-gen.js, remplace zoom1 à zoom5 dans q6-content.json sans toucher aux autres vidéos.
// 4 réponses de la même couleur, chaque groupe sert deux fois avec une réponse différente. L'image reste en
// noir et blanc jusqu'à la réponse et le point zoomé est choisi par q6.js dans une zone pleine du dessin.
const fs = require('fs');
const D = require('../assets/q5data.json');
const ID = Object.fromEntries(Object.entries(D).map(([k, v]) => [v[0], +k]));
const id = (n) => { if (!(n in ID)) throw new Error('nom inconnu ' + n); return ID[n]; };
let seed = 41; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const G = {
  acier: ['Galeking', 'Steelix', 'Métalosse', 'Airmure'], rose: ['Leuphorie', 'Mélodelfe', 'Rondoudou', 'Grodoudou'],
  violet: ['Ectoplasma', 'Spectrum', 'Nidoking', 'Smogogo'], bleu: ['Lokhlass', 'Aquali', 'Wailord', 'Lanturn'],
  vert: ['Noadkoko', 'Florizarre', 'Jungko', 'Méganium'], noir: ['Noctali', 'Darkrai', 'Démolosse', 'Mysdibule'],
  brun: ['Ursaring', 'Kangourex', 'Ossatueur', 'Noarfang'], blanc: ['Togekiss', 'Altaria', 'Lugia', 'Absol'],
  bleunoir: ['Lucario', 'Amphinobi', 'Zoroark', 'Riolu'], jaune: ['Élekable', 'Voltali', 'Raichu', 'Pharamp'],
  rouge: ['Cizayox', 'Magmar', 'Scarabrute', 'Pyroli'], orange: ['Dracolosse', 'Arcanin', 'Typhlosion', 'Pyroli'],
  roche: ['Tarinorme', 'Kranidos', 'Simularbre', 'Mammochon']
};
const Z = {
  zoom1: [['acier', 'Métalosse'], ['rose', 'Leuphorie'], ['noir', 'Mysdibule'], ['bleunoir', 'Riolu'], ['blanc', 'Lugia']],
  zoom2: [['bleu', 'Lanturn'], ['rouge', 'Scarabrute'], ['roche', 'Simularbre'], ['brun', 'Kangourex'], ['violet', 'Smogogo']],
  zoom3: [['vert', 'Méganium'], ['jaune', 'Pharamp'], ['orange', 'Typhlosion'], ['acier', 'Airmure'], ['noir', 'Darkrai']],
  zoom4: [['rose', 'Mélodelfe'], ['bleunoir', 'Zoroark'], ['bleu', 'Aquali'], ['rouge', 'Magmar'], ['roche', 'Mammochon']],
  zoom5: [['violet', 'Nidoking'], ['brun', 'Ursaring'], ['blanc', 'Altaria'], ['orange', 'Arcanin'], ['jaune', 'Élekable']]
};
const C = JSON.parse(fs.readFileSync(__dirname + '/q6-content.json', 'utf8'));
for (const [k, qs] of Object.entries(Z)) {
  C[k] = { mode: 'zoom', gray: true, qs: qs.map(([g, ans], j) => {
    let o; do { o = shuffle(G[g].map(id)); } while (o.indexOf(id(ans)) === j % 4 && rnd() < 0.5);
    return { id: id(ans), o, a: o.indexOf(id(ans)), seed: Math.floor(rnd() * 1000) };
  }) };
  console.log(k, C[k].qs.map((q) => 'ABCD'[q.a] + ' ' + D[q.id][0]).join(' · '));
}
fs.writeFileSync(__dirname + '/q6-content.json', JSON.stringify(C));
