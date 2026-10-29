'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../src/script.10yb.feedback.js'), 'utf8');
const invite = src.slice(src.indexOf('const FEEDBACK_INVITE_KEY'));

test('the result invites to give feedback once a week, after a few games only', () => {
  const store = new Map();
  const c = { playerStats: { played: 2 }, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  vm.createContext(c);
  vm.runInContext(invite, c);
  const day = 86400000;
  assert.equal(c.feedbackResultInvite(10 * day), '', 'not on a first visit');
  c.playerStats.played = 3;
  assert.match(c.feedbackResultInvite(10 * day), /data-action="openFeedbackModal"/);
  assert.equal(c.feedbackResultInvite(12 * day), '', 'not twice the same week');
  assert.match(c.feedbackResultInvite(17 * day), /Donne ton avis/);
  c.localStorage.getItem = () => { throw new Error('blocked'); };
  assert.equal(c.feedbackResultInvite(30 * day), '', 'storage blocked: stay quiet');
});
