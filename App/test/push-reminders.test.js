'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const push = require('../lib/push-reminders');
const { issueDailyGuest } = require('../lib/daily-game');

const FCM = 'https://fcm.googleapis.com/fcm/send/abc123';
const KEYS = { p256dh: 'BOr' + 'a'.repeat(84), auth: 'c2VjcmV0LWF1dGgtMTY' };

test('the reminder only accepts the offered hours and the browsers\' own push services', () => {
  assert.deepEqual(push.validateSubscription({ subscription: { endpoint: FCM, keys: KEYS }, hour: 18 }), { endpoint: FCM, ...KEYS, hour: 18 });
  for (const endpoint of ['https://web.push.apple.com/QGx', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-par02p.notify.windows.com/w/?token=x']) {
    assert.ok(push.validateSubscription({ subscription: { endpoint, keys: KEYS }, hour: 8 }), endpoint);
  }
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.example/x', 'https://fcm.googleapis.com:8443/x', 'https://evil.example/fcm.googleapis.com', 'nope']) {
    assert.equal(push.validateSubscription({ subscription: { endpoint, keys: KEYS }, hour: 18 }), null, endpoint);
  }
  assert.equal(push.validateSubscription({ subscription: { endpoint: FCM, keys: KEYS }, hour: 3 }), null, 'an hour not offered');
  assert.equal(push.validateSubscription({ subscription: { endpoint: FCM, keys: { ...KEYS, auth: 'a"b' } }, hour: 18 }), null);
  assert.equal(push.validateSubscription({ subscription: { endpoint: FCM }, hour: 18 }), null);
  assert.equal(push.validateSubscription(null), null);
});

test('the notification talks about the series only when there is one to keep', () => {
  assert.match(push.reminderMessage(4).body, /série de 4 jours continue/);
  assert.doesNotMatch(push.reminderMessage(1).body, /série/);
  assert.doesNotMatch(push.reminderMessage(0).body, /série/);
  assert.equal(push.reminderMessage(0).title, push.reminderMessage(9).title);
});

test('hours are read in Paris time, winter and summer', () => {
  assert.equal(push.parisHour(new Date('2026-10-30T17:00:00Z')), 18);
  assert.equal(push.parisHour(new Date('2026-07-01T16:30:00Z')), 18);
  assert.equal(push.parisHour(new Date('2026-12-31T23:30:00Z')), 0);
});

test('one address cannot flood the subscriptions', () => {
  const limited = push.createRateLimit(2, 1000);
  assert.equal(limited('a', 0), false);
  assert.equal(limited('a', 1), false);
  assert.equal(limited('a', 2), true);
  assert.equal(limited('b', 2), false);
  assert.equal(limited('a', 1001), false, 'a new window');
});

test('the home chip is offered only where a reminder can work', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/script.10xc.daily-reminder.js'), 'utf8');
  const fn = src.slice(src.indexOf('function dailyReminderSupport'), src.indexOf('async function loadDailyReminderServer'));
  const run = (navigator, win = {}) => {
    const c = { navigator, window: { matchMedia: () => ({ matches: false }), ...win } };
    vm.createContext(c);
    vm.runInContext(fn, c);
    return c.dailyReminderSupport();
  };
  const android = { userAgent: 'Mozilla/5.0 (Linux; Android 14)', serviceWorker: {} };
  assert.equal(run(android, { PushManager: {}, Notification: {} }), 'push');
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' };
  assert.equal(run(iphone), 'ios-install', 'Safari outside the home-screen app: the guide');
  assert.equal(run({ ...iphone, standalone: true, serviceWorker: {} }, { PushManager: {}, Notification: {} }), 'push');
  assert.equal(run({ userAgent: 'Old desktop browser' }), null, 'no push at all: no chip');
});

function parseCookies(req) {
  return Object.fromEntries(String(req.get('cookie') || '').split(';').filter(Boolean).map((part) => part.trim().split('=')));
}

async function serve(t, db, webpush, clock = () => new Date('2026-10-30T09:00:00Z')) {
  const app = express();
  const ready = Promise.resolve(true);
  const getUser = (req) => (req.get('x-test-user') ? { id: req.get('x-test-user') } : null);
  const routes = push.mountPushRoutes(app, { express, db, ready, secret: 'test-secret', getUser, readCookies: parseCookies, webpush, env: {}, log: { warn() {} }, clock });
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (url, body, headers = {}) => fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, ...headers }, body: JSON.stringify(body) });
  return { routes, base, post, get: (url) => fetch(base + url) };
}

function fakeWebpush() {
  const sent = [], failing = new Map();
  let generated = 0;
  return {
    sent, failing,
    get generated() { return generated; },
    generateVAPIDKeys() { generated += 1; return { publicKey: 'PUB' + generated, privateKey: 'PRIV' + generated }; },
    setVapidDetails(subject, publicKey) { this.details = { subject, publicKey }; },
    async sendNotification(sub, payload) {
      if (failing.has(sub.endpoint)) throw Object.assign(new Error('push failed'), { statusCode: failing.get(sub.endpoint) });
      sent.push({ endpoint: sub.endpoint, ...JSON.parse(payload) });
    },
  };
}

