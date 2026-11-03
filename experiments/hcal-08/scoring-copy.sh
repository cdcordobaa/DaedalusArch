#!/usr/bin/env bash
# HCAL-08 scoring copy: copies the three domains to <out dir> and removes the builder glossary key from every case
# spec.yaml (the header line, every line after it, and the empty lines before it). Then it checks the copy against
# SCORING-COPY.sha256, or writes that file with --write.
# Usage: experiments/hcal-08/scoring-copy.sh <out dir> [--write]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:?usage: scoring-copy.sh <out dir> [--write]}"
MODE="${2:-check}"
HEADER='# --- HCAL-08 builder glossary key (not part of the spec; stripped in the scoring copy) ---'
DOMAINS="glacier-guiding orchard-cooperative luthier-workshop"

if [ -e "$OUT" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
  echo "refusing: $OUT exists and is not empty" >&2
  exit 2
fi
mkdir -p "$OUT"
for dom in $DOMAINS; do
  cp -R "$HERE/$dom" "$OUT/$dom"
done

for spec in "$OUT"/*/cases/*/spec.yaml; do
  awk -v H="$HEADER" '
    { line[NR] = $0 }
    $0 == H && !h { h = NR }
    END {
      if (!h) { print "no glossary key in " FILENAME > "/dev/stderr"; exit 3 }
      n = h - 1
      while (n > 0 && line[n] == "") n--
      for (i = 1; i <= n; i++) print line[i]
    }' "$spec" > "$spec.tmp"
  mv "$spec.tmp" "$spec"
  if grep -q 'HCAL-08 builder glossary key' "$spec"; then echo "key left in $spec" >&2; exit 3; fi
done

manifest() {
  (cd "$OUT" && find . -type f | sed 's|^\./||' | LC_ALL=C sort | while IFS= read -r f; do shasum -a 256 "$f"; done)
}

if [ "$MODE" = "--write" ]; then
  manifest > "$HERE/SCORING-COPY.sha256"
  echo "wrote SCORING-COPY.sha256 ($(wc -l < "$HERE/SCORING-COPY.sha256" | tr -d ' ') files), root $(shasum -a 256 "$HERE/SCORING-COPY.sha256" | cut -c1-64)"
else
  if manifest | diff -q - "$HERE/SCORING-COPY.sha256" >/dev/null; then
    echo "scoring copy ok: matches SCORING-COPY.sha256, root $(shasum -a 256 "$HERE/SCORING-COPY.sha256" | cut -c1-64)"
  else
    echo "scoring copy DIFFERS from SCORING-COPY.sha256" >&2
    exit 1
  fi
fi
