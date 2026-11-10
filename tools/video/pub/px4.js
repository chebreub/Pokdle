// Trois formats de quiz pour TikTok / Shorts (05/11/2026), dans le décor de « Devine le Pokémon ! » (px6) :
//   hl   « Plus ou moins ? » : total des stats, en chaîne (le nouveau monte en haut) ;
//   cri  « Devine le cri » : 4 Pokémon (A-D), le vrai cri joue deux fois, les 3 autres passent en ombre ;
//   stat « Qui a le plus de… ? » : 4 Pokémon, une stat par manche, les valeurs s'affichent.
// Mieux que les vidéos modèles : en français, artworks officiels, chrono qui accélère, score compté et
// barème à la fin, la dernière question reste sans réponse (« réponds en commentaire »).
// « node render.js hl|cri|stat » avec PAGE=pub/px4.html. Chaque image est une fonction pure de t.
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eBack = (k, s = 1.9) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2));

// Noms et stats de base (App/pokemon.js, App/base-stats.json) : PV, Atq, Déf, Atq Spé, Déf Spé, Vit.
const M = {
  25: ['Pikachu', [35, 55, 40, 50, 50, 90]], 26: ['Raichu', [60, 90, 55, 90, 80, 110]], 40: ['Grodoudou', [140, 70, 45, 85, 50, 45]],
  65: ['Alakazam', [55, 50, 45, 135, 95, 120]], 68: ['Mackogneur', [90, 130, 80, 65, 85, 55]], 91: ['Crustabri', [50, 95, 180, 85, 45, 70]],
  94: ['Ectoplasma', [60, 65, 60, 130, 75, 110]], 101: ['Électrode', [60, 50, 70, 80, 80, 150]], 113: ['Leveinard', [250, 5, 5, 35, 105, 50]],
  131: ['Lokhlass', [130, 85, 80, 85, 95, 60]], 133: ['Évoli', [55, 55, 50, 45, 65, 55]], 142: ['Ptéra', [80, 105, 65, 60, 75, 130]],
  143: ['Ronflex', [160, 110, 65, 65, 110, 30]], 149: ['Dracolosse', [91, 134, 95, 100, 100, 80]], 172: ['Pichu', [20, 40, 15, 35, 35, 60]],
  196: ['Mentali', [65, 65, 60, 130, 95, 110]], 197: ['Noctali', [95, 65, 110, 60, 130, 65]], 208: ['Steelix', [75, 85, 200, 55, 65, 30]],
  213: ['Caratroc', [20, 10, 230, 10, 230, 5]], 214: ['Scarhino', [80, 125, 75, 40, 95, 85]], 217: ['Ursaring', [90, 130, 75, 75, 75, 55]],
  226: ['Démanta', [85, 40, 70, 80, 140, 70]], 242: ['Leuphorie', [255, 10, 10, 75, 135, 55]], 280: ['Tarsal', [28, 25, 25, 45, 35, 40]],
  281: ['Kirlia', [38, 35, 35, 65, 55, 50]], 282: ['Gardevoir', [68, 65, 65, 125, 115, 80]], 289: ['Monaflèmit', [150, 160, 100, 95, 65, 100]],
  291: ['Ninjask', [61, 90, 45, 50, 50, 160]], 306: ['Galeking', [70, 110, 180, 60, 60, 50]], 321: ['Wailord', [170, 90, 45, 90, 45, 60]],
  382: ['Kyogre', [100, 100, 90, 150, 140, 90]], 383: ['Groudon', [100, 150, 140, 100, 90, 90]], 384: ['Rayquaza', [105, 150, 90, 150, 90, 95]],
  411: ['Bastiodon', [60, 52, 168, 47, 138, 30]], 446: ['Goinfrex', [135, 85, 40, 40, 85, 5]], 447: ['Riolu', [40, 70, 40, 35, 40, 60]],
  448: ['Lucario', [70, 110, 70, 115, 70, 90]], 464: ['Rhinastoc', [115, 140, 130, 55, 55, 40]], 475: ['Gallame', [68, 125, 65, 65, 115, 80]],
  483: ['Dialga', [100, 120, 120, 150, 100, 90]], 571: ['Zoroark', [60, 105, 60, 120, 60, 105]], 609: ['Lugulabre', [60, 55, 90, 145, 90, 80]],
  617: ['Limaspeed', [80, 70, 40, 100, 60, 145]], 700: ['Nymphali', [95, 65, 65, 110, 130, 60]], 745: ['Lougaroc', [75, 115, 65, 55, 65, 112]],
  777: ['Togedemaru', [65, 98, 63, 40, 73, 96]], 778: ['Mimiqui', [55, 90, 80, 50, 105, 96]]
};
const tot = (id) => M[id][1].reduce((a, b) => a + b, 0);
const up = (id) => M[id][0].toUpperCase();

