# Prépare les dessins de « Dessine-le ! » pour pub/dessin.js : le trait seul (fond transparent) et
# l'ordre d'apparition de chaque pixel (on suit le trait de proche en proche), pour le retracer.
# python3 pub/dessin-prep.py  →  assets/dessin/ink-N.png, order-N.png
import sys
from collections import deque
from PIL import Image
SRC = '../../docs/promo/dessine-le/'
CROPS = {1: ('1-zebibron.png', (24, 84, 726, 610)), 2: ('2-pimito.png', (14, 14, 728, 548)),
         3: ('4-ethernatos.png', (22, 94, 724, 620)), 4: ('3-miraidon.png', (18, 120, 720, 644)),
         5: ('5-luxray.png', (44, 90, 368, 326))}
for n, (f, box) in CROPS.items():
    im = Image.open(SRC + f).convert('RGB').crop(box)
    W, H = im.size; px = im.load()
    ink = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]; lum = (r + g + b) / 3
            ink[y][x] = lum < 125 or (max(r, g, b) - min(r, g, b) > 70 and lum < 200)
    order = [[-1] * W for _ in range(H)]; k = 0
    for x0 in range(W):  # strokes from left to right, each one followed from its first pixel
        for y0 in range(H):
            if not ink[y0][x0] or order[y0][x0] >= 0: continue
            q = deque([(x0, y0)]); order[y0][x0] = k
            while q:
                x, y = q.popleft(); order[y][x] = k; k += 1
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H and ink[ny][nx] and order[ny][nx] < 0:
                            order[ny][nx] = 0; q.append((nx, ny))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); od = Image.new('L', (W, H), 0)
    for y in range(H):
        for x in range(W):
            if ink[y][x]:
                out.putpixel((x, y), px[x, y] + (255,)); od.putpixel((x, y), 1 + int(254 * order[y][x] / max(1, k - 1)))
    out.save(f'assets/dessin/ink-{n}.png'); od.save(f'assets/dessin/order-{n}.png')
    print(n, W, H, k)
