"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "visual-refresh.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Gameplay V3 has a dedicated final visual layer", () => {
  assert.match(css, /GAMEPLAY V3 — focused play surface/);
  assert.match(css, /#screen-game \.game-topbar[\s\S]*linear-gradient\(110deg,#0c2242,#12345f\)/);
  assert.match(css, /#screen-game \.search-bar[\s\S]*border-left:\s*4px solid #e9433e/);
  assert.match(css, /#screen-game \.search-bar::before[\s\S]*TA RÉPONSE/);
  assert.match(css, /#screen-game \.results-wrap::before[\s\S]*TES ESSAIS/);
});

test("mode headers receive distinct game identities without changing markup", () => {
  for (const id of [
    "daily-banner","challenge-banner","silhouette-banner","pixel-banner",
    "mystery-banner","description-banner","cry-banner","weight-banner",
    "evolution-banner","order-banner","party-banner","quiz-banner",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(css, new RegExp(`#screen-game #${id} \\{`));
  }
  assert.match(css, /--game-symbol:"VS"/);
  assert.match(css, /--game-symbol:"♪"/);
  assert.match(css, /--game-symbol:"▦"/);
});

test("mobile Gameplay V3 keeps the answer input and two actions compact", () => {
  const mobile = css.slice(css.indexOf("/* Mobile: keep the action above the fold"));
  assert.match(mobile, /@media \(max-width:640px\)/);
  assert.match(mobile, /#screen-game \.search-bar[\s\S]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(mobile, /#screen-game \.ac-wrapper[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(mobile, /#screen-game #btn-submit,[\s\S]*#screen-game #btn-surrender[\s\S]*min-height:\s*44px/);
});

test("dark mode follows the same gameplay hierarchy", () => {
  assert.match(css, /theme-dark #screen-game \.game-topbar/);
  assert.match(css, /theme-dark #screen-game \.mode-banner/);
  assert.match(css, /theme-dark #screen-game \.search-bar/);
  assert.match(css, /theme-dark #screen-game #guess-input/);
});

test("Gameplay V3 never changes screen visibility", () => {
  const section = css.slice(css.indexOf("GAMEPLAY V3 — focused play surface"));
  assert.doesNotMatch(section, /#screen-game\s*\{[^}]*display\s*:/s);
});
