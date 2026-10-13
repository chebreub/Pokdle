// Qui est-ce ? dans la Party Room, comme le vrai jeu : deux joueurs, la même grille,
// chacun choisit son Pokémon secret. À tour de rôle, on pose une question sur celui
// de l'autre (bouton, question écrite ou à l'oral) et c'est l'autre qui répond oui ou
// non. Une question par catégorie (5 en tout) ; une mauvaise proposition fait perdre
// le tour. Les questions-boutons retournent les cartes toutes seules, sinon on clique.
let partyQuiGroup = 'type';
let partyQuiBusy = false;
let partyQuiGuessing = false;
let partyQuiSelected = null;
let partyQuiSeen = { serial: 0, out: [] };

function partyQuiQuestions(group) {
  // Legendary status is not known server-side: the party grid asks everything else.
  return quiEstCeQuestions().filter(q => q.id !== 'rare' && q.group === group);
}
function partyQuiName(room, id) {
  return (room.players || []).find(p => p.id === id)?.nickname || 'Ton rival';
}
function partyQuiQuestionText(entry) {
  if (entry.questionId) return quiEstCeQuestion(entry.questionId)?.label || entry.questionId;
  return entry.text || '';
}
function partyQuiLogHtml(room, me) {
  const log = room.round?.log || [];
  if (!log.length) return '';
  const groupLabel = key => (QUI_GROUPS.find(([k]) => k === key) || [key, key])[1];
  const who = id => me && id === me.id ? 'Toi' : escapeHtml(partyQuiName(room, id));
  return '<ol class="qui-duel-log" aria-label="Questions et réponses">' + log.slice().reverse().map(entry => {
    if (entry.kind === 'guess') {
      const p = quiPokemon(entry.pokemonId);
      return '<li><span>' + who(entry.by) + ' : c’est ' + escapeHtml(p?.name || '?') + ' ?</span><b class="' + (entry.correct ? 'is-yes' : 'is-no') + '">' + (entry.correct ? 'Trouvé !' : 'Raté') + '</b></li>';
    }
    if (entry.kind === 'oral') return '<li><span>' + who(entry.by) + ' : question à l’oral · ' + escapeHtml(groupLabel(entry.category)) + '</span></li>';
    const answer = entry.answer === 'oui' ? '<b class="is-yes">Oui</b>' : entry.answer === 'non' ? '<b class="is-no">Non</b>' : '<b class="is-wait">…</b>';
    return '<li><span>' + who(entry.by) + ' : ' + escapeHtml(partyQuiQuestionText(entry)) + '</span>' + answer + '</li>';
  }).join('') + '</ol>';
}
function partyQuiSecretHtml(id, label) {
  const p = id != null ? quiPokemon(id) : null;
  return p ? '<div class="qui-secret"><img src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" width="56" height="56"><span>' + label + '<b>' + escapeHtml(p.name) + '</b></span></div>' : '';
}
function partyQuiAskHtml(round) {
  const used = round.myUsed || [];
  if (used.length >= QUI_GROUPS.length) return '<p class="qui-hint">Tu as posé tes 5 questions : à toi de deviner !</p>';
  if (used.includes(partyQuiGroup)) partyQuiGroup = (QUI_GROUPS.find(([key]) => !used.includes(key)) || QUI_GROUPS[0])[0];
  const tabs = QUI_GROUPS.map(([key, label]) => used.includes(key)
    ? '<button type="button" disabled aria-pressed="false" class="is-used">' + label + ' ✓</button>'
    : '<button type="button" data-action="setPartyQuiGroup" data-args=\'["' + key + '"]\' aria-pressed="' + (key === partyQuiGroup) + '">' + label + '</button>').join('');
  const presets = partyQuiQuestions(partyQuiGroup).map(q => '<button type="button" class="qui-question" data-action="partyQuiAsk" data-args=\'["' + escapeHtml(q.id) + '"]\'' + (partyQuiBusy ? ' disabled' : '') + '>' + escapeHtml(q.label) + '</button>').join('');
  return '<p class="qui-hint">Une question par catégorie, ' + (QUI_GROUPS.length - used.length) + ' restante' + (QUI_GROUPS.length - used.length > 1 ? 's' : '') + '.</p>' +
    '<div class="qui-tabs" role="group" aria-label="Catégories de questions">' + tabs + '</div>' +
    '<div class="qui-questions">' + presets + '</div>' +
    '<form class="qui-free" data-submit-action="partyQuiAskText"><label class="sr-only" for="party-qui-text">Ta question</label><input id="party-qui-text" maxlength="90" autocomplete="off" placeholder="Ou écris ta question…"><button class="btn-ghost" type="submit"' + (partyQuiBusy ? ' disabled' : '') + '>Envoyer</button></form>' +
    '<button class="btn-ghost qui-oral" type="button" data-action="partyQuiAskOral"' + (partyQuiBusy ? ' disabled' : '') + '>J’ai posé ma question à l’oral</button>';
}
function renderPartyQuiEstCe(room, me, enabled, playing) {
  const panel = document.getElementById('party-quiestce');
  if (!panel) return;
  panel.classList.toggle('hidden', !enabled);
  if (!enabled) { partyQuiSelected = null; partyQuiGuessing = false; return; }
  const round = room.round || {};
  const draft = document.getElementById('party-qui-text');
  const draftValue = draft ? draft.value : '', draftFocused = draft && document.activeElement === draft;
  const serial = Number(round.roundSerial) || 0;
  if (serial !== partyQuiSeen.serial) { partyQuiSeen = { serial, out: [] }; partyQuiSelected = null; partyQuiGuessing = false; partyQuiGroup = 'type'; }
  const out = (round.mine?.out || []).map(Number);
  const flipped = out.filter(id => !partyQuiSeen.out.includes(id));
  partyQuiSeen.out = out.slice();
  const inGame = Boolean(me && (round.duelistIds || []).includes(me.id));
  const rivalId = (round.duelistIds || []).find(id => !me || id !== me.id);
  const rivalSecret = (round.secrets || []).find(entry => entry.id === rivalId);
  const state = {
    cards: (round.cards || []).map(Number), out, selected: partyQuiSelected,
    phase: playing ? 'playing' : 'finished', secretId: rivalSecret ? Number(rivalSecret.pokemonId) : -1, asked: []
  };
  const choosing = playing && round.phase === 'choose';
  const myTurn = playing && round.phase === 'play' && me && round.turnId === me.id;
  const pending = round.pending;
  let action = 'partyQuiFlip', locked = !inGame || !playing;
  if (choosing) { action = 'partyQuiChoose'; locked = !inGame || round.mySecretId != null; }
  else if (partyQuiGuessing && myTurn && !pending) action = 'partyQuiPick';
  const grid = '<div class="qui-grid' + (choosing && round.mySecretId == null ? ' is-choosing' : '') + (partyQuiGuessing && myTurn ? ' is-guessing' : '') + '">' + state.cards.map(id => quiCardHtml(state, id, flipped, action, locked)).join('') + '</div>';
  let side = '';
  if (!inGame) {
    side = '<p class="qui-status">Tu regardes cette partie.</p><p class="qui-hint">' + escapeHtml(partyQuiName(room, round.duelistIds?.[0])) + ' contre ' + escapeHtml(partyQuiName(room, round.duelistIds?.[1])) + '. Tu joueras à la prochaine manche.</p>' + partyQuiLogHtml(room, me);
  } else if (!playing) {
    const reveal = (round.secrets || []).map(entry => { const p = quiPokemon(entry.pokemonId); return p ? '<span><img src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" width="40" height="40">' + (entry.id === me.id ? 'Toi' : escapeHtml(partyQuiName(room, entry.id))) + ' : <b>' + escapeHtml(p.name) + '</b></span>' : ''; }).join('');
    side = '<p class="qui-status">Partie terminée</p><div class="qui-reveal">' + reveal + '</div>' + partyQuiLogHtml(room, me);
  } else if (choosing) {
    const rivalReady = (round.chosen || []).find(entry => entry.id === rivalId)?.chosen;
    side = round.mySecretId == null
      ? '<p class="qui-status">Choisis ton Pokémon secret</p><p class="qui-hint">Clique sur une carte : ' + escapeHtml(partyQuiName(room, rivalId)) + ' devra le deviner.</p>'
      : partyQuiSecretHtml(round.mySecretId, 'Ton Pokémon secret') + '<p class="qui-hint">' + (rivalReady ? 'C’est parti…' : 'En attente du choix de ' + escapeHtml(partyQuiName(room, rivalId)) + '…') + '</p>';
  } else {
    let turn = '';
    if (pending && pending.askerId !== me.id) {
      turn = '<div class="qui-answer-box"><p>' + escapeHtml(partyQuiName(room, pending.askerId)) + ' demande :</p><b>« ' + escapeHtml(partyQuiQuestionText(pending)) + ' »</b><div class="qui-answer-actions"><button class="btn-blue" type="button" data-action="partyQuiAnswer" data-args=\'["oui"]\'' + (partyQuiBusy ? ' disabled' : '') + '>Oui</button><button class="btn-blue" type="button" data-action="partyQuiAnswer" data-args=\'["non"]\'' + (partyQuiBusy ? ' disabled' : '') + '>Non</button></div></div>';
    } else if (pending) {
      turn = '<p class="qui-turn">En attente de la réponse de ' + escapeHtml(partyQuiName(room, rivalId)) + '…</p>';
    } else if (myTurn) {
      const selected = partyQuiSelected != null ? quiPokemon(partyQuiSelected) : null;
      turn = '<p class="qui-turn is-mine">À toi ! Pose une question ou devine.</p>' + (partyQuiGuessing
        ? '<p class="qui-hint">Clique la carte que tu crois être la sienne. Une erreur te fait perdre ton tour.</p>' + (selected ? '<button class="btn-blue qui-propose-btn" type="button" data-action="partyQuiGuess"' + (partyQuiBusy ? ' disabled' : '') + '>C’est ' + escapeHtml(selected.name) + ' ?</button>' : '') + '<button class="btn-ghost" type="button" data-action="partyQuiToggleGuess">Revenir aux questions</button>'
        : partyQuiAskHtml(round) + '<button class="btn-ghost qui-guess-btn" type="button" data-action="partyQuiToggleGuess">Je veux deviner</button>');
    } else {
      turn = '<p class="qui-turn">Tour de ' + escapeHtml(partyQuiName(room, round.turnId)) + '…</p>';
    }
    side = partyQuiSecretHtml(round.mySecretId, 'Ton Pokémon secret') + turn +
      '<p class="qui-hint">Clique une carte pour la retourner ou la relever.</p>' + partyQuiLogHtml(room, me) +
      '<button class="btn-ghost qui-giveup" type="button" data-action="partyQuiForfeit"' + (partyQuiBusy ? ' disabled' : '') + '>Abandonner</button>';
  }
  panel.innerHTML = '<p class="qui-hint">Chacun choisit son Pokémon secret sur la même grille. À tour de rôle, une question sur celui de l’autre, qui répond oui ou non. Une question par catégorie ; le premier qui trouve gagne 100 points.</p>' +
    '<div class="qui-layout"><section class="qui-board" aria-label="Ta grille">' + grid + '</section><aside class="qui-panel">' + side + '</aside></div>';
  const input = document.getElementById('party-qui-text');
  if (input && draftValue) input.value = draftValue;
  if (input && draftFocused) input.focus({ preventScroll: true });
}
function partyQuiRoom() {
  const room = partyRoomState?.room;
  return room && room.gameMode === 'quiestce1v1' && room.status === 'playing' ? room : null;
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
  if (payload.quiAction !== 'flip') renderPartyRoom();
}
function partyQuiChoose(id) { partyQuiSend({ quiAction: 'choose', pokemonId: Number(id) }); }
function partyQuiFlip(id) { partyQuiSend({ quiAction: 'flip', pokemonId: Number(id) }); }
function partyQuiAsk(questionId) { partyQuiSend({ quiAction: 'ask', category: partyQuiGroup, questionId }); }
function partyQuiAskOral() { partyQuiSend({ quiAction: 'ask', category: partyQuiGroup, oral: true }); }
function partyQuiAskText(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  const input = document.getElementById('party-qui-text'), text = input ? input.value.trim() : '';
  if (!text) { if (typeof setPartyStatus === 'function') setPartyStatus('Écris ta question.'); return; }
  partyQuiSend({ quiAction: 'ask', category: partyQuiGroup, text }, res => { if (res.ok && input) input.value = ''; });
}
function partyQuiAnswer(answer) { partyQuiSend({ quiAction: 'answer', answer }); }
function partyQuiToggleGuess() {
  partyQuiGuessing = !partyQuiGuessing;
  partyQuiSelected = null;
  renderPartyRoom();
}
function partyQuiPick(id) {
  id = Number(id);
  partyQuiSelected = partyQuiSelected === id ? null : id;
  renderPartyRoom();
}
function partyQuiGuess() {
  if (partyQuiSelected == null) return;
  const id = partyQuiSelected;
  partyQuiSend({ quiAction: 'guess', pokemonId: id }, res => {
    if (res.ok && !res.correct && typeof setPartyStatus === 'function') setPartyStatus('Raté, ce n’est pas ' + (quiPokemon(id)?.name || 'lui') + ' : tu perds ton tour.');
    partyQuiSelected = null;
    partyQuiGuessing = false;
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
