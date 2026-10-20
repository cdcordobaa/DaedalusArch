#!/usr/bin/env bash
# External examiner for the confirmatory tasks' domains (the F23 check, for the new tasks). It replaces the author's own
# check, by the author's direction (2026-10-19): "just send an external examiner".
# A separate claude session (Fable), no tools, no MCP, no saved transcript, gets the 4 sealed tasks and the retired
# sealed Study 2 list on stdin. It prints a verdict that names no domain: only task numbers (1-4) and GO / NO-GO.
#   SEALED_ROOT=<abs path of daedalus-sealed> bash ops/review/2026-10-19/confirmatory-domain-examiner.sh
set -euo pipefail
S="${SEALED_ROOT:?set SEALED_ROOT to the daedalus-sealed folder}"
RETIRED="$S/v1.3-study2-tasks.md"
EXPECTED=82a2f512e50d4eafb4ce6a42335adc2b6c2f882a6238e298a747303d0090169c   # Docs/v1.3/sealed-hashes.md row 1
NEW="$S/v14-confirmatory/tasks.json"
[ "$(shasum -a 256 "$RETIRED" | cut -d' ' -f1)" = "$EXPECTED" ] || { echo "STOP: retired list hash mismatch (S14)"; exit 1; }
echo "retired list hash OK"
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT; cd "$WORK"
{
cat <<'EOF'
You are an external examiner for a master's thesis. Below are two lists:
(A) four NEW confirmatory tasks (a JSON file; number them 1-4 in file order);
(B) the RETIRED sealed task list of an earlier design.
Also treat these practice domains as excluded: repair café, school bus tracking, vineyard harvest, ice rink, tool-library,
bike-repair, choir-rehearsals, kayak-rentals, todo-list, recipe-box, book-club, gym-log, plant-care, chore-chart,
garden-plots, food-bank, youth-league, hive-health, market-vendors, shelter-adoptions, relief-volunteers, tide-tables,
stamp-catalogue; and anything about fitness or food.
"Overlap" = the same product domain, or close enough that practising one would help with the other (same core entities,
workflow or users). Also check the four new tasks are distinct from each other.
Your output is stored publicly. NEVER write any domain, title, entity, step text or paraphrase from (A) or (B).
Output exactly this, nothing else:
F23-CONF VERDICT: GO | NO-GO
Overlapping new tasks (numbers only, 1-4, or "none"): ...
Borderline new tasks (numbers only, or "none"): ...
New tasks too similar to each other (number pairs, or "none"): ...
Confidence: high | medium | low
===== (A) NEW TASKS =====
EOF
cat "$NEW"
echo; echo "===== (B) RETIRED LIST ====="
cat "$RETIRED"
} | claude -p --model claude-fable-5-1 --no-session-persistence --tools "" --strict-mcp-config 2>/dev/null \
  | grep -E '^(F23-CONF VERDICT|Overlapping new tasks|Borderline new tasks|New tasks too similar|Confidence):' || echo "(examiner gave no verdict block)"
