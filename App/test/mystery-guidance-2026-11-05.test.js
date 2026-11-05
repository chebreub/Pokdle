"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const html = read("index.html");
const css = read("style.css");
const mysteryJs = read("src/script.03.minijeux.js");

test("NIV-02 explains actual Mystery base stats without revealing the current answer", () => {
  const a = html.indexOf('<div id="mystery-box"'), b = html.indexOf('<div id="description-banner"', a);
  assert.ok(a >= 0 && b > a);
  const block = html.slice(a, b);
  assert.match(block, /<details class="mystery-guide">/);
  assert.doesNotMatch(block, /<details class="mystery-guide"[^>]*\sopen(?:=|\s|>)/,
    "optional help must be closed until a player opens it");
  assert.match(block, /<summary>Comment lire les stats \?<\/summary>/);
  assert.match(block, /statistiques de base du Pokémon à trouver/);
  assert.match(block, /120 PV et 40 en Vitesse/);
  assert.match(block, /Exemple fictif/);
  assert.match(block, /Le <strong>Total<\/strong> additionne les six statistiques/);
  assert.match(block, /la couleur ne mesure pas la proximité/);
  assert.match(block, /Après <strong>5 essais<\/strong>/);
  assert.match(block, /<\/details>[\s\S]*<ul id="mystery-list"><\/ul>/,
    "guide must be outside the list which is cleared every time results refresh");
  assert.doesNotMatch(block, /data-action=|onclick=|data-pokemon=|data-uid=/,
    "the native HTML disclosure cannot modify gameplay, call server actions or reveal answers");
});

test("NIV-02 retains all 5-guess letter and server-verified mode logic", () => {
  assert.match(mysteryJs, /const MYSTERY_LETTER_HINT_AFTER = 5/);
  assert.match(mysteryJs, /\(Number\(attempts\) \|\| 0\) >= MYSTERY_LETTER_HINT_AFTER/);
  assert.match(mysteryJs, /verifiedGuessMystery/);
  assert.match(mysteryJs, /list\.innerHTML = ""/);
  const serverMode = read("src/script.02.statclash.js");
  assert.match(serverMode, /verifiedGuessStart\("mystery", pool\)/);
});

test("NIV-02 has keyboard focus and a sufficient touch target on small screens", () => {
  assert.match(css, /\.mystery-guide summary:focus-visible/);
  assert.match(css, /\.mystery-guide\[open\]/);
  assert.match(css, /@media \(max-width: 480px\) \{[\s\S]*?#mystery-box \.mystery-guide summary \{ min-height: 44px;/);
});
