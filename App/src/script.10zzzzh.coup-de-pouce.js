// 💡 Coup de pouce (12/11/2026, maquettes validées : « Go, oui dernier essai en haut »).
// Les stats montraient 3 abandons sur 4 en Pokédle illimité, 9 sur 10 en Stat Mystère, et « wordle dur ».
// - Illimité : silhouette floue au 8e essai, 1re lettre au 12e. Stat Mystère (types et stats déjà donnés, lettre
//   au 5e) : génération au 3e essai, silhouette floue au 7e. Wordle (du jour et entraînement) : type après
//   3 lignes, génération après 5. Quand la partie est vérifiée par le serveur, c'est lui qui envoie l'aide
//   (jamais avant le bon essai) ; en entraînement local, la page applique les mêmes seuils.
// - Illimité et Stat Mystère : le dernier essai s'affiche en haut, juste sous la case de saisie, et
//   « Abandonner » devient « 👀 Voir la réponse » (la fiche du Pokémon puis « Rejouer », comme avant).
// - Wordle illimité plus visible : dans le filtre « Deviner » de l'accueil, et un vrai bouton à la fin du Wordle du jour.
// Rien ne change dans les règles, les points, les Balls ni les ₽.

var CDP_AT = { normal: { silhouette: 8, letter: 12 }, mystery: { gen: 3, silhouette: 7 } };
var CDP_WORDLE_AT = { type: 3, gen: 5 };

function cdpEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }
function cdpTypeColor(t) { return (typeof FAV_TYPE_COLORS !== 'undefined' && FAV_TYPE_COLORS[t]) || '#4069E0'; }
function cdpParty() { return typeof isPartySessionActive === 'function' && isPartySessionActive(); }
function cdpMode() {
  return typeof gameMode !== 'undefined' && Object.prototype.hasOwnProperty.call(CDP_AT, gameMode) && !cdpParty() &&
    !document.getElementById('screen-game')?.classList.contains('hidden');
}
function cdpAttempts() { return typeof attempts !== 'undefined' ? Number(attempts) || 0 : 0; }

// L'aide déjà méritée : envoyée par le serveur, sinon calculée ici (entraînement sans serveur).
function cdpHelp() {
  var vg = typeof verifiedGuess !== 'undefined' ? verifiedGuess : null;
  if (vg && vg.mode === gameMode) return { help: vg.help || {}, image: vg.helpImage || '' };
  var p = typeof secretPokemon !== 'undefined' ? secretPokemon : null, at = CDP_AT[gameMode], n = cdpAttempts(), out = {};
  if (!p || !at) return { help: {}, image: '' };
  if (at.silhouette && n >= at.silhouette) out.silhouette = true;
  if (at.letter && n >= at.letter) out.letter = Array.from(String(p.name))[0].toUpperCase();
  if (at.gen && n >= at.gen) out.gen = Number(p.gen || p.generation) || null;
  var img = typeof pokedexDetailArtwork === 'function' ? pokedexDetailArtwork(p, false) : (typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : '');
  return { help: out, image: img };
}

// Les étapes de l'aide, dans l'ordre, avec ce qu'elles donnent.
function cdpSteps(mode, help) {
  var at = CDP_AT[mode], steps = [];
  Object.keys(at).forEach(function (k) { steps.push({ k: k, at: at[k], got: help[k] !== undefined && help[k] !== false && help[k] !== null }); });
  steps.sort(function (a, b) { return a.at - b.at; });
  return steps;
}
var CDP_NAMES = { silhouette: 'Sa silhouette', letter: 'La 1re lettre', gen: 'Sa génération' };
var CDP_SHORT = { silhouette: 'Silhouette', letter: '1re lettre', gen: 'Génération' };

