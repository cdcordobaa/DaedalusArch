#!/bin/sh
# DRIFT-01 sandbox layout (run as root from the repository root; zero model calls). Design: ops/notes/drift-01-design.md §3.
#   sh experiments/drift-01/setup-sandbox.sh          set up /srv, the generator user, canaries, the input file, and
#                                                     close the clone in place (root 0700)
#   sh experiments/drift-01/setup-sandbox.sh --open   reopen the clone (0755) after the run
# The layout is the PUZZLE-01 baseline's with the PUZZLE-02 MCP relay and the edit gate's relay. The clone is never
# moved or removed (it holds the session's working directory): it is closed with chmod and reopened at the end.
set -eu
REPO=$(pwd)
[ -f "$REPO/experiments/drift-01/run-drift.ts" ] || { echo "run from the repository root" >&2; exit 2; }
if [ "${1:-}" = "--open" ]; then chmod 755 "$REPO"; echo "clone reopened"; exit 0; fi

getent group gen >/dev/null || groupadd -g 1500 gen
id gen >/dev/null 2>&1 || useradd -u 1500 -g 1500 -M -d /srv/gh -s /bin/sh gen

mkdir -p /srv/bin /srv/gh /srv/h/bin /srv/w /srv/m /srv/o/specs /srv/o/seeds /srv/o/edits /srv/o/out/mcp /srv/o/out/gate
chmod 755 /srv /srv/bin /srv/h /srv/h/bin /srv/w /srv/m
chmod 700 /srv/o
chown 1500:1500 /srv/gh && chmod 700 /srv/gh

# The baseline wrapper, byte for byte; the two relays (no task text).
install -m 0755 -o root -g root results/v1.4-puzzle-01-baseline/isolation/gclaude.sh /srv/bin/gclaude
install -m 0755 -o root -g root experiments/drift-01/mcp-relay.cjs /srv/h/bin/mcp-relay.cjs
install -m 0755 -o root -g root experiments/edit-gate/gate-relay.cjs /srv/h/bin/gate-relay.cjs

# Seeds (the builder regenerates S1's ports/out, which .gitignore kept out of the committed tree).
node experiments/pilot-hexddd-01/seeds/build-seeds.mjs >/dev/null
node experiments/pilot-hexddd-01/seeds/build-seeds.mjs --check
rm -rf /srv/o/seeds/t1 /srv/o/seeds/t2 /srv/o/seeds/d1
cp -r experiments/pilot-hexddd-01/seeds/s2-ddd-debt /srv/o/seeds/t1
cp -r experiments/pilot-hexddd-01/seeds/s1-hex-debt /srv/o/seeds/t2
cp -r experiments/edit-gate/fixtures/dummy/seed /srv/o/seeds/d1
cp experiments/edit-gate/fixtures/dummy/edits/SettleInvoices.violating.ts /srv/o/edits/d1.ts

C1=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C2=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C3=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C4=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
# Specs under neutral names, each with a canary first line (a YAML comment).
{ echo "# $C1"; cat experiments/pilot-hexddd-01/specs/s2-ddd.yaml; } > /srv/o/specs/t1.yaml
{ echo "# $C1"; cat experiments/pilot-hexddd-01/specs/s1-hexagonal.yaml; } > /srv/o/specs/t2.yaml
{ echo "# $C4"; cat experiments/edit-gate/fixtures/dummy/spec.yaml; } > /srv/o/specs/d1.yaml
echo "$C2" > /srv/o/canary.txt
echo "$C3" > /srv/o/out/canary.txt
chmod -R go-rwx /srv/o

S1=$(python3 -c 'import json;print(json.load(open("experiments/pilot-hexddd-01/seeds/seeds.sha256.json"))["seeds"]["s1-hex-debt"]["treeSha256"])')
S2=$(python3 -c 'import json;print(json.load(open("experiments/pilot-hexddd-01/seeds/seeds.sha256.json"))["seeds"]["s2-ddd-debt"]["treeSha256"])')

