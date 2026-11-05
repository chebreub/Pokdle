"use strict";
// Anonymous, aggregate-only report for sharing economy statistics.
// Deliberately allowlists every field: never serialize the entire admin options,
// a raw database row, account/guest identity, access key or HTTP request.
const COIN_CATEGORIES = new Set(["daily","party","arcade","release","recharge","buy_poke","buy_great","buy_ultra","other"]);
const BALL_CATEGORIES = new Set(["arcade","daily","party","gift","streak","welcome","expedition","shop","other"]);
const BALL_TYPES = ["poke","great","ultra"];
const finite = n => Number.isFinite(Number(n)) ? Number(n) : null;
const safeGroup = (group, categories) => categories.has(group) ? group : "other";

function buildEconomyExport(economy) {
  if (!economy) return null;
  const {coins,balls,wild,startDay,endDay} = economy;
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
    interpretation: {
      creditedMinusSpentIsNotWalletBalance: true,
      countsAreEventsNotUniquePlayers: true,
      observedCapturesPerThrowIsNotAnOfficialCaptureRate: true,
      recentPeriodMayContainOpenEncounters: true,
      noIndividualDataIncluded: true
    }
  };
}

function economyExportHref(economy) {
  const aggregate = buildEconomyExport(economy);
  return aggregate === null ? null :
    "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(aggregate,null,2) + "\n");
}

module.exports = {buildEconomyExport,economyExportHref};
