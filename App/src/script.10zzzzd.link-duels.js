// ⚔️ Défi par lien (11/11/2026, maquette validée par Kayan : « go défi »).
// « Lancer un défi » (compte requis) → la série de 10 → « Ton défi est prêt » → partage natif / WhatsApp / copier.
// Le lien pokdle.fr/d/<jeton> s'ouvre ici : on relève le défi sans compte ni salon, chaque essai part au
// serveur (lib/link-duels.js, logique de la « série de 10 » existante). À la fin : le duel, le classement
// du défi, la revanche, et l'inscription proposée pour garder ses résultats (la partie d'invité est reprise
// par le compte à la connexion). Réutilise les aides des défis entre joueurs (script.10xq) : pastilles,
// suggestions, fenêtre.

var ld = { token: null, data: null, busy: false };
var LD_RETURN = 'pokdle_duel_return';

function ldUrl(token) { return location.origin + '/d/' + encodeURIComponent(token); }
function ldEl(sel) { return document.querySelector('#overlay-body ' + sel); }
function ldPlural(n, word) { return n + ' ' + word + (n > 1 ? 's' : ''); }

function ldOpen(token) {
  ld.token = token;
  ld.data = null;
  if (typeof ensureOverlay !== 'function') return;
  ensureOverlay('⚔️ Défi Pokédle', '<div class="ld-wrap"><p class="pc-empty">Chargement du défi…</p></div>');
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'duel';
  return ldRefresh(true);
}

function ldRefresh(focus) {
  return pcGet('/api/duels/' + encodeURIComponent(ld.token)).then(function (data) {
    ld.data = data;
    ldRender(focus);
  }).catch(function () { ldMessage('Ce défi ne s’ouvre pas pour le moment. Réessaie dans un instant.'); });
}

function ldMessage(text, extra) {
  var box = ldEl('.ld-wrap');
  if (box) box.innerHTML = '<div class="ld-card ld-msg"><p>' + escapeHtml(text) + '</p>' + (extra || '') +
    '<button type="button" class="ld-btn is-dark" data-action="openLinkDuelCreate">⚔️ Lancer mon propre défi</button></div>';
}

function ldRender(focus) {
  var d = ld.data, box = ldEl('.ld-wrap');
  if (!box) return;
  if (!d || !d.ok) {
    var err = d && d.error;
    if (err === 'not_found') return ldMessage('Ce défi n’existe pas (ou plus). Vérifie le lien reçu.');
    if (err === 'not_ready') return ldMessage('Ce défi n’est pas encore prêt : son créateur n’a pas fini sa série.');
    return ldMessage('Ce défi ne s’ouvre pas pour le moment. Réessaie dans un instant.');
  }
  var g = d.game;
  if (g && !g.done) { box.innerHTML = ldGameHtml(d); ldBindGame(box, focus); return; }
  if (d.isCreator) { box.innerHTML = ldReadyHtml(d); return; }
  if (g && g.done) { box.innerHTML = ldResultHtml(d); return; }
  box.innerHTML = ldIntroHtml(d);
}

function ldScoreCard(label, found, sub, color, art) {
  return '<div class="ld-score" style="--ld:' + color + '"><small>' + escapeHtml(label) + '</small><b>' + Number(found) + ' / 10</b>' +
    '<span>' + escapeHtml(sub) + '</span>' + (art ? '<img src="' + art + '" alt="" aria-hidden="true">' : '') + '</div>';
}

function ldBoardHtml(d) {
  var b = d.board;
  if (!b || !b.rows || !b.rows.length) return '';
  var medal = ['🥇', '🥈', '🥉'];
  return '<div class="ld-board"><h4>Classement du défi <small>' + ldPlural(b.total, 'joueur') + '</small></h4>' +
    b.rows.map(function (r) {
      return '<div class="ld-row' + (r.me ? ' is-me' : '') + '"><span>' + (medal[r.rank - 1] || r.rank + '.') + ' ' + escapeHtml(r.me ? 'Toi' : r.name) + '</span>' +
        '<b>' + r.found + ' / 10</b><small>' + ldPlural(r.attempts, 'essai') + '</small></div>';
    }).join('') + '<p class="ld-hint">Départage : les Pokémon trouvés, puis le moins d’essais sur ceux-là.</p></div>';
}

