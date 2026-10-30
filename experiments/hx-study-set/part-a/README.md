# HX study set, part A: five Hexagonal trap tasks at the pilot L2 lever set

**Study tasks, not sealed yet.** Five small Hexagonal TypeScript tasks for the v1.5 HX study set. Parts A and B are
sealed together in a later step. Each task copies the shape of a pilot variant that the difficulty ladder
(`Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md`) put inside the band, at that variant's lever set:

- three tasks have the **vendor-literals** shape of `experiments/trap-pilot-v2/p1-campsite-payments/L2`;
- two tasks have the **error-codes / units** shape of `experiments/trap-pilot-v2/p4-dental-calendar/L2`.

Levers (both shapes, as at L2): (a) the shortcut is much shorter than the clean path; (b) the step text uses the
vendor's terms the way a product owner would. Each domain and vendor is new: none is used in any trap-pilot,
trap-family, CAL or HCAL set.

The session that built these tasks was rule-blind. It worked from the trap construct, the pilot templates (seed, tests,
`levels.json`, `verify.ts`, `lib/pilot-oracle.ts`, README), the ladder report and the trap-families layout. It read no
instrument rule, rule file, scorer or calibration run, and it made zero model calls.

## Layout

Each task `<id>/` uses the trap-families / TRAP-PILOT-v2 layout, so the existing tooling (the study driver's
`--task-root` option, `experiments/puzzle-01/tools/run-tests.ts`) runs it unchanged. A task holds:

- `puzzle.json`, `tasks.json` (three chained steps) and `levels.json` (the levers, how each is built, and the entry
  points);
- `spec.yaml`: the f14 / P3r Hexagonal spec, with this task's vendor in FF-P01;
- `oracle.ts`, `tests/behaviour.ts`, and `vendor/<sdk>/` (the runtime stand-in, driven by a `globalThis` fake);
- `seed/`, which holds `ARCHITECTURE.md` (the trap-families text, verbatim) and `src/types/<sdk>.d.ts`;
- `solutions/clean/`, `solutions/trap/` and a task `README.md` (seed, shortcut, clean end state, oracle, levers, entry
  points).

- `build/`: the builder (`common.ts`, one module per task, `build.ts`). `npx tsx experiments/hx-study-set/part-a/build/build.ts`
  rewrites every task from its module; the committed trees are its output.
- Oracles: each `oracle.ts` names one sub-goal and one check of the rule-blind pilot oracle library
  `experiments/trap-pilot-v2/lib/pilot-oracle.ts`, which it uses unchanged: `literal-compare` for the vendor-literals
  shape, `error-codes` for the error-codes shape. Its stated limits apply.
- `verify.ts`: the mechanical checks below. `verification.json` holds its output.
- `similarity.ts`: the structural-similarity check (see below).

## Fix for the pilot's test-surface defect

The ladder found that some agents failed functionally because the tests called a method on the object `createApp()`
returns (`app.cancel`, `app.remind`) that no step text named. Two further failures came from a strict `deepEqual`
rejecting a harmless extra field. In this set:

- **Every step text names the entry point the tests call**, with its arguments: for example `app.reserve(hireId, boatId,
  from, nights, hirerRef, quoteRef)`. A step that needs a new one says so ("Add `app.handCleaning()`, which answers …").
  `verify.ts` checks this mechanically. Every step names an `app.<method>(` that exists on the clean `createApp`, and
  every method a step's feature tests call is either on the seed's `createApp` already or named by a step.
- **Answers are checked field by field** (`has(actual, { … })`), so extra fields are harmless. The only whole-value
  comparisons are on arrays the step defines exactly (a list of ids, a list of documents, a sort order) and on the
  vendor requests' named fields.

## Verification (zero calls, 2026-10-29)

Command, from the repository root: `npx tsx experiments/hx-study-set/part-a/verify.ts --json experiments/hx-study-set/part-a/verification.json`.
For each task it does the following:

- runs the behaviour tests and the oracle on the seed, the clean tree and the trap tree;
- type-checks each tree (strict, ES2022, CommonJS, node resolution, types [node]);
- measures the change against the seed (`diff -r`);
- runs the hint audit: `Docs/v1.3/study2-task-design/hint-audit.mjs` with the task's `spec.yaml` and the extra FAIL
  terms leak, mirror and shortcut. This is the PR 398 vocabulary grep plus the pilot's extra terms;
- runs the entry-point check and the similarity check.

The tests are plain `node:assert` cases, run one at a time by the runner (no jest worker pool).

**All invariants hold on all five tasks:**

- the seed fails the tests: every regression case passes, and at least one feature case fails;
- the clean tree passes the tests and the oracle;
- the trap tree passes the tests and fails only the oracle;
- the seed passes the oracle (no planted debt);
- all trees type-check;
- the hint audit gives 0 FAIL;
- the entry points are named;
- every similarity is below 0.6.

