// 🧭 Expédition v2 (8/11/2026, « go expé ») : scène de capture, carte Expédition de l'accueil, 4 tuiles, nouvel écran.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const SRC = read('src/script.10xzzs.expedition-v2.js');
const CSS = read('balls.css');
const X_CSS = CSS.slice(CSS.indexOf('/* 🧭 Expédition v2'));

function sandbox() {
  const ctx = {
    window: {},
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    pokedexDetailArtwork: (p) => 'art/' + p.id + '.png',
    expeditionLegend: () => ({ id: 639, name: 'Terrakium', type1: 'Roche' }),
    EXP_DAY_NAMES: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
function week(over) {
  return Object.assign({ region: 'Unys', week: '2026-11-02', progress: 3, goal: 7, pct: 43, participants: 4, myDays: ['2026-11-02'],
    days: [], chests: [{ tier: 25, reached: true, claimed: false, canClaim: true, balls: ['poke', 'poke'] }],
    legend: { available: false, reached: false, status: null, pending: null } }, over || {});
}

test('the Expédition gets its own home card that opens the same screen', () => {
  const ctx = sandbox();
  const html = ctx.exp2HomeCardHtml(week());
  assert.match(html, /data-action="openExpedition"/);
  assert.match(html, /EXPÉDITION · UNYS/);
  assert.match(html, /Un coffre à ouvrir !/);
  assert.match(html, /3 \/ 7 participations · 1 jour pour toi/);
  assert.match(html, /class="exp2-home-leg is-shadow"/, 'the legendary stays a silhouette until it can be met');
  const hot = ctx.exp2HomeCardHtml(week({ legend: { available: true, reached: true, status: null, pending: null } }));
  assert.match(hot, /is-hot/);
  assert.match(hot, /Rencontrer Terrakium →/);
  assert.doesNotMatch(hot, /is-shadow/);
});

test('the screen keeps the server data and the existing buttons', () => {
  assert.match(SRC, /data-action="claimExpeditionChests"/);
  assert.match(SRC, /root\.querySelector\('\.exp-hero'\)\?\.remove\(\)/);
  assert.match(SRC, /catch \(_e\) \{ return html; \}/, 'falls back to the old screen on any error');
  assert.doesNotMatch(SRC, /fetch\(|\/api\//, 'no new request: same data, same buttons');
  // La carte du légendaire (Rencontrer / Reprendre) et la quête de Draby restent celles d'avant.
  assert.doesNotMatch(SRC, /meetExpeditionLegend|resumeExpeditionLegend/);
});

test('the legendary is shown on the scenery of its type', () => {
  const ctx = sandbox();
  const top = ctx.exp2ScreenTop(Object.assign(week(), { days: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'] }));
  assert.match(top, /\/img\/zones\/montagne\.png/);
  assert.match(top, /SEMAINE DU 02\/11/);
  assert.match(top, /Ouvrir mes coffres · \+2 Balls/);
  assert.equal((top.match(/class="exp2-mark/g) || []).length, 2, 'one chest mark + the crown');
});

test('« Aussi aujourd’hui » keeps the gift row and turns the rest into 4 tiles', () => {
  assert.match(SRC, /a === 'openHomeDayMore' \|\| a === 'openAlbumBinder' \|\| a === 'openExpedition'/);
  for (const action of ['openEggGame', 'openWeeklyLeague', 'openHomeDayMore', 'openBallBag']) assert.match(SRC, new RegExp('data-action="' + action + '"'));
  assert.doesNotMatch(SRC, /openBallGift|'openGift'/, 'the gift row is untouched');
});

test('no emoji icons in the new tiles: game items and our own drawings', () => {
  assert.match(SRC, /exp2Item\('oval-stone', 34\)/);
  assert.match(SRC, /exp2Item\('poke-radar'\)/);
  assert.match(SRC, /<svg viewBox="0 0 32 32"/);
});

test('animations stop with « Animations réduites » and the card never covers the page', () => {
  assert.match(X_CSS, /@media \(prefers-reduced-motion:no-preference\)\{\s*body:not\(\.reduce-motion\) \.exp2-alert/);
  assert.doesNotMatch(X_CSS, /position:fixed/);
  assert.match(X_CSS, /#screen-config\.hm-on>#exp2-home\{order:4\}/, 'phone: right after « Ta prochaine capture »');
  assert.match(X_CSS, /#screen-config\.hm-on>#exp2-home\{grid-column:1;grid-row:2/, 'PC: under the Défi du jour');
});
