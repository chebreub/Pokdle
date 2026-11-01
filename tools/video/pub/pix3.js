// « 3 Pokémon pixelisés, le 3e presque personne ne le trouve » (01/11/2026, ~28 s, vertical).
// Hook, then three real games of the pixel mode (Absol on a phone, Trousselin on a PC, Dodoala on a
// phone), each answer bursting out of the screen; the 3rd stays a mystery: « Écris ta réponse en com ».
// Every frame is a pure function of t (same toolkit as pub.js).
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eOut5 = (k) => 1 - Math.pow(1 - k, 5);
const eIn = (k) => k * k * k;
const eInOut = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eBack = (k, s = 1.9) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const spring = (k, f = 11, d = 6) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.exp(-d * k) * Math.cos(f * k));
const noise = (x) => Math.sin(x * 12.9898) * Math.sin(x * 4.1414 + 1.3) * Math.cos(x * 7.233);
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const el = (tag, cls, parent, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; parent.appendChild(d); return d; };
const vis = (node, on) => { node.style.visibility = on ? 'visible' : 'hidden'; return on; };
var S = { audio: [], total: 32.25 };
const IDX = {};

// ---- timeline (output seconds). Each game: [output t, footage t] keys, real time between them.
const KA = [[3.05, 1.3], [5.25, 3.5], [6.05, 4.3], [6.75, 5.8], [8.2, 7.25], [10.0, 9.05]];
const KB = [[10.25, 1.3], [12.25, 3.3], [12.95, 4.0], [13.65, 5.65], [15.95, 7.95], [17.7, 9.7]];
const KC = [[17.95, 1.3], [19.97, 3.32], [20.97, 4.32]];
// The last mystery: a slow 3-2-1, then the question, the clue and « tomorrow » one after the other, and
// the whole screen stays about 4 s so everyone can read it (feedback of 01/11).
const WIN_A = 8.23, WIN_B = 16.0, FREEZE = 21.2, CD = [21.55, 22.2, 22.85], TOI = 23.5, W2 = 28.7;
function mapF(K, t) { if (t <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], seg(t, K[i][0], K[i + 1][0])); const l = K[K.length - 1]; return l[1] + (t - l[0]); }
function mapOut(K, f) { if (f < K[0][1]) return null; for (let i = 0; i < K.length - 1; i++) if (f <= K[i + 1][1]) return lerp(K[i][0], K[i + 1][0], (f - K[i][1]) / (K[i + 1][1] - K[i][1])); const l = K[K.length - 1]; return l[0] + (f - l[1]); }

// ---- footage
function frameAt(name, ts) { const f = IDX[name].frames; ts = clamp(ts, 0, IDX[name].duration - .05); let lo = 0, hi = f.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (f[m].t <= ts) lo = m; else hi = m - 1; } return '../raw/' + name + '/' + f[lo].file; }
function rectAt(name, sel, ts) { let r = null; for (const s of IDX[name].rects) { if (s.t > ts) break; const v = s.r[sel]; if (v && v[2] > 0) r = v; } return r; }
function evAt(name, type, n = 0) { return IDX[name].events.filter((e) => e.type === type)[n].t; }

