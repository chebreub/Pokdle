#!/bin/bash
# Renders every video with the pro scene, then mixes the sound.
for n in "$@"; do PAGE=pro.html node render.js $n && ./mix.sh $n && cp out/Pokedle-$n.mp4 out/Pokedle-$n-pro.mp4 && echo "DONE $n"; done
echo ALLDONE
