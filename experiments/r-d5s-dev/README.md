# R-D5S v1.5.7: development revision (2026-11-02)

R-D5S, catalogue row K10: "a declared invariant enforced outside its owner aggregate". This is exploratory instrument
work. It made zero model calls, used no Neo4j, and read no sealed, held-out or MEAN-01 material. It only uses cases
that were already scored and committed: `experiments/d5-unseen`, `experiments/cal-01`, `cal-02` and `cal-03`.

**This is a development fit.** The d5-unseen set and the CAL sets have all been read. Admission needs a new blind
sealed set.

## 1. Where the failing 4/6 and 2/10 came from, and what main does on those cases today

`Docs/DiagnosticRuns/v15-d5s-unseen-2026-10-26.md` scored R-D5S as committed in `8de84ffb6` on the 16 sealed cases,
sealed in `2146e061e` at 2026-10-26 21:12 −05:00. The result was recall 4/6 and FP 2/10, so the gate failed.

About 1 h 45 min later, CN-01 (`fa2f17fc3`, 2026-10-26 22:58 −05:00) added two changes to the INVARIANT_SITE facts.
Both aim at the two failure causes that report names:

- **K10 owner-first.** If a guard sits in the owner module of any invariant it matches, nothing is reported.
- **K10 rejection without a throw.** A `return` in the guard's then-branch counts as a rejection, and so do
  `continue` and `break`.

Those changes were never re-scored on the unseen cases. `ops/01-instrument-map.md` still quotes 4/6 and 2/10. Re-run
on `origin/main` (`7a9eb3737`) with `run.ts`, the 16 cases now give **6/6 recall and 0/10 FP**. The unseen set has
therefore served as development material since CN-01. Its 6/6 is not admission evidence.

| Case | Label | 8de84ffb6 (the report) | main before this PR | Why |
|---|---|---|---|---|
| clinic/pos-3 `BookingController.ts:12` | violation | missed | found | The controller rejects with `return { status: 409 }`. The guard facts took only if-statements that throw. CN-01 counts a `return`. |
| warehouse/pos-3 `PutAwayHandler.ts:16` | violation | missed | found | The message handler rejects with `return 'reject'`. Same cause, same fix. |
| clinic/legit-1 `DoctorDay.ts:13` | clean | FP | silent | `if (clash)` in `DoctorDay`, the owner of `slot-no-double-book`. Through `clash`'s initialiser it also reads `start` and an `Appointment[]`, so it matched `cancel-notice-window` (owner `Appointment`) on one term plus the `over` collection. The rule did not prefer the invariant whose owner holds the guard. CN-01 owner-first fixes this. |
| clinic/twin-2 `DoctorDay.ts:13` | clean | FP | silent | The same `DoctorDay.book` guard, with the same cause and fix. |

So none of the four failed unseen cases fails on main today. This PR does not change any of them, because before
equals after for all four.

## 2. The independent review's hypotheses, checked

None of the 422 committed trees (§3) has either shape, so I built fixtures for them in
`tests/unit/v15-instrument/r-d5s-v157.test.ts`. That file is a lodging context: `RoomCalendar` owns the set invariant
`room-no-overlap` (terms `roomId`, `checkIn`, `checkOut`; `over: [Booking]`). On main **before** the revision, the
fixtures confirm all four hypotheses:

| Fixture | Label | Before | After | Hypothesis |
|---|---|---|---|---|
| P1 service: `if (clash) { log.warn(…); throw … }` | violation | **missed** | found | #20: `guardShape` takes a lone throw only (`src/apg-enrich/cheap/guards.ts`, `inner.length === 1`). |
| P2 service: `switch (…some(overlap…)) { case true: … throw … }` | violation | **missed** | found | #20: only `IfStatement` guards are collected. |
| P3 batch handler: `if (taken) continue; this.service.book(…)` | violation | found | found | Kept: the skipped work writes. |
| P4 domain service `BookingPolicy.assertFree(cal: RoomCalendar, …)` | violation | found | found | Kept: it reads the aggregate. |
| T1 P1's block inside `RoomCalendar` | clean | silent | silent | Owner-first. |
| T2 P2's switch inside `RoomCalendar` | clean | silent | silent | Owner-first. |
| T3 query: `for (b of …) { if (b.roomId !== roomId \|\| b.checkIn >= to …) continue; out.push(b); }` | clean | **FP** | silent | #19: any `continue` counted as a rejection. |
| T4 `domain/shared/StayRange` ctor: `if (checkIn >= checkOut) throw` | clean | **FP** | silent | #19: two term names hit, and only the owner's module is exempt. |

## 3. The revision (only the INVARIANT_SITE block of `src/v15-instrument/facts.ts`)

1. **Throw after other statements.** A then-branch with a top-level `throw` among its statements rejects. The new
   logic is in `facts.ts`. `guards.ts` is shared with frozen v1.4 code under `src/apg-enrich`, so it was not changed.
