// Filming-only staging, injected in the page (nothing changes in the repo).
const NO_SCROLL = `
  document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'html{overflow:hidden!important} body{position:fixed!important;top:0!important;left:0!important;right:0!important}'; document.head.appendChild(s); });
  Element.prototype.scrollIntoView = function () {};
  window.scrollTo = window.scroll = window.scrollBy = function () {};
  Element.prototype.scrollTo = Element.prototype.scrollBy = function () {};
`;
const css = (rules) => `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(rules)}; document.head.appendChild(s); });`;
const LAST_ROW_ONLY = 'html body #results-table #results-body > tr.guess-result-row:not(:last-child){display:none!important} html{scroll-behavior:auto!important}';
async function forceSecret(page, id) {
  await page.evaluate((id) => {
    const target = POKEMON_LIST.find((p) => p.id === id);
    window.pickRandomPokemonFromPool = () => target;
    pickRandomPokemonFromPool = () => target;
    restartCurrentMode();
  }, id);
  const got = await page.evaluate('secretPokemon && secretPokemon.name');
  if (!got) throw new Error('secret not set');
  return got;
}
const LAST_ROW_JS = `
  document.addEventListener('DOMContentLoaded', () => {
    const fix = () => { const b = document.getElementById('results-body'); if (!b) return; const rows = [...b.children]; rows.forEach((r, i) => { if (i < rows.length - 1) r.style.setProperty('display', 'none', 'important'); }); };
    new MutationObserver(fix).observe(document.body, { childList: true, subtree: true });
  });
`;
module.exports = { LAST_ROW_JS, NO_SCROLL, css, LAST_ROW_ONLY, forceSecret };
module.exports.HIDE_VISITORS = `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#halloween-stage,#mobile-tabbar,.halloween-corner-pumpkins{display:none!important}'; document.head.appendChild(s); });`;
module.exports.rowStatus = async (page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll('#results-body > tr')]; const r = rows[rows.length - 1]; if (!r) return null;
  return [...r.querySelectorAll('.guess-result-cell')].map((c) => ({ cls: c.className + ' ' + (c.firstElementChild?.className || ''), txt: c.innerText.replace(/\s+/g, ' ').trim() }));
});
module.exports.SHIFT = (px) => `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'body{top:-${px}px!important}'; document.head.appendChild(s); });`;
