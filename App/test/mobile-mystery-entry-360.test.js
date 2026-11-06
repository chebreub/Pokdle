"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const css = fs.readFileSync(path.join(__dirname, "../game-shell.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

test("Stat Mystère keeps its optional help on one short row at 360px, without removing accessible text", () => {
  assert.match(css, /@media \(max-width: 380px\) \{/);
  const start = css.indexOf("/* QA mobile 360 px:");
  assert.ok(start > 0, "the targeted mobile adjustment must remain documented");
  const scoped = css.slice(start);
  assert.match(scoped, /#mystery-box \.mystery-guide-row \{[\s\S]*?flex-wrap: nowrap;/);
  assert.match(scoped, /#mystery-box \.challenge-title \{[\s\S]*?white-space: nowrap;/);
  assert.match(scoped, /#mystery-box \.mystery-guide summary \{[\s\S]*?min-height: 44px;/);
  assert.match(scoped, /content: "ⓘ Aide"/);
  assert.match(html, /<details class="mystery-guide">[\s\S]*?<summary>Comment lire les stats \?<\/summary>/,
    "the full summary label stays available to assistive technology");
  assert.doesNotMatch(scoped, /#guess-input\s*\{|#btn-submit\s*\{|#mobile-tabbar\s*\{/,
    "do not hide, relocate or reduce the actual game input and mobile navigation");
});
