#!/usr/bin/env bash
# HCAL-09 seal check. Verifies every sealed case file, that no file was added to the domains, the seal root and the
# scoring-copy root recorded in SEAL.root, and (once the scoring session has written it) the frozen rule hash.
# Usage: experiments/hcal-09/verify-seal.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
DOMAINS="harbor-pilotage bell-foundry apiary-pollination stone-quarry"

shasum -a 256 -c --quiet SEAL.sha256
listed="$(cut -c67- SEAL.sha256 | LC_ALL=C sort)"
present="$(find $DOMAINS -type f | LC_ALL=C sort)"
if [ "$listed" != "$present" ]; then
  echo "file list differs from SEAL.sha256" >&2
  diff <(echo "$listed") <(echo "$present") >&2 || true
  exit 1
fi

root="$(shasum -a 256 SEAL.sha256 | cut -c1-64)"
want="$(awk '$1 == "cases" { print $2 }' SEAL.root)"
[ "$root" = "$want" ] || { echo "seal root $root does not match SEAL.root $want" >&2; exit 1; }

sroot="$(shasum -a 256 SCORING-COPY.sha256 | cut -c1-64)"
swant="$(awk '$1 == "scoring-copy" { print $2 }' SEAL.root)"
[ "$sroot" = "$swant" ] || { echo "scoring-copy root $sroot does not match SEAL.root $swant" >&2; exit 1; }

for s in scoring-copy.sh check-compile.sh; do
  got="$(shasum -a 256 "$s" | cut -c1-64)"
  exp="$(awk -v k="script:$s" '$1 == k { print $2 }' SEAL.root)"
  [ "$got" = "$exp" ] || { echo "$s sha256 $got does not match SEAL.root $exp" >&2; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
bash "$HERE/scoring-copy.sh" "$TMP/copy"

if [ -f RULES-FROZEN.sha256 ]; then
  (cd ../../src/v15-instrument && shasum -a 256 -c --quiet ../../experiments/hcal-09/RULES-FROZEN.sha256)
  echo "rules ok: RULES-FROZEN.sha256 root $(shasum -a 256 RULES-FROZEN.sha256 | cut -c1-64)"
else
  echo "rules: stub (RULES-FROZEN.sha256 not written yet; the scoring session writes it before scoring)"
fi
echo "seal ok: $(wc -l < SEAL.sha256 | tr -d ' ') files, root $root"
