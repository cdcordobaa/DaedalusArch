# Reproducibility audit, group E (v1.3 cheap semantics, Study 1 re-run, labelling)

Repo `<REPO>`, branch `v1.3-replication`. Audit started at HEAD `96a5e77d`. During the audit, HEAD moved to `723b3c8f` ("replication: smoke script ... (WIP)"), and an untracked `replication/` directory appeared at 20:01 UTC. Neither came from this audit; another process made them. `git diff 96a5e77d 723b3c8f` touches none of the audited docs, results, `scripts/` or `src/`. This audit wrote nothing inside the repo: `git status` was compared before and after each regeneration, and the only change was the foreign `replication/`.

Tools: node v22.22.0, tsx v4.21.0, typescript 5.9.3 (from `node_modules`). Every `*API_KEY*` env var was unset for all runs. No Neo4j, model or network call was made.

My recomputation scripts are in `<scratch>/scripts/` (`cheap.py`, `e1.py`, `lab.py`). They are independent Python readers of the committed raw files, and they reimplement the Wilson intervals and unit matching themselves.

---

### cheap-semantics-2026-10-15.md

Raw sources used:
- `results/v1.3-cheap-semantics/flags/*.json` (53): unit matching recomputed from these.
- `results/v1.3-cheap-semantics/scores.json`: `rows`, `fixtureBase.flags`, `precision[].flagList` / `summaries` / timings, `violations`.
- `results/v1.3-cheap-semantics/rows.csv`: cross-checked against `scores.json.rows`, 0 disagreements.
- Regenerated copy in scratchpad (see Regeneration).

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Applied copies (seeds + twins) | 53 | 53 rows / 53 flag files; seed manifest 53 `ok` | Y | rows.csv, flags/, regenerated seed-manifest |
| 2 | Seeds by operator (RB/FC/PID/DUP/FL) | 4/1/1/1/4 = 11, all on antipattern-nest | 4/1/1/1/4, all antipattern-nest | Y | scores.json rows |
| 3 | Twins | 42 | 42 (FL 23, PID 12, RB 4, FC 2, DUP 1) | Y | scores.json rows |
| 4 | DDD twin copies skipped by judge; judge twins | 9; 33 | ddd/clean twins = 9; 42−9 = 33 | Y | rows |
| 5 | Restricted to 33: no DDD twin carries a designated flag | unchanged numerators | raw 2/33, paired 0/33 (both raw flags on antipattern-nest) | Y | rows |
| 6 | Catch primary per operator | 4/4, 1/1, 1/1, 1/1, 4/4 | same | Y | flags/ + rows |
| 7 | Pooled catch primary + Wilson | 11/11 = 1.00 [0.74, 1.00] | 11/11 = 1.00 [0.74, 1.00] | Y | rows |
| 8 | Pooled paired catch | 11/11 | 11/11 (paired recomputed against fixtureBase flags) | Y | flags/, fixtureBase |
| 9 | Designated set adds nothing (any = primary) | 11/11 | catchAny 11/11, identical row-wise | Y | rows |
| 10 | Twin false flag RB / FC / DUP / FL (raw = paired) | 0/4, 0/2, 0/1, 0/23 | same | Y | rows |
| 11 | PID twin raw / paired + CI | 2/12 = 0.17 [0.05, 0.45] / 0/12 [0.00, 0.24] | same | Y | rows |
| 12 | Pooled twin raw + CI | 2/42 = 0.05 [0.01, 0.16] | same | Y | rows |
| 13 | Pooled twin paired + CI | 0/42 = 0.00 [0.00, 0.08] | same | Y | rows |
| 14 | Clean false flag per op / pooled + CI | 0/4, 0/1, 0/1, 0/1, 0/4; 0/11 [0.00, 0.26] | same | Y | rows |
| 15 | Per-op Wilson CIs (4/4 [0.51,1], 1/1 [0.21,1], 0/2 [0,0.66], 0/1 [0,0.79], 0/23 [0,0.14], 0/4 [0,0.49]) | as in §3 | identical | Y | own Wilson |
| 16 | The 2 raw twin flags are PID-n on invoice/order entity | yes | `antipattern-nest__AP-PERSIST-IN-DOMAINn__0/__2` | Y | rows |
| 17 | proxiesOnSite per seed (RB: repo-bypass + name-behaviour; FC: logic-density + name-behaviour; PID: domain-persistence-mapping; DUP: clones exact-structural + shared-string-literal; FL: framework-type-parameter) | as stated | identical | Y | rows / flags |
| 18 | Seeds with a new non-designated flag on edited files | 0 of 11 | 0 | Y | rows.newFlagsOnEditedFiles |
| 19 | Twin units with pre-existing non-designated flags | 2 DDD + 1 nestjs | ddd PID-n 0 and 3, nestjs/n03 FL-n 2 | Y | rows |
| 20 | Hand-written analogues caught, paired | 6/6 [0.61, 1.00] | 6/6, all paired; Wilson [0.61, 1.00] | Y | scores.json violations |
| 21 | Other violation variants | 46 | 52 − 6 = 46 | Y | violations |
| 22 | Non-analogue variants with a new defect flag | 2 (layered/v04, v05) | 2 (same) | Y | violations |
| 23 | Clean-project files (29/27/29/30/31; total) | 146 | 146 | Y | precision |
| 24 | Defect flags per clean project (1/2/2/1/8) and per proxy (clones 10, literals 2, cohesion 1, density 1) | total 14 | 14; per-proxy identical; `flags{}` = recount of `flagList` | Y | precision.flagList |
| 25 | communities column (10/7/10/9/6) | 42 | 42 community-component-mismatch flags (actual community counts: 4/3/4/5/5 = 21) | Y (see note) | precision |
| 26 | ARI layers / components (5 projects) | 0.16/0.16, 0.45/0.42, −0.09/0.42, 0.28/0.21, 0.01/0.25 | 0.155/0.155, 0.451/0.423, −0.087/0.424, 0.283/0.214, 0.014/0.254 | Y | precision.summaries.communities |
| 27 | Extract / proxies / total ms per project | 132/84/216, 136/89/225, 136/81/217, 135/71/206, 294/99/393 | identical (committed run) | Y | precision |
| 28 | Proxy ms range; extraction range; name-behaviour ms range | 71–99; 132–294; 17–50 | 71–99; 132–294; 17–50 | Y | precision.timingsMs |
| 29 | Semantic-placement proxies on clean + near-miss | 0 | 0 on 5 clean + 14 near-miss | Y | precision |
| 30 | Near-miss variants / defect flags | 14 / 39 | 14 / 39 | Y | precision (kind = near-miss) |
| 31 | Near-miss extras: layered/n01 +3 shared-number; nestjs/n03 +1 near-clone pair | as stated | layered/n01 5 vs base 2 (+3 literals); nestjs/n03 4 vs 2 clones (+2 flags = 1 pair) | Y | precision |
| 32 | Mean LCOM4 range | 1.0 to 1.12 | 1.000 to 1.125 (ddd) | ~ (rounding) | precision.summaries.cohesion |
| 33 | Max vocabulary leakage; vocab flags | 0.40 (hexagonal application → domain); 0 | 0.4013 hexagonal application → domain; 0 | Y | summaries.vocabulary |
| 34 | Doc-text units with text | 1 to 12 | 1, 10, 2, 5, 12 | Y | summaries.doc-text |
| 35 | Bases run in eval | 7 | 8 distinct baseIds (antipattern-nest, 5 clean, nestjs/n02, nestjs/n03) | N | rows / regenerated manifest |
| 36 | Variants materialised in eval | 70 | 71 (5 clean + 14 near-miss + 52 violation) | N | precision + violations |
| 37 | Eval wall time / seeding wall time | 56 s / 71 s | 59 s / 80 s on this machine | n/a (environment) | logs |
| 38 | Unit tests in tests/unit/apg-enrich | 23, one file per proxy | 23 `it/test` calls in 10 files (not executed) | Y (static count) | tests/unit/apg-enrich/cheap |
| 39 | Judge and symbolic columns (9/11, 3/33, 2/24, 0/11 ...) | quoted | equal to the `JUDGE_ROUND1` constant in the harness / scores.json; judge raw not in my scope | not re-derived | scores.json.judgeRound1 |
| 40 | §6 run-1 numbers (101 clean flags: clones 86, literals 12, cohesion 2, density 1; 289 near-miss) | as stated | no committed run-1 output | not reproducible | — |

