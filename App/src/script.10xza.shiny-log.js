
// ===== ✨ Carnet shiny (3/11/2026, maquette « ce qui manque au plan ») =====
// Tous les shinies au même endroit : Pokémon du jour (GET /api/daily/shinies) et hautes herbes
// (GET /api/wild/collection → shinyLog), attrapés en couleur, enfuis en gris. Badges au 1er, 5e et 10e.
let wildShinyLog = null;
const SHINY_BADGES = Object.freeze([[1, "Premier shiny", 50], [5, "Chasseur de shinies", 150], [10, "Maître des shinies", 300]]);

function shinyLogEntries() {
  const daily = (typeof window !== "undefined" && window.__pokedleShinies && window.__pokedleShinies.shinies) || [];
  const wild = wildShinyLog || [];
  return daily.map((s) => ({ id: Number(s.id), day: s.day, source: "daily", caught: true }))
    .concat(wild.map((s) => ({ id: Number(s.id), day: s.day, source: "wild", caught: Boolean(s.caught) })))
    .filter((e) => typeof POKEMON_BY_ID !== "undefined" && POKEMON_BY_ID.has(e.id))
    .sort((a, b) => String(b.day).localeCompare(String(a.day)));
}
function shinyLogDay(day) { return String(day || "").split("-").reverse().slice(0, 2).join("/"); }
function shinyLogHtml() {
  const all = shinyLogEntries(), caught = all.filter((e) => e.caught), fled = all.length - caught.length;
  const next = SHINY_BADGES.find(([n]) => caught.length < n);
  const cards = all.map((e) => {
    const p = POKEMON_BY_ID.get(e.id);
    const where = e.source === "daily" ? "Pokémon du jour" : "Hautes herbes";
    return '<figure class="shl-card' + (e.caught ? "" : " is-fled") + '"><img src="' + escapeHtml(pokedexDetailArtwork(p, true)) + '" data-fallback="' + escapeHtml(typeof getPokemonShinySprite === "function" ? getPokemonShinySprite(p) : getPokemonSprite(p)) + '" alt="' + escapeHtml(p.name) + ' shiny" loading="lazy" draggable="false">' +
      '<figcaption><b>' + escapeHtml(p.name) + '</b><small>' + (e.caught ? where : "Enfui") + ' · ' + escapeHtml(shinyLogDay(e.day)) + '</small></figcaption></figure>';
  }).join("");
  return '<div class="shl">' +
    '<div class="shl-stats"><div><b>' + caught.length + '</b>shin' + (caught.length > 1 ? "ies" : "y") + '</div><div><b>' + fled + '</b>enfui' + (fled > 1 ? "s" : "") + '</div><div><b>1 sur 150</b>chance qu’une rencontre soit shiny</div></div>' +
    '<p class="shl-next">Chacun des 846 Pokémon des hautes herbes peut être shiny, et chaque Pokémon du jour trouvé aussi.</p>' +
    (next ? '<p class="shl-next">🏅 Prochain badge : <b>' + escapeHtml(next[1]) + '</b> à ' + next[0] + ' shin' + (next[0] > 1 ? "ies" : "y") + ' (encore ' + (next[0] - caught.length) + ')</p>' : '<p class="shl-next">🏅 Tous les badges shiny sont à toi !</p>') +
    (cards ? '<div class="shl-grid">' + cards + '</div>' : '<p class="shl-empty">Pas encore de shiny. Chaque Pokémon du jour trouvé et chaque rencontre dans les hautes herbes peut briller ✨</p>') +
    '<div class="shl-actions"><button type="button" class="ball-grass-cta" data-action="shinyLogGoGrass">🌿 Aller dans les hautes herbes</button></div></div>';
}
function shinyLogGoGrass() { if (typeof closeOverlayModal === "function") closeOverlayModal(); if (typeof openWildGrass === "function") openWildGrass(); }

