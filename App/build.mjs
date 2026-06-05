// Minification des assets JS vers dist/ (chantier 3).
// IMPORTANT : bundle:false + minifyIdentifiers:false -> aucun identifiant top-level
// n'est renommé. Les fonctions globales (window[nom]) utilisées par la délégation
// data-action restent donc intactes. Aucune transpilation (pas d'ES6 -> ES5).
// Les CSS ne sont volontairement PAS minifiés : style.css contient une erreur de
// syntaxe pré-existante que le parseur CSS d'esbuild rejette ; on les sert tels quels.
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

console.log("[build] JS minifie -> dist/");