function ldLeft(d) {
  var ms = new Date(d.expiresAt) - Date.now();
  if (ms <= 0) return 'terminé';
  var days = Math.floor(ms / 86400000), hours = Math.ceil((ms % 86400000) / 3600000);
  return days ? 'encore ' + days + ' j' : 'encore ' + hours + ' h';
}

// --- Le créateur : son défi est prêt, il le partage.
function ldReadyHtml(d) {
  var c = d.creator;
  return '<div class="ld-card"><span class="ld-k">⚔️ Lancer un défi</span><h3>Ton défi est prêt !</h3>' +
    '<p>Tu as trouvé <b>' + c.found + ' Pokémon sur 10</b>. Envoie le lien : on joue <b>les mêmes 10 Pokémon</b>, quand on veut, sans compte.</p>' +
    ldScoreCard('Ton score', c.found, ldPlural(c.attempts, 'essai') + ' · toutes générations', '#7C5BD6', 'img/art/448.webp') +
    '<button type="button" class="ld-btn is-yellow" data-action="ldShare">📤 Partager le défi</button>' +
    '<div class="ld-share3"><button type="button" class="ld-btn is-wa" data-action="ldShareWhatsApp">💬 WhatsApp</button>' +
    '<button type="button" class="ld-btn is-white" data-action="ldCopy">🔗 Copier le lien</button></div>' +
    '<p class="ld-note">⏳ Valable 7 jours (' + ldLeft(d) + ') · 🔔 tu es prévenu quand quelqu’un le relève, si les notifications sont activées.</p>' +
    ldBoardHtml(d) + '</div>';
}

// --- Celui qui ouvre le lien.
function ldIntroHtml(d) {
  var c = d.creator, closed = d.state !== 'open';
  var reason = d.blocked ? 'Ce défi ne t’est pas accessible.' : d.full ? 'Ce défi a déjà trop de participants.' : closed ? 'Ce défi est terminé.' : '';
  var nameField = d.signedIn ? '' : '<label class="ld-name"><span>Ton pseudo (facultatif)</span><input type="text" maxlength="16" autocomplete="nickname" placeholder="Invité" id="ld-guest-name"></label>';
  return '<div class="ld-card"><span class="ld-k">⚔️ Défi de ' + escapeHtml(c.name) + '</span>' +
    '<h3>' + escapeHtml(c.name) + ' a trouvé ' + c.found + ' Pokémon sur 10</h3>' +
    '<p>Les mêmes 10 Pokémon mystère, avec les indices du Pokémon du jour. ' + d.max + ' essais au plus par Pokémon. Une seule tentative.</p>' +
    '<div class="ld-chips"><span>🎯 10 Pokémon</span><span>🌍 Toutes générations</span><span>⏳ ' + ldLeft(d) + '</span></div>' +
    ldScoreCard('À battre', c.found, escapeHtml(c.name) + ' · ' + ldPlural(c.attempts, 'essai'), '#E5463F', 'img/art/6.webp') +
    (reason ? '<p class="ld-note">' + escapeHtml(reason) + '</p>' : nameField +
      '<button type="button" class="ld-btn is-dark" data-action="ldStart">▶ Relever le défi</button>' +
      (d.signedIn ? '' : '<p class="ld-hint">Pas besoin de compte. <button type="button" class="ld-link" data-action="ldLogin">Se connecter</button> pour garder ta victoire.</p>')) +
    ldBoardHtml(d) + '</div>';
}

