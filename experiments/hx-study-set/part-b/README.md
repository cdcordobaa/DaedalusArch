# HX study set, part B: four Hexagonal study tasks

**Draft study tasks: not sealed, not registered, not run against a coding agent.** Four Hexagonal TypeScript tasks
for the v1.5 study, built at the two lever sets the pilot ladder picked
(`Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md`, §6):

- two tasks of the **renamed-copy** shape (a copy of the vendor's value set kept in the core) at the p3 **L3** lever
  set (a–f), template `experiments/trap-pilot-v2/p3-florist-tracking/L3`;
- two tasks of the **HTTP-detail-in-core** shape at the p6 **L2** lever set (a, b), template
  `experiments/trap-pilot-v2/p6-museum-entry/L2`.

Part A of the set is built separately. This part was built rule-blind: no instrument rule, rule fact or scorer was
read (`src/v15-instrument/**`, `rules/*.cypher`, scorers); only the trap construct, the pilot templates and the
pilot report. Zero model calls.

## Layout

Each task `hxb<n>-<name>/` has the trap-families / pilot layout, so the existing tooling runs it unchanged:
`puzzle.json` (with `studySet` and `entryPoints`), `tasks.json` (three chained steps), `spec.yaml` (the f14 / P3r
Hexagonal spec, this task's vendor in FF-P01), `oracle.ts`, `tests/behaviour.ts`, `vendor/<sdk>/` (the runtime
stand-in, driven by a `globalThis` fake), `seed/` (with `ARCHITECTURE.md`, the trap-families text verbatim, and
`src/types/<sdk>.d.ts`), `solutions/clean/`, `solutions/trap/`, `levels.json` (the levers and how each is built) and
a task `README.md`.

- `oracle.ts` uses the pilot's rule-blind oracle library unchanged (`experiments/trap-pilot-v2/lib/pilot-oracle.ts`;
  checks `value-set-copy` and `transport`, limits stated in its header).
- `verify.ts`: the checks below; `verification.json` is its output.
- `_checks/similarity.ts`: the similarity check; `_checks/similarity-2026-10-30.json` is its output.
- `study-set.json`: the part-B manifest.

All four domains and vendors are new: none is used by a trap-pilot, trap-family, CAL or HCAL set (checked by name
over `experiments/` and `Docs/`).

## The pilot's test-surface defect, fixed

In the pilot, p3 L1/L2 and p5 L3 agents implemented the change but never added the new method to the `createApp`
app, so the tests failed with `app.cancel is not a function`; one p4 run failed a strict `deepEqual` on a harmless
extra field. Here:

- **Every step text names the app method the tests call** (`pieceStatus(pieceId)`, `withdrawPiece(pieceId)`,
  `progress(orderNo)`, `invoice(orderNo)`, `book(evening, adults, children)`, `enterPlayer(federationId, section)`),
  and says "on the app that createApp() returns"; where a step adds a method (hxb1 `withdrawPiece`, hxb2 `invoice`),
  the text says "Add … to the app that createApp() returns". `verify.ts` checks this: each step names its
  `puzzle.json` entry point, and every `app.<method>` the tests call is either on the seed's app or named in a step.
- **No strict deep equality** in any test: answers, vendor requests and headers are checked field by field, so extra
  fields are harmless. `verify.ts` checks there is no `deepEqual` / `deepStrictEqual` in the tests.

## Checks (zero calls, 2026-10-30)

From the repository root: `npx tsx experiments/hx-study-set/part-b/verify.ts --json experiments/hx-study-set/part-b/verification.json`
and `npx tsx experiments/hx-study-set/part-b/_checks/similarity.ts --json experiments/hx-study-set/part-b/_checks/similarity-2026-10-30.json`.

- Tests: `experiments/puzzle-01/tools/run-tests.ts` (plain `node:assert` cases run one at a time; no jest pool).
- Oracle: rule-blind; the seed and clean trees pass, the trap tree fails.
- tsc: strict, ES2022, CommonJS, node resolution, types [node] (the pilot options), on all three trees.
- Hint audit: `Docs/v1.3/study2-task-design/hint-audit.mjs` with the task's `spec.yaml` (the PR 398 vocabulary) and
  the extra FAIL terms leak, mirror, shortcut, one to one, one-to-one, copy, rename, renamed, value set, vendor,
  transport, status code, http, header bag. Step texts must not name the rule or the shortcut.