// ---- devices
function phone(parent) {
  const p = { el: el('div', 'phone', parent) };
  p.screen = el('div', 'screen', p.el);
  el('div', 'status', p.screen, '<b>9:41</b><i></i>');
  p.img = el('img', '', p.screen); p.marker = el('div', 'marker', p.screen); p.glass = el('div', 'glass', p.screen);
  el('div', 'notch', p.el);
  return p;
}
function place(p, { cx = 540, cy = 1069, s = 1, rx = 0, ry = 0, rz = 0, z = 0, o = 1, dim = 0 }) {
  p.el.style.left = cx - 320 + 'px'; p.el.style.top = cy - 669 + 'px';
  p.el.style.transform = `translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
  p.el.style.opacity = o; p.screen.style.filter = dim ? `brightness(${1 - dim * .2}) saturate(${1 - dim * .3})` : 'none';
}
function laptop(parent) {
  const p = { el: el('div', 'laptop', parent) };
  p.screen = el('div', 'lscreen', p.el);
  el('div', 'lbar', p.screen, '<i style="left:18px;background:#E8453C"></i><i style="left:40px;background:#FFD45C"></i><i style="left:62px;background:#5DBE7E"></i><b>🔒 pokdle.fr</b>');
  p.img = el('img', '', p.screen); p.marker = el('div', 'marker', p.screen); el('div', 'lbase', p.el);
  return p;
}
function placeL(p, { cx = 540, cy = 840, s = 1, rx = 0, ry = 0, rz = 0, o = 1, dim = 0 }) {
  p.el.style.left = cx - 500 + 'px'; p.el.style.top = cy - 340 + 'px';
  p.el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
  p.el.style.opacity = o; p.screen.style.filter = dim ? `brightness(${1 - dim * .2}) saturate(${1 - dim * .3})` : 'none';
}
function show(p, name, ts) { const f = frameAt(name, ts); if (p.img.getAttribute('src') !== f) p.img.src = f; }
const SC = 600 / 390, BAR = 66, LSC = 960 / 1920, LBAR = 44;
function markerBox(p, r) { p.marker.style.cssText = `left:${r[0] * SC}px;top:${r[1] * SC + BAR}px;width:${r[2] * SC}px;height:${r[3] * SC}px`; return p.marker.getBoundingClientRect(); }
function markerBoxL(p, r) { p.marker.style.cssText = `left:${r[0] * LSC}px;top:${r[1] * LSC + LBAR}px;width:${r[2] * LSC}px;height:${r[3] * LSC}px`; return p.marker.getBoundingClientRect(); }

// ---- kinetic text
function W(parent, html, { size, color = '#2E2A33', y, echoes = 2 }) {
  const d = el('div', 'w', parent);
  d.style.cssText += `font-size:${size}px;color:${color};top:${y}px`;
  d.echo = []; for (let i = 0; i < echoes; i++) d.echo.push(el('div', 'e', d, html));
  el('span', '', d, html); return d;
}
function slam(d, t, t0, { from = 2.4, dur = .26, rot = 0, out = 1e9 } = {}) {
  const k = seg(t, t0, t0 + dur), u = t - t0 - dur, x = eIn(seg(t, out, out + .25));
  const hit = u > 0 ? .06 * Math.exp(-u * 9) * Math.cos(u * 30) : 0;
  d.style.opacity = clamp(k * 4) * (1 - x);
  d.style.filter = k > 0 && k < 1 ? `blur(${(1 - k) * 14}px)` : 'none';
  d.style.transform = `translateY(${-x * 60}px) scale(${lerp(from, 1, eOut5(k)) * (1 + hit)}) rotate(${rot}deg)`;
  (d.echo || []).forEach((e, i) => { const q = seg(t, t0 + dur + i * .07, t0 + dur + .6 + i * .07); e.style.opacity = q > 0 && q < 1 ? (1 - q) * .7 : 0; e.style.transform = `scale(${1 + eOut(q) * (.14 + i * .1)})`; });
}
function pop(d, t, t0, { dy = 70, dur = .5, rot = 0, out = 1e9 } = {}) {
  const k = seg(t, t0, t0 + dur), x = eIn(seg(t, out, out + .25));
  d.style.opacity = clamp(k * 3) * (1 - x);
  d.style.transform = `translateY(${(1 - eOut(k)) * dy - x * 60}px) scale(${lerp(.4, 1, spring(k))}) rotate(${rot}deg)`;
  (d.echo || []).forEach((e) => (e.style.opacity = 0));
}
function capLine(parent, text, y, color = '#2E2A33', size = 92) {
  const box = el('div', '', parent); box.style.cssText = `position:absolute;left:0;right:0;top:${y}px;text-align:center`;
  return text.split(' ').map((w) => { const s = el('span', 'cw', box, w); s.style.color = color; s.style.fontSize = size + 'px'; return s; });
}
function capAnim(words, t, t0, out = 1e9) {
  words.forEach((w, i) => { const k = seg(t, t0 + i * .1, t0 + .5 + i * .1), x = eIn(seg(t, out + i * .04, out + .25 + i * .04)); w.style.opacity = clamp(k * 3) * (1 - x); w.style.transform = `translateY(${(1 - eOut(k)) * 60 - x * 70}px) scale(${lerp(.5, 1, spring(k))})`; w.style.display = t > out + .4 || t < t0 - .05 ? 'none' : 'inline-block'; });
}
// a chip centred on (x, y)
function chipAt(c, x, y, s, rot, o) { const w = c.offsetWidth, h = c.offsetHeight; c.style.opacity = o; c.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) scale(${s}) rotate(${rot}deg)`; }
function confetti(parent, n, seed) { const r = rnd(seed), cols = ['#FFD45C', '#7C5BD6', '#4069E0', '#5DBE7E', '#E8453C', '#FF8FC1']; return Array.from({ length: n }, () => { const d = el('div', 'conf', parent); d.style.background = cols[Math.floor(r() * cols.length)]; return { d, a: r() * Math.PI * 2, v: 700 + r() * 900, spin: (r() - .5) * 1400, g: 1400 + r() * 600 }; }); }
function burst(list, t, t0, cx, cy) { list.forEach((c) => { const u = t - t0; if (u < 0 || u > 1.6) { c.d.style.opacity = 0; return; } const x = cx + Math.cos(c.a) * c.v * u, y = cy + Math.sin(c.a) * c.v * u * .8 + c.g * u * u * .5; c.d.style.opacity = 1 - seg(u, 1.1, 1.6); c.d.style.transform = `translate(${x}px,${y}px) rotate(${c.spin * u}deg)`; }); }

