// « C'est qui ? » : 5 dessins éclatés d'une partie de « Dessine-le ! » entre potes (Party Room), 05/11/2026.
// L'écran est celui du site (pub/dessin.html, d'après App/party-room.css) : la carte des indices
// (« _ _ _ », « Type dans 30 s »), la planche en pointillés, le fil des réponses. Chaque dessin se retrace
// trait par trait (ordre calculé par pub/dessin-prep.py), les vraies mauvaises réponses du salon tombent
// (pseudos remplacés par « Joueur 1/2 »), puis la carte « C'ÉTAIT … » du site et l'artwork officiel avec
// son vrai cri. Le 5e (Luxray) reste un mystère. « PAGE=pub/dessin.html node render.js dessin ».
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eInOut = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eBack = (k, s = 1.9) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2));

// Seulement ce qu'on voit sur les captures de Kayan (docs/promo/dessine-le/) ; kayan = Joueur 1.
const D = [
  { n: 1, id: 522, name: 'Zébibron', found: 0, feed: [['Joueur 2', 'Zekrom'], ['Joueur 1', 'Raikou'], ['Joueur 2', 'Dynavolt'], ['Joueur 1', 'Galvagla']] },
  { n: 2, id: 951, name: 'Pimito', found: null, feed: [] },
  { n: 3, id: 890, name: 'Éthernatos', found: 2, feed: [], ok: 'Joueur 2' },
  { n: 4, id: 1008, name: 'Miraidon', found: 1, feed: [['Joueur 1', 'Ire-Foudre']] },
  { n: 5, id: 405, name: 'Luxray', mystery: true, feed: [] }
];
const R = 10.8, D0 = 0.3, D1 = 3.6, G1 = 7.6, START = D.map((_, k) => 0.2 + k * R);
const CARD_M = START[4] + G1 + 0.2, END = CARD_M + 4.8, TOTAL = END + 6.4;
var S = { audio: [], total: TOTAL };
const INK = {};

function load(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }
function pix(img) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); }

async function setup() {
  for (const d of D) {
    const ink = pix(await load('../assets/dessin/ink-' + d.n + '.png')), ord = pix(await load('../assets/dessin/order-' + d.n + '.png'));
    const o = new Uint8Array(ink.width * ink.height); for (let i = 0; i < o.length; i++) o[i] = ord.data[i * 4];
    INK[d.n] = { w: ink.width, h: ink.height, src: ink.data, ord: o, out: new ImageData(ink.width, ink.height), p: -1 };
    await load('../assets/art-' + d.id + '.png');
  }
  await document.fonts.ready;
  await Promise.all(['64px "Press Start 2P"', '700 52px Fredoka', '800 30px Nunito'].map((f) => document.fonts.load(f, 'ÉÀ!?')));
  const A = S.audio, go = (f, t, vol) => A.push({ file: 'assets/go-' + f + '.mp3', t: +t.toFixed(3), vol });
  A.push({ file: 'assets/sfx/ambience.wav', t: 0, vol: 0.35, bed: true });
  D.forEach((d, k) => {
    const s = START[k];
    A.push({ file: 'assets/sfx/timer4.wav', t: +(s + D1).toFixed(3), vol: 0.9 });
    d.feed.forEach((_, j) => go('caught', s + D1 + 0.5 + j * 0.75, 0.8));
    if (d.mystery) go('caught', s + G1, 0.9);
    else { go('appear', s + G1, 0.9); A.push({ file: 'assets/cry-' + d.id + '.ogg', t: +(s + G1 + 0.15).toFixed(3), vol: 1.5, cry: true }); }
  });
  renderAt(0);
  return TOTAL;
}

function html(id, h) { const e = $(id); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; } return e; }

function drawInk(d, p) {
  const I = INK[d.n], c = $('ink'), lim = Math.round(p * 255);
  if (c.width !== I.w || c.height !== I.h) { c.width = I.w; c.height = I.h; I.p = -1; }
  if (c.dataset.n !== String(d.n) || I.p !== lim) {
    const o = I.out.data, s = I.src;
    for (let i = 0; i < I.ord.length; i++) { const v = I.ord[i]; o[i * 4] = s[i * 4]; o[i * 4 + 1] = s[i * 4 + 1]; o[i * 4 + 2] = s[i * 4 + 2]; o[i * 4 + 3] = v && v <= lim ? 255 : 0; }
    c.getContext('2d').putImageData(I.out, 0, 0); I.p = lim; c.dataset.n = d.n;
  }
  const W = 916, H = 685, sc = Math.min((W - 40) / I.w, (H - 40) / I.h);
  c.style.width = I.w * sc + 'px'; c.style.height = I.h * sc + 'px';
  c.style.left = (W - I.w * sc) / 2 + 'px'; c.style.top = (H - I.h * sc) / 2 + 'px';
}

