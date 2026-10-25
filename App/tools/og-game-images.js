// Builds img/og/<slug>.jpg, the link preview of each game page (/jeux/<slug>), in the
// style of the daily /og-image.png: same gradient and white circle, with the game's
// mascot in colour and its name. Run it again after adding or renaming a game:
//   node tools/og-game-images.js
// The Pokémon du jour page keeps the daily silhouette (/og-image.png).
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { GAMES } = require("../lib/seo-games");

const OUT_DIR = path.join(__dirname, "..", "img", "og");
const ARTWORK = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Greedy wrap by characters: the SVG renderer cannot measure text.
function wrap(text, max, lines) {
  const out = [];
  for (const word of String(text).split(" ")) {
    const last = out[out.length - 1];
    if (last && (last + " " + word).length <= max) out[out.length - 1] = last + " " + word;
    else out.push(word);
  }
  if (out.length > lines) out.splice(lines - 1, out.length, out.slice(lines - 1).join(" ").slice(0, max - 1) + "…");
  return out;
}

function svgFor(game) {
  const name = wrap(game.name, 15, 2);
  // One word longer than a line (« Poké-Connections ») gets a smaller size instead of reaching the circle.
  const nameSize = name.some((line) => line.length > 15) ? 54 : 64;
  const short = wrap(game.short, 30, 3);
  const nameTop = name.length > 1 ? 232 : 262;
  const shortTop = nameTop + name.length * 72 + 20;
  const text = (lines, x, y, step, attrs) => lines.map((line, i) => `<text x="${x}" y="${y + i * step}" ${attrs}>${esc(line)}</text>`).join("");
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
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
  <text x="80" y="150" font-family="Inter, sans-serif" font-weight="bold" font-size="56" fill="#ffffff">Pokédle</text>
  ${text(name, 80, nameTop, 72, `font-family="Inter, sans-serif" font-weight="800" font-size="${nameSize}" fill="#ffe9b3"`)}
  ${text(short, 82, shortTop, 40, 'font-family="Inter, sans-serif" font-weight="500" font-size="30" fill="#ffffff"')}
  <text x="82" y="575" font-family="Inter, sans-serif" font-size="26" fill="#dce9ff">pokdle.fr</text>
</svg>`;
}

async function artworkOf(id, size) {
  const response = await fetch(ARTWORK(id), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(id + ": artwork HTTP " + response.status);
  return sharp(Buffer.from(await response.arrayBuffer())).trim().resize(size, size, { fit: "inside" }).png().toBuffer();
}

async function build(game) {
  const artwork = await artworkOf(game.sprite, 380);
  const { width, height } = await sharp(artwork).metadata();
  await sharp(Buffer.from(svgFor(game)))
    .composite([{ input: artwork, left: Math.round(885 - width / 2), top: Math.round(318 - height / 2) }])
    .jpeg({ quality: 84, progressive: true, mozjpeg: true })
    .toFile(path.join(OUT_DIR, game.slug + ".jpg"));
}

// Poké-Connections shows its rule instead: Évoli and three evolutions on the four group colours.
async function buildConnections() {
  const tiles = [["#f9df6d", 133], ["#a0c35a", 196], ["#b0c4ef", 197], ["#ba81c5", 700]];
  const size = 245, gap = 32, top = 222, left = (1200 - (4 * size + 3 * gap)) / 2;
  let dots = "";
  for (let y = 18; y < 630; y += 36) {
    for (let x = 18 + ((y - 18) / 36 % 2 ? 18 : 0); x < 1200; x += 36) dots += `<circle cx="${x}" cy="${y}" r="3"/>`;
  }
  const rects = tiles.map(([colour], i) => {
    const x = left + i * (size + gap);
    return `<rect x="${x + 6}" y="${top + 12}" width="${size}" height="${size}" rx="34" fill="#78405a" fill-opacity="0.24" filter="url(#soft)"/>` +
      `<rect x="${x}" y="${top}" width="${size}" height="${size}" rx="34" fill="${colour}"/>`;
  }).join("");
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter></defs>
  <rect width="1200" height="630" fill="#fce6f0"/><g fill="#f6d3e3">${dots}</g>${rects}
</svg>`;
  const layers = [];
  for (const [i, [, id]] of tiles.entries()) {
    const art = await artworkOf(id, 270);
    const { width, height } = await sharp(art).metadata();
    layers.push({ input: art, left: Math.round(left + i * (size + gap) + (size - width) / 2), top: top + size - height - 26 });
  }
  await sharp(Buffer.from(svg)).composite(layers)
    .jpeg({ quality: 84, progressive: true, mozjpeg: true })
    .toFile(path.join(OUT_DIR, "poke-connections.jpg"));
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const game of GAMES.filter((g) => !g.ogImage)) {
    await (game.slug === "poke-connections" ? buildConnections() : build(game));
    console.log("[og] " + game.slug);
  }
})().catch((error) => { console.error(error); process.exit(1); });
