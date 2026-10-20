# Study 2b pre-registration: confirmatory drift study (Layered, Claude Sonnet)

<!-- study2-protocol: primary=D-new-blocking-identities-steps-2-to-k; k=5; arms=none,daedalus-mcp; cells=none@L2,none@L3,mcp@L2; start=shared-step-1; unit=distinct-edge; tasks=new-4-layered-2-ddd-sealed-at-freeze; fallback=run-exploratory; order=freeze,hold-out,pilot-and-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,gemini-pin -->

**Status: DRAFT. Not registered and not dated as registered.** It becomes the pre-registration when four things have happened. The placeholders (§10) are filled: P1–P4 now are, from 2a Stage C; the rest are listed in §10 with who fills them. The deviations in §8 are filed as one dated deviation of the drift record. A Fable adversarial review has been answered (GO-2B). The file is then dated and deposited on OSF under embargo, before the first 2b call.

- **The protocol source.** The confirmatory protocol is the drift record, [`study2-deviation-2026-10-19-drift.md`](study2-deviation-2026-10-19-drift.md), and its `study2-protocol` block (§2 there). The line above repeats that block. Where this draft and the drift record disagree, the drift record wins until a dated deviation (§8) says otherwise.
- **How it was written.** An AI session wrote it in a scheduled routine, with zero model calls. It read nothing under `daedalus-sealed/` and not the MEAN-01 sample, and it names no sealed task. The decisions it applies are the author's, or were delegated by the author: M3, TASKS, GEN, STY, EXP, EXPT, DELEG, DELEG2, DELEG3, GO-2B and V4-ACC in `ops/decisions.md`.
- **What had been seen.** Everything in drift record §3. Also 2a Stages A and B (pre-freeze previews: `Docs/DiagnosticRuns/v1.4-exploratory-stage-a-2026-10-19.md`, `…-stage-b-2026-10-20.md`), on the 2a tasks only. No confirmatory task, and no output on one, has been seen by any agent.
- **Lint.** `npm run lint:protocol` checks the documents listed in `scripts/v1.3/protocol-consistency-check.mjs`. This file is not in that list yet, because `scripts/` is a frozen path (`scripts/v1.3/lib/holdout-run-main.ts`, `FROZEN_PATHS`). Adding it after the freeze tag would change the frozen inputs, which GO-2B never waives. The file still carries the canonical line and cites the drift record, so `checkDoc` passes on it. It is registered in the lint list at the next freeze, if there is one.
- **The power script added after the tag.** §3 step 3 runs `scripts/v1.4/study2b-power.ts` (helpers `scripts/v1.4/lib/study2b-power.ts`, test `tests/unit/scripts/v1.4/study2b-power.test.ts`). It is a new analysis aid under the frozen path `scripts/`, like Stage C's `stage-c-rescore.ts` already on main. It changes no file at X. A frozen-path check at the run commit against X lists it with the Stage C files, and the coordinator records that at the gate.

## 1. Hypotheses

D is a count of new violations, so lower is better. Every hypothesis is about the 2b population: the 4 sealed Layered tasks, Claude Sonnet, from a shared step-1 tree.

| Id | Contrast | Predicted direction | Test |
|---|---|---|---|
| **H1** | none@L3 vs none@L2 (SO5: does spec delivery in prose cut drift?) | D(none@L3) **<** D(none@L2) | two-sided (§4) |
| **H2** | mcp@L2 vs none@L2, **"delivery plus checking"** (the MCP tools deliver the spec and also check it, so H2 does not isolate checking; REV-03 finding 4) | D(mcp@L2) **<** D(none@L2) | two-sided |
| **H3** | mcp@L2 vs none@L3 | **none** | two-sided |
| **E** | none@L3 vs mcp@L2, equivalence (drift record §2, "Registered equivalence") | within ±Δ (§3, placeholder P4) | two one-sided bounds (§4) |

- **Directional hypotheses with two-sided tests.** The drift record registers two-sided tests (§2, "Confirmatory contrasts"). They are kept: a one-sided test would be a deviation that makes rejection easier. H1 or H2 is **supported** only if it is rejected after Holm **and** its estimate has the predicted sign. A rejection in the other direction is reported as a finding against the hypothesis.
- **H3 and E answer different questions.** H3 asks whether the two cells differ. E is the only registered way to claim "the firewall adds only spec delivery". A non-rejected H3 is never read as equivalence.

### Primary outcome: D, exactly as the drift record defines it

> **D** per cell: distinct blocking identities present at step j (2 ≤ j ≤ 5) and absent from the shared step-1 tree and from every earlier step of that cell, summed over steps 2–5. Identities follow the pilot memo's identity rule. The unit is the distinct edge (or a cycle as its sorted file set). Only findings that `check-correct.ts` labels `correct` count. The blocking tier is the sealed tiers plus the declared post-seal overlay (ADR-V14-01, -02). Every snapshot is scored (ITT).

D measures **how far the inherited step-1 pattern spreads into new slices** (drift record §2). A block with Y₁ = 0 contributes 0 in every cell. So D is always reported next to Y₁. At the freeze construct, the Layered blocking set is FF-S01, FF-S02 (cross-layer cycles only) and FF-S03 (`Docs/v1.4/exposure-definitions.md` §6b).

### Secondary outcomes (no confirmatory claim; no Holm)

