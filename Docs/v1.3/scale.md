# v1.3 scale: large TypeScript codebases

Written 2026-10-16 on branch `v1.3-scale`, cut from `origin/v1.3` @ `2c64d1d5`. Goal: make `firewall evaluate` fast and stable on large TypeScript backends **without changing any output**. Every number below is a measurement on this machine (4 vCPU Intel Xeon 2.1 GHz, 15 GiB RAM, Linux cloud container, Node 22.22.0, Neo4j 5.26.24 Community + APOC 5.26.24 from the release tarball, 1 GB heap and 512 MB page cache as in `docker-compose.yml`). They are engineering measurements, not thesis results.

**Summary.**

- **Cycle queries.** Before: on all 6 projects at least one of the two bounded cycle queries hit Neo4j's 30 s query timeout, so the report carried a failed FF-S02, a `null` cycle metric, or both. After: both queries are answered in memory, with the same rows, in 10–60 ms. No query times out on any project.
- **Wall time.** Median wall time falls from 52–85 s to 10–26 s (PLACEHOLDER_SPEEDUP).
- **Extraction.** 10–30% faster with an identical APG.
- **Peak memory.** Peak RSS falls slightly by default and by up to 35% with the new opt-in `--skip-excluded-sources`.
- **Size limits.** A memory guard and `--max-files` turn "JavaScript heap out of memory" into a clear error.
- **Outputs.** Byte-identical before and after on the 71 reference cases and the 5 golden fixtures (228 files, three modes). On the six large projects the APG is byte-identical, and every query that completed before returns the same rows.

## 1. Corpus

Six public TypeScript backends, cloned with `git clone --depth 1` into a temporary directory and never committed. `results/v1.3-scale/corpus.json` has the pinned SHAs, the licences, the harness tsconfig and the spec of each. The harness tsconfig includes `**/*.ts`. The spec is the named preset. "Files" means files analysed: the source files left after the tool's default excludes (`node_modules`, `dist`, `build`, `*.d.ts`, `*.spec.ts`, `*.test.ts`).

| Project | Repository @ SHA | Licence | Spec | Files | APG nodes | APG edges |
|---|---|---|---|---|---|---|
| nest | `nestjs/nest` @ `1c2f6895` | MIT | `presets/nestjs.yaml` | 1,498 | 6,064 | 10,992 |
| amplication | `amplication/amplication` @ `7656495d` | Apache-2.0 (`ee/` excluded) | `presets/nestjs.yaml` | 2,285 | 6,402 | 15,213 |
| typeorm | `typeorm/typeorm` @ `fe923942` | MIT | `presets/layered.yaml` | 2,637 | 8,866 | 21,682 |
| prisma | `prisma/prisma` @ `55dba883` | Apache-2.0 | `presets/clean-architecture.yaml` | 3,189 | 16,417 | 26,135 |
| payload | `payloadcms/payload` @ `2b3d9ca4` | MIT | `presets/hexagonal.yaml` | 4,897 | 13,277 | 23,236 |
| rocketchat | `RocketChat/Rocket.Chat` @ `80dceecf` | MIT (`ee/` directories excluded) | `presets/ddd.yaml` | 5,507 | 17,560 | 36,570 |

The five presets cover every built-in template family (core, NestJS, layered, hexagonal, DDD). Dropped candidates: Unleash (AGPL-3.0), Medusa (mixed licence with enterprise material) and botpress (3,008 `.ts` files, no new scale point). Hoppscotch (MIT, 868 files) was the pilot and is below the 1,000-file floor.

## 2. Where the time went (before)

`scripts/v1.3/scale/profile.ts` runs the pipeline exactly as `firewall evaluate --symbolic-only` builds it. It records the wall time and the peak RSS of each executor stage, and the evaluation time of each rule. Median of three runs:

PLACEHOLDER_BEFORE_TABLE

Three findings:

1. **The two bounded cycle queries dominate, and they fail.** FF-S02 `no-cyclic-deps` (`MATCH p = (f:File)-[:IMPORTS|RE_EXPORTS*2..10]->(f) … ORDER BY cycle LIMIT 101`) and the universal `cyclicDependencyCount` metric enumerate every bounded path from every File. The repository default timeout is 30 s (`DEFAULT_INGESTION_CONFIG.queryTimeoutMs`). The metric timed out on 6 of 6 projects and FF-S02 on 3 of the 5 specs that have it. When FF-S02 times out the run loses its blocking cycle rule silently: typeorm's verdict was `pass` only because FF-S02 failed to run. With the rows it is `hard-block` (§4).
2. **Every other rule is cheap.** No other template takes more than 0.5 s on any project; most take under 0.1 s. The slowest non-cycle rules are FF-CV05 `test-file-pairing` (≤ 0.5 s), FF-S03 and FF-DT01 (≤ 0.4 s).
3. **Extraction is the next cost**, and it scales with what ts-morph loads, not with what is analysed. The breakdown is in §5.

