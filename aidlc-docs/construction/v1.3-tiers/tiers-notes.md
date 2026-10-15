# v1.3 rule tiers and v1.3 scoring mode (unit U-D, FR-V6)

**Date**: 2026-10-14. **Branch**: `v1.3-tiers`, from `origin/v1.3` at `f0f1137`. **PR** into `v1.3`.
**Binding spec**: `Docs/v1.3/rule-tiers.md` (sealed; content unchanged, sha256 checked by a test against `Docs/v1.3/sealed-hashes.md`).

## What changed

| Piece | File | Notes |
|---|---|---|
| Tier table | `src/scoring-engine/rule-tiers.ts` | `RULE_TIERS`, keyed by rule id, with an optional per-style override (`byStyle`), `judge` and `partial` flags; `ruleTier(id, style)`. `HEXAGONAL_RULE_TIERS` records the per-template decision for the five hexagonal templates. Kept outside the frozen registries: `TEMPLATE_REGISTRY`, `CYPHER_TEMPLATES` and `FitnessFunction.severity` are untouched, so `corpus/frozen-instrument.json` and the v1.2E scoring path are byte-identical. |
| v1.3 scoring | `src/scoring-engine/tiered-scoring.ts` | `computeTieredScoring`, `overallVerdictOf`, `parseScoringMode`. Runs beside `scoreDimensions`, never in its place. |
| Scoring mode option | `ScoringInput.scoringMode`, `ScoreCommandConfig.scoringMode`/`style`, `PipelineConfig.scoringMode` | Library default `v1.2e`: every existing caller, the golden pipeline runs and the scripts get the v1.2E scoring with no `tiers` key. |
| v1.3 entrypoints | `src/cli/cli.ts`, `src/mcp-server/{evaluate-project,tools,server,types}.ts` | `firewall evaluate --scoring v1.3` (the default) or `--scoring v1.2e`. MCP `evaluate_project` defaults to `v1.3`, takes an optional `scoring` argument, and returns `scoringMode` and `tiers`. |
| Report | `src/shared/types/evaluation.ts` (`TieredScoring`, `TierRuleRow`, `NotApplicablePart`, `ScoringMode`); `schemas/report.schema.json` and the embedded `REPORT_SCHEMA` | One optional top-level `tiers` property (additive amendment, same pattern as ADR-026 and ADR-028); a v1.2E report is unchanged and still validates. `formatHuman` prints a tier block only when `tiers` is present. |
| Spec validation | `src/spec-parser/spec-validator.ts`, `src/fitness-compiler/extension-templates.ts` | `validateSpecAgainstProject(spec, path, { rules: 'v1.3' })` also accepts every template of `V13_EXTENSION_TEMPLATE_CATALOGUES` (hexagonal, module wiring; the DDD library registers one entry) and every function name of an `EXTENSION_TEMPLATES` library. The default `v1.2e` check is unchanged (`CYPHER_TEMPLATES` plus `HEXAGONAL_TEMPLATES`). `firewall validate --rules v1.3` (default) also compiles with `v13Templates: true`; `--rules v1.2e` behaves as before. This closes the open point in `integration-notes.md`. |
| Experiment harness | `scripts/run-experiment.ts` `cliArgv` | Adds `--scoring v1.2e`, so a registered v1.2E plan rerun on this branch keeps the v1.2E verdicts now that the CLI defaults to v1.3. Two exact-argv tests were updated to include the two new elements (no assertion removed). |
| Hexagonal decision | `Docs/v1.3-hexagonal-notes.md` §8 | `port-dependency-inversion` is **advisory**: its Cypher is `toFloat(interfaceDeps) / totalDeps AS ratio ... WHERE ratio < $threshold`, a ratio against a threshold, not a pure edge fact. |

### Tiers as implemented

Blocking: FF-S01, FF-S02, FF-S04, FF-P01, FF-P03, FF-P06 (partial), and FF-S03 for `layered` only. Advisory: FF-S03 under every other style (and with no style), FF-P02, FF-P04, FF-P05, FF-C01..C06, FF-SO01..SO03, FF-CV01..CV06, and FF-N01 and FF-N02 (flagged `judge`: reported, non-blocking). Hexagonal: `dependency-direction-graph` (FF-S01), `core-isolation` (FF-S04) and `port-adapter-pattern` (FF-P03) blocking; `port-dependency-inversion` (FF-P02) and `layer-skip-graph` (FF-S03) advisory. Each hexagonal tier equals the tier of the id the library gives the template, so the one id-and-style table serves every style.

A rule id the table does not list (an ADR-derived function, a custom function, or a v1.3 example template under a user id, such as `module-domain-imports-infrastructure`) is **advisory by default** and marked `tierSource: "untiered-default"`, so only rules the sealed table calls blocking can fail a v1.3 verdict.

## Verdict rule

`verdictRule: "any-blocking-violation"`: the v1.3 verdict is **fail iff at least one blocking rule has at least one applicable violation**; otherwise it is pass. Advisory findings never change it.

The blocking-only AHS is reported (`tiers.blockingAhs`: the v1.2E AVR per dimension and the v1.2E symbolic weights, renormalised over the dimensions the blocking rules ran in), but **no threshold is applied to it**. A blocking rule is a structural fact, and any blocking AHS below 1 already implies a blocking violation, so an "or blocking AHS below the threshold" clause could never change the outcome. It is left out to keep one rule.

