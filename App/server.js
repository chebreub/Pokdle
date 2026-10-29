const { ensureLeaderboardResultKeys, recordLeaderboardResult, recordLeaderboardResultInTransaction } = require("./lib/leaderboard-store");
const { profileForClient, profileForStorage, partnerIdFromProfileData, sharedPhotoFromProfileData, rankingAvatarSql, xpFromProfileData, playerLevelFromXp } = require("./lib/profile-sync");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const vm = require("vm");
const express = require("express");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const { createOAuthStateStore } = require("./lib/oauth-state");
const nearestParty = require("./lib/party-nearest");
const dexRace = require("./lib/party-dexrace");
const deductionParty = require("./lib/party-deduction");
const quiEstCeParty = require("./lib/party-quiestce");
const petitBacParty = require("./lib/party-petitbac");
const coopParty = require("./lib/party-coop");
const { bestDuelProximity } = require("./lib/duel-proximity");
let compression; try { compression = require("compression"); } catch (e) { console.error("[perf] compression indisponible:", e.message); }

const { SITE_URL, mountSiteMove, injectTransfer } = require("./lib/site-move");

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
// Déménagement vers pokdle.fr : l'adresse du site est toujours autorisée dès que la liste est posée.
if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(SITE_URL)) ALLOWED_ORIGINS.push(SITE_URL);
const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : "*",
  },
});

// Security headers (lot D audit 2026-06-10).
// Deux CSP, toutes deux en ENFORCE :
//  - STRICTE pour tout le site : pas d'unsafe-eval, pas de blob: en script-src,
//    websockets limités à la même origine (+ ALLOWED_ORIGINS) au lieu de ws:/wss: génériques.
//  - PERMISSIVE uniquement pour /emulateur : EmulatorJS exige 'unsafe-eval' +
//    'wasm-unsafe-eval' + blob: (cores GBA/WASM). Vérifié 2026-06-05 : retirer
//    'unsafe-eval' casse l'émulateur (écran noir).
// script-src ne contient jamais 'unsafe-inline' : tous les handlers inline ont
// été migrés vers data-action / délégation.
const SOCKET_ORIGINS = ALLOWED_ORIGINS.flatMap((origin) => {
  try {
    const url = new URL(origin);
    return [`${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`];
  } catch (_err) {
    return [];
  }
});
if (!SOCKET_ORIGINS.length) {
  // Dev local sans ALLOWED_ORIGINS : autorise les websockets locaux explicitement
  // (certains navigateurs ne couvrent pas ws:// via 'self').
  SOCKET_ORIGINS.push(`ws://localhost:${PORT}`, `ws://127.0.0.1:${PORT}`);
}

const strictCspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://raw.githubusercontent.com",
    "https://cdn.jsdelivr.net",
    "https://pokeapi.co",
    "https://archives.bulbagarden.net",
    "https://cdn.discordapp.com",
    "https://*.googleusercontent.com",
    "https://static-cdn.jtvnw.net",
    "https://www.pokepedia.fr",
  ],
  connectSrc: [
    "'self'",
    "https://pokeapi.co",
    "https://raw.githubusercontent.com",
    "https://cdn.jsdelivr.net",
    "https://archives.bulbagarden.net",
    ...SOCKET_ORIGINS,
  ],
  mediaSrc: ["'self'", "data:", "blob:", "https://raw.githubusercontent.com", "https://cdn.jsdelivr.net"],
  workerSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
};

const emulatorCspDirectives = {
  ...strictCspDirectives,
  scriptSrc: [...strictCspDirectives.scriptSrc, "https://cdn.emulatorjs.org", "'wasm-unsafe-eval'", "'unsafe-eval'", "blob:"],
  styleSrc: [...strictCspDirectives.styleSrc, "https://cdn.emulatorjs.org"],
  imgSrc: [...strictCspDirectives.imgSrc, "https://cdn.emulatorjs.org"],
  connectSrc: [...strictCspDirectives.connectSrc, "blob:", "https://cdn.emulatorjs.org"],
  mediaSrc: [...strictCspDirectives.mediaSrc, "https://cdn.emulatorjs.org"],
  workerSrc: [...strictCspDirectives.workerSrc, "blob:"],
};

const strictCsp = helmet.contentSecurityPolicy({ useDefaults: false, directives: strictCspDirectives, reportOnly: false });
const emulatorCsp = helmet.contentSecurityPolicy({ useDefaults: false, directives: emulatorCspDirectives, reportOnly: false });

if (compression) app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((req, res, next) => (req.path === "/emulateur" ? emulatorCsp(req, res, next) : strictCsp(req, res, next)));
// Ancienne adresse pokdle.onrender.com : redirection 301 et transfert de la progression,
// avant toutes les autres routes (lib/site-move.js).
const siteMove = mountSiteMove(app, { express, readCookies: (req) => parseAuthCookies(req) });

const rooms = new Map();

// ===== Auth Discord (OAuth) + base Postgres (Neon) — Phase 1, defensif =====
let pgPool = null;
let jwtLib = null;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || "";
// Relais optionnel pour contourner un blocage d'IP (ex. Cloudflare Worker). Vide = appel direct a discord.com.
const DISCORD_API_BASE = (process.env.DISCORD_API_BASE || "https://discord.com").replace(/\/+$/, "");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "";
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
const TWITCH_CALLBACK_URL = process.env.TWITCH_CALLBACK_URL || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const AUTH_COOKIE = "pokdle_session";
const oauthStates = createOAuthStateStore();
const oauthCookieOptions = { httpOnly: true, secure: true, sameSite: "lax", path: "/" };

try {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    // Keep warm connections for two minutes instead of pg's 10 s default: a new
    // TLS connection to the database costs more than most daily requests.
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 120000, keepAlive: true });
    pgPool.on("error", (e) => console.error("[db] pool error:", e.message));
  } else {
    console.warn("[auth] DATABASE_URL absent - comptes desactives.");
  }
} catch (e) { console.error("[auth] pg indisponible:", e.message); pgPool = null; }

try { jwtLib = require("jsonwebtoken"); } catch (e) { console.error("[auth] jsonwebtoken indisponible:", e.message); }

const accountsBaseReady = () => Boolean(pgPool && jwtLib && SESSION_SECRET);
const discordReady = () => accountsBaseReady() && Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_CALLBACK_URL);
const googleReady = () => accountsBaseReady() && Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_CALLBACK_URL);
const twitchReady = () => accountsBaseReady() && Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET && TWITCH_CALLBACK_URL);
// Accounts exist as soon as one sign-in provider is configured.
const authReady = () => discordReady() || googleReady() || twitchReady();

async function initAuthDb() {
  if (!pgPool) return;
  try {
    await pgPool.query(`CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER");
    await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER");
    // The photo a player shares in the rankings (26/10), and its hash, which is its address.
    await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_key TEXT");
    await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo BYTEA");
    await pgPool.query("CREATE INDEX IF NOT EXISTS users_photo_key ON users(photo_key) WHERE photo_key IS NOT NULL");
    // An account id is users.discord_id: Discord accounts keep their Discord id, a
    // Google-only account gets "google:<sub>" and a Twitch-only one "twitch:<id>"
    // (never digits only, so no collision).
    // Each row here is one way to sign in to an account.
    await pgPool.query(`CREATE TABLE IF NOT EXISTS account_identities (
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (provider, provider_user_id)
    )`);
    await pgPool.query("CREATE INDEX IF NOT EXISTS account_identities_account ON account_identities(account_id)");
    await pgPool.query(`INSERT INTO account_identities(provider, provider_user_id, account_id)
      SELECT 'discord', discord_id, discord_id FROM users WHERE discord_id ~ '^[0-9]+$' ON CONFLICT DO NOTHING`);
    // Profiles saved before partner_id existed: copy their partner once.
    const missing = await pgPool.query("SELECT discord_id, data FROM users WHERE partner_id IS NULL AND data ? 'profile'");
    for (const row of missing.rows) {
      const partner = partnerIdFromProfileData(row.data);
      if (partner) await pgPool.query("UPDATE users SET partner_id = $2 WHERE discord_id = $1", [row.discord_id, partner]);
    }
    // Profiles saved before the xp column existed: copy their XP once, for the level shown in rankings.
    const missingXp = await pgPool.query("SELECT discord_id, data FROM users WHERE xp IS NULL AND data ? 'profile'");
    for (const row of missingXp.rows) {
      const xp = xpFromProfileData(row.data);
      if (xp !== null) await pgPool.query("UPDATE users SET xp = $2 WHERE discord_id = $1", [row.discord_id, xp]);
    }
    await pgPool.query(`CREATE TABLE IF NOT EXISTS scores (
      discord_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      username TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (discord_id, mode)
    )`);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS leaderboard_events (
      id BIGSERIAL PRIMARY KEY,
      discord_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS leaderboard_events_mode_created_idx ON leaderboard_events (mode, created_at DESC)`);
    await ensureLeaderboardResultKeys(pgPool);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS daily_sessions (
      discord_id TEXT NOT NULL,
      day DATE NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      guessed JSONB NOT NULL DEFAULT '[]'::jsonb,
      finished BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (discord_id, day)
    )`);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS visits (
      day DATE PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0
    )`);
    // Deleted accounts stay deleted: no rebuilt row, no import from the old database.
    await pgPool.query("CREATE TABLE IF NOT EXISTS deleted_accounts (id TEXT PRIMARY KEY, deleted_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    // Players who recorded a score since the move get their name back in every ranking.
    await pgPool.query(`INSERT INTO users(discord_id, username, avatar)
      SELECT DISTINCT ON (s.discord_id) s.discord_id, s.username, s.avatar FROM scores s
      WHERE s.username <> '' AND NOT EXISTS (SELECT 1 FROM deleted_accounts d WHERE d.id = s.discord_id)
      ORDER BY s.discord_id, s.updated_at DESC ON CONFLICT (discord_id) DO NOTHING`);
    await pgPool.query(`INSERT INTO account_identities(provider, provider_user_id, account_id)
      SELECT 'discord', discord_id, discord_id FROM users WHERE discord_id ~ '^[0-9]+$'
      UNION ALL SELECT 'google', substr(discord_id, 8), discord_id FROM users WHERE discord_id LIKE 'google:%' ON CONFLICT DO NOTHING`);
    console.log("[auth] base prete (users + scores + leaderboard_events + visits).");
  } catch (e) { console.error("[auth] init base echouee:", e.message); }
}
const authDbReady = initAuthDb();

function parseAuthCookies(req) {
  const out = Object.create(null);
  const raw = (req.headers && req.headers.cookie) || "";
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > -1) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
      catch (_error) { /* Ignore malformed cookies rather than failing the request. */ }
    }
  });
  return out;
}
function getSessionUser(req) {
  if (!jwtLib || !SESSION_SECRET) return null;
  const token = parseAuthCookies(req)[AUTH_COOKIE];
  if (!token) return null;
  try { return jwtLib.verify(token, SESSION_SECRET); } catch (e) { return null; }
}
function setSessionCookie(res, payload) {
  const token = jwtLib.sign(payload, SESSION_SECRET, { expiresIn: "30d" });
  res.cookie(AUTH_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * 86400 * 1000, path: "/" });
}
// Sessions opened before the move to the new database (19/10/2026) can point to an
// account that database has never seen: rankings then showed "Dresseur" and profile
// saves found no row. The row is rebuilt from the session, never for a deleted account.
const ACCOUNT_ROWS_CUTOFF = Date.parse("2026-10-19T08:30:00Z") / 1000;
const ensuredAccountRows = new Set();
async function ensureAccountRow(user) {
  const id = String(user?.id || "");
  if (!pgPool || !id || !(Number(user.iat) < ACCOUNT_ROWS_CUTOFF) || ensuredAccountRows.has(id)) return;
  ensuredAccountRows.add(id);
  if (ensuredAccountRows.size > 50000) ensuredAccountRows.clear();
  try {
    const created = await pgPool.query(`INSERT INTO users(discord_id, username, avatar) SELECT $1, $2, $3
      WHERE NOT EXISTS (SELECT 1 FROM deleted_accounts WHERE id = $1) ON CONFLICT (discord_id) DO NOTHING`, [id, String(user.username || "").slice(0, 64), String(user.avatar || "").slice(0, 500)]);
    if (created.rowCount && /^[0-9]+$/.test(id)) await pgPool.query("INSERT INTO account_identities(provider, provider_user_id, account_id) VALUES('discord', $1, $1) ON CONFLICT DO NOTHING", [id]);
    if (created.rowCount && id.startsWith("google:")) await pgPool.query("INSERT INTO account_identities(provider, provider_user_id, account_id) VALUES('google', $1, $2) ON CONFLICT DO NOTHING", [id.slice(7), id]);
  } catch (e) { ensuredAccountRows.delete(id); console.error("[auth] account row:", e.message); }
}
// One sign-in, whatever the provider. A known identity opens its account. A new one
// opens the account already signed in on this browser (linking), else its own new
// account (nativeId). A Discord user who already has records is never linked away.
async function signInWithIdentity(req, res, { provider, providerUserId, nativeId, username, avatar }) {
  const known = (await pgPool.query("SELECT account_id FROM account_identities WHERE provider = $1 AND provider_user_id = $2", [provider, providerUserId])).rows[0];
  let accountId = known?.account_id || "";
  let linked = false;
  if (!accountId) {
    const ownsAccount = (await pgPool.query("SELECT 1 FROM users WHERE discord_id = $1", [nativeId])).rowCount > 0;
    const current = getSessionUser(req);
    // A session can outlive its account (deleted elsewhere): only link into a live one.
    const currentAlive = Boolean(current?.id) && String(current.id) !== nativeId
      && (await pgPool.query("SELECT 1 FROM users WHERE discord_id = $1", [String(current.id)])).rowCount > 0;
    linked = currentAlive && !ownsAccount;
    accountId = linked ? String(current.id) : nativeId;
  }
  if (accountId === nativeId) {
    await pgPool.query(
      `INSERT INTO users (discord_id, username, avatar, last_login) VALUES ($1, $2, $3, now())
       ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username, avatar = EXCLUDED.avatar, last_login = now()`,
      [accountId, username, avatar]
    );
  } else {
    // Another way into an existing account: keep its name, fill a missing avatar.
    await pgPool.query("UPDATE users SET last_login = now(), avatar = CASE WHEN avatar = '' THEN $2 ELSE avatar END WHERE discord_id = $1", [accountId, avatar]);
  }
  if (!known) {
    await pgPool.query("INSERT INTO account_identities(provider, provider_user_id, account_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [provider, providerUserId, accountId]);
  }
  const row = (await pgPool.query("SELECT username, avatar FROM users WHERE discord_id = $1", [accountId])).rows[0];
  const session = { id: accountId, username: row?.username || username, avatar: row?.avatar ?? avatar, via: provider };
  setSessionCookie(res, session);
  return { ...session, linked };
}

app.get("/auth/discord", (req, res) => {
  if (!discordReady()) return res.redirect("/?auth=indispo");
  const attempt = oauthStates.issue();
  if (!attempt) return res.status(503).send("Connexion temporairement indisponible. Réessaie dans quelques minutes.");
  res.cookie(attempt.cookieName, attempt.binding, { ...oauthCookieOptions, maxAge: attempt.maxAge });
  res.set("Cache-Control", "no-store");
  const params = new URLSearchParams({
    state: attempt.state,
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_CALLBACK_URL,
    response_type: "code",
    scope: "identify",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get("/auth/discord/callback", async (req, res) => {
  if (!discordReady()) return res.redirect("/?auth=indispo");
  res.set("Cache-Control", "no-store");
  const state = req.query && req.query.state;
  if (!oauthStates.consume(state, parseAuthCookies(req))) return res.redirect("/?auth=erreur");
  res.clearCookie(oauthStates.cookieName(state), oauthCookieOptions);
  const code = req.query && req.query.code;
  if (typeof code !== "string" || !code) return res.redirect("/?auth=annule");
  try {
    const tokenResp = await fetch(`${DISCORD_API_BASE}/api/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: DISCORD_CALLBACK_URL,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResp.ok) throw new Error("token HTTP " + tokenResp.status);
    const tok = await tokenResp.json();
    const userResp = await fetch(`${DISCORD_API_BASE}/api/users/@me`, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!userResp.ok) throw new Error("user HTTP " + userResp.status);
    const u = await userResp.json();
    const discordId = String(u.id);
    const username = String(u.global_name || u.username || "Dresseur").slice(0, 32);
    const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${u.avatar}.png?size=128` : "";
    const session = await signInWithIdentity(req, res, { provider: "discord", providerUserId: discordId, nativeId: discordId, username, avatar });
    res.redirect(session.linked ? "/?auth=linked&via=discord" : "/?auth=ok");
  } catch (e) {
    console.error("[auth] callback echec:", e.message);
    res.redirect("/?auth=erreur");
  }
});

// ===== Google (OpenID Connect, profile only: no email is requested or stored) =====
app.get("/auth/google", (req, res) => {
  if (!googleReady()) return res.redirect("/?auth=indispo");
  const attempt = oauthStates.issue();
  if (!attempt) return res.status(503).send("Connexion temporairement indisponible. Réessaie dans quelques minutes.");
  res.cookie(attempt.cookieName, attempt.binding, { ...oauthCookieOptions, maxAge: attempt.maxAge });
  res.set("Cache-Control", "no-store");
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid profile",
    state: attempt.state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/auth/google/callback", async (req, res) => {
  if (!googleReady()) return res.redirect("/?auth=indispo");
  res.set("Cache-Control", "no-store");
  const state = req.query && req.query.state;
  if (!oauthStates.consume(state, parseAuthCookies(req))) return res.redirect("/?auth=erreur&via=google");
  res.clearCookie(oauthStates.cookieName(state), oauthCookieOptions);
  const code = req.query && req.query.code;
  if (typeof code !== "string" || !code) return res.redirect("/?auth=annule");
  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: GOOGLE_CALLBACK_URL,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResp.ok) throw new Error("google token HTTP " + tokenResp.status);
    const tok = await tokenResp.json();
    const infoResp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!infoResp.ok) throw new Error("google userinfo HTTP " + infoResp.status);
    const info = await infoResp.json();
    const sub = String(info.sub || "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sub)) throw new Error("google sub invalide");
    // First name only: the public leaderboards show this name.
    const username = String(info.given_name || info.name || "Dresseur").trim().slice(0, 32) || "Dresseur";
    const picture = String(info.picture || "");
    const avatar = /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//i.test(picture) ? picture.slice(0, 500) : "";
    const session = await signInWithIdentity(req, res, { provider: "google", providerUserId: sub, nativeId: "google:" + sub, username, avatar });
    res.redirect(session.linked ? "/?auth=linked&via=google" : "/?auth=ok&via=google");
  } catch (e) {
    console.error("[auth] google callback echec:", e.message);
    res.redirect("/?auth=erreur&via=google");
  }
});

// ===== Twitch (OpenID Connect, profile only: no email is requested or stored) =====
app.get("/auth/twitch", (req, res) => {
  if (!twitchReady()) return res.redirect("/?auth=indispo");
  const attempt = oauthStates.issue();
  if (!attempt) return res.status(503).send("Connexion temporairement indisponible. Réessaie dans quelques minutes.");
  res.cookie(attempt.cookieName, attempt.binding, { ...oauthCookieOptions, maxAge: attempt.maxAge });
  res.set("Cache-Control", "no-store");
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: TWITCH_CALLBACK_URL,
    response_type: "code",
    scope: "openid",
    state: attempt.state,
  });
  res.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
});

app.get("/auth/twitch/callback", async (req, res) => {
  if (!twitchReady()) return res.redirect("/?auth=indispo");
  res.set("Cache-Control", "no-store");
  const state = req.query && req.query.state;
  if (!oauthStates.consume(state, parseAuthCookies(req))) return res.redirect("/?auth=erreur&via=twitch");
  res.clearCookie(oauthStates.cookieName(state), oauthCookieOptions);
  const code = req.query && req.query.code;
  if (typeof code !== "string" || !code) return res.redirect("/?auth=annule");
  try {
    const tokenResp = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: TWITCH_CALLBACK_URL,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResp.ok) throw new Error("twitch token HTTP " + tokenResp.status);
    const tok = await tokenResp.json();
    const userResp = await fetch("https://api.twitch.tv/helix/users", {
      headers: { Authorization: `Bearer ${tok.access_token}`, "Client-Id": TWITCH_CLIENT_ID },
      signal: AbortSignal.timeout(8000),
    });
    if (!userResp.ok) throw new Error("twitch user HTTP " + userResp.status);
    const u = (await userResp.json())?.data?.[0] || {};
    const twitchId = String(u.id || "");
    if (!/^[0-9]{1,20}$/.test(twitchId)) throw new Error("twitch id invalide");
    const username = String(u.display_name || u.login || "Dresseur").trim().slice(0, 32) || "Dresseur";
    const picture = String(u.profile_image_url || "");
    const avatar = /^https:\/\/static-cdn\.jtvnw\.net\//i.test(picture) ? picture.slice(0, 500) : "";
    const session = await signInWithIdentity(req, res, { provider: "twitch", providerUserId: twitchId, nativeId: "twitch:" + twitchId, username, avatar });
    res.redirect(session.linked ? "/?auth=linked&via=twitch" : "/?auth=ok&via=twitch");
  } catch (e) {
    console.error("[auth] twitch callback echec:", e.message);
    res.redirect("/?auth=erreur&via=twitch");
  }
});

app.get("/auth/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.redirect("/");
});

// Accounts that open the admin panel (/admin): their ids, comma-separated, set on Render.
const adminPanel = require("./lib/admin-panel");
const ADMIN_ACCOUNT_IDS = adminPanel.adminIdsFrom(process.env.ADMIN_ACCOUNT_IDS);
app.get("/api/me", (req, res) => {
  const providers = { discord: discordReady(), google: googleReady(), twitch: twitchReady() };
  if (!authReady()) return res.json({ user: null, auth: false, providers });
  const user = getSessionUser(req);
  if (user) ensureAccountRow(user);
  res.json({ user: user ? { id: user.id, username: user.username, avatar: user.avatar, via: user.via || "discord", ...(ADMIN_ACCOUNT_IDS.has(String(user.id)) ? { admin: true } : {}) } : null, auth: true, providers });
});
// Delete my account: every row tied to it, in one transaction, then the session.
// Public egg feed entries are kept but anonymised so the shared investigation stays whole.
app.post("/api/account/delete", express.json({ limit: "1kb" }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  const origin = req.get("origin");
  if (origin && new URL(origin).host !== req.get("host")) return res.status(403).json({ ok: false, error: "origin_denied" });
  const user = authReady() ? getSessionUser(req) : null;
  if (!user) return res.status(401).json({ ok: false, error: "not_signed_in" });
  if (!req.body || req.body.confirm !== "SUPPRIMER") return res.status(400).json({ ok: false, error: "confirm_required" });
  const id = String(user.id), key = "user:" + id;
  const steps = [
    ["scores", "DELETE FROM scores WHERE discord_id = $1", [id]],
    ["leaderboard_events", "DELETE FROM leaderboard_events WHERE discord_id = $1", [id]],
    ["daily_sessions", "DELETE FROM daily_sessions WHERE discord_id = $1", [id]],
    ...["daily_plays", "wordle_plays", "dossier_plays", "challenge_plays", "grid_plays", "petitbac_daily_plays"].map((table) => [table, `DELETE FROM ${table} WHERE account_id = $1 OR identity = $2`, [id, key]]),
    ["egg_rewards", "DELETE FROM egg_rewards WHERE player_id = $1", [id]],
    ["egg_guesses", "UPDATE egg_guesses SET player_id = NULL, credited_player_id = NULL, username = 'Anonyme' WHERE player_id = $1 OR credited_player_id = $1", [id]],
    ["egg_rounds", "UPDATE egg_rounds SET winner_name = 'Anonyme', found_by = 'deleted' WHERE found_by = $1", [key]],
    ["deleted_accounts", "INSERT INTO deleted_accounts(id) VALUES($1) ON CONFLICT DO NOTHING", [id]],
    ["users", "DELETE FROM users WHERE discord_id = $1", [id]],
  ];
  let client = null;
  try {
    client = await pgPool.connect();
    await client.query("BEGIN");
    for (const [table, sql, params] of steps) {
      // A deployment may not have created every game table yet.
      const exists = (await client.query("SELECT to_regclass($1) AS t", [table])).rows[0]?.t;
      if (exists) await client.query(sql, params);
    }
    await client.query("COMMIT");
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("[account] delete failed:", e.message);
    return res.status(503).json({ ok: false, error: "unavailable" });
  } finally { if (client) client.release(); }
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.json({ ok: true });
});
// Which sign-ins open the current account (for "Relier Google / Discord").
app.get("/api/account/identities", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const user = authReady() ? getSessionUser(req) : null;
  if (!user) return res.json({ ok: false, identities: [] });
  try {
    const rows = (await pgPool.query("SELECT provider FROM account_identities WHERE account_id = $1 ORDER BY provider", [String(user.id)])).rows;
    res.json({ ok: true, identities: rows.map((row) => row.provider) });
  } catch (e) { res.status(503).json({ ok: false, identities: [] }); }
});
app.get("/api/profile", async (req, res) => {
  if (!authReady()) return res.json({ ok: false, data: null });
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, data: null });
  try {
    await ensureAccountRow(user);
    const r = await pgPool.query("SELECT data FROM users WHERE discord_id = $1", [user.id]);
    res.json({ ok: true, data: profileForClient((r.rows[0] && r.rows[0].data) || {}, user.id) });
  } catch (e) { console.error("[profile] get:", e.message); res.json({ ok: false, data: null }); }
});

app.post("/api/profile", express.json({ limit: "300kb" }), async (req, res) => {
  if (!authReady()) return res.json({ ok: false });
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ ok: false });
  const prepared = profileForStorage(req.body, user.id);
  if (!prepared.ok) {
    return res.status(prepared.error === "profile_owner_mismatch" ? 409 : 400).json({ ok: false, error: prepared.error });
  }
  // The copy this device started from. A newer copy online (another device synced meanwhile)
  // is not overwritten: the device gets it back (409), merges both and sends again.
  const baseSavedAt = Number(prepared.data._baseSavedAt);
  const checkBase = Object.prototype.hasOwnProperty.call(prepared.data, "_baseSavedAt") && Number.isFinite(baseSavedAt) && baseSavedAt >= 0;
  delete prepared.data._baseSavedAt;
  try {
    await ensureAccountRow(user);
    let photo = sharedPhotoFromProfileData(prepared.data);
    // A photo the admin took back never returns to the rankings, even if the profile sends it again.
    if (photo && await adminPanel.isPhotoBlocked(pgPool, photo.key).catch(() => false)) photo = null;
    const values = [user.id, JSON.stringify(prepared.data), partnerIdFromProfileData(prepared.data), xpFromProfileData(prepared.data), photo ? photo.key : null, photo ? photo.bytes : null];
    const saved = checkBase
      ? await pgPool.query(`UPDATE users SET data = $2, partner_id = $3, xp = $4, photo_key = $5, photo = $6 WHERE discord_id = $1
          AND (CASE WHEN jsonb_typeof(data->'_savedAt') = 'number' THEN (data->>'_savedAt')::numeric ELSE 0 END) <= $7`, [...values, baseSavedAt])
      : await pgPool.query("UPDATE users SET data = $2, partner_id = $3, xp = $4, photo_key = $5, photo = $6 WHERE discord_id = $1", values);
    if (checkBase && saved.rowCount === 0) {
      const current = await pgPool.query("SELECT data FROM users WHERE discord_id = $1", [user.id]);
      return res.status(409).json({ ok: false, error: "stale_profile", data: profileForClient((current.rows[0] && current.rows[0].data) || {}, user.id) });
    }
    res.json({ ok: true });
  } catch (e) { console.error("[profile] post:", e.message); res.json({ ok: false }); }
});
// A shared profile photo, as the rankings show it. A day of cache: a photo taken back
// disappears for everyone by the next day.
app.get("/api/avatar-photo/:key", async (req, res) => {
  if (!pgPool || !/^[0-9a-f]{24}$/.test(req.params.key)) return res.status(404).end();
  try {
    const r = await pgPool.query("SELECT photo FROM users WHERE photo_key = $1 AND photo IS NOT NULL LIMIT 1", [req.params.key]);
    if (!r.rows[0]) return res.status(404).end();
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });
    res.send(r.rows[0].photo);
  } catch (e) { console.error("[avatar-photo]", e.message); res.status(404).end(); }
});
const LB_MODE_CONFIG = Object.freeze({
  challenge: { direction: "desc", label: "Défi du jour", unit: "pts", max: 60 },
  journey: { direction: "desc", label: "Parcours du jour", unit: "pts", max: 96 },
  dossier: { direction: "desc", label: "Dossier du jour", unit: "pts", max: 20 },
  wordle: { direction: "asc", label: "Wordle du jour", unit: "essais", max: 6 },
  daily: { direction: "asc", label: "Pokémon du jour", unit: "essais", max: 1025 },
  // 15 questions per Quiz (QUIZ_QUESTION_COUNT in src/script.01.core.js).
  quiz: { direction: "desc", label: "Quiz", unit: "bonnes réponses", max: 15 },
  speedrun: { direction: "desc", label: "Speedrun", unit: "Pokémon", max: 100 },
  party: { direction: "desc", label: "Party", unit: "victoires", max: 20 },
  intrus: { direction: "desc", label: "Intrus", unit: "série", max: 1000 },
  poids: { direction: "desc", label: "Duel de poids", unit: "série", max: 1000 },
  higherlower: { direction: "desc", label: "Higher/Lower", unit: "série", max: 1000 },
  higherlower60: { direction: "desc", label: "Higher/Lower 60s", unit: "points", max: 5000 },
  typecombo: { direction: "desc", label: "Combo de types", unit: "points", max: 10000 }
});
const LB_MODES = Object.keys(LB_MODE_CONFIG);
function leaderboardConfig(mode) {
  if (/^draft_(all|[1-9])$/.test(mode)) return { direction: "desc", label: "Draft Score", unit: "BST", max: 1000 };
  if (/^weekly_\d{4}-W\d{2}$/.test(mode)) return { direction: "desc", label: "Épreuve de Ligue", unit: "pts", max: 600 };
  return LB_MODE_CONFIG[mode] || null;
}
function leaderboardAllowed(mode) {
  return Boolean(leaderboardConfig(mode));
}
function clampLeaderboardScore(value, config) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const max = Math.max(1, Number(config?.max) || 100000);
  if (n > max) return null;
  return Math.max(1, Math.floor(n));
}
function leaderboardOrderSql(config) {
  return config?.direction === "asc" ? "ASC" : "DESC";
}
function leaderboardBestSql(config) {
  return config?.direction === "asc" ? "MIN" : "MAX";
}


