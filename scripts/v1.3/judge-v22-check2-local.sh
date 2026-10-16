#!/usr/bin/env bash
# Judge v1 vs v2.2 on CHECK-2, one command (Docs/v1.3/judge-v22-plan.md §6). Run from the repository root, locally,
# with the isolated judge CLI login set up (ADR-018/022: the pinned judge CLI and its own config dir). This script
# never reads credentials or the judge config dir; the provider does its own pre-flight.
#
#   bash scripts/v1.3/judge-v22-check2-local.sh            # verify, print the call budget, ask, record v1 and v2.2, score
#   bash scripts/v1.3/judge-v22-check2-local.sh --dry-run  # verify and print the call budget only (no call)
#   bash scripts/v1.3/judge-v22-check2-local.sh --yes      # do not ask before calling
#
# Options passed through: --budget <n> (hard cap on the call ledger, default 1000).
# Re-running resumes: entries already in the cassettes are answered from them and never called again.
# Optional reproducibility check (needs Neo4j as for `firewall evaluate`): CHECK2_REHARVEST=1 re-seeds, re-plans and
# re-harvests into a scratch dir and compares with the committed manifest, split and prompts before any call.
set -euo pipefail

DRY=0
YES=0
BUDGET=1000
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --yes) YES=1 ;;
    --budget) BUDGET="$2"; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

# Minimal environment for every phase. The cassette decorator scrubs the value of every variable whose name matches
# KEY|TOKEN|SECRET|PASSWORD from what it stores; a short value such as MAX_THINKING_TOKENS=<digits> would otherwise be
# redacted inside function ids and prompts. Only HOME, PATH, locale, proxy and Neo4j variables are passed on.
KEEP=(HOME PATH TERM LANG LC_ALL HTTPS_PROXY HTTP_PROXY NO_PROXY https_proxy http_proxy no_proxy NODE_EXTRA_CA_CERTS NEO4J_URI NEO4J_USER NEO4J_PASSWORD)
ENVARGS=()
for v in "${KEEP[@]}"; do
  if [[ -n "${!v:-}" ]]; then ENVARGS+=("$v=${!v}"); fi
done
run() { env -i "${ENVARGS[@]}" npx tsx scripts/v1.3/judge-v22-check2.ts "$@"; }

echo "== 1. Frozen inputs"
sha256sum results/v1.3-judge-v22/check2-seed-manifest.json results/v1.3-judge-v22/check2-split.json \
  results/v1.3-judge-v22/prompts/check2-v1.json results/v1.3-judge-v22/prompts/check2-v2.2.json
env -i "${ENVARGS[@]}" npx jest --maxWorkers=2 tests/unit/llm-critic/judge-v22.test.ts tests/unit/llm-critic/judge-v2.test.ts tests/unit/scripts/v1.3/judge-v22-check2.test.ts >/dev/null 2>&1 \
  || { echo "unit tests failed: the judge texts or the decision rule moved; stop" >&2; exit 1; }
echo "judge texts and decision rule: unit tests pass"

if [[ "${CHECK2_REHARVEST:-0}" == "1" ]]; then
  WORK="$(mktemp -d)"
  echo "== 1b. Re-seed, re-plan and re-harvest into ${WORK} (Neo4j, no model)"
  run seed --out "$WORK" --check
  run plan "$WORK" --check
  run harvest "$WORK" --judge-version v1 --check
  run harvest "$WORK" --judge-version v2.2 --check
fi

echo "== 2. Call budget"
run budget --runs 3
if [[ "$DRY" == "1" ]]; then
  echo "dry run: no call made"
  exit 0
fi
if [[ "$YES" != "1" ]]; then
  read -r -p "Proceed with the judge calls above? [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "stopped before any call"; exit 0; }
fi

echo "== 3. Record v1 (frozen judge), 3 runs per unit"
run record --judge-version v1 --runs 3 --budget "$BUDGET"
echo "== 4. Record v2.2, 3 runs per unit"
run record --judge-version v2.2 --runs 3 --budget "$BUDGET"

echo "== 5. Score and decision"
run score