Mismatches:
- **#35, "7 bases".** The eval runs one base per distinct `baseId` of the ok rows, and there are 8: the fixture, the 5 clean projects, and the 2 nestjs near-misses. Classification: **doc typo**. Severity: low (prose only).
- **#36, "70 variants".** The eval materialises 5 clean + 14 near-miss + 52 violation variants = 71. Classification: **doc typo**. Severity: low.
- **#32, LCOM4 "1.12".** The ddd mean is exactly 1.125. That prints as 1.12 under float or banker's rounding and as 1.13 under half-up. Classification: **rounding/definition ambiguity**. Severity: negligible.
- **#25, column note.** The "communities (diagnostic)" column counts `community-component-mismatch` flags (files), not detected communities (21 in total). It matches the harness's `flags.communities`, but the column name can mislead. Classification: **definition ambiguity**. Severity: low.

Not reproducible from committed files:
- §6 "Run 1" column (101 / 86 / 12 / 2 / 1 / 289): run-1 outputs were not committed. **Missing raw file.**
- Runtimes (56 s, 71 s) are machine-dependent by nature.
- The "261 live calls" figure is quoted from the judge doc (outside this group).

Regeneration (cheap proxies): **works without Neo4j, without any model, and without network.** The harness imports `src/neo4j-ingestion/layer-annotator.ts` only for the pure `annotateNodes` (picomatch, no driver). The exact working command, from the repo root:
```
for v in $(env | grep -oE '^[A-Z_]*API_KEY[A-Z_]*'); do unset $v; done
W=<scratch>/cheap-regen
npx tsx scripts/v1.3/judge-catch-seed.ts --out $W/work/seed
npx tsx scripts/v1.3/cheap-semantics-eval.ts --out $W/out --seed $W/work/seed --work $W/work
```
- Requirements: `npm ci`'d `node_modules` (the repo's typescript 5.9.3 `tsc.js` type-checks the copies) and node 22.
- Do **not** point `TMPDIR` at a long scratchpad path. My first attempt failed with `EADDRINUSE ... tsx-0/<pid>.pipe` because the unix-socket path was too long. Leave `TMPDIR` at its default.

