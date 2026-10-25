// Qui est-ce ? Pokémon — solo contre l'ordinateur.
// Une grille de 24 Pokémon, un secret tiré par l'ordinateur. Le joueur choisit des
// questions oui/non : la réponse vient des données du Pokédex et les cartes qui ne
// collent plus se retournent seules. Record = le moins de questions possible ; une
// mauvaise proposition coûte 2 questions.
const QUI_GRID_SIZE = 24;
const QUI_WRONG_GUESS_COST = 2;
const QUI_REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unys', 'Kalos', 'Alola', 'Galar', 'Paldea'];
const QUI_GROUPS = [['type', 'Types'], ['gen', 'Génération'], ['color', 'Couleur'], ['body', 'Forme'], ['more', 'Divers']];
let quiEstCeState = null;
let quiEstCeGroup = 'type';
let quiEstCeQuestionList = null;

function quiNorm(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function quiPokemon(id) {
  return typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) || null : null;
}
function quiEstCeQuestions() {
  if (quiEstCeQuestionList) return quiEstCeQuestionList;
  const types = ['Normal', 'Feu', 'Eau', 'Plante', 'Électrik', 'Glace', 'Combat', 'Poison', 'Sol', 'Vol', 'Psy', 'Insecte', 'Roche', 'Spectre', 'Dragon', 'Ténèbres', 'Acier', 'Fée'];
  const colors = ['Rouge', 'Bleu', 'Vert', 'Jaune', 'Violet', 'Rose', 'Brun', 'Noir', 'Blanc', 'Gris'];
  const habitats = ['Prairie', 'Forêt', 'Eau douce', 'Mer', 'Montagne', 'Grotte', 'Sentier accidenté', 'Urbain', 'Rare'];
  const isType = (p, t) => quiNorm(p.type1) === quiNorm(t) || quiNorm(p.type2) === quiNorm(t);
  const letters = p => quiNorm(p.name).replace(/[^a-z]/g, '');
  const list = [];
  types.forEach(t => list.push({ id: 'type:' + t, group: 'type', label: 'Est-il de type ' + t + ' ?', short: 'Type ' + t, test: p => isType(p, t) }));
  list.push({ id: 'dual', group: 'type', label: 'A-t-il deux types ?', short: 'Deux types', test: p => Boolean(p.type2) });
  QUI_REGIONS.forEach((region, i) => list.push({ id: 'gen:' + (i + 1), group: 'gen', label: 'Vient-il de ' + region + ' (Gen ' + (i + 1) + ') ?', short: 'Gen ' + (i + 1) + ' · ' + region, test: p => Number(p.gen) === i + 1 }));
  list.push({ id: 'gen:old', group: 'gen', label: 'Vient-il des Gen 1 à 4 ?', short: 'Gen 1 à 4', test: p => Number(p.gen) <= 4 });
  colors.forEach(c => list.push({ id: 'color:' + c, group: 'color', label: 'Est-il surtout ' + c.toLowerCase() + ' ?', short: c, test: p => quiNorm(p.color) === quiNorm(c) }));
  list.push(
    { id: 'stage:1', group: 'body', label: 'Est-ce un Pokémon de base (non évolué) ?', short: 'Pokémon de base', test: p => Number(p.stage) === 1 },
    { id: 'stage:2', group: 'body', label: 'Est-ce une première évolution ?', short: 'Première évolution', test: p => Number(p.stage) === 2 },
    { id: 'stage:3', group: 'body', label: 'Est-ce une deuxième évolution ?', short: 'Deuxième évolution', test: p => Number(p.stage) === 3 },
    { id: 'height:small', group: 'body', label: 'Mesure-t-il moins de 50 cm ?', short: 'Moins de 50 cm', test: p => Number(p.height) < 0.5 },
    { id: 'height:1', group: 'body', label: 'Mesure-t-il plus de 1 m ?', short: 'Plus de 1 m', test: p => Number(p.height) > 1 },
    { id: 'height:2', group: 'body', label: 'Mesure-t-il plus de 2 m ?', short: 'Plus de 2 m', test: p => Number(p.height) > 2 },
    { id: 'weight:10', group: 'body', label: 'Pèse-t-il plus de 10 kg ?', short: 'Plus de 10 kg', test: p => Number(p.weight) > 10 },
    { id: 'weight:100', group: 'body', label: 'Pèse-t-il plus de 100 kg ?', short: 'Plus de 100 kg', test: p => Number(p.weight) > 100 }
  );
  list.push({ id: 'rare', group: 'more', label: 'Est-il légendaire ou fabuleux ?', short: 'Légendaire ou fabuleux', test: p => typeof pokemonIsRare === 'function' && Boolean(pokemonIsRare(p)) });
  habitats.forEach(h => list.push({ id: 'habitat:' + h, group: 'more', label: 'Son habitat est-il « ' + h + ' » ?', short: 'Habitat ' + h.toLowerCase(), test: p => quiNorm(p.habitat) === quiNorm(h) }));
  list.push(
    { id: 'name:am', group: 'more', label: 'Son nom commence-t-il par une lettre de A à M ?', short: 'Nom de A à M', test: p => letters(p).charAt(0) <= 'm' },
    { id: 'name:long', group: 'more', label: 'Son nom a-t-il plus de 7 lettres ?', short: 'Nom de plus de 7 lettres', test: p => letters(p).length > 7 }
  );
  quiEstCeQuestionList = list;
  return list;
}
function quiEstCeQuestion(id) {
  return quiEstCeQuestions().find(q => q.id === id) || null;
}
function quiEstCePool() {
  const source = typeof getPokemonUiList === 'function' ? getPokemonUiList({ includeAltForms: false }) : [];
  return source.filter(p => p && !p.isAltForm && Number(p.id) > 0 && Number(p.id) <= 1025);
}
function newQuiEstCeState(pool = quiEstCePool(), random = Math.random) {
  const ids = pool.map(p => Number(p.id));
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const cards = ids.slice(0, QUI_GRID_SIZE);
  return { phase: 'playing', won: false, cards, secretId: cards[Math.floor(random() * cards.length)], out: [], asked: [], questions: 0, wrong: 0, selected: null, feedback: '', newRecord: false };
}
function quiRemaining(state = quiEstCeState) {
  return state ? state.cards.filter(id => !state.out.includes(id)) : [];
}
// A question is worth asking only while it still splits the remaining cards.
function quiQuestionUseful(question, state = quiEstCeState) {
  if (!question || !state || state.asked.some(entry => entry.id === question.id)) return false;
  const remaining = quiRemaining(state);
  const yes = remaining.filter(id => question.test(quiPokemon(id) || {})).length;
  return yes > 0 && yes < remaining.length;
}
function askQuiEstCe(questionId) {
  const state = quiEstCeState, question = quiEstCeQuestion(questionId);
  if (!state || state.phase !== 'playing' || !quiQuestionUseful(question, state)) return false;
  const secret = quiPokemon(state.secretId);
  const answer = Boolean(question.test(secret));
  const flipped = quiRemaining(state).filter(id => Boolean(question.test(quiPokemon(id) || {})) !== answer);
  state.questions += 1;
  state.asked.unshift({ id: question.id, short: question.short, answer });
  state.out.push(...flipped);
  state.selected = null;
  const left = quiRemaining(state);
  state.feedback = left.length === 1
    ? (answer ? 'Oui' : 'Non') + ' ! Il ne reste que ' + (quiPokemon(left[0])?.name || '?') + ' : clique sa carte pour le proposer.'
    : (answer ? 'Oui' : 'Non') + ' : ' + flipped.length + ' carte' + (flipped.length > 1 ? 's retournées' : ' retournée') + '.';
  renderQuiEstCe(flipped);
  return true;
}
function selectQuiEstCeCard(id) {
  const state = quiEstCeState;
  id = Number(id);
  if (!state || state.phase !== 'playing' || state.out.includes(id) || !state.cards.includes(id)) return;
  state.selected = state.selected === id ? null : id;
  renderQuiEstCe();
}
function proposeQuiEstCe() {
  const state = quiEstCeState;
  if (!state || state.phase !== 'playing' || state.selected === null) return false;
  const id = state.selected;
  if (id === state.secretId) return finishQuiEstCe(true);
  state.wrong += 1;
  state.questions += QUI_WRONG_GUESS_COST;
  state.out.push(id);
  state.selected = null;
  state.feedback = 'Raté, ce n’est pas ' + (quiPokemon(id)?.name || 'lui') + ' (+' + QUI_WRONG_GUESS_COST + ' questions).';
  renderQuiEstCe([id]);
  return false;
}
function giveUpQuiEstCe() {
  if (quiEstCeState?.phase === 'playing') finishQuiEstCe(false);
}
function finishQuiEstCe(won) {
  const state = quiEstCeState, secret = quiPokemon(state.secretId);
  state.phase = 'finished';
  state.won = Boolean(won);
  state.selected = null;
  state.feedback = '';
  if (won && typeof playerProfile !== 'undefined' && playerProfile) {
    const best = Number(playerProfile.quiEstCeBest) || 0;
    state.newRecord = !best || state.questions < best;
    if (state.newRecord) {
      playerProfile.quiEstCeBest = state.questions;
      try { saveProfile(); } catch (_e) {}
    }
    if (typeof awardXp === 'function') awardXp(Math.max(10, 50 - state.questions * 3), 'Qui est-ce ?', 'quiestce');
  }
  if (typeof recordMatchHistory === 'function') recordMatchHistory({ mode: 'quiestce', result: won ? 'win' : 'loss', attempts: state.questions, targetName: secret?.name || null });
  renderQuiEstCe();
  return Boolean(won);
}
function setQuiEstCeGroup(group) {
  quiEstCeGroup = QUI_GROUPS.some(([key]) => key === group) ? group : 'type';
  renderQuiEstCe();
}
function restartQuiEstCe() {
  quiEstCeState = newQuiEstCeState();
  quiEstCeGroup = 'type';
  renderQuiEstCe();
}
function openQuiEstCeMode() {
  if (typeof trackUsage === 'function') trackUsage('solo:quiestce');
  if (typeof hideCustomModeSurfaces === 'function') hideCustomModeSurfaces();
  showScreen('screen-qui-est-ce');
  if (typeof setGlobalNavActive === 'function') setGlobalNavActive('game');
  // An unfinished grid is resumed; a finished one makes room for a new mystery.
  if (!quiEstCeState || quiEstCeState.phase !== 'playing') quiEstCeState = newQuiEstCeState();
  renderQuiEstCe();
}
function quiCardHtml(state, id, flipped, action = 'selectQuiEstCeCard', locked = false) {
  const p = quiPokemon(id) || { name: '?' };
  const out = state.out.includes(id), finished = state.phase === 'finished';
  const classes = ['qui-card', out ? 'is-out' : '', flipped.includes(id) ? 'is-flipping' : '', state.selected === id ? 'is-selected' : '', finished && id === state.secretId ? 'is-secret' : ''].filter(Boolean).join(' ');
  return '<button type="button" class="' + classes + '" data-action="' + action + '" data-args="[' + Number(id) + ']" aria-pressed="' + (state.selected === id) + '"' + (out || finished || locked ? ' disabled' : '') + ' aria-label="' + escapeHtml(p.name + (out ? ' (écarté)' : '')) + '">' +
    '<img src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" loading="lazy" decoding="async" width="96" height="96"><span>' + escapeHtml(p.name) + '</span></button>';
}
function quiLogHtml(state) {
  if (!state.asked.length) return '';
  return '<ol class="qui-log" aria-label="Questions posées">' + state.asked.map(entry => '<li><span>' + escapeHtml(entry.short) + '</span><b class="' + (entry.answer ? 'is-yes' : 'is-no') + '">' + (entry.answer ? 'Oui' : 'Non') + '</b></li>').join('') + '</ol>';
}
function quiPanelHtml(state) {
  const remaining = quiRemaining(state);
  if (state.phase === 'finished') {
    const secret = quiPokemon(state.secretId) || { name: '?' };
    const best = Number(playerProfile?.quiEstCeBest) || 0;
    const detail = state.won
      ? 'En ' + state.questions + ' question' + (state.questions > 1 ? 's' : '') + (state.wrong ? ' (dont ' + state.wrong * QUI_WRONG_GUESS_COST + ' pour ' + (state.wrong > 1 ? 'les erreurs' : 'l’erreur') + ')' : '') + (state.newRecord ? ' · nouveau record !' : best ? ' · record : ' + best : '')
      : 'Il te restait ' + remaining.length + ' Pokémon possibles.';
    return '<div class="qui-result ' + (state.won ? 'is-won' : 'is-lost') + '" role="status">' +
      '<img src="' + escapeHtml(getPokemonSprite(secret)) + '" alt="" width="120" height="120">' +
      '<h3>' + (state.won ? 'Trouvé : ' : 'C’était ') + escapeHtml(secret.name) + (state.won ? ' !' : '') + '</h3><p>' + escapeHtml(detail) + '</p>' +
      '<button class="btn-blue" type="button" data-action="restartQuiEstCe">Nouvelle grille</button></div>' + quiLogHtml(state);
  }
  const questions = quiEstCeQuestions().filter(q => q.group === quiEstCeGroup);
  const tabs = QUI_GROUPS.map(([key, label]) => '<button type="button" data-action="setQuiEstCeGroup" data-args=\'["' + key + '"]\' aria-pressed="' + (key === quiEstCeGroup) + '">' + label + '</button>').join('');
  const buttons = questions.map(q => {
    const asked = state.asked.find(entry => entry.id === q.id);
    if (asked) return '<button type="button" class="qui-question is-asked" disabled>' + escapeHtml(q.label) + '<b class="' + (asked.answer ? 'is-yes' : 'is-no') + '">' + (asked.answer ? 'Oui' : 'Non') + '</b></button>';
    const useful = quiQuestionUseful(q, state);
    return '<button type="button" class="qui-question" data-action="askQuiEstCe" data-args=\'["' + escapeHtml(q.id) + '"]\'' + (useful ? '' : ' disabled title="Ne départage plus aucune carte"') + '>' + escapeHtml(q.label) + '</button>';
  }).join('');
  const selected = state.selected !== null ? quiPokemon(state.selected) : null;
  const propose = selected
    ? '<button class="btn-blue qui-propose-btn" type="button" data-action="proposeQuiEstCe">C’est ' + escapeHtml(selected.name) + ' !</button>'
    : '<p class="qui-hint">Clique une carte pour proposer ce Pokémon. Une erreur coûte ' + QUI_WRONG_GUESS_COST + ' questions.</p>';
  return '<p class="qui-status"><b>' + state.questions + '</b> question' + (state.questions > 1 ? 's' : '') + ' · <b>' + remaining.length + '</b> Pokémon possible' + (remaining.length > 1 ? 's' : '') + '</p>' +
    '<p class="qui-feedback" role="status" aria-live="polite">' + escapeHtml(state.feedback) + '</p>' +
    '<div class="qui-propose">' + propose + '</div>' +
    '<div class="qui-tabs" role="group" aria-label="Thèmes de questions">' + tabs + '</div>' +
    '<div class="qui-questions">' + buttons + '</div>' + quiLogHtml(state) +
    '<button class="btn-ghost qui-giveup" type="button" data-action="giveUpQuiEstCe">Je donne ma langue au chat</button>';
}
function renderQuiEstCe(flipped = []) {
  const root = document.getElementById('qui-root');
  if (!root || !quiEstCeState) return;
  const state = quiEstCeState;
  root.innerHTML = '<div class="qui-layout' + (state.phase === 'finished' ? ' is-finished' : '') + '"><section class="qui-board" aria-label="Grille des Pokémon"><div class="qui-grid">' + state.cards.map(id => quiCardHtml(state, id, flipped)).join('') + '</div></section>' +
    '<aside class="qui-panel">' + quiPanelHtml(state) + '</aside></div>';
  if (typeof prepareDedicatedShell === 'function') prepareDedicatedShell('screen-qui-est-ce');
}
