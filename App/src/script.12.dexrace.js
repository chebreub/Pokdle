
// A shared, server-scored board. Names are typed from memory, without suggestions.
let dexRaceArenaKey = '', dexRaceTimer = null, dexRaceObserver = null, dexRacePending = false, dexRaceLobbyKey = '', dexRaceClockOffset = 0;
function dexRaceRequest(event, payload) {
  const socket = ensurePartyListeners();
  if (!socket?.connected) { setPartyStatus('Connexion indisponible.'); return; }
  socket.emit(event, payload, res => {
    if (!res?.ok) { setPartyStatus(res?.error || 'Impossible de modifier la course.'); return; }
    partyRoomState.room = res.room; setPartyStatus(''); renderPartyRoom();
  });
}
function setDexRaceFormat(format) { dexRaceRequest('party:dexrace-options', {format,duration:partyRoomState.room.raceDuration || 180}); }
function setDexRaceDuration(duration) { dexRaceRequest('party:dexrace-options', {format:partyRoomState.room.raceFormat || 'duel',duration}); }
function chooseDexRaceTeam(team) { dexRaceRequest('party:dexrace-team', {team}); }
function renderDexRaceSetup(room, me, isHost) {
  let setup = document.getElementById('dex-race-setup');
  if (!setup) { setup = document.createElement('section'); setup.id = 'dex-race-setup'; setup.className = 'dex-race-setup'; document.getElementById('party-setup').appendChild(setup); }
  const active = room.gameMode === 'dexrace';
  setup.classList.toggle('hidden', !active);
  document.getElementById('party-gens-all').classList.toggle('hidden', active);
  if (!active) return;
  document.getElementById('party-rounds-select').classList.add('hidden');
  document.getElementById('party-round').classList.add('hidden');
  document.getElementById('party-mode-hint').textContent = 'Une génération, une grille commune. Tape les noms français : le premier prend la case et marque 1 point. Les doublons ne comptent pas. Espèces classiques, sans formes alternatives. Conçu pour ordinateur.';
  document.getElementById('party-launch-note').textContent = `${room.raceFormat === 'teams' ? 'Deux équipes de même taille' : 'Duel · exactement 2 joueurs'} · ${room.raceDuration / 60} min · Gen ${room.selectedGens[0]}`;
  document.getElementById('party-roster-title').textContent = 'Les participants';
  const disabled = isHost ? '' : ' disabled';
  const option = (action,value,label,selected) => `<button type="button" class="btn-ghost" data-action="${action}" data-args='[${JSON.stringify(value)}]' aria-pressed="${selected}"${disabled}>${label}</button>`;
  setup.innerHTML = `<div class="race-setting"><strong>Format</strong><div>${option('setDexRaceFormat','duel','Duel 1 contre 1',room.raceFormat !== 'teams')}${option('setDexRaceFormat','teams','Deux équipes',room.raceFormat === 'teams')}</div></div><div class="race-setting"><strong>Durée</strong><div>${option('setDexRaceDuration',180,'3 minutes',room.raceDuration === 180)}${option('setDexRaceDuration',300,'5 minutes',room.raceDuration === 300)}</div></div>${room.raceFormat === 'teams' ? '<div class="race-team-choice">' + ['blue','coral'].map(team => `<div class="race-side race-${team}"><b>Équipe ${team === 'blue' ? 'Azur' : 'Corail'}</b><p>${room.players.filter(p=>p.raceTeam===team).map(p=>escapeHtml(p.nickname)).join(' · ') || 'Aucun joueur'}</p><button type="button" class="btn-ghost" data-action="chooseDexRaceTeam" data-args='["${team}"]' aria-pressed="${me?.raceTeam === team}">${me?.raceTeam === team ? 'Mon équipe ✓' : 'Rejoindre cette équipe'}</button></div>`).join('') + '</div>' : '<p class="race-setup-note">Une case gagnée ne peut plus être reprise. Les scores sont attribués par le serveur.</p>'}`;
}
function dexRaceLayout(width, height, count) {
  let best = {columns:1,rows:count,size:0};
  for (let c = 1; c <= count; c++) {
    const rows = Math.ceil(count/c), size = Math.floor(Math.min((width-(c-1)*3)/c,(height-(rows-1)*3)/rows));
    if (size > best.size) best = {columns:c,rows,size};
  }
  return best;
}
function fitDexRaceBoard() {
  const board = document.getElementById('dex-race-board'), viewport = document.getElementById('dex-race-board-wrap');
  if (!board || !viewport || !board.children.length) return;
  const fit = dexRaceLayout(viewport.clientWidth, viewport.clientHeight, board.children.length);
  board.style.setProperty('--race-cell', Math.max(1, fit.size) + 'px');
  board.style.setProperty('--race-cols', fit.columns);
}
function dexRaceSideName(round, team) {
  return round.format === 'teams' ? 'Équipe ' + (team === 'blue' ? 'Azur' : 'Corail') : round.roster.find(p=>p.team===team)?.nickname || 'Joueur parti';
}
function renderDexRaceArena() {
  const room = partyRoomState.room, round = room?.round;
  let arena = document.getElementById('dex-race-arena');
  const key = room?.code + ':' + round?.roundSerial;
  const active = room?.gameMode === 'dexrace' && round && ['playing','complete'].includes(room.status) && !(room.status === 'complete' && dexRaceLobbyKey === key);
  if (!active) {
    arena?.classList.add('hidden'); document.body.classList.remove('race-active');
    if (dexRaceTimer) { clearInterval(dexRaceTimer); dexRaceTimer = null; }
    return false;
  }
  if (partyRoomState.timerInterval) { clearInterval(partyRoomState.timerInterval); partyRoomState.timerInterval = null; }
  if (!arena) { arena = document.createElement('section'); arena.id = 'dex-race-arena'; arena.setAttribute('aria-label','Course au Pokédex'); document.body.appendChild(arena); }
  arena.classList.remove('hidden'); document.body.classList.add('race-active');
  dexRaceClockOffset = Date.now() - round.serverNow;
  if (key !== dexRaceArenaKey) {
    dexRaceArenaKey = key; dexRacePending = false;
    arena.innerHTML = `<header class="race-header"><div class="race-brand"><span class="race-eyebrow">PARTY ROOM · GEN ${round.generation}</span><h2>Course au Pokédex<span>.</span></h2></div><div id="dex-race-scoreboard" class="race-scoreboard"></div><div class="race-clock-wrap"><span class="race-eyebrow">TEMPS RESTANT</span><b id="dex-race-clock">—</b></div><button type="button" class="btn-ghost race-exit" data-action="confirmLeaveDexRace">Quitter</button></header><div class="race-board-panel"><div class="race-board-caption"><span id="dex-race-progress"></span><span id="dex-race-cell-info">Chaque Pokémon ne compte qu’une fois.</span></div><div id="dex-race-board-wrap"><div id="dex-race-board" role="group" aria-label="Grille commune"></div></div></div><footer class="race-footer"><form id="dex-race-form" class="race-form"><label for="dex-race-input">À toi de prendre une case<span>Noms français · Entrée pour valider</span></label><input id="dex-race-input" type="text" maxlength="100" placeholder="Nom du Pokémon…" autocomplete="off" spellcheck="false" autocorrect="off" /><button id="dex-race-submit" class="btn-blue" type="submit">Valider →</button></form><div id="dex-race-result" class="race-result hidden"></div><p id="dex-race-message" role="status" aria-live="polite"></p></footer>`;
    const board = document.getElementById('dex-race-board');
    for (const id of round.ids) {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'race-cell'; cell.dataset.id = id; cell.id = 'race-cell-' + id;
      cell.innerHTML = `<span>${String(id).padStart(3,'0')}</span>`; cell.setAttribute('aria-label',`N° ${id} · À trouver`);
      cell.addEventListener('click', () => { document.getElementById('dex-race-cell-info').textContent = cell.getAttribute('aria-label'); });
      board.appendChild(cell);
    }
    document.getElementById('dex-race-form').addEventListener('submit', event => { event.preventDefault(); submitDexRaceAnswer(); });
    dexRaceObserver?.disconnect(); dexRaceObserver = new ResizeObserver(fitDexRaceBoard); dexRaceObserver.observe(document.getElementById('dex-race-board-wrap'));
    document.getElementById('dex-race-input').focus({preventScroll:true});
  }
  const me = round.roster.find(p=>p.id===multiplayerSocket?.id), ended = room.status === 'complete';
  document.getElementById('dex-race-scoreboard').innerHTML = ['blue','coral'].map(team=>`<div class="race-side race-${team} ${me?.team===team?'is-mine':''}"><div><strong>${escapeHtml(dexRaceSideName(round,team))}${me?.team===team?' · Toi':''}</strong><small>${round.roster.filter(p=>p.team===team).map(p=>`${escapeHtml(p.nickname)} ${p.score}${p.connected?'':' (parti)'}`).join(' · ')}</small></div><b>${round.scores[team]}</b></div>`).join('');
  document.getElementById('dex-race-progress').textContent = `${round.claims.length} / ${round.ids.length} Pokémon inscrits · ${Math.round(round.claims.length / round.ids.length * 100)} %`;
  for (const claim of round.claims) {
    const cell = document.getElementById('race-cell-' + claim.id);
    if (!cell || cell.dataset.claimed) continue;
    cell.dataset.claimed = 'true'; cell.classList.add('is-claimed','race-' + claim.team);
    cell.innerHTML = `<img src="${getSpriteUrl(claim.id)}" alt="" /><span class="race-owner-mark" aria-hidden="true">${claim.team === 'blue'?'A':'C'}</span>`;
    const label = `${claim.name} · ${claim.nickname} · ${claim.team === 'blue'?'Azur':'Corail'}`;
    cell.title = label; cell.setAttribute('aria-label',label);
  }
  const connected = Boolean(multiplayerSocket?.connected && me);
  document.getElementById('dex-race-form').classList.toggle('hidden',ended);
  document.getElementById('dex-race-input').disabled = ended || !connected;
  document.getElementById('dex-race-submit').disabled = ended || !connected || dexRacePending;
  const result = document.getElementById('dex-race-result'); result.classList.toggle('hidden',!ended);
  if (ended) {
    const tie = round.scores.blue === round.scores.coral, winner = round.scores.blue > round.scores.coral ? 'blue' : 'coral';
    result.innerHTML = `<div><span class="race-eyebrow">${round.endedReason === 'full'?'GRILLE COMPLÈTE':round.endedReason === 'departure'?'PARTIE INTERROMPUE':'TEMPS ÉCOULÉ'}</span><h3>${round.endedReason === 'departure'?'Un camp a quitté la course':tie?'Égalité !':escapeHtml(dexRaceSideName(round,winner)) + ' remporte la course !'}</h3><p>${round.scores.blue} – ${round.scores.coral} · ${me ? 'Ta contribution : ' + me.score + ' Pokémon.' : ''} Les cases gardent le nom de leur auteur.</p></div><button type="button" class="btn-blue" data-action="returnFromDexRace">Retour au salon →</button>`;
    if (dexRaceTimer) { clearInterval(dexRaceTimer); dexRaceTimer = null; }
  } else if (!dexRaceTimer) dexRaceTimer = setInterval(updateDexRaceClock,200);
  updateDexRaceClock(); fitDexRaceBoard(); return true;
}
function updateDexRaceClock() {
  const room = partyRoomState.room, clock = document.getElementById('dex-race-clock');
  if (!clock || room?.gameMode !== 'dexrace') return;
  const remaining = room.status === 'playing' ? Math.max(0,Math.ceil((room.deadlineAt - (Date.now()-dexRaceClockOffset))/1000)) : 0;
  clock.textContent = Math.floor(remaining/60) + ':' + String(remaining%60).padStart(2,'0');
  clock.classList.toggle('is-urgent',remaining<=15 && room.status==='playing');
  if (room.status==='playing' && !multiplayerSocket?.connected) {
    document.getElementById('dex-race-input').disabled = true;
    document.getElementById('dex-race-submit').disabled = true;
    document.getElementById('dex-race-message').textContent = 'Connexion interrompue. Quitte la course pour rejoindre un nouveau salon.';
  }
}
function submitDexRaceAnswer() {
  const room = partyRoomState.room, socket = ensureMultiplayerSocket(), input = document.getElementById('dex-race-input'), message = document.getElementById('dex-race-message');
  const guess = input.value.trim();
  if (!guess || dexRacePending || !socket?.connected || room?.status !== 'playing') return;
  dexRacePending = true; document.getElementById('dex-race-submit').disabled = true;
  socket.timeout(10000).emit('party:submit-answer',{code:room.code,roundSerial:room.round.roundSerial,guess},(error,res)=>{
    dexRacePending = false;
    const current = partyRoomState.room;
    if (current?.code !== room.code || current?.round?.roundSerial !== room.round.roundSerial) return;
    if (res?.room && (res.room.round?.claims?.length || 0) >= (current.round.claims?.length || 0)) partyRoomState.room = res.room;
    renderPartyRoom();
    message.textContent = error ? 'Connexion lente : vérifie la grille avant de réessayer.' : !res?.ok ? res?.error || 'Proposition refusée.' : res.duplicate ? `${res.name} est déjà inscrit !` : `${res.name} inscrit · +1 point !`;
    if (res?.ok && input.value.trim() === guess) input.value = '';
    if (!input.disabled) input.focus({preventScroll:true});
  });
}
function returnFromDexRace() {
  dexRaceLobbyKey = partyRoomState.room?.code + ':' + partyRoomState.room?.round?.roundSerial;
  renderPartyRoom();
}
function confirmLeaveDexRace() {
  if (partyRoomState.room?.status !== 'playing') { leaveDexRace(); return; }
  ensureOverlay('Quitter la course ?', '<p>Tes cases et tes points restent attribués. Si ton camp n’a plus de joueur, la course est interrompue.</p><div class="account-menu"><button type="button" class="btn-blue" data-action="closeOverlayModal">Continuer à jouer</button><button type="button" class="btn-ghost" data-action="leaveDexRace">Quitter la course</button></div>');
}
function leaveDexRace() { closeOverlayModal(); partyLeaveRoom(); openPartyRoomMode(); }
