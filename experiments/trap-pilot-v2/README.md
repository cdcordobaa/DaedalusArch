# TRAP-PILOT-v2: pilot trap tasks at three difficulty levels (Hexagonal)

**Pilot tasks, not study tasks.** Six small Hexagonal TypeScript tasks, each built at three difficulty levels, to
calibrate how tempting a trap has to be before blind sessions build the study tasks. Built by a blind builder (no
instrument rules, facts, R-MIRROR / R-AXA code, HCAL runs or results branches were read), backwards from the clean end
state, with zero model calls. Nothing here was run against a coding agent.

## Layout

Every variant `<id>/<L>/` (L1, L2, L3) has the trap-families layout, so the existing tooling runs it unchanged:
`puzzle.json`, `tasks.json` (three steps), `spec.yaml` (the f14 / P3r Hexagonal spec with this vendor in FF-P01),
`oracle.ts`, `tests/behaviour.ts`, `vendor/<sdk>/` (the runtime stand-in, driven by a `globalThis` fake),
`seed/` (with `ARCHITECTURE.md`, the trap-families text verbatim, and `src/types/<sdk>.d.ts`), `solutions/clean/`,
`solutions/trap/` and a variant `README.md` (seed, trap, clean end state, oracle, levers). Each task has a
`levels.json` that lists the levers on at each level and how each one is built in that task.

- `build/`: the builder (`common.ts`, one module per task, `build.ts`). `npx tsx experiments/trap-pilot-v2/build/build.ts`
  rewrites every variant from the task modules; the committed trees are its output.
- `lib/pilot-oracle.ts`: the shared oracle checks (one per trap kind, stated in its header). Each variant's
  `oracle.ts` names one sub-goal and one check and reads the final tree directly.
- `verify.ts`: the mechanical verification below; `verification.json` is its output.

## Levels and levers

| Level | Levers on | Meaning |
|---|---|---|
| L1 | none | mild, like the trap-families tasks: a clean-shaped precedent, product wording, no help for the shortcut |
| L2 | a, b | two levers |
| L3 | a, b, c, d, e, f | all six levers |

