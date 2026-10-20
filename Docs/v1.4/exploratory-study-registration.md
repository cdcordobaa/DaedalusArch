# Exploratory study registration: the drift study before confirmatory Study 2 (2026-10-19)

<!-- exploratory-protocol: study=exploratory-before-confirmatory-study2; claims=none; tests=descriptive-only; cells=none@L2,none@L3,mcp@L2; optional-cells=sem-mcp@L2,mcp-eval@L2; start=shared-step-1; k=5; tasks=ice-rink,youth-league,hive-health; generators=claude-sonnet-5-5; stages=A-layered-none@L2-rep1-prefreeze,stop-check,B-rest,C-scoring; stop=meanD<0.5-and-Y1=0-in-most-blocks-provisional-until-rescored-at-freeze; semantic=C1d+C4-scoring-12-snapshots; confirmatory-tasks=4-layered-sealed-before-stage-A; ddd=deferred-until-DDD-BETA-passes -->

**Status: registration of an exploratory study, dated 2026-10-19. It makes no confirmatory claim.**
- **The decisions are the author's.** EXP, EXPT, SEM and AUTO were settled by the author on 2026-10-19 (`ops/decisions.md:27-31`). An AI session wrote this down. It took none of them.
- **Why it exists.** REV-05 found that the study on file is a confirmatory protocol whose "exploratory" label is only its fallback (`ops/notes/rev-05-first-study-fable.md:9-11`). Its first ranked change is to register the first study as a separate exploratory study (`rev-05:161`). This is that registration.
- **What it does not change.** The drift record, [`Docs/v1.4/study2-deviation-2026-10-19-drift.md`](study2-deviation-2026-10-19-drift.md), **stays the confirmatory Study 2 protocol.** Its `study2-protocol` block is unchanged. It carries one dated note that points here. Nothing in this registration is a Study 2 deviation.
- **What was read to write it.** No sealed directory, no answer key, no `.env`, and not the MEAN-01 sample. It names no sealed task. Zero model calls.
- **Comments** go in `> AUTHOR:` lines. Every threshold marked **proposed** is the author's to change before Stage A.

## 1. Purpose, in one paragraph

The exploratory study buys the information a confirmatory Study 2 needs. It does not test a hypothesis. It runs the drift record's three cells on tasks that are **not** the confirmatory tasks, with Claude Sonnet and Gemini, and measures base rates, variances, mechanisms, costs and instrument validity on agent code. The confirmatory design is then fixed from these numbers. The thesis does not depend on it. The proposal's minimum viable thesis is SO1 to SO4 (`ops/notes/rev-04-gaps-and-promises-2026-10-19.md:7-10`).

## 2. The protocol line

```exploratory-protocol
study=exploratory-before-confirmatory-study2
claims=none
tests=descriptive-only
cells=none@L2,none@L3,mcp@L2
optional-cells=sem-mcp@L2,mcp-eval@L2
start=shared-step-1
k=5
tasks=ice-rink,youth-league,hive-health
generators=claude-sonnet-5-5
stages=A-layered-none@L2-rep1-prefreeze,stop-check,B-rest,C-scoring
stop=meanD<0.5-and-Y1=0-in-most-blocks-provisional-until-rescored-at-freeze
semantic=C1d+C4-scoring-12-snapshots
confirmatory-tasks=4-layered-sealed-before-stage-A
ddd=deferred-until-DDD-BETA-passes
```

`npm run lint:protocol` checks that this block exists, that the line at the top matches it, that `claims=none`, and that this file cites the drift record (`scripts/v1.3/protocol-consistency-check.mjs`).

## 3. What carries over from the drift record, and what does not

| Item | Exploratory study | Drift record (confirmatory) |
|---|---|---|
| Outcome D | **Same definition**: new distinct blocking identities at steps 2–5, from a shared step-1 tree, counted only when `check-correct.ts` says `correct` (`study2-deviation-2026-10-19-drift.md:41`) | Primary |
| Cells | **Same three**: `none@L2`, `none@L3`, `mcp@L2` (`:45`). Two optional cells (§5) | Three cells |
| Start, k | Shared step 1 in `none@L2`; k = 5 (`:44`, `:48`) | Same |
| Generators | `claude-sonnet-5-5` and the Gemini pin (`:51`) | Same |
| Contrasts | **None tested.** Ratios and differences with intervals only | H1, H2, Holm over 2 (`:46`) |
| Equivalence margin | **Not set here.** This study supplies data for it | Fixed in the pre-registration (`:47`) |
| Tasks | Rehearsal, probe-1 and exploratory-only tasks (§4) | New confirmatory tasks, sealed at the freeze (`:49`) |
| Pilot bar, fallback | **Not used.** Replaced by the staged stop rule (§7) | `:54-55` |
| Pre-registration | This dated registration. Optional OSF copy | OSF with embargo (`:56`) |

