// === SFX combat GBA (Web Audio) ===
let __gbaAudioCtx = null;
function getGbaAudioCtx() {
  if (__gbaAudioCtx) return __gbaAudioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    __gbaAudioCtx = new Ctx();
    return __gbaAudioCtx;
  } catch (e) {
    return null;
  }
}
function playGbaBeep(freq = 700, durationMs = 60, volume = 0.05, type = "square") {
  const ctx = getGbaAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime;
    const tEnd = t0 + durationMs / 1000;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(tEnd);
  } catch (e) { /* silent */ }
}

let __gbaLastSfxKey = "";
let __gbaLastAnimKey = "";
const __GBA_ONESHOT_ANIM_CLASSES = ["is-hit", "is-taking-hit", "is-ko", "is-switch-in"];
function stripGbaOneShotAnims(classString) {
  if (!classString) return "";
  let out = String(classString);
  __GBA_ONESHOT_ANIM_CLASSES.forEach((c) => {
    out = out.replace(new RegExp("\\b" + c + "\\b", "g"), "");
  });
  return out.replace(/\s+/g, " ").trim();
}
function maybePlayPhaseSfx(state) {
  const action = state?.visualReplay?.currentAction;
  const phase = state?.visualReplay?.phase || "";
  if (!action || !phase) { __gbaLastSfxKey = ""; return; }
  const turnNum = Number(state.visualReplay?.turn) || 0;
  const visibleCount = Number(state.visualReplay?.visibleCount) || 0;
  const key = `${turnNum}:${visibleCount}:${action.side || ""}:${action.event || ""}:${action.move?.name || action.moveName || ""}:${phase}`;
  if (key === __gbaLastSfxKey) return;
  __gbaLastSfxKey = key;

  if (phase === "impact") {
    if (action.missed) {
      playGbaBeep(320, 90, 0.025, "triangle"); // whiff doux
    } else if (action.critical) {
      playGbaBeep(180, 90, 0.05, "triangle");
      setTimeout(() => playGbaBeep(110, 220, 0.04, "sine"), 70);
    } else if (Number(action.effectiveness) > 1) {
      playGbaBeep(260, 100, 0.04, "triangle");
    } else if (Number(action.effectiveness) > 0 && Number(action.effectiveness) < 1) {
      playGbaBeep(200, 90, 0.025, "sine");
    } else if (Number(action.damage) > 0) {
      playGbaBeep(220, 80, 0.03, "triangle");
    }
  } else if (phase === "ko") {
    playGbaBeep(180, 260, 0.04, "sine");
    setTimeout(() => playGbaBeep(95, 400, 0.035, "sine"), 180);
  }
}

function playBattleStartTransition() {
  document.querySelectorAll(".gba-battle-start-overlay").forEach((el) => el.remove());
  const overlay = document.createElement("div");
  overlay.className = "gba-battle-start-overlay";
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 900);
}

function getGbaStatusBadgeHtml(status) {
  if (!status) return "";
  const map = {
    paralysed:      { abbr: "PAR", cls: "is-par" },
    burned:         { abbr: "BRN", cls: "is-brn" },
    poisoned:       { abbr: "PSN", cls: "is-psn" },
    badly_poisoned: { abbr: "TOX", cls: "is-tox" },
    asleep:         { abbr: "SLP", cls: "is-slp" },
    frozen:         { abbr: "FRZ", cls: "is-frz" },
  };
  const cfg = map[status];
  if (!cfg) return "";
  return `<span class="gba-status-badge ${cfg.cls}">${cfg.abbr}</span>`;
}

function getGbaPokeballsHtml(team, activeIndex) {
  const slots = Array.isArray(team) ? team.slice(0, 6) : [];
  while (slots.length < 6) slots.push(null);
  const balls = slots.map((slot, i) => {
    if (!slot) return `<span class="gba-pokeball is-empty" aria-hidden="true"></span>`;
    if (Number(slot.currentHp) <= 0) return `<span class="gba-pokeball is-fainted" aria-hidden="true"></span>`;
    if (i === Number(activeIndex)) return `<span class="gba-pokeball is-active" aria-hidden="true"></span>`;
    return `<span class="gba-pokeball" aria-hidden="true"></span>`;
  }).join("");
  return `<div class="gba-pokeballs">${balls}</div>`;
}

function playGbaMenuBlip() {
  playGbaBeep(620, 35, 0.025, "triangle");
}

function getGbaBattleLevel(battler) {
  if (!battler?.stats) return 50;
  const total = Object.values(battler.stats).reduce((s, v) => s + (Number(v) || 0), 0);
  if (!total) return 50;
  return Math.max(15, Math.min(100, Math.round(total / 12)));
}

let __gbaLastHpPercent = { left: 100, right: 100 };
let __gbaLastDisplayKey = { left: null, right: null };
function refreshGbaHpBars(leftTarget, rightTarget, leftDisplayKey, rightDisplayKey) {
  const apply = (selector, target, displayKey, side) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const next = Math.max(0, Math.min(100, Number(target) || 0));
    const sameDisplay = __gbaLastDisplayKey[side] != null && __gbaLastDisplayKey[side] === displayKey;
    if (!sameDisplay) {
      // Nouveau Pokémon affiché (switch / KO / 1er render) → snap sans animation
      el.style.transition = "none";
      el.style.width = next + "%";
      void el.offsetHeight;
      el.style.transition = "";
      __gbaLastHpPercent[side] = next;
      __gbaLastDisplayKey[side] = displayKey;
      return;
    }
    const prev = Number(__gbaLastHpPercent[side]);
    if (!Number.isFinite(prev) || prev === next) {
      el.style.width = next + "%";
      __gbaLastHpPercent[side] = next;
      return;
    }
    el.style.width = prev + "%";
    void el.offsetHeight; // force reflow so transition runs
    el.style.width = next + "%";
    __gbaLastHpPercent[side] = next;
  };
  apply(".gba-battle .gba-info-player .gba-info-hp-fill", leftTarget, leftDisplayKey, "left");
  apply(".gba-battle .gba-info-foe .gba-info-hp-fill", rightTarget, rightDisplayKey, "right");
}

let __gbaTextboxTimer = null;
let __gbaTextboxLastText = "";
function refreshGbaTextbox(text) {
  const box = document.querySelector(".gba-battle .gba-textbox-text");
  if (!box) {
    __gbaTextboxLastText = "";
    if (__gbaTextboxTimer) { clearInterval(__gbaTextboxTimer); __gbaTextboxTimer = null; }
    return;
  }
  const target = String(text || "");
  if (target === __gbaTextboxLastText) {
    box.textContent = target;
    return;
  }
  __gbaTextboxLastText = target;
  if (__gbaTextboxTimer) { clearInterval(__gbaTextboxTimer); __gbaTextboxTimer = null; }
  box.textContent = "";
  let i = 0;
  __gbaTextboxTimer = setInterval(() => {
    if (i >= target.length) {
      clearInterval(__gbaTextboxTimer);
      __gbaTextboxTimer = null;
      box.textContent = target;
      return;
    }
    box.textContent = target.slice(0, ++i);
  }, 14);
}

