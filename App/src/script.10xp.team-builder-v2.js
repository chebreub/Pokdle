// « Mon équipe » (01/11/2026): the Team Builder made visual. The same builder underneath (moves, item,
// nature, talent, EV/IV, Téra, analysis, saved teams, import/export); on top: the 6 Pokémon as big
// cards, « Ton équipe face aux types » in colour, the editor in tabs (a sheet on a phone), a
// randomizer that keeps the 🔒 locked Pokémon, and an image of the team to share.
const TB_RANDOM_KEY = "pokedle_team_random_v1";
const TB_TABS = [["set", "Attaques"], ["reglages", "Réglages"], ["stats", "Stats"], ["tera", "Téra"]];
let tbTab = "set";
const tbLocks = new Set();

function tbCompactLayout() {
  try { return window.matchMedia("(max-width: 760px)").matches; } catch (_e) { return false; }
}
function tbTypeColor(type) { return (typeof FAV_TYPE_COLORS !== "undefined" && FAV_TYPE_COLORS[type]) || "#8F8FB0"; }

// ---- the six cards
function renderTeamBuilderGrid() {
  const grid = document.getElementById("team-builder-grid");
  if (!grid || !teamBuilderState) return;
  grid.innerHTML = teamBuilderState.map((slot, index) => {
    const p = getTeamBuilderPokemon(slot);
    const active = index === teamBuilderActiveSlot ? " is-active" : "";
    if (!p) return `<button type="button" class="tb-card is-empty${active}" data-action="openTeamSlot" data-args="[${index}]" aria-label="Slot ${index + 1} : ajouter un Pokémon"><i aria-hidden="true">+</i><span>Ajouter</span></button>`;
    const c1 = tbTypeColor(p.type1), c2 = tbTypeColor(p.type2 || p.type1);
    const locked = tbLocks.has(index);
    const item = slot.item && slot.item !== "Aucun" ? `<span class="tb-item">${escapeHtml(slot.item)}</span>` : "";
    return `<div class="tb-card-wrap${active}"><button type="button" class="tb-card" data-action="openTeamSlot" data-args="[${index}]" style="--tb-c1:${c1};--tb-c2:${c2}" aria-label="${escapeHtml(p.name)}, slot ${index + 1}">
      <img src="${escapeHtml(pokedexDetailArtwork(p))}" data-fallback="${escapeHtml(getPokemonSprite(p))}" alt="" loading="lazy" decoding="async">
      <b>${escapeHtml(p.name)}</b><span class="tb-types">${typeBadgesHtml(p.type1, p.type2)}</span>${item}</button>
      <button type="button" class="tb-lock${locked ? " is-on" : ""}" data-action="toggleTeamLock" data-args="[${index}]" aria-pressed="${locked}" title="${locked ? "Gardé au prochain tirage" : "Garder au prochain tirage"}" aria-label="${locked ? "Déverrouiller" : "Garder"} ${escapeHtml(p.name)} au prochain tirage">${locked ? "🔒" : "🔓"}</button></div>`;
  }).join("");
}
function toggleTeamLock(index) {
  if (tbLocks.has(index)) tbLocks.delete(index); else tbLocks.add(index);
  renderTeamBuilderGrid();
}