const V = {
  hl: { chain: [25, 448, 213, 289, 778, 142, 94, 131], zones: ['prairie', 'montagne', 'mer', 'volcan', 'tour', 'foret', 'prairie'] },
  cri: { rounds: [
    { o: [172, 25, 26, 777], a: 1, z: 'prairie' }, { o: [447, 571, 745, 448], a: 3, z: 'montagne' },
    { o: [143, 446, 217, 40], a: 0, z: 'foret' }, { o: [196, 700, 197, 133], a: 2, z: 'tour' },
    { o: [382, 383, 384, 483], a: 1, z: 'volcan' }, { o: [282, 281, 475, 280], a: 2, z: 'mer', mystery: true }] },
  stat: { rounds: [
    { s: 0, l: 'DE PV ?', o: [143, 321, 131, 40], z: 'mer' }, { s: 1, l: 'D’ATTAQUE ?', o: [68, 464, 149, 214], z: 'montagne' },
    { s: 2, l: 'DE DÉFENSE ?', o: [208, 306, 411, 91], z: 'volcan' }, { s: 3, l: 'D’ATQ SPÉ ?', o: [65, 94, 609, 282], z: 'tour' },
    { s: 4, l: 'DE DÉF SPÉ ?', o: [113, 242, 226, 131], z: 'prairie' }, { s: 5, l: 'DE VITESSE ?', o: [291, 101, 142, 617], z: 'foret', mystery: true }] },
  // Épisodes 2 (noms et stats lus dans assets/mons.json).
  // Format court (10/11, d'après les chiffres TikTok : les gens partent après 10 à 20 s) : chrono de 3 s,
  // pokdle.fr affiché tout du long, fin = le vrai jeu sur le site au lieu du barème.
  hl3: { short: true, chain: [6, 59, 132, 468, 143, 68], zones: ['volcan', 'prairie', 'montagne', 'foret', 'mer'] },
  hl4: { short: true, chain: [448, 289, 213, 292, 321, 778], zones: ['montagne', 'prairie', 'mer', 'foret', 'volcan'] },
  hl2: { chain: [129, 130, 128, 292, 493, 321, 445, 609], zones: ['mer', 'prairie', 'tour', 'montagne', 'mer', 'volcan', 'tour'] },
  cri2: { rounds: [
    { o: [252, 255, 258, 387], a: 2, z: 'prairie' }, { o: [94, 92, 93, 609], a: 0, z: 'tour' },
    { o: [658, 448, 571, 727], a: 3, z: 'volcan' }, { o: [150, 151, 251, 385], a: 1, z: 'montagne' },
    { o: [6, 149, 445, 373], a: 2, z: 'foret' }, { o: [778, 25, 777, 702], a: 0, z: 'mer', mystery: true }] }
};
for (const r of V.stat.rounds) r.a = r.o.reduce((b, id, k) => (M[id][1][r.s] > M[r.o[b]][1][r.s] ? k : b), 0);

