'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fb = require('../lib/feedback');

test('a message is kept as typed, trimmed and limited; the robot trap and bad input are refused', () => {
  assert.deepEqual(fb.validateFeedback({ kind: 'bug', message: '  Le Wordle plante\r\nsur iPhone  ', pseudo: ' Sacha  du\tBourg ', context: 'jeu · daily<script>' }),
    { kind: 'bug', message: 'Le Wordle plante\nsur iPhone', pseudo: 'Sacha du Bourg', context: 'jeu · dailyscript' });
  assert.deepEqual(fb.validateFeedback({ kind: 'idea', message: 'Un mode Gigamax !', website: 'http://spam.example' }), { spam: true });
  assert.equal(fb.validateFeedback({ kind: 'hack', message: 'Bonjour à tous' }).error, 'kind');
  assert.equal(fb.validateFeedback({ kind: '__proto__', message: 'Bonjour à tous' }).error, 'kind');
  assert.equal(fb.validateFeedback({ kind: 'opinion', message: ' ok ' }).error, 'too_short');
  assert.equal(fb.validateFeedback({ kind: 'opinion', message: 'a'.repeat(1001) }).error, 'too_long');
  assert.equal(fb.validateFeedback(null).error, 'invalid');
  assert.equal(fb.validateFeedback({ kind: 'idea', message: 'Super site', pseudo: 'x'.repeat(200) }).pseudo.length, fb.PSEUDO_MAX);
});

function fakeDb() {
  const rows = [], queries = [];
  return { rows, queries, async query(sql, params = []) {
    queries.push(sql.replace(/\s+/g, ' ').trim());
    if (/^INSERT INTO feedback_messages/.test(sql)) rows.push({ kind: params[0], message: params[1], pseudo: params[2], context: params[3] });
    return { rows: [], rowCount: 0 };
  } };
}
async function server(t, options) {
  const app = express();
  app.set('trust proxy', 1);
  fb.mountFeedbackRoutes(app, { express, log: { error() {} }, ...options });
  const listener = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const base = 'http://127.0.0.1:' + listener.address().port;
  return (body, headers = {}) => fetch(base + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

test('POST /api/feedback stores a message, answers robots like people, limits floods and other sites', async (t) => {
  const db = fakeDb();
  let now = 0;
  const post = await server(t, { db, ready: Promise.resolve(true), limited: fb.createRateLimit(() => now) });
  const ok = await post({ kind: 'idea', message: 'Ajoutez les formes Gigamax au Pokédex', pseudo: 'Kayan', context: 'pokedex' });
  assert.equal(ok.status, 200);
  assert.deepEqual(db.rows, [{ kind: 'idea', message: 'Ajoutez les formes Gigamax au Pokédex', pseudo: 'Kayan', context: 'pokedex' }]);
  assert.ok(db.queries.some(sql => sql.startsWith('DELETE FROM feedback_messages WHERE created_at < now() - interval')), 'old messages are pruned');

  assert.equal((await post({ kind: 'idea', message: 'Gagne de l\'argent vite', website: 'spam' })).status, 200);
  assert.equal(db.rows.length, 1, 'the trap never reaches the database');
  assert.equal((await post({ kind: 'bug', message: 'ok' })).status, 400);
  assert.equal((await post({ kind: 'bug', message: 'Depuis un autre site' }, { Origin: 'https://evil.example' })).status, 403);

  for (let i = 1; i < fb.PER_HOUR; i++) assert.equal((await post({ kind: 'opinion', message: 'Message numéro ' + i })).status, 200);
  assert.equal((await post({ kind: 'opinion', message: 'Un message de trop' })).status, 429);
  now += 3600001;
  assert.equal((await post({ kind: 'opinion', message: 'Une heure plus tard' })).status, 200);
});

test('without a database the box says so instead of losing the message silently', async (t) => {
  const post = await server(t, { db: null, ready: Promise.resolve(false) });
  const response = await post({ kind: 'bug', message: 'Le site ne charge pas' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'unavailable');
});

test('the private page escapes every field a player wrote', () => {
  const html = fb.feedbackSectionHtml([{ created_at: '2026-10-25T08:00:00Z', kind: 'bug', message: '<script>alert(1)</script>\nligne 2', pseudo: '<b>x</b>', context: 'jeu · daily' }]);
  assert.doesNotMatch(html, /<script>|<b>x<\/b>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<td>Bug<\/td>/);
  assert.match(html, /25\/10 09:00/, "shown in Paris time (winter time from 25 October)");
  assert.match(fb.feedbackSectionHtml([]), /Aucun message/);
});

test('PostgreSQL: the table keeps messages newest first and forgets them after 90 days', { skip: !process.env.QA_DATABASE_URL, timeout: 20000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const schema = 'feedback_' + randomUUID().replaceAll('-', ''), admin = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 2 });
    await fb.ensureTable(db); await fb.ensureTable(db);
    await db.query("INSERT INTO feedback_messages(created_at, kind, message) VALUES (now() - interval '91 days', 'bug', 'Trop vieux')");
    await fb.save(db, { kind: 'idea', message: 'Premier', pseudo: '', context: 'accueil' });
    await fb.save(db, { kind: 'bug', message: 'Second', pseudo: 'Kayan', context: 'jeu · weight' });
    const rows = await fb.recent(db, 10);
    assert.deepEqual(rows.map(r => r.message), ['Second', 'Premier']);
    assert.equal(rows[0].pseudo, 'Kayan');
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await admin.end();
  }
});
