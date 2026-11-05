// « Devine le Pokémon ! » : 6 Pokémon pixelisés (04/11/2026, ~65 s, vertical), format d'une vidéo
// TikTok à 1,4 M de vues que Kayan a envoyée. Pour chaque Pokémon : une Ball lancée sur la plateforme
// de nos décors pixel art, il sort très pixelisé et se précise en 3 temps (3 pts → 2 pts → 1 pt), puis
// « ! », son nom et son vrai cri. Le 6e reste pixelisé : « Écris ta réponse en commentaire ».
// Sons : ceux de Pokémon GO (lancer, chute, sortie, clic) et les vrais cris ; pas de musique.
// Chaque image est une fonction pure de t (même principe que pix3.js).
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eBack = (k, s = 1.9) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2));

// Une liste par vidéo : « node render.js px6 » (Forgelina en mystère) ou « px6b » (Terraiste).
const SETS = {
  px6: { hint: 'Indice : type Fée', q: [
    { id: 131, n: 'LOKHLASS', z: 'montagne' }, { id: 229, n: 'DÉMOLOSSE', z: 'volcan' }, { id: 350, n: 'MILOBELLUS', z: 'mer' },
    { id: 609, n: 'LUGULABRE', z: 'tour' }, { id: 823, n: 'CORVAILLUS', z: 'foret' }, { id: 959, n: '??????', z: 'prairie', mystery: true }] },
  px6b: { hint: 'Indice : type Poison', q: [
    { id: 59, n: 'ARCANIN', z: 'volcan' }, { id: 181, n: 'PHARAMP', z: 'prairie' }, { id: 373, n: 'DRATTAK', z: 'mer' },
    { id: 445, n: 'CARCHACROK', z: 'montagne' }, { id: 706, n: 'MUPLODOCUS', z: 'foret' }, { id: 980, n: '??????', z: 'tour', mystery: true }] }
};
let Q = SETS.px6.q, HINT = SETS.px6.hint;
const GRID = [8, 12, 19], GRID_MYSTERY = [7, 9, 11];
// Round timing (seconds from the round start).
const R = 9.0, OPEN = 1.15, STEP2 = 3.25, STEP3 = 5.35, REVEAL = 7.35;
const SUB = 1.6; // « Abonne-toi » card after round 2
const START = [0.2];
for (let i = 1; i < Q.length; i++) START.push(START[i - 1] + R + (i === 2 ? SUB : 0));
const MYS = START[5], CARD_M = MYS + REVEAL + 0.4, END = CARD_M + 4.8, TOTAL = END + 6.6;
var S = { audio: [], total: TOTAL };
const IMG = {}, GROUND = {};

function load(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }

async function setup(name) {
  if (SETS[name]) { Q = SETS[name].q; HINT = SETS[name].hint; }
  for (const q of Q) IMG[q.id] = await load('../assets/art-' + q.id + '.png');
  const bgs = $('bgs');
  for (const z of new Set(Q.map((q) => q.z))) {
    const d = document.createElement('div'); d.className = 'bg'; d.id = 'bg-' + z;
    d.style.backgroundImage = 'url(../assets/zone-' + z + '.png)'; bgs.appendChild(d);
    // The zone image stops at y = 1780: fill below with its ground colour.
    const im = await load('../assets/zone-' + z + '.png'), c = document.createElement('canvas'); c.width = 1; c.height = 1;
    c.getContext('2d').drawImage(im, 40, 190, 1, 1, 0, 0, 1, 1);
    const p = c.getContext('2d').getImageData(0, 0, 1, 1).data; GROUND[z] = 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')';
  }
  await document.fonts.ready;
  await Promise.all(['66px "Press Start 2P"', '700 52px Fredoka', '600 42px Fredoka'].map((f) => document.fonts.load(f, 'ÉÀ!?')));
  const A = S.audio, go = (f, t, vol) => A.push({ file: 'assets/go-' + f + '.mp3', t: +t.toFixed(3), vol });
  A.push({ file: 'assets/sfx/ambience.wav', t: 0, vol: 0.35, bed: true }); // bed: left out by mixm.sh
  Q.forEach((q, i) => {
    const s = START[i];
    go('throw', s, 0.9); go('land', s + 0.72, 0.7); go('appear', s + OPEN - 0.05, 0.9);
    go('caught', s + STEP2, 0.8); go('caught', s + STEP3, 0.8);
    // Tic-tac qui accélère pendant les 3 paliers (pub/timer.py).
    A.push({ file: 'assets/sfx/timer.wav', t: +(s + OPEN + 0.05).toFixed(3), vol: 0.9 });
    if (q.mystery) go('caught', s + REVEAL, 0.9);
    else A.push({ file: 'assets/cry-' + q.id + '.ogg', t: +(s + REVEAL + 0.05).toFixed(3), vol: 1.5, cry: true });
  });
  renderAt(0);
  return TOTAL;
}