test('PostgreSQL: one reminder a day at the chosen hour, none once the daily Pokémon is done', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async (t) => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const { initDailyDb } = require('../lib/daily-game');
  const schema = 'push_' + randomUUID().replaceAll('-', ''), root = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await root.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await initDailyDb(db, new Date('2026-10-20T10:00:00Z'));
    await push.ensureTables(db); await push.ensureTables(db);
    const webpush = fakeWebpush();
    const s = await serve(t, db, webpush);

    // The signing keys are made once and kept.
    const key = await (await s.get('/api/push/key')).json();
    assert.deepEqual(key, { ok: true, publicKey: 'PUB1', hours: push.HOURS });
    assert.equal(webpush.details.subject, 'https://pokdle.fr');
    assert.deepEqual(await push.vapidKeys(db, {}, () => assert.fail('no second pair')), { publicKey: 'PUB1', privateKey: 'PRIV1' });

    // Subscribing: same-site JSON only, valid subscriptions only.
    const guest = issueDailyGuest('test-secret');
    const sub = (endpoint, hour) => ({ subscription: { endpoint, keys: KEYS }, hour });
    assert.equal((await s.post('/api/push/subscribe', sub(FCM + 'evil', 18), { origin: 'https://evil.example' })).status, 403);
    assert.equal((await s.post('/api/push/subscribe', sub('https://evil.example/x', 18))).status, 400);
    assert.equal((await s.post('/api/push/subscribe', sub(FCM + 'guest', 18), { cookie: 'pokdle_daily=' + guest.cookie })).status, 200);
    assert.equal((await s.post('/api/push/subscribe', sub(FCM + 'user', 18), { 'x-test-user': '42' })).status, 200);
    assert.equal((await s.post('/api/push/subscribe', sub(FCM + 'gone', 18))).status, 200);
    assert.equal((await s.post('/api/push/subscribe', sub(FCM + 'morning', 8))).status, 200);
    assert.equal(await push.countActive(db), 4);
    // Subscribing again changes the hour, and never forgets who the browser belongs to.
    await s.post('/api/push/subscribe', sub(FCM + 'guest', 18));
    assert.equal((await db.query('SELECT guest_key FROM push_subscriptions WHERE endpoint=$1', [FCM + 'guest'])).rows[0].guest_key, 'guest:' + guest.id);

    // A series for the account, and today's game already won by the guest.
    const day = '2026-10-30';
    for (const d of ['2026-10-27', '2026-10-28', '2026-10-29', day]) await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,25)', [d]);
    for (const d of ['2026-10-27', '2026-10-28', '2026-10-29']) await db.query("INSERT INTO daily_plays(identity,day,account_id,status) VALUES('user:42',$1,'42','won')", [d]);
    await db.query("INSERT INTO daily_plays(identity,day,status) VALUES($1,$2,'won')", ['guest:' + guest.id, day]);
    webpush.failing.set(FCM + 'gone', 410);

    // 17 h in Paris: nobody is due.
    assert.equal(await push.sendDue({ db, webpush, now: new Date('2026-10-30T16:30:00Z') }), 0);
    // 18 h: the account gets its series, the guest already played, the dead subscription goes.
    assert.equal(await push.sendDue({ db, webpush, now: new Date('2026-10-30T17:00:30Z'), log: { warn() {} } }), 1);
    assert.deepEqual(webpush.sent.map((m) => m.endpoint), [FCM + 'user']);
    assert.match(webpush.sent[0].body, /série de 3 jours/);
    assert.equal(webpush.sent[0].url, '/');
    assert.equal(await push.countActive(db), 3, 'the browser that dropped it is forgotten');
    // Later in the same hour, or after a restart: never twice the same day.
    assert.equal(await push.sendDue({ db, webpush, now: new Date('2026-10-30T17:40:00Z') }), 0);
    // Playing today before the hour means no reminder; the next day it comes back.
    await db.query("INSERT INTO daily_rounds(day,secret_id) VALUES('2026-10-31',4)");
    await db.query("INSERT INTO daily_plays(identity,day,account_id,status) VALUES('user:42','2026-10-31','42','abandoned')");
    assert.equal(await push.sendDue({ db, webpush, now: new Date('2026-10-31T17:05:00Z') }), 1);
    assert.deepEqual(webpush.sent.map((m) => m.endpoint), [FCM + 'user', FCM + 'guest']);
    assert.doesNotMatch(webpush.sent[1].body, /série/, 'the guest won yesterday only: no series to keep yet');

    // Turned on at 20 h 30 for 20 h: nothing a minute later, the next day at 20 h.
    const late = await serve(t, db, webpush, () => new Date('2026-10-31T19:30:00Z'));
    assert.equal((await late.post('/api/push/subscribe', sub(FCM + 'late', 20))).status, 200);
    assert.equal(await push.sendDue({ db, webpush, now: new Date('2026-10-31T19:31:00Z') }), 0);
    await db.query("INSERT INTO daily_rounds(day,secret_id) VALUES('2026-11-01',7)");
    assert.equal(await push.sendDue({ db, webpush, now: new Date('2026-11-01T19:00:00Z') }), 1);
    assert.equal(webpush.sent.at(-1).endpoint, FCM + 'late');
    await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [FCM + 'late']);

    // Stopping removes it for good.
    assert.equal((await s.post('/api/push/unsubscribe', { endpoint: FCM + 'guest' })).status, 200);
    assert.equal(await push.countActive(db), 2);
  } finally {
    if (db) await db.end();
    await root.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await root.end();
  }
});
