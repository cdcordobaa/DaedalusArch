# U10 code-generation plan: loop and validity (BUILD-L)

**Task:** BUILD-L, the zero-call builds that the instrument and the exploratory study need (scheduled routine, 2026-10-19).
**Read first:** `ops/notes/trust-01-path-to-a-trusted-instrument.md` (L1, L9), `ops/notes/rev-05-first-study-fable.md` (§3 estimands, §5 validity items, §6 item 6), `Docs/v1.4/study2-deviation-2026-10-19-drift.md` (§4), `ops/notes/s2d-01-study2-drift-design.md` (§3), `ops/notes/rev-04-gaps-and-promises-2026-10-19.md` (P16–P19, P29).
**Brownfield:** edits the loop harness (`scripts/lib/loop/`), the generator retry (`scripts/lib/generators/retry.ts`, `types.ts`) and the power simulation (`scripts/v1.3/lib/level-power-sim.ts`); adds new scripts, tests, fixtures and results.
**Workflow note:** this unit ran as an unattended scheduled routine. The task text fixed the scope and the steps, so the AI-DLC approval gates (requirements, design, the plan approval and the two-option completion message) had no live reader. The plan was written from the task text and executed in the same run; the PR is the review point, and nothing is merged. Functional design, NFR and infrastructure stages are skipped: no new business logic beyond what the task names, no infrastructure.
This plan is the single source of truth for the unit's code generation. Each step was marked `[x]` in the interaction that completed it.

## Hard constraints for every step

- Zero model calls: no model API, CLI or generator run; stub and dry-run modes only. No Neo4j (`cypher-interp` where an engine is needed).
- Never read a `*sealed*` path except `Docs/v1.3/sealed-hashes.md`; never open `results/v1.3-meaning/mean-01-sample.*`.
- Do not touch `src/apg-enrich/ontology` or `src/llm-critic` (another job edits them).
- A plan without the new fields runs exactly as before (rule 3): the loop dry run on `experiments/loop-demo/plan.dry-run.json` equals `main` except timestamps and commit shas.
- `jest --maxWorkers=2`; `tsc --noEmit` clean; ESLint clean on changed files, except the two classes that existing files show in this environment (`expect` as an unresolved type, `no-unsafe-call`; entry files outside the ESLint project).

## Steps

### Step 1: `layered` loop style and frames (REV-04 P16)
- [x] `scripts/lib/loop/style.ts`: `LoopStyle` and `LOOP_STYLES` gain `layered`, `STYLE_PRESETS.layered = presets/layered.yaml`; `styleSentence`/`styleName` cases equal the floor probe's layered frame (`results/v1.3-floor-probe/tasks.json` `frames.layered`).
- [x] Everything that switches on style: `plan.ts` (profile validation reads `LOOP_STYLES`), `main.ts` `stubLayoutFor` (layered stub layout), `scripts/v1.3/lib/study2-tunables.ts` (iterates `LOOP_STYLES`, so layered sentences are hashed). `specs.ts` stays DDD-only.
- [x] L3 frames, one plain sentence per blocking rule: `RULE_PLAIN_BY_STYLE.layered` in `prompts.ts` (Layered layer names, no fix clause), selected by the spec's `architecture.style` in `rungs.ts` `ruleSentences`; every other style reads `RULE_PLAIN` unchanged. Hashed as `frame/rule-plain-by-style`.
- [x] DDD L3 frames: a candidate static rehearsal spec `fixtures/v1.3-rehearsal-tasks/specs/vineyard-harvest.ddd.yaml` (`presets/ddd.yaml` constrained to `src/picking/`, `src/cellar/` by `constrainDddSpec`; author to approve; not D15).
- [x] `scripts/v1.4/rehearsal-frames.ts` (+ `lib/`): writes `hint-audit/frame-<task>.txt` (L2) and `frame-<task>.L3.txt` for the four rehearsal tasks from the harness code, and `hashes.json` (README item 3: `tasks.json`, per-task compact `JSON.stringify`, every frame, the DDD spec); `--check`.
- [x] Ice-rink frame: now the harness's own frame (bytes unchanged); L2 and L3 frames of all four tasks pass the hint audit at their rung (0 FAIL); README lines 27 and 46 updated (the "FAIL" column is the expected no-hint audit).
- [x] Tests: `tests/unit/scripts/loop/layered-and-task-mcp.test.ts` (style, frames, L3 wording, DDD spec parse, committed files equal the generator, audit 0 FAIL); `frame-rungs.test.ts` gains layered; `pilot.test.ts` expectations updated.

