'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { xpFromProfileData, playerLevelFromXp } = require('../lib/profile-sync');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the server computes the same level as the game for any XP', () => {
  const core = read('src/script.01.core.js');
  const levels = core.slice(core.indexOf('const XP_MAX_LEVEL'), core.indexOf('const QUEST_POOL'));
  const curve = core.slice(core.indexOf('function xpForLevel('), core.indexOf('// Progress toward the next level'));
  const getXpTier = Function(levels + curve + '; return getXpTier;')();
  for (let xp = 0; xp <= 260000; xp += 137) assert.equal(playerLevelFromXp(xp), getXpTier(xp).level, String(xp));
  for (const xp of [49, 50, 2249, 2250, 122928, 247499, 247500]) assert.equal(playerLevelFromXp(xp), getXpTier(xp).level, String(xp));
  assert.equal(playerLevelFromXp(null), null);
  assert.equal(playerLevelFromXp(undefined), null);
});

test('the XP copied next to the account comes from the saved profile', () => {
  assert.equal(xpFromProfileData({ profile: JSON.stringify({ xp: 122928.7 }) }), 122928);
  assert.equal(xpFromProfileData({ profile: { xp: 30 } }), 30);
  assert.equal(xpFromProfileData({ profile: { nickname: 'Kayan' } }), 0);
  assert.equal(xpFromProfileData({ profile: { xp: -5 } }), 0);
  assert.equal(xpFromProfileData({ profile: { xp: 1e12 } }), 100000000);
  assert.equal(xpFromProfileData({}), null);
  assert.equal(xpFromProfileData({ profile: '{broken' }), null);
});

test('every ranking returns the level, and the profile save keeps the XP column up to date', () => {
  const server = read('server.js');
  assert.match(server, /ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER/);
  assert.match(server, /UPDATE users SET data = \$2, partner_id = \$3, xp = \$4, photo_key = \$5, photo = \$6 WHERE discord_id = \$1/);
  assert.match(server, /SELECT discord_id, data FROM users WHERE xp IS NULL AND data \? 'profile'/);
  assert.equal((server.match(/u\.partner_id, u\.xp, /g) || []).length, 3);
  assert.equal((server.match(/ SELECT discord_id, username, avatar, partner_id, xp, score, rank FROM ranked/g) || []).length, 3);
  assert.match(server, /level: playerLevelFromXp\(row\.xp\),/);
  // The Enquête, Wordle, Dossier, Défi and Parcours boards share lib/day-boards.js.
  for (const [file, count] of [['lib/day-boards.js', 1], ['lib/daily-grid.js', 1], ['lib/daily-petitbac.js', 1]]) {
    const src = read(file);
    assert.equal((src.match(/u\.partner_id,u\.xp,/g) || []).length, count, file);
    assert.equal((src.match(/level:playerLevelFromXp\(r\.xp\),/g) || []).length, count, file);
  }
});

test('Party Rooms carry the level each browser sends, from 1 to 100', () => {
  const server = read('server.js');
  const sanitize = Function(server.match(/function sanitizePartyLevel\(value\) \{[\s\S]*?\n\}/)[0] + '; return sanitizePartyLevel;')();
  assert.deepEqual([70, 1, 100, 0, 101, 7.5, '12', null].map(sanitize), [70, 1, 100, null, null, null, 12, null]);
  assert.equal((server.match(/joinPlayerToPartyRoom\(room, socket, nickname, sanitizePartyLevel\(payload\.level\)\)/g) || []).length, 2);
  assert.match(server, /level: player\.level \|\| null,/);
  const client = read('src/script.04.jeu-pokedex.js');
  assert.equal((client.match(/level: partyPlayerLevel\(\)/g) || []).length, 2);
  assert.match(client, /'<span class="player-level-pill">Niv\. ' \+ Number\(p\.level\) \+ '<\/span>'/);
});

test('rankings, the League, the podium and last week\'s champion show « Niv. N » after the name', () => {
  const lb = read('src/script.10g.leaderboard-v2.js');
  const pill = Function(lb.match(/function leaderboardLevelPill\(row\) \{[\s\S]*?\n\}/)[0] + '; return leaderboardLevelPill;')();
  assert.equal(pill({ level: 70 }), '<span class="player-level-pill">Niv. 70</span>');
  assert.equal(pill({ level: null }), '');
  assert.equal(pill({}), '');
  assert.match(lb, /escapeHtml\(row\?\.username\|\|"Dresseur"\)\+'<\/b>'\+leaderboardLevelPill\(row\)/);
  assert.match(read('src/script.10i.weekly-league.js'), /leaderboardLevelPill\(row\)/);
  // The week's top three became the podium (31/10/2026), and last week's champion keeps the pill.
  assert.match(lb, /'<b>' \+ escapeHtml\(row\.username \|\| "Dresseur"\) \+ '<\/b>' \+ leaderboardLevelPill\(row\)/);
  assert.match(lb, /'<b>'\+escapeHtml\(row\.username \|\| "Dresseur"\)\+'<\/b>'\+leaderboardLevelPill\(row\)/);
});