const CSS = `
.chip{position:absolute;left:0;top:0;padding:16px 34px;border-radius:999px;font:800 48px Nunito;white-space:nowrap;box-shadow:0 14px 34px rgba(46,42,51,.25)}
.bar{position:absolute;left:190px;width:700px;height:24px;border-radius:12px;background:rgba(46,42,51,.12);overflow:hidden}
.bar i{display:block;height:100%;border-radius:12px;background:#4069E0}
.sq{position:absolute;left:0;top:0;width:70px;height:70px;border-radius:12px}
.thumb{position:absolute;left:0;top:0;width:270px;height:270px;border-radius:40px;background:#fff;border:7px solid #2E2A33;box-shadow:0 22px 0 rgba(46,42,51,.18);overflow:hidden}
.thumb img{position:absolute;inset:18px;width:220px;height:220px;image-rendering:pixelated}
.tnum{position:absolute;left:0;top:0;width:270px;text-align:center;font:700 64px Fredoka;color:#2E2A33}
#cd{position:absolute;left:0;top:0;width:300px;height:300px;border-radius:50%;background:#FFD45C;color:#2E2A33;font:700 210px/300px Fredoka;text-align:center;box-shadow:0 20px 0 #d9a92a}
#qmark{position:absolute;left:0;top:0;font:700 520px/1 Fredoka;color:#FFD45C;-webkit-text-stroke:26px #2E2A33;paint-order:stroke fill}
.big{position:absolute;left:0;right:0;text-align:center;font:700 112px/1.08 Fredoka;color:#fff;white-space:nowrap}
`;

