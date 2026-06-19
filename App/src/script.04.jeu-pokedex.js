// ============================================================
// GAMEPLAY
// ============================================================
function submitGuess() {
  if (gameOver) return;

  document.getElementById("guess-ac").classList.add("hidden");

  const raw = document.getElementById("guess-input").value.trim();
  if (!raw) {
    showErr("Entre un nom de Pokémon !");
    return;
  }

  const found = findPokemon(raw);
  if (!found) {
    showErr(`"${raw}" introuvable dans le pool actif.`);
    return;
  }

  if (guessedSet.has(found.name)) {
    showErr(`Tu as déjà proposé ${found.name} !`);
    return;
  }

  clearErr();
  attempts += 1;
  document.getElementById("try-count").textContent = String(attempts);

  guessedNames.push(found.name);
  guessedSet.add(found.name);

  const cmp = compare(found, secretPokemon);
  resultHistory.push({ pokemon: found, cmp });

  addRow(found, cmp);
  document.getElementById("results-wrap").classList.remove("hidden");
  document.getElementById("guess-input").value = "";
  document.getElementById("guess-input").focus();

  guessCache.clear();
  updateSilhouettePanel(false);
  updatePixelPanel(false);
  saveCurrentGame();

  if (found.name === secretPokemon.name) {
    gameOver = true;
    showWin();
  }
}

function surrenderGame() {
  if (gameOver || !secretPokemon || gameMode === "quiz") return;

  gameOver = true;
  const box = document.getElementById("win-box");
  const winSprite = document.getElementById("win-sprite");
  const winTitle = document.getElementById("win-title");
  const shareBtn = document.getElementById("btn-share");
  const surrenderBtn = document.getElementById("btn-surrender");

  winSprite.onerror = () => {
    winSprite.onerror = null;
    winSprite.src = getSpriteUrl(getPokemonSpriteId(secretPokemon));
  };
  winSprite.src = getPokemonSprite(secretPokemon);

  if (winTitle) winTitle.textContent = "Abandon";
  document.getElementById("win-text").textContent = `Tu as abandonné. Le Pokémon était ${secretPokemon.name}.`;

  if (shareBtn) shareBtn.classList.add("hidden");
  if (surrenderBtn) surrenderBtn.classList.add("hidden");
  document.getElementById("share-ok").classList.add("hidden");

  box.classList.remove("hidden");
  box.classList.remove("win-animate");
  void box.offsetWidth;
  box.classList.add("win-animate");

  updateSilhouettePanel(true);
  updatePixelPanel(true);
  updateMysteryPanel(true);
  updateCryPanel(true);
  stopCrySound();
  recordMatchHistory({ mode: gameMode, result: "loss", attempts, targetName: secretPokemon.name });
  clearSavedGame();
  finishPartyRound(false);

  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function compare(guess, secret) {
  const type1State =
    guess.type1 === secret.type1
      ? "ok"
      : guess.type1 && guess.type1 === secret.type2
      ? "close"
      : "wrong";

  const type2State =
    guess.type2 === secret.type2
      ? "ok"
      : guess.type2 && guess.type2 === secret.type1
      ? "close"
      : "wrong";

  return {
    generation: guess.gen === secret.gen ? "ok" : "wrong",
    altForm: Boolean(guess.isAltForm) === Boolean(secret.isAltForm) ? "ok" : "wrong",
    type1: type1State,
    type2: type2State,
    habitat: guess.habitat === secret.habitat ? "ok" : "wrong",
    color: compareColors(guess.color, secret.color),
    stage: guess.stage === secret.stage ? "ok" : "wrong",
    height: cmpNum(guess.height, secret.height, 0.3),
    weight: cmpNum(guess.weight, secret.weight, 15),
  };
}

function cmpNum(gVal, sVal, tolerance) {
  if (gVal === sVal) return "ok";
  if (Math.abs(gVal - sVal) <= tolerance) return "close";
  return "wrong";
}

function buildComparisonRowHtml(pokemon, cmp, targetPokemon) {
  const hArrow = arrowFor(pokemon.height, targetPokemon.height);
  const wArrow = arrowFor(pokemon.weight, targetPokemon.weight);
  const fallbackSprite = getSpriteUrl(getPokemonSpriteId(pokemon));

  // data-label : utilisés par le rendu "cartes empilées" sur mobile (≤640px).
  return `
    <td data-label="Pokémon">
      <div class="poke-cell">
        <img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" data-fallback="${fallbackSprite}" />
        ${escapeHtml(pokemon.name)}
      </div>
    </td>
    <td data-label="Génération" class="${cls(cmp.generation)}">Gen ${pokemon.gen}</td>
    <td data-label="Forme" class="${cls(cmp.altForm)}">${pokemon.isAltForm ? "Oui" : "Non"}</td>
    <td data-label="Type 1" class="${cls(cmp.type1)}">${pokemon.type1}</td>
    <td data-label="Type 2" class="${cls(cmp.type2)}">${pokemon.type2 || "Aucun"}</td>
    <td data-label="Habitat / lieux" class="${cls(cmp.habitat)}">
      <span class="habitat-main">${escapeHtml(pokemon.habitat || "Inconnu")}</span>
      <small class="habitat-encounter" data-encounter-summary>Chargement des lieux...</small>
    </td>
    <td data-label="Couleur" class="${cls(cmp.color)}">${formatColorLabel(pokemon.color)}</td>
    <td data-label="Stade" class="${cls(cmp.stage)}">${pokemon.stage}</td>
    <td data-label="Hauteur" class="${cls(cmp.height)}">
      <div class="cell-num">
        ${pokemon.height}m
        ${cmp.height !== "ok" ? `<span class="${hArrow === "↑" ? "arrow-up" : "arrow-down"}">${hArrow}</span>` : ""}
      </div>
    </td>
    <td data-label="Poids" class="${cls(cmp.weight)}">
      <div class="cell-num">
        ${pokemon.weight}kg
        ${cmp.weight !== "ok" ? `<span class="${wArrow === "↑" ? "arrow-up" : "arrow-down"}">${wArrow}</span>` : ""}
      </div>
    </td>
  `;
}

function addRow(pokemon, cmp) {
  const tbody = document.getElementById("results-body");
  const tr = document.createElement("tr");
  tr.innerHTML = buildComparisonRowHtml(pokemon, cmp, secretPokemon);
  tbody.insertBefore(tr, tbody.firstChild);
  hydrateComparisonRowEncounter(tr, pokemon);
}

function cls(result) {
  if (result === "ok") return "c-ok";
  if (result === "close") return "c-close";
  return "c-wrong";
}

function arrowFor(guessVal, secretVal) {
  if (guessVal === secretVal) return "";
  return guessVal < secretVal ? "↑" : "↓";
}

function triggerWinCelebration(box) {
  if (!box) return;

  document.body.classList.remove("win-page-celebrate");
  void document.body.offsetWidth;
  document.body.classList.add("win-page-celebrate");

  const oldFlash = document.querySelector(".win-page-flash");
  if (oldFlash) oldFlash.remove();
  const flash = document.createElement("div");
  flash.className = "win-page-flash";
  document.body.appendChild(flash);

  const oldConfetti = document.querySelector(".win-confetti-layer");
  if (oldConfetti) oldConfetti.remove();
  const confettiLayer = document.createElement("div");
  confettiLayer.className = "win-confetti-layer";
  for (let i = 0; i < 56; i += 1) {
    const c = document.createElement("span");
    c.className = "win-confetti";
    c.style.left = `${Math.random() * 100}%`;
    c.style.animationDelay = `${Math.random() * 0.35}s`;
    c.style.animationDuration = `${1.4 + Math.random() * 1.1}s`;
    c.style.transform = `translateY(-10px) rotate(${Math.floor(Math.random() * 360)}deg)`;
    c.style.background = ["#ffd45f", "#ff7a59", "#5db4ff", "#7ce98d", "#c49cff"][Math.floor(Math.random() * 5)];
    confettiLayer.appendChild(c);
  }
  document.body.appendChild(confettiLayer);

  box.classList.remove("win-celebrate");
  void box.offsetWidth;
  box.classList.add("win-celebrate");

  const oldBurst = box.querySelector(".win-burst");
  if (oldBurst) oldBurst.remove();

  const burst = document.createElement("div");
  burst.className = "win-burst";

  for (let i = 0; i < 36; i += 1) {
    const star = document.createElement("span");
    star.className = "burst-star";
    const angle = (i / 36) * 360;
    const dist = 52 + Math.floor(Math.random() * 58);
    star.style.setProperty("--a", `${angle}deg`);
    star.style.setProperty("--d", `${dist}px`);
    star.style.animationDelay = `${(i % 9) * 0.025}s`;
    burst.appendChild(star);
  }

  box.appendChild(burst);
  setTimeout(() => {
    burst.remove();
    box.classList.remove("win-celebrate");
    flash.remove();
    confettiLayer.remove();
    document.body.classList.remove("win-page-celebrate");
  }, 1700);
}

function showWin() {
  const box = document.getElementById("win-box");
  const winSprite = document.getElementById("win-sprite");
  const winTitle = document.getElementById("win-title");
  const shareBtn = document.getElementById("btn-share");
  const surrenderBtn = document.getElementById("btn-surrender");

  winSprite.onerror = () => {
    winSprite.onerror = null;
    winSprite.src = getSpriteUrl(getPokemonSpriteId(secretPokemon));
  };
  winSprite.src = getPokemonSprite(secretPokemon);

  if (winTitle) winTitle.textContent = "BRAVO !";
  if (shareBtn) shareBtn.classList.remove("hidden");
  if (surrenderBtn) surrenderBtn.classList.add("hidden");

  document.getElementById("win-text").textContent =
    `C'était ${secretPokemon.name} • trouvé en ${attempts} essai${attempts > 1 ? "s" : ""} !`;

  // Distribution du jour : envoie le résultat puis affiche les barres d'essais.
  if (gameMode === "daily") reportAndRenderDailyDistribution(attempts);
  else document.getElementById("win-daily-distribution")?.classList.add("hidden");

  // DA 2026 : rendez-vous quotidien — série + prochain Pokémon dans l'écran de fin.
  const winNext = document.getElementById("win-next-daily");
  if (winNext) {
    if (gameMode === "daily") {
      const now = new Date();
      const nextUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const ms = Math.max(0, nextUtc - now.getTime());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const streak = Number(playerStats?.dailyCurrentStreak) || 0;
      winNext.textContent = `${streak > 1 ? `🔥 Série : ${streak} jours · ` : ""}⏳ Prochain Pokémon dans ${h} h ${String(m).padStart(2, "0")} min`;
      winNext.classList.remove("hidden");
    } else {
      winNext.classList.add("hidden");
    }
  }
  if (typeof renderDailyHero === "function") renderDailyHero();

  box.classList.remove("hidden");
  document.getElementById("share-ok").classList.add("hidden");

  // restart animation cleanly
  box.classList.remove("win-animate");
  void box.offsetWidth;
  box.classList.add("win-animate");
  triggerWinCelebration(box);

  updateSilhouettePanel(true);
  updatePixelPanel(true);
  updateMysteryPanel(true);
  updateCryPanel(true);
  registerWin();
  recordMatchHistory({ mode: gameMode, result: "win", attempts, targetName: secretPokemon?.name || null });
  clearSavedGame();
  finishPartyRound(true);

  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function shareResult() {
  if (!secretPokemon) return;

  const emojiMap = { ok: "🟩", close: "🟨", wrong: "⬜" };

  let header = "Pokédle";
  if (gameMode === "daily") header += " • Pokémon du jour";
  if (gameMode === "challenge") header += " • Défi ami";
  if (gameMode === "pixel") header += " • Mode pixelisé";
  if (gameMode === "mystery") header += " • Stat Mystère";
  if (gameMode === "cry") header += " • Cri du Pokémon";

  let text = `${header}\n${attempts} essai${attempts > 1 ? "s" : ""}\n\n`;

  // DA 2026 : pas de noms de Pokémon dans le partage (façon Wordle, zéro spoil).
  resultHistory.forEach(({ cmp }) => {
    const line = [cmp.generation, cmp.altForm, cmp.type1, cmp.type2, cmp.habitat, cmp.color, cmp.stage, cmp.height, cmp.weight]
      .map((r) => emojiMap[r])
      .join("");
    text += `${line}\n`;
  });

  if (gameMode === "daily") {
    const streak = Number(playerStats?.dailyCurrentStreak) || 0;
    if (streak > 1) text += `\n🔥 Série : ${streak} jours`;
  }
  text += "\nJoue ici : " + window.location.origin;

  const confirmCopied = () => {
    document.getElementById("share-ok").classList.remove("hidden");
    setTimeout(() => document.getElementById("share-ok").classList.add("hidden"), 3000);
  };
  const copyToClipboard = () => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(confirmCopied).catch(() => {});
  };

  // Mobile : feuille de partage native ; sinon copie dans le presse-papier.
  if (navigator.share) {
    navigator.share({ text }).catch((err) => {
      if (err?.name !== "AbortError") copyToClipboard();
    });
  } else {
    copyToClipboard();
  }
}

function copyResult() {
  shareResult();
}

// ============================================================
// ============================================================
// RANKING MODE
// ============================================================
const STARTER_IDS = new Set([
  1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393,
  495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816,
  906, 909, 912,
]);

const LEGENDARY_IDS = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  716, 717, 718, 719, 720, 721,
  785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 803, 804, 805, 806, 807,
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,
  1001, 1002, 1003, 1004, 1007, 1008, 1024, 1025,
]);


// Lot B audit : WebP (-95 % de poids vs PNG), support universel des navigateurs modernes.
const RANKING_TYPEBAR_URL = "/typebar.webp"; // chemin absolu : depuis une var CSS, un chemin relatif se résout contre /dist/
const RANKING_GENBAR_URL = "/genbar.webp";
const TYPEBAR_COL_COUNT = 22; // Normal..Favorite
const GENBAR_ROW_COUNT = 10; // Pick your favorites + Gen I..IX
const RANKING_SPECIAL_FORM_NAMES = new Set([
  "Giratina Forme Originelle",
  "Shaymin Forme Céleste",
  "Fulguris Forme Totémique",
  "Boréas Forme Totémique",
  "Démétéros Forme Totémique",
  "Fort-Ivoire",
  "Hurle-Queue",
  "Fongus-Furie",
  "Flotte-Mèche",
  "Rampe-Ailes",
  "Pelage-Sablé",
  "Roue-de-Fer",
  "Hotte-de-Fer",
  "Paume-de-Fer",
  "Têtes-de-Fer",
  "Mite-de-Fer",
  "Épine-de-Fer",
  "Rugit-Lune",
  "Garde-de-Fer",
  "Koraidon",
  "Miraidon",
  "Serpente-Eau",
  "Vert-de-Fer",
]);

const SPECIAL_COLUMN_HEADER_INDEX = {
  starter: 18,
  gimmick: 19,
  legend: 20,
  favorite: 21,
};

function isRankingSpecialForm(pokemon) {
  return Boolean(pokemon?.isAltForm) || RANKING_SPECIAL_FORM_NAMES.has(pokemon?.name);
}

function buildRankingColumns() {
  const cols = RANKING_TYPES.map((type, index) => ({
    key: "type|" + type,
    label: type,
    headerIndex: index,
    matcher: (p) => p.type1 === type || p.type2 === type,
  }));

  cols.push(
    { key: "starter", label: "Starter", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.starter, matcher: (p) => STARTER_IDS.has(p.id) },
    { key: "gimmick", label: "Forme", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.gimmick, matcher: (p) => isRankingSpecialForm(p) },
    { key: "legend", label: "Légendes", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.legend, matcher: (p) => LEGENDARY_IDS.has(p.id) }
  );

  return cols;
}

const RANKING_COLUMNS = buildRankingColumns();

function fillTypeHeaderCell(th, label, index) {
  const wrap = document.createElement("div");
  wrap.className = "rank-type-sheet";
  wrap.style.setProperty("--sheet-index", String(index));
  wrap.style.setProperty("--sheet-count", String(TYPEBAR_COL_COUNT - 1));
  wrap.style.setProperty("--sheet-url", `url("${RANKING_TYPEBAR_URL}")`);
  wrap.title = label;
  wrap.setAttribute("aria-label", label);
  th.innerHTML = "";
  th.appendChild(wrap);
}

function fillGenHeaderCell(th, gen) {
  const wrap = document.createElement("div");
  wrap.className = "rank-gen-sheet";
  wrap.style.setProperty("--sheet-index", String(gen - 1));
  wrap.style.setProperty("--sheet-count", String(GENBAR_ROW_COUNT - 1));
  wrap.style.setProperty("--sheet-url", `url("${RANKING_GENBAR_URL}")`);
  wrap.title = "Gen " + gen;
  wrap.setAttribute("aria-label", "Gen " + gen);
  th.innerHTML = "";
  th.appendChild(wrap);
}

function fillFavoriteRowCell(th) {
  const wrap = document.createElement("div");
  wrap.className = "rank-gen-sheet";
  wrap.style.setProperty("--sheet-index", String(GENBAR_ROW_COUNT - 1));
  wrap.style.setProperty("--sheet-count", String(GENBAR_ROW_COUNT - 1));
  wrap.style.setProperty("--sheet-url", `url("${RANKING_GENBAR_URL}")`);
  wrap.title = "Favorite";
  wrap.setAttribute("aria-label", "Favorite");
  th.innerHTML = "";
  th.appendChild(wrap);
}

function fillCornerHeaderCell(th) {
  const wrap = document.createElement("div");
  wrap.className = "rank-corner-label";
  wrap.textContent = "Gen";
  wrap.title = "Génération";
  wrap.setAttribute("aria-label", "Génération");
  th.innerHTML = "";
  th.appendChild(wrap);
}
function rankingCellKey(gen, colKey) {
  return String(gen) + "|" + colKey;
}

function rankingFavoriteKey(gen) {
  return "fav|" + String(gen);
}

function rankingFavoriteRowKey(colKey) {
  return "favrow|" + String(colKey);
}

function loadRankingChoices() {
  const parsed = readJson(STORAGE_KEYS.ranking, {});
  rankingChoices = parsed && typeof parsed === "object" ? parsed : {};
}

function saveRankingChoices() {
  writeJson(STORAGE_KEYS.ranking, rankingChoices);
}

function openRankingMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  stopEmulatorSession();
  showScreen("screen-ranking");
  setGlobalNavActive("rank");
  closeRankingPicker();
  renderRankingGrid();
}

function getRankingChoicePokemon(gen, colKey) {
  const id = Number(rankingChoices[rankingCellKey(gen, colKey)]);
  return Number.isInteger(id) ? POKEMON_BY_ID.get(id) || null : null;
}

