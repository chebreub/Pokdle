"use strict";

// The move from pokdle.onrender.com to pokdle.fr, without losing players or search engines.
// 1. Old address: every page answers 301 to the same page on the new address. /api, /socket.io
//    and the transfer page stay, so a tab that is still open keeps working.
// 2. A player's progress lives in the browser (localStorage) and in cookies, both tied to the
//    address. A browser that opens the home page of the old address comes to the new one with
//    ?depuis=onrender. The new address sends it once to /transfert on the old address with a
//    secret (nonce) also kept in a cookie, the old page hands its progress to the server for a
//    one-time token, and comes back with ?transfert=<token>.
// 3. Back on the new address, the server checks the token against the nonce cookie, sets the
//    session and daily cookies the browser does not have yet here, and puts the saved progress
//    in the page; src/script.00.transfert.js stores it before the app reads it.
// Search engines (no Sec-Fetch-Mode header) only see the plain 301.
const crypto = require("crypto");
const path = require("path");

const MARK = "onrender";
const NONCE_COOKIE = "pokdle_transfert_nonce";
const DONE_COOKIE = "pokdle_transfert";
// Cookies that follow the player: account session, daily games and weekly egg (guest ids).
const MOVED_COOKIES = Object.freeze({ pokdle_session: 30 * 86400000, pokdle_daily: 180 * 86400000, pokdle_egg: 180 * 86400000 });
const TOKEN_TTL = 15 * 60000;
const MAX_ENTRIES = 500;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_KEYS = 300;
const PER_ADDRESS = 20;
const KEY = /^[A-Za-z0-9_.:-]{1,80}$/;
const NONCE = /^[A-Za-z0-9_-]{20,64}$/;

