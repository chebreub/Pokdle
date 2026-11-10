# Tic-tac de chrono fait maison pour « Devine le Pokémon ! » (px6) : assets/sfx/timer.wav.
# Il couvre les 3 paliers d'un Pokémon (2,1 s + 2,1 s + 2,0 s) et accélère pour faire monter la
# pression : un tic toutes les 0,5 s (3 pts), 0,33 s (2 pts), puis 0,2 s (1 pt), de plus en plus fort.
# Aucune mélodie : des clics de bois, un tic aigu et un tac plus grave.
import numpy as np, wave
SR = 48000
import sys
# durée, écart entre deux tics, volume. « python3 pub/timer.py 4 » : version courte de 4 s (pub/px4.js).
PHASES = [(2.1, 0.5, 0.45), (2.1, 1 / 3, 0.62), (2.0, 0.2, 0.85)]
SHORT = len(sys.argv) > 1
if SHORT:
    k = float(sys.argv[1]) / 4
    PHASES = [(1.4 * k, 0.5, 0.45), (1.3 * k, 1 / 3, 0.62), (1.3 * k, 0.2, 0.85)]


def click(freq, dur=0.05):
    t = np.arange(int(SR * dur)) / SR
    body = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.012)
    knock = np.random.default_rng(int(freq)).standard_normal(t.size) * np.exp(-t / 0.003) * 0.6
    return body + knock


total = sum(p[0] for p in PHASES)
out = np.zeros(int(SR * total) + SR // 10)
start, k = 0.0, 0
for dur, gap, vol in PHASES:
    t = 0.0
    while t < dur - 1e-6:
        c = click(2100 if k % 2 == 0 else 1500) * vol
        i = int(SR * (start + t)); out[i:i + c.size] += c
        t += gap; k += 1
    start += dur
out = out / np.max(np.abs(out)) * 0.55
st = np.repeat(out[:, None], 2, axis=1)
with wave.open(('assets/sfx/timer%s.wav' % sys.argv[1]) if SHORT else 'assets/sfx/timer.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('timer.wav', round(total, 2), 's')
