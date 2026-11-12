'use strict';
// Server-observed arcade rounds. This prevents invented
// results, not automated play or looking up public Pokémon facts.
const crypto = require('node:crypto');
const advanced = require('./quiz-higher-lower');
const guessGames = require('./verified-guess');
const MODES = Object.freeze(['weight', 'shiny', ...advanced.MODES, ...guessGames.MODES]);
const TTL = 24 * 60 * 60 * 1000;
const fail = (code, status = 409) => Object.assign(new Error(code), {code, status});
async function initVerifiedArcadeDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS arcade_runs (
    identity TEXT NOT NULL, mode TEXT NOT NULL, account_id TEXT,
    state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(identity,mode))`);
}
function createVerifiedArcade({pokemon, secret, clock = () => new Date(), randomInt = crypto.randomInt, describe = guessGames.createFlavorLoader(fetch, randomInt)}) {
  const catalog = pokemon || JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
  const games = advanced.createQuizHigherLower(catalog,randomInt,clock);
  const isAdvanced = s => advanced.MODES.includes(s.mode);
  // Pokémon pixelisé et Zoom progressif : le mystère reste sur le serveur (lib/verified-guess.js).
  const guessing = guessGames.createGuessGames(catalog, randomInt);
  const isGuess = s => guessGames.MODES.includes(s.mode);
  // ECO-06: a timed run that never received an accepted answer is not a
  // completed play eligible for Balls or coins. No new saved state needed:
  // round > 0 proves that a prior answer was followed by next().
  function verifiedTimedEarning(s) {
    if (s.mode === 'higher-lower-rush' && !(s.round > 0 || ['higher','lower'].includes(s.answer?.choice))) return {};
    return {earned:games.result(s)};
  }
  const base = catalog.filter(p => !p.isAltForm && Number(p.id) <= 1025);
  const byId = new Map(base.map(p => [Number(p.id), p]));
  const shinyPool = require('../shiny-pool.json').ids.filter(id => byId.has(id));
  const key = crypto.createHash('sha256').update(String(secret || 'test-only')).digest();
  function imageToken(who, question, expires) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    // Encode the answer as 0/1: true/false would leak it through ciphertext length.
    // A guessing-game picture pads its id (forms go up to 5 digits) for the same reason.
    const body = question.guess ? {owner:who.key, id:String(question.id).padStart(6,'0'), shiny:0, k:question.cry ? 'c' : question.quiz ? 'q' : 'g', expires}
      : {owner:who.key, id:question.id, shiny:Number(question.shiny), expires};
    const data = Buffer.concat([cipher.update(JSON.stringify(body)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
  }
  function imageSpec(token, who) {
    try {
      if (typeof token !== 'string' || token.length > 700) return null;
      const b = Buffer.from(token, 'base64url'), decipher = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0,12));
      decipher.setAuthTag(b.subarray(12,28));
      const spec = JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]));
      // Quiz v2 : l'artwork officiel des Pokémon d'une question (silhouette comprise), sous une adresse opaque.
      if (spec.k === 'q') {
        const id = Number(spec.id);
        return spec.owner === who.key && spec.expires > +clock() && byId.has(id) ? {id, shiny:false} : null;
      }
      if (spec.k === 'g' || spec.k === 'c') {
        const id = Number(spec.id), src = guessing.spriteOf(id);
        if (spec.owner !== who.key || spec.expires <= +clock() || !guessing.has(id)) return null;
        return spec.k === 'c' ? {id, cry:guessing.cryOf(id)} : src ? {id, shiny:false, src} : null;
      }
      return spec.owner === who.key && spec.expires > +clock() && shinyPool.includes(spec.id) && [0,1].includes(spec.shiny) ? {...spec,shiny:spec.shiny === 1} : null;
    } catch (_) { return null; }
  }
  function question(s, who) {
    if (s.mode === 'weight') {
      const pool = base.filter(p => s.gens.includes(Number(p.generation)) && Number.isFinite(Number(p.weight)));
      if (pool.length < 2) throw fail('invalid_generations',400);
      const left = pool[randomInt(pool.length)], others = pool.filter(p => p.id !== left.id);
      const right = others[randomInt(others.length)];
      s.question = {left:Number(left.id), right:Number(right.id), correctId:Number(left.weight) >= Number(right.weight) ? Number(left.id) : Number(right.id)};
    } else {
      const fresh = shinyPool.filter(id => !s.recent.includes(id)), pool = fresh.length ? fresh : shinyPool;
      if (!pool.length) throw fail('unavailable',503);
      s.question = {id:pool[randomInt(pool.length)], shiny:randomInt(2) === 0};
      s.recent = [s.question.id, ...s.recent].slice(0,40);
      s.question.image = '/api/arcade/art/' + imageToken(who, s.question, s.startedAt + TTL);
    }
  }
  // 💡 La silhouette du coup de pouce (illimité, Stat Mystère) n'est envoyée qu'une fois méritée, sous une adresse opaque.
  function guessView(s) {
    const v = guessing.view(s);
    if (v.help && v.help.silhouette && s.helpImage) v.helpImage = s.helpImage;
    return v;
  }
  function view(s) {
    if (isGuess(s)) return {mode:s.mode,sessionId:s.id,round:s.round,phase:s.phase,
      ...(s.image ? {image:s.image} : {}),...(s.cry ? {cry:s.cry} : {}),...(s.clue ? {clue:s.clue} : {}),...guessView(s)};
    if (isAdvanced(s)) return {mode:s.mode,sessionId:s.id,round:s.round,phase:s.phase,score:s.score,answer:s.answer,...games.view(s)};
    const q = s.question;
    return {mode:s.mode, sessionId:s.id, round:s.round, phase:s.phase, score:s.score, lives:s.lives,
      question:s.mode === 'weight' ? {left:q.left,right:q.right} : {id:q.id,image:q.image},
      ...(s.phase !== 'playing' ? {answer:s.answer,reveal:s.mode === 'weight' ? {correctId:q.correctId} : {shiny:q.shiny}} : {})};
  }
  async function read(c, who, mode) {
    if (!MODES.includes(mode)) throw fail('unknown_mode',400);
    return (await c.query('SELECT state FROM arcade_runs WHERE identity=$1 AND mode=$2 FOR UPDATE', [who.key,mode])).rows[0]?.state;
  }
  async function save(c, who, s) {
    await c.query(`INSERT INTO arcade_runs(identity,mode,account_id,state) VALUES($1,$2,$3,$4::jsonb)
      ON CONFLICT(identity,mode) DO UPDATE SET state=EXCLUDED.state,account_id=EXCLUDED.account_id,updated_at=NOW()`,
      [who.key,s.mode,who.accountId || null,JSON.stringify(s)]);
  }
  async function start(c, who, body) {
    if (typeof body.startId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.startId)) throw fail('invalid_action',400);
    const gens = body.gens === undefined ? [1,2,3,4,5,6,7,8,9] : body.gens;
    if (!Array.isArray(gens) || !gens.length || gens.length > 9 || gens.some(g => !Number.isInteger(g) || g < 1 || g > 9)) throw fail('invalid_generations',400);
    if (body.restart !== undefined && typeof body.restart !== 'boolean') throw fail('invalid_action',400);
    const old = await read(c, who, body.mode);
    if (old && !body.restart && old.startedAt + TTL > +clock() && games.expire(old)) {
      await save(c,who,old); return {arcade:view(old),...verifiedTimedEarning(old)};
    }
    const sameGens = (body.mode !== 'weight' && !guessGames.MODES.includes(body.mode)) || JSON.stringify([...new Set(gens)].sort()) === JSON.stringify([...(old?.gens || [])].sort());
    if (old && old.startedAt + TTL > +clock() && (old.startId === body.startId || (!body.restart && sameGens && old.phase !== 'over'))) return {arcade:view(old)};
    const s = {id:crypto.randomUUID(), startId:body.startId, mode:body.mode, gens:[...new Set(gens)], round:0,
      phase:'playing', score:body.mode === 'weight' && old?.phase === 'over' && !body.restart ? old.score : 0,
      lives:3, recent:[], startedAt:+clock(), answer:null};
    if (isAdvanced(s)) {
      games.init(s);
      if (s.mode === 'quiz') for (const q of s.questions) if (Array.isArray(q.artIds))
        q.art = q.artIds.map(id => '/api/arcade/art/' + imageToken(who, {id, guess:true, quiz:true}, s.startedAt + TTL));
    }
    else if (isGuess(s)) {
      s.recent = Array.isArray(old?.recent) ? old.recent : [];
      guessing.init(s);
      // Ce que le joueur reçoit pour deviner : une image ou un cri sous une adresse opaque, ou le texte du Pokédex.
      if (s.mode === 'cry') s.cry = '/api/arcade/cry/' + imageToken(who, {id:s.secretId, guess:true, cry:true}, s.startedAt + TTL);
      else if (s.mode === 'description') s.clue = await describe(guessing.get(s.secretId), guessing.speciesOf(s.secretId));
      else if (s.mode === 'pixel' || s.mode === 'silhouette') s.image = '/api/arcade/art/' + imageToken(who, {id:s.secretId, guess:true}, s.startedAt + TTL);
      else if (guessGames.HELP[s.mode]) s.helpImage = '/api/arcade/art/' + imageToken(who, {id:s.secretId, guess:true}, s.startedAt + TTL);
    } else question(s, who);
    await save(c,who,s); return {arcade:view(s)};
  }
  async function current(c,who,body) {
    const s = await read(c,who,body.mode);
    if (!s || s.id !== body.sessionId) throw fail('session_changed');
    if (s.startedAt + TTL <= +clock()) throw fail('session_expired');
    if (!Number.isInteger(body.round) || body.round < 0) throw fail('invalid_round',400);
    return s;
  }
  async function answer(c,who,body) {
    const s = await current(c,who,body);
    if (games.expire(s)) { await save(c,who,s); return {arcade:view(s),...verifiedTimedEarning(s)}; }
    if (s.round !== body.round) throw fail('round_changed');
    if (isGuess(s)) {
      // Un essai rejoué (réseau) ou un nom déjà proposé ne compte pas deux fois.
      if (s.phase === 'over' || !guessing.answer(s, body.choice)) return {arcade:view(s), replayed:true};
      await save(c,who,s);
      return {arcade:view(s), ...(s.phase === 'over' ? {earned:guessing.result(s)} : {})};
    }
    if (s.phase === 'over' && s.mode === 'higher-lower-rush') return {arcade:view(s),replayed:true};
    if (s.phase !== 'playing') {
      if (s.answer.choice !== body.choice) throw fail('answer_conflict');
      return {arcade:view(s), replayed:true};
    }
    if (isAdvanced(s)) {
      games.answer(s,body.choice); await save(c,who,s);
      return {arcade:view(s),...(s.phase === 'over' ? {earned:games.result(s)} : {})};
    }
    if (s.mode === 'weight' ? ![s.question.left,s.question.right].includes(body.choice) : !['shiny','normal'].includes(body.choice)) throw fail('invalid_choice',400);
    const correct = s.mode === 'weight' ? body.choice === s.question.correctId : (body.choice === 'shiny') === s.question.shiny;
    s.answer = {choice:body.choice, correct};
    if (s.mode === 'weight') { s.score = correct ? s.score + 1 : 0; s.phase = 'over'; }
    else { if (correct) s.score++; else s.lives--; s.phase = s.lives ? 'reveal' : 'over'; }
    await save(c,who,s);
    return {arcade:view(s), ...(s.phase === 'over' ? {earned:{mode:s.mode,score:s.score,result:(s.mode === 'weight' ? correct : s.score >= 10) ? 'win' : 'loss'}} : {})};
  }
  async function next(c,who,body) {
    const s = await current(c,who,body);
    if (games.expire(s)) { await save(c,who,s); return {arcade:view(s),...verifiedTimedEarning(s)}; }
    if (isAdvanced(s) && s.phase === 'over') return {arcade:view(s),replayed:true};
    if (s.mode !== 'shiny' && !isAdvanced(s)) throw fail('invalid_mode',400);
    if (s.round === body.round + 1 && s.phase === 'playing') return {arcade:view(s),replayed:true};
    if (s.round !== body.round || s.phase !== 'reveal') throw fail('round_changed');
    if (isAdvanced(s)) games.next(s);
    else { s.round++; s.answer = null; s.phase = 'playing'; question(s,who); }
    await save(c,who,s); return {arcade:view(s)};
  }
  async function finish(c,who,body) {
    const s = await current(c,who,body);
    if (s.mode !== 'higher-lower-rush') throw fail('invalid_mode',400);
    if (s.phase === 'over') return {arcade:view(s),replayed:true};
    if (!games.expire(s)) throw fail('round_wait');
    await save(c,who,s); return {arcade:view(s),...verifiedTimedEarning(s)};
  }
  async function abandon(c,who,body) {
    const s = await current(c,who,body);
    if (!isGuess(s)) throw fail('invalid_mode',400);
    if (s.phase === 'over') return {arcade:view(s),replayed:true};
    // An unopened round costs no entry fee and cannot earn a Ball or coins.
    // Once the server has recorded at least one valid guess, a real loss still
    // qualifies for the usual first-play reward.
    const attempted = Array.isArray(s.guesses) && s.guesses.length > 0;
    guessing.abandon(s); await save(c,who,s);
    return {arcade:view(s),...(attempted ? {earned:guessing.result(s)} : {})};
  }
  return {start,answer,next,finish,abandon,imageSpec};
}

// Fixed origin, opaque encrypted URL, no upstream URL/ETag exposed. Pictures themselves
// remain public knowledge; this does not claim to stop image recognition bots.
function createArcadeArtworkLoader(fetcher = fetch) {
  const cache = new Map();
  // A guessing-game sprite (spec.src) must be a PokeAPI sprite; GitHub serves the same file if the CDN fails.
  const SPRITE = /^https:\/\/cdn\.jsdelivr\.net\/gh\/PokeAPI\/sprites@master\/(sprites\/pokemon\/[a-z0-9\-\/]+\.png)$/;
  async function fetchPng(url) {
    const response = await fetcher(url, {signal:AbortSignal.timeout(8000),redirect:'error'});
    if (!response.ok || Number(response.headers.get('content-length')) > 2000000) throw fail('image_unavailable',503);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 2000000 || data.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw fail('image_unavailable',503);
    return data;
  }
  return async function load(spec) {
    const key = spec.src || spec.id + ':' + spec.shiny;
    if (cache.has(key)) return cache.get(key);
    const promise = (async () => {
      // The same official artwork is available from GitHub if jsDelivr returns
      // an error or a non-PNG response. Both origins are fixed and trusted.
      let path;
      if (spec.src) {
        const m = SPRITE.exec(spec.src);
        if (!m) throw fail('image_unavailable',503);
        path = m[1];
      } else {
        if (!Number.isSafeInteger(Number(spec.id)) || Number(spec.id) < 1) throw fail('image_unavailable',503);
        path = 'sprites/pokemon/other/official-artwork/' + (spec.shiny ? 'shiny/' : '') + Number(spec.id) + '.png';
      }
      try { return await fetchPng('https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/' + path); }
      catch (_) { return await fetchPng('https://raw.githubusercontent.com/PokeAPI/sprites/master/' + path); }
    })();
    cache.set(key,promise);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    try { return await promise; } catch(e) { cache.delete(key); throw e; }
  };
}
// The Cri game's sound: PokeAPI's cry (CDN, GitHub if it fails), checked to be an Ogg file.
function createArcadeCryLoader(fetcher = fetch) {
  const cache = new Map();
  return async function load(spec) {
    const id = Number(spec.cry);
    if (!Number.isInteger(id) || id <= 0) throw fail('cry_unavailable',503);
    if (cache.has(id)) return cache.get(id);
    const promise = (async () => {
      let data = null;
      for (const url of ['https://cdn.jsdelivr.net/gh/PokeAPI/cries@main/cries/pokemon/latest/' + id + '.ogg', 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/' + id + '.ogg']) {
        try {
          const response = await fetcher(url, {signal:AbortSignal.timeout(8000),redirect:'error'});
          if (!response.ok || Number(response.headers.get('content-length')) > 1000000) continue;
          const body = Buffer.from(await response.arrayBuffer());
          if (body.length <= 1000000 && body.subarray(0,4).toString('latin1') === 'OggS') { data = body; break; }
        } catch (_) { /* next source */ }
      }
      if (!data) throw fail('cry_unavailable',503);
      return data;
    })();
    cache.set(id,promise);
    if (cache.size > 128) cache.delete(cache.keys().next().value);
    try { return await promise; } catch(e) { cache.delete(id); throw e; }
  };
}
module.exports = {MODES,TTL,initVerifiedArcadeDb,createVerifiedArcade,createArcadeArtworkLoader,createArcadeCryLoader};