Ingestion takes 2–5 s, and compile and assembly take under 0.2 s.

## 3. The bounded cycle queries, answered in memory

The template text is not edited (`CYPHER_TEMPLATES`, rule tiers and the H13 cycle strategy are unchanged). `src/graph-accelerator/` adds `AcceleratedGraphRepository`, a `GraphRepository` decorator that `createPipeline` puts in front of the Neo4j repository:

- **The mirror** (`graph-mirror.ts`). Every ingestion write still runs on Neo4j first. The mirror follows the writes, recognised by their exact text (`nodeIngestCypher` / `edgeIngestCypher`, now exported from `graph-ingester.ts` with the same text). It holds each node's label and `filePath`, and the IMPORTS / RE_EXPORTS relationships with `line` and `viaReExport`. It is indexed by node id, by label and by relationship type.
- **When the mirror is trusted.** It is trusted only while it provably equals the database. It starts `unknown` and becomes `valid` on a successful `clearGraph`. Each write's `nodesCreated` / `relationshipsCreated` counter must equal the mirror's own count. Any other query with a non-zero data counter makes it `invalid`. Shared node ids are modelled as Neo4j's `MATCH (src:APGNode {id: …})` binds them: overloaded methods share an id, and nest, typeorm, prisma, payload and rocketchat all have some. One edge row then creates one relationship per pair.
- **Recognised reads** (`cycle-queries.ts`). Six texts, byte for byte: the compiled FF-S02 text in its four forms (with or without the `$excludePatterns` predicate, with or without the v1.3 literal edge view), built at load time with the compiler's own `replaceExcludeMarkers` and `applyV13Rewrites`, plus the frozen and literal `cyclicDependencyCount` texts. Every other query goes to Neo4j unchanged, with its parameters and timeout.
- **FF-S02.** The rows are the template's rows: one per simple cycle of 2..10 relationships, starting at its smallest `filePath`, with `line` = the minimum `line` of the first relationship's parallel edges, `ORDER BY cycle`, `LIMIT 101`. The enumeration is pruned three ways:
  1. it runs only inside strongly connected components, since a cycle never leaves one;
  2. a reverse breadth-first search gives each node's distance back to the start, and a branch is cut when that distance no longer fits in the length bound (the variable-length path pruning);
  3. neighbours are visited in ascending `filePath` order with the closing edge first, so cycles come out already in `ORDER BY cycle` order and the walk stops at the 101st row.
- **The metric.** It counts Files with a closed relationship-distinct walk of 2..10 relationships. Such a walk exists exactly when the File lies on a simple cycle of length 2..10 (found by breadth-first search in its component) or carries at least two self-loop relationships. Values are returned as the driver returns them: `line` a JS number or `null`, `cnt` a driver `Integer`, and the read counters all zero.
- **Guards.** Outside its guards an answer returns `undefined` and the query runs on Neo4j as before. The guards are:
  - a non-File node with an outgoing IMPORTS / RE_EXPORTS edge;
  - a `filePath` that is not printable ASCII, where string order and regex `.` could differ between Java and JavaScript;
  - duplicate paths among cycle-capable Files;
  - a non-numeric `line`, or a non-boolean `viaReExport`;
  - an exclude pattern outside the `globToRegex` grammar, which is matched as Java's `String.matches` would match it;
  - a walk over 20 M steps.
- **`--query-engine neo4j`** sends every query to Neo4j: the behaviour before this change, for audits and for the registered H13 latency gate (`Docs/DiagnosticRuns/bt-latency-profile.md`).

## 4. Proof that outputs did not change

**Reference cases and golden fixtures.** `scripts/v1.3/scale/equivalence.ts` runs the real pipeline in-process over the 71 reference cases (materialised with `validate-reference.ts --materialise`) and the 5 golden fixtures (`specs/clean-arch.yaml`). Each case runs under both scoring modes (`v1.3`, `v1.2e`). Per case it writes the `--format json` report, without the run-time fields `runId`, `durationMs`, `executionTimeMs`, `totalMs` and `timestamp`, and the extracted APG. That gives 228 files. Two baseline runs of `origin/v1.3` agree byte for byte, so the harness is deterministic. Every set below has the same combined SHA-256 (`c3a745d9…b06b1a`; per-file hashes in `results/v1.3-scale/equivalence-sha256.txt`):

