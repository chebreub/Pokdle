window.makeProScene = (IDX, cfg) => {
  const sub = cfg.subs || evs('submit'), foc = cfg.foc || evs('focus'), cd = cfg.cd ?? evs('countdown')[0].t;
  const R = cfg.R ?? sub[sub.length - 1].t + (cfg.revealDelay || .3), E = R + (cfg.revealHold ?? 3.6), total = E + (cfg.endHold || 5.0);
  const wrong = cfg.wrong || sub.slice(0, -1);
  const bump = (u, len = .4) => (u > 0 && u < len ? Math.sin(Math.PI * u / len) : 0);
  const { A, B, more = [] } = cfg.cards({ sub, foc, cd, R, wrong });
  const enter = (t, t0) => { const k = seg(t, t0, t0 + .75); return { y: (1 - eOut5(k)) * 1150, rx: lerp(62, 0, eOut(k)), o: clamp(k * 3) }; };
  if (A && !A.motion) A.motion = (t) => {
    const en = enter(t, 1.95 + HK), idle = { rx: 6 + Math.sin(t * .5) * 1.5, ry: Math.sin(t * .7) * 3.5, y: Math.sin(t * 1.1) * 6 };
    const cdk = eInOut(seg(t, cd, cd + .6)), ex = eIn(seg(t, R - .08, R + .22));
    const beat = (t > cd && t < cd + 3.1) ? .03 * bump((t - cd - .15) % 1, .3) : 0;
    const punch = .045 * wrong.reduce((m, s) => Math.max(m, bump(t - s.t - .1, .35)), 0);
    const gl = [2.45 + HK, ...wrong.map((s) => s.t + .1)].reduce((m, g) => (t >= g && t < g + .55 ? (t - g) / .55 : m), -1);
    return { y: en.y + idle.y - cdk * (cfg.cdLift ?? 20) + ex * 900, rx: en.rx + idle.rx + ex * 55, ry: idle.ry * (1 - cdk), o: en.o * (1 - ex) * (1 - (cfg.cdDim || 0) * (cfg.cdDim ? eInOut(seg(t, cd, cd + .3)) * (1 - eInOut(seg(t, cd + 3.05, cd + 3.3))) : 0)), s: (1 + punch + beat) * (1 + cdk * (cfg.cdScale ?? .07)),
      gloss: gl >= 0 ? .9 * Math.sin(gl * Math.PI) : 0, glossX: lerp(-70, 70, Math.max(0, gl)), rim: t > cd && t < R ? .6 + .4 * Math.sin((t - cd) * Math.PI * 2) : 0 };
  };
  if (B && !B.motion) B.motion = (t) => {
    const en = enter(t, 2.15 + HK), ex = eIn(seg(t, cd, cd + .5));
    return { y: en.y + Math.sin(t * 1.1 + 1) * 6 + ex * 1000, z: -60, rx: en.rx + 6 + Math.sin(t * .5 + 1) * 1.5 + ex * 40, ry: Math.sin(t * .7 + .8) * 3.5, o: en.o * (1 - ex) };
  };
  const shakesAdd = (t, amp, dur) => shakes.push({ t, amp, dur });
  shakesAdd(.36, 16, .35); wrong.forEach((s) => shakesAdd(s.t + .1, 6, .22));
  [0, 1, 2].forEach((i) => shakesAdd(cd + .15 + i + .28, 11, .3)); shakesAdd(R, 26, .5); shakesAdd(R + .55, 16, .35); shakesAdd(E + .3, 10, .3);
  const STAMPS = cfg.stamps;
  const N = {};
  return {
    cards: [A, B, ...more].filter(Boolean), total,
    audio: [...(cfg.extraAudio ? cfg.extraAudio({ sub, R }) : []), { file: `assets/cry-${cfg.art}.ogg`, t: R + .6 }, ...(() => {
      // Sound design: soft, original effects placed on the motion (no music, no melody).
      const fx = (name, t, vol = 1) => ({ file: `assets/sfx/${name}.wav`, t: Math.max(0, t), vol });
      const out = [fx('whoosh', .04, .9), fx('thump', .33, .8), fx('swish', .42, .7), fx('pop', .82, .35), fx('pop', .94, .35), fx('pop', 1.06, .35),
        fx('whoosh', 1.83 + HK, .6), fx('whoosh_long', 1.95 + HK, .45)];
      IDX.events.filter((e) => e.x != null && e.t > 1.9 + HK && e.t < R).forEach((e) => out.push(fx('tap', e.t, .5)));
      wrong.forEach((w) => out.push(fx('thump', w.t + .1, .45)));
      STAMPS.forEach((st) => { const [t0] = st.when({ sub, foc, cd, wrong }); if (t0 < R) out.push(fx('pop', t0, .5), fx('thump', t0 + .22, .35)); });
      out.push(fx('whoosh', cd, .55)); [0, 1, 2].forEach((i) => out.push(fx('tick', cd + .15 + i + .26, .9)));
      out.push(fx('riser', R - 1.1, .55), fx('boom', R, .9), fx('pop', R + .55, .5), fx('shimmer', R + .55, .6), fx('thump', R + .86, .45));
      out.push(fx('whoosh_long', E, .7), fx('swish', E + .4, .5), fx('pop', E + .62, .3), fx('pop', E + 1.2, .5), fx('pop', E + 1.55, .3), fx('pop', E + 1.65, .3), fx('shimmer', E + 1.8, .35));
      return out;
    })()],
    build() {
      const hb = $('hookBig');
      N.hPill = el('div', 'pill', hb, cfg.kicker);
      if (cfg.brand) { N.hBrand = el('div', '', hb, '<img src="assets/favicon.svg" style="width:70px;height:70px;vertical-align:middle;margin-right:18px">pokdle.fr'); N.hBrand.style.cssText = 'position:absolute;left:50%;top:420px;padding:14px 34px 14px 20px;border-radius:999px;background:#FFF8EF;color:#2E2A33;font:700 64px Fredoka;white-space:nowrap;box-shadow:0 12px 0 rgba(0,0,0,.25)'; } N.hPill.style.cssText += (cfg.kickerStyle || 'background:rgba(255,255,255,.14);color:#fff;') + 'left:50%;top:560px';
      N.h1 = K(hb, cfg.hook[0], { size: cfg.hookSize || 250, y: 650, stroke: 0 });
      const mk = el('div', 'mask', hb); mk.style.cssText += 'top:905px;height:190px'; N.h2 = K(mk, cfg.hook[1], { size: cfg.hook2Size || 160, color: '#FFD45C', y: 10 });
      N.h3 = el('div', '', hb); N.h3.style.cssText = `position:absolute;left:0;right:0;top:1110px;text-align:center;font:700 ${cfg.hook3Size || 128}px Fredoka;line-height:1;white-space:nowrap`; N.h3w = cfg.hook[2].map((w) => { const d = el('span', '', N.h3, w); d.style.cssText = 'display:inline-block;margin:0 22px'; return d; });
      const hd = $('header');
      N.pill = el('div', 'pill', hd, cfg.brand ? 'pokdle.fr · ' + cfg.kicker : cfg.kicker); N.pill.style.cssText += (cfg.kickerStyle || 'background:rgba(255,255,255,.14);color:#fff;') + 'left:50%;top:150px;font-size:30px';
      N.hdr1 = K(hd, cfg.header[0], { size: 86, y: 225, echoes: 0 }); N.hdr2 = K(hd, cfg.header[1], { size: 86, y: 318, color: '#FFD45C', echoes: 0 });
      N.caps = (cfg.captions || []).map(([t0, txt]) => { const d = K(hd, txt, { size: Math.min(80, Math.floor(1900 / Math.max(10, txt.length))), y: 322, color: '#FFD45C', echoes: 0 }); d.t0 = t0; return d; });
      const fx = $('fx');
      if (cfg.meter) {
      N.meter = el('div', '', fx); N.meter.style.cssText = 'position:absolute;left:100px;top:420px;width:880px;height:26px';
      N.segs = Array.from({ length: 8 }, (_, i) => { const s = el('div', 'seg', N.meter, '<i></i>'); s.style.left = i * 112 + 'px'; s.style.width = '100px'; return s.firstChild; });
      }
      N.ring = el('div', 'ring', fx);
      N.stamps = STAMPS.map((st) => K(fx, st.text, { size: st.size || 96, y: st.y, stroke: 13, echoes: 2 }));
      const cnt = $('count');
      N.cap = el('div', '', cnt, cfg.cap || 'Tu l’as ? Écris-le en <b style="color:#FFD45C">commentaire</b> 👇'); N.cap.style.cssText = `position:absolute;left:0;right:0;top:${cfg.capY || 1120}px;text-align:center;font:800 54px Nunito`;
      N.nums = ['3', '2', '1'].map((n) => K(cnt, n, { size: 440, y: cfg.numY || 1190, stroke: 0, echoes: 3 }));
      N.tick = el('div', 'ring', cnt);
      N.rep = K(cnt, cfg.preReveal || 'RÉPONSE…', { size: 150, y: (cfg.numY || 1190) + 110, color: '#FFD45C', echoes: 2 });
      const rv = $('reveal');
      N.rays = el('div', '', rv); N.rays.id = 'rays'; N.halo = el('div', '', rv); N.halo.id = 'halo';
      N.sil = el('img', 'art', rv); N.sil.src = `assets/art-${cfg.art}.png`; N.sil.style.filter = 'brightness(0) drop-shadow(0 0 18px #fff) drop-shadow(0 0 40px rgba(255,212,92,.8))';
      N.art = el('img', 'art', rv); N.art.src = `assets/art-${cfg.art}.png`; N.art.style.filter = 'drop-shadow(0 30px 40px rgba(0,0,0,.45))';
      N.shock = el('div', 'ring', rv);
      const Rr = rnd(11), cols = ['#FFD45C', '#7C5BD6', '#4069E0', '#5DBE7E', '#FF7A7A', '#fff'];
      N.conf = Array.from({ length: 110 }, () => { const d = el('div', 'conf', rv); d.style.background = cols[(Rr() * cols.length) | 0]; return { d, a: Rr() * Math.PI * 2, v: 900 + Rr() * 1500, spin: (Rr() - .5) * 1500, s: .6 + Rr() * .9, dl: Rr() * .12 }; });
      N.sparks = Array.from({ length: 16 }, () => { const d = el('div', 'spark', rv); return { d, x: 140 + Rr() * 800, y: 420 + Rr() * 800, p: Rr() * 6, sp: 1.5 + Rr() * 2 }; });
      N.kick = K(rv, cfg.kick || 'C’ÉTAIT…', { size: 66, y: 300, echoes: 0, weight: 600 });
      N.name = K(rv, cfg.name, { size: 158, y: 1255, color: '#FFD45C', stroke: 12, echoes: 3 });
      N.sub = K(rv, cfg.sub, { size: 58, y: 1445, echoes: 0, weight: 600 });
      cfg.build?.(N, { sub, foc, cd, R, E });
      const en = $('end');
      N.orbs = [[cfg.art, 750, 210, 14], [cfg.orbs[0], 70, 300, -12], [cfg.orbs[1], 790, 1530, 10]].map(([id, x, y, r]) => { const d = el('img', 'orb', en); d.src = `assets/art-${id}.png`; return { d, x, y, r }; });
      N.logo = el('img', '', en); N.logo.src = 'assets/favicon.svg'; N.logo.style.cssText = 'position:absolute;left:420px;top:470px;width:240px;height:240px';
      N.word = el('div', '', en); N.word.style.cssText = 'position:absolute;left:0;right:0;top:745px;text-align:center;font:700 178px Fredoka;color:#fff';
      N.letters = [...'Pokédle'].map((ch) => el('span', '', N.word, ch)); N.letters.forEach((s) => (s.style.display = 'inline-block'));
      const m1 = el('div', 'mask', en); m1.style.cssText += 'top:985px;height:80px'; N.l1 = el('div', '', m1, 'Joue gratuitement sur'); N.l1.style.cssText = 'font:800 60px Nunito';
      N.pillE = el('div', '', en, 'pokdle.fr<i></i>'); N.pillE.id = 'epill';
      N.l2 = el('div', '', en, cfg.endLine); N.l2.style.cssText = 'position:absolute;left:0;right:0;top:1442px;text-align:center;font:800 44px Nunito;color:rgba(255,255,255,.88)';
      N.dev = el('div', '', en); N.dev.style.cssText = 'position:absolute;left:0;right:0;top:1318px;text-align:center';
      N.devs = ['📱 Sur mobile', '💻 Sur PC'].map((txt) => { const d = el('span', '', N.dev, txt); d.style.cssText = 'display:inline-block;margin:0 12px;padding:14px 30px;border-radius:999px;background:rgba(255,255,255,.16);border:3px solid rgba(255,255,255,.35);font:800 46px Nunito;color:#fff'; return d; });
    },
    render(t) {
      cfg.render?.(t, N, { sub, foc, cd, R, E });
      renderBg(t, t > cd && t < R ? 5 : 1);
      $('speed').style.opacity = (t > cd && t < R + .9) ? .9 * seg(t, cd, cd + .3) * (1 - seg(t, R + .4, R + .9)) : 0;
      $('speed').style.transform = `rotate(${t * 40}deg) scale(1.6)`;
      // hook
      N.hPill.style.opacity = .35 + .65 * seg(t, 0, .25); N.hPill.style.transform = `translateX(-50%) scale(${lerp(.6, 1, spring(seg(t, 0, .45)))})`;
      if (N.hBrand) { const bk = seg(t, 0, .4); N.hBrand.style.opacity = .4 + .6 * clamp(bk * 2); N.hBrand.style.transform = `translateX(-50%) scale(${lerp(.6, 1, spring(bk))}) rotate(${Math.sin(t * 2) * 1.5}deg)`; }
      slam(N.h1, t, .06, { from: 3, dur: .3 });
      const m2 = seg(t, .42, .8); N.h2.style.transform = `translateY(${(1 - eOut5(m2)) * 190}px) skewY(${(1 - eOut(m2)) * 8}deg)`; N.h2.style.opacity = m2 > 0 ? 1 : 0;
      N.h2.echo.forEach((e, i) => { const q = seg(t, .8 + i * .06, 1.3 + i * .06); e.style.opacity = q > 0 && q < 1 ? (1 - q) * .7 : 0; e.style.transform = `scale(${1 + q * (.12 + i * .08)})`; });
      N.h3w.forEach((d, i) => { const k = seg(t, .8 + i * .12, 1.3 + i * .12); d.style.opacity = clamp(k * 3); d.style.transform = `translateY(${(1 - eOut(k)) * 80}px) scale(${lerp(.3, 1, spring(k))}) rotate(${(1 - eOut(k)) * (i % 2 ? 12 : -12)}deg)`; });
      const ho = eInOut(seg(t, 1.85 + HK, 2.3 + HK));
      $('hookBig').style.transform = `translateY(${-ho * 520}px) scale(${(1 + t * .015) * lerp(1, .42, ho)})`; $('hookBig').style.opacity = 1 - ho;
      const hk = seg(t, 2.0 + HK, 2.45 + HK), hx = seg(t, R - .1, R + .2);
      $('header').style.opacity = clamp(hk * 2) * (1 - hx); $('header').style.transform = `translateY(${(1 - eOut(hk)) * 40 - hx * 120 + Math.sin(t * 1.4) * 3}px) scale(${lerp(.9, 1, spring(hk))})`;
      N.pill.style.transform = 'translateX(-50%)';
      if (N.caps.length) {
        const cur = N.caps.reduce((c, d) => (t >= d.t0 ? d : c), null);
        N.hdr2.style.opacity = cur ? 0 : 1;
        N.caps.forEach((d) => { const on = d === cur, k = seg(t, d.t0, d.t0 + .35); d.style.opacity = on ? clamp(k * 3) : 0; d.style.transform = on ? `translateY(${(1 - eOut(k)) * 30}px) scale(${lerp(.7, 1, spring(k))})` : 'none'; });
      }
      // meter (mirrors the site's sharpness)
      if (N.meter) {
      const lvl = 1 + wrong.filter((s) => t > s.t + .25).length;
      const mo = seg(t, 2.3 + HK, 2.7 + HK) * (1 - seg(t, R - .1, R + .2));
      N.meter.style.opacity = mo; N.meter.style.transform = `translateY(${A.motion(t).y * .35}px)`;
      N.segs.forEach((f, i) => { let k = i < lvl ? 1 : 0; const s = wrong[i - 1]; if (i >= 1 && s) k = seg(t, s.t + .25, s.t + .55); if (i === 0) k = seg(t, 2.5 + HK, 2.8 + HK); if (t > R) k = Math.max(k, seg(t, R + i * .03, R + .2 + i * .03)); f.style.transform = `scaleX(${eOut(k)})`; f.parentNode.style.transform = `scaleY(${1 + .5 * bump(k, 1)})`; });
      }
      // shock ring on each wrong guess, centred on the pixel image
      let rk = -1; wrong.forEach((s) => { if (t >= s.t + .1 && t < s.t + .7) rk = (t - s.t - .1) / .6; });
      const cxA = A.x + A.w / 2, cyA = A.y + (cfg.ringY || A.h / 2) + A.motion(t).y;
      N.ring.style.cssText = `left:${cxA - 150}px;top:${cyA - 150}px;width:300px;height:300px;opacity:${rk >= 0 ? (1 - rk) * .7 : 0};transform:scale(${lerp(.5, 2.8, eOut(Math.max(0, rk)))})`;
      // stamps
      N.stamps.forEach((d, i) => { const st = STAMPS[i], [t0, t1] = st.when({ sub, foc, cd, wrong }); slam(d, t, t0, { from: 2.4, dur: .22, hold: t1 - t0, out: .22, rot: st.rot ?? (i % 2 ? 6 : -7), pre: `translateX(${st.dx ?? (i % 2 ? 150 : -120)}px)` }); if (t < t0) d.style.opacity = 0; });
      // countdown
      const ca = seg(t, cd, cd + .3) * (1 - seg(t, cd + 3.05, cd + 3.25));
      N.cap.style.opacity = ca; N.cap.style.transform = `scale(${lerp(.7, 1, spring(seg(t, cd, cd + .5)))})`;
      N.nums.forEach((d, i) => { const t0 = cd + .15 + i; slam(d, t, t0, { from: 3.2, dur: .28, hold: .8, out: .12 }); if (t < t0) d.style.opacity = 0; });
      let tk = -1; [0, 1, 2].forEach((i) => { const t0 = cd + .43 + i; if (t >= t0 && t < t0 + .5) tk = (t - t0) / .5; });
      N.tick.style.cssText = `left:390px;top:${(cfg.numY || 1190) + 70}px;width:300px;height:300px;border-color:#FFD45C;opacity:${tk >= 0 ? (1 - tk) * .8 : 0};transform:scale(${lerp(.6, 2.4, eOut(Math.max(0, tk)))})`;
      const rp = seg(t, cd + 3.15, cd + 3.35) * (1 - seg(t, R - .05, R + .05));
      N.rep.style.opacity = rp; N.rep.style.transform = `scale(${lerp(.6, 1, spring(seg(t, cd + 3.15, cd + 3.6))) * (1 + .04 * Math.sin(t * 22))})`; N.rep.echo.forEach((e) => (e.style.opacity = 0));
      // flash
      const f1 = t >= R ? Math.max(0, 1 - (t - R) / .35) : 0, f2 = t >= R + .55 ? Math.max(0, 1 - (t - R - .55) / .25) : 0;
      $('flash').style.opacity = Math.max(f1 * .9, f2 * .55);
      // reveal
      const rv = seg(t, R, R + .12); $('reveal').style.opacity = rv * (1 - seg(t, E + .3, E + .35));
      if (rv > 0) {
        const cx = 540, cy = 830, bob = Math.sin((t - R) * 2.3) * 12;
        N.rays.style.left = cx - 1000 + 'px'; N.rays.style.top = cy - 1000 + 'px'; N.rays.style.transform = `rotate(${(t - R) * 26}deg) scale(${lerp(.1, 1, eOut(seg(t, R, R + .8)))})`;
        N.halo.style.left = cx - 500 + 'px'; N.halo.style.top = cy - 500 + 'px'; N.halo.style.opacity = seg(t, R + .5, R + .8);
        const k = seg(t, R + .02, R + .5), c = seg(t, R + .55, R + .7);
        const tr = `translateY(${bob}px) scale(${lerp(.2, 1, eBack(k, 2.4)) * (1 + .06 * bump(t - R - .55, .3))}) rotate(${lerp(-20, 0, eOut(k)) + Math.sin((t - R) * 1.3) * 2}deg)`;
        for (const im of [N.sil, N.art]) { im.style.left = cx - 390 + 'px'; im.style.top = cy - 390 + 'px'; im.style.transform = tr; }
        N.sil.style.opacity = clamp(k * 3) * (1 - c); N.art.style.opacity = c;
        const sq = seg(t, R + .55, R + 1.15); N.shock.style.cssText = `left:${cx - 200}px;top:${cy - 200}px;width:400px;height:400px;border-color:#FFD45C;opacity:${sq > 0 && sq < 1 ? (1 - sq) : 0};transform:scale(${lerp(.4, 3.4, eOut(sq))})`;
        N.conf.forEach((p) => { const u = t - R - .55 - p.dl; if (u < 0) { p.d.style.opacity = 0; return; } const x = cx + Math.cos(p.a) * p.v * u * Math.exp(-u * 1.2), y = cy + Math.sin(p.a) * p.v * u * Math.exp(-u * 1.2) + 560 * u * u; p.d.style.opacity = clamp(1 - (u - 1.7) / .5); p.d.style.transform = `translate(${x}px,${y}px) rotate(${p.spin * u}deg) scale(${p.s})`; });
        N.sparks.forEach((p) => { const u = t - R - .7; const tw = u > 0 ? Math.max(0, Math.sin(u * p.sp * 3 + p.p)) : 0; p.d.style.opacity = tw; p.d.style.transform = `translate(${p.x}px,${p.y + Math.sin(u + p.p) * 20}px) scale(${.4 + tw})`; });
        pop(N.kick, t, R + .2, { dy: 40 });
        slam(N.name, t, R + .6, { from: 2.6, dur: .26 }); if (t < R + .6) N.name.style.opacity = 0;
        pop(N.sub, t, R + 1.1, { dy: 40 });
      }
      // wipe bands -> end card
      [['band1', 0], ['band2', .07], ['band3', .14]].forEach(([id, dl]) => { const k = seg(t, E + dl, E + dl + .62); $(id).style.transform = `rotate(-28deg) translateY(${lerp(2300, -2600, eInOut(k))}px)`; $(id).style.opacity = k > 0 && k < 1 ? 1 : 0; });
      $('end').style.opacity = t >= E + .33 ? 1 : 0;
      if (t >= E + .3) {
        const lg = seg(t, E + .35, E + 1.0);
        N.logo.style.transform = `translateY(${(1 - spring(lg, 9, 6)) * -600 + Math.sin(t * 2) * 6}px) rotate(${lerp(-360, 0, eOut(lg))}deg)`;
        N.letters.forEach((s, i) => { const q = seg(t, E + .55 + i * .05, E + 1.05 + i * .05); s.style.transform = `translateY(${(1 - spring(q, 10, 6)) * -260}px) rotate(${(1 - eOut(q)) * (i % 2 ? 20 : -20)}deg)`; s.style.opacity = clamp(q * 4); });
        const q1 = seg(t, E + 1.0, E + 1.4); N.l1.style.transform = `translateY(${(1 - eOut5(q1)) * 90}px)`;
        const p = seg(t, E + 1.15, E + 1.7); N.pillE.style.opacity = clamp(p * 3); N.pillE.style.transform = `scale(${lerp(.2, 1, eBack(p, 2.6)) * (1 + Math.sin(t * 4) * .012)})`;
        N.pillE.lastChild.style.left = lerp(-170, 900, t < E + 1.8 ? 0 : seg((t - E - 1.8) % 1.7, 0, .6)) + 'px';
        N.devs.forEach((d, i) => { const q = seg(t, E + 1.55 + i * .1, E + 2.0 + i * .1); d.style.opacity = clamp(q * 3); d.style.transform = `translateY(${(1 - eOut(q)) * 40}px) scale(${lerp(.5, 1, spring(q))})`; });
        N.l2.style.opacity = seg(t, E + 1.8, E + 2.2); N.l2.style.transform = `translateY(${(1 - eOut(seg(t, E + 1.6, E + 2.0))) * 30}px)`;
        N.orbs.forEach((o, i) => { const q = seg(t, E + .6 + i * .12, E + 1.2 + i * .12); o.d.style.left = o.x + 'px'; o.d.style.top = o.y + 'px'; o.d.style.opacity = clamp(q * 3); o.d.style.transform = `translateY(${Math.sin(t * 1.6 + i * 2) * 16}px) rotate(${o.r + Math.sin(t * 1.2 + i) * 4}deg) scale(${lerp(.1, 1, eBack(q, 2))})`; });
      }
    },
  };
};

window.makeScene = (IDX) => window.makeProScene(IDX, window.CFG(IDX));
