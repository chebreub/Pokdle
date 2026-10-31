'use strict';
// « Ma photo » in the rankings (26/10): the photo a player picks shows to the other players.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sharedPhotoFromProfileData, partnerIdFromProfileData, rankingAvatarSql } = require('../lib/profile-sync');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]).toString('base64');
const data = (profile) => ({ profile: JSON.stringify(profile) });

test('only a photo picked under the new note is shared, and only a small JPEG', () => {
  const shared = sharedPhotoFromProfileData(data({ avatarChoice: 'photo', avatarPhotoShared: true, avatarPhoto: jpeg, favoritePokemonId: 937 }));
  assert.match(shared.key, /^[0-9a-f]{24}$/);
  assert.equal(shared.bytes[0], 0xff);
  // The rankings show it instead of the partner.
  assert.equal(partnerIdFromProfileData(data({ avatarChoice: 'photo', avatarPhotoShared: true, avatarPhoto: jpeg, favoritePokemonId: 937 })), null);
  // A photo sent before (no flag), another choice, or anything but a JPEG stays private.
  for (const profile of [
    { avatarChoice: 'photo', avatarPhoto: jpeg },
    { avatarChoice: 'partner', avatarPhotoShared: true, avatarPhoto: jpeg },
    { avatarChoice: 'photo', avatarPhotoShared: true, avatarPhoto: 'data:image/png;base64,iVBORw0KGgo=' },
    { avatarChoice: 'photo', avatarPhotoShared: true, avatarPhoto: 'data:image/jpeg;base64,' + Buffer.from('<svg/>').toString('base64') },
    { avatarChoice: 'photo', avatarPhotoShared: true, avatarPhoto: 'data:image/jpeg;base64,' + Buffer.alloc(70000, 0xff).toString('base64') },
  ]) assert.equal(sharedPhotoFromProfileData(data(profile)), null, JSON.stringify(profile).slice(0, 80));
  assert.equal(partnerIdFromProfileData(data({ avatarChoice: 'photo', avatarPhoto: jpeg, favoritePokemonId: 937 })), 937);
});

test('the server keeps the shared photo with the profile and serves it by its hash', () => {
  const server = read('server.js');
  assert.match(server, /ADD COLUMN IF NOT EXISTS photo_key TEXT/);
  assert.match(server, /ADD COLUMN IF NOT EXISTS photo BYTEA/);
  assert.match(server, /UPDATE users SET data = \$2, partner_id = \$3, xp = \$4, photo_key = \$5, photo = \$6 WHERE discord_id = \$1/);
  assert.match(server, /app\.get\("\/api\/avatar-photo\/:key"[\s\S]*?\/\^\[0-9a-f\]\{24\}\$\/[\s\S]*?"Content-Type": "image\/jpeg"/);
});

test('every ranking shows the shared photo first, then the account picture', () => {
  assert.equal(rankingAvatarSql('s.avatar'), "COALESCE('/api/avatar-photo/' || u.photo_key, s.avatar)");
  assert.equal((read('server.js').match(/\$\{rankingAvatarSql\(/g) || []).length, 3);
  for (const file of ['lib/day-boards.js', 'lib/daily-grid.js', 'lib/daily-petitbac.js']) {
    const src = read(file);
    assert.doesNotMatch(src, /COALESCE\(u\.avatar,''\) AS avatar/, file);
    assert.match(src, /\$\{rankingAvatarSql\("COALESCE\(u\.avatar,''\)"\)\} AS avatar/, file);
  }
});

test('picking or sending a photo shares it, and the profile leaves at once', () => {
  const src = read('src/script.07.delegation-party.js');
  assert.match(src, /playerProfile\.avatarChoice = "photo";\n\s+playerProfile\.avatarPhotoShared = true;\n\s+saveProfile\(\);\n\s+syncProfileNow\(\);/);
  assert.match(src, /if \(choice === "photo"\) playerProfile\.avatarPhotoShared = true;\n\s+saveProfile\(\);\n\s+syncProfileNow\(\);/);
  assert.match(src, /window\.pokedleSyncNow = pushSync;/);
});

test('the privacy page says the chosen photo shows in the rankings', () => {
  const page = read('confidentialite.html');
  assert.match(page, /si tu choisis « Ma photo » comme image de profil, la photo que tu as envoyée : les autres joueurs la voient dans les classements\./);
  assert.match(page, /Dernière mise à jour : 26 octobre 2026\./);
});
