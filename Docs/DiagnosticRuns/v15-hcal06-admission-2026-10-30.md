# v1.5 HCAL-06: admission of Hexagonal rows H11 (revised), H11-SEM and H03

Date: 2026-10-30 UTC (evening of 2026-10-29 local). Scored once at `main` `dfb96bde1`, against the bar in the HCAL-06
brief: 4/4 recall for every positive group and 0 false positives on the clean cases. There were 10 model calls, all to
R-MIRROR-SEM's judge (`claude-opus-5-5`, Claude CLI route): 2 for the base check and 8 for the cases. Each call is one
line of the committed ledger.

## Order of events (from the commits)

| Step | Commit |
|---|---|
| Set built by one blind session (3 domains, 44 cases), brief `experiments/hcal-06/BRIEF.md` | — |
| Seal: SHA-256 of 195 case files (`70f9d0ca…`), frozen rule sources and scorer at `4d6b74ef7` (`450f77cd…`) | `407c4f283` (PR 439) |
| R-MIRROR-SEM (instrument `v1.5.4-mirror-sem`) changes 7 frozen files and adds 2, before any scoring | PR 440, merged `7a1856d9d` |
| Re-freeze note; row key `H11-SEM`; opt-in live judge in the admission scorer; hub description; `RULES-FROZEN-2.sha256` (`1e52572e…`, 45 files, same selection rule) | PR 442, merged `dfb96bde1` |
| Both hashes verified at `dfb96bde1`; base check, before any case | `5d684a5b8` |
| Scoring of the 44 cases | this report |

The re-freeze is disclosed in `experiments/hcal-06/README.md`. The set had been on `main` since PR 439. Rule builders
were instructed not to open it, and the R-MIRROR-SEM builder's instructions forbade it. PR 440 touches no file of the
set.

Command: `npx tsx experiments/cal-01/score.ts --dir experiments/hcal-06 --rows hex --judge live --ledger
experiments/hcal-06/results/mirror-sem-calls.jsonl`. Record: `experiments/hcal-06/result.json`.

## Base check (before any case)

All three bases are clean (`results/bases.json`), so there is no base finding to record. The judge was asked about two
base candidates: customs `FilingOutcome` against vendor `EntryStatus`, and pharmacy `CoverageVerdict` against vendor
`ClaimStatus`. It answered `no` to both (domain-owned and coarser, as the glossaries say). When the scoring run scored the
bases again, it read these two answers from the disk cache. Sets the seed declares are not asked again in the cases.

## Result

| Row | Recall | FP on clean | Bar met |
|---|---|---|---|
| H11 overall (R-MIRROR, R-MIRROR2, R-MIRROR-SEM) | 13/16 | 0/8 | no |
| H11 a: vendor literal codes compared or stored | 4/4 | | yes |
| H11 b: vendor error codes or names in core errors | 2/4 | | no |
| H11 c: vendor field names on core types | 4/4 | | yes |
| H11 d: vendor field names copied as a group | 3/4 | | no |
| H11-SEM: renamed one-to-one vendor value set (R-MIRROR-SEM) | 4/4 | 0/6 | yes |
| H03: adapter imports adapter (R-AXA and the frozen rules) | 4/4 | 1/6 | no |

H03 positives found: in→out (customs pos2), driving→driving (customs pos1), and out→out twice (pharmacy pos1, print
pos1).

### Hard twins

| Row | Case | Result |
|---|---|---|
| H11 | customs-brokerage H11-legit1 (vendor codes only as lookup tables in the adapter) | clean |
| H11 | pharmacy-refills H11-legit1 (reject and fault codes only as adapter tables) | clean |
| H11 | pharmacy-refills H11-twin3 (`daysSupply`, glossary term the vendor also uses) | clean |
| H11 | print-shop H11-twin2 (`DELIVERED`, glossary status the vendor also uses) | clean |
| H11-SEM | customs-brokerage H11-SEM-twin1 (six vendor queues folded into three) | clean (judge: no) |
| H11-SEM | customs-brokerage H11-SEM-twin2 (one-to-one, glossary-owned dispositions) | clean (judge: no) |
| H11-SEM | print-shop H11-SEM-twin1 (eight vendor statuses folded into three) | clean (judge: no) |
| H11-SEM | print-shop H11-SEM-twin2 (one-to-one, glossary-owned paper catalogue) | clean (no candidate) |
| H03 | customs-brokerage H03-twin1 (driving adapters import `adapters/in/shared`) | clean |
| H03 | print-shop H03-twin1 (driving adapters import a type from `adapters/in/shared`) | clean |

All 10 hard twins are clean. The other clean cases (plain twins, legit) are clean too, except one.

### Misses and the false positive (read after scoring)

