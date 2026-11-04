# HCAL-09 builder brief

HCAL-09 is a fresh held-back calibration set. It covers the four HCAL-08 rows again on new material, and three rows
whose rules were changed after an earlier seal and were never admitted again: vendor field names in the core (catalog
H11-d), a business rule inside an adapter (catalog H06) and a declared set invariant checked outside its owner
(catalog K10, the DDD row of R-D5S). It is written in construct terms (what a case does to a project), not in rule
terms. One blind session builds and seals it. That session does not score it and makes no model calls. Same procedure
as HCAL-08: a clean base per domain, cases as overlays on it, labels per domain, a per-case glossary key kept out of
the scoring copy, and a SHA-256 seal committed before any scoring.

Written 2026-11-04 (UTC), before any case was built.

## What the builder read

HCAL-08 (`experiments/hcal-08/`: brief, README, scripts, seal files, one domain's base, a few of its cases and labels)
for the procedure and the case format. The HCAL-08 admission report
(`Docs/DiagnosticRuns/v15-hcal08-admission-2026-11-03.md`) only for its row definitions and the bar. The catalog row
text: `Docs/v1.5/ddd-detection-paths.md` (rows K10 and H06), `Docs/v1.5/hexagonal-study-preregistration.md` (rows H06
and H11-d), the HCAL-07 admission report's result section (H11-d variants) and the CAL-03 brief and one CAL-03 base
spec (`experiments/cal-03/drones/base/spec.yaml`) for the K10 row text and the `ddd` spec block format. The header of
`experiments/cal-01/score.ts` up to `HCAL08_ROW_RULES`. The builder did not read the instrument sources, the rule
files, the hub, the scorer body, any rule development folder (`experiments/*-dev/`), any test, the instrument changelog
or the rule messages, and did not open HCAL-07's cases, the sealed hold-outs or the MEAN-01 sample. No checker is run
on any tree.

## Domains

Four domains and vendors that no earlier set names (checked by name over `experiments/` and `Docs/`):

| Domain | Style | Vendor SDK |
|---|---|---|
| `harbor-pilotage` | hexagonal | `tidewatch-sdk` (vessel traffic and tide service) |
| `bell-foundry` | hexagonal | `ingotline-sdk` (bronze alloy supplier) |
| `apiary-pollination` | hexagonal | `hivepulse-sdk` (hive telemetry service) |
| `stone-quarry` | DDD (three bounded contexts) | `tarescale-sdk` (truck scale service) |

Layout as in HCAL-08, with two changes toward a realistic project: the vendor SDK is a local workspace package under
`base/packages/<name>-sdk/` (typings, a small JS body, `package.json`; the base `package.json` lists `packages/*` as
workspaces), resolved by its bare name through tsconfig `paths`; and each base carries a few noise files (a README, a
`package.json`, small helpers). Where natural, a base uses a tsconfig path alias for its own folders. Each hexagonal
base has domain, application (use cases, inbound ports, outbound ports), inbound adapters (HTTP and a vendor webhook or
feed), outbound adapters (vendor gateway, persistence, notification) and a composition root `src/main.ts`. In the base
the vendor adapters translate every vendor code and field name into the domain's own terms, and every business rule
sits in the domain. The DDD base follows the CAL-03 format: contexts with domain, application, infrastructure, api and
contracts folders, declared aggregates and `ddd.invariants` (set, single and uniqueness), a shared kernel and a
composition root.

## Rows

Row keys are this set's own (`HX9-…`, `DX9-…`). They are not rule ids. The scoring session maps each key to the
instrument's rules before the seal is opened, as HCAL-08 did.

The four HCAL-08 rows, with their definitions copied unchanged:

| Row | A positive does this |
|---|---|
| HX9-WORD | one vendor-owned single word (a vendor field name or a vendor value word) appears in a core-owned type or value |
| HX9-SET | the core declares a copy of a vendor value set (a union, an enum or a const array of the vendor's values) and casts vendor text that a port carries to it; no adapter maps it |
| HX9-KEY | the core holds an untyped lookup keyed by the vendor's values (object literal, `Record`, `Map`, `switch` or an `===` chain) and consults it with vendor text that a port carries |
| HX9-EDGE | a core file reaches an adapter or the vendor SDK through an import form a reader may miss. Sub-cases: **a** a re-export or barrel; **b** a dynamic `import()`; **c** an inline type import (`import('…').X` in a type position) or `import x = require()`; **d** `export *` from a published file; **e** a vendor-coupled adapter file that sits outside the folders the spec names for adapters (the layer comes from the spec, not from the folder name) |

The three rows not admitted since their post-seal changes, with the catalog's row text:

| Row | Catalog row | A positive does this |
|---|---|---|
| HX9-FIELD | H11-d, vendor field names in the core | the core uses the vendor's own field names (multi-word names as the vendor spells them, for example `berth_window_ref`): as a declared field of a core type, as the entries of a core string list or tuple, or as the keys or the values of a core mapping table |
| HX9-RULE | H06, business rules in an adapter | an inbound or outbound adapter decides a business rule that the domain owns (an eligibility, a threshold, a fee or price calculation, or a state decision), and the core does not hold it |
| DX9-SET | K10, a declared `set` invariant checked outside the aggregate the spec names as its owner | the check of a `kind: set` invariant from `ddd.invariants` sits in an application service, a controller, another aggregate or a repository instead of the owner aggregate |

Core means the spec's domain and application layers (ports included). HX9-FIELD differs from HX9-WORD's field
sub-case in that its names are the vendor's compound field names, not single words.

Clean cases must not be flagged. Each row has at least two hard twins:

- **HX9-WORD:** the same single word used as a genuine domain term that the spec glossary names as ours; a generic word
  that both sides use.
- **HX9-SET:** a core set of our own words, mapped from the vendor's set in the adapter; a core set that shares fewer
  than half of the vendor's values by coincidence.
- **HX9-KEY:** a lookup keyed by our own domain words; the same vendor-keyed lookup placed in the adapter; a lookup
  whose keys the spec glossary declares as ours.
- **HX9-EDGE:** the same import shapes (barrel, dynamic `import()`, inline type import, `import = require()`,
  `export *`) used between layers the spec allows; an adapter in a folder not named `adapters` that the spec declares
  as an adapter layer.
- **HX9-FIELD:** compound snake_case core field names that the spec glossary declares as ours; the same vendor field
  table placed in the adapter; a core field naming the same concept in the domain's own words.
- **HX9-RULE:** an adapter doing technical work only (format conversion, retries, paging, a vendor rate limit, a
  transport shape check); the same feature with the rule in the domain and the adapter passing data to it.
- **DX9-SET:** the same check inside the owner aggregate, with the service handing the set to the owner's method; a
  service check of a rule that is not a declared invariant; a `uniqueness` invariant left to the store; a `single`
  invariant checked inside its own aggregate.

## Counts asked for

About 90 to 100 cases over the four domains, half positive, every clean case a hard twin. Planned per row (positives /
clean): HX9-WORD 6/6 (field 3, value 3), HX9-SET 6/6, HX9-KEY 6/7, HX9-EDGE 11/10 (positives a 2, b 2, c 3, d 2, e 2;
clean a 2, b 2, c 3, d 1, e 2), all on the three hexagonal domains, as in HCAL-08; HX9-FIELD 6/6 and HX9-RULE 6/6 on
the three hexagonal domains; DX9-SET 6/6 on `stone-quarry`, over two declared set invariants with different owners.
Every base and every case overlaid on a copy of its base passes `tsc` strict with the options of the earlier sets. The
earlier HCAL format has no behaviour test, so none is added.

## Bar and reporting

Copied from HCAL-08 unchanged. A row is admitted when every positive in it is caught (a finding of a rule mapped to the
row in the labelled file) and no clean case in it is flagged by a rule mapped to the row. Results are reported per row
(recall, false positives on clean cases, bar met), with HX9-EDGE also reported per sub-case, and the hard twins listed
one by one. A row that misses the bar is reported as such; no rule, prompt or label changes after the results are seen.

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

Filled in at step 3, before any scoring.
