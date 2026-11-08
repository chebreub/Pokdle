#!/usr/bin/env python3
"""V2-PERF-03 (8/11/2026) : vignettes WebP 256 px des artworks officiels des tuiles de mini-jeux (MODE_TILE_THEME,
src/script.08.catalog.js), servies par le site. Avant : PNG 475 px via jsDelivr (≈ 140 Ko chacun).
Même cadrage que l'artwork d'origine, aucune image IA. Usage : python3 tools/tile-art.py (depuis App/)."""
import io, pathlib, re, urllib.request
from PIL import Image
APP = pathlib.Path(__file__).resolve().parent.parent
src = (APP / "src" / "script.08.catalog.js").read_text(encoding="utf-8")
block = src[src.index("var MODE_TILE_THEME"):src.index("var MODE_TILE_PROPS")]
ids = sorted({int(n) for group in re.findall(r"ids:\[([\d,]+)\]", block) for n in group.split(",")})
OUT = APP / "img" / "art"
OUT.mkdir(parents=True, exist_ok=True)
total = 0
for pid in ids:
    url = f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{pid}.png"
    im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert("RGBA")
    im.resize((256, 256), Image.LANCZOS).save(OUT / f"{pid}.webp", "WEBP", quality=82, method=6)
    total += (OUT / f"{pid}.webp").stat().st_size
print(len(ids), "images,", round(total / 1024), "Ko")