function getRowCandidates(gen) {
  const out = [];
  const seen = new Set();
  for (const col of RANKING_COLUMNS) {
    const p = getRankingChoicePokemon(gen, col.key);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function getColumnCandidates(colKey) {
  const out = [];
  const seen = new Set();
  for (let gen = 1; gen <= 9; gen += 1) {
    const p = getRankingChoicePokemon(gen, colKey);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function getFavoriteRowCandidates(colKey) {
  if (colKey === "favorite") {
    const seen = new Set();
    const merged = [];
    for (let gen = 1; gen <= 9; gen += 1) {
      const rowFav = getRowFavoritePokemon(gen);
      if (rowFav && !seen.has(rowFav.id)) {
        seen.add(rowFav.id);
        merged.push(rowFav);
      }
    }
    for (const col of RANKING_COLUMNS) {
      const colFav = getFavoriteRowPokemon(col.key);
      if (colFav && !seen.has(colFav.id)) {
        seen.add(colFav.id);
        merged.push(colFav);
      }
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
  return getColumnCandidates(colKey).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function getRowFavoritePokemon(gen) {
  const id = Number(rankingChoices[rankingFavoriteKey(gen)]);
  return Number.isInteger(id) ? POKEMON_BY_ID.get(id) || null : null;
}

function getFavoriteRowPokemon(colKey) {
  const id = Number(rankingChoices[rankingFavoriteRowKey(colKey)]);
  return Number.isInteger(id) ? POKEMON_BY_ID.get(id) || null : null;
}

function renderRankingGrid() {
  const wrap = document.getElementById("ranking-grid");
  if (!wrap) return;

  wrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "ranking-table";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  const corner = document.createElement("th");
  corner.className = "rank-corner";
  fillCornerHeaderCell(corner);
  hr.appendChild(corner);

  for (const col of RANKING_COLUMNS) {
    const th = document.createElement("th");
    th.className = "rank-type-head";
    fillTypeHeaderCell(th, col.label, col.headerIndex);
    hr.appendChild(th);
  }

  const favHead = document.createElement("th");
  favHead.className = "rank-type-head rank-fav-head";
  fillTypeHeaderCell(favHead, "Préféré", SPECIAL_COLUMN_HEADER_INDEX.favorite);
  hr.appendChild(favHead);

  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let gen = 1; gen <= 9; gen += 1) {
    const tr = document.createElement("tr");

    const gth = document.createElement("th");
    gth.className = "rank-gen-head";
    fillGenHeaderCell(gth, gen);
    tr.appendChild(gth);

    for (const col of RANKING_COLUMNS) {
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rank-slot";

      const pokemon = getRankingChoicePokemon(gen, col.key);
      if (pokemon) {
        btn.classList.add("filled");
        const img = document.createElement("img");
        img.src = getPokemonSprite(pokemon);
        img.alt = pokemon.name;
        img.loading = "lazy";
        const label = document.createElement("span");
        label.textContent = pokemon.name;
        btn.appendChild(img);
        btn.appendChild(label);
      } else {
        const empty = document.createElement("span");
        empty.className = "rank-slot-empty";
        empty.textContent = "+";
        btn.appendChild(empty);
      }

      btn.addEventListener("click", () => openRankingPickerForCell(gen, col.key, btn));
      td.appendChild(btn);
      tr.appendChild(td);
    }

    const favTd = document.createElement("td");
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "rank-slot rank-favorite-slot";

    const favPokemon = getRowFavoritePokemon(gen);
    if (favPokemon) {
      favBtn.classList.add("filled");
      const img = document.createElement("img");
      img.src = getPokemonSprite(favPokemon);
      img.alt = favPokemon.name;
      img.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = favPokemon.name;
      favBtn.appendChild(img);
      favBtn.appendChild(label);
    } else {
      const empty = document.createElement("span");
      empty.className = "rank-slot-empty";
      empty.textContent = "?";
      favBtn.appendChild(empty);
    }

    favBtn.addEventListener("click", () => openRankingPickerForRowFavorite(gen, favBtn));
    favTd.appendChild(favBtn);
    tr.appendChild(favTd);

    tbody.appendChild(tr);
  }

  const favRow = document.createElement("tr");

  const favRowHead = document.createElement("th");
  favRowHead.className = "rank-gen-head rank-favorite-row-head";
  fillFavoriteRowCell(favRowHead);
  favRow.appendChild(favRowHead);

  for (const col of RANKING_COLUMNS) {
    const td = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rank-slot rank-favorite-slot";

    const pokemon = getFavoriteRowPokemon(col.key);
    if (pokemon) {
      btn.classList.add("filled");
      const img = document.createElement("img");
      img.src = getPokemonSprite(pokemon);
      img.alt = pokemon.name;
      img.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = pokemon.name;
      btn.appendChild(img);
      btn.appendChild(label);
    } else {
      const empty = document.createElement("span");
      empty.className = "rank-slot-empty";
      empty.textContent = "+";
      btn.appendChild(empty);
    }

    btn.addEventListener("click", () => openRankingPickerForFavoriteRow(col.key, btn));
    td.appendChild(btn);
    favRow.appendChild(td);
  }

  const favTd = document.createElement("td");
  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "rank-slot rank-favorite-slot";

  const favPokemon = getFavoriteRowPokemon("favorite");
  if (favPokemon) {
    favBtn.classList.add("filled");
    const img = document.createElement("img");
    img.src = getPokemonSprite(favPokemon);
    img.alt = favPokemon.name;
    img.loading = "lazy";
    const label = document.createElement("span");
    label.textContent = favPokemon.name;
    favBtn.appendChild(img);
    favBtn.appendChild(label);
  } else {
    const empty = document.createElement("span");
    empty.className = "rank-slot-empty";
    empty.textContent = "?";
    favBtn.appendChild(empty);
  }

  favBtn.addEventListener("click", () => openRankingPickerForFavoriteRow("favorite", favBtn));
  favTd.appendChild(favBtn);
  favRow.appendChild(favTd);

  tbody.appendChild(favRow);

  table.appendChild(tbody);
  wrap.appendChild(table);
  renderPickedSummary();
}

function openRankingPickerForCell(gen, colKey, anchorEl) {
  const col = RANKING_COLUMNS.find((c) => c.key === colKey);
  if (!col) return;

  rankingSelected = { mode: "cell", gen, colKey, key: rankingCellKey(gen, colKey), anchorEl };

  rankingCandidates = POKEMON_LIST
    .filter((p) => p.gen === gen && col.matcher(p))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  showRankingFloatPicker("Gen " + gen + " • " + col.label, String(rankingCandidates.length) + " Pokémon possibles", rankingCandidates, anchorEl);
}

function openRankingPickerForRowFavorite(gen, anchorEl) {
  rankingSelected = { mode: "rowFav", gen, key: rankingFavoriteKey(gen), anchorEl };
  rankingCandidates = getRowCandidates(gen);

  const sub = rankingCandidates.length
    ? "Choisis parmi les Pokémon déjà placés sur cette ligne"
    : "Aucun Pokémon sélectionné sur cette ligne";

  showRankingFloatPicker("Gen " + gen + " • Préféré", sub, rankingCandidates, anchorEl);
}

function openRankingPickerForFavoriteRow(colKey, anchorEl) {
  rankingSelected = { mode: "favRow", colKey, key: rankingFavoriteRowKey(colKey), anchorEl };
  rankingCandidates = getFavoriteRowCandidates(colKey);

  const col = colKey === "favorite"
    ? "Favori global"
    : (RANKING_COLUMNS.find((c) => c.key === colKey)?.label || "Type");
  const subtitle = colKey === "favorite"
    ? "Tous les Pokémon déjà retenus en ligne et en colonne"
    : "Choisis le meilleur Pokémon déjà retenu dans cette colonne";

  showRankingFloatPicker("Favorite • " + col, subtitle, rankingCandidates, anchorEl);
}

function showRankingFloatPicker(title, subtitle, candidates, anchorEl) {
  const picker = document.getElementById("rank-float-picker");
  const titleEl = document.getElementById("rank-picker-title");
  const subEl = document.getElementById("rank-picker-sub");
  const list = document.getElementById("rank-float-list");

  titleEl.textContent = title;
  subEl.textContent = subtitle;
  list.innerHTML = "";

  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "rank-empty-list";
    empty.textContent = "Aucun Pokémon disponible.";
    list.appendChild(empty);
  } else {
    for (const p of candidates) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "rank-float-item";
      item.title = p.name;

      const img = document.createElement("img");
      img.src = getPokemonSprite(p);
      img.alt = p.name;
      img.loading = "lazy";

      const label = document.createElement("span");
      label.textContent = p.name;

      item.appendChild(img);
      item.appendChild(label);
      item.addEventListener("click", () => selectRankingPokemon(p.id));
      list.appendChild(item);
    }
  }

  picker.classList.remove("hidden");

  const anchor = anchorEl ? anchorEl.getBoundingClientRect() : null;
  const pickerRect = picker.getBoundingClientRect();
  const host = picker.closest("#screen-ranking > .card") || picker.parentElement;
  const hostRect = host ? host.getBoundingClientRect() : null;
  const margin = 12;

  let left = 20;
  let top = 20;

  if (anchor && hostRect) {
    const spaceBelow = hostRect.bottom - anchor.bottom - margin;
    const spaceAbove = anchor.top - hostRect.top - margin;
    const spaceRight = hostRect.right - anchor.right - margin;
    const spaceLeft = anchor.left - hostRect.left - margin;

    if (spaceBelow >= pickerRect.height + 8 || spaceBelow >= spaceAbove) {
      top = anchor.bottom - hostRect.top + 8;
    } else {
      top = anchor.top - hostRect.top - pickerRect.height - 8;
    }

    if (spaceRight >= pickerRect.width) {
      left = anchor.left - hostRect.left;
    } else if (spaceLeft >= pickerRect.width) {
      left = anchor.right - hostRect.left - pickerRect.width;
    } else {
      left = anchor.left - hostRect.left + (anchor.width / 2) - (pickerRect.width / 2);
    }

    const maxLeft = hostRect.width - pickerRect.width - margin;
    const maxTop = hostRect.height - pickerRect.height - margin;
    left = Math.max(margin, Math.min(left, Math.max(margin, maxLeft)));
    top = Math.max(margin, Math.min(top, Math.max(margin, maxTop)));
  }

  picker.style.left = Math.round(left) + "px";
  picker.style.top = Math.round(top) + "px";
  picker.style.right = "auto";
  picker.style.bottom = "auto";
}

function closeRankingPicker() {
  rankingSelected = null;
  rankingCandidates = [];
  const picker = document.getElementById("rank-float-picker");
  const list = document.getElementById("rank-float-list");
  if (list) list.innerHTML = "";
  if (picker) picker.classList.add("hidden");
}

function selectRankingPokemon(pokemonId) {
  if (!rankingSelected) return;

  rankingChoices[rankingSelected.key] = pokemonId;
  saveRankingChoices();
  renderRankingGrid();
  closeRankingPicker();
}

function clearRankingSelection() {
  if (!rankingSelected) return;

  delete rankingChoices[rankingSelected.key];
  saveRankingChoices();
  renderRankingGrid();
  closeRankingPicker();
}

function resetRankingChoices() {
  rankingChoices = {};
  saveRankingChoices();
  renderRankingGrid();
  closeRankingPicker();
}

function renderPickedSummary() {
  const wrap = document.getElementById("ranking-picked-grid");
  if (!wrap) return;

  wrap.innerHTML = "";

  const seen = new Set();
  const picked = [];

  for (const value of Object.values(rankingChoices)) {
    const id = Number(value);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    const p = POKEMON_BY_ID.get(id);
    if (!p) continue;
    seen.add(id);
    picked.push(p);
  }

  picked.sort((a, b) => a.gen - b.gen || a.name.localeCompare(b.name, "fr"));

  if (!picked.length) {
    const empty = document.createElement("div");
    empty.className = "rank-empty-list";
    empty.textContent = "Aucun Pokémon sélectionné pour le moment.";
    wrap.appendChild(empty);
    return;
  }

  for (const p of picked) {
    const card = document.createElement("div");
    card.className = "picked-card";

    const img = document.createElement("img");
    img.src = getPokemonSprite(p);
    img.alt = p.name;
    img.loading = "lazy";

    const name = document.createElement("span");
    name.textContent = p.name + " (Gen " + p.gen + ")";

    card.appendChild(img);
    card.appendChild(name);
    wrap.appendChild(card);
  }
}

window.addEventListener("click", (e) => {
  const picker = document.getElementById("rank-float-picker");
  if (!picker || picker.classList.contains("hidden")) return;
  if (e.target.closest("#rank-float-picker") || e.target.closest(".rank-slot")) return;
  closeRankingPicker();
});

const TYPE_ICON_FILE_BY_FR = {
  Normal: "Normal",
  Feu: "Fire",
  Eau: "Water",
  Plante: "Grass",
  "Électrik": "Electric",
  Glace: "Ice",
  Combat: "Fighting",
  Poison: "Poison",
  Sol: "Ground",
  Vol: "Flying",
  Psy: "Psychic",
  Insecte: "Bug",
  Roche: "Rock",
  Spectre: "Ghost",
  Dragon: "Dragon",
  "Ténèbres": "Dark",
  Acier: "Steel",
  "Fée": "Fairy",
};

const TYPE_EFFECTIVENESS = {
  Normal: { super: [], not: ["Roche", "Acier"], no: ["Spectre"] },
  Feu: { super: ["Plante", "Glace", "Insecte", "Acier"], not: ["Feu", "Eau", "Roche", "Dragon"], no: [] },
  Eau: { super: ["Feu", "Sol", "Roche"], not: ["Eau", "Plante", "Dragon"], no: [] },
  Plante: { super: ["Eau", "Sol", "Roche"], not: ["Feu", "Plante", "Poison", "Vol", "Insecte", "Dragon", "Acier"], no: [] },
  "Électrik": { super: ["Eau", "Vol"], not: ["Plante", "Électrik", "Dragon"], no: ["Sol"] },
  Glace: { super: ["Plante", "Sol", "Vol", "Dragon"], not: ["Feu", "Eau", "Glace", "Acier"], no: [] },
  Combat: { super: ["Normal", "Glace", "Roche", "Ténèbres", "Acier"], not: ["Poison", "Vol", "Psy", "Insecte", "Fée"], no: ["Spectre"] },
  Poison: { super: ["Plante", "Fée"], not: ["Poison", "Sol", "Roche", "Spectre"], no: ["Acier"] },
  Sol: { super: ["Feu", "Électrik", "Poison", "Roche", "Acier"], not: ["Plante", "Insecte"], no: ["Vol"] },
  Vol: { super: ["Plante", "Combat", "Insecte"], not: ["Électrik", "Roche", "Acier"], no: [] },
  Psy: { super: ["Combat", "Poison"], not: ["Psy", "Acier"], no: ["Ténèbres"] },
  Insecte: { super: ["Plante", "Psy", "Ténèbres"], not: ["Feu", "Combat", "Poison", "Vol", "Spectre", "Acier", "Fée"], no: [] },
  Roche: { super: ["Feu", "Glace", "Vol", "Insecte"], not: ["Combat", "Sol", "Acier"], no: [] },
  Spectre: { super: ["Psy", "Spectre"], not: ["Ténèbres"], no: ["Normal"] },
  Dragon: { super: ["Dragon"], not: ["Acier"], no: ["Fée"] },
  "Ténèbres": { super: ["Psy", "Spectre"], not: ["Combat", "Ténèbres", "Fée"], no: [] },
  Acier: { super: ["Glace", "Roche", "Fée"], not: ["Feu", "Eau", "Électrik", "Acier"], no: [] },
  "Fée": { super: ["Combat", "Dragon", "Ténèbres"], not: ["Feu", "Poison", "Acier"], no: [] },
};

const PROFESSIONAL_MODE_CONFIG = {
  startNormalGame: { label: "Solo classique", description: "Le mode principal pour deviner le Pokémon mystère.", category: "classic" },
  startDailyGame: { label: "Pokémon du jour", description: "Une partie quotidienne avec un Pokémon fixe selon la date.", category: "classic" },
  startSilhouetteGame: { label: "Zoom progressif", description: "Découvre progressivement le sprite en zoomant sur l'image.", category: "classic" },
  startPixelGame: { label: "Mode pixelisé", description: "Le sprite se révèle au fil des essais.", category: "classic" },
  startQuizGame: { label: "Quiz Pokémon", description: "Réponds à une série de questions sur l'univers Pokémon.", category: "challenge" },
  startMysteryStatGame: { label: "Stat Mystère", description: "Retrouve le Pokémon grâce à ses statistiques.", category: "challenge" },
  startWeightBattle: { label: "Duel de poids", description: "Choisis le Pokémon le plus lourd entre deux propositions.", category: "challenge" },
  startEvolutionChainGame: { label: "Chaîne d'évolution", description: "Complète la lignée d'évolution manquante.", category: "challenge" },
  startPokedexOrderGame: { label: "Ordre Pokédex", description: "Trouve le Pokémon placé entre deux numéros.", category: "challenge" },
  openStatClashMode: { label: "Stat Clash 1v1", description: "Draft de stats en 3 manches sur de vraies base stats Pokémon.", category: "challenge" },
  startPartyMode: { label: "Party Pokémon", description: "Enchaîne plusieurs mini-jeux dans une même session.", category: "challenge" },
  openPokedexMode: { label: "Pokédex", description: "Consulte les fiches détaillées des Pokémon disponibles.", category: "collection" },
  openTypeChartScreen: { label: "Table des types", description: "Affiche les tableaux d'efficacité des types selon les générations.", category: "collection" },
  openProfileScreen: { label: "Profil joueur", description: "Retrouve ton profil local et ta progression.", category: "collection" },
  openAchievementsScreen: { label: "Succès", description: "Consulte les objectifs débloqués et à venir.", category: "collection" },
  openRankingMode: { label: "Mode classement", description: "Organise les Pokémon dans des tableaux thématiques.", category: "collection" },
  openDraftArenaMode: { label: "Draft Arènes", description: "Compose une équipe et affronte une série d'arènes.", category: "tools" },
  openDraftScoreAttackMode: { label: "Draft Score Attack", description: "Drafte la meilleure moyenne BST en solo ou en 1v1.", category: "challenge" },
  openEmulatorMode: { label: "Émulateur", description: "Lance un jeu Pokémon directement depuis l'interface.", category: "tools" },
};

const TYPE_CHART_CONFIG = {
  gen1: {
    label: "Gen 1",
    description: "Table spécifique à la première génération, avant l'ajout des types Acier, Ténèbres et Fée.",
    types: ["Combat", "Dragon", "Eau", "Électrik", "Feu", "Glace", "Insecte", "Normal", "Plante", "Poison", "Psy", "Roche", "Sol", "Spectre", "Vol"],
  },
  "gen2-5": {
    label: "Gen 2-5",
    description: "Ajout des types Acier et Ténèbres. Le type Fée n'existe pas encore dans cette période.",
    types: ["Acier", "Combat", "Dragon", "Eau", "Électrik", "Feu", "Glace", "Insecte", "Normal", "Plante", "Poison", "Psy", "Roche", "Sol", "Spectre", "Ténèbres", "Vol"],
  },
  "gen6+": {
    label: "Gen 6+",
    description: "Table moderne avec le type Fée et les interactions actuelles.",
    types: ["Acier", "Combat", "Dragon", "Eau", "Électrik", "Fée", "Feu", "Glace", "Insecte", "Normal", "Plante", "Poison", "Psy", "Roche", "Sol", "Spectre", "Ténèbres", "Vol"],
  },
};

const TYPE_EFFECTIVENESS_GEN1 = {
  Normal: { super: [], not: ["Roche"], no: ["Spectre"] },
  Feu: { super: ["Plante", "Glace", "Insecte"], not: ["Feu", "Eau", "Roche", "Dragon"], no: [] },
  Eau: { super: ["Feu", "Sol", "Roche"], not: ["Eau", "Plante", "Dragon"], no: [] },
  Plante: { super: ["Eau", "Sol", "Roche"], not: ["Feu", "Plante", "Poison", "Vol", "Insecte", "Dragon"], no: [] },
  "Électrik": { super: ["Eau", "Vol"], not: ["Plante", "Électrik", "Dragon"], no: ["Sol"] },
  Glace: { super: ["Plante", "Sol", "Vol", "Dragon"], not: ["Eau"], no: [] },
  Combat: { super: ["Normal", "Glace", "Roche"], not: ["Poison", "Vol", "Psy", "Insecte"], no: ["Spectre"] },
  Poison: { super: ["Plante", "Insecte"], not: ["Poison", "Sol", "Roche", "Spectre"], no: [] },
  Sol: { super: ["Feu", "Électrik", "Poison", "Roche"], not: ["Plante", "Insecte"], no: ["Vol"] },
  Vol: { super: ["Plante", "Combat", "Insecte"], not: ["Électrik", "Roche"], no: [] },
  Psy: { super: ["Combat", "Poison"], not: ["Psy"], no: [] },
  Insecte: { super: ["Plante", "Psy", "Poison"], not: ["Feu", "Combat", "Vol", "Spectre"], no: [] },
  Roche: { super: ["Feu", "Glace", "Vol", "Insecte"], not: ["Combat", "Sol"], no: [] },
  Spectre: { super: ["Spectre"], not: [], no: ["Normal", "Psy"] },
  Dragon: { super: ["Dragon"], not: [], no: [] },
};

function cloneTypeChart(chart) {
  const out = {};
  Object.entries(chart).forEach(([type, data]) => {
    out[type] = {
      super: data.super.slice(),
      not: data.not.slice(),
      no: data.no.slice(),
    };
  });
  return out;
}

function removeTypeFromChart(chart, type) {
  delete chart[type];
  Object.values(chart).forEach((data) => {
    data.super = data.super.filter((entry) => entry !== type);
    data.not = data.not.filter((entry) => entry !== type);
    data.no = data.no.filter((entry) => entry !== type);
  });
}

function getTypeChartEffectiveness(eraKey) {
  if (eraKey === "gen1") return cloneTypeChart(TYPE_EFFECTIVENESS_GEN1);

  const chart = cloneTypeChart(TYPE_EFFECTIVENESS);

  if (eraKey === "gen2-5") {
    removeTypeFromChart(chart, "Fée");
    if (chart.Spectre && !chart.Spectre.not.includes("Acier")) chart.Spectre.not.push("Acier");
    if (chart["Ténèbres"] && !chart["Ténèbres"].not.includes("Acier")) chart["Ténèbres"].not.push("Acier");
  }

  return chart;
}

function getTypeChartMultiplier(chart, attackType, defenseType) {
  const data = chart[attackType];
  if (!data) return 1;
  if (data.no.includes(defenseType)) return 0;
  if (data.super.includes(defenseType)) return 2;
  if (data.not.includes(defenseType)) return 0.5;
  return 1;
}

function formatTypeChartMultiplier(multiplier) {
  if (multiplier === 2) return "x2";
  if (multiplier === 0.5) return "x1/2";
  if (multiplier === 0) return "x0";
  return "x1";
}

function getTypeChartCellClass(multiplier) {
  if (multiplier === 2) return "is-super";
  if (multiplier === 0.5) return "is-not-very";
  if (multiplier === 0) return "is-immune";
  return "is-neutral";
}

function renderTypeChartScreen() {
  const wrap = document.getElementById("type-chart-wrap");
  const note = document.getElementById("type-chart-note");
  const select = document.getElementById("type-chart-era");
  const offenseSelect = document.getElementById("type-chart-offense-filter");
  const defenseSelect = document.getElementById("type-chart-defense-filter");
  const config = TYPE_CHART_CONFIG[typeChartEra] || TYPE_CHART_CONFIG["gen6+"];
  if (!wrap || !note || !select || !offenseSelect || !defenseSelect) return;

  select.value = typeChartEra;
  if (!config.types.includes(typeChartOffenseFilter)) typeChartOffenseFilter = "all";
  if (!config.types.includes(typeChartDefenseFilter)) typeChartDefenseFilter = "all";

  offenseSelect.innerHTML = `<option value="all">Tous les types offensifs</option>${config.types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  defenseSelect.innerHTML = `<option value="all">Tous les types défensifs</option>${config.types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  offenseSelect.value = typeChartOffenseFilter;
  defenseSelect.value = typeChartDefenseFilter;

  note.textContent = `${config.description} Lignes = type offensif (attaque), colonnes = type défensif. Exemple : en Gen 2-5, l'immunité Spectre contre Combat se lit ligne Combat, colonne Spectre = x0.`;

  const chart = getTypeChartEffectiveness(typeChartEra);
  const offenseTypes = typeChartOffenseFilter === "all" ? config.types : config.types.filter((type) => type === typeChartOffenseFilter);
  const defenseTypes = typeChartDefenseFilter === "all" ? config.types : config.types.filter((type) => type === typeChartDefenseFilter);
  const head = defenseTypes.map((type) => `<th class="type-chart-type-head">${typeBadgeHtml(type)}</th>`).join("");
  const body = offenseTypes.map((attackType) => {
    const cells = defenseTypes.map((defenseType) => {
      const multiplier = getTypeChartMultiplier(chart, attackType, defenseType);
      return `<td class="type-chart-cell ${getTypeChartCellClass(multiplier)}">${formatTypeChartMultiplier(multiplier)}</td>`;
    }).join("");
    return `<tr><th class="type-chart-type-side">${typeBadgeHtml(attackType)}</th>${cells}</tr>`;
  }).join("");

  wrap.innerHTML = `
    <div class="type-chart-scroll">
      <table class="type-chart-table">
        <thead>
          <tr>
            <th class="type-chart-corner">Att. / Déf.</th>
            ${head}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function initTypeChartScreen() {
  const select = document.getElementById("type-chart-era");
  const offenseSelect = document.getElementById("type-chart-offense-filter");
  const defenseSelect = document.getElementById("type-chart-defense-filter");
  if (!select || !offenseSelect || !defenseSelect) return;
  select.addEventListener("change", () => {
    typeChartEra = select.value;
    renderTypeChartScreen();
  });
  offenseSelect.addEventListener("change", () => {
    typeChartOffenseFilter = offenseSelect.value;
    renderTypeChartScreen();
  });
  defenseSelect.addEventListener("change", () => {
    typeChartDefenseFilter = defenseSelect.value;
    renderTypeChartScreen();
  });
}

function openAllModesScreen() {
  [
    "screen-config",
    "screen-game",
    "screen-ranking",
    "screen-games-ranking",
    "screen-pokedex",
    "screen-type-chart",
    "screen-draft-arena",
    "screen-draft-score-attack",
    "screen-profile",
    "screen-achievements",
    "screen-history",
    "screen-multiplayer",
    "screen-odd-one-out",
    "screen-team-builder",
    "screen-teams",
    "screen-emulator",
  ].forEach(hideScreen);
  stopEmulatorSession();
  stopCrySound();
  setQuizModeLayout(false);
  closeRankingPicker();
  showScreen("screen-all-modes");
  window.scrollTo(0, 0);
}

/* Lot 9 - historique navigateur (bouton precedent) */
(function () {
  var OPENERS = {
    allModes: "openAllModesScreen",
    pokedex: "openPokedexMode",
    multiplayer: "openMultiplayerMode",
    teamBuilder: "openTeamBuilderScreen",
    profile: "openProfileScreen",
    achievements: "openAchievementsScreen",
    history: "openMatchHistoryScreen",
    typeChart: "openTypeChartScreen",
    emulator: "openEmulatorMode",
  };
  var GAME_OPENERS = ["startDailyGame", "startNormalGame"];

  function wrap(name, key) {
    var orig = window[name];
    if (typeof orig !== "function") return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      if (!window.__screenHistorySuppress) {
        try {
          if (!(history.state && history.state.screen === key)) {
            history.pushState({ screen: key }, "", "#" + key);
          }
        } catch (e) {}
      }
      return r;
    };
  }

  function initScreenHistory() {
    if (window.__screenHistoryInit) return;
    window.__screenHistoryInit = true;
    Object.keys(OPENERS).forEach(function (key) { wrap(OPENERS[key], key); });
    GAME_OPENERS.forEach(function (name) { wrap(name, "game"); });
    try {
      history.replaceState({ screen: "config" }, "", location.pathname + location.search);
    } catch (e) {}
    window.addEventListener("popstate", function (ev) {
      var key = (ev.state && ev.state.screen) || "config";
      window.__screenHistorySuppress = true;
      try {
        if (key === "config" || key === "game") {
          if (typeof goToConfig === "function") goToConfig();
        } else {
          var name = OPENERS[key];
          if (name && typeof window[name] === "function") window[name]();
        }
      } finally {
        window.__screenHistorySuppress = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScreenHistory);
  } else {
    initScreenHistory();
  }
})();

/* Party Room L1 - lobby multijoueur (2-8) */
var partyRoomState = { code: null, room: null, listenersBound: false };
var partyGuessCache = new Map();
var partyAcIndex = -1;

function ensurePartyListeners() {
  var socket = ensureMultiplayerSocket();
  if (!socket || partyRoomState.listenersBound) return socket;
  partyRoomState.listenersBound = true;
  socket.on("party:room-state", function (room) {
    partyRoomState.room = room;
    partyRoomState.code = room && room.code;
    renderPartyRoom();
  });
  return socket;
}

function openPartyRoomMode() {
  ensurePartyListeners();
  showScreen("screen-party-room");
  renderPartyRoom();
}

function setPartyStatus(message) {
  var el = document.getElementById("party-room-msg");
  if (el) el.textContent = message || "";
}

function partyCreateRoom() {
  var socket = ensurePartyListeners();
  if (!socket) { setPartyStatus("Serveur temps reel indisponible."); return; }
  var input = document.getElementById("party-nickname");
  var nickname = ((input && input.value) || "").trim();
  if (!nickname) { setPartyStatus("Entre un pseudo d'abord."); return; }
  socket.emit("party:create-room", { nickname: nickname }, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Erreur de creation."); return; }
    partyRoomState.room = res.room;
    partyRoomState.code = res.code;
    setPartyStatus("");
    renderPartyRoom();
  });
}

function partyJoinRoom() {
  var socket = ensurePartyListeners();
  if (!socket) { setPartyStatus("Serveur temps reel indisponible."); return; }
  var nickEl = document.getElementById("party-nickname");
  var codeEl = document.getElementById("party-join-code");
  var nickname = ((nickEl && nickEl.value) || "").trim();
  var code = ((codeEl && codeEl.value) || "").trim();
  if (!nickname) { setPartyStatus("Entre un pseudo d'abord."); return; }
  if (!code) { setPartyStatus("Entre un code de room."); return; }
  socket.emit("party:join-room", { nickname: nickname, code: code }, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Impossible de rejoindre."); return; }
    partyRoomState.room = res.room;
    partyRoomState.code = res.code;
    setPartyStatus("");
    renderPartyRoom();
  });
}

function partyLeaveRoom() {
  var socket = ensureMultiplayerSocket();
  if (socket) socket.emit("party:leave-room");
  partyRoomState.room = null;
  partyRoomState.code = null;
  setPartyStatus("Tu as quitte la room.");
  renderPartyRoom();
}

function partyStartGame() {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("party:start", {}, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Impossible de lancer."); return; }
    if (res.room) {
      partyRoomState.room = res.room;
      partyRoomState.code = res.room.code || partyRoomState.code;
      setPartyStatus("");
      renderPartyRoom();
    }
  });
}

function partyCopyInviteLink() {
  if (!partyRoomState.code) { setPartyStatus("Cree ou rejoins une room d'abord."); return; }
  var url = location.origin + location.pathname + "?party=" + encodeURIComponent(partyRoomState.code);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { setPartyStatus("Lien copie !"); }, function () { setPartyStatus(url); });
  } else {
    setPartyStatus(url);
  }
}

function partySubmitAnswer() {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  var acList = document.getElementById("party-guess-ac");
  if (acList) acList.classList.add("hidden");
  var input = document.getElementById("party-guess");
  var guess = ((input && input.value) || "").trim();
  if (!guess) { setPartyStatus("Tape un nom de Pokemon."); return; }
  socket.emit("party:submit-answer", { guess: guess }, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Erreur."); return; }
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
    if (res.correct) { setPartyStatus("Bonne reponse ! +" + (res.gained || 0) + " (rang " + (res.rank || "?") + ")"); if (input) input.value = ""; }
    else if (!res.already) { setPartyStatus("Reponse incorrecte, reessaie."); }
  });
}

function getPartyGuessSearchIndex() {
  var room = partyRoomState.room || {};
  var gens = Array.isArray(room.selectedGens) && room.selectedGens.length ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var selected = new Set(gens.map(function (gen) { return Number(gen); }));
  var includeAltForms = room.gameMode === "typecombo";
  return FULL_SEARCH_INDEX.filter(function (entry) {
    var pokemon = entry && entry.pokemon;
    if (!pokemon) return false;
    if (!includeAltForms && pokemon.isAltForm) return false;
    return selected.has(Number(pokemon.gen));
  });
}

function filterPartyGuessAC() {
  var input = document.getElementById("party-guess");
  var list = document.getElementById("party-guess-ac");
  if (!input || !list) return;
  partyAcIndex = -1;
  var qNorm = norm(input.value.trim());
  if (!qNorm) {
    list.classList.add("hidden");
    return;
  }
  var matches = searchPokemonFast(qNorm, getPartyGuessSearchIndex(), partyGuessCache, null);
  renderPartyGuessAC(matches);
}

function renderPartyGuessAC(matches) {
  var list = document.getElementById("party-guess-ac");
  if (!list) return;
  if (!matches.length) {
    list.classList.add("hidden");
    return;
  }
  list.innerHTML = matches.map(function (pokemon) {
    var fallbackSprite = getSpriteUrl(getPokemonSpriteId(pokemon));
    return '<div class="ac-item" data-name="' + escapeHtml(pokemon.name) + '">' +
      '<img src="' + escapeHtml(getPokemonSprite(pokemon)) + '" alt="' + escapeHtml(pokemon.name) + '" loading="lazy" data-fallback="' + escapeHtml(fallbackSprite) + '" />' +
      '<div>' +
        '<div class="ac-name">' + escapeHtml(pokemon.name) + '</div>' +
        '<div class="ac-sub">' + escapeHtml(pokemon.type1 || "?") + (pokemon.type2 ? " / " + escapeHtml(pokemon.type2) : "") + ' • Gen ' + escapeHtml(pokemon.gen || "?") + '</div>' +
      '</div>' +
    '</div>';
  }).join("");
  list.querySelectorAll(".ac-item").forEach(function (item) {
    item.addEventListener("mousedown", function (event) {
      event.preventDefault();
      selectPartyGuessAC(item.dataset.name || item.querySelector(".ac-name")?.textContent || "");
    });
  });
  list.classList.remove("hidden");
}

function selectPartyGuessAC(name) {
  var input = document.getElementById("party-guess");
  var list = document.getElementById("party-guess-ac");
  if (input) input.value = name || "";
  if (list) list.classList.add("hidden");
  partyAcIndex = -1;
  partySubmitAnswer();
}

function handlePartyGuessKey(event) {
  var list = document.getElementById("party-guess-ac");
  if (!list) {
    if (event.key === "Enter") { event.preventDefault(); partySubmitAnswer(); }
    return;
  }
  var items = list.querySelectorAll(".ac-item");
  if (event.key === "ArrowDown") {
    event.preventDefault();
    partyAcIndex = Math.min(partyAcIndex + 1, items.length - 1);
    highlightItems(items, partyAcIndex);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    partyAcIndex = Math.max(partyAcIndex - 1, -1);
    highlightItems(items, partyAcIndex);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (partyAcIndex >= 0 && items[partyAcIndex]) {
      selectPartyGuessAC(items[partyAcIndex].dataset.name || items[partyAcIndex].querySelector(".ac-name")?.textContent || "");
    } else {
      partySubmitAnswer();
    }
  } else if (event.key === "Escape") {
    list.classList.add("hidden");
  }
}

function clearPartyGuessInput() {
  var input = document.getElementById("party-guess");
  var list = document.getElementById("party-guess-ac");
  if (input) input.value = "";
  if (list) list.classList.add("hidden");
  partyAcIndex = -1;
  partyGuessCache.clear();
}

function partyRevealRound() {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("party:reveal-round", {}, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Impossible de reveler."); return; }
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
  });
}

function partyNextRound() {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("party:next-round", {}, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Impossible de passer a la suite."); return; }
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
  });
}

function partySetRounds(rounds) {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("party:set-rounds", { rounds: Number(rounds) }, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Impossible de changer le nombre de manches."); return; }
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
  });
}
window.partySetRounds = partySetRounds;

function partySetMode(mode) {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("party:set-mode", { mode: mode }, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Impossible de changer de mode."); return; }
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
  });
}

function partySubmitStat(statKey) {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("party:submit-stat", { statKey: statKey }, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Erreur."); return; }
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
    if (!res.already) { setPartyStatus("Stat choisie !"); }
  });
}

function partySetGens(gens) {
  var socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("party:set-gens", { gens: gens }, function (res) {
    res = res || {};
    if (!res.ok) { setPartyStatus(res.error || "Impossible de changer les generations."); return; }
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
  });
}

function partyToggleGen(gen) {
  var room = partyRoomState.room || {};
  var current = Array.isArray(room.selectedGens) ? room.selectedGens.slice() : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var idx = current.indexOf(gen);
  if (idx >= 0) {
    if (current.length <= 1) { setPartyStatus("Au moins une génération."); return; }
    current.splice(idx, 1);
  } else {
    current.push(gen);
  }
  partySetGens(current);
}

function partyAllGens() {
  partySetGens([1, 2, 3, 4, 5, 6, 7, 8, 9]);
}

var PARTY_MODE_SHORT_LABELS = { guess: "Course Pokémon", typecombo: "Combo de types", duocriteria: "Duo de critères", statclash: "Meilleure stat", statclashparty: "Stat Clash Party" };
function showPartyRoundBanner(room) {
  var panel = document.getElementById("party-round");
  if (!panel || !room) return;
  var banner = document.getElementById("party-round-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "party-round-banner";
    banner.className = "party-round-banner";
    var bigEl = document.createElement("b");
    var subEl = document.createElement("span");
    banner.appendChild(bigEl);
    banner.appendChild(subEl);
    panel.appendChild(banner);
  }
  banner.firstChild.textContent = "Manche " + (Number(room.roundNumber) || 1);
  banner.lastChild.textContent = PARTY_MODE_SHORT_LABELS[room.gameMode] || "";
  banner.classList.remove("is-on");
  void banner.offsetWidth;
  banner.classList.add("is-on");
}

function partyUpdateTimer() {
  var el = document.getElementById("party-timer");
  if (!el) return;
  var room = partyRoomState.room;
  if (!room || room.status !== "playing" || !room.deadlineAt) {
    el.classList.add("hidden");
    el.classList.remove("is-urgent");
    el.textContent = "";
    return;
  }
  var remaining = Math.max(0, Math.ceil((room.deadlineAt - Date.now()) / 1000));
  el.classList.remove("hidden");
  el.textContent = "\u23F1 " + remaining + " s";
  el.classList.toggle("is-urgent", remaining <= 10);
}

function renderPartyRoom() {
  var lobby = document.getElementById("party-lobby");
  var joined = document.getElementById("party-joined");
  var room = partyRoomState.room;
  var selfId = multiplayerSocket && multiplayerSocket.id;
  if (!room) {
    if (lobby) lobby.classList.remove("hidden");
    if (joined) joined.classList.add("hidden");
    return;
  }
  if (lobby) lobby.classList.add("hidden");
  if (joined) joined.classList.remove("hidden");
  var codeEl = document.getElementById("party-room-code");
  if (codeEl) codeEl.textContent = room.code || "-";
  var playing = room.status === "playing";
  var finished = room.status === "finished";
  var complete = room.status === "complete";
  var roundNo = Number(room.roundNumber) || 0;
  var total = Number(room.totalRounds) || 5;
  var modeLabels = { guess: "Course Pokémon", typecombo: "Combo de types", duocriteria: "Duo de critères", statclash: "Meilleure stat", statclashparty: "Stat Clash" };
  var modeLabel = modeLabels[room.gameMode] || "";
  var statusEl = document.getElementById("party-room-status-badge");
  if (statusEl) {
    statusEl.textContent = playing ? ("Manche " + roundNo + " / " + total)
      : finished ? ("Manche " + roundNo + " / " + total + " terminee")
      : complete ? ("🏆 Party terminée" + (modeLabel ? " — " + modeLabel : ""))
      : "En attente";
  }
  var raw = room.players || [];
  var me = raw.find(function (p) { return p.isSelf; }) || raw.find(function (p) { return p.id === selfId; }) || null;
  var isHost = Boolean((me && me.isHost) || (room.hostId && selfId && room.hostId === selfId));
  var players = raw.slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
  var medals = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];
  var listEl = document.getElementById("party-players");
  if (listEl) {
    var scMode = Boolean(room.round && (room.round.mode === "statclash" || room.round.mode === "statclashparty"));
    var typeComboMode = Boolean(room.round && (room.round.mode === "typecombo" || room.round.mode === "duocriteria"));
    var prevScores = partyRoomState.prevScores || {};
    var revealed = finished || complete;
    var __partyRows = players.map(function (p, i) {
      var rank = (complete && i < 3) ? medals[i] : (i + 1);
      var gained = (p.score || 0) > (prevScores[p.id] || 0);
      var avName = String(p.nickname || "?");
      var avatarInitial = avName.trim().charAt(0).toUpperCase() || "?";
      var avatarTone = 0;
      for (var avI = 0; avI < avName.length; avI += 1) avatarTone += avName.charCodeAt(avI);
      avatarTone = avatarTone % 6;
      var statusBadge = "";
      if (scMode && playing) {
        statusBadge = p.pickKey ? '<span class="party-check">a choisi</span>' : '<span class="party-wait">attend…</span>';
      } else if (scMode && revealed) {
        if ((p.lastGain || 0) > 0) statusBadge = '<span class="party-check">+' + p.lastGain + '</span>';
      } else if (typeComboMode && playing) {
        statusBadge = p.correct ? '<span class="party-check">trouvé</span>' : '<span class="party-wait">cherche</span>';
      } else if (p.correct) {
        statusBadge = '<span class="party-check">+' + (p.lastGain || 0) + '</span>';
      }
      var highlight = (scMode && playing && p.pickKey) || (scMode && revealed && (p.lastGain || 0) > 0) || (!scMode && p.correct);
      return '<li class="party-player' + (p.connected ? '' : ' is-offline') + (highlight ? ' is-correct' : '') + '">' +
        '<span class="party-rank">' + rank + '</span>' +
        '<span class="party-avatar av-' + avatarTone + '">' + escapeHtml(avatarInitial) + '</span>' +
        '<span class="party-player-name">' + escapeHtml(p.nickname) + '</span>' +
        (p.isHost ? '<span class="party-badge-host">Hote</span>' : '') +
        (p.isSelf ? '<span class="party-badge-self">Toi</span>' : '') +
        statusBadge +
        '<span class="party-score' + (gained ? ' is-gain' : '') + '">' + (p.score || 0) + ' pts</span>' +
        '</li>';
    }).join("");
    var __partyMax = Number(room.maxPlayers) || 8;
    var __partyEmpty = "";
    if (!playing && !finished && !complete) {
      var __freeSeats = Math.max(0, __partyMax - players.length);
      for (var __s = 0; __s < __freeSeats; __s += 1) {
        __partyEmpty += '<li class="party-player party-player-empty"><span class="party-rank">+</span><span class="party-player-name party-seat-label">Place libre \u00b7 partage le code</span></li>';
      }
    }
    listEl.innerHTML = __partyRows + __partyEmpty;
    listEl.classList.toggle("is-podium", complete);
    partyRoomState.prevScores = {};
    raw.forEach(function (p) { partyRoomState.prevScores[p.id] = p.score || 0; });
  }
  if (room.status === "playing" && room.deadlineAt) {
    partyUpdateTimer();
    if (!partyRoomState.timerInterval) partyRoomState.timerInterval = setInterval(partyUpdateTimer, 250);
  } else {
    if (partyRoomState.timerInterval) { clearInterval(partyRoomState.timerInterval); partyRoomState.timerInterval = null; }
    partyUpdateTimer();
  }
  var countEl = document.getElementById("party-count");
  if (countEl) countEl.textContent = raw.length + " / " + (room.maxPlayers || 8);
  var roundEl = document.getElementById("party-round");
  if (roundEl) {
    var hasRound = Boolean(room.round && (room.round.image || room.round.mode === "typecombo" || room.round.mode === "duocriteria"));
    roundEl.classList.toggle("party-round-typecombo", Boolean(room.round && (room.round.mode === "typecombo" || room.round.mode === "duocriteria")));
    roundEl.classList.toggle("hidden", !hasRound);
    var roundKey = (room.status === "playing") ? (Number(room.roundNumber) || 0) : -1;
    if (hasRound && roundKey > 0 && roundKey !== partyRoomState.lastRoundKey) {
      roundEl.classList.remove("is-entering");
      void roundEl.offsetWidth;
      roundEl.classList.add("is-entering");
    }
    var inputRoundKey = (room.code || "") + ":" + roundKey;
    if (hasRound && playing && roundKey > 0 && inputRoundKey !== partyRoomState.lastGuessRoundKey) {
      clearPartyGuessInput();
      partyRoomState.lastGuessRoundKey = inputRoundKey;
    } else if (!playing) {
      var partyGuessAc = document.getElementById("party-guess-ac");
      if (partyGuessAc) partyGuessAc.classList.add("hidden");
    }
    if (playing && roundKey && roundKey !== partyRoomState.lastRoundKey) showPartyRoundBanner(room);
    partyRoomState.lastRoundKey = roundKey;
    var spriteEl = document.getElementById("party-round-sprite");
    if (hasRound && spriteEl && room.round.image) spriteEl.src = room.round.image;
    var isStatClash = Boolean(room.round && (room.round.mode === "statclash" || room.round.mode === "statclashparty"));
    var isDuoCriteria = Boolean(room.round && room.round.mode === "duocriteria");
    var isTypeCombo = Boolean(room.round && (room.round.mode === "typecombo" || isDuoCriteria));
    var variant = (room.round && room.round.variant) || "normal";
    var modeEl = document.getElementById("party-round-mode");
    if (modeEl) {
      var scParty = Boolean(room.round && room.round.mode === "statclashparty");
      modeEl.textContent = isDuoCriteria
        ? "Duo de critères : trouve un Pokémon qui coche les deux cases"
        : isTypeCombo
        ? "Combo de types : trouve un Pokémon qui possède ces types"
        : isStatClash
        ? ((scParty ? "Stat Clash : " : "Meilleure stat : ") + (room.round.name || "?") + (playing ? (scParty ? " — choisis la stat qui battra les autres !" : " — choisis sa stat la plus élevée !") : ""))
        : (variant === "silhouette" ? "Silhouette" : (variant === "pixel" ? "Pixelise" : "Image normale"));
    }
    if (spriteEl) {
      spriteEl.classList.remove("party-sprite-silhouette", "party-sprite-pixel");
      spriteEl.classList.toggle("hidden", isTypeCombo);
      if (playing && !isTypeCombo) {
        if (variant === "silhouette") spriteEl.classList.add("party-sprite-silhouette");
        else if (variant === "pixel") spriteEl.classList.add("party-sprite-pixel");
      }
    }
    var answerEl = document.getElementById("party-round-answer");
    if (answerEl) {
      if (isTypeCombo && (finished || complete)) {
        answerEl.classList.remove("hidden");
        if (room.round.answer) {
          answerEl.textContent = "Trouvé : " + room.round.answer + " (+" + (Number(room.round.winnerGain) || 0) + ")";
        } else {
          var exampleNames = Array.isArray(room.round.examples) ? room.round.examples.map(function (entry) { return entry && entry.name ? entry.name : entry; }).filter(Boolean) : [];
          var examples = exampleNames.length ? " Exemples : " + exampleNames.join(", ") + "." : "";
          answerEl.textContent = "Personne n'a trouvé." + examples;
        }
      } else if (isStatClash && (finished || complete) && room.round.stats) {
        var bestKey = room.round.bestStat;
        var labelsW = room.round.statLabels || {};
        answerEl.classList.remove("hidden");
        if (room.round.mode === "statclashparty") {
          answerEl.textContent = "Meilleure valeur : " + (labelsW[bestKey] || bestKey || "?") + " (" + (Number(room.round.stats[bestKey]) || 0) + ") — chacun marque la valeur de sa stat.";
        } else {
          var winners = (room.players || []).filter(function (w) { return (w.lastGain || 0) > 0; }).map(function (w) { return w.nickname; });
          answerEl.textContent = "Stat gagnante : " + (labelsW[bestKey] || bestKey || "?") + " (" + (Number(room.round.stats[bestKey]) || 0) + ") — " + (winners.length ? ("Gagnant(s) : " + winners.join(", ") + " +100") : "Personne");
        }
      } else if ((finished || complete) && room.round && room.round.answer) {
        answerEl.classList.remove("hidden");
        answerEl.textContent = "C'etait : " + room.round.answer;
      } else {
        answerEl.classList.add("hidden");
        answerEl.textContent = "";
      }
    }
    var inputWrap = document.getElementById("party-round-input");
    if (inputWrap) inputWrap.classList.toggle("hidden", !(playing && !isStatClash && me && !me.correct));
    if (playing && !isStatClash && me && !me.correct) {
      var guessInput = document.getElementById("party-guess");
      if (guessInput) guessInput.placeholder = isDuoCriteria ? "Un Pokémon qui coche les deux cases" : (isTypeCombo ? "Un Pokémon avec ces types" : "Nom du Pokémon");
      if (guessInput && document.activeElement !== guessInput) guessInput.focus();
    }
    var statOpts = document.getElementById("party-stat-options");
    if (statOpts) {
      var showOpts = isStatClash && playing && me && !me.pickKey;
      statOpts.classList.toggle("hidden", !showOpts);
      if (showOpts && room.round.statKeys) {
        var labels = room.round.statLabels || {};
        var scPartyMode = room.round.mode === "statclashparty";
        var usedKeys = (scPartyMode && me && Array.isArray(me.usedStatKeys)) ? me.usedStatKeys : [];
        statOpts.innerHTML = room.round.statKeys.map(function (k) {
          var isUsed = usedKeys.indexOf(k) !== -1;
          return '<button type="button" class="party-stat-btn' + (isUsed ? ' is-used' : '') + '" data-stat="' + k + '"' + (isUsed ? ' disabled' : ' data-action="partySubmitStatFromEl"') + '>' + escapeHtml(labels[k] || k) + (isUsed ? ' ✓' : '') + '</button>';
        }).join("");
      } else if (!showOpts) {
        statOpts.innerHTML = "";
      }
    }
    var statReveal = document.getElementById("party-stat-reveal");
    if (statReveal) {
      var doReveal = (isStatClash && (finished || complete) && room.round.stats) || isTypeCombo;
      statReveal.classList.toggle("hidden", !doReveal);
      if (isTypeCombo) {
        var types = Array.isArray(room.round.types) ? room.round.types : [];
        var duoCriteriaList = Array.isArray(room.round.criteria) ? room.round.criteria : [];
        var count = Number(room.round.count) || 0;
        var answerName = room.round.answer || "";
        var answerSprite = room.round.answerSprite || "";
        var examplesList = Array.isArray(room.round.examples) ? room.round.examples : [];
        var spriteEntries = answerName
          ? [{ name: answerName, sprite: answerSprite, winner: true }]
          : examplesList.slice(0, 6).map(function (entry) {
              return typeof entry === "string" ? { name: entry, sprite: "" } : entry;
            });
        var spriteHtml = (finished || complete) && spriteEntries.length
          ? '<div class="party-typecombo-sprites">' + spriteEntries.map(function (entry) {
              var sprite = entry && entry.sprite ? '<img src="' + escapeHtml(entry.sprite) + '" alt="' + escapeHtml(entry.name || "Pokémon") + '" loading="lazy" />' : '';
              return '<div class="party-typecombo-sprite-card' + (entry && entry.winner ? ' is-winner' : '') + '">' + sprite + '<span>' + escapeHtml((entry && entry.name) || "?") + '</span></div>';
            }).join("") + '</div>'
          : '';
        var comboDiff = room.round.difficulty || null;
        var comboPts = Number(room.round.points) || 0;
        var diffBadge = comboDiff ? '<span class="party-combo-diff is-' + (comboDiff.tier || "") + '">' + escapeHtml(comboDiff.label || "") + '</span>' : '';
        var criteriaHtml = isDuoCriteria
          ? '<div class="party-duo-criteria">' + duoCriteriaList.map(function (criterion) {
              return '<span class="party-duo-chip is-' + escapeHtml((criterion && criterion.kind) || "") + '">' + escapeHtml((criterion && criterion.label) || "?") + '</span>';
            }).join('<span class="party-duo-plus">+</span>') + '</div>'
          : (types.length === 2 && types[0] === types[1]
            ? '<div class="party-typecombo-types">' + typeBadgeHtml(types[0]) + '<span class="party-combo-pure">type pur</span></div>'
            : '<div class="party-typecombo-types">' + types.map(function (type) { return typeBadgeHtml(type); }).join("") + '</div>');
        statReveal.innerHTML = '<div class="party-typecombo-panel">' +
          criteriaHtml +
          '<div class="party-combo-meta">' + diffBadge + '<span class="party-combo-count">' + count + ' Pokémon possible' + (count > 1 ? 's' : '') + '</span>' + (comboPts ? '<span class="party-combo-points">vaut ' + comboPts + ' pts</span>' : '') + '</div>' +
          spriteHtml +
          '</div>';
      } else if (doReveal) {
        var st = room.round.stats;
        var labels2 = room.round.statLabels || {};
        var best = room.round.bestStat;
        statReveal.innerHTML = (room.round.statKeys || []).map(function (k) {
          return '<div class="party-stat-row' + (k === best ? ' is-best' : '') + '"><span>' + escapeHtml(labels2[k] || k) + '</span><b>' + (Number(st[k]) || 0) + '</b></div>';
        }).join("");
      } else {
        statReveal.innerHTML = "";
      }
    }
  }
  var startBtn = document.getElementById("party-start-btn");
  if (startBtn) {
    startBtn.classList.toggle("hidden", !(isHost && (room.status === "waiting" || complete)));
    startBtn.disabled = raw.length < (room.minPlayers || 2);
    startBtn.textContent = complete ? "Relancer une party" : "Lancer la party";
  }
  var modeSel = document.getElementById("party-mode-select");
  if (modeSel) modeSel.classList.toggle("hidden", !(room.status === "waiting" || room.status === "complete"));
  var gensSel = document.getElementById("party-gens-select");
  if (gensSel) gensSel.classList.toggle("hidden", !(room.status === "waiting" || room.status === "complete"));
  var guessBtn = document.getElementById("party-mode-guess");
  if (guessBtn) {
    guessBtn.classList.toggle("is-active", (room.gameMode || "guess") === "guess");
    guessBtn.disabled = !isHost;
  }
  var scBtn = document.getElementById("party-mode-statclash");
  if (scBtn) {
    scBtn.classList.toggle("is-active", room.gameMode === "statclash");
    scBtn.disabled = !isHost;
  }
  var scpBtn = document.getElementById("party-mode-statclashparty");
  if (scpBtn) {
    scpBtn.classList.toggle("is-active", room.gameMode === "statclashparty");
    scpBtn.disabled = !isHost;
  }
  var typeComboBtn = document.getElementById("party-mode-typecombo");
  if (typeComboBtn) {
    typeComboBtn.classList.toggle("is-active", room.gameMode === "typecombo");
    typeComboBtn.disabled = !isHost;
  }
  var duoBtn = document.getElementById("party-mode-duocriteria");
  if (duoBtn) {
    duoBtn.classList.toggle("is-active", room.gameMode === "duocriteria");
    duoBtn.disabled = !isHost;
  }
  // Sélecteur du nombre de manches (hôte uniquement)
  var roundsSel = document.getElementById("party-rounds-select");
  if (roundsSel) roundsSel.classList.toggle("hidden", !(room.status === "waiting" || room.status === "complete"));
  [5, 10, 15, 20].forEach(function (n) {
    var rb = document.getElementById("party-rounds-" + n);
    if (rb) {
      rb.classList.toggle("is-active", (Number(room.totalRounds) || 5) === n);
      rb.disabled = !isHost;
    }
  });
  var modeHints = {
    guess: "Course Pokémon : devine le Pokémon le plus vite possible. Les points dépendent du rang de bonne réponse.",
    typecombo: "Combo de types : deux types sont tirés parmi les combinaisons existantes. Le premier Pokémon valide marque la manche (plus le combo est rare, plus ça paie).",
    duocriteria: "Duo de critères : type, couleur, habitat, génération ou stade — deux critères croisés, le premier Pokémon qui coche les deux cases gagne. Rapidité bonus !",
    statclash: "Meilleure stat : choisis la stat la plus élevée du Pokémon. Les bons choix marquent des points.",
    statclashparty: "Stat Clash : choisis une stat différente à chaque manche. Tu marques la valeur réelle de la stat choisie."
  };
  var hintEl = document.getElementById("party-mode-hint");
  if (hintEl) {
    hintEl.textContent = modeHints[room.gameMode] || modeHints.guess;
    hintEl.classList.toggle("hidden", !(room.status === "waiting" || room.status === "complete"));
  }
  var selGens = Array.isArray(room.selectedGens) ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (var g = 1; g <= 9; g++) {
    var gb = document.getElementById("party-gen-" + g);
    if (gb) { gb.classList.toggle("is-active", selGens.indexOf(g) !== -1); gb.disabled = !isHost; }
  }
  var genAllBtn = document.getElementById("party-gens-all");
  if (genAllBtn) { genAllBtn.classList.toggle("is-active", selGens.length === 9); genAllBtn.disabled = !isHost; }
  var nextBtn = document.getElementById("party-room-next-btn");
  if (nextBtn) nextBtn.classList.toggle("hidden", !(isHost && finished && (Number(room.roundNumber) || 0) < (Number(room.totalRounds) || 5)));
  var revealBtn = document.getElementById("party-reveal-btn");
  if (revealBtn) revealBtn.classList.toggle("hidden", !(isHost && playing));
}

function initPartyFromUrl() {
  try {
    var params = new URLSearchParams(location.search || "");
    var raw = params.get("party");
    if (!raw) return;
    var code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!code) return;
    openPartyRoomMode();
    var codeEl = document.getElementById("party-join-code");
    if (codeEl) codeEl.value = code;
    setPartyStatus("Room " + code + " prete : entre ton pseudo puis clique Rejoindre.");
  } catch (e) {}
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { setTimeout(initPartyFromUrl, 0); });
} else {
  setTimeout(initPartyFromUrl, 0);
}

window.openPartyRoomMode = openPartyRoomMode;

function openTypeChartScreen() {
  [
    "screen-config",
    "screen-game",
    "screen-ranking",
    "screen-games-ranking",
    "screen-pokedex",
    "screen-draft-arena",
    "screen-draft-score-attack",
    "screen-profile",
    "screen-achievements",
    "screen-history",
    "screen-multiplayer",
    "screen-odd-one-out",
    "screen-team-builder",
    "screen-teams",
    "screen-emulator",
  ].forEach(hideScreen);
  stopEmulatorSession();
  stopCrySound();
  setQuizModeLayout(false);
  closeRankingPicker();
  showScreen("screen-type-chart");
  setGlobalNavActive("types");
  renderTypeChartScreen();
}

function getTypeIconPath(typeFr) {
  const file = TYPE_ICON_FILE_BY_FR[typeFr];
  return file ? `/types/${file}.png` : null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function typeBadgeHtml(typeFr) {
  if (!typeFr) return "";
  const icon = getTypeIconPath(typeFr);
  const iconHtml = icon ? `<img src="${icon}" alt="${escapeHtml(typeFr)}" loading="lazy" />` : "";
  // DA 2026 v2 : pastille colorée officielle du type (classes .type-feu, .type-eau...).
  const typeSlug = typeFr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return `<span class="type-badge type-${typeSlug}">${iconHtml}<span>${escapeHtml(typeFr)}</span></span>`;
}

function renderHomeTypeHelper() {
  const select = document.getElementById("home-type-helper-select");
  const strong = document.getElementById("home-type-helper-strong");
  const weak = document.getElementById("home-type-helper-weak");
  const resisted = document.getElementById("home-type-helper-resisted");
  if (!select || !strong || !weak || !resisted) return;

  const data = TYPE_EFFECTIVENESS[select.value];
  if (!data) return;

  const renderList = (items) => items.length ? items.map((type) => typeBadgeHtml(type)).join("") : '<span class="home-type-helper-empty">Aucun</span>';

  strong.innerHTML = renderList(data.super);
  weak.innerHTML = renderList(data.no);
  resisted.innerHTML = renderList(data.not);
}

function initHomeTypeHelper() {
  const select = document.getElementById("home-type-helper-select");
  if (!select) return;
  select.addEventListener("change", renderHomeTypeHelper);
  renderHomeTypeHelper();
}

const HOME_DEFENSE_TEAM_SELECT_IDS = [
  "home-defense-slot1-type1",
  "home-defense-slot1-type2",
  "home-defense-slot2-type1",
  "home-defense-slot2-type2",
  "home-defense-slot3-type1",
  "home-defense-slot3-type2",
];

const HOME_DEFENSE_TEAM_TYPES = Object.keys(TYPE_EFFECTIVENESS);

function renderHomeAnalysisChip(type, meta) {
  return `<span class="home-analysis-chip"><b>${escapeHtml(type)}</b><small>${escapeHtml(meta)}</small></span>`;
}

function getHomeDefenseTeamSlots() {
  const slots = [];
  for (let i = 1; i <= 3; i += 1) {
    const type1 = document.getElementById(`home-defense-slot${i}-type1`);
    const type2 = document.getElementById(`home-defense-slot${i}-type2`);
    if (!type1 || !type2) continue;
    const t1 = type1.value || "";
    const t2 = type2.value || "";
    if (!t1) continue;
    slots.push([t1].concat(t2 ? [t2] : []));
  }
  return slots;
}

function renderHomeDefenseTypeHelper() {
  const weak = document.getElementById("home-defense-team-weaknesses");
  const cover = document.getElementById("home-defense-team-coverage");
  if (!weak || !cover) return;

  const slots = getHomeDefenseTeamSlots();
  if (!slots.length) {
    weak.innerHTML = '<span class="home-type-helper-empty">Ajoute au moins un slot.</span>';
    cover.innerHTML = '<span class="home-type-helper-empty">La couverture apparaîtra ici.</span>';
    return;
  }

  const rows = HOME_DEFENSE_TEAM_TYPES.map((attackType) => {
    const multipliers = slots.map((slot) => slot.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1));
    const weakCount = multipliers.filter((multiplier) => multiplier > 1).length;
    const coverCount = multipliers.filter((multiplier) => multiplier > 0 && multiplier < 1).length;
    const immuneCount = multipliers.filter((multiplier) => multiplier === 0).length;
    const coverageScore = coverCount + (immuneCount * 2);
    const maxMultiplier = multipliers.length ? Math.max(...multipliers) : 0;
    return { type: attackType, weakCount, coverCount, immuneCount, coverageScore, maxMultiplier };
  });

  const threats = rows
    .filter((row) => row.weakCount > 0)
    .sort((a, b) => b.weakCount - a.weakCount || b.maxMultiplier - a.maxMultiplier || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const coverage = rows
    .filter((row) => row.coverageScore > 0)
    .sort((a, b) => b.coverageScore - a.coverageScore || b.immuneCount - a.immuneCount || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  weak.innerHTML = threats.length
    ? threats.map((row) => renderHomeAnalysisChip(row.type, `×${row.weakCount}`)).join("")
    : '<span class="home-type-helper-empty">Aucune faiblesse marquée.</span>';

  cover.innerHTML = coverage.length
    ? coverage.map((row) => renderHomeAnalysisChip(row.type, `×${row.coverageScore}`)).join("")
    : '<span class="home-type-helper-empty">Aucune couverture notable.</span>';
}

function initHomeDefenseTypeHelper() {
  for (const id of HOME_DEFENSE_TEAM_SELECT_IDS) {
    const select = document.getElementById(id);
    if (!select || select.dataset.ready) continue;
    select.innerHTML = [
      '<option value="">Aucun</option>',
      ...HOME_DEFENSE_TEAM_TYPES.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`),
    ].join("");
    select.dataset.ready = "1";
    if (id === "home-defense-slot1-type1") select.value = "Normal";
    else select.value = "";
    select.addEventListener("change", renderHomeDefenseTypeHelper);
  }
  renderHomeDefenseTypeHelper();
}

function renderHomeTeamSuggestionHelper() {
  const type1 = document.getElementById("home-team-type1");
  const type2 = document.getElementById("home-team-type2");
  const output = document.getElementById("home-team-suggestions");
  if (!type1 || !type2 || !output) return;

  const selected = [type1.value, type2.value || null].filter(Boolean);
  const uniqueSelected = [...new Set(selected)];
  const currentWeaknesses = Object.keys(TYPE_EFFECTIVENESS)
    .map((attackType) => ({
      type: attackType,
      multiplier: uniqueSelected.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1),
    }))
    .filter((entry) => entry.multiplier > 1);

  const suggestions = Object.keys(TYPE_EFFECTIVENESS)
    .filter((candidate) => !uniqueSelected.includes(candidate))
    .map((candidate) => {
      const resistCount = currentWeaknesses.filter((weakness) => attackMultiplier(weakness.type, candidate) < 1).length;
      const immuneCount = currentWeaknesses.filter((weakness) => attackMultiplier(weakness.type, candidate) === 0).length;
      const pressureCount = currentWeaknesses.filter((weakness) => attackMultiplier(candidate, weakness.type) > 1).length;
      const diversityBonus = uniqueSelected.every((existing) => attackMultiplier(candidate, existing) !== 0.5) ? 1 : 0;
      const score = immuneCount * 5 + resistCount * 3 + pressureCount * 2 + diversityBonus;
      return { type: candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type, "fr"))
    .slice(0, 5);

  output.innerHTML = suggestions.length
    ? suggestions.map((entry) => typeBadgeHtml(entry.type)).join("")
    : '<span class="home-type-helper-empty">Aucune suggestion</span>';
}

function initHomeTeamSuggestionHelper() {
  const type1 = document.getElementById("home-team-type1");
  const type2 = document.getElementById("home-team-type2");
  if (!type1 || !type2) return;
  type1.addEventListener("change", renderHomeTeamSuggestionHelper);
  type2.addEventListener("change", renderHomeTeamSuggestionHelper);
  renderHomeTeamSuggestionHelper();
}

function createTeamBuilderEmptySlot() {
  return {
    pokemonId: null,
    item: "",
    gimmick: "",
    teraType: "",
    moves: ["", "", "", ""],
    nature: "Hardi",
    talent: "",
    evPreset: "offensive-physique",
    evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
    ivPreset: "all31",
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  };
}

function createTeamBuilderState() {
  return Array.from({ length: 6 }, () => createTeamBuilderEmptySlot());
}

function normalizeTeamBuilderSpread(spread, defaultStat = 0, minStat = 0, maxStat = 252) {
  const safe = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return defaultStat;
    return Math.max(minStat, Math.min(maxStat, Math.round(n)));
  };
  return {
    hp: safe(spread?.hp),
    atk: safe(spread?.atk),
    def: safe(spread?.def),
    spa: safe(spread?.spa),
    spd: safe(spread?.spd),
    spe: safe(spread?.spe),
  };
}

function normalizeTeamBuilderState(state) {
  const slots = Array.isArray(state) ? state.slice(0, 6) : [];
  while (slots.length < 6) slots.push(createTeamBuilderEmptySlot());
  return slots.map((slot) => ({
    pokemonId: (() => {
      const id = Number(slot?.pokemonId);
      return Number.isInteger(id) && id > 0 ? id : null;
    })(),
    item: TEAM_BUILDER_ITEMS.includes(slot?.item) ? slot.item : "",
    gimmick: TEAM_BUILDER_GIMMICKS.includes(slot?.gimmick) ? slot.gimmick : "",
    teraType: TEAM_BUILDER_TERA_TYPES.includes(slot?.teraType) ? slot.teraType : "",
    moves: Array.isArray(slot?.moves)
      ? slot.moves.slice(0, 4).map((move) => (typeof move === "string" ? move.trim() : ""))
      : ["", "", "", ""],
    nature: TEAM_BUILDER_NATURES.some((nature) => nature.value === slot?.nature) ? slot.nature : "Hardi",
    talent: typeof slot?.talent === "string" ? slot.talent : "",
    evPreset: TEAM_BUILDER_EV_PRESETS.some((preset) => preset.value === slot?.evPreset) ? slot.evPreset : "offensive-physique",
    evs: slot?.evs ? normalizeTeamBuilderSpread(slot.evs, 0, 0, 252) : createTeamBuilderEmptySlot().evs,
    ivPreset: TEAM_BUILDER_IV_PRESETS.some((preset) => preset.value === slot?.ivPreset) ? slot.ivPreset : "all31",
    ivs: slot?.ivs ? normalizeTeamBuilderSpread(slot.ivs, 31, 0, 31) : createTeamBuilderEmptySlot().ivs,
  }));
}

function loadTeamBuilderState() {
  const parsed = readJson(STORAGE_KEYS.teamBuilder, null);
  teamBuilderState = normalizeTeamBuilderState(parsed);
}

function saveTeamBuilderState() {
  writeJson(STORAGE_KEYS.teamBuilder, teamBuilderState);
}

function getTeamBuilderPokemon(slot) {
  return slot?.pokemonId ? POKEMON_BY_ID.get(slot.pokemonId) || null : null;
}

function getTeamBuilderSlotPokemonTypes(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  return pokemon ? [pokemon.type1, pokemon.type2].filter(Boolean) : [];
}

function getTeamBuilderOffenseBucket(slot) {
  const preset = String(slot?.evPreset || "");
  if (preset === "offensive-physique") return "physique";
  if (preset === "offensive-speciale") return "speciale";
  if (preset === "support" || preset === "bulky") return "support";
  if (preset === "rapide") {
    const atk = Number(slot?.evs?.atk) || 0;
    const spa = Number(slot?.evs?.spa) || 0;
    if (atk === spa) return "support";
    return atk > spa ? "physique" : "speciale";
  }
  if (preset !== "custom") return "support";

  const atk = Number(slot?.evs?.atk) || 0;
  const spa = Number(slot?.evs?.spa) || 0;
  const hp = Number(slot?.evs?.hp) || 0;
  const def = Number(slot?.evs?.def) || 0;
  const spd = Number(slot?.evs?.spd) || 0;
  const bulk = hp + def + spd;
  const speed = Number(slot?.evs?.spe) || 0;

  if (atk >= 180 && atk >= spa + 60) return "physique";
  if (spa >= 180 && spa >= atk + 60) return "speciale";
  if (bulk >= 420 || speed < 128) return "support";
  return atk >= spa ? "physique" : "speciale";
}

function getTeamBuilderSlotSelectedMoveTypes(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) return [];

  const movePool = getTeamBuilderMovePool(slot);
  const moveTypes = [];
  const seen = new Set();

  (slot.moves || []).forEach((moveName) => {
    if (!moveName) return;
    const move = movePool.find((entry) => entry.name === moveName);
    const type = Array.isArray(move?.types) && move.types.length
      ? move.types[0]
      : null;
    if (!type || seen.has(type)) return;
    seen.add(type);
    moveTypes.push(type);
  });

  return moveTypes;
}

