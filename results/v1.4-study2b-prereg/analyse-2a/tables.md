# Study 2b analysis (seed 20261021, MC draws 99999, bootstrap 10000)

Inputs: runs: runs.json sha256 f67c9c14ec5d6ea5623784ffd799d5c2ecd833ae67e7d224c99107db1fe85b52; dagger: runs.json sha256 0e19b19ff133b5437aa5d9643d4ef533b1279f53f7992f61632ff698b724761d; scores: scores.json sha256 4b0c8164113322a82999b859af4070ab4589b71201489b25f26df007718e3f4b; analysis: analysis.json sha256 f89d47348dcadc722cdc4682ad096600b31c4e6d065cd7d8b732a7e306c42637; recall none@L2: noneL2/run.json sha256 e798ea9969bfdc9b0fc07c8f93c8d4843504a45477bbddfbd67b97c8f36bcaff; recall none@L3: noneL3/run.json sha256 ce987c63935405aa1aa3b4678075679d6b088296158770ebb25038f6d32ada61; recall mcp@L2: mcpL2/run.json sha256 56f20aaa6ba1b603d7f46dd8cd491b595b2c3671a0ce3ed2235b346f02006b55; telemetry 1: telemetry.json sha256 f7084ee44e6f915d4ef4df11defa419077e810df93ef097c2f4227811a0bea32.

Complete blocks: 6; incomplete (left out of every paired test): none. Blocks with Y₁ = 0: 0.

## 1. Per-block table

| Block | Y₁ | D none@L2 | D none@L3 | D mcp@L2 | Yₖ none@L2 | Yₖ none@L3 | Yₖ mcp@L2 |
|---|---|---|---|---|---|---|---|
| hive-health/rep1 | 1 | 1 | 2 | 1 | 2 | 2 | 0 |
| hive-health/rep2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| ice-rink/rep1 | 4 | 1 | 0 | 0 | 5 | 0 | 0 |
| ice-rink/rep2 | 4 | 3 | 2 | 0 | 7 | 6 | 0 |
| youth-league/rep1 | 1 | 2 | 0 | 0 | 3 | 0 | 0 |
| youth-league/rep2 | 1 | 2 | 0 | 2 | 3 | 0 | 3 |

## 2. Distributions

| Cell | n | ΣD | mean D | histogram of D | P(D = 0) [95 % Wilson] |
|---|---|---|---|---|---|
| none@L2 | 6 | 9 | 1.50 | 0: 1, 1: 2, 2: 2, 3: 1 | 0.17 [0.03, 0.56] |
| none@L3 | 6 | 4 | 0.67 | 0: 4, 2: 2 | 0.67 [0.30, 0.90] |
| mcp@L2 | 6 | 3 | 0.50 | 0: 4, 1: 1, 2: 1 | 0.67 [0.30, 0.90] |

| Contrast | both D = 0 | reference 0 only | other 0 only | neither 0 |
|---|---|---|---|---|
| H1 | 1 | 0 | 3 | 2 |
| H2 | 1 | 0 | 3 | 2 |
| H3 | 3 | 1 | 1 | 1 |

## 3. Confirmatory tests (D)

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 6 | 5 | 5 | 0.2515 | 0.2500 | 0.83 [0.67, 1.00] [-0.50, 2.00] | 0.44 [0.00, 0.67] [0.00, 2.00] | 4/1, 0.3750 | 0.2500 | 0.5000 (0.2500) |
| H2: none@L2 − mcp@L2 | 6 | 3 | 6 | 0.2509 | 0.2500 | 1.00 [0.33, 1.67] [0.00, 2.00] | 0.33 [0.00, 0.71] [0.00, 1.00] | 3/0, 0.2500 | 0.2500 | 0.5000 (0.2500) |
| H3: none@L3 − mcp@L2 | 6 | 3 | 1 | 1.0000 | 1.0000 | 0.17 [-0.50, 0.83] [-1.00, 1.00] | 0.75 [0.00, 2.50] [0.00, 2.50] | 2/1, 1.0000 | 1.0000 | 1.0000 (0.2500) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0250 | false | 0.0167 | false | false | true | false |
| H2 | 0.0167 | false | 0.0250 | false | false | true | false |
| H3 | 0.0500 | false | 0.0500 | false | false | — | — |

**The finding 2 rule (D and D† must agree):**

- H1: not rejected under D or D†: no difference detected at RR <= 0.25 MDE.
- H2: not rejected under D or D†: no difference detected at RR <= 0.25 MDE.

## 4. Equivalence E (none@L3 vs mcp@L2)

d̄ = 0.17; 90 % within-task interval [-0.33, 0.67]; Δ = 0.55 → within: false; Δ₂ = 0.28 (secondary, descriptive) → within: false; pooled treated mean D 0.58. **E fails: nothing is claimed about the two cells being equal.**

## 5. Sensitivity

- **D†** (no composition-root exemption):

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 6 | 5 | 5 | 0.2515 | 0.2500 | 0.83 [0.67, 1.00] [-0.50, 2.00] | 0.44 [0.00, 0.67] [0.00, 2.00] | 4/1, 0.3750 | 0.2500 | 0.5000 (0.2500) |
| H2: none@L2 − mcp@L2 | 6 | 3 | 6 | 0.2509 | 0.2500 | 1.00 [0.33, 1.67] [0.00, 2.00] | 0.33 [0.00, 0.71] [0.00, 1.00] | 3/0, 0.2500 | 0.2500 | 0.5000 (0.2500) |
| H3: none@L3 − mcp@L2 | 6 | 3 | 1 | 1.0000 | 1.0000 | 0.17 [-0.50, 0.83] [-1.00, 1.00] | 0.75 [0.00, 2.50] [0.00, 2.50] | 2/1, 1.0000 | 1.0000 | 1.0000 (0.2500) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0250 | false | 0.0167 | false | false | true | false |
| H2 | 0.0167 | false | 0.0250 | false | false | true | false |
| H3 | 0.0500 | false | 0.0500 | false | false | — | — |

