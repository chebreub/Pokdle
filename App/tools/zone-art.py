#!/usr/bin/env python3
"""Décors pixel art des zones des hautes herbes (3/11/2026).

Dessinés ici, pixel par pixel, à 256 × 192 : aucune image reprise d'un jeu ni faite par IA.
Le navigateur les agrandit sans flou (image-rendering: pixelated).

    python3 tools/zone-art.py            # écrit img/zones/<zone>.png
"""
import math
import os
import random

import numpy as np
from PIL import Image

W, H = 256, 192
OUT = os.path.join(os.path.dirname(__file__), "..", "img", "zones")
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.uint8)


class Canvas:
    def __init__(self, seed):
        self.a = np.zeros((H, W, 3), dtype=np.uint8)
        self.rng = random.Random(seed)

    # --- outils de base ---
    def px(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H:
            self.a[y, x] = hexc(c) if isinstance(c, str) else c

    def rect(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(W, int(x1)), min(H, int(y1))
        if x1 > x0 and y1 > y0:
            self.a[y0:y1, x0:x1] = hexc(c)

    def sky(self, stops, y0=0, y1=H):
        """Dégradé en bandes tramées (Bayer), comme les ciels des jeux 16 bits."""
        cols = [hexc(c) for c in stops]
        n = len(cols) - 1
        self.a[int(y1):H] = cols[-1]  # sous le dégradé : la dernière couleur, jamais de trou noir
        for y in range(int(y0), int(y1)):
            t = (y - y0) / max(1, (y1 - y0 - 1)) * n
            i = min(n - 1, int(t))
            f = t - i
            for x in range(W):
                self.a[y, x] = cols[i + 1] if f > BAYER[y % 4, x % 4] else cols[i]

    def dither_band(self, y0, y1, c, density_top=0.0, density_bottom=0.6):
        col = hexc(c)
        for y in range(int(max(0, y0)), int(min(H, y1))):
            d = density_top + (density_bottom - density_top) * (y - y0) / max(1, y1 - y0)
            for x in range(W):
                if d > BAYER[y % 4, x % 4]:
                    self.a[y, x] = col

    def noise(self, seed, scale, octaves=3):
        r = random.Random(seed)
        ph = [(r.random() * 6.28, r.random() * 6.28) for _ in range(octaves)]
        def f(x):
            v, amp, fr = 0.0, 1.0, 1.0
            for k in range(octaves):
                v += amp * (math.sin(x / scale * fr + ph[k][0]) * 0.6 + math.sin(x / scale * fr * 1.7 + ph[k][1]) * 0.4)
                amp *= 0.5
                fr *= 2.1
            return v
        return f

    def ridge(self, base, amp, scale, seed, fill, edge=None, shade=None, octaves=3, peaks=False):
        """Une colline / montagne : un bord bruité, rempli jusqu'en bas, liseré clair et ombres."""
        f = self.noise(seed, scale, octaves)
        tops = []
        for x in range(W):
            v = f(x)
            if peaks:
                v = 1 - abs(v)
            top = int(base - amp * v)
            tops.append(top)
            self.rect(x, top, x + 1, H, fill)
            if edge:
                self.px(x, top, edge)
                if x % 3 == 0:
                    self.px(x, top + 1, edge)
        if shade:
            for x in range(1, W):
                slope = tops[x] - tops[x - 1]
                if slope > 0:  # versant à l'ombre (lumière venant de la gauche)
                    for y in range(tops[x] + 1, min(H, tops[x] + 3 + slope * 3)):
                        if (x + y) % 2 == 0:
                            self.px(x, y, shade)
        return tops

    def ellipse(self, cx, cy, rx, ry, c, outline=None, dither=None):
        col = hexc(c)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 1:
                    if dither is not None and d > 0.72 and dither < BAYER[y % 4, x % 4]:
                        continue
                    if 0 <= x < W and 0 <= y < H:
                        self.a[y, x] = col
                elif outline and d <= 1.18 and 0 <= x < W and 0 <= y < H:
                    self.a[y, x] = hexc(outline)

    def circle(self, cx, cy, r, c):
        self.ellipse(cx, cy, r, r, c)

    def texture(self, y0, y1, cols, density, seed):
        r = random.Random(seed)
        for _ in range(int((y1 - y0) * W * density)):
            x, y = r.randrange(W), r.randrange(int(y0), int(y1))
            self.px(x, y, r.choice(cols))

    def tufts(self, y0, y1, n, dark, light, seed):
        r = random.Random(seed)
        for _ in range(n):
            x, y = r.randrange(W), r.randrange(int(y0), int(y1))
            h = 2 + int((y - y0) / max(1, y1 - y0) * 3)
            for k in range(h):
                self.px(x - 1, y - k + (k // 2), dark)
                self.px(x + 1, y - k + (k // 2), dark)
                self.px(x, y - k - 1, light if k == h - 1 else dark)

    def spot(self, base, rim, light):
        """La plateforme où se pose le Pokémon, comme dans les combats."""
        cx, cy, rx, ry = W * 0.5, H * 0.80, W * 0.28, H * 0.075
        self.ellipse(cx, cy + 1, rx + 2, ry + 1.5, rim)
        self.ellipse(cx, cy, rx, ry, base)
        self.ellipse(cx - rx * 0.18, cy - ry * 0.25, rx * 0.62, ry * 0.45, light, dither=0.5)

    def save(self, name):
        os.makedirs(OUT, exist_ok=True)
        Image.fromarray(self.a).save(os.path.join(OUT, name + ".png"), optimize=True)


# --- petits dessins réutilisés ---
def cloud(c, x, y, s, body="#FFFFFF", shade="#D6E6F5"):
    for dx, dy, r in [(0, 0, 6), (7, -3, 7), (15, 0, 6), (8, 2, 6), (-6, 2, 4), (21, 2, 4)]:
        c.circle(x + dx * s, y + dy * s, r * s, body)
    for x2 in range(int(x - 9 * s), int(x + 25 * s)):
        for y2 in range(int(y + 3 * s), int(y + 8 * s)):
            if (c.a[y2 % H, x2 % W] == hexc(body)).all() and (x2 + y2) % 2 == 0 and 0 <= x2 < W:
                c.px(x2, y2, shade)


def pine(c, x, base, h, dark, mid, light, trunk="#5A3A24"):
    c.rect(x - 1, base - 3, x + 2, base + 1, trunk)
    tiers = 3 if h > 14 else 2
    for t in range(tiers):
        top = base - h + t * h // (tiers + 1)
        bot = base - 2 - (tiers - 1 - t) * h // (tiers + 2)
        for y in range(top, bot + 1):
            half = 1 + (y - top) * (h // 3 + 2) // max(1, bot - top)
            for xx in range(x - half, x + half + 1):
                col = light if xx < x - half // 3 else (mid if xx <= x + half // 3 else dark)
                if xx in (x - half, x + half) or y == bot:
                    col = dark
                c.px(xx, y, col)


def round_tree(c, x, base, r, dark, mid, light, trunk="#6B4428"):
    c.rect(x - 2, base - r, x + 2, base + 1, trunk)
    c.rect(x - 2, base - r, x - 1, base + 1, "#8A5A34")
    for dx, dy, rr in [(0, -r * 1.6, r), (-r * 0.8, -r * 1.2, r * 0.8), (r * 0.8, -r * 1.2, r * 0.8)]:
        c.circle(x + dx, base + dy, rr + 1, dark)
    for dx, dy, rr in [(0, -r * 1.6, r), (-r * 0.8, -r * 1.2, r * 0.8), (r * 0.8, -r * 1.2, r * 0.8)]:
        c.circle(x + dx, base + dy, rr, mid)
    c.circle(x - r * 0.5, base - r * 1.9, r * 0.45, light)


def rock(c, x, y, rx, ry, base, light, dark):
    c.ellipse(x, y, rx, ry, base, outline=dark)
    c.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.4, light)
    for xx in range(int(x - rx), int(x + rx)):
        c.px(xx, int(y + ry * 0.6), dark)


# ===================== les 6 zones =====================
def foret():
    c = Canvas(11)
    c.sky(["#FFF4C9", "#F2F1B8", "#D9EDB0", "#BFE3A6"], 0, 120)
    # rayons de lumière tramés
    for k, x0 in enumerate([150, 186, 214]):
        for y in range(0, 130):
            for w in range(6 + k * 2):
                x = int(x0 - y * 0.55) + w
                if (x + y) % 3 == 0:
                    c.px(x, y, "#FFF8DA")
    c.ridge(92, 10, 40, 1, "#9CC98A", edge="#B5D9A0")
    for x in range(-4, W + 8, 9):
        pine(c, x + c.rng.randint(-2, 2), 96 + c.rng.randint(-3, 3), 18 + c.rng.randint(0, 6), "#6E9E7A", "#82B08A", "#9CC59B", trunk="#6E7D68")
    c.ridge(112, 6, 30, 2, "#6FA35A", edge="#86B96C")
    for x in range(-6, W + 10, 13):
        pine(c, x + c.rng.randint(-3, 3), 118 + c.rng.randint(-2, 4), 26 + c.rng.randint(0, 8), "#2F6A3A", "#3F8045", "#5A9A52")
    c.ridge(130, 4, 50, 3, "#5E9E48", edge="#7DBA5C")
    c.texture(130, H, ["#56933F", "#69A951", "#4E8A3A"], 0.18, 4)
    c.spot("#8FC86A", "#4E8A3A", "#A9D982")
    c.tufts(132, H, 70, "#3E7A34", "#8ACB62", 5)
    # gros troncs qui encadrent la scène
    for x0, w in [(-6, 18), (236, 24)]:
        c.rect(x0, 0, x0 + w, 150, "#4A2E1C")
        c.rect(x0 + 3, 0, x0 + 6, 150, "#6B4428")
        for y in range(4, 150, 7):
            c.px(x0 + w - 4, y, "#33200F")
    c.ellipse(4, 18, 34, 22, "#2F6A3A")
    c.ellipse(250, 12, 40, 24, "#2F6A3A")
    c.ellipse(0, 12, 24, 14, "#3F8045")
    c.ellipse(254, 6, 26, 14, "#3F8045")
    for (x, y, col) in [(60, 170, "#F7D65C"), (70, 176, "#FFFFFF"), (196, 168, "#F08AA8"), (30, 182, "#FFFFFF"), (222, 180, "#F7D65C")]:
        c.px(x, y, col); c.px(x + 1, y, col); c.px(x, y + 1, col); c.px(x + 1, y + 1, "#C98A2A")
    c.save("foret")


def mer():
    c = Canvas(22)
    c.sky(["#7FC4F2", "#9FD3F6", "#C4E6FA", "#E6F5FD"], 0, 86)
    cloud(c, 40, 22, 1.0); cloud(c, 168, 14, 1.3); cloud(c, 214, 40, 0.7)
    # îlot rocheux au loin
    c.ellipse(196, 86, 26, 12, "#8BA3BD"); c.ellipse(190, 80, 12, 9, "#A3B8CF"); c.ellipse(186, 77, 5, 4, "#C3D3E3")
    c.rect(0, 86, W, 128, "#3F97DE")
    c.dither_band(86, 100, "#5FB0EA", 0.6, 0.0)
    c.dither_band(108, 128, "#2B7FCB", 0.0, 0.7)
    r = random.Random(3)
    for _ in range(140):  # reflets du soleil
        x, y = r.randrange(W), r.randrange(88, 126)
        c.px(x, y, "#D9F1FF" if r.random() < 0.5 else "#9FD3F6")
    for row, y in enumerate(range(96, 128, 8)):  # crêtes de vagues
        off = row * 7
        for x in range(-10, W, 26):
            for k in range(8):
                c.px(x + off + k, y - (1 if 2 < k < 6 else 0), "#FFFFFF")
    # plage
    tops = c.ridge(132, 4, 60, 4, "#F3DCA0", edge="#FFF3CF")
    for x in range(W):
        for y in range(tops[x] - 3, tops[x]):
            if (x // 3 + y) % 2 == 0:
                c.px(x, y, "#E6F7FF")
    c.texture(134, H, ["#E3C47E", "#F7E6B6", "#D8B66C"], 0.16, 7)
    c.spot("#FBEBC0", "#D5B06A", "#FFF6DC")
    for (x, y) in [(40, 176), (214, 172), (90, 186)]:
        c.ellipse(x, y, 3, 2, "#F2A7A0", outline="#B86F6A")
    # palmier
    for i in range(70):
        x = 24 + int(math.sin(i / 22) * 8)
        c.rect(x, 150 - i * 2, x + 6, 150 - i * 2 + 2, "#9A6A3E" if (i // 2) % 2 else "#7E5430")
    top = (30, 12)
    for ang in [-160, -130, -95, -60, -25, 10, 35]:
        a = math.radians(ang)
        for t in range(34):
            x = top[0] + math.cos(a) * t
            y = top[1] + math.sin(a) * t * 0.6 + (t * t) / 70
            for w in range(-2, 3):
                c.px(x, y + w, "#3E8E45" if w > 0 else "#5DB050")
            c.px(x, y + 3, "#2B6A33")
    c.save("mer")


def montagne():
    c = Canvas(33)
    c.sky(["#9CC8EE", "#B6D6F1", "#D2E5F4", "#EEF2F2"], 0, 110)
    cloud(c, 30, 30, 0.8, shade="#DCE7F2"); cloud(c, 190, 22, 1.0, shade="#DCE7F2")
    tops = c.ridge(74, 34, 26, 5, "#93A6C2", shade="#7F92AF", octaves=2, peaks=True)
    for x in range(W):  # neige sur les sommets
        if tops[x] < 52:
            for y in range(tops[x], 54 + (x * 7 % 5)):
                c.px(x, y, "#FFFFFF" if (x + y) % 5 else "#DDE7F3")
    tops2 = c.ridge(112, 26, 34, 6, "#9C8770", shade="#7E6A55", octaves=2, peaks=True)
    for x in range(W):
        if tops2[x] < 92:
            for y in range(tops2[x], tops2[x] + 3):
                c.px(x, y, "#EDE6DA")
    for x in range(8, W, 23):
        pine(c, x, 130 + (x * 13) % 6, 14, "#3E6B4A", "#4F7F58", "#6A9A6E")
    c.ridge(136, 5, 40, 7, "#B39A78", edge="#CDB797")
    c.texture(136, H, ["#A08665", "#C2AA86", "#8E765A"], 0.2, 8)
    c.spot("#C9B48F", "#8E765A", "#DCCBA8")
    for (x, y, rx, ry) in [(26, 160, 14, 9), (226, 156, 18, 11), (60, 184, 8, 5), (200, 186, 9, 5)]:
        rock(c, x, y, rx, ry, "#8F8F9A", "#B7B7C2", "#5E5E6A")
    c.tufts(140, H, 30, "#6E8A4A", "#9CBA6A", 9)
    c.save("montagne")


def volcan():
    c = Canvas(44)
    c.sky(["#2A1424", "#5A1E2C", "#9C3428", "#D9652E", "#F08A3A"], 0, 130)
    r = random.Random(5)
    for _ in range(60):  # cendres
        c.px(r.randrange(W), r.randrange(0, 110), "#7A3A3A")
    # fumée
    for (x, y, s) in [(118, 22, 1.2), (140, 10, 1.0), (100, 34, 0.8)]:
        cloud(c, x, y, s, body="#4A2A34", shade="#3A1E28")
    # lueur du cratère
    for rr, col in [(46, "#B8482A"), (34, "#D8652E"), (22, "#F39A3A")]:
        c.ellipse(128, 52, rr, rr * 0.55, col, dither=0.5)
    # le volcan
    for y in range(50, 150):
        half = 18 + (y - 50) * 1.15
        for x in range(int(128 - half), int(128 + half)):
            col = "#4B2A2A" if x < 128 - half * 0.25 else ("#3A1F22" if x < 128 + half * 0.3 else "#2C171A")
            c.px(x, y, col)
    c.ellipse(128, 51, 18, 4, "#FFC65C"); c.ellipse(128, 51, 12, 2, "#FFF0A0")
    # coulées de lave
    for x0, drift in [(124, -0.35), (134, 0.3)]:
        x = x0
        for y in range(54, 150):
            x += drift + math.sin(y / 6) * 0.5
            w = 2 + (y - 54) // 40
            for k in range(-w, w + 1):
                c.px(x + k, y, "#FFE27A" if abs(k) < w - 1 else "#F0602A")
    c.ridge(150, 5, 30, 9, "#2E1A1C", edge="#4A2A2A")
    c.texture(150, H, ["#3A2224", "#24120F", "#4A2A2A"], 0.2, 10)
    # fissures de lave au sol
    r = random.Random(7)
    for _ in range(6):
        x, y = r.randrange(10, W - 10), r.randrange(160, H - 4)
        for k in range(r.randrange(8, 18)):
            x += r.choice([-1, 0, 1]); y += r.choice([0, 0, 1, -1])
            c.px(x, y, "#F0602A"); c.px(x, y - 1, "#FFB347")
    c.spot("#3E2526", "#F0602A", "#57373A")
    for _ in range(40):  # braises
        c.px(r.randrange(W), r.randrange(60, 170), r.choice(["#FFD45C", "#FFB347", "#F0602A"]))
    for (x, y, rx, ry) in [(22, 168, 14, 9), (236, 172, 16, 10)]:
        rock(c, x, y, rx, ry, "#3A2A2E", "#5A4448", "#1A1012")
    c.save("volcan")


def tour():
    c = Canvas(55)
    c.sky(["#120E26", "#1E1638", "#2E2252", "#45336E"], 0, 140)
    r = random.Random(9)
    for _ in range(70):
        x, y = r.randrange(W), r.randrange(0, 100)
        c.px(x, y, "#FFFFFF" if r.random() < 0.3 else "#B8AEE0")
    for rr, col in [(30, "#3A2E62"), (24, "#5B4B8A")]:
        c.circle(186, 40, rr, col)
    c.circle(186, 40, 18, "#FFF3C4")
    for (x, y, rr) in [(180, 34, 3), (192, 46, 4), (190, 32, 2)]:
        c.circle(x, y, rr, "#EBDDA6")
    c.ridge(126, 8, 34, 11, "#2A2148", edge="#3A2E62")
    # la tour
    tx = 104
    c.rect(tx, 40, tx + 34, 140, "#1A1430")
    for y in range(44, 140, 6):
        for x in range(tx + (y // 6 % 2) * 4, tx + 34, 8):
            c.rect(x, y, x + 7, y + 1, "#241C40")
    for y in range(18, 40):
        half = (y - 18) * 22 // 22
        c.rect(tx + 17 - half, y, tx + 17 + half + 1, y + 1, "#140F28")
    c.rect(tx - 4, 76, tx + 38, 81, "#140F28")
    for (x, y) in [(tx + 13, 52), (tx + 20, 96)]:
        c.rect(x, y, x + 6, y + 9, "#FFD45C"); c.rect(x + 1, y + 1, x + 3, y + 4, "#FFF0A0")
    c.rect(tx + 12, 124, tx + 22, 140, "#0E0A1E")
    # arbres morts et tombes
    for x0, h in [(26, 44), (220, 52)]:
        c.rect(x0, 140 - h, x0 + 4, 140, "#100C20")
        for k, (dx, dy) in enumerate([(-10, -10), (12, -16), (-6, -24), (8, -30)]):
            for t in range(12):
                c.px(x0 + 2 + dx * t / 12, 140 - h * 0.5 + dy * t / 12 - k * 6, "#100C20")
    for x in [52, 70, 168, 190]:
        c.rect(x, 128, x + 8, 140, "#4A4268"); c.rect(x + 1, 126, x + 7, 128, "#4A4268"); c.rect(x + 3, 130, x + 5, 136, "#2E2850")
    # chauves-souris
    for (x, y) in [(60, 30), (150, 56), (226, 20)]:
        for k in range(-5, 6):
            c.px(x + k, y - abs(k) // 2 + (1 if abs(k) == 5 else 0), "#0E0A1E")
        c.px(x, y + 1, "#0E0A1E")
    c.ridge(140, 4, 40, 12, "#211A3C", edge="#3A2E62")
    c.texture(140, H, ["#1A1430", "#2A2148", "#30285A"], 0.18, 13)
    c.spot("#3A2E62", "#140F28", "#4E4080")
    c.dither_band(128, 150, "#7A6AAE", 0.0, 0.35)  # brume
    c.dither_band(168, H, "#6A5A9E", 0.0, 0.3)
    c.save("tour")


def prairie():
    c = Canvas(66)
    c.sky(["#6EC0F6", "#8FD0FA", "#B6E1FB", "#E2F4FE"], 0, 104)
    cloud(c, 26, 26, 1.1); cloud(c, 150, 16, 0.9); cloud(c, 222, 40, 0.8)
    c.ridge(96, 12, 44, 14, "#A4D98A", edge="#C2EAA6")
    # maison au loin
    hx, hy = 176, 78
    c.rect(hx, hy, hx + 22, hy + 14, "#FFF1DC"); c.rect(hx, hy + 13, hx + 22, hy + 14, "#D8C3A6")
    for y in range(10):
        c.rect(hx - 3 + y, hy - y, hx + 25 - y, hy - y + 1, "#E3350D" if y % 3 else "#B8260A")
    c.rect(hx + 9, hy + 6, hx + 14, hy + 14, "#8A5A3A"); c.rect(hx + 3, hy + 4, hx + 7, hy + 8, "#9FD6FF"); c.rect(hx + 16, hy + 4, hx + 20, hy + 8, "#9FD6FF")
    for x in [40, 70, 120, 228]:
        round_tree(c, x, 100 + (x % 7), 6, "#3F8A45", "#5AAA52", "#86CB6E")
    c.ridge(118, 7, 36, 15, "#86C66A", edge="#A4DA84")
    # clôture
    for x in range(0, 120, 12):
        c.rect(x, 116, x + 3, 132, "#B8875A"); c.rect(x, 116, x + 1, 132, "#D6A878")
    c.rect(0, 120, 120, 122, "#C9965F"); c.rect(0, 126, 120, 128, "#C9965F")
    c.ridge(134, 4, 50, 16, "#6DB257", edge="#8ED070")
    c.texture(134, H, ["#5FA34A", "#7DC162", "#56963F"], 0.18, 17)
    c.spot("#93D274", "#4F9440", "#B0E494")
    c.tufts(136, H, 60, "#4F9440", "#A8E08A", 18)
    r = random.Random(19)
    for _ in range(55):  # fleurs
        x, y = r.randrange(W), r.randrange(138, H - 2)
        if abs(x - W * 0.5) < W * 0.3 and abs(y - H * 0.8) < H * 0.08:
            continue
        col = r.choice(["#FFFFFF", "#FFD45C", "#F08AA8", "#C58BF2"])
        for (dx, dy) in [(0, -1), (-1, 0), (1, 0), (0, 1)]:
            c.px(x + dx, y + dy, col)
        c.px(x, y, "#F7B23B")
    c.save("prairie")


if __name__ == "__main__":
    for make in (foret, mer, montagne, volcan, tour, prairie):
        make()
        print("ok", make.__name__)
