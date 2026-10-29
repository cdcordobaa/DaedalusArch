#!/bin/sh
# Zero calls. Checks that make-input.ts still writes the study's input byte for byte (the pilot options are off):
# builds the stage1, lane-a, lane-b and full-study inputs with make-input.ts as of <ref> (default origin/main) and as
# in the working tree, with the same arguments, and compares input.json, the sweep patterns, the private map and every
# seed, spec and edit file. The random canaries (32 hex digits) are masked; nothing else is.
#   sh experiments/v15-study/study-input-diff.sh [ref]       run from the repository root; exit 0 iff identical
set -eu
REF="${1:-origin/main}"
REPO=$(pwd)
[ -f "$REPO/experiments/v15-study/make-input.ts" ] || { echo "run from the repository root" >&2; exit 2; }
S=$(mktemp -d)
trap 'rm -rf "$S"; rm -f "$REPO/experiments/v15-study/.make-input.ref.ts"' EXIT
git show "$REF:experiments/v15-study/make-input.ts" > "$REPO/experiments/v15-study/.make-input.ref.ts"
mask() { perl -pe 's/\b[0-9a-f]{32}\b/CANARY/g' "$1"; }
build() { # $1 = script, $2 = label, then make-input args
  f="$1"; label="$2"; shift 2
  ph=study; prev=""; for a in "$@"; do [ "$prev" = "--phase" ] && ph="$a"; prev="$a"; done
  rm -rf "$S/o" "$S/v"
  npx tsx "experiments/v15-study/$f" --o "$S/o" --vault "$S/v" --clone "$REPO" --srv /srv "$@" > /dev/null
  d="$S/$label/$ph"; mkdir -p "$d"
  mask "$S/o/$ph/input.json" > "$d/input.json"
  mask "$S/v/sweep-patterns.txt" > "$d/sweep-patterns.txt"
  cp "$S/v/private-id-map.json" "$d/private-id-map.json"
  (cd "$S/o" && find seeds edits -type f | sort | while IFS= read -r x; do shasum -a 256 "$x"; done) > "$d/seeds.txt"
  (cd "$S/o" && find specs -type f | sort | while IFS= read -r x; do tail -n +2 "$x" | shasum -a 256 | sed "s|-|$x|"; done) > "$d/specs.txt"
}
for side in ref new; do
  f=make-input.ts; [ "$side" = ref ] && f=.make-input.ref.ts
  build "$f" "$side" --phase stage1 --replicates 1 --tasks t01,t13
  build "$f" "$side" --phase lane-a --replicates 3 --tasks t01,t02,t03,t04,t05,t06,t07,t08,t09,t10,t11,t12
  build "$f" "$side" --phase lane-b --replicates 6 --tasks t13,t14,t15,t16,t17,t18,t19,t20,t21,t22,t23,t24,t25
  build "$f" "$side"
done
if diff -r "$S/ref" "$S/new"; then echo "study input identical to $REF (stage1, lane-a, lane-b, study)"; else echo "study input DIFFERS from $REF" >&2; exit 1; fi