### Step 2: per-task MCP spec (D11c, `plan.ts:235`)
- [x] `plan.ts`: the refusal of `taskProfiles` with `daedalus-mcp` is replaced by "every profile static"; `mcpSpecFor(plan, taskId, repoRoot)`; `mcpSpecCheck` skips the default pair when every task has a profile; per-profile `specSha256` in `checkSpecEquality` (plan pin covers the rest; `requireSpecSha256` met by profile pins only without a default spec).
- [x] `agents.ts`: `StepAgentDeps.daedalusSpecByTask`, `daedalusFor`; Claude, Codex and Gemini turns use the task's spec. `main.ts` builds the map for profiled tasks.
- [x] Tests: validation, `mcpSpecFor`, R23, pins, plan load with L3 layered frames, Claude and Codex argv/config per task.

### Step 3: drift mode in `level-power-sim.ts` (s2d-01 §3; drift record §4)
- [x] `outcome: 'level' | 'drift'`, `newPerStep`, `CELLS_DRIFT`, `HYPOTHESES_DRIFT`, Holm over 2, blocks = tasks × replicates × generators, step turns = blocks × (1 + 3(k − 1)), `--outcome`.
- [x] Size check at RR 1 (both correlation models).
- [x] Reproduce the s2d-01 §3 table within MC SE: `results/v1.3-drift-power-sim/`; 22 of 24 cells within √2·SE; two H2 cells at 32 blocks, independent, are out (+0.027 at RR 0.5, +0.023 at RR 0.75); RR 0.25 reproduces. Reported in `Docs/v1.4/drift-power-sim.md`.
- [x] θ-band and lower-bound-of-mean input mode (`--pilot`, `--lower-bound`, `--theta-band`), Student t quantile in code, power rule verdict; synthetic fixture only.
- [x] Level path byte-identical for the same arguments.

### Step 4: L1 per-snapshot coverage check (V8 restated)
- [ ] Script + lib: per snapshot, unmapped share, unparsed files, files the extractor does not read, barrel / `require` / `import()` counts, pass/fail against the TRUST-01 L1 bar; per-store aggregates.
- [ ] Tests on fixture trees.
- [ ] Run on the committed floor-probe and loop-pilot snapshots; commit outputs.

### Step 5: seeded recall on agent snapshots (REV-05 §5 item 1)
- [ ] Script + lib: the existing mutation operators on step-k snapshots, detection per operator and per style, `cypher-interp`.
- [ ] Tests on a fixture.
- [ ] Run on the committed loop-pilot and floor-probe snapshots; outputs under `results/v1.4-seeded-recall-agent/`; a DiagnosticRuns note.

### Step 6: isolation ON in an exploratory plan template, S1, S12, D6 (P26, P29)
- [x] `experiments/exploratory-study/plan-L2.template.json`, `plan-L3.template.json`: `cliVersion` pinned (placeholder `2.1.294`, author to confirm), `generatorIsolation.claudeConfigDir: "<local>"`, tasks `ice-rink` and `vineyard-harvest` (the candidate DDD rehearsal spec), `callBudget` = `planCallBudget`; test loads both.
- [x] S1: each usage-limit interruption records `pause: { startedAt, endedAt, plannedMs, ms }` (`retry.ts`); a turn with no pause records what it did before.
- [x] S12: `scripts/v1.4/loop-archive.ts` (+ `scripts/lib/loop/archive.ts`): hashed manifest, deterministic tarball, `--verify`, `--check-paths`.
- [x] D6: `scripts/v1.4/loop-telemetry-check.ts` (+ `scripts/lib/loop/telemetry-check.ts`): per-turn telemetry, prompt hashes, repair records, MCP call logs (allowed tools, `evaluate_project` never, time window, count).
- [x] `Docs/v1.4/loop-isolation-exploratory.md`: what is built and what needs live runs.

### Step 7: close
- [ ] Code summary `aidlc-docs/construction/v1.4/U10/code/summary.md`.
- [ ] One `aidlc-docs/audit.md` entry (append only).
- [ ] Full checks (jest on the touched suites with `--maxWorkers=2`, `tsc --noEmit` on `tsconfig.json` and `tsconfig.scripts.json`, ESLint on changed files), push, PR to `main` titled "BUILD-L: loop and validity (U10)". Not merged.
