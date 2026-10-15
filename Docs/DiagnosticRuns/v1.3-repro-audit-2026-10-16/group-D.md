# Reproducibility audit, group D (judge catch round 1, round 2, AP-DUP-RULE v2)

Auditor: Claude (independent). Repo `<REPO>`, branch `v1.3-replication` @ `96a5e77d`. Date 2026-10-15.
No repo file was edited and no git state was changed. All outputs are under
`<scratch>/`.
No model, LLM or network call was made. Every script ran under `env -i PATH=$PATH HOME=$HOME`, so no API key, token or proxy variable was visible to it. The scoring scripts only read files.

## Method

1. **Committed scorers, offline.** The committed results dirs were copied to the scratchpad. Then `judge-catch-score.ts`, `judge-catch2-score.ts` and `judge-catch-v2-score.ts` were run with `--results <scratch copy>` against the committed cassettes. The output was diffed against the committed `scores.json` and `rows.csv`.
2. **Independent re-derivation.** I wrote my own script (`scratchpad/audit/indep.py`). It reads the plan, the seed manifest, the call ledger, the 51/56/27 evaluate reports and the raw cassette entries, and recomputes the following:
   - every unit verdict, as the majority of the cassette `parsedVerdict.pass` values, checked against the report;
   - the unit confidence, as the mean over the majority-side runs, checked against the report;
   - catch, paired catch, construct flag, twin false fail, clean false fail, S1 and S2;
   - Wilson intervals;
   - all pools, including the cross-round pools.
3. **Cassette vote replay** (the offline part of `replay`). All 168 judged units (70 + 62 + 36) were checked. The report verdict equals the cassette majority in 168/168. The report confidence equals the majority-side mean in 168/168, including 6 split 2-1 votes. Every unit has 3 valid runs.
4. **Round-1 seeding re-run.** `judge-catch-seed.ts --out scratch` is deterministic, needs no Neo4j and no network, and took 90 s. The `seed-manifest.json` it produced is identical to the committed one apart from `generatedAt`. All 53 committed diffs reproduce as +/- line sets (only the file and hunk order differs).
5. **FF-P01 repro.** `judge-catch2-ffp01-repro.ts` was run at HEAD and, through `git archive f8251b8b`, at the round-2 commit. It needs no Neo4j and no model.
6. **Freeze checks.**
   - `rubric.ts` `52960e02…`, `frozen.ts` `b6301b67…` and `FROZEN_SHA256` `f8b2dabb…` match.
   - The v1 combined digest `59d70946…d36b` is reproduced from the files at `7811797a`.
   - The v2 combined digest `afe879b5…4444` is reproduced at HEAD.
   - The v1 `ap-dup-rule.ts` is `dda3accc…` and `ap-dup-rule-v2.ts` is `72342a9e…`.
   - All cited commits exist. Each freeze or scoring commit predates the first cassette `recordedAt` of its run:
     - R1: freeze 16:47:41Z; first call 16:58:35Z; scoring commit 17:00:38Z, before the first seeded-copy run at 17:03Z.
     - R2: commit 17:47:42Z; first call 17:48:14Z.
     - v2: commit 19:14:30Z; first call 19:18:47Z.

---

### v1.3-judge-catch-2026-10-15.md

