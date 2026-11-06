'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../src/script.10xe.party-chat.js`, 'utf8');
const fitSource = source.slice(source.indexOf('function fitPartyChatViewport()'), source.indexOf('function partyChatRoom()'));

function fixture() {
  const values = new Map(), listeners = {};
  let hidden = false;
  const panel = { classList: { contains: () => hidden }, style: {
    setProperty: (k, v) => values.set(k, v), removeProperty: k => values.delete(k)
  } };
  const window = { innerWidth: 390, innerHeight: 844, visualViewport: {
    height: 844, offsetTop: 0, addEventListener: (name, fn) => { listeners[name] = fn; }
  }, addEventListener() {} };
  const c = vm.createContext({ window, document: { getElementById: () => panel } });
  vm.runInContext(fitSource, c);
  return { c, window, values, listeners, hide: () => { hidden = true; } };
}

test('Party chat follows keyboard height and visual viewport pan without scrolling the game', () => {
  const f = fixture();
  for (const height of [260, 320, 400, 600, 844]) {
    for (const offsetTop of [0, 83]) {
      Object.assign(f.window.visualViewport, { height, offsetTop });
      f.listeners.resize();
      const top = parseFloat(f.values.get('--party-chat-top'));
      const size = parseFloat(f.values.get('--party-chat-height'));
      assert.ok(top >= offsetTop);
      assert.ok(size <= height);
      assert.equal(top + size, offsetTop + height);
    }
  }
  f.window.visualViewport.offsetTop = 117;
  f.listeners.scroll();
  assert.equal(parseFloat(f.values.get('--party-chat-top')) + parseFloat(f.values.get('--party-chat-height')), 961);
});

test('Party chat clears mobile sizing when hidden, desktop or visualViewport unavailable', () => {
  for (const mode of ['hidden', 'desktop', 'fallback']) {
    const f = fixture();
    f.c.fitPartyChatViewport();
    assert.equal(f.values.size, 2);
    if (mode === 'hidden') f.hide();
    if (mode === 'desktop') f.window.innerWidth = 1366;
    if (mode === 'fallback') f.window.visualViewport = undefined;
    f.c.fitPartyChatViewport();
    assert.equal(f.values.size, 0);
  }
});
