# EFF-01: graph tools vs raw files, a design that can fail

**Status:** design v1, 2026-10-18. Sprint lane F (`ops/03-sprint-plan.md`), board decision M5 (`ops/decisions.md`): the efficiency test becomes a thesis result. Map row: C1c, efficiency (`ops/01-instrument-map.md` §4). No model call has been made for this note. The question set and its answers are committed first, in `experiments/eff-01/`. Comment inline with `> AUTHOR:`.

**What REV-01 §8 said, and the fix.** As first written, the test had no fixed questions, no raw-file tool set, no caps and no repo size, so any outcome could be read as a win (`ops/notes/rev-01-instrument-map-fable.md` §8). This design fixes all four before any call. It also adds three things that let the graph side lose on the record:
- questions where the design predicts that the graph tools lose (classes R and Gm, §3);
- a small repo where it predicts no token advantage;
- one-sided falsifiers with thresholds, tested on machine-scored answers whose truth is committed before the run.

---

## 1. The question

Does a model answer architecture questions about a codebase more accurately, and with fewer tokens, through the instrument's MCP tools (`src/mcp-server/`, 11 symbolic tools) than through raw file access (Read, Grep, Glob)?

**What "graph tools" means here.** The MCP server is a *verdict* API, not a general graph query API:
- `evaluate_project` returns counts per rule, with at most 25 rows listed per rule (`MAX_LISTED_PER_RULE`, `src/mcp-server/evaluate-project.ts:27`).
- `which_layer` and `check_import` answer from the spec.
- `check_file` and `check_diff` check proposed code.
- No tool returns fan-in, class declarations or an arbitrary edge query, and `evaluate_project` does not return `universalMetrics`.

So the result speaks to **this surface, as shipped**, not to graph access in general. A Cypher query tool would be a different treatment, and is future work (§10, T1).

## 2. Hypotheses and falsifiers

The unit is the question item. Q01–Q09 on each repo make 18 compiler-defined items; Q10 is instrument-defined and stays out of H1–H3. G is the graph-tool condition, R the raw-file condition (§5). acc = mean rubric score over the runs. tok = median processed tokens (§6).

| Id | Hypothesis | Test (§8) | Falsified if |
|---|---|---|---|
| **H1** accuracy | G answers more accurately than R | d = acc_G − acc_R over the 18 items; one-sided Wilcoxon signed-rank | Holm-adjusted p ≥ 0.05, **or** mean d ≤ 0. If fewer than 6 items are untied, H1 is reported as *not testable at this size*, which counts as not supported |
| **H2** tokens | G uses fewer tokens than R | r = ln(tok_G / tok_R) over the 18 items; one-sided Wilcoxon, r < 0 | Holm-adjusted p ≥ 0.05, **or** the geometric-mean ratio exp(mean r) ≥ 1 |
| **H3** size | G's token advantage grows with repo size | 9 template pairs (Q01–Q09): r_ddd-forum − r_event-sourcing < 0; one-sided Wilcoxon, exact, n = 9 | Holm-adjusted p ≥ 0.05, **or** median difference ≥ 0 |
| **H4** boundary (reverse direction) | on the 7 R and Gm items, R is at least as accurate as G | descriptive, per item | G beats R on ≥ 2 of the 7. That would mean G answered without the facts its tools expose, and it triggers the contamination reading (N arm, §5) |
| **H5** small repo | on event-sourcing-ddd (58 files), G is no cheaper than R | the H2 ratio on that repo's 9 items | the geometric-mean ratio is < 0.80, so G is ≥ 20 % cheaper even at 58 files. This is a *favourable* falsification for the instrument, and is reported as such |

**What each outcome lets the thesis say.**
- H1 and H2 both hold: on these questions, the instrument's tools give more correct answers for fewer tokens.
- H2 holds only through H3: they are cheaper at 248 files, not at 58.
- H1 fails but H2 holds: they are cheaper, not better.
- Neither holds: a reported null. The MCP surface is a verdict API, not an efficient query surface. That goes in the limitations chapter, citing the per-class table.