REPO="$REPO" C1="$C1" C2="$C2" C3="$C3" C4="$C4" S1="$S1" S2="$S2" NODE="$(command -v node)" python3 - <<'EOF'
import json, os
R = os.environ['REPO']
tasks = {t['id']: t for t in json.load(open(f'{R}/experiments/pilot-hexddd-01/tasks.json'))['tasks']}
req = lambda tid: [s['request'] for s in tasks[tid]['steps']]
later = lambda tid, n: [s['request'][:n] for s in tasks[tid]['steps'][1:]]
inp = {
  "modelId": "claude-sonnet-5-5",
  "binary": "/srv/bin/gclaude",
  "harnessRoot": "/srv/h", "workRoot": "/srv/w", "outRoot": "/srv/o/out",
  "genUid": 1500, "genGid": 1500, "genHome": "/srv/gh",
  "orderSeed": 20261023, "replicates": 3, "arms": ["none", "pull", "gate"],
  "timeoutMs": 1200000,
  "caps": {"checks": 4, "sessions": 90, "total": 94, "redrawCalls": 12},
  "mcp": {"nodeBinary": os.environ['NODE'], "relay": "/srv/h/bin/mcp-relay.cjs", "socket": "/srv/m/s.sock", "tsx": f"{R}/node_modules/.bin/tsx", "serverEntry": f"{R}/experiments/detect-02/mcp/main.ts", "logDir": "/srv/o/out/mcp"},
  "gate": {"nodeBinary": os.environ['NODE'], "relay": "/srv/h/bin/gate-relay.cjs", "socket": "/srv/m/g.sock", "logDir": "/srv/o/out/gate"},
  "tasks": [
    {"id": "t1", "seedDir": "/srv/o/seeds/t1", "seedTreeSha256": os.environ['S2'], "specPath": "/srv/o/specs/t1.yaml", "steps": req('s2-orders-invoices')},
    {"id": "t2", "seedDir": "/srv/o/seeds/t2", "seedTreeSha256": os.environ['S1'], "specPath": "/srv/o/specs/t2.yaml", "steps": req('s1-hotel-bookings')},
  ],
  "dummy": {"seedDir": "/srv/o/seeds/d1", "specPath": "/srv/o/specs/d1.yaml", "editFile": "src/billing/application/SettleInvoices.ts", "editContent": "/srv/o/edits/d1.ts"},
  "probe": {"outsideProject": "/srv/w"},
  "isolation": {
    "denied": ["/srv/o/specs/t1.yaml", "/srv/o/input.json", "/srv/o/canary.txt", "/srv/o/out/canary.txt", "/srv/o/seeds/t1",
               f"{R}/ops/notes/drift-01-design.md", f"{R}/experiments/drift-01/run-drift.ts", f"{R}/experiments/pilot-hexddd-01/tasks.json",
               f"{R}/experiments/edit-gate/hub.ts", "/root", "/tmp/claude-0"],
    "canaries": [os.environ[k] for k in ('C1', 'C2', 'C3', 'C4')],
    "readProbePaths": [f"{R}/experiments/pilot-hexddd-01/tasks.json", "/srv/o/specs/t1.yaml", "/srv/o/canary.txt", "/srv/o/out/canary.txt"],
    "sweepPatterns": [os.environ[k] for k in ('C1', 'C2', 'C3', 'C4')] + ["DRIFT-01", "HEXDDD-01", "s2-orders-invoices", "s1-hotel-bookings",
               "Edit-gate hub (v1.5-exp", "Edit-gate dummy project spec"] + later('s2-orders-invoices', 60) + later('s1-hotel-bookings', 60),
  },
}
json.dump(inp, open('/srv/o/input.json', 'w'), indent=2)
EOF
chmod 600 /srv/o/input.json

[ -d /tmp/tsx-0 ] && chmod 700 /tmp/tsx-0
# Close the clone in place (never moved): the generator user must not read the repository.
chmod 700 "$REPO"
echo "sandbox ready; clone closed (reopen with --open)"
