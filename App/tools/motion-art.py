#!/usr/bin/env python3
"""Accueil en mouvement (8/11/2026) : petites vignettes WebP 128 px des Pokémon secondaires des tuiles
animées de l'accueil (img/motion/). Faites à partir des artworks déjà rangés dans img/art (256 px), sans recadrage.
Usage : python3 tools/motion-art.py (depuis App/)."""
import pathlib
from PIL import Image
IDS = [4, 6]  # les autres Pokémon des tuiles sont leurs images actuelles (img/art)
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "img" / "motion"
OUT.mkdir(parents=True, exist_ok=True)
for pid in IDS:
    im = Image.open(ROOT / "img" / "art" / f"{pid}.webp").convert("RGBA")
    im.resize((128, 128), Image.LANCZOS).save(OUT / f"{pid}.webp", "WEBP", quality=82, method=6)
    print(pid, (OUT / f"{pid}.webp").stat().st_size)
