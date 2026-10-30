#!/bin/bash
# fetch-assets.sh <id> [<id>…]: official artwork and cry of each Pokémon (PokeAPI), plus the cry's
# loudness curve (env-<id>.json, 60 values per second) that the « 5 cris » bars follow.
set -e
cd "$(dirname "$0")"
mkdir -p assets
for id in "$@"; do
  [ -f "assets/art-$id.png" ] || curl -sf -o "assets/art-$id.png" "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/$id.png"
  [ -f "assets/cry-$id.ogg" ] || curl -sf -o "assets/cry-$id.ogg" "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/$id.ogg"
  python3 - "$id" <<'PY'
import json, math, struct, subprocess, sys
i = sys.argv[1]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'assets/cry-{i}.ogg', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'], capture_output=True).stdout
s = struct.unpack('<%dh' % (len(raw) // 2), raw); step = 800
env = [math.sqrt(sum(x * x for x in s[k:k + step]) / max(1, len(s[k:k + step]))) for k in range(0, len(s), step)]
m = max(env) or 1
json.dump([round(e / m, 3) for e in env], open(f'assets/env-{i}.json', 'w'))
print(i, 'ok', len(env) / 60, 's')
PY
done