const N = {};
function build() {
  el('style', '', document.head, CSS);
  // hook: pixel squares, the three mysteries, the promise
  const r = rnd(11), cols = ['#FFD45C', '#7C5BD6', '#4069E0', '#5DBE7E', '#E8453C', '#FF8FC1', '#2E2A33'];
  N.sq = Array.from({ length: 34 }, (_, i) => { const d = el('div', 'sq', $('ring')); d.style.background = cols[i % cols.length]; return { d, x: r() * 1080, y: r() * 1920, s: .5 + r() * 1.1, k: r() * .9, sp: .4 + r() * .8, rot: (r() - .5) * 40 }; });
  N.w1 = W($('words'), '3 POKÉMON', { size: 150, y: 330 });
  N.w2 = W($('words'), 'PIXELISÉS', { size: 178, y: 490, color: '#4069E0' });
  N.thumbs = ['a', 'b', 'c'].map((k, i) => { const d = el('div', 'thumb', $('words')); el('img', '', d).src = '../assets/pix3-thumb-' + k + '.png'; const n = el('div', 'tnum', $('words'), ['N°1', 'N°2', 'N°3 💀'][i]); return { d, n }; });
  N.promise = el('div', 'lab', $('words'), 'Le 3e, presque personne ne le trouve 👀'); N.promise.style.cssText += 'background:#7C5BD6;color:#fff;font-size:50px';
  // the three games
  N.g = [
    { box: $('s2'), name: 'pix3-a', K: KA, win: WIN_A, art: 359, label: 'N°1 · 😏 Moyen', col: '#4069E0', cap: 'Tu le reconnais ?', wrong: 'Mangriff', stamp: 'ABSOL', dev: 'phone', t0: 2.95, t1: 10.05 },
    { box: $('s3'), name: 'pix3-b', K: KB, win: WIN_B, art: 707, label: 'N°2 · 😬 Difficile', col: '#E8453C', cap: 'Et sur PC ?', wrong: 'Magnéti', stamp: 'TROUSSELIN', dev: 'laptop', t0: 9.95, t1: 17.75 },
    { box: $('s4'), name: 'pix3-c', K: KC, win: null, art: 0, label: 'N°3 · 💀 Très difficile', col: '#2E2A33', cap: 'Le dernier…', wrong: 'Ronflex', stamp: '', dev: 'phone', t0: 17.65, t1: W2 + .5 },
  ];
  N.g.forEach((g, i) => {
    g.rays = el('div', 'rays', g.box); g.rays.style.cssText = 'position:absolute;width:2200px;height:2200px;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,212,92,.55) 0 8deg,rgba(255,212,92,0) 8deg 20deg);-webkit-mask:radial-gradient(circle,#000 0,#000 22%,transparent 64%);opacity:0';
    g.d = g.dev === 'phone' ? phone(g.box) : laptop(g.box);
    g.lab = el('div', 'lab', g.box, g.label); g.lab.style.cssText += `background:${g.col};color:#fff`;
    g.bar = el('div', 'bar', g.box, '<i></i>'); g.bar.style.top = '290px';
    g.cap = capLine(g.box, g.cap, 370);
    g.x = el('div', 'chip', g.box, '✗ ' + g.wrong); g.x.style.cssText += 'background:#fff;color:#C7423A;border:5px solid #C7423A';
    g.lv = el('div', 'chip', g.box, '🔍 Plus net · 2/8'); g.lv.style.cssText += 'background:#2E2A33;color:#fff';
    if (g.art) { g.artEl = el('img', 'bigart', g.box); g.artEl.src = '../assets/art-' + g.art + '.png'; g.st = el('div', 'stamp', g.box, g.stamp); g.st.style.top = '1500px'; g.conf = confetti(g.box, 44, 7 + i * 9); }
  });
  // the 3rd stays a mystery
  const c = N.g[2];
  N.card = el('div', 'thumb', c.box); el('img', '', N.card).src = '../assets/pix3-thumb-c2.png'; N.card.style.background = '#fff';
  N.cd = el('div', '', c.box, '3'); N.cd.id = 'cd';
  N.q = el('div', '', c.box, '?'); N.q.id = 'qmark';
  N.toi = W(c.box, 'À TOI !', { size: 190, y: 250, color: '#FFD45C' });
  N.ask1 = el('div', 'big', c.box, '✍️ Écris ta réponse'); N.ask1.style.top = '1430px';
  N.ask2 = el('div', 'big', c.box, 'en commentaire 👇'); N.ask2.style.top = '1555px';
  N.hint = el('div', 'chip', c.box, 'Indice : type Normal'); N.hint.style.cssText += 'background:#7C5BD6;color:#fff';
  N.tom = el('div', 'chip', c.box, 'Réponse demain en commentaire épinglé 📌'); N.tom.style.cssText += 'background:#FFF8EF;color:#2E2A33;font-size:38px';
  // end card
  N.lap5 = laptop($('s5')); N.ph5 = phone($('s5'));
  N.logo = el('img', '', $('s5')); N.logo.id = 'logo'; N.logo.src = '../assets/favicon.svg';
  N.e0 = el('div', 'endl', $('s5'), 'Entraîne-toi sur'); N.e0.style.cssText += 'top:760px;font-size:64px';
  N.epill = el('div', '', $('s5'), 'pokdle.fr<i></i>'); N.epill.id = 'epill';
  N.e1 = el('div', 'endl', $('s5'), 'Gratuit · sans pub · sans compte'); N.e1.style.top = '1110px';
  N.e2 = el('div', '', $('s5'), '🔔 Abonne-toi pour le prochain défi'); N.e2.id = 'sub2';
}

function renderBg(t) {
  $('pat').style.transform = `rotate(-12deg) translate(${(t * 26) % 200}px, ${(t * 40) % 200}px)`;
  $('b1').style.transform = `translate(${-200 + Math.sin(t * .5) * 160}px, ${120 + Math.cos(t * .4) * 140}px)`;
  $('b2').style.transform = `translate(${600 + Math.cos(t * .45) * 150}px, ${820 + Math.sin(t * .35) * 200}px)`;
  $('b3').style.transform = `translate(${300 + Math.sin(t * .38 + 2) * 230}px, ${1400 + Math.cos(t * .42) * 130}px)`;
  // the last mystery: the room goes dark
  const dark = eInOut(seg(t, FREEZE, FREEZE + .5)) * (1 - seg(t, W2 + .45, W2 + .5));
  $('bg').style.background = `color-mix(in srgb, #2E2A33 ${dark * 100}%, #FFF8EF)`;
  $('pat').style.opacity = lerp(.06, .03, dark);
  ['b1', 'b2', 'b3'].forEach((id) => ($(id).style.opacity = 1 - dark * .75));
}

