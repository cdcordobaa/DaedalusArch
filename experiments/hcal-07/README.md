# HCAL-07: blind admission set for H11 (a–d), H11-SEM, H03 and H07

Sealed before any scoring. Not scored yet. Brief: `BRIEF.md`. Seal: `SEAL.sha256` (cases), `SEAL.root` (root hash and
the verify command). `RULES-FROZEN.sha256` is a stub: the rules were being changed while this set was built, so the
rule hash is taken at scoring time, after the rules PR merges and before any case is scored (see below).

## Layout

```
<domain>/base/                 clean application: spec.yaml (with a domain glossary), tsconfig.json, vendor/<sdk>/, src/
<domain>/cases/<ID>/           only the files the case adds or changes, full contents (an overlay on base), plus spec.yaml
<domain>/labels.json           answer key for the domain's cases
```

Domains: `kennel-boarding` (vendor `furpay-sdk`), `greenhouse-nursery` (`palletpath-sdk`), `locksmith-dispatch`
(`crewclock-sdk`, plus the in-tree HTTP library `http-kit`). `tsc -p` (TypeScript 5.9.3, strict) passes on every base
and on every case overlaid on a copy of its base: 53 trees, checked one at a time.

## Counts

| Row | Positives | Clean | of which hard twins | Domains with a positive |
|---|---|---|---|---|
| H11-b, vendor error vocabulary | 6 (class-name copy 2, object-literal keys 2, literals 2) | 4 | 2 | 3 |
| H11-d, vendor field names | 6 (declared fields 2, string array or tuple 2, mapping table 2) | 4 | 2 | 3 |
| H11-a, literals (regression) | 2 | 2 | 0 | 2 |
| H11-c, renamed copy (regression) | 2 | 2 | 2 | 2 |
| H11-SEM | 2 | 3 | 0 | 2 |
| H03 | 4 (out→out 2, of which one is a second adapter of the same port; in→out 1; driving→driving 1) | 6 | 2 | 3 |
| H07 | 3 (status numbers on domain errors, status numbers as a use case result, HTTP library import in a use case) | 4 | 1 | 3 |
| **Total** | **25** | **25** | **9** | 50 cases |

Per domain: kennel-boarding 15, greenhouse-nursery 17, locksmith-dispatch 18.

H11-a to H11-d all carry `"rule": "H11"` with the sub-shape in `subshape`, as in HCAL-06. The variants asked for:

- H11-b: kennel `H11-pos1` (core error renamed to the vendor class `FurPayDecline`), locksmith `H11-pos1` (core error
  named `SchedulingConflict`, the vendor class name with no brand prefix); kennel `H11-pos2` and nursery `H11-pos1`
  (vendor decline or reject codes as object-literal keys in the core); nursery `H11-pos2` and locksmith `H11-pos2`
  (vendor error codes as literals, in a comparison and in a `switch`).
- H11-d: kennel `H11-pos3` and locksmith `H11-pos3` (declared fields, on a domain type and on a port result type);
  kennel `H11-pos4` (tuple `as const`) and nursery `H11-pos3` (`string[]` column list); nursery `H11-pos4` (core-to-vendor
  field table, vendor names as values) and locksmith `H11-pos4` (vendor-to-core table, vendor names as keys).
- Clean shapes: the same table in the adapter (kennel `H11-twin1`, nursery `H11-twin2`), core names in the same tuple
  (kennel `H11-twin2`), a core error name (locksmith `H11-twin1`), the core's own refusal value (nursery `H11-twin1`), a
  glossary word shared with a vendor code (nursery `H11-legit1`, overweight), a snake_case column list of core terms
  (locksmith `H11-legit1`), core field names (locksmith `H11-twin2`).
- H03 shared helpers: driven side `adapters/out/shared` in kennel `H03-twin1` and nursery `H03-twin2`; driving side
  `adapters/in/shared` in nursery `H03-twin1`.
- H07 business status: nursery `H07-legit1` adds a domain field `statusCode` holding the plant passport status
  (`PP-PENDING`, `PP-CLEAR`, `PP-HOLD`), next to the aggregate's own `status`. Every base aggregate has a business `status`.

## Answer key

`labels.json` keeps the HCAL fields the scorer reads (`rule`, `label`, `file`, `note`) and the three HCAL-06 extras
(`line`, `subshape`, `kind`), and adds one more field that the scorer should ignore:

- `line`: for a positive, the 1-based line in the labelled file where the violation is (the declaration, the first
  vendor key, the comparison or the import). `null` for clean cases.
- `subshape`: `a`–`d` for H11 positives, `sem` for H11-SEM positives, else `null`.
- `kind`: `positive`, `twin`, `hard-twin` or `legit`.
- `row`: the reporting row, `H11-a` to `H11-d` for H11 cases (clean ones too), else the rule key. Use it to count the
  clean H11 cases per sub-shape; `subshape` stays `null` on clean cases, as in HCAL-06.