function serverUTCDateKey() { return new Date().toISOString().slice(0,10); }
function dailyUtcKey() {
  return new Date().toISOString().slice(0, 10);
}
function dailyHashString(value) {
  let h = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function dailyMulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function serverDailyPokemon(day = dailyUtcKey()) {
  const pool = POKEMON_LIST
    .filter((pokemon) => pokemon && !pokemon.isAltForm && Number(pokemon.id) < 20000)
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (!pool.length) throw new Error("Daily pool unavailable");
  const rng = dailyMulberry32(dailyHashString("pokedle:" + day));
  return pool[Math.floor(rng() * pool.length)];
}
// Legacy bulk score import is intentionally retired. Those values came from the browser's
// local profile and therefore could not prove that a game had actually been completed.
app.post("/api/scores", express.json({ limit: "4kb" }), (req, res) => {
  if (!authReady()) return res.status(503).json({ ok: false, error: "unavailable" });
  if (!getSessionUser(req)) return res.status(401).json({ ok: false, error: "authentication_required" });
  return res.status(410).json({ ok: false, error: "legacy_score_sync_retired" });
});
app.post("/api/leaderboard/result", express.json({ limit: "4kb" }), async (req, res) => {
  if (!authReady()) return res.status(503).json({ok:false,error:"unavailable"});
  const user=getSessionUser(req);
  if (!user) return res.status(401).json({ok:false,error:"authentication_required"});
  const mode=String(req.body?.mode||""), config=leaderboardConfig(mode);
  if (["challenge","journey"].includes(mode)) return res.status(409).json({ok:false,error:"daily_requires_server_session"});
  if (mode==="dossier") return res.status(409).json({ok:false,error:"dossier_requires_server_session"});
  if (mode==="wordle") return res.status(409).json({ok:false,error:"wordle_requires_server_session"});
  if (mode==="daily") return res.status(409).json({ok:false,error:"daily_requires_server_session"});
  const score=clampLeaderboardScore(req.body?.score,config);
  if (!config || score==null) return res.status(400).json({ok:false,error:"invalid_score"});
  const today=new Date().toISOString().slice(0,10);
  if (mode==="daily" && req.body.dailyKey!=null && req.body.dailyKey!==today) return res.status(409).json({ok:false,error:"stale_daily"});
  const id=req.body?.resultId;
  if (id!=null && (typeof id!=="string" || !/^[A-Za-z0-9:_-]{1,100}$/.test(id))) return res.status(400).json({ok:false,error:"invalid_result_id"});
  const key=mode==="daily"?"daily:"+today:id||null;
  try {
    const stored=await recordLeaderboardResult(pgPool,user,mode,score,config,key);
    res.json({ok:true,mode,...stored});
  } catch (error) {
    console.error("[leaderboard] result:",error.message);
    res.status(503).json({ok:false,error:"storage_unavailable"});
  }
});

// Players ranked per arcade board for a period, so empty boards can be hidden.
const LB_DRAFT_MODES = ["draft_all", ...Array.from({ length: 9 }, (_, index) => "draft_" + (index + 1))];
const LB_ARCADE_MODES = ["quiz", "speedrun", "higherlower", "higherlower60", "intrus", "poids", "party", "typecombo", ...LB_DRAFT_MODES];
app.get("/api/leaderboard/counts", async (req, res) => {
  if (!authReady()) return res.json({ ok: false, counts: {} });
  const scope = ["today", "week", "all"].includes(req.query.scope) ? req.query.scope : "all";
  try {
    await authDbReady;
    const sql = scope === "all"
      ? "SELECT CASE WHEN mode LIKE 'draft_%' THEN 'draft' ELSE mode END AS mode, COUNT(DISTINCT discord_id)::int AS n FROM scores WHERE mode = ANY($1) GROUP BY 1"
      : "SELECT CASE WHEN e.mode LIKE 'draft_%' THEN 'draft' ELSE e.mode END AS mode, COUNT(DISTINCT discord_id)::int AS n FROM leaderboard_events e WHERE e.mode = ANY($1) AND " +
        (scope === "today" ? "e.created_at >= (date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')" : "e.created_at >= now() - interval '7 days'") +
        " GROUP BY 1";
    const rows = (await pgPool.query(sql, [LB_ARCADE_MODES])).rows;
    const counts = Object.fromEntries([...LB_ARCADE_MODES.filter((mode) => !mode.startsWith("draft_")), "draft"].map((mode) => [mode, 0]));
    for (const row of rows) counts[row.mode] = Number(row.n) || 0;
    res.json({ ok: true, scope, counts });
  } catch (e) {
    console.error("[leaderboard] counts:", e.message);
    res.json({ ok: false, counts: {} });
  }
});
app.get("/api/leaderboard", async (req, res) => {
  if (!authReady()) return res.json({ ok: false, top: [], me: null, around: [], total: 0 });
  const requestedMode = String(req.query.mode || "quiz");
  // Day boards computed from the plays themselves; they never accept client scores.
  const playModes = ["challenge", "journey", "enquete", "wordlepts"];
  const mode = playModes.includes(requestedMode) || requestedMode === "grid" || requestedMode === "petitbacday" || leaderboardAllowed(requestedMode) ? requestedMode : "quiz";
  const config = leaderboardConfig(mode);
  const scope = ["today", "week", "all"].includes(req.query.scope) ? req.query.scope : "all";
  const order = leaderboardOrderSql(config);
  const best = leaderboardBestSql(config);
  const globalDraft = mode === "draft_all";
  const scoreboardParams = globalDraft ? [LB_DRAFT_MODES] : [mode];
  const user = getSessionUser(req);
  const meId = user ? user.id : null;
  try {
    await authDbReady;
    if(playModes.includes(mode)) return res.json(await challengeService.leaderboard(mode,scope,meId));
    if(mode === "dossier") return res.json(await dossierService.leaderboard(scope,meId));
    if(mode === "grid") return res.json(await gridService.leaderboard(scope,meId));
    if(mode === "petitbacday") return res.json(await dailyBacService.leaderboard(scope,meId));
    let rankedCte;
    if (scope === "all" && globalDraft) {
      // Aggregate only existing server-backed records; never promote local profile
      // data to public rankings without proof that a ranked game was completed.
      rankedCte = `
        WITH best AS (
          SELECT DISTINCT ON (s.discord_id) s.discord_id, s.username, s.avatar, s.score, s.updated_at
          FROM scores s
          WHERE s.mode = ANY($1)
          ORDER BY s.discord_id, s.score DESC, s.updated_at ASC
        ),
        ranked AS (
          SELECT b.discord_id, b.username, ${rankingAvatarSql("b.avatar")} AS avatar, u.partner_id, u.xp, b.score,
            (RANK() OVER (ORDER BY b.score DESC, b.updated_at ASC))::int AS rank
          FROM best b
          LEFT JOIN users u ON u.discord_id = b.discord_id
        )`;
    } else if (scope === "all") {
      rankedCte = `
        WITH ranked AS (
          SELECT s.discord_id, s.username, ${rankingAvatarSql("s.avatar")} AS avatar, u.partner_id, u.xp, s.score,
            (RANK() OVER (ORDER BY s.score ${order}, s.updated_at ASC))::int AS rank
          FROM scores s
          LEFT JOIN users u ON u.discord_id = s.discord_id
          WHERE s.mode = $1
        )`;
    } else {
      const timePredicate = scope === "today"
        // Every "today" board resets at midnight in Paris.
        ? "e.created_at >= (date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')"
        : "e.created_at >= now() - interval '7 days'";
      rankedCte = `
        WITH best AS (
          SELECT e.discord_id, ${best}(e.score)::int AS score
          FROM leaderboard_events e
          WHERE e.mode ${globalDraft ? "= ANY($1)" : "= $1"} AND ${timePredicate}
          GROUP BY e.discord_id
        ),
        ranked AS (
          SELECT b.discord_id, COALESCE(u.username, 'Dresseur') AS username, ${rankingAvatarSql("COALESCE(u.avatar, '')")} AS avatar, u.partner_id, u.xp, b.score,
            (RANK() OVER (ORDER BY b.score ${order}))::int AS rank
          FROM best b
          LEFT JOIN users u ON u.discord_id = b.discord_id
        )`;
    }

    const top = await pgPool.query(
      rankedCte + " SELECT discord_id, username, avatar, partner_id, xp, score, rank FROM ranked ORDER BY rank ASC, username ASC LIMIT 20",
      scoreboardParams
    );
    const totalR = await pgPool.query(rankedCte + " SELECT COUNT(*)::int AS total FROM ranked", scoreboardParams);
    let me = null;
    let aroundRows = [];
    if (meId) {
      const mine = await pgPool.query(
        rankedCte + " SELECT discord_id, username, avatar, partner_id, xp, score, rank FROM ranked WHERE discord_id = $2 LIMIT 1",
        scoreboardParams.concat(meId)
      );
      if (mine.rows[0]) {
        const row = mine.rows[0];
        me = { rank: Number(row.rank), score: Number(row.score) };
        const low = Math.max(1, Number(row.rank) - 2);
        const high = Number(row.rank) + 2;
        const around = await pgPool.query(
          rankedCte + " SELECT discord_id, username, avatar, partner_id, xp, score, rank FROM ranked WHERE rank BETWEEN $2 AND $3 ORDER BY rank ASC, username ASC LIMIT 7",
          scoreboardParams.concat(low, high)
        );
        aroundRows = around.rows;
      }
    }
    const mapRow = (row) => ({
      rank: Number(row.rank),
      username: row.username,
      avatar: row.avatar,
      partnerId: row.partner_id ? Number(row.partner_id) : null,
      level: playerLevelFromXp(row.xp),
      score: Number(row.score),
      me: meId != null && row.discord_id === meId
    });
    res.json({
      ok: true,
      mode,
      scope,
      authenticated: Boolean(user),
      direction: config.direction,
      label: config.label,
      unit: config.unit,
      total: Number(totalR.rows[0]?.total) || 0,
      top: top.rows.map(mapRow),
      me,
      around: aroundRows.map(mapRow)
    });
  } catch (e) {
    console.error("[leaderboard] get:", e.message);
    res.json({ ok: false, top: [], me: null, around: [], total: 0 });
  }
});
// ===== Fin auth Phase 1 =====

const statClashRooms = new Map();
const draftScoreRooms = new Map();
const partyRooms = new Map();
const POKEMON_LIST = loadPokemonList();
const POKEMON_BY_NORMALIZED_NAME = new Map(POKEMON_LIST.map((pokemon) => [normalizeName(pokemon.name), pokemon]));
const dailyService = require("./lib/daily-game").mountDailyRoutes({ app, express, db:pgPool, pokemon:POKEMON_LIST, secret:SESSION_SECRET, getUser:getSessionUser, readCookies:parseAuthCookies, compare:require("./lib/daily-comparison").compareDaily, legacyTarget:serverDailyPokemon, readyBefore:authDbReady });
const wordleService = require("./lib/daily-wordle").mountWordleRoutes({ app, express, db:pgPool, pokemon:POKEMON_LIST, secret:SESSION_SECRET, getUser:getSessionUser, readCookies:parseAuthCookies, daily:dailyService, readyBefore:authDbReady });
const dossierService = require("./lib/daily-dossier").mountDossierRoutes({ app, express, db:pgPool, secret:SESSION_SECRET, getUser:getSessionUser, readCookies:parseAuthCookies, daily:dailyService, wordle:wordleService, readyBefore:authDbReady });
const challengeService = require("./lib/daily-challenge").mountChallengeRoutes({app,express,db:pgPool,pokemon:POKEMON_LIST,secret:SESSION_SECRET,getUser:getSessionUser,readCookies:parseAuthCookies,daily:dailyService,wordle:wordleService,dossier:dossierService,readyBefore:authDbReady});
// Petit Bac solo: a sheet drawn and checked by the server, nothing stored.
petitBacParty.mountPetitBacSolo({ app, express, pokemon: POKEMON_LIST });
// Petit Bac du jour: same letter and themes for everyone, another bonus of the day.
const dailyBacService = require("./lib/daily-petitbac").mountDailyPetitBacRoutes({app,express,db:pgPool,pokemon:POKEMON_LIST,secret:SESSION_SECRET,getUser:getSessionUser,readCookies:parseAuthCookies,readyBefore:authDbReady});
// Grille du jour: the bonus of the day, beside the 100-point journey.
const gridService = require("./lib/daily-grid").mountGridRoutes({app,express,db:pgPool,pokemon:POKEMON_LIST,secret:SESSION_SECRET,getUser:getSessionUser,readCookies:parseAuthCookies,readyBefore:authDbReady});
// The old Neon data can only be imported AFTER the operator verifies an
// independent, restorable backup of the CURRENT PostgreSQL database.
// An OLD_DATABASE_URL by itself is not authorization to overwrite any data.
const legacyImport = require("./lib/db-import");
if (legacyImport.canScheduleLegacyImport(process.env)) {
  legacyImport.scheduleLegacyImport({ db: pgPool, oldUrl: process.env.OLD_DATABASE_URL, ascModes: Object.keys(LB_MODE_CONFIG).filter((mode) => LB_MODE_CONFIG[mode].direction === "asc"), readyBefore: authDbReady.then(() => new Promise((resolve) => setTimeout(resolve, 20000))) });
} else if (process.env.OLD_DATABASE_URL) {
  console.warn("[import] Neon recovery paused: verify a restorable current-database backup before setting LEGACY_IMPORT_BACKUP_VERIFIED=yes.");
}
require("./lib/egg-mystery").mountEggRoutes({ app, express, db:pgPool, pokemon:POKEMON_LIST, secret:SESSION_SECRET, getUser:getSessionUser, readCookies:parseAuthCookies });
const MAX_ROOM_SIZE = 2;
const DUEL_RECONNECT_GRACE_MS = 30000; // fenêtre de reconnexion avant forfait en duel live
const PARTY_RECONNECT_GRACE_MS = 30000; // refresh/coupure : garde la place et l’hôte avant transfert
const PARTY_MIN_PLAYERS = 2;
const PARTY_MAX_PLAYERS = 8;
const PARTY_TOTAL_ROUNDS = 5;
const PARTY_ROUND_TIMER_MS = 30000;
const PARTY_STAT_LABELS = { hp: "PV", attack: "Attaque", defense: "Defense", spAttack: "Att. Spe.", spDefense: "Def. Spe.", speed: "Vitesse" };
const STAT_CLASH_TOTAL_ROUNDS = 6;
const STAT_CLASH_MAX_PLAYERS = 2;
const STAT_CLASH_RECONNECT_GRACE_MS = 30000;
const STAT_CLASH_PLAYER_SEATS = ["left", "right", "seat3", "seat4"];
const STAT_CLASH_ROLL_MS = 2600;
const STAT_CLASH_START_DELAY_MS = 1400;
const STAT_CLASH_PICK_MS = 12000;
const STAT_CLASH_REVEAL_MS = 2600;
const STAT_CLASH_LOCKED_REVEAL_MS = 1000;
const STAT_CLASH_SESSION_RECORD_DEFAULT = Object.freeze({
  score: 359,
  winner: "Kayan",
  loser: "MG",
});
const STAT_CLASH_STAT_KEYS = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];
const STAT_CLASH_STAT_LABELS = {
  hp: "PV",
  attack: "Attack",
  defense: "Defense",
  spAttack: "Special Attack",
  spDefense: "Special Defense",
  speed: "Speed",
};
const STAT_CLASH_STATS_CACHE = new Map();
const STAT_CLASH_STATS_CACHE_MAX = 1500;
const STAT_CLASH_PRESSURE_PICK_MS = 6500;
const STAT_CLASH_PREVIEW_DURATION_MS = 3000;
const STAT_CLASH_FORMATS = {
  bo3: { rounds: 3, suddenDeath: false, label: "Best of 3" },
  standard: { rounds: 6, suddenDeath: false, label: "Standard (6 manches)" },
  bo9: { rounds: 9, suddenDeath: false, label: "Best of 9" },
  suddenDeath: { rounds: 6, suddenDeath: true, label: "Sudden Death" },
};
const STAT_CLASH_HOUSE_RULES = [
  { id: "noSpeedEarly", label: "Vitesse interdite avant la manche 4", desc: "Le bouton Vitesse est verrouille pour les deux camps jusqu'a la M4 incluse." },
  { id: "atkRound3", label: "Manches 3-4 : Attaque obligatoire", desc: "Aux 3e et 4e manches, seul le bouton Attaque est jouable." },
  { id: "noHpFinal", label: "2 dernieres manches : pas de PV", desc: "Le bouton PV est verrouille sur les deux dernieres manches." },
  { id: "weakStart", label: "Manches 1-2 : stat la plus faible imposee", desc: "Aux M1 et M2, seule la stat la plus basse du Pokemon est selectionnable." },
  { id: "pressureLate", label: "Pression : timer 5s a partir de la moitie", desc: "Des la moitie de la partie incluse, le timer est divise par deux (5s)." },
  { id: "doubleStat", label: "Stat star vaut double", desc: "Une stat tiree au sort en debut de partie vaut deux fois ses points quand elle est jouee." },
  { id: "blindRound5", label: "Manche 5 : choix impose entre 2 stats", desc: "A la M5, le camp qui subit choisit entre deux stats tirees au hasard parmi ses non utilisees." },
  { id: "mirrorRound4", label: "Manche 4 : stat imposee identique", desc: "A la M4, une stat est tiree au sort et imposee des deux cotes." },
  { id: "comboBonus", label: "Combo : 3 victoires d'affilee = +2 pts", desc: "Un bonus de 2 pts est applique chaque fois qu'un camp atteint un streak de 3." },
];
const STAT_CLASH_IMPOSABLE_RULE_IDS = new Set(["noSpeedEarly", "atkRound3", "noHpFinal", "weakStart", "pressureLate", "blindRound5"]);
const STAT_CLASH_SHARED_RULE_IDS = new Set(["doubleStat", "mirrorRound4", "comboBonus"]);
function getStatClashRuleById(ruleId) {
  return STAT_CLASH_HOUSE_RULES.find((rule) => rule.id === ruleId) || null;
}
function getRandomStatClashRuleFromSet(ruleIds) {
  const pool = STAT_CLASH_HOUSE_RULES.filter((rule) => ruleIds.has(rule.id));
  return pool[Math.floor(Math.random() * pool.length)] || null;
}
function getOppositeStatClashSide(side) {
  return side === "left" ? "right" : side === "right" ? "left" : null;
}
function buildStatClashRoomJokers() {
  return {
    left: { reroll: 1, preview: 1, double: 1, previewKey: null, doubleArmed: false, previewExpiresAt: null },
    right: { reroll: 1, preview: 1, double: 1, previewKey: null, doubleArmed: false, previewExpiresAt: null },
  };
}
function pickRandomStatClashHouseRule() {
  return STAT_CLASH_HOUSE_RULES[Math.floor(Math.random() * STAT_CLASH_HOUSE_RULES.length)];
}
function getStatClashLowestStatKey(stats) {
  if (!stats) return null;
  let best = null;
  for (const k of STAT_CLASH_STAT_KEYS) {
    const v = Number(stats[k]) || 0;
    if (!best || v < best.value) best = { key: k, value: v };
  }
  return best ? best.key : null;
}
function getStatClashHouseRuleForcedStatsRoom(room, side) {
  if (!room || !room.houseRuleEnabled) return null;
  const imposedRule = room.houseRuleBySide?.[side] || null;
  const legacyRule = !room.houseRuleBySide && room.houseRule ? room.houseRule : null;
  const sharedRule = room.houseRuleShared || legacyRule || null;
  const rule = imposedRule || null;
  const id = rule?.id || legacyRule?.id;
  const round = room.round;
  const total = room.totalRounds || STAT_CLASH_TOTAL_ROUNDS;
  const target = legacyRule ? room.houseRuleTargetSide || null : null;
  const targetOnly = target && side && side !== target;
  if (legacyRule && (id === "atkRound3" || id === "weakStart") && targetOnly) return null;
  if (id === "atkRound3" && (round === 3 || round === 4)) return ["attack"];
  if (id === "noSpeedEarly" && round <= Math.min(3, total - 1)) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "speed");
  if (id === "noHpFinal" && (round === total || round === total - 1)) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "hp");
  if (id === "weakStart" && (round === 1 || round === 2)) {
    const low = getStatClashLowestStatKey(room.currentStats);
    return low ? [low] : null;
  }
  if (sharedRule?.id === "mirrorRound4" && round === 4 && room.mirrorStatKey) return [room.mirrorStatKey];
  return null;
}
function getStatClashAllowedStatsRoom(room, side) {
  if (!room) return STAT_CLASH_STAT_KEYS.slice();
  const used = new Set((room.usedStatKeysBySide && room.usedStatKeysBySide[side]) || []);
  let pool = STAT_CLASH_STAT_KEYS.filter((k) => !used.has(k));
  if (room.suddenDeath) pool = STAT_CLASH_STAT_KEYS.slice();
  const forced = getStatClashHouseRuleForcedStatsRoom(room, side);
  if (Array.isArray(forced) && forced.length) {
    pool = pool.filter((k) => forced.includes(k));
    if (!pool.length && forced.length) pool = forced.slice();
  }
  const blindOptions = room.blindRound5OptionsBySide?.[side];
  if (Array.isArray(blindOptions) && blindOptions.length) {
    const intersect = pool.filter((k) => blindOptions.includes(k));
    pool = intersect.length ? intersect : blindOptions.slice();
  }
  return pool;
}
function getStatClashHouseRuleTimerMsRoom(room) {
  const base = STAT_CLASH_PICK_MS;
  if (!room || !room.houseRuleEnabled) return base;
  const imposedRules = Object.values(room.houseRuleBySide || {});
  const hasPressure = imposedRules.some((rule) => rule?.id === "pressureLate") || (!room.houseRuleBySide && room.houseRule?.id === "pressureLate");
  if (hasPressure && room.round >= Math.ceil((room.totalRounds || STAT_CLASH_TOTAL_ROUNDS) / 2)) return STAT_CLASH_PRESSURE_PICK_MS;
  return base;
}
function applyStatClashDoubleStatRoom(room, statKey, value) {
  let total = Number(value) || 0;
  const sharedRule = room?.houseRuleShared || (!room?.houseRuleBySide ? room?.houseRule : null);
  if (room && sharedRule?.id === "doubleStat" && room.doubleStatKey === statKey && room.houseRuleEnabled) total *= 2;
  return total;
}
function normalizeStatClashFormat(value) {
  return STAT_CLASH_FORMATS[value] ? value : "standard";
}
function clearStatClashPreviewTimers(room) {
  if (!room || !room.previewTimers) return;
  for (const side of ["left", "right"]) {
    if (room.previewTimers[side]) { clearTimeout(room.previewTimers[side]); room.previewTimers[side] = null; }
  }
}
const FETCH_TIMEOUT_MS = 8000;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMITS = {
  "room-join":   { max: 5,  windowMs: 30_000 },
  "resume":      { max: 8,  ipMax: 40, windowMs: RATE_LIMIT_WINDOW_MS },
  "guess":       { max: 10, windowMs: RATE_LIMIT_WINDOW_MS },
  "pick":        { max: 6,  windowMs: RATE_LIMIT_WINDOW_MS },
  "action":      { max: 10, windowMs: RATE_LIMIT_WINDOW_MS },
  "gen-update":  { max: 5,  windowMs: RATE_LIMIT_WINDOW_MS },
  "restart":     { max: 3,  windowMs: RATE_LIMIT_WINDOW_MS },
  "commit":      { max: 10, windowMs: RATE_LIMIT_WINDOW_MS },
  "party-guess": { max: 12, windowMs: RATE_LIMIT_WINDOW_MS },
};
const PAYLOAD_MAX_BYTES = 64_000;
const DRAFT_BATTLE_MAX_TEAM_INDEX = 5;
const rateLimitBuckets = new Map();

function normalizeClientAddress(value) {
  let address = String(value || "").trim();
  if (!address) return "";
  const bracketMatch = address.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) address = bracketMatch[1];
  if (address.startsWith("::ffff:")) address = address.slice(7);
  const ipv4WithPort = address.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort) address = ipv4WithPort[1];
  return address.toLowerCase();
}

function getClientAddress(socket) {
  const forwarded = socket?.handshake?.headers?.["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const forwardedAddress = String(forwardedValue || "").split(",")[0];
  return normalizeClientAddress(forwardedAddress)
    || normalizeClientAddress(socket?.handshake?.address)
    || normalizeClientAddress(socket?.request?.socket?.remoteAddress)
    || "unknown";
}

function getRateLimitBucket(key, windowMs) {
  let bucket = rateLimitBuckets.get(key);
  if (!bucket) {
    bucket = { hits: [], windowMs };
    rateLimitBuckets.set(key, bucket);
  }
  bucket.windowMs = windowMs;
  return bucket;
}

function pruneBucket(bucket, now) {
  const cutoff = now - bucket.windowMs;
  while (bucket.hits.length && bucket.hits[0] <= cutoff) bucket.hits.shift();
}

function pruneRateLimitBuckets(now) {
  if (rateLimitBuckets.size < 1000) return;
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    pruneBucket(bucket, now);
    if (!bucket.hits.length) rateLimitBuckets.delete(key);
  }
}

function getRateLimitBucketSpecs(socket, category, cfg) {
  const socketId = typeof socket === "string" ? socket : socket?.id;
  const clientAddress = typeof socket === "string" ? "" : getClientAddress(socket);
  const specs = [];
  if (socketId) {
    specs.push({ key: `socket:${socketId}:${category}`, max: cfg.max, windowMs: cfg.windowMs });
  }
  if (clientAddress && clientAddress !== "unknown") {
    specs.push({ key: `ip:${clientAddress}:${category}`, max: cfg.ipMax || Math.max(cfg.max * 2, cfg.max + 2), windowMs: cfg.windowMs });
  }
  return specs;
}

function checkRateLimit(socket, category) {
  const cfg = RATE_LIMITS[category];
  if (!cfg) return false;
  const now = Date.now();
  pruneRateLimitBuckets(now);
  const specs = getRateLimitBucketSpecs(socket, category, cfg);
  if (!specs.length) return false;
  const limited = specs.some((spec) => {
    const bucket = getRateLimitBucket(spec.key, spec.windowMs);
    pruneBucket(bucket, now);
    return bucket.hits.length >= spec.max;
  });
  if (limited) return true;
  specs.forEach((spec) => getRateLimitBucket(spec.key, spec.windowMs).hits.push(now));
  return false;
}

function cleanupRateLimitBuckets(socketId) {
  const prefix = `socket:${socketId}:`;
  for (const key of rateLimitBuckets.keys()) {
    if (key.startsWith(prefix)) rateLimitBuckets.delete(key);
  }
}

function maskCode(code) {
  if (!code || code.length <= 2) return "**";
  return code.slice(0, 2) + "*".repeat(code.length - 2);
}

function isPayloadOversized(payload) {
  try {
    return JSON.stringify(payload).length > PAYLOAD_MAX_BYTES;
  } catch (_error) {
    return true;
  }
}

// --- Service statique restreint (lot A audit 2026-06-10) ---
// On ne sert plus __dirname entier (exposait server.js, package.json, node_modules/).
// Seuls les assets réellement publics sont montés explicitement.
const DIST_DIR = path.join(__dirname, "dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");
const SOURCE_INDEX = path.join(__dirname, "index.html");

function recordVisitDb() {
  if (!pgPool) return;
  pgPool.query("INSERT INTO visits (day, hits) VALUES (CURRENT_DATE, 1) ON CONFLICT (day) DO UPDATE SET hits = visits.hits + 1").catch(() => {});
}
function sendIndex(req, res) {
  // L'index n'est jamais mise en cache : c'est elle qui porte les URLs versionnées.
  res.set("Cache-Control", "no-cache");
  recordVisitDb();
  const file = fs.existsSync(DIST_INDEX) ? DIST_INDEX : SOURCE_INDEX;
  // Retour de l'ancienne adresse : la progression du joueur part dans la page (lib/site-move.js).
  const moved = siteMove.takeTransfer(req, res);
  if (!moved) return res.sendFile(file);
  res.set("Cache-Control", "no-store");
  res.type("html").send(injectTransfer(fs.readFileSync(file, "utf8"), moved));
}

