// ===== 🔁 Doublons : relâcher ou échanger avec un ami (3/11/2026, « go les 2 ») =====
// Dans l'album, une case attrapée s'ouvre en fiche : 🔁 Échanger (avec un ami), 🌿 Relâcher 1 doublon (+20 XP),
// ⭐ Partenaire. Jamais le dernier exemplaire ; un shiny seulement contre un shiny. Serveur : lib/wild-trades.js,
// POST /api/wild/release (lib/poke-balls.js).
const TRADE_RELEASE_XP = 20;
function tradeReleaseGain(authed, shiny) { return authed ? "+" + (shiny ? "1 500" : "15") + " ₽" : "+" + TRADE_RELEASE_XP + " XP"; }
let tradeState = null;     // GET /api/trades
let tradeFlow = null;      // { mon, shiny, friend: {pid, username}, data, want }
function tradeMon(id) { return typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(id)) || null : null; }
function tradeArt(p, shiny) { return p ? (typeof pokedexDetailArtwork === "function" ? pokedexDetailArtwork(p, shiny) : getPokemonSprite(p)) : ""; }
function tradeCounts(id) {
  const c = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures[id] : null;
  return { normal: c ? Number(c.normal) || 0 : 0, shiny: c ? Number(c.shiny) || 0 : 0 };
}
function tradePost(url, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), credentials: "same-origin" })
    .then((r) => r.json().catch(() => null)).catch(() => null);
}
function tradeGet(url) { return fetch(url, { credentials: "same-origin" }).then((r) => r.json().catch(() => null)).catch(() => null); }
const TRADE_ERRORS = {
  not_friends: "Vous n’êtes plus amis.", trade_limit: "Tu as déjà proposé 3 échanges aujourd’hui. Reviens demain !",
  too_many_pending: "Trop d’échanges en attente : attends des réponses.", not_a_duplicate: "Ce Pokémon n’est plus en double chez toi.",
  friend_not_a_duplicate: "Ton ami ne l’a plus en double.", already_proposed: "Tu as déjà proposé cet échange.",
  no_longer_available: "L’échange n’est plus possible : un des deux Pokémon n’est plus en double.", last_one: "C’est ton dernier exemplaire : il reste dans ton album.",
  release_limit: "Tu as déjà relâché 10 doublons aujourd’hui.",
  release_changed: "Ta collection a changé entre-temps : rien n’a été relâché, regarde la fiche à jour.",
  previous_action: "Ton relâchement précédent a été terminé. Regarde la fiche à jour.",
  reload_required: "Recharge la page pour relâcher un doublon.", account_changed: "Tu as changé de compte : recharge la page.",
  storage_unavailable: "Ton navigateur bloque l’enregistrement de l’action : réessaie hors navigation privée.", login: "Connecte-toi pour échanger avec tes amis.", rate_limited: "Doucement ! Réessaie dans un moment."
};
function tradeError(data) { return TRADE_ERRORS[data && data.error] || "Ça n’a pas marché. Réessaie dans un instant."; }
function tradeBallSvg() { return typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪"; }

// --- La fiche d'un Pokémon attrapé (depuis l'album) ---
function openTradeMon(id) {
  const p = tradeMon(id);
  if (!p) return;
  const n = tradeCounts(p.id);
  const dupe = n.normal > 1 || n.shiny > 1;
  const shinyDupe = n.normal <= 1 && n.shiny > 1;
  const authed = Boolean(window.__pokedleAuthed);
  const row = (icon, bg, title, sub, action, args, right, disabled) => '<button type="button" class="tm-act"' + (disabled ? " disabled" : "") + ' data-action="' + action + '"' + (args ? " data-args='" + args + "'" : "") + '>' +
    '<span class="tm-ic" style="background:' + bg + '">' + icon + '</span><span class="tm-tx"><b>' + title + '</b><small>' + sub + '</small></span><span class="tm-r">' + (right || "›") + '</span></button>';
  const html = '<div class="tm">' +
    '<div class="tm-mon"><img src="' + escapeHtml(tradeArt(p, shinyDupe)) + '" alt="" draggable="false" style="--t1:' + (typeof pokemonTypeColor === "function" ? pokemonTypeColor(p.type1) : "#6890f0") + '">' +
    '<div><h3>' + escapeHtml(p.name) + '</h3><p>N° ' + String(p.id).padStart(3, "0") + ' · ' + escapeHtml([p.type1, p.type2].filter(Boolean).join(" / ")) + '</p>' +
    '<div class="tm-cnt"><span>' + tradeBallSvg() + ' ×' + n.normal + ' attrapé' + (n.normal > 1 ? "s" : "") + '</span><span class="is-sh">✨ ×' + n.shiny + '</span></div></div></div>' +
    '<div class="tm-acts">' +
    (dupe ? row("🔁", "#E9EEFB", "Échanger avec un ami", authed ? "Contre un Pokémon qui te manque" : "Connecte-toi pour échanger", "tradeStart", JSON.stringify([p.id, shinyDupe]), "", !authed) : "") +
    (n.normal > 1 ? row("🌿", "#E8F6EC", "Relâcher 1 doublon", "Il retourne dans les herbes", "tradeRelease", JSON.stringify([p.id, false]), tradeReleaseGain(authed, false)) : "") +
    (n.shiny > 1 ? row("✨", "#FFF1C9", "Relâcher 1 shiny en double", "Le dernier shiny reste toujours", "tradeRelease", JSON.stringify([p.id, true]), tradeReleaseGain(authed, true)) : "") +
    row("⭐", "#FFF1C9", "Choisir comme partenaire", "Il s’affiche sur ta carte de dresseur", "tradePartner", JSON.stringify([p.id])) +
    '</div><p class="tm-keep">' + (dupe ? "Le dernier exemplaire est toujours gardé : on ne peut ni l’échanger ni le relâcher." : "Attrape-le encore une fois dans les hautes herbes pour pouvoir l’échanger.") + '</p></div>';
  ensureOverlay("📒 " + p.name, html);
}
function tradePartner(id) {
  closeOverlayModal();
  if (typeof choosePartner === "function") { choosePartner(Number(id)); if (typeof showToast === "function") showToast("⭐ " + (tradeMon(id)?.name || "Ton Pokémon") + " est ton partenaire !"); }
}
// V2-REL-01 (7/11) : relâcher demande toujours une confirmation (surtout pour un shiny), et l'action part avec
// un identifiant gardé par le navigateur (comme un achat) : un double appui ou une réponse perdue ne relâche
// jamais deux doublons. Le serveur refuse si le nombre d'exemplaires a changé entre-temps.
function tradeRelease(id, shiny) {
  const p = tradeMon(id), n = tradeCounts(id), have = shiny ? n.shiny : n.normal;
  if (!p || have < 2) { openTradeMon(id); return; }
  const authed = Boolean(window.__pokedleAuthed);
  ensureOverlay("🌿 Relâcher " + p.name + (shiny ? " ✨" : ""),
    '<div class="tm tm-confirm' + (shiny ? " is-shiny" : "") + '">' +
      '<div class="tm-mon"><img src="' + escapeHtml(tradeArt(p, shiny)) + '" alt="" draggable="false"><div><h3>Relâcher 1 ' + escapeHtml(p.name) + (shiny ? ' <b>shiny</b>' : "") + ' ?</h3>' +
      '<p>Il retourne dans les herbes. Tu en gardes ' + (have - 1) + ' (×' + have + ' → ×' + (have - 1) + ').</p><p class="tm-gain">' + tradeReleaseGain(authed, shiny) + '</p></div></div>' +
      '<div class="tm-confirm-btns"><button type="button" class="btn-blue" data-action="tradeReleaseConfirm" data-args=\'' + JSON.stringify([p.id, Boolean(shiny), have]) + '\'>🌿 Oui, relâcher</button>' +
      '<button type="button" class="btn-ghost" data-action="openTradeMon" data-args=\'' + JSON.stringify([p.id]) + '\'>Annuler</button></div>' +
    '</div>');
}
let tradeReleaseBusy = false;
function tradeReleaseConfirm(id, shiny, expectedCount) {
  if (tradeReleaseBusy) return;
  const p = tradeMon(id);
  tradeReleaseBusy = true;
  document.querySelectorAll('.tm-confirm-btns button').forEach((b) => { b.disabled = true; });
  const send = typeof ballPaidAction === "function" ? ballPaidAction("/api/wild/release", { id: Number(id), shiny: Boolean(shiny), expectedCount: Number(expectedCount) })
    : Promise.resolve({ ok: false, error: "reload_required" });
  send.then((data) => {
    if (!data || !data.ok) {
      if (typeof showToast === "function") showToast(tradeError(data));
      if (data && ["release_changed", "previous_action", "last_one"].includes(data.error) && typeof ballFetch === "function") {
        return ballFetch("/api/wild/collection").then((d) => { if (d && d.ok && typeof wildSyncAlbum === "function") wildSyncAlbum(d.captures); openTradeMon(id); });
      }
      openTradeMon(id);
      return;
    }
    if (typeof wildSyncAlbum === "function") wildSyncAlbum(data.captures);
    // 💰 Avec un compte, le doublon rapporte des Pokédollars (15 ₽, 1 500 ₽ pour un shiny) ; sans compte, de l'XP comme avant.
    // Une réponse rejouée (même action) ne redonne rien.
    const coins = Number(data.coinsEarned) || 0;
    if (coins > 0) { if (typeof ballApply === "function") ballApply(data, { announce: false }); }
    else if (!data.replayed && typeof awardXp === "function") awardXp(TRADE_RELEASE_XP, "Doublon relâché : " + (p ? p.name : ""));
    if (typeof moSfx === "function") moSfx("sparkle");
    if (typeof showToast === "function") showToast("🌿 " + (p ? p.name : "Le Pokémon") + " retourne dans les herbes · +" + (coins > 0 ? coins.toLocaleString("fr-FR") + " ₽" : TRADE_RELEASE_XP + " XP"));
    openTradeMon(id);
  }).finally(() => { tradeReleaseBusy = false; });
}

// --- L'échange : choisir un ami, puis un de ses doublons ---
function tradeStart(id, shiny) {
  tradeFlow = { mon: Number(id), shiny: Boolean(shiny), friend: null, data: null, want: null };
  ensureOverlay("🔁 Échange", '<p class="tr-wait">Chargement de tes amis…</p>');
  tradeGet("/api/friends").then((d) => {
    const friends = d && d.ok ? d.friends || [] : [];
    if (!friends.length) {
      ensureOverlay("🔁 Échange", '<div class="tr-empty"><p>Il te faut un ami pour échanger.</p><p>Clique sur un pseudo dans un classement, puis 🤝 Ajouter en ami.</p></div>');
      return;
    }
    ensureOverlay("🔁 Échange", '<div class="tr"><h4>Avec qui ?</h4><div class="tr-friends">' + friends.map((f) =>
      '<button type="button" class="tr-friend" data-action="tradePickFriend" data-args=\'' + JSON.stringify([f.pid, f.username]).replace(/'/g, "&#39;") + '\'>' +
      '<i>' + escapeHtml((f.username || "?").slice(0, 1).toUpperCase()) + '</i><b>' + escapeHtml(f.username) + '</b><span>›</span></button>').join("") + '</div></div>');
  });
}
function tradePickFriend(pid, username) {
  if (!tradeFlow) return;
  tradeFlow.friend = { pid, username };
  ensureOverlay("🔁 Échange", '<p class="tr-wait">On regarde les doublons de ' + escapeHtml(username) + '…</p>');
  tradeGet("/api/trades/friend?pid=" + encodeURIComponent(pid)).then((d) => {
    if (!d || !d.ok) { ensureOverlay("🔁 Échange", '<div class="tr-empty"><p>' + escapeHtml(tradeError(d)) + '</p></div>'); return; }
    tradeFlow.data = d;
    const list = d.dupes.filter((x) => (tradeFlow.shiny ? x.shiny : x.normal) > 0);
    const owned = new Set(d.owned || []);
    tradeFlow.want = (list.find((x) => !owned.has(x.id)) || list[0] || {}).id || null;
    renderTradeForm();
  });
}
function tradePickWant(id) { if (tradeFlow) { tradeFlow.want = Number(id); renderTradeForm(); } }
function tradePickGive(id) { if (tradeFlow) { tradeFlow.mon = Number(id); renderTradeForm(); } }
function renderTradeForm() {
  const f = tradeFlow, d = f && f.data;
  if (!d) return;
  if (f.reverse) return renderTradeFormReverse();
  const give = tradeMon(f.mon), want = tradeMon(f.want);
  const owned = new Set(d.owned || []);
  const list = d.dupes.filter((x) => (f.shiny ? x.shiny : x.normal) > 0);
  const card = (label, p, cls) => '<div class="tr-card ' + cls + '"><small>' + label + '</small>' + (p ? '<img src="' + escapeHtml(tradeArt(p, f.shiny)) + '" alt="" draggable="false"><b>' + escapeHtml(p.name) + (f.shiny ? " ✨" : "") + '</b>' : '<span class="tr-q">?</span><b>Choisis</b>') + '</div>';
  ensureOverlay("🔁 Échange", '<div class="tr">' +
    '<div class="tr-with"><i>' + escapeHtml(f.friend.username.slice(0, 1).toUpperCase()) + '</i>' + escapeHtml(f.friend.username) + '</div>' +
    '<div class="tr-pair">' + card("TU DONNES", give, "") + '<span class="tr-arrow" aria-hidden="true">⇄</span>' + card("TU REÇOIS", want, "is-want") + '</div>' +
    '<h4>Les doublons ' + (f.shiny ? "shiny " : "") + 'de ' + escapeHtml(f.friend.username) + '</h4>' +
    (list.length ? '<div class="tr-mini">' + list.map((x) => {
      const p = tradeMon(x.id); if (!p) return "";
      return '<button type="button" class="' + (x.id === f.want ? "is-on " : "") + (owned.has(x.id) ? "" : "is-new") + '" data-action="tradePickWant" data-args="[' + x.id + ']">' +
        (owned.has(x.id) ? "" : '<em>Il te manque</em>') + '<img src="' + escapeHtml(tradeArt(p, f.shiny)) + '" alt="" loading="lazy" draggable="false">' + escapeHtml(p.name) + '</button>';
    }).join("") + '</div>' : '<p class="tr-empty">' + escapeHtml(f.friend.username) + (d.hidden ? ' a choisi de ne pas montrer ses doublons.' : ' n’a pas encore de doublon' + (f.shiny ? " shiny" : "") + '. Revenez après quelques captures !') + '</p>') +
    '<button type="button" class="btn-blue tr-send" data-action="tradeSend"' + (f.want ? "" : " disabled") + '>Proposer l’échange à ' + escapeHtml(f.friend.username) + '</button>' +
    '<p class="tr-rule">Entre amis seulement. ' + escapeHtml(f.friend.username) + ' doit accepter. 3 échanges par jour.<br>Un shiny s’échange seulement contre un shiny.</p></div>');
}
// --- PART-04 · 🔍 Trouver : partir d'un doublon d'un ami, puis choisir ce qu'on donne ---
function tradeStartWant(pid, username, id, shiny) {
  tradeFlow = { mon: null, want: Number(id), shiny: Boolean(shiny), friend: { pid, username }, data: null, reverse: true };
  ensureOverlay("🔁 Échange avec " + username, '<p class="tr-wait">On prépare l’échange…</p>');
  tradeGet("/api/trades/friend?pid=" + encodeURIComponent(pid)).then((d) => {
    if (!tradeFlow || tradeFlow.friend.pid !== pid) return;
    if (!d || !d.ok) { ensureOverlay("🔁 Échange", '<div class="tr-empty"><p>' + escapeHtml(tradeError(d)) + '</p></div>'); return; }
    tradeFlow.data = d;
    const mine = (d.mine || []).filter((x) => (tradeFlow.shiny ? x.shiny : x.normal) > 0 && x.id !== tradeFlow.want);
    tradeFlow.mon = (mine[0] || {}).id || null;
    renderTradeForm();
  });
}
function renderTradeFormReverse() {
  const f = tradeFlow, d = f.data;
  const give = tradeMon(f.mon), want = tradeMon(f.want);
  const still = !d.hidden && (d.dupes || []).some((x) => x.id === f.want && (f.shiny ? x.shiny : x.normal) > 0);
  const mine = (d.mine || []).filter((x) => (f.shiny ? x.shiny : x.normal) > 0 && x.id !== f.want);
  const card = (label, p, cls) => '<div class="tr-card ' + cls + '"><small>' + label + '</small>' + (p ? '<img src="' + escapeHtml(tradeArt(p, f.shiny)) + '" alt="" draggable="false"><b>' + escapeHtml(p.name) + (f.shiny ? " ✨" : "") + '</b>' : '<span class="tr-q">?</span><b>Choisis</b>') + '</div>';
  const who = escapeHtml(f.friend.username);
  ensureOverlay("🔁 Échange avec " + f.friend.username, '<div class="tr">' +
    '<div class="tr-pair">' + card("TU DONNES", give, "") + '<span class="tr-arrow" aria-hidden="true">⇄</span>' + card("TU REÇOIS", want, "is-want") + '</div>' +
    (!still ? '<p class="tr-empty">' + who + ' n’a plus ' + escapeHtml(want ? want.name : "ce Pokémon") + (f.shiny ? " shiny" : "") + ' en double.</p>' :
      '<h4>Choisis un de tes doublons' + (f.shiny ? " shiny" : "") + '</h4>' +
      (mine.length ? '<div class="tr-mini">' + mine.map((x) => {
        const p = tradeMon(x.id); if (!p) return "";
        return '<button type="button" class="' + (x.id === f.mon ? "is-on" : "") + '" data-action="tradePickGive" data-args="[' + x.id + ']">' +
          '<img src="' + escapeHtml(tradeArt(p, f.shiny)) + '" alt="" loading="lazy" draggable="false">' + escapeHtml(p.name) + ' ×' + ((f.shiny ? x.shiny : x.normal) + 1) + '</button>';
      }).join("") + '</div>' : '<p class="tr-empty">Tu n’as pas encore de doublon' + (f.shiny ? " shiny" : "") + ' à donner. Attrape encore quelques Pokémon dans les 🌿 hautes herbes !</p>')) +
    '<button type="button" class="btn-blue tr-send" data-action="tradeSend"' + (still && f.mon && f.want ? "" : " disabled") + '>Proposer l’échange à ' + who + '</button>' +
    '<p class="tr-rule">Mêmes règles : entre amis, ' + who + ' doit accepter, 3 échanges par jour.<br>Un shiny s’échange seulement contre un shiny ; ton dernier exemplaire est toujours gardé.</p>' +
    '<button type="button" class="btn-ghost tr-back" data-action="openMyTrades" data-args=\'["find"]\'>← Retour à la recherche</button></div>');
}

let tradeTab = null;
let tradeFind = { data: null, q: "", filter: "missing", open: {} };
function tradeFold(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function tradeFindItems(friend) {
  const d = tradeFind.data, owned = new Set(d && d.owned || []);
  const q = tradeFold(tradeFind.q);
  const shiny = tradeFind.filter === "shiny";
  return friend.dupes.filter((x) => {
    if ((shiny ? x.shiny : x.normal) <= 0) return false;
    if (tradeFind.filter === "missing" && owned.has(x.id)) return false;
    if (!q) return true;
    const p = tradeMon(x.id);
    return Boolean(p) && (tradeFold(p.name).includes(q) || String(x.id) === q.replace(/^0+/, ""));
  });
}
function tradeFindResultsHtml() {
  const d = tradeFind.data;
  if (!d) return '<p class="tr-wait">Chargement…</p>';
  if (!d.friendCount) return '<div class="tr-empty"><p>Il te faut un ami pour échanger.</p><p>Clique sur un pseudo dans un classement, puis 🤝 Ajouter en ami.</p></div>';
  const owned = new Set(d.owned || []);
  const shiny = tradeFind.filter === "shiny";
  const blocks = d.friends.map((f) => {
    const items = tradeFindItems(f);
    if (!items.length) return "";
    const open = tradeFind.open[f.pid] || tradeFind.q;
    const shown = open ? items : items.slice(0, 6);
    const missing = items.filter((x) => !owned.has(x.id)).length;
    return '<div class="trf-friend"><div class="trf-top"><i>' + escapeHtml((f.username || "?").slice(0, 1).toUpperCase()) + '</i><b>' + escapeHtml(f.username) + '</b><small>' +
      (missing ? missing + " qui te manque" + (missing > 1 ? "nt" : "") : items.length + " doublon" + (items.length > 1 ? "s" : "")) + '</small></div>' +
      '<div class="tr-mini">' + shown.map((x) => {
        const p = tradeMon(x.id); if (!p) return "";
        return '<button type="button" class="' + (owned.has(x.id) ? "" : "is-new") + '" data-action="tradeStartWant" data-args=\'' + JSON.stringify([f.pid, f.username, x.id, shiny]).replace(/'/g, "&#39;") + '\'>' +
          (owned.has(x.id) ? "" : '<em>Il te manque</em>') + '<img src="' + escapeHtml(tradeArt(p, shiny)) + '" alt="" loading="lazy" draggable="false">' + escapeHtml(p.name) + (shiny ? " ✨" : "") + '</button>';
      }).join("") + (items.length > shown.length ? '<button type="button" class="trf-more" data-action="tradeFindOpen" data-args=\'' + JSON.stringify([f.pid]).replace(/'/g, "&#39;") + '\'>+' + (items.length - shown.length) + ' ›</button>' : "") + '</div></div>';
  }).join("");
  return blocks || '<p class="tr-empty">' + (tradeFind.q ? "Aucun ami n’a « " + escapeHtml(tradeFind.q) + " » en double." : tradeFind.filter === "missing" ? "Tes amis n’ont pas de doublon qui te manque pour l’instant." : "Tes amis n’ont pas encore de doublon" + (shiny ? " shiny" : "") + ".") + '</p>';
}
function tradeFindHtml() {
  const d = tradeFind.data || {};
  const chip = (key, label) => '<button type="button" class="' + (tradeFind.filter === key ? "is-on" : "") + '" data-action="tradeFindFilter" data-args=\'["' + key + '"]\' aria-pressed="' + (tradeFind.filter === key) + '">' + label + '</button>';
  const share = d.shareDupes !== false;
  return '<label class="trf-search"><span aria-hidden="true">🔎</span><input id="trf-q" type="search" autocomplete="off" placeholder="Cherche un Pokémon (ex. Évoli)" value="' + escapeHtml(tradeFind.q) + '" aria-label="Chercher un Pokémon chez tes amis"></label>' +
    '<div class="trf-chips">' + chip("missing", "Il me manque") + chip("all", "Tous") + chip("shiny", "✨ Shiny") + '</div>' +
    '<h4>' + (tradeFind.filter === "missing" ? "Doublons de tes amis qui te manquent" : tradeFind.filter === "shiny" ? "Shinies en double chez tes amis" : "Tous les doublons de tes amis") + '</h4>' +
    '<div id="trf-res">' + tradeFindResultsHtml() + '</div>' +
    '<p class="trf-note">🔒 Tu vois seulement les <b>doublons</b> de tes amis, jamais tout leur album ni ce qui leur manque. Encore <b>' + (Number(d.left) || 0) + ' / ' + (Number(d.perDay) || 3) + '</b> proposition' + (Number(d.left) > 1 ? "s" : "") + ' aujourd’hui.</p>' +
    '<button type="button" class="trf-share" role="switch" aria-checked="' + share + '" data-action="tradeToggleShare"><span><b>Montrer mes doublons à mes amis</b><small>' + (share ? "Tes amis peuvent te proposer un échange." : "Caché : tes amis ne voient pas tes doublons et ne peuvent pas te les demander.") + '</small></span><i aria-hidden="true"></i></button>';
}
function tradeFindFilter(key) { tradeFind.filter = ["missing", "all", "shiny"].includes(key) ? key : "missing"; renderMyTrades(); }
function tradeFindOpen(pid) { tradeFind.open[pid] = true; const r = document.getElementById("trf-res"); if (r) r.innerHTML = tradeFindResultsHtml(); }
function tradeToggleShare() {
  const d = tradeFind.data;
  if (!d) return;
  const next = d.shareDupes === false;
  tradePost("/api/trades/settings", { share: next }).then((r) => {
    if (!r || !r.ok) { if (typeof showToast === "function") showToast(tradeError(r)); return; }
    d.shareDupes = r.shareDupes;
    if (typeof showToast === "function") showToast(r.shareDupes ? "Tes amis voient de nouveau tes doublons." : "Tes doublons sont cachés à tes amis.");
    renderMyTrades();
  });
}
function tradeBindSearch() {
  const input = document.getElementById("trf-q");
  if (!input || input.dataset.bound) return;
  input.dataset.bound = "1";
  input.addEventListener("input", () => {
    tradeFind.q = input.value.slice(0, 40);
    const r = document.getElementById("trf-res");
    if (r) r.innerHTML = tradeFindResultsHtml();
  });
}

function tradeSend() {
  const f = tradeFlow;
  if (!f || !f.want) return;
  tradePost("/api/trades/propose", { pid: f.friend.pid, give: f.mon, want: f.want, shiny: f.shiny }).then((d) => {
    if (!d || !d.ok) { if (typeof showToast === "function") showToast(tradeError(d)); return; }
    closeOverlayModal();
    if (typeof moSfx === "function") moSfx("collect");
    if (typeof showToast === "function") showToast("🔁 Échange proposé à " + f.friend.username + " !");
    tradeFlow = null;
    tradeRefresh();
  });
}

// --- 🔁 Mes échanges : reçus, envoyés, résultats ---
function tradePendingCount() { return tradeState ? (Number(tradeState.incoming) || 0) + (Number(tradeState.news) || 0) : 0; }
function tradeRefresh() {
  if (!window.__pokedleAuthed) return Promise.resolve(null);
  return tradeGet("/api/trades").then((d) => {
    if (d && d.ok) { tradeState = d; if (typeof renderInboxUi === "function") renderInboxUi(); }
    return tradeState;
  });
}
function tradeRowHtml(t) {
  const give = tradeMon(t.giveId), want = tradeMon(t.wantId);
  // Vu de mon côté : ce que je donne et ce que je reçois.
  const mineGive = t.mine ? give : want, mineGet = t.mine ? want : give;
  const who = escapeHtml(t.other.username);
  const status = { pending: t.mine ? "En attente de " + who : who + " te propose", accepted: "✓ Échange fait", declined: "Refusé", cancelled: "Annulé", expired: "Expiré", failed: "Plus possible" }[t.status] || "";
  const mon = (p) => p ? '<span class="trl-mon"><img src="' + escapeHtml(tradeArt(p, t.shiny)) + '" alt="" loading="lazy" draggable="false"><b>' + escapeHtml(p.name) + (t.shiny ? " ✨" : "") + '</b></span>' : "";
  const actions = t.status !== "pending" ? "" : t.mine
    ? '<button type="button" class="btn-ghost" data-action="tradeCancel" data-args="[' + t.id + ']">Annuler</button>'
    : '<button type="button" class="btn-blue" data-action="tradeAnswer" data-args="[' + t.id + ',true]">Accepter</button><button type="button" class="btn-ghost" data-action="tradeAnswer" data-args="[' + t.id + ',false]">Refuser</button>';
  return '<div class="trl' + (t.status === "pending" && !t.mine ? " is-hot" : "") + '"><div class="trl-top"><span>' + status + '</span>' + (t.mine && t.status === "pending" ? "" : "<small>" + who + "</small>") + '</div>' +
    '<div class="trl-pair">' + mon(mineGive) + '<span class="tr-arrow">⇄</span>' + mon(mineGet) + '</div>' +
    '<div class="trl-legend"><small>Tu donnes</small><small>Tu reçois</small></div>' + (actions ? '<div class="trl-acts">' + actions + '</div>' : "") + '</div>';
}
function openMyTrades(tab) {
  ensureOverlay("🔁 Mes échanges", '<p class="tr-wait">Chargement…</p>');
  if (typeof tab === "string") tradeTab = tab;
  Promise.all([tradeRefresh(), typeof loadWildCaptures === "function" ? loadWildCaptures() : null,
    window.__pokedleAuthed ? tradeGet("/api/trades/matches") : null]).then(([, , matches]) => {
    if (matches && matches.ok) tradeFind.data = matches;
    const s = tradeState;
    if (!s) { ensureOverlay("🔁 Mes échanges", '<div class="tr-empty"><p>Connecte-toi pour échanger avec tes amis.</p></div>'); return; }
    if (!tradeTab) tradeTab = s.trades.some((t) => !t.mine && t.status === "pending") ? "in" : "find";
    renderMyTrades();
    if (s.news) tradePost("/api/trades/seen", {}).then(() => { if (tradeState) { tradeState.news = 0; if (typeof renderInboxUi === "function") renderInboxUi(); } });
  });
}
// 3 onglets (PART-04) : 🔍 Trouver · Reçus · Envoyés (et les derniers échanges).
function renderMyTrades() {
  const s = tradeState;
  if (!s) return;
  const incoming = s.trades.filter((t) => !t.mine && t.status === "pending");
  const outgoing = s.trades.filter((t) => t.mine && t.status === "pending");
  const done = s.trades.filter((t) => t.status !== "pending").slice(0, 10);
  const block = (title, list) => list.length ? '<h4>' + title + '</h4>' + list.map(tradeRowHtml).join("") : "";
  const tab = (key, label) => '<button type="button" role="tab" aria-selected="' + (tradeTab === key) + '" class="' + (tradeTab === key ? "is-on" : "") + '" data-action="tradeShowTab" data-args=\'["' + key + '"]\'>' + label + '</button>';
  const body = tradeTab === "find" ? tradeFindHtml()
    : tradeTab === "in" ? (block("Reçus", incoming) || '<p class="tr-empty">Aucune proposition reçue pour l’instant.</p>')
    : (block("Envoyés", outgoing) + block("Derniers échanges", done) || '<p class="tr-empty">Aucun échange envoyé pour l’instant.</p>');
  ensureOverlay("🔁 Mes échanges", '<div class="trs">' +
    '<div class="trs-tabs" role="tablist">' + tab("find", "🔍 Trouver") + tab("in", "Reçus" + (incoming.length ? " · " + incoming.length : "")) + tab("out", "Envoyés") + '</div>' +
    body + (tradeTab === "find" ? "" : '<button type="button" class="btn-ghost trs-album" data-action="tradeOpenAlbum">📒 Ouvrir mon album</button>') + '</div>');
  if (tradeTab === "find") tradeBindSearch();
}
function tradeShowTab(key) { tradeTab = ["find", "in", "out"].includes(key) ? key : "find"; renderMyTrades(); }
function tradeOpenAlbum() { closeOverlayModal(); if (typeof openAlbumBinder === "function") openAlbumBinder(); }
function tradeCancel(id) {
  tradePost("/api/trades/cancel", { id: Number(id) }).then((d) => { if (!d || !d.ok) { if (typeof showToast === "function") showToast(tradeError(d)); } openMyTrades(); });
}
function tradeAnswer(id, accept) {
  tradePost("/api/trades/respond", { id: Number(id), accept: Boolean(accept) }).then((d) => {
    if (!d || !d.ok) { if (typeof showToast === "function") showToast(tradeError(d)); openMyTrades(); return; }
    if (!accept) { if (typeof showToast === "function") showToast("Échange refusé."); openMyTrades(); return; }
    const p = tradeMon(d.received.id), first = !tradeCounts(d.received.id).normal && !tradeCounts(d.received.id).shiny;
    const after = () => {
      closeOverlayModal();
      if (p && first && typeof fxCaptureCard === "function") {
        if (typeof addDiscovery === "function" && typeof playerProfile !== "undefined" && playerProfile) { playerProfile.discoveries ||= {}; if (addDiscovery(playerProfile.discoveries, p, "capture") && typeof saveProfile === "function") saveProfile(); }
        fxCaptureCard(p, d.received.shiny, Object.keys(wildCaptures || {}).length, "trade");
      } else if (typeof showToast === "function") showToast("🔁 " + (p ? p.name : "Ton Pokémon") + " rejoint ton album !");
      tradeRefresh();
    };
    if (typeof moSfx === "function") moSfx("caught");
    if (typeof wildCaptures !== "undefined") wildCaptures = null;
    (typeof loadWildCaptures === "function" ? loadWildCaptures() : Promise.resolve()).then(after, after);
  });
}

// --- Dans l'album : une case attrapée s'ouvre en fiche ---
if (typeof albumSlotHtml === "function") {
  const albumSlotHtmlBeforeTrades = albumSlotHtml;
  albumSlotHtml = function (p) {
    const html = albumSlotHtmlBeforeTrades.apply(this, arguments);
    const n = tradeCounts(p.id);
    if (!n.normal && !n.shiny) return html;
    const dupe = n.normal > 1 || n.shiny > 1;
    return html.replace('<div class="alb-slot', '<div role="button" tabindex="0" data-action="openTradeMon" data-args="[' + Number(p.id) + ']" aria-label="' + escapeHtml(p.name) + (dupe ? ", en double" : "") + '" class="alb-slot is-tap' + (dupe ? " has-dupe" : ""));
  };
}
// Une case de « Ma collection » (Pokédex) attrapée en double garde sa fiche Pokédex ; la pastille mène à l'échange.

// Pastille et ligne d'accueil, comme les demandes d'ami.
if (typeof frHomeLineHtml === "function") {
  const frHomeLineHtmlBeforeTrades = frHomeLineHtml;
  frHomeLineHtml = function () {
    const out = frHomeLineHtmlBeforeTrades.apply(this, arguments) || "";
    const t = tradeState && tradeState.trades ? tradeState.trades.find((x) => !x.mine && x.status === "pending") : null;
    return out + (t ? '<button type="button" class="home-inbox-line" data-action="openMyTrades"><span>🔁 ' + escapeHtml(t.other.username) + ' te propose un échange</span><b>Voir →</b></button>' : "");
  };
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("load", () => {
    const fromPush = /[?&]echanges=1/.test(location.search);
    setTimeout(() => { tradeRefresh().then(() => { if (fromPush && tradeState) openMyTrades(); }); }, fromPush ? 600 : 2600);
  });
}
Object.assign(window, { tradeStartWant, tradePickGive, tradeFindFilter, tradeFindOpen, tradeToggleShare, tradeShowTab, renderMyTrades,
  openTradeMon, tradePartner, tradeRelease, tradeReleaseConfirm, tradeStart, tradePickFriend, tradePickWant, tradeSend, openMyTrades, tradeCancel, tradeAnswer, tradeOpenAlbum, tradePendingCount });
