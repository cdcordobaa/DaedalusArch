#!/bin/sh
# usage: newproj.sh <scratch> <task> <cond>   -> <scratch>/proj/<task>-<cond> with the pinned skeleton, harness tsconfig,
# and (C3) the pilot spec as spec.yaml; the git store is <scratch>/store/<task>-<cond>.git, outside the project dir.
set -e
S=$1; T=$2; C=$3; P=$S/proj/$T-$C; G=$S/store/$T-$C.git; REPO=$(cd "$(dirname "$0")/../../.." && pwd)
mkdir -p "$P/src"; ln -sfn "$S/skel/node_modules" "$P/node_modules"; cp "$S/skel/package.json" "$P/"
sh "$REPO/results/v1.3-floor-probe-2/scripts/mktsconfig.sh" "$P"
if [ "$C" = C3 ]; then
  case $T in shelter-adoptions) cp "$REPO/presets/hexagonal.yaml" "$P/spec.yaml";; market-vendors) cp "$REPO/specs/clean-arch.yaml" "$P/spec.yaml";; esac
fi
git init -q --bare "$G"; g() { git --git-dir="$G" --work-tree="$P" "$@"; }
g config user.email probe@local; g config user.name probe
g add -f package.json tsconfig.json; [ -f "$P/spec.yaml" ] && g add -f spec.yaml; g commit -qm base; echo "$P"
