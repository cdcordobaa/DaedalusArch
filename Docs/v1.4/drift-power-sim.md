# Drift-outcome power simulation (s2d-01 §3, drift record §4)

**2026-10-19. A design aid, not a pre-registration. No model call, no Neo4j, no sealed read.** CPU only.

The drift record ([`study2-deviation-2026-10-19-drift.md`](study2-deviation-2026-10-19-drift.md) §4) asks for an `outcome: 'drift'` mode in `scripts/v1.3/lib/level-power-sim.ts`, as specified in [`s2d-01`](../../ops/notes/s2d-01-study2-drift-design.md) §3. This note records what was built, the reproduction of the s2d-01 table, and how the pilot re-run is done.

## 1. What was built

- `RunTrajectory.newPerStep`: new distinct blocking identities per step. D = Σ over steps 2..k. Past the last observed step, `locf` adds 0 new per step and `linear` adds the late increment (mean new per step from step 3 on).
- `DRIFT_DATA`: probe 1, none arm. Probe 1 removed 0 identities at any none step, so the new count is the level increment: market-vendors [2,0,0,1], youth-league [2,2,0,0,0], hive-health [4,3,2,0,0]. D at k = 5 is 1, 2, 5 (mean 2.67, variance 4.33, θ 4.27). The linear sensitivity is 2.79.
- `CELLS_DRIFT` = none@L2, none@L3, mcp@L2 (means μ, μ·RR, μ·RR); `HYPOTHESES_DRIFT` = H1 (none@L2 vs none@L3), H2 (none@L2 vs mcp@L2). Holm is over 2. The two correlation models are the level outcome's (independent cells; one gamma frailty per block, the shared start). The sign-flip test is unchanged.
- Blocks are tasks × replicates × generators. Per-generator inputs use the existing `styles[u % styles.length]` mix over units u = task × generator. Step turns = blocks × (1 + 3(k − 1)), so 416 for 32 blocks at k = 5 (s2d-01 §7).
- `--outcome level|drift` on `scripts/v1.3/level-power-sim.ts`. `level` is the default, and its output is byte-identical to before for the same arguments (checked at `--sims 30`: stdout, `power.json` and `tables.md` all equal).
- **Pilot mode (drift record §4):** `--pilot <file> [--lower-bound 0.8] [--theta-band 1,4,inf]`. Each generator's input mean is the one-sided t lower bound of its pilot mean D, max(0, mean − t·s/√n), with the Student t quantile computed in code. The grid is 4 tasks × 4 replicates × the pilot's generators (32 blocks for two generators). The output gives every θ of the band × both models × RR 0.25/0.5/0.75. The power rule is read at RR 0.25 under independent cells: a hypothesis is kept as confirmatory only if power ≥ 0.80 for **every** θ of the band; otherwise it is demoted to secondary.
- Tests: `tests/unit/scripts/v1.3/level-power-sim-drift.test.ts` (12 tests). They cover D and the probe-1 figures, the cells, the turns, the **size at RR 1** (Holm-2 rejection rates ≤ 0.05 + 3 MC SE, both models), determinism, the t quantiles against tables (t₀.₈,₅ = 0.9195, t₀.₉₇₅,₁₀ = 2.2281, …), the lower bound, and the pilot path on a **synthetic** fixture (`tests/fixtures/v1.4-drift-pilot/synthetic-pilot.json`, not pilot data). The level tests are unchanged and pass.

## 2. Reproduction of s2d-01 §3 (placeholders, not the power claim)

Command:

```bash
npx tsx scripts/v1.3/level-power-sim.ts --outcome drift --sims 2000 --seed 20261018 --out-dir results/v1.3-drift-power-sim
```

Output: `results/v1.3-drift-power-sim/{power.json,tables.md}`; 6–7 s on one process. The 24-block grid is 4 × 3 × 2 and the 32-block grid is 4 × 4 × 2; with one input for both generators, only the block count matters. s2d-01's scratch driver was not committed, so the two runs share the model but not the random stream. The bar is "within the Monte Carlo SE (≤ 0.011)". The difference of two independent 2,000-sim estimates has SD ≈ √2 · SE.

