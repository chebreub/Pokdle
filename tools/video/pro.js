// Motion-design compositor, v2. Every frame is a pure function of t (seconds).
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (k) => 1 - Math.pow(1 - k, 3);
const eOut5 = (k) => 1 - Math.pow(1 - k, 5);
const eIn = (k) => k * k * k;
const eInOut = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eBack = (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const spring = (k, f = 11, d = 7) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.exp(-d * k) * Math.cos(f * k));
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const noise = (x) => Math.sin(x * 12.9898) * Math.sin(x * 4.1414 + 1.3) * Math.cos(x * 7.233);
const el = (tag, cls, parent, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; parent.appendChild(d); return d; };
let IDX, S;

function frameAt(ts) { const f = IDX.frames; let lo = 0, hi = f.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (f[m].t <= ts) lo = m; else hi = m - 1; } return f[lo].file; }
function rectAt(sel, ts) { let r = null; for (const s of IDX.rects) { if (s.t > ts) break; const v = s.r[sel]; if (v && v[2] > 0) r = v; } return r; }
function evs(type) { return IDX.events.filter((e) => e.type === type); }
function camAt(keys, t) {
  let cur = keys[0];
  for (let i = 1; i < keys.length; i++) { const k = keys[i]; if (t < k.t) break; const p = (k.ease || eInOut)(seg(t, k.t, k.t + (k.dur || .4))); cur = { cx: lerp(cur.cx, k.cx, p), cy: lerp(cur.cy, k.cy, p), w: lerp(cur.w, k.w, p) }; }
  return cur;
}

// ---- kinetic text: main glyphs + outline echoes
function K(parent, html, { size = 120, color = '#fff', stroke = 0, strokeColor = '#2E2A33', echoes = 3, x = 0, y = 0, center = true, weight = 700 } = {}) {
  const d = el('div', 'k' + (center ? ' c' : ''), parent);
  d.style.cssText += `font-size:${size}px;font-weight:${weight};color:${color};top:${y}px;` + (center ? '' : `left:${x}px;`);
  d.echo = [];
  for (let i = 0; i < echoes; i++) { const e = el('div', 'e' + (center ? ' c' : ''), d, html); e.style.width = '100%'; d.echo.push(e); }
  d.m = el('div', 'm', d, html);
  if (stroke) { d.m.style.webkitTextStroke = `${stroke}px ${strokeColor}`; }
  return d;
}
// slam: arrives huge + blurred, hits, echoes ring out
function slam(d, t, t0, { from = 2.6, dur = .28, hold = 99, out = .3, rot = 0, pre = '' } = {}) {
  const k = seg(t, t0, t0 + dur), ex = seg(t, t0 + hold, t0 + hold + out);
  const hit = t > t0 + dur ? .07 * Math.exp(-(t - t0 - dur) * 9) * Math.cos((t - t0 - dur) * 30) : 0;
  d.style.opacity = clamp(k * 4) * (1 - ex);
  d.style.filter = k > 0 && k < 1 ? `blur(${(1 - k) * 16}px)` : 'none';
  d.style.transform = `${pre} scale(${lerp(from, 1, eOut5(k)) * (1 + hit) * (1 - ex * .25)}) rotate(${rot}deg)`;
  d.echo.forEach((e, i) => { const q = seg(t, t0 + dur + i * .06, t0 + dur + .6 + i * .06); e.style.opacity = q > 0 && q < 1 ? (1 - q) * .85 * (1 - ex) : 0; e.style.transform = `scale(${1 + eOut(q) * (.16 + i * .12)})`; });
}
function pop(d, t, t0, { dur = .45, dy = 60, hold = 99, out = .25 } = {}) {
  const k = seg(t, t0, t0 + dur), ex = seg(t, t0 + hold, t0 + hold + out);
  d.style.opacity = clamp(k * 3) * (1 - ex);
  d.style.transform = `translateY(${(1 - eOut(k)) * dy - ex * 40}px) scale(${lerp(.5, 1, spring(k))})`;
  d.echo.forEach((e) => (e.style.opacity = 0));
}

// ---- impulses (screen shake)
const shakes = [];
function shakeAt(t) { let x = 0, y = 0, r = 0; for (const s of shakes) { const u = t - s.t; if (u < 0 || u > s.dur) continue; const a = s.amp * Math.pow(1 - u / s.dur, 2); x += a * noise(u * 40 + s.t); y += a * noise(u * 37 + s.t + 9); r += a * .05 * noise(u * 29 + s.t + 3); } return `translate(${x}px,${y}px) rotate(${r}deg)`; }