// ---- « Ton équipe face aux types »
function tbCoverage(state = teamBuilderState) {
  const team = (state || []).map((slot) => getTeamBuilderPokemon(slot)).filter(Boolean);
  const rows = Object.keys(TYPE_EFFECTIVENESS).map((type) => {
    let weak = 0, resist = 0;
    for (const p of team) {
      const m = [p.type1, p.type2].filter(Boolean).reduce((acc, t) => acc * attackMultiplier(type, t), 1);
      if (m > 1) weak += 1; else if (m < 1) resist += 1;
    }
    return { type, weak, resist };
  });
  const byWeak = rows.filter((r) => r.weak >= 2).sort((a, b) => b.weak - a.weak || a.type.localeCompare(b.type, "fr"));
  const byResist = rows.filter((r) => r.resist >= 3 && r.weak === 0).sort((a, b) => b.resist - a.resist || a.type.localeCompare(b.type, "fr"));
  return { size: team.length, rows, weak: byWeak, strong: byResist };
}
const tbList = (types) => types.length < 2 ? types.join("") : types.slice(0, -1).join(", ") + " et " + types[types.length - 1];
function tbCoverageHtml(cov = tbCoverage()) {
  if (cov.size < 2) return '<section class="tb-cov"><h3>🛡️ Ton équipe face aux types</h3><p class="tb-cov-empty">Ajoute au moins 2 Pokémon pour voir ce que ton équipe craint.</p></section>';
  const cells = cov.rows.map((r) => {
    const badge = r.weak >= 2 ? `<em class="is-bad">−${r.weak}</em>` : r.resist >= 3 && !r.weak ? `<em class="is-good">+${r.resist}</em>` : "";
    const icon = typeof getTypeIconPath === "function" ? getTypeIconPath(r.type) : null;
    return `<div class="tb-cov-cell" style="background:${tbTypeColor(r.type)}" title="${escapeHtml(r.type)} : ${r.weak} faible(s), ${r.resist} résiste(nt)">${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ""}<span>${escapeHtml(r.type)}</span>${badge}</div>`;
  }).join("");
  const weakTypes = cov.weak.slice(0, 4).map((r) => r.type);
  const weakLine = weakTypes.length ? `<div class="is-bad">⚠️ Craint surtout <b>${escapeHtml(tbList(weakTypes))}</b> (${cov.weak[0].weak} Pokémon faibles${weakTypes.length > 1 ? " ou plus" : ""}).</div>` : '<div class="is-good">👍 Aucune faiblesse partagée par 2 Pokémon.</div>';
  const strongTypes = cov.strong.slice(0, 3).map((r) => r.type);
  const strongLine = strongTypes.length ? `<div class="is-good">✅ Tient bien face à <b>${escapeHtml(tbList(strongTypes))}</b>.</div>` : "";
  return `<section class="tb-cov"><h3>🛡️ Ton équipe face aux types <small>${cov.size}/6 Pokémon</small></h3><div class="tb-cov-grid">${cells}</div><div class="tb-verdict">${weakLine}${strongLine}</div></section>`;
}
if (typeof renderTeamBuilderSummary === "function") {
  const tbSummaryBefore = renderTeamBuilderSummary;
  renderTeamBuilderSummary = function () {
    const out = tbSummaryBefore.apply(this, arguments);
    const summary = document.getElementById("team-builder-summary");
    if (summary) {
      summary.querySelector(".tb-cov")?.remove();
      summary.insertAdjacentHTML("afterbegin", tbCoverageHtml());
    }
    return out;
  };
}

