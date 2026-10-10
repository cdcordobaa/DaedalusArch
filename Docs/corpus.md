# Evaluation Corpus

Recorded 2026-10-07 for FR-v1.2E-05. Each project is a local clone in a sibling directory of this repository (`../<directory>`). Values were read with `git remote -v`, `git branch --show-current`, `git rev-parse HEAD`, `git status --porcelain`, the licence files in the working tree and the `license` field of each `package.json`. No clone has stashes or unpushed commits.

## Clones

| Directory | Origin | Branch | HEAD SHA | HEAD commit date |
|---|---|---|---|---|
| `dev-nest` | https://github.com/johnvesslyalti/dev-nest.git | `main` | `a57d4f0ed91d42b263c92c8d6f1e39337317621e` | 2026-04-13 |
| `realworld-test` | https://github.com/lujakob/nestjs-realworld-example-app.git | `master` | `c1c2cc4e448b279ff083272df1ac50d20c3304fa` | 2021-01-18 |
| `ghostfolio-test` | https://github.com/ghostfolio/ghostfolio.git | `main` | `6d4cae31232386649e5ee8cda140b9dcbd2b6f2b` | 2026-04-15 |
| `truthy-demo` | https://github.com/gobeam/truthy.git | `main` | `9b9a61be6c0a6439c2afeb4170ef42b545e8fe54` | 2025-02-01 |
| `dry-run-test` | https://github.com/brocoders/nestjs-boilerplate.git | `main` | `dd0034750fc7f6ec15712afbecf50fa9828018a2` | 2026-04-08 |

## Licences (as found)

| Directory | Licence file | `package.json` `license` | Note |
|---|---|---|---|
| `dev-nest` | none | `ISC` | **Conflict**: the README "License" section states MIT License, while `package.json` declares ISC and the repository has no licence file. Both are permissive, but the licence is ambiguous as published. |
| `realworld-test` | none | `ISC` | **ISC only**: no licence file and no licence statement in the README; the `package.json` field is the only licence evidence. |
| `ghostfolio-test` | `LICENSE`: GNU AGPL v3 | `AGPL-3.0` | Consistent. Copyleft; the evaluation only reads the source and does not redistribute it. |
| `truthy-demo` | `LICENSE`: MIT | `MIT` | Consistent. |
| `dry-run-test` | `LICENSE`: MIT (Brocoders, 2023) | `MIT` | Consistent. |

## Working-tree state

| Directory | Tracked modifications | Untracked files |
|---|---|---|
| `dev-nest` | none (clean) | none |
| `realworld-test` | none | `firewall.spec.yaml`, `report.html` |
| `ghostfolio-test` | `apps/api/tsconfig.json`, `package-lock.json` | `apps/api/firewall.spec.yaml`, `apps/api/report.html`, `apps/api/tsconfig.refs.json` |
| `truthy-demo` | `yarn.lock` | `firewall.spec.yaml`, `package-lock.json`, `report.html` |
| `dry-run-test` | `package-lock.json`, `tsconfig.json` | `baseline_violations.json`, `firewall.spec.yaml`, `report.html` |

The untracked `firewall.spec.yaml`, `report.html` and `baseline_violations.json` files are firewall specs and reports from earlier evaluation runs; the lock-file changes are consistent with local dependency installs. Neither affects which source files are parsed.

### Local modifications that affect parsing

Two clones carry tsconfig changes that change which files the APG extractor parses. For these, **the HEAD SHA alone does not reproduce the evaluated input**; the modified tsconfig must be applied on top of the SHA.

- `ghostfolio-test/apps/api/tsconfig.json`: the upstream file is a solution-style config (`"files": []`, `"include": []`, project `references` to `tsconfig.app.json` and `tsconfig.spec.json`), which yields no source files when loaded directly. The local version replaces it with a direct config: `include: ["src/**/*.ts"]`, `exclude: ["**/*.spec.ts", "**/*.test.ts", "jest.config.ts"]`, and `compilerOptions` `outDir`, `types: ["node"]`, `emitDecoratorMetadata: true`, `moduleResolution: "node10"`, `target: "es2021"`, `module: "commonjs"`. The untracked `apps/api/tsconfig.refs.json` holds a copy of the upstream solution-style file.
- `dry-run-test/tsconfig.json`: adds `include: ["src/**/*.ts"]` and `exclude: ["**/*.spec.ts", "**/*.test.ts", "node_modules", "dist"]` (upstream has neither, so the default would include every `.ts` file under the project, tests included).