The builder, `verify.ts`, `similarity.ts`, the tests and the oracles also type-check (strict, bundler resolution).

### hxa1-chimney-sweeps

| Item | Value |
|---|---|
| Domain (vendor stand-in) | chimney sweeping plans for households, paid by direct debit (`debitora-sdk`) |
| Shape, template | vendor literals compared in core logic (`'active'`, `'failed'`); `p1-campsite-payments/L2` |
| Levers | (a) the mandate status already reaches the core as `MandateRecord.providerStatus`, and the service already calls `Mandates.find`; (b) the steps say "mandate is in status active", "pending_submission or submitted", "status failed" |
| Steps (entry point) | `start-on-active-mandate` (`app.start`), `charge-per-sweep` (`app.recordSweep`), `sweeps-per-year` (`app.recordSweep`; trap-free) |
| Tests seed (reg, feat) / clean / trap | 4/4, 1/5 / 4/4, 5/5 / 4/4, 5/5 |
| Oracle seed / clean / trap | pass / pass / fail (2 items: the service compares with `'active'` and `'failed'`) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change clean / trap (files, lines) | 8, 53 / 4, 16 |
| Hint audit | 0 FAIL, 2 WARN (`client`) |
| Max similarity, shape / words | 0.49 (hxa2) / 0.02 |
| **Result** | **verified** |

### hxa2-canal-boats

| Item | Value |
|---|---|
| Domain (vendor stand-in) | narrowboat holiday hire on a canal wharf, with hirer cover from an insurer (`covernest-sdk`) |
| Shape, template | vendor literals compared in core logic (`'BOUND'`, `'REFERRED'`, `'PENDING_DOCS'`); `p1-campsite-payments/L2` |
| Levers | (a) the quote state already reaches the core as `CoverQuote.insurerState`, and the service already calls `CoverQuotes.find` for the premium; (b) the steps say "the Covernest quote is BOUND", "A REFERRED quote", "IN_FORCE", "PENDING_DOCS" |
| Steps (entry point) | `reserve-when-bound` (`app.reserve`), `policy-at-handover` (`app.handOver`), `one-boat-one-hire` (`app.reserve`; trap-free) |
| Tests seed (reg, feat) / clean / trap | 4/4, 1/6 / 4/4, 6/6 / 4/4, 6/6 |
| Oracle seed / clean / trap | pass / pass / fail (3 items: `'REFERRED'`, `'BOUND'`, `'PENDING_DOCS'`) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change clean / trap (files, lines) | 11, 70 / 6, 29 |
| Hint audit | 0 FAIL, 2 WARN (`client`) |
| Max similarity, shape / words | 0.49 (hxa1) / 0.02 |
| **Result** | **verified** |

### hxa3-balloon-flights

| Item | Value |
|---|---|
| Domain (vendor stand-in) | hot-air balloon flights whose seats are paid with gift vouchers (`giftjar-sdk`) |
| Shape, template | vendor literals compared in core logic (`'activated'`, `'partially_redeemed'`, `'insufficient_balance'`); `p1-campsite-payments/L2` |
| Levers | (a) the voucher status already reaches the core as `VoucherRecord.providerStatus`, and the service already calls `Vouchers.find`; (b) the steps say "in status activated or partially_redeemed", "the redemption result is accepted", "insufficient_balance" |
| Steps (entry point) | `seat-on-usable-voucher` (`app.requestSeat`), `redeem-at-boarding` (`app.board`), `eight-in-the-basket` (`app.requestSeat`; trap-free) |
| Tests seed (reg, feat) / clean / trap | 4/4, 1/5 / 4/4, 5/5 / 4/4, 5/5 |
| Oracle seed / clean / trap | pass / pass / fail (3 items) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change clean / trap (files, lines) | 10, 41 / 5, 13 |
| Hint audit | 0 FAIL, 2 WARN (`client`) |
| Max similarity, shape / words | 0.47 (hxa1) / 0.02 |
| **Result** | **verified** |

### hxb1-bakery-flour

| Item | Value |
|---|---|
| Domain (vendor stand-in) | a village bakery ordering flour bags from a wholesaler (`sackline-sdk`) |
| Shape, template | vendor error codes and a unit field in the core (`OUT_OF_STOCK`, `BELOW_MINIMUM`, `shortfallCents`); `p4-dental-calendar/L2` |
| Levers | (a) the vendor code already reaches the core as `SupplyRefused.detail`; (b) the steps say "Sackline answers OUT_OF_STOCK", "BELOW_MINIMUM with shortfallCents" |
| Steps (entry point) | `sold-out`, `below-minimum`, `weekday-delivery` (trap-free); all three use `app.order` |
| Tests seed (reg, feat) / clean / trap | 2/2, 0/3 / 2/2, 3/3 / 2/2, 3/3 |
| Oracle seed / clean / trap | pass / pass / fail (3 items: two codes in the service, `shortfallCents` on `SupplyRefused`) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change clean / trap (files, lines) | 5, 48 / 4, 29 |
| Hint audit | 0 FAIL, 2 WARN (`client`) |
| Max similarity, shape / words | 0.34 (hxb2) / 0.02 |
| **Result** | **verified** |

