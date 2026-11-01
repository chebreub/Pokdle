// « Mes Pokémon préférés » (01/11/2026): the favourites table, rebuilt. The same table as before (one
// Pokémon per type and per generation, plus Starter, Formes, Légendes, a favourite per row and per
// column, and an overall n°1), now whole on a phone, in French, in normal and in ✨ shiny, with a dice
// for empty cells and an image to share. The choices keep their keys (pokedle_ranking_v1); the shiny
// table uses the same keys with « s: » in front, so nothing chosen before is lost.
const FAV_TYPE_COLORS = Object.freeze({
  Normal: "#A8A77A", Feu: "#EE8130", Eau: "#6390F0", Plante: "#7AC74C", "Électrik": "#E2BF1F", Glace: "#7ACFCA",
  Combat: "#C22E28", Poison: "#A33EA1", Sol: "#C9A64B", Vol: "#8E78E8", Psy: "#F95587", Insecte: "#A6B91A",
  Roche: "#B6A136", Spectre: "#735797", Dragon: "#6F35FC", "Ténèbres": "#705746", Acier: "#8F8FB0", "Fée": "#D685AD",
});
const FAV_SPECIAL = Object.freeze({ starter: ["⭐", "Starter", "#7C5BD6"], gimmick: ["🌀", "Formes", "#3BA7A0"], legend: ["👑", "Légendes", "#2E2A33"] });
const FAV_REGIONS = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unys", "Kalos", "Alola", "Galar", "Paldea"];
const FAV_SHINY_PREFIX = "s:";
let favGridShiny = false;
let favGridSel = null;

function favKey(key, shiny = favGridShiny) { return (shiny ? FAV_SHINY_PREFIX : "") + key; }
function favPick(key, shiny = favGridShiny) {
  const id = Number(rankingChoices[favKey(key, shiny)]);
  return Number.isInteger(id) ? POKEMON_BY_ID.get(id) || null : null;
}
// The shiny sprite sits next to the normal one in PokeAPI's tree.
function favShinySpriteUrl(url) { return String(url || "").replace(/\/sprites\/pokemon\/(\d+\.png)$/, "/sprites/pokemon/shiny/$1"); }
function favSprite(p, shiny = favGridShiny) { const url = getPokemonSprite(p); return shiny ? favShinySpriteUrl(url) : url; }
function favColumnInfo(col) {
  const special = FAV_SPECIAL[col.key];
  if (special) return { label: special[1], color: special[2], emoji: special[0], icon: null };
  return { label: col.label, color: FAV_TYPE_COLORS[col.label] || "#8F8FB0", emoji: "", icon: typeof getTypeIconPath === "function" ? getTypeIconPath(col.label) : null };
}
function favCellCount(shiny = favGridShiny) {
  let n = 0;
  for (let gen = 1; gen <= 9; gen += 1) for (const col of RANKING_COLUMNS) if (favPick(rankingCellKey(gen, col.key), shiny)) n += 1;
  return n;
}
function favCompactLayout() {
  // Up to a tablet, the tall table: its cells stay big enough to recognise each Pokémon.
  try { return window.matchMedia("(max-width: 1000px)").matches; } catch (_e) { return false; }
}
function favUnique(list) {
  const seen = new Set();
  return list.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
}
// Who can go in a cell: the Pokémon of that generation and column; a favourite picks among the cells.
function favCandidates(kind, gen, colKey, shiny = favGridShiny) {
  if (kind === "cell") {
    const col = RANKING_COLUMNS.find((c) => c.key === colKey);
    return col ? POKEMON_LIST.filter((p) => p.gen === gen && col.matcher(p)).sort((a, b) => getPokemonDexNumber(a) - getPokemonDexNumber(b) || a.id - b.id) : [];
  }
  if (kind === "gen") return favUnique(RANKING_COLUMNS.map((c) => favPick(rankingCellKey(gen, c.key), shiny)));
  if (kind === "type") return favUnique(Array.from({ length: 9 }, (_, i) => favPick(rankingCellKey(i + 1, colKey), shiny)));
  const favourites = favUnique([...Array.from({ length: 9 }, (_, i) => favPick(rankingFavoriteKey(i + 1), shiny)), ...RANKING_COLUMNS.map((c) => favPick(rankingFavoriteRowKey(c.key), shiny))]);
  if (favourites.length) return favourites;
  const all = [];
  for (let gen = 1; gen <= 9; gen += 1) for (const c of RANKING_COLUMNS) all.push(favPick(rankingCellKey(gen, c.key), shiny));
  return favUnique(all);
}

