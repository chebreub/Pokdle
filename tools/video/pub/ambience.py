# A calm « Pokémon route » ambience made from scratch: soft wind, leaves, a few birds. No instrument, no melody.
import numpy as np, wave
SR = 48000; L = 62; n = SR * L; rng = np.random.default_rng(5)
def shaped_noise(lo, hi, tilt=0.0):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    g = ((f > lo) & (f < hi)).astype(float) * np.where(f > 0, (np.maximum(f, 1) / 1000) ** tilt, 0)
    g = np.convolve(g, np.ones(400) / 400, 'same')  # soft edges
    x = np.fft.irfft(X * g, n); return x / np.max(np.abs(x))
def slow_curve(rate, depth, base):
    k = int(L * rate) + 3; pts = rng.uniform(0, 1, k); t = np.linspace(0, k - 1, n)
    c = np.interp(t, np.arange(k), pts); c = np.convolve(c, np.ones(SR) / SR, 'same'); return base + depth * c
wind = shaped_noise(60, 700, -0.6) * slow_curve(.25, .9, .25)
leaves = shaped_noise(1500, 6000, 0) * slow_curve(.6, .5, 0) ** 2 * .25
birds = np.zeros(n)
def chirp(start, f0, f1, dur, vib=0):
    m = int(dur * SR); t = np.arange(m) / SR; u = t / dur
    f = f0 + (f1 - f0) * u + vib * np.sin(2 * np.pi * 38 * t) * f0 * .03
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * u) ** 2
    i = int(start * SR); birds[i:i + m] += s[: max(0, min(m, n - i))]
t = 1.8
while t < L - 3:
    kind = rng.integers(3); vol = rng.uniform(.35, .8)
    if kind == 0:   # « ti-tuu »: two short calls falling
        for k in range(rng.integers(2, 4)): chirp(t + k * .32, 4300, 3900, .09); chirp(t + k * .32 + .12, 3300, 2900, .12)
    elif kind == 1: # quick trill
        for k in range(rng.integers(5, 9)): chirp(t + k * .07, 5200, 4400, .05, vib=1)
    else:           # one soft whistle up
        chirp(t, 2400, 3300, .22)
    t += rng.uniform(3.5, 7.5)
birds = np.convolve(birds, np.ones(3) / 3, 'same')
mix = .55 * wind + .35 * leaves + .22 * birds
fade = np.minimum(1, np.minimum(np.arange(n) / (1.5 * SR), (n - np.arange(n)) / (1.5 * SR)))
mix = mix * fade; mix = mix / np.max(np.abs(mix)) * .30
st = np.stack([mix, np.roll(mix, 240)], 1)  # a touch of width
with wave.open('assets/sfx/ambience.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('ok')