| Output set | Code | Files identical to the baseline |
|---|---|---|
| baseline (two runs) | `origin/v1.3` | 228 / 228 |
| after, default | `v1.3-scale` | 228 / 228 (FF-S02 answered in memory 122 times, the metric 152 times) |
| after, `--query-engine neo4j` | `v1.3-scale` | 228 / 228 |
| after, `--skip-excluded-sources` | `v1.3-scale` | 228 / 228 |

The golden suite (`GOLDEN_REQUIRED=1 npm run test:golden`) passes its snapshot suites unchanged: `golden`, `u1-templates`, `u2-ingestion`, `u3-templates`, `u3-byte-stability` and `neo4j-infra`. The full-mode lane passes (7/7). The five `u4-neural` replay tests fail with `JUDGE_RUN_INCOMPLETE` on `origin/v1.3` too, in this environment. They are pre-existing and unrelated.

**The large projects.** The APG extracted before and after is byte-identical on all six projects (SHA-256 prefixes `7f442b4c`, `59072735`, `2e31de30`, `e6feaf36`, `2ed93cd8`, `4665f8ba`). The reports differ only where the baseline lost a query to the timeout:

| Project | Report lines changed | What changed |
|---|---|---|
| nest, prisma, rocketchat | 13 | `cyclicDependencyCount`: `null` + METRIC_001 → a number. FF-S02 rows identical (nest and prisma: truncated at 101, as before) |
| amplication, typeorm, payload | 1,776 | the same, plus FF-S02 moves from `failed: EVAL_002` (timeout) to 100 rows (truncated). The blocking tier and the AHS follow; typeorm `pass` → `hard-block` |

**In-memory answers against Neo4j itself.**

- `tests/golden/scale-accelerator.test.ts` (golden suite) ingests 60 seeded random graphs (parallel edges, self-loops, re-export flags, missing lines, a Package, a shared node id) and the 5 golden fixtures. It runs all six recognised texts in memory and on Neo4j; every row list is identical.
- `tests/unit/graph-accelerator/cycle-queries.test.ts` compares the answers with a brute-force reading of the Cypher text: every relationship-distinct walk, then the WHERE, DISTINCT, aggregation, ORDER BY and LIMIT clauses. It covers 300 seeded graphs in both views, with and without excludes. The unit tests also cover every guard.
- `scripts/v1.3/scale/differential.ts` does the same on the large projects, with a long Neo4j timeout. Results are in `results/v1.3-scale/differential/`:

PLACEHOLDER_DIFF_TABLE

## 5. Extraction

Two exact optimisations in `src/apg-extractor/import-resolver.ts`:

- **Module resolution memo.** `ts.resolveModuleName` ran once per import statement, with no cache. TypeScript resolves a name from the containing file's directory only, and its own resolution cache is keyed the same way. The memo per directory and specifier therefore returns what a fresh call would.
- **Dynamic-import scan.** `findDynamicImportCalls` wrapped every `CallExpression` of every file, twice per file: once for resolution, once for the unsupported count. It now walks the compiler tree once per file, in the same pre-order as `getDescendantsOfKind`, and wraps nothing. The line is ts-morph's (one plus the number of `\n` before the start), and `require` is matched on the identifier's `text`, as ts-morph's `Identifier.getText()` does. A unit test checks both against ts-morph on `\r\n`, a lone `\r`, `\u2028` and an escaped `requir\u0065`.

Phase breakdown (`scripts/v1.3/scale/extract-phases.ts`; one run each; "load" is ts-morph parsing, "checker" is program creation):