Results against committed:
- `rows.csv`: **byte-identical** (`cmp`).
- `flags/*.json`: **53/53 byte-identical**. The committed tree also has `duprule-v2/`, which belongs to the v2 harness.
- `scores.json`: **differs only in volatile fields**. A structural diff gives 220 leaf differences, all of them in `generatedAt`, `rows[].totalMs`, `precision[].extractMs` / `totalMs` / `timingsMs.*` and `fixtureBase.timingsMs.*`. Every count, flag, rate, summary and violation entry is identical. This confirms the doc's claim that only `generatedAt` and the ms timings change.
- Seeding reproduced 125 manifest rows: 53 ok, 72 duplicate-not-applied.
- The run is deterministic apart from timings.

Regeneration (`cheap-semantics-v2-eval.ts` → `duprule-v2/`):
- It needs `judge-catch-v2-seed.ts`, which stages the 65 E1 cells from `../daedalus-e1-outcomes`. That sibling directory is **not present** in this container, so it cannot be regenerated here.
- It needs no Neo4j or model (header: "No LLM, no Neo4j, no network").
- It is outside this group's doc.

---

### v1.3-study1-rerun-2026-10-15.md

Raw sources used:
- `results/v1.3-study1-rerun/e1/reports/*.json` (72) and `*.size.json` (72);
- `results/e1-grid/reports/*.json` (65, Study 1);
- `results/e1-grid/agg/runs.csv`, `results/e1-grid/agg/so5_grid.csv`;
- `results/v1.3-study1-rerun/so4/score.json`, `so4/case/reports/*` (163 reports + 163 run records);
- `results/so4-heldout/v2/score.json`, `results/so4-heldout/v2/case/reports/*`;
- the repo's aggregate CSVs, checked against my own recomputation.

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | E1 cells evaluated / accepted / Claude / Codex | 72 / 65 / 47 / 18 | 72 / 65 / 47 / 18 | Y | reports, runs.csv |
| 2 | Non-accepted cells (Haiku) | 7 | 7 (`not-run`, `generation-failed`; GEN-TYPECHECK per runs.csv) | Y | runs.csv |
| 3 | Files/LOC equal so5_grid | 72/72 | 72/72 equal (keyed by model/task/level/run) | Y | size.json vs so5_grid.csv |
| 4 | Blocking findings, accepted / all 72 | 0/65, 0/72 | 0, 0; verdict pass 72/72; blockingAhs 1.000 in 72/72 | Y | reports.tiers |
| 5 | Blocking / advisory rule counts | 6 (S01, S02, S04, P01, P03, P06) / 16 | 6 identical set / 16 in all 72 | Y | reports.tiers |
| 6 | Headline table: n, files, LOC per model × level (15 rows) | e.g. opus none 6 / 11.0 / 569 ... codex full-aac 6 / 13.3 / 320 | all 15 rows identical | Y | own recompute |
| 7 | Advisory share (all rows) | 1.000 | 1.000 | Y | reports |
| 8 | CV05 share per row (0.821, 0.818, 0.841, 0.852, 0.815, 0.849, 0.742, 0.831, 0.806; Claude 0.816/0.819/0.838; Codex 0.776/0.887/0.842) | as table | identical | Y | reports |
| 9 | v1.3 symbolic/file per row (1.167 ... 1.191) | as table | identical | Y | reports + size |
| 10 | v1.2E ahsCombined per row (0.957 ... 0.942; Claude 0.951/0.887/0.920) | as table | identical | Y | e1-grid/reports |
| 11 | v1.2E symbolic/file and CV05 share per row | as table (e.g. opus none 1.112, 0.877) | identical | Y | e1-grid/reports |
| 12 | Claude symbolic/file v1.3 vs v1.2E | 1.165/1.155/1.152 vs 1.142/1.155/1.152 | identical | Y | reports |
| 13 | Claude mean files by level | 9.1 / 27.4 / 29.6 | 9.1 / 27.4 / 29.6 | Y | size.json |
| 14 | FF-C02 cells, Claude none / minimal-prose | 0/15, 15/16 | 0/15, 15/16 (full-aac 5/16) | Y | reports |
| 15 | v12e_share_cells_any_v13_blocking_rule | 0 everywhere | 0 in all groups | Y | e1-grid/reports |
| 16 | CV05 / all symbolic, 65 cells v1.3 | 1 184 / 1 428 = 0.829 | 1184/1428 = 0.829 | Y | reports |
| 17 | Same, Study 1 | 1 184 / 1 423 = 0.832 | 1184/1423 = 0.832 | Y | e1-grid/reports |
| 18 | Claude arm CV05 v1.3 / Study 1 | 1 003 / 1 213 = 0.827; 0.830 | 1003/1213 = 0.827; 1003/1208 = 0.830 | Y | both |
| 19 | 7 GEN-TYPECHECK cells: blocking, verdict, advisory range | 0, pass, 4 to 24, mostly CV05 | 0, pass, 4/10/9/24/18/23/17, CV05-dominated | Y | reports |
| 20 | ahsDeterministic reproduced / v12eVerdict = Study 1 verdict | 65/65, 65/65 | 65/65, 65/65 | Y | both |
| 21 | Cells with any finding change | 1 (e1-grid-001); 63 others 0 | only e1-grid-001 | Y | own multiset diff |
| 22 | FF-C03 change in e1-grid-001 | +6 / −1, net +5 (7 rows) | +6 / −1 | Y | own diff; finding_changes.csv |
| 23 | IMPORTS edges e1-grid-001 | 37 → 46 (+9) | 37 → 46 | Y | graphStats |
| 24 | IMPORTS e1-grid-016 | +2, no finding change | 126 → 128, no finding change | Y | graphStats |
| 25 | Disabled set identical, 65 cells | {CV01, CV04, S03} | {FF-CV01, FF-CV04, FF-S03} 65/65 | Y | disabledFunctions |
| 26 | unsupportedDynamic before/after | 0 | 0 in all 65 | Y | importResolution |
| 27 | SO4 projects | 163 = 7 bases + 156 copies | 163 run records, 7 bases | Y | so4/case/reports |
| 28 | SO4 recall per operator v1.2E / v1.3 (9 rows) | table | identical (e.g. MO-X01 0/6 → 6/6; MO-S01 8/8 + 2 n/a) | Y | both score.json perInstance |
| 29 | SO4 twin specificity per operator (9 rows) | table | identical (MO-C04 12/12 → 11/12) | Y | both score.json |
| 30 | Total recall | 67/73 = 0.918 → 73/73 = 1.000 | 67/73 = 0.918 → 73/73 = 1.000 | Y | perInstance |
| 31 | Total twin specificity | 68/73 = 0.932 → 67/73 = 0.918 | same (also equals `twinSpecificity` field) | Y | score.json |
| 32 | Seeds changed | 7 (6 MO-X01 + realworld C04n:1) | 7, same ids | Y | own diff; seed_changes.csv |
| 33 | MO-X01 detected by | FF-S01 + FF-S04 | FF-S01;FF-S04 for all 6 | Y | score.json |
| 34 | "Each also carries one new undeclared finding" | 1 each | 1 each except truthy-demo:MO-X01:0, which has 2 (FF-C01 + FF-C03) | ~ | score.json undeclaredNew |
| 35 | realworld base article.controller.ts C03 under v1.2E | 0.83, absent in v1.3 | instability 0.8333 in v2; absent in v1.3 | Y | case reports |
| 36 | Base table: blocking rules with findings (7 bases) | e.g. ghostfolio S01 44, S04 33, P01 1 | identical for all 7 | Y | so4/case/reports (bases) |
| 37 | Base blocking AHS | 0.667 / 0.487 / 0.333 / 0.513 / 0.513 / 0.333 / 0.462 | identical | Y | reports.tiers |
| 38 | Every base fails v1.3; Study 1 verdicts span warning to hard-block | as stated | 7/7 fail; v12e verdicts: warning, soft-block, hard-block | Y | reports |
| 39 | nestjslatam__ddd symbolic findings | 204 → 281 | 204 (v2) → 281 | Y | case reports |
| 40 | v-aguiar__valex FF-P06 now disabled | yes | P06 in v1.3 disabled set, not in v2's | Y | disabledFunctions |
| 41 | Reproducibility: E1 144/144, SO4 326/326 byte-identical across 2 passes | as table | only 1 pass committed; file counts 144 and 326 confirmed | not reproducible | — |
| 42 | Scorer reproduces frozen v2 `score.json` byte for byte | yes | yes (re-ran scorer on `results/so4-heldout/v2/case`: `cmp` identical) | Y | regenerated |

