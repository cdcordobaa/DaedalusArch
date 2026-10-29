# DETECT-02 held-out set: the one scoring (SO4 hold-out, v1.5 final study)

**Date:** 2026-10-29 (scored about 01:40Z). **Status:** held-out, scored once, zero model calls. Registered in
`Docs/v1.5/final-study-preregistration.md` §4, "SO4 hold-out (separate, zero calls)". Reported beside the study; not
an outcome of H1 or H2. Scoring note, committed and pushed before the run:
`experiments/detect-02-heldout/SCORING.md` (`82be5f8de`). Record: `results/detect-02-heldout/result.json`.

## Setup

| Item | Value |
|---|---|
| Set | `daedalus-heldout/detect-02/`, next to the repository, never committed: 34 projects (14 positives, 14 clean twins, 6 negative controls), `KEY.json`, `README.md` |
| Seal | sha256 of `MANIFEST.sha256` = `afacdd86…66f7ab`, equal to `experiments/detect-02-heldout/SEAL.md`; all 433 manifest lines verify; no unlisted case file |
| Commit | `82be5f8de` (branch `results/detect-02-heldout` on `main` `951537f54`); `src/v15-instrument` identical to `a228c3f94` and `ea0da2b61` |
| Rule hash | `experiments/hcal-05/RULES-FROZEN.sha256` sha256 `761f37d9…` (the study rule hash); 39/39 files verify |
| Rules | the 20 rules of `src/v15-instrument/rules/`, called as the study scorer calls them (`runTree(tree, rules, { spec, scratch })`, the case's `spec.yaml`) |
| Scorer | `npx tsx experiments/detect-02-heldout/score.ts --root ../daedalus-heldout/detect-02`: the scoring logic of the DETECT-02 development scorer (`experiments/detect-02/evaluate.ts`) over the study instrument. The design's `EVALUATE-HELDOUT.md` (`ops/notes/detect-02-design.md` §7) was never committed |
| Model calls | 0. The design's symbolic+semantic reading is not run (the pre-registration makes this scoring zero-call) |
| Errors | none; every project built; max 331 ms per project |

**Bars** (`ops/notes/detect-02-precision-note.md` §3, bar 3; `ops/notes/explore-02-needs-and-gaps.md` N2): report per
family TP / FP / FN, twin discrimination and negative-control false positives, whatever they are. **No numeric bar was
registered: this scoring is descriptive, with no pass or fail.** No rule, fact or spec was changed after the output
was seen.

## Result

Detected = a violation of the case's family fires on the project (development-scorer reading, fixed in
`SCORING.md`). Located = such a violation names the labelled file (all located hits are in the labelled method or
declaration). A pair discriminates when the positive is detected and its twin has no violation of that family.

| KEY family (rule family, rule built for it) | Positives | Detected | Located | Twins flagged (same family) | Pairs discriminating |
|---|---|---|---|---|---|
| D4 (D4, R-D4) | 3 | 2 | 2 | 1 (hc-28) | 1 / 3 |
| cross-context write (D4, R-XCTX) | 3 | 2 | 2 | 0 | 2 / 3 |
| D5/D3 (D5) | 2 | 1 | 1 | 0 | 1 / 2 |
| D9 (D9, R-D9) | 2 | 2 | 2 | 0 | 2 / 2 |
| H5 (H5, R-H5) | 2 | 2 | 2 | 0 | 2 / 2 |
| concrete injection (H4, R-INJ) | 1 | 1 | 1 | 0 | 1 / 1 |
| vendor call in a transaction (RTX, R-RTX) | 1 | 0 | 0 | 0 | 0 / 1 |
| **All families** | **14** | **10** | **10** | **1 of 14** | **9 / 14** |
| **Admitted families only** (D4, cross-context write, D9, H5, concrete injection) | **11** | **9** (recall 9/11) | **9** | **1 of 11** (hc-28) | **8 / 11** |

On both detected cross-context positives (hc-03, hc-24) R-XCTX fires, and R-D4 fires too. On every detected positive
the rule the family was built for fires.

**False positives, every violation on a clean project:**

| Set | Projects with any violation | Findings |
|---|---|---|
| Twins (14) | 1 (hc-28) | R-D4 ×1 |
| Negative controls (6) | 2 (hc-11, hc-34) | R-D5 ×2, R-LOCK ×1 |

**Per rule family over all 34 projects** (development-scorer `score()`; a family not labelled on a project is a
negative for it):

