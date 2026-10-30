# Two soft UI sounds made from scratch: a phone keyboard click and a pleasant « validate ».
import numpy as np, wave, math
SR = 48000; rng = np.random.default_rng(11)
def write(name, x, peak):
    x = np.asarray(x, float); x = x / (np.max(np.abs(x)) or 1) * peak
    st = np.stack([x, x], 1)
    with wave.open(f'assets/sfx/{name}.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
def T(s): return np.arange(int(SR * s)) / SR
def bp(x, fc, q):
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0; w0 = 2 * math.pi * fc / SR; al = math.sin(w0) / (2 * q); c = math.cos(w0); a0 = 1 + al
    b0, b2, a1, a2 = al / a0, -al / a0, -2 * c / a0, (1 - al) / a0
    for n in range(len(x)): yn = b0 * x[n] + b2 * x2 - a1 * y1 - a2 * y2; x2, x1, y2, y1 = x1, x[n], y1, yn; y[n] = yn
    return y
# key: short dry « tock » like a phone keyboard
t = T(.035); e = np.exp(-t / .0045)
x = bp(rng.standard_normal(len(t)), 2300, 1.8) * e + .5 * np.sin(2 * np.pi * 1250 * t) * np.exp(-t / .006)
write('key', x, .28)
# validate: a soft round pop, then one warm bell-like tone (a single note, no melody)
t = T(.55)
f = 520 * np.exp(-t * 30) + 260; pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .03)
bell = (np.sin(2 * np.pi * 1046 * t) + .35 * np.sin(2 * np.pi * 2093 * t) + .12 * np.sin(2 * np.pi * 3140 * t)) * np.minimum(t / .004, 1) * np.exp(-t / .16)
d = int(.035 * SR); bell = np.concatenate([np.zeros(d), bell[:-d]])
write('validate', .9 * pop + .55 * bell, .40)
print('ok')
