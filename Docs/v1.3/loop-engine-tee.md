# Loop evaluator engine tee (`--engine both`): design and pass criterion

Backlog job #16 (E1), gate line D8. Status: **design and pass criterion committed before any number was computed**
(rules block, rule 11). Results are appended in §6 by a later commit of the same branch.

## 1. Why

The thesis keeps Neo4j 5.26.24 + APOC as the reference engine of every reported number. The in-process interpreter
(`--engine cypher-interp`, #128) runs the same compiled Cypher text and was shown equal on 65,254 statements, but that
parity was measured once, offline, on the 79 reference projects. Study 2 evaluates ~900 snapshots written by agents
the parity sweep never saw. A tee mode that scores every loop snapshot on both engines gives Study 2 live parity
evidence on exactly its own snapshots, and makes a divergence loud instead of silent.

## 2. Modes

`--engine neo4j|cypher-interp|both` on `scripts/loop-harness-cli.ts` and `scripts/loop-replay-cli.ts`; the loop plan
may also carry `"engine"` (the CLI flag wins). **Absent everywhere = today's behaviour, byte for byte** (the
`evaluate_project` wiring `buildContext` resolves; no new field in any record).

| mode | evaluation recorded | extra fields |
|---|---|---|
| (absent) | as today | none |
| `neo4j` | Neo4j | none (identical to the default when Neo4j is the resolved engine) |
| `cypher-interp` | interpreter | `evaluation.engineOfRecord: 'cypher-interp'` |
| `both` | **Neo4j** (engine of record) | `evaluation.engineOfRecord: 'neo4j'`, `evaluation.parity`, `run.json` `parity` counts |

How the interpreter runs: the same `evaluateProject` call (same spec, same pinned per-run tsconfig, `includeViolations`,
v1.3 scoring), with the pipeline config's `graphEngine` set to `cypher-interp` (`MemoryGraphRepository`). It does
**not** go through the MCP server's `interp-evaluator.ts`, because that path has a result cache keyed by mtimes and
takes no tsconfig (the loop's work tree has none, `TSCONFIG_NOT_FOUND`). Nothing under `src/` changes.

In `both` the Neo4j evaluation runs first and is the one the loop uses for everything (the gate's repair decision, the
blocking list shown to the agent, `report-<turn>.json` for `check-correct`). The interpreter's evaluation is only
compared; its report is not written.

## 3. What is compared (per snapshot)

| field | comparison |
|---|---|
| blocking findings | multiset of identities `(ruleId, template, filePath, target)` |
| `blockingByRule`, `advisoryByRule` | count per rule id |
| `verdict`, `violationCount`, `blockingViolationCount`, `advisoryViolationCount` | exact |
| `ahs`, `blockingAhs` | exact (`===`, null-aware) |

`parity.status`:
- `identical`: every row above equal.
- `order`: everything equal except `ahs`/`blockingAhs`, which differ by at most 4 ULP (the interpreter doc's trap T2,
  the class the 65k-statement sweep calls `order`). Reported separately; it is **not** counted as identical.
- `divergent`: anything else. `parity.diff` holds a compact summary: findings only on Neo4j / only on the interpreter
  (at most 20 each, plus totals), per-rule count differences, and the scalar fields that differ.
- `check-failed`: the interpreter evaluation returned an error (code and message recorded).

If the Neo4j evaluation itself fails, the snapshot carries `evaluationError` exactly as today and the interpreter is
not run (there is nothing of record to compare).

A divergence never stops the run: the step proceeds on the Neo4j evaluation, the harness prints one `PARITY` line to
stderr, and at run completion `run.json` gets `parity: { snapshots, identical, order, divergent, checkFailed }`
(counted from every step record of the run, so a resumed run counts the steps of earlier invocations too).

## 4. Pass criterion (fixed before running)

1. `--engine both` records `evaluation.engineOfRecord: 'neo4j'` and `evaluation.parity` on every evaluated snapshot,
   with a diff summary when not identical; a divergence does not stop the run and is counted in `run.json`
   (unit tests with a stub evaluator pair).
2. The #142 replay (`npm run loop:replay` tapes: 3 tasks × 3 arms, 39 snapshots) run with `--engine both` on
   Neo4j 5.26.24 + APOC 5.26.24 (one instance, tarballs): **39 of 39 `identical`**. Any `order`, `divergent` or
   `check-failed` snapshot fails the criterion and is reported as such, with its diff.
3. The replay's own checks (reproducibility A vs B, gate exactness, consistency against a fresh checkout, labels) still
   pass in `both` mode.
4. Default mode unchanged: no new field in step records or `run.json` when `--engine` is absent; the existing loop unit
   tests pass unchanged; rule 3's 71-variant reference diff is byte-identical.

Analysis: a table of the 39 snapshots (run, turn, status) and the counts. No statistic beyond counts.

## 5. Out of scope

No change to Cypher templates, presets, prompt frames, the interpreter or the MCP server. No live pilot (kill list 2).
The MCP tools inside the `daedalus-mcp` arm (`check_diff`/`check_file`) keep their own engine; the tee covers the
evaluator of record only.

## 6. Results

(appended after the run)
