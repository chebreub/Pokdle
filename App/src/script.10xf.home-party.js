
// ===== « À plusieurs » on the home (31/10/2026) =====
// Newcomers did not see that Pokédle is also played with friends: the home now names the party
// games, and each one opens the Party Room with that game already chosen. The room is still
// created by the player, with their nickname; the game is applied once the room exists.
var PARTY_HOME_GAMES = Object.freeze({
  dessin: 'Dessine-le !',
  quiestce1v1: 'Qui est-ce ?',
  petitbac: 'Petit Bac',
  dexrace: 'Course au Pokédex',
});

function partyPrefillNickname() {
  var input = document.getElementById('party-nickname');
  var name = typeof playerProfile !== 'undefined' && playerProfile ? String(playerProfile.nickname || '').trim() : '';
  if (input && !input.value.trim() && name) input.value = name.slice(0, 24);
  return input;
}

function openPartyRoomWithGame(mode) {
  var game = Object.prototype.hasOwnProperty.call(PARTY_HOME_GAMES, mode) ? mode : null;
  var room = partyRoomState.room;
  if (room) {
    // Already in a room: the host switches to that game between two parties, the others just go back.
    openPartyRoomMode();
    var self = (room.players || []).find(function (player) { return player.isSelf; });
    if (game && self && self.isHost && (room.status === 'waiting' || room.status === 'complete') && room.gameMode !== game) partySetMode(game);
    return;
  }
  partyRoomState.pendingMode = game;
  openPartyRoomMode(true);
  partyPrefillNickname();
}
window.openPartyRoomWithGame = openPartyRoomWithGame;

function openPartyRoomJoin() {
  openPartyRoomMode();
  partyPrefillNickname();
  var code = document.getElementById('party-join-code');
  if (code && !partyRoomState.room) {
    try { code.focus({ preventScroll: true }); } catch (_e) { code.focus(); }
    try { code.scrollIntoView({ block: 'center' }); } catch (_e) {}
  }
}
window.openPartyRoomJoin = openPartyRoomJoin;

function clearPartyPendingGame() {
  partyRoomState.pendingMode = null;
  renderPartyPendingGame();
}
window.clearPartyPendingGame = clearPartyPendingGame;

// In the lobby, the game picked on the home is shown above « Créer mon salon ».
function renderPartyPendingGame() {
  var el = document.getElementById('party-pending-game');
  if (!el) return;
  var label = PARTY_HOME_GAMES[partyRoomState.pendingMode] || '';
  el.hidden = !label;
  el.innerHTML = label
    ? '<span>Jeu choisi</span><b>' + escapeHtml(label) + '</b><button type="button" data-action="clearPartyPendingGame" aria-label="Choisir le jeu plus tard, dans le salon">Changer</button>'
    : '';
}
