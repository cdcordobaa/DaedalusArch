#!/bin/sh
# usage: step.sh <scratch> <task> <cond> <N>  -> type-check (the frame's only check), then commit src/ as "step N". No firewall.
S=$1; T=$2; C=$3; P=$S/proj/$T-$C; G=$S/store/$T-$C.git
cd "$P" || exit 2
./node_modules/.bin/tsc -p tsconfig.json || { echo "TYPECHECK FAILED"; exit 1; }
git --git-dir="$G" --work-tree="$P" add -A src && git --git-dir="$G" --work-tree="$P" commit -qm "step $4" && echo "committed $T/$C step $4"
