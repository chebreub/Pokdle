"use strict";
// Anonymous, aggregate-only report for sharing economy statistics.
// Deliberately allowlists every field: never serialize the entire admin options,
// a raw database row, account/guest identity, access key or HTTP request.
const COIN_CATEGORIES = new Set(["daily","party","arcade","release","recharge","buy_poke","buy_great","buy_ultra","other"]);
const BALL_CATEGORIES = new Set(["arcade","daily","party","gift","streak","welcome","expedition","shop","other"]);
const BALL_TYPES = ["poke","great","ultra"];
const finite = n => n == null ? null : (Number.isFinite(Number(n)) ? Number(n) : null);
const safeGroup = (group, categories) => categories.has(group) ? group : "other";

// ECO-05: export one-dimensional segments, never player, action or raw row data.
const CAPTURE_SEGMENTS = Object.freeze({
  rules:new Set(["shiny-1-150","shiny-1-500"]),
  balls:new Set(BALL_TYPES),
  throwOrder:new Set(["1","2","3"]),
  kinds:new Set(["wild","legend","prestige"]),
  classes:new Set(["rare","moderate","common","unknown"])
});
function safeCaptureRows(capture, key) {
  return (capture?.[key] || []).filter(row=>CAPTURE_SEGMENTS[key].has(row.segment))
    .map(row=>({group:row.segment,throws:finite(row.throws),caught:finite(row.catches)}));
}
function captureDiagnostics(capture) {
  return {
    prospectiveOnly:true, available:capture?.available === true,
    recordedThrows:finite(capture?.throws ?? 0), recordedCaptures:finite(capture?.catches ?? 0),
    byRuleVersion:safeCaptureRows(capture,"rules"),
    byBall:safeCaptureRows(capture,"balls"),
    byThrowNumber:safeCaptureRows(capture,"throwOrder"),
    byEncounterKind:safeCaptureRows(capture,"kinds"),
    byCaptureClass:safeCaptureRows(capture,"classes"),
    // Hide species with fewer than 10 measured throws in the selected period.
    speciesWithAtLeast10Throws:(capture?.species || [])
      .filter(row=>Number.isInteger(row.pokemonId) && row.pokemonId >= 1 && row.pokemonId <= 1025 &&
        Number(row.throws) >= 10).slice(0,20)
      .map(row=>({pokemonId:row.pokemonId,throws:finite(row.throws),caught:finite(row.catches)})),
    speciesSuppressed:finite(capture?.speciesSuppressed ?? 0)
  };
}
function buildEconomyExport(economy) {
  if (!economy) return null;
  const {coins,balls,wild,capture,startDay,endDay} = economy;
  return {
    schema: "pokdle-economy-aggregate-v1",
    source: "Pokédle /admin/stats · agrégats existants du serveur",
    period: {startDay,endDay,timezone:"Europe/Paris"},
    pokedollars: {
      credited: finite(coins.gained),
      spent: finite(coins.spent),
      netFlow: finite(coins.net),
      byCategory: (coins.sources || []).map(row=>({
        category: safeGroup(row.category,COIN_CATEGORIES),
        credited: finite(row.gained),
        spent: finite(row.spent),
        operations: finite(row.operations)
      }))
    },
    balls: {
      awarded: finite(balls.awarded),
      awardedByType: Object.fromEntries(BALL_TYPES.map(ball=>[ball,finite(balls.byType[ball])])),
      byCategory: (balls.sources || []).map(row=>({
        category: safeGroup(row.category,BALL_CATEGORIES),
        type: BALL_TYPES.includes(row.ball) ? row.ball : "other",
        awarded: finite(row.awarded)
      }))
    },
    encounters: {
      total: finite(wild.encounters),
      ordinary: finite(wild.ordinary),
      special: finite(wild.special),
      withAtLeastOneThrow: finite(wild.attempted),
      caught: finite(wild.caught),
      fled: finite(wild.fled),
      skipped: finite(wild.skipped),
      open: finite(wild.open),
      shinySeen: finite(wild.shinySeen),
      shinyCaught: finite(wild.shinyCaught),
      distinctEncounterIdentities: finite(wild.actors),
      totalThrows: finite(wild.throws),
      throwsByType: Object.fromEntries(BALL_TYPES.map(ball=>[ball,finite(wild.used[ball])])),
      capturesByLastBall: Object.fromEntries(BALL_TYPES.map(ball=>[ball,finite(wild.capturedWith[ball])])),
      observedCapturesPerThrowPct: finite(wild.successPerThrow)
    },
    captureDiagnostics: captureDiagnostics(capture),
    interpretation: {
      creditedMinusSpentIsNotWalletBalance: true,
      countsAreEventsNotUniquePlayers: true,
      observedCapturesPerThrowIsNotAnOfficialCaptureRate: true,
      recentPeriodMayContainOpenEncounters: true,
      noIndividualDataIncluded: true,
      captureDiagnosticsAreProspectiveAndNotHistorical: true
    }
  };
}

function economyExportHref(economy) {
  const aggregate = buildEconomyExport(economy);
  return aggregate === null ? null :
    "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(aggregate,null,2) + "\n");
}

module.exports = {buildEconomyExport,economyExportHref};
