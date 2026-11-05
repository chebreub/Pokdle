// « C'est qui ? » : 5 vrais dessins ratés de « Dessine-le ! » (Party Room), 05/11/2026, ~60 s, vertical.
// Chaque dessin se retrace trait par trait (ordre calculé par pub/dessin-prep.py), le chrono tourne, les
// vraies mauvaises réponses du salon tombent (pseudos masqués), puis la révélation : le dessin à côté de
// l'artwork officiel, avec le vrai cri. Le 5e (Luxray) reste un mystère : « réponds en commentaire ».
// « PAGE=pub/dessin.html node render.js dessin ». Chaque image est une fonction pure de t.
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eInOut = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eBack = (k, s = 1.9) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2));

// Réponses du salon : seulement celles qu'on voit sur les captures de Kayan (docs/promo/dessine-le/).
const D = [
  { n: 1, id: 522, name: 'ZÉBIBRON', found: '0 joueur l’a trouvé', chat: ['Zekrom', 'Raikou', 'Dynavolt', 'Galvagla'] },
  { n: 2, id: 921, name: 'PIMITO', found: '', chat: [] },
  { n: 3, id: 890, name: 'ÉTHERNATOS', found: '2 joueurs l’ont trouvé', chat: [] },
  { n: 4, id: 1008, name: 'MIRAIDON', found: '1 joueur l’a trouvé', chat: ['Ire-Foudre'] },
  { n: 5, id: 405, name: '???', mystery: true }
];
const R = 10.8, D0 = 0.3, D1 = 3.6, G1 = 7.6, START = D.map((_, k) => 0.2 + k * R);
const CARD_M = START[4] + G1 + 0.2, END = CARD_M + 4.8, TOTAL = END + 6.4;
var S = { audio: [], total: TOTAL };
const INK = {};
const FULL = { x: 60, y: 400, w: 960, h: 720 }, LEFT = { x: 40, y: 430, w: 490, h: 620 }, RIGHT = { x: 550, y: 430, w: 490, h: 620 };

function load(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }
function pix(img) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); }

async function setup() {
  for (const d of D) {
    const ink = pix(await load('../assets/dessin/ink-' + d.n + '.png')), ord = pix(await load('../assets/dessin/order-' + d.n + '.png'));
    const o = new Uint8Array(ink.width * ink.height); for (let i = 0; i < o.length; i++) o[i] = ord.data[i * 4];
    INK[d.n] = { w: ink.width, h: ink.height, src: ink.data, ord: o, out: new ImageData(ink.width, ink.height), p: -1 };
    await load('../assets/art-' + d.id + '.png');
  }
  const bg = document.createElement('div'); bg.className = 'bg'; bg.style.backgroundImage = 'url(../assets/zone-prairie.png)'; $('bgs').appendChild(bg);
  await document.fonts.ready;
  await Promise.all(['66px "Press Start 2P"', '700 52px Fredoka', '600 42px Fredoka'].map((f) => document.fonts.load(f, 'ÉÀ!?')));
  const A = S.audio, go = (f, t, vol) => A.push({ file: 'assets/go-' + f + '.mp3', t: +t.toFixed(3), vol });
  A.push({ file: 'assets/sfx/ambience.wav', t: 0, vol: 0.35, bed: true });
  D.forEach((d, k) => {
    const s = START[k];
    A.push({ file: 'assets/sfx/timer4.wav', t: +(s + D1).toFixed(3), vol: 0.9 });
    d.chat && d.chat.forEach((_, j) => go('caught', s + D1 + 0.5 + j * 0.75, 0.8));
    if (d.mystery) go('caught', s + G1, 0.9);
    else { go('appear', s + G1, 0.9); A.push({ file: 'assets/cry-' + d.id + '.ogg', t: +(s + G1 + 0.15).toFixed(3), vol: 1.5, cry: true }); }
  });
  renderAt(0);
  return TOTAL;
}

function box(el, r) { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; }
function mix(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) }; }
function setCard(html) { const c = $('card'); if (c.dataset.h !== html) { c.innerHTML = html; c.dataset.h = html; } }