| Project | Loaded files (default / skip) | Arm | Load (s) | Checker (s) | Node pass (s) | Edge pass (s) | Total (s) | Peak RSS (MB) |
|---|---|---|---|---|---|---|---|---|
| nest | 2,033 / 1,498 | before | 1.3 | 0.9 | 1.5 | 2.6 | 6.3 | 574 |
| | | after | 1.3 | 0.9 | 1.4 | 2.0 | 5.7 | 520 |
| | | after, `--skip-excluded-sources` | 0.9 | 0.8 | 1.4 | 1.9 | 5.0 | 427 |
| amplication | 2,507 / 2,286 | before | 1.2 | 1.0 | 0.9 | 3.7 | 6.8 | 645 |
| | | after | 1.1 | 1.0 | 0.9 | 2.6 | 5.6 | 586 |
| | | after, `--skip-excluded-sources` | 1.1 | 1.0 | 1.0 | 2.5 | 5.6 | 540 |
| typeorm | 3,606 / 2,637 | before | 1.9 | 1.3 | 1.7 | 4.0 | 8.8 | 713 |
| | | after | 1.9 | 1.3 | 1.6 | 3.2 | 8.0 | 713 |
| | | after, `--skip-excluded-sources` | 1.4 | 0.9 | 1.6 | 3.3 | 7.3 | 609 |
| prisma | 5,961 / 3,611 | before | 5.8 | 3.5 | 2.0 | 8.8 | 20.0 | 2,225 |
| | | after | 6.2 | 3.5 | 2.0 | 4.7 | 16.4 | 1,993 |
| | | after, `--skip-excluded-sources` | 3.5 | 2.1 | 1.8 | 4.8 | 12.2 | 1,285 |
| payload | 5,594 / 4,925 | before | 4.1 | 2.7 | 0.5 | 6.8 | 14.1 | 1,375 |
| | | after | 4.2 | 2.5 | 0.5 | 3.1 | 10.3 | 1,249 |
| | | after, `--skip-excluded-sources` | 2.9 | 1.9 | 0.4 | 3.1 | 8.2 | 967 |
| rocketchat | 6,455 / 5,577 | before | 3.8 | 2.8 | 3.0 | 11.6 | 21.2 | 1,760 |
| | | after | 4.0 | 2.8 | 3.3 | 6.2 | 16.4 | 1,568 |
| | | after, `--skip-excluded-sources` | 3.2 | 2.5 | 3.1 | 5.9 | 14.8 | 1,348 |

The cost that remains is TypeScript's: parsing and program creation for every file the tsconfig names, and the checker calls of the node and edge passes. The default loads every tsconfig file, tests included, because the type checker's root set could in principle change a type's printed form (union order follows type ids). **`--skip-excluded-sources`** (opt-in) loads only the analysed files plus every declaration file. An excluded file still reaches the checker when an analysed file imports it. On all six projects and all 76 cases the output is byte-identical to the default, but it is not guaranteed in general, so it stays a flag.

