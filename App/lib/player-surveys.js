"use strict";
// 📊 Sondage unique (9/11/2026, maquette validée par Kayan : « Ok go »). Kayan veut savoir si le nouveau look
// et les nouveautés plaisent. Chaque joueur qui avait déjà un compte au lancement du sondage voit une fenêtre,
// une seule fois, à sa visite suivante : deux questions (😕 Pas fan · 🙂 Ça va · 😍 J'adore) et un mot facultatif.
// « Non merci » ou ✕ : on ne redemande jamais. Merci = +1 Poké Ball (hors plafond des 10 par jour).
// Kayan lit les réponses dans /admin et peut lancer un autre sondage plus tard, sans PR.
// Gardé 180 jours, effacé avec le compte. Rien d'autre n'est gardé (ni appareil, ni adresse).
const COMMENT_MAX = 300;
const TEXT_MAX = 80;
const LIVE_DAYS = 30;
const KEEP_DAYS = 180;
const FACES = Object.freeze([null, { emoji: "😕", label: "Pas fan" }, { emoji: "🙂", label: "Ça va" }, { emoji: "😍", label: "J'adore" }]);
const FIRST_SURVEY = Object.freeze({ title: "Ton avis sur Pokédle ?", q1: "Le nouveau look du site", q2: "Les nouveautés", hint: "Pokédex, hautes herbes, Party Room, défis entre amis…" });
const PARIS_DAY = "(timezone('Europe/Paris', now()))::date";

