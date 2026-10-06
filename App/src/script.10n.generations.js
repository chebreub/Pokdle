// One generation picker for discovery and the solo modes that already filter their pool.
const GENERATION_PREFERENCE_KEY = 'pokedle_generations_v1';
const GENERATION_MODE_START = Object.freeze({normal:'startNormalGame',silhouette:'startSilhouetteGame',pixel:'startPixelGame',cry:'startCryGame',mystery:'startMysteryStatGame',description:'startDescriptionMode',weight:'startWeightBattle',evolution:'startEvolutionChainGame',order:'startPokedexOrderGame',odd:'openOddOneOutMode'});
let generationPickerDraft = new Set(), generationPickerMode = null;
function validGenerationChoices(values) {
  const valid = [...new Set((Array.isArray(values)?values:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=9))].sort((a,b)=>a-b);
  return valid.length ? valid : [1];
}
const savedGenerationPreference = readJson(GENERATION_PREFERENCE_KEY, null);
if(Array.isArray(savedGenerationPreference)) selectedGens = new Set(validGenerationChoices(savedGenerationPreference));
function generationChoiceSummary(values = [...selectedGens]) {
  const gens=validGenerationChoices(values);
  return gens.length===9 ? 'Toutes les régions' : gens.length<=2 ? gens.map(n=>GENERATIONS[n].label).join(' + ') : `${gens.length} générations`;
}
function renderGenerationSummaries() {
  document.querySelectorAll('[data-generation-summary]').forEach(node=>node.textContent=generationChoiceSummary());
}
function openGenerationPicker(mode = null) {
  generationPickerMode = GENERATION_MODE_START[mode] ? mode : null;
  generationPickerDraft = new Set(selectedGens);
  const cards=Object.entries(GENERATIONS).map(([n,gen])=>`<button type="button" class="generation-choice" data-generation="${n}" data-action="toggleGenerationChoice" data-args='[${n}]' aria-pressed="false"><span class="generation-choice-check" aria-hidden="true">✓</span><span class="generation-choice-number">GÉNÉRATION ${n}</span><strong>${escapeHtml(gen.label)}</strong><small>${getPokemonCountForGeneration(Number(n),{includeAltForms:false})} Pokémon</small></button>`).join('');
  ensureOverlay('Choisis tes générations',`<section class="generation-picker"><p class="generation-picker-intro">Retrouve les Pokémon des régions que tu connais… ou explore de nouveaux horizons.</p><div class="generation-picker-presets"><button type="button" data-action="presetGenerationChoices" data-args='["all"]'>Toutes les régions</button><button type="button" data-action="presetGenerationChoices" data-args='["kanto"]'>Kanto seulement</button><span id="generation-picker-summary" aria-live="polite"></span></div><div class="generation-picker-grid" role="group" aria-label="Générations incluses">${cards}</div><p class="generation-picker-note">${generationPickerMode?'Une nouvelle partie commencera avec ta sélection.':'Pour l’Illimité, Zoom, Pixelisé, Cri, Description, Stat Mystère, Intrus, Poids, Évolutions et Ordre Pokédex. Le Daily reste commun à tous.'}</p><div class="generation-picker-actions"><button type="button" class="btn-ghost" data-action="closeOverlayModal">Annuler</button><button type="button" class="btn-blue" data-action="applyGenerationChoices">${generationPickerMode?'Appliquer et jouer':'Enregistrer ma sélection'}</button></div></section>`);
  document.getElementById('overlay-modal').dataset.kind='generations';
  renderGenerationPicker();
}
function renderGenerationPicker() {
  document.querySelectorAll('.generation-choice').forEach(button=>{
    const selected=generationPickerDraft.has(Number(button.dataset.generation));
    button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));
  });
  const total=[...generationPickerDraft].reduce((n,gen)=>n+getPokemonCountForGeneration(gen,{includeAltForms:false}),0);
  const summary=document.getElementById('generation-picker-summary');
  if(summary)summary.textContent=`${generationPickerDraft.size} génération${generationPickerDraft.size>1?'s':''} · ${total} Pokémon`;
}
function toggleGenerationChoice(gen) {
  if(!GENERATIONS[gen])return;
  if(generationPickerDraft.has(gen)){if(generationPickerDraft.size===1)return;generationPickerDraft.delete(gen);}else generationPickerDraft.add(gen);
  renderGenerationPicker();
}
function presetGenerationChoices(preset) {
  generationPickerDraft=new Set(preset==='all'?Object.keys(GENERATIONS).map(Number):[1]);renderGenerationPicker();
}
function applyGenerationChoices() {
  const choices=validGenerationChoices([...generationPickerDraft]), mode=generationPickerMode;
  setSelectedGenerations(choices);writeJson(GENERATION_PREFERENCE_KEY,choices);renderGenerationSummaries();closeOverlayModal();
  if(mode)window[GENERATION_MODE_START[mode]]();
}
function renderGameGenerationControl() {
  const button=document.getElementById('game-generation-choice');if(!button)return;
  const supported=Boolean(GENERATION_MODE_START[gameMode])&&!(typeof isPartySessionActive==='function'&&isPartySessionActive());
  button.classList.toggle('hidden',!supported);
  button.dataset.args=JSON.stringify([gameMode]);renderGenerationSummaries();
}
document.addEventListener('DOMContentLoaded',renderGenerationSummaries);
