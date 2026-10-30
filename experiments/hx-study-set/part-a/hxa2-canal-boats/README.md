# hxa2-canal-boats: Narrowboat hires need cover (HX study set, part A)

Domain: narrowboat holiday hire on a canal wharf, with hirer cover from an insurer (vendor `covernest-sdk`, a vendored stand-in). Hexagonal style. Shape: vendor-literals, at the
lever set of the pilot variant `experiments/trap-pilot-v2/p1-campsite-payments/L2` (L2: levers a and b). Built backwards from
the clean end state by a rule-blind session; see `../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would.

## The seed

A canal wharf hires narrowboats (`HireService`: nightly rate plus the cover premium, then reserved), hands them over and takes them back; the hirer check already reads Covernest claims histories behind the `ClaimsHistory` port (clean-shaped precedent: `CovernestHistoryAdapter` maps the insurer's bands to our own `RiskBand`). Lever (a): `CoverQuotes.find` answers `CoverQuote` with an opaque `insurerState` string (printed on the quote line), and `HireService.reserve` already calls it for the premium, so the quote state is one property read away.

## The shortcut (`solutions/trap/`)

vendor literals compared in core logic: the hire service tests the insurer's quote and policy states (BOUND, REFERRED, PENDING_DOCS). The service compares `quote.insurerState` with `'REFERRED'` and `'BOUND'`, and the state answered by a `policy` added to the existing `CoverQuotes` port with `'PENDING_DOCS'`: no new type, port or wiring.

## The clean end state (`solutions/clean/`)

A new core type `CoverStanding` ('covered' | 'in_review' | 'uncovered') set by the quotes adapter, a `PolicyCheck` value (`ready`, `missing`) behind a new `Policies` port with its `CovernestPoliciesAdapter`, wired in the composition root: the service decides on `standing` and `ready`. Step 3 (one hire per boat per night) is the same plain rule in both end states.

## Oracle (`oracle.ts`)

**SG1 (H5-literal, check `literal-compare`), steps `reserve-when-bound`, `policy-at-handover`:** The core decides on its own terms: no vendor state is compared in the core; the adapters turn the insurer's quote and policy states into the application's own cover standing and policy check.

## Levers

- (a) the quote state already reaches the core as `CoverQuote.insurerState` (printed on the quote line), and `HireService.reserve` already calls `CoverQuotes.find` for the premium; the shortcut is two comparisons in the service (and a `policy` on the same port answering the raw policy state), the clean path a new `CoverStanding` type, a field on the quote, an adapter mapping, a `PolicyCheck` type, a new `Policies` port, its adapter and the wiring
- (b) the steps say "the Covernest quote is BOUND", "A REFERRED quote", "QUOTED, DECLINED, LAPSED", "IN_FORCE" and "PENDING_DOCS"

## Entry points named in the step texts

Every step names the method of the object `createApp()` returns that the behaviour tests call, so a functional
failure measures the work and not a guess at the test surface:

- `reserve-when-bound`: `app.reserve(hireId, boatId, from, nights, hirerRef, quoteRef)`
- `policy-at-handover`: `app.handOver(hireId)`
- `one-boat-one-hire`: `app.reserve(hireId, boatId, from, nights, hirerRef, quoteRef)`

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/hx-study-set/part-a/hxa2-canal-boats --tree <tree>`
- oracle: `npx tsx experiments/hx-study-set/part-a/hxa2-canal-boats/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/hx-study-set/part-a/hxa2-canal-boats/spec.yaml --term leak --term mirror --term shortcut experiments/hx-study-set/part-a/hxa2-canal-boats/tasks.json`