Mismatches:
- **#34.** The doc says each MO-X01 seed "carries one new undeclared finding". truthy-demo:MO-X01:0 carries two: FF-C01 and FF-C03 on `dashboard.entity.ts`. The doc's "FF-C01 or FF-C03" wording hides it. Classification: **doc typo / imprecision**. Severity: low. No scored number is affected.

Not reproducible from committed files:
- The second-pass outputs behind the 144/144 and 326/326 byte-identity claims were not committed. **Missing raw file.**
- The Neo4j/memory/lock run notes are process notes, not checkable.

Regeneration:
- **Offline and deterministic**, all byte-identical to committed. They read only committed files: no Neo4j, no model. Run from the repo root with `O=<scratch dir>`:
  - E1 aggregates: `npx tsx scripts/v1.3/study1-rerun.ts e1-agg --run results/v1.3-study1-rerun/e1 --out $O/e1`. This byte-reproduced `by_level_model.csv`, `cells.csv`, `rule_changes.csv`, `finding_changes.csv`, `graph_changes.csv`, `disabled_changes.json` and `README.md`. It reads `experiments/e1-grid/plan.json`, `results/e1-grid/agg/runs.csv` and `results/e1-grid/reports/`.
  - SO4 score: `npx tsx scripts/score-golden-cli.ts --case results/v1.3-study1-rerun/so4/case --out $O/so4/score.json` gives a byte-identical `score.json`.
  - SO4 aggregates: `npx tsx scripts/v1.3/study1-rerun.ts so4-agg --run $O/so4 --out $O/so4` byte-reproduced `by_operator.csv`, `seed_changes.csv` and `summary.json`.
  - Scorer check: `npx tsx scripts/score-golden-cli.ts --case results/so4-heldout/v2/case --out $O/v2-score.json` is byte-identical to `results/so4-heldout/v2/score.json`.