## 3. Repos: two of stated, different size

The two repos come from the v1.3 external set (`Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md` §1): human-written and pinned before 2023. Both are **DDD**, so the style and the preset rules are held constant, and size is the difference between them.

| Id | Repo, pin | Production `.ts` under `src/` | Internal import statements | Layers mapped | Blocking findings (committed report) |
|---|---|---|---|---|---|
| **event-sourcing-ddd** (small) | yerinadler/typescript-event-sourcing-sample-app `55fa9ef3` | **58** | 146 | 58/58 | 20 (FF-S01), plus 3 FF-S03 |
| **ddd-forum** (large) | stemmlerjs/ddd-forum `3aa0b8d3` | **248** | 919 | 246/248 | 92, plus 10 FF-S03 |

- **Size ratio:** 4.3× in files, 6.3× in import statements.
- **The largest size available.** The set's selection rule caps projects at 300 files, and ddd-forum is the largest (250 by the instrument's count). So the "1,000 files" regime REV-01 names is **not tested**, and the thesis does not extrapolate to it.
- **Pins:** `experiments/eff-01/repos.json`.
- **Engine check (run for this note, zero calls).** The in-process engine (`--engine cypher-interp`) reproduces the committed Neo4j reports row for row on both clones: 23/23 and 102/102 violations.

## 4. The questions and their answers

**Files.**
- `experiments/eff-01/questions.json`: the 20 questions, with wording, class, parameters, answer format and rubric.
- `experiments/eff-01/answers.json`: the key, with the evidence rows for each answer.
- `experiments/eff-01/derive-answers.mjs`: the derivation.

**The derivation.** It is deterministic and makes zero calls:
- `node experiments/eff-01/derive-answers.mjs <clones-dir>` gives byte-identical output on repeat runs (sha1 checked twice).
- It uses the **TypeScript compiler** (5.9.3): `ts.resolveModuleName` with each repo's own `tsconfig.json`, over import, export-from, import-equals, `require()` and `import()` statements.
- Layers come from the **spec's globs**, matched with picomatch (`dot: true`, first layer in spec order), the same semantics as `src/mcp-server/layer-resolver.ts`.
- Class facts come from the TypeScript AST.
- It **does not import** the instrument's extractor, graph or rules.
- Test files (`*.spec.ts`, `*.test.ts`) are left out, as ddd-forum's own tsconfig leaves them out.

**The wording** uses spec terms (layers, `allowed_dependencies`, `ddd.contexts`), never rule ids. Q10 is the exception, because rule ids are its subject. The conventions block in `questions.json` defines "import statement", "layer" and "breaks the allowed dependencies", and goes into the prompt word for word.

| Template | Class | event-sourcing-ddd answer | ddd-forum answer | Truth source |
|---|---|---|---|---|
| Q01 layer of a tricky file | S | `projection/book/ReadModel.ts` → infrastructure | `useCases/.../CreatePostController.ts` → api (inside `useCases/`, excluded from application by `!(*Controller).ts`) | spec globs |
| Q02 imports breaking allowed dependencies (count) | G | 23 | 50 | tsc + spec |
| Q03 files of layer L with such an import (set) | G / **Gt** | api: 2 files | domain: 4 files (one is beyond the 25-row listing) | tsc + spec |
| Q04 most frequent breaking layer pair, and its count | G / **Gt** | application→composition, 9 | application→api, 21 (only 14 of them are visible in the listing) | tsc + spec |
| Q05 files on import cycles; largest strongly connected component | R | 0; 0 | 13; 5 | tsc, Tarjan |
| Q06 max fan-in file, and its distinct importers | R | `constants/types.ts`, 17 | `shared/core/Result.ts`, 75 | tsc |
| Q07 cross-context imports, both directions | **Gm** / G | book→user 1, user→book 0 (context isolation is not asserted by this spec, so the tool reports 0) | forum→users 26, users→forum 0 | tsc + `ddd.contexts` roots |
| Q08 would a hypothetical import be allowed? | S | infrastructure→application: allowed | domain→infrastructure: not allowed | spec |
| Q09 implementer of an interface | R | `BookRepository` in `infrastructure/repositories/BookRepository.ts` | `PostRepo` in `repos/implementations/sequelizePostRepo.ts` (class name ≠ file name: a memorisation trap) | TS AST `implements` |
| Q10 blocking verdict and the violated blocking rules | I | fail; FF-S01 | fail; FF-DS02, FF-DT01, FF-DT02, FF-S01 | instrument report (labelled) |

