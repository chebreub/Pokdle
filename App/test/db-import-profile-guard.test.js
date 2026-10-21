'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {hasProfileData, canRestoreLegacyProfile, canScheduleLegacyImport} = require('../lib/db-import');

test('a legacy snapshot is restored only into an empty account placeholder', () => {
  const empty = {_accountId: 'A', _savedAt: 1760000000000};
  const old = {profile: '{"xp":900,"discoveries":{"25":{}}}', stats: '{"wins":20}'};
  assert.equal(hasProfileData(empty), false);
  assert.equal(hasProfileData(old), true);
  assert.equal(canRestoreLegacyProfile(empty, old, 'A'), true);
  assert.equal(canRestoreLegacyProfile({}, old, 'A'), true);
  assert.equal(canRestoreLegacyProfile(empty, {}, 'A'), false);
});

test('existing progress always wins, no matter how large the old JSON was', () => {
  const live = {_accountId: 'A', _savedAt: 1770000000000, profile: '{"xp":20}'};
  const longOld = {profile: JSON.stringify({xp: 900, album: Array.from({length: 100}, (_, i) => i)})};
  assert.ok(JSON.stringify(longOld).length > JSON.stringify(live).length);
  assert.equal(canRestoreLegacyProfile(live, longOld, 'A'), false);
  assert.equal(canRestoreLegacyProfile({profile: '{}'}, longOld, 'A'), false,
    'Even a seemingly empty serialized profile is conservatively retained until reviewed');
});

test('profiles stamped for another account are never restored', () => {
  const old = {_accountId: 'B', profile: '{"xp":999}'};
  assert.equal(canRestoreLegacyProfile({_accountId: 'A'}, old, 'A'), false);
  assert.equal(canRestoreLegacyProfile({_accountId: 'B'}, {profile: '{"xp":12}'}, 'A'), false);
  assert.equal(canRestoreLegacyProfile(null, {profile: '{"xp":12}'}, 'A'), false);
  assert.equal(canRestoreLegacyProfile([], {profile: '{"xp":12}'}, 'A'), false);
});

test('Neon recovery cannot run merely because the old database is reachable', () => {
  assert.equal(canScheduleLegacyImport(undefined), false);
  assert.equal(canScheduleLegacyImport({OLD_DATABASE_URL:'postgresql://old.example/db'}), false);
  assert.equal(canScheduleLegacyImport({OLD_DATABASE_URL:'postgresql://old.example/db',LEGACY_IMPORT_BACKUP_VERIFIED:'false'}), false);
  assert.equal(canScheduleLegacyImport({OLD_DATABASE_URL:'postgresql://old.example/db',LEGACY_IMPORT_BACKUP_VERIFIED:'true'}), false);
  assert.equal(canScheduleLegacyImport({OLD_DATABASE_URL:'',LEGACY_IMPORT_BACKUP_VERIFIED:'yes'}), false);
  assert.equal(canScheduleLegacyImport({OLD_DATABASE_URL:'  ',LEGACY_IMPORT_BACKUP_VERIFIED:'yes'}), false);
  assert.equal(canScheduleLegacyImport({OLD_DATABASE_URL:'postgresql://old.example/db',LEGACY_IMPORT_BACKUP_VERIFIED:'yes'}), true);
});
