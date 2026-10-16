# v1.3 ontology v0 ground truth (planted semantic cases)

Six small TypeScript projects with planted **semantic** defects that the cheap proxies (`src/apg-enrich/cheap/`) are
expected to miss, plus near-miss controls. Each case directory holds `expected-semantic.json`, written and committed
before any ontology pipeline code, prompt or run existed (first commit of branch `v1.3-ontology`).

| Case | Planted | Expected finding |
|---|---|---|
| `case-01-rule-dup-shapes` | rule duplication, different shapes (`total >= 50` vs `!(sum < FREE_SHIPPING_MIN_CENTS)`, 5000 cents) | one SemBusinessRule enforced in checkout and invoicing |
| `case-02-misplaced-pricing` | pricing rule inside a notification service, clean structure | SemMISPLACED_IN on `OrderNotificationService.sendConfirmation` (natural layer domain) |
| `case-03-concept-fragmentation` | Client / Buyer / AccountHolder model the customer | one SemBusinessConcept embodied by the three classes |
| `case-04a-control-near-miss-rules` | same shape and constant, different rules | no rule duplication |
| `case-04b-control-clean-notification` | notification service that only formats | no misplaced responsibility |
| `case-04c-control-distinct-concepts` | Order / Invoice / Shipment share field names | no concept fragmentation |

`layers.json` is the layer model used for every case (`src/**/<kind>/**`). Components are the first directory under
`src/`. Scorer: `src/apg-enrich/ontology/scorer.ts`; runner: `scripts/v1.3/ontology-run.ts`.

Added after the manifests (second commit):
- `mock-answers/<case>.json`: hand-written scripted mock answers, **not model output**, with planted hallucinations and
  one planted run disagreement. They exercise the pipeline, the grounding validator, the cache and the scorer.
- `cassettes-mock/<case>/`: the cassettes recorded from those answers
  (`npx tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock`), replayed by the unit tests with no provider call.
- `cassettes-claude-cli/<case>/` (not yet present): the local live run through the judge's Claude CLI route.
