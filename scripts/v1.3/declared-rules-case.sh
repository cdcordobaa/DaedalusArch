#!/usr/bin/env bash
# One team-declared-rules case: check out TREE of a clone in a throw-away worktree, put the team's declaration of RULE
# in place (the same file when RULE = TREE), run the team's own tool there, then the DaedalusArch side and the
# comparison (scripts/v1.3/declared-rules-run.ts). Clones and worktrees live outside the repository and are never
# committed. `Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`.
#
# Environment (all required unless marked):
#   FAMILY   depcruise | boundaries | nx
#   CLONE    absolute path of the (blobless) clone
#   SCOPE    directory of the tool run, relative to the clone ('.' for the root)
#   CFG      declaration file(s) relative to SCOPE, space separated (copied from RULE into the worktree)
#   TOOLNM   node_modules with the pinned tool (depcruise: dependency-cruiser + typescript; eslint families: the
#            installed workspace node_modules, linked into the worktree)
#   ARGS     depcruise: the cruise arguments (e.g. "src"); eslint families: the files/globs to lint
#   TREE     commit whose source tree is analysed;   RULE  commit whose declaration is applied
#   ID       case id (results/v1.3-declared-rules/cases/<ID>);   REPO  owner/name;   TOOLVER  tool + version text
#   TSCONFIG tsconfig for the DaedalusArch extraction, relative to SCOPE (default tsconfig.json)
#   SPARSE   (optional) sparse-checkout patterns, space separated
#   HARNESS_BASE (optional) a base tsconfig to extend with the linted directories (Nx workspaces)
#   eslint families: RULEIDS (the rule id), PROBE (a source file for --print-config), PRINTFLAT / RUNFLAT
#            (ESLINT_USE_FLAT_CONFIG for reading the team's config / for the minimal run), PLUGIN, PLUGINKEY, PARSER
#            (see declared-rules-eslint.mjs)
#   REASON   (optional) why the case was mined;   WORK  scratch directory
set -euo pipefail
: "${FAMILY:?}" "${CLONE:?}" "${SCOPE:?}" "${CFG:?}" "${TOOLNM:?}" "${ARGS:?}" "${TREE:?}" "${RULE:?}" "${ID:?}" "${REPO:?}" "${TOOLVER:?}" "${WORK:?}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO_ROOT/results/v1.3-declared-rules/cases/$ID"
TSCONFIG="${TSCONFIG:-tsconfig.json}"
safe="$(echo "$ID" | tr '/' '_')"
wt="$WORK/wt/$safe"
mkdir -p "$WORK/wt" "$WORK/raw" "$OUT"
git -C "$CLONE" worktree remove --force "$wt" >/dev/null 2>&1 || true; rm -rf "$wt"; git -C "$CLONE" worktree prune
git -C "$CLONE" worktree add -q --detach --no-checkout "$wt" "$TREE"
if [ -n "${SPARSE:-}" ]; then
  # shellcheck disable=SC2086
  git -C "$wt" sparse-checkout set --no-cone $SPARSE
fi
git -C "$wt" checkout -q -f "$TREE"
tree_sha="$(git -C "$wt" rev-parse HEAD)"
rule_sha="$(git -C "$CLONE" rev-parse "$RULE^{commit}")"
# The declaration as of RULE. A dependency-cruiser config renamed over history (.js/.cjs/.json) is taken under the name
# it had at RULE.
cfg_used=""
for f in $CFG; do
  found=""
  alts="$f"
  case "$f" in .dependency-cruiser.*) alts="$f .dependency-cruiser.js .dependency-cruiser.cjs .dependency-cruiser.json .dependency-cruiser.mjs";; esac
  for a in $alts; do
    if git -C "$CLONE" cat-file -e "$rule_sha:$( [ "$SCOPE" = . ] && echo "$a" || echo "$SCOPE/$a")" 2>/dev/null; then found="$a"; break; fi
  done
  [ -n "$found" ] || { echo "declaration $f not found at $rule_sha"; exit 1; }
  mkdir -p "$(dirname "$wt/$SCOPE/$found")"
  git -C "$CLONE" show "$rule_sha:$( [ "$SCOPE" = . ] && echo "$found" || echo "$SCOPE/$found")" > "$wt/$SCOPE/$found"
  cfg_used="$cfg_used $found"
done
cfg_used="${cfg_used# }"
dir="$wt/$SCOPE"
[ -e "$dir/node_modules" ] || ln -sfn "$TOOLNM" "$dir/node_modules"
raw="$WORK/raw/$safe.json"
# Workspaces whose root tsconfig lists no files (Nx tsconfig.base.json): a harness tsconfig that extends it and includes
# the linted directories, for the DaedalusArch extraction and the TypeScript-compiler evidence only.
if [ -n "${HARNESS_BASE:-}" ]; then
  inc=""; for d in $ARGS; do inc="$inc\"$d/**/*.ts\",\"$d/**/*.tsx\","; done
  printf '{"extends":"./%s","compilerOptions":{"noEmit":true},"include":[%s],"exclude":["**/node_modules/**","**/dist/**"]}\n' "$HARNESS_BASE" "${inc%,}" > "$dir/declared-rules.tsconfig.json"
  TSCONFIG=declared-rules.tsconfig.json
