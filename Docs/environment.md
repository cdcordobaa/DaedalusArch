# Environment Record

Recorded 2026-10-07 for the v1.2 evaluation-readiness cycle (FR-v1.2E-03, FR-v1.2E-01). Package versions are the resolved versions in the tracked `package-lock.json`, not the ranges in `package.json`.

## Runtime and toolchain

| Component | Local | CI |
|---|---|---|
| Node.js | 24.5.0 | 22 (`actions/setup-node`, `node-version: '22'`) |
| npm | 11.5.1 | bundled with Node 22 |
| `engines.node` (package.json) | `>=22` | `>=22` |
| Docker | 28.3.2, Compose v2.39.1 | GitHub Actions service container |

| Package (from `package-lock.json`) | Version |
|---|---|
| typescript | 5.9.3 |
| ts-morph | 25.0.1 |
| neo4j-driver | 5.28.3 |
| jest | 29.7.0 |
| ts-jest | 29.4.6 |
| @types/node | 22.19.15 |
| eslint | 9.39.4 |
| typescript-eslint | 8.71.1 |
| @google/generative-ai | 0.24.1 |

## Neo4j

| Item | Value |
|---|---|
| Image | `neo4j:5.26-community@sha256:f66304b9511c60d33555a2c451f88e03d82d1ebc893f32d84c98a6b326096435` (same pin in `docker-compose.yml` and `.github/workflows/ci.yml`) |
| Server | Neo4j Kernel 5.26.24, community edition (`CALL dbms.components()`) |
| APOC | 5.26.24 (`RETURN apoc.version()`), installed through `NEO4J_PLUGINS='["apoc"]'` |
| Ports | `127.0.0.1:7474` (HTTP), `127.0.0.1:7687` (Bolt); bound to localhost only |

The image is pinned to the multi-arch index digest of the image used to generate the golden baseline. The floating tag `neo4j:5.26-community` has since moved to a newer digest; the pin keeps local and CI runs on the same server build as the baseline.

## Hardware

| Item | Value |
|---|---|
| CPU | Apple M1 (`sysctl -n machdep.cpu.brand_string`) |
| RAM | 16 GiB (`sysctl -n hw.memsize` = 17179869184 bytes) |
| OS | macOS 26.5.2 (`sw_vers`) |

CI runs on GitHub-hosted `ubuntu-latest` runners.

## Local setup

```sh
cp .env.example .env
# edit .env: set NEO4J_PASSWORD (at least 8 characters). There is no default;
# docker compose refuses to start without it.
set -a; . ./.env; set +a
docker compose up -d neo4j
docker inspect -f '{{.State.Health.Status}}' daedalus-arch-neo4j   # wait for "healthy"
npm ci
```

The compose password is applied only when the `neo4j_data` volume is first initialised. An existing volume keeps the password it was created with; changing `NEO4J_PASSWORD` afterwards does not change it. Use the original password, or remove the volume with `docker compose down -v` (this destroys the local graph data).

## FR-01 smoke commands

```sh
set -a; . ./.env; set +a
docker exec daedalus-arch-neo4j cypher-shell -u "${NEO4J_USER:-neo4j}" -p "$NEO4J_PASSWORD" "MATCH (n) RETURN count(n)"
docker exec daedalus-arch-neo4j cypher-shell -u "${NEO4J_USER:-neo4j}" -p "$NEO4J_PASSWORD" "RETURN apoc.coll.indexOf([1,2],2)"   # returns 1
docker exec daedalus-arch-neo4j cypher-shell -u "${NEO4J_USER:-neo4j}" -p "$NEO4J_PASSWORD" "RETURN apoc.version()"
```

The same two checks run automatically in `tests/golden/neo4j-infra.test.ts`.

## Golden regression suite

```sh
set -a; . ./.env; set +a
GOLDEN_REQUIRED=1 npm run test:golden
```

| Variable | Effect |
|---|---|
| `NEO4J_PASSWORD` | Required. The test does not load `.env`; export it in the same shell. |
| `NEO4J_URI`, `NEO4J_USER` | Optional; default `bolt://localhost:7687` and `neo4j`. A URI with embedded credentials is refused. |
| `GOLDEN_REQUIRED=1` | Fail instead of skipping when `NEO4J_PASSWORD` is unset or a snapshot file is missing. Always use it for gate runs; without it the suite can skip and jest still exits 0. |
| `UPDATE_GOLDEN=1` | Rewrite the snapshot files. Refused when `CI` is set. Every snapshot change must be recorded in `tests/golden/CHANGES.md` with its FR and commit. |
| `GOLDEN_ALLOW_WIPE=1` | Allow a Neo4j host other than `localhost`/`127.0.0.1`. |

The golden suite is excluded from `npm test`; it runs in CI as the "Golden regression suite" step.

## Data-loss warning

Every pipeline run that ingests into Neo4j (CLI evaluation, golden suite) executes `MATCH (n) DETACH DELETE n` before ingesting (`src/neo4j-ingestion/neo4j-ingestion.ts` calls `clearGraph()`). Do not point `NEO4J_URI` at a database whose contents you need.

## SECURITY-01 documented exception

Bolt connections use `bolt://localhost:7687` without TLS. This is an accepted exception: the database is a local, disposable container bound to `127.0.0.1`, holds only graphs derived from source code under evaluation, and is wiped on every run. CI uses a service container on the runner's loopback with a throwaway password. Any non-local deployment must use `neo4j+s://` or `bolt+s://`.

## Dependency audit baseline

First CI run with the audit step (run 37681388339, commit `5210ec7`, `npm audit --audit-level=high`, report-only): **49 vulnerabilities (2 low, 10 moderate, 37 high, 0 critical)**. Most findings sit in development and test tooling (for example `jest-cucumber` and `@cucumber/*` through `uuid`, `@babel/core`, `js-yaml`, `esbuild`). A local `npm audit --omit=dev` on the same lock reports 8 high findings in the runtime tree, in `brace-expansion`, `braces`, `fast-uri` and `form-data` (all transitive). The step runs with `continue-on-error: true` until the baseline is triaged.
