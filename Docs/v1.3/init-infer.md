# Zero-config onboarding: `firewall init`, `evaluate --from-inferred` and MCP `propose_spec` (exploratory), 2026-10-16

Branch cut from `origin/v1.3`, after PR #105 (ISE structure over vocabulary) was merged. **Exploratory.** Nothing here was pre-registered, and the AI-DLC workflow was not run, as for the ISE runs (`Docs/DiagnosticRuns/ise-prototype-2026-10-15.md`, `ise-robustness-2026-10-15.md`).

**The goal.** A user, or a coding agent through MCP, points the tool at a TypeScript project that has **no spec**. The tool proposes a spec and reports the first findings. The inference is ISE Option 2 (`src/ise`): it classifies the style, keeps the canonical preset, and parameterises its layer globs from the code. This change adds three things:

- the user-facing commands around it;
- the confidence and evidence on every mapping, and the questions to put to the user;
- a measurement of the path a user actually runs.

Results are in `results/v1.3-init-infer/2026-10-16/`:

| Directory | Targets | Content |
|---|---|---|
| `.` | the 5 dev reference projects (71 variants) and P1–P5, the ISE folder-renaming probe | `init-infer.{md,json}` and `raw/<target>/<variant>.json`. The raw files hold both specs' firewall rows and the `specSource` of the `--from-inferred` report. |
| `heldout/` | the ISE held-out probes N1, N2 and S (213 variants) | the same files |

## 1. Usage

### `firewall init`

```bash
firewall init --project <dir>                    # writes <dir>/firewall.spec.yaml, summary on stderr
firewall init --project <dir> --out arch.yaml    # another file name
firewall init --project <dir> --print            # print the YAML on stdout; write nothing
firewall init --project <dir> --format json      # the whole proposal as JSON on stdout
```

- **What it reads.** `init` reads only `<dir>/src/**` and `<dir>/tsconfig.json`. It takes a snapshot of those two, as ISE's anti-leakage boundary does. It never reads `.env`, a spec, or anything else in the project.
- **It never overwrites a spec.**
  - It refuses (exit 1, nothing written) when the target file exists.
  - Without `--out`, it also refuses when the project root already has a file with a spec name the repository uses: `firewall.spec.yaml`, `spec.yaml`, `.firewall.yaml` or `architecture.yaml`.
  - The file is opened with `wx`, so a file that appears between the check and the write is not overwritten either.
- **Exit codes.**
  - 0: written, or printed with `--print`.
  - 1: a spec already exists, or the proposal fails the repository checks. In the second case it is still written, with a `WARNING` header, so that it can be reviewed.
  - 2: the project cannot be read, for example because it has no `src/`.

The written spec is the canonical preset with ISE's layer globs (and, for DDD, ISE's `architecture.ddd` block). The only additions are comments:

- a header: the label `INFERRED SPEC, NOT AUTHOR-DECLARED`, the style and its confidence, the runner-up, and the style evidence;
- a trailing comment on **every** layer glob, with its origin, confidence and evidence;
- at the end, the open questions.

The comment on a glob gives three things:

- **Origin.** `preset` means a glob of the canonical preset that matches files here. `INFERRED` means ISE wrote the glob for a folder.
- **Confidence.** Taken from the ISE layer mapper: 0.90 when the name and the import structure agree, 0.70 for a file-name pattern, 0.60 for the name only, and 0.50 for the structure only.
- **Evidence.** What the folder name suggests, what the structure suggests (with the dependency level), and the number of files.

The hexagonal reference with its folders renamed (probe P4) gives:

```yaml
# INFERRED SPEC, NOT AUTHOR-DECLARED: proposed by `firewall init` (ISE, src/ise) from the code alone.
# ...
# style: hexagonal (confidence 1.00)
  layers:
    - name: domain
      directories:
        - src/kernel/** # INFERRED, confidence 0.50: import structure only (the folder name is not recognised); structure suggests domain (dependency level 0); 8 files
    - name: adapters-inbound
      directories:
        - src/plugins/entry/** # INFERRED, confidence 0.50: import structure only (...); structure suggests adapters-inbound (dependency level 2); 4 files
    ...
# Questions for the author (ambiguous folders):
# Q1. Is src/kernel/ the domain layer? Only its imports say so (confidence 0.50). [...]
```

The unrenamed reference gives `- src/domain/** # preset, confidence 0.90: canonical preset glob; name suggests domain; structure suggests domain (dependency level 0); 8 files`, and no questions.

**Questions** (`src/ise/propose.ts`, `proposalQuestions`):