Raw sources used: `results/v1.3-judge-catch/{plan.json, seed-manifest.json, dry-count.json, call-ledger.json, reports/*.json (51), diffs/*.diff (53), scores.json, rows.csv}`, `tests/fixtures/judge-cassettes-v13/judge-catch/**` (210 entries), `Docs/v1.3/judge-catch-frozen.md`, `fixtures/unit/antipattern-nest`, the round-1 seeding re-run.

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Site table, 10 operators x 6 bases (eligible/candidates), all 60 cells | as in §1 table | identical in all 60 cells | yes | seed-manifest.json `table` (also regenerated) |
| 2 | Near-miss eligible: FAT-CONTROLLERn / PERSIST-IN-DOMAINn / FRAMEWORK-LEAKn | 2 / 22 / 50 | 2 / 22 / 50 | yes | seed-manifest.json |
| 3 | Near-miss sites applied (not a duplicate) | 2 (FRAMEWORK-LEAKn) | 2 | yes | seed-manifest.json rows |
| 4 | Seeds per operator, REPO/FAT/PERSIST/DUP/FL | 4/1/1/1/4 = 11 | 4/1/1/1/4 = 11 | yes | seed-manifest.json |
| 5 | Seeds on `antipattern-nest` | header and §5: "10 of the 11"; §1: "all on antipattern-nest" | 11 of 11 | **no** | seed-manifest.json |
| 6 | Applied copies passing tsc with 0 errors | 53 | 53 ok rows, 0 errors (72 `duplicate-not-applied`) | yes | seed-manifest.json |
| 7 | DDD twin copies seeded but not judged | 9 | 9 (`plan.json` skipped) | yes | plan.json |
| 8 | Fixture size | 8 files | 8 `src` .ts files | yes | fixtures/unit/antipattern-nest |
| 9 | Evaluated projects: clean / seeds / twins | 51: 7/11/33 | 51: 7/11/33 | yes | plan.json |
| 10 | Judged units (clean, seed or twin) | 70 (24, 46) | 70 (24, 46) | yes | plan.json |
| 11 | Mock dry count | 261 (210 + 51) | 261 (210 + 51) | yes | dry-count.json |
| 12 | Live calls; judge calls; init probes | 261; 210; 51 | ledger 261 = 210 attempts + 51 probes; 210 cassette entries | yes | call-ledger.json, cassettes |
| 13 | All attempts 1, all valid, model `claude-opus-5-5` | yes | 210/210 attempts=1, valid, resolvedModel opus-5-5, CLI 2.1.294, effort high | yes | cassettes |
| 14 | Scrub hits | 0 | 0 (own grep, see Secrets) | yes | results + cassettes |
| 15 | Replay 51/51 identical | 51/51 | vote and confidence re-derived from cassettes = reports for 70/70 units; a full `replay` was not run (needs Neo4j) | partial | cassettes, reports |
| 16 | REPO-BYPASS catch; paired; twin FF | 4/4 = 1.00 [0.51, 1.00]; 4/4; 0/4 = 0.00 [0.00, 0.49] | same | yes | reports + cassettes; scores.json |
| 17 | DUP-RULE catch; twin FF | 1/1 [0.21, 1.00]; 1/1 [0.21, 1.00] | same | yes | same |
| 18 | FAT-CONTROLLER catch; twin FF | 1/1; 0/1 [0.00, 0.79] | same | yes | same |
| 19 | PERSIST-IN-DOMAIN catch; twin FF | 1/1; 2/7 = 0.29 [0.08, 0.64] | same | yes | same |
| 20 | FRAMEWORK-LEAK catch; paired; twin FF | 2/4 = 0.50 [0.15, 0.85]; 2/4; 0/20 = 0.00 [0.00, 0.16] | same | yes | same |
| 21 | Pooled catch; macro | 9/11 = 0.82 [0.52, 0.95]; 0.90 | same; 0.90 | yes | same |
| 22 | Pooled paired catch | 9/11 | 9/11 | yes | same |
| 23 | Twin false fail, pooled | 3/33 = 0.09 [0.03, 0.24] | same | yes | same |
| 24 | Paired twin false fail | 1/33 = 0.03 [0.01, 0.15] | same | yes | same |
| 25 | Construct-flag clause adds no catch | 0 added | catch = unitFail on 11/11 seeds | yes | cassettes |
| 26 | FL miss confidences | 0.60–0.68, 6 runs pass | 6/6 pass, confidences 0.60, 0.60, 0.62, 0.62, 0.60, 0.68 | yes | cassettes |
| 27 | FL misses "did not mention the express parameter" | not mentioned | all 6 runs discuss the express `Request` parameter and dismiss it; 0 violations listed | **no** (qualitative) | cassettes |
| 28 | Clean unit false fail | 2/24 = 0.08 [0.02, 0.26] | same (`invoice.entity.ts`, `order.entity.ts`) | yes | reports |
| 29 | Clean per base | 1/7 = 0.14 [0.03, 0.51] | same | yes | reports |
| 30 | Reference-project clean units, none failing | "22" | **16** (24 − 8 antipattern-nest units); 0/16 fail | **no** | plan.json, reports |
| 31 | S1 PERSIST | 0/1 | 0/1 | yes | reports (violations) |
| 32 | S2 per operator; judge-only | 0/4, 0/1, 0/1, 0/1, 0/4; 4/4, 1/1, 1/1, 1/1, 2/4 | same | yes | reports |
| 33 | Blocking verdict pass on every base and copy | all pass | 44/44 copies and all 7 bases pass | yes | reports `tiers.verdict` |

