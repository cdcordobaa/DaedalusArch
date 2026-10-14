# v1.3 integration notes (unit U-A, FR-V1)

**Date**: 2026-10-14. **Branch**: `v1.3`, cut from `origin/v1.2e` at `c63fa0d` (v1.3 inception docs).
**Requirements**: `aidlc-docs/inception/requirements/v1.3-validity-requirements.md` (FR-V1; NFR-V1, NFR-V2, NFR-V5).

## Merge order

All merges are `--no-ff` merge commits; nothing was rebased or squashed.

| # | Source branch (head) | PR | Merge commit |
|---|---|---|---|
| 1 | `v1.3-mcp-loop` (`6ee5ddd`), which carries `v1.3-mcp-prototype` (`6697031`) | #74 on #55 | `96575a5` |
| 2 | `v1.3-extractor-fixes` (`f44e102`), also on `v1.3-mcp-prototype` | #69 | `75a89b0` |
| 3 | `v1.3-hexagonal` (`7b253f8`) | #76 | `a0b89ab` |
| 4 | `v1.3-judge-antipatterns` (`7675464`) | #79 | `389b725` |
| 5 | `origin/v1.2e` again (`9c3804f`, v1.3 validation protocol docs pushed after the cut) | none | `4769c01` |

Steps 1 to 4 were followed by two commits: `90d402e` (extractor defaults) and `6ab4a4c` (spec-parser test fixes).

Order rationale: the MCP stack first, because #69 shares its base commit (`v1.3-mcp-prototype`), so step 2 brings only the extractor commit; then the two independent v1.2e-based branches.

## Conflicts and how they were resolved

The four draft branches merged with **no textual conflicts**. Git auto-merged two overlapping files; both results were checked by hand. The one textual conflict came from step 5 (`aidlc-docs/audit.md`, below).

| File | Branches | Result |
|---|---|---|
| `aidlc-docs/audit.md` | #74 and #79 (auto-merged); step 5 (textual conflict) | Every side only appends entries. In step 5 the #79 entry (2026-10-12) and the two v1.2e coordinator entries (2026-10-14T20:10Z, 20:25Z) were appended at the same place; resolved by keeping all three, #79 first, with the `---` separator. Against `v1.2e` the file has additions only. |
| `src/fitness-compiler/fitness-compiler.ts` | #69 and #76 | Disjoint hunks. #69 adds `CompileOptions.v13Templates` and threads a `TemplateCatalogue` (`CYPHER_TEMPLATES` plus, with the flag, `V13_CYPHER_TEMPLATES`) through `compileFunctionsCore`. #76 wraps the entry point: `compileFunctions` sends `style: hexagonal` to `compileHexagonalFunctions`, whose fallback closure calls `compileFunctionsCore(rest, options)`, so the `v13Templates` option still reaches the core for the hexagonal style. Both intents hold. |

The registries named as likely conflict points did not collide:

- `CYPHER_TEMPLATES` (`src/fitness-compiler/cypher-templates.ts`) and `EDGE_TYPES` (`src/shared/types/enums.ts`): unchanged against `v1.2e` (frozen, NFR-V1).
- `V13_EDGE_TYPES` (enums.ts) and `V13_CYPHER_TEMPLATES` (`v13-templates.ts`): only #69 adds them.
- `HEXAGONAL_TEMPLATES` (`hexagonal-templates.ts`) and the `hexagonal` entry of `TEMPLATE_REGISTRY` (`src/spec-parser/template-registry.ts`): only #76.
- The anti-pattern operators live in their own registry (`scripts/lib/mutation/antipatterns/index.ts`), only #79.
- MCP tool lists (`src/mcp-server/tools.ts`, `server.ts`, `SPEC_TOOL_NAMES`): only #55/#74.

### Semantic conflicts found by the tests (fixed after the merges)

Merging #76 makes `hexagonal` a known style. Three v1.2E tests relied on it being unknown or absent. They were adapted without deleting an assertion (commit `6ab4a4c`):

| Test | Problem | Fix |
|---|---|---|
| `tests/unit/spec-parser/template-registry.test.ts` "returns undefined for unknown style" | used `'hexagonal'` as the unknown style | uses `'onion'`; same assertion |
| `tests/unit/spec-parser/spec-parser.test.ts` "fails on unknown architecture style" | spec with `style: hexagonal` now parses | `style: onion`; same `UNKNOWN_STYLE` assertion |
| `tests/unit/spec-parser/frozen-thresholds.test.ts` "every shipped YAML is pinned" | `presets/hexagonal.yaml` was unpinned | pinned at its first commit: FF-P02 0.85, FF-C02 10, FF-C05 15, FF-C06 0.3, scoring 0.80 / 0.65 / 0.50 (no FF-C01) |

## Flag defaults (FR-V1)

`src/apg-extractor/types.ts` (commit `90d402e`):

| Constant | `dynamicImports` | `moduleWiring` | Use |
|---|---|---|---|
| `V12E_DEFAULT_OPTIONS` | false | false | frozen v1.2E instrument; pass it (or the two flags `false`) to reproduce a v1.2E graph |
| `V13_DEFAULT_OPTIONS` | **true** | **true** | the v1.3 defaults |
| `DEFAULT_OPTIONS` | = `V13_DEFAULT_OPTIONS` | | applied by `extractAPG`, `extractNodes` and `extractEdges` |

