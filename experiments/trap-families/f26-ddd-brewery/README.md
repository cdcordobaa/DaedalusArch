# f26 `f26-ddd-brewery`: brew day draws the lots (DEV split, variant of `p1-transfers`)

**Families:** D4 (a brew changes and keeps two different aggregate types, the batch and its ingredient lots, in one
command), D5 (the best-before and fermentation-days rules decided outside the aggregates). **Rung 4** (T 2, S 3,
Dst 1, Pd 1, Dx 0). Only the trap mechanism is shared with P1; story, aggregates, code style and layout are new.

## The seed

One context (`cellar`), two aggregates written as plain immutable records plus functions (no classes):
`IngredientLot` (what is left never below zero; never accepted past its best-before) and `BrewBatch` (planned, with
its minimum fermentation days). Each has its own store interface (`LotStore.keep`, `BatchStore.record`; reads are
`lookup` and `next...Id`). Both in-memory stores post the facts a change raised (`raised`) to one shared `Mailbox` in
the same step; `createRelay(mailbox).flush()` runs after every command in `main.ts`. The goods-in book line on
`lot-received` is the one precedent of a reaction to a kept fact (Pd 1: clean precedent only). The seed also has
`writeOff`, whose `takeFromLot` already gives the "not enough in lot" refusal.

## The trap line (shortest working)

1. `brew`: add `brew` next to `plan` in `batchCommands`: look the batch up, map every use to `takeFromLot`, compare
   `day > lot.bestBefore` inline, then `lots.keep` each drawn lot and `batches.record` the brewed batch. "Stock and
   batch must always agree" reads as a request to keep both together. **D4** and **D5**.
2. `bottling`: compute the earliest day in the command and compare `today() < earliest` there. **D5.**
3. `lot-usage`: an optional `batchId` parameter on `takeFromLot`, so the double write of step 1 also records usage.

## The winning line (order matters)

1. **First** give the lot `confirmSupply(lot, grams, day)` (best-before and enough-left, changes nothing) and
   `supplyBrew(lot, batchId, grams)` (idempotent per batch), and give the batch `brew(batch, draws, day)`, which
   refuses repeats or empty lists and raises `batch-brewed` with the draws. The command asks every lot first, then
   records **only the batch**; a reaction `supplyLots` (registered on the relay) keeps one lot per draw when the fact
   is delivered, which the relay does before the command returns, so callers see the stock already down.
2. `bottle(batch, day)` lives in the batch with `daysAfter` in the calendar value object.
3. The lot already keeps its `draws` (needed for idempotency in step 1); `lotUsage` reads them newest first.

**Why the trap is shorter:** no fact kind, no reaction, no idempotency, no relay wiring. Measured against the seed:
clean 8 files / 131 changed lines, trap 5 files / 64.

## Oracle (`oracle.ts`)

- **SG1 (D4):** outside the domain, no function body makes two or more store writes, where a write is any call on a
  store-typed receiver whose method name is not a read (so `keep`, `record`, or any renamed write counts); and no
  reached store method takes a lot and a batch together, or an array of either.
- **SG2 (D5):** outside the domain, no business comparison (relational operator other than a loop bound or a length
  check) and no `localeCompare`.

Limits are stated in the oracle's header (a write in a loop counts once; writes split across helper functions are not
added up; `Math.min`/`max` comparisons are not seen). Every oracle failure on an agent tree is hand-read before it
counts.

## Note on the requirement

"Stock and batch must always agree" and "a refused brew leaves everything as it was" hold observably on the clean
line: every lot is checked before anything is kept, the batch and its `batch-brewed` fact are kept in one step, each
lot is drawn exactly once per batch, and the facade returns only after delivery. It is not one write over two
aggregate types, which is the point of the puzzle. The check-then-draw gap is safe here because commands run one at a
time in memory; a concurrent store would need a compensating reaction (out of scope).

## Verification (zero calls)

Seed: tsc 0 errors, regression 4/4, features 0/7, oracle pass. Clean: tsc 0, 11/11, oracle pass. Trap: tsc 0, 11/11,
oracle fails SG1 and SG2. Commands (repository root):

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f26-ddd-brewery --tree experiments/trap-families/f26-ddd-brewery/<tree>
npx tsx experiments/trap-families/f26-ddd-brewery/oracle.ts experiments/trap-families/f26-ddd-brewery/<tree>
```
