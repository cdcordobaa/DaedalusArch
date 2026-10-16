# Study 2 power simulation: notes

> **Informal design aid, not a pre-registration.** Written on 2026-10-15 to inform the Study 2 design questions of
> `Docs/v1.3/study2-outline.md` §6. By the author's decision nothing is pre-registered yet. Nothing here is binding,
> hashed or listed in `corpus/prereg.json`, and no prereg tooling was touched. Every input is a working guess, to be
> replaced by pilot estimates (on non-study tasks) before any registration. No sealed task is named, paraphrased or
> used: the simulation draws synthetic counts only.

Script: `scripts/v1.3/study2-power.ts` (model and analysis in `scripts/v1.3/lib/study2-power.ts`, unit tests in
`tests/unit/scripts/v1.3/study2-power.test.ts`). Full output of the run quoted below:
`results/v1.3-study2-power/power.md` and `power.json`.

```
npx tsx scripts/v1.3/study2-power.ts --sims 400 --flips 999 --seed 20261015 \
  --out results/v1.3-study2-power/power.json --md-out results/v1.3-study2-power/power.md
```

400 simulated studies per cell, so a power figure has a Monte Carlo SE of at most 0.025.

## 1. What is simulated

Arms `none`, `gate` and `daedalus-mcp` (`mcp` below), run in blocks of task × model × replicate with every arm in a
block (outline §5.1). Per run and step s = 1..k:

- a run multiplier `exp(u_task + v_model + w_run)`, lognormal; the task and model terms are shared by the arms of a
  block, the run term is not;
- a task-specific erosion slope `slopePerStep · exp(g_task)`, shared by the arms;
- an arm effect: a **relative reduction of the erosion slope** (0.5 halves it), varied across tasks by an
  arm × task interaction term;
- the expected count `multiplier · (baseCount + slope · (1 − reduction) · (s − 1))`, and the observed blocking count
  Poisson or negative binomial around it.

**Fallback outcome** (if blocking counts are too sparse): advisory violations per KLOC, with the run's size growing
linearly per step (lognormal noise), a density that grows per step, and an arm effect on the advisory rules that is a
fraction (`advisorySpillover`) of the blocking effect, because `gate` shows blocking findings only.

**Analysis** (outline §5, candidate 1): one OLS slope per run; the within-block difference arm − `none`; a paired,
two-sided sign-flip permutation test of the mean difference; Holm over the two contrasts (`gate` vs `none`, `mcp` vs
`none`) at α = 0.05. Two variants:

- **block level**: each block's difference is a unit (signs flipped per block);
- **task level**: differences are averaged per task first and signs are flipped per task, which is what treating the
  task as the cluster (outline §5.3) comes to with this few tasks.

The GLMM of outline §5.2 is not simulated; it uses the same information and would not escape the task-count limit
below.

## 2. Assumptions (all working guesses)

| Parameter | Value | Note |
|---|---|---|
| Blocking violations at step 1, arm `none` | 1.5 (mean) | small greenfield project after step 1 |
| New blocking violations per step, arm `none` | 1.0 (mean) | the erosion slope; sensitivity 0.5 and 2 |
| Log-scale SD: task / model / run | 0.5 / 0.3 / 0.4 | sensitivity: run SD 0.7 |
| Log-scale SD of the task's slope | 0.3 | |
| Count distribution | negative binomial, size θ = 2 | sensitivity: Poisson, θ = 0.8 |
| Arm × task SD of the reduction | 0.15 | sensitivity: 0 and 0.35 |
| Effect grid (reduction gate / mcp) | 0/0, 0.2/0.1, 0.35/0.2, 0.5/0.25, 0.5/0.5 | `mcp` assumed weaker than `gate` in most rows |
| Advisory per KLOC: at step 1 / added per step | 6 / 1.0 | sensitivity: 3 per step |
| Size: KLOC after step 1 / added per step / lognormal SD | 0.6 / 0.35 / 0.25 | |
| Advisory spillover of the effect | 0.5 | sensitivity: 1 |

## 3. Design options

| Option | Tasks × models × replicates | k | Blocks | Runs | Step turns (without repair turns) |
|---|---|---|---|---|---|
| A | 6 × 2 × 3 | 5 | 36 | 108 | 540 |
| B (outline working grid) | 6 × 3 × 3 | 5 | 54 | 162 | 810 |
| C | 6 × 3 × 5 | 5 | 90 | 270 | 1350 |
| D | 6 × 3 × 3 | 4 | 54 | 162 | 648 |
| E | 6 × 3 × 3 | 6 | 54 | 162 | 972 |
| F (hypothetical) | 12 × 3 × 2 | 5 | 72 | 216 | 1080 |