function renderHook(t) {
  if (!vis($('hook'), t < 2.95)) return;
  N.sq.forEach((q, i) => {
    const k = spring(seg(t, .05 + q.k * .5, .65 + q.k * .5)), y = q.y - t * 120 * q.sp;
    q.d.style.opacity = clamp(k * 2) * .85;
    q.d.style.transform = `translate(${q.x - 35}px, ${((y % 2000) + 2000) % 2000 - 80}px) scale(${q.s * k}) rotate(${q.rot + t * 30 * (i % 2 ? 1 : -1)}deg)`;
  });
  pop(N.w1, t, .08);
  slam(N.w2, t, .42, { rot: -3 });
  N.thumbs.forEach((th, i) => {
    const k = seg(t, .95 + i * .17, 1.55 + i * .17), x = 540 + (i - 1) * 330, y = 1000 + Math.sin(t * 2.2 + i) * 10;
    const shake = i === 2 && t > 1.6 ? 8 * Math.sin(t * 40) * Math.exp(-(t - 1.6) * 3) : 0;
    th.d.style.opacity = th.n.style.opacity = clamp(k * 3);
    th.d.style.transform = `translate(${x - 135 + shake}px, ${y - 135 + (1 - eOut(k)) * 120}px) scale(${lerp(.3, 1, spring(k))}) rotate(${(i - 1) * 5}deg)`;
    th.n.style.transform = `translate(${x - 135}px, ${y + 160 + (1 - eOut(k)) * 80}px) scale(${lerp(.5, 1, spring(k))})`;
  });
  const kp = seg(t, 1.6, 2.1); chipAt(N.promise, 540, 1470, lerp(.4, 1, spring(kp)) * (1 + .03 * Math.sin(t * 6) * seg(t, 2.1, 2.4)), -2, clamp(kp * 3));
  const sh = t > .66 ? 12 * Math.exp(-(t - .66) * 7) : 0;
  $('words').style.transform = `translate(${sh * noise(t * 40)}px, ${sh * noise(t * 37 + 9)}px)`;
}

function renderWipe(t) {
  const t0 = t < 10 ? 2.42 : W2;
  if (!vis($('wipe'), t > t0 && t < t0 + 1.18)) return;
  const kin = seg(t, t0, t0 + .48), kopen = seg(t, t0 + .66, t0 + 1.1);
  $('ball').style.transform = `translateY(${(1 - eOut(kin)) * 700}px) scale(${lerp(.03, 1, eOut5(kin))}) rotate(${lerp(-480, 0, eOut5(kin))}deg)`;
  const o = eInOut(kopen) * 1500;
  $('top').style.transform = `translateY(${-o}px) rotate(${-eInOut(kopen) * 8}deg)`;
  $('bot').style.transform = `translateY(${o}px) rotate(${eInOut(kopen) * 8}deg)`;
  const pulse = Math.sin(seg(t, t0 + .48, t0 + .66) * Math.PI);
  $('btn').style.transform = `scale(${(1 + pulse * .18) * (1 - eIn(seg(t, t0 + .66, t0 + .88)))})`;
  $('btn').style.boxShadow = `0 0 ${pulse * 120}px ${pulse * 40}px rgba(255,255,255,${pulse * .9})`;
}
const BANDS = [9.6, 17.3];
function renderBands(t) {
  const b = BANDS.find((x) => t > x - .05 && t < x + 1.05);
  if (!vis($('bands'), b !== undefined)) return;
  ['bd1', 'bd2', 'bd3'].forEach((id, i) => { const x = lerp(-2500, 1700, eInOut(seg(t, b + i * .09, b + .82 + i * .09))); $(id).style.cssText += `left:0;top:-300px;width:2000px;height:2600px;transform:translateX(${x}px) skewX(-12deg)`; });
}

