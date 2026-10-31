"use strict";

// The admin panel (/admin): the site owner, signed in with their usual account, edits the
// news banner and takes back a shared profile photo, from a phone, without a deploy.
// Admins are the account ids listed in ADMIN_ACCOUNT_IDS (comma-separated) on Render.

const nameOverrides = require("./name-overrides");
const playerLevel = require("./player-level-admin");
const NEWS_TEXT_MAX = 90;
const NEWS_DAYS_MAX = 60;
// Where a news line leads: only screens the site can open from the banner.
const NEWS_ACTIONS = Object.freeze({
  startDailyGame: "Pokémon du jour",
  openAllModesScreen: "Tous les jeux",
  openHigherLowerMode: "Higher or Lower",
  startPixelGame: "Pokémon pixelisé",
  startMysteryStatGame: "Stat Mystère",
  startWeightBattle: "Duel de poids",
  startDailyPetitBac: "Petit Bac du jour",
  openEggGame: "Œuf mystère",
  openWeeklyLeague: "Ligue de la semaine",
  openLeaderboardV2: "Classements",
  openPartyRoomMode: "Party Room",
});

function adminIdsFrom(value) {
  return new Set(String(value || "").split(",").map((id) => id.trim()).filter(Boolean));
}

function parisDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function addDays(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const oneLine = (value) => String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function validateNews(body, today = parisDay()) {
  const text = oneLine(body && body.text);
  const until = String((body && body.until) || "");
  const action = String((body && body.action) || "");
  if (text.length < 3) return { error: "Le texte est trop court." };
  if (text.length > NEWS_TEXT_MAX) return { error: `Le texte dépasse ${NEWS_TEXT_MAX} caractères.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || addDays(until, 0) !== until) return { error: "La date de fin est invalide." };
  if (until < today) return { error: "La date de fin est déjà passée." };
  if (until > addDays(today, NEWS_DAYS_MAX)) return { error: `La date de fin doit être dans les ${NEWS_DAYS_MAX} jours.` };
  if (!Object.hasOwn(NEWS_ACTIONS, action)) return { error: "Choisis où mène l'annonce." };
  return { news: { text, until, action } };
}

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  // A photo taken back stays out of the rankings, even when the player's profile sends it again.
  await db.query(`CREATE TABLE IF NOT EXISTS blocked_photos (
    photo_key TEXT PRIMARY KEY,
    account_id TEXT NOT NULL DEFAULT '',
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

// The announcement stored by the admin: { set: false } when none was ever saved, so the
// site keeps its own built-in line; { set: true, news: null } once the admin cleared it.
async function readNews(db, today = parisDay()) {
  const r = await db.query("SELECT value FROM site_settings WHERE key = 'news'");
  if (!r.rows[0]) return { set: false, news: null };
  const v = r.rows[0].value || {};
  const live = v.text && v.until >= today && Object.hasOwn(NEWS_ACTIONS, v.action);
  return { set: true, news: live ? { text: v.text, until: v.until, action: v.action } : null };
}
async function saveNews(db, news) {
  await db.query(`INSERT INTO site_settings(key, value, updated_at) VALUES ('news', $1::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [JSON.stringify(news || {})]);
}

async function isPhotoBlocked(db, key) {
  if (!db || !key) return false;
  const r = await db.query("SELECT 1 FROM blocked_photos WHERE photo_key = $1", [key]);
  return r.rows.length > 0;
}
async function sharedPhotos(db) {
  const r = await db.query("SELECT discord_id, username, photo_key FROM users WHERE photo_key IS NOT NULL ORDER BY last_login DESC LIMIT 200");
  return r.rows;
}
async function removePhoto(db, key) {
  const client = db.connect ? await db.connect() : db;
  try {
    await client.query("BEGIN");
    const owner = await client.query("SELECT discord_id FROM users WHERE photo_key = $1 LIMIT 1", [key]);
    await client.query("INSERT INTO blocked_photos(photo_key, account_id) VALUES ($1, $2) ON CONFLICT (photo_key) DO NOTHING", [key, owner.rows[0] ? owner.rows[0].discord_id : ""]);
    const r = await client.query("UPDATE users SET photo_key = NULL, photo = NULL WHERE photo_key = $1", [key]);
    await client.query("COMMIT");
    return r.rowCount || 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { if (client.release) client.release(); }
}

const NOTICES = Object.freeze({
  news: "Annonce enregistrée : elle s'affiche au prochain chargement du site.",
  "news-cleared": "Annonce retirée.",
  photo: "Photo retirée des classements.",
  message: "Message envoyé : le joueur le verra à sa prochaine visite.",
  "message-removed": "Message retiré.",
  "name-replaced": "Pseudo remplacé par « Dresseur » partout, et il le reste à la prochaine connexion.",
  "name-restored": "Pseudo rétabli : son nom revient à sa prochaine connexion.",
  level: "Niveau remis : le joueur le retrouve à sa prochaine visite, sur chacun de ses appareils.",
});

function page(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#FFF8EF;--ink:#2E2A33;--muted:#6B6472;--card:#fff;--line:#EADFD0;--blue:#4069E0;--red:#C7423A;--ok:#2F8A57}
@media (prefers-color-scheme:dark){:root{--bg:#1E1C24;--ink:#F3EEE8;--muted:#B5ADBB;--card:#29262F;--line:#3A3642}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 Nunito,system-ui,sans-serif;padding:16px}
main{max-width:720px;margin:0 auto}h1{font:700 26px Fredoka,system-ui,sans-serif;margin:8px 0 16px}h2{font:700 20px Fredoka,system-ui,sans-serif;margin:0 0 8px}
section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin:0 0 16px}
p.hint{color:var(--muted);margin:4px 0 12px;font-size:14px}label{display:block;font-weight:700;margin:12px 0 4px}
input,select{width:100%;font:inherit;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink)}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}button,a.btn,summary.btn{font:700 16px Nunito,system-ui,sans-serif;border:0;border-radius:12px;padding:12px 18px;cursor:pointer;text-decoration:none;display:inline-block}
.primary{background:var(--blue);color:#fff}.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)!important}.danger{background:var(--red);color:#fff}
.notice{border-radius:12px;padding:12px;margin:0 0 16px;font-weight:700}.notice.ok{background:#E3F4EA;color:#1F5E3A}.notice.err{background:#FBE5E3;color:#8A2A23}
.current{border-left:4px solid #FFD45C;padding:8px 12px;background:var(--bg);border-radius:8px;margin:8px 0}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.photo{border:1px solid var(--line);border-radius:14px;padding:10px;text-align:center}
.photo img{width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 8px;background:var(--bg)}.photo b{display:block;overflow-wrap:anywhere;margin-bottom:8px}
.photo button,.photo summary{width:100%}.photo summary{list-style:none;margin-bottom:8px}.photo summary::-webkit-details-marker{display:none}
textarea{width:100%;font:inherit;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink);resize:vertical}
label.check{display:flex;gap:8px;align-items:center;font-weight:700}label.check input{width:auto}h3{font:700 17px Fredoka,system-ui,sans-serif;margin:20px 0 8px}
.message{border:1px solid var(--line);border-radius:14px;padding:12px;margin:0 0 10px}.message .meta{color:var(--muted);font-size:14px;margin-bottom:6px}.message .body{overflow-wrap:anywhere;margin-bottom:8px}
.answer{border-left:4px solid #7C5BD6;background:var(--bg);border-radius:8px;padding:8px 12px;margin:0 0 8px;overflow-wrap:anywhere}.message summary{list-style:none}.message summary::-webkit-details-marker{display:none}
</style></head><body><main>${body}</main></body></html>`;
}

function newsSection(state, today) {
  const v = state.news;
  const current = v
    ? `<div class="current"><b>En ligne :</b> « ${escapeHtml(v.text)} » → ${escapeHtml(NEWS_ACTIONS[v.action])}, jusqu'au ${escapeHtml(v.until.split("-").reverse().join("/"))} inclus.</div>`
    : `<div class="current">${state.set ? "Aucune annonce en ligne." : "Aucune annonce enregistrée ici : le site garde celle prévue dans le code."}</div>`;
  const options = Object.entries(NEWS_ACTIONS).map(([key, label]) => `<option value="${key}"${v && v.action === key ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  return `<section><h2>Bandeau d'actualités</h2><p class="hint">Une ligne de plus dans le bandeau qui défile sous l'en-tête. Elle disparaît d'elle-même après la date de fin (jour de Paris).</p>${current}
<form method="post" action="/admin/news">
<label for="news-text">Texte (${NEWS_TEXT_MAX} caractères max)</label><input id="news-text" name="text" maxlength="${NEWS_TEXT_MAX}" required value="${v ? escapeHtml(v.text) : ""}" placeholder="Nouveau : …">
<label for="news-until">Jusqu'au (inclus)</label><input id="news-until" name="until" type="date" required min="${today}" max="${addDays(today, NEWS_DAYS_MAX)}" value="${v ? v.until : addDays(today, 7)}">
<label for="news-action">Un clic sur l'annonce ouvre</label><select id="news-action" name="action">${options}</select>
<div class="row"><button class="primary" type="submit">Enregistrer l'annonce</button></div></form>
${v || !state.set ? `<form method="post" action="/admin/news/clear"><div class="row"><button class="ghost" type="submit">Retirer l'annonce</button></div></form>` : ""}</section>`;
}

function photosSection(rows) {
  const cards = rows.map((row) => `<div class="photo"><img src="/api/avatar-photo/${escapeHtml(row.photo_key)}" alt="" loading="lazy"><b>${escapeHtml(row.username || "Dresseur")}</b>
<details><summary class="btn ghost">Retirer…</summary><form method="post" action="/admin/photos/remove"><input type="hidden" name="photo_key" value="${escapeHtml(row.photo_key)}"><button class="danger" type="submit">Oui, retirer</button></form></details></div>`).join("");
  return `<section><h2>Photos partagées</h2><p class="hint">Les photos que les joueurs montrent dans les classements. « Retirer » l'enlève pour tout le monde, et la même photo ne pourra plus revenir. Le joueur peut en choisir une autre.</p>
${rows.length ? `<div class="photos">${cards}</div>` : "<p>Aucune photo partagée pour l'instant.</p>"}</section>`;
}

// « Pseudo déplacé » : replace a player's name with « Dresseur » (lib/name-overrides.js).
function namesSection(players, replaced) {
  const options = players.map((p) => `<option value="${escapeHtml(p.discord_id)}">${escapeHtml(p.username)}</option>`).join("");
  const list = replaced.map((r) => `<div class="photo"><b>${escapeHtml(r.previous || "?")}</b><small>remplacé le ${escapeHtml(r.day)}</small>
<form method="post" action="/admin/names/restore"><input type="hidden" name="account_id" value="${escapeHtml(r.account_id)}"><button class="ghost" type="submit">Rétablir</button></form></div>`).join("");
  return `<section><h2>Pseudo déplacé</h2><p class="hint">Remplace le pseudo d'un joueur par « Dresseur » dans les classements, la carte de dresseur et la Party Room. Il le reste même s'il se reconnecte.</p>
<form method="post" action="/admin/names/replace"><label>Joueur<select name="account_id" required><option value="">Choisis un joueur</option>${options}</select></label>
<div class="row"><button class="danger" type="submit">Remplacer par « Dresseur »</button></div></form>
${list ? `<h3>Pseudos remplacés</h3><div class="photos">${list}</div>` : ""}</section>`;
}

// `db` is the pg pool; `ready` resolves to true once the tables exist.
// `messages` (optional) writes to the players: { module, webpush, pushReady }, see lib/player-messages.js.
function mountAdminRoutes(app, { express, db, ready, getSessionUser, adminIds, today = parisDay, log = console, messages = null }) {
  const form = express.urlencoded({ extended: false, limit: "8kb" });
  const ids = () => (typeof adminIds === "function" ? adminIds() : adminIds) || new Set();
  const noStore = (res) => res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "same-origin" });
  const isAdmin = (user) => Boolean(user && ids().has(String(user.id)));

  function guard(req, res) {
    noStore(res);
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).send(page("Admin", `<h1>Panneau admin</h1><section><p>Connecte-toi d'abord sur le site avec ton compte, puis reviens ici.</p><div class="row"><a class="btn primary" href="/">Aller sur Pokédle</a></div></section>`));
      return null;
    }
    if (!isAdmin(user)) {
      // Showing a signed-in player their own id is harmless and lets the owner set ADMIN_ACCOUNT_IDS.
      res.status(403).send(page("Admin", `<h1>Panneau admin</h1><section><p>Ce compte n'est pas administrateur.</p><p class="hint">Ton identifiant de compte : <b>${escapeHtml(user.id)}</b>. Pour en faire un compte admin, ajoute-le dans la variable <b>ADMIN_ACCOUNT_IDS</b> sur Render.</p></section>`));
      return null;
    }
    return user;
  }
  function sameOrigin(req) {
    const origin = req.get("origin");
    if (!origin) return false;
    try { return new URL(origin).host === req.get("host"); } catch (_error) { return false; }
  }
  async function dbReady() { return Boolean(db) && await ready; }
  const back = (res, notice) => res.redirect(303, "/admin?" + new URLSearchParams(notice).toString());

  app.get("/admin", async (req, res) => {
    const user = guard(req, res);
    if (!user) return;
    if (!await dbReady()) return res.status(503).send(page("Admin", "<h1>Panneau admin</h1><section><p>Base de données indisponible pour le moment.</p></section>"));
    const day = today();
    try {
      const [news, photos] = await Promise.all([readNews(db, day), sharedPhotos(db)]);
      let namesHtml = "";
      try {
        const [players, replaced] = await Promise.all([
          db.query("SELECT discord_id, username FROM users WHERE username <> '' AND username <> $1 ORDER BY last_login DESC NULLS LAST LIMIT 300", [nameOverrides.REPLACED_NAME]).then((r) => r.rows),
          nameOverrides.listOverrides(db),
        ]);
        namesHtml = namesSection(players, replaced);
      } catch (error) { log.error("[admin] names:", error.message); }
      let levelHtml = "";
      try { levelHtml = playerLevel.levelSectionHtml(await playerLevel.playersWithLevel(db)); }
      catch (error) { log.error("[admin] level:", error.message); }
      let messagesHtml = "";
      if (messages) {
        try {
          const pushCount = await db.query("SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE account_id IS NOT NULL").then((r) => r.rows[0].n, () => NaN);
          messagesHtml = messages.module.adminSectionHtml(await messages.module.adminState(db), pushCount);
        } catch (error) { log.error("[admin] messages:", error.message); messagesHtml = "<section><h2>Écrire aux joueurs</h2><p>Lecture impossible pour le moment.</p></section>"; }
      }
      const ok = NOTICES[req.query.ok];
      const err = typeof req.query.err === "string" ? oneLine(req.query.err).slice(0, 160) : "";
      res.send(page("Pokédle · Admin", `<h1>Panneau admin</h1>${ok ? `<div class="notice ok">${escapeHtml(ok)}</div>` : ""}${err ? `<div class="notice err">${escapeHtml(err)}</div>` : ""}
${newsSection(news, day)}${messagesHtml}${photosSection(photos)}${namesHtml}${levelHtml}<p class="hint">Connecté : ${escapeHtml(user.username || user.id)} · <a href="/">Retour au site</a></p>`));
    } catch (error) {
      log.error("[admin] page:", error.message);
      res.status(503).send(page("Admin", "<h1>Panneau admin</h1><section><p>Lecture impossible pour le moment.</p></section>"));
    }
  });

  app.post("/admin/news", form, async (req, res) => {
    if (!guard(req, res)) return;
    if (!sameOrigin(req)) return res.status(403).send("Origine refusée.");
    if (!await dbReady()) return back(res, { err: "Base de données indisponible." });
    const checked = validateNews(req.body, today());
    if (checked.error) return back(res, { err: checked.error });
    try { await saveNews(db, checked.news); back(res, { ok: "news" }); }
    catch (error) { log.error("[admin] news:", error.message); back(res, { err: "Enregistrement impossible." }); }
  });

  app.post("/admin/news/clear", form, async (req, res) => {
    if (!guard(req, res)) return;
    if (!sameOrigin(req)) return res.status(403).send("Origine refusée.");
    if (!await dbReady()) return back(res, { err: "Base de données indisponible." });
    try { await saveNews(db, null); back(res, { ok: "news-cleared" }); }
    catch (error) { log.error("[admin] news clear:", error.message); back(res, { err: "Suppression impossible." }); }
  });

  app.post("/admin/photos/remove", form, async (req, res) => {
    if (!guard(req, res)) return;
    if (!sameOrigin(req)) return res.status(403).send("Origine refusée.");
    const key = String((req.body && req.body.photo_key) || "");
    if (!/^[0-9a-f]{24}$/.test(key)) return back(res, { err: "Photo inconnue." });
    if (!await dbReady()) return back(res, { err: "Base de données indisponible." });
    try { await removePhoto(db, key); back(res, { ok: "photo" }); }
    catch (error) { log.error("[admin] photo:", error.message); back(res, { err: "Retrait impossible." }); }
  });

  for (const [path, action, notice] of [["/admin/names/replace", "replaceName", "name-replaced"], ["/admin/names/restore", "restoreName", "name-restored"]]) {
    app.post(path, form, async (req, res) => {
      if (!guard(req, res)) return;
      if (!sameOrigin(req)) return res.status(403).send("Origine refusée.");
      const id = oneLine(req.body && req.body.account_id).slice(0, 80);
      if (!id) return back(res, { err: "Choisis un joueur." });
      if (!await dbReady()) return back(res, { err: "Base de données indisponible." });
      try {
        const result = await nameOverrides[action](db, id);
        if (result.error) return back(res, { err: result.error });
        back(res, { ok: notice });
      } catch (error) { log.error("[admin] names:", error.message); back(res, { err: "Modification impossible." }); }
    });
  }

  // « Niveau d'un joueur » : put back a lost level (lib/player-level-admin.js).
  app.post("/admin/level", form, async (req, res) => {
    if (!guard(req, res)) return;
    if (!sameOrigin(req)) return res.status(403).send("Origine refusée.");
    const id = oneLine(req.body && req.body.account_id).slice(0, 80);
    if (!id) return back(res, { err: "Choisis un joueur." });
    if (!await dbReady()) return back(res, { err: "Base de données indisponible." });
    try {
      const result = await playerLevel.setPlayerLevel(db, id, Number(oneLine(req.body && req.body.level)));
      if (result.error) return back(res, { err: result.error });
      back(res, { ok: "level" });
    } catch (error) { log.error("[admin] level:", error.message); back(res, { err: "Modification impossible." }); }
  });

  if (messages) {
    app.post("/admin/messages", form, async (req, res) => {
      if (!guard(req, res)) return;
      if (!sameOrigin(req)) return res.status(403).send("Origine refusée.");
      if (!await dbReady()) return back(res, { err: "Base de données indisponible." });
      const raw = String((req.body && req.body.to) || "");
      if (!raw) return back(res, { err: "Choisis à qui écrire." });
      const to = raw === "all" ? null : raw;
      try {
        const sent = await messages.module.sendMessage(db, { to, body: req.body && req.body.body });
        if (sent.error) return back(res, { err: sent.error });
        if (req.body.push === "1" && messages.webpush && await messages.pushReady) {
          messages.module.notify(db, messages.webpush, to, log).catch((error) => log.warn("[admin] message push:", error.message));
        }
        back(res, { ok: "message" });
      } catch (error) { log.error("[admin] message:", error.message); back(res, { err: "Envoi impossible." }); }
    });

    app.post("/admin/messages/remove", form, async (req, res) => {
      if (!guard(req, res)) return;
      if (!sameOrigin(req)) return res.status(403).send("Origine refusée.");
      const id = Number(req.body && req.body.id);
      if (!Number.isSafeInteger(id) || id <= 0) return back(res, { err: "Message inconnu." });
      if (!await dbReady()) return back(res, { err: "Base de données indisponible." });
      try { await messages.module.removeMessage(db, id); back(res, { ok: "message-removed" }); }
      catch (error) { log.error("[admin] message remove:", error.message); back(res, { err: "Retrait impossible." }); }
    });
  }

  // What the news banner reads. Public: it only carries the line everyone will see.
  app.get("/api/news", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!await dbReady()) return res.json({ ok: false });
    try { res.json({ ok: true, ...(await readNews(db, today())) }); }
    catch (error) { log.error("[admin] news read:", error.message); res.json({ ok: false }); }
  });

  return { isAdmin };
}

module.exports = { NEWS_ACTIONS, NEWS_TEXT_MAX, NEWS_DAYS_MAX, adminIdsFrom, parisDay, addDays, validateNews, ensureTables, readNews, saveNews, isPhotoBlocked, removePhoto, mountAdminRoutes };
