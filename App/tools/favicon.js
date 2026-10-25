// Builds favicon.ico from favicon.svg: the same Poké Ball at 16, 32 and 48 px. Search
// engines show the icon next to each result; they ask for /favicon.ico or a real file
// (not a data: URI), and Google wants a multiple of 48 px. Run it again after changing
// favicon.svg:
//   node tools/favicon.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SIZES = [16, 32, 48];

(async () => {
  const svg = fs.readFileSync(path.join(ROOT, "favicon.svg"));
  const images = await Promise.all(SIZES.map((size) => sharp(svg, { density: 600 }).resize(size, size).png().toBuffer()));
  // ICO: a 6-byte header, one 16-byte entry per image, then the PNG files one after another.
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(SIZES[i], at);
    header.writeUInt8(SIZES[i], at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  const ico = Buffer.concat([header, ...images]);
  fs.writeFileSync(path.join(ROOT, "favicon.ico"), ico);
  console.log("[favicon] favicon.ico " + SIZES.join(", ") + " px, " + ico.length + " bytes");
})().catch((error) => { console.error(error); process.exit(1); });
