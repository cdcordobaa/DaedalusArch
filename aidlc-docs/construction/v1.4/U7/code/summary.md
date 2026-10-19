# U7 Code Generation Summary: meaning analysis script (C3m)

**Unit:** U7, map part C3m meaning (P3). **Design:** `aidlc-docs/construction/v1.4/U7/functional-design/design.md`. **Plan:** `aidlc-docs/construction/v1.4/U7/plan.md` (every box ticked).
**Closes:** blocker B5 of `ops/notes/mean-01-codebook-and-sample.md` §11. The analysis script exists and has been tested on simulated sheets. No labels exist yet, so none were read.
**Not touched:** `ops/`, `aidlc-docs/audit.md`, `aidlc-docs/aidlc-state.md`, `scripts/lib/stats.ts`, `scripts/v1.3/lib/labelling/audit.ts`, `src/`, `results/v1.3-meaning/labels/`. No registered figure changes (N115 and the ledger are neither read nor written).

## 1. Files created

| File | Content |
|---|---|
| `scripts/v1.3/lib/meaning/types.ts` | Data contracts (design §3), protocol constants (seed 20261018, 10,000 resamples, N 784, 60 items, min n 54, gate 0.60), and the tolerance 1e-9. |
| `scripts/v1.3/lib/meaning/load.ts` | `loadSample`, `loadSheet`, `checkDistinct`, `MeaningInputError`, the strict CSV tokenizer, and the BR-07 hash list (BR-01 to BR-07, BR-09). |
| `scripts/v1.3/lib/meaning/bootstrap.ts` | `itemBootstrap` and `stratifiedClusterBootstrap` on `createRng` and `quantileSorted` (BR-40 to BR-42). |
| `scripts/v1.3/lib/meaning/agreement.ts` | The κ block on one field (BR-10 to BR-19). |
| `scripts/v1.3/lib/meaning/precision.ts` | `stratifiedShare`, `precision`, `readingGuide` (BR-20 to BR-29, BR-08). |
| `scripts/v1.3/lib/meaning/crosstab.ts` | The A × B table and the reason-code counts (BR-30, BR-31). |
| `scripts/v1.3/lib/meaning/analyse.ts` | Builds one `MeaningAnalysis` from the loaded inputs (design §5 flow). New file; see deviation D1. |
| `scripts/v1.3/lib/meaning/report.ts` | `renderMarkdown`, `renderJson`, `displayPath`, `statusLine` (BR-43, BR-50 to BR-54). |
| `scripts/v1.3/lib/meaning/simulate.ts` | `simulateSheets` (BR-60). |
| `scripts/v1.3/meaning-analysis.ts` | The CLI: `analyse` and `simulate` (design §6). |
| `tests/unit/scripts/v1.3/meaning-analysis.test.ts` | 41 tests: T1 to T22 and the real-sample loader check. |
| `tests/fixtures/v1.3-meaning/sample-60.csv`, `sample-10.csv`, `README.md` | Synthetic samples in the real column layout. |
| `results/v1.3-meaning/mean-01-sample.csv` | The current MEAN-01 draw (sha256 prefix `d4697ec5377d6fdc`, as codebook §6 records). It was untracked; plan step 9.2 allows committing it with U7. The real-sample test needs it, and it fails, never skips, if the file is missing. |

## 2. CLI

```bash
npx tsx scripts/v1.3/meaning-analysis.ts analyse \
  --sample results/v1.3-meaning/mean-01-sample.csv \
  --rater  results/v1.3-meaning/labels/answers-rater.csv \
  --author results/v1.3-meaning/labels/answers-author.csv \
  --primary A_practitioner \
  [--seed 20261018] [--resamples 10000] [--expect-sample-sha256 d4697ec5377d6fdc] [--out <dir>]

npx tsx scripts/v1.3/meaning-analysis.ts simulate \
  --sample results/v1.3-meaning/mean-01-sample.csv --table-a 20,10,5,25 --table-b 24,6,6,24 --seed 1 --out <scratch dir>
```

`--primary` is required and has no default (L4 is open). Exit codes: 0 written; 2 input error or refused `--out` (every problem listed); 1 any other failure. Run from the repo root.

## 3. Tests and checks

