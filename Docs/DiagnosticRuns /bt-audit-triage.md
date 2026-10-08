# Build and Test — dependency audit triage and lint record

**Date**: 2026-10-08 · **Step**: v1.2E Build and Test plan, Step 6 · **Requirements**: NFR-v1.2E-06 (SECURITY-10); U0 residuals (lint ratchet, `npm audit`).
**Location note**: this file sits in the tracked folder `Docs/DiagnosticRuns /` (trailing space), quoted and not renamed, as D-U2-5 decided (DV-BT-7).

## 1. `npm audit` before and after

Counts from `npm audit --json` (whole tree) and `npm audit --omit=dev --json` (runtime tree), Node 24.5.0, npm registry state of 2026-10-08.

| Tree | Before (`BT_BASE` lock) | After (Step 6 lock) |
|---|---|---|
| Whole tree | 50: 2 low, 10 moderate, 37 high, 1 critical | 46: 2 low, 12 moderate, 32 high, 0 critical |
| Runtime tree (`--omit=dev`) | 8 high | 5 high |
| Dev tree only (whole minus runtime) | 30 high, 1 critical | 27 high |

The 32 high entries that remain are one root advisory, **GHSA-vfj7-8cjw-p6xm (`braces`)**, reported again for each package on a path to it (`micromatch`, `fast-glob`, `@ts-morph/common`, `ts-morph`, and 27 `jest` packages).

## 2. Lock-only update (no `--force`)

`npm audit fix` without `--force` also moved the Babel packages, which were not audited findings. To keep the `package-lock.json` diff to the audited packages, the update was done as `npm update brace-expansion fast-uri form-data handlebars js-yaml browserslist` instead. `package.json` did not change.

| Package | Before | After | Tree |
|---|---|---|---|
| `brace-expansion` (9 nested copies) | 1.1.13 / 2.0.3 | 1.1.21 / 2.1.7 | runtime (`@ts-morph/common`) and dev |
| `fast-uri` | 3.1.0 | 3.1.8 | runtime (`ajv`) |
| `form-data` (+ `hasown` 2.0.2 → 2.0.4) | 4.0.5 | 4.0.6 | runtime (`openai` → `@types/node-fetch`) |
| `handlebars` | 4.7.9 | 4.7.10 | dev (`ts-jest`); clears the critical advisory |
| `js-yaml` (2 copies) | 4.1.1 / 3.14.2 | 4.3.2 / 3.15.2 | dev (`eslint`, `istanbul`); the spec parser uses `yaml`, not `js-yaml` |
| `browserslist` (+ `caniuse-lite`, `electron-to-chromium`, `node-releases`, `update-browserslist-db`, `baseline-browser-mapping`) | 4.28.1 | 4.29.3 | dev (Babel) |

Gates U and G were unchanged after the update: U equal to the step baseline, G 80 / 7 suites with byte-identical snapshot hashes.

## 3. Triage of the runtime-tree high findings (U0 list and current)

| Package | Advisory | Decision | Reason |
|---|---|---|---|
| `brace-expansion` | ReDoS / exponential expansion | **Fixed** by the lock-only update | 2.1.7 and 1.1.21 are outside the affected ranges. |
| `fast-uri` | Host confusion | **Fixed** by the lock-only update | 3.1.8 is outside the affected range. |
| `form-data` | CRLF injection | **Fixed** by the lock-only update | 4.0.6 is outside the affected range. |
| `braces` (with `micromatch`, `fast-glob`, `@ts-morph/common`, `ts-morph` on its path) | GHSA-vfj7-8cjw-p6xm, stack exhaustion | **Accepted residual** | No fixed `braces` release exists (3.0.3 is the latest and is affected). At runtime it is reached through `ts-morph` → `fast-glob` → `micromatch`, which expand glob patterns from the evaluated project's `tsconfig` `include`/`exclude` and from the local CLI. The worst case is a crafted pattern that crashes the local evaluation (denial of service); no data is exposed. Removing the path needs `ts-morph` 28 and `jest` 30, both semver-major, which would change the extractor under FR-18 and the test runner; that is outside Build and Test. |

Dev-tree findings: every remaining dev-tree high is the same `braces` advisory through `jest` 29 (`micromatch`). It runs only on this repository's own configuration. Accepted residual, same reason.

## 4. CI audit step (NFR-06)

The triage leaves **no untriaged high finding**, so the audit is promoted to blocking:

- `Dependency audit` (`npm audit --audit-level=high`) stays as the full report under `continue-on-error`, because the accepted `braces` residual still counts as high there.
- New blocking step `Dependency audit gate (triaged)`: `npx tsx scripts/audit-gate-cli.ts` reads `npm audit --json`, collects the root advisories of severity high or critical, and fails (`AUDIT_UNTRIAGED`) on any advisory that is not in `scripts/lib/audit-allowlist.json`. The allow-list holds one entry, GHSA-vfj7-8cjw-p6xm, with its decision and reason. A new high advisory therefore fails CI until it is triaged here and added to the allow-list.

## 5. Lint record (ratchet, not a fix campaign)

`npm run lint` (`eslint src tests`): **497 errors, 2 warnings** in 75 files (249 errors under `src/`, 248 under `tests/`). The CI step stays `continue-on-error` (D-U0-16); this is a residual for the summary. New or edited `scripts/**` files are held to 0 errors under `tsconfig.scripts.json` (D-U5a-8).

| Rule (`@typescript-eslint/…`) | Errors |
|---|---|
| `dot-notation` | 114 |
| `no-non-null-assertion` | 91 |
| `restrict-template-expressions` | 67 |
| `no-unsafe-member-access` | 40 |
| `require-await` | 34 |
| `no-unsafe-assignment` | 34 |
| `no-confusing-void-expression` | 22 |
| `no-invalid-void-type` | 17 |
| `no-unnecessary-condition` | 14 |
| `no-unnecessary-type-assertion` | 11 |
| `no-unsafe-argument` | 7 |
| `no-unused-vars` | 7 |
| `no-unsafe-return` | 6 |
| `no-empty-function` | 5 |
| `prefer-regexp-exec` | 4 |
| `no-duplicate-type-constituents` | 4 |
| `no-base-to-string` | 3 |
| `non-nullable-type-assertion-style` | 3 |
| `array-type`, `no-unnecessary-boolean-literal-compare`, `prefer-optional-chain`, `no-dynamic-delete` | 2 each (8) |
| `no-unnecessary-type-conversion`, `use-unknown-in-catch-callback-variable`, `prefer-nullish-coalescing`, `no-unsafe-call`, `no-require-imports`, `no-inferrable-types` | 1 each (6) |
| **Total** | **497** |
