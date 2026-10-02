"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const game=fs.readFileSync(path.join(root,"src/script.04.jeu-pokedex.js"),"utf8");
const css=fs.readFileSync(path.join(root,"visual-refresh.css"),"utf8");

test("post-game actions prioritize continuing play over utility buttons",()=>{
  assert.match(index,/id="btn-restart"[^>]*class="btn-blue result-primary"|class="btn-blue result-primary"[^>]*id="btn-restart"/);
  assert.match(index,/id="btn-result-catalog"[^>]*data-action="openAllModesScreen"/);
  assert.match(index,/id="btn-copy-result"[^>]*class="btn-ghost"|class="btn-ghost"[^>]*id="btn-copy-result"/);
  assert.match(index,/id="btn-share"[^>]*class="btn-ghost"|class="btn-ghost"[^>]*id="btn-share"/);
  assert.match(game,/Continuer en illimité/);
  assert.match(game,/box\.dataset\.resultMode/);
  assert.match(game,/box\.dataset\.resultOutcome/);
});

test("shared result region announces completion accessibly",()=>{
  assert.match(index,/id="win-box"[^>]*role="region"[^>]*aria-live="polite"/);
});

test("dedicated games share a presentation shell without sharing their internal layout",()=>{
  const shells=(index.match(/gameplay-screen-card/g)||[]).length;
  assert.ok(shells>=8,"expected dedicated gameplay screens to opt into the common shell");
  assert.match(css,/\.gameplay-screen-card > \.ranking-head/);
  assert.match(css,/\.gameplay-screen-card > \.card-desc/);
  assert.doesNotMatch(css,/\.gameplay-screen-card[^\n]*max-width:\s*\d+px/);
});

test("mobile result actions keep the primary continuation full width",()=>{
  const pass=css.slice(css.indexOf("GAMEPLAY + RESULTS PASS"));
  assert.match(pass,/@media \(max-width:640px\)[\s\S]*\.win-btns[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(pass,/\.win-btns \.result-primary,[\s\S]*#btn-result-catalog[\s\S]*grid-column:1 \/ -1/);
});
