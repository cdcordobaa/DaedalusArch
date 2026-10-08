# Build Instructions — DaedalusArch v1.2E

> **Supersedes** the v1.0 build instructions (U0–U7 cycle). The earlier text stays in git history (`git log -- aidlc-docs/construction/build-and-test/build-instructions.md`).
> **Cycle**: v1.2 Evaluation-Readiness, Build and Test (plan `aidlc-docs/construction/plans/v1.2E-build-and-test-plan.md`, Step 8). **Date**: 2026-10-08.

## 1. Prerequisites

| Item | Version | Source of truth |
|---|---|---|
| Node.js | `>=22` (`package.json` `engines`); CI runs 22, local measurements ran on 24.5.0 | FR-02, `Docs/environment.md` |
| npm | 10 or later (the version bundled with Node) | — |
| TypeScript | 5.9.3 (devDependency, from `package-lock.json`) | FR-03 |
| ts-morph | 25.0.1 | FR-03 |
| neo4j-driver | 5.28.3 | FR-03 |
| Jest | 29.7.0 with ts-jest | FR-03 |
| Neo4j | `neo4j:5.26-community@sha256:f66304b9511c60d33555a2c451f88e03d82d1ebc893f32d84c98a6b326096435` with APOC (the CI pin, `.github/workflows/ci.yml`) | FR-01 |
| Docker | any recent Docker Desktop or Engine | — |

The lock file is committed (FR-02). Always install with `npm ci`, never `npm install`, so the tree equals the lock.

## 2. Install

```bash
git clone <repository> DaedalusArch
cd DaedalusArch
npm ci
npm ls --depth=0        # exit 0
npm ls canvas           # (empty): vega renders SVG without canvas (BR-U5b-71)
```

## 3. Neo4j and credentials (never print a value)

Each work lane uses its own Neo4j container bound to `127.0.0.1` only, with its credentials in a mode-600 env file outside the repository. The file holds exactly three lines: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`. Write it through a redirect under `umask 077`, and never `cat`, `echo` or `printf` a value.

Build and Test lane example (`~/.daedalus-bt.env`, Bolt 7693, HTTP 7479):

```bash
umask 077
: > ~/.daedalus-bt.env && chmod 600 ~/.daedalus-bt.env
# write NEO4J_URI=bolt://localhost:7693, NEO4J_USER=neo4j and a generated NEO4J_PASSWORD by redirect (no echo)

docker run -d --name daedalus-neo4j-bt \
  -p 127.0.0.1:7693:7687 -p 127.0.0.1:7479:7474 \
  -e NEO4J_PLUGINS='["apoc"]' -e NEO4J_dbms_security_procedures_unrestricted='apoc.*' \
  --env-file <(sed -n 's#^NEO4J_PASSWORD=#NEO4J_AUTH=neo4j/#p' ~/.daedalus-bt.env) \
  neo4j:5.26-community@sha256:f66304b9511c60d33555a2c451f88e03d82d1ebc893f32d84c98a6b326096435
```

Lane preamble before any command that needs Neo4j:

```bash
set -a; . ~/.daedalus-bt.env; set +a
```

The main checkout's credentials come only from `set -a; . ./.env; set +a`. The CLI has no default password (`requireEnvForCli('NEO4J_PASSWORD')`, BR-U3-80); `NEO4J_USER` defaults to `neo4j`.

## 4. Type checks (Gate T)

Five configurations, all must be clean. CI runs all five as blocking steps.

```bash
npm run typecheck                      # src (tsconfig.json)
npm run typecheck:u0-tests             # tsconfig.u0-tests.json
npx tsc -p tsconfig.scripts.json       # scripts/** and tests/unit/scripts/** (OI-U5b-P2-1)
npx tsc -p tsconfig.u3-tests.json      # D-U4-14
npx tsc -p tsconfig.u4-tests.json      # D-U4-14
```

## 5. Build and CLI check

```bash
npm run build                          # tsc -> dist/, exit 0
npx tsx bin/firewall.ts --help         # lists evaluate, batch, drift, validate, baseline, report
node dist/cli/index.js --help          # same, from the build
```

Script entry points run through `tsx` (`npx tsx scripts/<name>-cli.ts`). Every CLI under `scripts/` that U5b or Build and Test added answers `--self-test` with exit 1 (a built-in known-bad input, BR-U5b-73); the U5a scripts `mutate`, `generate-projects`, `u5a-freeze-gate` and `u5a-parity-check` have no `--self-test` and exit 2 on it (usage error).

## 6. Pre-registration gate

```bash
npx tsx scripts/run-experiment-cli.ts --check-prereg experiments/fixtures/plan.json
# pre-registration v<N> ok: <M> registered artefacts unchanged
```

A registered artefact changes only through a bump: `npx tsx scripts/register-prereg-cli.ts --reason "<why>"`, then commit `corpus/prereg.json` (BR-U5b-50; contract-test-instructions.md).

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails on the lock | `package.json` edited without the lock | revert, or update the lock in its own reviewed commit |
| `CONFIG_*` / missing `NEO4J_PASSWORD` | lane preamble not sourced | source the lane env file; the CLI never falls back to a default password |
| `ServiceUnavailable` on 7693 | container still starting | wait for `Started.` in `docker logs daedalus-neo4j-bt` |
| `TS1378` in a `scripts/*-cli.ts` file | top-level `await` under the CommonJS scripts config | use the D-U5a-13 (a) form `void main(...).then(...)` |
| `PREREG_REFUSED artefact-changed` | a registered file changed after the registration | revert it, or bump with `register-prereg-cli.ts --reason` and commit |
| `cypher-shell` missing on the host | not installed | run the smoke through `neo4j-driver` with the lane preamble (DV-BT-4) |