function renderDraftSimpleBattleDevPanel(state) {
  const panel = ensureDraftSimpleBattleDevPanel();
  const body = document.getElementById("draft-dev-battle-body");
  if (!panel || !body || !state) return;
  const shouldAutoScroll = panel.classList.contains("hidden");
  document.body.classList.add("draft-battle-open");
  const heading = panel.querySelector(".draft-dev-battle-head h3");
  if (heading) heading.textContent = state.title || "Combat Draft";
  panel.className = `draft-panel draft-dev-battle-panel ${state.arena ? getDraftArenaThemeClass(state.arena) : "theme-neutral"}`;
  panel.style.setProperty("--draft-arena-image", state.arena ? `url("${getDraftArenaTypeImageUrl(state.arena)}")` : "none");

  if (state.showPreview) {
    const network = getDraftSimpleBattleNetworkMeta(state);
    const isNetwork = isDraftSimpleBattleNetworkMode(state);
    const roomReady = isDraftSimpleBattleNetworkRoomReady(state);
    const opponent = getDraftSimpleBattleNetworkOpponent(state);
    const roomStatusText = getDraftSimpleBattleNetworkRoomStatusText(state);
    const launchHint = getDraftSimpleBattleNetworkLaunchHint(state);
    const previewLeft = state.leftTeam[0] || null;
    const previewRight = state.rightTeam[0] || null;
    const previewHint = previewLeft && previewRight
      ? getDraftSimpleBattleMatchupHint(state.gen, previewLeft, previewRight)
      : "Lead à confirmer";
    const previewPlayer = previewLeft ? {
      currentHp: previewLeft.maxHp,
      maxHp: previewLeft.maxHp,
      speed: previewLeft.speed,
      pokemon: previewLeft.pokemon,
    } : null;
    const previewEnemy = previewRight ? {
      currentHp: previewRight.maxHp,
      maxHp: previewRight.maxHp,
      speed: previewRight.speed,
      pokemon: previewRight.pokemon,
    } : null;
    body.innerHTML = `
      <div class="draft-dev-battle-arena-banner is-live">
        <div class="draft-dev-battle-arena-badge">${state.arena ? getDraftBadgeMarkup(state.arena, "preview") : ""}</div>
        <div>
          <b>${escapeHtml(state.arena ? `Arène ${state.arena.name}` : "Préparation du duel")}</b>
          <span>${escapeHtml(state.arena ? getDraftArenaPreviewHint(state.arena) : "Choisis ton lead puis lance le duel.")}</span>
        </div>
      </div>
      <div class="draft-dev-battle-scene-note is-preview">
        <b>Préparation</b>
        <span>${escapeHtml(previewLeft?.pokemon?.name || "Ton lead")} vs ${escapeHtml(previewRight?.pokemon?.name || "Lead adverse")} • ${escapeHtml(previewHint)}</span>
      </div>
      ${isNetwork ? `
        <div class="draft-dev-battle-network-card">
          <div class="draft-dev-battle-network-head">
            <b>Room réseau</b>
            <span class="draft-dev-battle-network-role">${escapeHtml(getDraftSimpleBattleNetworkRoleLabel(state))}</span>
          </div>
          <div class="draft-dev-battle-network-grid">
            <div class="draft-dev-battle-network-item">
              <span>Code room</span>
              <b>${escapeHtml(network.roomCode || "—")}</b>
            </div>
            <div class="draft-dev-battle-network-item">
              <span>État</span>
              <b>${escapeHtml(roomStatusText)}</b>
            </div>
            <div class="draft-dev-battle-network-item">
              <span>Autre joueur</span>
              <b>${escapeHtml(opponent?.nickname || "Absent")}</b>
            </div>
            <div class="draft-dev-battle-network-item">
              <span>Connexion</span>
              <b>${escapeHtml(opponent?.connected === false || !opponent ? "En attente" : "Connecté")}</b>
            </div>
          </div>
          <small>${escapeHtml(launchHint)}</small>
        </div>
      ` : ""}
      <div class="draft-dev-battle-fighters draft-dev-battle-fighters-preview">
        <div class="draft-summary-card wide draft-dev-battle-fighter is-player">
          <div class="draft-dev-battle-fighter-head">
            <img src="${escapeHtml(getPokemonSprite(previewPlayer?.pokemon || {}))}" alt="${escapeHtml(previewPlayer?.pokemon?.name || "Pokémon joueur")}">
            <div>
              <span>Joueur</span>
              <b>${escapeHtml(previewPlayer?.pokemon?.name || "Lead à choisir")}</b>
              <small>${previewPlayer ? `PV ${previewPlayer.maxHp} • Vitesse ${previewPlayer.speed}` : "Choisis ton Pokémon de départ"}</small>
              ${previewPlayer ? `
                <div class="draft-dev-battle-hp">
                  <div class="draft-dev-battle-hp-meta">
                    <strong>PV</strong>
                    <span>${previewPlayer.maxHp} / ${previewPlayer.maxHp}</span>
                  </div>
                  <div class="draft-dev-battle-hp-track">
                    <span class="draft-dev-battle-hp-fill" style="width:100%"></span>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
        <div class="draft-summary-card wide draft-dev-battle-fighter is-foe">
          <div class="draft-dev-battle-fighter-head">
            <img src="${escapeHtml(getPokemonSprite(previewEnemy?.pokemon || {}))}" alt="${escapeHtml(previewEnemy?.pokemon?.name || "Pokémon adverse")}">
            <div>
              <span>Adversaire</span>
              <b>${escapeHtml(previewEnemy?.pokemon?.name || "Lead adverse")}</b>
              <small>${previewEnemy ? `PV ${previewEnemy.maxHp} • Vitesse ${previewEnemy.speed}` : "Lead adverse à venir"}</small>
              ${previewEnemy ? `
                <div class="draft-dev-battle-hp">
                  <div class="draft-dev-battle-hp-meta">
                    <strong>PV</strong>
                    <span>${previewEnemy.maxHp} / ${previewEnemy.maxHp}</span>
                  </div>
                  <div class="draft-dev-battle-hp-track">
                    <span class="draft-dev-battle-hp-fill" style="width:100%"></span>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      </div>
      <div class="draft-dev-battle-benches">
        ${renderDraftSimpleBattlePreviewTeam(state.leftTeam, "Équipe joueur", "is-player", { selectable: true, selectedIndex: state.leftActiveIndex || 0 })}
        ${renderDraftSimpleBattlePreviewTeam(state.rightTeam, state.arena?.name ? `Équipe de ${state.arena.name}` : "Équipe adverse", "is-foe")}
      </div>
      <div class="draft-dev-battle-meta">
        <div class="draft-summary-card draft-dev-battle-status is-player"><span>Statut</span><b>${escapeHtml(previewLeft ? "Lead verrouillé" : "Lead à choisir")}</b></div>
        <div class="draft-summary-card"><span>Ordre pressenti</span><b>${escapeHtml(previewLeft?.pokemon?.name || "Ton lead")} -> ${escapeHtml(previewRight?.pokemon?.name || "Adversaire")}</b><small>${escapeHtml(previewHint)}</small></div>
        <div class="draft-summary-card"><span>Équipe joueur</span><b>${state.leftTeam.length} Pokémon</b></div>
        <div class="draft-summary-card"><span>Équipe adverse</span><b>${state.rightTeam.length} Pokémon</b></div>
      </div>
      <div class="draft-dev-battle-actions draft-dev-battle-preview-actions">
        <button type="button" class="btn-red draft-dev-battle-preview-cta" data-action="startDraftSimpleBattlePreview">Commencer le duel</button>
        <button type="button" class="btn-ghost" data-action="clearDraftSimpleBattleDevPanel">Retour au Draft</button>
      </div>
      <div class="draft-dev-battle-log"><p class="card-desc">Clique un Pokémon dans le banc joueur ci-dessus pour choisir ton lead, puis lance le duel.</p></div>
    `;
    panel.classList.remove("hidden");
    return;
  }

  if (state.showIntro) {
    const introLeft = getDraftSimpleBattleDisplayBattler(state, "left");
    const introRight = getDraftSimpleBattleDisplayBattler(state, "right");
    if (!introLeft || !introRight) return;
    body.innerHTML = `
      <div class="draft-dev-battle-arena-banner is-intro">
        <div class="draft-dev-battle-arena-badge">${state.arena ? getDraftBadgeMarkup(state.arena, "intro") : ""}</div>
        <div>
          <b>${escapeHtml(state.arena ? `Arène ${state.arena.name}` : "Début du duel")}</b>
          <span>${escapeHtml(state.arena ? `${state.arena.name} t’attend avec une équipe ${state.arena.type}.` : "Le duel commence.")}</span>
        </div>
      </div>
      <div class="draft-dev-battle-intro">
        <div class="draft-summary-card draft-dev-battle-intro-side is-player">
          <span>Joueur</span>
          <img src="${escapeHtml(getPokemonSprite(introLeft.pokemon))}" alt="${escapeHtml(introLeft.pokemon.name)}">
          <b>${escapeHtml(introLeft.pokemon.name)}</b>
        </div>
        <div class="draft-dev-battle-intro-vs">VS</div>
        <div class="draft-summary-card draft-dev-battle-intro-side is-foe">
          <span>Adversaire</span>
          <img src="${escapeHtml(getPokemonSprite(introRight.pokemon))}" alt="${escapeHtml(introRight.pokemon.name)}">
          <b>${escapeHtml(introRight.pokemon.name)}</b>
        </div>
      </div>
    `;
    panel.classList.remove("hidden");
    return;
  }

  if (state.turnState === "hotseat-transition") {
    body.innerHTML = `
      <div class="draft-dev-battle-arena-banner is-live">
        <div class="draft-dev-battle-arena-badge">${state.arena ? getDraftBadgeMarkup(state.arena, "live") : ""}</div>
        <div>
          <b>${escapeHtml(state.title || "Combat Draft")}</b>
          <span>${escapeHtml(state.pendingSwitch
            ? "Passation du navigateur pour le choix du remplaçant."
            : "Passation du navigateur pour le choix de l’action suivante.")}</span>
        </div>
      </div>
      <div class="draft-dev-battle-scene-note is-preview">
        <b>Action enregistrée</b>
        <span>${escapeHtml(state.sceneMessage || "Passe l’écran au joueur suivant.")}</span>
      </div>
      <div class="draft-dev-battle-result">
        <b>${escapeHtml(state.hotseatPendingSide === "right" ? "Joueur droite en attente" : "Joueur gauche en attente")}</b>
        <span>${escapeHtml(state.pendingSwitch
          ? "Le joueur suivant va choisir le Pokémon à envoyer."
          : "Le joueur suivant va choisir son action sans voir celle de l’autre.")}</span>
      </div>
      <div class="draft-dev-battle-actions draft-dev-battle-preview-actions">
        <button type="button" class="btn-red draft-dev-battle-preview-cta" data-action="continueDraftSimpleBattleHotseat">Passer au joueur suivant</button>
      </div>
    `;
    panel.classList.remove("hidden");
    return;
  }

  syncDraftSimpleBattleActiveBattlers(state);
  const displayLeft = getDraftSimpleBattleDisplayBattler(state, "left");
  const displayRight = getDraftSimpleBattleDisplayBattler(state, "right");
  if (!displayLeft || !displayRight) return;
  const lastTurn = state.log[state.log.length - 1] || null;
  const currentOrder = lastTurn?.order || getDraftSimpleBattleTurnOrder(displayLeft, displayRight);
  const orderLabel = currentOrder
    .map((side) => (side === "left" ? displayLeft.pokemon.name : displayRight.pokemon.name))
    .join(" -> ");
  const orderHint = getDraftSimpleBattleOrderHint(currentOrder, displayLeft, displayRight);
  const winner = getDraftSimpleBattleWinnerName(state);
  const leftHpPercent = getDraftSimpleBattleHpPercent(displayLeft);
  const rightHpPercent = getDraftSimpleBattleHpPercent(displayRight);
  const network = getDraftSimpleBattleNetworkMeta(state);
  const isNetwork = isDraftSimpleBattleNetworkMode(state);
  const localSide = getDraftSimpleBattleNetworkLocalSide(state);
  const networkOpponent = getDraftSimpleBattleNetworkOpponent(state);
  const networkTurnHint = getDraftSimpleBattleNetworkTurnHint(state);
  const visualFeedback = getDraftSimpleBattleVisualFeedback(state);
  const replayAction = state?.visualReplay?.active ? state.visualReplay.currentAction : null;
  const replayPhaseStr = state?.visualReplay?.phase || "";
  const inImpactPhase = replayPhaseStr === "impact" || replayPhaseStr === "hp";
  const isCriticalHit = Boolean(replayAction?.critical) && inImpactPhase;
  const isSuperEffective = Number(replayAction?.effectiveness) > 1 && inImpactPhase && !isCriticalHit;
  const gbaSceneExtraClass = isCriticalHit ? " gba-scene-crit" : "";
  const gbaTextboxToneClass = isCriticalHit ? " is-crit" : isSuperEffective ? " is-super" : "";
  // Gating animations one-shot : ne re-déclenche pas les keyframes si la phase de replay n'a pas changé
  // Inclut visibleCount + side + event pour différencier les actions successives du même tour
  const animFp = state?.visualReplay?.active
    ? `${state.visualReplay.turn || 0}:${state.visualReplay.visibleCount || 0}:${replayAction?.side || ""}:${replayAction?.event || ""}:${replayAction?.move?.name || replayAction?.moveName || ""}:${replayPhaseStr}`
    : "";
  const animFpChanged = animFp !== __gbaLastAnimKey;
  __gbaLastAnimKey = animFp;
  let leftFighterClass = animFpChanged ? visualFeedback.leftClass : stripGbaOneShotAnims(visualFeedback.leftClass);
  let rightFighterClass = animFpChanged ? visualFeedback.rightClass : stripGbaOneShotAnims(visualFeedback.rightClass);
  // F : sprite recule à la baseline dès la phase d'impact/hp/ko (au lieu de rester en lunge)
  if (replayPhaseStr === "impact" || replayPhaseStr === "hp" || replayPhaseStr === "ko") {
    leftFighterClass = leftFighterClass.replace(/\bis-attacking\b/g, "").replace(/\s+/g, " ").trim();
    rightFighterClass = rightFighterClass.replace(/\bis-attacking\b/g, "").replace(/\s+/g, " ").trim();
  }
  const statusText = getDraftSimpleBattleStatusText(state);
  const statusClass = getDraftSimpleBattleStatusClass(state);
  const leftStatusLabel = getDraftSimpleBattleStatusLabel(displayLeft.status);
  const rightStatusLabel = getDraftSimpleBattleStatusLabel(displayRight.status);
  const isFinished = state.phase === "finished";
  panel.classList.toggle("is-finished-combat", isFinished);
  body.classList.toggle("is-finished-combat", isFinished);
  const needsForcedSwitch = !isFinished && state.pendingSwitch;
  const isEnemyTurn = !isFinished && !needsForcedSwitch && state.turnState === "enemy";
  const isPlayerTurn = !isFinished && !needsForcedSwitch && !isEnemyTurn;
  const isReplayingTurn = Boolean(state.visualReplay?.active);
  const currentActionSide = getDraftSimpleBattleCurrentActionSide(state);
  const currentActionBattler = currentActionSide === "right" ? displayRight : displayLeft;
  const currentActionTarget = currentActionSide === "right" ? displayLeft : displayRight;
  const canLocalChooseAction = isPlayerTurn && !isReplayingTurn && (!isNetwork || currentActionSide === localSide) && !network.waitingRemote;
  const showActionResumeCue = Boolean(state.actionResumeCueActive && canLocalChooseAction);
  const canLocalChooseReplacement = needsForcedSwitch && (!isNetwork || (state.pendingSwitchSide || "left") === localSide);
  const replayPhase = state.visualReplay?.phase || "idle";
  const combatUiState = isFinished
    ? "finished"
    : needsForcedSwitch
      ? "switch"
      : isReplayingTurn
        ? "replay"
        : canLocalChooseAction
          ? "choice"
          : isEnemyTurn
            ? "enemy"
            : "waiting";
  panel.dataset.combatUi = combatUiState;
  panel.dataset.replayPhase = replayPhase;
  body.dataset.combatUi = combatUiState;
  body.dataset.replayPhase = replayPhase;

  const actionsHtml = state.log.map((entry) => {
    const maxVisible = state.visualReplay?.active && Number(state.visualReplay.turn) === Number(entry.turn)
      ? Math.max(0, Number(state.visualReplay.visibleCount) || 0)
      : (entry.actions || []).length;
    const cards = (entry.actions || []).slice(0, maxVisible).map((action) => {
      const item = buildDraftSimpleBattleActionFeedItem(action, displayLeft, displayRight);
      if (!item) return "";
      return `
        <article class="draft-dev-battle-feed-item is-${escapeHtml(item.kind || "info")}">
          <div class="draft-dev-battle-feed-head">
            <strong>${escapeHtml(item.title)}</strong>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          </div>
          <p>${escapeHtml(item.body)}</p>
          ${item.tags?.length ? `<div class="draft-dev-battle-feed-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </article>
      `;
    }).join("");
    return `
      <div class="draft-dev-battle-turn">
        <div class="draft-dev-battle-turn-head">
          <strong>Tour ${entry.turn}</strong>
          <span>${escapeHtml((entry.order || []).map((side) => side === "left" ? "Gauche" : "Droite").join(" → ") || "Ordre en attente")}</span>
        </div>
        <div class="draft-dev-battle-feed-list">${cards || (state.visualReplay?.active && Number(state.visualReplay.turn) === Number(entry.turn) ? '<p class="card-desc">Résolution du tour...</p>' : '<p class="card-desc">Aucune action.</p>')}</div>
      </div>
    `;
  }).join("");

  const movesHtml = (currentActionBattler.moves || []).map((move, index) => {
    const moveEffectiveness = getDraftSimpleBattleTypeMultiplier(state.gen, move?.type, currentActionTarget);
    const moveEffectivenessText = move?.category === "status"
      ? (move?.effect?.label || "Soutien")
      : getDraftSimpleBattleEffectivenessText(moveEffectiveness);
    const moveEffectivenessClass = move?.category === "status"
      ? "is-neutral"
      : getDraftSimpleBattleEffectivenessClass(moveEffectiveness);
    return `
    <button
      type="button"
      class="btn-blue draft-dev-battle-move ${moveEffectivenessClass} ${move?.category === "status" ? "is-status" : "is-attack"}"
      data-action="runDraftSimpleBattleDevTurn" data-args='[${index},"${currentActionSide}"]'
      ${(state.phase === "finished" || !canLocalChooseAction || (Number(move?.ppCurrent) || 0) <= 0) ? "disabled" : ""}
    >
      <span class="draft-dev-battle-move-name">${escapeHtml(move.name)}</span>
      <span class="draft-dev-battle-move-meta">
        <small class="draft-dev-battle-move-type">${escapeHtml(move.type)}</small>
        ${Number(move.power) ? `<small class="draft-dev-battle-move-power">Puissance ${move.power}</small>` : ""}
        <small class="draft-dev-battle-move-power">PP ${Number(move?.ppCurrent) || 0}/${Number(move?.ppMax) || 0}</small>
      </span>
      <span class="draft-dev-battle-move-effect ${moveEffectivenessClass}">${escapeHtml(moveEffectivenessText)}</span>
    </button>
  `;
  }).join("");
  const struggleOnly = !getDraftSimpleBattleUsableMoveIndexes(currentActionBattler).length;
  const struggleHtml = struggleOnly
    ? `<button type="button" class="btn-blue draft-dev-battle-move" data-action="runDraftSimpleBattleDevStruggle" data-args='["${currentActionSide}"]' ${state.phase === "finished" || !canLocalChooseAction ? "disabled" : ""}>
        <span class="draft-dev-battle-move-name">Struggle</span>
        <span class="draft-dev-battle-move-meta">
          <small class="draft-dev-battle-move-type">Normal</small>
          <small class="draft-dev-battle-move-power">PP forcé</small>
        </span>
        <span class="draft-dev-battle-move-effect is-low">Frappe avec recul</span>
      </button>`
    : "";

  // GBA action menu (B3) — only when player can act locally
  const showGbaMenu = canLocalChooseAction && !isReplayingTurn;
  const gbaMenuView = showGbaMenu ? __gbaMenuView : "main";
  const gbaSwitchAvailable = showGbaMenu && getDraftSimpleBattleAvailableSwitchIndexesForSide(state, currentActionSide).length > 0;
  let gbaMenuHtml = "";
  if (showGbaMenu) {
    if (gbaMenuView === "moves") {
      const movesGba = struggleOnly
        ? `<button type="button" class="gba-move-btn" data-action="runDraftSimpleBattleDevStruggle" data-args='["${currentActionSide}"]'>
            <span class="gba-move-name">Lutte</span>
            <span class="gba-move-meta"><span>Normal</span><span>PP —</span></span>
          </button>`
        : (currentActionBattler.moves || []).map((move, i) => {
            const noPp = (Number(move?.ppCurrent) || 0) <= 0;
            return `<button type="button" class="gba-move-btn ${noPp ? "is-disabled" : ""}" data-action="runDraftSimpleBattleDevTurn" data-args='[${i},"${currentActionSide}"]' ${noPp ? "disabled" : ""}>
              <span class="gba-move-name">${escapeHtml(move.name)}</span>
              <span class="gba-move-meta"><span>${escapeHtml(move.type)}</span><span>PP ${Number(move?.ppCurrent) || 0}/${Number(move?.ppMax) || 0}</span></span>
            </button>`;
          }).join("");
      gbaMenuHtml = `<div class="gba-menu" data-view="moves">
        ${movesGba}
        <button type="button" class="gba-menu-back" data-action="setGbaMenuView" data-args='["main"]'>◀ RETOUR</button>
      </div>`;
    } else {
      gbaMenuHtml = `<div class="gba-menu" data-view="main">
        <button type="button" class="gba-menu-btn" data-action="setGbaMenuView" data-args='["moves"]'>ATTAQUE</button>
        <button type="button" class="gba-menu-btn is-disabled" disabled title="Pas d'objets dans le Draft">SAC</button>
        <button type="button" class="gba-menu-btn${gbaSwitchAvailable ? "" : " is-disabled"}" ${gbaSwitchAvailable ? `data-action="openDraftSimpleBattleManualSwitch" data-args='["${currentActionSide}"]'` : "disabled"}>POKÉMON</button>
        <button type="button" class="gba-menu-btn is-disabled" disabled title="Impossible de fuir un combat d'arène">FUITE</button>
      </div>`;
    }
  }

  const playerWin = isDraftSimpleBattlePlayerWin(state);
  const leftRemaining = getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex);
  const rightRemaining = getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex);
  const sceneText = getDraftSimpleBattleSceneText(state);
  const liveResultTone = needsForcedSwitch
    ? "is-switch"
    : isReplayingTurn
      ? "is-resolving"
      : canLocalChooseAction
        ? "is-choice"
        : "is-waiting";
  const liveResultKicker = needsForcedSwitch
    ? "Remplacement"
    : isReplayingTurn
      ? "Résolution"
      : canLocalChooseAction
        ? "Ton tour"
        : "En attente";
  const resultHtml = isFinished
    ? `<div class="gba-result ${playerWin ? "is-win" : "is-loss"}">
        <h3 class="gba-result-title">${playerWin ? "VICTOIRE !" : "DÉFAITE"}</h3>
        <p class="gba-result-text">${playerWin ? "Tu as gagné le combat&nbsp;!" : "Tous tes Pokémon sont K.O…"}</p>
        <p class="gba-result-meta">${escapeHtml(winner)} clôture le match en ${state.log.length} tour${state.log.length > 1 ? "s" : ""} — ${leftRemaining} Pokémon restant${leftRemaining > 1 ? "s" : ""} côté joueur, ${rightRemaining} côté adverse.</p>
        <div class="gba-result-actions">
          <button type="button" class="btn-blue" data-action="${escapeHtml(state.mode === "arena-run" && state.postBattleAction?.action ? state.postBattleAction.action : "replayDraftSimpleBattleDevDuel")}">${escapeHtml(state.mode === "arena-run" && state.postBattleAction?.label ? state.postBattleAction.label : "Rejouer")}</button>
          <button type="button" class="btn-ghost" data-action="clearDraftSimpleBattleDevPanel">Retour au Draft</button>
        </div>
      </div>`
    : isEnemyTurn
      ? `<div class="draft-dev-battle-result ${liveResultTone}"><small class="draft-dev-battle-result-kicker">${liveResultKicker}</small><b>Action adverse</b><span>L’adversaire prépare sa réponse.</span></div>`
      : isPlayerTurn
        ? `<div class="draft-dev-battle-result ${liveResultTone}"><small class="draft-dev-battle-result-kicker">${liveResultKicker}</small><b>${escapeHtml(isReplayingTurn ? "Résolution du tour" : canLocalChooseAction ? `${currentActionBattler.pokemon.name} attend ton ordre` : isNetwork ? getDraftSimpleBattleNetworkRoomStatusText(state) : "Tour verrouillé")}</b><span>${escapeHtml(isNetwork ? networkTurnHint : (canLocalChooseAction ? "Choisis une attaque." : isReplayingTurn ? "Le tour se joue. Patiente jusqu’à la fin de la séquence." : "Action enregistrée ou en attente."))}</span></div>`
        : "";

  const switchHtml = needsForcedSwitch
    ? `
      <div class="draft-dev-battle-switch">
        <b>${state.pendingSwitchReason === "manual"
          ? `Choisis le Pokémon à envoyer (${state.pendingSwitchSide === "right" ? "droite" : "gauche"}) :`
          : `Le Pokémon ${state.pendingSwitchSide === "right" ? "droit" : "gauche"} est KO. Choisis le suivant :`}</b>
        ${isNetwork ? `<span class="draft-dev-battle-switch-note">${escapeHtml((state.pendingSwitchSide || "left") === localSide ? "Ton remplacement est requis pour continuer." : "On attend le remplacement de l’autre joueur.")}</span>` : ""}
        <div class="draft-dev-battle-switch-options">
          ${getDraftSimpleBattleAvailableSwitchIndexesForSide(state, state.pendingSwitchSide || "left").map((index) => {
            const member = (state.pendingSwitchSide === "right" ? state.rightTeam : state.leftTeam)[index];
            return `
              <button type="button" class="btn-ghost draft-dev-battle-switch-btn" data-action="chooseDraftSimpleBattleReplacement" data-args='[${index}, "${state.pendingSwitchSide || "left"}"]' ${!canLocalChooseReplacement ? "disabled" : ""}>
                <img class="draft-switch-sprite" src="${escapeHtml(getPokemonSprite(member.pokemon))}" alt="${escapeHtml(member.pokemon.name)}" loading="lazy">
                <span class="draft-switch-name">${escapeHtml(member.pokemon.name)}</span>
                <small class="draft-switch-hp">PV ${member.currentHp} / ${member.maxHp}</small>
              </button>
            `;
          }).join("")}
        </div>
        ${state.pendingSwitchReason === "manual"
          ? `<div class="draft-dev-battle-switch-cancel"><button type="button" class="btn-ghost" data-action="cancelDraftSimpleBattleManualSwitch">Annuler</button></div>`
          : ""}
      </div>
    `
    : "";

  const playerHudHtml = `
    <div class="draft-dev-battle-fighter-head">
      <div class="draft-dev-battle-hud">
        <div class="draft-dev-battle-hud-top">
          <span class="draft-dev-battle-hud-side">Joueur</span>
          <span class="draft-dev-battle-hud-meta">Équipe ${getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex)} restant(s)</span>
        </div>
        <div class="draft-dev-battle-hud-main">
          <b class="draft-dev-battle-hud-name">${escapeHtml(displayLeft.pokemon.name)}</b>
          ${leftStatusLabel ? `<span class="draft-dev-battle-hud-status">${escapeHtml(leftStatusLabel)}</span>` : ""}
        </div>
        <small class="draft-dev-battle-hud-sub">PV ${displayLeft.currentHp} / ${displayLeft.maxHp} • Vitesse ${getDraftSimpleBattleCurrentSpeed(displayLeft)}</small>
        <div class="draft-dev-battle-hp">
          <div class="draft-dev-battle-hp-meta">
            <strong>PV</strong>
            <span>${displayLeft.currentHp} / ${displayLeft.maxHp}</span>
          </div>
          <div class="draft-dev-battle-hp-track">
            <span class="draft-dev-battle-hp-fill${leftHpPercent <= 25 ? " is-low-hp" : ""}" style="width:${leftHpPercent}%"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const foeHudHtml = `
    <div class="draft-dev-battle-fighter-head">
      <div class="draft-dev-battle-hud">
        <div class="draft-dev-battle-hud-top">
          <span class="draft-dev-battle-hud-side">Adversaire</span>
          <span class="draft-dev-battle-hud-meta">Équipe ${getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex)} restant(s)</span>
        </div>
        <div class="draft-dev-battle-hud-main">
          <b class="draft-dev-battle-hud-name">${escapeHtml(displayRight.pokemon.name)}</b>
          ${rightStatusLabel ? `<span class="draft-dev-battle-hud-status">${escapeHtml(rightStatusLabel)}</span>` : ""}
        </div>
        <small class="draft-dev-battle-hud-sub">PV ${displayRight.currentHp} / ${displayRight.maxHp} • Vitesse ${getDraftSimpleBattleCurrentSpeed(displayRight)}</small>
        <div class="draft-dev-battle-hp">
          <div class="draft-dev-battle-hp-meta">
            <strong>PV</strong>
            <span>${displayRight.currentHp} / ${displayRight.maxHp}</span>
          </div>
          <div class="draft-dev-battle-hp-track">
            <span class="draft-dev-battle-hp-fill${rightHpPercent <= 25 ? " is-low-hp" : ""}" style="width:${rightHpPercent}%"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  // LITE-RENDER : pendant une frame d'animation HP (ou autre re-render dans la même phase de replay),
  // ne reconstruit pas body.innerHTML. On met juste à jour le texte et les barres HP — évite le flicker
  // des sprites (recréés à chaque innerHTML).
  const replayLiteKey = state?.visualReplay?.active
    ? `${state.visualReplay.turn || 0}:${state.visualReplay.visibleCount || 0}:${replayPhaseStr}`
    : "";
  if (replayLiteKey && panel.dataset.gbaReplayLiteKey === replayLiteKey && !isFinished) {
    panel.classList.remove("hidden");
    refreshGbaTextbox(sceneText);
    const liteLeftKey = `${state.leftActiveIndex || 0}:${displayLeft?.pokemon?.id || displayLeft?.pokemon?.name || ""}`;
    const liteRightKey = `${state.rightActiveIndex || 0}:${displayRight?.pokemon?.id || displayRight?.pokemon?.name || ""}`;
    refreshGbaHpBars(leftHpPercent, rightHpPercent, liteLeftKey, liteRightKey);
    return;
  }
  panel.dataset.gbaReplayLiteKey = replayLiteKey;

  body.innerHTML = isFinished
    ? `
    <div class="draft-dev-battle-finish-screen">
      ${resultHtml}
    </div>
  `
    : `
    ${state.arena ? `
      <div class="draft-dev-battle-arena-banner is-live">
        <div class="draft-dev-battle-arena-badge">${getDraftBadgeMarkup(state.arena, isFinished ? "finished" : "live")}</div>
        <div>
          <b>${escapeHtml(`Arène ${state.arena.name}`)}</b>
          <span>${escapeHtml(`Champion ${state.arena.name} • Spécialiste ${state.arena.type}`)}</span>
        </div>
      </div>
    ` : ""}
    ${isNetwork ? `
      <div class="draft-dev-battle-network-card is-live">
        <div class="draft-dev-battle-network-head">
          <b>Draft Combat 1v1</b>
          <span class="draft-dev-battle-network-role">${escapeHtml(getDraftSimpleBattleNetworkRoleLabel(state))}</span>
        </div>
        <div class="draft-dev-battle-network-grid">
          <div class="draft-dev-battle-network-item">
            <span>Code room</span>
            <b>${escapeHtml(network.roomCode || "—")}</b>
          </div>
          <div class="draft-dev-battle-network-item">
            <span>État réseau</span>
            <b>${escapeHtml(getDraftSimpleBattleNetworkRoomStatusText(state))}</b>
          </div>
          <div class="draft-dev-battle-network-item">
            <span>Camp local</span>
            <b>${escapeHtml(localSide === "left" ? "Gauche" : "Droite")}</b>
          </div>
          <div class="draft-dev-battle-network-item">
            <span>Autre joueur</span>
            <b>${escapeHtml(networkOpponent?.nickname || "Absent")}</b>
          </div>
        </div>
        <small>${escapeHtml(networkTurnHint)}</small>
      </div>
    ` : ""}
    ${visualFeedback.badges.length ? `
      <div class="draft-dev-battle-event-strip ${isReplayingTurn ? "is-replay" : "is-resting"}">
        ${visualFeedback.badges.map((label) => `<span class="draft-dev-battle-event-badge">${escapeHtml(label)}</span>`).join("")}
      </div>
    ` : ""}
    <div class="gba-battle">
      <div class="gba-battle-scene${gbaSceneExtraClass}">
        <div class="gba-battle-bg"></div>
        <div class="gba-info-box gba-info-foe">
          <div class="gba-info-name-row">
            <span class="gba-info-name">${escapeHtml(displayRight.pokemon.name)}${getGbaStatusBadgeHtml(displayRight.status)}</span>
            <span class="gba-info-level">N.${getGbaBattleLevel(displayRight)}</span>
          </div>
          <div class="gba-info-hp-row">
            <span class="gba-info-hp-label">PV</span>
            <div class="gba-info-hp-bar">
              <span class="gba-info-hp-fill ${rightHpPercent <= 25 ? "is-low" : rightHpPercent <= 50 ? "is-medium" : ""}" style="width:${rightHpPercent}%"></span>
            </div>
          </div>
          ${getGbaPokeballsHtml(state.rightTeam, state.rightActiveIndex)}
        </div>
        <div class="gba-fighter gba-fighter-foe ${rightFighterClass}">
          <img class="gba-sprite gba-sprite-foe" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen/${getPokemonSpriteId(displayRight.pokemon)}.png" alt="${escapeHtml(displayRight.pokemon.name)}" data-fallback="${escapeHtml(getPokemonSprite(displayRight.pokemon))}">
          <div class="gba-platform gba-platform-foe"></div>
        </div>
        <div class="gba-fighter gba-fighter-player ${leftFighterClass}">
          <img class="gba-sprite gba-sprite-player" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${getPokemonSpriteId(displayLeft.pokemon)}.png" alt="${escapeHtml(displayLeft.pokemon.name)}" data-fallback="${escapeHtml(getPokemonSprite(displayLeft.pokemon))}">
          <div class="gba-platform gba-platform-player"></div>
        </div>
        <div class="gba-info-box gba-info-player">
          <div class="gba-info-name-row">
            <span class="gba-info-name">${escapeHtml(displayLeft.pokemon.name)}${getGbaStatusBadgeHtml(displayLeft.status)}</span>
            <span class="gba-info-level">N.${getGbaBattleLevel(displayLeft)}</span>
          </div>
          <div class="gba-info-hp-row">
            <span class="gba-info-hp-label">PV</span>
            <div class="gba-info-hp-bar">
              <span class="gba-info-hp-fill ${leftHpPercent <= 25 ? "is-low" : leftHpPercent <= 50 ? "is-medium" : ""}" style="width:${leftHpPercent}%"></span>
            </div>
          </div>
          <div class="gba-info-hp-numeric">${displayLeft.currentHp}/${displayLeft.maxHp}</div>
          <div class="gba-info-exp-bar">
            <span class="gba-info-exp-fill" style="width:50%"></span>
          </div>
          ${getGbaPokeballsHtml(state.leftTeam, state.leftActiveIndex)}
        </div>
      </div>
      <div class="gba-battle-bottom ${showGbaMenu ? "has-menu" : "no-menu"}">
        <div class="gba-textbox${gbaTextboxToneClass}" role="status" aria-live="polite">
          <span class="gba-textbox-text">${escapeHtml(sceneText)}</span>
          <span class="gba-textbox-arrow" aria-hidden="true">▼</span>
        </div>
        ${gbaMenuHtml}
      </div>
    </div>
    <details class="draft-dev-battle-extras-details">
      <summary>Détails du combat (bancs, statut, ordre, tours)</summary>
      <div class="draft-dev-battle-benches">
        ${renderDraftSimpleBattleBench(state.leftTeam, state.leftActiveIndex, "Banc joueur")}
        ${renderDraftSimpleBattleBench(state.rightTeam, state.rightActiveIndex, state.arena?.name ? `Banc de ${state.arena.name}` : "Banc adverse")}
      </div>
      <div class="draft-dev-battle-meta">
        <div class="draft-summary-card draft-dev-battle-status ${statusClass}"><span>Statut</span><b>${escapeHtml(statusText)}</b></div>
        <div class="draft-summary-card"><span>Ordre du tour</span><b>${escapeHtml(orderLabel)}</b><small>${escapeHtml(orderHint)}</small></div>
        <div class="draft-summary-card"><span>Tours</span><b>${state.log.length}</b></div>
        <div class="draft-summary-card"><span>Vainqueur</span><b>${escapeHtml(winner)}</b></div>
      </div>
    </details>
    ${switchHtml}
    <div class="draft-dev-battle-battlebox" data-combat-ui="${combatUiState}" data-replay-phase="${replayPhase}">
      ${resultHtml ? `<div class="draft-dev-battle-battlebox-message">${resultHtml}</div>` : ""}
      ${isReplayingTurn ? `<div class="draft-dev-battle-extra-action"><button type="button" class="btn-ghost" data-action="requestDraftSimpleBattleReplaySkip">Passer la résolution</button></div>` : ""}
      <details class="draft-dev-battle-log-details"><summary>Historique du combat</summary><div class="draft-dev-battle-log">${actionsHtml || "<p class=\"card-desc\">Aucune action simulée.</p>"}</div></details>
    </div>
  `;

  panel.classList.remove("hidden");
  refreshGbaTextbox(sceneText);
  const leftDisplayKey = `${state.leftActiveIndex || 0}:${displayLeft?.pokemon?.id || displayLeft?.pokemon?.name || ""}`;
  const rightDisplayKey = `${state.rightActiveIndex || 0}:${displayRight?.pokemon?.id || displayRight?.pokemon?.name || ""}`;
  refreshGbaHpBars(leftHpPercent, rightHpPercent, leftDisplayKey, rightDisplayKey);
  maybePlayPhaseSfx(state);
  if (shouldAutoScroll) {
    scrollToDraftSimpleBattlePanel(panel);
  }
  focusDraftSimpleBattlePrimaryActionIfReady(state, panel);
}

function focusDraftSimpleBattlePrimaryActionIfReady(state, panel = document.getElementById("draft-dev-battle-panel")) {
  if (!state || !panel || panel.classList.contains("hidden")) {
    draftSimpleBattleActionFocusKey = "";
    return;
  }

  const network = state.network || {};
  const localSide = network.localSide || "left";
  const isPlayerTurn = state.phase === "battle" && (state.turnState === "left-action" || state.turnState === "right-action");
  const currentActionSide = state.turnState === "right-action" ? "right" : "left";
  const canLocalChooseAction = !isDraftSimpleBattleNetworkMode(state)
    || (localSide === currentActionSide && !network.waitingRemote && !network.resolvingTurn);
  const needsForcedSwitch = state.phase === "battle" && state.pendingSwitchSide && !state.pendingSwitchResolved;
  const canFocusMove = Boolean(isPlayerTurn && canLocalChooseAction && !needsForcedSwitch);
  const canFocusSwitch = Boolean(needsForcedSwitch && (!isDraftSimpleBattleNetworkMode(state) || localSide === state.pendingSwitchSide));
  const canFocusStart = Boolean(state.phase === "preview");

  let selector = "";
  let focusKey = "";

  if (canFocusSwitch) {
    selector = ".draft-dev-battle-switch-option:not([disabled]), .draft-dev-battle-extra-action .btn-ghost:not([disabled])";
    focusKey = `switch:${state.turn}:${state.pendingSwitchSide}:${state.pendingSwitchReason || ""}`;
  } else if (canFocusMove) {
    selector = ".draft-dev-battle-actions .draft-dev-battle-move:not([disabled]), .draft-dev-battle-extra-action .btn-ghost:not([disabled])";
    const submitted = state.pendingTurn?.actions?.[currentActionSide];
    focusKey = `action:${state.turn}:${currentActionSide}:${submitted ? "locked" : "open"}`;
  } else if (canFocusStart) {
    selector = ".draft-dev-battle-preview-cta:not([disabled])";
    focusKey = `preview:${state.mode || "default"}`;
  } else {
    draftSimpleBattleActionFocusKey = "";
    return;
  }

  if (draftSimpleBattleActionFocusKey === focusKey) return;

  const active = document.activeElement;
  const activeIsUseful = !!active && (
    active === panel ||
    panel.contains(active)
  ) && (
    active.tagName === "BUTTON" ||
    active.tagName === "INPUT" ||
    active.tagName === "SELECT" ||
    active.tagName === "TEXTAREA" ||
    active.isContentEditable
  );
  if (activeIsUseful) return;

  draftSimpleBattleActionFocusKey = focusKey;
  window.requestAnimationFrame(() => {
    const target = panel.querySelector(selector);
    if (!target || target.disabled) return;
    const latestActive = document.activeElement;
    const latestActiveIsUseful = !!latestActive && panel.contains(latestActive) && (
      latestActive.tagName === "BUTTON" ||
      latestActive.tagName === "INPUT" ||
      latestActive.tagName === "SELECT" ||
      latestActive.tagName === "TEXTAREA" ||
      latestActive.isContentEditable
    );
    if (latestActiveIsUseful) return;
    target.focus({ preventScroll: true });
  });
}

function clearDraftSimpleBattleDevPanel() {
  if (draftSimpleBattleIntroTimer) {
    clearTimeout(draftSimpleBattleIntroTimer);
    draftSimpleBattleIntroTimer = null;
  }
  if (draftSimpleBattleTurnTimer) {
    clearTimeout(draftSimpleBattleTurnTimer);
    draftSimpleBattleTurnTimer = null;
  }
  if (draftSimpleBattleAutoScrollFrame) {
    cancelAnimationFrame(draftSimpleBattleAutoScrollFrame);
    draftSimpleBattleAutoScrollFrame = null;
  }
  clearDraftSimpleBattleReplay();
  if (draftSimpleBattleDevUiState) {
    if (isDraftSimpleBattleNetworkMode(draftSimpleBattleDevUiState) && multiplayerSocket?.connected) {
      multiplayerSocket.emit("draft-battle:leave-room");
    }
    draftSimpleBattleDevUiState.pendingTurn = null;
    draftSimpleBattleDevUiState.hotseatPendingSide = null;
    draftSimpleBattleDevUiState.visualReplay = null;
  }
  draftBattleNetworkSession = null;
  draftSimpleBattleDevUiState = null;
  draftSimpleBattleActionFocusKey = "";
  if (__gbaTextboxTimer) { clearInterval(__gbaTextboxTimer); __gbaTextboxTimer = null; }
  __gbaTextboxLastText = "";
  __gbaMenuView = "main";
  __gbaLastHpPercent = { left: 100, right: 100 };
  __gbaLastDisplayKey = { left: null, right: null };
  __gbaLastSfxKey = "";
  __gbaLastAnimKey = "";
  const __gbaPanelEl = document.getElementById("draft-dev-battle-panel");
  if (__gbaPanelEl) delete __gbaPanelEl.dataset.gbaReplayLiteKey;
  document.body.classList.remove("draft-battle-open");
  document.getElementById("draft-dev-battle-panel")?.classList.add("hidden");
  document.getElementById("draft-battle-close")?.classList.add("hidden");
}

function startDraftSimpleBattlePreview() {
  if (!draftSimpleBattleDevUiState) return null;
  if (isDraftSimpleBattleNetworkMode(draftSimpleBattleDevUiState)) {
    const network = getDraftSimpleBattleNetworkMeta(draftSimpleBattleDevUiState);
    if (!network.isHost || (network.players || []).length < 2) return null;
    draftSimpleBattleDevUiState.showPreview = false;
    draftSimpleBattleDevUiState.showIntro = false;
    draftSimpleBattleDevUiState.turnState = "left-action";
    draftSimpleBattleDevUiState.sceneMessage = `${draftSimpleBattleDevUiState.left?.pokemon?.name || "Le Pokémon gauche"} entre au combat face à ${draftSimpleBattleDevUiState.right?.pokemon?.name || "l’adversaire"} !`;
    commitDraftSimpleBattleNetworkState(draftSimpleBattleDevUiState);
    renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
    return draftSimpleBattleDevUiState;
  }
  draftSimpleBattleDevUiState.showPreview = false;
  draftSimpleBattleDevUiState.showIntro = true;
  draftSimpleBattleDevUiState.sceneMessage = `${draftSimpleBattleDevUiState.left?.pokemon?.name || "Ton Pokémon"} entre au combat face à ${draftSimpleBattleDevUiState.right?.pokemon?.name || "l’adversaire"} !`;
  playBattleStartTransition();
  renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
  playPokemonCry(draftSimpleBattleDevUiState.right?.pokemon);
  setTimeout(() => playPokemonCry(draftSimpleBattleDevUiState?.left?.pokemon), 650);
  if (draftSimpleBattleIntroTimer) clearTimeout(draftSimpleBattleIntroTimer);
  draftSimpleBattleIntroTimer = setTimeout(() => {
    if (!draftSimpleBattleDevUiState) return;
    draftSimpleBattleDevUiState.showIntro = false;
    draftSimpleBattleDevUiState.turnState = "left-action";
    renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
    draftSimpleBattleIntroTimer = null;
  }, 1000);
  return draftSimpleBattleDevUiState;
}

function finishDraftSimpleBattleDevTurn(state, turnEntry) {
  const leftRemaining = getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex);
  const rightRemaining = getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex);
  state.turn += 1;
  state.phase = leftRemaining <= 0 || rightRemaining <= 0 ? "finished" : "ready";
  state.pendingTurn = null;
  state.queuedTurn = null;
  clearDraftSimpleBattleTurnFlags(state);
  if (state.phase === "finished") {
    state.pendingSwitch = false;
    state.pendingSwitchReason = null;
    state.pendingSwitchSide = null;
    state.hotseatPendingSide = null;
    state.sceneMessage = `${getDraftSimpleBattleTeamWinnerLabel(state)} gagne le match avec ${getDraftSimpleBattleWinnerName(state)}.`;
  } else if (state.left && state.left.currentHp <= 0) {
    const hasForcedReplacement = getDraftSimpleBattleAvailableSwitchIndexesForSide(state, "left").length > 0;
    state.pendingSwitch = hasForcedReplacement;
    state.pendingSwitchReason = hasForcedReplacement ? "ko" : null;
    state.pendingSwitchSide = hasForcedReplacement ? "left" : null;
    if (hasForcedReplacement && isDraftSimpleBattleLocalHotseat(state)) {
      state.turnState = "hotseat-transition";
      state.hotseatPendingSide = "left";
      state.sceneMessage = "Le Pokémon gauche est KO. Passe au joueur gauche.";
    } else {
      state.sceneMessage = hasForcedReplacement
        ? "Le Pokémon gauche tombe KO. Choisis vite le remplaçant."
        : state.sceneMessage;
    }
  } else if (state.right && state.right.currentHp <= 0 && isDraftSimpleBattleHumanControlled(state, "right")) {
    const hasForcedReplacement = getDraftSimpleBattleAvailableSwitchIndexesForSide(state, "right").length > 0;
    state.pendingSwitch = hasForcedReplacement;
    state.pendingSwitchReason = hasForcedReplacement ? "ko" : null;
    state.pendingSwitchSide = hasForcedReplacement ? "right" : null;
    if (hasForcedReplacement && isDraftSimpleBattleLocalHotseat(state)) {
      state.turnState = "hotseat-transition";
      state.hotseatPendingSide = "right";
      state.sceneMessage = "Le Pokémon droit est KO. Passe au joueur droit.";
    } else {
      state.sceneMessage = hasForcedReplacement
        ? "Le Pokémon droit tombe KO. Choisis vite le remplaçant."
        : state.sceneMessage;
    }
  } else if (state.pendingSwitch) {
    state.sceneMessage = state.pendingSwitchSide === "right"
      ? "Le Pokémon droit tombe KO. Choisis vite le remplaçant."
      : "Le Pokémon gauche tombe KO. Choisis vite le remplaçant.";
  } else {
    state.pendingSwitch = false;
    state.pendingSwitchReason = null;
    state.pendingSwitchSide = null;
    state.hotseatPendingSide = null;
    state.sceneMessage = "";
  }
  if (state.phase === "finished") {
    state.turnState = "finished";
  } else if (state.turnState === "hotseat-transition") {
    // keep transition state set above
  } else {
    state.turnState = state.pendingSwitch ? "switch" : "left-action";
  }
  if (turnEntry && !turnEntry.order?.length) {
    turnEntry.order = ["left", "right"];
  }
  syncDraftSimpleBattleActiveBattlers(state);
  clearDraftSimpleBattleReplay(state);
  renderDraftSimpleBattleDevPanel(state);
  if (turnEntry?.actions?.length) {
    startDraftSimpleBattleTurnReplay(state, turnEntry);
  }
  if (state.phase === "finished" && !state.finishHandled && typeof state.onFinish === "function") {
    state.finishHandled = true;
    state.onFinish(state);
    renderDraftSimpleBattleDevPanel(state);
  }
  return state;
}

function chooseDraftSimpleBattleReplacement(teamIndex, side = null, options = {}) {
  const state = draftSimpleBattleDevUiState;
  if (!state || !state.pendingSwitch || state.phase === "finished") return null;
  const replacementSide = side || state.pendingSwitchSide || "left";
  const nextIndex = Number(teamIndex);
  const team = replacementSide === "right" ? state.rightTeam : state.leftTeam;
  const activeIndex = replacementSide === "right" ? state.rightActiveIndex : state.leftActiveIndex;
  const nextMember = team[nextIndex];
  if (!Number.isInteger(nextIndex) || !nextMember || nextMember.currentHp <= 0 || nextIndex === activeIndex) return null;
  playGbaMenuBlip();

  const switchReason = state.pendingSwitchReason;
  state.pendingSwitch = false;
  state.pendingSwitchReason = null;
  state.pendingSwitchSide = null;
  state.pendingTurn = null;
  state.queuedTurn = null;
  state.turnState = switchReason === "manual" ? "resolving" : "left-action";

  if (isDraftSimpleBattleNetworkMode(state) && !options.bypassNetwork) {
    if (switchReason === "manual") {
      state.pendingSwitch = false;
      state.pendingSwitchReason = null;
      state.pendingSwitchSide = null;
      state.turnState = replacementSide === "right" ? "right-action" : "left-action";
      return submitDraftSimpleBattleNetworkAction(state, replacementSide, {
        kind: "switch",
        teamIndex: nextIndex,
        pokemonName: nextMember.pokemon.name,
      }, { source: "player" });
    }
    return submitDraftSimpleBattleNetworkReplacement(state, replacementSide, nextIndex);
  }

  if (switchReason === "manual" && state.phase !== "finished") {
    // Règle : switch manuel = pas de tour adversaire auto. On exécute juste le switch
    // et on rend la main au joueur (équivalent d'un swap "gratuit" comme dans certaines
    // règles maison).
    const switched = executeDraftSimpleBattleSwitch(state, replacementSide, nextIndex, {
      reason: "manual-switch",
      forced: false,
    });
    if (!switched) return null;
    state.sceneMessage = `${switched.pokemon.name} entre au combat !`;
    state.turnState = replacementSide === "left" ? "left-action" : "right-action";
    renderDraftSimpleBattleDevPanel(state);
    return state;
  }

  const switched = executeDraftSimpleBattleSwitch(state, replacementSide, nextIndex, {
    reason: "forced-ko",
    forced: true,
  });
  if (!switched) return null;
  state.sceneMessage = `${switched.pokemon.name} rejoint le terrain !`;
  state.turnState = "left-action";
  renderDraftSimpleBattleDevPanel(state);
  return state;
}

function openDraftSimpleBattleManualSwitch(side = null) {
  const state = draftSimpleBattleDevUiState;
  if (!state || state.phase === "finished" || state.pendingSwitch) return null;
  const switchSide = side || getDraftSimpleBattleCurrentActionSide(state);
  if (isDraftSimpleBattleNetworkMode(state) && getDraftSimpleBattleNetworkLocalSide(state) !== switchSide) return null;
  const expectedTurnState = switchSide === "right" ? "right-action" : "left-action";
  if (state.turnState !== expectedTurnState) return null;
  if (!getDraftSimpleBattleAvailableSwitchIndexesForSide(state, switchSide).length) return null;

  state.pendingSwitch = true;
  state.pendingSwitchReason = "manual";
  state.pendingSwitchSide = switchSide;
  state.sceneMessage = switchSide === "right"
    ? "Choisis un autre Pokémon à droite : ce changement consommera ton tour."
    : "Choisis un autre Pokémon à gauche : ce changement consommera ton tour.";
  state.log.push({ turn: state.turn, order: ["left", "right"], actions: [] });
  renderDraftSimpleBattleDevPanel(state);
  return state;
}

function cancelDraftSimpleBattleManualSwitch() {
  const state = draftSimpleBattleDevUiState;
  if (!state || state.phase === "finished" || !state.pendingSwitch || state.pendingSwitchReason !== "manual") return null;
  const switchSide = state.pendingSwitchSide || "left";
  state.pendingSwitch = false;
  state.pendingSwitchReason = null;
  state.pendingSwitchSide = null;
  state.pendingTurn = null;
  state.queuedTurn = null;
  state.hotseatPendingSide = null;
  state.turnState = switchSide === "right" ? "right-action" : "left-action";
  state.sceneMessage = switchSide === "right"
    ? `${state.right?.pokemon?.name || "Le Pokémon droit"} reste au combat.`
    : `${state.left?.pokemon?.name || "Le Pokémon gauche"} reste au combat.`;
  if (state.log.length) {
    const lastTurn = state.log[state.log.length - 1];
    if (lastTurn && Array.isArray(lastTurn.actions) && lastTurn.actions.length === 0) {
      state.log.pop();
    }
  }
  renderDraftSimpleBattleDevPanel(state);
  return state;
}

function chooseDraftSimpleBattleEnemyReplacement(state) {
  const options = getDraftSimpleBattleAvailableEnemySwitchIndexes(state);
  if (!options.length) return null;
  const player = state?.left;
  const ranked = options
    .map((teamIndex) => {
      const battler = state.rightTeam[teamIndex];
      return {
        teamIndex,
        battler,
        pressure: getDraftSimpleBattleBestMoveScore(state.gen, battler, player),
      };
    })
    .sort((a, b) => b.pressure - a.pressure);
  return ranked[0]?.teamIndex ?? options[0];
}

function runDraftSimpleBattleDevTurn(moveIndex = 0, side = null) {
  if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState.phase === "finished" || draftSimpleBattleDevUiState.pendingSwitch) return null;

  const state = draftSimpleBattleDevUiState;
  const actionSide = side || getDraftSimpleBattleCurrentActionSide(state);
  if (isDraftSimpleBattleNetworkMode(state) && getDraftSimpleBattleNetworkLocalSide(state) !== actionSide) return null;
  const expectedTurnState = actionSide === "right" ? "right-action" : "left-action";
  if (state.turnState !== expectedTurnState) return null;
  __gbaMenuView = "main";
  playGbaBeep(540, 50, 0.035, "triangle");
  prepareDraftSimpleBattleQueuedTurn(state, {
    kind: "move",
    moveIndex,
  });
  return state.queuedTurn ? scheduleDraftSimpleBattleTurnResolution(state) : state;
}

function runDraftSimpleBattleDevStruggle(side = null) {
  if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState.phase === "finished" || draftSimpleBattleDevUiState.pendingSwitch) return null;
  const state = draftSimpleBattleDevUiState;
  const actionSide = side || getDraftSimpleBattleCurrentActionSide(state);
  if (isDraftSimpleBattleNetworkMode(state) && getDraftSimpleBattleNetworkLocalSide(state) !== actionSide) return null;
  const expectedTurnState = actionSide === "right" ? "right-action" : "left-action";
  if (state.turnState !== expectedTurnState) return null;
  __gbaMenuView = "main";
  prepareDraftSimpleBattleQueuedTurn(state, { kind: "struggle" });
  return state.queuedTurn ? scheduleDraftSimpleBattleTurnResolution(state) : state;
}

function runDraftSimpleBattleDraftConversionDevVisualTest() {
  if (draftArenaState?.team?.length >= DRAFT_TEAM_SIZE && (draftArenaState.phase === "battle" || draftArenaState.phase === "result")) {
    return launchDraftArenaBattle();
  }

  const screen = document.getElementById("screen-draft-arena");
  if (!screen || screen.classList.contains("hidden")) {
    console.warn("Ouvre d'abord l'écran Draft Arènes pour voir le panneau de dev.");
  }

  const { playerDraftTeam, enemyDraftTeam } = getDraftSimpleBattleDevEntries();
  const state = createDraftSimpleBattleDevUiState(playerDraftTeam, enemyDraftTeam, {
    mode: "dev",
    title: "Combat Draft",
  });
  if (!state) {
    console.warn("Impossible de construire la simulation de dev.");
    return null;
  }

  draftSimpleBattleDevUiState = state;
  draftSimpleBattleDevUiState.showPreview = true;
  draftSimpleBattleDevUiState.showIntro = false;
  renderDraftSimpleBattleDevPanel(state);
  document.getElementById("draft-battle-close")?.classList.remove("hidden");
  console.log("Draft Simple Battle Dev Duel", {
    left: state.left.pokemon.name,
    right: state.right.pokemon.name,
    moves: state.left.moves.map((move) => move.name),
  });
  return state;
}

function runDraftSimpleBattleLocalPvpTest() {
  const { playerDraftTeam, enemyDraftTeam } = getDraftSimpleBattleDevEntries();
  const state = createDraftSimpleBattleDevUiState(playerDraftTeam, enemyDraftTeam, {
    mode: "local-pvp",
    title: "Draft Combat Local 1v1",
    controllers: {
      left: "human",
      right: "human",
    },
  });
  if (!state) return null;
  draftSimpleBattleDevUiState = state;
  state.showPreview = false;
  state.showIntro = false;
  state.turnState = "left-action";
  state.sceneMessage = "Mode local 1v1 : joueur gauche, choisis ton action.";
  renderDraftSimpleBattleDevPanel(state);
  document.getElementById("draft-battle-close")?.classList.remove("hidden");
  return state;
}

function hostDraftSimpleBattleNetworkRoom() {
  const socket = ensureMultiplayerSocket();
  const baseState = draftSimpleBattleDevUiState?.showPreview
    ? draftSimpleBattleDevUiState
    : runDraftSimpleBattleDraftConversionDevVisualTest();
  if (!socket?.connected || !baseState) return null;
  if (draftBattleNetworkSession?.room?.code) {
    socket.emit("draft-battle:leave-room");
    draftBattleNetworkSession = null;
  }

  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour la room Draft Combat :", playerProfile.nickname || "Joueur 1") || "") || "Joueur 1";
  const state = hydrateDraftSimpleBattleNetworkState(cloneDraftSimpleBattleNetworkState(baseState), {
    enabled: true,
    localSide: "left",
    isHost: true,
    players: [],
    pendingTurn: null,
    pendingReplacement: null,
    waitingRemote: false,
  });
  if (!state) return null;
  state.mode = "network-pvp";
  state.title = "Draft Combat 1v1";
  state.controllers.left = "human";
  state.controllers.right = "human";
  state.showPreview = true;
  state.showIntro = false;
  state.turnState = "left-action";
  state.sceneMessage = "Room réseau en cours de création...";
  draftSimpleBattleDevUiState = state;
  renderDraftSimpleBattleDevPanel(state);

  socket.emit("draft-battle:create-room", {
    nickname,
    battleState: cloneDraftSimpleBattleNetworkState(state),
  }, (response = {}) => {
    if (!response.ok) {
      state.sceneMessage = response.error || "Impossible de créer la room réseau.";
      renderDraftSimpleBattleDevPanel(state);
      return;
    }
    const room = response.room || null;
    state.network = buildDraftSimpleBattleNetworkMetaFromRoom(room, state);
    state.sceneMessage = `Room ${room?.code || ""} créée. Partage le code au second joueur.`;
    draftBattleNetworkSession = { room };
    renderDraftSimpleBattleDevPanel(state);
  });
  return state;
}

async function openDraftFriendBattle() {
  if (!draftArenaState || draftArenaState.team.length < DRAFT_TEAM_SIZE) {
    showToast("Drafte d'abord 6 Pokémon avant d'affronter un ami.");
    return null;
  }
  // Ouvre la preview avec la team du joueur (mode arena-run, on bascule en network juste après)
  await launchDraftArenaBattle();
  if (!draftSimpleBattleDevUiState) return null;
  // Bascule en mode network-pvp et crée la room
  return hostDraftSimpleBattleNetworkRoom();
}

function joinDraftSimpleBattleNetworkRoom() {
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return null;
  if (draftBattleNetworkSession?.room?.code) {
    socket.emit("draft-battle:leave-room");
    draftBattleNetworkSession = null;
  }
  const code = String(window.prompt("Code de room Draft Combat :", "") || "").trim().toUpperCase();
  if (!code) return null;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour rejoindre le combat :", playerProfile.nickname || "Joueur 2") || "") || "Joueur 2";
  socket.emit("draft-battle:join-room", {
    code,
    nickname,
  }, (response = {}) => {
    if (!response.ok) {
      showToast(response.error || "Impossible de rejoindre la room.");
    }
  });
  return true;
}

window.runDraftSimpleBattleDevTests = runDraftSimpleBattleDevTests;
window.runDraftSimpleBattleDraftConversionDevTest = runDraftSimpleBattleDraftConversionDevTest;
window.runDraftSimpleBattleDraftConversionDevVisualTest = runDraftSimpleBattleDraftConversionDevVisualTest;
window.runDraftSimpleBattleLocalPvpTest = runDraftSimpleBattleLocalPvpTest;
window.hostDraftSimpleBattleNetworkRoom = hostDraftSimpleBattleNetworkRoom;
window.joinDraftSimpleBattleNetworkRoom = joinDraftSimpleBattleNetworkRoom;
window.openDraftFriendBattle = openDraftFriendBattle;
window.createDraftScoreAttackRoom = createDraftScoreAttackRoom;
window.joinDraftScoreAttackRoom = joinDraftScoreAttackRoom;
window.leaveDraftScoreAttackRoom = leaveDraftScoreAttackRoom;
window.continueDraftSimpleBattleHotseat = continueDraftSimpleBattleHotseat;
window.launchDraftArenaBattle = launchDraftArenaBattle;
window.continueDraftArenaBattleRun = continueDraftArenaBattleRun;
window.finishDraftArenaBattleView = finishDraftArenaBattleView;
window.selectDraftSimpleBattlePreviewLead = selectDraftSimpleBattlePreviewLead;
window.runDraftSimpleBattleDevTurn = runDraftSimpleBattleDevTurn;
window.runDraftSimpleBattleDevStruggle = runDraftSimpleBattleDevStruggle;
window.startDraftSimpleBattlePreview = startDraftSimpleBattlePreview;
window.openDraftSimpleBattleManualSwitch = openDraftSimpleBattleManualSwitch;
window.cancelDraftSimpleBattleManualSwitch = cancelDraftSimpleBattleManualSwitch;
window.chooseDraftSimpleBattleReplacement = chooseDraftSimpleBattleReplacement;
window.replayDraftSimpleBattleDevDuel = replayDraftSimpleBattleDevDuel;
window.clearDraftSimpleBattleDevPanel = clearDraftSimpleBattleDevPanel;


async function getDraftPokemonPowerData(pokemon) {
  const key = getDraftPowerCacheKey(pokemon);
  if (DRAFT_POWER_CACHE.has(key)) return DRAFT_POWER_CACHE.get(key);
  const stats = await fetchBattleStats(pokemon);
  const metrics = buildDraftPowerMetrics(pokemon, stats);
  DRAFT_POWER_CACHE.set(key, metrics);
  return metrics;
}

function getDraftPoolForGeneration(gen) {
  const cfg = DRAFT_GEN_OPTIONS.find((g) => g.gen === gen);
  if (!cfg) return [];

  return getPokemonUiList({ gens: [cfg.gen] }).filter(Boolean);
}

function pickRandomUniquePokemon(pool, count, excludeDexIds = new Set()) {
  const source = pool.filter((p) => !excludeDexIds.has(getDraftPoolEntryKey(p)));
  const out = [];

  while (source.length && out.length < count) {
    const idx = Math.floor(Math.random() * source.length);
    out.push(source[idx]);
    source.splice(idx, 1);
  }

  return out;
}

function getDraftWeightedChance(power) {
  // Draft weighting is intentionally centered on medium-power Pokemon:
  // - weak picks can still appear, but should not flood every wave
  // - medium picks are the most common draft backbone
  // - very strong picks stay possible, but much rarer
  const normalized = clampDraftValue(Number(power) || 0, 35, 110);

  if (normalized <= 48) {
    return 0.48;
  }
  if (normalized <= 58) {
    return 0.72;
  }
  if (normalized <= 72) {
    return 1;
  }
  if (normalized <= 82) {
    return 0.7;
  }
  if (normalized <= 92) {
    return 0.36;
  }
  return 0.15;
}

function pickWeightedDraftPokemon(pool, excludeDexIds = new Set(), options = {}) {
  const heavyThreatCount = Number(options.heavyThreatCount) || 0;
  const source = pool
    .filter((pokemon) => !excludeDexIds.has(getDraftPoolEntryKey(pokemon)))
    .map((pokemon) => {
      const power = getDraftCachedPokemonPowerData(pokemon).power;
      let weight = getDraftWeightedChance(power);

      // Once a wave already contains a very strong threat, heavily reduce the
      // chance of drawing another one. This keeps "wow" picks possible while
      // avoiding waves dominated by multiple huge threats too often.
      if (power >= 88 && heavyThreatCount >= 1) {
        weight *= 0.18;
      } else if (power >= 82 && heavyThreatCount >= 1) {
        weight *= 0.45;
      }

      return { pokemon, weight };
    })
    .filter((entry) => entry.weight > 0);

  if (!source.length) return null;

  const totalWeight = source.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of source) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.pokemon;
    }
  }
  return source[source.length - 1]?.pokemon || null;
}

function buildDraftWeightedWave(pool, count, excludeDexIds = new Set()) {
  const picks = [];
  const usedDexIds = new Set(excludeDexIds);
  let heavyThreatCount = 0;

  while (picks.length < count) {
    const picked = pickWeightedDraftPokemon(pool, usedDexIds, { heavyThreatCount });
    if (!picked) break;
    usedDexIds.add(getDraftPoolEntryKey(picked));
    picks.push(picked);
    if (getDraftCachedPokemonPowerData(picked).power >= 82) {
      heavyThreatCount += 1;
    }
  }

  return picks;
}

function createDraftOptionEntry(pokemon, locked = false, shiny = Math.random() < DRAFT_SHINY_CHANCE) {
  return {
    pokemon,
    shiny,
    locked,
  };
}

function warmDraftPokemonMetrics(pokemonList) {
  const snapshot = draftArenaState;
  Promise.all((pokemonList || []).map((pokemon) => getDraftPokemonPowerData(pokemon)))
    .then(() => {
      const activeDraftScreen = document.getElementById(snapshot?.mode === "scoreAttack" ? "screen-draft-score-attack" : "screen-draft-arena");
      if (snapshot && snapshot === draftArenaState && activeDraftScreen && !activeDraftScreen.classList.contains("hidden")) {
        renderDraftArena();
      }
    })
    .catch(() => {
      // noop
    });
}

function fillDraftArenaOptions() {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  draftArenaState.options.forEach((option) => {
    if (option?.pokemon) excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
  });

  const missingCount = Math.max(0, DRAFT_PICK_COUNT - draftArenaState.options.length);
  const weightedWave = buildDraftWeightedWave(pool, missingCount, excludeDexIds);
  for (const pokemon of weightedWave) {
    draftArenaState.options.push(createDraftOptionEntry(pokemon));
  }

  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function replaceDraftArenaOption(optionIndex) {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);

  draftArenaState.options = draftArenaState.options.map((option, index) => {
    if (!option?.pokemon) return option;
    if (index === optionIndex) {
      excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
      return createDraftOptionEntry(option.pokemon, true, option.shiny);
    }
    return option;
  });

  const unlockedIndexes = [];
  for (let index = 0; index < draftArenaState.options.length; index += 1) {
    const option = draftArenaState.options[index];
    if (!option || option.locked) continue;
    unlockedIndexes.push(index);
  }

  const replacements = buildDraftWeightedWave(pool, unlockedIndexes.length, excludeDexIds);
  unlockedIndexes.forEach((index, replacementIndex) => {
    const replacement = replacements[replacementIndex];
    if (!replacement) return;
    draftArenaState.options[index] = createDraftOptionEntry(replacement);
  });
  warmDraftPokemonMetrics([
    ...draftArenaState.options.filter(Boolean).map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function rerollDraftScoreAttackWave() {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft") return;
  // Mode duel synchronisé : router vers le serveur (host only)
  if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom) {
    const socket = ensureMultiplayerSocket();
    if (!socket?.connected) return;
    socket.emit("draft-score:reroll-duel-wave", {}, (response = {}) => {
      if (!response.ok && draftArenaState) {
        draftArenaState.scoreAttackRoomError = response.error || "Reroll refusé.";
        renderDraftArena();
      }
    });
    return;
  }
  if (draftArenaState.scoreAttackRerollsLeft <= 0) {
    draftArenaState.message = "Plus de relance disponible pour cette tentative Score Attack.";
    return renderDraftArena();
  }
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  draftArenaState.options = buildDraftWeightedWave(pool, DRAFT_PICK_COUNT, excludeDexIds).map((pokemon) => createDraftOptionEntry(pokemon));
  draftArenaState.scoreAttackRerollsLeft -= 1;
  draftArenaState.message = `Relance utilisée. Encore ${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}.`;
  emitDraftScoreAttackProgress();
  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
  renderDraftArena();
}

function rerollDraftScoreAttackOption(pokemonId) {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft") return;
  if (draftArenaState.scoreAttackRerollsLeft <= 0) {
    draftArenaState.message = "Plus de relance disponible. Lance le mode classique pour reset.";
    return renderDraftArena();
  }
  const optionIndex = draftArenaState.options.findIndex((option) => option.pokemon.id === pokemonId);
  if (optionIndex < 0) return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  for (const option of draftArenaState.options) {
    if (option && option.pokemon && option.pokemon.id !== pokemonId) {
      excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
    }
  }
  const replacement = buildDraftWeightedWave(pool, 1, excludeDexIds)[0];
  if (!replacement) {
    draftArenaState.message = "Pool épuisé pour reroll individuel.";
    return renderDraftArena();
  }
  draftArenaState.options[optionIndex] = createDraftOptionEntry(replacement);
  draftArenaState.scoreAttackRerollsLeft -= 1;
  draftArenaState.message = `Option remplacée. Encore ${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}.`;
  emitDraftScoreAttackProgress();
  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
  renderDraftArena();
}

function getDraftScoreAttackRecord(gen) {
  if (!playerProfile || !gen) return 0;
  const records = playerProfile.draftScoreAttackRecords || {};
  return Number(records[gen]) || 0;
}

function updateDraftScoreAttackRecord(gen, average) {
  if (!playerProfile || !gen) return false;
  playerProfile.draftScoreAttackRecords = playerProfile.draftScoreAttackRecords || {};
  const prev = Number(playerProfile.draftScoreAttackRecords[gen]) || 0;
  if (average > prev) {
    playerProfile.draftScoreAttackRecords[gen] = average;
    try { saveProfile(); } catch (_e) {}
    return true;
  }
  return false;
}

function getDraftScoreAttackRoomSelf(room = draftArenaState?.scoreAttackRoom) {
  return room?.players?.find((player) => player.isSelf) || null;
}

function emitDraftScoreAttackProgress() {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom) return;
  if (!multiplayerSocket?.connected) return;
  const team = draftArenaState.team
    .filter((entry) => entry?.pokemon)
    .slice(0, DRAFT_TEAM_SIZE)
    .map((entry) => ({
      id: Number(entry.pokemon.id) || 0,
      name: entry.pokemon.name,
      bst: Number(getDraftCachedPokemonPowerData(entry.pokemon).statGlobal) || 0,
      shiny: Boolean(entry.shiny),
    }));
  const metrics = getDraftTeamBstMetrics(draftArenaState.team);
  multiplayerSocket.emit("draft-score:pick-progress", {
    team,
    average: metrics.average || 0,
    total: metrics.total || 0,
    rerollsLeft: Math.max(0, Number(draftArenaState.scoreAttackRerollsLeft ?? DRAFT_SCORE_ATTACK_REROLLS)),
  });
}

function getDraftScoreAttackRoomOpponent(room = draftArenaState?.scoreAttackRoom) {
  return room?.players?.find((player) => !player.isSelf) || null;
}

function applyDraftScoreAttackRoomState(roomState) {
  if (!draftArenaState) return;
  const prevRoom = draftArenaState.scoreAttackRoom;
  const prevStatus = prevRoom?.status || null;
  const prevDuelGen = prevRoom?.duel?.gen ?? null;
  const prevWaveIndex = Number(prevRoom?.duel?.waveIndex) || 0;
  const prevLastEventAt = Number(prevRoom?.duel?.lastEvent?.at) || 0;
  // Détecter un nouveau pick adverse → toast notification
  const newEvent = roomState?.duel?.lastEvent;
  if (newEvent && newEvent.kind === "pick" && Number(newEvent.at) > prevLastEventAt) {
    const self = getDraftScoreAttackRoomSelf(roomState);
    if (self && newEvent.side && newEvent.side !== self.side) {
      const opp = roomState.players?.find((p) => !p.isSelf);
      showDraftScoreOpponentToast(`⚡ ${opp?.nickname || "Adversaire"} a choisi !`);
    }
  }
  draftArenaState.scoreAttackRoom = roomState || null;
  draftArenaState.scoreAttackRoomPending = null;
  draftArenaState.scoreAttackRoomError = null;
  const self = getDraftScoreAttackRoomSelf(roomState);
  draftArenaState.scoreAttackSubmitted = Boolean(self?.hasSubmitted);
  // Détection nouveau duel après une partie finie (relance) → fermer la finale + reset
  const newGen = roomState?.duel?.gen ?? null;
  const newStatus = roomState?.status || null;
  const newWaveIndex = Number(roomState?.duel?.waveIndex) || 0;
  const isFreshDuel = newStatus === "live" && (
    prevStatus === "finished"
    || (newGen !== null && prevDuelGen !== null && newGen !== prevDuelGen)
    || (newWaveIndex === 0 && prevWaveIndex > 0)
  );
  if (isFreshDuel) {
    document.getElementById("draft-score-finale-overlay")?.remove();
    draftScoreFinaleShownFor = null;
  }
  // Mode pool indépendant : on ne synchronise PAS le state local depuis le serveur duel.
  // Le panneau VS lit la progression de l'autre via room.players[].progress (envoyé après chaque pick local)
  draftArenaState.duelMode = false;
  if (draftArenaState.mode === "scoreAttack") renderDraftArena();
  maybeShowDraftScoreFinale(roomState);
}

function syncDraftDuelStateFromServer(roomState) {
  if (!draftArenaState || !roomState?.duel) return;
  draftArenaState.duelMode = true;
  draftArenaState.selectedGen = Number(roomState.duel.gen) || draftArenaState.selectedGen;
  draftArenaState.phase = roomState.status === "finished" ? "result" : "draft";
  const self = getDraftScoreAttackRoomSelf(roomState);
  const selfSide = self?.side || "left";
  // Update team from server duel teams
  const serverTeam = roomState.duel.teams?.[selfSide] || [];
  draftArenaState.team = serverTeam.map((entry) => {
    const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
    return pokemon ? { pokemon, shiny: false } : null;
  }).filter(Boolean);
  draftArenaState.selectedDexIds = new Set(serverTeam.map((entry) => String(entry.id)));
  // Update options from currentWave
  const wave = roomState.duel.currentWave || [];
  draftArenaState.options = wave.map((entry) => {
    const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
    return pokemon ? createDraftOptionEntry(pokemon, false, false) : null;
  }).filter(Boolean);
  // Has self picked this wave ?
  const pendingSides = Array.isArray(roomState.duel.pendingSides) ? roomState.duel.pendingSides : [];
  draftArenaState.duelPendingSelf = pendingSides.includes(selfSide);
  draftArenaState.duelWaveIndex = Number(roomState.duel.waveIndex) || 0;
  draftArenaState.duelPicksRemaining = roomState.duel.picksRemaining || { left: 6, right: 6 };
  // Préchargement des vraies stats (PokéAPI) pour les options + l'équipe → évite BST fallback approximatif
  warmDraftPokemonMetrics([
    ...draftArenaState.options.filter(Boolean).map((opt) => opt.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function startDraftScoreDuel(gen) {
  trackUsage("solo:scoreattack");
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected || !draftArenaState) return;
  socket.emit("draft-score:start-duel", { gen: Number(gen) }, (response = {}) => {
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de lancer le duel.";
      renderDraftArena();
    }
  });
}

async function pickDraftScoreDuelOption(pokemonId) {
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected || !draftArenaState) return;
  const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(pokemonId));
  if (!pokemon) return;
  // S'assurer d'avoir le vrai BST (PokéAPI) avant d'envoyer, sinon le serveur stockera un fallback approximatif
  let bst = Number(getDraftCachedPokemonPowerData(pokemon).statGlobal) || 0;
  if (bst < 200 || bst > 800) {
    try {
      const data = await getDraftPokemonPowerData(pokemon);
      bst = Number(data?.statGlobal) || bst;
    } catch (_e) { /* on continue avec le fallback */ }
  }
  socket.emit("draft-score:pick-option", { pokemonId: Number(pokemonId), bst }, (response = {}) => {
    if (!response.ok && draftArenaState) {
      draftArenaState.scoreAttackRoomError = response.error || "Pick refusé.";
      renderDraftArena();
    }
  });
}

function createDraftScoreAttackRoom() {
  if (!draftArenaState) return;
  draftArenaState.mode = "scoreAttack";
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour la room Score Attack :", playerProfile.nickname || "Joueur 1") || "") || "Joueur 1";
  draftArenaState.scoreAttackRoomPending = "create";
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
  socket.emit("draft-score:create-room", { nickname }, (response = {}) => {
    draftArenaState.scoreAttackRoomPending = null;
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de créer la room Score Attack.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

function joinDraftScoreAttackRoom() {
  if (!draftArenaState) return;
  draftArenaState.mode = "scoreAttack";
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const code = String(window.prompt("Code de room Score Attack :", "") || "").trim().toUpperCase();
  if (!code) return;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour rejoindre le Score Attack :", playerProfile.nickname || "Joueur 2") || "") || "Joueur 2";
  draftArenaState.scoreAttackRoomPending = "join";
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
  socket.emit("draft-score:join-room", { code, nickname }, (response = {}) => {
    draftArenaState.scoreAttackRoomPending = null;
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de rejoindre la room Score Attack.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

function leaveDraftScoreAttackRoom() {
  if (multiplayerSocket?.connected) multiplayerSocket.emit("draft-score:leave-room");
  if (!draftArenaState) return;
  draftArenaState.scoreAttackRoom = null;
  draftArenaState.scoreAttackSubmitted = false;
  draftArenaState.scoreAttackRoomPending = null;
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
}

function submitDraftScoreAttackResult(metrics = null) {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom || draftArenaState.scoreAttackSubmitted) return;
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const finalMetrics = metrics || getDraftTeamBstMetrics(draftArenaState.team);
  const team = draftArenaState.team
    .filter((entry) => entry?.pokemon)
    .slice(0, DRAFT_TEAM_SIZE)
    .map((entry) => ({
      id: Number(entry.pokemon.id) || 0,
      name: entry.pokemon.name,
      bst: Number(getDraftCachedPokemonPowerData(entry.pokemon).statGlobal) || 0,
    }));
  if (team.length !== DRAFT_TEAM_SIZE || !finalMetrics.average) return;
  draftArenaState.scoreAttackSubmitted = true;
  socket.emit("draft-score:submit-result", {
    average: finalMetrics.average,
    total: finalMetrics.total,
    selectedGen: draftArenaState.selectedGen,
    label: getDraftScoreAttackResultLabel(finalMetrics.average),
    team,
  }, (response = {}) => {
    if (!response.ok) {
      draftArenaState.scoreAttackSubmitted = false;
      draftArenaState.scoreAttackRoomError = response.error || "Impossible d'envoyer le score.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

let draftScoreFinaleShownFor = null;
let draftScoreOpponentToastTimer = null;

function sendDraftScoreReaction(emoji) {
  if (!multiplayerSocket?.connected || !draftArenaState?.scoreAttackRoom) return;
  multiplayerSocket.emit("draft-score:reaction", { emoji });
  // Animation locale immédiate (sur soi-même)
  showDraftScoreReactionEmoji({ emoji, fromSide: "self", local: true });
}

function showDraftScoreReactionEmoji(payload = {}) {
  const emoji = String(payload.emoji || "").trim();
  if (!emoji) return;
  const isLocal = Boolean(payload.local);
  // Cibler la card du joueur qui envoie l'émoji (ou la card adverse si reçu)
  const targetSel = isLocal ? ".draft-score-vs-player.is-self" : ".draft-score-vs-player.is-opponent";
  const target = document.querySelector(targetSel);
  if (!target) return;
  const node = document.createElement("div");
  node.className = "draft-score-reaction-emoji";
  node.textContent = emoji;
  // Position random horizontale dans la card
  node.style.left = `${20 + Math.random() * 60}%`;
  target.appendChild(node);
  setTimeout(() => node.remove(), 2000);
}

function showDraftScoreOpponentToast(message) {
  let toast = document.getElementById("draft-score-opp-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "draft-score-opp-toast";
    toast.className = "draft-score-opp-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  if (draftScoreOpponentToastTimer) clearTimeout(draftScoreOpponentToastTimer);
  draftScoreOpponentToastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function maybeShowDraftScoreFinale(room) {
  if (!room || room.status !== "finished") return;
  const fingerprint = `${room.code}:${room.players?.map((p) => `${p.side}-${p.result?.average || 0}-${p.result?.total || 0}`).join("|")}`;
  if (draftScoreFinaleShownFor === fingerprint) return;
  draftScoreFinaleShownFor = fingerprint;
  updateDraftScoreHeadToHead(room);
  showDraftScoreFinaleOverlay(room);
}

function getDraftScoreHeadToHead(opponentNickname) {
  if (!playerProfile || !opponentNickname) return { wins: 0, losses: 0, draws: 0 };
  const all = playerProfile.draftScoreHeadToHead || {};
  const entry = all[String(opponentNickname).toLowerCase()] || { wins: 0, losses: 0, draws: 0 };
  return {
    wins: Math.max(0, Number(entry.wins) || 0),
    losses: Math.max(0, Number(entry.losses) || 0),
    draws: Math.max(0, Number(entry.draws) || 0),
  };
}

function updateDraftScoreHeadToHead(room) {
  if (!playerProfile || !room || room.status !== "finished") return;
  const self = room.players?.find((p) => p.isSelf);
  const opp = room.players?.find((p) => !p.isSelf);
  if (!self || !opp || !opp.nickname) return;
  const key = String(opp.nickname).toLowerCase();
  playerProfile.draftScoreHeadToHead = playerProfile.draftScoreHeadToHead || {};
  const cur = playerProfile.draftScoreHeadToHead[key] || { wins: 0, losses: 0, draws: 0 };
  if (room.winnerSide === "tie") cur.draws = (Number(cur.draws) || 0) + 1;
  else if (room.winnerSide === self.side) cur.wins = (Number(cur.wins) || 0) + 1;
  else if (room.winnerSide === opp.side) cur.losses = (Number(cur.losses) || 0) + 1;
  playerProfile.draftScoreHeadToHead[key] = cur;
  try { saveProfile(); } catch (_e) {}
}

function showDraftScoreFinaleOverlay(room) {
  const existing = document.getElementById("draft-score-finale-overlay");
  if (existing) existing.remove();
  const self = room.players?.find((p) => p.isSelf);
  const opp = room.players?.find((p) => !p.isSelf);
  if (!self?.result || !opp?.result) return;
  const selfWon = room.winnerSide === self.side;
  const tie = room.winnerSide === "tie";
  const title = tie ? "🤝 ÉGALITÉ !" : selfWon ? "🏆 VICTOIRE !" : "💀 DÉFAITE";
  const titleClass = tie ? "is-tie" : selfWon ? "is-win" : "is-lose";
  const buildTeamRow = (player, side) => {
    const team = Array.isArray(player.result?.team) ? player.result.team : [];
    return `<div class="dsf-team-side dsf-side-${side}">
      <div class="dsf-team-head"><b>${escapeHtml(player.nickname || "Joueur")}</b><span class="dsf-side-label">${side === "left" ? "" : ""}${player.isSelf ? "TOI" : "ADVERSAIRE"}</span></div>
      <div class="dsf-team-sprites">${team.map((entry, idx) => {
        const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
        const sprite = pokemon ? getPokemonSprite(pokemon) : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${entry.id}.png`;
        return `<div class="dsf-pokemon-tile" style="--dsf-i:${idx}"><img src="${escapeHtml(sprite)}" alt="${escapeHtml(entry.name)}" data-fallback="${pokemon?.sprite || ''}" /><b>${entry.bst}</b><span>${escapeHtml(entry.name)}</span></div>`;
      }).join("")}</div>
      <div class="dsf-team-score" data-target="${player.result?.average || 0}">0</div>
      <div class="dsf-team-score-label">Moyenne BST</div>
    </div>`;
  };
  // Head-to-head dans la finale
  const h2h = opp.nickname ? getDraftScoreHeadToHead(opp.nickname) : null;
  const h2hTotal = h2h ? (h2h.wins + h2h.losses + h2h.draws) : 0;
  const h2hHtml = h2hTotal > 0
    ? `<div class="dsf-h2h">Bilan contre <b>${escapeHtml(opp.nickname || "")}</b> : <b class="dsf-h2h-w">${h2h.wins}V</b> · <b class="dsf-h2h-l">${h2h.losses}D</b>${h2h.draws ? ` · <b class="dsf-h2h-t">${h2h.draws}N</b>` : ""}</div>`
    : "";
  const overlay = document.createElement("div");
  overlay.id = "draft-score-finale-overlay";
  overlay.className = "draft-score-finale-overlay";
  overlay.innerHTML = `
    <div class="dsf-backdrop"></div>
    <div class="dsf-content">
      <div class="dsf-title ${titleClass}">${title}</div>
      ${h2hHtml}
      <div class="dsf-versus">
        ${buildTeamRow(self, "left")}
        <div class="dsf-vs-center">VS</div>
        ${buildTeamRow(opp, "right")}
      </div>
      <div class="dsf-actions">
        <button class="btn-red" type="button" id="dsf-close">Continuer</button>
      </div>
      <div class="dsf-rematch-hint">${self.isHost ? "💡 Clique sur une génération en bas pour relancer un duel." : "💡 En attente de l'hôte pour choisir une nouvelle génération…"}</div>
    </div>`;
  document.body.appendChild(overlay);
  // Animate score counters
  setTimeout(() => {
    overlay.querySelectorAll(".dsf-team-score").forEach((el) => {
      const target = Number(el.dataset.target) || 0;
      const start = Date.now();
      const duration = 1400;
      const step = () => {
        const elapsed = Date.now() - start;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = target;
      };
      requestAnimationFrame(step);
    });
  }, 600);
  document.getElementById("dsf-close")?.addEventListener("click", () => {
    overlay.classList.add("is-closing");
    setTimeout(() => overlay.remove(), 300);
  });
  // Auto-focus close button for keyboard accessibility
  setTimeout(() => document.getElementById("dsf-close")?.focus(), 300);
}

function renderDraftScoreAttackPlayerCard(player, isSelf) {
  // Mode pool indépendant : lire depuis player.progress.team (mis à jour live à chaque pick)
  // Fallback sur player.result.team quand la partie est finalisée
  const team = Array.isArray(player.progress?.team) && player.progress.team.length
    ? player.progress.team
    : (Array.isArray(player.result?.team) ? player.result.team : []);
  const average = player.result?.average ?? player.progress?.average ?? 0;
  const total = player.result?.total ?? player.progress?.total ?? 0;
  const filled = team.length;
  const slotsHtml = Array.from({ length: DRAFT_TEAM_SIZE }, (_, i) => {
    const entry = team[i];
    if (!entry) {
      return `<div class="draft-score-vs-slot is-empty"><span>?</span></div>`;
    }
    // Résoudre le sprite via getPokemonSprite (gère les Mega/Z-A formes spéciales)
    const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
    let sprite;
    if (pokemon) {
      sprite = entry.shiny && typeof getPokemonShinySprite === "function" ? getPokemonShinySprite(pokemon) : getPokemonSprite(pokemon);
    } else {
      sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${entry.id}.png`;
    }
    return `<div class="draft-score-vs-slot is-filled${entry.shiny ? " is-shiny" : ""}" data-rarity="${Number(entry.bst) >= 600 ? "legendary" : Number(entry.bst) >= 500 ? "strong" : Number(entry.bst) >= 400 ? "decent" : "common"}" data-slot-key="${entry.id}-${i}" title="${escapeHtml(entry.name)} (BST ${entry.bst})"><img src="${escapeHtml(sprite)}" alt="${escapeHtml(entry.name)}" loading="lazy" data-fallback="${pokemon?.sprite || ''}" /><b>${entry.bst}</b></div>`;
  }).join("");
  const status = player.hasSubmitted
    ? "✅ Soumis"
    : filled === 0
      ? "⏳ Choisit ses Pokémon…"
      : filled < DRAFT_TEAM_SIZE
        ? `🔥 ${filled}/6 picks`
        : "📤 Envoi du score…";
  return `
    <div class="draft-score-vs-player ${isSelf ? "is-self" : "is-opponent"} ${player.connected ? "" : "is-disconnected"}">
      <div class="draft-score-vs-head">
        <div class="draft-score-vs-name"><b>${escapeHtml(player.nickname || "Joueur")}</b>${isSelf ? "<span>TOI</span>" : ""}</div>
        <div class="draft-score-vs-status">${status}</div>
      </div>
      <div class="draft-score-vs-slots">${slotsHtml}</div>
      <div class="draft-score-vs-metrics">
        <div class="draft-score-vs-metric"><span>Moyenne BST</span><b>${average || "-"}</b></div>
        <div class="draft-score-vs-metric"><span>Total</span><b>${total || "-"}</b></div>
        <div class="draft-score-vs-metric"><span>Relances</span><b>${player.progress?.rerollsLeft ?? DRAFT_SCORE_ATTACK_REROLLS}</b></div>
      </div>
    </div>`;
}

function renderDraftScoreAttackRoomStatus(room = draftArenaState?.scoreAttackRoom) {
  if (!draftArenaState?.scoreAttackRoomError && !room) {
    return `<div class="draft-score-vs-empty">
      <b>🎯 Score Attack solo</b>
      <span>Drafte pour battre ton record perso, ou défie un ami en duel live ci-dessous.</span>
      <div class="draft-score-vs-empty-actions">
        <button class="btn-blue" type="button" data-action="createDraftScoreAttackRoom">🆚 Créer une room 1v1</button>
        <button class="btn-ghost" type="button" data-action="joinDraftScoreAttackRoom">🔗 Rejoindre par code</button>
      </div>
    </div>`;
  }
  if (!room) {
    return `<div class="draft-score-vs-empty">
      <b>Score Attack 1v1</b>
      <span>${escapeHtml(draftArenaState.scoreAttackRoomError || "Room indisponible.")}</span>
      <div class="draft-score-vs-empty-actions">
        <button class="btn-blue" type="button" data-action="createDraftScoreAttackRoom">🆚 Créer une room</button>
        <button class="btn-ghost" type="button" data-action="joinDraftScoreAttackRoom">🔗 Rejoindre</button>
      </div>
    </div>`;
  }
  const self = getDraftScoreAttackRoomSelf(room);
  const opponent = getDraftScoreAttackRoomOpponent(room);
  let headTitle = "";
  if (room.status === "finished") {
    if (room.winnerSide === "tie") headTitle = "🤝 Égalité parfaite";
    else if (self && room.winnerSide === self.side) headTitle = "🏆 VICTOIRE !";
    else headTitle = "💀 Défaite";
  } else if (!opponent) {
    headTitle = `⏳ En attente d'un adversaire • Code : ${escapeHtml(room.code || "-")}`;
  } else {
    headTitle = `⚔️ DUEL EN COURS • Code ${escapeHtml(room.code || "-")}`;
  }
  const selfCard = self ? renderDraftScoreAttackPlayerCard(self, true) : "";
  const oppCard = opponent ? renderDraftScoreAttackPlayerCard(opponent, false) : `<div class="draft-score-vs-player is-opponent is-waiting"><div class="draft-score-vs-head"><div class="draft-score-vs-name"><b>En attente…</b></div></div><div class="draft-score-vs-slots">${Array.from({ length: DRAFT_TEAM_SIZE }, () => `<div class="draft-score-vs-slot is-empty"><span>?</span></div>`).join("")}</div><div class="draft-score-vs-share">Partage le code <b>${escapeHtml(room.code || "")}</b> à ton ami pour le faire rejoindre.</div></div>`;
  const selfAvg = self?.progress?.average || self?.result?.average || 0;
  const oppAvg = opponent?.progress?.average || opponent?.result?.average || 0;
  const leadIndicator = (selfAvg > 0 || oppAvg > 0) && opponent
    ? `<div class="draft-score-vs-lead">${selfAvg > oppAvg ? "🔥 Tu mènes !" : oppAvg > selfAvg ? "⚠️ Tu es mené" : "⚖️ Égalité"} (${selfAvg} vs ${oppAvg})</div>`
    : "";
  let headToHeadHtml = "";
  if (opponent?.nickname) {
    const h2h = getDraftScoreHeadToHead(opponent.nickname);
    const total = h2h.wins + h2h.losses + h2h.draws;
    if (total > 0) {
      const ledTxt = h2h.wins > h2h.losses ? "🏆 Tu mènes" : h2h.losses > h2h.wins ? "💀 Tu es mené" : "⚖️ Vous êtes à égalité";
      headToHeadHtml = `<div class="draft-score-vs-h2h"><span>${ledTxt} contre <b>${escapeHtml(opponent.nickname)}</b></span><span class="draft-score-h2h-numbers"><b class="is-win">${h2h.wins}V</b> · <b class="is-lose">${h2h.losses}D</b>${h2h.draws ? ` · <b class="is-tie">${h2h.draws}N</b>` : ""}</span></div>`;
    }
  }
  const leaveBtn = `<button class="draft-score-vs-leave" type="button" data-action="leaveDraftScoreAttackRoom" title="Quitter la room">🚪 Quitter</button>`;
  const canReact = Boolean(opponent && room.status === "live");
  const reactionBar = canReact
    ? `<div class="draft-score-reaction-bar">${["🔥", "😱", "😈", "👍", "🤡", "💀", "👀", "🎯"].map((emoji) => `<button class="draft-score-reaction-btn" type="button" data-action="sendDraftScoreReaction" data-args='["${emoji}"]' title="Envoyer ${emoji}">${emoji}</button>`).join("")}</div>`
    : "";
  return `
    <div class="draft-score-vs-wrap">
      ${leaveBtn}
      <div class="draft-score-vs-title">${headTitle}</div>
      ${headToHeadHtml}
      ${leadIndicator}
      ${reactionBar}
      <div class="draft-score-vs-arena">
        ${selfCard}
        <div class="draft-score-vs-versus">VS</div>
        ${oppCard}
      </div>
    </div>
  `;
}

function selectDraftGeneration(gen) {
  if (!draftArenaState) return;
  // Mode Score Attack en room : chaque joueur draft INDÉPENDAMMENT avec son propre pool
  // Le panneau VS affiche la progression de l'autre en live (via pick-progress)
  // Reset côté serveur (efface result/progress, repasse status en live si les 2 ont reset)
  if (draftArenaState.mode === "scoreAttack" && draftArenaState.scoreAttackRoom && multiplayerSocket?.connected) {
    multiplayerSocket.emit("draft-score:reset-self");
  }

  draftArenaState.phase = "draft";
  draftArenaState.selectedGen = gen;
  draftArenaState.team = [];
  draftArenaState.selectedDexIds = new Set();
  draftArenaState.options = [];
  draftArenaState.shinyCount = 0;
  draftArenaState.badgeResults = [];
  draftArenaState.teamPower = 0;
  draftArenaState.teamSynergy = 0;
  draftArenaState.runSummary = null;
  draftArenaState.evaluating = false;
  draftArenaState.scoreAttackRerollsLeft = DRAFT_SCORE_ATTACK_REROLLS;
  draftArenaState.scoreAttackBestAverage = 0;
  draftArenaState.scoreAttackSubmitted = false;
  draftArenaState.message = draftArenaState.mode === "scoreAttack"
    ? `Score Attack ${draftGenLabel(gen)}. Monte la meilleure moyenne BST possible.`
    : `Génération sélectionnée : ${draftGenLabel(gen)}. Choisis ton premier Pokémon.`;

  fillDraftArenaOptions();
  renderDraftArena();
}

function getDraftTeamSynergy(teamData) {
  const typeCounts = new Map();
  let dualTypeCount = 0;

  teamData.forEach((member) => {
    [member.pokemon.type1, member.pokemon.type2].filter(Boolean).forEach((type) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    if (member.pokemon.type2) dualTypeCount += 1;
  });

  const uniqueTypes = typeCounts.size;
  let duplicatePenalty = 0;
  typeCounts.forEach((count) => {
    if (count > 2) duplicatePenalty += count - 2;
  });

  const score = clampDraftValue(uniqueTypes * 2 + dualTypeCount - duplicatePenalty * 2, 0, 24);
  return {
    score,
    label: score >= 18 ? "Excellente" : score >= 12 ? "Bonne" : score >= 7 ? "Correcte" : "Fragile",
    uniqueTypes,
  };
}

function analyzeDraftArenaBattle(teamData, arena, arenaIndex, gen, synergy) {
  const counterTypes = getDraftCounterTypes(gen, arena.type);
  const memberScores = teamData.map((member) => {
    const bestOffense = getDraftBestOffenseMultiplier(gen, member.pokemon, arena.type);
    const defenseMult = getDraftDefenseMultiplier(gen, member.pokemon, arena.type);
    const offenseBonus = bestOffense === 2 ? 14 : bestOffense === 0.5 ? -6 : bestOffense === 0 ? -14 : 0;
    const defenseBonus = defenseMult === 0 ? 16 : defenseMult === 0.25 ? 10 : defenseMult === 0.5 ? 6 : defenseMult >= 4 ? -18 : defenseMult === 2 ? -10 : 0;
    return {
      ...member,
      bestOffense,
      defenseMult,
      arenaScore: member.metrics.power + offenseBonus + defenseBonus + Math.round(member.metrics.rarityScore / 2),
    };
  });

  const topMembers = memberScores.slice().sort((a, b) => b.arenaScore - a.arenaScore).slice(0, 4);
  const offensivePressure = memberScores.filter((member) => member.bestOffense > 1);
  const resistances = memberScores.filter((member) => member.defenseMult < 1);
  const weaknesses = memberScores.filter((member) => member.defenseMult > 1);
  const uniquePressureTypes = new Set();
  offensivePressure.forEach((member) => {
    if (getDraftAttackMultiplier(gen, member.pokemon.type1, arena.type) > 1) uniquePressureTypes.add(member.pokemon.type1);
    if (member.pokemon.type2 && getDraftAttackMultiplier(gen, member.pokemon.type2, arena.type) > 1) uniquePressureTypes.add(member.pokemon.type2);
  });

  const pressureBonus = Math.min(18, offensivePressure.length * 3 + uniquePressureTypes.size * 2);
  const defensiveBonus = Math.min(18, resistances.length * 3 + memberScores.filter((member) => member.defenseMult === 0).length * 4);
  const weaknessPenalty = Math.min(18, weaknesses.length * 4);
  const topAverage = topMembers.length ? topMembers.reduce((sum, member) => sum + member.arenaScore, 0) / topMembers.length : 0;
  const estimatedScore = Math.round(topAverage + synergy.score + pressureBonus + defensiveBonus - weaknessPenalty - arenaIndex * 2);
  const threshold = 66 + arenaIndex * 4;
  const won = estimatedScore >= threshold;

  let explanation = "";
  if (won) {
    const mvp = topMembers[0]?.pokemon?.name || "l'équipe";
    const support = resistances.length ? ` et ${resistances.length} résistance${resistances.length > 1 ? "s" : ""} utiles contre ${arena.type}` : "";
    explanation = `Victoire contre ${arena.name} grâce à ${mvp}, une bonne pression offensive${support}.`;
  } else {
    const reasons = [];
    if (!offensivePressure.length) reasons.push(`manque de pression offensive ${counterTypes.slice(0, 3).join(" / ") || "adaptée"}`);
    if (!resistances.length || weaknesses.length >= Math.ceil(memberScores.length / 2)) reasons.push(`manque de résistance ${arena.type}`);
    if (synergy.score < 8) reasons.push("a une synergie trop fragile");
    explanation = `Échec contre ${arena.name} car l’équipe ${reasons.length ? reasons.join(" et ") : "n'atteint pas le niveau requis"}.`;
  }

  return {
    arena,
    won,
    status: won ? "won" : "blocked",
    estimatedScore,
    threshold,
    explanation,
    topMembers,
    offensivePressureCount: offensivePressure.length,
    resistanceCount: resistances.length,
    weaknessCount: weaknesses.length,
  };
}

function buildDraftRunSummary(teamData, badgeResults, synergy) {
  const attempted = badgeResults.filter((result) => result.status !== "untried");
  const wonCount = badgeResults.filter((result) => result.status === "won").length;
  const blocked = badgeResults.find((result) => result.status === "blocked") || null;
  const mvpScores = new Map();

  attempted.forEach((result) => {
    result.topMembers.forEach((member, index) => {
      const weight = index === 0 ? 3 : index === 1 ? 2 : 1;
      mvpScores.set(member.pokemon.name, (mvpScores.get(member.pokemon.name) || 0) + weight);
    });
  });

  const mvpEntry = [...mvpScores.entries()].sort((a, b) => b[1] - a[1])[0];
  const mvpName = mvpEntry?.[0] || teamData[0]?.pokemon?.name || "-";
  const status = blocked ? `Run arrêtée sur ${blocked.arena.name}` : "Run parfaite";

  return {
    wonCount,
    blockedArena: blocked?.arena?.name || null,
    attemptedCount: attempted.length,
    status,
    mvpName,
    synergyLabel: synergy.label,
    offenseLabel: wonCount >= 6 ? "Forte pression offensive" : wonCount >= 3 ? "Pression offensive correcte" : "Pression offensive limitée",
    balanceLabel: synergy.score >= 12 ? "Équipe équilibrée" : "Équipe encore fragile",
  };
}

function buildDraftArenaLiveSummary(teamData, badgeResults, synergy, currentArena = null) {
  const summary = buildDraftRunSummary(teamData, badgeResults, synergy);
  const wonCount = badgeResults.filter((result) => result.status === "won").length;
  const blocked = badgeResults.find((result) => result.status === "blocked");
  if (blocked) return summary;
  if (currentArena) {
    summary.status = `Arène en cours : ${currentArena.name}`;
  } else if (wonCount) {
    summary.status = `${wonCount} badge${wonCount > 1 ? "s" : ""} obtenu${wonCount > 1 ? "s" : ""}`;
  } else {
    summary.status = "Run prête à commencer";
  }
  return summary;
}

function getDraftArenaEnemyPowerCap(arena) {
  const arenas = DRAFT_ARENAS_BY_GEN?.[draftArenaState?.selectedGen] || [];
  const arenaIndex = Math.max(0, arenas.findIndex((entry) => entry?.name === arena?.name && entry?.type === arena?.type));
  const caps = [76, 79, 82, 84, 86, 88, 91, 95];
  return caps[Math.min(arenaIndex, caps.length - 1)] || 88;
}

function buildDraftArenaBalancedEnemyPool(pool, arena, options = {}) {
  const cap = getDraftArenaEnemyPowerCap(arena);
  const allowExceptional = Boolean(options.allowExceptional);
  const candidates = (pool || []).filter((pokemon) => {
    if (!pokemon) return false;
    const metrics = getDraftCachedPokemonPowerData(pokemon);
    if (metrics.power > cap) return false;
    if (!allowExceptional && metrics.rarityLabel === "Exceptionnel") return false;
    return true;
  });
  return candidates.length >= 4 ? candidates : (pool || []).filter(Boolean);
}

function buildDraftArenaEnemyTeamEntries(arena, playerEntries = []) {
  if (!arena || !draftArenaState?.selectedGen) return [];

  const playerDexIds = new Set(
    playerEntries
      .map((entry) => entry?.pokemon)
      .filter(Boolean)
      .map((pokemon) => getDraftPoolEntryKey(pokemon))
  );
  const genPool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const rawThemedPool = genPool.filter((pokemon) => pokemon?.type1 === arena.type || pokemon?.type2 === arena.type);
  const themedPool = buildDraftArenaBalancedEnemyPool(rawThemedPool, arena);
  const fallbackPool = buildDraftArenaBalancedEnemyPool(genPool, arena);
  const usedDexIds = new Set(playerDexIds);
  const picks = [];

  const signatureNames = DRAFT_ARENA_SIGNATURES_BY_GEN?.[draftArenaState.selectedGen]?.[arena.name] || [];
  signatureNames.forEach((pokemonName) => {
    const pokemon = findDraftArenaSignaturePokemon(themedPool.length ? themedPool : genPool, pokemonName)
      || findDraftArenaSignaturePokemon(genPool, pokemonName);
    if (!pokemon) return;
    const metrics = getDraftCachedPokemonPowerData(pokemon);
    if (metrics.power > getDraftArenaEnemyPowerCap(arena) + 4) return;
    const dexId = getDraftPoolEntryKey(pokemon);
    if (usedDexIds.has(dexId)) return;
    usedDexIds.add(dexId);
    picks.push({ pokemon });
  });

  const themedPicks = buildDraftWeightedWave(themedPool, DRAFT_SIMPLE_BATTLE_TEAM_SIZE - picks.length, usedDexIds);
  themedPicks.forEach((pokemon) => {
    if (!pokemon) return;
    const dexId = getDraftPoolEntryKey(pokemon);
    if (usedDexIds.has(dexId)) return;
    usedDexIds.add(dexId);
    picks.push({ pokemon });
  });

  if (picks.length < DRAFT_SIMPLE_BATTLE_TEAM_SIZE) {
    const fallbackPicks = buildDraftWeightedWave(fallbackPool, DRAFT_SIMPLE_BATTLE_TEAM_SIZE - picks.length, usedDexIds);
    fallbackPicks.forEach((pokemon) => {
      if (!pokemon) return;
      const dexId = getDraftPoolEntryKey(pokemon);
      if (usedDexIds.has(dexId)) return;
      usedDexIds.add(dexId);
      picks.push({ pokemon });
    });
  }

  return picks.slice(0, DRAFT_SIMPLE_BATTLE_TEAM_SIZE);
}

function getDraftArenaCurrentArena() {
  if (!draftArenaState?.selectedGen) return null;
  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];
  const index = clampDraftValue(Number(draftArenaState.currentArenaIndex) || 0, 0, Math.max(0, arenas.length - 1));
  return arenas[index] || null;
}

function normalizeDraftArenaPokemonName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function findDraftArenaSignaturePokemon(genPool, pokemonName) {
  const wanted = normalizeDraftArenaPokemonName(pokemonName);
  if (!wanted) return null;
  return (genPool || []).find((pokemon) => normalizeDraftArenaPokemonName(pokemon?.name) === wanted) || null;
}

function getDraftArenaThemeClass(arena) {
  const normalizedType = normalizeDraftArenaPokemonName(arena?.type || "");
  return normalizedType ? `theme-${normalizedType}` : "theme-neutral";
}

function getDraftArenaPreviewHint(arena) {
  if (!arena) return "Un duel Draft vs Draft t’attend.";
  return `Champion ${arena.name} • Arène ${arena.type}`;
}

function getDraftArenaTypeImageUrl(arena) {
  const arenaImage = DRAFT_ARENA_BACKGROUND_IMAGE_BY_NAME[arena?.name || ""];
  if (arenaImage) return arenaImage;
  const fileName = DRAFT_ARENA_TYPE_IMAGE_BY_TYPE[arena?.type];
  return fileName ? `/types/${fileName}` : "";
}

function chooseDraftSimpleBattleOpeningIndex(teamEntries = [], opponentEntries = []) {
  if (!teamEntries.length) return 0;
  const battlers = teamEntries.map((entry) => convertDraftPokemonToSimpleBattler(entry)).filter(Boolean);
  const opponentBattlers = opponentEntries.map((entry) => convertDraftPokemonToSimpleBattler(entry)).filter(Boolean);
  if (!battlers.length || !opponentBattlers.length) return 0;
  const opponentLead = opponentBattlers[0];

  let bestIndex = 0;
  let bestScore = -Infinity;
  battlers.forEach((battler, index) => {
    const attackScore = getDraftSimpleBattleBestMoveScore(Number(battler?.pokemon?.gen) || 1, battler, opponentLead);
    const defenseScore = getDraftSimpleBattleBestMoveScore(Number(battler?.pokemon?.gen) || 1, opponentLead, battler);
    const score = attackScore - defenseScore + getDraftSimpleBattleCurrentSpeed(battler) * 0.18;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function buildDraftArenaBattleButtonMeta() {
  const battleTeam = draftArenaState?.team?.filter((entry) => entry?.pokemon) || [];
  if (battleTeam.length < DRAFT_TEAM_SIZE) {
    return {
      disabled: true,
      label: "Lancer le duel",
      title: "Complète d’abord ton équipe de 6 Pokémon.",
    };
  }

  if (draftArenaState?.phase === "result" && draftArenaState?.runSummary) {
    return {
      disabled: true,
      label: "Run terminée",
      title: "Relance un nouveau draft pour recommencer la run.",
    };
  }

  const currentArena = getDraftArenaCurrentArena();
  if (draftArenaState?.phase === "battle" && currentArena) {
    return {
      disabled: false,
      label: `Affronter ${currentArena.name}`,
      title: `Lancer le vrai duel contre ${currentArena.name}.`,
    };
  }

  return {
    disabled: false,
    label: "Lancer le duel",
    title: "Ouvrir le combat simplifié du Draft.",
  };
}

async function prepareDraftArenaBattleRun() {
  if (!draftArenaState || draftArenaState.team.length < DRAFT_TEAM_SIZE || !draftArenaState.selectedGen) return false;
  const snapshot = draftArenaState;
  snapshot.evaluating = true;
  snapshot.message = `Préparation de la run ${draftGenLabel(snapshot.selectedGen)}...`;
  renderDraftArena();

  const teamData = await Promise.all(snapshot.team.map(async (member) => ({
    ...member,
    metrics: await getDraftPokemonPowerData(member.pokemon),
  })));

  if (snapshot !== draftArenaState) return false;

  const arenas = DRAFT_ARENAS_BY_GEN[snapshot.selectedGen] || [];
  const synergy = getDraftTeamSynergy(teamData);
  snapshot.teamData = teamData;
  snapshot.synergyData = synergy;
  snapshot.currentArenaIndex = 0;
  snapshot.badgeResults = arenas.map((arena, arenaIndex) => ({
    ...analyzeDraftArenaBattle(teamData, arena, arenaIndex, snapshot.selectedGen, synergy),
    won: false,
    status: arenaIndex === 0 ? "pending" : "untried",
  }));
  snapshot.teamPower = teamData.reduce((sum, member) => sum + member.metrics.power, 0);
  snapshot.teamSynergy = synergy.score;
  snapshot.runSummary = buildDraftArenaLiveSummary(teamData, snapshot.badgeResults, synergy, arenas[0] || null);
  snapshot.evaluating = false;
  snapshot.phase = "battle";
  snapshot.message = arenas[0]
    ? `Ton équipe est prête. Première arène : ${arenas[0].name} (${arenas[0].type}).`
    : "Ton équipe est prête pour le duel.";
  renderDraftArena();
  return true;
}

function updateDraftArenaRunAfterBattle(battleState) {
  if (!draftArenaState || !draftArenaState.teamData?.length || !draftArenaState.synergyData) return;

  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];
  const arenaIndex = clampDraftValue(Number(draftArenaState.currentArenaIndex) || 0, 0, Math.max(0, arenas.length - 1));
  const currentArena = arenas[arenaIndex];
  if (!currentArena || !draftArenaState.badgeResults[arenaIndex]) return;

  const playerWin = isDraftSimpleBattlePlayerWin(battleState);
  const winnerName = getDraftSimpleBattleWinnerName(battleState);
  const currentResult = draftArenaState.badgeResults[arenaIndex];

  draftArenaState.badgeResults[arenaIndex] = {
    ...currentResult,
    won: playerWin,
    status: playerWin ? "won" : "blocked",
    explanation: playerWin
      ? `Victoire réelle contre ${currentArena.name}. ${winnerName} termine le duel pour ton équipe.`
      : `Défaite réelle contre ${currentArena.name}. ${winnerName} bloque la progression de la run.`,
  };

  if (!playerWin) {
    for (let index = arenaIndex + 1; index < draftArenaState.badgeResults.length; index += 1) {
      draftArenaState.badgeResults[index] = {
        ...draftArenaState.badgeResults[index],
        won: false,
        status: "untried",
        explanation: "Arène non tentée car la run s'est arrêtée avant.",
      };
    }
    draftArenaState.phase = "result";
    draftArenaState.runSummary = buildDraftRunSummary(draftArenaState.teamData, draftArenaState.badgeResults, draftArenaState.synergyData);
    draftArenaState.message = `Run arrêtée contre ${currentArena.name}. ${draftArenaState.runSummary.wonCount} badge${draftArenaState.runSummary.wonCount > 1 ? "s" : ""} remporté${draftArenaState.runSummary.wonCount > 1 ? "s" : ""}.`;
    battleState.postBattleAction = {
      label: "Voir le bilan",
      action: "finishDraftArenaBattleView",
    };
    renderDraftArena();
    return;
  }

  const nextArenaIndex = arenaIndex + 1;
  if (nextArenaIndex >= arenas.length) {
    draftArenaState.phase = "result";
    draftArenaState.currentArenaIndex = arenas.length;
    draftArenaState.runSummary = buildDraftRunSummary(draftArenaState.teamData, draftArenaState.badgeResults, draftArenaState.synergyData);
    draftArenaState.message = `Run parfaite sur ${draftGenLabel(draftArenaState.selectedGen)}. Les ${draftArenaState.runSummary.wonCount} arènes sont remportées.`;
    battleState.postBattleAction = {
      label: "Voir le bilan",
      action: "finishDraftArenaBattleView",
    };
    renderDraftArena();
    return;
  }

  draftArenaState.currentArenaIndex = nextArenaIndex;
  draftArenaState.badgeResults = draftArenaState.badgeResults.map((result, index) => {
    if (index === nextArenaIndex) {
      return { ...result, status: "pending" };
    }
    if (index > nextArenaIndex && result.status !== "won") {
      return { ...result, status: "untried" };
    }
    return result;
  });
  draftArenaState.phase = "battle";
  draftArenaState.runSummary = buildDraftArenaLiveSummary(draftArenaState.teamData, draftArenaState.badgeResults, draftArenaState.synergyData, arenas[nextArenaIndex]);
  draftArenaState.message = `Badge obtenu. Prochaine arène : ${arenas[nextArenaIndex].name} (${arenas[nextArenaIndex].type}).`;
  battleState.postBattleAction = {
    label: "Arène suivante",
    action: "continueDraftArenaBattleRun",
  };
  renderDraftArena();
}

async function launchDraftArenaBattle() {
  if (!DRAFT_BATTLE_ENABLED) {
    showToast("Le combat d'arène est en pause le temps d'une refonte — le draft et les badges restent ouverts !");
    return;
  }
  if (!draftArenaState) return null;
  if (draftArenaState.team.length < DRAFT_TEAM_SIZE) return null;

  if (!draftArenaState.badgeResults.length || !draftArenaState.teamData?.length || !draftArenaState.synergyData) {
    const prepared = await prepareDraftArenaBattleRun();
    if (!prepared || !draftArenaState) return null;
  }

  const currentArena = getDraftArenaCurrentArena();
  if (!currentArena) return null;

  const playerDraftTeam = getDraftSimpleBattlePlayerTeamEntries();
  const enemyDraftTeam = buildDraftArenaEnemyTeamEntries(currentArena, playerDraftTeam);
  const state = createDraftSimpleBattleDevUiState(playerDraftTeam, enemyDraftTeam, {
    mode: "arena-run",
    title: `Arène ${draftArenaState.currentArenaIndex + 1} • ${currentArena.name}`,
    arena: currentArena,
    onFinish: updateDraftArenaRunAfterBattle,
  });
  if (!state) return null;

  draftArenaState.enemyBattleTeam = enemyDraftTeam;
  draftSimpleBattleDevUiState = state;
  draftSimpleBattleDevUiState.showPreview = true;
  draftSimpleBattleDevUiState.showIntro = false;
  renderDraftSimpleBattleDevPanel(state);
  document.getElementById("draft-battle-close")?.classList.remove("hidden");
  return state;
}

function continueDraftArenaBattleRun() {
  clearDraftSimpleBattleDevPanel();
  return launchDraftArenaBattle();
}

function finishDraftArenaBattleView() {
  clearDraftSimpleBattleDevPanel();
  renderDraftArena();
  return draftArenaState;
}

function buildDraftArenaIndicators(result, runSummary) {
  if (!result || result.status === "untried") return ["Arène non tentée"];

  const indicators = [];
  if (result.offensivePressureCount >= 2) indicators.push("Forte pression offensive");
  if (result.resistanceCount >= 2) indicators.push("Bonne couverture défensive");
  if (result.weaknessCount >= 3) indicators.push(`Faiblesse contre ${result.arena.type}`);
  if (runSummary?.synergyLabel === "Excellente" || runSummary?.synergyLabel === "Bonne") indicators.push("Bonne synergie");
  if (!indicators.length) indicators.push(result.won ? "Match-up correct" : "Match-up difficile");
  return indicators.slice(0, 3);
}

async function resolveDraftArenaRun() {
  if (!draftArenaState || draftArenaState.team.length < DRAFT_TEAM_SIZE) return;
  const snapshot = draftArenaState;
  snapshot.evaluating = true;
  snapshot.phase = "result";
  snapshot.message = `Analyse de la run ${draftGenLabel(snapshot.selectedGen)} en cours...`;
  snapshot.badgeResults = [];
  renderDraftArena();

  const teamData = await Promise.all(snapshot.team.map(async (member) => ({
    ...member,
    metrics: await getDraftPokemonPowerData(member.pokemon),
  })));

  if (snapshot !== draftArenaState) return;

  const arenas = DRAFT_ARENAS_BY_GEN[snapshot.selectedGen] || [];
  const synergy = getDraftTeamSynergy(teamData);
  const badgeResults = [];
  let blocked = false;

  arenas.forEach((arena, arenaIndex) => {
    if (blocked) {
      badgeResults.push({
        arena,
        won: false,
        status: "untried",
        estimatedScore: null,
        threshold: null,
        explanation: "Arène non tentée car la run s'est arrêtée avant.",
        topMembers: [],
      });
      return;
    }

    const result = analyzeDraftArenaBattle(teamData, arena, arenaIndex, snapshot.selectedGen, synergy);
    badgeResults.push(result);
    if (!result.won) blocked = true;
  });

  snapshot.badgeResults = badgeResults;
  snapshot.teamPower = teamData.reduce((sum, member) => sum + member.metrics.power, 0);
  snapshot.teamSynergy = synergy.score;
  snapshot.runSummary = buildDraftRunSummary(teamData, badgeResults, synergy);
  snapshot.evaluating = false;
  snapshot.message = snapshot.runSummary.blockedArena
    ? `Run arrêtée contre ${snapshot.runSummary.blockedArena}. ${snapshot.runSummary.wonCount} badge${snapshot.runSummary.wonCount > 1 ? "s" : ""} remporté${snapshot.runSummary.wonCount > 1 ? "s" : ""}.`
    : `Run parfaite sur ${draftGenLabel(snapshot.selectedGen)}. Les 8 arènes sont passées.`;

  renderDraftArena();
}

function openDraftArenaMode() {
  trackUsage("solo:draft");
  if (draftArenaState?.mode === "scoreAttack" && draftArenaState.scoreAttackRoom && multiplayerSocket?.connected) {
    multiplayerSocket.emit("draft-score:leave-room");
  }
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);
  stopEmulatorSession();
  mountDraftModeCard("arena");
  document.getElementById("screen-draft-arena").classList.remove("hidden");
  setGlobalNavActive("extras");

  if (!draftArenaState || draftArenaState.mode !== "arena") {
    const savedRun = loadDraftArenaProgress();
    if (savedRun) {
      draftArenaState = savedRun;
      draftArenaState.message = "Run restaurée — tu peux reprendre là où tu t'étais arrêté.";
    } else {
      draftArenaState = createDraftArenaState();
      draftArenaState.mode = "arena";
      draftArenaState.message = "Choisis une génération pour commencer le draft.";
    }
  }

  renderDraftArena();
}

function openDraftScoreAttackMode(pro) {
  hideAllScreens();
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-draft-arena")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);
  stopEmulatorSession();
  clearDraftSimpleBattleDevPanel();
  mountDraftModeCard("scoreAttack");
  document.getElementById("screen-draft-score-attack")?.classList.remove("hidden");
  setGlobalNavActive("game");

  if (!draftArenaState || draftArenaState.mode !== "scoreAttack") {
    draftArenaState = createDraftArenaState();
    draftArenaState.mode = "scoreAttack";
    draftArenaState.message = "Score Attack prêt. Choisis une génération pour viser la meilleure moyenne BST.";
  }

  draftArenaState.scoreAttackPro = !!pro;
  renderDraftArena();
}

function mountDraftModeCard(mode = "arena") {
  const card = document.getElementById("draft-mode-card");
  const arenaScreen = document.getElementById("screen-draft-arena");
  const scoreScreen = document.getElementById("screen-draft-score-attack");
  if (!card || !arenaScreen || !scoreScreen) return;
  const target = mode === "scoreAttack" ? scoreScreen : arenaScreen;
  if (card.parentElement !== target) target.appendChild(card);
  arenaScreen.classList.toggle("is-mode-score-attack", false);
  scoreScreen.classList.toggle("is-mode-score-attack", mode === "scoreAttack");
  // Adapter le titre + sous-titre selon le mode actif
  const title = card.querySelector(".card-title");
  if (title) title.innerHTML = mode === "scoreAttack" ? "🎯 Draft Score Attack" : "🏟️ Draft Arènes";
  const desc = card.querySelector(".card-desc");
  if (desc) desc.textContent = mode === "scoreAttack"
    ? "Drafte 6 Pokémon, optimise la moyenne BST et défie un ami en 1v1 Score."
    : "Choisis une génération, drafte 6 Pokémon, puis découvre les badges que ton équipe peut réellement viser.";
}

function restartDraftArenaRun() {
  // En mode duel synchronisé : ne PAS reset local, demander au serveur de relancer en gardant la room
  if (draftArenaState?.mode === "scoreAttack" && draftArenaState?.scoreAttackRoom && draftArenaState?.duelMode) {
    const room = draftArenaState.scoreAttackRoom;
    const self = getDraftScoreAttackRoomSelf(room);
    if (!self?.isHost) {
      draftArenaState.scoreAttackRoomError = "Seul l'hôte peut lancer une nouvelle partie. Tu peux changer la génération depuis chez l'hôte.";
      return renderDraftArena();
    }
    const currentGen = Number(draftArenaState.selectedGen) || Number(room?.duel?.gen) || null;
    if (currentGen) {
      // Relance avec la même gen
      return startDraftScoreDuel(currentGen);
    }
    draftArenaState.message = "Clique sur une génération pour lancer une nouvelle partie.";
    return renderDraftArena();
  }
  const previousMode = draftArenaState?.mode || "arena";
  const previousScoreRoom = draftArenaState?.scoreAttackRoom || null;
  clearDraftArenaProgress();
  draftArenaState = createDraftArenaState();
  draftArenaState.mode = previousMode;
  if (previousMode === "scoreAttack") {
    draftArenaState.scoreAttackRoom = previousScoreRoom;
    draftArenaState.scoreAttackSubmitted = false;
  }
  draftArenaState.message = previousMode === "scoreAttack"
    ? "Score Attack prêt. Choisis une génération pour viser la meilleure moyenne BST."
    : "Choisis une génération pour commencer le draft.";
  renderDraftArena();
}

function toggleDraftScoreAttackMode() {
  if (draftArenaState?.mode === "scoreAttack") openDraftArenaMode();
  else openDraftScoreAttackMode();
}

async function pickDraftArenaOption(pokemonId) {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) return;

  const optionIndex = draftArenaState.options.findIndex((option) => option.pokemon.id === pokemonId);
  const picked = optionIndex >= 0 ? draftArenaState.options[optionIndex] : null;
  if (!picked) return;

  const dexId = getDraftPoolEntryKey(picked.pokemon);
  if (draftArenaState.selectedDexIds.has(dexId)) return;

  draftArenaState.team.push({ pokemon: picked.pokemon, shiny: picked.shiny });
  draftArenaState.selectedDexIds.add(dexId);
  if (picked.shiny) draftArenaState.shinyCount += 1;
  emitDraftScoreAttackProgress();

  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) {
    if (draftArenaState.mode === "scoreAttack") {
      if (draftArenaState.scoreAttackPro) { runDraftProFinale(); return; }
      const metrics = getDraftTeamBstMetrics(draftArenaState.team);
      draftArenaState.phase = "result";
      draftArenaState.scoreAttackBestAverage = Math.max(Number(draftArenaState.scoreAttackBestAverage) || 0, metrics.average);
      const previousRecord = getDraftScoreAttackRecord(draftArenaState.selectedGen);
      const isNewRecord = updateDraftScoreAttackRecord(draftArenaState.selectedGen, metrics.average);
      draftArenaState.scoreAttackNewRecord = isNewRecord;
      draftArenaState.scoreAttackPreviousRecord = previousRecord;
      draftArenaState.runSummary = {
        status: `${getDraftScoreAttackResultLabel(metrics.average)} • Moyenne ${metrics.average}${isNewRecord ? " 🏆 NOUVEAU RECORD !" : ""}`,
        mvpName: draftArenaState.team
          .slice()
          .sort((left, right) => (getDraftCachedPokemonPowerData(right.pokemon).statGlobal || 0) - (getDraftCachedPokemonPowerData(left.pokemon).statGlobal || 0))[0]?.pokemon?.name || "-",
        balanceLabel: `Total BST ${metrics.total}`,
        offenseLabel: `${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""} restant${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}${previousRecord > 0 ? ` • Précédent record : ${previousRecord}` : ""}`,
      };
      draftArenaState.message = isNewRecord
        ? `🏆 NOUVEAU RECORD Gen ${draftArenaState.selectedGen} : moyenne BST ${metrics.average} ! (avant : ${previousRecord || 0})`
        : `Score Attack terminé : moyenne BST ${metrics.average}. ${getDraftScoreAttackResultLabel(metrics.average)}.`;
      // XP + quêtes Score Attack
      awardXp(Math.round(metrics.average / 10), `Score Attack ${metrics.average} BST`);
      if (isNewRecord) awardXp(50, "Nouveau record Score Attack");
      progressQuest("score_attack_500", metrics.average);
      progressQuest("score_attack_600", metrics.average);
      progressQuest("draft_complete", 1);
      submitDraftScoreAttackResult(metrics);
      renderDraftArena();
      return;
    }
    await prepareDraftArenaBattleRun();
    if (draftArenaState) {
      draftArenaState.message = `Équipe complète ! Clique "Lancer le duel" pour affronter la première arène.`;
    }
    return;
  } else {
    const remain = DRAFT_TEAM_SIZE - draftArenaState.team.length;
    draftArenaState.message = `Pokémon ajouté. Encore ${remain} choix.`;
    replaceDraftArenaOption(optionIndex);
  }

  renderDraftArena();
}

function updateDraftRankChip(gen) {
  if (!window.__pokedleAuthed || !gen) return;
  var el = document.getElementById("dsh-rank-val");
  if (!el) return;
  window.__draftRankCache = window.__draftRankCache || {};
  var c = window.__draftRankCache[gen];
  if (c && Date.now() - c.t < 15000) { el.textContent = c.rank ? "#" + c.rank : "\u2013"; return; }
  fetch("/api/leaderboard?mode=draft_" + gen, { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var rank = d && d.me ? d.me.rank : null;
      window.__draftRankCache[gen] = { rank: rank, t: Date.now() };
      var e = document.getElementById("dsh-rank-val");
      if (e) e.textContent = rank ? "#" + rank : "\u2013";
    })
    .catch(function () {});
}
function animateDraftCount(el, target) {
  if (!el) return;
  target = Number(target) || 0;
  var dur = 900, start = performance.now();
  function tick(now) {
    var t = Math.min(1, (now - start) / dur);
    var eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick); else el.textContent = target;
  }
  requestAnimationFrame(tick);
}
function launchDraftConfetti(container) {
  if (!container) return;
  var colors = ["#2f76ff", "#e4382f", "#ffcc33", "#7a2bd0", "#1f8a37"];
  var layer = document.createElement("div");
  layer.className = "dse-confetti";
  for (var i = 0; i < 42; i++) {
    var p = document.createElement("span");
    p.style.left = (Math.random() * 100) + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.35) + "s";
    layer.appendChild(p);
  }
  container.appendChild(layer);
  setTimeout(function () { layer.remove(); }, 2800);
}
function shareDraftScore() {
  try {
    if (typeof draftArenaState === "undefined" || !draftArenaState) return;
    var avg = getDraftTeamBstMetrics(draftArenaState.team).average;
    var gen = draftArenaState.selectedGen;
    var label = getDraftScoreAttackResultLabel(avg);
    var txt = "\ud83c\udfaf Draft Score Attack \u2014 Gen " + gen + " : moyenne BST " + avg + " (" + label + ") sur Pok\u00e9dle ! https://pokdle.onrender.com";
    if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(function () { if (typeof showToast === "function") showToast("R\u00e9sultat copi\u00e9 !"); }).catch(function () {}); }
  } catch (e) {}
}
window.shareDraftScore = shareDraftScore;
function renderDraftArena() {
  const screen = document.getElementById(draftArenaState?.mode === "scoreAttack" ? "screen-draft-score-attack" : "screen-draft-arena");
  if (!screen || !draftArenaState) return;
  saveDraftArenaProgress();
  mountDraftModeCard(draftArenaState.mode);

  const status = document.getElementById("draft-status");
  const genBadge = document.getElementById("draft-gen-badge");
  const picksBadge = document.getElementById("draft-picks-badge");
  const shinyBadge = document.getElementById("draft-shiny-badge");
  const averageBadge = document.getElementById("draft-bst-average-badge");
  const badgeCount = document.getElementById("draft-badge-count");
  const genButtons = document.getElementById("draft-gen-buttons");
  const options = document.getElementById("draft-options");
  const team = document.getElementById("draft-team");
  const teamMetrics = document.getElementById("draft-team-metrics");
  const runBar = document.getElementById("draft-run-bar");
  const resultWrap = document.getElementById("draft-result-wrap");
  const resultTitle = document.getElementById("draft-result-title");
  const runSummary = document.getElementById("draft-run-summary");
  const badgeGrid = document.getElementById("draft-badge-grid");
  const arenaList = document.getElementById("draft-arena-list");
  const battleLaunch = document.getElementById("draft-battle-launch");
  const battleClose = document.getElementById("draft-battle-close");
  const battlePokemonSelect = document.getElementById("draft-battle-pokemon");
  const scoreRerollButton = document.getElementById("draft-score-reroll");
  const scoreRoomCreate = document.getElementById("draft-score-room-create");
  const scoreRoomJoin = document.getElementById("draft-score-room-join");
  const scoreRoomLeave = document.getElementById("draft-score-room-leave");
  const scoreRoomStatus = document.getElementById("draft-score-room-status");
  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];
  const pageTitle = screen.querySelector(".ranking-head .card-title");
  const pageDesc = screen.querySelector(".draft-card > .card-desc");
  const isScoreAttackMode = draftArenaState.mode === "scoreAttack";

  if (pageTitle) pageTitle.textContent = isScoreAttackMode ? "🎯 Draft Score Attack" : "🎴 Draft Arènes";
  if (pageDesc) {
    pageDesc.textContent = isScoreAttackMode
      ? "Drafte 6 Pokémon, optimise la moyenne BST et défie un ami en 1v1 Score."
      : "Choisis une génération, drafte 6 Pokémon, puis découvre les badges que ton équipe peut réellement viser.";
  }

  if (status) status.textContent = draftArenaState.message;
  if (genBadge) genBadge.textContent = draftArenaState.selectedGen ? `Génération : ${draftGenLabel(draftArenaState.selectedGen)}` : "Génération : -";
  if (picksBadge) picksBadge.textContent = `Équipe : ${draftArenaState.team.length} / ${DRAFT_TEAM_SIZE}`;
  if (shinyBadge) shinyBadge.textContent = `Shiny : ${draftArenaState.shinyCount}`;
  const bstMetrics = getDraftTeamBstMetrics(draftArenaState.team);
  if (averageBadge) {
    averageBadge.textContent = `Moy. BST : ${bstMetrics.average || "-"}`;
    averageBadge.dataset.state = bstMetrics.average >= 550 ? "complete" : bstMetrics.average >= 500 ? "progress" : "empty";
  }
  const restartBtn = document.getElementById("draft-restart-btn");
  if (restartBtn) {
    const isDuel = Boolean(draftArenaState.duelMode && draftArenaState.scoreAttackRoom);
    const room = draftArenaState.scoreAttackRoom;
    const selfRoom = room ? getDraftScoreAttackRoomSelf(room) : null;
    const isLiveDuel = isDuel && room?.status === "live";
    if (isDuel) {
      restartBtn.textContent = isLiveDuel ? "⏳ Partie en cours…" : (selfRoom?.isHost ? "🎮 Nouvelle partie" : "⏳ En attente de l'hôte");
      restartBtn.disabled = isLiveDuel || !selfRoom?.isHost;
    } else {
      restartBtn.textContent = "🎲 Nouveau draft";
      restartBtn.disabled = false;
    }
  }
  const recordBadge = document.getElementById("draft-score-record-badge");
  if (recordBadge) {
    const isScoreAttack = draftArenaState.mode === "scoreAttack";
    const record = isScoreAttack ? getDraftScoreAttackRecord(draftArenaState.selectedGen) : 0;
    if (isScoreAttack && draftArenaState.selectedGen) {
      recordBadge.classList.remove("hidden");
      recordBadge.textContent = `🏆 Record Gen ${draftArenaState.selectedGen} : ${record || "-"}`;
      if (draftArenaState.scoreAttackNewRecord) recordBadge.classList.add("is-new-record");
      else recordBadge.classList.remove("is-new-record");
    } else {
      recordBadge.classList.add("hidden");
      recordBadge.classList.remove("is-new-record");
    }
  }
  const wonCount = draftArenaState.badgeResults.filter((result) => result.status === "won").length;

  const progressRatio = Math.max(0, Math.min(1, (draftArenaState.team.length || 0) / DRAFT_TEAM_SIZE));
  const progressWrap = screen.querySelector(".draft-progress");
  if (progressWrap) {
    progressWrap.style.setProperty("--draft-progress-fill", `${Math.round(progressRatio * 100)}%`);
    progressWrap.dataset.stage = draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "ready" : draftArenaState.selectedGen ? "drafting" : "idle";
  }
  if (genBadge) genBadge.dataset.state = draftArenaState.selectedGen ? "selected" : "empty";
  if (picksBadge) picksBadge.dataset.state = draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "complete" : draftArenaState.team.length > 0 ? "progress" : "empty";
  if (badgeCount) badgeCount.dataset.state = wonCount > 0 ? "active" : "empty";
  if (badgeCount) badgeCount.textContent = draftArenaState.mode === "scoreAttack"
    ? `Rerolls : ${draftArenaState.scoreAttackRerollsLeft}`
    : `Badges : ${wonCount} / 8`;

  if (battlePokemonSelect) {
    const battleTeam = draftArenaState.team.filter((entry) => entry?.pokemon);
    const hasMultipleChoices = battleTeam.length > 1;
    const selectedId = Number(draftArenaState.selectedBattlePokemonId) || battleTeam[0]?.pokemon?.id || "";

    if (battleTeam.length && !battleTeam.some((entry) => Number(entry.pokemon.id) === Number(selectedId))) {
      draftArenaState.selectedBattlePokemonId = battleTeam[0].pokemon.id;
    } else if (!battleTeam.length) {
      draftArenaState.selectedBattlePokemonId = null;
    }

    battlePokemonSelect.innerHTML = battleTeam.length
      ? battleTeam.map((entry) => `<option value="${entry.pokemon.id}">${escapeHtml(entry.pokemon.name)}</option>`).join("")
      : `<option value="">Pokémon du joueur indisponible</option>`;
    battlePokemonSelect.disabled = battleTeam.length <= 1;
    battlePokemonSelect.value = String(draftArenaState.selectedBattlePokemonId || battleTeam[0]?.pokemon?.id || "");
    battlePokemonSelect.title = hasMultipleChoices
      ? "Choisis le Pokémon à envoyer au duel."
      : battleTeam.length === 1
        ? "Un seul Pokémon disponible pour le duel."
        : "Drafte au moins un Pokémon pour lancer le duel.";
  }

  if (battleLaunch) {
    const battleMeta = buildDraftArenaBattleButtonMeta();
    battleLaunch.disabled = battleMeta.disabled;
    battleLaunch.title = battleMeta.title;
    battleLaunch.textContent = battleMeta.label;
    battleLaunch.classList.toggle("hidden", !DRAFT_BATTLE_ENABLED || draftArenaState.mode === "scoreAttack");
    battleLaunch.dataset.state = battleMeta.disabled ? "locked" : draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "ready" : "idle";
  }
  document.getElementById("draft-battle-friend")?.classList.toggle("hidden", draftArenaState.mode === "scoreAttack");
  document.getElementById("draft-battle-join")?.classList.toggle("hidden", draftArenaState.mode === "scoreAttack");
  if (scoreRoomCreate) {
    scoreRoomCreate.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || Boolean(draftArenaState.scoreAttackRoom));
    scoreRoomCreate.disabled = Boolean(draftArenaState.scoreAttackRoomPending);
  }
  if (scoreRoomJoin) {
    scoreRoomJoin.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || Boolean(draftArenaState.scoreAttackRoom));
    scoreRoomJoin.disabled = Boolean(draftArenaState.scoreAttackRoomPending);
  }
  if (scoreRoomLeave) {
    scoreRoomLeave.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom);
  }
  if (scoreRoomStatus) {
    scoreRoomStatus.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack");
    scoreRoomStatus.innerHTML = renderDraftScoreAttackRoomStatus();
  }
  const scoreAttackToggle = document.getElementById("draft-score-attack-toggle");
  if (scoreAttackToggle) {
    const isScoreMode = draftArenaState.mode === "scoreAttack";
    scoreAttackToggle.textContent = isScoreMode ? "🏟️ Mode Arènes" : "🎯 Score Attack";
    scoreAttackToggle.classList.toggle("is-active-mode", isScoreMode);
  }
  screen.classList.toggle("is-mode-score-attack", draftArenaState.mode === "scoreAttack");
  screen.classList.toggle("is-drafting", draftArenaState.mode === "scoreAttack" && draftArenaState.phase !== "gen");
  screen.classList.toggle("is-mode-arena", draftArenaState.mode !== "scoreAttack");
  if (scoreRerollButton) {
    const canReroll = draftArenaState.mode === "scoreAttack"
      && draftArenaState.phase === "draft"
      && Boolean(draftArenaState.selectedGen)
      && draftArenaState.scoreAttackRerollsLeft > 0;
    // En mode duel : visible uniquement pour l'host, désactivé si un joueur a déjà pick ou plus de rerolls
    if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom) {
      const room = draftArenaState.scoreAttackRoom;
      const selfRoom = getDraftScoreAttackRoomSelf(room);
      const duelRerollsLeft = Number(room?.duel?.rerollsLeft ?? 0);
      const someoneLocked = Boolean(room?.duel?.pendingSides?.length);
      const canHostReroll = Boolean(selfRoom?.isHost) && room?.status === "live" && !someoneLocked && duelRerollsLeft > 0;
      scoreRerollButton.classList.toggle("hidden", !selfRoom?.isHost || room?.status !== "live");
      scoreRerollButton.disabled = !canHostReroll;
      scoreRerollButton.textContent = `🔄 Relancer la vague duel (${duelRerollsLeft})`;
    } else {
      scoreRerollButton.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft");
      scoreRerollButton.disabled = !canReroll;
      scoreRerollButton.textContent = `Relancer la vague (${draftArenaState.scoreAttackRerollsLeft})`;
    }
  }
  if (battleClose && (!draftSimpleBattleDevUiState || document.getElementById("draft-dev-battle-panel")?.classList.contains("hidden"))) {
    battleClose.classList.add("hidden");
  }

  if (genButtons) {
    genButtons.innerHTML = "";
    const room = draftArenaState.scoreAttackRoom;
    const selfRoom = room ? getDraftScoreAttackRoomSelf(room) : null;
    const isDuelHost = Boolean(draftArenaState.mode === "scoreAttack" && room && selfRoom?.isHost);
    // L'host peut relancer à tout moment quand il y a 2 joueurs (live, lobby, finished)
    const canHostRelaunch = isDuelHost && (room?.players?.length || 0) === 2;
    for (const cfg of DRAFT_GEN_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "draft-gen-btn" + (draftArenaState.selectedGen === cfg.gen ? " active" : "");
      btn.textContent = cfg.label;
      btn.disabled = draftArenaState.phase !== "gen" && !canHostRelaunch;
      btn.addEventListener("click", () => selectDraftGeneration(cfg.gen));
      genButtons.appendChild(btn);
    }
  }

  if (options) {
    options.innerHTML = "";
    options.classList.toggle("duel-pending", Boolean(draftArenaState.duelMode && draftArenaState.duelPendingSelf));

    if (draftArenaState.phase === "gen") {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = "Sélectionne d'abord une génération.";
      options.appendChild(msg);
    } else if (draftArenaState.phase === "result" || draftArenaState.phase === "battle") {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = draftArenaState.evaluating
        ? "Préparation de la run en cours..."
        : draftArenaState.phase === "battle"
          ? "Ton équipe est prête. Lance ou poursuis l’arène en cours."
          : "Draft terminé. Consulte la run ci-dessous.";
      options.appendChild(msg);
    } else if (!draftArenaState.options.length) {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      // En duel actif : message d'attente du serveur. Sinon : message reset.
      if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom?.duel) {
        msg.textContent = "⏳ Chargement de la wave du duel… Si bloqué, l'hôte peut cliquer sur une génération pour relancer.";
      } else {
        msg.textContent = "Aucune option disponible. Réinitialise le draft.";
      }
      options.appendChild(msg);
    } else {
      let optionIdx = 0;
      for (const option of draftArenaState.options) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "dsc-card" + (option.shiny ? " is-shiny" : "") + (option.locked ? " picked locked" : "");
        card.style.setProperty("--draft-i", String(optionIdx));
        optionIdx += 1;
        const spriteId = getPokemonSpriteId(option.pokemon);
        const normalSprite = getPokemonSprite(option.pokemon);
        const shownSprite = option.shiny ? getPokemonShinySprite(option.pokemon) : normalSprite;
        const sparkle = option.shiny ? '<span class="draft-shiny-mark">&#10024; Shiny</span>' : "";
          const metrics = getDraftCachedPokemonPowerData(option.pokemon);
        const projectedAverage = draftArenaState.team.length < DRAFT_TEAM_SIZE
          ? Math.round((bstMetrics.total + metrics.statGlobal) / Math.max(1, draftArenaState.team.length + 1))
          : bstMetrics.average;
        const bstValue = Number(metrics.statGlobal) || 0;
        const rarity = bstValue >= 600 ? "legendary" : bstValue >= 500 ? "strong" : bstValue >= 400 ? "decent" : "common";
        card.dataset.rarity = rarity;
        if (option.pokemon.type1) card.dataset.type1 = option.pokemon.type1;
        const isScoreAttack = draftArenaState.mode === "scoreAttack";
        const canRerollOption = isScoreAttack && !option.locked && draftArenaState.scoreAttackRerollsLeft > 0 && !draftArenaState.duelMode;
        const rerollBtn = canRerollOption
          ? `<button type="button" class="draft-option-reroll" data-pokemon-id="${option.pokemon.id}" title="Reroll cette option (1 jeton)">↻</button>`
          : "";
        card.innerHTML = `
          ${rerollBtn}
          <div class="dsc-top"><span class="dsc-tier">${escapeHtml(metrics.rarityLabel)}</span><span class="dsc-bst">${metrics.statGlobal}</span></div>
          <div class="dsc-art"><img src="${shownSprite}" alt="${escapeHtml(option.pokemon.name)}" loading="lazy" data-fallback="${normalSprite}" /></div>
          <strong class="dsc-name">${escapeHtml(option.pokemon.name)}</strong>
          <div class="dsc-proj">Moy. <b>${projectedAverage}</b></div>
          ${sparkle}
        `;
        card.disabled = Boolean(option.locked);
        if (!option.locked) {
          card.addEventListener("click", (event) => {
            if (event.target?.closest(".draft-option-reroll")) return;
            card.classList.add("picked");
            setTimeout(() => {
              void pickDraftArenaOption(option.pokemon.id);
            }, 140);
          });
          if (canRerollOption) {
            const btn = card.querySelector(".draft-option-reroll");
            if (btn) btn.addEventListener("click", (event) => {
              event.stopPropagation();
              event.preventDefault();
              rerollDraftScoreAttackOption(option.pokemon.id);
            });
          }
        }
        options.appendChild(card);
      }
    }
  }

  if (team) {
    team.innerHTML = "";
    for (let index = 0; index < DRAFT_TEAM_SIZE; index += 1) {
      const member = draftArenaState.team[index];
      if (!member) {
        const empty = document.createElement("div");
        empty.className = "draft-team-card placeholder";
        empty.innerHTML = `
          <div class="draft-team-empty-icon">?</div>
          <div class="draft-team-card-body">
            <small class="draft-team-slot-label">Slot ${index + 1}</small>
            <b>Vide</b>
          </div>
        `;
        team.appendChild(empty);
        continue;
      }

      const normalSprite = getPokemonSprite(member.pokemon);
      const shownSprite = member.shiny ? getPokemonShinySprite(member.pokemon) : normalSprite;
      const item = document.createElement("div");
      const metrics = getDraftCachedPokemonPowerData(member.pokemon);
      const isLatest = index === draftArenaState.team.length - 1;
      const typesHtml = [member.pokemon.type1, member.pokemon.type2].filter(Boolean).map((type) => typeBadgeHtml(type)).join("");
      item.className = "draft-team-card" + (member.shiny ? " is-shiny" : "") + (isLatest ? " is-latest" : " is-filled");
      var __tb = Number(metrics.statGlobal) || 0; item.dataset.rarity = __tb >= 600 ? "legendary" : __tb >= 500 ? "strong" : __tb >= 400 ? "decent" : "common";
      item.innerHTML = `
        <img src="${shownSprite}" alt="${escapeHtml(member.pokemon.name)}" loading="lazy" data-fallback="${normalSprite}" />
        <div class="draft-team-card-body">
          <small class="draft-team-slot-label">Slot ${index + 1}${isLatest ? " • Nouveau" : ""}</small>
          <b>${escapeHtml(member.pokemon.name)}</b>
          <div class="draft-team-card-types">${typesHtml}</div>
          <small>Stat global ${metrics.statGlobal} • ${escapeHtml(metrics.rarityLabel)}</small>
        </div>
      `;
      team.appendChild(item);
    }
  }

  if (teamMetrics) {
    const currentTeamStatGlobal = draftArenaState.team.reduce((sum, member) => sum + (getDraftCachedPokemonPowerData(member.pokemon).statGlobal || 0), 0);
    const currentSynergy = draftArenaState.team.length ? getDraftTeamSynergy(draftArenaState.team.map((member) => ({ ...member, metrics: getDraftCachedPokemonPowerData(member.pokemon) }))) : null;
    teamMetrics.innerHTML = draftArenaState.team.length
      ? `
        <div class="draft-summary-card draft-score-main"><span>Moyenne BST</span><b>${bstMetrics.average}</b><small>${bstMetrics.rank?.label || (bstMetrics.nextTarget ? `${bstMetrics.nextTarget.min - bstMetrics.average} pts avant ${bstMetrics.nextTarget.label}` : "Objectif libre")}</small></div>
        <div class="draft-summary-card"><span>BST total</span><b>${currentTeamStatGlobal}</b></div>
        <div class="draft-summary-card"><span>Synergie</span><b>${draftArenaState.runSummary?.synergyLabel || currentSynergy?.label || "-"}</b></div>
        <div class="draft-summary-card"><span>${draftArenaState.mode === "scoreAttack" ? "Rerolls" : "Région"}</span><b>${draftArenaState.mode === "scoreAttack" ? draftArenaState.scoreAttackRerollsLeft : draftArenaState.selectedGen ? escapeHtml(draftGenLabel(draftArenaState.selectedGen)) : "-"}</b></div>
      `
      : "";
  }

  const scoreHero = document.getElementById("draft-score-hero");
  if (scoreHero) {
    if (draftArenaState.mode === "scoreAttack" && draftArenaState.selectedGen) {
      const avg = bstMetrics.average || 0;
      const pct = avg ? Math.max(4, Math.min(100, Math.round((avg / 600) * 100))) : 0;
      const rec = getDraftScoreAttackRecord(draftArenaState.selectedGen);
      const sub = bstMetrics.nextTarget
        ? (bstMetrics.nextTarget.min - avg) + " pts avant " + escapeHtml(bstMetrics.nextTarget.label)
        : (bstMetrics.rank ? "Palier " + escapeHtml(bstMetrics.rank.label) + " atteint !" : "Commence \u00e0 drafter");
      scoreHero.innerHTML =
        '<div class="dsh-main">' +
          '<div class="dsh-label">Moyenne BST</div>' +
          '<div class="dsh-score">' + (avg || "\u2013") + '</div>' +
          '<div class="dsh-gauge"><span style="width:' + pct + '%"></span></div>' +
          '<div class="dsh-sub">' + sub + '</div>' +
        '</div>' +
        '<div class="dsh-stats">' +
          '<div class="dsh-chip"><span>\ud83c\udfc6 Record G' + draftArenaState.selectedGen + '</span><b>' + (rec || "\u2013") + '</b></div>' +
          (window.__pokedleAuthed ? '<div class="dsh-chip dsh-chip-rank"><span>\ud83c\udfc5 Ton rang</span><b id="dsh-rank-val">\u2026</b></div>' : '') +
          '<div class="dsh-chip"><span>\ud83d\udd04 Rerolls</span><b>' + draftArenaState.scoreAttackRerollsLeft + '</b></div>' +
          '<div class="dsh-chip dsh-chip-team"><span>\ud83d\udc65 \u00c9quipe</span><b>' + draftArenaState.team.length + '/' + DRAFT_TEAM_SIZE + '</b></div>' +
        '</div>';
      scoreHero.classList.remove("hidden");
      updateDraftRankChip(draftArenaState.selectedGen);
      if (window.__lastDraftAvg != null && avg > window.__lastDraftAvg) { var __sc = scoreHero.querySelector(".dsh-score"); if (__sc) { __sc.classList.remove("is-gain"); void __sc.offsetWidth; __sc.classList.add("is-gain"); } }
      window.__lastDraftAvg = avg;
    } else {
      scoreHero.classList.add("hidden");
      scoreHero.innerHTML = "";
    }
  }

  const endActions = document.getElementById("draft-end-actions");
  if (endActions) {
    const draftFinished = draftArenaState.phase === "result" && draftArenaState.team.length >= DRAFT_TEAM_SIZE && !draftArenaState.evaluating;
    const isDuelLive = Boolean(draftArenaState.duelMode && draftArenaState.scoreAttackRoom && draftArenaState.scoreAttackRoom.status === "live");
    if (draftFinished && !isDuelLive) {
      const isScore = draftArenaState.mode === "scoreAttack";
      const lbMode = "draft_" + (draftArenaState.selectedGen || "all");
      if (isScore) {
        const avg = bstMetrics.average || 0;
        const rankLabel = getDraftScoreAttackResultLabel(avg);
        const tier = avg >= 600 ? "master" : avg >= 550 ? "elite" : avg >= 500 ? "solide" : "rookie";
        const medal = avg >= 600 ? "👑" : avg >= 550 ? "🏆" : avg >= 500 ? "🥇" : "🎯";
        const isNew = Boolean(draftArenaState.scoreAttackNewRecord);
        const rec = getDraftScoreAttackRecord(draftArenaState.selectedGen);
        const recHtml = isNew
          ? `<div class="dse-record is-new">🎉 Nouveau record !</div>`
          : (rec ? `<div class="dse-record">Record Gen ${draftArenaState.selectedGen} : <b>${rec}</b></div>` : "");
        endActions.innerHTML =
          `<div class="dse-reveal" data-tier="${tier}">` +
            `<div class="dse-badge">${medal}</div>` +
            `<div class="dse-rank">${escapeHtml(rankLabel)}</div>` +
            `<div class="dse-score"><b class="dse-num" data-target="${avg}">0</b><small>Moyenne BST finale</small></div>` +
            recHtml +
            `<div class="dse-buttons">` +
              `<button type="button" class="btn-yellow" data-action="restartDraftArenaRun">🎲 Nouvelle draft</button>` +
              `<button type="button" class="btn-blue" data-action="openLeaderboard" data-args='["${lbMode}"]'>🏆 Classement</button>` +
              `<button type="button" class="btn-ghost" data-action="shareDraftScore">📤 Partager</button>` +
            `</div>` +
          `</div>`;
        endActions.classList.remove("hidden");
        const revealKey = avg + "|" + (isNew ? "R" : "");
        if (endActions.dataset.revealKey !== revealKey) {
          endActions.dataset.revealKey = revealKey;
          try { animateDraftCount(endActions.querySelector(".dse-num"), avg); } catch (e) {}
          if (isNew) { try { launchDraftConfetti(endActions.querySelector(".dse-reveal")); } catch (e) {} }
        }
      } else {
        endActions.innerHTML =
          `<div class="draft-end-headline">🏆 Run terminée</div>` +
          `<div class="draft-end-buttons"><button type="button" class="btn-yellow" data-action="restartDraftArenaRun">🎲 Nouvelle draft</button></div>`;
        endActions.classList.remove("hidden");
      }
    } else {
      endActions.classList.add("hidden");
      endActions.innerHTML = "";
      endActions.dataset.revealKey = "";
    }
  }

  if (runBar) {
    runBar.innerHTML = arenas.map((arena, index) => {
      const result = draftArenaState.badgeResults[index];
      const statusClass = result?.status || (draftArenaState.phase === "result" && draftArenaState.evaluating ? "pending" : "pending");
      const isCurrent = draftArenaState.phase === "battle" && index === draftArenaState.currentArenaIndex && statusClass !== "won" && statusClass !== "blocked";
      const currentClass = isCurrent ? " is-current" : "";
      return `<div class="draft-run-node ${statusClass}${currentClass}" style="--draft-delay:${index * 80}ms">${getDraftBadgeMarkup(arena, statusClass)}<small>${index + 1}</small><b>${escapeHtml(arena.name)}</b><span>${escapeHtml(arena.type)}</span></div>`;
    }).join("");
  }

  if (resultWrap) {
    resultWrap.classList.toggle("hidden", draftArenaState.phase !== "result" && draftArenaState.phase !== "battle");
  }
  if (resultTitle) {
    resultTitle.textContent = draftArenaState.mode === "scoreAttack" ? "3) Résultat Score Attack" : "3) Résultats des arènes";
  }
  if (runSummary) {
    if (draftArenaState.phase !== "result" && draftArenaState.phase !== "battle") {
      runSummary.innerHTML = "";
    } else if (draftArenaState.evaluating) {
      runSummary.innerHTML = `<div class="draft-summary-card wide"><span>Analyse</span><b>Préparation de la run en cours...</b></div>`;
    } else if (draftArenaState.runSummary) {
      runSummary.innerHTML = `
        <div class="draft-summary-card"><span>Statut</span><b>${escapeHtml(draftArenaState.runSummary.status)}</b></div>
        <div class="draft-summary-card"><span>MVP</span><b>${escapeHtml(draftArenaState.runSummary.mvpName)}</b></div>
        <div class="draft-summary-card"><span>Lecture d'équipe</span><b>${escapeHtml(draftArenaState.runSummary.balanceLabel)}</b></div>
        <div class="draft-summary-card"><span>Tendance</span><b>${escapeHtml(draftArenaState.runSummary.offenseLabel)}</b></div>
      `;
    } else {
      runSummary.innerHTML = "";
    }
  }

  if (badgeGrid) {
    badgeGrid.innerHTML = "";
    for (const r of draftArenaState.badgeResults) {
      const b = document.createElement("div");
      b.className = "draft-badge-item " + r.status;
      b.style.setProperty("--draft-delay", `${badgeGrid.children.length * 90}ms`);
      b.innerHTML = `${getDraftBadgeMarkup(r.arena, r.status)}<b>${escapeHtml(r.arena.name)}</b><small>${r.arena.badgeName ? escapeHtml(r.arena.badgeName) : escapeHtml(r.arena.type)}</small><small>${r.status === "won" ? "Arène gagnée" : r.status === "blocked" ? "Arène de blocage" : "Arène non tentée"}</small>`;
      badgeGrid.appendChild(b);
    }
  }

  if (arenaList) {
    arenaList.innerHTML = "";
  }
}
const EMU_ROM_OPTIONS = [
  { label: "Pokemon Rouge Feu (FR)", url: "roms/Pokemon - Version Rouge Feu (FR).gba", core: "gba" },
  { label: "Pokemon Vert Feuille (FR)", url: "roms/Pokemon - Version Vert Feuille (FR).gba", core: "gba" },
  { label: "Pokemon Platine (FR)", url: "roms/DS/Pokemon - Version Platine (France).nds", core: "nds" },
];

