# Study 2b analysis (seed 20261021, MC draws 99999, bootstrap 10000)

Inputs: runs: runs.json sha256 f67c9c14ec5d6ea5623784ffd799d5c2ecd833ae67e7d224c99107db1fe85b52; plant: effect: none@L2 (D, Y1) drawn from the --runs none@L2 blocks; treated cells binomial thinning, keep 0.25 (RR about 0.25); dagger: planted: D† = D by construction; scores: scores.json sha256 4b0c8164113322a82999b859af4070ab4589b71201489b25f26df007718e3f4b.

Complete blocks: 40; incomplete (left out of every paired test): none. Blocks with Y₁ = 0: 0.

## 1. Per-block table

| Block | Y₁ | D none@L2 | D none@L3 | D mcp@L2 | Yₖ none@L2 | Yₖ none@L3 | Yₖ mcp@L2 |
|---|---|---|---|---|---|---|---|
| planted-task-1/rep1 | 4 | 3 | 1 | 0 | null | null | null |
| planted-task-2/rep1 | 1 | 0 | 0 | 0 | null | null | null |
| planted-task-3/rep1 | 4 | 3 | 1 | 1 | null | null | null |
| planted-task-4/rep1 | 4 | 3 | 0 | 0 | null | null | null |
| planted-task-1/rep2 | 1 | 2 | 0 | 1 | null | null | null |
| planted-task-2/rep2 | 1 | 1 | 1 | 0 | null | null | null |
| planted-task-3/rep2 | 4 | 1 | 0 | 0 | null | null | null |
| planted-task-4/rep2 | 1 | 1 | 1 | 0 | null | null | null |
| planted-task-1/rep3 | 1 | 2 | 0 | 0 | null | null | null |
| planted-task-2/rep3 | 1 | 1 | 0 | 1 | null | null | null |
| planted-task-3/rep3 | 4 | 1 | 0 | 0 | null | null | null |
| planted-task-4/rep3 | 1 | 0 | 0 | 0 | null | null | null |
| planted-task-1/rep4 | 4 | 3 | 1 | 0 | null | null | null |
| planted-task-2/rep4 | 4 | 1 | 0 | 0 | null | null | null |
| planted-task-3/rep4 | 1 | 2 | 1 | 0 | null | null | null |
| planted-task-4/rep4 | 4 | 1 | 1 | 0 | null | null | null |
| planted-task-1/rep5 | 1 | 0 | 0 | 0 | null | null | null |
| planted-task-2/rep5 | 4 | 1 | 1 | 1 | null | null | null |
| planted-task-3/rep5 | 4 | 3 | 2 | 0 | null | null | null |
| planted-task-4/rep5 | 1 | 1 | 0 | 1 | null | null | null |
| planted-task-1/rep6 | 1 | 2 | 0 | 1 | null | null | null |
| planted-task-2/rep6 | 4 | 1 | 0 | 0 | null | null | null |
| planted-task-3/rep6 | 1 | 2 | 1 | 1 | null | null | null |
| planted-task-4/rep6 | 1 | 2 | 0 | 0 | null | null | null |
| planted-task-1/rep7 | 1 | 2 | 0 | 0 | null | null | null |
| planted-task-2/rep7 | 1 | 2 | 0 | 0 | null | null | null |
| planted-task-3/rep7 | 1 | 2 | 0 | 0 | null | null | null |
| planted-task-4/rep7 | 4 | 1 | 0 | 0 | null | null | null |
| planted-task-1/rep8 | 1 | 0 | 0 | 0 | null | null | null |
| planted-task-2/rep8 | 1 | 2 | 1 | 0 | null | null | null |
| planted-task-3/rep8 | 1 | 0 | 0 | 0 | null | null | null |
| planted-task-4/rep8 | 1 | 2 | 0 | 0 | null | null | null |
| planted-task-1/rep9 | 4 | 1 | 0 | 1 | null | null | null |
| planted-task-2/rep9 | 1 | 2 | 1 | 1 | null | null | null |
| planted-task-3/rep9 | 4 | 1 | 1 | 0 | null | null | null |
| planted-task-4/rep9 | 1 | 1 | 1 | 0 | null | null | null |
| planted-task-1/rep10 | 4 | 1 | 0 | 0 | null | null | null |
| planted-task-2/rep10 | 4 | 3 | 0 | 2 | null | null | null |
| planted-task-3/rep10 | 4 | 1 | 1 | 0 | null | null | null |
| planted-task-4/rep10 | 1 | 0 | 0 | 0 | null | null | null |

## 2. Distributions

| Cell | n | ΣD | mean D | histogram of D | P(D = 0) [95 % Wilson] |
|---|---|---|---|---|---|
| none@L2 | 40 | 58 | 1.45 | 0: 6, 1: 16, 2: 12, 3: 6 | 0.15 [0.07, 0.29] |
| none@L3 | 40 | 16 | 0.40 | 0: 25, 1: 14, 2: 1 | 0.63 [0.47, 0.76] |
| mcp@L2 | 40 | 11 | 0.28 | 0: 30, 1: 9, 2: 1 | 0.75 [0.60, 0.86] |

