# HCAL-06: blind admission set for H11 (revised), H11-SEM and H03

Sealed before any scoring. Brief: `BRIEF.md`. Seal: `SEAL.sha256` (cases), `RULES-FROZEN.sha256` (rule sources and
scorer), `SEAL.root` (root hashes and the verify commands). Scored once on 2026-10-29 (local) at `main` `dfb96bde1` with the
re-frozen hash (see below): `result.json`, `results/`, report `Docs/DiagnosticRuns/v15-hcal06-admission-2026-10-30.md`.

## Layout

```
<domain>/base/                 clean application: spec.yaml (with a domain glossary), tsconfig.json, vendor/<sdk>/, src/
<domain>/cases/<ID>/           only the files the case adds or changes, full contents (an overlay on base)
<domain>/labels.json           answer key for the domain's cases
```

Domains: `customs-brokerage` (vendor `clearwise-sdk`), `pharmacy-refills` (`rxclaim-sdk`), `print-shop`
(`printhub-sdk`). `npx tsc -p` passes on every base and on every case overlaid on a copy of its base.

## Counts

| Row | Positives | Clean | of which hard twins | Domains |
|---|---|---|---|---|
| H11 | 16 (a 4, b 4, c 4, d 4) | 8 | 4 | 3 |
| H11-SEM | 4 | 6 | 4 | 3 |
| H03 | 4 (in→out 1, out→out 2, driving→driving 1) | 6 | 2 | 3 |
| **Total** | **24** | **20** | **10** | 44 cases |

Per domain: customs-brokerage 14, pharmacy-refills 17, print-shop 13.

## Answer key

`labels.json` keeps the HCAL fields the scorer reads (`rule`, `label`, `file`, `note`) and adds three fields that the
scorer ignores:

- `line`: for a positive, the 1-based line in the labelled file where the violation is (the comparison, the
  declaration or the import). `null` for clean cases.
- `subshape`: `a`–`d` for H11 positives, `sem` for H11-SEM positives, else `null`.
- `kind`: `positive`, `twin`, `hard-twin` or `legit`.

For H11-SEM the labelled file and line are where the copied set is declared. The note names where the core branches on
it.

## Before scoring

- **Base check not run by the builder.** The builder is blind and ran no checker. In earlier sets the bases were
  scored clean before the seal. Here that check falls to the scoring session, before it scores any case. A base
  finding is recorded in `SEAL.root` and not repaired, as HCAL-05 did with its R-LOCK base finding.
- **H11-SEM has no row key** in the Hexagonal row map, so `experiments/cal-01/score.ts --rows hex` maps no rule to it:
  its positives would read as misses and its clean cases as passes. Scoring it needs a row key, or a scorer for the
  semantic layer, fixed before the seal is opened.
- Scorer, as for HCAL-03 to HCAL-05: `npx tsx experiments/cal-01/score.ts --dir experiments/hcal-06 --rows hex`.

## Re-freeze of the rule sources (2026-10-29, before any scoring)

`RULES-FROZEN.sha256` was taken at `main` `4d6b74ef7`. The set was sealed in `407c4f283` and merged to `main` (PR 439).
PR 440 (R-MIRROR-SEM, instrument `v1.5.4-mirror-sem`, merge `7a1856d9d`) then changed the instrument: 7 frozen files
differ (`consistency.ts`, `delivery/hub.ts`, `facts.ts`, `graph.ts`, `rule-messages.ts`, `rule-set.ts`,
`vendor-lexicon.ts`) and 2 new files fall under the selection rule (`mirror-sem.ts`,
`rules/r-mirror-sem-vendor-value-set.cypher`). No commit between the freeze and PR 440's merge touched the set's cases or
labels; the case seal (`SEAL.sha256`, root `70f9d0cad6038650`) still verifies. No one had scored the set or opened it
for rule work.

Disclosure: the set has been on `main` since its merge, where any session could read it. Rule builders were instructed
not to open it, and the instructions of the session that built R-MIRROR-SEM forbade it. PR 440 touches no file under
`experiments/hcal-06/`.

Before scoring, three preparation changes land in one PR: the row key `H11-SEM: ['R-MIRROR-SEM']` in the Hexagonal row
map; the live R-MIRROR-SEM judge in `experiments/cal-01/score.ts` for this scoring (the hub's CLI judge route and disk
cache, `claude-opus-5-5`, every call in a committed ledger); and the hub's `check_consistency` description. The rule
sources are then re-frozen with the same selection rule as the original (every tracked non-test `.ts` and `.cypher`
under `src/v15-instrument`, plus the scorer) at the head of that PR, into `RULES-FROZEN-2.sha256`. Scoring uses the
re-frozen hash, not the original, and verifies it first at the merged commit.