function cdpCardHtml(mode, n, help, image) {
  var steps = cdpSteps(mode, help), got = steps.filter(function (s) { return s.got; }), next = steps.find(function (s) { return !s.got; });
  var lines = [];
  if (help.letter) lines.push('Son nom commence par « ' + cdpEsc(help.letter) + ' »');
  if (help.gen) lines.push('Il vient de la génération ' + cdpEsc(help.gen));
  if (help.silhouette) lines.push('Voici sa silhouette floue');
  var last = steps[steps.length - 1].at, dots = '';
  for (var i = 1; i <= last; i++) dots += '<i' + (i <= n ? ' class="on"' : '') + '></i>';
  var nextHtml = next ? '<span class="cdp-next"><span class="cdp-dots" aria-hidden="true">' + dots + '</span>' + cdpEsc(CDP_SHORT[next.k]) + ' au ' + next.at + 'e essai</span>' : '';
  if (!got.length) {
    return '<div class="cdp-card is-teaser"><span class="cdp-k">💡 Coup de pouce</span><span class="cdp-next">' +
      '<span class="cdp-dots" aria-hidden="true">' + dots + '</span>' + cdpEsc(CDP_NAMES[next.k]) + ' au ' + next.at + 'e essai</span></div>';
  }
  var sil = help.silhouette && image ? '<span class="cdp-sil"><img src="' + cdpEsc(image) + '" alt="" draggable="false" decoding="async"></span>' : '';
  return '<div class="cdp-card' + (sil ? ' has-sil' : '') + '">' + sil + '<span class="cdp-k">💡 Coup de pouce · ' + n + ' essais</span>' +
    '<b>' + lines.join('<br>') + '</b>' + nextHtml + '</div>';
}

function cdpRender() {
  var shell = document.querySelector('#screen-game .classic-game-shell');
  var card = document.getElementById('cdp-card');
  var surrender = document.getElementById('btn-surrender');
  var on = cdpMode() && shell;
  if (surrender) {
    if (!surrender.dataset.cdpLabel) surrender.dataset.cdpLabel = surrender.textContent;
    var label = on ? '👀 Voir la réponse' : surrender.dataset.cdpLabel;
    if (surrender.textContent !== label) surrender.textContent = label;
  }
  // PC bas (1366 × 768) : la case à gauche et les essais à droite, côte à côte ; on garde cette mise en page et la
  // carte se range en haut de la colonne de la case. Ailleurs : la case remonte au-dessus des essais.
  var side = false;
  if (shell) { shell.classList.remove('cdp-top'); side = getComputedStyle(shell).display === 'grid'; shell.classList.toggle('cdp-top', Boolean(on) && !side); }
  var over = typeof gameOver !== 'undefined' && gameOver;
  var n = cdpAttempts();
  if (!on || over || n < 3) { if (card) card.remove(); return; }
  var h = cdpHelp();
  var html = cdpCardHtml(gameMode, n, h.help, h.image);
  if (!card) {
    card = document.createElement('div');
    card.id = 'cdp-card';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
  }
  var command = shell.querySelector('.classic-game-command');
  if (side && command) { if (card.parentElement !== command) command.prepend(card); }
  else if (card.parentElement !== shell) { if (command) shell.insertBefore(card, command); else shell.prepend(card); }
  if (card.dataset.h !== html) { card.innerHTML = html; card.dataset.h = html; }
}

// Le dernier essai en haut (illimité, Stat Mystère) : chaque essai ajouté passe en tête de la liste
// (sur PC c'est un vrai tableau : on déplace la ligne plutôt que de retourner l'affichage en CSS).
if (typeof addRow === 'function') {
  var cdpAddRowBefore = addRow;
  addRow = function () {
    var out = cdpAddRowBefore.apply(this, arguments);
    try {
      var body = document.getElementById('results-body');
      if (cdpMode() && body && body.children.length > 1 && body.lastElementChild !== body.firstElementChild) body.insertBefore(body.lastElementChild, body.firstElementChild);
    } catch (_e) {}
    return out;
  };
}
// La page se met à jour après chaque essai (ajouté par la page ou confirmé par le serveur) et à chaque nouvelle partie.
['addRow', 'startGameWithSecret', 'verifiedGuessApplyRows', 'verifiedGuessFinish', 'renderGameOverBox'].forEach(function (name) {
  if (typeof window[name] !== 'function') return;
  var before = window[name];
  window[name] = function () { var out = before.apply(this, arguments); try { setTimeout(cdpRender, 0); } catch (_e) {} return out; };
});
// Le serveur envoie l'aide avec chaque réponse : on la garde avec la partie.
if (typeof verifiedGuessApplyRows === 'function') {
  var cdpApplyBefore = verifiedGuessApplyRows;
  verifiedGuessApplyRows = function (view) {
    if (view && typeof verifiedGuess !== 'undefined' && verifiedGuess) { verifiedGuess.help = view.help || null; verifiedGuess.helpImage = view.helpImage || verifiedGuess.helpImage || ''; }
    return cdpApplyBefore.apply(this, arguments);
  };
}