let KIND = 'hl', ROUNDS = [], START = [], R = 7.4, CARD_M = 0, END = 0, TOTAL = 0;
var S = { audio: [], total: 0 };
const GROUND = {}, SLOTS = [];
const LET = 'ABCD', GRID = [[290, 800], [790, 800], [290, 1225], [790, 1225]];
// Grid rounds (cri / stat): balls drop 0-0.8, open 0.8, timer 1.3-5.3, reveal 5.3, out 7.1-7.4.
const OPEN = 0.8, T0 = 1.3, T1 = 5.3;
// Plus ou moins: ball 0-0.9, timer 1.0-5.0, reveal 5.0, slide up 6.3-6.8.
let HO = 0.9, H0 = 1.0, H1 = 5.0, HR = 6.8, HS = 6.3, SHORT = false;

function load(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }
function el(tag, cls, parent, html) { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; parent.appendChild(d); return d; }

async function setup(name) {
  KIND = name.replace(/\d+$/, ''); const v = V[name];
  try { const extra = await (await fetch('../assets/mons.json')).json(); for (const k in extra) if (!M[k]) M[k] = [extra[k][0], extra[k][1]]; } catch (_e) {}
  const A = S.audio, go = (f, t, vol) => A.push({ file: 'assets/go-' + f + '.mp3', t: +t.toFixed(3), vol });
  const cry = (id, t, vol = 1.5) => A.push({ file: 'assets/cry-' + id + '.ogg', t: +t.toFixed(3), vol, cry: true });
  SHORT = !!v.short; if (SHORT) { H1 = 4.0; HS = 4.95; HR = 5.4; }
  const tick = (t) => A.push({ file: SHORT ? 'assets/sfx/timer3.wav' : 'assets/sfx/timer4.wav', t: +t.toFixed(3), vol: 0.9 });
  let zones;
  if (KIND === 'hl') {
    R = HR; ROUNDS = v.chain.slice(1).map((id, k) => ({ id, prev: v.chain[k], z: v.zones[k], mystery: k === v.chain.length - 2 }));
    START = ROUNDS.map((_, k) => 1.0 + k * R);
    zones = v.zones;
    go('throw', 0.05, 0.8); go('appear', 0.6, 0.8);
    ROUNDS.forEach((r, k) => {
      const s = START[k]; go('throw', s, 0.9); go('land', s + 0.6, 0.6); go('appear', s + HO - 0.05, 0.9); tick(s + H0);
      if (r.mystery) go('caught', s + H1, 0.9); else { go('caught', s + H1, 0.9); cry(r.id, s + H1 + 0.08); }
    });
    const last = START[START.length - 1];
    CARD_M = last + H1 + 0.3;
  } else {
    R = 7.4; ROUNDS = v.rounds; START = ROUNDS.map((_, k) => 0.3 + k * R); zones = ROUNDS.map((r) => r.z);
    ROUNDS.forEach((r, k) => {
      const s = START[k]; go('throw', s, 0.8); go('land', s + 0.5, 0.6); go('appear', s + OPEN - 0.05, 0.9); tick(s + T0);
      if (KIND === 'cri') { cry(r.o[r.a], s + T0 + 0.05, 1.6); cry(r.o[r.a], s + T0 + 2.0, 1.6); }
      go('caught', s + T1, 0.9);
      if (KIND === 'stat' && !r.mystery) cry(r.o[r.a], s + T1 + 0.1);
    });
    CARD_M = START[START.length - 1] + T1 + 0.3;
  }
  END = CARD_M + (SHORT ? 3.8 : 5.2); TOTAL = END + (SHORT ? 4.4 : 6.6); S.total = TOTAL;
  if (SHORT) { await load('../assets/site-hl.png'); const w = el('div', 'wm', $('stage'), 'pokdle.fr'); w.id = 'wm'; }
  A.push({ file: 'assets/sfx/ambience.wav', t: 0, vol: 0.35, bed: true });
  for (const z of new Set(zones)) {
    const d = el('div', 'bg', $('bgs')); d.id = 'bg-' + z; d.style.backgroundImage = 'url(../assets/zone-' + z + '.png)';
    const im = await load('../assets/zone-' + z + '.png'), c = document.createElement('canvas'); c.width = c.height = 1;
    c.getContext('2d').drawImage(im, 40, 190, 1, 1, 0, 0, 1, 1); const p = c.getContext('2d').getImageData(0, 0, 1, 1).data;
    GROUND[z] = 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')';
  }
  const ids = new Set(KIND === 'hl' ? v.chain : ROUNDS.flatMap((r) => r.o));
  await Promise.all([...ids].map((id) => load('../assets/art-' + id + '.png')));
  // Four slots (grid) or two (top / bottom); each has art, a letter, a ring and a value.
  for (let k = 0; k < (KIND === 'hl' ? 3 : 4); k++) {
    const s = el('div', 'slot', $('slots')); s.innerHTML = '<div class="ring"></div><img><div class="val px"></div>' + (KIND === 'hl' ? '' : '<div class="lt">' + LET[k] + '</div>');
    SLOTS.push(s);
  }
  for (let k = 0; k < 4; k++) el('svg', '', $('balls')).outerHTML = $('ball').outerHTML.replace('id="ball" style="display:none"', 'class="b" style="position:absolute;left:0;top:0;width:110px;height:110px;margin:-55px 0 0 -55px;display:none"');
  if (KIND === 'hl') { el('div', 'pill', $('stage'), 'PLUS').id = 'pplus'; el('div', 'pill', $('stage'), 'MOINS').id = 'pmoins'; }
  await document.fonts.ready;
  await Promise.all(['66px "Press Start 2P"', '700 52px Fredoka', '600 42px Fredoka'].map((f) => document.fonts.load(f, 'ÉÀ!?▲▼')));
  renderAt(0);
  return TOTAL;
}

