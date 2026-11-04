# v1.5 HCAL-09: blind admission of the HCAL-08 rows, H11-d, H06 and K10 on fresh material

Date: 2026-11-04 UTC. The set was scored once, against instrument `v1.5.11` (`main` `6d8b4ca6f`, rule hash
`46ab6724d54c6fb7`), and judged against the bar in the HCAL-09 brief (copied from HCAL-08). A row meets the bar when
every positive in it is caught and no clean case is flagged. There were 13 model calls, all to R-MIRROR-SEM's judge
(`claude-opus-5-5`, Claude CLI route): 3 in the base check and 10 in the case scoring. Each call is one line of the
committed ledgers.

## Order of events (from the commits)

| Step | Commit |
|---|---|
| v1.5.11: tree tsconfig `paths`, R-APPVENDOR (exploratory), barrel in `adapters/out` is no package | PR 498, merged `482e1d66d` |
| Set built by one blind session (4 new domains, 94 cases, 47 positive), brief `experiments/hcal-09/BRIEF.md`; case seal `b3daba61…` (502 files), scoring copy `56a88d31…`; rule hash left as a stub | PR 499, merged `6d8b4ca6f` |
| Seal verified (`verify-seal.sh`); row map, written before any case was scored (`--rows hcal09` in the scorer) | `46f06b1a4` |
| `RULES-FROZEN.sha256` (`46ab6724…`, 47 files, the selection rule of HCAL-06 to HCAL-08) | `8ab41812b` |
| Base check, before any case | `ac71d13a1` |
| Scoring of the 94 cases (one run, 2026-11-04T20:08Z to 20:09Z, exit 0) | `2e857f3ed` |
| Hand reading of misses and false flags; this report | this PR |

The rule PR merged before the set's build commit. No case file changed after the seal (`verify-seal.sh` passes on all
502 files at each step). The run stopped on no script error; it is the only scoring run.

**Builder disclosures** (from `experiments/hcal-09/README.md`). In finding its reading list, the builder's heading greps
showed some lines beyond the row definitions: the HCAL-08 row map, the HCAL-08 per-row results, and the line saying that
R-AXA reads a barrel placed directly in `adapters/out` as a package of its own. The builder states that no case was
built around that line. After the cases were built and before the seal, reading the end of `aidlc-docs/audit.md` to
copy its format showed the summaries of v1.5.9, v1.5.10 and the HCAL-08 scoring session; no base, case or label
changed after that read. The README also notes that the 14 case specs that differ from their base after the strip are
all clean cases, so a reader comparing a case spec with its base could tell them apart.

## Row map (before scoring)

Written from the existing row maps and the v1.5.11 record, before any case, label note or glossary key was opened
(`experiments/hcal-09/README.md`, "Row map"; `HCAL09_ROW_RULES` in `experiments/cal-01/score.ts`):

| Row | Mapped rules | Source |
|---|---|---|
| HX9-WORD | R-MIRROR2 `[word]` | HX8-WORD, unchanged |
| HX9-SET | R-MIRROR-SEM form A, R-MIRROR2 `[literal]` and `[error]` | HX8-SET, unchanged |
| HX9-KEY | R-MIRROR-SEM form C | HX8-KEY, unchanged |
| HX9-EDGE | R-AXA, R-PURE, R-COREIO, R-D9, FF-S01, FF-S04, FF-P01, **R-APPVENDOR** | HX8-EDGE plus R-APPVENDOR, the v1.5.11 rule developed for that row on the HCAL-08 cases |
| HX9-FIELD | R-MIRROR, R-MIRROR2, R-MIRROR-SEM | the H11-d row (HCAL-07 scored H11-d against H11's rules) |
| HX9-RULE | R-ADAPTER-RULE | the H06 row |
| DX9-SET | R-D5S | the K10 row as scored since CAL-03 (`ROW_OVERRIDES.K10`) |

A positive counts as caught when a mapped rule, with its shape where the map names one, has a finding in the labelled
file. A clean case counts as flagged when a mapped rule has a finding anywhere in its tree. The scorer change is the
row map only; scoring logic is unchanged from HCAL-08.

## Label-leak check and base check

The set is scored from its scoring copy, which strips the builder's glossary key from every case spec (same route as
HCAL-07 and HCAL-08). The copy matched `SCORING-COPY.sha256`.