## Reproducing a clone

```sh
git clone <origin> <directory>
git -C <directory> checkout <HEAD SHA>
# then re-apply the tsconfig change listed above for ghostfolio-test and dry-run-test
```

## Import resolution rules (U2)

Recorded 2026-10-08 (U2 `business-rules.md` BR-U2-06, BR-U2-08; ADR-016). These rules decide how the extractor classifies an import on a corpus project, so they are part of the evaluated input.

- **Out-of-root alias** (BR-U2-08): an alias (`compilerOptions.paths` or `baseUrl`) that resolves to a file outside the project root and outside `node_modules` is not a project file. It yields a Package node named by the alias naming rule below, and it increments both `importResolution.external` and `importResolution.externalOutOfRootAlias`, so the count of such imports is visible next to `external` in every report.
- **Alias naming** (BR-U2-06): a package-shaped alias is named by its root (`@scope/name/sub` → `@scope/name`, BR-U2-05). A non-package-shaped alias is named by the matched `paths` key with a trailing `/*` removed (`~/*` → `~`, `#internal/*` → `#internal`), or by the first segment for a `baseUrl` match (`src/x` → `src`); its scope is `npm`.
- **Per-project alias-name listing**: every non-package-shaped alias name used on a corpus project is to be listed here for that project. The listing is a Build and Test obligation, produced after the corpus-run freeze lifts; it is not part of U2 code generation.

## Corpus specs (BR-U5b-77, BR-U1-25)

Recorded 2026-10-08 (U5b Code Generation, ADR-015 item 4, ADR-017 item 4). The four existing corpus specs were untracked files in the clones (see "Working-tree state"). They are committed under `corpus/specs/` in four separate commits, in this order: (1) unchanged; (2) FR-22 migration (`scripts/migrate-corpus-spec-cli.ts --step fr22`); (3) FF-CV02 correction (`--step cv02`); (4) the ADR-017 item 4 domain-layer remap (`scripts/remap-domain-layer-cli.ts`). dev-nest and the added projects get their specs in the E7 mapping step.

### 1. Committed unchanged

Each target is a byte-for-byte copy of its source (`cmp` exit 0); source paths are relative to the parent directory of this repository.

| Source | Target | sha256 (source = target) |
|---|---|---|
| `../realworld-test/firewall.spec.yaml` | `corpus/specs/realworld-test.yaml` | `ebda5fdec7b78191d85d1438d223d5ddfc3cb2dc775c53171785a60b000a411e` |
| `../ghostfolio-test/apps/api/firewall.spec.yaml` | `corpus/specs/ghostfolio-test.yaml` | `ebda5fdec7b78191d85d1438d223d5ddfc3cb2dc775c53171785a60b000a411e` |
| `../truthy-demo/firewall.spec.yaml` | `corpus/specs/truthy-demo.yaml` | `ebda5fdec7b78191d85d1438d223d5ddfc3cb2dc775c53171785a60b000a411e` |
| `../dry-run-test/firewall.spec.yaml` | `corpus/specs/dry-run-test.yaml` | `74bad9609a0146b6b44788a2485d9ad76c7b7aeb8889c1161fa1a5b668076565` |

realworld-test, ghostfolio-test and truthy-demo carry the same spec text (the NestJS preset as it was used in the earlier runs); dry-run-test differs.

### 2. FR-22 migration

`npx tsx scripts/migrate-corpus-spec-cli.ts --step fr22 corpus/specs/<project>.yaml`, per spec. A rerun prints `no change` for all four.

| Spec | Edited key paths |
|---|---|
| `realworld-test` | `fitness_functions[FF-N01].dimension`, `fitness_functions[FF-N01].route`, `fitness_functions[FF-N02].dimension`, `scoring.full_mode_weights.intent` |
| `ghostfolio-test` | `fitness_functions[FF-N01].dimension`, `fitness_functions[FF-N01].route`, `fitness_functions[FF-N02].dimension`, `scoring.full_mode_weights.intent` |
| `truthy-demo` | `fitness_functions[FF-N01].dimension`, `fitness_functions[FF-N01].route`, `fitness_functions[FF-N02].dimension`, `scoring.full_mode_weights.intent` |
| `dry-run-test` | `fitness_functions[FF-N01].dimension`, `fitness_functions[FF-N01].route`, `fitness_functions[FF-N02].dimension`, `scoring.full_mode_weights.intent` |

