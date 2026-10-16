#!/usr/bin/env bash
# One-command setup for the v1.3 replication package. Idempotent.
#
#   replication/setup.sh            # Node deps + pinned dependency-cruiser: enough for replication/smoke.sh
#   replication/setup.sh --neo4j    # also starts Neo4j 5.26 + APOC (docker compose; needs NEO4J_PASSWORD in .env)
#
# Never asks for, stores or prints a credential. Live model re-runs are documented in replication/README.md §4 and
# need the reader's own subscription logins.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

need_major=22
major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$major" -lt "$need_major" ]; then echo "Node >= $need_major required (the v1.3 runs used v22.22.0); found $(node -v 2>/dev/null || echo none)" >&2; exit 2; fi
[ "$(node -v)" = "v22.22.0" ] || echo "note: the v1.3 offline runs used Node v22.22.0; you have $(node -v). The smoke outputs did not depend on the patch version in our runs, but report it if a DIFF appears."

echo "== npm ci (root, lockfile-exact, no install scripts)"
npm ci --ignore-scripts --no-audit --no-fund

echo "== npm ci (experiments/tool-comparison/depcruise: dependency-cruiser 18.4.0 + typescript 5.9.3)"
( cd experiments/tool-comparison/depcruise && npm ci --ignore-scripts --no-audit --no-fund )
dc="$(experiments/tool-comparison/depcruise/node_modules/.bin/depcruise --version)"
[ "$dc" = "18.4.0" ] || { echo "dependency-cruiser $dc, expected 18.4.0" >&2; exit 2; }

if [ "${1:-}" = "--neo4j" ]; then
  echo "== Neo4j 5.26-community + APOC (docker-compose.yml, image pinned by digest)"
  [ -f .env ] || { echo "create .env from .env.example and set NEO4J_PASSWORD (>= 8 chars) first" >&2; exit 2; }
  docker compose up -d neo4j
  echo "Neo4j on bolt://127.0.0.1:7687. Export NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD from your .env before the Neo4j-dependent commands."
fi

echo "setup OK: node $(node -v), tsx $(node -p 'require("./node_modules/tsx/package.json").version'), typescript $(node -p 'require("./node_modules/typescript/package.json").version'), dependency-cruiser $dc"