| Check | Result |
|---|---|
| `npx jest --maxWorkers=2 tests/unit/scripts/v1.3/meaning-analysis.test.ts` | 41 / 41 pass (about 10 s; the 10,000-resample determinism test takes about 6 s) |
| `npx jest --maxWorkers=2 tests/unit/scripts/u5b/stats.test.ts` | 18 / 18 pass (no regression in the shared helpers) |
| `npx tsc -p tsconfig.scripts.json` | 0 errors |
| `npx eslint tests/unit/scripts/v1.3/meaning-analysis.test.ts` | Only `no-unsafe-call` and `no-unsafe-member-access` on `expect(...)`. The linter cannot resolve the jest types, and sibling tests show the same errors (for example `tests/unit/scripts/v1.3/convergent.test.ts`). No other rule fires. |
| Neo4j, network, model or API | None used |

The hand-computed cases of design §8 all hold:
- **T1:** κ is 0.50 and the gate fails.
- **T2:** κ is exactly 0.60 and passes under the tolerance.
- **T3:** κ is 1, with interval [1, 1].
- **T4:** κ is −0.0526, AC1 is 0.8895, the prevalence index is 0.90, and the BR-17 line prints.
- **T5:** κ is undefined with no crash, the interval is undefined, and the BR-17 line prints.
- **T9:** p̂ = 0.28 and the unweighted share is 0.60.
- **Real draw:** 60 items, 18 strata, Σ N_h = 784, 4 `testOrMock` items, 2 single-project strata (FF-DS01, FF-DT02), Kish n_eff 38.83.

**Dry run (plan step 10).** Simulated sheets went to a scratch directory outside the repo (`--table-a 20,10,5,25 --table-b 24,6,6,24 --seed 1`), and the analysis ran on the real sample:
- **Primary A:** κ = 0.500, FAIL; B reported as PASS (not gated).
- **Primary B:** κ = 0.600, PASS; A reported as FAIL (not gated).
- **Banner:** SYNTHETIC on both.
- **Clean output:** no `NaN`, and no `/Users/`, `/Volumes/` or `/private/` string in any output. Scratch files print as `<outside repo>/<basename>`.
- **Determinism:** a second run gave byte-identical `analysis.json` and `analysis.md`.

Nothing from the dry run is committed.

## 4. Script hashes (for the codebook §12 record)

sha256 of the files every output records (BR-07), at this commit:

| File | sha256 |
|---|---|
| `scripts/lib/stats.ts` | `6afc69b679af202e3bc4ff1e57ad5f0f8a84961c82e3357d2f58ee096e8a0fdf` |
| `scripts/v1.3/lib/labelling/audit.ts` | `ea8cf86b27dcd68bf0a11abe6886f0484dd49d0d59917cb34fb5bbe381202539` |
| `scripts/v1.3/lib/meaning/agreement.ts` | `6f81cf856f0990d2586f4a1ba61ffe3970ce15832d1f08e79927c239a03bfb6d` |
| `scripts/v1.3/lib/meaning/analyse.ts` | `1498332efa27bb4552a91a4eec023d8845c59f537967b2aaf62be5b2476a5ef2` |
| `scripts/v1.3/lib/meaning/bootstrap.ts` | `72e79a3933d9adf9676e528b77faf8e0734c6226e124209735adf18a53f1b109` |
| `scripts/v1.3/lib/meaning/crosstab.ts` | `47c5c932f49e04adc1dfddc6cad2b13761806740d26a68dbc25485d8ce2fd2be` |
| `scripts/v1.3/lib/meaning/load.ts` | `87607d351727fb26cf343cb3d0c4c7cb1b5e96c9725283e99c2817d593b07316` |
| `scripts/v1.3/lib/meaning/precision.ts` | `f606aabb35be76f1fcfee26a058441c4ec0c226515bb4ae119680aa64636da6b` |
| `scripts/v1.3/lib/meaning/report.ts` | `628117f8fa85649cad62051e9a280049dd14772c9b1776dd121fa595991cfd58` |
| `scripts/v1.3/lib/meaning/simulate.ts` | `9f63f70a2eba758771bea9d917f83d6720b73ba77e2cbc687f4cc18242285dee` |
| `scripts/v1.3/lib/meaning/types.ts` | `ddee2755d33b83f43025424c7aaf609f3aef57ca19e283144b68ebd49725b18f` |
| `scripts/v1.3/meaning-analysis.ts` | `e8506968db1b2b80a109ef775c5257cfb769ea4d25bcd4203b24da068b460d6c` |

