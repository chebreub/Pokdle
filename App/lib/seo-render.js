'use strict';
// One light page per game for search engines (/jeux and /jeux/<slug>): its own title,
// description and text, then a « Jouer » button that opens the game in the app.
// The pages are built once at start-up from lib/seo-games.js; nothing runs per visit.
const { GAMES, GROUPS } = require('./seo-games');

const SITE = String(process.env.SITE_URL || 'https://pokdle.onrender.com').replace(/\/+$/, '');
const SUPPORT_URL = 'https://ko-fi.com/chebreub';
const ARTWORK = id => 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + Number(id) + '.png';
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='white'/%3E%3Cpath d='M2 32a30 30 0 0 1 60 0Z' fill='%23ef4438'/%3E%3Cpath d='M2 32h60' stroke='%231b315f' stroke-width='6'/%3E%3Ccircle cx='32' cy='32' r='9' fill='white' stroke='%231b315f' stroke-width='6'/%3E%3C/svg%3E";
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
.brand img{width:32px;height:32px}
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
  return '<li><a href="/jeux/' + esc(game.slug) + '"><img src="' + esc(ARTWORK(game.sprite)) + '" alt="" width="56" height="56" loading="lazy"><b>' + esc(game.name) + '</b><small>' + esc(game.short) + '</small></a></li>';
}
function layout({ title, description, path, body, data, image = '/og-image.png' }) {
  const url = SITE + path;
  return '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(description) + '">\n<link rel="canonical" href="' + esc(url) + '">\n' +
    '<meta property="og:type" content="website">\n<meta property="og:site_name" content="Pokédle">\n<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(description) + '">\n<meta property="og:url" content="' + esc(url) + '">\n<meta property="og:image" content="' + SITE + esc(image) + '">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:locale" content="fr_FR">\n<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="theme-color" content="#FFF8EF">\n<link rel="icon" type="image/svg+xml" href="' + ICON + '">\n' + FONTS + '<style>' + STYLE + '</style>\n' +
    '<script type="application/ld+json">' + jsonLd(data) + '</script>\n</head>\n<body>\n' +
    '<header class="top"><a class="brand" href="/"><img src="' + ICON + '" alt="" width="32" height="32">Pokédle</a><nav aria-label="Navigation"><a href="/jeux">Tous les jeux</a><a href="/">Jouer</a></nav></header>\n' +
    '<main>\n' + body + '\n</main>\n' +
    '<footer><a class="support" href="' + SUPPORT_URL + '" target="_blank" rel="noopener noreferrer">☕ Soutenir Pokédle</a>' +
    '<p>Pokédle est un projet de fan gratuit, sans publicité, non affilié à Nintendo, Game Freak ou The Pokémon Company. Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.</p>' +
    '<p><a href="/">Accueil</a> · <a href="/jeux">Tous les jeux</a> · <a href="/confidentialite">Confidentialité</a></p></footer>\n</body>\n</html>\n';
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
    '<img src="' + esc(ARTWORK(game.sprite)) + '" alt="" width="180" height="180"></section>\n' +
    '<h2>Comment jouer</h2>\n<div class="panel"><ol>' + game.steps.map(step => '<li>' + esc(step) + '</li>').join('') + '</ol></div>\n' +
    '<h2>Bon à savoir</h2>\n<div class="panel"><ul>' + game.facts.map(fact => '<li>' + esc(fact) + '</li>').join('') + '</ul></div>\n' +
    '<h2>D’autres jeux Pokémon à essayer</h2>\n<ul class="grid">' + related(game).map(cardHtml).join('') + '</ul>\n' +
    '<p><a href="/jeux">Voir les ' + GAMES.length + ' jeux et outils de Pokédle →</a></p>';
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebApplication', name: game.name + ' · Pokédle', url: SITE + path, description: game.description, applicationCategory: game.group === 'tools' ? 'ReferenceApplication' : 'GameApplication', operatingSystem: 'Navigateur web', inLanguage: 'fr', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, image: ARTWORK(game.sprite) },
    breadcrumb([['Pokédle', '/'], ['Jeux', '/jeux'], [game.name, path]]),
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
    '\n<p><a class="cta" href="/">▶ Ouvrir Pokédle</a></p>';
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Tous les jeux Pokémon de Pokédle', url: SITE + '/jeux', inLanguage: 'fr', hasPart: GAMES.map(game => ({ '@type': 'WebPage', name: game.name, url: SITE + '/jeux/' + game.slug })) },
    breadcrumb([['Pokédle', '/'], ['Jeux', '/jeux']]),
  ] };
  return layout({ title: 'Tous les jeux Pokémon gratuits · Pokédle', description: 'Les ' + GAMES.length + ' jeux et outils Pokémon de Pokédle : Pokémon du jour, Grille, Petit Bac, quiz, Qui est-ce, Pokédex et table des types. Gratuit, sans pub.', path: '/jeux', body, data });
}
// Only pages that are their own canonical: /emulateur serves the home page, whose canonical is « / ».
function sitemapXml() {
  const urls = [['/', 'daily', '1.0'], ['/jeux', 'weekly', '0.9'], ...GAMES.map(game => ['/jeux/' + game.slug, 'monthly', game.group === 'daily' ? '0.8' : '0.7']), ['/confidentialite', 'yearly', '0.2']];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([path, freq, priority]) => '  <url>\n    <loc>' + esc(SITE + path) + '</loc>\n    <changefreq>' + freq + '</changefreq>\n    <priority>' + priority + '</priority>\n  </url>').join('\n') + '\n</urlset>\n';
}
function mountSeoPages(app) {
  const pages = new Map(GAMES.map(game => [game.slug, renderGamePage(game)]));
  const hub = renderHubPage(), sitemap = sitemapXml();
  const send = (res, html) => { res.set('Cache-Control', 'public, max-age=3600'); res.type('html').send(html); };
  app.get(['/jeux', '/jeux/'], (_req, res) => send(res, hub));
  app.get('/jeux/:slug', (req, res) => {
    const page = pages.get(String(req.params.slug).toLowerCase());
    if (page) return send(res, page);
    res.redirect(301, '/jeux');
  });
  app.get('/sitemap.xml', (_req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.type('application/xml').send(sitemap); });
}
module.exports = { SITE, renderGamePage, renderHubPage, sitemapXml, mountSeoPages };