2. **Switch cases.** A `case` clause whose statements include a `throw` is a guard on `<switch expr> === <case expr>`.
   Both expressions are the guard's reach, as an if-condition is. `default` does not count.
3. **`continue` and `break` need a skipped write.** They count as a rejection only when the enclosing loop calls one
   of these:
   - a void method of a root class (a command);
   - a storage sink;
   - a unit whose write footprint is not empty.

   A `return` still always counts. An entry point rejects by returning, and CN-02's `rejectsWithValue` is not used
   here because R-D5S has counted any return since CN-01.
4. **Value guards in the domain.** Take a guard in the domain or shared kernel, outside every aggregate module, that
   reads no aggregate: no root-typed value, and no collection of an `over` type. It checks a value, so it is not
   reported. A domain service that reads the aggregate (P4) is still reported. I narrowed the review's suggestion
   ("the guard's unit must write a root") because the wider version would have dropped these cases:
   - an application validator that throws without writing;
   - a controller that reads a DTO view (the CAL-02 K10-pos2 shape);
   - P4.

The rule's Cypher text is unchanged. Its header has a dated `v1.5.7` line. `rule-set.ts`, its rows, its admitted lists
and `INSTRUMENT_ID` (`v1.5.5-hx-rules-v3`) are unchanged. `instrumentRuleHash()` changes because `facts.ts` changed.
A hub record made from this code therefore carries the old id with a new rule hash. Bumping the id is the author's
call.

## 4. Regression (zero calls): `npx tsx experiments/r-d5s-dev/run.ts --out results/<before|after>.json`

The run covers 422 trees: d5-unseen (16), CAL-01 (82 trees, bases included), CAL-02 (160 + 2 bases) and CAL-03 (160 + 2 bases).
It runs every v1.5 rule. For d5-unseen it follows `experiments/d5-unseen/score.ts`. For the CAL sets it follows
`experiments/cal-01/score.ts`: the base is overlaid and used as the baseline. Records:
`results/before.json` (main `7a9eb3737`) and `results/after.json` (this PR).

| Set | R-D5S K10 recall | K10 FP | R-D5S on any clean case |
|---|---|---|---|
| d5-unseen | 6/6 → 6/6 | 0/10 → 0/10 | 0/10 → 0/10 |
| CAL-01 | 2/2 → 2/2 | 0/3 → 0/3 | 0/50 → 0/50 |
| CAL-02 | 0/4 → 0/4 | 0/6 → 0/6 | 0/98 → 0/98 |
| **CAL-03** (K10 admitted here) | **4/4 → 4/4** | **0/6 → 0/6** | **0/98 → 0/98** |

- **Every rule:** all 422 trees give byte-identical v1.5 findings before and after: 278 violations, 12 of them R-D5S,
  and 0 trees differ. The change touches only INVARIANT_SITE facts, so no other rule could change. The diff confirms
  that.
- **Frozen rules:** `src/apg-enrich/cheap/guards.ts` and every other v1.4 file are unchanged. R-D5 and the frozen guard
  users read the same `guardShape` as before. The frozen `check_diff` hits were not re-run, because no frozen input
  changed.
- **CAL-02 K10 0/4 is a known limit and is not addressed.** The positives decide coverage through
  `policy.remaining().cents` or a `PolicyView` DTO and use none of the declared terms (`coverageLimit`, `reserved`,
  `policyId`). Term matching cannot see them. R-D5 fires on all 4 of them in the labelled file (`Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md`); K10 is scored by R-D5S alone (`ROW_OVERRIDES`).
- **Study trees:** the DDD final study's session trees were not kept, so no study-tree diff is possible.
- **Tests:** `npx jest --maxWorkers=2 tests/unit/v15-instrument tests/unit/v15-study` gives 20 of 20 suites and 180 of
  180 tests. `pilot-runner.test.ts` needs `node_modules/tsx` inside the checkout; a worktree without its own
  `node_modules` fails it for that reason alone.

## 5. Limits

- This is a development fit on fixtures I wrote after reading the review. It is not evidence of recall or precision.
  K10's admission rests on CAL-03, which is unchanged (4/4, 0/6). Any claim about the new shapes needs a new blind
  sealed set built without sight of this code.
- The value-guard exemption gives up one real shape: a domain helper outside the owner that takes only primitive
  arguments (`assertCapacity(used, qty, cap)`). It reads no aggregate, so it is silent.
- The skipped-write test for `continue`/`break` follows calls through `footprint`, to `MAX_DEPTH`. A skipped write
  made through an event or a message bus is not seen.
- Switch guards report the clause line, with the condition rendered as `<switch> === <case>`.
- `ops/01-instrument-map.md` still says R-D5S scored 4/6 and 2/10 on the unseen set. That is the historical sealed
  score of `8de84ffb6`, and it stays the reported gate result.