**Mismatches**
- **#5, "10 of the 11 seeds on one fixture".**
  - Evidence: the manifest puts all 11 ok seeds on `antipattern-nest`, and the doc's own §1 says "11 in total, all on `antipattern-nest`".
  - Classification: doc typo.
  - Severity: low. It understates the clustering, which works against the caveat it supports.
- **#30, "None of the 22 reference-project units failed".**
  - Evidence: the 24 clean units split as antipattern-nest 8, clean-architecture 5, hexagonal 4, nestjs 4, layered 1, nestjs n02 1, nestjs n03 1. That is 16 reference-project units. 22 is the number of non-failing clean units overall.
  - Classification: doc typo (wrong denominator).
  - Severity: low. The conclusion "0 reference units failed" holds: 0/16 = 0.00 [0.00, 0.19].
- **#27, "did not mention the express parameter".**
  - Evidence: every passing run names the `request?: Request` express parameter. Examples: "takes an Express Request, which ties the use case to HTTP transport. But the parameter is never used"; "This is a coupling smell only". The runs list 0 violations.
  - The judge saw the leak and ruled it out of scope (an import or coupling matter, not a misplaced responsibility). It did not overlook it.
  - Classification: rounding/definition ambiguity ("mention" against "flag as a violation"). The text is factually wrong as written.
  - Severity: medium. It changes the reading of the miss from judge blindness to a rubric-scope decision.

**Not reproducible from committed files:**
- The judge `record` and `replay` phases. They need Neo4j 5.26 with APOC and the seeded work dir; the work dir can be regenerated for round 1.
- The budget (400) and the heavy-hook and swap observations. These are environment notes with no raw record.

---

### v1.3-judge-catch-round2-2026-10-15.md

