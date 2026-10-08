# U2 scout import probe

Committed by U2 code generation (Step 4) under ADR-016 h (former OI-7), so that the corpus figures quoted in the U2 functional design (`v1.2E-u2-extractor-graph-functional-design-plan.md` Section 3; `business-rules.md` §9 and §14.2 OI-7; `business-logic-model.md` header and §5) can be reproduced from the repository.

The directory name `Docs/DiagnosticRuns /` ends in a space. It is quoted, not renamed (U2 code-generation plan D-U2-5), because tracked documents already cite it.

## Purpose

`probe-imports.ts` is a read-only measurement of the extractor's inputs. It builds a ts-morph `Project` the same way `extractAPG` does (`src/apg-extractor/apg-extractor.ts`): it loads the project's `tsconfig.json`, uses lenient mode (`skipFileDependencyResolution: true`) and drops the `DEFAULT_EXCLUDE_PATTERNS` (copied literally) matched against paths relative to the project. For each import statement it calls `ts.resolveModuleName(specifier, containingFile, compilerOptions, project.getModuleResolutionHost())`, the call fixed by D-U2-3. It imports nothing from `src/`, so it measures the inputs and not U2's output.

This is not a corpus baseline. No evaluation is run, the corpus-run freeze (FD plan Section 2) still applies, and no `tests/golden/CHANGES.md` line is written.

## Command

From the repository root (Node `v24.5.0`, TypeScript `5.7.3` through ts-morph, both recorded in the JSON):

```sh
npx tsx "Docs/DiagnosticRuns /u2-import-probe/probe-imports.ts" \
  --json "Docs/DiagnosticRuns /u2-import-probe/output-2026-10-08.json" \
  --md   "Docs/DiagnosticRuns /u2-import-probe/output-2026-10-08.md" \
  ../ghostfolio-test/apps/api ../truthy-demo ../dry-run-test ../realworld-test ../dev-nest
```

The output contains no absolute path and no timestamp. Re-running the command over unchanged clones gives byte-identical files (checked on 2026-10-08).

## Column definitions

A **statement** is an `import … from 'S'`, `import 'S'` or `import x = require('S')` at module level. `export … from 'S'` is counted only in its own column. Each statement falls in exactly one class, so the classes add up to *Import stmts*:

| Column | Definition |
|---|---|
| Built-in | `S` starts with `node:`, or its first segment is a bare name in `module.builtinModules`. `_`-prefixed and `node:`-only entries such as `node:test` are excluded, so `test/x` is not a built-in. |
| Relative in project | `S` is relative (`./`, `../`, `/`) and resolves to a file under the project root, outside `node_modules`. |
| Alias/baseUrl in project | `S` is not relative and resolves (through `paths` or `baseUrl`) to a file under the project root, outside `node_modules`. |
| Alias outside root | `S` is not relative and resolves to a file outside the project root and outside `node_modules`. |
| `node_modules` | `S` resolves to a file in `node_modules`, or `isExternalLibraryImport` is set. This includes JavaScript-only resolutions. |
| Unresolved bare | `S` is not relative, not a built-in, and `resolvedModule` is `undefined`. |
| Type-only stmts | `import type …` declarations. The supplementary column also counts `import { type A, type B }` with no default or namespace import. |
| Repeated pair | (file, target) pairs reached by more than one statement. The target is the resolved file, or `package:<root>` for built-in and unresolved bare specifiers. The supplementary *U2 merge key* column uses U2's IMPORTS merge key instead: the File for project files and the package root for anything in `node_modules`. |
| `export…from` | `export … from 'S'` declarations, with the class of `S` in the supplementary table. |

Supplementary columns: relative imports outside the root, relative imports that do not resolve, `node_modules` resolutions to JavaScript only (no declaration file), `import()` calls, `require()` calls, and nullable-union instance fields. A nullable-union instance field is a non-static class property or constructor parameter property whose type annotation is a union with a `null` member.

## Corpus SHAs

These match `Docs/corpus.md`. *Dirty* is `git status --porcelain | wc -l` for each clone and matches the working-tree state recorded there (the tsconfig modifications in ghostfolio-test and dry-run-test are in place).

| Clone | HEAD | Dirty |
|---|---|---|
| ghostfolio-test (`apps/api`) | `6d4cae31232386649e5ee8cda140b9dcbd2b6f2b` | 5 |
| truthy-demo | `9b9a61be6c0a6439c2afeb4170ef42b545e8fe54` | 4 |
| dry-run-test | `dd0034750fc7f6ec15712afbecf50fa9828018a2` | 5 |
| realworld-test | `c1c2cc4e448b279ff083272df1ac50d20c3304fa` | 2 |
| dev-nest | `a57d4f0ed91d42b263c92c8d6f1e39337317621e` | 0 |