function getTeamBuilderSuggestedTypes(synthesis, filledSlots) {
  const existingTypes = new Set();
  filledSlots.forEach(({ types }) => types.forEach((type) => existingTypes.add(type)));

  return Object.keys(TYPE_EFFECTIVENESS)
    .filter((candidate) => !existingTypes.has(candidate))
    .map((candidate) => {
      const weaknessHelp = (synthesis.weaknesses || []).reduce((sum, row) => {
        const multiplier = attackMultiplier(row.type, candidate);
        if (multiplier === 0) return sum + 4;
        if (multiplier < 1) return sum + 3;
        return sum;
      }, 0);
      const blindSpotHelp = (synthesis.offenseBlindSpots || []).reduce((sum, row) => {
        const offensiveMultiplier = attackMultiplier(candidate, row.type);
        if (offensiveMultiplier > 1) return sum + 3;
        if (offensiveMultiplier === 1) return sum + 1;
        return sum;
      }, 0);
      const duplicatePenalty = existingTypes.has(candidate) ? 4 : 0;
      const score = weaknessHelp + blindSpotHelp - duplicatePenalty;
      return { type: candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);
}

function getTeamBuilderSlotDefenseProfile(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) {
    return {
      weaknesses: [],
      resistances: [],
      immunities: [],
    };
  }

  const defendingTypes = [pokemon.type1, pokemon.type2].filter(Boolean);
  const rows = Object.keys(TYPE_EFFECTIVENESS).map((attackType) => {
    const multiplier = defendingTypes.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1);
    return { type: attackType, multiplier };
  });

  return {
    weaknesses: rows.filter((row) => row.multiplier > 1).sort((a, b) => b.multiplier - a.multiplier || a.type.localeCompare(b.type, "fr")).slice(0, 4),
    resistances: rows.filter((row) => row.multiplier > 0 && row.multiplier < 1).sort((a, b) => a.multiplier - b.multiplier || a.type.localeCompare(b.type, "fr")).slice(0, 4),
    immunities: rows.filter((row) => row.multiplier === 0).sort((a, b) => a.type.localeCompare(b.type, "fr")).slice(0, 3),
  };
}