F needs six tasks beyond the sealed list; it is here only to show what more clusters buy.

## 4. Results (blocking outcome, power under Holm)

| Option | Null (type I, gate) | gate 0.2 | gate 0.35 | gate 0.5 (mcp 0.25) | gate 0.5 / mcp 0.5 | mcp at 0.25 | Task-level, gate 0.5 |
|---|---|---|---|---|---|---|---|
| A | 0.03 | 0.06 | 0.21 | 0.37 | 0.43 / 0.42 | 0.11 | 0.00 |
| B | 0.04 | 0.11 | 0.28 | 0.54 | 0.61 / 0.61 | 0.18 | 0.00 |
| C | 0.04 | 0.15 | 0.48 | 0.77 | 0.81 / 0.81 | 0.33 | 0.00 |
| D | 0.04 | 0.07 | 0.17 | 0.36 | 0.39 / 0.41 | 0.11 | 0.00 |
| E | 0.04 | 0.13 | 0.38 | 0.71 | 0.72 / 0.70 | 0.26 | 0.00 |
| F | 0.02 | 0.10 | 0.35 | 0.66 | 0.76 / 0.74 | 0.21 | 0.58 |

Sensitivity (option B, gate halves the slope, mcp quarters it, block level):

| Assumption changed | Power gate | Power mcp |
|---|---|---|
| Poisson counts | 0.94 | 0.51 |
| Strong overdispersion (θ = 0.8) | 0.31 | 0.09 |
| No arm × task interaction | 0.55 | 0.19 |
| Large arm × task interaction (SD 0.35) | 0.48 | 0.18 |
| Slow erosion (0.5 per step) | 0.27 | 0.09 |
| Fast erosion (2 per step) | 0.77 | 0.30 |
| Noisy runs (run SD 0.7) | 0.42 | 0.17 |

**Fallback outcome (advisory per KLOC).** Under the base assumptions it has almost no power in any option (gate and
mcp each ≤ 0.08, either ≤ 0.13; near the null rate): the per-step growth of a density is small next to its noise, and the effect reaches the advisory
rules only in part. With full spillover and a steep advisory erosion (3 per KLOC per step), option B reaches about 0.5
for `gate`. The fallback is only useful if a pilot shows advisory density growing fast per step.

## 5. Readings (informal)

1. **The outline's normal approximation is about right for the block-level test, but halving the slope is not a
   d_z of 0.42 under these assumptions.** In option B it gives a mean |d_z| of about 0.33 and power about 0.54 (the
   approximation gives 0.57). Only with Poisson counts does it reach d_z ≈ 0.56 and power 0.94.
2. **Six tasks cannot carry a task-level test at Holm's first step.** With six clusters the smallest two-sided
   sign-flip p-value is 2/64 ≈ 0.031 > 0.025, so the task-level analysis has power 0 whatever the effect. Either the
   block-level test is primary (and the task-level effects are reported as a forest plot, as the outline says), or the
   correction is changed (for example a single primary contrast at α = 0.05, where 0.031 is attainable but only when
   every task agrees in sign), or more tasks are written. With twelve tasks (F) the task-level test works.
3. **The block-level test stayed near its nominal size in these runs** (null rows 0.02–0.04, two-sided, under Holm),
   including with an arm × task interaction around zero. This rests on the interaction being symmetric around the
   pooled effect; a pilot cannot check that with six tasks.
4. **Replicates and steps both help; steps help per turn.** From B, two more replicates (C, +540 step turns) raise
   gate power from 0.54 to 0.77; one more step (E, +162 step turns) raises it to 0.71. One fewer step (D) drops it to
   0.36. If the sealed tasks allow k = 6, that is the cheapest gain.
5. **A weaker `mcp` effect is not detectable** at any option here (≤ 0.33 at a quarter reduction). If `mcp` vs
   `none` matters as much as `gate` vs `none`, the design needs option C or larger and an `mcp` effect near `gate`'s.
6. **Overdispersion is the assumption that matters most** (0.94 under Poisson, 0.31 at θ = 0.8). The pilot should
   estimate the SD of per-run slopes and the count dispersion before R and k are fixed (outline §6).

## 6. Limits

- The model is linear in the expected count per step; real erosion may be front-loaded or saturate.
- Arms change only the slope, not the level; an arm that also lowers the step-1 count is not modelled.
- The gate's repair turn, feature dropping and tool adoption (outline §7) are not modelled.
- Model is a random effect here; in the analysis it would be fixed, which changes little with a paired test.
- No multiplicity beyond the two Holm contrasts; secondary outcomes are not simulated.