let emulatorCustomRomUrl = "";
let emulatorCustomRomName = "";
let emulatorRunning = false;

function coreFromRomPath(pathOrName) {
  const src = String(pathOrName || "").toLowerCase();
  if (src.endsWith(".nds")) return "nds";
  if (src.endsWith(".gbc") || src.endsWith(".gb")) return "gb";
  return "gba";
}

function controlsHintForCore(core) {
  if (core === "nds") {
    return '<b>Touches DS:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>A = L</span> <span>S = R</span> <span>Flèches = direction</span> <span>Souris = écran tactile</span>';
  }
  if (core === "gb") {
    return '<b>Touches Game Boy:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>Flèches = direction</span>';
  }
  return '<b>Touches GBA:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>A = L</span> <span>S = R</span> <span>Flèches = direction</span>';
}

function renderEmuControlsHint(core) {
  const help = document.getElementById("emu-controls-help");
  if (!help) return;
  help.innerHTML = controlsHintForCore(core);
}

function setEmuStatus(message) {
  const status = document.getElementById("emu-status");
  if (status) status.textContent = message || "";
}

function initEmulatorMode() {
  const select = document.getElementById("emu-rom-select");
  const fileInput = document.getElementById("emu-rom-file");
  if (!select || !fileInput) return;

  select.innerHTML = "";
  for (const rom of EMU_ROM_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = rom.url;
    opt.textContent = `${rom.label} (${rom.core.toUpperCase()})`;
    select.appendChild(opt);
  }

  select.addEventListener("change", () => {
    emulatorCustomRomUrl = "";
    emulatorCustomRomName = "";
    const selected = EMU_ROM_OPTIONS.find((r) => r.url === select.value);
    renderEmuControlsHint(selected?.core || coreFromRomPath(select.value));
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".gba") && !lower.endsWith(".nds") && !lower.endsWith(".gbc") && !lower.endsWith(".gb")) {
      setEmuStatus("Fichier invalide: choisis une ROM .gba, .gbc, .gb ou .nds.");
      return;
    }

    if (emulatorCustomRomUrl) {
      try { URL.revokeObjectURL(emulatorCustomRomUrl); } catch (_err) {}
    }
    emulatorCustomRomUrl = URL.createObjectURL(file);
    emulatorCustomRomName = file.name;

    const core = coreFromRomPath(file.name);
    renderEmuControlsHint(core);
    setEmuStatus(`ROM chargee: ${file.name} (${core.toUpperCase()}). Clique sur Lancer.`);
  });

  renderEmuControlsHint("gba");
  setEmuStatus("Selectionne une ROM puis clique sur Lancer.");
}

