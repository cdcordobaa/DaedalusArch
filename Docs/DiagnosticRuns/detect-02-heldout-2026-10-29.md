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
family TP / FP / FN, twin discrimination and negative-control false positives, whatever they are. No numeric threshold
is registered, so there is no pass or fail; the outcome of the bar is the table below. No rule, fact or spec was
changed after the output was seen.

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
| **All** | **14** | **10** | **10** | **1 of 14** | **9 / 14** |

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

| Case | KEY | Labelled site | What the case does | Reading of the shape (no change made) |
|---|---|---|---|---|
| hc-07 (P08) | D5/D3 | `src/workshops/application/support/capacityGuard.ts:6` | the Workshop capacity check, also enforced in `Workshop.enrol`, is repeated in a free helper function under `application/support/` that the use case calls first | the throwing guard compares a local derived from two root properties (`capacity - attendeeCount`) inside a helper outside the `application_services` glob; no D5 rule fires |
| hc-08 (P14) | vendor call in a transaction | `src/application/ConfirmDonation.ts:15` | `confirm` runs under a `@Transactional()` method decorator and calls the payment capture (Stripe adapter) through a private helper | R-RTX reads a transaction scope as a callback argument (`detect-02-design.md` §2); a decorator is not such a scope. The vendor module is declared in `types/*.d.ts`, outside the harness tsconfig's `src/**` |
| hc-22 (P02) | D4 | `src/planning/application/CloseSprint.ts:22` | the Sprint and each unfinished Ticket are `registerDirty`-ed on an explicit unit of work, committed once | the writes go to a unit-of-work port that loads no root, so under the R1 sink taxonomy (`detect-02-precision-note.md` §5) they are not writes of a root |
| hc-30 (P06) | cross-context write | `src/sales/application/PurchaseTickets.ts:28` | the sales command awaits `events.publish(…)` inside its unit of work; the in-process bus runs the loyalty handler synchronously, which stores a MemberAccount | the footprint stops at messaging owners (bus, publisher) by design (§2), so a synchronous in-process bus hides the second context's write |

## False positives (3 projects), read after scoring

| Case | Kind (KEY) | Finding | What the case does | Reading |
|---|---|---|---|---|
| hc-28 (P03-twin) | twin of hc-06, D4 | R-D4 `MergeGuestProfiles.merge`, "saves 2 aggregate instances: GuestProfile x2" | writes only the survivor, through the same helper as the positive (`commitAll(writer, [survivor])`, which maps over its collection parameter), and stages a ProfileAbsorbed event | the helper's root-collection parameter is counted as more than one instance; the one-element array of the caller is not bound back. The positive (hc-06) gets the same finding text, so its detection does not separate two instances from one |
| hc-11 (N02) | negative: saga/outbox, near family cross-context write / D4 | R-D5 `ReserveStockOnOrderPlaced.consume` line 13 | an event consumer: `if (!item \|\| !item.reserve(…)) return false;` inside its own transaction | the decision is the aggregate's (`reserve` returns the outcome) and the branch returns, it does not throw. R-D4 and R-XCTX stay quiet, as the case intends |
| hc-34 (N04) | negative: self-validating value objects, near family D5/D3 | R-D5 `RegisterMember.execute` line 19; R-LOCK line 16 | `if (previous) return …` is an idempotency lookup by email; `this.clock()` is an injected clock function read before the write | R-D5 reports the lookup as a duplicate of `EmailAddress`'s own check, and the branch returns, it does not throw; R-LOCK reads the injected function-typed `clock` as a scope around the write |

**Off-target finding on a positive:** hc-19 (P10, D9) also gets R-ENTITY-OUT (H10) at
`src/subscriptions/api/PlanEndpoints.ts:9`, "returns the domain entity SubscriptionPlan". The case's own rationale
says the endpoint returns the aggregate instances themselves, so it is the labelled defect seen at the inbound
adapter; it is counted above as an H10 finding on a positive of another family, as the development scorer counts it.

## Notes

- Roots: declared in the spec on 27 projects, inferred (fallback) on 5 (hc-01, hc-08, hc-29, hc-32, hc-33), none on 2
  Hexagonal projects without aggregates (hc-16, hc-31).
- The harness tsconfig the study uses includes `src/**` only; the cases' ambient vendor declarations
  (`types/*.d.ts`) are therefore not in the program. This is the study's configuration and was fixed before scoring.
- The set is now spent as a held-out set: any later use of it is development material.