function setCard(html) { const c = $('card'); if (c.dataset.h !== html) { c.innerHTML = html; c.dataset.h = html; } }
function setImg(slot, id) { const im = slot.querySelector('img'), src = '../assets/art-' + id + '.png'; if (im.getAttribute('src') !== src) im.setAttribute('src', src); }
function roundAt(t) { let i = 0; for (let k = 0; k < START.length; k++) if (t >= START[k] - 0.15) i = k; return i; }
function count(t, a, v) { return Math.round(v * eOut(seg(t, a, a + 0.6))); }

function hud(n, total, lt, a, b, done, label, col) {
  $('num').textContent = 'QUESTION ' + n + '/' + total;
  const left = 1 - seg(lt, a, b), step = left > 0.66 ? 0 : left > 0.33 ? 1 : 2;
  const c = ['#6BE05A', '#FFD45C', '#FF5A48'][step];
  $('fill').style.width = (done ? 0 : left * 100).toFixed(2) + '%'; $('fill').style.background = c;
  const pts = $('pts');
  if (done) { pts.textContent = label; pts.style.color = col || '#fff'; }
  else if (lt < a) { pts.textContent = 'PRÊT ?'; pts.style.color = '#fff'; }
  else { pts.textContent = String(Math.max(1, Math.ceil((b - lt) / ((b - a) / 3)))); pts.style.color = c; }
}

function ballAt(node, x0, y0, x1, y1, k, r) {
  node.style.display = 'block';
  node.style.transform = 'translate(' + lerp(x0, x1, k).toFixed(1) + 'px,' + (lerp(y0, y1, k) - 600 * 4 * k * (1 - k) * (y0 > y1 ? 1 : 0)).toFixed(1) + 'px) rotate(' + (r * k).toFixed(0) + 'deg)';
}