function getTeamBuilderInternalCoverage(filledSlots) {
  const links = [];
  filledSlots.forEach((entry, index) => {
    const defense = getTeamBuilderSlotDefenseProfile(entry.slot);
    defense.weaknesses.forEach((weakness) => {
      const cover = filledSlots.find((candidate, candidateIndex) => {
        if (candidateIndex === index) return false;
        const candidateDefense = getTeamBuilderSlotDefenseProfile(candidate.slot);
        return candidateDefense.immunities.some((row) => row.type === weakness.type)
          || candidateDefense.resistances.some((row) => row.type === weakness.type);
      });
      if (!cover) return;
      links.push({
        weakTo: weakness.type,
        source: entry.pokemon.name,
        cover: cover.pokemon.name,
      });
    });
  });

  const seen = new Set();
  return links.filter((entry) => {
    const key = `${entry.source}:${entry.weakTo}:${entry.cover}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function getTeamBuilderSlotRoleData(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) {
    return {
      primary: "Slot vide",
      chips: [],
      bucket: "empty",
    };
  }

  const movePool = getTeamBuilderMovePool(slot);
  const selectedMoves = (slot.moves || [])
    .filter(Boolean)
    .map((moveName) => movePool.find((entry) => entry.name === moveName))
    .filter(Boolean);
  const stats = {
    hp: Number(slot?.evs?.hp) || 0,
    atk: Number(slot?.evs?.atk) || 0,
    def: Number(slot?.evs?.def) || 0,
    spa: Number(slot?.evs?.spa) || 0,
    spd: Number(slot?.evs?.spd) || 0,
    spe: Number(slot?.evs?.spe) || 0,
  };
  const bulk = stats.hp + stats.def + stats.spd;
  const speed = stats.spe;
  const attackBias = stats.atk - stats.spa;
  const supportMoves = ["Atterrissage", "Repos", "Abri", "Danse-Lames", "Mur Lumière", "Protection", "Reflet", "Toxik", "Vœu Soin"];
  const supportCount = selectedMoves.filter((move) => supportMoves.includes(move.name)).length;
  const selectedMoveTypes = getTeamBuilderSlotSelectedMoveTypes(slot);
  const stabCount = selectedMoves.filter((move) => move.types?.some((type) => type === pokemon.type1 || type === pokemon.type2)).length;
  const coverageCount = selectedMoveTypes.filter((type) => type !== pokemon.type1 && type !== pokemon.type2).length;

  let primary = "Pivot";
  let bucket = "pivot";
  if (supportCount >= 2 || (bulk >= 340 && speed <= 80)) {
    primary = "Support";
    bucket = "support";
  } else if (speed >= 180 && (stats.atk >= 180 || stats.spa >= 180)) {
    primary = "Revenge killer";
    bucket = "speed";
  } else if (stats.atk >= 220 && attackBias >= 40) {
    primary = "Sweeper physique";
    bucket = "physical";
  } else if (stats.spa >= 220 && attackBias <= -40) {
    primary = "Sweeper spécial";
    bucket = "special";
  } else if (bulk >= 430) {
    primary = "Tank";
    bucket = "tank";
  } else if (coverageCount >= 2 && stabCount >= 1) {
    primary = "Breaker";
    bucket = "breaker";
  }

  const chips = [];
  if (stabCount >= 2) chips.push("Double STAB");
  else if (stabCount >= 1) chips.push("STAB fiable");
  if (coverageCount >= 2) chips.push("Bonne couverture");
  else if (coverageCount === 1) chips.push("Couverture simple");
  if (speed >= 180) chips.push("Rapide");
  if (bulk >= 430) chips.push("Solide");
  if (supportCount >= 1) chips.push("Outil utile");

  return {
    primary,
    chips: chips.slice(0, 3),
    bucket,
  };
}

function getTeamBuilderTeamSynthesis() {
  const filledSlots = [];
  const typeCounts = new Map();
  const offenseCounts = { physique: 0, speciale: 0, support: 0 };
  const roleCounts = new Map();
  let moveCount = 0;
  let fastPressureCount = 0;
  let offensivePressureCount = 0;
  const selectedMoveTypes = new Set();

  for (const slot of teamBuilderState) {
    if (!slot) continue;
    moveCount += slot.moves.filter(Boolean).length;

    const pokemon = getTeamBuilderPokemon(slot);
    if (!pokemon) continue;

    const types = [pokemon.type1, pokemon.type2].filter(Boolean);
    filledSlots.push({ slot, pokemon, types });

    types.forEach((type) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    const bucket = getTeamBuilderOffenseBucket(slot);
    offenseCounts[bucket] += 1;

    const role = getTeamBuilderSlotRoleData(slot);
    roleCounts.set(role.primary, (roleCounts.get(role.primary) || 0) + 1);
    if (["speed", "physical", "special", "breaker"].includes(role.bucket)) offensivePressureCount += 1;
    if (["speed", "physical", "special"].includes(role.bucket)) fastPressureCount += 1;

    getTeamBuilderSlotSelectedMoveTypes(slot).forEach((type) => selectedMoveTypes.add(type));
  }

  const attackTypes = Object.keys(TYPE_EFFECTIVENESS);
  const teamMatchups = attackTypes.map((attackType) => {
    const multipliers = filledSlots.map(({ types }) => {
      if (!types.length) return 1;
      return types.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1);
    });
    const weakCount = multipliers.filter((multiplier) => multiplier > 1).length;
    const resistCount = multipliers.filter((multiplier) => multiplier > 0 && multiplier < 1).length;
    const immuneCount = multipliers.filter((multiplier) => multiplier === 0).length;
    const coverageScore = resistCount + immuneCount * 2;
    const threatScore = weakCount * 3 + (multipliers.length ? Math.max(...multipliers) : 0);
    const maxMultiplier = multipliers.length ? Math.max(...multipliers) : 0;
    return {
      type: attackType,
      weakCount,
      resistCount,
      immuneCount,
      coverageScore,
      threatScore,
      maxMultiplier,
    };
  });

  const weaknesses = teamMatchups
    .filter((row) => row.weakCount > 0)
    .sort((a, b) => b.threatScore - a.threatScore || b.weakCount - a.weakCount || b.maxMultiplier - a.maxMultiplier || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const coverage = teamMatchups
    .filter((row) => row.coverageScore > 0)
    .sort((a, b) => b.coverageScore - a.coverageScore || b.immuneCount - a.immuneCount || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const duplicates = [...typeCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));

  const offensiveCoverage = attackTypes
    .map((defenseType) => {
      const superCount = [...selectedMoveTypes].filter((attackType) => attackMultiplier(attackType, defenseType) > 1).length;
      const immuneCount = [...selectedMoveTypes].filter((attackType) => attackMultiplier(attackType, defenseType) === 0).length;
      const neutralCount = [...selectedMoveTypes].filter((attackType) => attackMultiplier(attackType, defenseType) === 1).length;
      return {
        type: defenseType,
        superCount,
        immuneCount,
        neutralCount,
      };
    })
    .sort((a, b) => b.superCount - a.superCount || a.immuneCount - b.immuneCount || a.type.localeCompare(b.type, "fr"));

  const bestOffense = offensiveCoverage
    .filter((row) => row.superCount > 0)
    .slice(0, 4);

  const offenseBlindSpots = offensiveCoverage
    .filter((row) => row.superCount === 0)
    .sort((a, b) => a.neutralCount - b.neutralCount || b.immuneCount - a.immuneCount || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const synthesis = {
    filledCount: filledSlots.length,
    distinctTypeCount: typeCounts.size,
    moveCount,
    offenseCounts,
    fastPressureCount,
    offensivePressureCount,
    weaknesses,
    coverage,
    duplicates,
    selectedMoveTypeCount: selectedMoveTypes.size,
    bestOffense,
    offenseBlindSpots,
    roleSummary: [...roleCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
      .slice(0, 4),
    internalCoverage: getTeamBuilderInternalCoverage(filledSlots),
  };
  synthesis.suggestedTypes = getTeamBuilderSuggestedTypes(synthesis, filledSlots);

  return synthesis;
}

function getTeamBuilderPokemonCatalog() {
  return [...POKEMON_LIST].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function getTeamBuilderPokemonApiKey(pokemon) {
  if (!pokemon) return null;
  if (FORM_API_NAME_BY_NAME[pokemon.name]) return FORM_API_NAME_BY_NAME[pokemon.name];
  const baseId = Number.isInteger(pokemon.baseId) && pokemon.baseId > 0 ? pokemon.baseId : null;
  const spriteId = Number.isInteger(getPokemonSpriteId(pokemon)) && getPokemonSpriteId(pokemon) > 0 ? getPokemonSpriteId(pokemon) : null;
  return String(baseId || spriteId || "");
}

function getTeamBuilderPokemonTalentCacheKey(pokemon) {
  return getTeamBuilderPokemonApiKey(pokemon) || `pokemon-${pokemon?.id || "unknown"}`;
}

function getTeamBuilderPokemonNatureOptions() {
  return TEAM_BUILDER_NATURES;
}

function getTeamBuilderNatureLabel(value) {
  return TEAM_BUILDER_NATURES.find((nature) => nature.value === value)?.label || "Hardi (neutre)";
}

function getTeamBuilderNatureModifiers(natureValue) {
  const modifiers = { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 };
  const nature = TEAM_BUILDER_NATURE_EFFECTS[natureValue];
  if (!nature) return modifiers;
  if (nature.up && modifiers[nature.up] != null) modifiers[nature.up] = 1.1;
  if (nature.down && modifiers[nature.down] != null) modifiers[nature.down] = 0.9;
  return modifiers;
}

function getTeamBuilderSpreadPreset(presets, value) {
  return presets.find((preset) => preset.value === value) || presets[0];
}

function cloneTeamBuilderSpread(spread) {
  return normalizeTeamBuilderSpread(spread, 0, 0, 999);
}

function formatTeamBuilderSpreadShort(spread) {
  if (!spread) return "0 / 0 / 0 / 0 / 0 / 0";
  return [spread.hp, spread.atk, spread.def, spread.spa, spread.spd, spread.spe].map((n) => String(Number(n) || 0)).join(" / ");
}

function applyTeamBuilderSpreadPreset(slot, presetValue, kind) {
  const presets = kind === "iv" ? TEAM_BUILDER_IV_PRESETS : TEAM_BUILDER_EV_PRESETS;
  const preset = getTeamBuilderSpreadPreset(presets, presetValue);
  if (!slot || !preset) return;

  if (kind === "iv") {
    slot.ivPreset = preset.value;
    if (preset.spread) slot.ivs = cloneTeamBuilderSpread(preset.spread);
  } else {
    slot.evPreset = preset.value;
    if (preset.spread) slot.evs = cloneTeamBuilderSpread(preset.spread);
  }
}

async function fetchTeamBuilderPokemonApiData(pokemon) {
  const key = getTeamBuilderPokemonApiKey(pokemon);
  if (!key) return null;
  const cacheKey = `team-builder:${key}`;
  if (POKEDEX_API_CACHE.has(cacheKey)) return POKEDEX_API_CACHE.get(cacheKey);

  try {
    const data = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon/${key}`);
    POKEDEX_API_CACHE.set(cacheKey, data);
    return data;
  } catch (_err) {
    return null;
  }
}

async function getTeamBuilderTalentOptions(pokemonData) {
  const abilities = Array.isArray(pokemonData?.abilities) ? pokemonData.abilities : [];
  if (!abilities.length) {
    return [{ value: "", label: "Talent principal" }];
  }
  return Promise.all(
    abilities
      .slice()
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map(async (entry, index) => {
        const abilityData = await fetchPokedexAbilityData(entry.ability?.url);
        const fr = abilityNameFr(abilityData);
        const raw = entry.ability?.name || `talent-${index + 1}`;
        const fallback = raw
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const label = fr || fallback;
        return {
          value: label,
          label: entry.is_hidden ? `${label} (caché)` : label,
        };
      })
  );
}

const TEAM_BUILDER_MOVE_TYPE_LABELS = {
  normal: "Normal",
  fire: "Feu",
  water: "Eau",
  electric: "Électrik",
  grass: "Plante",
  ice: "Glace",
  fighting: "Combat",
  poison: "Poison",
  ground: "Sol",
  flying: "Vol",
  psychic: "Psy",
  bug: "Insecte",
  rock: "Roche",
  ghost: "Spectre",
  dragon: "Dragon",
  dark: "Ténèbres",
  steel: "Acier",
  fairy: "Fée",
};

function typeLabelFrFromApiName(typeName) {
  return TEAM_BUILDER_MOVE_TYPE_LABELS[typeName] || String(typeName || "").replace(/^\w/, (c) => c.toUpperCase());
}

function moveNameFr(moveData) {
  if (!moveData?.names) return null;
  const fr = moveData.names.find((entry) => entry?.language?.name === "fr");
  return fr?.name || null;
}

function moveMethodRank(methodName) {
  const normalized = String(methodName || "");
  if (normalized === "level-up") return 0;
  if (normalized === "machine") return 1;
  if (normalized === "tutor") return 2;
  if (normalized === "egg") return 3;
  return 4;
}

function getTeamBuilderMoveCacheKey(pokemon) {
  return `team-builder-moves:${getTeamBuilderPokemonApiKey(pokemon) || pokemon?.id || "unknown"}`;
}

async function fetchPokedexMoveData(url) {
  if (typeof url !== "string" || !url) return null;
  if (POKEDEX_API_CACHE.has(url)) return POKEDEX_API_CACHE.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_API_CACHE.set(url, data);
    return data;
  } catch (_err) {
    return null;
  }
}

function buildTeamBuilderFallbackMovePool(pokemon) {
  const templateMoves = getTeamBuilderTemplateMovePool(pokemon);
  if (templateMoves.length) return templateMoves;

  const selectedTypes = pokemon ? [pokemon.type1, pokemon.type2].filter(Boolean) : [];
  const pool = TEAM_BUILDER_MOVE_LIBRARY.filter((move) => {
    if (!pokemon) return false;
    if (!Array.isArray(move?.types) || !move.types.length) return true;
    return move.types.some((type) => selectedTypes.includes(type));
  });
  const priority = new Map([
    ["Feu", 0],
    ["Eau", 1],
    ["Plante", 2],
    ["Électrik", 3],
    ["Glace", 4],
    ["Combat", 5],
    ["Dragon", 6],
    ["Ténèbres", 7],
    ["Psy", 8],
    ["Vol", 9],
    ["Fée", 10],
    ["Acier", 11],
    ["Poison", 12],
    ["Sol", 13],
    ["Spectre", 14],
    ["Roche", 15],
    ["Insecte", 16],
    ["Utilitaire", 50],
  ]);

  return pool.slice().sort((a, b) => {
    const score = (move) => {
      if (!selectedTypes.length) return move.types.length ? 2 : 1;
      if (!move.types.length) return 1;
      if (move.types.some((type) => selectedTypes.includes(type))) return 0;
      return 2;
    };
    const pa = score(a);
    const pb = score(b);
    const ta = a.types.length ? Math.min(...a.types.map((type) => priority.get(type) ?? 40)) : 99;
    const tb = b.types.length ? Math.min(...b.types.map((type) => priority.get(type) ?? 40)) : 99;
    return pa - pb || ta - tb || a.name.localeCompare(b.name, "fr");
  });
}

