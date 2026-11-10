'use strict';
// Partage du parrainage : succès Clipboard API, refus de permission et repli Safari.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xk.referral.js'), 'utf8');
function setup(clipboard, execResult) {
  const toasts = [];
  const input = {
    value: 'https://pokdle.fr/?ami=1234567890abcdef',
    focusCalled: 0, selected: 0,
    focus() { this.focusCalled++; }, select() { this.selected++; }
  };
  const ctx = vm.createContext({
    window: {}, document: {
      getElementById: id => id === 'invite-friend-url' ? input : null,
      execCommand: () => execResult
    },
    navigator: { clipboard }, showToast: text => toasts.push(text),
    localStorage: { getItem: () => null, removeItem() {}, setItem() {} },
  });
  vm.runInContext(source, ctx);
  return { ctx, input, toasts };
}

test('Clipboard API : confirmation uniquement apres resolution', async () => {
  let resolve;
  const copy = new Promise(done => { resolve = done; });
  const { ctx, input, toasts } = setup({ writeText: () => copy }, false);
  const done = ctx.copyInviteLink();
  assert.equal(toasts.length, 0, 'ne pas annoncer une copie avant son succes');
  resolve();
  await done;
  assert.deepEqual(toasts, ['Lien copié ✓']);
  assert.equal(input.selected, 0);
});

test('Permission Clipboard refusee : utiliser la copie classique sur mobile', async () => {
  const { ctx, input, toasts } = setup({ writeText: () => Promise.reject(new Error('NotAllowedError')) }, true);
  await ctx.copyInviteLink();
  assert.equal(input.focusCalled, 1);
  assert.equal(input.selected, 1);
  assert.deepEqual(toasts, ['Lien copié ✓']);
});

test('Si la copie automatique est impossible, laisser le lien selectionne sans fausse confirmation', () => {
  const { ctx, input, toasts } = setup(undefined, false);
  ctx.copyInviteLink();
  assert.equal(input.selected, 1);
  assert.deepEqual(toasts, ['Lien sélectionné : copie-le manuellement']);
});
