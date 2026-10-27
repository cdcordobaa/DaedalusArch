# F10 `f10-ddd-crowdfunding`: one owner for the backer standing, records that follow funded campaigns (DEV split)

**Trap family F10**, a variant of PUZZLE-01 `p2-loyalty` in a new domain (a crowdfunding platform: pledges capped
by the backer's standing). Only the trap mechanism is shared with P2; the story, the aggregates, the steps and the
code structure are this puzzle's own.

**Families:** D6 / D10 (the standing rule reached across the boundary, or re-decided from the backer's record), D4
across contexts (closing a campaign also writes every backer whose pledge it collected). **Instrument visibility:**
not measured (the task was built without looking at the checker). **Rung 5** (T 2, S 3, Dst 3, Pd 2, Dx 0), as P2.

## The seed

Two contexts. `backers` owns `Backer` (backed total and missed payments; the standing follows from them: blocked after
2 missed payments, trusted from 3,000.00 backed, established from 500.00, otherwise newcomer). It publishes the
`BackersFacade` class (`index.ts`) and the `BackerProfile` contract, which already carries the standing.
`campaigns` owns `Campaign`, an all-or-nothing campaign with inner `Pledge` entities: pledges are taken on an existing
campaign, and closing it collects every pledge when the goal is reached or releases every pledge otherwise. Campaigns
reach backers through a port (`BackerLookup`) and an ACL (`BackersAdapter`) over the facade. A campaign save writes the
campaign and its stored facts (`PledgeMade`, `CampaignClosed`, the latter listing the collected pledges) into an
outbox table in one step; `OutboxDispatcher.deliverPending` hands them on after each command (composition root).

**Clean precedent:** `CreatorMessages` reacts to the stored `PledgeMade` and `CampaignClosed` facts, subscribed in
`main.ts`. **Planted debt (Pd 2, trap-shaped precedent):** `campaigns/application/BackerHandles.ts` reads backers
through the backers' domain repository to show a handle. It never counts; copying it does.

Refusals in the seed, all explicit throws: unknown campaign (`no campaign`), unknown backer (`no backer`), a pledge
that is not positive (`positive`), a pledge on or a second close of a closed campaign (`closed`), a goal that is not
positive (`goal`), an empty title or handle, non-positive past backings.

## Steps (`tasks.json`)

1. `standing-limits`: per-campaign cap on a backer's total pledged, by standing (trusted 5,000, established 1,000,
   newcomer 250); `over the limit` and `blocked` refusals; the result reports `remaining`.
2. `trusted-threshold`: trusted from 2,000.00 backed; profile and cap must agree; "small change" pressure.
3. `fulfilled-pledges`: collected pledges are added to the backer's backed total at once and count for the standing
   from the next pledge; "never out of step" pressure; released pledges add nothing.

## The trap line (`solutions/trap/`)

1. `standing-limits`: copy the precedent: inject the backers' `BackerRepository` into `PlacePledge`, load the
   `Backer`, call `standing()`, pick the cap from a table in the command. **D6.**
2. `trusted-threshold`: change `TRUSTED_FROM_CENTS` in `Backer` (one place, because the trap reached into the owner).
3. `fulfilled-pledges`: in `CloseCampaign`, after saving the campaign, loop over the collected pledges, load each
   `Backer`, add the amount (reusing `addPastBackings`) and save it: one command, one campaign and N backers in two
   contexts. **D4.** "Must never get out of step" reads as a request for one transaction.

The instrument-invisible route (P2's `trap-alt` shape) is not built as a tree: reading `backedTotal` and
`missedPayments` from the published profile and re-deciding the standing in campaigns (**D10**), and calling a
published backers write from inside `CloseCampaign` (**D4**); the oracle fails it on SG1 (record comparison,
thresholds) and SG2 (run time).

## The winning line (`solutions/clean/`, order matters)

1. **First** extend `BackerLookup` with `standingOf(backerId)` and map the published `BackerProfile.standing` in the
   ACL into a campaigns-side `BackerStanding`; the cap per standing is a campaigns rule (`PledgeCap`), the standing
   is the backers'. **Then** give `Campaign.takePledge` the cap (blocked and over-the-limit refusals, `roomLeftFor`).
2. Change `TRUSTED_FROM_CENTS` in `Backer`: one place, and the profile and the cap agree by construction.
3. **First** add the rule to `Backer` (`creditCollectedPledge(pledgeId, amount)`, idempotent per pledge) and a
   `pledgeCollected` call to the published facade; **then** subscribe it to the stored `CampaignClosed` fact in the
   composition root, one facade call per collected pledge. `CloseCampaign` still saves only the campaign. The
   dispatcher delivers before the command returns, so the profile shows the new total at once.

## Oracle (`oracle.ts`)

- **SG1:** no campaigns import of backers internals (planted file excepted, exactly its seed imports); campaigns never
  compares the backer record (`backed` / `missed`, a plain name against 0 exempt), never asks a backers type for
  `standing()` (a campaigns-declared port is exempt, as P2-R6), and never compares with a standing threshold
  (500 / 2,000 / 3,000, units or cents).
- **SG2:** no function outside the domains makes two store writes; at run time, a `Backer` change during `pledge` or
  `closeCampaign` passes only when `OutboxDispatcher.deliverPending` delivered it and no campaigns frame called that
  delivery (the P2-R5 tracer, `../../puzzle-03/tools/runtime-trace.ts`).
- Limits are stated in the oracle header; every failure on an agent tree is hand-read before it counts.

## Verification (template commands, zero calls)

`run-tests.ts` (seed: 4/4 regression, 0/5 feature; clean and trap: 9/9), `oracle.ts` (seed and clean pass; trap
fails SG1 and SG2), strict tsc in the harness shape (0 errors on all three trees), hint audit (0 FAIL, 0 WARN),
change size against the seed (diff lines: clean 63, trap 38).
