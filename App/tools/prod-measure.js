#!/usr/bin/env node
// V2-OBS-01 (8/11/2026, audit GPT) : mesure du site DÉPLOYÉ, en lecture seule (aucune partie envoyée, aucun compte).
// Usage depuis App/ : node tools/prod-measure.js [https://pokdle.fr] > rapport.json
// Pour chaque appareil (téléphone en 4G simulée, PC) et chaque visite (à froid, puis avec le cache) : version servie,
// octets transférés par type, nombre de requêtes, temps (premier octet, DOMContentLoaded, load, LCP), erreurs JS et
// requêtes en échec ; puis l'ouverture de quelques écrans sans rien envoyer (Pokédex, tous les jeux, Party Room).
const { chromium, devices } = require('playwright');
const BASE = process.argv[2] || 'https://pokdle.fr';
const PROFILES = [
  ['téléphone 4G', { ...devices['iPhone 13'] }, { latency: 70, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 }],
  ['PC', { viewport: { width: 1366, height: 900 } }, null],
];
const SCREENS = [['Pokédex', 'openPokedexMode()'], ['Tous les jeux', 'showScreen("screen-all-modes")'], ['Party Room', 'openPartyRoomMode()']];

async function visit(page, cdp, label) {
  const bytes = {}, failed = [], errors = [];
  let requests = 0;
  const onResp = (resp) => {
    requests++;
    const type = resp.request().resourceType();
    const len = Number(resp.headers()['content-length'] || 0);
    bytes[type] = (bytes[type] || 0) + len;
    if (resp.status() >= 400) failed.push(resp.status() + ' ' + resp.url().slice(0, 120));
  };
  const onFail = (req) => failed.push('ÉCHEC ' + req.url().slice(0, 120));
  const onErr = (e) => errors.push(String(e.message).slice(0, 160));
  page.on('response', onResp); page.on('requestfailed', onFail); page.on('pageerror', onErr);
  // Octets réels reçus (compressés), plus fiables que content-length.
  let wire = 0;
  const onData = (e) => { wire += e.encodedDataLength || 0; };
  cdp.on('Network.loadingFinished', onData);
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const timing = await page.evaluate(() => new Promise((resolve) => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    let lcp = null;
    try { new PerformanceObserver((l) => { const e = l.getEntries(); if (e.length) lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (_) {}
    setTimeout(() => resolve({ ttfb: Math.round(nav.responseStart || 0), dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0), lcp: lcp == null ? null : Math.round(lcp) }), 300);
  }));
  const version = await page.evaluate(() => fetch('/api/version', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.build).catch(() => null));
  const screens = [];
  for (const [name, call] of SCREENS) {
    const s = Date.now();
    const ok = await page.evaluate((c) => { try { if (typeof closeOverlayModal === 'function') closeOverlayModal(); (0, eval)(c); return true; } catch (e) { return String(e.message); } }, call);
    await page.waitForTimeout(800);
    screens.push({ name, ok, ms: Date.now() - s - 800 });
  }
  page.off('response', onResp); page.off('requestfailed', onFail); page.off('pageerror', onErr); cdp.off('Network.loadingFinished', onData);
  return { visit: label, version, wallMs: Date.now() - t0, timing, requests, wireKB: Math.round(wire / 1024), declaredKBByType: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)])), failed, errors, screens };
}

(async () => {
  const browser = await chromium.launch();
  const report = { base: BASE, at: new Date().toISOString(), runs: [] };
  for (const [name, ctxOpts, net] of PROFILES) {
    const ctx = await browser.newContext({ ...ctxOpts, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
    report.runs.push({ device: name, ...(await visit(page, cdp, 'à froid')) });
    report.runs.push({ device: name, ...(await visit(page, cdp, 'avec le cache')) });
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
