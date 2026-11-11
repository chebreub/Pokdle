'use strict';
// ⚔️ Défi par lien (11/11/2026, « go défi ») : création réservée aux comptes, relevé sans compte,
// mêmes 10 Pokémon pour tous, essais vérifiés par le serveur, une tentative par personne,
// classement du défi, invité repris par son compte, blocages respectés, aperçu des messageries.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lib = require('../lib/link-duels');
const series = require('../lib/player-challenge-series');

// 12 Pokémon de test, tous de Gen 1, le comparateur ne regarde que l'id.
const POKEMON = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: 'P' + (i + 1), gen: 1, height: i + 1, weight: i + 1 }));
const compare = (a, b) => ({ type1: a.id === b.id ? 'correct' : 'wrong' });

async function withSchema(run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'duel_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await lib.ensureTables(db);
    await run(db);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
}

function service(db, extra = {}) {
  const pushed = [];
  let k = 0;
  const duels = lib.createLinkDuels({ db, pokemon: POKEMON, compare, secret: 'test-secret', nameOf: async (id) => 'Joueur' + id,
    push: async (to, payload) => { pushed.push({ to, payload }); return 1; }, randomInt: (n) => (k++ * 7) % n, ...extra });
  return { duels, pushed };
}
const user = (id) => ({ key: 'user:' + id, guestKey: '', accountId: String(id) });
const guest = (g) => ({ key: 'guest:' + g, guestKey: 'guest:' + g, accountId: null });

// Joue une série entière : trouve les `found` premiers Pokémon du premier coup, passe les autres.
async function playAll(duels, token, who, found) {
  let view = await duels.view(token, who);
  for (let round = 0; round < 10; round++) {
    const ids = (await (async () => view)()).game;
    assert.ok(ids && !ids.done, 'la partie est en cours');
    const action = round < found ? { pokemonId: SECRET[token][round] } : { pass: true };
    view = await duels.play(token, who, { round, ...action });
    assert.equal(view.ok, true);
  }
  return view;
}
const SECRET = {};
async function remember(db, token) {
  SECRET[token] = (await db.query('SELECT series_ids FROM link_duels WHERE token = $1', [token])).rows[0].series_ids;
}

test('le parcours complet : créer, jouer, partager, relever sans compte, classement, notification', { skip: !process.env.QA_DATABASE_URL }, async () => {
  await withSchema(async (db) => {
    const { duels, pushed } = service(db);
    assert.deepEqual(await duels.create(null), { ok: false, error: 'login' }, 'créer demande un compte');
    const made = await duels.create('1');
    assert.equal(made.ok, true);
    assert.match(made.token, lib.TOKEN_RE);
    await remember(db, made.token);
    assert.equal(SECRET[made.token].length, 10, 'dix Pokémon tirés par le serveur');
    // Tant que le créateur n'a pas fini, le lien n'est pas ouvert aux autres.
    assert.equal((await duels.view(made.token, guest('a'))).error, 'not_ready');
    assert.equal((await duels.start(made.token, guest('a'), { ip: '1.1.1.1' })).error, 'not_ready');
    const mine = await duels.view(made.token, user('1'));
    assert.equal(mine.isCreator, true);
    assert.ok(Array.isArray(mine.game.rows) && mine.game.index === 0);
    assert.equal(JSON.stringify(mine).includes('series_ids'), false, 'les secrets ne partent jamais au navigateur');
    const done = await playAll(duels, made.token, user('1'), 7);
    assert.equal(done.state, 'open', 'le lien s’ouvre à la fin de la série du créateur');
    assert.equal(done.creator.found, 7);
    // Aperçu WhatsApp / Discord : le score du créateur.
    const preview = await duels.preview(made.token);
    assert.deepEqual({ name: preview.name, found: preview.found }, { name: 'Joueur1', found: 7 });
    assert.match(lib.previewTexts(preview).title, /Joueur1 te défie : 7 Pokémon sur 10\. Tu fais mieux \?/);
    // Un invité le relève, sans compte, avec un pseudo.
    const intro = await duels.view(made.token, guest('a'));
    assert.equal(intro.canPlay, true);
    assert.equal((await duels.start(made.token, guest('a'), { name: 'Lulu', ip: '1.1.1.1' })).ok, true);
    const end = await playAll(duels, made.token, guest('a'), 8);
    assert.equal(end.game.done, true);
    assert.equal(end.fresh, true);
    assert.deepEqual(end.board.rows.map((r) => [r.name, r.found, r.me]), [['Lulu', 8, true], ['Joueur1', 7, false]], 'classement : trouvés d’abord');
    assert.equal(pushed.length, 1);
    assert.match(pushed[0].payload.title, /Lulu a battu ton défi/);
    assert.equal(pushed[0].to, '1');
    // Une seule tentative : rejouer ne remet pas à zéro.
    assert.equal((await duels.start(made.token, guest('a'), { ip: '1.1.1.1' })).already, true);
    assert.equal((await duels.play(made.token, guest('a'), { round: 0, pass: true })).game.found, 8, 'une partie finie ne bouge plus');
    // Le créateur ne joue pas contre lui-même.
    assert.equal((await duels.start(made.token, user('1'), { ip: '2.2.2.2' })).ok, true, 'déjà inscrit : ok sans rien créer');
    assert.equal(Number((await db.query('SELECT COUNT(*) FROM link_duel_entries')).rows[0].count), 2);
  });
});

