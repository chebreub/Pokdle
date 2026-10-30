// Extra seconds given to the opening hook so viewers can read it.
window.HK = .7;
// Camera keys for the "input <-> last result row" card, shared by the guessing modes.
window.inputRowKeys = (foc, sub, cardW, cardH, top = 14) => {
  const cdT = (evs('countdown')[0] || { t: 1e9 }).t;
  const half = cardH / (cardW / 408) / 2, inp0 = rectAt('#guess-input', foc[0].t);
  const keys = [{ t: 0, cx: 216, cy: inp0[1] - top + half, w: 408 }];
  foc.forEach((f, i) => {
    if (f.t > cdT) return; // never show the answer being typed
    const inp = rectAt('#guess-input', f.t + .05) || inp0; keys.push({ t: f.t - .2, cx: 216, cy: inp[1] - top + half, w: 408, dur: .32 });
    const s = sub[i]; const row = s && rectAt('#results-body > tr:last-child', s.t + 1.2); if (row) keys.push({ t: s.t + .28, cx: 216, cy: row[1] - 8 + half, w: 408, dur: .32 });
  });
  return keys;
};
window.nextFocus = (foc, i, cd) => Math.min(foc[i + 1] ? foc[i + 1].t : cd, cd) - .05;

// A floating 3D card: arrives from below, idles, leaves at the reveal.
window.floatMotion = (t, { t0 = 2.0 + HK, R = 1e9, phase = 0, z = 0 } = {}) => {
  const k = seg(t, t0, t0 + .75), ex = eIn(seg(t, R - .08, R + .22));
  return { y: (1 - eOut5(k)) * 1150 + Math.sin(t * 1.1 + phase) * 5 - ex * 500, rx: lerp(62, 0, eOut(k)) + 5, ry: Math.sin(t * .7 + phase) * 3, o: clamp(k * 3) * (1 - ex), z };
};