app.get(["/", "/index.html"], (req, res) => sendIndex(req, res));
// Development-only responsive workbench; never served by npm start in production.
if (process.env.NODE_ENV === "development") {
  app.get("/__responsive", (_req, res) => res.sendFile(path.join(__dirname, "tools/responsive.html")));
  app.get("/__responsive.js", (_req, res) => res.sendFile(path.join(__dirname, "tools/responsive.js")));
}
// Page émulateur (lot D audit) : même SPA, mais servie sous /emulateur avec la
// CSP permissive requise par EmulatorJS. Le client y ouvre l'écran émulateur.
app.get("/emulateur", (req, res) => { recordUsage("solo:emulator"); sendIndex(req, res); });
// dist/* : noms stables, mais référencés en dist/x.min.js?v=<hash> depuis
// dist/index.html (cf. build.mjs) -> cache long sans risque de stale.
app.use("/dist", express.static(DIST_DIR, { maxAge: "365d", immutable: true, fallthrough: false }));
// Images locales (partage de classement).
for (const publicImage of ["genbar.png", "typebar.png", "genbar.webp", "typebar.webp"]) {
  app.get(`/${publicImage}`, (_req, res) => res.sendFile(path.join(__dirname, publicImage), { maxAge: "7d" }));
}
// Image Open Graph (aperçus de lien Discord/Twitter/WhatsApp).
// --- OG image dynamique : illustration décorative, indépendante du Daily.
// Fallback : l'og-image.png statique si sharp ou le réseau manquent. ---
let sharp = null;
try { sharp = require("sharp"); } catch (_e) { console.error("[og] sharp indisponible — OG statique servie"); }

function getServerDailyPokemon() {
  const key = serverUTCDateKey();
  const seedSource = `pokedle:${key}`;
  let h = 2166136261;
  for (let i = 0; i < seedSource.length; i += 1) {
    h ^= seedSource.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  const rng = () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = POKEMON_LIST
    .filter((p) => p && !p.isAltForm && Number(p.id) < 20000)
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));
  return { key, pokemon: pool[Math.floor(rng() * pool.length)] };
}

// Silhouette OG : un Pokémon ALÉATOIRE (jamais la réponse du jour) pour ne pas spoiler.
// Stable sur la journée (graine "pokedle-og:<date>"), change chaque jour.
function getOgSilhouettePokemon() {
  const key = require("./lib/daily-game").dailyCalendar().day;
  const daily = getServerDailyPokemon().pokemon;
  const seedSource = `pokedle-og:${key}`;
  let h = 2166136261;
  for (let i = 0; i < seedSource.length; i += 1) {
    h ^= seedSource.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  const rng = () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = POKEMON_LIST.filter((p) => p && !p.isAltForm && Number(p.id) < 20000);
  if (!pool.length) return daily;
  let idx = Math.floor(rng() * pool.length);
  if (daily && pool[idx] && pool[idx].id === daily.id) idx = (idx + 1) % pool.length;
  return pool[idx];
}

const ogCache = { key: null, buffer: null, pending: null };

async function buildDailyOgBuffer() {
  const key = require("./lib/daily-game").dailyCalendar().day;
  const pokemon = getOgSilhouettePokemon();
  const artworkUrl = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
  const resp = await fetch(artworkUrl, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`artwork HTTP ${resp.status}`);
  const artwork = Buffer.from(await resp.arrayBuffer());
  const resized = await sharp(artwork).resize(460, 460, { fit: "inside" }).ensureAlpha().png().toBuffer();
  const meta = await sharp(resized).metadata();
  const silhouette = await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: "#13224a" } })
    .joinChannel(await sharp(resized).extractChannel(3).toBuffer())
    .png()
    .toBuffer();
  const [, mo, da] = key.split("-");
  const dateLabel = `${da}/${mo}/${key.slice(0, 4)}`;
  const baseSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e4382f"/>
      <stop offset="0.55" stop-color="#7d4bd6"/>
      <stop offset="1" stop-color="#2f76ff"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="0.75" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="885" cy="318" r="265" fill="url(#halo)"/>
  <circle cx="885" cy="318" r="232" fill="#ffffff" fill-opacity="0.92"/>
  <text x="80" y="178" font-family="sans-serif" font-weight="bold" font-size="92" fill="#ffffff">Pokédle</text>
  <text x="84" y="248" font-family="sans-serif" font-weight="bold" font-size="38" fill="#ffe9b3">Devine le Pokémon du jour</text>
  <rect x="84" y="296" rx="26" ry="26" width="280" height="52" fill="#ffcc33"/>
  <text x="224" y="332" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="30" fill="#4a3203">${dateLabel}</text>
  <text x="84" y="432" font-family="sans-serif" font-weight="bold" font-size="44" fill="#ffffff">Tu le reconnais ?</text>
  <text x="84" y="560" font-family="sans-serif" font-size="28" fill="#dce9ff">pokdle.fr</text>
</svg>`;
  const buffer = await sharp(Buffer.from(baseSvg))
    .composite([{ input: silhouette, left: Math.round(885 - meta.width / 2), top: Math.round(318 - meta.height / 2) }])
    .png()
    .toBuffer();
  return { key, buffer };
}

app.get("/og-image.png", async (_req, res) => {
  const key = require("./lib/daily-game").dailyCalendar().day;
  try {
    if (sharp) {
      if (ogCache.key !== key) {
        if (!ogCache.pending) {
          ogCache.pending = buildDailyOgBuffer()
            .then((result) => { ogCache.key = result.key; ogCache.buffer = result.buffer; ogCache.pending = null; })
            .catch((error) => { ogCache.pending = null; throw error; });
        }
        await ogCache.pending;
      }
      if (ogCache.key === key && ogCache.buffer) {
        res.set("Cache-Control", "public, max-age=3600");
        res.type("png");
        return res.send(ogCache.buffer);
      }
    }
  } catch (error) {
    console.error("[og] génération échouée :", error?.message || "unknown");
  }
  res.sendFile(path.join(__dirname, "og-image.png"), { maxAge: "1h" });
});
// Icônes de types (utilisées par les badges de types dans tous les modes).
app.use("/types", express.static(path.join(__dirname, "types"), { maxAge: "7d", fallthrough: false }));
app.use("/img", express.static(path.join(__dirname, "img"), { maxAge: "30d", fallthrough: false }));
// Installation sur l'écran d'accueil (iOS et Android).
app.get("/manifest.webmanifest", (_req, res) => {
  res.type("application/manifest+json");
  res.sendFile(path.join(__dirname, "manifest.webmanifest"), { maxAge: "1h" });
});
app.get("/apple-touch-icon.png", (_req, res) => res.sendFile(path.join(__dirname, "img/app-icons/pokedle-180-v1.png"), { maxAge: "1d" }));
// Icône de site : Bing et Google l'affichent à côté des résultats (cf. tools/favicon.js).
app.get("/favicon.ico", (_req, res) => res.sendFile(path.join(__dirname, "favicon.ico"), { maxAge: "7d" }));
app.get("/favicon.svg", (_req, res) => res.sendFile(path.join(__dirname, "favicon.svg"), { maxAge: "7d" }));
// Données de formes alternatives embarquées (lot B audit) : évite ~170 appels
// PokeAPI par nouveau visiteur.
app.get("/forms-data.json", (_req, res) => res.sendFile(path.join(__dirname, "forms-data.json"), { maxAge: "1d" }));
app.get("/base-stats.json", (_req, res) => res.sendFile(path.join(__dirname, "base-stats.json"), { maxAge: "1d" }));
// SEO.
app.get("/robots.txt", (_req, res) => res.sendFile(path.join(__dirname, "robots.txt"), { maxAge: "1d" }));
app.get("/googled8d0a3d4583f5db3.html", (_req, res) => res.sendFile(path.join(__dirname, "googled8d0a3d4583f5db3.html")));
app.get("/confidentialite", (_req, res) => res.sendFile(path.join(__dirname, "confidentialite.html"), { maxAge: "1h" }));
// One page per game (/jeux, /jeux/<slug>) and the sitemap that lists them.
require("./lib/seo-render").mountSeoPages(app);

app.get("/api/multiplayer/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, pokemon: POKEMON_LIST.length });
});

// --- Fréquentation : compteurs anonymes en mémoire (14 jours) et en
// PostgreSQL (90 jours), sans identifiant de joueur dans la table agrégée.
// L'interface reste /admin/stats?key=..., protégée par ADMIN_STATS_KEY. ---
const usageMetrics = require("./lib/usage-metrics");
const USAGE_EVENTS = new Set([
  ...usageMetrics.COMPLETION_EVENTS,
  "visit",
  "solo:normal", "solo:daily", "solo:challenge", "solo:silhouette", "solo:pixel", "solo:mystery", "solo:cry",
  "solo:quiz", "solo:description", "solo:weight", "solo:evolution", "solo:order", "solo:odd", "solo:quiestce", "solo:petitbac",
  "solo:higherlower", "solo:connections", "solo:speedrun", "solo:statauction", "solo:scoreattack",
  "solo:draft", "solo:statclash", "solo:emulator",
  "party:create", "party:join",
  "party:start:dexrace", "party:start:coop", "party:start:deduction", "party:start:quiestce1v1", "party:start:petitbac", "party:start:nearest", "party:start:guess", "party:start:typecombo", "party:start:duocriteria", "party:start:statclash", "party:start:statclashparty",
  "duel:create", "statclash:create",
]);
const USAGE_LABELS = {
  visit: "Visites", "solo:daily": "Pokémon du jour", "solo:normal": "Classique", "solo:challenge": "Challenge",
  "solo:silhouette": "Silhouette", "solo:pixel": "Pixelisé", "solo:mystery": "Mystère", "solo:cry": "Cri",
  "solo:quiz": "Quiz", "solo:description": "Description", "solo:weight": "Duel de poids", "solo:evolution": "Évolution",
  "solo:order": "Ordre Pokédex", "solo:odd": "Intrus", "solo:quiestce": "Qui est-ce ?", "solo:petitbac": "Petit Bac", "solo:higherlower": "Higher or Lower",
  "solo:connections": "Poké-Connections", "solo:speedrun": "Speedrun", "solo:statauction": "Enchères de stats",
  "solo:scoreattack": "Score Attack", "solo:draft": "Draft Arènes", "solo:statclash": "Stat Clash (rapide)",
  "solo:emulator": "Émulateur", "party:create": "Party — rooms créées", "party:join": "Party — joueurs rejoints",
  "party:start:dexrace": "Party — Course au Pokédex", "party:start:coop": "Party — Enquête coop", "party:start:deduction": "Party — Pokémon mystère", "party:start:quiestce1v1": "Party — Qui est-ce ?", "party:start:petitbac": "Party — Petit Bac", "party:start:nearest": "Party — Numéro mystère", "party:start:guess": "Party — Course Pokémon", "party:start:typecombo": "Party — Combo de types",
  "party:start:duocriteria": "Party — Duo de critères", "party:start:statclash": "Party — Meilleure stat",
  "party:start:statclashparty": "Party — Stat Clash", "duel:create": "Duel 1v1 — rooms", "statclash:create": "Stat Clash 1v1 — rooms",
};
const usageDays = new Map(); // dateKey -> { events: Map } (diagnostic since restart only)
const USAGE_MAX_DAYS = 14;
const usageBootedAt = new Date();
const usageMetricsReady = pgPool ? authDbReady.then(async () => {
  await usageMetrics.ensureTable(pgPool);
  await usageMetrics.prune(pgPool);
  return true;
}).catch((error) => {
  console.warn("[usage] PostgreSQL aggregate counters unavailable:", String(error.message || error).slice(0, 160));
  return false;
}) : Promise.resolve(false);
if (pgPool) {
  const cleanup = setInterval(() => {
    void usageMetricsReady.then((ready) => ready ? usageMetrics.prune(pgPool) : null).catch((error) => {
      console.warn("[usage] aggregate cleanup failed:", String(error.message || error).slice(0, 160));
    });
  }, 24 * 3600000);
  cleanup.unref?.();
}

function pruneUsageMemory() {
  const cutoff = usageMetrics.startDay(USAGE_MAX_DAYS);
  for (const day of usageDays.keys()) if (day < cutoff) usageDays.delete(day);
}
const usageMemoryCleanup = setInterval(pruneUsageMemory, 24 * 3600000);
usageMemoryCleanup.unref?.();
function getUsageDay(key) {
  pruneUsageMemory();
  if (!usageDays.has(key)) {
    while (usageDays.size >= USAGE_MAX_DAYS) usageDays.delete(usageDays.keys().next().value);
    usageDays.set(key, { events: new Map() });
  }
  return usageDays.get(key);
}

function recordUsage(event, uid) {
  if (!USAGE_EVENTS.has(event)) return;
  const key = serverUTCDateKey();
  const day = getUsageDay(key);
  day.events.set(event, (day.events.get(event) || 0) + 1);
  console.log("[usage]", JSON.stringify({ d: key, e: event }));
  // Both tables persist aggregates only. The visitor bitmap is updated on
  // genuine page-visit events, never from game actions or completion events.
  if (pgPool) void usageMetricsReady.then(async (ready) => {
    if (!ready) return;
    await usageMetrics.increment(pgPool, event, key);
    if (event === "visit") await usageMetrics.recordUnique(pgPool, uid, key);
  }).catch((error) => console.warn("[usage] aggregate write failed:", String(error.message || error).slice(0, 160)));
}

// Garde-fou simple : 120 événements/minute par IP.
const usageRate = new Map();
function usageRateLimited(ip) {
  const now = Date.now();
  const entry = usageRate.get(ip);
  if (!entry || now - entry.ts > 60000) { usageRate.set(ip, { ts: now, count: 1 }); if (usageRate.size > 2000) usageRate.clear(); return false; }
  entry.count += 1;
  return entry.count > 120;
}

app.post("/api/track", express.json({ limit: "1kb" }), (req, res) => {
  const event = typeof req.body?.event === "string" ? req.body.event : "";
  if (!USAGE_EVENTS.has(event)) return res.status(400).json({ ok: false });
  if (usageRateLimited(req.ip || "?")) return res.status(429).json({ ok: false });
  recordUsage(event, req.body?.uid);
  res.json({ ok: true });
});

// « Donne ton avis »: players' ideas, bugs and opinions, read on /admin/stats.
const feedback = require("./lib/feedback");
const feedbackReady = pgPool ? authDbReady.then(async () => {
  await feedback.ensureTable(pgPool);
  return true;
}).catch((error) => {
  console.warn("[feedback] table unavailable:", String(error.message || error).slice(0, 160));
  return false;
}) : Promise.resolve(false);
feedback.mountFeedbackRoutes(app, { express, db: pgPool, ready: feedbackReady });

// The admin panel (/admin): news banner and shared photos, for the accounts in ADMIN_ACCOUNT_IDS.
const adminPanelReady = pgPool ? authDbReady.then(async () => {
  await adminPanel.ensureTables(pgPool);
  return true;
}).catch((error) => {
  console.warn("[admin] tables unavailable:", String(error.message || error).slice(0, 160));
  return false;
}) : Promise.resolve(false);
adminPanel.mountAdminRoutes(app, { express, db: pgPool, ready: adminPanelReady, getSessionUser: (req) => (authReady() ? getSessionUser(req) : null), adminIds: ADMIN_ACCOUNT_IDS });

app.get("/admin/stats", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex");
  const adminKey = process.env.ADMIN_STATS_KEY || "";
  if (!adminKey) return res.status(503).send("Configure la variable d'environnement ADMIN_STATS_KEY sur Render pour activer cette page.");
  if ((req.query.key || "") !== adminKey) return res.status(403).send("Clé invalide.");
  let feedbackHtml = "<p>(base non connectée — messages des joueurs indisponibles)</p>";
  try { if (pgPool && await feedbackReady) feedbackHtml = feedback.feedbackSectionHtml(await feedback.recent(pgPool, 50)); } catch (_error) { feedbackHtml = "<p>Messages des joueurs indisponibles pour le moment.</p>"; }
  let visitTotalHtml = "<p>(base non connectée — compteur persistant inactif)</p>";
  let aggregateHtml = "<p>Compteurs quotidiens persistants indisponibles.</p>";
  let metrics = null, uniqueDays = null;
  try {
    if (pgPool && await usageMetricsReady) {
      metrics = await usageMetrics.recent(pgPool, 14);
      uniqueDays = await usageMetrics.recentUniques(pgPool, 14);
    }
  } catch (error) {
    console.warn("[usage] persistent stats unavailable:", String(error.message || error).slice(0, 160));
  }
  if (pgPool) {
    try {
      // Real visits: one per browser session, sent by the page itself (« visit »). Robots,
      // link previews and keep-alive pings never run the page, but every one of them loads
      // « / »: the raw count stays alongside, for comparison only.
      const vd = await pgPool.query("SELECT to_char(day, 'YYYY-MM-DD') AS d, hits FROM visits ORDER BY day DESC LIMIT 14");
      const raw = new Map(vd.rows.map((r) => [r.d, Number(r.hits) || 0]));
      const real = new Map((metrics || []).filter((r) => r.event === "visit").map((r) => [r.day, Number(r.hits) || 0]));
      const unique = new Map((uniqueDays || []).map((r) => [r.day, Number(r.uniques) || 0]));
      const days = [...new Set([...real.keys(), ...raw.keys(), ...unique.keys()])].sort().reverse().slice(0, 14);
      const label = (day) => day.slice(8, 10) + "/" + day.slice(5, 7) + "/" + day.slice(0, 4);
      const realTotal = days.reduce((sum, day) => sum + (real.get(day) || 0), 0);
      const today = usageMetrics.utcDay(), todayUnique = uniqueDays === null ? "indisponible" : (unique.get(today) || 0);
      visitTotalHtml = `<h2 style="margin-top:24px">Visites — 14 derniers jours (base persistante)</h2><p><b style="font-size:1.6rem;color:#2f76ff">${realTotal}</b> visites réelles : une par session de navigateur qui a vraiment ouvert le site. <b>${todayUnique}</b> visiteurs uniques estimés aujourd’hui (UTC).</p>` +
        `<p>« Visiteurs uniques estimés » compte les navigateurs distincts par jour grâce à une empreinte statistique (faible risque de sous-comptage), conservée 90 jours. Aucun identifiant de navigateur ni aucune adresse IP n'est enregistré dans cette table. Historique disponible uniquement depuis l'activation de ce compteur ; « — » signifie non mesuré, pas zéro.</p>` +
        `<p>« Chargements bruts » compte chaque appel de la page d'accueil, robots (Google, aperçus de liens) et pings de maintien en éveil compris : ne pas le lire comme une audience.</p>` +
        `<table><thead><tr><th>Jour</th><th>Visites réelles</th><th>Visiteurs uniques estimés</th><th>Chargements bruts</th></tr></thead><tbody>${days.map((day) => `<tr><th>${label(day)}</th><td>${real.has(day) ? real.get(day) : "—"}</td><td>${unique.has(day) ? unique.get(day) : "—"}</td><td>${raw.has(day) ? raw.get(day) : "—"}</td></tr>`).join("")}</tbody></table>`;
    } catch (e) { visitTotalHtml = "<p>(compteur persistant indisponible : " + e.message + ")</p>"; }
  }
  try {
    if (metrics) {
      const summary = usageMetrics.summarizeModes(metrics, USAGE_LABELS);
      const rows = summary.map((row) => {
        const name = String(row.label).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
        return `<tr><th>${name}</th><td>${row.launches}</td><td>${row.finishInstrumented ? row.completions : "—"}</td><td>${row.finishInstrumented ? row.wins : "—"}</td><td>${row.finishInstrumented ? row.losses : "—"}</td></tr>`;
      }).join("");
      aggregateHtml = '<h2 style="margin-top:24px">Modes joués — 14 derniers jours (base persistante)</h2>' +
        '<p>Événements déclarés par les navigateurs : démarrages et manches conclues, pas des personnes uniques. Un mode peut comporter plusieurs manches par lancement ; <b>ces totaux ne sont pas des taux de conversion ni de rétention</b>. Aucune réponse de jeu, adresse IP ou identité n’est enregistrée dans les agrégats (conservés 90 jours maximum).</p>' +
        '<table><thead><tr><th>Mode</th><th>Démarrages</th><th>Fins</th><th>Victoires</th><th>Défaites ou abandons</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="5">Aucune partie suivie dans cette période.</td></tr>') + '</tbody></table>';
    }
  } catch (error) {
    console.warn("[usage] aggregate read failed:", String(error.message || error).slice(0, 160));
    aggregateHtml = "<p>Impossible de lire les agrégats du moment.</p>";
  }
  pruneUsageMemory();
  const dayKeys = [...usageDays.keys()].sort().slice(-7);
  const events = [...USAGE_EVENTS].filter((e) => dayKeys.some((k) => usageDays.get(k).events.has(e)));
  const cell = (v) => `<td>${v || ""}</td>`;
  const rows = events.map((e) => {
    const total = dayKeys.reduce((s, k) => s + (usageDays.get(k).events.get(e) || 0), 0);
    return `<tr><th>${USAGE_LABELS[e] || e}</th>${dayKeys.map((k) => cell(usageDays.get(k).events.get(e))).join("")}<td class="t">${total}</td></tr>`;
  }).join("");
  res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Pokédle — stats</title><meta name="robots" content="noindex">
<style>body{font-family:system-ui,sans-serif;background:#f4f8ff;color:#1d2b4a;padding:24px;}table{border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(29,43,74,.08);}th,td{padding:8px 14px;border-bottom:1px solid #e6eefb;text-align:right;font-variant-numeric:tabular-nums;}th{text-align:left;}thead th{background:#1d2b4a;color:#fff;text-align:right;}thead th:first-child{text-align:left;}td.t{font-weight:800;background:#fff7df;}p{color:#5a6f96;max-width:640px;}</style>
</head><body><h1>Pokédle — fréquentation</h1>${feedbackHtml}${visitTotalHtml}${aggregateHtml}
<p>Événements de diagnostic en mémoire depuis le ${usageBootedAt.toISOString().replace("T", " ").slice(0, 16)} UTC (réinitialisés au redémarrage ; les visites et visiteurs uniques estimés sont conservés dans les tableaux persistants ci-dessus).</p>
<table><thead><tr><th>Événement (depuis redémarrage)</th>${dayKeys.map((k) => `<th>${k.slice(5)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows || ""}</tbody></table>
${events.length ? "" : "<p>Aucun événement enregistré pour le moment.</p>"}</body></html>`);
});

