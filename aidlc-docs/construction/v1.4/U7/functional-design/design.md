# U7 Functional Design: meaning analysis script (C3m)

**Cycle:** AI-DLC v1.4 instrument alignment. **Unit:** U7. **Map part:** C3m meaning (P3), `ops/01-instrument-map.md:178`. **Depth:** minimal (no NFR, infrastructure or user-story stages).
**Closes:** blocker B5 of `ops/notes/mean-01-codebook-and-sample.md` §11 ("the analysis script must exist and be tested on simulated sheets before the labels arrive").
**Does not close:** L4, R3–R5, V5, V6. Those are author decisions in the codebook; this unit only reads their effect through a CLI switch.

No labels exist. Nothing in this unit calls a model, an API or Neo4j. All tests use synthetic answer sheets.

---

## 1. Inputs read

| Input | Path | Role |
|---|---|---|
| Codebook and analysis plan | `ops/notes/mean-01-codebook-and-sample.md` §2, §3, §4, §9 | The specification. Every rule below cites its section. |
| Blank answer sheet | `audit/view/mean-01-answers.csv` | Answer format: `itemId,rater,A_practitioner,B_style_fidelity,why_not,note`, rows M01–M60. |
| Sample (the key) | `results/v1.3-meaning/mean-01-sample.csv` | Per item: `itemId, findingId, stratum, N_h, n_h, weight, wave, project, repo, style, ruleId, template, testOrMock, cycleViaBarrel, ...`. 60 rows, 18 strata, frame N = 784. |
| Rater packet and calibration | `audit/view/mean-01-rater-packet.md`, `audit/view/mean-01-calibration.md` | Context only. Calibration items C1–C5 never count (§4.3). |
| Stats helpers | `scripts/lib/stats.ts` | `createRng` (mulberry32), `wilson`, `wilsonProportion`, `cohenKappa`, `gwetAC1`, `quantileSorted`, `kishEffectiveN`, `Z_95`. Already unit-tested (`tests/unit/scripts/u5b/stats.test.ts`). |
| CSV parser | `scripts/v1.3/lib/labelling/audit.ts` `parseCsv` | RFC-4180-style parser with quoted cells, trims cells. |

Real answer files, when they exist (§7 of the codebook): `results/v1.3-meaning/labels/answers-author.csv` and `results/v1.3-meaning/labels/answers-rater.csv`.

## 2. Where the code goes (repo idiom)

The draw script `scripts/v1.3/meaning/mean01.py` is Python, but every interval, κ and bootstrap the thesis reports so far lives in the tested TypeScript helpers of `scripts/lib/stats.ts`, run with `tsx` and tested with jest. Re-implementing Wilson, κ, AC1 and the mulberry32 bootstrap in Python would create a second, untested copy of the statistics. So the analysis is TypeScript, following the `scripts/v1.3/spec-author-agreement.ts` + `scripts/v1.3/lib/spec-author-agreement.ts` pattern (thin CLI, pure library).

| File | Content |
|---|---|
| `scripts/v1.3/lib/meaning/types.ts` | Data contracts (§3). |
| `scripts/v1.3/lib/meaning/load.ts` | Parse and validate the sample and the answer sheets (BR-01 to BR-09). Pure: takes text, returns typed records or throws `MeaningInputError` listing every problem. |
| `scripts/v1.3/lib/meaning/agreement.ts` | κ block (BR-10 to BR-19). |
| `scripts/v1.3/lib/meaning/precision.ts` | Meaningful precision, sensitivities, per-rule, per-style (BR-20 to BR-29). |
| `scripts/v1.3/lib/meaning/crosstab.ts` | A×B table and reason codes (BR-30, BR-31). |
| `scripts/v1.3/lib/meaning/bootstrap.ts` | Item bootstrap and stratified cluster bootstrap (BR-40 to BR-43), on `createRng`. |
| `scripts/v1.3/lib/meaning/report.ts` | Markdown and JSON rendering (BR-50 to BR-54). |
| `scripts/v1.3/lib/meaning/simulate.ts` | Synthetic sheet generator for tests and the author's dry run (BR-60). |
| `scripts/v1.3/meaning-analysis.ts` | CLI: `analyse` and `simulate` (§6). |
| `tests/unit/scripts/v1.3/meaning-analysis.test.ts` | Unit tests (§8). |
| `tests/fixtures/v1.3-meaning/` | Small synthetic sample and sheets with hand-computed κ (§8). |

