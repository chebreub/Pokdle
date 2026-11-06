'use strict';
// ECO-08: offline policy study only. No call into the game's DB or capture engine.
// These policies are hypothetical; none of them are activated in production.
const MS_HOUR = 3600000;
const POLICIES = Object.freeze([
  'current_midnight', 'rolling_48h', 'rolling_72h', 'weekly_cap_72h'
]);
const SAMPLES = Object.freeze([
  {name: 'Monday 09:00 Paris', opened: '2026-11-09T08:00:00Z'},
  {name: 'Friday 22:00 Paris', opened: '2026-11-06T21:00:00Z'},
  {name: 'Sunday 21:00 Paris', opened: '2026-11-08T20:00:00Z'},
  {name: 'DST fallback Sunday 02:30 CEST', opened: '2026-10-25T00:30:00Z'},
  {name: 'DST spring forward Sunday 01:30 CET', opened: '2027-03-28T00:30:00Z'}
]);
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
});
function parisDate(instant) {
  const parts = DATE_FORMAT.formatToParts(new Date(instant));
  const get = kind => parts.find(p => p.type === kind)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function nextParisMidnight(instant) {
  const original = new Date(instant).getTime();
  if (!Number.isFinite(original)) throw new TypeError('invalid_instant');
  const originDay = parisDate(original);
  // Search UTC instants to find the first instant of the next Paris date.
  // Works during DST transitions; 24 hours from now is not always next midnight.
  let low = original, high = original + 49 * MS_HOUR;
  if (parisDate(high) === originDay) throw new Error('unexpected_local_calendar');
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (parisDate(mid) === originDay) low = mid;
    else high = mid;
  }
  return high;
}
function nextMondayParis(instant) {
  let current = new Date(instant).getTime();
  if (!Number.isFinite(current)) throw new TypeError('invalid_instant');
  for (let i = 0; i < 7; i++) {
    current = nextParisMidnight(current);
    const localDay = parisDate(current);
    const utcWeekday = new Date(localDay + 'T12:00:00Z').getUTCDay();
    if (utcWeekday === 1) return current;
  }
  throw new Error('next_monday_not_found');
}
function expiresAt(opened, policy) {
  const start = new Date(opened).getTime();
  if (!Number.isFinite(start)) throw new TypeError('invalid_instant');
  if (!POLICIES.includes(policy)) throw new RangeError('unknown_policy');
  if (policy === 'current_midnight') return nextParisMidnight(start);
  if (policy === 'rolling_48h') return start + 48 * MS_HOUR;
  if (policy === 'rolling_72h') return start + 72 * MS_HOUR;
  return Math.min(start + 72 * MS_HOUR, nextMondayParis(start));
}
function previewEncounter(row, now, policy) {
  if (!row || row.kind !== 'legend' || row.status !== 'open') return null;
  const expiry = expiresAt(row.createdAt, policy);
  if (!(new Date(now).getTime() < expiry)) return null;
  return {
    // Do not re-roll Pokemon, shiny, throws or inventory on resume.
    id: row.id, pokemonId: row.pokemonId, shiny: row.shiny,
    throws: row.throws, throwsLeft: Math.max(0, 3 - row.throws),
    expiresAt: new Date(expiry).toISOString()
  };
}
function compare() {
  return SAMPLES.flatMap(({name, opened}) => POLICIES.map(policy => ({
    sample: name, opened, policy,
    expiresAt: new Date(expiresAt(opened, policy)).toISOString(),
    availableHours: +(Math.round((expiresAt(opened, policy) - Date.parse(opened)) / MS_HOUR * 100) / 100).toFixed(2)
  })));
}
function run() {
  const rows = compare();
  if (process.argv.includes('--json')) return console.log(JSON.stringify(rows, null, 2));
  console.log('ECO-08 — strictly offline encounter hold policy study; not production telemetry');
  console.log('Example | Policy | Window (hours) | End UTC');
  for (const row of rows) console.log(`${row.sample} | ${row.policy} | ${row.availableHours} | ${row.expiresAt}`);
}
if (require.main === module) run();
module.exports = {POLICIES, SAMPLES, parisDate, nextParisMidnight, nextMondayParis, expiresAt, previewEncounter, compare};
