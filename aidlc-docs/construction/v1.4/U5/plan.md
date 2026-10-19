# U5 code-generation plan: evasion check (M6) and the Gemini generator adapter (CDX)

**Single source of truth for U5's Code Generation.** Design: `aidlc-docs/construction/v1.4/U5/functional-design/design.md`. Depth: minimal. Map part: C6 control (P4).
**Revised 2026-10-18 after the adversarial design review** (see the design's revision line): Steps 1–9, 11–14, 16–19 and 21–25 were amended. No step has been executed.

**Unit context**
- Workspace: brownfield TypeScript repo. Analysis entries live in `scripts/v1.3/`, their libraries in `scripts/v1.3/lib/`, the harness in `scripts/lib/loop/` and `scripts/lib/generators/`, and the tests in `tests/unit/scripts/...`.
- Depends on: U4's violation identity module (C1e). The design injects it, so this plan builds on the current `findingIdentity` and swaps it in at Step 2 when U4 has landed. The plan also uses the existing `loadOutRoot`, `checkoutCommit`, `scanImports`, `resolveLayer`, `unmatchedShare`, `driveTurn`, `runWithRetries` and the agy labeller helpers. No new npm dependency.
- Constraints:
  - no model or external API call;
  - no Neo4j;
  - `jest --maxWorkers=2`;
  - no edits under `ops/`, `aidlc-docs/audit.md` or `aidlc-docs/aidlc-state.md`;
  - nothing read from `daedalus-sealed/`, `.env` or any credential or config home;
  - no git operations by the build agent beyond what the orchestrator asks;
  - repo-relative paths in every written record.
- Out of scope: running the S4 probe; changing any `study2-protocol` line or the deviation record; the literal-view re-score (s2d-01 §5.4); the acceptance-check content for the new tasks (D12, another lane).

---

## Part A: the evasion check

- [ ] **Step 1. Fixtures.** Create `tests/fixtures/v1.4-evasion/` with a `README.md` stating that the fixtures are synthetic and hand-written. Add one Layered spec, `spec.yaml`, copied verbatim from `presets/layered.yaml` (layers persistence, business, presentation; closed layering), as `tests/fixtures/v1.3-reference/layered/spec.yaml` does. Do not invent a four-layer spec. Add one Hexagonal spec for the `allowedDependencies` derivation. Then add one case directory per planted case, each with `t0/src/**` and `t1/src/**`, the blocking findings of each snapshot (`t0.findings.json`, `t1.findings.json`, in the loop `BlockingFinding` shape) and `expected.json` (the removed identities, expected signals, expected class):
  - `relocated-unmapped`
  - `relocated-unguarded`
  - `wrapped`
  - `inlined`
  - `dynamic-escape`
  - `deleted`
  - `true-fix-dip`, a dependency-inversion fix, expected class `none`
  - `avoided`
  - `cycle`
  - `rename-only`, the violating file renamed and nothing else: no eligible diff (EV-06b)
  - `stub-specifier-target` (the stub's raw-specifier `target`) and `edgeless` (no `target`)
  - `tool-tell`, a comment naming `check_import`, for the EV-06 redaction
  - `outside-context`, a DDD spec with an `outside_contexts` file
  - `observed-pair`, a finding on a placement pair the spec does not guard: listed, never counted (EV-06a)
- [ ] **Step 2. Identity and rename seam.** Create `scripts/v1.3/lib/evasion/identity.ts`. It exports:
  - `type IdentityOf = (f: BlockingFinding) => readonly string[]`;
  - `defaultIdentity`. When `scripts/lib/drift/identity.ts` exists at build time (U4 plan Step 3), this is `(f) => edgeKeys(fromBlockingFinding(f), STUDY2_S2D01)`, with the preset from `scripts/lib/drift/types.ts`. Otherwise it is `(f) => [findingIdentity(f)]` from `scripts/lib/loop/pilot-metrics.ts`;
  - `IDENTITY_NAME: 'u4-edge' | 'pilot-metrics'`;
  - `renameMap(gitDir, a, b)`. This is U4's `renameMapBetween` when present. Otherwise it is a local `spawnSync('git', ['--git-dir=<gitDir>', 'diff', '--name-status', '-M50%', '-l5000', a, b, '--', 'src'])` with an R/C/D/A/M parser (a C row is not a rename), marked for removal when U4 lands. It returns the map and `renameDetection: 'full' | 'skipped'`. It is local git only, with no network.

  Do not edit any U4 file, `pilot-metrics.ts` or `study2-analysis.ts`.
- [ ] **Step 3. Tree import graph.** Create `scripts/v1.3/lib/evasion/import-graph.ts`:
  - `readTree(dir)`: the `src/**/*.ts` files, with test files marked;
  - `readTree(gitDir, commit)`: only `src/` of the commit (`git archive <commit> -- src`, or `ls-tree` and `cat-file`);
  - `buildGraph(tree)`: edges with their kind, from `scanImports`, resolved with the existing `resolveRelative` (both in `scripts/v1.3/lib/snapshot-measures.ts`; reuse, don't re-implement); an unresolved relative specifier is counted;
  - `endpoints(finding, tree)`: `filePath` and `target` normalised to `src/...` tree paths (a raw specifier target resolved from `filePath`), or `unresolved`;
  - `placementOf(spec, file)`: the layer from `resolveLayer`, or the DDD context, or `outside`, or `unmapped`;
  - `specGuardedPairs(spec, blockingFunctions)`: design §2.4. Layered gives closed layering from the layer order. Hexagonal and DDD give the pairs not in `allowedDependencies`, plus cross-context. Clean gives the inward-only pairs. The list is restricted to the functions that are blocking in the tier table (`Docs/v1.4/rule-tiers-post-seal.md` when present, else `Docs/v1.3/rule-tiers.md`);
  - `observedPairsNotInSpec(guarded, identities)`: listed only (EV-06a).

  Pure functions only; the spec is parsed once by the caller.
- [ ] **Step 4. A1 acceptance.** Create `scripts/v1.3/lib/evasion/acceptance-rate.ts`. It exports `stepPasses(record)` (rule A1), `cellAcceptance(runs, fromStep)` and `acceptanceGap(cells, contrast)`. These implement the paired block rule (EV-03, with `blockKey` from `scripts/v1.3/lib/study2-analysis.ts`), the bar of 10 points both one-sided and two-sided (`flag`, `flagTwoSided`; design Q5), and the coverage flag below 0.9.
- [ ] **Step 5. A2 signals.** Create `scripts/v1.3/lib/evasion/moved-only.ts`. It exports:
  - `removedIdentities(prev, cur, identityOf, rename)`: E_{t−1} is mapped through ρ first (EV-06b);
  - `avoidedEligible(...)`;
  - one function per signal (`relocatedUnmapped`, `relocatedUnguarded`, `wrapped`, `inlined` with the declaration-token Jaccard ≥ 0.6, `dynamicEscape`, `deleted`);
  - the cycle rule (signals per member edge gone at t; unknown members only allow `deleted` and none) and the edgeless rule (design §2.2);
  - `classifyDiff(signals)`, which applies the fixed severity order (EV-04) and keeps all fired signals.
- [ ] **Step 6. A3 out-of-scope and the §2.5a extras.** Create `scripts/v1.3/lib/evasion/out-of-scope.ts`. It exports:
  - `outOfScope(tree, graph, spec, guarded)`, which returns `unmappedFiles`, `unmappedShare`, `outOfScopeEdges[]` and `declaredOutsideEdges`;
  - `newOutOfScopeEdges(runSnapshots)` (new by file pair).

  Create `scripts/v1.3/lib/evasion/extras.ts` with three functions:
  - `sizeByStep(steps)`: `loc` and the `sourceFiles` count from the step records, with no parsing;
  - `importKindsByStep(trees)`: `treeMeasures` of `snapshot-measures.ts`, giving the kinds and barrels;
  - `mechanism(steps)`: the share of `daedalus-mcp` steps with `process.calls > 0`, with `logFound === false` counted apart and `noMechanism` set below 0.8.
- [ ] **Step 7. Sample and packet.** Create `scripts/v1.3/lib/evasion/sample.ts`:
  - `drawSample(pool, { perArm, seed })`, seeded with the existing `mulberry32` and `seededSample` of `scripts/v1.3/lib/graph-fidelity.ts` (reuse, don't re-implement). Flagged diffs come first, up to half the sample, then a uniform draw from the rest, with the shortfall reported.
  - `renderPacket(items, diffs)`: `README.md` with the key sha256 and the instruction to hand over `packet/` only; `E-NN.md`; and `form.csv` with the classes `resolved | moved-only | wrapped-or-inlined | feature-dropped`. Test files and the denied strings are stripped. The tool and firewall tokens are redacted in the diff text, with per-item counts in the key only (EV-06).
  - `unblind(labels, key, keySha256)`: refuses on a hash mismatch (EV-07). It computes counts per arm, the heuristic agreement 2×2, and both bars, `evasionHumanRead` (moved-only) and `evasionHumanReadBroad` (plus wrapped/inlined) (design Q4).
- [ ] **Step 8. Analysis core and report.** Create `scripts/v1.3/lib/evasion/analyse.ts`. It exports `analyseEvasion(loaded, opts, io)`, where `io` gives `checkout(runDir, commit) → dir` and `readSpec(path)`, so the tests inject trees. It builds the `study2-evasion/v1` object exactly as in design §2.6, including `size`, `importKinds`, `mechanism` and the `notHere` lines for s2d-01 §5.4 and §5.7, plus `renderEvasionMd(report)`. It processes one run at a time and holds at most two trees in memory. Deterministic: no clock in the json, sorted keys and arrays (EV-10 placeholders for the out-root).
- [ ] **Step 9. Entry CLI.** Create `scripts/v1.3/study2-evasion.ts`:

  ```text
  npx tsx scripts/v1.3/study2-evasion.ts --out-root <loop out-root> --out <dir>
    [--from-step 2] [--sample-per-arm 10] [--seed 20261018] [--labels <form.csv>] [--cells none@L2,none@L3,daedalus-mcp@L2]
    [--h2 none@L2,daedalus-mcp@L2] [--h1 none@L2,none@L3] [--spec <repo-relative spec, used when a step record names none>]
  ```

  It reads each run's `src/` snapshots into an OS temp scratch directory, removed per run and again in a `finally`. Exit codes: 0 done; 1 a snapshot unreadable (recorded); 2 usage. The header comment says it makes no model, network or Neo4j call (EV-09).
- [ ] **Step 10. Evasion unit tests.** Create `tests/unit/scripts/v1.3/evasion/`:
  - `import-graph.test.ts`: resolution and placement, plus the unresolved count;
  - `acceptance-rate.test.ts`: every status, pairing, the bar and coverage;
  - `moved-only.test.ts`: each Step 1 case gives its `expected.json`, `true-fix-dip` gives `none`, and `rename-only` gives no eligible diff;
  - `out-of-scope.test.ts`: plus the spec-derived guarded pairs for the Layered preset and the Hexagonal spec, and `observed-pair` changing no count;
  - `extras.test.ts`: size, import kinds and barrels, and the mechanism share with missing logs;
  - `sample.test.ts`: determinism, enrichment, shortfall, the packet grep (EV-06) including the `tool-tell` redaction, and a refused key mismatch (EV-07);
  - `analyse.test.ts`: byte-identical json on two runs, no absolute path in the output, and steps before `fromStep` ignored (EV-01).

  Run `npx jest tests/unit/scripts/v1.3/evasion --maxWorkers=2`.
- [ ] **Step 11. Evasion dry run, recorded.** Copy `experiments/loop-demo/plan.dry-run.json` and its demo tasks into an OS temp scratch directory. Set arms to `none` and `daedalus-mcp`, set 2 runs, and point the out-root at the scratch directory. Do not add frames: the demo plan has none, and frames need task profiles. Run `npx tsx scripts/loop-harness-cli.ts --plan <scratch plan> --dry-run` (stub generator, stub evaluator, no Neo4j). Then run `study2-evasion.ts` over it with `--h2 none@-,daedalus-mcp@- --spec specs/clean-arch.yaml --out results/v1.4-evasion-dry-run`. Add `results/v1.4-evasion-dry-run/README.md` giving the command lines (paths as placeholders), the statement "stub data, not a measurement", and what each section showed. The stub never removes a finding outside the gate arm, so expect avoided diffs only. Also run the CLI over an out-root assembled from the Step 1 fixtures, with hand-built step records that carry `acceptance` records so the sample pool is non-empty (a small fixture out-root builder in the test helpers), and record both runs.
- [ ] **Step 12. Evasion doc.** Create `Docs/v1.4/evasion-check.md` (the v1.4 docs folder, as U2 uses; not a `Docs/v1.3/study2-*` name, a family that carries the enforced protocol line). It gives the pre-registrable text of A1–A3 and the §2.5a coverage table, the sample and blind-read procedure, the bars and margins (10 points, with both readings; 0 moved-only in mcp, with both class sets; 1 edge per snapshot, marked as a design proposal), the class order, the limits (R6–R10, R13–R15), the open author questions Q2–Q5, and the commands. It links s2d-01 §5 and REV-03 finding 5. It is marked as a candidate for the pre-registration, not as registered.

## Part B: the Gemini generator adapter

- [ ] **Step 13. Generator fixtures.** Create `tests/fixtures/agy-gen-cli/` with a `README.md` saying the fixtures are synthetic, modelled on `tests/fixtures/agy-cli/` event shapes, and not probe output. The fixtures are:
  - stream-json files: `stream-gen-completed.ndjson` (write steps, then finish), `stream-gen-model-mismatch.ndjson`, `stream-gen-print-timeout.ndjson` (exit 0, SUCCESS, empty answer, with the stderr line in a sibling `.stderr.txt`), `stream-gen-denied-tool.ndjson`, `stream-gen-tool-escape.ndjson` (a completed `read_url`) and `stream-gen-usage-limit.ndjson`;
  - home settings: `gen-settings-none.json` and `gen-settings-mcp.json`;
  - `s4-result.synthetic.json`, with `"synthetic": true` and verdict `pass`.
- [ ] **Step 14. S4 probe spec.** Create `Docs/v1.4/gemini-s4-probe-spec.md` from design §4: probes G0–G12, pass rules, 24 model calls with a cap of 30, the result file path, the fail rule, the prerequisites and the author's OK. Status: **spec only, not run**. Add a stub `scripts/generator/probes/agy-gen-confinement.ts` only if the author asks; by default the probe code is a later unit (design §4).
- [ ] **Step 15. Adapter id.** Edit `scripts/lib/generators/types.ts`: add `AGY_GEN_CLI_ADAPTER_ID = 'agy-cli' as const` and widen `GeneratorAdapterId`. Leave `GENERATOR_ADAPTER_IDS` unchanged, so the E1 schedule and the registered plan stay byte-identical; `registered-plan.test.ts` stays green.
- [ ] **Step 16. CLI module.** Create `scripts/lib/generators/agy-gen-cli.ts`, reusing `AGY_ENV_ALLOW`, `AGY_ENV_SET`, `AGY_HOME_FORBIDDEN_NAMES`, `AGY_ANCESTOR_FORBIDDEN`, `AGY_CLASSIFIER`, `readAgyStream`, `executedTools`, `deniedToolCount`, `parseAgyVersion` and `findAgyAncestorContext` from `src/llm-critic/agy-cli-provider.ts` (import, don't copy). **Do not reuse `classifyAgyResult`, `checkAgySettings` or `checkAgyHome`.** They are the labeller's contract: any completed tool is an isolation stop, writes, commands and MCP are denied, and the allow list and MCP config are empty. A generator fails all of these by design (design §3.4). Do not edit `src/llm-critic/`. The module contains:
  - `AgyGenCliConfig` and `createAgyGenCliConfig` (absolute homes outside the repo, the out-root and every cwd; the version is `x.y.z`);
  - `buildAgyGenArgs` (design §3.4; the prompt is not in argv);
  - `buildAgyGenChildEnv` (it strips `*_KEY` and `*_TOKEN`);
  - `checkAgyGenSettings(text, arm, expectedAllow)` and `checkAgyGenHome(home, arm, expectedAllow)`: names and settings keys only. The `none` home has no MCP entry; the mcp home has only `daedalus-arch`. The allow list equals exactly `expectedAllow` for this run and arm. The home's name-listing sha256 is returned for `env-<turnId>.json`;
  - `checkAncestors(cwd)`, through `findAgyAncestorContext`;
  - `writeAgyTurnFiles(home, arm, runId, harnessRoot, input?, cwd, callLogPath?)`. It writes the run's type-check allow rule (`typecheckCommand(harnessRoot, runId)`) and, for `daedalus-mcp`, the MCP entry. The MCP file is the constant `.gemini/config/mcp_config.json` (the labeller's checked path), marked `UNVERIFIED (S4 G0, G9)`. No credential file is read or written.
- [ ] **Step 17. Events and disposition.** Create `scripts/lib/generators/agy-gen-events.ts` with:
  - `parseAgyGenRun(stdout, secrets) → DomainResult<ParsedEnvelope>` (the mapping of design §3.5, scrubbed);
  - `agyGenAttemptDisposition(cli, envelope, changed)` (the table in design §3.5; the print timeout comes from the stderr pattern, because agy exits 0);
  - `agyGenTurnStatus(cli, exhausted, envelope, modelId)` for the `status` hook;
  - `agyGenStop(cli, stream, arm)`, which returns `LOOP_GEMINI_AUTH` or `LOOP_GEMINI_TOOL_ESCAPE` (a completed step outside the arm's allow list), or null.
- [ ] **Step 18. Plan block.** Create `scripts/lib/generators/agy-gen-plan.ts`: `GeminiPlanBlock`, `geminiBlockProblems(block, present)` (`enabled === true`, the version, `printTimeoutS` from 60 to 1170 with default 1170 so that `timeoutMs = (printTimeoutS + 30) × 1000` equals `DEFAULT_GENERATOR_TIMEOUT_MS`, `homes`, `s4Result` repo-relative), `agyGenConfigFromPlan(plan, modelId, repoRoot, homes)`, and `checkS4Result(repoRoot, block, modelId, arms)`. The last returns `LOOP_GEMINI_S4_MISSING`, `LOOP_GEMINI_S4_FAILED`, `LOOP_GEMINI_S4_MISMATCH` or `LOOP_GEMINI_S4_SYNTHETIC` (synthetic is refused unless the caller passes `allowSynthetic`, which only the dry-run entry does).
- [ ] **Step 19. Step agent.** Edit `scripts/lib/loop/agents.ts`.
  - Add an optional `status?: (cli, exhausted, envelope, modelId) => TurnStatus` to `CallPlan`. `driveTurn` uses it when set and `turnStatus` otherwise. Claude and Codex pass none, so their records are byte-identical.
  - Add `GeminiStepAgent implements StepAgent`, with:
    - the adapter id `agy-cli`;
    - `probe()`: the version pin and the home check, no model call;
    - `plan(input)`: argv and prompt, through `armPrompt` and `generatorArmFor`;
    - `runTurn(input)`: the tsconfig, the ancestor check and `writeAgyTurnFiles`, then `driveTurn`. Its call plan has `stdin` = the prompt, `parse` = `parseAgyGenRun` (which also keeps the last stream for `agyGenStop`), `disposition` = `agyGenAttemptDisposition`, `status` = `agyGenTurnStatus`, `before` = the home check and `envRecord` = the env names plus the home listing hash. After `driveTurn`, if `agyGenStop` fired, `runTurn` returns `DomainResult.fail` with that code, which stops the grid.
  - Update the file header to list the Gemini route as **not yet through S4**.
- [ ] **Step 20. Plan validation.** Edit `scripts/lib/loop/plan.ts`: add `LOOP_ADAPTER_IDS`, use it in the adapters check, and update the error text. Add `gemini?: GeminiPlanBlock` to the plan type. In `pinProblems`, an `agy-cli` `cliVersion` must equal `gemini.cliVersion`. Call `geminiBlockProblems(raw.gemini, present)`.
- [ ] **Step 21. Live wiring, off by default.** Edit `scripts/lib/loop/main.ts`:
  - parse `--gemini-home-none` and `--gemini-home-mcp` (filling `"<local>"`) and add them to `LOOP_USAGE`;
  - in the live wiring, add a **pre-pass** before the adapter loop and before `ensureHarness`: it runs `checkS4Result` for every `agy-cli` adapter, so nothing is spawned (no `claude --version`, no skeleton install) when the guard refuses;
  - add the `agy-cli` branch: `agyGenConfigFromPlan`, then `GeminiStepAgent.probe()`, failing closed on each;
  - make the Claude branch explicit (`adapterId === CLAUDE_CODE_ADAPTER_ID`) and fail any other id with `LOOP_ADAPTER_UNKNOWN`. Today every non-Codex id falls through to `ClaudeStepAgent`;
  - dry-run wiring is unchanged (stub agents for every adapter id, `agy-cli` included).
- [ ] **Step 22. Adapter unit tests.**
  - `tests/unit/scripts/generators/agy-gen.test.ts`: argv, env, home check (including an extra allow entry and another run's type-check command failing), ancestors, the turn-file writer, event parsing over the Step 13 fixtures, the disposition table, and a test that `classifyAgyResult` is not imported;
  - `tests/unit/scripts/loop/agents-gemini.test.ts`: `GeminiStepAgent` with a scripted `ProcessRunner`. Per arm it covers:
    - statuses, including the exit-0 print timeout giving `timeout` through the `status` hook;
    - argv redaction;
    - the MCP config per turn with `--project` and `--call-log`;
    - the usage-limit pause and resume through `runWithRetries`, with a fake clock and sleeper;
    - model mismatch;
    - the auth and tool-escape stops returning `DomainResult.fail`;
  - `tests/unit/scripts/loop/plan-gemini.test.ts`:
    - block validation;
    - the regression that every committed loop plan still validates to the same plan and schedule (`experiments/loop-demo/plan.dry-run.json`, `experiments/loop-pilot/plan.json`, `experiments/v1.3-floor-probe-3/plan.json`, `experiments/grid-scale/plan.json`; there are no `loop-plan*.json` fixtures under `tests/fixtures/`), and that the adapters error text is unchanged for them;
    - the S4 guard refusing with **zero** runner spawns, also with a `claude-code-cli` adapter listed first;
    - `LOOP_ADAPTER_UNKNOWN`;
    - the two stop codes ending the grid.

  Run `npx jest tests/unit/scripts/generators tests/unit/scripts/loop --maxWorkers=2`. The existing `agents.test.ts` and `codex.test.ts` must pass unchanged.
- [ ] **Step 23. Recorded adapter dry run.** Create `scripts/v1.3/gemini-adapter-dry-run.ts`, which calls `runLoopGrid` with a wiring of the real `GeminiStepAgent`. Its scripted `ProcessRunner` answers `--version`, emits the `stream-gen-completed` events, and writes the stub generator files through `layoutStubScript` (Layered layout). It writes the Clean layout through `layoutStubScript` (`CLEAN_STUB_LAYOUT`): the loop harness has no Layered style, and adding one is outside this unit (design R14). It uses the stub evaluator and typechecker, 2 demo tasks × {`none`, `daedalus-mcp`} × 1 run × k = 3, and the `s4-result.synthetic.json` fixture with `allowSynthetic`. The out-root, harness root, work directories and both homes sit in one OS temp scratch directory, so the ancestor check sees no `.git`. Only the scrubbed summary is copied into `results/`. Output: `results/v1.4-gemini-adapter-dry-run/summary.json` (turns and statuses per run, the redacted argv per arm, env names only, the model check, the MCP config with `<cwd>`, `<H>` and `<spec>` placeholders) and `README.md` ("scripted runner, no model call, not a measurement"). A test in `agents-gemini.test.ts` runs the same function into a temp dir and asserts there is no absolute path and no env value in the summary.
- [ ] **Step 24. Adapter doc.** Create `Docs/v1.4/gemini-generator.md`. It covers:
  - the route and why (design §3.1);
  - the plan block, which is off by default;
  - the confinement design, with every **UNVERIFIED** item tied to its S4 probe id;
  - the turn mapping;
  - the dry-run command and result;
  - the statement that the protocol line still names `codex-pin` and the substitution belongs to the dated deviation.

## Part C: close-out

- [ ] **Step 25. Whole-unit checks.**
  - `npx tsc --noEmit -p tsconfig.json`, or the repo's typecheck script;
  - `npx jest tests/unit/scripts/v1.3/evasion tests/unit/scripts/generators tests/unit/scripts/loop --maxWorkers=2`;
  - `node scripts/v1.3/protocol-consistency-check.mjs`, which must still pass unchanged (no protocol line was touched);
  - a grep for absolute personal paths in `results/v1.4-*`, `Docs/v1.4/evasion-check.md`, `Docs/v1.4/gemini-*.md` and the new fixtures, which must come back empty.

  List any test that needs Neo4j as skipped, with its name (none expected).
- [ ] **Step 26. Code summary.** Create `aidlc-docs/construction/v1.4/U5/code/summary.md` (markdown only). It gives the files created and edited, the test counts, the dry-run result paths, the open S4 prerequisites and the author questions still open. Mark this plan's checkboxes as the steps complete.

---

**Traceability**

| Requirement | Steps |
|---|---|
| M6 acceptance pass rate per arm (s2d-01 §5.1) | 4, 10 |
| M6 moved-only heuristic and the 10-diff blind sample (s2d-01 §5.5, REV-03 finding 5) | 5, 7, 10, 11 |
| M6 findings outside any rule's scope (s2d-01 §5.3, D13) | 6, 10 |
| s2d-01 §5.2 size, §5.3 import kinds and barrels, §5.6 mechanism | 6, 8, 10 |
| s2d-01 §5.4 literal view, §5.7 concentration | not in U5 (recorded in `notHere`; U4 or the Study 2 analysis) |
| CDX adapter, configurable and off by default | 15–21 |
| CDX mocks and a recorded dry run | 13, 22, 23 |
| CDX S4 probe as a spec with its call count, not run | 14 |
| C6 "both work on a dry run" (`ops/03-build-list.md`) | 11, 23 |

**Estimated scope:**
- about 10 new library and entry files and 4 edited harness files (`types.ts`, `agents.ts`, `plan.ts`, `main.ts`);
- about 10 test files;
- 3 docs;
- 2 recorded dry runs.

No model call at any step.
