# ISE robustness: structure over vocabulary, held-out rename probes, and the spec-validate defect (exploratory), 2026-10-15

Branch `v1.3-ise-robust`, cut from `origin/v1.3` (after the ISE prototype, `Docs/DiagnosticRuns/ise-prototype-2026-10-15.md`). **Exploratory.** Nothing was pre-registered and the AI-DLC workflow was not run (author decision). There are two parts:

- **Task A** makes ISE (Implicit Specification Extraction) robust to renamed directories by using edge structure instead of directory vocabulary.
- **Task B** fixes a real defect: the v1.3 `firewall validate` rejected the true nestjs spec and `presets/ddd.yaml` against their own reference projects.

Outputs are in `results/v1.3-ise-robust/2026-10-15/`:

| Directory | Targets | Content |
|---|---|---|
| `dev/` | the 5 reference projects and P1–P5, the prototype's rename probe (the **development** probe) | `measure.{md,json}` holds (a)–(c) and Options 1 and 3. `downstream.{md,json}` holds (d). `specs/` and `raw/` as in the prototype. |
| `heldout/` | N1, N2 and S per style (15 targets, the **held-out** probes) | the same files, plus `probes.json` (the probe definitions) |

## Commit order (anti-tuning)

| Commit | Content |
|---|---|
| `a7756f68` | Task B: the validator fix and its regression test |
| `08c6cd8c` | Task A: the structural fixes **and** the held-out probe definitions (`scripts/v1.3/lib/ise-probes.ts`, recorded in `scripts/v1.3/lib/ise-probes.json`). The fixes were developed against the 5 reference projects and P1–P5 only. Before this commit, the held-out probes were only checked for validity: they materialise, type-check and validate against their mapped true spec (`tests/unit/scripts/v1.3/ise-probes.test.ts`). No inference ran on them. |
| next commit | the measurements, this write-up, and one change to `ise-downstream.ts`. That change records a per-target evaluation error instead of aborting the run (see S-ddd below). `src/ise` was not touched after the held-out run. |

## Task B: `LAYER_DIR_NOT_FOUND` on the nestjs and ddd references

**Diagnosis: the validator is wrong, not the spec or the preset globs.** `validateSpecAgainstProject` strips a trailing `/**` or `/*` from each layer directory and checks the rest as a literal path with `existsSync`. That fails in two ways:

1. **Inner wildcards are globs.** `presets/ddd.yaml` declares `src/*/domain/**`, `src/*/application/**`, `src/*/infrastructure/**`, `src/*/acl/**` and `src/*/api/**`. The validator looked up the directory literally named `src/*/domain` and reported 5 errors. The layer annotator (`annotateNodes`, picomatch) treats these as globs, and they match the reference files. The validator disagreed with the code that actually assigns layers.
2. **Multi-shape presets list alternative directories.** `presets/nestjs.yaml` says in its header that it supports both layered-directory and feature-module projects, with `file_patterns` as the fallback. It therefore lists `src/core/**`, `src/gateways/**`, `src/prisma/**` and so on, and no single project has all of them. The validator demanded every alternative exist and reported 16 errors. Every one of those layers does match files in the reference, through another glob or a file pattern. The reference `spec.yaml` is a verbatim copy of the preset, as `Docs/v1.3-reference-notes.md` requires.

**Fix (rules `v1.3` only, `src/spec-parser/spec-validator.ts`).** Layer directories are now matched against the project's files with picomatch (`dot: true`), the same matcher the annotator uses, skipping `node_modules` and `.git`. A literal path that exists, such as `src/main.ts`, still matches.

- A layer is still an **error** (`LAYER_DIR_NOT_FOUND`) when none of its directory globs and none of its file patterns matches any file. That case is an empty layer: a typo or the wrong project.
- An unused alternative glob, in a layer that does match files, is now a **warning** with the same code.

**v1.2E is unchanged.** The literal check still runs when `rules` is `v1.2e` (the API default) and its code is untouched. The only other edits in the file are lint-only: `String()` around three numbers in a message, which prints the same text, and an `eslint-disable` comment on an untouched line. A test pins the v1.2E messages and counts (nestjs 16 errors, ddd 5).

**Regression test** (`tests/unit/spec-parser/v13-layer-globs.test.ts`): every v1.3 reference project, the clean variant **and all 71 variants**, validates against its own spec under v1.3. Unit tests cover inner wildcards, unused alternatives, a file-pattern fallback, a literal file, `node_modules` exclusion, and the unchanged v1.2E path.

CLI after the fix (`firewall validate`, default `--rules v1.3`):