// Badges : donnés une seule fois (playerProfile.shinyBadges), quand le nombre de shinies attrapés passe un palier.
function shinyLogCheckBadges() {
  if (typeof playerProfile === "undefined" || !playerProfile) return;
  const caught = shinyLogEntries().filter((e) => e.caught).length;
  const have = new Set(Array.isArray(playerProfile.shinyBadges) ? playerProfile.shinyBadges : []);
  const fresh = SHINY_BADGES.filter(([n]) => caught >= n && !have.has(n));
  if (!fresh.length) return;
  playerProfile.shinyBadges = [...have, ...fresh.map(([n]) => n)].sort((a, b) => a - b);
  if (typeof saveProfile === "function") saveProfile();
  for (const [, name, xp] of fresh) {
    if (typeof awardXp === "function") awardXp(xp, "Badge " + name);
    if (typeof showToast === "function") showToast("🏅 Badge « " + name + " » ✨ · +" + xp + " XP");
  }
}
function loadShinyLog() {
  const daily = typeof loadShinyCollection === "function" ? loadShinyCollection() : Promise.resolve(null);
  const wild = fetch("/api/wild/collection", { credentials: "same-origin" }).then((r) => r.ok ? r.json() : null)
    .then((d) => { if (d && d.ok) { wildShinyLog = d.shinyLog || []; if (typeof wildSyncAlbum === "function") wildSyncAlbum(d.captures); } }).catch(() => {});
  return Promise.all([daily, wild]).then(() => { shinyLogCheckBadges(); return shinyLogEntries(); });
}

// Un 3e onglet dans l'album, à côté de « Classeur » et « Régions et médailles ».
if (typeof albumRender === "function") {
  const albumRenderBeforeShiny = albumRender;
  albumRender = function () {
    const shiny = typeof albumView !== "undefined" && albumView.tab === "shiny";
    if (shiny) albumView.tab = "binder";
    albumRenderBeforeShiny.apply(this, arguments);
    if (shiny) albumView.tab = "shiny";
    const body = document.querySelector("#overlay-body .alb");
    const tabs = body && body.querySelector(".alb-tabs");
    if (!tabs) return;
    tabs.insertAdjacentHTML("beforeend", '<button type="button" role="tab" aria-selected="' + shiny + '" class="' + (shiny ? "is-on" : "") + '" data-action="albumTab" data-args=\'["shiny"]\'>✨ Carnet shiny</button>');
    if (!shiny) return;
    tabs.querySelectorAll("button").forEach((b) => { if (!b.dataset.args || !b.dataset.args.includes("shiny")) { b.classList.remove("is-on"); b.setAttribute("aria-selected", "false"); } });
    body.classList.remove("is-binder");
    [...body.children].forEach((el) => { if (el !== tabs && !el.classList.contains("alb-foot")) el.remove(); });
    tabs.insertAdjacentHTML("afterend", shinyLogHtml());
  };
}
if (typeof albumTab === "function") {
  const albumTabBeforeShiny = albumTab;
  albumTab = function (tab) {
    if (tab === "shiny") { albumView.tab = "shiny"; albumRender(); loadShinyLog().then(() => { if (albumView.tab === "shiny") albumRender(); }); return; }
    return albumTabBeforeShiny.apply(this, arguments);
  };
}
function openShinyLog() {
  if (typeof openAlbumBinder === "function") openAlbumBinder();
  albumTab("shiny");
}
// Un shiny attrapé dans les herbes : on recharge le carnet (badges compris).
if (typeof wildThrow === "function") {
  const wildThrowBeforeShiny = wildThrow;
  wildThrow = function () {
    const out = wildThrowBeforeShiny.apply(this, arguments);
    setTimeout(() => { const e = typeof ballState !== "undefined" && ballState && ballState.wild; if (e) loadShinyLog(); }, 6500);
    return out;
  };
  window.wildThrow = wildThrow;
}
window.albumTab = albumTab;
window.openShinyLog = openShinyLog;
window.shinyLogGoGrass = shinyLogGoGrass;
