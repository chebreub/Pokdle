'use strict';
// MOB-05 (7/11/2026): on phones the header (logo + bag with Balls and ₽ + settings + account) was 75 px too wide,
// so the account button left the screen; a challenge row put its text and two buttons on one line.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('phone header: the wordmark yields room and the account button keeps its place', () => {
  const css = read('balls.css');
  const phone = css.slice(css.indexOf('@media (max-width:480px){\n  #pokdle-app header .logo-row .logo-wordmark'));
  assert.ok(phone.length > 0, 'phone block');
  assert.match(phone, /#pokdle-app header \.logo-row \.logo-wordmark\{display:none !important\}/);
  assert.match(phone, /\.ball-bag-btn\{flex:0 1 auto !important;/);
  assert.match(phone, /#pokdle-app header #account-area\{flex:0 0 auto !important\}/, 'the account button never shrinks away');
  // Settings leaves the header only on very small screens, and only when the account menu (which has it) exists.
  assert.match(phone, /@media \(max-width:360px\)\{[\s\S]*\.header-actions:has\(#account-area \.account-chip\) > \.header-action-btn\[data-action="openSettingsModal"\]\{display:none !important\}/);
  assert.match(read('src/script.07.delegation-party.js'), /data-action="accountNavigate" data-args='\["settings"\]'><span>⚙️ Paramètres<\/span>/, 'the account menu keeps Paramètres');
});

test('a challenge row wraps its buttons under the text instead of leaving the window', () => {
  const css = read('game-shell.css');
  assert.match(css, /\.pc-row \{flex-wrap:wrap;min-width:0;\}/);
  assert.match(css, /\.pc-row p \{flex:1 1 calc\(100% - 64px\);min-width:0;overflow-wrap:anywhere;\}/);
});
