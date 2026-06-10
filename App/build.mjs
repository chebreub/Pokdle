// Minification des assets (JS + CSS) vers dist/ (chantier 3) + index versionnée (lot A audit).
// IMPORTANT : bundle:false + minifyIdentifiers:false -> aucun identifiant top-level
// n'est renommé. Les fonctions globales (window[nom]) utilisées par la délégation
// data-action restent donc intactes. Aucune transpilation (pas d'ES6 -> ES5).
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";

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

// Génère dist/index.html : mêmes contenus que index.html mais avec des URLs
// versionnées (?v=<hash du contenu>) sur les assets dist/. Combiné au
// Cache-Control immutable côté serveur, le navigateur ne re-télécharge un
// asset que si son contenu a changé.
const html = readFileSync("index.html", "utf8");
const versioned = html.replace(/(["'])dist\/([\w.-]+\.min\.(?:js|css))\1/g, (_m, quote, file) => {
  const hash = createHash("md5").update(readFileSync(`dist/${file}`)).digest("hex").slice(0, 10);
  return `${quote}dist/${file}?v=${hash}${quote}`;
});
writeFileSync("dist/index.html", versioned);

console.log("[build] JS + CSS minifies + dist/index.html versionnee -> dist/");
