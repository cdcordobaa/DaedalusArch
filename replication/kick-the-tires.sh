#!/usr/bin/env bash
# Artifact-evaluation kick-the-tires check (ARTIFACT.md §2). No Neo4j, no Docker, no model, no network.
#
#   npm ci                          # also builds dist/ (prepare)
#   replication/kick-the-tires.sh   # or: npm run artifact:kick
#   replication/kick-the-tires.sh --parity   # also runs the interpreter golden-parity test (~20 s more)
#
# Evaluates the four v1.3 reference projects and three fixture projects with the in-process Cypher interpreter
# (--engine cypher-interp, symbolic-only) and compares verdict, deterministic AHS and exit code with the values in
# EXPECTED below (recorded 2026-10-16 on a clean clone, Node v22.22.0). Exit 0: every row matches. Exit 1: a mismatch.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
PARITY=0
for a in "$@"; do case "$a" in --parity) PARITY=1;; *) echo "unknown arg $a" >&2; exit 2;; esac; done

# The interpreter is chosen when NEO4J_URI is unset; --engine pins it anyway. No credential is read.
unset NEO4J_URI NEO4J_PASSWORD ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY GOOGLE_API_KEY || true

[ -d node_modules ] || { echo "node_modules missing: run 'npm ci' first" >&2; exit 2; }
[ -f dist/cli/bin.js ] || { echo "dist/ missing: run 'npm run build' first" >&2; exit 2; }

OUT="$(mktemp -d "${TMPDIR:-/tmp}/daedalus-kick.XXXXXX")"
echo "commit $(git rev-parse --short HEAD 2>/dev/null || echo n/a), node $(node -v), outputs in $OUT"

# name | project | spec | verdict | ahsDeterministic | exit code
EXPECTED=(
  "ref-clean-architecture|tests/fixtures/v1.3-reference/clean-architecture/project|tests/fixtures/v1.3-reference/clean-architecture/spec.yaml|pass|0.954|0"
  "ref-hexagonal|tests/fixtures/v1.3-reference/hexagonal/project|tests/fixtures/v1.3-reference/hexagonal/spec.yaml|pass|0.908|0"
  "ref-layered|tests/fixtures/v1.3-reference/layered/project|tests/fixtures/v1.3-reference/layered/spec.yaml|pass|0.943|0"
  "ref-nestjs|tests/fixtures/v1.3-reference/nestjs/project|tests/fixtures/v1.3-reference/nestjs/spec.yaml|pass|0.954|0"
  "fixture-correct-reference|fixtures/correct-reference|specs/clean-arch.yaml|pass|0.954|0"
  "fixture-variant-a-structural|fixtures/variant-a-structural|specs/clean-arch.yaml|hard-block|0.438|1"
  "fixture-variant-b-pattern|fixtures/variant-b-pattern|specs/clean-arch.yaml|hard-block|0.571|1"
)

status=0
printf '%-30s %-11s %-7s %-4s %-6s %s\n' name verdict ahs exit secs result
for row in "${EXPECTED[@]}"; do
  IFS='|' read -r name proj spec ev ea ec <<<"$row"
  t0=$(date +%s%N)
  set +e
  node dist/cli/bin.js evaluate "$proj" --spec "$spec" --engine cypher-interp --symbolic-only --format json \
    > "$OUT/$name.json" 2> "$OUT/$name.err"
  rc=$?
  set -e
  secs=$(( ($(date +%s%N) - t0) / 1000000 ))
  got=$(node -e 'try{const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(r.verdict+"|"+r.ahsDeterministic)}catch{console.log("ERROR|-")}' "$OUT/$name.json")
  gv=${got%%|*}; ga=${got##*|}
  if [ "$gv" = "$ev" ] && [ "$ga" = "$ea" ] && [ "$rc" = "$ec" ]; then res=OK; else res="MISMATCH (expected $ev $ea exit $ec; see $OUT/$name.err)"; status=1; fi
  printf '%-30s %-11s %-7s %-4s %-6s %s\n' "$name" "$gv" "$ga" "$rc" "$(printf '%d.%01d' $((secs/1000)) $(((secs%1000)/100)))" "$res"
done

echo
echo "== validate: every compiled query of specs/clean-arch.yaml parses on the interpreter"
if node dist/cli/bin.js validate --spec specs/clean-arch.yaml --project fixtures/correct-reference --engine cypher-interp \
     > "$OUT/validate.out" 2>&1; then
  grep -h "compiled queries parse" "$OUT/validate.out" || true; echo "validate OK"
else
  echo "validate FAILED (see $OUT/validate.out)"; status=1
fi

if [ "$PARITY" = 1 ]; then
  echo
  echo "== interpreter vs committed Neo4j golden outputs (tests/unit/cypher-interp/golden-parity.test.ts)"
  npx jest tests/unit/cypher-interp/golden-parity.test.ts --forceExit 2>&1 | grep -E "Tests:|✓|✕" || status=1
fi

echo
[ "$status" = 0 ] && echo "KICK-THE-TIRES: OK" || echo "KICK-THE-TIRES: FAILED"
exit "$status"
