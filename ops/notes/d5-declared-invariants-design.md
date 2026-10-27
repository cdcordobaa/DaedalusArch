# D5 declared set invariants: design note (C1)

Date: 2026-10-26. Status: design, before any build or call. Decision: C1 in `ops/decisions.md` (2026-10-26).
Evidence it answers: `Docs/DiagnosticRuns/v15-u4-2026-10-23.md` §4–§5 (S2 failed: D5 recall 11/16, 4 new false
positives; the post-hoc r2 moved the boundary instead of sharpening it).

## 1. The problem U4 showed

The D5 question asked a model to decide from the code alone whether a check is an aggregate invariant placed outside
its aggregate. Three cases have the same code and different labels:

- the lock-form overlap check (labelled D5: a set invariant no aggregate owns);
- the same check one step earlier, before the lock (labelled negative);
- P10's duplicate-order check (labelled legitimate: uniqueness across the store).

No reading of the code alone separates them, because the difference is in the design intent, not in the code. r1
followed the rule text and missed the lock form. r2 followed the label and confirmed the legitimate fixture.

## 2. The construct, declared-only

D5 becomes: **a declared invariant is checked outside the aggregate the spec names as its owner.** The spec states
each invariant that matters, and the rule checks only those. An invariant the spec does not declare is out of scope
by construction. That limit is reported, not hidden.

This puts the design intent where the thesis already puts it: in the declared spec. Greenfield claims stay
confirmatory because the norms are declared.

## 3. Spec field (DDD block, optional)

```yaml
invariants:
  - id: room-no-overlap
    kind: set                 # set: compares members of a collection; single: one instance's own state
    owner: RoomSchedule       # the aggregate that must enforce it
    over: [Booking]           # the type(s) whose members are compared
    terms: [roomId, checkIn, checkOut]   # field names that identify the check in code
    statement: "two stays in one room never overlap"
  - id: order-number-unique
    kind: uniqueness          # enforced by the store (unique key); never a D5 finding
    over: [Order]
    terms: [orderNumber]
    enforced_by: store
```

Validation: `owner` must name a declared aggregate; `terms` must be non-empty; `kind: uniqueness` needs
`enforced_by: store` and no `owner`. A spec without `invariants` keeps today's R-D5 behaviour (no change to the
frozen v1.4 path; v1.5 only).

## 4. Rule (symbolic first)

New rule `R-D5S` (v1.5 only; R-D5 stays as is for undeclared single-instance guards):

1. From the existing `Guard` facts (`RULE_SITE`), take each guard outside the owner aggregate's module.
2. It matches a declared `set` or `single` invariant when its condition (or a method it calls in the same file)
   references at least two of the invariant's `terms`, or iterates a collection of an `over` type and references one
   term.
3. Match → finding `R-D5S`: "invariant <id> is checked in <unit>, outside its owner <owner>".
4. `uniqueness` invariants never produce a finding.

The model has no role in the verdict. It may be used only as a tie-breaker when one guard matches two declared
invariants, and that count is reported (predicted 0 on the cases below).

## 5. Labels follow the spec

The labels on the 16 U4 trees are re-derived from their specs with the invariants declared. Under the declared
construct, the pre-lock step 1 is a violation like step 2: the same unowned check is outside the owner. This is a
construct change, and the re-labelling is recorded as such. The old figures stay reported next to the new ones.

## 6. Unseen cases (the S2 re-run)

- **Who builds them:** a fresh session. It gets this note's §2–§3 and the spec format only, never the U4 trees, the
  R-D5S query or the DETECT-02 material. It writes 2 new domains (not hotels, ferries, loyalty or transfers), each
  with 3 set-invariant positives, a twin of each (the check moved into the owner), and 2 legitimate cases (one
  uniqueness, one single-instance check inside its aggregate): 6 positives, 6 twins, 4 legitimate cases.
- **Sealing:** the cases are committed with a hash before R-D5S is run on them. No change to R-D5S after the run;
  a failed run is reported, not fixed.
- **Calls:** case building is one session (Sonnet, mechanical, about 1 call batch). Scoring is zero calls.

## 7. Predictions and gate (written before the run)

| Measure | Pass |
|---|---|
| Recall on the 6 unseen positives | ≥ 5/6 |
| False positives on the 6 twins and 4 legitimate cases | 0 |
| Tie-breaks needed | reported; prediction 0 |
| The 16 U4 trees, re-labelled | descriptive only (development material) |

- **Pass:** DDD can enter the confirmatory family, provided its other gates pass (C1).
- **Fail:** DDD runs as an exploratory style, and Hexagonal is the confirmatory style.

## 8. What this does not cover

- An invariant the spec author forgets.
- A check through an indirection the guard facts don't see (a helper in another file the rule doesn't follow).
- The "lock instead of a boundary" shape, when the code holds the lock but checks nothing (HEXDDD-01 case 1).

## 9. Work list

1. `spec.ts`: parse and validate `invariants` (v1.5 only), with tests.
2. `facts.ts`: give each guard its referenced terms and iterated types.
3. `rules/r-d5s-declared-invariant.cypher`, with tests on hand-made fixtures that are not the unseen cases.
4. Re-label the 16 U4 trees under §5 (zero calls), and report.
5. Brief the case-building session (§6), seal, score, report.
