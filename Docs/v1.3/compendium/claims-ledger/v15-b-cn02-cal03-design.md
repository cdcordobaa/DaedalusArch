# Claims ledger, part: 2026-10-28 sync: v1.5 CN-02 development revision and the CAL-03 admission design

Part of [the claims ledger](../claims-ledger.md); the legend and the conflicts are there. Added 2026-10-28 by the daily thesis sync, from `origin/main` at `a1f605e3` (PRs #401–#403). Zero model calls in the window.

Primaries: `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md` (PR #401) and `ops/notes/cal-03-admission-design.md` (PR #402). PR #403 (pre-flight check of the frozen schema without the v1.5-only `ddd.invariants` field) is a code change with no report; no claim is taken from it.

Superseded: none by status. Scope note: the CN-02 report states that CAL-02 "is now development evidence" and can admit nothing (`ops/notes/cal-03-admission-design.md:10`). The rows admitted by CAL-02 (C10210 onward in part `v15-a`) remain correct as CAL-02 results, but they no longer define the confirmatory DDD family; CAL-03, not yet built, does.

### `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md`

| id | statement | numbers | source | type | set | status | replication | quantity | verified against | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| C10300 | CN-02 target, stated before the revision: all seven Pareto rules covered, at least 13 of the 16 catalog rows admitted | `at least 13 of the 16` | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:11` | descriptive | none | exploratory | — | target of the CN-02 revision | line read; a goal, not a bar | K06, K11, K13 may stay exploratory |
| C10301 | After CN-02, CAL-02 shows 13 rows at 4/4 (K06, K11, K13 still miss) and 0 false positives in 96 clean cases; CAL-02 was read to revise the rules | `13 rows 4/4`, `0 false positives in 96 clean cases` | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:60` | criterion | development | established | — | CAL-02 recall and false positives after CN-02 | line read; zero-call rescoring, not re-run | Fitted. The report says these numbers say nothing about accuracy on new code. Before CN-02: 7 rows 4/4 |
| C10302 | After CN-02, CAL-01 shows 16 rows at 2/2, with the 2 known false positives (K03, K08 in rental) unchanged | `16 rows 2/2` | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:61` | criterion | development | established | — | CAL-01 recall after CN-02 | line read | Fitted. Before: 15 rows 2/2, K04 0/2 |
| C10303 | On 45 recorded agent trees (CN-01 calibration), 22/22 traps and 1 false positive (P5 c07 facade) before and after CN-02 | `22/22 traps, 1 false positive` | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:63` | criterion | development | established | — | traps found and false positives on recorded trees | line read | Fitted; identical before and after |
| C10304 | Precision fixtures and unit tests: 51 tests, all pass after CN-02 | `51 pass` | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:65` | descriptive | development | established | — | unit tests passing | line read; tests not re-run | |
| C10305 | On the 24 confirmatory study tasks, every DDD clean solution is silent on R-D5, R-D5S, R-D3, R-D4R and R-PURE; R-D5 fires on 8 of 12 DDD traps; Hexagonal hits are unchanged | `8 of 12 DDD traps` | `Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md:66` | criterion | development | exploratory | — | R-D5 hits on DDD trap tasks | line read | The tasks are trap-family variants of the development puzzles (see M271); read as a regression check, not as accuracy |

### `ops/notes/cal-03-admission-design.md`

| id | statement | numbers | source | type | set | status | replication | quantity | verified against | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| C10306 | CAL-03 design, committed before any case exists: 2 new domains, 10 cases per row, 160 cases in total | `160 cases` | `ops/notes/cal-03-admission-design.md:25` | descriptive | none | exploratory | — | planned size of CAL-03 | line read; plan figure | No CAL-03 case exists at this commit |
| C10307 | CAL-03 per-row admission bar, unchanged from CAL-02: recall 4 of 4 positives | `4 of 4` | `ops/notes/cal-03-admission-design.md:51` | descriptive | none | exploratory | — | per-row recall bar | line read; plan figure | |
| C10308 | CAL-03 per-row admission bar: 0 of 6 clean cases flagged (4 twins and 2 legitimate) | `0 of 6` | `ops/notes/cal-03-admission-design.md:52` | descriptive | none | exploratory | — | per-row false-positive bar | line read; plan figure | |
| C10309 | CAL-03 family bar: pooled recall over admitted rows at least 0.90 with Wilson lower bound at least 0.80 | `0.90`, `0.80` | `ops/notes/cal-03-admission-design.md:59` | descriptive | none | exploratory | — | family-level bar | line read; plan figure | |
| C10310 | CAL-03: if the admitted rows cover fewer than 3 of the 7 Pareto rules, DDD stays exploratory | `3 of the 7` | `ops/notes/cal-03-admission-design.md:61` | descriptive | none | exploratory | — | minimum rule coverage | line read; plan figure | |
