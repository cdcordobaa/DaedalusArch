# HCAL-08 builder brief

HCAL-08 is a held-back calibration set for one blind admission of the Hexagonal shapes added in instrument v1.5.8 to
v1.5.10. It is written in construct terms (what a case does to a Hexagonal project), not in rule terms. One blind
session builds and seals it. That session does not score it and makes no model calls. Same procedure as HCAL-06 and
HCAL-07: a clean base per domain, cases as overlays on it, labels per domain, a per-case glossary key kept out of the
scoring copy, and a SHA-256 seal committed before any scoring.

Written 2026-11-03 (UTC), before any case was built.

## What the builder read

The HCAL-07 admission report (`Docs/DiagnosticRuns/v15-hcal07-admission-2026-10-30.md`) for the order of events, the
label-leak step and the bar. HCAL-06 (`experiments/hcal-06/`: brief, README, seal files, one domain's base, cases and
labels) for the case format. The builder did not read the instrument sources, the rule files, the hub, any scorer, any
rule development folder, the instrument changelog or the rule messages, and did not open HCAL-07's folder. No checker
is run on any tree.

## Domains

Three domains and vendors that no earlier set, trap family or document names (checked by name over `experiments/` and
`Docs/`): `glacier-guiding` (vendor `icetrail-sdk`), `orchard-cooperative` (vendor `pressmark-sdk`) and
`luthier-workshop` (vendor `bowcraft-sdk`). Layout as in HCAL-06: an in-tree vendor SDK stand-in under
`base/vendor/<name>-sdk/` (typings, a small JS body, `package.json`), resolved by its bare name through tsconfig
`paths`. Each base has domain, application (use cases, inbound ports, outbound ports), inbound adapters (HTTP and a
vendor webhook), outbound adapters (vendor gateway, persistence, notification) and a composition root `src/main.ts`. In
the base the vendor adapters translate every vendor code and field name into the domain's own terms.

## Rows

Row keys are this set's own (`HX8-…`). They are not rule ids. The scoring session maps each key to the instrument's
rules before the seal is opened, as HCAL-06 did for H11-SEM.

| Row | A positive does this |
|---|---|
| HX8-WORD | one vendor-owned single word (a vendor field name or a vendor value word) appears in a core-owned type or value |
| HX8-SET | the core declares a copy of a vendor value set (a union, an enum or a const array of the vendor's values) and casts vendor text that a port carries to it; no adapter maps it |
| HX8-KEY | the core holds an untyped lookup keyed by the vendor's values (object literal, `Record`, `Map`, `switch` or an `===` chain) and consults it with vendor text that a port carries |
| HX8-EDGE | a core file reaches an adapter or the vendor SDK through an import form a reader may miss. Sub-cases: **a** a re-export or barrel; **b** a dynamic `import()`; **c** an inline type import (`import('…').X` in a type position) or `import x = require()`; **d** `export *` from a published file; **e** a vendor-coupled adapter file that sits outside the folders the spec names for adapters (the layer comes from the spec, not from the folder name) |

Core means the spec's domain and application layers (ports included).

Clean cases must not be flagged. Each row has at least two hard twins:

- **HX8-WORD:** the same single word used as a genuine domain term that the spec glossary names as ours; a generic word
  that both sides use.
- **HX8-SET:** a core set of our own words, mapped from the vendor's set in the adapter; a core set that shares fewer
  than half of the vendor's values by coincidence.
- **HX8-KEY:** a lookup keyed by our own domain words; the same vendor-keyed lookup placed in the adapter; a lookup
  whose keys the spec glossary declares as ours.
- **HX8-EDGE:** the same import shapes (barrel, dynamic `import()`, inline type import, `import = require()`,
  `export *`) used between layers the spec allows; an adapter in a folder not named `adapters` that the spec declares
  as an adapter layer.

## Counts asked for

About 50 to 70 cases over the three domains, roughly half positive, at least two hard twins per row. Every base and
every case overlaid on a copy of its base passes `tsc` strict with the options of the earlier sets. The earlier HCAL
format has no behaviour test, so none is added.

## Bar and reporting

A row is admitted when every positive in it is caught (a finding of a rule mapped to the row in the labelled file) and
no clean case in it is flagged by a rule mapped to the row. Results are reported per row (recall, false positives on
clean cases, bar met), with HX8-EDGE also reported per sub-case, and the hard twins listed one by one. A row that misses
the bar is reported as such; no rule, prompt or label changes after the results are seen.

## Order of events

1. This brief, committed before any case.
2. Bases, cases, `labels.json` per domain (ground truth and a one-line rationale per case). Each case `spec.yaml` ends
   with the builder's glossary key, a comment block that names the vendor terms, the core terms and the rationale.
3. Seal: `SEAL.sha256` over every case file, its root in `SEAL.root` and below, `verify-seal.sh`. A scoring copy
   without the glossary keys (`scoring-copy.sh`), pinned by `SCORING-COPY.sha256`. The rule hash is left as a stub for
   the scoring session. Committed before anyone scores.
4. An entry in `aidlc-docs/audit.md`.
5. Merged to `main` through a PR on green CI. Scoring is a later, separate session.

## Seal

Filled in at step 3.
