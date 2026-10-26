'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const profile = html.slice(html.indexOf('<div id="screen-profile"'), html.indexOf('<div id="screen-achievements"'));

test('the profile reads top to bottom: trainer card, four figures, one row of tabs, then the overview', () => {
  const at = ['id="profile-trainer-card" class="profile-hero"', 'id="profile-key-figures"', 'class="profile-view-switch profile-tabs"', 'class="profile-layout profile-overview"'].map((s) => profile.indexOf(s));
  assert.ok(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1])), String(at));
  const tabs = profile.slice(at[2], profile.indexOf('</div>', at[2]));
  const labels = [...tabs.matchAll(/<button[^>]*data-action="(\w+)"[^>]*>([^<]+)/g)].map((m) => [m[1], m[2].trim()]);
  assert.deepEqual(labels, [
    ['switchProfileView', 'Aperçu'], ['openPokedexCollection', 'Pokédex'], ['switchProfileView', 'Missions'], ['switchProfileView', 'Secrets'],
    ['openMatchHistoryScreen', 'Historique'], ['openGamesRankingMode', 'Mes notes'], ['openRankingMode', 'Favoris'],
  ]);
  // Each number once: no second level card or bar, no separate row of links.
  assert.doesNotMatch(profile, /profile-stats-links|profile-level-card|id="profile-level-bar"/);
  assert.equal((profile.match(/class="profile-stat-card"/g) || []).length, 6);
  // « Modifier mon profil » opens the identity panel; it no longer opens by itself on a computer.
  assert.match(profile, /<details id="profile-identity" class="profile-panel profile-disclosure profile-identity-panel">/);
  const side = profile.slice(profile.indexOf('class="profile-overview-side"'));
  assert.ok(side.indexOf('profile-achievements-panel') < side.indexOf('id="profile-identity"'));
});

test('big numbers get a visible space: 123 368', () => {
  const core = read('src/script.01.core.js');
  const formatNumberFr = Function(core.match(/function formatNumberFr\(value\) \{[\s\S]*?\n\}/)[0] + '; return formatNumberFr;')();
  assert.equal(formatNumberFr(123368), '123 368');
  assert.equal(formatNumberFr(1025), '1 025');
  assert.equal(formatNumberFr(undefined), '0');
});

function heroContext(profileData, stats) {
  const src = read('src/script.07.delegation-party.js');
  const block = src.slice(src.indexOf('// Profile (25/10, proposal A)'), src.indexOf('// « Modifier mon profil »'));
  const core = read('src/script.01.core.js');
  const levels = core.slice(core.indexOf('const XP_MAX_LEVEL'), core.indexOf('const QUEST_POOL'));
  const curve = core.slice(core.indexOf('function xpForLevel('), core.indexOf('// Quests and the login streak change'));
  const els = { 'profile-trainer-card': { className: '', innerHTML: '' }, 'profile-key-figures': { className: '', innerHTML: '' } };
  const env = {
    document: { getElementById: (id) => els[id] || null },
    playerProfile: profileData,
    playerStats: stats,
    POKEMON_BY_ID: new Map([[937, { id: 937, name: 'Malvalame', type1: 'Feu' }]]),
    escapeHtml: (s) => String(s),
    getPokemonSprite: (p) => 'sprite-' + p.id,
    pokedexDetailArtwork: (p) => 'artwork-' + p.id,
    typeSlug: () => 'feu',
    ACHIEVEMENT_DEFS: Array.from({ length: 30 }, (_, i) => ({ id: 'a' + i, title: 'Succès ' + i })),
    unlockedAchievements: Object.fromEntries(Array.from({ length: 25 }, (_, i) => ['a' + i, { unlockedAt: 1 }])),
    pokedexCollectionNationalStats: () => ({ found: 667, total: 1025 }),
    ALBUM_MISSIONS: Array.from({ length: 108 }),
    SECRET_MISSIONS: Array.from({ length: 12 }),
    // « Image de profil » (26/10): no choice made, so the card keeps photo, then partner, then account.
    profileAvatarOptions: () => ({ partner: profileData.favoritePokemonId ? 'sprite-' + profileData.favoritePokemonId : '', photo: profileData.avatarPhoto || '', account: '' }),
    profileAvatarChoice: () => '',
  };
  const names = Object.keys(env);
  const api = Function(...names, levels + curve + block + '; return { renderProfileHero, renderProfileKeyFigures, getXpProgress };')(...names.map((n) => env[n]));
  return { ...api, els };
}