**The classes.**
- **S:** spec reasoning. The spec text in the prompt answers it, and so do which_layer or check_import.
- **G:** a graph tool returns the answer or its parts.
- **Gt:** as G, but truncated by the 25-row listing.
- **Gm:** the nearest tool output points to a wrong answer.
- **R:** no graph tool exposes the fact.
- **I:** instrument-defined truth.

The design predicts that G wins on G and Gt items at 248 files, ties on S, and loses on R and Gm (H4).

**The cross-check against the instrument** is recorded in `answers.json` under `crossCheckAgainstInstrument`. The two derivations are independent, and they agree on every answer-bearing count:
- the violating rows equal FF-S01 ∪ FF-S03, row for row: 23 and 50. The instrument splits a disallowed import into direction (S01) and layer skip (S03); the question asks for their union;
- files on cycles equal `cyclicDependencyCount`: 0 and 13;
- max fan-in equals `maxFanIn`: 17 and 75;
- ddd-forum's cross-context count equals its FF-DS02 rows: 26.

Two checks differ, both as expected:
- event-sourcing's cross-context count is 1 against FF-DS02's 0. This is the designed Gm item.
- ddd-forum's file population is 248 against 250, because the instrument also parses test files. No answer moves.

**How the instances were chosen.** I picked them after printing the compiler-derived facts, and before any model call. The rule was: non-zero answers where possible, one trap per template, and Q08 balanced (one allowed, one not). No instance was chosen on model performance, and none could have been, since no model has run. The author approves the set before it freezes (§11).

## 5. Conditions

**Fixed across conditions:**
- the same model: pinned `claude-sonnet-5-5`, as in the loop pilot (`experiments/loop-pilot/plan.json`), checked per run with `judgeModelUsage`;
- the same Claude Code build: `claude --version` is recorded (2.1.301 today);
- the same prompt frame, the same caps and the same scoring.

| | **R: raw files** | **G: graph tools** | **N: no tools** (contamination probe) |
|---|---|---|---|
| Built-in tools | `--tools Read,Grep,Glob` | `--tools ""` | `--tools ""` |
| MCP | none (`--strict-mcp-config`, no `--mcp-config`) | the DaedalusArch server alone: `dist/mcp-server/main.js --spec <abs spec> --project <abs clone> --engine cypher-interp --call-log <abs>`, all 11 symbolic tools (`TOOL_NAMES`) allowed by exact name; no `--neural`, no `--rule-mining` | none |
| cwd | the clone root | an empty directory | an empty directory |
| Condition sentence | "You can read the project's files with the Read, Grep and Glob tools; the project root is the working directory." | "You can query the project through the daedalus-arch MCP tools; the server is configured with this project and its spec." | "You have no tools; answer from the spec below and what you already know." |

**Why G gets no file access.** The question is graph tools *instead of* files. A hybrid G+R arm is the realistic use, but it would need its own cells. It is listed as future work.

**The prompt frame** is identical for every condition except the condition sentence. Its SHA-256 is recorded per run.

```text
You are answering one question about the architecture of a TypeScript project. Base your answer on evidence you gather in this session.

<condition sentence>

The project's architecture spec (the `architecture:` block of its spec YAML):
<the repo's architecture block, verbatim from results/v1.3-external/specs/<id>.yaml>

Conventions:
<the four conventions of experiments/eff-01/questions.json, verbatim>

Question: <question text>

End your reply with exactly one line:
ANSWER: <the question's answerFormat as JSON>
```

