// Minification des assets (JS + CSS) vers dist/ (chantier 3).
// IMPORTANT : bundle:false + minifyIdentifiers:false -> aucun identifiant top-level
// n'est renommé. Les fonctions globales (window[nom]) utilisées par la délégation
// data-action restent donc intactes. Aucune transpilation (pas d'ES6 -> ES5).
import { build } from "esbuild";
import { mkdirSync } from "fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["script.js", "pokemon.js"],
  outdir: "dist",
  entryNames: "[name].min",
  bundle: false,
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false,
  legalComments: "none",
  charset: "utf8",
  logLevel: "info",
});

await build({
  entryPoints: ["style.css", "nav.css", "pokedex.css", "multiplayer.css", "home.css", "party-room.css", "profile.css"],
  outdir: "dist",
  entryNames: "[name].min",
  bundle: false,
  minify: true,
  charset: "utf8",
  logLevel: "info",
});

console.log("[build] JS + CSS minifies -> dist/");
