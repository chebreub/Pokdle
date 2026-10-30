# contour.py <art.png> <palette-json> -> JSON {outline:[[x,y]...], details:[[...]], fill:[x,y], color:i} in 0..1000
import sys, json
import numpy as np
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); N = 140
a = np.array(im.resize((N, N), Image.LANCZOS)).astype(float)
mask = a[:, :, 3] > 140
ys, xs = np.nonzero(mask)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
sc = 760 / max(x1 - x0, y1 - y0); ox = 500 - (x0 + x1) / 2 * sc; oy = 520 - (y0 + y1) / 2 * sc
P = lambda x, y: [round(x * sc + ox), round(y * sc + oy)]
def trace(m):
    H, W = m.shape
    pad = np.zeros((H + 2, W + 2), bool); pad[1:-1, 1:-1] = m
    sy, sx = map(int, np.argwhere(pad)[0])
    nb = [(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]
    pts = [(sx, sy)]; cy, cx = sy, sx; d = 6
    for _ in range(20000):
        for k in range(8):
            dd = (d + k) % 8; ny, nx = cy + nb[dd][0], cx + nb[dd][1]
            if pad[ny, nx]: cy, cx = ny, nx; d = (dd + 5) % 8; break
        if (cy, cx) == (sy, sx): break
        pts.append((cx, cy))
    return [(x - 1, y - 1) for x, y in pts]
out = trace(mask)
step = max(2, len(out) // 90)
outline = [P(x, y) for x, y in out[::step]] + [P(*out[0])]
# inner details: strong dark edges inside the body (eyes, markings)
rgb = a[:, :, :3]; lum = rgb.mean(2)
dark = mask & (lum < 70)
inner = np.zeros_like(dark); inner[2:-2, 2:-2] = dark[2:-2, 2:-2] & mask[:-4, 2:-2] & mask[4:, 2:-2] & mask[2:-2, :-4] & mask[2:-2, 4:]
details = [P(int(x), int(y)) for y, x in np.argwhere(inner)[::7]][:40]
# fill point: opaque pixel nearest the centre of mass, colour: nearest palette entry to the median colour
cy, cx = ys.mean(), xs.mean()
k = np.argmin((ys - cy) ** 2 + (xs - cx) ** 2); fx, fy = xs[k], ys[k]
med = np.median(rgb[mask & (lum > 60)], axis=0)
pal = [tuple(int(c[i:i+2], 16) for i in (1, 3, 5)) for c in json.loads(sys.argv[2])]
ci = int(np.argmin([sum((med[j] - p[j]) ** 2 for j in range(3)) for p in pal[1:]])) + 1
print(json.dumps({'outline': outline, 'details': details, 'fill': P(fx, fy), 'color': ci, 'median': med.tolist()}))