- **Needs Neo4j 5.26 + APOC and sibling checkouts** (not run). The CLI is deterministic per the doc's two-pass claim.
  - The reports themselves: `study1-rerun.ts e1` needs `../daedalus-e1-outcomes` and `NEO4J_URI` / `NEO4J_PASSWORD` from `~/.daedalus-bt.env`.
  - `study1-rerun.ts so4` needs `--paths-root` with `../daedalus-corpus` and `../daedalus-so4`.

---

### v1.3-labelling-2026-10-15.md

Raw sources used:
- `results/v1.3-labelling/{reference,e1}/correctness-all/correctness.{json,csv}` (per-row verdicts, recounted);
- `{reference,e1}/sample-all.json`, `{reference,e1}/jobs.json`, `e1/reports/*.json` (65);
- `results/e1-grid/reports` (Study 1 counts), `results/v1.3-study1-rerun/e1/reports` (cross-check);
- `cassettes-codex/78/78414f91….json`;
- `audit/view/v1.3-labels-audit.md`, `audit/key/v1.3-labels-audit.key.json`, and the version of the sheet at doc commit `2c1098c7` (via `git show`).

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Reference findings | 1,663 | 1,663 rows | Y | reference correctness.json |
| 2 | Reference correct | **1,484** | **1,485** | **N** | correctness.json results (and its own summary) |
| 3 | Reference not-checkable | **179** | **178** (175 "no deterministic check" + 3 FF-P06 FLOWS_TO) | **N** | correctness.json |
| 4 | Reference incorrect | 0 | 0 | Y | correctness.json |
| 5 | Total checkable, all correct | **2,668** | **2,669** (1,485 + 1,184) | **N** | both correctness.json |
| 6 | Reference per-rule table (28 rows: n, correct, incorrect, n/c) | as table | all 28 rows identical; the table's own column sums are 1,485 / 178 | Y | correctness.json |
| 7 | Reference per-rule Wilson intervals | e.g. [0.207,1], [0.342,1], [0.646,1], [0.741,1], [0.610,1], [0.566,1], [0.439,1], [0.997,1] | identical | Y | own Wilson + summary |
| 8 | Blocking with a deterministic check, correct | 54 of 54 | 54/54 (57 blocking, 3 P06 n/c) | Y | correctness.json |
| 9 | FF-P06 FLOWS_TO rows N/A | 3 | 3 | Y | correctness.json, sample excludedNotApplicable |
| 10 | Reference variants / jobs | 71 | 71 jobs (68 projects carry findings) | Y | reference/jobs.json |
| 11 | E1 cells / findings | 65 / 1,428 | 65 reports / 1,428 | Y | e1/reports, e1 correctness.json |
| 12 | E1 correct / incorrect / not-checkable | 1,184 / 0 / 244 | 1,184 / 0 / 244 | Y | e1 correctness.json |
| 13 | E1 per-rule table (8 rows) + CV05 Wilson [0.997, 1.000] | as table | identical (0.99677 → 0.997) | Y | e1 correctness.json |
| 14 | E1 rule counts v1.3 vs Study 1 (CV05 1184/1184, C03 159/154, P02 51/51, C02 21/21, C06 6/6, SO01 3/3, C04 2/2, SO02 2/2) | as table | identical; Study 1 sums to 1,423 | Y | e1/reports, e1-grid/reports |
| 15 | Only difference: +5 FF-C03 | 5 | 159 − 154 = 5 | Y | same |
| 16 | E1 labelling reports = Study 1 re-run reports | (implied) | per-cell finding multisets identical, 65/65 | Y | cross-check |
| 17 | No blocking-tier finding in E1 | 0 | 0 (all 8 rules advisory) | Y | e1/reports |
| 18 | E1 jobs carry `tsconfig: adr-032` | all | 65/65 | Y | e1/jobs.json |
| 19 | Not-checkable reasons are only "no deterministic check" or P06 FLOWS_TO | as stated | 175 + 3 (reference), 244 (E1) | Y | correctness.json |
| 20 | Sample: reference items / rules | 194 / 27 | 194 / 27 (population 1,660 after 3 excluded) | Y | reference/sample-all.json |
| 21 | Sample: E1 items / rules | 154 / 8 | 154 / 8 | Y | e1/sample-all.json |
| 22 | Total items / rules | 348 / 35 | 348 / 35 | Y | both |
| 23 | `--estimate` calls ref / E1 / total; worst case | 388 / 308 / 696; 1,552 / 1,232 / 2,784 | `label-meaningful --estimate`: 388 (1552), 308 (1232); sum 696 / 2,784 | Y | regenerated (no calls) |
| 24 | Budget split: ref blocking 54 items / 108 calls | 54 / 108 | 54 blocking sampled items (exhaustive) → 108 | Y | sample-all.json |
| 25 | E1 C03 + P02 + CV05: 120 items / 240 calls | 120 / 240 | 40 + 40 + 40 = 120 → 240 | Y | sample-all.json |
| 26 | E1 C06 + SO01 + C04 + SO02: 13 items / 26 calls; total 374, leaves 26 | 13 / 26 / 374 / 26 | 6 + 3 + 2 + 2 = 13; 108 + 240 + 26 = 374; 400 − 374 = 26 | Y | sample-all.json |
| 27 | Codex smoke: 1 answered call, 8,050 in / 30 out tokens | as stated | 1 cassette file: inputTokens 8050, outputTokens 30, model gpt-5.6-terra, choice "A" | Y | cassettes-codex |
| 28 | Audit sheet: items / seed / stratified by | 40 / 20261015 / rule | 40 / 20261015 / rule | Y | audit key |
| 29 | Audit: rules covered; ref / E1 items | 30; 33 / 7 | 30; 33 / 7 | Y | audit key |
| 30 | No `FF-` id on the sheet | 0 | 0 (HEAD and 2c1098c7) | Y | audit view |
| 31 | Excerpt lines that state the answer on the sheet | 9 | 9 lines matching "violation" at doc commit 2c1098c7; **0 at HEAD** (sheet scrubbed by 10968ceb) | stale | audit view |
| 32 | Labelling unit tests | 37 pass | 38 `it(` calls at 2c1098c7, 45 now (not executed) | not verified | tests/unit/scripts/v1.3/labelling |
| 33 | E1 cells without tsconfig.json (earlier failed attempt) | 63 | outcomes dir not available | not reproducible | — |