function stopEmulatorSession(hardStop = false) {
  const screen = document.getElementById("screen-emulator");
  if (screen) screen.classList.add("hidden");

  const player = document.getElementById("emulator-player");
  if (player) player.innerHTML = "";

  const loader = document.getElementById("emulatorjs-loader");
  if (loader) loader.remove();

  document.querySelectorAll("audio, video").forEach((media) => {
    try {
      media.pause();
      media.src = "";
      media.load();
    } catch (_err) {}
  });

  try {
    delete window.EJS_player;
    delete window.EJS_core;
    delete window.EJS_gameUrl;
    delete window.EJS_startOnLoaded;
    delete window.EJS_defaultControls;
    delete window.EJS_controlScheme;
    delete window.EJS_mouse;
  } catch (_err) {
    window.EJS_player = undefined;
    window.EJS_core = undefined;
    window.EJS_gameUrl = undefined;
    window.EJS_startOnLoaded = undefined;
    window.EJS_defaultControls = undefined;
    window.EJS_controlScheme = undefined;
    window.EJS_mouse = undefined;
  }

  emulatorRunning = false;
  setEmuStatus("Emulateur arrete.");

  if (hardStop) {
    setTimeout(() => { window.location.reload(); }, 20);
  }
}

function closeEmulatorMode() {
  stopEmulatorSession(true);
}

