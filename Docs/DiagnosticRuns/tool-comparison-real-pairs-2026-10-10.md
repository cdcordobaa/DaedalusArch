# Tool comparison and real fix-commit pairs (2026-10-10)

ADR-030 experiments, registered under prereg v19 (commit `f3cdc60`) before either ran. Both are symbolic-only, with no LLM call. Tool versions: DaedalusArch instrument v2, run through the registered harness on the shared lane Neo4j `daedalus-neo4j-bt` under the lock. dependency-cruiser 18.4.0 with typescript 5.9.3 (`experiments/tool-comparison/depcruise/package-lock.json`), using translation 1.0.0. The load average was about 5 during the runs, on a machine shared with the E1 lane.

Sources: `results/tool-comparison/` and `results/real-pairs/` (`recall.csv`, `seeds.csv`, `baseline-volume.csv`, `baseline-unique-findings.csv`, `runtime.csv`, `pairs.csv`, `resolved-findings.csv`, `summary.json`; the `-dts` files are the post-hoc variant described below).

## A. Comparison on the SO4 held-out seeds (registered primary, translation 1.0.0)

Each tool's new findings are taken against its own unseeded baseline, and matched to the registered expected keys. Denominators are the seeds that SO4 v2 scored. The 95 % intervals are instance Wilson intervals, which assume independent seeds.

| Operator (rule) | n | DaedalusArch | dependency-cruiser | Both | DA only | dc only |
|---|---|---|---|---|---|---|
| MO-S01 (FF-S01/S04) | 8 | 8 (1.00) | 8 (1.00) | 8 | 0 | 0 |
| MO-S03 (FF-S03) | 2 | 2 | 2 | 2 | 0 | 0 |
| MO-P01 (FF-P01) | 13 | 13 (1.00) | **4 (0.31)** | 4 | 9 | 0 |
| MO-C04 (FF-C04) | 14 | 14 (1.00) | 14 (1.00) | 14 | 0 | 0 |
| MO-X01 (FF-S01, dynamic `import()`) | 6 | **0** | **6 (1.00)** | 0 | 0 | 6 |
| In-coverage seeds (S01, S03, P01, C04) | 37 | 37 (1.00, 0.91–1) | 28 (0.76, 0.60–0.87) | 28 | 9 | 0 |
| All seeds | 43 | 37 (0.86, 0.73–0.93) | 34 (0.79, 0.65–0.89) | 28 | 9 | 6 |
| Twins fired (lower is better) | 42 | 2 (0.05) | 2 (0.05) | 2 | 0 | 0 |

The DaedalusArch arm reproduces the known SO4 v2 outcome: 37/37 in coverage and 0/6 on MO-X01. Both tools fire on the same two valex MO-S01n twins.

**Why the tools disagree.**
- **MO-X01** (6 seeds, dependency-cruiser only). dependency-cruiser parses `import()` as a dependency. The DaedalusArch extractor does not (RC-DYNAMIC-IMPORT), as stated before the run.
- **MO-P01** (9 seeds, DaedalusArch only). This is a **translation defect, found after the run (POST-HOC)**. T8 copies the extractor excludes into dependency-cruiser's `options.exclude`, and those excludes also remove *package targets*. Eight of the misses are packages that resolve to a declaration file (the U5a `index.d.ts` stubs and `@types/*`), which the `**/*.d.ts` exclude drops. One (ghostfolio, `prisma`) resolves to `node_modules/prisma/build/index.js`, which the `**/build/**` exclude drops. DaedalusArch names packages by specifier, so its excludes never touch them.

**Post-hoc sensitivity variant `dts`** (declared, not primary; `*-dts.*` files). This variant keeps `.d.ts` modules in the graph and excludes them only as rule sources. With it, dependency-cruiser scores MO-P01 12/13, in-coverage 36/37 (0.97), and all seeds 42/43 (0.98). DaedalusArch stays at 37/43. The remaining miss is the `build/` exclude above. Twins are unchanged at 2/42.

## A. Volume on the seven unseeded bases (unique keys)

| Rule | DaedalusArch | dependency-cruiser | Overlap | DA only | dc only |
|---|---|---|---|---|---|
| FF-S01 | 69 | 25 | 25 | 44 | 0 |
| FF-S04 | 33 | 0 | 0 | 33 | 0 |
| FF-S03 (valex) | 3 | 3 | 3 | 0 | 0 |
| FF-P01 | 20 | 19 (20 in `dts`) | 19 (20) | 1 (0) | 0 |
| FF-S02 (cycles) | 27 | 78 | 11 | 16 | 67 |
| FF-C04 | 6 | 7 (6 in `dts`) | 4 | 2 | 3 (2) |