// one game: device, label, timer, wrong guess, sharper image, answer
function renderGame(g, t, i) {
  if (!vis(g.box, t > g.t0 && t < g.t1)) return;
  const ts = mapF(g.K, t); show(g.d, g.name, ts);
  const s0 = g.t0 + .1, enter = eOut5(seg(t, s0, s0 + .85)), out = g.win ? eIn(seg(t, g.t1 - .55, g.t1 - .15)) : 0;
  const win = g.win ? seg(t, g.win, g.win + .5) : 0, frz = i === 2 ? eInOut(seg(t, FREEZE, FREEZE + .7)) : 0;
  let box;
  if (g.dev === 'phone') {
    // the last one: the mystery image leaves the phone, which slides away
    const away = eIn(seg(t, FREEZE + .15, FREEZE + .75));
    place(g.d, { cx: 540, cy: 1150 + (1 - enter) * 700 + Math.sin(t * 1.3) * 8 + away * 900, s: lerp(.7, .86, enter) * (1 - win * .12), rx: lerp(22, 4, enter) + away * 20, ry: lerp(-28, -8, enter) + Math.sin(t * .6) * 3, dim: Math.max(win * 1.2, frz * 1.5), o: (1 - out) * (1 - away) });
    if (i === 2) {
      const rP = rectAt(g.name, '#pixel-sprite', 6), k = seg(t, FREEZE, FREEZE + .7);
      if (rP && t > FREEZE) {
        const B = markerBox(g.d, rP), a = eBack(k, 1.3), cx = lerp(B.x + B.width / 2, 540, a), cy = lerp(B.y + B.height / 2, 880, a), s = lerp(B.width / 270, 620 / 270, a);
        N.card.style.opacity = 1 - seg(t, W2 + .3, W2 + .5);
        N.card.style.transform = `translate(${cx - 135}px, ${cy - 135}px) scale(${s}) rotate(${lerp(0, -3, a) + Math.sin(t * 2) * 1.2 * a}deg)`;
        N.card.style.boxShadow = `0 ${a * 26}px 0 rgba(0,0,0,.35)`;
      } else N.card.style.opacity = 0;
    }
  } else {
    // the PC is shown whole, then the camera moves in on the image and the box to type in
    const zoom = eInOut(seg(t, 11.0, 11.6)) * (1 - eInOut(seg(t, WIN_B - .05, WIN_B + .45)) * .6);
    placeL(g.d, { cx: 540, cy: lerp(1000, 1060, zoom) + (1 - enter) * 1100 + Math.sin(t * 1.1) * 6, s: lerp(1.0, 1.75, zoom), rx: lerp(lerp(32, 6, enter), 0, zoom), ry: lerp(6, 0, zoom) + Math.sin(t * .5) * 1.5, dim: win * 1.2, o: 1 - out });
  }
  g.d.glass && (g.d.glass.style.backgroundPosition = `${lerp(120, -40, seg(t, s0 + .2, s0 + 1.4))}% 0`);
  // label and timer
  const kl = seg(t, s0 + .25, s0 + .75), endBar = g.win || FREEZE, lo = Math.max(out, frz);
  chipAt(g.lab, 540, 190 - (1 - eOut(kl)) * 50, lerp(.5, 1, spring(kl)), i % 2 ? 2 : -2, clamp(kl * 3) * (1 - lo));
  const left = 1 - seg(t, s0 + .6, endBar);
  g.bar.style.opacity = clamp(seg(t, s0 + .5, s0 + .8) * 3) * (1 - lo) * (1 - seg(t, endBar, endBar + .2));
  g.bar.firstChild.style.width = left * 100 + '%';
  g.bar.firstChild.style.background = left < .25 ? '#E8453C' : '#4069E0';
  // on the PC the caption leaves before the camera moves in
  capAnim(g.cap, t, s0 + .55, g.dev === 'laptop' ? 10.85 : mapOut(g.K, evAt(g.name, 'submit', 0)) + .05);
  // the wrong guess jumps out of the screen
  const sub = mapOut(g.K, evAt(g.name, 'submit', 0));
  const rIn = rectAt(g.name, '#guess-input', evAt(g.name, 'submit', 0) - .05);
  if (rIn && t > sub && t < sub + 1.5) {
    const B = g.dev === 'phone' ? markerBox(g.d, rIn) : markerBoxL(g.d, rIn), k = seg(t, sub, sub + .45), kb = seg(t, sub + 1.05, sub + 1.45), a = eBack(k, 1.6) * (1 - eIn(kb));
    const shake = 10 * Math.sin((t - sub) * 45) * Math.exp(-(t - sub) * 5) * seg(t, sub + .3, sub + .35);
    chipAt(g.x, lerp(B.x + B.width / 2, 760, a) + shake, lerp(B.y + B.height / 2, 760, a), lerp(.4, 1.15, a), -6 * a, clamp(k * 4) * (1 - kb));
  } else g.x.style.opacity = 0;
  // sharper: a chip rises from the image
  const lv = sub + .18, rP = rectAt(g.name, '#pixel-sprite', evAt(g.name, 'submit', 0));
  if (rP && t > lv && t < lv + 1.4) {
    const B = g.dev === 'phone' ? markerBox(g.d, rP) : markerBoxL(g.d, rP), k = seg(t, lv, lv + .45), kb = seg(t, lv + 1.0, lv + 1.35);
    chipAt(g.lv, B.x + B.width / 2, B.y - 30 - eOut(k) * 70, lerp(.4, 1, spring(k)), 2, clamp(k * 3) * (1 - kb));
  } else g.lv.style.opacity = 0;
  // the answer bursts out
  if (g.win) {
    const kw = seg(t, g.win + .05, g.win + .65), kr = seg(t, g.win, g.win + .5);
    g.rays.style.cssText += `left:-560px;top:${880 - 1100}px;opacity:${eOut(kr) * (1 - out)};transform:rotate(${t * 22}deg) scale(${lerp(.3, 1, eOut(kr))})`;
    g.artEl.style.opacity = clamp(kw * 4) * (1 - out);
    g.artEl.style.transform = `translate(130px, ${lerp(760, 430, eOut(kw))}px) scale(${lerp(.15, 1, spring(kw, 10, 5)) * (1 + out * .5)}) rotate(${(1 - eOut(kw)) * -25 + Math.sin(t * 2) * 2}deg)`;
    g.st.echo = []; slam(g.st, t, g.win + .4, { rot: -3, out: g.t1 - .55 });
    if (g.stamp.length > 8) g.st.style.fontSize = '128px';
    burst(g.conf, t, g.win + .05, 540, 900);
  }
}

