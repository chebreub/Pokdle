// ===== Motion design (3/11/2026, « go motion », d'après la maquette validée) =====
// Capture comme dans les jeux (élan, lancer en cloche, aspiration en blanc, 3 balancements, « clic »),
// coffre / cadeau dessinés qui tremblent puis s'ouvrent, reflet sur un shiny, carte de 1re capture qui se retourne.
// Rien ne bouge avec « réduire les animations », et « Passer › » arrête tout de suite.
const MO_OUT = "cubic-bezier(.22,1,.36,1)", MO_BACK = "cubic-bezier(.34,1.56,.64,1)", MO_IN = "cubic-bezier(.55,0,1,.45)";
const MO_BALLS = {
  poke: ["#E3350D", ""],
  great: ["#3B6FD8", '<path d="M8 21q5-12 13-14l-2 11zM48 21q-5-12-13-14l2 11z" fill="#E3350D"/>'],
  ultra: ["#2E2A33", '<path d="M10 9.5h8l-1.5 16H8.5zM46 9.5h-8l1.5 16h8z" fill="#FFD45C"/>']
};
const MO_BALL_NAMES = { poke: "Poké Ball", great: "Super Ball", ultra: "Hyper Ball" };
function moBallSvg(kind) {
  const [color, extra] = MO_BALLS[kind] || MO_BALLS.poke;
  return '<svg class="mo-ball-svg" viewBox="0 0 56 56" aria-hidden="true">' +
    '<path d="M2 28a26 26 0 0 0 52 0z" fill="#f4f1ec" stroke="#2E2A33" stroke-width="3"/>' +
    '<rect x="2" y="28" width="52" height="2.6" fill="#2E2A33"/>' +
    '<g class="mo-top"><path d="M2 28a26 26 0 0 1 52 0z" fill="' + color + '" stroke="#2E2A33" stroke-width="3"/>' + extra +
    '<path d="M11 15a20 20 0 0 1 11-7" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".5"/>' +
    '<rect x="2" y="25.4" width="52" height="2.6" fill="#2E2A33"/></g>' +
    '<circle cx="28" cy="28" r="8" fill="#f4f1ec" stroke="#2E2A33" stroke-width="3"/><circle class="mo-btn" cx="28" cy="28" r="3.5" fill="#fff"/></svg>';
}
// --- 🔊 Sons faits maison, calés sur chaque mouvement (jamais de son officiel : droits de Nintendo) ---
// Souffles (bruit filtré), glissements de note et petits clics ; respectent « Effets sonores » et le volume.
let moNoiseBuffer = null;
function moAudio() {
  if (typeof getPokedexFxAudioContext !== "function") return null;
  const ctx = getPokedexFxAudioContext();
  return ctx ? { ctx, t: ctx.currentTime + 0.01, v: typeof appSoundVolume === "function" ? appSoundVolume() : 1 } : null;
}
function moTone(a, f0, f1, at, dur, gain, type) {
  const o = a.ctx.createOscillator(), g = a.ctx.createGain(), s = a.t + at;
  o.type = type || "sine";
  o.frequency.setValueAtTime(f0, s);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, s + dur);
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * a.v), s + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  o.connect(g); g.connect(a.ctx.destination); o.start(s); o.stop(s + dur + 0.03);
}
function moNoise(a, at, dur, gain, f0, f1, q) {
  const ctx = a.ctx, s = a.t + at;
  if (!moNoiseBuffer || moNoiseBuffer.sampleRate !== ctx.sampleRate) {
    moNoiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
    const d = moNoiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = moNoiseBuffer; f.type = "bandpass"; f.Q.value = q || 1.2;
  f.frequency.setValueAtTime(f0, s); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, s + dur);
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * a.v), s + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(s); src.stop(s + dur + 0.03);
}
function moSfx(kind) {
  const a = moAudio();
  if (!a) return;
  try {
    switch (kind) {
      case "throw": moNoise(a, 0, .38, .05, 700, 2600, .9); moTone(a, 380, 720, 0, .3, .008, "sine"); break;
      case "ballOpen": moTone(a, 620, 1250, 0, .09, .022, "sine"); moTone(a, 2200, 2200, 0, .025, .006, "square"); break;
      case "absorb": moTone(a, 300, 1500, .02, .55, .012, "triangle"); moTone(a, 450, 2200, .05, .5, .006, "sine"); moNoise(a, 0, .55, .022, 2500, 6000, 2); break;
      case "close": moTone(a, 1400, 900, 0, .05, .014, "square"); break;
      case "land": moTone(a, 150, 80, 0, .12, .04, "triangle"); moNoise(a, 0, .06, .02, 500, 300, 1); break;
      case "tick": moTone(a, 270, 220, 0, .07, .032, "triangle"); moTone(a, 1900, 1900, 0, .018, .006, "square"); break;
      case "caught":
        moTone(a, 1600, 1600, 0, .03, .016, "square");
        [[784, .14], [988, .24], [1319, .34]].forEach(([f, at]) => moTone(a, f, f, at, .22, .024, "sine"));
        moTone(a, 1976, 1976, .46, .3, .01, "sine"); break;
      case "breakFree": moTone(a, 900, 280, 0, .18, .022, "sine"); moNoise(a, 0, .2, .04, 1800, 600, 1); break;
      case "shake": moNoise(a, 0, .1, .045, 420, 300, 1.4); moTone(a, 190, 160, 0, .08, .022, "triangle"); break;
      case "open": moNoise(a, 0, .45, .04, 600, 3800, .9); [[523.3, .1], [659.3, .16], [784, .22], [1046.5, .3]].forEach(([f, at]) => moTone(a, f, f, at, .35, .02, "sine")); break;
      case "pop": moTone(a, 700, 1150, 0, .08, .02, "sine"); break;
      case "collect": moTone(a, 1319, 1760, 0, .07, .014, "sine"); break;
      case "flip": moNoise(a, 0, .16, .035, 1400, 3200, 1.3); break;
      case "sparkle": [1568, 2093, 2637, 3136].forEach((f, i) => moTone(a, f, f, i * .06, .14, .008, "sine")); break;
      case "glint": moTone(a, 2637, 3520, 0, .14, .008, "sine"); moTone(a, 3951, 3951, .08, .12, .005, "sine"); break;
    }
  } catch (_e) { /* son facultatif */ }
}
function moAnim(el, frames, opts) {
  if (!el || !el.animate) return Promise.resolve();
  // FX-01: ⚡ Rapides halves every duration and delay (same steps, same result).
  const o = Object.assign({ fill: "forwards" }, opts);
  if (typeof fxMs === "function") { if (o.duration) o.duration = fxMs(o.duration); if (o.delay) o.delay = fxMs(o.delay); }
  return el.animate(frames, o).finished.catch(() => {});
}
// Une suite d'étapes qu'on peut arrêter d'un coup (« Passer ») : chaque attente rend false si c'est fini.
function moRunner(onStop) {
  const timers = [];
  const run = { over: false };
  run.wait = (ms) => new Promise((r) => timers.push(setTimeout(() => r(!run.over), typeof fxMs === "function" ? fxMs(ms) : ms)));
  run.stop = () => { if (run.over) return; run.over = true; timers.forEach(clearTimeout); onStop(); };
  return run;
}
function moStars(host, x, y, count, spread) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    s.className = "mo-star"; s.textContent = "★";
    s.style.left = x + "px"; s.style.top = y + "px";
    host.appendChild(s);
    const a = -Math.PI / 2 + (i - (count - 1) / 2) * (spread || 0.62), d = 64 + (i % 2) * 18;
    moAnim(s, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.2)" }, { opacity: 1, offset: .25 },
      { opacity: 0, transform: "translate(calc(-50% + " + Math.round(Math.cos(a) * d) + "px),calc(-50% + " + Math.round(Math.sin(a) * d) + "px)) scale(1.1) rotate(160deg)" }], { duration: 900, easing: MO_OUT });
  }
}