function renderAt(t) {
  const i = roundAt(t), r = ROUNDS[i], s = START[i], lt = t - s;
  const mCard = t >= CARD_M && t < END, inEnd = t >= END;
  const z = r.z;
  document.querySelectorAll('.bg').forEach((d) => { d.style.display = d.id === 'bg-' + z ? 'block' : 'none'; });
  $('stage').style.background = GROUND[z];
  $('bg-' + z).style.transform = 'translateX(' + (-996 + 150 - 300 * clamp(lt / 9)).toFixed(1) + 'px)';
  let dip = 0;
  if (KIND !== 'hl') for (let k = 1; k < START.length; k++) dip = Math.max(dip, 1 - Math.abs(t - (START[k] - 0.15)) / 0.22);
  $('fade').style.opacity = clamp(dip) + (inEnd ? 0.25 * seg(t, END, END + .4) : 0);
  const balls = document.querySelectorAll('#balls .b'); balls.forEach((b) => { b.style.display = 'none'; });
  const spk = $('spk'); spk.style.display = 'none';
  const sub = $('sub'); sub.style.display = 'none';
  $('title').style.display = mCard || inEnd ? 'none' : 'block';
  $('hud').style.display = inEnd ? 'none' : 'block';
  const flash = $('flash'); flash.style.opacity = 0;

  if (KIND === 'hl') renderHL(t, i, r, lt, mCard, inEnd, balls);
  else renderGrid(t, i, r, lt, mCard, inEnd, balls);

  // Cards: the last question, then the score scale.
  if (SHORT) $('wm').style.display = mCard || inEnd ? 'none' : 'block';
  const card = $('card'); let cOn = false, ck = 0, top = 300;
  const shown = ROUNDS.length - 1;
  if (mCard) {
    cOn = true; ck = seg(t, CARD_M, CARD_M + .3); top = 36;
    const lastR = ROUNDS[ROUNDS.length - 1];
    const q = KIND === 'hl' ? '<div class="big">ET LE DERNIER ?</div><div class="mid">' + M[lastR.id][0] + ' : plus ou moins que ' + M[lastR.prev][0] + ' (' + tot(lastR.prev) + ') ?</div>'
      : KIND === 'cri' ? '<div class="big">LE DERNIER,<br>PRESQUE PERSONNE<br>NE L’A</div><div class="mid">A, B, C ou D ? Réponds en commentaire</div>'
        : '<div class="big">LE PLUS RAPIDE ?</div><div class="mid">A, B, C ou D ? Réponds en commentaire</div>';
    setCard(q + '<div class="sm">' + (SHORT ? 'Ton score sur ' + shown + ' et ta réponse en commentaire' : (KIND === 'hl' ? 'Réponds en commentaire · ' : '') + 'réponse demain dans le commentaire épinglé') + '</div>');
  } else if (inEnd) {
    cOn = true; ck = seg(t, END, END + .3); top = SHORT ? 150 : 230;
    if (SHORT) setCard('<div class="big">JOUE À LA<br>VERSION COMPLÈTE</div><img class="shot" src="../assets/site-hl.png"><div class="big site">POKDLE.FR</div><div class="sm">Gratuit · sans inscription · plus de 30 jeux</div>');
    const sc = shown === 6 ? ['0-2', '3-4', '5', '6'] : ['0-1', '2-3', '4', '5'];
    if (!SHORT) setCard('<div class="big">TON SCORE<br>SUR ' + shown + ' ?</div>' +
      '<div class="row"><span>Dresseur débutant</span><b>' + sc[0] + '</b></div><div class="row"><span>Champion d’arène</span><b>' + sc[1] + '</b></div>' +
      '<div class="row"><span>Maître de la Ligue</span><b>' + sc[2] + '</b></div><div class="row"><span>Tu triches ?</span><b>' + sc[3] + '</b></div>' +
      '<div class="mid">Écris ton score en commentaire</div><div class="big site">POKDLE.FR</div><div class="sm">Entraîne-toi sur le site · abonne-toi pour le prochain défi</div>');
    Array.prototype.forEach.call(card.children, (n, k) => { const a = seg(t, END + .2 + k * .32, END + .45 + k * .32); n.style.opacity = a; n.style.transform = 'translateY(' + ((1 - eOut(a)) * 24).toFixed(1) + 'px)'; });
  }
  if (!inEnd) Array.prototype.forEach.call(card.children, (n) => { n.style.opacity = 1; n.style.transform = 'none'; });
  card.style.display = cOn ? 'block' : 'none';
  if (cOn) { card.style.top = top + 'px'; card.style.opacity = ck; card.style.transform = 'scale(' + (0.9 + 0.1 * eBack(ck)).toFixed(3) + ')'; }
}

