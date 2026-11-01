#!/bin/bash
# mixm.sh <name> <music.mp3> <output.mp4> [music start s] [music volume]
# Interface sounds and cries from out/<name>-audio.json, without the nature bed, over a music that
# comes in over 1 s, drops to 40 % during each cry and fades out over the last 3 s.
set -e
n=$1; music=$2; outf=$3; off=${4:-0}; mv=${5:-0.30}; j=out/$n-audio.json
total=$(python3 -c "import json;print(json.load(open('$j'))['total'])")
duck=$(python3 - "$j" <<'PY'
import json, subprocess, sys
d = json.load(open(sys.argv[1])); parts = []
for a in d['audio']:
    if not a.get('cry'): continue
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a['file']], capture_output=True, text=True).stdout)
    parts.append(f"between(t,{a['t'] - .05:.2f},{a['t'] + dur + .25:.2f})")
print('+'.join(parts) or '0')
PY
)
fo=$(python3 -c "print(max(0,$total-3))")
args=(-f lavfi -t "$total" -i anullsrc=r=48000:cl=stereo -ss "$off" -i "$music"); filt=""; k=3; labels="[1:a]"
while read -r f t v; do args+=(-i "$f"); ms=$(python3 -c "print(int($t*1000))"); filt+="[$k:a]aresample=48000,aformat=channel_layouts=stereo,volume=${v},adelay=${ms}|${ms}[a$k];"; labels+="[a$k]"; k=$((k+1)); done < <(python3 -c "import json;d=json.load(open('$j'));[print(a['file'],a['t'],a.get('vol',1.6)) for a in d['audio'] if a['t'] < d['total'] and not a.get('bed')]")
filt+="${labels}amix=inputs=$((k-2)):normalize=0:duration=first[fx];"
filt+="[2:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:$total,asetpts=N/SR/TB,volume='$mv*(1-0.6*min(1,$duck))':eval=frame,afade=t=in:d=1,afade=t=out:st=$fo:d=3.2[mu];"
filt+="[fx][mu]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[aout]"
ffmpeg -v error -y -i out/$n-video.mp4 "${args[@]}" -filter_complex "$filt" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -t "$total" -movflags +faststart "$outf"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$outf"
