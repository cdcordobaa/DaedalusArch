# Study 2b analysis (seed 20261021, MC draws 99999, bootstrap 10000)

Inputs: runs: runs.json sha256 f67c9c14ec5d6ea5623784ffd799d5c2ecd833ae67e7d224c99107db1fe85b52; plant: null: none@L2 (D, Y1) drawn from the --runs none@L2 blocks; treated cells independent redraws from the same none@L2 values (no effect); dagger: planted: D† = D by construction; scores: scores.json sha256 4b0c8164113322a82999b859af4070ab4589b71201489b25f26df007718e3f4b.

Complete blocks: 40; incomplete (left out of every paired test): none. Blocks with Y₁ = 0: 0.

## 1. Per-block table

| Block | Y₁ | D none@L2 | D none@L3 | D mcp@L2 | Yₖ none@L2 | Yₖ none@L3 | Yₖ mcp@L2 |
|---|---|---|---|---|---|---|---|
| planted-task-1/rep1 | 4 | 3 | 1 | 1 | null | null | null |
| planted-task-2/rep1 | 1 | 2 | 1 | 2 | null | null | null |
| planted-task-3/rep1 | 4 | 1 | 0 | 3 | null | null | null |
| planted-task-4/rep1 | 4 | 1 | 1 | 2 | null | null | null |
| planted-task-1/rep2 | 1 | 0 | 1 | 2 | null | null | null |
| planted-task-2/rep2 | 4 | 3 | 0 | 2 | null | null | null |
| planted-task-3/rep2 | 4 | 1 | 1 | 2 | null | null | null |
| planted-task-4/rep2 | 1 | 2 | 2 | 1 | null | null | null |
| planted-task-1/rep3 | 1 | 2 | 2 | 0 | null | null | null |
| planted-task-2/rep3 | 1 | 1 | 1 | 1 | null | null | null |
| planted-task-3/rep3 | 4 | 1 | 2 | 2 | null | null | null |
| planted-task-4/rep3 | 1 | 1 | 1 | 0 | null | null | null |
| planted-task-1/rep4 | 1 | 2 | 2 | 2 | null | null | null |
| planted-task-2/rep4 | 4 | 3 | 3 | 1 | null | null | null |
| planted-task-3/rep4 | 4 | 1 | 1 | 1 | null | null | null |
| planted-task-4/rep4 | 1 | 2 | 1 | 0 | null | null | null |
| planted-task-1/rep5 | 4 | 3 | 0 | 2 | null | null | null |
| planted-task-2/rep5 | 1 | 1 | 1 | 3 | null | null | null |
| planted-task-3/rep5 | 1 | 2 | 1 | 3 | null | null | null |
| planted-task-4/rep5 | 1 | 0 | 2 | 1 | null | null | null |
| planted-task-1/rep6 | 1 | 1 | 3 | 0 | null | null | null |
| planted-task-2/rep6 | 4 | 1 | 1 | 2 | null | null | null |
| planted-task-3/rep6 | 1 | 0 | 1 | 1 | null | null | null |
| planted-task-4/rep6 | 1 | 1 | 3 | 1 | null | null | null |
| planted-task-1/rep7 | 1 | 2 | 1 | 3 | null | null | null |
| planted-task-2/rep7 | 1 | 0 | 1 | 1 | null | null | null |
| planted-task-3/rep7 | 4 | 1 | 1 | 2 | null | null | null |
| planted-task-4/rep7 | 4 | 3 | 2 | 3 | null | null | null |
| planted-task-1/rep8 | 1 | 1 | 1 | 2 | null | null | null |
| planted-task-2/rep8 | 1 | 2 | 2 | 3 | null | null | null |
| planted-task-3/rep8 | 1 | 1 | 2 | 0 | null | null | null |
| planted-task-4/rep8 | 1 | 2 | 2 | 2 | null | null | null |
| planted-task-1/rep9 | 1 | 2 | 1 | 2 | null | null | null |
| planted-task-2/rep9 | 4 | 3 | 2 | 2 | null | null | null |
| planted-task-3/rep9 | 1 | 2 | 2 | 3 | null | null | null |
| planted-task-4/rep9 | 4 | 3 | 2 | 2 | null | null | null |
| planted-task-1/rep10 | 1 | 2 | 3 | 0 | null | null | null |
| planted-task-2/rep10 | 1 | 2 | 1 | 1 | null | null | null |
| planted-task-3/rep10 | 1 | 2 | 1 | 0 | null | null | null |
| planted-task-4/rep10 | 1 | 2 | 2 | 1 | null | null | null |

## 2. Distributions

| Cell | n | ΣD | mean D | histogram of D | P(D = 0) [95 % Wilson] |
|---|---|---|---|---|---|
| none@L2 | 40 | 65 | 1.63 | 0: 4, 1: 14, 2: 15, 3: 7 | 0.10 [0.04, 0.23] |
| none@L3 | 40 | 58 | 1.45 | 0: 3, 1: 20, 2: 13, 3: 4 | 0.07 [0.03, 0.20] |
| mcp@L2 | 40 | 62 | 1.55 | 0: 7, 1: 11, 2: 15, 3: 7 | 0.17 [0.09, 0.32] |

