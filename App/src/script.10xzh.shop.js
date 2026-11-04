// ===== 💰 Pokédollars et 🏪 Boutique (3/11/2026, interview puis maquette ; prix d'origine) =====
// Le serveur (lib/poke-balls.js) compte tout : ₽ gagnés (jeux du jour, chaque partie, doublons relâchés),
// achats (4 rencontres de plus à 100 ₽ puis le prix double dans la journée, Balls à 50 / 120 / 300 ₽).
// Ici : le porte-monnaie dans « Mon sac » (onglets Balls · Boutique · Gagner), la bulle « +300 ₽ »,
// la recharge quand les hautes herbes sont vides, et le solde dans l'en-tête. Compte obligatoire.
let shopTab = "balls";
let shopConfirm = null;
let shopBusy = false;

function coinFmt(n) { return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("fr-FR").replace(/[  ]/g, " "); }
function coinShort(n) { n = Math.max(0, Math.floor(Number(n) || 0)); return n >= 10000 ? Math.floor(n / 1000) + " k" : coinFmt(n); }
function coinIcon(big) { return '<span class="coin' + (big ? " big" : "") + '" aria-hidden="true">₽</span>'; }
function shopCoins() { return typeof ballState !== "undefined" && ballState && ballState.coins || null; }
function shopArt(id, shiny) {
  const p = typeof wildPokemon === "function" ? wildPokemon(id) : null;
  return p && typeof wildArtwork === "function" ? wildArtwork(p, shiny) : "";
}

// --- Le solde dans l'en-tête, à côté des Balls ---
if (typeof renderBallHeader === "function") {
  const renderBallHeaderBeforeCoins = renderBallHeader;
  renderBallHeader = function () {
    const out = renderBallHeaderBeforeCoins.apply(this, arguments);
    const btn = document.getElementById("ball-bag-btn"), c = shopCoins();
    if (btn && c && c.enabled) {
      btn.insertAdjacentHTML("beforeend", '<span class="ball-sep" aria-hidden="true"></span><span class="ball-coins">' + coinIcon() + '<b>' + coinShort(c.balance) + '</b></span>');
      btn.setAttribute("aria-label", btn.getAttribute("aria-label") + ", " + coinFmt(c.balance) + " Pokédollars");
    }
    return out;
  };
}

// --- La bulle « +300 ₽ · Pokémon du jour trouvé ! » ---
function coinGainLabel(list) {
  if (list.length === 1) {
    const g = list[0], src = String(g.source);
    if (src === "day:daily") return "Pokémon du jour trouvé !";
    if (src === "day:wordle") return "Wordle du jour réussi !";
    if (src === "day:dossier") return "Dossier du jour fini !";
    if (src === "day:challenge") return "Défi du jour fini !";
    if (src === "day:party") return "partie de Party Room !";
    if (src.startsWith("play:")) return g.amount >= 90 ? "belle partie !" : g.amount >= 60 ? "partie gagnée" : "partie jouée";
  }
  return list.every((g) => String(g.source).startsWith("day:")) ? "jeux du jour" : "tes parties";
}
if (typeof ballApply === "function") {
  const ballApplyBeforeCoins = ballApply;
  ballApply = function (data, options) {
    const out = ballApplyBeforeCoins.apply(this, arguments);
    const announce = !options || options.announce !== false;
    const gained = data && data.ok && Array.isArray(data.coinsAdded) ? data.coinsAdded.filter((g) => Number(g.amount) > 0) : [];
    if (announce && gained.length && typeof showToast === "function") {
      const sum = gained.reduce((t, g) => t + Number(g.amount), 0);
      const later = Array.isArray(data.added) && data.added.length ? 2600 : 0;
      setTimeout(() => showToast("💰 +" + coinFmt(sum) + " ₽ · " + coinGainLabel(gained)), later);
    }
    shopRedraw();
    return out;
  };
}

