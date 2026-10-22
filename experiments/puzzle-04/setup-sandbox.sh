#!/bin/sh
# PUZZLE-04 sandbox layout (run as root from the repository root; zero model calls).
#   sh experiments/puzzle-04/setup-sandbox.sh          set up /srv, the generator user, specs, seeds, canaries, the
#                                                      two input files, and close the clone (chmod 700, nothing moved)
#   sh experiments/puzzle-04/setup-sandbox.sh --open   reopen the clone (755) after generation
# The layout is the PUZZLE-01 baseline's (experiments/puzzle-01-baseline/isolation.md) as the edit gate and the
# PUZZLE-02 pull arm extended it: the gate relay and the MCP relay in the harness root, both hub sockets in /srv/m,
# specs, seeds, logs and records root-only under /srv/o. Isolation lesson of 2026-10-22: the clone is never moved or
# removed (it holds the coordinating session's working directory); it is only closed with chmod 700.
set -eu
REPO=$(pwd)
[ -f "$REPO/experiments/puzzle-04/plan.md" ] || { echo "run from the repository root" >&2; exit 2; }
if [ "${1:-}" = "--open" ]; then chmod 755 "$REPO"; echo "clone reopened"; exit 0; fi

getent group gen >/dev/null || groupadd -g 1500 gen
id gen >/dev/null 2>&1 || useradd -u 1500 -g 1500 -M -d /srv/gh -s /bin/sh gen

mkdir -p /srv/bin /srv/gh /srv/h/bin /srv/w /srv/m /srv/o/specs /srv/o/seeds /srv/o/edits /srv/o/gate/out/gate /srv/o/pull/out/mcp
chmod 755 /srv /srv/bin /srv/h /srv/h/bin /srv/w /srv/m
chmod 700 /srv/o
chown 1500:1500 /srv/gh && chmod 700 /srv/gh

# The baseline wrapper, byte for byte; the two relays (no puzzle text).
install -m 0755 -o root -g root results/v1.4-puzzle-01-baseline/isolation/gclaude.sh /srv/bin/gclaude
install -m 0755 -o root -g root experiments/edit-gate/gate-relay.cjs /srv/h/bin/gate-relay.cjs
install -m 0755 -o root -g root experiments/puzzle-04/mcp-relay.cjs /srv/h/bin/mcp-relay.cjs

