# v1.5 HCAL-08: blind admission of the v1.5.8 to v1.5.10 Hexagonal shapes

Date: 2026-11-03 UTC. The set was scored once, against instrument `v1.5.10` (`main` `b460c5ea8`, rule hash
`05bd4c36f9323d47`), and judged against the bar in the HCAL-08 brief. A row meets the bar when every positive in it is
caught and no clean case is flagged. There were 2 model calls, both to R-MIRROR-SEM's judge (`claude-opus-5-5`, Claude
CLI route), both in the base check. No case produced an R-MIRROR-SEM candidate, so the case scoring made no call. Each
call is one line of the committed ledger.

## Order of events (from the commits)

| Step | Commit |
|---|---|
| R-MIRROR2 `[word]` and the import and scope facts (instrument v1.5.8) | PR 483, merged `9694be656` |
| R-MIRROR-SEM core-side candidates (v1.5.9) | PR 485, merged `3240d5f83` |
| R-MIRROR-SEM form C, core lookups keyed by vendor values (v1.5.10) | PR 490, merged `dbb93d972` |
| Set built by one blind session (3 new domains, 58 cases, 29 positive), brief `experiments/hcal-08/BRIEF.md`; case seal `e4641f02…` (282 files), scoring copy `321a054f…`; rule hash left as a stub | `c5ada98e4` (PR 494, merged `b460c5ea8`) |
| Seal and scoring copy verified (`verify-seal.sh`) | `c1e9ce3c3` |
| Row map, written before any case was scored (`--rows hcal08` in the scorer) | `415438ffe` |
| `RULES-FROZEN.sha256` (`05bd4c36…`, 46 files, the selection rule of HCAL-06 and HCAL-07) | `4326153f8` |
| Base check, before any case | `c36be971e` |
| Scoring of the 58 cases | `5912e8abd` |
| Hand reading of misses and false flags, zero-call candidate census; this report | this PR |

All three rule PRs merged before the set's build commit. No case file changed after the seal (`git log c5ada98e4..` over
the three domain folders is empty).

**Builder disclosure.** The builder's audit entry records that, after the seal commit, it read the end of
`aidlc-docs/audit.md` to append its entry, and so saw the summaries of the v1.5.9 and v1.5.10 rule changes. The seal
was already committed, and no case file changed after it.

## Row map (before scoring)

The four `HX8-…` keys are the set's own construct terms. They were mapped to the instrument's findings from the PR
records (483, 485, 490) and the rule headers, before any case, label note or glossary key was opened
(`experiments/hcal-08/README.md`, "Row map"; `HCAL08_ROW_RULES` in `experiments/cal-01/score.ts`):

