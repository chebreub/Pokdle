"use strict";
// Read-only aggregate accounting of the existing Pokédollars/Balls/encounter tables.
// Never return account_id, identity, action_id, encounter id or raw ledger entries.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function checkPeriod(startDay, endDay) {
  if (![startDay, endDay].every(d => typeof d === "string" && ISO_DAY.test(d) &&
    !Number.isNaN(Date.parse(d + "T12:00:00Z")) &&
    new Date(Date.parse(d + "T12:00:00Z")).toISOString().slice(0, 10) === d)) throw new Error("invalid_economy_period");
  const span = (Date.parse(endDay + "T12:00:00Z") - Date.parse(startDay + "T12:00:00Z")) / 86400000;
  if (!Number.isInteger(span) || span < 0 || span > 89) throw new Error("invalid_economy_period");
}
const number = value => Number(value || 0);

const COINS_QUERY = `
SELECT CASE
  WHEN source IN ('day:daily','day:wordle','day:dossier','day:challenge') THEN 'daily'
  WHEN source = 'day:party' THEN 'party'
  WHEN source LIKE 'play:%' THEN 'arcade'
  WHEN source LIKE 'release:%' THEN 'release'
  WHEN source LIKE 'shop:recharge:%' THEN 'recharge'
  WHEN source LIKE 'shop:poke:%' THEN 'buy_poke'
  WHEN source LIKE 'shop:great:%' THEN 'buy_great'
  WHEN source LIKE 'shop:ultra:%' THEN 'buy_ultra'
  ELSE 'other'
END AS category,
COALESCE(SUM(amount) FILTER (WHERE amount > 0),0)::bigint AS gained,
COALESCE(-SUM(amount) FILTER (WHERE amount < 0),0)::bigint AS spent,
COUNT(*)::int AS operations
FROM coin_ledger
WHERE day BETWEEN $1::date AND $2::date
GROUP BY 1
ORDER BY 1`;

const BALLS_QUERY = `
SELECT CASE
  WHEN source LIKE 'mode:%' THEN 'arcade'
  WHEN source IN ('daily','wordle','dossier','challenge','journey') THEN 'daily'
  WHEN source = 'party' THEN 'party'
  WHEN source = 'gift' THEN 'gift'
  WHEN source = 'streak' THEN 'streak'
  WHEN source LIKE 'welcome:%' THEN 'welcome'
  WHEN source LIKE 'exp:%' THEN 'expedition'
  WHEN source LIKE 'shop:%' THEN 'shop'
  ELSE 'other'
END AS category, ball, COUNT(*)::int AS awarded
FROM ball_gains
WHERE day BETWEEN $1::date AND $2::date
GROUP BY 1,2 ORDER BY 1,2`;

// kind='trade' is an incoming exchanged Pokémon, not a Ball throw/capture.
// kind='test_reset' is an admin-only reclassification, not an active encounter.
// Keeping traded/released originals as caught avoids erasing successful throws.
const WILD_QUERY = `
SELECT kind, status, shiny, ball,
COUNT(*)::int AS encounters,
COUNT(*) FILTER (WHERE throws > 0)::int AS attempted,
COALESCE(SUM(used_poke),0)::bigint AS poke,
COALESCE(SUM(used_great),0)::bigint AS great,
COALESCE(SUM(used_ultra),0)::bigint AS ultra
FROM wild_encounters
WHERE day BETWEEN $1::date AND $2::date AND kind IN ('wild','legend','prestige')
GROUP BY kind,status,shiny,ball
ORDER BY kind,status,shiny,ball`;

// Cohorts introduced by ECO-05, no retroactive reconstruction of ball/order data.
const CAPTURE_QUERY = `
SELECT dimension,segment,SUM(throws)::bigint AS throws,SUM(catches)::bigint AS catches
FROM capture_stats_daily
WHERE day BETWEEN $1::date AND $2::date
GROUP BY dimension,segment ORDER BY dimension,segment`;

const ACTORS_QUERY = `
SELECT COUNT(DISTINCT identity)::int AS actors
FROM wild_encounters
WHERE day BETWEEN $1::date AND $2::date AND kind IN ('wild','legend','prestige')`;

