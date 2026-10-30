window.TIMEMAP = [[0, 2.0, 1], { hold: HK }, [2.0, 3.9, 1], [3.9, 11.0, .75], [11.0, 15.4, 1], { hold: 1.2 }, [15.4, 18.4, 1]];
window.CFG = (IDX) => {
  const ev = (type) => IDX.events.filter((e) => e.type === type);
  const fields = ev('field'), typed = ev('typed'), win = ev('win')[0].t, submit = ev('submit')[0].t;
  const R = win + 2.4;
  const sheet = rectAt('#petitbac-sheet', fields[0].t), root = rectAt('#petitbac-root', 1);
  return {
    brand: true, captions: [[2.6 + HK + .4, 'Une lettre, six thèmes'], [fields[0].t, 'Lettre H : c’est parti ⏱️'], [typed[3].t, 'Même Paldea 😎'], [ev('countdown')[0].t, 'Tout est bon ? Verdict…']],
    kicker: 'Petit Bac', kickerStyle: 'background:#5DBE7E;color:#2E2A33;', hook: ['PETIT BAC', 'POKÉMON', ['1', 'LETTRE,', '6 THÈMES']], hookSize: 205, hook3Size: 104,
    header: ['Petit Bac Pokémon 📝', 'Une lettre, six thèmes'],
    art: 250, name: 'SANS FAUTE !', kick: 'RÉSULTAT', sub: '6 / 6 en 12 secondes ⚡', orbs: [25, 133], endLine: 'Sans compte · Plus de 20 jeux Pokémon',
    R, subs: typed, foc: fields, wrong: typed, preReveal: ' ',
    cap: 'Tout est bon ? <b style="color:#FFD45C">Verdict…</b>', capY: 760, numY: 860, cdScale: 0, cdLift: 0, cdDim: .78, ringY: 250,
    cards() {
      const A = { x: 90, y: 640, w: 900, h: 1060, blur: true }, s = A.w / 400, half = A.h / s / 2;
      const lo = sheet[1] + half - 6, hi = sheet[1] + sheet[3] - half + 6;
      const keys = [{ t: 0, cx: 216, cy: root[1] + half - 6, w: 400 }];
      fields.forEach((f) => { const r = rectAt('#petitbac-sheet input:focus', f.t + .05); if (r) keys.push({ t: f.t - .15, cx: 216, cy: clamp(r[1] + 40, lo, hi), w: 400, dur: .35 }); });
      const rev = rectAt('.bac-review', win + .6); if (rev) keys.push({ t: submit + .05, cx: 216, cy: rev[1] + half - 70, w: 400, dur: .45 });
      A.cam = (t) => camAt(keys, t);
      const L = { x: 90, y: 440, w: 900, h: 170 }; L.cam = () => ({ cx: 216, cy: sheet[1] - 48, w: 400 });
      L.motion = (t) => floatMotion(t, { t0: 2.05 + HK, R, phase: 1 });
      return { A, more: [L] };
    },
    stamps: [
      { text: 'ÇA VA VITE ⚡', y: 1600, when: () => [typed[1].t + .05, fields[3].t] },
      { text: 'MÊME PALDEA 😎', y: 1600, dx: 120, when: () => [typed[3].t + .05, fields[5].t] },
    ],
  };
};
