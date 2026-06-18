// Minification des assets (JS + CSS) vers dist/ (chantier 3) + index versionnée (lot A audit).
// IMPORTANT : bundle:false + minifyIdentifiers:false -> aucun identifiant top-level
// n'est renommé. Les fonctions globales (window[nom]) utilisées par la délégation
// data-action restent donc intactes. Aucune transpilation (pas d'ES6 -> ES5).
import { transform } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { createHash } from "crypto";
import { basename, extname } from "path";

mkdirSync("dist", { recursive: true });

// === Recollage de script.js depuis ses morceaux source (App/src/script.NN.*.js) ===
// script.js est un fichier GÉNÉRÉ : on édite les morceaux dans src/, jamais script.js.
// Le serveur (server.js) et la minification lisent ce script.js recollé.
try {
  const parts = readdirSync("src").filter((f) => /^script\.\d+.*\.js$/.test(f)).sort();
  if (parts.length) {
    const merged = parts.map((f) => readFileSync(`src/${f}`, "utf8")).join("");
    if (merged.length > 1000) {
      writeFileSync("script.js", merged);
      console.log(`[build] script.js recollé depuis ${parts.length} morceaux (${merged.length} octets).`);
    }
  }
} catch (e) { console.error("[build] concat src ignoré:", e.message); }

async function minifyAsset(file, loader, options = {}) {
  const ext = extname(file);
  const name = basename(file, ext);
  const source = readFileSync(file, "utf8");
  const result = await transform(source, {
    loader,
    charset: "utf8",
    legalComments: "none",
    ...options,
  });
  writeFileSync(`dist/${name}.min${ext}`, result.code);
}

for (const file of ["script.js", "pokemon.js"]) {
  await minifyAsset(file, "js", {
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
  });
}

for (const file of ["style.css", "nav.css", "pokedex.css", "multiplayer.css", "home.css", "party-room.css", "profile.css"]) {
  await minifyAsset(file, "css", { minify: true });
}

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