- Similarity: no script for the trap-families check ("8-gram Jaccard on normalised clean src", `study-set.json`) is
  committed, so `_checks/similarity.ts` implements it. The structural reading (identifiers, strings and numbers
  abstracted) reproduces the pairs PR 398 recorded: f7/f5 0.97 (recorded 0.93), f8/f3 0.83 (0.82), f6/f4 0.79 (0.72),
  f3/f1 0.64 (0.63); a lexical reading (identifiers kept) is reported too. Each part-B task is compared with the other
  part-B tasks, all 29 trap-families tasks and all 18 pilot variants (part A was not on `main` when this ran). Gate:
  < 0.6 on both readings.

**All invariants hold on all four tasks.** Every regression case passes on the seed and every feature case fails
there; clean and trap pass every case; seed and clean pass the oracle, trap fails it; 0 tsc errors on 12 trees;
0 hint-audit FAIL; entry points named; 0 strict deep-equality calls; every similarity pair < 0.6.

### hxb1-pottery-kiln

| Item | Value |
|---|---|
| Domain (vendor stand-in) | pottery studio, pieces fired in a kiln watched by a cloud controller (`kilnwise-sdk`) |
| Shape, lever set | renamed copy of the vendor's value set; p3 L3 (a, b, c, d, e, f) |
| Steps (entry point) | `pickup-status` (`pieceStatus(pieceId)`), `withdraw` (new `withdrawPiece(pieceId)`), `cooling-down` (`pieceStatus(pieceId)`) |
| Trap | the service keeps the vendor's seven kiln phases one to one (`KilnPhase`, lower case) and switches on them |
| Clean | core `FiringProgress` (five values), a `progress` field on `KilnReading`, the adapter maps seven phases many to one |
| Oracle (check, sub-goal steps) | `value-set-copy`; all three steps |
| Tests seed / clean / trap (regression, feature) | 4/4, 0/3 · 4/4, 3/3 · 4/4, 3/3 |
| Oracle seed / clean / trap | pass / pass / fail (1 item: `PieceService.ts:10` keeps the vendor's 7 values one to one) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change vs seed: clean, trap (files, lines) | 8, 70 · 5, 43 (step 1 alone: trap 1 file) |
| Hint audit | 0 FAIL, 0 WARN |
| Max similarity (structural / lexical) | 0.279 (p3-florist-tracking/L3) / 0.015 |

### hxb2-translation-portal

| Item | Value |
|---|---|
| Domain (vendor stand-in) | translation bureau posting customers' documents as jobs on a translator marketplace (`wordmarket-sdk`) |
| Shape, lever set | renamed copy of the vendor's value set; p3 L3 (a, b, c, d, e, f) |
| Steps (entry point) | `progress` (`progress(orderNo)`), `invoice` (new `invoice(orderNo)`), `proofreading` (`progress(orderNo)`) |
| Trap | the service keeps the marketplace's six job states one to one (`MarketState`) in a lookup table; the invoice compares `'delivered'` |
| Clean | core `JobProgress` (five values), a `progress` field on `JobSnapshot`, the adapter maps six states many to one |
| Oracle (check, sub-goal steps) | `value-set-copy`; all three steps |
| Tests seed / clean / trap (regression, feature) | 4/4, 0/3 · 4/4, 3/3 · 4/4, 3/3 |
| Oracle seed / clean / trap | pass / pass / fail (1 item: `TranslationOrderService.ts:10` keeps the vendor's 6 values one to one) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change vs seed: clean, trap (files, lines) | 7, 52 · 4, 36 (step 1 alone: trap 1 file) |
| Hint audit | 0 FAIL, 2 WARN ("translation" twice: the bureau's product; ordinary use, kept) |
| Max similarity (structural / lexical) | 0.283 (p3-florist-tracking/L3) / 0.013 |

### hxb3-observatory-evenings

| Item | Value |
|---|---|
| Domain (vendor stand-in) | public observatory selling seats for stargazing evenings (`nightdome-sdk`, HTTP-shaped) |
| Shape, lever set | HTTP detail in the core; p6 L2 (a, b) |
| Steps (entry point) | `dome-full`, `clouded-out`, `late-evening` (all `book(evening, adults, children)`) |
| Trap | `BookingRefused` gains `statusCode` and `headers`; the service maps 409 → 409 and 423 → 423 with `Next-Clear-Evening` from `x-next-clear-evening` |
| Clean | core errors `EveningFull`, `SkyClosed(nextClearEvening?)`; the adapter maps the vendor's reply, the controller maps the errors to 409 / 423 |
| Oracle (check, sub-goal steps) | `transport`; `dome-full`, `clouded-out` (step 3 is a plain business rule) |
| Tests seed / clean / trap (regression, feature) | 2/2, 0/3 · 2/2, 3/3 · 2/2, 3/3 |
| Oracle seed / clean / trap | pass / pass / fail (7 items: status numbers 409, 423, 400, the header `x-next-clear-evening`, `statusCode`, `headers`) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change vs seed: clean, trap (files, lines) | 6, 36 · 5, 26 |
| Hint audit | 0 FAIL, 0 WARN |
| Max similarity (structural / lexical) | 0.352 (p6-museum-entry/L1) / 0.047 |

### hxb4-chess-entries

| Item | Value |
|---|---|
| Domain (vendor stand-in) | weekend chess congress taking section entries, ratings from a rating service (`ratingsdesk-sdk`, HTTP-shaped) |
| Shape, lever set | HTTP detail in the core; p6 L2 (a, b) |
| Steps (entry point) | `unknown-player`, `throttled`, `section-full` (all `enterPlayer(federationId, section)`) |
| Trap | `EntryError` gains `statusCode` and `headers`; the service maps 404 → 404 and 429 → 503 with `Retry-After` from `x-ratelimit-reset` |
| Clean | core errors `PlayerUnknown`, `RatingsBusy(retryInSeconds)`; the adapter maps the vendor's reply, the reply helper maps the errors to 404 / 503 |
| Oracle (check, sub-goal steps) | `transport`; `unknown-player`, `throttled` (step 3 is a plain business rule) |
| Tests seed / clean / trap (regression, feature) | 3/3, 0/3 · 3/3, 3/3 · 3/3, 3/3 |
| Oracle seed / clean / trap | pass / pass / fail (8 items: status numbers 404, 429, 503, 422, the headers `Retry-After` and `x-ratelimit-reset`, `statusCode`, `headers`) |
| tsc seed / clean / trap | 0 / 0 / 0 |
| Change vs seed: clean, trap (files, lines) | 6, 37 · 5, 26 |
| Hint audit | 0 FAIL, 0 WARN |
| Max similarity (structural / lexical) | 0.200 (hxb3-observatory-evenings) / 0.026 |

Part-B pairs (structural): hxb1/hxb2 0.250, hxb1/hxb3 0.139, hxb1/hxb4 0.147, hxb2/hxb3 0.151, hxb2/hxb4 0.142,
hxb3/hxb4 0.200.

## Notes

- **Lever (a) is uneven, as in the pilot.** In hxb1 and hxb2 the step-1 trap is one file (a type and a switch or
  table in the service). In hxb3 and hxb4 the trap still touches the core error, the adapter, the service and the
  inbound reply, so the shortcut is only a little smaller than the clean path (5 against 6 files), the same as the
  pilot's p6 L2, which trapped 2/2 at that level.
- **Lever (e).** The status words the tests assert include the vendor's own words in upper case (hxb1 `COMPLETE`,
  hxb2 `DELIVERED` and `PROOFREADING`); the clean trees write them only as output strings, which the
  `value-set-copy` check does not count. An agent tree that fails the oracle is hand-read before it counts, as the
  pilot report requires.
- **Oracle limits** are those of `pilot-oracle.ts`: values passed through `any`, codes rebuilt from pieces and a copied
  value set of a different size are not seen; a business number from 100 to 599 in an hxb3 / hxb4 core is flagged and
  must be hand-read (the clean cores hold none).
- **Not done here:** rule visibility (whether the admitted rules fire on each trap and stay silent on each clean
  tree) needs the instrument and is outside a rule-blind build; no seal, no registration, no agent run.
