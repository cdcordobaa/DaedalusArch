# PUZZLE-02 tool arm `mcp-detect`: hand read of the 6 oracle failures and the 3 functional failures

**Exploratory (v1.5-exp), DEV split, NOT Study 2b.** Zero model or generator calls. Read on 2026-10-22 from the
committed final trees (`sessions/<session>/snap/step-03/`) and diffs, against the categories pre-registered in
`experiments/puzzle-01-baseline/oracle-hand-read-categories.md` before any PUZZLE-01 call (the run note reuses them).
P2's rules are those of its `ARCHITECTURE.md`; the winning line is in
`experiments/puzzle-01/puzzles/p2-loyalty/README.md`. Reader: a coordinating Claude session other than the one that
ran the arm. **The author's reading decides**; §5 puts two cases, drawn with a recorded seed, to the author for a
spot-check. No agent message text is quoted. Excerpts are code. No oracle was changed.

Verdicts: **trap** (the rule is broken in the code), **over-rejection** (the oracle fails a tree that keeps the rule),
**unclear**.

## 1. Oracle failures (all on P2 `p2-loyalty`)

| # | Session (run) | Sub-goal | Verdict | Where (final tree) | Category | Reason |
|---|---|---|---|---|---|---|
| 1 | c01 (2) | SG2 | **over-rejection** | `src/sales/application/AwardOrderPoints.ts:13` (handler of the stored `OrderPlaced`) → `src/sales/acl/MembershipDirectory.ts:17` `membership.awardPoints`; subscribed at `src/main.ts:21`, delivered at `:25`; `PlaceOrder.ts:29` saves only the order | **P2-SG2-a** | One aggregate per command; the member follows through the relay and membership's published write |
| 2 | c03 (1) | SG2 | **over-rejection** | `src/sales/application/EarnPoints.ts:13` → `src/sales/acl/MembershipPoints.ts:9`; `main.ts:22`, `:26`; `PlaceOrder.ts:31` saves only the order | **P2-SG2-a** | As #1 |
| 3 | c04 (4) | SG2 | **over-rejection** | `AwardOrderPoints.ts:13` → `MembershipPoints.ts:9`; `main.ts:22`, `:26`; `PlaceOrder.ts:27` | **P2-SG2-a** | As #1 |
| 4 | c05 (3) | SG1 | **over-rejection** | `AwardOrderPoints.ts:11` `placed.pointsEarned <= 0` | **P2-SG1-b** | A guard on the points an order earned, not a tier decision; the tier is read from the card |
| 5 | c05 (3) | SG2 | **over-rejection** | `AwardOrderPoints.ts:12` → `MembershipDirectory.ts:13`; `main.ts:21`, `:25`; `PlaceOrder.ts:28`; the earning rule is in the `Order` aggregate (`src/sales/domain/order/Order.ts:43-46`) | **P2-SG2-a** | As #1 |
| 6 | c10 (0) | SG2 | **over-rejection** | `AwardOrderPoints.ts:13` → `MembershipDirectory.ts:20`; `main.ts:22`, `:26`; `PlaceOrder.ts:28` | **P2-SG2-a** | As #1 |

**Totals: 0 trap, 6 over-rejection, 0 unclear.** The reading agrees with the categories proposed in the report (§7).

## 2. Is the sales-side handler a clean design or a trap?

**Clean on both registered sub-goals, in all five trees.** The question was whether it is a cross-context write or a
duplicated rule. It is neither.

- **Not a cross-context write in one transaction (rule 1).**
  - In every tree, `PlaceOrder.execute` changes and saves one `Order`, and its outbox holds `OrderPlaced`.
  - The relay delivers the stored event only after the command's body has returned (`main.ts` `command()` wrapper,
    then `relay.deliverPending()`).
  - The handler then calls membership's published `awardPoints`. Membership's own command (`AwardPoints`) loads and
    saves the `Member`.
  - This is the delivery path of the winning line: `solutions/clean/src/main.ts:22` also subscribes a function
    outside membership that calls the published module. Only the folder differs, and where the earning rule lives.
  - The relay takes the pending batch before delivering (`EventRelay.ts:17-20`), so there is no redelivery and no
    double award. An idempotency guard like the clean `Member.creditPurchase(orderId, …)` is therefore not needed
    here.
- **Not a reach into the other context (rule 2).** The only membership symbols sales uses are `MembershipModule` and
  `MemberCard.tier`, both published (`membership/index.ts`). The planted `ReceiptFooter` keeps exactly its seed import
  in every tree.
- **Not a duplicated rule.**
  - The tier rule stays in `Member`: step 2 changed `GOLD_FROM` there only (`Member.ts:6`, all five), and sales reads
    the tier from the card.
  - The discount-by-tier table is in sales. That is allowed (P2-SG1-d's own wording, and the winning line's
    `CustomerTier.ts`).
  - The earning rule ("one point per whole 1.00 paid") exists once in each tree, and membership has no copy.