- **A folder (unit) with files that got no layer.** "Which layer does X belong to?"
- **A folder mapped below confidence 0.55, or whose name and structure disagree.** "Is X the Y layer?"
- **A close style call.** The top style's share is below 0.60, or the runner-up is within 0.20.

Entry files (a root file that no unit imports, such as `src/main.ts`) are deliberately outside the layer order. They are listed as files without a layer, but they are not asked about.

**Checks.** Every proposal goes through the repository's own spec validator (`validateSpecAgainstProject`, rules v1.3) and through the fitness compiler (the v1.3 templates). The ISE robustness run found a spec that passes the validator and is still rejected by the compiler (S-ddd, `BR-SPEC-10`), so both checks are needed.

### `firewall evaluate --from-inferred`

```bash
firewall evaluate --project <dir> --from-inferred --symbolic-only [--format human|json|csv]
```

- **What it runs.** It runs the same proposal `init` would write, from a temporary file that is never written into the project, through the unchanged pipeline.
- **The label.** Every output carries it:
  - stderr begins with `*** INFERRED SPEC, NOT AUTHOR-DECLARED ***` and a line with the style, its confidence and the number of open questions;
  - the human and CSV formats repeat the first line after the report;
  - the JSON report gets a first key, `specSource: { kind: "inferred", label: "inferred spec, not author-declared", style, styleConfidence, questions, unassignedFiles }`.
- **Options.** `--spec` and `--from-inferred` exclude each other (exit 2). Without `--from-inferred`, `--spec` is still required, with commander's own message and exit code. The default behaviour of `evaluate` is unchanged, and a test pins it: no inference and no `specSource`.
- **Engine.** It needs Neo4j, like any `evaluate`.

### MCP `propose_spec`

`propose_spec({ project? })` returns the same proposal as structured data:

- `label`, `style`, `styleConfidence`, `ranking`;
- `mappings[]`: layer, glob, origin, confidence, source, files, evidence;
- `unassignedFiles`, `questions[]`;
- `observations`: the ISE Option 1 majority patterns, given as context and not as rules;
- `check`;
- `yaml`, the commented spec.

It reads only `src/` and `tsconfig.json`, writes nothing, and needs no database. It is not one of `SPEC_TOOL_NAMES`, so the allow-list of the experiment arms (`scripts/lib/generators/arms.ts`) is unchanged. An agent is expected to put the questions to the user, then write the confirmed YAML itself.

## 2. Accuracy

### Method

`scripts/v1.3/init-infer-eval.ts` runs on every variant of the target set. For each variant it does three things:

1. It materialises the variant, renamed for a probe target.
2. It runs `proposeSpec` on it. This is **inference from the variant itself**, which is what `--from-inferred` does on a project without a spec. The ISE prototype's (d) instead inferred once from the *clean* variant, which a real user does not have.
3. It runs, through the CLI, `evaluate --spec <true spec>` and `evaluate --from-inferred` (both `--symbolic-only --format json`). The script checks that the style in the CLI's `specSource` equals the style `proposeSpec` produced.

The measures:

- **Style accuracy.** The classified style against the reference's style, per variant.
- **Per-file layer accuracy.** Each `src/**/*.ts` file is annotated with the firewall's own `annotateNodes`, using the inferred spec's layers. The truth is the layer in `expected-graph.json` (renamed for probes) where the file is listed, else the true spec's layer, for files that a variant adds.
- **Blocking agreement.** The blocking findings come from the v1.3 tiers under each spec's own style; FF-S02 cycles are compared as file sets (`blockingAgreement`, as in ISE (d)). The script counts:
  - verdict agreement: some blocking finding against none;
  - identical blocking sets;
  - the mean Jaccard;
  - planted recall (rule-exact, `compareVariant`) under each spec.
- **Questions.** The number of questions per variant. "Wrong files under a question" counts the wrong files that lie in a folder the proposal asks about. "Questions on correct folders" counts the questions whose folder is entirely right: the cost of asking.

**Engine.** `--engine cypher-interp` does not exist on `v1.3`: no CLI option or source file names it. Every evaluation therefore ran on **Neo4j 5.26.0 Community with APOC 5.26.0 core**, from the official tarball (`dist.neo4j.org`, `apoc-5.26.0-core.jar`). Docker was not available. Two local instances (bolt 7687 and 7688) ran disjoint targets in parallel, each under the repository's Neo4j lock. The password was generated for the session and passed in the environment; no `.env` was read.

### Results: dev set (71 variants) and the folder-renaming probe P1–P5

