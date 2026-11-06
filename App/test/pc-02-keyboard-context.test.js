"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
const solo = read("script.03.minijeux.js");
const party = read("script.04.jeu-pokedex.js");
const delegation = read("script.07.delegation-party.js");

function handler(source, begin, next, context) {
  const a = source.indexOf("function " + begin + "(");
  const b = source.indexOf(next, a);
  assert.ok(a >= 0 && b > a, begin + " was found");
  vm.createContext(context);
  return vm.runInContext(source.slice(a,b) + "\n" + begin + ";", context);
}
function list(visible = true, names = ["Pikachu", "Raichu"]) {
  let isVisible = visible;
  const items = names.map(name => ({
    dataset:{name}, querySelector: selector => selector === ".ac-name" ? {textContent:name} : null
  }));
  return {
    classList:{
      contains:key => key === "hidden" && !isVisible,
      add:key => {if (key === "hidden") isVisible = false;}
    },
    querySelectorAll:selector => selector === ".ac-item" ? items : [],
    visible:()=>isVisible
  };
}
function key(name, props = {}) {
  return {
    key:name,defaultPrevented:false,propagationStopped:false,
    preventDefault(){this.defaultPrevented = true;},
    stopPropagation(){this.propagationStopped = true;},
    ...props
  };
}

test("PC-02 Solo: arrows only navigate open lists; Enter chooses once or submits once", () => {
  const l=list(false),picked=[],sent=[],highlights=[];
  const ctx={
    document:{getElementById:()=>l},acIndex:-1,guessInputComposing:false,
    highlightItems:(items,index)=>highlights.push(index),
    selectGuessAC:name=>picked.push(name),submitGuess:()=>sent.push("submitted")
  };
  const fn=handler(solo,"handleGuessKey","\nfunction highlightItems(",ctx);
  let e=key("ArrowDown");fn(e);
  assert.equal(e.defaultPrevented,false);assert.deepEqual(highlights,[]);
  e=key("Enter");fn(e);
  assert.equal(e.defaultPrevented,true);assert.deepEqual(sent,["submitted"]);
  const open=list();ctx.document.getElementById=()=>open;
  e=key("ArrowDown");fn(e);
  assert.equal(e.defaultPrevented,true);assert.deepEqual(highlights,[0]);
  e=key("Enter");fn(e);
  assert.deepEqual(picked,["Pikachu"]);assert.deepEqual(sent,["submitted"]);
  e=key("Escape");fn(e);
  assert.equal(e.defaultPrevented,true);
  assert.equal(e.propagationStopped,true);assert.equal(open.visible(),false);
  e=key("ArrowDown");fn(e);assert.equal(e.defaultPrevented,false);
  for(const composing of [
    key("Enter",{isComposing:true}),
    key("Enter",{keyCode:229}),
    key("Enter",{ctrlKey:true}),
    key("Enter",{defaultPrevented:true})
  ]) fn(composing);
  assert.equal(sent.length,1,"IME, modifiers and consumed events never submit");
});

test("PC-02 Party: selected suggestion submits once; Escape dismisses without closing overlays", () => {
  const l=list(false),chosen=[],submitted=[],highlights=[];
  const ctx={
    document:{getElementById:()=>l},partyAcIndex:-1,
    highlightItems:(_items,i)=>highlights.push(i),
    selectPartyGuessAC:name=>chosen.push(name),
    partySubmitAnswer:()=>submitted.push("answer")
  };
  const fn=handler(party,"handlePartyGuessKey","\nfunction clearPartyGuessInput(",ctx);
  let e=key("ArrowDown");fn(e);assert.equal(e.defaultPrevented,false);
  e=key("Enter");fn(e);assert.deepEqual(submitted,["answer"]);
  const open=list();ctx.document.getElementById=()=>open;
  e=key("ArrowDown");fn(e);assert.equal(e.defaultPrevented,true);
  e=key("Enter");fn(e);
  assert.deepEqual(chosen,["Pikachu"]);assert.equal(submitted.length,1);
  e=key("Escape");fn(e);
  assert.equal(e.propagationStopped,true);assert.equal(open.visible(),false);
  fn(key("Enter",{isComposing:true}));
  assert.equal(submitted.length,1);
});

