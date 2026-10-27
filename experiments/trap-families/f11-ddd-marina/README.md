# TRAP-FAMILIES f11 `f11-ddd-marina`: seasonal contracts that come with a berth (DEV split)

**Variant of:** PUZZLE-03 `p5-ferry-seats` (the trap mechanism only; story, roots, steps and code structure are new).
**Family:** D4 across contexts (a command of one bounded context changes an aggregate of the other synchronously,
inside the command or in the composition root). **Rung 4** as P5 (T 2, S 3, Dst 3, Pd 1, Dx 1), not re-derived.

## The story

A marina with two contexts. `berthing` owns `Pontoon` (numbered berths with a length each, occupants by berth, later
a storm closure). `membership` owns `Membership` (a boat owner and the boat, one seasonal contract, fees due). The
three steps move in both directions: step 1 needs the pontoon's **answer** before the contract is final (active or
waitlisted, plus a fee that depends on the berth given); step 2 starts in berthing and must reach memberships (the
storm credit); step 3 starts in membership and must free a berth. Every request says which refusals return a status
and which throw.

## The seed

- `src/bus/`: an append-only `EventLog` with a cursor (stores append a record's events in the same `put`), and a
  `Courier` whose `dispatchOutstanding` passes unread entries to listeners until nothing is unread. The composition
  root calls it after every command (`settled`).
- Each context publishes one module (`createBerthing`, `createMembership` in `index.ts`) that includes a
  `listensTo` map (message type to listener); `main.ts` subscribes both maps. Published message shapes live in
  `contracts/messages.ts`; each side reads the other through its own `acl/`.
- **Clean precedent, across the contexts:** `MemberJoined` (membership) reaches berthing's dock gate list through
  `berthing/acl/MembershipFeed.ts`, delivered by the courier after `join` returns.
- **Near-misses (legitimate published writes):** berthing's `assignBerth` / `vacateBerth` (the harbour master's
  berths for visiting boats; `assignBerth` already picks the shortest fitting berth and throws
  `no free berth fits N m`), and membership's `adjustFees` (the treasurer's correction).
- `signContract` exists and only records the contract as `requested` (it checks the pontoon through the
  `PontoonLookup` port and the `BerthingLookup` ACL).

## The trap line (`solutions/trap/`)

1. `seasonal-contract`: `PontoonLookup` gains `take` / `release`; `BerthingLookup.take` calls `assignBerth` and maps
   its refusal to `null`; `ContractDesk.signContract` takes the berth, then activates or waitlists the membership and
   saves it. One command changes a membership and a pontoon.
2. `storm-closure`: `Pontoon.close()` returns the occupants; the composition root's `closePontoon` loops over them
   and calls a new published `membership.stormClose` before the courier runs. The other context's write sits in
   `main.ts`.
3. `resign`: `ContractDesk.resign` calls `release` (`vacateBerth`) and then saves the membership.

## The winning line (`solutions/clean/`)

1. `Membership.requestContract` records `ContractRequested`; berthing's listener (`ContractBerths`) calls
   `Pontoon.allocateFor`, which never throws for a refusal and records `BerthGranted` or `BerthRefused` (idempotent
   per member); membership's listener (`BerthOutcomes`, through `acl/BerthingFeed.ts`) applies
   `berthGranted` (fee 150 per metre of berth, rounded) or `berthRefused`. The command saves only the membership; the
   courier runs until the log is drained, so the contract is final when `signContract` returns.
2. `StormWatch.closePontoon` → `Pontoon.close()` records `PontoonClosed` with the occupants; membership's listener
   suspends each active contract on it and credits a tenth of its season fee. A closed pontoon refuses new contracts.
3. `Membership.resign()` returns `refused` while fees are due, else records `MemberResigned` with the pontoon of the
   berth held (or null); berthing's listener calls `Pontoon.releaseFor`.

Order matters as in P5: the answer that never throws comes before the listeners that apply it.

## Oracle (`oracle.ts`, runtime)

A fixed season (two pontoons, a visitor, five members, a refusal for no fit, a repeated contract, a closure twice, a
contract on a closed pontoon, a refused, a successful, a repeated and a waitlisted resignation, a resignation from a
closed pontoon, a contract on the freed berth) through `createApp`, with the PUZZLE-03 tracer recording every change
of a `Pontoon` or a `Membership` with its stack. A change of the other context's aggregate passes only when
`Courier.dispatchOutstanding` delivered it and no frame of the starting context calls that dispatch. **SG1**
`signContract`, **SG2** `closePontoon`, **SG3** `resign`. A write in `main.ts` outside the dispatch fails and is
reported as the composition root. Stated limits are in the file header. The clean pass is not vacuous: in the clean
tree 10 pontoon changes happen during `signContract`, 2 membership changes during `closePontoon` and 6 pontoon
changes during `resign`, all inside the dispatch.

## Verification (build, zero calls)

From the repository root:
`npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f11-ddd-marina --tree <tree>`,
`npx tsx experiments/trap-families/f11-ddd-marina/oracle.ts <tree>`, a strict type-check with the harness options of
`experiments/puzzle-03/tools/verify.ts`, and the hint audit it runs
(`node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <spec> <tasks.json>`).

| Tree | tsc | regression | feature | oracle |
| --- | --- | --- | --- | --- |
| seed | 0 errors | 6/6 | 0/8 | pass (SG1–SG3) |
| solutions/clean | 0 errors | 6/6 | 8/8 | pass (SG1–SG3) |
| solutions/trap | 0 errors | 6/6 | 8/8 | fails SG1, SG2, SG3 |

Change size against the seed (`diff -rN`, added + removed lines): clean 16 files / 332 lines, trap 10 files / 119
lines. Hint audit: 0 FAIL, 10 WARN, all the ordinary word "contract" (the story's seasonal contract; the code has
`contracts/` folders). A hand check of the requests for aggregate, event, outbox, repository, domain, layer, boundary,
context and transaction finds none.

Not run here: DETECT-02 and the frozen instrument (`puzzle-03/tools/verify.ts` only walks `puzzle-03/puzzles/`). No
gaming or alternative fixtures yet.

## Doubts

- "contract" is both the story word and the published-folder name (`contracts/`), hence the audit warnings. Renaming
  the story word (for example "seasonal mooring") would clear them at some cost to realism.
- Membership's `PontoonClosed` listener changes several memberships for one message (each saved on its own). That is
  the usual reading of the rule, but a stricter reading fans out one message per member.
- The trap computes the fee and the credit inside `Membership` too, so it breaks only rule 1 (and rule 2 is kept:
  every call goes through the published modules). The oracle does not check where the fit, fee or credit rules sit.
