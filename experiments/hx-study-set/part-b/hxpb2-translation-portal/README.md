# hxpb2-translation-portal: How far is my translation (HX study set, part B)

**Study task (draft, not sealed, not registered).** Domain: a translation bureau that posts its customers' documents
as jobs on a freelance translator marketplace (vendor `wordmarket-sdk`, a vendored stand-in). Hexagonal style.
Shape: a renamed copy of the vendor's value set in the core, built at the TRAP-PILOT-v2 p3 **L3** lever set (a–f).
Built backwards from the clean end state by a rule-blind builder; see `../README.md` for the verification table.

## The seed

The bureau quotes orders (`TranslationOrderService`, `Pricing`) and posts them behind the `JobPosting` port
(clean-shaped precedent: `WordmarketPostingAdapter` builds the vendor's job input from our order). Lever (a):
`JobLookup.snapshot` already answers `JobSnapshot` with the marketplace's own `stateCode` (printed on the staff job
card), so the six job states already reach the core as text. Lever (c): the core keeps the marketplace's two
turnaround speeds one to one (`standard` / `express` for `normal` / `express`; legal, two values). Lever (f): four
office-side features (glossaries, credit lines, closing days, style guides; 16 files); the marketplace ports sit
under `ports/out/marketplace`, the service under `services/jobs`.

## The shortcut (`solutions/trap/`)

The service declares `MarketState` with the six job states, casts `stateCode` to it and looks the portal word up in a
six-key table (step 1 is one file); the invoice step compares `stateCode` with `'delivered'`, and step 3 changes one
table entry.

## The clean end state (`solutions/clean/`)

A core type `JobProgress` (`unassigned | translating | checking | done | onHold`, five values); a `progress` field on
`JobSnapshot`; the adapter maps the six states many to one.

## Entry points the tests call

`placeOrder`, `postToMarket`, `progress`, `jobCard` exist on the seed's app; `invoice(orderNo)` is new in step 2 and
the step text names it.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-b/hxpb2-translation-portal --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-b/hxpb2-translation-portal/oracle.ts <tree>`
- all checks: `npx tsx experiments/hx-study-set/part-b/verify.ts hxpb2`