function moReducedCaptureSounds(shakes, caught) {
  const at = (ms, kind) => setTimeout(() => moSfx(kind), ms);
  const n = Math.max(0, Math.min(3, Number(shakes) || 0));
  at(0, "throw"); at(200, "land");
  for (let i = 0; i < n; i++) at(400 + i * 200, "tick");
  at(400 + n * 200, caught ? "caught" : "breakFree");
}
// --- ⚪ Capture dans les hautes herbes ---
wildAnimate = function (scene, ball, shakes, caught) {
  const stage = scene && scene.querySelector(".wild-stage"), mon = scene && scene.querySelector(".wild-mon");
  if (!stage || !mon) return Promise.resolve();
  // « Animations réduites » coupe les mouvements, pas les sons : le lancer, les secousses et la capture
  // (ou la sortie) restent audibles, en une seconde, et le résultat s'affiche tout de suite comme avant.
  if (wildReducedMotion()) { moReducedCaptureSounds(shakes, caught); return Promise.resolve(); }
  stage.classList.remove("is-intro");
  const sr = stage.getBoundingClientRect(), mr = mon.getBoundingClientRect();
  const W = sr.width, H = sr.height;
  const cx = mr.left - sr.left + mr.width / 2, cy = Math.max(60, mr.top - sr.top + mr.height * 0.45);
  const ground = Math.min(H - 30, mr.bottom - sr.top - 22);
  const sx = W * 0.5 + Math.min(120, W * 0.28), sy = H + 34;
  const el = document.createElement("div");
  el.className = "mo-ball"; el.innerHTML = moBallSvg(ball);
  const shadow = document.createElement("div");
  shadow.className = "mo-ball-shadow"; shadow.style.left = cx + "px"; shadow.style.top = (ground + 22) + "px";
  const beam = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  beam.setAttribute("class", "mo-beam"); beam.setAttribute("viewBox", "0 0 " + Math.round(W) + " " + Math.round(H)); beam.setAttribute("aria-hidden", "true");
  const flash = stage.querySelector(".wild-flash");
  stage.append(shadow, beam, el);
  const top = el.querySelector(".mo-top");
  const at = (x, y, extra) => "translate(" + Math.round(x - 28) + "px," + Math.round(y - 28) + "px) " + (extra || "");
  const flashAt = (y) => { if (!flash) return; stage.style.setProperty("--fy", Math.round(y) + "px"); flash.classList.remove("is-on"); void flash.offsetWidth; flash.classList.add("is-on"); };
  const panel = scene.querySelector(".wild-panel");
  if (panel) panel.insertAdjacentHTML("beforeend", '<button type="button" class="wild-skip" data-action="wildSkipAnimation">Passer ›</button>');
  mon.style.animation = "none";
  mon.style.transformOrigin = "50% " + Math.round(((cy - 14 - (mr.top - sr.top)) / mr.height) * 100) + "%";
  return new Promise((resolve) => {
    const run = moRunner(() => { wildSkipAnim = null; resolve(); });
    wildSkipAnim = run.stop;
    (async () => {
      // 1. Élan : la Ball monte dans le champ et recule un peu.
      await moAnim(el, [{ transform: at(sx, sy) }, { transform: at(sx + 6, H - 70, "scale(1.05)") }, { transform: at(sx + 14, H - 52, "scale(.95,1.05)") }], { duration: 380, easing: MO_OUT });
      if (run.over) return;
      // 2. Lancer en cloche, en tournant.
      moSfx("throw");
      const peak = Math.min(150, Math.max(70, cy * 0.7)), path = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, x = sx + 14 + (cx - sx - 14) * t, y = H - 52 + (cy - (H - 52)) * t - Math.sin(Math.PI * t) * peak;
        path.push({ transform: at(x, y, "rotate(" + Math.round(-t * 720) + "deg) scale(" + (1 - t * 0.2).toFixed(3) + ")"), offset: t });
      }
      await moAnim(el, path, { duration: 620, easing: "cubic-bezier(.3,.2,.5,1)" });
      if (run.over) return;
      // 3. Impact : la Ball s'ouvre, flash, le Pokémon devient blanc et se fait aspirer par un rayon rouge.
      moSfx("ballOpen"); moSfx("absorb"); flashAt(cy);
      moAnim(el, [{ transform: at(cx, cy, "scale(.8)") }, { transform: at(cx, cy - 14, "scale(.84) rotate(-12deg)") }], { duration: 260, easing: MO_OUT });
      moAnim(top, [{ transform: "rotate(0)" }, { transform: "rotate(-48deg)" }], { duration: 220, easing: MO_OUT });
      await moAnim(mon, [{ filter: "brightness(1) invert(0) drop-shadow(0 0 0 rgba(255,77,77,0))" }, { filter: "brightness(0) invert(1) drop-shadow(0 0 14px rgba(255,77,77,.85))" }], { duration: 240 });
      if (run.over) return;
      const bx = cx, by = cy - 14;
      beam.innerHTML = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        return '<line x1="' + Math.round(bx + Math.cos(a) * mr.width * 0.55) + '" y1="' + Math.round(by + Math.sin(a) * mr.height * 0.55) + '" x2="' + Math.round(bx) + '" y2="' + Math.round(by) + '"/>';
      }).join("") + '<circle cx="' + Math.round(bx) + '" cy="' + Math.round(by) + '" r="12"/>';
      beam.querySelectorAll("line,circle").forEach((l, i) => moAnim(l, [{ opacity: 0 }, { opacity: .9, offset: .3 }, { opacity: 0 }], { duration: 620, delay: i * 25 }));
      await moAnim(mon, [{ transform: "translateX(-50%) scale(1)", filter: "brightness(0) invert(1) drop-shadow(0 0 14px rgba(255,77,77,.85))" },
        { transform: "translateX(-50%) scale(1.06)", offset: .18 },
        { transform: "translateX(-50%) scale(0)", filter: "brightness(0) invert(1) drop-shadow(0 0 30px rgba(255,77,77,.9))" }], { duration: 600, easing: MO_IN });
      if (run.over) return;
      // 4. La Ball se referme, tombe et rebondit (écrasée à l'arrivée).
      moAnim(top, [{ transform: "rotate(-48deg)" }, { transform: "rotate(0)" }], { duration: 160, easing: MO_IN });
      moAnim(shadow, [{ opacity: 0, transform: "translateX(-50%) scale(.4)" }, { opacity: 1, transform: "translateX(-50%) scale(1)" }], { duration: 420 });
      moSfx("close"); setTimeout(() => { if (!run.over) moSfx("land"); }, fxMs(400));
      await moAnim(el, [{ transform: at(cx, cy - 14, "scale(.84) rotate(-12deg)") },
        { transform: at(cx, ground, "scale(.9,.72)"), offset: .55, easing: MO_OUT },
        { transform: at(cx, ground - 32, "scale(.82,.88)"), offset: .78, easing: MO_IN },
        { transform: at(cx, ground, "scale(.86,.78)"), offset: .92 },
        { transform: at(cx, ground, "scale(.82)") }], { duration: 740, easing: MO_IN });
      if (run.over) return;
      // 5. Les balancements, avec des pauses (le suspense).
      for (let i = 0; i < shakes; i++) {
        if (!(await run.wait(380))) return;
        const r = i % 2 ? 22 : -22;
        moSfx("tick");
        await moAnim(el, [{ transform: at(cx, ground, "scale(.82) rotate(0)") },
          { transform: at(cx + r * 0.35, ground, "scale(.82) rotate(" + r + "deg)"), offset: .35 },
          { transform: at(cx - r * 0.1, ground, "scale(.82) rotate(" + (-r * 0.3) + "deg)"), offset: .7 },
          { transform: at(cx, ground, "scale(.82) rotate(0)") }], { duration: 520, easing: "ease-in-out" });
        if (run.over) return;
      }
      if (!(await run.wait(caught ? 320 : 220))) return;
      if (caught) {
        // 6a. « Clic » : le bouton brille, des étoiles sortent.
        moSfx("caught"); stage.classList.add("is-caught");
        moAnim(el, [{ transform: at(cx, ground, "scale(.82)") }, { transform: at(cx, ground, "scale(.94,.72)") }, { transform: at(cx, ground, "scale(.82)") }], { duration: 260, easing: MO_BACK });
        moAnim(el.querySelector(".mo-ball-svg"), [{ filter: "brightness(1)" }, { filter: "brightness(1.5) drop-shadow(0 0 10px #fff)" }, { filter: "brightness(.9)" }], { duration: 520 });
        moStars(stage, cx, ground - 18, 3);
        await run.wait(950);
      } else {
        // 6b. Raté : la Ball s'ouvre d'un coup, le Pokémon ressort en blanc puis reprend ses couleurs.
        moSfx("breakFree"); flashAt(ground);
        moAnim(top, [{ transform: "rotate(0)" }, { transform: "rotate(-70deg)" }], { duration: 200, easing: MO_OUT });
        moAnim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 160 });
        moAnim(shadow, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
        await moAnim(mon, [{ transform: "translateX(-50%) scale(0)", filter: "brightness(0) invert(1) drop-shadow(0 0 20px rgba(255,255,255,.9))" },
          { transform: "translateX(-50%) scale(1.08)", filter: "brightness(0) invert(1) drop-shadow(0 0 10px rgba(255,255,255,.6))", offset: .55 },
          { transform: "translateX(-50%) scale(1)", filter: "brightness(1) invert(0) drop-shadow(0 0 0 rgba(255,255,255,0))" }], { duration: 560, easing: MO_BACK });
        await run.wait(200);
      }
    })().then(run.stop, run.stop);
  });
};

