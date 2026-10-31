'use strict';
// Messages from the site's creator to signed-in players (31/10/2026): written from /admin, read
// once in a 📬 window, answered from that window; no e-mail, nothing for guests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const messages = require('../lib/player-messages');
const admin = require('../lib/admin-panel');
const pushReminders = require('../lib/push-reminders');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('a message keeps its line breaks, not its control characters, and has a size', () => {
  assert.deepEqual(messages.cleanText('  Salut  Kayan !\r\n\r\n\r\n\r\nMerci\u0007 pour  tout ', 500), { text: 'Salut Kayan !\n\nMerci pour tout' });
  assert.ok(messages.cleanText(' a ', 500).error, 'too short');
  assert.ok(messages.cleanText('x'.repeat(501), 500).error, 'too long');
  assert.equal(messages.cleanText(null, 500).error, 'Le message est trop court.');
});

test('the admin section escapes what players wrote and says who read what', () => {
  const html = messages.adminSectionHtml({
    players: [{ discord_id: '7', username: '<b>Sacha</b>', seen: '2026-10-31' }],
    messages: [
      { id: 3, to: '7', username: '<b>Sacha</b>', body: 'Salut !\nÇa va ?', day: '2026-10-31', live: true, reads: 1,
        replies: [{ username: 'Sacha<script>', body: 'Oui <img src=x>', day: '2026-10-31' }] },
      { id: 2, to: null, username: null, body: 'Merci à tous', day: '2026-10-30', live: false, reads: 4, replies: [] },
    ],
  }, 12);
  assert.match(html, /<option value="all">Tous les joueurs qui ont un compte<\/option><option value="7">&lt;b&gt;Sacha&lt;\/b&gt; · vu le 31\/10<\/option>/);
  assert.match(html, /31\/10 → <b>&lt;b&gt;Sacha&lt;\/b&gt;<\/b> · Lu ✓<\/div><div class="body">Salut !<br>Ça va \?<\/div>/);
  assert.match(html, /<b>Sacha&lt;script&gt;<\/b> · 31\/10<br>Oui &lt;img src=x&gt;/);
  assert.match(html, /30\/10 → <b>Tous les joueurs<\/b> · Lu par 4 · expiré/);
  assert.match(html, /\(12 en tout\)/);
  assert.match(html, /<input type="checkbox" name="push" value="1" checked>/);
  assert.doesNotMatch(html, /<script>|<img src=x>/);
});

function client() {
  const code = read('src/script.10xg.player-messages.js');
  const posted = [];
  const overlay = { dataset: {}, classList: { contains: () => false } };
  const env = {
    document: { getElementById: (id) => (id === 'overlay-modal' ? overlay : null), querySelector: () => null },
    window: {},
    location: { search: '' },
    history: {},
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    ensureOverlay: (title, html) => { env.shown.push({ title, html }); },
    closeOverlayModal: () => { env.closed += 1; },
    showToast: () => {},
    fetch: (url, options) => { posted.push([url, JSON.parse(options.body)]); return Promise.resolve({ json: () => Promise.resolve({ ok: true }) }); },
    shown: [], closed: 0,
  };
  const api = Function(...Object.keys(env), code + '; return { playerMessageHtml, showNextPlayerMessage, nextPlayerMessage, setQueue: (q) => { playerMessagesQueue = q; } };')(...Object.values(env));
  return { api, env, posted, overlay };
}

