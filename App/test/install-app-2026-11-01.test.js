'use strict';
// « 📲 Installer l'appli » and the notifications asked at the right moment (01/11/2026): on iPhone the
// notifications only work from the home-screen icon, and nothing explained it. A window per device,
// a home card from the third day, and « 🔔 Sois prévenu » right after a challenge, +50 XP once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
  pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
};

function load(env = {}) {
  const store = {}, listeners = {}, awarded = [];
  const c = {
    navigator: { userAgent: UA[env.device || 'pc'], platform: env.platform || '', maxTouchPoints: env.touch || 0, standalone: Boolean(env.standalone) },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, matchMedia: () => ({ matches: Boolean(env.standalone) }) },
    document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { search: '' },
    escapeHtml: (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    getDailyDateKey: () => c.today,
    today: '2026-11-01',
    playerProfile: env.profile === undefined ? {} : env.profile,
    awardXp: (amount, source) => awarded.push([amount, source]),
    dailyReminderSupport: () => (env.support === undefined ? 'push' : env.support),
    dailyReminderSaved: () => env.saved || null,
    dailyReminderServer: { ok: true },
    Notification: env.permission === null ? undefined : { permission: env.permission || 'default' },
    showToast() {},
  };
  vm.createContext(c);
  vm.runInContext(read('src/script.10xt.install-app.js'), c);
  return { c, store, listeners, awarded };
}

