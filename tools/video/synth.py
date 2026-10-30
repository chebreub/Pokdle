# Original, soft sound effects synthesised from scratch (no sample library, no melody).
import numpy as np, wave, math, os
os.makedirs('assets/sfx', exist_ok=True)
SR = 48000
rng = np.random.default_rng(7)
def write(name, x, peak=0.5):
    x = np.asarray(x, dtype=np.float64); m = np.max(np.abs(x)) or 1; x = x / m * peak
    st = np.stack([x, x], axis=1)
    with wave.open(f'assets/sfx/{name}.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
def bandpass(x, fc, q):
    # time-varying RBJ band-pass; fc may be an array
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape); y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for n in range(len(x)):
        w0 = 2 * math.pi * fc[n] / SR; al = math.sin(w0) / (2 * q); c = math.cos(w0); a0 = 1 + al
        b0, b2, a1, a2 = al / a0, -al / a0, -2 * c / a0, (1 - al) / a0
        yn = b0 * x[n] + b2 * x2 - a1 * y1 - a2 * y2; x2, x1, y2, y1 = x1, x[n], y1, yn; y[n] = yn
    return y
def lowpass1(x, fc):
    a = math.exp(-2 * math.pi * fc / SR); y = np.zeros_like(x); p = 0.0
    for n in range(len(x)): p = (1 - a) * x[n] + a * p; y[n] = p
    return y
def env(n, a, d, shape=2.0):
    t = np.arange(n) / SR; e = np.minimum(t / max(a, 1e-4), 1) * np.exp(-np.maximum(t - a, 0) / d); return e
def T(sec): return np.arange(int(SR * sec)) / SR
# whoosh: breathy air sweep, rises then falls
def whoosh(dur, f0, f1, f2, peak):
    t = T(dur); n = len(t); u = t / dur
    fc = np.where(u < .55, f0 + (f1 - f0) * (u / .55) ** 1.4, f1 + (f2 - f1) * ((u - .55) / .45))
    e = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.6
    x = bandpass(rng.standard_normal(n), fc, 1.1) * e
    return x, peak
x, p = whoosh(.42, 350, 1900, 700, .42); write('whoosh', x, p)
x, p = whoosh(.75, 250, 1500, 400, .45); write('whoosh_long', x, p)
x, p = whoosh(.28, 600, 2600, 1200, .30); write('swish', x, p)
# soft tap: tiny felt click
t = T(.06); x = bandpass(rng.standard_normal(len(t)), 2400, 2.5) * env(len(t), .001, .012) + .3 * np.sin(2 * np.pi * 1700 * t) * env(len(t), .001, .01); write('tap', x, .22)
# pop: little bubble, pitch drops
t = T(.12); f = 780 * np.exp(-t * 9) + 320; ph = 2 * np.pi * np.cumsum(f) / SR; x = np.sin(ph) * env(len(t), .004, .035); write('pop', x, .34)
# thump: soft low impact
t = T(.35); f = 95 * np.exp(-t * 6) + 48; ph = 2 * np.pi * np.cumsum(f) / SR
x = np.sin(ph) * env(len(t), .003, .09) + .35 * lowpass1(rng.standard_normal(len(t)), 600) * env(len(t), .001, .03); write('thump', x, .55)
# tick for the countdown: dry wooden knock (two inharmonic partials, very short)
t = T(.09); x = (np.sin(2 * np.pi * 980 * t) + .6 * np.sin(2 * np.pi * 2690 * t)) * env(len(t), .0008, .018) + .25 * bandpass(rng.standard_normal(len(t)), 3000, 3) * env(len(t), .0005, .004); write('tick', x, .40)
# riser: tension before the reveal (filtered air that climbs, no pitch)
t = T(1.1); u = t / 1.1; x = bandpass(rng.standard_normal(len(t)), 300 + 3200 * u ** 2, 1.4) * (u ** 2.2) * (1 - np.clip((u - .96) / .04, 0, 1)); write('riser', x, .32)
# shimmer: sparkly granular dust (random high grains, non-melodic)
t = T(1.2); x = np.zeros(len(t))
for _ in range(70):
    s = int(rng.uniform(0, .9) * SR); L = int(.03 * SR); f = rng.uniform(3500, 7500); tt = np.arange(L) / SR
    x[s:s + L] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / .008) * rng.uniform(.3, 1)
x += .25 * bandpass(rng.standard_normal(len(t)), 6000, .8) * np.exp(-t / .35)
write('shimmer', x * np.exp(-t / .5), .20)
# boom: reveal impact (deeper thump + air)
t = T(.8); f = 70 * np.exp(-t * 4) + 38; ph = 2 * np.pi * np.cumsum(f) / SR
x = np.sin(ph) * env(len(t), .004, .22) + .45 * lowpass1(rng.standard_normal(len(t)), 900) * env(len(t), .001, .07); write('boom', x, .62)
print('ok')
