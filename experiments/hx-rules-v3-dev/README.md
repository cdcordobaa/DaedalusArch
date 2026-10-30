# HX-RULES-V3 development fixtures (instrument v1.5.5, 2026-10-29)

Development data only. These cases were written to develop the v1.5.5 rule changes and are not admission evidence.
No case here was built blind. The gaps they target come from the HCAL-06 report
(`Docs/DiagnosticRuns/v15-hcal06-admission-2026-10-30.md`). The fixtures copy none of HCAL-06's cases: they use
two new domains, each with its own vendor SDK.

| Domain | Vendor SDK | Cases |
|---|---|---|
| `freight-booking` | `cargolink-sdk` (booking states, hold codes, `BookingReply`, `CarrierRefusal`, `ShipmentWindow`, `Lane`) | 14 (H11) |
| `parcel-lockers` | `lockbox-sdk` (door states, fault codes, `DoorReport`, `LockboxTimeout`) | 20 (7 H03, 7 H07, 6 H11) |

The layout is the HCAL layout: a case is `base/` with `cases/<id>/` laid over it, and `labels.json` gives each case its
row, its label, the labelled file and a note. `subshape` names the reading a case tests. `kind` is `positive`,
`hard-twin` (clean, and as close to the positive as the construct allows) or `twin`.

## The three gaps and the changes

1. **H11, R-MIRROR2** (`src/v15-instrument/vendor-lexicon.ts`, `rules/r-mirror2-vendor-lexicon.cypher`). The rule now
   reads three more things:
   - `decl`: a core class, interface, type alias or enum named like a vendor declaration. Case, separators and a
     trailing Error or Exception word are ignored, so `CarrierRefusal` matches `CarrierRefusal` and
     `LockboxTimeoutError` matches `LockboxTimeout`. A one-word name, a name the spec states (here the glossary's
     "shipment window") or a name the baseline's core already declares is not counted.
   - `key`: an identifier key of a core object literal (`{ H10: '…' }`) is read like a quoted key, and is counted
     against vendor codes only, not against vendor declaration names.
   - `list`: a core array literal or tuple type whose 3 or more non-id string elements are all field names of one
     vendor declaration, spelled exactly as the vendor spells them. At least one of the names must be the vendor's
     own term, not a generic word.
2. **H03, R-AXA** (`facts.ts` `sideShared`, `rules/r-axa-adapter-imports-adapter.cypher`). The shared-helper exemption
   now covers both sides. `adapters/out/shared` or `adapters/out/common`, when imported by an outbound package of the
   same side, is exempt under the same "imports only domain or shared-kernel code" condition. Imports across sides,
   and shared files that import an adapter, are still reported.
3. **H07, R-TRANSPORT** (`facts.ts` form `status-name`, `rules/r-transport-in-core.cypher`). A field named like a status
   (`statusCode`, `httpStatus`) with no HTTP status number is now the fact `status-name`, and the rule does not fire on
   it unless its declared type is an HTTP status type. New `status-code` evidence: an HTTP status number assigned to or
   compared with a status-named member (`this.statusCode = 409`, `found.statusCode === 404`).

The Cypher files decide. The extractor only supplies facts and tokens.

## Dev table

`dev-table.json` is the scorer's record, with zero model calls:

    npx tsx experiments/cal-01/score.ts --dir experiments/hx-rules-v3-dev --rows hex --out experiments/hx-rules-v3-dev/dev-table.json

| Gap | Row | Main (`a1dc36024`) recall / FP | v1.5.5 recall / FP |
|---|---|---|---|
| 1a decl | H11 | 0/3, 0/4 hard twins | 3/3, 0/4 |
| 1b key | H11 | 0/3, 0/3 hard twins | 3/3, 0/3 |
| 1c list | H11 | 0/3, 0/4 clean (3 hard, 1 plain) | 3/3, 0/4 |
| H11 overall | H11 | 0/9, 0/11 | 9/9, 0/11 |
| 2 driven-side helper | H03 | 4/4, 2/3 hard twins | 4/4, 0/3 |
| 3 HTTP evidence | H07 | 4/4, 3/3 hard twins | 4/4, 0/3 |

