// Pokédle promo (~52 s, vertical): hook, Pokémon du jour, the games, Party Room on PC + phone, end card. Every frame is a pure function of t.
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
var S = { audio: [], total: 36.0 };

const ARTS = [6, 197, 257, 448, 609, 658, 778, 887, 1000];
const IDX = {};
const T = { s2: [2.85, 12.3], s3: [12.1, 21.56], s4: [21.54, 30.95], s5: [30.9, 99] };

// ---- footage
function frameAt(name, ts) { const f = IDX[name].frames; ts = clamp(ts, 0, IDX[name].duration - .05); let lo = 0, hi = f.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (f[m].t <= ts) lo = m; else hi = m - 1; } return '../raw/' + name + '/' + f[lo].file; }
function rectAt(name, sel, ts) { let r = null; for (const s of IDX[name].rects) { if (s.t > ts) break; const v = s.r[sel]; if (v && v[2] > 0) r = v; } return r; }

// ---- phone
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
  p.img = el('img', '', p.screen); el('div', 'lbase', p.el);
  return p;
}
function placeL(p, { cx = 540, cy = 840, s = 1, rx = 0, ry = 0, rz = 0, o = 1, dim = 0 }) {
  p.el.style.left = cx - 500 + 'px'; p.el.style.top = cy - 340 + 'px';
  p.el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
  p.el.style.opacity = o; p.screen.style.filter = dim ? `brightness(${1 - dim * .2}) saturate(${1 - dim * .3})` : 'none';
}
function show(p, name, ts) { const f = frameAt(name, ts); if (p.img.getAttribute('src') !== f) p.img.src = f; }
const SC = 600 / 390, BAR = 66; // footage px -> screen px, status bar height

// ---- kinetic words
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
  d.echo.forEach((e, i) => { const q = seg(t, t0 + dur + i * .07, t0 + dur + .6 + i * .07); e.style.opacity = q > 0 && q < 1 ? (1 - q) * .7 : 0; e.style.transform = `scale(${1 + eOut(q) * (.14 + i * .1)})`; });
}
function pop(d, t, t0, { dy = 70, dur = .5, rot = 0, out = 1e9 } = {}) {
  const k = seg(t, t0, t0 + dur), x = eIn(seg(t, out, out + .25));
  d.style.opacity = clamp(k * 3) * (1 - x);
  d.style.transform = `translateY(${(1 - eOut(k)) * dy - x * 60}px) scale(${lerp(.4, 1, spring(k))}) rotate(${rot}deg)`;
  (d.echo || []).forEach((e) => (e.style.opacity = 0));
}
// a caption line, word by word
function capLine(parent, text, y, color = '#2E2A33') {
  const box = el('div', '', parent); box.style.cssText = `position:absolute;left:0;right:0;top:${y}px;text-align:center`;
  return text.split(' ').map((w) => { const s = el('span', 'cw', box, w); s.style.color = color; return s; });
}
function capAnim(words, t, t0, out = 1e9) {
  words.forEach((w, i) => { const k = seg(t, t0 + i * .1, t0 + .5 + i * .1), x = eIn(seg(t, out + i * .04, out + .25 + i * .04)); w.style.opacity = clamp(k * 3) * (1 - x); w.style.transform = `translateY(${(1 - eOut(k)) * 60 - x * 70}px) scale(${lerp(.5, 1, spring(k))})`; w.style.display = t > out + .4 ? 'none' : 'inline-block'; });
}
function pillAt(p, t, from, to, a) { // fly a node between two screen boxes {x,y,s}
  const x = lerp(from.x, to.x, a), y = lerp(from.y, to.y, a), s = lerp(from.s, to.s, a);
  return { x, y, s };
}
function markerBox(p, r) { p.marker.style.cssText = `left:${r[0] * SC}px;top:${r[1] * SC + BAR}px;width:${r[2] * SC}px;height:${r[3] * SC}px`; return p.marker.getBoundingClientRect(); }
function confetti(parent, n, seed) { const r = rnd(seed), cols = ['#FFD45C', '#7C5BD6', '#4069E0', '#5DBE7E', '#E8453C', '#FF8FC1']; return Array.from({ length: n }, () => { const d = el('div', 'conf', parent); d.style.background = cols[Math.floor(r() * cols.length)]; return { d, a: r() * Math.PI * 2, v: 700 + r() * 900, spin: (r() - .5) * 1400, g: 1400 + r() * 600 }; }); }
function burst(list, t, t0, cx, cy) { list.forEach((c) => { const u = t - t0; if (u < 0 || u > 1.6) { c.d.style.opacity = 0; return; } const x = cx + Math.cos(c.a) * c.v * u, y = cy + Math.sin(c.a) * c.v * u * .8 + c.g * u * u * .5; c.d.style.opacity = 1 - seg(u, 1.1, 1.6); c.d.style.transform = `translate(${x}px,${y}px) rotate(${c.spin * u}deg)`; }); }