Base check, before any case: none of the seven rows' mapped rules has a finding on any base. The apiary-pollination
base has two FF-P03 findings (`src/adapters/out/sensors/hivepulse-lease.gateway.ts:6`,
`src/adapters/out/persistence/in-memory-placement.repository.ts:4`). FF-P03 is a frozen rule in no HCAL-09 row, so it
was recorded and not repaired, and it reappears in every apiary case under "other". bell-foundry, harbor-pilotage and
stone-quarry are clean. The judge was asked about 3 base candidates and answered `no` to all three: apiary
`ColonyVigour` against hivepulse `ColonyState`, bell `MetalReadiness` against ingotline `DispatchState`, harbor
`VesselStage` against tidewatch `VoyagePhase`. Each answer cites the glossary's ownership and a coarser cut of the set.

Command: `npx tsx experiments/cal-01/score.ts --dir <scoring copy> --rows hcal09 --judge live --ledger
experiments/hcal-09/results/mirror-sem-calls.jsonl --out experiments/hcal-09/result.json`. Record:
`experiments/hcal-09/result.json`.

## Result

| Row | Positives caught | Clean flagged | Bar met |
|---|---|---|---|
| HX9-WORD: one vendor word in a core type or value | 0/6 (field 0/3, value 0/3) | 0/6 | no |
| HX9-SET: core copy of a vendor value set, cast from port text | 5/6 | 0/6 | no |
| HX9-KEY: core lookup keyed by vendor values | 3/6 | 0/7 | no |
| HX9-EDGE: core reaches an adapter or the SDK through an import form a reader may miss | 11/11 | 1/10 | no |
| HX9-FIELD (H11-d): vendor field names in the core | 5/6 | 0/6 | no |
| HX9-RULE (H06): business rule in an adapter | 3/6 | 0/6 | no |
| DX9-SET (K10): declared set invariant checked outside its owner | 6/6 | 0/6 | **yes** |

HX9-SET by form: union 2/2, const array 2/2, enum 1/2. Five catches are R-MIRROR2 `[literal]` on the labelled file
(upper-case vendor codes); in bell and harbor `SET-pos2` R-MIRROR-SEM form A also fires on the labelled line.

HX9-KEY by form: Map 2/2, object literal 1/1, record 0/1, switch 0/1, equality chain 0/1. All three catches are
R-MIRROR-SEM form C on the labelled line (the `pos2` case of each domain); all three misses are the `pos1` cases.

HX9-FIELD by variant: declared field 3/3 (R-MIRROR2 `[field]`), string list 1/1 (R-MIRROR2 `[field-list]`), mapping
table 1/2 (apiary caught by R-MIRROR; bell missed).

HX9-RULE by kind: threshold 2/3, state decision 1/1, calculation 0/2. All catches are R-ADAPTER-RULE on the labelled
line.

DX9-SET by place of the check: application service (throw 1/1, result 1/1), controller 1/1, repository 1/1, other
aggregate 1/1, domain service outside the owner module 1/1. Every catch is R-D5S on the labelled line.

### HX9-EDGE by sub-case