The spec goes into the prompt for every condition, so knowing the layer map costs both conditions the same, and neither has to spend tool calls to learn it.

**Caps,** the same for every condition:
- **Wall time:** 600 s per session, enforced as a process timeout.
- **Turns:** 30. `--max-turns` is not in `claude --help` for 2.1.301, so the dry run checks whether the flag is accepted. Otherwise the cap is applied after the fact: a session with `num_turns` > 30 counts as a cap hit.
- **Tokens:** 400,000 processed tokens per session, applied after the fact.

A cap hit scores 0 and keeps its real tokens in the token analysis, since the tokens were spent. Cap hits are reported per condition. `--max-budget-usd` is not used.

## 6. Metrics

- **Accuracy:** a machine-scored rubric in [0, 1] (`questions.json`, `rubric`). Exact match is scored per answer part. Sets must match exactly for credit, with Jaccard as a secondary score. Counts must match exactly, with relative error as a secondary score.
  - A missing or unparsable `ANSWER:` line scores 0. That rule is the same for every condition, and the pilot checks the format.
  - The scorer is written and tested on the key before the first main call.
- **Processed tokens (primary):** the sum over `modelUsage[*]` of input, cache-creation, cache-read and output tokens. It is cross-checked against the envelope's `usage` block.
- **Secondary token measures:** uncached tokens (input + cache-creation + output), output tokens, and the fixed overhead per condition (§7, calibration). A sensitivity analysis subtracts that overhead.
- **Turns:** `num_turns`. **Wall time:** the driver's clock and `duration_ms`.
- **Tool calls:** from the stream-json transcript (both conditions), and from the MCP call log (G).
- **Derived:** tokens per correct answer (Σ tokens / Σ score), per condition and repo.

## 7. Runs and the call count

- **3 runs per cell.** The CLI exposes no sampling temperature, so within-question variance has to be estimated.
- **Order:** a seeded shuffle (seed 20261018) of all main cells, with conditions interleaved.
- **Concurrency:** at most 2 lanes, each a balanced half (the sprint rule).

| Block | Cells | Calls (CLI sessions) |
|---|---|---|
| Calibration: fixed overhead per condition (prompt "Reply OK", no question) | R, G | **2** |
| Pilot: format and confinement check (Q02 and Q06 × 2 repos × R, G × 1). Not analysed | 8 | **8** |
| Main: 20 questions × {R, G} × 3 runs | 40 | **120** |
| N, the contamination probe: 20 questions × 1 run | 20 | **20** |
| **Total** | | **150 sessions**, at most 150 × 30 = 4,500 model turns |

**Smaller variants**, if the author wants fewer calls:
- 2 runs and no N arm: **90**.
- 1 run, no variance estimate: **50**.

The conditions register's "about 40" (`ops/02-defensibility-conditions.md` row 1.6) was a guess made before the design.

## 8. Analysis (paired, per question)

1. For each item q and condition c: acc_qc is the mean rubric score over the runs, and tok_qc is the median processed tokens.
2. **H1:** d_q = acc_qG − acc_qR over the 18 compiler-defined items.
   - Test: an exact one-sided Wilcoxon signed-rank test. Zero differences are dropped; the Pratt variant is a sensitivity analysis.
   - Effect: mean d, with a 95 % percentile bootstrap CI (10,000 resamples of items, seed 20261018).
3. **H2:** r_q = ln(tok_qG / tok_qR). One-sided Wilcoxon. Effect: exp(mean r), with a bootstrap CI.
4. **H3:** for the 9 templates, Δ_t = r_{t,ddd-forum} − r_{t,event-sourcing}. An exact one-sided Wilcoxon (n = 9; the smallest possible p is 1/512).
5. **Holm** correction across H1–H3 at α = 0.05. H4 and H5 are descriptive, against their stated thresholds.
6. **Both directions reported.**
   - A per-item table and forest plot of d_q and r_q, with sign either way.
   - Per-class means (S, G, Gt, Gm, R).
   - Q10 separately, as instrument-defined.
   - The N arm next to G on every item. When G's score on an R item is matched by N, it reflects memorisation, not tool use.
