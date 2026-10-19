# U10 code summary: loop and validity (BUILD-L)

**2026-10-19, scheduled routine. Zero model calls, no Neo4j, no sealed read.** Plan: `aidlc-docs/construction/v1.4/U10/plan.md`. Branch `v14/build-l-loop-validity`; PR to `main`, not merged.

## What was built

| Step | Build | Main files | Tests |
|---|---|---|---|
| 1 | `layered` loop style; Layered L3 wording (`RULE_PLAIN_BY_STYLE`); candidate static DDD rehearsal spec; rehearsal frames (L2, L3) and `hashes.json` written from the harness code | `scripts/lib/loop/{style,prompts,rungs,main}.ts`, `scripts/v1.4/rehearsal-frames.ts`, `scripts/v1.4/lib/rehearsal-frames.ts`, `fixtures/v1.3-rehearsal-tasks/{hashes.json,specs/,hint-audit/}` | `tests/unit/scripts/loop/layered-and-task-mcp.test.ts`, `frame-rungs.test.ts`, `pilot.test.ts` |
| 2 | Per-task MCP spec (D11c): a `daedalus-mcp` plan may carry static `taskProfiles`; `mcpSpecFor`; per-profile `specSha256` | `scripts/lib/loop/{plan,agents,main}.ts` | same file |
| 3 | Drift mode of the power simulation; θ-band and lower-bound input mode | `scripts/v1.3/lib/level-power-sim.ts`, `scripts/v1.3/level-power-sim.ts`, `results/v1.3-drift-power-sim/`, `Docs/v1.4/drift-power-sim.md` | `tests/unit/scripts/v1.3/level-power-sim-drift.test.ts` |
| 4 | L1 per-snapshot coverage check | `scripts/v1.4/snapshot-coverage.ts`, `scripts/v1.4/lib/{snapshot-coverage,snapshot-store}.ts`, `results/v1.4-snapshot-coverage/` | `tests/unit/scripts/v1.4/snapshot-coverage.test.ts` |
| 5 | Seeded recall on agent snapshots | `scripts/v1.4/seeded-recall-agent.ts`, `scripts/v1.4/lib/seeded-recall-agent.ts`, `results/v1.4-seeded-recall-agent/`, `Docs/DiagnosticRuns/v1.4-seeded-recall-agent-2026-10-19.md` | `tests/unit/scripts/v1.4/seeded-recall-agent.test.ts` |
| 6 | Exploratory plan templates with pin and isolation ON; S1 pause times; S12 archive; D6 telemetry checker | `experiments/exploratory-study/`, `scripts/lib/generators/{retry,types}.ts`, `scripts/lib/loop/{archive,telemetry-check}.ts`, `scripts/v1.4/{loop-archive,loop-telemetry-check}.ts`, `Docs/v1.4/loop-isolation-exploratory.md` | `exploratory-plan`, `archive`, `telemetry-check`, `retry-pause` tests; `isolation.test.ts` |

## Results as they came out

- **Hint audit.** The L2 and L3 frames of all four rehearsal tasks: 0 FAIL at their rung. `frame-ice-rink.txt` is now the harness's own frame, and its bytes did not change. REV-03 read the "no-hint" column of the README (FAIL as expected) as a failed audit.
- **Power reproduction (s2d-01 §3, sims 2000).** 22 of 24 cells are within √2·SE. H2 at 32 blocks, independent cells, is off by +0.027 at RR 0.5 and +0.023 at RR 0.75. A 20,000-sim scratch run puts the converged RR 0.5 value at about 0.81–0.82, not 0.79. RR 0.25, the only claimed figure, reproduces. The level path is byte-identical.
- **Coverage (bar: unmapped ≤ 10 %, no unparsed file).**
  - Floor probe 1: 56/56 pass.
  - Floor probe 2: 17/24 pass; all 7 fails are condition C2, at 11–67 % unmapped.
  - Loop pilot: 24/24 pass.
  - Across all three: 0 unparsed files, 0 barrels, 0 `require`, 0 `import()`.
- **Seeded recall** (final snapshots, cypher-interp, development data, not an SO4 estimate):

  | Style | Detected | Rate [95 % Wilson] |
  |---|---|---|
  | Clean | 48/57 | 0.84 [0.73, 0.91] |
  | Hexagonal | 194/216 | 0.90 |
  | Layered, all operators | 49/69 | 0.71 |
  | Layered, without the 4 direction-mismatched operators (Clean-direction MO-S01, MO-DF01) | 49/49 | 1.00 |

  - Every miss comes from an advisory operator (MO-CV02, MO-SO01) or a direction-mismatched one.
  - DDD is not covered: the pilot's frozen DDD spec fails `loadCompiledSpec` because its aggregates are empty.
- **Rule 3.** The loop dry run on `experiments/loop-demo/plan.dry-run.json` equals `main` in every record except timestamps and commit shas.

## Checks

- `tsc --noEmit`: clean on `tsconfig.json` and `tsconfig.scripts.json`.
- `jest --maxWorkers=2` on `tests/unit/scripts/{loop,generators,v1.4}`, the two power-sim suites and the tunables suite: 466 passed, 3 failed. The 3 failures (`generators/skeleton.test.ts`, `generators/prompt-distinctness.test.ts`) fail the same way on `main` 7949afcc.
- ESLint: clean on the changed library files. The remaining reports fall into two classes that unchanged files share in this environment: `expect` as an unresolved type in tests, and `scripts/v1.4` entry files outside the ESLint TS project.

## Deviations and declared limits

- **AI-DLC gates.** The approval gates had no live reader, because this was an unattended run whose scope the task fixed. The PR is the review point.
- **Network access.** The seeded-recall type-check installed the pinned generator skeleton with `npm ci --ignore-scripts` from its lockfile. That registry fetch was the only network access, and no model was reached.
- **Author to approve:**
  - the candidate DDD rehearsal spec (not the D15 decision);
  - `cliVersion` `2.1.294`, a placeholder;
  - the `/opt/daedalus/...` paths;
  - the Layered L3 wording;
  - two power choices: whether pilot runs are clustered by task in the lower bound, and θ when a pilot comes out all zeros.
- **Needs live runs:**
  - a login under the isolated config dir (S3);
  - auto-update verified off (S2);
  - the S4 probes with MCP attached;
  - a real usage-limit pause;
  - D6 "one call-log line per tool call", which needs the envelope's tool list;
  - S12 on real out-roots.
- **Not built:**
  - a Layered-direction mutation operator;
  - the shared step-1 start in the harness (the templates run every cell from step 1);
  - a Gemini-lane plan;
  - the repair prompt, which keeps `RULE_PLAIN` for Layered.