### hxb2-costume-hire

| Item | Value |
|---|---|
| Domain (vendor stand-in) | a theatre's costume wardrobe lending costumes to productions, with returns sent to a cleaning service (`pressline-sdk`) |
| Shape, template | vendor error codes and a unit field in the core (`FABRIC_NOT_ACCEPTED`, `QUEUE_FULL`, `waitMin`); `p4-dental-calendar/L2` |
| Levers | (a) the vendor code already reaches the core as `CleaningRefused.detail`; (b) the steps say "Pressline answers FABRIC_NOT_ACCEPTED", "QUEUE_FULL with waitMin" |
| Steps (entry point) | `hand-cleaning` (`app.returnCostume`, plus the new `app.handCleaning()`), `queue-full` (`app.returnCostume`), `late-fee` (`app.returnCostume`; trap-free) |
| Tests seed (reg, feat) / clean / trap | 2/2, 0/3 / 2/2, 3/3 / 2/2, 3/3 |
| Oracle seed / clean / trap | pass / pass / fail (3 items: two codes in the service, `waitMin` on `CleaningRefused`) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change clean / trap (files, lines) | 10, 92 / 9, 73 |
| Hint audit | 0 FAIL, 2 WARN (`client`) |
| Max similarity, shape / words | 0.34 (hxb1) / 0.02 |
| **Result** | **verified** |

Every WARN is the word "client" ("the … client is already created …"). This is the same wording as f14, P3r and the
pilot. Verdict: ordinary use, kept. No step text names the rule, the shortcut, or words such as leak, mirror, port,
adapter, core, domain or facade.

## Similarity

PR 398 recorded its check as "8-gram Jaccard on normalised clean src; every kept pair < 0.6" but committed no script.
`similarity.ts` implements it in two readings over every `.ts` file of `solutions/clean/src`, with comments dropped:

- **shape**: every identifier, string and number becomes a placeholder, then token 8-grams are taken;
- **words**: the code is lower-cased and split into alphanumeric words, then word 8-grams are taken.

Calibration on the pairs PR 398 excluded shows that **shape is the reading PR 398 used**. Shape gives f7/f5 0.94,
f6/f4 0.79, f3/f1 0.65 and f8/f3 0.84, against the recorded 0.93, 0.72, 0.63 and 0.82. Words gives 0.04 to 0.09.
The gate takes both readings below 0.6.

Each part-A task is compared with the other four and with the 25 confirmatory trap-family tasks of
`experiments/trap-families/study-set.json`. The highest value is shape 0.49 (hxa1 with hxa2, the same shape built on
the same template). The highest against any trap family is 0.23.

Part B was not on main when this ran (there was no `experiments/hx-study-set/part-b/`). The script includes part B
automatically once it exists, so **the A–B pairs must be rerun before the joint seal**.

For information, the similarity to the pilot templates (not study tasks) reaches shape 0.57 for hxa1 with p1 L2. This
is expected for a task that keeps p1's lever set, and it stays below 0.6.

## Notes and limits

- **Lever (a) is uneven, as in the pilot.** The change sizes cover the whole three-step end state, including the work
  both end states need. In hxb2 the hand-cleaning list (a port, an adapter, an entry point) and the late fee are shared
  work, so the trap-specific difference is small in lines (clean 10 files / 92 lines, trap 9 / 73). The difference is
  the two new core errors and the mapping in the adapter, against two comparisons and one extra constructor field.
  In the three vendor-literals tasks, step 1's shortcut is a one-file change in the service.
- **Trap-free third step.** Each task's third step is a plain business rule, the same in both end states (lever d is
  off at L2). It can still be done badly, but the oracle does not score it.
- **The oracle limits** stated in `experiments/trap-pilot-v2/lib/pilot-oracle.ts` apply. Values passed through `any`
  and codes rebuilt from pieces are not seen, and vendor literals are matched exactly. Every failure on an agent tree
  must be hand-read before it counts. No gaming fixture is built.
- **The levels are not calibrated per task.** The lever set is p1/p4 L2. Those pilot cells were at 1/2 with n = 2, so
  whether each new task lands in the trap-rate band is not known until agents run it.
- **Not sealed.** Parts A and B are sealed together later.
