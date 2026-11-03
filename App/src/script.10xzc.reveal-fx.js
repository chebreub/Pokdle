
// ===== Animations (3/11/2026, « go anim ») : apparition shiny, cadeau du jour et coffres de l'Expédition =====
// Tout se saute (« Passer ») et rien ne bouge avec « réduire les animations ».
function fxReduced() {
  try { if (typeof pokedexFxReducedMotion === "function") return pokedexFxReducedMotion(); return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_e) { return false; }
}
function fxSound(kind) {
  if (typeof getPokedexFxAudioContext !== "function" || typeof pokedexFxTone !== "function") return;
  const ctx = getPokedexFxAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01, v = typeof appSoundVolume === "function" ? appSoundVolume() : 1;
  const notes = {
    shiny: [[1318.5, 0, .09, .02, "sine"], [1568, .08, .09, .02, "sine"], [2093, .16, .12, .022, "sine"], [2637, .26, .25, .018, "sine"], [1975.5, .42, .3, .012, "triangle"]],
    shake: [[180, 0, .05, .03, "triangle"]],
    open: [[523.3, 0, .08, .025, "triangle"], [784, .07, .1, .028, "triangle"], [1046.5, .16, .22, .03, "sine"]],
    pop: [[880, 0, .05, .016, "sine"]]
  }[kind] || [];
  for (const [f, o, d, g, type] of notes) pokedexFxTone(ctx, f, t + o, d, g * v, type);
}

// --- ✨ Apparition d'un shiny dans les hautes herbes ---
function shinyIntroFx(scene) {
  const stage = scene && scene.querySelector(".wild-stage.is-shiny");
  if (!stage || fxReduced() || stage.querySelector(".fx-shiny")) return;
  const stars = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2, r = 110 + (i % 3) * 30;
    return '<i style="--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r) + 'px;animation-delay:' + (0.9 + (i % 4) * 0.05) + 's">✦</i>';
  }).join("");
  stage.insertAdjacentHTML("beforeend", '<div class="fx-shiny" aria-hidden="true"><div class="fx-shiny-dim"></div><div class="fx-shiny-ring"></div><div class="fx-shiny-stars">' + stars + '</div><div class="fx-shiny-badge">✨ SHINY</div></div>');
  setTimeout(() => fxSound("shiny"), 900);
  setTimeout(() => { const fx = stage.querySelector(".fx-shiny"); if (fx) fx.classList.add("is-done"); }, 3400);
}
if (typeof renderWildEncounter === "function") {
  const renderWildEncounterBeforeFx = renderWildEncounter;
  renderWildEncounter = function (state, message, intro) {
    const out = renderWildEncounterBeforeFx.apply(this, arguments);
    if (intro) shinyIntroFx(document.getElementById("wild-scene"));
    return out;
  };
}
// --- « Gotcha » d'un shiny : fond doré et paillettes ---
if (typeof renderWildEnd === "function") {
  const renderWildEndBeforeFx = renderWildEnd;
  renderWildEnd = function (state, outcome) {
    const out = renderWildEndBeforeFx.apply(this, arguments);
    const box = outcome && outcome.caught && outcome.shiny ? document.querySelector("#wild-scene .wild-gotcha.is-shiny") : null;
    if (box) {
      box.insertAdjacentHTML("afterbegin", '<div class="fx-gold-rain" aria-hidden="true">' + Array.from({ length: 18 }, (_, i) => '<i style="left:' + Math.round((i * 53) % 100) + '%;animation-delay:' + (i % 6) * 0.25 + 's;animation-duration:' + (2.2 + (i % 5) * 0.3) + 's">' + (i % 3 ? "✦" : "✨") + '</i>').join("") + '</div>');
      const h3 = box.querySelector("h3");
      if (h3) h3.insertAdjacentHTML("beforebegin", '<div class="fx-shiny-title">✨ SHINY ATTRAPÉ ! ✨</div>');
      if (!fxReduced()) fxSound("shiny");
    }
    return out;
  };
}

