# HCAL-08: held-back calibration set for the v1.5.8 to v1.5.10 Hexagonal shapes

Built and sealed by one blind session on 2026-11-03 (UTC). Scored once on 2026-11-03 (record `result.json`, report `Docs/DiagnosticRuns/v15-hcal08-admission-2026-11-03.md`). Brief: `BRIEF.md`. Seal: `SEAL.sha256` (every
file under the three domains), `SCORING-COPY.sha256` (the scoring copy), `SEAL.root` (roots, script hashes, the rule
hash stub). Check with `experiments/hcal-08/verify-seal.sh`.

## Layout

```
<domain>/base/                 clean application: spec.yaml (with a domain glossary), tsconfig.json, vendor/<sdk>/, src/
<domain>/cases/<ID>/           spec.yaml (with the builder glossary key) and only the files the case adds or changes
<domain>/labels.json           answer key for the domain's cases
```

Domains: `glacier-guiding` (vendor `icetrail-sdk`), `orchard-cooperative` (`pressmark-sdk`), `luthier-workshop`
(`bowcraft-sdk`). Cases never delete a base file; where a case moves a file, the base copy stays in the overlay.

`check-compile.sh [tsc]` type-checks every base and every case overlaid on a copy of its base: 61 trees, all pass with
tsc 5.9.3 strict and the options of HCAL-06. Two cases (`orchard-cooperative` `EDGE-pos2` and `EDGE-twin2`) use
`import x = require()`, which tsc refuses under `"module": "ESNext"`. They ship a `tsconfig.json` that changes only
`module` to `"Preserve"`. The earlier format has no behaviour test, so none is added.

## Counts

| Row | Positives | Clean | of which hard twins | Domains |
|---|---|---|---|---|
| HX8-WORD | 6 (field 3, value 3) | 6 | 6 | 3 |
| HX8-SET | 6 | 6 | 6 | 3 |
| HX8-KEY | 6 | 7 | 7 | 3 |
| HX8-EDGE | 11 (a 2, b 2, c 3, d 2, e 2) | 10 (a 2, b 2, c 3, d 1, e 2) | 10 | 3 |
| **Total** | **29** | **29** | **29** | 58 cases |

Per domain: glacier-guiding 19, orchard-cooperative 19, luthier-workshop 20.

## Answer key

`labels.json` keeps the HCAL fields the scorer reads (`rule`, `label`, `file`, `note`) and the extra fields of
HCAL-06: `line` (1-based line of the labelled file for a positive, else `null`), `subshape` and `kind`. `rule` holds
this set's row key. `subshape` is `field`/`value` for HX8-WORD, the declaration form for HX8-SET, the lookup form for
HX8-KEY and `a`–`e` for HX8-EDGE (the sub-cases in `BRIEF.md`).

## Glossary key and scoring copy

Each case `spec.yaml` ends with the builder's glossary key, a comment block that starts with the line
`# --- HCAL-08 builder glossary key (not part of the spec; stripped in the scoring copy) ---` and names the vendor
terms, the core terms and the rationale. A reader of the raw spec text would see it, so the set is scored from the
scoring copy: `scoring-copy.sh <empty dir>` copies the three domains and removes the header line, every line after it
and the empty lines before it, then checks the result against `SCORING-COPY.sha256`. After the strip, 45 case specs
are byte-identical to their base spec. The other 13 add a glossary term or an adapter folder, as their notes say.

## Before scoring

- **Base check not run by the builder.** The scoring session runs it before any case and records a base finding in
  `SEAL.root`, not repaired.
- **Row keys.** The four `HX8-…` keys are not in the instrument's row map. They need a mapping to rules before the seal
  is opened.
- **Rule hash.** `RULES-FROZEN.sha256` is left to the scoring session (stub in `SEAL.root`); `verify-seal.sh` checks it
  once it exists.

## Labels to look at (builder's flags, before the seal)