test('the 📬 window shows the message safely, counts it read, and offers an answer', () => {
  const { api, env, posted, overlay } = client();
  api.setQueue([{ id: 4, body: 'Salut <b>!</b>\nMerci', day: '2026-10-31' }, { id: 5, body: 'Deuxième', day: '2026-10-31' }]);
  assert.equal(api.showNextPlayerMessage(), true);
  assert.equal(env.shown[0].title, '📬 Un message pour toi');
  assert.equal(overlay.dataset.kind, 'message');
  assert.match(env.shown[0].html, /Du créateur de Pokédle · le 31\/10/);
  assert.match(env.shown[0].html, /Salut &lt;b&gt;!&lt;\/b&gt;<br>Merci/);
  assert.match(env.shown[0].html, /data-action="sendPlayerMessageReply" data-args="\[4\]"/);
  assert.match(env.shown[0].html, /Message suivant →/);
  assert.deepEqual(posted, [['/api/messages/read', { id: 4 }]]);
  api.nextPlayerMessage();
  assert.match(env.shown[1].html, /data-action="nextPlayerMessage">Fermer</);
  api.nextPlayerMessage();
  assert.equal(env.closed, 1);
  // Shown once the player is signed in, and from the notification's link.
  const src = read('src/script.10xg.player-messages.js');
  assert.match(src, /addEventListener\('pokedle:auth-ready'/);
  assert.match(src, /\[\?&\]messages=1/);
  assert.match(read('sw.js'), /data\.tag === "pokedle-message" \? "pokedle-message" : "pokedle-daily"/);
});

test('the privacy page and the account deletion cover the messages', () => {
  assert.match(read('confidentialite.html'), /le créateur du site peut t’écrire un message[\s\S]*effacés au bout de 90 jours, ou tout de suite si tu supprimes ton compte/);
  const deletion = read('server.js');
  for (const table of ['player_message_replies', 'player_message_reads', 'player_messages', 'weekly_awards']) {
    assert.match(deletion, new RegExp(`\\["${table}", "DELETE FROM ${table} WHERE (account_id|discord_id) = \\$1", \\[id\\]\\]`), table);
  }
});

test('PostgreSQL: the creator writes, the player reads once and answers, nobody else sees it', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async (t) => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const schema = 'messages_' + randomUUID().replaceAll('-', ''), root = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await root.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '',data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_login TIMESTAMPTZ NOT NULL DEFAULT now(),partner_id INTEGER,xp INTEGER,photo_key TEXT,photo BYTEA)`);
    await admin.ensureTables(db);
    await messages.ensureTables(db); await messages.ensureTables(db);
    await pushReminders.ensureTables(db);
    await db.query("INSERT INTO users(discord_id,username,created_at) VALUES('42','Kayan',now()-interval '30 days'),('7','Sacha',now()-interval '10 days'),('8','Ondine',now()-interval '5 days')");
    await db.query("INSERT INTO push_subscriptions(endpoint,p256dh,auth,hour,account_id) VALUES('https://push.example/7','k','a',18,'7'),('https://push.example/guest','k','a',8,NULL),('https://push.example/gone','k','a',8,'8')");

    const pushed = [];
    const webpush = { sendNotification: async (sub, payload) => {
      if (sub.endpoint.endsWith('/gone')) { const e = new Error('gone'); e.statusCode = 410; throw e; }
      pushed.push([sub.endpoint, JSON.parse(payload)]);
    } };
    const app = express();
    const getUser = (req) => (req.get('x-test-user') ? { id: req.get('x-test-user'), username: 'Test' } : null);
    admin.mountAdminRoutes(app, { express, db, ready: Promise.resolve(true), getSessionUser: getUser, adminIds: new Set(['42']), log: { error() {}, warn() {} },
      messages: { module: messages, webpush, pushReady: Promise.resolve(true) } });
    messages.mountPlayerRoutes(app, { express, db, ready: Promise.resolve(true), getUser, log: { error() {} } });
    const listener = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise((resolve) => listener.close(resolve)));
    const base = 'http://127.0.0.1:' + listener.address().port;
    const form = (p, user, fields) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-test-user': user, Origin: base }, body: new URLSearchParams(fields).toString() });
    const json = (p, user, body, origin = base) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}), ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
    const inbox = async (user) => (await (await fetch(base + '/api/messages', { headers: user ? { 'x-test-user': user } : {} })).json()).messages;

    // Only the admin writes, to someone chosen.
    assert.equal((await form('/admin/messages', '7', { to: '8', body: 'Pirate' })).status, 403);
    assert.match((await form('/admin/messages', '42', { to: '', body: 'Salut' })).headers.get('location'), /err=Choisis/);
    assert.match((await form('/admin/messages', '42', { to: '999', body: 'Salut' })).headers.get('location'), /err=Joueur/);
    const sent = await form('/admin/messages', '42', { to: '7', body: 'Salut Sacha !\nTu aimes Dessine-le ?', push: '1' });
    assert.equal(sent.headers.get('location'), '/admin?ok=message');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(pushed.map((p) => p[0]), ['https://push.example/7'], 'only the player\'s own 🔔 subscription');
    assert.deepEqual(pushed[0][1], { title: '📬 Un message pour toi', body: 'Le créateur de Pokédle t\'a écrit. Ouvre le site pour le lire.', url: '/?messages=1', tag: 'pokedle-message' });

    // The player sees it; another player and a guest do not.
    const [mine] = await inbox('7');
    assert.equal(mine.body, 'Salut Sacha !\nTu aimes Dessine-le ?');
    assert.deepEqual(await inbox('8'), []);
    assert.deepEqual(await inbox(null), []);
    assert.equal((await json('/api/messages/read', '8', { id: mine.id })).status, 200);
    assert.equal((await (await json('/api/messages/read', '8', { id: mine.id })).json()).ok, false, 'not his message');
    assert.equal((await json('/api/messages/reply', '8', { id: mine.id, body: 'Je lis tout' })).status, 400);
    assert.equal((await json('/api/messages/read', '7', { id: mine.id }, 'https://evil.example')).status, 403);
    assert.equal((await json('/api/messages/read', null, { id: mine.id })).status, 401);

    // Read once: it never comes back; the answer still goes through, three at most.
    assert.equal((await (await json('/api/messages/read', '7', { id: mine.id })).json()).ok, true);
    assert.deepEqual(await inbox('7'), []);
    assert.equal((await (await json('/api/messages/reply', '7', { id: mine.id, body: 'Oui, trop bien !' })).json()).ok, true);
    await json('/api/messages/reply', '7', { id: mine.id, body: 'Et le chat aussi' });
    await json('/api/messages/reply', '7', { id: mine.id, body: 'Dernier mot' });
    assert.equal((await (await json('/api/messages/reply', '7', { id: mine.id, body: 'Encore' })).json()).error, 'Tu as déjà répondu à ce message.');

    // A message to everyone: the players who had an account then, for two weeks.
    await db.query("INSERT INTO users(discord_id,username,created_at) VALUES('9','Pierre',now()+interval '1 minute')");
    await form('/admin/messages', '42', { to: 'all', body: 'Merci à tous ceux qui jouent !' });
    assert.equal((await inbox('8'))[0].body, 'Merci à tous ceux qui jouent !');
    assert.deepEqual(await inbox('9'), [], 'a player who signed up later is not greeted with old news');
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE endpoint LIKE '%/gone'")).rows[0].n, 1, 'no push without the box ticked');

    // The panel lists the answers.
    const panel = await (await fetch(base + '/admin', { headers: { 'x-test-user': '42' } })).text();
    assert.match(panel, /<h2>Écrire aux joueurs<\/h2>/);
    assert.match(panel, /→ <b>Sacha<\/b> · Lu ✓/);
    assert.match(panel, /<b>Sacha<\/b> · \d\d\/\d\d<br>Oui, trop bien !/);
    assert.match(panel, /→ <b>Tous les joueurs<\/b> · Lu par 0/);

    // Removed by the admin, or erased after 90 days, with its answers.
    const broadcast = (await db.query("SELECT id FROM player_messages WHERE account_id IS NULL")).rows[0].id;
    assert.equal((await form('/admin/messages/remove', '42', { id: String(broadcast) })).headers.get('location'), '/admin?ok=message-removed');
    assert.deepEqual(await inbox('8'), []);
    await db.query("UPDATE player_messages SET created_at = now() - interval '91 days'");
    await messages.purge(db);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM player_message_replies')).rows[0].n, 0);
  } finally {
    if (db) await db.end();
    await root.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await root.end();
  }
});