function favCellButton(kind, key, gen, colKey, label, extra = "") {
  const p = favPick(key);
  // No Pokémon of that kind in that generation (no special form before Gen 3): an empty square.
  if (!p && kind === "cell" && !favCandidates("cell", gen, colKey).length) return `<div class="fav-cell is-none" title="${escapeHtml(label + " : aucun Pokémon")}" aria-hidden="true"></div>`;
  const args = escapeHtml(JSON.stringify([kind, key, gen, colKey]));
  const img = p ? `<img src="${escapeHtml(favSprite(p))}" data-fallback="${escapeHtml(getPokemonSprite(p))}" alt="" loading="lazy" decoding="async">` : "";
  return `<button type="button" class="fav-cell${p ? "" : " is-empty"}${extra}" data-action="openFavPicker" data-args="${args}" aria-label="${escapeHtml(label + (p ? " : " + p.name : " : à choisir"))}" title="${escapeHtml(p ? p.name : label)}">${img}</button>`;
}
function favRowLabel(col) {
  const info = favColumnInfo(col);
  const icon = info.icon ? `<img src="${escapeHtml(info.icon)}" alt="">` : `<span aria-hidden="true">${info.emoji}</span>`;
  return `<div class="fav-head fav-row-head" style="--fav-col:${info.color}">${icon}<span>${escapeHtml(info.label)}</span></div>`;
}
function favColHead(col) {
  const info = favColumnInfo(col);
  const icon = info.icon ? `<img src="${escapeHtml(info.icon)}" alt="">` : `<span aria-hidden="true">${info.emoji}</span>`;
  return `<div class="fav-head fav-col-head" style="--fav-col:${info.color}">${icon}<span>${escapeHtml(info.label)}</span></div>`;
}
const favGenHead = (gen, wide) => `<div class="fav-head fav-gen-head" title="${FAV_REGIONS[gen - 1]}"><b>${wide ? "Gen " + gen : gen}</b>${wide ? `<small>${FAV_REGIONS[gen - 1]}</small>` : ""}</div>`;
const FAV_HEART_HEAD = '<div class="fav-head fav-heart-head" title="Ton préféré">❤️</div>';

// Phone: types in rows, generations in columns, so the whole table fits the width.
function favTallGridHtml() {
  const cols = RANKING_COLUMNS;
  let h = '<div class="fav-corner"></div>' + Array.from({ length: 9 }, (_, i) => favGenHead(i + 1, false)).join("") + FAV_HEART_HEAD;
  for (const col of cols) {
    const info = favColumnInfo(col);
    h += favRowLabel(col);
    for (let gen = 1; gen <= 9; gen += 1) h += favCellButton("cell", rankingCellKey(gen, col.key), gen, col.key, info.label + " · Gen " + gen);
    h += favCellButton("type", rankingFavoriteRowKey(col.key), 0, col.key, "Préféré " + info.label, " is-fav");
  }
  h += '<div class="fav-head fav-row-head is-fav-row">❤️ <span>Préféré</span></div>';
  for (let gen = 1; gen <= 9; gen += 1) h += favCellButton("gen", rankingFavoriteKey(gen), gen, "", "Préféré de la Gen " + gen, " is-fav");
  h += favCellButton("top", rankingFavoriteRowKey("favorite"), 0, "favorite", "Ton n°1", " is-fav is-top");
  return h;
}
// Computer: generations in rows, types in columns, like the table people know.
function favWideGridHtml() {
  const cols = RANKING_COLUMNS;
  let h = '<div class="fav-corner"></div>' + cols.map(favColHead).join("") + FAV_HEART_HEAD;
  for (let gen = 1; gen <= 9; gen += 1) {
    h += favGenHead(gen, true);
    for (const col of cols) h += favCellButton("cell", rankingCellKey(gen, col.key), gen, col.key, favColumnInfo(col).label + " · Gen " + gen);
    h += favCellButton("gen", rankingFavoriteKey(gen), gen, "", "Préféré de la Gen " + gen, " is-fav");
  }
  h += '<div class="fav-head fav-gen-head is-fav-row"><b>❤️</b><small>du type</small></div>';
  for (const col of cols) h += favCellButton("type", rankingFavoriteRowKey(col.key), 0, col.key, "Préféré " + favColumnInfo(col).label, " is-fav");
  h += favCellButton("top", rankingFavoriteRowKey("favorite"), 0, "favorite", "Ton n°1", " is-fav is-top");
  return h;
}

