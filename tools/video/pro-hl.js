window.TIMEMAP = [[0, 2.0, 1], { hold: HK }, [2.0, 20.3, 1]];
window.CFG = (IDX) => {
  const taps = IDX.events.filter((e) => e.type === 'tap'), cd = IDX.events.find((e) => e.type === 'countdown').t;
  const b = rectAt('.higher-lower-stat-banner', 1), act = rectAt('.higher-lower-actions', 1);
  const top = b[1] - 8, bot = act[1] + act[3] + 8;
  return {
    brand: true, kicker: 'Higher or Lower', kickerStyle: 'background:#E2453C;color:#fff;',
    hook: ['PLUS HAUT', 'OU PLUS BAS', ['TU', 'TIENS', 'COMBIEN ?']], hookSize: 168, hook2Size: 140, hook3Size: 104,
    header: ['Higher or Lower ⬆️⬇️', 'Plus haut ou plus bas ?'],
    art: 321, name: 'PLUS BAS !', kick: 'RÉPONSE', preReveal: 'VERDICT…', sub: 'Wailord : 45 en Défense 😅', orbs: [143, 658],
    endLine: 'Sans compte · Plus de 20 jeux Pokémon',
    subs: taps, foc: [], cd, revealDelay: 1.0,
    cap: 'Plus haut ou plus bas ? <b style="color:#FFD45C">Commente</b> 👇', capY: 1290, numY: 1350, cdScale: -.08, cdLift: 60, ringY: 330,
    captions: [[2.6 + HK + .4, 'Ronflex ou Ninjask : le plus rapide ?'], [taps[0].t + .6, 'Ninjask : 160 en Vitesse ⚡'], [taps[1].t + .6, 'Amphinobi : 103 en Atk. Spé. ✨'],
      [taps[2].t + .6, 'Mimiqui : 55 PV, plus bas ✅'], [cd, 'Wailord est énorme… mais en Défense ? 🤔']],
    cards() {
      const A = { x: 70, y: 470, w: 940, h: 880 };
      const w = (bot - top) * A.w / A.h;
      A.cam = () => ({ cx: 216, cy: (top + bot) / 2, w: Math.max(w, 384) });
      return { A };
    },
    stamps: ['SÉRIE : 1 ✅', 'SÉRIE : 2 ✅', 'SÉRIE : 3 🔥'].map((text, i) => ({ text, y: 1480, size: 104,
      when: ({ wrong, cd }) => [wrong[i].t + .45, Math.min(wrong[i].t + 2.3, cd - .05)] })),
  };
};
