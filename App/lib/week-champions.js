'use strict';
// The reigning champions (31/10/2026): the first of last week's Parcours, shown with a shiny
// partner in every ranking for the whole new week. Kept in memory and refreshed by
// lib/weekly-awards.js; empty until then, so a ranking never waits for it.
let champions = new Set();
function setChampions(ids) { champions = new Set((ids || []).map(String)); }
function isChampion(id) { return id != null && champions.has(String(id)); }
module.exports = { setChampions, isChampion };
