# U0 Foundation — NFR Requirements (light pass)

> **Date**: 2026-10-07 · **Unit**: U0 Foundation (v1.2 Evaluation-Readiness cycle) · **Baseline**: `7cd15b4`
> **Depth**: light, as fixed by the execution plan (NFR Requirements runs inside U0; NFR Design and Infrastructure Design are skipped). No new tech stack is chosen: U0 adds no runtime dependency and removes one (`@anthropic-ai/sdk`, design decision 1).
> **Sources**: `inception/requirements/v1.2-evaluation-readiness-requirements.md` §4 and §6; `inception/application-design/v1.2E-unit-of-work-requirement-map.md`; `v1.2E-component-methods.md` (C10 process runner, scrubber, graph repository port); `v1.2E-components.md:173`.
> **Companion**: the U0 code-generation plan, `construction/plans/v1.2E-u0-foundation-code-generation-plan.md`, implements every U0 deliverable below and carries the open points as decisions D-U0-1..D-U0-17. Every item this note moves out of U0 gets one owning unit and one acceptance check, recorded in the design docs by plan Step 30.

## 1. Governing constraint

U0 changes **no runtime behaviour** (unit rule 2, NFR-01). Every NFR deliverable in U0 is therefore either a contract, a new module with no caller, a test, or a repository and CI change. Where the design gives U0 a deliverable that would change observable behaviour, this note moves it to the unit that owns the behaviour (sections 3 and 6).

## 2. NFR matrix for U0

| NFR | Measurable criterion (requirements §4) | Owner | What U0 delivers | Verifying unit | Proving test or check in U0 |
|---|---|---|---|---|---|
| NFR-v1.2E-01 No unintended change | No output change outside §3; every expected change is a reviewed snapshot update naming its FR | **U0** (every later unit updates snapshots with attribution) | C16 golden suite, green at `7cd15b4` before any contract change, locally and in CI with the unchanged lock file; snapshots unchanged by every U0 commit | U0 (and every unit at merge) | Gate G after each contract group: `GOLDEN_REQUIRED=1 npm run test:golden` green with the expected executed-test count (0 skipped); `git diff <baseline-snapshot-commit> -- tests/golden/__snapshots__` empty at U0 exit; CI golden step green on the baseline commit and after each dependency change |
| NFR-v1.2E-05 Logging hygiene (SECURITY-03) | No credential, token or connection string in warnings, audit entries or report fields | U3 | `src/shared/errors/scrub.ts` (`scrubSecrets`, `scrubWarning`, `scrubDeep`) with unit tests; golden-suite assertion that each serialised report contains neither the Neo4j password nor a credentialed URI | U2 (`Neo4jRepository` errors, D-U0-6), U3 (warnings, audit, report, FR-13 failure messages) | `tests/unit/shared/errors/scrub.test.ts`; no-secret assertion in `tests/golden/golden.test.ts` |
| NFR-v1.2E-06 Supply chain (SECURITY-10) | Lock file committed; `npm audit --audit-level=high` in CI, non-blocking at first; actions pinned at least by major | **U0** | Lock file tracked unchanged before the golden baseline, then `@anthropic-ai/sdk` removed in its own commit; `engines.node >=22`; audit step in `ci.yml`; action pins verified; Neo4j image pinned by digest; CI triggers extended to `v1.2e`; lint tooling repaired (D-U0-16) | **U0 alone** | `git ls-files package-lock.json` non-empty; `npm ci` green on Node 22 in CI; `grep -n "npm audit --audit-level=high" .github/workflows/ci.yml`; every `uses:` line carries `@vN` or a SHA |
| NFR-v1.2E-07 Query bounds | Every Cypher query runs with a timeout; cycle search bounded; latency budget for projects up to 300 files measured in Build and Test | U1 | `QueryOptions { timeoutMs? }` on the graph repository port and its driver plumbing in `Neo4jRepository`, **with no default** | U1 (owner; cycle bound), U2 (repository default timeout in `Neo4jRepository`, D-U0-5), U3 (metric bounds), Build and Test (latency table) | `tests/unit/neo4j-ingestion/neo4j-repository.test.ts` (mocked driver); Neo4j-backed `apoc.util.sleep` timeout test in `tests/golden/neo4j-infra.test.ts` |
| NFR-v1.2E-08 Provider hygiene | Claude and Gemini providers never log credentials, tokens or raw environment; a scrubbing test covers warnings, cassettes and reports | U4 | Scrubber; `ProcessRunner` port and `NodeProcessRunner`; `buildChildEnv` allow-list copier; their unit tests | U4 (allow-list contents, C14, cassettes), U3 (report part) | `tests/unit/shared/process/build-child-env.test.ts`, `tests/unit/shared/process/node-process-runner.test.ts`, `scrub.test.ts` |