Nothing under `src/` changes. No change to `scripts/lib/stats.ts` is planned; if a helper is missing (for example the 3×3 κ, which `cohenKappa` already handles for any q×q table), it is added in `scripts/v1.3/lib/meaning/`, not in the shared file.

## 3. Data contracts

```ts
type Answer = 'yes' | 'no' | 'unsure';
type ReasonCode = 'T' | 'W' | 'F' | 'M' | 'C' | 'X';
type Field = 'A_practitioner' | 'B_style_fidelity';

interface SampleItem {          // one row of mean-01-sample.csv
  itemId: string;               // M01..M60
  findingId: string;
  stratum: string;              // e.g. FF-S01/ddd
  Nh: number; nh: number;       // frame and sample size of the stratum (integers)
  project: string; style: string; ruleId: string; wave: number;
  testOrMock: boolean; cycleViaBarrel: boolean;
}

interface AnswerRow {           // one row of an answer sheet
  itemId: string;
  rater: string;                // free id; 'simulated' marks a synthetic sheet
  A: Answer | null;             // null = blank
  B: Answer | null;
  whyNot: ReasonCode | null;
  note: string;
}

interface Sheet { role: 'rater' | 'author'; path: string; sha256: string; rows: Map<string, AnswerRow>; simulated: boolean }

interface AnalysisConfig {
  primary: Field;               // L4, from --primary (required, no default)
  seed: number;                 // 20261018 (codebook §4.7, §9.2)
  resamples: number;            // 10000
  frameN: number;               // 784, checked against Σ N_h
  minN: number;                 // 54 (codebook §4.5)
  gate: number;                 // 0.60
}
```

Output: one `MeaningAnalysis` JSON object (every number at full precision) and one Markdown file rendered from it. Markdown rounds to 3 decimals; JSON never rounds.

## 4. Business rules

### 4.1 Loading and validation