Raw sources used: `results/v1.3-judge-catch/round2/{plan.json, seed-manifest.json, dry-count.json, call-ledger.json, reports (56), diffs (38), scores.json, rows.csv}`, `tests/fixtures/judge-cassettes-v13/judge-catch-round2/**` (186 entries), round-1 `scores.json`/reports (for rounds 1+2), `tests/fixtures/v1.3-reference/*/variants/*/expected-findings.json`, FF-P01 repro output at HEAD and at `f8251b8b`.

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | E1 population | 65 cells | `e1Cells` 65, `cellOrder` 65 | yes | seed-manifest.json |
| 2 | REPO-BYPASS / FAT-CONTROLLER cells, elig/cand | 0, 0/0 | 0, 0/0 | yes | seed-manifest `summary`/`table` |
| 3 | PERSIST-IN-DOMAIN | 0 cells, 0/80, type-shape 80 | 0 eligible cells (38 with candidates), 0/80, type-shape 80 | yes | same |
| 4 | DUP-RULE cells; elig/cand; seeded; tsc-rejected draws | 16; 110/110; 8; 10 | 16; 110/110; 8; 10 | yes | same |
| 5 | FRAMEWORK-LEAK cells; elig/cand; seeded | 65; 434/434; 8 | 65; 434/434; 8 | yes | same |
| 6 | DUP-RULEn cells; elig/cand; twins; rejected | 16; 110/110; 5; 19 | 16; 110/110; 5; 19 | yes | same |
| 7 | FRAMEWORK-LEAKn twins | 8 | 8 (operator) + 1 hand-planted | yes | same |
| 8 | PERSIST-IN-DOMAINn; FAT-CONTROLLERn | 38, 80/80; 1, 1/1 | same | yes | same |
| 9 | Twin matches | 12 same-site, 1 same-file | 12 same-site, 1 same-file | yes | rows `twinMatch` |
| 10 | Type-check rejections all TS2345; DUP seeds with no twin | all; 3 | 29/29 TS2345; 3 | yes | rows `typecheckErrors` |
| 11 | Spread: seeds over cells; models s/o/h/gpt; tasks OF/TM | 16/14; 8/4/2/2; 13/3 | 16/14; 8/4/2/2; 13/3 | yes | rows |
| 12 | DUP-RULE seeds in `src/application`; on OF; from sonnet | 8; 7; 6 | 8; 7; 6 | yes | rows |
| 13 | Hand-planted variants mapped; excluded | 8; 5 (2 DDD + 3 bypass) | 8; 5 | yes | `handPlanted`, `handPlantedExcluded` |
| 14 | Hand-planted copies + twin pass tsc; diffs | 9 pass; 38 | 9/9, 0 errors; 38 files | yes | rows, diffs/ |
| 15 | Evaluated projects: clean (E1, ref) / seeds / twins | 56: 18 (14, 4) / 24 / 14 | same | yes | plan.json |
| 16 | Judged units (clean, seed/twin) | 62 (24, 38) | 62 (24, 38) | yes | plan.json |
| 17 | Dry count; live calls; judge; probes | 242 (186+56); 242; 186; 56 | same; all attempts 1, all valid, opus-5-5, CLI 2.1.294 | yes | dry-count, ledger, cassettes |
| 18 | Replay 56/56 identical | 56/56 | vote and confidence re-derived = reports for 62/62 units; full `replay` not run | partial | cassettes, reports |
| 19 | DUP-RULE (E1): catch; paired; twin FF; paired twin FF | 8/8 [0.68, 1.00]; 7/8 = 0.88 [0.53, 0.98]; 5/5 [0.57, 1.00]; 4/5 = 0.80 [0.38, 0.96] | same | yes | reports + cassettes; scores.json |
| 20 | FL (E1): catch; paired; twin FF | 6/8 = 0.75 [0.41, 0.93]; 6/8; 0/8 [0.00, 0.32] | same | yes | same |
| 21 | PERSIST (hand): catch; paired | 3/3 [0.44, 1.00]; 3/3 | same | yes | same |
| 22 | FL (hand): catch; twin FF | 4/5 = 0.80 [0.38, 0.96]; 0/1 [0.00, 0.79] | same | yes | same |
| 23 | FL combined: catch; twin FF | 10/13 = 0.77 [0.50, 0.92]; 0/9 [0.00, 0.30] | same | yes | same |
| 24 | Pooled operator: catch; paired; twin FF; paired twin FF | 14/16 = 0.88 [0.64, 0.97]; 13/16 = 0.81 [0.57, 0.93]; 5/13 = 0.38 [0.18, 0.64]; 4/13 = 0.31 [0.13, 0.58] | same | yes | same |
| 25 | Pooled hand-planted: catch; paired | 7/8 = 0.88 [0.53, 0.98]; 7/8 | same | yes | same |
| 26 | Pooled combined: catch; paired; twin FF; paired | 21/24 = 0.88 [0.69, 0.96]; 20/24 = 0.83 [0.64, 0.93]; 5/14 = 0.36 [0.16, 0.61]; 4/14 = 0.29 [0.12, 0.55] | same | yes | same |
| 27 | Construct flag adds no catch | none | catch = unitFail on 24/24 seeds | yes | cassettes |
| 28 | Clean E1 units; bases | 1/16 = 0.06 [0.01, 0.28]; 1/14 = 0.07 [0.01, 0.31] | same | yes | reports |
| 29 | Clean reference units; bases | 0/8 [0.00, 0.32]; 0/4 [0.00, 0.49] | same | yes | reports |
| 30 | Clean combined units; bases | 1/24 = 0.04 [0.01, 0.20]; 1/18 = 0.06 [0.01, 0.26] | same (haiku OF mp run-2 `src/application/usecases`; 3/3 runs cite Order→OrderDto mapping) | yes | reports, cassettes |
| 31 | Rounds 1+2: REPO, DUP, FAT, PERSIST, FL, pooled | 4/4; 9/9 [0.70, 1.00]; 1/1; 1/1; 8/12 = 0.67 [0.39, 0.86]; 23/27 = 0.85 [0.68, 0.94] | same | yes | both rounds' rows |
| 32 | E1 misses: confidences; "did not mention it" | 0.60–0.68; not mentioned | 0.62–0.68 and 0.60–0.68; **every run discusses the express `request?: Request`** and dismisses it (0 violations) | conf yes / **mention no** | cassettes |
| 33 | hexagonal v07 miss: "did not mention the decorator" | not mentioned | 3/3 pass at 0.70; **all 3 runs name `@Injectable()` from `@nestjs/common`** and dismiss it as DI metadata | **no** (qualitative) | cassettes |
| 34 | S2 on E1 seeds | 0/16 | 0/16 | yes | reports |
| 35 | Hand-planted expected symbolic: FF-P01 on 7, FF-S01 on hex v04; blocking fail 8/8 | as stated | `symbolicExpected` 8/8 (7 FF-P01, 1 FF-S01); blocking pass→fail on 8/8; no E1 copy changed | yes | reports, expected-findings.json |
| 36 | PERSIST S1 (hand-planted) | 3/3 | 3/3 | yes | reports |
| 37 | DUP-RULE pair discounted: informative seeds | 13/16 = 0.81 [0.57, 0.93] | same | yes | rows |
| 38 | FF-P01 repro table, shapes A–D | A none / B File / C Package / D none + EXTRACTOR_008 | at `f8251b8b`: identical; **at HEAD: A and D now `Package:typeorm`** (later fix `aliasDeclarationPackages`) | yes at commit / differs at HEAD | judge-catch2-ffp01-repro.ts |

