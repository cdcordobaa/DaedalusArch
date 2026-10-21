# Study 2b analysis (seed 20261021, MC draws 99999, bootstrap 10000)

Inputs: runs: runs.json sha256 2fbf7fdae280910477ee0d6de103aed9afc35dcdb4d987032a2129741d84212c; dagger: runs.json sha256 cced850da74e782a791ca26f3b2b61a59e01737c6ee67e3650fd79a145d61d6c; order: order.jsonl sha256 f51b607cc241c99df833f42286d0ce21a74f2b89fe293100cf72bca75d40a744; scores: scores.json sha256 4b0c8164113322a82999b859af4070ab4589b71201489b25f26df007718e3f4b; analysis: analysis.json sha256 f5be4b2a06874e16e041ccb2c404305f240ffb6deaf01f3c29e745c611104624; recall none@L2: l2/run.json sha256 51154a553c431bb92cce1cf78a504648d0dc55334089e04af014e2f3efcb7409; recall none@L3: l3/run.json sha256 435f2ea9f13b3c6831a5ca001c86ef536f591eb28fe6300edd9e211a9b133945; recall mcp@L2: mcp/run.json sha256 2b1d1ee7438ecad3ee47a7d51694e0114881d49a22512548771f01c6836df2b8; telemetry 1: telemetry.json sha256 982ee7fbdc849f45c262e43a13df55b348bb6a4dadcd0947a56493f2fd5876fd; telemetry 2: telemetry.json sha256 b512b15245383ae670f04e626697ba1adf81d41dc78ee06d5217bc7c9fd7650a; telemetry 3: telemetry.json sha256 3bddac870f2c0667d0d231182250524e9dd2ae6f7b78a9daafa6fbb92dee9146; telemetry 4: telemetry.json sha256 6bac04591858c52d4d67e9082aaefaa8cc24c0b36a667707d9fb5bd5d52d5779; telemetry 5: telemetry.json sha256 08fc7a880e5c4992974652d921692daf7bf95c4f0fe26111450aecc77ac58066; telemetry 6: telemetry.json sha256 e8db2aec926016671df7de842c1bf460e205b6570f069ee8ea20b5db0b2f4920; telemetry 7: telemetry.json sha256 0a92bfb957be328ac8dc0c3e6aec8c3497f374f4487ee400ad78400d6a130740; telemetry 8: telemetry.json sha256 7e04185976589e511ed99c06108ebbcb665f0649d1f8c453817e238385d7daeb; telemetry 9: telemetry.json sha256 9ff5f512ed13317ef463526ca58f985b039f53639c8c94c21c7acb26e3835ec7; telemetry 10: telemetry.json sha256 fce6c21e75ca02007947abc9cbb21ad2103e9e609383a3adfa571dc2a4c0eca0; acceptance: acceptance-rows.json sha256 1df2e1a590096317afca54e3b3b14c72459dff2c99d63928216556888c0d31a4.

Complete blocks: 40; incomplete (left out of every paired test): none. Blocks with Y₁ = 0: 12.

## 1. Per-block table

