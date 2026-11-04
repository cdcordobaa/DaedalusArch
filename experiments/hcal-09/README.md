# HCAL-09: held-back calibration set, the HCAL-08 rows on new material plus H11-d, H06 and K10

Built and sealed by one blind session on 2026-11-04 (UTC). Not scored. Brief: `BRIEF.md` (committed before any case).
Seal: `SEAL.sha256` (every file under the four domains), `SCORING-COPY.sha256` (the scoring copy), `SEAL.root` (roots,
script hashes, the rule hash stub). Check with `experiments/hcal-09/verify-seal.sh`.

## Layout

```
<domain>/base/                 clean project: spec.yaml (with a domain glossary), tsconfig.json, package.json, README.md,
                               packages/<sdk>/ (the vendor SDK as a local workspace package), src/
<domain>/cases/<ID>/           spec.yaml (with the builder glossary key) and only the files the case adds or changes
<domain>/labels.json           answer key for the domain's cases
```

Domains: `harbor-pilotage` (vendor `tidewatch-sdk`), `bell-foundry` (`ingotline-sdk`), `apiary-pollination`
(`hivepulse-sdk`), all hexagonal; `stone-quarry` (`tarescale-sdk`), DDD in the CAL-03 format with three bounded
contexts (extraction, haulage, sales). Cases never delete a base file; where a case moves a file, the base copy stays in
the overlay.

Differences from the HCAL-08 layout, as the brief asks: the vendor SDK sits under `base/packages/<sdk>/` and the base
`package.json` declares `packages/*` as workspaces; tsconfig `paths` resolves the SDK by its bare name. Two bases also
use a path alias for their own folders (`@harbor/domain/*` in `harbor-pilotage`, `@apiary/*` in `apiary-pollination`),
used by the adapters. Each base carries noise files: a README, a `package.json`, an `.editorconfig` or `.nvmrc`, and
small helpers inside the layers (`harbor-pilotage` health controller and seed rows, `bell-foundry` message templates,
`apiary-pollination` request id helper, `stone-quarry` `shared-kernel/calendar.ts`, which nothing imports).

`check-compile.sh [tsc]` type-checks every base and every case overlaid on a copy of its base: 98 trees, all pass with
tsc 5.9.3 strict and the options of HCAL-08. Two cases use `import x = require()`, which tsc refuses under
`"module": "ESNext"`: `bell-foundry` `EDGE-pos3` and `EDGE-twin3` ship a `tsconfig.json` that changes only `module` to
`"Preserve"`, as HCAL-08 did. The earlier format has no behaviour test, so none is added.

## Counts

