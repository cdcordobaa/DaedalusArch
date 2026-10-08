# U5a Code Summary — Mutation, Manifest and Generator

> **Cycle**: v1.2 Evaluation-Readiness (lane 3) · **Unit**: U5a (C15.1 mutation operators and registry, C15.2 manifest validator, C15.5 generator adapter and grid) · **Date**: 2026-10-08
> **Branch**: `v1.2e-u5a-mutation-manifest-generator` (worktree `DaedalusArch-wt-u5a`), created from `origin/v1.2e` after the U2 merge, rebased onto U1 (Step 24), synced with `origin/v1.2e` after the U3 merge (DV-U5a-25).
> **Plan**: `aidlc-docs/construction/plans/v1.2E-u5a-mutation-manifest-generator-code-generation-plan.md` (Part 2 record: ticks and Done notes per step). **Design**: `functional-design/` R2 (BR-U5a-01..56).
> **Golden snapshots**: none changed (BR-U5a-54, NFR-01). No `tests/golden/CHANGES.md` line.

## 1. Requirements delivered

| ID | Delivered in U5a | Left for Build and Test |
|---|---|---|
| FR-v1.2E-24 (+ amendment) | Frozen manifest schema; `scripts/mutate.ts`; 11 operators + 11 twins; 25 SP-* probes; seeded RNG; one-step edit and row; pinned type-check gate; draft catalogue; FR-24 acceptance (22 forced entries into one manifest) | Freeze gates (a)–(c) on prepared corpus bases, `sitesPerOperator`, catalogue and SP freeze |
| FR-v1.2E-28 | `scripts/generate-projects.ts`, Claude Code headless adapter, grid schedule, outcomes, retries, prompt templates, draft protocol | Live confinement and model-usage probes, pilot, template freeze, FR-28 acceptance cell |
| SECURITY-10 | No new repo dependency; pinned tsc per base; skeleton with its own lock, offline install, scripts disabled | Install hash of record at the freeze |
| SECURITY-11 (ADR-017 item 8) | Exact argv, harness-owned tsconfig and tsc launcher, env allow-list, confinement probe runner | Live probe run |
| NFR-v1.2E-01 | No snapshot change at any gate | — |
| NFR-v1.2E-08 | Scrubbed envelopes, prompts, rejection details | — |

## 2. Files

### 2.1 Created (U5a-owned)
- **CLI entries** (D-U5a-13 (a): no exports, `void main(process.argv.slice(2), process.cwd()).then(…)`): `scripts/mutate.ts`, `scripts/u5a-freeze-gate.ts`, `scripts/u5a-parity-check.ts`, `scripts/generate-projects.ts`, `scripts/generator/check-harness-tsconfig.ts`, `scripts/generator/probes/confinement-cli.ts`.
- **Main modules**: `scripts/lib/mutation/mutate-main.ts`, `scripts/lib/freeze-gate-main.ts`, `scripts/lib/parity-check-main.ts`, `scripts/lib/generators/generate-main.ts`.
- **Mutation engine** `scripts/lib/mutation/`: `types.ts`, `rng.ts`, `registry.ts`, `catalogue-parser.ts`, `prepare.ts`, `stubs.ts`, `typecheck.ts`, `tree-sha.ts`, `import-graph.ts`, `cycles.ts`, `metrics.ts`, `collateral.ts`, `expected.ts`, `sites.ts`, `apply.ts`, `freeze-gates.ts`, `mutate-main.ts`; operators `operators/{mo-s01,mo-p01,mo-c04,mo-so01,mo-cv02,mo-df01,mo-x01,mo-x02,mo-so02,mo-x03,mo-s03,judge-common,index}.ts`; SP probes `operators/sp/{common,structural,pattern,coupling,solid-convention,index}.ts`.
- **Manifest and parity**: `scripts/lib/manifest.ts`, `scripts/lib/import-graph-parity.ts`.
- **Generator** `scripts/lib/generators/`: `types.ts`, `config.ts`, `argv.ts`, `env.ts`, `harness-tsconfig.ts`, `skeleton.ts`, `envelope.ts`, `model-usage.ts`, `outcome.ts`, `retry.ts`, `schedule.ts`, `grid.ts`, `prompt.ts`, `generate-main.ts`; `scripts/generator/skeleton/{package.json,package-lock.json}`; `scripts/generator/prompts/{none,minimal-prose,full-aac}.md`; `scripts/generator/probes/confinement.ts`.
- **Config**: `tsconfig.scripts.json` (D-U5a-5).
- **Tests**: `tests/unit/scripts/architecture.test.ts`; `tests/unit/scripts/manifest/manifest.test.ts`; 21 suites and 4 helpers under `tests/unit/scripts/mutation/` (incl. `u3-discriminators.test.ts`, BR-U3-66); 10 suites and 1 helper under `tests/unit/scripts/generators/`.
- **Fixtures**: `tests/fixtures/u5a/layered/firewall.spec.yaml`; `tests/fixtures/u5a/no-domain/**` (spec, tsconfig, two sources).
- **Docs (DRAFT, D-U5a-10)**: `Docs/operator-catalogue.md`, `Docs/generator-protocol.md`.
- This summary.

