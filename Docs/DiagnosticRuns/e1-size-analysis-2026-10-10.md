# E1 (SO5) size analysis — 2026-10-10

> **Status**: diagnostic note. It uses only committed data: `results/e1-grid/agg/` (registered neural aggregation)
> and `results/e1-grid/reports/` from E1 at `f44e981` (PR #56). There were no new runs, evaluations or LLM calls.
> **Producer**: `npx tsx scripts/e1-size-analysis-cli.ts --agg results/e1-grid/agg --plan experiments/e1-grid/plan.json --reports results/e1-grid/reports --out results/e1-grid/agg-size`
> (seeds from the E1 plan: bootstrap 5102, permutation 5103; 10 000 resamples). Two runs give the same bytes.
> **Outputs**: `results/e1-grid/agg-size/`. `size_cells.csv` has one row per coordinate. `size_levels.csv` has
> per-level summaries. `size_tests.csv` holds the tests, each labelled with its registration status.
> `size_families.csv` and `size_functions.csv` give the rule-family and function breakdowns, and `size_dimensions.csv`
> gives the AHS deficit per dimension. `size_correlations.csv` holds the size–AHS correlations.
> **Instrument**: v2 (B8). Every symbolic count below is a v2 count. The B8 v1 sensitivity row for violations per
> KLOC would need a symbolic re-evaluation, so it is not produced here.
> **Prereg**: this analysis changes no registered artefact, so it needs no pre-registration bump. Only two files
> outside the new files change. `scripts/aggregate.ts`, which is not registered, now exports its existing
> `stratifiedMeanDiffCi`. `aidlc-docs/audit.md` gains an entry.

## 1. Question

The registered E1 tests on the 54 Claude cells (47 valid) show three things:
- **a spec-level effect** in the reverse direction: `none` scores best and `minimal-prose` worst (Holm p = 0.0003);
- **no model effect** (p = 0.44);
- **a pass verdict for every cell**. The minimum `ahsCombined` is 0.852 against the 0.80 pass threshold. There are
  also no structural (dependency-direction or cycle) findings: AVR structural is 0 in every cell.

`none` projects are much smaller. Pooled over both vendors, the mean file counts are 8.3, 22.8 and 25.2. On the Claude
arm alone they are 9.1, 27.4 and 29.6. The hypothesis is that project size confounds the AHS, because rule findings
scale with the amount of code.

## 2. What the registered plan already specifies

`Docs/analysis-plan.md` §3 and the size definitions (ADR-021 SO5-07, X-3; registered at P-U6, v4) cover size as
follows:

| Measure | Column | Registered status | Test registered? |
|---|---|---|---|
| AHS (verdict source) | `ahs_combined` | **primary** (§6) | yes: model, spec level, interaction; Holm family of 3 |
| `ahsDeterministic` | `ahs_deterministic` | **co-primary for the model effect**; exploratory for spec level and interaction | yes |
| Deterministic violations per KLOC | `violations_per_kloc` | **exploratory secondary** family `secondary:violations_per_kloc` | yes (same procedure, own Holm family, `exploratory = true`) |
| LOC (non-blank `src/**/*.ts` lines) | `loc` | descriptive column | **no** |
| All violations per KLOC (judge included) | `violations_total_per_kloc` | descriptive only | **no** |
| Generation and instrument latency | `generation_ms`, `eval_total_ms` | descriptive only | **no** |
| File count | `file_count` | grid cell column (generator protocol) | **no** |

So the registered size-normalised outcome is **deterministic violation density per KLOC**, and it is **exploratory**
(§10 B7: "every secondary SO5 family is exploratory"). The plan registers nothing per file, nothing per family per
KLOC, and no size-adjusted AHS. Those readings appear below only as **post-hoc** analyses.

**Reproduction check.** The script reruns the registered procedure on the committed CSVs. The procedure is the one in
`so5Tests` of `aggregate.ts`: permutations within task × the other factor, Holm within the family, a descriptive
cluster-bootstrap CI and Cliff's δ. Density is recomputed from the integer counts, as `so5-size.ts` does. All 27
registered rows (`primary:ahsCombined`, `co-primary:ahsDeterministic`, `secondary:violations_per_kloc`) equal the
committed `so5_tests.csv` rows to the last printed digit (`size_tests.csv` `reproduces_registered = true`, and a unit
test checks it).

## 3. Per-level table (Claude arm, registered cells)

The values are means over valid cells. Density is deterministic violations per 1 000 LOC. "excl. CV05" removes the
test-file-pairing findings (see §5). Latency is descriptive.

| Model | Spec level | Valid/coords | AHS comb. | AHS det. | LOC | Files | Det. viol. | **Viol./KLOC** (reg., expl.) | All viol./KLOC (desc.) | Viol./KLOC excl. CV05 (post-hoc) | Viol./file (post-hoc) | Gen. time | Instr. time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| haiku-4-5 | none | 3/6 | 0.929 | 0.943 | 285 | 8.3 | 10.3 | 34.3 | 45.5 | 8.6 | 1.14 | 102 s | 77 s |
| opus-5-5 | none | 6/6 | 0.957 | 0.954 | 569 | 11.0 | 12.2 | 21.7 | 21.7 | 2.7 | 1.11 | 89 s | 5 s |
| sonnet-5-5 | none | 6/6 | 0.957 | 0.954 | 315 | 7.7 | 9.0 | 28.6 | 29.1 | 4.2 | 1.17 | 57 s | 4 s |
| **all** | **none** | 15/18 | **0.951** | 0.952 | **411** | **9.1** | 10.5 | **27.0** | 29.4 | **4.5** | 1.14 | 79 s | 19 s |
| haiku-4-5 | minimal-prose | 4/6 | 0.910 | 0.917 | 470 | 20.0 | 20.8 | 44.2 | 61.6 | 7.6 | 1.04 | 182 s | 216 s |
| opus-5-5 | minimal-prose | 6/6 | 0.877 | 0.865 | 693 | 34.2 | 39.3 | 57.0 | 57.9 | 10.2 | 1.15 | 164 s | 5 s |
| sonnet-5-5 | minimal-prose | 6/6 | 0.882 | 0.871 | 462 | 25.7 | 31.5 | 68.5 | 68.5 | 12.8 | 1.23 | 89 s | 4 s |
| **all** | **minimal-prose** | 16/18 | **0.887** | 0.880 | **551** | **27.4** | 31.8 | **58.1** | 62.8 | **10.5** | 1.15 | 140 s | 58 s |
| haiku-4-5 | full-aac | 4/6 | 0.895 | 0.908 | 472 | 19.5 | 23.2 | 49.6 | 68.4 | 9.5 | 1.19 | 135 s | 145 s |
| opus-5-5 | full-aac | 6/6 | 0.937 | 0.932 | 748 | 39.3 | 44.0 | 61.0 | 61.0 | 10.0 | 1.12 | 235 s | 5 s |
| sonnet-5-5 | full-aac | 6/6 | 0.920 | 0.912 | 536 | 26.7 | 30.8 | 57.9 | 58.2 | 8.7 | 1.16 | 106 s | 46 s |
| **all** | **full-aac** | 16/18 | **0.920** | 0.919 | **600** | **29.6** | 33.9 | **57.0** | 61.8 | **9.4** | 1.15 | 162 s | 55 s |
| haiku-4-5 | all | 11/18 | 0.910 | 0.921 | 420 | 16.6 | 18.8 | 43.5 | 59.7 | 8.6 | 1.12 | 143 s | 152 s |
| opus-5-5 | all | 18/18 | 0.924 | 0.917 | 670 | 28.2 | 31.8 | 46.6 | 46.9 | 7.6 | 1.13 | 163 s | 5 s |
| sonnet-5-5 | all | 18/18 | 0.920 | 0.912 | 438 | 20.0 | 23.8 | 51.6 | 51.9 | 8.6 | 1.19 | 84 s | 18 s |

Instrument time differs by more than an order of magnitude between models at similar LOC, so it does not track size.
It is not interpreted further.

### Tests (Claude arm; spec-level pairwise rows are "row − column level"; δ = Cliff's δ)

| Outcome | Status | Model p (Holm) | Spec p (Holm) | Interaction p (Holm) | full-aac − none | minimal-prose − none | full-aac − minimal-prose |
|---|---|---|---|---|---|---|---|
| `ahsCombined` | **registered primary** (reproduced) | 0.438 | **0.0003** | 0.026 | −0.031 [−0.044, −0.019], δ −0.54 | −0.064 [−0.071, −0.058], δ −0.93 | +0.033 [0.019, 0.047], δ 0.52 |
| `ahsDeterministic` | **registered co-primary for model**; spec exploratory (reproduced) | 0.753 | 0.0003 | 0.044 | −0.033, δ −0.51 | −0.072, δ −0.95 | +0.039, δ 0.55 |
| `violations_per_kloc` | **registered exploratory secondary** (reproduced) | 0.146 | **0.0003** | 0.0032 | **+30.0** [26.5, 33.4], δ 0.97 | **+31.1** [28.8, 33.5], δ 0.97 | −1.1 [−4.5, 2.1], δ −0.09 |
| `loc` | registered descriptive; **test post-hoc** | 0.0003 | 0.0003 | 0.91 | +189, δ 0.59 | +140, δ 0.48 | +49, δ 0.19 |
| `files` | grid column; **test post-hoc** | 0.0003 | 0.0003 | 0.0005 | +20.5, δ 1.00 | +18.3, δ 1.00 | +2.2, δ 0.12 |
| `violations_total_per_kloc` | registered descriptive; **test post-hoc** | 0.024 | 0.0003 | 0.027 | +32.4, δ 0.88 | +33.4, δ 0.92 | −1.0, δ −0.10 |
| violations per KLOC excl. FPAT-PATTERN (CV05) | **post-hoc** | 0.68 | 0.0015 | 0.036 | +4.9 [3.3, 6.5], δ 0.73 | +6.0 [5.0, 7.0], δ 0.75 | −1.1, δ −0.18 |
| violations per file | **post-hoc** | 0.50 | **0.95** | 0.50 | +0.010, δ 0.08 | +0.013, δ 0.00 | −0.003, δ −0.02 |
| violations per file excl. CV05 | **post-hoc** | 0.77 | 0.77 | 0.77 | +0.019, δ 0.35 | +0.037, δ 0.38 | −0.018, δ −0.16 |
| `ahsCombined` residualised on ln LOC | **post-hoc** | 0.10 | **0.0003** | 0.021 | −0.023 [−0.036, −0.010], δ −0.28 | −0.057 [−0.064, −0.051], δ −0.87 | +0.034 [0.020, 0.049], δ 0.47 |
| `ahsDeterministic` residualised on ln LOC | **post-hoc** | 0.23 | 0.0003 | 0.038 | −0.021, δ −0.28 | −0.062, δ −0.94 | +0.041, δ 0.52 |

Every CI is the registered descriptive cluster-bootstrap CI (ADR-020 item 6). Inference rests on the permutation p
values and Cliff's δ. The post-hoc rows each use their own Holm family of three. There is no correction across
families, and they were chosen after the E1 results were known.

## 4. Size vs AHS (descriptive only, post-hoc)

These are Pearson r and Spearman ρ over valid cells (`size_correlations.csv`). n is 47 overall and 15–16 per level.
No test is run.

| Subset (Claude) | files–AHS r (ρ) | LOC–AHS r (ρ) |
|---|---|---|
| all levels | −0.34 (−0.40) | −0.11 (−0.15) |
| none | −0.26 (−0.32) | +0.18 (−0.04) |
| minimal-prose | −0.25 (−0.32) | −0.22 (−0.20) |
| full-aac | **+0.59** (+0.58) | +0.41 (+0.43) |

The negative pooled correlation comes from the gap between levels: `none` is both smaller and better. Within a
level, the sign is not consistent. In `full-aac`, the larger projects score *higher*. Size does not predict AHS once
the spec level is fixed.

## 5. Which rule families drive the spec effect

### Raw counts and per-KLOC counts (`size_families.csv`, `size_functions.csv`)

The table shows symbolic findings per valid cell, Claude arm. The per-KLOC figure is the pooled sum divided by the
pooled LOC. "Fired" counts the cells with at least one finding.

| Family (function) | none: mean / per KLOC / fired | minimal-prose | full-aac |
|---|---|---|---|
| FPAT-PATTERN (FF-CV05 test-file-pairing) | 8.9 / 21.6 / 15 of 15 | 26.0 / 47.2 / 16 of 16 | 28.4 / 47.3 / 16 of 16 |
| FPAT-COUPLING: FF-C03 component-instability | 1.2 / 2.9 / 13 of 15 | 2.8 / 5.1 / 16 of 16 | 3.9 / 6.6 / 16 of 16 |
| FPAT-COUPLING: FF-C02 module-fan-out | 0 / 0 / **0 of 15** | 0.9 / 1.7 / **15 of 16** | 0.3 / 0.5 / **5 of 16** |
| FPAT-COUPLING: FF-C06 abstraction-ratio | 0 / 0 / 0 of 15 | 0.25 / 0.5 / 4 of 16 | 0.13 / 0.2 / 2 of 16 |
| FPAT-SOLID (FF-P02 dependency-inversion, AVR dimension `pattern`) | 0.5 / 1.1 / **2 of 15** | 1.75 / 3.2 / **11 of 16** | 1.0 / 1.7 / **6 of 16** |
| FPAT-INTEGRITY (judge fail units) | 0.40 / 1.0 | 0.69 / 1.2 | 0.56 / 0.9 |
| FPAT-SEMANTIC (judge fail units) | 0.13 / 0.3 | 0.25 / 0.5 | 0.31 / 0.5 |

FF-CV05 produces 1 003 of the 1 208 symbolic findings (83 %). It fires once for every source file that has no test
file: 0.96 findings per file on the Claude arm and exactly 1.00 on the Codex arm. It is the reason raw counts and
per-KLOC density "scale with code": in practice they count files. The family label is the registered `FPAT-*` table
(§1). Its mapping does not match the AVR dimension: CV05 sits in the `convention` dimension, and P02 sits in
`pattern` while its family is FPAT-SOLID.

### Why counts do not move the AHS

A dimension's AVR is violatedWeight ÷ functionCount, and each function counts once when it fires, however many
findings it has. AHS therefore measures **which functions fire**, not how many findings they produce. FF-CV05 fires in
every cell, so it costs every cell the same 0.0125 of AHS and contributes **nothing** to the spec effect. The table
below splits the deficit 1 − `ahsCombined` exactly by function (`size_functions.csv` `ahs_deficit_mean`;
`size_dimensions.csv`):

| Contribution to the AHS gap | minimal-prose − none (0.064) | full-aac − none (0.031) | minimal-prose − full-aac (0.033) |
|---|---|---|---|
| FF-C02 module-fan-out (coupling) | **+0.028** | +0.009 | **+0.019** |
| FF-P02 dependency-inversion (pattern) | **+0.025** | **+0.011** | **+0.014** |
| FF-C06 abstraction-ratio (coupling) | +0.008 | +0.004 | +0.004 |
| FF-C03 component-instability (coupling) | +0.004 | +0.004 | 0 |
| FF-C04 orphan files (coupling) | 0 | +0.002 | −0.002 |
| FF-CV05 test-file-pairing (convention) | 0 | 0 | 0 |
| judge Integrity | 0 | +0.002 | −0.002 |

**Two functions drive the spec effect: FF-C02 module-fan-out and FF-P02 dependency-inversion, followed by
FF-C06.** In family terms these are FPAT-COUPLING and the P02 part of FPAT-SOLID. In AHS terms they are the coupling
and pattern dimensions, which matches the registered exploratory secondary tests (`avr_coupling` spec Holm p 0.0003;
`avr_pattern` 0.009). These functions almost never fire on `none` projects: C02 fires in 0 of 15 and P02 in 2 of 15.
On `minimal-prose`, C02 fires in 15 of 16 and P02 in 11 of 16. The judge families have no spec effect.

Inside a level, firing does not track size. In `full-aac`, the cells where C02 fired average 24 files and the cells
where it did not average 32. For P02 the figures are 26 and 32.

## 6. Does the spec effect survive size normalisation?

Mostly yes. Size does not explain the reversed direction away, but how the result reads depends on the
denominator.

- **Registered size-normalised outcome (density per KLOC, exploratory):** the effect survives, in the **same
  direction** as the AHS. `none` has about half the violations per KLOC of the other two levels (27 vs 57–58;
  δ 0.97; Holm p 0.0003). `full-aac` and `minimal-prose` do not differ (δ −0.09).
- **Post-hoc, AHS adjusted for ln LOC:** the effect survives (Holm p 0.0003). `minimal-prose` stays clearly worse
  than `none` (δ −0.87). The `full-aac` vs `none` gap shrinks from δ −0.54 to −0.28, while `full-aac` stays better
  than `minimal-prose` (δ 0.47).
- **Post-hoc, per file:** findings per file show **no spec effect** (p 0.95; 1.14 to 1.15 everywhere). Even without
  CV05 the effect disappears (p 0.77). So a `none` project has about as many findings *per file* as the others.
  It is lower per KLOC because its files are about twice as large (45 vs 20 LOC per file).
- **Size as a mechanism, not a confounder.** The spec prompt causes the size: files differ between `none` and the
  other levels with δ ≈ 1.0. Size therefore lies on the causal path rather than acting as an outside confounder, and
  no adjustment for file count is identifiable. The best reading of the reversed effect is this: a spec prompt makes
  the generator build more modules and more layers. That creates more fan-out sites and more abstractions where
  coupling (C02, C06) and dependency-inversion (P02) rules can fire. A minimal 9-file `none` project gives those rules
  little to check. The AHS rewards the smaller structure. That does not show the smaller design is better.
- **The size-matched contrast:** `full-aac` and `minimal-prose` have almost the same size (files δ 0.12, LOC δ 0.19)
  and the same density. Yet `full-aac` scores better on the AHS (δ 0.52, still 0.47 after the LOC adjustment),
  because C02 and P02 fire less often. This is the one spec comparison that size cannot explain. It favours the
  architecture-as-code spec over the prose spec.

**Plain-language summary.** Specs make the generated projects larger. Larger projects give the coupling and
dependency-inversion rules more places to fire, and the `none` projects mostly escape them. Measured per line of code,
`none` still looks cleanest. Measured per file, nothing differs. Comparing the two spec styles at equal size, the full
architecture-as-code spec beats the prose spec. Write the registered "reverse" spec effect up as an effect of spec
level on project structure, which the AHS then scores, and not as evidence that specs worsen architecture.

## 7. Codex arm (gpt-5.6-terra; exploratory vendor arm, ADR-029; 18 of 18 valid)

| Spec level | AHS comb. | AHS det. | LOC | Files | Viol./KLOC | Viol./KLOC excl. CV05 | Viol./file |
|---|---|---|---|---|---|---|---|
| none | 0.926 | 0.932 | 254 | 6.3 | 32.0 | 7.4 | 1.31 |
| minimal-prose | **0.957** | 0.954 | 274 | 10.5 | 43.5 | 4.8 | 1.13 |
| full-aac | 0.942 | 0.943 | 320 | 13.3 | 48.4 | 7.7 | 1.19 |

The Codex spec-level tests are post-hoc, a family of one each, run within task: `ahsCombined` p 0.028, density
p 0.043, files p 0.009, per file p 0.002. The AHS pattern is the **opposite** of the Claude arm: `none` scores worst
and `minimal-prose` best. On Codex, `none` loses AHS through the SOLID proxies (FF-SO01 and FF-SO02 fire in 2 of 6
cells each) and through judge Integrity. Codex projects are smaller (282 LOC and 10 files on average) and grow less
with the spec level (6 → 13 files). Density per KLOC is again lowest on `none`, but per file `none` is highest. With
6 cells per level and one model, the Codex arm only shows that the Claude-arm direction is not universal. It does not
support a claim. The registered vendor contrast rows stay in `results/e1-grid/agg/so5_tests.csv`.

## 8. Registered vs post-hoc

| Reading | Status |
|---|---|
| `ahsCombined` spec, model and interaction tests | registered primary (reproduced, unchanged) |
| `ahsDeterministic` tests | registered; co-primary for the model effect only, otherwise exploratory |
| `violations_per_kloc` tests | registered **exploratory** secondary |
| LOC, all-violations density, generation and instrument time | registered **descriptive** columns (summaries here; any test on them is post-hoc) |
| Tests on LOC, files and all-violations density; per-file density; density without CV05; per-family raw and per-KLOC tests; AHS residualised on ln LOC; function-level AHS deficit split; size–AHS correlations; Codex spec-level and size tests | **post-hoc, exploratory** (decided 2026-10-10 after the E1 results were known) |

No registered artefact changed (the `corpus/prereg.json` hashes are untouched). A thesis report of these readings
should say they are post-hoc, beside the registered density row.
