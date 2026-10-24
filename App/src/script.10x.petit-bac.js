// Petit Bac Pokémon : une lettre, des thèmes en colonnes, une réponse par thème qui
// commence par la lettre. En solo contre le chrono, le serveur tire et corrige la
// feuille. Dans la Party Room, l'hôte choisit les thèmes et la durée ; chacun remplit
// sa feuille en privé, le premier qui a tout rempli crie STOP, puis tout le monde
// vérifie les réponses (justes d'office, la majorité peut en refuser) avant les points.
let petitBacState = null, petitBacClock = null;
const PETITBAC_REASONS = { empty: 'Case vide', letter: 'Mauvaise lettre', unknown: 'Pokémon inconnu', form: 'Cette forme ne compte pas (Méga ou spéciale)', criterion: 'Ne coche pas le thème', vote: 'Refusé au vote' };

function petitBacNormalize(text) { return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function petitBacInitial(text) { return petitBacNormalize(text).charAt(0).toUpperCase(); }
function petitBacNames(letter) {
  return getPokemonUiList({ includeAltForms: false }).filter(p => p.id >= 1 && p.id <= 1025 && petitBacInitial(p.name) === letter).map(p => p.name).sort((a, b) => a.localeCompare(b, 'fr'));
}
function petitBacColumnHtml(c) {
  const free = c.family === 'free';
  return '<span class="bac-col' + (free ? ' is-free' : '') + '"><b>' + escapeHtml(c.label) + '</b>' + (c.hint ? '<small>' + escapeHtml(c.hint) + '</small>' : '') + '</span>';
}
function petitBacPokemonName(id) { return POKEMON_BY_ID.get(Number(id))?.name || ''; }
// No list pops up while typing: the answer is the player's own; Enter moves to the next column.
function petitBacInputHtml(attr, index, letter, value) {
  return '<input ' + attr + '="' + index + '" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="next" placeholder="' + letter + '…" value="' + escapeHtml(value || '') + '">';
}
function petitBacNextOnEnter(input) {
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const inputs = [...input.form.querySelectorAll('input')], next = inputs[inputs.indexOf(input) + 1];
    if (next) next.focus(); else input.blur();
  });
}
function petitBacAnswerText(r) {
  return r?.text ? escapeHtml(r.text) + (r.name ? ' <small class="bac-fixed">→ ' + escapeHtml(r.name) + '</small>' : '') : '—';
}

