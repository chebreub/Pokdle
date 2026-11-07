#!/usr/bin/env python3
"""V2-PERF-01 (8/11/2026) : vignettes WebP 192 px des artworks officiels de la bande « À plusieurs » de l'accueil.
Avant : 4 PNG 475 px servis par jsDelivr (≈ 460 Ko). Usage : python3 tools/home-art.py (depuis App/)."""
import io, pathlib, urllib.request
from PIL import Image
IDS = [235, 132, 201, 479]
OUT = pathlib.Path(__file__).resolve().parent.parent / "img" / "home"
OUT.mkdir(parents=True, exist_ok=True)
for pid in IDS:
    url = f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{pid}.png"
    im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert("RGBA")
    # Même cadrage que l'artwork d'origine (pas de recadrage) : seule la taille et le format changent.
    im.resize((192, 192), Image.LANCZOS).save(OUT / f"{pid}.webp", "WEBP", quality=82, method=6)
    print(pid, (OUT / f"{pid}.webp").stat().st_size)
