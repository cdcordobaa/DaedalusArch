# Reproducibility audit, group A (v1.3 graph fidelity, ISE prototype, ISE on E1)

Repo `<REPO>`, branch `v1.3-replication` @ `afc4169a`. No repo file was edited (`git status` shows only a pre-existing untracked `replication/README.md`, not created by this audit). No Neo4j, no model/network call. Scratch scripts and outputs: `<scratch>/` (`fid.py`, `agg.mjs`, `ise.py`, `nearmiss.ts`, `e1.py`, `opt1.py`, and the scratch re-runs `ise/`, `e1/`).

Method: independent Python recomputation from the lowest committed level (per-edge CSVs, per-variant rows, per-cell records), plus a JS re-implementation of the harness's unexported `aggregate()` run on the committed per-project JSON, plus the repo's own offline replays (`ise-downstream.ts --from-raw`, `ise-e1-report.ts`) into scratch with a byte compare.

---

### v1.3-graph-fidelity-2026-10-14.md

Raw sources used: `results/v1.3-fidelity/{e1,so4}/projects/*.csv` (edge-level membership of each edge in APG default and dynamic, depcruise and tsc, plus scope, tsc kinds and class columns), `projects/*.json` (per-project agreement, classes and layer), `aggregate.json`, `adjudication.csv`, `layer-review.csv`, `manifest.json`. `results/v1.3-barrels` is **not** cited by this doc, so it was not used.

