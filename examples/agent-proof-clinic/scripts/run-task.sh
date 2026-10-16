#!/bin/bash
# usage: run-task.sh N   (runs task N with the headless agent, then the independent evaluation)
set -u
SP=/private/tmp/claude-501/-Volumes-Life-OS-Users-Arkatechie-Development-Archi-Firewall-DaedalusArch/3ea7dab4-b64a-4481-829e-334a9bfa22a1/scratchpad
A=$SP/agentproof-app; W=$SP/wt-agentproof; R=$SP/runs; N=$1; SID=$(cat $R/session-id)
export HEAVY_ADMISSION_BYPASS=1
if [ "$N" = "1" ]; then SESS=(--session-id "$SID"); else SESS=(--resume "$SID"); fi
cd $A
start=$(date +%s)
claude -p "$(cat $R/prompts/task$N.txt)" "${SESS[@]}" \
  --mcp-config $R/mcp-config.json --strict-mcp-config \
  --allowedTools "mcp__daedalus__*,Read,Write,Edit,Bash(npx tsc*)" \
  --permission-mode default \
  --output-format stream-json --verbose > $R/task$N.jsonl 2> $R/task$N.stderr
echo "agent exit=$? wall=$(( $(date +%s) - start ))s" > $R/task$N.meta
# independent checks
( cd $A && npx tsc --noEmit -p tsconfig.json > $R/tsc$N.txt 2>&1; echo "tsc exit=$?" >> $R/task$N.meta )
( cd $W && APG_STORE_PATH=$R/apg-store-cli node $SP/scripts/firewall-cli.cjs evaluate --project $A --spec $A/architecture.yaml \
    --symbolic-only --engine cypher-interp --tsconfig $A/tsconfig.json --format json > $R/eval$N.json 2> $R/eval$N.stderr; echo "eval exit=$?" >> $R/task$N.meta )
cd $A && git add -A >/dev/null && git -c user.name=agentproof -c user.email=agentproof@local commit -qm "after task $N" && git rev-parse --short HEAD >> $R/task$N.meta
cat $R/task$N.meta