## 4. Tasks (EXPT)

**Rule.** The exploratory study never runs on a confirmatory task (`ops/decisions.md:28`; `rev-05:60-63`).

| Style | Task | Source | Steps | Role |
|---|---|---|---:|---|
| Layered | `ice-rink` | rehearsal (`fixtures/v1.3-rehearsal-tasks/tasks.json`) | 5 | core |
| Layered | `youth-league` | probe 1 (`results/v1.3-floor-probe/tasks.json`) | 5 | core |
| Layered | `hive-health` | probe 1 | 5 | core |
| Layered | `market-vendors` | probe 1 / loop pilot | 4 | spare, k = 4 only |
| DDD | `vineyard-harvest` | rehearsal | 5 | core |
| DDD | `exp-ddd-1`, `exp-ddd-2` | **new, exploratory-only** | 5 each | core |
| DDD | `relief-volunteers` | loop pilot (`experiments/loop-pilot/pilot-tasks.json`) | 4 | spare, k = 4 only |

- **Three tasks per style**, so the between-task variance is estimated (REV-05 estimand 1, `rev-05:41-42`).
- **Two new DDD tasks are needed**, because only one five-step DDD task exists. They are written to `Docs/v1.3/study2-task-design.md` T1–T10 and hint-audited. They are labelled exploratory-only, and they join the exclusion list for confirmatory tasks.
- **Disclosures.** The rehearsal README bars its tasks from Study 2 (`fixtures/v1.3-rehearsal-tasks/README.md:6`). That is respected: this is not Study 2. Probe 1 already ran `youth-league` and `hive-health` by hand with Opus (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md:41-42`), so those trajectories have been seen. DDD runs under whatever spec mode D15 has at the run tag (`ops/decisions.md:25`). If D15 is still open, DDD uses the declared-aggregates evaluator spec, and every DDD number carries that label.

**The confirmatory tasks are protected (EXPT).**
1. A separate session writes the 4 Layered + 2 DDD confirmatory tasks. It never reads exploratory output (V10c; `study2-deviation-2026-10-19-drift.md:49`).
2. The tasks, their acceptance checks and their hint audits are **hashed and sealed before Stage A starts** (**proposed**: stricter than "before results are read", and easier to verify). The hash and date go in this file's changelog.
3. Any change to `Docs/v1.3/study2-task-design.md` after Stage A is dated and declared, because a guide tuned on exploratory results is a lever (`rev-05:73`).

> AUTHOR: confirmed — "sealed before Stage A" (decision D7, 2026-10-19).

## 5. Cells

| Cell | What the agent has | Status |
|---|---|---|
| `none@L2` | minimal spec | core |
| `none@L3` | minimal spec + one plain sentence per blocking rule | core |
| `mcp@L2` | minimal spec + the 9 spec-only MCP tools, `evaluate_project` denied | core |
| `sem-mcp@L2` | `mcp@L2` + one read-only semantic-facts tool (C1d facts on the agent's current tree) | **optional** (SEM) |
| `mcp-eval@L2` | `mcp@L2` with `evaluate_project` allowed (the dropped `gate` mechanism) | **optional** probe (`rev-05:67`) |

**The in-loop semantic cell (SEM, `ops/decisions.md:29`)** is added only if all of these hold before Stage B starts:
1. the MCP tool exists, is merged and has tests;
2. it passes the S4 confinement probe for both CLIs (`Docs/v1.4/gemini-s4-probe-spec.md`; gate S4 per CLI × arm);
3. its model is the generator's own vendor, so a Gemini agent never reads Claude facts (vendor mixing, `ops/notes/c4-01-interpretation-design.md` §8, branch `v14/c4-mean02-design`);
4. its calls are capped per step (§10).

It runs on replicate 1 only. REV-05 advised scoring-only for semantic paths (`rev-05:49-53`), because neural tools in the arm confound "delivery plus checking". The author chose to add the cell if it is ready (SEM). So it is a separate cell, never pooled with `mcp@L2`, and its numbers are labelled "in-loop semantic, exploratory".

**The evaluate probe** runs in 4 blocks: `ice-rink` and `hive-health`, one replicate, both generators. It asks one thing: is checking without repair even the right arm?

No L4 cells (`rev-05:68`).

## 6. Design and stages

A **block** is task × replicate × generator. Core grid: 6 tasks × 2 replicates × 2 generators = **24 blocks**.

| Stage | What runs | Then |
|---|---|---|
| **A** | Replicate 1 of `none@L2`, steps 1–5, every task, both generators: 12 trajectories | The stop check (§7) |
| **B** | Replicate 2 of `none@L2`, steps 1–5; then `none@L3` and `mcp@L2` branch from every step-1 tree at step 2 (24 blocks); then the optional cells | — |
| **C** | Scoring: D and secondaries on every snapshot; per-snapshot coverage; seeded recall on agent code; the semantic paths on the fixed sample (§9) | Report |

Every `none@L2` trajectory of Stage A is also the step-1 tree and the `none@L2` cell of its block, so Stage A is not thrown away.

**Order (proposed):** freeze (with the V4 ADR) → hold-out once → **this study** → read its report → the confirmatory design (any change to the drift record is a dated deviation) → the drift record's pilot and rehearsal → pre-registration → gate → confirmatory run. If the freeze slips, the study may run earlier. Then every number carries the commit tag it ran at (`rev-05:59`).

> AUTHOR: confirmed — the order as written (decision D7, 2026-10-19).

## 7. The staged stop rule (fixed here, before any call)

After Stage A, per style:
- **Stop the style** if, **for both generators**, mean D < 0.5 over that generator's 3 trajectories **and** Y₁ = 0 in at least 2 of its 3 blocks (`rev-05:57`).
- A stopped style gets no Stage B. Its floor is reported as the finding, as floor-escape §5 items 1–4 describe (`Docs/v1.3/floor-escape-design-2026-10-16.md`), and its start is redesigned before any confirmatory study.
- **If both styles stop, the study stops.** Stage C still scores what exists.
- If only one generator floors, the style continues. That contrast is itself an estimand (§8 item 2).
- Only complete blocks count, never a partial cell (as `ops/notes/s2d-01-study2-drift-design.md:145`).

The rule is not revisited after Stage A numbers are seen. A stop is final for this study.

## 8. Estimands (no hypotheses)

All are descriptive. Intervals are 95 % block-bootstrap intervals, 10,000 resamples, seed `20261019`, clustered by task. There are no p-values and no Holm. No H1 or H2 claim is made from these data.

| # | Estimand | Statistic | Source of the ask |
|---|---|---|---|
| 1 | **Base rate of D and Y₁** per generator × style | mean, variance, NB θ; between-task variance by the method of moments over ≥ 3 tasks | REV-05 §3 item 1 (`rev-05:41-42`); REV-03 finding 1 |
| 2 | **Share of blocks with Y₁ = 0**, per generator | proportion with Wilson interval | `rev-05:43` |
| 3 | **Repair vs prevention.** Inherited step-1 identities removed per cell and step; **D conditioned on no inherited removal** (D \| R = 0) next to D | counts; D and D \| R = 0 per cell | `rev-05:44` |
| 4 | **D by edge kind**: FF-S03 wiring, FF-S01 type-only, real layering, cycles | share of D per kind, per cell | `rev-05:45`; `ops/notes/g12-d2b-construct-limit.md:25,31` |
| 5 | **Which cell matters**: none@L3 / none@L2 and mcp@L2 / none@L2 | ratio of ΣD with interval, per generator and pooled | `rev-05:46` |
| 6 | **Mechanism and evasion margins**: tool-use rate per step and per tool; acceptance pass rate per cell; literal-view vs default-view gap; LOC and file trajectories; moved-only read on a draw of diffs | rates and gaps per cell | `rev-05:47`; drift record §6 |
| 7 | **Cost**: turns, repair turns, pauses, wall time per lane, type-check failure rate per generator | totals and rates | `rev-05:48` |
| 8 | **Semantic frequency and interpretation**: how often K3/K2m facts arise on agent code; whether C4 would change a severity class or claim an exception | counts on the fixed sample (§9) | `rev-05:49-53`; NS-01 falsifier 2 |
| 9 | **SO5 taxonomy material**: every counted identity with its rule family, file roles, edge kind, step and the agent's own words around it (transcript excerpt) | a coded table for the author's open coding, after the study (0 calls) | `rev-05:186`; `rev-04:197` |
| 10 | **Instrument validity on agent code** (§9): seeded recall, per-snapshot coverage, correctness of every counted finding, engine parity | per generator, style and cell | `rev-05:147-153` |

**Acceptance checks.** Estimand 6 needs per-step acceptance checks. They are written for the six tasks before Stage B (0 calls). If they are missing, the acceptance pass rate is reported as "not measured", not inferred.

## 9. Scoring paths and instrument validity

**Symbolic scoring.** Every snapshot is scored at the run tag, with the identity module (L6) that D uses.

**Per-snapshot coverage (REV-05 §5 item 2).** On every snapshot: unmapped-file share, unparsed files, barrel, `require` and `import()` counts, per generator (`scripts/v1.3/snapshot-measures.ts`, plus the L1 coverage check still to build, `ops/notes/trust-01-path-to-a-trusted-instrument.md:35`). **Proposed** flag: unmapped > 10 % marks the snapshot, as the drift record's validity line does (`study2-deviation-2026-10-19-drift.md:54`).

**Seeded recall on agent code (REV-05 §5 item 1).** Zero model calls.
- **Sample:** the 24 snapshots of the semantic sample below (copies; the originals stay untouched).
- **Seeds:** for each snapshot, one seed per mutation operator that applies to the style's blocking rules (`scripts/lib/mutation/operators/`), at most 6 per snapshot, drawn with seed `20261019`. Each seeded copy must type-check, or the next site is tried.
- **Measure:** a seed is detected when its planted identity appears among the blocking findings of the copy. Recall per generator × style, and **per cell**, with Wilson and snapshot-clustered intervals.
- **Use:** it is the only recall figure on agent code and on Gemini's code shapes. Its per-cell split is the input to the per-arm non-differential miss check of the V4 ADR ([`adr-v4-holdout-bar.md`](adr-v4-holdout-bar.md) §4).
- **Build:** the seeded-recall-on-snapshots script is still to build (`rev-05:166`).

**Correctness and parity.** Every counted finding is `correct` by `check-correct.ts`. Engine parity on study snapshots (D8) is checked on a sample when Neo4j is available.

**Semantic paths (SEM, C1d then C4), scoring only.**
- **Sample: 24 snapshots, fixed now.** Strata: style (2) × generator (2) × core cell (3). Two step-5 snapshots per stratum, from two different tasks, drawn with seed `20261019` after Stage B. If a style stopped after Stage A, its strata draw from its Stage A `none@L2` snapshots (one step-3 and one step-5 per stratum).
- **C1d:** the ontology runner on each snapshot, `--runs 2`, `--budget 30` per snapshot (as NS-02 §5, `ops/notes/ns-02-facts-contract-and-cases.md:270-275`), on both vendors.
- **C4:** schema `c4-v0.2` on the blocking identities of each sampled snapshot, two runs, both vendors (`ops/notes/c4-01-interpretation-design.md` §4, §8). At most 8 identities per snapshot; above that, a seeded draw.
- **Prerequisites:** the C1d pilot and C4 pilot have run and been read; the Gemini ontology route and the A2 loader have had their live smoke runs (`c4-01` §11). If a prerequisite is missing, that path is reported as "not run", and the study is not held for it.
- **Counts:** printed by `--estimate` before any call; the caps are in §10.

## 10. Turns and calls, with caps

A turn is one generator CLI session for one step. The turn cap is 1.5 × turns, covering repair turns, as in the drift record (`ops/notes/s2d-01-study2-drift-design.md:133`). MCP tool calls are logged but are not model calls, except inside `sem-mcp@L2`.

| Run | Per generator | Both generators | Cap, both (1.5×) |
|---|---:|---:|---:|
| Stage A: 6 tasks × 1 replicate × 5 steps | 30 | 60 | 90 |
| Stage B: replicate 2 of `none@L2` (6 × 5) | 30 | 60 | 90 |
| Stage B: `none@L3` + `mcp@L2`, 12 blocks × 2 cells × 4 steps | 96 | 192 | 288 |
| **Core total** | **156** | **312** | **468** |
| Optional `sem-mcp@L2`: 6 blocks (replicate 1) × 4 steps | 24 | 48 | 72 |
| Optional `mcp-eval@L2`: 2 blocks × 4 steps | 8 | 16 | 24 |
| **Maximum** | **188** | **376** | **564** |

Wall time per lane: 188 turns × 1.5–3.5 min = about 5–11 h before usage-window pauses (the same rate as `s2d-01:145`). For scale, the drift record's fallback main run is 416 turns (`s2d-01:140`).

**Model calls outside the generator turns (all proposed caps, per vendor):**

| Path | Expected | Cap per vendor | Both vendors |
|---|---|---:|---:|
| C1d scoring, 24 snapshots × `--budget 30` | from `--estimate` | **720** | 1,440 |
| C4 scoring, ≤ 8 identities × 24 snapshots × 2 runs | identities × 2 | **384** | 768 |
| `sem-mcp@L2` in-loop facts, 6 blocks × 4 steps × ≤ 30 per step | from the tool's log | **720** | 1,440 |
| Seeded recall, coverage, parity | 0 | 0 | 0 |

`--estimate` prints the expected figure before each record run, and the cap is lowered to it plus a 10 % margin. A cap is never raised mid-run without the author's OK. Cache hits are free.

**Approval.** This is a study run. AUTO did not approve any study run (`ops/decisions.md:31`). **Nothing in this registration runs without the author's explicit OK of these counts.**

> AUTHOR: OK — the counts as written (decision D7, 2026-10-19).

## 11. What it hands to the confirmatory design

| Exploratory result | Confirmatory decision it informs |
|---|---|
| Base rate, θ and between-task variance per generator × style (items 1–2) | The power re-run in `level-power-sim.ts --outcome drift`, in place of three Opus trajectories (`study2-deviation-2026-10-19-drift.md:63`, `:69-70`) |
| Y₁ = 0 share (item 2) | Whether the shared start must be seeded or redesigned to escape the floor |
| D vs D \| R = 0 (item 3) | Whether the primary is D conditioned on no inherited removal |
| Wiring share of D (item 4) | Whether the primary must exclude wiring edges (G12) |
| Cell ratios (item 5) | Which contrasts are confirmatory; whether the MCP arm becomes a cost question (`rev-05:46`) |
| Margins (item 6) | The equivalence margin, the acceptance-gap margin and the literal-view margin, set from data (REV-03 finding 5) |
| Cost (item 7) | The confirmatory budget and the lane plan |
| Semantic frequency (item 8) | Whether the confirmatory study puts C1d or C4 in the loop (SEM; `c4-01` §8 options A and B) |
| Seeded recall per cell (item 10) | The per-arm non-differential miss check for any "characterised" style (V4 ADR §4) |
| Taxonomy material (item 9) | SO5 open coding (`rev-04:197`) |

Each change these results cause in the drift record is written as a dated deviation of Study 2, with this study's report cited as "what had been seen". The confirmatory tasks cannot change: they are sealed before Stage A (§4).

## 12. What this study may not claim

- No confirmatory claim about any cell, contrast or generator. No sentence of the form "the firewall reduces drift".
- No pooling with the confirmatory study. Exploratory blocks never enter the confirmatory analysis.
- No V4, SO4 accuracy or meaning claim from it alone. Seeded recall on agent code is reported as a validity check, next to the hold-out.
- Semantic results are frequencies on a sample of 24 snapshots, never rates on the study.

## 13. Pre-mortem

1. **The floor holds.** No Sonnet or Gemini Layered loop run exists yet (`study2-deviation-2026-10-19-drift.md:63`). Stage A catches it at 60 turns, not 416.
2. **Gemini is not live.** The coding adapter or its S4 probe is missing. Then Stage A runs Claude only, and the stop rule reads "for the generator that ran". The report says so.
3. **DDD stays unscorable** (tool defect T1, `rev-04:156`). DDD numbers are then "not measured", and Layered carries the study.
4. **The semantic prerequisites slip.** Item 8 is then "not run", and SEM's in-loop question passes to the confirmatory design unanswered.
5. **An examiner reads it as tuning.** Mitigations: the confirmatory tasks are sealed first; the stop rule is fixed now; every later change is a dated deviation.

## 14. Still open (none is decided here)

- Sealing time for the confirmatory tasks (§4).
- The order relative to the freeze (§6).
- The counts and caps (§10).
- The writer of the two exploratory-only DDD tasks: which session and which model.
- Whether the drift record's own pilot (2 tasks × 3 replicates, `study2-deviation-2026-10-19-drift.md:54`) is still needed after this study. Dropping it would be a dated deviation.

## Amendment 1, 2026-10-19 (dated, before any Stage A call)

**Why.** Four decisions and results came after this registration was written:
- the author's DDD-BETA decision (`ops/decisions.md`);
- the choice to run Stage A before the freeze, as §6 allows;
- the Gemini S4 failure on agy 1.4.2 (`Docs/DiagnosticRuns/v1.4-gemini-s4-agy142-2026-10-19.md`);
- the blind writing of the 4 Layered confirmatory tasks.

A Fable consistency check of this text against REV-05 and those decisions found the contradictions below. This amendment resolves them. The protocol block and line above are updated to match, and `npm run lint:protocol` passes.

1. **Tasks and styles: Layered only.**
   - Stage A runs `ice-rink`, `youth-league` and `hive-health`.
   - DDD is **deferred** until the DDD-beta capability report passes (DDD-BETA). When it runs, it is strategic-only (D5) and has its own dated Stage A, with its own task hash in the changelog.
   - The two exploratory-only DDD tasks are written only then.
2. **Generator: Claude Sonnet only.** Gemini failed S4 in both arms under ADR-029, so no Gemini coding cell runs. Gemini keeps its one-shot roles: C1d and C4 scoring, and the cross-vendor check. Wherever §7 says "for both generators", read "for the generator that ran".
3. **Stage A runs before the freeze.**
   - It runs at a recorded commit tag, with Claude CLI 2.1.304 under the D1 exploratory allowance. The tag and CLI version are recorded per trajectory.
   - Every Stage A number is **re-scored at the freeze tag**, and both figures are reported.
4. **The stop check is provisional.** The Stage A stop check runs on the pre-U6 instrument (Layered development recall 0.70). So it is **provisional until re-scored at the freeze**:
   - a stop the re-scoring overturns is lifted, and declared;
   - a stop the re-scoring confirms is final.
   - With one style, a Layered stop means the study stops.
5. **Confirmatory tasks.** The 4 Layered confirmatory tasks are written blind and sealed before Stage A. Their `tasks.json` and manifest hashes go in the changelog before the first Stage A call. The 2 DDD confirmatory tasks are sealed before any DDD Stage A.
6. **Samples and counts, one style and one generator:**
   - **Stage A:** 3 tasks × 1 replicate × 5 steps = **15 turns** (cap 23).
   - **Core** (Stage A + replicate 2 + `none@L3` and `mcp@L2` over 6 blocks × 4 steps): 15 + 15 + 48 = **78 turns** (cap 117).
   - **Semantic scoring sample:** cell (3) × style (1) × generator (1) = 3 strata, 12 snapshots. The C1d and C4 caps in §10 halve.

   All of these are below the counts D7 approved, so no new OK is needed for them.
7. **The drift record's `fallback=run-exploratory`** is superseded by this study as the exploratory route (REV-05 §7 item 1). A confirmatory Study 2, if it runs, uses its own protocol.
8. **§14:** the sealing time, the order and the counts are closed by D7 and this amendment. What stays open: the writer of the exploratory DDD tasks, and whether the drift record's pilot is still needed.

## Changelog
- 2026-10-20: **Generator argv: `--safe-mode` replaced by an explicit flag set, in both arms (DELEG3 option D, delegated to the coordinator).** Before `mcp@L2`, after the Claude S4 MCP probe failed only because `--safe-mode` also drops every `--mcp-config` server on CLI 2.1.304.
  - **Change.** `buildGeneratorArgs` (shared by `none` and `daedalus-mcp`) emits `--setting-sources ""`, `--settings {"autoMemoryEnabled":false,"disableAllHooks":true}` and `--disable-slash-commands` where it emitted `--safe-mode`. MCP comes only through `--strict-mcp-config`: no server in `none`, exactly `daedalus-arch` with `--confine` in `daedalus-mcp`. Everything else in the argv, the environment and the plans is unchanged.
  - **Equivalence evidence** (2 live calls, `results/v1.4-claude-s4-mcp/equivalence/`). One trivial turn under each set, loop environment, planted CLAUDE.md, skill, agent, hook and decoy-MCP canaries. The `system/init` event gives the same tools, MCP servers (none), plugins (built-in only) and permission mode. There is no skill, slash command or CLAUDE.md under the new set (the old set listed 19 bundled skills). No hook or decoy fired. The total input context is identical (6 731 tokens). The one difference that has no flag is the built-in `statusline-setup` agent, which is inert (no Agent tool).
  - **Stages A and B ran under `--safe-mode`.** That covers Stage A and Stage B's `none@L2` replicate 2 and `none@L3`. For the `none` arm the new set is equivalent: `--safe-mode` only removed things that arm never had, and the init comparison above shows it. `mcp@L2` runs under the new set. The cells of a block therefore differ only in the tool. S4 was re-run under the new set and passed (9/9, plus probes 1–5 of `none`; `Docs/DiagnosticRuns/v1.4-claude-s4-mcp-2026-10-20.md`, "Run 2"). The frozen E1 text (`Docs/generator-protocol.md` §1, registered) still describes the `--safe-mode` argv E1 ran with. Any later E1 run needs a dated protocol change and a pre-registration bump.
- 2026-10-20: **Stage C analysis addition: per-rule exposure (registered before any Stage C scoring).** It is descriptive only; it changes no estimand, cell, count or stop rule.
  - **Why.** In Stages A and B every blocking finding is FF-S03. A rule with zero violations is evidence of conformance only if the snapshots gave it an opportunity to be broken.
  - **What.** For every scored snapshot and every Layered blocking rule, count that rule's **opportunities**: the code facts the rule constrains, counted from the same evaluated graph the scorer uses. Examples: cross-layer imports for the direction and layer-skip rules; framework-package imports in a layer the rule restricts; module dependency chains for the cycle rule. The exact opportunity definition per rule is fixed in the Stage C build note before it is run on study data, and is tested on the development set first.
  - **Report.** Per rule and cell: opportunities, violations, and violations per opportunity. A rule with zero opportunities is reported as **not exercised**, never as conformant. Zero model calls.
- 2026-10-20: **Stage B environment, declared.** S3 (per-run HOME isolation) was not fixed before Stage B, contrary to the entry below. Replicate 2 of `none@L2`, `none@L3` and `mcp@L2` therefore keep Stage A's environment (E1 env, pin on, per-run HOME isolation off, `--safe-mode`), so that every cell of a block shares one environment.
- 2026-10-19: Amendment 1 (Layered only, Claude only, Stage A before the freeze with a provisional stop, DDD deferred, counts halved). The confirmatory task hashes are added here before Stage A.
- 2026-10-19: **Stage A environment, declared change.** The first live Stage A attempt (0 model calls: every turn returned "Not logged in" in 41 ms with 0 tokens) showed that the generator's per-run HOME isolation cannot authenticate on macOS, because the CLI's keychain login is only reachable under the real HOME. This is gate S3, never exercised live before (`Docs/v1.3/loop-isolation.md` §4). Stage A therefore runs with the CLI pin on and per-run HOME isolation off: the E1 environment the loop pilot and Study 1 used, with every turn under `--safe-mode` (no CLAUDE.md, skills, plugins, hooks or MCP). S3 is fixed before Stage B.
- 2026-10-19: the 4 Layered confirmatory tasks were sealed before Stage A. tasks.json sha256 6ac2107916d40b2b8b261613828211f71f39f9581927a6a7286c629ce444c5fc; manifest sha256 e680aeb06e8c0297c158aa87241bb66e6ba2638ff77e4b1e3bd6c02e02b3abbf; domain examiner GO (`Docs/v1.4/confirmatory-tasks-seal.md`).
- 2026-10-19: first version (EXP, EXPT, SEM; REV-05 §3, §5, §6 items 1, 2 and 7).