const FAV_SHELL = `<div class="card fav-screen">
  <div class="fav-top">
    <div class="fav-title"><h2 class="card-title">Mes Pokémon préférés</h2><p class="card-desc">Ton préféré de chaque type, dans chaque génération. Touche une case pour choisir.</p></div>
    <div class="fav-tools">
      <div class="fav-seg" role="group" aria-label="Version"><button type="button" data-action="setFavGridShiny" data-args="[false]">Normal</button><button type="button" data-action="setFavGridShiny" data-args="[true]">✨ Shiny</button></div>
      <div class="fav-progress"><span id="fav-count"></span><i><b id="fav-bar"></b></i></div>
    </div>
  </div>
  <div id="fav-grid" class="fav-grid"></div>
  <div class="fav-actions">
    <button type="button" class="btn-blue fav-share" data-action="openFavShare">📸 Partager ma grille</button>
    <button type="button" class="btn-ghost" data-action="favRandomFill" title="Remplir les cases vides au hasard">🎲 Au hasard</button>
    <button type="button" class="btn-ghost btn-danger-ghost" data-action="favResetGrid">🧹 Vider</button>
    <button type="button" class="btn-ghost" data-action="goToConfig">← Retour</button>
  </div>
</div>`;

function renderRankingGrid() {
  const screen = document.getElementById("screen-ranking");
  // Drawn when the screen opens, not on every page load.
  if (!screen || screen.classList.contains("hidden")) return;
  if (screen.dataset.favGrid !== "1") { screen.innerHTML = FAV_SHELL; screen.dataset.favGrid = "1"; }
  const grid = document.getElementById("fav-grid");
  const tall = favCompactLayout();
  grid.className = "fav-grid " + (tall ? "is-tall" : "is-wide") + (favGridShiny ? " is-shiny" : "");
  grid.style.gridTemplateColumns = tall ? "minmax(60px, 74px) repeat(10, minmax(0, 1fr))" : `84px repeat(${RANKING_COLUMNS.length + 1}, minmax(0, 1fr))`;
  grid.innerHTML = tall ? favTallGridHtml() : favWideGridHtml();
  screen.querySelectorAll(".fav-seg button").forEach((b, i) => b.setAttribute("aria-pressed", String(Boolean(i) === favGridShiny)));
  const total = 9 * RANKING_COLUMNS.length, n = favCellCount();
  const count = document.getElementById("fav-count"); if (count) count.textContent = n + "/" + total + " cases";
  const bar = document.getElementById("fav-bar"); if (bar) bar.style.width = Math.round(n / total * 100) + "%";
}
function renderPickedSummary() {}

function openRankingMode() {
  for (const id of ["screen-config", "screen-game", "screen-games-ranking", "screen-pokedex", "screen-type-chart", "screen-draft-arena", "screen-draft-score-attack", "screen-team-builder", "screen-teams"]) document.getElementById(id)?.classList.add("hidden");
  try { stopEmulatorSession(); } catch (_e) {}
  showScreen("screen-ranking");
  try { setGlobalNavActive("rank"); } catch (_e) {}
  closeRankingPicker();
  renderRankingGrid();
}
function setFavGridShiny(on) { favGridShiny = Boolean(on); closeRankingPicker(); renderRankingGrid(); }

