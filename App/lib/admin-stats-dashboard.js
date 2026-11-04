"use strict";

// Read-only presentation of existing aggregate counters. Never stores visitor IDs or modifies game state.
const { summarizeModes, startDay, utcDay, SOLO_CATALOG, PARTY_CATALOG, HISTORY_TO_LAUNCH } = require("./usage-metrics");
const PERIODS = [1, 3, 7, 14, 30, 90];
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
function number(value) {
  return value == null ? "—" : new Intl.NumberFormat("fr-FR").format(value);
}
function dateLabel(iso) {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}
function dateLong(iso) {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
}
function rangeDays(days, endDay) {
  const from = startDay(days, new Date(endDay + "T12:00:00Z"));
  const out = [];
  for (let ms = Date.parse(from + "T00:00:00Z"); ms <= Date.parse(endDay + "T00:00:00Z"); ms += 86400000) {
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}
function countRows(rows, event) {
  return rows == null ? null : rows.reduce((sum, row) => row.event === event ? sum + Number(row.hits || 0) : sum, 0);
}
function kpi(title, value, note, icon) {
  return '<div class="kpi"><div class="kpi-label"><span class="kpi-symbol" aria-hidden="true">' +
    icon + '</span>' + escapeHtml(title) + '</div><strong>' + (typeof value === "string" ? escapeHtml(value) : number(value)) +
    '</strong><small>' + escapeHtml(note) + '</small></div>';
}
// « Retour des joueurs » from the Pokémon du jour plays (lib/daily-retention.js).
function retentionKpi(retention) {
  const pct = (part) => part && part.rate != null ? part.rate + " %" : "—";
  if (!retention) return kpi("Retour des joueurs", null, "Indisponible : base du Pokémon du jour injoignable", "↻");
  const note = "Rejouent le lendemain (" + retention.nextDay.back + "/" + retention.nextDay.base + ") · dans les 7 jours : " +
    pct(retention.week) + " · nouveaux revenus en 7 jours : " + pct(retention.newWeek);
  return kpi("Retour des joueurs", pct(retention.nextDay), note, "↻");
}
function graph(series) {
  const available = series.some(x => x.sessions !== null || x.uniques !== null);
  if (!available) return '<p class="empty">Aucune donnée de fréquentation disponible sur cette période.</p>';
  const w = 890, h = 260, left = 48, right = 20, top = 20, bottom = 40;
  const plotW = w - left - right, plotH = h - top - bottom;
  const maxValue = Math.max(1, ...series.flatMap(x => [x.sessions, x.uniques].filter(n => n !== null)));
  const ceiling = Math.max(5, Math.ceil(maxValue / 5) * 5);
  const xAt = i => left + (series.length === 1 ? 0 : i / (series.length - 1)) * plotW;
  const yAt = n => top + plotH * (1 - n / ceiling);
  const grid = [0, 1, 2, 3, 4].map(n => {
    const value = ceiling * n / 4, y = yAt(value);
    return '<line x1="' + left + '" x2="' + (w - right) + '" y1="' + y + '" y2="' + y + '" stroke="#e4eaf5"/>' +
      '<text x="' + (left - 9) + '" y="' + (y + 4) + '" text-anchor="end" font-size="12" fill="#6b7791">' +
      number(Math.round(value)) + '</text>';
  }).join("");
  function plot(key, color) {
    let paths = [], current = [];
    function flush() { if (current.length) { paths.push('<path d="' + current.join(" ") + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'); current = []; } }
    const dots = [];
    series.forEach((row, i) => {
      const n = row[key];
      if (n == null) { flush(); return; }
      const x = xAt(i), y = yAt(n);
      current.push((current.length ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2));
      dots.push('<circle cx="' + x + '" cy="' + y + '" r="3.8" fill="' + color + '"><title>' +
        escapeHtml(dateLong(row.day) + " : " + number(n) + (key === "sessions" ? " sessions" : " navigateurs uniques estimés")) +
        '</title></circle>');
    });
    flush();
    return paths.join("") + dots.join("");
  }
  const step = series.length > 25 ? 7 : series.length > 14 ? 3 : series.length > 7 ? 2 : 1;
  const labels = series.map((row, i) => (i % step === 0 || i === series.length - 1) ?
    '<text x="' + xAt(i) + '" y="' + (h - 13) + '" text-anchor="middle" font-size="12" fill="#6b7791">' +
    escapeHtml(dateLabel(row.day)) + '</text>' : "").join("");
  return '<div class="chart-scroll"><svg class="trend-chart" role="img" aria-label="Évolution quotidienne des sessions et des navigateurs uniques estimés, sans inventer les jours manquants" viewBox="0 0 ' +
    w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' + grid +
    plot("sessions", "#345fce") + plot("uniques", "#e28a3e") + labels + '</svg></div>' +
    '<div class="legend"><span><i class="dot blue"></i>Sessions enregistrées</span><span><i class="dot orange"></i>Navigateurs uniques estimés</span></div>';
}

function renderStatsDashboard(options) {
  const {
    days = 14, endDay = utcDay(), livePeriod = days <= 3,
    generatedAt = new Date().toISOString(), adminKey = "", metrics = null,
    uniqueRows = null, rawRows = null, labels = {},
    feedbackHtml = "", diagnosticDays = [], diagnosticRows = [],
    bootedAt = "", retention = null
  } = options;
  const period = PERIODS.includes(days) ? days : 14;
  const calendar = rangeDays(period, endDay);
  const sessionMap = new Map((metrics || []).filter(r => r.event === "visit").map(r => [r.day, Number(r.hits)]));
  const uniqueMap = new Map((uniqueRows || []).map(r => [r.day, Number(r.uniques)]));
  const rawMap = new Map((rawRows || []).map(r => [r.d, Number(r.hits)]));
  const series = calendar.map(day => ({
    day, sessions: sessionMap.has(day) ? sessionMap.get(day) : null,
    uniques: uniqueMap.has(day) ? uniqueMap.get(day) : null,
    raw: rawMap.has(day) ? rawMap.get(day) : null
  }));
  const measured = metrics !== null;
  const summary = summarizeModes(metrics || [], labels);
  const summaryByMode = new Map(summary.map(row => [row.mode, row]));
  // A mode with an activated counter and no rows has zero measured openings;
  // a database outage keeps the metrics unavailable rather than fabricating zeros.
  const modeData = Object.entries(SOLO_CATALOG).map(([mode, meta]) => {
    const observed = summaryByMode.get(mode);
    return {
      mode, label: observed?.label || labels["solo:" + mode] || meta.label,
      group: meta.group,
      launches: measured ? observed?.launches || 0 : null,
      completions: measured ? observed?.completions || 0 : null,
      wins: measured ? observed?.wins || 0 : null,
      losses: measured ? observed?.losses || 0 : null,
      finishInstrumented: Object.values(HISTORY_TO_LAUNCH).includes(mode)
    };
  });
  // Preserve any new validated mode that hasn't yet been classified in this UI.
  for (const row of summary) if (!SOLO_CATALOG[row.mode]) modeData.push(row);
  const ranked = modeData.filter(row => row.launches > 0).sort((a,b) => b.launches - a.launches || a.label.localeCompare(b.label,"fr"));
  const launches = measured ? modeData.reduce((a,b) => a + b.launches,0) : null;
  const finishes = measured ? modeData.reduce((a,b) => a + (b.finishInstrumented ? b.completions : 0),0) : null;
  const sessionsTotal = measured ? countRows(metrics,"visit") : null;
  const lastDay = series.at(-1);
  const partyCreated = countRows(metrics,"party:create");
  const partyJoined = countRows(metrics,"party:join");
  const partyRounds = measured ? metrics.filter(r => r.event.startsWith("party:start:")).reduce((n,r) => n + Number(r.hits || 0),0) : null;
  const shares = countRows(metrics,"share:daily");
  const shareVisits = countRows(metrics,"share:visit");
  const peak = Math.max(1,...ranked.map(row => row.launches));
  const mostPlayed = ranked.slice(0,8).map(row =>
    '<div class="mode-row"><div class="mode-label"><span>' + escapeHtml(row.label) +
    '<span class="mode-caption">' + escapeHtml(row.group) + '</span></span><strong>' +
    number(row.launches) + '</strong></div><div class="bar-track"><div class="bar-fill" style="width:' +
    (row.launches / peak * 100).toFixed(1) + '%"></div></div></div>'
  ).join("") || '<p class="empty">Aucun lancement enregistré pour cette période.</p>';

  const families = ["Quotidien","Deviner","Arcade","Autres"];
  const sortedModes = [...modeData].sort((a,b) =>
    families.indexOf(a.group) - families.indexOf(b.group) || b.launches - a.launches || a.label.localeCompare(b.label,"fr"));
  const modeRows = families.map(group => {
    const rows = sortedModes.filter(m => m.group === group);
    if (!rows.length) return "";
    return '<tr class="group-heading"><th scope="colgroup" colspan="5">' + escapeHtml(group) + '</th></tr>' +
      rows.map(m => '<tr><th scope="row" class="mode-name">' + escapeHtml(m.label) + '</th>' +
        '<td>' + number(m.launches) + '</td><td>' +
        (m.finishInstrumented ? number(m.completions) : '—') + '</td><td>' +
        (m.finishInstrumented ? number(m.wins) : '—') + '</td><td>' +
        (m.finishInstrumented ? number(m.losses) : '—') + '</td></tr>').join("");
  }).join("");

  const partyRows = Object.entries(PARTY_CATALOG).map(([event,label]) => ({
    label, hits: countRows(metrics,event)
  })).sort((a,b) => (b.hits ?? -1) - (a.hits ?? -1) || a.label.localeCompare(b.label,"fr"))
    .map(row => '<tr><th scope="row">' + escapeHtml(row.label) + '</th><td>' + number(row.hits) + '</td></tr>').join("");

  const trafficRows = [...series].reverse().map(row =>
    '<tr><th scope="row">' + dateLong(row.day) + '</th><td>' + number(row.sessions) +
    '</td><td>' + number(row.uniques) + '</td><td>' + number(row.raw) + '</td></tr>').join("");
  const diagCols = diagnosticDays.map(day => '<th scope="col">' + escapeHtml(dateLabel(day)) + '</th>').join("");
  const diagRows = diagnosticRows.map(row => '<tr><th scope="row">' + escapeHtml(row.label) + '</th>' +
    row.values.map(n => '<td>' + (n ? number(n) : "—") + '</td>').join("") +
    '<td><strong>' + number(row.total) + '</strong></td></tr>').join("");
  const periodOptions = PERIODS.map(value => {
    const title = value===1 ? "Aujourd’hui" : value===3 ? "3 jours" : value + " jours";
    return '<button type="submit" name="days" value="' + value + '" class="period-choice' +
      (value===period ? ' is-active' : '') + '"' + (value===period ? ' aria-current="true"' : '') +
      '>' + title + '</button>';
  }).join("");
  const periodLabel = livePeriod
    ? (period===1 ? "Aujourd’hui, journée UTC en cours" : "3 jours UTC dont aujourd’hui (en cours)")
    : period + " jours complets, jusqu’au " + dateLong(endDay) + " inclus · UTC";
  const refreshed = typeof generatedAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(generatedAt)
    ? generatedAt.slice(8,10) + "/" + generatedAt.slice(5,7) + " à " + generatedAt.slice(11,16) + " UTC"
    : "heure indisponible";
  const dailyFocus = '<div class="quick-strip">' +
    '<div class="quick-stat"><strong>' + number(lastDay.sessions) + '</strong><span>Sessions aujourd’hui</span></div>' +
    '<div class="quick-stat"><strong>' + number(lastDay.uniques) + '</strong><span>Navigateurs distincts estimés aujourd’hui</span></div>' +
    '<div class="quick-stat"><strong>' + number(lastDay.raw) + '</strong><span>Chargements bruts, robots inclus</span></div></div>';
  const trend = period===1 ? dailyFocus : graph(series);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Statistiques · Pokédle</title>
<style>
:root{color-scheme:light;--ink:#192c50;--muted:#64748e;--line:#e5ebf4;--surface:#fff;--blue:#345fce}
*{box-sizing:border-box}body{margin:0;background:#f5f7fc;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px}
.main{max-width:1190px;padding:32px 22px 80px;margin:0 auto}.top{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px}
.brand{color:#345fce;font-weight:850;letter-spacing:-.035em;font-size:16px}.top h1{font-size:clamp(23px,3.6vw,34px);margin:8px 0;letter-spacing:-.045em}
.subtitle{color:var(--muted);margin:0;font-size:13px}.period{display:flex;align-items:center;gap:10px;background:#fff;padding:10px;border:1px solid var(--line);border-radius:14px}
.period label{font-size:12px;font-weight:700;color:#586b89}.period select,.period button{border:1px solid #d6dfed;border-radius:9px;padding:8px 10px;font:inherit;background:#fff;color:var(--ink)}
.period button{background:var(--blue);color:#fff;border-color:var(--blue);cursor:pointer;font-weight:750}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:20px}.kpi,.panel{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 3px 16px #182b5008}
.kpi{padding:19px;display:flex;flex-direction:column;gap:9px;min-width:0}.kpi-label{font-size:12px;color:#566784;font-weight:750;display:flex;align-items:center;gap:8px}.kpi-symbol{color:var(--blue);font-size:17px}.kpi strong{font-size:clamp(22px,3vw,32px);letter-spacing:-.04em;line-height:1.05;font-variant-numeric:tabular-nums}.kpi small{font-size:11px;line-height:1.5;color:var(--muted)}
.columns{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,1fr);gap:16px;align-items:start}.panel{padding:22px;margin-bottom:16px;min-width:0}.panel h2{font-size:18px;letter-spacing:-.025em;margin:0 0 8px}
.panel p{color:var(--muted);line-height:1.55;font-size:12px;margin:0 0 13px}.panel small{color:var(--muted)}.pill{font-size:11px;color:#3b5a97;background:#edf3ff;border-radius:999px;padding:6px 9px}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap;margin-bottom:12px}.chart-scroll{overflow-x:auto}.trend-chart{display:block;width:100%;min-width:520px;height:auto}.legend{display:flex;gap:18px;flex-wrap:wrap;color:#52637d;font-size:11px;margin-top:12px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.blue{background:#345fce}.orange{background:#e28a3e}
.mode-row{margin:13px 0}.mode-label{display:flex;justify-content:space-between;gap:10px;margin-bottom:6px;font-size:12px}.mode-label strong{font-variant-numeric:tabular-nums}
.bar-track{height:8px;border-radius:30px;background:#e8eef8;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,#4f83eb,#3159bd);border-radius:30px}
.party{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mini{padding:12px 8px;border-radius:12px;background:#f2f5fa;text-align:center}.mini strong{display:block;font-size:22px;font-variant-numeric:tabular-nums}.mini span{display:block;color:var(--muted);font-size:11px;line-height:1.35}
details{background:#fff;border:1px solid var(--line);border-radius:16px;margin:15px 0;overflow:hidden}summary{cursor:pointer;padding:16px 20px;font-weight:750;color:var(--ink)}details .detail-body{padding:0 20px 18px}
.table-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px}table{width:100%;border-collapse:collapse;background:#fff;font-size:12px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}th:first-child{text-align:left}thead th{background:#f0f4fa;color:#425573;font-weight:800}tbody tr:last-child>*{border-bottom:0}tbody tr:hover{background:#f9fbff}.empty{color:#67748d;padding:10px 0}.footnote{font-size:11px;color:var(--muted);line-height:1.6;margin:8px 0 0}.feedback h2{font-size:17px;margin-bottom:10px}
@media(max-width:850px){.columns{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.main{padding:22px 13px 50px}.panel{padding:17px}.period{width:100%;justify-content:space-between}}@media(max-width:380px){.kpi{padding:13px}.kpi strong{font-size:24px}.party{grid-template-columns:1fr}.period{flex-wrap:wrap}}

/* Admin Stats V2 — deliberately an admin-only, dependency-free screen */
:root{--ink:#203050;--muted:#63738e;--line:#e2e9f3;--blue:#335cbd;--surface:#fff}
body{background:#f3f6fb;color:var(--ink);font-size:14px}
.main{max-width:1270px;padding:26px 22px 80px}
.top{display:block;background:#142640;color:#fff;border:1px solid #263b5b;border-radius:22px;padding:27px 30px;margin-bottom:18px;box-shadow:0 12px 30px #12284a18}
.brand{font-size:12px;color:#d9e6ff;letter-spacing:.09em;text-transform:uppercase}
.top h1{font-size:clamp(25px,4vw,38px);color:#fff;margin:8px 0}
.top .subtitle{font-size:13px;color:#d1def1}
.top-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:15px;color:#c6d7ee;font-size:12px}
.live-dot{width:7px;height:7px;background:#6bd6ad;border-radius:50%;display:inline-block;box-shadow:0 0 0 4px #6bd6ad26}
.period{background:#223956;border:1px solid #3c5270;padding:5px;display:flex;flex-wrap:wrap;gap:5px;max-width:max-content;margin-top:22px;border-radius:12px}
.period .period-choice{border:1px solid transparent;background:transparent;color:#dbe7f7;cursor:pointer;min-height:40px;padding:9px 14px;border-radius:9px;font-size:13px;font-weight:750}
.period .period-choice:hover{background:#ffffff13}
.period .period-choice.is-active{background:#fff;color:#1d3156;box-shadow:0 1px 6px #07162833}
.period .period-choice:focus-visible{outline:3px solid #e5ad47;outline-offset:2px}
.kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:19px}
.kpi{padding:19px 21px;gap:10px;min-height:127px}
.kpi strong{font-size:clamp(25px,3vw,34px)}
.kpi-label{font-size:12px}.kpi small{font-size:12px}
.kpi-symbol{display:grid;place-items:center;width:27px;height:27px;border-radius:9px;background:#eef3ff;font-size:16px}
.panel{border-radius:18px;padding:23px;box-shadow:0 3px 14px #21324f08}
.panel h2{font-size:18px;margin:0 0 6px}
.panel h3{font-size:13px;margin:14px 0 9px;color:#31425e}
.panel p{font-size:12px;line-height:1.6}
.columns{grid-template-columns:minmax(0,1.65fr) minmax(310px,1fr)}
.section-title{font-size:20px;letter-spacing:-.03em;margin:27px 0 13px}
.panel-head .pill{background:#eaf1fe;color:#31538d;font-weight:750}
.chart-scroll:not(.chart-long) .trend-chart{min-width:0}
.mode-top-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:19px}
.mode-row{margin:12px 0}
.mode-label span{max-width:calc(100% - 40px)}
.mode-caption{display:inline-block;font-size:10px;color:#627694;margin-left:5px;font-weight:600}
.bar-fill{background:#416ed0}
.mode-row:first-child .bar-fill{background:#254eac}
.quick-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.quick-stat{background:#f2f6fc;border:1px solid #e5ebf4;border-radius:12px;padding:12px}
.quick-stat strong{font-size:22px;display:block;font-variant-numeric:tabular-nums}
.quick-stat span{font-size:11px;color:#64738b;display:block;margin-top:6px}
.metric-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #edf1f7}
.metric-row:last-child{border-bottom:0}
.metric-row span{font-size:12px;color:#52637b}
.metric-row strong{font-size:19px;font-variant-numeric:tabular-nums}
.table-scroll{background:#fff}
table{font-size:12px}
table th,table td{padding:10px 12px}
table .group-heading th{background:#eaf0fa;color:#284571;padding:10px 12px;font-size:12px;letter-spacing:.01em}
table .mode-name{font-weight:700}
table .mode-family{font-size:10px;color:#66788e;font-weight:550}
table .not-tracked{color:#697a92}
.panel .quiet{font-size:11px;color:#697a92}
.footnote{font-size:12px}
.focus-note{display:flex;align-items:center;gap:7px;font-size:12px;color:#526883;background:#f1f5fd;border-radius:10px;padding:10px 12px;margin:12px 0}
.feedback{overflow-wrap:anywhere}
details{border-radius:16px}
summary:hover{background:#f7faff}
a{color:#345fce}
@media(max-width:930px){.columns{grid-template-columns:1fr}}
@media(max-width:750px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.top{padding:23px 18px}.main{padding:15px 12px 60px}.panel{padding:17px}.period{max-width:none}.period .period-choice{flex:1 1 auto;min-width:61px}}
@media(max-width:520px){.mode-top-list{grid-template-columns:1fr}.quick-strip{grid-template-columns:1fr 1fr}.kpis{gap:9px}.kpi{padding:14px;min-height:123px}.kpi strong{font-size:26px}.kpi small{font-size:11px}.period .period-choice{padding:9px 10px}}
</style>
</head><body><main class="main">
<header class="top">
  <div class="brand">Pokédle / Administration</div><h1>Tableau de bord</h1>
  <p class="subtitle">${escapeHtml(periodLabel)} · Compteurs agrégés de fréquentation et de jeux</p>
  <div class="top-meta"><span class="live-dot" aria-hidden="true"></span><span>Page générée le ${escapeHtml(refreshed)}</span><span>·</span><span>Actualise les données en rechargeant cette page</span></div>
  <form class="period" method="get" action="/admin/stats" aria-label="Choisir une période"><input type="hidden" name="key" value="${escapeHtml(adminKey)}">${periodOptions}</form>
</header>
<section class="kpis" aria-label="Indicateurs principaux">
${kpi("Sessions enregistrées",sessionsTotal,"Visites du site sur la période, pas des personnes uniques","↗")}
${kpi("Navigateurs du dernier jour",lastDay.uniques,"Estimation du " + dateLong(endDay) + " uniquement ; ne pas additionner les jours","◎")}
${kpi("Ouvertures de jeux",launches,"Somme des ouvertures suivies ; une personne peut jouer plusieurs fois","▣")}
${kpi("Fins déclarées",finishes,"Résultats signalés par les jeux ; pas un taux de conversion","✓")}
${kpi("Partages du Pokémon du jour",shares,"Actions de partage, pas forcément des visites reçues","◇")}
${retentionKpi(retention)}
</section>
<h2 class="section-title">Fréquentation et jeux</h2>
<div class="columns"><div>
  <section class="panel"><div class="panel-head"><h2>${period===1?"Activité d’aujourd’hui":"Fréquentation par jour"}</h2><span class="pill">${escapeHtml(period===1?"UTC · en cours":period+" jours · UTC")}</span></div>
    <p>Les sessions sont enregistrées, les navigateurs distincts sont estimés chaque jour. Les journées sans relevé restent non mesurées.</p>
    ${trend}
    ${livePeriod?'<div class="focus-note">● Période en cours : les chiffres évolueront durant la journée.</div>':""}
  </section>
  <section class="panel"><div class="panel-head"><h2>Jeux les plus ouverts</h2><span class="pill">Top 8</span></div>
    <p>Classement des ouvertures suivies sur la période. Ce ne sont ni des joueurs uniques ni des parties terminées.</p>
    <div class="mode-top-list">${mostPlayed}</div>
  </section>
</div><div>
  <section class="panel"><h2>Party Room</h2><p>Activité multijoueur. Un participant peut entrer plusieurs fois dans une salle.</p>
    <div class="party">
      <div class="mini"><strong>${number(partyCreated)}</strong><span>Salles créées</span></div>
      <div class="mini"><strong>${number(partyJoined)}</strong><span>Entrées en salle</span></div>
      <div class="mini"><strong>${number(partyRounds)}</strong><span>Manches lancées</span></div>
    </div>
    <h3>Modes lancés en Party Room</h3>
    <div class="table-scroll"><table><thead><tr><th>Mode multijoueur</th><th>Lancements</th></tr></thead><tbody>${partyRows}</tbody></table></div>
    <p class="quiet">Dessine-le ! et les autres modes Party sont présentés séparément des jeux solo.</p>
  </section>
  <section class="panel"><h2>Partage et découverte</h2><div class="metric-row"><span>Pokémon du jour partagé</span><strong>${number(shares)}</strong></div>
    <div class="metric-row"><span>Arrivées via un lien de défi</span><strong>${number(shareVisits)}</strong></div>
    <p class="quiet">Compteurs d’événements : aucun suivi individuel ni attribution par réseau social.</p>
  </section>
</div></div>
<h2 class="section-title">Tous les modes suivis</h2>
<section class="panel">
  <div class="panel-head"><h2>Lancements et résultats</h2><span class="pill">${modeData.length} modes référencés</span></div>
  <p>Les nouveaux compteurs (Wordle, Dossier, Grille, entraînement et séparation Higher or Lower 60 s) commencent à leur mise en ligne. Aucun historique antérieur n’est reconstitué.</p>
  <div class="table-scroll"><table><thead><tr><th>Jeu</th><th>Ouvertures</th><th>Fins suivies</th><th>Victoires</th><th>Sans victoire</th></tr></thead><tbody>${modeRows}</tbody></table></div>
  <p class="footnote">« — » signifie <b>non instrumenté ou indisponible</b>, et non zéro. Les fins sont des résultats déclarés, parfois de plusieurs manches par ouverture : leur rapport aux ouvertures ne mesure pas l’abandon.</p>
</section>
<div class="columns">
  <section class="panel feedback"><h2>Retours et interactions du jour</h2>${feedbackHtml}</section>
  <section class="panel"><h2>Bien interpréter les données</h2>
    <p><b>1 jour :</b> aujourd’hui UTC, jusqu’à l’heure de consultation ; ce n’est pas une fenêtre glissante de 24 heures.</p>
    <p><b>3 jours :</b> aujourd’hui et les deux jours UTC précédents, avec le dernier jour encore incomplet.</p>
    <p><b>7, 14, 30 et 90 jours :</b> périodes UTC closes hier pour éviter une baisse artificielle durant la journée.</p>
    <p><b>Retour des joueurs :</b> personnes/jours suivis dans le Pokémon du jour, sur une cohorte distincte des 14 derniers jours complets, pas sur la période sélectionnée.</p>
    <p><b>Ouvertures :</b> compteur d’accès aux jeux, pas une mesure du nombre de personnes différentes. Les jeux plus anciens ont parfois des événements partagés.</p>
  </section>
</div>
<details><summary>Voir les visites, jour par jour</summary><div class="detail-body"><div class="table-scroll"><table><thead><tr><th>Jour UTC</th><th>Sessions</th><th>Navigateurs distincts estimés</th><th>Chargements bruts</th></tr></thead><tbody>${trafficRows}</tbody></table></div><p class="footnote">« — » = non mesuré. Les chargements bruts peuvent comprendre robots, aperçus de liens et pings de disponibilité.</p></div></details>
<details><summary>Diagnostic — événements depuis le dernier redémarrage</summary><div class="detail-body"><p class="footnote">Compteurs mémoire remis à zéro au redémarrage : ${escapeHtml(bootedAt)} UTC. Ils ne sont pas comparables aux totaux persistants.</p>
  <div class="table-scroll"><table><thead><tr><th>Événement</th>${diagCols}<th>Total</th></tr></thead><tbody>${diagRows || '<tr><td colspan="2">Aucun événement de diagnostic.</td></tr>'}</tbody></table></div></div></details>
<p class="footnote">Page d’administration privée · Données agrégées conservées au maximum 90 jours · Aucune modification des parties, comptes ou récompenses.</p>
</main></body></html>`;
}
module.exports = { renderStatsDashboard, rangeDays };