**Where the volumes differ.**
- **Ghostfolio.** All 44 DA-only FF-S01 and all 33 DA-only FF-S04 findings are on ghostfolio. dependency-cruiser does not resolve the monorepo alias `@ghostfolio/api/*` (`couldNotResolve`), so those edges never reach a rule. It does resolve `@ghostfolio/common/*` into `libs/` outside the evaluated directory, and finds 33 cycles there that DaedalusArch never ingests.
- **nestjslatam cycles.** DaedalusArch reports 17 cycles and dependency-cruiser 35, with only 1 in common. DaedalusArch enumerates every simple cycle up to length 10. dependency-cruiser reports one cycle per module that sits on a cycle. The two cycle units differ, so their overlap is not a precision measure.
- **On the other five bases** the two tools agree on FF-S01, FF-S03 and FF-P01. They are within one or two findings on FF-C04, where the orphan definitions differ: DaedalusArch ignores package edges and skips barrels, while dependency-cruiser counts any dependency. These cases were not inspected one by one.

## A. Runtime (indicative, TV-105)

Over the 94 runs, the median wall time per run was **2.66 s for DaedalusArch** (tsx process plus Neo4j ingest; its in-process `durationMs` median is 92 ms) and **0.76 s for dependency-cruiser**. Totals were 267 s and 72 s. On the real-pairs runs the medians were 3.27 s and 0.94 s.

## What dependency-cruiser cannot express (not translated)

These rules were not translated:
- FF-P02 dependency inversion.
- FF-P03 repository pattern, FF-P04 use-case isolation and FF-P05 controller-no-entity. These need class roles and symbol kinds.
- **FF-P06 domain-state purity**: constructor injection and field types are data flow, not import edges.
- The metric rules FF-C01/C02/C03/C05/C06. FF-C05 fan-in is partly expressible but outside the scope.
- FF-SO01..SO03 (member counts, inheritance depth).
- The naming rules FF-CV01..CV04, which check class names.
- FF-CV05 test pairing and FF-CV06 index logic.
- The AHS score and verdict, and the LLM judge FF-N01/N02.

## B. Real fix-commit pairs (n = 5, descriptive)

A tool *detects* a fix when a finding on a touched file before the fix is gone after it, with renames mapped (the primary rule). The *strict* rule requires findings on touched files before and none after.

| Pair | Fix (research note) | DA symbolic-all | DA comparable | dependency-cruiser |
|---|---|---|---|---|
| p1 raouf `987bad7a`→`acda9e0a` | domain service moved to application | no | no | no |
| p2 raouf `1e440981`→`9c2429c5` (merge) | cross-module dependency replaced by a port | no | no | no |
| p3 raouf `0496d240`→`f3333d1c` (merge) | bounded contexts isolated with gateway adapters | **yes** (S01, S04, C01; strict no) | **yes** (2 S01/S04; strict no) | **yes** (2 S01/S04; strict no) |
| p4 raouf `f0e4db91`→`bb0e295a` | DDD boundaries and hexagonal isolation hardened | **yes** (30 resolved: S01, S04, P01, C01, C02; strict no) | **yes** (22 resolved; strict yes) | **yes** (22 resolved; strict yes) |
| p5 zhuravlevma `39b5a39f`→`100deb60` | wiring only: typeorm moved to infra module | no | no | no |
| **Detected (primary / strict)** | | **2 / 0** | **2 / 1** | **2 / 1** |

Both tools detect the same two fixes, through the same import-direction findings. Why the other three are missed:
- **p1.** The spec maps both `core/domain/**` and `core/application/**` to the domain layer through `**/core/**`, which comes first in the domain layer's directories. The moved file never changes layer under this spec.
- **p2.** No translated finding touches the changed files before the fix: a cross-module import inside one layer is not a layer violation under the spec. The DaedalusArch findings on touched files rise from 9 to 19 after the fix, because the fix adds files.
- **p5.** The fix only changes NestJS module wiring. No rule of either tool reads module wiring.

The `dts` variant changes no pair.

**Claims.** Both tools flag 2 of the 5 real fixes, the same two, through the same import-direction rules. On these pairs, DaedalusArch's extra symbolic rules add resolved metric findings (FF-C01, FF-C02) on p3 and p4, but detect no additional fix. With n = 5, four of the pairs from one repository, and one spec written for a later commit, this is a case description, not an estimate (TV-106).