test('the window shows the steps of the device in hand, and a real button where the browser offers one', () => {
  assert.equal(load({ device: 'iphone' }).c.installPlatform(), 'iphone');
  assert.equal(load({ device: 'pc', platform: 'MacIntel', touch: 5 }).c.installPlatform(), 'iphone', 'an iPad says it is a Mac');
  assert.equal(load({ device: 'android' }).c.installPlatform(), 'android');
  assert.equal(load({ device: 'pc' }).c.installPlatform(), 'pc');

  const { c, listeners } = load({ device: 'android' });
  assert.match(c.installStepsHtml('iphone'), /Partager[\s\S]*Sur l’écran d’accueil[\s\S]*Ajouter/);
  assert.doesNotMatch(c.installStepsHtml('android'), /installAppNow/, 'no button before the browser offers it');
  let prevented = false;
  listeners.beforeinstallprompt({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'the browser prompt is kept for our button');
  assert.match(c.installStepsHtml('android'), /data-action="installAppNow">📲 Installer Pokédle/);
  assert.match(c.installStepsHtml('pc'), /data-action="installAppNow"/);
  assert.doesNotMatch(c.installStepsHtml('iphone'), /installAppNow/, 'Safari has no install prompt');

  assert.match(load({ device: 'iphone' }).c.installWindowHtml('notif'), /les notifications marchent seulement depuis l’icône Pokédle/);
  assert.match(load({ device: 'iphone', standalone: true }).c.installWindowHtml(), /déjà installé/);
});

test('the home card: from the third day with a visit, never once installed, opened or closed', () => {
  const { c, store, listeners } = load({ device: 'iphone' });
  c.today = '2026-11-01'; assert.equal(c.installCardWanted(), false);
  assert.equal(c.installCardWanted(), false, 'the same day counts once');
  c.today = '2026-11-02'; assert.equal(c.installCardWanted(), false);
  c.today = '2026-11-04'; assert.equal(c.installCardWanted(), true);
  c.closeInstallHomeCard();
  assert.equal(store['pokedle.installCard'], 'closed');
  assert.equal(c.installCardWanted(), false);

  const seen = load({ device: 'iphone' });
  seen.store['pokedle.visitDays'] = JSON.stringify(['2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(seen.c.installCardWanted(), true);
  seen.store['pokedle.installCard'] = 'seen';
  assert.equal(seen.c.installCardWanted(), false, 'the window was opened once: no more card');

  const app = load({ device: 'iphone', standalone: true });
  app.store['pokedle.visitDays'] = JSON.stringify(['2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(app.c.installCardWanted(), false, 'already in the app');

  const pc = load({ device: 'pc' });
  pc.store['pokedle.visitDays'] = JSON.stringify(['2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(pc.c.installCardWanted(), false, 'a PC browser with no install prompt: nothing to offer');
  pc.listeners.beforeinstallprompt({ preventDefault() {} });
  assert.equal(pc.c.installCardWanted(), true);
  void listeners;
});

test('« 🔔 Sois prévenu » only where it can work, +50 XP once per account', () => {
  const { c, awarded, store } = load({ profile: { xp: 10 } });
  const html = c.notifAskHtml('Sacha <3', 'sent');
  assert.match(html, /🔔 Sois prévenu quand Sacha &lt;3 répond/, 'the name is escaped');
  assert.match(html, /data-action="openNotifSetup">Activer <i class="notif-ask-xp">\+50 XP<\/i>/);
  assert.match(c.notifAskHtml('', 'list'), /Sois prévenu du prochain défi/);
  c.notifGiveBonus();
  c.notifGiveBonus();
  assert.deepEqual(awarded, [[50, 'Notifications activées']], 'once');
  assert.ok(c.playerProfile.notifXpAt > 0, 'the mark is in the profile: it follows the account');
  assert.doesNotMatch(c.notifAskHtml('Sacha', 'sent'), /\+50 XP/);

  c.notifAskLater();
  assert.ok(Number(store['pokedle.notifAskLater']) > 0);
  assert.equal(c.notifAskHtml('Sacha', 'sent'), '', '« Plus tard »: hidden for 3 days');
  assert.notEqual(c.notifAskHtml('', 'install'), '', 'the install window still offers it');

  assert.equal(load({ permission: 'denied' }).c.notifAskHtml('Sacha', 'sent'), '', 'blocked: nothing to ask');
  assert.equal(load({ permission: 'granted', saved: { hour: 18 } }).c.notifAskHtml('Sacha', 'sent'), '', 'already on');
  assert.equal(load({ support: null, permission: null }).c.notifAskHtml('Sacha', 'sent'), '', 'no push in this browser');
  assert.notEqual(load({ support: 'ios-install', permission: null }).c.notifAskHtml('Sacha', 'sent'), '', 'an iPhone is guided to the home screen');
});

test('wired in: challenges, the reminder, the menu, the settings, the footer, /appli, the Pokédex button', () => {
  assert.match(read('src/script.10xq.player-challenges.js'), /notifAskHtml\(pcForm\.name, 'sent'\)/, 'right after « Défi envoyé »');
  const install = read('src/script.10xt.install-app.js');
  assert.match(install, /pcShowNews = function/);
  assert.match(install, /renderMyChallenges = function/);
  const reminder = read('src/script.10xc.daily-reminder.js');
  assert.match(reminder, /if \(typeof openInstallApp === 'function'\) \{ openInstallApp\('notif'\); return; \}/, 'iPhone: the install window');
  assert.match(reminder, /if \(typeof notifGiveBonus === 'function'\) notifGiveBonus\(\);/, 'the bonus once the subscription is saved');
  const menu = read('src/script.07.delegation-party.js');
  assert.match(menu, /data-args='\["install"\]'><span>📲 Installer l’appli/);
  assert.match(menu, /destination === 'install' && typeof openInstallApp === 'function'\) openInstallApp\(\);/);
  assert.match(menu, /<h4>Appli & notifications<\/h4>/);
  assert.match(read('server.js'), /app\.get\(\["\/appli", "\/application", "\/installer"\], \(_req, res\) => res\.redirect\(302, "\/\?appli=1"\)\);/);
  const dex = read('src/script.04.jeu-pokedex.js');
  assert.match(dex, /return pokedexSelectedShiny \? "Voir le normal" : "✨ Voir le shiny";/);
  assert.doesNotMatch(dex, /pokedexSelectedShiny \? "Shiny" : "Normal"/);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone', 'installable');
});