- **Not scored, recorded for the author (rule 3, business rules in the domain model).**
  - In c01, c03, c04 and c10, the earning rule is in a sales **application** handler (`Math.floor(…Cents / 100)` at
    `AwardOrderPoints.ts:12` / `EarnPoints.ts:12`). c05 is the exception: it puts the rule in the `Order` aggregate.
  - The discount table sits in the sales ACL (c03, c04, c05, c10: `MembershipDirectory.ts`) or in `PlaceOrder`
    (c01: `PlaceOrder.ts:18`), not in a sales domain object.
  - The winning line puts the earning rule in `Member` and the rate table in a sales value object.
  - Neither registered sub-goal covers rule 3, and the PUZZLE-01 hand read treated the same point in c07 as "noted,
    not scored". If the author wants it scored, it needs its own sub-goal and its own registration first. It does not
    change "placing an order changes no member".

## 3. P2-SG1-b (c05)

The oracle's SG1 text rule ("sales never compares points") fires on `placed.pointsEarned <= 0` in the handler, where
the run skips an award of zero points. The value compared is the order's earned points (`Order.pointsEarned()`), not
a member's balance. It decides nothing about a tier: c05's discount reads `MemberCard.tier` through the ACL
(`MembershipDirectory.ts:16-25`). This is the pre-registered example of P2-SG1-b (`earned > 0`, a guard on the points
earned by an order). **Over-rejection.**

## 4. Functional failures (tests, not oracle)

Re-run from outside with `experiments/puzzle-01/tools/run-tests.ts` on the final trees (zero calls). The results
match `scores.json`.

| Session (puzzle) | Failing test(s) | Cause | Where | Verdict |
|---|---|---|---|---|
| c11 (P1, redraw of c06) | both daily-limit tests: the receiving account ends at 600 instead of 1000, and at 1000 instead of 1300 | **The transfer id is not unique across commands.** `Transfer` numbers transfers with a per-instance counter, but `main.ts` builds a new `Transfer` for every command, so the second transfer between the same two accounts carries the same id as the first. The receiving `Account` then drops it as a repeated delivery: the money leaves the sender and never arrives | `src/ledger/application/Transfer.ts:8`, `:22-23` (id `T-<from>-<to>-<sequence>`, always 1); `src/main.ts:38` (`new Transfer(...)` per command); `src/ledger/domain/account/Account.ts:102` (dedupe on the id) | **real defect**, introduced at step 1 (`diffs/c11/step-01.diff`). It surfaces only when one pair transfers twice, which the step-1 test never does. It breaks the step-1 promise that money is never "gone from both accounts". The limit logic itself (`Account.ts:89-97`) is in the aggregate and correct. Oracle passes; not trapped |
| c01 (P2) | gold 10% / silver 5%: `[total, discount]` is `[100, 10]` instead of `[90, 10]` | `total` is reported **before** the discount | `src/sales/application/PlaceOrder.ts:30`, `:32` | **reading of the request** ("reports the discount next to the total"); 8 of the 10 P2 runs across both arms read total as the amount paid. Points are earned on the paid amount, so later steps pass |
| c03 (P2) | same, `[100, 10]` | same | `PlaceOrder.ts:28`, `:32` | **reading of the request**, as c01 |

The pre-registered rule stands: a failing test on the final tree is a functional failure, never clean.

## 5. Spot-check for the author (2 cases, drawn with a recorded seed)

Drawn without replacement from cases 1–6 of §1, with Python 3.13 `random.Random(20261022).sample(range(1, 7), 2)`:
**#3 and #6**. Both sessions' recorded seed (`sessions/<id>/snap/step-00/`) equals the committed P2 seed
(`experiments/puzzle-01/puzzles/p2-loyalty/seed/`) byte for byte, apart from the harness skeleton's `package.json`
(`diff -rq`, 2026-10-22). The SG1 case (#4) was not drawn.

| Pick | Case | What to read |
|---|---|---|
| A | **#3, c04 P2 SG2** | `diffs/c04/step-03.diff`; `sessions/c04/snap/step-03/src/main.ts:17-29`, `src/sales/application/AwardOrderPoints.ts`, `src/sales/acl/MembershipPoints.ts`, `src/sales/application/PlaceOrder.ts:24-29` |
| B | **#6, c10 P2 SG2** | `diffs/c10/step-03.diff`; `sessions/c10/snap/step-03/src/main.ts:17-29`, `src/sales/application/AwardOrderPoints.ts`, `src/sales/acl/MembershipDirectory.ts:19-21`, `src/sales/application/PlaceOrder.ts:24-30` |

> AUTHOR: spot-check A: agree / disagree. Spot-check B: agree / disagree.

## 6. Counts after the hand read

| | P1 `mcp-detect` | P1 baseline `none` | P2 `mcp-detect` | P2 baseline `none` |
|---|---|---|---|---|
| Clean solves | **4/5** (unchanged) | 0/5 | **3/5** (c04, c05, c10) | 1/5 (c07, PUZZLE-01 hand read) |
| Wilson 95% | [.38, .96] | [0, .43] | [.23, .88] | [.04, .62] |
| pass^5 (plug-in) | 0 | 0 | 0 | 0 |
| Trapped | 0 | 5 | **0** | 4 |
| Functional failures | 1 (c11) | 0 | 2 (c01, c03) | 0 |
| SG1 / SG2 on final trees | 5/5, 5/5 | 0/5, 3/5 | **5/5, 5/5** | 5/5, 1/5 |

These counts are provisional until the author's spot-check. A 3/5 against 1/5 split on P2 is not separable at n = 5.
