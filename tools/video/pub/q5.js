// Quiz courts « plus durs » du 11/11/2026, avec les fonds de la maquette (pub/fonds.html) :
//   type  « Quel est son type ? » : 4 paires de types, le fond prend les vrais types à la réponse ;
//   pom   « Plus ou moins ? » : total des stats en chaîne, écarts de 15 au plus ;
//   lourd « Qui est le plus lourd ? » : une balance qui penche à la réponse, poids en kg.
// 5 questions de 3 s, la 5e reste en mystère, fin sur le vrai jeu du site. Données vérifiées dans
// App/pokemon.js (types, poids) et App/base-stats.json (stats). Chaque image est une fonction pure de t.
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eInOut = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eBack = (k, s = 1.9) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2));

const TC = { Normal: '#A8A878', Feu: '#F08030', Eau: '#4F92D6', Plante: '#62B84A', 'Électrik': '#E8B820', Glace: '#6CC8C8', Combat: '#C03028',
  Poison: '#A040A0', Sol: '#D2A64A', Vol: '#9A82E8', Psy: '#F85888', Insecte: '#94A818', Roche: '#B8A038', Spectre: '#705898', Dragon: '#6A3AE8',
  'Ténèbres': '#705848', Acier: '#9A9AB8', 'Fée': '#E77FD9' };
// id: [nom, total des stats, poids kg, types]
const P = {
  184: ['Azumarill', 420, 28.5, ['Eau', 'Fée']], 131: ['Lokhlass', 535, 220, ['Eau', 'Glace']], 464: ['Rhinastoc', 535, 282.8, ['Sol', 'Roche']],
  777: ['Togedemaru', 435, 3.3, ['Électrik', 'Acier']], 778: ['Mimiqui', 476, 0.7, ['Spectre', 'Fée']],
  448: ['Lucario', 525], 282: ['Gardevoir', 518], 609: ['Lugulabre', 520], 553: ['Crocorible', 519], 658: ['Amphinobi', 530], 196: ['Mentali', 525],
  376: ['Métalosse', 0, 550], 321: ['Wailord', 0, 398], 790: ['Cosmovum', 0, 999.9], 383: ['Groudon', 0, 950], 292: ['Munja', 0, 1.2],
  291: ['Ninjask', 0, 12], 208: ['Steelix', 0, 400], 143: ['Ronflex', 0, 460], 384: ['Rayquaza', 0, 206.5], 149: ['Dracolosse', 0, 210]
};
const V = {
  type1: { mode: 'type', music: '03 - Route 101.mp3', qs: [
    { id: 184, o: [['Eau'], ['Eau', 'Fée'], ['Eau', 'Normal'], ['Fée']] },
    { id: 131, o: [['Eau', 'Psy'], ['Glace'], ['Eau', 'Dragon'], ['Eau', 'Glace']] },
    { id: 464, o: [['Sol', 'Roche'], ['Roche', 'Acier'], ['Sol'], ['Roche']] },
    { id: 777, o: [['Électrik'], ['Électrik', 'Fée'], ['Acier', 'Normal'], ['Électrik', 'Acier']] },
    { id: 778, o: [['Spectre', 'Ténèbres'], ['Spectre', 'Fée'], ['Fée'], ['Spectre', 'Normal']] }] },
  pom1: { mode: 'pom', chain: [448, 282, 609, 553, 658, 196] },
  lourd1: { mode: 'lourd', qs: [[376, 321], [292, 291], [790, 383], [208, 143], [384, 149]] }
};
const SHOT = { type: ['../assets/cap-combo.png', 'Combo de types'], pom: ['../assets/site-hl.png', 'Higher or Lower'], lourd: ['../assets/cap-poids.png', 'Duel de poids'] };

let MODE = 'type', Q = [], START = [];
const INTRO = 2.0, R = 5.4, T0 = 0.5, T1 = 3.5;
let CARD_M = 0, END = 0, TOTAL = 0;
var S = { audio: [], total: 0 };

function load(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }
const art = (id) => '../assets/art-' + id + '.png';
const fmtKg = (w) => String(w).replace('.', ',') + ' kg';
const chip = (t) => '<span style="background:' + TC[t] + '">' + t + '</span>';

