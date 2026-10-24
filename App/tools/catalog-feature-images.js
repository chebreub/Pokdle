// Builds img/modes/<feature>-v2-{960,480}.webp, the pictures of the catalogue's « À la une »
// banner, from official artwork only, in the style of the catalogue cards: a dotted pastel
// field, big Pokémon and the game's mechanic. Run: node tools/catalog-feature-images.js
// The banner crops the middle band on desktop, so every subject stays between y=150 and 490.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT_DIR = path.join(__dirname, "..", "img", "modes");
const ARTWORK = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const W = 960, H = 640;

async function artworkOf(id, size) {
  const response = await fetch(ARTWORK(id), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(id + ": artwork HTTP " + response.status);
  return sharp(Buffer.from(await response.arrayBuffer())).trim().resize(size, size, { fit: "inside" }).png().toBuffer();
}
// The same Pokémon in one flat colour, like the silhouette of the daily card.
async function silhouetteOf(id, size, colour) {
  const art = await artworkOf(id, size);
  const { width, height } = await sharp(art).metadata();
  return sharp({ create: { width, height, channels: 3, background: colour } })
    .joinChannel(await sharp(art).extractChannel(3).toBuffer()).png().toBuffer();
}
function field(soft, dot, shapes) {
  let dots = "";
  for (let y = 16; y < H; y += 32) {
    for (let x = 16 + ((y - 16) / 32 % 2 ? 16 : 0); x < W; x += 32) dots += `<circle cx="${x}" cy="${y}" r="2.6"/>`;
  }
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs>
  <rect width="${W}" height="${H}" fill="${soft}"/><g fill="${dot}">${dots}</g>${shapes}
</svg>`;
}
const shadowRect = (x, y, w, h, r) => `<rect x="${x + 5}" y="${y + 10}" width="${w}" height="${h}" rx="${r}" fill="#3a2a10" fill-opacity="0.16" filter="url(#soft)"/>`;
async function centred(input, cx, bottom) {
  const { width, height } = await sharp(input).metadata();
  return { input, left: Math.round(cx - width / 2), top: Math.round(bottom - height) };
}

async function daily() {
  // A mystery silhouette (Dracolosse, as on the daily card) and the « ? » of its card.
  const shapes = `<circle cx="480" cy="320" r="182" fill="#ffffff" fill-opacity="0.55"/><circle cx="480" cy="320" r="160" fill="#ffffff"/>`;
  const svg = await sharp(Buffer.from(field("#fff1c7", "#f6e2a0", shapes))).png().toBuffer();
  const mystery = await silhouetteOf(149, 250, "#2b3a63");
  const layers = [await centred(mystery, 470, 440)];
  // The « ? » card sits in front of the silhouette.
  const badge = await sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${shadowRect(588, 380, 104, 104, 30)}<rect x="588" y="380" width="104" height="104" rx="30" fill="#ffffff"/><text x="640" y="455" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="70" fill="#8a5a00">?</text></svg>`)).png().toBuffer();
  layers.push({ input: badge, left: 0, top: 0 });
  return sharp(svg).composite(layers);
}

async function connections() {
  // Évoli and three evolutions on the four group colours of the game.
  const tiles = [["#f9df6d", 133], ["#a0c35a", 196], ["#b0c4ef", 197], ["#ba81c5", 700]];
  const size = 188, gap = 26, top = 238, left = (W - (4 * size + 3 * gap)) / 2;
  const shapes = tiles.map(([colour], i) => {
    const x = left + i * (size + gap);
    return shadowRect(x, top, size, size, 30) + `<rect x="${x}" y="${top}" width="${size}" height="${size}" rx="30" fill="${colour}"/>`;
  }).join("");
  const layers = [];
  for (const [i, [, id]] of tiles.entries()) layers.push(await centred(await artworkOf(id, 210), left + i * (size + gap) + size / 2, top + size - 18));
  return sharp(Buffer.from(field("#fce6f0", "#f6d3e3", shapes))).composite(layers);
}

async function draft() {
  // Three draft picks: Gardevoir, Lucario and Corvaillus, each on its card.
  const picks = [[282, "#f3e8ff"], [448, "#e3f0ff"], [823, "#e9ecf6"]];
  const cw = 230, ch = 300, gap = 34, top = 168, left = (W - (3 * cw + 2 * gap)) / 2;
  const shapes = picks.map(([, tint], i) => {
    const x = left + i * (cw + gap);
    return shadowRect(x, top, cw, ch, 28) + `<rect x="${x}" y="${top}" width="${cw}" height="${ch}" rx="28" fill="#ffffff"/>` +
      `<rect x="${x + 14}" y="${top + 14}" width="${cw - 28}" height="${ch - 64}" rx="20" fill="${tint}"/>` +
      `<rect x="${x + cw / 2 - 34}" y="${top + ch - 36}" width="68" height="12" rx="6" fill="#2f51b8" fill-opacity="${0.35 + i * 0.2}"/>`;
  }).join("");
  const layers = [];
  for (const [i, [id]] of picks.entries()) layers.push(await centred(await artworkOf(id, 200), left + i * (cw + gap) + cw / 2, top + ch - 62));
  return sharp(Buffer.from(field("#e4ecff", "#cfdcfb", shapes))).composite(layers);
}

(async () => {
  for (const [name, build] of [["daily", daily], ["connections", connections], ["draft", draft]]) {
    const png = await (await build()).png().toBuffer();
    await sharp(png).webp({ quality: 82 }).toFile(path.join(OUT_DIR, name + "-v2-960.webp"));
    await sharp(png).resize(480).webp({ quality: 82 }).toFile(path.join(OUT_DIR, name + "-v2-480.webp"));
    console.log("[feature] " + name);
  }
})().catch((error) => { console.error(error); process.exit(1); });