Any change to these files after review changes the hashes. Record the final ones at sign-off.

## 5. Deviations from the design

- **D1. New file `scripts/v1.3/lib/meaning/analyse.ts`.** It holds the orchestration, so `report.ts` only renders. It sits under `scripts/v1.3/lib/meaning/`, so BR-07 hashes it like the other files.
- **D2. `null` in JSON.** JSON has no `undefined`, so an undefined figure is `null` in `analysis.json`. The Markdown prints the word `undefined`, never `NaN` or `null` (BR-51).
- **D3. The NON-PROTOCOL line also prints on simulated sheets** when the seed or resamples differ. The design only requires it for non-simulated sheets, so this does more than asked and never less. `protocol: false` is set the same way in both cases.
- **D4. Rater-only mode is also `single-rater`.** Its status is `single-rater`, the report says "single-rater: agreement not computed", and the reading guide carries the "descriptive only" prefix too. The design names the prefix only for author-only mode. With one sheet there is no κ, so the stricter label is used for both.
- **D5. `loadSample` takes optional expectations** (`frameN`, `items`, defaulting to 784 and 60) so the 10-item fixture loads. The CLI always uses the protocol values.
- **D6. `--expect-sample-sha256` accepts a prefix of at least 16 hex digits.** This lets the codebook's 16-digit prefix `d4697ec5377d6fdc` be used directly. A full 64-digit hash also works.
- **D7. Usage errors exit 2.** A missing or invalid `--primary`, and other bad flags, exit 2 rather than 1. They are treated as input errors.
- **D8. Blank items in `simulate --blank k`.** The rater answers `no` on both fields of those items. The design does not say what the rater answers there.
- **D9. T5 test data.** T5 uses a B table of 28/1/1/30 so that the two simulated files differ. With identical sheets, BR-06 correctly stops the run.

## 6. Open author questions (from design §10, unchanged)

Q1 (L4 primary field) to Q5 still need the author's answer, or acceptance of their defaults, at codebook sign-off and before the first label commit:
- **Q1:** the primary field, given with `--primary`.
- **Q2:** per-rule intervals are unweighted Wilson.
- **Q3:** an undefined κ does not pass the gate.
- **Q4:** a stratum left with no answered item is left out and named.
- **Q5:** the cluster is the (stratum, project) cell.

The code implements each default, and none of them blocks the code.

## 7. Integration fixes and open test TODOs (2026-10-18)

Fixed before merge: the results guard (BR-54, BR-60) now makes both paths physical (realpath of the deepest existing ancestor) and compares them case-folded, so `Results/...` on a case-insensitive volume and a symlinked route into the repo are refused. `displayPath` uses the same physical paths, so repo inputs given through a symlink keep their repo-relative provenance (BR-53). New tests: T21 `Results/...` case, a guard unit test (case, symlink, sibling, outside), and BR-17 absence when κ passes. The two hashes above are updated.

Low test gaps left as TODO (no code defect known):
- [ ] BR-25: values of the sensitivity rows ('yes by both raters', 'rater's unsure dropped', 'items the rater coded M dropped') on a sheet that carries M codes.
- [ ] BR-24: Kish n_eff with blank items (weight N_h/m_h).
- [ ] BR-17: no note when the prevalence index is below 0.5 with AC1 >= 0.60.
- [ ] BR-19/BR-27: per-style 2x2 counts and per-style yes/no/unsure/blank counts.
- [ ] BR-05: the warning when the rater column differs across answered rows.
- [ ] BR-41/Q5: a project in two strata is resampled independently; sorted order of strata and cells.
- [ ] BR-42: undefinedResamples > 0 for p-hat inside a resample.
- [ ] D8 note: with --blank and --unsure-rater together, unsure conversions can land on blanked items, so fewer than k unsure items reach the κ table.
- [ ] Author to accept D6 (a 16+ hex prefix satisfies --expect-sample-sha256).