| Reference | Result |
|---|---|
| clean-architecture, layered, hexagonal | valid |
| ddd | valid |
| nestjs | valid, with 16 warnings (one per unused alternative directory) |

## Task A: what changed in `src/ise`

Every change is a structural rule. None adds a directory name to any vocabulary.

1. **Source root and wrapper chains** (`units.ts`).
   - The source root descends through wrapper directories: `src/x/` when every file sits under it.
   - A chain of single-child directories is looked through, so that `src/a/only/{b,c}` branches into `b` and `c`.
2. **Structural container split** (`units.ts`, `isStructuralContainer`). A top-level directory is split into its children when:
   - it has no files of its own (along its chain);
   - it branches into at least 2 child directories;
   - at most 10% of the edges touching those children run between two of them (`STRUCTURAL_CONTAINER_MAX_CROSS`).

   This is the prototype's proposed fix, with one addition: a single stray import between the children is tolerated. Planted violations such as hexagonal v05 (inbound adapter → outbound adapter) are exactly such a stray import. Edges between children of the same container are **lateral**: they stay in the unit edges but are kept out of the level order. The container vocabulary (`adapters`, `common`, …) still splits as before.
3. **Adapter direction and ports** (`style-classifier.ts`).
   - *Outer units* are units at level 1 or higher that no unit imports except a composition root.
   - An outer unit is **outbound** if it implements an interface owned by a lower-level unit (a driven port), and **inbound** otherwise.
   - The hexagonal structural evidence (+2) now requires separate inbound and outbound adapter units, together with dependency inversion and a composition root. In the prototype, any two independent sibling units at the same level were enough.
   - New evidence, +1 for hexagonal: a *driving port*, meaning an interface owned and implemented inside the core that an inbound adapter imports.
4. **Blind bounded contexts** (`contexts.ts`, new). A top-level folder is a context when it pairs with a sibling that has the same internal layering:
   - both branch (through single-child chains) into at least 2 sub-folders;
   - they share at least 2 sub-folder names, with Jaccard ≥ 0.5;
   - the majority dependency directions between shared sub-folders never contradict, and at least one direction is common;
   - cross-folder edges are under 40% of the edges touching the pair.

   The detection compares names *with each other*; it does not look names up in a list. Its result is united with the prototype's vocabulary detection. For each context, the layout records: the sub-folder levels inside the context; the outer ring (sub-folders above level 0 that no sibling sub-folder imports); the domain sub-folder (named `domain`, else the level-0 sub-folder the siblings import most); and the application sub-folder (named `application`, else the level-1 sub-folder that imports the domain and is imported most).
5. **Layer mapping inside contexts** (`layer-mapper.ts`). A context's sub-folder is ranked by its level *inside the context*, and the outer ring is ranked outermost. Previously it was ranked by its global level, which put the renamed domain at *application*, because it imports the shared kernel.
6. **DDD block** (`ddd-inferrer.ts`). Aggregates, repository globs and application-service globs are taken from the layout's domain and application sub-folders, with paths relative to the context, so they also work below an inserted level.

All five reference projects give **byte-identical inferred spec bodies** to the prototype; only the `#` header comments differ. Their (d) results are therefore unchanged by construction, and the re-run confirms it.

## Probes

| Probe | Set | Names | Nesting |
|---|---|---|---|
| P1–P5 | development | the prototype's (`kernel`, `orchestration`, `platform`, `plugins/entry`, …) | unchanged |
| **N1** | held-out | drawn with seed 1101 | a **root wrapper**: every file one level deeper (`src/<w>/…`) |
| **N2** | held-out | drawn with seed 2202 | an **inner level** inside every top-level directory (`src/<top>/<inner>/<sub>/…`; files directly in a top-level directory stay) |
| **S** (scrambled) | held-out | N1's directories | N1's, **plus** class and file suffixes renamed: `Repository→Store`, `Controller→Endpoint`, `Service→Handler`, `UseCase→Job`, `Gateway→Link`, `Adapter→Bridge`, `Dto→Payload`, `Module→Bundle`, `Guard→Sentry`, `Filter→Sieve`. This applies to declared identifiers and to PascalCase, dot and kebab file names. |

How the held-out probes were built:

