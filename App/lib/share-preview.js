"use strict";
// A shared daily result (/?defi=<number>-<attempts>): the home page, with a link preview that
// says what the friend did, so it reads as a challenge in WhatsApp, Discord or a text message.
// The page itself opens the Pokémon du jour (src/script.10z.landing-links.js).

function parseChallenge(code) {
  const match = /^(\d{1,5})-(\d{1,2})$/.exec(typeof code === "string" ? code : "");
  if (!match) return null;
  const number = Number(match[1]), attempts = Number(match[2]);
  return number >= 1 && attempts >= 1 ? { number, attempts } : null;
}

function challengeTexts({ number, attempts }) {
  return {
    title: `Trouvé en ${attempts} essai${attempts > 1 ? "s" : ""} : à toi de faire mieux !`,
    description: `Pokémon du jour n°${number} sur Pokédle : un Pokémon mystère à deviner avec des indices. Gratuit, sans inscription.`,
  };
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function challengePageHtml(html, challenge) {
  const { title, description } = challengeTexts(challenge);
  const meta = (attribute, name, value) => {
    const pattern = new RegExp(`(<meta ${attribute}="${name}" content=")[^"]*(")`);
    html = html.replace(pattern, (_m, start, end) => start + escapeAttribute(value) + end);
  };
  meta("property", "og:title", title);
  meta("property", "og:description", description);
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", description);
  // One link per player and per day: never a page of its own for search engines.
  return html.replace('<link rel="canonical"', '<meta name="robots" content="noindex">\n  <link rel="canonical"');
}

module.exports = { parseChallenge, challengeTexts, challengePageHtml };
