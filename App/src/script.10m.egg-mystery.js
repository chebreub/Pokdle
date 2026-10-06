
let eggState = null, eggBusy = false, eggPoll = null, eggSelected = null, eggSuggestionIndex = -1, eggRequestSerial = 0;
let eggOwnedRewards = [];
const EGG_ERRORS = { unavailable:"Le défi communautaire est indisponible pour le moment. Réessaie dans un instant.", quota_reached:"Tu as utilisé tes propositions du jour.", already_guessed:"Quelqu’un vient déjà de rayer ce Pokémon. Ta proposition n’a pas été consommée.", already_solved:"L’Œuf vient d’être trouvé !", round_changed:"Une nouvelle enquête vient de commencer. Vérifie les indices avant de proposer.", invalid_pokemon:"Choisis un Pokémon dans la liste.", rate_limited:"Trop de requêtes rapprochées. Réessaie dans une minute.", not_winner:"Cette récompense appartient au gagnant de l’enquête." };
function eggNotice(message, error = false) {
  const node = document.getElementById("egg-notice"); if (!node) return;
  node.textContent = message; node.classList.toggle("is-error",error);
}
async function eggRequest(path, body) {
  const response = await fetch(path, { credentials:"same-origin", cache:"no-store", ...(body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)} : {}) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "unavailable");
  return data;
}
function openEggGame() {
  showScreen("screen-egg"); setGlobalNavActive("game");
  loadEggState(); loadEggRewards();
  if (!eggPoll) eggPoll = setInterval(() => {
    if (!document.hidden && !document.getElementById("screen-egg")?.classList.contains("hidden") && !eggBusy) loadEggState(true);
  },15000);
}
async function loadEggState(quiet = false) {
  const serial = ++eggRequestSerial;
  if (!quiet && !eggState) eggNotice("Chargement du défi…");
  try {
    const data = await eggRequest("/api/egg");
    if (serial !== eggRequestSerial) return;
    const previousRound = eggState?.roundId;
    eggState = data;
    if (previousRound && previousRound !== data.roundId) { eggSelected=null;document.getElementById("egg-input").value=""; }
    renderEggState();
    if (!quiet) eggNotice("");
  } catch (error) { if (serial === eggRequestSerial) eggNotice(EGG_ERRORS[error.message] || EGG_ERRORS.unavailable,true); }
}
function eggTimeLeft(date) {
  const ms = Math.max(0,new Date(date).getTime()-Date.now()), days = Math.floor(ms/86400000), hours = Math.floor(ms/3600000)%24, minutes=Math.floor(ms/60000)%60;
  return days ? `${days} j ${hours} h` : `${hours} h ${minutes} min`;
}
function renderEggState() {
  const s = eggState; if (!s) return;
  document.getElementById("egg-content").classList.remove("hidden");
  document.getElementById("egg-reward-name").textContent = s.reward.name;
  document.getElementById("egg-reward-sprite").src = modeCatalogSpriteUrl(s.reward.id);
  document.getElementById("egg-reset").textContent = `Prochaine enquête dans ${eggTimeLeft(s.resetAt)} · lundi, 00 h à Paris`;
  document.getElementById("egg-eliminated").textContent = `${s.eliminatedIds.length} Pokémon rayés`;
  document.getElementById("egg-remaining").textContent = s.solved ? "Mystère résolu" : `1 chance sur ${s.remaining} pistes compatibles`;
  document.getElementById("egg-progress-bar").max = s.candidateIds.length;
  document.getElementById("egg-progress-bar").value = s.eliminatedIds.length;
  document.getElementById("egg-clues").innerHTML = s.clues.map(c => `<span>✓ ${escapeHtml(c.label)} : <b>${escapeHtml(String(c.value))}</b></span>`).join("") || '<span>Le premier indice arrive après 100 Pokémon rayés.</span>';
  document.getElementById("egg-next-clue").textContent = !s.solved && s.nextClueAt ? `${Math.max(0,s.nextClueAt-s.eliminatedIds.length)} nouvelles mauvaises pistes avant le prochain indice.` : "";
  const form = document.getElementById("egg-form"); form.classList.toggle("hidden",s.solved);
  document.getElementById("egg-input").disabled = !s.quota.remaining || s.solved || eggBusy;
  document.getElementById("egg-submit").disabled = !s.quota.remaining || s.solved || eggBusy;
  document.getElementById("egg-quota").textContent = s.quota.remaining ? `${s.quota.remaining} proposition${s.quota.remaining>1?"s":""} disponible${s.quota.remaining>1?"s":""} aujourd’hui.` : `Tes propositions reviennent dans ${eggTimeLeft(s.quotaResetAt)}.`;
  document.getElementById("egg-login").classList.toggle("hidden",s.authenticated);
  const finish = document.getElementById("egg-finish"); finish.classList.toggle("hidden",!s.solved);
  const found = s.feed.find(row => row.correct)?.pokemon;
  if (s.solved) finish.innerHTML = `<span class="club-eyebrow">L’ŒUF A ÉCLOS !</span><h2>${s.winner.me?"Tu as résolu le mystère !":escapeHtml(s.winner.name)+" a trouvé !"}</h2>${found?`<img src="${modeCatalogSpriteUrl(found.id)}" alt="" width="112" height="112"/><p>La bonne proposition était <b>${escapeHtml(found.name)}</b>.</p>`:"<p>L’enquête est terminée. Retrouve la prochaine lundi !</p>"}${s.canClaim?'<button class="btn-blue" data-action="claimEggReward">Récupérer mon compagnon</button>':s.winner.me&&!s.authenticated?'<p>Connecte-toi depuis ce navigateur pour recevoir ton compagnon.</p><button class="btn-blue" data-action="openLoginWelcome">Recevoir ma récompense</button>':''}<button class="btn-ghost" data-action="openAllModesScreen" data-args='["solo"]'>Choisir un autre jeu →</button>`;
  document.getElementById("egg-feed-list").innerHTML = s.feed.length ? s.feed.map(row=>`<li><img src="${modeCatalogSpriteUrl(row.pokemon.id)}" alt="" loading="lazy" width="40" height="40"/><span><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.pokemon.name)}</small></span><strong>${row.correct?"✓ Trouvé":"× Écarté"}</strong></li>`).join("") : '<li>Aucune proposition pour le moment. L’enquête commence avec toi.</li>';
  renderEggCatalog();
}
function renderEggCatalog() {
  const s=eggState, root=document.getElementById("egg-grid"); if (!s||!root) return;
  const eliminated=new Set(s.eliminatedIds), compatible=new Set(s.compatibleIds);
  const hideEliminated=document.getElementById("egg-hide-eliminated").checked,hideIncompatible=document.getElementById("egg-hide-incompatible").checked;
  const key=JSON.stringify([s.roundId,s.eliminatedIds,s.clues,s.solved,hideEliminated,hideIncompatible]);
  if(root.dataset.view===key)return;root.dataset.view=key;
  const groups=new Map();
  for(const id of s.candidateIds){const p=POKEMON_BY_ID.get(id);if(!p||(hideEliminated&&eliminated.has(id))||(hideIncompatible&&!compatible.has(id)))continue;if(!groups.has(p.gen))groups.set(p.gen,[]);groups.get(p.gen).push(p);}
  root.innerHTML=[...groups].sort((a,b)=>a[0]-b[0]).map(([gen,rows])=>`<details class="egg-generation" open><summary>Génération ${gen} <span>${rows.length} Pokémon affichés</span></summary><div class="egg-pokemon-grid">${rows.map(p=>`<button type="button" class="egg-pokemon ${eliminated.has(p.id)?"is-eliminated":""} ${!compatible.has(p.id)?"is-incompatible":""}" data-action="selectEggPokemon" data-args='[${p.id},true]' ${s.solved||eliminated.has(p.id)||!compatible.has(p.id)?"disabled":""} aria-label="${escapeHtml(p.name)}${eliminated.has(p.id)?", déjà rayé":!compatible.has(p.id)?", incompatible avec les indices":""}"><img src="${modeCatalogSpriteUrl(p.id)}" alt="" loading="lazy" decoding="async" width="48" height="48"/><span>${escapeHtml(p.name)}</span>${eliminated.has(p.id)?'<i aria-hidden="true">×</i>':''}</button>`).join("")}</div></details>`).join("") || '<p>Aucune piste ne correspond à ces filtres.</p>';
}
function filterEggSuggestions() {
  eggSelected=null;eggSuggestionIndex=-1;
  const input=document.getElementById("egg-input"), list=document.getElementById("egg-suggestions"), q=norm(input.value.trim());
  const matches=q&&eggState ? eggState.candidateIds.map(id=>POKEMON_BY_ID.get(id)).filter(p=>p&&norm(p.name).includes(q)&&!eggState.eliminatedIds.includes(p.id)).slice(0,8):[];
  list.innerHTML=matches.map(p=>`<button type="button" role="option" aria-selected="false" data-action="selectEggPokemon" data-args='[${p.id}]'><img src="${modeCatalogSpriteUrl(p.id)}" alt="" width="40" height="40"/><span><b>${escapeHtml(p.name)}</b><small>${comparisonTypeHtml(p.type1)}${p.type2?comparisonTypeHtml(p.type2):""}</small></span></button>`).join("");
  list.classList.toggle("hidden",!matches.length);input.setAttribute("aria-expanded",String(Boolean(matches.length)));
}
function selectEggPokemon(id, scroll=false) {
  if(!eggState?.candidateIds.includes(Number(id)))return;
  const p=POKEMON_BY_ID.get(Number(id));if(!p)return;eggSelected=p.id;
  const input=document.getElementById("egg-input");input.value=p.name;input.setAttribute("aria-expanded","false");
  document.getElementById("egg-suggestions").classList.add("hidden");
  if(scroll)document.getElementById("egg-form").scrollIntoView({behavior:"smooth",block:"center"});
}
function eggSuggestionKeydown(event) {
  const items=[...document.querySelectorAll("#egg-suggestions:not(.hidden) button")];
  if(event.key==="Escape"){document.getElementById("egg-suggestions").classList.add("hidden");event.target.setAttribute("aria-expanded","false");return;}
  if(["ArrowDown","ArrowUp"].includes(event.key)&&items.length){event.preventDefault();eggSuggestionIndex=(eggSuggestionIndex+(event.key==="ArrowDown"?1:items.length-1)+items.length)%items.length;items.forEach((item,i)=>item.setAttribute("aria-selected",String(i===eggSuggestionIndex)));}
  if(event.key==="Enter"&&items[eggSuggestionIndex]){event.preventDefault();items[eggSuggestionIndex].click();}
}
async function submitEggGuess(event) {
  event?.preventDefault?.();if(eggBusy||!eggState||eggState.solved)return;
  const input=document.getElementById("egg-input");
  const p=POKEMON_BY_ID.get(eggSelected)||eggState.candidateIds.map(id=>POKEMON_BY_ID.get(id)).find(p=>p&&norm(p.name)===norm(input.value.trim()));
  if(!p){eggNotice(EGG_ERRORS.invalid_pokemon,true);return;}
  eggBusy=true;renderEggState();eggNotice("Validation de ta proposition…");
  let message;
  try {
    const result=await eggRequest("/api/egg/guess",{roundId:eggState.roundId,pokemonId:p.id});
    if(result.claimAfterLogin)try{localStorage.setItem("pokedle_egg_pending",String(eggState.roundId));}catch(_error){}
    message=result.correct ? (result.reward?`${result.reward.name} et l’insigne de cette enquête rejoignent tes récompenses !`:"Bravo ! Connecte-toi pour récupérer ton compagnon.") : `${p.name} est rayé pour toute la communauté.`;
    input.value="";eggSelected=null;
    if(result.reward)await loadEggRewards();
  } catch(error){message=EGG_ERRORS[error.message]||EGG_ERRORS.unavailable;}
  finally {eggBusy=false;await loadEggState(true);eggNotice(message);}
}
async function claimEggReward() {
  let pending=null;try{pending=localStorage.getItem("pokedle_egg_pending");}catch(_error){}
  try{const result=await eggRequest("/api/egg/claim",{roundId:eggState?.canClaim?eggState.roundId:Number(pending)});try{localStorage.removeItem("pokedle_egg_pending");}catch(_error){}eggNotice(`${result.reward.name} et l’insigne sont enregistrés dans ton profil.`);await loadEggRewards();await loadEggState(true);}catch(error){eggNotice(EGG_ERRORS[error.message]||EGG_ERRORS.unavailable,true);}
}
async function loadEggRewards() {
  if(!connectedAccountUser){eggOwnedRewards=[];renderEggRewards();return;}
  try{const result=await eggRequest("/api/egg/rewards");eggOwnedRewards=result.rewards;renderEggRewards();}catch(_error){}
}
function renderEggRewards() {
  const anchor=document.getElementById("profile-favorite-card");if(!anchor)return;
  let card=document.getElementById("egg-earned-rewards");
  if(!card){card=document.createElement("section");card.id="egg-earned-rewards";anchor.after(card);}
  card.classList.toggle("hidden",!eggOwnedRewards.length);
  card.innerHTML='<h3>Compagnons de l’Œuf</h3><p>Ces insignes sont attribués par le serveur au gagnant de chaque enquête.</p><div>'+eggOwnedRewards.map(r=>`<article><img src="${modeCatalogSpriteUrl(r.pokemon.id)}" alt="" width="80" height="80"/><b>${escapeHtml(r.pokemon.name)}</b><span>◒ Enquête du ${new Date(r.weekStart).toLocaleDateString("fr-FR",{timeZone:"Europe/Paris"})}</span><button class="btn-ghost" data-action="choosePartner" data-args='[${r.pokemon.id}]'>Choisir comme compagnon</button></article>`).join("")+'</div>';
}
if(typeof window!=="undefined")window.addEventListener("pokedle:auth-ready",()=>{loadEggRewards();let pending=null;try{pending=localStorage.getItem("pokedle_egg_pending");}catch(_error){}if(pending)claimEggReward();});