| Target | Style accuracy (variants) | Per-file layer accuracy | Verdict agrees | Blocking set identical | Mean blocking Jaccard | Planted, true spec | Planted, inferred spec | Questions per variant | Wrong files under a question | Questions on correct folders |
|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | 14/14 | 408/408 (100%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 0.0 | – | 0 |
| layered | 13/13 | 353/353 (100%) | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 0.0 | – | 0 |
| nestjs | 14/14 | 408/408 (100%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 0.0 | – | 0 |
| hexagonal | 15/15 | 453/453 (100%) | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 0.0 | – | 0 |
| ddd | 15/15 | 466/467 (99.8%) | 14/15 | 14/15 | 0.93 | 12/12 | **11/12** | 0.1 | 1/1 | 1 |
| **dev set, all 5 styles** | **71/71** | **2088/2089 (99.95%)** | **70/71** | **70/71** | 0.99 | 50/52 | **49/52** | 0.0 | 1/1 | 1 |
| P1 clean-architecture renamed | 14/14 | 408/408 (100%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 3.0 | – | 42 |
| P2 layered renamed | 13/13 | 353/353 (100%) | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 3.0 | – | 39 |
| P3 nestjs renamed | 14/14 | 407/408 (99.8%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 2.0 | 1/1 | 27 |
| P4 hexagonal renamed | 15/15 | 453/453 (100%) | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 5.0 | – | 75 |
| P5 ddd renamed | 15/15 | 464/467 (99.4%) | 14/15 | 14/15 | 0.93 | 12/12 | **10/12** | 6.1 | 3/3 | 89 |
| **P1–P5, all 5 styles** | **71/71** | **2085/2089 (99.8%)** | **70/71** | **70/71** | 0.99 | 50/52 | **48/52** | 3.9 | 4/4 | 272 |

No inferred spec was rejected by the firewall on these targets. The true spec misses 2 of the 52 planted violations (clean v07 and nestjs v09, `controller-no-entity`). These are the firewall's own known misses, as in the ISE robustness run.

### Results: held-out probes N1, N2, S (213 variants)

| Target | Style accuracy (variants) | Per-file layer accuracy | Verdict agrees | Blocking set identical | Mean blocking Jaccard | Planted, true spec | Planted, inferred spec | Inferred spec rejected | Questions per variant | Wrong files under a question | Questions on correct folders |
|---|---|---|---|---|---|---|---|---|---|---|---|
| N1-clean-architecture | 14/14 | 408/408 (100.0%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 0 | 3.0 | n/a | 42 |
| N1-layered | 13/13 | 353/353 (100.0%) | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 0 | 3.0 | n/a | 39 |
| N1-nestjs | 14/14 | 407/408 (99.8%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 0 | 2.0 | 1/1 | 27 |
| N1-hexagonal | 15/15 | 453/453 (100.0%) | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 0 | 5.0 | n/a | 75 |
| N1-ddd | 15/15 | 464/467 (99.4%) | 14/15 | 14/15 | 0.93 | 12/12 | 10/12 | 0 | 6.1 | 3/3 | 89 |
| N2-clean-architecture | 14/14 | 408/408 (100.0%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 0 | 3.0 | n/a | 42 |
| N2-layered | 13/13 | 353/353 (100.0%) | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 0 | 3.0 | n/a | 39 |
| N2-nestjs | 14/14 | 407/408 (99.8%) | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 0 | 2.0 | 1/1 | 27 |
| N2-hexagonal | 15/15 | 453/453 (100.0%) | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 0 | 5.0 | n/a | 75 |
| N2-ddd | 15/15 | 464/467 (99.4%) | 14/15 | 14/15 | 0.93 | 12/12 | 10/12 | 0 | 6.1 | 3/3 | 89 |
| S-clean-architecture-scrambled | 14/14 | 408/408 (100.0%) | 14/14 | 14/14 | 1.00 | 8/10 | 8/10 | 0 | 3.0 | n/a | 42 |
| S-layered-scrambled | 13/13 | 353/353 (100.0%) | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 0 | 3.0 | n/a | 39 |
| S-nestjs-scrambled | 14/14 | 267/408 (65.4%) | 7/14 | 0/14 | 0.07 | 8/10 | 6/10 | 0 | 7.0 | 141/141 | 42 |
| S-hexagonal-scrambled | 15/15 | 453/453 (100.0%) | 15/15 | 15/15 | 1.00 | 9/11 | 9/11 | 0 | 5.0 | n/a | 75 |
| S-ddd-scrambled | 15/15 | 464/467 (99.4%) | n/a | n/a | - | - | - | 15 | 6.1 | 3/3 | 89 |
| **N1 + N2, all 5 styles** | **142/142** | **4170/4178 (99.8%)** | **140/142** | **140/142** | 0.99 | 100/104 | **96/104** | 0 | 3.9 | 8/8 | |
| **S, 4 evaluable styles (S-ddd rejected)** | 71/71 | 1945/2089 (93.1%) | 49/56 | 42/56 | | 34/40 | 32/40 | 15 | | 144/144 | |

The probes are the ISE robustness run's held-out set:

- **N1** wraps every file one level deeper, under a root folder with a random name.
- **N2** inserts a random inner level inside every top-level folder.
- **S** uses N1's names and also scrambles the class and file suffixes (`Repository→Store`, `Controller→Endpoint`, …).

**Names and nesting (N1, N2): the same result as P1–P5.** 142/142 styles are right and 99.8% of files. The blocking set differs on the two ddd v07 variants, for the same reason as on the dev set, and the planted violations are lost on ddd v07 and v10, as on P5. Every wrong file is under a question.

**Suffixes (S): the known ISE limits pass straight through to the user path.**
- **S-nestjs.** Without the `.controller`/`.service`/`.repository` suffixes the preset's file patterns match nothing, and each feature folder becomes one structural unit. That leaves 141 wrong files and 6 extra FF-S01 blocking findings on every variant. The verdict agrees on 7/14, no blocking set is identical, and planted recall is 6/10 against 8/10 under the true spec. The ISE robustness run reported exactly the same, from the clean variant. All 141 wrong files are under a question: 7 per variant.
- **S-ddd.** The inferred `architecture.ddd.repositories` is empty, and the fitness compiler rejects the spec (`BR-SPEC-10 FF-DT02: repositoryPatterns`), so `--from-inferred` exits 2 on all 15 variants. `firewall init` reports the same before any evaluation: it exits 1 with `WARNING: the proposal does not pass the repository checks: MISSING_REQUIRED_PARAM: BR-SPEC-10 FF-DT02: repositoryPatterns`. That is the reason `init` runs the compiler, not just the validator.
- **The other three styles.** S-clean, S-layered and S-hexagonal agree on 42/42 variants. Their lower planted recall (8/10, 9/11) is the firewall's own: it is the same under the true spec.

### What the disagreements are

The verdict differs on only one variant per set, and it is the same one: **ddd v07 (module outside a context)**. Every disagreement is in `init-infer.md`, "Disagreements per target".

1. **ddd v07, and P5 v07: the planted violation becomes the rule.**
   - **What happens.** The variant adds `src/utils/formatCurrency.ts`, a module outside every bounded context, which FF-DS01 forbids. Inferred from this code, `src/utils/` is a unit that nothing below it imports, so structure maps it to *domain* (level 0). The true spec gives it no layer, and FF-DS01 fires.
   - **The effect.** It is the one wrong file on the dev set. The only blocking finding, FF-DS01, disappears: the true spec blocks the variant, the inferred spec does not, and the planted violation is missed.
   - **Was it asked?** Yes. `init` asks "Is src/utils/ the domain layer? Only its imports say so (confidence 0.50)."
2. **P5 v10 (api imports infrastructure): the planted import moves a folder's level.**
   - **What happens.** In the renamed DDD project, the planted import (`api/OrderController.ts` → `platform/InMemoryOrderRepository.ts`) makes `src/ordering/platform/` (the renamed infrastructure) a folder that a sibling imports. It is then no longer the context's outer ring, and structure maps it to *application*.
   - **The effect.** The planted FF-S03 layer skip (api → infrastructure) becomes an allowed api → application import and disappears. FF-S03 is advisory under the DDD tiers: neither spec has a blocking finding on this variant, so the verdicts agree, but the rule-exact planted finding is lost. On the unrenamed project the folder keeps its name, `infrastructure`, and the name wins. The miss occurs only when the name is not recognised.
   - **Was it asked?** Yes. Both files sit under a 0.50 question, "Is src/ordering/platform/ the application layer?"
3. **P3 n02 (a domain port named `*.repository.ts`).**
   - **What happens.** In the renamed NestJS project, `src/kernel/` is only partly covered by preset globs. The file-name pattern `**/*.repository.ts` therefore wins for that one file and puts it in *infrastructure*.
   - **The effect.** None: no blocking finding involves it.
   - **Was it asked?** Its folder is asked about.

**Every wrong file in every set lies in a folder that the proposal asks about** (dev 1/1, P1–P5 4/4, held-out 152/152). The questions are deliberately generous. On renamed projects nearly every folder is mapped by structure alone, so it is asked about: 3.9 questions per variant, and most of them are confirmations of a correct mapping. On the unrenamed dev set there is one question in 71 variants.

### Inferring from the variant against inferring from the clean variant

On the same 71 variants, the ISE robustness run inferred once from the clean variant and applied that spec to every variant. It got 71/71 identical blocking sets and 50/52 planted. Inference from the variant itself, which is what a user without a spec gets, costs one verdict and one planted violation on the dev set, and two planted violations on P1–P5. That is the circularity threat of the ISE prototype (§5), now measured on the user path. A violation that changes the structure (a new folder, an import that moves a folder's level) can be absorbed into the inferred rule. In both cases the absorbed mapping had confidence 0.50 and was put to the user as a question.

## 3. Limitations

- **Circularity is not solved, only surfaced.** `init` and `--from-inferred` take the code's majority structure as the rule. Pre-existing violations that change the structure become the baseline (ddd v07). Consistent-but-wrong code yields a consistent-but-wrong spec. The low-confidence questions are the only guard. The output says so: the YAML header and the `--from-inferred` banner both state that findings are relative to the code's own patterns.
- **The numbers come from the author's five reference projects** and from rename probes of them. For four styles the true spec is a verbatim preset copy, so on the unrenamed set, preset-first inference is close to a lookup. P1–P5 and the held-out probes are the meaningful part. Even they are a new surface, not new architectures. Brownfield projects with independently declared rules (the ISE prototype's next step 2) and the E1 cells remain unmeasured.
- **P1–P5 is the development probe of the ISE robustness fixes**, so it is not an honest estimate on its own. The held-out probes are.
- **Suffix vocabulary still matters for NestJS and DDD.** See the held-out S-nestjs and S-ddd rows, and the ISE robustness write-up.
- **Many questions on renamed projects.** Every structure-only folder is asked about, even when it is right. That is 272 questions on correct folders over the 71 P1–P5 variants. A threshold that asks less was not tuned, because tuning it on these probes would make them non-blind.
- **Project shape.** `init` needs `src/` and `tsconfig.json` at the project root, like the ISE snapshot. Monorepos, multiple source roots and path aliases outside `src/` are not handled. A project with no `src/` gets exit 2.
- **Five styles only.** The style is always one of the five presets (clean architecture, layered, hexagonal, NestJS, DDD). There is no "none of these" outcome: a close call becomes a question, but a project in a sixth style gets the nearest preset.
- **The proposal is the preset's rules.** `init` infers *where* the layers are, not *which rules* apply. Thresholds, fitness functions and `allowed_dependencies` are the canonical preset's. The Option 1 majority-vote observations are reported (`observations`, MCP only) but never become rules.
- **Speed.** A proposal takes a few seconds, because it builds the APG in memory. `--from-inferred` adds that to a normal evaluation. The 2 × 142 + 2 × 213 evaluations of this run took about 29 s per variant on the tarball Neo4j.

## 4. Reproduce

```bash
# Neo4j 5.26 + APOC (tarball): neo4j-community-5.26.0-unix.tar.gz and apoc-5.26.0-core.jar in plugins/,
# dbms.security.procedures.unrestricted=apoc.*, a password set with neo4j-admin dbms set-initial-password.
NEO4J_URI=bolt://127.0.0.1:7687 NEO4J_PASSWORD=... \
  npx tsx scripts/v1.3/init-infer-eval.ts --out results/v1.3-init-infer/2026-10-16                    # dev + P1-P5, live (--resume to continue)
NEO4J_URI=... NEO4J_PASSWORD=... \
  npx tsx scripts/v1.3/init-infer-eval.ts --set heldout --out results/v1.3-init-infer/2026-10-16/heldout
npx tsx scripts/v1.3/init-infer-eval.ts --from-raw --out results/v1.3-init-infer/2026-10-16           # recompute from raw/, no Neo4j
npx tsx scripts/v1.3/init-infer-eval.ts --from-raw --set heldout --out results/v1.3-init-infer/2026-10-16/heldout
npx tsx scripts/v1.3/init-infer-eval.ts --offline --out /tmp/x                                         # style + layers only, ~40 s
npx jest --maxWorkers=2 tests/unit/ise/propose.test.ts tests/unit/cli/init-command.test.ts tests/unit/cli/cli-from-inferred.test.ts \
  tests/unit/mcp-server/server.test.ts tests/unit/scripts/v1.3/init-infer-compare.test.ts
```

`--target a,b` restricts the targets, and two instances on different `NEO4J_URI`s can share one `--out` with disjoint `--target` lists, as this run did. With `--from-raw`, (a) and (b) are recomputed offline and (c) comes from the saved rows.
