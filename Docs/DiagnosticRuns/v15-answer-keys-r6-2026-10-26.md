# v1.5 answer keys, revision R6 (decisions B1–B3, 2026-10-26)

Zero model calls. No new runs: the recorded final step trees were re-scored. No sealed or held-out set was read.

## Deviation statement

The three categories below were found in the PUZZLE-04 hand reads, after the tool-arm outcomes were known. Two of
them loosen a key in a way that raises tool-arm counts. They are recorded as one post-hoc deviation, dated
2026-10-26, and applied to every arm, the baselines included. Counts under the earlier keys stay reported next to
the new ones.

| Category | Ruling (`ops/decisions.md`, 2026-10-26) | Key change |
|---|---|---|
| **P1-SG1-c**: an unused multi-root `saveAll` left declared on the port and its adapter | B1: clean. A method no call reaches writes nothing | P1 oracle R6: the two declaration clauses skip a store method that no call in the tree invokes by name on a store-typed receiver. The function-body clause is unchanged |
| **P2-SG1-e**: sales reads membership's tier through a port sales owns | B2: clean, provided sales makes no points decision with it | P2 oracle R6: a `tier()` call is exempt when the receiver's type is declared under `src/sales/`. The points-comparison and threshold clauses still fail any points decision |
| **P5-SG2-a**: a composition-root facade carrying the cross-context write | B3: trap | None. Recorded as a known gap of the gate's consistency check |

## Results

Script: `experiments/v15-stage0/rescore-keys.ts --label r6` (P1 added to the puzzles it covers). Record:
`experiments/v15-stage0/results/rescore-r6.json`. Clean = every behaviour test and every sub-goal oracle passes.

| Run | Puzzle | As reported | Stage 0 keys | R6 keys |
|---|---|---|---|---|
| PUZZLE-01 baseline | P1 | 0/5 | not re-scored | 0/5 |
| PUZZLE-01 baseline | P2 | 0/5 | 1/5 | 1/5 |
| PUZZLE-02 pull | P1 | 4/5 | not re-scored | 4/5 |
| PUZZLE-02 pull | P2 | 0/5 (3/5 by hand read) | 3/5 | 3/5 |
| PUZZLE-03 baseline | P5 | 0/5 | 0/5 | 0/5 |
| PUZZLE-04 gate | P1 | 2/5 | not re-scored | **5/5** (c04, c08, c11 change: P1-SG1-c) |
| PUZZLE-04 gate | P2 | 2/5 | 4/5 | **5/5** (c18 changes: P2-SG1-e) |
| PUZZLE-04 gate | P5 | 0/5 | 4/5 | 4/5 (c07 stays trapped: P5-SG2-a) |
| PUZZLE-04 pull | P5 | 0/5 | 5/5 | 5/5 |

Only the runs the hand reads named changed. No baseline count changed. The reference solutions still score as
designed: P1 and P2 `clean` pass every sub-goal, `trap` fails them.

## Reading

The PUZZLE-04 gate is now 5/5 on P1, 5/5 on P2, 4/5 on P5 and 5/5 on P6. Against the baselines (P1 0/5, P2 1/5,
P5 0/5, P6 0/5) the direction is the same as reported. These are exploratory counts on puzzles and keys written by
the same sessions as the rules, and two of the three rulings were made after the outcomes were seen.
