// Moteur des quiz courts (12-22/11/2026). Contenu dans q6-content.json (fait par q6-gen.js), données dans
// ../assets/q5data.json (id: [nom, types, poids, taille, gen, stats]). 5 questions de 3 s, la 5e reste en
// mystère, puis une fin dessinée « Joue à … sur pokdle.fr » (plus de capture du site). Image = fonction de t.
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
const STATN = ['PV', 'Attaque', 'Défense', 'Atq. Spé.', 'Déf. Spé.', 'Vitesse'];
const STATC = { 0: ['#FF6B6B', '#C8343A'], 1: ['#FFA45C', '#D2652A'], 2: ['#F6C83E', '#C08A12'], 3: ['#6F9BFF', '#3657C8'], 4: ['#6CCB7A', '#2F8F4A'], 5: ['#FF6FA9', '#B92D63'], t: ['#A98BF0', '#6A47C8'] };
const ZONES = ['foret', 'mer', 'montagne', 'volcan', 'tour', 'prairie'];
const GAME = { zoom: 'Zoom progressif', silh: 'Zoom progressif', pixel: 'Pokémon pixelisé', type: 'Combo de types', vf: 'Quiz Pokémon',
  grid: 'Clash de stats', pom: 'Higher or Lower', premier: 'Ordre Pokédex', grand: 'Pokédex', lourd: 'Duel de poids' };

let D = {}, C = {}, MODE = '', KIND = '', VID = null, Q = [], START = [];
const INTRO = 2.0, R = 5.4, T0 = 0.5, T1 = 3.5;
let CARD_M = 0, END = 0, TOTAL = 0;
var S = { audio: [], total: 0 };
const nm = (i) => D[i][0];
const art = (id) => '../assets/art-' + id + '.png';
const chip = (t) => '<span style="background:' + TC[t] + '">' + t + '</span>';
const sval = (i, s) => (s === 't' ? D[i][5].reduce((a, b) => a + b, 0) : D[i][5][s]);
function load(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image ' + src)); i.src = src; }); }
const IMG = {};

async function setup(name) {
  D = await (await fetch('../assets/q5data.json')).json();
  C = await (await fetch('q6-content.json')).json();
  VID = C[name]; MODE = VID.mode; KIND = VID.kind || MODE;
  if (MODE === 'pom') Q = VID.chain.slice(1).map((id, k) => ({ prev: VID.chain[k], id, up: sval(id, VID.s) > sval(VID.chain[k], VID.s) }));
  else Q = VID.qs;
  START = Q.map((_, k) => INTRO + k * R);
  CARD_M = START[Q.length - 1] + T1 + 0.1; END = CARD_M + 3.8; TOTAL = END + 5.0; S.total = TOTAL;
  const ids = new Set(); Q.forEach((q) => { [q.id, q.prev].forEach((i) => i && ids.add(i)); if (MODE !== 'type' && q.o && typeof q.o[0] === 'number' && ['grid', 'pair', 'lourd'].includes(MODE)) q.o.forEach((i) => ids.add(i)); });
  for (const i of ids) IMG[i] = await load(art(i));
  if (MODE === 'zoom') await Promise.all(ZONES.map((z) => load('../assets/zones/' + z + '.png')));
  await document.fonts.ready; await document.fonts.load('700 92px Fredoka', 'ÉÀ?');
  const st = $('stars').getContext('2d'); let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 260; i++) { st.fillStyle = 'rgba(255,255,255,' + (0.3 + rnd() * 0.7) + ')'; const z = rnd() * 5 + 1; st.fillRect(rnd() * 1080, rnd() * 1920, z, z); }
  const A = S.audio, push = (file, t, vol, cry) => A.push({ file, t: +t.toFixed(3), vol, cry });
  push('assets/go-throw.mp3', 0.25, 0.7);
  Q.forEach((q, k) => {
    const s = START[k]; push('assets/sfx/timer3.wav', s + T0, 0.9);
    if (k === Q.length - 1) { push('assets/go-caught.mp3', s + T1 + 0.1, 0.9); return; }
    push('assets/go-appear.mp3', s + T1, 0.8);
    push('assets/cry-' + crier(q) + '.ogg', s + T1 + 0.15, 1.3, true);
  });
  push('assets/go-land.mp3', END + 0.1, 0.8);
  const BG = { zoom: 'bgZone', pixel: 'bgDex', silh: 'bgSpot', type: 'bgType', vf: 'bgVf', grid: VID.legend ? 'bgNight' : 'bgStat', pom: 'bgCream',
    premier: 'bgNight', grand: 'bgSky', lourd: 'bgSun' };
  $(BG[KIND]).style.display = 'block';
  if (KIND === 'pom') $('title').classList.add('dark');
  renderAt(0);
  return TOTAL;
}
function crier(q) { return MODE === 'pom' ? q.id : (MODE === 'grid' || MODE === 'pair' || MODE === 'lourd') ? q.o[q.a] : q.id; }
function html(id, h) { const e = $(id); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; } return e; }
function show(id, on, disp) { $(id).style.display = on ? (disp || 'block') : 'none'; }
function mix(a, b, k) { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const x = p(a), y = p(b); return 'rgb(' + x.map((v, i) => Math.round(lerp(v, y[i], k))).join(',') + ')'; }
const cls = (rev, j, a) => (rev ? (j === a ? 'ok' : 'bad') : '');
const fmtH = (m) => String(m).replace('.', ',') + ' m';
const fmtKg = (w) => String(w).replace('.', ',') + ' kg';
const fmtNo = (i) => 'N° ' + String(i).padStart(4, '0');