// ---- background
function renderBg(t, speed = 1) {
  $('pat').style.transform = `rotate(-14deg) translate(${(t * 30 * speed) % 180}px, ${(t * 46 * speed) % 180}px)`;
  $('b1').style.transform = `translate(${-160 + Math.sin(t * .35) * 170}px, ${80 + Math.cos(t * .27) * 140}px)`;
  $('b2').style.transform = `translate(${560 + Math.cos(t * .3) * 160}px, ${880 + Math.sin(t * .22) * 200}px)`;
  $('b3').style.transform = `translate(${360 + Math.sin(t * .25 + 2) * 240}px, ${1450 + Math.cos(t * .31) * 130}px)`;
}

// ---- 3D site cards
function makeCard(c) {
  const d = el('div', 'card', $('scene')); d.style.cssText = `left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px`;
  const w = el('div', 'wrap', d); c.img = el('img', 'f', w); c.gloss = el('div', 'gloss', d); c.rim = el('div', 'rim', d); c.el = d; c.wrap = w;
  if (c.blur) w.style.filter = 'url(#mb)';
}
function placeCard(c, t, ts) {
  const v = c.cam(t), s = c.w / v.w, dpr = IDX.viewport.dpr;
  c.img.style.width = IDX.viewport.w * dpr + 'px';
  const x0 = v.cx - v.w / 2, y0 = v.cy - c.h / s / 2;
  c.img.style.transform = `scale(${s / dpr}) translate(${-x0 * dpr}px, ${-y0 * dpr}px)`;
  if (c.blur) { const p = c.cam(t - 1 / 30); const vy = Math.abs(p.cy - v.cy) * s; $('mbg').setAttribute('stdDeviation', `0 ${Math.min(40, vy * .55).toFixed(1)}`); }
  const m = c.motion(t);
  c.el.style.transform = `translate3d(${m.x || 0}px,${m.y || 0}px,${m.z || 0}px) rotateX(${m.rx || 0}deg) rotateY(${m.ry || 0}deg) rotateZ(${m.rz || 0}deg) scale(${m.s ?? 1})`;
  c.el.style.opacity = m.o ?? 1;
  c.gloss.style.opacity = m.gloss ?? 0; c.gloss.style.transform = `translateX(${m.glossX ?? -60}%)`;
  c.rim.style.opacity = m.rim ?? 0;
}

// Speed ramps and freeze-frames: segments [srcFrom, srcTo, speed] or { hold: seconds }.
// Every source timestamp is moved to output time, so scenes are written in output time.
function remapTime(idx, segs) {
  const parts = []; let out = 0, src = segs.find((s) => Array.isArray(s))[0];
  for (const s of segs) {
    if (!Array.isArray(s)) { window.TM_HOLDS = (window.TM_HOLDS || []).concat(out); if (s.tag) (window.TM_TAGS = window.TM_TAGS || {})[s.tag] = out; out += s.hold; continue; }
    parts.push({ a: s[0], b: s[1], o: out, k: s[2] }); out += (s[1] - s[0]) / s[2]; src = s[1];
  }
  const f = (t) => { for (const p of parts) if (t >= p.a && t < p.b) return p.o + (t - p.a) / p.k; return null; };
  idx.mapOut = f;
  const keep = (arr) => arr.map((x) => ({ ...x, t: f(x.t) })).filter((x) => x.t != null);
  const firstFrame = idx.frames.filter((x) => x.t <= parts[0].a).pop();
  idx.frames = (firstFrame ? [{ ...firstFrame, t: 0 }] : []).concat(keep(idx.frames));
  const firstRect = idx.rects.filter((x) => x.t <= parts[0].a).pop();
  idx.events = keep(idx.events); idx.rects = (firstRect ? [{ ...firstRect, t: 0 }] : []).concat(keep(idx.rects));
  idx.duration = out;
}
async function renderAt(t) {
  const ts = Math.min(t, IDX.duration - .05), file = 'raw/' + S.src + '/' + frameAt(ts);
  for (const c of S.cards) { if (c.img.getAttribute('src') !== file) c.img.src = file; placeCard(c, t, ts); }
  S.render(t, ts);
  $('world').style.transform = shakeAt(t);
  await Promise.all(S.cards.map((c) => c.img.decode().catch(() => {})));
}
async function setup(name) {
  await new Promise((res) => { const s = document.createElement('script'); s.src = 'pro-' + name + '.js'; s.onload = res; document.head.appendChild(s); });
  const src = window.SCENE_SRC || name;
  IDX = await (await fetch('raw/' + src + '/index.json')).json();
  if (window.TIMEMAP) remapTime(IDX, window.TIMEMAP);
  S = window.makeScene(IDX); S.src = src;
  S.cards.forEach(makeCard); S.build();
  await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  return S.total;
}
window.setup = setup; window.renderAt = renderAt;
