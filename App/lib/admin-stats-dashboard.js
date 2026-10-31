"use strict";

// Read-only presentation of existing aggregate counters. Never stores visitor IDs or modifies game state.
const { summarizeModes, startDay, utcDay } = require("./usage-metrics");
const PERIODS = [7, 14, 30, 90];
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
    days = 14, endDay = utcDay(), adminKey = "", metrics = null, uniqueRows = null,
    rawRows = null, labels = {}, feedbackHtml = "", diagnosticDays = [],
    diagnosticRows = [], bootedAt = "", retention = null
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
  const sessionsTotal = metrics == null ? null : countRows(metrics, "visit");
  const lastDay = series.at(-1);
  const summary = metrics == null ? [] : summarizeModes(metrics, labels);
  const launches = metrics == null ? null : summary.reduce((sum, game) => sum + game.launches, 0);
  const active = summary.filter(g => g.launches > 0);
  const peak = Math.max(1, ...active.map(g => g.launches));
  const mostPlayed = active.slice(0, 6).map(g =>
    '<div class="mode-row"><div class="mode-label"><span>' + escapeHtml(g.label) + '</span><strong>' +
    number(g.launches) + '</strong></div><div class="bar-track"><div class="bar-fill" style="width:' +
    (g.launches / peak * 100).toFixed(1) + '%"></div></div></div>').join("") ||
    '<p class="empty">Aucun lancement de jeu comptabilisé pour cette période.</p>';
  const modeRows = summary.map(g =>
    '<tr><th scope="row">' + escapeHtml(g.label) + '</th><td>' + number(g.launches) +
    '</td><td>' + (g.finishInstrumented ? number(g.completions) : "—") +
    '</td><td>' + (g.finishInstrumented ? number(g.wins) : "—") +
    '</td><td>' + (g.finishInstrumented ? number(g.losses) : "—") + '</td></tr>').join("");
  const partyCreated = countRows(metrics, "party:create");
  const partyJoined = countRows(metrics, "party:join");
  const partyRounds = metrics === null ? null : metrics.filter(r => r.event.startsWith("party:start:")).reduce((n,r) => n + Number(r.hits || 0),0);
  const trafficRows = [...series].reverse().map(r =>
    '<tr><th scope="row">' + dateLong(r.day) + '</th><td>' + number(r.sessions) +
    '</td><td>' + number(r.uniques) + '</td><td>' + number(r.raw) + '</td></tr>').join("");
  const diagCols = diagnosticDays.map(day => '<th scope="col">' + escapeHtml(dateLabel(day)) + '</th>').join("");
  const diagRows = diagnosticRows.map(r => '<tr><th scope="row">' + escapeHtml(r.label) + '</th>' +
    r.values.map(n => '<td>' + (n ? number(n) : "—") + '</td>').join("") +
    '<td><strong>' + number(r.total) + '</strong></td></tr>').join("");
  const safeKey = escapeHtml(adminKey);
  const optionsHtml = PERIODS.map(n => '<option value="' + n + '"' + (n === period ? " selected" : "") + '>' + n + ' jours</option>').join("");
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
</style></head><body><main class="main"><header class="top"><div><div class="brand">Pokédle / Administration</div><h1>Statistiques du site</h1><p class="subtitle">${period} jours complets, jusqu'au ${dateLong(endDay)} inclus · Journées UTC</p></div>
<form class="period" method="get" action="/admin/stats"><input type="hidden" name="key" value="${safeKey}"><label for="days">Période</label><select id="days" name="days">${optionsHtml}</select><button type="submit">Afficher</button></form></header>
<div class="kpis">
${kpi("Sessions enregistrées",sessionsTotal,"Une visite par session de navigateur, pas des personnes uniques","↗")}
${kpi("Navigateurs uniques",lastDay.uniques,"Estimation du " + dateLong(endDay) + " (pas des personnes)","◎")}
${kpi("Lancements de jeux",launches,"Somme des lancements déclarés sur la période","▣")}
${retentionKpi(retention)}
</div>
<div class="columns"><div>
<section class="panel"><div class="panel-head"><h2>Fréquentation quotidienne</h2><span class="pill">${period} jours · UTC</span></div>
<p>Courbes des sessions et navigateurs distincts estimés. Les journées non mesurées ne sont pas inventées.</p>${graph(series)}</section>
<section class="panel"><h2>Jeux les plus lancés</h2><p>Les barres comptent des lancements de modes, pas des joueurs différents ni des taux de fin.</p>${mostPlayed}</section>
</div><div>
<section class="panel"><h2>Party Room</h2><p>Événements déclarés sur la même période. Une personne peut rejoindre plusieurs fois.</p><div class="party">
<div class="mini"><strong>${number(partyCreated)}</strong><span>Salles créées</span></div><div class="mini"><strong>${number(partyJoined)}</strong><span>Jonctions</span></div><div class="mini"><strong>${number(partyRounds)}</strong><span>Manches démarrées</span></div></div></section>
<section class="panel feedback">${feedbackHtml}</section>
<section class="panel"><h2>Comment lire ces chiffres ?</h2><p><strong>Sessions :</strong> ouvertures réelles de l'application, pas les robots.</p><p><strong>Navigateurs uniques :</strong> estimation par jour uniquement, non additionnable entre les jours.</p><p><strong>Fins de manches :</strong> certains jeux enchaînent plusieurs tours pour un seul lancement. Ne pas les lire comme des taux d'abandon.</p><p><strong>Retour des joueurs :</strong> calculé avec les parties du Pokémon du jour que le jeu garde déjà (un compte, ou un navigateur pour les invités) : la part des joueurs d'un jour qui rejouent le lendemain, puis dans les 7 jours. Aucune donnée n'est ajoutée pour ça.</p></section>
</div></div>
<details><summary>Voir le détail quotidien des visites</summary><div class="detail-body"><div class="table-scroll"><table><thead><tr><th>Jour (UTC)</th><th>Sessions</th><th>Navigateurs uniques estimés</th><th>Chargements bruts (robots inclus)</th></tr></thead><tbody>${trafficRows}</tbody></table></div><p class="footnote">« — » = non mesuré, et non zéro. Les chargements bruts comprennent les robots, aperçus de liens et pings de maintien en éveil.</p></div></details>
<details><summary>Voir le détail de tous les jeux</summary><div class="detail-body"><div class="table-scroll"><table><thead><tr><th>Mode</th><th>Lancements</th><th>Fins de manches</th><th>Victoires</th><th>Fins sans victoire</th></tr></thead><tbody>${modeRows || '<tr><td colspan="5">Aucune donnée de jeu disponible.</td></tr>'}</tbody></table></div><p class="footnote">Une fin n'est pas toujours une partie distincte ; les manches peuvent être rejouées plusieurs fois. « — » = mode sans suivi des fins.</p></div></details>
<details><summary>Diagnostic technique — événements depuis redémarrage</summary><div class="detail-body"><p class="footnote">Compteurs en mémoire réinitialisés au redémarrage du ${escapeHtml(bootedAt)} UTC. Ils ne sont pas comparables aux totaux persistants sur ${period} jours.</p>
<div class="table-scroll"><table><thead><tr><th>Événement</th>${diagCols}<th>Total</th></tr></thead><tbody>${diagRows || '<tr><td colspan="2">Aucun événement de diagnostic.</td></tr>'}</tbody></table></div></div></details>
<p class="footnote">Administration privée · Horodatage des compteurs en UTC · Données agrégées (rétention maximale 90 jours) · Les autres données des jeux et sauvegardes ne sont pas modifiées.</p>
</main></body></html>`;
}
module.exports = { renderStatsDashboard, rangeDays };