- **pharmacy-refills H11-pos2 (b), missed.** The domain declares `class AdjudicationFault extends DomainError` with a
  `faultCode` field. The vendor class is named `AdjudicationFault`, but its field is `fault_code`. The only vendor term
  copied is a class name, and none of the three rules reads class names.
- **pharmacy-refills H11-pos3 (b), missed.** A domain error keeps a message table whose keys are four of the vendor's
  five `RejectCode` values (`R70`, `R76`, `R79`, `R88`). The codes appear as object keys, not as a literal type, a
  constant set or a comparison, so they are not seen.
- **pharmacy-refills H11-pos6 (d), missed.** Application code declares `STATEMENT_COLUMNS = ['claim_ref',
  'claim_status', 'patient_pay_amount', 'plan_pay_amount', 'adjudicated_at'] as const`: five vendor field names held as
  string values in an array, not as property names of a type. The rules read field names from declarations, not from
  string arrays.
- **pharmacy-refills H03-twin2, flagged (false positive).** Two outbound adapters (`notification`, `persistence`) both
  import `adapters/out/shared/patient-redaction.ts`, a helper that imports nothing. R-AXA reports both imports. Its
  shared-helper exemption covers only the driving side's `shared` or `common` folder. On the driven side the folder
  counts as another outbound package, as the rule text states.

No rule, prompt or label was changed after the results were seen.

### Other findings in the record (rows not under admission here)

- **R-TRANSPORT (H07, admitted) in customs-brokerage H11-pos1 at `src/domain/clearance.ts:8`.** The case adds `readonly
  statusCode: string` to the domain's `FilingReceipt`: a vendor status code, not an HTTP status. The finding does not
  count in any HCAL-06 row (H07 has no cases here), but it is a false positive of an admitted rule on a field name.
- **R-ADAPTER-RULE (H06, exploratory)** fires in customs-brokerage H03-pos2
  (`src/adapters/out/notification/console-client-notifier.ts:5`) and in print-shop H11-SEM-twin2
  (`src/adapters/out/printing/printhub-production.gateway.ts:37`).

## Model calls

| | Asked | From disk cache | Real calls | Answers |
|---|---|---|---|---|
| Base check | 2 | 0 | 2 | 2 no |
| Cases | 10 | 2 (the base candidates) | 8 | 4 yes (the 4 H11-SEM positives), 4 no |

All 10 calls were first attempts, returned a valid answer, and recorded the model `claude-opus-5-5`. There were no
retries, errors or misses. Ledgers: `experiments/hcal-06/results/bases-mirror-sem-calls.jsonl` and
`experiments/hcal-06/results/mirror-sem-calls.jsonl` (one line per call: time, candidate, key, model, duration, token
counts). The `*.judged.jsonl` files beside them record every judged candidate: its case, where the answer came from,
the answer and the model's reason.

## Labels to look at (reported, not changed)

- **pharmacy-refills H03-twin2.** Labelled `twin` (clean). The brief defines the H03 shared-helper twin for the driving
  side only (`adapters/in/shared/`). Whether a driven side's shared helper is an adapter package is a construct question
  the brief does not settle, and the rule settles it the other way. The label and the rule disagree on scope, not on
  the code.
- **pharmacy-refills H11-pos2.** The note says the domain error "carries its fault code". The domain field is
  `faultCode`, not the vendor's `fault_code`, and no fault code values are copied. What is carried is the vendor class
  name alone. The label still fits sub-shape b (a vendor error name in a core error), but the evidence is thinner than
  the note says.
- **pharmacy-refills H11-pos2 and H11-pos3** both give `line: 17`. That is right for each case's own `errors.ts`.

## Standing

- **H11:** not admitted (13/16; b 2/4, d 3/4). Sub-shapes a and c are 4/4.
- **H11-SEM:** meets the bar (4/4, 0/6) as an exploratory, neuro-symbolic row. `ADMITTED_HEX_ROWS` is unchanged. Moving
  the row into a family is a decision for the author.
- **H03:** recall 4/4, including the new driving-to-driving shape, but the driven-side shared-helper twin is flagged.
  The bar is not met on HCAL-06. H03 was admitted by HCAL-03 and its entry is unchanged here. What this result means
  for H03's standing is a decision for the author.

## Regression at the scoring hash

The rule sources and scorer at `dfb96bde1` are identical to PR 442's head (`RULES-FROZEN-2.sha256` verifies). At that
head, zero calls, compared case by case with the PR 440 record:

- **CAL-03:** perRow and rows identical.
- **HCAL-03, HCAL-04, HCAL-05:** rows identical, and perRow identical except the added `H11-SEM` key (0/0). The
  admitted rows are unchanged.