Mismatches:
- **#2, #3, #5, reference totals.**
  - The doc's totals line ("1,484 correct, 0 incorrect, 179 not-checkable") and the Summary ("All 2,668 checkable findings ... 1,484 of 1,663") disagree with the committed per-row data: 1,485 correct and 178 not-checkable, so 2,669 checkable.
  - They also disagree with the doc's own per-rule table, whose columns sum to 1,485 and 178.
  - `correctness.json` has not changed since the doc commit (`git log` shows only `2c1098c7`), and a fresh offline `check-correct` run reproduces it byte for byte (below). The error is in the prose, not the data.
  - Classification: **doc typo** (arithmetic slip in the totals and summary). Severity: low to medium. It is a headline number, but off by one in the favourable direction, and the conclusion (0 incorrect) is unchanged.
- **#31, "9 excerpt lines" on the audit sheet.**
  - True at write time: 9 lines matched "violation" in the sheet at `2c1098c7`.
  - Commit `10968ceb` then regenerated the sheet with comments stripped. Its message says "19 comment lines gone, the 9 items that leaked (A002 ...)". The committed sheet now has 0 such lines.
  - The doc still describes the confound as present on the sheet. The doc's own remedy 1 was applied but not recorded.
  - Classification: **stale number**. Severity: low. It matters for anyone reading §3 "Confound" as an open issue for the audit sheet.