// Diagnostic protégé : teste directement le client_secret Discord via client_credentials.
// Ne passe PAS par la fenêtre de connexion. 200 = secret valide, 401 = secret refusé, 429 = IP temporairement bloquée.
app.get("/admin/discord-check", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex");
  const adminKey = process.env.ADMIN_STATS_KEY || "";
  if (!adminKey) return res.status(503).type("text/plain").send("Configure ADMIN_STATS_KEY sur Render.");
  if ((req.query.key || "") !== adminKey) return res.status(403).type("text/plain").send("Cle invalide.");
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.type("text/plain").send("Manque DISCORD_CLIENT_ID ou DISCORD_CLIENT_SECRET cote serveur.");
  }
  try {
    const basic = Buffer.from(DISCORD_CLIENT_ID + ":" + DISCORD_CLIENT_SECRET).toString("base64");
    const r = await fetch(`${DISCORD_API_BASE}/api/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + basic },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "identify" }),
      signal: AbortSignal.timeout(8000),
    });
    let verdict;
    if (r.status === 200) verdict = "OK — le client_secret est VALIDE. Le probleme de connexion ne vient PAS du secret.";
    else if (r.status === 401) verdict = "REFUSE (401) — le client_secret cote Render ne correspond pas. Re-colle le bon Client Secret (OAuth2).";
    else if (r.status === 429) verdict = "429 — IP temporairement bloquee par Discord. Attends ~30-60 min sans aucune tentative, puis recommence.";
    else verdict = "Statut inattendu " + r.status + ".";
    const detail = r.status === 200 ? "" : ("\n\nReponse Discord : " + (await r.text()).slice(0, 300));
    res.type("text/plain").send("HTTP " + r.status + "\n" + verdict + detail);
  } catch (e) {
    res.type("text/plain").send("Erreur reseau : " + e.message);
  }
});

function generatePartyRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (partyRooms.has(code));
  return code;
}

// The level a player shows in a Party Room, sent by their browser (1 to 100), or none.
function sanitizePartyLevel(value) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 100 ? level : null;
}

function joinPlayerToPartyRoom(room, socket, nickname, level = null) {
  socket.join(room.code);
  socket.data.partyRoomCode = room.code;
  const blue = room.players.filter(p => p.raceTeam === 'blue').length;
  const coral = room.players.filter(p => p.raceTeam === 'coral').length;
  const player = {
    id: socket.id,
    nickname,
    level,
    connected: true,
    score: 0,
    correct: false,
    raceTeam: blue <= coral ? 'blue' : 'coral',
    reconnectToken: crypto.randomBytes(18).toString("hex"),
    reconnectUntil: null,
    reconnectTimer: null,
  };
  room.players.push(player);
  return player;
}

function publicPartyGuessRoundState(room, revealed) {
  if (!room.target) return null;
  return { image: room.target.sprite || null, answer: revealed ? room.target.name : null, variant: room.variant || "normal" };
}

function publicPartyStatClashRoundState(room, revealed) {
  if (!room.target) return null;
  return {
    mode: room.gameMode || "statclash",
    image: room.target.sprite || null,
    name: room.target.name,
    statKeys: STAT_CLASH_STAT_KEYS,
    statLabels: PARTY_STAT_LABELS,
    stats: revealed ? (room.targetStats || null) : null,
    bestStat: revealed ? (room.bestStatKey || null) : null,
  };
}

function publicPartyTypeComboRoundState(room, revealed) {
  const combo = room.typeCombo;
  if (!combo) return null;
  const tier = partyTypeComboTier(Number(combo.count) || 0);
  return {
    mode: "typecombo",
    types: combo.displayTypes || combo.types || [],
    count: Number(combo.count) || 0,
    difficulty: { tier: tier.tier, label: tier.label },
    points: tier.points,
    answer: revealed ? (room.typeComboWinnerAnswer || null) : null,
    answerSprite: revealed ? (room.typeComboWinnerSprite || null) : null,
    winnerGain: revealed ? (Number(room.typeComboWinnerGain) || 0) : null,
    examples: revealed ? (combo.examples || []) : [],
  };
}

function publicPartyNearestRoundState(room, revealed) {
  return room.nearestTarget ? nearestParty.publicNearestRound(room, revealed) : null;
}

function resolvePartyNearestRound(room) {
  if (nearestParty.scoreNearestRound(room)) endPartyRound(room);
}

function publicPartyRoomState(room, viewerId = null) {
  const revealed = room.status === "finished" || room.status === "complete";
  const gameMode = room.gameMode || "guess";
  const roundState = room.status === "waiting" ? null : gameMode === "dexrace" ? dexRace.publicRace(room) : gameMode === "coop"
    ? coopParty.publicCoopRound(room, viewerId, revealed)
    : gameMode === "deduction"
    ? deductionParty.publicDeductionRound(room, revealed)
    : gameMode === "quiestce1v1"
    ? quiEstCeParty.publicQuiEstCeDuel(room, viewerId, revealed)
    : gameMode === "petitbac"
    ? petitBacParty.publicPetitBac(room, viewerId)
    : gameMode === "nearest"
    ? publicPartyNearestRoundState(room, revealed)
    : gameMode === "typecombo"
    ? publicPartyTypeComboRoundState(room, revealed)
    : gameMode === "duocriteria"
    ? publicPartyDuoRoundState(room, revealed)
    : (gameMode === "statclash" || gameMode === "statclashparty")
      ? publicPartyStatClashRoundState(room, revealed)
      : publicPartyGuessRoundState(room, revealed);
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    minPlayers: PARTY_MIN_PLAYERS,
    maxPlayers: PARTY_MAX_PLAYERS,
    connectedCount: room.players.filter((player) => player.connected).length,
    reconnectGraceMs: typeof PARTY_RECONNECT_GRACE_MS !== "undefined" ? PARTY_RECONNECT_GRACE_MS : 30000,
    roundNumber: Number(room.roundNumber) || 0,
    totalRounds: Number(room.totalRounds) || PARTY_TOTAL_ROUNDS,
    deadlineAt: room.deadlineAt || null,
    gameMode,
    raceFormat: room.raceFormat || "duel",
    bacOptions: gameMode === "petitbac" ? petitBacParty.publicOptions(room, POKEMON_LIST) : null,
    raceDuration: room.raceDuration === 0 ? 0 : room.raceDuration === 300 ? 300 : 180,
    selectedGens: Array.isArray(room.selectedGens) ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9],
    round: roundState,
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      level: player.level || null,
      connected: player.connected,
      reconnectUntil: player.connected ? null : (Number(player.reconnectUntil) || null),
      raceTeam: player.raceTeam || "blue",
      score: Number(player.score) || 0,
      correct: Boolean(player.correct),
      lastGain: Number(player.lastGain) || 0,
      attempts: gameMode === "deduction" || gameMode === "quiestce1v1" ? Number(player.attempts) || 0 : 0,
      proximity: gameMode === "deduction" ? bestDuelProximity(player) : 0,
      gaveUp: (gameMode === "deduction" || gameMode === "quiestce1v1") && Boolean(player.gaveUp),
      quiRemaining: gameMode === "quiestce1v1" ? quiEstCeParty.quiEstCeRemainingCount(room, player) : 0,
      guessHistory: gameMode === "deduction" && player.id === viewerId ? player.guesses || [] : [],
      submitted: gameMode === "nearest" && Boolean(player.nearestPick),
      proposal: gameMode === "nearest" && player.id === viewerId ? player.nearestPick?.name || null : null,
      pickKey: player.pickKey || null,
      usedStatKeys: Array.isArray(player.usedStatKeys) ? player.usedStatKeys : [],
      isSelf: player.id === viewerId,
      isHost: player.id === room.hostId,
    })),
  };
}

function emitPartyRoomState(room) {
  for (const player of room.players) {
    if (!player.connected) continue;
    io.to(player.id).emit("party:room-state", publicPartyRoomState(room, player.id));
  }
}

function findPartyRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.partyRoomCode;
  if (roomCode && partyRooms.has(roomCode)) return partyRooms.get(roomCode);
  for (const room of partyRooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

function schedulePartyRoomCleanup(room) {
  clearPartyRoomCleanup(room);
  room.cleanupTimer = setTimeout(() => { partyRooms.delete(room.code); }, 60_000);
}

function clearPartyRoomCleanup(room) {
  if (!room?.cleanupTimer) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
}

const PARTY_COMMON_POOL_GENS = [1];

function pickPartyTarget(room) {
  const gens = Array.isArray(room && room.selectedGens) && room.selectedGens.length ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pool = POKEMON_LIST.filter((p) => {
    if (p.isAltForm || Number(p.id) >= 20000) return false;
    return gens.includes(Number(p.gen || p.generation));
  });
  const source = pool.length ? pool : POKEMON_LIST;
  return source[Math.floor(Math.random() * source.length)] || null;
}

function partyTotalRoundsForMode(mode, configured, bacRounds) {
  if (mode === "dexrace") return 1;
  // Stat Clash Party : chaque statistique se joue une seule fois, donc exactement
  // six manches, quel que soit le réglage de l'hôte (gardé pour les autres jeux).
  if (mode === "statclashparty") return 6;
  // Petit Bac: 3, 5 or 10 letters, chosen by the host (3 by default).
  if (mode === "petitbac") return petitBacParty.ROUNDS.includes(Number(bacRounds)) ? Number(bacRounds) : 3;
  // L'hôte peut configurer 5/10/15/20 manches pour les autres jeux.
  const wanted = Number(configured);
  if ([5, 10, 15, 20].includes(wanted)) return wanted;
  return mode === "statclashparty" ? 6 : 5;
}

function isPartyStatMode(room) {
  return room && (room.gameMode === "statclash" || room.gameMode === "statclashparty");
}

async function startPartyGame(room) {
  room.roundNumber = 1;
  room.totalRounds = partyTotalRoundsForMode(room.gameMode, room.configuredRounds, room.bacRounds);
  room.recentComboKeys = [];
  room.recentDuoKeys = [];
  room.bacUsedLetters = [];
  room.bacStats = {};
  for (const player of room.players) {
    player.score = 0;
    player.correct = false;
    player.usedStatKeys = [];
  }
  await startPartyRound(room);
}

function endPartyRound(room) {
  clearPartyRoundTimer(room);
  room.deadlineAt = null;
  if ((Number(room.roundNumber) || 1) >= (Number(room.totalRounds) || PARTY_TOTAL_ROUNDS)) {
    room.status = "complete";
  } else {
    room.status = "finished";
  }
}

const PARTY_VARIANTS = ["normal", "silhouette", "pixel"];

function pickPartyVariant() {
  return PARTY_VARIANTS[Math.floor(Math.random() * PARTY_VARIANTS.length)];
}

function partyPointsForRank(rank) {
  if (rank === 0) return 100;
  if (rank === 1) return 70;
  if (rank === 2) return 50;
  return 30;
}

function clearPartyRoundTimer(room) {
  if (room && room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
}

function resetPartyCampaign(room) {
  if (!room) return;
  clearPartyRoundTimer(room);
  room.status = "waiting";
  room.roundNumber = 0;
  const configuredRounds = Number(room.configuredRounds);
  room.totalRounds = partyTotalRoundsForMode(room.gameMode, configuredRounds, room.bacRounds);
  room.deadlineAt = null;
  room.roundStartedAt = null;
  room.target = null;
  room.variant = null;
  room.roundPlayerIds = [];
  room.deductionWinnerId = null;
  room.quiWinnerId = null;
  room.quiCards = null;
  room.quiPokemon = null;
  room.quiTurnId = null;
  room.nearestTarget = null;
  room.nearestResolved = false;
  room.typeCombo = null;
  room.typeComboWinnerAnswer = null;
  room.typeComboWinnerSprite = null;
  room.typeComboWinnerGain = 0;
  room.typeComboUsedNames = [];
  room.duoCriteria = null;
  room.duoWinnerAnswer = null;
  room.duoWinnerSprite = null;
  room.duoWinnerGain = 0;
  room.duoUsedNames = [];
  room.targetStats = null;
  room.bestStatKey = null;
  room.coopGuesses = [];
  room.coopSolved = false;
  room.coopClues = {};
  room.race = null;
  room.recentComboKeys = [];
  room.recentDuoKeys = [];
  room.bac = null;
  room.bacUsedLetters = [];
  room.bacStats = {};
  for (const player of room.players || []) {
    player.score = 0;
    player.correct = false;
    player.lastGain = 0;
    player.usedStatKeys = [];
    player.pickKey = null;
    player.nearestPick = null;
    player.guesses = [];
    player.attempts = 0;
    player.gaveUp = false;
    player.bacAnswers = null;
    player.bacResults = null;
  }
}

function forcePartyRoundEnd(room) {
  if (!room || room.status !== "playing") return;
  if (room.gameMode === "dexrace") {
    room.race.endedReason = "time"; endPartyRound(room);
  } else if (room.gameMode === "nearest") {
    resolvePartyNearestRound(room);
  } else if (room.gameMode === "petitbac") {
    advancePartyPetitBac(room);
  } else if (isPartyStatMode(room)) {
    resolvePartyStatRound(room);
  } else {
    endPartyRound(room);
  }
  emitPartyRoomState(room);
}

// Petit Bac phases (writing, the last 10 seconds after STOP, the vote) each get their own clock.
function armPartyPhaseTimer(room, ms) {
  clearPartyRoundTimer(room);
  room.deadlineAt = Date.now() + ms;
  room.roundTimer = setTimeout(function () { forcePartyRoundEnd(room); }, ms);
}

function advancePartyPetitBac(room) {
  if (petitBacParty.advancePetitBac(room, POKEMON_LIST) !== "review") { endPartyRound(room); return; }
  // The review keeps the game's pace: 90 seconds, or no clock in an untimed game.
  if (room.bac.time) armPartyPhaseTimer(room, petitBacParty.REVIEW_MS);
  else { clearPartyRoundTimer(room); room.deadlineAt = null; }
}

function armPartyRoundTimer(room) {
  clearPartyRoundTimer(room);
  if (room.status !== "playing") return;
  // Untimed games: no clock, the round ends with STOP or the host.
  if ((room.gameMode === "dexrace" && room.raceDuration === 0) || (room.gameMode === "petitbac" && !room.bac?.time)) {
    room.deadlineAt = null;
    room.roundStartedAt = Date.now();
    return;
  }
  const duration = room.gameMode === "dexrace" ? (room.raceDuration === 300 ? 300000 : 180000) : // Qui est-ce ? waits for human answers: a long safety limit only.
    room.gameMode === "quiestce1v1" ? 1200000 : room.gameMode === "petitbac" ? room.bac.time * 1000 : ["deduction", "coop"].includes(room.gameMode) ? 180000 : PARTY_ROUND_TIMER_MS;
  room.deadlineAt = Date.now() + duration;
  room.roundStartedAt = Date.now();
  room.roundTimer = setTimeout(function () { forcePartyRoundEnd(room); }, duration);
}

async function startPartyRound(room) {
  // Dispatch selon le mode de la party
  if (room.gameMode === "dexrace") {
    dexRace.startRace(room, POKEMON_LIST);
  } else if (room.gameMode === "coop") {
    coopParty.startCoopRound(room, POKEMON_LIST);
  } else if (room.gameMode === "deduction") {
    deductionParty.startDeductionRound(room, POKEMON_LIST);
  } else if (room.gameMode === "quiestce1v1") {
    quiEstCeParty.startQuiEstCeDuel(room, POKEMON_LIST);
  } else if (room.gameMode === "petitbac") {
    petitBacParty.startPetitBacRound(room, POKEMON_LIST);
  } else if (room.gameMode === "nearest") {
    nearestParty.startNearestRound(room, POKEMON_LIST);
  } else if (isPartyStatMode(room)) {
    await startPartyStatClashRound(room);
  } else if (room.gameMode === "typecombo") {
    startPartyTypeComboRound(room);
  } else if (room.gameMode === "duocriteria") {
    startPartyDuoRound(room);
  } else {
    startPartyGuessRound(room);
  }
  armPartyRoundTimer(room);
}

async function startPartyStatClashRound(room) {
  room.status = "playing";
  room.target = pickPartyTarget(room);
  room.variant = null;
  room.typeCombo = null;
  room.typeComboWinnerAnswer = null;
  room.typeComboWinnerSprite = null;
  room.typeComboUsedNames = [];
  room.bestStatKey = null;
  room.roundPlayerIds = room.players.filter((player) => player.connected).map((player) => player.id);
  for (const player of room.players) {
    player.correct = false;
    player.lastGain = 0;
    player.pickKey = null;
  }
  let stats = null;
  if (room.target) stats = await fetchPokemonStatsServer(room.target.id).catch(() => null);
  room.targetStats = stats || { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
}

function resolvePartyStatClashRound(room) {
  const stats = room.targetStats || {};
  let bestVal = -1;
  for (const key of STAT_CLASH_STAT_KEYS) {
    const value = Number(stats[key]) || 0;
    if (value > bestVal) bestVal = value;
  }
  let bestKey = null;
  for (const key of STAT_CLASH_STAT_KEYS) {
    if ((Number(stats[key]) || 0) === bestVal) { bestKey = key; break; }
  }
  room.bestStatKey = bestKey;
  for (const player of room.players) {
    if (player.pickKey && (Number(stats[player.pickKey]) || 0) === bestVal) {
      player.lastGain = 100;
      player.score = (Number(player.score) || 0) + 100;
    } else {
      player.lastGain = 0;
    }
  }
  endPartyRound(room);
}

function checkPartyStatClashAllPicked(room) {
  const roster = Array.isArray(room.roundPlayerIds) && room.roundPlayerIds.length ? room.roundPlayerIds : room.players.map((p) => p.id);
  const active = room.players.filter((p) => p.connected && roster.includes(p.id));
  if (active.length > 0 && active.every((p) => p.pickKey)) {
    resolvePartyStatRound(room);
  }
}

function resolvePartyStatRound(room) {
  if (room.gameMode === "statclashparty") {
    resolvePartyStatClashPartyRound(room);
  } else {
    resolvePartyStatClashRound(room);
  }
}

function resolvePartyStatClashPartyRound(room) {
  const stats = room.targetStats || {};
  let bestVal = -1;
  for (const player of room.players) {
    if (!player.pickKey) continue;
    const value = Number(stats[player.pickKey]) || 0;
    if (value > bestVal) bestVal = value;
  }
  let bestKey = null;
  for (const player of room.players) {
    if (player.pickKey && (Number(stats[player.pickKey]) || 0) === bestVal) { bestKey = player.pickKey; break; }
  }
  room.bestStatKey = bestKey;
  for (const player of room.players) {
    if (player.pickKey) {
      const value = Number(stats[player.pickKey]) || 0;
      player.lastGain = value;
      player.score = (Number(player.score) || 0) + value;
    } else {
      player.lastGain = 0;
    }
  }
  endPartyRound(room);
}

function startPartyGuessRound(room) {
  room.status = "playing";
  room.target = pickPartyTarget(room);
  room.typeCombo = null;
  room.typeComboWinnerAnswer = null;
  room.typeComboWinnerSprite = null;
  room.typeComboUsedNames = [];
  room.variant = pickPartyVariant();
  room.correctCount = 0;
  room.roundPlayerIds = room.players.filter((player) => player.connected).map((player) => player.id);
  for (const player of room.players) {
    player.correct = false;
    player.lastGain = 0;
  }
}

function getPartyPokemonPool(room) {
  const gens = Array.isArray(room && room.selectedGens) && room.selectedGens.length ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pool = POKEMON_LIST.filter((p) => {
    return gens.includes(Number(p.gen || p.generation));
  });
  return pool.length ? pool : POKEMON_LIST.slice();
}

function partyTypeComboKey(type1, type2) {
  const first = String(type1 || "").trim();
  const second = String(type2 || type1 || "").trim();
  return [first, second].sort().join("|");
}

function pokemonMatchesPartyTypeCombo(pokemon, combo) {
  if (!pokemon || !combo) return false;
  return partyTypeComboKey(pokemon.type1, pokemon.type2 || pokemon.type1) === combo.key;
}

function partyNameEditDistance(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;
  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  const curr = Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = curr[j];
  }
  return prev[right.length];
}

function resolvePartyPokemonGuessFuzzy(room, guess) {
  const normalizedGuess = normalizeName(guess);
  if (!normalizedGuess) return null;
  const gens = Array.isArray(room.selectedGens) ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pool = getPartyPokemonPool(room).filter((pokemon) => gens.includes(Number(pokemon.gen || pokemon.generation)));
  const exact = pool.find((pokemon) => normalizeName(pokemon.name) === normalizedGuess);
  if (exact) return exact;

  let best = null;
  for (const pokemon of pool) {
    const normalizedName = normalizeName(pokemon.name);
    if (!normalizedName) continue;
    const maxLength = Math.max(normalizedGuess.length, normalizedName.length);
    const maxDistance = Math.max(1, Math.floor(maxLength * 0.1));
    const distance = partyNameEditDistance(normalizedGuess, normalizedName);
    if (distance > maxDistance) continue;
    const score = 1 - (distance / maxLength);
    if (!best || score > best.score || (score === best.score && normalizedName.length < best.nameLength)) {
      best = { pokemon, score, nameLength: normalizedName.length };
    }
  }
  return best ? best.pokemon : null;
}

function pickPartyTypeCombo(room) {
  const pool = getPartyPokemonPool(room);
  const combos = new Map();
  for (const pokemon of pool) {
    if (!pokemon.type1) continue;
    const type1 = pokemon.type1;
    const type2 = pokemon.type2 || pokemon.type1;
    const key = partyTypeComboKey(type1, type2);
    if (!combos.has(key)) {
      combos.set(key, { key, types: [type1, type2], matches: [] });
    }
    combos.get(key).matches.push(pokemon);
  }
  const available = Array.from(combos.values()).filter((combo) => combo.matches.length > 0);
  const recent = Array.isArray(room.recentComboKeys) ? room.recentComboKeys : [];
  let candidates = available.filter((combo) => !recent.includes(combo.key));
  if (!candidates.length) candidates = available;
  const picked = candidates[Math.floor(Math.random() * candidates.length)] || null;
  if (!picked) return null;
  room.recentComboKeys = [picked.key].concat(recent).slice(0, 6);
  const displayTypes = picked.types.slice();
  if (displayTypes[0] !== displayTypes[1] && Math.random() < 0.5) displayTypes.reverse();
  return {
    key: picked.key,
    types: picked.types,
    displayTypes,
    count: picked.matches.length,
    examples: picked.matches.slice(0, 8).map((pokemon) => ({
      name: pokemon.name,
      sprite: pokemon.sprite || null,
    })),
  };
}

function startPartyTypeComboRound(room) {
  room.status = "playing";
  room.target = { name: "Combo de types", sprite: null };
  room.variant = null;
  room.typeCombo = pickPartyTypeCombo(room);
  room.typeComboWinnerAnswer = null;
  room.typeComboWinnerSprite = null;
  room.typeComboUsedNames = [];
  room.roundPlayerIds = room.players.filter((player) => player.connected).map((player) => player.id);
  for (const player of room.players) {
    player.correct = false;
    player.lastGain = 0;
  }
}

function partyTypeComboTier(count) {
  const n = Number(count) || 0;
  if (n <= 2) return { tier: "legendaire", label: "Légendaire", points: 200 };
  if (n <= 7) return { tier: "difficile", label: "Difficile", points: 140 };
  if (n <= 19) return { tier: "moyen", label: "Moyen", points: 100 };
  return { tier: "facile", label: "Facile", points: 80 };
}

function partyTypeComboSpeedBonus(room) {
  const start = Number(room.roundStartedAt) || 0;
  if (!start) return 0;
  const elapsed = Date.now() - start;
  if (elapsed <= 5000) return 30;
  if (elapsed <= 10000) return 15;
  return 0;
}

function handlePartyTypeComboAnswer(room, player, guess) {
  const pokemon = resolvePartyPokemonGuessFuzzy(room, guess);
  const gens = Array.isArray(room.selectedGens) ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (!pokemon || !gens.includes(Number(pokemon.gen || pokemon.generation))) {
    return { valid: false, correct: false, error: "Pokémon invalide pour cette room." };
  }
  const resolvedName = normalizeName(pokemon.name);
  if (!Array.isArray(room.typeComboUsedNames)) room.typeComboUsedNames = [];
  if (room.typeComboUsedNames.includes(resolvedName)) {
    return { valid: true, correct: false, duplicate: true, error: "Ce Pokémon a déjà été proposé pendant cette manche." };
  }
  room.typeComboUsedNames.push(resolvedName);
  const isCorrect = pokemonMatchesPartyTypeCombo(pokemon, room.typeCombo);
  if (!isCorrect) return { valid: true, correct: false, duplicate: false };
  const tier = partyTypeComboTier(room.typeCombo && room.typeCombo.count);
  const speed = partyTypeComboSpeedBonus(room);
  const gained = tier.points + speed;
  player.correct = true;
  player.lastGain = gained;
  player.score = (Number(player.score) || 0) + gained;
  room.typeComboWinnerAnswer = pokemon.name;
  room.typeComboWinnerSprite = pokemon.sprite || null;
  room.typeComboWinnerGain = gained;
  endPartyRound(room);
  emitPartyRoomState(room);
  return { valid: true, correct: true, gained, rank: 1, answer: pokemon.name };
}

// ---- Mode "Duo de critères" : deux critères croisés (type, couleur, habitat,
// génération, stade), premier Pokémon valide remporte la manche. Même moteur
// de points que Combo de types (rareté + bonus vitesse). ----
const PARTY_DUO_CRITERIA_KINDS = [
  { kind: "type", label: (v) => `Type ${v}`, values: (p) => [p.type1, p.type2].filter(Boolean) },
  { kind: "couleur", label: (v) => `Couleur ${v}`, values: (p) => [p.color].filter(Boolean) },
  { kind: "habitat", label: (v) => `Habitat ${v}`, values: (p) => [p.habitat].filter(Boolean) },
  { kind: "gen", label: (v) => `Génération ${v}`, values: (p) => [Number(p.gen || p.generation)].filter(Boolean) },
  { kind: "stade", label: (v) => (Number(v) === 1 ? "Stade 1 (base)" : Number(v) === 2 ? "Stade 2" : "Stade final (3)"), values: (p) => [Number(p.stage)].filter(Boolean) },
];

function pokemonMatchesPartyDuoCriterion(pokemon, criterion) {
  const def = PARTY_DUO_CRITERIA_KINDS.find((entry) => entry.kind === criterion.kind);
  if (!def) return false;
  return def.values(pokemon).some((value) => String(value) === String(criterion.value));
}

function pokemonMatchesPartyDuo(pokemon, duo) {
  if (!pokemon || !duo || !Array.isArray(duo.criteria)) return false;
  return duo.criteria.every((criterion) => pokemonMatchesPartyDuoCriterion(pokemon, criterion));
}

function pickPartyDuoCriteria(room) {
  const pool = getPartyPokemonPool(room);
  const recent = Array.isArray(room.recentDuoKeys) ? room.recentDuoKeys : [];
  const candidates = [];
  // 24 tirages aléatoires de paires de catégories distinctes, ancrés sur un
  // Pokémon réel du pool pour garantir au moins une solution.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const anchor = pool[Math.floor(Math.random() * pool.length)];
    if (!anchor) continue;
    const kinds = PARTY_DUO_CRITERIA_KINDS.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    const criteria = [];
    for (const def of kinds) {
      const values = def.values(anchor);
      if (!values.length) break;
      const value = values[Math.floor(Math.random() * values.length)];
      criteria.push({ kind: def.kind, value, label: def.label(value) });
    }
    if (criteria.length !== 2) continue;
    const key = criteria.map((c) => `${c.kind}:${c.value}`).sort().join("|");
    if (recent.includes(key)) continue;
    const duo = { key, criteria };
    const matches = pool.filter((pokemon) => pokemonMatchesPartyDuo(pokemon, duo));
    if (matches.length < 1) continue;
    candidates.push({ key, criteria, matches });
  }
  if (!candidates.length) return null;
  // Privilégie les duos intéressants (ni triviaux ni introuvables).
  const sweetSpot = candidates.filter((c) => c.matches.length >= 3 && c.matches.length <= 60);
  const picked = (sweetSpot.length ? sweetSpot : candidates)[Math.floor(Math.random() * (sweetSpot.length ? sweetSpot.length : candidates.length))];
  room.recentDuoKeys = [picked.key].concat(recent).slice(0, 8);
  return {
    key: picked.key,
    criteria: picked.criteria,
    count: picked.matches.length,
    examples: picked.matches.slice(0, 8).map((pokemon) => ({ name: pokemon.name, sprite: pokemon.sprite || null })),
  };
}

function startPartyDuoRound(room) {
  room.status = "playing";
  room.target = { name: "Duo de critères", sprite: null };
  room.variant = null;
  room.duoCriteria = pickPartyDuoCriteria(room);
  room.duoWinnerAnswer = null;
  room.duoWinnerSprite = null;
  room.duoWinnerGain = 0;
  room.duoUsedNames = [];
  room.roundPlayerIds = room.players.filter((player) => player.connected).map((player) => player.id);
  for (const player of room.players) {
    player.correct = false;
    player.lastGain = 0;
  }
}

function handlePartyDuoAnswer(room, player, guess) {
  const pokemon = resolvePartyPokemonGuessFuzzy(room, guess);
  const gens = Array.isArray(room.selectedGens) ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (!pokemon || !gens.includes(Number(pokemon.gen || pokemon.generation))) {
    return { valid: false, correct: false, error: "Pokémon invalide pour cette room." };
  }
  const resolvedName = normalizeName(pokemon.name);
  if (!Array.isArray(room.duoUsedNames)) room.duoUsedNames = [];
  if (room.duoUsedNames.includes(resolvedName)) {
    return { valid: true, correct: false, duplicate: true, error: "Ce Pokémon a déjà été proposé pendant cette manche." };
  }
  room.duoUsedNames.push(resolvedName);
  const isCorrect = pokemonMatchesPartyDuo(pokemon, room.duoCriteria);
  if (!isCorrect) return { valid: true, correct: false, duplicate: false };
  const tier = partyTypeComboTier(room.duoCriteria && room.duoCriteria.count);
  const speed = partyTypeComboSpeedBonus(room);
  const gained = tier.points + speed;
  player.correct = true;
  player.lastGain = gained;
  player.score = (Number(player.score) || 0) + gained;
  room.duoWinnerAnswer = pokemon.name;
  room.duoWinnerSprite = pokemon.sprite || null;
  room.duoWinnerGain = gained;
  endPartyRound(room);
  emitPartyRoomState(room);
  return { valid: true, correct: true, gained, rank: 1, answer: pokemon.name };
}

function publicPartyDuoRoundState(room, revealed) {
  const duo = room.duoCriteria;
  if (!duo) return null;
  const tier = partyTypeComboTier(Number(duo.count) || 0);
  return {
    mode: "duocriteria",
    criteria: (duo.criteria || []).map((criterion) => ({ kind: criterion.kind, label: criterion.label })),
    count: Number(duo.count) || 0,
    difficulty: { tier: tier.tier, label: tier.label },
    points: tier.points,
    answer: revealed ? (room.duoWinnerAnswer || null) : null,
    answerSprite: revealed ? (room.duoWinnerSprite || null) : null,
    winnerGain: revealed ? (Number(room.duoWinnerGain) || 0) : null,
    examples: revealed ? (duo.examples || []) : [],
  };
}

function handlePartyGuessAnswer(room, player, guess) {
  const guessName = normalizeName(guess);
  const isCorrect = Boolean(guessName) && guessName === normalizeName(room.target.name);
  let gained = 0;
  let rank = 0;
  if (isCorrect) {
    rank = (Number(room.correctCount) || 0) + 1;
    gained = partyPointsForRank(rank - 1);
    room.correctCount = rank;
    player.correct = true;
    player.lastGain = gained;
    player.score = (Number(player.score) || 0) + gained;
    checkPartyRoundFinished(room);
    emitPartyRoomState(room);
  }
  return { correct: isCorrect, gained: gained, rank: rank };
}

function checkPartyRoundFinished(room) {
  const roster = Array.isArray(room.roundPlayerIds) && room.roundPlayerIds.length ? room.roundPlayerIds : room.players.map((p) => p.id);
  const active = room.players.filter((p) => p.connected && roster.includes(p.id));
  if (active.length > 0 && active.every((p) => p.correct)) {
    endPartyRound(room);
  }
}

function handlePartyDisconnect(socketId, voluntary) {
  const room = findPartyRoomBySocket(socketId);
  if (!room) return;
  const socket = io.sockets.sockets.get(socketId);
  if (socket?.data) socket.data.partyRoomCode = null;
  if (socket) socket.leave(room.code);
  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;

  const finalizeDeparture = () => {
    if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
    player.reconnectUntil = null;
    const index = room.players.indexOf(player);
    if (index === -1) return;
    const wasHost = player.id === room.hostId;
    room.players.splice(index, 1);
    if (room.players.length === 0) {
      clearPartyRoundTimer(room);
      room.deadlineAt = null;
      schedulePartyRoomCleanup(room);
      return;
    }
    if (wasHost) {
      const next = room.players.find((entry) => entry.connected) || room.players[0];
      room.hostId = next.id;
    }
    if (room.status === "playing" && room.gameMode === "dexrace" && dexRace.raceMissingSide(room)) { room.race.endedReason = "departure"; endPartyRound(room); }
    if (room.status === "playing" && room.gameMode === "deduction" && deductionParty.allDeductionPlayersGaveUp(room)) endPartyRound(room);
    if (room.status === "playing" && room.gameMode === "nearest" && nearestParty.allNearestSubmitted(room)) resolvePartyNearestRound(room);
    emitPartyRoomState(room);
  };

  if (voluntary) {
    finalizeDeparture();
    return;
  }

  // Refresh / coupure courte : la place, le score et le rôle d’hôte restent réservés.
  player.connected = false;
  player.disconnectedAt = Date.now();
  player.reconnectUntil = Date.now() + PARTY_RECONNECT_GRACE_MS;
  emitPartyRoomState(room);
  if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
  player.reconnectTimer = setTimeout(() => {
    player.reconnectTimer = null;
    if (!partyRooms.has(room.code) || player.connected || !room.players.includes(player)) return;
    finalizeDeparture();
  }, PARTY_RECONNECT_GRACE_MS);
}

io.on("connection", (socket) => {
  socket.on("duel:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const nickname = sanitizeNickname(payload.nickname);
      const selectedGens = normalizeSelectedGens(payload.selectedGens);
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });

      const code = generateRoomCode();
      const room = {
        code,
        status: "waiting",
        createdAt: Date.now(),
        hostId: socket.id,
        players: [],
        selectedGens,
        secretPokemon: null,
        winnerId: null,
        endedReason: null,
        cleanupTimer: null,
      };
      rooms.set(code, room);
      const player = joinPlayerToRoom(room, socket, nickname);
      recordUsage("duel:create");
      emitRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de créer la room." });
    }
  });

  socket.on("duel:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname);
      const room = rooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });
      if (room.players.length >= MAX_ROOM_SIZE) return respond(ack, { ok: false, error: "La room est déjà complète." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "Cette room est terminée." });

      const player = joinPlayerToRoom(room, socket, nickname);
      if (room.players.length === MAX_ROOM_SIZE && room.players.every((entry) => entry.connected)) {
        startRoom(room);
      }
      emitRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de rejoindre la room." });
    }
  });

  socket.on("duel:submit-guess", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "guess")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.status !== "live" || !room.secretPokemon) return respond(ack, { ok: false, error: "La manche n'est pas en cours." });

      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });

      const guess = String(payload.guess || "").trim();
      if (!guess) return respond(ack, { ok: false, error: "Entre un nom de Pokémon." });
      if (guess.length > 100) return respond(ack, { ok: false, error: "Nom trop long." });
      const guessedPokemon = resolveRoomPokemonGuess(room, guess);
      if (!guessedPokemon) return respond(ack, { ok: false, error: "Pokémon invalide pour cette room." });
      if (player.guesses.some((entry) => entry.id === guessedPokemon.id)) {
        return respond(ack, { ok: false, error: "Tu as déjà tenté ce Pokémon." });
      }

      player.attempts += 1;
      player.lastGuess = guessedPokemon.name;
      player.guesses.unshift(buildGuessFeedback(guessedPokemon, room.secretPokemon));
      const correct = guessedPokemon.id === room.secretPokemon.id;

      if (correct) {
        room.status = "finished";
        room.winnerId = player.id;
        room.endedReason = "guess";
        player.correct = true;
      }

      emitRoomState(room);
      if (correct) emitRoomFinished(room);
      respond(ack, { ok: true, correct, attempts: player.attempts });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du guess." });
    }
  });

  socket.on("duel:leave-room", () => {
    try { handleDisconnect(socket.id, true); } catch (_error) { console.error("[duel:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("duel:forfeit", (payload = {}, ack) => {
    try {
      const room = findRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.status !== "live" || !room.secretPokemon) return respond(ack, { ok: false, error: "La manche n'est plus en cours." });
      if (payload.code !== room.code || payload.roundSerial !== room.roundSerial) return respond(ack, { ok: false, error: "Cette manche a changé. Réessaie." });
      const player = room.players.find((entry) => entry.id === socket.id && entry.connected);
      const opponent = room.players.find((entry) => entry.id !== socket.id);
      if (!player || !opponent) return respond(ack, { ok: false, error: "Duel incomplet." });
      room.status = "finished";
      room.winnerId = opponent.id;
      room.endedReason = "forfeit";
      if (room.graceTimer) { clearTimeout(room.graceTimer); room.graceTimer = null; }
      emitRoomState(room);
      emitRoomFinished(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible d'abandonner la manche." });
    }
  });

  socket.on("duel:resume", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "resume")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const code = sanitizeRoomCode(payload.code);
      const token = String(payload.resumeToken || "").trim().slice(0, 96);
      const room = rooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable ou expirée." });
      if (!token) return respond(ack, { ok: false, error: "Session de reprise invalide." });
      const player = room.players.find((entry) => entry.reconnectToken === token);
      if (!player) return respond(ack, { ok: false, error: "Aucune place à reprendre dans cette room." });
      if (player.reconnectUntil && Date.now() > Number(player.reconnectUntil)) return respond(ack, { ok: false, error: "Le délai de reconnexion est expiré." });

      // A reload can connect the replacement socket before Socket.IO has emitted
      // disconnect for the old one. The opaque token owns the seat, so transfer it
      // atomically instead of rejecting a still-marked-connected player.
      const previousId = player.id;
      if (player.connected && previousId === socket.id) {
        return respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicRoomState(room, socket.id) });
      }
      const previousSocket = previousId && previousId !== socket.id ? io.sockets.sockets.get(previousId) : null;
      if (previousSocket) {
        previousSocket.leave(room.code);
        if (previousSocket.data) previousSocket.data.roomCode = null;
      }
      if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
      if (room.hostId === previousId) room.hostId = socket.id;
      if (room.winnerId === previousId) room.winnerId = socket.id;
      player.id = socket.id;
      player.connected = true;
      player.disconnectedAt = null;
      player.reconnectUntil = null;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      if (previousSocket?.connected) previousSocket.disconnect(true);
      if (room.status === "waiting" && room.players.length === MAX_ROOM_SIZE && room.players.every((entry) => entry.connected)) {
        startRoom(room);
      }
      io.to(room.code).emit("duel:opponent-connection", { nickname: player.nickname, connected: true });
      emitRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Reprise impossible." });
    }
  });

  socket.on("duel:update-gens", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le créateur peut modifier les générations." });
      if (room.status === "live") return respond(ack, { ok: false, error: "Impossible de changer les générations pendant une manche." });

      room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      emitRoomState(room);
      respond(ack, { ok: true, room: publicRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de la mise à jour des générations." });
    }
  });

  socket.on("duel:restart-round", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "restart")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.status !== "finished") return respond(ack, { ok: false, error: "La manche n'est pas terminée." });
      if (room.players.length !== MAX_ROOM_SIZE || room.players.some((player) => !player.connected)) {
        return respond(ack, { ok: false, error: "Les deux joueurs doivent être présents pour rejouer." });
      }
      if (Array.isArray(payload.selectedGens)) {
        if (room.hostId !== socket.id) {
          return respond(ack, { ok: false, error: "Seul le créateur peut changer les générations." });
        }
        room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      }
      resetRoomForNewRound(room);
      startRoom(room);
      emitRoomState(room);
      respond(ack, { ok: true, room: publicRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du redémarrage." });
    }
  });

  socket.on("party:share-clue", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "party-clue")) return respond(ack, { ok: false, error: "Attends un instant avant de réessayer." });
      const room = findPartyRoomBySocket(socket.id);
      const player = room?.players.find(p => p.id === socket.id);
      if (!room || payload.code !== room.code) return respond(ack, { ok: false, error: "Cette salle a changé." });
      const result = coopParty.shareClue(room, player, payload.roundSerial);
      if (result.error) return respond(ack, { ok: false, error: result.error });
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (_error) { respond(ack, { ok: false, error: "Partage impossible. Réessaie." }); }
  });

  socket.on("party:forfeit-deduction", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room || payload.code !== room.code) return respond(ack, { ok: false, error: "Salon introuvable." });
      const player = room.players.find(p => p.id === socket.id);
      const duel = room.gameMode === "quiestce1v1";
      const result = duel ? quiEstCeParty.forfeitDuel(room, player, payload.roundSerial) : deductionParty.forfeitDeduction(room, player, payload.roundSerial);
      if (result.error) return respond(ack, { ok: false, error: result.error });
      if (duel || deductionParty.allDeductionPlayersGaveUp(room)) endPartyRound(room);
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible d'abandonner." });
    }
  });

  socket.on("party:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const nickname = sanitizeNickname(payload.nickname);
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });
      const code = generatePartyRoomCode();
      const room = { code, status: "waiting", createdAt: Date.now(), hostId: socket.id, players: [], cleanupTimer: null, gameMode: "guess", selectedGens: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
      partyRooms.set(code, room);
      const player = joinPlayerToPartyRoom(room, socket, nickname, sanitizePartyLevel(payload.level));
      recordUsage("party:create");
      emitPartyRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de creer la room." });
    }
  });

  socket.on("party:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname);
      const room = partyRooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });
      if (room.players.length >= PARTY_MAX_PLAYERS) return respond(ack, { ok: false, error: "La room est deja complete (8 max)." });
      if (room.status !== "waiting") return respond(ack, { ok: false, error: "La partie a deja demarre." });
      clearPartyRoomCleanup(room);
      const player = joinPlayerToPartyRoom(room, socket, nickname, sanitizePartyLevel(payload.level));
      recordUsage("party:join");
      emitPartyRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de rejoindre la room." });
    }
  });

  socket.on("party:resume", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "resume")) return respond(ack, { ok: false, errorCode: "rate_limited", error: "Trop de requetes, reessaie dans quelques secondes." });
      const code = sanitizeRoomCode(payload.code);
      const token = String(payload.resumeToken || "").trim().slice(0, 96);
      const room = partyRooms.get(code);
      if (!room) return respond(ack, { ok: false, errorCode: "room_missing", error: "Party Room introuvable ou expiree." });
      if (!token) return respond(ack, { ok: false, errorCode: "resume_invalid", error: "Session de reprise invalide." });
      const player = room.players.find((entry) => entry.reconnectToken === token);
      if (!player) return respond(ack, { ok: false, errorCode: "resume_invalid", error: "Cette place n'est plus disponible." });
      if (player.reconnectUntil && Date.now() > Number(player.reconnectUntil)) {
        return respond(ack, { ok: false, errorCode: "resume_expired", error: "Le delai de reconnexion est expire." });
      }

      // Safari can establish the replacement socket before Socket.IO reports
      // disconnect on the old page. The opaque token owns the seat: transfer it
      // atomically instead of rejecting a player that is still marked connected.
      const previousId = player.id;
      if (player.connected && previousId === socket.id) {
        return respond(ack, { ok: true, code: room.code, resumeToken: player.reconnectToken, room: publicPartyRoomState(room, socket.id) });
      }
      const previousSocket = previousId && previousId !== socket.id ? io.sockets.sockets.get(previousId) : null;
      if (previousSocket) {
        previousSocket.leave(room.code);
        if (previousSocket.data) previousSocket.data.partyRoomCode = null;
      }

      if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
      player.id = socket.id;
      player.connected = true;
      player.disconnectedAt = null;
      player.reconnectUntil = null;
      if (room.hostId === previousId) room.hostId = socket.id;
      if (Array.isArray(room.roundPlayerIds)) room.roundPlayerIds = room.roundPlayerIds.map((id) => id === previousId ? socket.id : id);
      if (room.deductionWinnerId === previousId) room.deductionWinnerId = socket.id;
      if (room.quiWinnerId === previousId) room.quiWinnerId = socket.id;
      if (room.quiTurnId === previousId) room.quiTurnId = socket.id;
      if (room.quiPending && room.quiPending.askerId === previousId) room.quiPending.askerId = socket.id;
      if (Array.isArray(room.quiLog)) room.quiLog.forEach((entry) => { if (entry.by === previousId) entry.by = socket.id; });
      petitBacParty.rekeyPetitBac(room, previousId, socket.id);
      if (room.race?.roster) room.race.roster.forEach((member) => { if (member.id === previousId) member.id = socket.id; });
      if (room.race?.claims instanceof Map) {
        for (const claim of room.race.claims.values()) if (claim.playerId === previousId) claim.playerId = socket.id;
      }
      if (room.coopClues && Object.prototype.hasOwnProperty.call(room.coopClues, previousId)) {
        room.coopClues[socket.id] = room.coopClues[previousId];
        delete room.coopClues[previousId];
      }

      socket.join(room.code);
      socket.data.partyRoomCode = room.code;
      clearPartyRoomCleanup(room);
      if (previousSocket?.connected) previousSocket.disconnect(true);
      emitPartyRoomState(room);
      respond(ack, { ok: true, code: room.code, resumeToken: player.reconnectToken, room: publicPartyRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, errorCode: "resume_failed", error: "Reconnexion Party Room impossible." });
    }
  });

  socket.on("party:leave-room", () => {
    try { handlePartyDisconnect(socket.id, true); } catch (_error) { console.error("[party:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("party:start", async (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut lancer." });
      if (room.players.some((player) => !player.connected)) return respond(ack, { ok: false, error: "Attends la reconnexion d'un joueur ou la fin de son delai avant de lancer." });
      if (room.players.filter((player) => player.connected).length < PARTY_MIN_PLAYERS) return respond(ack, { ok: false, error: "Il faut au moins 2 joueurs connectes." });
      if (room.status === "playing") return respond(ack, { ok: false, error: "Une manche est deja en cours." });
      if (room.gameMode === "dexrace") {
        const error = dexRace.raceStartError(room);
        if (error) return respond(ack, { ok: false, error });
      }
      if (room.gameMode === "petitbac" && !petitBacParty.publicOptions(room, POKEMON_LIST).letters) return respond(ack, { ok: false, error: "Aucune lettre ne convient à ces thèmes : change un thème ou les générations." });
      if (room.gameMode === "quiestce1v1" && room.players.filter((player) => player.connected).length !== 2) return respond(ack, { ok: false, error: "Qui est-ce ? se joue à deux exactement." });
      await startPartyGame(room);
      if (!room.target && room.gameMode !== "dexrace") return respond(ack, { ok: false, error: "Aucune cible disponible." });
      if (room.gameMode === "typecombo" && !room.typeCombo) return respond(ack, { ok: false, error: "Aucune combinaison disponible." });
      recordUsage("party:start:" + (room.gameMode || "guess"));
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de lancer." });
    }
  });

  socket.on("party:submit-answer", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "party-guess")) return respond(ack, { ok: false, error: "Trop de requetes." });
      const room = findPartyRoomBySocket(socket.id);
      if (!room || room.status !== "playing" || (!room.target && room.gameMode !== "dexrace")) return respond(ack, { ok: false, error: "Aucune manche en cours." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Tu n'es pas dans la room." });
      if (room.gameMode === "dexrace") {
        const result = dexRace.submitRace(room, player, payload);
        if (result.error) return respond(ack, { ok: false, error: result.error });
        if (result.full) { room.race.endedReason = "full"; endPartyRound(room); }
        if (result.claimed) emitPartyRoomState(room);
        return respond(ack, { ok: true, ...result, room: publicPartyRoomState(room, socket.id) });
      }
      if (room.gameMode === "coop") {
        if (payload.code !== room.code) return respond(ack, { ok: false, error: "Cette salle a changé." });
        const result = coopParty.submitCoop(room, player, payload.guess, payload.roundSerial, resolveRoomPokemonGuess);
        if (result.error) return respond(ack, { ok: false, error: result.error });
        if (result.ended) endPartyRound(room);
        emitPartyRoomState(room);
        return respond(ack, { ok: true, ...result, room: publicPartyRoomState(room, socket.id) });
      }
      if (room.gameMode === "deduction") {
        const result = deductionParty.submitDeduction(room, player, payload.guess, payload.roundSerial, resolveRoomPokemonGuess, buildGuessFeedback);
        if (result.error) return respond(ack, { ok: false, error: result.error });
        if (result.correct) endPartyRound(room);
        emitPartyRoomState(room);
        return respond(ack, { ok: true, ...result, room: publicPartyRoomState(room, socket.id) });
      }
      if (room.gameMode === "quiestce1v1") {
        if (payload.code !== room.code) return respond(ack, { ok: false, error: "Cette salle a changé." });
        const serial = payload.roundSerial, action = String(payload.quiAction || "");
        const result = action === "choose" ? quiEstCeParty.chooseSecret(room, player, payload.pokemonId, serial)
          : action === "ask" ? quiEstCeParty.askQuestion(room, player, payload, serial)
          : action === "answer" ? quiEstCeParty.answerQuestion(room, player, payload.answer, serial)
          : action === "flip" ? quiEstCeParty.flipCard(room, player, payload.pokemonId, serial)
          : action === "guess" ? quiEstCeParty.guessSecret(room, player, payload.pokemonId, serial)
          : { error: "Action inconnue." };
        if (result.error) return respond(ack, { ok: false, error: result.error, room: publicPartyRoomState(room, socket.id) });
        if (result.correct) endPartyRound(room);
        // A private flip only changes this player's board.
        if (action === "flip") return respond(ack, { ok: true, ...result, room: publicPartyRoomState(room, socket.id) });
        emitPartyRoomState(room);
        return respond(ack, { ok: true, ...result, room: publicPartyRoomState(room, socket.id) });
      }
      if (room.gameMode === "petitbac") {
        if (payload.code !== room.code) return respond(ack, { ok: false, error: "Cette salle a changé." });
        const serial = payload.roundSerial, action = String(payload.bacAction || "");
        const result = action === "write" ? petitBacParty.writeAnswers(room, player, payload.answers, serial)
          : action === "stop" ? petitBacParty.stopRound(room, player, serial)
          : action === "vote" ? petitBacParty.voteAnswer(room, player, String(payload.author || ""), Number(payload.index), payload.valid, serial)
          : action === "done-vote" ? petitBacParty.finishVoting(room, player, serial)
          : { error: "Action inconnue." };
        if (result.error) return respond(ack, { ok: false, error: result.error, room: publicPartyRoomState(room, socket.id) });
        // STOP leaves everyone ten seconds, unless the clock was already closer.
        if (result.stopped && (!room.deadlineAt || room.deadlineAt - Date.now() > petitBacParty.STOP_MS)) armPartyPhaseTimer(room, petitBacParty.STOP_MS);
        if (result.allDone) advancePartyPetitBac(room);
        // Typing only reaches the others when a column is filled or emptied.
        if (action !== "write" || result.changed) emitPartyRoomState(room);
        return respond(ack, { ok: true, ...result, room: publicPartyRoomState(room, socket.id) });
      }
      if (room.gameMode === "nearest") {
        const result = nearestParty.submitNearest(room, player, payload.guess, payload.roundSerial, POKEMON_LIST, normalizeName);
        if (result.error) return respond(ack, { ok: false, error: result.error, room: publicPartyRoomState(room, socket.id) });
        if (nearestParty.allNearestSubmitted(room)) resolvePartyNearestRound(room);
        emitPartyRoomState(room);
        return respond(ack, { ok: true, ...result, room: publicPartyRoomState(room, socket.id) });
      }
      if (player.correct) return respond(ack, { ok: true, already: true, room: publicPartyRoomState(room, socket.id) });
      if (room.gameMode === "typecombo") {
        const result = handlePartyTypeComboAnswer(room, player, payload.guess);
        if (result.error) return respond(ack, { ok: false, correct: false, duplicate: Boolean(result.duplicate), error: result.error, room: publicPartyRoomState(room, socket.id) });
        return respond(ack, { ok: true, correct: result.correct, gained: result.gained || 0, rank: result.rank || 0, answer: result.answer || null, room: publicPartyRoomState(room, socket.id) });
      }
      if (room.gameMode === "duocriteria") {
        const result = handlePartyDuoAnswer(room, player, payload.guess);
        if (result.error) return respond(ack, { ok: false, correct: false, duplicate: Boolean(result.duplicate), error: result.error, room: publicPartyRoomState(room, socket.id) });
        return respond(ack, { ok: true, correct: result.correct, gained: result.gained || 0, rank: result.rank || 0, answer: result.answer || null, room: publicPartyRoomState(room, socket.id) });
      }
      if ((room.gameMode || "guess") !== "guess") return respond(ack, { ok: false, error: "Mode non disponible." });
      const result = handlePartyGuessAnswer(room, player, payload.guess);
      respond(ack, { ok: true, correct: result.correct, gained: result.gained, rank: result.rank, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Erreur lors de la reponse." });
    }
  });

  socket.on("party:reveal-round", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut reveler la manche." });
      if (room.status !== "playing") return respond(ack, { ok: false, error: "Aucune manche en cours." });
      if (room.gameMode === "dexrace") return respond(ack, { ok: false, error: "La course se termine au chrono (s’il est activé) ou quand la grille est complète." });
      // Petit Bac: the host moves on to the next phase (vote, then the score).
      if (room.gameMode === "nearest") { resolvePartyNearestRound(room); } else if (room.gameMode === "petitbac") { advancePartyPetitBac(room); } else if (isPartyStatMode(room)) { resolvePartyStatRound(room); } else { endPartyRound(room); }
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de reveler la manche." });
    }
  });

  socket.on("party:submit-stat", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "party-guess")) return respond(ack, { ok: false, error: "Trop de requetes." });
      const room = findPartyRoomBySocket(socket.id);
      if (!room || room.status !== "playing" || (room.gameMode !== "statclash" && room.gameMode !== "statclashparty")) return respond(ack, { ok: false, error: "Aucune manche de stats en cours." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Tu n'es pas dans la room." });
      if (player.pickKey) return respond(ack, { ok: true, already: true, room: publicPartyRoomState(room, socket.id) });
      const statKey = String(payload.statKey || "");
      if (!STAT_CLASH_STAT_KEYS.includes(statKey)) return respond(ack, { ok: false, error: "Stat invalide." });
      if (room.gameMode === "statclashparty" && Array.isArray(player.usedStatKeys) && player.usedStatKeys.includes(statKey)) return respond(ack, { ok: false, error: "Stat deja utilisee cette party." });
      player.pickKey = statKey;
      if (!Array.isArray(player.usedStatKeys)) player.usedStatKeys = [];
      if (!player.usedStatKeys.includes(statKey)) player.usedStatKeys.push(statKey);
      checkPartyStatClashAllPicked(room);
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Erreur lors du choix de stat." });
    }
  });

  socket.on("party:next-round", async (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut lancer la manche suivante." });
      if (room.status !== "finished") return respond(ack, { ok: false, error: "Termine la manche en cours d'abord." });
      if (room.players.some((player) => !player.connected)) return respond(ack, { ok: false, error: "Attends la reconnexion d'un joueur ou la fin de son delai avant la manche suivante." });
      if ((Number(room.roundNumber) || 1) >= (Number(room.totalRounds) || PARTY_TOTAL_ROUNDS)) return respond(ack, { ok: false, error: "La party est terminee." });
      room.roundNumber = (Number(room.roundNumber) || 1) + 1;
      await startPartyRound(room);
      if (!room.target && room.gameMode !== "dexrace") return respond(ack, { ok: false, error: "Aucune cible disponible." });
      if (room.gameMode === "typecombo" && !room.typeCombo) return respond(ack, { ok: false, error: "Aucune combinaison disponible." });
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de passer a la manche suivante." });
    }
  });

  socket.on("party:return-to-setup", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut changer de jeu." });
      if (room.status !== "playing" && room.status !== "finished") {
        return respond(ack, { ok: false, error: "Aucune partie en cours a interrompre." });
      }
      resetPartyCampaign(room);
      recordUsage("party:return-to-setup");
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de revenir au choix des jeux." });
    }
  });

  socket.on("party:set-mode", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut changer le mode." });
      if (room.status !== "waiting" && room.status !== "complete") return respond(ack, { ok: false, error: "Impossible de changer le mode en cours de party." });
      const mode = String(payload.mode || "");
      if (mode !== "guess" && mode !== "statclash" && mode !== "statclashparty" && mode !== "typecombo" && mode !== "duocriteria" && mode !== "nearest" && mode !== "deduction" && mode !== "quiestce1v1" && mode !== "petitbac" && mode !== "coop" && mode !== "dexrace") return respond(ack, { ok: false, error: "Ce mode n'est pas disponible." });
      if (room.gameMode !== mode && room.status === "complete") {
        room.status = "waiting";
        room.roundNumber = 0;
        room.target = null;
        room.nearestTarget = null;
        for (const p of room.players) { p.correct = false; p.lastGain = 0; p.nearestPick = null; }
      }
      room.gameMode = mode;
      if (mode === "dexrace") {
        room.selectedGens = [room.selectedGens?.[0] || 1];
        room.totalRounds = 1;
        dexRace.balanceRaceTeams(room);
      } else {
        room.totalRounds = partyTotalRoundsForMode(mode, room.configuredRounds, room.bacRounds);
      }
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de changer le mode." });
    }
  });

  socket.on("party:set-rounds", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut changer le nombre de manches." });
      if (room.status !== "waiting" && room.status !== "complete") return respond(ack, { ok: false, error: "Impossible de changer en cours de party." });
      const rounds = Number(payload.rounds);
      if (![5, 10, 15, 20].includes(rounds)) return respond(ack, { ok: false, error: "Choisis 5, 10, 15 ou 20 manches." });
      room.configuredRounds = rounds;
      room.totalRounds = partyTotalRoundsForMode(room.gameMode, rounds, room.bacRounds);
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de changer le nombre de manches." });
    }
  });

  socket.on("party:set-gens", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut changer les generations." });
      if (room.status !== "waiting" && room.status !== "complete") return respond(ack, { ok: false, error: "Impossible de changer en cours de party." });
      let gens = Array.isArray(payload.gens) ? payload.gens.map(Number).filter((g) => Number.isInteger(g) && g >= 1 && g <= 9) : [];
      gens = Array.from(new Set(gens)).sort((a, b) => a - b);
      if (!gens.length) return respond(ack, { ok: false, error: "Choisis au moins une generation." });
      if (room.gameMode === "dexrace" && gens.length !== 1) return respond(ack, { ok: false, error: "Choisis une seule génération pour la grille." });
      room.selectedGens = gens;
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de changer les generations." });
    }
  });

  socket.on("party:petitbac-options", (payload = {}, ack) => {
    const room = findPartyRoomBySocket(socket.id);
    if (!room || room.gameMode !== "petitbac" || room.hostId !== socket.id || !["waiting","complete"].includes(room.status)) return respond(ack, {ok:false,error:"Seul l’hôte règle la prochaine partie."});
    const result = petitBacParty.setPetitBacOptions(room, { themes: payload.themes, time: payload.time, rounds: payload.rounds, hard: payload.hard, random: payload.random === true }, POKEMON_LIST);
    if (result.error) return respond(ack, {ok:false,error:result.error,room:publicPartyRoomState(room,socket.id)});
    room.totalRounds = partyTotalRoundsForMode(room.gameMode, room.configuredRounds, room.bacRounds);
    emitPartyRoomState(room); respond(ack, {ok:true,room:publicPartyRoomState(room,socket.id)});
  });
  socket.on("party:dexrace-options", (payload = {}, ack) => {
    const room = findPartyRoomBySocket(socket.id);
    if (!room || room.gameMode !== "dexrace" || room.hostId !== socket.id || !["waiting","complete"].includes(room.status)) return respond(ack, {ok:false,error:"Seul l’hôte peut régler la prochaine course."});
    if (!["duel","teams"].includes(payload.format) || ![0,180,300].includes(payload.duration)) return respond(ack, {ok:false,error:"Réglages invalides."});
    room.raceFormat = payload.format; room.raceDuration = payload.duration;
    if (room.status === "complete") room.status = "waiting";
    emitPartyRoomState(room); respond(ack, {ok:true,room:publicPartyRoomState(room,socket.id)});
  });
  socket.on("party:dexrace-team", (payload = {}, ack) => {
    const room = findPartyRoomBySocket(socket.id);
    const player = room?.players.find(p=>p.id===socket.id);
    if (!player || room.gameMode !== "dexrace" || room.raceFormat !== "teams" || !["waiting","complete"].includes(room.status) || !["blue","coral"].includes(payload.team)) return respond(ack, {ok:false,error:"Les équipes se choisissent avant la course."});
    player.raceTeam = payload.team;
    emitPartyRoomState(room); respond(ack, {ok:true,room:publicPartyRoomState(room,socket.id)});
  });

  socket.on("stat-clash:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      console.log("[stat-clash][create-room] request");
      handleStatClashDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const selectedGens = normalizeSelectedGens(payload.selectedGens);
      const code = generateStatClashRoomCode();
      const room = {
        code,
        status: "lobby",
        roundPhase: "waiting",
        createdAt: Date.now(),
        hostId: socket.id,
        players: [],
        maxPlayers: STAT_CLASH_MAX_PLAYERS,
        selectedGens,
        round: 0,
        totalRounds: STAT_CLASH_TOTAL_ROUNDS,
        matchWinsBySide: { left: 0, right: 0 },
        sessionRecord: { ...STAT_CLASH_SESSION_RECORD_DEFAULT },
        usedStatKeysBySide: { left: [], right: [] },
        usedPokemonIds: [],
        currentPokemon: null,
        currentStats: null,
        reveal: null,
        deadlineAt: null,
        winnerId: null,
        endedReason: null,
        cleanupTimer: null,
        startTimer: null,
        rollTimer: null,
        resolveTimer: null,
        nextRoundTimer: null,
        previewTimers: { left: null, right: null },
        format: normalizeStatClashFormat(payload.format),
        houseRuleEnabled: payload.houseRuleEnabled !== false,
        houseRule: null,
        houseRuleBySide: { left: null, right: null },
        houseRuleShared: null,
        houseRuleSharedEnabled: Boolean(payload.houseRuleSharedEnabled),
        pendingImposedRuleBySide: { left: null, right: null },
        doubleStatKey: null,
        mirrorStatKey: null,
        blindRound5OptionsBySide: { left: null, right: null },
        suddenDeath: false,
        streakBySide: { left: 0, right: 0 },
        roundsWonBySide: { left: 0, right: 0 },
        jokersBySide: buildStatClashRoomJokers(),
      };
      statClashRooms.set(code, room);
      const player = joinPlayerToStatClashRoom(room, socket, nickname);
      console.log("[stat-clash][create-room] created", { code: maskCode(code) });
      recordUsage("statclash:create");
      emitStatClashRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      console.error("[stat-clash][create-room] error", _error?.message || "unknown");
      respond(ack, { ok: false, error: "Impossible de créer la room Stat Clash." });
    }
  });

  socket.on("stat-clash:join-room", async (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      console.log("[stat-clash][join-room] request");
      handleStatClashDisconnect(socket.id, true);
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 2";
      console.log("[stat-clash][join-room] sanitized");
      if (!code) return respond(ack, { ok: false, error: "Code de room invalide." });
      const room = statClashRooms.get(code);
      console.log("[stat-clash][join-room] lookup", { exists: Boolean(room) });
      if (!room) return respond(ack, { ok: false, error: "Room Stat Clash introuvable." });
      if (room.players.length >= (room.maxPlayers || STAT_CLASH_MAX_PLAYERS)) return respond(ack, { ok: false, error: "La room est déjà complète." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "Cette room est terminée." });

      const player = joinPlayerToStatClashRoom(room, socket, nickname);
      console.log("[stat-clash][join-room] joined", { code: maskCode(code), playerCount: room.players.length });
      emitStatClashRoomState(room);
      io.to(room.code).emit("stat-clash:room-presence", { code: room.code, connectedCount: getConnectedStatClashPlayers(room).length });
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      console.error("[stat-clash][join-room] error", _error?.message || "unknown");
      respond(ack, { ok: false, error: "Impossible de rejoindre la room Stat Clash." });
    }
  });

  socket.on("stat-clash:select-imposed-rule", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Les règles se choisissent dans le lobby." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const rule = getStatClashRuleById(String(payload.ruleId || ""));
      if (!rule || !STAT_CLASH_IMPOSABLE_RULE_IDS.has(rule.id)) return respond(ack, { ok: false, error: "Règle non disponible." });
      room.pendingImposedRuleBySide = room.pendingImposedRuleBySide || { left: null, right: null };
      const opponentSide = getOppositeStatClashSide(player.side);
      const opponentChoice = opponentSide ? room.pendingImposedRuleBySide[opponentSide] : null;
      if (opponentChoice && opponentChoice === rule.id) return respond(ack, { ok: false, error: "L'adversaire a déjà choisi cette règle, prends-en une autre." });
      room.pendingImposedRuleBySide[player.side] = rule.id;
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du choix de règle." });
    }
  });

  socket.on("stat-clash:start-game", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "restart")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer la partie." });
      if (!canStatClashRoomStart(room)) return respond(ack, { ok: false, error: "La room n'est pas prête. Il faut deux joueurs connectés." });
      if (room.status === "starting" || room.status === "live") return respond(ack, { ok: false, error: "La partie est déjà en cours de lancement." });

      room.status = "starting";
      room.roundPhase = "waiting";
      room.startedAt = Date.now() + STAT_CLASH_START_DELAY_MS;
      emitStatClashRoomState(room);
      clearStatClashRoomTimers(room);
      room.startTimer = setTimeout(async () => {
        room.startTimer = null;
        if (!canStatClashRoomStart(room)) {
          room.status = "lobby";
          room.roundPhase = "waiting";
          room.startedAt = null;
          emitStatClashRoomState(room);
          return;
        }
        await startStatClashMatch(room);
      }, STAT_CLASH_START_DELAY_MS);

      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du lancement." });
    }
  });

  socket.on("stat-clash:submit-pick", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "pick")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "live" || room.roundPhase !== "picking") return respond(ack, { ok: false, error: "La manche n'est pas en phase de choix." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      if (player.pendingPickKey) return respond(ack, { ok: false, error: "Choix déjà verrouillé pour cette manche." });

      const statKey = normalizeStatClashStatKey(payload.statKey);
      if (!statKey) return respond(ack, { ok: false, error: "Stat invalide." });
      if (!room.suddenDeath && (room.usedStatKeysBySide?.[player.side] || []).includes(statKey)) {
        return respond(ack, { ok: false, error: "Tu as déjà utilisé cette stat plus tôt." });
      }
      const allowed = getStatClashAllowedStatsRoom(room, player.side);
      if (!allowed.includes(statKey)) {
        return respond(ack, { ok: false, error: "Stat verrouillee par la regle maison cette manche." });
      }

      player.pendingPickKey = statKey;
      player.pendingSubmittedAt = Date.now();
      emitStatClashRoomState(room);
      if (getConnectedStatClashPlayers(room).every((entry) => entry.pendingPickKey)) {
        if (room.resolveTimer) clearTimeout(room.resolveTimer);
        room.roundPhase = "locked";
        room.lockedEndsAt = Date.now() + STAT_CLASH_LOCKED_REVEAL_MS;
        emitStatClashRoomState(room);
        room.resolveTimer = setTimeout(() => resolveStatClashRound(room), STAT_CLASH_LOCKED_REVEAL_MS);
      }
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du choix de stat." });
    }
  });

  socket.on("stat-clash:update-gens", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le créateur peut modifier les générations." });
      if (room.status === "live") return respond(ack, { ok: false, error: "Impossible de changer les générations pendant une partie." });

      room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de la mise à jour des générations." });
    }
  });

  socket.on("stat-clash:restart-round", async (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "restart")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "finished") return respond(ack, { ok: false, error: "La partie n'est pas terminée." });
      if (!canStatClashRoomStart(room)) {
        return respond(ack, { ok: false, error: "Les deux joueurs doivent être présents pour rejouer." });
      }
      if (Array.isArray(payload.selectedGens)) {
        if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le créateur peut changer les générations." });
        room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      }
      resetStatClashRoomForNewMatch(room);
      room.pendingImposedRuleBySide = { left: null, right: null };
      room.status = "lobby";
      room.roundPhase = "waiting";
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du redémarrage Stat Clash." });
    }
  });

  socket.on("stat-clash:update-room-options", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le createur peut modifier les options." });
      if (room.status === "live" || room.status === "starting") return respond(ack, { ok: false, error: "Impossible de changer les options pendant une partie." });
      if (typeof payload.format === "string") room.format = normalizeStatClashFormat(payload.format);
      if (typeof payload.houseRuleEnabled === "boolean") room.houseRuleEnabled = payload.houseRuleEnabled;
      if (typeof payload.houseRuleSharedEnabled === "boolean") room.houseRuleSharedEnabled = payload.houseRuleSharedEnabled;
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de la mise a jour des options." });
    }
  });

  socket.on("stat-clash:use-joker", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "pick")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "live" || room.roundPhase !== "picking") return respond(ack, { ok: false, error: "Tu ne peux utiliser un joker que pendant la phase de choix." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      if (player.pendingPickKey) return respond(ack, { ok: false, error: "Choix deja verrouille pour cette manche." });
      const side = player.side;
      const jokers = room.jokersBySide && room.jokersBySide[side];
      if (!jokers) return respond(ack, { ok: false, error: "Aucun joker disponible." });
      const type = String(payload.type || "");
      if (type === "reroll") {
        if (jokers.reroll <= 0) return respond(ack, { ok: false, error: "Joker Reroll deja consomme." });
        jokers.reroll = 0;
        for (const p of room.players) { p.pendingPickKey = null; p.pendingSubmittedAt = null; }
        clearStatClashRoomTimers(room);
        clearStatClashPreviewTimers(room);
        const pool = getStatClashPoolForRoom(room);
        const pokemon = pool[Math.floor(Math.random() * pool.length)] || null;
        room.currentPokemon = pokemon;
        room.reveal = null;
        room.roundPhase = "rolling";
        room.rollEndsAt = Date.now() + STAT_CLASH_ROLL_MS;
        room.deadlineAt = null;
        if (pokemon) room.usedPokemonIds.push(Number(pokemon.id));
        if (room.houseRuleEnabled && (room.houseRuleShared || room.houseRule)?.id === "mirrorRound4" && room.round === 4) {
          const cand = STAT_CLASH_STAT_KEYS.filter((k) => !room.usedStatKeysBySide.left.includes(k) && !room.usedStatKeysBySide.right.includes(k));
          room.mirrorStatKey = cand[Math.floor(Math.random() * cand.length)] || STAT_CLASH_STAT_KEYS[0];
        }
        emitStatClashRoomState(room);
        (async () => {
          try { room.currentStats = pokemon ? await fetchStatClashPokemonStats(pokemon.apiId || pokemon.id) : null; } catch (_e) { room.currentStats = null; }
          room.rollTimer = setTimeout(() => {
            const pickMs = getStatClashHouseRuleTimerMsRoom(room);
            room.roundPhase = "picking";
            room.rollEndsAt = null;
            room.deadlineAt = Date.now() + pickMs;
            emitStatClashRoomState(room);
            room.resolveTimer = setTimeout(() => resolveStatClashRound(room), pickMs);
          }, STAT_CLASH_ROLL_MS);
        })();
        return respond(ack, { ok: true });
      }
      if (type === "preview") {
        if (jokers.preview <= 0) return respond(ack, { ok: false, error: "Joker Apercu deja consomme." });
        const allowed = getStatClashAllowedStatsRoom(room, side);
        const candidates = allowed.length ? allowed : STAT_CLASH_STAT_KEYS;
        jokers.preview = 0;
        jokers.previewKey = candidates[Math.floor(Math.random() * candidates.length)];
        jokers.previewExpiresAt = Date.now() + STAT_CLASH_PREVIEW_DURATION_MS;
        emitStatClashRoomState(room);
        if (!room.previewTimers) room.previewTimers = { left: null, right: null };
        if (room.previewTimers[side]) clearTimeout(room.previewTimers[side]);
        room.previewTimers[side] = setTimeout(() => {
          if (room.jokersBySide && room.jokersBySide[side]) {
            room.jokersBySide[side].previewKey = null;
            room.jokersBySide[side].previewExpiresAt = null;
            emitStatClashRoomState(room);
          }
          if (room.previewTimers) room.previewTimers[side] = null;
        }, STAT_CLASH_PREVIEW_DURATION_MS);
        return respond(ack, { ok: true });
      }
      if (type === "double") {
        if (jokers.double <= 0) return respond(ack, { ok: false, error: "Joker Double deja consomme." });
        if (jokers.doubleArmed) return respond(ack, { ok: false, error: "Joker Double deja arme." });
        jokers.double = 0;
        jokers.doubleArmed = true;
        emitStatClashRoomState(room);
        return respond(ack, { ok: true });
      }
      return respond(ack, { ok: false, error: "Type de joker inconnu." });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de l'utilisation du joker." });
    }
  });

  socket.on("stat-clash:resume", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "resume")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      const code = sanitizeRoomCode(payload.code);
      const token = String(payload.resumeToken || "").trim().slice(0, 96);
      const room = statClashRooms.get(code);
      if (!room || !token) return respond(ack, { ok: false, error: "Session Stat Clash introuvable." });
      const player = room.players.find((entry) => entry.reconnectToken === token);
      if (!player) return respond(ack, { ok: false, error: "Place Stat Clash indisponible." });
      if (player.reconnectUntil && Date.now() > Number(player.reconnectUntil)) return respond(ack, { ok: false, error: "Délai de reconnexion expiré." });
      const previousId = player.id;
      if (player.connected && previousId === socket.id) {
        return respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicStatClashRoomState(room, socket.id) });
      }
      const previousSocket = previousId && previousId !== socket.id ? io.sockets.sockets.get(previousId) : null;
      if (previousSocket) {
        previousSocket.leave(room.code);
        if (previousSocket.data) previousSocket.data.statClashRoomCode = null;
      }
      if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
      player.id = socket.id;
      player.connected = true;
      player.disconnectedAt = null;
      player.reconnectUntil = null;
      if (room.hostId === previousId) room.hostId = socket.id;
      if (room.winnerId === previousId) room.winnerId = socket.id;
      socket.join(room.code);
      socket.data.statClashRoomCode = room.code;
      if (previousSocket?.connected) previousSocket.disconnect(true);
      emitStatClashRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Reconnexion Stat Clash impossible." });
    }
  });

  socket.on("stat-clash:leave-room", () => {
    try { handleStatClashDisconnect(socket.id, true); } catch (_error) { console.error("[stat-clash:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("disconnect", () => {
    try { handleDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][duel] error", _error?.message || "unknown"); }
    try { handleStatClashDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][stat-clash] error", _error?.message || "unknown"); }
    try { handleDraftScoreDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][draft-score] error", _error?.message || "unknown"); }
    try { handleHigherLowerDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][higher-lower] error", _error?.message || "unknown"); }
    try { handleStatAuctionDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][stat-auction] error", _error?.message || "unknown"); }
    try { handlePartyDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][party] error", _error?.message || "unknown"); }
    cleanupRateLimitBuckets(socket.id);
  });

  socket.on("draft-score:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      handleDraftScoreDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const code = generateDraftScoreRoomCode();
      const room = {
        code,
        hostId: socket.id,
        status: "lobby",
        players: [{ id: socket.id, side: "left", nickname, connected: true, result: null }],
        winnerSide: null,
        createdAt: Date.now(),
      };
      draftScoreRooms.set(code, room);
      socket.data.draftScoreRoomCode = code;
      socket.join(code);
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true, room: publicDraftScoreRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible de créer la room Score Attack." });
    }
  });

  socket.on("draft-score:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      handleDraftScoreDisconnect(socket.id, true);
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 2";
      const room = draftScoreRooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room Score Attack introuvable." });
      if (room.players.length >= MAX_ROOM_SIZE) return respond(ack, { ok: false, error: "La room est déjà complète." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "Cette room est terminée." });
      room.players.push({ id: socket.id, side: "right", nickname, connected: true, result: null });
      room.status = "live";
      socket.data.draftScoreRoomCode = code;
      socket.join(code);
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true, room: publicDraftScoreRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible de rejoindre la room Score Attack." });
    }
  });

  socket.on("draft-score:leave-room", () => {
    try { handleDraftScoreDisconnect(socket.id, true); } catch (_error) { console.error("[draft-score:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("draft-score:start-duel", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "action")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer le duel." });
      if (room.players.length < 2 || room.players.some((p) => !p.connected)) return respond(ack, { ok: false, error: "En attente d'un adversaire." });
      // L'host peut toujours (re)lancer un duel — reset complet
      const gen = Number(payload.gen);
      if (!Number.isInteger(gen) || gen < 1 || gen > 9) return respond(ack, { ok: false, error: "Génération invalide." });
      const pool = generateDraftDuelPool(gen);
      if (!pool.length || pool.length < 12) return respond(ack, { ok: false, error: "Pool Pokémon insuffisant." });
      room.duel = {
        gen,
        pool,
        draftedIds: new Set(),
        currentWave: [],
        waveIndex: 0,
        pendingPicks: { left: null, right: null },
        teams: { left: [], right: [] },
        picksRemaining: { left: 6, right: 6 },
        rerollsLeft: 5,
        lastEvent: { kind: "started", at: Date.now() },
      };
      room.duel.currentWave = generateDraftDuelNextWave(room);
      room.status = "live";
      room.winnerSide = null;
      for (const p of room.players) { p.result = null; p.progress = null; }
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du lancement du duel." });
    }
  });

  socket.on("draft-score:pick-option", async (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room || !room.duel || room.status !== "live") return respond(ack, { ok: false, error: "Pas de duel actif." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const side = player.side;
      if (room.duel.pendingPicks[side]) return respond(ack, { ok: false, error: "Tu as déjà choisi pour cette manche." });
      if (room.duel.picksRemaining[side] <= 0) return respond(ack, { ok: false, error: "Plus de picks pour toi." });
      const pokemonId = Number(payload.pokemonId);
      if (!room.duel.currentWave.includes(pokemonId)) return respond(ack, { ok: false, error: "Pokémon hors de la wave courante." });
      const bst = await getDraftScoreServerBst(pokemonId, payload.bst);
      if (!bst) return respond(ack, { ok: false, error: "Score Pokémon indisponible." });
      room.duel.pendingPicks[side] = { id: pokemonId, bst, timestamp: Date.now() };
      room.duel.lastEvent = { kind: "pick", side, pokemonId, at: Date.now() };

      const both = room.duel.pendingPicks.left && room.duel.pendingPicks.right;
      if (both) {
        const leftPick = room.duel.pendingPicks.left;
        const rightPick = room.duel.pendingPicks.right;
        const conflict = leftPick.id === rightPick.id;
        if (conflict) {
          const winnerSide = Math.random() < 0.5 ? "left" : "right";
          const winnerEntry = buildDuelPokemonEntry(leftPick.id);
          if (winnerEntry) {
            room.duel.teams[winnerSide].push({ ...winnerEntry, bst: Number(leftPick.bst) || Number(rightPick.bst) || 0 });
            room.duel.draftedIds.add(winnerEntry.id);
            room.duel.picksRemaining[winnerSide] -= 1;
          }
          room.duel.pendingPicks = { left: null, right: null };
          room.duel.lastEvent = { kind: "conflict", winnerSide, pokemonId: winnerEntry?.id || 0, at: Date.now() };
        } else {
          const leftEntry = buildDuelPokemonEntry(leftPick.id);
          const rightEntry = buildDuelPokemonEntry(rightPick.id);
          if (leftEntry) { room.duel.teams.left.push({ ...leftEntry, bst: leftPick.bst || 0 }); room.duel.draftedIds.add(leftEntry.id); room.duel.picksRemaining.left -= 1; }
          if (rightEntry) { room.duel.teams.right.push({ ...rightEntry, bst: rightPick.bst || 0 }); room.duel.draftedIds.add(rightEntry.id); room.duel.picksRemaining.right -= 1; }
          room.duel.pendingPicks = { left: null, right: null };
          room.duel.lastEvent = { kind: "resolved", at: Date.now() };
        }
        const allDone = room.duel.picksRemaining.left <= 0 && room.duel.picksRemaining.right <= 0;
        if (allDone) {
          for (const p of room.players) {
            const team = room.duel.teams[p.side] || [];
            const bstSum = team.reduce((s, t) => s + (Number(t.bst) || 0), 0);
            const avg = team.length ? Math.round(bstSum / team.length) : 0;
            p.result = {
              average: avg,
              total: bstSum,
              selectedGen: room.duel.gen,
              team: team.map((entry) => ({ id: entry.id, name: entry.name, bst: Number(entry.bst) || 0 })),
              label: getDraftScoreServerLabel(avg),
              submittedAt: Date.now(),
            };
          }
          finalizeDraftScoreRoom(room);
        } else {
          room.duel.waveIndex += 1;
          room.duel.currentWave = generateDraftDuelNextWave(room);
          emitDraftScoreRoomState(room);
        }
      } else {
        emitDraftScoreRoomState(room);
      }
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du pick." });
    }
  });

  socket.on("draft-score:reset-self", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false });
      player.result = null;
      player.progress = null;
      // Si tous les joueurs ont reset, la room repasse en live (relance possible)
      if (room.players.every((p) => !p.result)) {
        room.status = "live";
        room.winnerSide = null;
      }
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false });
    }
  });

  socket.on("draft-score:reroll-duel-wave", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room || !room.duel || room.status !== "live") return respond(ack, { ok: false, error: "Pas de duel actif." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut relancer la vague." });
      // Bloquer si un joueur a déjà pick dans cette wave
      if (room.duel.pendingPicks?.left || room.duel.pendingPicks?.right) return respond(ack, { ok: false, error: "Un joueur a déjà choisi pour cette manche." });
      // Limiter les rerolls (5 max par duel)
      room.duel.rerollsLeft = Math.max(0, Number(room.duel.rerollsLeft ?? 5));
      if (room.duel.rerollsLeft <= 0) return respond(ack, { ok: false, error: "Plus de rerolls disponibles." });
      room.duel.rerollsLeft -= 1;
      room.duel.currentWave = generateDraftDuelNextWave(room);
      room.duel.lastEvent = { kind: "reroll", at: Date.now() };
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du reroll." });
    }
  });

  socket.on("draft-score:reaction", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false });
      const allowed = new Set(["🔥", "😱", "😈", "👍", "🤡", "💀", "👀", "🎯"]);
      const emoji = String(payload.emoji || "").trim();
      if (!allowed.has(emoji)) return respond(ack, { ok: false });
      // Relay to other players in room
      for (const other of room.players) {
        if (other.id === socket.id || !other.connected) continue;
        io.to(other.id).emit("draft-score:reaction-received", { emoji, fromSide: player.side, fromNickname: player.nickname || "Adversaire", at: Date.now() });
      }
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false });
    }
  });

  socket.on("draft-score:pick-progress", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room || room.status === "finished") return respond(ack, { ok: false });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false });
      const team = Array.isArray(payload.team) ? payload.team.slice(0, 6).map((entry) => ({
        id: Number(entry?.id) || 0,
        name: String(entry?.name || "").slice(0, 40),
        bst: Math.max(0, Math.min(800, Math.round(Number(entry?.bst) || 0))),
        shiny: Boolean(entry?.shiny),
      })) : [];
      const average = Math.max(0, Math.min(800, Math.round(Number(payload.average) || 0)));
      const total = Math.max(0, Math.min(4800, Math.round(Number(payload.total) || 0)));
      const rerollsLeft = Math.max(0, Math.min(20, Math.round(Number(payload.rerollsLeft ?? 5))));
      player.progress = { team, average, total, rerollsLeft, updatedAt: Date.now() };
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false });
    }
  });

  socket.on("draft-score:submit-result", async (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "action")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Score Attack active." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "La room est déjà terminée." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const result = await sanitizeDraftScoreResult(payload);
      if (!result) return respond(ack, { ok: false, error: "Résultat Score Attack invalide." });
      player.result = result;
      if (room.players.length === MAX_ROOM_SIZE && room.players.every((entry) => entry.result)) finalizeDraftScoreRoom(room);
      else emitDraftScoreRoomState(room);
      respond(ack, { ok: true, room: publicDraftScoreRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible d'envoyer le résultat Score Attack." });
    }
  });

  // === HIGHER OR LOWER — multi 1v1 ===
  socket.on("higher-lower:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie." });
      handleHigherLowerDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const code = generateHigherLowerRoomCode();
      const room = {
        code,
        hostId: socket.id,
        status: "lobby",
        players: [{ id: socket.id, side: "left", nickname, score: 0, cursor: 0, connected: true }],
        sequence: null,
        startedAt: null,
        endsAt: null,
        endTimer: null,
        winnerSide: null,
        selectedGens: Array.isArray(payload.selectedGens) ? payload.selectedGens.map(Number).filter(Boolean) : [],
      };
      higherLowerRooms.set(code, room);
      socket.data.higherLowerRoomCode = code;
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true, room: publicHigherLowerRoomState(room, socket.id) });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors de la création." });
    }
  });

  socket.on("higher-lower:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie." });
      handleHigherLowerDisconnect(socket.id, true);
      const code = String(payload.code || "").trim().toUpperCase();
      const nickname = sanitizeNickname(payload.nickname) || "Invité";
      if (!higherLowerRooms.has(code)) return respond(ack, { ok: false, error: "Room introuvable." });
      const room = higherLowerRooms.get(code);
      if (room.players.length >= 2) return respond(ack, { ok: false, error: "Room pleine." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Partie déjà lancée." });
      room.players.push({ id: socket.id, side: "right", nickname, score: 0, cursor: 0, connected: true });
      socket.data.higherLowerRoomCode = code;
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true, room: publicHigherLowerRoomState(room, socket.id) });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors du join." });
    }
  });

  socket.on("higher-lower:leave-room", () => {
    handleHigherLowerDisconnect(socket.id, true);
  });

  socket.on("higher-lower:start-game", (payload = {}, ack) => {
    try {
      const room = findHigherLowerRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer." });
      if (room.players.length < 2 || room.players.some((p) => !p.connected)) return respond(ack, { ok: false, error: "En attente d'un adversaire." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Déjà lancée." });
      if (Array.isArray(payload.selectedGens) && payload.selectedGens.length) {
        room.selectedGens = payload.selectedGens.map(Number).filter(Boolean);
      }
      const sequence = generateHigherLowerSequence(room.selectedGens);
      if (!sequence?.length) return respond(ack, { ok: false, error: "Pool Pokémon insuffisant pour générer la séquence." });
      room.sequence = sequence;
      room.status = "live";
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.cursor = 0; }
      startHigherLowerMatchTimer(room);
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors du lancement." });
    }
  });

  socket.on("higher-lower:submit-answer", async (payload = {}, ack) => {
    let pendingPlayer = null;
    try {
      const room = findHigherLowerRoomBySocket(socket.id);
      if (!room || room.status !== "live") return respond(ack, { ok: false, error: "Pas de partie en cours." });
      const player = room.players.find((p) => p.id === socket.id);
      if (!player?.connected) return respond(ack, { ok: false, error: "Joueur introuvable." });
      if (player.answerPending) return respond(ack, { ok: false, error: "Réponse en cours de validation." });
      if (payload.cursor != null && Number(payload.cursor) !== player.cursor) return respond(ack, { ok: false, error: "Cette paire n'est plus active." });
      const choice = String(payload.choice || "").toLowerCase();
      if (choice !== "higher" && choice !== "lower") return respond(ack, { ok: false, error: "Choix invalide." });
      // Le serveur recalcule lui-même si la réponse est correcte (no client trust)
      const pair = Array.isArray(room.sequence) ? room.sequence[player.cursor] : null;
      if (!pair) return respond(ack, { ok: false, error: "Paire courante introuvable." });
      const cursor = player.cursor;
      const sequence = room.sequence;
      pendingPlayer = player;
      player.answerPending = true;
      const [leftStats, rightStats] = await Promise.all([fetchPokemonStatsServer(pair.leftId), fetchPokemonStatsServer(pair.rightId)]);
      if (room.status !== "live" || room.sequence !== sequence || player.cursor !== cursor || !player.connected || Date.now() >= room.endsAt) {
        return respond(ack, { ok: false, error: "Cette course est terminée." });
      }
      if (!leftStats || !rightStats) return respond(ack, { ok: false, error: "Statistiques indisponibles. Réessaie : aucun point n'a été compté." });
      const statKey = pair.statKey || "hp";
      const leftVal = Number(leftStats?.[statKey]) || 0;
      const rightVal = Number(rightStats?.[statKey]) || 0;
      let correct;
      if (rightVal === leftVal) correct = true;
      else if (rightVal > leftVal) correct = (choice === "higher");
      else correct = (choice === "lower");
      if (correct) player.score += 1;
      player.cursor += 1;
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true, correct, leftVal, rightVal, cursor: player.cursor, score: player.score });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors de la soumission." });
    } finally { if (pendingPlayer) pendingPlayer.answerPending = false; }
  });

  socket.on("higher-lower:restart-match", (payload = {}, ack) => {
    try {
      const room = findHigherLowerRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut relancer." });
      if (room.status !== "finished") return respond(ack, { ok: false, error: "La partie n'est pas terminée." });
      if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
      room.players = room.players.filter((p) => p.connected);
      room.players.forEach((p, index) => { p.side = index === 0 ? "left" : "right"; });
      room.finishReason = null;
      room.status = "lobby";
      room.sequence = null;
      room.startedAt = null;
      room.endsAt = null;
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.cursor = 0; }
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors du restart." });
    }
  });

  // === STAT AUCTION — multi 1v1 ===
  socket.on("stat-auction:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      handleStatAuctionDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const code = generateStatAuctionRoomCode();
      const room = {
        code,
        hostId: socket.id,
        status: "lobby",
        round: 0,
        totalRounds: 5,
        players: [{ id: socket.id, side: "left", nickname, score: 0, allocations: [], connected: true, reconnectToken: crypto.randomBytes(18).toString("hex"), reconnectUntil: null, reconnectTimer: null }],
        sequence: null,
        currentAllocations: { left: null, right: null },
        history: [],
        winnerSide: null,
        selectedGens: Array.isArray(payload.selectedGens) ? payload.selectedGens.map(Number).filter(Boolean) : [],
      };
      statAuctionRooms.set(code, room);
      socket.data.statAuctionRoomCode = code;
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true, resumeToken: room.players[0].reconnectToken, room: publicStatAuctionRoomState(room, socket.id) });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur création." }); }
  });

  socket.on("stat-auction:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      handleStatAuctionDisconnect(socket.id, true);
      const code = String(payload.code || "").trim().toUpperCase();
      const nickname = sanitizeNickname(payload.nickname) || "Invité";
      if (!statAuctionRooms.has(code)) return respond(ack, { ok: false, error: "Room introuvable." });
      const room = statAuctionRooms.get(code);
      if (room.players.length >= 2) return respond(ack, { ok: false, error: "Room pleine." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Partie déjà lancée." });
      const player = { id: socket.id, side: "right", nickname, score: 0, allocations: [], connected: true, reconnectToken: crypto.randomBytes(18).toString("hex"), reconnectUntil: null, reconnectTimer: null };
      room.players.push(player);
      socket.data.statAuctionRoomCode = code;
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true, resumeToken: player.reconnectToken, room: publicStatAuctionRoomState(room, socket.id) });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur join." }); }
  });

  socket.on("stat-auction:resume", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "resume")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      const code = sanitizeRoomCode(payload.code);
      const token = String(payload.resumeToken || "").trim().slice(0, 96);
      const room = statAuctionRooms.get(code);
      if (!room || !token) return respond(ack, { ok: false, error: "Session Stat Auction introuvable." });
      const player = room.players.find((entry) => entry.reconnectToken === token);
      if (!player) return respond(ack, { ok: false, error: "Place Stat Auction indisponible." });
      if (player.reconnectUntil && Date.now() > Number(player.reconnectUntil)) return respond(ack, { ok: false, error: "Délai de reconnexion expiré." });
      const previousId = player.id;
      if (player.connected && previousId === socket.id) {
        return respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicStatAuctionRoomState(room, socket.id) });
      }
      const previousSocket = previousId && previousId !== socket.id ? io.sockets.sockets.get(previousId) : null;
      if (previousSocket) {
        previousSocket.leave(room.code);
        if (previousSocket.data) previousSocket.data.statAuctionRoomCode = null;
      }
      if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
      player.id = socket.id;
      player.connected = true;
      player.disconnectedAt = null;
      player.reconnectUntil = null;
      if (room.hostId === previousId) room.hostId = socket.id;
      socket.join(room.code);
      socket.data.statAuctionRoomCode = room.code;
      if (previousSocket?.connected) previousSocket.disconnect(true);
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true, code, resumeToken: player.reconnectToken, room: publicStatAuctionRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Reconnexion Stat Auction impossible." });
    }
  });

  socket.on("stat-auction:leave-room", () => { handleStatAuctionDisconnect(socket.id, true); });

  socket.on("stat-auction:start-game", (payload = {}, ack) => {
    try {
      const room = findStatAuctionRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer." });
      if (room.players.length < 2 || room.players.some((p) => !p.connected)) return respond(ack, { ok: false, error: "En attente d'un adversaire." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Déjà lancée." });
      if (Array.isArray(payload.selectedGens) && payload.selectedGens.length) {
        room.selectedGens = payload.selectedGens.map(Number).filter(Boolean);
      }
      const sequence = generateStatAuctionSequence(room.selectedGens, room.totalRounds);
      if (!sequence?.length) return respond(ack, { ok: false, error: "Pool Pokémon insuffisant." });
      room.sequence = sequence;
      room.status = "live";
      room.round = 1;
      room.currentAllocations = { left: null, right: null };
      room.history = [];
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.allocations = []; }
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur lancement." }); }
  });

  socket.on("stat-auction:submit-allocation", async (payload = {}, ack) => {
    let pendingPlayer = null;
    try {
      const room = findStatAuctionRoomBySocket(socket.id);
      if (!room || room.status !== "live") return respond(ack, { ok: false, error: "Pas de partie." });
      const player = room.players.find((p) => p.id === socket.id);
      if (!player?.connected) return respond(ack, { ok: false, error: "Joueur introuvable." });
      if (player.allocationPending || room.currentAllocations[player.side]) {
        return respond(ack, { ok: false, error: "Allocation déjà envoyée pour cette manche." });
      }
      const allocation = sanitizeStatAuctionAllocation(payload.allocation);
      if (!allocation) return respond(ack, { ok: false, error: "Allocation invalide (somme doit être 100)." });
      // Le serveur calcule le score lui-même depuis les vraies stats serveur (no client trust)
      const pokemonId = Array.isArray(room.sequence) ? room.sequence[room.round - 1] : null;
      const submittedRound = room.round;
      const submittedSequence = room.sequence;
      pendingPlayer = player;
      player.allocationPending = true;
      const realStats = await fetchPokemonStatsServer(pokemonId);
      if (room.status !== "live" || room.round !== submittedRound || room.sequence !== submittedSequence || !player.connected) {
        return respond(ack, { ok: false, error: "Cette manche est terminée." });
      }
      if (!realStats) {
        return respond(ack, { ok: false, error: "Statistiques indisponibles. Réessaie : aucun point n'a été compté." });
      }
      let computedScore = 0;
      if (realStats) {
        for (const k of STAT_AUCTION_STAT_KEYS) {
          const alloc = Number(allocation[k]) || 0;
          const val = Number(realStats[k]) || 0;
          computedScore += alloc * val;
        }
      }
      room.currentAllocations[player.side] = { allocation, computedScore, realStats };
      if (room.currentAllocations.left && room.currentAllocations.right) {
        const leftEntry = room.currentAllocations.left;
        const rightEntry = room.currentAllocations.right;
        const leftPlayer = room.players.find((p) => p.side === "left");
        const rightPlayer = room.players.find((p) => p.side === "right");
        if (leftPlayer) { leftPlayer.score += leftEntry.computedScore; leftPlayer.allocations.push(leftEntry.allocation); }
        if (rightPlayer) { rightPlayer.score += rightEntry.computedScore; rightPlayer.allocations.push(rightEntry.allocation); }
        room.history.push({
          round: room.round,
          pokemonId: room.sequence[room.round - 1],
          left: leftEntry,
          right: rightEntry,
        });
        room.currentAllocations = { left: null, right: null };
        if (room.round >= room.totalRounds) {
          room.status = "finished";
          if (leftPlayer && rightPlayer) {
            if (leftPlayer.score > rightPlayer.score) room.winnerSide = "left";
            else if (rightPlayer.score > leftPlayer.score) room.winnerSide = "right";
            else room.winnerSide = "tie";
          }
        } else {
          room.round += 1;
        }
      }
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur submit." }); }
    finally { if (pendingPlayer) pendingPlayer.allocationPending = false; }
  });

  socket.on("stat-auction:restart-match", (payload = {}, ack) => {
    try {
      const room = findStatAuctionRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut relancer." });
      if (room.status !== "finished") return respond(ack, { ok: false, error: "La partie n'est pas terminée." });
      room.players = room.players.filter((p) => p.connected);
      room.players.forEach((p, index) => { p.side = index === 0 ? "left" : "right"; });
      room.finishReason = null;
      room.status = "lobby";
      room.round = 0;
      room.sequence = null;
      room.currentAllocations = { left: null, right: null };
      room.history = [];
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.allocations = []; }
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur restart." }); }
  });
});

// === HIGHER OR LOWER — helpers serveur ===
const higherLowerRooms = new Map();
const HIGHER_LOWER_RUSH_MS_SERVER = 60000;
const HIGHER_LOWER_STAT_KEYS_SERVER = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];
const HIGHER_LOWER_SEQ_COUNT = 50;

function generateHigherLowerRoomCode() {
  let code;
  do { code = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (higherLowerRooms.has(code));
  return code;
}

function generateHigherLowerSequence(selectedGens) {
  const all = Array.isArray(POKEMON_LIST) ? POKEMON_LIST.filter((p) => Number(p.id) < 10000) : [];
  const filtered = (Array.isArray(selectedGens) && selectedGens.length)
    ? all.filter((p) => selectedGens.includes(Number(p.generation || p.gen)))
    : all.slice();
  if (filtered.length < 2) return null;
  const shuffled = filtered.slice().sort(() => Math.random() - 0.5);
  const seq = [];
  for (let i = 0; i < HIGHER_LOWER_SEQ_COUNT && i + 1 < shuffled.length; i++) {
    const stat = HIGHER_LOWER_STAT_KEYS_SERVER[Math.floor(Math.random() * HIGHER_LOWER_STAT_KEYS_SERVER.length)];
    seq.push({ leftId: shuffled[i].id, rightId: shuffled[i + 1].id, statKey: stat });
  }
  return seq;
}

function findHigherLowerRoomBySocket(socketId) {
  const code = io.sockets.sockets.get(socketId)?.data?.higherLowerRoomCode;
  if (code && higherLowerRooms.has(code)) return higherLowerRooms.get(code);
  for (const room of higherLowerRooms.values()) {
    if (room.players.some((p) => p.id === socketId)) return room;
  }
  return null;
}

function publicHigherLowerRoomState(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    maxPlayers: 2,
    connectedCount: room.players.filter((p) => p.connected).length,
    canStart: room.players.length === 2 && room.players.every((p) => p.connected),
    startedAt: room.startedAt || null,
    endsAt: room.endsAt || null,
    sequence: room.status === "live" || room.status === "finished" ? room.sequence : null,
    selectedGens: Array.isArray(room.selectedGens) ? room.selectedGens.slice() : [],
    players: room.players.map((p) => ({
      id: p.id,
      side: p.side,
      nickname: p.nickname,
      score: p.score,
      cursor: p.cursor,
      connected: p.connected,
      isHost: p.id === room.hostId,
      isSelf: p.id === viewerId,
    })),
    winnerSide: room.winnerSide || null,
    finishReason: room.finishReason || null,
  };
}

function emitHigherLowerRoomState(room) {
  for (const p of room.players) {
    if (!p.connected) continue;
    io.to(p.id).emit("higher-lower:room-state", publicHigherLowerRoomState(room, p.id));
  }
}

function finalizeHigherLowerMatch(room) {
  if (!room || room.status === "finished") return;
  room.status = "finished";
  if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
  const left = room.players.find((p) => p.side === "left");
  const right = room.players.find((p) => p.side === "right");
  if (left && right) {
    if (left.score > right.score) room.winnerSide = "left";
    else if (right.score > left.score) room.winnerSide = "right";
    else room.winnerSide = "tie";
  } else if (left || right) {
    room.winnerSide = (left || right).side;
  }
  emitHigherLowerRoomState(room);
}

function startHigherLowerMatchTimer(room) {
  if (room.endTimer) clearTimeout(room.endTimer);
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + HIGHER_LOWER_RUSH_MS_SERVER;
  room.endTimer = setTimeout(() => finalizeHigherLowerMatch(room), HIGHER_LOWER_RUSH_MS_SERVER);
}

function handleHigherLowerDisconnect(socketId, forceLeave) {
  for (const room of Array.from(higherLowerRooms.values())) {
    const player = room.players.find((p) => p.id === socketId && p.connected);
    if (!player) continue;
    player.connected = false;
    const sock = io.sockets.sockets.get(socketId);
    if (sock?.data) sock.data.higherLowerRoomCode = null;
    const remaining = room.players.find((p) => p.connected);
    if (!remaining) {
      if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
      higherLowerRooms.delete(room.code);
      continue;
    }
    if (room.status === "live") {
      if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
      room.status = "finished";
      room.winnerSide = remaining.side;
      room.finishReason = "disconnect";
    }
    if (room.hostId === socketId) room.hostId = remaining.id;
    // Preserve the sides and scores of a finished match. Empty lobby seats can be reused.
    if (room.status === "lobby") {
      room.players = room.players.filter((p) => p.connected);
      remaining.side = "left";
    }
    emitHigherLowerRoomState(room);
  }
}

// === STAT AUCTION — helpers serveur ===
const statAuctionRooms = new Map();
const STAT_AUCTION_STAT_KEYS = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];
const STAT_AUCTION_TOTAL_POINTS = 100;
const STAT_AUCTION_DEFAULT_ROUNDS = 5;
const STAT_AUCTION_RECONNECT_GRACE_MS = 30000;

function generateStatAuctionRoomCode() {
  let code;
  do { code = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (statAuctionRooms.has(code));
  return code;
}

function generateStatAuctionSequence(selectedGens, count) {
  const all = Array.isArray(POKEMON_LIST) ? POKEMON_LIST.filter((p) => Number(p.id) < 10000) : [];
  const filtered = (Array.isArray(selectedGens) && selectedGens.length)
    ? all.filter((p) => selectedGens.includes(Number(p.generation || p.gen)))
    : all.slice();
  if (filtered.length < count) return null;
  return filtered.slice().sort(() => Math.random() - 0.5).slice(0, count).map((p) => Number(p.id));
}

function sanitizeStatAuctionAllocation(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  let total = 0;
  for (const k of STAT_AUCTION_STAT_KEYS) {
    const v = Math.max(0, Math.min(STAT_AUCTION_TOTAL_POINTS, Math.round(Number(raw[k]) || 0)));
    out[k] = v;
    total += v;
  }
  if (total !== STAT_AUCTION_TOTAL_POINTS) return null;
  return out;
}

function findStatAuctionRoomBySocket(socketId) {
  const code = io.sockets.sockets.get(socketId)?.data?.statAuctionRoomCode;
  if (code && statAuctionRooms.has(code)) return statAuctionRooms.get(code);
  for (const room of statAuctionRooms.values()) {
    if (room.players.some((p) => p.id === socketId && p.connected)) return room;
  }
  return null;
}

function publicStatAuctionRoomState(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    totalRounds: room.totalRounds || STAT_AUCTION_DEFAULT_ROUNDS,
    maxPlayers: 2,
    connectedCount: room.players.filter((p) => p.connected).length,
    canStart: room.players.length === 2 && room.players.every((p) => p.connected),
    sequence: room.status === "live" || room.status === "finished" ? room.sequence : null,
    selectedGens: Array.isArray(room.selectedGens) ? room.selectedGens.slice() : [],
    history: Array.isArray(room.history) ? room.history.slice() : [],
    currentAllocations: {
      left: room.currentAllocations?.left ? { submitted: true } : null,
      right: room.currentAllocations?.right ? { submitted: true } : null,
    },
    players: room.players.map((p) => ({
      id: p.id,
      side: p.side,
      nickname: p.nickname,
      score: p.score,
      submittedThisRound: Boolean(room.currentAllocations?.[p.side]),
      connected: p.connected,
      isHost: p.id === room.hostId,
      isSelf: p.id === viewerId,
    })),
    winnerSide: room.winnerSide || null,
    finishReason: room.finishReason || null,
  };
}

function emitStatAuctionRoomState(room) {
  for (const p of room.players) {
    if (!p.connected) continue;
    io.to(p.id).emit("stat-auction:room-state", publicStatAuctionRoomState(room, p.id));
  }
}

function handleStatAuctionDisconnect(socketId, forceLeave) {
  for (const room of Array.from(statAuctionRooms.values())) {
    const player = room.players.find((p) => p.id === socketId);
    if (!player) continue;
    const sock = io.sockets.sockets.get(socketId);
    if (sock?.data) sock.data.statAuctionRoomCode = null;
    if (forceLeave && typeof sock?.leave === "function") sock.leave(room.code);

    const finalize = () => {
      if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
      player.reconnectUntil = null;
      const remaining = room.players.find((p) => p !== player && p.connected);
      if (!remaining) {
        statAuctionRooms.delete(room.code);
        return;
      }
      if (room.status === "live") {
        room.status = "finished";
        room.winnerSide = remaining.side;
        room.finishReason = "disconnect";
      }
      if (room.hostId === player.id) room.hostId = remaining.id;
      if (room.status === "lobby") {
        room.players = room.players.filter((p) => p !== player);
        remaining.side = "left";
      }
      emitStatAuctionRoomState(room);
    };

    player.connected = false;
    if (forceLeave) {
      finalize();
      continue;
    }
    player.disconnectedAt = Date.now();
    player.reconnectUntil = Date.now() + STAT_AUCTION_RECONNECT_GRACE_MS;
    emitStatAuctionRoomState(room);
    if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
    player.reconnectTimer = setTimeout(() => {
      player.reconnectTimer = null;
      if (!statAuctionRooms.has(room.code) || player.connected) return;
      finalize();
    }, STAT_AUCTION_RECONNECT_GRACE_MS);
  }
}

server.listen(PORT, () => {
  console.log(`Pokédle multiplayer server running on port ${PORT}`);
  if (!ALLOWED_ORIGINS.length) {
    // Lot D audit : en production, on refuse de démarrer sans ALLOWED_ORIGINS
    // (sinon le CORS Socket.io serait ouvert à toutes les origines).
    const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true" || Boolean(process.env.RENDER_EXTERNAL_URL);
    if (isProduction) {
      console.error("[security] ALLOWED_ORIGINS doit être défini en production (ex: https://pokdle.fr). Arrêt.");
      process.exit(1);
    }
    console.warn("[security] ALLOWED_ORIGINS not set — CORS is open to all origins. Set ALLOWED_ORIGINS in production.");
  }
});

// === Cache stats Pokémon serveur (sécurité 1v1) ===
const POKEMON_STATS_SERVER_CACHE = new Map();
const POKEAPI_STAT_KEY_MAP = {
  "hp": "hp",
  "attack": "attack",
  "defense": "defense",
  "special-attack": "spAttack",
  "special-defense": "spDefense",
  "speed": "speed",
};

function getDraftScorePokemonApiId(pokemonOrId) {
  if (pokemonOrId && typeof pokemonOrId === "object") {
    const explicit = pokemonOrId.apiId || pokemonOrId.formApiName;
    const baseId = Number(pokemonOrId.baseId);
    if (explicit && !(pokemonOrId.isAltForm && Number.isInteger(baseId) && String(explicit) === String(baseId))) {
      return String(explicit);
    }
    const spriteId = Number(pokemonOrId.spriteId);
    if (Number.isInteger(spriteId) && spriteId > 0) return String(spriteId);
    const id = Number(pokemonOrId.id);
    if (Number.isInteger(id) && id > 0 && id <= 1025) return String(id);
    if (Number.isInteger(baseId) && baseId > 0) return String(baseId);
    return null;
  }
  const id = Number(pokemonOrId);
  return Number.isInteger(id) && id > 0 ? String(id) : null;
}

function normalizeDraftScoreClientBst(value) {
  const bst = Math.round(Number(value) || 0);
  return bst >= 180 && bst <= 1200 ? bst : 0;
}

async function fetchPokemonStatsServer(pokemonOrId) {
  const apiId = getDraftScorePokemonApiId(pokemonOrId);
  if (!apiId) return null;
  if (POKEMON_STATS_SERVER_CACHE.has(apiId)) return POKEMON_STATS_SERVER_CACHE.get(apiId);
  if (typeof fetch !== "function") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(apiId)}`, { signal: controller.signal, headers: { "User-Agent": "pokdle-server/1.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    const statsRaw = Array.isArray(data?.stats) ? data.stats : [];
    const stats = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
    for (const s of statsRaw) {
      const key = POKEAPI_STAT_KEY_MAP[s?.stat?.name];
      const value = Number(s?.base_stat) || 0;
      if (key) stats[key] = value;
    }
    POKEMON_STATS_SERVER_CACHE.set(apiId, stats);
    return stats;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getDraftScoreFallbackStatTotal(pokemon) {
  const stage = Number(pokemon?.stage) || 1;
  const weightScore = Math.min(48, Math.round((Number(pokemon?.weight) || 0) / 4));
  const heightScore = Math.min(24, Math.round((Number(pokemon?.height) || 0) * 8));
  const dualTypeBonus = pokemon?.type2 ? 34 : 0;
  const habitatBonus = pokemon?.habitat === "Rare" ? 48 : 0;
  return Math.max(240, Math.min(680, 255 + stage * 52 + weightScore + heightScore + dualTypeBonus + habitatBonus));
}

async function getDraftScoreServerBst(pokemonId, clientBst = 0) {
  const pokemon = POKEMON_LIST.find((entry) => Number(entry.id) === Number(pokemonId));
  if (!pokemon) return 0;
  const stats = await fetchPokemonStatsServer(pokemon);
  if (stats) {
    const values = [stats.hp, stats.attack, stats.defense, stats.spAttack, stats.spDefense, stats.speed];
    const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (total > 0) return total;
  }
  const clientTotal = normalizeDraftScoreClientBst(clientBst);
  if (clientTotal) return clientTotal;
  return getDraftScoreFallbackStatTotal(pokemon);
}

function getDraftScoreServerLabel(average) {
  if (average >= 600) return "Master 600+";
  if (average >= 550) return "Elite 550+";
  if (average >= 500) return "Solide 500+";
  return "Run à améliorer";
}

function respond(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function loadPokemonList() {
  const filePath = path.join(__dirname, "pokemon.js");
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error("POKEMON_LIST introuvable dans pokemon.js");
  const list = JSON.parse(match[1]);
  injectStatClashExtraForms(list);
  return list;
}

function loadStatClashExtraFormsConfig() {
  const filePath = path.join(__dirname, "script.js");
  const raw = fs.readFileSync(filePath, "utf8");
  const extraMatch = raw.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/);
  const apiMapMatch = raw.match(/const FORM_API_NAME_BY_NAME =\s*({[\s\S]*?});/);
  if (!extraMatch || !apiMapMatch) return { extraForms: [], apiNamesByName: {} };

  const context = {};
  vm.createContext(context);
  vm.runInContext(`extraForms = ${extraMatch[1]}; apiNamesByName = ${apiMapMatch[1]};`, context);
  return {
    extraForms: Array.isArray(context.extraForms) ? context.extraForms : [],
    apiNamesByName: context.apiNamesByName && typeof context.apiNamesByName === "object" ? context.apiNamesByName : {},
  };
}

function buildSpriteUrl(spriteId) {
  return `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${spriteId}.png`;
}

function injectStatClashExtraForms(list) {
  const { extraForms, apiNamesByName } = loadStatClashExtraFormsConfig();
  const byId = new Set(list.map((pokemon) => pokemon.id));
  const byName = new Set(list.map((pokemon) => pokemon.name));
  const baseById = new Map(list.map((pokemon) => [pokemon.id, pokemon]));
  // Same measured data as the client (forms-data.json): without it every form
  // took its species' size, weight and sprite in server-side comparisons.
  let measured = {};
  try {
    const raw = fs.readFileSync(path.join(__dirname, "forms-data.json"), "utf8").replace(/^\uFEFF/, "");
    measured = Object.fromEntries(Object.entries(JSON.parse(raw)).map(([name, value]) => [name.replace(/^(.+) Mega( [XY])?$/, "Méga-$1$2"), value]));
  } catch (_error) { measured = {}; }

  for (const form of extraForms) {
    if (!form || byId.has(form.id) || byName.has(form.name)) continue;
    const base = baseById.get(form.baseId);
    if (!base) continue;
    const data = measured[form.name] || {};

    const spriteId = form.spriteId || base.spriteId || base.id;
    const gen = Number(form.gen) || Number(base.gen) || Number(base.generation) || 1;
    const apiId = apiNamesByName?.[form.name] || String(form.baseId || base.id);

    list.push({
      ...base,
      id: form.id,
      name: form.name,
      type1: data.type1 || form.type1 || base.type1,
      type2: data.type2 !== undefined ? data.type2 : (form.type2 !== undefined ? form.type2 : (base.type2 || null)),
      gen,
      generation: gen,
      color: form.color || base.color,
      habitat: form.habitat || base.habitat,
      stage: Number.isInteger(form.stage) ? form.stage : base.stage,
      height: typeof data.height === "number" ? data.height : (typeof form.height === "number" ? form.height : base.height),
      // An explicit null (Gigamax forms) means an unknown weight, not the species' one.
      weight: typeof data.weight === "number" ? data.weight : (typeof form.weight === "number" || form.weight === null ? form.weight : base.weight),
      spriteId,
      sprite: data.sprite || form.sprite || (form.spriteId ? buildSpriteUrl(form.spriteId) : base.sprite || buildSpriteUrl(spriteId)),
      isAltForm: true,
      ...(form.guessable === false ? { guessable: false } : {}),
      baseId: form.baseId,
      apiId,
    });
    byId.add(form.id);
    byName.add(form.name);
  }
}

function sanitizeNickname(value) {
  const text = String(value || "").trim().slice(0, 24);
  return text.replace(/[<>"'`\\\n\r\t\x00-\x1f]/g, "");
}

function sanitizeRoomCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeSelectedGens(input) {
  const source = Array.isArray(input) ? input : [];
  const out = Array.from(new Set(source.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 9)));
  return out.length ? out : [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function generateStatClashRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = `SC${Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
  } while (statClashRooms.has(code));
  return code;
}

function generateDraftScoreRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = `DS${Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
  } while (draftScoreRooms.has(code));
  return code;
}

function normalizeStatClashStatKey(value) {
  const key = String(value || "").trim();
  return STAT_CLASH_STAT_KEYS.includes(key) ? key : null;
}

async function fetchStatClashPokemonStats(pokemonId) {
  const apiId = typeof pokemonId === "string" && pokemonId.trim()
    ? pokemonId.trim()
    : Number(pokemonId);
  if ((!Number.isInteger(apiId) || apiId <= 0) && typeof apiId !== "string") return null;
  if (STAT_CLASH_STATS_CACHE.has(apiId)) return STAT_CLASH_STATS_CACHE.get(apiId);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiId}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json();
    const statsMap = new Map((data?.stats || []).map((entry) => [entry.stat?.name, Number(entry.base_stat) || 0]));
    const parsed = {
      hp: statsMap.get("hp") || 0,
      attack: statsMap.get("attack") || 0,
      defense: statsMap.get("defense") || 0,
      spAttack: statsMap.get("special-attack") || 0,
      spDefense: statsMap.get("special-defense") || 0,
      speed: statsMap.get("speed") || 0,
    };
    if (STAT_CLASH_STATS_CACHE.size >= STAT_CLASH_STATS_CACHE_MAX) {
      const oldest = STAT_CLASH_STATS_CACHE.keys().next().value;
      STAT_CLASH_STATS_CACHE.delete(oldest);
    }
    STAT_CLASH_STATS_CACHE.set(apiId, parsed);
    return parsed;
  } catch (_error) {
    return null;
  }
}

function resetStatClashRoomForNewMatch(room) {
  clearStatClashCleanup(room);
  clearStatClashRoomTimers(room);
  room.status = "lobby";
  room.roundPhase = "waiting";
  room.round = 0;
  room.usedStatKeysBySide = { left: [], right: [] };
  room.usedPokemonIds = [];
  room.currentPokemon = null;
  room.currentStats = null;
  room.reveal = null;
  room.deadlineAt = null;
  room.rollEndsAt = null;
  room.lockedEndsAt = null;
  room.startedAt = null;
  room.winnerId = null;
  room.endedReason = null;
  for (const player of room.players) {
    player.score = 0;
    player.history = [];
    player.pendingPickKey = null;
    player.pendingSubmittedAt = null;
  }
  room.houseRule = null;
  room.houseRuleBySide = { left: null, right: null };
  room.houseRuleShared = null;
  room.doubleStatKey = null;
  room.mirrorStatKey = null;
  room.blindRound5OptionsBySide = { left: null, right: null };
  room.streakBySide = { left: 0, right: 0 };
  room.roundsWonBySide = { left: 0, right: 0 };
  room.jokersBySide = buildStatClashRoomJokers();
  room.suddenDeath = false;
  clearStatClashPreviewTimers(room);
}

function getConnectedStatClashPlayers(room) {
  return room.players.filter((player) => player.connected);
}

function canStatClashRoomStart(room) {
  const connected = getConnectedStatClashPlayers(room);
  if (connected.length < (room.maxPlayers || STAT_CLASH_MAX_PLAYERS)) return false;
  if (room.houseRuleEnabled === false) return true;
  const pending = room.pendingImposedRuleBySide || {};
  return connected.every((player) => STAT_CLASH_IMPOSABLE_RULE_IDS.has(pending[player.side]));
}

function getStatClashPoolForRoom(room) {
  const unused = POKEMON_LIST.filter((pokemon) => !room.usedPokemonIds.includes(Number(pokemon.id)));
  return unused.length ? unused : POKEMON_LIST;
}

async function startStatClashMatch(room) {
  room.notice = null;
  resetStatClashRoomForNewMatch(room);
  const fmt = STAT_CLASH_FORMATS[normalizeStatClashFormat(room.format)] || STAT_CLASH_FORMATS.standard;
  room.totalRounds = fmt.rounds;
  room.suddenDeath = Boolean(fmt.suddenDeath);
  if (room.houseRuleEnabled !== false) {
    const pending = room.pendingImposedRuleBySide || {};
    room.houseRuleBySide = { left: null, right: null };
    for (const player of room.players) {
      const targetSide = getOppositeStatClashSide(player.side);
      const rule = getStatClashRuleById(pending[player.side]);
      if (targetSide && rule && STAT_CLASH_IMPOSABLE_RULE_IDS.has(rule.id)) room.houseRuleBySide[targetSide] = rule;
    }
    room.houseRuleShared = room.houseRuleSharedEnabled ? getRandomStatClashRuleFromSet(STAT_CLASH_SHARED_RULE_IDS) : null;
    room.houseRule = room.houseRuleShared;
    room.houseRuleTargetSide = null;
    if (room.houseRuleShared?.id === "doubleStat") {
      room.doubleStatKey = STAT_CLASH_STAT_KEYS[Math.floor(Math.random() * STAT_CLASH_STAT_KEYS.length)];
    }
  } else {
    room.houseRule = null;
    room.houseRuleBySide = { left: null, right: null };
    room.houseRuleShared = null;
    room.houseRuleTargetSide = null;
  }
  room.jokersBySide = buildStatClashRoomJokers();
  room.streakBySide = { left: 0, right: 0 };
  room.roundsWonBySide = { left: 0, right: 0 };
  room.status = "live";
  room.round = 1;
  await startStatClashRound(room);
}

async function startStatClashRound(room) {
  clearStatClashCleanup(room);
  clearStatClashRoomTimers(room);
  clearStatClashPreviewTimers(room);
  if (room.jokersBySide && room.jokersBySide.left) room.jokersBySide.left.doubleArmed = false;
  if (room.jokersBySide && room.jokersBySide.right) room.jokersBySide.right.doubleArmed = false;
  const pool = getStatClashPoolForRoom(room);
  const pokemon = pool[Math.floor(Math.random() * pool.length)] || null;
  room.currentPokemon = pokemon;
  room.currentStats = pokemon ? await fetchStatClashPokemonStats(pokemon.apiId || pokemon.id) : null;
  room.currentPokemon && room.usedPokemonIds.push(Number(room.currentPokemon.id));
  room.reveal = null;
  room.roundPhase = "rolling";
  room.rollEndsAt = Date.now() + STAT_CLASH_ROLL_MS;
  room.lockedEndsAt = null;
  room.deadlineAt = null;
  for (const player of room.players) {
    player.pendingPickKey = null;
    player.pendingSubmittedAt = null;
  }
  if (room.jokersBySide && room.jokersBySide.left) { room.jokersBySide.left.previewKey = null; room.jokersBySide.left.previewExpiresAt = null; }
  if (room.jokersBySide && room.jokersBySide.right) { room.jokersBySide.right.previewKey = null; room.jokersBySide.right.previewExpiresAt = null; }
  if (room.houseRuleEnabled && (room.houseRuleShared || room.houseRule)?.id === "mirrorRound4" && room.round === 4) {
    const cand = STAT_CLASH_STAT_KEYS.filter((k) => !room.usedStatKeysBySide.left.includes(k) && !room.usedStatKeysBySide.right.includes(k));
    room.mirrorStatKey = cand[Math.floor(Math.random() * cand.length)] || STAT_CLASH_STAT_KEYS[0];
  } else {
    room.mirrorStatKey = null;
  }
  // Pre-tirage : pour chaque side subissant blindRound5 a M5, choisir 2 stats non utilisees parmi lesquelles le joueur devra choisir
  room.blindRound5OptionsBySide = { left: null, right: null };
  if (room.houseRuleEnabled && room.round === 5 && room.houseRuleBySide) {
    for (const player of room.players) {
      if (room.houseRuleBySide?.[player.side]?.id !== "blindRound5") continue;
      const used = new Set((room.usedStatKeysBySide && room.usedStatKeysBySide[player.side]) || []);
      const remaining = STAT_CLASH_STAT_KEYS.filter((k) => !used.has(k));
      const pool = remaining.length ? remaining : STAT_CLASH_STAT_KEYS.slice();
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      room.blindRound5OptionsBySide[player.side] = shuffled.slice(0, Math.min(2, shuffled.length));
    }
  }
  emitStatClashRoomState(room);
  room.rollTimer = setTimeout(() => {
    const legacyBlindRound = !room.houseRuleBySide && room.houseRule?.id === "blindRound5";
    if (room.houseRuleEnabled && room.round === 5 && (legacyBlindRound || room.players.every((player) => room.houseRuleBySide?.[player.side]?.id === "blindRound5"))) {
      room.roundPhase = "picking";
      room.rollEndsAt = null;
      room.deadlineAt = Date.now() + 800;
      for (const player of room.players) {
        const allowed = getStatClashAllowedStatsRoom(room, player.side);
        const candidates = allowed.length ? allowed : STAT_CLASH_STAT_KEYS;
        player.pendingPickKey = candidates[Math.floor(Math.random() * candidates.length)];
        player.pendingSubmittedAt = Date.now();
      }
      room.roundPhase = "locked";
      room.lockedEndsAt = Date.now() + STAT_CLASH_LOCKED_REVEAL_MS;
      emitStatClashRoomState(room);
      room.resolveTimer = setTimeout(() => resolveStatClashRound(room), STAT_CLASH_LOCKED_REVEAL_MS);
      return;
    }
    const pickMs = getStatClashHouseRuleTimerMsRoom(room);
    room.roundPhase = "picking";
    room.rollEndsAt = null;
    room.deadlineAt = Date.now() + pickMs;
    emitStatClashRoomState(room);
    room.resolveTimer = setTimeout(() => resolveStatClashRound(room), pickMs);
  }, STAT_CLASH_ROLL_MS);
}

function pickBestRemainingStatKey(usedKeys, stats) {
  const available = STAT_CLASH_STAT_KEYS.filter((key) => !usedKeys.has(key));
  if (!available.length) return null;
  return available.sort((left, right) => (Number(stats?.[right]) || 0) - (Number(stats?.[left]) || 0))[0];
}

function resolveStatClashAssignedPicks(room) {
  return room.players.map((player) => {
    const used = new Set(room.usedStatKeysBySide?.[player.side] || []);
    let finalKey = player.pendingPickKey && !used.has(player.pendingPickKey) ? player.pendingPickKey : null;
    let auto = false;
    if (!finalKey) {
      finalKey = pickBestRemainingStatKey(used, room.currentStats);
      auto = true;
    }
    if (!finalKey) return { player, key: null, value: 0, auto: true };
    return {
      player,
      key: finalKey,
      value: Number(room.currentStats?.[finalKey]) || 0,
      auto: auto || finalKey !== player.pendingPickKey,
    };
  });
}

function finalizeStatClashMatch(room) {
  room.status = "finished";
  room.roundPhase = "finished";
  const [leftPlayer, rightPlayer] = room.players;
  if (!leftPlayer || !rightPlayer) {
    room.winnerId = null;
  } else if (leftPlayer.score === rightPlayer.score) {
    const wL = Number(room.roundsWonBySide && room.roundsWonBySide.left) || 0;
    const wR = Number(room.roundsWonBySide && room.roundsWonBySide.right) || 0;
    if (wL > wR) room.winnerId = leftPlayer.id;
    else if (wR > wL) room.winnerId = rightPlayer.id;
    else room.winnerId = null;
  } else {
    room.winnerId = leftPlayer.score > rightPlayer.score ? leftPlayer.id : rightPlayer.id;
  }
  if (room.winnerId && leftPlayer && rightPlayer) {
    const winnerSide = room.winnerId === leftPlayer.id ? "left" : "right";
    room.matchWinsBySide[winnerSide] = (Number(room.matchWinsBySide?.[winnerSide]) || 0) + 1;
  }
  const scoreGap = Math.abs((Number(leftPlayer?.score) || 0) - (Number(rightPlayer?.score) || 0));
  if (scoreGap > (Number(room.sessionRecord?.score) || 0)) {
    const winner = !leftPlayer || !rightPlayer || leftPlayer.score === rightPlayer.score
      ? null
      : leftPlayer.score > rightPlayer.score
        ? leftPlayer
        : rightPlayer;
    const loser = winner?.id === leftPlayer?.id ? rightPlayer : leftPlayer;
    if (winner && loser) {
      room.sessionRecord = {
        score: scoreGap,
        winner: winner.nickname || "Joueur 1",
        loser: loser.nickname || "Joueur 2",
      };
    }
  }
  room.endedReason = "completed";
  emitStatClashRoomState(room);
  emitStatClashFinished(room);
}

async function resolveStatClashRound(room) {
  if (!room || room.status !== "live" || !["picking", "rolling", "locked"].includes(room.roundPhase)) return;
  clearStatClashRoomTimers(room);
  clearStatClashPreviewTimers(room);
  room.lockedEndsAt = null;
  if (!room.currentPokemon || !room.currentStats) {
    room.status = "lobby";
    room.roundPhase = "waiting";
    room.deadlineAt = null;
    room.notice = "Statistiques indisponibles : partie interrompue sans résultat. L'hôte peut réessayer.";
    emitStatClashRoomState(room);
    return;
  }

  const resolved = resolveStatClashAssignedPicks(room);
  const leftEntry = resolved.find((e) => e.player.side === "left");
  const rightEntry = resolved.find((e) => e.player.side === "right");
  const baseLeft = Number(leftEntry && leftEntry.value) || 0;
  const baseRight = Number(rightEntry && rightEntry.value) || 0;
  const leftWins = baseLeft > baseRight;
  const rightWins = baseRight > baseLeft;
  let adjLeft = applyStatClashDoubleStatRoom(room, leftEntry && leftEntry.key, baseLeft);
  let adjRight = applyStatClashDoubleStatRoom(room, rightEntry && rightEntry.key, baseRight);
  if (room.jokersBySide && room.jokersBySide.left && room.jokersBySide.left.doubleArmed) {
    adjLeft = leftWins ? adjLeft * 2 : 0;
    room.jokersBySide.left.doubleArmed = false;
  }
  if (room.jokersBySide && room.jokersBySide.right && room.jokersBySide.right.doubleArmed) {
    adjRight = rightWins ? adjRight * 2 : 0;
    room.jokersBySide.right.doubleArmed = false;
  }
  if (leftWins) { room.streakBySide.left += 1; room.streakBySide.right = 0; room.roundsWonBySide.left += 1; }
  else if (rightWins) { room.streakBySide.right += 1; room.streakBySide.left = 0; room.roundsWonBySide.right += 1; }
  else { room.streakBySide.left = 0; room.streakBySide.right = 0; }
  const comboBonusBySide = { left: 0, right: 0 };
  if (room.houseRuleEnabled && (room.houseRuleShared || room.houseRule)?.id === "comboBonus") {
    if (room.streakBySide.left === 3) { adjLeft += 2; comboBonusBySide.left = 2; }
    if (room.streakBySide.right === 3) { adjRight += 2; comboBonusBySide.right = 2; }
  }
  // Bonus comeback aveugle : +3 pts si tu gagnes la manche en subissant blindRound5
  const comebackBonusBySide = { left: 0, right: 0 };
  if (room.houseRuleEnabled) {
    if (leftWins && Array.isArray(room.blindRound5OptionsBySide?.left) && room.blindRound5OptionsBySide.left.length) { adjLeft += 3; comebackBonusBySide.left = 3; }
    if (rightWins && Array.isArray(room.blindRound5OptionsBySide?.right) && room.blindRound5OptionsBySide.right.length) { adjRight += 3; comebackBonusBySide.right = 3; }
  }

  room.reveal = {};
  for (const entry of resolved) {
    if (!entry.key) continue;
    const adj = entry.player.side === "left" ? adjLeft : adjRight;
    const comboBonus = comboBonusBySide[entry.player.side] || 0;
    const comebackBonus = comebackBonusBySide[entry.player.side] || 0;
    if (!room.suddenDeath) room.usedStatKeysBySide[entry.player.side].push(entry.key);
    entry.player.score += adj;
    entry.player.history.push({
      round: room.round,
      statKey: entry.key,
      statLabel: STAT_CLASH_STAT_LABELS[entry.key] || entry.key,
      value: adj,
      pokemonName: room.currentPokemon.name,
      auto: entry.auto,
      comboBonus,
      comebackBonus,
    });
    room.reveal[entry.player.side] = {
      statKey: entry.key,
      statLabel: STAT_CLASH_STAT_LABELS[entry.key] || entry.key,
      value: adj,
      auto: entry.auto,
      comboBonus,
      comebackBonus,
    };
    entry.player.pendingPickKey = null;
    entry.player.pendingSubmittedAt = null;
  }
  if (room.jokersBySide && room.jokersBySide.left) { room.jokersBySide.left.previewKey = null; room.jokersBySide.left.previewExpiresAt = null; }
  if (room.jokersBySide && room.jokersBySide.right) { room.jokersBySide.right.previewKey = null; room.jokersBySide.right.previewExpiresAt = null; }

  room.roundPhase = "reveal";
  emitStatClashRoomState(room);

  if (room.suddenDeath && (leftWins || rightWins)) {
    room.nextRoundTimer = setTimeout(() => finalizeStatClashMatch(room), STAT_CLASH_REVEAL_MS);
    return;
  }
  room.nextRoundTimer = setTimeout(async () => {
    const leftDone = !room.suddenDeath && (room.usedStatKeysBySide.left || []).length >= STAT_CLASH_STAT_KEYS.length;
    const rightDone = !room.suddenDeath && (room.usedStatKeysBySide.right || []).length >= STAT_CLASH_STAT_KEYS.length;
    if (room.round >= room.totalRounds || leftDone || rightDone) {
      finalizeStatClashMatch(room);
      return;
    }
    room.round += 1;
    await startStatClashRound(room);
  }, STAT_CLASH_REVEAL_MS);
}

function joinPlayerToRoom(room, socket, nickname) {
  socket.join(room.code);
  socket.data.roomCode = room.code;
  const player = {
    id: socket.id,
    nickname,
    connected: true,
    attempts: 0,
    lastGuess: "",
    correct: false,
    guesses: [],
    reconnectToken: crypto.randomBytes(18).toString("hex"),
    reconnectUntil: null,
    reconnectTimer: null,
  };
  room.players.push(player);
  return player;
}

function joinPlayerToStatClashRoom(room, socket, nickname, side) {
  socket.join(room.code);
  socket.data.statClashRoomCode = room.code;
  const assignedSide = side || STAT_CLASH_PLAYER_SEATS.find((seat) => !room.players.some((player) => player.side === seat)) || `seat${room.players.length + 1}`;
  const player = {
    id: socket.id,
    nickname,
    side: assignedSide,
    seatIndex: room.players.length,
    connected: true,
    score: 0,
    history: [],
    pendingPickKey: null,
    pendingSubmittedAt: null,
    reconnectToken: crypto.randomBytes(18).toString("hex"),
    reconnectUntil: null,
    reconnectTimer: null,
  };
  room.players.push(player);
  return player;
}

function startRoom(room) {
  clearRoomCleanup(room);
  const pool = POKEMON_LIST.filter((pokemon) => isDuelPokemonAllowed(room, pokemon));
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.secretPokemon = pool[Math.floor(Math.random() * pool.length)] || null;
  room.status = room.secretPokemon ? "live" : "waiting";
}

function resetRoomForNewRound(room) {
  clearRoomCleanup(room);
  room.secretPokemon = null;
  room.status = "waiting";
  room.winnerId = null;
  room.endedReason = null;
  for (const player of room.players) {
    player.attempts = 0;
    player.lastGuess = "";
    player.correct = false;
    player.guesses = [];
  }
}

function publicRoomState(room, viewerId = null) {
  const players = room.players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    connected: player.connected,
    attempts: player.attempts,
    lastGuess: player.id === viewerId ? player.lastGuess : null,
    proximity: bestDuelProximity(player),
    correct: player.correct,
    isSelf: player.id === viewerId,
    isHost: player.id === room.hostId,
    guessHistory: player.id === viewerId ? player.guesses : [],
    guessNames: player.id === viewerId ? player.guesses.map((entry) => entry.name) : [],
  }));
  return {
    code: room.code,
    status: room.status,
    roundSerial: room.roundSerial,
    hostId: room.hostId,
    selectedGens: room.selectedGens,
    players,
    winnerId: room.winnerId,
    endedReason: room.endedReason,
    targetRevealed: room.status === "finished" ? serializePokemon(room.secretPokemon) : null,
  };
}

function publicStatClashRoomState(room, viewerId = null) {
  const connectedCount = getConnectedStatClashPlayers(room).length;
  return {
    code: room.code,
    status: room.status,
    roundPhase: room.roundPhase,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers || STAT_CLASH_MAX_PLAYERS,
    connectedCount,
    canStart: canStatClashRoomStart(room) && room.status !== "live" && room.status !== "starting",
    startedAt: room.startedAt || null,
    rollEndsAt: room.rollEndsAt || null,
    lockedEndsAt: room.lockedEndsAt || null,
    selectedGens: room.selectedGens,
    round: room.round,
    totalRounds: room.totalRounds,
    matchWinsBySide: {
      left: Number(room.matchWinsBySide?.left) || 0,
      right: Number(room.matchWinsBySide?.right) || 0,
    },
    sessionRecord: {
      score: Number(room.sessionRecord?.score) || STAT_CLASH_SESSION_RECORD_DEFAULT.score,
      winner: room.sessionRecord?.winner || STAT_CLASH_SESSION_RECORD_DEFAULT.winner,
      loser: room.sessionRecord?.loser || STAT_CLASH_SESSION_RECORD_DEFAULT.loser,
    },
    usedStatKeysBySide: {
      left: (room.usedStatKeysBySide?.left || []).slice(),
      right: (room.usedStatKeysBySide?.right || []).slice(),
    },
    deadlineAt: room.deadlineAt,
    winnerId: room.winnerId,
    endedReason: room.endedReason,
    notice: room.notice || null,
    currentPokemon: serializePokemon(room.currentPokemon),
    reveal: room.reveal,
    revealStats: room.roundPhase === "reveal" || room.status === "finished" ? room.currentStats : null,
    format: room.format || "standard",
    houseRuleEnabled: room.houseRuleEnabled !== false,
    houseRule: room.houseRule || null,
    houseRuleBySide: {
      left: room.houseRuleBySide?.left || null,
      right: room.houseRuleBySide?.right || null,
    },
    houseRuleShared: room.houseRuleShared || null,
    houseRuleSharedEnabled: Boolean(room.houseRuleSharedEnabled),
    pendingImposedRuleBySide: {
      left: room.pendingImposedRuleBySide?.left || null,
      right: room.pendingImposedRuleBySide?.right || null,
    },
    doubleStatKey: room.doubleStatKey || null,
    mirrorStatKey: room.mirrorStatKey || null,
    blindRound5OptionsBySide: {
      left: Array.isArray(room.blindRound5OptionsBySide?.left) ? room.blindRound5OptionsBySide.left.slice() : null,
      right: Array.isArray(room.blindRound5OptionsBySide?.right) ? room.blindRound5OptionsBySide.right.slice() : null,
    },
    houseRuleTargetSide: room.houseRuleTargetSide || null,
    suddenDeath: Boolean(room.suddenDeath),
    streakBySide: { left: Number(room.streakBySide && room.streakBySide.left) || 0, right: Number(room.streakBySide && room.streakBySide.right) || 0 },
    roundsWonBySide: { left: Number(room.roundsWonBySide && room.roundsWonBySide.left) || 0, right: Number(room.roundsWonBySide && room.roundsWonBySide.right) || 0 },
    jokersBySide: (function () {
      const viewerSide = (room.players.find((p) => p.id === viewerId) || {}).side || null;
      const sj = (side) => {
        const j = (room.jokersBySide && room.jokersBySide[side]) || {};
        return {
          reroll: Number(j.reroll) || 0,
          preview: Number(j.preview) || 0,
          double: Number(j.double) || 0,
          doubleArmed: Boolean(j.doubleArmed),
          previewKey: viewerSide === side ? (j.previewKey || null) : null,
          previewExpiresAt: viewerSide === side ? (j.previewExpiresAt || null) : null,
        };
      };
      return { left: sj("left"), right: sj("right") };
    })(),
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      side: player.side,
      seatIndex: Number(player.seatIndex) || 0,
      connected: player.connected,
      score: player.score,
      history: player.history,
      isSelf: player.id === viewerId,
      isHost: player.id === room.hostId,
      pendingImposedRuleId: room.pendingImposedRuleBySide?.[player.side] || null,
      hasSelectedImposedRule: Boolean(room.pendingImposedRuleBySide?.[player.side]),
      hasLockedPick: Boolean(player.pendingPickKey),
      pendingPickKey: player.id === viewerId && ["picking", "locked"].includes(room.roundPhase) ? player.pendingPickKey : null,
    })),
  };
}

