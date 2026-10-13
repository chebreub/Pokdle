// Qui est-ce ? dans la Party Room : même grille et même mystère pour tous.
// Chacun pose ses questions en privé, le serveur répond et retourne ses cartes ;
// le premier qui trouve le Pokémon gagne la manche. Réutilise le rendu du solo.
let partyQuiSelected = null;
let partyQuiGroup = 'type';
let partyQuiBusy = false;
let partyQuiSeen = { serial: 0, out: [] };

function partyQuiQuestions() {
  // Legendary status is not known server-side: the party grid asks everything else.
  return quiEstCeQuestions().filter(q => q.id !== 'rare');
}
function partyQuiState(room) {
  const round = room.round || {}, mine = round.mine || { out: [], asked: [] };
  return {
    cards: Array.isArray(round.cards) ? round.cards.map(Number) : [],
    out: (mine.out || []).map(Number),
    asked: (mine.asked || []).map(entry => ({ id: entry.id, answer: Boolean(entry.answer), short: quiEstCeQuestion(entry.id)?.short || entry.id })),
    selected: partyQuiSelected,
    phase: room.status === 'playing' ? 'playing' : 'finished',
    secretId: round.answerId != null ? Number(round.answerId) : -1,
    serial: Number(round.roundSerial) || 0
  };
}
function renderPartyQuiEstCe(room, me, enabled, playing) {
  const panel = document.getElementById('party-quiestce');
  if (!panel) return;
  panel.classList.toggle('hidden', !enabled);
  if (!enabled) { partyQuiSelected = null; return; }
  const state = partyQuiState(room);
  if (state.serial !== partyQuiSeen.serial) { partyQuiSeen = { serial: state.serial, out: [] }; partyQuiSelected = null; state.selected = null; }
  if (state.selected !== null && (state.out.includes(state.selected) || !state.cards.includes(state.selected))) partyQuiSelected = state.selected = null;
  const flipped = state.out.filter(id => !partyQuiSeen.out.includes(id));
  partyQuiSeen.out = state.out.slice();
  const canPlay = Boolean(playing && me && !me.correct && !me.gaveUp);
  const remaining = state.cards.filter(id => !state.out.includes(id));
  const grid = '<div class="qui-grid">' + state.cards.map(id => quiCardHtml(state, id, flipped, 'partyQuiSelect', !canPlay)).join('') + '</div>';
  let side = '';
  if (!playing) {
    side = '<p class="qui-status">Manche terminée</p>' + quiLogHtml(state);
  } else if (me?.correct) {
    side = '<p class="qui-status">Trouvé ! 🎉</p><p class="qui-hint">Attends la fin de la manche.</p>' + quiLogHtml(state);
  } else if (me?.gaveUp) {
    side = '<p class="qui-status">Tu as abandonné cette manche.</p>' + quiLogHtml(state);
  } else {
    const selected = state.selected !== null ? quiPokemon(state.selected) : null;
    const tabs = QUI_GROUPS.map(([key, label]) => '<button type="button" data-action="setPartyQuiGroup" data-args=\'["' + key + '"]\' aria-pressed="' + (key === partyQuiGroup) + '">' + label + '</button>').join('');
    const questions = partyQuiQuestions().filter(q => q.group === partyQuiGroup).map(q => {
      const asked = state.asked.find(entry => entry.id === q.id);
      if (asked) return '<button type="button" class="qui-question is-asked" disabled>' + escapeHtml(q.label) + '<b class="' + (asked.answer ? 'is-yes' : 'is-no') + '">' + (asked.answer ? 'Oui' : 'Non') + '</b></button>';
      const useful = quiQuestionUseful(q, state);
      return '<button type="button" class="qui-question" data-action="partyQuiAsk" data-args=\'["' + escapeHtml(q.id) + '"]\'' + (useful && !partyQuiBusy ? '' : ' disabled') + '>' + escapeHtml(q.label) + '</button>';
    }).join('');
    side = '<p class="qui-status"><b>' + (Number(me?.attempts) || 0) + '</b> question' + ((Number(me?.attempts) || 0) > 1 ? 's' : '') + ' · <b>' + remaining.length + '</b> possible' + (remaining.length > 1 ? 's' : '') + '</p>' +
      '<div class="qui-propose">' + (selected ? '<button class="btn-blue qui-propose-btn" type="button" data-action="partyQuiPropose"' + (partyQuiBusy ? ' disabled' : '') + '>C’est ' + escapeHtml(selected.name) + ' !</button>' : '<p class="qui-hint">Clique une carte pour la proposer. Une erreur coûte ' + QUI_WRONG_GUESS_COST + ' questions.</p>') + '</div>' +
      '<div class="qui-tabs" role="group" aria-label="Thèmes de questions">' + tabs + '</div><div class="qui-questions">' + questions + '</div>' + quiLogHtml(state) +
      '<button class="btn-ghost qui-giveup" type="button" data-action="partyQuiForfeit"' + (partyQuiBusy ? ' disabled' : '') + '>Abandonner la manche</button>';
  }
  panel.innerHTML = '<p class="qui-hint">Même grille, même mystère pour tous. Tes questions et tes cartes retournées restent secrètes. Le premier qui trouve gagne 100 points.</p>' +
    '<div class="qui-layout"><section class="qui-board" aria-label="Grille des Pokémon">' + grid + '</section><aside class="qui-panel">' + side + '</aside></div>';
}
function partyQuiRoom() {
  const room = partyRoomState?.room;
  return room && room.gameMode === 'quiestce' && room.status === 'playing' ? room : null;
}
function partyQuiSend(payload, done) {
  const room = partyQuiRoom(), socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!room || !socket || partyQuiBusy) return;
  partyQuiBusy = true;
  socket.emit('party:submit-answer', { code: room.code, roundSerial: room.round?.roundSerial, ...payload }, res => {
    partyQuiBusy = false;
    res = res || {};
    if (res.room) partyRoomState.room = res.room;
    if (!res.ok && res.error && typeof setPartyStatus === 'function') setPartyStatus(res.error);
    if (typeof done === 'function') done(res);
    renderPartyRoom();
  });
  renderPartyRoom();
}
function partyQuiAsk(questionId) {
  partyQuiSend({ quiAction: 'ask', questionId }, res => {
    if (res.ok && typeof setPartyStatus === 'function') setPartyStatus((res.answer ? 'Oui' : 'Non') + ' : ' + (res.flipped?.length || 0) + ' carte' + ((res.flipped?.length || 0) > 1 ? 's retournées' : ' retournée') + '.');
  });
}
function partyQuiSelect(id) {
  const room = partyQuiRoom();
  if (!room) return;
  id = Number(id);
  partyQuiSelected = partyQuiSelected === id ? null : id;
  renderPartyRoom();
}
function partyQuiPropose() {
  if (partyQuiSelected === null) return;
  const id = partyQuiSelected;
  partyQuiSend({ quiAction: 'propose', pokemonId: id }, res => {
    if (res.ok && !res.correct && typeof setPartyStatus === 'function') setPartyStatus('Raté, ce n’est pas ' + (quiPokemon(id)?.name || 'lui') + ' (+' + QUI_WRONG_GUESS_COST + ' questions).');
    partyQuiSelected = null;
  });
}
function partyQuiForfeit() {
  const room = partyQuiRoom(), socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!room || !socket || partyQuiBusy) return;
  partyQuiBusy = true;
  socket.emit('party:forfeit-deduction', { code: room.code, roundSerial: room.round?.roundSerial }, res => {
    partyQuiBusy = false;
    res = res || {};
    if (res.room) partyRoomState.room = res.room;
    if (!res.ok && res.error && typeof setPartyStatus === 'function') setPartyStatus(res.error);
    renderPartyRoom();
  });
}
function setPartyQuiGroup(group) {
  partyQuiGroup = QUI_GROUPS.some(([key]) => key === group) ? group : 'type';
  renderPartyRoom();
}