// --- 🎁 Cadeau du jour et coffres de l'Expédition ---
function moChestSvg() {
  return '<svg viewBox="0 0 200 170" aria-hidden="true"><ellipse cx="100" cy="164" rx="90" ry="8" fill="rgba(0,0,0,.35)"/>' +
    '<rect x="14" y="70" width="172" height="90" rx="12" fill="#B8733A" stroke="#2E2A33" stroke-width="4"/><rect x="16" y="72" width="168" height="16" fill="#9A5C2B"/>' +
    '<rect x="40" y="70" width="16" height="90" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/><rect x="144" y="70" width="16" height="90" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/>' +
    '<rect x="86" y="80" width="28" height="32" rx="6" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/><circle cx="100" cy="94" r="5" fill="#2E2A33"/>' +
    '<rect class="mo-seam" x="16" y="62" width="168" height="10" rx="5" fill="#FFF1B8"/>' +
    '<g class="mo-lid"><path d="M14 66V40Q14 10 100 10Q186 10 186 40V66Z" fill="#C98445" stroke="#2E2A33" stroke-width="4"/>' +
    '<rect x="40" y="16" width="16" height="50" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/><rect x="144" y="16" width="16" height="50" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/>' +
    '<path d="M30 30Q60 18 96 17" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".35"/></g></svg>';
}
function moGiftSvg() {
  return '<svg viewBox="0 0 200 170" aria-hidden="true"><ellipse cx="100" cy="164" rx="80" ry="8" fill="rgba(0,0,0,.35)"/>' +
    '<rect x="26" y="74" width="148" height="86" rx="10" fill="#4069E0" stroke="#2E2A33" stroke-width="4"/>' +
    '<rect x="88" y="74" width="24" height="86" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/>' +
    '<rect class="mo-seam" x="28" y="66" width="144" height="10" rx="5" fill="#FFF1B8"/>' +
    '<g class="mo-lid"><path d="M80 50Q58 18 70 14Q86 10 100 46Q114 10 130 14Q142 18 120 50Z" fill="#FFD45C" stroke="#2E2A33" stroke-width="4" stroke-linejoin="round"/>' +
    '<rect x="16" y="46" width="168" height="26" rx="8" fill="#5A80EA" stroke="#2E2A33" stroke-width="4"/>' +
    '<rect x="86" y="46" width="28" height="26" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/>' +
    '<path d="M26 54H70" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".35"/></g></svg>';
}
fxReveal = function ({ title, balls }) {
  const list = (balls || []).filter((b) => MO_BALLS[b]);
  const isChest = /coffre/i.test(title || "");
  return new Promise((resolve) => {
    const n = list.length, cols = n > 4 ? 3 : Math.max(1, n);
    const spots = list.map((_, i) => ({ x: ((i % cols) - (cols - 1) / 2) * 84, y: 268 + Math.floor(i / cols) * 86 }));
    const el = document.createElement("div");
    el.className = "fx-reveal mo-reveal" + (fxReduced() ? " is-static" : "");
    el.setAttribute("role", "dialog"); el.setAttribute("aria-label", title);
    el.innerHTML = '<div class="mo-rays" aria-hidden="true"></div><div class="mo-glow" aria-hidden="true"></div>' +
      '<div class="fx-reveal-box"><div class="fx-reveal-title">' + escapeHtml(title) + '</div>' +
      '<div class="mo-reveal-stage" style="height:' + (290 + Math.ceil(n / cols) * 86) + 'px"><div class="mo-box">' + (isChest ? moChestSvg() : moGiftSvg()) + '</div>' +
      list.map((b, i) => '<span class="mo-out" style="left:calc(50% + ' + spots[i].x + 'px);top:' + spots[i].y + 'px">' + moBallSvg(b) + '<small>' + MO_BALL_NAMES[b] + '</small></span>').join("") + '</div>' +
      '<button type="button" class="fx-reveal-skip">' + (fxReduced() ? "Super !" : "Passer ›") + '</button></div>';
    document.body.appendChild(el);
    const box = el.querySelector(".mo-box"), lid = el.querySelector(".mo-lid"), seam = el.querySelector(".mo-seam");
    const outs = Array.from(el.querySelectorAll(".mo-out"));
    const place = (extra) => "translateX(-50%) " + (extra || "");
    let leaving = false;
    const leave = () => {
      if (leaving) return; leaving = true;
      const bag = document.getElementById("ball-bag-btn");
      el.classList.add("is-leaving");
      if (!bag || fxReduced()) { el.remove(); resolve(); return; }
      const to = bag.getBoundingClientRect();
      outs.forEach((o, i) => {
        o.getAnimations().forEach((a) => a.cancel());
        o.style.opacity = "1";
        const small = o.querySelector("small");
        small.getAnimations().forEach((a) => a.cancel()); small.style.opacity = "0";
        const from = o.getBoundingClientRect();
        const dx = Math.round(to.left + to.width / 2 - from.left - from.width / 2), dy = Math.round(to.top + to.height / 2 - from.top - from.height / 2);
        moAnim(o, [{ transform: place() }, { transform: place("translateY(10px) scale(1.08)"), offset: .18 }, { transform: "translate(calc(-50% + " + dx + "px)," + dy + "px) scale(.3)", opacity: .9 }],
          { duration: 560, delay: i * 90, easing: "cubic-bezier(.6,0,.4,1)" });
        setTimeout(() => moSfx("collect"), fxMs(520 + i * 90));
      });
      setTimeout(() => { el.remove(); bag.classList.add("fx-bump"); setTimeout(() => bag.classList.remove("fx-bump"), fxMs(500)); resolve(); }, fxMs(620 + n * 90));
    };
    el.querySelector(".fx-reveal-skip").addEventListener("click", () => { run.stop(); leave(); });
    const run = moRunner(() => {});
    if (fxReduced()) { outs.forEach((o) => { o.style.opacity = "1"; o.querySelector("small").style.opacity = "1"; }); return; }
    (async () => {
      // Le coffre tombe et s'écrase un peu.
      await moAnim(box, [{ transform: "translateY(-240px) scale(.9)", opacity: 0 }, { transform: "translateY(0) scale(1.08,.88)", opacity: 1, offset: .7, easing: MO_OUT }, { transform: "none", opacity: 1 }], { duration: 620, easing: MO_IN });
      // 3 secousses de plus en plus fortes ; la lumière passe par la fente.
      for (let i = 0; i < 3; i++) {
        if (!(await run.wait(i ? 260 : 380))) return;
        const a = 4 + i * 3;
        moSfx("shake");
        moAnim(seam, [{ opacity: 0 }, { opacity: .5 + i * .25 }, { opacity: .2 + i * .2 }], { duration: 400 });
        moAnim(lid, [{ transform: "translateY(0)" }, { transform: "translateY(" + (-3 - i * 3) + "px)" }, { transform: "translateY(0)" }], { duration: 400, easing: "ease-out" });
        await moAnim(box, [{ transform: "rotate(0)" }, { transform: "rotate(" + -a + "deg) scale(1.03,.97)" }, { transform: "rotate(" + a + "deg)" }, { transform: "rotate(" + -a / 2 + "deg)" }, { transform: "none" }], { duration: 400, easing: "ease-in-out" });
        if (run.over) return;
      }
      if (!(await run.wait(200))) return;
      // Élan, puis le couvercle saute : lumière, rayons, étincelles.
      await moAnim(box, [{ transform: "none" }, { transform: "scale(1.1,.86)" }], { duration: 170, easing: MO_OUT });
      if (run.over) return;
      moSfx("open"); el.classList.add("is-open");
      moAnim(box, [{ transform: "scale(1.1,.86)" }, { transform: "scale(.96,1.06)" }, { transform: "none" }], { duration: 420, easing: MO_BACK });
      moAnim(lid, isChest ? [{ transform: "none" }, { transform: "translate(-6px,-40px) rotate(-62deg)", offset: .6 }, { transform: "translate(-4px,-30px) rotate(-52deg)" }]
        : [{ transform: "none" }, { transform: "translate(8px,-70px) rotate(18deg)", offset: .6 }, { transform: "translate(14px,-56px) rotate(24deg)" }], { duration: 520, easing: MO_OUT });
      for (let i = 0; i < 14; i++) {
        const s = document.createElement("i"); s.className = "mo-spark"; box.appendChild(s);
        const ang = -Math.PI / 2 + (Math.random() - .5) * 2.4, d = 80 + Math.random() * 110;
        moAnim(s, [{ opacity: 1, transform: "translate(0,0)" }, { opacity: 0, transform: "translate(" + Math.round(Math.cos(ang) * d) + "px," + Math.round(Math.sin(ang) * d) + "px) scale(.3)" }], { duration: 900 + Math.random() * 400, delay: 60 + i * 20, easing: MO_OUT });
      }
      if (!(await run.wait(200))) return;
      // Les Balls jaillissent en arc, une à une, et rebondissent.
      for (let i = 0; i < n; i++) {
        const o = outs[i], kf = [];
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          kf.push({ opacity: Math.min(1, t * 4), transform: "translate(calc(-50% + " + Math.round(-spots[i].x * (1 - t)) + "px)," + Math.round((150 - spots[i].y) * (1 - t) - Math.sin(Math.PI * t) * 150) + "px) rotate(" + Math.round(t * 360 * (i % 2 ? -1 : 1)) + "deg) scale(" + (.4 + t * .6).toFixed(2) + ")", offset: t });
        }
        moSfx("pop");
        moAnim(o, kf, { duration: 600, easing: "cubic-bezier(.3,.3,.4,1)" }).then(() => {
          if (leaving) return;
          moAnim(o, [{ transform: place("scale(1.15,.8)") }, { transform: place("translateY(-16px) scale(.95,1.05)") }, { transform: place() }], { duration: 360, easing: MO_BACK });
          moAnim(o.querySelector("small"), [{ opacity: 0 }, { opacity: 1 }], { duration: 280 });
        });
        if (!(await run.wait(240))) return;
      }
      if (!(await run.wait(1500))) return;
      leave();
    })();
  });
};
window.fxReveal = fxReveal;

