#!/usr/bin/env bash
# v1.3 npx mode: packaging verification (Docs/v1.3/npx-mode.md §5).
#
#   scripts/v1.3/npx-verify.sh [<out dir>]
#
# 1. `npm pack` the working tree (prepare = build) into a temp dir.
# 2. Install the tarball into an empty temp project (no repository on the path, no workspace link).
# 3. With an environment of PATH and HOME only (no NEO4J_* variable): `npx daedalus evaluate <reference project>
#    --spec <its spec>` three times, and compare the findings with the committed Neo4j reference run
#    (results/v1.3-reference/after-member-facts/raw/clean-architecture/clean.json).
# 4. The MCP stdio smoke (dist/mcp-server/stdio-smoke.js) against the installed `daedalus-mcp` bin.
# 5. Tarball size, installed size, cold-start times. Writes <out dir>/verify.json and prints it.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$REPO/results/v1.3-npx}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/daedalus-npx-verify-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
NODE_DIR="$(dirname "$(command -v node)")"
CLEAN_ENV=(env -i "PATH=$NODE_DIR:/usr/bin:/bin" "HOME=$WORK/home")
REF="$REPO/tests/fixtures/v1.3-reference/clean-architecture"
mkdir -p "$WORK/pack" "$WORK/app" "$WORK/proj" "$WORK/home" "$OUT"

ms() { date +%s%N | awk '{ printf "%d", $1 / 1000000 }'; }

(cd "$REPO" && npm pack --pack-destination "$WORK/pack" >/dev/null 2>"$WORK/pack.log")
TGZ="$(ls "$WORK"/pack/*.tgz)"
TGZ_BYTES="$(stat -c %s "$TGZ")"
TGZ_FILES="$(tar -tzf "$TGZ" | wc -l)"

cp -r "$REF/project/." "$WORK/proj/"
cp "$REF/spec.yaml" "$WORK/spec.yaml"
cd "$WORK/app"
npm init -y >/dev/null
t0=$(ms); npm install --no-audit --no-fund "$TGZ" >/dev/null 2>&1; INSTALL_MS=$(( $(ms) - t0 ))
INSTALLED_KB="$(du -sk node_modules | cut -f1)"

t0=$(ms); "${CLEAN_ENV[@]}" npx --no-install daedalus --version >/dev/null; VERSION_MS=$(( $(ms) - t0 ))

EVAL_MS=()
for i in 1 2 3; do
  t0=$(ms)
  set +e
  "${CLEAN_ENV[@]}" npx --no-install daedalus evaluate "$WORK/proj" --spec "$WORK/spec.yaml" --symbolic-only --format json \
    >"$WORK/eval$i.json" 2>"$WORK/eval$i.err"
  code=$?
  set -e
  EVAL_MS+=( $(( $(ms) - t0 )) )
  [ "$code" -le 1 ] || { cat "$WORK/eval$i.err" >&2; exit 1; }
done
ENGINE_LINE="$(grep -m1 '^daedalus: graph engine' "$WORK/eval1.err" || true)"

PARITY="$(python3 - "$WORK/eval1.json" "$REPO/results/v1.3-reference/after-member-facts/raw/clean-architecture/clean.json" "$WORK/proj/" <<'EOF'
import json, sys
out = json.load(open(sys.argv[1])); ref = json.load(open(sys.argv[2])); root = sys.argv[3]
rel = lambda p: (p or '').replace(root, '')
mine = sorted((v['functionId'], rel(v['filePath']), rel(v.get('target'))) for v in out['violations'])
theirs = sorted((f['ruleId'], f['file'], f.get('target', '')) for f in ref['findings'])
print(json.dumps({'interp': len(mine), 'neo4jReference': len(theirs), 'equal': mine == theirs}))
EOF
)"

t0=$(ms)
"${CLEAN_ENV[@]}" node node_modules/daedalus-arch/dist/mcp-server/stdio-smoke.js \
  --spec "$WORK/spec.yaml" --project "$WORK/proj" --server "$WORK/app/node_modules/.bin/daedalus-mcp" >"$WORK/smoke.json"
SMOKE_MS=$(( $(ms) - t0 ))

python3 - "$OUT/verify.json" <<EOF
import json
smoke = json.load(open("$WORK/smoke.json"))
report = {
  "node": "$(node --version)",
  "tarball": {"bytes": $TGZ_BYTES, "files": $TGZ_FILES},
  "install": {"ms": $INSTALL_MS, "nodeModulesKB": $INSTALLED_KB},
  "coldStartMs": {"daedalusVersion": $VERSION_MS, "evaluate": [${EVAL_MS[0]}, ${EVAL_MS[1]}, ${EVAL_MS[2]}], "mcpSmokeTotal": $SMOKE_MS},
  "engineLine": """$ENGINE_LINE""",
  "parityWithNeo4jReference": json.loads("""$PARITY"""),
  "mcpSmoke": {"ok": smoke["ok"], "tools": len(smoke["tools"]), "steps": smoke["steps"]},
}
json.dump(report, open("$OUT/verify.json", "w"), indent=2)
open("$OUT/verify.json", "a").write("\n")
print(json.dumps(report, indent=2))
EOF
python3 -c "import json,sys; r=json.load(open('$OUT/verify.json')); sys.exit(0 if r['mcpSmoke']['ok'] and r['parityWithNeo4jReference']['equal'] else 1)"
