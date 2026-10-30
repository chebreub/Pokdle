// "5 cris Pokémon" comment challenge: the real cries with live bars, answers at the end.
window.SCENE_SRC = 'quiz5';
window.makeScene = (IDX) => {
  const Q = [['25', 'Pikachu', 'FACILE', '#5DBE7E'], ['448', 'Lucario', 'MOYEN', '#FFD45C'], ['571', 'Zoroark', 'MOYEN', '#FFD45C'], ['250', 'Ho-Oh', 'DIFFICILE', '#FF9F5A'], ['321', 'Wailord', 'EXPERT', '#FF6B6B']];
  const H0 = 3.0, RD = 4.2, tA = H0 + Q.length * RD, E = tA + 4.4, total = E + 4.2;
  // The real cries (PokeAPI), each played twice when it fits; bars follow their loudness.
  const LEN = { 25: .96, 448: .66, 571: 1.35, 250: 1.16, 321: 1.97 };
  const ENV = {}; Q.forEach(([id]) => { const x = new XMLHttpRequest(); x.open('GET', `assets/env-${id}.json`, false); x.send(); ENV[id] = JSON.parse(x.responseText); });
  const PLAYS = Q.map(([id], i) => { const a = H0 + i * RD + .5, r = a + LEN[id] + .5; return r + LEN[id] <= H0 + (i + 1) * RD - .15 ? [a, r] : [a]; });
  const N = {};
  const fx = (name, t, vol = 1) => ({ file: `assets/sfx/${name}.wav`, t, vol });
  const audio = [fx('whoosh', .04, .9), fx('thump', .33, .8), fx('swish', .42, .7), fx('pop', .82, .35), fx('pop', .94, .35), fx('pop', 1.06, .35), fx('whoosh', 2.55, .6)];
  Q.forEach(([id], i) => { const t0 = H0 + i * RD; audio.push(fx('whoosh', t0 - .05, .45)); PLAYS[i].forEach((p) => audio.push({ file: `assets/cry-${id}.ogg`, t: p, vol: 1.0 })); });
  audio.push(fx('riser', tA - 1.1, .45), fx('boom', tA, .9), ...Q.map((q, i) => fx('pop', tA + .3 + i * .28, .55)), fx('shimmer', tA + .3, .5), fx('thump', tA + 1.9, .5));
  audio.push(fx('whoosh_long', E, .7), fx('swish', E + .4, .5), fx('pop', E + 1.2, .5), fx('pop', E + 1.55, .3), fx('pop', E + 1.65, .3), fx('shimmer', E + 1.8, .35));
  shakes.push({ t: .36, amp: 16, dur: .35 }, { t: tA, amp: 22, dur: .45 }, { t: E + .3, amp: 10, dur: .3 });
  Q.forEach((q, i) => shakes.push({ t: H0 + i * RD + .3, amp: 7, dur: .22 }));
  const card = (cls, html, css) => { const d = el('div', cls, $('fx'), html); d.style.cssText = css; return d; };
  return {
    cards: [], total, audio,
    build() {
      const hb = $('hookBig');
      N.hBrand = el('div', '', hb, '<img src="assets/favicon.svg" style="width:70px;height:70px;vertical-align:middle;margin-right:18px">pokdle.fr'); N.hBrand.style.cssText = 'position:absolute;left:50%;top:420px;padding:14px 34px 14px 20px;border-radius:999px;background:#FFF8EF;color:#2E2A33;font:700 64px Fredoka;white-space:nowrap;box-shadow:0 12px 0 rgba(0,0,0,.25)';
      N.hPill = el('div', 'pill', hb, 'Défi cri · 🔊 Monte le son'); N.hPill.style.cssText += 'background:rgba(255,255,255,.14);color:#fff;left:50%;top:560px';
      N.h1 = K(hb, '5 CRIS', { size: 165, y: 665 });
      const mk = el('div', 'mask', hb); mk.style.cssText += 'top:905px;height:190px'; N.h2 = K(mk, 'POKÉMON', { size: 160, color: '#FFD45C', y: 10 });
      N.h3 = el('div', '', hb); N.h3.style.cssText = 'position:absolute;left:0;right:0;top:1110px;text-align:center;font:700 80px Fredoka;line-height:1;white-space:nowrap';
      N.h3w = ['T’EN', 'TROUVES', 'COMBIEN ?'].map((w) => { const d = el('span', '', N.h3, w); d.style.cssText = 'display:inline-block;margin:0 12px'; return d; });
      const hd = $('header');
      N.pill = el('div', 'pill', hd, 'pokdle.fr · Défi cri 🔊'); N.pill.style.cssText += 'background:rgba(255,255,255,.14);color:#fff;left:50%;top:150px;font-size:30px';
      N.hdr1 = K(hd, 'Trouve les 5 Pokémon', { size: 86, y: 225, echoes: 0 }); N.hdr2 = K(hd, 'Note tes réponses ✍️', { size: 80, y: 322, color: '#FFD45C', echoes: 0 });
      N.rounds = Q.map(([id, name, lvl, col], i) => {
        const c = card('', `<div style="position:absolute;left:44px;top:34px;font:900 30px Nunito;letter-spacing:.14em;color:#1f7a5c">CRI MYSTÈRE</div><div style="position:absolute;right:44px;top:22px;font:700 64px Fredoka;color:#2E2A33">#${i + 1}</div><div class="spk" style="position:absolute;left:310px;top:150px;width:200px;height:200px;border-radius:50%;background:#4069E0;display:flex;align-items:center;justify-content:center;font-size:96px;box-shadow:0 14px 0 rgba(0,0,0,.18)">🔊</div><div class="bars" style="position:absolute;left:80px;right:80px;top:400px;height:270px;display:flex;align-items:center;justify-content:space-between">${Array.from({ length: 26 }, () => '<i style="display:block;width:16px;height:18px;border-radius:8px;background:#7C5BD6"></i>').join('')}</div><div class="lbl" style="position:absolute;left:0;right:0;top:712px;text-align:center;font:800 44px Nunito;color:#2E2A33">Écoute bien…</div>`,
          'position:absolute;left:130px;top:520px;width:820px;height:820px;border-radius:52px;background:#FFF8EF;box-shadow:0 50px 100px rgba(0,0,0,.5),0 0 0 6px rgba(255,255,255,.16);opacity:0');
        const chip = card('', `#${i + 1}/5 · ${lvl}`, `position:absolute;left:50%;top:438px;padding:12px 30px;border-radius:999px;background:${col};color:#2E2A33;font:900 40px Nunito;letter-spacing:.06em;white-space:nowrap;opacity:0;box-shadow:0 10px 0 rgba(0,0,0,.22)`);
        const ring = card('', '<svg viewBox="0 0 200 200" style="position:absolute;inset:0"><circle cx="100" cy="100" r="86" fill="rgba(20,15,41,.55)" stroke="rgba(255,255,255,.18)" stroke-width="12"/><circle class="rg" cx="100" cy="100" r="86" fill="none" stroke="#FFD45C" stroke-width="12" stroke-linecap="round" transform="rotate(-90 100 100)" stroke-dasharray="540.4"/></svg><div class="nm" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 110px Fredoka;color:#fff">3</div>',
          'position:absolute;left:440px;top:1370px;width:200px;height:200px;opacity:0');
        return { c, chip, ring };
      });
      N.ansK = K($('reveal'), 'RÉPONSES', { size: 130, y: 190, color: '#FFD45C', stroke: 12, echoes: 3 });
      const pos = [[60, 400], [390, 400], [720, 400], [225, 800], [555, 800]];
      N.ans = Q.map(([id, name], i) => card('', `<div style="position:absolute;left:18px;top:14px;font:700 44px Fredoka;color:#7C5BD6">#${i + 1}</div><img src="assets/art-${id}.png" style="position:absolute;left:30px;top:30px;width:240px;height:240px"><div style="position:absolute;left:0;right:0;top:282px;text-align:center;font:800 40px Nunito;color:#2E2A33">${name}</div>`,
        `position:absolute;left:${pos[i][0]}px;top:${pos[i][1]}px;width:300px;height:350px;border-radius:40px;background:#FFF8EF;box-shadow:0 26px 50px rgba(0,0,0,.45);opacity:0`));
      N.q1 = K($('fx'), 'Combien t’en as trouvé ? 🤔', { size: 74, y: 1210, echoes: 0 });
      N.q2 = K($('fx'), 'Écris ton score /5 en commentaire 👇', { size: 56, y: 1310, color: '#FFD45C', echoes: 0, weight: 700 });
      const en = $('end');
      N.orbs = [['25', 750, 210, 14], ['571', 70, 300, -12], ['250', 800, 1660, 10]].map(([id, x, y, r]) => { const d = el('img', 'orb', en); d.src = `assets/art-${id}.png`; return { d, x, y, r }; });
      N.logo = el('img', '', en); N.logo.src = 'assets/favicon.svg'; N.logo.style.cssText = 'position:absolute;left:420px;top:470px;width:240px;height:240px';
      N.word = el('div', '', en); N.word.style.cssText = 'position:absolute;left:0;right:0;top:745px;text-align:center;font:700 178px Fredoka;color:#fff';
      N.letters = [...'Pokédle'].map((ch) => { const s = el('span', '', N.word, ch); s.style.display = 'inline-block'; return s; });
      const m1 = el('div', 'mask', en); m1.style.cssText += 'top:985px;height:80px'; N.l1 = el('div', '', m1, 'Entraîne-toi sur'); N.l1.style.cssText = 'font:800 60px Nunito';
      N.pillE = el('div', '', en, 'pokdle.fr<i></i>'); N.pillE.id = 'epill';
      N.dev = el('div', '', en); N.dev.style.cssText = 'position:absolute;left:0;right:0;top:1318px;text-align:center';
      N.devs = ['📱 Sur mobile', '💻 Sur PC'].map((txt) => { const d = el('span', '', N.dev, txt); d.style.cssText = 'display:inline-block;margin:0 12px;padding:14px 30px;border-radius:999px;background:rgba(255,255,255,.16);border:3px solid rgba(255,255,255,.35);font:800 46px Nunito;color:#fff'; return d; });
      N.l2 = el('div', '', en, 'Sans compte · Plus de 20 jeux Pokémon'); N.l2.style.cssText = 'position:absolute;left:0;right:0;top:1442px;text-align:center;font:800 44px Nunito;color:rgba(255,255,255,.88)';
      N.sub = el('div', '', en, '🔔 Abonne-toi pour le prochain défi'); N.sub.style.cssText = 'position:absolute;left:50%;top:1525px;padding:16px 38px;border-radius:999px;background:#FFD45C;color:#2E2A33;font:900 50px Nunito;white-space:nowrap;box-shadow:0 10px 0 rgba(0,0,0,.25);opacity:0';
    },
    render(t) {
      renderBg(t, 1);
      // hook
      const bk = seg(t, 0, .4); N.hBrand.style.opacity = .4 + .6 * clamp(bk * 2); N.hBrand.style.transform = `translateX(-50%) scale(${lerp(.6, 1, spring(bk))}) rotate(${Math.sin(t * 2) * 1.5}deg)`;
      N.hPill.style.opacity = .35 + .65 * seg(t, 0, .25); N.hPill.style.transform = `translateX(-50%) scale(${lerp(.6, 1, spring(seg(t, 0, .45)))})`;
      slam(N.h1, t, .06, { from: 3, dur: .3 });
      const m2 = seg(t, .42, .8); N.h2.style.transform = `translateY(${(1 - eOut5(m2)) * 190}px) skewY(${(1 - eOut(m2)) * 8}deg)`; N.h2.style.opacity = m2 > 0 ? 1 : 0;
      N.h2.echo.forEach((e, i) => { const q = seg(t, .8 + i * .06, 1.3 + i * .06); e.style.opacity = q > 0 && q < 1 ? (1 - q) * .7 : 0; e.style.transform = `scale(${1 + q * (.12 + i * .08)})`; });
      N.h3w.forEach((d, i) => { const k = seg(t, .8 + i * .12, 1.3 + i * .12); d.style.opacity = clamp(k * 3); d.style.transform = `translateY(${(1 - eOut(k)) * 80}px) scale(${lerp(.3, 1, spring(k))}) rotate(${(1 - eOut(k)) * (i % 2 ? 12 : -12)}deg)`; });
      const ho = eInOut(seg(t, 2.55, 3.0));
      $('hookBig').style.transform = `translateY(${-ho * 520}px) scale(${(1 + t * .015) * lerp(1, .42, ho)})`; $('hookBig').style.opacity = 1 - ho;
      const hk = seg(t, 2.7, 3.1), hx = seg(t, tA - .1, tA + .2);
      $('header').style.opacity = clamp(hk * 2) * (1 - hx); $('header').style.transform = `translateY(${(1 - eOut(hk)) * 40 + Math.sin(t * 1.4) * 3}px) scale(${lerp(.9, 1, spring(hk))})`;
      N.pill.style.transform = 'translateX(-50%)';
      // rounds
      N.rounds.forEach((r, i) => {
        const t0 = H0 + i * RD, a = seg(t, t0, t0 + .35), b = seg(t, t0 + RD - .32, t0 + RD);
        const x = (1 - eOut5(a)) * 1150 - eIn(b) * 1150, rot = (1 - eOut(a)) * 14 - eIn(b) * 14, bl = (1 - a) * 14 + b * 14;
        const on = t >= t0 - .01 && t < t0 + RD;
        r.c.style.opacity = on ? 1 : 0; r.c.style.filter = bl > .2 ? `blur(${bl}px)` : 'none';
        r.c.style.transform = `perspective(1600px) translateX(${x}px) rotateY(${rot}deg) rotateX(5deg) scale(${1 + .05 * seg(t, t0, t0 + RD)}) translateY(${Math.sin(t * 1.2) * 6}px)`;
        const ck = seg(t, t0 + .15, t0 + .5); r.chip.style.opacity = on ? clamp(ck * 3) * (1 - b) : 0; r.chip.style.transform = `translateX(-50%) scale(${lerp(.3, 1, spring(ck))}) rotate(-2deg)`;
        const local = t - t0 - (RD - 2.95), n = Math.floor(local / .9), f = local / .9 - n;
        r.ring.style.opacity = on && local > -.1 && n < 3 ? clamp((local + .1) * 6) : 0;
        r.ring.querySelector('.nm').textContent = String(3 - clamp(n, 0, 2));
        r.ring.querySelector('.nm').style.transform = `scale(${lerp(1.6, 1, eBack(clamp(f / .3)))})`;
        r.ring.querySelector('.rg').setAttribute('stroke-dashoffset', String(540.4 * clamp(f)));
        const id = Q[i][0]; let lvl = 0;
        PLAYS[i].forEach((p) => { const k = Math.floor((t - p) * 60); if (k >= 0 && k < ENV[id].length) lvl = Math.max(lvl, ENV[id][k]); });
        r.c.querySelectorAll('.bars i').forEach((b, j) => { const sh = .35 + .65 * Math.abs(Math.sin(j * .9 + 1.3)), wob = .5 + .5 * Math.sin(t * 23 + j * 1.7); b.style.height = (18 + lvl * 240 * sh * (.65 + .35 * wob)) + 'px'; b.style.opacity = .35 + .65 * Math.min(1, lvl * 1.5 + .1); });
        r.c.querySelector('.spk').style.transform = `scale(${1 + lvl * .18})`;
        r.c.querySelector('.lbl').textContent = t > PLAYS[i][PLAYS[i].length - 1] + LEN[id] + .2 ? 'Alors, c’est qui ? 🤔' : 'Écoute bien…';
      });
      // answers
      const f1 = t >= tA ? Math.max(0, 1 - (t - tA) / .35) : 0; $('flash').style.opacity = f1 * .85;
      $('reveal').style.opacity = seg(t, tA, tA + .1) * (1 - (t >= E + .33 ? 1 : 0));
      slam(N.ansK, t, tA + .05, { from: 2.6, dur: .26 }); if (t < tA + .05) N.ansK.style.opacity = 0;
      N.ans.forEach((d, i) => { const k = seg(t, tA + .3 + i * .28, tA + .75 + i * .28); d.style.opacity = t < E + .33 ? clamp(k * 3) : 0; d.style.transform = `translateY(${(1 - eOut(k)) * 120 + Math.sin(t * 1.6 + i) * 6}px) scale(${lerp(.3, 1, eBack(k, 2.2))}) rotate(${(1 - eOut(k)) * (i % 2 ? 14 : -14) + Math.sin(t + i) * 1.5}deg)`; });
      const qa = t < E + .33 ? 1 : 0;
      slam(N.q1, t, tA + 1.9, { from: 2.2, dur: .24 }); if (t < tA + 1.9 || !qa) N.q1.style.opacity = 0;
      pop(N.q2, t, tA + 2.3, { dy: 40 }); if (!qa) N.q2.style.opacity = 0; else N.q2.style.transform += ` scale(${1 + .025 * Math.sin(t * 6)})`;
      // end card
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
        N.l2.style.opacity = seg(t, E + 1.8, E + 2.2);
        const sb = seg(t, E + 2.1, E + 2.6); N.sub.style.opacity = clamp(sb * 3); N.sub.style.transform = `translateX(-50%) scale(${lerp(.3, 1, eBack(sb, 2.2)) * (1 + Math.sin(t * 5) * .02)})`;
        N.orbs.forEach((o, i) => { const q = seg(t, E + .6 + i * .12, E + 1.2 + i * .12); o.d.style.left = o.x + 'px'; o.d.style.top = o.y + 'px'; o.d.style.opacity = clamp(q * 3); o.d.style.transform = `translateY(${Math.sin(t * 1.6 + i * 2) * 16}px) rotate(${o.r + Math.sin(t * 1.2 + i) * 4}deg) scale(${lerp(.1, 1, eBack(q, 2))})`; });
      }
    },
  };
};