### 2.2 Modified
- `schemas/manifest.schema.json` (frozen, `$comment` `FROZEN (U5a). …`).
- `tests/unit/schemas/schemas.test.ts` (manifest `$comment` line and the manifest `describe` block; the old file-level `const manifest` sample removed, DV-U5a-4; report side taken from `origin/v1.2e` verbatim at the U3 sync, D-U5a-6).

### 2.3 Not touched (Gate S, allow-list in Step 36)
`src/**`, `fixtures/**`, `specs/**`, `presets/**`, `tests/golden/**`, `package.json`, `package-lock.json`, `.github/**`, jest/eslint/tsconfig files other than `tsconfig.scripts.json`, `schemas/report.schema.json`, U1 and U5b scripts.

## 3. Exported interfaces (frozen at U5a exit)

| Module | Exports |
|---|---|
| `scripts/lib/mutation/types.ts` (the path U5b imports) | `PreparedBase`, `JudgeSelection`, `MutationSite`, `SiteKind`, `LocationRule`, `MutationOperator`, `MutationEdit`, `LineShift`, `ExpectedKey`, `SiteCollateral`, `ExpectedBlock`, `ApplyOptions` (required `cycleStrategy`), `PreconditionReason`, `DISCRIMINATOR_COLUMNS`, `CYCLE_STRATEGIES` |
| `scripts/lib/manifest.ts` | `Manifest`, `ManifestRow`, `ManifestRejection`, `validateManifest`, `loadManifest`, `appendManifestRow`, `appendRejection`, `acquireManifestLock`, `countGoldenInstances` |
| `scripts/lib/mutation/import-graph.ts` | `ImportGraph` (type re-export), `buildImportGraph`, `IMPORT_GRAPH_EXCLUDE_PATTERNS`, `newSimpleCycles`, `metricViolations` |
| `scripts/lib/import-graph-parity.ts` | `compareImportGraphs` (D-U5a-15) |
| `scripts/lib/generators/types.ts` | `GenerationOutcome` (`requestedModelId`, `promptTemplateSha256`, `promptSha256`), `GenerationRequest`, `GenerationCell`, `GridPlan`, `SpecLevel`, `GENERATOR_ENV_ALLOW` |
| `scripts/lib/mutation/apply.ts` | `applyMutation` |
| `scripts/lib/mutation/freeze-gates.ts` | `measureBaseTypecheck`, `siteFeasibility`, `chooseSitesPerOperator`, `compareDeclaredKeys` |
| `scripts/lib/mutation/operators/index.ts`, `operators/sp/index.ts` | `CATALOGUE_OPERATORS`, `buildCatalogueRegistry`, `MASTER_SEED`; `SP_PROBES`, `loadProbeRegistry`, `spHashOf` |
| `schemas/manifest.schema.json` | Frozen manifest schema (header `schemaVersion`, `catalogueVersion`, `masterSeed`, `cycleStrategy`, `rows`, `rejections`) |