- **Directories renamed.** The same directories as the development probe, for each style.
- **Word draw.** Words come from a fixed list of 78 neutral nouns (`PROBE_WORDS`), drawn with mulberry32 and a partial Fisher–Yates shuffle.
- **Excluded words.** Any ISE vocabulary token, any reference directory name (a test checks this list against the fixtures), and any development-probe name. No excluded word was drawn.
- **Example.** N1-hexagonal is `src/saffron/{anvil, thistle, jasper/{maple,ridge}, oasis}`; N2-ddd is `src/<ctx>/garnet/{aspen,ridge,kelp}`. Every definition is in `probes.json`.
- **Ground truth.** It goes through the same pure path transform: expected layers, expected findings, the true spec's layer globs and DDD block, and, for S, the file patterns and naming `pattern`s.
- **Validity.** All 213 probed variants type-check, except ddd v04: it imports `class-transformer`, which no reference ships, so it fails identically without the probe.

## Results: development probe (`dev/`)

The development probe is not an honest estimate, because the fixes were made to pass it.

| Target | (a) style, clean | (a) variants | (b) preset-first / infer-only | (c) files differing | (d) verdict / blocking identical | (d) planted, true / inferred spec |
|---|---|---|---|---|---|---|
| 5 reference projects | all correct (hexagonal 0.83, was 0.82) | 71/71 | 146/146 / 146/146 | 0 | 71/71 / 71/71 | 50/52 / 50/52 |
| P1 clean | clean 1.00 | 14/14 | 29/29 / 29/29 | 0/29 | 14/14 / 14/14 | 9/10 / 9/10 |
| P2 layered | layered 1.00 | 13/13 | 27/27 / 27/27 | 0/27 | 13/13 / 13/13 | 9/9 / 9/9 |
| P3 nestjs | nestjs 1.00 | 14/14 | **29/29** (was 28/29) / 29/29 | 0/29 | 14/14 / 14/14 | 9/10 / 9/10 |
| P4 hexagonal | **hexagonal 1.00** (was clean) | **15/15** (was 0/15) | **30/30** (was 20/30) / 30/30 | **0/30** (was 10/30) | **15/15 / 15/15** (was 11/15, 10/15) | 11/11 / **11/11** (was 5/11) |
| P5 ddd | **ddd 0.75** (was clean) | **15/15** (was 0/15) | **31/31** (was 6/31) / 31/31 | **0/31**; DDD block 0 fields differ (was 8/8) | **15/15 / 15/15** (was 8/15, 7/15) | 12/12 / **12/12** (was 0/12) |

The true-spec planted count on ddd is 12/12 here, where the prototype reported 11/12; the inferred spec equals it in both runs. This comes from the firewall at the current `v1.3` head, not from `src/ise`: the ddd spec bodies are byte-identical to the prototype's.

## Results: held-out probes (`heldout/`), the honest estimate

### (a) Style and (b) per-file layers

| Probe | Clean variant classified | Variants correct | (b) preset-first | (b) infer-only |
|---|---|---|---|---|
| N1 (5 styles) | 5/5 correct (ddd 0.75, the others 1.00) | 71/71 | 146/146 | 146/146 |
| N2 (5 styles) | 5/5 correct (ddd 0.75, the others 1.00) | 71/71 | 146/146 | 146/146 |
| S, scrambled (5 styles) | 5/5 correct (ddd 0.75, the others 1.00) | 71/71 | **136/146** | 136/146 |

S-nestjs gets 19/29 files right. Without the `.controller`, `.service` and `.repository` suffixes, the preset's file patterns match nothing, and each feature folder becomes one unit with one structural layer. The confidence stays informative: pooled over the held-out targets, the high bucket is 18/18, the medium bucket 55/55, and the low (structure-only) bucket 355/365. All 10 wrong files are in the low bucket.

### (c) Spec equivalence

| Probe | Spec valid | Files with another layer | DDD block fields differing |
|---|---|---|---|
| N1, N2 | 10/10 | 0 on every target | 0 |
| S | 5/5 | 0, except **S-nestjs 10/29** | **S-ddd: `repositories`** |

On S-ddd the true value is `*Store.ts`. The inferred value is empty: the inferrer recognises repositories only by the `Repository` suffix.

### (d) Downstream (Neo4j 5.26 + APOC, 213 variants × 2 specs)

| Target | Verdict agrees | Blocking set identical | Mean Jaccard | Planted, true spec | Planted, inferred spec |
|---|---|---|---|---|---|
| N1 (5 targets) | 71/71 | 71/71 | 1.00 | 50/52 | 50/52 |
| N2 (5 targets) | 71/71 | 71/71 | 1.00 | 50/52 | 50/52 |
| S-clean | 14/14 | 14/14 | 1.00 | 8/10 | 8/10 |
| S-layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 |
| S-hexagonal | 15/15 | 15/15 | 1.00 | 9/11 | 9/11 |
| **S-nestjs** | **7/14** | **0/14** | **0.07** | 8/10 | **6/10** |
| **S-ddd** | **inferred spec rejected** | | | 12/12 | **0/12** (no evaluation possible) |

