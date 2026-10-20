#!/usr/bin/env bash
# Blind writer of the 4 Layered confirmatory Study 2 tasks (decisions D7, EXPT; gate V10c). Run from the repository root:
#   bash ops/review/2026-10-19/confirmatory-writer.sh
# A separate claude session, no saved transcript, writes only under ../daedalus-sealed/v14-confirmatory/.
# What returns to the caller: the session's JSON summary, the re-run hint-audit counts and the sha256 of every file.
# Never the content. The session's raw output stays inside the sealed directory.
set -euo pipefail
ROOT="$(pwd)"
SEALED="${SEALED_DIR:-$ROOT/../daedalus-sealed/v14-confirmatory}"
PROMPT="$ROOT/ops/review/2026-10-19/confirmatory-writer-prompt.md"
[ -e "$SEALED/tasks.json" ] && { echo "STOP: $SEALED/tasks.json already exists; refusing to overwrite"; exit 2; }
mkdir -p "$SEALED"
before=$(git -C "$ROOT" status --porcelain | sort | shasum -a 256 | cut -d' ' -f1)
claude -p --model claude-opus-5-5 --no-session-persistence --strict-mcp-config \
  --allowedTools "Read" "Glob" "Grep" "Write" "Edit" "Bash(node Docs/v1.3/study2-task-design/hint-audit.mjs:*)" "Bash(node --check:*)" "Bash(mkdir:*)" "Bash(ls:*)" \
  --disallowedTools "WebFetch" "WebSearch" "Read($(dirname "$SEALED")/v1.3*)" \
  < <(sed "s#\.\./daedalus-sealed/v14-confirmatory#$SEALED#g" "$PROMPT") > "$SEALED/writer-session.out" 2> "$SEALED/writer-session.err" || true
after=$(git -C "$ROOT" status --porcelain | sort | shasum -a 256 | cut -d' ' -f1)
[ "$before" = "$after" ] && echo "repository untouched: yes" || echo "repository untouched: NO (inspect git status)"
python3 -I - "$SEALED/writer-session.out" <<'PY'
import json, re, sys
t = open(sys.argv[1]).read()
m = re.findall(r'\{[^{}]*"tasks"\s*:\s*\d+[^{}]*\}', t)
print("writer summary:", m[-1] if m else "(no JSON summary found; the raw output stays sealed)")
PY
if [ -f "$SEALED/tasks.json" ]; then
  ec=0; node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/layered.yaml --json "$SEALED/tasks.json" > "$SEALED/hint-audit.check.json" 2>/dev/null || ec=$?
  python3 -I -c "
import json,sys
d=json.load(open(sys.argv[1]))
def cnt(o,k):
  s=json.dumps(o); return s.count('\"'+k+'\"')
print('hint-audit re-run exit', sys.argv[2], '| FAIL', cnt(d,'FAIL'), '| WARN', cnt(d,'WARN'))" "$SEALED/hint-audit.check.json" "$ec" || echo "hint-audit re-run exit $ec"
  python3 -I -c "
import json,sys
d=json.load(open(sys.argv[1])); ts=d['tasks']
print('tasks', len(ts), '| steps per task', [len(t['steps']) for t in ts])" "$SEALED/tasks.json"
fi
(cd "$SEALED" && find . -type f ! -name 'writer-session.*' ! -name 'hint-audit.check.json' ! -name 'MANIFEST.sha256' | sort | while read -r f; do shasum -a 256 "$f"; done) > "$SEALED/MANIFEST.sha256"
echo "files sealed: $(wc -l < "$SEALED/MANIFEST.sha256" | tr -d ' ') (paths stay in the sealed MANIFEST; they contain task ids)"
echo "sha256 tasks.json:      $(shasum -a 256 "$SEALED/tasks.json" 2>/dev/null | cut -d' ' -f1)"
echo "sha256 MANIFEST.sha256: $(shasum -a 256 "$SEALED/MANIFEST.sha256" | cut -d' ' -f1)"
