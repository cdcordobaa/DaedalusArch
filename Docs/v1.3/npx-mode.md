# v1.3 npx mode: DaedalusArch without a database

Branch `v1.3-npx` (cut from `v1.3-cypher-interp`, PR #128, with `v1.3-mcp2`, PR #122, and then `origin/v1.3` at
b2592923 merged in), 2026-10-16.
It builds on the in-process Cypher interpreter (`--engine cypher-interp`, design and parity in
[`cypher-interpreter.md`](cypher-interpreter.md)).

**The author's decision, kept here.** The Cypher template text is the only definition of every rule. Nothing on this
branch re-implements a rule in TypeScript, and no template text changed (`git diff origin/v1.3-cypher-interp --
src/fitness-compiler` is empty; the template changes that arrive with `origin/v1.3` are v1.3's own). Neo4j stays the
reference engine for reported numbers.

## 0. Status

| item | status | evidence |
|---|---|---|
| Engine default on every evaluating command (`evaluate`, `report`, `baseline`, `batch`, `drift`, `validate`; MCP server) | done | §2; `tests/unit/cli/engine-default.test.ts`, `tests/unit/cli/require-env.test.ts` |
| One stderr line naming the engine | done | §2 |
| Study and experiment scripts pinned to `--engine neo4j` | done | §2.2 |
| MCP: `evaluate_project` with no database | done | §3; `tests/unit/mcp-server/npx-mode.test.ts` |
| MCP: `check_file` / `check_diff` run the templates (`templates: true`) | done | §3.2 |
| MCP: `suggest_placement`, `infer_spec`, `explain_*`, `which_layer`, `check_import`, `get_architecture_spec` | already no graph | §3 |
| MCP stdio smoke, no NEO4J env | done | `tests/unit/mcp-server/stdio-smoke.test.ts`; installed tarball in §5 |
| Packaging: `bin`, `files`, `prepare`, `npm pack`, install into a temp dir, `npx daedalus evaluate` | done | §5; `results/v1.3-npx/verify.json` |
| CI parity guard, no Neo4j | done | §4; `tests/unit/cypher-interp/golden-parity.test.ts` |
| Incremental graph update on file change | **not built** (not cheap, §3.1); rebuild per call plus a result cache | §3.1 |
| Live-Neo4j parity harness re-run on this branch | **not re-run** (no Neo4j in this container); its last run is the evidence | §4 |
| Judge (`full`, `neuronal-only`) end to end on cypher-interp | **not run** (spends judge calls) | §6 |
| Interpreter: `CALL { … UNION … }` (FF-P05's text on v1.3 since PR #108) | done, **not checked live** | §4.1 |

## 1. Quick start

```bash
npm ci && npm run build            # or install a packed tarball: npm install ./daedalus-arch-0.1.0.tgz
npx daedalus evaluate path/to/project --spec path/to/spec.yaml --symbolic-only --format json
npx daedalus-mcp --spec path/to/spec.yaml --project path/to/project
```

`bin` entries: `daedalus` and `daedalus-arch` (`dist/cli/bin.js`), `daedalus-mcp` and `daedalus-arch-mcp`
(`dist/mcp-server/main.js`). `evaluate` takes the project as a positional argument or `--project`.

## 2. Engine resolution

`src/cli/engine-default.ts`, used by every CLI command that evaluates and by the MCP server:

1. `--engine neo4j|cypher-interp` when given;
2. else `neo4j` when `--neo4j-uri` is given on the command line or `NEO4J_URI` is set and non-empty;
3. else `cypher-interp`.

The command prints exactly one stderr line, before any work, naming the engine and the reason (never a URI or a
credential):

```
daedalus: graph engine cypher-interp (in-process, no database) [NEO4J_URI is not set; pass --engine neo4j for the reference engine]
daedalus: graph engine neo4j (reference engine) [NEO4J_URI is set]
```

- On `cypher-interp` no password is read and no connection or Neo4j lock is taken. On `neo4j` the BR-U3-80 rule is
  unchanged: no default password, `CONFIG_MISSING_ENV` before any connection.
- `validate` never connects. With `cypher-interp` it also parses every compiled query with the interpreter and
  fails (`CYPHER_INTERP_UNSUPPORTED`) if a template uses a construct outside the supported subset; e.g.
  `specs/clean-arch.yaml`: `cypher-interp: 22/22 compiled queries parse`.
- `drift --from/--to` reads snapshots only and prints no engine line; latest-vs-current evaluates and does.
- The pipeline factory's own default is unchanged (`graphEngine` absent = `neo4j`): code that builds a pipeline
  directly (scripts, harnesses, the golden suite) is on Neo4j unless it asks otherwise.

### 2.1 What a change to the default could have done to a reported number, and why it cannot

A script that spawns `firewall evaluate` without `--neo4j-uri` and runs where `NEO4J_URI` is unset (the CLI used to
default to `bolt://localhost:7687`) would silently have moved to the interpreter. Every such call site now passes
`--engine neo4j` explicitly (§2.2), and the engine line in each child's stderr records which engine ran.

### 2.2 Call sites pinned to `--engine neo4j`

| call site | what it runs |
|---|---|
| `scripts/run-experiment.ts` `cliArgv` | the registered v1.2E plans (U5b harness) |
| `scripts/lib/freeze-gate-main.ts` `cliEvaluate` | the U5a freeze gate; also `scripts/v1.3/lib/validate-reference-main.ts` through it |
| `scripts/v1.3/e1-v13-evaluate.ts`, `scripts/v1.3/ise-e1.ts` | E1 under v1.3 |
| `scripts/v1.3/study1-rerun.ts` | Study 1 re-run |
| `scripts/v1.3/judge-v2-run.ts` | judge v2 prompt harvest (PR #126) |
| `scripts/v1.3/ue-baseline-live.ts` | passes its own `--engine` (default `neo4j`) to every child, now always explicitly |
| `scripts/lib/generators/arms.ts` `daedalusMcpConfig` | the `daedalus-mcp` experiment arm's server argv |
| `tests/golden/u3-templates.test.ts` | the two CLI spawns of the golden suite |
| `scripts/lib/loop/main.ts` `liveWiring` (`scripts/loop-harness-cli.ts`) | the Study 2 loop harness: `--engine`, else the plan's `engine`, else `neo4j` (`liveEngine`); never the NEO4J_URI default |
| `scripts/lib/loop/engine-tee.ts` `evaluatorForEngine` | every loop snapshot records the engine it was evaluated on (`evaluation.engineOfRecord`; Neo4j under `both`), in every mode |
| `scripts/loop-replay-cli.ts` | the loop replay: `--engine` (default `neo4j`); a snapshot recorded on another engine fails the replay |
| `scripts/v1.3/study2-analyse.ts` | the Study 2 analysis: `--engine` (default `neo4j`); stops before it reads a number when any evaluated snapshot of the out-root (or the pilot out-root) records another engine or none |

`scripts/so1-layered-acceptance.ts` only records a command string; it spawns nothing.

The loop harness is not a CLI child, so `--engine` on the CLI children above never reached it: without `--engine`
or a plan `engine` it used to inherit the §2 default, which is `cypher-interp` when `NEO4J_URI` is unset, and its
records did not say which engine answered. A Study 2 run on the interpreter now has to say so (`--engine
cypher-interp` or `"engine": "cypher-interp"` in the plan), and its records say so too. On `evaluate_project` itself
the engine shows as `engine: "cypher-interp"` on the MCP interpreter path and is absent on Neo4j (§3).

`scripts/v1.3/judge-catch-run.ts` is a hash-frozen operator (`Docs/v1.3/judge-catch-frozen.md`), so it is left
byte-identical. It already passes `--neo4j-uri` on every call, which resolves to `neo4j` (rule 2 above), and its
children print the engine line.

## 3. MCP server

`daedalus-mcp --spec <spec> --project <dir> [--engine neo4j|cypher-interp]`; same resolution as §2 (no
`--neo4j-uri` flag). `ServerContext.graphEngine` carries it; `evaluateDeps.interp` is the in-process evaluator
(`src/mcp-server/interp-evaluator.ts`), present only on `cypher-interp`.

| tool | graph | on cypher-interp |
|---|---|---|
| `evaluate_project` | whole project | the full symbolic pipeline in process; result has `engine: "cypher-interp"`, `latencyMs`, `cache` |
| `check_file`, `check_diff` | none by default; whole project with `templates: true` | §3.2 |
| `suggest_placement`, `which_layer`, `check_import`, `get_architecture_spec`, `explain_violation`, `explain_finding` | none | unchanged (spec only) |
| `infer_spec` | extraction only, no database | unchanged |

On `neo4j` everything is as before (`NEO4J_UNREACHABLE` / `CONFIG_MISSING_ENV` errors), and the template check of
§3.2 answers `status: "skipped"` with the reason: it never ingests into a Neo4j database.

### 3.1 Graph lifetime: rebuild per call, cache the result

An incremental update is not cheap here: the APG extractor builds one ts-morph program over the whole project and
derives edges across files (barrels, re-exports, module wiring), and ingestion builds the graph from that whole
result. Updating one file's nodes and edges in place would be a second extractor. So every evaluation rebuilds
(extract, ingest into a fresh `MemoryGraph`, evaluate, score), and the server caches **results**:

- key: project root, a fingerprint of the project (relative path, size and mtime of every `.ts/.tsx/.js/.json` file,
  `node_modules`, `.git`, `dist`, `build`, `coverage` skipped), the spec path and mtime, the scoring mode, and a hash
  of the in-memory overrides;
- 16 entries, least recently used evicted; any file change on disk misses the cache.

### 3.2 `templates: true` on `check_file` and `check_diff`

The rules of record on the proposed change: the project is evaluated before and after the change on the
interpreter (`src/mcp-server/template-check.ts`); the change is applied in memory to the ts-morph program
(`extractAPG`'s `sourceOverrides` argument; nothing is written to disk, the test checks the fingerprint). The
answer, under `templates`:

- `introduced`: template findings after the change that were not there before (matched on rule, type, file and
  target, not line, so a moved line is not new), each with the tier the pipeline's v1.3 scoring used, construct,
  literature source, file, line, target and message;
- `clearedCount`, `blockingVerdict` (`block` iff an introduced finding is blocking), `latencyMs`, `cache`.

For `check_diff`, before and after are rebuilt from the diff and the files on disk (either side may be on disk);
added, modified, renamed and deleted files are handled; a file neither side of which can be rebuilt is evaluated as
on disk and named in `templates.reason`.

The fast answer (`blockingVerdict` and `findings` at the top level) is unchanged and stays the default, so the
`daedalus-mcp` experiment arm (no `templates` argument, `--engine neo4j`) sees exactly the v2 behaviour.

**Conflict with the author's decision, flagged, not resolved here.** PR #122's fast path (`src/mcp-server/fast-rules.ts`,
`file-check.ts`, `import-check.ts`) restates template conditions in TypeScript ("Each check restates its template's
condition"). That is a second definition of those rules. This branch does not delete or change it (it is #122's
design and the experiment arm depends on it); `templates: true` gives the template-backed answer next to it. A
decision is needed on whether the fast path stays as a labelled pre-check or is replaced by the template check.

### 3.3 Latency

Installed tarball, Node 22.22.0, this container, `env -i PATH HOME` (no NEO4J variable); the clean-architecture
reference project (`tests/fixtures/v1.3-reference/clean-architecture/project`, 30 `.ts` files). From
`results/v1.3-npx/verify.json`:

| step | ms |
|---|---:|
| MCP server start to `initialized` (spawn, module load) | 977 |
| `get_architecture_spec` / `suggest_placement` / `check_file` (fast) | 55 / 53 / 13 |
| `evaluate_project`, cache miss (extract + ingest + evaluate + score on cypher-interp) | 1,073 |
| `evaluate_project`, cache hit | 4 |
| `check_file` with `templates` (before: cache hit; after: miss) | 322 |
| `check_diff` with `templates` (before: hit; after: miss) | 477 |

A larger project: this repository against `specs/daedalus-arch.yaml` (256 source files, including the 2 MB generated
parser), `node dist/cli/bin.js evaluate . --symbolic-only`, cypher-interp: 16.6 s and 17.7 s wall; stages of the
first run: extract 7.2 s, ingest 0.36 s, evaluate 4.6 s, scores 4.3 s, 245 violations. There a template check costs
two such evaluations (one is usually a cache hit). Neo4j was not available to time the same project here;
`cypher-interpreter.md` §6 has the Neo4j comparison on the reference set (warm evaluation 149 ms vs 728 ms).

## 4. Parity evidence

| guard | what it asserts | result | where |
|---|---|---|---|
| CI, no Neo4j (new) | the five C16 golden fixtures through the real symbolic pipeline on `cypher-interp` equal the committed golden snapshots (written from Neo4j) **byte for byte**, same normaliser and serialiser as the Neo4j golden suite | 5/5 | `tests/unit/cypher-interp/golden-parity.test.ts` (runs in `npx jest`, ~13 s) |
| installed tarball (new) | `npx daedalus evaluate` on the clean-architecture reference project equals the committed Neo4j reference run's findings | 28/28, equal | `results/v1.3-npx/verify.json` `parityWithNeo4jReference`, against `results/v1.3-reference/after-member-facts/raw/clean-architecture/clean.json` |
| MCP `evaluate_project` (new) | AHS, verdict and violation count on `variant-a-structural` equal its golden snapshot | equal | `tests/unit/mcp-server/npx-mode.test.ts` |
| heavy, live Neo4j (PR #128) | every statement the pipeline and a catalogue sweep issue, interpreter vs Neo4j 5.26.24 + APOC | 65,254 statements over 79 projects: 0 content, 0 error, 0 unsupported | `cypher-interpreter.md` §4; `results/v1.3-cypher-interp/parity/parity.md` |
| reference set (PR #128) | `ue-baseline-live --engine cypher-interp`, 71 variants, no NEO4J variable | byte-identical to `results/v1.3-reference/after-member-facts` | `results/v1.3-cypher-interp/ue-baseline-live/run-provenance.json` |

Run the heavy guard (`node --import tsx scripts/v1.3/memory-parity.ts --engine cypher-interp --out <dir>`, holds the
Neo4j lock) whenever a template, the compiler's rewrites, `graph-ingester.ts` or the interpreter changes. It was not
re-run on this branch: no Neo4j server exists in this container. **It is due before this branch's interpreter is used
for anything but speed**: merging `origin/v1.3` brought template changes (FF-P05 signature types, PR #108; the cheap2
and field-state templates, PRs #110 and #121) that the 65,254-statement run of PR #128 never saw, and §4.1 extends
the interpreter.

### 4.1 Interpreter extension: `CALL { }` subqueries

On `origin/v1.3`, FF-P05 controller-no-entity compiles (with `signatureTypes`, a v1.3 default) to
`CALL { <frozen text> UNION <SIGNATURE_USES branch> } RETURN controller, entity, filePath ORDER BY …`
(`src/fitness-compiler/v13-signature-types.ts`). The interpreter rejected `CALL { }`, so after the merge `validate`
reported `21/22 compiled queries parse` and the golden parity test failed on FF-P05. The template text stays as it
is; the interpreter now executes it:

- `CALL { part (UNION [ALL] part)* }` as a returning unit subquery, once per incoming row; a part starting with
  `WITH` imports from the outer row through that projection, any other part sees no outer variable;
- `UNION` drops repeated rows (value equivalence, first seen kept), `UNION ALL` keeps them; parts' rows in part
  order (the template's outer `ORDER BY` fixes the final order);
- errors as Neo4j: mixed `UNION` / `UNION ALL`, different column names, a returned column that rebinds an outer
  variable; still rejected as unsupported: `OPTIONAL CALL`, `CALL (scope) { }`, `IN TRANSACTIONS`, `RETURN *` inside,
  a unit subquery without `RETURN`, and `UNION` outside `CALL { }`.

Evidence: 2 new unit tests (`tests/unit/cypher-interp/interpreter.test.ts`), expected values from the Neo4j 5.26
manual, **not re-checked against a live Neo4j**; the golden parity test (FF-P05 is in `specs/clean-arch.yaml`) is
byte-identical again, and the tarball run equals the Neo4j reference findings (28/28; FF-P05 has no finding on that
project, so this checks that the text runs, not its rows). `validate`: `22/22 compiled queries parse`.

## 5. Packaging

- `package.json`: `bin` as in §1; `files`: `dist/**/*.js`, `presets/*.yaml`, `specs/*.yaml`, `README.md` (no source
  maps, no `.d.ts`); `prepare` = `build` = clean `dist/` then `tsc` (so a git install and `npm pack` build first).
- The generated ANTLR parser (`dist/cypher-interp/generated/Cypher25{Lexer,Parser}.js`) is in the tarball; its runtime
  `antlr4ng` 3.0.16 is a dependency. The grammar package and `antlr-ng` stay devDependencies (generation only).
- `presets/` is found from the entry script with symlinks resolved (`node_modules/.bin/daedalus` → the package), as
  the compiled ESM output has no `__dirname` (`src/spec-parser/preset-loader.ts`, `src/mcp-server/context.ts`).

`scripts/v1.3/npx-verify.sh [<out dir>]` repeats the whole check: `npm pack`, install the tarball into an empty temp
project (no repository on the path, no link), run with `env -i PATH HOME`. Last run (`results/v1.3-npx/verify.json`):

| measure | value |
|---|---|
| tarball | 688,568 bytes (672 KB), 296 files (unpacked 3.8 MB) |
| install into an empty project | 8.6 s; `node_modules` 90 MB (180 packages; ts-morph with its TypeScript is the bulk) |
| cold start `npx daedalus --version` | 1,132 ms (the CLI loads every module eagerly) |
| cold `npx daedalus evaluate <reference project> --spec <its spec>`, 3 runs | 2,420 / 2,192 / 2,554 ms |
| MCP stdio smoke against the installed `daedalus-mcp`, all steps | 3,244 ms, 10/10 steps ok |

## 6. What still needs Neo4j

| use | engine | why |
|---|---|---|
| every reported number: studies, `scripts/v1.3/*` runs, the v1.2E reproduction (`scripts/run-experiment.ts`), the freeze gate, the golden suite (`npm run test:golden`) | Neo4j | the reference engine; pinned by `--engine neo4j` or by building the pipeline without `graphEngine` |
| the heavy parity guard | Neo4j and the interpreter | it compares them |
| judge (`full`, `neuronal-only`) | either | the judge's graph view (`JUDGE_GRAPH_QUERIES`) passed parity (`judge-graph:*`, 1,516 statements equal); its LLM provider, cassettes and credentials do not depend on the engine. A full-mode end-to-end run on cypher-interp was not done (it spends judge calls), so for a judged number use Neo4j |
| `evaluate --persist`, `--diff`, `drift` | either | snapshots use the file-system store, engine-independent |

## 7. Limits

- Scale: in memory, single-threaded; a 256-file project takes ~17 s per evaluation (§3.3). The extractor is the
  largest stage; `evaluate` and `scores` are next (variable-length patterns enumerated depth-first, as on Neo4j
  without a pruning planner).
- No incremental graph (§3.1).
- `neo4j-driver` stays a runtime dependency (the interpreter returns driver-shaped records); it opens no connection on
  `cypher-interp`.
- The CLI still loads `.env` from the working directory (`dotenv`), as before; a `NEO4J_URI` there selects Neo4j.

## 8. Files

- `src/cli/engine-default.ts`, `src/cli/bin.ts`; engine option in `src/cli/cli.ts`, `batch-runner.ts`,
  `drift-handler.ts`; `BatchOptions`/`DriftOptions.graphEngine`, `PipelineConfig.sourceOverrides`
  (`src/pipeline/types.ts`), passed by `pipeline-factory.ts` and `commands/extract-command.ts` to `extractAPG`.
- `src/mcp-server/interp-evaluator.ts`, `template-check.ts`, `stdio-smoke.ts`; changes in `context.ts`, `main.ts`,
  `server.ts`, `tools.ts`, `types.ts`, `evaluate-project.ts`, `diff-check.ts` (`diffOverrides`), `check-file-cli.ts`.
- `src/spec-parser/preset-loader.ts` (presets from the packaged entry).
- `src/cypher-interp/ast.ts`, `parse.ts`, `eval.ts` (`CALL { }` subqueries, §4.1).
- `package.json`; `scripts/v1.3/npx-verify.sh`; the pinned call sites of §2.2.
- Tests: `tests/unit/cli/engine-default.test.ts`, `tests/unit/cypher-interp/golden-parity.test.ts`,
  `tests/unit/mcp-server/npx-mode.test.ts`, `tests/unit/mcp-server/stdio-smoke.test.ts`; argv expectations updated
  in the tests of the pinned call sites; `tests/unit/cli/require-env.test.ts` (TF-20 on the Neo4j engine, plus the
  no-password default).
- `results/v1.3-npx/verify.json` (new). No other file under `results/`, no golden snapshot, no frozen v1.2E artefact
  and no template text changed.