fi
set +e
if [ "$FAMILY" = depcruise ]; then
  first_cfg="${cfg_used%% *}"
  # shellcheck disable=SC2086
  (cd "$dir" && "$TOOLNM/.bin/depcruise" --config "$first_cfg" $ARGS --output-type json > "$raw" 2> "$raw.err")
  rc=$?
else
  # Declaration from the team's own resolved config, then the team's plugin with a minimal config (one rule).
  export NX_DAEMON=false NX_CACHE_DIRECTORY="$wt/.nx-cache" NX_PROJECT_GRAPH_CACHE_DIRECTORY="$wt/.nx-graph" NX_WORKSPACE_DATA_DIRECTORY="$wt/.nx-data" NX_SKIP_NX_CACHE=true NX_NO_CLOUD=true
  (cd "$dir" && ESLINT_USE_FLAT_CONFIG="$PRINTFLAT" "$TOOLNM/.bin/eslint" --print-config "$PROBE" > "$raw.print.json" 2> "$raw.print.err")
  # shellcheck disable=SC2086
  (cd "$dir" && git ls-files -- $ARGS | grep -E '\.(ts|tsx|mts|cts)$' | grep -v '\.d\.ts$' > "$raw.files.txt")
  (cd "$dir" && ESLINT_USE_FLAT_CONFIG="$PRINTFLAT" node "$REPO_ROOT/scripts/v1.3/declared-rules-eslint.mjs" effective --rule "$RULEIDS" \
    --files "$raw.files.txt" --eslint-module eslint --flat "$PRINTFLAT" --out "$raw.effective.json" 2> "$raw.effective.err") || true
  eff_arg=(); [ -s "$raw.effective.json" ] && eff_arg=(--effective "$raw.effective.json")
  graph_arg=()
  if [ "$FAMILY" = nx ]; then
    (cd "$dir" && "$TOOLNM/.bin/nx" graph --file="$raw.graph.json" > "$raw.graph.log" 2>&1)
    graph_arg=(--graph "$raw.graph.json")
  fi
  if [ "$RUNFLAT" = true ]; then mini="declared-rules.eslint.config.mjs"; else mini="declared-rules.eslintrc.json"; fi
  node "$REPO_ROOT/scripts/v1.3/declared-rules-eslint.mjs" build --family "$FAMILY" --print "$raw.print.json" "${eff_arg[@]}" "${graph_arg[@]}" \
    --rule "$RULEIDS" --plugin "$PLUGIN" --plugin-key "$PLUGINKEY" --parser "$PARSER" --flat "$RUNFLAT" \
    --decl-out "$raw.decl.json" --config-out "$dir/$mini" ${ESLINTRC:+--eslintrc "$dir/$ESLINTRC"}
  DECL="$raw.decl.json"
  if [ "$RUNFLAT" = true ]; then
    # shellcheck disable=SC2086
    (cd "$dir" && ESLINT_USE_FLAT_CONFIG=true "$TOOLNM/.bin/eslint" -c "$mini" --format json --output-file "$raw" $ARGS > "$raw.log" 2> "$raw.err")
  else
    # shellcheck disable=SC2086
    (cd "$dir" && ESLINT_USE_FLAT_CONFIG=false "$TOOLNM/.bin/eslint" --no-eslintrc -c "$mini" --ext .ts,.tsx --format json --output-file "$raw" $ARGS > "$raw.log" 2> "$raw.err")
  fi
  rc=$?
fi
set -e
if [ ! -s "$raw" ]; then echo "tool produced no output (rc=$rc):"; tail -5 "$raw.err"; exit 1; fi
cat > "$WORK/raw/$safe.case.json" <<EOF
{"id":"$ID","repo":"$REPO","sha":"$tree_sha","family":"$FAMILY","root":"$dir","tsconfig":"$dir/$TSCONFIG",
 "configPath":"$SCOPE/$cfg_used","toolVersion":"$TOOLVER","theirs":"$raw","out":"$OUT"
 $( [ -n "${DECL:-}" ] && echo ",\"decl\":\"$DECL\"" )
 $( [ -n "${RULEIDS:-}" ] && echo ",\"ruleIds\":[\"${RULEIDS//,/\",\"}\"]" )
 $( [ "$tree_sha" != "$rule_sha" ] || [ -n "${REASON:-}" ] && echo ",\"history\":{\"ruleCommit\":\"$rule_sha\",\"treeCommit\":\"$tree_sha\",\"reason\":\"${REASON:-}\"}" )}
EOF
(cd "$REPO_ROOT" && npx tsx scripts/v1.3/declared-rules-run.ts case "$WORK/raw/$safe.case.json")
if [ "${KEEP:-1}" != 1 ]; then git -C "$CLONE" worktree remove --force "$wt" >/dev/null 2>&1 || true; rm -rf "$wt"; git -C "$CLONE" worktree prune; fi
