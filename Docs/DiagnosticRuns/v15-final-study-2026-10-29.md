# v1.5 final study: results (2026-10-29)

Registration `Docs/v1.5/final-study-preregistration.md` (REGISTERED 2026-10-29, `main` `a228c3f94`; DEV-1, DEV-2).
Run records: `results/v1.5-study/lane-a/` (DDD, branch `results/v15-lane-a` `37edee865`) and `lane-b/` (Hexagonal,
`results/v15-lane-b` `ce8698e41`). Analysis: `scripts/v1.5/final-study-analyse.ts` (sha256 `1d4bcdf7a83fac5f`, lib
`a57b8598f3b93a35`, both as registered), run once at 2026-10-29T06:41Z on `results/v1.5-study/analysis/cells.json`
(the two lanes' `cells.json` concatenated, 228 cells). Secondaries 3–7: `experiments/v15-study/secondaries.py`,
zero calls. Generator `claude-sonnet-5-5`, CLI 2.1.312 on every turn.

## 1. Run

| Lane | Tasks | r | Sessions | Turns | Redraws | Flagged (integrity) | Fail-open |
|---|---|---|---|---|---|---|---|
| A, DDD | 12 | 3 | 72 | 216 | 1 (restart, DEV-2) | 1 (c002, coverage 8/9) | 0 |
| B, Hexagonal | 13 | 6 | 156 | 468 | 1 (restart, DEV-2) | 1 (c008, coverage 16/17) | 0 |

All 684 turns completed, 1 attempt each. Every cell has D scored; no block is excluded.

## 2. Confirmatory result

| H | Style | Blocks | Tasks | ΣD none | ΣD combined | RR [95 % within-task] | d̄ [95 % within-task] | Exact p | Task-level p | Holm α | Reading |
|---|---|---|---|---|---|---|---|---|---|---|---|
| H1 | DDD | 36 | 12 | 85 | 0 | 0.00 [0.00, 0.00] | −2.36 [−2.53, −2.14] | 6.0 × 10⁻⁸ | 3.9 × 10⁻³ | 0.025 | **supported** |
| H2 | Hexagonal | 78 | 13 | 16 | 12 | 0.75 [0.50, 1.00] | −0.05 [−0.15, 0.00] | 1.00 | 1.00 | 0.05 | **not rejected**: no difference detected at the stated MDE (RR ≈ 0.25) |

- H1: 25 blocks with a difference, all 25 negative (sign test p 6.0 × 10⁻⁸); task-cluster d̄ interval
  [−4.19, −0.89]. Under `combined` every DDD cell has D = 0 (36/36, Wilson [0.90, 1.00]) against 11/36 under `none`.
- H2: 1 block of 78 differs (t15, −4); every other block is tied.
- Sensitivities (registered, no decision change): drop no-trap blocks, drop flagged blocks, first and second run-order
  halves all give H1 supported and H2 not rejected.
- *Note (2026-10-30, after the analysis; changes no decision).* The "drop no-trap blocks" line keeps the blocks whose
  `none` cell fell into the trap. That conditions on one arm's outcome, so it leans toward the predicted sign even
  when there is no effect. On synthetic null data (`scripts/v1.5/hx-study-analyse.ts --planted null`, draft PR 451) it
  reads "supported" at p 2.4 × 10⁻⁷ while the primary test reads p 0.26. That figure is a worst case: the synthetic
  data tie trap and D together perfectly, so dropping no-trap blocks drops exactly the `none` cells with D = 0. Here
  the line agreed with the primary on both hypotheses. The Hexagonal study's draft replaces it with a symmetric
  task-level drop.

## 3. What H2 tested: a delivery-coverage gap

Found while computing secondary 4, after the analysis. The combined arm's push channel runs `check_consistency`
over **R-D4 and R-XCTX** only (`src/v15-instrument/consistency.ts`, `CONSISTENCY_RULES`) plus the frozen layer rules
FF-S01–S03; the pull channel serves the same `check_consistency` and the frozen v1.4 tools. This is the delivery
design of 2026-10-26 (`ops/notes/v15-combined-delivery-design-2026-10-26.md`, row "Checks"), fixed before the
Hexagonal admissions (HCAL-03 to HCAL-05) built the Hexagonal graph rules. The scorer counts the admitted rules of
§1; the hub was not extended to them. The registration did not check this.

| Hexagonal admitted identities | `none` | `combined` | Delivered to the agent? |
|---|---|---|---|
| R-AXA (adapter imports adapter), t19 and t24 | 12 | 12 | no (absent from every combined ledger) |
| R-INJ | 2 | 0 | no |
| FF-S01 | 2 | 0 | yes (layers) |

So 12 of H2's 16 `none` identities, and all 12 `combined` identities, come from a rule the agent was never shown.
**Reading:** H2's registered decision stands. It tests the arm as built, which delivered the DDD consistency rules
and the layer rules, not the Hexagonal admitted families; it is not evidence about delivering those families. H1's
D under `none` came from R-D4 (53), R-XCTX (30) and FF-S01 (2), all delivered, so H1 tests what it claims.
Delivering the Hexagonal rules through the hub is future work and would need a new registered study.

## 4. Secondary outcomes (descriptive, no Holm)

**1. Trap rate** (final step fails a trap sub-goal; Wilson 95 %):

| Style | none | combined | Paired sign (blocks +/−), p |
|---|---|---|---|
| DDD | 23/36 = 0.64 [0.48, 0.78] | 1/36 = 0.03 [0.00, 0.14] | 0 / 22, 4.8 × 10⁻⁷ |
| Hexagonal | 20/78 = 0.26 [0.17, 0.36] | 22/78 = 0.28 [0.19, 0.39] | 5 / 3, 0.73 |

**2. Functional acceptance** (task tests pass at the final step): DDD 31/36 vs 30/36; Hexagonal 74/78 vs 72/78.
The DDD reduction is not bought by breaking tasks. t08 is functional in 0/3 under both arms, as in screening.

**3–4. Repair and attribution** (combined, from the hub ledgers): DDD 35 findings exposed, all 35 absent from the final
tree; first channel push in 35 (29 push only, 6 push then pull). Hexagonal 54 findings exposed, all R-D4 (delivered
because the hub runs it on every tree; not an admitted Hexagonal rule), 41 resolved, 13 open on the final tree
(t24 ×8, t18 ×3, t20 ×2); of the 41 resolved, 38 were first shown by push and 3 by pull. Pull calls: DDD 304, Hexagonal 758; the most used tools are
`check_consistency` and `check_file`. Edits refused: 0 (the gate informs, it does not block).

**5. Exploratory rows** (new identities, cells summed): DDD `none` R-D4R 12, R-D5 11, R-LOCK 3, R-D3 1; `combined`
R-D5 6, R-LOCK 2. Hexagonal `none` R-MIRROR 4, R-ADAPTER-RULE 2; `combined` R-MIRROR 14. R-MIRROR (H11, vendor
vocabulary mirrored in the core) rises under the tool; it is not delivered either, and the count is descriptive only.

**6. Cost** (no spend figures): median turn wall time DDD 36.3 s vs 47.0 s, Hexagonal 33.1 s vs 40.5 s
(`none` vs `combined`); 3 turns per cell in both arms; hook events and pull calls per session in the lane READMEs.

**7. Graph against imports** (D_frozen from the frozen v1.4 import instrument on every snapshot, computed by
`score-study.ts`; counts per cell, the scores keep D_frozen counts, not identities):

| Style, arm | ΣD_v15 | ΣD_frozen | Cells only graph | Cells only imports | Cells both | Trap-failed cells flagged by graph / imports |
|---|---|---|---|---|---|---|
| DDD none | 85 | 5 | 21 | 0 | 4 | 22 / 3 of 23 |
| DDD combined | 0 | 2 | 0 | 2 | 0 | 0 / 0 of 1 |
| Hexagonal none | 16 | 8 | 6 | 0 | 7 | 7 / 7 of 20 |
| Hexagonal combined | 12 | 0 | 12 | 0 | 0 | 6 / 0 of 22 |

On DDD the import rules flag 3 of the 23 trap failures the graph rules flag 22 of (TRAPRATE-01: 3/29 vs 17/29).

## 5. Neuro-symbolic secondary and hold-out

- **N1:** (a) CAL-03 with S3 roots, 36/36 (reported before, `results/v15-n1-cal03`); (b) on study snapshots **not
  run** (DEV-2: trees not retained). The registered reading needs both parts, so it is reported as partially tested.
- **N2:** not run; the pilot precondition failed (16/21 = 0.76 [0.55, 0.89] against 0.80; 0/111 hallucinated
  citations), `Docs/DiagnosticRuns/v15-n2-dsem-pilot-2026-10-29.md`.
- **SO4 hold-out (DETECT-02):** scored once at the study's rule hash, 10/14 overall, 9/11 on admitted families, twin FP
  1/14; `Docs/DiagnosticRuns/detect-02-heldout-2026-10-29.md`.

## 6. Record notes

- The lanes' `run/*.jsonl` (calls, turns, redraws, resumes, hub push logs) are matched by the root `.gitignore`
  `*.jsonl` and were not committed, although the lane READMEs list them. The per-turn records are in
  `run/sessions/*.json` and the ledgers in `run/hub/*.ledger.json`; the restart facts are in the READMEs and DEV-2.
- The lane B README and this report are the only places the per-arm summaries appear; no other analysis was run.

## 7. Limits

The registration's §7 limits stand (one vendor, tool + hooks + sentence together, seeded start, no meaning labels).
Added by this run: H2 tested an arm that did not deliver the Hexagonal admitted rules (§3); N1(b) not run; Hexagonal
D comes almost entirely from two tasks (t19, t24) whose `none` and `combined` cells tie.
