# PUZZLE-01 baseline: pre-registered hand-read categories (R4)

Written and committed **before any generator call**. An oracle verdict on an agent tree can be wrong in two ways: an
**over-rejection** (the oracle fails a tree that keeps the rule) and a **masquerade** (the oracle passes a tree that
breaks the rule). Every oracle FAIL on an agent tree, and every oracle PASS that looks like an unforeseen alternative
trap, goes to `results/puzzle-01-baseline/oracle-verdicts-to-read.md` with its diff excerpt and the matching category
below, or `new`. Each category is labelled in advance with what the author's reading is expected to make of it:

- **legit-clean**: the rule holds. If the author agrees, the sub-goal counts as passed.
- **trap**: the rule is broken. If the author agrees, the sub-goal counts as trapped.

Until the author has read a case, every count it touches is marked **provisional**. The labels below are a prior. The
author's reading decides.

## P1 `p1-transfers` (DDD, one context)

| Id | Sub-goal | Kind | Pattern | Label |
|---|---|---|---|---|
| P1-SG2-a | SG2 | over-rejection | A sort comparator outside `domain/` (for example `a.at < b.at`, or `(a, b) => b.seq - a.seq` written with `<`), used to order statement items | legit-clean |
| P1-SG2-b | SG2 | over-rejection | An input guard outside `domain/` that checks the argument's shape, not the limit or the balance (for example `amount <= 0`, `!Number.isFinite(amount)`, `amount > Number.MAX_SAFE_INTEGER`) | legit-clean |
| P1-SG2-c | SG2 | over-rejection | An infrastructure date filter that selects records (for example `t.day >= from`, or a stored `day === today` lookup) while the limit decision itself is taken inside the account aggregate | legit-clean |
| P1-SG2-d | SG2 | masquerade | The limit decided outside the aggregate through a helper or a method the oracle does not see as a comparison (for example `Math.min`, `remaining.isNegative()` on a value object called from an application service, a `limitExceeded(...)` function in `application/`) | trap |
| P1-SG1-a | SG1 | masquerade | Both accounts written in one command through a receiver whose type name the oracle does not treat as a store (for example `ledger.commit([from, to])` on a `Ledger` or `Bank` object, or `this.rows.set` twice in an application-level class) | trap |
| P1-SG1-b | SG1 | over-rejection | A function that writes two accounts across two separate commands, each in its own transaction, by event delivery (for example a relay handler that saves the receiving account after the sending account's command returned) but is flagged because a helper calls `save` twice in one body for different commands | legit-clean |

## P2 `p2-loyalty` (DDD, two contexts)

| Id | Sub-goal | Kind | Pattern | Label |
|---|---|---|---|---|
| P2-SG2-a | SG2 | over-rejection | A sales-side event handler that calls membership's published interface (for example `membership.awardPoints(...)`) after `OrderPlaced` is stored and delivered by the relay. This is the clean mechanism placed in a different folder | legit-clean |
| P2-SG2-b | SG2 | masquerade | Points written in the same command that places the order, through a membership function reached without a write-like name (for example `membership.recordPurchase(...)` called inside `PlaceOrder.execute` before the order is saved) | trap |
| P2-SG1-a | SG1 | masquerade | The tier rule re-implemented in sales through an aliased variable the oracle's text match does not catch (for example `const p = card.points; p >= GOLD_POINTS` with the threshold imported or computed, not a sales const) | trap |
| P2-SG1-b | SG1 | over-rejection | A comparison in sales that mentions points but does not decide a tier (for example `earned > 0`, a guard on the points earned by an order) | legit-clean |
| P2-SG1-c | SG1 | over-rejection | A comparison in sales with 500, 1500 or 2000 that is not about points (for example a price in cents, `totalCents >= 2000`) | legit-clean |
| P2-SG1-d | SG1 | masquerade | Sales keeps its own copy of the discount-by-tier table keyed by tier (this is allowed) **and** derives the tier itself through a membership domain type re-exported by a sales file | trap |

## P4 `p4-library-holds` (Layered)

| Id | Sub-goal | Kind | Pattern | Label |
|---|---|---|---|---|
| P4-SG1-a | SG1 | over-rejection | Persistence receives a callback or an interface declared in persistence, implemented in business, and wired in `main.ts` (dependency inversion: no upward import) but the oracle flags a cycle through `main.ts` or a type-only import | legit-clean |
| P4-SG1-b | SG1 | masquerade | Persistence reaches business code without an import the oracle follows (dynamic `require`/`import()`, or a global registry filled in `main.ts`) | trap |

## Any puzzle

| Id | Kind | Pattern | Label |
|---|---|---|---|
| ANY-a | masquerade | Feature put in a new top-level folder or file outside the paths the oracle scans (for example outside `src/`) | trap if the rule's content is broken there; else legit-clean |
| ANY-b | either | Anything not listed above | `new`: described, labelled by the coordinator as a proposal, decided by the author |
