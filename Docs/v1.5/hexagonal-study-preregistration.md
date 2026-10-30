# v1.5 Hexagonal study pre-registration: combined delivery of the admitted Hexagonal families (Claude Sonnet)

**Status: DRAFT, NOT REGISTERED (written 2026-10-30 UTC).** Nothing in this file is in force. It is registered
only by a later commit that (1) closes every blocking item of §10, (2) fills every slot of §9, and (3) merges this file
to `main` before any study or pilot call. Until then no call of this study runs. Every change after registration is a
dated deviation (§6).

This is a separate study, under its own registration. It is not a change to the first v1.5 study
(`Docs/v1.5/final-study-preregistration.md`, "the first study"), whose H2 stands as registered there.

Sources: `Docs/v1.5/final-study-preregistration.md` (§1–§9, DEV-2, DEV-3), `Docs/DiagnosticRuns/v15-final-study-2026-10-29.md`,
`Docs/DiagnosticRuns/v15-hcal03-admission-2026-10-28.md`, `Docs/DiagnosticRuns/v15-hcal04-admission-2026-10-28.md`,
`Docs/DiagnosticRuns/v15-hcal06-admission-2026-10-30.md`, `Docs/DiagnosticRuns/v15-hcal07-admission-2026-10-30.md`,
`Docs/DiagnosticRuns/traprate-01-2026-10-28.md`, `Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md`,
`experiments/hx-rules-v3-dev/README.md` (regression), `src/v15-instrument/rule-set.ts`, `experiments/hcal-07/SEAL.root`.
The test, identity rule and reporting rules of the first study (and through it of `Docs/v1.4/study2b-preregistration.md`)
are reused unless stated.

## 0. Why this study exists

The first study's H2 (Hexagonal) is not evidence about delivering the Hexagonal admitted families. As run, the hub's
push and pull checks ran only R-D4, R-XCTX and the layer rules FF-S01 to FF-S03, and 12 of the 16 `none` identities
and all 12 `combined` identities of H2 were R-AXA, which was never delivered (first study, DEV-3). Since then:

- the hub delivers every scored rule, admitted and exploratory (PR 434, merged `9e2f020a1`; `scoredRules` in
  `src/v15-instrument/rule-set.ts`, held by `tests/unit/v15-instrument/delivery-rule-set.test.ts`);
- the hub and the scorers pass the task seed as the baseline (PR 437, merged `4d6b74ef7`; instrument v1.5.3), so a rule
  that reads a baseline scores what the hub delivers (`tests/unit/v15-instrument/baseline-delivery.test.ts`);
- instrument v1.5.5 (`v1.5.5-hx-rules-v3`, PR 446, merged `e10b8916f`) closed the HCAL-06 gaps in R-MIRROR2, R-AXA and
  R-TRANSPORT, and HCAL-07 scored the changed rows blind at it.

## 1. Hypothesis

D is a count of new violations, so lower is better. The population is the 13 tasks of §2, Claude Sonnet through
Claude Code, from each task's fixed seed.

| Id | Style | Contrast | Predicted direction | Test |
|---|---|---|---|---|
| **H-HX** | Hexagonal (13 tasks) | `combined` vs `none` | D(combined) **<** D(none) | two-sided (§4) |

- **Supported** only if all hold: (a) the block-level exact two-sided sign-flip gives p ≤ 0.05; (b) the estimate has
  the predicted sign (T < 0); (c) the task-level sign check holds: the exact two-sided sign test over the tasks whose
  sum of differences is nonzero gives p ≤ 0.05, with more negative than positive sums. Its smallest possible p is
  2/2^n, so (c) needs **n ≥ 6** tasks with a nonzero sum (2/2^5 = 0.0625). If (a) and (b) hold and (c) does not, the
  result is reported as "carried by a subset of tasks", with n stated.
- One confirmatory hypothesis, so no multiplicity correction.
- **What H-HX tests.** "Delivering the declared spec's findings of every scored Hexagonal rule to the agent, on request
  (pull) and after every file edit (push), through one delivery hub, reduces new violations of the admitted Hexagonal
  families." As in the first study, the tool, the hooks and one disclosure sentence come together; which channel did
  the work is descriptive (secondary 4).