| Blocks | Model | RR | s2d-01 H1 / H2 | Committed H1 / H2 | Difference H1 / H2 | Within √2·SE? |
|---|---|---|---|---|---|---|
| 24 | independent | 0.25 | 0.99 / 0.99 | 0.990 / 0.988 | 0.000 / −0.002 | yes |
| 24 | independent | 0.5 | 0.65 / 0.65 | 0.638 / 0.646 | −0.013 / −0.005 | yes (0.82 / 0.30 SD) |
| 24 | independent | 0.75 | 0.14 / 0.13 | 0.126 / 0.145 | −0.015 / +0.015 | yes (1.3 / 1.3 SD) |
| 24 | shared | 0.25 | 1.00 / 1.00 | 0.999 / 1.000 | −0.002 / −0.001 | yes |
| 24 | shared | 0.5 | 0.82 / 0.82 | 0.822 / 0.815 | +0.002 / −0.005 | yes |
| 24 | shared | 0.75 | 0.20 / 0.20 | 0.207 / 0.196 | +0.007 / −0.004 | yes |
| 32 | independent | 0.25 | 1.00 / 1.00 | 0.999 / 1.000 | −0.001 / 0.000 | yes |
| 32 | independent | 0.5 | 0.79 / 0.79 | 0.798 / 0.817 | +0.008 / **+0.027** | H1 yes; **H2 no (2.1 SD)** |
| 32 | independent | 0.75 | 0.19 / 0.16 | 0.182 / 0.183 | −0.009 / **+0.023** | H1 yes; **H2 borderline (1.8 SD)** |
| 32 | shared | 0.25 | 1.00 / 1.00 | 1.000 / 1.000 | 0 / 0 | yes |
| 32 | shared | 0.5 | 0.93 / 0.93 | 0.933 / 0.936 | +0.003 / +0.006 | yes |
| 32 | shared | 0.75 | 0.29 / 0.29 | 0.296 / 0.290 | +0.006 / −0.001 | yes |

Collapse row (32 blocks, independent, RR 0.25), s2d-01 → committed H1 / H2: 2.67: 1.00 → 1.00 / 1.00; 1.5: 0.98 → 0.98 / 0.98; 1.0: 0.91 → 0.90 / 0.91; 0.75: 0.81 → 0.80 / 0.82; 0.5: 0.58 → 0.59 / 0.58. All within √2·SE.

**Reading, stated plainly.**
- 22 of 24 table cells and every collapse cell agree within √2·SE. The RR 0.25 figures, the only ones the drift record claims (MDE "RR ≤ 0.25 only"), reproduce exactly.
- Two H2 cells at 32 blocks, independent, are outside the absolute ±0.011 bar: RR 0.5 (+0.027) and RR 0.75 (+0.023).
- H1 and H2 are exchangeable in this model (both compare none@L2 with a cell of mean μ·RR), so their true powers are equal. s2d-01's own H1/H2 pair at RR 0.75 differs by 0.03 (0.19 vs 0.16), which is noise of the same size.
- A 20,000-sim check (scratch, not committed) gives 0.81 / 0.82 at RR 0.5 and 0.18 / 0.18 at RR 0.75. So the committed script's converged value at 32 blocks, independent, RR 0.5 is about 0.81–0.82, not 0.79. The s2d-01 figure looks about 2.5 SE low; it was a 2,000-sim scratch run. "Borderline for a halving" stays true either way.
- None of this changes a decision: these are placeholders (drift record §4), superseded by the pilot re-run below.

## 3. The pilot re-run (after the pilot; not run here)

Write the pilot's none@L2 D per run, per generator (2 tasks × 3 replicates = 6 values each), to a JSON file outside `results/` until it is final:

```json
{ "generators": { "claude-sonnet-5-5": [0, 0, 0, 0, 0, 0], "gemini": [0, 0, 0, 0, 0, 0] } }
```

```bash
npx tsx scripts/v1.3/level-power-sim.ts --outcome drift --pilot <pilot.json> --lower-bound 0.8 --theta-band 1,4,inf \
  --sims 2000 --seed 20261018 --out-dir results/v1.4-drift-power-pilot
```

The report gives each generator's n, mean, SD, t quantile and lower bound; the power table; and one verdict line per hypothesis, "keep as confirmatory" or "demote to secondary". `power.json` writes θ = ∞ as `"inf"`. Not covered here:
- whether the lower bound should pool the two tasks or cluster by task (the bound treats the 6 runs as independent, as REV-03 finding 1 phrased it);
- a pooled θ when a generator's pilot is all zeros (the band replaces a fitted θ, so none is needed).

Both are the author's call before registration.