// the 3rd: countdown, « ? », the question to the viewers
function renderAsk(t) {
  const c = N.g[2];
  if (t < FREEZE || t > W2 + .5) { [N.cd, N.q, N.ask1, N.ask2, N.hint, N.tom].forEach((n) => (n.style.opacity = 0)); N.toi.style.opacity = 0; return; }
  const n = t < CD[1] ? 3 : t < CD[2] ? 2 : 1, tn = CD[3 - n], k = seg(t, tn, tn + .3), kout = seg(t, TOI - .1, TOI + .1);
  N.cd.textContent = n;
  N.cd.style.opacity = t > CD[0] ? clamp(k * 3) * (1 - kout) : 0;
  N.cd.style.transform = `translate(390px, 240px) scale(${lerp(.4, 1, spring(k)) * (1 - kout)}) rotate(${(1 - eOut(k)) * 20}deg)`;
  slam(N.toi, t, TOI, { rot: -3, out: W2 + .3 });
  const kq = seg(t, TOI + .05, TOI + .55);
  N.q.style.opacity = clamp(kq * 3) * (1 - seg(t, W2 + .3, W2 + .5));
  N.q.style.transform = `translate(${800 - 130}px, ${1050 - 260}px) scale(${lerp(.2, 1, spring(kq)) * (1 + .04 * Math.sin(t * 5))}) rotate(${12 + Math.sin(t * 2) * 4}deg)`;
  pop(N.ask1, t, TOI + .3, { out: W2 + .3 }); pop(N.ask2, t, TOI + .6, { out: W2 + .3 });
  const kh = seg(t, TOI + 1.3, TOI + 1.75); chipAt(N.hint, 540, 1745, lerp(.4, 1, spring(kh)), -2, clamp(kh * 3) * (1 - seg(t, W2 + .3, W2 + .5)));
  const kt = seg(t, TOI + 2.0, TOI + 2.45); chipAt(N.tom, 540, 1850, lerp(.4, 1, spring(kt)), 1, clamp(kt * 3) * (1 - seg(t, W2 + .3, W2 + .5)));
}

