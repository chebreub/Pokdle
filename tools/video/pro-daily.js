window.TIMEMAP = [[0, 2.0, 1], { hold: HK }, [2.0, 5.2, 1], { hold: 1.0 }, [8.9, 11.75, 1], { hold: 1.0 }, [11.75, 15.15, 1], { hold: 1.0 }, [15.15, 24.0, 1]];
window.CFG = (IDX) => {
  const xhr = new XMLHttpRequest(); xhr.open('GET', 'raw/daily/statuses.json', false); xhr.send(); const st = JSON.parse(xhr.responseText);
  return {
    brand: true, captions: (() => { const S = evs('submit'), cd0 = evs('countdown')[0].t; return [[2.6 + HK + .4, 'Un nouveau Pokémon chaque jour'], [S[0].t + 1.0, 'Pikachu : il est plus récent ↑'], [S[1].t + 1.0, 'Scarhino : le poids est bon ✓'], [S[2].t + 1.0, 'Gen 4, rare, bleu… 🤔'], [cd0, 'Tu l’as ? 3 secondes…']]; })(),
    kicker: 'Le Pokémon du jour', kickerStyle: 'background:#FFD45C;color:#2E2A33;', hook: ['TROUVE', 'LE POKÉMON', ['DU', 'JOUR', '🔎']], header: ['Les indices te guident', 'jusqu’à lui 🔎'],
    art: 448, name: 'LUCARIO', sub: 'Trouvé en 5 essais · 32 / 40 pts', orbs: [25, 133], endLine: 'Un nouveau Pokémon chaque jour · Sans compte',
    revealDelay: .5, capY: 1150, numY: 1205, ringY: 430, cdScale: -.3, cdLift: 90,
    cards({ foc, sub }) { const A = { x: 80, y: 470, w: 920, h: 860, blur: true }; const k = inputRowKeys(foc, sub, A.w, A.h); A.cam = (t) => camAt(k, t); return { A }; },
    stamps: [
      { text: '↑ = PLUS RÉCENT', size: 84, y: 640, dx: -90, when: ({ wrong, foc, cd }) => [wrong[0].t + 1.3, nextFocus(foc, 0, cd)] },
      { text: '54 KG ✓', size: 90, y: 1200, dx: 200, rot: 6, when: ({ wrong, foc, cd }) => [wrong[1].t + 1.3, nextFocus(foc, 1, cd)] },
      { text: 'GEN 4 · RARE · BLEU 🤔', size: 76, y: 1230, dx: 0, rot: -4, when: ({ wrong, cd }) => [wrong[2].t + 1.3, cd - .05] },
    ],
    build(N) {
      const col = { ok: ['#5DBE7E', '✓'], close: ['repeating-linear-gradient(45deg,#FFD45C 0 10px,#f2c443 10px 20px)', '≈'], wrong: ['#B9AFA6', '✕'] };
      N.hist = el('div', '', $('fx')); N.hist.style.cssText = 'position:absolute;left:0;top:0';
      const shown = IDX.events.filter((e) => e.type === 'submit').map((e) => e.guess);
      N.rows = st.slice(0, -1).filter((r) => shown.includes(r.g)).map((r, i) => {
        const row = el('div', '', N.hist); row.style.cssText = `position:absolute;left:0;top:${1370 + i * 68}px;width:1080px;height:54px`;
        const lab = el('div', '', row, r.g); lab.style.cssText = 'position:absolute;right:680px;top:6px;font:800 36px Nunito;color:#fff;white-space:nowrap';
        const sq = r.cells.slice(1).map((c, j) => { const k = /c-ok/.test(c.cls) ? 'ok' : /c-close/.test(c.cls) ? 'close' : 'wrong'; const d = el('div', '', row, col[k][1]); d.style.cssText = `position:absolute;left:${420 + j * 62}px;top:0;width:54px;height:54px;border-radius:14px;background:${col[k][0]};color:#2E2A33;font:900 30px/54px Nunito;text-align:center`; return d; });
        return { lab, sq };
      });
    },
    render(t, N, { sub, cd }) {
      N.hist.style.opacity = 1 - seg(t, cd - .1, cd + .25);
      N.rows.forEach((r, i) => {
        const t0 = sub[i].t + 1.25;
        r.lab.style.opacity = seg(t, t0, t0 + .3); r.lab.style.transform = `translateX(${(1 - eOut(seg(t, t0, t0 + .4))) * -40}px)`;
        r.sq.forEach((q, j) => { const k = seg(t, t0 + .05 * j, t0 + .05 * j + .45); q.style.opacity = clamp(k * 3); q.style.transform = `scale(${lerp(.2, 1, spring(k))}) rotate(${(1 - eOut(k)) * 30}deg)`; });
      });
    },
  };
};