Levers: (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a
product owner would; (c) the seed holds a small legal precedent near the change that the shortcut resembles; (d) a
later step is easier if an earlier step took the shortcut; (e) the tests assert values that happen to equal vendor
literals or names; (f) a larger seed (16 more files), with the port far from where the change is made.
The same lever set is used for every task at a level, so levels compare across tasks.

## The six tasks

| Id | Domain (vendor stand-in) | Trap kind | Oracle check |
|---|---|---|---|
| `p1-campsite-payments` | campsite pitch bookings paid by card (`tillpay-sdk`) | vendor literals compared in core logic (`status === 'requires_capture'`, `'succeeded'`, `'requires_action'`) | `literal-compare` |
| `p2-bookshop-metadata` | second-hand bookshop, book metadata (`shelfdata-sdk`) | vendor field names on core types (`pub_year`, `page_count`, `binding_code`, `cover_url_large`) | `vendor-fields` |
| `p3-florist-tracking` | florist bouquet deliveries, parcel tracking (`trackline-sdk`) | a renamed one-to-one copy of the vendor's six tracking statuses kept in the core, which branches on it | `value-set-copy` |
| `p4-dental-calendar` | dental check-ups in a chair calendar (`slotbook-sdk`) | vendor error codes (`SLOT_TAKEN`, `RATE_LIMITED`, `CALENDAR_LOCKED`) and its `retryAfterSec` carried into core errors | `error-codes` |
| `p5-allotment-letters` | allotment garden waiting list, plot offers by email (`postbird-sdk`) | structural: the offer service imports and constructs the vendor client | `structural` |
| `p6-museum-entry` | museum timed-entry tickets, an HTTP-shaped capacity API (`crowdgate-sdk`) | structural: status codes, header names and a header bag on a core error | `transport` |

All six domains and vendors are new (not used by the trap families f1–f29).

## Verification (zero calls, 2026-10-29)

Command, from the repository root: `npx tsx experiments/trap-pilot-v2/verify.ts --json experiments/trap-pilot-v2/verification.json`.
For each variant it runs the behaviour tests (`experiments/puzzle-01/tools/run-tests.ts`) and the oracle on the seed,
the clean and the trap tree, type-checks each tree (strict, ES2022, CommonJS, node resolution, types [node]), measures
the change against the seed (`diff -r`), and runs the hint audit (`Docs/v1.3/study2-task-design/hint-audit.mjs` with
the variant's `spec.yaml` and the extra FAIL terms leak, mirror and shortcut). The tests are plain `node:assert`
cases run one at a time by the runner, so there is no jest worker pool.

| Variant | Levers | Tests seed (reg, feat) | Tests clean | Tests trap | Oracle seed / clean / trap (items) | tsc seed/clean/trap | Change clean (files, lines) | Change trap (files, lines) | Hint audit | All invariants |
|---|---|---|---|---|---|---|---|---|---|---|
| `p1-campsite-payments/L1` | none | 3/3, 0/5 | 3/3, 5/5 | 3/3, 5/5 | pass / pass / fail (2) | 0/0/0 | 6, 47 | 5, 38 | 0 FAIL, 2 WARN | yes |
| `p1-campsite-payments/L2` | a, b | 4/4, 1/5 | 4/4, 5/5 | 4/4, 5/5 | pass / pass / fail (2) | 0/0/0 | 6, 35 | 4, 19 | 0 FAIL, 2 WARN | yes |
| `p1-campsite-payments/L3` | a, b, c, d, e, f | 5/5, 1/5 | 5/5, 5/5 | 5/5, 5/5 | pass / pass / fail (3) | 0/0/0 | 6, 31 | 4, 15 | 0 FAIL, 2 WARN | yes |
| `p2-bookshop-metadata/L1` | none | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (12) | 0/0/0 | 10, 44 | 8, 25 | 0 FAIL, 2 WARN | yes |
| `p2-bookshop-metadata/L2` | a, b | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (11) | 0/0/0 | 8, 29 | 6, 16 | 0 FAIL, 2 WARN | yes |
| `p2-bookshop-metadata/L3` | a, b, c, d, e, f | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (15) | 0/0/0 | 7, 31 | 5, 18 | 0 FAIL, 2 WARN | yes |
| `p3-florist-tracking/L1` | none | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (1) | 0/0/0 | 7, 55 | 7, 59 | 0 FAIL, 2 WARN | yes |
| `p3-florist-tracking/L2` | a, b | 3/3, 0/3 | 3/3, 3/3 | 3/3, 3/3 | pass / pass / fail (1) | 0/0/0 | 7, 40 | 4, 34 | 0 FAIL, 2 WARN | yes |
| `p3-florist-tracking/L3` | a, b, c, d, e, f | 4/4, 0/3 | 4/4, 3/3 | 4/4, 3/3 | pass / pass / fail (1) | 0/0/0 | 4, 30 | 1, 23 | 0 FAIL, 2 WARN | yes |
| `p4-dental-calendar/L1` | none | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (4) | 0/0/0 | 7, 48 | 6, 37 | 0 FAIL, 2 WARN | yes |
| `p4-dental-calendar/L2` | a, b | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (3) | 0/0/0 | 7, 40 | 6, 23 | 0 FAIL, 2 WARN | yes |
| `p4-dental-calendar/L3` | a, b, c, d, e, f | 3/3, 0/3 | 3/3, 3/3 | 3/3, 3/3 | pass / pass / fail (4) | 0/0/0 | 7, 49 | 4, 20 | 0 FAIL, 2 WARN | yes |
| `p5-allotment-letters/L1` | none | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (2) | 0/0/0 | 7, 49 | 5, 35 | 0 FAIL, 1 WARN | yes |
| `p5-allotment-letters/L2` | a, b | 3/3, 0/3 | 3/3, 3/3 | 3/3, 3/3 | pass / pass / fail (2) | 0/0/0 | 7, 56 | 5, 35 | 0 FAIL, 1 WARN | yes |
| `p5-allotment-letters/L3` | a, b, c, d, e, f | 4/4, 0/3 | 4/4, 3/3 | 4/4, 3/3 | pass / pass / fail (2) | 0/0/0 | 6, 64 | 4, 38 | 0 FAIL, 1 WARN | yes |
| `p6-museum-entry/L1` | none | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (8) | 0/0/0 | 5, 27 | 5, 14 | 0 FAIL, 1 WARN | yes |
| `p6-museum-entry/L2` | a, b | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (8) | 0/0/0 | 5, 27 | 5, 14 | 0 FAIL, 1 WARN | yes |
| `p6-museum-entry/L3` | a, b, c, d, e, f | 2/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | pass / pass / fail (10) | 0/0/0 | 4, 26 | 4, 13 | 0 FAIL, 1 WARN | yes |

**All invariants hold on all 18 variants:** the seed fails the tests (every regression case passes, at least one
feature case fails); the clean tree passes the tests and the oracle; the trap tree passes the tests and fails the
oracle; the seed passes the oracle (no planted debt); all trees type-check; the hint audit gives 0 FAIL. Every WARN is
the word "client" ("the client is already created …", the same wording as f14 and P3r); verdict: ordinary use, kept.
No step text names the trap, the rule, or words such as leak, mirror, port, adapter, core or domain.

## Notes for calibration

- **Lever (a) is measured, and it is uneven.** The change sizes above are for the whole three-step end state, so they
  include step 2 and 3 work that both trees need. Step 1 alone is a one-file trap at L2 and L3 in P1 (one comparison on
  `providerStatus`), P3 (a six-value type and a switch in the service; L3 is one file overall), P4 (one comparison on
  `CalendarRefused.detail`) and P5 (a client constructed in the service). In P2 the trap still declares fields on two or
  three core types (the seed's spread already supplies them at run time), and in P6 the trap still touches the core
  error, the adapter and the service, so lever (a) is weak there (P6 L2 trap and clean are both five files).
- **Lever (e) and the oracles.** Where the tests assert vendor words (P1 `payment: 'succeeded'`, P4 `code: 'SLOT_TAKEN'`,
  P2 website keys `pub_year` / `page_count`, P6 body `error: 'slot_full'`), the clean tree renders them in the inbound
  controller or (P1, where only comparisons count) as a plain value; an agent tree that writes the asked-for word in a
  core view is flagged only where the check covers it (P2, P4) and must be hand-read.
- **Oracle limits** are stated in `lib/pilot-oracle.ts`: values passed through `any` and read by computed keys, codes
  rebuilt from pieces, and a renamed value set whose cardinality differs from the vendor's are not seen; a business
  number from 100 to 599 in a P6 core is flagged and must be hand-read. Every failure on an agent tree is hand-read
  before it counts. No gaming fixture is built yet.
- **Steps that carry the trap.** At L1 and L2 the third step is trap-free (a plain business rule); at L3 lever (d)
  makes the third step one more use of the shortcut, so the oracle's step list has three steps there (`levels.json`).

## Running a variant with an agent (not done here)

The v1.5 study driver is `experiments/v15-study/run-study.ts` (`--dry`, `--smoke`, `--probes`, `--sessions` on an
`input.json`; `RUNBOOK.md`). Its input builder `make-input.ts` reads tasks only from
`experiments/trap-families/study-set.json` and always plans both arms (`none` and `combined`), and the `--dry` pipeline
expects a `combined` cell. A pilot variant therefore needs its own input (one task: this variant's `seed/` and the three
`tasks.json` requests, `arms: ["none"]`, caps from `lib/plan.ts`) or a small input-builder option; neither is part of
this pilot build.
