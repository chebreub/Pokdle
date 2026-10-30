window.TIMEMAP = [[0, 2.0, 1], { hold: HK }, [2.0, 3.7, .8], [3.7, 6.3, 1], [6.3, 8.0, 1.2], [13.9, 16.1, 1], [16.1, 17.4, 1.5],
  [21.7, 22.9, 1], { hold: 3.2, tag: 'cd' }, [22.9, 24.4, 1], [24.4, 25.9, 1.5], [25.9, 27.4, 1]];
window.CFG = (IDX) => {
  const M = (s) => IDX.mapOut(s);
  const ev = (type) => IDX.events.filter((e) => e.type === type);
  const cd = window.TM_TAGS.cd, R = IDX.duration;
  const wrong = ev('wrong')[0], rival = ev('rival')[0], subs = ev('submit'), rounds = ev('round');
  const players = (t) => rectAt('#party-players', t);
  return {
    brand: true, captions: [[2.6 + HK + .4, 'Crée un salon, invite tes potes'], [rounds[0].t, 'Le 1er qui trouve gagne la manche'], [rival.t + .2, 'Ondine m’a grillé 😤'], [cd, 'Sol + Eau… tu l’as ?']],
    kicker: 'Party Room', kickerStyle: 'background:#7C5BD6;color:#fff;', hook: ['COMBO', 'DE TYPES', ['ENTRE', 'AMIS', '🔥']],
    header: ['Combo de types 🔥', 'Le plus rapide gagne'],
    art: 194, name: 'CHAMPION !', kick: 'RÉSULTAT', sub: '1er de la party · 560 points 🏆', orbs: [25, 133], endLine: 'Entre amis · Sans compte · 2 à 8 joueurs', endHold: 4.2,
    cd, R, subs, foc: [], wrong: subs.map((s) => ({ t: s.t + .25 })), preReveal: ' ', ringY: 180,
    cap: 'Sol + Eau… <b style="color:#FFD45C">tu l’as ?</b> 👀', capY: 1150, numY: 1215, cdScale: -.25, cdLift: 100,
    cards() {
      const A = { x: 80, y: 470, w: 920, h: 860, blur: true }, s = A.w / 400, half = A.h / s / 2;
      const code = rectAt('#party-room-code', 1), grid = rectAt('#party-mode-select', 2.4), round0 = rectAt('#party-round', M(5));
      const keys = [{ t: 0, cx: 216, cy: code[1] - 14 + half, w: 400 }, { t: M(3.0), cx: 216, cy: grid[1] - 50 + half, w: 400, dur: .7 }, { t: M(3.62), cx: 216, cy: round0[1] - 8 + half, w: 400, dur: .35 }];
      A.cam = (t) => camAt(keys, t);
      const B = { x: 170, y: 1365, w: 740, h: 400 }, sb = B.w / 370;
      B.cam = (t) => { const r = players(t) || [34, 868, 364, 205]; return { cx: r[0] + r[2] / 2, cy: r[1] - 6 + B.h / sb / 2, w: 370 }; };
      B.motion = (t) => {
        const typing = ev('focus').some((f, i) => { const end = [...subs, rival].filter(Boolean).find((x) => x.t > f.t); return t > f.t - .1 && t < (end ? end.t + .45 : f.t + 2); });
        const vis = typing ? 0 : [0, .08, .16].reduce((m, d) => { const r = players(t - d); return m + (r && r[1] + r[3] < 1330 && t > (rounds[1] || rounds[0]).t - .2 ? 1 / 3 : 0); }, 0);
        const f = floatMotion(t, { t0: rounds[0].t, R, phase: 2, z: -40 }), cdk = seg(t, cd, cd + .3) * (1 - seg(t, cd + 3.05, cd + 3.3));
        return { ...f, o: f.o * vis * (1 - cdk), s: lerp(.92, 1, vis) };
      };
      return { A, B };
    },
    stamps: [
      { text: 'ONDINE M’A GRILLÉ 😤', size: 84, y: 1240, dx: 0, when: () => [rival.t + .35, M(17.35)] },
    ],
    build(N) {
      const mk = (txt, i, y) => { const d = el('div', '', $('fx'), txt); d.style.cssText = `position:absolute;left:50%;top:${y + i * 92}px;padding:16px 30px;border-radius:999px;background:#fff;color:#2E2A33;font:800 40px Nunito;white-space:nowrap;box-shadow:0 12px 0 rgba(0,0,0,.25)`; return d; };
      N.lobbyChips = ['① Crée ton salon', '② Tes amis entrent avec le code', '③ Choisissez un mini-jeu'].map((t, i) => mk(t, i, 1390));
      N.gameChips = ['Deux types s’affichent…', '…le 1er qui trouve un Pokémon gagne !'].map((t, i) => mk(t, i, 1420));
    },
    render(t, N) {
      const show = (arr, a, b) => arr.forEach((d, i) => { const t0 = a + i * .3, k = seg(t, t0, t0 + .45), o = seg(t, b, b + .3); d.style.opacity = clamp(k * 3) * (1 - o); d.style.transform = `translateX(-50%) translateX(${(1 - eOut5(k)) * (i % 2 ? 620 : -620)}px) rotate(${(i - 1) * 1.4}deg) scale(${1 - o * .2})`; });
      show(N.lobbyChips, 2.4 + HK, M(3.6)); show(N.gameChips, M(3.85), M(6.25));
    },
  };
};
