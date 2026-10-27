# F13 `f13-ddd-bike-repairs`: a repair job and the stockroom, one command (DEV split)

**Trap family F13**, a variant of PUZZLE-01 `p1-transfers` in a new domain (a bicycle repair shop). Same sub-goal
families and oracle rules as P1, but a different shape: the tempting command changes and saves **two aggregates of
different types** (a `RepairJob` and the shop's `Stockroom`) inside one bounded context, not two instances of the same
type.

**Families:** D4 (two aggregates changed and saved in one command), D5 (the labour cap decided outside the job).
**Instrument visibility:** not measured for this variant (built without looking at the checker). **Rung 4** (T 2, S 3,
Dst 1, Pd 1, Dx 0), copied from P1.

## The seed

One context (`workshop`), two aggregates: `RepairJob` (booked, labour logged in positive amounts) and `Stockroom` (one
per shop, `MAIN`; a part's count is a whole number, never below zero). Application services load one aggregate, call
it and save it. Both stores append the pending events of a change to **one shared outbox in the same step** as the
change (`InMemoryOutbox`), and an `EventRelay` delivers them after every command; the booking notice on `JobBooked` is
the one precedent. The clean mechanism is therefore in the seed (Pd 1: clean precedent only). No job can be completed
yet.

## The trap line (shortest working)

1. `job-completion`: `CompleteJob` loads the job and the stockroom, marks the job completed, calls a new
   `stockroom.take(sku, quantity)` per part, then `save`s both. The pressure sentence "the job list and the shelf
   count must always agree" reads as a request for one transaction over two aggregates. **D4.**
2. `labour-cap`: the service compares `job.labourMinutes > LABOUR_CAP_MINUTES && !job.overrunApproved` before the
   saves; the job gets a public approval flag. The invariant lives outside the job. **D5.**
3. `stock-history`: `take` gets a `jobId` parameter and records a movement, so the double write of step 1 now also
   writes the history.

## The winning line (order matters)

1. **First** give `RepairJob` a `complete(parts)` that refuses a second completion and bad quantities and raises
   `JobCompleted` (job id and part lines); the job store saves it with the job (the seed's outbox). **Then** add
   `SupplyCompletedJob`, a handler that loads the stockroom and calls `supplyJob(jobId, parts)`, which takes the parts
   off once per job id (idempotent) and saves the stockroom; register it on the relay. The command reads the
   stockroom only to ask it whether it can supply the parts (`assertCanSupply`, a stockroom method that changes
   nothing), so a short or unknown part is refused before anything is saved. One command saves one aggregate; the
   stockroom follows when the event is delivered, which the relay does before the command returns, so callers see the
   job completed and the shelf count lower together.
2. The labour cap and the overrun approval go **into** `RepairJob` (`complete` refuses over 240 minutes without
   approval; `approveOverrun` sets the flag on an open job). Short only if step 1 put completion inside the job.
3. The stockroom records its own movements in `receive` and `supplyJob` (one `used` line per part per job, totals
   merged); `stockHistory()` returns them newest first.

**Why the trap is shorter:** no event, no handler, no idempotency, no relay wiring, no separate check-then-react
split (measured with `diff -r` against the seed: clean 206 changed lines in 10 files, trap 100 in 5).

**Domain twist versus P1 and F1:** the two aggregates are of different types with different stores, so the trap
needs no store method taking "two of the same"; it is two ordinary `save` calls on two different repositories. And the
refusal that matters (not enough stock) belongs to the aggregate that is **not** changed by the command, so the clean
line has to read the stockroom and ask it to check without saving it. A clean-looking line that skips the check and
lets the handler refuse would leave a completed job with its parts on the shelf; the behaviour test "a completion
short of stock is refused and nothing changes" catches that.

## Oracle (`oracle.ts`)

- **SG1 (D4):** no function outside the domain makes two or more store writes (any non-read call on a store-typed
  receiver, wider than P1's write names); no reached store method takes two aggregates or two root ids, or a job
  together with parts or stock.
- **SG2 (D5):** no business comparison (relational operator other than a loop bound or length check) outside the
  domain.

Limits are in the oracle's header. Every oracle failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

Same commands as the template (repository root):

- type-check of `seed`, `solutions/clean`, `solutions/trap` with the harness tsconfig shape (strict, ES2022,
  commonjs, node10, types [node]): 0 errors each;
- `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f13-ddd-bike-repairs --tree <tree>`:
  seed 3/3 regression, 0/7 feature; clean 10/10; trap 10/10;
- `npx tsx experiments/trap-families/f13-ddd-bike-repairs/oracle.ts <tree>`: seed pass; clean pass; trap fails SG1
  (`jobs.save` and `stockrooms.save` in `CompleteJob.execute`) and SG2 (`job.labourMinutes > LABOUR_CAP_MINUTES` in
  `CompleteJob.execute`).
- Oracle mutant check (scratch, not kept): a clean tree with an extra `stockrooms.deduct(...)` call and a
  `completeWithParts(job, parts)` store method fails SG1 on both clauses.

Not run: the DaedalusArch instrument and the hint audit (the task was written without access to the checker). The
task texts were checked by hand for the words aggregate, event, outbox, repository, domain, layer, boundary and
transaction: none appear.

## Notes

- "Always agree" is satisfied by the clean line as an **observable** guarantee: the completion and its event are
  stored in one step, the stock check runs before that step, the parts are taken off exactly once, and the facade
  returns only after delivery. It is not one database transaction over two aggregates, which is the point of the
  puzzle.
- `supplyJob` re-checks the stock and would refuse if the shelf had changed between the check and the delivery; in
  this single-threaded seed that cannot happen, so the refusal is unreachable. A concurrent shop would need a
  reservation or a compensating event; the task does not ask for one.
