# Unit Test Instructions — DaedalusArch v1.2E

> **Supersedes** the v1.0 unit-test instructions (312 tests, U7). The earlier text stays in git history.
> **Cycle**: v1.2 Evaluation-Readiness, Build and Test (plan Step 8). **Date**: 2026-10-08.

## 1. Gate U — unit and integration tests

```bash
npm test                 # jest over tests/unit and tests/integration (tests/unit/scripts/** included)
```

| Measurement | Value | When |
|---|---|---|
| `U_BT` (entry baseline, `BT_BASE` `e9c24c4`) | 2864 tests / 199 suites, 0 failed | Build and Test Step 3 |
| After BT-A Steps 4–6 | 2888 tests / 201 suites, 0 failed (+5 OI-U4-8 reasons, +16 change-log / guard / prereg bump, +3 audit gate) | Build and Test Step 6 |

The expected count is `U_BT` plus the tests each later step names in its Done note. CI splits the same set into "Unit tests" (`npm run test:unit`) and "Integration tests" (`npm run test:integration`, 15 tests); the two numbers add up to the `npm test` total.

Useful subsets:

```bash
npx jest tests/unit/scripts/u5b          # U5b harness, scoring, guards, prereg, audit gate
npx jest tests/unit/golden               # change-log checker, normalisation, byte stability
npx jest tests/unit/scripts/mutation     # U5a operators, keys, U3 discriminators (BR-U3-66)
npx jest tests/unit/llm-critic           # U4 judge, cassettes, isolation (Mock and replay only)
```

No unit test makes a live LLM call: the judge runs through Mock providers and committed cassettes, and `guards.test.ts` fails if a test constructs the live Gemini provider (BR-U5b-44).

## 2. Gate B — test type-error budget

The tests are type-checked by a scratch configuration that is never committed (U0 Step 3 content):

```json
{
  "extends": "<REPO>/tsconfig.json",
  "compilerOptions": {
    "noEmit": true, "module": "CommonJS", "moduleResolution": "node",
    "verbatimModuleSyntax": false, "noUnusedLocals": false, "noUnusedParameters": false,
    "rootDir": "<REPO>", "typeRoots": ["<REPO>/node_modules/@types"], "types": ["node", "jest"]
  },
  "include": ["<REPO>/src/**/*.ts", "<REPO>/tests/**/*.ts"],
  "exclude": ["<REPO>/node_modules", "<REPO>/dist"]
}
```

```bash
npx tsc -p "$SCRATCH/tsconfig.tests-audit.json" > "$SCRATCH/gateB.txt" 2>&1
grep -c "error TS" "$SCRATCH/gateB.txt"     # <= B_BT = 80
grep -c TS2688 "$SCRATCH/gateB.txt"         # 0
```

`<REPO>` is the absolute path of the checkout or worktree being measured; `$SCRATCH` is a session scratch directory outside every checkout.

## 3. Gate L — lint ratchet

```bash
npm run lint 2>&1 | tail -1      # errors <= L_BT = 497 (2 warnings)
npx eslint --parser-options project:./tsconfig.scripts.json <new or edited scripts/** files>   # 0 errors (D-U5a-8)
```

The 497 errors are a recorded residual (per-rule counts in `Docs/DiagnosticRuns /bt-audit-triage.md`); CI keeps the lint step under `continue-on-error` (D-U0-16).

## 4. Reviewing and fixing failures

1. Re-run the failing file alone: `npx jest <path> --verbose`.
2. A failure in `tests/unit/scripts/u5b/guards.test.ts` means a forbidden path under `results/` or a live Gemini construction in a test; fix the change, not the guard.
3. A failure that needs a design or requirement change outside ADR-015..018 is escalated, not patched (plan §4 stop rule).