| Contrast | both D = 0 | reference 0 only | other 0 only | neither 0 |
|---|---|---|---|---|
| H1 | 0 | 4 | 3 | 33 |
| H2 | 0 | 4 | 7 | 29 |
| H3 | 0 | 3 | 7 | 30 |

## 3. Confirmatory tests (D)

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 40 | 23 | 7 | 0.4076 | 0.4085 | 0.17 [-0.15, 0.53] [-0.05, 0.40] | 0.89 [0.71, 1.11] [0.77, 1.03] | 14/9, 0.4049 | 0.4287 | 0.5000 (0.1250) |
| H2: none@L2 − mcp@L2 | 40 | 32 | 3 | 0.7944 | 0.7964 | 0.07 [-0.28, 0.45] [-0.28, 0.40] | 0.95 [0.75, 1.19] [0.77, 1.21] | 16/16, 1.0000 | 0.6588 | 1.0000 (0.1250) |
| H3: none@L3 − mcp@L2 | 40 | 29 | -4 | 0.7431 | 0.7408 | -0.10 [-0.53, 0.33] [-0.50, 0.30] | 1.07 [0.80, 1.41] [0.82, 1.40] | 12/17, 0.4583 | 0.6853 | 1.0000 (0.1250) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0167 | false | 0.0167 | false | false | true | false |
| H2 | 0.0500 | false | 0.0500 | false | false | true | false |
| H3 | 0.0250 | false | 0.0250 | false | false | — | — |

**The finding 2 rule (D and D† must agree):**

- H1: not rejected under D or D†: no difference detected at RR <= 0.25 MDE.
- H2: not rejected under D or D†: no difference detected at RR <= 0.25 MDE.

## 4. Equivalence E (none@L3 vs mcp@L2)

d̄ = -0.10; 90 % within-task interval [-0.45, 0.25]; Δ = 0.55 → within: true; Δ₂ = 0.28 (secondary, descriptive) → within: false; pooled treated mean D 1.50. **E holds: the two cells are within ±0.55 D per block of each other.**

## 5. Sensitivity

- **D†** (no composition-root exemption):

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 40 | 23 | 7 | 0.4076 | 0.4085 | 0.17 [-0.15, 0.53] [-0.05, 0.40] | 0.89 [0.71, 1.11] [0.77, 1.03] | 14/9, 0.4049 | 0.4287 | 0.5000 (0.1250) |
| H2: none@L2 − mcp@L2 | 40 | 32 | 3 | 0.7944 | 0.7964 | 0.07 [-0.28, 0.45] [-0.28, 0.40] | 0.95 [0.75, 1.19] [0.77, 1.21] | 16/16, 1.0000 | 0.6588 | 1.0000 (0.1250) |
| H3: none@L3 − mcp@L2 | 40 | 29 | -4 | 0.7431 | 0.7408 | -0.10 [-0.53, 0.33] [-0.50, 0.30] | 1.07 [0.80, 1.41] [0.82, 1.40] | 12/17, 0.4583 | 0.6853 | 1.0000 (0.1250) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0167 | false | 0.0167 | false | false | true | false |
| H2 | 0.0500 | false | 0.0500 | false | false | true | false |
| H3 | 0.0250 | false | 0.0250 | false | false | — | — |

- **Evasion bar:** not given (needs D†).
- **D_sem (semantic secondary, descriptive):** H1: D_sem not available (semantic layer not run, or configuration pending); H2: D_sem not available (semantic layer not run, or configuration pending); H3: D_sem not available (semantic layer not run, or configuration pending).
- **Y₁ = 0 blocks dropped** (40 blocks): H1 reject false, H2 reject false, H3 reject false; exact p H1 0.4085, H2 0.7964, H3 0.7408.
- **Robustness:** H1 sign test p 0.4049, signed-rank p 0.4287; H2 sign test p 1.0000, signed-rank p 0.6588; H3 sign test p 0.4583, signed-rank p 0.6853.
- **Run-index halves** (replicates ≤ 5 vs the rest): first half 20 blocks, mean D none@L2 1.60, d̄ {"H1":0.4,"H2":0.05,"H3":-0.35}; second half 20 blocks, mean D none@L2 1.65, d̄ {"H1":-0.05,"H2":0.1,"H3":0.15}; sign reversal {"H1":true,"H2":false,"H3":true}.
- **By lane:** no order file given.
- **Unmapped-flag drop:** no flagged block given.

## 6. V4 (ADR-V14-04 §4 as amended)

- Part A: not computed (needs --analysis and the F-RF scores).
- Part B: not computed (no --recall).
- **Reading:** part B not computed (no seeded-recall input).

## 7. Evasion items computed here

- Item 6 (mechanism): no telemetry given.
- Item 1 (acceptance): no acceptance file given.
- Item 7 (concentration): no --analysis given.
- Items 2–5 come from their own tools (size and coverage: `snapshot-coverage.ts`; literal view: the literal re-score; moved-only: the blind read).