| Contrast | both D = 0 | reference 0 only | other 0 only | neither 0 |
|---|---|---|---|---|
| H1 | 6 | 0 | 19 | 15 |
| H2 | 6 | 0 | 24 | 10 |
| H3 | 19 | 6 | 11 | 4 |

## 3. Confirmatory tests (D)

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 40 | 27 | 42 | 1.00e-5 | 1.49e-8 | 1.05 [0.78, 1.32] [0.90, 1.27] | 0.28 [0.18, 0.39] [0.16, 0.40] | 27/0, 1.49e-8 | 1.49e-8 | 0.1250 (0.1250) |
| H2: none@L2 − mcp@L2 | 40 | 30 | 47 | 1.00e-5 | 1.86e-9 | 1.18 [0.90, 1.48] [1.00, 1.35] | 0.19 [0.10, 0.29] [0.11, 0.30] | 30/0, 1.86e-9 | 1.86e-9 | 0.1250 (0.1250) |
| H3: none@L3 − mcp@L2 | 40 | 17 | 5 | 0.4107 | 0.4097 | 0.13 [-0.10, 0.33] [-0.10, 0.35] | 0.69 [0.32, 1.30] [0.30, 1.33] | 11/6, 0.3323 | 0.4027 | 0.6250 (0.1250) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0167 | true | 0.0250 | true | true | true | true |
| H2 | 0.0250 | true | 0.0167 | true | true | true | true |
| H3 | 0.0500 | false | 0.0500 | false | false | — | — |

**The finding 2 rule (D and D† must agree):**

- H1: supported (D and D† agree).
- H2: supported (D and D† agree).

## 4. Equivalence E (none@L3 vs mcp@L2)

d̄ = 0.13; 90 % within-task interval [-0.05, 0.30]; Δ = 0.55 → within: true; Δ₂ = 0.28 (secondary, descriptive) → within: false; pooled treated mean D 0.34. **E not established: the 90 % interval lies inside ±0.55, but the pooled treated-cell mean D (0.34) is below Δ.**

## 5. Sensitivity

- **D†** (no composition-root exemption):

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 40 | 27 | 42 | 1.00e-5 | 1.49e-8 | 1.05 [0.78, 1.32] [0.90, 1.27] | 0.28 [0.18, 0.39] [0.16, 0.40] | 27/0, 1.49e-8 | 1.49e-8 | 0.1250 (0.1250) |
| H2: none@L2 − mcp@L2 | 40 | 30 | 47 | 1.00e-5 | 1.86e-9 | 1.18 [0.90, 1.48] [1.00, 1.35] | 0.19 [0.10, 0.29] [0.11, 0.30] | 30/0, 1.86e-9 | 1.86e-9 | 0.1250 (0.1250) |
| H3: none@L3 − mcp@L2 | 40 | 17 | 5 | 0.4107 | 0.4097 | 0.13 [-0.10, 0.33] [-0.10, 0.35] | 0.69 [0.32, 1.30] [0.30, 1.33] | 11/6, 0.3323 | 0.4027 | 0.6250 (0.1250) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0167 | true | 0.0250 | true | true | true | true |
| H2 | 0.0250 | true | 0.0167 | true | true | true | true |
| H3 | 0.0500 | false | 0.0500 | false | false | — | — |

- **Evasion bar:** not given (needs D†).
- **D_sem (semantic secondary, descriptive):** H1: D_sem not available (semantic layer not run, or configuration pending); H2: D_sem not available (semantic layer not run, or configuration pending); H3: D_sem not available (semantic layer not run, or configuration pending).
- **D_sem two ways (all claims vs non-agent claims only):** H1: not available (one of the two D_sem versions is missing); H2: not available (one of the two D_sem versions is missing); H3: not available (one of the two D_sem versions is missing).
- **Y₁ = 0 blocks dropped** (40 blocks): H1 reject true, H2 reject true, H3 reject false; exact p H1 1.49e-8, H2 1.86e-9, H3 0.4097.
- **Robustness:** H1 sign test p 1.49e-8, signed-rank p 1.49e-8; H2 sign test p 1.86e-9, signed-rank p 1.86e-9; H3 sign test p 0.3323, signed-rank p 0.4027.
- **Run-index halves** (replicates ≤ 5 vs the rest): first half 20 blocks, mean D none@L2 1.50, d̄ {"H1":1,"H2":1.25,"H3":0.25}; second half 20 blocks, mean D none@L2 1.40, d̄ {"H1":1.1,"H2":1.1,"H3":0}; sign reversal {"H1":false,"H2":false,"H3":false}.
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
