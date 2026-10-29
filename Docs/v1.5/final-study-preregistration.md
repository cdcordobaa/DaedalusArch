# v1.5 final study pre-registration: combined delivery on DDD and Hexagonal trap tasks (Claude Sonnet)

**Status: REGISTERED 2026-10-29**, before any final-study call, by the commit that merges this file to `main`.
Every change after it is a dated deviation (§6). The placeholders of §9 are filled from TRAPRATE-01 (task screening,
arm `none` only) and the Stage 1 pilot.

Sources: `ops/notes/v15-final-study-draft.md` (draft v0), `ops/notes/v15-combined-delivery-design-2026-10-26.md`,
`Docs/DiagnosticRuns/v15-cal03-admission-2026-10-28.md`, `Docs/DiagnosticRuns/v15-hcal03-admission-2026-10-28.md`,
`experiments/trap-families/study-set.json`, `Docs/v1.4/study2b-preregistration.md` (whose test, identity rule and
reporting rules are reused unless stated).

## 1. Hypotheses

D is a count of new violations, so lower is better. The population is the 25 sealed trap-family tasks, Claude Sonnet
through Claude Code, from each task's fixed seed.

| Id | Style | Contrast | Predicted direction | Test |
|---|---|---|---|---|
| **H1** | DDD (12 tasks) | `combined` vs `none` | D(combined) **<** D(none) | two-sided (§4) |
| **H2** | Hexagonal (13 tasks) | `combined` vs `none` | D(combined) **<** D(none) | two-sided (§4) |

- **Supported** only if all hold: (a) rejected after Holm over {H1, H2} under the block-level exact sign-flip; (b) the
  estimate has the predicted sign; (c) the task-level sign-flip over the task sums has the same sign. If (a) and (b)
  hold and (c) does not, it is reported as "carried by a subset of tasks".
- **What H1 and H2 test.** "Delivering the declared spec's findings to the agent, on request (pull) and after every
  file edit (push), reduces new violations of the admitted rule families." The arm differs from `none` by the tool,
  the hooks and one disclosure sentence together; which part did the work is descriptive (§3, attribution).
- **Styles are not pooled.** Their admitted rule families differ.

### Primary outcome: D_v15

> **D_v15** per cell: distinct violation identities of the **admitted rules** present at step j (1 ≤ j ≤ 3) and absent
> from the task seed and from every earlier step of that cell, summed over the steps. Identity: rule + file + subject,
> under Study 2b's rename rule (ρ from `git diff -M50%`). Every snapshot is scored (ITT).

Admitted rules (fixed by the sealed admissions; the study runs at `main` `ea0da2b61`, rule hash `761f37d9…`, the
HCAL-05 seal; the CAL-03, HCAL-03 and HCAL-04 records re-run at it are identical to their sealed records on every
admitted row):

| Style | Rows | Rules counted | Admission |
|---|---|---|---|
| DDD | K01 K02 K03 K05 K10 K13 K14 K15 K16 | FF-DS02; FF-DT04, FF-S01, FF-S03, R-H5, R-PURE; R-D4; R-XCTX; **R-D5S only** for K10; R-H5; R-D9; R-INJ; R-REF | CAL-03, 36/36 |
| Hexagonal | H01 H02 H03 H04 H05 H07 H08 H09 H10 | FF-S01, FF-S03, FF-S04, FF-P01, FF-P02, FF-P03; R-INJ; R-AXA; R-H5; R-TRANSPORT; R-LOCATOR; R-COREIO; R-ENTITY-OUT | HCAL-03 32/32, HCAL-04 (H08) 4/4 |

The rules of rows not admitted (DDD K04 K06 K07 K08 K09 K11 K12; Hexagonal H06 R-ADAPTER-RULE, H11 R-MIRROR) run, are
delivered by the tool like every rule, and are reported as
exploratory. They never enter D_v15.

### Secondary outcomes (no confirmatory claim, no Holm)

1. **Trap rate:** the share of cells whose final step fails a trap sub-goal of the task oracle, per arm and style,
   with Wilson intervals; paired exact sign test over blocks.
2. **Functional acceptance:** the task tests pass at the final step, per arm. A tool arm that cuts D by breaking the
   task is reported as such.
3. **Repair:** findings pushed or pulled and then absent at a later step; edits from finding to fix.
4. **Attribution (combined arm):** for each finding that disappears, the channel that reported it first (push, pull,
   both), from the hub's one ledger.
