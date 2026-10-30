window.TIMEMAP = [[3.0, 5.0, 1], { hold: HK }, [5.0, 7.0, 1], [7.0, 9.4, .8], [9.4, 11.6, 2.5], [11.6, 14.0, 1], { hold: .8 },
  [29.8, 32.6, 1], { hold: 3.2, tag: 'cd' }, [32.6, 35.3, 2.5], [35.3, 37.8, 1]];
window.CFG = (IDX) => {
  const M = (s) => IDX.mapOut(s);
  const ev = (type) => IDX.events.filter((e) => e.type === type);
  const picking = ev('picking'), picks = ev('pick'), reveals = ev('reveal');
  const cd = window.TM_TAGS.cd, R = IDX.duration;
  const valuesT = [11.9, 35.6].map(M);
  const ent = (t, t0) => { const k = seg(t, t0, t0 + .75); return { y: (1 - eOut5(k)) * 1150, rx: lerp(62, 0, eOut(k)), o: clamp(k * 3) }; };
  const bump = (u, len = .4) => (u > 0 && u < len ? Math.sin(Math.PI * u / len) : 0);
  const r0 = IDX.rects[0].r; const brd = rectAt('.stat-clash-board', 3);
  const top = brd[1], lx = brd[0], cx0 = rectAt('.stat-clash-center-card', 3)[0], rx0 = brd[0] + brd[2] - 260;
  return {
    brand: true, captions: [[2.6 + HK + .4, 'Un Pokémon, une stat secrète'], [valuesT[0] + .2, 'Le bot prend les PV… il mène 😬'], [picks[picks.length - 1].t - .6, 'Dernière manche : Leveinard !'], [cd, 'Je peux renverser ? 👀']],
    kicker: 'Stat Clash', kickerStyle: 'background:#E2453C;color:#fff;', hook: ['STAT', 'CLASH ⚔️', ['MOI', 'VS', 'LE BOT']], header: ['Moi contre le bot ⚔️', 'Qui marque le plus ?'],
    art: 113, name: 'VICTOIRE !', sub: '494 à 410 · merci les 250 PV 💪', kick: 'RÉSULTAT', preReveal: 'VERDICT…', orbs: [25, 133], endLine: 'Sans compte · Plus de 20 jeux Pokémon', endHold: 4.6,
    cd, R, subs: [], foc: [], wrong: valuesT.map((t) => ({ t })), ringY: 300,
    cap: 'Le bot mène… <b style="color:#FFD45C">je renverse ?</b> 👀', capY: 760, numY: 840,
    cards() {
      const A = { x: 160, y: 640, w: 760, h: 1060 }; A.cam = () => ({ cx: cx0 + 215, cy: top + 12 + 300, w: 430 });
      A.motion = (t) => {
        const en = ent(t, 1.95 + HK), cdk = eInOut(seg(t, cd, cd + .4)), ex = eIn(seg(t, R - .08, R + .22));
        const punch = .03 * valuesT.reduce((m, v) => Math.max(m, bump(t - v, .35)), 0);
        return { y: en.y + Math.sin(t * 1.1) * 6 + ex * 900, rx: en.rx + 5 + Math.sin(t * .5) * 1.5 + ex * 55, ry: Math.sin(t * .7) * 3, o: en.o * (1 - ex) * (1 - .72 * cdk), s: 1 + punch, rim: 0 };
      };
      const L = { x: 50, y: 430, w: 470, h: 182 }, Rr = { x: 560, y: 430, w: 470, h: 182 };
      L.cam = () => ({ cx: lx + 130, cy: top + 52, w: 260 }); Rr.cam = () => ({ cx: rx0 + 130, cy: top + 52, w: 260 });
      const sb = (dx, t0) => (t) => { const en = ent(t, t0), ex = eIn(seg(t, R - .08, R + .22)); const p = .07 * valuesT.reduce((m, v) => Math.max(m, bump(t - v - .1, .35)), 0); return { y: en.y + Math.sin(t * 1.3 + dx) * 4 - ex * 400, rx: en.rx, ry: dx * 3, rz: dx * 1.2, o: en.o * (1 - ex), s: 1 + p }; };
      L.motion = sb(-1, 2.05 + HK); Rr.motion = sb(1, 2.15 + HK);
      const P = { x: 34, y: 1170, w: 400, h: 393 }; P.cam = () => ({ cx: lx + 130, cy: top + 212, w: 260 });
      P.motion = (t) => {
        let k = 0; picking.forEach((p, i) => { const a = p.t + .05, b = (picks[i] ? picks[i].t : p.t) + .55; if (t >= a - .1 && t < b + .4) k = Math.min(seg(t, a, a + .35), 1 - seg(t, b, b + .3)); });
        return { y: (1 - eOut(k)) * 120, rz: -5 + (1 - k) * -10, s: lerp(.6, 1, spring(k)), o: clamp(k * 2), z: 80 };
      };
      return { A, more: [L, Rr, P] };
    },
    stamps: [
      { text: 'LE BOT MÈNE 😬', y: 572, when: () => [valuesT[0] + .6, M(29.9)] },
      { text: 'J’AI GARDÉ MES PV 😏', size: 84, y: 572, dx: 40, when: () => [picks[picks.length - 1].t + .5, cd - .05] },
    ],
    build(N) {
      N.rules = ['① Un Pokémon est tiré', '② Chacun choisit une stat, en secret', '③ Chaque stat ne sert qu’une fois'].map((txt, i) => {
        const d = el('div', '', $('fx'), txt); d.style.cssText = `position:absolute;left:50%;top:${700 + i * 92}px;padding:16px 30px;border-radius:999px;background:#fff;color:#2E2A33;font:800 40px Nunito;white-space:nowrap;box-shadow:0 12px 0 rgba(0,0,0,.25)`; return d;
      });
    },
    render(t, N) {
      N.rules.forEach((d, i) => { const t0 = 2.45 + HK + i * .35, k = seg(t, t0, t0 + .45), o = seg(t, picks[0].t + .5, picks[0].t + .85); d.style.opacity = clamp(k * 3) * (1 - o); d.style.transform = `translateX(-50%) translateX(${(1 - eOut5(k)) * (i % 2 ? 600 : -600)}px) rotate(${(i - 1) * 1.5}deg) scale(${1 - o * .2})`; });
    },
  };
};
