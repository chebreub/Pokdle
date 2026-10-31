'use strict';
// One light page per game for search engines (/jeux and /jeux/<slug>): its own title,
// description and text, then a « Jouer » button that opens the game in the app.
// The pages are built once at start-up from lib/seo-games.js; nothing runs per visit.
const fs = require('fs');
const path = require('path');
const { GAMES, GROUPS } = require('./seo-games');
const { GUIDES, TYPE_CHART, TYPE_ICONS, PUBLISHED, GENERATIONS, STARTERS, LEGENDARIES, MYTHICALS } = require('./seo-guides');
const { SITE_URL: SITE } = require('./site-move');

const SUPPORT_URL = 'https://ko-fi.com/chebreub';
const ARTWORK = id => 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + Number(id) + '.png';
// French names for the alt text of each game's illustration, read from pokemon.js like server.js does.
const POKEMON_LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
const POKEMON_NAMES = new Map(POKEMON_LIST.map(pokemon => [pokemon.id, pokemon.name]));
const POKEMON_BY_ID = new Map(POKEMON_LIST.filter(pokemon => !pokemon.isAltForm).map(pokemon => [pokemon.id, pokemon]));
const pokemonName = id => POKEMON_NAMES.get(Number(id)) || 'Pokémon';
const ICON_LINKS = '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n';
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;700;800;900&display=swap">\n';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// JSON inside <script type="application/ld+json">: no way out of the tag.
const jsonLd = data => JSON.stringify(data).replace(/</g, '\\u003c');

const STYLE = `
:root{--ink:#2e2a33;--muted:#776b63;--line:#e9dfd4;--soft:#fffaf3;--card:#fff;--bg:#fdf8f2;--accent:#2f51b8;--cta:#4069e0}
@media (prefers-color-scheme:dark){:root{--ink:#edf3fe;--muted:#a5b5ce;--line:#30415c;--soft:#1b2a40;--card:#1e2c43;--bg:#142033;--accent:#a9bdf7;--cta:#5b7ff0}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Nunito,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:960px;margin:0 auto;padding:16px}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font:700 1.3rem Fredoka,Nunito,system-ui,sans-serif}
.brand::before{content:"";width:32px;height:32px;background:url(/favicon.svg) center/contain no-repeat}
.top nav{display:flex;gap:14px;font-weight:800;font-size:.95rem}
.top nav a{text-decoration:none}
main{max-width:960px;margin:0 auto;padding:8px 16px 48px}
.crumbs{font-size:.85rem;color:var(--muted);margin:0 0 12px}
.crumbs a{color:var(--muted)}
.hero{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:24px;border:1px solid var(--line);border-radius:28px;background:var(--card)}
.hero img{width:180px;height:180px;object-fit:contain}
.kicker{margin:0;font-size:.75rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
h1{margin:6px 0 8px;font:600 clamp(1.7rem,4.5vw,2.4rem)/1.15 Fredoka,Nunito,system-ui,sans-serif}
h2{margin:32px 0 10px;font:600 1.3rem/1.3 Fredoka,Nunito,system-ui,sans-serif}
.lead{margin:0 0 18px;color:var(--muted);font-size:1.05rem}
.cta{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:12px 22px;border-radius:999px;background:var(--cta);color:#fff;font-weight:900;text-decoration:none;box-shadow:0 6px 16px rgba(64,105,224,.28)}
.cta:hover,.cta:focus-visible{filter:brightness(1.07)}
.free{display:block;margin-top:10px;font-size:.85rem;color:var(--muted)}
ol,ul{padding-left:1.3em}
li{margin:6px 0}
.panel{padding:6px 20px 14px;border:1px solid var(--line);border-radius:22px;background:var(--soft)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:0;list-style:none}
.grid li{margin:0}
.grid a{display:grid;grid-template-columns:56px 1fr;gap:4px 12px;align-items:center;height:100%;padding:12px 14px;border:1px solid var(--line);border-radius:18px;background:var(--card);color:var(--ink);text-decoration:none}
.grid a:hover,.grid a:focus-visible{border-color:var(--accent)}
.grid img{grid-row:span 2;width:56px;height:56px;object-fit:contain}
.grid b{font:600 1.05rem Fredoka,Nunito,system-ui,sans-serif}
.grid small{color:var(--muted);font-size:.85rem;line-height:1.35}
.faq h3{margin:14px 0 4px;font:700 1.02rem/1.35 Nunito,system-ui,sans-serif}
.faq p{margin:0 0 6px}
.guide p{margin:0 0 12px}
.table-wrap{border:1px solid var(--line);border-radius:22px;background:var(--soft);overflow:hidden}
table.types{width:100%;border-collapse:collapse;font-size:.92rem}
table.types th,table.types td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
table.types tr:last-child td{border-bottom:0}
table.types th{font-weight:900;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
table.types tbody th{font-size:1rem;text-transform:none;letter-spacing:0;color:var(--ink);white-space:nowrap}
.type{display:inline-flex;align-items:center;gap:4px;margin:2px 6px 2px 0;font-weight:800;white-space:nowrap}
.type img{width:18px;height:18px}
table.types td small{display:block;color:var(--muted);font-size:.82rem}
.mon{display:inline-flex;align-items:center;gap:6px;font-weight:800}
.mon img{width:40px;height:40px;object-fit:contain}
.mons{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;padding:0;margin:8px 0 16px;list-style:none}
.mons li{margin:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border:1px solid var(--line);border-radius:16px;background:var(--card);text-align:center;font-weight:800;font-size:.88rem}
.mons img{width:72px;height:72px;object-fit:contain}
.mons small{color:var(--muted);font-weight:700;font-size:.75rem}
h3.gen{margin:18px 0 4px;font:600 1.05rem Fredoka,Nunito,system-ui,sans-serif}
@media (max-width:640px){table.types thead{display:none}table.types tr{display:block;padding:8px 4px;border-bottom:1px solid var(--line)}table.types tr:last-child{border-bottom:0}table.types th[scope=row]{display:block;padding:6px 12px 2px;font-size:1.05rem}table.types td{display:block;border:0;padding:4px 12px}table.types td[data-label]::before{content:attr(data-label);display:block;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}}
footer{max-width:960px;margin:0 auto;padding:24px 16px 40px;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
footer p{margin:4px 0}
.support{display:inline-block;margin:6px 0 10px;padding:6px 14px;border:1px solid #f0c9a0;border-radius:999px;background:#fff1e0;color:#7a4210;font-weight:800;text-decoration:none}
@media (max-width:640px){.hero{grid-template-columns:1fr;text-align:center;padding:20px 16px}.hero img{order:-1;width:140px;height:140px;margin:0 auto}.top nav{gap:10px;font-size:.9rem}}
`;

