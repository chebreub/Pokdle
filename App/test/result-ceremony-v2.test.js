"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const feel = fs.readFileSync(path.join(root, "src/script.10e.gamefeel.js"), "utf8");
const club = fs.readFileSync(path.join(root, "src/script.09.club.js"), "utf8");
const css = fs.readFileSync(path.join(root, "visual-refresh.css"), "utf8");

test("result ceremony reads collection state after the victory has been recorded", () => {
  const capture = feel.indexOf("const wasDiscovered=Boolean");
  const write = feel.indexOf("recordMatchHistoryBeforeGameFeel(entry)");
  const render = feel.indexOf("renderGameFeelResultProgress(entry,pokemon,changes,wasDiscovered)");
  assert.ok(capture >= 0 && write > capture && render > write);
  assert.match(feel, /pokedexCollectionNationalStats/);
  assert.match(feel, /pokedexCollectionRegionStats/);
});

test("result ceremony distinguishes new, known and unchanged collection states", () => {
  assert.match(feel, /Nouvelle entrée enregistrée/);
  assert.match(feel, /Nouvelle forme enregistrée/);
  assert.match(feel, /Déjà enregistré/);
  assert.match(feel, /Album inchangé/);
});

test("result ceremony exposes real Pokédex and mission progress", () => {
  assert.match(feel, /PROGRESSION APRÈS LA PARTIE/);
  assert.match(feel, /Pokédex national/);
  assert.match(feel, /Génération /);
  assert.match(feel, /MISSION PRÊTE/);
  assert.match(feel, /MISSION EN PROGRESSION/);
  assert.match(feel, /win-progress-track/);
});

test("result action opens the exact discovered Pokémon instead of generic collection", () => {
  assert.match(club, /data-action="openRegisteredPokemonInPokedex"/);
  assert.match(club, /Number\(secretPokemon\.id\)/);
  assert.match(club, /Voir ' \+ escapeHtml\(secretPokemon\.name\) \+ ' dans le Pokédex/);
});

test("result ceremony remains presentation-only and does not award progression itself", () => {
  const start = feel.indexOf("function renderGameFeelResultProgress");
  const end = feel.indexOf("function enhanceGameOverBox", start);
  const section = feel.slice(start, end);
  assert.doesNotMatch(section, /awardXp|saveStats|saveProfile|recordPokemonDiscovery|progressQuest/);
});

test("Result Ceremony V2 has desktop, dark and mobile styling", () => {
  assert.match(css, /RESULT CEREMONY V2 — performance \+ collection in one place/);
  assert.match(css, /#screen-game \.win-ceremony-progress/);
  assert.match(css, /#screen-game \.win-progress-grid/);
  assert.match(css, /#screen-game \.win-ceremony-mission\.is-ready/);
  assert.match(css, /theme-dark #screen-game \.win-ceremony-progress/);
  const ceremony = css.slice(css.indexOf("RESULT CEREMONY V2"), css.indexOf("MODE CARD IDENTITY V2"));
  const mobile = ceremony.slice(ceremony.indexOf("@media (max-width:640px)"));
  assert.match(mobile, /#screen-game \.win-progress-grid[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(mobile, /#screen-game \.win-btns[\s\S]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
});
