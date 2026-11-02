"use strict";
// Défis entre joueurs (01/11/2026): from a trainer card, a signed-in player challenges another one
// to beat a record of theirs in an arcade game (« Bats ma série au Higher or Lower : 23 »). The
// target comes from the scores the server keeps, and the challenge is won by a result the server
// records for that game afterwards, never by anything the browser claims about the challenge.
// The challenger picks one of a few ready-made phrases (a free message only between friends, since
// Défis v2). A player can refuse a challenge, stop one player's challenges, or turn challenges off.
// Kept 30 days.
// « Trouve ce Pokémon » : the challenger picks a Pokémon, kept on the server only; the other player
// guesses it with the clues of the Pokémon du jour, compared by the server, in 6, 8 or 10 tries.
const CHALLENGE_MODES = Object.freeze({
  higherlower: { label: "Higher or Lower", kind: "serie" },
  higherlower60: { label: "Higher or Lower 60 s", kind: "record" },
  poids: { label: "Duel de poids", kind: "serie" },
  intrus: { label: "Intrus", kind: "serie" },
  typecombo: { label: "Combo de types", kind: "record" },
  quiz: { label: "Quiz", kind: "record", max: 15 },
  speedrun: { label: "Speedrun Pokédex", kind: "record" },
  draft_all: { label: "Draft Score Attack", kind: "record" },
  // Défis v2 (01/11/2026): the Draft record of one generation (the server keeps draft_1…draft_9).
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => ["draft_" + (i + 1), { label: "Draft Gen " + (i + 1), kind: "record" }])),
  // Défis v2: 7 more games (15 in all). The guessing series count on a series of 10 mysteries.
  party: { label: "Marathon mini-jeux", kind: "record", max: 20 },
  pixel10: { label: "Pokémon pixelisé (10)", kind: "record", max: 10 },
  silhouette10: { label: "Zoom progressif (10)", kind: "record", max: 10 },
  cry10: { label: "Cri (10)", kind: "record", max: 10 },
  description10: { label: "Description Pokédex (10)", kind: "record", max: 10 },
  shiny: { label: "Shiny ou normal", kind: "record" },
  petitbac: { label: "Petit Bac", kind: "record", max: 8 },
});
// A target at the game's maximum (10 / 10, 15 / 15…) cannot be beaten: matching it wins.
const NO_MAX = 1000000;
const needOf = (mode) => CHALLENGE_MODES[mode]?.max || NO_MAX;
// New phrases go at the end: a challenge keeps the number of its phrase.
const PHRASES = Object.freeze(["Tu tiendras pas 😏", "Facile pour toi ?", "Revanche ? 🔥", "Bonne chance 🍀", "À toi de jouer !", "Tu le trouveras jamais 😏"]);
const MYSTERY = "pokemon";
const MYSTERY_LABEL = "Pokémon mystère";
const MYSTERY_ATTEMPTS = Object.freeze([6, 8, 10]);
const PER_DAY = 5;
// Défis v2: up to 20 a day when they go to friends (still 5 to other players), a duration to
// choose, a free message between friends, and « 📅 Du jour » (fewer tries at today's Pokémon).
const PER_DAY_FRIENDS = 20;
const DAY_CHOICES = Object.freeze([1, 3, 7]);
const NOTE_MAX = 100;
const DAILY = "jour";
const DAILY_LABEL = "Pokémon du jour";
const PARIS_TODAY = "timezone('Europe/Paris', now())::date";
const PARIS_MIDNIGHT = "((date_trunc('day', timezone('Europe/Paris', now())) + interval '1 day') AT TIME ZONE 'Europe/Paris')";
const DAYS = 7;
const KEEP_DAYS = 30;
const ALL = "*";
const PARIS_DAY_START = "(date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')";

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS player_challenges (
    id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, mode TEXT NOT NULL,
    target INTEGER NOT NULL, phrase SMALLINT NOT NULL DEFAULT 0, best INTEGER,
    status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ,
    seen_to BOOLEAN NOT NULL DEFAULT false, seen_from BOOLEAN NOT NULL DEFAULT true)`);
  await db.query("CREATE INDEX IF NOT EXISTS player_challenges_to ON player_challenges(to_id, status)");
  await db.query("CREATE INDEX IF NOT EXISTS player_challenges_from ON player_challenges(from_id, created_at)");
  // blocked_id '*' : this player takes no challenges at all.
  await db.query(`CREATE TABLE IF NOT EXISTS player_challenge_blocks (
    account_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, blocked_id))`);
  // « Trouve ce Pokémon » : the hidden Pokémon and the tries (its number of tries is the target).
  await db.query("ALTER TABLE player_challenges ADD COLUMN IF NOT EXISTS secret_id INTEGER");
  await db.query("ALTER TABLE player_challenges ADD COLUMN IF NOT EXISTS guesses JSONB NOT NULL DEFAULT '[]'::jsonb");
  // Défis v2: a message between friends, and the day of a « Du jour » challenge.
  await db.query("ALTER TABLE player_challenges ADD COLUMN IF NOT EXISTS note TEXT");
  await db.query("ALTER TABLE player_challenges ADD COLUMN IF NOT EXISTS day DATE");
}

const verb = (mode) => (CHALLENGE_MODES[mode]?.kind === "serie" ? "série" : "record");

// friends.areFriends (lib/player-friends.js) and checkNote (the chat's filter: no links nor numbers).
function createPlayerChallenges({ db, accountOfPid, playerPid, push = async () => 0, ready = Promise.resolve(true), log = console, pokemon = [], compare = null,
  friends = null, checkNote = null }) {
  const isFriend = async (a, b) => { try { return Boolean(friends && await friends.areFriends(a, b)); } catch (_error) { return false; } };
  // Today's challenges sent, and how many went to players who are not friends.
  async function sentToday(from) {
    const rows = (await db.query(`SELECT to_id FROM player_challenges WHERE from_id = $1 AND created_at >= ${PARIS_DAY_START}`, [from])).rows;
    let others = 0;
    for (const row of rows) if (!await isFriend(from, row.to_id)) others += 1;
    return { total: rows.length, others };
  }
  const dailyTries = async (id) => {
    const row = (await db.query(`SELECT status, jsonb_array_length(guessed) AS tries FROM daily_plays WHERE account_id = $1 AND day = ${PARIS_TODAY}
      ORDER BY (status = 'won') DESC LIMIT 1`, [String(id)]).catch(() => ({ rows: [] }))).rows[0];
    return row || null;
  };
  const byId = new Map(pokemon.map((p) => [Number(p.id), p]));
  const nameOf = async (id) => (await db.query("SELECT username FROM users WHERE discord_id = $1", [String(id)])).rows[0]?.username || "Un dresseur";
  const tell = (to, payload) => Promise.resolve(push(String(to), payload)).catch((error) => log.warn("[defis] push:", String(error?.message || error).slice(0, 120)));

  async function options(accountId) {
    await ready;
    const id = String(accountId);
    const records = (await db.query("SELECT mode, score FROM scores WHERE discord_id = $1 AND mode = ANY($2) AND score > 0",
      [id, Object.keys(CHALLENGE_MODES)])).rows;
    const sent = await sentToday(id);
    const off = (await db.query("SELECT 1 FROM player_challenge_blocks WHERE account_id = $1 AND blocked_id = $2", [id, ALL])).rowCount > 0;
    const byMode = Object.fromEntries(records.map((row) => [row.mode, Number(row.score)]));
    const today = await dailyTries(id);
    return {
      ok: true, pid: playerPid(id), accepting: !off,
      left: Math.max(0, Math.min(PER_DAY - sent.others, PER_DAY_FRIENDS - sent.total)), leftFriends: Math.max(0, PER_DAY_FRIENDS - sent.total),
      perDay: PER_DAY, perDayFriends: PER_DAY_FRIENDS, days: DAYS, dayChoices: DAY_CHOICES, noteMax: NOTE_MAX, phrases: PHRASES,
      mystery: compare ? { attempts: MYSTERY_ATTEMPTS } : null,
      daily: today && today.status === "won" ? { tries: Number(today.tries) } : null,
      modes: Object.entries(CHALLENGE_MODES).map(([mode, cfg]) => ({ mode, label: cfg.label, kind: cfg.kind, record: byMode[mode] || 0, ...(cfg.max ? { max: cfg.max } : {}) })),
    };
  }

  async function create(fromId, { pid, mode, phrase, pokemonId, attempts, days, note } = {}) {
    await ready;
    const from = String(fromId);
    const mystery = mode === MYSTERY;
    const daily = mode === DAILY;
    const cfg = mystery || daily ? null : CHALLENGE_MODES[mode];
    if (!mystery && !daily && !cfg) return { ok: false, error: "mode" };
    const length = days == null ? DAYS : Number(days);
    if (!DAY_CHOICES.includes(length)) return { ok: false, error: "days" };
    const said = Number(phrase);
    if (!Number.isInteger(said) || said < 0 || said >= PHRASES.length) return { ok: false, error: "phrase" };
    // The hidden Pokémon: one of the 1025, never a form, and a number of tries from the list.
    const secret = mystery ? byId.get(Number(pokemonId)) : null;
    if (mystery && (!secret || secret.isAltForm || !compare)) return { ok: false, error: "pokemon" };
    if (mystery && !MYSTERY_ATTEMPTS.includes(Number(attempts))) return { ok: false, error: "attempts" };
    const to = await accountOfPid(db, String(pid || ""));
    if (!to) return { ok: false, error: "unknown" };
    if (to === from) return { ok: false, error: "self" };
    let target;
    if (mystery) target = Number(attempts);
    else if (daily) {
      // « Du jour » : fewer tries than mine at today's Pokémon (found today).
      const today = await dailyTries(from);
      if (!today || today.status !== "won") return { ok: false, error: "no_daily" };
      target = Number(today.tries);
    } else target = Number((await db.query("SELECT score FROM scores WHERE discord_id = $1 AND mode = $2", [from, mode])).rows[0]?.score) || 0;
    if (target <= 0) return { ok: false, error: daily ? "no_daily" : "no_record" };
    if ((await db.query("SELECT 1 FROM player_challenge_blocks WHERE account_id = $1 AND blocked_id IN ($2, $3) LIMIT 1", [to, from, ALL])).rowCount) return { ok: false, error: "refused" };
    // « Du jour » to a player who already played today's Pokémon would be decided at once.
    if (daily && ["won", "abandoned"].includes((await dailyTries(to))?.status)) return { ok: false, error: "daily_done" };
    const friend = await isFriend(from, to);
    // A free message only between friends, with the chat's guard (no links, numbers, other apps).
    let message = null;
    if (note != null && String(note).trim()) {
      if (!friend) return { ok: false, error: "note_friends" };
      if ([...String(note).trim()].length > NOTE_MAX) return { ok: false, error: "note" };
      const checked = checkNote ? checkNote(note) : { body: String(note).trim() };
      if (checked.error) return { ok: false, error: checked.error === "contact" ? "note_contact" : "note" };
      message = checked.body;
    }
    const sent = await sentToday(from);
    if (sent.total >= PER_DAY_FRIENDS || (!friend && sent.others >= PER_DAY)) return { ok: false, error: "limit" };
    const open = (await db.query("SELECT 1 FROM player_challenges WHERE from_id = $1 AND to_id = $2 AND mode = $3 AND status = 'open' AND expires_at > now()", [from, to, mode])).rowCount;
    if (open) return { ok: false, error: "already" };
    // « Du jour » ends at midnight in Paris (always sooner than a day from now).
    const expires = daily ? `LEAST(${PARIS_MIDNIGHT}, now() + make_interval(days => $6))` : "now() + make_interval(days => $6)";
    const row = (await db.query(`INSERT INTO player_challenges(from_id, to_id, mode, target, phrase, expires_at, secret_id, note, day)
      VALUES ($1, $2, $3, $4, $5, ${expires}, $7, $8, ${daily ? PARIS_TODAY : "NULL"}) RETURNING id`, [from, to, mode, target, said, length, secret ? secret.id : null, message])).rows[0];
    const name = await nameOf(from);
    const what = mystery ? `Trouve son Pokémon mystère en ${target} essais.` : daily ? `Trouve le Pokémon du jour en moins de ${target} essais, aujourd’hui.` : `Bats sa ${verb(mode)} au ${cfg.label} : ${target}.`;
    tell(to, { title: `⚔️ ${name} te défie`, body: what + ` « ${message || PHRASES[said]} »`, url: "/?defis=1", tag: "pokedle-defi" });
    return { ok: true, id: Number(row.id), target };
  }

  // Called once a result of `mode` is stored for this player: an open challenge of theirs in that
  // game keeps their best score since it was sent, and is won once that score beats the target.
  async function afterResult(accountId, mode, score) {
    if (!CHALLENGE_MODES[mode]) return [];
    await ready;
    const n = Math.floor(Number(score));
    if (!Number.isFinite(n) || n <= 0) return [];
    const beats = "GREATEST(COALESCE(best, 0), $3) >= LEAST(target + 1, $4)";
    const rows = (await db.query(`UPDATE player_challenges SET best = GREATEST(COALESCE(best, 0), $3),
        status = CASE WHEN ${beats} THEN 'won' ELSE status END,
        resolved_at = CASE WHEN ${beats} THEN now() ELSE resolved_at END,
        seen_from = CASE WHEN ${beats} THEN false ELSE seen_from END
      WHERE to_id = $1 AND mode = $2 AND status = 'open' AND expires_at > now()
      RETURNING id, from_id, target, best, status`, [String(accountId), mode, n, needOf(mode)])).rows;
    const won = rows.filter((row) => row.status === "won");
    if (won.length) {
      const name = await nameOf(accountId);
      for (const row of won) tell(row.from_id, { title: `🏆 ${name} a battu ta ${verb(mode)}`, body: `${row.best} contre ${row.target} au ${CHALLENGE_MODES[mode].label}. Revanche ?`, url: "/?defis=1", tag: "pokedle-defi" });
    }
    return rows.map((row) => ({ id: Number(row.id), target: Number(row.target), best: Number(row.best), won: row.status === "won" }));
  }

  // « Du jour » : decided by the day's play of the challenged player, as soon as one of the two looks.
  async function settleDaily(id) {
    const rows = (await db.query(`SELECT c.id, c.from_id, c.to_id, c.target, p.status, p.tries FROM player_challenges c
      JOIN LATERAL (SELECT status, jsonb_array_length(guessed) AS tries FROM daily_plays d WHERE d.account_id = c.to_id AND d.day = c.day
        AND d.status IN ('won', 'abandoned') ORDER BY (d.status = 'won') DESC, jsonb_array_length(d.guessed) LIMIT 1) p ON true
      WHERE c.mode = $2 AND c.status = 'open' AND (c.from_id = $1 OR c.to_id = $1)`, [id, DAILY]).catch(() => ({ rows: [] }))).rows;
    for (const row of rows) {
      const won = row.status === "won" && Number(row.tries) < Number(row.target);
      const done = (await db.query(`UPDATE player_challenges SET status = $2, best = $3, resolved_at = now(), seen_from = false
        WHERE id = $1 AND status = 'open' RETURNING id`, [row.id, won ? "won" : "lost", row.status === "won" ? Number(row.tries) : null])).rowCount;
      if (done && won) {
        const name = await nameOf(row.to_id);
        tell(row.from_id, { title: `🏆 ${name} a fait mieux que toi`, body: `Pokémon du jour en ${row.tries} essais contre ${row.target}. Revanche demain ?`, url: "/?defis=1", tag: "pokedle-defi" });
      }
    }
  }

  async function list(accountId) {
    await ready;
    const id = String(accountId);
    await settleDaily(id);
    await db.query(`UPDATE player_challenges SET status = 'expired', resolved_at = now(), seen_from = false
      WHERE status = 'open' AND expires_at <= now() AND (from_id = $1 OR to_id = $1)`, [id]);
    await db.query(`DELETE FROM player_challenges WHERE created_at < now() - make_interval(days => $1)`, [KEEP_DAYS]);
    const rows = (await db.query(`SELECT c.id, c.from_id, c.to_id, c.mode, c.target, c.phrase, c.best, c.status, c.seen_to, c.seen_from,
        c.secret_id, jsonb_array_length(c.guesses) AS tries, c.note,
        to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        to_char(c.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
        uf.username AS from_name, uf.partner_id AS from_partner, ut.username AS to_name, ut.partner_id AS to_partner
      FROM player_challenges c LEFT JOIN users uf ON uf.discord_id = c.from_id LEFT JOIN users ut ON ut.discord_id = c.to_id
      WHERE c.from_id = $1 OR c.to_id = $1 ORDER BY c.created_at DESC LIMIT 60`, [id])).rows;
    const off = (await db.query("SELECT 1 FROM player_challenge_blocks WHERE account_id = $1 AND blocked_id = $2", [id, ALL])).rowCount > 0;
    return {
      ok: true, accepting: !off,
      challenges: rows.map((row) => {
        const incoming = row.to_id === id;
        const mystery = row.mode === MYSTERY;
        const cfg = mystery ? { label: MYSTERY_LABEL, kind: "mystere" } : row.mode === DAILY ? { label: DAILY_LABEL, kind: DAILY }
          : CHALLENGE_MODES[row.mode] || { label: row.mode, kind: "record" };
        // The hidden Pokémon is named to the one who chose it, and to the other once the challenge is over.
        const named = mystery && row.secret_id && (!incoming || row.status !== "open");
        return {
          id: Number(row.id), incoming, mode: row.mode, label: cfg.label, kind: cfg.kind,
          ...(mystery ? { tries: Number(row.tries) || 0 } : {}), ...(named ? { secretId: Number(row.secret_id) } : {}),
          target: Number(row.target), best: row.best == null ? null : Number(row.best), ...(cfg.max ? { max: cfg.max } : {}),
          phrase: PHRASES[Number(row.phrase)] || PHRASES[0], ...(row.note ? { note: row.note } : {}), status: row.status,
          seen: incoming ? Boolean(row.seen_to) : Boolean(row.seen_from),
          createdAt: row.created_at, expiresAt: row.expires_at,
          other: {
            pid: playerPid(incoming ? row.from_id : row.to_id),
            username: (incoming ? row.from_name : row.to_name) || "Un dresseur",
            partnerId: Number(incoming ? row.from_partner : row.to_partner) || null,
          },
        };
      }),
    };
  }

  // « Trouve ce Pokémon » : what a player may see of the game (the tries and the clues the server
  // computed; the answer once it is over, or always for the one who chose it).
  function gameView(row, me) {
    const secret = byId.get(Number(row.secret_id));
    const guesses = (Array.isArray(row.guesses) ? row.guesses : []).map(Number);
    const expired = row.status === "open" && new Date(row.expires_at) <= new Date();
    const status = expired ? "expired" : row.status;
    const direction = (a, b) => (a === b ? "" : a < b ? "↑" : "↓");
    const showAnswer = status !== "open" || String(row.from_id) === String(me);
    return {
      ok: true, id: Number(row.id), status, finished: status !== "open", attempts: guesses.length, max: Number(row.target),
      rows: guesses.map((gid) => {
        const p = byId.get(gid);
        return p && secret ? { pokemonId: p.id, cmp: compare(p, secret), generationDirection: direction(p.gen, secret.gen), heightDirection: direction(p.height, secret.height), weightDirection: direction(p.weight, secret.weight) } : null;
      }).filter(Boolean),
      ...(showAnswer && secret ? { answerId: secret.id } : {}),
    };
  }

  async function game(accountId, challengeId) {
    await ready;
    const me = String(accountId);
    const row = (await db.query(`SELECT c.*, uf.username AS from_name, ut.username AS to_name FROM player_challenges c
      LEFT JOIN users uf ON uf.discord_id = c.from_id LEFT JOIN users ut ON ut.discord_id = c.to_id
      WHERE c.id = $1 AND c.mode = $2 AND (c.from_id = $3 OR c.to_id = $3)`, [Number(challengeId), MYSTERY, me])).rows[0];
    if (!row || !compare) return { ok: false, error: "unknown" };
    const incoming = row.to_id === me;
    return { ...gameView(row, me), incoming, other: { pid: playerPid(incoming ? row.from_id : row.to_id), username: (incoming ? row.from_name : row.to_name) || "Un dresseur" } };
  }

  async function guess(accountId, { id, pokemonId } = {}) {
    await ready;
    const me = String(accountId);
    const pick = byId.get(Number(pokemonId));
    if (!pick || !compare) return { ok: false, error: "invalid_guess" };
    const client = await db.connect();
    let row, finished = false;
    try {
      await client.query("BEGIN");
      row = (await client.query("SELECT * FROM player_challenges WHERE id = $1 AND to_id = $2 AND mode = $3 FOR UPDATE", [Number(id), me, MYSTERY])).rows[0];
      if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "unknown" }; }
      const guesses = (Array.isArray(row.guesses) ? row.guesses : []).map(Number);
      if (row.status !== "open" || new Date(row.expires_at) <= new Date()) { await client.query("ROLLBACK"); return gameView(row, me); }
      if (guesses.includes(pick.id)) { await client.query("ROLLBACK"); return { ...gameView(row, me), duplicate: true }; }
      guesses.push(pick.id);
      const status = pick.id === Number(row.secret_id) ? "won" : guesses.length >= Number(row.target) ? "lost" : "open";
      finished = status !== "open";
      row = (await client.query(`UPDATE player_challenges SET guesses = $2::jsonb, status = $3,
          best = CASE WHEN $3 = 'won' THEN $4 ELSE best END,
          resolved_at = CASE WHEN $3 <> 'open' THEN now() ELSE resolved_at END,
          seen_from = CASE WHEN $3 <> 'open' THEN false ELSE seen_from END
        WHERE id = $1 RETURNING *`, [row.id, JSON.stringify(guesses), status, guesses.length])).rows[0];
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
    if (finished) {
      const name = await nameOf(me), secret = byId.get(Number(row.secret_id));
      const secretName = secret ? secret.name : "Pokémon";
      tell(row.from_id, row.status === "won"
        ? { title: `🏆 ${name} a trouvé ton Pokémon mystère`, body: `${secretName} en ${row.best} essais sur ${row.target}. Revanche ?`, url: "/?defis=1", tag: "pokedle-defi" }
        : { title: `💪 ${name} n'a pas trouvé ton ${secretName}`, body: `${row.target} essais, sans le trouver. Bien joué !`, url: "/?defis=1", tag: "pokedle-defi" });
    }
    return { ...gameView(row, me), fresh: finished };
  }

  async function seen(accountId, ids) {
    await ready;
    const list = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 60);
    if (!list.length) return { ok: true };
    await db.query("UPDATE player_challenges SET seen_to = true WHERE to_id = $1 AND id = ANY($2)", [String(accountId), list]);
    await db.query("UPDATE player_challenges SET seen_from = true WHERE from_id = $1 AND id = ANY($2)", [String(accountId), list]);
    return { ok: true };
  }

  async function decline(accountId, challengeId) {
    await ready;
    const r = await db.query(`UPDATE player_challenges SET status = 'declined', resolved_at = now(), seen_from = false
      WHERE id = $2 AND to_id = $1 AND status = 'open'`, [String(accountId), Number(challengeId)]);
    return { ok: r.rowCount > 0 };
  }

  // « Ne plus recevoir ses défis » : named by one of their challenges, never by their account id.
  async function block(accountId, challengeId) {
    await ready;
    const id = String(accountId);
    const from = (await db.query("SELECT from_id FROM player_challenges WHERE id = $2 AND to_id = $1", [id, Number(challengeId)])).rows[0]?.from_id;
    if (!from) return { ok: false };
    await db.query("INSERT INTO player_challenge_blocks(account_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, from]);
    await db.query(`UPDATE player_challenges SET status = 'declined', resolved_at = now(), seen_from = false
      WHERE to_id = $1 AND from_id = $2 AND status = 'open'`, [id, from]);
    return { ok: true };
  }

  // Challenges on or off; turning them back on also forgets the players stopped one by one.
  async function setAccepting(accountId, on) {
    await ready;
    const id = String(accountId);
    if (on) await db.query("DELETE FROM player_challenge_blocks WHERE account_id = $1", [id]);
    else await db.query("INSERT INTO player_challenge_blocks(account_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, ALL]);
    return { ok: true, accepting: Boolean(on) };
  }

  return { options, create, afterResult, list, game, guess, seen, decline, block, setAccepting };
}

// The same notification the 🔔 reminders use, for the players who turned it on.
function pushSender({ db, webpush, configured, log = console }) {
  return async (to, payload) => {
    if (!webpush || !await configured) return 0;
    const rows = (await db.query("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = $1", [String(to)])).rows;
    let sent = 0;
    for (const row of rows) {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 86400, urgency: "normal", topic: "pokedle-defi" });
        sent += 1;
      } catch (error) {
        if (error && (error.statusCode === 404 || error.statusCode === 410)) await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
        else log.warn("[defis] push failed:", String((error && (error.statusCode || error.message)) || error).slice(0, 120));
      }
    }
    return sent;
  };
}