"ts-morph project reuse": the `evaluate` pipeline already builds one `Project` per run. The other `new Project` calls are in other commands (`apg-enrich/cheap`, the judge's source context). "Skipping lib type-checking": the extractor never asks for diagnostics, so `skipLibCheck` changes nothing. The lib files themselves are needed: `getType()` resolves `Promise`, `Map` and the other lib types the DI and FLOWS_TO rules read.

## 6. Memory guard and `--max-files`

- **`--max-files <n>`.** It counts the tsconfig's files after the exclusions *before any file is parsed*, and counts again on the loaded project. It stops with `PROJECT_TOO_LARGE` (exit 2) in under 2 s on payload: `Project too large: 4897 source files to analyse in <clones>/payload after the exclusions, over --max-files 3000. Narrow exclude_paths in the spec, point --project or --tsconfig at one package, or raise --max-files.`
- **The memory guard** (`src/shared/process/memory-guard.ts`) is always on. By default it stops a run only where V8 would abort anyway, so every run that completed before still completes; the sweep below has no false stop. It has two kinds of check.
  - **Projections**, before each step that cannot be interrupted. Each factor below is a lower bound measured on the corpus, and the check fires only when even the lower bound passes V8's heap limit.

    | Before | Factor | Value | Smallest measured |
    |---|---|---|---|
    | parsing | `HEAP_PER_SOURCE_BYTE` (live heap per byte of source loaded) | 35 bytes | 37 |
    | program and checker creation | `CHECKER_HEAP_GROWTH` (over the parsed heap) | 1.4 | 1.41 |
    | the node and edge passes | `EXTRACTION_HEAP_GROWTH` (over the heap with the checker) | 1.05 | 1.05 |

    The last projection needs the checker to exist first, so the extractor now creates it explicitly before the node pass, which would otherwise create it on its first type query. The APGs and the 228 equivalence files are identical with this change.
  - **A checkpoint** every 5 files of the node and edge passes, after loading, and before ingestion. It stops the run when the live heap is over 95% of the limit. The live heap is measured after a forced full collection, at most one per four times the last collection's duration: back-to-back collections near the limit would themselves trip V8's "ineffective mark-compacts" abort.
- **`--memory-limit-mb <n>`** adds a resident-memory budget at the checkpoints. Use it for a container limit below the heap limit, or for an earlier, guaranteed clean stop.
- **The error** is `MEMORY_LIMIT_EXCEEDED` (exit 2), e.g. `Project too large for the available memory: 6455 TypeScript files (19 MB of source) need at least 652 MB of heap, over the 648 MB Node heap limit. Analyse a smaller part (narrow exclude_paths in the spec, or point --project or --tsconfig at one package), cap the size with --max-files, try --skip-excluded-sources, or give Node more heap (NODE_OPTIONS=--max-old-space-size=<MB>).`

Sweep with a reduced heap (`NODE_OPTIONS=--max-old-space-size=<MB>`, `evaluate --symbolic-only`, final code). "V8 abort" is the old behaviour: exit 134, "JavaScript heap out of memory".

| Project | Heap (MB) | Flags | Exit | Outcome | Time (s) |
|---|---|---|---|---|---|
| prisma | 900 | | 2 | clean stop before parsing | 1.7 |
| prisma | 1,300 | | 2 | clean stop before checker creation | 8.3 |
| prisma | 1,600 | | 1 | completes (`hard-block`) | 33.8 |
| prisma | 900 | `--skip-excluded-sources` | 134 | V8 abort | 20.8 |
| prisma | 1,100 | `--skip-excluded-sources` | 1 | completes | 19.9 |
| payload | 600 | | 2 | clean stop before parsing | 1.7 |
| payload | 900 | | 134 | V8 abort | 11.3 |
| payload | 1,000 | | 1 | completes | 18.4 |
| payload | 3,000 | `--memory-limit-mb 1000` | 2 | clean stop during node extraction | 8.8 |
| rocketchat | 600 | | 2 | clean stop before parsing (needs ≥ 652 MB) | 1.7 |
| rocketchat | 900, 1,000 | | 134 | V8 abort | 13.6, 15.6 |
| rocketchat | 1,200 | | 0 | completes (`pass`) | 27.2 |
| nest | 300 | | 134 | V8 abort | 6.5 |
| nest | 350, 600 | | 1 | completes | 11.6, 11.0 |

The projections stop the clearly-too-big runs in under 10 s instead of letting them crash. A run whose real need falls between the lower bound and the limit can still end in V8's abort, as it did before.

Stricter defaults were tried. A 92% or an 85% checkpoint budget turned more of those aborts into clean stops, but they also stopped runs that complete: rocketchat at 1,200 MB, payload at 1,000 MB, prisma at 1,600 MB. That would change the default outcome, so they were not kept. For a guaranteed clean stop, set `--memory-limit-mb` below the container's memory.

## 7. After

Median of three runs, the same harness, `v1.3-scale`:

PLACEHOLDER_AFTER_TABLE

## 8. Not done, and why

- **Parallel template evaluation.** After §3 the remaining 15–25 templates take 0.3–1.6 s together. Parallel sessions would save under a second, against the risk of reordering the rows of templates without `ORDER BY`.
- **Interpreter indexes / `--engine cypher-interp`.** There is no Cypher interpreter on `v1.3`, so the engine is Neo4j 5.26 + APOC from the tarball, as the task allows. The mirror's id, label and type indexes are the part of that idea that applies.
- **Ingestion batching.** Ingestion takes 2–5 s with one `UNWIND` per type; Neo4j's 1 GB heap held the largest batch (rocketchat, 36,570 edges). Splitting the batches would not change the rows, but it adds transactions and is not needed at this size.

## 9. Reproduce

```sh
# Neo4j 5.26.24 + APOC 5.26.24 from the release tarball (or docker compose up -d neo4j); export NEO4J_PASSWORD
npx tsx scripts/v1.3/validate-reference.ts --materialise /tmp/ref
npx tsx scripts/v1.3/scale/equivalence.ts --cases /tmp/ref --out /tmp/eq   # add --neo4j-only or --skip-excluded-sources
GOLDEN_REQUIRED=1 npm run test:golden
# per project (clone at the SHA in results/v1.3-scale/corpus.json, write the harness tsconfig it lists):
node --import tsx scripts/v1.3/scale/profile.ts --project <dir> --spec presets/<preset>.yaml --tsconfig <file> --out p.json --report r.json
node --import tsx scripts/v1.3/scale/differential.ts --project <dir> --tsconfig <file> --timeout-ms 600000 --out d.json
node --import tsx scripts/v1.3/scale/extract-phases.ts --project <dir> --tsconfig <file> [--code <baseline worktree>]
node --import tsx scripts/v1.3/scale/summarise.ts --dir <runs> --out results/v1.3-scale/profiles.json
```