function summarizeCaptureRows(rows = []) {
  const capture = {prospectiveOnly:true, available:false, throws:0,catches:0,
    rules:[],balls:[],throwOrder:[],kinds:[],classes:[],species:[],speciesSuppressed:0};
  const groups = {rules:"rules",ball:"balls",throw_order:"throwOrder",
    encounter_kind:"kinds",capture_class:"classes"};
  const allowed = {
    rules:new Set(["shiny-1-150","shiny-1-500"]),
    ball:new Set(["poke","great","ultra"]),
    throw_order:new Set(["1","2","3"]),
    encounter_kind:new Set(["wild","legend","prestige"]),
    capture_class:new Set(["rare","moderate","common","unknown"])
  };
  for (const row of rows) {
    const dim = String(row.dimension), segment = String(row.segment);
    const n = number(row.throws), wins = number(row.catches);
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(wins) ||
        n < 0 || wins < 0 || wins > n) continue;
    if (dim === "pokemon") {
      const pokemonId = Number(segment);
      if (!Number.isInteger(pokemonId) || pokemonId < 1 || pokemonId > 1025) continue;
      if (n < 10) { capture.speciesSuppressed++; continue; }
      capture.species.push({pokemonId,throws:n,catches:wins});
    } else if (allowed[dim]?.has(segment)) {
      capture[groups[dim]].push({segment,throws:n,catches:wins});
      if (dim === "rules") { capture.throws += n; capture.catches += wins; }
    }
  }
  capture.species.sort((a,b)=>b.throws-a.throws || a.pokemonId-b.pokemonId);
  capture.species = capture.species.slice(0,20);
  capture.available = capture.throws > 0;
  return capture;
}

function summarizeEconomy({startDay,endDay,coinRows,ballRows,wildRows,actors=0,captureRows=[]}) {
  const coins = {gained:0,spent:0,net:0,sources:[]};
  for (const r of coinRows) {
    const row = {category:r.category,gained:number(r.gained),spent:number(r.spent),operations:number(r.operations)};
    coins.sources.push(row); coins.gained += row.gained; coins.spent += row.spent;
  }
  coins.net = coins.gained - coins.spent;
  const balls = {awarded:0,byType:{poke:0,great:0,ultra:0},sources:[]};
  for (const r of ballRows) {
    const row = {category:r.category,ball:r.ball,awarded:number(r.awarded)};
    balls.sources.push(row); balls.awarded += row.awarded;
    if (Object.hasOwn(balls.byType,row.ball)) balls.byType[row.ball] += row.awarded;
  }
  const wild = {encounters:0,ordinary:0,special:0,attempted:0,caught:0,fled:0,skipped:0,open:0,shinySeen:0,
    shinyCaught:0,actors:number(actors),throws:0,used:{poke:0,great:0,ultra:0},
    capturedWith:{poke:0,great:0,ultra:0},successPerThrow:null};
  const wins = new Set(["caught","released","traded"]);
  for (const row of wildRows) {
    const n = number(row.encounters),success = wins.has(row.status);
    wild.encounters += n;
    if (row.kind === "wild") wild.ordinary += n;
    else wild.special += n;
    wild.attempted += number(row.attempted);
    if (success) {
      wild.caught += n;
      if (Object.hasOwn(wild.capturedWith,row.ball)) wild.capturedWith[row.ball] += n;
    } else if (row.status === "fled") wild.fled += n;
    else if (row.status === "skipped") wild.skipped += n;
    else if (row.status === "open") wild.open += n;
    if (row.shiny === true) {
      wild.shinySeen += n;
      if (success) wild.shinyCaught += n;
    }
    for (const ball of ["poke","great","ultra"]) wild.used[ball] += number(row[ball]);
  }
  wild.throws = Object.values(wild.used).reduce((a,b)=>a+b,0);
  if (wild.throws > 0 && wild.caught <= wild.throws) {
    wild.successPerThrow = Math.round(wild.caught * 1000 / wild.throws) / 10;
  }
  return {startDay,endDay,coins,balls,wild,capture: summarizeCaptureRows(captureRows)};
}

async function readEconomyStats(db, startDay, endDay) {
  checkPeriod(startDay,endDay);
  const params = [startDay,endDay];
  const [coins,balls,wild,actors,capture] = await Promise.all([
    db.query(COINS_QUERY,params),
    db.query(BALLS_QUERY,params),
    db.query(WILD_QUERY,params),
    db.query(ACTORS_QUERY,params),
    db.query(CAPTURE_QUERY,params)
  ]);
  return summarizeEconomy({
    startDay,endDay,coinRows:coins.rows,ballRows:balls.rows,wildRows:wild.rows,
    actors:actors.rows[0]?.actors ?? 0, captureRows:capture.rows
  });
}

module.exports = {readEconomyStats,summarizeEconomy,summarizeCaptureRows,checkPeriod};