Both bases are clean on main and on v1.5.5. On main, the H03 false positives are the two driven-side helper twins
(`adapters/out/shared`, `adapters/out/common`). The driving-side twin is clean on both. The H07 false positives on
main are the three status-named fields with no HTTP evidence: a string code, a numeric firmware code, and a field typed
by the parcel state. Unit tests: `tests/unit/v15-instrument/hx-rules-v3.test.ts`, with each gap's positives and hard
twins.

## Regression (`regression.json`)

Every set was scored at `origin/main` (`a1dc36024`) and at this branch with `experiments/cal-01/score.ts --out
<scratch>`, without a judge (zero model calls). The records were compared case by case, as in PRs 440 and 442.

- **CAL-03, HCAL-03, HCAL-04, HCAL-05:** perRow identical. Every pass/fail is unchanged. Three violation cases
  have different findings, and no clean case changes:
  - HCAL-03 solar-coop H07-pos2: the R-TRANSPORT finding on the result type's `statusCode: number` declaration (line 6)
    is gone, because a field name alone is no longer evidence. The case is still found by its HTTP numbers, `{
    statusCode: 404 }` and `{ statusCode: 200 }`, on lines 8 and 13.
  - HCAL-04 radio-station H11-pos2 and vet-clinic H11-pos2: one new R-MIRROR2 `decl` finding each. The port enums
    `TimePrecision` and `TreatmentPrecision` carry the names of the vendor's value-set types. R-MIRROR and R-MIRROR2 already found these
    cases.
- **HCAL-06 (burned; a regression re-run only, not admission evidence):** H11 goes from 13/16 to 16/16 (b 2/4 to 4/4,
  d 3/4 to 4/4), with FP still 0/8. H03 FP goes from 1/6 to 0/6. The missed cases are now found: pharmacy-refills
  H11-pos2 (the `AdjudicationFault` class name), H11-pos3 (the `R70`... message-table keys) and H11-pos6 (the
  `STATEMENT_COLUMNS` list). The H03-twin2 false positive is gone, and so is the R-TRANSPORT finding on customs-brokerage
  H11-pos1 (`statusCode: string`). This re-run made no judge calls, so H11-SEM reads 0/4 on both sides. Its sealed
  4/4 comes from the live judge and is not affected, because R-MIRROR-SEM did not change. `experiments/hcal-06/result.json`
  is not overwritten.

## H08 trace: why HCAL-03 museum-loans H08-pos2 is 3/4 in the sealed record and 4/4 on main

The case's labelled file is `src/adapters/in/http/loan.controller.ts`. The controller takes its clock from
`resolve<Clock>('clock')`, a module-level function in `src/application/service-registry.ts` that wraps
`ServiceRegistry.resolve(key)`. HCAL-03 was scored once, at `9ed7dd375` (2026-10-28 12:45 -0500). At that commit,
R-LOCATOR (from CN-03, `55ab574cd`) reported only the lookup itself, at `src/application/service-registry.ts:16`
(form `container-call`). That is not the labelled file, so the case failed and the row read 3/4.

CN-04 (`b247241b6`, 2026-10-28 16:48 -0500, after the scoring) added the R-LOCATOR form `via-helper`: a call outside
the composition root to an in-tree function holding a reported lookup is reported at the caller. On main the
case therefore also has `src/adapters/in/http/loan.controller.ts:18 adapter code obtains a dependency at run time:
resolve(…), which runs ServiceRegistry.resolve(key) (src/application/service-registry.ts:15)`. That is the
labelled file, so the case passes and the row reads 4/4.

The sealed record is right for the rules it was scored with. Main's 4/4 is a post-scoring development change, not
admission evidence. H08 was admitted later, on HCAL-04. The HCAL-04 and HCAL-05 reports already list this
difference ("H08-pos2: the via-helper hit"). v1.5.5 changes nothing here: the case's record is byte-identical between
main and this branch.