function oneLine(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function cleanComment(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, " ")
    .split("\n").map((line) => line.replace(/\s+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, COMMENT_MAX);
}
const face = (value) => { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 3 ? n : null; };

async function ensureTables(db, { seed = true } = {}) {
  await db.query(`CREATE TABLE IF NOT EXISTS player_surveys (
    id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, q1 TEXT NOT NULL, q2 TEXT, hint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), closed_at TIMESTAMPTZ)`);
  await db.query(`CREATE TABLE IF NOT EXISTS player_survey_answers (
    survey_id BIGINT NOT NULL REFERENCES player_surveys(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'seen',
    a1 SMALLINT, a2 SMALLINT, comment TEXT,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), answered_at TIMESTAMPTZ,
    PRIMARY KEY (survey_id, account_id))`);
  await db.query(`DELETE FROM player_surveys WHERE created_at < now() - interval '${KEEP_DAYS} days'`);
  // Le premier sondage part tout seul à la mise en ligne (c'est la demande de Kayan) ; jamais un 2e.
  if (seed) {
    await db.query(`INSERT INTO player_surveys(title, q1, q2, hint) SELECT $1, $2, $3, $4
      WHERE NOT EXISTS (SELECT 1 FROM player_surveys)`, [FIRST_SURVEY.title, FIRST_SURVEY.q1, FIRST_SURVEY.q2, FIRST_SURVEY.hint]);
  }
}

const LIVE = `s.closed_at IS NULL AND s.created_at > now() - interval '${LIVE_DAYS} days'`;
const shape = (row) => row && { id: Number(row.id), title: row.title, q1: row.q1, q2: row.q2 || null, hint: row.hint || null };

// Le sondage à montrer à ce joueur : le dernier en cours, s'il avait déjà un compte à son lancement
// et ne l'a encore ni rempli ni refusé. « Vu » seulement (fenêtre fermée par un rechargement) : il revient.
async function current(db, accountId) {
  const r = await db.query(`SELECT s.id, s.title, s.q1, s.q2, s.hint FROM player_surveys s
    WHERE ${LIVE}
      AND EXISTS (SELECT 1 FROM users u WHERE u.discord_id = $1 AND u.created_at < s.created_at)
      AND NOT EXISTS (SELECT 1 FROM player_survey_answers a WHERE a.survey_id = s.id AND a.account_id = $1 AND a.status <> 'seen')
    ORDER BY s.created_at DESC, s.id DESC LIMIT 1`, [String(accountId)]);
  return shape(r.rows[0]) || null;
}

async function liveSurvey(db, id, accountId) {
  const r = await db.query(`SELECT s.id, s.q2 FROM player_surveys s WHERE s.id = $1 AND ${LIVE}
    AND EXISTS (SELECT 1 FROM users u WHERE u.discord_id = $2 AND u.created_at < s.created_at)`, [id, String(accountId)]);
  return r.rows[0] || null;
}

async function markSeen(db, accountId, id) {
  if (!await liveSurvey(db, id, accountId)) return { ok: false, error: "gone" };
  await db.query("INSERT INTO player_survey_answers(survey_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, String(accountId)]);
  return { ok: true };
}

async function skip(db, accountId, id) {
  if (!await liveSurvey(db, id, accountId)) return { ok: false, error: "gone" };
  await db.query(`INSERT INTO player_survey_answers(survey_id, account_id, status) VALUES ($1, $2, 'skipped')
    ON CONFLICT (survey_id, account_id) DO UPDATE SET status = 'skipped' WHERE player_survey_answers.status = 'seen'`, [id, String(accountId)]);
  return { ok: true };
}

// Une seule réponse par joueur : la 2e est refusée (pas de 2e Poké Ball).
async function answer(db, accountId, { id, a1, a2, comment } = {}) {
  const survey = await liveSurvey(db, id, accountId);
  if (!survey) return { ok: false, error: "gone" };
  const one = face(a1), two = survey.q2 ? face(a2) : null;
  if (!one || (survey.q2 && !two)) return { ok: false, error: "pick" };
  const text = cleanComment(comment);
  // 9/11/2026 (audit) : la réponse et la Poké Ball sont écrites ensemble (une panne entre les deux ne laisse plus
  // une réponse enregistrée sans la Ball promise). Sans table des Balls (tests), le merci reste sans Ball.
  const client = typeof db.connect === "function" ? await db.connect() : null;
  const q = (sql, params) => (client || db).query(sql, params);
  let ball = false;
  try {
    if (client) await q("BEGIN");
    const r = await q(`INSERT INTO player_survey_answers(survey_id, account_id, status, a1, a2, comment, answered_at)
      VALUES ($1, $2, 'answered', $3, $4, $5, now())
      ON CONFLICT (survey_id, account_id) DO UPDATE SET status = 'answered', a1 = EXCLUDED.a1, a2 = EXCLUDED.a2, comment = EXCLUDED.comment, answered_at = now()
      WHERE player_survey_answers.status = 'seen' RETURNING 1`, [id, String(accountId), one, two, text || null]);
    if (!r.rows.length) { if (client) await q("ROLLBACK"); return { ok: false, error: "already" }; }
    if (client) await q("SAVEPOINT survey_ball");
    try {
      const g = await q(`INSERT INTO ball_gains(identity, day, source, ball, account_id) VALUES ($1, ${PARIS_DAY}, $2, 'poke', $3)
        ON CONFLICT DO NOTHING RETURNING 1`, ["user:" + accountId, "survey:" + id, String(accountId)]);
      ball = g.rows.length > 0;
    } catch (error) {
      if (error && error.code !== "42P01") throw error; // seule l'absence de la table des Balls est tolérée
      if (client) await q("ROLLBACK TO SAVEPOINT survey_ball");
      ball = false;
    }
    if (client) await q("COMMIT");
  } catch (error) {
    if (client) await q("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    if (client) client.release();
  }
  return { ok: true, ball };
}

async function create(db, body = {}) {
  const title = oneLine(body.title, TEXT_MAX), q1 = oneLine(body.q1, TEXT_MAX);
  const q2 = oneLine(body.q2, TEXT_MAX), hint = oneLine(body.hint, 120);
  if (title.length < 3 || q1.length < 3) return { error: "Il faut un titre et une première question." };
  await db.query("UPDATE player_surveys SET closed_at = now() WHERE closed_at IS NULL");
  const r = await db.query("INSERT INTO player_surveys(title, q1, q2, hint) VALUES ($1, $2, $3, $4) RETURNING id", [title, q1, q2 || null, q2 && hint ? hint : null]);
  return { id: Number(r.rows[0].id) };
}

async function stop(db, id) {
  const r = await db.query("UPDATE player_surveys SET closed_at = now() WHERE id = $1 AND closed_at IS NULL", [id]);
  return r.rowCount || 0;
}

async function adminState(db) {
  const surveys = (await db.query(`SELECT s.id, s.title, s.q1, s.q2, s.hint, s.closed_at IS NULL AND s.created_at > now() - interval '${LIVE_DAYS} days' AS live,
      to_char(s.created_at AT TIME ZONE 'Europe/Paris', 'DD/MM') AS day,
      to_char((s.created_at + interval '${LIVE_DAYS} days') AT TIME ZONE 'Europe/Paris', 'DD/MM') AS until,
      COUNT(a.*)::int AS seen,
      COUNT(a.*) FILTER (WHERE a.status = 'answered')::int AS answered,
      COUNT(a.*) FILTER (WHERE a.status = 'skipped')::int AS skipped,
      COUNT(a.*) FILTER (WHERE a.comment IS NOT NULL)::int AS comments,
      array[COUNT(a.*) FILTER (WHERE a.a1 = 1), COUNT(a.*) FILTER (WHERE a.a1 = 2), COUNT(a.*) FILTER (WHERE a.a1 = 3)]::int[] AS r1,
      array[COUNT(a.*) FILTER (WHERE a.a2 = 1), COUNT(a.*) FILTER (WHERE a.a2 = 2), COUNT(a.*) FILTER (WHERE a.a2 = 3)]::int[] AS r2
    FROM player_surveys s LEFT JOIN player_survey_answers a ON a.survey_id = s.id
    GROUP BY s.id ORDER BY s.created_at DESC, s.id DESC LIMIT 5`)).rows;
  const ids = surveys.map((s) => s.id);
  const comments = ids.length ? (await db.query(`SELECT a.survey_id, a.a1, a.a2, a.comment, COALESCE(u.username, 'Joueur') AS username,
      to_char(a.answered_at AT TIME ZONE 'Europe/Paris', 'DD/MM HH24"h"MI') AS at
    FROM player_survey_answers a LEFT JOIN users u ON u.discord_id = a.account_id
    WHERE a.survey_id = ANY($1) AND a.comment IS NOT NULL ORDER BY a.answered_at DESC LIMIT 300`, [ids])).rows : [];
  return surveys.map((s) => ({
    id: Number(s.id), title: s.title, q1: s.q1, q2: s.q2, hint: s.hint, live: s.live, day: s.day, until: s.until,
    seen: s.seen, answered: s.answered, skipped: s.skipped, comments: s.comments, r1: s.r1.map(Number), r2: s.r2.map(Number),
    list: comments.filter((c) => String(c.survey_id) === String(s.id)).map((c) => ({ username: c.username, a1: c.a1, a2: c.a2, comment: c.comment, at: c.at })),
  }));
}

// Le texte simple que Kayan colle dans le chat (« Copier pour Claude »).
function surveyText(s) {
  const bars = (counts) => [3, 2, 1].map((n) => `${FACES[n].emoji} ${FACES[n].label} : ${counts[n - 1]}`).join(" · ");
  const lines = [`Sondage « ${s.title} » (lancé le ${s.day}${s.live ? ", en cours" : ", terminé"})`,
    `${s.answered} réponses · ${s.skipped} « Non merci » · ${s.seen} joueurs l'ont vu`,
    `${s.q1} : ${bars(s.r1)}`];
  if (s.q2) lines.push(`${s.q2} : ${bars(s.r2)}`);
  if (s.list.length) {
    lines.push("Commentaires :");
    for (const c of s.list) lines.push(`- ${c.username} (${[c.a1, c.a2].filter(Boolean).map((n) => FACES[n].emoji).join(" ")}) : ${String(c.comment).replace(/\n+/g, " ")}`);
  }
  return lines.join("\n");
}

function adminSectionHtml(surveys, escapeHtml) {
  const bars = (counts) => {
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return [3, 2, 1].map((n) => `<div class="sv-bar"><span>${FACES[n].emoji} ${FACES[n].label}</span><i class="sv-f${n}" style="width:${Math.round((counts[n - 1] / total) * 100)}%"></i><b>${counts[n - 1]}</b></div>`).join("");
  };
  const block = (s, open) => {
    const comments = s.list.map((c) => `<div class="sv-cm"><small>${escapeHtml(c.username)} · ${[c.a1, c.a2].filter(Boolean).map((n) => FACES[n].emoji).join(" ")} · ${escapeHtml(c.at || "")}</small>${escapeHtml(c.comment).replace(/\n/g, "<br>")}</div>`).join("");
    const body = `<p class="hint">« ${escapeHtml(s.title)} » · lancé le ${escapeHtml(s.day)}${s.live ? ` · montré jusqu'au ${escapeHtml(s.until)} aux joueurs qui avaient déjà un compte` : " · terminé"}</p>
<div class="sv-nums"><div><b>${s.answered}</b>réponses</div><div><b>${s.skipped}</b>« Non merci »</div><div><b>${s.seen}</b>l'ont vu</div><div><b>${s.comments}</b>commentaires</div></div>
<div class="sv-qq"><div><h3>${escapeHtml(s.q1)}</h3>${bars(s.r1)}</div>${s.q2 ? `<div><h3>${escapeHtml(s.q2)}</h3>${bars(s.r2)}</div>` : ""}</div>
<h3>Commentaires</h3>${comments || "<p class=\"hint\">Pas encore de commentaire.</p>"}
<details><summary class="btn ghost">📋 Texte à copier pour Claude</summary><textarea readonly rows="8">${escapeHtml(surveyText(s))}</textarea></details>
${s.live ? `<details><summary class="btn ghost">⏹ Arrêter le sondage…</summary><form method="post" action="/admin/survey/stop"><input type="hidden" name="id" value="${s.id}"><button class="danger" type="submit">Oui, ne plus le montrer</button></form></details>` : ""}`;
    return open ? body : `<details class="sv-old"><summary>${escapeHtml(s.title)} · ${escapeHtml(s.day)} · ${s.answered} réponses</summary>${body}</details>`;
  };
  const [first, ...older] = surveys;
  const head = first ? `<h2>📊 Sondage ${first.live ? "en cours" : "terminé"}</h2>${block(first, true)}` : "<h2>📊 Sondage</h2><p class=\"hint\">Aucun sondage pour l'instant.</p>";
  return `<section id="survey"><style>
.sv-nums{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 12px}.sv-nums div{background:var(--bg);border-radius:12px;padding:8px 12px;font-size:13px;color:var(--muted)}.sv-nums b{display:block;font:700 22px Fredoka,system-ui,sans-serif;color:var(--ink)}
.sv-qq{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.sv-bar{display:grid;grid-template-columns:92px 1fr 34px;gap:8px;align-items:center;font-size:14px;margin:4px 0}
.sv-bar i{display:block;height:12px;min-width:4px;border-radius:6px;background:#C9BFB2}.sv-bar i.sv-f3{background:var(--blue)}.sv-bar i.sv-f2{background:#F2C14E}.sv-bar b{text-align:right}
.sv-cm{border-top:1px solid var(--line);padding:8px 0;overflow-wrap:anywhere}.sv-cm small{display:block;color:var(--muted)}#survey details{margin-top:10px}#survey summary{list-style:none}#survey summary::-webkit-details-marker{display:none}
.sv-old{border:1px solid var(--line);border-radius:12px;padding:10px 12px}.sv-old>summary{font-weight:800;cursor:pointer}
.sv-new{margin-top:14px}.sv-new>summary{list-style:none}.sv-new>summary::-webkit-details-marker{display:none}
</style>${head}${older.map((s) => block(s, false)).join("")}
<details class="sv-new"><summary class="btn ghost">➕ Nouveau sondage…</summary><p class="hint">Il remplace celui en cours. Chaque joueur qui a déjà un compte le voit une seule fois, à sa prochaine visite, pendant ${LIVE_DAYS} jours. Réponses : 😕 Pas fan · 🙂 Ça va · 😍 J'adore, plus un mot facultatif (${COMMENT_MAX} caractères). Merci = +1 Poké Ball.</p>
<form method="post" action="/admin/survey">
<label for="sv-title">Titre</label><input id="sv-title" name="title" maxlength="${TEXT_MAX}" required value="Ton avis sur Pokédle ?">
<label for="sv-q1">Question 1</label><input id="sv-q1" name="q1" maxlength="${TEXT_MAX}" required placeholder="Le nouveau look du site">
<label for="sv-q2">Question 2 (facultative)</label><input id="sv-q2" name="q2" maxlength="${TEXT_MAX}" placeholder="Les nouveautés">
<label for="sv-hint">Petite ligne sous la question 2 (facultative)</label><input id="sv-hint" name="hint" maxlength="120" placeholder="Pokédex, hautes herbes, Party Room…">
<div class="row"><button class="primary" type="submit">Lancer le sondage</button></div></form></details></section>`;
}

function createRateLimit(limit = 30, windowMs = 600000) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(), entry = hits.get(key);
    if (!entry || now - entry.at > windowMs) { hits.set(key, { at: now, n: 1 }); return false; }
    entry.n += 1;
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > windowMs) hits.delete(k);
    return entry.n > limit;
  };
}

function mountPlayerRoutes(app, { express, db, ready, getUser, log = console, limited = createRateLimit() }) {
  const json = express.json({ limit: "4kb" });
  const dbReady = async () => Boolean(db) && await ready;
  app.get("/api/survey", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = getUser(req);
    if (!user || !user.id || !await dbReady()) return res.json({ ok: true, survey: null });
    try { res.json({ ok: true, survey: await current(db, user.id) }); }
    catch (error) { log.error("[sondage] current:", error.message); res.json({ ok: false, survey: null }); }
  });
  const post = (path, work) => app.post(path, json, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = getUser(req);
    if (!user || !user.id) return res.status(401).json({ ok: false, error: "login" });
    const origin = req.get("origin");
    let host = "";
    try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
    if (!origin || host !== req.get("host")) return res.status(403).json({ ok: false, error: "origin_denied" });
    const id = Number(req.body && req.body.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "bad_id" });
    if (limited(String(user.id))) { res.set("Retry-After", "60"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    if (!await dbReady()) return res.status(503).json({ ok: false, error: "unavailable" });
    try { res.json(await work(user.id, id, req.body || {})); }
    catch (error) { log.error("[sondage] " + path + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  });
  post("/api/survey/seen", (me, id) => markSeen(db, me, id));
  post("/api/survey/skip", (me, id) => skip(db, me, id));
  post("/api/survey/answer", (me, id, body) => answer(db, me, { id, a1: body.a1, a2: body.a2, comment: body.comment }));
}

module.exports = { COMMENT_MAX, LIVE_DAYS, KEEP_DAYS, FACES, FIRST_SURVEY, cleanComment, ensureTables, current, markSeen, skip, answer, create, stop, adminState, surveyText, adminSectionHtml, mountPlayerRoutes };
