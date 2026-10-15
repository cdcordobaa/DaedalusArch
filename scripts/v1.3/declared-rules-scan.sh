#!/usr/bin/env bash
# Cheap history scan (team-declared-rules study, dependency-cruiser repositories): run the team's pinned
# dependency-cruiser, with the declaration of each commit, on every first-parent commit that touches SCOPE since the
# declaration exists, and print one line per commit: <sha> <violations of RULES> <all violations> [error]. Commits with
# a violation of RULES become full comparison cases (declared-rules-case.sh). One reused worktree; nothing committed.
# Environment: CLONE, SCOPE (tool run directory), SRC (path filter for the history, e.g. packages/x/src), CFGPATH,
#              TOOLNM, ARGS, RULES (regex of the rule names to count), WORK, SPARSE (optional)
set -uo pipefail
: "${CLONE:?}" "${SCOPE:?}" "${SRC:?}" "${CFGPATH:?}" "${TOOLNM:?}" "${ARGS:?}" "${RULES:?}" "${WORK:?}"
wt="$WORK/wt/scan-$(basename "$CLONE")"
git -C "$CLONE" worktree remove --force "$wt" >/dev/null 2>&1 || true; rm -rf "$wt"; git -C "$CLONE" worktree prune
first="$(git -C "$CLONE" log --format=%H --diff-filter=A -- "$CFGPATH" | tail -1)"
[ -n "$first" ] || first="$(git -C "$CLONE" log --format=%H --follow --diff-filter=A -- "$CFGPATH" | tail -1)"
git -C "$CLONE" worktree add -q --detach --no-checkout "$wt" "$first"
# shellcheck disable=SC2086
[ -n "${SPARSE:-}" ] && git -C "$wt" sparse-checkout set --no-cone $SPARSE
for c in $(git -C "$CLONE" log --first-parent --reverse --format=%H "$first^.." -- "$SRC" 2>/dev/null || git -C "$CLONE" log --first-parent --reverse --format=%H -- "$SRC"); do
  git -C "$wt" checkout -q -f "$c" 2>/dev/null || { echo "$c - - checkout-failed"; continue; }
  dir="$wt/$SCOPE"
  cfg=""
  for a in .dependency-cruiser.js .dependency-cruiser.cjs .dependency-cruiser.json .dependency-cruiser.mjs; do [ -f "$dir/$a" ] && { cfg="$a"; break; }; done
  [ -n "$cfg" ] || { echo "$c - - no-config"; continue; }
  [ -e "$dir/node_modules" ] || ln -sfn "$TOOLNM" "$dir/node_modules"
  # shellcheck disable=SC2086
  out="$(cd "$dir" && "$TOOLNM/.bin/depcruise" --config "$cfg" $ARGS --output-type json 2>/dev/null)"
  if [ -z "$out" ]; then echo "$c - - tool-failed"; continue; fi
  echo "$out" | RULES="$RULES" node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const v = JSON.parse(s).summary.violations; const re = new RegExp(process.env.RULES);
      console.log(process.argv[1], v.filter((x) => re.test(x.rule.name)).length, v.length);
    });' "$c"
  rm -f "$dir/node_modules"
done
git -C "$CLONE" worktree remove --force "$wt" >/dev/null 2>&1 || true; rm -rf "$wt"; git -C "$CLONE" worktree prune
