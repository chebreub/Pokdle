"use strict";
const crypto = require("node:crypto");

function parisDay(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function parisMidnight(day) {
  const nominal = Date.parse(day + "T00:00:00Z");
  let instant = nominal;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const displayed = Date.UTC(Number(p.year), Number(p.month)-1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    instant = nominal - (displayed - instant);
  }
  return new Date(instant);
}
function eggWeek(now = new Date()) {
  const day = parisDay(now), date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const start = date.toISOString().slice(0,10);
  date.setUTCDate(date.getUTCDate() + 7);
  return { start, day, resetAt: parisMidnight(date.toISOString().slice(0,10)).toISOString() };
}
const CLUES = [["gen", "Génération"], ["type1", "Premier type"], ["color", "Couleur"], ["habitat", "Habitat"], ["stage", "Stade d’évolution"]];
function eggClues(secret, eliminated) {
  return CLUES.slice(0, Math.min(5, Math.floor(eliminated/100))).map(([key,label]) => ({ key, label, value: secret[key] }));
}
function compatibleWithClues(pokemon, clues) {
  return clues.every(clue => JSON.stringify(pokemon[clue.key]) === JSON.stringify(clue.value));
}
function signedGuest(secret, cookie) {
  const [id, signature] = String(cookie || "").split(".");
  if (!/^[a-f0-9]{32}$/.test(id || "") || !/^[a-f0-9]{64}$/.test(signature || "")) return null;
  const expected = crypto.createHmac("sha256", secret).update("egg-guest:" + id).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}
function issueGuest(secret) {
  const id = crypto.randomBytes(16).toString("hex");
  return { id, cookie: id + "." + crypto.createHmac("sha256", secret).update("egg-guest:" + id).digest("hex") };
}
function eggError(code, status = 409) { return Object.assign(new Error(code), { code, status }); }

async function initEggDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS egg_rounds (
    id BIGSERIAL PRIMARY KEY, week_start DATE NOT NULL UNIQUE,
    secret_id INTEGER NOT NULL, reward_id INTEGER NOT NULL,
    found_by TEXT, found_at TIMESTAMPTZ, winner_name TEXT,
    CHECK ((found_by IS NULL) = (found_at IS NULL))
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS egg_guesses (
    id BIGSERIAL PRIMARY KEY, round_id BIGINT NOT NULL REFERENCES egg_rounds(id),
    pokemon_id INTEGER NOT NULL, player_id TEXT, anon_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL, day DATE NOT NULL, username TEXT NOT NULL,
    correct BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(round_id, pokemon_id)
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS egg_quota_idx ON egg_guesses(day, player_id, anon_id)");
  await db.query("CREATE INDEX IF NOT EXISTS egg_guest_ip_idx ON egg_guesses(day, ip_hash) WHERE player_id IS NULL");
  await db.query(`CREATE TABLE IF NOT EXISTS egg_rewards (
    round_id BIGINT PRIMARY KEY REFERENCES egg_rounds(id),
    player_id TEXT NOT NULL, pokemon_id INTEGER NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS egg_rewards_owner_idx ON egg_rewards(player_id)");
}

function createEggService({ db, pokemon, randomInt = crypto.randomInt, clock = () => new Date() }) {
  const pool = pokemon.filter(p => !p.isAltForm && Number.isInteger(Number(p.id)) && Number(p.id) > 0 && Number(p.id) <= 1025);
  const byId = new Map(pool.map(p => [Number(p.id), p]));
  const display = id => { const p = byId.get(Number(id)); return p ? { id: Number(p.id), name: p.name } : null; };
  async function transaction(action) {
    const client = await db.connect();
    try { await client.query("BEGIN"); const result = await action(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async function round(client, now, lock = false) {
    if (!pool.length) throw eggError("unavailable", 503);
    const week = eggWeek(now);
    // Secret and public prize are independent draws. The public prize gives no clue.
    await client.query("INSERT INTO egg_rounds(week_start,secret_id,reward_id) VALUES($1,$2,$3) ON CONFLICT(week_start) DO NOTHING", [week.start, pool[randomInt(pool.length)].id, pool[randomInt(pool.length)].id]);
    return (await client.query("SELECT * FROM egg_rounds WHERE week_start=$1" + (lock ? " FOR UPDATE" : ""), [week.start])).rows[0];
  }
  async function quota(client, identity, day) {
    const result = await client.query(`SELECT count(*)::int AS used FROM egg_guesses WHERE day=$1 AND
      ((player_id=$2 AND $2 IS NOT NULL) OR anon_id=$3 OR ($2 IS NULL AND player_id IS NULL AND ip_hash=$4))`, [day, identity.playerId || null, identity.anonId, identity.ipHash]);
    const limit = identity.playerId ? 2 : 1;
    return { limit, used: result.rows[0].used, remaining: Math.max(0, limit-result.rows[0].used) };
  }
  async function grant(client, r, playerId) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["egg-reward:"+playerId]);
    const existing = (await client.query("SELECT pokemon_id FROM egg_rewards WHERE round_id=$1", [r.id])).rows[0];
    if (existing) return display(existing.pokemon_id);
    const owned = new Set((await client.query("SELECT pokemon_id FROM egg_rewards WHERE player_id=$1", [playerId])).rows.map(row => Number(row.pokemon_id)));
    // Also avoid giving an already discovered companion whenever one is available.
    const user = (await client.query("SELECT data FROM users WHERE discord_id=$1", [playerId])).rows[0];
    try { const profile = JSON.parse(user?.data?.profile || "{}"); for (const id of Object.keys(profile.discoveries || {})) owned.add(Number(id)); if (profile.favoritePokemonId) owned.add(Number(profile.favoritePokemonId)); } catch (_error) {}
    const alternatives = pool.filter(p => !owned.has(Number(p.id)));
    const rewardId = !owned.has(Number(r.reward_id)) ? Number(r.reward_id) : alternatives.length ? Number(alternatives[randomInt(alternatives.length)].id) : Number(r.reward_id);
    await client.query("INSERT INTO egg_rewards(round_id,player_id,pokemon_id) VALUES($1,$2,$3)", [r.id, playerId, rewardId]);
    return display(rewardId);
  }
  async function state(identity) {
    // A consistent snapshot prevents a guess appearing before its solved status.
    return transaction(async client => {
      const now = clock();
      const r = await round(client, now, true);
      const guesses = (await client.query("SELECT pokemon_id, username, correct, created_at FROM egg_guesses WHERE round_id=$1 ORDER BY id", [r.id])).rows;
      const eliminated = guesses.filter(g => !g.correct).map(g => Number(g.pokemon_id));
      const clues = eggClues(byId.get(Number(r.secret_id)), eliminated.length);
      const eliminatedSet = new Set(eliminated);
      const compatibleIds = pool.filter(p => compatibleWithClues(p, clues)).map(p => Number(p.id));
      const nextDay = new Date(eggWeek(now).day + "T00:00:00Z"); nextDay.setUTCDate(nextDay.getUTCDate()+1);
      return {
        ok: true, roundId: Number(r.id), weekStart: eggWeek(now).start, resetAt: eggWeek(now).resetAt,
        quotaResetAt: parisMidnight(nextDay.toISOString().slice(0,10)).toISOString(),
        reward: display(r.reward_id), candidateIds: pool.map(p => Number(p.id)), eliminatedIds: eliminated,
        compatibleIds, remaining: compatibleIds.filter(id => !eliminatedSet.has(id)).length, clues,
        nextClueAt: clues.length < 5 ? (clues.length+1)*100 : null,
        quota: await quota(client, identity, eggWeek(now).day), authenticated: Boolean(identity.playerId),
        solved: Boolean(r.found_at), winner: r.found_at ? { name: r.winner_name || "Anonyme", at: r.found_at, me: r.found_by === (identity.playerId ? "user:"+identity.playerId : "guest:"+identity.anonId) } : null,
        canClaim: Boolean(identity.playerId && r.found_by === "guest:"+identity.anonId),
        feed: guesses.slice(-20).reverse().map(g => ({ pokemon: display(g.pokemon_id), name: g.username, correct: g.correct, at: g.created_at }))
      };
    });
  }
  async function guess(identity, roundId, pokemonId) {
    if (!Number.isInteger(pokemonId) || !byId.has(pokemonId)) throw eggError("invalid_pokemon", 400);
    return transaction(async client => {
      const now = clock(), r = await round(client, now, true);
      if (Number(r.id) !== roundId) throw eggError("round_changed");
      if (r.found_at) throw eggError("already_solved");
      if ((await client.query("SELECT 1 FROM egg_guesses WHERE round_id=$1 AND pokemon_id=$2", [r.id,pokemonId])).rowCount) throw eggError("already_guessed");
      const q = await quota(client, identity, eggWeek(now).day);
      if (!q.remaining) throw eggError("quota_reached", 429);
      const correct = Number(r.secret_id) === pokemonId;
      await client.query("INSERT INTO egg_guesses(round_id,pokemon_id,player_id,anon_id,ip_hash,day,username,correct,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [r.id,pokemonId,identity.playerId||null,identity.anonId,identity.ipHash,eggWeek(now).day,identity.playerId ? identity.name : "Anonyme",correct,now]);
      let reward = null;
      if (correct) {
        await client.query("UPDATE egg_rounds SET found_by=$2,found_at=$3,winner_name=$4 WHERE id=$1 AND found_at IS NULL", [r.id, identity.playerId ? "user:"+identity.playerId : "guest:"+identity.anonId, now, identity.playerId ? identity.name : "Anonyme"]);
        if (identity.playerId) reward = await grant(client, r, identity.playerId);
      }
      return { ok: true, correct, reward, claimAfterLogin: correct && !identity.playerId };
    });
  }
  async function claim(identity, roundId) {
    if (!identity.playerId) throw eggError("login_required", 401);
    return transaction(async client => {
      const r = (await client.query("SELECT * FROM egg_rounds WHERE id=$1 FOR UPDATE", [roundId])).rows[0];
      if (!r || !r.found_at || !["guest:"+identity.anonId,"user:"+identity.playerId].includes(r.found_by)) throw eggError("not_winner", 403);
      const reward = await grant(client, r, identity.playerId);
      await client.query("UPDATE egg_rounds SET found_by=$2,winner_name=$3 WHERE id=$1", [r.id, "user:"+identity.playerId, identity.name]);
      return { ok: true, reward };
    });
  }
  async function rewards(identity) {
    if (!identity.playerId) return { ok: true, rewards: [] };
    const result = await db.query("SELECT e.round_id,e.pokemon_id,e.granted_at,r.week_start FROM egg_rewards e JOIN egg_rounds r ON r.id=e.round_id WHERE e.player_id=$1 ORDER BY e.granted_at DESC", [identity.playerId]);
    return { ok: true, rewards: result.rows.map(r => ({ roundId: Number(r.round_id), pokemon: display(r.pokemon_id), at: r.granted_at, weekStart: r.week_start })) };
  }
  return { state, guess, claim, rewards };
}

function mountEggRoutes({ app, express, db, pokemon, secret, getUser, readCookies }) {
  const service = db && secret ? createEggService({ db, pokemon }) : null;
  let ready = service ? initEggDb(db).then(() => true).catch(e => { console.error("[egg] init:", e.message); return false; }) : Promise.resolve(false);
  const rate = new Map();
  function identity(req,res) {
    let anonId = signedGuest(secret, readCookies(req).pokdle_egg);
    if (!anonId) { const guest = issueGuest(secret); anonId = guest.id; res.cookie("pokdle_egg",guest.cookie,{ httpOnly:true,secure:req.secure,sameSite:"lax",path:"/",maxAge:180*86400000 }); }
    const user = getUser(req);
    return { anonId, playerId:user?.id ? String(user.id) : null, name: String(user?.username||"Dresseur").slice(0,80), ipHash:crypto.createHmac("sha256",secret).update("egg-ip:"+String(req.ip)).digest("hex") };
  }
  const handle = action => async (req,res) => {
    res.set("Cache-Control","no-store");
    if (!service || !await ready) return res.status(503).json({ok:false,error:"unavailable"});
    try {
      if (req.method === "POST") {
        if (!req.is("application/json")) throw eggError("json_required",415);
        const origin = req.get("origin");
        if (origin && new URL(origin).host !== req.get("host")) throw eggError("origin_denied",403);
      }
      const who = identity(req,res), now = Date.now(), key = who.ipHash + ":" + req.method;
      if (rate.size > 10000) for (const [k,v] of rate) if (v.until <= now) rate.delete(k);
      const bucket = rate.get(key);
      if (bucket && bucket.until > now) { if (++bucket.count > (req.method === "GET" ? 60 : 12)) throw eggError("rate_limited",429); }
      else { if (rate.size >= 20000) throw eggError("rate_limited",429); rate.set(key,{count:1,until:now+60000}); }
      res.json(await action(who,req));
    } catch (e) { if (!e.status) console.error("[egg] request:",e.message); res.status(e.status||503).json({ok:false,error:e.status?e.code:"unavailable"}); }
  };
  app.get("/api/egg",handle(who => service.state(who)));
  app.get("/api/egg/rewards",handle(who => service.rewards(who)));
  app.post("/api/egg/guess",express.json({limit:"2kb"}),handle((who,req) => service.guess(who,Number(req.body?.roundId),req.body?.pokemonId)));
  app.post("/api/egg/claim",express.json({limit:"2kb"}),handle((who,req) => service.claim(who,Number(req.body?.roundId))));
}
module.exports = { parisDay, parisMidnight, eggWeek, eggClues, compatibleWithClues, signedGuest, issueGuest, initEggDb, createEggService, mountEggRoutes };
