# Reproducibility audit, group B: v1.3 reference validation write-ups (2026-10-15)

Auditor scope: `Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md`, `...-after-fixes-2026-10-15.md`, `...-after-member-facts-2026-10-15.md`.
Repo state: `<REPO>`, branch `v1.3-replication`, HEAD `96a5e77d`. Nothing in the repo was edited. No Neo4j run, no model, LLM or network call.
(Note: during the audit, `git status` started showing changes under `replication/lib/` that this audit did not make: `compare.mjs` and `strip-timings.mjs` are untracked, and `cheap.sh` is modified. They look like another concurrent agent's work. This audit wrote only to the scratchpad.)

## Method (common to all three docs)

Independent recomputation, all scripts in `<scratch>/work/`:

- `dumprefs.ts` → `refs.json`. It dumps the author-manifests, the scope rules and the v1.3 blocking tier through the repo loader `scripts/v1.3/lib/reference-model.ts`, which is read-only. The manifests (`tests/fixtures/v1.3-reference/**`) and `src/scoring-engine/rule-tiers.ts` have not changed since before the baseline commit `89e79f49`.
- `score.py`: an independent Python scorer that reads `raw/<style>/<variant>.json` plus `refs.json`.
  - Matching is one-to-one: rule + file, plus target when both sides have one, exact pairs first.
  - "literal" uses the FF-S02 key as written; "normalised" keys a cycle on its sorted file set.
  - It also computes fpDistinct, planted-detected, silent non-violations, near-miss and negative-control stats, and Wilson 95% (z = 1.959964).
- `sj.py`, `ga.py`, `adj.py`: readers for the aggregates `scores.json`, `graph/graph-agreement.json` and `adjudication.csv`.
- `ag.py`: author expected-graph agreement, recomputed from `graph/tool-graphs.json` plus `tests/fixtures/v1.3-reference/<style>/expected-graph.json`.
- `rawdiff.py`: the multiset diff of tool rows between runs.
- The blind-expanded blocking TP/FN/FP were re-derived without the blind manifests:
  - FN and FP come from the `scored`/`blocking` rows of `adjudication.csv` (max(blind−tool, 0) and max(tool−blind, 0));
  - TP = tool blocking rows (from `raw/`) − FP.
  - This matched `scores.json` per style in all three runs.
- Aggregate-vs-raw checks:
  - Every per-rule TP/FN/FP/fpDistinct and planted count of the author-literal and author-cycle-normalised views in each `scores.json` equals my recomputation from `raw/` (0 differences in 4 run folders).
  - In every view, pooled blocking equals the sum of the per-rule blocking counts.

**Blind manifests are not committed.** `ue-score.ts` reads `daedalus-sealed/v1.3-blind/{blind-key.json, blind-out/<style>/case-XX.json}`, which is outside the repo and absent from this machine. Every blind figure is therefore checked against the committed aggregates only, except blind-expanded blocking, which was re-derived through `adjudication.csv` as described above. These blind-only figures are:

- blind-primary;
- the manifest agreement table;
- the graph figures against the blind graph;
- the blind verdicts.

These rows are marked "agg" in the tables.

---

### v1.3-reference-baseline-2026-10-15.md

Raw sources used:

- `results/v1.3-reference/baseline-pre-barrel/raw/**` (71 files)
- `.../evidence/**`
- `.../report.json` and `.../report.md`
- `.../scores.json` and `.../scores.md`
- `.../adjudication.csv`
- `.../blind-rule-mapping.json`
- `.../graph/tool-graphs.json` and `.../graph/graph-agreement.json`
- `.../run-provenance.json`
- `tests/fixtures/v1.3-reference/**` (manifests, `expected-graph.json`)

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Cases | 71 | 14+13+14+15+15 = 71 raw files | yes | raw/ |
| 2 | Blocking recall author-literal clean/layered/nestjs/hex/ddd | 12/13, 9/11, 10/11, 12/13, 7/9 (0.92/0.82/0.91/0.92/0.78) + CIs | identical incl. Wilson [0.67,0.99] [0.52,0.95] [0.62,0.98] [0.67,0.99] [0.45,0.94] | yes | raw/ (score.py); report.json; scores.json |
| 3 | Pooled blocking recall author-literal | 50/57 = 0.88 [0.77, 0.94] | 50/57 = 0.877 [0.77, 0.94] | yes | raw/ |
| 4 | Blocking recall author-normalised per style | 13/13, 11/11, 11/11, 13/13, 7/9 | same | yes | raw/ |
| 5 | Pooled author-normalised recall | 55/57 = 0.96 | 55/57 = 0.965 [0.88,0.99] | yes | raw/ |
| 6 | Blind-expanded recall per style | 13/15, 7/10, 11/14, 13/19, 7/9 + CIs | same (CSV-derived and scores.json) | yes | adjudication.csv + raw/; scores.json |
| 7 | Pooled blind-expanded recall | 51/67 = 0.76 [0.65, 0.85] | 51/67 = 0.761 [0.65, 0.85] | yes | same |
| 8 | Blocking precision author-literal per style | 12/14, 9/64 [0.08,0.25], 10/11, 12/14, 7/7 [0.65,1.00] | same | yes | raw/ |
| 9 | Pooled precision author-literal | 50/110 = 0.45 [0.36, 0.55] | 50/110 = 0.455 [0.36, 0.55] | yes | raw/ |
| 10 | Precision author-normalised per style / pooled | 13/14, 11/64, 11/11, 13/14, 7/7 / 55/110 = 0.50 | same | yes | raw/ |
| 11 | Precision distinct (author, literal) | 0.86, 0.56, 0.91, 0.86, 1.00; pooled 0.81 (50/62) | 12/14, 9/16, 10/11, 12/14, 7/7; 50/62 | yes | raw/ |
| 12 | Blind-expanded precision per style / pooled | 13/14, 7/64, 11/11, 13/14, 7/7 / 51/110 = 0.46 | same | yes | CSV + raw/; scores.json |
| 13 | Graph: author expected, 4 patch styles, every edge | 269/269, nothing extra; layers 115/115 | 69+62+64+74 = 269 both, 0 tool-only; layers 29+27+29+30 = 115 | yes | tool-graphs.json + expected-graph.json (ag.py) |
| 14 | Graph: DDD key edges | 15/16 = 0.94, missing `OrderingAcl.ts -> ordering/index.ts`; layers 31/31 | 15/16 = 0.9375, same edge missing; 31/31 | yes | ag.py |
| 15 | Blind graph literal recall / precision overall | 4738/4756 and 4738/4756 | 4738 both, 18 only-ref, 18 only-tool (60 excluded) | yes (agg) | graph-agreement.json; tool side consistent with tool-graphs.json edge totals |
| 16 | Blind barrel edges literal / routed | 0/18 / 18/18 | 18 only-ref of class "barrel import"; via 18/18 | yes (agg) | graph-agreement.json |
| 17 | Per-style literal edges (both / tool-only / blind-only) | clean 985/0/0, layered 822/2/2, nestjs 908/0/0, hex 1069/0(+60)/0, ddd 954/16/16 | same; tool edge totals 985/824/908/1129/970 equal both + onlyTool + excl | yes (agg + tool side) | graph-agreement.json, tool-graphs.json |
| 18 | Literal recall/precision layered, ddd; hex 0.947 | 0.998/0.998, 0.984/0.984; 0.947 | 0.9976, 0.9835; 1069/1129 = 0.9469 | yes | same |
| 19 | Layers per style / total | 408, 353, 408, 378 (+75 tool-only files), 467; 2014/2014 | same; 75 = 5 ports/out files × 15 cases | yes (agg + tool side) | graph-agreement.json, tool-graphs.json |
| 20 | Hex 60 tool-only edges = 4 per case, outgoing from 5 port files | 60, 4/case, 5 files | 60 edges with `from` in ports/out over 15 cases; 5 distinct files | yes | tool-graphs.json |
| 21 | Blind-primary pooled | recall 0.83 (38/46), precision 0.35 (38/110) | 38/46, 38/110 | yes (agg) | scores.json / scores.md |
| 22 | Per-style table: planted detected | 8/10, 7/9, 8/10, 10/11, 10/12 | same | yes | raw/; report.json |
| 23 | Per-style table: silent clean and near-miss | 3/4, 0/4, 3/4, 3/4, 3/3 | same | yes | raw/ |
| 24 | Per-style all recall / all precision | .88/.88, .82/.14, .85/.79, .94/.88, .83/1.00 | 14/16, 14/16; 9/11, 9/64; 11/13, 11/14; 15/16, 15/17; 10/12, 10/10 | yes | raw/ |
| 25 | Per-rule TP/FN/FP table (all cells, all 5 styles) | as printed | every cell equal | yes | raw/ (score.py), report.json |
| 26 | FF-P06 layered | 0/0/53 (5 distinct) | 0/0/53, fpDistinct 5 | yes | raw/ |
| 27 | FF-S02 normalised | 5/0/0 in total | 1+2+1+1 = 5 TP, 0 FN, 0 FP | yes | raw/ |
| 28 | Negative control scored / blocking rows; verdict | 0,4,0,0,0 / 0,4,0,0,0; layered fail | same; layered's 4 rows are the 4 FF-P06 rows named | yes | raw/ |
| 29 | Negative control blind case ids and blind verdicts | case-12/03/06/07/09, pass | same | yes (agg) | scores.json |
| 30 | Near-miss table: any / blocking / new / new-blocking FP | 6/14, 5/14, 4/14, 3/14 (per style 1,1,1,1 / 3,3,1,1 / 1,0,1,0 / 1,1,1,1 / 0) | same, incl. the named rows | yes | raw/ |
| 31 | Blind annotator flags only hex n01 (case-04) | 1 near-miss | blindExpected 1 only for hex n01 | yes (agg) | scores.json nearMiss |
| 32 | Author vs blind agreement table (both / author-only / blind-only / blocking / verdicts) | 16/0/4, 13/0/2, 14/14 … ddd 12/0/0, 9/0/0, 14/15 | identical for all 5 styles | yes (agg) | scores.json manifestAgreement |
| 33 | Guessed mappings | 2, each used once | 2 (`guessedMappingsUsed`) | yes (agg) | scores.json, blind-rule-mapping.json |
| 34 | Unmapped names | 3 (one only in alsoMatches) | 3 rows with basis `unmapped`; the nestjs one notes "alsoMatches only" | yes | blind-rule-mapping.json |
| 35 | "Nine blind findings name a rule outside the compared set" | 9 | `unscoredBlind` = 9, but this is 7 out-of-scope + 2 unmapped primary findings; the doc's own list has 7 | **partial** | scores.json |
| 36 | Adjudication sheet rows; adjudication column empty | 96; empty | 96; 0 filled | yes | adjudication.csv |
| 37 | Cause 1: FF-P06 share of blocking FPs | 53 of 60 | 53 of 60 (author-literal pooled FP = 60) | yes | raw/ |
| 38 | Cause 5: "blind only" rows / "tool + author, blind silent" | 27 / 6 | 27 / 6 (layered 4, hexagonal 2) | yes | adjudication.csv |
| 39 | Cause 2: cycle key "costs 1 to 2 points of blocking recall in four styles" | 1–2 points | 1–2 findings, i.e. +8 to +18 percentage points (clean 0.92→1.00, layered 0.82→1.00, nestjs 0.91→1.00, hex 0.92→1.00) | **ambiguous** | raw/ |
| 40 | "Largest blocking cell is 15 expected findings" | 15 | max author n = 13; max blind-expanded n = 19 (hexagonal 13/19 in the doc's own table) | **no** | scores.json |
| 41 | Violation variants per style "9 to 12" | 9–12 | 10, 9, 10, 11, 12 | yes | manifests |
| 42 | Predicted DDD recall after FF-DS02 fix | 0.78 → 0.89 (8/9) | borne out in after-fixes | yes | after-fixes raw/ |
| 43 | Run times / attempts / swap | 01:09:10–01:10:01Z interference; run1 01:14:23Z, run2 01:17:39Z; 11.3/16 GB; 43–54 % | same text | yes (provenance only) | run-provenance.json |

Mismatches:

- **Row 40, "largest blocking cell is 15 expected findings".** The doc's own blind-expanded table shows hexagonal at 13/19, and blind-expanded layered precision has n = 64. No view has a maximum of 15: the author maximum is 13 and the blind maximum is 19.
  - Classification: doc typo.
  - Severity: none. The conclusion "no style's Wilson lower bound reaches 0.90" still holds, because 19/19 gives a lower bound of 0.83.
- **Row 35, "nine blind findings name a rule outside the style's compared set".** `scores.json.unscoredBlind` has 9 entries, but 2 of them are the unmapped `OTHER:` primary findings (layered v03, ddd g02). Only 7 name an out-of-scope rule, and the doc lists exactly those 7.
  - Classification: definition ambiguity.
  - Severity: none.
- **Row 39, "1 to 2 points".** The cycle key costs 1–2 findings per style, which is 8–18 percentage points of recall, not 1–2 points.
  - Classification: definition ambiguity in the wording. Every exact figure elsewhere in the doc is correct.
  - Severity: low. Read as percentage points, it understates the effect.
- **Minor presentation issue, no number at stake.** The per-rule table counts FF-DT04 in two rows ("FF-P01 / FF-DT04" with ddd 1/0/0, and "FF-DT01, FF-DT02, FF-DT04 1/0/0 each"). It is one TP shown twice.
  - Classification: doc typo.
  - Severity: none.

Not reproducible from committed files (missing raw file):

- **The blind manifests** (`daedalus-sealed/v1.3-blind/**`). Without them these could only be checked against aggregates:
  - blind-primary;
  - manifest agreement;
  - every blind-graph figure (rows 15–19);
  - blind verdicts;
  - the unscored and guessed listings.

  Blind-expanded blocking was re-derived through `adjudication.csv`, which is itself a blind-derived committed artefact.
- **The discarded first run**, whose nestjs/v10 and hexagonal FF-C04 interference is described but whose outputs are not committed.
- **run2 outputs**, behind the "byte-identical" claim.
- **The `tsc` result.**

Regeneration:

- **report.md / report.json**
  - Command: `node --import tsx scripts/v1.3/validate-reference.ts --from-raw results/v1.3-reference/baseline-pre-barrel/raw --out <scratch>`, run with the code at the baseline commit (`git archive 89e79f49 scripts src tests/fixtures/v1.3-reference presets specs package.json tsconfig.json` into the scratchpad, plus a `node_modules` symlink).
  - Result: the report.md body is byte-identical except the header line ("from saved outputs" vs "live run"), and the report.json `metrics` and `comparisons` are deep-equal.
  - Run with HEAD code instead, it differs on purpose. HEAD's `compare.ts` has fix 2 (cycle set), and its output equals the scores.json `author-cycle-normalised` view, which I checked.
  - No Neo4j. Deterministic.
- **graph/tool-graphs.json**
  - Command: `TMPDIR=<scratch> node --import tsx scripts/v1.3/ue-graph.ts --out <scratch>` at `89e79f49`.
  - Result: **byte-identical (cmp)**.
  - No Neo4j. Deterministic.
  - `npx tsx` failed here with an `EADDRINUSE` on tsx's IPC pipe under a long TMPDIR. Use `node --import tsx`.
- **scores.json, scores.md, adjudication.csv, graph-agreement.json**
  - Command: `npx tsx scripts/v1.3/ue-score.ts --base <copy of the run dir> --blind <daedalus-sealed/v1.3-blind>`. It writes in place into `--base`, so copy the run dir first.
  - **Not runnable here:** the blind dir is missing. It is pure offline scoring with no Neo4j or model, and should be deterministic.
- **raw/ and evidence/ (live run)**
  - Command: `NEO4J_URI=bolt://127.0.0.1:7693 NEO4J_USER=... NEO4J_PASSWORD=... node --import tsx scripts/v1.3/ue-baseline-live.ts --out <dir>` on code `5d50dfaf`/`89e79f49`.
  - It needs Neo4j 5.26 with APOC (`docker-compose.yml`: `neo4j:5.26-community` plus the `apoc` plugin) and the symbolic-only CLI (`bin/firewall.ts evaluate --symbolic-only`). It makes no LLM call.
  - Deterministic according to provenance (run1 == run2). Not re-run.
  - `evidence/` carries `elapsedMs`, so that file is not byte-stable.
  - No external CLIs (dependency-cruiser, madge, semgrep) are used by these scripts.

---

### v1.3-reference-after-fixes-2026-10-15.md

Raw sources used:

- `results/v1.3-reference/after-fixes/**`: raw, evidence, report.*, scores.*, adjudication.csv, graph/*, run-provenance.json, blind-rule-mapping.json
- `results/v1.3-reference/after-fixes/barrels-only/**`
- `results/v1.3-reference/baseline-pre-barrel/**` (the "before" columns)
- the manifests

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Adjudication rows | 40 (from 96), column empty | 40; 0 filled | yes | adjudication.csv |
| 2 | Author blocking recall after, per style | 13/13, 11/11, 11/11, 13/13, 8/9 [0.57, 0.98] | same | yes | raw/ |
| 3 | Pooled author recall before → after | 55/57 [0.88,0.99] → 56/57 = 0.98 [0.91,1.00] | same | yes | raw/ |
| 4 | Blind-expanded recall after per style / pooled | 13/15, 7/10, 11/14, 13/19, 8/9; 51/67 → 52/67 = 0.78 [0.66,0.86] | same | yes | CSV + raw/; scores.json |
| 5 | Author blocking precision after per style | 13/13, 11/11 [0.74,1.00], 11/11, 13/13, 8/8 [0.68,1.00] | same | yes | raw/ |
| 6 | Pooled author precision before → after | 55/110 [0.41,0.59] → 56/56 [0.94,1.00] | same | yes | raw/ |
| 7 | Blind precision before → after | layered 7/64 → 7/11 = 0.64 [0.35,0.85]; pooled 51/110 [0.37,0.56] → 52/56 = 0.93 [0.83,0.97] | same | yes | CSV + raw/; scores.json |
| 8 | Author literal key, pooled | recall 50/57 → 51/57 = 0.89; precision 50/110 → 51/56 = 0.91 | same | yes | raw/ |
| 9 | Blind primary, pooled | 38/46 → 39/46 = 0.85; 38/110 → 39/56 = 0.70 | same | yes (agg) | scores.json |
| 10 | Literal-key FF-S02: 5 misses + 5 FPs, which cases | clean v03, layered v05/v06, nestjs v04, hexagonal v11 | same 5 variants | yes | raw/ |
| 11 | Clean variant tool verdict before → after | 4/5 pass → 5/5 pass | layered clean 4 → 0 scored rows | yes | raw/ |
| 12 | Near-misses with any scored FP | 6/14 → 1/14 (only nestjs n03 FF-P02) | same | yes | raw/ |
| 13 | Near-misses with a blocking FP | 5/14 → 0/14 | same | yes | raw/ |
| 14 | Planted rule detected (author normalised) | 9/10, 9/9, 9/10, 11/11, 10/12 → ddd 11/12; total 48/52 → 49/52 | same | yes | raw/ |
| 15 | Raw diff barrels-only → after: FF-P06 layered | −53 (13 variants × 4, + SalesReportService on n02) | −53 (12 variants × 4 + n02 × 5) | yes | rawdiff.py |
| 16 | Raw diff: FF-P03 CsvReportWriter (clean n02), GatewayRetryPolicy (hex n03) | −1, −1 | −1, −1 | yes | rawdiff.py |
| 17 | Raw diff: FF-DS02 g03 `InvoiceController.ts -> GetOrderSummary.ts` | +1 | +1 (same file and target) | yes | rawdiff.py |
| 18 | Any other raw row change | 0 | 0 (16 files differ, all explained) | yes | rawdiff.py |
| 19 | barrels-only raw/ == baseline raw/ for 71 variants | identical | `diff -r` empty; 71 files | yes | both raw/ |
| 20 | DDD key edges after | 16/16; layers 31/31 | 16/16; 31/31 | yes | ag.py |
| 21 | Author graph 269/269, 115/115 unchanged | same | same | yes | ag.py |
| 22 | Blind literal layered after | recall 824/824 = 1.000; precision 824/826 = 0.998 | both 824, onlyRef 0, onlyTool 2 (via class) | yes (agg; tool side 826) | graph-agreement.json, tool-graphs.json |
| 23 | Blind literal ddd after | recall 970/970; precision 970/986 = 0.984 | both 970, onlyRef 0, onlyTool 16; tool edges 986 | yes (agg) | same |
| 24 | Barrel literal edges after | 0/18 → 18/18 | onlyRef 0 in every style | yes (agg) | graph-agreement.json |
| 25 | viaReExport edges present | 18/18 → 18/18 | 2 + 16 inTool | yes (agg) | graph-agreement.json |
| 26 | "2 + 16 tool-only edges are exactly the routed via edges" | 18 | all 18 classed "barrel-routed edge (equals a blind viaReExport edge)" | yes (agg) | graph-agreement.json |
| 27 | Layers every case | 2014/2014 | 2014/2014 | yes (agg) | graph-agreement.json |
| 28 | tool-graphs identical to barrels-only | byte-identical | cmp identical | yes | tool-graphs.json |
| 29 | "60 tool-only edges **into** `ports/out`" (hexagonal) | into | the 60 are edges **out of** ports/out (`from` = port file; the 238 edges into ports/out are matched) | **no (wording)** | tool-graphs.json |
| 30 | §2: layered blind 4 "tool + author, blind silent" rows | FF-P01 v07, v08; FF-S03 v01, v02 | exactly these 4 | yes | adjudication.csv |
| 31 | §5: 15 blocking findings missing vs blind | 15 | pooled blind FN = 15 | yes | CSV, scores.json |
| 32 | Pooled author precision lower bound | 0.94 from 56 rows | Wilson(56,56) low = 0.936 | yes | computed |
| 33 | "Largest blocking cell has 15 expected findings" / "no style has more than 15" | 15 | author max 13; blind-expanded hexagonal 19 | **no** | scores.json |
| 34 | Remaining author mismatches | FF-DT03 g01; FF-P05 clean v07, nestjs v09; FF-P02 nestjs n03; FF-P04 nestjs v07 | exactly these 5 in report.json | yes | report.json |
| 35 | Determinism run1/run2, times | 01:53:57–01:55:44Z; 01:56:04–01:57:42Z; swap 10.8–11.0 GB; 37–42 % | same text | yes (provenance only) | run-provenance.json |
| 36 | §6 tests: 140 suites, 2317 passed / 1 failed; golden 81; prereg 85 artefacts 12/12 | as stated | no logs committed; 12 `experiments/*/plan.json` exist | not reproducible | — |

Mismatches:

- **Row 33.** The same "15 expected blocking findings" statement as in the baseline doc. Blind-expanded hexagonal recall has n = 19.
  - Classification: doc typo, carried over from the baseline.
  - Severity: none. The conclusion about the lower bounds holds.
- **Row 29.** The hexagonal graph row says the 60 tool-only edges go "into `ports/out`". The data, and the baseline doc ("outgoing edges of the five reconstructed port files"), show they are outgoing edges *from* the five `ports/out` files, 4 per case.
  - Classification: doc typo.
  - Severity: none. The number 60 is right.

Not reproducible from committed files (missing raw file):

- §6 test results (jest counts, golden lane, `--check-prereg`, `tsc`, the compile SHA-256 identity);
- the `validate presets/layered.yaml` output "compiled 17, disabled 10";
- run2 outputs;
- the blind manifests, which affect every blind figure. Blind-expanded blocking was re-derived via `adjudication.csv`.

Regeneration:

- **report.***
  - Command: `node --import tsx scripts/v1.3/validate-reference.ts --from-raw results/v1.3-reference/after-fixes/raw --out <scratch>`. HEAD code is enough because `compare.ts` is unchanged since `3e8d4b48`.
  - Result: report.md body identical except the header line; report.json `metrics` and `comparisons` deep-equal.
  - No Neo4j. Deterministic.
- **barrels-only/report.***
  - Command: the same with `89e79f49`-era code (literal key).
  - Result: report.md body identical; report.json deep-equal. The barrels-only report.md body is also identical to the baseline's.
- **graph/tool-graphs.json**
  - Command: `TMPDIR=<scratch> node --import tsx scripts/v1.3/ue-graph.ts --out <scratch>` on a `git archive 3e8d4b48` tree.
  - Result: **byte-identical**. No Neo4j.
- **scores.\*, adjudication.csv, graph-agreement.json**
  - Command: `ue-score.ts --base <copy> --blind <daedalus-sealed/v1.3-blind>`.
  - Not runnable here, because the blind dir is missing.
  - Two consistency checks pass: barrels-only `scores.json` and `adjudication.csv` are byte-identical to the baseline's, consistent with identical raw/, and the after-member-facts `blind-rule-mapping.json` is byte-identical to this one.
- **raw/ and evidence/ (live)**
  - Command: `ue-baseline-live.ts --out <dir>` at `3e8d4b48`, which holds the Neo4j lock under `~/.daedalus/locks/`.
  - Needs Neo4j 5.26 with APOC. Symbolic-only, no model.
  - Deterministic according to provenance. Not re-run.

---

### v1.3-reference-after-member-facts-2026-10-15.md

Raw sources used:

- `results/v1.3-reference/after-member-facts/**` (raw, evidence, report.*, scores.*, adjudication.csv, graph/*, run-provenance.json, blind-rule-mapping.json)
- `results/v1.3-reference/after-fixes/**` (the "before" columns)
- the manifests
- `git ls-tree 3e2c96ae` for the fixture count

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Adjudication rows | 40 → 39, column empty | 39; 0 filled | yes | adjudication.csv |
| 2 | Removed sheet row | `ddd,case-03,g01…` "both manifests, tool silent" | set diff = exactly that row (FF-DT03 Quantity.ts) | yes | both adjudication.csv |
| 3 | ddd blocking recall author | 8/9 = 0.89 [0.57,0.98] → 9/9 = 1.00 [0.70,1.00] | same | yes | raw/ |
| 4 | ddd blocking precision author | 8/8 [0.68,1.00] → 9/9 [0.70,1.00] | same | yes | raw/ |
| 5 | ddd blind-expanded recall / precision | 8/9 → 9/9; 8/8 → 9/9 | same | yes | CSV + raw/; scores.json |
| 6 | ddd all-rule recall author | 0.92 [0.65,0.99] → 1.00 [0.76,1.00] | 11/12 → 12/12, same CIs | yes | raw/ |
| 7 | ddd planted detected | 11/12 → 12/12 | same | yes | raw/ |
| 8 | ddd FF-DT03 | TP1 FN1 FP0, recall 0.50 [0.09,0.91] → TP2 FN0 FP0, 1.00 [0.34,1.00] | same | yes | raw/; scores.json (all 4 views) |
| 9 | Pooled author-normalised recall / precision | 56/57 [0.91,1.00] → 57/57 [0.94,1.00]; 56/56 → 57/57 | same | yes | raw/ |
| 10 | Pooled literal-key recall / precision | 51/57 = 0.89 [0.79,0.95] → 52/57 = 0.91 [0.81,0.96]; 51/56 = 0.91 [0.81,0.96] → 52/57 = 0.91 [0.81,0.96] | same | yes | raw/ |
| 11 | Pooled blind-expanded | recall 52/67 [0.66,0.86] → 53/67 = 0.79 [0.68,0.87]; precision 52/56 → 53/57 = 0.93 [0.83,0.97] | same | yes | CSV + raw/; scores.json |
| 12 | Pooled blind-primary | 39/46 [0.72,0.92] → 40/46 = 0.87 [0.74,0.94]; 39/56 → 40/57 = 0.70 [0.57,0.80] | same | yes (agg) | scores.json |
| 13 | Per-style author table (all cells) | clean 13/13, 13/13; layered 11/11, 11/11; nestjs 11/11, 11/11; hex 13/13, 13/13; ddd 9/9, 9/9 | same | yes | raw/ |
| 14 | Per-style blind table (all cells) | 13/15, 7/10, 11/14, 13/19, 9/9; precision 13/13, 7/11, 11/11, 13/13, 9/9 | same | yes | CSV + raw/; scores.json |
| 15 | Other four styles unchanged in every view | unchanged | all non-ddd view entries in scores.json equal after-fixes; raw diff limited to ddd g01 | yes | scores.json, rawdiff.py |
| 16 | Negative controls 5/5 pass; near-misses 1/14 any FP, 0/14 blocking | as stated | same | yes | raw/ |
| 17 | Raw diff vs after-fixes | +1 FF-DT03 on `Quantity.ts` in g01, nothing else | exactly that | yes | rawdiff.py |
| 18 | Evidence diffs (non-timing) | 2 cases: g01, v03 | exactly g01 and v03 | yes | evidence/ |
| 19 | g01 evidence message | "is mutable through Quantity.value (set accessor)" | same; tag `pattern-proxy` | yes | evidence/ddd/g01… |
| 20 | v03 message / id change | "declares setter Quantity.setValue" → "…public mutable field…, …mutator method"; `v-5013…` → `v-7a01…` | `v-5013848812c65bb8` → `v-7a01db4c69457e2f`, messages as quoted | yes | evidence/ddd/v03… |
| 21 | tool-graphs.json and graph-agreement.json byte-identical to after-fixes | identical | cmp identical (both) | yes | graph/ |
| 22 | "runner report.md mismatches 1 → none" | 1 → 0 | ddd: 1 → 0; whole report: 5 → 4 (FF-P05 ×2, FF-P02, FF-P04 remain) | **ambiguous** | report.json |
| 23 | ddd recall lower bound | 0.70 from 9 | Wilson(9,9) low = 0.70 | yes | computed |
| 24 | "No style has more than 15 expected blocking findings" | 15 | blind-expanded hexagonal 19 | **no** | scores.json |
| 25 | Remaining items | FF-P05 clean v07, nestjs v09; FF-P02 nestjs n03; FF-P04 nestjs v07 | exactly the 4 report.json mismatches | yes | report.json |
| 26 | Fixture projects for the hash check | 21 (with `u3-reexport` having no class) | 21 tsconfig.json dirs under fixtures/ and tests/fixtures/ at 3e2c96ae | count yes; hashes not reproducible | git ls-tree |
| 27 | Hash results 21/21, 21/21, 20/21 | as stated | no hash log committed | not reproducible | — |
| 28 | Jest: 104 suites, 1577 + 20 = 1597 passed; golden 81; prereg 85 / 12 | as stated | arithmetic 1577 + 20 = 1597 ok; no logs committed | not reproducible | — |
| 29 | run1 / run2 times, swap | 17:22:42–17:24:19Z; 17:24:27–17:25:57Z; 12.1 GB; 34–40 % | same text | yes (provenance only) | run-provenance.json |

Mismatches:

- **Row 24.** The same "15" statement as the other two docs; blind hexagonal n = 19.
  - Classification: doc typo, carried over.
  - Severity: none.
- **Row 22.** The table row "runner `report.md` mismatches 1 → none" has no style qualifier. Only ddd went 1 → 0. The whole report still lists 4 mismatches, which the doc itself lists in §5.
  - Classification: definition ambiguity. The section intro says only changed (ddd) rows are shown.
  - Severity: low. No conclusion changes.

Not reproducible from committed files (missing raw file):

- the §1 integration check (jest counts, the SIGSEGV suite, golden 81, prereg, tsc);
- the §1.1 extraction hash tables;
- run2 outputs;
- the blind manifests.

Regeneration:

- **report.***
  - Command: `node --import tsx scripts/v1.3/validate-reference.ts --from-raw results/v1.3-reference/after-member-facts/raw --out <scratch>` (HEAD code).
  - Result: body identical except the header; report.json deep-equal. No Neo4j.
- **graph/tool-graphs.json**
  - Command: `TMPDIR=<scratch> node --import tsx scripts/v1.3/ue-graph.ts --out <scratch>` on a `git archive 3e2c96ae` tree.
  - Result: **byte-identical**.
  - Do not run it at HEAD: the extractor has changed since (APG v2 commits `d1d1fcd1`, `15e755eb`, `33ec13ef`). No Neo4j.
- **scores.\*, adjudication.csv, graph-agreement.json**
  - Command: `ue-score.ts --base <copy> --blind <daedalus-sealed/v1.3-blind>`.
  - Not runnable here, because the blind dir is missing.
- **raw/ and evidence/**
  - Command: `ue-baseline-live.ts` at `3e2c96ae`.
  - Needs Neo4j 5.26 with APOC and `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`. Symbolic-only, no model.
  - Deterministic according to provenance. Not re-run.
- Env vars: `NEO4J_*` and `HEAVY_ADMISSION_BYPASS=1` (a local hook only). No pinned external CLI (dependency-cruiser, madge, semgrep) is used by these scripts.

---

## Secret / personal-path grep (results/v1.3-reference/**, all files touched)

There are no API keys, tokens, passwords, private keys, emails, `/Users/<name>` or `/home/<name>` paths. Hits:

| File:line | Kind |
|---|---|
| `baseline-pre-barrel/run-provenance.json:4` | `~/.daedalus-bt.env` (home-relative credential file path, contents not included) and `127.0.0.1:7693` (local host:port) |
| `baseline-pre-barrel/run-provenance.json:9` | `agent-ab41624562e2b80e4` (internal worktree/agent id) |
| `after-fixes/run-provenance.json:6` | `~/.daedalus/locks/neo4j-127.0.0.1_7693.lock`, `~/.daedalus-bt.env`, `127.0.0.1:7693` |
| `after-fixes/run-provenance.json:18` | `/var/folders/...` (macOS temp prefix, truncated; reveals the OS only) |
| `after-member-facts/run-provenance.json:6` | `~/.daedalus/locks/neo4j-127.0.0.1_7693.lock`, `~/.daedalus-bt.env`, `127.0.0.1:7693` |
| `after-member-facts/run-provenance.json:17` | `/var/folders/...` (same) |

The raw and evidence paths are all project-relative, because `normaliseFindingPath` strips the temp root.

## Summary

- Docs audited: 3 (baseline, after-fixes with barrels-only, after-member-facts).
- Rows checked: 43 + 36 + 29 = 108 headline rows. Every author-view number was recomputed independently from `raw/`; blind-expanded blocking was re-derived via `adjudication.csv`; blind-primary, manifest agreement and the blind graph were checked against aggregates only.
- Mismatches: 8 non-matching rows (3 "no", 2 "ambiguous", 1 "partial", 1 "no (wording)", plus one FF-DT04 presentation duplicate). That is 6 distinct issues; the "≤15 blocking findings" typo repeats in all 3 docs. None changes a conclusion, and no computed metric, CI or count is wrong.
- Not reproducible from committed files: the blind manifests (daedalus-sealed), run2 outputs, all test, tsc and hash logs.
- Byte-identical replays: tool-graphs.json ×3 (at 89e79f49, 3e8d4b48, 3e2c96ae); report.* metrics and comparisons ×4 (header line differs by design).