// --- Le résultat, avec la revanche.
function ldResultHtml(d) {
  var g = d.game, c = d.creator;
  var cmp = g.found !== c.found ? g.found - c.found : c.attempts - g.attemptsWon;
  var banner = cmp > 0 ? '🏆 Tu as gagné !' : cmp < 0 ? escapeHtml(c.name) + ' gagne ce duel' : '🤝 Égalité parfaite !';
  var side = function (who, found, tries, win, art) {
    return '<div class="ld-pl' + (win ? ' is-win' : '') + '">' + (win ? '<span class="ld-crown">👑</span>' : '') + '<img src="' + art + '" alt="" aria-hidden="true">' +
      '<b>' + found + '</b><small>' + escapeHtml(who) + ' · ' + ldPlural(tries, 'essai') + '</small></div>';
  };
  var rematch = d.signedIn
    ? '<button type="button" class="ld-btn is-yellow" data-action="ldRematch">⚔️ Revanche : défier ' + escapeHtml(c.name) + '</button>'
    : '<button type="button" class="ld-btn is-yellow" data-action="ldLogin">⚔️ Revanche : crée ton compte gratuit</button>';
  return '<div class="ld-card"><div class="ld-banner' + (cmp < 0 ? ' is-lost' : '') + '">' + banner + '</div>' +
    '<div class="ld-vs">' + side('Toi', g.found, g.attemptsWon, cmp > 0, 'img/art/25.webp') + '<span>VS</span>' +
      side(c.name, c.found, c.attempts, cmp < 0, 'img/art/448.webp') + '</div>' +
    rematch + '<button type="button" class="ld-btn is-white" data-action="openLinkDuelCreate">📤 Défier quelqu’un d’autre</button>' +
    ldBoardHtml(d) +
    (d.signedIn ? '' : '<p class="ld-note">💾 Crée ton compte gratuit pour garder cette victoire et ton historique de duels : ta partie est reprise automatiquement.</p>') + '</div>';
}

// --- La partie : les 10 Pokémon, chaque essai vérifié par le serveur.
function ldGameHtml(d) {
  var g = d.game, mine = d.isCreator;
  var dots = '';
  for (var i = 0; i < 10; i++) {
    var r = g.rounds[i];
    dots += '<i class="' + (r ? (r.won ? 'is-won' : 'is-lost') : i === g.index ? 'is-cur' : '') + '"></i>';
  }
  var rows = (g.rows || []).slice().reverse().map(function (row) {
    var p = POKEMON_BY_ID && POKEMON_BY_ID.get(Number(row.pokemonId));
    if (!p) return '';
    return '<div class="pc-try"><div class="pc-try-who"><img src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" /><b>' + escapeHtml(p.name) + '</b></div><div class="pc-try-cells">' +
      PC_CELLS.map(function (c) { return '<div class="pc-cell is-' + escapeHtml(row.cmp[c[0]] || 'wrong') + '"><small>' + escapeHtml(c[1]) + '</small>' + escapeHtml(pcCellText(p, c[0], row)) + '</div>'; }).join('') +
      '</div></div>';
  }).join('');
  var target = mine ? 'Ton score sera celui à battre' : escapeHtml(d.creator.name) + ' : ' + d.creator.found + ' / 10 · toi : ' + g.found + ' trouvé' + (g.found > 1 ? 's' : '');
  return '<div class="ld-game"><div class="ld-top"><b>Pokémon ' + (g.index + 1) + ' / 10</b><span>essai ' + (g.attempts + 1) + ' / ' + g.max + '</span></div>' +
    '<div class="ld-dots" aria-label="Manches">' + dots + '</div>' +
    '<p class="ld-target">' + target + '</p>' +
    '<div class="pc-game-input"><input type="search" class="ld-guess" autocomplete="off" placeholder="Tape un Pokémon…" aria-label="Proposer un Pokémon" />' +
    '<button type="button" class="btn-blue" data-action="ldPlay">OK</button></div><div class="pc-suggests ld-suggests"></div>' +
    '<p class="pc-status" role="status" aria-live="polite"></p>' +
    '<div class="pc-tries">' + (rows || '<p class="pc-empty">Mêmes indices que le Pokémon du jour : 🟩 juste · 🟨 proche · ⬜ faux, ↑ ↓ pour la génération, la taille et le poids.</p>') + '</div>' +
    '<button type="button" class="btn-ghost ld-pass" data-action="ldPass">Passer ce Pokémon</button></div>';
}