| Block | Y₁ | D none@L2 | D none@L3 | D mcp@L2 | Yₖ none@L2 | Yₖ none@L3 | Yₖ mcp@L2 |
|---|---|---|---|---|---|---|---|
| community-radio/rep1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| community-radio/rep10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| community-radio/rep2 | 2 | 6 | 0 | 0 | 8 | 0 | 0 |
| community-radio/rep3 | 2 | 9 | 8 | 0 | 11 | 10 | 0 |
| community-radio/rep4 | 2 | 9 | 0 | 0 | 11 | 0 | 0 |
| community-radio/rep5 | 2 | 9 | 8 | 0 | 11 | 10 | 0 |
| community-radio/rep6 | 2 | 9 | 8 | 7 | 11 | 10 | 9 |
| community-radio/rep7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| community-radio/rep8 | 2 | 8 | 6 | 0 | 10 | 8 | 0 |
| community-radio/rep9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| laundromat/rep1 | 2 | 1 | 0 | 0 | 3 | 0 | 0 |
| laundromat/rep10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| laundromat/rep2 | 1 | 0 | 0 | 0 | 1 | 0 | 1 |
| laundromat/rep3 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| laundromat/rep4 | 4 | 4 | 0 | 1 | 8 | 0 | 0 |
| laundromat/rep5 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| laundromat/rep6 | 0 | 0 | 2 | 0 | 0 | 2 | 0 |
| laundromat/rep7 | 3 | 5 | 6 | 4 | 8 | 9 | 7 |
| laundromat/rep8 | 2 | 1 | 0 | 0 | 3 | 0 | 0 |
| laundromat/rep9 | 4 | 8 | 0 | 6 | 12 | 0 | 10 |
| lost-property/rep1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lost-property/rep10 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| lost-property/rep2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lost-property/rep3 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| lost-property/rep4 | 2 | 2 | 2 | 2 | 4 | 4 | 4 |
| lost-property/rep5 | 3 | 5 | 0 | 4 | 8 | 0 | 0 |
| lost-property/rep6 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| lost-property/rep7 | 2 | 2 | 4 | 0 | 4 | 4 | 0 |
| lost-property/rep8 | 2 | 2 | 0 | 0 | 4 | 0 | 0 |
| lost-property/rep9 | 0 | 1 | 0 | 0 | 1 | 0 | 0 |
| parking-permits/rep1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parking-permits/rep10 | 3 | 4 | 4 | 4 | 7 | 7 | 7 |
| parking-permits/rep2 | 4 | 4 | 4 | 5 | 8 | 8 | 9 |
| parking-permits/rep3 | 4 | 4 | 0 | 4 | 8 | 0 | 8 |
| parking-permits/rep4 | 4 | 5 | 0 | 4 | 9 | 0 | 8 |
| parking-permits/rep5 | 4 | 4 | 8 | 4 | 8 | 8 | 8 |
| parking-permits/rep6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parking-permits/rep7 | 3 | 4 | 4 | 4 | 7 | 7 | 7 |
| parking-permits/rep8 | 4 | 4 | 4 | 4 | 8 | 7 | 8 |
| parking-permits/rep9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## 2. Distributions

| Cell | n | ΣD | mean D | histogram of D | P(D = 0) [95 % Wilson] |
|---|---|---|---|---|---|
| none@L2 | 40 | 110 | 2.75 | 0: 17, 1: 3, 2: 3, 4: 7, 5: 3, 6: 1, 8: 2, 9: 4 | 0.42 [0.29, 0.58] |
| none@L3 | 40 | 68 | 1.70 | 0: 27, 2: 2, 4: 5, 6: 2, 8: 4 | 0.68 [0.52, 0.80] |
| mcp@L2 | 40 | 53 | 1.32 | 0: 27, 1: 1, 2: 1, 4: 8, 5: 1, 6: 1, 7: 1 | 0.68 [0.52, 0.80] |

| Contrast | both D = 0 | reference 0 only | other 0 only | neither 0 |
|---|---|---|---|---|
| H1 | 16 | 1 | 11 | 12 |
| H2 | 17 | 0 | 10 | 13 |
| H3 | 22 | 5 | 5 | 8 |