function createRateLimit(limit = 30, windowMs = 3600000) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > limit;
  };
}

function mountChallengeRoutes(app, { express, challenges, getUser, log = console, limited = createRateLimit(), limitedGuesses = createRateLimit(200) }) {
  const json = express.json({ limit: "2kb" });
  const signedIn = (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = challenges ? getUser(req) : null;
    if (!user || !user.id) { res.status(401).json({ ok: false, error: "login" }); return null; }
    return user;
  };
  const sameOrigin = (req, res) => {
    const origin = req.get("origin");
    let host = "";
    try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
    if (!origin || host !== req.get("host")) { res.status(403).json({ ok: false, error: "origin_denied" }); return false; }
    return true;
  };
  const run = (name, work, limit = limited) => async (req, res) => {
    const user = signedIn(req, res);
    if (!user) return;
    if (req.method === "POST") {
      if (!sameOrigin(req, res)) return;
      if (limit(String(user.id))) { res.set("Retry-After", "3600"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    }
    try { res.json(await work(user, req.body || {}, req)); }
    catch (error) { log.error("[defis] " + name + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  };
  app.get("/api/challenges", run("list", (user) => challenges.list(user.id)));
  app.get("/api/challenges/options", run("options", (user) => challenges.options(user.id)));
  app.post("/api/challenges", json, run("create", (user, body) => challenges.create(user.id, body)));
  app.get("/api/challenges/game", run("game", (user, _body, req) => challenges.game(user.id, req.query.id)));
  app.post("/api/challenges/guess", json, run("guess", (user, body) => challenges.guess(user.id, body), limitedGuesses));
  app.post("/api/challenges/seen", json, run("seen", (user, body) => challenges.seen(user.id, body.ids)));
  app.post("/api/challenges/decline", json, run("decline", (user, body) => challenges.decline(user.id, body.id)));
  app.post("/api/challenges/block", json, run("block", (user, body) => challenges.block(user.id, body.id)));
  app.post("/api/challenges/settings", json, run("settings", (user, body) => challenges.setAccepting(user.id, body.accepting !== false)));
}

module.exports = { CHALLENGE_MODES, PHRASES, MYSTERY, MYSTERY_ATTEMPTS, PER_DAY, PER_DAY_FRIENDS, DAY_CHOICES, NOTE_MAX, DAILY, DAYS, KEEP_DAYS, ensureTables, createPlayerChallenges, pushSender, mountChallengeRoutes };
