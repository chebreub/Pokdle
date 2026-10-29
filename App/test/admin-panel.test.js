'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const admin = require('../lib/admin-panel');

test('admin ids come from a comma-separated list, blanks ignored', () => {
  assert.deepEqual([...admin.adminIdsFrom(' 123 , ,google:abc,')], ['123', 'google:abc']);
  assert.equal(admin.adminIdsFrom(undefined).size, 0);
});

test('a news line needs a short text, a date in the next 60 days and a known screen', () => {
  const today = '2026-10-29';
  assert.deepEqual(admin.validateNews({ text: '  Nouveau :\n Stat Mystère  ', until: '2026-11-05', action: 'startMysteryStatGame' }, today),
    { news: { text: 'Nouveau : Stat Mystère', until: '2026-11-05', action: 'startMysteryStatGame' } });
  assert.ok(admin.validateNews({ text: 'ok', until: '2026-11-05', action: 'startDailyGame' }, today).error);
  assert.ok(admin.validateNews({ text: 'x'.repeat(admin.NEWS_TEXT_MAX + 1), until: '2026-11-05', action: 'startDailyGame' }, today).error);
  assert.ok(admin.validateNews({ text: 'Une annonce', until: '2026-10-28', action: 'startDailyGame' }, today).error, 'past date');
  assert.ok(admin.validateNews({ text: 'Une annonce', until: '2026-02-30', action: 'startDailyGame' }, today).error, 'impossible date');
  assert.ok(admin.validateNews({ text: 'Une annonce', until: '2027-01-15', action: 'startDailyGame' }, today).error, 'too far');
  assert.ok(admin.validateNews({ text: 'Une annonce', until: '2026-11-05', action: 'alert' }, today).error, 'unknown action');
  assert.ok(admin.validateNews({ text: 'Une annonce', until: '2026-11-05', action: '__proto__' }, today).error);
  assert.equal(admin.validateNews({ text: 'Le dernier jour', until: today, action: 'startDailyGame' }, today).news.until, today);
});

async function serve(t, db, ids) {
  const app = express();
  let day = '2026-10-29';
  // The test session is a header; the real site reads its signed cookie.
  const getSessionUser = (req) => (req.get('x-test-user') ? { id: req.get('x-test-user'), username: 'Kayan' } : null);
  const routes = admin.mountAdminRoutes(app, { express, db, ready: Promise.resolve(Boolean(db)), getSessionUser, adminIds: ids, today: () => day, log: { error() {} } });
  const listener = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve) => listener.close(resolve)));
  const base = 'http://127.0.0.1:' + listener.address().port;
  const host = new URL(base).host;
  const get = (path, user) => fetch(base + path, { headers: user ? { 'x-test-user': user } : {}, redirect: 'manual' });
  const post = (path, user, fields, origin = base) => fetch(base + path, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(user ? { 'x-test-user': user } : {}), ...(origin ? { Origin: origin } : {}) },
    body: new URLSearchParams(fields).toString(),
  });
  return { get, post, routes, host, setDay: (d) => { day = d; } };
}

test('only a signed-in admin reaches the panel; others are told why', async (t) => {
  const s = await serve(t, null, new Set(['42']));
  assert.equal((await s.get('/admin')).status, 401);
  const other = await s.get('/admin', '7');
  assert.equal(other.status, 403);
  assert.match(await other.text(), /Ton identifiant de compte : <b>7<\/b>/);
  assert.equal((await s.post('/admin/news', '7', { text: 'Pirate', until: '2026-11-01', action: 'startDailyGame' })).status, 403);
  assert.equal((await s.get('/admin', '42')).status, 503, 'admin without a database');
  assert.equal(s.routes.isAdmin({ id: 42 }), true);
  assert.equal(s.routes.isAdmin({ id: '7' }), false);
  assert.equal(s.routes.isAdmin(null), false);
});

test('PostgreSQL: news banner and photo removal from the admin panel', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async (t) => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const schema = 'admin_' + randomUUID().replaceAll('-', ''), root = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await root.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '',data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_login TIMESTAMPTZ NOT NULL DEFAULT now(),partner_id INTEGER,xp INTEGER,photo_key TEXT,photo BYTEA)`);
    await admin.ensureTables(db); await admin.ensureTables(db);
    const s = await serve(t, db, new Set(['42']));

    // Nothing saved yet: the site keeps its built-in line.
    assert.deepEqual(await (await s.get('/api/news')).json(), { ok: true, set: false, news: null });
    assert.equal((await s.post('/admin/news', '42', { text: 'Depuis un autre site', until: '2026-11-01', action: 'startDailyGame' }, 'https://evil.example')).status, 403);
    assert.equal((await s.post('/admin/news', '42', { text: 'Sans origine', until: '2026-11-01', action: 'startDailyGame' }, null)).status, 403);
    const bad = await s.post('/admin/news', '42', { text: 'Trop loin', until: '2027-06-01', action: 'startDailyGame' });
    assert.equal(bad.status, 303);
    assert.match(bad.headers.get('location'), /^\/admin\?err=/);
    const saved = await s.post('/admin/news', '42', { text: 'Nouveau : Stat Mystère', until: '2026-11-05', action: 'startMysteryStatGame' });
    assert.equal(saved.headers.get('location'), '/admin?ok=news');
    assert.deepEqual(await (await s.get('/api/news')).json(), { ok: true, set: true, news: { text: 'Nouveau : Stat Mystère', until: '2026-11-05', action: 'startMysteryStatGame' } });
    const panel = await (await s.get('/admin?ok=news', '42')).text();
    assert.match(panel, /Annonce enregistrée/);
    assert.match(panel, /value="Nouveau : Stat Mystère"/);
    s.setDay('2026-11-06');
    assert.deepEqual(await (await s.get('/api/news')).json(), { ok: true, set: true, news: null }, 'an expired line is no longer served');
    s.setDay('2026-10-29');
    await s.post('/admin/news/clear', '42', {});
    assert.deepEqual(await (await s.get('/api/news')).json(), { ok: true, set: true, news: null }, 'cleared: the built-in line stays hidden too');

    const key = 'a1b2c3d4e5f6a1b2c3d4e5f6';
    await db.query("INSERT INTO users(discord_id,username,photo_key,photo) VALUES('7','Sacha',$1,'\\xffd8ff'::bytea),('8','Ondine',NULL,NULL)", [key]);
    assert.match(await (await s.get('/admin', '42')).text(), new RegExp('/api/avatar-photo/' + key));
    assert.equal(await admin.isPhotoBlocked(db, key), false);
    assert.match((await s.post('/admin/photos/remove', '42', { photo_key: 'pas-une-cle' })).headers.get('location'), /err=/);
    assert.equal((await s.post('/admin/photos/remove', '42', { photo_key: key })).headers.get('location'), '/admin?ok=photo');
    const row = (await db.query("SELECT photo_key, photo FROM users WHERE discord_id='7'")).rows[0];
    assert.deepEqual(row, { photo_key: null, photo: null });
    assert.equal(await admin.isPhotoBlocked(db, key), true);
    assert.equal((await db.query('SELECT account_id FROM blocked_photos WHERE photo_key=$1', [key])).rows[0].account_id, '7');
    assert.match(await (await s.get('/admin', '42')).text(), /Aucune photo partagée/);
  } finally {
    if (db) await db.end();
    await root.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await root.end();
  }
});