const N = {};
function build() {
  // hook
  N.arts = ARTS.map((id) => { const i = el('img', 'art', $('ring')); i.src = '../assets/art-' + id + '.png'; return i; });
  N.w1 = W($('words'), 'TU CONNAIS', { size: 118, y: 550 });
  N.w2 = W($('words'), 'VRAIMENT', { size: 168, y: 690, color: '#7C5BD6' });
  N.numbg = el('div', '', $('words')); N.numbg.id = 'numbg'; N.numbg.style.top = '950px';
  N.num = el('div', '', $('words'), '1'); N.num.id = 'num'; N.num.style.top = '938px';
  N.w3 = W($('words'), 'POKÉMON ?', { size: 160, y: 1320 });
  // s2: Pokémon du jour
  N.cap2a = capLine($('s2'), 'Un mystère par jour', 140);
  N.cap2b = capLine($('s2'), 'Les indices te guident', 140, '#4069E0');
  N.cap2c = capLine($('s2'), 'Essai après essai…', 140);
  N.rays = el('div', '', $('s2')); N.rays.id = 'rays';
  N.d = phone($('s2'));
  N.ff = el('div', 'ff', $('s2'), '▶▶');
  N.pill = el('div', 'pill', $('s2'), '<b>↑</b>plus récente'); N.glow = el('div', 'glow', $('s2'));
  N.win = el('img', 'bigart', $('s2')); N.win.src = '../assets/art-214.png';
  N.winName = el('div', 'stamp', $('s2'), 'SCARHINO'); N.winName.style.top = '1480px';
  N.winSub = el('div', 'endl', $('s2'), '<span style="background:#FFF8EF;padding:12px 30px;border-radius:999px;box-shadow:0 8px 0 rgba(46,42,51,.15)">Trouvé en 4 essais 🎉</span>'); N.winSub.style.top = '1660px';
  N.conf2 = confetti($('s2'), 46, 7);
  // s3: the games
  N.head3 = W($('s3'), '+ DE 20 JEUX', { size: 150, y: 120, color: '#4069E0' });
  N.games = [['promo-pixel', 'Pokémon pixelisé', 1.6, 2.6, '#4069E0'], ['promo-shiny', 'Shiny ou normal ?', .6, 1.3, '#7C5BD6'], ['promo-qui', 'Qui est-ce ?', .9, 2.0, '#E8453C'], ['promo-hl', 'Higher or Lower', .8, 1.6, '#5DBE7E']]
    .map(([name, label, s0, k, col]) => { const p = phone($('s3')); const l = el('div', 'lab', $('s3'), label); l.style.background = col; l.style.color = '#fff'; return { p, name, label, s0, k, l }; });
  // s4: Party Room
  N.cap4a = capLine($('s4'), 'Joue avec tes potes', 120, '#7C5BD6');
  N.cap4b = capLine($('s4'), 'Sur PC ou téléphone, ensemble', 120, '#7C5BD6');
  N.pa = laptop($('s4')); N.pb = phone($('s4'));
  N.la = el('div', 'lab', $('s4'), 'Léa dessine sur PC 🖱️'); N.la.style.cssText += 'background:#FFF8EF;color:#2E2A33;font-size:44px;border:4px solid #2E2A33';
  N.lb = el('div', 'lab', $('s4'), 'Tom devine sur son tél 📱'); N.lb.style.cssText += 'background:#FFF8EF;color:#2E2A33;font-size:44px;border:4px solid #2E2A33';
  N.t1 = el('div', 'toast', $('s4'), '💬 Sam : c’est quoi ce truc 😂');
  N.t2 = el('div', 'toast', $('s4'), '💬 Sam : t’es nul Tom 😭');
  N.found = el('div', 'stamp', $('s4'), 'TROUVÉ ! +115'); N.found.style.cssText += 'font-size:120px;color:#5DBE7E';
  N.conf4 = confetti($('s4'), 40, 21);
  // s5: end card
  N.lap5 = laptop($('s5')); N.ph5 = phone($('s5'));
  N.logo = el('img', '', $('s5')); N.logo.id = 'logo'; N.logo.src = '../assets/favicon.svg';
  N.epill = el('div', '', $('s5'), 'pokdle.fr<i></i>'); N.epill.id = 'epill';
  N.e1 = el('div', 'endl', $('s5'), 'Gratuit · sans pub · sans compte'); N.e1.style.top = '1110px';
  N.e2 = el('div', '', $('s5'), '🔔 Abonne-toi pour le prochain défi'); N.e2.id = 'sub2';
}