5. **Exploratory rows:** per-row counts of the non-admitted rules, per arm.
6. **Cost:** turns, calls, wall time, tool calls and hook events per cell.
7. **Graph against imports (zero calls).** Every stored snapshot is scored twice: by the frozen v1.4 import-level
   instrument (D_frozen, tag `v1.4-freeze-2026-10-20`) and by the admitted graph rules (D_v15). Reported per arm and
   style: the identities only the graph rules see, only the import rules see, and both, with the share of the
   `none` arm's oracle trap failures each instrument flags. No agent re-run.

## 2. Design

| Item | Value |
|---|---|
| Arms | `none`: the HEXDDD-01 frame and the frozen argv, byte-identical to TRAPRATE-01. `combined`: `experiments/v15-delivery/hint-audit/frame-combined.txt` (hint audit L3: 0 FAIL), the frozen argv plus the edit-gate `--settings` and the MCP config, served by one delivery hub per session |
| Tasks | `study-set.json` confirmatory: 12 DDD, 13 Hexagonal (f19 moved in on 2026-10-28; f19 and f24 clean references corrected the same day, before any final-study call) |
| Start state | each task's seed (S2, seeded), pinned by tree sha256 |
| Steps | each task's `tasks.json` steps, verbatim, one step per turn, 0 repair turns |
| Replicates | r = 3 (DDD) and r = 6 (Hexagonal) per task and arm (§3) |
| Block | task × replicate: one `none` cell and one `combined` cell from the same seed |
| Lanes | two cloud containers run in parallel, one per style: lane A the 12 DDD tasks (H1), lane B the 13 Hexagonal tasks (H2). One phase per container (`experiments/v15-study/RUNBOOK.md`) |
| Order | per lane, mulberry32 shuffle, seed `20261029`, interleaved by replicate round (every task and arm of the lane once before the next round) |
| Generator | `claude-sonnet-5-5`; CLI version read before every turn, a change is a stop |
| Isolation | TRAPRATE-01's: uid 1500 generator, root-only clone and records, listing check and fingerprint sweep with a positive control, the one READ probe; plus the scripted S4 checks of the combined design §6. No escape or tamper prompt to any model |
| Driver | `experiments/v15-study/run-study.ts` (§9: sha256) |

## 3. Sample size

**Screening (TRAPRATE-01, arm `none` only, 2 runs per task, not study data; `results/v1.5-traprate-01/scores/`).**

| Style | Runs | Oracle trap failed | Steps with a new admitted identity | Mean D_v15 per run | Tasks never trapped |
|---|---|---|---|---|---|
| DDD | 24 | 21 (0.88) | 24 of 72 (0.33) | 2.17 | 1 of 12 |
| Hexagonal | 26 | 8 (0.31) | 4 of 78 (0.05) | 0.15 | 9 of 13 |

- **Exactness.** With m tasks the task-level two-sided sign-flip cannot go below 2/2^m: 4.9 × 10⁻⁴ for 12 tasks.
- **Power** by resampling each task's observed `none` D (2 runs per task) and thinning it to the combined arm with
  keep probability RR, 400 draws per cell, the §4 decision rule (Holm, sign, task-level sign):

| Style | r | Power at RR 0.5 | Power at RR 0.25 |
|---|---|---|---|
| DDD | 3 | 1.00 | 1.00 |
| Hexagonal | 3 | 0.00 | 0.00 |
| Hexagonal | 4 | 0.04 | 0.41 |
| Hexagonal | 6 | 0.38 | 0.95 |

  The DDD figure is optimistic (two runs per task understate within-task variance). The Hexagonal figure reflects
  that the agent alone seldom violates the admitted Hexagonal rules on these tasks.
- **Decision (2026-10-28, before any final-study call): r = 3 for DDD (lane A, 216 turns) and r = 6 for Hexagonal
  (lane B, 468 turns).** H2 is kept confirmatory with its achieved power stated: it can detect a strong effect
  (RR ≈ 0.25) and is unlikely to detect a halving. A non-rejected H2 is read as "no difference detected at RR ≈ 0.25".
- **No task is dropped.** Dropping tasks on `none`-arm data and then re-measuring `none` on them would bias the
  baseline upward. The 9 Hexagonal tasks that never trapped, and the three tasks functional in 0 of 2 screening runs
  (t08 `f13-ddd-bike-repairs`, t10 `f26-ddd-brewery`, t16 `f16-hex-fx-rates`), stay in; functional acceptance is
  reported per task.

## 4. Analysis plan

Scoring once, at the frozen rule hash, by `experiments/v15-study/score-study.ts`; analysis by the script in §9, tested
on a planted effect before registration.