test("PC-02 Challenge: Enter only selects an active suggestion; Escape closes it", () => {
  const l=list(false),chosen=[];
  const ctx={
    document:{getElementById:()=>l},chalAcIndex:-1,
    highlightItems:()=>{},
    POKEMON_LIST:[{name:"Pikachu",id:25}],
    selectChallengeAC:p=>chosen.push(p.id)
  };
  const fn=handler(delegation,"handleChallengeKey","\nfunction selectChallengeAC(",ctx);
  let e=key("ArrowUp");fn(e);assert.equal(e.defaultPrevented,false);
  e=key("Enter");fn(e);assert.equal(e.defaultPrevented,false);
  const open=list();ctx.document.getElementById=()=>open;
  fn(key("ArrowDown"));e=key("Enter");fn(e);
  assert.equal(e.defaultPrevented,true);assert.deepEqual(chosen,[25]);
  e=key("Escape");fn(e);
  assert.equal(e.propagationStopped,true);assert.equal(open.visible(),false);
});

test("PC-02 Duel: single Enter handler; pending/IME/hidden lists never duplicate an answer", () => {
  const l=list(false),chosen=[],submitted=[];
  const input={disabled:false};
  const ctx={
    document:{getElementById:id=>id==="multiplayer-guess-input"?input:l},
    multiplayerLiveState:{room:{status:"live"}},acIndex:-1,
    highlightItems:()=>{},
    selectMultiplayerGuessAC:name=>chosen.push(name),
    submitMultiplayerGuess:()=>submitted.push("answer")
  };
  const fn=handler(delegation,"handleMultiplayerGuessKey","\nfunction createDefaultMultiplayerLiveState()",ctx);
  let e=key("ArrowDown");fn(e);assert.equal(e.defaultPrevented,false);
  e=key("Enter");fn(e);assert.deepEqual(submitted,["answer"]);
  const open=list();ctx.document.getElementById=id=>id==="multiplayer-guess-input"?input:open;
  fn(key("ArrowDown"));e=key("Enter");fn(e);
  assert.deepEqual(chosen,["Pikachu"]);assert.equal(submitted.length,1);
  e=key("Escape");fn(e);
  assert.equal(e.propagationStopped,true);
  input.disabled=true;fn(key("Enter"));assert.equal(submitted.length,1);
  input.disabled=false;ctx.multiplayerLiveState.room.status="finished";
  fn(key("Enter"));assert.equal(submitted.length,1);
  ctx.multiplayerLiveState.room.status="live";
  fn(key("Enter",{isComposing:true}));assert.equal(submitted.length,1);
  const a=delegation.indexOf("function ensureMultiplayerGuessInputBindings()");
  const b=delegation.indexOf("\nfunction canSubmitMultiplayerGuess()",a);
  assert.ok(a>=0 && b>a);
  assert.doesNotMatch(delegation.slice(a,b),/addEventListener\("keydown"/);
  assert.match(delegation,/bindEl\("multiplayer-guess-input", "keydown", window\.handleMultiplayerGuessKey\)/);
});

test("PC-02 never introduces a global guess shortcut or overrides unrelated chats", () => {
  assert.match(delegation,/if \(event\.key === 'Escape' && !event\.defaultPrevented\)/);
  assert.match(delegation,/if \(!overlay \|\| overlay\.classList\.contains\('hidden'\)\) return/);
  for(const source of [solo,party,delegation]){
    assert.doesNotMatch(source,/PC-02[\s\S]{0,160}document\.addEventListener\(["']keydown/);
  }
});