function getTeamBuilderTemplateMovePool(pokemon) {
  const pokemonId = Number(pokemon?.id);
  if (!Number.isInteger(pokemonId)) return [];

  const names = new Set();
  for (const template of TEAM_LIBRARY_TEMPLATES) {
    for (const slot of template?.slots || []) {
      if (Number(slot?.pokemonId) !== pokemonId) continue;
      for (const moveName of slot.moves || []) {
        if (moveName) names.add(moveName);
      }
    }
  }

  return [...names]
    .map((name) => {
      const entry = TEAM_BUILDER_MOVE_LIBRARY.find((move) => move.name === name);
      if (entry) return entry;
      return { name, types: [] };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

async function getTeamBuilderMovePoolForPokemon(pokemon) {
  const cacheKey = getTeamBuilderMoveCacheKey(pokemon);
  if (TEAM_BUILDER_MOVE_POOL_CACHE.has(cacheKey)) return TEAM_BUILDER_MOVE_POOL_CACHE.get(cacheKey);
  if (TEAM_BUILDER_MOVE_POOL_PENDING.has(cacheKey)) return TEAM_BUILDER_MOVE_POOL_PENDING.get(cacheKey);

  const promise = (async () => {
    const pokemonData = await fetchTeamBuilderPokemonApiData(pokemon);
    const fallback = buildTeamBuilderFallbackMovePool(pokemon);
    if (!pokemonData?.moves?.length) return fallback;

    const seen = new Map();
    for (const entry of pokemonData.moves) {
      const moveUrl = entry?.move?.url;
      const moveName = entry?.move?.name;
      const details = Array.isArray(entry?.version_group_details) ? entry.version_group_details : [];
      if (!moveUrl || !details.length) continue;

      const bestDetail = details
        .slice()
        .sort((a, b) => moveMethodRank(a?.move_learn_method?.name) - moveMethodRank(b?.move_learn_method?.name) || Number(a?.level_learned_at || 0) - Number(b?.level_learned_at || 0))[0];
      const rank = moveMethodRank(bestDetail?.move_learn_method?.name);
      const level = Number(bestDetail?.level_learned_at || 0);
      const prev = seen.get(moveUrl);
      if (prev && prev.rank <= rank && prev.level <= level) continue;
      seen.set(moveUrl, { moveUrl, moveName, rank, level });
    }

    const pokemonTypes = new Set([pokemon?.type1, pokemon?.type2].filter(Boolean));
    const moves = await Promise.all(
      [...seen.values()].map(async (entry) => {
        const moveData = await fetchPokedexMoveData(entry.moveUrl);
        const frName = moveNameFr(moveData);
        const rawName = entry.moveName || "Attaque";
        const fallbackName = rawName.charAt(0).toUpperCase() + rawName.slice(1).replace(/-/g, " ");
        const typeApi = moveData?.type?.name || "";
        const typeFr = typeLabelFrFromApiName(typeApi);
        const typeMatches = pokemonTypes.has(typeFr);
        return {
          name: frName || fallbackName,
          types: typeFr ? [typeFr] : [],
          rank: entry.rank,
          level: entry.level,
          typeMatches,
        };
      })
    );

    const unique = new Map();
    for (const move of moves) {
      if (!move?.name) continue;
      const prev = unique.get(move.name);
      if (!prev) {
        unique.set(move.name, move);
        continue;
      }
      if (move.rank < prev.rank || (move.rank === prev.rank && move.level < prev.level)) {
        unique.set(move.name, move);
      }
    }

    const sorted = [...unique.values()].sort((a, b) => {
      const typeScore = (move) => (move.typeMatches ? 0 : move.types.length ? 1 : 2);
      const rankScore = a.rank - b.rank || a.level - b.level;
      return typeScore(a) - typeScore(b) || rankScore || a.name.localeCompare(b.name, "fr");
    });

    return sorted.length ? sorted.slice(0, 48) : fallback;
  })();

  TEAM_BUILDER_MOVE_POOL_PENDING.set(cacheKey, promise);
  try {
    const result = await promise;
    TEAM_BUILDER_MOVE_POOL_CACHE.set(cacheKey, result);
    return result;
  } finally {
    TEAM_BUILDER_MOVE_POOL_PENDING.delete(cacheKey);
  }
}

function getTeamBuilderMovePool(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) return [];
  const cacheKey = getTeamBuilderMoveCacheKey(pokemon);
  return TEAM_BUILDER_MOVE_POOL_CACHE.get(cacheKey) || buildTeamBuilderFallbackMovePool(pokemon);
}

function sanitizeTeamBuilderSlotMoves(slot, movePool) {
  if (!slot) return false;
  const allowed = new Set(movePool.map((move) => move.name));
  let changed = false;
  slot.moves = slot.moves.map((move) => {
    if (!move) return "";
    if (!allowed.has(move)) {
      changed = true;
      return "";
    }
    return move;
  });
  return changed;
}

function renderTeamBuilderSummary() {
  const summary = document.getElementById("team-builder-summary");
  if (!summary) return;

  const synthesis = getTeamBuilderTeamSynthesis();
  const renderChip = (label, value) => `
    <span class="home-builder-summary-chip">
      ${escapeHtml(label)}: <b>${escapeHtml(value)}</b>
    </span>
  `;
  const renderTypeChip = (type, meta) => `
    <span class="home-analysis-chip">
      <b>${escapeHtml(type)}</b>
      <small>${escapeHtml(meta)}</small>
    </span>
  `;
  const defensiveCoverageScore = synthesis.coverage.reduce((sum, row) => sum + row.resistCount + (row.immuneCount * 2), 0);
  const immunityTotal = synthesis.coverage.reduce((sum, row) => sum + row.immuneCount, 0);
  const speedPressureLabel = synthesis.fastPressureCount >= 3 ? "Bonne pression vitesse" : synthesis.fastPressureCount >= 1 ? "Vitesse partielle" : "Vitesse limitée";
  const offenseBalanceLabel = synthesis.offenseCounts.physique && synthesis.offenseCounts.speciale
    ? "Mix physique / spécial"
    : synthesis.offenseCounts.physique
      ? "Orientation physique"
      : synthesis.offenseCounts.speciale
        ? "Orientation spéciale"
        : "Support dominant";

  const threatsHtml = synthesis.weaknesses.length
    ? synthesis.weaknesses
        .map((row) => renderTypeChip(row.type, row.weakCount === 1 ? "1 faiblesse" : `${row.weakCount} faiblesses`))
        .join("")
    : '<span class="home-type-helper-empty">Aucune faiblesse marquée.</span>';

  const coverageHtml = synthesis.coverage.length
    ? synthesis.coverage
        .map((row) => {
          const parts = [];
          if (row.resistCount) parts.push(`${row.resistCount} résistance${row.resistCount > 1 ? "s" : ""}`);
          if (row.immuneCount) parts.push(`${row.immuneCount} immunité${row.immuneCount > 1 ? "s" : ""}`);
          return renderTypeChip(row.type, parts.join(" + ") || "Couverture");
        })
        .join("")
    : '<span class="home-type-helper-empty">Aucune couverture notable.</span>';

  const duplicatesHtml = synthesis.duplicates.length
    ? synthesis.duplicates.map(([type, count]) => renderTypeChip(type, `x${count}`)).join("")
    : '<span class="home-type-helper-empty">Aucun doublon évident.</span>';

  const bestOffenseHtml = synthesis.bestOffense.length
    ? synthesis.bestOffense
        .map((row) => renderTypeChip(row.type, row.superCount === 1 ? "1 attaque forte" : `${row.superCount} attaques fortes`))
        .join("")
    : '<span class="home-type-helper-empty">Aucune couverture offensive claire.</span>';

  const blindSpotsHtml = synthesis.offenseBlindSpots.length
    ? synthesis.offenseBlindSpots
        .map((row) => renderTypeChip(row.type, row.immuneCount ? "attention aux immunités" : "peu de pression"))
        .join("")
    : '<span class="home-type-helper-empty">Aucun angle mort marqué.</span>';

  const suggestedTypesHtml = synthesis.suggestedTypes.length
    ? synthesis.suggestedTypes
        .map((row) => renderTypeChip(row.type, "à envisager"))
        .join("")
    : '<span class="home-type-helper-empty">Aucune suggestion claire.</span>';

  const roleSummaryHtml = synthesis.roleSummary.length
    ? synthesis.roleSummary
        .map(([role, count]) => renderTypeChip(role, count > 1 ? `${count} slots` : "1 slot"))
        .join("")
    : '<span class="home-type-helper-empty">Les rôles se liront ici au fur et à mesure.</span>';

  const internalCoverageHtml = synthesis.internalCoverage.length
    ? synthesis.internalCoverage
        .map((entry) => renderTypeChip(entry.weakTo, `${entry.source} -> ${entry.cover}`))
        .join("")
    : '<span class="home-type-helper-empty">Les relais défensifs apparaîtront ici avec plus de slots remplis.</span>';

  const overviewHtml = `
    <div class="team-builder-overview-groups">
      <div class="team-builder-overview-group is-alert">
        <span class="team-builder-overview-label">Doublons</span>
        <div class="team-builder-synthesis-list">${duplicatesHtml}</div>
      </div>
      <div class="team-builder-overview-group">
        <span class="team-builder-overview-label">Rôles présents</span>
        <div class="team-builder-synthesis-list">${roleSummaryHtml}</div>
      </div>
      <div class="team-builder-overview-group is-suggestion">
        <span class="team-builder-overview-label">Types à envisager</span>
        <div class="team-builder-synthesis-list">${suggestedTypesHtml}</div>
      </div>
    </div>
  `;

  const defensePanelHtml = `
    <div class="team-builder-overview-groups">
      <div class="team-builder-overview-group is-alert">
        <span class="team-builder-overview-label">Faiblesses à surveiller</span>
        <div class="team-builder-synthesis-list">${threatsHtml}</div>
      </div>
      <div class="team-builder-overview-group is-defense">
        <span class="team-builder-overview-label">Couvertures défensives</span>
        <div class="team-builder-synthesis-list">${coverageHtml}</div>
      </div>
      <div class="team-builder-overview-group is-link">
        <span class="team-builder-overview-label">Couvertures internes</span>
        <div class="team-builder-synthesis-list">${internalCoverageHtml}</div>
      </div>
    </div>
  `;

  const offensePanelHtml = `
    <div class="team-builder-overview-groups">
      <div class="team-builder-overview-group is-defense">
        <span class="team-builder-overview-label">Couverture offensive</span>
        <div class="team-builder-synthesis-list">${bestOffenseHtml}</div>
      </div>
      <div class="team-builder-overview-group is-alert">
        <span class="team-builder-overview-label">Angles morts</span>
        <div class="team-builder-synthesis-list">${blindSpotsHtml}</div>
      </div>
      <div class="team-builder-overview-group is-link">
        <span class="team-builder-overview-label">Répartition</span>
        <div class="team-builder-offense-grid">
          <div class="team-builder-offense-stat">
            <span>Physique</span>
            <strong>${synthesis.offenseCounts.physique}</strong>
          </div>
          <div class="team-builder-offense-stat">
            <span>Spécial</span>
            <strong>${synthesis.offenseCounts.speciale}</strong>
          </div>
          <div class="team-builder-offense-stat">
            <span>Support</span>
            <strong>${synthesis.offenseCounts.support}</strong>
          </div>
        </div>
      </div>
    </div>
  `;

  summary.innerHTML = `
    <div class="team-builder-summary-top">
      ${renderChip("Slots", `${synthesis.filledCount}/6`)}
      ${renderChip("Types présents", String(synthesis.distinctTypeCount))}
      ${renderChip("Attaques", `${synthesis.moveCount}/24`)}
      ${renderChip("Types offensifs", String(synthesis.selectedMoveTypeCount))}
      ${renderChip("Immunités", String(immunityTotal))}
      ${renderChip("Pression vitesse", speedPressureLabel)}
    </div>
    <div class="team-builder-synthesis-grid">
      <section class="team-builder-synthesis-card">
        <div class="team-builder-synthesis-head">
          <h5>Vue d’ensemble équipe</h5>
          <p>Lecture rapide de la construction actuelle et des grands repères de team.</p>
        </div>
        ${overviewHtml}
      </section>
      <details class="team-builder-analysis-more">
        <summary class="team-builder-analysis-summary">🔎 Voir l'analyse détaillée</summary>
      <section class="team-builder-synthesis-card">
        <div class="team-builder-synthesis-head">
          <h5>Couvertures et faiblesses</h5>
          <p>Ce que la team encaisse déjà bien, et les types encore les plus dangereux.</p>
        </div>
        <div class="team-builder-summary-mini-grid">
          <div class="team-builder-summary-mini-stat">
            <span>Faiblesses visibles</span>
            <strong>${synthesis.weaknesses.length}</strong>
          </div>
          <div class="team-builder-summary-mini-stat">
            <span>Résistances / immunités</span>
            <strong>${defensiveCoverageScore}</strong>
          </div>
        </div>
        ${defensePanelHtml}
      </section>
      <section class="team-builder-synthesis-card">
        <div class="team-builder-synthesis-head">
          <h5>Rôles et angles morts</h5>
          <p>Répartition offensive actuelle, menaces bien pressées et points encore faibles.</p>
        </div>
        <div class="team-builder-summary-mini-grid">
          <div class="team-builder-summary-mini-stat">
            <span>Équilibre</span>
            <strong>${escapeHtml(offenseBalanceLabel)}</strong>
          </div>
          <div class="team-builder-summary-mini-stat">
            <span>Pression offensive</span>
            <strong>${synthesis.offensivePressureCount}/6</strong>
          </div>
        </div>
        ${offensePanelHtml}
      </section>
      </details>
    </div>
  `;
}

function renderTeamBuilderGrid() {
  const grid = document.getElementById("team-builder-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const nextEmptySlotIndex = teamBuilderState.findIndex((slot) => !Number.isInteger(Number(slot?.pokemonId)));
  const activeSlotHasPokemon = Boolean(getTeamBuilderPokemon(teamBuilderState[teamBuilderActiveSlot]));

  teamBuilderState.forEach((slot, index) => {
    const pokemon = getTeamBuilderPokemon(slot);
    const card = document.createElement("button");
    card.type = "button";
    const isActive = index === teamBuilderActiveSlot;
    const isNextEmpty = !activeSlotHasPokemon && nextEmptySlotIndex !== -1 && index === nextEmptySlotIndex;
    card.className =
      "home-builder-slot" +
      (isActive ? " is-active" : "") +
      (pokemon ? " is-filled" : "") +
      (isNextEmpty ? " is-next-empty" : "");
    card.addEventListener("click", () => {
      teamBuilderActiveSlot = index;
      renderTeamBuilderModule();
    });

    const head = document.createElement("div");
    head.className = "home-builder-slot-head";
    let slotStatus = pokemon ? "Actif" : "Vide";
    if (isNextEmpty && !isActive) slotStatus = "Suivant";
    if (isNextEmpty && isActive) slotStatus = "À remplir";
    head.innerHTML = `<span>Slot ${index + 1}</span><small>${slotStatus}</small>`;

    const body = document.createElement("div");
    body.className = "home-builder-slot-body";
    if (pokemon) {
      const role = getTeamBuilderSlotRoleData(slot);
      const img = document.createElement("img");
      img.src = getPokemonSprite(pokemon);
      img.alt = pokemon.name;
      img.loading = "lazy";

      const info = document.createElement("div");
      info.className = "home-builder-slot-info";
      info.innerHTML = `
        <strong>${escapeHtml(pokemon.name)}</strong>
        <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        <div class="team-builder-role-line">
          <span class="team-builder-role-badge">${escapeHtml(role.primary)}</span>
          ${role.chips[0] ? `<span class="team-builder-role-chip">${escapeHtml(role.chips[0])}</span>` : ""}
        </div>
        <small>${slot.moves.filter(Boolean).length} attaque(s)</small>
      `;

      body.appendChild(img);
      body.appendChild(info);
    } else {
      body.innerHTML = '<span class="home-builder-slot-empty">Ajoute un Pokémon</span>';
    }

    card.appendChild(head);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function buildTeamBuilderOptions() {
  const itemSelect = document.getElementById("team-builder-item");
  const gimmickSelect = document.getElementById("team-builder-gimmick");
  const teraSelect = document.getElementById("team-builder-tera-type");

  const fillSelect = (select, values, allowEmptyLabel) => {
    if (!select || select.dataset.ready) return;
    select.innerHTML = [
      `<option value="">${escapeHtml(allowEmptyLabel)}</option>`,
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
    ].join("");
    select.dataset.ready = "1";
  };

  fillSelect(itemSelect, TEAM_BUILDER_ITEMS.filter((item) => item !== "Aucun"), "Aucun");
  fillSelect(gimmickSelect, TEAM_BUILDER_GIMMICKS.filter((gimmick) => gimmick !== "Aucun"), "Aucun");
  fillSelect(teraSelect, TEAM_BUILDER_TERA_TYPES, "Aucun");
}

function setTeamBuilderPokemonSelection(pokemon) {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot || !pokemon) return;
  slot.pokemonId = pokemon.id;
  teamBuilderPokemonSearch = "";
  teamBuilderPokemonPickerOpen = false;
  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function toggleTeamBuilderPokemonPicker() {
  if (teamBuilderPokemonPickerOpen) closeTeamBuilderPokemonPicker();
  else openTeamBuilderPokemonPicker();
}

function selectTeamBuilderPokemonById(pokemonId) {
  const id = Number(pokemonId);
  const pokemon = Number.isInteger(id) ? POKEMON_BY_ID.get(id) : null;
  if (pokemon) setTeamBuilderPokemonSelection(pokemon);
}

function openTeamBuilderPokemonPicker() {
  teamBuilderPokemonPickerOpen = true;
  renderTeamBuilderModule();
  window.requestAnimationFrame(() => {
    document.getElementById("team-builder-pokemon-search")?.focus();
  });
}

function closeTeamBuilderPokemonPicker() {
  if (!teamBuilderPokemonPickerOpen) return;
  teamBuilderPokemonPickerOpen = false;
  renderTeamBuilderModule();
}

function renderTeamBuilderPokemonPicker() {
  const trigger = document.getElementById("team-builder-pokemon-trigger");
  const triggerPreview = document.getElementById("team-builder-pokemon-trigger-preview");
  const triggerText = document.getElementById("team-builder-pokemon-trigger-text");
  const triggerCta = document.getElementById("team-builder-pokemon-trigger-cta");
  const picker = document.getElementById("team-builder-pokemon-picker");
  const search = document.getElementById("team-builder-pokemon-search");
  const clear = document.getElementById("team-builder-pokemon-clear");
  const results = document.getElementById("team-builder-pokemon-results");
  if (!trigger || !triggerPreview || !triggerText || !triggerCta || !picker || !search || !clear || !results) return;

  const slot = teamBuilderState[teamBuilderActiveSlot];
  const pokemon = getTeamBuilderPokemon(slot);
  const query = teamBuilderPokemonSearch.trim().toLowerCase();
  const catalog = getTeamBuilderPokemonCatalog().filter((entry) => {
    if (!query) return true;
    return entry.name.toLowerCase().includes(query) || [entry.type1, entry.type2].some((type) => type && type.toLowerCase().includes(query));
  });

  trigger.setAttribute("aria-expanded", String(teamBuilderPokemonPickerOpen));
  trigger.classList.toggle("is-empty", !pokemon);
  triggerPreview.innerHTML = pokemon
    ? `<img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" />`
    : `<span class="team-builder-pokemon-trigger-placeholder">?</span>`;
  triggerText.textContent = pokemon ? pokemon.name : "Choisir un Pokémon";
  triggerCta.textContent = pokemon ? "Changer" : "Ouvrir";

  picker.classList.toggle("hidden", !teamBuilderPokemonPickerOpen);
  search.value = teamBuilderPokemonSearch;
  clear.textContent = teamBuilderPokemonSearch ? "Effacer" : pokemon ? "Vider" : "Fermer";

  if (!teamBuilderPokemonPickerOpen) {
    results.innerHTML = "";
    return;
  }

  const visible = catalog.slice(0, 60);
  if (!visible.length) {
    results.innerHTML = '<p class="team-builder-pokemon-empty">Aucun Pokémon trouvé.</p>';
    return;
  }

  results.innerHTML = visible.map((entry) => {
    const isSelected = pokemon?.id === entry.id;
    return `
      <button type="button" class="team-builder-pokemon-card${isSelected ? " is-selected" : ""}" data-pokemon-id="${entry.id}" data-action="selectTeamBuilderPokemonById" data-args='[${entry.id}]'>
        <img src="${getPokemonSprite(entry)}" alt="${escapeHtml(entry.name)}" loading="lazy" />
        <strong>${escapeHtml(entry.name)}</strong>
        <div class="pokemon-card-types">${typeBadgesHtml(entry.type1, entry.type2)}</div>
      </button>
    `;
  }).join("");
}

function fillTeamBuilderSelect(select, values, emptyLabel) {
  if (!select || select.dataset.ready) return;
  select.innerHTML = [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...values.map((entry) => `<option value="${escapeHtml(entry.value || entry)}">${escapeHtml(entry.label || entry)}</option>`),
  ].join("");
  select.dataset.ready = "1";
}

function getTeamBuilderComputedStatBaseMap(pokeData) {
  return {
    hp: statFromPokemonData(pokeData, "hp"),
    atk: statFromPokemonData(pokeData, "attack"),
    def: statFromPokemonData(pokeData, "defense"),
    spa: statFromPokemonData(pokeData, "special-attack"),
    spd: statFromPokemonData(pokeData, "special-defense"),
    spe: statFromPokemonData(pokeData, "speed"),
  };
}

function computeTeamBuilderFinalStats(pokeData, slot, level = 100) {
  const baseStats = getTeamBuilderComputedStatBaseMap(pokeData);
  const evs = normalizeTeamBuilderSpread(slot?.evs, 0, 0, 252);
  const ivs = normalizeTeamBuilderSpread(slot?.ivs, 31, 0, 31);
  const nature = getTeamBuilderNatureModifiers(slot?.nature || "Hardi");
  const finalStats = {};

  ["hp", "atk", "def", "spa", "spd", "spe"].forEach((key) => {
    const base = Number(baseStats[key]);
    if (!Number.isFinite(base)) {
      finalStats[key] = null;
      return;
    }
    const iv = Number(ivs[key]) || 0;
    const ev = Number(evs[key]) || 0;
    const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
    if (key === "hp") {
      finalStats.hp = core + level + 10;
    } else {
      finalStats[key] = Math.floor((core + 5) * (nature[key] || 1));
    }
  });

  finalStats.total = ["hp", "atk", "def", "spa", "spd", "spe"].reduce((sum, key) => {
    return sum + (Number.isFinite(finalStats[key]) ? finalStats[key] : 0);
  }, 0);
  return finalStats;
}

function renderTeamBuilderComputedStatsContent(content) {
  const root = document.getElementById("team-builder-computed-stats");
  if (!root) return;
  root.innerHTML = content;
}

function renderTeamBuilderComputedStats() {
  const root = document.getElementById("team-builder-computed-stats");
  if (!root) return;

  const slot = teamBuilderState[teamBuilderActiveSlot];
  const pokemon = getTeamBuilderPokemon(slot);
  const header = `
    <div class="team-builder-computed-stats-head">
      <div>
        <h5>Stats finales</h5>
        <p>Calcul au niveau 50 (standard VGC / Champions) selon base stats, nature, EV et IV.</p>
      </div>
      <span class="home-coming-badge">Niv. 50</span>
    </div>
  `;

  if (!pokemon) {
    renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Choisis un Pokémon pour voir ses stats finales.</p>`);
    return;
  }

  renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Calcul des stats de ${escapeHtml(pokemon.name)}…</p>`);

  const activeSlotIndex = teamBuilderActiveSlot;
  const activePokemonId = pokemon.id;
  fetchTeamBuilderPokemonApiData(pokemon).then((data) => {
    const currentSlot = teamBuilderState[activeSlotIndex];
    const currentPokemon = getTeamBuilderPokemon(currentSlot);
    if (activeSlotIndex !== teamBuilderActiveSlot || !currentPokemon || currentPokemon.id !== activePokemonId) return;

    const finalStats = computeTeamBuilderFinalStats(data, currentSlot, 50);
    const hasStats = ["hp", "atk", "def", "spa", "spd", "spe"].some((key) => Number.isFinite(finalStats[key]));
    if (!hasStats) {
      renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Stats indisponibles pour ce Pokémon pour l’instant.</p>`);
      return;
    }

    const statsHtml = [
      { key: "hp", label: "PV", max: 230 },
      { key: "atk", label: "Attaque", max: 230 },
      { key: "def", label: "Défense", max: 230 },
      { key: "spa", label: "Att. Spé.", max: 230 },
      { key: "spd", label: "Déf. Spé.", max: 230 },
      { key: "spe", label: "Vitesse", max: 230 },
    ].map((entry) => {
      const value = Number.isFinite(finalStats[entry.key]) ? finalStats[entry.key] : "—";
      const ratio = Number.isFinite(finalStats[entry.key]) ? Math.max(0, Math.min(1, finalStats[entry.key] / entry.max)) : 0;
      return `
        <div class="team-builder-computed-stat">
          <span>${entry.label}</span>
          <strong>${value}</strong>
          <i><b style="width:${Math.round(ratio * 100)}%"></b></i>
        </div>
      `;
    }).join("");

    renderTeamBuilderComputedStatsContent(`
      ${header}
      <div class="team-builder-computed-stats-grid">${statsHtml}</div>
      <div class="team-builder-computed-stats-total">
        <span>Total estimé</span>
        <strong>${finalStats.total}</strong>
      </div>
    `);
  }).catch(() => {
    const currentSlot = teamBuilderState[activeSlotIndex];
    const currentPokemon = getTeamBuilderPokemon(currentSlot);
    if (activeSlotIndex !== teamBuilderActiveSlot || !currentPokemon || currentPokemon.id !== activePokemonId) return;
    renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Impossible de récupérer les stats pour ce Pokémon.</p>`);
  });
}

function renderTeamBuilderStrategicFields() {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  const currentRenderVersion = ++teamBuilderStrategicRenderVersion;
  const pokemon = getTeamBuilderPokemon(slot);

  const natureSelect = document.getElementById("team-builder-nature");
  const talentSelect = document.getElementById("team-builder-talent");
  const evPresetSelect = document.getElementById("team-builder-ev-preset");
  const ivPresetSelect = document.getElementById("team-builder-iv-preset");
  const evCustom = document.getElementById("team-builder-ev-custom");
  const ivCustom = document.getElementById("team-builder-iv-custom");
  const evInputs = {
    hp: document.getElementById("team-builder-ev-hp"),
    atk: document.getElementById("team-builder-ev-atk"),
    def: document.getElementById("team-builder-ev-def"),
    spa: document.getElementById("team-builder-ev-spa"),
    spd: document.getElementById("team-builder-ev-spd"),
    spe: document.getElementById("team-builder-ev-spe"),
  };
  const ivInputs = {
    hp: document.getElementById("team-builder-iv-hp"),
    atk: document.getElementById("team-builder-iv-atk"),
    def: document.getElementById("team-builder-iv-def"),
    spa: document.getElementById("team-builder-iv-spa"),
    spd: document.getElementById("team-builder-iv-spd"),
    spe: document.getElementById("team-builder-iv-spe"),
  };

  fillTeamBuilderSelect(natureSelect, TEAM_BUILDER_NATURES, "Nature");
  fillTeamBuilderSelect(evPresetSelect, TEAM_BUILDER_EV_PRESETS, "Preset EV");
  fillTeamBuilderSelect(ivPresetSelect, TEAM_BUILDER_IV_PRESETS, "Preset IV");

  if (natureSelect) natureSelect.value = slot.nature || "Hardi";
  if (evPresetSelect) evPresetSelect.value = slot.evPreset || "offensive-physique";
  if (ivPresetSelect) ivPresetSelect.value = slot.ivPreset || "all31";

  const isEvCustom = slot.evPreset === "custom";
  const isIvCustom = slot.ivPreset === "custom";
  evCustom?.classList.toggle("hidden", !isEvCustom);
  ivCustom?.classList.toggle("hidden", !isIvCustom);

  if (isEvCustom) {
    Object.entries(evInputs).forEach(([key, input]) => {
      if (input) input.value = Number(slot.evs?.[key]) || 0;
    });
  }

  if (isIvCustom) {
    Object.entries(ivInputs).forEach(([key, input]) => {
      if (input) input.value = Number(slot.ivs?.[key]) || 0;
    });
  }

  if (!talentSelect) return;
  talentSelect.innerHTML = '<option value="">Chargement des talents…</option>';
  talentSelect.disabled = true;

  const finalizeTalentOptions = (options) => {
    if (currentRenderVersion !== teamBuilderStrategicRenderVersion) return;
    const validValues = new Set(options.map((option) => option.value));
    const currentValue = validValues.has(slot.talent) ? slot.talent : (options[0]?.value || "");
    if (slot.talent !== currentValue) {
      slot.talent = currentValue;
      saveTeamBuilderState();
    }

    talentSelect.disabled = false;
    talentSelect.innerHTML = [
      '<option value="">Talent principal</option>',
      ...options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
    ].join("");
    talentSelect.value = currentValue;
  };

  if (!pokemon) {
    finalizeTalentOptions([{ value: "", label: "Talent principal" }]);
    return;
  }

  const cacheKey = getTeamBuilderPokemonTalentCacheKey(pokemon);
  if (teamBuilderTalentOptionsCache.has(cacheKey)) {
    finalizeTalentOptions(teamBuilderTalentOptionsCache.get(cacheKey));
    return;
  }

  fetchTeamBuilderPokemonApiData(pokemon).then(async (data) => {
    if (currentRenderVersion !== teamBuilderStrategicRenderVersion) return;
    const options = await getTeamBuilderTalentOptions(data);
    teamBuilderTalentOptionsCache.set(cacheKey, options);
    finalizeTalentOptions(options);
  });
}

function updateTeamBuilderField(field, value, moveIndex = null) {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  if (field === "pokemon") {
    const pokemon = findPokemonGlobalByName(String(value || "").trim());
    slot.pokemonId = pokemon ? pokemon.id : null;
  } else if (field === "item") {
    slot.item = value || "Aucun";
  } else if (field === "gimmick") {
    slot.gimmick = value || "Aucun";
  } else if (field === "teraType") {
    slot.teraType = TEAM_BUILDER_TERA_TYPES.includes(value) ? value : "";
  } else if (field === "move" && Number.isInteger(moveIndex)) {
    const movePool = getTeamBuilderMovePool(slot);
    const allowed = new Set(movePool.map((move) => move.name));
    const nextValue = typeof value === "string" ? value : "";
    slot.moves[moveIndex] = !nextValue || allowed.has(nextValue) ? nextValue : "";
  }

  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function updateTeamBuilderStrategicField(field, value) {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  if (field === "nature") {
    slot.nature = TEAM_BUILDER_NATURES.some((nature) => nature.value === value) ? value : "Hardi";
  } else if (field === "talent") {
    slot.talent = String(value || "");
  } else if (field === "ev-preset") {
    applyTeamBuilderSpreadPreset(slot, String(value || "offensive-physique"), "ev");
  } else if (field === "iv-preset") {
    applyTeamBuilderSpreadPreset(slot, String(value || "all31"), "iv");
  } else if (field === "ev-custom" || field === "iv-custom") {
    const isEv = field === "ev-custom";
    const min = isEv ? 0 : 0;
    const max = isEv ? 252 : 31;
    const next = {
      hp: Number(document.getElementById(isEv ? "team-builder-ev-hp" : "team-builder-iv-hp")?.value) || 0,
      atk: Number(document.getElementById(isEv ? "team-builder-ev-atk" : "team-builder-iv-atk")?.value) || 0,
      def: Number(document.getElementById(isEv ? "team-builder-ev-def" : "team-builder-iv-def")?.value) || 0,
      spa: Number(document.getElementById(isEv ? "team-builder-ev-spa" : "team-builder-iv-spa")?.value) || 0,
      spd: Number(document.getElementById(isEv ? "team-builder-ev-spd" : "team-builder-iv-spd")?.value) || 0,
      spe: Number(document.getElementById(isEv ? "team-builder-ev-spe" : "team-builder-iv-spe")?.value) || 0,
    };
    const normalized = normalizeTeamBuilderSpread(next, isEv ? 0 : 31, min, max);
    if (isEv) {
      slot.evPreset = "custom";
      slot.evs = normalized;
    } else {
      slot.ivPreset = "custom";
      slot.ivs = normalized;
    }
  }

  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function clearTeamBuilderSlot() {
  teamBuilderState[teamBuilderActiveSlot] = createTeamBuilderEmptySlot();
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function renderTeamBuilderEditor() {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  const title = document.getElementById("team-builder-editor-title");
  const sub = document.getElementById("team-builder-editor-sub");
  const identity = document.getElementById("team-builder-editor-identity");
  const itemSelect = document.getElementById("team-builder-item");
  const gimmickSelect = document.getElementById("team-builder-gimmick");
  const teraSelect = document.getElementById("team-builder-tera-type");
  const moveSelects = [
    document.getElementById("team-builder-move-1"),
    document.getElementById("team-builder-move-2"),
    document.getElementById("team-builder-move-3"),
    document.getElementById("team-builder-move-4"),
  ];

  const pokemon = getTeamBuilderPokemon(slot);
  if (title) title.textContent = `Slot ${teamBuilderActiveSlot + 1}`;
  if (sub) sub.textContent = pokemon ? `${pokemon.name} · Clique un autre slot pour l’éditer.` : "Choisis un Pokémon, un objet et une mécanique de slot.";
  if (identity) {
    identity.innerHTML = pokemon ? `
      <div class="team-builder-editor-identity-card">
        <div class="team-builder-editor-identity-visual">
          <img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" />
        </div>
        <div class="team-builder-editor-identity-copy">
          <div class="team-builder-editor-identity-top">
            <span class="team-builder-editor-slot-badge">Slot ${teamBuilderActiveSlot + 1}</span>
            <span class="team-builder-editor-status-badge">Actif</span>
          </div>
          <strong>${escapeHtml(pokemon.name)}</strong>
          <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        </div>
      </div>
    ` : `
      <div class="team-builder-editor-identity-card is-empty">
        <div class="team-builder-editor-identity-copy">
          <div class="team-builder-editor-identity-top">
            <span class="team-builder-editor-slot-badge">Slot ${teamBuilderActiveSlot + 1}</span>
            <span class="team-builder-editor-status-badge">Vide</span>
          </div>
          <strong>Choisis un Pokémon</strong>
          <p>Le slot actif apparaîtra ici avec ses types.</p>
        </div>
      </div>
    `;
  }
  renderTeamBuilderPokemonPicker();
  renderTeamBuilderStrategicFields();
  renderTeamBuilderComputedStats();
  if (itemSelect) itemSelect.value = (slot.item && slot.item !== "Aucun") ? slot.item : "";
  if (gimmickSelect) gimmickSelect.value = (slot.gimmick && slot.gimmick !== "Aucun") ? slot.gimmick : "";
  if (teraSelect) teraSelect.value = slot.teraType || "";
  moveSelects.forEach((select, index) => {
    if (!select) return;
    const field = document.getElementById(`team-builder-move-field-${index + 1}`);
    const state = document.getElementById(`team-builder-move-state-${index + 1}`);
    const clearBtn = field?.querySelector(".team-builder-move-clear");
    const currentMove = slot.moves[index] || "";
    field?.classList.toggle("is-filled", Boolean(currentMove));
    field?.classList.toggle("is-empty", !currentMove);
    clearBtn?.classList.toggle("hidden", !currentMove);
    if (state) state.textContent = currentMove ? `Choisie : ${currentMove}` : "Slot vide";
    select.innerHTML = [
      pokemon ? '<option value="">Chargement des attaques…</option>' : '<option value="">Aucune attaque</option>',
    ].join("");
    select.value = currentMove;
    select.disabled = !pokemon;
  });

  if (!pokemon) return;

  const renderVersion = teamBuilderStrategicRenderVersion;
  getTeamBuilderMovePoolForPokemon(pokemon).then((movePool) => {
    const currentPokemon = getTeamBuilderPokemon(teamBuilderState[teamBuilderActiveSlot]);
    if (renderVersion !== teamBuilderStrategicRenderVersion || !currentPokemon || currentPokemon.id !== pokemon.id) return;
    if (sanitizeTeamBuilderSlotMoves(slot, movePool)) saveTeamBuilderState();
    moveSelects.forEach((select, index) => {
      if (!select) return;
      const field = document.getElementById(`team-builder-move-field-${index + 1}`);
      const state = document.getElementById(`team-builder-move-state-${index + 1}`);
      const clearBtn = field?.querySelector(".team-builder-move-clear");
      const currentMove = slot.moves[index] || "";
      select.disabled = false;
      select.innerHTML = [
        '<option value="">Aucune attaque</option>',
        ...movePool.map((move) => `<option value="${escapeHtml(move.name)}">${escapeHtml(move.name)}${move.types.length ? ` (${escapeHtml(move.types.join(" / "))})` : ""}</option>`),
      ].join("");
      select.value = currentMove;
      field?.classList.toggle("is-filled", Boolean(currentMove));
      field?.classList.toggle("is-empty", !currentMove);
      clearBtn?.classList.toggle("hidden", !currentMove);
      if (state) state.textContent = currentMove ? `Choisie : ${currentMove}` : "Slot vide";
    });
    renderTeamBuilderSummary();
  });
}

function renderTeamBuilderModule() {
  if (!teamBuilderState) loadTeamBuilderState();
  renderTeamBuilderSummary();
  renderTeamBuilderGrid();
  renderTeamBuilderEditor();
  renderTeamBuilderExport();
}

function initTeamBuilderModule() {
  loadTeamBuilderState();
  buildTeamBuilderOptions();
  const moveSelects = [
    document.getElementById("team-builder-move-1"),
    document.getElementById("team-builder-move-2"),
    document.getElementById("team-builder-move-3"),
    document.getElementById("team-builder-move-4"),
  ];

  const root = document.getElementById("screen-team-builder");
  if (root && !root.dataset.delegated) {
    root.dataset.delegated = "1";
    root.addEventListener("click", (event) => {
      const target = event.target;
      const clear = target.closest("#team-builder-pokemon-clear");
      if (clear) {
        event.preventDefault();
        event.stopPropagation();
        const search = document.getElementById("team-builder-pokemon-search");
        if (teamBuilderPokemonPickerOpen && teamBuilderPokemonSearch) {
          teamBuilderPokemonSearch = "";
          renderTeamBuilderPokemonPicker();
          window.requestAnimationFrame(() => search?.focus());
        } else if (teamBuilderPokemonPickerOpen && getTeamBuilderPokemon(teamBuilderState[teamBuilderActiveSlot])) {
          clearTeamBuilderSlot();
        } else {
          closeTeamBuilderPokemonPicker();
        }
        return;
      }

      const card = target.closest("[data-pokemon-id]");
      if (card && root.contains(card)) {
        event.stopPropagation();
        const pokemonId = Number(card.getAttribute("data-pokemon-id"));
        const pokemon = Number.isInteger(pokemonId) ? POKEMON_BY_ID.get(pokemonId) : null;
        if (pokemon) setTeamBuilderPokemonSelection(pokemon);
      }
    });

    root.addEventListener("input", (event) => {
      const target = event.target;
      if (target?.id === "team-builder-pokemon-search") {
        teamBuilderPokemonSearch = target.value;
        renderTeamBuilderPokemonPicker();
      }
      if (target?.matches?.("#team-builder-ev-hp, #team-builder-ev-atk, #team-builder-ev-def, #team-builder-ev-spa, #team-builder-ev-spd, #team-builder-ev-spe")) {
        updateTeamBuilderStrategicField("ev-custom");
      }
      if (target?.matches?.("#team-builder-iv-hp, #team-builder-iv-atk, #team-builder-iv-def, #team-builder-iv-spa, #team-builder-iv-spd, #team-builder-iv-spe")) {
        updateTeamBuilderStrategicField("iv-custom");
      }
    });

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!target?.id) return;
      if (target.id === "team-builder-item") updateTeamBuilderField("item", target.value);
      else if (target.id === "team-builder-gimmick") updateTeamBuilderField("gimmick", target.value);
      else if (target.id === "team-builder-tera-type") updateTeamBuilderField("teraType", target.value);
      else if (target.id === "team-builder-nature") updateTeamBuilderStrategicField("nature", target.value);
      else if (target.id === "team-builder-talent") updateTeamBuilderStrategicField("talent", target.value);
      else if (target.id === "team-builder-ev-preset") updateTeamBuilderStrategicField("ev-preset", target.value);
      else if (target.id === "team-builder-iv-preset") updateTeamBuilderStrategicField("iv-preset", target.value);
      else {
        const moveIndex = ["team-builder-move-1", "team-builder-move-2", "team-builder-move-3", "team-builder-move-4"].indexOf(target.id);
        if (moveIndex >= 0) updateTeamBuilderField("move", target.value, moveIndex);
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!teamBuilderPokemonPickerOpen) return;
    const target = event.target;
    const pickerEl = document.getElementById("team-builder-pokemon-picker");
    const triggerEl = document.getElementById("team-builder-pokemon-trigger");
    if (pickerEl?.contains(target) || triggerEl?.contains(target)) return;
    closeTeamBuilderPokemonPicker();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTeamBuilderPokemonPicker();
  });

  renderTeamBuilderModule();
}

function openTeamBuilderScreen() {
  goToConfig();
  document.getElementById("screen-config").classList.add("hidden");
  document.querySelector(".search-bar")?.classList.add("hidden");
  showScreen("screen-team-builder");
  setGlobalNavActive("champions");
  renderTeamBuilderModule();
  window.requestAnimationFrame(() => {
    document.getElementById("screen-team-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function resetTeamBuilder() {
  teamBuilderState = createTeamBuilderState();
  teamBuilderActiveSlot = 0;
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function getTeamBuilderExportStatLabel(key) {
  const labels = {
    hp: "HP",
    atk: "Atk",
    def: "Def",
    spa: "SpA",
    spd: "SpD",
    spe: "Spe",
  };
  return labels[key] || key;
}

function formatTeamBuilderExportSpread(spread, options = {}) {
  const defaultValue = Number(options.defaultValue);
  const showZeros = Boolean(options.showZeros);
  const parts = ["hp", "atk", "def", "spa", "spd", "spe"]
    .map((key) => {
      const value = Number(spread?.[key]);
      if (!Number.isFinite(value)) return null;
      if (!showZeros && value === 0) return null;
      if (Number.isFinite(defaultValue) && value === defaultValue) return null;
      return `${value} ${getTeamBuilderExportStatLabel(key)}`;
    })
    .filter(Boolean);
  return parts.join(" / ");
}

function buildTeamBuilderSlotExport(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) return "";

  const lines = [];
  lines.push(`${pokemon.name}${slot.item ? ` @ ${slot.item}` : ""}`);
  if (slot.talent) lines.push(`Talent: ${slot.talent}`);
  if (slot.gimmick) lines.push(`Gimmick: ${slot.gimmick}`);
  if (slot.nature) lines.push(`${slot.nature} Nature`);

  const evLine = formatTeamBuilderExportSpread(slot.evs, { defaultValue: 0 });
  if (evLine) lines.push(`EVs: ${evLine}`);

  const ivLine = formatTeamBuilderExportSpread(slot.ivs, { defaultValue: 31 });
  if (ivLine) lines.push(`IVs: ${ivLine}`);

  slot.moves
    .filter(Boolean)
    .forEach((move) => lines.push(`- ${move}`));

  return lines.join("\n");
}

function buildTeamBuilderExportText() {
  const filled = teamBuilderState
    .map((slot) => buildTeamBuilderSlotExport(slot))
    .filter(Boolean);

  return filled.length
    ? filled.join("\n\n")
    : "Aucun Pokémon ajouté pour l’instant.";
}

function renderTeamBuilderExport() {
  const output = document.getElementById("team-builder-export-output");
  const meta = document.getElementById("team-builder-export-meta");
  if (!output || !meta) return;

  const filledCount = teamBuilderState.filter((slot) => getTeamBuilderPokemon(slot)).length;
  output.value = buildTeamBuilderExportText();
  meta.textContent = `${filledCount} Pokémon`;
}

function copyTeamBuilderExport() {
  const text = buildTeamBuilderExportText();
  const msg = document.getElementById("team-builder-export-msg");
  navigator.clipboard.writeText(text).then(() => {
    if (!msg) return;
    msg.textContent = "Export copié.";
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2200);
  }).catch(() => {
    if (!msg) return;
    msg.textContent = "Copie impossible.";
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2200);
  });
}

function getTeamBuilderNatureValueFromImport(raw) {
  const target = norm(String(raw || "").replace(/\s+nature$/i, "").trim());
  if (!target) return "Hardi";
  const match = TEAM_BUILDER_NATURES.find((entry) => norm(entry.value) === target || norm(entry.label) === target);
  return match?.value || "Hardi";
}

function getTeamBuilderPresetValueFromSpread(presets, spread) {
  const keys = ["hp", "atk", "def", "spa", "spd", "spe"];
  const match = presets.find((preset) => preset.spread && keys.every((key) => Number(preset.spread[key] || 0) === Number(spread?.[key] || 0)));
  return match?.value || "custom";
}

function parseTeamBuilderSpreadLine(line, fallbackDefault = 0) {
  const spread = { hp: fallbackDefault, atk: fallbackDefault, def: fallbackDefault, spa: fallbackDefault, spd: fallbackDefault, spe: fallbackDefault };
  const map = {
    hp: "hp",
    atk: "atk",
    def: "def",
    spa: "spa",
    spd: "spd",
    spe: "spe",
  };
  const matches = String(line || "").match(/(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/gi) || [];
  matches.forEach((chunk) => {
    const parts = chunk.match(/(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/i);
    if (!parts) return;
    const value = Number(parts[1]);
    const key = map[String(parts[2]).toLowerCase()];
    if (!key || !Number.isFinite(value)) return;
    spread[key] = value;
  });
  return spread;
}

function parseTeamBuilderImportBlock(block) {
  const lines = String(block || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const head = lines[0];
  const [pokemonRaw, itemRaw] = head.split("@").map((part) => String(part || "").trim());
  const pokemonName = pokemonRaw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const pokemon = findPokemonGlobalByName(pokemonName);
  if (!pokemon) return null;

  const slot = createTeamBuilderEmptySlot();
  slot.pokemonId = pokemon.id;
  slot.item = TEAM_BUILDER_ITEMS.includes(itemRaw) ? itemRaw : "";

  lines.slice(1).forEach((line) => {
    if (/^talent\s*:/i.test(line)) {
      slot.talent = line.split(":").slice(1).join(":").trim();
      return;
    }
    if (/^gimmick\s*:/i.test(line)) {
      const gimmick = line.split(":").slice(1).join(":").trim();
      slot.gimmick = TEAM_BUILDER_GIMMICKS.includes(gimmick) ? gimmick : "";
      return;
    }
    if (/nature$/i.test(line)) {
      slot.nature = getTeamBuilderNatureValueFromImport(line);
      return;
    }
    if (/^evs\s*:/i.test(line)) {
      const spread = parseTeamBuilderSpreadLine(line, 0);
      slot.evs = normalizeTeamBuilderSpread(spread, 0, 0, 252);
      slot.evPreset = getTeamBuilderPresetValueFromSpread(TEAM_BUILDER_EV_PRESETS, slot.evs);
      return;
    }
    if (/^ivs\s*:/i.test(line)) {
      const spread = parseTeamBuilderSpreadLine(line, 31);
      slot.ivs = normalizeTeamBuilderSpread(spread, 31, 0, 31);
      slot.ivPreset = getTeamBuilderPresetValueFromSpread(TEAM_BUILDER_IV_PRESETS, slot.ivs);
      return;
    }
    if (/^-/.test(line)) {
      const moveName = line.replace(/^-+\s*/, "").trim();
      const nextIndex = slot.moves.findIndex((move) => !move);
      if (nextIndex >= 0) slot.moves[nextIndex] = moveName;
    }
  });

  return slot;
}

function importTeamBuilderText() {
  const input = document.getElementById("team-builder-import-input");
  const msg = document.getElementById("team-builder-import-msg");
  if (!input || !msg) return;

  const blocks = String(input.value || "")
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  // Lot E audit : récap d'import explicite (avant : blocs invalides ignorés en silence).
  const parsedBlocks = blocks.map((block) => ({ block, slot: parseTeamBuilderImportBlock(block) }));
  const validSlots = parsedBlocks.filter((entry) => entry.slot);
  const slots = validSlots.map((entry) => entry.slot).slice(0, 6);
  const ignoredNames = parsedBlocks
    .filter((entry) => !entry.slot)
    .map((entry) => String(entry.block.split(/\r?\n/)[0] || "?").trim().slice(0, 30));
  const overflowCount = Math.max(0, validSlots.length - 6);

  if (!slots.length) {
    msg.textContent = ignoredNames.length
      ? `Import impossible — Pokémon non reconnu${ignoredNames.length > 1 ? "s" : ""} : ${ignoredNames.join(", ")}.`
      : "Import impossible.";
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 5200);
    return;
  }

  teamBuilderState = normalizeTeamBuilderState(slots);
  teamBuilderActiveSlot = 0;
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
  renderTeamBuilderModule();

  let recap = `${slots.length} slot${slots.length > 1 ? "s" : ""} importé${slots.length > 1 ? "s" : ""}.`;
  if (ignoredNames.length) {
    recap += ` ${ignoredNames.length} bloc${ignoredNames.length > 1 ? "s" : ""} ignoré${ignoredNames.length > 1 ? "s" : ""} (Pokémon non reconnu) : ${ignoredNames.join(", ")}.`;
  }
  if (overflowCount) {
    recap += ` ${overflowCount} au-delà de la limite de 6 non importé${overflowCount > 1 ? "s" : ""}.`;
  }
  msg.textContent = recap;
  msg.classList.remove("hidden");
  setTimeout(() => msg.classList.add("hidden"), ignoredNames.length || overflowCount ? 6500 : 2200);
}

function getTeamLibraryTemplateById(id) {
  return TEAM_LIBRARY_TEMPLATES.find((template) => template.id === id) || null;
}

function getTeamLibraryStyleLabel(style) {
  return TEAM_LIBRARY_STYLE_LABELS[style] || style || "Balanced";
}

function renderTeamLibraryPokemonCard(pokemonId) {
  const pokemon = POKEMON_BY_ID.get(Number(pokemonId));
  if (!pokemon) {
    return `
      <div class="team-template-pokemon is-empty">
        <span class="team-template-pokemon-sprite">?</span>
        <strong>Pokémon</strong>
        <small>Indisponible</small>
      </div>
    `;
  }

  return `
    <div class="team-template-pokemon">
      <img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" />
      <strong>${escapeHtml(pokemon.name)}</strong>
      <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
    </div>
  `;
}

function applyTeamTemplateToBuilder(template) {
  if (!template) return;
  const slots = Array.isArray(template.slots) ? template.slots.map((slot) => ({
    pokemonId: Number.isInteger(slot?.pokemonId) ? slot.pokemonId : null,
    item: typeof slot?.item === "string" ? slot.item : "",
    gimmick: typeof slot?.gimmick === "string" ? slot.gimmick : "",
    moves: Array.isArray(slot?.moves)
      ? slot.moves.slice(0, 4).map((move) => (typeof move === "string" ? move.trim() : ""))
      : ["", "", "", ""],
    nature: TEAM_BUILDER_NATURES.some((nature) => nature.value === slot?.nature) ? slot.nature : "Hardi",
    talent: typeof slot?.talent === "string" ? slot.talent : "",
    evPreset: TEAM_BUILDER_EV_PRESETS.some((preset) => preset.value === slot?.evPreset) ? slot.evPreset : "offensive-physique",
    evs: slot?.evs ? normalizeTeamBuilderSpread(slot.evs, 0, 0, 252) : createTeamBuilderEmptySlot().evs,
    ivPreset: TEAM_BUILDER_IV_PRESETS.some((preset) => preset.value === slot?.ivPreset) ? slot.ivPreset : "all31",
    ivs: slot?.ivs ? normalizeTeamBuilderSpread(slot.ivs, 31, 0, 31) : createTeamBuilderEmptySlot().ivs,
  })) : [];

  teamBuilderState = normalizeTeamBuilderState(slots);
  teamBuilderActiveSlot = 0;
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
}

function openTeamTemplateInBuilder(templateId) {
  const template = getTeamLibraryTemplateById(templateId);
  if (!template) return;
  applyTeamTemplateToBuilder(template);
  openTeamBuilderScreen();
}

function resetTeamLibraryFilters() {
  teamLibraryFilters = {
    generation: "all",
    format: "all",
    style: "all",
  };
  renderTeamsScreen();
}

function fillTeamLibrarySelect(select, values) {
  if (!select || select.dataset.ready) return;
  select.innerHTML = values.map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`).join("");
  select.dataset.ready = "1";
}

function renderTeamsScreen() {
  const generationSelect = document.getElementById("teams-filter-generation");
  const formatSelect = document.getElementById("teams-filter-format");
  const styleSelect = document.getElementById("teams-filter-style");
  const grid = document.getElementById("teams-grid");
  if (!generationSelect || !formatSelect || !styleSelect || !grid) return;

  fillTeamLibrarySelect(generationSelect, TEAM_LIBRARY_GENERATION_OPTIONS);
  fillTeamLibrarySelect(formatSelect, TEAM_LIBRARY_FORMAT_OPTIONS);
  fillTeamLibrarySelect(styleSelect, TEAM_LIBRARY_STYLE_OPTIONS);

  generationSelect.value = teamLibraryFilters.generation;
  formatSelect.value = teamLibraryFilters.format;
  styleSelect.value = teamLibraryFilters.style;

  const templates = TEAM_LIBRARY_TEMPLATES.filter((template) => {
    const generationMatch = teamLibraryFilters.generation === "all" || template.generation === teamLibraryFilters.generation;
    const formatMatch = teamLibraryFilters.format === "all" || template.format === teamLibraryFilters.format;
    const styleMatch = teamLibraryFilters.style === "all" || template.style === teamLibraryFilters.style;
    return generationMatch && formatMatch && styleMatch;
  });

  if (!templates.length) {
    grid.innerHTML = '<p class="teams-empty">Aucun template ne correspond à ces filtres.</p>';
    return;
  }

  grid.innerHTML = templates.map((template) => {
    const roster = (template.slots || []).slice(0, 6).map((slot) => renderTeamLibraryPokemonCard(slot.pokemonId)).join("");
    const tags = [
      `Gen ${template.generation}`,
      template.format,
      getTeamLibraryStyleLabel(template.style),
      ...(Array.isArray(template.tags) ? template.tags.slice(0, 2) : []),
    ].filter(Boolean);

    return `
      <article class="team-template-card">
        <div class="team-template-head">
          <div>
            <h3>${escapeHtml(template.name)}</h3>
            <p>${escapeHtml(template.summary)}</p>
          </div>
          <span class="team-template-count">6 Pokémon</span>
        </div>
        <div class="team-template-tags">
          ${tags.map((tag) => `<span class="team-template-tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="team-template-squad" aria-label="Équipe exemple">
          ${roster}
        </div>
        <div class="team-template-actions">
          <button class="btn-blue" type="button" data-action="openTeamTemplateInBuilder" data-args='["${escapeHtml(template.id)}"]'>Utiliser comme base</button>
          <span>Ouvre le builder avec cette base déjà posée.</span>
        </div>
      </article>
    `;
  }).join("");
}

function openTeamsScreen() {
  closeOverlayModal();
  goToConfig();
  document.getElementById("screen-config").classList.add("hidden");
  document.querySelector(".search-bar")?.classList.add("hidden");
  showScreen("screen-teams");
  setGlobalNavActive("champions");
  renderTeamsScreen();
  window.requestAnimationFrame(() => {
    document.getElementById("screen-teams")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function initTeamsModule() {
  const generationSelect = document.getElementById("teams-filter-generation");
  const formatSelect = document.getElementById("teams-filter-format");
  const styleSelect = document.getElementById("teams-filter-style");
  if (!generationSelect || !formatSelect || !styleSelect) return;

  generationSelect.addEventListener("change", (event) => {
    teamLibraryFilters.generation = event.target.value || "all";
    renderTeamsScreen();
  });
  formatSelect.addEventListener("change", (event) => {
    teamLibraryFilters.format = event.target.value || "all";
    renderTeamsScreen();
  });
  styleSelect.addEventListener("change", (event) => {
    teamLibraryFilters.style = event.target.value || "all";
    renderTeamsScreen();
  });

  renderTeamsScreen();
}

function typeBadgesHtml(type1, type2) {
  const badges = [typeBadgeHtml(type1)];
  if (type2) badges.push(typeBadgeHtml(type2));
  return badges.join("");
}

function flavorTextFr(speciesData) {
  if (!speciesData?.flavor_text_entries) return "Description non disponible.";

  const entries = speciesData.flavor_text_entries;
  const fr = entries.find((e) => e?.language?.name === "fr");
  const en = entries.find((e) => e?.language?.name === "en");
  const chosen = fr || en;
  if (!chosen?.flavor_text) return "Description non disponible.";

  return chosen.flavor_text.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
}

const POKEAPI_HABITAT_LABELS = {
  cave: "Grotte",
  forest: "Foret",
  grassland: "Prairie",
  mountain: "Montagne",
  rare: "Rare / special",
  "rough-terrain": "Terrain accidenté",
  sea: "Mer",
  urban: "Urbain",
  "waters-edge": "Bord de l'eau",
};

const POKEAPI_VERSION_LABELS = {
  red: "Rouge",
  blue: "Bleu",
  yellow: "Jaune",
  gold: "Or",
  silver: "Argent",
  crystal: "Cristal",
  ruby: "Rubis",
  sapphire: "Saphir",
  emerald: "Emeraude",
  firered: "Rouge Feu",
  leafgreen: "Vert Feuille",
  diamond: "Diamant",
  pearl: "Perle",
  platinum: "Platine",
  heartgold: "HeartGold",
  soulsilver: "SoulSilver",
  black: "Noir",
  white: "Blanc",
  "black-2": "Noir 2",
  "white-2": "Blanc 2",
  x: "X",
  y: "Y",
  "omega-ruby": "Rubis Omega",
  "alpha-sapphire": "Saphir Alpha",
  sun: "Soleil",
  moon: "Lune",
  "ultra-sun": "Ultra-Soleil",
  "ultra-moon": "Ultra-Lune",
  "lets-go-pikachu": "Let's Go Pikachu",
  "lets-go-eevee": "Let's Go Evoli",
  sword: "Epée",
  shield: "Bouclier",
  "brilliant-diamond": "Diamant Etincelant",
  "shining-pearl": "Perle Scintillante",
  legends: "Legends",
  scarlet: "Ecarlate",
  violet: "Violet",
};

const POKEAPI_LOCATION_WORDS = {
  area: "zone",
  cave: "grotte",
  city: "ville",
  desert: "desert",
  forest: "foret",
  island: "ile",
  lake: "lac",
  meadow: "prairie",
  mountain: "mont",
  park: "parc",
  path: "sentier",
  road: "route",
  route: "route",
  sea: "mer",
  tower: "tour",
  town: "bourg",
  trail: "piste",
  tunnel: "tunnel",
};

function formatPokeApiPlainLabel(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => POKEAPI_LOCATION_WORDS[part] || part)
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function formatPokeApiVersionLabel(value) {
  const key = String(value || "").trim();
  return POKEAPI_VERSION_LABELS[key] || formatPokeApiPlainLabel(key);
}

function formatPokeApiEncounterAreaName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Lieu inconnu";
  return raw
    .replace(/^(kanto|johto|hoenn|sinnoh|unova|kalos|alola|galar|hisui|paldea)-/, "")
    .replace(/-area$/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => POKEAPI_LOCATION_WORDS[part] || part)
    .join(" ")
    .replace(/\b(route\s+)(\d+)/gi, "Route $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function formatPokemonSpeciesHabitat(speciesData, fallbackPokemon = null) {
  const key = speciesData?.habitat?.name || "";
  if (key && POKEAPI_HABITAT_LABELS[key]) return POKEAPI_HABITAT_LABELS[key];
  if (key) return formatPokeApiPlainLabel(key);
  return fallbackPokemon?.habitat || "Inconnu";
}

function summarizeEncounterAreas(rawAreas, limit = 8) {
  if (!Array.isArray(rawAreas)) return null;
  const seen = new Set();
  const entries = [];
  for (const area of rawAreas) {
    const areaName = area?.location_area?.name || "";
    const label = formatPokeApiEncounterAreaName(areaName);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const versions = Array.isArray(area?.version_details)
      ? [...new Set(area.version_details.map((entry) => formatPokeApiVersionLabel(entry?.version?.name)).filter(Boolean))]
      : [];
    entries.push({ label, versions: versions.slice(0, 4) });
    if (entries.length >= limit) break;
  }
  return entries;
}

async function fetchPokemonEncounterAreas(pokemon, pokeData = null) {
  const apiId = getMysteryApiId(pokemon);
  const url = pokeData?.location_area_encounters || (apiId ? `https://pokeapi.co/api/v2/pokemon/${apiId}/encounters` : "");
  if (!url) return null;
  const cacheKey = `encounters:${url}`;
  if (POKEDEX_ENCOUNTER_CACHE.has(cacheKey)) return POKEDEX_ENCOUNTER_CACHE.get(cacheKey);
  try {
    const data = await fetchPokeApiJson(url);
    const areas = Array.isArray(data) ? data : [];
    POKEDEX_ENCOUNTER_CACHE.set(cacheKey, areas);
    return areas;
  } catch (_err) {
    return null;
  }
}

function renderPokedexEncounterLocationsHtml(rawAreas) {
  if (rawAreas === null) {
    return '<p class="pokedex-muted">Lieux de rencontre indisponibles pour ce Pokémon.</p>';
  }
  const entries = summarizeEncounterAreas(rawAreas, 10);
  if (!entries || !entries.length) {
    return '<p class="pokedex-muted">Aucun lieu de rencontre sauvage listé par PokéAPI. Le Pokémon peut être obtenu par starter, échange, cadeau, évolution, événement ou méthode spéciale selon les jeux.</p>';
  }
  return `<div class="pokedex-encounter-list">${entries.map((entry) => `
    <div class="pokedex-encounter-item">
      <b>${escapeHtml(entry.label)}</b>
      <span>${escapeHtml(entry.versions.length ? entry.versions.join(" / ") : "Versions variables")}</span>
    </div>
  `).join("")}</div>`;
}

async function hydrateComparisonRowEncounter(row, pokemon) {
  if (!row || !pokemon) return;
  const detail = row.querySelector("[data-encounter-summary]");
  if (!detail) return;
  const rawAreas = await fetchPokemonEncounterAreas(pokemon);
  if (!row.isConnected) return;
  const entries = summarizeEncounterAreas(rawAreas, 3);
  if (entries && entries.length) {
    detail.textContent = `Lieux : ${entries.map((entry) => entry.label).join(" / ")}`;
  } else if (rawAreas === null) {
    detail.textContent = "Lieux : indisponibles";
  } else {
    detail.textContent = "Lieux : obtention spéciale ou non listée";
  }
}

function statFromPokemonData(pokeData, key) {
  if (!pokeData?.stats) return null;
  const entry = pokeData.stats.find((s) => s?.stat?.name === key);
  return Number.isFinite(Number(entry?.base_stat)) ? Number(entry.base_stat) : null;
}

function statsRowsHtml(pokeData) {
  const rows = [
    { key: "hp", label: "PV", max: 255 },
    { key: "attack", label: "Attaque", max: 190 },
    { key: "defense", label: "Défense", max: 250 },
    { key: "special-attack", label: "Attaque Spé.", max: 194 },
    { key: "special-defense", label: "Défense Spé.", max: 250 },
    { key: "speed", label: "Vitesse", max: 200 },
  ];

  const values = rows.map((r) => ({
    label: r.label,
    value: statFromPokemonData(pokeData, r.key),
    max: r.max,
  }));

  const total = values.reduce((sum, s) => sum + (Number.isFinite(s.value) ? s.value : 0), 0);

  const lines = values.map((s) => {
    const value = Number.isFinite(s.value) ? s.value : "?";
    const ratio = Number.isFinite(s.value) ? Math.max(0, Math.min(1, s.value / s.max)) : 0;
    return `<div class="pokedex-stat-row"><span>${s.label}</span><div class="pokedex-stat-track"><i style="width:${Math.round(ratio * 100)}%"></i></div><b>${value}</b></div>`;
  });

  lines.push(`<div class="pokedex-stat-row total"><span>Total</span><div class="pokedex-stat-track"><i style="width:${Math.round(Math.max(0, Math.min(1, total / 780)) * 100)}%"></i></div><b>${total}</b></div>`);
  return lines.join("");
}

function abilityNameFr(abilityData) {
  if (!abilityData?.names) return null;
  const fr = abilityData.names.find((n) => n?.language?.name === "fr");
  return fr?.name || null;
}

async function fetchPokedexAbilityData(url) {
  if (typeof url !== "string" || !url) return null;
  if (POKEDEX_ABILITY_CACHE.has(url)) return POKEDEX_ABILITY_CACHE.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_ABILITY_CACHE.set(url, data);
    return data;
  } catch (_err) {
    return null;
  }
}

async function abilitiesHtml(pokeData) {
  if (!pokeData?.abilities?.length) return "<p class=\"pokedex-muted\">Talents non disponibles.</p>";

  const abilities = await Promise.all(
    pokeData.abilities
      .slice()
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map(async (a) => {
        const abilityData = await fetchPokedexAbilityData(a.ability?.url);
        const fr = abilityNameFr(abilityData);
        const rawName = a.ability?.name || "Talent";
        const fallback = rawName.charAt(0).toUpperCase() + rawName.slice(1).replace(/-/g, " ");
        const name = fr || fallback;
        const hidden = a.is_hidden ? "<em>Talent caché</em>" : "";
        return `<div class=\"pokedex-ability\"><b>${escapeHtml(name)}</b>${hidden}</div>`;
      })
  );

  return abilities.join("");
}

function getPokemonShinySprite(pokemon) {
  if (!pokemon) return "";
  const sprite = getPokemonSprite(pokemon);
  if (typeof sprite === "string" && sprite.includes("/sprites/pokemon/")) {
    return sprite.replace("/sprites/pokemon/", "/sprites/pokemon/shiny/");
  }
  return draftShinySpriteUrl(getPokemonSpriteId(pokemon));
}

function getPokedexDisplaySprite(pokemon, useShiny = false) {
  if (!pokemon) return "";
  return useShiny ? getPokemonShinySprite(pokemon) : getPokemonSprite(pokemon);
}

function updatePokedexShinyButton() {
  const button = document.getElementById("pokedex-shiny-toggle");
  const localButton = document.getElementById("pokedex-detail-shiny-toggle");
  if (button) {
    button.textContent = `Shiny : ${pokedexGridUseShiny ? "Oui" : "Non"}`;
    button.classList.toggle("active", pokedexGridUseShiny);
  }
  if (localButton) {
    localButton.textContent = pokedexSelectedShiny ? "Shiny" : "Normal";
    localButton.classList.toggle("active", pokedexSelectedShiny);
  }
}

function togglePokedexGridShiny() {
  pokedexGridUseShiny = !pokedexGridUseShiny;
  updatePokedexShinyButton();
  renderPokedexGrid();
}

function togglePokedexShiny() {
  pokedexSelectedShiny = !pokedexSelectedShiny;
  updatePokedexShinyButton();
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
}

let pokedexBuilderFeedbackTimer = null;
let teamBuilderBridgeFeedbackTimer = null;
let teamBuilderBridgeHighlightTimer = null;

function showPokedexBuilderFeedback(message, tone = "info") {
  const feedback = document.getElementById("pokedex-detail-builder-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `pokedex-detail-builder-feedback is-visible is-${tone}`;
  window.clearTimeout(pokedexBuilderFeedbackTimer);
  pokedexBuilderFeedbackTimer = window.setTimeout(() => {
    feedback.className = "pokedex-detail-builder-feedback";
    feedback.textContent = "";
  }, 2200);
}

function showTeamBuilderBridgeFeedback(message, tone = "success") {
  const screen = document.getElementById("screen-team-builder");
  if (!screen) return;
  let feedback = screen.querySelector(".team-builder-bridge-feedback");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "team-builder-bridge-feedback";
    feedback.setAttribute("aria-live", "polite");
    screen.appendChild(feedback);
  }
  feedback.textContent = message;
  feedback.className = `team-builder-bridge-feedback is-visible is-${tone}`;
  window.clearTimeout(teamBuilderBridgeFeedbackTimer);
  teamBuilderBridgeFeedbackTimer = window.setTimeout(() => {
    feedback.className = "team-builder-bridge-feedback";
    feedback.textContent = "";
  }, 2200);
}

function focusTeamBuilderActiveSlotVisual() {
  window.requestAnimationFrame(() => {
    const activeSlot = document.querySelector("#team-builder-grid .home-builder-slot.is-active");
    if (!activeSlot) return;
    activeSlot.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    activeSlot.classList.add("is-bridge-highlight");
    window.clearTimeout(teamBuilderBridgeHighlightTimer);
    teamBuilderBridgeHighlightTimer = window.setTimeout(() => {
      activeSlot.classList.remove("is-bridge-highlight");
    }, 1600);
  });
}

function addSelectedPokedexPokemonToBuilder() {
  const pokemon = POKEMON_BY_ID.get(Number(pokedexSelectedId));
  if (!pokemon) return;
  const emptySlotIndex = teamBuilderState.findIndex((slot) => !Number.isInteger(Number(slot?.pokemonId)));
  if (emptySlotIndex === -1) {
    showPokedexBuilderFeedback("Équipe complète", "full");
    return;
  }
  teamBuilderActiveSlot = emptySlotIndex;
  const nextSlot = createTeamBuilderEmptySlot();
  nextSlot.pokemonId = pokemon.id;
  teamBuilderState[emptySlotIndex] = nextSlot;
  saveTeamBuilderState();
  openTeamBuilderScreen();
  focusTeamBuilderActiveSlotVisual();
  showTeamBuilderBridgeFeedback(`${pokemon.name} ajouté à l'équipe`, "success");
}

function attackMultiplier(attackType, defenseType) {
  if (!defenseType) return 1;
  const m = TYPE_EFFECTIVENESS[attackType];
  if (!m) return 1;
  if (m.no.includes(defenseType)) return 0;
  if (m.super.includes(defenseType)) return 2;
  if (m.not.includes(defenseType)) return 0.5;
  return 1;
}

function typeMatchupHtml(type1, type2) {
  const entries = Object.keys(TYPE_EFFECTIVENESS).map((atk) => {
    const m = attackMultiplier(atk, type1) * attackMultiplier(atk, type2 || null);
    return { type: atk, m };
  });

  const weak = entries.filter((e) => e.m > 1).sort((a, b) => b.m - a.m);
  const resist = entries.filter((e) => e.m > 0 && e.m < 1).sort((a, b) => a.m - b.m);
  const immune = entries.filter((e) => e.m === 0);

  const badge = (e) => `<span class=\"match-badge\"><span class=\"match-badge-type\">${typeBadgeHtml(e.type)}</span><b class=\"match-badge-multiplier\">x${e.m}</b></span>`;
  const none = '<span class="pokedex-muted">Aucun</span>';

  return `
    <div class=\"pokedex-match-section\"><span>Faiblesses</span><div class=\"pokedex-match-list\">${weak.length ? weak.map(badge).join("") : none}</div></div>
    <div class=\"pokedex-match-section\"><span>Résistances</span><div class=\"pokedex-match-list\">${resist.length ? resist.map(badge).join("") : none}</div></div>
    <div class=\"pokedex-match-section\"><span>Immunités</span><div class=\"pokedex-match-list\">${immune.length ? immune.map(badge).join("") : none}</div></div>
  `;
}

function formatGenderRate(speciesData) {
  const rate = Number(speciesData?.gender_rate);
  if (!Number.isFinite(rate) || rate < 0) return "Asexué / inconnu";
  const female = Math.round((rate / 8) * 100);
  const male = 100 - female;
  return `${male}% mâle / ${female}% femelle`;
}

function formatEggGroups(speciesData) {
  const list = Array.isArray(speciesData?.egg_groups) ? speciesData.egg_groups : [];
  if (!list.length) return "Inconnu";
  return list.map((g) => g?.name || "?").join(" / ");
}

function formatHatchCycles(speciesData) {
  const n = Number(speciesData?.hatch_counter);
  return Number.isFinite(n) && n >= 0 ? `${n} cycles` : "Inconnu";
}

async function fetchPokedexPokemonData(apiId) {
  if (!apiId) return null;
  if (POKEDEX_API_CACHE.has(apiId)) return POKEDEX_API_CACHE.get(apiId);

  try {
    const data = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon/${apiId}`);
    POKEDEX_API_CACHE.set(apiId, data);
    return data;
  } catch (_err) {
    return null;
  }
}

async function fetchPokedexSpeciesData(speciesId) {
  if (!speciesId) return null;
  if (POKEDEX_SPECIES_CACHE.has(speciesId)) return POKEDEX_SPECIES_CACHE.get(speciesId);

  try {
    const data = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
    POKEDEX_SPECIES_CACHE.set(speciesId, data);
    return data;
  } catch (_err) {
    return null;
  }
}

function speciesIdFromUrl(url) {
  if (typeof url !== "string") return null;
  const m = url.match(/\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

function getPokedexTypes() {
  const set = new Set();
  for (const p of POKEMON_LIST) {
    if (p.type1) set.add(p.type1);
    if (p.type2) set.add(p.type2);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

function isPokedexToolbarDirty() {
  return Boolean(
    (pokedexSearch || "").trim() ||
    pokedexGenFilter !== "all" ||
    pokedexTypeFilter !== "all" ||
    pokedexType2Filter !== "all" ||
    pokedexSortFilter !== "dex" ||
    pokedexCategoryFilter !== "all"
  );
}

function ensurePokedexToolbarMeta() {
  let meta = document.getElementById("pokedex-toolbar-meta");
  if (meta) return meta;
  const row = document.querySelector("#screen-pokedex .pokedex-toolbar-row-bottom");
  if (!row) return null;
  meta = document.createElement("div");
  meta.id = "pokedex-toolbar-meta";
  meta.className = "pokedex-toolbar-meta";
  meta.innerHTML = `
    <span id="pokedex-results-count" class="pokedex-results-count" aria-live="polite"></span>
    <button id="pokedex-reset-filters" class="btn-ghost pokedex-reset-filters" type="button">Réinitialiser</button>
  `;
  row.appendChild(meta);
  meta.querySelector("#pokedex-reset-filters")?.addEventListener("click", resetPokedexToolbar);
  return meta;
}

function updatePokedexToolbarMeta(resultCount) {
  const meta = ensurePokedexToolbarMeta();
  if (!meta) return;
  const count = meta.querySelector("#pokedex-results-count");
  const reset = meta.querySelector("#pokedex-reset-filters");
  const total = POKEMON_LIST.length;
  if (count) {
    count.textContent = `${resultCount} / ${total} affichés`;
  }
  const isDirty = isPokedexToolbarDirty();
  meta.classList.toggle("is-dirty", isDirty);
  if (reset) {
    reset.hidden = !isDirty;
    reset.disabled = !isDirty;
    reset.setAttribute("aria-hidden", isDirty ? "false" : "true");
  }
}

function resetPokedexToolbar() {
  pokedexSearch = "";
  pokedexGenFilter = "all";
  pokedexTypeFilter = "all";
  pokedexType2Filter = "all";
  pokedexSortFilter = "dex";
  pokedexCategoryFilter = "all";
  const search = document.getElementById("pokedex-search");
  const gen = document.getElementById("pokedex-gen-filter");
  const type = document.getElementById("pokedex-type-filter");
  const type2 = document.getElementById("pokedex-type2-filter");
  const sort = document.getElementById("pokedex-sort-filter");
  if (search) search.value = "";
  if (gen) gen.value = "all";
  if (type) type.value = "all";
  if (type2) type2.value = "all";
  if (sort) sort.value = "dex";
  const category = document.getElementById("pokedex-category-filter");
  if (category) category.value = "all";
  renderPokedexGrid();
}

function initPokedex() {
  const search = document.getElementById("pokedex-search");
  const gen = document.getElementById("pokedex-gen-filter");
  const type = document.getElementById("pokedex-type-filter");
  const type2 = document.getElementById("pokedex-type2-filter");
  const sort = document.getElementById("pokedex-sort-filter");
  const category = document.getElementById("pokedex-category-filter");
  const shinyToggle = document.getElementById("pokedex-shiny-toggle");
  if (!search || !gen || !type || !type2 || !sort) return;

  gen.innerHTML = '<option value="all">Toutes les générations</option>';
  for (const [num, data] of Object.entries(GENERATIONS)) {
    const opt = document.createElement("option");
    opt.value = String(num);
    opt.textContent = `Gen ${num} - ${data.label}`;
    gen.appendChild(opt);
  }

  type.innerHTML = '<option value="all">Tous les types</option>';
  type2.innerHTML = '<option value="all">Tous les types</option>';
  for (const t of getPokedexTypes()) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    type.appendChild(opt);
    type2.appendChild(opt.cloneNode(true));
  }

  sort.innerHTML = `
    <option value="dex">N° Pokédex</option>
    <option value="name-asc">Nom A → Z</option>
    <option value="name-desc">Nom Z → A</option>
    <option value="weight">Poids (lourd → léger)</option>
    <option value="height">Taille (grand → petit)</option>
  `;
  sort.value = pokedexSortFilter;
  ensurePokedexToolbarMeta();

  search.addEventListener("input", () => {
    pokedexSearch = search.value.trim();
    renderPokedexGrid();
  });

  gen.addEventListener("change", () => {
    pokedexGenFilter = gen.value;
    renderPokedexGrid();
  });

  type.addEventListener("change", () => {
    pokedexTypeFilter = type.value;
    renderPokedexGrid();
  });

  type2.addEventListener("change", () => {
    pokedexType2Filter = type2.value;
    renderPokedexGrid();
  });

  sort.addEventListener("change", () => {
    pokedexSortFilter = sort.value;
    renderPokedexGrid();
  });

  category?.addEventListener("change", () => {
    pokedexCategoryFilter = category.value;
    renderPokedexGrid();
  });
  shinyToggle?.addEventListener("click", togglePokedexGridShiny);

  updatePokedexShinyButton();

  if (!document.body.dataset.pokedexKeysBound) {
    document.body.dataset.pokedexKeysBound = "1";
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const pokedexScreen = document.getElementById("screen-pokedex");
      if (!pokedexScreen || pokedexScreen.classList.contains("hidden")) return;
      if (!pokedexSelectedId) return;
      const target = event.target;
      if (target?.isContentEditable) return;
      const tagName = String(target?.tagName || "").toLowerCase();
      if (["input", "textarea", "select"].includes(tagName)) return;
      event.preventDefault();
      navigatePokedexDetail(event.key === "ArrowLeft" ? "prev" : "next");
    });
  }
}

function openPokedexMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  stopEmulatorSession();
  showScreen("screen-pokedex");
  setGlobalNavActive("pokedex");
  setQuizModeLayout(false);
  stopCrySound();
  closeRankingPicker();

  const search = document.getElementById("pokedex-search");
  const gen = document.getElementById("pokedex-gen-filter");
  const type = document.getElementById("pokedex-type-filter");
  const type2 = document.getElementById("pokedex-type2-filter");
  const sort = document.getElementById("pokedex-sort-filter");
  if (search) search.value = pokedexSearch;
  if (gen) gen.value = pokedexGenFilter;
  if (type) type.value = pokedexTypeFilter;
  if (type2) type2.value = pokedexType2Filter;
  if (sort) sort.value = pokedexSortFilter;
  const pokedexCategorySel = document.getElementById("pokedex-category-filter");
  if (pokedexCategorySel) pokedexCategorySel.value = pokedexCategoryFilter;
  updatePokedexShinyButton();

  renderPokedexGrid();
}

function getFilteredPokedexList() {
  const q = norm(pokedexSearch || "");
  const type1Filter = pokedexTypeFilter || "all";
  const type2Filter = pokedexType2Filter || "all";

  return POKEMON_LIST
    .filter((p) => {
      if (pokedexGenFilter !== "all" && String(p.gen) !== pokedexGenFilter) return false;
      if (!pokedexMatchesCategory(p)) return false;
      if (type1Filter === "all" && type2Filter === "all") {
        // keep current behavior
      } else if (type1Filter !== "all" && type2Filter !== "all" && type1Filter !== type2Filter) {
        const pokemonTypes = [p.type1, p.type2].filter(Boolean).sort();
        const expectedTypes = [type1Filter, type2Filter].sort();
        if (pokemonTypes.length !== 2 || pokemonTypes[0] !== expectedTypes[0] || pokemonTypes[1] !== expectedTypes[1]) return false;
      } else {
        const singleType = type1Filter !== "all" ? type1Filter : type2Filter;
        if (singleType !== "all" && p.type1 !== singleType && p.type2 !== singleType) return false;
      }
      if (q && !norm(p.name).includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (pokedexSortFilter === "weight") return (Number(b.weight) || 0) - (Number(a.weight) || 0) || getPokemonSpriteId(a) - getPokemonSpriteId(b);
      if (pokedexSortFilter === "height") return (Number(b.height) || 0) - (Number(a.height) || 0) || getPokemonSpriteId(a) - getPokemonSpriteId(b);
      if (pokedexSortFilter === "name-asc") {
        return a.name.localeCompare(b.name, "fr") || getPokemonSpriteId(a) - getPokemonSpriteId(b);
      }
      if (pokedexSortFilter === "name-desc") {
        return b.name.localeCompare(a.name, "fr") || getPokemonSpriteId(a) - getPokemonSpriteId(b);
      }
      return getPokemonSpriteId(a) - getPokemonSpriteId(b) || a.name.localeCompare(b.name, "fr");
    });
}

function renderPokedexGrid() {
  const grid = document.getElementById("pokedex-grid");
  if (!grid) return;

  const list = getFilteredPokedexList();
  updatePokedexToolbarMeta(list.length);
  if (pokedexGridObserver) { pokedexGridObserver.disconnect(); pokedexGridObserver = null; }
  grid.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "rank-empty-list pokedex-empty-state";
    empty.innerHTML = `
      <strong>Aucun Pokémon trouvé</strong>
      <p>Essaie d’ajuster la recherche ou les filtres actuels.</p>
      ${isPokedexToolbarDirty() ? '<button type="button" class="btn-ghost pokedex-empty-reset" data-action="resetPokedexToolbar">Réinitialiser les filtres</button>' : ""}
    `;
    grid.appendChild(empty);
    renderPokedexDetail(null);
    return;
  }

  const ids = new Set(list.map((p) => p.id));
  if (!pokedexSelectedId || !ids.has(pokedexSelectedId)) {
    pokedexSelectedId = list[0].id;
  }

  // Lot E audit : rendu par tranches + IntersectionObserver. Avant, les 1025+
  // cartes étaient insérées d'un bloc (long tasks sensibles sur mobile).
  let renderedCount = 0;
  const appendChunk = (target) => {
    const fragment = document.createDocumentFragment();
    const slice = list.slice(renderedCount, renderedCount + POKEDEX_RENDER_CHUNK);
    for (const p of slice) fragment.appendChild(createPokedexCard(p));
    renderedCount += slice.length;
    if (target) grid.insertBefore(fragment, target);
    else grid.appendChild(fragment);
  };

  appendChunk(null);

  if (renderedCount < list.length) {
    const sentinel = document.createElement("div");
    sentinel.className = "pokedex-grid-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    grid.appendChild(sentinel);

    if (typeof IntersectionObserver === "function") {
      pokedexGridObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        appendChunk(sentinel);
        if (renderedCount >= list.length) {
          if (pokedexGridObserver) { pokedexGridObserver.disconnect(); pokedexGridObserver = null; }
          sentinel.remove();
        }
      }, { rootMargin: "600px" });
      pokedexGridObserver.observe(sentinel);
    } else {
      while (renderedCount < list.length) appendChunk(sentinel);
      sentinel.remove();
    }
  }

  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || list[0]);
}

const POKEDEX_RENDER_CHUNK = 120;
let pokedexGridObserver = null;

function createPokedexCard(p) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "pokedex-card" + (p.id === pokedexSelectedId ? " selected" : "");
  card.dataset.pokemonId = String(p.id);

  const dexId = getPokemonSpriteId(p);
  const sprite = getPokedexDisplaySprite(p, pokedexGridUseShiny);

  card.innerHTML = `
    <img src="${sprite}" alt="${p.name}" loading="lazy" data-fallback="${getSpriteUrl(dexId)}" />
    <span class="pokedex-num">#${dexId}</span>
    <strong>${p.name}</strong>
    <div class="pokedex-card-types">${typeBadgesHtml(p.type1, p.type2 || null)}</div>
  `;

  card.addEventListener("click", () => {
    pokedexSelectedId = p.id;
    pokedexSelectedShiny = false;
    updatePokedexGridSelection();
    renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || p);
  });
  return card;
}

function updatePokedexGridSelection() {
  const grid = document.getElementById("pokedex-grid");
  if (!grid) return;
  const cards = grid.querySelectorAll(".pokedex-card");
  cards.forEach((card) => {
    card.classList.toggle("selected", Number(card.dataset.pokemonId) === Number(pokedexSelectedId));
  });
}

function loadPokedexRecentIds() {
  if (pokedexRecentLoaded) return;
  pokedexRecentLoaded = true;
  try {
    const raw = localStorage.getItem(POKEDEX_RECENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      pokedexRecentIds = parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id));
    }
  } catch {
    pokedexRecentIds = [];
  }
}

function savePokedexRecentIds() {
  try {
    localStorage.setItem(POKEDEX_RECENT_STORAGE_KEY, JSON.stringify(pokedexRecentIds.slice(0, POKEDEX_RECENT_MAX)));
  } catch {
    // ignore storage failures
  }
}

function trackPokedexRecentId(pokemonId) {
  const id = Number(pokemonId);
  if (!Number.isInteger(id)) return;
  loadPokedexRecentIds();
  if (pokedexRecentIds[0] === id) return;
  pokedexRecentIds = [id, ...pokedexRecentIds.filter((entry) => entry !== id)].slice(0, POKEDEX_RECENT_MAX);
  savePokedexRecentIds();
}

function clearPokedexRecentHistory() {
  loadPokedexRecentIds();
  if (!pokedexRecentIds.length) {
    renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
    return;
  }
  pokedexRecentIds = [];
  savePokedexRecentIds();
  pokedexRecentSuppressOnce = true;
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
}

function renderPokedexRecentBlock() {
  loadPokedexRecentIds();
  const recent = pokedexRecentIds
    .map((id) => POKEMON_BY_ID.get(id))
    .filter((pokemon) => Boolean(pokemon));
  const items = recent.map((pokemon) => {
    const dexId = getPokemonSpriteId(pokemon);
    const sprite = getPokedexDisplaySprite(pokemon, false);
    const isActive = Number(pokemon.id) === Number(pokedexSelectedId);
    return `<button type="button" class="pokedex-recent-item${isActive ? " is-active" : ""}" data-action="openPokedexRecent" data-args='[${pokemon.id}]'><img src="${sprite}" alt="${escapeHtml(pokemon.name)}" data-fallback="${getSpriteUrl(dexId)}" /><span>${escapeHtml(pokemon.name)}</span></button>`;
  }).join("");
  const clearDisabled = recent.length ? "" : "disabled";
  return `<div class="pokedex-recent-block"><div class="pokedex-recent-head"><h4>Derniers consultés</h4><button type="button" class="btn-ghost pokedex-recent-clear" data-action="clearPokedexRecentHistory" ${clearDisabled}>Effacer</button></div>${recent.length ? `<div class="pokedex-recent-list">${items}</div>` : '<p class="pokedex-recent-empty">Aucun Pokémon récent</p>'}</div>`;
}

function loadPokedexCompareId() {
  if (pokedexCompareLoaded) return;
  pokedexCompareLoaded = true;
  try {
    const raw = localStorage.getItem(POKEDEX_COMPARE_STORAGE_KEY);
    const value = Number(raw);
    pokedexCompareId = Number.isInteger(value) ? value : null;
  } catch {
    pokedexCompareId = null;
  }
}

function savePokedexCompareId() {
  try {
    if (!Number.isInteger(Number(pokedexCompareId))) {
      localStorage.removeItem(POKEDEX_COMPARE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(POKEDEX_COMPARE_STORAGE_KEY, String(pokedexCompareId));
  } catch {
    // ignore storage failures
  }
}

function setPokedexCompareReference(pokemon) {
  if (!pokemon) return;
  pokedexCompareId = pokemon.id;
  savePokedexCompareId();
  showPokedexCompareFeedback(`${pokemon.name} défini comme référence`);
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || pokemon);
}

function clearPokedexCompareReference() {
  pokedexCompareId = null;
  savePokedexCompareId();
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
}

function showPokedexCompareFeedback(message) {
  const el = document.getElementById("pokedex-compare-feedback");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  window.clearTimeout(pokedexCompareToastTimer);
  pokedexCompareToastTimer = window.setTimeout(() => {
    el.classList.remove("is-visible");
    el.textContent = "";
  }, 1800);
}

function statsTotalsFromPokemonData(pokeData) {
  if (!pokeData?.stats) return { total: 0, stats: {} };
  const map = {
    hp: statFromPokemonData(pokeData, "hp"),
    atk: statFromPokemonData(pokeData, "attack"),
    def: statFromPokemonData(pokeData, "defense"),
    spa: statFromPokemonData(pokeData, "special-attack"),
    spd: statFromPokemonData(pokeData, "special-defense"),
    spe: statFromPokemonData(pokeData, "speed"),
  };
  const total = Object.values(map).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  return { total, stats: map };
}

function renderPokedexCompareBlock(reference, current, referenceStats, currentStats) {
  if (!reference || !current || reference.id === current.id) return "";
  const totalDelta = (currentStats.total || 0) - (referenceStats.total || 0);
  const deltaLabel = totalDelta === 0 ? "0" : totalDelta > 0 ? `+${totalDelta}` : String(totalDelta);
  const lines = [
    { key: "hp", label: "PV" },
    { key: "atk", label: "Attaque" },
    { key: "def", label: "Défense" },
    { key: "spa", label: "Atk Spé" },
    { key: "spd", label: "Def Spé" },
    { key: "spe", label: "Vitesse" },
  ];
  const statsRows = lines.map((entry) => {
    const leftVal = Number(referenceStats.stats?.[entry.key]) || 0;
    const rightVal = Number(currentStats.stats?.[entry.key]) || 0;
    const diff = rightVal - leftVal;
    const diffLabel = diff === 0 ? "0" : diff > 0 ? `+${diff}` : String(diff);
    return `<div class="pokedex-compare-row"><span>${entry.label}</span><b>${leftVal}</b><i>${diffLabel}</i><b>${rightVal}</b></div>`;
  }).join("");
  return `
    <div class="pokedex-compare-block">
      <div class="pokedex-compare-head">
        <h4>Comparaison rapide</h4>
        <button type="button" class="btn-ghost pokedex-compare-clear" data-action="clearPokedexCompareReference">Effacer la comparaison</button>
      </div>
      <div class="pokedex-compare-top">
        <div class="pokedex-compare-side">
          <strong>${escapeHtml(reference.name)}</strong>
          <small>#${getPokemonSpriteId(reference)} • ${typeBadgesHtml(reference.type1, reference.type2)}</small>
        </div>
        <div class="pokedex-compare-score">
          <span>Total</span>
          <b>${referenceStats.total}</b>
          <i>${deltaLabel}</i>
          <b>${currentStats.total}</b>
        </div>
        <div class="pokedex-compare-side">
          <strong>${escapeHtml(current.name)}</strong>
          <small>#${getPokemonSpriteId(current)} • ${typeBadgesHtml(current.type1, current.type2)}</small>
        </div>
      </div>
      <div class="pokedex-compare-grid">${statsRows}</div>
    </div>
  `;
}

function openPokedexRecent(pokemonId) {
  const id = Number(pokemonId);
  const pokemon = Number.isInteger(id) ? POKEMON_BY_ID.get(id) : null;
  if (!pokemon) return;
  pokedexSelectedId = id;
  pokedexSelectedShiny = false;
  updatePokedexGridSelection();
  renderPokedexDetail(pokemon);
  ensurePokedexSelectedCardVisible();
}

function getPokedexNavigationState() {
  const list = getFilteredPokedexList();
  const currentIndex = list.findIndex((pokemon) => Number(pokemon.id) === Number(pokedexSelectedId));
  return {
    list,
    currentIndex,
    previous: currentIndex > 0 ? list[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < list.length - 1 ? list[currentIndex + 1] : null,
  };
}

function ensurePokedexSelectedCardVisible() {
  const grid = document.getElementById("pokedex-grid");
  if (!grid || !pokedexSelectedId) return;
  const target = grid.querySelector(`.pokedex-card[data-pokemon-id="${pokedexSelectedId}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function navigatePokedexDetail(direction) {
  const { previous, next, currentIndex } = getPokedexNavigationState();
  if (currentIndex < 0) return;
  const target = direction === "prev" ? previous : next;
  if (!target) return;
  pokedexSelectedId = target.id;
  pokedexSelectedShiny = false;
  updatePokedexGridSelection();
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || target);
  ensurePokedexSelectedCardVisible();
}

async function renderPokedexDetail(pokemon) {
  const detail = document.getElementById("pokedex-detail");
  if (!detail) return;

  if (!pokemon) {
    pokedexDetailRequestId += 1;
    detail.innerHTML = '<p class="card-desc">Clique un Pokémon pour afficher sa fiche.</p>';
    return;
  }

  if (pokedexRecentSuppressOnce) {
    pokedexRecentSuppressOnce = false;
  } else {
    trackPokedexRecentId(pokemon.id);
  }
  loadPokedexCompareId();
  const currentRequest = ++pokedexDetailRequestId;
  const dexId = getPokemonSpriteId(pokemon);
  const navigation = getPokedexNavigationState();
  const recentHtml = renderPokedexRecentBlock();
  const navigationHtml = `
    <div class="pokedex-detail-nav">
      <button type="button" class="btn-ghost pokedex-detail-nav-btn" data-action="navigatePokedexDetail" data-args='["prev"]' ${navigation.previous ? "" : "disabled"}>&larr; Précédent</button>
      <button type="button" class="btn-ghost pokedex-detail-nav-btn" data-action="navigatePokedexDetail" data-args='["next"]' ${navigation.next ? "" : "disabled"}>Suivant &rarr;</button>
    </div>
  `;
  const builderActionHtml = `
    <div class="pokedex-detail-head-actions">
      <button id="pokedex-detail-shiny-toggle" class="btn-ghost pokedex-detail-shiny-btn" type="button" data-action="togglePokedexShiny">${pokedexSelectedShiny ? "Shiny" : "Normal"}</button>
      <button class="btn-ghost pokedex-detail-builder-btn" type="button" data-action="addSelectedPokedexPokemonToBuilder">Ajouter au Builder</button>
      <button class="btn-ghost pokedex-detail-compare-btn" type="button" data-action="setPokedexCompareReferenceById" data-args='[${pokemon.id}]'>Comparer</button>
      <span id="pokedex-detail-builder-feedback" class="pokedex-detail-builder-feedback" aria-live="polite"></span>
      <span id="pokedex-compare-feedback" class="pokedex-compare-feedback" aria-live="polite"></span>
    </div>
  `;
  const referencePokemon = Number.isInteger(Number(pokedexCompareId)) ? POKEMON_BY_ID.get(Number(pokedexCompareId)) : null;
  const compareBlockHtml = referencePokemon && referencePokemon.id !== pokemon.id
    ? `<div class="pokedex-section"><h4>Comparaison rapide</h4><p class="pokedex-muted">Chargement...</p></div>`
    : "";

  detail.innerHTML = `
    <div class="pokedex-detail-head">
      <div class="pokedex-detail-sticky">
        <div class="pokedex-detail-summary">
          <h3>${pokemon.name}</h3>
          <p>#${dexId}${pokemon.isAltForm ? " ? Forme alternative" : ""}</p>
          <div class="pokedex-type-row">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        </div>
      </div>
      <div class="pokedex-detail-head-main">
        <img src="${getPokedexDisplaySprite(pokemon, pokedexSelectedShiny)}" alt="${pokemon.name}" loading="lazy" data-fallback="${getSpriteUrl(dexId)}" />
        ${builderActionHtml}
      </div>
    </div>
    ${navigationHtml}
    ${recentHtml}
    ${compareBlockHtml}
    <div class="pokedex-detail-grid">
      <div><span>Génération</span><b>Gen ${pokemon.gen}</b></div>
      <div><span>Taille</span><b>${pokemon.height} m</b></div>
      <div><span>Poids</span><b>${pokemon.weight} kg</b></div>
      <div><span>Habitat local</span><b>${escapeHtml(pokemon.habitat || "Inconnu")}</b></div>
      <div><span>Couleur</span><b>${escapeHtml(formatColorLabel(pokemon.color))}</b></div>
      <div><span>Stade</span><b>${pokemon.stage}</b></div>
    </div>
    <div class="pokedex-section"><h4>Entrée Pokédex</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Lieux de rencontre</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Talents</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Statistiques de base</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Faiblesses et résistances</h4>${typeMatchupHtml(pokemon.type1, pokemon.type2)}</div>
    <div class="pokedex-section"><h4>Évolution</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Infos utiles</h4><div class="pokedex-detail-grid pokedex-extra-grid"><div><span>Capture</span><b>Chargement...</b></div><div><span>Genre</span><b>Chargement...</b></div><div><span>Groupes d'oeufs</span><b>Chargement...</b></div><div><span>Eclosion</span><b>Chargement...</b></div></div></div>
  `;

  const apiId = getMysteryApiId(pokemon);
  if (!apiId) return;

  const pokeData = await fetchPokedexPokemonData(apiId);
  if (!pokeData || currentRequest !== pokedexDetailRequestId) return;

  const speciesId = speciesIdFromUrl(pokeData?.species?.url) || apiId;
  const speciesData = await fetchPokedexSpeciesData(speciesId);
  if (currentRequest !== pokedexDetailRequestId) return;

  const description = flavorTextFr(speciesData);
  const abilities = await abilitiesHtml(pokeData);
  const stats = statsRowsHtml(pokeData);
  const evolution = await pokedexEvolutionSummaryHtml(speciesData, pokeData);
  const captureRate = Number.isFinite(Number(speciesData?.capture_rate)) ? String(speciesData.capture_rate) : "Inconnu";
  const gender = formatGenderRate(speciesData);
  const eggs = formatEggGroups(speciesData);
  const hatch = formatHatchCycles(speciesData);
  const officialHabitat = formatPokemonSpeciesHabitat(speciesData, pokemon);
  const encounterAreas = await fetchPokemonEncounterAreas(pokemon, pokeData);
  if (currentRequest !== pokedexDetailRequestId) return;
  const encounterLocations = renderPokedexEncounterLocationsHtml(encounterAreas);
  const currentStats = statsTotalsFromPokemonData(pokeData);
  const compareReference = Number.isInteger(Number(pokedexCompareId)) ? POKEMON_BY_ID.get(Number(pokedexCompareId)) : null;
  let compareHtml = "";
  if (compareReference && compareReference.id !== pokemon.id) {
    try {
      const refApiId = getMysteryApiId(compareReference);
      const refData = refApiId ? await fetchPokedexPokemonData(refApiId) : null;
      const referenceStats = statsTotalsFromPokemonData(refData);
      compareHtml = renderPokedexCompareBlock(compareReference, pokemon, referenceStats, currentStats);
    } catch {
      compareHtml = "";
    }
  }

  detail.innerHTML = `
    <div class="pokedex-detail-head">
      <div class="pokedex-detail-sticky">
        <div class="pokedex-detail-summary">
          <h3>${pokemon.name}</h3>
          <p>#${dexId}${pokemon.isAltForm ? " ? Forme alternative" : ""}</p>
          <div class="pokedex-type-row">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        </div>
      </div>
      <div class="pokedex-detail-head-main">
        <img src="${getPokedexDisplaySprite(pokemon, pokedexSelectedShiny)}" alt="${pokemon.name}" loading="lazy" data-fallback="${getSpriteUrl(dexId)}" />
        ${builderActionHtml}
      </div>
    </div>
    ${navigationHtml}
    ${recentHtml}
    ${compareHtml}
    <div class="pokedex-detail-grid">
      <div><span>Génération</span><b>Gen ${pokemon.gen}</b></div>
      <div><span>Taille</span><b>${pokemon.height} m</b></div>
      <div><span>Poids</span><b>${pokemon.weight} kg</b></div>
      <div><span>Habitat officiel</span><b>${escapeHtml(officialHabitat)}</b></div>
      <div><span>Couleur</span><b>${escapeHtml(formatColorLabel(pokemon.color))}</b></div>
      <div><span>Stade</span><b>${pokemon.stage}</b></div>
    </div>
    <div class="pokedex-section"><h4>Entrée Pokédex</h4><p>${escapeHtml(description)}</p></div>
    <div class="pokedex-section"><h4>Lieux de rencontre</h4>${encounterLocations}</div>
    <div class="pokedex-section"><h4>Talents</h4><div class="pokedex-abilities">${abilities}</div></div>
    <div class="pokedex-section"><h4>Statistiques de base</h4><div class="pokedex-stats-wrap">${stats}</div></div>
    <div class="pokedex-section"><h4>Faiblesses et résistances</h4>${typeMatchupHtml(pokemon.type1, pokemon.type2)}</div>
    <div class="pokedex-section"><h4>Évolution</h4>${evolution}</div>
    <div class="pokedex-section"><h4>Infos utiles</h4><div class="pokedex-detail-grid pokedex-extra-grid"><div><span>Capture</span><b>${captureRate}</b></div><div><span>Genre</span><b>${escapeHtml(gender)}</b></div><div><span>Groupes d'oeufs</span><b>${escapeHtml(eggs)}</b></div><div><span>Eclosion</span><b>${escapeHtml(hatch)}</b></div></div></div>
  `;
}
function defaultGameRatingEntry() {
  return {
    story: 5,
    pokemon: 5,
    region: 5,
    difficulty: 5,
    nostalgia: 5,
  };
}

function clampGameScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function normalizeGameRatingEntry(raw) {
  const base = defaultGameRatingEntry();
  const src = raw && typeof raw === "object" ? raw : {};
  for (const key of GAME_RATING_FIELDS) {
    base[key] = clampGameScore(src[key]);
  }
  return base;
}

function calcGameGlobalNote(entry) {
  let sum = 0;
  for (const key of GAME_RATING_FIELDS) sum += clampGameScore(entry[key]);
  return sum / GAME_RATING_FIELDS.length;
}

function loadGamesRanking() {
  const parsed = readJson(STORAGE_KEYS.gamesRanking, {});
  const safe = parsed && typeof parsed === "object" ? parsed : {};
  gamesRanking = {};

  for (const game of POKEMON_MAIN_GAMES) {
    gamesRanking[game.key] = normalizeGameRatingEntry(safe[game.key]);
  }
}

function saveGamesRanking() {
  writeJson(STORAGE_KEYS.gamesRanking, gamesRanking);
}

function openGamesRankingMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  stopEmulatorSession();
  closeRankingPicker();
  showScreen("screen-games-ranking");
  setGlobalNavActive("rank");
  renderGamesRankingTable();
}

function resetGamesRanking() {
  gamesRanking = {};
  loadGamesRanking();
  saveGamesRanking();
  renderGamesRankingTable();
}

function renderGamesRankingTable() {
  const wrap = document.getElementById("games-ranking-wrap");
  if (!wrap) return;

  wrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "games-ranking-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Jeu</th>
      <th>Histoire</th>
      <th>Pokémon</th>
      <th>Région</th>
      <th>Difficulté</th>
      <th>Nostalgie</th>
      <th>Note globale</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (const game of POKEMON_MAIN_GAMES) {
    const entry = normalizeGameRatingEntry(gamesRanking[game.key]);
    gamesRanking[game.key] = entry;

    const tr = document.createElement("tr");

    const tdGame = document.createElement("td");
    tdGame.className = "games-name";
    tdGame.textContent = game.name;
    tr.appendChild(tdGame);

    for (const key of GAME_RATING_FIELDS) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.className = "games-score-input";
      input.min = "1";
      input.max = "10";
      input.step = "1";
      input.value = String(entry[key]);

      const commit = () => {
        const next = clampGameScore(input.value);
        input.value = String(next);
        entry[key] = next;
        gamesRanking[game.key] = entry;
        avgValue.textContent = calcGameGlobalNote(entry).toFixed(1);
        saveGamesRanking();
      };

      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);

      td.appendChild(input);
      tr.appendChild(td);
    }

    const tdAvg = document.createElement("td");
    tdAvg.className = "games-global-note";
    const avgValue = document.createElement("b");
    avgValue.textContent = calcGameGlobalNote(entry).toFixed(1);
    tdAvg.appendChild(avgValue);
    tr.appendChild(tdAvg);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  saveGamesRanking();
}

// Standby 2026-06-11 : le combat d'arène (SimpleBattle) est désactivé côté UI
// en attendant une refonte du gameplay — repasser à true pour le réactiver.
const DRAFT_BATTLE_ENABLED = false;
const DRAFT_TEAM_SIZE = 6;
const DRAFT_PICK_COUNT = 6;
const DRAFT_SHINY_CHANCE = 0.01;
const DRAFT_SCORE_ATTACK_REROLLS = 5;
const DRAFT_SCORE_ATTACK_TARGETS = [
  { min: 600, label: "Master 600+" },
  { min: 550, label: "Elite 550+" },
  { min: 500, label: "Solide 500+" },
];
const DRAFT_POWER_CACHE = new Map();

const DRAFT_GEN_OPTIONS = [
  { gen: 1, label: "Gen 1 (Kanto)", min: 1, max: 151 },
  { gen: 2, label: "Gen 2 (Johto)", min: 152, max: 251 },
  { gen: 3, label: "Gen 3 (Hoenn)", min: 252, max: 386 },
  { gen: 4, label: "Gen 4 (Sinnoh)", min: 387, max: 493 },
  { gen: 5, label: "Gen 5 (Unys)", min: 494, max: 649 },
  { gen: 6, label: "Gen 6 (Kalos)", min: 650, max: 721 },
  { gen: 7, label: "Gen 7 (Alola)", min: 722, max: 809 },
  { gen: 8, label: "Gen 8 (Galar)", min: 810, max: 905 },
  { gen: 9, label: "Gen 9 (Paldea)", min: 906, max: 99999 },
];

const DRAFT_ARENAS_BY_GEN = {
  1: [
    { name: "Pierre", type: "Roche", badgeName: "Boulder Badge", badgeFile: "Boulder_Badge.png" },
    { name: "Ondine", type: "Eau", badgeName: "Cascade Badge", badgeFile: "Cascade_Badge.png" },
    { name: "Major Bob", type: "Électrik", badgeName: "Thunder Badge", badgeFile: "Thunder_Badge.png" },
    { name: "Erika", type: "Plante", badgeName: "Rainbow Badge", badgeFile: "Rainbow_Badge.png" },
    { name: "Koga", type: "Poison", badgeName: "Soul Badge", badgeFile: "Soul_Badge.png" },
    { name: "Sabrina", type: "Psy", badgeName: "Marsh Badge", badgeFile: "Marsh_Badge.png" },
    { name: "Blaine", type: "Feu", badgeName: "Volcano Badge", badgeFile: "Volcano_Badge.png" },
    { name: "Giovanni", type: "Sol", badgeName: "Earth Badge", badgeFile: "Earth_Badge.png" },
  ],
  2: [
    { name: "Falkner", type: "Vol", badgeName: "Zephyr Badge", badgeFile: "Zephyr_Badge.png" },
    { name: "Bugsy", type: "Insecte", badgeName: "Hive Badge", badgeFile: "Hive_Badge.png" },
    { name: "Whitney", type: "Normal", badgeName: "Plain Badge", badgeFile: "Plain_Badge.png" },
    { name: "Morty", type: "Spectre", badgeName: "Fog Badge", badgeFile: "Fog_Badge.png" },
    { name: "Chuck", type: "Combat", badgeName: "Storm Badge", badgeFile: "Storm_Badge.png" },
    { name: "Jasmine", type: "Acier", badgeName: "Mineral Badge", badgeFile: "Mineral_Badge.png" },
    { name: "Pryce", type: "Glace", badgeName: "Glacier Badge", badgeFile: "Glacier_Badge.png" },
    { name: "Clair", type: "Dragon", badgeName: "Rising Badge", badgeFile: "Rising_Badge.png" },
  ],
  3: [
    { name: "Roxanne", type: "Roche", badgeName: "Stone Badge", badgeFile: "Stone_Badge.png" },
    { name: "Brawly", type: "Combat", badgeName: "Knuckle Badge", badgeFile: "Knuckle_Badge.png" },
    { name: "Wattson", type: "Électrik", badgeName: "Dynamo Badge", badgeFile: "Dynamo_Badge.png" },
    { name: "Flannery", type: "Feu", badgeName: "Heat Badge", badgeFile: "Heat_Badge.png" },
    { name: "Norman", type: "Normal", badgeName: "Balance Badge", badgeFile: "Balance_Badge.png" },
    { name: "Winona", type: "Vol", badgeName: "Feather Badge", badgeFile: "Feather_Badge.png" },
    { name: "Tate & Liza", type: "Psy", badgeName: "Mind Badge", badgeFile: "Mind_Badge.png" },
    { name: "Wallace", type: "Eau", badgeName: "Rain Badge", badgeFile: "Rain_Badge.png" },
  ],
  4: [
    { name: "Roark", type: "Roche", badgeName: "Coal Badge", badgeFile: "Coal_Badge.png" },
    { name: "Gardenia", type: "Plante", badgeName: "Forest Badge", badgeFile: "Forest_Badge.png" },
    { name: "Maylene", type: "Combat", badgeName: "Cobble Badge", badgeFile: "Cobble_Badge.png" },
    { name: "Crasher Wake", type: "Eau", badgeName: "Fen Badge", badgeFile: "Fen_Badge.png" },
    { name: "Fantina", type: "Spectre", badgeName: "Relic Badge", badgeFile: "Relic_Badge.png" },
    { name: "Byron", type: "Acier", badgeName: "Mine Badge", badgeFile: "Mine_Badge.png" },
    { name: "Candice", type: "Glace", badgeName: "Icicle Badge", badgeFile: "Icicle_Badge.png" },
    { name: "Volkner", type: "Électrik", badgeName: "Beacon Badge", badgeFile: "Beacon_Badge.png" },
  ],
  5: [
    { name: "Aloé", type: "Normal", badgeName: "Basic Badge", badgeFile: "Basic_Badge.png" },
    { name: "Artie", type: "Insecte", badgeName: "Insect Badge", badgeFile: "Insect_Badge.png" },
    { name: "Iris", type: "Dragon", badgeName: "Legend Badge", badgeFile: "Legend_Badge.png" },
    { name: "Parsemille", type: "Sol", badgeName: "Quake Badge", badgeFile: "Quake_Badge.png" },
    { name: "Bardane", type: "Plante", badgeName: "Plant Badge", badgeFile: "Plant_Badge.png" },
    { name: "Inezia", type: "Électrik", badgeName: "Bolt Badge", badgeFile: "Bolt_Badge.png" },
    { name: "Anis", type: "Spectre", badgeName: "Toxic Badge", badgeFile: "Toxic_Badge.png" },
    { name: "Lino", type: "Eau", badgeName: "Wave Badge", badgeFile: "Wave_Badge.png" },
  ],
  6: [
    { name: "Violette", type: "Insecte", badgeName: "Bug Badge", badgeFile: "Bug_Badge.png" },
    { name: "Ramos", type: "Plante", badgeName: "Plant Badge", badgeFile: "Plant_Badge.png" },
    { name: "Korrina", type: "Combat", badgeName: "Rumble Badge", badgeFile: "Rumble_Badge.png" },
    { name: "Amaro", type: "Plante", badgeName: "Plant Badge", badgeFile: "Plant_Badge.png" },
    { name: "Lem", type: "Électrik", badgeName: "Voltage Badge", badgeFile: "Voltage_Badge.png" },
    { name: "Valériane", type: "Fée", badgeName: "Fairy Badge", badgeFile: "Fairy_Badge.png" },
    { name: "Olympia", type: "Psy", badgeName: "Psychic Badge", badgeFile: "Psychic_Badge.png" },
    { name: "Glacia", type: "Glace", badgeName: "Iceberg Badge", badgeFile: "Iceberg_Badge.png" },
  ],
  7: [
    { name: "Ilima", type: "Normal", badgeName: "Normalium Z" },
    { name: "Néphie", type: "Eau", badgeName: "Waterium Z" },
    { name: "Barbara", type: "Poison", badgeName: "Poisonium Z" },
    { name: "Kiawe", type: "Feu", badgeName: "Firium Z" },
    { name: "Margie", type: "Spectre", badgeName: "Ghostium Z" },
    { name: "Pectorius", type: "Combat", badgeName: "Fightinium Z" },
    { name: "Kahili", type: "Vol", badgeName: "Flyinium Z" },
    { name: "Alyxia", type: "Roche", badgeName: "Rockium Z" },
  ],
  8: [
    { name: "Donna", type: "Plante", badgeName: "Grass Badge", badgeFile: "Grass_Badge.png" },
    { name: "Nabil", type: "Eau", badgeName: "Water Badge", badgeFile: "Water_Badge.png" },
    { name: "Savell", type: "Feu", badgeName: "Fire Badge", badgeFile: "Fire_Badge.png" },
    { name: "Faïza", type: "Combat", badgeName: "Fighting Badge", badgeFile: "Fighting_Badge.png" },
    { name: "Sally", type: "Fée", badgeName: "Fairy Badge", badgeFile: "Fairy_Badge.png" },
    { name: "Chaz", type: "Roche", badgeName: "Rock Badge", badgeFile: "Rock_Badge.png" },
    { name: "Alistair", type: "Spectre", badgeName: "Ghost Badge", badgeFile: "Ghost_Badge.png" },
    { name: "Roy", type: "Dragon", badgeName: "Dragon Badge", badgeFile: "Dragon_Badge.png" },
  ],
  9: [
    { name: "Katy", type: "Insecte", badgeName: "Badge Insecte" },
    { name: "Mashynn", type: "Électrik", badgeName: "Badge Électrik" },
    { name: "Kofu", type: "Eau", badgeName: "Badge Eau" },
    { name: "Larry", type: "Normal", badgeName: "Badge Normal" },
    { name: "Ryme", type: "Spectre", badgeName: "Badge Spectre" },
    { name: "Tulip", type: "Psy", badgeName: "Badge Psy" },
    { name: "Grusha", type: "Glace", badgeName: "Badge Glace" },
    { name: "Alisma", type: "Sol", badgeName: "Badge Sol" },
  ],
};

const DRAFT_ARENA_SIGNATURES_BY_GEN = {
  1: {
    "Pierre": ["Racaillou", "Onix"],
    "Ondine": ["Stari", "Staross"],
    "Major Bob": ["Voltorbe", "Raichu"],
    "Erika": ["Saquedeneu", "Rafflesia"],
    "Koga": ["Smogo", "Smogogo", "Nosferalto"],
    "Sabrina": ["Kadabra", "Alakazam"],
    "Blaine": ["Caninos", "Arcanin", "Galopa"],
    "Giovanni": ["Nidoqueen", "Nidoking", "Rhinoféros"],
  },
  2: {
    "Falkner": ["Roucoups"],
    "Bugsy": ["Coconfort", "Insécateur"],
    "Whitney": ["Mélofée", "Écrémeuh"],
    "Morty": ["Spectrum", "Ectoplasma"],
    "Chuck": ["Colossinge", "Mackogneur"],
    "Jasmine": ["Magnéti", "Steelix"],
    "Pryce": ["Marcacrin", "Cochignon"],
    "Clair": ["Hypocéan", "Hyporoi"],
  },
  3: {
    "Roxanne": ["Racaillou", "Tarinor"],
    "Brawly": ["Makuhita", "Hariyama"],
    "Wattson": ["Magnéton", "Élecsprint"],
    "Flannery": ["Limagma", "Chartor"],
    "Norman": ["Vigoroth", "Monaflèmit"],
    "Winona": ["Airmure", "Altaria"],
    "Tate & Liza": ["Solaroc", "Séléroc"],
    "Wallace": ["Lovdisc", "Milobellus"],
  },
  4: {
    "Roark": ["Cranidos", "Onix"],
    "Gardenia": ["Ceribou", "Roserade"],
    "Maylene": ["Méditikka", "Lucario"],
    "Crasher Wake": ["Mustébouée", "Musteflott"],
    "Fantina": ["Magirêve", "Spectrum"],
    "Byron": ["Steelix", "Bastiodon"],
    "Candice": ["Blizzi", "Blizzaroi"],
    "Volkner": ["Luxray", "Raichu"],
  },
  5: {
    "Aloé": ["Ponchiot", "Miradar"],
    "Artie": ["Crabicoque", "Manternel"],
    "Iris": ["Drakkarmin", "Tranchodon"],
    "Parsemille": ["Minotaupe", "Crocorible"],
    "Bardane": ["Haydaim", "Fragilady"],
    "Inezia": ["Zeblitz"],
    "Anis": ["Tutankafer", "Moyade"],
    "Lino": ["Moyade"],
  },
  6: {
    "Violette": ["Prismillon"],
    "Ramos": ["Chevroum"],
    "Korrina": ["Lucario"],
    "Lem": ["Iguolta"],
    "Valériane": ["Nymphali", "Mysdibule"],
    "Olympia": ["Mistigrix"],
    "Glacia": ["Blizzaroi"],
  },
  7: {
    "Ilima": ["Manglouton"],
    "Néphie": ["Araqua", "Tarenbulle"],
    "Barbara": ["Smogogo", "Grotadmorv"],
    "Kiawe": ["Tritox", "Malamandre"],
    "Margie": ["Mimiqui"],
    "Pectorius": ["Mackogneur"],
    "Kahili": ["Bazoucan"],
    "Alyxia": ["Lougaroc"],
  },
  8: {
    "Donna": ["Tournicoton", "Blancoton"],
    "Nabil": ["Khélocrok"],
    "Savell": ["Grillepattes", "Scolocendre"],
    "Faïza": ["Mackogneur"],
    "Sally": ["Charmilly"],
    "Chaz": ["Monthracite"],
    "Alistair": ["Ectoplasma"],
    "Roy": ["Duralugon"],
  },
  9: {
    "Katy": ["Tissenboule", "Filentrappe"],
    "Larry": ["Étouraptor"],
    "Ryme": ["Téraclope", "Noctunoir"],
    "Tulip": ["Florges", "Gardevoir"],
    "Grusha": ["Altaria"],
    "Alisma": ["Terraiste"],
  },
};

const DRAFT_ARENA_TYPE_IMAGE_BY_TYPE = {
  "Normal": "Normal.png",
  "Feu": "Fire.png",
  "Eau": "Water.png",
  "Plante": "Grass.png",
  "Électrik": "Electric.png",
  "Glace": "Ice.png",
  "Combat": "Fighting.png",
  "Poison": "Poison.png",
  "Sol": "Ground.png",
  "Vol": "Flying.png",
  "Psy": "Psychic.png",
  "Insecte": "Bug.png",
  "Roche": "Rock.png",
  "Spectre": "Ghost.png",
  "Dragon": "Dragon.png",
  "Ténèbres": "Dark.png",
  "Acier": "Steel.png",
  "Fée": "Fairy.png",
};

const DRAFT_ARENA_BACKGROUND_IMAGE_BY_NAME = Object.freeze(
  Object.fromEntries(
    Object.values(DRAFT_ARENAS_BY_GEN)
      .flat()
      .filter((arena) => arena?.name && arena?.badgeFile)
      .map((arena) => [
        arena.name,
        `https://archives.bulbagarden.net/wiki/Special:Redirect/file/${arena.badgeFile}`,
      ])
  )
);

// Lot E audit : persistance de la run Draft Arènes (mode solo "arena") pour
// survivre à un refresh — la progression et les badges étaient perdus avant.
const DRAFT_ARENA_SAVE_KEY = "pokedle_draft_arena_run_v1";

function saveDraftArenaProgress() {
  try {
    if (!draftArenaState || draftArenaState.mode !== "arena") return;
    if (draftArenaState.phase === "gen") {
      localStorage.removeItem(DRAFT_ARENA_SAVE_KEY);
      return;
    }
    const snapshot = {
      ...draftArenaState,
      selectedDexIds: Array.from(draftArenaState.selectedDexIds || []),
      evaluating: false,
      scoreAttackRoom: null,
      scoreAttackRoomPending: null,
      scoreAttackRoomError: null,
    };
    localStorage.setItem(DRAFT_ARENA_SAVE_KEY, JSON.stringify(snapshot));
  } catch (_err) {
    /* quota plein ou état non sérialisable : la persistance est best-effort */
  }
}

function loadDraftArenaProgress() {
  try {
    const raw = localStorage.getItem(DRAFT_ARENA_SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.mode !== "arena" || !saved.phase || saved.phase === "gen") return null;
    saved.selectedDexIds = new Set(Array.isArray(saved.selectedDexIds) ? saved.selectedDexIds : []);
    saved.evaluating = false;
    return saved;
  } catch (_err) {
    return null;
  }
}

function clearDraftArenaProgress() {
  try { localStorage.removeItem(DRAFT_ARENA_SAVE_KEY); } catch (_err) { /* noop */ }
}

function createDraftArenaState() {
  return {
    phase: "gen", // gen | draft | battle | result
    mode: "arena",
    selectedGen: null,
    team: [],
    selectedBattlePokemonId: null,
    enemyBattleTeam: [],
    currentArenaIndex: 0,
    teamData: [],
    synergyData: null,
    selectedDexIds: new Set(),
    options: [],
    shinyCount: 0,
    badgeResults: [],
    teamPower: 0,
    teamSynergy: 0,
    runSummary: null,
    evaluating: false,
    showDetailedAnalysis: false,
    scoreAttackRerollsLeft: DRAFT_SCORE_ATTACK_REROLLS,
    scoreAttackBestAverage: 0,
    scoreAttackRoom: null,
    scoreAttackSubmitted: false,
    scoreAttackRoomPending: null,
    scoreAttackRoomError: null,
    message: "Choisis une génération pour commencer le draft.",
  };
}

function draftGenLabel(gen) {
  const found = DRAFT_GEN_OPTIONS.find((g) => g.gen === gen);
  return found ? found.label : `Gen ${gen}`;
}

function draftShinySpriteUrl(dexId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dexId}.png`;
}

function getDraftBadgeImageUrl(arena) {
  if (!arena?.badgeFile) return "";
  return `https://archives.bulbagarden.net/wiki/Special:Redirect/file/${arena.badgeFile}`;
}

function getDraftBadgeMarkup(arena, statusClass = "") {
  const badgeName = arena?.badgeName || `${arena?.type || "Badge"}`;
  const imageUrl = getDraftBadgeImageUrl(arena);
  if (imageUrl) {
    return `<span class="draft-official-badge ${statusClass}"><img src="${imageUrl}" alt="${escapeHtml(badgeName)}" loading="lazy" /></span>`;
  }
  return `<span class="draft-official-badge draft-official-badge-fallback ${statusClass}">${typeBadgeHtml(arena?.type || "Normal")}<small>${escapeHtml(badgeName)}</small></span>`;
}

function clampDraftValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function draftEraKeyForGen(gen) {
  if (gen === 1) return "gen1";
  if (gen >= 2 && gen <= 5) return "gen2-5";
  return "gen6+";
}

function getDraftTypeChart(gen) {
  return getTypeChartEffectiveness(draftEraKeyForGen(gen));
}

function getDraftAttackMultiplier(gen, attackType, defenseType) {
  if (!defenseType) return 1;
  return getTypeChartMultiplier(getDraftTypeChart(gen), attackType, defenseType);
}

function getDraftBestOffenseMultiplier(gen, pokemon, arenaType) {
  const first = getDraftAttackMultiplier(gen, pokemon.type1, arenaType);
  const second = pokemon.type2 ? getDraftAttackMultiplier(gen, pokemon.type2, arenaType) : 0;
  return Math.max(first, second);
}

function getDraftDefenseMultiplier(gen, pokemon, arenaType) {
  return getDraftAttackMultiplier(gen, arenaType, pokemon.type1) * getDraftAttackMultiplier(gen, arenaType, pokemon.type2 || null);
}

function getDraftCounterTypes(gen, arenaType) {
  return (getDraftTypeChart(gen)?.[arenaType] ? Object.keys(getDraftTypeChart(gen)) : Object.keys(TYPE_EFFECTIVENESS))
    .filter((type) => getDraftAttackMultiplier(gen, type, arenaType) > 1);
}

function getDraftFallbackStatTotal(pokemon) {
  const stage = Number(pokemon?.stage) || 1;
  const weightScore = Math.min(48, Math.round((Number(pokemon?.weight) || 0) / 4));
  const heightScore = Math.min(24, Math.round((Number(pokemon?.height) || 0) * 8));
  const dualTypeBonus = pokemon?.type2 ? 34 : 0;
  const habitatBonus = pokemon?.habitat === "Rare" ? 48 : 0;
  return clampDraftValue(255 + stage * 52 + weightScore + heightScore + dualTypeBonus + habitatBonus, 240, 680);
}

function getDraftRarityInfo(statsTotal, pokemon) {
  const rareHabitat = pokemon?.habitat === "Rare";
  if (statsTotal >= 610 || rareHabitat) return { label: "Exceptionnel", score: 12 };
  if (statsTotal >= 540) return { label: "Rare", score: 8 };
  if (statsTotal >= 470) return { label: "Solide", score: 4 };
  return { label: "Standard", score: 0 };
}

function buildDraftPowerMetrics(pokemon, stats = null) {
  const values = stats ? [stats.hp, stats.attack, stats.defense, stats.spAttack, stats.spDefense, stats.speed] : [];
  const statGlobal = values.length && values.every((value) => Number.isFinite(value))
    ? values.reduce((sum, value) => sum + value, 0)
    : getDraftFallbackStatTotal(pokemon);
  const rarity = getDraftRarityInfo(statGlobal, pokemon);
  const stageBonus = (Number(pokemon?.stage) || 1) * 4;
  const dualTypeBonus = pokemon?.type2 ? 4 : 0;
  // `power` stays as the internal balancing score for the Draft.
  // Visible UI now relies on the real base-stat total via `statGlobal`.
  const power = clampDraftValue(Math.round(statGlobal / 7.2 + rarity.score + stageBonus + dualTypeBonus), 35, 100);
  return {
    power,
    statGlobal,
    statsTotal: statGlobal,
    rarityLabel: rarity.label,
    rarityScore: rarity.score,
  };
}

function getDraftPowerCacheKey(pokemon) {
  return `${pokemon?.id || "?"}:${getPokemonSpriteId(pokemon)}`;
}

function getDraftPoolEntryKey(pokemon) {
  return String(pokemon?.id ?? getPokemonSpriteId(pokemon) ?? "?");
}

function getDraftCachedPokemonPowerData(pokemon) {
  const key = getDraftPowerCacheKey(pokemon);
  return DRAFT_POWER_CACHE.get(key) || buildDraftPowerMetrics(pokemon, null);
}

function getDraftTeamBstMetrics(team = []) {
  const members = (team || []).filter((entry) => entry?.pokemon);
  const total = members.reduce((sum, member) => sum + (Number(getDraftCachedPokemonPowerData(member.pokemon).statGlobal) || 0), 0);
  const average = members.length ? Math.round(total / members.length) : 0;
  const fullAverage = members.length >= DRAFT_TEAM_SIZE ? average : 0;
  const nextTarget = DRAFT_SCORE_ATTACK_TARGETS.slice().reverse().find((target) => average < target.min) || null;
  const rank = DRAFT_SCORE_ATTACK_TARGETS.find((target) => average >= target.min) || null;
  return { count: members.length, total, average, fullAverage, nextTarget, rank };
}

function getDraftScoreAttackResultLabel(average) {
  const rank = DRAFT_SCORE_ATTACK_TARGETS.find((target) => average >= target.min);
  return rank ? rank.label : "Run à améliorer";
}