### 3. FF-CV02 correction

`npx tsx scripts/migrate-corpus-spec-cli.ts --step cv02 corpus/specs/<project>.yaml`, per spec (ADR-015 item 10, BR-U1-38). Every spec had exactly `*Service`; none was reported untouched. A rerun prints `no change` for all four.

| Spec | Edited key paths |
|---|---|
| `realworld-test` | `fitness_functions[FF-CV02].pattern` (`*Service` → `*Service\|*UseCase`) |
| `ghostfolio-test` | `fitness_functions[FF-CV02].pattern` (`*Service` → `*Service\|*UseCase`) |
| `truthy-demo` | `fitness_functions[FF-CV02].pattern` (`*Service` → `*Service\|*UseCase`) |
| `dry-run-test` | `fitness_functions[FF-CV02].pattern` (`*Service` → `*Service\|*UseCase`) |

### 4. Domain-layer remap (ADR-017 item 4)

`npx tsx scripts/remap-domain-layer-cli.ts corpus/specs/*.yaml`. The domain layer of every spec gains the directory glob `**/domain/**` and the file pattern `**/*.entity.ts`; existing entries are kept. A rerun prints `no change` for all four. The registered spec hashes are the post-remap ones.

| Spec | Edited key paths |
|---|---|
| `realworld-test` | `architecture.layers[0].directories` (+ `**/domain/**`), `architecture.layers[0].file_patterns` (new, `**/*.entity.ts`) |
| `ghostfolio-test` | `architecture.layers[0].directories` (+ `**/domain/**`), `architecture.layers[0].file_patterns` (new, `**/*.entity.ts`) |
| `truthy-demo` | `architecture.layers[0].directories` (+ `**/domain/**`), `architecture.layers[0].file_patterns` (new, `**/*.entity.ts`) |
| `dry-run-test` | `architecture.layers[0].directories` (+ `**/domain/**`), `architecture.layers[0].file_patterns` (new, `**/*.entity.ts`) |

### 5. FR-22 (U4 rubric) (BR-U4-RUB-03)

Recorded 2026-10-08 (Build and Test Step 14). `npx tsx scripts/corpus-rubric-u4-cli.ts corpus/specs/*.yaml tests/fixtures/u5a/layered/firewall.spec.yaml`, exit 0; its post-assertion holds (no `srp-semantic`, `layering-intent` or SRP rubric text in any function). A rerun prints `no change` for all five files. The text comes from the single source `src/llm-critic/rubric.ts`. **DV-BT-1**: BR-U4-RUB-03 calls this the fourth corpus commit; the U5b chain (BR-U5b-77) already made the domain-layer remap the fourth, so this is the fifth. The content is unchanged. The registered spec hashes change, so `--check-prereg` refuses until the next pre-registration bump (P-1, held by E-1).

| Spec | Edited key paths | sha256 after |
|---|---|---|
| `realworld-test` | FF-N01 and FF-N02: `name`, `semantic_criteria.rule`, `semantic_criteria.rubric.pass`, `.fail`, `.evidence_required` (10 paths) | `08e7ba247c4dc428296bc5cc13a31798f86630d09804dc6adc2496d5c3675244` |
| `ghostfolio-test` | same 10 paths | `08e7ba247c4dc428296bc5cc13a31798f86630d09804dc6adc2496d5c3675244` |
| `truthy-demo` | same 10 paths | `08e7ba247c4dc428296bc5cc13a31798f86630d09804dc6adc2496d5c3675244` |
| `dry-run-test` | same 10 paths | `dbdca3b5f1a47cd35556c19ddffd5ab734e63035d56e4960fa356e0a67536317` |
| `tests/fixtures/u5a/layered/firewall.spec.yaml` (layered fixture spec, U4 §7 row "layered fixture spec old names") | same 10 paths | `cebbeb626fbaa46985caeaf0bfa32e95bad52543e11a878d08f56b025434b10c` |

dev-nest has no spec yet (OI-12); the assertion applies to it when its spec is written in the E7 mapping step.