For H11-SEM the labelled file and line are where the copied set is declared. The note names where the core branches on
it.

### Glossary key per case

Every case ships a `spec.yaml`. Its `glossary` lists the domain-owned terms, as in HCAL-06; a case whose cleanness
rests on a domain-owned term adds that term there. The file then ends with a glossary key for the case, written as a
YAML comment so that the spec parser does not read it:

```
# Glossary key (HCAL-07 answer key for case <ID>). A YAML comment: the spec parser does not read it.
#   vendor_terms: [...]
#   core_terms: [...]
#   rationale: "..."
```

The key is the answer key, not part of the spec. The builder could not check how the instrument reads the spec. If
any route hands raw spec text to a model (a judge or a labeller) without parsing it as YAML, the key would leak the
label. The scoring session checks this before scoring. If it does leak, the session strips the comment block from
each case's `spec.yaml` in the scoring copy, and records that it did.

## Before scoring

- **Rules hash not taken.** The rules were changing while the set was built. After the rules PR merges, and before any
  case is scored, the scoring session writes `RULES-FROZEN.sha256` with HCAL-06's selection rule: every tracked
  non-test `.ts` and `.cypher` under `src/v15-instrument`, plus the scorer. It then adds the rules root to `SEAL.root`.
- **Base check not run by the builder.** The builder ran no checker. The scoring session scores the three bases first.
  It records any base finding on a line in `SEAL.root` and does not repair it, as HCAL-05 and HCAL-06 did.
- **Row keys.** The labels use the row keys `H03`, `H07`, `H11` and `H11-SEM`, all used by earlier sets. The builder did
  not open the scorer's row map. The scoring session confirms that each key maps to a rule at the frozen commit.
- **Labelling choices to review when the set is opened** (they were fixed before the seal and are not changed after it):
  - H03 "more than one outbound adapter per port" is read as two adapters of one port that are coupled to each other.
    In locksmith `H03-pos1`, the CrewClock gateway imports the rota adapter and builds it itself. In `H03-twin1`, the
    same two adapters exist, but the gateway takes the fallback as the port interface and `main.ts` wires it. That
    case is labelled clean, because two independent adapters for one port are normal in a hexagonal design.
  - locksmith `H11-pos1` names a new core error `SchedulingConflict`, the vendor's class name with no brand prefix.
    Without the vendor SDK, the name would pass as plain English. It is labelled a violation because the name is
    copied from the vendor.
  - kennel `H11-twin3` and `H11-twin2` use snake_case forms of core terms (`deposit_ref`, `amount_held`, ...). They are
    clean by the glossary, although the casing looks like a vendor's.
  - nursery `H11-pos1` is labelled `b` (vendor reject codes as object-literal keys). The same table also works as a
    retry policy in the domain, so it reads as vocabulary and as logic.

## Verify the seal

```
(cd experiments/hcal-07 && shasum -a 256 -c SEAL.sha256)
```

## Label-leak check (2026-10-29, before any scoring)

Every route from a case's `spec.yaml` into the instrument, at `main` `d452ca0aa` (instrument `v1.5.5-hx-rules-v3`):

- **R-MIRROR-SEM judge (the only model call).** `domainTextOf` in `src/v15-instrument/mirror-sem.ts` parses the spec
  with `YAML.parse`, drops the instrument's own sections and re-serialises the rest with `YAML.stringify`. Parsing drops
  comments, so the glossary key does not reach the prompt. (If parsing failed, the fallback drops every `#` line.) The
  `glossary` entries do reach it, as intended.
- **The admission scorer** (`experiments/cal-01/score.ts`). It reads `labels.json` only to score. The frozen check gets a
  spec rebuilt with `YAML.parse` and `YAML.stringify`, so no comments. No model is called outside the judge.
- **R-MIRROR2's stoplist: the key leaks here.** `specTokens` in `src/v15-instrument/vendor-lexicon.ts` reads the raw
  spec text, comments included, and splits it into tokens. A vendor term whose token appears in the spec is marked
  `ownedBy: 'spec'` (for declaration names, `declOwnedBy: 'spec'`), and the rule then does not fire on it. The key lists
  each case's vendor terms, so it would silence R-MIRROR2 on exactly the terms it should catch.
- No other rule reads the spec's glossary or comments (`glossary` appears only in `mirror-sem.ts`). Code comments in the
  case and base sources carry no label words.

So the set is scored from a scoring copy, `experiments/hcal-07/scoring-copy.ts`. Bases, labels and every case file
other than `spec.yaml` are copied unchanged. In each case's `spec.yaml` the trailing glossary key is removed: the header
line `# Glossary key (HCAL-07 answer key for case <ID>).` (its id must match the folder), every line after it (all of
them must be comments or empty), and the empty lines just before it. The file then ends with one newline.
`SCORING-COPY.sha256` holds the sha256 of the 50 stripped specs. The script checks the copy it writes against that
file. After the strip, 44 case specs are byte-identical to their base spec. The other 6 add glossary terms, as the
README says above.
