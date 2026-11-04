
// 🔊 Sons officiels des hautes herbes (4/11/2026, choix de Kayan : « go son officiel au moins un peu »).
// Les sons de capture de Pokémon GO (App/sfx/go/) remplacent les sons faits maison du lancer, de l'aspiration,
// de la chute, des secousses, du « gotcha » et de la sortie de la Ball ; plus l'apparition et la fuite.
// Des effets seulement, jamais de fanfare ni de mélodie (pas de musique). Ils suivent « Effets sonores » et le volume.
// Tant qu'un fichier n'est pas chargé, le son fait maison d'avant reste.
var GO_SFX_FILES = { throw: 'throw', absorb: 'absorb', land: 'land', shake1: 'shake1', shake2: 'shake2', caught: 'caught', breakFree: 'breakfree', appear: 'appear', flee: 'flee' };
var goSfxBuffers = {}, goSfxLoading = null, goSfxShake = 0;
function goSfxLoad() {
  if (goSfxLoading) return goSfxLoading;
  var ctx = typeof getPokedexFxAudioContext === 'function' ? getPokedexFxAudioContext() : null;
  if (!ctx || typeof fetch !== 'function') return Promise.resolve();
  goSfxLoading = Promise.all(Object.keys(GO_SFX_FILES).map(function (key) {
    return fetch('/sfx/go/' + GO_SFX_FILES[key] + '.mp3').then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (buf) { return buf ? new Promise(function (ok) { ctx.decodeAudioData(buf, ok, function () { ok(null); }); }) : null; })
      .then(function (audio) { if (audio) goSfxBuffers[key] = audio; }).catch(function () {});
  }));
  return goSfxLoading;
}
// true quand le son officiel a été joué (sinon on garde le son fait maison).
function goSfxPlay(key, gain) {
  var ctx = typeof getPokedexFxAudioContext === 'function' ? getPokedexFxAudioContext() : null;
  if (!ctx) return true; // effets coupés : rien du tout
  var buf = goSfxBuffers[key];
  if (!buf) { goSfxLoad(); return false; }
  try {
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = (gain || 0.8) * (typeof appSoundVolume === 'function' ? appSoundVolume() : 1);
    src.connect(g); g.connect(ctx.destination); src.start();
  } catch (_e) { return false; }
  return true;
}
if (typeof moSfx === 'function') {
  var moSfxBeforeGo = moSfx;
  moSfx = function (kind) {
    var key = kind === 'tick' ? (goSfxShake++ % 2 ? 'shake2' : 'shake1') : kind;
    if (GO_SFX_FILES[key] && goSfxPlay(key)) return;
    // L'ouverture et la fermeture de la Ball sont déjà dans l'aspiration et la chute officielles.
    if ((kind === 'ballOpen' || kind === 'close') && goSfxBuffers.absorb) return;
    return moSfxBeforeGo.apply(this, arguments);
  };
}
if (typeof renderWildEncounter === 'function') {
  var renderWildEncounterBeforeGo = renderWildEncounter;
  renderWildEncounter = function (state, message, intro) {
    goSfxLoad();
    if (intro) goSfxPlay('appear', 0.7);
    return renderWildEncounterBeforeGo.apply(this, arguments);
  };
}
if (typeof renderWildEnd === 'function') {
  var renderWildEndBeforeGo = renderWildEnd;
  renderWildEnd = function (state, outcome) {
    if (outcome && outcome.fled) goSfxPlay('flee', 0.8);
    return renderWildEndBeforeGo.apply(this, arguments);
  };
}