### 6. E7 and dev-nest specs, generated by the registered rule (ADR-019 items 1, 3; ADR-020 item 4; OI-12)

Recorded 2026-10-08 (Build and Test Steps 54–55). **Floor-motivated, to be declared in Ch7**: the ADR-017 item 4 domain-layer remap (§4 above) and these six specs were written because the held-out capacity was below the SO4 floor (69 < 80 at k = 3, E-1).

**Confirmation of the five E7 projects** against the dated `Docs/corpus-criteria.md` (committed 13:02, before `corpus/candidates.json` and `corpus/selection.json` at 13:25):
- `select-corpus --candidates corpus/candidates.json` reproduces `corpus/selection.json` byte for byte.
- Every clone is at its registered SHA.
- C1: MIT for all five.
- C2: counted from `git ls-tree` with the C2 rule; zhuravlevma 26, nestjslatam 151, MarvinRF 80, eryzerz 127, valex 32, equal to the registered counts.
- C3: `@nestjs/core` for zhuravlevma, nestjslatam and eryzerz; `express` for MarvinRF and valex.
- C5: the tracked lock sha256 equals the registered value.
- C6: not archived, not a fork.

**Spec rule.** The rule `Docs/e7-spec-rule.md` (registered, commit `ef89bf3`) was committed before any spec was generated. The specs are the byte output of `scripts/generate-e7-specs.ts` (commit `36d067f`), with no hand edit. That output was committed in `054f993`, before the single feasibility count (`a90f3e3`). `--check` regenerates the files byte-identically. Rerunning `migrate fr22`, `migrate cv02`, `remap-domain-layer` and `corpus-rubric-u4` prints `no change` for all six. `firewall validate` compiles all six. Earlier, commit `5811645` had committed the presets copied unchanged. It came from an unregistered rule run by a duplicate worker that was later stopped. It predates every feasibility count, and `054f993` supersedes it. Evidence per project: the spec header and `Docs/DiagnosticRuns/e7-spec-generation.json`.

| Project | Style (rule row) | `corpus.json` style | Files per layer (unmapped) | sha256 | Outcome |
|---|---|---|---|---|---|
| `dev-nest` | nestjs (2) | nestjs | domain 7, infrastructure 24, application 16, presentation 26 (2) | `06c5a3d86dbc…` | excluded: 10 type errors (`TS2503` 4, `TS2749` 6). The only repair, `prisma generate`, would rewrite tracked `src/generated` sources (ADR-019 item 2) |
| `zhuravlevma__nestjs-active-record` | nestjs (2) | layered | domain 2, infrastructure 2, application 16, presentation 4 (2) | `8c1c80522488…` | frozen, held-out |
| `nestjslatam__ddd` | clean-architecture (1) | clean-architecture | domain 40, application 94, infrastructure 10 (7) | `ad1671c91b53…` | frozen, held-out |
| `MarvinRF__nest-docfy` | layered (3) | clean-architecture | persistence 0, business 1, presentation 16 (63) | `dbb626bbacaa…` | excluded: no baseline selection. The full-mode report of a project with zero judge units under its spec fails the frozen report schema (`ahsNeuronal` required). This is a **suspected report-schema defect**, not a property of the project, and it goes to U6. So `prepare-bases` refuses the project (`PREP_SELECTION_MISSING`). It may be re-admitted only by a dated registered decision after a U6 fix, and before any run |
| `eryzerz__nestjs-ddd` | clean-architecture (1) | clean-architecture | domain 16, application 92, infrastructure 5 (14) | `8cb1a7a276cd…` | excluded: 4 type errors (`TS2305` 3, `TS2345` 1) in tracked test files under the default tsconfig. Criteria §4 allows no overlay |
| `v-aguiar__valex` | layered (3) | layered | persistence 7, business 3, presentation 9 (13) | `32c150f2fc77…` | frozen, held-out |

The `corpus.json` style is the query-derived C4 value. Where it differs from the rule's style, the difference is recorded here and the two are not reconciled. No excluded project is repaired.

## Fetched and prepared bases (Build and Test)

