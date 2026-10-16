#!/usr/bin/env bash
# Replication smoke test: regenerates the deterministic v1.3 results that need neither Neo4j nor a model, from the
# COMMITTED tree (git archive HEAD into a scratch directory, so the working tree is never written), and compares each
# output byte for byte with the committed copy. Run from anywhere after replication/setup.sh.
#
#   replication/smoke.sh [--keep] [--only gf,gfagg,ise,apg2,cheap,judge]
#
# Exit 0: every output is IDENTICAL or a KNOWN divergence (replication/known-divergences.json, each one explained in
# Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md). Exit 1: an unexpected DIFF / MISSING / EXTRA file.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
KEEP=0; ONLY="gf,gfagg,ise,apg2,cheap,judge"
while [ $# -gt 0 ]; do case "$1" in --keep) KEEP=1;; --only) ONLY="$2"; shift;; *) echo "unknown arg $1" >&2; exit 2;; esac; shift; done
want() { case ",$ONLY," in *",$1,"*) return 0;; *) return 1;; esac; }

# No credentials are needed or wanted: make sure no model can be reached by accident.
unset ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY GOOGLE_API_KEY NEO4J_URI NEO4J_PASSWORD || true

[ -d "$REPO/node_modules" ] || { echo "run replication/setup.sh first (node_modules missing)" >&2; exit 2; }
[ -x "$REPO/experiments/tool-comparison/depcruise/node_modules/.bin/depcruise" ] || { echo "run replication/setup.sh first (pinned dependency-cruiser missing)" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/daedalus-smoke.XXXXXX")"
TREE="$WORK/tree"; OUT="$WORK/out"; mkdir -p "$TREE" "$OUT"
[ "$KEEP" = 1 ] || trap 'rm -rf "$WORK"' EXIT
git -C "$REPO" archive HEAD | tar -x -C "$TREE"
ln -s "$REPO/node_modules" "$TREE/node_modules"
ln -s "$REPO/experiments/tool-comparison/depcruise/node_modules" "$TREE/experiments/tool-comparison/depcruise/node_modules"
echo "commit $(git -C "$REPO" rev-parse --short HEAD), node $(node -v), scratch $WORK"

CMP="node $REPO/replication/lib/compare.mjs"
KNOWN="--known $REPO/replication/known-divergences.json"
status=0
# run <title> <cmd...>: runs in the scratch tree, log in $OUT/logs. A non-zero exit is reported; the comparison that
# follows decides the verdict (apg2-ablation.ts exits 1 whenever a case fails, which is itself compared).
run() {
  local title="$1"; shift; local log="$OUT/logs/$(echo "$title" | tr -c 'A-Za-z0-9\n' '_').log"
  mkdir -p "$OUT/logs"; echo; echo "== $title"
  ( cd "$TREE" && "$@" ) > "$log" 2>&1 || echo "(exit $? — last lines of $log:)" && { [ -s "$log" ] && tail -n 3 "$log" | sed 's/^/   | /'; } || true
}

# 1. Graph fidelity (FR-V2 harness, project mode) on the five v1.3 reference fixtures. No committed output of this mode
#    on the fixtures existed before the replication package, so the expected copy is replication/expected/graph-fidelity.
if want gf; then
  for s in clean-architecture hexagonal layered nestjs ddd; do
    if [ "$s" = ddd ]; then root=tests/fixtures/v1.3-reference/ddd/clean; spec=(); else root=tests/fixtures/v1.3-reference/$s/project; spec=(--spec tests/fixtures/v1.3-reference/$s/spec.yaml); fi
    run "graph fidelity: $s" npx tsx scripts/v1.3/graph-fidelity.ts project --root "$root" --tsconfig "$root/tsconfig.json" "${spec[@]}" --id "$s" --out "$OUT/gf/$s"
    $CMP "graph-fidelity/$s" "$REPO/replication/expected/graph-fidelity/$s" "$OUT/gf/$s" --root "$TREE" $KNOWN || status=1
  done
fi

# 1b. Graph fidelity corpus aggregates (E1, SO4), re-derived from the committed per-project JSON with an independent
#     re-implementation of the harness's unexported aggregate() (the corpora themselves are not in the repository).
if want gfagg; then
  run "graph fidelity: re-aggregate e1 + so4" node "$REPO/replication/lib/fidelity-reaggregate.mjs" "$TREE" "$OUT/gfagg"
  for c in e1 so4; do $CMP "results/v1.3-fidelity/$c/aggregate.json" "$REPO/results/v1.3-fidelity/$c/aggregate.json" "$OUT/gfagg/$c/aggregate.json" $KNOWN || status=1; done
fi

# 2. ISE prototype, offline measure (style classification, layer accuracy, spec equivalence, Options 1 and 3).
if want ise; then
  run "ISE measure" npx tsx scripts/v1.3/ise-measure.ts --out "$OUT/ise"
  $CMP "results/v1.3-ise/2026-10-15" "$REPO/results/v1.3-ise/2026-10-15" "$OUT/ise" --only '^(measure\.(json|md)|specs/[^/]*(?<!\.true)\.yaml)$' $KNOWN || status=1
  # (d) downstream: replayed from the committed live rows (raw/) of the Neo4j run, no Neo4j needed.
  D="$OUT/ise-down"; mkdir -p "$D/specs"
  cp -R "$TREE/results/v1.3-ise/2026-10-15/raw" "$D/raw"
  for f in "$TREE"/results/v1.3-ise/2026-10-15/specs/*.yaml; do case "$f" in *.true.yaml) ;; *) cp "$f" "$D/specs/";; esac; done
  run "ISE downstream (--from-raw)" node --import tsx scripts/v1.3/ise-downstream.ts --from-raw --out "$D"
  $CMP "results/v1.3-ise/2026-10-15" "$REPO/results/v1.3-ise/2026-10-15" "$D" --only '^(downstream\.(json|md)|specs/[^/]*\.true\.yaml)$' $KNOWN || status=1
  # ISE E1 summary tables from the committed per-cell records.
  E="$OUT/ise-e1"; mkdir -p "$E"; cp "$TREE/results/v1.3-ise-e1/cells.json" "$E/"
  run "ISE E1 report (ise-e1-report.ts)" node --import tsx scripts/v1.3/ise-e1-report.ts --dir "$E"
  $CMP "results/v1.3-ise-e1" "$REPO/results/v1.3-ise-e1" "$E" --only '^summary\.(json|md)$' $KNOWN || status=1
fi

# 3. APG v2 in-memory ablation (+ pinned dependency-cruiser 18.4.0). The script writes into its own Docs folder, i.e.
#    into the scratch tree, never into the working tree.
if want apg2; then
  run "APG v2 ablation" npx tsx scripts/apg2-ablation.ts
  $CMP "Docs/DiagnosticRuns/apg2-ablation-2026-10-15" "$REPO/Docs/DiagnosticRuns/apg2-ablation-2026-10-15" "$TREE/Docs/DiagnosticRuns/apg2-ablation-2026-10-15" $KNOWN || status=1
fi

# 3b. The same ablation on the tree of the commit that produced the committed outputs (72fa9203): expected
#     byte-identical with no known divergence. Needs the git history (a clone, not a tarball).
if want apg2 && git -C "$REPO" cat-file -e 72fa9203^{commit} 2>/dev/null; then
  T72="$WORK/tree-72fa9203"; mkdir -p "$T72"; git -C "$REPO" archive 72fa9203 | tar -x -C "$T72"
  ln -s "$REPO/node_modules" "$T72/node_modules"
  ln -s "$REPO/experiments/tool-comparison/depcruise/node_modules" "$T72/experiments/tool-comparison/depcruise/node_modules"
  mkdir -p "$OUT/logs"; echo; echo "== APG v2 ablation @72fa9203"
  ( cd "$T72" && npx tsx scripts/apg2-ablation.ts ) > "$OUT/logs/apg2-72fa9203.log" 2>&1 || echo "(exit $?)"
  $CMP "apg2-ablation@72fa9203" "$REPO/Docs/DiagnosticRuns/apg2-ablation-2026-10-15" "$T72/Docs/DiagnosticRuns/apg2-ablation-2026-10-15" || status=1
fi

# 4. Cheap semantic proxies (pass 0.5).
if want cheap; then
  . "$REPO/replication/lib/cheap.sh"
fi

# 5. Judge catch scores (rounds 1, 2 and DUP-RULE v2) replayed from the committed cassettes.
if want judge; then
  . "$REPO/replication/lib/judge.sh"
fi

echo
[ "$status" = 0 ] && echo "SMOKE: OK (identical or known divergences only)" || echo "SMOKE: UNEXPECTED DIFFERENCES (see above)"
exit "$status"