| Row | Catalog row | Positives | Clean | of which hard twins | Domains |
|---|---|---|---|---|---|
| HX9-WORD | (HCAL-08 HX8-WORD) | 6 (field 3, value 3) | 6 | 6 | 3 |
| HX9-SET | (HCAL-08 HX8-SET) | 6 | 6 | 6 | 3 |
| HX9-KEY | (HCAL-08 HX8-KEY) | 6 | 7 | 7 | 3 |
| HX9-EDGE | (HCAL-08 HX8-EDGE) | 11 (a 2, b 2, c 3, d 2, e 2) | 10 (a 2, b 2, c 3, d 1, e 2) | 10 | 3 |
| HX9-FIELD | H11-d | 6 | 6 | 6 | 3 |
| HX9-RULE | H06 | 6 | 6 | 6 | 3 |
| DX9-SET | K10 (R-D5S's row) | 6 | 6 | 6 | 1 |
| **Total** | | **47** | **47** | **47** | 94 cases |

Per domain: harbor-pilotage 29, bell-foundry 28, apiary-pollination 25, stone-quarry 12. DX9-SET covers two declared
`set` invariants with different owners (`bench-monthly-permit`, owner `Bench`; `truck-shift-allowance`, owner `Truck`),
three positives each; its positives place the check in an application service (2), a controller, a repository,
another aggregate and a domain service outside the owner's module.

## Answer key

`labels.json` keeps the fields of HCAL-08: `rule` (this set's row key), `label`, `file`, `line` (1-based line of the
labelled file for a positive, else `null`), `subshape`, `kind`, `note`, and adds `catalog` (`H11-d`, `H06` or `K10`) on
the three new rows. `subshape` is `field`/`value` for HX9-WORD, the declaration form for HX9-SET, the lookup form for
HX9-KEY, `a`–`e` for HX9-EDGE, the variant (declared field, string list, mapping table) for HX9-FIELD, the kind of rule
or of technical work for HX9-RULE, and the place of the check for DX9-SET. Lines were computed from the case files by
the generator, not typed by hand.

## Glossary key and scoring copy

Each case `spec.yaml` ends with the builder's glossary key, a comment block that starts with the line
`# --- HCAL-09 builder glossary key (not part of the spec; stripped in the scoring copy) ---` and names the vendor
terms, the core terms and the rationale. The set is scored from the scoring copy: `scoring-copy.sh <empty dir>` copies
the four domains and removes the header line, every line after it and the empty lines before it, then checks the result
against `SCORING-COPY.sha256`. The script is HCAL-08's with only the header and the domain list changed. After the
strip, 80 case specs are byte-identical to their base spec. The other 14 add a glossary term or an adapter folder, as
their notes say; all 14 are clean cases (HCAL-08 had the same pattern with 13).

## Before scoring

- **Base check not run by the builder.** The scoring session runs it before any case and records a base finding in
  `SEAL.root`, not repaired.
- **Row keys.** The seven keys (`HX9-…`, `DX9-SET`) are not in the instrument's row map. They need a mapping to rules
  before the seal is opened. The four HX9 rows carry HCAL-08's definitions unchanged; HX9-FIELD, HX9-RULE and DX9-SET
  carry the catalog rows H11-d, H06 and K10.
- **Rule hash.** `RULES-FROZEN.sha256` is left to the scoring session (stub in `SEAL.root`); `verify-seal.sh` checks it
  once it exists.

## Labels to look at (builder's flags, before the seal)

- **Spec changes only in clean cases.** The 14 cases whose stripped spec differs from the base are all hard twins (see
  above). A reader that compares a case spec with its base could tell them apart.
- **Clean by the glossary alone:** `WORD-twin1` in all three hexagonal domains (squat, assay, queenless), `SET-twin2`
  in all three (one coincidental vendor word in a declared core set), `FIELD-twin1` in all three (snake_case field names
  the glossary declares), and harbor `KEY-twin3` (vendor-keyed Map whose keys the glossary declares as tariff classes).
- **SET positives that also compare.** harbor `SET-pos1` and bell `SET-pos1` compare the copied values with `===` after
  the cast; the label is the declaration of the copied set.
- **FIELD positives with single words inside.** harbor `FIELD-pos2`'s tuple holds `phase` next to three compound
  vendor field names, and apiary `FIELD-pos1`'s table holds `timestamp`. The label is the list or table.
- **HX9-EDGE sub-case e positives** (harbor `EDGE-pos4`, apiary `EDGE-pos3`): the moved gateway also holds the
  vendor-to-core mapping code, now inside a core layer by the spec. The label is the SDK import.
- **HX9-RULE positives** are labelled where the rule is decided. apiary `RULE-pos1` is a monitoring promise to growers
  (sensors per hive), labelled a business rule because the base glossary's `stocking` term owns it; harbor `RULE-pos1`
  sits on the same line as the vendor field read (`ukc_margin_m`).
- **DX9-SET:** `SETINV-pos6` puts the check in a domain service (`src/haulage/domain/policies/`) outside the Truck
  module; the row text says outside the owner aggregate, so it is labelled positive. `SETINV-twin6` lets the store sum
  the shift's tonnes in one query while the Truck compares and decides; labelled clean. In every DX9-SET positive the
  owner aggregate's own check is removed, so the check exists only outside it.
- **DX9-SET twins and other DDD rows.** `SETINV-twin2` validates input in the haul service (not a declared invariant),
  and `SETINV-twin3` makes the haul store refuse a duplicate weighbridge ticket (the `uniqueness` invariant, which the
  spec leaves to the store). They are built to keep K10; other DDD rows were not designed around.

## What the builder read, and when

Before the brief and the cases: the files listed in `BRIEF.md`, "What the builder read". In finding those, heading
greps over the HCAL-08 admission report, the Hexagonal study preregistration and the CAL-03 and HCAL-07 admission
reports showed some lines beyond the row definitions: rule names mapped to rows (HCAL-08 README row map; R-MIRROR2
shapes, R-ADAPTER-RULE and R-D5S named in the preregistration and the CAL-03 report), the HCAL-08 per-row results, and
one line of the HCAL-08 report saying that R-AXA reads a barrel placed directly in `adapters/out` as a package of its
own. No case was built around that line: no HCAL-09 barrel sits directly in `adapters/out`, except harbor `EDGE-pos1`'s
`src/adapters/out/index.ts`, a positive whose label is the application file that imports it.

After all 94 cases were built and compiled and before the seal: reading the end of `aidlc-docs/audit.md`, to copy the
entry format, showed the summaries of the v1.5.9 and v1.5.10 rule changes and of the HCAL-08 scoring session (which
names readings of the instrument on that set). No base, case or label changed after that read; the generator was not
run again.

After the seal: only the CI results and the PR page of the merge.