async function setup(name) {
  const v = V[name]; MODE = v.mode;
  if (MODE === 'type') Q = v.qs.map((q) => ({ id: q.id, o: q.o, a: q.o.findIndex((o) => o.join() === P[q.id][3].join()) }));
  if (MODE === 'pom') Q = v.chain.slice(1).map((id, k) => ({ prev: v.chain[k], id, up: P[id][1] > P[v.chain[k]][1] }));
  if (MODE === 'lourd') Q = v.qs.map(([a, b]) => ({ ids: [a, b], a: P[a][2] > P[b][2] ? 0 : 1 }));
  for (const q of Q) if (q.a === -1) throw new Error('réponse introuvable ' + q.id);
  START = Q.map((_, k) => INTRO + k * R);
  CARD_M = START[Q.length - 1] + T1 + 0.1; END = CARD_M + 3.8; TOTAL = END + 4.6; S.total = TOTAL;
  const ids = new Set(); Q.forEach((q) => [q.id, q.prev, ...(q.ids || [])].forEach((i) => i && ids.add(i)));
  await Promise.all([...ids].map((i) => load(art(i))).concat([load(SHOT[MODE][0])]));
  await document.fonts.ready; await document.fonts.load('700 96px Fredoka', 'ÉÀ?');
  const A = S.audio, push = (file, t, vol, cry) => A.push({ file, t: +t.toFixed(3), vol, cry });
  push('assets/go-throw.mp3', 0.25, 0.7);
  Q.forEach((q, k) => {
    const s = START[k]; push('assets/sfx/timer3.wav', s + T0, 0.9);
    if (k === Q.length - 1) { push('assets/go-caught.mp3', s + T1 + 0.1, 0.9); return; }
    push('assets/go-appear.mp3', s + T1, 0.8);
    const cid = MODE === 'lourd' ? q.ids[q.a] : q.id; push('assets/cry-' + cid + '.ogg', s + T1 + 0.15, 1.3, true);
  });
  push('assets/go-land.mp3', END + 0.1, 0.8);
  $('bgPom').style.display = MODE === 'pom' ? 'block' : 'none';
  $('bgLourd').style.display = MODE === 'lourd' ? 'block' : 'none';
  $('bgType').style.display = MODE === 'type' ? 'block' : 'none';
  $('title').className = MODE === 'pom' ? 'pom' : '';
  renderAt(0);
  return TOTAL;
}

function html(id, h) { const e = $(id); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; } return e; }
function show(id, on, disp) { $(id).style.display = on ? (disp || 'block') : 'none'; }
function mix(a, b, k) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const x = p(a), y = p(b); return 'rgb(' + x.map((v, i) => Math.round(lerp(v, y[i], k))).join(',') + ')';
}