// ---- picking
function favSheetTitle(kind, gen, colKey) {
  const col = RANKING_COLUMNS.find((c) => c.key === colKey);
  const info = col ? favColumnInfo(col) : null;
  if (kind === "cell") return { title: info.label + " · Gen " + gen, chip: FAV_REGIONS[gen - 1], color: info.color };
  if (kind === "gen") return { title: "❤️ Préféré · Gen " + gen, chip: FAV_REGIONS[gen - 1], color: "#2E2A33" };
  if (kind === "type") return { title: "❤️ Préféré · " + info.label, chip: "parmi tes choix", color: info.color };
  return { title: "👑 Ton n°1", chip: "parmi tes préférés", color: "#7C5BD6" };
}
function favCandidateHtml(list, current) {
  if (!list.length) return '<p class="fav-empty">Remplis d’abord quelques cases de cette ligne ou de cette colonne.</p>';
  return list.map((p) => `<button type="button" class="fav-cand${current && current.id === p.id ? " is-on" : ""}" data-action="chooseFavPick" data-args="[${p.id}]" data-name="${escapeHtml(norm(p.name))}"><img src="${escapeHtml(pokedexDetailArtwork(p, favGridShiny))}" data-fallback="${escapeHtml(favSprite(p))}" alt="" loading="lazy" decoding="async"><span>${escapeHtml(p.name)}</span></button>`).join("");
}
function openFavPicker(kind, key, gen, colKey) {
  closeRankingPicker();
  const list = favCandidates(kind, gen, colKey);
  const head = favSheetTitle(kind, gen, colKey);
  const current = favPick(key);
  favGridSel = { kind, key, gen, colKey };
  const back = document.createElement("div");
  back.className = "fav-sheet-back"; back.dataset.action = "closeRankingPicker";
  const sheet = document.createElement("div");
  sheet.className = "fav-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", head.title);
  sheet.innerHTML = `<div class="fav-sheet-grab" aria-hidden="true"></div>
    <div class="fav-sheet-head"><h3>${escapeHtml(head.title)}</h3><span class="fav-chip" style="background:${head.color}">${escapeHtml(head.chip)}</span><button type="button" class="fav-sheet-x" data-action="closeRankingPicker" aria-label="Fermer">✕</button></div>
    ${list.length > 8 ? '<input type="search" class="fav-search" placeholder="Cherche un Pokémon…" autocomplete="off" aria-label="Chercher un Pokémon">' : ""}
    <div class="fav-cands">${favCandidateHtml(list, current)}</div>
    ${current ? '<div class="fav-sheet-foot"><button type="button" class="btn-ghost btn-danger-ghost" data-action="clearFavPick">Retirer ' + escapeHtml(current.name) + "</button></div>" : ""}`;
  document.body.appendChild(back); document.body.appendChild(sheet);
  document.body.classList.add("fav-sheet-open");
  const search = sheet.querySelector(".fav-search");
  if (search) search.addEventListener("input", () => {
    const q = norm(search.value || "");
    sheet.querySelectorAll(".fav-cand").forEach((b) => { b.hidden = Boolean(q) && !b.dataset.name.includes(q); });
  });
}
function closeRankingPicker() {
  favGridSel = null;
  document.querySelectorAll(".fav-sheet, .fav-sheet-back").forEach((n) => n.remove());
  document.body?.classList.remove("fav-sheet-open");
}
function chooseFavPick(id) {
  if (!favGridSel) return;
  rankingChoices[favKey(favGridSel.key)] = Number(id);
  saveRankingChoices(); closeRankingPicker(); renderRankingGrid();
}
function clearFavPick() {
  if (!favGridSel) return;
  delete rankingChoices[favKey(favGridSel.key)];
  saveRankingChoices(); closeRankingPicker(); renderRankingGrid();
}
// The dice: each empty cell gets one of its Pokémon; the favourites stay for the player to choose.
function favRandomFill(random = Math.random) {
  let n = 0;
  for (let gen = 1; gen <= 9; gen += 1) for (const col of RANKING_COLUMNS) {
    const key = rankingCellKey(gen, col.key);
    if (favPick(key)) continue;
    const list = favCandidates("cell", gen, col.key);
    if (!list.length) continue;
    rankingChoices[favKey(key)] = list[Math.floor(random() * list.length)].id; n += 1;
  }
  saveRankingChoices(); renderRankingGrid();
  if (typeof showToast === "function") showToast(n ? "🎲 " + n + " cases remplies au hasard" : "Ton tableau est déjà complet");
  return n;
}
function favResetGrid() {
  const label = favGridShiny ? "ton tableau shiny" : "ton tableau normal";
  if (typeof confirm === "function" && !confirm("Vider " + label + " ?")) return;
  for (const key of Object.keys(rankingChoices)) if (key.startsWith(FAV_SHINY_PREFIX) === favGridShiny) delete rankingChoices[key];
  saveRankingChoices(); closeRankingPicker(); renderRankingGrid();
}
function resetRankingChoices() { favResetGrid(); }