// ---- Wordle : type après 3 lignes, génération après 5 ----
function cdpWordleHelp(s) {
  if (!s) return null;
  if (s.help) return s.help;
  if (!s.training || !s.answerId || typeof POKEMON_BY_ID === 'undefined') return null;
  var p = POKEMON_BY_ID.get(Number(s.answerId)), n = (s.rows || []).length, out = {};
  if (!p) return null;
  if (n >= CDP_WORDLE_AT.type || s.finished) out.type1 = p.type1;
  if (n >= CDP_WORDLE_AT.gen || s.finished) out.gen = Number(p.gen || p.generation) || null;
  return out.type1 ? out : null;
}
function cdpWordleRender() {
  var board = document.getElementById('wordle-board');
  var s = typeof dailyWordleState !== 'undefined' ? dailyWordleState : null;
  var card = document.getElementById('cdp-wordle');
  if (!board || !s || s.finished) { if (card) card.remove(); return; }
  var n = (s.rows || []).length, help = cdpWordleHelp(s);
  if (n < 1) { if (card) card.remove(); return; }
  var html;
  if (!help || !help.type1) {
    var left = CDP_WORDLE_AT.type - n;
    html = '<div class="cdp-card is-teaser"><span class="cdp-k">💡 Coup de pouce</span><span class="cdp-next">Son type après ' + left + ' ligne' + (left > 1 ? 's' : '') + ' de plus</span></div>';
  } else {
    var chips = '<span class="cdp-chip" style="--c:' + cdpTypeColor(help.type1) + '">Type · ' + cdpEsc(help.type1) + '</span>' +
      (help.gen ? '<span class="cdp-chip" style="--c:#7C5BD6">Génération ' + cdpEsc(help.gen) + '</span>'
        : '<span class="cdp-chip is-lock">🔒 Génération après la ' + CDP_WORDLE_AT.gen + 'e ligne</span>');
    html = '<div class="cdp-card"><span class="cdp-k">💡 Coup de pouce · ' + n + ' ligne' + (n > 1 ? 's' : '') + '</span><b>Son type : ' + cdpEsc(help.type1) + (help.gen ? ' · génération ' + cdpEsc(help.gen) : '') + '</b><span class="cdp-chips">' + chips + '</span></div>';
  }
  if (!card) {
    card = document.createElement('div');
    card.id = 'cdp-wordle';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    var box = board.firstElementChild;
    if (box && /myst/i.test(box.textContent || '')) box.after(card); else board.prepend(card);
  } else if (!card.isConnected || card.parentElement !== board) {
    var box2 = board.firstElementChild;
    if (box2 && box2 !== card && /myst/i.test(box2.textContent || '')) box2.after(card); else board.prepend(card);
  }
  if (card.dataset.h !== html) { card.innerHTML = html; card.dataset.h = html; }
}
if (typeof renderDailyWordle === 'function') {
  var cdpWordleBefore = renderDailyWordle;
  renderDailyWordle = function () {
    var out = cdpWordleBefore.apply(this, arguments);
    try { cdpWordleRender(); cdpWordleCta(); } catch (_e) {}
    return out;
  };
}
// À la fin du Wordle du jour : « 🔁 Rejouer en illimité » en vrai bouton (avant : un petit lien).
function cdpWordleCta() {
  var b = document.querySelector('#wordle-result .wordle-train-cta [data-action="startWordleTraining"]');
  if (b && !b.classList.contains('btn-blue')) { b.classList.remove('btn-ghost'); b.classList.add('btn-blue', 'cdp-cta'); b.textContent = '🔁 Rejouer en illimité'; }
}