## 3. Per-NFR detail

### NFR-v1.2E-01 — No unintended change
- **Criterion in U0**: the five golden snapshots (`fixtures/<id>` × `specs/clean-arch.yaml`, `symbolic-only`) are byte-identical from the baseline snapshot commit to U0 exit. The baseline is proven locally (three runs across Neo4j restarts) and then in CI on a commit whose `src/` and lock file equal `7cd15b4` (plan Steps 4, 8, 9); dependency changes come after, each in its own commit with the CI golden step green.
- **Snapshot normalisation** keeps every order that is deterministic at HEAD and visible in output (`perDimensionScores`, `functionResults`, the per-function grouping of `violations`) and normalises only what is not: Neo4j row order within one function (sorted), cycle rotations of `no-cyclic-deps` rows (canonicalised), absolute paths under either the resolved or the real repository root. A `no-cyclic-deps` result at its `LIMIT 100` cap is pinned by count only.
- **Gate G is strict**: it always runs with `GOLDEN_REQUIRED=1` and checks the executed-test count, so a shell without `NEO4J_PASSWORD` cannot turn it into a skipped, green run.
- **Additional U0 gates** (because jest never type-checks, `isolatedModules: true` with ts-jest 29.4.6):
  - `npm run typecheck` green after every contract group.
  - Test type-error budget: the count of `tsc` errors over `tests/` (85 at `7cd15b4`, measured with a scratch tsconfig that is not committed) does not grow, and no file touched by U0 gains an error.
  - The new U0 test files type-check under `tsconfig.u0-tests.json` (committed, scoped to the new files only).
- **Residual not covered by the golden suite**: full-mode and neuronal-only output, HTML output and batch output are not pinned. U0 keeps them neutral by construction (Option B for `Dimension`, optional report fields, `VCRMode` left in C7, Gemini keeps `this.modelName`); the unit tests of `score-computer`, `llm-critic`, `report` and `cli` must stay green unchanged. The CLI hunks U0 touches (`LLMConfig` → `LLMProviderConfig` and the no-key warning condition in `evaluate` and `report`) are pinned by a new CLI test asserting the config passed to `createPipeline` and the exact stderr warning in every key/mode combination (plan Step 24).
- **Lint**: `npm run lint` is broken at `7cd15b4` (missing `typescript-eslint`, `--ext` rejected by ESLint 9). U0 repairs the tooling only and turns lint into a ratchet against the recorded baseline (D-U0-16); lint findings are a residual.

### NFR-v1.2E-05 — Logging hygiene
- **U0 scope**: the module only. `scrubSecrets(text, knownSecrets)` redacts each non-empty known secret (longest first, literal match, no regex built from the secret), credentialed `bolt|neo4j|neo4j+s|neo4j+ssc|http|https` URIs (`scheme://user:pass@host` → `scheme://[REDACTED]@host`), `Bearer <token>`, `sk-ant-…`, `sk-…`, `AIza…` key shapes, and `password=…`, `apiKey=…`, `api_key=…`, `token=…` pairs. Redaction token: `[REDACTED]`.
- **Properties** proven by unit tests: idempotent; empty or whitespace-only known secrets ignored; secrets with regex metacharacters redacted; overlapping secrets fully removed; benign text (file paths, violation messages) byte-identical; `scrubWarning` keeps `code`, scrubs `message` and every string in `context`; `scrubDeep` returns a deep copy, never mutates (frozen input), handles arrays and nested objects, leaves non-strings untouched, and replaces a cyclic reference with the string `[Circular]`. Property test with `fast-check` is **not** added (no new dependency); a seeded loop of 500 generated strings with inserted secrets stands in.
- **Not in U0**: routing `Neo4jRepository`, `symbolic-evaluator.ts:27`, `neo4j-ingestion.ts:32,51` or report warnings through the scrubber. That changes error text on failure, an observable change. `Neo4jRepository` errors move to **U2** (owner of `neo4j-repository.ts`; check: a driver error with a credentialed URI and the password comes back redacted); everything else to **U3** (owner of NFR-05). See decision D-U0-6.