// ---- the editor: tabs, and a sheet on a phone
function tbSetupEditor() {
  // In the page, or in the sheet on a phone (the editor moves to the body while it is open).
  const editor = document.querySelector("#screen-team-builder .home-builder-editor, .tb-editor-sheet .home-builder-editor");
  if (!editor || editor.dataset.tbTabs === "1") return editor;
  editor.dataset.tbTabs = "1";
  const sections = [...editor.querySelectorAll(":scope > .team-builder-editor-section")];
  const advanced = editor.querySelector(":scope > details.team-builder-advanced");
  if (advanced) advanced.open = true;
  const inner = advanced ? [...advanced.querySelectorAll(":scope > .team-builder-editor-section")] : [];
  sections[0]?.classList.add("tb-pokemon-section");
  if (sections[1]) sections[1].dataset.tbTab = "set";
  if (inner[0]) inner[0].dataset.tbTab = "tera";
  if (inner[1]) inner[1].dataset.tbTab = "reglages";
  if (inner[2]) inner[2].dataset.tbTab = "stats";
  const head = editor.querySelector(":scope > .home-builder-editor-head");
  head?.insertAdjacentHTML("beforeend", '<button type="button" class="tb-editor-x" data-action="closeTeamEditor" aria-label="Fermer">✕</button>');
  const bar = document.createElement("div");
  bar.className = "tb-tabs"; bar.setAttribute("role", "tablist");
  bar.innerHTML = TB_TABS.map(([key, label]) => `<button type="button" role="tab" data-tab="${key}" data-action="setTeamEditorTab" data-args='["${key}"]'>${label}</button>`).join("");
  (sections[1] || advanced)?.before(bar);
  editor.classList.add("tb-tabbed");
  return editor;
}
function setTeamEditorTab(key) {
  tbTab = TB_TABS.some(([k]) => k === key) ? key : "set";
  const editor = tbSetupEditor();
  if (!editor) return;
  editor.dataset.tab = tbTab;
  editor.querySelectorAll(".tb-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tbTab)));
}
function openTeamSlot(index) {
  teamBuilderActiveSlot = Number(index) || 0;
  renderTeamBuilderModule();
  setTeamEditorTab(tbTab);
  const screen = document.getElementById("screen-team-builder");
  const editor = document.querySelector(".home-builder-editor.tb-tabbed");
  if (tbCompactLayout() && screen && editor) {
    screen.classList.add("tb-editing");
    document.body.classList.add("fav-sheet-open");
    if (!document.querySelector(".tb-editor-back")) {
      const back = document.createElement("div"); back.className = "fav-sheet-back tb-editor-back"; back.dataset.action = "closeTeamEditor";
      document.body.appendChild(back);
    }
    // The page's containers would trap a fixed sheet: the editor moves to the body while it is open
    // (its fields keep their ids and listeners), and goes back in place on close.
    if (!editor.parentElement?.classList.contains("tb-editor-sheet")) {
      const mark = document.createComment("tb-editor");
      editor.before(mark); tbEditorMark = mark;
      const sheet = document.createElement("div"); sheet.className = "tb-editor-sheet team-builder-module"; // keeps the module's field styles (dark theme included) sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Modifier le Pokémon");
      sheet.appendChild(editor); document.body.appendChild(sheet);
    }
    // An empty slot starts with the Pokémon to choose (after this click, which would close it as « a click outside »).
    if (!getTeamBuilderPokemon(teamBuilderState[teamBuilderActiveSlot])) setTimeout(() => { try { openTeamBuilderPokemonPicker(); } catch (_e) {} }, 0);
  }
}
let tbEditorMark = null;
function closeTeamEditor() {
  document.getElementById("screen-team-builder")?.classList.remove("tb-editing");
  const sheet = document.querySelector(".tb-editor-sheet");
  if (sheet) {
    const editor = sheet.querySelector(".home-builder-editor");
    if (editor && tbEditorMark?.parentNode) tbEditorMark.replaceWith(editor);
    sheet.remove(); tbEditorMark = null;
  }
  document.querySelectorAll(".tb-editor-back").forEach((n) => n.remove());
  document.body.classList.remove("fav-sheet-open");
  try { closeTeamBuilderPokemonPicker(); } catch (_e) {}
}
if (typeof openTeamBuilderScreen === "function") {
  const tbOpenBefore = openTeamBuilderScreen;
  openTeamBuilderScreen = function () {
    const out = tbOpenBefore.apply(this, arguments);
    closeTeamEditor();
    setTeamEditorTab(tbTab);
    return out;
  };
}

// ---- the randomizer
function tbRandomSettings() {
  const saved = typeof readJson === "function" ? readJson(TB_RANDOM_KEY, null) : null;
  const gens = Array.isArray(saved?.gens) ? saved.gens.map(Number).filter((g) => g >= 1 && g <= 9) : [];
  return { gens: gens.length ? gens : [1, 2, 3, 4, 5, 6, 7, 8, 9], strong: saved?.strong !== false, noLegend: saved?.noLegend !== false, varied: saved?.varied !== false, sets: saved?.sets !== false };
}
function tbSaveRandomSettings(s) { try { writeJson(TB_RANDOM_KEY, s); } catch (_e) {} }
async function tbBaseStatTotal(p) {
  try {
    const stats = (await loadLocalBaseStats())?.[String(getMysteryApiId(p))];
    return Array.isArray(stats) ? stats.reduce((a, b) => a + b, 0) : 0;
  } catch (_e) { return 0; }
}
// The Pokémon that can be drawn, with the chosen rules.
async function tbRandomPool(s) {
  const gens = new Set(s.gens);
  let pool = POKEMON_LIST.filter((p) => !p.isAltForm && gens.has(Number(p.gen)) && (!s.noLegend || !LEGENDARY_IDS.has(p.id)));
  if (s.strong) {
    const totals = await Promise.all(pool.map(tbBaseStatTotal));
    const strong = pool.filter((_, i) => totals[i] >= 450);
    if (strong.length >= 6) pool = strong;
  }
  return pool;
}
function tbPickTeam(pool, keep, n, s, random = Math.random) {
  const out = [], used = new Set(keep.map((p) => p.id));
  const typesTaken = new Set(keep.flatMap((p) => [p.type1, p.type2].filter(Boolean)));
  for (let tries = 0; out.length < n && tries < 4000; tries += 1) {
    const p = pool[Math.floor(random() * pool.length)];
    if (!p || used.has(p.id)) continue;
    const types = [p.type1, p.type2].filter(Boolean);
    // Varied types: no type twice in the team, relaxed when the rule cannot be met.
    if (s.varied && tries < 3000 && types.some((t) => typesTaken.has(t))) continue;
    used.add(p.id); types.forEach((t) => typesTaken.add(t)); out.push(p);
  }
  return out;
}
// 4 attacks that look like a real set: one of each of the Pokémon's types, one of another type for
// coverage, then the rest; the site's list of known moves first, never a joke move like Métronome.
const TB_WEAK_MOVES = new Set(["Métronome", "Attraction", "Écrasement", "Bélier", "Ultralaser", "Repos", "Clonage", "Vive-Attaque"]);
function tbPickMoves(pool, p, random = Math.random) {
  const all = (pool || []).map((m) => (typeof m === "string" ? { name: m, types: [] } : m)).filter((m) => m?.name);
  const moves = all.filter((m) => !TB_WEAK_MOVES.has(m.name));
  const known = new Set((typeof TEAM_BUILDER_MOVE_LIBRARY !== "undefined" ? TEAM_BUILDER_MOVE_LIBRARY : []).map((m) => m.name));
  const typesOf = (m) => (Array.isArray(m.types) ? m.types : []);
  const own = [p?.type1, p?.type2].filter(Boolean);
  const out = [];
  const pick = (list) => {
    const free = list.filter((m) => !out.includes(m.name));
    const best = free.filter((m) => known.has(m.name));
    const from = best.length ? best : free;
    if (!from.length) return false;
    out.push(from[Math.floor(random() * from.length)].name);
    return true;
  };
  for (const t of own) pick(moves.filter((m) => typesOf(m).includes(t)));
  pick(moves.filter((m) => typesOf(m).length && !typesOf(m).some((t) => own.includes(t))));
  while (out.length < 4 && pick(moves)) { /* the rest */ }
  while (out.length < 4 && pick(all)) { /* a tiny pool: anything it has */ }
  return out.slice(0, 4);
}
// A set that makes sense: its attacks come from what the Pokémon learns (waits for the list, 4 s at
// most), the EV follow its better attacking stat.
async function tbRandomSet(slot, p, random = Math.random) {
  try { await Promise.race([getTeamBuilderMovePoolForPokemon(p), new Promise((r) => setTimeout(r, 4000))]); } catch (_e) {}
  // Evoluroc only helps a Pokémon that still evolves: never drawn.
  const items = TEAM_BUILDER_ITEMS.filter((i) => i && i !== "Aucun" && i !== "Evoluroc");
  slot.item = items[Math.floor(random() * items.length)] || "";
  const natures = TEAM_BUILDER_NATURES.map((n) => n.value);
  slot.nature = natures[Math.floor(random() * natures.length)] || "Hardi";
  slot.moves = [...tbPickMoves(getTeamBuilderMovePool(slot), p, random), "", "", "", ""].slice(0, 4);
  let special = random() < .5;
  try { const st = (await loadLocalBaseStats())?.[String(getMysteryApiId(p))]; if (Array.isArray(st)) special = st[3] > st[1]; } catch (_e) {}
  try { applyTeamBuilderSpreadPreset(slot, special ? "offensive-speciale" : "offensive-physique", "ev"); } catch (_e) {}
}
async function rollTeam(random = Math.random) {
  if (!teamBuilderState) loadTeamBuilderState();
  const s = tbRandomSettings();
  const keep = [...tbLocks].map((i) => getTeamBuilderPokemon(teamBuilderState[i])).filter(Boolean);
  const free = teamBuilderState.map((_, i) => i).filter((i) => !(tbLocks.has(i) && getTeamBuilderPokemon(teamBuilderState[i])));
  const picks = tbPickTeam(await tbRandomPool(s), keep, free.length, s, random);
  await Promise.all(free.map(async (i, k) => {
    const p = picks[k];
    const slot = createTeamBuilderEmptySlot();
    if (p) { slot.pokemonId = p.id; if (s.sets) await tbRandomSet(slot, p, random); }
    teamBuilderState[i] = slot;
  }));
  saveTeamBuilderState();
  closeRankingPicker();
  renderTeamBuilderModule();
  if (typeof showToast === "function") showToast(keep.length ? "🎲 Nouvelle équipe, " + keep.length + " Pokémon gardé(s)" : "🎲 Nouvelle équipe !");
  return picks;
}
function openTeamRandomizer() {
  closeRankingPicker(); closeTeamEditor();
  const s = tbRandomSettings();
  const back = document.createElement("div"); back.className = "fav-sheet-back"; back.dataset.action = "closeRankingPicker";
  const sheet = document.createElement("div");
  sheet.className = "fav-sheet tb-random"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Équipe au hasard");
  const opt = (key, label, hint) => `<label class="tb-opt"><input type="checkbox" data-tb-opt="${key}"${s[key] ? " checked" : ""}><span><b>${label}</b><small>${hint}</small></span></label>`;
  sheet.innerHTML = `<div class="fav-sheet-grab" aria-hidden="true"></div>
    <div class="fav-sheet-head"><h3>🎲 Équipe au hasard</h3><button type="button" class="fav-sheet-x" data-action="closeRankingPicker" aria-label="Fermer">✕</button></div>
    <p class="tb-random-hint">Les Pokémon marqués 🔒 sont gardés, les autres sont tirés au sort.</p>
    <p class="tb-gens-label" id="tb-gens-label">Générations</p>
    <div class="tb-gens" role="group" aria-labelledby="tb-gens-label">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => `<button type="button" data-tb-gen="${g}" aria-pressed="${s.gens.includes(g)}">${g}</button>`).join("")}</div>
    ${opt("strong", "Pokémon forts seulement", "Au moins 450 de stats de base : pas de Chenipan.")}
    ${opt("noLegend", "Sans légendaires ni fabuleux", "")}
    ${opt("varied", "Types variés", "Pas deux fois le même type dans l’équipe.")}
    ${opt("sets", "Attaques, objet et nature au hasard", "Sinon, juste les Pokémon.")}
    <button type="button" class="btn-blue tb-roll" data-action="rollTeamFromSheet">🎲 Tirer l’équipe</button>`;
  document.body.appendChild(back); document.body.appendChild(sheet);
  document.body.classList.add("fav-sheet-open");
  sheet.addEventListener("click", (ev) => {
    const gen = ev.target.closest("[data-tb-gen]");
    if (!gen) return;
    const on = gen.getAttribute("aria-pressed") !== "true";
    if (!on && sheet.querySelectorAll('[data-tb-gen][aria-pressed="true"]').length <= 1) return;
    gen.setAttribute("aria-pressed", String(on));
  });
}
async function rollTeamFromSheet() {
  const sheet = document.querySelector(".tb-random");
  if (sheet) {
    const s = tbRandomSettings();
    s.gens = [...sheet.querySelectorAll('[data-tb-gen][aria-pressed="true"]')].map((b) => Number(b.dataset.tbGen));
    sheet.querySelectorAll("[data-tb-opt]").forEach((box) => { s[box.dataset.tbOpt] = box.checked; });
    tbSaveRandomSettings(s);
  }
  await rollTeam();
}

// ---- the image to share (1080 × 1920)
function tbWrap(ctx, text, max) {
  const words = String(text).split(" "), lines = [];
  for (const w of words) { const last = lines[lines.length - 1]; if (last && ctx.measureText(last + " " + w).width <= max) lines[lines.length - 1] = last + " " + w; else lines.push(w); }
  return lines;
}
async function tbDrawImage(canvas) {
  const ctx = canvas.getContext("2d"); canvas.width = 1080; canvas.height = 1920;
  try { await Promise.all(["700 86px Fredoka", "700 34px Fredoka", "800 18px Nunito"].map((f) => document.fonts.load(f))); } catch (_e) {}
  ctx.fillStyle = "#FFF8EF"; ctx.fillRect(0, 0, 1080, 1920);
  for (const [x, y, r, c] of [[80, 120, 640, "rgba(217,204,255,.75)"], [1000, 1500, 640, "rgba(255,231,168,.7)"]]) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, "rgba(255,248,239,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); }
  ctx.textAlign = "center"; ctx.fillStyle = "#2E2A33"; ctx.font = "700 86px Fredoka, sans-serif"; ctx.fillText("Mon équipe", 540, 150);
  const who = typeof connectedAccountUser !== "undefined" && connectedAccountUser?.username ? connectedAccountUser.username : "Team Builder";
  ctx.fillStyle = "#6B6472"; ctx.font = "800 32px Nunito, sans-serif"; ctx.fillText(who, 540, 205);
  const team = teamBuilderState.map((slot) => ({ slot, p: getTeamBuilderPokemon(slot) })).filter((e) => e.p).slice(0, 6);
  const jobs = [];
  team.forEach(({ slot, p }, i) => {
    const x = 56 + (i % 2) * 494, y = 250 + Math.floor(i / 2) * 352, w = 472, h = 330;
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, tbTypeColor(p.type1) + "33"); g.addColorStop(1, tbTypeColor(p.type2 || p.type1) + "33");
    ctx.fillStyle = "#fff"; favRoundRect(ctx, x, y, w, h, 30); ctx.fill(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "#EADFD0"; ctx.lineWidth = 2; ctx.stroke();
    jobs.push(favLoadImage(pokedexDetailArtwork(p)).then((img) => img || favLoadImage(getPokemonSprite(p))).then((img) => img && ctx.drawImage(img, x + 14, y + 70, 190, 190)));
    const tx = x + 218, tw = w - 232;
    ctx.textAlign = "left"; ctx.fillStyle = "#2E2A33"; ctx.font = "700 34px Fredoka, sans-serif"; ctx.fillText(p.name, tx, y + 76, tw);
    let bx = tx;
    for (const t of [p.type1, p.type2].filter(Boolean)) {
      ctx.font = "800 16px Nunito, sans-serif"; const bw = ctx.measureText(t).width + 24;
      ctx.fillStyle = tbTypeColor(t); favRoundRect(ctx, bx, y + 94, bw, 30, 15); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(t, bx + 12, y + 115); bx += bw + 8;
    }
    let ly = y + 158;
    if (slot.item && slot.item !== "Aucun") { ctx.fillStyle = "#2E2A33"; ctx.font = "800 18px Nunito, sans-serif"; ctx.fillText("@ " + slot.item, tx, ly, tw); ly += 28; }
    ctx.fillStyle = "#6B6472"; ctx.font = "800 17px Nunito, sans-serif";
    for (const line of tbWrap(ctx, slot.moves.filter(Boolean).join(" · "), tw).slice(0, 4)) { ctx.fillText(line, tx, ly); ly += 25; }
  });
  const cov = tbCoverage();
  let vy = 250 + Math.ceil(Math.max(team.length, 1) / 2) * 352 + 10;
  const verdicts = [];
  if (cov.size >= 2) {
    const weakTypes = cov.weak.slice(0, 3).map((r) => r.type), strongTypes = cov.strong.slice(0, 3).map((r) => r.type);
    verdicts.push(weakTypes.length ? ["#FDECEC", "#8A2A23", "⚠️ Craint surtout " + tbList(weakTypes)] : ["#E6F6EC", "#1F5E3A", "👍 Aucune faiblesse partagée"]);
    if (strongTypes.length) verdicts.push(["#E6F6EC", "#1F5E3A", "✅ Tient bien face à " + tbList(strongTypes)]);
  }
  ctx.textAlign = "left";
  for (const [bg, fg, text] of verdicts) { ctx.fillStyle = bg; favRoundRect(ctx, 56, vy, 968, 70, 22); ctx.fill(); ctx.fillStyle = fg; ctx.font = "700 28px Nunito, sans-serif"; ctx.fillText(text, 84, vy + 45, 920); vy += 84; }
  await Promise.all(jobs);
  ctx.textAlign = "center"; ctx.fillStyle = "#2E2A33"; ctx.font = "700 46px Fredoka, sans-serif"; ctx.fillText("Note mon équipe /10 👇", 540, 1736);
  ctx.textAlign = "right"; ctx.font = "800 34px Nunito, sans-serif"; ctx.fillText("Fais la tienne sur", 548, 1846);
  ctx.fillStyle = "#2b4fb8"; favRoundRect(ctx, 566, 1792, 236, 82, 41); ctx.fill();
  ctx.fillStyle = "#4069E0"; favRoundRect(ctx, 566, 1784, 236, 82, 41); ctx.fill();
  ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "700 44px Fredoka, sans-serif"; ctx.fillText("pokdle.fr", 684, 1840);
  return canvas;
}
async function openTeamShare() {
  if (!teamBuilderState || !teamBuilderState.some((slot) => getTeamBuilderPokemon(slot))) { if (typeof showToast === "function") showToast("Ajoute d’abord un Pokémon"); return; }
  if (typeof ensureOverlay === "function") ensureOverlay("Mon équipe", '<p class="fav-share-wait">Préparation de ton image…</p>');
  const canvas = document.createElement("canvas");
  await tbDrawImage(canvas);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) { if (typeof showToast === "function") showToast("Image impossible à créer"); return; }
  const url = URL.createObjectURL(blob);
  const file = typeof File === "function" ? new File([blob], "pokedle-mon-equipe.png", { type: "image/png" }) : null;
  window.__favShareFile = file;
  const canShare = Boolean(file && navigator.canShare && navigator.canShare({ files: [file] }));
  if (typeof ensureOverlay === "function") ensureOverlay("Mon équipe", `<div class="fav-share"><img src="${url}" alt="L’image de ton équipe"><div class="fav-share-row">
    ${canShare ? '<button type="button" class="btn-blue" data-action="favShareNow">📤 Partager</button>' : ""}
    <a class="${canShare ? "btn-ghost" : "btn-blue"}" href="${url}" download="pokedle-mon-equipe.png">⬇️ Enregistrer l’image</a></div>
    <p class="fav-share-hint">Poste-la : « Note mon équipe /10 ». Chacun aura son avis.</p></div>`);
}

window.addEventListener?.("resize", () => { if (!tbCompactLayout()) closeTeamEditor(); });
// The ⋯ menu closes after a choice, or on a click anywhere else.
document.addEventListener?.("click", (ev) => {
  document.querySelectorAll("#screen-team-builder .tb-more[open]").forEach((menu) => {
    const inside = menu.contains(ev.target);
    if (!inside || ev.target.closest(".tb-more-menu button")) menu.open = false;
  });
});
Object.assign(window, { openTeamSlot, closeTeamEditor, setTeamEditorTab, toggleTeamLock, openTeamRandomizer, rollTeamFromSheet, rollTeam, openTeamShare });