| Row | Mapped rules |
|---|---|
| HX8-WORD | R-MIRROR2 `[word]` |
| HX8-SET | R-MIRROR-SEM form A (core value set), R-MIRROR2 `[literal]` and `[error]` (the counted shapes) |
| HX8-KEY | R-MIRROR-SEM form C (core lookup's key set) |
| HX8-EDGE | R-AXA, R-PURE, R-COREIO, R-D9 (fed by the v1.5.8 facts #3, #5, #8, #17); FF-S01, FF-S04, FF-P01 (the frozen H01/H02 dependency rules) |

A positive counts as caught when a mapped rule, with its shape where the map names one, has a finding in the labelled
file. A clean case counts as flagged when a mapped rule has a finding anywhere in its tree. The scorer change needed for
the map is additive: `RULE[shape]` entries, a `shape` on each hit, and `coreKind` in the judged record. On HCAL-06
(zero calls, same instrument), the changed scorer's record matches the previous scorer's byte for byte, apart from
the added `shape` field. R-MIRROR2 `[word]` and R-MIRROR-SEM are uncounted rules. Admitting their shapes as
rows is the purpose of this set, and the admission changes no counted list.

## Label-leak check and base check

The set is scored from its scoring copy, which strips the builder's glossary key from every case spec. This uses the
same route as HCAL-07: R-MIRROR2's stoplist reads the raw spec text, so the key would otherwise reach a rule. The copy
matched `SCORING-COPY.sha256`.

Base check, before any case: none of the four rows' mapped rules has a finding on any base. The glacier-guiding base
has one R-D4 finding (`src/application/record-conditions.use-case.ts:11`). R-D4 is a DDD rule in no HX8 row, so it was
recorded and not repaired, and it reappears in every glacier case under "other". The judge was asked about 2 base
candidates and answered `no` to both: luthier `DeliveryStage` against bowcraft `Fulfilment`, and orchard
`PressingProgress` against pressmark `RunState`. Both sets are glossary-owned and coarser than the vendor's set.

Command: `npx tsx experiments/cal-01/score.ts --dir <scoring copy> --rows hcal08 --judge live --ledger
experiments/hcal-08/results/mirror-sem-calls.jsonl --out experiments/hcal-08/result.json`. Record:
`experiments/hcal-08/result.json`.

## Result

| Row | Positives caught | Clean flagged | Bar met |
|---|---|---|---|
| HX8-WORD: one vendor word in a core type or value | 0/6 (field 0/3, value 0/3) | 0/6 | no |
| HX8-SET: core copy of a vendor value set, cast from port text | 6/6 | 0/6 | yes |
| HX8-KEY: core lookup keyed by vendor values | 0/6 | 0/7 | no |
| HX8-EDGE: core reaches an adapter or the SDK through an import form a reader may miss | 6/11 | 1/10 | no |

HX8-SET by form: union 3/3, const array 2/2, enum 1/1. All six positives were caught by R-MIRROR2 `[literal]`, on the
labelled file, because each copied set spells the vendor's upper-case codes. R-MIRROR-SEM formed no candidate in any
SET case, so the row meets the bar on R-MIRROR2. The v1.5.9 form A reading was not exercised by this set (see "Misses").

HX8-KEY by form: record 0/1, object literal 0/1, Map 0/1, switch 0/1, equality chain 0/2.

### HX8-EDGE by sub-case

| Sub-case | All seven mapped rules: caught | flagged | bar | v1.5.8-fed rules only: caught | flagged |
|---|---|---|---|---|---|
| a, re-export or barrel | 1/2 | 1/2 | no | 0/2 | 1/2 |
| b, dynamic `import()` | 1/2 | 0/2 | no | 0/2 | 0/2 |
| c, inline type import or `import = require()` | 1/3 | 0/3 | no | 0/3 | 0/3 |
| d, `export *` from a published file | 2/2 | 0/1 | yes | 0/2 | 0/1 |
| e, adapter outside the spec's adapter folders | 1/2 | 0/2 | no | 0/2 | 0/2 |
| **HX8-EDGE** | **6/11** | **1/10** | **no** | **0/11** | **1/10** |

Every HX8-EDGE catch came from a frozen rule:

- glacier `EDGE-pos1` (a): FF-S01, line 1.
- glacier `EDGE-pos3` (c, inline `import('…').X` type in a domain file): FF-P01, line 7.
- luthier `EDGE-pos1` (b, dynamic `import()` of an adapter): FF-S01, line 17.
- luthier `EDGE-pos3` (d): FF-S01, line 3.
- luthier `EDGE-pos4` (e, adapter moved into `src/domain/suppliers/`): FF-P01, FF-S01 and FF-S04, lines 1–2.
- orchard `EDGE-pos3` (d): FF-P01, line 1.

None of the v1.5.8-fed rules caught a positive. The one false flag is R-AXA's. Every caught hit falls on the labelled
line, or a run that includes it.

### Hard twins

All 29 clean cases are hard twins. 28 are clean, and the one flagged is glacier `EDGE-twin1`.

| Row | Clean cases | Result |
|---|---|---|
| HX8-WORD | glossary-owned word (`WORD-twin1`: glacier `quota`, luthier `grade`, orchard `brix`); generic shared word (`WORD-twin2`: `notes`, `colour`, `weight`) | all clean |
| HX8-SET | own set mapped in the gateway (`SET-twin1` ×3); coincidental one-word overlap (`SET-twin2` ×3) | all clean |
| HX8-KEY | own-word lookup (glacier `KEY-twin2`, luthier `KEY-twin1`); same lookup in the adapter (glacier `KEY-twin1`, luthier `KEY-twin2`, orchard `KEY-twin1`); keys declared ours by the glossary (glacier `KEY-twin3`, orchard `KEY-twin2`) | all clean |
| HX8-EDGE | glacier `EDGE-twin1` (a, adapters barrel used by `main.ts`) | **flagged** (R-AXA) |
| HX8-EDGE | luthier `EDGE-twin1` (a), `EDGE-twin2` (b), `EDGE-twin3` (c), `EDGE-twin4` (e); glacier `EDGE-twin2` (e); orchard `EDGE-twin1` (b), `EDGE-twin2` (c), `EDGE-twin3` (c), `EDGE-twin4` (d) | clean |

Caveat on the SET and KEY twins: R-MIRROR-SEM formed no candidate in any case, so these twins test R-MIRROR2 only, not
the judge. R-MIRROR2 respected the glossary, and neither glossary-owned KEY twin has an R-MIRROR2 finding.

### Misses and false flags (read after the findings were committed)

Each line gives the case, its label, and one reading: a rule gap, a label question, or a case defect. A zero-call
candidate census (`experiments/hcal-08/post-score-census.mts`, outputs in `results/post-score-census-*.txt`) was run
after scoring, to see why R-MIRROR-SEM formed no candidate. It makes no judge call, rescores nothing and changes no
case file.

**Why R-MIRROR-SEM formed no candidate.** The instrument type-checks a tree with its own tsconfig (`writeTsconfig` in
`src/v15-instrument/graph.ts`, `moduleResolution: node`, no `paths`). The HCAL vendor SDKs live in the tree under
`vendor/`, and only the tree's own tsconfig `paths` resolve them. So a read such as `res.grade` does not resolve to a
vendor declaration. The v1.5.9 and v1.5.10 tracing (`vendorRead`) counts vendor text only through such a declaration,
so no candidate forms. The census confirms this. As scored, no KEY or SET target has a candidate. With the SDK copied
to `node_modules/` in a scratch tree, a structurally complete candidate (`asked=true`) forms for every KEY-pos2 target
(form C) and for three of the six SET targets:
- glacier `SET-pos2`: form C;
- luthier `SET-pos2`: form A and form C;
- orchard `SET-pos2`: form A.

The three SET-pos1 and the three KEY-pos1 targets still form none.
The adapter-side reading (HCAL-06 and HCAL-07 H11-SEM) is syntactic, which is why it worked on the same layout.

HX8-WORD:

- **glacier `WORD-pos1`** (field `warden`, `src/domain/permit.ts:7`): rule gap. One-word vendor field names are left out
  of `[word]` by design (PR 483, t09). No R-MIRROR2 shape fires.
- **luthier `WORD-pos1`** (field `crate`, `src/domain/repair-job.ts:10`): rule gap, the same exclusion.
- **orchard `WORD-pos1`** (field `pomace`, `src/domain/harvest-lot.ts:9`): rule gap, the same exclusion.
- **glacier `WORD-pos2`** (`DEFERRED` in `BookingStatus`, `src/domain/booking-status.ts:1`): label question. The vendor
  writes the word as an upper-case code. `[word]` reads only a lower-case word, while R-MIRROR2 `[literal]` fires on
  the labelled line. The construct is reported, but under a shape outside this row's map.
- **orchard `WORD-pos2`** (`SETTLING` in `LotStatus`, `src/domain/lot-status.ts:1`): label question, as for glacier
  `WORD-pos2`. `[literal]` fires on the labelled line.
- **luthier `WORD-pos2`** (`backorder` replaces `delayed` in `PartAvailability`, `src/domain/supply.ts:1`): rule gap.
  `backorder` is a vendor field name (a boolean of `PartOrderResponse`), not a vendor value. `[word]` needs a member of
  a coded vendor value set, and no shape reads a vendor field name used as a value.

HX8-KEY. R-MIRROR2 `[literal]` fires in the labelled file of all six:

- **glacier `KEY-pos1`** (`Record` keyed by the vendor's bands, `record-conditions.use-case.ts`): rule gap. The vendor
  word reaches the core through the webhook's own DTO (`BulletinDto.band: string`) and the inbound port's command. The
  tracing counts vendor text only as a read of a vendor-declared property, so no candidate forms, even with the SDK
  resolvable.
- **luthier `KEY-pos1`** (`===` chain, `record-delivery.use-case.ts`): rule gap, the same path
  (`ConsignmentDto.fulfilment: string`).
- **orchard `KEY-pos1`** (`Map`, `record-press-report.use-case.ts`): rule gap, the same path
  (`RunReportDto.run_state: string`).
- **glacier `KEY-pos2`** (`===` chain, `src/domain/permit-rules.ts`): rule gap (vendor typings not resolved; see
  above). With the SDK resolvable, the candidate `outcomeOf:compare(state)` forms (4 of `PermitState`'s 6 values).
- **luthier `KEY-pos2`** (index-signature object, `src/domain/surcharge.ts`): rule gap, the same cause. With the SDK
  resolvable, `SURCHARGE_BY_GRADE` forms (4 of 4 `WoodGrade` values).
- **orchard `KEY-pos2`** (`switch`, `src/domain/payout.ts`): rule gap, the same cause. With the SDK resolvable,
  `payoutRateFor:switch(grade)` forms (3 of 3 `FruitGrade` values).

HX8-EDGE:

- **glacier `EDGE-pos2`** (b, `await import('icetrail-sdk')` in `book-tour.use-case.ts:23`): rule gap. No mapped rule
  reads an application-layer dependency on the vendor package, in any form:
  - FF-S01 and FF-S04 read layer-to-layer edges (they caught luthier `EDGE-pos1`, a dynamic import of an adapter);
  - FF-P01 reads domain files only;
  - R-COREIO and R-PURE read catalogued I/O packages only;
  - R-AXA reads adapter files only.
- **luthier `EDGE-pos2`** (c, `import { type PartOrderResponse } from 'bowcraft-sdk'` in `order-parts.use-case.ts:1`):
  label question. The form is the inline `type` modifier, which v1.5.8 (#8) defines as type-only and does not read. The
  brief's sub-case c names `import('…').X` and `import = require()`. The application-to-vendor gap above also applies.
- **orchard `EDGE-pos2`** (c, `import pressmark = require('pressmark-sdk')` in `send-to-press.use-case.ts:1`): rule gap,
  the application-to-vendor gap. v1.5.8 reads `import = require()`, but only R-COREIO and R-PURE use it, and only for
  I/O packages.
- **orchard `EDGE-pos1`** (a, `export { PressmarkError as PressingError } from 'pressmark-sdk'` in
  `src/application/ports/index.ts:5`): rule gap, the same application-to-vendor gap. A barrel re-export is a v1.5.8 edge
  only for R-AXA.
- **glacier `EDGE-pos4`** (e, `src/application/adapters/icetrail-permit.adapter.ts:1` imports the SDK): rule gap, the
  same gap. The instrument does apply the spec's layer: R-MIRROR2 reads the file as core and fires `[literal]` and
  `[field-list]` in it. But no mapped rule covers an application file that imports the vendor package. The luthier
  sub-case e positive sits in the domain, where FF-P01 caught it.
- **False flag, glacier `EDGE-twin1`** (a, `src/adapters/out/index.ts`, used by `main.ts`): rule gap. Under v1.5.8 #3,
  a file directly in `adapters/out` belongs to the folder itself, so R-AXA reads the barrel as its own package. Under
  #5, its three `export … from` lines become out→out edges. No adapter depends on another.

No rule, prompt or label was changed after the results were seen.

### Other findings in the record (not counted in these rows)

- **R-D4** (DDD) fires in every glacier case at the base's site. It also fires at `log-sky.use-case.ts:8` in
  `SET-twin2`, and at line 20 of `record-conditions.use-case.ts` in `KEY-pos1` and `KEY-twin3`.
- **R-MIRROR** fires on the declaration of each SET positive's copied set.
- **R-MIRROR2 `[literal]`** fires in the labelled file of all six KEY positives and of glacier and orchard `WORD-pos2`.
  It fires on no clean case of any row. This is an observation, not a re-mapping: the map fixed before scoring keeps
  these rows on `[word]` and on R-MIRROR-SEM form C.

## Model calls

| | Asked | From disk cache | Real calls | Answers |
|---|---|---|---|---|
| Base check | 2 | 0 | 2 | 2 no (luthier `DeliveryStage`, orchard `PressingProgress`) |
| Scoring run | 2 (the same base candidates, when the bases were scored again) | 2 | 0 | 2 no |
| Cases | 0 | 0 | 0 | none: no case produced a candidate |

Both calls were first attempts and returned a valid answer, and both record the model `claude-opus-5-5`. There were no
retries, errors or misses. Ledgers: `experiments/hcal-08/results/bases-mirror-sem-calls.jsonl` (2 lines), and the
judged records `bases-mirror-sem-calls.judged.jsonl` and `mirror-sem-calls.judged.jsonl`. The scoring run made no
call, so `mirror-sem-calls.jsonl` was not created. The census after scoring made no model call.

## Labels to look at (reported, not changed)

The builder's flags:

- **SET twins with coincidental words** (`SET-twin2` ×3, glacier `SET-twin1`): all clean.
- **Clean by the glossary alone** (glacier `KEY-twin3`, orchard `KEY-twin2`, `WORD-twin1` ×3): all clean. R-MIRROR2
  respects the glossary. R-MIRROR-SEM formed no candidate, so the judge never saw these twins.
- **HX8-EDGE e positives**: glacier `EDGE-pos4` (moved into the application layer) is missed. luthier `EDGE-pos4` (moved
  into the domain) is caught.
- **glacier `SET-pos1`**: caught by `[literal]` on the labelled declaration (`hazard.ts:1`), and also at the `===` sites
  in `tour-booking.ts:30`.

Found on reading:

- **luthier `EDGE-pos2`**: the inline `type` modifier is outside the forms the brief lists for sub-case c (see
  "Misses").
- **luthier `WORD-pos2`**: the note calls `backorder` a field name used as a value word, yet the label's sub-shape is
  `value`.
- **glacier and orchard `WORD-pos2`**: the planted words are upper-case vendor codes, which the literal shape covers.

## Standing

- **HX8-SET:** bar met (6/6, 0/6), on R-MIRROR2 `[literal]`. R-MIRROR-SEM form A was not exercised (no candidate in any
  case).
- **HX8-WORD:** bar not met (0/6, 0/6).
- **HX8-KEY:** bar not met (0/6, 0/7).
- **HX8-EDGE:** bar not met (6/11, 1/10). Sub-case d meets the bar (2/2, 0/1), on frozen rules only. The v1.5.8-fed
  rules alone give 0/11 and 1/10.

The main causes, as read after scoring:

- One-word vendor field names are not read (by design, since v1.5.8).
- R-MIRROR-SEM's vendor-text tracing needs vendor typings that resolve through the instrument's own tsconfig. HCAL's
  in-tree SDKs resolve only through the tree's `paths`.
- Vendor text that reaches the core through an inbound DTO typed `string` is not traced.
- No mapped rule covers an application-layer import of the vendor package.
- R-AXA reads a barrel placed directly in `adapters/out` as a package of its own.

`ADMITTED_HEX_ROWS` and the counted lists are unchanged. Admission decisions are left to the author.
