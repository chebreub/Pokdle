"use strict";

// 🌐 Accueil en anglais (/en) et en espagnol (/es), 14/11/2026.
// La même page que « / » : seuls l'en-tête (titre, description, aperçu de partage, adresse canonique, données
// structurées) et le H1 sont écrits dans la langue, pour que Google puisse montrer un accueil par langue.
// Le reste de l'écran est traduit dans le navigateur (src/script.10zzzzr.i18n-dom.js), qui lit la langue dans l'adresse.
const SITE = "https://pokdle.fr";
const LANGS = ["en", "es"];
const PATHS = { fr: "/", en: "/en", es: "/es" };
const FR = {
  title: "Pokédle · Pokémon du jour, quiz et jeux Pokémon gratuits",
  description: "Devine le Pokémon du jour, résous la Grille, joue au Petit Bac entre amis et à plus de 20 jeux Pokémon gratuits, sans pub ni inscription.",
  shareTitle: "Pokédle · Pokémon du jour et jeux Pokémon gratuits",
  shareDescription: "Devine le Pokémon du jour, résous la Grille, joue au Petit Bac entre amis et à plus de 20 jeux Pokémon gratuits.",
  h1: "Le Pokémon du jour à deviner, et plein de mini-jeux Pokémon",
  sub: "Ta pause Pokémon du jour : un Pokémon mystère à trouver avec des indices, puis des quiz et des défis entre amis. Gratuit, sans pub, sans compte.",
  siteDescription: "Jeux Pokémon gratuits : Pokémon du jour, Grille, Petit Bac, quiz et Party Room entre amis.",
  appDescription: "Un Pokémon mystère à deviner chaque jour, et plus de 20 mini-jeux Pokémon en français à jouer seul ou entre amis : Grille, Petit Bac, quiz, Qui est-ce, Pokédex et table des types.",
  genre: '["Jeu de devinettes","Quiz","Jeu entre amis"]',
  platform: "Navigateur web",
  locale: "fr_FR",
};
const TEXTS = {
  en: {
    title: "Pokédle · Pokémon of the day, quizzes and free Pokémon games",
    description: "Guess the Pokémon of the day, solve the Pokémon Wordle, play with friends and try more than 20 free Pokémon games. No ads, no sign-up.",
    shareTitle: "Pokédle · Pokémon of the day and free Pokémon games",
    shareDescription: "Guess the Pokémon of the day, solve the Pokémon Wordle, play with friends and try more than 20 free Pokémon games.",
    h1: "Guess the Pokémon of the day, and play lots of Pokémon mini-games",
    sub: "Your daily Pokémon break: a mystery Pokémon to find with clues, then quizzes and challenges with friends. Free, no ads, no account.",
    siteDescription: "Free Pokémon games: Pokémon of the day, Wordle, quizzes and a Party Room to play with friends.",
    appDescription: "A mystery Pokémon to guess every day, and more than 20 Pokémon mini-games to play alone or with friends: Wordle, quizzes, Who is it?, Pokédex and type chart.",
    genre: '["Guessing game","Quiz","Party game"]',
    platform: "Web browser",
    locale: "en_GB",
  },
  es: {
    title: "Pokédle · Pokémon del día, quiz y juegos Pokémon gratis",
    description: "Adivina el Pokémon del día, resuelve el Wordle Pokémon, juega con amigos y prueba más de 20 juegos Pokémon gratis. Sin anuncios ni registro.",
    shareTitle: "Pokédle · Pokémon del día y juegos Pokémon gratis",
    shareDescription: "Adivina el Pokémon del día, resuelve el Wordle Pokémon, juega con amigos y prueba más de 20 juegos Pokémon gratis.",
    h1: "Adivina el Pokémon del día y juega a un montón de minijuegos Pokémon",
    sub: "Tu pausa Pokémon del día: un Pokémon misterioso que encontrar con pistas, y luego quiz y retos con amigos. Gratis, sin anuncios, sin cuenta.",
    siteDescription: "Juegos Pokémon gratis: Pokémon del día, Wordle, quiz y Party Room para jugar con amigos.",
    appDescription: "Un Pokémon misterioso que adivinar cada día y más de 20 minijuegos Pokémon para jugar solo o con amigos: Wordle, quiz, ¿Quién es?, Pokédex y tabla de tipos.",
    genre: '["Juego de adivinanzas","Quiz","Juego entre amigos"]',
    platform: "Navegador web",
    locale: "es_ES",
  },
};

// Les balises hreflang, les mêmes sur les trois accueils (elles sont aussi écrites dans index.html pour « / »).
function hreflangTags() {
  return ["fr", "en", "es"].map(l => '<link rel="alternate" hreflang="' + l + '" href="' + SITE + PATHS[l] + '">').join("\n  ") +
    '\n  <link rel="alternate" hreflang="x-default" href="' + SITE + '/">';
}

function swap(html, from, to) {
  if (!html.includes(from)) throw new Error("home_i18n_missing:" + from.slice(0, 40));
  return html.split(from).join(to);
}

// L'accueil français → le même accueil présenté en anglais ou en espagnol.
function homeHtml(html, lang) {
  const T = TEXTS[lang];
  if (!T) return html;
  const url = SITE + PATHS[lang];
  let out = swap(html, '<html lang="fr">', '<html lang="' + lang + '">');
  out = swap(out, "<title>" + FR.title + "</title>", "<title>" + T.title + "</title>");
  out = swap(out, 'name="description" content="' + FR.description + '"', 'name="description" content="' + T.description + '"');
  out = swap(out, 'content="' + FR.shareTitle + '"', 'content="' + T.shareTitle + '"');
  out = swap(out, 'content="' + FR.shareDescription + '"', 'content="' + T.shareDescription + '"');
  out = swap(out, 'property="og:url" content="' + SITE + '/"', 'property="og:url" content="' + url + '"');
  out = swap(out, 'property="og:locale" content="' + FR.locale + '"', 'property="og:locale" content="' + T.locale + '"');
  out = swap(out, '<link rel="canonical" href="' + SITE + '/">', '<link rel="canonical" href="' + url + '">');
  // Données structurées : même site (@id inchangé), décrit dans la langue de la page.
  out = swap(out, '"url":"' + SITE + '/","isPartOf"', '"url":"' + url + '","isPartOf"');
  out = swap(out, '"description":"' + FR.siteDescription + '"', '"description":"' + T.siteDescription + '"');
  out = swap(out, '"description":"' + FR.appDescription + '"', '"description":"' + T.appDescription + '"');
  out = swap(out, '"genre":' + FR.genre, '"genre":' + T.genre);
  out = swap(out, '"' + FR.platform + '"', '"' + T.platform + '"');
  out = swap(out, '"inLanguage":"fr","isAccessibleForFree"', '"inLanguage":"' + lang + '","isAccessibleForFree"');
  out = swap(out, ">" + FR.h1 + "</h1>", ">" + T.h1 + "</h1>");
  out = swap(out, ">" + FR.sub + "</p>", ">" + T.sub + "</p>");
  return out;
}

module.exports = { SITE, LANGS, PATHS, TEXTS, FR, hreflangTags, homeHtml };