7. **The report** goes to a DiagnosticRuns report (`Docs/DiagnosticRuns/v1.3-eff-01-<date>.md`), then to the compendium. Every number traces to the run records.

## 9. Pre-mortem: how this run fails, and what is decided now

1. **Ceiling.** Both conditions score 1.0 on most items, so H1 has too few untied items. *Decided:* fewer than 6 untied items means H1 is not testable (§2). The traps in Q01, Q03, Q04 and Q09 are there to prevent the ceiling, and the pilot will show early if they fail.
2. **G's token cost blows up.** The evaluate_project payload is about 8,400 tokens on ddd-forum and about 2,300 on event-sourcing (estimated from the committed reports). The 11 tool schemas also cost tokens on every turn. G can lose H2 on cost alone. *Decided:* that is a legitimate result, reported as such, with the calibration overhead shown.
3. **Truncation hides truth from G.** DF-Q03 and DF-Q04 are labelled Gt in advance. The listing shows 3 of the 4 domain files and 14 of the 21 application→api rows.
4. **Memorisation.** ddd-forum is a well-known reference repo. *Decided:* the N arm, and H4's falsifier.
5. **Confinement leak.** G could get file access, or R could get the MCP server. *Decided:* the pilot transcripts are read. A G session with any built-in tool use, or an R session with any `mcp__` call, is invalid and is re-run once. A second leak stops the run.
6. **Format failures.** They score 0 in both conditions. If the pilot shows more than 1 of its 8 sessions failing on format, the frame's answer instruction is fixed before the main run, and that change is the only one allowed.
7. **The truth is wrong.** Two independent derivations agree (§4). An answer later disputed with code evidence is corrected in `answers.json` with a dated note, and the item is reported both ways.
8. **Rate limits or interruptions.** They are retried under the existing policy (`runWithRetries`, `scripts/lib/generators/retry.ts`). Interrupted sessions are archived, not scored.
9. **Model or CLI drift during the run.** The model id is pinned, and `judgeModelUsage` marks any mismatch, which is re-run. The CLI version is recorded at the start and the end.

## 10. Threats to validity

- **T1, construct.** "Graph tools" here means this verdict-oriented MCP surface. The study does not test graph access in general, nor a query endpoint. The questions are import-graph and spec questions, which is the GREEN part of C1a. The DDD class-fact rules (AMBER, N38) enter only through Q10.
- **T2, question authorship.** The questions were written by a Claude session, and the subject model is Claude. Deterministic truth removes grader bias, but not selection bias. The mitigations are the fixed classes, with items where the design predicts that G loses, and the author's approval before the freeze.
- **T3, external.** Two repos, one style (DDD), TypeScript, 58 and 248 files. The ≥ 1,000-file regime is untested, and the thesis does not extrapolate.
- **T4, internal.** The fixed overhead differs between conditions (tool schemas), so the calibration and the sensitivity analysis are reported. The MCP server is cold on each session's first call (evaluate_project took 4.9 s cold on ddd-forum in the smoke test), which affects wall time in G only and is reported.
- **T5, statistical.** 18 paired items × 3 runs is small. Accuracy ties reduce the effective n, so effects are reported with CIs, not only p.
- **T6, memorisation.** ddd-forum is well known. This is measured by the N arm, not assumed away.

## 11. Harness: what exists, what is missing, the exact calls