function emitRoomState(room) {
  for (const player of room.players) {
    if (!player.connected) continue;
    io.to(player.id).emit("duel:room-state", publicRoomState(room, player.id));
  }
}

function emitStatClashRoomState(room) {
  console.log("[stat-clash][room-state] emit", { code: maskCode(room.code), status: room.status, roundPhase: room.roundPhase });
  for (const player of room.players) {
    io.to(player.id).emit("stat-clash:room-state", publicStatClashRoomState(room, player.id));
  }
}

function emitStatClashFinished(room) {
  for (const player of room.players) {
    io.to(player.id).emit("stat-clash:finished", publicStatClashRoomState(room, player.id));
  }
}

function emitRoomFinished(room) {
  for (const player of room.players) {
    if (!player.connected) continue;
    io.to(player.id).emit("duel:finished", publicRoomState(room, player.id));
  }
}

function findRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.roomCode;
  if (roomCode && rooms.has(roomCode)) return rooms.get(roomCode);
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.id === socketId && player.connected)) return room;
  }
  return null;
}

function findStatClashRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.statClashRoomCode;
  if (roomCode && statClashRooms.has(roomCode)) return statClashRooms.get(roomCode);
  for (const room of statClashRooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

function handleDisconnect(socketId, voluntary) {
  const room = findRoomBySocket(socketId);
  if (!room) return;

  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;

  const leavingSocket = io.sockets.sockets.get(socketId);
  if (leavingSocket) {
    leavingSocket.leave(room.code);
    leavingSocket.data.roomCode = null;
  }

  const finalizeWaitingDeparture = () => {
    if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
    player.reconnectUntil = null;
    const wasHost = room.hostId === player.id;
    room.players = room.players.filter((entry) => entry !== player);
    if (!room.players.length) {
      rooms.delete(room.code);
      return;
    }
    if (wasHost) {
      const next = room.players.find((entry) => entry.connected) || room.players[0];
      room.hostId = next.id;
    }
    emitRoomState(room);
  };

  const finalizeLiveDeparture = () => {
    if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
    player.reconnectUntil = null;
    if (!rooms.has(room.code) || room.status !== "live") return;
    const opponent = room.players.find((entry) => entry !== player && entry.connected);
    room.status = "finished";
    room.winnerId = opponent?.id || null;
    room.endedReason = "disconnect";
    emitRoomState(room);
    emitRoomFinished(room);
    scheduleRoomCleanup(room);
  };

  if (voluntary) {
    player.connected = false;
    if (room.status === "waiting") {
      finalizeWaitingDeparture();
      return;
    }
    if (room.status === "live") {
      finalizeLiveDeparture();
      return;
    }
    if (room.status === "finished") scheduleRoomCleanup(room);
    return;
  }

  player.connected = false;
  player.disconnectedAt = Date.now();
  player.reconnectUntil = Date.now() + DUEL_RECONNECT_GRACE_MS;
  io.to(room.code).emit("duel:opponent-connection", {
    nickname: player.nickname,
    connected: false,
    graceMs: DUEL_RECONNECT_GRACE_MS,
  });
  emitRoomState(room);
  if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
  player.reconnectTimer = setTimeout(() => {
    player.reconnectTimer = null;
    if (!rooms.has(room.code) || player.connected) return;
    if (room.status === "waiting") finalizeWaitingDeparture();
    else if (room.status === "live") finalizeLiveDeparture();
    else if (room.status === "finished") scheduleRoomCleanup(room);
  }, DUEL_RECONNECT_GRACE_MS);
}

function handleStatClashDisconnect(socketId, voluntary) {
  const room = findStatClashRoomBySocket(socketId);
  if (!room) return;

  const socket = io.sockets.sockets.get(socketId);
  if (socket?.data) socket.data.statClashRoomCode = null;
  if (voluntary && typeof socket?.leave === "function") socket.leave(room.code);
  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;

  const finalize = () => {
    if (player.reconnectTimer) { clearTimeout(player.reconnectTimer); player.reconnectTimer = null; }
    player.reconnectUntil = null;
    clearStatClashRoomTimers(room);

    if (room.status === "lobby" || room.status === "starting") {
      const wasHost = room.hostId === player.id;
      const departedSide = player.side;
      room.players = room.players.filter((entry) => entry !== player);
      if (!room.players.length) {
        statClashRooms.delete(room.code);
        return;
      }
      if (room.pendingImposedRuleBySide && departedSide) room.pendingImposedRuleBySide[departedSide] = null;
      if (wasHost) {
        const nextHost = room.players.find((entry) => entry.connected) || room.players[0];
        room.hostId = nextHost.id;
        room.notice = `${nextHost.nickname || "L'adversaire"} devient l'hôte du salon.`;
      }
      room.status = "lobby";
      room.roundPhase = "waiting";
      room.startedAt = null;
      room.rollEndsAt = null;
      room.lockedEndsAt = null;
      room.deadlineAt = null;
      emitStatClashRoomState(room);
      return;
    }

    if (room.status === "live") {
      const opponent = room.players.find((entry) => entry !== player && entry.connected);
      room.status = "finished";
      room.roundPhase = "finished";
      room.winnerId = opponent?.id || null;
      room.endedReason = "disconnect";
      emitStatClashRoomState(room);
      emitStatClashFinished(room);
      scheduleStatClashRoomCleanup(room);
      return;
    }

    if (room.status === "finished") scheduleStatClashRoomCleanup(room);
  };

  player.connected = false;
  if (voluntary) {
    finalize();
    return;
  }

  player.disconnectedAt = Date.now();
  player.reconnectUntil = Date.now() + STAT_CLASH_RECONNECT_GRACE_MS;
  emitStatClashRoomState(room);
  if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
  player.reconnectTimer = setTimeout(() => {
    player.reconnectTimer = null;
    if (!statClashRooms.has(room.code) || player.connected) return;
    finalize();
  }, STAT_CLASH_RECONNECT_GRACE_MS);
}

function findDraftScoreRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.draftScoreRoomCode;
  if (roomCode && draftScoreRooms.has(roomCode)) return draftScoreRooms.get(roomCode);
  for (const room of draftScoreRooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

async function sanitizeDraftScoreResult(payload = {}) {
  const selectedGenRaw = Number(payload.selectedGen);
  const selectedGen = Number.isInteger(selectedGenRaw) && selectedGenRaw >= 1 && selectedGenRaw <= 9 ? selectedGenRaw : null;
  const rawTeam = Array.isArray(payload.team) ? payload.team.slice(0, 6) : [];
  const usedIds = new Set();
  const team = [];
  for (const entry of rawTeam) {
    const id = Math.max(0, Math.round(Number(entry?.id) || 0));
    if (!id || usedIds.has(id)) return null;
    const pokemon = POKEMON_LIST.find((p) => Number(p.id) === id);
    if (!pokemon) return null;
    const pokemonGen = Number(pokemon.gen) || Number(pokemon.generation) || null;
    if (selectedGen && pokemonGen && pokemonGen !== selectedGen) return null;
    const bst = await getDraftScoreServerBst(id, entry?.bst);
    if (!bst) return null;
    usedIds.add(id);
    team.push({ id, name: pokemon.name, bst });
  }
  if (team.length !== 6) return null;
  const total = team.reduce((sum, entry) => sum + (Number(entry.bst) || 0), 0);
  const average = Math.round(total / team.length);
  if (average <= 0 || total <= 0) return null;
  return {
    average,
    total,
    selectedGen,
    team,
    label: getDraftScoreServerLabel(average),
    submittedAt: Date.now(),
  };
}

function publicDraftScoreRoomState(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    maxPlayers: MAX_ROOM_SIZE,
    connectedCount: room.players.filter((player) => player.connected).length,
    winnerSide: room.winnerSide || null,
    duel: room.duel ? {
      gen: room.duel.gen,
      currentWave: (room.duel.currentWave || []).map((id) => {
        const p = POKEMON_LIST.find((entry) => Number(entry.id) === Number(id));
        return p ? { id: Number(p.id), name: p.name, type1: p.type1 || null, type2: p.type2 || null } : null;
      }).filter(Boolean),
      waveIndex: room.duel.waveIndex || 0,
      pendingSides: ["left", "right"].filter((side) => room.duel.pendingPicks?.[side]),
      teams: {
        left: (room.duel.teams?.left || []).map((e) => ({ id: e.id, name: e.name, bst: Number(e.bst) || 0 })),
        right: (room.duel.teams?.right || []).map((e) => ({ id: e.id, name: e.name, bst: Number(e.bst) || 0 })),
      },
      picksRemaining: {
        left: Math.max(0, Number(room.duel.picksRemaining?.left) || 0),
        right: Math.max(0, Number(room.duel.picksRemaining?.right) || 0),
      },
      rerollsLeft: Math.max(0, Number(room.duel.rerollsLeft ?? 0)),
      lastEvent: room.duel.lastEvent || null,
    } : null,
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      side: player.side,
      connected: player.connected,
      isSelf: player.id === viewerId,
      isHost: player.id === room.hostId,
      hasSubmitted: Boolean(player.result),
      result: player.result || null,
      progress: player.progress || null,
    })),
  };
}