function ldMatches(text) {
  var d = ld.data, used = new Set(((d && d.game && d.game.rows) || []).map(function (r) { return Number(r.pokemonId); }));
  var gens = (d && d.gens) || [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return pcMatches(text, used).filter(function (p) { return p.guessable !== false && gens.indexOf(Number(p.gen || p.generation)) !== -1; });
}

function ldBindGame(box, focus) {
  var input = box.querySelector('.ld-guess');
  if (!input) return;
  input.oninput = function () { var list = box.querySelector('.ld-suggests'); if (list) list.innerHTML = pcSuggestHtml(ldMatches(input.value)); };
  input.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); ldPlay(); } };
  box.onclick = function (e) { var pick = e.target.closest('[data-pc-pick]'); if (pick) ldPlay(Number(pick.dataset.pcPick)); };
  if (focus) input.focus({ preventScroll: true });
}

function ldSend(action) {
  var d = ld.data;
  if (!d || !d.game || ld.busy) return;
  ld.busy = true;
  var status = ldEl('.pc-status');
  pcPost('/api/duels/' + encodeURIComponent(ld.token) + '/play', Object.assign({ round: d.game.index }, action)).then(function (data) {
    ld.busy = false;
    if (!data || !data.ok) {
      if (status) status.textContent = data && data.error === 'invalid_guess' ? 'Ce Pokémon ne fait pas partie de ce défi.' : data && data.error === 'closed' ? 'Ce défi est terminé.' : 'Proposition impossible. Réessaie.';
      return;
    }
    ld.data = data;
    ldRender(!(data.game && data.game.done));
    if (data.fresh && typeof showToast === 'function') showToast(data.isCreator ? '⚔️ Ton défi est prêt : partage-le !' : '🏁 Défi terminé : résultat vérifié par le serveur');
  }).catch(function () {
    ld.busy = false;
    if (status) status.textContent = 'Connexion interrompue : réessaie, ta progression est gardée.';
  });
}
function ldPlay(pokemonId) {
  var input = ldEl('.ld-guess'), status = ldEl('.pc-status');
  var id = Number(pokemonId) || 0;
  if (!id && input) {
    var list = ldMatches(input.value);
    var exact = list.find(function (p) { return pcFold(p.name) === pcFold(input.value); });
    id = Number((exact || list[0] || {}).id) || 0;
  }
  if (!id) { if (status) status.textContent = 'Choisis un Pokémon dans la liste.'; return; }
  ldSend({ pokemonId: id });
}
function ldPass() { ldSend({ pass: true }); }

function ldStart() {
  if (ld.busy) return;
  ld.busy = true;
  var input = document.getElementById('ld-guest-name');
  pcPost('/api/duels/' + encodeURIComponent(ld.token) + '/start', { name: input ? input.value : '' }).then(function (data) {
    ld.busy = false;
    if (!data || !data.ok) {
      var why = { closed: 'Ce défi est terminé.', blocked: 'Ce défi ne t’est pas accessible.', full: 'Ce défi a déjà trop de participants.',
        own: 'C’est ton propre défi : partage-le !', network_limit: 'Ce défi a déjà été relevé plusieurs fois depuis cette connexion.', rate_limited: 'Trop d’essais : réessaie plus tard.' };
      return ldMessage(why[data && data.error] || 'Impossible de commencer pour le moment.');
    }
    return ldRefresh(true);
  }).catch(function () { ld.busy = false; ldMessage('Connexion interrompue. Réessaie.'); });
}

