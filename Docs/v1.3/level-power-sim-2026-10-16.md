# Study 2 level-outcome power simulation (gate D3), 2026-10-16

A design aid, not a pre-registration. This is the simulation that `Docs/v1.3/floor-escape-design-2026-10-16.md` §3.7 asks for: the PR #119 model (`scripts/v1.3/lib/study2-power.ts`) simulates slopes and has no arm that lowers a level, so it cannot answer D3 for the recommended design. No model call, no Neo4j, no sealed task.

- Code: `scripts/v1.3/lib/level-power-sim.ts` (model, test, sweep), entry `scripts/v1.3/level-power-sim.ts`, tests `tests/unit/scripts/v1.3/level-power-sim.test.ts` (21 tests).
- Run: `npx tsx scripts/v1.3/level-power-sim.ts --sims 2000 --seed 20261016` (768 cells, about 3 minutes). Output: `results/v1.3-level-power-sim/power.json` and `tables.md` (every cell, both correlation models, every scenario). Monte Carlo SE of a power estimate at 2,000 simulations: at most 0.011, and 0.009 near 0.80.

## 0. Answer in one screen

**The design grid of §3.7 (4 tasks × 3 replicates = 12 blocks, k = 4, 240 confirmatory step turns) is underpowered for H3 in every scenario, and for H1 and H2 at every effect smaller than a rate ratio of 0.25.** It reaches 0.80 only for H1 and H2, only when the arm cuts the level to a quarter, and only when none@L2 sits at about 3 or more distinct blocking edges. It fails outright if the DDD stratum lands on zero.

| Question | Answer |
|---|---|
| Smallest grid reaching 0.80 for H1 and H2 (Layered as measured, RR 0.25) | **4 × 3, k = 4, 240 turns** (0.95 / 0.94 independent; 0.99 / 0.99 shared frailty) |
| Same, RR 0.5 | **6 × 4, k = 4, 480 turns** (0.88 / 0.88 independent); 4 × 4, 320 turns, under shared frailty |
| Smallest grid for H3 (RR 0.25) | **6 × 3, k = 4, 360 turns** (0.80 independent, 0.83 shared). At 4 × 3: 0.52 / 0.56 |
| Smallest grid for H3 (RR 0.5) | **None in the sweep** under independence (best 0.70 at 6 × 4); 6 × 4, 480 turns, under shared frailty (0.86) |
| Any hypothesis at RR 0.75 | **None in the sweep** in any scenario (best 0.18 at 6 × 4) |
| All three rejected together | RR 0.25: 6 × 4 (480 turns, 0.92) independent, 6 × 3 (360 turns) shared. RR 0.5: only 6 × 4 shared (0.85). RR 0.75: never |
| k = 6 instead of k = 4 | **Adds 50 % of the turns for no power** under the probes' plateau reading (power differs only by Monte Carlo noise). Under linear growth k = 6 helps H3 slightly (§4.3) |
| Grids with 4 or 6 blocks (2 × 2, 2 × 3) | **Power 0 by construction**: the smallest exact two-sided p is 2/2⁴ = 0.125 or 2/2⁶ = 0.031, above Holm's first threshold 0.05/3 = 0.0167 |
| Layered after the composition-slot repair (mean 2.67) | Design grid: H1 / H2 0.83 / 0.84 at RR 0.25 only; H3 ≤ 0.21. RR 0.5 needs more than the sweep for every hypothesis |
| Half the tasks DDD at zero | Design grid: **0 for all three** (the 6 Layered blocks cannot reach p ≤ 0.0167); H1 / H2 reach 0.80 only at RR 0.25 with 6 × 3 (0.90, shared) or 6 × 4 (0.94, independent); H3 never |
| Clean / Hexagonal (declared zero strata) | Power 0 everywhere, as expected: every block difference is 0 |

The power falls with the none@L2 mean, slowly at first and then steeply (§5). At the design grid and RR 0.25, H1 is 0.95 at mean 5.33, 0.76 at 3, 0.54 at 2, 0.39 at the go threshold 1.5, 0.22 at 1, and 0.05 at 0.5. H3 is already 0.51 at 5.33 and 0.03 at 1.5.

**What D3 can say today.** Gate D3 asks for power ≥ 0.80 for every confirmatory contrast at the registered N. On the only measured base rate (Layered, before the repair) that requires 6 tasks × 3 replicates (360 turns) if the arms cut the level to a quarter, and is out of reach of the swept grids if they only halve it, unless the block correlation is high. D3 stays RED until the validation pilot (design §4) gives a post-repair Layered and a DDD base rate. The §7 fallback applies as written: if 12 Sonnet blocks are kept, H3 should be pre-stated as dropped to secondary.

