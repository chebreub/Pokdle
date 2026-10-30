window.TIMEMAP = [[0, 2.0, 1], { hold: HK }, [2.0, 5.1, 1], { hold: 1.0 }, [5.1, 8.1, 1], { hold: 1.0 }, [11.3, 13.96, 1], { hold: 1.0 }, [13.96, 23.0, 1]];
window.CFG = (IDX) => { const S = IDX.events.filter((e) => e.type === 'submit'), cd0 = IDX.events.find((e) => e.type === 'countdown').t; return {
  brand: true, kicker: 'Pokémon pixelisé', hook: ['DEVINE', 'CE POKÉMON', ['AVANT', 'MOI', '👀']], header: ['Devine ce Pokémon', 'avant moi 👀'],
  art: 94, name: 'ECTOPLASMA', sub: 'Trouvé en 5 essais 🎉', orbs: [25, 133], endLine: 'Sans compte · Un nouveau défi chaque jour', meter: false,
  cards({ foc, sub, cd }) {
    const box = rectAt('#pixel-box', 1), spr = rectAt('#pixel-sprite', 1);
    const A = { x: 80, y: 470, w: 920, h: 600 };
    const aKeys = [
      { t: 0, cx: box[0] + box[2] / 2, cy: box[1] + box[3] / 2 - 4, w: box[2] },
      { t: 2.6 + HK, cx: box[0] + box[2] / 2, cy: box[1] + box[3] / 2 - 8, w: box[2] * .94, dur: cd - 2.8 - HK, ease: (k) => k },
      { t: cd, cx: spr[0] + spr[2] / 2, cy: spr[1] + spr[3] / 2 + 4, w: 300, dur: .9 },
    ];
    A.cam = (t) => camAt(aKeys, t);
    const B = { x: 180, y: 1110, w: 720, h: 610, blur: true };
    const bKeys = inputRowKeys(foc, sub, B.w, B.h); B.cam = (t) => camAt(bKeys, t);
    return { A, B };
  },
  stamps: ['RATÉ', 'ÇA SE PRÉCISE…', 'SI PROCHE 😱'].map((text, i) => ({ text, y: 990, when: ({ wrong, foc, cd }) => [wrong[i].t + .75, nextFocus(foc, i, cd)] })),
  captions: [[2.6 + HK + .4, 'Là… on voit rien 😅'], [S[0].t + 1.0, 'Mewtwo ? Non !'], [S[1].t + 1.0, 'Nidoking ? Toujours pas…'], [S[2].t + 1.0, 'Spectrum ?! Si proche 😱'], [cd0, 'Tu l’as ? 3 secondes…']],
}; };
