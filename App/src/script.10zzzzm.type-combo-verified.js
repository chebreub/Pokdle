// 🧬 Combo de types vérifié par le serveur (13/11/2026, « go 2 »). Même écran et mêmes règles qu'avant
// (script.03.minijeux.js) ; seulement, hors Party Room et quand le serveur répond, c'est lui qui tire les paires,
// juge chaque nom, tient les 60 s et le score (lib/type-combo.js) : la 1re partie du jour rapporte sa Ball et
// ses ₽ (Super Ball à 10 combos). Serveur injoignable : la partie d'avant, en entraînement, sans Ball ni ₽.
var tcv = { busy: false, offset: 0, finishing: false, sessionId: null };

function tcvOn() {
  if (typeof isPartySessionActive === 'function' && isPartySessionActive()) return false;
  return typeof verifiedArcadeOnline === 'function' && verifiedArcadeOnline('typecombo');
}
function tcvRef(f) {
  var p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(f.id)) : null;
  return p || { id: f.id, name: f.name };
}
// Ce que le serveur renvoie → l'état que l'écran d'origine sait dessiner.
function tcvTake(a) {
  var st = typeComboState || (typeComboState = createTypeComboState());
  if (a.serverNow) tcv.offset = a.serverNow - Date.now();
  st.verified = a;
  st.score = a.score; st.solved = a.solved;
  st.found = (a.found || []).map(function (f) { return { name: f.name, ref: tcvRef(f), pts: f.pts }; });
  st.endsAt = a.endsAt - tcv.offset;
  st.leftMs = Math.max(0, st.endsAt - Date.now());
  var c = a.combo;
  st.combo = { key: c.types.slice().sort().join('|'), types: c.types, displayTypes: c.types, count: c.count, tier: c.tier };
  return st;
}
function tcvTimer() {
  if (typeComboTimerId) clearInterval(typeComboTimerId);
  typeComboTimerId = setInterval(function () {
    var st = typeComboState;
    if (!st || st.phase !== 'playing') return clearInterval(typeComboTimerId);
    st.leftMs = Math.max(0, st.endsAt - Date.now());
    var t = document.getElementById('type-combo-timer');
    if (t) t.textContent = Math.ceil(st.leftMs / 1000) + 's';
    typeComboPaintTimeBar();
    if (st.leftMs <= 0) { clearInterval(typeComboTimerId); finalizeTypeComboGame(); }
  }, 100);
}
function tcvFocus() { setTimeout(function () { var i = document.getElementById('type-combo-input'); if (i) i.focus(); }, 60); }

var startTypeComboLocal = startTypeComboGame;
startTypeComboGame = async function () {
  if (tcv.busy) return;
  if ((typeof ballState === 'undefined' || !ballState || !ballState.actionScope) && typeof refreshBalls === 'function' && !(typeof isPartySessionActive === 'function' && isPartySessionActive())) {
    tcv.busy = true;
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
    tcv.busy = false;
  }
  if (!tcvOn()) return startTypeComboLocal.apply(this, arguments);
  tcv.busy = true; tcv.finishing = false;
  // L'écran rouvert (ou un autre départ) pendant la demande : la réponse arrivée ensuite ne le remplace pas.
  var opened = typeComboState;
  var root = document.getElementById('type-combo-root');
  if (root) root.innerHTML = '<p class="tc-meta">Le serveur tire la première paire…</p>';
  var body = { mode: 'typecombo', startId: crypto.randomUUID(), restart: true };
  var data = await verifiedArcadeRequest('start', body);
  // 1re visite : l'identité invité peut être créée pendant le chargement ; on reprend l'état du sac et on relance une fois.
  if (data && data.error === 'account_changed' && typeof refreshBalls === 'function') {
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
    data = await verifiedArcadeRequest('start', body);
  }
  tcv.busy = false;
  if (document.body.dataset.screen !== 'screen-type-combo' || typeComboState !== opened) return;
  // Le serveur ne répond pas : la partie d'avant, en entraînement.
  if (!data || !data.ok) return startTypeComboLocal.apply(this, arguments);
  try { trackUsage('solo:typecombo'); } catch (_e) { /* stats */ }
  typeComboState = createTypeComboState();
  var st = tcvTake(data.arcade);
  st.pool = typeComboPool();
  st.phase = 'playing'; st.feedback = ''; st.last = null;
  tcv.sessionId = data.arcade.sessionId;
  renderTypeComboScreen();
  tcvTimer();
  tcvFocus();
  if (typeof refreshTypeComboLiveRank === 'function') setTimeout(refreshTypeComboLiveRank, 0);
};

