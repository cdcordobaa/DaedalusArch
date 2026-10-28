# v1.5 final study pre-registration: combined delivery on DDD and Hexagonal trap tasks (Claude Sonnet)

**Status: DRAFT, not registered.** Written 2026-10-28, before any final-study call. The placeholders in §9 are filled
from TRAPRATE-01 (task screening, arm `none` only) and the Stage 1 pilot before the registration commit. After that
commit, any change is a dated deviation (§6).

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

Admitted rules (fixed by the sealed admissions; the study runs at rule hash `b39b8b67…`, `main` 1e74e90f0, the HCAL-03 seal; the CAL-03 record re-run under it is identical to its sealed record):

| Style | Rows | Rules counted |
|---|---|---|
| DDD | K01 K02 K03 K05 K10 K13 K14 K15 K16 | FF-DS02; FF-DT04, FF-S01, FF-S03, R-H5, R-PURE; R-D4; R-XCTX; **R-D5S only** for K10; R-H5; R-D9; R-INJ; R-REF |
| Hexagonal | H01 H02 H03 H04 H05 H07 H09 H10 | FF-S01, FF-S03, FF-S04, FF-P01, FF-P02, FF-P03; R-INJ; R-AXA; R-H5; R-TRANSPORT; R-COREIO; R-ENTITY-OUT |

The rules of rows not admitted (DDD K04 K06 K07 K08 K09 K11 K12; Hexagonal H06 H08) run and are reported as
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

## 2. Design

| Item | Value |
|---|---|
| Arms | `none`: the HEXDDD-01 frame and the frozen argv, byte-identical to TRAPRATE-01. `combined`: `experiments/v15-delivery/hint-audit/frame-combined.txt` (hint audit L3: 0 FAIL), the frozen argv plus the edit-gate `--settings` and the MCP config, served by one delivery hub per session |
| Tasks | `study-set.json` confirmatory: 12 DDD, 13 Hexagonal (f19 moved in on 2026-10-28; f19 and f24 clean references corrected the same day, before any final-study call) |
| Start state | each task's seed (S2, seeded), pinned by tree sha256 |
| Steps | each task's `tasks.json` steps, verbatim, one step per turn, 0 repair turns |
| Replicates | **r** per task and arm (§9) |
| Block | task × replicate: one `none` cell and one `combined` cell from the same seed |
| Order | mulberry32 shuffle, seed `20261029`, interleaved by replicate round (every task and arm once before the next round) |
| Generator | `claude-sonnet-5-5`; CLI version read before every turn, a change is a stop |
| Isolation | TRAPRATE-01's: uid 1500 generator, root-only clone and records, listing check and fingerprint sweep with a positive control, the one READ probe; plus the scripted S4 checks of the combined design §6. No escape or tamper prompt to any model |
| Driver | `experiments/v15-study/run-study.ts` (§9: sha256) |

## 3. Sample size

- **Exactness.** With m tasks, the task-level two-sided sign-flip cannot go below 2/2^m: 4.9 × 10⁻⁴ for 12 tasks,
  well under Holm's 0.025. The block-level test has N = m × r blocks per style.
- **Power** is computed before registration from TRAPRATE-01's per-task trap rates (the `none` arm's opportunity) and
  Stage 1's per-cell D, by the 2b P3 method at task grain, for RR ∈ {0.25, 0.5}. r is the smallest value in {2, 3, 4}
  with power ≥ 0.80 at RR 0.5 in both styles, capped by the time budget (results closed by 2026-11-01). If no r
  reaches 0.80 within the budget, r = the largest that fits, and the achieved power is stated (§9).
- **Tasks with no opportunity.** A task where TRAPRATE-01 found the trap in 0 of 2 `none` runs stays in the study: the
  population is the sealed set, and dropping tasks after seeing `none` data would select on the outcome. Its share is
  reported.

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
   the labels per admitted row; (b) on every DDD study snapshot, with agreement against the declared-root findings
   (identical findings share, Cohen's κ per identity). Configuration: the Claude CLI judge route, model and pin
   recorded; 2 runs per tree, a root counts only when named in both. Cap fixed before the first call (§9).
   **Registered reading:** "facts supplied by the model preserve the admitted rules' results" when CAL-03 recall
   stays ≥ 0.90 pooled with 0 incorrect findings, and agreement on study snapshots is ≥ 0.90.
2. **N2, D_sem on the rule-blind rows.** The C4 interpretation with the U3 rubric on the study's final snapshots, for
   the meaning-level rows no admitted rule covers (H06, K11, K12). **Precondition:** a pilot on TRAPRATE-01 outputs
   against a 30-item author audit made before the pilot is run: ≥ 0.80 agreement and 0 hallucinated citations. If the
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
| H1, H2 and the secondary outcomes 1–6 | AgentArch @ ICSA 2027 (spec and its delivery to agents); thesis Kap9, SO5 |
| N1, N2 | ICSA 2027 NEMI (rules decide, models supply facts); thesis Kap6, SO3 |
| TRAPRATE-01 (not this study) | AGENT @ ICSE 2027 |
| SO4 hold-out | thesis Kap7, SO4 |

## 9. Placeholders (filled before the registration commit)

| Item | Value |
|---|---|
| r | from §3 |
| Power at RR 0.5 and 0.25, per style | from §3 |
| CLI version pin | from Stage 1 |
| `run-study.ts`, `score-study.ts`, analysis script sha256 | at the registration commit |
| Caps per phase | turns × 1.06 (infrastructure redraws only) |
| N1 call cap | 2 × trees × 1.5 |
| Stage 1 exit (combined design §8 criteria 1–5) | pass / fail |

## Changelog

- 2026-10-28: draft written before any final-study call.