function renderAt(t) {
  const intro = t < INTRO, inEnd = t >= END, mCard = t >= CARD_M && t < END, game = !intro && !inEnd;
  let i = 0; for (let k = 0; k < START.length; k++) if (t >= START[k]) i = k;
  const q = Q[i], lt = t - START[i], last = i === Q.length - 1, rev = !last && lt >= T1;
  const enter = eBack(seg(lt, 0, 0.4)), tk = seg(lt, T0, T1);

  const TT = { zoom: 'QUEL EST CE<br>POKÉMON ?', pixel: 'QUI SE CACHE<br>DANS LE POKÉDEX ?', silh: 'À QUI EST<br>CETTE OMBRE ?', type: 'QUEL EST<br>SON TYPE ?',
    vf: 'VRAI OU<br>FAUX ?', grid: VID.title || 'QUI A LE<br>PLUS DE… ?', pom: 'PLUS OU MOINS ?', premier: 'LEQUEL VIENT<br>EN PREMIER ?', grand: 'QUI EST LE<br>PLUS GRAND ?', lourd: 'QUI EST LE<br>PLUS LOURD ?' };
  html('title', TT[KIND]);
  const tt = intro ? eBack(seg(t, 0.1, 0.5)) : 1; $('title').style.transform = 'scale(' + (0.4 + 0.6 * tt) + ')';
  show('title', !inEnd && !mCard);
  html('hook', KIND === 'vf' ? '5 affirmations pièges<br>3 secondes chacune<br>Compte tes points !' : '5 questions pièges<br>3 secondes chacune<br>Compte tes points !');
  show('hook', intro); $('hook').style.opacity = seg(t, 0.5, 0.8) * (1 - seg(t, INTRO - 0.25, INTRO));

  // Sous-titre (stat, unité) et compteur.
  let sub = '';
  if (MODE === 'grid') sub = (q.dir > 0 ? 'Le plus de ' : 'Le moins de ') + (q.s === 't' ? 'stats au total' : STATN[q.s]) + ' ?';
  if (MODE === 'pom') sub = (VID.s === 't' ? 'Total des stats' : STATN[VID.s]) + ' · ' + (i + 1) + '/5';
  if (KIND === 'premier') sub = 'Dans le Pokédex national';
  if (KIND === 'grand') sub = 'En mètres';
  if (KIND === 'lourd') sub = 'Question ' + (i + 1) + '/5';
  html('sub', sub); show('sub', game && !mCard && !!sub);
  $('sub').style.top = MODE === 'pom' ? '250px' : '330px';
  const rest = 1 - tk, col = rest > 0.66 ? '#6BE05A' : rest > 0.33 ? '#FFD45C' : '#FF5A48';
  $('fill').style.width = (lt < T0 ? 100 : rest * 100).toFixed(2) + '%'; $('fill').style.background = col;
  show('timer', game); html('qn', 'Question ' + (i + 1) + '/5'); show('qn', game && !['pom', 'lourd'].includes(MODE));
  show('wm', !inEnd);

  // Fonds qui bougent avec la question.
  if (KIND === 'type') {
    const ty = D[q.id][1], k = rev ? seg(lt, T1, T1 + 0.35) : 0;
    $('bgType').style.background = 'linear-gradient(115deg,' + mix('#E8E1F2', TC[ty[0]], k) + ' 0 49.8%,#fff 49.8% 50.6%,' + mix('#D6CCE6', TC[ty[1] || ty[0]], k) + ' 50.6% 100%)';
  }
  if (KIND === 'vf') { const k = rev ? seg(lt, T1, T1 + 0.35) : 0, c = q.a === 0 ? '#5BD06E' : '#F0645A'; $('bgVf').style.background = 'linear-gradient(115deg,' + mix('#E8E1F2', c, k) + ' 0 50%,' + mix('#D6CCE6', c, k * 0.85) + ' 50% 100%)'; }
  if (KIND === 'grid' && !VID.legend) { const c = STATC[q.s]; $('bgStat').style.background = 'linear-gradient(160deg,' + c[0] + ' 0%,' + c[1] + ' 100%)'; }
  if (KIND === 'zoom') $('bgZone').style.backgroundImage = 'url(../assets/zones/' + ZONES[i % ZONES.length] + '.png)';

  // Une image + 4 réponses (zoom, pixel, ombre, type, vrai ou faux).
  const one = ['zoom', 'pixel', 'silh', 'type', 'vf'].includes(MODE);
  show('frame', game && one);
  if (one && game) {
    const fr = $('frame'), im = $('fimg'), cv = $('fcv');
    fr.className = MODE === 'zoom' || MODE === 'vf' ? 'box' : MODE === 'pixel' ? 'screen' : '';
    const big = MODE === 'vf' ? 520 : 660; fr.style.width = fr.style.height = big + 'px'; fr.style.marginLeft = -big / 2 + 'px'; fr.style.top = MODE === 'vf' ? '410px' : '430px';
    const sz = big - 100; im.style.width = im.style.height = cv.style.width = cv.style.height = sz + 'px'; im.style.margin = cv.style.margin = (-sz / 2) + 'px 0 0 ' + (-sz / 2) + 'px';
    im.src = art(q.id); fr.querySelector('.no').textContent = MODE === 'pixel' ? (rev ? fmtNo(q.id) : 'N° ????') : '';
    let sc = 0.3 + 0.7 * enter, filt = 'none', origin = '50% 50%';
    if (MODE === 'zoom') { const z = rev ? lerp(4.2, 1, eInOut(seg(lt, T1, T1 + 0.45))) : lerp(8, 4.2, tk); sc = z; origin = (q.f[0] * 100).toFixed(1) + '% ' + (q.f[1] * 100).toFixed(1) + '%'; }
    if (MODE === 'silh') { const b = rev ? seg(lt, T1, T1 + 0.3) : 0; filt = 'brightness(' + b + ')' + (b < 1 ? ' drop-shadow(0 0 30px rgba(140,160,255,.35))' : ''); }
    im.style.transformOrigin = origin; im.style.transform = 'scale(' + sc.toFixed(3) + ')'; im.style.filter = filt;
    const px = MODE === 'pixel' && !rev; cv.style.display = px ? 'block' : 'none'; im.style.display = px ? 'none' : 'block';
    if (px) { const lv = tk < 1 / 3 ? 9 : tk < 2 / 3 ? 13 : 19; if (cv.dataset.k !== q.id + ':' + lv) { const x = cv.getContext('2d'), s = document.createElement('canvas'); s.width = s.height = lv; s.getContext('2d').drawImage(IMG[q.id], 0, 0, lv, lv); x.clearRect(0, 0, 560, 560); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, 560, 560); cv.dataset.k = q.id + ':' + lv; } cv.style.transform = 'scale(' + (0.3 + 0.7 * enter) + ')'; }
  }
  if (game && ['zoom', 'pixel', 'silh', 'type'].includes(MODE)) {
    html('opts', q.o.map((o, j) => '<div class="' + cls(rev, j, q.a) + '"><b>' + 'ABCD'[j] + '</b>' + (MODE === 'type' ? o.map(chip).join('') : nm(o)) + '</div>').join(''));
    $('opts').style.display = 'grid';
  } else show('opts', false);
  if (game && MODE === 'vf') { html('stmt', q.txt); show('stmt', true); const b = $('vfb').children; b[0].className = cls(rev, 0, q.a); b[1].className = cls(rev, 1, q.a); show('vfb', true, 'flex'); }
  else { show('stmt', false); show('vfb', false); }

  // Grille de 4 Pokémon.
  if (game && MODE === 'grid') {
    html('grid', q.o.map((id, j) => '<div class="' + cls(rev, j, q.a) + '"><span class="L">' + 'ABCD'[j] + '</span><img src="' + art(id) + '"><div class="nm">' + nm(id) + '</div><div class="val">' + sval(id, q.s) + '</div></div>').join(''));
    Array.prototype.forEach.call($('grid').children, (n, j) => { n.querySelector('.val').style.opacity = rev ? seg(lt, T1 + j * 0.08, T1 + 0.2 + j * 0.08) : 0; n.querySelector('img').style.transform = 'scale(' + (0.3 + 0.7 * eBack(seg(lt, j * 0.06, 0.4 + j * 0.06))) + ')'; });
    $('grid').style.display = 'grid';
  } else show('grid', false);

  // Plus ou moins en chaîne.
  if (MODE === 'pom') {
    const sl = rev ? eInOut(seg(lt, R - 0.55, R - 0.05)) : 0, TOPY = 340, BOTY = 930;
    const setC = (el, id, y, val, qq, op) => {
      el.querySelector('img').src = art(id); el.querySelector('.n').textContent = nm(id);
      const v = el.querySelector('.v'); v.textContent = val; v.className = 'v' + (qq ? ' q' : '');
      el.style.top = y + 'px'; el.style.opacity = op; el.style.display = game ? 'block' : 'none';
    };
    const cnt = Math.round(lerp(sval(q.prev, VID.s) * 0.9, sval(q.id, VID.s), eOut(seg(lt, T1, T1 + 0.6))));
    setC($('cTop'), q.prev, lerp(TOPY, TOPY - 620, sl), sval(q.prev, VID.s), false, 1 - sl);
    setC($('cBot'), q.id, lerp(BOTY + (1 - enter) * 700, TOPY, sl), rev ? cnt : '?', !rev, 1);
    const bs = $('btns').children; bs[0].className = rev ? (q.up ? 'ok' : 'bad') : ''; bs[1].className = rev ? (!q.up ? 'ok' : 'bad') : '';
    show('btns', game, 'flex'); html('diff', 'écart de 15 au plus !'); show('diff', game && !rev); $('diff').style.top = (BOTY - 30) + 'px';
  } else ['cTop', 'cBot', 'btns', 'diff'].forEach((id) => show(id, false));

  // Duel côte à côte (premier dans le Pokédex, plus grand).
  if (game && MODE === 'pair') {
    const val = (id) => (KIND === 'premier' ? fmtNo(id) : fmtH(D[id][3]));
    html('duo', q.o.map((id, j) => '<div class="' + (rev && j === q.a ? 'ok' : '') + '"><span class="L">' + 'AB'[j] + '</span><img src="' + art(id) + '"><div class="nm">' + nm(id) + '</div><div class="val">' + (rev ? val(id) : (KIND === 'premier' ? 'N° ????' : '? m')) + '</div></div>').join(''));
    Array.prototype.forEach.call($('duo').children, (n) => { n.querySelector('img').style.transform = 'scale(' + (0.3 + 0.7 * enter) + ')'; });
    show('duo', true, 'flex'); show('vs', true);
  } else { show('duo', false); show('vs', false); }

  // Balance (plus lourd).
  if (MODE === 'lourd') {
    const sw = Math.sin(lt * 3) * 2.2 * (1 - seg(lt, T1, T1 + 0.2));
    const ang = rev ? (q.a === 1 ? 9 : -9) * eBack(seg(lt, T1, T1 + 0.5), 1.4) : sw;
    $('beam').setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' 540 190)');
    const r = ang * Math.PI / 180, ends = [[230, 190], [850, 190]].map(([x, y]) => [540 + (x - 540) * Math.cos(r) - (y - 190) * Math.sin(r), 190 + (x - 540) * Math.sin(r) + (y - 190) * Math.cos(r)]);
    ['panA', 'panB'].forEach((pid, j) => {
      const el = $(pid), id = q.o[j], [x, y] = ends[j];
      el.style.left = (x - 220) + 'px'; el.style.top = (700 + y + 20) + 'px';
      el.querySelector('img').src = art(id); el.querySelector('img').style.transform = 'scale(' + (0.3 + 0.7 * enter) + ')';
      const kg = el.querySelector('.kg'); kg.textContent = nm(id) + (rev ? ' · ' + fmtKg(D[id][2]) : ''); kg.className = 'kg' + (rev && j === q.a ? ' ok' : '');
      el.style.display = game ? 'block' : 'none';
    });
    show('scale', game);
  } else ['panA', 'panB', 'scale'].forEach((id) => show(id, false));

  // Cartes : le mystère (en haut, la question reste visible) puis la fin dessinée.
  const card = $('card'); let on = false, ck = 0;
  if (mCard) {
    on = true; ck = seg(t, CARD_M, CARD_M + 0.3); card.style.top = '70px'; card.style.padding = '34px 30px';
    html('card', '<div class="big" style="font-size:62px">TA RÉPONSE EN<br>COMMENTAIRE 👇</div><div class="sm" style="margin-top:14px">Et ton score sur 4 ? Réponse demain en épinglé</div>');
  } else if (inEnd) {
    on = true; ck = seg(t, END, END + 0.3); card.style.top = '150px'; card.style.padding = '56px 40px';
    const trio = Q.slice(0, 3).map(crier);
    html('card', '<div class="big">JOUE EN ENTIER<br>SUR LE SITE</div><div class="game">' + GAME[KIND] + '</div>' +
      '<div class="trio">' + trio.map((id, k) => '<img src="' + art(id) + '" style="left:' + [10, 290, 570][k] + 'px;top:' + [60, 0, 60][k] + 'px;width:300px;height:300px">').join('') + '</div>' +
      '<div class="big site">pokdle.fr</div><div class="sm">Gratuit · sans inscription · plus de 30 jeux</div><div class="sm">🔔 Abonne-toi pour le prochain défi</div>');
    Array.prototype.forEach.call(card.children, (n, k) => { const a = seg(t, END + 0.2 + k * 0.28, END + 0.45 + k * 0.28); n.style.opacity = a; n.style.transform = 'translateY(' + ((1 - eOut(a)) * 24).toFixed(1) + 'px)'; });
  }
  if (!inEnd) Array.prototype.forEach.call(card.children, (n) => { n.style.opacity = 1; n.style.transform = 'none'; });
  card.style.display = on ? 'block' : 'none';
  if (on) { card.style.opacity = ck; card.style.transform = 'scale(' + (0.9 + 0.1 * eBack(ck)).toFixed(3) + ')'; }
}