- **Test.** For H1 and H2: d_b = D_b(combined) − D_b(none); T = Σ d_b; paired two-sided sign-flip, exact p over all
  2^N patterns (Monte Carlo with 99,999 draws, seed `20261029`, beside it); Holm over {H1, H2} at α = 0.05; exact-p
  decisions govern.
- **Task level (registered for (c)).** The same test on the m task sums.
- **Robustness lines** (no decision changes): exact Wilcoxon signed-rank, exact sign test, run-order halves, the
  drop-blocks-with-no-trap sensitivity (blocks whose `none` cell has trap rate 0).
- **Effect sizes.** RR = ΣD(combined)/ΣD(none) and d̄, with 95 % within-task and task-cluster bootstrap intervals
  (10,000 resamples, seed `20261029`). Full per-block tables and P(D = 0) per arm with Wilson intervals, always.
- **Reading.** Not rejected means "no difference detected at the stated MDE", never "no effect".

### Neuro-symbolic secondary (registered, no Holm, no confirmatory claim)

Runs after the study, on stored snapshots, with no agent re-run. It answers "do models supply facts the rules can
use?" (thesis SO3, Kap6).

1. **N1, model-supplied facts.** S3 names the aggregate roots from the code alone. The admitted DDD rules are re-run
   with S3's roots in place of the spec's declared roots: (a) on the sealed CAL-03 cases, with recall and FP against
   the labels per admitted row; (b) on every DDD study snapshot, with agreement against the declared-root findings: the
   **identical-findings share** (identities found under both root sources over identities found under either), with
   Cohen's κ over tree × admitted-rule cells (finding present or absent) beside it. Configuration: S3's U4
   configuration (prompt `u4-s3-facts-v1`, `claude-sonnet-5-5`, Claude CLI judge route), CLI version and route
   recorded; 2 runs per tree, a root counts only when named and grounded in both. On CAL-03, S3 runs once per domain
   on the base tree (no case changes the spec, so the roots are a property of the base). Runner
   `experiments/v15-n1/`; caps in `experiments/v15-n1/caps.json` (CAL-03: 6). A spec invariant whose owner is not a
   root S3 names is dropped and reported.
   **Registered reading:** "facts supplied by the model preserve the admitted rules' results" when CAL-03 recall
   stays ≥ 0.90 pooled with 0 incorrect findings on the admitted rows' clean cases, and the identical-findings share on
   study snapshots is ≥ 0.90.
2. **N2, D_sem on the rule-blind rows.** The C4 interpretation with the U3 rubric on the study's final snapshots, for
   the meaning-level rows no admitted rule covers (H06, K11, K12). **Precondition:** a pilot on TRAPRATE-01 outputs
   against the author's audit of the 27 items drawn by the procedure committed before the draw
   (`experiments/v15-n2/README.md`, seed 20261028; the procedure yielded 27 distinct candidates, not the planned 30),
   answered before the pilot is run: ≥ 0.80 agreement and 0 hallucinated citations. If the
   precondition fails, N2 is reported as "not run" and the pilot result is reported.

### SO4 hold-out (separate, zero calls)

The sealed DETECT-02 held-out (`experiments/detect-02-heldout/SEAL.md`) is scored once inside the study window, at the
same rule hash, under its own bars. It is reported beside the study and is not an outcome of H1 or H2.

## 5. Exclusions

- A session is redrawn whole only on an infrastructure state (harness error, envelope unreadable, model mismatch,
  container restart, CLI version change, hub socket loss flagged by the integrity monitor). Agent behaviour is never
  grounds for a redraw. Caps per phase are fixed in the input and never raised.
- **Integrity:** a combined session with fail-open above 5 % of edits, or edit count ≠ hook count, is kept (ITT) and
  flagged; a registered sensitivity drops flagged blocks.
- A block enters a contrast only if both cells have every step scored.

## 6. Deviations

Every change after the registration commit is dated in this file before the data it would affect is seen.

- **DEV-1 (2026-10-29, before any D_sem call and before any final-study output is scored).** N2's reference changes
  from the author's audit to a **model panel**: three independent sessions (two `claude-fable-5-1`, one
  `claude-opus-5-5`), each given only the 27 items of `experiments/v15-n2/audit-items.json` and the construct text,
  blind to D_sem, to each other and to any rule finding, each answering yes / no / unsure per item. The reference
  label is the majority (2 of 3); an item without a majority, or with a majority of "unsure", is excluded and counted.
  The panel's own agreement (Fleiss' κ and pairwise raw agreement) is reported. The precondition bar is unchanged
  (≥ 0.80 agreement with the reference, 0 hallucinated citations). **Reading narrowed:** N2 then measures agreement of
  D_sem with an independent model panel, not with a human; because D_sem's interpreter and one rater share a model
  family, this is stated as a limit. Any author answers given later are reported as a human spot-check beside it.
  Reason: author time this week goes to the papers; the author asked for a model consensus instead.
