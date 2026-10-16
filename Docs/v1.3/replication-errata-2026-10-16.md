# v1.3 errata from replication part 2 (2026-10-16)

[Replication part 2](replication-2.md) (PR #215) found 58 numbers that reproduce and differ from the value in the doc,
each recorded as `KNOWN` with the reproduced value and a cause. This file classifies all 58:

| class | meaning | count | what this branch does |
|---|---|---:|---|
| (a) | doc typo or stale number: the evidence is right, the text is wrong | **41** | corrects the text (one commit per doc) and re-registers the corrected value |
| (b) | nondeterminism or environment | **0** | — |
| (c) | a real defect in a script or a committed result | **2** | proposes a fix; not implemented |
| (d) | the replication group itself is wrong | **15** | fixes the group |

Branch `v1.3-replication-errata`, from `v1.3-replication-2` at `4c1d34eb`. Every corrected line keeps its line number,
so the `line` fields of the other 5,100 registered numbers still hold. The text of each corrected line still contains
the stated value of every number registered on it.

**Rule used for "stale".** Most docs here are dated run reports. A number that was true for the tree the report
describes is not a doc error, even if HEAD has moved on. Where the group compared such a number against HEAD, the
group is wrong (d) and now checks it at the commit the doc describes (`replication/v1.3/lib/at-commit.mjs`). Where
the text was already wrong at its own commit, or the doc describes the current state of the code (design and planning
docs), the text is wrong (a).

## Claims affected (for the author)

None of these overturns a conclusion. Each changes a number that a summary, a banner, a decision sheet or a paper
states. The papers (`papers/`) are not edited in this branch: they are outside the replicated docs, and the wording
there is the author's call.

1. **Labelling correctness, headline count.** `DiagnosticRuns/v1.3-labelling-2026-10-15.md:6` and `:82`: "All
   **2,668** checkable findings are correct (**1,484** of 1,663 reference findings …)" and "**179** not-checkable".
   Corrected to **2,669**, **1,485** and **178**. "0 incorrect" stands. The old figures are also in
   `papers/paper2-tool/main.tex` lines 83, 1096 and 1213 (and the source comments on lines 86 and 1099),
   `papers/paper2-tool/README.md:61` and `papers/STATUS.md:74`.
2. **Development-set banner: the largest blocking cell.** The banners of the three reference docs say "no style has
   more than **15** expected blocking findings"
   (`v1.3-reference-after-fixes-2026-10-15.md:5`, `:108`; `v1.3-reference-after-member-facts-2026-10-15.md:43`;
   `v1.3-reference-baseline-2026-10-15.md:57`). Corrected to **19** (blind-expanded hexagonal, 13/19 in the docs' own
   tables; the largest author cell is 13). The conclusion stands: even 19/19 has a Wilson lower bound of 0.83, under
   0.90. The old figure is also in `papers/paper2-tool/main.tex:1077`.
3. **Judge catch, round 1: fixture dependence.** `DiagnosticRuns/v1.3-judge-catch-2026-10-15.md:9` (banner) and
   `:117`: "**10 of the 11** seeds sit on one small fixture". Corrected to **all 11**, as the doc's own §1 (line 41)
   says. The caveat is stronger than stated: no round-1 seed is off the fixture. The old wording is also in
   `papers/paper3-judge/main.tex:657` ("ten of the eleven round-1 seeds") and `papers/paper4-cheap-semantics/README.md:39`.
4. **Judge catch, round 1: clean-control denominator.** Same doc, line 92: "None of the **22** reference-project units
   failed". Corrected to **16** (24 clean units less the 8 `antipattern-nest` units). 0 failed still holds.
5. **Reference after member facts: runner mismatches.** `v1.3-reference-after-member-facts-2026-10-15.md:127`, in the
   pooled before/after table: "1 (g01 FF-DT03 missed) → **none**". That holds for the ddd section only. The whole
   `report.md` goes from **5 to 4** mismatch rows (FF-P05 on clean v07 and nestjs v09 remain, plus advisory false
   positives FF-P02 on n03 and FF-P04 on v07).
6. **Reference baseline: the cost of the literal cycle key.** `v1.3-reference-baseline-2026-10-15.md:193`: "1 to 2
   points of blocking recall". The key costs 1 to 2 **findings** per style, which is **8 to 18 points** of blocking
   recall (0.82–0.92 → 1.00). The effect was understated about tenfold.
7. **MCP v2 latency.** `v1.3/mcp-v2.md:201`: "about **two** orders of magnitude under the 1 s target, cold calls
   included". The committed `latency.json` gives a worst p95 of 45.2 ms (22×) and a worst cold call of 130.1 ms over
   stdio (7.7×): about **one** order of magnitude. Only the p50s (6 to 19 ms) are about two orders under it. The 1 s
   target is still met. Same doc, line 11: the hints come from **five** APG v2 templates, not three.
8. **Study 2 arm definition.** `v1.3/study2-outline.md:53`: the `daedalus-mcp` arm has "the **7** spec-only tools".
   `DAEDALUS_ARM_TOOLS` (`scripts/lib/generators/arms.ts`) has **9** since `e252fd34` ("daedalus-mcp arm exposes the MCP
   v2 tool list"): `infer_spec` and `explain_finding` were added. The outline now lists all 9. **Author decision:**
   check that the arm should expose these two tools in Study 2, and that no pre-registration draft still pins 7.
9. **Construct decision Q13, the option effects.** `v1.3/construct-decisions.md:459`, `:461`. Under A, nestjs
   all-rule P is **14/14**, not 13/14: A is better on all-rule precision than the sheet said, and as good as B after
   B's change (13/13). Under C, nestjs blocking **recall also goes 10/11 → 11/11**, not only precision. The
   recommendation (B) rests on the preset and the NestJS docs, not on these figures, but the sheet is what the author
   decides from.
10. **Graph fidelity, SO4.** `v1.3-graph-fidelity-2026-10-14.md:53`: the raw ≥ 0.95 agreement is missed in **4–5** SO4
   projects (4 against tsc, 5 against dependency-cruiser), not 2–3; 2–3 is the scoped count. The text now gives both.

Smaller corrections that no summary repeats are in the table below, for example: the round-2 "14 informative seeds" is
16 (13/16 unchanged); the power of option B is about 0.54; the model-panel upper output estimate is 0.43 M tokens.

## (a) Doc typos and stale numbers: corrected (41)

"#" is the row of [replication-2.md §4](replication-2.md#4-mismatches-58). All paths are under `Docs/`. Evidence
names the committed file or command; the group id regenerates it (`node replication/v1.3/run.mjs --number <id>`).

| # | doc:line | stated | correct | evidence |
|---:|---|---|---|---|
| 1 | `DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md:175` | the 7 of 9 misses | the 8 of 9 misses | `results/v1.3-cheap-semantics/duprule-v2`: v2 clones catch 1/9 (fixture 1/1, E1 0/8), so 8 misses, the 8 E1 seeds the sentence names. `c-cf-misses` |
| 2 | same doc `:222` | 0 guard pairs on 5 clean projects and 9 near-misses | … and 14 near-misses | The precision table has 19 clean and near-miss projects (5 clean, 14 near-miss). 9 is the Part A near-miss count of the three FF-P06 styles. `c-cf-guard-pairs-nm` |
| 3 | `DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md:53` | in 2–3 SO4 projects | in 4–5 SO4 projects (in 2–3 on the scoped agreement) | `results/v1.3-fidelity/so4/aggregate.json`, `raw.projectsBelow095`: covered 4 (tsc) and 5 (dependency-cruiser). Audit A-1. `a-fid-miss-so4` |
| 4 | same doc `:98` | become 28 edges | become 23 edges | `results/v1.3-fidelity/e1/projects/claude-opus-5-5__task-management__none__run-1.json`: 23 routed edges. 28 is the E1 total. Audit A-2. `a-fid-tm-routed` |
| 5 | same doc `:98` | the 11 edges to the barrels | the 9 edges to the barrels | Same file: 9 barrel edges dropped. 11 is the E1 total. Audit A-2. `a-fid-tm-dropped` |
| 6 | `DiagnosticRuns/v1.3-judge-catch-2026-10-15.md:9` | 10 of the 11 seeds sit on one small fixture | All 11 seeds sit on one small fixture | Round-1 seed rows: all 11 have base `antipattern-nest`; the doc's line 41 says so. Audit D-1. `b-r1-onfixture-hdr` |
| 7 | same doc `:92` | None of the 22 reference-project units failed | None of the 16 … | 24 clean units less 8 `antipattern-nest` units = 16. 22 is the number of non-failing clean units. Audit D-2. `b-r1-clean-refunits` |
| 8 | same doc `:117` | 10 of the 11 seeds sit on one 8-file fixture | All 11 seeds … | As row 6. `b-r1-onfixture-v` |
| 9 | `DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md:167` | leaves 14 informative seeds | leaves 16 informative seeds | FRAMEWORK-LEAK 13 + PERSIST-IN-DOMAIN 3 = 16, the same sentence's 10/13, 3/3 and 13/16. Post-merge review R27. `b-r2-informative` |
| 14 | `DiagnosticRuns/v1.3-judge-v2-2026-10-16.md:27` | 30 suites, 610 tests | 31 suites, 615 tests | `npx jest tests/unit/llm-critic tests/unit/cli` under `env -i`: 31 suites / 615 tests, all passing, at HEAD and already at the doc's own commit `205a73bd`. `b-v2-jest-dirs` |
| 15 | `DiagnosticRuns/v1.3-labelling-2026-10-15.md:6` | 1,484 of 1,663 | 1,485 of 1,663 | `results/v1.3-labelling/reference/correctness.json` (regenerated byte-identical): 1,485 correct. The doc's per-rule table sums to 1,485. Audit E-7, review R25. `c-lab-ref-6-ref` |
| 16 | same doc `:6` | All 2,668 checkable findings | All 2,669 checkable findings | 1,485 reference + 1,184 E1. `c-lab-e1-6-all` |
| 17 | same doc `:82` | 1,484 correct | 1,485 correct | As row 15. `c-lab-ref-82-correct` |
| 18 | same doc `:82` | 179 not-checkable | 178 not-checkable | 175 with no deterministic check + 3 FF-P06 FLOWS_TO rows; 1,485 + 178 = 1,663. `c-lab-ref-82-nc` |
| 20 | same doc `:218` | (37 pass) | (38 pass) | `npx jest tests/unit/scripts/v1.3/labelling` in an export of the doc's commit `2c1098c7`: 3 suites, 38 tests, all pass. (HEAD has 59. The group now runs at the doc's commit: see (d).) `c-lab-tests-37` |
| 21 | `DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md:5` | no style has more than 15 expected blocking findings | … more than 19 … | `results/v1.3-reference/after-fixes/scores.json` + adjudication: the largest author cell is 13; blind-expanded hexagonal has 19. Audit B-1. `a-reff-max-cell` |
| 22 | same doc `:108` | the largest blocking cell has 15 expected findings | … has 19 … | As row 21. `a-reff-max-cell-2` |
| 23 | `DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:43` | No style has more than 15 expected blocking findings | … more than 19 … | As row 21, on the after-member-facts run. `a-refm-max-cell` |
| 24 | same doc `:127` | 1 (g01 FF-DT03 missed) | 5 (ddd section: 1, g01 FF-DT03 missed) | `results/v1.3-reference/after-fixes/report.md`: 5 mismatch rows in the whole report. Audit B-6. `a-refm-mism-before` |
| 25 | same doc `:127` | **none** | **4** (ddd section: none) | `results/v1.3-reference/after-member-facts/report.md` (regenerated through the interpreter): 4 rows. Audit B-6. `a-refm-mism-after` |
| 26 | `DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md:57` | the largest blocking cell is 15 expected findings | … is 19 … | As row 21, on the baseline run. `a-refb-max-cell` |
| 27 | same doc `:193` | That costs 1 to 2 points of blocking recall in four styles. | That costs 1 to 2 findings, i.e. 8 to 18 points of blocking recall in four styles. | Baseline `scores.json`, author literal key vs cycle-normalised: 0.92 / 0.82 / 0.91 / 0.92 → 1.00. Audit B-3. `a-refb-cycle-cost` |
| 31 | `DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md:66` | 1.154 (symfile) | 1.153 | `results/v1.3-study1-rerun/e1/by_level_model.csv`: the cell mean is 1.15345, printed as 1.1535 and rounded again to 1.154 (double rounding). `d-s1-e1-opus-5-5-minimal-prose-symfile` |
| 32 | same doc `:66` | 1.154 (v12esym) | 1.153 | As row 31. `d-s1-e1-opus-5-5-minimal-prose-v12esym` |
| 33 | same doc `:143` | Each also carries one new undeclared finding: | … one new undeclared finding (truthy-demo:MO-X01:0 carries 2, FF-C01 and FF-C03): | `results/v1.3-study1-rerun/so4/case/reports/`: truthy-demo:MO-X01:0 has two new undeclared findings. Audit E-5. `d-s1-x01-collateral` |
| 35 | `DiagnosticRuns/v1.3-wild-2026-10-16.md:110` | 262 resolved-only | 373 resolved-only | `results/v1.3-wild/fidelity`: 373 is missing-in-ref (v1.2E's resolved edge that the references lack); the labels were swapped. `d-wild-barrel-resolved-only` |
| 36 | same doc `:110` | 373 literal-only | 262 literal-only | 262 is missing-in-apg:re-export/barrel (the literal barrel edge that v1.2E does not keep). `d-wild-barrel-literal-only` |
| 39 | `v1.3/cheap-semantics-design.md:9` | about 50 to 130 ms | about 60 to 130 ms | Committed `timingsMs` of the 19 clean and near-miss projects: 60 to 130 ms (73 to 99 ms on the 5 clean ones). `c-dd-time-proxies` |
| 40 | same doc `:178` | 5 to 7 components with 2 to 12 files each | 3 to 6 components with 1 to 16 files each | `componentOf` (this design's component rule) over the File nodes of the five clean projects; the vocabulary summaries also count 3 to 6 components. `c-dd-components` |
| 41 | `v1.3/construct-decisions.md:459` | A: … all-rule P 13/14 | all-rule P 14/14 | `Docs/v1.3/construct-decisions-impact.csv`, Q13 A nestjs: `all_tp 14, all_reported 14` (as-is and after). 13/14 is option B as-is. `f-cd-fig-q13-a-allp` |
| 42 | same doc `:461` | C: nestjs R 10/11, P 10/11 → 11/11 | C: nestjs R 10/11 → 11/11, P 10/11 → 11/11 | Same CSV, Q13 C nestjs: blocking recall 10/11 as-is, 11/11 after. In this sheet a bare "R 10/11" means unchanged. `f-cd-fig-q13-c-r` |
| 43 | `v1.3/construct-switches.md:108` | 4 distinct rows on each of the 14 variants | 4 distinct rows on 13 variants, 5 on n02-domain-port-named-dot-repository (rows on all of the 14 variants) | Re-score with Q13 C: n02 has a fifth module row (`registrations.module.ts` → `in-memory-waitlist.repository.ts`). P 10/68 is unchanged. `f-cs-q13c-module-rows` |
| 44 | `v1.3/loop-pilot-readiness.md:101` | 4 repair turns | 6 repair turns | The dry run, at HEAD and at the doc's commit `b5a18385`: the stub plants a blocking import at steps 2 and 4 in each of the 3 gate runs. `g-pilot-dry-repairs` |
| 45 | same doc `:101` | all 4 cleared | all 6 cleared | `turnsThisInvocation.repairsCleared = 6`. `g-pilot-dry-cleared` |
| 46 | `v1.3/mcp-v2.md:11` | from three APG v2 templates | from five APG v2 templates | `APG2_HINT_NAMES` (`src/mcp-server/fast-hints.ts`) has five templates, as the doc's §6 table lists. `e-mcp-k-hints-apg2` |
| 47 | same doc `:80` | spec-only ddd: 13 / 15 | 13 / 13 | The column is "answer / rules": both agree on 13 of 15 DDD variants (the `all` row is 64 / 64). Line 83 now says "13/15 variants". `e-mcp-c-ddd-speconly` |
| 48 | same doc `:201` | about two orders of magnitude under the 1 s target, cold calls included | about one order of magnitude …, cold calls included (worst p95 45.2 ms, worst cold call 130.1 ms; the p50s, 6 to 19 ms, are about two orders under it) | `results/v1.3-reference/mcp-v2/latency.json`. The group now checks both halves (`e-mcp-l-orders`, new `e-mcp-l-orders-p50`). |
| 49 | `v1.3/model-panel.md:196` | About 60 system tokens | About 65 system tokens | `SYSTEM_PROMPT` (`meaningful-prompt.ts`) is 267 characters = 66.75 tokens at chars/4. `g-panel-sys-tokens` |
| 54 | same doc `:198` | ≈ 0.05–0.42 M output tokens | ≈ 0.05–0.43 M output tokens | (40 + 2,000) × 210 = 428,400. The upper end left out the 40 visible tokens. `g-panel-output-range` |
| — | same doc `:200`, `:204`–`:206` | (0.05 … 0.42); $4.4; $6.6; $33 | (0.05 … 0.43); $4.5; $6.8; $34 | Follows from row 54: the formula and the cost table use the upper bound. The group now computes the table from the §8 figures, not from a copy of 0.42. `g-panel-cost-*` |
| 57 | `v1.3/study2-outline.md:53` | the 7 spec-only tools (… 7 names) | the 9 spec-only tools (… + `infer_spec`, `explain_finding`) | `DAEDALUS_ARM_TOOLS` (`scripts/lib/generators/arms.ts`), pinned equal to `SPEC_TOOL_NAMES`, since `e252fd34`. `d-so-mcp-tools` |
| 58 | `v1.3/study2-power-notes.md:107` | power about 0.55 | power about 0.54 | `results/v1.3-study2-power/power.json`: 0.535 (214/400), which the doc's own §4 table prints as 0.54. 0.55 is the "no arm × task interaction" row. `d-pn-dz-power` |

The cost table rows (lines 204–206) are not among the 58: they were registered as reproducing because the group
copied the doc's 0.42. They follow from row 54, so they are corrected with it.

## (b) Nondeterminism or environment (0)

None. Two of the 58 involve timings (rows 39 and 48), but both compare the doc with committed timing files, not with a
fresh run, so the machine does not enter. The one environment effect that PR #215 found (`replay-no-binary.test.ts`
fails when jest inherits a Claude Code session's environment, replication-2 §3.2) is handled by running jest under
`env -i` and changes no number.

## (c) Real defects (2): fix proposed, not implemented

| # | doc:line | stated | reproduced at HEAD | defect | proposed fix |
|---:|---|---|---|---|---|
| 29 | `DiagnosticRuns/v1.3-repro-audit-2026-10-16.md:167` | ISE measure … IDENTICAL | 11 IDENTICAL + 11 DIFF / IDENTICAL / IDENTICAL | The audit was right on 2026-10-15 (`replication/smoke-2026-10-15.txt`). Since ISE commit `08c6cd8c` ("structure over vocabulary"), `ise-measure.ts` no longer reproduces the committed `results/` `measure.json`, `measure.md` and 9 of 20 specs, so `replication/smoke.sh` exits 1 at HEAD. | Regenerate the committed ISE measure outputs at the ISE head and commit them with a line in the ISE doc. Or, if the committed outputs must stay the 2026-10-15 ones, run the smoke step at `08c6cd8c^`, or add the 11 files to `replication/known-divergences.json` with the cause. Keep this row KNOWN until one lands. |
| 30 | same doc `:169` | cheap proxies … IDENTICAL | 38 IDENTICAL + 17 DIFF | The committed top-level `results/v1.3-cheap-semantics/` equals `cheapfix-before`. The cheap-fix options now default on, so a default `cheap-semantics-eval.ts` run equals `cheapfix-after`, and `smoke.sh` diffs `rows.csv`, `scores.json` and 15 clean-twin `flags/*.json`. | Have `smoke.sh` run the step with `--before`, which matches the committed baseline (one flag; the fieldstate doc already uses it). Or regenerate the top-level directory from the defaults and point `replication/expected/` at it. |

Both rows stay `KNOWN` in the group, so the replication still reports them and still fails if the reproduced value
changes.

## (d) Replication group wrong (15): fixed in the groups

| # | doc:line | stated | what the group did wrong | fix (group) |
|---:|---|---|---|---|
| 10–13 | `DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md:179`, `:182` | shapes A and D: IMPORTS **none**, Package nodes **none** | The table diagnoses the extractor at the round-2 commit: the `.d.ts` alias drops the import. The later F-P01-ALIAS fix (`15e755eb`) changed that behaviour on purpose. The group ran the repro at HEAD, so it compared a historical diagnosis with the fixed code. | `b-jc-r2-ffp01` runs `judge-catch2-ffp01-repro.ts` in an export of `f8251b8b`. All 8 cells reproduce. The note records that HEAD now gives Package:typeorm (audit D-4). |
| 19 | `DiagnosticRuns/v1.3-labelling-2026-10-15.md:174` | 9 excerpt lines | The doc describes the audit sheet of its commit `2c1098c7`, which has 9 answer-leaking lines. `10968ceb` later scrubbed the sheet (0 lines). The group counted the HEAD sheet. | `c-lab-audit` counts the sheet at `2c1098c7` (`git show`). The doc still calls the confound open; a dated status note saying `10968ceb` fixed it would help (audit E-8), but that is not a number correction. |
| 28 | `DiagnosticRuns/v1.3-repro-audit-2026-10-16.md:77` | 49 at HEAD | "HEAD" is the audit's HEAD. Its only commit is `b1d97881`, where the §7 jest command runs 49 tests. The group ran it at the replication HEAD (93). | `d-audit` runs the jest command in an export of `b1d97881`: 49 tests, all pass. |
| 34 | `DiagnosticRuns/v1.3-wild-2026-10-16.md:13` | 38 | The group counted every row of `selection.json` (39), including the 2 Study 1 projects that the method text says were "excluded by name and not probed". The pool is the 37 probed plus the 1 name that did not resolve (`goldbergyoni/practica`), as the method text says. | `d-wild` counts probed rows plus the unresolved names in the method text: 38. |
| 37, 38 | same doc `:196`, `:197` | clean (0.12), layered (0.12) | The runner-up confidence is exactly 0.125. The doc rounds half to even (0.12), the group used `toFixed(2)`, which rounds half up (0.13). Both are correct roundings. | `d-wild` formats §6 confidences half to even, as the doc does. |
| 50–53 | `v1.3/model-panel.md:196` | 350–500 prompt tokens; about 355 / 490 / 725 | The group measured the rendered prompt alone. Every adapter also sends the response schema (`responseSchema`, `json_schema` response format, `--json-schema`; `adapters.ts`, `providers.ts`), 138 characters = 34.5 tokens, billed as input. With it the averages are 354.5, 489.4 and 722, which the doc's figures round. The group also forced every "about" figure to the nearest 5. | `g-panel-dry` adds the schema text to each call, accepts an "about N" when N is the measured value to the nearest 5 or within 1% of it, and checks the range as the two averages rounded outward to 50. Suggestion: §8's "The size comes from the dry run's rendered prompts" could add "plus the response schema". |
| 55, 56 | `v1.3/night-backlog-2026-10-16.md:427`, `:581` | ~900 steps | A rough figure taken from the outline's "roughly 650–970 step turns". The group reported the range as the reproduced value, so it could never match. | `h-nb-repo` checks that 900 lies inside the outline's range. |

## Re-run

Full offline run, `npm run replicate:v1.3` at `f1f1c132` (Node v22.22.0, no LLM, no Neo4j, 57 min). **It exits 0.**

| | PR #215 (`8b6c1398`) | this branch |
|---|---:|---:|
| numbers registered | 5,154 | 5,155 |
| **yes** (PASS) | 4,587 | **4,644** |
| **no** (KNOWN) | 58 | **2** (rows 29 and 30, class c) |
| FAIL / ERROR | 0 / 0 | **0 / 0** |
| needs-LLM / needs-Neo4j / needs-external / not-checkable | 6 / 235 / 148 / 120 | 6 / 235 / 148 / 120 (unchanged) |

- **The +57 yes:** the 56 numbers corrected or fixed here, and one new number. Row 48 is now checked as two
  numbers, `e-mcp-l-orders` and `e-mcp-l-orders-p50`.
- **The `--fast` subset of the same run:** 3,947 PASS, 0 KNOWN, 0 FAIL, 0 ERROR, with 699 skipped in slow groups.
  Both KNOWN rows are in the slow group `d-audit-smoke`.
- **The separate `--fast` run:** it ran before the post-merge-review fix and gave 3,931 PASS and 16 FAIL. All 16
  were that review's quotes of the corrected lines, which the group now reads at the review's commit.

The per-doc tables in [`replication-2/`](replication-2/) are regenerated from this run
(`node replication/v1.3/report.mjs rows.json --dir Docs/v1.3/replication-2`). The prose of `replication-2.md` stays
the PR #215 record.
