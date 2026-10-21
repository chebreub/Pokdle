"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HISTORY_TO_LAUNCH, COMPLETION_EVENTS, completionEvent, startDay,
  ensureTable, increment, recent, prune, summarizeModes
} = require("../lib/usage-metrics");

test("whitelist permits only genuine known game outcomes", () => {
  assert.equal(completionEvent("daily", "win"), "complete:daily:win");
  assert.equal(completionEvent("poke-connections", "loss"), "complete:poke-connections:loss");
  assert.equal(completionEvent("higher-lower-rush", "win"), "complete:higher-lower-rush:win");
  for (const [mode, result] of [["unknown", "win"], ["party", "win"], ["daily", "abandon"], ["normal", "evil"]]) {
    assert.equal(completionEvent(mode, result), null);
  }
  assert.ok(COMPLETION_EVENTS.every((event) => /^complete:[a-z-]+:(?:win|loss)$/.test(event)));
  assert.equal(HISTORY_TO_LAUNCH["stat-clash"], "statclash");
});

test("daily aggregates keep starts and outcomes separate, not a fake conversion percentage", () => {
  const summary = summarizeModes([
    {day:"2026-10-22",event:"solo:normal",hits:"3"},
    {day:"2026-10-22",event:"complete:normal:win",hits:"5"},
    {day:"2026-10-22",event:"complete:normal:loss",hits:"2"},
    {day:"2026-10-22",event:"solo:connections",hits:"4"},
    {day:"2026-10-22",event:"complete:poke-connections:win",hits:"1"},
    {day:"2026-10-22",event:"solo:emulator",hits:"9"},
    {day:"2026-10-22",event:"visit",hits:"100"},
    {day:"2026-10-22",event:"complete:unknown:win",hits:"9"},
    {day:"2026-10-22",event:"complete:daily:win",hits:"-1"},
  ], {"solo:normal":"Classique","solo:connections":"Connections"});
  const byMode = Object.fromEntries(summary.map((s) => [s.mode, s]));
  assert.deepEqual({launches:byMode.normal.launches,completions:byMode.normal.completions,wins:byMode.normal.wins,losses:byMode.normal.losses},
    {launches:3,completions:7,wins:5,losses:2});
  assert.equal(byMode.connections.completions,1);
  assert.equal(byMode.connections.label,"Connections");
  assert.equal(byMode.emulator.finishInstrumented,false,"no misleading 0 completions for an uninstrumented mode");
  assert.ok(!byMode.unknown,"unrecognized events never create game metrics");
  assert.ok(!byMode.visit,"visits do not appear as game completions");
});

test("UTC range is a fixed calendar window, no Paris DST off-by-one", () => {
  assert.equal(startDay(14, new Date("2026-10-25T23:15:00Z")), "2026-10-13");
  assert.equal(startDay(90, new Date("2026-10-22T08:00:00Z")), "2026-07-25");
  assert.throws(() => startDay(0), RangeError);
  assert.throws(() => startDay(91), RangeError);
});

test("PostgreSQL counters survive re-reads, update atomically, and expire after 90 days", {
  skip: !process.env.QA_DATABASE_URL, timeout: 30000
}, async () => {
  const {Pool} = require("pg");
  const {randomUUID} = require("node:crypto");
  const schema = "metrics_" + randomUUID().replaceAll("-", "").slice(0, 16);
  const admin = new Pool({connectionString:process.env.QA_DATABASE_URL});
  let db;
  try {
    await admin.query("CREATE SCHEMA " + schema);
    db = new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,max:5});
    await Promise.all([ensureTable(db), ensureTable(db)]);
    await Promise.all(Array.from({length:25},()=>increment(db,"solo:normal","2026-10-22")));
    await increment(db, completionEvent("normal","win"),"2026-10-22");
    await increment(db, completionEvent("normal","loss"),"2026-10-21");
    await increment(db, "solo:cry","2026-07-20");
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM usage_event_daily")).rows[0].n,4);
    await assert.rejects(increment(db,"garbage,event","2026-10-22"),TypeError);
    await assert.rejects(increment(db,"visit","oops"),TypeError);
    let rows=await recent(db,14,new Date("2026-10-22T12:00:00Z"));
    assert.equal(rows.length,3);
    assert.equal(Number(rows.find(r=>r.event==="solo:normal").hits),25);
    await prune(db,new Date("2026-10-22T12:00:00Z"));
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM usage_event_daily")).rows[0].n,3);
    rows=await recent(db,14,new Date("2026-10-22T12:00:00Z"));
    assert.equal(summarizeModes(rows).find(r=>r.mode==="normal").completions,2);
    const cols=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='usage_event_daily'",[schema])).rows.map(r=>r.column_name).sort();
    assert.deepEqual(cols,["day","event","hits"],"No UID, IP, account, answer or device data stored");
  } finally {
    if(db)await db.end();
    await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE");
    await admin.end();
  }
});