| Sub-case | All eight mapped rules: caught | flagged | bar | without R-APPVENDOR (HX8-EDGE map): caught | flagged |
|---|---|---|---|---|---|
| a, re-export or barrel | 2/2 | 0/2 | yes | 2/2 | 0/2 |
| b, dynamic `import()` | 2/2 | 0/2 | yes | 1/2 | 0/2 |
| c, inline type import or `import = require()` | 3/3 | 0/3 | yes | 1/3 | 0/3 |
| d, `export *` from a published file | 2/2 | 0/1 | yes | 2/2 | 0/1 |
| e, adapter outside the spec's adapter folders | 2/2 | 1/2 | no | 1/2 | 1/2 |
| **HX9-EDGE** | **11/11** | **1/10** | **no** | **7/11** | **1/10** |

Which rule caught each HX9-EDGE positive (every hit on the labelled line):

- apiary `EDGE-pos1` (c, inline `import('hivepulse-sdk')` type in an out-port, line 10): R-APPVENDOR.
- apiary `EDGE-pos2` (d, out-ports index `export *` of the gateway adapter, line 4): FF-S01.
- apiary `EDGE-pos3` (e, gateway moved into `src/domain/sensors/`, line 4): FF-P01.
- bell `EDGE-pos1` (a, domain errors import from a supply adapters barrel, line 1): FF-S01, FF-S04.
- bell `EDGE-pos2` (b, dynamic `import()` of the notification adapter's templates, line 17): FF-S01.
- bell `EDGE-pos3` (c, `import sdk = require('ingotline-sdk')` in a use case, line 1): R-APPVENDOR.
- bell `EDGE-pos4` (d, domain index `export *` of the gateway adapter, line 7): FF-S01, FF-S04.
- harbor `EDGE-pos1` (a, use case imports the out-adapters barrel, line 1): FF-S01.
- harbor `EDGE-pos2` (b, dynamic `import('tidewatch-sdk')` in a use case, line 21): R-APPVENDOR.
- harbor `EDGE-pos3` (c, inline `import('tidewatch-sdk')` type in a domain file, line 8): FF-P01.
- harbor `EDGE-pos4` (e, gateway moved into `src/application/tides/`, line 3): R-APPVENDOR.

R-APPVENDOR caught 4 positives (sub-cases b, c ×2, e) that no other mapped rule caught, and it fired on no clean case
and no base. The one false flag is R-AXA's.

### Hard twins

All 47 clean cases are hard twins. 46 are clean, and the one flagged is apiary `EDGE-twin2`.

| Row | Clean cases | Result |
|---|---|---|
| HX9-WORD | glossary-owned word (`WORD-twin1`: harbor `squat`, bell `assay`, apiary `queenless`); generic shared word (`WORD-twin2`: `notes`, `comment`, `timestamp`) | all clean |
| HX9-SET | own set mapped in the adapter (`SET-twin1` ×3); one coincidental vendor word in a glossary-declared set (`SET-twin2` ×3) | all clean |
| HX9-KEY | own-word lookup (`KEY-twin1` ×3); same vendor lookup in the inbound adapter (`KEY-twin2` ×3); keys declared ours by the glossary (harbor `KEY-twin3`) | all clean |
| HX9-EDGE | apiary `EDGE-twin2` (e, webhook handler moved to `src/webhooks/`, declared an inbound adapter folder) | **flagged** (R-AXA) |
| HX9-EDGE | bell `EDGE-twin1` (a), `EDGE-twin2` (b), `EDGE-twin3` (c), `EDGE-twin4` (d); harbor `EDGE-twin1` (a), `EDGE-twin2` (b), `EDGE-twin3` (c), `EDGE-twin4` (e); apiary `EDGE-twin1` (c) | clean |
| HX9-FIELD | glossary-declared snake_case fields (`FIELD-twin1` harbor, apiary); vendor field table in the adapter (harbor `FIELD-twin2`, bell `FIELD-twin1`); own-word field (bell, apiary `FIELD-twin2`) | all clean |
| HX9-RULE | technical work only (`RULE-twin1`: retry, rate limit, dedup; bell `RULE-twin2`: shape check); rule in the domain (harbor, apiary `RULE-twin2`) | all clean |
| DX9-SET | owner check (`SETINV-twin1`), input check (`twin2`), uniqueness left to the store (`twin3`), single invariant in its owner (`twin4`), owner read (`twin5`), store sums and owner decides (`twin6`) | all clean |

The judge saw two twins, harbor `KEY-twin3` (glossary-declared keys) and harbor `SET-twin1` (own set), and answered
`no` to both. It was asked about no other twin (see "Model calls").

### Misses and false flags (read after the findings were committed)

Each line gives the case, its label, and one reading: a rule gap, a label question, or a case defect.

HX9-WORD:

- **harbor `WORD-pos1`** (field `squat`, `src/domain/pilotage-job.ts:12`), **bell `WORD-pos1`** (field `carrier`,
  `src/domain/metal-lot.ts:7`), **apiary `WORD-pos1`** (field `firmware`, `src/domain/colony.ts:8`): rule gap. One-word
  vendor field names are left out of `[word]` by design (PR 483, t09), as on HCAL-08.
- **harbor `WORD-pos2`** (`DIVERTED` in `JobStatus`, `src/domain/job-status.ts:1`) and **bell `WORD-pos2`**
  (`ASSAYED` in `CommissionStatus`, `src/domain/commission-status.ts:1`): label question, as on HCAL-08. The vendor
  writes the word as an upper-case code. `[word]` reads a lower-case word only; R-MIRROR2 `[literal]` fires on the
  labelled line, a shape outside this row's map.
- **apiary `WORD-pos2`** (`absconded` added to `ColonyVigour`, `src/domain/colony.ts:1`): rule gap. `[word]` needs the
  vendor value to belong to a coded set (at least one member written as a code). hivepulse's `ColonyState` is six
  lower-case words, so it is not a coded set. `[word]` also needs core code that decides on the word, and here only
  the adapter's switch names `absconded`. R-MIRROR-SEM asked about `ColonyVigour` against `ColonyState` and was
  answered `no` (glossary-owned set, cut differently).

HX9-SET:

- **apiary `SET-pos1`** (enum copy of `ColonyState`, `src/domain/hive-condition.ts:1`): rule gap. The values are
  lower-case words, so R-MIRROR2 `[literal]` does not read them. R-MIRROR fires on the labelled line, but R-MIRROR is
  not in this row's map. R-MIRROR-SEM forms no candidate because the state reaches the core through the webhook's own
  DTO (`TelemetryFrameDto.colony_state: string`) and the inbound port's command. This is the inbound-DTO limit that
  v1.5.11 left open (fix 4).

HX9-KEY. All three misses are `pos1` cases where the state reaches the core through an inbound DTO typed `string` and
the inbound port's command. That is the same v1.5.11 limit, so R-MIRROR-SEM forms no candidate:

- **harbor `KEY-pos1`** (`Record` keyed by four voyage phases, `record-movement.use-case.ts:7`; `MovementDto.phase:
  string`): rule gap. R-MIRROR2 `[literal]` fires on the keys (lines 8–11).
- **bell `KEY-pos1`** (`switch` on three dispatch states, `src/domain/bell-commission.ts:40`;
  `DispatchNoticeDto.dispatch_state: string`): rule gap. `[literal]` fires on the case labels.
- **apiary `KEY-pos1`** (`===` chain on colony states, `record-telemetry.use-case.ts:17`;
  `TelemetryFrameDto.colony_state: string`): rule gap. The values are lower-case words, so `[literal]` does not fire
  either.

HX9-FIELD:

- **bell `FIELD-pos1`** (`NOTICE_FIELDS = { lotRef: 'heat_number', certificate: 'assay_cert_url' }`,
  `record-dispatch.use-case.ts:6`): rule gap. The table has two vendor field names. R-MIRROR2 `[field-list]` reads an
  object literal's values as a list only at three or more elements, and no other shape reads a string value. (The
  apiary mapping-table positive was caught by R-MIRROR.)