/* ---------- Solo contre le chrono ---------- */
if (typeof DEDICATED_SHELLS !== 'undefined') DEDICATED_SHELLS['screen-petit-bac'] = { label: 'Petit Bac', mode: 'petitbac', help: 'Une lettre est tirée. Pour chaque thème, trouve un Pokémon qui commence par cette lettre et qui coche le thème (type, région, couleur…). 75 secondes, une réponse juste = 1 point. Les petites fautes d’orthographe sont pardonnées.', state: () => petitBacState };
function ensurePetitBacScreen() {
  if (document.getElementById('screen-petit-bac')) return;
  const screen = document.createElement('div');
  screen.id = 'screen-petit-bac'; screen.className = 'hidden';
  screen.innerHTML = '<div class="card petitbac-card gameplay-screen-card"><div class="ranking-head"><h2 class="card-title">Petit Bac Pokémon</h2></div><div id="petitbac-root"></div></div>';
  document.getElementById('screen-game').parentElement.appendChild(screen);
}
function openPetitBacMode() {
  if (typeof trackUsage === 'function') trackUsage('solo:petitbac');
  if (typeof hideCustomModeSurfaces === 'function') hideCustomModeSurfaces();
  ensurePetitBacScreen();
  showScreen('screen-petit-bac');
  if (typeof setGlobalNavActive === 'function') setGlobalNavActive('game');
  if (!petitBacState || petitBacState.phase === 'loading') petitBacState = { phase: 'ready', recent: petitBacState?.recent || [] };
  renderPetitBac();
  if (petitBacSoloPrefs().mode === 'custom' && !petitBacThemeList) setPetitBacSoloMode('custom');
}
function petitBacRemaining() { return Math.max(0, Math.ceil(((petitBacState?.deadline || 0) - Date.now()) / 1000)); }
function petitBacTick() {
  const s = petitBacState, node = document.getElementById('petitbac-clock');
  if (!s || s.phase !== 'playing') { clearInterval(petitBacClock); petitBacClock = null; return; }
  const left = petitBacRemaining();
  if (node) { node.textContent = left + ' s'; node.classList.toggle('is-urgent', left <= 10); }
  if (left <= 0) submitPetitBac();
}
function renderPetitBac() {
  const root = document.getElementById('petitbac-root'), s = petitBacState;
  if (!root || !s) return;
  const best = Number(playerProfile?.petitBacBest) || 0;
  if (s.phase === 'ready' || s.phase === 'loading') {
    const custom = petitBacSoloPrefs().mode === 'custom';
    root.innerHTML = '<div class="bac-intro"><span class="bac-letter is-big" aria-hidden="true">?</span><p>Une lettre est tirée au sort. Pour chaque thème, trouve un Pokémon qui <b>commence par cette lettre</b> et qui coche le thème : un type, une région, une couleur…</p>' +
      '<p class="bac-rules">' + (custom ? petitBacSoloPrefs().themes.length + ' thèmes à ton choix' : '6 thèmes au hasard') + ' · 1 point par bonne réponse · petites fautes pardonnées' + (best ? ' · Ton record : ' + best + ' bonne' + (best > 1 ? 's' : '') + ' réponse' + (best > 1 ? 's' : '') : '') + '</p>' +
      '<div class="bac-setup-options bac-solo-mode" role="group" aria-label="Thèmes"><button type="button" class="party-mode-btn' + (custom ? '' : ' is-active') + '" aria-pressed="' + !custom + '" data-action="setPetitBacSoloMode" data-args=\'["random"]\'>Thèmes au hasard</button><button type="button" class="party-mode-btn' + (custom ? ' is-active' : '') + '" aria-pressed="' + custom + '" data-action="setPetitBacSoloMode" data-args=\'["custom"]\'>Je choisis mes thèmes</button></div>' +
      (custom ? '<div id="petitbac-solo-themes" class="petit-bac-setup bac-solo-themes">' + petitBacSoloThemesHtml() + '</div>' : '') +
      (s.error ? '<p class="bac-error" role="alert">' + escapeHtml(s.error) + '</p>' : '') +
      '<button class="btn-blue" type="button" data-action="startPetitBacRound"' + (s.phase === 'loading' ? ' disabled' : '') + '>' + (s.phase === 'loading' ? 'Tirage…' : 'Tirer une lettre →') + '</button></div>';
  } else if (s.phase === 'playing' || s.phase === 'checking') {
    // The sheet is drawn once per letter: typing never loses a character to a redraw.
    if (root.dataset.sheet !== s.letter + ':' + s.drawnAt) {
      root.dataset.sheet = s.letter + ':' + s.drawnAt;
      root.innerHTML = '<div class="bac-head"><span class="bac-letter is-big" aria-label="Lettre ' + s.letter + '">' + s.letter + '</span><div><b>Lettre ' + s.letter + '</b><p>Un Pokémon qui commence par ' + s.letter + ' pour chaque thème.</p></div><span id="petitbac-clock" class="bac-clock" aria-label="Temps restant">' + petitBacRemaining() + ' s</span></div>' +
        '<form id="petitbac-sheet" class="bac-sheet" autocomplete="off" data-submit-action="submitPetitBac">' +
        s.categories.map((c, i) => '<label class="bac-row">' + petitBacColumnHtml(c) + petitBacInputHtml('data-petitbac-index', i, s.letter, s.answers[i]) + '</label>').join('') +
        '<button class="btn-blue bac-submit" type="submit">J’ai fini !</button></form>';
      root.querySelectorAll('[data-petitbac-index]').forEach(input => { petitBacNextOnEnter(input); input.addEventListener('input', () => { s.answers[Number(input.dataset.petitbacIndex)] = input.value; }); });
    }
    const submit = root.querySelector('.bac-submit');
    if (submit) { submit.disabled = s.phase === 'checking'; submit.textContent = s.phase === 'checking' ? 'Correction…' : 'J’ai fini !'; }
    root.querySelectorAll('[data-petitbac-index]').forEach(input => { input.disabled = s.phase === 'checking'; });
    if (s.error) { let error = root.querySelector('.bac-error'); if (!error) { error = document.createElement('p'); error.className = 'bac-error'; error.setAttribute('role', 'alert'); root.appendChild(error); } error.innerHTML = escapeHtml(s.error) + ' <button class="btn-ghost" type="button" data-action="submitPetitBac">Réessayer</button>'; }
  } else if (s.phase === 'finished') {
    delete root.dataset.sheet;
    root.innerHTML = '<div class="bac-head"><span class="bac-letter is-big" aria-hidden="true">' + s.letter + '</span><div><b>' + s.score + ' / ' + s.categories.length + ' bonnes réponses</b><p>' + (s.newRecord ? 'Nouveau record !' : best ? 'Ton record : ' + best + ' bonne' + (best > 1 ? 's' : '') + ' réponse' + (best > 1 ? 's' : '') : 'Retente ta chance avec une nouvelle lettre.') + ' · ' + Math.round(s.elapsedMs / 1000) + ' s</p></div></div>' +
      '<ul class="bac-review">' + s.categories.map((c, i) => {
        const r = s.results[i] || {}, examples = (s.examples[i] || []).map(petitBacPokemonName).filter(Boolean);
        return '<li class="' + (r.valid ? 'is-valid' : 'is-wrong') + '">' + petitBacColumnHtml(c) + '<span class="bac-answer"><b>' + petitBacAnswerText(r) + '</b>' + (r.valid ? '<i>+1</i>' : '<small>' + (PETITBAC_REASONS[r.reason] || '') + '</small>') + '</span>' +
          (!r.valid && examples.length ? '<small class="bac-examples">Par exemple : ' + examples.map(escapeHtml).join(', ') + '</small>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<div class="bac-actions"><button class="btn-blue" type="button" data-action="startPetitBacRound">Nouvelle lettre →</button></div>';
  }
  if (typeof prepareDedicatedShell === 'function') prepareDedicatedShell('screen-petit-bac');
}
async function startPetitBacRound() {
  const recent = petitBacState?.recent || [];
  petitBacState = { phase: 'loading', recent };
  renderPetitBac();
  try {
    const prefs = petitBacSoloPrefs(), themes = prefs.mode === 'custom' ? '&themes=' + encodeURIComponent(prefs.themes.join(',')) : '';
    const response = await fetch('/api/petitbac/solo?exclude=' + encodeURIComponent(recent.join('')) + themes, { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'unavailable');
    petitBacState = { phase: 'playing', letter: data.letter, categories: data.categories, answers: data.categories.map(() => ''), drawnAt: Date.now(), deadline: Date.now() + data.seconds * 1000, recent: recent.concat(data.letter).slice(-10) };
    renderPetitBac();
    document.querySelector('#petitbac-sheet input')?.focus({ preventScroll: true });
    clearInterval(petitBacClock); petitBacClock = setInterval(petitBacTick, 250);
  } catch (_e) {
    petitBacState = { phase: 'ready', recent, error: petitBacSoloPrefs().mode === 'custom' ? 'Aucune lettre ne marche avec tous ces thèmes, ou le serveur ne répond pas : change un thème ou réessaie.' : 'Tirage impossible pour le moment. Réessaie dans un instant.' };
    renderPetitBac();
  }
}
async function submitPetitBac(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  const s = petitBacState;
  if (!s || (s.phase !== 'playing' && !(s.phase === 'checking' && s.error))) return;
  clearInterval(petitBacClock); petitBacClock = null;
  s.phase = 'checking'; s.error = ''; s.elapsedMs = s.elapsedMs || Math.min(Date.now() - s.drawnAt, s.deadline - s.drawnAt);
  renderPetitBac();
  try {
    const response = await fetch('/api/petitbac/solo/check', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ letter: s.letter, keys: s.categories.map(c => c.key), answers: s.answers }) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'unavailable');
    s.results = data.results; s.examples = data.examples; s.score = data.results.filter(r => r.valid).length; s.phase = 'finished';
    const best = Number(playerProfile?.petitBacBest) || 0;
    s.newRecord = s.score > best;
    if (s.newRecord && typeof playerProfile !== 'undefined' && playerProfile) { playerProfile.petitBacBest = s.score; try { saveProfile(); } catch (_e) {} }
    if (s.score && typeof awardXp === 'function') awardXp(s.score * 5, 'Petit Bac');
    if (typeof recordMatchHistory === 'function') recordMatchHistory({ mode: 'petitbac', result: s.score >= 4 ? 'win' : 'loss', attempts: s.score, targetName: null });
    renderPetitBac();
    if (typeof gameFeelReplay === 'function') gameFeelReplay(document.querySelector('#petitbac-root .bac-review'), 'is-new');
  } catch (_e) {
    s.error = 'Correction impossible pour le moment. Tes réponses sont gardées.';
    renderPetitBac();
  }
}

// The solo player's own themes, kept on this device only.
let petitBacThemeList = null;
const PETITBAC_SOLO_DEFAULT = ['type:Feu', 'type:Eau', 'type:Plante', 'gen:1', 'special:legendary', 'stage:3'];
function petitBacSoloPrefs() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('pokedle_petitbac_solo') || 'null'); } catch (_e) { saved = null; }
  const themes = Array.isArray(saved?.themes) && saved.themes.length >= 3 && saved.themes.length <= 8 ? saved.themes.map(String) : PETITBAC_SOLO_DEFAULT;
  return { mode: saved?.mode === 'custom' ? 'custom' : 'random', themes };
}
function savePetitBacSoloPrefs(prefs) { try { localStorage.setItem('pokedle_petitbac_solo', JSON.stringify(prefs)); } catch (_e) {} }
function petitBacSoloThemesHtml() {
  if (!petitBacThemeList) return '<p class="bac-watch">Chargement des thèmes…</p>';
  const prefs = petitBacSoloPrefs(), chosen = new Set(prefs.themes), list = petitBacThemeList;
  const chip = c => { const on = chosen.has(c.key), locked = (!on && chosen.size >= list.max) || (on && chosen.size <= list.min); return '<button type="button" class="bac-theme' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-action="togglePetitBacSoloTheme" data-args=\'' + escapeHtml(JSON.stringify([c.key])) + '\'' + (locked ? ' disabled' : '') + '>' + escapeHtml(c.label.replace(/^Type /, '').replace(/^Couleur : /, '')) + '</button>'; };
  return '<span class="party-mode-label">Thèmes · ' + chosen.size + ' / ' + list.max + '</span>' + list.groups.map(([group, label]) => {
    const items = list.themes.filter(c => c.group === group);
    return '<details class="bac-theme-group"' + (items.some(c => chosen.has(c.key)) ? ' open' : '') + '><summary>' + escapeHtml(label) + ' <small>' + items.filter(c => chosen.has(c.key)).length + '</small></summary><div class="bac-theme-list">' + items.map(chip).join('') + '</div></details>';
  }).join('');
}
async function setPetitBacSoloMode(mode) {
  savePetitBacSoloPrefs({ ...petitBacSoloPrefs(), mode: mode === 'custom' ? 'custom' : 'random' });
  renderPetitBac();
  if (mode === 'custom' && !petitBacThemeList) {
    try { const response = await fetch('/api/petitbac/themes', { credentials: 'same-origin' }), data = await response.json(); if (response.ok && data.ok) petitBacThemeList = data; } catch (_e) {}
    renderPetitBac();
  }
}
function togglePetitBacSoloTheme(key) {
  const prefs = petitBacSoloPrefs(), themes = prefs.themes.slice(), at = themes.indexOf(key);
  if (at >= 0) themes.splice(at, 1); else themes.push(key);
  if (themes.length < 3 || themes.length > 8) return;
  savePetitBacSoloPrefs({ mode: 'custom', themes });
  renderPetitBac();
}

