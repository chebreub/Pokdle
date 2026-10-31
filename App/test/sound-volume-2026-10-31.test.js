'use strict';
// The settings' volume (31/10/2026): one slider from 10 to 100 % for the effects and the cries;
// every cry outside the Cry game obeys « Cris des Pokémon ».
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
const settingsSrc = read('src/script.07.delegation-party.js');

function volumeApi(stored) {
  const code = between(settingsSrc, 'const DEFAULT_APP_SETTINGS', 'function saveAppSettings(');
  const env = {
    window: { matchMedia: () => ({ matches: false }) },
    localStorage: { getItem: () => (stored ? JSON.stringify(stored) : null) },
    APP_SETTINGS_STORAGE_KEY: 'k',
    console,
  };
  return Function(...Object.keys(env), code + '; return { appSoundVolume, appVolumeLabel, DEFAULT_APP_SETTINGS, getStoredAppSettings };')(...Object.values(env));
}

test('the volume goes from 10 to 100 %, and stays at 100 % for those who never touched it', () => {
  const api = volumeApi(null);
  assert.equal(api.DEFAULT_APP_SETTINGS.soundVolume, 100);
  assert.equal(api.appSoundVolume(), 1);
  assert.equal(api.appSoundVolume({ soundVolume: 40 }), 0.4);
  assert.equal(api.appSoundVolume({ soundVolume: '70' }), 0.7);
  assert.equal(api.appSoundVolume({ soundVolume: 0 }), 0.1, 'never fully silent: the switches turn sounds off');
  assert.equal(api.appSoundVolume({ soundVolume: 250 }), 1);
  assert.equal(api.appSoundVolume({ soundVolume: 'fort' }), 1);
  assert.equal(api.appSoundVolume({}), 1, 'settings saved before the slider existed');
  assert.equal(api.appVolumeLabel(30), '30 %');
  assert.equal(volumeApi({ soundVolume: 30 }).appSoundVolume(), 0.3, 'read from the saved settings');
});

test('the settings show the slider with its value and a test button', () => {
  const modal = between(settingsSrc, 'function openSettingsModal()', 'function confirmResetProgression(');
  assert.match(modal, /<input id="app-volume" type="range" min="10" max="100" step="10" value="\$\{Math\.round\(appSoundVolume\(settings\) \* 100\)\}"[^>]*data-input-action="appVolumePreview" data-change-action="appVolumeFromEl" \/>/);
  assert.match(modal, /<output id="app-volume-value" for="app-volume">\$\{appVolumeLabel\(settings\.soundVolume\)\}<\/output>/);
  assert.match(modal, /data-action="testAppSound">▶ Tester<\/button>/);
  assert.ok(modal.indexOf('data-setting="pokemonCries"') < modal.indexOf('id="app-volume"'), 'right under the two sound switches');
});

function cryApi(settings) {
  const src = read('src/script.03.minijeux.js');
  const code = between(src, 'let __draftBattleCryAudio = null;', 'function updateCryPanel(');
  const played = [];
  class Audio { constructor(url) { this.url = url; this.volume = 1; } play() { played.push({ url: this.url, volume: this.volume }); return Promise.resolve(); } pause() {} }
  const env = { Audio, getStoredAppSettings: () => settings, appSoundVolume: (s) => (Number(s.soundVolume) || 100) / 100, getPokemonCryUrl: (p) => 'cry-' + p.id };
  const api = Function(...Object.keys(env), code + '; return { playPokemonCry };')(...Object.values(env));
  return { api, played };
}

test('a cry outside the Cry game follows « Cris des Pokémon » and the volume', () => {
  let run = cryApi({ pokemonCries: true, soundVolume: 50 });
  run.api.playPokemonCry({ id: 25 }, 0.6);
  assert.deepEqual(run.played, [{ url: 'cry-25', volume: 0.3 }]);
  run = cryApi({ pokemonCries: false, soundVolume: 100 });
  run.api.playPokemonCry({ id: 25 });
  assert.deepEqual(run.played, [], 'cries turned off: silence, even from the trainer card or the Pokédex');
  // The Cry game is the one place a cry always plays, at the chosen volume.
  assert.match(between(read('src/script.03.minijeux.js'), 'function playCrySound()', 'let __draftBattleCryAudio'), /cryAudio\.volume = typeof appSoundVolume === "function" \? appSoundVolume\(\) : 1;/);
});

test('the sound effects are played at the chosen volume', () => {
  const src = read('src/script.10c.pokedex-effects.js');
  const code = between(src, 'function pokedexFxTone(', 'function playPokedexRegistrationCry(');
  const gains = [];
  const ctx = {
    currentTime: 0,
    createOscillator: () => ({ type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }),
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime: (value) => gains.push(value) }, connect() {} }),
    destination: {},
  };
  const env = { getPokedexFxAudioContext: () => ctx, appSoundVolume: () => 0.5 };
  const api = Function(...Object.keys(env), code + '; return { playPokedexUiSfx };')(...Object.values(env));
  api.playPokedexUiSfx('correct');
  // « correct » is two notes at 0.025 and 0.028: each peak is halved.
  const peaks = gains.filter((value) => value > 0.001);
  assert.deepEqual(peaks.map((v) => Math.round(v * 10000) / 10000), [0.0125, 0.014]);
});
