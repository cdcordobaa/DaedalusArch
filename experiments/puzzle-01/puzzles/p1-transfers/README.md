# P1 `p1-transfers`: two accounts, one command (DEV split)

**Families:** D4 (two aggregate instances changed and saved in one command), D5 (the daily limit decided outside the
aggregate). **Instrument visibility:** invisible (verified, `../../verification.json`): a **blind-control** puzzle.
**Rung 4** (T 2, S 3, Dst 1, Pd 1, Dx 0).

## The seed

One context (`ledger`), one aggregate (`Account`: balance never below zero), application services that load one
account, call it and save it, and a store that saves an account **together with its pending events** (an outbox). An
`EventRelay` delivers stored events after every command; the welcome notice on `AccountOpened` is the one precedent.
The clean mechanism is therefore already in the seed (Pd 1: clean precedent only).

## The trap line (shortest working)

1. `transfers`: `TransferMoney` loads both accounts, `withdraw` on one, `deposit` on the other, `save` both. The
   pressure sentence "the two balances change together or not at all" reads as a request for one transaction over
   two aggregates. **D4.**
2. `daily-limit`: the service asks the store how much the account sent today and compares (`money.cents > left`),
   then records the amount in a side table: a third write in the same command, and the invariant lives outside the
   account. **D5** (and D4 again).
3. `statements`: optional `kind` and `counterpart` parameters on `deposit`/`withdraw`, so the double write of step 1
   now also writes both statements.

## The winning line (order matters)

1. **First** give `Account` a `sendTransfer(transferId, to, toCurrency, amount, day)` that takes the money out and
   raises `TransferSent`; the store saves it with the account (the seed's outbox). **Then** add `ReceiveTransfer`, a
   handler that credits the destination once per transfer id (idempotent), and register it on the relay. Only then
   expose `transfer`. One command saves one account; the destination follows when the event is delivered, which the
   seed's relay does before the command returns, so callers see both balances changed.
2. The daily limit goes **into** `sendTransfer` (the account keeps what it sent on which day). This is only short if
   step 1 put the transfer inside the aggregate; after the trap line, the service is the natural place.
3. The account records its own movements in each method; `statement()` returns them newest first.

**Why the trap is shorter:** it needs no event, no handler, no idempotency and no relay wiring (see
`verification.json` → `size`).

## Oracle (`oracle.ts`)

- **SG1 (D4):** no function outside the domain makes two or more store writes; no store type declares a write taking
  several `Account`s.
- **SG2 (D5):** no business comparison (relational operator other than a loop bound or length check) outside the
  domain.

Limits are in the oracle's header. Every oracle failure on an agent tree is hand-read before it counts.

## Note on the requirement

"Together or not at all" is satisfied by the clean line as an **observable** guarantee: the debit and its event are
stored in one step, the credit is delivered exactly once, and the facade returns only after delivery. It is not one
database transaction over two aggregates, which is the point of the puzzle.
