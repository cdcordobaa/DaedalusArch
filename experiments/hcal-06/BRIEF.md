# HCAL-06 builder brief

HCAL-06 is a blind admission set for the Hexagonal rows that changed or are new in the week of 2026-10-26: H11
(revised, with four sub-shapes), H11-SEM (new) and H03 (R-AXA, with a new driving-to-driving shape). One blind session
built all three domains. That session had not seen the rules, the vendor lexicon, the fact extractor, the rule
messages, any Cypher or the rule development folders. Same procedure as HCAL-03 to HCAL-05: a clean base per domain,
cases as overlays on it, labels per domain, and a SHA-256 seal committed before any scoring.

## What the builder read

The earlier HCAL briefs, admission reports and seals (HCAL-02 to HCAL-05) for the procedure. `experiments/cal-01/score.ts`
for the label format the scorer reads. The row keys (not the rule ids) of the Hexagonal row map. The spec schema, to
check that a top-level `glossary` key is accepted. `experiments/hcal-05/dental-lab/base/spec.yaml` as the spec template.
The file names (not the contents) in HCAL-05's frozen-rules manifest, to apply the same freeze selection. No checker
was run on any tree.

## Domains

Three domains that no HCAL set or trap family has used: `customs-brokerage` (vendor `clearwise-sdk`),
`pharmacy-refills` (vendor `rxclaim-sdk`) and `print-shop` (vendor `printhub-sdk`). Layout as in HCAL-05: an in-tree
fake vendor SDK under `base/vendor/<name>-sdk/`, resolved through tsconfig `paths` by its bare name. Each base has an
inbound HTTP adapter. Customs also has a CLI adapter and the print shop a webhook adapter. Each base has at least three
outbound adapter packages, and the vendor adapter translates the vendor's codes and field names into the domain's own
terms.

Each base `spec.yaml` ends with a `glossary` that lists the terms the domain owns. A case whose cleanness rests on a
domain-owned term ships an updated `spec.yaml` that adds the term, as a real change would.

## Rows (rule kept in the base; a positive breaks it)

| Row | A positive does this |
|---|---|
| H11 | core code (domain, application, ports) speaks the vendor's vocabulary without importing the SDK. Sub-shapes: **a** vendor literal codes compared or stored in core logic; **b** vendor error codes or error names carried into core errors; **c** vendor field names copied onto core types; **d** a set of vendor field names copied as a group |
| H11-SEM | the core holds a renamed one-to-one copy of a vendor value set (three or more values) and branches on it |
| H03 | an adapter imports another adapter package: inbound to outbound, outbound to outbound, or a driving adapter importing a sibling driving adapter that is not a shared helper |

Clean cases must not be flagged. They include the hard twins of each row:

- **H11:** domain-owned vocabulary that shares a word with the vendor and is declared in the spec glossary (a status
  DELIVERED, a field days supply). Adapters that translate vendor codes at the boundary with lookup tables.
- **H11-SEM:** a coarser core set mapped from a finer vendor set. A fine-grained core set that the spec documents as
  domain-owned, mapped one to one.
- **H03:** a driving adapter importing its own side's shared helper (`adapters/in/shared/`).

## Counts asked for

H11: 16 positives (4 per sub-shape) over at least 3 domains. H11-SEM: 4 positives. H03: 4 positives, one of them
driving to driving. At least 6 clean cases per row.