function drawInk(d, p, r) {
  const I = INK[d.n], c = $('ink'), lim = Math.round(p * 255);
  if (c.width !== I.w || c.height !== I.h) { c.width = I.w; c.height = I.h; I.p = -1; }
  if (c.dataset.n !== String(d.n) || I.p !== lim) {
    const o = I.out.data, s = I.src;
    for (let i = 0; i < I.ord.length; i++) { const v = I.ord[i], on = v && v <= lim; o[i * 4] = s[i * 4]; o[i * 4 + 1] = s[i * 4 + 1]; o[i * 4 + 2] = s[i * 4 + 2]; o[i * 4 + 3] = on ? 255 : 0; }
    c.getContext('2d').putImageData(I.out, 0, 0); I.p = lim; c.dataset.n = d.n;
  }
  // Fit the drawing inside the paper with a margin.
  const sc = Math.min((r.w - 60) / I.w, (r.h - 60) / I.h);
  c.style.width = I.w * sc + 'px'; c.style.height = I.h * sc + 'px';
  c.style.left = (r.w - 18 - I.w * sc) / 2 + 'px'; c.style.top = (r.h - 18 - I.h * sc) / 2 + 'px';
}

function renderAt(t) {
  let i = 0; for (let k = 0; k < START.length; k++) if (t >= START[k] - 0.15) i = k;
  const d = D[i], lt = t - START[i], mystery = !!d.mystery;
  const mCard = t >= CARD_M && t < END, inEnd = t >= END;
  const rev = !mystery && lt >= G1, sp = rev ? eInOut(seg(lt, G1, G1 + 0.45)) : 0;
  let dip = 0; for (let k = 1; k < START.length; k++) dip = Math.max(dip, 1 - Math.abs(t - (START[k] - 0.15)) / 0.22);
  $('fade').style.opacity = clamp(dip) + (inEnd ? 0.2 * seg(t, END, END + .4) : 0);
  document.querySelector('.bg').style.transform = 'translateX(' + (-996 + 150 - 300 * clamp(t / TOTAL)).toFixed(1) + 'px)';

  const title = $('title'); title.style.display = mCard || inEnd ? 'none' : 'block'; title.style.top = '140px';
  title.innerHTML = rev ? 'C’ÉTAIT…' : mystery ? 'ET CELUI-LÀ ?' : 'C’EST QUI ?';
  const hk = $('hook'); hk.style.display = mCard || inEnd || rev ? 'none' : 'block';
  hk.textContent = i === 0 ? 'Un vrai dessin de nos joueurs' : 'Dessin n°' + (i + 1) + ' de nos joueurs';
  hk.style.opacity = seg(lt, 0, 0.3); hk.style.top = '262px'; hk.style.fontSize = '54px';

  // Paper: full while drawing, then slides to the left half; artwork comes in on the right.
  const paper = $('paper'), artc = $('artc');
  paper.style.display = inEnd ? 'none' : 'block';
  const pr = mix(FULL, LEFT, sp); box(paper, pr);
  drawInk(d, rev || mystery && lt > D1 ? 1 : eInOut(seg(lt, D0, D1)), pr);
  paper.style.transform = 'scale(' + (1 - 0.06 * (1 - eBack(seg(lt, 0, 0.3)))) + ')';
  artc.style.display = rev && !inEnd ? 'block' : 'none';
  if (rev) {
    box(artc, RIGHT); $('art').src = '../assets/art-' + d.id + '.png';
    const k = seg(lt, G1 + 0.25, G1 + 0.6); artc.style.transform = 'scale(' + (0.3 + 0.7 * eBack(k)) + ')'; artc.style.opacity = k > 0 ? 1 : 0;
    const f = 1 - seg(lt, R - 0.32, R - 0.08); paper.style.opacity = artc.style.opacity = f;
  } else paper.style.opacity = 1;
  const l1 = $('lab1'), l2 = $('lab2'), fd = $('found');
  l1.style.display = l2.style.display = fd.style.display = rev && !inEnd ? 'block' : 'none';
  if (rev) {
    const k = seg(lt, G1 + 0.5, G1 + 0.8);
    l1.style.left = '40px'; l2.style.left = '550px'; l1.style.top = '1080px'; l2.style.top = '1088px';
    l2.textContent = d.name; l1.style.opacity = l2.style.opacity = k * (1 - seg(lt, R - .32, R - .08));
    l2.style.transform = 'scale(' + eBack(k) + ')';
    fd.textContent = d.found ? d.found + ' · tu l’avais ?' : 'Tu l’avais ?'; fd.style.opacity = seg(lt, G1 + 0.9, G1 + 1.2) * (1 - seg(lt, R - .32, R - .08));
  }

  // The room's wrong answers fall in one by one while the clock runs.
  const chat = $('chat'); const msgs = (!rev && !inEnd && d.chat) ? d.chat : [];
  if (chat.dataset.n !== String(d.n) + msgs.length) { chat.innerHTML = msgs.map((m) => '<div class="msg">' + m + '<b>✗</b></div>').join(''); chat.dataset.n = String(d.n) + msgs.length; }
  Array.prototype.forEach.call(chat.children, (m, j) => {
    const k = seg(lt, D1 + 0.5 + j * 0.75, D1 + 0.75 + j * 0.75);
    m.style.top = (j * 104 - 60 * (1 - eOut(k))) + 'px'; m.style.opacity = k;
  });

  // HUD.
  $('hud').style.display = inEnd ? 'none' : 'block';
  $('num').textContent = 'DESSIN ' + (i + 1) + '/5';
  const left = 1 - seg(lt, D1, G1), step = left > 0.66 ? 0 : left > 0.33 ? 1 : 2, col = ['#6BE05A', '#FFD45C', '#FF5A48'][step];
  $('fill').style.width = (lt < D1 ? 100 : rev || mystery && lt >= G1 ? 0 : left * 100).toFixed(2) + '%'; $('fill').style.background = col;
  const pts = $('pts');
  if (lt < D1) { pts.textContent = 'ÇA DESSINE…'; pts.style.color = '#fff'; }
  else if (lt < G1) { pts.textContent = String(Math.max(1, Math.ceil((G1 - lt) / ((G1 - D1) / 3)))); pts.style.color = col; }
  else { pts.textContent = mystery ? 'À TOI ?' : d.name; pts.style.color = mystery ? '#fff' : '#6BE05A'; }

  // Cards: the mystery, then the end.
  const card = $('card'); let cOn = false, ck = 0, top = 300;
  if (mCard) {
    cOn = true; ck = seg(t, CARD_M, CARD_M + .3); top = 1150;
    setCard('<div class="big">C’EST QUEL<br>POKÉMON ?</div><div class="mid">Réponds en commentaire</div><div class="sm">Réponse demain dans le commentaire épinglé</div>');
  } else if (inEnd) {
    cOn = true; ck = seg(t, END, END + .3); top = 380;
    setCard('<div class="big">DESSINE AVEC<br>TES POTES</div><div class="mid">Party Room · Dessine-le !</div><div class="sm">Un dessine, les autres devinent.<br>Gratuit, sur téléphone et PC</div><div class="big site">POKDLE.FR</div><div class="sm">Abonne-toi pour les prochains dessins</div>');
    Array.prototype.forEach.call(card.children, (n, k) => { const a = seg(t, END + .2 + k * .35, END + .45 + k * .35); n.style.opacity = a; n.style.transform = 'translateY(' + ((1 - eOut(a)) * 24).toFixed(1) + 'px)'; });
  }
  if (!inEnd) Array.prototype.forEach.call(card.children, (n) => { n.style.opacity = 1; n.style.transform = 'none'; });
  card.style.display = cOn ? 'block' : 'none';
  if (cOn) { card.style.top = top + 'px'; card.style.opacity = ck; card.style.transform = 'scale(' + (0.9 + 0.1 * eBack(ck)).toFixed(3) + ')'; }
  if (mCard) $('hud').style.display = 'none';
}