### Primary outcome: D_hx

> **D_hx** per cell: distinct violation identities of the **counted rules** (table below) present at step j (1 ≤ j ≤
> the task's step count) and absent from the task seed and from every earlier step of that cell, summed over the steps.
> Identity: rule + file + subject, under Study 2b's rename rule (ρ from `git diff -M50%`). The seed is the baseline
> (instrument v1.5.3). Every snapshot is scored (ITT).

Instrument: `v1.5.5-hx-rules-v3`, with the rules-frozen root of HCAL-07: `experiments/hcal-07/RULES-FROZEN.sha256`,
root `098d67bd4fdc97c5` (45 files: every tracked non-test `.ts` and `.cypher` under `src/v15-instrument` plus
`experiments/cal-01/score.ts`). Checked on this draft's base `origin/main` `3011ce082`: all 45 files OK.

**Admitted Hexagonal rows (confirmatory family), by rule ID.** Rule IDs per row from `HEX_ROW_RULES`
(`src/v15-instrument/rule-set.ts`); FF-S03 and FF-P02 are struck out of the count (below).

| Row | Construct | Counted rule IDs | Admission evidence | Instrument at admission |
|---|---|---|---|---|
| H01 | domain depends outward | FF-S01, FF-S04, FF-P01 | HCAL-03 4/4, 0/6 | HCAL-03 hash; perRow identical at v1.5.5 (hx-rules-v3 regression) |
| H02 | use case imports an adapter | FF-S01, R-INJ *(FF-S03, FF-P02 advisory)* | HCAL-03 4/4, 0/6 | same |
| H03 | adapter imports another adapter | FF-S01, FF-P03, R-AXA *(FF-S03 advisory)* | **HCAL-07 4/4, 0/6** (re-admission at v1.5.5; also HCAL-03 4/4, 0/6 at the earlier R-AXA) | v1.5.5, root `098d67bd…` |
| H04 | vendor or handle type in an out-port | R-H5 | HCAL-03 4/4, 0/6 | regression identical at v1.5.5 |
| H05 | use case constructs an adapter | R-INJ *(FF-P02 advisory)* | HCAL-03 4/4, 0/6 | same |
| H07 | transport concepts in the core | FF-P01, FF-S01, R-TRANSPORT | **HCAL-07 3/3, 0/4** (re-admission at v1.5.5; also HCAL-03 4/4, 0/6) | v1.5.5, root `098d67bd…` |
| H08 | service locator outside the composition root | R-LOCATOR | HCAL-04 4/4, 0/6 (HCAL-03 3/4, not admitted there) | regression identical at v1.5.5 |
| H09 | I/O without a port in the core | R-COREIO | HCAL-03 4/4, 0/6 | same |
| H10 | entity as an inbound adapter's transport shape | R-ENTITY-OUT | HCAL-03 4/4, 0/6 | same |
| H11-a | vendor literal codes (regression) | R-MIRROR2, sub-shape a only | HCAL-07 2/2, 0/2 | v1.5.5 |
| H11-b | vendor error vocabulary | R-MIRROR2, sub-shape b only | HCAL-07 6/6, 0/4 | v1.5.5 |
| H11-c | field renamed to a vendor field (regression) | R-MIRROR2, sub-shape c only | HCAL-07 2/2, 0/2 | v1.5.5 |

Counted rule IDs, once each: **FF-S01, FF-S04, FF-P01, FF-P03, R-INJ, R-AXA, R-H5, R-TRANSPORT, R-LOCATOR, R-COREIO,
R-ENTITY-OUT**, and **R-MIRROR2 restricted to sub-shapes a, b and c**. R-MIRROR's status is open (blocking item B3).
"Regression identical at v1.5.5": `experiments/hx-rules-v3-dev/README.md` §Regression scored CAL-03, HCAL-03, HCAL-04
and HCAL-05 at the v1.5.5 branch with zero calls; perRow identical, no clean case changed.

The sub-shape letters are HCAL-07's (`Docs/DiagnosticRuns/v15-hcal07-admission-2026-10-30.md`, §Result). HCAL-06 used
different wording for c and d (c "vendor field names on core types", d "vendor field names copied as a group"); this
registration uses HCAL-07's only.

**Not admitted, never in D_hx.**

| Row or sub-shape | Rule IDs | Why | Where it is reported |
|---|---|---|---|
| H11-d, vendor field names in the core | R-MIRROR2 sub-shape d (and R-MIRROR, B3) | HCAL-07 4/6, bar not met (misses: a `string[]` list drawn from two vendor declarations; a table valued with vendor field names) | exploratory, per arm |
| H06, business rule in an adapter | R-ADAPTER-RULE | HCAL-03 0/4, HCAL-04 0/4, never met the bar | exploratory, per arm |
| H11-SEM, renamed one-to-one vendor value set | R-MIRROR-SEM | registered secondary outcome, not counted (option A, **pending author confirmation**) | secondary 8 |

**Advisory, never counted:** FF-S03 (`layer-skip-graph`) and FF-P02 (`port-dependency-inversion`). Both are advisory in
the frozen Hexagonal preset (`Docs/v1.3-hexagonal-notes.md`, rule table: FF-S03 is blocking only for `layered`; FF-P02
is a ratio against a threshold). They run, the hub delivers them like every scored rule, and their findings are
reported per arm. They were counted in the first study's Hexagonal outcome; they are not here.

**How non-admitted findings are kept out of the count.** D_hx is computed from a fixed list of counted rule IDs, as the
first study's `score-study.ts` does with `admittedRules` (identity filter `identitiesOf(hits, rules)`). A finding whose
rule ID is not on the list never enters D_hx; it is still scored and reported under its row. Two cases need more than a
rule-ID list, and **neither has a working mechanism today**:

1. *H11 sub-shapes.* R-MIRROR2 serves H11-a to H11-d with one rule ID. Its findings do carry a shape word as the first
   token of the evidence string (`[literal]`, `[error]`, `[field]`, `[field-set]`, `[decl]`, `[field-list]`;
   `src/v15-instrument/rules/r-mirror2-vendor-lexicon.cypher`, last line). But (i) the study scorer's `Hit`
   (`experiments/v15-study/score-study.ts`) keeps rule, file, subject and line and drops the evidence, so no scorer
   reads that word; and (ii) the words do not map onto the sub-shapes. A zero-call re-run of HCAL-07's 25 H11
   positives at v1.5.5 (from the scoring copy, no judge; this draft's check) gives: `[literal]` only on a positives,
   `[error]` only on b, `[field-set]` and `[field-list]` only on d, but **`[field]` on both c positives and on both
   declared-field d positives** (kennel-boarding H11-pos3 `PaymentRecord.charge_id` … ; locksmith-dispatch H11-pos3
   `VisitSlot.visit_uid` …). A `[decl]` finding (non-error declaration name) appeared on HCAL-04's two H11-pos2 cases
   (hx-rules-v3 regression) and has no HCAL-07 sub-shape. So a d-shaped tree yields `[field]` identities that a
   tag-based filter for c would count. **Blocking (B1).**
2. *Row-level admission in code.* `admittedRules('hexagonal')` is built from whole rows: it includes FF-S03 and FF-P02
   (rows H02, H03, H05) and, if H11 were added to `ADMITTED_HEX_ROWS`, it would add R-MIRROR, R-MIRROR2 and
   R-MIRROR-SEM whole. `rule-set.ts` is one of the 45 files under the frozen root. **Blocking (B2).**

### Secondary outcomes (no confirmatory claim)

1. **Trap rate:** share of cells whose final step fails a trap sub-goal of the task oracle, per arm, Wilson intervals;
   paired exact sign test over blocks.
2. **Functional acceptance:** the task tests pass at the final step, per arm. A tool arm that cuts D by breaking the
   task is reported as such.
3. **Repair:** findings pushed or pulled and absent at a later step; edits from finding to fix.
4. **Attribution (combined arm):** for each finding that disappears, the channel that reported it first (push, pull,
   both), from the hub's one ledger.
5. **Exploratory and advisory rows:** per-row counts per arm of H11-d, H06, FF-S03 and FF-P02.
6. **Cost:** turns, calls (generator and judge), wall time, tool calls and hook events per cell.
7. **Per-sub-shape view of H11:** new identities per arm by R-MIRROR2 shape word (descriptive only; see B1).
8. **R-MIRROR-SEM (H11-SEM), registered secondary (option A, pending author confirmation).** D_sem: new R-MIRROR-SEM
   identities against the seed, per cell, defined as D_hx. Same block-level exact sign-flip, reported with its p and
   no decision weight, never added to D_hx. Scoring condition: the scorer's replay judge answers only from the hub's
   cache; a candidate with no cached answer is a miss and does not fire (`scorerJudgeFromEnv`, `mirror-sem.ts`). `none`
   sessions have no hub, so every `none` candidate would be a miss. D_sem is therefore scored with
   `DAEDALUS_MIRROR_SEM=live` (misses asked, ledger kept) on both arms, under the call cap of §9. **B6.**

## 2. Design

| Item | Value |
|---|---|
| Arms | `none`: the HEXDDD-01 frame and the frozen argv, byte-identical to TRAPRATE-01 and the first study. `combined`: `experiments/v15-delivery/hint-audit/frame-combined.txt` (the first study's frame, hint audit L3: 0 FAIL), the frozen argv plus the edit-gate `--settings` and the MCP config, push and pull through **one DeliveryHub** per session. The hub runs every scored Hexagonal rule (`scoredRules('hexagonal')`), and its R-MIRROR-SEM judge (`claude-opus-5-5`, Claude CLI route, disk cache by content hash) is live |
| Tasks | 13: `experiments/hx-study-set/` parts A and B, 9 tasks (vendor literals ×3, vendor error codes ×2, renamed copy ×2, HTTP detail ×2), plus 4 tasks of `experiments/trap-families/`: f14-hex-geocoding, f16-hex-fx-rates, f24-hex-laundry-lockers, and **f13 as briefed, which is `f13-ddd-bike-repairs`, a DDD task (B4)** |
| Seal | the 13 task folders (seed, steps, tests, oracle, spec) sealed before registration: slot §9 |
| Start state | each task's seed, pinned by tree sha256 |
| Steps | each task's `tasks.json` steps, verbatim, one step per turn, 0 repair turns |
| Replicates | r per task and arm, from §3 |
| Block | task × replicate: one `none` cell and one `combined` cell from the same seed |
| Order | mulberry32 shuffle, seed `20261030`, interleaved by replicate round (every task and arm once before the next round) |
| Generator | `claude-sonnet-5-5`; CLI version read before every turn; a change is a stop |
| Isolation | the first study's (generator uid, root-only clone and records, listing check, fingerprint sweep with a positive control, the one READ probe; the scripted S4 checks of the combined design). No escape or tamper prompt to any model |
| Driver | `experiments/v15-study/run-study.ts`, sessions run **detached** (`nohup … &`, RUNBOOK §4), because the tool that launches a command ends it after 2 h (first study, DEV-2.1) |
| Records | every session's step trees kept and committed with the results (first study, DEV-2.2: trees were lost); per-turn and per-call `*.jsonl` committed (needs a `.gitignore` exception: `*.jsonl` is ignored, line 60, and only some result folders are excepted) |

## 3. Sample size

**Sources.**

| Figure | Value | Source |
|---|---|---|
| TRAPRATE-01 Hexagonal trap-failed runs | 8 of 26 (0.31 [0.17, 0.50]) | `Docs/DiagnosticRuns/traprate-01-2026-10-28.md`, Results |
| TRAPRATE-01 tasks that failed a trap | f2, f14, f16, f24 (2/2 each); 9 of 13 never | `results/v1.5-traprate-01/scores/summary.md` |
| TRAPRATE-01 Hexagonal trapped runs flagged by admitted rules | 2 of 5 (0.40) | TRAPRATE-01, graph-against-imports table |
| TRAPRATE-01 vocabulary failures the then-admitted rules missed | 4 of 8 (f2, f14), all fired by the R-MIRROR development checks | TRAPRATE-01, "Hexagonal trap failures the rules did not see" |
| Pilot ladder trap rate, L2 / L3 (pooled, 6 pilot tasks) | 4/12 = 0.33 / 7/12 = 0.58 | `Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md` §4 |
| Pilot ladder: tasks in band at some level | 3 of 6 | same, §6 |

**Model.** Per task t a cell traps with probability p_t; a trapped cell is seen by the counted rules with probability
q; a seen `none` cell has one new counted identity; in a `combined` cell each identity is kept with probability RR.
Arms draw independently. 400 planted data sets per row, the §1 decision rule in full ((a), (b), (c)). Code:
`scripts/v1.5/lib/hx-study-analyse.ts` (`plantedHx`, `powerHx`); run: `npx tsx scripts/v1.5/hx-study-analyse.ts --power
--draws 400 --out results/v1.5-hx-prereg/power` (zero calls; output `results/v1.5-hx-prereg/power/power.md`). Turns =
13 × r × 2 × 3 steps.

Scenarios: **A** all 13 tasks at p = 0.31 (TRAPRATE-01); **B** 8 tasks at 0.33 (ladder L2), 5 at 0, the floor that
pilot gate (c) admits; **C** 8 tasks at 0.58 (ladder L3), 5 at 0. q = 0.4 (TRAPRATE-01, 2/5) or 1 (upper bound: every
trap is seen, which the v1.5.5 H11 rules aim at but no agent data has shown).

| Scenario | q | r | Turns | Power RR 0.5 | Power RR 0.25 | Null: false "supported" | Median tasks with nonzero sum (RR 0.25) |
|---|---|---|---|---|---|---|---|
| A | 0.4 | 4 | 312 | 0.05 | 0.17 | 0.000 | 6 |
| A | 0.4 | 6 | 468 | 0.07 | 0.26 | 0.000 | 7 |
| A | 0.4 | 8 | 624 | 0.15 | 0.42 | 0.013 | 8 |
| A | 0.4 | 10 | 780 | 0.16 | 0.56 | 0.000 | 9 |
| A | 1 | 4 | 312 | 0.22 | 0.59 | 0.003 | 10 |
| A | 1 | 6 | 468 | 0.30 | 0.85 | 0.010 | 11 |
| A | 1 | 8 | 624 | 0.42 | 0.92 | 0.007 | 11 |
| A | 1 | 10 | 780 | 0.54 | 0.95 | 0.005 | 12 |
| B | 0.4 | 4 | 312 | 0.01 | 0.03 | 0.005 | 4 |
| B | 0.4 | 6 | 468 | 0.04 | 0.10 | 0.005 | 5 |
| B | 0.4 | 8 | 624 | 0.07 | 0.18 | 0.000 | 5 |
| B | 0.4 | 10 | 780 | 0.06 | 0.23 | 0.003 | 6 |
| B | 1 | 4 | 312 | 0.11 | 0.29 | 0.003 | 6 |
| B | 1 | 6 | 468 | 0.14 | 0.48 | 0.003 | 7 |
| B | 1 | 8 | 624 | 0.15 | 0.56 | 0.000 | 7 |
| B | 1 | 10 | 780 | 0.23 | 0.69 | 0.003 | 7 |
| C | 0.4 | 4 | 312 | 0.04 | 0.14 | 0.010 | 5 |
| C | 0.4 | 6 | 468 | 0.08 | 0.28 | 0.013 | 6 |
| C | 0.4 | 8 | 624 | 0.12 | 0.43 | 0.000 | 7 |
| C | 0.4 | 10 | 780 | 0.14 | 0.54 | 0.003 | 7 |
| C | 1 | 4 | 312 | 0.31 | 0.72 | 0.003 | 7 |
| C | 1 | 6 | 468 | 0.41 | 0.83 | 0.003 | 8 |
| C | 1 | 8 | 624 | 0.53 | 0.92 | 0.005 | 8 |
| C | 1 | 10 | 780 | 0.65 | 0.94 | 0.005 | 8 |

Reading: the study can detect a strong effect (RR ≈ 0.25) only if most traps are seen by the counted rules (q near 1)
and more than the 8-task floor trap; a halving (RR 0.5) is out of reach at every r here. With only 8 trapping tasks,
condition (c) needs nearly every one of them to point the same way, which caps power in B and C. The planted false
"supported" rate under the null stays ≤ 0.013 in every row.

**Provisional r = 8** (624 study turns): ≥ 0.92 at RR 0.25 in A and C with q = 1; 0.56 in B. **Final r by a rule fixed
now, applied to the agent pilot's `none` cells** (`sizeFromPilot`, same lib): each task's chance of a `none` cell with
D_hx > 0 is the Jeffreys posterior mean (k + 0.5)/(n + 1) of its 2 pilot runs; identities per seen cell = the mean D_hx
of the pilot's `none` cells with D_hx > 0, rounded, at least 1; q = 1 (detection is inside D_hx). r is the smallest of
{6, 8, 10} with power ≥ 0.80 at RR 0.25 (400 draws); if none reaches it, r = 10 and the achieved power is stated in §9
before any study call. The pilot is not study data and is never pooled with it.

**No task is dropped** after the pilot on `none`-arm data (as in the first study, §3).

## 4. Analysis plan

Scoring once, at the frozen root, by the study scorer (`experiments/v15-study/score-study.ts`, after B1 and B2 are
fixed; sha256 slot §9). Analysis by `scripts/v1.5/hx-study-analyse.ts` with its lib, tested on planted data before
registration (§9).

- **Test.** d_b = D_b(combined) − D_b(none); T = Σ d_b; paired two-sided sign-flip, exact p over all 2^N patterns
  (`exactSignFlipP`), Monte Carlo with 99,999 draws, seed `20261030`, beside it. α = 0.05. Exact-p decisions govern.
- **Task level (§1 (c)).** Exact two-sided sign test over the nonzero task sums; n stated.
- **Robustness lines (no decision changes):** exact Wilcoxon signed-rank; exact sign test over blocks; run-order
  halves; drop flagged blocks; **drop tasks with no oracle trap failure in any cell of either arm**. The last replaces
  the first study's "drop blocks whose `none` cell has trap rate 0": that line conditions on one arm's outcome and is
  biased toward the predicted sign under the null. On this draft's planted null (scenario C, r = 8) it reads
  "supported" (p 2.4 × 10⁻⁷) while the primary and the symmetric line read "not rejected" (p 0.26); the unit test holds
  it over 100 null draws (`tests/unit/scripts/v1.5/hx-study-analyse.test.ts`). It is still printed, labelled biased,
  for comparison with the first study.
- **Effect sizes.** RR = ΣD(combined)/ΣD(none) and d̄, with 95 % within-task and task-cluster bootstrap intervals
  (10,000 resamples, seed `20261030`). Full per-block tables and P(D = 0) per arm with Wilson intervals, always.
- **Reading.** Not rejected means "no difference detected at the stated MDE", never "no effect".

## 5. Gates before the run (pre-written pass criteria)

### 5.1 Agent pilot

All 13 sealed tasks × 2 runs × both arms, from the seeds, with the study's driver, frames, hub and isolation; scored by
the study scorer. 13 × 2 × 2 × 3 = 156 turns. Pilot data is not study data. Every criterion must pass; any failure is a
stop and a report, and the fix is a dated note before the pilot is repeated.

| Gate | Pass criterion |
|---|---|
| (a) delivered = scored | In every `combined` pilot session the hub's rule list equals `scoredRules('hexagonal')` (Cypher and frozen), and on every step snapshot the hub's last check and the scorer give the same identities: 0 differences over all snapshots |
| (b) ledger completeness | Every identity the scorer finds on a `combined` step snapshot is in the hub ledger by the next push (or that turn's stop listing): 0 missing |
| (c) the `none` arm traps | At least 8 of the 13 tasks fail an oracle trap sub-goal in at least 1 of their 2 `none` runs |
| (d) the agent repairs | Of the counted-rule keys first exposed in the `combined` pilot sessions (push or pull), at least half are resolved (absent from a later push or pull check, or from the final snapshot) by the session's end, pooled; with fewer than 6 exposed keys the gate fails (nothing to show) |
| (e) acceptance holds | Tasks whose final tree passes the task tests in at least 1 of 2 runs: count under `combined` ≥ count under `none` − 1 |

### 5.2 Dress rehearsal (after the pilot passes)

2 tasks × 1 replicate × 2 arms (12 turns; cap 13 turns, 16 calls, as the first study's Stage 1), run exactly as the study: driver **detached**,
**session trees kept**, **per-turn jsonl committed**. Pass: the driver survives past the launching tool's 2 h limit or
is started detached by the RUNBOOK command; every session folder holds its step trees and they rebuild to the
recorded tree hashes; the jsonl files are in the results commit (`git ls-files`); the scorer runs on the committed
records alone.

## 6. Exclusions and deviations

- A session is redrawn whole only on an infrastructure state (harness error, envelope unreadable, model mismatch,
  container or coordinator restart, CLI version change, hub socket loss flagged by the integrity monitor). Agent
  behaviour is never grounds for a redraw. Caps are fixed in the input and never raised.
- Integrity: a `combined` session with fail-open above 5 % of edits, or edit count ≠ hook count, is kept (ITT) and
  flagged; a registered sensitivity drops flagged blocks.
- A block enters the contrast only if both cells have every step scored.
- Every change after registration is dated in this file before the data it would affect is seen.

*(No deviations: not registered.)*

## 7. Limitations, stated before the run

- One vendor (Claude Code); no placebo arm; seeded start (as the first study, §7).
- Small admission sets for some counted families: H11-a and H11-c have 2 positives each on HCAL-07 (regression rows);
  H11-b 6. H03 and H07 were re-admitted on one blind set at v1.5.5.
- The rule author curated the task set. Nine tasks are new; f14, f16 and f24 (and the fourth f-task, B4) were run
  in TRAPRATE-01 and in the first study's lane B, so their `none` behaviour at the earlier instrument is known.
  f16 was functional in 0 of 2 TRAPRATE-01 runs.
- With 13 tasks and at most 8 trapping ones expected at the gate floor, the task-level condition is demanding (§3).
- R-MIRROR-SEM is a model fact (`claude-opus-5-5`); in the `combined` arm the hub's judge answers live during the
  session, and the same judge scores D_sem. It shares a vendor with the generator.

## 8. What each result feeds (no dual submission)

| Result | Owner |
|---|---|
| H-HX and secondaries 1–7 | **AgentArch @ ICSA 2027 (proposed, pending author confirmation)**; thesis Kap9, SO5 |
| Secondary 8 (R-MIRROR-SEM) | **AgentArch (proposed, pending author confirmation)**; it is a neuro-symbolic fact, so NEMI is the alternative owner; one paper only |
| TRAPRATE-01, pilot ladder, agent pilot (not this study) | as already owned (TRAPRATE-01: AGENT @ ICSE 2027) |
| First study H1, H2 | unchanged (first study, §8) |

## 9. Slots (filled before the registration commit)

| Item | Value |
|---|---|
| Task seal (13 task folders) | **slot** (sha256 manifest and root, written after `experiments/hx-study-set/` parts A and B are built) |
| Step count per task | **slot** (3 assumed above; turns and caps scale with it) |
| r | provisional 8; final from §3's rule on the agent pilot: **slot** |
| Power at RR 0.25 for the final r | **slot** (`sizeFromPilot` output) |
| CLI version pin | **slot** (the first study pinned 2.1.312) |
| Caps, study | turns × 1.06, rounded up (infrastructure redraws only): at r = 8 and 3 steps, 624 turns, cap 662 turns; calls = turns cap + 2 smoke + 1 READ probe (RUNBOOK §2.3), so 665 |
| Caps, agent pilot | 156 turns, cap 166; calls cap 169 |
| Caps, dress rehearsal | 12 turns, cap 13; calls cap 16 |
| R-MIRROR-SEM judge calls (hub, `combined`; scorer, both arms) | **slot**: 1.5 × the pilot's judge calls per session × study sessions, fixed before the first study call |
| Script sha256 (first 16 hex) | `scripts/v1.5/hx-study-analyse.ts` 675e6d715cde6e03; lib `scripts/v1.5/lib/hx-study-analyse.ts` a1497e8e2513aba3 (this draft); `score-study.ts`, `run-study.ts`, `make-input.ts`: **slot** (after B1, B2) |
| Planted-effect test (zero calls) | effect, scenario C, q = 1, 2 identities per seen cell, r = 8, RR 0.25: 104 blocks, ΣD 84 → 17, RR 0.20 [0.11, 0.32], exact p 1.35 × 10⁻⁸, task sign 8 − / 0 +, p 7.8 × 10⁻³: **supported**. Null (same, RR 1): ΣD 84 → 68, exact p 0.26, task sign 5 − / 2 +: **not rejected**. Records `results/v1.5-hx-prereg/planted-effect/`, `planted-null/`; unit test `tests/unit/scripts/v1.5/hx-study-analyse.test.ts` (6 tests) |
| Pilot exit (§5.1 (a)–(e)) | **slot** |
| Dress rehearsal exit (§5.2) | **slot** |

## 10. Blocking items (registration waits for all)

| Id | Item | What closes it |
|---|---|---|
| **B1** | H11 sub-shapes cannot be told apart in scoring: the study scorer drops R-MIRROR2's evidence, and the shape word `[field]` fires on both c and d (and `[decl]` maps to no sub-shape) | an author decision on how sub-shape a–c findings are counted and d findings excluded, implemented and tested on HCAL-07's positives before registration; if it touches `src/v15-instrument`, the frozen root changes and admission evidence must be re-checked at the new root |
| **B2** | `admittedRules('hexagonal')` is row-level: it counts FF-S03 and FF-P02 and cannot hold "H11 a–c only" | a counted-rule list for this study, decided by the author: inside `rule-set.ts` (new root) or in the study scorer (root `098d67bd…` kept) |
| **B3** | R-MIRROR (H11) has no shape word; at HCAL-07 its 3 hits on positives are all on d cases (kennel-boarding H11-pos3, locksmith-dispatch H11-pos3 and H11-pos4); 0 FP | decide whether R-MIRROR is counted, exploratory, or split |
| **B4** | `f13` in the brief is `f13-ddd-bike-repairs` (DDD). The four Hexagonal tasks that failed a trap in TRAPRATE-01 are f2-hex-vendor-port, f14, f16 and f24 | the author names the fourth task |
| **B5** | `experiments/hx-study-set/` is not on `main`; the 9 tasks are being built | build, seal, fill the seal slot |
| **B6** | D_sem needs live judge calls at scoring for both arms (replay misses never fire in `none`) | confirm option A and fix the judge-call cap |
| **B7** | Admission decisions not recorded: `ADMITTED_HEX_ROWS` is unchanged and the HCAL-07 report leaves admission to the author (H11-a, b, c; H03 and H07 at v1.5.5) | author confirmation, recorded in the decision register |
| **B8** | Records: `*.jsonl` is ignored (`.gitignore` line 60) with per-folder exceptions only; RUNBOOK §2.6 copies "no trees" | a `.gitignore` exception for this study's results and a RUNBOOK change keeping trees; checked by the dress rehearsal |

Pending author confirmation (not defects): option A for R-MIRROR-SEM (§1, secondary 8), AgentArch ownership (§8),
provisional r = 8 (§3).

## Changelog

- 2026-10-30: draft written; not registered. Analysis script adapted and tested on planted data, zero model calls.