Both constants are frozen and exported from `src/apg-extractor/index.ts`. The `ExtractorOptions.dynamicImports` and `moduleWiring` flags are kept, so either can be turned off per call. `CompileOptions.v13Templates` (the example module-wiring template) stays OFF by default; FR-V1 names only the extractor options.

Tests:

- `tests/unit/apg-extractor/v13-dynamic-imports.test.ts`: new "on by default" (constants, and the MO-X01 seed gives a `dynamic: true` IMPORTS edge with no option, equal to `dynamicImports: true`); the old "off by default" case now passes `dynamicImports: false` explicitly; the counter-partition case compares against explicit off.
- `tests/unit/apg-extractor/v13-module-wiring.test.ts`: new "on by default" case (MODULE_* edges with no option, equal to `moduleWiring: true`); the old "off by default" case and the "v1.2E edges untouched" case pass `moduleWiring: false` explicitly.
- `tests/unit/apg-extractor/import-resolution-stats.test.ts`: pins the frozen v1.2E partition (F-DYN expects 3 unsupported dynamic calls and one EXTRACTOR_009), so its `run()` passes both flags `false`. Its `extractAPG` cases on the F-ALIAS fixture keep the v1.3 defaults and still pass (the fixture has no dynamic import or `@Module`).

## Verification

Environment: worktree `npm ci` (lockfile from #55, `@modelcontextprotocol/sdk` 1.32.1); capped container `daedalus-neo4j-bt` on bolt 7693, credentials loaded from `~/.daedalus-bt.env` (never printed); jest always `--maxWorkers=2` (golden lanes `--runInBand`).

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `tsc -p` for `tsconfig.scripts.json`, `u0`, `u1`, `u3`, `u4` test configs | clean |
| eslint on every changed `src/` and `tests/` file | 117 errors, all pre-existing: the same 16 files give the same per-file counts on their `v1.2e` versions; the new files give 0 |
| jest, full default config | see "Test counts" |
| golden suite (`jest.golden.config.cjs`, `GOLDEN_REQUIRED=1`) | 7 suites, 80 tests passed |
| golden full-mode lane (`jest.golden-full.config.cjs`) | 1 suite, 7 tests passed |

### Test counts

- First full run after the merges and the flag change, with the Neo4j env loaded: 264 suites, 3656 tests, **5 failed**: the 4 tests above (3 hexagonal semantic conflicts plus F-DYN) and `cli.test.ts` (below).
- Final full run, after the test fixes, with the Neo4j env loaded: 264 suites; 262 passed, 2 failed. Tests: 3600 passed, 1 failed (`cli.test.ts`, below). The other failed suite, `tests/unit/apg-extractor/import-resolver.test.ts`, did not run: its jest worker died with SIGSEGV under machine memory pressure (no assertion failed). Re-run alone (`--maxWorkers=2`): 56 of 56 passed, as in the first full run.
- **Net: 3656 tests, 3655 passed, 1 environment failure.**

### Pre-existing / environment failures

- `tests/unit/cli/cli.test.ts` "defaults neo4j-uri to bolt://localhost:7687": fails only when `NEO4J_URI` is exported (the bt env sets bolt 7693, and the CLI default reads the env). It passes with the env unset (checked: 28 suites, 414 tests passed for cli, apg-extractor and spec-parser). `src/cli/` and `tests/unit/cli/` are identical to `v1.2e` (`src/cli/cli.ts` defaults `--neo4j-uri` to `process.env.NEO4J_URI`), so it fails the same way on `v1.2e` under that env.
- `score-golden-acceptance` (needs full history) and `skeleton` (offline `npm ci`): both **passed** here (full clone, network available), so neither is listed as failing.

## Registered artefacts (`--check-prereg`)

`--check-prereg` passes on all 12 `experiments/*/plan.json` ("pre-registration v25 ok: 85 registered artefacts unchanged"). No registered artefact hash changed:

- `CYPHER_TEMPLATES`, `EDGE_TYPES`, `corpus/prereg.json`, `corpus/frozen-instrument.json`, `corpus/**`, `experiments/**`, `Docs/operator-catalogue.md`, the prompts, specs and the other registered paths: unchanged against `v1.2e`.
- **Added**: `presets/hexagonal.yaml` (#76). It matches the registered pattern `presets/*.yaml` but is not in the v25 registration, and the gate checks registered hashes only, so the gate does not report it. Any v1.3 or Study 2 registration must hash it.
- Changed and not registered, but behaviour-relevant for any re-run of a v1.2E plan on this branch: the extractor (`src/apg-extractor/*`, defaults now on), the fitness compiler, the spec parser and template registry, the report builders, `scripts/lib/mutation/{types,mutate-main}.ts` and `schemas/manifest.schema.json` (#79, additive). A v1.2E reproduction must run on `v1.2e`, or on `v1.3` with `V12E_DEFAULT_OPTIONS`.

## Open points

- `src/spec-parser/spec-validator.ts` still checks function names against `CYPHER_TEMPLATES` (plus `HEXAGONAL_TEMPLATES` for hexagonal), so a spec naming the v1.3 module-wiring template does not validate yet (known limit noted in `Docs/v1.3-extractor-notes.md`).
- The `cli.test.ts` env sensitivity could be removed by clearing `NEO4J_URI` in that test; left as is (v1.2E test, outside FR-V1).
