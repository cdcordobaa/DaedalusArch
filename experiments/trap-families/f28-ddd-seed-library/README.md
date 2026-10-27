# F28 `f28-ddd-seed-library`: one lot split into two (DEV split, variant of `p1-transfers`)

**Families:** D4 (both halves of a split stored by one command), D5 (quarantine and germination decided outside the
lot). **Shape:** a command that **splits one SeedLot into two SeedLots of the same type**; the siblings cover "move
between two containers" and "one command, two aggregate types". **Instrument visibility:** invisible on the trap
(measured: `instrument-score.ts` gives `pass` with no blocking finding on seed, clean and trap): a blind-control
variant. Rung 4 (T 2, S 3, Dst 1, Pd 1, Dx 0).

## The seed

One context (`seedbank`), one aggregate (`SeedLot`: a variety, a garden, a weight in whole grams that never goes below
zero, a germination percent and an intake day). Application services are plain functions that look up one lot, call
it and `keep` it. `MemoryShelf` keeps a lot **together with its unsent events** in one step, and a `Courier` passes
kept events to listeners after every request; the thank-you note on `lot-donated` is the one precedent. Members can
`take` seed. The clean mechanism is in the seed (Pd 1: clean precedent only).

## The trap line (shortest working)

1. `sharing`: `shareSeed` looks up the lot, `handOut`s the grams, builds the new lot from the old one's snapshot
   (`SeedLot.fromSnapshot({...lot.snapshot(), number, garden, grams, ...})`) and keeps both. "The weights must always
   add up" reads as a request for one atomic write of two lots. **D4.**
2. `plant-health`: the service compares `lot.germination.percent < 70` and `day.daysSince(lot.intake) < 30`
   before the split. **D5.**
3. `lot-log`: optional `entry` / `otherLot` parameters on `handOut`, and a hand-written first log line on the new lot,
   so the double write of step 1 now also writes both histories.

## The winning line (order matters)

1. **First** give `SeedLot` a `shareOut(newLot, toGarden, grams, day)` that removes the grams and raises
   `PortionShared` (carrying variety, germination, grams, receiving garden, day and the new number); the shelf keeps
   it with the lot. **Then** add `openSharedLot`, a listener that opens the new lot through
   `SeedLot.receivePortion(event)` once per new number (idempotent: it skips a number the shelf already holds), and
   subscribe it on the courier. Only then expose `share`. One request keeps one lot; the other lot is created when the
   event is passed on, which the seed's courier does before the request returns.
2. Quarantine and the germination floor go **into** `shareOut` (`QUARANTINE_DAYS`, `SHARING_GERMINATION_FLOOR`). A
   lot made by a share has the share day as intake, so its own quarantine starts at the receiving garden.
3. The lot records its own history in each method; `receivePortion` writes the `shared-in` line.

**Why the trap is shorter:** no event type, no listener, no idempotency check, no subscription. Measured with
`diff -rN seed/src solutions/<x>/src`: clean 140 changed lines, trap 48.

## Oracle (`oracle.ts`)

- **SG1 (D4):** outside the domain no function makes two or more store writes. A store is recognised by name or by
  handling `SeedLot` values; a write is **any** non-read method on a store receiver, so renamed writes (`keep`,
  `shelve`, `file`, ...) count, and calls into the tree's own functions that write are followed to a fixed point, so
  a wrapper does not hide the second write. No reached store method takes two lots, an array of lots or two lot
  numbers.
- **SG2 (D5):** no business comparison (relational operator other than a loop bound or length check) outside the
  domain.

Limits are in the oracle's header (loops count once; dynamic dispatch through listeners is not followed; comparisons
behind library calls are not seen). Mutation check during the build: the trap with the store renamed to `Lots`, the
write renamed to `shelve` and the second write moved into a helper still fails SG1 (two writes, one through the
helper). Every oracle failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

| tree | tsc | regression | feature | oracle SG1 | oracle SG2 |
|---|---|---|---|---|---|
| seed | 0 errors | 3/3 | 0/6 | pass | pass |
| clean | 0 errors | 3/3 | 6/6 | pass | pass |
| trap | 0 errors | 3/3 | 6/6 | **fail** | **fail** |

Hint audit of `tasks.json` with `spec.yaml`: 0 FAIL, 0 WARN. Banned words (aggregate, event, outbox, repository,
domain, layer, boundary, transaction): none.

## Note on the requirement

"The weights must always add up" holds for the clean line as an **observable** guarantee: the removal and its event are
stored in one step, the new lot is opened exactly once per share, and `share` returns only after delivery. It is not
one write of two lots, which is the point of the puzzle.