- **Evasion bar** (exempt-file share of presentation → persistence edges at step 5; share of runs with a rename to an exempt name; flag above 0.20): H1 exempt-share diff 0.00, rename-share diff 0.00, flagged false; H2 exempt-share diff 0.00, rename-share diff 0.00, flagged false; H3 exempt-share diff 0.00, rename-share diff 0.00, flagged false. Cells: none@L2 0/21 exempt, 0/6 runs renamed; none@L3 0/8 exempt, 0/6 runs renamed; mcp@L2 0/3 exempt, 0/6 runs renamed.
- **D_sem (semantic secondary, descriptive):** H1: D_sem not available (semantic layer not run, or configuration pending); H2: D_sem not available (semantic layer not run, or configuration pending); H3: D_sem not available (semantic layer not run, or configuration pending).
- **Y₁ = 0 blocks dropped** (6 blocks): H1 reject false, H2 reject false, H3 reject false; exact p H1 0.2500, H2 0.2500, H3 1.0000.
- **Robustness:** H1 sign test p 0.3750, signed-rank p 0.2500; H2 sign test p 0.2500, signed-rank p 0.2500; H3 sign test p 1.0000, signed-rank p 1.0000.
- **Run-index halves** (replicates ≤ 1 vs the rest): first half 3 blocks, mean D none@L2 1.33, d̄ {"H1":0.6666666666666666,"H2":1,"H3":0.3333333333333333}; second half 3 blocks, mean D none@L2 1.67, d̄ {"H1":1,"H2":1,"H3":0}; sign reversal {"H1":false,"H2":false,"H3":false}.
- **By lane:** no order file given.
- **Unmapped-flag drop:** no flagged block given.

## 6. V4 (ADR-V14-04 §4 as amended)

- **Part A** (r_f under F-RF: FF-S01 0.67, FF-S02 1.00, FF-S03 1.00, FF-P01 0.88, FF-P06 0.88; pooled 0.88): m_c none@L2 0.000, none@L3 0.000, mcp@L2 0.000; pairs none@L2/none@L3 |Δm| 0.000 pass; none@L2/mcp@L2 |Δm| 0.000 pass; none@L3/mcp@L2 |Δm| 0.000 pass. **Uninformative:** FF-S03 carries ≥ 90 % of counted identities in every cell.
- **Part B** (non-exempt sites): none@L2 9/9 (1.00), exempt share 0.18 (2/11); none@L3 11/11 (1.00), exempt share 0.08 (1/12); mcp@L2 10/10 (1.00), exempt share 0.17 (2/12); pairs none@L2 − none@L3 0.00 [0.00, 0.00] pass; none@L2 − mcp@L2 0.00 [0.00, 0.00] pass; none@L3 − mcp@L2 0.00 [0.00, 0.00] pass.
- **Reading:** part A uninformative (one family >= 90 % in every cell; reported); part B passes: Layered confirmatory, conditional on part B.

## 7. Evasion items computed here

- **Item 6 (mechanism):** tool use in 24/24 mcp@L2 steps (1.00), a check_* call in 11 (0.46); bar 0.80 → pass.
- Item 1 (acceptance): no acceptance file given.
- **Item 7 (concentration):** 100 % of counted identities are FF-S03: the claim is scoped to that family (composition-root wiring, G12). Without the dominant family: {"decisions":{"H1":{"reject":false,"predictedSign":false,"supportedUnderThisOutcome":false,"sign":0},"H2":{"reject":false,"predictedSign":false,"supportedUnderThisOutcome":false,"sign":0},"H3":{"reject":false,"predictedSign":null,"supportedUnderThisOutcome":null,"sign":0}},"exactP":{"H1":1,"H2":1,"H3":1},"dbar":{"H1":0,"H2":0,"H3":0}}.
- Items 2–5 come from their own tools (size and coverage: `snapshot-coverage.ts`; literal view: the literal re-score; moved-only: the blind read).

## 8. 2a report §3 reproduction (seed 20261019, task-clustered bootstrap)

| Cell | D per block (tasks sorted, rep 1, 2) | ΣD | Mean D [95 % task-clustered] | Variance | Distribution | NB θ | Yₖ | Runs at 0 at step 5 |
|---|---|---|---|---|---|---|---|---|
| none@L2 | 1, 0, 1, 3, 2, 2 | 9 | 1.50 [0.50, 2.00] | 1.10 | 0: 1, 1: 2, 2: 2, 3: 1 | undefined | 2, 1, 5, 7, 3, 3 | 0 |
| none@L3 | 2, 0, 0, 2, 0, 0 | 4 | 0.67 [0.00, 1.00] | 1.07 | 0: 4, 2: 2 | 1.11 | 2, 0, 0, 6, 0, 0 | 4 |
| mcp@L2 | 1, 0, 0, 0, 0, 2 | 3 | 0.50 [0.00, 1.00] | 0.70 | 0: 4, 1: 1, 2: 1 | 1.25 | 0, 0, 0, 0, 0, 3 | 5 |

Y₁: 1, 1, 4, 4, 1, 1.

| Cell | ΣD cell / ΣD none@L2 | Ratio [95 %] | Mean paired difference (cell − none@L2) [95 %] |
|---|---|---|---|
| none@L3 | 4 / 9 | 0.44 [0.00, 2.00] | -0.83 [-2.00, 0.50] |
| mcp@L2 | 3 / 9 | 0.33 [0.00, 1.00] | -1.00 [-2.00, 0.00] |