function generateDraftDuelPool(gen) {
  const list = Array.isArray(POKEMON_LIST) ? POKEMON_LIST.filter((p) => Number(p.id) < 10000) : [];
  const filtered = gen ? list.filter((p) => Number(p.gen || p.generation) === Number(gen)) : list.slice();
  return filtered.map((p) => ({ id: Number(p.id), name: String(p.name || ""), type1: p.type1, type2: p.type2 }));
}

function generateDraftDuelNextWave(room) {
  const available = (room.duel.pool || []).filter((p) => !room.duel.draftedIds.has(p.id));
  if (available.length < 1) return [];
  const shuffled = available.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(6, shuffled.length)).map((p) => p.id);
}

function buildDuelPokemonEntry(pokemonId) {
  const pokemon = POKEMON_LIST.find((p) => Number(p.id) === Number(pokemonId));
  if (!pokemon) return null;
  return { id: Number(pokemon.id), name: pokemon.name, type1: pokemon.type1 || null, type2: pokemon.type2 || null };
}

function emitDraftScoreRoomState(room) {
  for (const player of room.players) {
    if (!player.connected) continue;
    io.to(player.id).emit("draft-score:room-state", publicDraftScoreRoomState(room, player.id));
  }
}

function finalizeDraftScoreRoom(room) {
  const left = room.players.find((player) => player.side === "left");
  const right = room.players.find((player) => player.side === "right");
  if (left?.result && right?.result) {
    if (left.result.average > right.result.average) room.winnerSide = "left";
    else if (right.result.average > left.result.average) room.winnerSide = "right";
    else if (left.result.total > right.result.total) room.winnerSide = "left";
    else if (right.result.total > left.result.total) room.winnerSide = "right";
    else room.winnerSide = "tie";
  }
  room.status = "finished";
  emitDraftScoreRoomState(room);
}

