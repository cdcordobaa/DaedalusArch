#!/bin/sh
# v1.5 final study sandbox layout (run as root from the repository root; zero model calls).
#   sh experiments/v15-study/setup-sandbox.sh [replicates]   set up /srv, the generator user, seeds, specs, canaries and
#                                                            the input; close the clone (chmod 700, nothing moved); run
#                                                            the listing check, the piped fingerprint sweep with a
#                                                            positive control, and the scripted S4 checks (design §6)
#   sh experiments/v15-study/setup-sandbox.sh --open         reopen the clone (755) after the run
# Layout: TRAPRATE-01's (experiments/traprate-01/setup-sandbox.sh, the PUZZLE-01 isolation method) plus the delivery
# hub: the two relays in /srv/h/bin, the sockets in /srv/m, the hub logs in /srv/o/out/hub (root-only). The clone is
# never moved or removed (it holds the coordinating session's working directory); it is only closed with chmod 700.
# Evidence: results/v1.5-study/isolation/ (listing.txt, sweep.txt, s4-result.json).
set -eu
REPO=$(pwd)
[ -f "$REPO/experiments/v15-study/run-study.ts" ] || { echo "run from the repository root" >&2; exit 2; }
if [ "${1:-}" = "--open" ]; then chmod 755 "$REPO"; echo "clone reopened"; exit 0; fi
R="${1:-3}"
EVID="$REPO/results/v1.5-study/isolation"
mkdir -p "$EVID"

getent group gen >/dev/null || groupadd -g 1500 gen
id gen >/dev/null 2>&1 || useradd -u 1500 -g 1500 -M -d /srv/gh -s /bin/sh gen

mkdir -p /srv/bin /srv/gh /srv/h/bin /srv/w /srv/m /srv/o/out/hub /srv/vault
chmod 755 /srv /srv/bin /srv/h /srv/h/bin /srv/w /srv/m
chmod 700 /srv/o /srv/o/out /srv/o/out/hub /srv/vault
chown 1500:1500 /srv/gh && chmod 700 /srv/gh

# npm behind the cloud proxy: trust the container CA bundle when there is one (environment fix, as in the v1.3 pilot).
if [ -f /root/.ccr/ca-bundle.crt ] && ! grep -q '^cafile=' /root/.npmrc 2>/dev/null; then echo 'cafile=/root/.ccr/ca-bundle.crt' >> /root/.npmrc; fi

# The baseline wrapper, byte for byte; the two relays (no task text): the edit gate's hook relay and the MCP relay.
install -m 0755 -o root -g root results/v1.4-puzzle-01-baseline/isolation/gclaude.sh /srv/bin/gclaude
install -m 0755 -o root -g root src/v15-instrument/edit-gate/gate-relay.cjs /srv/h/bin/gate-relay.cjs
install -m 0755 -o root -g root experiments/puzzle-04/mcp-relay.cjs /srv/h/bin/mcp-relay.cjs

# CLI pin (design §5.1). The frozen child environment is allow-listed (no DISABLE_AUTOUPDATER reaches the CLI), so the
# guard is the file system: the CLI runs as gen, and gen must not be able to write the root-owned install. Recorded
# here; the driver also reads the version before every turn and stops the run on any change.
CLI_REAL=$(readlink -f /opt/claude-code/bin/claude 2>/dev/null || echo /opt/claude-code/bin/claude)
{
  /opt/claude-code/bin/claude --version 2>&1 || echo "no CLI at /opt/claude-code/bin/claude"
  if setpriv --reuid=1500 --regid=1500 --clear-groups sh -c "test -w '$CLI_REAL' || test -w '$(dirname "$CLI_REAL")'"; then echo "WARNING: the CLI install is writable by the generator"; else echo "CLI install not writable by the generator"; fi
} > "$EVID/cli-version.txt"

# Input, seeds, specs, canaries, private map, sweep patterns (zero calls).
npx tsx experiments/v15-study/make-input.ts --o /srv/o --vault /srv/vault --clone "$REPO" --replicates "$R" --srv /srv
chmod -R go-rwx /srv/o /srv/vault
[ -d /tmp/tsx-0 ] && chmod 700 /tmp/tsx-0

# Close the clone (never moved): the generator user must not read the repository.
chmod 700 "$REPO"

# Check 1, listing: as gen, every closed path of design §6 item 1 must be unreadable (the input's list, plus the
# clone, the input, the vault and /root).
node -e 'const i=JSON.parse(require("fs").readFileSync("/srv/o/input.json","utf8")); process.stdout.write([...new Set([process.argv[1],"/srv/o","/srv/o/input.json","/srv/vault","/srv/o/out/hub","/root",...i.isolation.denied])].join("\n")+"\n")' "$REPO" > /srv/vault/listing-paths.txt
{
  while IFS= read -r p; do
    if setpriv --reuid=1500 --regid=1500 --clear-groups sh -c "cat '$p' >/dev/null 2>&1 || ls '$p' >/dev/null 2>&1"; then echo "READABLE $p"; else echo "denied $p"; fi
  done < /srv/vault/listing-paths.txt
} > "$EVID/listing.txt" 2>&1
sed -i "s|$REPO|<clone>|g" "$EVID/listing.txt"

# Check 2, fingerprint sweep: as gen, no readable file anywhere holds a canary, a task id, a later-step request
# phrase, a trap-family word, the note title, the hub header or the spec header. The patterns are piped (`-f -`):
# as gen, reopening a root-owned stdin through /dev/stdin is denied and the search would never run. grep exits 2 on
# any unreadable directory, so its code proves nothing; a positive control in the generator home must be found.
head -n 1 /srv/vault/sweep-patterns.txt > /srv/gh/sweep-control.txt && chown 1500:1500 /srv/gh/sweep-control.txt
cat /srv/vault/sweep-patterns.txt | setpriv --reuid=1500 --regid=1500 --clear-groups sh -c "grep -rIlF -f - / --exclude-dir=proc --exclude-dir=sys --exclude-dir=dev 2>/dev/null" > /srv/vault/sweep-raw.txt || true
rm -f /srv/gh/sweep-control.txt
if ! grep -qx /srv/gh/sweep-control.txt /srv/vault/sweep-raw.txt; then
  echo "SWEEP DID NOT RUN (positive control not found): STOP" >&2; exit 1
fi
grep -vx /srv/gh/sweep-control.txt /srv/vault/sweep-raw.txt > "$EVID/sweep.txt" || true
echo "positive control found; $(wc -l < /srv/vault/sweep-patterns.txt) patterns" > "$EVID/sweep-control.txt"
if grep -q READABLE "$EVID/listing.txt" || [ -s "$EVID/sweep.txt" ]; then
  echo "ISOLATION NOT ACHIEVED: see $EVID/listing.txt and $EVID/sweep.txt (STOP)" >&2
  exit 3
fi

# Check 3, the scripted S4 (design §6 items 3–8; zero calls): hook relay refusals, MCP confinement, cross-channel
# isolation, settings and overlay writes with no effect (the real CLI against the scripted API), no leak, argv.
if ! npx tsx experiments/v15-study/run-study.ts --s4 --input /srv/o/input.json --evidence "$EVID"; then
  echo "S4 NOT CLEAN: see $EVID/s4-result.json (STOP)" >&2
  exit 4
fi
echo "sandbox ready; listing denied, sweep empty, S4 clean; clone closed (reopen with --open)"
