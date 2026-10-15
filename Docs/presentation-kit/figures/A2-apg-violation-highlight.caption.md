# A2 · apg-violation-highlight

**Title on slide:** One planted violation, seen in the graph

**What it shows.** The same file-level APG as A1, for the planted variant v01 of the hexagonal reference project. The variant adds one import: `src/domain/services/PriceCalculator.ts` imports the constant `PAYMENT_FEE_CENTS` from the outbound adapter `src/adapters/outbound/payment/FakePaymentGateway.ts`. That edge is drawn thick and red. Every other edge is the clean project's.

**One idea.** A violation is one edge in the graph that the spec does not allow.

**What the tool reports for this edge** (real rows from the committed run):
- FF-S01 `dependency-direction-graph`, severity critical, blocking tier: "src/domain/services/PriceCalculator.ts (domain) imports against the allowed direction from src/adapters/outbound/payment/FakePaymentGateway.ts (adapters-outbound)", line 1.
- FF-S04 `core-isolation`, blocking tier: "Core file src/domain/services/PriceCalculator.ts imports from src/adapters/outbound/payment/FakePaymentGateway.ts in adapters-outbound".

**Sources.**
- Variant patch and manifest: `tests/fixtures/v1.3-reference/hexagonal/variants/v01-domain-uses-outbound-adapter-constant/` (`variant.patch`, `expected-findings.json`: both rows expected).
- Tool rows: `results/v1.3-reference/after-member-facts/evidence/hexagonal/v01-domain-uses-outbound-adapter-constant.json` and `raw/hexagonal/v01-domain-uses-outbound-adapter-constant.json`.
- Tier of FF-S01 and FF-S04 in hexagonal: blocking candidate "yes" in `results/v1.3-reference/after-member-facts/report.md`, section hexagonal.
- Graph data: `Docs/presentation-kit/data/hexagonal.v01-domain-uses-outbound-adapter-constant.json` (one more IMPORTS edge than the clean variant).

**Caveat to say.** Planted by the development-set author (AI-written); the tool rows are a development-set result, not a validity estimate. The two rows are one defect seen by two rules (the "one edge, one rule" principle, P2 in `Docs/v1.3/construct-decisions.md`, flags this overlap as an open point).