HX9-RULE. R-ADAPTER-RULE's decision fact starts from a condition, an `if` or a ternary. The three misses decide without
one:

- **bell `RULE-pos1`** (bronze needed, `Math.ceil(order.bellWeightKg * 1.12 + 40)` as an argument of the vendor call,
  `ingotline-alloy.gateway.ts:15`) and **apiary `RULE-pos1`** (sensors per yard, `Math.max(2, Math.ceil(request.hiveCount
  / 4))` as an argument, `hivepulse-lease.gateway.ts:15`): rule gap. A calculation with no condition is not a decision
  to this rule. The v1.5.7 price reading needs a numeric ternary arm.
- **bell `RULE-pos2`** (`const accepted = Math.abs(params.centsOff) <= 8`, passed through the port,
  `commission.controller.ts:17`): rule gap. The comparison goes into a boolean that is handed on. No branch in the
  adapter depends on it.

The three caught positives each branch on the rule: harbor's ternary on `ukc_margin_m`, harbor's anchor-time ternary,
and apiary's brood-temperature ternary.

HX9-EDGE:

- **False flag, apiary `EDGE-twin2`** (e, `src/webhooks/hivepulse-telemetry.handler.ts:4`): case-construction
  question. The spec declares `src/webhooks/**` as an inbound adapter folder, and the instrument applied it: there is
  no R-COREIO, FF or R-APPVENDOR finding on the SDK import at line 3. R-AXA fires on line 4,
  `import { TelemetryFrameDto } from '../adapters/in/webhook/telemetry.dto'`. The moved handler still takes its DTO from
  the base's webhook adapter folder, which is now a different adapter package. R-AXA is built to report exactly that
  edge, one adapter importing another. The flag does not fall on the folder placement the twin was built to test.
  Under the bar it counts as flagged.