| Family | TP | FN | FP on twins | FP on negatives | FP on positives of another family |
|---|---|---|---|---|---|
| D4 (R-D4, R-XCTX, R-D4R, R-REF) | 4 | 2 | 1 (hc-28) | 0 | 0 |
| D5 (R-D5, R-D5S, R-D3, R-LOCK) | 1 | 1 | 0 | 2 (hc-11, hc-34) | 0 |
| D9 | 2 | 0 | 0 | 0 | 0 |
| H5 | 2 | 0 | 0 | 0 | 0 |
| H4 | 1 | 0 | 0 | 0 | 0 |
| RTX | 0 | 1 | 0 | 0 | 0 |
| H10 (R-ENTITY-OUT) | — | — | 0 | 0 | 1 (hc-19) |
| D2, H3, H6, H7, H8, H9, H11 | — | — | 0 | 0 | 0 |

**Per rule (findings, projects):** R-D4 5 (4 positives, 1 twin); R-XCTX 2 (2 positives); R-D9 3 (2 positives); R-D5
4 (1 positive with 2 findings, 2 negatives); R-H5 2 (2 positives); R-INJ 1 (1 positive); R-ENTITY-OUT 1 (1 positive);
R-LOCK 1 (1 negative). R-D3, R-D4R, R-D5S, R-REF, R-PURE, R-RTX, R-AXA, R-ADAPTER-RULE, R-COREIO, R-LOCATOR, R-MIRROR
and R-TRANSPORT: 0 findings.

**The set's own scoring guidance** (in its `README.md`, read after scoring): a twin counts as a false positive only
for the positive's family and a negative control only for its `near_family`. Under that reading the twins have 1 false
positive (hc-28) and the negative controls 1 (hc-34, near family D5/D3); hc-11's R-D5 finding is not of its near family
(cross-context write / D4). Positives: 10 of 14, unchanged.

**Relation to the study's admitted rules** (pre-registration §1): R-D4, R-XCTX, R-D9, R-H5, R-INJ are admitted for DDD
and R-ENTITY-OUT for Hexagonal; R-D5 (only R-D5S is admitted, for K10) and R-LOCK are not admitted. The twin false
positive (hc-28) is an admitted rule; both negative-control findings are rules outside D_v15.

## Misses (4), read after scoring

Text copied from the set (rationales, labelled lines, code) is not reproduced here, as the set's `README.md` requires;
only the case id, the family, the labelled file and the shape, in general terms, are given.

| Case | KEY family | Labelled file | Detected | Shape (general terms; no change made) |
|---|---|---|---|---|
| hc-07 | D5/D3 | `src/workshops/application/support/capacityGuard.ts` | no | the duplicated invariant check sits in an application helper function outside the `application_services` glob |
| hc-08 | vendor call in a transaction | `src/application/ConfirmDonation.ts` | no | the transaction is a method decorator; R-RTX reads a transaction scope only as a callback argument (`detect-02-design.md` §2) |
| hc-22 | D4 | `src/planning/application/CloseSprint.ts` | no | both aggregates are registered on an explicit unit-of-work port that loads no root, so under the R1 sink taxonomy (`detect-02-precision-note.md` §5) these are not root writes |
| hc-30 | cross-context write | `src/sales/application/PurchaseTickets.ts` | no | the second context is written through a synchronous in-process event bus; the footprint stops at messaging owners by design (§2) |

## False positives (3 projects), read after scoring

| Case | Kind, KEY family / near family | Rule, file, line | Shape (general terms) |
|---|---|---|---|
| hc-28 | twin of hc-06, D4 | R-D4, `src/guests/application/MergeGuestProfiles.ts`, 16 | one root is written through a helper that maps over a root-collection parameter; the helper is counted as more than one instance. The positive hc-06 gets the same finding, so its detection does not separate one instance from two |
| hc-11 | negative, near family cross-context write / D4 | R-D5, `src/inventory/application/ReserveStockOnOrderPlaced.ts`, 13 | an event consumer branches on an aggregate method's result and returns (no throw); the near family stays quiet |
| hc-34 | negative, near family D5/D3 | R-D5, `src/membership/application/RegisterMember.ts`, 19; R-LOCK, same file, 16 | R-D5 fires on a returning branch after an idempotency lookup; R-LOCK reads an injected function-typed dependency as a scope around the write |

**Off-target finding on a positive:** hc-19 (D9) also gets R-ENTITY-OUT (H10) at `src/subscriptions/api/PlanEndpoints.ts`,
line 9, the inbound adapter that returns the same labelled defect; counted as an H10 finding on a positive of another
family, as the development scorer counts it.

## Notes

- Roots: declared in the spec on 27 projects, inferred (fallback) on 5 (hc-01, hc-08, hc-29, hc-32, hc-33), none on 2
  Hexagonal projects without aggregates (hc-16, hc-31).
- The harness tsconfig the study uses includes `src/**` only; the cases' ambient vendor declarations
  (`types/*.d.ts`) are therefore not in the program. This is the study's configuration and was fixed before scoring.
- The record `results/detect-02-heldout/result.json` was redacted after scoring (KEY rationales and labels, labelled
  lines, finding evidence and call paths removed); scores are unchanged.
- The set is now spent as a held-out set: any later use of it is development material.