function renderBg(t) {
  $('pat').style.transform = `rotate(-12deg) translate(${(t * 26) % 200}px, ${(t * 40) % 200}px)`;
  $('b1').style.transform = `translate(${-200 + Math.sin(t * .5) * 160}px, ${120 + Math.cos(t * .4) * 140}px)`;
  $('b2').style.transform = `translate(${600 + Math.cos(t * .45) * 150}px, ${820 + Math.sin(t * .35) * 200}px)`;
  $('b3').style.transform = `translate(${300 + Math.sin(t * .38 + 2) * 230}px, ${1400 + Math.cos(t * .42) * 130}px)`;
  // party scene: the background leans lavender
  $('bg').style.background = `color-mix(in srgb, #EFE8FF ${seg(t, 21.5, 21.6) * (1 - seg(t, 30.9, 31)) * 100}%, #FFF8EF)`;
}

function ring(imgs, t, spin, cy, rx, ry, k0, size = 1) {
  imgs.forEach((img, i) => {
    const a = spin + i * 2 * Math.PI / imgs.length, depth = (Math.sin(a) + 1) / 2;
    const k = spring(seg(t, k0 + i * .04, k0 + .6 + i * .04));
    img.style.transform = `translate(${540 + Math.cos(a) * rx - 150}px, ${cy + Math.sin(a) * ry - 150}px) scale(${lerp(.5, 1.02, depth) * k * size}) rotate(${Math.cos(a) * 10}deg)`;
    img.style.opacity = lerp(.35, 1, depth) * clamp(k * 2);
    img.style.zIndex = Math.round(depth * 100);
    img.style.filter = `drop-shadow(0 18px 18px rgba(46,42,51,.22)) blur(${(1 - depth) * 3}px)`;
  });
}

function renderHook(t) {
  if (!vis($('hook'), t < 2.95)) return;
  ring(N.arts, t, t * .7 + 4.2 * eInOut(seg(t, .85, 1.95)), 1060, 440, 210, .05);
  pop(N.w1, t, .08);
  slam(N.w2, t, .42, { rot: -3 });
  const kb = seg(t, .82, 1.22), hit = t > 1.95 ? .08 * Math.exp(-(t - 1.95) * 8) * Math.cos((t - 1.95) * 28) : 0;
  N.numbg.style.opacity = N.num.style.opacity = clamp(kb * 3);
  N.numbg.style.transform = `rotate(${lerp(-14, -4, eOut(kb))}deg) scale(${lerp(.3, 1, spring(kb)) * (1 + hit)})`;
  N.num.style.transform = `scale(${lerp(.3, 1, spring(kb)) * (1 + hit * 1.4)}) rotate(-2deg)`;
  N.num.textContent = Math.round(lerp(1, 1025, eOut(seg(t, .9, 1.95))));
  slam(N.w3, t, 2.02, { rot: 2 });
  const sh = t > 1.95 ? 16 * Math.exp(-(t - 1.95) * 7) : 0;
  $('words').style.transform = `translate(${sh * noise(t * 40)}px, ${sh * noise(t * 37 + 9)}px)`;
}

