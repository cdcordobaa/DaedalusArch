#!/bin/sh
# usage: replay.sh <nonerepo> <toolrepo> <N>   -> copies the none arm's step-N tree into the tool repo working tree
set -e
H=$(cd "$1" && git log --reverse --format='%H %s' | grep " step $3 " | head -1 | cut -d' ' -f1)
[ -n "$H" ] || { echo "no step $3"; exit 2; }
rm -rf "$2/src" && mkdir -p "$2/src" && (cd "$1" && git archive "$H" src) | tar -x -C "$2"