## 3. Confirmatory tests (D)

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 40 | 19 | 42 | 0.0133 | 0.0132 | 1.05 [0.33, 1.85] [0.55, 1.65] | 0.62 [0.38, 0.86] [0.45, 0.75] | 15/4, 0.0192 | 0.0146 | 0.1250 (0.1250) |
| H2: none@L2 − mcp@L2 | 40 | 17 | 57 | 0.0002 | 0.0001 | 1.43 [0.78, 2.10] [0.20, 3.38] | 0.48 [0.32, 0.65] [0.19, 0.92] | 16/1, 0.0003 | 0.0001 | 0.2500 (0.1250) |
| H3: none@L3 − mcp@L2 | 40 | 14 | 15 | 0.4262 | 0.4257 | 0.38 [-0.35, 1.15] [-0.40, 1.65] | 0.78 [0.47, 1.31] [0.33, 1.29] | 8/6, 0.7905 | 0.4393 | 1.0000 (0.1250) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0250 | true | 0.0250 | true | true | true | true |
| H2 | 0.0167 | true | 0.0167 | true | true | true | true |
| H3 | 0.0500 | false | 0.0500 | false | false | — | — |

**The finding 2 rule (D and D† must agree):**

- H1: supported (D and D† agree).
- H2: supported (D and D† agree).

## 4. Equivalence E (none@L3 vs mcp@L2)

d̄ = 0.38; 90 % within-task interval [-0.25, 1.02]; Δ = 0.55 → within: false; Δ₂ = 0.28 (secondary, descriptive) → within: false; pooled treated mean D 1.51. **E fails: nothing is claimed about the two cells being equal.**

## 5. Sensitivity

- **D†** (no composition-root exemption):

| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |
|---|---|---|---|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | 40 | 20 | 43 | 0.0110 | 0.0109 | 1.07 [0.35, 1.88] [0.55, 1.65] | 0.65 [0.44, 0.87] [0.49, 0.79] | 16/4, 0.0118 | 0.0121 | 0.1250 (0.1250) |
| H2: none@L2 − mcp@L2 | 40 | 19 | 59 | 0.0002 | 0.0002 | 1.48 [0.82, 2.15] [0.15, 3.42] | 0.52 [0.38, 0.68] [0.19, 0.95] | 17/2, 0.0007 | 0.0001 | 0.2500 (0.1250) |
| H3: none@L3 − mcp@L2 | 40 | 18 | 16 | 0.3985 | 0.3978 | 0.40 [-0.33, 1.18] [-0.50, 1.63] | 0.80 [0.54, 1.23] [0.34, 1.26] | 10/8, 0.8145 | 0.3909 | 0.8750 (0.1250) |

Holm over {H1, H2, H3} at FWER 0.05. MC and exact decisions agree.

| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |
|---|---|---|---|---|---|---|---|
| H1 | 0.0250 | true | 0.0250 | true | true | true | true |
| H2 | 0.0167 | true | 0.0167 | true | true | true | true |
| H3 | 0.0500 | false | 0.0500 | false | false | — | — |

- **Evasion bar** (exempt-file share of presentation → persistence edges at step 5; share of runs with a rename to an exempt name; flag above 0.20): H1 exempt-share diff 0.07, rename-share diff 0.00, flagged false; H2 exempt-share diff 0.05, rename-share diff 0.00, flagged false; H3 exempt-share diff 0.02, rename-share diff 0.00, flagged false. Cells: none@L2 27/205 exempt, 0/40 runs renamed; none@L3 24/118 exempt, 0/40 runs renamed; mcp@L2 19/105 exempt, 0/40 runs renamed.
- **D_sem (semantic secondary, descriptive):** H1: D_sem not available (semantic layer not run, or configuration pending); H2: D_sem not available (semantic layer not run, or configuration pending); H3: D_sem not available (semantic layer not run, or configuration pending).
- **D_sem two ways (all claims vs non-agent claims only):** H1: not available (one of the two D_sem versions is missing); H2: not available (one of the two D_sem versions is missing); H3: not available (one of the two D_sem versions is missing).
- **Y₁ = 0 blocks dropped** (28 blocks): H1 reject true, H2 reject true, H3 reject false; exact p H1 0.0096, H2 0.0002, H3 0.4939.
- **Robustness:** H1 sign test p 0.0192, signed-rank p 0.0146; H2 sign test p 0.0003, signed-rank p 0.0001; H3 sign test p 0.7905, signed-rank p 0.4393.
- **Run-index halves** (replicates ≤ 5 vs the rest): first half 20 blocks, mean D none@L2 3.10, d̄ {"H1":1.6,"H2":1.9,"H3":0.3}; second half 20 blocks, mean D none@L2 2.40, d̄ {"H1":0.5,"H2":0.95,"H3":0.45}; sign reversal {"H1":false,"H2":false,"H3":false}.
- **By lane:** {"none@L2":[{"lane":"l2","blocks":40,"meanD":2.75}],"none@L3":[{"lane":"A","blocks":20,"meanD":1.9},{"lane":"B","blocks":20,"meanD":1.5}],"mcp@L2":[{"lane":"A","blocks":20,"meanD":1.35},{"lane":"B","blocks":20,"meanD":1.3}]}.
- **Unmapped-flag drop** (laundromat/rep2, laundromat/rep3, lost-property/rep7, lost-property/rep8): {"H1":{"reject":true,"predictedSign":true,"supportedUnderThisOutcome":true,"sign":1},"H2":{"reject":true,"predictedSign":true,"supportedUnderThisOutcome":true,"sign":1},"H3":{"reject":false,"predictedSign":null,"supportedUnderThisOutcome":null,"sign":1}}.