The existing verdict structure is kept: in the v1.3 mode the report's `verdict` is `pass` for a v1.3 pass and `hard-block` for a v1.3 fail. The CLI exit codes are unchanged (0 and 1). `tiers.v12eVerdict` keeps the four-level v1.2E reading, and `ahsDeterministic`, `ahsCombined`, `ahsNeuronal`, `perDimensionScores` and every other field are byte-identical to the v1.2E mode. Only `verdict` differs, and `tiers` is added; the unit tests and the golden CLI test pin this.

A blocking rule that failed to execute (FR-13 `failures`) does not count, as in v1.2E. It is listed in `tiers.blockingNotExecuted`. In neuronal-only mode no blocking rule runs, so `blockingAhs` is null and the v1.3 verdict is vacuously pass.

## N/A handling

FF-P06 (`domain-state-purity`) rows are split on their `relType`: the third discriminator (`class, targetName, relType, field`), with the message as a fallback. `FLOWS_TO` rows are not counted and are reported in `tiers.notApplicable` as:

`{ functionId: "FF-P06", part: "FLOWS_TO field rows", reason, naRows, totalRows, flowsToEdges }`

- `naRows` is the number of FLOWS_TO rows, and `totalRows` (its denominator) is all FF-P06 rows.
- `flowsToEdges` is the number of FLOWS_TO edges in the extracted graph (the input the field half depends on), or null when the APG is not available to scoring.
- Only the CONSTRUCTOR_INJECTS rows count toward the FF-P06 violation count, the blocking verdict and the blocking AHS.
- The entry is written whenever FF-P06 ran, including with zero rows ("0 of 0", plus the graph count).

FF-P06 is the only FLOWS_TO-dependent rule in the catalogues; no other template reads FLOWS_TO.

## Not implemented as written, or worth a decision

- **`port-dependency-inversion`**: the table leaves it open ("blocking if a pure edge fact; advisory if ratio-based"). It is decided advisory from its Cypher (above).
- **The DDD rows** of the second table: no DDD templates exist yet. Their tiers are not in the code; the U-C1 library should add them to `RULE_TIERS` (or a DDD per-template table like `HEXAGONAL_RULE_TIERS`) when it registers its catalogue in `V13_EXTENSION_TEMPLATE_CATALOGUES`.
- **The judge rows** "reported, non-blocking" are represented as `tier: advisory` with `judge: true`, because the field is two-valued (`blocking | advisory`).
- **"Advisory rules are weighted out of the AHS or into a separate score"** (FR-V6): the v1.2E AHS is kept unchanged as the comparison reading, and the blocking-only AHS is the separate v1.3 score. No separate advisory score is computed; advisory findings are reported as counts per rule.
- **Not wired**: `firewall batch` and `firewall report` still use the library default (v1.2E). The evaluate pipeline does not pass `v13Templates` to the compiler (FR-V1 left it off), so a spec naming the module-wiring template now validates under v1.3 but is compiled only by `firewall validate`, not by `firewall evaluate`.

## Verification

Environment: worktree `npm ci`; Neo4j `daedalus-neo4j-bt` on bolt 7693, env loaded from `~/.daedalus-bt.env` and never printed; jest with `--maxWorkers=2` (golden lanes `--runInBand`).

| Check | Result |
|---|---|
| `npx tsc --noEmit`; `tsc -p tsconfig.scripts.json` | clean |
| eslint on the new files (`rule-tiers.ts`, `tiered-scoring.ts`, `extension-templates.ts`, the three new test files) | 0 errors; the errors in the changed existing files are on pre-existing lines |
| New suites | `rule-tiers.test.ts` 41, `tiered-scoring.test.ts` 17, `v13-spec-validator.test.ts` 5 (63 tests) |
| Relevant unit suites (`scoring-engine`, `spec-parser`, `mcp-server`, `schemas`, `hexagonal`, `cli`, `pipeline`, the three run-experiment test files, `cassette-project-id`; `NEO4J_URI` unset) | 58 suites, **837 passed**, 0 failed |
| Golden (`jest.golden.config.cjs`, `GOLDEN_REQUIRED=1`) | 7 suites, **81 passed**: the 80 v1.2E tests, plus one new test that runs the v1.3 CLI default end to end and checks that every v1.2E field except `verdict` is equal and the report validates |
| Golden full-mode lane | 1 suite, 7 passed |
| Snapshots | unchanged (no `tests/golden/CHANGES.md` entry needed) |
| `--check-prereg` on all 12 `experiments/*/plan.json` | `pre-registration v25 ok: 85 registered artefacts unchanged` (12 of 12) |

One golden test needed a change: `u3-templates.test.ts` "variant-a: evaluate --format json deep-equals executor.execute()" compares the CLI with the library pipeline (v1.2E). With the CLI default now v1.3 it failed on `verdict` and `tiers`. It now passes `--scoring v1.2e`, and the new v1.3 test sits beside it.

**Machine-load note**: the local heavy-command admission hook blocked tsc, jest and the prereg runs on its fixed swap reading (pressure level 2; swap about 10 GB of 16 GB), while live free memory was 34–45% (`memory_pressure`), above the user's 20% rule. On the coordinator's instruction, each heavy command was then run once with `HEAVY_ADMISSION_BYPASS=1`, one lane at a time, with jest capped at `--maxWorkers=2`.