test('équité et triche : réponses refusées hors du défi, essais hors tour ignorés, départage aux essais', { skip: !process.env.QA_DATABASE_URL }, async () => {
  await withSchema(async (db) => {
    const { duels } = service(db);
    const { token } = await duels.create('1');
    await remember(db, token);
    // Un essai pour une manche qui n'est pas la sienne est ignoré (rejeu réseau, onglet en double).
    const ignored = await duels.play(token, user('1'), { round: 3, pokemonId: SECRET[token][3] });
    assert.equal(ignored.game.index, 0);
    assert.equal((await duels.play(token, user('1'), { round: 0, pokemonId: 999 })).error, 'invalid_guess', 'un Pokémon hors du défi est refusé');
    await playAll(duels, token, user('1'), 5);
    // Deux invités à 5/10 : celui qui a le moins d'essais passe devant.
    await duels.start(token, guest('b'), { name: 'Bob', ip: '3.3.3.3' });
    let v = await duels.view(token, guest('b'));
    const wrong = POKEMON.find((p) => !SECRET[token].includes(p.id)).id;
    v = await duels.play(token, guest('b'), { round: 0, pokemonId: wrong });
    assert.equal(v.game.attempts, 1);
    assert.equal(v.game.rows.length, 1, 'les pastilles de l’essai reviennent du serveur');
    for (let round = 0; round < 10; round++) v = await duels.play(token, guest('b'), round < 5 ? { round, pokemonId: SECRET[token][round] } : { round, pass: true });
    assert.equal(v.game.found, 5);
    assert.equal(v.game.attemptsWon, 6);
    assert.deepEqual(v.board.rows.map((r) => r.name), ['Joueur1', 'Bob'], 'à égalité de trouvés, le moins d’essais gagne');
  });
});

test('une tentative par personne, au mieux : réseau limité, compte unique, invité repris par son compte', { skip: !process.env.QA_DATABASE_URL }, async () => {
  await withSchema(async (db) => {
    const { duels } = service(db);
    const { token } = await duels.create('1');
    await remember(db, token);
    await playAll(duels, token, user('1'), 3);
    for (const g of ['c1', 'c2', 'c3']) assert.equal((await duels.start(token, guest(g), { ip: '9.9.9.9' })).ok, true);
    assert.equal((await duels.start(token, guest('c4'), { ip: '9.9.9.9' })).error, 'network_limit', 'au plus 3 invités par réseau et par défi');
    assert.equal((await duels.start(token, user('7'), { ip: '9.9.9.9' })).ok, true, 'un compte n’est pas limité par le réseau');
    // L'invité c1 se connecte avec le compte 8 : sa partie le suit.
    await duels.play(token, guest('c1'), { round: 0, pokemonId: SECRET[token][0] });
    const claimed = await duels.view(token, { key: 'user:8', guestKey: 'guest:c1', accountId: '8' });
    assert.equal(claimed.game.found, 1, 'progression reprise par le compte');
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM link_duel_entries WHERE identity = 'guest:c1'")).rows[0].n, 0);
    // Le compte 7 a déjà sa partie : un invité qui s'y connecte ne crée pas de doublon.
    await duels.start(token, guest('c5'), { ip: '8.8.8.8' });
    await duels.view(token, { key: 'user:7', guestKey: 'guest:c5', accountId: '7' });
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM link_duel_entries WHERE account_id = '7'")).rows[0].n, 1);
  });
});

