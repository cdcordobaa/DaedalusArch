#!/bin/sh
# COMPREHEND-01 pilot sandbox (revision R1; run as root from the repository root; zero model calls).
#   sh experiments/comprehend-01/setup-sandbox.sh <clones>   set up /srv, the generator user, the tree copies, the
#                                                             launcher and the isolation input; close the clone (0700)
#   sh experiments/comprehend-01/setup-sandbox.sh --open      reopen the clone (0755) after the pilot
# The layout is the PUZZLE-01 baseline's (experiments/puzzle-01-baseline/isolation.md), with one change from its
# lesson of 2026-10-22: the clone is never moved or removed, only closed with chmod, and every generator session runs
# from a copy of its tree under /srv/t. The generator (uid 1500) can read the tree copies, its own HOME and the
# neutral MCP configs; the repository, the clones, the real server configs and every output stay root-only.
set -eu
REPO=$(pwd)
[ -f "$REPO/experiments/comprehend-01/run.ts" ] || { echo "run from the repository root" >&2; exit 2; }
if [ "${1:-}" = "--open" ]; then chmod 755 "$REPO"; echo "clone reopened"; exit 0; fi
CLONES=${1:?usage: setup-sandbox.sh <clones>}
NODE=$(command -v node)

getent group gen >/dev/null || groupadd -g 1500 gen
id gen >/dev/null 2>&1 || useradd -u 1500 -g 1500 -M -d /srv/gh -s /bin/sh gen

mkdir -p /srv/bin /srv/gh /srv/t /srv/h/mcp /srv/o/mcp /srv/o/harness /srv/o/out
chmod 755 /srv /srv/bin /srv/t /srv/h /srv/h/mcp
chmod 700 /srv/o
chown 1500:1500 /srv/gh && chmod 700 /srv/gh

# The baseline wrapper, byte for byte, and a pre-step that empties the generator's HOME before every session.
install -m 0755 -o root -g root results/v1.4-puzzle-01-baseline/isolation/gclaude.sh /srv/bin/gclaude
cat > /srv/bin/cclaude <<'EOF'
#!/bin/sh
# COMPREHEND-01: empty the generator's HOME, then run the baseline wrapper.
set -e
find /srv/gh -mindepth 1 -delete
mkdir -p /srv/gh/tmp
export TMPDIR=/srv/gh/tmp USER=gen LOGNAME=gen
exec /srv/bin/gclaude "$@"
EOF
chmod 0755 /srv/bin/cclaude

# The graph server launcher: root-only; the generator may run it through sudo with one neutral id (sNN). It reads the
# real config (/srv/o/mcp/sNN.json, root-only) and starts the server as root from the repository root.
cat > /srv/bin/gserver <<EOF
#!/bin/sh
set -eu
case "\${1:-}" in s[0-9][0-9]) ;; *) echo "gserver: bad id" >&2; exit 2;; esac
cd "$REPO"
exec "$NODE" -e 'const c=require(process.argv[1]); require("child_process").spawn(c.command, c.args, {stdio:"inherit"}).on("exit", (code) => process.exit(code ?? 1));' "/srv/o/mcp/\$1.json"
EOF
chmod 0700 /srv/bin/gserver
cat > /etc/sudoers.d/comprehend01 <<'EOF'
Defaults:gen !use_pty, !syslog
gen ALL=(root) NOPASSWD: /srv/bin/gserver
EOF
chmod 0440 /etc/sudoers.d/comprehend01
visudo -cq

# Tree copies under neutral names (t01..t10, trees.json order); the clones' .git is left out.
python3 - "$REPO" "$CLONES" <<'EOF'
import json, os, shutil, sys
repo, clones = sys.argv[1], sys.argv[2]
trees = json.load(open(os.path.join(repo, 'experiments/comprehend-01/trees.json')))['trees']
dirs = {}
for n, t in enumerate(trees, 1):
    src = os.path.join(repo, t['path']) if 'path' in t else os.path.normpath(os.path.join(clones, t['id'], t.get('root', '.')))
    dst = f'/srv/t/t{n:02d}'
    if os.path.exists(dst): shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns('.git'))
    dirs[t['id']] = dst
iso = {'treeDirs': dirs, 'launcher': '/srv/bin/gserver', 'serverConfigDir': '/srv/o/mcp', 'clientConfigDir': '/srv/h/mcp'}
json.dump(iso, open('/srv/o/isolation.json', 'w'), indent=1)
EOF
chmod -R a+rX,go-w /srv/t

# Root's tsx compile cache and the coordinator's scratch hold compiled or copied experiment files.
for d in /tmp/tsx-0 /tmp/claude-0 /tmp/comprehend-01-*; do [ -e "$d" ] && chmod 700 "$d"; done
chmod -R go-rwx /srv/o

# Close the clone: the generator must not read the repository (bank, keys, graph check, notes, puzzle READMEs).
chmod 700 "$REPO"
echo "sandbox ready; clone closed (reopen with --open)"
