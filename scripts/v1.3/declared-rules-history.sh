#!/usr/bin/env bash
# History mining for one repository (team-declared-rules study). Prints the candidate cases, one per line:
#   <treeCommit> <ruleCommit> <reason>
# (a) every commit C that touches the declaration: the parent tree under C's declaration (did C fix what its rules
#     forbid?); (b) every commit whose message names the tool or the architecture (same); (c) SAMPLES commits evenly
#     spaced over the first-parent history that touches SCOPE since the declaration exists, each under its own
#     declaration. Deterministic for a given clone state.
# Environment: CLONE, SCOPE, CFGPATH (declaration path relative to the clone root), SAMPLES (default 12),
#              KEYWORDS (default the regex below); caps for repositories with many candidates: PICKAXE (a regex: only
#              the declaration commits whose diff adds or removes a matching line, `git log -G`), KEYWORD_MAX (the
#              most recent keyword commits only).
set -euo pipefail
: "${CLONE:?}" "${SCOPE:?}" "${CFGPATH:?}"
SAMPLES="${SAMPLES:-12}"
KEYWORDS="${KEYWORDS:-depcruise|dependency.cruiser|boundar|module.bound|enforce-module|nx lint|circular|architect|layer|illegal (import|dependency)|swimlane|deep import}"
g() { git -C "$CLONE" "$@"; }
first="$(g log --format=%H --diff-filter=A --follow -- "$CFGPATH" | tail -1)"
{
  pick=(); [ -n "${PICKAXE:-}" ] && pick=(-G "$PICKAXE")
  for c in $(g log --format=%H "${pick[@]}" --follow -- "$CFGPATH"); do
    p="$(g rev-parse -q --verify "$c^" || true)"; [ -n "$p" ] && echo "$p $c config-change"
  done
  for c in $(g log --format=%H -i -E --grep="$KEYWORDS" "$first.." -- "$SCOPE" | head -n "${KEYWORD_MAX:-100000}"); do
    p="$(g rev-parse -q --verify "$c^" || true)"; [ -n "$p" ] && echo "$p $c keyword"
  done
  mapfile -t all < <(g log --first-parent --format=%H "$first.." -- "$SCOPE")
  n=${#all[@]}
  if [ "$n" -gt 0 ]; then
    k=$(( SAMPLES < n ? SAMPLES : n ))
    for i in $(seq 0 $(( k - 1 ))); do c="${all[$(( i * n / k ))]}"; echo "$c $c sample"; done
  fi
} | awk '!seen[$1" "$2]++'