- **BR-01 Sample integrity.** The sample has 60 unique `itemId`s; per stratum, the row count equals `n_h`, and `N_h` is constant; Σ_h N_h = 784 and Σ_h n_h = 60. The rounded `weight` column is ignored; weights are always `N_h / n_h` from the integer columns (the CSV rounds 71/6 to 11.8). `testOrMock` and `cycleViaBarrel` are written by Python as the strings `True` / `False`; the loader accepts exactly those two spellings and rejects anything else (no truthiness coercion). With `--expect-sample-sha256 <hex>`, a sample whose sha256 differs stops the run (exit 2); the current draw's hash starts `d4697ec5377d6fdc`, as codebook §6 records.
- **BR-02 Answer values.** After trim and lower-casing, `A_practitioner` and `B_style_fidelity` must be `yes`, `no`, `unsure` or blank. Anything else (`Yes!`, `y`, `maybe`) is a hard error naming the item and the file. No silent coercion.
- **BR-03 Reason codes.** After trim and upper-casing, `why_not` must be one of T, W, F, M, C, X or blank. A code given when neither field is `no` is kept and listed as a warning, not dropped (the codebook says codes go with `no`; the analysis does not edit labels, §9.6).
- **BR-04 Item ids.** Every `itemId` in a sheet must exist in the sample. Duplicate ids are an error. Calibration ids (`C1`–`C5`) in a sheet are an error, since they never count (§4.3). Sample items absent from a sheet count as blank.
- **BR-05 Rater column.** Free text, the same on every non-blank row of one sheet (else a warning). A sheet whose rater value is `simulated` marks the whole run SYNTHETIC (BR-52).
- **BR-06 Two different sheets.** If the two files have the same sha256, the run stops (the same file passed twice).
- **BR-07 Hashes.** The sha256 of the sample CSV, each sheet and each script file under `scripts/v1.3/lib/meaning/`, `scripts/v1.3/meaning-analysis.ts`, and the two shared files the numbers depend on, `scripts/lib/stats.ts` and `scripts/v1.3/lib/labelling/audit.ts`, is recorded in the output (codebook §9: "its hash recorded"). Without the last two, an edit to a shared helper after the labels arrive would change the figures while every recorded hash stayed the same. The CLI hashes files read from the repo root (`git rev-parse --show-toplevel`); the library takes the file contents as input and stays pure.
- **BR-08 Single-rater mode.** With `--author` only and no `--rater`, the run makes the author's precision figures only, labelled "single-rater, descriptive, not validated" (§9.7), and no κ block. With `--rater` only, it makes the precision block and states that agreement was not computed.
- **BR-09 CSV shape.** `parseCsv` of `scripts/v1.3/lib/labelling/audit.ts` silently pads short rows and drops cells beyond the header, so a note with an unquoted comma would lose text and a shifted row would be misread. The loader therefore checks the shape itself, in `load.ts` (no change to `audit.ts`): a leading UTF-8 BOM is stripped; the header must equal the expected columns exactly (for sheets `itemId,rater,A_practitioner,B_style_fidelity,why_not,note`; a one-column header, as a `;`-separated export from a Spanish-locale spreadsheet gives, is named as such); every non-blank row must have exactly the header's cell count, counted by a strict tokenizer that follows the same quoting rules. Each violation is listed with its line number.

### 4.2 Agreement (codebook §4, §9.1)

Computed on the primary field, then identically on the secondary field, which is labelled "not gated" (§4.9).

- **BR-10 Binary category.** `yes` vs not-`yes`. `no` and `unsure` both map to not-`yes` (§4.2, §4.4).
- **BR-11 Unit and drops.** One unit = one sample item where **both** raters gave the field a non-blank answer. Items blank in either sheet are dropped and listed by id (§4.5). n = 60 − dropped.
- **BR-12 Completeness.** If dropped > 6 (n < 54), the status is `INCOMPLETE (below protocol)` and overrides pass/fail; κ is still computed and shown (§4.5).
- **BR-13 κ.** Cohen's unweighted κ on the 2×2 table (rows: rater, columns: author), via `cohenKappa` of `scripts/lib/stats.ts`. If the expected agreement p_e = 1 (both raters used one category throughout), `cohenKappa` returns `NaN` (0/0); κ is then undefined, tested as `!Number.isFinite(κ)`, reported as `undefined`, and the gate is **not passed**. With n = 0 (every item dropped), no statistic of the block is computed (`wilson` and the bootstraps throw on n = 0): every figure is `undefined` and the status is INCOMPLETE.
- **BR-14 Gate.** `PASS` iff κ ≥ 0.60 on the primary field and the status is not INCOMPLETE; else `FAIL`. The comparison uses a tolerance of 1e-9 (κ ≥ 0.60 − 1e-9), so a table whose exact κ is 0.60 (e.g. 24/6/6/24) passes despite floating-point rounding. There is no other path to PASS (§4.8: AC1 never rescues the gate).
- **BR-15 κ interval (reported, not gated).** 95 % percentile bootstrap over items, 10,000 resamples, seed 20261018 (BR-40). Sensitivity: the stratified project-cluster bootstrap (BR-41). Resamples where κ is undefined are left out and counted.
- **BR-16 Alongside.** The 2×2 table; observed agreement p_o with its Wilson 95 % interval (k = agreements, n); Gwet's AC1 (binary, `gwetAC1`); the prevalence index |a − d| / n and the bias index |b − c| / n (Byrt, Bishop and Carlin 1993), where a = both yes, d = both not-yes, b and c the two disagreement cells; PABAK = 2·p_o − 1 as a descriptive extra. The 3×3 table (yes / no / unsure) with its three-way κ, descriptive.
- **BR-17 Prevalence note.** If κ < 0.60 or κ is undefined, and AC1 ≥ 0.60 and the prevalence index ≥ 0.5, the report prints the fixed line "κ fails while AC1 passes under extreme prevalence (§4.8); the gate stays failed".
- **BR-18 Unsure rates.** For each rater and field: unsure count / answered count. A rate > 15 % is flagged "codebook problem" (§4.4); the flag never changes the gate.
- **BR-19 Sensitivity κ.** κ on the items where neither rater said `unsure` on that field, descriptive, with its n (§4.4). Then the binary 2×2 counts split by style (counts only, §9.1).