## 6. V4 (ADR-V14-04 §4 as amended)

- **Part A** (r_f under F-RF: FF-S01 0.67, FF-S02 1.00, FF-S03 1.00, FF-P01 0.88, FF-P06 0.88; pooled 0.88): m_c none@L2 0.000, none@L3 0.000, mcp@L2 0.000; pairs none@L2/none@L3 |Δm| 0.000 pass; none@L2/mcp@L2 |Δm| 0.000 pass; none@L3/mcp@L2 |Δm| 0.000 pass. **Uninformative:** FF-S03 carries ≥ 90 % of counted identities in every cell.
- **Part B** (non-exempt sites): none@L2 71/71 (1.00), exempt share 0.04 (3/74); none@L3 76/76 (1.00), exempt share 0.05 (4/80); mcp@L2 71/71 (1.00), exempt share 0.10 (8/79); pairs none@L2 − none@L3 0.00 [0.00, 0.00] pass; none@L2 − mcp@L2 0.00 [0.00, 0.00] pass; none@L3 − mcp@L2 0.00 [0.00, 0.00] pass.
- **Reading:** part A uninformative (one family >= 90 % in every cell; reported); part B passes: Layered confirmatory, conditional on part B.

## 7. Evasion items computed here

- **Item 6 (mechanism):** tool use in 160/160 mcp@L2 steps (1.00), a check_* call in 28 (0.17); bar 0.80 → pass.
- **Item 1 (acceptance):** {"rates":{"none@L2":0.74,"none@L3":0.75,"mcp@L2":0.755},"gaps":[{"cell":"none@L3","gapPoints":-1.0000000000000009,"oneSidedPass":true,"twoSidedPass":true},{"cell":"mcp@L2","gapPoints":-1.5000000000000013,"oneSidedPass":true,"twoSidedPass":true}]}.
- **Item 7 (concentration):** 100 % of counted identities are FF-S03: the claim is scoped to that family (composition-root wiring, G12). Without the dominant family: {"decisions":{"H1":{"reject":false,"predictedSign":false,"supportedUnderThisOutcome":false,"sign":0},"H2":{"reject":false,"predictedSign":false,"supportedUnderThisOutcome":false,"sign":0},"H3":{"reject":false,"predictedSign":null,"supportedUnderThisOutcome":null,"sign":0}},"exactP":{"H1":1,"H2":1,"H3":1},"dbar":{"H1":0,"H2":0,"H3":0}}.
- Items 2–5 come from their own tools (size and coverage: `snapshot-coverage.ts`; literal view: the literal re-score; moved-only: the blind read).