// --- « Mon sac » : le porte-monnaie et trois onglets ---
function shopWalletHtml(s) {
  const c = s.coins;
  if (!c || !c.enabled) {
    return '<div class="shop-wallet is-guest">' + coinIcon(true) + '<div><b>Pokédollars</b><small>Avec un compte, tu en gagnes en jouant et tu achètes à la boutique.</small>' +
      '<div class="shop-login"><a href="/auth/discord">Discord</a><a href="/auth/google">Google</a><a href="/auth/twitch">Twitch</a></div></div></div>';
  }
  return '<div class="shop-wallet">' + coinIcon(true) + '<div><b>' + coinFmt(c.balance) + ' ₽</b><small>Pokédollars</small></div>' +
    '<p class="shop-today">aujourd’hui<b>+' + coinFmt(c.today) + ' ₽</b></p></div>';
}
function shopTabsHtml() {
  const tabs = [["balls", "🎒 Balls"], ["shop", "🏪 Boutique"], ["earn", "💰 Gagner"]];
  return '<div class="shop-tabs" role="tablist" aria-label="Mon sac">' + tabs.map(([k, label]) =>
    '<button type="button" role="tab" aria-selected="' + (k === shopTab) + '" class="' + (k === shopTab ? "is-on" : "") + '" data-action="shopSetTab" data-args=\'["' + k + '"]\'>' + label + '</button>').join("") + '</div>';
}
function shopBallsTabHtml(s) {
  const counts = ["poke", "great", "ultra"].filter((k) => k !== "ultra" || Number(s.bag.ultra) > 0)
    .map((k) => '<div class="ball-count">' + ballImg(k, 40) + '<b>' + (Number(s.bag[k]) || 0) + '</b><small>' + BALL_KINDS[k].name + '</small></div>').join("");
  const gift = s.giftAvailable ? '<button type="button" class="ball-gift-cta" data-action="claimBallGift">🎁 Ouvrir mon cadeau du jour <small>+1 Poké Ball</small></button>' : "";
  const guest = s.authenticated ? "" : '<p class="ball-note">Sans compte, tes Balls restent sur cet appareil. Connecte-toi pour les garder partout : elles passent sur ton compte.</p>';
  return '<div class="ball-counts">' + counts + '</div>' + gift +
    '<section class="ball-today"><div class="ball-today-head"><h4>Aujourd’hui</h4><span>' + (Number(s.today) || 0) + ' / ' + (Number(s.cap) || 10) + '</span></div>' + ballMeterHtml(s) + ballGainsHtml(s) + '</section>' +
    '<section class="ball-how"><h4>Comment gagner des Balls</h4><ul>' +
      '<li>' + ballImg("poke", 20) + '<span>Ta <b>1re partie du jour</b> de chaque mode</span></li>' +
      '<li>' + ballImg("great", 20) + '<span>Une <b>Super Ball</b> si tu fais une belle partie</span></li>' +
      '<li>' + ballImg("poke", 20) + '<span>Le <b>Pokémon du jour</b> trouvé</span></li>' +
      '<li>' + ballImg("great", 20) + '<span>Le <b>parcours du jour</b> fini (4/4)</span></li>' +
      '<li>' + ballImg("ultra", 20) + '<span>Une <b>Hyper Ball</b> tous les <b>7 jours joués d’affilée</b></span></li>' +
    '</ul><p class="ball-note">10 Balls par jour au plus. Rejouer au même mode ne rapporte plus de Ball ce jour-là. Il en manque ? La boutique en vend.</p></section>' +
    ballGrassHtml(s) + guest;
}
function shopBuyButton(key, price, title) {
  const c = shopCoins(), can = Boolean(c && c.enabled && c.balance >= price);
  const confirm = can && shopConfirm && shopConfirm.item === key && shopConfirm.price === price && shopConfirm.until > Date.now();
  return '<button type="button" class="shop-buy' + (can ? "" : " is-off") + (confirm ? " is-confirm" : "") + '" data-action="shopBuy" data-args=\'["' + key + '"]\'' +
    ' aria-label="' + (confirm ? "Confirmer l’achat : " : "Acheter ") + escapeHtml(title) + ', ' + coinFmt(price) + ' Pokédollars"' + (can ? "" : ' aria-disabled="true"') + '>' +
    (confirm ? "Confirmer ?" : coinIcon() + coinFmt(price)) + '</button>';
}
function shopRechargeSteps(c) {
  const done = Number(c && c.recharges) || 0, base = c && c.prices ? Number(c.prices.recharge) : 100;
  return '<span class="shop-steps">' + [0, 1, 2].map((i) => '<i class="' + (i === 0 ? "is-now" : "") + '">' + (done + i + 1) + (done + i === 0 ? "re" : "e") + ' · ' + coinFmt(base * 2 ** (done + i)) + '</i>').join("") + '</span>';
}
function shopShopTabHtml(s) {
  const c = s.coins || {}, prices = c.prices || { recharge: 100, poke: 50, great: 120, ultra: 300 }, bag = s.bag || {};
  const w = s.wild || {};
  const when = typeof wildNextLabel === "function" && w.nextAt ? wildNextLabel(w) : "";
  const recharge = c.rechargeLeft === 0
    ? '<div class="shop-item is-hero is-done"><span class="shop-ic">🌿</span><div class="shop-txt"><b>4 rencontres de plus</b><small>Plus de recharge aujourd’hui. Ça repart à ' + coinFmt(prices.recharge) + ' ₽ à minuit.</small></div></div>'
    : '<div class="shop-item is-hero"><span class="shop-ic">🌿</span><div class="shop-txt"><b>4 rencontres de plus</b><small>Tout de suite' + (when ? ", sans attendre " + escapeHtml(when.replace(/^à /, "")) : "") + '</small></div>' +
      '<div class="shop-hero-foot">' + shopRechargeSteps(c) + shopBuyButton("recharge", Number(c.rechargePrice) || prices.recharge, "4 rencontres de plus") + '</div></div>';
  const ball = (k, extra) => '<div class="shop-item"><span class="shop-ic">' + ballImg(k, 40) + '</span><div class="shop-txt"><b>' + BALL_KINDS[k].name + '</b><small>Tu en as ' + (Number(bag[k]) || 0) + extra + '</small></div>' + shopBuyButton(k, prices[k], BALL_KINDS[k].name) + '</div>';
  return '<div class="shop-items">' + recharge + ball("poke", "") + ball("great", " · 1,4 × plus de chances") + ball("ultra", " · 2 × plus de chances") + '</div>' +
    '<p class="ball-note shop-note">La recharge repart à ' + coinFmt(prices.recharge) + ' ₽ à minuit, puis double à chaque fois dans la journée. Les 10 Balls gagnées en jouant restent gratuites.</p>';
}
function shopEarnTabHtml(s) {
  const c = s.coins || {}, done = new Set(c.done || []), daily = c.daily || { daily: 300, wordle: 150, dossier: 150, challenge: 150 };
  const rel = c.release || { normal: 15, shiny: 1500 }, cap = Number(c.playCap) || 2000, played = Number(c.played) || 0;
  const row = (id, shiny, label, gain, isDone) => '<li class="' + (isDone ? "is-done" : "") + '"><img src="' + escapeHtml(shopArt(id, shiny)) + '" alt="" draggable="false" loading="lazy"><span>' + label + '</span><em>' + (isDone ? "✓ " : "") + gain + '</em></li>';
  return '<ul class="shop-gains">' +
    row(25, false, "Pokémon du jour trouvé", coinFmt(daily.daily) + " ₽", done.has("daily")) +
    row(133, false, "Wordle du jour réussi", coinFmt(daily.wordle) + " ₽", done.has("wordle")) +
    row(54, false, "Dossier du jour fini", coinFmt(daily.dossier) + " ₽", done.has("dossier")) +
    row(150, false, "Défi du jour fini", coinFmt(daily.challenge) + " ₽", done.has("challenge")) +
    row(235, false, "1re partie du jour en Party Room", coinFmt(c.party || 150) + " ₽ + 1 Ball", done.has("party")) +
    row(448, false, "1re partie du jour : Quiz, Higher or Lower, Duel de poids, Shiny ou normal", "30 à 90 ₽", false) +
    row(7, false, "Doublon relâché (dans l’album)", coinFmt(rel.normal) + " ₽", false) +
    row(6, true, "Doublon shiny relâché", coinFmt(rel.shiny) + " ₽", false) + '</ul>' +
    '<div class="shop-cap"><span>Parties d’aujourd’hui : <b>' + coinFmt(played) + ' / ' + coinFmt(cap) + ' ₽</b></span><i aria-hidden="true"><b style="width:' + Math.min(100, Math.round(played * 100 / cap)) + '%"></b></i></div>' +
    '<p class="ball-note shop-note">Dans ces 4 jeux, la 1re partie du jour : perdue 30 ₽, gagnée 60 ₽, belle partie 90 ₽. Les autres jeux donnent leur Ball ; leurs ₽ arriveront quand le serveur vérifiera aussi leurs parties.</p>';
}
function shopBagHtml() {
  const s = ballState || { bag: { poke: 0, great: 0, ultra: 0 }, today: 0, cap: 10, gains: [] };
  const body = shopTab === "shop" ? shopShopTabHtml(s) : shopTab === "earn" ? shopEarnTabHtml(s) : shopBallsTabHtml(s);
  return '<div class="ball-bag shop-bag" data-tab="' + shopTab + '">' + shopWalletHtml(s) + shopTabsHtml() + '<div class="shop-body" role="tabpanel">' + body + '</div></div>';
}
function shopRedraw() {
  const overlay = document.getElementById("overlay-modal"), body = document.querySelector("#overlay-body .shop-bag");
  if (!overlay || overlay.classList.contains("hidden") || !body) return;
  const scroll = document.getElementById("overlay-body")?.scrollTop || 0;
  ensureOverlay("🎒 Mon sac", shopBagHtml());
  const el = document.getElementById("overlay-body"); if (el) el.scrollTop = scroll;
}
openBallBag = function (tab) {
  if (typeof tab === "string" && ["balls", "shop", "earn"].includes(tab)) shopTab = tab;
  shopConfirm = null;
  ensureOverlay("🎒 Mon sac", shopBagHtml());
  refreshBalls();
};
function shopSetTab(tab) {
  shopTab = ["balls", "shop", "earn"].includes(tab) ? tab : "balls";
  shopConfirm = null;
  shopRedraw();
  document.querySelector('#overlay-body .shop-tabs [aria-selected="true"]')?.focus({ preventScroll: true });
}
function openShop() { openBallBag("shop"); }