**Honest estimate:**

- **Names and nesting (N1, N2).** The fixed ISE reproduces the true spec's blocking findings on every one of the 142 variants and loses no planted violation. This is a clean held-out replication of the development result.
- **Suffixes (S).** Structure carries clean architecture, layered and hexagonal completely. The inferred and true specs agree on 42/42 variants there. The planted-recall drop on S-clean and S-hexagonal (8/10, 9/11) is the firewall's own: it happens under the *true* spec too, because some firewall rule templates select classes by their `Repository` or `Controller` names, which ISE does not control. Structure does **not** carry NestJS or the DDD tactical block:
  - **S-nestjs.** The inferred spec keeps the preset's file patterns, which no longer match. Feature folders get a single structural layer. That gives 6 extra FF-S01 blocking findings on every variant (controller and service → DTO folder) and misses 2 planted violations (v03, v10).
  - **S-ddd.** The inferred `architecture.ddd.repositories` is empty. The emitted spec passes `parseSpec` and the v1.3 validator, but the fitness compiler rejects it (`BR-SPEC-10 FF-DT02: repositoryPatterns`), so the firewall cannot run on it at all. This is a real ISE defect that only the held-out probe found. It was **not** fixed after the run, to keep the estimate honest. The fix belongs in a new, separately probed iteration: a structural repository rule (domain-owned interfaces implemented in the context's outer ring), and checking the emitted spec with the compiler, not just the validator.

### Options 1 and 3

Held-out results are within one variant of the development numbers.

- **Option 1** on N1 and N2 equals P1–P5 per style.
- **Option 1** on S loses 1 planted violation each on clean, nestjs and hexagonal. Its `implements-port` rule keys on `*Repository`.
- **Option 3** is unchanged, except S-nestjs, which drops to 4/10 (P3: 5/10).

## Threats to validity

- **Same 5 projects, same author.** The held-out probes change names and depth, not code, and the reference projects were written by the author of the presets. They are a replicate under a new surface, not new architectures. The brownfield and E1 next steps of the prototype remain.
- **The development and held-out probes rename the same directory slots.** Sub-folder names such as `ports/in`, `value-objects`, `events`, `contracts` and `acl` are untouched, and the DDD block and the hexagonal "ports split by direction" (+1) evidence still use them. The S probe shows that suffix vocabulary matters for NestJS and DDD.
- **Context detection compares sub-folder names across siblings.** It is robust to consistent renames, as in every probe here, but not to contexts whose layers are named differently from each other.
- **The thresholds (10% cross-child edges, Jaccard 0.5, 40% cross-context traffic) were set during development.** They were set before the held-out run but were not independently justified. The 10% value was chosen so that a single planted lateral import does not undo the split.
- **Circularity and consistent-but-wrong styles** (prototype §5) are unaffected.

## Reproduce

```bash
npx tsx scripts/v1.3/ise-measure.ts --out results/v1.3-ise-robust/2026-10-15/dev                       # (a)-(c), dev set
npx tsx scripts/v1.3/ise-measure.ts --set heldout --out results/v1.3-ise-robust/2026-10-15/heldout     # (a)-(c), held-out
NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... \
  npx tsx scripts/v1.3/ise-downstream.ts [--set heldout] --out <dir>                                    # (d), live
npx tsx scripts/v1.3/ise-downstream.ts --from-raw [--set heldout] --out <dir>                           # (d) from the saved rows
npx jest tests/unit/ise tests/unit/scripts/v1.3/ise- tests/unit/spec-parser/v13-layer-globs.test.ts
```

Neo4j was started locally in this session (`neo4j:5.26-community` with APOC, via Docker). The raw rows are under `raw/`, and `--from-raw` recomputes every (d) number without Neo4j.

The full unit suite has 4193 tests passing and 6 failing. All 6 failures are in 5 suites (`llm-critic/replay-no-binary`, `scripts/generators/skeleton`, `scripts/mutation/import-graph-parity`, `scripts/u5b/guards`, `scripts/u5b/score-golden-acceptance`), and those 5 suites fail identically on unmodified `origin/v1.3` in this container (offline npm, missing binaries, shallow git history). Once `origin/v1.2e` is fetched, the U5b results guard (`guards.test.ts`) still fails, because it rejects every `results/v1.3-*` directory already on `v1.3`, such as `results/v1.3-barrels/`. `results/v1.3-ise-robust/` follows the same convention as those directories.