// --- 🎁 Ouverture : le paquet tremble, s'ouvre, les Balls sortent puis filent vers le sac ---
function fxReveal({ icon, title, balls }) {
  return new Promise((resolve) => {
    const names = { poke: "Poké Ball", great: "Super Ball", ultra: "Hyper Ball" };
    const el = document.createElement("div");
    el.className = "fx-reveal"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", title);
    el.innerHTML = '<div class="fx-reveal-box"><div class="fx-reveal-title">' + escapeHtml(title) + '</div><div class="fx-reveal-icon" aria-hidden="true">' + icon + '</div>' +
      '<div class="fx-reveal-balls">' + balls.map((b, i) => '<span class="fx-ball" style="animation-delay:' + (0.25 + i * 0.35) + 's">' + ballImg(b, 44) + '<small>' + names[b] + '</small></span>').join("") + '</div>' +
      '<button type="button" class="fx-reveal-skip">' + (fxReduced() ? "Super !" : "Passer ›") + '</button></div>';
    document.body.appendChild(el);
    const timers = [];
    const finish = () => {
      timers.forEach(clearTimeout);
      const bag = document.getElementById("ball-bag-btn");
      if (bag && !fxReduced()) {
        const to = bag.getBoundingClientRect();
        el.querySelectorAll(".fx-ball").forEach((b, i) => {
          const from = b.getBoundingClientRect();
          b.style.transition = "transform .55s cubic-bezier(.5,0,.75,0) " + (i * 0.08) + "s, opacity .55s " + (i * 0.08) + "s";
          b.style.transform = "translate(" + (to.left + to.width / 2 - from.left - from.width / 2) + "px," + (to.top + to.height / 2 - from.top - from.height / 2) + "px) scale(.3)";
          b.style.opacity = "0";
        });
        el.classList.add("is-leaving");
        setTimeout(() => { el.remove(); bag.classList.add("fx-bump"); setTimeout(() => bag.classList.remove("fx-bump"), 500); resolve(); }, 650 + balls.length * 80);
      } else { el.remove(); resolve(); }
    };
    el.querySelector(".fx-reveal-skip").addEventListener("click", finish);
    if (fxReduced()) { el.classList.add("is-static"); return; }
    [300, 650, 1000].forEach((ms) => timers.push(setTimeout(() => fxSound("shake"), ms)));
    timers.push(setTimeout(() => { el.classList.add("is-open"); fxSound("open"); }, 1350));
    balls.forEach((_, i) => timers.push(setTimeout(() => fxSound("pop"), 1600 + i * 350)));
    timers.push(setTimeout(finish, 2400 + balls.length * 350));
  });
}
function claimBallGiftFx() {
  const button = this && this.tagName === "BUTTON" ? this : null;
  if (button) button.disabled = true;
  return fetch("/api/balls/gift", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" })
    .then((r) => r.json().catch(() => null)).then((data) => {
      if (!data || !data.ok) { if (typeof showToast === "function") showToast("Le cadeau n’a pas pu s’ouvrir. Réessaie dans un instant."); return; }
      const gift = (data.added || []).filter((g) => g.source === "gift").map((g) => g.ball);
      const show = gift.length ? fxReveal({ icon: "🎁", title: "Cadeau du jour", balls: gift }) : Promise.resolve();
      return show.then(() => {
        if (typeof ballApply === "function") ballApply({ ...data, added: (data.added || []).filter((g) => g.source !== "gift") });
        if (document.querySelector("#overlay-body .ball-bag") && typeof openBallBag === "function") openBallBag();
      });
    }).catch(() => {}).finally(() => { if (button) button.disabled = false; });
}
function claimExpeditionChestsFx() {
  const ready = typeof expeditionState !== "undefined" && expeditionState ? expeditionState.chests.filter((c) => c.canClaim) : [];
  return fetch("/api/expedition/chests", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" })
    .then((r) => r.json().catch(() => null)).then((d) => {
      if (!d || !d.ok) { if (typeof showToast === "function") showToast("Les coffres n’ont pas pu s’ouvrir. Réessaie."); return; }
      if (typeof closeOverlayModal === "function") closeOverlayModal();
      const tiers = ready.map((c) => c.tier + " %").join(" · ");
      return fxReveal({ icon: "🎁", title: "Coffre" + (ready.length > 1 ? "s" : "") + " de l’Expédition" + (tiers ? " · " + tiers : ""), balls: (d.added || []).map((a) => a.ball) }).then(() => {
        if (typeof ballApply === "function") ballApply(d, { announce: false });
        if (typeof expeditionState !== "undefined") { expeditionState = d.expedition; }
        if (typeof openExpedition === "function") openExpedition();
      });
    });
}
window.claimBallGift = claimBallGiftFx;
window.claimExpeditionChests = claimExpeditionChestsFx;
window.fxReveal = fxReveal;

// ===== 👁️ Vus / ⚪ Attrapés, comme dans les jeux (3/11/2026) =====
// « Vu » : trouvé en jouant (Pokémon du jour, quiz, pixelisé…). « Attrapé » : capturé avec une Ball.
// Les deux comptent à part ; tout ce qui était « vu » le reste.
function albumCaughtIn(list) {
  const caught = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures : {};
  return list.filter((p) => caught[p.id]).length;
}
if (typeof albumBinderHtml === "function") {
  const albumBinderHtmlBeforeCaught = albumBinderHtml;
  albumBinderHtml = function () {
    const html = albumBinderHtmlBeforeCaught.apply(this, arguments);
    const s = albumStats(albumView.gen), caught = albumCaughtIn(albumRegionList(albumView.gen));
    const bar = (cls, label, n, title) => '<div class="alb-track ' + cls + '" title="' + title + '"><span>' + label + '</span><i><b style="width:' + Math.round(n * 100 / Math.max(1, s.total)) + '%"></b></i><em>' + n + ' / ' + s.total + '</em></div>';
    return html.replace(/<h3>([^<]*)<small>[^<]*<\/small><\/h3>/, (_m, name) => '<h3>' + name + (s.shinies ? ' <small>✨ ' + s.shinies + '</small>' : '') + '</h3>' +
      bar("is-seen", "👁️ Vus", s.found, "Trouvés en jouant") + bar("is-caught", (typeof ballImg === "function" ? ballImg("poke", 16) : "⚪") + " Attrapés", caught, "Capturés avec une Ball"));
  };
}
if (typeof albumRender === "function") {
  const albumRenderBeforeCaught = albumRender;
  albumRender = function () {
    const out = albumRenderBeforeCaught.apply(this, arguments);
    const foot = document.querySelector("#overlay-body .alb-foot");
    if (foot && !foot.dataset.vus) {
      foot.dataset.vus = "1";
      foot.insertAdjacentHTML("afterbegin", '<span class="alb-legend">👁️ <b>Vu</b> : trouvé en jouant · ⚪ <b>Attrapé</b> : capturé avec une Ball · ✨ shiny. </span>');
    }
    return out;
  };
}

// --- ⚪ 1re capture d'un Pokémon : la fiche « Nouvelle entrée » façon Pokédex des jeux ---
const FX_REGIONS = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unys", "Kalos", "Alola", "Galar", "Paldea"];
function fxCaptureCard(p, shiny, count, ball) {
  if (!p) return;
  const el = document.createElement("div");
  el.className = "fx-catch" + (shiny ? " is-shiny" : "") + (fxReduced() ? " is-static" : "");
  el.setAttribute("role", "dialog"); el.setAttribute("aria-label", p.name + " attrapé");
  const art = typeof pokedexDetailArtwork === "function" ? pokedexDetailArtwork(p, shiny) : getPokemonSprite(p);
  const color = (t) => typeof pokemonTypeColor === "function" ? pokemonTypeColor(t) : "#6890f0";
  const t1 = color(p.type1), t2 = p.type2 ? color(p.type2) : t1;
  const types = [p.type1, p.type2].filter(Boolean).map((t) => '<span style="background:' + color(t) + '">' + escapeHtml(t) + '</span>').join("");
  const num = "N° " + String(p.id).padStart(3, "0");
  const fmt = (n, unit) => (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " " + unit;
  const ballKind = ["poke", "great", "ultra"].includes(ball) ? ball : "poke";
  const ballName = { poke: "Poké", great: "Super", ultra: "Hyper" }[ballKind];
  const traded = ball === "trade";
  const ballIcon = traded ? "🔁 " : typeof moBallSvg === "function" ? moBallSvg(ballKind) : (typeof ballImg === "function" ? ballImg(ballKind, 18) : "");
  const total = typeof POKEMON_BY_ID !== "undefined" ? Math.min(1025, POKEMON_BY_ID.size) || 1025 : 1025;
  const region = FX_REGIONS[(Number(p.gen) || 1) - 1] || "";
  el.innerHTML = '<div class="fx-catch-card dexc">' +
    '<div class="dexc-top"><span class="dexc-led" aria-hidden="true"></span><span class="dexc-dots" aria-hidden="true"><i></i><i></i><i></i></span><b>NOUVELLE ENTRÉE · POKÉDEX</b></div>' +
    '<div class="fx-catch-art dexc-hero" style="--t1:' + t1 + ';--t2:' + t2 + '"><div class="dexc-plat" aria-hidden="true"></div>' +
      '<img src="' + escapeHtml(art) + '" alt="" draggable="false">' +
      '<span class="dexc-new">' + (shiny ? "✨ 1re CAPTURE SHINY !" : "1re CAPTURE !") + '</span><span class="dexc-num">' + num + '</span></div>' +
    '<div class="dexc-body"><h3>' + escapeHtml(p.name) + '</h3>' +
      '<div class="dexc-sub">' + escapeHtml(region) + ' · Génération ' + (Number(p.gen) || 1) + '</div>' +
      '<div class="dexc-types">' + types + '</div>' +
      '<div class="dexc-facts"><div><small>Taille</small><b>' + fmt(p.height, "m") + '</b></div><div><small>Poids</small><b>' + fmt(p.weight, "kg") + '</b></div>' +
        '<div><small>' + (traded ? "Reçu par" : "Attrapé avec") + '</small><b class="dexc-ball">' + ballIcon + (traded ? "échange" : ballName) + '</b></div></div>' +
      '<div class="dexc-line"><span class="dexc-ball">' + (typeof moBallSvg === "function" ? moBallSvg("poke") : "") + 'Attrapés</span><i><b style="width:' + Math.max(1, Math.round(count * 100 / total)) + '%"></b></i><em>' + count + ' / ' + total + '</em></div>' +
      '<div class="fx-catch-btns"><button type="button" class="btn-blue" data-fx-close>Super !</button><button type="button" class="btn-ghost" data-fx-album>📒 Mon album</button></div></div>' +
    '<div class="fx-catch-confetti" aria-hidden="true">' + Array.from({ length: 16 }, (_, i) => '<i style="left:' + ((i * 37) % 100) + '%;animation-delay:' + ((i % 5) * 0.12 + 0.9) + 's;background:' + ["#FFD45C", "#E3350D", "#4069E0", "#3E9B57"][i % 4] + '"></i>').join("") + '</div></div>';
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector("[data-fx-close]").addEventListener("click", close);
  el.querySelector("[data-fx-album]").addEventListener("click", () => { close(); if (typeof closeWildGrass === "function") closeWildGrass(); if (typeof openAlbumBinder === "function") openAlbumBinder(p.gen); });
  if (shiny && !fxReduced()) setTimeout(() => fxSound("shiny"), 1100);
  el.querySelector("[data-fx-close]").focus({ preventScroll: true });
}
window.fxCaptureCard = fxCaptureCard;
