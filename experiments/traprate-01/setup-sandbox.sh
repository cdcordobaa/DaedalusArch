#!/bin/sh
# TRAPRATE-01 sandbox layout (run as root from the repository root; zero model calls).
#   sh experiments/traprate-01/setup-sandbox.sh          set up /srv, the generator user, seeds, canaries and the input,
#                                                        run the listing check and the fingerprint sweep as the generator
#                                                        user, and close the clone (chmod 700, nothing moved)
#   sh experiments/traprate-01/setup-sandbox.sh --open   reopen the clone (755) after generation
# Layout: experiments/puzzle-01-baseline/isolation.md, as PUZZLE-04's setup-sandbox.sh applies it. The clone is never
# moved or removed (it holds the coordinating session's working directory); it is only closed with chmod 700.
set -eu
REPO=$(pwd)
[ -f "$REPO/experiments/traprate-01/plan.md" ] || { echo "run from the repository root" >&2; exit 2; }
if [ "${1:-}" = "--open" ]; then chmod 755 "$REPO"; echo "clone reopened"; exit 0; fi
EVID="$REPO/results/v1.5-traprate-01/isolation"
mkdir -p "$EVID"

getent group gen >/dev/null || groupadd -g 1500 gen
id gen >/dev/null 2>&1 || useradd -u 1500 -g 1500 -M -d /srv/gh -s /bin/sh gen

mkdir -p /srv/bin /srv/gh /srv/h/bin /srv/w /srv/o /srv/vault
chmod 755 /srv /srv/bin /srv/h /srv/h/bin /srv/w
chmod 700 /srv/o /srv/vault
chown 1500:1500 /srv/gh && chmod 700 /srv/gh

# npm behind the cloud proxy: trust the container CA bundle when there is one (environment fix, as in the v1.3 pilot).
if [ -f /root/.ccr/ca-bundle.crt ] && ! grep -q '^cafile=' /root/.npmrc 2>/dev/null; then echo 'cafile=/root/.ccr/ca-bundle.crt' >> /root/.npmrc; fi

# The baseline wrapper, byte for byte.
install -m 0755 -o root -g root results/v1.4-puzzle-01-baseline/isolation/gclaude.sh /srv/bin/gclaude

# Input, seeds, canaries, private map (zero calls).
npx tsx experiments/traprate-01/make-input.ts --o /srv/o --vault /srv/vault --clone "$REPO"
chmod -R go-rwx /srv/o /srv/vault
[ -d /tmp/tsx-0 ] && chmod 700 /tmp/tsx-0

# Close the clone (never moved): the generator user must not read the repository.
chmod 700 "$REPO"

# Check 1, listing: as gen, every closed path must be unreadable.
{
  for p in "$REPO" "$REPO/experiments/trap-families/study-set.json" /srv/o /srv/o/input.json /srv/vault /srv/vault/canary.txt /root; do
    if setpriv --reuid=1500 --regid=1500 --clear-groups sh -c "cat '$p' >/dev/null 2>&1 || ls '$p' >/dev/null 2>&1"; then echo "READABLE $p"; else echo "denied $p"; fi
  done
} > "$EVID/listing.txt" 2>&1

# Check 2, fingerprint sweep: as gen, no readable file anywhere holds a task id, a canary, a later-step request phrase
# or a trap-family word (the patterns are written to a root-only file, then handed to grep through stdin).
node - "$REPO" > /srv/vault/sweep-patterns.txt <<'EOF'
const fs = require('node:fs'); const path = require('node:path');
const repo = process.argv[2];
const input = JSON.parse(fs.readFileSync('/srv/o/input.json', 'utf8'));
const map = JSON.parse(fs.readFileSync('/srv/vault/private-id-map.json', 'utf8'));
const pats = new Set([...input.readProbe.forbidden, 'trap-families', 'TRAP-FAMILIES', 'TRAPRATE-01', 'winning line', 'trap line']);
for (const t of input.tasks) for (const s of t.steps.slice(1)) pats.add(s.slice(0, 40));
for (const v of Object.values(map)) pats.add(v.task);
process.stdout.write([...pats].filter((p) => p.length >= 8).join('\n') + '\n');
EOF
chmod 600 /srv/vault/sweep-patterns.txt
# The patterns are piped (`-f -`): as gen, reopening a root-owned stdin through /dev/stdin is denied and the search
# would never run. grep exits 2 on any unreadable directory, so its code proves nothing; a positive control in the
# generator home must be found instead.
head -n 1 /srv/vault/sweep-patterns.txt > /srv/gh/sweep-control.txt && chown 1500:1500 /srv/gh/sweep-control.txt
cat /srv/vault/sweep-patterns.txt | setpriv --reuid=1500 --regid=1500 --clear-groups sh -c "grep -rIlF -f - / --exclude-dir=proc --exclude-dir=sys --exclude-dir=dev 2>/dev/null" > "$EVID/sweep-raw.txt" || true
rm -f /srv/gh/sweep-control.txt
if ! grep -qx /srv/gh/sweep-control.txt "$EVID/sweep-raw.txt"; then
  echo "SWEEP DID NOT RUN (positive control not found): plan §2: STOP" >&2; exit 1
fi
grep -vx /srv/gh/sweep-control.txt "$EVID/sweep-raw.txt" > "$EVID/sweep.txt" || true
rm -f "$EVID/sweep-raw.txt"
if grep -q READABLE "$EVID/listing.txt" || [ -s "$EVID/sweep.txt" ]; then
  echo "ISOLATION NOT ACHIEVED: see $EVID/listing.txt and $EVID/sweep.txt (plan §2: STOP)" >&2
  exit 3
fi
echo "sandbox ready; listing denied, sweep empty; clone closed (reopen with --open)"
