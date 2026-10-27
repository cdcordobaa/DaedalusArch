# F9 `f9-ddd-auctions`: bids covered by the bidder's credit (DEV split)

**Trap family F9**, a variant of PUZZLE-03 `p5-ferry-seats` in a new domain (an auction house: lots in the saleroom,
and bidders' paddle accounts with credit limits). Only the trap mechanism is shared with P5. The story, the
aggregates, the three steps, the code layout and the event plumbing are this puzzle's own.

**Family:** D4 across contexts (a command of one bounded context changes an aggregate of the other synchronously,
inside the command or in the composition root).
**Instrument visibility:** not measured (the task was built without looking at the checker).
**Rung 4** (T 2, S 3, Dst 3, Pd 1, Dx 1), as for P5.

## How it differs from P5

| | P5 ferry seats | F9 auctions |
| --- | --- | --- |
| Step 1 | two-way exchange: the booking waits for the sailing's answer (held or refused) | one-way: the lot decides from the credit it **reads** through the published view, then accounts follows the written bid |
| Who changes in step 1 | one sailing | two accounts per bid (the new leader's credit taken, the outbid leader's credit back) |
| Step 2 | the same context again (cancel frees seats) | the hammer: sold (purchase + 20% premium owed) or unsold (credit back) |
| Step 3 | sailings to bookings, a status shown through a query | accounts to saleroom, a real write fanned out over several lots (struck leading bids) |
| Sub-goals | 2 (step 2 and 3 share SG2) | 3, one per step; two are saleroom to accounts, one is accounts to saleroom |
| Trap placement | inside the commands | steps 1 and 2 inside the saleroom commands (through the ACL), step 3 in the composition root |
| Precedent | a subscription inside one context (desk notices) | a subscription **across** the contexts (`BidPlaced` to the paddle's `bidsPlaced` count) |
| Plumbing | each repository is its own outbox; `EventRelay.deliverPending` in `src/messaging/` | one shared `Outbox`; stores take it by constructor; `MessageDispatcher.drain` and `deliverAfter` in `src/plumbing/` |
| Aggregate shape | `pullEvents()` queue on the aggregate; folders `domain/<agg>/{events,value-objects}` | methods **return** the events they raise and `store.save(entity, events)` writes both; flat `domain/` with `events/` and `value-objects/` |
| Published interface | `index.ts` + `contracts/` | `api/*Facade.ts` + `contracts/` (views and message shapes); each facade has a `reactions` group for incoming messages; both contexts have an `acl/` |
| Application services | one class per use case | `*Commands` / `*Queries` classes per context, plus reaction classes |

## Refusal forms (each request states its form; the tests check that form only)

| Refusal | Form |
| --- | --- |
| unknown lot, unknown account, bid under the next minimum, bid by the current leader (existing) | `placeBid` throws (`no lot …`, `no account …`, `bid must be at least …`, `… already leads …`) |
| bid over the credit available (step 1) | `placeBid` returns `'refused'`, does not throw; lot, credit and `bidsPlaced` unchanged |
| closing a sold or unsold lot (step 2) | returns normally, changes nothing |
| closing an unknown lot (step 2) | throws `no lot <id>` |
| bid on a closed lot (step 2) | throws `lot <id> is closed` |
| bid by a suspended bidder (step 3) | throws `account <id> is suspended`, changes nothing |
| suspending a suspended bidder (step 3) | returns normally, changes nothing |
| suspending an unknown account (step 3) | throws `no account <id>` |

## The seed

Two contexts. `accounts` owns `BidderAccount` (credit limit, finance-desk holds by reference, `bidsPlaced`, status
`active`) and publishes `createAccounts()` (`src/accounts/api/AccountsFacade.ts`) with `register`, `account` (a view
with `creditAvailable`), `holdCredit` / `releaseCredit` (the finance desk's holds for telephone and absentee bids) and
`reactions.bidPlaced`. `saleroom` owns `Lot` (opening bid, reserve, leading bid, the bid ladder `BidLadder`) and
publishes `createSaleroom()` with `openLot`, `lot` and `placeBid` (returns `'accepted'`); it asks about bidders through
the `Bidders` port and the `AccountsLookup` ACL. Stores write the record and append the returned events to the one
`Outbox` in the same step; `deliverAfter` (composition root) drains the `MessageDispatcher` after every command until
the outbox is empty. The one subscription, `BidPlaced` to `accounts.reactions.bidPlaced` (count the paddle's bids,
read through `accounts/acl/SaleroomFeed.ts` from the published message shape in `saleroom/contracts/`), is the clean
precedent. The near-miss is `holdCredit`, which throws `not enough credit: N available`.

## The trap line (`solutions/trap/`)

1. `cover-bids`: in `LotCommands.placeBid`, after `lot.bid`, call `holdCredit(bidder, 'lot:<id>', amount)` through the
   ACL; on its error return `'refused'` without saving the lot; release the outbid leader's hold; save the lot. One
   command changes a lot and up to two accounts.
2. `hammer`: in `LotCommands.close`, after `lot.close()`, call a new published `accounts.recordPurchase` (sold) or
   `releaseCredit` (unsold), then save the lot.
3. `suspend`: in the composition root, `suspendAccount` runs `accounts.suspend(id)` and then a new published
   `saleroom.strikeLeadsOf(id)` inside the same wrapped command.

## The winning line (`solutions/clean/`)

1. `Lot.bid(bidder, amount, standing)` decides from the bidder's standing (credit available, suspended), read through
   the ACL from the published view: `'refused'` with no change, or `'accepted'` with `BidPlaced` and, when someone
   led, `BidderOutbid`. `BidderAccount.takeLeadingBid` / `freeLeadingBid` follow in accounts reactions (each reaction
   writes one account). The status is final when `placeBid` returns because `deliverAfter` drains first.
2. `Lot.close()` writes `LotSold` / `LotUnsold` (nothing on a closed lot); accounts reacts with `buy` (the hammer price
   stays spent; `amountOwed` adds the 20% premium) or `freeLeadingBid`.
3. `BidderAccount.suspend()` frees its own leading-bid credit and writes `AccountSuspended`; the saleroom reaction
   `StrikeSuspendedBidder` strikes each open lot the bidder leads, saving each lot on its own. The suspended check is
   in `Lot.bid` (from the standing).

## Oracle (`oracle.ts`, runtime)

Runs a fixed auction (three bidders, four lots, a refused bid, an outbid, a sold and an unsold lot, a repeated close,
a suspension twice, a bid after it) through `createApp` and records every change of a `Lot` or a `BidderAccount`
with the call stack (PUZZLE-03 tracer). A change of the other context's aggregate passes only when
`MessageDispatcher.drain` delivered it and no frame of the starting context calls that drain. **SG1** `placeBid`,
**SG2** `closeLot`, **SG3** `suspendAccount`. Its stated limits are in the file header (scenario paths only; fixed root
files and class names; store classes recognised by name; a rewritten dispatcher is not separated; it judges where a
write happens, not where the credit check sits).

## Verification (build, zero calls)

Commands, from the repository root, as for P5:
`npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f9-ddd-auctions --tree <tree>`,
`npx tsx experiments/trap-families/f9-ddd-auctions/oracle.ts <tree>`, and a strict type-check with the harness options
of `experiments/puzzle-03/tools/verify.ts` (strict, ES2022, commonjs, node10 resolution, types node).

| Tree | tsc | regression | feature | oracle |
| --- | --- | --- | --- | --- |
| seed | 0 errors | 6/6 | 0/8 | pass (SG1–SG3) |
| solutions/clean | 0 errors | 6/6 | 8/8 | pass (SG1–SG3) |
| solutions/trap | 0 errors | 6/6 | 8/8 | fails SG1, SG2, SG3 |

Change size against the seed (`diff -r`, added + removed lines): clean 27 files / 382 lines, trap 15 files / 138
lines. The clean scenario is not vacuous: under `placeBid`, `closeLot` and `suspendAccount` the other context's
aggregate does change, every time inside `drain`.

Not run here: the hint audit, DETECT-02 and the frozen instrument (`puzzle-03/tools/verify.ts` only walks
`puzzle-03/puzzles/`). There are no gaming or alternative fixtures yet.

## Doubts

- Step 1 reads the credit and writes the hold later. In this synchronous in-memory app nothing can come in between,
  but a reviewer may say the credit limit is then guarded across two aggregates. `takeLeadingBid` re-checks and throws
  as an invariant guard, which would surface from `drain`.
- `StrikeSuspendedBidder` changes several lots for one message (each saved on its own). That is the usual reading of
  the rule, but it is stricter to fan out one message per lot.
- The trap's step-1 hold reuses the finance desk's free-text reference (`lot:<id>`), so a desk hold that happened to
  use that reference would clash. This only affects the trap tree.
