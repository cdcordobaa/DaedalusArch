# H11D-DEV: R-MIRROR2 field shapes for H11-c and H11-d (v1.5.7, exploratory)

2026-11-02. Zero model calls, no Neo4j. **This is a development fit.** The fixtures here were written after reading
the rule, and the HCAL-06 cases were scored before. None of it is admission evidence. Admitting H11-d (or H11-c as a
counted sub-shape) needs a blind, sealed set scored once. HCAL-07 was not opened for this work (only its admission
report was read), so it can still serve a re-admission, or a newly built set can.

## The problem

HCAL-07 scored H11-d ("vendor field names copied into the core") 4/6 recall with 0/4 FP, short of the bar
(`Docs/DiagnosticRuns/v15-hcal07-admission-2026-10-30.md`). The registered Hexagonal study also leaves H11-c and H11-d
uncounted (pre-registration §1, D1). The reason is that R-MIRROR2's `[field]` fires on both, so the shape word can't
tell them apart.

### Why `[field]` cannot separate c from d

Before v1.5.7, `[field]` was one finding per core field spelled exactly like a vendor-owned field, with no reference to
the type that holds it. Both sub-shapes give the same row:

- H11-c, one field renamed to a vendor field (`FilingReceipt.liquidation_date`), gives one `[field]`.
- H11-d, a type that copies several vendor fields (`EntrySnapshot { entry_number, entry_status, duty_amount_usd,
  liquidation_date }`), gives one `[field]` per field. It may also give one `[field-set]`, but only when every field of
  the type is a field of one vendor declaration.

On HCAL-06, all three declared-type d positives reported `field` together with `field-set`. A d type that mixes vendor
fields with fields of its own (`H11d-type-pos1` below) reported only `[field]`, so it read exactly like c. The only
difference between c and d is how many vendor fields one core type holds, and the old `[field]` row never counted
them.

### The two missed d variants (from the HCAL-07 report's description)

1. **Mixed-declaration list.** A `string[]` of `consignment_no`, `consignee_postcode`, `pallet_count` and
   `gross_weight_kg`, drawn from a request type and a response type. `field-list` needed every element to be a field of
   *one* vendor declaration.
2. **Vendor names as object values.** `FREIGHT_FIELDS = { postcode: 'consignee_postcode', … }`. The lexicon read object
   *keys* as literals (v1.5.5) and arrays and tuples as lists, but it never read object *values* as names.

## The revision (v1.5.7)

`src/v15-instrument/rules/r-mirror2-vendor-lexicon.cypher` (dated header line) and
`src/v15-instrument/vendor-lexicon.ts` (extraction only):

- **c and d by count, per core type.** For each core type and vendor module, the rule counts the distinct field names
  spelled exactly like the module's vendor-owned fields (owned means not generic, not in the spec, not in the baseline).
  - One such name gives **`[field]`**, the c reading. `[field]` is also dropped on a type that is a `field-set`.
  - Two or more give one **`[field-group]`** finding on the type (the subject is the type), the d reading. The type
    then has no `[field]` finding. One copied type now gives one d identity instead of N `[field]` identities.
  - A method named like a vendor method stays `[field]`, as before.
- **`[field-set]` needs one vendor-owned field.** A type of one-word names (`{ currency, weight, pallets }`, or an
  address such as `{ line1, city, postalCode, country }`) matched a vendor declaration casing aside and fired with no
  ownership test. That shape had no `ownedBy` filter.
- **`[field-list]` across one vendor module.** The elements may come from several declarations of one module, for
  example a request and a response. Every element must still be a vendor field (exact spelling, at least 3, at least one
  vendor-owned). A list that only partly overlaps the vendor fields stays clean.
- **Object literals as lists.** An object literal's string values and its keys are read as two more lists
  (`context: 'object-value'` and `'object-key'`), each tested like an array.
- **Unchanged:** the `literal`, `error` and `decl` parts. The new `listed` terms carry `name:` tokens only, and the
  literal part matches only `kind: 'literal'` core terms against `lit:` tokens, so the counted shapes cannot meet them.
- `rule-messages.ts` gives `field-group` the field-set fix text.

Generic one-word names stay generic: none of the new readings counts a `generic` term as the vendor's own. No rule
keys on a case's names.

## Before and after on the development cases

`dev-cases.ts` covers 64 cases: this folder's 15 new fixtures, the HX-RULES-V3 H11 cases and the HCAL-06 H11 cases,
plus their bases. Outputs are in `results/dev-before.json` and `results/dev-after.json`. "Hit" means a finding in the
labelled file.