function renderWipe(t) {
  const t0 = t < 20 ? 2.42 : 30.42;
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

function renderBands(t) {
  if (!vis($('bands'), t > 21.05 && t < 22.1)) return;
  ['bd1', 'bd2', 'bd3'].forEach((id, i) => { const x = lerp(-2500, 1700, eInOut(seg(t, 21.08 + i * .09, 21.9 + i * .09))); $(id).style.cssText += `left:0;top:-300px;width:2000px;height:2600px;transform:translateX(${x}px) skewX(-12deg)`; });
}

// ---- s2: Pokémon du jour
const D0 = () => unwarp(3.0), DA = () => unwarp(6.9), DB = () => unwarp(9.6);
function dailySrc() {
  const o = OT, a = .4 + (DA() - D0());
  if (o < DA()) return .4 + (o - D0());
  if (o < DB()) return a + (o - DA()) * (17.6 - a) / (DB() - DA());
  return 17.6 + (o - DB());
}
function dailyOut(src) { const a = .4 + (DA() - D0()); if (src < a) return D0() + src - .4; if (src >= 17.6) return DB() + src - 17.6; return null; }
const P0 = () => unwarp(22.0), P8 = () => P0() + 7.5 / 1.6;
function partySrc() { return OT < P8() ? .5 + (OT - P0()) * 1.6 : 8.0 + (OT - P8()); }
function partyOut(src) { return src <= 8 ? P0() + (src - .5) / 1.6 : P8() + src - 8; }
const PD = (src) => warp(partyOut(src));
function renderS2(t) {
  if (!vis($('s2'), t > T.s2[0] && t < T.s2[1])) return;
  const ts = dailySrc(); show(N.d, 'promo-daily', ts);
  const ke = eOut5(seg(t, 3.05, 3.95)), drift = eInOut(seg(t, 3.6, 10.2));
  const focus = seg(t, 5.45, 5.85) * (1 - seg(t, 6.5, 6.9));
  const back = eInOut(seg(t, 10.2, 10.7));
  const out = eIn(seg(t, 11.7, 12.2));
  place(N.d, { cy: 1080 + (1 - ke) * 260 + Math.sin(t * 1.3) * 8 + back * 120, s: lerp(.78, 1, ke) * (1 - focus * .03) * (1 - back * .2), rx: lerp(20, 5, ke) - drift * 2, ry: lerp(-30, -12, ke) + drift * 20, dim: Math.max(focus, back * 1.6), o: 1 - out });
  N.d.glass.style.backgroundPosition = `${lerp(120, -40, seg(t, 3.3, 4.6))}% 0`;
  capAnim(N.cap2a, t, 3.35, 5.3); capAnim(N.cap2b, t, 5.7, 6.95); capAnim(N.cap2c, t, 7.15, 9.9);
  // fast-forward chip
  const kf = seg(t, 7.0, 7.2) * (1 - seg(t, 9.45, 9.6));
  N.ff.style.cssText += `left:770px;top:330px;opacity:${kf};transform:scale(${lerp(.5, 1, spring(seg(t, 7.0, 7.4)))}) rotate(-4deg)`;
  // the pill jumps out of the phone and goes back
  const r = rectAt('promo-daily', '#results-body > tr:last-child .dir-pill', ts);
  if (r && t > 5.45 && t < 6.95) {
    const B = markerBox(N.d, r), nw = N.pill.offsetWidth, nh = N.pill.offsetHeight;
    const kout = seg(t, 5.45, 5.95), kback = seg(t, 6.45, 6.9), a = eBack(kout) * (1 - eInOut(kback));
    const x = lerp(B.x + B.width / 2, 540 + Math.sin(t * 2.1) * 6, a), y = lerp(B.y + B.height / 2, 1130, a) - Math.sin(Math.PI * kout) * 120 * (1 - kback), s = lerp(B.width / nw, 1.45, a);
    N.pill.style.opacity = 1;
    N.pill.style.transform = `translate(${x}px, ${y}px) rotate(${lerp(0, -5, a) + Math.sin(t * 3) * 1.5 * a}deg) scale(${s}) translate(${-nw / 2}px, ${-nh / 2}px)`;
    N.pill.style.boxShadow = `0 ${a * 30}px ${a * 50}px rgba(46,42,51,${a * .35}), 0 ${a * 10}px 0 #2b4fb8`;
    N.glow.style.opacity = a; N.glow.style.transform = `translate(${x - 210}px, ${y - 210}px) scale(${1 + a * 1.3})`;
  } else { N.pill.style.opacity = 0; N.glow.style.opacity = 0; }
  // the answer bursts out of the phone
  const kw = seg(t, 10.35, 10.95), kr = seg(t, 10.3, 10.8);
  N.rays.style.cssText += `left:-560px;top:${880 - 1100}px;opacity:${eOut(kr) * (1 - out)};transform:rotate(${t * 22}deg) scale(${lerp(.3, 1, eOut(kr))})`;
  N.win.style.opacity = clamp(kw * 4) * (1 - out);
  N.win.style.transform = `translate(${130}px, ${lerp(700, 470, eOut(kw))}px) scale(${lerp(.15, 1, spring(kw, 10, 5)) * (1 + out * .6)}) rotate(${(1 - eOut(kw)) * -25 + Math.sin(t * 2) * 2}deg)`;
  N.winName.echo = []; slam(N.winName, t, 10.75, { rot: -3, out: 11.7 });
  pop(N.winSub, t, 11.0, { out: 11.7 });
  burst(N.conf2, t, 10.4, 540, 900);
}

// ---- s3: the games, one phone after the other
const G0 = 13.1, GSTEP = 2.6;
function activeIndex(t) { let a = 0; for (let i = 1; i < 4; i++) a += eInOut(seg(t, G0 + i * GSTEP - .45, G0 + i * GSTEP)); return a; }
function renderS3(t) {
  if (!vis($('s3'), t > T.s3[0] && t < T.s3[1])) return;
  slam(N.head3, t, 12.3, { rot: -2 });
  const a = activeIndex(t), enter = eOut5(seg(t, 12.35, 13.1));
  N.games.forEach((g, i) => {
    const k = i - a, u = clamp(t - (G0 + i * GSTEP), 0, GSTEP - .45);
    show(g.p, g.name, g.s0 + u * g.k);
    const ak = Math.abs(k);
    place(g.p, { cx: 540 + k * 400 + (1 - enter) * 900, cy: 1150 + ak * 40 + Math.sin(t * 1.2 + i) * 8, s: .88 - ak * .14, ry: -k * 32 + (1 - enter) * -40, rz: k * 2, z: -ak * 260, o: clamp(1.4 - ak * .45) * clamp(enter * 2), dim: clamp(ak) });
    g.p.el.style.zIndex = 10 - Math.round(ak * 2);
    const kl = seg(t, G0 + i * GSTEP - .25, G0 + i * GSTEP + .2), xl = seg(t, G0 + (i + 1) * GSTEP - .5, G0 + (i + 1) * GSTEP - .3);
    const last = i === 3 ? seg(t, 21.0, 21.2) : xl;
    g.l.style.opacity = clamp(kl * 3) * (1 - last);
    g.l.style.transform = `translate(${540 - g.l.offsetWidth / 2}px, ${380 - (1 - eOut(kl)) * 50}px) scale(${lerp(.5, 1, spring(kl))}) rotate(${(i % 2 ? 3 : -3)}deg)`;
    g.l.style.zIndex = 20;
  });
}

// ---- s4: Party Room, two phones
function toastAnim(node, t, t0, from, hold = 1.5) {
  const nw = node.offsetWidth, k = seg(t, t0, t0 + .5), kb = seg(t, t0 + hold, t0 + hold + .4), a = eBack(k, 1.4) * (1 - eInOut(kb));
  node.style.opacity = t > t0 && t < t0 + hold + .38 ? 1 : 0;
  const x = lerp(from.x, 540, a), y = lerp(from.y, 330, a), s = lerp(.32, 1, a);
  node.style.transform = `translate(${x}px, ${y}px) rotate(${lerp(-6, -2, a)}deg) scale(${s}) translate(${-nw / 2}px, -50%)`;
}
function renderS4(t) {
  if (!vis($('s4'), t > T.s4[0] && t < T.s4[1])) return;
  const ts = partySrc(); show(N.pa, 'promo-party-pc', ts); show(N.pb, 'promo-party-b', ts);
  const ke = eOut5(seg(t, 21.6, 22.4)), ke2 = eOut5(seg(t, 21.85, 22.65)), out = eIn(seg(t, 30.2, 30.6)), F = PD(14.75), win = seg(t, F - .05, F + .3) * (1 - seg(t, F + 1.15, F + 1.45));
  placeL(N.pa, { cx: 540, cy: 850 + (1 - ke) * 1200 + Math.sin(t * 1.1) * 6, s: .92, rx: lerp(35, 6, ke), ry: 8 + Math.sin(t * .5) * 2, dim: win * .8, o: 1 - out });
  place(N.pb, { cx: 820 + (1 - ke2) * 700, cy: 1390 + Math.sin(t * 1.1 + 2) * 8, s: .58, ry: -16, rz: 3, dim: win * .8, o: 1 - out });
  capAnim(N.cap4a, t, 21.75, F - .1); capAnim(N.cap4b, t, F + .2, 30.2);
  [[N.la, 540, 405], [N.lb, 300, 1430]].forEach(([l, x, y], i) => { const k = seg(t, 22.4 + i * .3, 22.9 + i * .3); l.style.opacity = clamp(k * 3) * (1 - out); l.style.transform = `translate(${x - l.offsetWidth / 2}px, ${y - (1 - eOut(k)) * 40}px) scale(${lerp(.4, 1, spring(k))}) rotate(${i ? 3 : -3}deg)`; });
  const from = { x: 820, y: 1060 };
  toastAnim(N.t1, t, PD(3.6), from); toastAnim(N.t2, t, PD(10.8), from, .95);
  N.found.echo = []; slam(N.found, t, F, { rot: -4, out: F + 1.25 }); N.found.style.top = '1000px';
  burst(N.conf4, t, F, 820, 1150);
}

// ---- s5: end card
function renderS5(t) {
  if (!vis($('s5'), t > T.s5[0])) return;
  show(N.lap5, 'promo-home-pc', 0); show(N.ph5, 'promo-home-ph', 0);
  const kd = seg(t, 32.0, 32.6), kd2 = seg(t, 32.15, 32.75);
  placeL(N.lap5, { cx: 470, cy: 1370 + (1 - eOut(kd)) * 120 + Math.sin(t * 1.2) * 4, s: .5 * lerp(.6, 1, spring(kd)), ry: 10, o: clamp(kd * 3) });
  place(N.ph5, { cx: 820, cy: 1420 + (1 - eOut(kd2)) * 120 + Math.sin(t * 1.2 + 1) * 4, s: .3 * lerp(.6, 1, spring(kd2)), ry: -12, rz: 3, o: clamp(kd2 * 3) });
  const kl = seg(t, 31.15, 31.75); N.logo.style.transform = `scale(${lerp(.2, 1, spring(kl))}) rotate(${(1 - eOut(kl)) * -40 + Math.sin(t * 1.5) * 3}deg)`; N.logo.style.opacity = clamp(kl * 3);
  const kp = seg(t, 31.35, 31.85); N.epill.style.transform = `scale(${lerp(.3, 1, spring(kp))}) rotate(-2deg)`; N.epill.style.opacity = clamp(kp * 3);
  N.epill.querySelector('i').style.left = lerp(-200, 900, seg((t - 32.1) % 2.2, 0, .9)) + 'px';
  const k1 = seg(t, 31.75, 32.2); N.e1.style.opacity = k1; N.e1.style.transform = `translateY(${(1 - eOut(k1)) * 40}px)`;
  const k2 = seg(t, 32.7, 33.2); N.e2.style.opacity = clamp(k2 * 3); N.e2.style.transform = `scale(${lerp(.4, 1, spring(k2)) * (1 + .03 * Math.sin(t * 5) * seg(t, 33, 33.5))}) rotate(2deg)`;
}

// Output time -> design time: slower where there is something to read.
const WARP = [[0, 3.0, 1], [3.0, 5.45, .63], [5.45, 6.9, .62], [6.9, 9.6, 1], [9.6, 10.3, .212], [10.3, 11.9, .65], [11.9, 21.5, .72], [21.5, 30.4, .6], [30.4, 36, .85]];
function warp(t) { let o = 0; for (const [a, b, r] of WARP) { const d = (b - a) / r; if (t <= o + d) return a + (t - o) * r; o += d; } return 36; }
function unwarp(x) { let o = 0; for (const [a, b, r] of WARP) { if (x <= b) return o + (x - a) / r; o += (b - a) / r; } return o; }
S.total = unwarp(36);
let OT = 0;
async function renderAt(t) { OT = t; return renderDesign(warp(t)); }
async function renderDesign(t) {
  $('flash').style.opacity = Math.max(.55 * Math.sin(seg(t, 3.02, 3.25) * Math.PI), .7 * Math.sin(seg(t, 12.0, 12.35) * Math.PI), .55 * Math.sin(seg(t, 31.02, 31.25) * Math.PI));
  renderBg(t); renderHook(t); renderWipe(t); renderBands(t);
  renderS2(t); renderS3(t); renderS4(t); renderS5(t);
  await Promise.all([...document.images].filter((i) => i.offsetParent !== null || true).map((i) => i.decode().catch(() => {})));
}
async function setup() {
  for (const n of ['promo-daily', 'promo-pixel', 'promo-shiny', 'promo-qui', 'promo-hl', 'promo-party-pc', 'promo-party-b', 'promo-home-pc', 'promo-home-ph']) IDX[n] = await (await fetch('../raw/' + n + '/index.json')).json();
  build();
  // sounds: soft cues in design time, plus every key and every « Deviner / Valider » in the footage
  const SFX = 'assets/sfx/', F = PD(14.75);
  const cues = [[.08, 'pop', .8], [.42, 'whoosh', .8], [.66, 'thump', .7], [.82, 'pop', .8], [.85, 'riser', .7], [1.95, 'boom', .8], [2.02, 'thump', .6],
    [2.42, 'whoosh_long', .8], [2.9, 'tap', .9], [3.08, 'swish', .8], [5.45, 'swish', .8], [5.62, 'pop', .8], [6.45, 'swish', .6], [6.9, 'whoosh', .5],
    [10.33, 'boom', .8], [10.4, 'shimmer', .8], [12.0, 'whoosh', .8], [12.3, 'thump', .7], [12.85, 'pop', .7], [15.25, 'swish', .7], [15.45, 'pop', .7], [16.16, 'shimmer', .6],
    [17.85, 'swish', .7], [18.05, 'pop', .7], [20.45, 'swish', .7], [20.65, 'pop', .7], [21.08, 'whoosh_long', .8], [21.75, 'pop', .6], [22.4, 'pop', .6], [22.7, 'pop', .6],
    [PD(3.6), 'pop', .8], [PD(10.8), 'pop', .8], [F, 'thump', .7], [F + .03, 'shimmer', .8],
    [30.42, 'whoosh_long', .8], [30.9, 'tap', .9], [31.08, 'swish', .8], [31.15, 'pop', .7], [32.0, 'pop', .6], [32.7, 'pop', .7]];
  S.audio = cues.map(([t, n, v]) => ({ file: SFX + n + '.wav', t: unwarp(t), vol: v }));
  for (const e of IDX['promo-daily'].events) { const o = dailyOut(e.t); if (o == null) continue; if (e.type === 'key') S.audio.push({ file: SFX + 'key.wav', t: o, vol: .9 }); if (e.type === 'submit') S.audio.push({ file: SFX + 'validate.wav', t: o, vol: 1 }); }
  for (const e of IDX['promo-party-b'].events) { if (e.t < 8) continue; const o = partyOut(e.t); if (e.type === 'key') S.audio.push({ file: SFX + 'key.wav', t: o, vol: .9 }); if (e.type === 'submit') S.audio.push({ file: SFX + 'validate.wav', t: o, vol: 1 }); }
  S.audio.push({ file: SFX + 'ambience.wav', t: 0, vol: .8 });
  S.audio.push({ file: 'assets/cry-214.ogg', t: unwarp(10.45), vol: 1.1 }, { file: 'assets/cry-54.ogg', t: unwarp(F + .08), vol: .9 }, { file: 'assets/cry-25.ogg', t: unwarp(31.35), vol: 1.1 });
  await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  return S.total;
}
window.setup = setup; window.renderAt = renderAt;