function handleDraftScoreDisconnect(socketId, voluntary) {
  const room = findDraftScoreRoomBySocket(socketId);
  if (!room) return;
  const socket = io.sockets.sockets.get(socketId);
  if (socket?.data) socket.data.draftScoreRoomCode = null;
  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;
  player.connected = false;

  if (room.status !== "finished") {
    io.to(room.code).emit("draft-score:room-closed", {
      reason: voluntary ? `${player.nickname} a quitté le Score Attack.` : `${player.nickname} s'est déconnecté.`,
    });
    draftScoreRooms.delete(room.code);
    return;
  }

  if (room.players.every((entry) => !entry.connected)) {
    draftScoreRooms.delete(room.code);
  }
}

function scheduleRoomCleanup(room) {
  clearRoomCleanup(room);
  room.cleanupTimer = setTimeout(() => {
    rooms.delete(room.code);
  }, 60_000);
}

function clearRoomCleanup(room) {
  if (!room?.cleanupTimer) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
}

function scheduleStatClashRoomCleanup(room) {
  clearStatClashCleanup(room);
  clearStatClashRoomTimers(room);
  room.cleanupTimer = setTimeout(() => {
    statClashRooms.delete(room.code);
  }, 60_000);
}

function clearStatClashCleanup(room) {
  if (!room?.cleanupTimer) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
}