# Neutral task ids (private map: /srv/o/task-map.json, committed after generation).
P1=experiments/puzzle-01/puzzles/p1-transfers
P2=experiments/puzzle-01/puzzles/p2-loyalty
P3R=experiments/puzzle-03/puzzles/p3r-shipping-quotes
P5=experiments/puzzle-03/puzzles/p5-ferry-seats
P6=experiments/puzzle-03/puzzles/p6-workshop-jobs
set -- t1 "$P6" t2 "$P1" t3 "$P5" t4 "$P3R" t5 "$P2"
while [ $# -gt 0 ]; do
  cp "$2/spec.yaml" "/srv/o/specs/$1.yaml"
  rm -rf "/srv/o/seeds/$1" && cp -r "$2/seed" "/srv/o/seeds/$1"
  shift 2
done
cat > /srv/o/task-map.json <<EOF
{ "note": "private task map, committed after generation", "t1": "p6-workshop-jobs", "t2": "p1-transfers", "t3": "p5-ferry-seats", "t4": "p3r-shipping-quotes", "t5": "p2-loyalty" }
EOF

# The gate's smoke and probe run on the edit-gate dummy project (not puzzle material), as in the build.
C1=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C2=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C3=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
C4=$(npx tsx experiments/edit-gate/run-edit-gate.ts --canary)
{ echo "# $C1"; cat experiments/edit-gate/fixtures/dummy/spec.yaml; } > /srv/o/specs/d1.yaml
rm -rf /srv/o/seeds/d1 && cp -r experiments/edit-gate/fixtures/dummy/seed /srv/o/seeds/d1
cp experiments/edit-gate/fixtures/dummy/edits/SettleInvoices.violating.ts /srv/o/edits/d1.ts
echo "$C2" > /srv/o/canary.txt
echo "$C3" > /srv/o/gate/out/gate/canary.txt
echo "$C4" > /srv/o/pull/out/mcp/canary.txt

# Inputs. Steps and seed pins come from the puzzles' tasks.json and the seeds (equal to the baselines' inputs).
NODE=$(command -v node)
node - "$REPO" "$NODE" "$C1" "$C2" "$C3" "$C4" <<'EOF'
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const [repo, node, c1, c2, c3, c4] = process.argv.slice(2);
const map = JSON.parse(fs.readFileSync('/srv/o/task-map.json', 'utf8'));
const dirOf = { 'p1-transfers': 'experiments/puzzle-01/puzzles/p1-transfers', 'p2-loyalty': 'experiments/puzzle-01/puzzles/p2-loyalty', 'p3r-shipping-quotes': 'experiments/puzzle-03/puzzles/p3r-shipping-quotes', 'p5-ferry-seats': 'experiments/puzzle-03/puzzles/p5-ferry-seats', 'p6-workshop-jobs': 'experiments/puzzle-03/puzzles/p6-workshop-jobs' };
// treeSha of run-baseline.ts: sorted POSIX paths, "path\0sha256(content)\n" lines, sha256 of the whole.
const files = (d, r = '') => fs.readdirSync(path.join(d, r), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(d, r === '' ? e.name : `${r}/${e.name}`) : [r === '' ? e.name : `${r}/${e.name}`]));
const task = (id) => {
  const p = map[id];
  const steps = JSON.parse(fs.readFileSync(path.join(repo, dirOf[p], 'tasks.json'), 'utf8')).tasks[0].steps.map((s) => s.request);
  return { id, seedDir: `/srv/o/seeds/${id}`, seedTreeSha256: 'PIN', specPath: `/srv/o/specs/${id}.yaml`, steps };
};
const phrases = Object.keys(dirOf).flatMap((p) => JSON.parse(fs.readFileSync(path.join(repo, dirOf[p], 'tasks.json'), 'utf8')).tasks[0].steps.slice(1).map((s) => s.request.slice(0, 40)));
const denied = ['/srv/o/specs/d1.yaml', '/srv/o/specs/t1.yaml', '/srv/o/canary.txt', '/srv/o/gate/out/gate/canary.txt', '/srv/o/pull/out/mcp/canary.txt', '/srv/o/task-map.json', `${repo}/experiments/puzzle-04/plan.md`, `${repo}/experiments/edit-gate/hub.ts`, `${repo}/experiments/puzzle-01/puzzles/p1-transfers/README.md`, `${repo}/experiments/puzzle-03/puzzles/p6-workshop-jobs/README.md`, '/root', '/tmp/claude-0', '/tmp/tsx-0'];
const isolation = {
  denied,
  canaries: [c1, c2, c3, c4],
  sweepPatterns: [c1, c2, c3, c4, ...Object.keys(dirOf), 'PUZZLE-01', 'PUZZLE-03', 'PUZZLE-04', 'winning line', 'trap line', 'Edit-gate hub (v1.5-exp', 'Edit gate, layer checks', 'Edit-gate dummy project spec', ...phrases],
};
const common = { modelId: 'claude-sonnet-5-5', binary: '/srv/bin/gclaude', harnessRoot: '/srv/h', workRoot: '/srv/w', genUid: 1500, genGid: 1500, genHome: '/srv/gh', runs: 5, redrawPerTask: 1, timeoutMs: 1200000 };
const gate = {
  ...common, cliBinary: '/opt/claude-code/bin/claude', outRoot: '/srv/o/gate/out', orderSeed: 20261024,
  caps: { smoke: 1, probes: 1, sessions: 84, total: 86 },
  gate: { nodeBinary: node, relay: '/srv/h/bin/gate-relay.cjs', socket: '/srv/m/g.sock', logDir: '/srv/o/gate/out/gate', layers: true },
  dummy: { seedDir: '/srv/o/seeds/d1', specPath: '/srv/o/specs/d1.yaml', editFile: 'src/billing/application/SettleInvoices.ts', editContent: '/srv/o/edits/d1.ts' },
  tasks: ['t2', 't5', 't4', 't3', 't1'].map(task),
  isolation,
};
const pull = {
  ...common, outRoot: '/srv/o/pull/out', orderSeed: 20261025,
  caps: { smoke: 1, probes: 1, sessions: 33, total: 35 },
  mcp: { nodeBinary: node, relay: '/srv/h/bin/mcp-relay.cjs', socket: '/srv/m/s.sock', tsx: path.join(repo, 'node_modules/.bin/tsx'), serverEntry: path.join(repo, 'experiments/detect-02/mcp/main.ts'), logDir: '/srv/o/pull/out/mcp' },
  tasks: ['t3', 't1'].map(task),
  probe: { outsideProject: '/srv/w' },
};
fs.writeFileSync('/srv/o/gate-input.json', `${JSON.stringify(gate, null, 1)}\n`);
fs.writeFileSync('/srv/o/pull-input.json', `${JSON.stringify(pull, null, 1)}\n`);
EOF
# Seed pins: the driver's own treeSha (run-baseline.ts), checked against the baselines' pins in plan §1.
for f in /srv/o/gate-input.json /srv/o/pull-input.json; do
  npx tsx -e "
const fs=require('node:fs');const {treeSha}=require('$REPO/experiments/puzzle-01-baseline/run-baseline.ts');
const f='$f';const j=JSON.parse(fs.readFileSync(f,'utf8'));for(const t of j.tasks)t.seedTreeSha256=treeSha(t.seedDir);
fs.writeFileSync(f,JSON.stringify(j,null,1)+'\n');"
done
chmod -R go-rwx /srv/o

# Root's tsx compile cache holds compiled copies of what root ran (found readable by earlier sweeps).
[ -d /tmp/tsx-0 ] && chmod 700 /tmp/tsx-0

# Close the clone (never moved): the generator user must not read the repository.
chmod 700 "$REPO"
echo "sandbox ready; clone closed (reopen with --open)"
