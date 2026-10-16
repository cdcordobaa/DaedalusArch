#!/usr/bin/env bash
# Judge steering-comment robustness, one command (Docs/v1.3/judge-steering-plan.md §8). Run from the repository root,
# locally, with the isolated judge CLI login set up (ADR-018/022: the pinned judge CLI and its own config dir). Mirrors
# scripts/v1.3/judge-v22-check2-local.sh (#141). This script never reads .env, credentials or the judge config dir; the
# provider does its own pre-flight.
#
#   bash scripts/v1.3/judge-steering-local.sh            # verify, print the call budget, ask, record, score
#   bash scripts/v1.3/judge-steering-local.sh --dry-run  # verify and print the call budget only (no call)
#   bash scripts/v1.3/judge-steering-local.sh --yes      # do not ask before calling
#
# Options passed through: --budget <n> (hard cap on the call ledger, default 400; the plan needs 360 + 1 init probe).
# Re-running resumes: entries already in the cassettes are answered from them and never called again.
set -euo pipefail

DRY=0
YES=0
BUDGET=400
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --yes) YES=1 ;;
    --budget) BUDGET="$2"; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

# Minimal environment for every phase (as in #141): the cassette decorator scrubs the value of every variable named
# like a secret from what it stores, so a short value (MAX_THINKING_TOKENS=<digits>) would otherwise be redacted inside
# prompts. Only HOME, PATH, locale and proxy variables are passed on; no Neo4j is needed.
KEEP=(HOME PATH TERM LANG LC_ALL HTTPS_PROXY HTTP_PROXY NO_PROXY https_proxy http_proxy no_proxy NODE_EXTRA_CA_CERTS)
ENVARGS=()
for v in "${KEEP[@]}"; do
  if [[ -n "${!v:-}" ]]; then ENVARGS+=("$v=${!v}"); fi
done
run() { env -i "${ENVARGS[@]}" npx tsx scripts/v1.3/judge-steering.ts "$@"; }

echo "== 1. Frozen inputs"
sha256sum tests/fixtures/v1.3-judge-steering/manifest.json results/v1.3-judge-steering/prompts.json
run verify
run harvest --check
env -i "${ENVARGS[@]}" npx jest --maxWorkers=2 tests/unit/scripts/v1.3/judge-steering.test.ts tests/unit/llm-critic/strip-comments.test.ts >/dev/null 2>&1 \
  || { echo "unit tests failed: the variants, the prompts or the decision rule moved; stop" >&2; exit 1; }
echo "variants, prompts and decision rule: unit tests pass"

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

echo "== 3. Record (judge v1 on the review_unit prompt), 3 runs per prompt"
run record --runs 3 --budget "$BUDGET"

echo "== 4. Score and decision"
run score
echo "results: results/v1.3-judge-steering/scores.md and decision.json"