var typeComboSubmitLocal = typeComboSubmitGuess;
typeComboSubmitGuess = async function () {
  var st = typeComboState;
  if (!st || !st.verified) return typeComboSubmitLocal.apply(this, arguments);
  if (st.phase !== 'playing' || tcv.busy) return;
  var input = document.getElementById('type-combo-input');
  var guess = input ? String(input.value || '').trim() : '';
  if (!guess) return typeComboSkip();
  tcv.busy = true;
  var data = await verifiedArcadeRequest('answer', { mode: 'typecombo', sessionId: st.verified.sessionId, round: st.verified.round, choice: guess.slice(0, 60) });
  tcv.busy = false;
  if (typeComboState !== st || st.phase !== 'playing') return;
  if (!data || !data.ok) { if (typeof showToast === 'function') showToast('Réponse non confirmée. Réessaie : elle ne sera comptée qu’une fois.'); return; }
  var a = data.arcade, ev = a.event || {};
  tcvTake(a);
  if (a.phase === 'over') return finalizeTypeComboGame();
  input = document.getElementById('type-combo-input');
  if (ev.kind === 'ok' && !data.replayed) {
    st.last = { name: ev.name, pts: ev.pts, label: ev.label };
    st.feedback = '';
    try { awardXp(6, 'Combo de types', 'typecombo'); } catch (_e) { /* XP */ }
    if (typeof gameFeelAnswer === 'function') gameFeelAnswer(true, document.querySelector('#type-combo-root .tc-combo') || input, '+' + ev.pts);
    if (input) input.value = '';
    renderTypeComboScreen();
    tcvFocus();
    return;
  }
  if (ev.kind === 'ok') { if (input) input.value = ''; renderTypeComboScreen(); tcvFocus(); return; }
  // Un nom faux montre ses vrais types : la paire reste la même.
  st.feedback = ev.kind === 'wrong' ? ('✗ ' + escapeHtml(ev.name) + ' est ' + typeComboTypesHtml(ev.types)) : 'Pokémon inconnu';
  if (input) { input.classList.add('is-wrong'); setTimeout(function () { input.classList.remove('is-wrong'); }, 280); }
  if (typeof gameFeelAnswer === 'function') gameFeelAnswer(false, input, '×');
  var fb = document.getElementById('type-combo-feedback');
  if (fb) fb.innerHTML = st.feedback;
};

var typeComboSkipLocal = typeComboSkip;
typeComboSkip = async function () {
  var st = typeComboState;
  if (!st || !st.verified) return typeComboSkipLocal.apply(this, arguments);
  if (st.phase !== 'playing' || tcv.busy) return;
  tcv.busy = true;
  var data = await verifiedArcadeRequest('next', { mode: 'typecombo', sessionId: st.verified.sessionId, round: st.verified.round });
  tcv.busy = false;
  if (typeComboState !== st || st.phase !== 'playing' || !data || !data.ok) return;
  tcvTake(data.arcade);
  if (data.arcade.phase === 'over') return finalizeTypeComboGame();
  st.last = null; st.feedback = '';
  var input = document.getElementById('type-combo-input');
  if (input) input.value = '';
  renderTypeComboScreen();
  tcvFocus();
};

// À 0 s, le serveur clôt la partie lui-même (il vérifie l'heure, avec 1,5 s de marge réseau) ;
// on garde ensuite la fin d'origine : record, compteur des stats, classement, écran de fin.
var finalizeTypeComboLocal = finalizeTypeComboGame;
finalizeTypeComboGame = function () {
  var st = typeComboState;
  if (!st || !st.verified) return finalizeTypeComboLocal.apply(this, arguments);
  if (st.verified.phase === 'over') { st.verified = null; return finalizeTypeComboLocal.apply(this, arguments); }
  if (tcv.finishing) return;
  tcv.finishing = true;
  st.leftMs = 0;
  var fb = document.getElementById('type-combo-feedback');
  if (fb) fb.textContent = '⏱️ Temps écoulé…';
  var tries = 0;
  var ask = async function () {
    var wait = Math.max(0, st.endsAt + 1700 - Date.now());
    if (wait) await new Promise(function (r) { setTimeout(r, wait); });
    var data = await verifiedArcadeRequest('finish', { mode: 'typecombo', sessionId: st.verified.sessionId, round: st.verified.round });
    if (typeComboState !== st) { tcv.finishing = false; return; }
    if (data && data.ok && data.arcade.phase === 'over') {
      tcv.finishing = false;
      tcvTake(data.arcade);
      st.verified = null;
      return finalizeTypeComboLocal();
    }
    if (++tries < 4) { setTimeout(ask, 1200); return; }
    // Le serveur ne répond plus : on finit la partie avec le score qu'il avait confirmé.
    tcv.finishing = false;
    st.verified = null;
    finalizeTypeComboLocal();
  };
  ask();
};

window.startTypeComboGame = startTypeComboGame;
window.typeComboSubmitGuess = typeComboSubmitGuess;
window.typeComboSkip = typeComboSkip;
window.finalizeTypeComboGame = finalizeTypeComboGame;