### NFR-v1.2E-06 — Supply chain
- U0 closes it fully, provided the CI triggers include `v1.2e` (otherwise neither the audit step nor the golden job ever runs on unit pull requests). CI cannot run at all until `package-lock.json` is tracked (`actions/setup-node` with `cache: 'npm'` and `npm ci` both need it), so the lock is tracked unchanged first (plan Step 4) and the SDK removal follows in its own commit (Step 10).
- The Neo4j image is pinned by digest in `ci.yml` and `docker-compose.yml`, so local and CI golden runs use the same server build.
- Baseline audit count: recorded in `Docs/environment.md` from the first CI run (local `npm audit` could not reach the registry during scouting).
- Promotion of the audit step to blocking happens after triage, outside U0.
- Residual SECURITY-09 findings (not FR-06, runtime code): `?? 'neo4j'` password fallbacks at `src/cli/cli.ts:86,316,387`, `src/cli/drift-handler.ts:104`, `src/cli/batch-runner.ts:49`, and `'password'` at `src/neo4j-ingestion/types.ts:29`. Removing them changes CLI behaviour, so they are not fixed in U0 (decision D-U0-8). Owners: **U3** for `cli.ts`, `drift-handler.ts`, `batch-runner.ts` (check: missing `NEO4J_PASSWORD` gives a configuration error naming the variable); **U2** for `neo4j-ingestion/types.ts:29` (check: no `'password'` default).

### NFR-v1.2E-07 — Query bounds
- **U0 scope**: contract and mechanism. `executeQuery(cypher, params?, options?: QueryOptions)`; `Neo4jRepository` calls `session.run(cypher, params, { timeout: options.timeoutMs })` only when `options?.timeoutMs !== undefined`, otherwise exactly `session.run(cypher, params)`.
- **Not in U0**: a repository-wide default timeout (`v1.2E-components.md:173`, `component-methods.md:732-733`). Any concrete default could make a query that succeeds today fail. The default, or per-call wiring of the seven call sites (`symbolic-evaluator.ts:25`, `universal-metrics.ts:32`, `graph-ingester.ts:47,87,105,108`, `neo4j-repository.ts:41,48`), moves to **U2**, which sets one repository default inside `Neo4jRepository.executeQuery` (its own file) and so covers all seven call sites; check: `run` receives `{ timeout: <default> }` when no option is given, and C16 stays unchanged (decision D-U0-5). NFR-07 stays owned by U1 (cycle bound); U3 keeps the metric bounds.
- **Open for U1**: the bounded cycle query (`cypher-templates.ts:48-50`); the golden suite guards that `no-cyclic-deps` stays under its `LIMIT 100` meanwhile.

### NFR-v1.2E-08 — Provider hygiene
- **U0 scope**: `ProcessRunner` port, `NodeProcessRunner` (`spawn` with argv array, `shell: false`, explicit `env`, `stdio: 'pipe'`), `buildChildEnv(parent, allow)` (copies only allowed, defined names; case-sensitive; frozen result; never mutates `parent`).
- **Decided here for the runner** (gaps left open by the design; decision D-U0-7 confirms):
  - Killed child: `exitCode = -1` when the child ends by signal, `timedOut: true` when the kill was ours.
  - Timeout kill: `detached: true` on POSIX, `process.kill(-pid, 'SIGTERM')`, then `SIGKILL` after a 2 s grace period, so grandchildren of the `claude` CLI die too.
  - Output cap: `maxOutputBytes` option, default 10 MiB per stream; excess is truncated and the result carries `truncated: true`. This adds two optional fields to the C10 contract (`ProcessRunOptions.maxOutputBytes?`, `ProcessResult.truncated?`).
  - Spawn failure: `DomainResult.fail` with code `PROCESS_SPAWN_FAILED` and the `errno` code (`ENOENT`) in context; C14 maps it to `LLM_CLI_NOT_FOUND` in U4.
  - `PATH` lookup uses `options.env.PATH`; documentation on `buildChildEnv` states that an allow-list without `PATH` needs an absolute binary path.