test('the trainer card shows the partner, the title, the Pionnier badge and the way to the next level', () => {
  const data = { xp: 123368, nickname: 'Kayan', favoritePokemonId: 937, pioneerMyth: true, totalQuestsCompleted: 119, albumMissionClaims: { m1: 1, m2: 1 }, secrets: { claimed: Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['s' + i, 1])) } };
  const { renderProfileHero, renderProfileKeyFigures, getXpProgress, els } = heroContext(data, { dailyCurrentStreak: 7 });
  renderProfileHero(getXpProgress(123368), 123368);
  const hero = els['profile-trainer-card'].innerHTML;
  assert.equal(els['profile-trainer-card'].className, 'profile-hero');
  for (const text of ['Kayan', 'Partenaire · Malvalame', '👑 Maître', 'Pionnier · ancien Mythe Pokémon', 'Pokédle du jour : 7 jours d’affilée · 119 quêtes réussies',
    '1 322 XP avant le niveau 71'.replace('1 322', '882'), 'Prochain titre : Légende au niveau 80', '123 368 XP au total', 'Partager ma carte', 'Modifier mon profil']) {
    assert.ok(hero.includes(text), text);
  }
  assert.match(hero, /<img src="artwork-937" alt="Malvalame"[^>]*data-fallback="sprite-937"/);
  assert.match(hero, /data-type="feu"/);
  assert.match(hero, /aria-label="Niveau 70, 75 % vers le niveau suivant"/);
  renderProfileKeyFigures();
  const figures = els['profile-key-figures'].innerHTML;
  assert.match(figures, /Pokédex<\/span>\s*<b>667 <small>\/ 1 025<\/small><\/b>/);
  assert.match(figures, /Missions<\/span>\s*<b>2 <small>\/ 108<\/small><\/b>/);
  assert.match(figures, /class="profile-figure is-complete" data-action="switchProfileView" data-args='\["secrets"\]'>\s*<span>Secrets<\/span>\s*<b>12 <small>\/ 12<\/small>/);
  assert.match(figures, /data-action="openAchievementsScreen">\s*<span>Succès<\/span>\s*<b>25 <small>\/ 30<\/small>/);
});

test('a new player gets an inviting card: no partner yet, no badge, no empty line', () => {
  const { renderProfileHero, getXpProgress, els } = heroContext({ xp: 0 }, {});
  renderProfileHero(getXpProgress(0), 0);
  const hero = els['profile-trainer-card'].innerHTML;
  assert.match(hero, /<button type="button" class="profile-hero-partner" data-action="openProfileEditor">Choisir mon partenaire<\/button>/);
  assert.ok(hero.includes('Dresseur'));
  assert.doesNotMatch(hero, /Pionnier|profile-hero-line/);
  assert.ok(hero.includes('50 XP avant le niveau 2'));
});

test('tabs switch what is under the card; phones hide the card for Missions and Secrets', () => {
  const adventure = read('src/script.10.adventure.js');
  assert.match(adventure, /\.profile-view-switch button\[data-action="switchProfileView"\]/);
  assert.match(adventure, /#screen-profile \.profile-overview, #screen-profile \.profile-management, #profile-secret-rune/);
  assert.match(adventure, /screen\.classList\.toggle\('profile-view-' \+ view, view === selected\)/);
  assert.match(adventure, /Votre lien est au plus haut\. L’aventure continue !/);
  const css = read('trainer-profile.css');
  assert.match(css, /#screen-profile:is\(\.profile-view-album, \.profile-view-secrets\) :is\(\.profile-hero, \.profile-figures\) \{ display: none; \}/);
  // Loaded last, after every older profile rule.
  assert.match(read('build.mjs'), /"halloween\.css", "trainer-profile\.css"\]/);
  assert.match(html, /dist\/halloween\.min\.css">\n {2}<link rel="stylesheet" href="dist\/trainer-profile\.min\.css">/);
});

test('the quests window uses the site colours and a level ring instead of a pink banner', () => {
  const core = read('src/script.01.core.js');
  assert.match(core, /<span class="dq-hero-ring" style="--dq-ring:\$\{prog\.percent\}%"><b>\$\{prog\.tier\.level\}<\/b><\/span>/);
  assert.match(core, /\$\{formatNumberFr\(prog\.next\.minXp - xp\)\} XP avant le niveau \$\{prog\.next\.level\}/);
  // The close cross sits inside the level card, so nothing can cover it.
  assert.match(core, /<div class="dq-hero">\s*<button class="dq-close" type="button" data-action="closeDailyQuestsModal" aria-label="Fermer">/);
  const css = read('trainer-profile.css');
  assert.match(css, /\.daily-quests-overlay \.dq-hero::before \{ display: none; \}/);
  assert.match(css, /\.daily-quests-overlay \.dq-xp \{ background: #fff1cc;/);
});