// --- Acheter : un 1er appui demande « Confirmer ? » (4 s), le 2e achète ---
const SHOP_ERRORS = {
  account_changed: "Le compte a changé. Vérifie ton sac avant de recommencer.",
  previous_action: "Vérification de ton achat précédent. Vérifie ton sac avant de recommencer.",
  price_changed: "Le prix a changé. Vérifie le nouveau prix avant de confirmer.",
  reload_required: "Recharge la page pour utiliser la boutique.",
  storage_unavailable: "Le navigateur ne peut pas conserver cet achat. Vérifie ses réglages de stockage.",
  account_required: "Connecte-toi pour utiliser la boutique.",
  not_enough_coins: "Pas assez de Pokédollars.",
  recharge_limit: "Plus de recharge aujourd’hui.",
  rate_limited: "Doucement ! Réessaie dans une minute."
};
function shopPrice(item) {
  const c = shopCoins();
  if (!c) return 0;
  return item === "recharge" ? Number(c.rechargePrice) || 0 : Number(c.prices && c.prices[item]) || 0;
}
function shopBuy(item, from) {
  const c = shopCoins();
  if (!c || !c.enabled) { if (typeof showToast === "function") showToast(SHOP_ERRORS.account_required); return; }
  const price = shopPrice(item);
  if (c.balance < price) { if (typeof showToast === "function") showToast("Il te manque " + coinFmt(price - c.balance) + " ₽. Joue une partie pour en gagner."); return; }
  if (!(shopConfirm && shopConfirm.item === item && shopConfirm.price === price && shopConfirm.until > Date.now())) {
    shopConfirm = { item, price, until: Date.now() + 4000 };
    shopRedraw();
    if (from === "wild" && typeof showToast === "function") showToast("Confirmer la recharge : " + coinFmt(price) + " ₽ ? Appuie à nouveau.");
    setTimeout(() => { if (shopConfirm && shopConfirm.item === item && shopConfirm.until <= Date.now()) { shopConfirm = null; shopRedraw(); } }, 4100);
    return;
  }
  if (shopBusy) return;
  shopBusy = true;
  shopConfirm = null;
  ballPaidAction("/api/shop/buy", { item, expectedPrice: price }).then((data) => {
    if (!data || !data.ok) {
      if (typeof showToast === "function") showToast(SHOP_ERRORS[data && data.error] || "Achat impossible pour le moment. Réessaie dans un instant.");
      refreshBalls();
      return;
    }
    ballApply(data, { announce: false });
    if (typeof moSfx === "function") moSfx("pop");
    const left = data.wild ? data.wild.left : 0;
    if (typeof showToast === "function") showToast(item === "recharge" ? "🌿 +4 rencontres ! " + left + " à faire aujourd’hui" : "🛒 +1 " + BALL_KINDS[item].name + " dans ton sac");
    if (from === "wild" && item === "recharge" && typeof openWildGrass === "function") openWildGrass();
  }).finally(() => { shopBusy = false; });
}
function shopWildRecharge() { shopBuy("recharge", "wild"); }
function shopWildBalls() { if (typeof closeWildGrass === "function") closeWildGrass(); openBallBag("shop"); }