// --- Créer un défi (compte requis pour limiter les abus), et la revanche.
function ldCreate(rematchOf) {
  if (!window.__pokedleAuthed) {
    try { sessionStorage.setItem(LD_RETURN, 'create'); } catch (_e) {}
    if (typeof showToast === 'function') showToast('Connecte-toi pour lancer un défi : c’est gratuit.');
    if (typeof openLoginWelcome === 'function') openLoginWelcome();
    return;
  }
  if (ld.busy) return;
  ld.busy = true;
  pcPost('/api/duels', rematchOf ? { rematchOf: rematchOf } : {}).then(function (data) {
    ld.busy = false;
    if (!data || !data.ok) {
      var msg = data && data.error === 'daily_limit' ? 'Tu as lancé beaucoup de défis aujourd’hui : reviens demain.' : 'Le défi n’a pas pu être créé. Réessaie.';
      if (typeof showToast === 'function') showToast(msg);
      return;
    }
    ldOpen(data.token);
  }).catch(function () { ld.busy = false; if (typeof showToast === 'function') showToast('Connexion interrompue. Réessaie.'); });
}
function ldRematch() { ldCreate(ld.token); }
function ldLogin() {
  try { sessionStorage.setItem(LD_RETURN, ld.token || ''); } catch (_e) {}
  if (typeof openLoginWelcome === 'function') openLoginWelcome();
}

// --- Partage : menu natif du téléphone / de l'appli installée, sinon WhatsApp et copie.
function ldShareText() {
  var c = ld.data && ld.data.creator;
  return '⚔️ Je te défie sur Pokédle : ' + (c ? c.found : '?') + ' Pokémon sur 10. Tu fais mieux ? 😏';
}
function ldShare() {
  var url = ldUrl(ld.token), text = ldShareText();
  if (navigator.share) {
    navigator.share({ title: 'Défi Pokédle', text: text, url: url }).catch(function () {});
    return;
  }
  ldCopy();
}
function ldShareWhatsApp() {
  window.open('https://wa.me/?text=' + encodeURIComponent(ldShareText() + ' ' + ldUrl(ld.token)), '_blank', 'noopener');
}
function ldCopy() {
  var url = ldUrl(ld.token), done = function () { if (typeof showToast === 'function') showToast('🔗 Lien copié : colle-le dans WhatsApp, Discord…'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ldShareText() + ' ' + url).then(done, function () { prompt('Copie ce lien :', url); });
  else prompt('Copie ce lien :', url);
}

// --- Ouverture du lien /d/<jeton>, et retour après la connexion.
function ldBoot() {
  var m = /^\/d\/([A-Za-z0-9_-]{8,16})\/?$/.exec(location.pathname);
  if (m) {
    try { history.replaceState(null, '', '/'); } catch (_e) {}
    setTimeout(function () { ldOpen(m[1]); }, 400);
  }
}
window.addEventListener('pokedle:auth-ready', function () {
  var back = null;
  try { back = sessionStorage.getItem(LD_RETURN); sessionStorage.removeItem(LD_RETURN); } catch (_e) {}
  if (!back || !window.__pokedleAuthed) return;
  setTimeout(function () { if (back === 'create') ldCreate(); else ldOpen(back); }, 500);
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ldBoot); else ldBoot();

// --- Entrée sur l'accueil : « ⚔️ Lancer un défi » dans la bande « Défie tes amis ».
function ldHomeEntry() {
  var actions = document.querySelector('#screen-config .home-party-actions');
  if (!actions || actions.querySelector('.ld-home-btn')) return;
  actions.insertAdjacentHTML('afterbegin', '<button type="button" class="ld-home-btn" data-action="openLinkDuelCreate">⚔️ Lancer un défi <small>par lien, sans salon</small></button>');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ldHomeEntry); else ldHomeEntry();

window.openLinkDuelCreate = function () { ldCreate(); };
window.openLinkDuel = ldOpen;
window.ldStart = ldStart;
window.ldPlay = ldPlay;
window.ldPass = ldPass;
window.ldRematch = ldRematch;
window.ldLogin = ldLogin;
window.ldShare = ldShare;
window.ldShareWhatsApp = ldShareWhatsApp;
window.ldCopy = ldCopy;
