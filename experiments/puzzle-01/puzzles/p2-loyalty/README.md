# P2 `p2-loyalty`: one owner for the tier, points that follow the order (DEV split)

**Families:** D6 / D10 (the tier rule reached across the boundary, or duplicated), D4 across contexts (placing an
order also writes the member). **Instrument visibility:** partial (verified, `../../verification.json`): the D6
route of SG1 is visible (new FF-DS02 findings), the D10 route of SG1 and all of SG2 are invisible.
**Rung 5** (T 2, S 3, Dst 3, Pd 2, Dx 0).

## The seed

Two contexts. `membership` owns `Member` (points; the tier follows from the points: gold from 2,000, silver from
500) and publishes `createMembership()` (`index.ts`) and the `MemberCard` contract, which already carries the tier.
`sales` owns `Order`, reaches membership through a port (`MemberDirectory`) and an ACL that calls the published
module, and stores orders with their events (outbox) delivered by a relay after each command.

**Planted debt (Pd 2, trap-shaped precedent):** `sales/application/ReceiptFooter.ts` reads members through
membership's domain repository. It never counts; copying it does.

## The trap line (`solutions/trap/`)

1. `tier-discount`: copy the precedent: inject membership's `MemberRepository` into `PlaceOrder`, load the `Member`,
   call `tier()`, pick the rate. **D6** (instrument-visible, FF-DS02).
2. `gold-threshold`: change the constant in `Member` (one place, because the trap reached into the owner).
3. `points-on-orders`: in `PlaceOrder`, after saving the order, `member.award(points)` and save the member: one
   command, two aggregates in two contexts. **D4** (invisible: the only finding is the import of step 1).

**Alternative trap (`solutions/trap-alt/`, the instrument-invisible route):** step 1 reads the points through the
ACL and **re-implements** the thresholds in `sales` (`points >= 1500 ? 0.1 : …`; **D10**), step 2 must then change
both copies, step 3 calls `membership.awardPoints` synchronously through the ACL (**D4**). Its instrument view equals
the seed's (only the planted debt).

## The winning line (order matters)

1. **First** extend the sales port with `tierOf(memberId)` and map the published `MemberCard.tier` in the ACL into a
   sales-side `CustomerTier`; the discount rate per tier is a sales rule (`CustomerTier.ts`), the tier is
   membership's. **Then** give `Order` a tier, a subtotal and a discount.
2. Change `GOLD_FROM` in `Member`: one place, and the card and the till agree by construction.
3. **First** add the earning rule to `Member` (`creditPurchase(orderId, paidCents)`, idempotent per order) and a
   `purchaseMade` subscriber to membership's published module; **then** subscribe it to the stored `OrderPlaced`
   event in the composition root. `PlaceOrder` still saves only the order. The relay delivers before the command
   returns, so the card shows the points at once.

## Oracle (`oracle.ts`)

- **SG1:** no sales import of membership internals (planted file excepted, exactly its seed imports); sales never
  compares points and never asks a `Member` for its tier.
- **SG2:** no function outside the domains makes two store writes; sales never calls a membership write.
