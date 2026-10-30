#!/bin/bash
# mix.sh <name>: silent bed + timed cries -> final MP4 (H.264 + AAC)
set -e
n=$1; j=out/$n-audio.json
total=$(python3 -c "import json;print(json.load(open('$j'))['total'])")
args=(-f lavfi -t "$total" -i anullsrc=r=48000:cl=stereo); filt=""; k=2; labels="[1:a]"
while read -r f t v; do args+=(-i "$f"); ms=$(python3 -c "print(int($t*1000))"); filt+="[$k:a]aresample=48000,aformat=channel_layouts=stereo,volume=${v},adelay=${ms}|${ms}[a$k];"; labels+="[a$k]"; k=$((k+1)); done < <(python3 -c "import json;[print(a['file'],a['t'],a.get('vol',1.6)) for a in json.load(open('$j'))['audio'] if a['t'] < json.load(open('$j'))['total']]")
filt+="${labels}amix=inputs=$((k-1)):normalize=0:duration=first,alimiter=limit=0.89[aout]"
ffmpeg -v error -y -i out/$n-video.mp4 "${args[@]}" -filter_complex "$filt" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -t "$total" -movflags +faststart out/Pokedle-$n.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact out/Pokedle-$n.mp4