Not reproducible from committed files:
- E1 correctness re-check: the jobs point at `../daedalus-e1-outcomes` (absolute `/Volumes/...` paths), which is not committed. **Missing raw file.** The committed `e1/correctness-all` cannot be regenerated here. Its counts are internally consistent with the committed `e1/reports`.
- The "63 cells without tsconfig.json" from the discarded attempt: **missing raw file**.
- The refused second Codex call is not stored by design.
- The test count was not executed (jest not run).

Regeneration:
- **Reference jobs + sample + correctness:** offline and deterministic. Three output files are byte-identical; no Neo4j, no model.
  ```
  npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-member-facts/evidence --materialise $O/variants --out $O/ref/jobs.json
  npx tsx scripts/v1.3/sample-findings.ts --jobs $O/ref/jobs.json --seed 20261015 --tiers all --out $O/ref/sample-all.json
  npx tsx scripts/v1.3/check-correct.ts --jobs $O/ref/jobs.json --tiers all --out $O/ref/correctness-all
  ```
  - `sample-all.json`: byte-identical.
  - `correctness.json`: byte-identical.
  - `correctness.csv`: byte-identical. `check-correct` took 28 s.
  - `jobs.json` itself differs only in absolute paths, which are machine-specific by construction.
- **E1 sample:** offline and byte-identical. The committed `e1/jobs.json` holds absolute `/Volumes/...` paths, so they must be rewritten first:
  - point `report` at `results/v1.3-labelling/e1/reports/<file>`;
  - point `spec` at `specs/clean-arch.yaml`;
  - then run `npx tsx scripts/v1.3/sample-findings.ts --jobs <rewritten jobs> --seed 20261015 --tiers all --out $O/e1/sample-all.json`.
- **E1 correctness:** needs `../daedalus-e1-outcomes` (source trees). It is not available here, and it is deterministic.
- **E1 reports:** need Neo4j 5.26 + APOC and the outcomes dir (`scripts/v1.3/e1-v13-evaluate.ts`).
- **Meaningful labels:** model-dependent.
  - Only `--estimate` was run (it prints counts and makes no calls).
  - A cassette replay of the one stored answer is possible with `--mode replay`, but it is not a label: the item needs 2 runs.
  - The Codex CLI needs `CODEX_HOME`; it was not run.
- **Audit sheet:** `scripts/v1.3/audit-sheet.ts` exists but was not re-run. The key is said to be byte-stable across `10968ceb`.

---

### Secrets / personal-path grep (files touched)

