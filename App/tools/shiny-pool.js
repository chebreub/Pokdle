// Builds shiny-pool.json, the Pokémon used by « Shiny ou normal ? ». Some shinies are
// almost the same colour as the normal Pokémon (a shade lighter, one detail): asking about
// them would be luck, not knowledge. This compares both official artworks and keeps only
// the Pokémon whose shiny is clearly different. Run it again after adding Pokémon:
//   node tools/shiny-pool.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "shiny-pool.json");
const LAST_ID = 1025;
const SIZE = 48;
// Mean colour distance (0-441) over the pixels drawn in both artworks.
const MIN_DIFFERENCE = Number(process.env.SHINY_MIN_DIFFERENCE || 35);
const ARTWORK = (id, shiny) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${shiny ? "shiny/" : ""}${id}.png`;

async function pixels(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + " " + response.status);
  const input = Buffer.from(await response.arrayBuffer());
  return sharp(input).resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
}

function difference(a, b) {
  let total = 0, count = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 128 || b[i + 3] < 128) continue;
    total += Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
    count += 1;
  }
  return count ? total / count : 0;
}

async function main() {
  const scores = new Map();
  const ids = Array.from({ length: LAST_ID }, (_, i) => i + 1);
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        const [normal, shiny] = await Promise.all([pixels(ARTWORK(id, false)), pixels(ARTWORK(id, true))]);
        scores.set(id, difference(normal, shiny));
      } catch (error) {
        console.warn("skip", id, error.message);
      }
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker));
  const kept = ids.filter((id) => scores.get(id) >= MIN_DIFFERENCE);
  fs.writeFileSync(OUT, JSON.stringify({ minDifference: MIN_DIFFERENCE, ids: kept }) + "\n");
  if (process.env.SHINY_SCORES) fs.writeFileSync(process.env.SHINY_SCORES, JSON.stringify(Object.fromEntries(scores)));
  console.log(`${kept.length} / ${scores.size} Pokémon kept (difference ≥ ${MIN_DIFFERENCE})`);
}

main().catch((error) => { console.error(error); process.exit(1); });