- **DEV-2 (2026-10-29, after both lanes were scored by `score-study.ts`, before `final-study-analyse.ts` is run).**
  Two procedural facts of the run, neither of which changes a hypothesis, a test, a threshold or an exclusion:
  1. *Coordinator restart.* In each lane the coordinator stopped the first `--sessions` launch once, because the tool
     that held it ends a command after 2 h, and restarted it detached with `--sessions --resume`. The call in flight
     was recorded as `lost-in-restart` and its session redrawn whole: lane A c007 → c073, lane B c001 → c157 (reason
     "unfinished at restart", `run/redraws.jsonl`). §5 lists "container restart" among the infrastructure states; this
     restart is read as one. The lost session has no `session.json` and is not scored. One call per lane is lost
     inside the caps.
  2. *Snapshots not retained.* The RUNBOOK copied no session trees into the results, so the lanes keep scores,
     hook logs and run records but not the code. Consequences: secondary 7 (graph against imports) is unaffected,
     since `score-study.ts` computed `D_frozen` on every snapshot during scoring; **N1(b)** (study snapshots) is
     reported as "not run" and N1 rests on (a), CAL-03; N2 was already "not run" by its precondition; the SO5
     taxonomy uses the final study's scored identities as evidence-only cards (no hunk).
  Disclosure: while checking the score file's layout for this note, the coordinator saw the per-arm summary block of
  lane B's `scores.json` (mean Y and trap-fail counts per arm). No D contrast, p value or effect size was computed.

## 7. Limitations, stated before the run

- One vendor (Claude Code): the hooks exist only there, so the combined result is scoped to it.
- The tool, the hooks and the disclosure sentence are delivered together (no placebo arm).
- The rule author also curated the task set; the tasks were built by blind sessions and their traps were checked for
  visibility before the admissions were scored.
- Seeded start: the estimate is "spread and repair from a fixed seed", not organic greenfield drift.
- MEAN-01 meaning labels: none. Whether a finding means an architectural problem rests on the admission sets'
  construct labels and the oracles.
- Admitted families cover 9 of 16 DDD and 8 of 10 Hexagonal rows; the rest are exploratory.

## 8. What each result feeds (no dual submission)

| Result | Owner |
|---|---|
| H1, H2 and the secondary outcomes 1–7 | AgentArch @ ICSA 2027 (spec and its delivery to agents); thesis Kap9, SO5 |
| N1, N2 | ICSA 2027 NEMI (rules decide, models supply facts); thesis Kap6, SO3 |
| TRAPRATE-01 (not this study) | AGENT @ ICSE 2027 |
| SO4 hold-out | thesis Kap7, SO4 |

## 9. Placeholders (filled before the registration commit)

| Item | Value |
|---|---|
| r | 3 (DDD), 6 (Hexagonal): §3 |
| Power at RR 0.5 and 0.25, per style | §3 |
| CLI version pin | 2.1.312 (TRAPRATE-01 and Stage 1); the driver stops on a change |
| Script sha256 (first 16 hex) | `run-study.ts` c770618bb1fd5185; `make-input.ts` 2d5931676940c942; `score-study.ts` cbe12bb9d6d621e3; `scripts/v1.5/final-study-analyse.ts` 1d4bcdf7a83fac5f; its lib a57b8598f3b93a35 |
| Caps per phase | turns × 1.06 (infrastructure redraws only) |
| N1 call cap | CAL-03: 6 (`experiments/v15-n1/caps.json`); study snapshots: 2 × trees × 1.5, fixed by `--estimate` before the first call |
| Stage 1 exit (combined design §8 criteria 1–5 and stage1-plan.md) | pass, all 7 (`results/v1.5-study/stage1/README.md`, branch `results/v15-stage1`) |

## Changelog

- 2026-10-29: DEV-2 (coordinator restart read as an infrastructure state; snapshots not retained, N1(b) not run).
- 2026-10-29: registered. Families final after CAL-03, HCAL-03, HCAL-04 and HCAL-05; size from TRAPRATE-01; Stage 1 passed.

- 2026-10-28: draft written before any final-study call.