## Comparison with the FD plan Section 3 table

Each row shows the probe value; where it differs, the FD value follows in brackets.

| Project (files) | Import stmts | Relative in project | Alias/baseUrl in project | Alias outside root | `node_modules` | Unresolved bare | Built-in | Type-only | Repeated pair | `export…from` |
|---|---|---|---|---|---|---|---|---|---|---|
| ghostfolio `apps/api` (241) | 1915 | 194 | 829 | 330 | 544 [542] | 0 [2] | 18 | 26 | 1 | 0 |
| truthy-demo (155) | 683 | 0 | 396 | 0 | 282 [259] | 0 [23] | 5 | 0 | 2 | 2 |
| dry-run-test (156) | 705 | 409 | 0 | 0 | 292 [283] | 0 [9] | 4 | 0 | 0 | 0 |
| realworld-test (34) | 132 | 63 | 0 | 0 | 65 [57] | 0 [8] | 0 | 0 | 2 | 5 |
| dev-nest (75) | 292 | 120 | 0 | 0 | 0 | 166 | 6 | 25 | 4 | 15 |

The figures the design quotes are all reproduced:

- **330**: ghostfolio-api alias imports outside the root.
- **1,159**: ghostfolio-api alias imports, 829 in the project plus 330 outside the root.
- **396**: truthy-demo alias imports.
- **15**: dev-nest `export … from`.
- **166**: dev-nest unresolved bare specifiers.

The file counts, statement totals and every other column are also reproduced.

### Observations

1. **The split between `node_modules` and unresolved bare differs in four projects.** The sum of the two columns is equal in every row: 544, 282, 292 and 65. The probe resolves every one of these specifiers. In truthy-demo (23) and realworld-test (8), the FD "unresolved bare" count equals the number of specifiers that `ts.resolveModuleName` resolves only to a JavaScript file in `node_modules`, with no declaration file. The scout probe therefore probably counted resolutions without types as unresolved. For ghostfolio-api (2 vs 1 JavaScript-only) and dry-run-test (9 vs 1), the remaining difference cannot be attributed from the repository. The likely cause is the local dependency installs recorded in `Docs/corpus.md` (lock-file changes) between the scout run and this run. **No decision depends on this split.** Under BR-U2-10/11, a bare specifier yields a Package node whether or not it is installed, and `importResolution.external` counts both cases.
2. **The figure "20/16" measures something else here.** `business-logic-model.md` §5 records "20 such sites in dev-nest and 16 in dry-run-test" for nullable union fields (`T | null`). The review did not record the counting rule. With the rule used here (class instance fields and parameter properties typed as a union with `null`), the probe finds 0 in dev-nest and 34 in dry-run-test. dev-nest's `| null` unions sit in generated Prisma input *types* (`src/generated/prisma/**`) and are not class fields. **The design conclusion is unchanged**: union-typed fields are skipped (Q9 A), so FLOWS_TO is close to empty on the corpus and FR-21 is validated by fixtures. The design text is not edited.
3. **Built-in classification depends on the `node:`-only list.** On Node 24, `module.builtinModules` lists `node:test`, `node:sqlite` and `node:sea` only with the prefix. If the prefix were stripped and the bare name `test` treated as a built-in, truthy-demo's six `test/…` `baseUrl` imports would move from "Alias/baseUrl in project" (396 → 390) to "Built-in" (5 → 11). The probe excludes `node:`-only entries, as the U2 `NODE_BUILTIN_MODULES` rule does (code-generation plan Step 5).
4. **Type-only follows the declaration form.** The FD column counts `import type …` declarations. Also counting `import { type A }` statements raises dev-nest from 25 to 26 (supplementary column).
5. **Repeated pairs under U2's merge key.** When repeated pairs are counted per target File or Package root, as U2's IMPORTS merger keys them, the counts are 7, 4, 7, 7 and 4. These are the duplicate pairs that BR-U2-17..21 merge into one edge on the corpus. The FD column (1, 2, 0, 2, 4) counted per resolved file.
6. **realworld-test has four relative imports that resolve to no file.** This explains why its import statements (132) exceed the six FD classes (128). These four become `EXTRACTOR_002` / `unresolved` under BR-U2-12.

## Files

- `probe-imports.ts`: the probe.
- `output-2026-10-08.json`: one row per project, including the supplementary columns, `node` and `typescript` versions.
- `output-2026-10-08.md`: the same data as Markdown tables.