const BY_SLUG = new Map(GAMES.map(game => [game.slug, game]));
function related(game) {
  const same = GAMES.filter(other => other.group === game.group && other.slug !== game.slug);
  const picks = (game.related || []).map(slug => BY_SLUG.get(slug)).filter(Boolean);
  return [...new Set([...picks, ...same])].slice(0, 4);
}
function cardHtml(game) {
  return '<li><a href="/jeux/' + esc(game.slug) + '"><img src="' + esc(ARTWORK(game.sprite)) + '" alt="' + esc(pokemonName(game.sprite)) + '" width="56" height="56" loading="lazy"><b>' + esc(game.name) + '</b><small>' + esc(game.short) + '</small></a></li>';
}
function guideCardHtml(guide) {
  return '<li><a href="/guides/' + esc(guide.slug) + '"><img src="' + esc(ARTWORK(guide.sprite)) + '" alt="' + esc(pokemonName(guide.sprite)) + '" width="56" height="56" loading="lazy"><b>' + esc(guide.name) + '</b><small>' + esc(guide.short) + '</small></a></li>';
}
const guidesFor = (slug) => GUIDES.filter(guide => guide.games.includes(slug));
function layout({ title, description, path, body, data, image = '/og-image.png' }) {
  const url = SITE + path;
  return '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(description) + '">\n<link rel="canonical" href="' + esc(url) + '">\n' +
    '<meta property="og:type" content="website">\n<meta property="og:site_name" content="Pokédle">\n<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(description) + '">\n<meta property="og:url" content="' + esc(url) + '">\n<meta property="og:image" content="' + SITE + esc(image) + '">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:locale" content="fr_FR">\n<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="theme-color" content="#FFF8EF">\n' + ICON_LINKS + FONTS + '<style>' + STYLE + '</style>\n' +
    '<script type="application/ld+json">' + jsonLd(data) + '</script>\n</head>\n<body>\n' +
    '<header class="top"><a class="brand" href="/">Pokédle</a><nav aria-label="Navigation"><a href="/jeux">Tous les jeux</a><a href="/guides">Guides</a><a href="/">Jouer</a></nav></header>\n' +
    '<main>\n' + body + '\n</main>\n' +
    '<footer><a class="support" href="' + SUPPORT_URL + '" target="_blank" rel="noopener noreferrer">☕ Soutenir Pokédle</a>' +
    '<p>Pokédle est un projet de fan gratuit, sans publicité, non affilié à Nintendo, Game Freak ou The Pokémon Company. Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.</p>' +
    '<p><a href="/">Accueil</a> · <a href="/jeux">Tous les jeux</a> · <a href="/guides">Guides</a> · <a href="/a-propos">À propos</a> · <a href="/confidentialite">Confidentialité</a></p></footer>\n</body>\n</html>\n';
}
function breadcrumb(items) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })) };
}
function renderGamePage(game) {
  const path = '/jeux/' + game.slug;
  const group = GROUPS[game.group];
  const body =
    '<p class="crumbs"><a href="/">Pokédle</a> › <a href="/jeux">Jeux</a> › ' + esc(game.name) + '</p>\n' +
    '<section class="hero"><div><p class="kicker">' + esc(group.kicker) + '</p><h1>' + esc(game.h1) + '</h1><p class="lead">' + esc(game.lead) + '</p>' +
    '<a class="cta" href="/?jeu=' + esc(game.slug) + '">▶ ' + esc(game.cta || 'Jouer à ' + game.name) + '</a><span class="free">Gratuit, sans pub, sans inscription.</span></div>' +
    '<img src="' + esc(ARTWORK(game.sprite)) + '" alt="' + esc(pokemonName(game.sprite) + ', illustration du jeu ' + game.name) + '" width="180" height="180"></section>\n' +
    '<h2>Comment jouer</h2>\n<div class="panel"><ol>' + game.steps.map(step => '<li>' + esc(step) + '</li>').join('') + '</ol></div>\n' +
    '<h2>Bon à savoir</h2>\n<div class="panel"><ul>' + game.facts.map(fact => '<li>' + esc(fact) + '</li>').join('') + '</ul></div>\n' +
    (game.tips?.length ? '<h2>Astuces</h2>\n<div class="panel"><ul>' + game.tips.map(tip => '<li>' + esc(tip) + '</li>').join('') + '</ul></div>\n' : '') +
    (game.faq?.length ? '<h2>Questions fréquentes</h2>\n<div class="panel faq">' + game.faq.map(([question, answer]) => '<h3>' + esc(question) + '</h3><p>' + esc(answer) + '</p>').join('') + '</div>\n' : '') +
    (guidesFor(game.slug).length ? '<h2>' + (guidesFor(game.slug).length > 1 ? 'Les guides pour progresser' : 'Le guide pour progresser') + '</h2>\n<ul class="grid">' + guidesFor(game.slug).map(guideCardHtml).join('') + '</ul>\n' : '') +
    '<h2>D’autres jeux Pokémon à essayer</h2>\n<ul class="grid">' + related(game).map(cardHtml).join('') + '</ul>\n' +
    '<p><a href="/jeux">Voir les ' + GAMES.length + ' jeux et outils de Pokédle →</a></p>';
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebApplication', name: game.name + ' · Pokédle', url: SITE + path, description: game.description, applicationCategory: game.group === 'tools' ? 'ReferenceApplication' : 'GameApplication', operatingSystem: 'Navigateur web', inLanguage: 'fr', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, image: ARTWORK(game.sprite) },
    breadcrumb([['Pokédle', '/'], ['Jeux', '/jeux'], [game.name, path]]),
    // The questions shown on the page, for search engines and assistants (31/10/2026).
    ...(game.faq?.length ? [{ '@type': 'FAQPage', mainEntity: game.faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }] : []),
  ] };
  // Each game page shows its own link preview (tools/og-game-images.js builds them).
  return layout({ title: game.title, description: game.description, path, body, data, image: game.ogImage || '/img/og/' + game.slug + '.jpg' });
}
function renderHubPage() {
  const body =
    '<p class="crumbs"><a href="/">Pokédle</a> › Jeux</p>\n' +
    '<h1>Tous les jeux Pokémon de Pokédle</h1>\n<p class="lead">Devine le Pokémon du jour, résous la Grille, joue au Petit Bac avec tes amis ou teste tes connaissances en quiz. Tous les jeux sont gratuits, sans pub, et se jouent dans le navigateur, sur téléphone comme sur ordinateur.</p>\n' +
    Object.entries(GROUPS).map(([key, group]) => {
      const games = GAMES.filter(game => game.group === key);
      return games.length ? '<h2>' + esc(group.title) + '</h2>\n<ul class="grid">' + games.map(cardHtml).join('') + '</ul>' : '';
    }).join('\n') +
    '\n<h2>Guides</h2>\n<ul class="grid">' + GUIDES.map(guideCardHtml).join('') + '</ul>' +
    '\n<p><a class="cta" href="/">▶ Ouvrir Pokédle</a></p>';
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Tous les jeux Pokémon de Pokédle', url: SITE + '/jeux', inLanguage: 'fr', hasPart: GAMES.map(game => ({ '@type': 'WebPage', name: game.name, url: SITE + '/jeux/' + game.slug })) },
    breadcrumb([['Pokédle', '/'], ['Jeux', '/jeux']]),
  ] };
  return layout({ title: 'Tous les jeux Pokémon gratuits · Pokédle', description: 'Les ' + GAMES.length + ' jeux et outils Pokémon de Pokédle : Pokémon du jour, Grille, Petit Bac, quiz, Qui est-ce, Pokédex et table des types. Gratuit, sans pub.', path: '/jeux', body, data });
}
// The guides (31/10/2026): one long page per question players search for, then the game.
const typeChip = (type) => '<span class="type"><img src="/img/type-icons/' + esc(TYPE_ICONS[type]) + '.svg" alt="" width="18" height="18">' + esc(type) + '</span>';
function typeTableHtml() {
  const cell = (label, types) => '<td data-label="' + esc(label) + '">' + (types.length ? types.map(typeChip).join('') : '—') + '</td>';
  return '<div class="table-wrap"><table class="types"><thead><tr><th scope="col">Type de l’attaque</th><th scope="col">Super efficace (×2) contre</th><th scope="col">Pas très efficace (×½) contre</th><th scope="col">Aucun effet sur</th></tr></thead><tbody>' +
    Object.entries(TYPE_CHART).map(([type, row]) => '<tr><th scope="row">' + typeChip(type) + '</th>' + cell('Super efficace (×2) contre', row.super) + cell('Pas très efficace (×½) contre', row.not) + cell('Aucun effet sur', row.no) + '</tr>').join('') +
    '</tbody></table></div>';
}
const monName = (id) => esc(POKEMON_NAMES.get(Number(id)) || 'Pokémon');
const monTypes = (id) => { const p = POKEMON_BY_ID.get(Number(id)); return p ? [p.type1, p.type2].filter(Boolean).join(' et ') : ''; };
const monImg = (id, size) => '<img src="' + esc(ARTWORK(id)) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy">';
function monsHtml(ids) {
  return '<ul class="mons">' + ids.map(id => '<li>' + monImg(id, 72) + monName(id) + '<small>n° ' + Number(id) + '</small></li>').join('') + '</ul>';
}
function generationsTableHtml() {
  const head = ['Génération', 'Région', 'Premiers jeux', 'Sortie', 'Nouveaux Pokémon', 'Numéros'];
  return '<div class="table-wrap"><table class="types"><thead><tr>' + head.map(h => '<th scope="col">' + h + '</th>').join('') + '</tr></thead><tbody>' +
    GENERATIONS.map(g => '<tr><th scope="row">' + g.gen + '<sup>' + (g.gen === 1 ? 're' : 'e') + '</sup> génération</th>' +
      '<td data-label="Région">' + esc(g.region) + '</td><td data-label="Premiers jeux">' + esc(g.games) + '</td><td data-label="Sortie">' + g.year + '</td>' +
      '<td data-label="Nouveaux Pokémon">' + (g.to - g.from + 1) + '</td><td data-label="Numéros">' + g.from + ' à ' + g.to + '</td></tr>').join('') +
    '</tbody></table></div>';
}
function startersTableHtml() {
  const cell = (label, id) => '<td data-label="' + label + '"><span class="mon">' + monImg(id, 40) + monName(id) + '</span><small>' + esc(monTypes(id)) + ' · évolue en ' + monName(id + 2) + ' (' + esc(monTypes(id + 2)) + ')</small></td>';
  return '<div class="table-wrap"><table class="types"><thead><tr><th scope="col">Génération</th><th scope="col">Plante</th><th scope="col">Feu</th><th scope="col">Eau</th></tr></thead><tbody>' +
    STARTERS.map((ids, i) => '<tr><th scope="row">' + (i + 1) + '<sup>' + (i ? 'e' : 're') + '</sup> · ' + esc(GENERATIONS[i].region) + '</th>' +
      cell('Plante', ids[0]) + cell('Feu', ids[1]) + cell('Eau', ids[2]) + '</tr>').join('') + '</tbody></table></div>';
}
function legendariesHtml() {
  return Object.entries(LEGENDARIES).map(([gen, ids]) => '<h3 class="gen">' + gen + '<sup>' + (gen === '1' ? 're' : 'e') + '</sup> génération · ' + esc(GENERATIONS[gen - 1].region) + ' · ' + ids.length + ' légendaire' + (ids.length > 1 ? 's' : '') + '</h3>' + monsHtml(ids)).join('');
}
function renderGuidePage(guide) {
  const path = '/guides/' + guide.slug;
  const sections = guide.sections.map(section => '<h2>' + esc(section.h2) + '</h2>\n' +
    (section.p || []).map(text => '<p>' + esc(text) + '</p>').join('') +
    (section.list ? '<div class="panel"><ul>' + section.list.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul></div>' : '') +
    (section.table === 'types' ? typeTableHtml() : section.table === 'generations' ? generationsTableHtml() : section.table === 'starters' ? startersTableHtml() : '') +
    (section.legendaries ? legendariesHtml() : '') + (section.pokemon === 'mythicals' ? monsHtml(MYTHICALS) : '')).join('\n');
  const games = guide.games.map(slug => BY_SLUG.get(slug)).filter(Boolean);
  const body =
    '<p class="crumbs"><a href="/">Pokédle</a> › <a href="/guides">Guides</a> › ' + esc(guide.name) + '</p>\n' +
    '<section class="hero"><div><p class="kicker">Guide</p><h1>' + esc(guide.h1) + '</h1><p class="lead">' + esc(guide.lead) + '</p>' +
    '<a class="cta" href="' + esc(guide.cta.href) + '">▶ ' + esc(guide.cta.label) + '</a><span class="free">Gratuit, sans pub, sans inscription.</span></div>' +
    '<img src="' + esc(ARTWORK(guide.sprite)) + '" alt="' + esc(pokemonName(guide.sprite) + ', illustration du guide') + '" width="180" height="180"></section>\n' +
    '<div class="guide">' + sections + '</div>\n' +
    (guide.faq?.length ? '<h2>Questions fréquentes</h2>\n<div class="panel faq">' + guide.faq.map(([question, answer]) => '<h3>' + esc(question) + '</h3><p>' + esc(answer) + '</p>').join('') + '</div>\n' : '') +
    '<h2>Pour t’entraîner</h2>\n<ul class="grid">' + games.map(cardHtml).join('') + '</ul>\n' +
    '<p><a href="/guides">Tous les guides →</a></p>';
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: guide.h1, description: guide.description, inLanguage: 'fr', url: SITE + path, mainEntityOfPage: SITE + path, image: ARTWORK(guide.sprite),
      datePublished: PUBLISHED, dateModified: PUBLISHED, author: { '@type': 'Organization', name: 'Pokédle', url: SITE + '/' }, publisher: { '@type': 'Organization', name: 'Pokédle', url: SITE + '/' } },
    breadcrumb([['Pokédle', '/'], ['Guides', '/guides'], [guide.name, path]]),
    ...(guide.faq?.length ? [{ '@type': 'FAQPage', mainEntity: guide.faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }] : []),
  ] };
  return layout({ title: guide.title, description: guide.description, path, body, data, image: guide.ogImage });
}
function renderGuidesHub() {
  const body =
    '<p class="crumbs"><a href="/">Pokédle</a> › Guides</p>\n' +
    '<h1>Guides Pokémon</h1>\n<p class="lead">Des guides simples pour progresser : la méthode du Pokémon du jour, la table des types… et un bouton pour t’entraîner tout de suite.</p>\n' +
    '<ul class="grid">' + GUIDES.map(guideCardHtml).join('') + '</ul>\n' +
    '<p><a href="/jeux">Voir tous les jeux →</a></p>';
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Guides Pokémon · Pokédle', url: SITE + '/guides', inLanguage: 'fr', hasPart: GUIDES.map(guide => ({ '@type': 'Article', headline: guide.h1, url: SITE + '/guides/' + guide.slug })) },
    breadcrumb([['Pokédle', '/'], ['Guides', '/guides']]),
  ] };
  return layout({ title: 'Guides Pokémon : méthodes et astuces | Pokédle', description: 'Des guides Pokémon simples et gratuits : la méthode pour trouver le Pokémon du jour, la table des types expliquée, et des jeux pour t’entraîner.', path: '/guides', body, data });
}
// What Pokédle is, who makes it and how to reach them: the page assistants and search engines
// read to explain the site. No postal address or phone: it is a fan project, not a company.
const CONTACT_EMAIL = 'chebreub@gmail.com';
function renderAboutPage() {
  const groups = Object.entries(GROUPS).map(([key, group]) => {
    const games = GAMES.filter(game => game.group === key);
    return games.length ? '<li><b>' + esc(group.title) + '</b> : ' + games.map(game => '<a href="/jeux/' + esc(game.slug) + '">' + esc(game.name) + '</a>').join(', ') + '.</li>' : '';
  }).join('');
  const body =
    '<p class="crumbs"><a href="/">Pokédle</a> › À propos</p>\n' +
    '<h1>À propos de Pokédle</h1>\n<p class="lead">Pokédle est un site de jeux Pokémon gratuits, en français. Chaque jour, un Pokémon mystère à deviner, et à côté plus de 20 mini-jeux à jouer seul ou entre amis, sur téléphone comme sur ordinateur.</p>\n' +
    '<p><a class="cta" href="/?jeu=pokemon-du-jour">▶ Jouer au Pokémon du jour</a></p>\n' +
    '<h2>Ce que tu trouves sur Pokédle</h2>\n<div class="panel"><ul>' + groups + '</ul></div>\n' +
    '<p><a href="/jeux">Voir les ' + GAMES.length + ' jeux et outils →</a></p>\n' +
    '<h2>Gratuit, sans pub, sans inscription</h2>\n<div class="panel"><ul>' +
    '<li>Tous les jeux sont gratuits et sans publicité. Il n’y a rien à acheter.</li>' +
    '<li>Tu peux jouer sans compte : ta progression reste alors sur ton appareil.</li>' +
    '<li>Un compte Discord, Google ou Twitch sert seulement à retrouver ta progression partout et à apparaître dans les classements.</li>' +
    '<li>Si tu veux aider le site, tu peux le <a href="' + SUPPORT_URL + '" target="_blank" rel="noopener noreferrer">soutenir sur Ko-fi</a>. C’est facultatif.</li></ul></div>\n' +
    '<h2>Qui fait Pokédle ?</h2>\n' +
    '<p>Pokédle est un projet de fan, créé et entretenu par un passionné de Pokémon, sur son temps libre. Tes idées sont les bienvenues : elles aident à choisir les prochaines nouveautés.</p>\n' +
    '<p>Pokédle n’est pas affilié à Nintendo, Game Freak, Creatures ou The Pokémon Company. Pokémon et les noms des Pokémon sont des marques de leurs propriétaires. Les données et les images des Pokémon viennent de <a href="https://pokeapi.co" target="_blank" rel="noreferrer">PokéAPI</a>.</p>\n' +
    '<h2 id="contact">Contact</h2>\n<div class="panel"><ul>' +
    '<li><b>Une idée, un bug, un avis ?</b> Le plus simple : <a href="/?avis">Donne ton avis</a>, le bouton en bas de chaque page du jeu. Chaque message est lu.</li>' +
    '<li><b>Une question sur tes données, ou une autre demande ?</b> Écris à <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>.</li>' +
    '<li>Ce que Pokédle garde sur toi, et comment l’effacer : <a href="/confidentialite">Confidentialité</a>.</li></ul></div>';
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'AboutPage', name: 'À propos de Pokédle', url: SITE + '/a-propos', inLanguage: 'fr', mainEntity: { '@id': SITE + '/#jeu' } },
    { '@type': ['WebApplication', 'VideoGame'], '@id': SITE + '/#jeu', name: 'Pokédle', url: SITE + '/', applicationCategory: 'GameApplication', operatingSystem: 'Navigateur web', inLanguage: 'fr', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } },
    breadcrumb([['Pokédle', '/'], ['À propos', '/a-propos']]),
  ] };
  return layout({ title: 'À propos de Pokédle · jeux Pokémon gratuits', description: 'Pokédle, c’est quoi ? Des jeux Pokémon gratuits en français : le Pokémon du jour et plus de 20 mini-jeux, sans pub. Qui le fait et comment le contacter.', path: '/a-propos', body, data });
}
// Only pages that are their own canonical: /emulateur serves the home page, whose canonical is « / ».
function sitemapXml() {
  const urls = [['/', 'daily', '1.0'], ['/jeux', 'weekly', '0.9'], ...GAMES.map(game => ['/jeux/' + game.slug, 'monthly', game.group === 'daily' ? '0.8' : '0.7']), ['/guides', 'weekly', '0.6'], ...GUIDES.map(guide => ['/guides/' + guide.slug, 'monthly', '0.7']), ['/a-propos', 'yearly', '0.3'], ['/confidentialite', 'yearly', '0.2']];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([path, freq, priority]) => '  <url>\n    <loc>' + esc(SITE + path) + '</loc>\n    <changefreq>' + freq + '</changefreq>\n    <priority>' + priority + '</priority>\n  </url>').join('\n') + '\n</urlset>\n';
}
function mountSeoPages(app) {
  const pages = new Map(GAMES.map(game => [game.slug, renderGamePage(game)]));
  const hub = renderHubPage(), about = renderAboutPage(), sitemap = sitemapXml();
  const send = (res, html) => { res.set('Cache-Control', 'public, max-age=3600'); res.type('html').send(html); };
  app.get(['/jeux', '/jeux/'], (_req, res) => send(res, hub));
  app.get('/jeux/:slug', (req, res) => {
    const page = pages.get(String(req.params.slug).toLowerCase());
    if (page) return send(res, page);
    res.redirect(301, '/jeux');
  });
  const guides = new Map(GUIDES.map(guide => [guide.slug, renderGuidePage(guide)])), guidesHub = renderGuidesHub();
  app.get(['/guides', '/guides/'], (_req, res) => send(res, guidesHub));
  app.get('/guides/:slug', (req, res) => {
    const page = guides.get(String(req.params.slug).toLowerCase());
    if (page) return send(res, page);
    res.redirect(301, '/guides');
  });
  app.get('/a-propos', (_req, res) => send(res, about));
  // The English addresses assistants and scanners try first.
  app.get('/about', (_req, res) => res.redirect(301, '/a-propos'));
  app.get('/contact', (_req, res) => res.redirect(301, '/a-propos#contact'));
  app.get('/privacy', (_req, res) => res.redirect(301, '/confidentialite'));
  app.get('/sitemap.xml', (_req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.type('application/xml').send(sitemap); });
}
module.exports = { SITE, renderGamePage, renderHubPage, renderAboutPage, renderGuidePage, renderGuidesHub, sitemapXml, mountSeoPages };
