#!/bin/sh
# Edit-gate build smoke: sandbox layout (run as root from the repository root; zero model calls).
#   sh experiments/edit-gate/setup-sandbox.sh          set up /srv, the generator user, canaries, the input file,
#                                                      and close the clone (root 0700)
#   sh experiments/edit-gate/setup-sandbox.sh --open   reopen the clone (0755) after the smoke
# The layout is the PUZZLE-01 baseline's (experiments/puzzle-01-baseline/isolation.md) with the gate's two additions:
# the relay in the harness root and the hub's socket in /srv/m. The hub, its code and its logs stay root-only.
set -eu
REPO=$(pwd)
[ -f "$REPO/experiments/edit-gate/hub.ts" ] || { echo "run from the repository root" >&2; exit 2; }
if [ "${1:-}" = "--open" ]; then chmod 755 "$REPO"; echo "clone reopened"; exit 0; fi

getent group gen >/dev/null || groupadd -g 1500 gen
id gen >/dev/null 2>&1 || useradd -u 1500 -g 1500 -M -d /srv/gh -s /bin/sh gen

mkdir -p /srv/bin /srv/gh /srv/h/bin /srv/w /srv/m /srv/o/specs /srv/o/seeds /srv/o/edits /srv/o/out/gate
chmod 755 /srv /srv/bin /srv/h /srv/h/bin /srv/w /srv/m
chmod 700 /srv/o
chown 1500:1500 /srv/gh && chmod 700 /srv/gh

# The baseline wrapper, byte for byte.
install -m 0755 -o root -g root results/v1.4-puzzle-01-baseline/isolation/gclaude.sh /srv/bin/gclaude
# The relay (no puzzle text).
install -m 0755 -o root -g root experiments/edit-gate/gate-relay.cjs /srv/h/bin/gate-relay.cjs

C1=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C2=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C3=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
{ echo "# $C1"; cat experiments/edit-gate/fixtures/dummy/spec.yaml; } > /srv/o/specs/d1.yaml
rm -rf /srv/o/seeds/d1 && cp -r experiments/edit-gate/fixtures/dummy/seed /srv/o/seeds/d1
cp experiments/edit-gate/fixtures/dummy/edits/SettleInvoices.violating.ts /srv/o/edits/d1.ts
echo "$C2" > /srv/o/canary.txt
echo "$C3" > /srv/o/out/gate/canary.txt
chmod -R go-rwx /srv/o

cat > /srv/o/input.json <<EOF
{
  "modelId": "claude-sonnet-5-5",
  "binary": "/srv/bin/gclaude",
  "cliBinary": "/opt/claude-code/bin/claude",
  "harnessRoot": "/srv/h",
  "workRoot": "/srv/w",
  "outRoot": "/srv/o/out",
  "genUid": 1500,
  "genGid": 1500,
  "genHome": "/srv/gh",
  "orderSeed": 0,
  "runs": 0,
  "redrawPerTask": 0,
  "timeoutMs": 600000,
  "caps": { "smoke": 1, "probes": 1, "sessions": 0, "total": 4 },
  "gate": { "nodeBinary": "$(command -v node)", "relay": "/srv/h/bin/gate-relay.cjs", "socket": "/srv/m/g.sock", "logDir": "/srv/o/out/gate" },
  "dummy": { "seedDir": "/srv/o/seeds/d1", "specPath": "/srv/o/specs/d1.yaml", "editFile": "src/billing/application/SettleInvoices.ts", "editContent": "/srv/o/edits/d1.ts" },
  "tasks": [],
  "isolation": {
    "denied": ["/srv/o/specs/d1.yaml", "/srv/o/canary.txt", "/srv/o/out/gate/canary.txt", "$REPO/ops/notes/v15-edit-gate-design.md", "$REPO/experiments/edit-gate/hub.ts", "$REPO/experiments/puzzle-01/puzzles/p1-transfers/README.md", "/root", "/tmp/claude-0"],
    "canaries": ["$C1", "$C2", "$C3"],
    "sweepPatterns": ["$C1", "$C2", "$C3", "V15-PLAN step 2: the edit gate", "Edit-gate hub (v1.5-exp", "Edit-gate dummy project spec", "p1-transfers", "PUZZLE-01", "winning line", "trap line"]
  }
}
EOF
chmod 600 /srv/o/input.json

# Root's tsx compile cache holds compiled copies of the hub and tests (found readable by the fingerprint sweep).
[ -d /tmp/tsx-0 ] && chmod 700 /tmp/tsx-0

# Close the clone: the generator user must not read the repository (spec, puzzles, hub code, notes).
chmod 700 "$REPO"
echo "sandbox ready; clone closed (reopen with --open)"
