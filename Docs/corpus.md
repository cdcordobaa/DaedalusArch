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