- **SET twins with coincidental words** (`SET-twin2` in all three domains, glacier `SET-twin1`): each core set holds
  one word the vendor also uses, and the spec glossary declares the set as the domain's. Under HX8-WORD they would be
  clean by the glossary.
- **Clean by the glossary alone**: glacier `KEY-twin3`, orchard `KEY-twin2` (vendor-keyed lookup, keys declared as
  ours) and `WORD-twin1` in all three domains.
- **HX8-EDGE sub-case e positives** (glacier `EDGE-pos4`, luthier `EDGE-pos4`): the moved adapter also holds the
  vendor-to-core mapping code, now inside a core layer by the spec. The label is the SDK import.
- **glacier `SET-pos1`**: after the cast, the aggregate compares the copied values with `===`; the label is the
  declaration of the copied set.

## Row map (scoring session, 2026-11-03, before any case is scored)

Written from the PR records only (PR 483, v1.5.8; PR 485, v1.5.9; PR 490, v1.5.10) and the instrument's rule headers,
before any case, label note or glossary key was opened. It is `HCAL08_ROW_RULES` in `experiments/cal-01/score.ts`,
used with `--rows hcal08`. A row entry `RULE[shape]` counts a finding of that rule with that shape only. R-MIRROR2's
shape is the word its evidence starts with. R-MIRROR-SEM's form is read from its judged candidate: `C` when the core
set is a core lookup's key set (`coreKind` `keys`, v1.5.10), and `A` otherwise (v1.5.9, a core value set filled from
vendor text).

| Row | Mapped rules | Source |
|---|---|---|
| HX8-WORD | R-MIRROR2 `[word]` | PR 483 (t03: one-word vendor values; one-word vendor field names left out) |
| HX8-SET | R-MIRROR-SEM form A; R-MIRROR2 `[literal]` and `[error]` (the counted R-MIRROR2 shapes, `HX_MIRROR2_SHAPES.i`) | PR 485 |
| HX8-KEY | R-MIRROR-SEM form C | PR 490 |
| HX8-EDGE | R-AXA, R-PURE, R-COREIO, R-D9 (the v1.5 rules whose edges the v1.5.8 facts #3, #5, #8 and #17 feed); FF-S01, FF-S04, FF-P01 (the frozen dependency rules of H01/H02, the rows whose construct is a core file that depends on an adapter or a framework) | PR 483 |

- **Caught.** A positive is caught when a mapped rule (with its shape, where one is named) has a finding in the
  labelled file. **Flagged.** A clean case is flagged when a mapped rule has a finding anywhere in its tree. Each case
  is scored with its domain's base as the baseline, as in HCAL-06 and HCAL-07. Findings of rules outside a row's map
  are kept in the record (`other`) and reported, but they do not count for that row.
- **HX8-EDGE, two readings.** The row is scored against all seven rules above. The report also gives the reading
  restricted to the v1.5.8-fed rules (R-AXA, R-PURE, R-COREIO, R-D9). That reading is computed from the same record
  and needs no extra run. Sub-cases a–e are reported separately.
- **Uncounted rules are rows here.** R-MIRROR2 `[word]` and R-MIRROR-SEM are not in the Hexagonal study's counted list,
  and R-PURE and R-D9 are not Hexagonal-row rules. Admitting their shapes as rows is the purpose of this set. The
  admission itself changes no counted list.

## Rule freeze (2026-11-03, before any scoring)

`RULES-FROZEN.sha256` replaces the stub. It uses the selection rule of HCAL-06 and HCAL-07: every tracked non-test `.ts`
and `.cypher` under `src/v15-instrument`, plus the scorer. That makes 46 files, root `05bd4c36f9323d47`. The source is
this branch on `main` `b460c5ea8` (instrument `v1.5.10`), with the row-map scorer change. Compared with HCAL-07's list,
one file is new: `rules/r-inbyp-driving-adapter-uses-out-port.cypher` (v1.5.7). `verify-seal.sh` checks the hash.
