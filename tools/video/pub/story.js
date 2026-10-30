// Story cut (~12 s): the hook, the Pokéball, then the end card. Reuses pub.js.
const STORY_CUT = 2.42, STORY_RATE = .8;
const storyDesign = (t) => (t < STORY_CUT ? t : 30.42 + (t - STORY_CUT) * STORY_RATE);
const storyOut = (d) => (d < 30 ? d : STORY_CUT + (d - 30.42) / STORY_RATE);
const hookBefore = renderHook, bgBefore = renderBg, setupBefore = window.setup;
renderHook = (t) => hookBefore(t < 30 ? t : t > 30.95 ? 3 : Math.min(2.94, STORY_CUT + (t - 30.42)));
renderBg = (t) => bgBefore(t >= 30 && t < 31 ? 31 : t);
renderS4 = () => vis($('s4'), false);
window.setup = async () => {
  await setupBefore();
  N.e2.textContent = '🎮 Viens jouer, c’est gratuit';
  const SFX = 'assets/sfx/';
  const cues = [[.08, 'pop', .8], [.42, 'whoosh', .8], [.66, 'thump', .7], [.82, 'pop', .8], [.85, 'riser', .7], [1.95, 'boom', .8], [2.02, 'thump', .6],
    [30.42, 'whoosh_long', .8], [30.9, 'tap', .9], [31.08, 'swish', .8], [31.15, 'pop', .7], [32.0, 'pop', .6], [32.7, 'pop', .7]];
  S.audio = cues.map(([d, n, v]) => ({ file: SFX + n + '.wav', t: storyOut(d), vol: v })).concat({ file: 'assets/cry-25.ogg', t: storyOut(31.35), vol: 1.1 }, { file: SFX + 'ambience.wav', t: 0, vol: .8 });
  S.total = STORY_CUT + (36 - 30.42) / STORY_RATE + 2.6;
  return S.total;
};
window.renderAt = async (t) => { OT = 0; return renderDesign(storyDesign(t)); };