**Mismatches**
- **#32 and #33, "did not mention" the leak.**
  - Evidence: this is the same pattern as round 1 #27. All 6 E1-miss runs and all 3 hexagonal v07 runs discuss the planted construct explicitly and judge it out of scope (an import or dependency concern, or DI metadata). They list 0 violations.
  - Classification: rounding/definition ambiguity (mention against flag). The text is wrong as written.
  - Severity: medium. The doc's reading "the judge does not see unused framework params / decorators" should be "the judge sees them and the rubric scope excludes them". That bears on the FRAMEWORK-LEAK operator design.
- **#38, FF-P01 table at HEAD.**
  - Evidence: at the round-2 commit the table reproduces exactly. At HEAD, shapes A and D give `Package:typeorm`, because the defect was fixed later. The script header says so; the doc does not.
  - Minor: D's "(and `@nestjs/typeorm`)" warning is not on `invoice.entity.ts` in either run; it belongs to another fixture file.
  - Classification: stale number (superseded by a later code change).
  - Severity: low.

**Not reproducible from committed files:**
- Round-2 seeding. It needs `../daedalus-e1-outcomes`, which is absent here, so the site tables could only be checked against the committed manifest.
- `record` and `replay` (they need Neo4j).
- The budget (500) and the swap and heavy-hook figures.

---

### v1.3-duprule-v2-2026-10-15.md

