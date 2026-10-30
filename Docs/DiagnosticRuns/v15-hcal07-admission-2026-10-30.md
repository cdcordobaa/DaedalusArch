# v1.5 HCAL-07: admission of Hexagonal rows H11 (a–d), H11-SEM, H03 and H07

Date: 2026-10-30 UTC (evening of 2026-10-29 local). The set was scored once, at `main` `87682d49c` (instrument
`v1.5.5-hx-rules-v3`), against the bar in the HCAL-07 brief. A row meets the bar when every positive in it is caught
and no clean case is flagged. There were 6 model calls, all to R-MIRROR-SEM's judge (`claude-opus-5-5`, Claude CLI
route): 1 for the base check and 5 for the cases. Each call is one line of the committed ledger.

## Order of events (from the commits)

| Step | Commit |
|---|---|
| Set built by one blind session (3 new domains, 50 cases, 25 positive), brief `experiments/hcal-07/BRIEF.md`; case seal `5e664c7f…` (266 files); rule hash left as a stub | `ef033c216` (PR 445, merged `d452ca0aa`) |
| HX-RULES-V3 (instrument `v1.5.5`), developed without the set; touches no file of the set; merged before the set | PR 446, merged `e10b8916f` |
| Seal verified (all 266 files, root matches) | `22cad1ea9` |
| Label-leak check; scoring copy without the glossary key (`SCORING-COPY.sha256`, root `70a17650…`) | `6ffb237dd` |
| Reporting row in the admission scorer (`perReportRow`); ledgers kept by `.gitignore` | `3aef6d510` |
| `RULES-FROZEN.sha256` (`098d67bd…`, 45 files, HCAL-06's selection rule) | `482484ebd` |
| Preparation PR merged on Build & Test green (Architectural Firewall is a known failure) | PR 447, merged `87682d49c` |
| Case seal, rule hash and scoring copy verified at `87682d49c`; base check, before any case | `e22e5682a` |
| Scoring of the 50 cases | `27749ae49`; this report |

## Label-leak check (before scoring)

Each case's `spec.yaml` ends with the builder's glossary key, a YAML comment that lists the vendor terms, the core terms
and the rationale. Where the spec goes in the instrument:

- **R-MIRROR-SEM judge (the only model in the run).** `domainTextOf` (`src/v15-instrument/mirror-sem.ts`) parses the
  spec with `YAML.parse` and re-serialises it. Comments are dropped, so the key does not reach the prompt.
- **Frozen check and scorer.** The frozen spec is rebuilt from `YAML.parse`, and the scorer reads `labels.json` only
  to score. Nothing leaks here.
- **R-MIRROR2's stoplist: the key leaks.** `specTokens` (`src/v15-instrument/vendor-lexicon.ts`) splits the raw spec
  text into tokens, comments included. A vendor term found among them counts as spec-owned and the rule skips it. Left
  in place, the key would have silenced R-MIRROR2 on the very terms each case plants.
- No other rule reads the glossary or the comments. The case sources contain no label words.

So the set was scored from a scoring copy, `experiments/hcal-07/scoring-copy.ts`. The copy removes only the trailing
key block of each case spec: the header line, every line after it (all comments), and the empty lines before it. The
result is pinned by `SCORING-COPY.sha256` (root `70a17650d51d5b45`, script sha256 `104364a29f490690…`). After the strip,
44 case specs are byte-identical to their base spec. The other 6 add glossary terms, as the set's README says.

Command: `npx tsx experiments/cal-01/score.ts --dir <scoring copy> --rows hex --judge live --ledger
experiments/hcal-07/results/mirror-sem-calls.jsonl --out experiments/hcal-07/result.json`. Record:
`experiments/hcal-07/result.json`.

## Base check (before any case)

All three bases are clean (`results/bases.json`), so no domain needed a different baseline. As usual, each case was
scored with its domain's base as the baseline. The judge was asked one base candidate, nursery `DeliveryOutcome`
against the vendor's `ConsignmentStatus`, and answered `no`: the glossary owns that term, and it is coarser than the
vendor's set. When the scoring run scored the bases again, it read that answer from the disk cache.

## Result

Recall counts positives whose labelled file holds a finding of a rule mapped to the row. H11-a to H11-d all score
against H11's rules (R-MIRROR, R-MIRROR2, R-MIRROR-SEM), H11-SEM against R-MIRROR-SEM, H03 against R-AXA and the frozen
rules, and H07 against R-TRANSPORT and the frozen rules.

| Row | Recall | FP on clean | Bar met |
|---|---|---|---|
| H11-a: vendor literal codes (regression) | 2/2 | 0/2 | yes |
| H11-b: vendor error vocabulary | 6/6 | 0/4 | yes |
| H11-c: field renamed to a vendor field (regression) | 2/2 | 0/2 | yes |
| H11-d: vendor field names in the core | 4/6 | 0/4 | no |
| H11 overall (a–d) | 14/16 | 0/12 | no |
| H11-SEM: renamed one-to-one vendor value set | 2/2 | 0/3 | yes |
| H03: adapter imports adapter | 4/4 | 0/6 | yes |
| H07: transport detail in the core | 3/3 | 0/4 | yes |

H11-b by variant: both class-name copies (`FurPayDecline`, `SchedulingConflict`), both object-literal key tables and
both literal comparisons were caught. H11-d by variant: both declared-field cases were caught. Of the string list
cases, the kennel tuple was caught and the nursery `string[]` was missed. Of the mapping tables, the locksmith table
(vendor names as keys) was caught and the nursery table (vendor names as values) was missed.

H03 positives found: out→out (kennel pos1), out→out with a second adapter of the same port (locksmith pos1), in→out
(nursery pos1, webhook handler) and driving→driving (locksmith pos2). H07 positives found: status numbers on domain
errors (kennel), status numbers as a use case result (nursery), and the HTTP library import in a use case (locksmith).

All 25 clean cases are clean on their row, including the three shared-helper twins (kennel `H03-twin1` and nursery
`H03-twin2`, driven side; nursery `H03-twin1`, driving side) and the nursery `statusCode` legit case (`H07-legit1`).

Two hits fall on a different line of the labelled file than the label gives. Neither changes a result, because the
scorer matches on the file. In locksmith `H07-pos1`, R-TRANSPORT fires on line 18, the `throw new HttpError(409, …)`,
not on line 1, the import. In locksmith `H11-pos4`, R-MIRROR fires on line 9, the declaration, not on line 10, the
first key.

### Hard twins

| Row | Case | Result |
|---|---|---|
| H11-b | kennel-boarding H11-twin1 (decline-code table moved into the adapter) | clean |
| H11-b | locksmith-dispatch H11-twin1 (core error with a core name) | clean |
| H11-c | kennel-boarding H11-twin3 (`deposit_ref`, snake_case core term) | clean |
| H11-c | locksmith-dispatch H11-twin4 | clean |
| H11-d | kennel-boarding H11-twin2 (tuple of snake_case core terms) | clean |
| H11-d | greenhouse-nursery H11-twin2 (`FREIGHT_FIELDS` table in the adapter) | clean |
| H03 | greenhouse-nursery H03-twin1 (driving side `adapters/in/shared`) | clean |
| H03 | locksmith-dispatch H03-twin1 (fallback taken as the port, wired in `main.ts`) | clean |
| H07 | kennel-boarding H07-twin1 (business codes on domain errors, status table in the controller) | clean |

All 9 hard twins are clean.

### Misses (read after scoring)

- **greenhouse-nursery H11-pos3 (d, `string[]` column list), missed.** `MANIFEST_COLUMNS: string[] =
  ['consignment_no', 'consignee_postcode', 'pallet_count', 'gross_weight_kg']` (`src/domain/manifest.ts:4`). R-MIRROR2
  reads the array (its v1.5.5 `field-list` shape). That shape fires only when all the list's non-id elements are fields
  of *one* vendor declaration. Here three names come from `ConsignmentRequest` and `consignment_no` comes from
  `ConsignmentResponse`, so neither declaration covers the list. The kennel tuple that was caught takes all four names
  from one declaration (`ChargeResponse`). No other shape reads a vendor field name held as a string value. The literal
  shape matches vendor codes and declaration names, not field names.
- **greenhouse-nursery H11-pos4 (d, table valued with vendor field names), missed.** `FREIGHT_FIELDS = { postcode:
  'consignee_postcode', pallets: 'pallet_count', … } as const` (`src/application/freight-fields.ts:2`). The keys are
  core names. The vendor field names are string values of an object literal. Since v1.5.5 R-MIRROR2 reads object
  *keys*, and the `field-list` shape reads array and tuple elements. Neither reads object *values*, and the literal
  shape does not match field names. The locksmith table that was caught has the vendor names as keys.

There are no false positives on any row. No rule, prompt or label was changed after the results were seen.

### Other findings in the record (rows not under admission here)

- **R-D5 (K08/K09, DDD, exploratory)** fires in locksmith `H07-pos1` (`src/application/dispatch-call-out.use-case.ts:18`)
  and `H07-twin1` (line 17). Both cases add an already-dispatched check (`callOut.currentStatus !== 'REQUESTED'`) to the
  use case, and R-D5 reads that check as a rule outside the aggregate. It counts in no HCAL-07 row.

## Model calls

| | Asked | From disk cache | Real calls | Answers |
|---|---|---|---|---|
| Base check | 1 | 0 | 1 | 1 no (nursery `DeliveryOutcome`) |
| Cases | 6 | 1 (the base candidate, when the bases were scored again) | 5 | 2 yes (the 2 H11-SEM positives), 3 no |

The three `no` answers are for nursery `H11-SEM-twin1` and `H11-twin3` (both `DeliveryOutcome`, glossary-owned and
coarser) and locksmith `H11-twin3` (`VisitProgress`, glossary-owned, 4 values against 6). Kennel `H11-SEM-legit1` and
locksmith `H11-SEM-twin1` produced no candidate. All 6 calls were first attempts, returned a valid answer, and recorded
the model `claude-opus-5-5`. There were no retries, errors or misses. Ledgers:
`experiments/hcal-07/results/bases-mirror-sem-calls.jsonl` and `experiments/hcal-07/results/mirror-sem-calls.jsonl`.
The `*.judged.jsonl` files beside them record each judged candidate, where the answer came from, the answer and the
model's reason.

## Labels to look at (reported, not changed)

The builder flagged these four before the seal. For each, the rule agreed with the label.

- **locksmith-dispatch H03-pos1 / H03-twin1.** The label reads "more than one outbound adapter per port" as two
  adapters of one port coupled to each other. R-AXA flags pos1 because the CrewClock gateway imports
  `../rota/on-call-rota.scheduling`, an out→out import. It does not flag twin1, where the fallback comes in as
  `TechnicianSchedulingPort`. The rule sees the import, not the port. Pos1 is caught as an ordinary out→out import, so
  this pair does not test the same-port reading on its own. Under the other reading (two adapters of one port are
  fine), pos1 would still be an adapter importing an adapter.
- **locksmith-dispatch H11-pos1 (`SchedulingConflict`).** Caught by R-MIRROR2's declaration-name shape, because the
  vendor exports `class SchedulingConflict extends Error`. The name is two plain English words. A domain that coined
  it independently would be flagged the same way. The label rests on the copy from the vendor, and the evidence is the
  name alone.
- **kennel-boarding H11-twin2 / H11-twin3 (snake_case core terms).** Both are clean. R-MIRROR2 needs the vendor's exact
  spelling, and `deposit_ref`, `amount_held`, `refusal_reason` and `held_at` are not vendor fields. They are clean by
  the glossary, but the casing looks like a vendor's.
- **greenhouse-nursery H11-pos1 (labelled b).** Caught by R-MIRROR2's object-key reading (`src/domain/freight.ts:10–13`,
  the `RJ_…` keys of `RETRY_NEXT_DAY`). The table is vendor vocabulary in the core and also a retry policy. Sub-shape b
  fits, but the case would also pass as a business-rule case.

Not flagged by the builder, found on reading:

- **locksmith-dispatch H07-pos1, `line: 1`.** The label points at the `http-kit` import. The rule reports the
  `HttpError(409, …)` throw on line 18. Both lines are evidence of the same violation.
- **locksmith-dispatch H11-pos4, `line: 10`.** The rule reports the declaration on line 9. The label gives the first
  key on line 10.

## Standing

- **H11-a, H11-b, H11-c:** bar met (2/2, 6/6 and 2/2, all with 0 FP).
- **H11-d:** bar not met (4/6, 0/4). That puts H11 overall at 14/16, also not met.
- **H11-SEM:** bar met (2/2, 0/3). The row has 2 positives.
- **H03:** bar met (4/4, 0/6), including both shared-helper sides.
- **H07:** bar met (3/3, 0/4).

`ADMITTED_HEX_ROWS` is unchanged. Admission decisions are left to the author.