## 4. Pinned values
- **RNG (D-U5a-12)**: `mulberry32(1)` first outputs `0.6270739405881613`, `0.002735721180215478`, `0.5274470399599522`; `deriveSeed(20261008, correct-reference, MO-S01, 0)` = `2184350454`; label `'select'` = `757368179` (cross-checked by an independent `node -e`).
- **Master seed**: `20261008` (`MASTER_SEED`, catalogue draft).
- **Cycle bounds** (from U1): `MAX_CYCLE_LENGTH` 10, `CYCLE_ROW_CAP` 100. Manifest default `cycleStrategy: simple-cycles`.
- **Skeleton**: `express` 5.2.1, `@types/express` 5.0.6, `@types/node` 22.19.15, `typescript` 5.9.3; lock sha256 prefix `cc7900c79c6c` (full value in `Docs/generator-protocol.md`).
- **Toolchain**: Node v24.5.0, TypeScript 5.9.3.

## 5. Commits per step

| Step | Commit | Label |
|---|---|---|
| 0 | `a69c9eb` docs: plan and R2 design on v1.2e | — |
| 1 | `aa6322a` chore: worktree and unit branch | — |
| 2 | `35d6ec8` chore: lane Neo4j 7691 | — |
| 3 | `853e231` chore: baselines and Gate G-CI | — |
| 4 | `277a80f` build: `tsconfig.scripts.json`, architecture tests | U5a-M2 |
| 5 | `baa0fac` feat: frozen manifest schema | U5a-M1 |
| 6 | `32b5448` feat: seeded RNG | U5a-M2 |
| 7 | `1c5f9e2` feat: manifest module | U5a-M2 |
| 8 | `1c49ebd` feat: registry and catalogue parser | U5a-M2 |
| 9 | `5e8e629` feat: base copy and preparation | U5a-M3 |
| 10 | `bff4b53` feat: pinned type-check gate | U5a-M3 |
| 11 | `62b784d` feat: stub provisioning | U5a-M3 |
| 12 | `d81cc89` feat: `baseTreeSha` | U5a-M3 |
| 13 | `dd1541a` feat: import graph with extractor parity | U5a-M4 |
| 14 | `b0f2673` feat: new-cycle enumeration in U3 key form | U5a-M4 |
| 15 | `3e925aa` feat: metric-crossing and test-pairing collateral | U5a-M4 |
| 16 | `6960335` feat: generator config and argv | U5a-M6 |
| 17 | `6e6bf67` feat: env allow-list and harness tsconfig | U5a-M6 |
| 18 | `f0e914d` feat: skeleton and integrity check | U5a-M6 |
| 19 | `820e16c` feat: envelope reader and model-usage rule | U5a-M6 |
| 20 | `9b6121f` feat: outcomes and status decision | U5a-M7 |
| 21 | `6734549` feat: retries and usage-limit pause | U5a-M7 |
| 22 | `268ba1a` feat: grid, CLI adapter, confinement probe runner | U5a-M7 |
| 23 | `90d36a0` feat: prompt templates and protocol draft | U5a-M7 |
| 24 | `152f016` docs: rebase onto U1, baselines re-recorded | — |
| 25 | `0339260` feat: expected resolution | U5a-M4 |
| 26 | `be126f3` feat: mutation pipeline | U5a-M4 |
| 27 | `32a9f9e` feat: structural, pattern, coupling operators | U5a-M4 |
| 28 | `6a69deb` feat: SOLID and convention operators | U5a-M4 |
| 29 | `6b9aa4a` feat: data-flow operator | U5a-M4 |
| 30 | `b0eb2b2` feat: judge construction probes | U5a-M4 |
| 31 | `258243a` feat: registered catalogue and draft | U5a-M4 |
| 32 | `589de9c` feat: mutate CLI and FR-24 acceptance | U5a-M5 |
| 33 | `72d05f5` feat: SP probe set | U5a-M5 |
| 34 | `315274a` feat: freeze-gate tooling | U5a-M5 |
| 34 fixes | `a6667af` freeze gate through `bin/firewall.ts`; `45fcf8a` split/role tie (DV-U5a-24); `47aedd1` DV-U5a-22 decision item | U5a-M5 |
| sync | `0748b83` merge of `origin/v1.2e` (U3); `ed32c02` U3 alignment (DV-U5a-25) | — |
| 35 | this summary | — |