function renderAt(t) {
  const intro = t < INTRO, inEnd = t >= END, mCard = t >= CARD_M && t < END, game = !intro && !inEnd;
  let i = 0; for (let k = 0; k < START.length; k++) if (t >= START[k]) i = k;
  const q = Q[i], lt = t - START[i], last = i === Q.length - 1, rev = !last && lt >= T1;
  const enter = eBack(seg(lt, 0, 0.4));

  // Titre et accroche.
  const TT = { type: 'QUEL EST<br>SON TYPE ?', pom: 'PLUS OU MOINS ?', lourd: 'QUI EST LE<br>PLUS LOURD ?' };
  html('title', TT[MODE]);
  const tk = intro ? eBack(seg(t, 0.1, 0.5)) : 1; $('title').style.transform = 'scale(' + (0.4 + 0.6 * tk) + ')';
  show('title', !inEnd && !mCard);
  html('hook', '5 questions pièges<br>3 secondes chacune<br>Compte tes points !');
  show('hook', intro); $('hook').style.opacity = seg(t, 0.5, 0.8) * (1 - seg(t, INTRO - 0.25, INTRO));
  const SUB = { type: '', pom: 'Total des stats · ' + (i + 1) + '/5', lourd: 'Question ' + (i + 1) + '/5' };
  html('sub', SUB[MODE]); show('sub', game && !mCard && MODE !== 'type');
  if (MODE === 'pom') $('sub').style.top = '250px';

  // Chrono.
  const rest = 1 - seg(lt, T0, T1), col = rest > 0.66 ? '#6BE05A' : rest > 0.33 ? '#FFD45C' : '#FF5A48';
  $('fill').style.width = (lt < T0 ? 100 : rest * 100).toFixed(2) + '%'; $('fill').style.background = col;
  show('timer', game); html('qn', 'Question ' + (i + 1) + '/5'); show('qn', game && MODE === 'type');
  show('wm', !inEnd);

  // Fond « type » : neutre pendant la question, les vrais types à la réponse.
  if (MODE === 'type') {
    const ty = P[q.id][3], k = rev ? seg(lt, T1, T1 + 0.35) : 0;
    const c1 = mix('#E8E1F2', TC[ty[0]], k), c2 = mix('#D6CCE6', TC[ty[1] || ty[0]], k);
    $('bgType').querySelector('.a').style.background = 'linear-gradient(115deg,' + c1 + ' 0 49.8%,#fff 49.8% 50.6%,' + c2 + ' 50.6% 100%)';
    show('mon', game); $('mon').src = art(q.id);
    $('mon').style.transform = 'scale(' + (0.3 + 0.7 * enter) + ')';
    html('opts', q.o.map((o, j) => '<div class="' + (rev ? (j === q.a ? 'ok' : 'no') : '') + '">' + 'ABCD'[j] + ' ' + o.map(chip).join('') + '</div>').join(''));
    show('opts', game, 'grid');
  } else { show('mon', false); show('opts', false); }

  // Plus ou moins : la carte du bas monte en haut après la réponse.
  if (MODE === 'pom') {
    const sl = rev ? eInOut(seg(lt, R - 0.55, R - 0.05)) : 0, TOPY = 340, BOTY = 930;
    const setC = (el, id, y, val, q_, op) => {
      el.querySelector('img').src = art(id); el.querySelector('.n').textContent = P[id][0];
      const v = el.querySelector('.v'); v.textContent = val; v.className = 'v' + (q_ ? ' q' : '');
      el.style.top = y + 'px'; el.style.opacity = op; el.style.display = game ? 'block' : 'none';
    };
    const cnt = Math.round(lerp(P[q.prev][1] - 40, P[q.id][1], eOut(seg(lt, T1, T1 + 0.6))));
    setC($('cTop'), q.prev, lerp(TOPY, TOPY - 620, sl), P[q.prev][1], false, 1 - sl);
    setC($('cBot'), q.id, lerp(BOTY + (1 - enter) * 700, TOPY, sl), rev ? cnt : '?', !rev, 1);
    const bs = $('btns').children; bs[0].className = rev ? (q.up ? 'ok' : 'no') : ''; bs[1].className = rev ? (!q.up ? 'ok' : 'no') : '';
    show('btns', game, 'flex'); html('diff', 'écart de 15 au plus !'); show('diff', game && !rev); $('diff').style.top = (BOTY - 30) + 'px';
  } else { ['cTop', 'cBot', 'btns', 'diff'].forEach((id) => show(id, false)); }

  // Balance.
  if (MODE === 'lourd') {
    const sw = Math.sin(lt * 3) * 2.2 * (1 - seg(lt, T1, T1 + 0.2));
    const ang = rev ? (q.a === 1 ? 9 : -9) * eBack(seg(lt, T1, T1 + 0.5), 1.4) : sw;
    $('beam').setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' 540 190)');
    const r = ang * Math.PI / 180, ends = [[230, 190], [850, 190]].map(([x, y]) => [540 + (x - 540) * Math.cos(r) - (y - 190) * Math.sin(r), 190 + (x - 540) * Math.sin(r) + (y - 190) * Math.cos(r)]);
    ['panA', 'panB'].forEach((pid, j) => {
      const el = $(pid), id = q.ids[j], [x, y] = ends[j];
      el.style.left = (x - 220) + 'px'; el.style.top = (700 + y + 20) + 'px';
      el.querySelector('img').src = art(id); el.querySelector('img').style.transform = 'scale(' + (0.3 + 0.7 * enter) + ')';
      const kg = el.querySelector('.kg'); kg.textContent = P[id][0] + (rev ? ' · ' + fmtKg(P[id][2]) : ''); kg.className = 'kg' + (rev && j === q.a ? ' ok' : '');
      el.style.display = game ? 'block' : 'none';
    });
    show('scale', game);
  } else { ['panA', 'panB', 'scale'].forEach((id) => show(id, false)); }

  // Cartes : le mystère (compacte, en haut) puis la fin.
  const card = $('card'); let on = false, ck = 0;
  if (mCard) {
    on = true; ck = seg(t, CARD_M, CARD_M + 0.3); card.style.top = '70px'; card.style.padding = '34px 30px';
    html('card', '<div class="big" style="font-size:62px">TA RÉPONSE EN<br>COMMENTAIRE 👇</div><div class="sm" style="margin-top:14px">Et ton score sur 4 ? Réponse demain en épinglé</div>');
  } else if (inEnd) {
    on = true; ck = seg(t, END, END + 0.3); card.style.top = '110px'; card.style.padding = '50px 40px';
    html('card', '<div class="big">JOUE À LA<br>VERSION COMPLÈTE</div><div class="mid">' + SHOT[MODE][1] + ' sur le site</div><img class="shot" src="' + SHOT[MODE][0] + '"><div class="big site">pokdle.fr</div><div class="sm">Gratuit · sans inscription · plus de 30 jeux</div>');
    Array.prototype.forEach.call(card.children, (n, k) => { const a = seg(t, END + 0.2 + k * 0.3, END + 0.45 + k * 0.3); n.style.opacity = a; n.style.transform = 'translateY(' + ((1 - eOut(a)) * 24).toFixed(1) + 'px)'; });
  }
  if (!inEnd) Array.prototype.forEach.call(card.children, (n) => { n.style.opacity = 1; n.style.transform = 'none'; });
  card.style.display = on ? 'block' : 'none';
  if (on) { card.style.opacity = ck; card.style.transform = 'scale(' + (0.9 + 0.1 * eBack(ck)).toFixed(3) + ')'; }
  if (inEnd) { $('bgType').querySelector('.a').style.background = 'linear-gradient(115deg,#E8E1F2 0 50%,#D6CCE6 50% 100%)'; }
}