function openEmulatorMode() {
  // Lot D audit : EmulatorJS exige une CSP permissive (unsafe-eval), servie
  // uniquement sur /emulateur. Depuis la page principale (CSP stricte), on
  // navigue en pleine page ; l'écran s'ouvre automatiquement à l'arrivée.
  if (window.location.pathname !== "/emulateur") {
    window.location.assign("/emulateur");
    return;
  }
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);

  const screen = document.getElementById("screen-emulator");
  if (screen) screen.classList.remove("hidden");
  setGlobalNavActive("emu");

  const select = document.getElementById("emu-rom-select");
  if (select && !select.options.length) initEmulatorMode();
}

function getSelectedEmuRom() {
  if (emulatorCustomRomUrl) {
    const core = coreFromRomPath(emulatorCustomRomName || emulatorCustomRomUrl);
    return { url: emulatorCustomRomUrl, core, label: emulatorCustomRomName || "ROM locale" };
  }

  const select = document.getElementById("emu-rom-select");
  const url = select ? select.value : "";
  const preset = EMU_ROM_OPTIONS.find((r) => r.url === url);
  if (preset) return preset;

  if (!url) return null;
  return { url, core: coreFromRomPath(url), label: url };
}

function launchSelectedEmuRom() {
  const rom = getSelectedEmuRom();
  if (!rom?.url) {
    setEmuStatus("Aucune ROM selectionnee.");
    return;
  }

  // EmulatorJS ne supporte pas d'être relancé sur la même page (re-déclare EJS_STORAGE -> écran noir).
  // Au 2e lancement, on recharge proprement la page et on reprend la ROM (presets en auto).
  if (window.__emuLoadedOnce) {
    if (emulatorCustomRomUrl) {
      setEmuStatus("Pour relancer une ROM locale, recharge la page (F5) puis recharge ton fichier.");
      return;
    }
    try { sessionStorage.setItem("emu_autostart", rom.url); } catch (e) {}
    setEmuStatus("Redémarrage de l'émulateur…");
    location.reload();
    return;
  }

  if (location.protocol === "file:") {
    setEmuStatus(`Mode file:// detecte. Lancement ${rom.core.toUpperCase()}: si echec, utilise le bouton fichier ou un serveur local.`);
  } else {
    setEmuStatus(`Chargement de l'emulateur ${rom.core.toUpperCase()}...`);
  }

  renderEmuControlsHint(rom.core);

  const player = document.getElementById("emulator-player");
  if (!player) return;

  player.innerHTML = '<div id="emulatorjs"></div>';

  window.EJS_player = "#emulatorjs";
  window.EJS_core = rom.core;
  window.EJS_gameUrl = rom.url;
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_startOnLoaded = true;
  window.EJS_controlScheme = rom.core;
  window.EJS_mouse = rom.core === "nds";
  window.EJS_defaultControls = {
    0: {
      0: { value: "x", value2: "BUTTON_2" },
      2: { value: "shift", value2: "SELECT" },
      3: { value: "enter", value2: "START" },
      4: { value: "up arrow", value2: "DPAD_UP" },
      5: { value: "down arrow", value2: "DPAD_DOWN" },
      6: { value: "left arrow", value2: "DPAD_LEFT" },
      7: { value: "right arrow", value2: "DPAD_RIGHT" },
      8: { value: "z", value2: "BUTTON_1" },
      10: { value: "a", value2: "LEFT_TOP_SHOULDER" },
      11: { value: "s", value2: "RIGHT_TOP_SHOULDER" },
      24: { value: "1" },
      25: { value: "2" },
      27: { value: "space" }
    },
    1: {},
    2: {},
    3: {}
  };

  const oldLoader = document.getElementById("emulatorjs-loader");
  if (oldLoader) oldLoader.remove();

  emulatorRunning = true;

  // Pré-check ROM (HEAD) — détecte ROM 404 / réseau pour message clair
  if (rom.url && /^https?:\/\//i.test(rom.url)) {
    fetch(rom.url, { method: "HEAD", mode: "cors" })
      .then((res) => {
        if (!res.ok) {
          setEmuStatus(`ROM introuvable (${res.status}). Vérifie l'URL ou choisis-en une autre.`);
        }
      })
      .catch(() => {
        setEmuStatus("ROM injoignable. Vérifie ta connexion ou choisis une autre source.");
      });
  }

  const script = document.createElement("script");
  script.id = "emulatorjs-loader";
  script.src = `${window.EJS_pathtodata}loader.js?v=${Date.now()}`;
  script.onload = () => {
    window.__emuLoadedOnce = true;
    setEmuStatus(`Emulateur ${rom.core.toUpperCase()} prêt. Si l'écran reste vide après 10s, recharge la page puis relance.`);
    // Watchdog : si après 12s aucun canvas EmulatorJS n'est apparu, on signale
    setTimeout(() => {
      if (!emulatorRunning) return;
      const playerNode = document.getElementById("emulator-player");
      const hasCanvas = playerNode?.querySelector("canvas, video");
      if (!hasCanvas) {
        setEmuStatus(`Émulateur lancé mais aucun affichage détecté (${rom.core.toUpperCase()}). ROM corrompue ? CDN indisponible ? Essaie de recharger la page.`);
      }
    }, 12000);
  };
  script.onerror = () => {
    emulatorRunning = false;
    setEmuStatus(`Échec de chargement EmulatorJS (${rom.core.toUpperCase()}). CDN injoignable — vérifie ta connexion internet.`);
  };
  document.body.appendChild(script);
}

// Reprise auto de l'émulateur après le reload de relance (presets uniquement).
(function () {
  function emuAutostart() {
    let url = null;
    try { url = sessionStorage.getItem("emu_autostart"); } catch (e) {}
    if (!url) return;
    try { sessionStorage.removeItem("emu_autostart"); } catch (e) {}
    if (!EMU_ROM_OPTIONS.some((r) => r.url === url)) return;
    if (typeof openEmulatorMode === "function") openEmulatorMode();
    const select = document.getElementById("emu-rom-select");
    if (select) select.value = url;
    if (typeof launchSelectedEmuRom === "function") setTimeout(launchSelectedEmuRom, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", emuAutostart);
  else emuAutostart();
})();
// CHALLENGE MODE