function clearStatClashRoomTimers(room) {
  ["startTimer", "rollTimer", "resolveTimer", "nextRoundTimer"].forEach((key) => {
    if (!room?.[key]) return;
    clearTimeout(room[key]);
    room[key] = null;
  });
}

function serializePokemon(pokemon) {
  if (!pokemon) return null;
  return {
    id: pokemon.id,
    name: pokemon.name,
    sprite: pokemon.sprite,
    type1: pokemon.type1,
    type2: pokemon.type2,
    gen: pokemon.gen || pokemon.generation,
  };
}

function isDuelPokemonAllowed(room, pokemon) {
  return Boolean(pokemon && pokemon.guessable !== false && room.selectedGens.includes(Number(pokemon.gen) || Number(pokemon.generation)));
}

function normalizeDuelPokemonName(name) {
  return normalizeName(String(name || "").replace(/♀/g, "femelle").replace(/♂/g, "male"));
}

function resolveRoomPokemonGuess(room, guess) {
  const key = normalizeDuelPokemonName(guess);
  const pokemon = POKEMON_LIST.find((entry) => normalizeDuelPokemonName(entry.name) === key);
  return isDuelPokemonAllowed(room, pokemon) ? pokemon : null;
}

function buildGuessFeedback(guess, secret) {
  return {
    id: guess.id,
    spriteId: guess.spriteId || guess.id,
    name: guess.name,
    sprite: guess.sprite,
    gen: guess.gen || guess.generation,
    isAltForm: Boolean(guess.isAltForm || guess.id >= 20000),
    type1: guess.type1,
    type2: guess.type2 || null,
    habitat: guess.habitat || "Inconnu",
    color: guess.color || "Inconnu",
    stage: guess.stage,
    height: guess.height,
    weight: guess.weight,
    feedback: compareGuessToSecret(guess, secret),
    genArrow: arrowFor(guess.gen, secret.gen),
    heightArrow: arrowFor(guess.height, secret.height),
    weightArrow: arrowFor(guess.weight, secret.weight),
  };
}

function compareGuessToSecret(guess, secret) {
  const type1State =
    guess.type1 === secret.type1
      ? "ok"
      : guess.type1 && guess.type1 === secret.type2
      ? "close"
      : "wrong";

  const type2State =
    guess.type2 === secret.type2
      ? "ok"
      : guess.type2 && guess.type2 === secret.type1
      ? "close"
      : "wrong";

  return {
    generation: guess.gen === secret.gen ? "ok" : "wrong",
    altForm: Boolean(guess.isAltForm) === Boolean(secret.isAltForm) ? "ok" : "wrong",
    type1: type1State,
    type2: type2State,
    habitat: guess.habitat === secret.habitat ? "ok" : "wrong",
    color: compareColors(guess.color, secret.color),
    stage: guess.stage === secret.stage ? "ok" : "wrong",
    height: cmpNum(guess.height, secret.height, 0.3),
    weight: cmpNum(guess.weight, secret.weight, 15),
  };
}

function cmpNum(guessValue, secretValue, tolerance) {
  if (guessValue === secretValue) return "ok";
  if (Math.abs(guessValue - secretValue) <= tolerance) return "close";
  return "wrong";
}

function compareColors(guessColor, secretColor) {
  const guessTokens = colorTokens(guessColor);
  const secretTokens = colorTokens(secretColor);
  const guessSet = new Set(guessTokens);
  const secretSet = new Set(secretTokens);
  let overlap = 0;
  for (const token of guessSet) {
    if (secretSet.has(token)) overlap += 1;
  }
  if (overlap === 0) return "wrong";
  if (overlap === guessSet.size && overlap === secretSet.size) return "ok";
  return "close";
}

function colorTokens(value) {
  return String(value || "")
    .split(/[\/,\-]+/)
    .map((entry) => normalizeName(entry))
    .filter(Boolean);
}

function arrowFor(guessValue, secretValue) {
  if (guessValue === secretValue) return "";
  return guessValue < secretValue ? "↑" : "↓";
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(.+?) mega( [xyz])?$/i, "mega $1$2")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}