test('blocages, défis expirés, brouillons abandonnés, limite de création', { skip: !process.env.QA_DATABASE_URL }, async () => {
  await withSchema(async (db) => {
    const { duels } = service(db, { blocked: async (a, b) => [a, b].sort().join() === ['1', '5'].sort().join() });
    const { token } = await duels.create('1');
    await remember(db, token);
    await playAll(duels, token, user('1'), 4);
    const seen = await duels.view(token, user('5'));
    assert.equal(seen.canPlay, false);
    assert.equal(seen.blocked, true);
    assert.equal((await duels.start(token, user('5'), { ip: '5.5.5.5' })).error, 'blocked', 'un joueur bloqué ne relève pas le défi');
    // Expiré : on ne commence plus, le classement reste lisible.
    await db.query("UPDATE link_duels SET expires_at = NOW() - INTERVAL '1 minute' WHERE token = $1", [token]);
    assert.equal((await duels.start(token, guest('z'), { ip: '6.6.6.6' })).error, 'closed');
    const closed = await duels.view(token, guest('z'));
    assert.equal(closed.state, 'closed');
    assert.ok(closed.board.rows.length >= 1);
    assert.equal(await duels.preview('inexistant1'), null);
    // Un brouillon jamais fini expire au bout d'un jour, et le créateur ne peut plus y jouer.
    const draft = await duels.create('1');
    await db.query("UPDATE link_duels SET expires_at = NOW() - INTERVAL '1 minute' WHERE token = $1", [draft.token]);
    assert.equal((await duels.play(draft.token, user('1'), { round: 0, pass: true })).error, 'closed');
    // 20 défis par jour au plus.
    await db.query(`INSERT INTO link_duels(token, creator_id, series_ids, series_gens, expires_at)
      SELECT 'tok' || g || 'abcdef', '2', '[]'::jsonb, ARRAY[1], NOW() FROM generate_series(1, ${lib.PER_DAY}) g`);
    assert.equal((await duels.create('2')).error, 'daily_limit');
  });
});

test('pseudos d’invité : propres, jamais un lien', () => {
  assert.equal(lib.guestName('  Lulu  '), 'Lulu');
  assert.equal(lib.guestName('http://x.fr'), 'Invité');
  assert.equal(lib.guestName('@moi'), 'Invité');
  assert.equal(lib.guestName(''), 'Invité');
  assert.equal(lib.guestName('Ça va Évoli'), 'Ça va Évoli');
});

test('aperçu des messageries : titre, description, image, noindex', () => {
  const html = '<meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:image" content="x">' +
    '<meta name="twitter:title" content="x"><meta name="twitter:description" content="x"><meta name="twitter:image" content="x"><link rel="canonical" href="/">';
  const out = lib.duelPageHtml(html, { name: 'Kay<an>', found: 7, players: 3, closed: false });
  assert.match(out, /og:title" content="Kay&lt;an&gt; te défie : 7 Pokémon sur 10\. Tu fais mieux \?"/);
  assert.match(out, /3 joueurs l&#39;ont|3 joueurs l'ont déjà relevé/);
  assert.match(out, /og:image" content="https:\/\/pokdle\.fr\/img\/og\/defi-lien\.jpg"/);
  assert.match(out, /<meta name="robots" content="noindex">/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'img/og/defi-lien.jpg')));
});

test('le site : réutilise la série de 10 et les aides des défis, n’édite pas les défis entre amis', () => {
  const src = read('lib/link-duels.js');
  assert.match(src, /series\.advance\(state, "p"/, 'mêmes règles que la série commune');
  assert.match(src, /series\.pickSeries\(pokemon, series\.DEFAULT_GENS/);
  assert.doesNotMatch(src, /INSERT INTO player_challenges/, 'les défis entre amis ne sont pas touchés');
  const client = read('src/script.10zzzzd.link-duels.js');
  assert.match(client, /navigator\.share\(/, 'partage natif sur téléphone et appli installée');
  assert.match(client, /wa\.me\/\?text=/);
  assert.match(client, /pcSuggestHtml\(ldMatches/, 'les suggestions des défis existants');
  assert.match(client, /window\.openLinkDuelCreate = function \(\) \{ ldCreate\(\); \};/, 'pas de récursion avec la fonction globale');
  const server = read('server.js');
  assert.match(server, /app\.get\("\/d\/:token"/);
  assert.match(server, /\["link_duel_entries", "DELETE FROM link_duel_entries WHERE account_id = \$1 OR identity = \$2"/, 'effacé avec le compte');
  assert.match(server, /\["link_duels", "DELETE FROM link_duels WHERE creator_id = \$1"/);
  assert.equal(series.TOTAL, 10);
});
