// Reprend la Poké Ball du favicon existant, sur le fond crème du site.
// Le symbole reste dans la zone sûre circulaire des icônes Android maskable.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const destination = new URL('../img/app-icons/', import.meta.url);
await mkdir(destination, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FFF8EF"/>
  <g transform="translate(64 64) scale(6)">
    <circle cx="32" cy="32" r="30" fill="white"/>
    <path d="M2 32a30 30 0 0 1 60 0Z" fill="#ef4438"/>
    <path d="M2 32h60" stroke="#1b315f" stroke-width="6"/>
    <circle cx="32" cy="32" r="9" fill="white" stroke="#1b315f" stroke-width="6"/>
  </g>
</svg>`;
for (const size of [180, 192, 512]) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).removeAlpha().png().toBuffer();
  await writeFile(new URL(`pokedle-${size}-v1.png`, destination), png);
}
