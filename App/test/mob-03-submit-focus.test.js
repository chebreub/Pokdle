'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(`${__dirname}/../src/script.10ja.mobile-controls.js`, 'utf8');

test('phone submit keeps focus through mousedown, with no interception elsewhere', () => {
  const handlers = {}, document = { activeElement: {id:'party-guess'}, addEventListener: (name,fn)=>{handlers[name]=fn;} };
  let mobile = true;
  vm.runInNewContext(source, {document,window:{matchMedia:()=>({matches:mobile}),addEventListener(){}}});
  assert.equal(handlers.pointerdown, undefined, 'do not suppress the WebKit touch click');
  function tap(selector) {
    let prevented = false;
    handlers.mousedown({target:{closest:s=>s===selector},preventDefault:()=>{prevented=true;}});
    return prevented;
  }
  assert.equal(tap('#party-submit-btn'),true);
  assert.equal(tap('#party-chat-form button'),false);
  document.activeElement.id='multiplayer-guess-input';
  assert.equal(tap('#multiplayer-live-box [data-action="submitMultiplayerGuess"]'),true);
  assert.equal(tap('#multiplayer-forfeit-confirm'),false);
  mobile=false;
  assert.equal(tap('#multiplayer-live-box [data-action="submitMultiplayerGuess"]'),false);
  mobile=true;document.activeElement.id='party-chat-input';
  assert.equal(tap('#party-submit-btn'),false);
});
