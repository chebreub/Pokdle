
// 📸 PART-03 (7/11/2026) : « Partager ma capture » après une vraie capture marquante (shiny, 1re capture,
// légendaire ou épreuve de prestige), jamais pour un doublon ordinaire ni pour une capture inventée :
// le bouton n'apparaît que sur la carte « Attrapé ! » d'une capture confirmée par le serveur.
// La carte image (1080 × 1350) ne montre ni pseudo ni compte. Partage natif de l'image quand le navigateur
// le permet, sinon copie du lien public /pokemon/<nom>?via=capture. Compteur agrégé `share:capture`
// (étape 1 de DATA-03) au 1er partage ou à la 1re copie pour cette capture ; l'ouverture du lien est
// comptée par le serveur (`share:capture-visit`, robots d'aperçu à part).
var captureShareLast = null; // { pokemonId, shiny, firstCatch, legend, ball, counted }
var captureShareFile = null;

// Même règle que lib/seo-pokemon.js (slugify) : les deux sont comparées par un test.
function captureShareSlug(name) {
  return String(name).replace(/♀/g, ' f').replace(/♂/g, ' m').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function captureShareUrl(p) {
  var slug = captureShareSlug(p && p.name) || String(p && p.id);
  return location.origin + '/pokemon/' + slug + '?via=capture';
}
function captureShareIsMarking(outcome, state) {
  if (!outcome || !outcome.caught) return false;
  var enc = state && state.encounter || {};
  var legendIds = typeof LEGENDARY_IDS !== 'undefined' ? LEGENDARY_IDS : null;
  var legend = Boolean(enc.legend || enc.prestige || (legendIds && legendIds.has && legendIds.has(Number(outcome.pokemonId))));
  return Boolean(outcome.shiny || outcome.firstCatch || legend);
}
function captureShareTag(c) {
  if (c.shiny && c.firstCatch) return '1re capture · Shiny ✨';
  if (c.shiny) return 'Capture shiny ✨';
  if (c.legend) return 'Capture légendaire 👑';
  return '1re capture !';
}

if (typeof renderWildEnd === 'function') {
  var renderWildEndBeforeShare = renderWildEnd;
  renderWildEnd = function (state, outcome) {
    var out = renderWildEndBeforeShare.apply(this, arguments);
    if (!captureShareIsMarking(outcome, state)) return out;
    var enc = state && state.encounter || {};
    var legendIds = typeof LEGENDARY_IDS !== 'undefined' ? LEGENDARY_IDS : null;
    captureShareLast = {
      pokemonId: Number(outcome.pokemonId), shiny: Boolean(outcome.shiny), firstCatch: Boolean(outcome.firstCatch),
      legend: Boolean(enc.legend || enc.prestige || (legendIds && legendIds.has && legendIds.has(Number(outcome.pokemonId)))),
      ball: typeof catchCardBall !== 'undefined' ? catchCardBall : 'poke', counted: false,
    };
    var end = document.querySelector('#wild-scene .wild-end');
    if (!end || end.querySelector('.cc-share')) return out;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-ghost cc-share';
    btn.setAttribute('data-action', 'openCaptureShare');
    btn.textContent = '📸 Partager ma capture';
    var anchor = end.querySelector('.btn-ghost');
    if (anchor) end.insertBefore(btn, anchor); else end.appendChild(btn);
    return out;
  };
}

function captureShareCount() {
  if (!captureShareLast || captureShareLast.counted) return;
  captureShareLast.counted = true;
  if (typeof trackUsage === 'function') trackUsage('share:capture');
}

async function captureShareDraw(canvas, c) {
  var W = 1080, H = 1350;
  var p = wildPokemon(c.pokemonId);
  var ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  try { await Promise.all(['700 84px Fredoka', '800 34px Nunito', '800 26px Nunito'].map(function (f) { return document.fonts.load(f); })); } catch (_e) {}
  var round = function (cx, x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); };
  var t1 = catchCardTypeColor(p.type1), t2 = p.type2 ? catchCardTypeColor(p.type2) : t1;
  ctx.fillStyle = c.shiny ? '#FFF4D1' : '#FFF8EF'; ctx.fillRect(0, 0, W, H);
  // Panneau aux couleurs des types, l'artwork officiel au centre.
  var g = ctx.createLinearGradient(90, 150, 990, 930);
  g.addColorStop(0, t1); g.addColorStop(1, t2);
  ctx.fillStyle = g; round(ctx, 90, 150, 900, 780, 48); ctx.fill();
  ctx.lineWidth = 10; ctx.strokeStyle = c.shiny ? '#F6B93B' : '#E3350D'; ctx.stroke();
  var halo = ctx.createRadialGradient(540, 540, 40, 540, 540, 420);
  halo.addColorStop(0, 'rgba(255,255,255,.55)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo; ctx.fillRect(90, 150, 900, 780);
  // Bandeau du haut.
  ctx.textAlign = 'center'; ctx.fillStyle = '#2E2A33'; ctx.font = '700 64px Fredoka, sans-serif';
  ctx.fillText(captureShareTag(c), W / 2, 104);
  var load = typeof favLoadImage === 'function' ? favLoadImage : function () { return Promise.resolve(null); };
  var img = await load(wildArtwork(p, c.shiny));
  if (!img && c.shiny) img = await load(wildArtwork(p, false));
  if (img) ctx.drawImage(img, 190, 190, 700, 700);
  if (c.shiny) {
    ctx.font = '64px sans-serif';
    [[170, 250], [905, 300], [190, 840], [880, 860]].forEach(function (s) { ctx.fillText('✨', s[0], s[1]); });
  }
  // Nom, numéro, région, types.
  var gen = Number(p.gen || p.generation) || 1;
  var region = (typeof GENERATIONS !== 'undefined' && GENERATIONS[gen] && GENERATIONS[gen].label) || '';
  ctx.fillStyle = '#2E2A33'; ctx.font = '700 84px Fredoka, sans-serif';
  ctx.fillText(p.name + (c.shiny ? ' ✨' : ''), W / 2, 1030);
  ctx.fillStyle = '#6B6472'; ctx.font = '800 34px Nunito, sans-serif';
  ctx.fillText('N° ' + String(p.id).padStart(3, '0') + (region ? ' · ' + region : ''), W / 2, 1082);
  var types = [p.type1, p.type2].filter(Boolean);
  ctx.font = '800 30px Nunito, sans-serif';
  var widths = types.map(function (t) { return ctx.measureText(t).width + 56; });
  var x = (W - widths.reduce(function (a, b) { return a + b; }, 0) - (types.length - 1) * 16) / 2;
  types.forEach(function (t, i) {
    ctx.fillStyle = catchCardTypeColor(t); round(ctx, x, 1108, widths[i], 54, 27); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(t, x + widths[i] / 2, 1146); x += widths[i] + 16;
  });
  // Pied : l'invitation, sans pseudo.
  ctx.textAlign = 'right'; ctx.fillStyle = '#2E2A33'; ctx.font = '800 34px Nunito, sans-serif';
  ctx.fillText('Attrape-le aussi sur', 560, 1276);
  ctx.fillStyle = '#2b4fb8'; round(ctx, 578, 1222, 236, 82, 41); ctx.fill();
  ctx.fillStyle = '#4069E0'; round(ctx, 578, 1214, 236, 82, 41); ctx.fill();
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 44px Fredoka, sans-serif'; ctx.fillText('pokdle.fr', 696, 1270);
  return canvas;
}

async function openCaptureShare() {
  var c = captureShareLast;
  var p = c && wildPokemon(c.pokemonId);
  if (!p) return;
  if (typeof ensureOverlay === 'function') ensureOverlay('Partager ma capture', '<p class="fav-share-wait">Préparation de ta carte…</p>');
  captureShareFile = null;
  var blob = null;
  try {
    var canvas = await captureShareDraw(document.createElement('canvas'), c);
    blob = await new Promise(function (r) { canvas.toBlob(r, 'image/png'); });
  } catch (_e) { blob = null; }
  if (captureShareLast !== c) return;
  var name = 'pokedle-' + captureShareSlug(p.name) + (c.shiny ? '-shiny' : '') + '.png';
  var file = blob && typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
  captureShareFile = file;
  var canShareFile = Boolean(file && navigator.canShare && navigator.canShare({ files: [file] }));
  var url = blob ? URL.createObjectURL(blob) : '';
  var body = '<div class="fav-share capture-share">' +
    (url ? '<img src="' + url + '" alt="Ta carte de capture : ' + escapeHtml(p.name) + '">' : '<p class="fav-share-wait">L’image n’a pas pu être créée, mais tu peux partager le lien.</p>') +
    '<div class="fav-share-row">' +
      (canShareFile ? '<button type="button" class="btn-blue" data-action="captureShareNow">📤 Partager</button>' : '') +
      '<button type="button" class="' + (canShareFile ? 'btn-ghost' : 'btn-blue') + '" data-action="captureShareCopyLink">🔗 Copier le lien</button>' +
      (url ? '<a class="btn-ghost" href="' + url + '" download="' + escapeHtml(name) + '">⬇️ Enregistrer</a>' : '') +
    '</div><p class="fav-share-hint">Ni ton pseudo ni ton compte ne sont sur la carte. Le lien mène à la fiche de ' + escapeHtml(p.name) + '.</p></div>';
  if (typeof ensureOverlay === 'function') ensureOverlay('Partager ma capture', body);
}

async function captureShareNow() {
  var c = captureShareLast, p = c && wildPokemon(c.pokemonId);
  if (!p || !captureShareFile || !navigator.share) return captureShareCopyLink();
  try {
    await navigator.share({ files: [captureShareFile], title: 'Pokédle', text: 'J’ai attrapé ' + p.name + (c.shiny ? ' shiny ✨' : '') + ' sur Pokédle ! ' + captureShareUrl(p) });
    captureShareCount();
  } catch (e) {
    // Annulé par le joueur : rien n'est compté. Autre refus du navigateur : on propose le lien.
    if (!e || e.name !== 'AbortError') captureShareCopyLink();
  }
}
async function captureShareCopyLink() {
  var c = captureShareLast, p = c && wildPokemon(c.pokemonId);
  if (!p) return;
  var link = captureShareUrl(p);
  var ok = false;
  try { await navigator.clipboard.writeText(link); ok = true; } catch (_e) {}
  if (ok) { captureShareCount(); if (typeof showToast === 'function') showToast('Lien copié !'); }
  else if (typeof showToast === 'function') showToast(link);
}

window.openCaptureShare = openCaptureShare;
window.captureShareNow = captureShareNow;
window.captureShareCopyLink = captureShareCopyLink;