function renderGrid(t, i, r, lt, mCard, inEnd, balls) {
  const mystery = !!r.mystery, rev = lt >= T1 && !mystery, title = $('title');
  title.innerHTML = KIND === 'cri' ? 'DEVINE LE<br>CRI !' : 'QUI A LE PLUS<br><span style="color:#6BE05A">' + r.l + '</span>';
  title.style.top = '120px';
  if (KIND === 'cri' && !inEnd && !mCard) {
    // Speaker pulses while the cry plays.
    const on = (lt > T0 && lt < T0 + 1.6) || (lt > T0 + 1.95 && lt < T0 + 3.6);
    const spk = $('spk'); spk.style.display = 'block'; spk.style.top = '340px';
    spk.style.transform = 'scale(' + (1 + (on ? 0.08 * Math.abs(Math.sin(lt * 14)) : 0)).toFixed(3) + ')';
    spk.querySelector('.w1').style.opacity = on ? 0.4 + 0.6 * Math.abs(Math.sin(lt * 9)) : 0.25;
    spk.querySelector('.w2').style.opacity = on ? 0.4 + 0.6 * Math.abs(Math.sin(lt * 9 + 1)) : 0.25;
  }
  const out = mystery ? 0 : seg(lt, R - 0.3, R - 0.08);
  SLOTS.forEach((sl, k) => {
    const [x, y] = GRID[k], id = r.o[k];
    sl.style.left = x + 'px'; sl.style.top = y + 'px'; setImg(sl, id);
    const show = !inEnd && lt >= OPEN;
    sl.style.display = show ? 'block' : 'none';
    if (k < balls.length && !inEnd && lt >= 0 && lt < OPEN) ballAt(balls[k], x, y - 900, x, y + 60, eOut(seg(lt, 0.05 * k, 0.5 + 0.05 * k)), 540);
    if (!show) return;
    const ap = seg(lt, OPEN, OPEN + 0.3), win = k === r.a;
    const im = sl.querySelector('img');
    const shade = rev && !win ? seg(lt, T1, T1 + 0.25) : 0;
    im.style.filter = 'brightness(' + ((1 + 4 * (1 - ap)) * (1 - shade)).toFixed(3) + ') drop-shadow(0 14px 0 rgba(46,42,51,.25))';
    const pop = rev && win ? 1 + 0.12 * Math.sin(Math.PI * seg(lt, T1, T1 + 0.35)) : 1;
    im.style.transform = 'translateY(' + (Math.sin(lt * 3 + k) * 7).toFixed(1) + 'px) scale(' + ((0.3 + 0.7 * eBack(ap)) * pop * (1 - 0.15 * out)).toFixed(3) + ')';
    sl.style.opacity = 1 - out;
    const ring = sl.querySelector('.ring'); ring.style.opacity = rev && win ? seg(lt, T1, T1 + 0.2) : 0;
    const val = sl.querySelector('.val');
    if (KIND === 'stat' && rev) { val.textContent = count(lt, T1, M[id][1][r.s]); val.style.color = win ? '#6BE05A' : '#fff'; }
    else if (KIND === 'cri' && rev && win) { val.textContent = up(id); val.style.color = '#6BE05A'; val.style.fontSize = '34px'; }
    else val.textContent = '';
  });
  if (!inEnd && lt >= OPEN && lt < OPEN + 0.3) { const f = $('flash'); f.style.opacity = 1 - seg(lt, OPEN, OPEN + 0.3); f.style.top = '1010px'; f.style.transform = 'scale(' + (1 + 30 * eOut(seg(lt, OPEN, OPEN + 0.3))) + ')'; }
  const done = lt >= T1;
  hud(i + 1, ROUNDS.length, lt, T0, T1, done, mystery ? 'À TOI ?' : 'RÉPONSE ' + LET[r.a], mystery ? '#fff' : '#6BE05A');
}