function renderEnd(t) {
  if (!vis($('s5'), t > W2 + .48)) return;
  const b = W2 - 30.42; // same beats as the end card of pub.js
  show(N.lap5, 'promo-home-pc', 0); show(N.ph5, 'promo-home-ph', 0);
  const kd = seg(t, b + 32.0, b + 32.6), kd2 = seg(t, b + 32.15, b + 32.75);
  placeL(N.lap5, { cx: 470, cy: 1370 + (1 - eOut(kd)) * 120 + Math.sin(t * 1.2) * 4, s: .5 * lerp(.6, 1, spring(kd)), ry: 10, o: clamp(kd * 3) });
  place(N.ph5, { cx: 820, cy: 1420 + (1 - eOut(kd2)) * 120 + Math.sin(t * 1.2 + 1) * 4, s: .3 * lerp(.6, 1, spring(kd2)), ry: -12, rz: 3, o: clamp(kd2 * 3) });
  const kl = seg(t, b + 31.15, b + 31.75); N.logo.style.transform = `translateY(-110px) scale(${lerp(.2, .8, spring(kl))}) rotate(${(1 - eOut(kl)) * -40 + Math.sin(t * 1.5) * 3}deg)`; N.logo.style.opacity = clamp(kl * 3);
  const k0 = seg(t, b + 31.3, b + 31.7); N.e0.style.opacity = k0; N.e0.style.transform = `translateY(${(1 - eOut(k0)) * 40}px)`;
  const kp = seg(t, b + 31.4, b + 31.9); N.epill.style.transform = `scale(${lerp(.3, 1, spring(kp))}) rotate(-2deg)`; N.epill.style.opacity = clamp(kp * 3);
  N.epill.querySelector('i').style.left = lerp(-200, 900, seg((t - (b + 32.1)) % 2.2, 0, .9)) + 'px';
  const k1 = seg(t, b + 31.75, b + 32.2); N.e1.style.opacity = k1; N.e1.style.transform = `translateY(${(1 - eOut(k1)) * 40}px)`;
  const k2 = seg(t, b + 32.7, b + 33.2); N.e2.style.opacity = clamp(k2 * 3); N.e2.style.transform = `scale(${lerp(.4, 1, spring(k2)) * (1 + .03 * Math.sin(t * 5) * seg(t, b + 33, b + 33.5))}) rotate(2deg)`;
}

async function renderAt(t) {
  // every flash is a short bump that always comes back to 0
  $('flash').style.opacity = Math.max(.55 * Math.sin(seg(t, 3.0, 3.22) * Math.PI), .5 * Math.sin(seg(t, WIN_A, WIN_A + .2) * Math.PI), .5 * Math.sin(seg(t, WIN_B, WIN_B + .2) * Math.PI), .4 * Math.sin(seg(t, TOI, TOI + .2) * Math.PI), .55 * Math.sin(seg(t, W2 + .6, W2 + .82) * Math.PI));
  renderBg(t); renderHook(t); renderWipe(t); renderBands(t);
  N.g.forEach((g, i) => renderGame(g, t, i)); renderAsk(t); renderEnd(t);
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
}
async function setup() {
  for (const n of ['pix3-a', 'pix3-b', 'pix3-c', 'promo-home-pc', 'promo-home-ph']) IDX[n] = await (await fetch('../raw/' + n + '/index.json')).json();
  build();
  const SFX = 'assets/sfx/', A = (t, n, v) => ({ file: SFX + n + '.wav', t, vol: v });
  S.audio = [A(.08, 'pop', .8), A(.42, 'whoosh', .8), A(.66, 'thump', .7), A(.95, 'pop', .7), A(1.12, 'pop', .7), A(1.29, 'pop', .8), A(1.6, 'swish', .8),
    A(2.42, 'whoosh_long', .8), A(2.9, 'tap', .9), A(3.05, 'swish', .7), A(9.6, 'whoosh_long', .7), A(17.3, 'whoosh_long', .7),
    A(FREEZE, 'riser', .6), A(CD[0], 'tick', .9), A(CD[1], 'tick', .9), A(CD[2], 'tick', .9), A(TOI, 'boom', .7), A(TOI + .05, 'thump', .6), A(TOI + 1.3, 'pop', .6), A(TOI + 2.0, 'pop', .5),
    A(W2, 'whoosh_long', .8), A(W2 + .48, 'tap', .9), A(W2 + .66, 'swish', .8), A(W2 + .73, 'pop', .7), A(W2 + 1.58, 'pop', .6), A(W2 + 2.28, 'pop', .7)];
  N.g.forEach((g) => {
    S.audio.push(A(g.t0 + .35, 'pop', .6));
    for (const e of IDX[g.name].events) {
      const o = mapOut(g.K, e.t); if (o == null || o > g.t1) continue;
      if (e.type === 'key') S.audio.push(A(o, 'key', .9));
      if (e.type === 'submit') S.audio.push(A(o, 'validate', 1));
    }
    const sub = mapOut(g.K, evAt(g.name, 'submit', 0)); S.audio.push(A(sub + .05, 'tap', .7), A(sub + .2, 'shimmer', .45));
    if (g.win) S.audio.push(A(g.win, 'boom', .7), A(g.win + .05, 'shimmer', .8), { file: 'assets/cry-' + g.art + '.ogg', t: g.win + .12, vol: 1.1, cry: true });
  });
  S.audio.push({ file: SFX + 'ambience.wav', t: 0, vol: .8, bed: true });
  await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  return S.total;
}
window.setup = setup; window.renderAt = renderAt;
