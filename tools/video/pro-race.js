window.TIMEMAP = [[0, 2.0, 1], { hold: HK }, [2.0, 3.6, .8], [3.6, 6.4, 1], [6.4, 118.0, 20], [118.0, 124.5, 4], { hold: 3.2, tag: 'cd' }, [124.5, 141.8, 8], [141.8, 144.3, 1]];
window.CFG = (IDX) => {
  const M = (s) => IDX.mapOut(s);
  const cd = window.TM_TAGS.cd, R = IDX.duration, tl0 = M(6.4), tl1 = M(117.99);
  return {
    brand: true, captions: [[2.6 + HK + .4, 'Un salon, un pote, une grille'], [M(4.6), 'Tape un nom = tu prends la case'], [tl0, 'Ça va vite… ⏩'], [cd, '76 – 75… qui gagne ? 👀']],
    kicker: 'Party Room', kickerStyle: 'background:#7C5BD6;color:#fff;', hook: ['LES 151', 'EN DUEL', ['QUI', 'GAGNE', '?']], hookSize: 230,
    header: ['Course au Pokédex 🏁', 'Toute la Gen 1, à deux'],
    art: 151, name: 'LES 151 !', kick: 'GÉNÉRATION 1 COMPLÈTE', sub: 'Sacha gagne 76 à 75 🏆', orbs: [25, 133], endLine: 'Entre amis · Sans compte · 2 à 8 joueurs', endHold: 3.8,
    cd, R, subs: [], foc: [], wrong: [], preReveal: ' ', ringY: 300,
    cap: 'Dernières cases… <b style="color:#FFD45C">qui gagne ?</b> 👀', capY: 700, numY: 770, cdScale: 0, cdLift: 0, cdDim: .75,
    cards() {
      const A = { x: 40, y: 650, w: 1000, h: 600 };
      const keys = [{ t: 0, cx: 420, cy: 300, w: 800 }, { t: M(3.62), cx: 300, cy: 235, w: 520, dur: .5 }, { t: tl0, cx: 640, cy: 415, w: 1225, dur: tl1 - tl0 - .5 }];
      A.cam = (t) => camAt(keys, t);
      const S = { x: 50, y: 440, w: 980, h: 190 }; S.cam = () => ({ cx: 618, cy: 64, w: 610 });
      S.motion = (t) => { const f = floatMotion(t, { t0: M(3.62), R, phase: 1 }); return { ...f, s: 1 + .015 * Math.sin(t * 9) * (t > tl0 && t < tl1 ? 1 : 0) }; };
      const B = { x: 90, y: 1285, w: 900, h: 104 }; B.cam = () => ({ cx: 671, cy: 735, w: 650 });
      B.motion = (t) => { const f = floatMotion(t, { t0: M(3.7), R: Math.min(R, cd), phase: 2 }); return { ...f, o: f.o * (1 - seg(t, M(136.0), M(136.2))) }; };
      return { A, more: [S, B] };
    },
    stamps: [
      { text: 'À FOND ⚡', y: 1250, when: () => [M(4.6) + .2, tl0 - .05] },
    ],
    build(N) {
      N.ff = el('div', '', $('fx'), '⏩ Accéléré x20'); N.ff.style.cssText = 'position:absolute;left:50%;top:1430px;padding:16px 34px;border-radius:999px;background:#FFD45C;color:#2E2A33;font:900 50px Nunito;white-space:nowrap;box-shadow:0 12px 0 rgba(0,0,0,.25)';
      N.lob = ['① Crée ton salon', '② Ton ami entre avec le code', '③ Lancez la Course'].map((txt, i) => { const d = el('div', '', $('fx'), txt); d.style.cssText = `position:absolute;left:50%;top:${1300 + i * 92}px;padding:16px 30px;border-radius:999px;background:#fff;color:#2E2A33;font:800 40px Nunito;white-space:nowrap;box-shadow:0 12px 0 rgba(0,0,0,.25)`; return d; });
    },
    render(t, N) {
      const k = seg(t, tl0, tl0 + .35), o = seg(t, tl1 - .3, tl1);
      N.ff.style.opacity = clamp(k * 3) * (1 - o); N.ff.style.transform = `translateX(-50%) scale(${lerp(.4, 1, spring(k)) * (1 + .03 * Math.sin(t * 10))}) rotate(-3deg)`;
      N.lob.forEach((d, i) => { const t0 = 2.4 + HK + i * .3, q = seg(t, t0, t0 + .45), x = seg(t, M(3.6) + .4, M(3.6) + .7); d.style.opacity = clamp(q * 3) * (1 - x); d.style.transform = `translateX(-50%) translateX(${(1 - eOut5(q)) * (i % 2 ? 620 : -620)}px) rotate(${(i - 1) * 1.4}deg)`; });
    },
  };
};
