"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {renderStatsDashboard} = require("../lib/admin-stats-dashboard");

const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

function serverClassifier() {
  const a = server.indexOf("function usageSegmentForRequest(req)");
  const b = server.indexOf("function recordUsage(event, uid", a);
  assert.ok(a >= 0 && b > a, "classifier remains isolated from gameplay");
  return vm.runInNewContext(server.slice(a, b) + "\n({usageSegmentForRequest, usageSegmentForSocket})", {
    authReady: () => true,
    getSessionUser: req => req?.testUser || null,
    ADMIN_ACCOUNT_IDS: new Set(["owner-1"])
  });
}

test("DATA-02: admin is checked by signed server session; browser QA is only a declaration", () => {
  const {usageSegmentForRequest: http, usageSegmentForSocket: socket} = serverClassifier();
  assert.equal(http({testUser:{id:"owner-1"},body:{usageTest:false}}), "admin");
  assert.equal(http({testUser:{id:"owner-1"},body:{usageTest:true}}), "admin",
    "client cannot override signed admin classification");
  assert.equal(http({testUser:{id:"player-1"},body:{usageTest:true}}), "test");
  assert.equal(http({testUser:{id:"player-1"},body:{usageTest:false}}), "unmarked");
  assert.equal(http({body:{usageTest:"true"}}), "unmarked",
    "only explicit boolean true opts into test");
  assert.equal(socket({request:{testUser:{id:"owner-1"}},handshake:{auth:{usageTest:true}}}), "admin");
  assert.equal(socket({request:{},handshake:{auth:{usageTest:true}}}), "test");
  assert.equal(socket({request:{},handshake:{auth:{}}}), "unmarked");
  assert.match(server, /usageMetrics\.incrementSegmented\(pgPool, event, segment, key\)/);
  assert.match(server, /usageMetrics\.recentSegments\(pgPool, days, end\)/);
  assert.match(server, /usageSegmentForSocket\(socket\)/);
  assert.match(server, /usageSegmentForRequest\(req\)/);
});

test("DATA-02: dashboard preserves raw totals and shows non-retroactive unclassified residual", () => {
  const html = renderStatsDashboard({
    days: 1, endDay: "2026-11-05", livePeriod: true,
    adminKey: "secret", segmentStartedAt:"2026-11-05T13:01:00.000Z",
    metrics:[
      {day:"2026-11-05",event:"visit",hits:"10"},
      {day:"2026-11-05",event:"solo:normal",hits:"5"},
      {day:"2026-11-05",event:"complete:normal:win",hits:"4"}
    ],
    segmentRows:[
      {day:"2026-11-05",event:"visit",segment:"admin",hits:"2"},
      {day:"2026-11-05",event:"visit",segment:"test",hits:"3"},
      {day:"2026-11-05",event:"visit",segment:"unmarked",hits:"1"},
      {day:"2026-11-05",event:"solo:normal",segment:"admin",hits:"1"},
      {day:"2026-11-05",event:"solo:normal",segment:"unmarked",hits:"3"}
    ],
    uniqueRows:[],rawRows:[],diagnosticDays:[],diagnosticRows:[]
  });
  assert.match(html,/Sessions navigateur<\/th><td>10<\/td><td>2<\/td><td>3<\/td><td>1<\/td><td>4<\/td>/);
  assert.match(html,/Ouvertures solo<\/th><td>5<\/td><td>1<\/td><td>0<\/td><td>3<\/td><td>1<\/td>/);
  assert.match(html,/Tous les événements<\/th><td>19<\/td><td>3<\/td><td>3<\/td><td>4<\/td><td>9<\/td>/);
  assert.match(html,/Non marqué ≠ joueur humain confirmé/);
  assert.match(html,/totaux bruts/);
  assert.match(html,/05\/11\/2026 13:01 UTC/);
  assert.match(html,/Sessions aujourd’hui/);
});