const origin = (url) => String(url).replace(/\/+$/, "");
// The site's address: canonical links, sitemap, previews and the target of the redirect.
const SITE_URL = origin(process.env.SITE_URL || "https://pokdle.fr");
function parseCookies(req) {
  const out = Object.create(null);
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > -1) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_error) { /* skip a malformed cookie */ } }
  }
  return out;
}
function sameValue(a, b) {
  const left = Buffer.from(String(a)), right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
// The page path and query without our own parameters, never another site (« //evil »).
function cleanPath(req, drop) {
  const url = new URL(req.originalUrl, "http://x");
  for (const name of drop) url.searchParams.delete(name);
  return (url.pathname.startsWith("//") ? "/" : url.pathname) + url.search;
}

function createSiteMove({
  siteUrl = SITE_URL,
  legacyOrigin = process.env.LEGACY_ORIGIN || "https://pokdle.onrender.com",
  legacyHosts,
  readCookies = parseCookies,
  now = () => Date.now(),
} = {}) {
  const site = origin(siteUrl), legacy = origin(legacyOrigin);
  const hosts = new Set((legacyHosts || [new URL(legacy).host, "www." + new URL(site).host]).map((host) => host.toLowerCase()));
  hosts.delete(new URL(site).host);
  const store = new Map(), sent = new Map();
  let storedBytes = 0;
  // At most PER_ADDRESS transfers per address in TOKEN_TTL, so a flood cannot fill the store.
  const limited = (ip) => {
    const list = (sent.get(ip) || []).filter((at) => now() - at < TOKEN_TTL);
    if (list.length >= PER_ADDRESS) return true;
    list.push(now());
    sent.set(ip, list);
    if (sent.size > 5000) sent.clear();
    return false;
  };
  const drop = (token) => { const entry = store.get(token); if (entry) { storedBytes -= entry.bytes; store.delete(token); } return entry; };
  const prune = () => { for (const [token, entry] of store) if (entry.expires <= now()) drop(token); };
  const isLegacy = (req) => hosts.has(String(req.get("host") || "").toLowerCase());
  const cookieOptions = (req, maxAge) => ({ httpOnly: true, secure: req.secure, sameSite: "lax", path: "/", maxAge });

  // 1 and 2, before every other route.
  function middleware(req, res, next) {
    if (isLegacy(req)) {
      const exempt = req.path === "/transfert" || req.path === "/transfert.js" || req.path.startsWith("/api/") || req.path.startsWith("/socket.io/") || /^\/google[0-9a-f]+\.html$/.test(req.path);
      if (exempt || (req.method !== "GET" && req.method !== "HEAD")) return next();
      let target = site + req.originalUrl;
      const home = req.path === "/" || req.path === "/index.html";
      if (home && req.method === "GET" && req.get("sec-fetch-mode") === "navigate") {
        target = site + cleanPath(req, ["depuis"]).replace(/^\/index\.html/, "/");
        target += (target.includes("?") ? "&" : "?") + "depuis=" + MARK;
      }
      return res.redirect(301, target);
    }
    if (req.method === "GET" && req.path === "/" && req.query.depuis === MARK) {
      res.set("Cache-Control", "no-store");
      const back = cleanPath(req, ["depuis"]);
      if (readCookies(req)[DONE_COOKIE]) return res.redirect(302, back);
      const nonce = crypto.randomBytes(24).toString("base64url");
      res.cookie(NONCE_COOKIE, nonce, cookieOptions(req, TOKEN_TTL));
      return res.redirect(302, legacy + "/transfert?n=" + nonce + "&retour=" + encodeURIComponent(back));
    }
    next();
  }

  // The old address's page: its script reads this browser's progress there.
  function transferPage(_req, res) {
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
    res.type("html").send(`<!doctype html><html lang="fr" data-site="${site}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Pokédle déménage</title><script src="/transfert.js" defer></script></head>` +
      `<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fdf8f2;color:#2e2a33;font:16px system-ui,sans-serif"><p>Pokédle déménage sur pokdle.fr, on emporte ta progression…</p></body></html>`);
  }

  // POST on the old address: keeps the progress for a one-time token.
  function receive(req, res) {
    res.set("Cache-Control", "no-store");
    let sameSite = true;
    try { sameSite = !req.get("origin") || new URL(req.get("origin")).host === req.get("host"); } catch (_error) { sameSite = false; }
    if (!sameSite) return res.status(403).json({ ok: false, error: "origin_denied" });
    const { nonce, data } = req.body || {};
    if (!NONCE.test(String(nonce || "")) || !data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ ok: false, error: "invalid" });
    const entries = Object.entries(data).filter(([key, value]) => KEY.test(key) && typeof value === "string");
    if (entries.length > MAX_KEYS) return res.status(400).json({ ok: false, error: "invalid" });
    const cookies = readCookies(req);
    const moved = Object.fromEntries(Object.keys(MOVED_COOKIES).filter((name) => cookies[name]).map((name) => [name, cookies[name]]));
    const saved = Object.fromEntries(entries);
    const bytes = Buffer.byteLength(JSON.stringify([saved, moved]));
    if (limited(req.ip || "?")) return res.status(429).json({ ok: false, error: "rate_limited" });
    prune();
    if (store.size >= MAX_ENTRIES || storedBytes + bytes > MAX_TOTAL_BYTES) return res.status(503).json({ ok: false, error: "busy" });
    const token = crypto.randomBytes(24).toString("base64url");
    store.set(token, { nonce, data: saved, cookies: moved, bytes, expires: now() + TOKEN_TTL });
    storedBytes += bytes;
    res.json({ ok: true, token });
  }

  // 3. Back on the new address: the progress for this browser only, once, or null.
  function takeTransfer(req, res) {
    const token = String(req.query.transfert || "");
    if (!token || isLegacy(req)) return null;
    const entry = drop(token);
    const cookies = readCookies(req);
    if (!entry || entry.expires <= now() || !cookies[NONCE_COOKIE] || !sameValue(entry.nonce, cookies[NONCE_COOKIE])) return null;
    for (const [name, value] of Object.entries(entry.cookies)) if (!cookies[name]) res.cookie(name, value, cookieOptions(req, MOVED_COOKIES[name]));
    res.clearCookie(NONCE_COOKIE, { path: "/" });
    res.cookie(DONE_COOKIE, "1", cookieOptions(req, 365 * 86400000));
    return entry.data;
  }

  return { site, legacy, hosts, isLegacy, middleware, transferPage, receive, takeTransfer, store };
}

// The saved progress inside the home page, as data: no inline script, the CSP stays strict.
function injectTransfer(html, data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return html.replace("</head>", `<script type="application/json" id="pokedle-transfert">${json}</script>\n</head>`);
}

function mountSiteMove(app, { express, ...options }) {
  const move = createSiteMove(options);
  app.use(move.middleware);
  app.get("/transfert", move.transferPage);
  app.get("/transfert.js", (_req, res) => res.sendFile(path.join(__dirname, "..", "transfert.js"), { maxAge: "1h" }));
  app.post("/api/transfert", express.json({ limit: "2mb" }), move.receive);
  return move;
}

module.exports = { SITE_URL, MARK, NONCE_COOKIE, DONE_COOKIE, MOVED_COOKIES, createSiteMove, injectTransfer, mountSiteMove };