function renderHL(t, i, r, lt, mCard, inEnd, balls) {
  const title = $('title'); title.innerHTML = 'PLUS OU<br>MOINS ?'; title.style.top = '110px';
  const sub = $('sub'); sub.style.display = inEnd || mCard ? 'none' : 'block'; sub.textContent = 'Total des stats'; sub.style.top = '312px';
  const TOP = [540, 640], BOT = [540, 1170], mystery = !!r.mystery;
  const [st, sb, sx] = SLOTS; // top, bottom, extra (old top leaving)
  [st, sb, sx].forEach((n) => { n.style.display = 'none'; n.querySelector('.ring').style.opacity = 0; });
  const place = (n, id, x, y, sc, op, val, vcol) => {
    n.style.display = 'block'; n.style.left = x + 'px'; n.style.top = y + 'px'; n.style.opacity = op; setImg(n, id);
    const im = n.querySelector('img'); im.style.transform = 'scale(' + sc.toFixed(3) + ')'; im.style.filter = 'drop-shadow(0 14px 0 rgba(46,42,51,.25))';
    const v = n.querySelector('.val'); v.textContent = val; v.style.color = vcol || '#FFD45C'; v.style.fontSize = '50px'; v.style.bottom = '-50px';
  };
  const pp = $('pplus'), pm = $('pmoins');
  pp.style.display = pm.style.display = inEnd ? 'none' : 'flex';
  pp.style.left = '30px'; pm.style.left = '810px'; pp.style.top = pm.style.top = '1170px';
  pp.style.background = pm.style.background = 'rgba(46,42,51,.88)'; pp.style.transform = pm.style.transform = 'none';
  if (inEnd) return;
  // Intro: the very first Pokémon lands on top.
  if (t < START[0]) {
    if (t < 0.6) ballAt(balls[0], 120, 1990, TOP[0], TOP[1], seg(t, 0, 0.6), 800);
    else place(st, r.prev, TOP[0], TOP[1], 0.3 + 0.7 * eBack(seg(t, 0.6, 0.9)), 1, tot(r.prev));
    hud(1, ROUNDS.length, 0, 1, 2, false);
    return;
  }
  const slide = mystery ? 0 : eOut(seg(lt, HS, HR));
  const rev = lt >= H1 && !mystery, up_ = tot(r.id) >= tot(r.prev);
  // Top: the previous one (leaves upward while the bottom one slides up).
  place(st, r.prev, TOP[0], TOP[1] - 700 * slide, 1, 1 - slide, tot(r.prev));
  // Bottom: thrown in, then revealed, then slides to the top.
  if (lt < HO) ballAt(balls[0], 120, 1990, BOT[0], BOT[1] + 40, seg(lt, 0, 0.6), 800);
  else {
    const ap = seg(lt, HO, HO + 0.3);
    place(sb, r.id, BOT[0], lerp(BOT[1], TOP[1], slide), (0.3 + 0.7 * eBack(ap)) * (1 + 0.1 * Math.sin(Math.PI * seg(lt, H1, H1 + 0.35))), 1,
      rev ? String(count(lt, H1, tot(r.id))) : '?', rev ? '#6BE05A' : '#fff');
    sb.querySelector('img').style.filter = 'brightness(' + (1 + 4 * (1 - ap)).toFixed(2) + ') drop-shadow(0 14px 0 rgba(46,42,51,.25))';
    if (lt < HO + 0.3) { const f = $('flash'); f.style.opacity = 1 - ap; f.style.top = BOT[1] + 'px'; f.style.transform = 'scale(' + (1 + 26 * eOut(ap)) + ')'; }
  }
  if (rev) {
    const good = up_ ? pp : pm, k = seg(lt, H1, H1 + 0.25);
    good.style.background = 'rgba(64,170,70,' + (0.88 * k + 0.0).toFixed(2) + ')';
    good.style.transform = 'scale(' + (1 + 0.15 * Math.sin(Math.PI * seg(lt, H1, H1 + 0.4))) + ')';
  }
  pp.style.opacity = pm.style.opacity = (1 - slide).toFixed(3);
  hud(i + 1, ROUNDS.length, lt, H0, H1, lt >= H1, mystery ? 'À TOI ?' : (up_ ? 'PLUS !' : 'MOINS !'), mystery ? '#fff' : '#6BE05A');
}
