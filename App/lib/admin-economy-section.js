"use strict";
// Private admin-only HTML, using aggregate rows from economy-stats.js.
const COIN_LABELS = Object.freeze({
  daily:"Jeux du jour",arcade:"Mini-jeux vérifiés",party:"Party Room",
  release:"Doublons relâchés",recharge:"Recharges de rencontres",
  buy_poke:"Achats · Poké Balls",buy_great:"Achats · Super Balls",
  buy_ultra:"Achats · Hyper Balls",other:"Autres (dont opérations administratives)"
});
const BALL_LABELS = Object.freeze({
  arcade:"Mini-jeux vérifiés",daily:"Jeux du jour",party:"Party Room",gift:"Cadeau du jour",
  streak:"Série de jours",welcome:"Bienvenue",expedition:"Expédition",
  shop:"Boutique",other:"Autres"
});
const BALL_KINDS = Object.freeze({poke:"Poké Ball",great:"Super Ball",ultra:"Hyper Ball"});
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[c]);
const fmt = value => value == null ? "—" : Number(value).toLocaleString("fr-FR");
const day = value => String(value).slice(8,10) + "/" + String(value).slice(5,7) + "/" + String(value).slice(0,4);
const stat = (label,value,note) => '<div class="quick-stat"><strong>' + fmt(value) +
  '</strong><span>' + esc(label) + '</span>' +
  (note ? '<small class="quiet">' + esc(note) + '</small>' : '') + '</div>';
const empty = colSpan => '<tr><td colspan="' + colSpan + '">Aucune opération enregistrée sur cette période.</td></tr>';

function renderEconomySection(economy) {
  if (!economy) return '<h2 class="section-title">Économie et captures</h2>' +
    '<section class="panel"><h2>Mesures indisponibles</h2>' +
    '<p>La base des Pokédollars, des Balls ou des captures n’a pas répondu. Aucun total n’est estimé.</p></section>';
  const {coins,balls,wild,startDay,endDay} = economy;
  const coinRows = coins.sources.map(row =>
    '<tr><th scope="row">' + esc(COIN_LABELS[row.category] || "Autres") + '</th>' +
    '<td>' + fmt(row.gained) + ' ₽</td><td>' + fmt(row.spent) + ' ₽</td></tr>').join("") || empty(3);
  const ballRows = Object.keys(BALL_LABELS).map(key=>{
    const group = balls.sources.filter(x=>x.category===key);
    if (!group.length) return "";
    const count = kind => group.filter(x=>x.ball===kind).reduce((n,x)=>n+x.awarded,0);
    return '<tr><th scope="row">' + esc(BALL_LABELS[key]) + '</th><td>' + fmt(count("poke")) +
      '</td><td>' + fmt(count("great")) + '</td><td>' + fmt(count("ultra")) + '</td></tr>';
  }).join("") || empty(4);
  const types = Object.entries(BALL_KINDS).map(([kind,label]) => {
    const used = wild.used[kind], success = wild.capturedWith[kind];
    const rate = used ? (100*success/used).toFixed(1).replace(".",",") + " %" : "—";
    return '<tr><th scope="row">' + esc(label) + '</th><td>' + fmt(used) +
      '</td><td>' + fmt(success) + '</td><td>' + rate + '</td></tr>';
  }).join("");
  return '<h2 class="section-title">Économie et captures</h2>' +
    '<p class="economy-period">Du <b>' + esc(day(startDay)) + '</b> au <b>' + esc(day(endDay)) +
    '</b> · jours de Paris (contrairement aux visites, mesurées en UTC). Opérations enregistrées, pas joueurs uniques.</p>' +
    '<div class="columns">' +
    '<section class="panel"><h2>Circulation des Pokédollars</h2>' +
    '<p>Sommes des écritures du journal serveur, achats inclus. Le net mesure les gains moins les dépenses sur la période, <b>pas</b> le solde total des joueurs.</p>' +
    '<div class="quick-strip">' + stat("Pokédollars crédités",coins.gained) +
    stat("Pokédollars dépensés",coins.spent) + stat("Variation nette",coins.net) + '</div>' +
    '<div class="table-scroll"><table><thead><tr><th>Origine / utilisation</th><th>Crédits</th><th>Dépenses</th></tr></thead>' +
    '<tbody>' + coinRows + '</tbody></table></div>' +
    '<p class="quiet">La catégorie « Autres » inclut les opérations non classées, notamment les attributions de test/administration lorsqu’elles existent.</p>' +
    '</section>' +
    '<section class="panel"><h2>Rencontres et captures</h2>' +
    '<p>Rencontres sauvages et spéciales initiées pendant la période, hors échanges reçus et réinitialisations administratives.</p>' +
    '<div class="quick-strip">' + stat("Rencontres créées",wild.encounters) +
    stat("Captures réussies",wild.caught) + stat("Balls lancées",wild.throws) + '</div>' +
    '<div class="quick-strip">' + stat("Shinies rencontrés",wild.shinySeen) +
    stat("Shinies capturés",wild.shinyCaught) +
    stat("Identités ayant rencontré",wild.actors) + '</div>' +
    '<div class="metric-row"><span>Rencontres ordinaires / spéciales</span><strong>' + fmt(wild.ordinary) + ' / ' + fmt(wild.special) + '</strong></div>' +
    '<div class="metric-row"><span>Rencontres perdues / passées / ouvertes</span><strong>' + fmt(wild.fled) +
    ' / ' + fmt(wild.skipped) + ' / ' + fmt(wild.open) + '</strong></div>' +
    '<div class="metric-row"><span>Captures par lancer enregistré</span><strong>' +
    (wild.successPerThrow == null ? '—' : esc(String(wild.successPerThrow).replace(".",",") + " %")) + '</strong></div>' +
    '<p class="quiet">Une capture relâchée ou échangée compte toujours comme réussie à la date de sa rencontre. Le pourcentage est empirique, toutes espèces et Balls confondues : ce n’est pas une probabilité officielle ni un taux par rencontre.</p>' +
    '</section></div>' +
    '<details><summary>Voir les Balls attribuées et les lancers par type</summary><div class="detail-body">' +
    '<div class="quick-strip">' + stat("Balls attribuées",balls.awarded) +
    stat("Poké Balls attribuées",balls.byType.poke) +
    stat("Super + Hyper attribuées",balls.byType.great+balls.byType.ultra) + '</div>' +
    '<h3>Origine des Balls</h3><div class="table-scroll"><table><thead><tr><th>Origine</th><th>Poké</th><th>Super</th><th>Hyper</th></tr></thead>' +
    '<tbody>' + ballRows + '</tbody></table></div>' +
    '<h3>Lancers et captures par Ball</h3><div class="table-scroll"><table><thead><tr><th>Ball</th><th>Lancers</th><th>Captures</th><th>Captures/lancer</th></tr></thead>' +
    '<tbody>' + types + '</tbody></table></div>' +
    '<p class="quiet">Les taux observés varient avec les Pokémon ciblés, les choix des joueurs et les rencontres encore ouvertes. Ils ne permettent pas de comparer directement la puissance des Balls. Les identités invité/compte peuvent occasionnellement se recouper.</p>' +
    '</div></details>';
}
module.exports = {renderEconomySection};