### 4.3 Meaningful precision (codebook §9.2)

- **BR-20 Reference.** The headline uses **the rater's** primary field (§8). The author enters only the agreement block and the sensitivity rows.
- **BR-21 Success.** An item is a success iff the field is `yes`. `no` and `unsure` are failures. Blank items are dropped and listed.
- **BR-22 Stratified estimator.** p̂ = Σ_h (N_h / N') · p̂_h, where p̂_h = yes / answered in stratum h, and N' = Σ N_h over the strata with at least one answered item. With nothing dropped, N' = 784 and p̂ equals the Horvitz–Thompson ratio Σ w·y / Σ w with w = N_h / n_h. If a stratum loses all its items, it is left out, N' shrinks and the stratum is named in the report (no imputation).
- **BR-23 Interval.** Stratified cluster bootstrap (BR-41), 10,000 resamples, seed 20261018, percentile 2.5 / 97.5. The report states the number of strata with a single project cluster: they add no variance to the bootstrap, so the interval is narrower than the design's true uncertainty for those strata.
- **BR-24 Descriptive companions.** The unweighted share of answered items with its Wilson 95 % interval, and the Kish effective n of the answered items' weights (`kishEffectiveN`). The weight of an answered item is N_h / m_h, with m_h the answered items of its stratum (the weight the BR-22 estimator actually applies; it equals N_h / n_h when nothing is blank). The codebook expects n_eff ≈ 39 (38.83 on the current draw with no blanks).
- **BR-25 Sensitivities** (each reported in its own row, none replaces the headline, all with the same estimator and bootstrap, each with its own n):
  1. the author's labels;
  2. success = `yes` by both raters (items answered by both);
  3. items where the rater said `unsure` on the primary field dropped;
  4. items with `testOrMock = True` dropped (4 in the current sample);
  5. items the rater coded `M` dropped.
- **BR-26 Per rule.** Grouped by `ruleId` (FF-S01 and FF-S02 pooled over their style strata). Rules with n ≥ 10 answered items get the unweighted yes-share and a Wilson 95 % interval; today these are FF-S01 (13) and FF-S02 (11). All other rules get counts only: yes / no / unsure / blank. The threshold reuses `MIN_INTERVAL_N` = 10 of `scripts/lib/stats.ts`.
- **BR-27 Per style.** Counts only (yes / no / unsure / blank), by the `style` column.
- **BR-28 Reading guide** (§9.5), applied to the headline p̂ and its bootstrap lower bound, printed as a fixed sentence. The thresholds use the BR-14 tolerance (p̂ ≥ 0.75 − 1e-9, lower ≥ 0.50 − 1e-9, p̂ ≤ 0.50 + 1e-9), since a weighted sum that is exactly 0.75 can land a rounding step below it. If p̂ or its lower bound is undefined, the guide prints "not applicable: no answered items":
  - p̂ ≥ 0.75 and lower ≥ 0.50: "blocking findings on human code mostly mark a change a practitioner would ask for";
  - p̂ ≤ 0.50: "the rival reading is supported";
  - otherwise: "mixed; read per rule".
  In single-rater mode the guide is printed with the prefix "descriptive only".
- **BR-29 Secondary field.** The full §4.3 block is repeated for the secondary field under the heading "Secondary field (not the headline)". So whichever L4 picks, style fidelity (or practitioner) is reported separately with the same statistics.

### 4.4 Cross-tables (codebook §9.3, §9.4)

- **BR-30 A×B table.** The rater's A (rows) by B (columns), 3×3 plus a blank row and column, over the 60 items. The two off-diagonal counts the reading depends on are printed in words: "B = yes, A = no: k items (rules encode the literature, not practice)"; "A = yes, B = no: k items (practitioners object to more than the literature states)". The same table for the author is printed below, descriptive.
- **BR-31 Reason codes.** Among the rater's items where A or B is `no`, the count of each code T/W/F/M/C/X and blank, pooled and per rule id.

### 4.5 Bootstrap (codebook §4.7, §9.2)

- **BR-40 Item bootstrap.** Resample the n kept items with replacement (n draws of `rng.int(n)`), recompute the statistic, 10,000 times, percentile interval with `quantileSorted`. One fresh `createRng(seed)` per statistic, so each interval is reproducible on its own and the order in which statistics are computed does not change any number.
- **BR-41 Stratified cluster bootstrap.** The cluster is a (stratum, project) cell. For each stratum in sorted name order, resample its cells with replacement (as many draws as it has cells, cells sorted by project id), then rebuild the item set and recompute the statistic (p̂ by BR-22, or κ). A project that appears in two strata is resampled independently in each, which is what "resample projects within strata" (§4.7, §9.2) means here.
- **BR-42 Undefined resamples.** Inside a resample, p̂ uses the BR-22 estimator unchanged: a stratum whose drawn cells hold no answered item is left out and N' renormalised for that resample, and the number of resamples where this happened is counted (`resamplesWithEmptyStratum`). A resample with no answered item in every stratum, or with κ not finite, is left out of the percentiles and counted in `undefinedResamples`; the report prints both counts. If every resample is undefined (for example T5, where all items are not-`yes` on both sheets), the interval is `undefined`; `quantileSorted` is never called on an empty array.
- **BR-43 Determinism.** Same inputs, seed and resamples give byte-identical JSON and Markdown: no wall-clock time, host name, absolute path or map-iteration order enters either output (keys and lists are sorted). Tests may pass a smaller `resamples` for speed; the CLI default is 10,000. A run on non-simulated sheets with a seed other than 20261018 or resamples other than 10,000 prints "NON-PROTOCOL: seed or resamples differ from codebook §4.7" in the status line and carries `protocol: false` in the JSON, so a changed setting cannot pass for the registered one.

### 4.6 Report

- **BR-50 Markdown.** One file, ready to paste into a `Docs/DiagnosticRuns/` note, in this order: header (inputs, hashes, seed, resamples, primary field, L4 line), status line (gate PASS / FAIL / INCOMPLETE, or "single-rater"), §1 agreement primary, §2 agreement secondary, §3 meaningful precision primary (headline row, Wilson companion, Kish n, sensitivities, per rule, per style, reading guide), §4 secondary-field precision, §5 A×B, §6 reason codes, §7 dropped items and warnings. Tables are GitHub Markdown; no Mermaid, no HTML.
- **BR-51 Number format.** Proportions and κ to 3 decimals, intervals as `[low, high]`, counts as integers; `undefined` is printed as the word, never `NaN` or `null`.
- **BR-52 Synthetic banner.** If any sheet is simulated (BR-05), the first line of the Markdown is "SYNTHETIC: simulated answer sheets, not labels", and the JSON carries `synthetic: true`.
- **BR-53 No private data.** Paths in the output are repo-relative (the CLI resolves them against the repo root). A file outside the repo (the dry run's scratch directory) is shown as `<outside repo>/<basename>`, never as an absolute or `../` path, which would print the user's home or volume. Notes from the sheets are not copied into the Markdown or the JSON (they can name people or carry free text), only counted.
- **BR-54 Outputs.** `--out <dir>` writes `analysis.json` and `analysis.md`. Without `--out`, the Markdown goes to stdout. A SYNTHETIC run (BR-52) refuses any `--out` under `results/` (exit 2), so simulated figures cannot land beside the registered results. The output never replaces a registered figure: N115 (real-code precision 0.328) and the other ledger rows are not read or written; the meaningful precision is a new figure the author registers by hand.

### 4.7 Simulation

- **BR-60 Simulate.** `simulate --table-a a,b,c,d [--table-b a,b,c,d] [--unsure-rater k] [--blank k] --seed s --out <dir>` writes `answers-author.csv` and `answers-rater.csv` over the item ids of `--sample`, rater column `simulated`. Simulation has no notion of the primary field (L4 is open): `--table-a` sets the `A_practitioner` 2×2 and `--table-b` the `B_style_fidelity` 2×2, each as (a both-yes, b rater-yes/author-not, c rater-not/author-yes, d both-not); `--table-b` defaults to the counts of `--table-a`. Each field's cells are assigned to items by its own seeded shuffle, so A and B differ item by item and the A×B table has off-diagonal counts. `--unsure-rater k` turns `no` into `unsure` on k of the rater's not-yes items in both fields; `--blank k` blanks both fields of k items in the author's sheet, and the tables then cover the other items. a + b + c + d must equal the item count minus `--blank`, else exit 2. `why_not` and `note` stay blank. It lets the author run the whole pipeline before any label exists. Simulated sheets are never written under `results/`: the CLI refuses any `simulate --out` there, which covers `results/v1.3-meaning/labels/`.

## 5. Flow

```text
sample.csv --load/validate--> SampleItem[] ---------+
rater.csv  --load/validate--> Sheet(rater)  --------+--> agreement(primary), agreement(secondary)
author.csv --load/validate--> Sheet(author) --------+--> precision(primary), precision(secondary)
                                                    +--> crosstab A x B, reason codes
                                                    +--> report: analysis.json, analysis.md
```

## 6. CLI

```bash
npx tsx scripts/v1.3/meaning-analysis.ts analyse \
  --sample results/v1.3-meaning/mean-01-sample.csv \
  --rater  results/v1.3-meaning/labels/answers-rater.csv \
  --author results/v1.3-meaning/labels/answers-author.csv \
  --primary A_practitioner \
  [--seed 20261018] [--resamples 10000] [--expect-sample-sha256 <hex>] [--out results/v1.3-meaning/analysis]

npx tsx scripts/v1.3/meaning-analysis.ts simulate \
  --sample results/v1.3-meaning/mean-01-sample.csv --table-a 20,10,5,25 --table-b 24,6,6,24 --seed 1 --out <scratch dir>
```

`--primary` is required and has no default, because L4 is still open (codebook §2, §11 B1). The value must be `A_practitioner` or `B_style_fidelity`, the two spellings of the codebook's `L4_PRIMARY` line. Exit codes: 0 analysis written; 2 input error (BR-01 to BR-06, BR-09, a sample hash mismatch, or a refused `--out`; every problem listed); 1 any other failure. The CLI is run from the repo root, like the other `scripts/v1.3/` tools.

## 7. What this unit does not do

- It does not adjudicate, re-draw, recode or reweight (§9.6). It never edits a sheet.
- It does not enforce blinding. The codebook's order (author's sheet committed and hashed before the rater's is opened, §7) is a procedure. The script prints both hashes so the order can be checked against git history.
- It does not compute R4's with/without sensitivity on the S02 cycle items: that needs the rater's free-text note per cycle, which BR-53 keeps out of the report. It is a manual step if R4 is contested.
- It does not write any `Docs/DiagnosticRuns/` note or touch `ops/`. The author pastes the Markdown.

## 8. Test strategy

All in `tests/unit/scripts/v1.3/meaning-analysis.test.ts`, run with `npx jest --maxWorkers=2 tests/unit/scripts/v1.3/meaning-analysis.test.ts`. No Neo4j, no network. Bootstrap tests use `resamples: 500` for speed, plus one 10,000-resample determinism test.

Fixtures in `tests/fixtures/v1.3-meaning/`: a 60-item synthetic sample with the real column layout (four strata with known N_h, one rule with n = 13 and one with n = 4) and a 10-item two-stratum sample for T9 and T10. Answer sheets are built in the test with `simulate.ts` or inline CSV strings. One loader test reads the real `results/v1.3-meaning/mean-01-sample.csv` to check BR-01 on the current draw (60 items, 18 strata, Σ N_h = 784, 4 `testOrMock` items, 2 single-project strata, Kish n_eff = 38.83 to 2 decimals). That file is not yet tracked in git; U7's PR must include it or follow the commit that adds it, and the test fails loudly (never skips) if it is missing. If the draw is regenerated before sign-off, this test and the codebook change together.

| # | Case | Expected (hand-computed) |
|---|---|---|
| T1 | 2×2 = 20 / 10 / 5 / 25 (n = 60) | p_o = 0.75, p_e = 0.5, κ = 0.50, FAIL |
| T2 | 2×2 = 24 / 6 / 6 / 24 | κ = 0.60 exactly, PASS (boundary, BR-14 tolerance) |
| T3 | 2×2 = 30 / 0 / 0 / 30 | κ = 1, PASS, bootstrap interval [1, 1] |
| T4 | 2×2 = 0 / 3 / 3 / 54 (prevalence) | p_o = 0.90, κ = −0.0526, AC1 = 0.8895, prevalence index 0.90, FAIL, BR-17 line printed |
| T5 | all 60 both not-yes | κ undefined, FAIL, not a crash |
| T6 | rater `unsure` vs author `no` on 6 items | binary agreement on those 6, 3×3 disagreement; sensitivity κ on n = 54 |
| T7 | 7 blanks in the author's primary field | n = 53, status INCOMPLETE, dropped ids listed |
| T8 | unsure rate 10/60 | rate 0.167 > 0.15, flag set, gate unchanged |
| T9 | two strata, N = (90, 10), n = (5, 5), yes = (1, 5) | p̂ = 0.9·0.2 + 0.1·1.0 = 0.28; unweighted 0.60 |
| T10 | stratum with all items blank | left out, N' shrinks, stratum named |
| T11 | per rule n = 13 and n = 4 | Wilson for 13 (matches `wilson(k, 13)`), counts only for 4 |
| T12 | reading-guide boundaries | (0.75, lower 0.50) mostly meaningful; (0.50, any) rival supported; (0.76, lower 0.49) mixed |
| T13 | A×B and reason codes | off-diagonal counts and code counts match the constructed sheet |
| T14 | validation | `Yes!`, unknown id, duplicate id, `C3` row, bad code, same file twice: each throws with the item named |
| T15 | determinism | two runs give identical JSON; κ and p̂ intervals contain the point estimate and lie in [−1, 1] and [0, 1] |
| T16 | SYNTHETIC banner and no notes | simulated sheets give the banner; a note text never appears in the Markdown |
| T17 | single-rater mode | no κ block; "single-rater, descriptive" label; reading guide prefixed |
| T18 | secondary field | B block present with the same statistics, labelled "not gated"; swapping `--primary` swaps which one is gated (A table 20/10/5/25 FAIL, B table 24/6/6/24 PASS, and the reverse) |
| T19 | every item blank in the author's primary field | n = 0, every agreement figure `undefined`, status INCOMPLETE, no throw |
| T20 | CSV shape (BR-09) | a BOM header loads; a `;`-separated sheet, a missing column and a row with an unquoted comma in the note each throw with the line named |
| T21 | guards | `simulate --out results/...` and a SYNTHETIC `analyse --out results/...` exit 2; seed 7 on non-simulated sheets prints NON-PROTOCOL; a wrong `--expect-sample-sha256` exits 2; a scratch path outside the repo prints as `<outside repo>/<basename>` |
| T22 | BR-07 hashes | the hash list names `scripts/lib/stats.ts` and `scripts/v1.3/lib/labelling/audit.ts` beside the meaning files |

## 9. Risks

| # | Risk | Guard |
|---|---|---|
| 1 | L4 is still open, so code could bake in A as primary. | `--primary` is required, no default; both fields always computed (BR-29). |
| 2 | Single-project strata (FF-DT02 and FF-DS01 in the current draw; several more have only two projects) contribute zero bootstrap variance, so the cluster interval for p̂ is too narrow. | Count printed (BR-23); Wilson and Kish n printed beside it. The codebook fixed this interval; the design does not change it. |
| 3 | Per-rule Wilson intervals are unweighted, while FF-S01 pools strata with weights from 5 to 28.5. | As written in §9.2; the per-rule row is labelled "unweighted share". Author question Q2. |
| 4 | Floating-point κ at exactly 0.60. | BR-14 tolerance, T2. |
| 5 | Synthetic output mistaken for real labels. | BR-52 banner and `synthetic: true`; `simulate` refuses the labels directory (BR-60). |
| 6 | Rater answers written in the packet boxes, then transcribed into the CSV, can carry typos. | BR-02 rejects any non-exact value; the transcriber fixes the sheet, not the script. |
| 7 | Free-text notes leak into a public repo through the report. | BR-53: notes are counted, never printed. |
| 8 | Two languages (Python draw, TypeScript analysis). | The analysis reads only CSVs; the shared mulberry32 is already checked to match (codebook §6). |
| 9 | Silent changes to the script, or to a shared helper, after labels arrive. | BR-07 hashes, including `stats.ts` and `audit.ts`, in every output; the codebook records the hash at sign-off. |
| 10 | A spreadsheet export (BOM, `;` separator, unquoted commas in notes) misreads a sheet without an error. | BR-09 strict shape check, T20. |
| 11 | Synthetic figures or a non-protocol seed pass for the registered result. | BR-43 NON-PROTOCOL line, BR-54 refusal under `results/`, T21. |

## 10. Author questions (none blocks the code; each has the default shown)

Q2–Q5 are analysis choices. To keep V6 honest they must be answered, or their defaults accepted, at the codebook sign-off (§12), before the first label commit; changing one after the labels are seen would be the recoding §9.6 forbids. The orchestrator carries them to the author with L4.

- **Q1 (L4).** Primary field. Default: none. The CLI requires `--primary`, so the code does not wait on it, but the gated result does.
- **Q2.** Per-rule intervals for FF-S01 and FF-S02: the unweighted share with Wilson (codebook §9.2 as written, the default), or a weighted share, given that the FF-S01 strata have weights from 5 to 28.5?
- **Q3.** κ undefined (one category throughout): the default is "gate not passed". Confirm.
- **Q4.** A stratum that loses every item to blanks: the default is to leave it out, renormalise over the rest and name it. Confirm, instead of reporting the run as incomplete.
- **Q5.** The cluster for both bootstraps is a (stratum, project) cell, so a project in two strata is resampled independently in each (the default reading of "resample projects within strata"). Confirm, rather than resampling whole projects across strata.

## 11. Content validation

No Mermaid. The one ASCII flow (§5) uses only `-`, `+`, `|` and `>` with a monospace code fence. Tables are plain GitHub Markdown. All paths are repo-relative.