// --- ✨ Shiny : un reflet passe deux fois sur le Pokémon ---
if (typeof shinyIntroFx === "function") {
  const shinyIntroFxBeforeMotion = shinyIntroFx;
  shinyIntroFx = function (scene) {
    shinyIntroFxBeforeMotion.apply(this, arguments);
    const stage = scene && scene.querySelector(".wild-stage.is-shiny"), mon = stage && stage.querySelector(".wild-mon");
    if (!mon || fxReduced() || stage.querySelector(".mo-shine")) return;
    const shine = mon.cloneNode(false);
    shine.classList.add("mo-shine"); shine.removeAttribute("alt"); shine.setAttribute("aria-hidden", "true");
    mon.after(shine);
    const sweep = [{ maskPosition: "100% 0", webkitMaskPosition: "100% 0" }, { maskPosition: "0% 0", webkitMaskPosition: "0% 0" }];
    shine.animate(sweep, { duration: fxMs(900), delay: fxMs(1300), easing: "ease-in-out" });
    setTimeout(() => moSfx("glint"), fxMs(1650)); setTimeout(() => moSfx("glint"), fxMs(2850));
    shine.animate(sweep, { duration: fxMs(900), delay: fxMs(2500), easing: "ease-in-out" }).finished.then(() => shine.remove()).catch(() => {});
    const fx = stage.querySelector(".fx-shiny");
    if (fx) {
      const second = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3, r = 80 + (i % 2) * 26;
        return '<i style="--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r) + 'px;animation-delay:' + (2.1 + (i % 3) * 0.07) + 's">✦</i>';
      }).join("");
      fx.insertAdjacentHTML("beforeend", '<div class="fx-shiny-stars is-second">' + second + '</div>');
    }
  };
}