function renderAt(t) {
  let i = 0; for (let k = 0; k < START.length; k++) if (t >= START[k] - 0.15) i = k;
  const d = D[i], lt = t - START[i], mystery = !!d.mystery;
  const mCard = t >= CARD_M && t < END, inEnd = t >= END, rev = !mystery && lt >= G1;
  let dip = 0; for (let k = 1; k < START.length; k++) dip = Math.max(dip, 1 - Math.abs(t - (START[k] - 0.15)) / 0.22);
  $('fade').style.opacity = clamp(dip);

  html('title', rev ? 'C’ÉTAIT…' : mystery ? 'ET CELUI-LÀ ?' : 'C’EST QUI ?');
  html('hook', i === 0 ? 'Les dessins éclatés de mes potes' : 'Dessin n°' + (i + 1) + ' de mes potes');
  html('pill', 'Dessine-le ! · Manche ' + (i + 1) + '/5');

  // Top card: hints while guessing (as on the site), « C'ÉTAIT … » once revealed.
  const left = Math.max(0, Math.ceil(30 - (lt - D0) * 2.2)), leftG = Math.max(0, Math.ceil(50 - (lt - D0) * 2.2));
  html('top', rev
    ? '<img src="../assets/art-' + d.id + '.png"><div style="flex:1"><small>C’ÉTAIT</small><b>' + d.name + '</b></div>' + (d.found == null ? '' : '<span class="found">' + d.found + ' joueur' + (d.found > 1 ? 's ont' : ' a') + ' trouvé</span>')
    : '<span class="letters">' + d.name.replace(/./g, '_').split('').join(' ') + '</span><span class="chip">Type dans ' + left + ' s</span><span class="chip">Génération dans ' + leftG + ' s</span>');
  const tk = rev ? eBack(seg(lt, G1, G1 + 0.3)) : 1; $('top').style.transform = 'scale(' + (0.9 + 0.1 * tk) + ')';

  drawInk(d, rev || (mystery && lt > D1) ? 1 : eInOut(seg(lt, D0, D1)));
  const st = $('sticker'), sk = seg(lt, G1 + 0.2, G1 + 0.55);
  st.style.display = rev ? 'block' : 'none';
  if (rev) { $('art').src = '../assets/art-' + d.id + '.png'; st.style.transform = 'scale(' + (0.2 + 0.8 * eBack(sk)) + ') rotate(' + (-8 * (1 - sk)) + 'deg)'; st.style.opacity = sk > 0 ? 1 : 0; }

  // Answers feed, like the site (« Les réponses s'afficheront ici. »).
  const lines = d.feed.filter((_, j) => lt >= D1 + 0.5 + j * 0.75).map(([who, what]) => '<span>' + who + ' : ' + what + ' ✗</span>');
  if (d.ok && rev) lines.push('<span class="ok">🎉 ' + d.ok + ' a trouvé ! +100</span>');
  html('feed', lines.length ? lines.slice(-4).join('') : '<span class="muted">Les réponses s’afficheront ici.</span>');

  const vis = (id, disp) => { $(id).style.display = inEnd ? 'none' : disp; };
  vis('title', 'block'); vis('hook', 'block'); vis('pill', 'flex'); vis('top', 'flex'); vis('board', 'block'); vis('feed', 'flex'); vis('hud', 'block');

  // HUD under the screen: the clock while guessing.
  html('num', 'DESSIN ' + (i + 1) + '/5');
  const rest = 1 - seg(lt, D1, G1), step = rest > 0.66 ? 0 : rest > 0.33 ? 1 : 2, col = ['#6BE05A', '#FFD45C', '#FF5A48'][step];
  $('fill').style.width = (lt < D1 ? 100 : lt >= G1 ? 0 : rest * 100).toFixed(2) + '%'; $('fill').style.background = col;
  const pts = $('pts');
  if (lt < D1) { pts.textContent = 'ÇA DESSINE…'; pts.style.color = '#fff'; }
  else if (lt < G1) { pts.textContent = String(Math.max(1, Math.ceil((G1 - lt) / ((G1 - D1) / 3)))); pts.style.color = col; }
  else { pts.textContent = mystery ? 'À TOI ?' : d.name.toUpperCase(); pts.style.color = mystery ? '#fff' : '#6BE05A'; }

  // Cards: the mystery (over the answers), then the end.
  const card = $('card'); let on = false, ck = 0;
  if (mCard) {
    on = true; ck = seg(t, CARD_M, CARD_M + .3); card.style.top = '1260px';
    html('card', '<div class="big">C’EST QUEL<br>POKÉMON ?</div><div class="mid">Réponds en commentaire</div><div class="sm">Réponse demain dans le commentaire épinglé</div>');
    $('hud').style.display = 'none';
  } else if (inEnd) {
    on = true; ck = seg(t, END, END + .3); card.style.top = '380px';
    html('card', '<div class="big">DESSINE AVEC<br>TES POTES</div><div class="mid">Party Room · Dessine-le !</div><div class="sm">Un dessine, les autres devinent.<br>Gratuit, sur téléphone et PC</div><div class="big site">POKDLE.FR</div><div class="sm">Abonne-toi pour les prochains dessins</div>');
    Array.prototype.forEach.call(card.children, (n, k) => { const a = seg(t, END + .2 + k * .35, END + .45 + k * .35); n.style.opacity = a; n.style.transform = 'translateY(' + ((1 - eOut(a)) * 24).toFixed(1) + 'px)'; });
  }
  if (!inEnd) Array.prototype.forEach.call(card.children, (n) => { n.style.opacity = 1; n.style.transform = 'none'; });
  card.style.display = on ? 'block' : 'none';
  if (on) { card.style.opacity = ck; card.style.transform = 'scale(' + (0.9 + 0.1 * eBack(ck)).toFixed(3) + ')'; }
}
