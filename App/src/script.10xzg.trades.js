// ===== 🔁 Doublons : relâcher ou échanger avec un ami (3/11/2026, « go les 2 ») =====
// Dans l'album, une case attrapée s'ouvre en fiche : 🔁 Échanger (avec un ami), 🌿 Relâcher 1 doublon (+20 XP),
// ⭐ Partenaire. Jamais le dernier exemplaire ; un shiny seulement contre un shiny. Serveur : lib/wild-trades.js,
// POST /api/wild/release (lib/poke-balls.js).
const TRADE_RELEASE_XP = 20;
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
  release_limit: "Tu as déjà relâché 10 doublons aujourd’hui.", login: "Connecte-toi pour échanger avec tes amis.", rate_limited: "Doucement ! Réessaie dans un moment."
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
    (n.normal > 1 ? row("🌿", "#E8F6EC", "Relâcher 1 doublon", "Il retourne dans les herbes", "tradeRelease", JSON.stringify([p.id, false]), "+" + TRADE_RELEASE_XP + " XP") : "") +
    (n.shiny > 1 ? row("✨", "#FFF1C9", "Relâcher 1 shiny en double", "Le dernier shiny reste toujours", "tradeRelease", JSON.stringify([p.id, true]), "+" + TRADE_RELEASE_XP + " XP") : "") +
    row("⭐", "#FFF1C9", "Choisir comme partenaire", "Il s’affiche sur ta carte de dresseur", "tradePartner", JSON.stringify([p.id])) +
    '</div><p class="tm-keep">' + (dupe ? "Le dernier exemplaire est toujours gardé : on ne peut ni l’échanger ni le relâcher." : "Attrape-le encore une fois dans les hautes herbes pour pouvoir l’échanger.") + '</p></div>';
  ensureOverlay("📒 " + p.name, html);
}
function tradePartner(id) {
  closeOverlayModal();
  if (typeof choosePartner === "function") { choosePartner(Number(id)); if (typeof showToast === "function") showToast("⭐ " + (tradeMon(id)?.name || "Ton Pokémon") + " est ton partenaire !"); }
}
function tradeRelease(id, shiny) {
  const p = tradeMon(id);
  tradePost("/api/wild/release", { id: Number(id), shiny: Boolean(shiny) }).then((data) => {
    if (!data || !data.ok) { if (typeof showToast === "function") showToast(tradeError(data)); return; }
    if (typeof wildSyncAlbum === "function") wildSyncAlbum(data.captures);
    if (typeof awardXp === "function") awardXp(TRADE_RELEASE_XP, "Doublon relâché : " + (p ? p.name : ""));
    if (typeof moSfx === "function") moSfx("sparkle");
    if (typeof showToast === "function") showToast("🌿 " + (p ? p.name : "Le Pokémon") + " retourne dans les herbes · +" + TRADE_RELEASE_XP + " XP");
    openTradeMon(id);
  });
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
function renderTradeForm() {
  const f = tradeFlow, d = f && f.data;
  if (!d) return;
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
    }).join("") + '</div>' : '<p class="tr-empty">' + escapeHtml(f.friend.username) + ' n’a pas encore de doublon' + (f.shiny ? " shiny" : "") + '. Revenez après quelques captures !</p>') +
    '<button type="button" class="btn-blue tr-send" data-action="tradeSend"' + (f.want ? "" : " disabled") + '>Proposer l’échange à ' + escapeHtml(f.friend.username) + '</button>' +
    '<p class="tr-rule">Entre amis seulement. ' + escapeHtml(f.friend.username) + ' doit accepter. 3 échanges par jour.<br>Un shiny s’échange seulement contre un shiny.</p></div>');
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
function openMyTrades() {
  ensureOverlay("🔁 Mes échanges", '<p class="tr-wait">Chargement…</p>');
  Promise.all([tradeRefresh(), typeof loadWildCaptures === "function" ? loadWildCaptures() : null]).then(() => {
    const s = tradeState;
    if (!s) { ensureOverlay("🔁 Mes échanges", '<div class="tr-empty"><p>Connecte-toi pour échanger avec tes amis.</p></div>'); return; }
    const incoming = s.trades.filter((t) => !t.mine && t.status === "pending");
    const outgoing = s.trades.filter((t) => t.mine && t.status === "pending");
    const done = s.trades.filter((t) => t.status !== "pending").slice(0, 10);
    const block = (title, list) => list.length ? '<h4>' + title + '</h4>' + list.map(tradeRowHtml).join("") : "";
    ensureOverlay("🔁 Mes échanges", '<div class="trs">' +
      '<p class="trs-intro">Échange tes doublons avec tes amis : ouvre ton 📒 album, touche un Pokémon que tu as en double, puis 🔁 Échanger. Encore <b>' + s.left + ' / ' + s.perDay + '</b> proposition' + (s.left > 1 ? "s" : "") + ' aujourd’hui.</p>' +
      (block("Reçus", incoming) + block("Envoyés", outgoing) + block("Derniers échanges", done) || '<p class="tr-empty">Aucun échange pour l’instant.</p>') +
      '<button type="button" class="btn-ghost trs-album" data-action="tradeOpenAlbum">📒 Ouvrir mon album</button></div>');
    if (s.news) tradePost("/api/trades/seen", {}).then(() => { if (tradeState) { tradeState.news = 0; if (typeof renderInboxUi === "function") renderInboxUi(); } });
  });
}
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
Object.assign(window, { openTradeMon, tradePartner, tradeRelease, tradeStart, tradePickFriend, tradePickWant, tradeSend, openMyTrades, tradeCancel, tradeAnswer, tradeOpenAlbum, tradePendingCount });