| Outcome | Definition |
|---|---|
| **Y₅, the end state** | Distinct blocking identities at step 5 (the first deviation's primary). Also the share of blocks with Y₅ = 0 per cell |
| **Repair** | Inherited step-1 identities that are absent at step j, per cell and step. Also **D \| R = 0**, D in blocks with no inherited removal (2a estimand 3). 2a showed that L3 and MCP often remove the whole step-1 pattern at step 2, which D does not count |
| **Y₁** | Step-1 identities per block (shared by all cells) |
| **Per-rule exposure** | For each Layered blocking rule and cell: opportunities, violations, and violations per opportunity, by `scripts/v1.4/exposure-count.ts` at the freeze tag, with the definitions in `exposure-definitions.md`. A rule with 0 opportunities is reported as **not exercised**, never as conformant |
| **Tool-call telemetry** (mcp@L2) | Calls per tool, per step and per run, from the MCP call logs. Share of steps with ≥ 1 `get_architecture_spec` call and with ≥ 1 `check_*` call. Any call to a denied tool is reported as such |
| **The drift record's other secondaries** | The memo §5 slope outcomes; advisory per KLOC without FF-CV05; the evasion measures (drift record §6); the acceptance pass rate (D12) |
| **Cost** | Turns, repair turns, pauses and wall time per cell |
| **Composition-root placement** (descriptive) | Per cell, the share of composition-root wiring that sits in a file named `main.ts`, which Q25 = B exempts from the layer rules. Wiring is an import edge from a presentation composition-root file into persistence (the composition-root names of `edgeKind`, `scripts/v1.4/lib/stage-c.ts`, plus `main.ts`). It is read from each step-5 snapshot's dependency graph, not from findings, because an exempt file raises none. Reported next to D, with the count per block. The other Q25 = B exempt names (`*.module.ts`, `*Container.ts`, `composition-root/`) are counted on their own line. See §7 item 9 |

## 2. Design

| Item | Value | Source |
|---|---|---|
| Tasks | The **4 sealed Layered confirmatory tasks**. `tasks.json` sha256 `6ac2107916d40b2b8b261613828211f71f39f9581927a6a7286c629ce444c5fc`; `MANIFEST.sha256` sha256 `e680aeb06e8c0297c158aa87241bb66e6ba2638ff77e4b1e3bd6c02e02b3abbf` (24 files: tasks, 20 acceptance tests, design notes, audit sheet, hint audit). Written blind (V10c), hint audit 0 FAIL, domain examiner GO. Each hash is re-checked before step 1, and a mismatch stops the run | `confirmatory-tasks-seal.md` |
| Styles | Layered only. The 2 DDD confirmatory tasks are not sealed, and DDD is deferred (DDD-BETA), so the drift record's "otherwise 4 Layered" applies | drift record §2, Blocks |
| Cells | `none@L2` (minimal spec); `none@L3` (minimal spec plus one plain sentence per blocking rule); `mcp@L2` (minimal spec plus the 9 spec-only MCP tools, `evaluate_project` denied). No L1, no L4 | drift record §2 |
| Start | **Shared step 1.** Each block runs step 1 once, in `none@L2`. All three cells branch from that tree at step 2 (`--shared-start-from`, as in 2a Stage B). The step-1 trajectory continues as the block's `none@L2` cell | drift record §2 |
| Horizon | k = 5. Steps 2–5 each add a vertical slice or an outside adapter | drift record §2 |
| Block | One task × one replicate (one shared step-1 tree). N = 4 × r blocks; r is fixed in §3 | — |
| Generator | `claude-sonnet-5-5`, Claude Code CLI **2.1.304** (`cliVersion` in the 2a plans, `results/v1.4-exploratory/stage-b/mcp-L2/plan-mcp-L2.as-run.json`), auto-update off. The dated confirmatory pin record is placeholder P5 (gate S2) | D1, S2 |
| Customizations off (DELEG3, both arms) | `--setting-sources ""`, `--settings {"autoMemoryEnabled":false,"disableAllHooks":true}`, `--disable-slash-commands`, as emitted by `GENERATOR_CUSTOMIZATIONS_OFF` (`scripts/lib/generators/argv.ts`). MCP comes only through `--strict-mcp-config`: no server in `none`, and exactly `daedalus-arch` in `daedalus-mcp`. `--bare`, `--add-dir` and `--dangerously-skip-permissions` are never emitted | DELEG3 |
| MCP server | Built **at the freeze tag** `v1.4-freeze-2026-10-20` (X = `4d28d2803bec018e48f848e6a0f27ff87b3babf2`), outside every agent cwd, and started with `--confine`. The build commit is recorded in every `mcp@L2` run record | freeze record |
| Confinement | S4 passed for the Claude `daedalus-mcp` arm under the DELEG3 flags (Run 2, 9/9, plus no-MCP probes 1–5; `Docs/DiagnosticRuns/v1.4-claude-s4-mcp-2026-10-20.md`). It is re-run at the run commit (gate rule 3) | S4 |
| Environment | One lane, one harness root. Every cell of a block shares the environment. S3 status: §6 | S9, S3 |
| Order inside a block | Step 1, then the three cells' steps 2–5. Each cell's run order within a block is drawn with the run seed (P7). The same draw is used for every block of a replicate | — |
| Run once | The sealed tasks are run once, here. They are never run for practice: the dress rehearsal uses practice tasks only | GO-2B |

### Gemini: a dated extension arm (declared deviation)

- **What.** The drift record registers `generators=claude-sonnet-5-5,gemini-pin`, one lane each. 2b runs **Claude only** (GO-2B; `ops/05-plan-to-friday-2026-10-23.md`).
- **When.** Gemini runs later as a **dated extension arm**: after its quota resets (about 2026-10-25), on the same sealed tasks and cells, with the same N, **only if** its own S4 passes (Gemini failed S4 under agy 1.4.2: exploratory registration, amendment 1 item 2). Its model id, agy pin and S4 result are placeholder P9, recorded before its first call.
- **What is lost.**
  1. **The cross-vendor claim is deferred.** 2b's confirmatory claims hold for Claude Sonnet only.
  2. The registered falsifier "sign agreement between generators" cannot be applied in 2b.
  3. V10(a), a non-Claude generator, is not met by 2b.
  4. The pooled 32-block design becomes 4 × r blocks.
- **How the extension is analysed.** Separately, with the same tests. It is never pooled into 2b's Holm family after 2b's results are seen. The extension is analysed on its own, and the sign agreement with 2b is reported descriptively.

## 3. Sample size

**The method is fixed here. Only the numbers are filled in later, from 2a Stage C** (every 2a cell re-scored at the freeze tag with `check-correct`). The pre-freeze previews are **not** used: they mix two constructs (the Stage B note, last paragraph).

### P1: per-cell variance (filled from 2a Stage C)

**Source.** The registered D of 2a Stage C, re-scored at the freeze tag with only `check-correct` `correct` findings: `results/v1.4-exploratory/stage-c/rescore/runs.json` (`registered.D`, `registered.Y1`), and `Docs/DiagnosticRuns/v1.4-exploratory-report-2026-10-20.md` §3. The block order is hive-health r1, r2, ice-rink r1, r2, youth-league r1, r2. The committed result file and the report agree on every value. They also agree with the values in the brief that asked for this fill. Computed by `scripts/v1.4/study2b-power.ts`; output `results/v1.4-study2b-power/resampling/{power.json,tables.md}`.

| Cell (2a, 6 blocks) | D per block | mean D | SD D | NB θ (moments) | P(D = 0) | mean Y₁ |
|---|---|---|---|---|---|---|
| none@L2 | 1, 0, 1, 3, 2, 2 | 1.50 | 1.05 | **undefined**: variance 1.10 < mean 1.50, no overdispersion | 0.17 (1/6) | 2.00 (Y₁ = 1, 1, 4, 4, 1, 1) |
| none@L3 | 2, 0, 0, 2, 0, 0 | 0.67 | 1.03 | 1.11 | 0.67 (4/6) | — |
| mcp@L2 | 1, 0, 0, 0, 0, 2 | 0.50 | 0.84 | 1.25 | 0.67 (4/6) | — |

- **SD** is the sample SD (n − 1). **θ by moments** is mean² / (variance − mean).
- **Y₁** is shared by the cells of a block. Y₁ = 0 in 0 of 6 blocks.

### P2: paired differences (filled from 2a Stage C)

d_b = D(reference cell) − D(other cell), per block.

| Contrast | d_b per block | p₀ = share of d_b = 0 | q = P(d_b > 0 \| d_b ≠ 0) | mean d | SD d |
|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | −1, 0, 1, 1, 2, 2 | 0.17 (1/6) | 0.80 (4/5) | 0.83 | 1.17 |
| H2: none@L2 − mcp@L2 | 0, 0, 1, 3, 2, 0 | 0.50 (3/6) | 1.00 (3/3) | 1.00 | 1.26 |
| H3: none@L3 − mcp@L2 | 1, 0, 0, 2, 0, −2 | 0.50 (3/6) | 0.67 (2/3) | 0.17 | 1.33 |

### Computation (in this order)

1. **A floor from exactness (computed now).** A two-sided sign-flip test over n non-zero paired differences cannot give p below 2 × 2⁻ⁿ. That floor is reached only when all n have the same sign and the largest |d|. Holm's thresholds over 3 tests are 0.05/3, 0.05/2 and 0.05. So the minimum number of **non-zero** pairs is:

   | Holm step | α′ | minimum non-zero pairs (2 × 2⁻ⁿ ≤ α′) |
   |---|---|---|
   | 1st (smallest p) | 0.0167 | **7** (p ≥ 0.0156) |
   | 2nd | 0.025 | **7** (p ≥ 0.0156) |
   | 3rd | 0.05 | **6** (p ≥ 0.031) |

   Zero differences carry no information. So the expected number of blocks needed is at least 7 / (1 − p₀) for H1 and H2. For example, with p₀ = 0.5 that is ≥ 14 blocks, before any allowance for opposite signs.
2. **The registered power rule (drift record §4).** Run `scripts/v1.3/level-power-sim.ts --outcome drift --pilot <2a none@L2 D, one generator> --lower-bound 0.8 --theta-band 1,4,inf --sims 2000 --seed 20261018` (`Docs/v1.4/drift-power-sim.md` §3). Read power at RR 0.25 under independent cells. A contrast with power below 0.80 for any θ of the band is **demoted to secondary before dating**. The script's pilot grid is 4 tasks × 4 replicates per generator (16 blocks for one generator), and that figure is reported as it is.
3. **Power at the actual grid, by resampling 2a's paired differences.** For N ∈ {8, 12, 16, 20, 24} (multiples of the 4 tasks): draw N block differences with replacement from P2's 2a differences for that contrast. Apply the registered sign-flip test (§4) at **α′ = 0.0167**, the strictest Holm step, so the result is conservative. Use 2,000 simulations, seed `20261021`. Power(N) is the rejection rate with the predicted sign. Because 2a's 6 blocks overstate a winner's effect, the same is repeated with each difference shrunk toward 0: an effect at half its 2a size (each d_b replaced by round(d_b / 2), with ties randomised by the same seed). **N is the smallest grid value with power ≥ 0.80 for H1 and H2 at the half-size effect.**
4. **Replicates.** r = N / 4. Turns = N × (1 + 3 × 4) = 13N. The turn cap is 1.5 × 13N, covering repair turns (drift record practice). The plan's estimate of about 104 turns (`ops/05`) is N = 8, r = 2. If step 3 needs more than the budget or the date allows, the affected contrast is **demoted to secondary before dating**. N is never lowered after the power figure is seen, and a contrast is never kept confirmatory below 0.80.
5. **H3 is not powered.** It is a two-sided question with no predicted effect. Its power at the chosen N is reported as it comes.

### P3: results of steps 1–4 (computed from P1/P2)

**Step 1, the floor.** At α′ = 0.0167 a contrast needs 7 non-zero pairs (Holm 2nd step 7, 3rd step 6). Blocks needed, 7 / (1 − p₀): H1 8.4, H2 14.0, H3 14.0.

**Step 2, the registered power script.** It ran as registered, with exit 0, and its interface matched the command above. Command:

```bash
npx tsx scripts/v1.3/level-power-sim.ts --outcome drift --pilot results/v1.4-study2b-power/pilot-2a-stage-c.json \
  --lower-bound 0.8 --theta-band 1,4,inf --sims 2000 --seed 20261018 --out-dir results/v1.4-study2b-power/level-power-sim
```

- **Pilot input.** The pilot file holds the 2a none@L2 D for one generator (`claude-sonnet-5-5`: 1, 0, 1, 3, 2, 2).
- **Lower bound.** n = 6, mean 1.50, SD 1.05, t₀.₈,₅ = 0.9195, so the 0.8 lower bound is **1.11**.
- **The script's grid.** 4 tasks × 4 replicates × 1 generator = **16 blocks** (208 step turns), reported as it is.
- **Power at RR 0.25, independent cells** (θ 1 / 4 / ∞):
  - H1: 0.34 / 0.53 / 0.61;
  - H2: 0.34 / 0.52 / 0.60.
- **Verdict line, both contrasts:** "demote to secondary". The full table is in `results/v1.4-study2b-power/level-power-sim/tables.md`.

**Step 3, resampling power.** `scripts/v1.4/study2b-power.ts`, 2,000 simulations, seed `20261021`, α′ = 0.05/3.
- **The p-value.** p is the exact two-sided sign-flip p over all 2ᴺ patterns, computed by convolution. The registered 99,999-draw Monte Carlo p estimates this same quantity; at α′ the difference is below 0.001.
- **Counting.** H1 and H2 count only rejections with T > 0. H3 counts any rejection.
- **Seeds.** Each (contrast, size, N) configuration starts its own stream from the seed.

| Contrast | Size | N = 8 | N = 12 | N = 16 | N = 20 | N = 24 | Smallest N ≥ 0.80 |
|---|---|---|---|---|---|---|---|
| H1 | 2a size | 0.122 | 0.305 | 0.519 | 0.688 | 0.810 | 24 |
| H1 | half size | 0.026 | 0.197 | 0.309 | 0.446 | 0.569 | **none** |
| H2 | 2a size | 0.040 | 0.393 | 0.790 | 0.953 | 0.989 | 20 |
| H2 | half size | 0.015 | 0.209 | 0.554 | **0.805** | 0.943 | **20** |
| H3 | 2a size | 0.001 | 0.021 | 0.030 | 0.030 | 0.031 | — (not powered) |
| H3 | half size | 0.000 | 0.003 | 0.013 | 0.015 | 0.017 | — (not powered) |

The Monte Carlo SE at 0.80 with 2,000 simulations is about 0.009. H2's 0.805 at N = 20 is therefore at the bar, not clear of it.

**Summary.**

| Contrast | p₀ | Blocks needed (step 1) | Power, script (step 2; θ 1 / 4 / ∞) | Smallest N ≥ 0.80, half size (step 3) | Confirmatory or demoted |
|---|---|---|---|---|---|
| H1 | 0.17 | 8.4 | 0.34 / 0.53 / 0.61 → demote | none in {8, …, 24} | **demoted to secondary** by step 2 and by step 3 (grid not extended) |
| H2 | 0.50 | 14.0 | 0.34 / 0.52 / 0.60 → demote | 20 (0.805) | **demoted to secondary by step 2.** Step 3 alone would keep it at N = 20 (see below) |
| H3 | 0.50 | 14.0 | — | — | Holm family, not powered; power at N = 20 is 0.030 (2a size) and 0.015 (half size) |

**Resolved by DELEG7 (2026-10-20, before dating; `ops/decisions.md`): N = 40, r = 10; turns = 13 × 40 = 520; turn cap = 1.5 × 520 = 780.**

- **Why the grid was extended.** The registered design had 32 blocks over two generators (4 tasks × 4 replicates × 2). With Claude only (§2, Gemini), the registered script's default grid gives 16 blocks, and both contrasts fail. The grid of both steps is therefore extended to the smallest Claude-only N at which **both** step 2 (registered, binding) and step 3 (half size) reach 0.80 for H1 and H2. No test, α, Holm rule, power bar or θ band changed.
- **Step 2,** the registered `pilotPower` (same inputs, seed 20261018, 2,000 simulations; θ 1 / 4 / ∞):

  | Blocks | H1 | H2 | Keep |
  |---|---|---|---|
  | 16 | 0.34 / 0.53 / 0.61 | 0.34 / 0.52 / 0.60 | no |
  | 24 | 0.62 / 0.83 / 0.89 | 0.64 / 0.82 / 0.88 | no |
  | 32 | 0.78 / 0.93 / 0.97 | 0.79 / 0.93 / 0.97 | no |
  | **40** | **0.91 / 0.98 / 0.99** | **0.90 / 0.98 / 0.99** | **yes** |
- **Step 3,** `resamplePower` (seed 20261021, 2,000 simulations, α′ 0.0167):

  | Contrast | N = 32, 2a size / half | N = 40, 2a size / half |
  |---|---|---|
  | H1 | 0.936 / 0.746 | 0.986 / **0.879** |
  | H2 | 1.000 / 0.993 | 1.000 / **1.000** |
- **H1 and H2 stay confirmatory at N = 40.** H3 is in the Holm family and not powered.

**What §3 gives, read as written. The coordinator decides this before dating, and it is not decided here.**
1. **Steps 2 and 3 disagree on H2.** Step 2 demotes "a contrast with power below 0.80 for any θ of the band", and step 4 says "a contrast is never kept confirmatory below 0.80". Read literally, H2 fails step 2, so **both directional contrasts are demoted**. The Holm family would then hold H3 only, and H3 is not powered.
2. **Why the two steps differ.**
   - Step 2 simulates a cut to RR 0.25 from the pilot's lower-bound mean of 1.11, on its fixed 16-block grid.
   - Step 3 resamples the observed 2a differences at N blocks. For H2 those differences have no negative value (q = 1.00), and the cell ratio is 0.33.
3. **What would be a method change.** Choosing which step governs, or running step 2 at N = 20, would change the method. It is then a dated deviation (§8) filed before dating, never a silent reading.
4. **If no directional contrast stays confirmatory,** 2b runs under the drift record's fallback, labelled exploratory (§4).
5. **Budget and date (step 4).** N = 20 needs 260 turns against the plan's estimate of about 104 (`ops/05`, N = 8). If the budget or the date cannot carry 260 turns, step 4 demotes H2 as well.

### P4: equivalence margin Δ (filled from 2a Stage C)

Δ is set from 2a's estimand 6 margins, as the exploratory registration §11 assigns. It is stated in D units per block (mean paired difference). It must be ≤ half of the none@L2 lower-bound mean from step 2, so that "equivalent" cannot cover an effect as large as H1's minimum detectable effect.

**Δ = 0.55 D per block.**
- **The cap.** Step 2's lower bound is 1.11 (1.1063), so the cap is 0.553. Δ is that cap, rounded down to two decimals.
- **Why the cap sets it.** 2a's estimand 6 produced no margin in D units. The exploratory report gives tool use per step (§11) and cost (§12). It reports no acceptance pass rate, no literal-view gap and no moved-only read. So the rule's only data-derived bound is the cap.
- **Context only, not part of the rule.** 2a's mean none@L3 − mcp@L2 difference is 0.17, SD 1.33, over 6 blocks.
- **For the reviewer (P10).** With an SD near 1.3, the 90 % interval at N = 20 has a half-width of about 0.5. So E can hold only if 2b's differences are much less spread than 2a's.

## 4. Analysis plan

**Scoring.** Every 2b snapshot is scored **once, at the freeze tag** `v1.4-freeze-2026-10-20` (X = `4d28d280…`). The engine of record is the one gate D8 names: Neo4j 5.26.24 at the compose pin digest. If `cypher-interp` is used, as in 2a, its parity with Neo4j is shown on 2b snapshots first (D8). In-loop evaluator figures are telemetry only, never the outcome. Only findings that `check-correct.ts` labels `correct` are counted. A finding labelled otherwise is listed with its label and excluded from every count. The analysis script and its hash are frozen at the gate (D9). It is the same script that produced the 2a Stage C tables, applied unchanged.

**Pairing.** The unit of analysis is the block, b = task × replicate, which is one shared step-1 tree. For a contrast (c, c′), d_b = D_b(c) − D_b(c′). Only complete blocks enter a contrast: all three cells must have steps 2–5 scored (§5).

**The test.** For each of H1, H2 and H3:
- **Statistic and method.** The statistic is T = Σ_b d_b. The test is a paired **two-sided** sign-flip test (drift record §2): 99,999 random sign assignments, seed `20261021`, and p = (1 + #{|T*| ≥ |T|}) / (1 + 99,999).
- **Exact p.** When N ≤ 20, the exact p over all 2ᴺ sign patterns is also reported. The decision uses the registered Monte Carlo p.
- **Zeros.** Blocks with d_b = 0 are kept. They do not change T.
- **Sensitivity.** The task is a fixed effect with 4 levels. A sensitivity test flips signs within task strata (the same test, because flips are per block), and a task-level sign-flip over the 4 task sums is also reported.

**Multiplicity.** Holm over the family {H1, H2, H3} at familywise α = 0.05. A contrast demoted by §3 leaves the family before dating, and Holm then runs over the survivors. E is an intersection-union test and takes no Holm adjustment.

**Equivalence E.** none@L3 and mcp@L2 are declared equivalent if the **90 %** block-bootstrap interval of the mean paired difference (none@L3 − mcp@L2) lies inside (−Δ, +Δ). That is the two one-sided tests at α = 0.05 each. If E holds and H3 is not rejected, the thesis may write "within ±Δ of each other". If E fails, nothing is claimed about the two cells being equal.

**Effect sizes and intervals.**
- **RR.** RR = ΣD(c) / ΣD(none@L2) for H1 and H2, and ΣD(mcp@L2) / ΣD(none@L3) for H3. RR is undefined, and reported as such, when the denominator is 0.
- **Mean paired difference**, d̄.
- **Intervals.** Both get a 95 % block-bootstrap percentile interval, 10,000 resamples, seed `20261021`, with blocks resampled within task. A task-cluster bootstrap interval is reported next to it.

**Full distributions.** 2a showed all-or-nothing behaviour: a run either cleans the inherited pattern at step 2 or drifts at about the L2 rate. So means alone are not reported.
- The per-block table: task, replicate, Y₁, and D and Y₅ in each cell.
- A histogram of D per cell.
- P(D = 0) per cell, with a Wilson interval.
- For each contrast, the 2 × 2 count of blocks by (D = 0 or not) in each cell.

These are descriptive. They are reported whatever the tests show.

**Reading the result.**
- H1 or H2 supported: rejected after Holm, with the predicted sign.
- Not rejected: "no difference detected at RR ≤ 0.25 MDE". That is never "no effect", because the design detects only an arm that cuts drift to about a quarter (drift record §4).

**V4 consequence (ADR-V14-04).** Layered is confirmatory in 2b only if the per-arm non-differential miss check of ADR-V14-04 §4 passes for every confirmatory contrast pair:
- **Part A:** exposure-weighted miss rates within 0.05.
- **Part B:** seeded recall per cell, with the difference interval covering 0 and |difference| ≤ 0.10. Seed `20261021`, 10,000 resamples.

If either part fails or cannot be run, 2b is reported under the drift record's fallback, **labelled exploratory**: no Holm claims, RRs with intervals only. See §6, V4 and P6: Part A needs hold-out recall per rule family r_f, and no hold-out figure exists yet. **V4 status: pending: hold-out attempt 2 or registered fallback.** The details are in §6.

**No stopping-rule change.**
- There is no interim analysis and no look at any 2b outcome before every block is scored. There is no early stop for efficacy or futility. N is fixed by §3 before dating.
- A usage-limit pause is resumed (S1). It is not a stop.
- The only stops are the GO-2B never-waived failures (§6). A stop means no partial result is reported as confirmatory.

## 5. Exclusions and deviations

**Never excluded (ITT).**
- Agent behaviour never removes a snapshot or a block. A failed type-check, an incomplete step, deleted files, a refusal or an off-task step are all scored as they stand.
- Unmapped files above 10 % flag the snapshot. The primary analysis keeps it; a sensitivity analysis drops flagged blocks.

**Harness failures only.** A failure is a harness failure if the turn never reached the agent, or the instrument failed: a CLI crash before the first tool call, a usage limit that S1 cannot resume, an `evaluationError`, a lost snapshot.
- The turn is re-run once from the same committed state (S1/D14 resume).
- If it fails again, the block is **incomplete**. It is reported in full and left out of every paired test, in all cells, not only the one that failed.
- Incomplete blocks are not replaced, because a replacement would be a second draw chosen after the fact.
- If more than 1 block in 4 is incomplete, the run is reported under the exploratory label.

**Not counted (filtering, not exclusion).**
- Findings not labelled `correct` by `check-correct.ts`.
- Non-blocking tiers.
- Findings in test files, for the evasion moved-only read (drift record §6).

**Stops (GO-2B, never waived).** The run stops, and the author is told, if any of these happens:
- a frozen input changes;
- a sealed hash mismatches, or an agent reads a sealed file outside its run;
- S4 fails for an arm that runs;
- the pre-registration is not dated before the first call;
- a sealed task is run twice.

**Deviations after dating.** Any change after dating is a numbered, dated deviation that states what had been seen. A change to the primary outcome, a test, the Holm family, N, an exclusion rule or Δ **after any 2b output is seen** is reported as a deviation and makes the affected claim exploratory.

## 6. Readiness gate: the 42 lines

- **Two status columns.** The first is the dashboard's (`Docs/v1.3/study2-readiness-dashboard.md` §3, taken **2026-10-16**). The dashboard has not been re-taken since, so the second column gives the later evidence on file. Neither column is a gate verdict. Every line is re-verified at the run commit (gate rule 3), with its evidence in `results/v1.3-study2-gate/`.
- **The NW column.** NW marks the lines that GO-2B says can never be waived: frozen inputs, sealed tasks unread with matching hashes, S4 for each arm that runs, the pre-registration dated before the run, and run once.
- **Any other red line** is made green where that is realistic. If it can't be, it is registered as a dated deviation before the run (§8), with what is lost.
- **V4 and the hold-out, as of this fill.**
  - **The attempt-1 note.** `Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md` (DELEG4) was read. It and both prespec addenda are on the branch `v14/holdout-run-1`, which is **not merged to main**.
  - **The candidate fallback.** `Docs/v1.3/holdout-prespec-addendum-2-2026-10-20.md` §2 (DELEG5, recorded 10:04Z before attempt 2) drafts **fallback F-RF**. If layered has no hold-out figure, ADR-V14-04 §4 part A takes r_f from the frozen development record run: `results/v1.3-reference/after-construct-answers/scores.json` at X, view `blind-primary`, style `layered`, tp / (tp + fn) per rule family. It is declared a development-set estimate, not validity evidence.
  - **Not yet registered.** No prespec addendum with a development-set fallback for r_f is on main. So F-RF is not cited here as registered, and V4 reads **"pending: hold-out attempt 2 or registered fallback"**.
  - **Once it is.** When addendum 2 is on main with its `sealed-hashes.md` row, part A cites "hold-out prespec addendum 2, §2", unless attempt 2 yields layered hold-out figures. Layered then stays confirmatory if parts A and B pass, with the wording of that addendum: "characterised on the development set, not validated on a hold-out".
  - **Part B's input.** Part B's input from 2a is seeded recall per cell. MO-S03 detected 9/11, 11/12 and 10/12 seeds (none@L2, none@L3, mcp@L2), and 30/30 on non-exempt sites (exploratory report §8). This is from the 2a tasks; 2b computes part B on its own snapshots.

| Line | Dashboard 2026-10-16 | On file since | NW |
|---|---|---|---|
| V1 construct answers, ADR-V13-03 | RED | ADR-V13-03 accepted under delegation; freeze F1–F14 OK (freeze record §1–2) | **NW** (frozen inputs) |
| V2 tiers and sources at sealed hashes | GREEN | — | **NW** (frozen inputs) |
| V3 hold-out run once at X | RED | **Not scored.** At the freeze, the sealed layout could not be loaded blind (freeze record §3–4). Attempt 1 (DELEG4, path-only blind adapter) stopped at the structure check: 34 variants do not materialise, and ddd is in a format the frozen loader does not read. No figure was seen, so "run once" is not spent (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`) | — |
| V4 V4 bar per style | RED | ADR-V14-04 accepted (option 1). **Pending: hold-out attempt 2 or registered fallback.** Layered is confirmatory only via ADR §4 (P6) | — |
| V5 independent rater | RED | Timing deviation: labels after the study (drift record §7) | — |
| V6 one κ definition | RED | Pointers added (DELEG2); needed before the first label, not the run | — |
| V7 judge [W] | RED | Waived: the judge is dropped (drift record §7) | — |
| V8 per-snapshot coverage | RED | Kept for generated code; computed on 2b snapshots | — |
| V9 MCP tools agree with full evaluation | RED | Not re-taken | — |
| V10 (a) non-Claude, (b) [W], (c) writer split | RED | (a) **deviation**: Gemini deferred (§2); (c) met by the seal record | — |
| V11 no leakage | AMBER | Not re-taken | — |
| S1 usage limits | RED | Not re-taken | — |
| S2 CLI pinned | RED | 2.1.304 pinned in the plans; dated confirmatory pin **P5** | — |
| S3 isolation | RED | Per-run HOME isolation **off** in 2a (keychain finding), DELEG3 flags on | — |
| S4 confinement per CLI × arm | RED | Claude `none` and `daedalus-mcp` PASS (Run 2, 2026-10-20) | **NW** |
| S5 no-layout-hint arm | RED | Met: L1 declared not run | — |
| S6 advisory per rule | AMBER | Secondary only (drift record §7) | — |
| S7 0 evaluation errors | RED | 2a Layered steps all scored; DDD not in 2b | — |
| S8 every model live | RED | Sonnet live in 2a (78 turns) | — |
| S9 one harness root per lane | AMBER | One lane (`ops/05`) | — |
| S10 `--check-prereg` in CI for the Study 2 base | RED | CI checks only `v1.2e` PRs; tunables verify now in CI | — |
| S11 tunables hashed | RED | `Docs/v1.3/study2-tunables.json`, 197 entries, verify exit 0 (freeze record §2) | **NW** (frozen inputs) |
| S12 out-roots archived, path-free | RED | Not re-taken | — |
| S13 the author's dated words | RED | Go is delegated except the author's go (GO-2B); gate rule 4 says an AI cannot declare it | **NW** (pre-reg dated) |
| S14 retired list intact, unread | AMBER | Restated; hash checked by the domain examiner (seal record) | **NW** (sealed unread) |
| S15 no model labeller | AMBER | Met | — |
| D1 pilot | RED | **Deviation**: 2a stands in for the pilot (§8) | — |
| D2 no banned term; frames identical | AMBER | Sealed hint audit 0 FAIL (seal record) | — |
| D3 power ≥ 0.80 | GREEN (at N = 40) | §3, P3 and DELEG7: at N = 40 both step 2 (0.90–0.99) and step 3 at half size (H1 0.879, H2 1.000) clear 0.80 for H1 and H2 | DELEG7 |
| D4 cost and budget | AMBER | 2a cost on file; budget = §3 step 4 | — |
| D5 MCP latency live | AMBER | 2a `mcp@L2` live; not measured against the bar | — |
| D6 telemetry checker; call log outside cwd | RED | 2a call logs exist outside the cwd; checker not re-taken | — |
| D7 pins, byte-identical re-score | RED | Freeze cross-check byte-identical | **NW** (frozen inputs) |
| D8 engine of record | AMBER | §4 scoring | — |
| D9 one analysis script, planted effect | AMBER | Must run on 2a data with a planted effect | — |
| D10 pre-registration | RED | **This draft**; red until dated | **NW** |
| D11 arm set | RED | Restated: 3 cells, shared start | — |
| D12 acceptance checks, no waiver | RED | 20 sealed acceptance tests; `scripts/lib/loop/acceptance.ts` exists; D12a decided | — |
| D13 coverage and import-kind counts | RED | Not re-taken | — |
| D14 live kill-and-resume | AMBER | Live resume in the dress rehearsal | — |
| D15 DDD spec mode | RED | N/A for 2b (Layered only) | — |
| D16 held-out rules | RED | Deviation: secondary, after the run | — |
| Run once | — | Sealed tasks never run for practice | **NW** |

## 7. Limitations, stated before the run

1. **One firing rule.** Every blocking finding in 2a was FF-S03 (layer skip). D in 2b may be a measure of one rule's propagation. Per-rule exposure (§1) shows which rules had opportunities. A rule that was never exercised supports no claim.
2. **One style.** Layered only. Clean and Hexagonal sit at the floor (reported as a finding), and DDD is deferred. No claim reaches another style.
3. **One generator.** Claude Sonnet only, in the same vendor family as the instrument's authoring sessions. The cross-vendor claim is deferred to the Gemini extension.
4. **Small n.** 4 tasks and N = 4r blocks. Tasks are fixed effects, and the claim covers these 4 tasks. The MDE is RR ≤ 0.25. With many zero differences, which 2a's all-or-nothing pattern suggests, the effective n is the count of non-zero blocks (§3 step 1).
5. **No hold-out figure.** Attempt 1 stopped before scoring (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`), and attempt 2 is pending (DELEG5, unmerged). Absolute counts are under-counts of unknown size. Layered development blind recall at the freeze is 7/10 expanded (freeze record §2, development-set figures, not validity). Under fallback F-RF, if it is registered, r_f is a development-set estimate and likely optimistic.
6. **H2 is "delivery plus checking"**, not checking alone.
7. **2a informed the design.** The design was set after 2a's previews on other tasks were seen. The confirmatory tasks were sealed before 2a Stage A, so 2a could not tune them.
8. **Construct limit.** Layered counts imports from wiring code (D2b).
9. **D depends on the agent's entry-file name** (2a report §5 and §8).
   - **The rule.** Under Q25 = B (frozen at X), a composition root named `main.ts` (also `*.module.ts`, `*Container.ts` or under `composition-root/`; `CONSTRUCT_COMPOSITION_ROOT_GLOBS` in `src/construct-switches/overlays.ts`) is exempt from the layer rules.
   - **What 2a showed.** Every counted 2a identity was FF-S03 wiring from a presentation composition root named `server.ts`, `app.ts` or `composition.ts`, and so it counted. The same wiring in a file named `main.ts` would count 0. In 2a, the 5 MO-S03 seeds that went undetected were all planted in an exempt `src/presentation/main.ts`, and a zero-call probe confirmed the exemption.
   - **What follows for D.** D in part measures where the agent puts its wiring and what it names the file, not only whether it wires across layers. A cell that moves wiring into `main.ts` lowers D without changing the dependency structure.
   - **How 2b reports it.** Per cell, the share of composition-root wiring placed in an exempt `main.ts`, as a registered descriptive secondary (§1, "Composition-root placement"). The rule is not changed: Q25 = B is a frozen input.

## 8. Deviations of the drift record this draft needs (filed as one dated deviation before dating)

| # | Drift record says | 2b does | Stricter or weaker | What is lost |
|---|---|---|---|---|
| DV1 | Generators: Claude Sonnet and Gemini, one lane each; 32 blocks | Claude only; Gemini a dated extension arm | weaker | The cross-vendor claim, the generator sign-agreement falsifier and V10(a), all deferred |
| DV2 | Order: hold-out before the pilot | Hold-out not run (freeze record §4) | weaker | V4 stays red. Layered is confirmatory only if ADR-V14-04 §4 runs and passes (P6) |
| DV3 | Pilot: 2 tasks × 3 replicates per generator, pilot bar | 2a (3 tasks × 2 replicates, Claude) stands in for the pilot bar and the power input (exploratory registration amendment 1 item 7; §14) | weaker (smaller input, other tasks) | The pilot bar's per-generator lines |
| DV4 | Holm over 2 (H1, H2) | Holm over 3 (adds H3, two-sided) | stricter | — |
| DV5 | Blocks = 4 × 4 × 2 | 4 × r × 1, r from §3 | — | Power, if r < 4 |
| DV6 | Effect interval: block bootstrap | Within-task block bootstrap, plus a task-cluster interval | equal | — |

## 9. Procedure to registration

1. **Fill the numbers.** Done for P1–P4, from 2a Stage C at the freeze tag (§3). Still open: the step 2 / step 3 reading of P3 (P11).
2. **File the deviation.** DV1–DV6 go into one dated deviation of the drift record. The `study2-protocol` block changes only if a block value changes. If it does, this line changes with it, and `npm run lint:protocol` passes.
3. **Review.** A Fable adversarial review (GO-2B). Its findings are answered in this file's changelog.
4. **Dress rehearsal and D9.** The dress rehearsal runs on practice tasks only. D9 is checked on 2a data with a planted effect.
5. **Date and deposit.** Fill the date, the OSF id and the embargo. The deposited text is this file's sha256 at the go commit (P8).
6. **Gate and go.** The gate is re-verified at the run commit. Then the author's go (GO-2B), and 2b runs once.

## 10. Placeholders left

| Id | What | Status | Who fills it, and when |
|---|---|---|---|
| P1 | Per-cell mean, SD, θ, P(D = 0), Y₁ | **filled** (§3) | — |
| P2 | Paired-difference p₀, q, mean and SD per contrast | **filled** (§3) | — |
| P3 | Power results, N, r, turns, turn cap; which contrasts stay confirmatory | **filled** (§3): N = 20, r = 5, 260 turns, cap 390; H1 demoted; H2 demoted by step 2, kept by step 3 | the reading in P11 |
| P4 | Equivalence margin Δ | **filled** (§3): Δ = 0.55 (the cap; estimand 6 gave no D-unit margin) | reviewed in P10 |
| P5 | Dated confirmatory CLI pin record (2.1.304, auto-update off) | open | the coordinator, at gate S2, before dating |
| P6 | The V4 route. **Pending: hold-out attempt 2 or registered fallback.** F-RF (addendum 2 §2, DELEG5) is drafted on the unmerged branch `v14/holdout-run-1` | open | the coordinator: merge addendum 2 (F-RF) to main, or report attempt 2's layered figures; before dating |
| P7 | The run seed for the cell order within a block | open | the coordinator, fixed at dating |
| P8 | Registration date, OSF id, embargo, go commit, run commit, this file's sha256 | open | the coordinator, at registration (§9 step 5) |
| P9 | Gemini extension: model id, agy pin, S4 result, date | open | the coordinator, before the extension's first call (after about 2026-10-25) |
| P10 | Fable review reference and responses | open | the Fable review, §9 step 3, before dating |
| P11 | The P3 reading | **closed by DELEG7**: N = 40, chosen as the smallest Claude-only N where step 2 and step 3 both pass; H1 and H2 confirmatory | — |

Seeds fixed now: sign-flip and bootstrap `20261021`; the power script `20261018` (its registered seed).

## Changelog
- 2026-10-20: **DELEG7.** P11 closed: grid extended to N = 40 (r = 10, 520 turns, cap 780), where both power steps pass for H1 and H2. The table is in §3. Still DRAFT and not dated; the Fable review follows.
- 2026-10-20: first draft (DRAFT, not registered). Zero model calls.
- 2026-10-20: P1–P4 filled from 2a Stage C at the freeze tag (zero model calls).
  - **What ran.** Step 2 ran through the registered script; step 3 through the new `scripts/v1.4/study2b-power.ts`, with a test. Results are in `results/v1.4-study2b-power/`.
  - **Added.** The main.ts / Q25 = B construct finding as limitation 9 and as a descriptive secondary.
  - **V4.** Status set to "pending: hold-out attempt 2 or registered fallback". F-RF is cited as drafted, not registered.
  - **Opened.** P11. The method, tests, α, Holm and the 0.80 rule are unchanged. Still DRAFT and not dated.