- **Not in U0**: the allow-list contents (Functional Design U4), cassette scrubbing (U4), report scrubbing (U3).
- **Risks handed on**: `GEMINI_API_KEY ?? ANTHROPIC_API_KEY` at `src/cli/cli.ts:96,397` can send an Anthropic key to Google (**U4**; check: an Anthropic-only environment never builds a Gemini provider); `batch-runner.ts:58-59` uses `ANTHROPIC_API_KEY ?? OPENAI_API_KEY` (**U3**, with the batch LLM-config removal). U0 compile fixes keep these expressions verbatim (rule 2).

## 4. Other quality attributes considered (no new requirement)

| Attribute | Assessment for U0 |
|---|---|
| Performance | No runtime path changes. Golden suite runtime target: under 3 minutes for five cases in CI (timeout 120 s per case). |
| Reliability | Golden suite fails loudly (never silently passes) when `GOLDEN_REQUIRED=1` and Neo4j is unreachable; every Gate G run sets `GOLDEN_REQUIRED=1` and checks the executed-test count; per-case `result.success` asserted. |
| Safety of local data | Ingestion runs `MATCH (n) DETACH DELETE n`. The golden suite refuses to run unless the Neo4j host is `localhost`/`127.0.0.1` or `GOLDEN_ALLOW_WIPE=1`; documented in `Docs/environment.md`. |
| Maintainability | Snapshot JSON with sorted keys, 2-space indent and trailing newline; `tests/golden/CHANGES.md` names the FR for every update. |
| Portability | `engines.node >=22`; process-runner tests run on macOS (local) and Linux (CI); golden snapshots generated on macOS must match on Linux CI (a mismatch is a normaliser defect, never accepted as a CI-generated snapshot); repository root normalised through both the resolved path and the realpath. |

## 5. Security Baseline compliance for this stage (extension enabled, D-3)

| Rule | Status in U0 | Rationale |
|---|---|---|
| SECURITY-03 Application logging | Compliant (module) / wiring U3 | Scrubber delivered and tested; no logging path changes in U0. |
| SECURITY-05 Input validation | N/A in U0 | No parser or query change. |
| SECURITY-07 Network configuration | Compliant if D-U0-11 accepted | Compose ports bound to `127.0.0.1`; matches the requirements rationale. |
| SECURITY-09 Hardening | Compliant for compose (FR-06); residual code fallbacks recorded | See §3 NFR-06 and D-U0-8. |
| SECURITY-10 Supply chain | Compliant at U0 exit | Lock file, audit step, action pins, Neo4j image digest pin, SDK removal. |
| SECURITY-11 Secure design | Compliant | Process runner never uses a shell; env passed by allow-list only. |
| SECURITY-13 Integrity | Compliant | Lock file tracked; CI uses `npm ci`. |
| SECURITY-15 Exception handling | Compliant | New modules return `DomainResult`; no thrown errors cross module boundaries except the set-once context slot, which mirrors the existing setters. |
| SECURITY-01, 02, 04, 06, 08, 12, 14 | N/A | No new store, endpoint, IAM, auth or deployed service. |

## 6. Open points (resolved in the code-generation plan's decision table)

1. Repository-wide query timeout default and scrubbed repository errors: moved to U2 with acceptance checks (D-U0-5, D-U0-6; recorded by plan Step 30).
2. Process runner details (exit code on kill, tree kill, output cap, spawn error code): proposed in §3, confirmed by D-U0-7.
3. Hard-coded password fallbacks in code and the key fallbacks: owners U3 (CLI, drift, batch), U2 (`neo4j-ingestion/types.ts`), U4 (Gemini key) with acceptance checks (D-U0-8; plan Step 30).
4. Compose port binding to `127.0.0.1` (D-U0-11).
5. Unused `openai` dependency (D-U0-9).
6. Lint tooling broken at `7cd15b4`: repaired in U0, findings are a ratcheted residual (D-U0-16).
7. FR-31 critic `maxTokens` raise: moved to U4 with an acceptance check (D-U0-17).