| Group | Before | After |
|---|---|---|
| New d positives (6: mixed list, object values ×2, object keys, mixed type, copied type) | 2/6 hit (`field`; `field`+`field-set`) | **6/6**, each with a d word only (`field-list` ×4, `field-group`, `field-group`+`field-set`) |
| New c positives (2) | 2/2 `field` | 2/2 `field` only |
| New hard twins (7) | 1 FP (`H11d-type-twin2`, `[field-set]` on `currency, weight, pallets`) | **0/7** |
| HCAL-06 c (4) | 4/4 `field` | 4/4 `field` only |
| HCAL-06 d (4) | 4/4, 3 as `field`+`field-set` | 4/4, `field-group`+`field-set` ×3, `field-list` ×1, no `field` |
| HCAL-06 a, b, twins, legit, bases | unchanged | unchanged (all ok) |
| HX-RULES-V3 H11 cases (decl, key, list) and bases | all ok | all ok, the same shape words |

**c and d now separate on every development case.** Every c positive reports exactly `[field]`. Every d positive
reports only d words (`field-group`, `field-set`, `field-list`) and never `[field]`. This holds for 6 c and 13 d
positives, counting the 3 HX-RULES-V3 list cases.

Fixtures are in `freight-booking/` and `parcel-lockers/`, overlaid on the `experiments/hx-rules-v3-dev/` bases, with
answer keys in `labels.json`. Tests: `tests/unit/v15-instrument/h11d-field-names.test.ts`.

## The Hexagonal study's kept trees (the gate)

`evaluate-study.ts` scores the seed (step-00) and the final step of all 220 sessions of `results/v15-hx-study` the way
the study scored them: the task's spec, with the seed as `baseline`. It reads the trees extracted with `git archive`.
`compare-study.ts` gives the diff and the counts. Outputs are in `results/study-before.json`,
`results/study-after.json` and `results/study-compare.json`.

**Counted-shape diff (`[literal]`, `[error]`, every finding string including file, subject and line, per session and
tree): empty, 0 lines.** The literal count is 141 and the error count is 24, the same before and after.

Other shapes, findings per arm (seed / final / identities new on the final step against the seed):

| Arm | Shape | Before | After |
|---|---|---|---|
| combined (110) | field-set | 10 / 0 / 0 | 0 / 0 / 0 |
| none (110) | field | 0 / 33 / 33 | 0 / 18 / 18 |
| none | field-group | — | 0 / 4 / 4 |
| none | field-set | 10 / 17 / 7 | 0 / 7 / 7 |
| none | literal, error (counted) | 0 / 141 / 141, 0 / 24 / 24 | identical |

- The 20 seed `field-set` findings are all `hxpb3` `Evening { evening, seatsFree, telescope }`, found on a clean seed.
  That is the generic field-set false positive, and the ownership test removes it.
- The 4 `field-group` findings are f16 (`EuroRate`, `ExchangeRate`, `UsableRate`, each with `minorUnits` and `asOf`)
  and f14 (`GeocodedAddress`). They replace per-field `[field]` rows on the same types.
- The remaining `[field]` findings are single vendor fields on one type: f2 `chargeId`, hxb1 `shortfallCents`, hxb2
  `waitMin`, and two hxa2 `CoverPolicy.missingDocs` where the type also has a field of its own.

## Limits

- **Development fit only** (see the top). The two HCAL-07 misses were rebuilt from the report's prose, not from its
  files.
- **The c/d line is a count.** A c change that renames two fields of one type reads as d (`field-group`). A d copy that
  holds only one vendor-owned name, the rest being generic or baseline names, reads as c, unless every field of the
  type is a vendor field (then it is `field-set` and `[field]` is dropped).
- Exact spelling is needed for `field`, `field-group` and `field-list`. A copied type whose names were all re-cased
  into the core's style is seen only by `field-set`.
- `field-group` and `field-set` can both fire on one type. They share the subject, so they are one identity.
- The baseline now also holds the names of the baseline core's object keys and values. A vendor field that the
  baseline core already used as an object key is therefore owned and not reported.
- Object keys and values are read in any core object literal. On the study trees this added no finding, but a core that
  builds vendor-shaped objects is now reported (as d).
- Not addressed, and outside H11-d: numeric vendor codes (`code === 2001`) are never tokenised (the lexicon reads
  string literals only). Fixing that would change the counted `[literal]` shape.
- `HX_MIRROR2_SHAPES`, `rule-set.ts` rows and counted lists are unchanged. Counting `field-group` or `field` would need a
  new registration and an admission on a blind set.

## Reproduce

```
npx tsx experiments/h11d-dev/dev-cases.ts > experiments/h11d-dev/results/dev-after.json
git archive origin/results/v15-hx-study results/v1.5-hx-study/hx-study/sessions results/v1.5-hx-study/hx-study/scores/scores.json | tar -x -C <scratch>
npx tsx experiments/h11d-dev/evaluate-study.ts <scratch>/results/v1.5-hx-study/hx-study > experiments/h11d-dev/results/study-after.json
npx tsx experiments/h11d-dev/compare-study.ts experiments/h11d-dev/results/study-before.json experiments/h11d-dev/results/study-after.json > experiments/h11d-dev/results/study-compare.json
```

The `before` files were produced the same way at `origin/main` `7a9eb3737`, before the rule change.