// --- Les hautes herbes vides : recharger, ou attendre la prochaine vague ---
if (typeof renderWildEnd === "function") {
  const renderWildEndBeforeShop = renderWildEnd;
  renderWildEnd = function (state) {
    const out = renderWildEndBeforeShop.apply(this, arguments);
    const end = document.querySelector("#wild-scene .wild-end");
    const w = state && state.wild, c = state && state.coins;
    if (!end || !w || w.open) return out;
    const bag = state.bag || {};
    const hasBall = ["poke", "great", "ultra"].some((k) => Number(bag[k]) > 0);
    const note = end.querySelector(".wild-note");
    const when = typeof wildNextLabel === "function" ? wildNextLabel(w) : "";
    let html = "";
    if (w.left <= 0 && c && c.enabled && c.rechargeLeft > 0) {
      const price = Number(c.rechargePrice) || 100, can = c.balance >= price;
      html = '<div class="shop-recharge">' +
        '<button type="button" class="shop-recharge-btn' + (can ? "" : " is-off") + '" data-action="shopWildRecharge"' + (can ? "" : ' aria-disabled="true"') + '>' +
          '<span class="l"><span aria-hidden="true">🔄</span> Recharger <b>4 rencontres</b></span><span class="p">' + coinIcon() + coinFmt(price) + '</span></button>' +
        '<small>' + (can ? "Tu as " + coinFmt(c.balance) + " ₽" : "Il te manque " + coinFmt(price - c.balance) + " ₽ · joue une partie pour en gagner") + '</small>' +
        (when ? '<button type="button" class="shop-wait" data-action="closeWildGrass">⏳ J’attends ' + escapeHtml(when.replace(/^à /, "")) + ' <small>· +' + (w.nextCount || 4) + ' gratuites</small></button>' : "") + '</div>';
    } else if (w.left <= 0 && c && !c.enabled) {
      html = '<p class="wild-note shop-hint">Avec un compte, tu peux recharger tes rencontres avec des Pokédollars gagnés en jouant.</p>';
    } else if (w.left > 0 && !hasBall && c && c.enabled) {
      html = '<button type="button" class="shop-wait" data-action="shopWildBalls">🏪 Acheter des Balls <small>· tu as ' + coinFmt(c.balance) + ' ₽</small></button>';
    }
    if (!html) return out;
    const anchor = end.querySelector(":scope > .btn-ghost");
    if (anchor) anchor.insertAdjacentHTML("beforebegin", html); else end.insertAdjacentHTML("beforeend", html);
    // La recharge remplace la phrase « 4 nouvelles rencontres à 16 h » (le bouton « J'attends 16 h » la redit).
    if (note && end.querySelector(".shop-recharge")) note.remove();
    return out;
  };
}

// --- « Ta journée » : le solde dans la tuile du sac ---
if (typeof homeDayBagTile === "function") {
  const homeDayBagTileBeforeCoins = homeDayBagTile;
  homeDayBagTile = function (s) {
    const html = homeDayBagTileBeforeCoins.apply(this, arguments);
    const c = s && s.coins;
    if (!c || !c.enabled || s.giftAvailable) return html;
    return html.replace("</small>", " · " + coinFmt(c.balance) + " ₽</small>");
  };
}

window.openBallBag = openBallBag;
window.openShop = openShop;
window.shopSetTab = shopSetTab;
window.shopBuy = shopBuy;
window.shopWildRecharge = shopWildRecharge;
window.shopWildBalls = shopWildBalls;