**Exists, and is reused:**
- The argv conventions and the confinement checks: `scripts/lib/generators/argv.ts`, and in `scripts/lib/generators/arms.ts` the functions `mcpToolRules`, `withMcpServer` and `checkArmArgs`.
- The stream-json transcript route and a stub runner for zero-call dry runs: `scripts/v1.3/lib/mcp-smoke.ts`.
- Envelope parsing, which tolerates stream-json because it takes the last line: `parseEnvelope` and `writeEnvelope` in `scripts/lib/generators/envelope.ts`.
- `turnUsage` and `turnStatus` (`scripts/lib/loop/agents.ts`), `judgeModelUsage` (`scripts/lib/generators/model-usage.ts`), `runWithRetries` and `NodeProcessRunner`.
- The MCP call log (`--call-log`).

**Missing (about one agent-day, zero calls to build):**
- `scripts/v1.3/eff-01-run.ts`: the driver, with `--dry-run` through the stub runner.
- `scripts/v1.3/eff-01-score.ts`: the scorer, tested on `answers.json` (the key scores 1.0, and perturbed answers score below 1).

`buildArmCall` cannot be used as it stands. It hard-codes `--engine neo4j`, the 9-tool Study 2 allow-list, Write/Edit and `acceptEdits`. The driver builds its own argv from the same parts, and `checkArmArgs` validates it.

**Readiness, checked today with zero calls:**
- The key derives deterministically.
- The in-process engine matches the committed reports on both clones.
- The stdio smoke (`dist/mcp-server/stdio-smoke.js`) lists 11 tools on both clones, and evaluate_project answers on both: 23 violations in 0.9 s and 102 in 4.9 s, cache-hit in 6–18 ms.
- The smoke's check_file and check_diff steps fail on ddd-forum. The cause is the probe, not the server: it looks for top-level `src/domain/` and `src/infrastructure/`, which ddd-forum lacks.
- The clones sit outside the repo; the driver re-clones them at the pins in `repos.json`.

**The calls the driver makes.** In each, `<P>` is the frame (§5), and the session runs from the condition's cwd, under the clean judge config directory, so no user-level CLAUDE.md, hooks or MCP servers load.

```sh
# R
claude -p "<P>" --model claude-sonnet-5-5 --output-format stream-json --verbose \
  --safe-mode --restricted --tools Read,Grep,Glob \
  --permission-prompts none --no-session-persistence --strict-mcp-config
# G  (mcp-<id>.json names only daedalus-arch: node dist/mcp-server/main.js --spec … --project … --engine cypher-interp --call-log …)
claude -p "<P>" --model claude-sonnet-5-5 --output-format stream-json --verbose \
  --safe-mode --restricted --tools "" \
  --strict-mcp-config --mcp-config <H>/eff-01/mcp-<id>.json \
  --allowedTools mcp__daedalus-arch__get_architecture_spec mcp__daedalus-arch__which_layer \
    mcp__daedalus-arch__check_import mcp__daedalus-arch__evaluate_project mcp__daedalus-arch__explain_violation \
    mcp__daedalus-arch__check_file mcp__daedalus-arch__check_diff mcp__daedalus-arch__suggest_placement \
    mcp__daedalus-arch__infer_spec mcp__daedalus-arch__explain_finding mcp__daedalus-arch__propose_spec \
  --permission-prompts none --no-session-persistence
# N
claude -p "<P>" --model claude-sonnet-5-5 --output-format stream-json --verbose \
  --safe-mode --restricted --tools "" --permission-prompts none --no-session-persistence --strict-mcp-config
```

**The dry run (zero calls) checks these before the pilot:**
- that `--safe-mode` still loads an explicit `--mcp-config` (the loop pilot's gate arm relied on it);
- that `--tools ""` leaves no built-in tool;
- whether `--max-turns` is accepted;
- the argv invariants (`checkArmArgs`);
- the scorer on the key.

## 12. What the author approves before the first call

1. The question set and its classes (`experiments/eff-01/questions.json`). Once approved, it is frozen.
2. The call count: 150, or a smaller variant (§7).
3. The hypotheses' thresholds (§2), and that a null result goes in the thesis as a result.

## Changelog
- 2026-10-18 v1: first design. Two DDD repos (58 and 248 files), 20 questions with a compiler-derived key, conditions R, G and N, call count 150.
