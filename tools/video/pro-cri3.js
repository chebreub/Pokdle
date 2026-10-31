// "Quel Pokémon fait ce cri ?" comment quiz: the real cry, three choices A/B/C, answers in the pinned comment.
window.SCENE_SRC = 'cri3';
window.makeScene = (IDX) => {
  // [answer id, level, colour, choices [id, name] x3]; answers: 1B 2A 3C 4C 5B (never shown in the video).
  const Q = [
    ['4', 'FACILE', '#5DBE7E', [['255', 'Poussifeu'], ['4', 'Salamèche'], ['390', 'Ouisticram']]],
    ['384', 'MOYEN', '#FFD45C', [['384', 'Rayquaza'], ['644', 'Zekrom'], ['483', 'Dialga']]],
    ['445', 'MOYEN', '#FFD45C', [['248', 'Tyranocif'], ['373', 'Drattak'], ['445', 'Carchacrok']]],
    ['778', 'DIFFICILE', '#FF9F5A', [['94', 'Ectoplasma'], ['354', 'Branette'], ['778', 'Mimiqui']]],
    ['921', 'EXPERT', '#FF6B6B', [['702', 'Dedenne'], ['921', 'Pohm'], ['417', 'Pachirisu']]],
  ];
  const L = ['A', 'B', 'C'];
  // Timed on the 150 BPM grid of the example track (beats at 0.07 + k × 0.4 s); E lands on its last hit.
  const H0 = 2.47, RD = 4.4, tC = H0 + Q.length * RD, E = 28.47, total = E + 3.6;
  const LEN = {}, ENV = {};
  Q.forEach(([id]) => { const x = new XMLHttpRequest(); x.open('GET', `assets/env-${id}.json`, false); x.send(); ENV[id] = JSON.parse(x.responseText); LEN[id] = ENV[id].length / 60; });
  const PLAYS = Q.map(([id], i) => { const a = H0 + i * RD + .5, r = a + LEN[id] + .5; return r + LEN[id] <= H0 + (i + 1) * RD - .15 ? [a, r] : [a]; });
  const N = {};
  const audio = [];
  Q.forEach(([id], i) => PLAYS[i].forEach((p) => audio.push({ file: `assets/cry-${id}.ogg`, t: p, vol: 1.0 })));
  shakes.push({ t: .1, amp: 16, dur: .35 }, { t: tC, amp: 18, dur: .4 }, { t: E + .3, amp: 10, dur: .3 });
  Q.forEach((q, i) => shakes.push({ t: H0 + i * RD + .3, amp: 7, dur: .22 }));
  const card = (cls, html, css, parent) => { const d = el('div', cls, parent || $('fx'), html); d.style.cssText = css; return d; };
  const badge = (letter, size) => `<div style="position:absolute;left:12px;top:12px;width:${size}px;height:${size}px;border-radius:50%;background:#4069E0;color:#fff;font:700 ${Math.round(size * .62)}px/${size}px Fredoka;text-align:center;box-shadow:0 5px 0 rgba(0,0,0,.18)">${letter}</div>`;
  return {
    cards: [], total, audio,
    build() {
      const hb = $('hookBig');
      N.hBrand = el('div', '', hb, '<img src="assets/favicon.svg" style="width:70px;height:70px;vertical-align:middle;margin-right:18px">pokdle.fr'); N.hBrand.style.cssText = 'position:absolute;left:50%;top:420px;padding:14px 34px 14px 20px;border-radius:999px;background:#FFF8EF;color:#2E2A33;font:700 64px Fredoka;white-space:nowrap;box-shadow:0 12px 0 rgba(0,0,0,.25)';
      N.hPill = el('div', 'pill', hb, 'Défi cri · 🔊 Monte le son'); N.hPill.style.cssText += 'background:rgba(255,255,255,.14);color:#fff;left:50%;top:560px';
      N.h1 = K(hb, 'QUEL POKÉMON', { size: 132, y: 680 });
      const mk = el('div', 'mask', hb); mk.style.cssText += 'top:840px;height:180px'; N.h2 = K(mk, 'FAIT CE CRI ?', { size: 140, color: '#FFD45C', y: 12 });
      N.h3 = el('div', '', hb); N.h3.style.cssText = 'position:absolute;left:0;right:0;top:1060px;text-align:center;font:700 76px Fredoka;line-height:1;white-space:nowrap';
      N.h3w = ['5 CRIS', '·', '3 CHOIX'].map((w) => { const d = el('span', '', N.h3, w); d.style.cssText = 'display:inline-block;margin:0 14px'; return d; });
      const hd = $('header');
      N.pill = el('div', 'pill', hd, 'pokdle.fr · Défi cri 🔊'); N.pill.style.cssText += 'background:rgba(255,255,255,.14);color:#fff;left:50%;top:150px;font-size:30px';
      N.hdr1 = K(hd, 'Quel Pokémon fait ce cri ?', { size: 74, y: 222, echoes: 0 }); N.hdr2 = K(hd, 'Note tes réponses ✍️', { size: 64, y: 312, color: '#FFD45C', echoes: 0 });
      N.rounds = Q.map(([id, lvl, col, ch], i) => {
        const c = card('', `<div style="position:absolute;left:40px;top:30px;font:900 28px Nunito;letter-spacing:.14em;color:#1f7a5c">CRI MYSTÈRE</div><div style="position:absolute;right:40px;top:16px;font:700 60px Fredoka;color:#2E2A33">#${i + 1}</div><div class="spk" style="position:absolute;left:325px;top:84px;width:150px;height:150px;border-radius:50%;background:#4069E0;display:flex;align-items:center;justify-content:center;font-size:72px;box-shadow:0 12px 0 rgba(0,0,0,.18)">🔊</div><div class="bars" style="position:absolute;left:70px;right:70px;top:262px;height:150px;display:flex;align-items:center;justify-content:space-between">${Array.from({ length: 24 }, () => '<i style="display:block;width:15px;height:16px;border-radius:8px;background:#7C5BD6"></i>').join('')}</div><div class="lbl" style="position:absolute;left:0;right:0;top:428px;text-align:center;font:800 40px Nunito;color:#2E2A33">Écoute bien…</div>`,
          'position:absolute;left:140px;top:470px;width:800px;height:500px;border-radius:48px;background:#FFF8EF;box-shadow:0 50px 100px rgba(0,0,0,.5),0 0 0 6px rgba(255,255,255,.16);opacity:0');
        const chip = card('', `#${i + 1}/5 · ${lvl}`, `position:absolute;left:50%;top:402px;padding:12px 30px;border-radius:999px;background:${col};color:#2E2A33;font:900 40px Nunito;letter-spacing:.06em;white-space:nowrap;opacity:0;box-shadow:0 10px 0 rgba(0,0,0,.22)`);
        const opts = ch.map(([oid, name], j) => card('', `${badge(L[j], 66)}<img src="assets/art-${oid}.png" style="position:absolute;left:34px;top:36px;width:212px;height:212px"><div style="position:absolute;left:0;right:0;top:282px;text-align:center;font:800 36px Nunito;color:#2E2A33">${name}</div>`,
          `position:absolute;left:${90 + j * 310}px;top:1010px;width:280px;height:350px;border-radius:36px;background:#FFF8EF;box-shadow:0 26px 50px rgba(0,0,0,.45),0 0 0 5px rgba(255,255,255,.14);opacity:0`));
        const ring = card('', '<svg viewBox="0 0 200 200" style="position:absolute;inset:0"><circle cx="100" cy="100" r="86" fill="rgba(20,15,41,.55)" stroke="rgba(255,255,255,.18)" stroke-width="12"/><circle class="rg" cx="100" cy="100" r="86" fill="none" stroke="#FFD45C" stroke-width="12" stroke-linecap="round" transform="rotate(-90 100 100)" stroke-dasharray="540.4"/></svg><div class="nm" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 100px Fredoka;color:#fff">3</div>',
          'position:absolute;left:450px;top:1400px;width:180px;height:180px;opacity:0');
        return { c, chip, opts, ring };
      });
      // Recap: every round with its three choices, then the call to comment.
      const rv = $('reveal');
      N.toi = K(rv, 'À TOI ! ✍️', { size: 120, y: 175, color: '#FFD45C', stroke: 10, echoes: 3 });
      N.rows = Q.map(([, , , ch], i) => {
        const row = card('', `<div style="position:absolute;left:0;top:22px;width:110px;font:700 56px Fredoka;color:#fff">#${i + 1}</div>` + ch.map(([oid], j) => `<div style="position:absolute;left:${120 + j * 220}px;top:0;width:200px;height:104px;border-radius:26px;background:#FFF8EF;box-shadow:0 12px 26px rgba(0,0,0,.35)">${badge(L[j], 56).replace('top:12px', 'top:24px')}<img src="assets/art-${oid}.png" style="position:absolute;left:86px;top:4px;width:96px;height:96px"></div>`).join(''),
          `position:absolute;left:170px;top:${355 + i * 120}px;width:780px;height:104px;opacity:0`, rv);
        return row;
      });
      N.c1 = K(rv, 'Écris tes réponses', { size: 76, y: 985, echoes: 0 });
      N.c2 = K(rv, 'en commentaire 👇', { size: 76, y: 1072, echoes: 0, color: '#FFD45C' });
      N.ex = card('', 'Exemple : 1A 2C 3B 4A 5C', 'position:absolute;left:50%;top:1190px;padding:16px 36px;border-radius:999px;background:#FFF8EF;color:#2E2A33;font:900 46px Nunito;white-space:nowrap;box-shadow:0 10px 0 rgba(0,0,0,.25);opacity:0', rv);
      N.pin = card('', '📌 Réponses dans le commentaire épinglé', 'position:absolute;left:0;right:0;top:1300px;text-align:center;font:800 42px Nunito;color:rgba(255,255,255,.92);opacity:0', rv);
      const en = $('end');
      N.orbs = [['25', 750, 210, 14], ['133', 70, 300, -12], ['448', 800, 1660, 10]].map(([id, x, y, r]) => { const d = el('img', 'orb', en); d.src = `assets/art-${id}.png`; return { d, x, y, r }; });
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
      // hook, on the beats 0.07 / 0.47 / 0.87…
      const bk = seg(t, 0, .4); N.hBrand.style.opacity = .4 + .6 * clamp(bk * 2); N.hBrand.style.transform = `translateX(-50%) scale(${lerp(.6, 1, spring(bk))}) rotate(${Math.sin(t * 2) * 1.5}deg)`;
      N.hPill.style.opacity = .35 + .65 * seg(t, 0, .25); N.hPill.style.transform = `translateX(-50%) scale(${lerp(.6, 1, spring(seg(t, 0, .45)))})`;
      slam(N.h1, t, .07, { from: 3, dur: .3 });
      const m2 = seg(t, .47, .85); N.h2.style.transform = `translateY(${(1 - eOut5(m2)) * 180}px) skewY(${(1 - eOut(m2)) * 8}deg)`; N.h2.style.opacity = m2 > 0 ? 1 : 0;
      N.h2.echo.forEach((e, i) => { const q = seg(t, .85 + i * .06, 1.35 + i * .06); e.style.opacity = q > 0 && q < 1 ? (1 - q) * .7 : 0; e.style.transform = `scale(${1 + q * (.12 + i * .08)})`; });
      N.h3w.forEach((d, i) => { const k = seg(t, .87 + i * .2, 1.37 + i * .2); d.style.opacity = clamp(k * 3); d.style.transform = `translateY(${(1 - eOut(k)) * 80}px) scale(${lerp(.3, 1, spring(k))}) rotate(${(1 - eOut(k)) * (i % 2 ? 12 : -12)}deg)`; });
      const ho = eInOut(seg(t, 2.02, 2.47));
      $('hookBig').style.transform = `translateY(${-ho * 520}px) scale(${(1 + t * .015) * lerp(1, .42, ho)})`; $('hookBig').style.opacity = 1 - ho;
      const hk = seg(t, 2.17, 2.57), hx = seg(t, tC - .1, tC + .2);
      $('header').style.opacity = clamp(hk * 2) * (1 - hx); $('header').style.transform = `translateY(${(1 - eOut(hk)) * 40 + Math.sin(t * 1.4) * 3}px) scale(${lerp(.9, 1, spring(hk))})`;
      N.pill.style.transform = 'translateX(-50%)';
      // rounds
      N.rounds.forEach((r, i) => {
        const t0 = H0 + i * RD, a = seg(t, t0, t0 + .35), b = seg(t, t0 + RD - .32, t0 + RD);
        const x = (1 - eOut5(a)) * 1150 - eIn(b) * 1150, rot = (1 - eOut(a)) * 14 - eIn(b) * 14, bl = (1 - a) * 14 + b * 14;
        const on = t >= t0 - .01 && t < t0 + RD;
        r.c.style.opacity = on ? 1 : 0; r.c.style.filter = bl > .2 ? `blur(${bl}px)` : 'none';
        r.c.style.transform = `perspective(1600px) translateX(${x}px) rotateY(${rot}deg) rotateX(5deg) scale(${1 + .04 * seg(t, t0, t0 + RD)}) translateY(${Math.sin(t * 1.2) * 6}px)`;
        const ck = seg(t, t0 + .15, t0 + .5); r.chip.style.opacity = on ? clamp(ck * 3) * (1 - b) : 0; r.chip.style.transform = `translateX(-50%) scale(${lerp(.3, 1, spring(ck))}) rotate(-2deg)`;
        r.opts.forEach((o, j) => {
          const k = seg(t, t0 + .25 + j * .12, t0 + .7 + j * .12);
          o.style.opacity = on ? clamp(k * 3) * (1 - b) : 0;
          o.style.transform = `translateX(${-eIn(b) * 1150}px) translateY(${(1 - eOut(k)) * 140 + Math.sin(t * 1.6 + j) * 5}px) scale(${lerp(.3, 1, eBack(k, 2.2))}) rotate(${(1 - eOut(k)) * (j - 1) * 12 + Math.sin(t + j) * 1.2}deg)`;
        });
        const local = t - t0 - (RD - 2.95), n = Math.floor(local / .9), f = local / .9 - n;
        r.ring.style.opacity = on && local > -.1 && n < 3 ? clamp((local + .1) * 6) : 0;
        r.ring.querySelector('.nm').textContent = String(3 - clamp(n, 0, 2));
        r.ring.querySelector('.nm').style.transform = `scale(${lerp(1.6, 1, eBack(clamp(f / .3)))})`;
        r.ring.querySelector('.rg').setAttribute('stroke-dashoffset', String(540.4 * clamp(f)));
        const id = Q[i][0]; let lvl = 0;
        PLAYS[i].forEach((p) => { const k = Math.floor((t - p) * 60); if (k >= 0 && k < ENV[id].length) lvl = Math.max(lvl, ENV[id][k]); });
        r.c.querySelectorAll('.bars i').forEach((bb, j) => { const sh = .35 + .65 * Math.abs(Math.sin(j * .9 + 1.3)), wob = .5 + .5 * Math.sin(t * 23 + j * 1.7); bb.style.height = (16 + lvl * 140 * sh * (.65 + .35 * wob)) + 'px'; bb.style.opacity = .35 + .65 * Math.min(1, lvl * 1.5 + .1); });
        r.c.querySelector('.spk').style.transform = `scale(${1 + lvl * .18})`;
        r.c.querySelector('.lbl').textContent = t > PLAYS[i][PLAYS[i].length - 1] + LEN[id] + .2 ? 'A, B ou C ? 🤔' : 'Écoute bien…';
      });
      // recap + call to comment
      const f1 = t >= tC ? Math.max(0, 1 - (t - tC) / .35) : 0; $('flash').style.opacity = f1 * .6;
      const live = t < E + .33 ? 1 : 0;
      $('reveal').style.opacity = seg(t, tC, tC + .1) * live;
      slam(N.toi, t, tC + .05, { from: 2.6, dur: .26 }); if (t < tC + .05) N.toi.style.opacity = 0;
      N.rows.forEach((d, i) => { const k = seg(t, tC + .3 + i * .1, tC + .7 + i * .1); d.style.opacity = clamp(k * 3); d.style.transform = `translateX(${(1 - eOut5(k)) * (i % 2 ? 900 : -900)}px)`; });
      slam(N.c1, t, tC + .95, { from: 2.2, dur: .24 }); if (t < tC + .95) N.c1.style.opacity = 0;
      pop(N.c2, t, tC + 1.2, { dy: 40 }); N.c2.style.transform += ` scale(${1 + .025 * Math.sin(t * 6)})`;
      const ex = seg(t, tC + 1.6, tC + 2.0); N.ex.style.opacity = clamp(ex * 3); N.ex.style.transform = `translateX(-50%) scale(${lerp(.3, 1, eBack(ex, 2.2))})`;
      N.pin.style.opacity = seg(t, tC + 2.1, tC + 2.4);
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
