// Arène des Captures (beta) : 1 a 3 manches contre une equipe d'entrainement.
// Seuls les Pokemon ACTUELLEMENT possedes, renvoyes par /api/wild/collection, sont eligibles.
// Pas d'XP, de piece, de classement, d'alteration d'inventaire ou de resultat sauvegarde.
var caState = { stage: 'loading', owned: [], selected: [], enemies: [], history: [], round: 0, error: '' };
var CA_ENEMY_IDS = [6, 157, 257, 392, 503, 655, 724, 815, 908, 130, 248, 282, 445, 448, 609, 703, 752, 823, 887, 934];

function caTypes(p) { return [p && p.type1, p && p.type2].filter(function (t, i, a) { return Boolean(t) && a.indexOf(t) === i; }); }
function caLookup(id) {
  return typeof POKEMON_BY_ID !== 'undefined' && POKEMON_BY_ID && POKEMON_BY_ID.get(Number(id)) || null;
}
function caOwnedFromServer(payload) {
  if (!payload || !payload.ok || !Array.isArray(payload.captures)) return [];
  var seen = new Set();
  return payload.captures.map(function (item) {
    var id = Number(item && item.id), count = (Number(item && item.normal) || 0) + (Number(item && item.shiny) || 0);
    if (!Number.isInteger(id) || id <= 0 || count <= 0 || seen.has(id)) return null;
    seen.add(id);
    return caLookup(id);
  }).filter(function (p) { return Boolean(p && !p.isAltForm && caTypes(p).length); });
}
function caPower(move, defender) {
  if (typeof attackMultiplier !== 'function') return 10;
  var effect = caTypes(defender).reduce(function (value, type) { return value * (Number(attackMultiplier(move, type)) || 0); }, 1);
  return Math.round(10 * Math.max(0, Math.min(4, effect)));
}
function caEnemyMove(enemy, player) {
  return caTypes(enemy).reduce(function (best, move) {
    return !best || caPower(move, player) > caPower(best, player) ? move : best;
  }, '');
}
function caPickEnemies(ownedIds, count) {
  var banned = new Set(ownedIds), pool = CA_ENEMY_IDS.map(caLookup).filter(function (p) {
    return Boolean(p && !banned.has(p.id) && caTypes(p).length);
  });
  if (pool.length < count) return [];
  // Rotation quotidienne des adversaires : sans gain, ni enjeu serveur.
  var offset = Math.floor(Date.now() / 86400000) % pool.length;
  var ordered = pool.slice(offset).concat(pool.slice(0, offset));
  var chosen = [];
  // Espacer les adversaires dans la liste pour varier les generations.
  for (var step = 0; chosen.length < count && step < pool.length; step++) {
    var p = ordered[(step * 7) % pool.length];
    if (!chosen.some(function (c) { return c.id === p.id; })) chosen.push(p);
  }
  return chosen;
}
function caArtwork(p) {
  try { if (typeof pokedexDetailArtwork === 'function') return pokedexDetailArtwork(p, false); } catch (_e) {}
  return typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : '';
}
function caPokemonHtml(p, small) {
  return '<img src="' + escapeHtml(caArtwork(p)) + '" alt="' + escapeHtml(p.name) +
    '" loading="lazy" decoding="async" width="' + (small ? '72' : '100') + '" height="' + (small ? '72' : '100') + '">';
}
function caTypeLabel(p) { return caTypes(p).map(function (t) { return escapeHtml(t); }).join(' / '); }
function caPickHtml() {
  if (!caState.owned.length) return '<div class="ca-empty"><p>Tu n’as pas encore de Pokemon capture et possede.</p>' +
    '<p>Les decouvertes du Pokedex ne suffisent pas : attrape un Pokemon dans les hautes herbes.</p>' +
    '<button type="button" class="btn-blue" data-action="caGoGrass">Explorer les hautes herbes</button></div>';
  var chosen = caState.selected;
  var cards = caState.owned.map(function (p) {
    var picked = chosen.indexOf(p.id), selected = picked >= 0;
    return '<button type="button" class="ca-mon' + (selected ? ' is-picked' : '') +
      '" aria-pressed="' + selected + '" data-action="caToggle" data-args="[' + p.id + ']">' +
      caPokemonHtml(p, true) + '<b>' + escapeHtml(p.name) + '</b><small>' + caTypeLabel(p) +
      '</small><span>' + (selected ? 'Position ' + (picked + 1) + ' ✓' : 'Choisir') + '</span></button>';
  }).join('');
  return '<p class="ca-instructions">Compose une equipe de 1 a 3 Pokemon deja captures. L’ordre de selection determine celui des manches.</p>' +
    '<p class="ca-count" aria-live="polite"><b>' + chosen.length + ' / 3</b> Pokemon selectionnes</p>' +
    '<div class="ca-mon-grid">' + cards + '</div>' +
    '<button type="button" class="btn-blue ca-start" data-action="caStart"' + (chosen.length ? '' : ' disabled') +
      '>Commencer · ' + chosen.length + ' manche' + (chosen.length > 1 ? 's' : '') + '</button>';
}
function caLastHtml() {
  var last = caState.history[caState.history.length - 1];
  if (!last) return '';
  var result = last.outcome > 0 ? 'Manche gagnee !' : last.outcome < 0 ? 'Manche perdue' : 'Egalite';
  return '<div class="ca-last" role="status"><b>' + result + '</b><span>' +
    escapeHtml(last.player.name) + ' (' + escapeHtml(last.move) + ' : ' + last.ours + ') · ' +
    escapeHtml(last.enemy.name) + ' (' + escapeHtml(last.enemyMove) + ' : ' + last.theirs +
    ')</span></div>';
}
function caFightHtml() {
  var player = caLookup(caState.selected[caState.round]);
  var enemy = caState.enemies[caState.round];
  if (!player || !enemy) return '<p>La manche est indisponible. Recommence l’entrainement.</p>';
  var buttons = caTypes(player).map(function (type) {
    return '<button type="button" class="ca-attack" data-action="caAttack" data-args=\'["' +
      escapeHtml(type) + '"]\'><b>' + escapeHtml(type) + '</b><small>Puissance : ' + caPower(type, enemy) + '</small></button>';
  }).join('');
  return '<div class="ca-progress">Manche ' + (caState.round + 1) + ' / ' + caState.selected.length + '</div>' +
    caLastHtml() + '<div class="ca-versus"><div>' + caPokemonHtml(player, false) + '<strong>' + escapeHtml(player.name) +
    '</strong><small>' + caTypeLabel(player) + '</small></div><span aria-hidden="true">VS</span><div>' +
    caPokemonHtml(enemy, false) + '<strong>' + escapeHtml(enemy.name) +
    '</strong><small>' + caTypeLabel(enemy) + '</small></div></div>' +
    '<p class="ca-instructions">Choisis le type d’attaque. Les deux Pokemon frappent : l’efficacité des types decide de cette manche.</p>' +
    '<div class="ca-attacks">' + buttons + '</div>';
}
function caDoneHtml() {
  var wins = caState.history.filter(function (h) { return h.outcome > 0; }).length;
  var losses = caState.history.filter(function (h) { return h.outcome < 0; }).length;
  var draws = caState.history.length - wins - losses;
  var verdict = wins > losses ? 'Victoire de ton equipe !' : losses > wins ? 'L’equipe adverse l’emporte' : 'Match nul !';
  return '<div class="ca-end" role="status"><span aria-hidden="true">⚔️</span><h3>' + verdict + '</h3>' +
    '<strong>' + wins + ' gagnee' + (wins > 1 ? 's' : '') + ' · ' + losses + ' perdue' + (losses > 1 ? 's' : '') +
    ' · ' + draws + ' egalite' + (draws > 1 ? 's' : '') + '</strong></div>' +
    '<div class="ca-history">' + caState.history.map(function (h, i) {
      return '<div><b>' + (i + 1) + '. ' + escapeHtml(h.player.name) + ' / ' + escapeHtml(h.enemy.name) +
        '</b><span>' + h.ours + ' - ' + h.theirs + '</span></div>';
    }).join('') + '</div>' +
    '<div class="ca-actions"><button type="button" class="btn-blue" data-action="openCaptureArena">Recomposer mon equipe</button>' +
    '<button type="button" class="btn-ghost" data-action="caGoGrass">Faire une capture</button></div>';
}
function caRender() {
  var el = document.querySelector('#overlay-body .capture-arena');
  if (!el) return;
  var lead = '<p class="ca-disclaimer">BETA · Entrainement solo · Pokemon captures uniquement · Aucun gain d’XP, de monnaie ou de Ball</p>';
  el.innerHTML = lead + (caState.error
    ? '<p role="alert">' + escapeHtml(caState.error) + '</p><button type="button" class="btn-blue" data-action="openCaptureArena">Reessayer</button>'
    : caState.stage === 'loading' ? '<p role="status">Lecture de tes captures…</p>'
    : caState.stage === 'pick' ? caPickHtml()
    : caState.stage === 'fight' ? caFightHtml() : caDoneHtml());
}
async function openCaptureArena() {
  caState = { stage: 'loading', owned: [], selected: [], enemies: [], history: [], round: 0, error: '' };
  if (typeof ensureOverlay !== 'function') return;
  ensureOverlay('⚔️ Arène des Captures', '<div class="capture-arena"></div>');
  caRender();
  // Aucune capture n'est inferee du profil : on exige une lecture serveur reussie.
  try {
    var response = await fetch('/api/wild/collection', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw Error('unavailable');
    var data = await response.json();
    if (!data || !data.ok || !Array.isArray(data.captures)) throw Error('unavailable');
    caState.owned = caOwnedFromServer(data);
    caState.stage = 'pick';
  } catch (_e) {
    caState.error = 'Impossible de verifier tes captures pour le moment. Reessaie dans un instant.';
  }
  caRender();
}
function caToggle(id) {
  if (caState.stage !== 'pick') return;
  id = Number(id);
  if (!caState.owned.some(function (p) { return p.id === id; })) return;
  var i = caState.selected.indexOf(id);
  if (i >= 0) caState.selected.splice(i, 1);
  else if (caState.selected.length < 3) caState.selected.push(id);
  caRender();
}
function caStart() {
  if (caState.stage !== 'pick' || !caState.selected.length || caState.selected.length > 3) return;
  if (caState.selected.some(function (id) { return !caState.owned.some(function (p) { return p.id === id; }); })) return;
  var enemies = caPickEnemies(caState.selected, caState.selected.length);
  if (enemies.length !== caState.selected.length) {
    caState.error = 'Adversaires indisponibles. Reessaie plus tard.';
  } else {
    caState.enemies = enemies; caState.history = []; caState.round = 0; caState.stage = 'fight';
  }
  caRender();
}
function caAttack(type) {
  if (caState.stage !== 'fight') return;
  var player = caLookup(caState.selected[caState.round]), enemy = caState.enemies[caState.round];
  if (!player || !enemy || caTypes(player).indexOf(type) < 0) return;
  var enemyMove = caEnemyMove(enemy, player);
  var ours = caPower(type, enemy), theirs = caPower(enemyMove, player);
  caState.history.push({ player: player, enemy: enemy, move: type, enemyMove: enemyMove,
    ours: ours, theirs: theirs, outcome: Math.sign(ours - theirs) });
  caState.round++;
  if (caState.round >= caState.selected.length) caState.stage = 'done';
  caRender();
}
function caGoGrass() {
  if (typeof closeOverlayModal === 'function') closeOverlayModal();
  if (typeof openWildGrass === 'function') openWildGrass();
}
function caEnsureEntry() {
  var hub = document.getElementById('pokedex-collection-hub');
  if (!hub || hub.querySelector('.ca-entry')) return;
  var switcher = hub.querySelector('.pokedex-experience-switch');
  if (!switcher) return;
  switcher.insertAdjacentHTML('afterend',
    '<div class="ca-entry"><span><b>⚔️ Arène des Captures</b><small>Utilise tes vrais Pokemon captures dans des duels de types.</small></span>' +
    '<button type="button" class="btn-blue" data-action="openCaptureArena">Essayer l’arene</button></div>');
}
if (typeof renderPokedexCollectionHub === 'function') {
  var caBeforeCollectionHub = renderPokedexCollectionHub;
  renderPokedexCollectionHub = function () {
    var out = caBeforeCollectionHub.apply(this, arguments);
    caEnsureEntry();
    return out;
  };
}
window.openCaptureArena = openCaptureArena;
window.caToggle = caToggle;
window.caStart = caStart;
window.caAttack = caAttack;
window.caGoGrass = caGoGrass;