Independent checks done:
- The edge-level CSV recount equals the per-project JSON counts (both/APG/ref, scoped and raw, for depcruise and tsc) in all 79 projects, with 0 mismatches.
- My JS re-implementation of `aggregate()` (`graph-fidelity.ts` l.370–432, not exported), run on the committed `projects/*.json`, reproduces both `e1/aggregate.json` and `so4/aggregate.json` **byte-identically**. Here `adjudicationRows` comes from the row count of `adjudication.csv`.

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | E1 cells measured / judged / generation-failed | 72 / 65 / 7 | 72 / 65 accepted / 7 `not-run:generation-failed` | yes | e1/projects/*.json meta |
| 2 | SO4 bases | 7 | 7 | yes | so4/aggregate.json |
| 3 | E1 dc scoped=raw both/APG/ref | 3306/3334/3317 | 3306/3334/3317 (scoped = raw; all E1 edges in-scope) | yes | e1 CSVs |
| 4 | E1 dc cov / conf / Jaccard | 0.996684 / 0.991602 / 0.988341 | same | yes | e1 CSVs, aggregate.json |
| 5 | E1 tsc (same row) | identical to dc | identical | yes | e1 CSVs |
| 6 | SO4 dc scoped both/APG/ref; cov/conf/J | 1465/2432/1545; 0.948220/0.602385/0.583201 | same | yes | so4 CSVs |
| 7 | SO4 tsc scoped | 2294/2432/2374; 0.966302/0.943257/0.913217 | same | yes | so4 CSVs |
| 8 | SO4 dc raw | 1465/2432/2494; 0.587410/0.602385/0.423288 | same | yes | so4 CSVs |
| 9 | SO4 tsc raw | 2294/2432/2907; 0.789130/0.943257/0.753366 | same | yes | so4 CSVs |
| 10 | APG default vs dynamic variants identical | identical edge sets | 0 rows differ in either corpus; variant aggregates equal | yes | CSV `in_apg-*` columns |
| 11 | E1 dc and tsc agree exactly (union = intersection) | yes | union and intersection micro = dc = tsc | yes | e1/aggregate.json |
| 12 | E1 projects with perfect agreement | 70/72 | 70 | yes | aggregate perProject |
| 13 | opus task-mgmt/none/run-1 cov / conf / J | 0.7000 / 0.4773 / 0.3962 | 21/30, 21/44, 21/53 = 0.7 / 0.477273 / 0.396226 | yes | project JSON + CSV |
| 14 | opus order-fulf/full-aac/run-1 cov / conf | 0.9832 / 0.9590 | 117/119, 117/122 | yes | project JSON + CSV |
| 15 | SO4 scoped tsc: nestjslatam / realworld / truthy | 0.8529/0.7616; 0.9437/0.8816; 0.9642/0.9642 | 0.852941/0.761616; 0.943662/0.881579; 0.964169/0.964169 | yes | so4 project JSON |
| 16 | the other four SO4 projects | 1.0 / 1.0 | 1/1 (dry-run, ghostfolio, valex, zhuravlevma) | yes | aggregate perProject |
| 17 | ghostfolio confirmed vs dc | 0.1896 | 0.189638 (194/1023) | yes | ghostfolio-test.json |
| 18 | "raw agreement missed in 1 E1 / 2–3 SO4 projects" | 1 / 2–3 | E1: 1 ✓. SO4 **raw**: tsc cov <0.95 in **4**, conf in 2; dc in 5 / 3. SO4 **scoped**: tsc 2/2, dc 2/3 | **partial** | aggregate `projectsBelow095` (see M1) |
| 19 | E1 class barrel missing-in-apg / -in-ref (dc and tsc) | 11 / 28 | 11 / 28 | yes | CSV class cols, aggregate |
| 20 | SO4 tsc: barrel 80/138, excluded 202, out-of-root 329, .d.ts 2 | as claimed | 80/138, 202, 329, 2 | yes | so4 CSV class cols |
| 21 | SO4 dc: barrel 80/138, path-alias 829, excluded 308, out-of-root 639, .d.ts 2 | as claimed | same | yes | so4 CSV class cols |
| 22 | extractor-bug (unexplained) | 0 / 0 | 0 in both corpora | yes | aggregate disagreementClasses |
| 23 | E1 type-only occurrences, all agree | 142 | 142 edges with a `type-import` kind (135 + 7 mixed), all in all 3 sets (+3 `type-re-export` edges, also agreeing) | yes (edge-level) | e1 CSV `tsc_kinds` |
| 24 | E1 `import()` / `require()` | 0 | 0 dynamic or require kinds; 0 unresolved | yes | e1 CSV, meta.tsc |
| 25 | SO4 `require()` of .json, unresolved by tsc | 6 | 6 unresolved, all `.json`, all ghostfolio | yes | ghostfolio-test.json meta.tsc |
| 26 | Scoped tsc agreement without by-design classes | 1.0 both corpora | the scoped tsc disagreements are all barrel (E1 28+11; SO4 138+80) | yes | CSV |
| 27 | E1 adjudication disagreement rows | 39 | 39 (28 exists-via-barrel + 11 exists-resolves-to-target) | yes | e1/adjudication.csv |
| 28 | SO4 adjudication rows: 1996 = 1852 + 138 + 6 | as claimed | 1852 / 138 / 6 (the 6 elsewhere = ghostfolio .json) | yes | so4/adjudication.csv |
| 29 | Agreement samples | 50 per corpus, all resolves-to-target | 50 / 50 | yes | adjudication.csv |
| 30 | human_verdict filled | empty | 0 of 89 and 0 of 2046 | yes | adjudication.csv |
| 31 | ghostfolio `@ghostfolio/api/*` edges missing in dc | 829 | 829 path-alias rows, all `@ghostfolio/api` specifiers | yes | so4 adjudication.csv |
| 32 | Barrel example run-1: InMemoryOrderRepository → 3 domain files, no edge to application/ports/persistence | as claimed | APG 1 for Order.ts, OrderRepository.ts, OrderStatus.ts; persistence.ts APG 0 / tsc 1 | yes | project CSV |
| 33 | Barrel example task-mgmt/none/run-1: "28 edges to declaring files, 11 edges to barrels disappear" | 28 / 11 | **23 / 9** for this project; 28 / 11 are the E1 corpus totals | **no** (M2) | project JSON classes, CSV |
| 34 | E1 layer assigned | 1319/1332 (0.990240) | 1319/1332 = 0.99024 | yes | project JSON layer |
| 35 | E1 lowest project | 0.75 (haiku tm none run-0, 3/4) | 0.75, 3/4 | yes | project JSON |
| 36 | E1 unassigned: 12 `src/index.ts` + 1 `src/server.ts` | 13 | 12 + 1 (all haiku) | yes | project JSON |
| 37 | SO4 layer assigned | 602/833 (0.722689) | 602/833 = 0.722689 | yes | project JSON |
| 38 | SO4 lowest: truthy-demo 0.549618 (72/131) | as claimed | 72/131 | yes | truthy-demo.json |
| 39 | annotateNodes vs glob inconsistencies | 0 | 0 | yes | layer.inconsistencies |
| 40 | layer-review rows, seed | 40 per corpus, seed 20261015 | 40 / 40; manifest `layerSampleSeed` 20261015 | yes | layer-review.csv, manifest.json |
| 41 | 218 SO4 barrel rows to adjudicate | 218 | 80 + 138 | yes | CSV |

Mismatches:
- **M1 (row 18).** The doc says "the **raw** agreement is missed in 1 E1 project and in 2–3 SO4 projects".
  - The raw figures in `so4/aggregate.json` (`tsc.raw.projectsBelow095` = {cov 4, conf 2}; `depcruise.raw` = {5, 3}) give 4 (tsc) or 5 (dc) projects below 0.95 on coverage. ghostfolio, nestjslatam, realworld and truthy are below on tsc raw coverage.
  - "2–3" matches the **scoped** counts (tsc 2/2, dc 2/3).
  - Classification: rounding/definition ambiguity (the scope label is wrong).
  - Severity: low. It understates the raw misses, but the doc explains all of them by class, and the conclusion (no unexplained disagreement) is unaffected.
- **M2 (row 33).** In the barrel-routing example for `claude-opus-5-5/task-management/none/run-1`, the doc says imports "become 28 edges to declaring files, and the 11 edges to the barrels disappear".
  - That project has onlyApg = 23 and onlyRef = 9 (`classes.tsc`: missing-in-ref barrel 23, missing-in-apg barrel 9). The 9 missing edges all point to `index.ts` barrels, and the APG has 0 edges into `index.ts`.
  - 28 / 11 are the E1 totals, which add order-fulfilment run-1's 5 / 2.
  - Classification: doc typo (the corpus totals were attributed to one project).
  - Severity: none on conclusions.

Not reproducible from committed files (missing raw file / input outside the container):
- Regenerating any per-project JSON or CSV. The E1 and SO4 modes read `../daedalus-e1-outcomes` and `../daedalus-so4/bases`, and neither is in the container.
- "A full E1 rerun gave byte-identical outputs" and "an earlier SO4 rerun did too". No second-run outputs are committed, so these can only be taken on trust.
- Everything downstream of the per-project files is fully re-derivable.

Regeneration:
- Per-project data:
  - Command: `node --import tsx scripts/v1.3/graph-fidelity.ts e1 --outcomes ../daedalus-e1-outcomes --out <dir>`, and `... so4 --bases ../daedalus-so4/bases --out <dir>`, with `--dynamic-extractor <v1.3-extractor-fixes@f44e102>/src/apg-extractor/index.ts` for the second variant.
  - Neo4j: not needed.
  - Determinism: claimed deterministic, but not runnable here because the inputs are missing.
- Aggregate:
  - `aggregate()` is not exported. My re-implementation `auditA/agg.mjs` on the committed `projects/*.json` gives byte-identical `aggregate.json` for both corpora (offline, deterministic).

---

### ise-prototype-2026-10-15.md

Raw sources used: `results/v1.3-ise/2026-10-15/measure.json`, `measure.md`, `downstream.json`, `downstream.md`, `raw/<target>/<variant>.json` (142 files), `specs/*.yaml` and `specs/*.true.yaml`, and `src/scoring-engine/rule-tiers.ts` (`ruleTier`) for the near-miss check.

Independent checks done:
- (a)–(c) and Options 1 and 3 were recomputed from the per-target and per-variant records of `measure.json`.
- (d) was recomputed from the per-variant rows of `downstream.json`. Separately, `raw/` → `downstream.json` was replayed with `--from-raw`.
- The near-miss blocking check was re-derived from `raw/` with my own script (`nearmiss.ts`).

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Reference variants | 71 | 14+13+14+15+15 = 71 | yes | measure.json |
| 2 | (a) clean / layered / nestjs / hexagonal / ddd confidence | 1.00 / 1.00 / 0.86 / 0.82 / 0.75 | 1 / 1 / 0.857 / 0.818 / 0.75 | yes | measure.json |
| 3 | (a) runners-up | nestjs clean 0.14, hex clean 0.18, ddd clean 0.25 | 0.143 / 0.182 / 0.25 | yes | measure.json |
| 4 | (a) variants correct on refs | 71/71 (14, 13, 14, 15, 15) | 71/71 | yes | measure.json variants.classifiedAs |
| 5 | (a) P1 / P2 / P3 | correct, 1.00, 14/14, 13/13, 14/14 | same | yes | measure.json |
| 6 | (a) P4 | clean-architecture 0.67, hexagonal 0.33, 0/15 | 0.667 / 0.333 / 0/15 | yes | measure.json |
| 7 | (a) P5 | clean-architecture 1.00, 0/15 | 1.00 (runner-up layered 0.00, shown as "—") / 0/15 | yes | measure.json |
| 8 | (b) refs preset-first / infer-only | 146/146 / 146/146 | 146/146 / 146/146 | yes | measure.json layerAccuracy |
| 9 | (b) P1, P2, P3 | 29/29, 27/27, 28/29 (both modes) | same | yes | measure.json |
| 10 | (b) P4, P5 | 20/30 (67%), 6/31 (19%), both modes | same | yes | measure.json |
| 11 | (b) pooled confidence buckets, 10 targets, preset-first | high 123/123, medium 42/42, low 91/127 (72%) | 123/123, 42/42, 91/127 (71.7%) | yes | measure.json byConfidence |
| 12 | (b) every wrong file is low-confidence | 36 wrong, all low | wrong = 1 + 10 + 25 = 36 = 127 − 91 | yes | measure.json |
| 13 | (c) spec valid, all targets | yes | 10/10 specValid, 0 errors | yes | measure.json |
| 14 | (c) glob-text diffs nestjs / ddd / P3 / P4 / P5 | 22 / 14 / 24 / 5 / 8 (others 0) | same | yes | measure.json specEquivalence |
| 15 | (c) clean files with another layer: P3 / P4 / P5 | 1/29, 10/30, 25/31 (others 0) | same, both modes | yes | measure.json |
| 16 | (c) DDD block: ddd identical; P5 8/8 differ | 0 / 8 | ddd `[]`; P5 lists 8 fields | yes | measure.json, measure.md |
| 17 | (d) evaluations | 142 | 142 variant rows and 142 raw files (each with 2 evaluations, so 284 firewall runs) | yes (definition: per-variant) | downstream.json, raw/ |
| 18 | (d) refs and P1–P3: verdict, identical set, Jaccard | all n/n, n/n, 1.00 | 112/112 variants identical | yes | downstream.json |
| 19 | (d) P4: verdict / identical / Jaccard | 11/15, 10/15, 0.71 | 11/15, 10/15, 0.7111 | yes | downstream.json |
| 20 | (d) P5 | 8/15, 7/15, 0.47 | 8/15, 7/15, 0.4667 | yes | downstream.json |
| 21 | (d) planted (true / inferred) per target | clean 9/10, layered 9/9, nestjs 9/10, hex 11/11, ddd 11/12, P1–P3 as originals, P4 11/11 → 5/11, P5 11/12 → 0/12 | same | yes | downstream.json |
| 22 | (d) touched P4 / P5 (true / inferred) | 11/11 / 7/11; 11/12 / 3/12 | same | yes | downstream.json |
| 23 | Refs planted recall (rule-exact), inferred = true | 49/52 | 49/52 under both | yes | downstream.json |
| 24 | The three misses | clean v07, nestjs v09, ddd g01 | v07-controller-reads-entity, v09-controller-returns-entity, g01-value-object-setter-accessor | yes | downstream.json |
| 25 | Option 2 touched: refs / P1–P3 / P4+P5 | 49/52 / 27/29 / 10/23 | 49/52 / 27/29 / 7 + 3 = 10/23 | yes | downstream.json |
| 26 | Option 2 new blocking on 14 near-miss variants; advisory rules only | 0; FF-C03, FF-CV03, FF-CV05, FF-P02 | 14 near-miss variants, 0 new blocking; new advisory FF-C03 ×5, FF-CV05 ×7, FF-CV03 ×2, FF-P02 ×1 | yes | raw/ + ruleTier (own script) |
| 27 | Option 1 touched: refs / P1–P3 / P4+P5 | 39/52 / 24/29 / 10/23 | 39 / 24 / 8 + 2 = 10 | yes | measure.json variants.option1 |
| 28 | Option 1 per style | 9/10, 9/9, 6/10, 10/11, 5/12 | same | yes | measure.json |
| 29 | Option 1 near-miss false alarms | 5 deviations on 3 of 14 (nestjs n03 1, ddd g02 3, ddd n01 1) | same | yes | measure.json |
| 30 | Option 3 touched: refs / P1–P3 / P4+P5; per style | 21/52 / 12/29 / 5/23; 5/10, 2/9, 5/10, 7/11, 2/12 | same | yes | measure.json variants.option3 |
| 31 | Option 3 near-miss false alarms | 0 | 0 | yes | measure.json |
| 32 | P5 verdicts disagree | 7/15 | 15 − 8 = 7 | yes | downstream.json |
| 33 | Unit tests (§7 command) | 43 | at HEAD the §7 command runs **49** (12 suites). Excluding `ise-e1.test.ts` (6 tests, added later in 03dab10f) gives 43 | stale (benign) | jest run (M3) |

Mismatches:
- **M3 (row 33).** The §7 jest pattern `tests/unit/scripts/v1.3/ise-` now also matches `ise-e1.test.ts`, which a later commit added, so the command runs 49 tests (all pass). The 43 tests that existed when the doc was written all pass.
  - Classification: stale number.
  - Severity: none.

No result-number mismatches.

Not reproducible from committed files:
- The live Neo4j runs that produced `raw/`. This is a design limit, not missing data: `raw/` is committed and replays exactly.
- The provenance claim that the rows came from a scratch run made before the lint-only edits of 177a7bef. It cannot be checked, but `measure.json` and the specs regenerate identically at HEAD, which is consistent with it.

Regeneration:
- (a)–(c):
  - Command: `node --import tsx scripts/v1.3/ise-measure.ts --out <dir>`.
  - Neo4j: no.
  - Determinism: deterministic. It is already known to be byte-identical for `measure.json`, `measure.md` and `specs/*.yaml` (cited, not redone).
- (d) replay:
  - Command: copy `specs/` (minus `*.true.yaml`) and `raw/` to scratch, then `env -u NEO4J_URI -u NEO4J_PASSWORD node --import tsx scripts/v1.3/ise-downstream.ts --from-raw --out <scratch>`.
  - Neo4j: no.
  - Result: exit 0. `downstream.json` and `downstream.md` are **byte-identical**, and all 10 regenerated `specs/*.true.yaml` are byte-identical to the committed ones.
- (d) live:
  - Command: `NEO4J_URI=... NEO4J_PASSWORD=... node --import tsx scripts/v1.3/ise-downstream.ts --out <dir>`.
  - Neo4j: needs 5.26 + APOC. Not run.

---

### ise-e1-ics-2026-10-15.md

Raw sources used:
- `results/v1.3-ise-e1/cells.json`. All 65 entries of `cells/*.json` are equal to it.
- `raw/*.json` (65 files, `given` and `inferred` finding sets).
- `option1.json`, `summary.json`, `summary.md`, `option1.md`.
- `results/e1-grid/runs/*.run.json` (status counts).
- `results/v1.3-labelling/e1/reports/*.json` (the cross-check).
- `Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md` (the ahsCombined values).

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Accepted cells (Claude / Codex) | 65 (47 / 18) | 65 (47 / 18); runs dir: 65 accepted, 7 not-run | yes | cells.json, e1-grid/runs |
| 2 | Cells per level | 21 / 22 / 22 | 21 / 22 / 22 | yes | cells.json |
| 3 | §3.2 all 15 rows: cells, style match, abstains, mean confidence, mean ICS, ICS_ahs, ext_ahs, pass, blocking/file, advisory/file, mean files | e.g. none-all 21, 21/21, 0, 0.98, 1.000, 1.000, 1.000, 21/21, 0, 1.207, 8.3 | **every cell of all 15 rows reproduces** (advisory/file 1.144, 1.167, 1.172, 1.313, 1.207, 1.042, 1.153, 1.232, 1.126, 1.147, 1.190, 1.122, 1.157, 1.191, 1.163; mean files 8.3, 11.0, 7.7, 6.3, 8.3, 20.0, 34.2, 25.7, 10.5, 22.8, 19.5, 39.3, 26.7, 13.3, 25.2) | yes | cells.json |
| 4 | Extrinsic site ratio 1.000 in every cell | yes | 65/65 | yes | cells.json |
| 5 | Blocking findings under either spec | 0 | 0 | yes | cells.json |
| 6 | Median checked sites none / mp / full | 19 / 69 / 73 | 19 / 69 / 73 | yes | cells.json |
| 7 | 2×2 grid high/high | 65 (21 / 22 / 22), others 0 | 65 (21 / 22 / 22) | yes | cells.json |
| 8 | Sensitivity grids (i), (ii) | same | 65 / 65 high-high | yes | cells.json |
| 9 | Cells with exactly 3 top-level units, plus root file in Haiku cells | 65; 9 Haiku with `src/index.ts` or `src/server.ts` | 65; 8 index.ts + 1 server.ts, all Haiku, 9 unlayered files | yes | cells.json ise.units |
| 10 | All classified clean-architecture | 65 | 65 | yes | cells.json |
| 11 | Identical finding sets, given vs inferred | 65 | 65/65 | yes | raw/*.json |
| 12 | Classifier: 6 of 8 points from directory tokens | 6/8 | the tokens give +6; total points are 6, 8 or 9 depending on the cell | yes (for 8-point cells) | cells.json |
| 13 | Rule counts given spec = v1.3-labelling: FF-CV05 1184, C03 159, P02 51, C02 21, C06 6, SO01 3, C04 2, SO02 2 | as claimed | raw/ and labelling reports both give exactly these, nothing else | yes | raw/, v1.3-labelling/e1/reports |
| 14 | `none` cells at confidence 1.00 | 19 | 19 | yes | cells.json |
| 15 | …"from the directory tokens (+6) and dependency inversion (+2)" | all 19 | **15** have +6 and +2 (8 pts). **4** (haiku OF none run-1, gpt TM none run-0/1, gpt OF none run-0) are at 1.00 on tokens only (6 pts, no DI evidence) | **no** (M4) | cells.json ise.evidence |
| 16 | Two Haiku cells at 0.75, runner-up layered 0.25, 4 and 13 files | TM run-0 (4), OF run-0 (13) | same | yes | cells.json |
| 17 | `none` sizes 4–15 files, median 8; ICS 1.000 in all 21 | as claimed | 4 / 15 / 8; ICS {1} | yes | cells.json |
| 18 | Lowest confidence; zero-point cells | 0.75; none | 0.75; 0 | yes | cells.json |
| 19 | §4 FF-C02 cells none / mp / full | 0/21, 15/22, 6/22 | same | yes | cells.json advisoryByRule |
| 20 | §4 FF-P02 | 2/21, 11/22, 6/22 | same | yes | cells.json |
| 21 | §4 FF-C06 | 0/21, 4/22, 2/22 | same | yes | cells.json |
| 22 | E1 reversal ahsCombined none / mp / full | 0.951 / 0.887 / 0.920 | these figures match the "all" rows of e1-size-analysis-2026-10-10.md (cited from that doc, not recomputed here) | yes (cited) | e1-size-analysis doc |
| 23 | §5 cells with a partial rule, excluding framework-free | 0/21, 15/22, 10/22 | same | yes | option1.json |
| 24 | §5 partial direction / acyclic / implements-port | 0/0/0 at all levels | 0/0/0 | yes | option1.json |
| 25 | §5 inject-interfaces partial/applying (dev/inst) | 0 of 14 (0/54); 15 of 15 (53/164); 10 of 17 (37/188) | same | yes | option1.json |
| 26 | §5 self-deviation rate | 0.000 / 0.028 / 0.019 | 0/693, 53/1899 = 0.028, 37/1953 = 0.019 | yes | option1.json |
| 27 | Example opus TM mp run-0: 11 of 14 injections target an interface | 11/14 | 11/14 | yes | option1.json |
| 28 | `none` injection pattern: 14 only-interfaces, 5 no injection | 14 / 5 | 14 / 5 | yes | option1.json |
| 29 | "The 2 Haiku cells of §3.4 inject only concrete classes (0/7 and 0/2)" | §3.4 cells (TM run-0, OF run-0) | 0/7 = haiku **OF none run-0** ✓; 0/2 = haiku **OF none run-1**, which is not a §3.4 cell. Haiku TM none run-0 injects 1/1 interface | **no** (M5) | option1.json |
| 30 | Mean interface share Claude | 0.83 / 0.60 / 0.71 | 0.83 / 0.60 / 0.71 | yes | option1.json statements |
| 31 | Mean interface share Codex | 1.00 / 0.68 / 0.78 | 1.00 / 0.68 / 0.78 | yes | option1.json |
| 32 | Injections per applying-rule cell | ~4 none vs ~11 spec levels | 3.9 / 10.9 / 11.1 | yes | option1.json |
| 33 | framework-free partial rules if included | 17 / 3 / 5 | 17 / 3 / 5 | yes | option1.json |
| 34 | Unit tests in ise-e1.test.ts | 6 | 6 pass | yes | jest |
| 35 | Liveness probe: blocking AHS 0.462, FF-S01 ×1, S04 ×1, S02 ×2, ICS ≈ 0.88 (4/33) | as claimed | not reproducible: the probe copy was discarded and nothing is committed | n/a | (missing raw) |
| 36 | Determinism re-run: 5 cells, 15 files byte-identical | as claimed | not reproducible: the second-run outputs are not committed | n/a | (missing raw) |

Mismatches:
- **M4 (row 15).** §3.4 says the 19 confidence-1.00 `none` cells score "from the directory tokens (+6) and dependency inversion, with cross-unit `implements` pointing inward (+2)".
  - Only 15 of them carry the DI (+2) evidence. Four cells (claude-haiku-4-5 order-fulfilment none run-1; gpt-5.6-terra task-management none run-0 and run-1; gpt-5.6-terra order-fulfilment none run-0) reach 1.00 on the 6 token points alone, with no structural evidence for any style.
  - This also weakens the implied contrast with the two 0.75 Haiku cells, since these four also have no cross-unit `implements` but got no layered points.
  - Classification: doc typo (overgeneralisation).
  - Severity: low. Style, ICS and the grid are unchanged.
- **M5 (row 29).** The two all-concrete injection cells are claude-haiku-4-5 order-fulfilment none run-0 (0/7) and **run-1** (0/2), not "the 2 Haiku cells of §3.4" (task-management run-0 and order-fulfilment run-0). Haiku task-management none run-0 has 1/1 injections to an interface.
  - Classification: doc typo (cell mis-identification).
  - Severity: low. The counts (14 + 5 + 2 = 21) and the "all-or-nothing" reading are unaffected.

Not reproducible from committed files (missing raw file):
- The liveness probe (row 35) and the determinism re-run (row 36).
- `cells.json` and `raw/` themselves, which need `../daedalus-e1-outcomes` plus Neo4j.
- `option1.json`, which needs `../daedalus-e1-outcomes` (no Neo4j).
- The `blockingNotExecuted` claim for opus OF full-aac run-0. The doc itself says it is not stored.

Regeneration:
- §3 data:
  - Command: `node --import tsx scripts/v1.3/ise-e1.ts --e1-runs results/e1-grid/runs --e1-root ../daedalus-e1-outcomes --spec specs/clean-arch.yaml --out <dir>`.
  - Neo4j: needs 5.26 + APOC and the outcomes. Not runnable here.
  - Determinism: claimed deterministic (5-cell re-run), not verifiable.
- §3 tables:
  - Command: copy `cells.json` to scratch, then `node --import tsx scripts/v1.3/ise-e1-report.ts --dir <scratch>`.
  - Neo4j: no.
  - Result: `summary.json` and `summary.md` are **byte-identical** to the committed ones.
- §5:
  - Command: `node --import tsx scripts/v1.3/ise-e1-option1.ts --e1-runs results/e1-grid/runs --e1-root ../daedalus-e1-outcomes --out <dir>`.
  - Neo4j: no, but it needs the outcomes, which are missing. Not run.
  - `option1.md` aggregates were re-derived independently from `option1.json` instead (rows 23–33, all match).

---

### Secrets / personal-path scan of the raw files touched

- `results/v1.3-fidelity/`: **79 files** contain an absolute personal path: all 72 `e1/projects/*.json` and all 7 `so4/projects/*.json`, field `meta.root`, 86 occurrences of `/Volumes/<volume>/Users/<author>/Development/Archi-Firewall/...`. The CSVs, aggregates, adjudication and layer-review sheets and `manifest.json` have none. The `/home/home` hits in `so4/projects/dry-run-test.csv` are project paths (`src/home/home.module.ts`), not personal paths.
- `results/v1.3-ise/2026-10-15/` and `results/v1.3-ise-e1/`: 0 personal-path hits.
- Secrets/tokens/API keys (patterns `sk-`, `AKIA`, `ghp_`, `xox[bp]-`, `api_key=`, `password=`, `NEO4J_PASSWORD=`, bearer tokens): 0 hits in all three trees. The `ApiKey`, `Token` and `Secret` strings are TypeScript identifiers in the ghostfolio and nestjs source lines quoted in `so4/adjudication.csv`.
- Nothing was changed.

---

## Summary

- **Docs audited:** 3 (graph fidelity, ISE prototype, ISE on E1).
- **Headline rows checked:** 41 + 33 + 36 = 110 (each row often covers several numbers; 4 rows not reproducible).
- **Mismatches (5), none changing a conclusion:**
  - M1, fidelity: "raw agreement missed in 2–3 SO4 projects" is the scoped count; raw is 4 (tsc) or 5 (dc). Rounding/definition ambiguity, low.
  - M2, fidelity: the barrel example quotes 28/11 for one project, but the project has 23/9 (28/11 are the E1 totals). Doc typo, none.
  - M3, ISE prototype: "43 unit tests". The command now runs 49 because of a later-added suite; the original 43 pass. Stale number, none.
  - M4, ISE E1: "19 cells at 1.00 from tokens (+6) and DI (+2)", but only 15 have DI and 4 are tokens only. Doc typo, low.
  - M5, ISE E1: the two all-concrete-injection cells are haiku OF none run-0 and run-1, not the §3.4 pair. Doc typo, low.
- **Byte-identical offline regenerations:**
  - fidelity `aggregate.json` ×2, from my re-implementation of the unexported `aggregate()` on the committed per-project JSON;
  - ISE `downstream.json`, `downstream.md` and 10 `*.true.yaml` (`--from-raw`);
  - ISE-E1 `summary.json` and `summary.md` (`ise-e1-report.ts`).
  - Edge-level CSVs equal the per-project JSON in all 79 projects.
- **Missing raw (not regenerable here):** the fidelity per-project data (needs the E1 outcomes and SO4 bases); ISE-E1 `cells.json`, `raw/` (outcomes + Neo4j) and `option1.json` (outcomes); the liveness probe and the determinism re-run outputs; any second-run evidence for the fidelity byte-identity claims.
- **Personal paths:** 79 fidelity project JSONs carry `/Volumes/<volume>/Users/<author>/...` in `meta.root`. No secrets.