## 1. Inputs from the real data

Y = distinct blocking violating edges (file → target) in the step-k snapshot; FF-S01 and FF-S03 on the same edge count once (design §3.4). The values were recomputed from each step's `blockingFindings`, not from the raw counts. A method-of-moments negative binomial is fitted per style (variance μ + μ²/θ; θ = ∞ means variance ≤ mean, so Poisson).

| Style | Source | Y at step 4, per run | Mean | Variance | θ |
|---|---|---|---|---|---|
| Layered, as measured | Floor probe 1 (#161), none arm: market-vendors, youth-league, hive-health; `results/v1.3-floor-probe/<task>/none/step-NN.json` | 3, 4, 9 | 5.33 | 10.33 | 5.69 |
| Layered, repaired | Same runs, presentation → persistence edges removed (the server file wiring stores, which §3.6's composition slot takes out of scope) | 3, 1, 4 | 2.67 | 2.33 | ∞ (Poisson) |
| Clean / Hexagonal | Loop pilot none arm (origin/v1.3-pilot-run, `analysis/steps.json`: Clean market-vendors, Hexagonal shelter-adoptions; `reevalBlocking` 0 at all 8 steps) and floor probe 3 (#227, merged: Hexagonal repair-cafe, Clean school-bus; 0 at all 8 steps) | 0, 0, 0, 0 | 0 | 0 | n/a (point mass at 0) |
| DDD | Never scored on agent code (pilot T1, probe 3 §3.2) | none | not fitted | | |

Checks against the design text: the step-1 distinct-edge counts recompute to 2, 2, 4 (raw 4, 3, 6), as §1 of the design states. Probe 1's Hexagonal runs (0 at 14 steps) agree with the zero stratum and are not pooled into it, because they are a different agent route.

Per-step trajectories (distinct edges, steps 1 → last): market 2, 2, 2, 3; league 2, 4, 4, 4, 4; hive 4, 7, 9, 9, 9. The level is set in the first two or three steps and then flat, as probe 1 §3.3 reports.

**k = 6.** No run reached step 6. The primary assumption carries the last observed step forward (LOCF, the probes' "set early and replicated" reading). The sensitivity adds the pooled per-step increment from step 3 on (0.375 edges per step; 3 increments of 8 were non-zero) for each missing step: Layered becomes 3.75, 4.38, 9.38 (mean 5.83, θ 9.27).

Caveats on the inputs, each of which matters more than the Monte Carlo error:

- Three runs give the Layered mean and θ. A 95 % interval for a mean from three NB(5.33, 5.69) values runs roughly from 2 to 9. θ from three points is barely identified.
- Probe 1 was one Claude (Opus) session by hand, not Sonnet in the loop harness, and it used the Layered preset before the §3.6 repair. The "repaired" row removes only the composition-root edges; Q2 (type-only FF-S01 edges, the persistence → business kind) is not settled and could remove most of what remains.
- Replicates are separate draws in the model. No measured data separates between-task from between-replicate variation (each task ran once), so the two correlation models below bracket it.

## 2. Model

Per block (task × replicate), five cells (design §3.3), with r the rate ratio of the scenario:

| Cell | Mean |
|---|---|
| none@L2 | μ (the style's fitted mean) |
| none@L3 | μ·r |
| mcp@L2 | μ·r |
| none@L4 | μ·r (assumption: the spec file lowers the level as much as one sentence per rule, no more) |
| mcp@L4 | μ·r² |

So every contrast has a rate ratio r, but H3 starts from a base that the spec already lowered. That is the structure behind design §3.5's warning that H3 may have nothing left to detect.

Correlation inside a block, two bounds with the same NB(mean, θ) marginal per cell:

- **independent**: every cell draws its own NB. No benefit from pairing. Conservative.
- **shared**: one gamma frailty per block multiplies all five cell means; cells are then Poisson. All overdispersion is between blocks (task difficulty), so pairing removes it. Optimistic.

Analysis, as design §3.5 registers it: per hypothesis, block differences d_b = Y_a − Y_b; the two-sided sign-flip test on Σd; exact enumeration when 2ⁿ ≤ 99,999 (n ≤ 16 blocks), otherwise 99,999 random flips with p = (1 + hits)/(1 + flips); Holm at α = 0.05 over H1, H2, H3. Inside the power loop the exact p is computed by a subset-sum count (identical to enumeration; tested against brute force), and in the random-flip regime (18 and 24 blocks) the hit count is drawn as Binomial(99,999, p_exact), which is its exact sampling distribution. The literal flip loop (`signFlipMcP`) is in the code and the tests check that it agrees. Seed 20261016; each cell's seed is derived from its key, so results do not depend on the order cells run in.

Size: at r = 1 with 24 blocks every hypothesis rejects at or below α (unit test, 400 simulations).

## 3. Cost per grid

Confirmatory step turns = tasks × replicates × 5 cells × k. USD at the loop pilot's 0.15–0.42 per turn (design §3.7). The Hexagonal control (32 turns at the design's 2 × 2 × 2 cells × k = 4) is extra and is not in these numbers.

| Tasks × reps | Blocks | Test | k = 4 turns | k = 4 USD | k = 6 turns | k = 6 USD |
|---|---|---|---|---|---|---|
| 2 × 2 | 4 | exact; **cannot reject** | 80 | 12–34 | 120 | 18–50 |
| 2 × 3 | 6 | exact; **cannot reject** | 120 | 18–50 | 180 | 27–76 |
| 2 × 4 | 8 | exact | 160 | 24–67 | 240 | 36–101 |
| 4 × 2 | 8 | exact | 160 | 24–67 | 240 | 36–101 |
| 4 × 3 | 12 | exact | **240 (design)** | 36–101 | 360 | 54–151 |
| 4 × 4 | 16 | exact | 320 | 48–134 | 480 | 72–202 |
| 6 × 2 | 12 | exact | 240 | 36–101 | 360 | 54–151 |
| 6 × 3 | 18 | 99,999 flips | 360 | 54–151 | 540 | 81–227 |
| 6 × 4 | 24 | 99,999 flips | 480 | 72–202 | 720 | 108–302 |

A second model doubles every row. Wall time on the one lane is about 2–3.5 minutes per turn (pilot), so 480 turns is roughly 16–28 hours before usage-window pauses.

## 4. Power over the sweep

Tasks {2, 4, 6} × replicates {2, 3, 4} × k {4, 6} × r {0.25, 0.5, 0.75}. Every cell for every scenario and both correlation models is in `results/v1.3-level-power-sim/tables.md`. The rows below are k = 4 (k = 6 is in §4.3).

### 4.1 Layered as measured (μ 5.33, θ 5.69), independent cells

| Tasks × reps (blocks) | Turns | r | H1 | H2 | H3 | All three |
|---|---|---|---|---|---|---|
| 2 × 2 (4) | 80 | any | 0.00 | 0.00 | 0.00 | 0.00 |
| 2 × 3 (6) | 120 | any | 0.00 | 0.00 | 0.00 | 0.00 |
| 2 × 4 / 4 × 2 (8) | 160 | 0.25 | 0.58–0.60 | 0.57–0.59 | 0.14–0.16 | 0.12–0.13 |
| 4 × 3 (12) | 240 | 0.25 | **0.95** | **0.94** | 0.52 | 0.51 |
| 4 × 3 (12) | 240 | 0.5 | 0.45 | 0.43 | 0.27 | 0.15 |
| 4 × 3 (12) | 240 | 0.75 | 0.07 | 0.07 | 0.06 | 0.00 |
| 4 × 4 (16) | 320 | 0.25 | 0.99 | 0.99 | 0.74 | 0.73 |
| 6 × 3 (18) | 360 | 0.25 | 1.00 | 1.00 | **0.80** | 0.80 |
| 6 × 4 (24) | 480 | 0.25 | 1.00 | 1.00 | 0.92 | **0.92** |
| 6 × 4 (24) | 480 | 0.5 | **0.88** | **0.88** | 0.70 | 0.61 |
| 6 × 4 (24) | 480 | 0.75 | 0.18 | 0.17 | 0.15 | 0.03 |

Under shared frailty (upper bound) the same rows give, at 4 × 3: 0.99 / 0.99 / 0.56 at r 0.25 and 0.65 / 0.65 / 0.38 at r 0.5; at 6 × 4, r 0.5: 0.99 / 0.99 / 0.86.

### 4.2 Smallest grid reaching 0.80, every scenario

Smallest by step turns. "—" means no grid in the sweep reaches 0.80 (the largest is 6 × 4 at k = 6, 720 turns). Independent / shared.

| Scenario | r | H1 | H2 | H3 | All three |
|---|---|---|---|---|---|
| Layered as measured (μ 5.33, θ 5.69) | 0.25 | 4 × 3 (240) / 4 × 3 (240) | 4 × 3 (240) / 4 × 3 (240) | 6 × 3 (360) / 6 × 3 (360) | 6 × 4 (480) / 6 × 3 (360) |
| | 0.5 | 6 × 4 (480) / 4 × 4 (320) | 6 × 4 (480) / 4 × 4 (320) | — / 6 × 4 (480) | — / 6 × 4 (480) |
| | 0.75 | — / — | — / — | — / — | — / — |
| Layered repaired (μ 2.67, Poisson) | 0.25 | 4 × 3 (240) / 4 × 3 (240) | 4 × 3 (240) / 4 × 3 (240) | — / — | — / — |
| | 0.5, 0.75 | — / — | — / — | — / — | — / — |
| Half Layered, half DDD at the go threshold (μ 1.5) | 0.25 | 4 × 4 (320) / 4 × 3 (240) | 4 × 4 (320) / 4 × 3 (240) | — / — | — / — |
| | 0.5 | — / 6 × 4 (480) | — / 6 × 4 (480) | — / — | — / — |
| | 0.75 | — / — | — / — | — / — | — / — |
| Half Layered, half DDD at zero | 0.25 | 6 × 4 (480) / 6 × 3 (360) | 6 × 4 (480) / 6 × 3 (360) | — / — | — / — |
| | 0.5, 0.75 | — / — | — / — | — / — | — / — |
| Clean / Hexagonal | any | — | — | — | — |

The mixed DDD-threshold scenario at the design grid 4 × 3 is borderline (H1 0.71 independent, 0.84 shared): read it as not reliably powered. With half the tasks at zero, 6 tasks means 3 Layered tasks, so the effective block count is halved. The "4 × 3" entries for the repaired Layered scenario are 0.83 / 0.84, also within two Monte Carlo SEs of the line.

### 4.3 k = 4 versus k = 6

Under LOCF the step-6 level equals the step-4 level, so k = 6 changes nothing but cost. Layered as measured, 4 tasks, r 0.25, independent: k = 4 vs k = 6 power for H1 is 0.58 / 0.57 (2 reps), 0.95 / 0.95 (3 reps), 0.99 / 1.00 (4 reps); for H3 0.14 / 0.15, 0.52 / 0.53, 0.74 / 0.74. Under the linear sensitivity (mean 5.83 at step 6, θ 9.27) k = 6 lifts H3 at r 0.25 to 0.81 at 4 × 4 (480 turns), the same cost at which k = 4 with 6 × 4 gives 0.92. **Spending the extra turns on blocks beats spending them on steps** in every scenario swept. This supports design §3.3's k = 4.

### 4.4 Which grids are underpowered (plain list)

- **Every grid with 2 tasks × 2 or × 3 replicates** (4 or 6 blocks): power exactly 0 for every hypothesis, every effect, every base rate. The test cannot reach Holm's first threshold.
- **Every grid at r 0.75**: power ≤ 0.18 for every hypothesis in every scenario. A 25 % reduction in the level is undetectable at any size swept.
- **Every grid with 8 blocks** (2 × 4, 4 × 2): ≤ 0.60 even at r 0.25.
- **The design grid 4 × 3 (240 turns)**: H3 ≤ 0.56 in every scenario; H1 and H2 ≤ 0.65 at r 0.5; all three 0 if DDD is at zero.
- **H3 at r 0.5**: underpowered at every grid under independent cells; only 6 × 4 under shared frailty.
- **The repaired Layered base rate (μ 2.67)**: H3 underpowered at every grid; H1 and H2 only at r 0.25.
- **Clean and Hexagonal**: 0 everywhere. They are declared zero controls, not contrasts, and the design already treats them so.

## 5. Power collapse as the none@L2 mean goes to 0

θ held at the Layered value (5.69); P(Y = 0) is the chance that a none@L2 run shows no blocking edge. Independent cells.

**Design grid, 4 × 3, k = 4 (240 turns)**

| none@L2 mean | P(Y = 0) | H1, r 0.25 | H3, r 0.25 | H1, r 0.5 | H3, r 0.5 |
|---|---|---|---|---|---|
| 5.33 (Layered as measured) | 0.02 | 0.95 | 0.51 | 0.42 | 0.24 |
| 4 | 0.05 | 0.87 | 0.35 | 0.33 | 0.17 |
| 3 | 0.09 | 0.76 | 0.21 | 0.25 | 0.12 |
| 2 | 0.18 | 0.54 | 0.08 | 0.16 | 0.07 |
| 1.5 (go threshold, design §4) | 0.26 | 0.39 | 0.03 | 0.11 | 0.04 |
| 1 | 0.40 | 0.22 | 0.00 | 0.06 | 0.02 |
| 0.5 | 0.62 | 0.05 | 0.00 | 0.02 | 0.00 |
| 0.25 | 0.78 | 0.00 | 0.00 | 0.00 | 0.00 |
| 0.1 | 0.91 | 0.00 | 0.00 | 0.00 | 0.00 |
| 0 (Clean / Hexagonal) | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 |

**Largest swept grid at k = 4, 6 × 4 (480 turns)**

| none@L2 mean | P(Y = 0) | H1, r 0.25 | H3, r 0.25 | H1, r 0.5 | H3, r 0.5 |
|---|---|---|---|---|---|
| 5.33 | 0.02 | 1.00 | 0.92 | 0.87 | 0.72 |
| 4 | 0.05 | 1.00 | 0.83 | 0.79 | 0.59 |
| 3 | 0.09 | 1.00 | 0.69 | 0.68 | 0.43 |
| 2 | 0.18 | 0.97 | 0.46 | 0.49 | 0.27 |
| 1.5 | 0.26 | 0.90 | 0.31 | 0.38 | 0.18 |
| 1 | 0.40 | 0.72 | 0.15 | 0.26 | 0.11 |
| 0.5 | 0.62 | 0.32 | 0.01 | 0.09 | 0.03 |
| 0.25 | 0.78 | 0.09 | 0.00 | 0.03 | 0.00 |
| 0.1 | 0.91 | 0.00 | 0.00 | 0.00 | 0.00 |
| 0 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 |

H2 tracks H1 within Monte Carlo error at every row (same cell means by construction). Shared-frailty rows are in `tables.md`; they are higher by up to 0.2 at r 0.5 and identical at the bottom of the curve.

Two mechanisms produce the collapse. First, the expected difference μ(1 − r) shrinks with μ. Second, and decisive at the bottom, blocks where both cells are 0 carry no information: the sign-flip test then runs on fewer effective blocks, and once fewer than 8 blocks are non-zero no p can pass 0.0167. At mean 1.5 a quarter of none@L2 runs are already zero, and the reduced cells are zero more often still. **The go threshold of design §4 (mean ≥ 1.5) is not a power threshold.** A stratum that passes it with mean 1.5 gives H1 0.39 and H3 0.03 at the design grid. For H1 and H2 at r 0.25 the design grid needs a mean of about 3.5 or more; H3 needs more blocks at any mean.

Reading against cost: at the design's 240 turns, power for H1 at r 0.25 drops from 0.95 to 0.39 as the mean drops from 5.33 to 1.5. Doubling to 480 turns (6 × 4) recovers 0.90 at mean 1.5 for H1 but leaves H3 at 0.31. Below a mean of about 0.5 no swept budget buys power for any hypothesis: 480 turns (72–202 USD) give at most 0.32.

## 6. What this changes in the design

Recorded for the author; none of it is applied here.

1. D3 stays RED. The level-outcome simulation exists now; its inputs for the confirmatory strata do not (Layered after the repair, DDD at all). Re-run with the pilot's mean and θ per style once design §4 has run: `npx tsx scripts/v1.3/level-power-sim.ts` after editing `STYLE_DATA` with the pilot's step-4 distinct-edge values. That is the only change needed.
2. The §4 go rule (mean ≥ 1.5) admits strata that cannot power any hypothesis at 12 blocks. Either raise the rule to a power-based threshold (for example mean ≥ 3.5 for H1 / H2 at r 0.25 at 4 × 3), or keep it and pre-state that a stratum passing near 1.5 is descriptive.
3. H3 is underpowered at the design grid under every scenario. Design §7 already allows pre-stating which contrast drops to secondary; on these numbers it is H3, unless the grid grows to at least 6 × 3 (360 turns) and the effect is a quarter.
4. Keep k = 4: k = 6 buys nothing under the measured plateau.
5. If one stratum collapses to zero (the "one passes" branch of §4), the 4-task design loses all power: 2 tasks × 3 replicates is 6 blocks, which cannot reject. The one-stratum branch needs at least 2 × 4 or, better, 4 tasks of the passing style.
6. A minimum detectable effect statement belongs in the pre-registration: on the measured Layered base rate the design detects a quarter-level arm (r 0.25) for H1 and H2, not a halving.
