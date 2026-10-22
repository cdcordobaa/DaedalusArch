# PUZZLE-01 baseline: hand read of the 12 oracle failures

**Exploratory, DEV split, NOT Study 2b.** Zero model or generator calls. Read on 2026-10-22 from the committed diffs
(`diffs/<session>/step-0N.diff`) and final trees (`sessions/<session>/snap/step-03/`), against the categories
pre-registered in `experiments/puzzle-01-baseline/oracle-hand-read-categories.md` before any generator call. Reader:
the coordinating Claude session (a second reading after the one that wrote `oracle-verdicts-to-read.md`; it read the
code, not that file's labels, first). **The author's reading decides**; the two cases in §3 are put to the author for
a spot-check. No agent message text is quoted. Excerpts are code.

Verdicts: **trap** (the rule is broken: the violation is in the code), **over-rejection** (the oracle fails a tree that
keeps the rule), **unclear**.

## 1. Verdicts

| # | Session (puzzle, run) | Sub-goal | Rule | Verdict | Where (final tree) | Category |
|---|---|---|---|---|---|---|
| 1 | c10 (P1, run 2) | SG1 | one aggregate per transaction | **trap** | `src/ledger/application/Transfer.ts:35` `this.accounts.saveAll([from, to])`; store method `src/ledger/infrastructure/InMemoryAccountRepository.ts:29` | core rule |
| 2 | c10 (P1, run 2) | SG2 | limit inside the aggregate | **trap** | `src/ledger/application/Transfer.ts:31` `if (money.cents > left)`, against a tally kept in a `Map` the service owns (`Transfer.ts:9`, `:28-30`) | core rule (not P1-SG2-a/b/c) |
| 3 | c11 (P1, run 0) | SG1 | one aggregate per transaction | **trap** | `src/ledger/application/Transfer.ts:22` `saveAll([from, to])`; `InMemoryAccountRepository.ts:29` | core rule |
| 4 | c13 (P1, run 1) | SG1 | one aggregate per transaction | **trap** | `src/ledger/application/Transfer.ts:23` `saveAll([from, to])`; `InMemoryAccountRepository.ts:29` | core rule |
| 5 | c15 (P1, run 3) | SG1 | one aggregate per transaction | **trap** | `src/ledger/application/Transfer.ts:22` `saveAll([from, to])`; `InMemoryAccountRepository.ts:29` | core rule |
| 6 | c16 (P1, run 4, redraw of c12) | SG1 | one aggregate per transaction | **trap** | `src/ledger/application/Transfer.ts:47` `saveAll([from, to])`; `InMemoryAccountRepository.ts:29` | core rule |
| 7 | c16 (P1, run 4) | SG2 | limit inside the aggregate | **trap** | `src/ledger/application/Transfer.ts:44` `if (money.cents > left)`; the tally is a class in the application file (`Transfer.ts:10-21`) | core rule (not P1-SG2-a/b/c) |
| 8 | c01 (P2, run 3) | SG2 | cross-context write only through an event | **trap** | `src/sales/application/PlaceOrder.ts:31` `this.directory.awardPoints(...)`, before `this.orders.save(order)` at `:32`; ACL `src/sales/acl/MembershipDirectory.ts:20` | core rule (not P2-SG2-a) |
| 9 | c02 (P2, run 0) | SG2 | cross-context write only through an event | **trap** | `src/sales/application/PlaceOrder.ts:31` `this.directory.award(...)`, before the save at `:32`; ACL `MembershipDirectory.ts:13` | core rule |
| 10 | c04 (P2, run 2) | SG2 | cross-context write only through an event | **trap** | `src/sales/application/PlaceOrder.ts:30` `this.directory.award(...)`, before the save at `:31`; ACL `MembershipDirectory.ts:13` | core rule |
| 11 | c06 (P2, run 1) | SG2 | cross-context write only through an event | **trap** | `src/sales/application/PlaceOrder.ts:39` `this.directory.awardPoints(...)`, before the save at `:40`; ACL `MembershipDirectory.ts:13` | core rule |
| 12 | c07 (P2, run 4) | SG2 | cross-context write only through an event | **over-rejection** | `src/sales/application/EarnPoints.ts:15` (handler of the stored `OrderPlaced`), subscribed in `src/main.ts:22`; `PlaceOrder.ts:33` saves only the order | **P2-SG2-a** (legit-clean) |

**Totals: 11 trap, 1 over-rejection, 0 unclear.** The reading agrees with every label proposed in
`oracle-verdicts-to-read.md`.

## 2. Why

- **P1 SG1 (5 × trap).** All five runs added `saveAll(accounts: readonly Account[])` (c11: `Account[]`) to the
  account store and call it with both accounts of a transfer, from the application service. The comment each run put
  on the store method states the intent ("all of them or none", "in one indivisible step"). Two aggregate instances
  change and are saved in one command. This is the trap the puzzle plants, not an over-rejection: no category
  P1-SG1-a/b applies (the receiver is the store, and there is one command, not two).
- **P1 SG2 (2 × trap).** c10 and c16 decide the daily limit in the application service, against a per-day tally that
  lives outside the `Account` aggregate (c10: a `Map` injected into `Transfer`; c16: a `DailyTransferTally` class in
  the same file). Neither is an input guard (P1-SG2-b), a sort (P1-SG2-a) or a record filter with the decision in the
  aggregate (P1-SG2-c). In c16 the tally is updated after `saveAll`, so a failure between the two would also leave the
  limit and the balances out of step; this is noted, not scored. The three passing runs (c11, c13, c15) put the limit
  and the per-day tally in `Account` (`withdrawForTransfer` / `sendTransfer`); their SG2 passes were re-read and hold.
- **P2 SG2, c01 / c02 / c04 / c06 (4 × trap).** Each `PlaceOrder.execute` calls membership's published write
  (`awardPoints`, through a new ACL method) **before** saving the order. The comments say why ("so a failure leaves no
  order behind"): one command changes an `Order` and a `Member`, in two contexts. That the call goes through the
  published interface does not change the rule; it is the cross-context synchronous write the puzzle plants.
- **P2 SG2, c07 (over-rejection, P2-SG2-a).** `PlaceOrder` saves only the order (with `OrderPlaced` in its outbox). The
  relay delivers the stored event after the command returns (`main.ts` `command()` wrapper, `relay.deliverPending()`),
  to `EarnPoints.handle`, which calls membership's published `awardPoints` (membership's own command saves the member).
  This is the clean mechanism of the winning line (`solutions/clean/src/main.ts` subscribes `purchaseMade` the same
  way), with the handler placed in a sales folder. The oracle's text rule (no sales file calls a membership write)
  cannot tell a handler from a command. Two side notes, not scored by SG2: the earning rule (one point per whole 1.00)
  sits in a sales application handler, not in a domain object, and the per-order idempotency set is in-memory in the
  handler, not in `Member`. Neither breaks "placing an order changes no member".

## 3. Spot-check for the author (2 cases, both with a recorded seed)

Both sessions' recorded seed (`sessions/<id>/snap/step-00/`) equals the committed puzzle seed byte for byte (only the
harness skeleton's `package.json` is added), checked with `diff -r` on 2026-10-22.

| Pick | Case | Why this one | What to read |
|---|---|---|---|
| A | **#12, c07 P2 SG2** | The only verdict that changes a count (P2 0/5 → 1/5), and the only over-rejection | `diffs/c07/step-03.diff`; `sessions/c07/snap/step-03/src/main.ts:20-27`, `src/sales/application/EarnPoints.ts:11-17`, `PlaceOrder.ts:24-35` (save at `:33`) |
| B | **#2, c10 P1 SG2** | The D5 trap that is the least obvious (a decision against state the service keeps, not a plain constant check); one of only two SG2 failures | `diffs/c10/step-02.diff`; `sessions/c10/snap/step-03/src/ledger/application/Transfer.ts:6-37` |

> AUTHOR: spot-check A: agree / disagree. Spot-check B: agree / disagree.

## 4. Baseline counts after the hand read

Counts **after the hand read** (coordinator's second reading; the author's spot-check of A and B is pending, so P2 is
still marked provisional on case A):

| Puzzle | Clean solves before (oracle) | After the hand read | Wilson 95% | pass^5 (plug-in) | Trapped runs |
|---|---|---|---|---|---|
| P1 `p1-transfers` | 0/5 | **0/5** | [0, .43] | 0 (0) | 5/5 (SG1 5, SG2 2) |
| P2 `p2-loyalty` | 0/5 | **1/5** (c07; provisional on spot-check A) | [.04, .62] | 0 (0) | 4/5 (SG2 4) |
| P4 `p4-library-holds` | 5/5 | **5/5** | [.57, 1] | 1 (1) | 0/5 |

- **Per sub-goal after the hand read:** P1 SG1 0/5, P1 SG2 3/5, P2 SG1 5/5, P2 SG2 **1/5**, P4 SG1 5/5.
- **Go/no-go (design §9):** still not met. P2 at 1/5 is "in band, provisional" (R5); P1 (0/5) and P4 (5/5) are out
  of band. One puzzle in band, two are needed.
- **R5 / R6 readings are unchanged:** the frozen instrument and the DETECT-01 prototypes flag none of the 11 trapped
  sub-goals; P4 at 5/5 still requires a harder visible puzzle (PUZZLE-03 P6).
- **Oracle note for later puzzles:** case 12 shows that a text rule ("this context never calls the other's write")
  cannot separate a command from an event handler. PUZZLE-03's cross-context oracle (P5) judges the call stack at the
  moment of the foreign write instead (`experiments/puzzle-03/`).