Patterns checked:
- secret prefixes: `sk-`, `sk-ant-`, `AIza`, `ghp_`, `github_pat_`, `xox[bp]-`, `AKIA`;
- `PRIVATE KEY`, `Bearer`, `NEO4J_PASSWORD`;
- JSON `password|apiKey|api_key|secret` values.

Result: **no secret or token hits.** The raw `sk-` hits were all the substring of "ta**sk-**management", a false positive.

Absolute personal paths (not changed):
- `results/v1.3-labelling/e1/jobs.json`: **195 lines**. Kind: `/Volumes/<volume>/Users/<author>/Development/Archi-Firewall/...` (daedalus-e1-outcomes, worktree `.claude/worktrees/agent-a0087368d97ca645a`). Personal username plus an agent worktree path. Example: line 7 `projectRoot`.
- `results/v1.3-labelling/reference/jobs.json`: **213 lines**. Kind: `/Volumes/<volume>/Users/<author>/...` spec paths and `/private/tmp/claude-501/-Volumes-<volume>-Users-<author>-.../scratchpad/ref-variants/...` projectRoot. Examples: lines 7 and 8.
- `results/v1.3-study1-rerun/so4/case/reports/so4-heldout-0{01,23..37}-ghostfolio-test*.json`: 16 files, **22 lines each (352)**. Kind: `/Volumes/<volume>/Users/<author>/Development/Archi-Firewall/daedalus-corpus/ghostfolio-test/libs/...` inside `CONSTRUCTOR_INJECTS type unresolvable: import("…")` warning messages (e.g. `so4-heldout-034-ghostfolio-test_MO-CV02n_1.json:6032`).
  - The driver's path normalisation only replaces the evaluated directory, and these `libs/` paths lie outside it.
  - The Study 1 v2 case reports have 0 such paths, so this leak is new in the v1.3 re-run.
- `results/v1.3-cheap-semantics/**`: none. `results/v1.3-study1-rerun/e1/**`: none.
- `/home/home.*.ts` hits in SO4 reports are project source paths (`src/home/home.service.ts`), not personal paths.

---

## Summary

- **cheap-semantics-2026-10-15.md**
  - 34 of 40 rows match exactly. That covers every catch, twin, clean, analogue, precision, ARI, runtime and summary number in §2–§5.
  - Two prose typos: "7 bases" (actual 8) and "70 variants" (actual 71). One rounding nuance (LCOM4 1.125 shown as 1.12) and one column-label ambiguity (the communities column counts mismatch flags).
  - §6 run-1 numbers: missing raw file.
  - The cheap proxies **regenerate without Neo4j, model or network**: `rows.csv` and all 53 `flags/*.json` are byte-identical, and `scores.json` differs only in `generatedAt` and ms timings.
- **v1.3-study1-rerun-2026-10-15.md**
  - Every headline number reproduces from the raw reports, independently and through the repo aggregators, which byte-reproduce all committed CSV and JSON offline. That includes 15-row E1 table, the CV05 counts, the change attribution, SO4 recall 67/73 → 73/73, specificity 68/73 → 67/73, and the base table.
  - One imprecision: truthy-demo:MO-X01:0 has 2 collateral findings, not 1.
  - The two-pass byte-identity claims cannot be checked, because pass 2 is not committed.
- **v1.3-labelling-2026-10-15.md**
  - Per-rule tables, samples, call estimates, budget split, cassette and audit-sheet structure all reproduce.
  - **Headline totals are off by one:** reference correct is 1,485, not 1,484; not-checkable is 178, not 179; checkable is 2,669, not 2,668. The committed data and the doc's own per-rule table agree with each other against the prose.
  - The "9 answer-leaking excerpt lines" is stale: the sheet was scrubbed in `10968ceb`.
  - Reference correctness and samples regenerate byte-identically offline. E1 correctness needs the absent `../daedalus-e1-outcomes`.
- **Hygiene:** no secrets. Personal absolute paths (`/Volumes/<volume>/Users/<author>/...`, `/private/tmp/claude-501/...`) appear in both labelling `jobs.json` files and in 16 ghostfolio SO4 v1.3 reports.

Exact working cheap-proxy command (repo root, no Neo4j, default TMPDIR, API keys unset):
```
W=<scratch>/cheap-regen
npx tsx scripts/v1.3/judge-catch-seed.ts --out $W/work/seed && \
npx tsx scripts/v1.3/cheap-semantics-eval.ts --out $W/out --seed $W/work/seed --work $W/work
```