## 6. Baselines and gates

| Point | `npm test` | Gate L | Gate B | Gate G | Golden base |
|---|---|---|---|---|---|
| Step 3 (base `c553a04`) | 1277 / 94 | 575 | 85 | 38 / 4, 0 skipped | `53c8f7e4` |
| Step 24 (rebased on `e35ef8a`) | 1556 / 115 (base 1280) | 581 | 85 | 38 / 4 | `53c8f7e4` |
| Group 9 review head `47aedd1` | 1721 / 126 | 581 | 85 | 38 / 4 | `53c8f7e4` |
| U3 sync head `ed32c02` (base `origin/v1.2e` `3c4f435`: 1712 / 119, L 558, B 85) | **2155 / 152** (1712 + 443 U5a) | **558** (= v1.2e) | **85** | **74 / 6**, 0 skipped | `39d423b6` (U3-R9) |

U5a adds 443 tests in 33 suites. Gate T (`typecheck`, `typecheck:u0-tests`, `tsc -p tsconfig.scripts.json`) is clean at every step. Gate S is empty and the snapshot hashes equal the golden base at every gate. No U5a file carries a lint error (`scripts/**` under D-U5a-8).

## 7. Deviations (DV-U5a-1..25)

| Id | Step | Summary |
|---|---|---|
| DV-U5a-1 | 1 | U2 merge found from `--merges` (the merge message names the PR, not the branch) |
| DV-U5a-2, 3 | 2 | Lane container pre-existing with a supplied password; HTTP also on loopback 7478 |
| DV-U5a-4 | 5 | Old `const manifest` sample removed with the manifest block it served |
| DV-U5a-5 | 7 | `ProjectHandle`, `PreconditionContext` shapes defined; helper exports added |
| DV-U5a-6 | 9 | `prepareFixtureBase` takes `runner` and `repoRoot`; overlay hash = overlaid file content (OI-U5a-17) |
| DV-U5a-7 | 13 | `ImportGraphEdge` gains `isTypeOnly`, `line` |
| DV-U5a-8 | 14 | SCC key line = representative cycle's first-edge line |
| DV-U5a-9 | 16 | Model-id detector exempts the adapter id `claude-code-cli` |
| DV-U5a-10 | 22 | `runGenerationGrid` returns `DomainResult`; adapter in `grid.ts` |
| DV-U5a-11 | 23 | One template per task inside each level file; `promptTemplateId` = `<level>/<task>` |
| DV-U5a-12 | 24 | Nothing excluded from `tsconfig.scripts.json` (no top-level `await` in U1 CLIs) |
| DV-U5a-13 | 25 | `DiscriminatorColumn` gains `targetName`, `implementation`, `useCase`, `scc`; `MutationEdit.keyAnchor` |
| DV-U5a-14 | 26 | `MutationEnv` carries the run inputs the design leaves implicit |
| DV-U5a-15 | 27 | Layered fixture spec carries the full `presets/layered.yaml` function block |
| DV-U5a-16 | 28 | SOLID sites carry `limit`/`classLimit` in `detail` |
| DV-U5a-17 | 29 | `field-assignment` site kind not enumerated; `new` carries the FR-21 evidence |
| DV-U5a-18 | 32 | Additive `--split` CLI option |
| DV-U5a-19 | 33 | SP-FF-S02 / SP-FF-C06 declared keys are collateral carriers |
| DV-U5a-20 | 33 | `typesAddedOrRemoved` wired into site collateral |
| DV-U5a-21 | 33 | SP-DF01-ci is the constructor-injection probe of U3 BR-U3-22 |
| DV-U5a-22 | 34 | BR-U5a-37 120 cap applied to the chosen k — **author decision item** (§8) |
| DV-U5a-23 | 34 | `u5a-parity-check --spec` optional |
| DV-U5a-24 | 34 fix | Split tied to operator role (`MUT_SPLIT_ROLE`) |
| DV-U5a-25 | sync | `origin/v1.2e` (U3 merge, PR #5) merged into the unit branch before the exit checks, instead of a second rebase, so the step commits recorded in the plan keep their SHAs; `schemas.test.ts` resolved per D-U5a-6. U5a-owned follow-ups: MO-DF01 key table and data-flow test carry the FF-P06 key (`[Task, InMemoryTaskRepository, FLOWS_TO, repo]`, field line 5); SP target set 24 + FF-S03, SP-DF01-ci resolves (line-less `CONSTRUCTOR_INJECTS` key); absent-template cases read the no-domain spec; `full-aac` templates re-embed the updated preset and the protocol hash table is updated; catalogue §5 intro and changelog; BR-U3-66 test added (U3 handoff H4) |

## 8. Author decision items (freeze review)

| Item | Status |
|---|---|
| **DV-U5a-22** (BR-U5a-37): `chooseSitesPerOperator` applies the 120 cap with a seeded subsample (`k = 'subsample'`) also to a chosen k = 2 total. The pre-registered "if k = 3 exceeds 120" branch is unreachable because `Σ min(3, e) ≤ 1.5 · Σ min(2, e)`, so a k = 3 total above 120 implies a k = 2 total of at least 80. | **Open, pending author confirmation.** Not settled. On the Build and Test freeze-review checklist; the cap on a k = 2 total is not part of the pre-registered text until the author confirms |

## 9. Build and Test obligations
1. **Live confinement probes** (BR-U5a-43): `scripts/generator/probes/confinement-cli.ts`, five probes, all must pass before any grid run.
2. **Model-usage probes** (BR-U5a-47): one envelope per pinned model id, strict-dominance rule; envelopes recorded in `Docs/generator-protocol.md`.
3. **Pilot and template freeze** (BR-U5a-52): pilot under `<outRoot>/pilot`, then freeze templates and protocol (final hashes, install hash of record, dates).
4. **FR-28 acceptance cell**.
5. **Dev-split declaration gate** (BR-U5a-36 a): U3 is now on `v1.2e`, so `scripts/u5a-freeze-gate.ts` runs after the U5a merge (lane smoke at Step 34 passed on a U3-merged tree).
6. **Import-graph parity on corpus bases** (BR-U5a-56, D-U5a-15): `scripts/u5a-parity-check.ts` on **every prepared corpus base before any seeding**; exit 0 required; a difference is fixed in the builder and the parity test is extended with that shape.
7. **Base measurement and site feasibility** (BR-U5a-36 b, c) on prepared corpus bases after the ADR-017 item 4 remap; then `sitesPerOperator` (BR-U5a-37, with DV-U5a-22 decided), catalogue and SP freeze (BR-U5a-38..40).
8. **Cycle strategy** (D-U5a-14): U3 merged with `CYCLE_STRATEGY = 'cypher'` (`src/evaluation-engine/scc-cycles.ts`), which corresponds to U5a's `simple-cycles` default; aligned. If Build and Test flips U3 to `scc`, every manifest is regenerated with `--cycle-strategy scc`.
9. **SP probe run** (OI-U5a-18): every probe through U5b `run-experiment`; pass/fail recorded; ADR-016 b exclusions only after a failed frozen probe and a recorded fix attempt (FF-CV01 and FF-CV06 are expected to fail).
10. **Pre-registration**: `corpus/prereg.json` registration (U5b).

## 10. Conventions U5b inherits
- **Entry-file form** (D-U5a-13 a): an entry has no exports and only `void main(process.argv.slice(2), process.cwd()).then(…)`; no top-level `await`, `import.meta`, `__dirname`, `__filename` or `require(`; `main(argv, repoRoot)` lives in a pure module; tests import only pure modules.
- **`repoRoot` argument**: every repo file is resolved with `path.resolve(repoRoot, <relative path>)`; an entry exits 2 with `run from the repository root` when `schemas/manifest.schema.json` is absent.
- **No separate jest project** (D-U5a-13 c): `tests/unit/scripts/**` runs under `jest.config.cjs` in `npm test`.
- **`tsconfig.scripts.json`**: CommonJS check of `scripts/**`; a `-cli.ts` using top-level `await` is listed in `exclude` (none today, DV-U5a-12).
- **Manifest header `cycleStrategy` is required** (D-U5a-14); hand-computed manifests carry it.
- **Lint for `scripts/**`**: `npx eslint --parser-options project:./tsconfig.scripts.json <files>` (D-U5a-8).

## 11. Open items

| Id | Status |
|---|---|
| OI-U5a-1 | Artefact path kept (`v1.2E-u5a-mutation-manifest-generator/`). **Closed in U5a**; clarifications heading correction: orchestrator |
| OI-U5a-2 | C5 import (`compileFunctions(compilerInputFromSpec(…))`) used as designed. **Closed** |
| OI-U5a-3 | Seeded list not filled from manifests (U4P Q6). **Closed in code**; clarifications record: orchestrator |
| OI-U5a-4 | Stale MO-X02/MO-X03 naming in U4/U5b designs. **Open, owner: lane-3 record owner** |
| OI-U5a-5 | `CorpusEntry` tsc shape; U5a consumes `PreparedBase` with resolved `tscPath`/`tscVersion`. **Open hand-off to U5b** |
| OI-U5a-6 | Seed encoding and the `'select'`/`'subsample'` labels implemented and pinned. **Closed in code**; clarifications record before the freeze |
| OI-U5a-7 | MO-X02 removes guard calls too (BR-U5a-28). **Closed** |
| OI-U5a-8 | Twin gate = zero undeclared new keys (`compareDeclaredKeys`). **Closed** |
| OI-U5a-9 | **Closed at Step 24** (DV-U5a-12) |
| OI-U5a-10 | Shortfall after k = 3 stays an author decision (`CAT_SHORTFALL`). **Open, Build and Test** |
| OI-U5a-11 | SECURITY-11 compliance row update (ADR-017 item 8). **Open, documentation owner** |
| OI-U5a-12 | R2 cross-unit corrections into U5b design and clarifications. **Open, orchestrator before U5b Code Generation** |
| OI-U5a-13 | Template predicate drift; U3 now merged, checked by BR-U5a-36 (a). **Open, Build and Test** |
| OI-U5a-14 | Lint of `scripts/**` done explicitly (D-U5a-8). **Closed** |
| OI-U5a-15 | `PreparedBase` names (`dir`) kept. **Open, author may override** |
| OI-U5a-16 | U5b hand-off: (1) U5b entry check becomes "`npx jest --listTests` lists `tests/unit/scripts/`" (no scripts jest project); (2) U5b entries use the D-U5a-13 (a) form or are excluded (TS1378 under CommonJS); (3) manifest header `cycleStrategy`; (4) design §9 "jest scripts project" superseded by D-U5a-13 c. **Open, orchestrator before U5b Code Generation** |
| OI-U5a-17 | U5b fills `PreparedBase.overlays[].sha256` with the overlaid file content hash. **Open hand-off to U5b** |
| OI-U5a-18 | FF-P06 now declared (U3 merged); SP-DF01-ci resolves. **Partly closed**; probe pass/fail stays a Build and Test gate |
| U3 H3 / H4 | H3 met by DV-U5a-13 (enum), MO-DF01 → FF-P06, line-less SP-DF01-ci, `metric-already-violating`; H4 test `tests/unit/scripts/mutation/u3-discriminators.test.ts`. **Closed by U5a**; U3 handoffs file update: orchestrator |
| U5a DE §2.2 enum text (U3 H16 b) | `domain-entities.md` discriminator enum text still lists the pre-DV-U5a-13 values. **Open, lane-3 record owner** |