/* ---------- Party Room ---------- */
let partyBacKey = '', partyBacSaveTimer = null, partyBacSaving = false, partyBacDirty = false, partyBacBusy = false;
function partyBacRoom() {
  const room = partyRoomState?.room;
  return room && room.gameMode === 'petitbac' && room.status === 'playing' && room.round?.mode === 'petitbac' ? room : null;
}
function partyBacName(room, id) { return (room.players || []).find(p => p.id === id)?.nickname || 'Un joueur'; }
function partyBacEmit(payload, done) {
  const room = partyBacRoom(), socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!room || !socket) { if (typeof done === 'function') done({ ok: false }); return; }
  socket.emit('party:submit-answer', { code: room.code, roundSerial: room.round.roundSerial, ...payload }, res => {
    res = res || {};
    if (res.room) partyRoomState.room = res.room;
    if (typeof done === 'function') done(res);
    renderPartyRoom();
  });
}
function partyBacAnswers() { return [...document.querySelectorAll('#party-bac-sheet [data-bac-index]')].map(input => input.value); }
// The sheet is saved as a whole, a moment after typing stops, and before STOP.
function partyBacFlush(done) {
  clearTimeout(partyBacSaveTimer); partyBacSaveTimer = null;
  if (partyBacSaving) { partyBacDirty = true; if (typeof done === 'function') setTimeout(() => partyBacFlush(done), 150); return; }
  if (!partyBacDirty) { if (typeof done === 'function') done({ ok: true }); return; }
  partyBacDirty = false; partyBacSaving = true;
  partyBacEmit({ bacAction: 'write', answers: partyBacAnswers() }, res => {
    partyBacSaving = false;
    if (!res.ok && res.error && typeof setPartyStatus === 'function') setPartyStatus(res.error);
    if (partyBacDirty) partyBacSchedule();
    if (typeof done === 'function') done(res);
  });
}
function partyBacSchedule() { clearTimeout(partyBacSaveTimer); partyBacSaveTimer = setTimeout(() => partyBacFlush(), 700); }
function partyBacStop() {
  if (partyBacBusy) return;
  partyBacBusy = true;
  partyBacDirty = true;
  partyBacFlush(() => partyBacEmit({ bacAction: 'stop' }, res => {
    partyBacBusy = false;
    if (!res.ok && res.error && typeof setPartyStatus === 'function') setPartyStatus(res.error);
  }));
}
function partyBacVote(author, index, valid) { partyBacEmit({ bacAction: 'vote', author, index: Number(index), valid: Boolean(valid) }, res => { if (!res.ok && res.error && typeof setPartyStatus === 'function') setPartyStatus(res.error); }); }
function partyBacDoneVote() { partyBacEmit({ bacAction: 'done-vote' }); }
function partyBacTimeLabel(seconds) { return seconds === 60 ? '1 min' : seconds === 300 ? '5 min' : 'Illimité'; }
function partyBacSheetHtml(room, round) {
  const mine = round.mine;
  const head = '<div class="bac-head"><span class="bac-letter is-big" aria-label="Lettre ' + round.letter + '">' + round.letter + '</span><div><b>Lettre ' + round.letter + '</b><p id="party-bac-banner"></p></div></div>';
  if (!mine) return head + '<p class="bac-watch">Tu regardes cette manche : tu joueras à la suivante.</p>';
  return head + '<form id="party-bac-sheet" class="bac-sheet" autocomplete="off">' +
    round.categories.map((c, i) => '<label class="bac-row">' + petitBacColumnHtml(c) + petitBacInputHtml('data-bac-index', i, round.letter, mine[i]) + '</label>').join('') +
    '</form><div class="bac-actions"><button type="button" class="btn-blue bac-stop" id="party-bac-stop" data-action="partyBacStop">STOP !</button></div>';
}
// The review: every answer is right by default unless Pokédle knows it is wrong; a tap votes the other way.
function partyBacBallotHtml(room, round) {
  const ballot = round.ballot || [];
  return round.categories.map((c, i) => {
    const entries = ballot.filter(e => e.index === i);
    if (!entries.length) return '';
    return '<section class="bac-ballot-group"><h4>' + escapeHtml(c.label) + '</h4><ul>' + entries.map(e => {
      const who = e.own ? 'Toi' : escapeHtml(partyBacName(room, e.author));
      const status = '<b class="bac-status ' + (e.valid ? 'is-valid' : 'is-wrong') + '">' + (e.valid ? '✓ Juste' : '✗ ' + escapeHtml(PETITBAC_REASONS[e.reason] || 'Refusé')) + '</b>';
      const votedAgainst = e.myVote !== e.suggested;
      const button = e.own ? '<small>ta réponse</small>' : '<button type="button" class="bac-vote' + (votedAgainst ? ' is-pressed' : '') + '" data-action="partyBacVote" data-args=\'' + escapeHtml(JSON.stringify([e.author, i, votedAgainst ? e.suggested : !e.suggested])) + '\' aria-pressed="' + votedAgainst + '">' + (e.suggested ? (votedAgainst ? 'Tu as dit non' : 'Pas juste ?') : (votedAgainst ? 'Tu as dit oui' : 'C’est juste ?')) + '</button>';
      return '<li class="' + (e.valid ? '' : 'is-rejected') + '"><span class="bac-ballot-answer">' + who + ' : <b>' + escapeHtml(e.text) + '</b>' + (e.name ? ' <small class="bac-fixed">→ ' + escapeHtml(e.name) + '</small>' : '') + (e.against ? ' <small class="bac-against">' + e.against + ' vote' + (e.against > 1 ? 's' : '') + ' contre</small>' : '') + '</span><span class="bac-ballot-side">' + status + button + '</span></li>';
    }).join('') + '</ul></section>';
  }).join('') || '<p class="bac-watch">Aucune réponse à vérifier.</p>';
}
function partyBacResultsHtml(room, round) {
  const rows = round.results || [], cats = round.categories;
  const cell = r => {
    const pts = Number(r?.points) || 0, cls = pts === 2 ? 'is-2' : pts === 1 ? 'is-1' : 'is-0';
    return '<td class="' + cls + '"><span>' + petitBacAnswerText(r) + '</span><b>' + (pts ? '+' + pts + (r.accepted ? ' · accepté au vote' : '') : (r?.text ? escapeHtml(PETITBAC_REASONS[r.reason] || '0') : '0')) + '</b></td>';
  };
  const examples = (round.examples || []).map(list => (list || []).map(petitBacPokemonName).filter(Boolean));
  return partyBacRecapHtml(round.recap) + '<div class="bac-head"><span class="bac-letter is-big" aria-hidden="true">' + round.letter + '</span><div><b>Résultats · lettre ' + round.letter + '</b><p>2 points pour une réponse que personne d’autre n’a donnée, 1 point si elle est partagée.</p></div></div>' +
    '<div class="bac-results-wrap"><table class="bac-results"><thead><tr><th scope="col">Joueur</th>' + cats.map(c => '<th scope="col">' + escapeHtml(c.label) + '</th>').join('') + '<th scope="col">Manche</th></tr></thead><tbody>' +
    rows.map(row => '<tr><th scope="row">' + escapeHtml(row.nickname) + '</th>' + cats.map((_c, i) => cell(row.answers[i])).join('') + '<td class="bac-total">+' + row.gained + '</td></tr>').join('') +
    '</tbody><tfoot><tr><th scope="row">Exemples</th>' + cats.map((c, i) => '<td>' + (c.family === 'free' ? '—' : examples[i]?.map(escapeHtml).join(', ') || '—') + '</td>').join('') + '<td></td></tr></tfoot></table></div>';
}
// End of the game: three titles and everyone's totals over all the letters.
function partyBacRecapHtml(recap) {
  if (!recap) return '';
  const titles = recap.titles.map(t => '<li class="bac-title is-' + t.key + '"><span>' + escapeHtml(t.label) + '</span><b>' + t.players.map(escapeHtml).join(' & ') + '</b><small>' + t.value + ' ' + escapeHtml(t.unit) + '</small></li>').join('');
  const rows = recap.rows.map(r => '<tr><th scope="row">' + escapeHtml(r.nickname) + '</th><td>' + r.points + '</td><td>' + r.unique + '</td><td>' + r.shared + '</td><td>' + r.refused + '</td><td>' + r.stops + '</td></tr>').join('');
  return '<section class="bac-recap" aria-label="Récapitulatif de la partie"><h3>Récap de la partie</h3><ul class="bac-titles">' + titles + '</ul>' +
    '<div class="bac-results-wrap"><table class="bac-results bac-recap-table"><thead><tr><th scope="col">Joueur</th><th scope="col">Points</th><th scope="col">Uniques</th><th scope="col">Partagées</th><th scope="col">Refusées</th><th scope="col">STOP</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}
function renderPartyPetitBac(room, me, enabled, playing) {
  const panel = document.getElementById('party-petitbac');
  if (!panel) return;
  const round = room.round;
  panel.classList.toggle('hidden', !enabled);
  if (!enabled || !round) { if (panel.innerHTML) { panel.innerHTML = ''; partyBacKey = ''; } return; }
  const sheet = round.phase === 'write' || round.phase === 'stopping';
  panel.classList.toggle('is-stopping', round.phase === 'stopping' && playing);
  const key = room.code + ':' + round.roundSerial + ':' + (sheet ? 'sheet' : round.phase);
  if (key !== partyBacKey) {
    partyBacKey = key; partyBacDirty = false; clearTimeout(partyBacSaveTimer);
    if (sheet) {
      panel.innerHTML = partyBacSheetHtml(room, round);
      panel.querySelectorAll('[data-bac-index]').forEach(input => {
        petitBacNextOnEnter(input);
        input.addEventListener('input', () => { partyBacDirty = true; partyBacSchedule(); partyBacSyncStop(); });
        input.addEventListener('blur', () => { if (partyBacDirty) partyBacFlush(); });
      });
    } else if (round.phase === 'review') {
      panel.innerHTML = '<div class="bac-head"><span class="bac-letter is-big" aria-hidden="true">' + round.letter + '</span><div><b>On vérifie !</b><p>Tout est juste d’office, sauf ce que Pokédle sait faux. Une réponse ne va pas ? Appuie dessus pour voter : la majorité l’emporte.</p></div></div><div id="party-bac-ballot" class="bac-ballot"></div><div class="bac-actions"><button type="button" class="btn-blue" id="party-bac-done" data-action="partyBacDoneVote">J’ai fini de vérifier</button></div><p id="party-bac-voters" class="bac-watch"></p>';
    } else {
      panel.innerHTML = partyBacResultsHtml(room, round);
    }
  }
  if (sheet) {
    const banner = document.getElementById('party-bac-banner');
    if (banner) banner.textContent = round.phase === 'stopping' ? 'STOP ! ' + (round.stopBy === me?.id ? 'Tu as tout rempli' : partyBacName(room, round.stopBy) + ' a tout rempli') + ' : dernières secondes !' : 'Une réponse qui commence par ' + round.letter + ' pour chaque thème · ' + partyBacTimeLabel(round.time) + (round.time ? '' : ' : la manche finit au STOP');
    partyBacSyncStop();
  } else if (round.phase === 'review') {
    const ballot = document.getElementById('party-bac-ballot');
    if (ballot) ballot.innerHTML = partyBacBallotHtml(room, round);
    const mine = (round.progress || []).find(p => p.id === me?.id), done = (round.progress || []).filter(p => p.voted).length;
    const button = document.getElementById('party-bac-done');
    if (button) { button.disabled = !mine || mine.voted; button.textContent = mine?.voted ? 'C’est noté ✓' : 'J’ai fini de vérifier'; }
    const voters = document.getElementById('party-bac-voters');
    if (voters) voters.textContent = done + ' / ' + (round.progress || []).length + ' joueurs ont fini de vérifier.';
  }
}
function partyBacSyncStop() {
  const button = document.getElementById('party-bac-stop'), room = partyBacRoom();
  if (!button || !room) return;
  const full = partyBacAnswers().every(value => value.trim());
  button.disabled = !full || room.round.phase !== 'write' || partyBacBusy;
  button.textContent = room.round.phase === 'stopping' ? 'STOP lancé !' : full ? 'STOP !' : 'STOP ! (remplis tout)';
}
// Host settings: the round time and the themes, picked from every category of the game.
function renderPetitBacSetup(room, me, isHost) {
  const host = document.getElementById('party-setup');
  if (!host) return;
  let setup = document.getElementById('petit-bac-setup');
  if (!setup) { setup = document.createElement('section'); setup.id = 'petit-bac-setup'; setup.className = 'petit-bac-setup'; host.appendChild(setup); }
  const options = room.bacOptions, active = room.gameMode === 'petitbac' && Boolean(options?.catalog);
  setup.classList.toggle('hidden', !active);
  if (!active) return;
  const key = JSON.stringify([options.themes, options.time, options.rounds, options.hard, options.letters, isHost]);
  if (setup.dataset.key === key) return;
  setup.dataset.key = key;
  const chosen = new Set(options.themes), full = options.themes.length >= options.maxThemes;
  const timeButton = seconds => '<button type="button" class="party-mode-btn' + (options.time === seconds ? ' is-active' : '') + '" aria-pressed="' + (options.time === seconds) + '" data-action="partyBacSetTime" data-args="[' + seconds + ']"' + (isHost ? '' : ' disabled') + '>' + partyBacTimeLabel(seconds) + '</button>';
  const chip = c => {
    const on = chosen.has(c.key), locked = !isHost || (!on && full) || (on && options.themes.length <= options.minThemes);
    return '<button type="button" class="bac-theme' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-action="partyBacToggleTheme" data-args=\'' + escapeHtml(JSON.stringify([c.key])) + '\'' + (locked ? ' disabled' : '') + (c.hint ? ' title="' + escapeHtml(c.hint) + '"' : '') + '>' + escapeHtml(c.label.replace(/^Type /, '').replace(/^Couleur : /, '')) + '</button>';
  };
  const groups = options.groups.map(([group, label]) => {
    const items = options.catalog.filter(c => c.group === group);
    return '<details class="bac-theme-group"' + (items.some(c => chosen.has(c.key)) || group === 'pokemon' ? ' open' : '') + '><summary>' + escapeHtml(label) + ' <small>' + items.filter(c => chosen.has(c.key)).length + '</small></summary><div class="bac-theme-list">' + items.map(chip).join('') + '</div></details>';
  }).join('');
  const letters = options.letters;
  const choice = (action, value, label, active) => '<button type="button" class="party-mode-btn' + (active ? ' is-active' : '') + '" aria-pressed="' + active + '" data-action="' + action + '" data-args="[' + value + ']"' + (isHost ? '' : ' disabled') + '>' + label + '</button>';
  setup.innerHTML = '<span class="party-mode-label">Durée d’une manche</span><div class="bac-setup-options" role="group" aria-label="Durée d’une manche">' + timeButton(60) + timeButton(300) + timeButton(0) + '</div>' +
    '<span class="party-mode-label">Nombre de lettres</span><div class="bac-setup-options" role="group" aria-label="Nombre de lettres">' + [3, 5, 10].map(n => choice('partyBacSetRounds', n, n + ' lettres', options.rounds === n)).join('') + '</div>' +
    '<span class="party-mode-label">Lettres difficiles (Q, W, X, Y, Z)</span><div class="bac-setup-options" role="group" aria-label="Lettres difficiles">' + choice('partyBacSetHard', false, 'Retirées', !options.hard) + choice('partyBacSetHard', true, 'Gardées', options.hard) + '</div>' +
    '<div class="bac-theme-head"><span class="party-mode-label">Thèmes · ' + options.themes.length + ' / ' + options.maxThemes + '</span>' + (isHost ? '<button type="button" class="btn-ghost bac-random" data-action="partyBacRandomThemes">Au hasard</button>' : '') + '</div>' +
    '<p class="bac-chosen">' + options.themes.map(k => escapeHtml(options.catalog.find(c => c.key === k)?.label || k)).join(' · ') + '</p>' +
    groups +
    '<p class="bac-letters' + (letters < 3 ? ' is-low' : '') + '">' + (letters ? letters + ' lettre' + (letters > 1 ? 's' : '') + ' possible' + (letters > 1 ? 's' : '') + ' avec ces thèmes.' : 'Aucune lettre ne marche avec tous ces thèmes : retire-en un.') + ' Les petites fautes d’orthographe sont pardonnées.</p>';
}
function partyBacSendOptions(payload) {
  const socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!socket) return;
  socket.emit('party:petitbac-options', payload, res => {
    res = res || {};
    if (!res.ok && typeof setPartyStatus === 'function') setPartyStatus(res.error || 'Réglage impossible.');
    if (res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
  });
}
function partyBacSetTime(seconds) { partyBacSendOptions({ time: Number(seconds) }); }
function partyBacSetRounds(rounds) { partyBacSendOptions({ rounds: Number(rounds) }); }
function partyBacSetHard(hard) { partyBacSendOptions({ hard: hard === true }); }
function partyBacToggleTheme(key) {
  const themes = (partyRoomState?.room?.bacOptions?.themes || []).slice(), at = themes.indexOf(key);
  if (at >= 0) themes.splice(at, 1); else themes.push(key);
  partyBacSendOptions({ themes });
}
// The server draws a varied set that still leaves plenty of letters.
function partyBacRandomThemes() { partyBacSendOptions({ random: true }); }

/* ---------- Petit Bac du jour : même lettre et mêmes thèmes pour tous, un essai ---------- */
let dailyBacState = null, dailyBacBusy = false, dailyBacSerial = 0, dailyBacClock = null, dailyBacSaveTimer = null, dailyBacPeek = null;
function ensureDailyBacScreen() {
  if (document.getElementById('screen-petitbac-day')) return;
  const screen = document.createElement('section');
  screen.id = 'screen-petitbac-day'; screen.className = 'hidden grid-screen';
  screen.innerHTML = '<div class="challenge-toolbar"><button class="btn-ghost" data-action="goToConfig">← Accueil</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["petitbacday","today"]\'>Classement</button></div>' +
    '<article class="grid-card"><div class="grid-heading"><p class="challenge-kicker" id="bacday-day">BONUS DU JOUR</p><h1>Petit Bac du jour</h1><p class="grid-lead">La même lettre et les mêmes thèmes pour tout le monde. Un seul essai !</p></div><div id="bacday-root"></div><p id="bacday-message" class="grid-message" role="status" aria-live="polite"></p></article>';
  document.getElementById('screen-game').parentElement.appendChild(screen);
}
function dailyBacMessage(text) { const node = document.getElementById('bacday-message'); if (node) node.textContent = text; }
function dailyBacIsCurrent(s) { return Boolean(s && s.day === getDailyDateKey() && s.accountId === (dailyObservedAccountId() || null)); }
async function dailyBacRequest(action = '', payload = {}) {
  const serial = ++dailyBacSerial, accountId = dailyObservedAccountId() || null; dailyBacBusy = true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/daily/petitbac' + action, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...(action ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: dailyBacState?.day || getDailyDateKey(), accountId, ...payload }) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (serial !== dailyBacSerial) return null;
    if (!response.ok || !data.ok) throw Object.assign(new Error(data.error || 'unavailable'), { code: data.error || 'unavailable' });
    dailyBacState = { ...data, receivedAt: performance.now() }; return data;
  } catch (e) {
    if (serial !== dailyBacSerial) return null;
    const messages = { stale_daily: 'Un nouveau Petit Bac du jour est arrivé. On recharge…', account_changed: 'Ton compte a changé. On recharge…', rate_limited: 'Doucement ! Réessaie dans un instant.' };
    dailyBacMessage(messages[e.code] || 'Petit Bac du jour momentanément indisponible. Tes réponses sont gardées, réessaie.');
    if (e.code === 'stale_daily' || e.code === 'account_changed') setTimeout(openDailyPetitBac, 900);
    return null;
  } finally { clearTimeout(timer); if (serial === dailyBacSerial) dailyBacBusy = false; }
}
async function openDailyPetitBac() {
  ensureDailyBacScreen(); closeOverlayModal(); showScreen('screen-petitbac-day'); setGlobalNavActive('game');
  const root = document.getElementById('bacday-root');
  if (dailyBacIsCurrent(dailyBacState)) renderDailyPetitBac();
  else { dailyBacState = null; root.innerHTML = typeof skeletonHtml === 'function' ? skeletonHtml('Chargement du Petit Bac du jour', 'card') : ''; delete root.dataset.sheet; }
  dailyBacMessage('');
  if (await dailyBacRequest()) renderDailyPetitBac();
  else if (!dailyBacState) root.innerHTML = '<div class="bac-actions"><button class="btn-ghost" type="button" data-action="openDailyPetitBac">Réessayer</button></div>';
}
function dailyBacRemaining() { const s = dailyBacState; return s?.status === 'playing' ? Math.max(0, Math.ceil((s.remainingMs - (performance.now() - s.receivedAt)) / 1000)) : 0; }
function dailyBacTick() {
  const s = dailyBacState, node = document.getElementById('bacday-clock');
  if (!s || s.status !== 'playing') { clearInterval(dailyBacClock); dailyBacClock = null; return; }
  const left = dailyBacRemaining();
  if (node) { node.textContent = left + ' s'; node.classList.toggle('is-urgent', left <= 10); }
  if (left <= 0) submitDailyPetitBac();
}
function dailyBacAnswers() { return [...document.querySelectorAll('#bacday-sheet [data-bacday-index]')].map(input => input.value); }
function renderDailyPetitBac() {
  const s = dailyBacState, root = document.getElementById('bacday-root');
  if (!s || !root) return;
  document.getElementById('bacday-day').textContent = 'BONUS DU JOUR · JOUR #' + s.number;
  if (s.status === 'ready') {
    delete root.dataset.sheet;
    root.innerHTML = '<div class="bac-intro"><span class="bac-letter is-big" aria-hidden="true">?</span><p>Une lettre et ' + s.columns + ' thèmes Pokémon, les mêmes pour tout le monde aujourd’hui. Tu as <b>' + s.seconds + ' secondes</b> et <b>un seul essai</b> : le chrono démarre dès que tu commences.</p>' +
      '<p class="bac-rules">10 points par bonne réponse · 20 de bonus pour un sans-faute · petites fautes pardonnées' + (s.players ? ' · ' + s.players + ' joueur' + (s.players > 1 ? 's' : '') + ' aujourd’hui' : '') + '</p>' +
      '<button class="btn-blue" type="button" data-action="startDailyPetitBac">Commencer →</button></div>';
  } else if (s.status === 'playing') {
    if (root.dataset.sheet !== s.day + ':' + s.letter) {
      root.dataset.sheet = s.day + ':' + s.letter;
      root.innerHTML = '<div class="bac-head"><span class="bac-letter is-big" aria-label="Lettre ' + s.letter + '">' + s.letter + '</span><div><b>Lettre ' + s.letter + '</b><p>Un Pokémon qui commence par ' + s.letter + ' pour chaque thème.</p></div><span id="bacday-clock" class="bac-clock" aria-label="Temps restant">' + dailyBacRemaining() + ' s</span></div>' +
        '<form id="bacday-sheet" class="bac-sheet" autocomplete="off" data-submit-action="submitDailyPetitBac">' +
        s.categories.map((c, i) => '<label class="bac-row">' + petitBacColumnHtml(c) + petitBacInputHtml('data-bacday-index', i, s.letter, (s.answers || [])[i]) + '</label>').join('') +
        '<button class="btn-blue bac-submit" type="submit">J’ai fini !</button></form>';
      root.querySelectorAll('[data-bacday-index]').forEach(input => { petitBacNextOnEnter(input); input.addEventListener('input', () => { clearTimeout(dailyBacSaveTimer); dailyBacSaveTimer = setTimeout(saveDailyPetitBac, 1500); }); });
    }
    clearInterval(dailyBacClock); dailyBacClock = setInterval(dailyBacTick, 250);
  } else {
    delete root.dataset.sheet; clearInterval(dailyBacClock); dailyBacClock = null;
    const right = (s.results || []).filter(r => r.valid).length, original = s.originality != null && s.players >= 3;
    const rank = s.rank ? 'Tu es ' + (s.rank.rank === 1 ? '1er' : s.rank.rank + 'e') + ' sur ' + s.rank.total + ' aujourd’hui.' : s.authenticated ? 'Résultat enregistré au classement.' : 'Connecte-toi pour entrer au classement : ta feuille te suit.';
    root.innerHTML = '<div class="grid-result"><p class="challenge-kicker">' + (s.late ? 'FEUILLE ARRIVÉE TROP TARD' : 'PETIT BAC TERMINÉ') + '</p><h2>' + (right === s.columns ? 'Sans-faute !' : right >= 6 ? 'Très belle feuille !' : right >= 3 ? 'Pas mal du tout !' : 'Ce sera mieux demain !') + '</h2><div class="challenge-score"><strong>' + s.points + '</strong><span>/ ' + s.maxPoints + ' points</span></div>' +
      '<p class="grid-result-line">' + right + ' / ' + s.columns + ' bonnes réponses' + (original ? ' · originalité ' + s.originality + ' %' : '') + ' · ' + s.players + ' joueur' + (s.players > 1 ? 's' : '') + '</p><p>' + rank + '</p>' +
      '<div class="challenge-actions"><button type="button" class="btn-blue" data-action="shareDailyPetitBac">Partager</button><button type="button" class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["petitbacday","today"]\'>Classement</button><button type="button" class="btn-ghost" data-action="goToConfig">Accueil</button></div></div>' +
      '<div class="bac-head bac-day-letter"><span class="bac-letter" aria-hidden="true">' + s.letter + '</span><div><b>Lettre ' + s.letter + '</b><p>Le % indique la part des joueurs qui ont donné le même Pokémon.</p></div></div>' +
      '<ul class="bac-review">' + s.categories.map((c, i) => {
        const r = (s.results || [])[i] || {}, examples = (s.examples?.[i] || []).map(petitBacPokemonName).filter(Boolean);
        return '<li class="' + (r.valid ? 'is-valid' : 'is-wrong') + '">' + petitBacColumnHtml(c) + '<span class="bac-answer"><b>' + petitBacAnswerText(r) + '</b>' + (r.valid ? '<i>+10</i>' + (r.rarity ? '<small class="bac-rarity">' + r.rarity + ' %</small>' : '') : '<small>' + (s.late && r.text ? 'Trop tard' : PETITBAC_REASONS[r.reason] || '') + '</small>') + '</span>' +
          (!r.valid && examples.length ? '<small class="bac-examples">Par exemple : ' + examples.map(escapeHtml).join(', ') + '</small>' : '') + '</li>';
      }).join('') + '</ul>';
  }
}
async function startDailyPetitBac() {
  if (dailyBacBusy || dailyBacState?.status !== 'ready') return;
  if (await dailyBacRequest('/start')) { renderDailyPetitBac(); document.querySelector('#bacday-sheet input')?.focus({ preventScroll: true }); }
}
async function saveDailyPetitBac() {
  if (dailyBacBusy || dailyBacState?.status !== 'playing') return;
  try { await fetch('/api/daily/petitbac/save', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: dailyBacState.day, accountId: dailyObservedAccountId() || null, answers: dailyBacAnswers() }) }); } catch (_e) {}
}
async function submitDailyPetitBac(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (dailyBacBusy || dailyBacState?.status !== 'playing') return;
  clearTimeout(dailyBacSaveTimer); clearInterval(dailyBacClock); dailyBacClock = null;
  const answers = dailyBacAnswers(), submit = document.querySelector('#bacday-sheet .bac-submit');
  if (submit) { submit.disabled = true; submit.textContent = 'Correction…'; }
  if (await dailyBacRequest('/submit', { answers })) {
    renderDailyPetitBac(); if (typeof paintDailyGridBonus === 'function') paintDailyGridBonus();
    if (typeof gameFeelReplay === 'function') gameFeelReplay(document.querySelector('#bacday-root .grid-result'), 'is-new');
  } else if (submit) { submit.disabled = false; submit.textContent = 'Réessayer d’envoyer'; }
}
async function shareDailyPetitBac() {
  const s = dailyBacState; if (!s?.finished) return;
  const row = (s.results || []).map(r => r.valid ? (r.rarity && r.rarity <= 10 ? '🟪' : '🟩') : '⬜').join('');
  const text = 'Pokédle · Petit Bac du jour #' + s.number + ' · lettre ' + s.letter + '\n' + row + '\n' + s.points + ' pts' + (s.originality != null && s.players >= 3 ? ' · originalité ' + s.originality + ' %' : '') + '\nhttps://pokdle.onrender.com';
  try { if (navigator.share) { await navigator.share({ text }); return; } await navigator.clipboard.writeText(text); if (typeof showToast === 'function') showToast('Résultat copié !'); }
  catch (e) { if (e?.name !== 'AbortError' && typeof showToast === 'function') showToast('Partage impossible sur cet appareil.'); }
}
// Home: the Petit Bac du jour sits next to the Grille in the bonus line.
async function peekDailyPetitBac() {
  const key = dailyHomeKey(); if (dailyBacPeek?.key === key && Date.now() - dailyBacPeek.at < 30000) return;
  dailyBacPeek = { key, at: Date.now() };
  try { const response = await fetch('/api/daily/petitbac', { credentials: 'same-origin', cache: 'no-store' }), data = await response.json();
    if (response.ok && data.ok && key === dailyHomeKey() && !dailyBacBusy && dailyBacIsCurrent(data)) { dailyBacState = { ...data, receivedAt: performance.now() }; paintDailyGridBonus(); } } catch (_e) {}
}
if (typeof paintDailyGridBonus === 'function') {
  const paintGridBonusOnly = paintDailyGridBonus;
  paintDailyGridBonus = function () {
    const value = paintGridBonusOnly.apply(this, arguments), bonus = document.getElementById('daily-hero-bonus');
    if (!bonus) return value;
    const s = dailyBacIsCurrent(dailyBacState) ? dailyBacState : null;
    const label = s?.finished ? s.points + ' / 100 pts' : s?.status === 'playing' ? 'En cours' : 'À jouer';
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.action = 'openDailyPetitBac'; if (s?.finished) button.className = 'is-done';
    button.innerHTML = '<span>★ Bonus · Petit Bac du jour</span><b>' + label + '</b>';
    bonus.appendChild(button);
    peekDailyPetitBac();
    return value;
  };
}