No rule, prompt, label or row map was changed after the results were seen.

### Other findings in the record (not counted in these rows)

- **FF-P03** fires in every apiary case at the two base sites.
- **R-MIRROR** fires on the declaration of each SET positive's copied set, including the missed apiary `SET-pos1`.
- **R-MIRROR2 `[literal]`** fires in the labelled file of harbor and bell `KEY-pos1` and `WORD-pos2`, and on no clean
  case of any row. This is an observation, not a re-mapping.
- **R-D5** (exploratory, outside DX9-SET's map since K10 is scored by R-D5S alone) fires on the same line as R-D5S in
  `SETINV-pos1`, `pos2` and `pos4`. It also fires on the clean `SETINV-twin2` (`HaulService.ts:25`, an input check
  that is not a declared invariant). Under `DDD_ROW_RULES.K10` (R-D5S and R-D5), that twin would be flagged.
- **R-ADAPTER-RULE** fires on `SETINV-pos3` at the labelled line (the repository's refusal).
- **R-H5** fires on apiary `EDGE-pos1` (vendor type in an out-port), and **R-INJ** on harbor `EDGE-pos1`
  (`record-movement.use-case.ts:10`, the adapter taken as the default notifier).

## Judgement-call labels, both ways

The builder flagged two DX9-SET labels as judgement calls. The admission decision uses the labels as sealed. The
flipped readings below are computed from the same record and change nothing.

| Reading | `SETINV-pos6` (check in `src/haulage/domain/policies/PayloadPolicy.ts`) | `SETINV-twin6` (store sums, Truck decides) | DX9-SET caught | flagged | bar |
|---|---|---|---|---|---|
| As labelled | positive, caught (R-D5S, line 8) | clean, not flagged | 6/6 | 0/6 | yes |
| pos6 flipped to clean | R-D5S finding in the tree → flagged | clean, not flagged | 5/5 | 1/7 | no |
| twin6 flipped to positive | positive, caught | no R-D5S finding anywhere → missed | 6/7 | 0/5 | no |
| both flipped | flagged | missed | 5/6 | 1/6 | no |

R-D5S's verdict on both cases is the one the labels state: it reports the domain-service check outside the Truck
module, and it does not report the store's sum when the Truck still compares and decides. The row meets the bar only
under the labels as sealed.

## Model calls

| | Asked | From disk cache | Real calls | Answers |
|---|---|---|---|---|
| Base check | 3 | 0 | 3 | 3 no (apiary `ColonyVigour`, bell `MetalReadiness`, harbor `VesselStage`) |
| Scoring run, bases | 3 (the same base candidates) | 3 | 0 | 3 no |
| Scoring run, cases | 10 | 0 | 10 | 5 yes, 5 no |

Case answers:

- `yes` (each a positive, on the labelled line): apiary `KEY-pos2` (`LIVE_BY_STATE` vs `LeaseState`, form C), bell
  `KEY-pos2` (`LEAD_DAYS` vs `PurityGrade`, C), harbor `KEY-pos2` (`SIZE_FACTOR` vs `HullClass`, C), bell `SET-pos2`
  (`BronzeGrade` vs `PurityGrade`, A), harbor `SET-pos2` (`HullCategory` vs `HullClass`, A).
- `no`, on twins: harbor `KEY-twin3` (`SIZE_FACTOR`, keys declared ours by the glossary) and harbor `SET-twin1`
  (`VesselSize`, own set).
- `no`, on the three `WORD-pos2` cases: each asked about the core set that received the word, against the vendor's
  state set (apiary `ColonyVigour`, bell `MetalReadiness`, harbor `VesselStage`). These are not this row's rule, and
  the answers do not count for HX9-WORD.

All 13 calls were first attempts and returned a valid answer, and all record the model `claude-opus-5-5`. There were no
retries, errors or misses. Ledgers: `experiments/hcal-09/results/bases-mirror-sem-calls.jsonl` (3 lines) and
`mirror-sem-calls.jsonl` (10 lines), with the judged records `bases-mirror-sem-calls.judged.jsonl` and
`mirror-sem-calls.judged.jsonl`. The hand reading made no model call.

## Standing

- **DX9-SET (K10, R-D5S):** bar met (6/6, 0/6). Under either flipped judgement-call label it would not be.
- **HX9-EDGE:** bar not met (11/11, 1/10). Sub-cases a to d meet the bar. Sub-case e catches both positives but flags
  one twin (R-AXA, on a DTO import between two inbound adapter folders). Without R-APPVENDOR the row is 7/11, 1/10.
- **HX9-SET:** bar not met (5/6, 0/6).
- **HX9-FIELD (H11-d):** bar not met (5/6, 0/6).
- **HX9-KEY:** bar not met (3/6, 0/7).
- **HX9-RULE (H06):** bar not met (3/6, 0/6).
- **HX9-WORD:** bar not met (0/6, 0/6).

The main causes, as read after scoring:

- When vendor text reaches the core through an inbound DTO typed `string`, R-MIRROR-SEM does not trace it. This
  accounts for 3 KEY misses and 1 SET miss (the v1.5.11 limit). Form C caught every `pos2` case, where the vendor
  type resolves.
- R-ADAPTER-RULE reads a decision only from a condition. It misses a rule written as plain arithmetic, or as a
  comparison stored in a boolean (3 RULE misses).
- One-word vendor field names are not read by design (3 WORD misses). Upper-case vendor value words fall to
  `[literal]`, outside the WORD map (2 misses). A lower-case vendor value set with no code member is not a coded set
  (1 miss).
- R-MIRROR2 `[field-list]` needs three or more names. A two-entry field table is missed (1 FIELD miss).
- One HX9-EDGE twin keeps an import from another adapter folder, and R-AXA reports it.

`ADMITTED_HEX_ROWS`, `ADMITTED_DDD_ROWS` and the counted lists are unchanged. Admission decisions are left to the
author.