Recorded 2026-10-08 (Build and Test Steps 13–19; FR-36; BR-U5b-66, 67, 76; OI-11). Clones under `../daedalus-corpus/<name>` (outside every checkout, never committed), fetched with `npx tsx scripts/fetch-corpus-cli.ts --dest ../daedalus-corpus` (Node v24.5.0, npm 11.5.1). Every fetched HEAD equals `commitSha` in `corpus/corpus.json`, and the core five equal the Clones table above. A rerun with `--check` into a fresh scratch destination prints "SHA and overlays check" for all ten (exit 0); `fetch-corpus` refuses an existing destination, so the idempotence rerun cannot target `../daedalus-corpus` itself. Selections: `corpus/selections/<project>.json`, projected by `scripts/store-baseline-selection-cli.ts` from Mock-provider full-mode reports (zero live calls; DV-BT-2). Prepared with `npx tsx scripts/prepare-bases-cli.ts --clones ../daedalus-corpus --selections corpus/selections --only realworld-test,ghostfolio-test,truthy-demo,dry-run-test` (exit 0; measured tsc equals the registered value for all four, OI-U5a-5; overlay `sha256` is the overlaid content, OI-U5a-17). Parity: `scripts/u5a-parity-check.ts` exit 0 (`OK`) on each of the four (BR-U5a-56). Type-check and feasibility: `Docs/DiagnosticRuns/u5a-base-typecheck.*` and `u5a-site-feasibility.*`.

| Entry | Set | HEAD = registered | Tree hash (source + overlays) | Overlays (patch sha256, overlaid content sha256) | Install lock sha256 | Install | tsc (registered; measured when prepared) | Prepared | Parity |
|---|---|---|---|---|---|---|---|---|---|
| `dev-nest` | core | yes | `51d97809532d26cca7fef2551cc0af00ff22fe4a` | — | `28c24f8911ab…` | ok | 5.9.3 | no: no spec (OI-12) | — |
| `realworld-test` | core | yes | `a35a8d572473ce3aee63f27df114b43686547e21` | `src/config.ts` patch `4b4892265a42…`, overlaid `1d32c182ead8…` | `d5e2bbd08d77…` | INSTALL_FAILED (incomplete, see note 1) | 3.8.3 | yes | OK |
| `ghostfolio-test` | core | yes | `cb3dfcd8af7e319ff9cc32d5aca76ce97f238c44` | `apps/api/tsconfig.json` patch `db662b72fe5f…`, overlaid `b8d3b02be527…` | `e9191a047adb…` | ok | 5.9.2 | yes (`apps/api`) | OK |
| `truthy-demo` | core | yes | `cd3914eca7a5db576a22703aa66f9ad4be37b3e0` | `package-lock.json` patch `5c171979d68f…`, overlaid `80a19e1961bc…`; `.npmrc` patch `abed217f31f0…`, overlaid `a093bb2fed59…` | `80a19e1961bc…` | ok | 4.7.4 | yes | OK |
| `dry-run-test` | core | yes | `697f7a49a6cfb87faaee8c7e29163fc887c29846` | `tsconfig.json` patch `d581ea3d2b87…`, overlaid `dfc7de7a6ecb…` | `c019ce88c1bf…` | ok | 5.9.3 | yes | OK |
| `zhuravlevma__nestjs-active-record` | E7 | yes | `f4209ac123da5d84a136015e6cd8807409a5d9b3` | — | `3cfb9991354c…` | ok | 4.9.5 | no: no spec (OI-12) | — |
| `nestjslatam__ddd` | E7 | yes | `d889b5b4294177c71032ae1481ec2ae54aca23b8` | — | `dc62206bb060…` | ok | 5.9.3 | no: no spec (OI-12) | — |
| `MarvinRF__nest-docfy` | E7 | yes | `542a6b9f618f1450c0226cf085658b09d16371b5` | — | `a8a5a6340195…` | ok | 5.9.3 | no: no spec (OI-12) | — |
| `eryzerz__nestjs-ddd` | E7 | yes | `01aa7917e7845914fdd6acbc9c63680731ab8365` | — | `432c5f9c6167…` | ok | 3.6.4 | no: no spec (OI-12) | — |
| `v-aguiar__valex` | E7 | yes | `aa164b3c199daccd487065fa284eda2f6f09664e` | — | `19e62ccb77e9…` | ok | 4.7.4 | no: no spec (OI-12) | — |

Notes:

1. **realworld-test install incomplete.** `npm ci --ignore-scripts` fails with npm's "Exit handler never called!" under npm 11.5.1 and again under npm 10.9.2 (same lock, `lockfileVersion` 1). 194 of the lock's `resolved` URLs point to a third-party mirror (`npm.styque.de`) that no longer answers; 39 non-optional packages stay missing (the earlier local clone `../realworld-test` lacks 192). TypeScript 3.8.3 is installed, the base type-checks with 0 errors (stubs on failed resolution, BR-U5a-10) and parity is `OK`. The tree hash above was computed with `treeHash` after the failure and equals U5b Step 25's no-install value. A registered fix (for example an overlay that re-points the lock to the public registry) changes `corpus/corpus.json` and is left to the author.
2. **truthy-demo tree hash depends on the install.** npm rewrites the tracked `yarn.lock` during `npm ci` (npm's yarn.lock sync), so the post-install tree hash is `cd3914eca7a5db576a22703aa66f9ad4be37b3e0`; without install (U5b Step 25) it is `f28724d8…`. The source files the tools read are unchanged. Hashing before the install would make the record install-independent; that is a `fetch-corpus` design change left to the author.
3. **ghostfolio-test was excluded by the base type-check (Step 18); repaired under ADR-019 item 2 (Step 53, commit `54fc438`)**: the entry declares `preparation: [prisma-generate, monorepo-context]` (no source file changed; the overlay `apps/api/tsconfig.json` now extends the generated `tsconfig.monorepo.json`; overlay patch sha256 `e8da2f05bfa2…`). After preparation: 0 errors, parity `OK`, two runs byte-identical. The repair is post-hoc and floor-motivated (Ch7). Original note (3 errors, `TS2688`, `TS5052`, `TS5083`): the analysis copy of the `apps/api` sub-path base does not include the monorepo root (`tsconfig.base.json`, root `node_modules`). Type-checked in the clone itself, `apps/api` gives 432 errors (`TS2305` 232, `TS2339` 188, …), consistent with a Prisma client that is not generated under `--ignore-scripts`. Both are left to the author; no base was patched.
4. dev-nest and the five E7 additions were fetched but not prepared in Step 16 (no spec yet, OI-12). In Build and Test Step 56 they were prepared from their generated specs (§6 of "Corpus specs"): parity `OK` on all nine prepared bases. Type-check (`Docs/DiagnosticRuns/u5a-base-typecheck.*`): dev-nest and eryzerz are excluded, and MarvinRF is not prepared. The single feasibility count (Step 57, `Docs/DiagnosticRuns/u5a-site-feasibility.*`) covers the seven frozen held-out bases: k = 2 → 85, k = 3 → 126, so k = 2.

## E7-x additions (ADR-027; `Docs/corpus-criteria.md` §7)

Recorded 2026-10-10. Order: research note (`Docs/DiagnosticRuns/e7-candidate-research-2026-10-09.md`, API only, `875153b`) → ADR-027 and the dated criteria extension (`8f93521`) → `select-corpus --extension` code (`f578f56`) → `corpus/candidates-e7x.json` (searched 2026-10-10T02:00Z, `gh` 2.88.1; 246 candidates, 22 eligible with attributes) → `corpus/selection-e7x.json` (seed 20261008, reproducible byte for byte; no eligible layered candidate; tiers P3 2, P2 3, P1 11, P0 6; no owner-cap hit). No candidate was cloned, built or run before the selection was committed. Additions join **E7 only** (`experiments/e7-corpus/plan.json`), never SO4.

Each selected project was fetched (`fetch-corpus`, HEAD = recorded SHA, lock sha256 checked, `npm ci --ignore-scripts`), given its spec by the registered generator (no hand edit), a Mock-derived baseline selection (DV-BT-2, zero live calls, re-derived byte-identical), prepared (`prepare-bases`, measured tsc = registered), type-checked with its pinned tsc (`Docs/DiagnosticRuns/e7x-base-typecheck.*`, separate from the registered SO4 file) and parity-checked (`u5a-parity-check`). A failure excludes the project without repair. Evidence per project: `Docs/DiagnosticRuns/e7x-preparation.json`.

| Draw | Project | Origin | Commit | Files (C2) | P (E H F R) | Spec style (rule row) | tsc | Type-check | Parity | Outcome |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `zhuravlevma__typescript-ddd-architecture` | https://github.com/zhuravlevma/typescript-ddd-architecture.git | `025ace5cff0efa8307a1e7e694d0c54bcde3bb18` | 187 | 3 (1 1 1 0) | nestjs (2) | 5.7.2 | 0 | OK | **admitted**; same owner as round-1 `zhuravlevma__nestjs-active-record` (TV-99) |
| 2 | `raouf-b-dev__ecommerce-store-api` | https://github.com/raouf-b-dev/ecommerce-store-api.git | `08b0760ad501bbe25b612a4e4e2673ad4b9d17d6` | 793 | 3 (1 1 0 1) | clean-architecture (1) | 6.0.3 | 0 | OK | **admitted**; above the 300-file latency claim (NFR-v1.2E-07 amendment) |
| 3 | `fairnesscoop__permacoop` | https://github.com/fairnesscoop/permacoop.git | `1eb778033a12d8ef4c8ed5f02c0dc2e640c7c4c2` | 323 | 2 (0 1 0 1) | clean-architecture (1) | 4.9.5 | — | — | excluded: spec invalid, e7-spec-rule §5 (b) (only `domain` receives files; capitalised directories) |
| 4 | `khusenov__backend-boilerplate` | https://github.com/khusenov/backend-boilerplate.git | `684c42f37ebfbdf1a970a4a9a3a135548c4bf046` | 215 | 2 (1 0 1 0) | clean-architecture (1) | 6.0.3 | 43 (`TS2749` 33, `TS7006` 9, `TS2503` 1) | OK | excluded: type-check (BR-U5a-07) |
| 5 | `pvarentsov__typescript-clean-architecture` | https://github.com/pvarentsov/typescript-clean-architecture.git | `5c29c39e402c67105ca66ec4dd2a4cf84b285e39` | 185 | 2 (0 0 1 1) | clean-architecture (1) | 4.9.5 | 9 (`TS2344` 8, `TS2403` 1) | OK | excluded: type-check (BR-U5a-07) |
| 6 | `DanielAraldi__mailer` | https://github.com/DanielAraldi/mailer.git | `4af35125fd4d24967e83b96ef25f1358c79ce2a1` | 65 | 1 (0 0 0 1) | clean-architecture (1) | 5.3.3 | 4 (`TS2305` 4) | OK | excluded: type-check (BR-U5a-07) |

Two of six were admitted. The shortfall rule counts eligible candidates (22 ≥ `addMin` 3), so there is no `CORPUS_SHORTFALL` and no re-draw; as in round 1, an exclusion after the draw is not replaced. Excluded projects keep no spec, selection or `corpus.json` entry; their full records are in `corpus/selection-e7x.json` and `Docs/DiagnosticRuns/e7x-preparation.json`. Under C5 (unchanged), 41 candidates with only `pnpm-lock.yaml` and 53 with only `yarn.lock` were excluded (`no-package-lock`). Hexagonal candidates map to `clean-architecture` (no hexagonal template exists).

Fix-commit pairs from the research note for the admitted projects are stored as data only in `corpus/real-violation-pairs.json` (5 pairs: raouf ×4, zhuravlevma ×1; before = first parent, touched files from `git diff-tree -M`). None has been seeded, built or run.

**raouf file count, C2 793 vs parsed 819 (checked 2026-10-10).** The E7 run of `raouf-b-dev__ecommerce-store-api` reports `parseCoverage.total` 819, above the 800 limit of ADR-027 decision 3, while the table above gives 793. Recounted from the git tree at `08b0760a` by the C2 rule (`git ls-tree -r`; files under the root `src/` ending in `.ts`, without `*.spec.ts`, `*.test.ts` and `*.d.ts`): **793**, as registered. Nothing is wrong. The two numbers count different sets. C2 counts root `src/` only. Parse coverage counts every file the project's `tsconfig.json` includes (`src/**/*`, `test/**/*`, `scripts/**/*`, `data-source.ts`) minus the extractor's default excludes (`*.d.ts`, `*.spec.ts`, `*.test.ts`): 793 in `src/`, plus 21 under `test/` (11 `*.e2e-spec.ts`, which the `*.spec.ts` glob does not match, and 10 harness and constants files), 4 under `scripts/` and `data-source.ts`, for a total of 819. C2 is the admission rule, so the project stays admitted, and C2 and its counts are unchanged.