// --- ⚪ 1re capture : la carte se retourne, puis la couleur arrive en vague ---
if (typeof fxCaptureCard === "function") {
  const fxCaptureCardBeforeMotion = fxCaptureCard;
  fxCaptureCard = function (p, shiny) {
    const out = fxCaptureCardBeforeMotion.apply(this, arguments);
    const all = document.querySelectorAll(".fx-catch"), wrap = all[all.length - 1];
    if (!wrap || fxReduced()) return out;
    const card = wrap.querySelector(".fx-catch-card"), img = wrap.querySelector(".fx-catch-art img");
    wrap.classList.add("is-motion");
    const back = document.createElement("div");
    back.className = "mo-catch-back"; back.setAttribute("aria-hidden", "true"); back.innerHTML = moBallSvg("poke");
    card.appendChild(back);
    if (img) {
      const color = img.cloneNode(false);
      color.className = "mo-catch-color"; color.setAttribute("aria-hidden", "true");
      img.after(color);
      moAnim(color, [{ maskPosition: "100% 0", webkitMaskPosition: "100% 0" }, { maskPosition: "0% 0", webkitMaskPosition: "0% 0" }], { duration: 900, delay: 900, easing: "ease-in-out" });
      setTimeout(() => moSfx("sparkle"), fxMs(1000));
    }
    (async () => {
      await moAnim(card, [{ transform: "perspective(900px) translateY(40px) scale(.7) rotateY(0)", opacity: 0 }, { transform: "perspective(900px) translateY(0) scale(1) rotateY(0)", opacity: 1, offset: .55 }, { transform: "perspective(900px) rotateY(0)", opacity: 1 }], { duration: 420, easing: MO_BACK });
      moSfx("flip");
      await moAnim(card, [{ transform: "perspective(900px) rotateY(0)" }, { transform: "perspective(900px) rotateY(90deg)" }], { duration: 220, easing: MO_IN });
      back.remove();
      await moAnim(card, [{ transform: "perspective(900px) rotateY(-90deg)" }, { transform: "perspective(900px) rotateY(10deg)", offset: .7 }, { transform: "perspective(900px) rotateY(0)" }], { duration: 420, easing: MO_OUT });
    })();
    return out;
  };
  window.fxCaptureCard = fxCaptureCard;
}