function roundAt(t) {
  let i = 0;
  for (let k = 0; k < START.length; k++) if (t >= START[k] - 0.15) i = k;
  return i;
}

function drawMon(img, grid) {
  const c = $('mon'), x = c.getContext('2d');
  x.clearRect(0, 0, 620, 620);
  if (!grid) { x.imageSmoothingEnabled = true; x.drawImage(img, 0, 0, 620, 620); return; }
  const o = drawMon.tmp || (drawMon.tmp = document.createElement('canvas'));
  o.width = o.height = grid;
  const ox = o.getContext('2d'); ox.clearRect(0, 0, grid, grid); ox.imageSmoothingEnabled = true; ox.drawImage(img, 0, 0, grid, grid);
  x.imageSmoothingEnabled = false; x.drawImage(o, 0, 0, 620, 620);
}

function setCard(html) { const c = $('card'); if (c.dataset.h !== html) { c.innerHTML = html; c.dataset.h = html; } }

function renderAt(t) {
  const i = roundAt(t), q = Q[i], s = START[i], lt = t - s, mystery = !!q.mystery;
  const inSub = t >= START[1] + R - 0.3 && t < START[2] - 0.15;
  const inEnd = t >= END;

  // Background: the round's zone, panning slowly; a quick dip to black between rounds.
  document.querySelectorAll('.bg').forEach((d) => { d.style.display = d.id === 'bg-' + q.z ? 'block' : 'none'; });
  $('stage').style.background = GROUND[q.z];
  const bg = $('bg-' + q.z); bg.style.transform = 'translateX(' + (-996 + 150 - 300 * clamp(lt / 11)).toFixed(1) + 'px)';
  let dip = 0;
  for (let k = 1; k < START.length; k++) dip = Math.max(dip, 1 - Math.abs(t - (START[k] - 0.15)) / 0.22);
  $('fade').style.opacity = clamp(dip) + (inEnd ? 0.25 * seg(t, END, END + .4) : 0);

  // Ball: thrown in an arc, bounces on the platform, opens in a flash.
  const ball = $('ball'), ladd = lt;
  if (!inSub && !inEnd && ladd >= 0 && ladd < OPEN) {
    let x, y, r;
    if (ladd < 0.72) { const k = ladd / 0.72; x = lerp(120, 540, k); y = lerp(1990, 1250, k) - 820 * 4 * k * (1 - k); r = 900 * k; }
    else { const k = seg(ladd, 0.72, 1.0); x = 540; y = 1250 - 70 * Math.sin(Math.PI * k) * (1 - k * .3); r = 900 + 60 * Math.sin(ladd * 40) * seg(ladd, 1.0, OPEN); }
    ball.style.display = 'block'; ball.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + r + 'deg)';
  } else ball.style.display = 'none';
  const fk = seg(lt, OPEN, OPEN + 0.32);
  $('flash').style.opacity = !inSub && !inEnd && lt >= OPEN && fk < 1 ? (1 - fk).toFixed(3) : 0;
  $('flash').style.transform = 'scale(' + (1 + 26 * eOut(fk)) + ')';

  // The Pokémon: pixelated in 3 steps, then revealed (except the mystery one).
  const step = lt < STEP2 ? 0 : lt < STEP3 ? 1 : lt < REVEAL ? 2 : 3;
  const grids = mystery ? GRID_MYSTERY : GRID;
  const grid = step < 3 ? grids[step] : mystery ? grids[2] : 0;
  const mon = $('mon');
  const show = !inSub && !inEnd && lt >= OPEN;
  mon.style.display = show ? 'block' : 'none';
  if (show) {
    drawMon(IMG[q.id], grid);
    const ap = seg(lt, OPEN, OPEN + 0.32), out = mystery ? 0 : seg(lt, R - 0.32, R - 0.08);
    const pulse = [STEP2, STEP3, REVEAL].reduce((m, a) => Math.max(m, 1 - Math.abs(lt - a - .06) / .12), 0);
    const sc = (0.25 + 0.75 * eBack(ap)) * (1 + 0.05 * clamp(pulse)) * (1 - 0.15 * out);
    const bob = Math.sin(lt * 3.1) * 9, br = 1 + 4 * (1 - ap);
    mon.style.transform = 'translateY(' + bob.toFixed(1) + 'px) scale(' + sc.toFixed(4) + ',' + (sc * (1 + .012 * Math.sin(lt * 3.1))).toFixed(4) + ')';
    mon.style.filter = 'brightness(' + br.toFixed(2) + ') drop-shadow(0 16px 0 rgba(46,42,51,.25))';
    mon.style.opacity = (1 - out).toFixed(3);
  }

  // « ! » (or « ? » for the mystery) and the name.
  const bang = $('bang'), bk = lt - REVEAL;
  const bangOn = !inSub && !inEnd && bk >= 0 && (mystery ? t < CARD_M : bk < 1.1);
  bang.style.display = bangOn ? 'flex' : 'none';
  if (bangOn) { bang.textContent = mystery ? '?' : '!'; bang.style.transform = 'scale(' + (eBack(seg(bk, 0, .22)) * (1 - (mystery ? 0 : seg(bk, .9, 1.1)))).toFixed(3) + ')'; }
  const name = $('name'), nOn = !inSub && !inEnd && !mystery && bk >= 0.1 && lt < R - 0.08;
  name.style.display = nOn ? 'block' : 'none';
  if (nOn) { name.textContent = q.n; name.style.transform = 'scale(' + eBack(seg(bk, .1, .34)).toFixed(3) + ')'; name.style.opacity = 1 - seg(lt, R - .32, R - .08); }

  // Hook under the title at the very start.
  const hk = $('hook'), hOn = t < 3.4;
  hk.style.display = hOn ? 'block' : 'none';
  if (hOn) { hk.textContent = '6 Pokémon · compte tes points !'; hk.style.opacity = seg(t, 0.25, 0.5) * (1 - seg(t, 3.0, 3.4)); hk.style.transform = 'scale(' + eBack(seg(t, .25, .55)).toFixed(3) + ')'; }

  // HUD: number, bar running out, points.
  const hud = $('hud'); hud.style.display = inSub || inEnd ? 'none' : 'block';
  $('num').textContent = 'POKÉMON ' + (i + 1) + '/6';
  const fill = $('fill'), pts = $('pts');
  const left = 1 - seg(lt, OPEN, REVEAL);
  const col = step === 0 ? '#6BE05A' : step === 1 ? '#FFD45C' : '#FF5A48';
  fill.style.width = (left * 100).toFixed(2) + '%'; fill.style.background = col;
  pts.textContent = step === 0 ? '3 PTS' : step === 1 ? '2 PTS' : step === 2 ? '1 PT' : mystery ? '?' : '1 PT';
  pts.style.color = step === 3 && mystery ? '#fff' : col;
  pts.style.transform = 'scale(' + (1 + 0.25 * clamp(1 - Math.abs(lt - (step === 1 ? STEP2 : STEP3) - .08) / .16) * (step === 1 || step === 2 ? 1 : 0)).toFixed(3) + ')';

  // Title: hidden while a card covers the top.
  const card = $('card'), mCard = t >= CARD_M && t < END;
  $('title').style.display = mCard || inEnd || inSub ? 'none' : 'block';

  // Cards: « Abonne-toi » after round 2, the mystery question, the score scale at the end.
  let cOn = false, ck = 0, top = 300;
  if (inSub) {
    cOn = true; ck = seg(t, START[1] + R - 0.3, START[1] + R); top = 620;
    setCard('<div class="big">ABONNE-TOI</div><div class="mid">pour le prochain défi</div><div class="sm">Il reste 4 Pokémon, le dernier est un piège</div>');
  } else if (mCard) {
    cOn = true; ck = seg(t, CARD_M, CARD_M + .3); top = 110;
    setCard('<div class="big">LE N°6, PRESQUE<br>PERSONNE NE LE<br>TROUVE</div><div class="mid">Écris ta réponse en commentaire</div><div class="sm">' + HINT + ' · réponse demain<br>dans le commentaire épinglé</div>');
  } else if (inEnd) {
    cOn = true; ck = seg(t, END, END + .3); top = 230;
    setCard('<div class="big">TON SCORE<br>SUR 15 ?</div>' +
      '<div class="row"><span>Dresseur débutant</span><b>0-5</b></div>' +
      '<div class="row"><span>Champion d’arène</span><b>6-10</b></div>' +
      '<div class="row"><span>Maître de la Ligue</span><b>11-14</b></div>' +
      '<div class="row"><span>Tu triches ?</span><b>15</b></div>' +
      '<div class="mid">Écris ton score en commentaire</div>' +
      '<div class="big site">POKDLE.FR</div><div class="sm">Entraîne-toi sur le site · abonne-toi pour le prochain défi</div>');
    // Lines arrive one after the other so everyone can read them.
    Array.prototype.forEach.call(card.children, (n, k) => { const a = seg(t, END + .2 + k * .32, END + .45 + k * .32); n.style.opacity = a; n.style.transform = 'translateY(' + ((1 - eOut(a)) * 24).toFixed(1) + 'px)'; });
  }
  if (!inEnd) Array.prototype.forEach.call(card.children, (n) => { n.style.opacity = 1; n.style.transform = 'none'; });
  card.style.display = cOn ? 'block' : 'none';
  if (cOn) { card.style.top = top + 'px'; card.style.opacity = ck; card.style.transform = 'scale(' + (0.9 + 0.1 * eBack(ck)).toFixed(3) + ')'; }
}