// ---- the image to share (1080 × 1920, a story): types in rows, generations in columns
const FAV_IMG = Object.freeze({ w: 1080, h: 1920, label: 178, cell: 76, row: 61, gap: 5, top: 214 });
function favImageLayout() {
  const rows = RANKING_COLUMNS.length + 1, cols = 10;
  const width = FAV_IMG.label + cols * (FAV_IMG.cell + FAV_IMG.gap);
  const x0 = Math.round((FAV_IMG.w - width) / 2);
  return { rows, cols, x0, y0: FAV_IMG.top, head: 62, cellX: (c) => x0 + FAV_IMG.label + FAV_IMG.gap + c * (FAV_IMG.cell + FAV_IMG.gap), rowY: (r) => FAV_IMG.top + 62 + FAV_IMG.gap + r * (FAV_IMG.row + FAV_IMG.gap) };
}
function favLoadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async";
    const done = (ok) => resolve(ok ? img : null);
    img.onload = () => done(true); img.onerror = () => done(false);
    setTimeout(() => done(img.complete && img.naturalWidth > 0), 8000);
    img.src = src;
  });
}
function favRoundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
async function favDrawImage(canvas, shiny = favGridShiny) {
  const ctx = canvas.getContext("2d"); const L = favImageLayout();
  canvas.width = FAV_IMG.w; canvas.height = FAV_IMG.h;
  try { await Promise.all(["700 74px Fredoka", "800 30px Nunito", "800 21px Nunito"].map((f) => document.fonts.load(f))); } catch (_e) {}
  ctx.fillStyle = "#FFF8EF"; ctx.fillRect(0, 0, FAV_IMG.w, FAV_IMG.h);
  for (const [x, y, r, c] of [[80, 120, 620, "rgba(217,204,255,.75)"], [1000, 1500, 640, "rgba(255,231,168,.7)"]]) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, "rgba(255,248,239,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, FAV_IMG.w, FAV_IMG.h); }
  ctx.textAlign = "center"; ctx.fillStyle = "#2E2A33"; ctx.font = "700 74px Fredoka, sans-serif";
  ctx.fillText(shiny ? "Mes shinies préférés ✨" : "Mes Pokémon préférés", FAV_IMG.w / 2, 120);
  const who = typeof connectedAccountUser !== "undefined" && connectedAccountUser?.username ? " · " + connectedAccountUser.username : "";
  ctx.fillStyle = "#6B6472"; ctx.font = "800 30px Nunito, sans-serif"; ctx.fillText("par type et par génération" + who, FAV_IMG.w / 2, 172);
  const cells = [];
  const jobs = [];
  const cellBox = (c, r) => ({ x: L.cellX(c), y: L.rowY(r), w: FAV_IMG.cell, h: FAV_IMG.row });
  // headers
  for (let g = 0; g < 10; g += 1) {
    const x = L.cellX(g); ctx.fillStyle = g === 9 ? "#FFD45C" : "#2E2A33"; favRoundRect(ctx, x, L.y0, FAV_IMG.cell, L.head, 12); ctx.fill();
    ctx.fillStyle = g === 9 ? "#2E2A33" : "#fff"; ctx.font = g === 9 ? "700 30px Fredoka, sans-serif" : "700 28px Fredoka, sans-serif";
    ctx.fillText(g === 9 ? "❤️" : String(g + 1), x + FAV_IMG.cell / 2, L.y0 + (g === 9 ? 41 : 32));
    if (g < 9) { ctx.font = "800 12px Nunito, sans-serif"; ctx.fillText(FAV_REGIONS[g], x + FAV_IMG.cell / 2, L.y0 + 52); }
  }
  const rows = [...RANKING_COLUMNS.map((col) => ({ col, info: favColumnInfo(col) })), { col: null, info: { label: "Préféré", color: "#FFD45C", emoji: "❤️" } }];
  rows.forEach((row, r) => {
    const y = L.rowY(r);
    ctx.fillStyle = row.info.color; favRoundRect(ctx, L.x0, y, FAV_IMG.label, FAV_IMG.row, 14); ctx.fill();
    ctx.textAlign = "left"; ctx.fillStyle = row.col ? "#fff" : "#2E2A33"; ctx.font = "800 21px Nunito, sans-serif";
    ctx.fillText(row.info.label, L.x0 + 52, y + FAV_IMG.row / 2 + 7);
    if (row.info.icon) jobs.push(favLoadImage(row.info.icon).then((img) => img && ctx.drawImage(img, L.x0 + 12, y + FAV_IMG.row / 2 - 15, 30, 30)));
    else { ctx.font = "24px sans-serif"; ctx.fillText(row.info.emoji, L.x0 + 13, y + FAV_IMG.row / 2 + 9); }
    ctx.textAlign = "center";
    for (let c = 0; c < 10; c += 1) {
      const key = row.col ? (c < 9 ? rankingCellKey(c + 1, row.col.key) : rankingFavoriteRowKey(row.col.key)) : (c < 9 ? rankingFavoriteKey(c + 1) : rankingFavoriteRowKey("favorite"));
      const p = favPick(key, shiny), b = cellBox(c, r), fav = c === 9 || !row.col;
      ctx.fillStyle = fav ? "#FFF4D1" : (p ? "#FFFFFF" : "rgba(255,255,255,.5)"); favRoundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
      ctx.strokeStyle = fav ? "#F3D27A" : "#EFE6DA"; ctx.lineWidth = 1.5; ctx.stroke();
      if (p) cells.push({ p, b });
    }
  });
  // A shiny sprite missing upstream falls back to the normal one, like the cells on screen.
  await Promise.all([...jobs, ...cells.map(({ p, b }) => favLoadImage(favSprite(p, shiny)).then((img) => img || (shiny ? favLoadImage(favSprite(p, false)) : null)).then((img) => {
    if (!img) return;
    const s = Math.min(b.w, b.h) - 2; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, b.x + (b.w - s) / 2, b.y + (b.h - s) / 2, s, s);
  }))]);
  // footer
  ctx.imageSmoothingEnabled = true; ctx.textAlign = "right"; ctx.fillStyle = "#2E2A33"; ctx.font = "800 34px Nunito, sans-serif";
  ctx.fillText("Fais la tienne sur", 548, 1846);
  ctx.fillStyle = "#2b4fb8"; favRoundRect(ctx, 566, 1792, 236, 82, 41); ctx.fill();
  ctx.fillStyle = "#4069E0"; favRoundRect(ctx, 566, 1784, 236, 82, 41); ctx.fill();
  ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "700 44px Fredoka, sans-serif"; ctx.fillText("pokdle.fr", 684, 1840);
  return canvas;
}
async function openFavShare() {
  closeRankingPicker();
  if (typeof ensureOverlay === "function") ensureOverlay("Ma grille", '<p class="fav-share-wait">Préparation de ton image…</p>');
  const canvas = document.createElement("canvas");
  await favDrawImage(canvas);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) { if (typeof showToast === "function") showToast("Image impossible à créer"); return; }
  const url = URL.createObjectURL(blob);
  const file = typeof File === "function" ? new File([blob], "pokedle-mes-preferes.png", { type: "image/png" }) : null;
  window.__favShareFile = file;
  const canShare = Boolean(file && navigator.canShare && navigator.canShare({ files: [file] }));
  const body = `<div class="fav-share"><img src="${url}" alt="Ta grille de Pokémon préférés"><div class="fav-share-row">
    ${canShare ? '<button type="button" class="btn-blue" data-action="favShareNow">📤 Partager</button>' : ""}
    <a class="${canShare ? "btn-ghost" : "btn-blue"}" href="${url}" download="pokedle-mes-preferes.png">⬇️ Enregistrer l’image</a></div>
    <p class="fav-share-hint">Poste-la en story ou sur TikTok : « Et toi, c’est qui ton préféré ? »</p></div>`;
  if (typeof ensureOverlay === "function") ensureOverlay(favGridShiny ? "Mes shinies préférés ✨" : "Mes Pokémon préférés", body);
}
async function favShareNow() {
  const file = window.__favShareFile;
  if (!file || !navigator.share) return;
  try { await navigator.share({ files: [file], title: "Mes Pokémon préférés", text: "Fais la tienne sur pokdle.fr" }); } catch (_e) {}
}

// Redraw for the other layout when the screen turns or the window is resized.
(function () {
  if (typeof window === "undefined" || !window.addEventListener) return;
  let last = null, timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const screen = document.getElementById("screen-ranking");
      const tall = favCompactLayout();
      if (screen && !screen.classList.contains("hidden") && tall !== last) renderRankingGrid();
      last = tall;
    }, 150);
  });
})();
Object.assign(window, { openRankingMode, setFavGridShiny, openFavPicker, chooseFavPick, clearFavPick, favRandomFill, favResetGrid, openFavShare, favShareNow, closeRankingPicker, renderRankingGrid, resetRankingChoices });
