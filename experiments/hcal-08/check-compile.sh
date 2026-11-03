#!/usr/bin/env bash
# HCAL-08: type-check every base, and every case overlaid on a copy of its base, with tsc strict.
# Usage: experiments/hcal-08/check-compile.sh [path to tsc]   (default: npx tsc)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
TSC="${1:-npx tsc}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail=0
count=0
for dom in "$HERE"/*/; do
  dom="${dom%/}"
  [ -d "$dom/base" ] || continue
  name="$(basename "$dom")"
  if ! $TSC -p "$dom/base" >"$WORK/out.txt" 2>&1; then
    echo "FAIL $name/base"; cat "$WORK/out.txt"; fail=1
  fi
  count=$((count + 1))
  for case in "$dom"/cases/*/; do
    case="${case%/}"
    id="$(basename "$case")"
    tree="$WORK/$name-$id"
    cp -R "$dom/base" "$tree"
    cp -R "$case/." "$tree/"
    if ! $TSC -p "$tree" >"$WORK/out.txt" 2>&1; then
      echo "FAIL $name/$id"; cat "$WORK/out.txt"; fail=1
    fi
    count=$((count + 1))
  done
done
if [ "$fail" -eq 0 ]; then echo "tsc ok on $count trees"; fi
exit "$fail"
