window.TIMEMAP = [[0, 2.0, 1], { hold: HK }, [2.0, 7.6, 1], { hold: 1.0 }, [7.6, 19.2, 1]];
window.CFG = (IDX) => {
  const cries = evs('cry');
  const xhr = new XMLHttpRequest(); xhr.open('GET', 'assets/env-54.json', false); xhr.send(); const env = JSON.parse(xhr.responseText);
  let audioT = [];
  const NB = 31;
  return {
    brand: true, captions: (() => { const S = evs('submit'), cd0 = evs('countdown')[0].t; return [[2.6 + HK + .4, 'Monte le son 🔊'], [cries[0].t + 1.2, 'Ça sent le type Eau…'], [S[0].t + 1.0, 'Akwakwak ? Presque !'], [cries[1].t, 'On réécoute 👂'], [cd0, 'Tu l’as ? 3 secondes…']]; })(),
    kicker: 'Le cri mystère', hook: ['ÉCOUTE', 'CE CRI 🔊', ['TU', 'LE', 'CONNAIS ?']], header: ['Écoute bien 🔊', 'Tu reconnais ce cri ?'],
    art: 54, name: 'PSYKOKWAK', sub: 'Trouvé en 2 essais 🎉', orbs: [25, 133], endLine: 'Sans compte · Plus de 20 jeux Pokémon',
    capY: 1170, numY: 1225, ringY: 165,
    cards({ foc, sub }) {
      const box = rectAt('#cry-box', 1);
      const A = { x: 80, y: 830, w: 920, h: 330 }; A.cam = () => ({ cx: box[0] + box[2] / 2, cy: box[1] + box[3] / 2, w: 420 });
      const B = { x: 210, y: 1190, w: 660, h: 560, blur: true }; const bKeys = inputRowKeys(foc, sub, B.w, B.h); B.cam = (t) => camAt(bKeys, t);
      return { A, B };
    },
    stamps: [
      { text: 'PRESQUE !', y: 1150, when: ({ wrong }) => [wrong[0].t + .75, cries[1].t - .05] },
      { text: 'RÉÉCOUTE 🎧', y: 740, size: 84, dx: 150, rot: 6, when: ({ cd }) => [cries[1].t + .15, cd - .05] },
    ],
    extraAudio: ({ R }) => cries.map((c) => ({ file: 'assets/cry-54.ogg', t: c.t + .12 })),
    build(N, { R }) {
      audioT = [...cries.map((c) => c.t + .12), R + .6];
      const fx = $('fx');
      N.viz = el('div', '', fx); N.viz.style.cssText = 'position:absolute;left:0;right:0;top:440px;height:340px';
      N.vring = el('div', 'ring', N.viz); N.vring2 = el('div', 'ring', N.viz);
      N.bars = Array.from({ length: NB }, (_, i) => { const b = el('div', '', N.viz); b.style.cssText = `position:absolute;left:${540 - NB * 14 + i * 28 + 4}px;width:20px;border-radius:10px;background:linear-gradient(#FFD45C,#ff9f5a 50%,#7C5BD6)`; return b; });
    },
    render(t, N, { cd, R }) {
      let lvl = 0, since = 99;
      for (const a of audioT.slice(0, -1)) { const u = t - a; if (u >= 0 && u < since) since = u; const i = Math.floor(u * 60); if (i >= 0 && i < env.length) lvl = Math.max(lvl, env[i]); }
      const vis = seg(t, 2.2 + HK, 2.7 + HK) * (1 - seg(t, cd - .1, cd + .2));
      N.viz.style.opacity = vis; N.viz.style.transform = `scale(${1 + lvl * .06})`;
      N.bars.forEach((b, i) => {
        const shape = Math.exp(-Math.pow((i - (NB - 1) / 2) / (NB / 3.3), 2));
        const wob = .55 + .45 * Math.sin(t * 21 + i * 1.7) * Math.sin(t * 8 + i * .6);
        const idle = .06 + .05 * Math.sin(t * 2.4 + i * .45);
        const h = 18 + 290 * Math.max(idle, lvl * shape * (.55 + .45 * wob));
        b.style.height = h + 'px'; b.style.top = (170 - h / 2) + 'px';
      });
      [N.vring, N.vring2].forEach((r, j) => { const k = seg(since - j * .18, 0, .9); r.style.cssText = `left:390px;top:20px;width:300px;height:300px;border-color:${j ? '#7C5BD6' : '#FFD45C'};opacity:${since < 1.1 && k > 0 && k < 1 ? (1 - k) * .9 : 0};transform:scale(${lerp(.4, 2.4, eOut(k))})`; });
    },
  };
};