Raw sources used: `results/v1.3-judge-catch/duprule-v2/{plan.json, seed-manifest.json, dry-count.json, call-ledger.json, reports (27), diffs (18), scores.json, rows.csv}`, `tests/fixtures/judge-cassettes-v13/judge-catch-duprule-v2/**` (108 entries), round-1 and round-2 results (pools, diffs), `results/v1.3-cheap-semantics/duprule-v2/{flags/*.json (27), scores.json, clone-diagnostic.posthoc.json}`, `Docs/v1.3/judge-catch-frozen.md`, `Docs/operator-catalogue-antipatterns.md`.

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | v1 / v2 hashes; catalogue; index.ts; v2 digest | dda3accc; 72342a9e; 3cc3d03c; c1eef5d3; afe879b5 | same (sha256 at HEAD) | yes | repo files |
| 2 | Cells with a site, fixture / E1 | 1 / 16 of 65 | 1 / 16 of 65 | yes | seed-manifest `table` |
| 3 | Eligible/candidates | 1/1; 110/110 | same | yes | same |
| 4 | Twin host plan over E1 sites | domain 27, own 83 | domain 27, own 83 | yes | same `hostKinds` |
| 5 | Positive draws rejected at tsc | 0; 10, all in one opus cell, TS2345 | 10, all in claude-opus-5-5 OF full-aac run-1 | yes | `summary.rejectedDraws` |
| 6 | Seeds / twins compiling | 1+8 / 1+8, 0 twin rejected | same | yes | rows |
| 7 | Twin hosts | domain 4, own 5 | domain 4, own 5 | yes | rows |
| 8 | E1 seed edits = round 2's, +/- lines byte-identical | 8/8 (+ fixture = round 1's) | 9/9 identical +/- line sets | yes | diffs (3 dirs) |
| 9 | Diffs; reports | 18; 27 | 18; 27 | yes | dirs |
| 10 | Evaluated projects; judged units | 27 (9/9/9); 36 | same | yes | plan.json |
| 11 | Dry count; live calls; judge; probes | 135 (108+27); 135; 108; 27 | same; all attempts 1, valid, opus-5-5, 2.1.294 | yes | dry-count, ledger, cassettes |
| 12 | Replay 27/27 identical | 27/27 | vote and confidence re-derived = reports for 36/36 units | partial | cassettes |
| 13 | Fixture: catch; twin FF | 1/1; 0/1 | same (seed vote split 2-1 fail) | yes | reports + cassettes |
| 14 | E1: catch; paired; twin FF; paired twin FF | 8/8 [0.68, 1.00]; 7/8 = 0.88 [0.53, 0.98]; 2/8 = 0.25 [0.07, 0.59]; 1/8 = 0.13 [0.02, 0.47] | same (JS `toFixed` gives 0.125 → 0.13) | yes | same; scores.json |
| 15 | Combined: catch; paired; twin FF; paired | 9/9 [0.70, 1.00]; 8/9 = 0.89 [0.57, 0.98]; 2/9 = 0.22 [0.06, 0.55]; 1/9 = 0.11 [0.02, 0.43] | same | yes | same |
| 16 | Twin FF by host | domain 1/4 (paired 1/4); own 1/5 (paired 0/5) | same | yes | same |
| 17 | v1 twin: fixture, E1, combined, paired | 1/1, 5/5, 6/6 = 1.00 [0.61, 1.00], 5/6 | same | yes | R1/R2 rows |
| 18 | On the 5 cells with both twins: v1, v2 | 5/5; 1/5, inherited (haiku usecases) | 5/5; 1/5 haiku, base also fails | yes | R2 and v2 rows |
| 19 | Clean fixture; E1; combined (units / bases) | 0/2, 0/1; 2/12 = 0.17 [0.05, 0.45], 2/8 = 0.25 [0.07, 0.59]; 2/14 = 0.14 [0.04, 0.40], 2/9 = 0.22 [0.06, 0.55] | same | yes | reports |
| 20 | The two clean fails and their reasons | haiku usecases; sonnet faac1 `src/domain` (3/3 cite StockAllocationService.reserve) | same; 3/3 runs cite it | yes | cassettes |
| 21 | S2 seeds; S2 twins; blocking changed | 0/9; 0/9; none | 0/9; 0/9; none | yes | reports |
| 22 | Pooled, all-strata seeds (v1 / v2) | 30/35 = 0.86 [0.71, 0.94] both | same | yes | three rounds' rows |
| 23 | Pooled operator-only seeds | 23/27 = 0.85 [0.68, 0.94] both | same | yes | same |
| 24 | Pooled DUP seeds | 9/9 both | same | yes | same |
| 25 | Twin FF, all twins | v1 8/47 = 0.17 [0.09, 0.30]; v2 4/50 = 0.08 [0.03, 0.19] | same | yes | same |
| 26 | Other positives: FL / PERSIST / REPO / FAT | 12/17 / 4/4 / 4/4 / 1/1 | same | yes | same |
| 27 | DUP share of twin fails | 6 of 8 before; 2 of 4 after, 1 paired | 6/8; 2/4, 1 paired | yes | same |
| 28 | Paired twin fail cause (sonnet faac1) | inline `isOrderStatus` in AdvanceOrderUseCase | `src/application` fails 3/3 (base passes) citing inline check; `src/domain` also fails (inherited) | yes | cassettes |
| 29 | First-run seed violation names the copy; also "doesn't belong" | 9/9; 9/9 | 9/9; 9/9 | yes | cassettes (runIndex 0) |
| 30 | Strict construct flag (>= 2 runs) | 4/9 seeds; 0/9 twins | 4/9; 0/9 | yes | cassettes |
| 31 | `duplicationCited` | 9/9 seeds; 9/9 twins | 9/9; 9/9 | yes | cassettes |
| 32 | Test-retest vs round 2 | 8/8 fail both, same unpaired haiku row | same | yes | R2 + v2 rows |
| 33 | Cheap clones: catch; twin; clean | 1/9 = 0.11 [0.02, 0.43] (fx 1/1, E1 0/8); 0/9 / 0/9; 0/9 | same | yes | cheap flags/*.json, independent unit logic |
| 34 | Cheap shared-literals: catch; twin raw/paired; clean | 2/9 = 0.22 [0.06, 0.55] (fx 1/1, E1 1/8); 1/9 / 0/9; 0/9 | same (twin flag: gpt own-file, inherited from base) | yes | same |
| 35 | Cheap either | 2/9; 1/9 / 0/9; 0/9 | same | yes | same |
| 36 | Clone diagnostic: bare guards (density 0); with edge, not cross-component | 5 of 8; 3, all intra-component | 5; 3, crossComponent false | yes | clone-diagnostic.posthoc.json |
| 37 | Option-1 scan: 0 matches over 24 parameter rules | 0/24 | no raw output committed | n/a | — |
| 38 | `antipatterns.test.ts` 21/21 | 21/21 | not run (outside results scope) | n/a | — |

**Mismatches:** none in the headline numbers.

**Observation, not a doc error.** In this run the unmodified `antipattern-nest` base has blocking verdict `fail`; in round 1 it was `pass`. This is consistent with the later FF-P01 alias fix (merged `95637b75`, before the v2 branch): FF-P01 now fires on the fixture's TypeORM entity imports.
- The doc's "no copy changed the blocking verdict" is correct.
- The across-round pools mix symbolic rows produced by two extractor versions. Judge rows are unaffected.

**Not reproducible from committed files:**
- The option-1 scan (#37).
- v2 seeding, `cheap-semantics-v2-eval.ts` and `cheap-v2-clone-diagnostic.ts`. All three need `--seed <work>` built from `../daedalus-e1-outcomes`, which is absent here, so the cheap numbers were re-derived from the committed `flags/*.json` only.
- `record` and `replay`.
- The budget (200) and the swap figures.

---

## Regeneration

Committed score scripts, offline replay from the cassettes (no Neo4j, no network, no credentials). Run from the repo root:
```
env -i PATH=$PATH HOME=$HOME npx tsx scripts/v1.3/judge-catch-score.ts  --results <copy of results/v1.3-judge-catch>
env -i PATH=$PATH HOME=$HOME npx tsx scripts/v1.3/judge-catch2-score.ts --results <copy of .../round2> --round1 <copy of round1>
env -i PATH=$PATH HOME=$HOME npx tsx scripts/v1.3/judge-catch-v2-score.ts --results <copy of .../duprule-v2>
```

The scripts overwrite `scores.json` and `rows.csv` inside `--results`, so point that flag at a copy. `--cassettes` defaults to the committed dirs. The v2 scorer reads the round-1 and round-2 `scores.json` from the repo paths (read-only).

Results:
- **duprule-v2:** `scores.json` and `rows.csv` are **byte-identical**.
- **round 1 and round 2:** `rows.csv` is **byte-identical**. `scores.json` **differs only** by empty `AP-DUP-RULE2` blocks: `perOperator` entries at 0/0, and `rounds12OperatorSeeds["AP-DUP-RULE2"] = 0/0`.
  - Cause: `PROBED_FUNCTION` in `judge-catch-run.ts` gained `AP-DUP-RULE2` after those results were committed.
  - With those keys stripped, the JSON is equal.
  - Classification: stale artefact against current script, not a scorer bug. Low.

Round-1 seeding (deterministic; needs no Neo4j, network or credentials; about 90 s):
- Command: `npx tsx scripts/v1.3/judge-catch-seed.ts --out <scratch>`.
- The manifest is identical apart from `generatedAt`, and the 53 diffs reproduce.
- Round-2 and v2 seeding need `--e1 <path>/daedalus-e1-outcomes`, which is not in this environment.

Judge `full-mock`, `plan`, `dry`, `record` and `replay` (`scripts/v1.3/judge-catch-run.ts <phase> <work> [--cassettes …] [--results …] [--budget N]`):
- They need Neo4j 5.26 with APOC (`docker-compose.yml`: `neo4j:5.26-community` plus the apoc plugin) and these env vars: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`. The docs source them from `~/.daedalus-bt.env`.
- `replay` makes no model call, and the provider skips the CLI preflight in replay mode. It still runs `firewall evaluate` against Neo4j on the seeded work dir, so it could not be run here.
- The vote and confidence part of the replay was re-derived offline from the cassettes: 168/168 units identical.
- A live `record` needs no API-key env var. The init probe requires `apiKeySource: 'none'`, so `ANTHROPIC_API_KEY` must be unset. The credential is the Claude subscription login stored in the isolated config dir `~/.firewall/judge-claude-config` (ISO-04). The child env is allow-listed to PATH, HOME, USER, LOGNAME, TMPDIR, LANG, LC_ALL, CLAUDE_CONFIG_DIR and DISABLE_AUTOUPDATER.

Pinned CLI:
- **Claude Code CLI `2.1.294`** (`PINNED_CLI_VERSION`, `src/llm-critic/frozen.ts`). It is the judge (model `claude-opus-5-5`, effort high, 3 runs). The default path is `~/.firewall/judge-cli/node_modules/.bin/claude`, which can be overridden with `--judge-cli`.
- This container has `claude` 2.1.301 on PATH. A `record` with it would fail the `LLM_CLI_VERSION_DRIFT` preflight.
- No codex or gemini CLI is used by these three runs. The `agy`/gemini providers exist in `src/llm-critic` but are not on this path.

Other offline scripts:
- `npx tsx scripts/v1.3/judge-catch2-ffp01-repro.ts <scratch>` needs only the extractor. At HEAD the output differs from the doc, because the defect was fixed later. At `f8251b8b` it is identical.
- `cheap-semantics-v2-eval.ts` and `cheap-v2-clone-diagnostic.ts` need no Neo4j and no LLM, but they need the E1 seeded work dir.

## Secrets / personal-path scan

Files scanned:
- `results/v1.3-judge-catch/**`
- `results/v1.3-cheap-semantics/duprule-v2/**`
- `tests/fixtures/judge-cassettes-v13/{judge-catch, judge-catch-round2, judge-catch-duprule-v2}/**`

Patterns:
- `/Users/<x>`, `/home/<x>`, `/Volumes/`, `/private/var`, `/var/folders`, `/tmp/…`, `~/.…`
- `sk-ant-…`, `sk-…`, `AIza…`, `gh?_…`, `AKIA…`, `xox?-…`, private-key headers
- `api_key`, `secret`, `password` and `bearer` assignments
- `bolt://` and `neo4j://` URIs
- e-mail addresses

**0 hits.**
- Report paths are rewritten to `<work>` (472 occurrences).
- Cosmetic scrub artefact: `results/v1.3-judge-catch/duprule-v2/seed-manifest.json`, `summary.rejectedDraws[*].first` and the matching rows' `typecheckErrors`, contain `../../../../../../../../../..src/...` (20 occurrences). The rewriting dropped a `/` and leaks only directory depth, no name. This is not a secret.

Note: an untracked `replication/` directory appeared in the repo at 20:01 during this audit. It is not created by any command in this audit; probably a parallel session. I did not touch it.

## Summary
1. All headline numbers reproduce exactly from the committed reports, cassettes and manifests: about 100 rows across the three docs, covering catch, paired catch, twin and clean false-fail rates, Wilson intervals, the cross-round pools, call counts and the cheap-proxy table. The cassette majority and confidence equal the report values for 168/168 judged units.
2. The committed scorers rerun offline: duprule-v2 is byte-identical. Round 1 and round 2 have byte-identical `rows.csv`, and their `scores.json` differs only by empty `AP-DUP-RULE2` 0/0 blocks from a later `PROBED_FUNCTION` change.
3. Numeric doc errors, both low severity and both in round 1:
   - "10 of the 11 seeds on one fixture" should be 11 of 11.
   - "22 reference-project units" should be 16.
4. Qualitative error, medium severity, in both round 1 and round 2: the misses "did not mention" the express `Request` or `@Injectable`. In fact every passing run names the construct and rules it out of scope, so this is a rubric-scope effect, not judge blindness.
5. Not reproducible here:
   - judge `record` and `replay`, which need Neo4j 5.26 with APOC, the seeded work dirs and, for a live run, the pinned CLI 2.1.294 with a subscription login;
   - round-2 and v2 seeding and cheap re-extraction, which need `daedalus-e1-outcomes`;
   - the option-1 "0/24" scan, which has no raw file.

   No secrets or personal paths were found.
