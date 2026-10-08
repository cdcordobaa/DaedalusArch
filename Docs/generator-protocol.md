# Generator protocol (DRAFT)

> **Status: DRAFT** (U5a Code Generation, Step 23, 2026-10-08; D-U5a-10). Freeze after the pilot (one generation per level under `<outRoot>/pilot/`, `business-logic-model.md` §5.3 step 4): the live confinement result, the model-usage probe envelopes, the final template hashes and the freeze date are added in Build and Test, before E1 or the FR-28 acceptance cell. The template hashes below are those of the committed templates; the hash test (`tests/unit/scripts/generators/prompt.test.ts`) keeps this table and the files equal. Requirements: FR-v1.2E-28, SECURITY-10, SECURITY-11 (ADR-017 item 8), NFR-v1.2E-08; rules BR-U5a-41..52.

## 1. Invocation (BR-U5a-41)

One Claude Code headless call per generation, run by `scripts/generate-projects.ts --plan <plan.json>` through `ProcessRunner` (no shell). Exact argument set, in this order (`buildGeneratorArgs`):

```text
-p <instantiated prompt> --model <pinned full model id> --output-format json --safe-mode --restricted
--tools Read,Write,Edit,Glob,Grep,Bash
--allowedTools Bash(<H>/bin/tsc --noEmit --incremental false -p <H>/runs/<runId>/tsconfig.json)
--disallowedTools Write(node_modules/**) Edit(node_modules/**)
--permission-mode acceptEdits --permission-prompts none --no-session-persistence --strict-mcp-config
```

The allow rule is one exact command with no wildcard. Never `--bare`, `--add-dir` or `--dangerously-skip-permissions`; `--max-budget-usd` is not used. `cwd` = `<outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/`, a fresh directory outside the repository; `<H>` (`harnessRoot`) is absolute, outside the repository and outside every `cwd`. `runId` = `<modelId>/<taskId>/<specLevel>/run-<i>`. Pinned model ids and `orderSeed` come only from the plan file.

**No-Bash fallback (Q13 B; BR-U5a-43).** If any live confinement probe fails (`scripts/generator/probes/confinement-cli.ts`, five probes: escape write, `node_modules` overwrite, tsc flag injection, command chaining, allowed command runs), the plan file sets `allowBash: false` before any generation: `--tools Read,Write,Edit,Glob,Grep` and no `--allowedTools`. Live result: _TBD at the freeze_.

## 2. Child environment (BR-U5a-44)

Allow-list through C10 `buildChildEnv`: `HOME`, `USER`, `LOGNAME`, `PATH`, `SHELL`, `LANG`, `LC_ALL`, `TERM`, `TMPDIR`. Removed by name whatever the list says: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` and every `*_TOKEN` / `*_KEY`, so the subscription login is used (D-1).

## 3. Pinned per-run tsconfig (BR-U5a-42)

Written by the harness to `<H>/runs/<runId>/tsconfig.json` (`<cwd>` absolute). The type-check of record runs `<H>/bin/tsc` (a launcher of the skeleton's pinned typescript) with this file, never a binary in `cwd`:

<!-- harness-tsconfig -->
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": [
      "ES2022"
    ],
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "incremental": false,
    "typeRoots": [
      "<cwd>/node_modules/@types"
    ],
    "types": [
      "node"
    ]
  },
  "include": [
    "<cwd>/src/**/*.ts"
  ]
}
```

## 4. Skeleton (BR-U5a-45; SECURITY-10)

`scripts/generator/skeleton/package.json` (sha256 `07b7eb5a78465ba3f4df35c05048e1ab7b106ee778c7cda8ff6a8d112cc80094`) and its own `package-lock.json` (sha256 `cc7900c79c6cf626be9ae79433fc99da96762a5228086067ce557ab9ccb2b523`; lockfileVersion 3, every package from registry.npmjs.org, no install scripts). Pinned versions:

| Package | Version |
|---|---|
| `@types/express` | 5.0.6 |
| `@types/node` | 22.19.15 |
| `express` | 5.2.1 |
| `typescript` | 5.9.3 |

Installed once under `<H>/skeleton-install/` with `npm ci --offline --ignore-scripts` (the npm cache warmed once from the registry when cold, recorded), then `chmod -R a-w`; the install hash (sorted `path, size, sha256` listing) is recorded in `<H>/skeleton-install.json`. Each `cwd` gets a copy of `package.json` and a `node_modules` symlink to the install. Install hash of record: _TBD at the freeze_.

## 5. Prompt templates (BR-U5a-52)

`scripts/generator/prompts/<specLevel>.md`, one template per task section (`<!-- task: <taskId> -->`), `promptTemplateId` = `<specLevel>/<taskId>`. Every template = the task brief, the shared folder-layout sentence (`src/domain`, `src/application`, `src/infrastructure`), the shared environment paragraph (available packages, no network, no npm, the compiler options in prose, and the line `{{TYPECHECK_COMMAND}}`), then the level block: none for `none`; about 140 words of prose from `presets/clean-architecture.yaml` (every layer and role, dependency direction, no rule id, no number) for `minimal-prose`; the preset verbatim for `full-aac`. The placeholder is replaced by the exact allowed command of §1; each outcome records `promptTemplateSha256` and `promptSha256` (sha256 of the instantiated prompt), and re-instantiating the template with the recorded `harnessRoot` and `runId` reproduces `promptSha256`. Distinctness is checked on the templates by `tests/unit/scripts/generators/prompt-distinctness.test.ts`.

| Level | Task | Template sha256 |
|---|---|---|
| none | task-management | `51a3a0bceb8319019b26d95bdc85997f55440952ef66ab0fd1dbb753636b7cda` |
| none | order-fulfilment | `f0f1ef1fe59b600105db8b76a8dc9aa84f797558dc0c7876ae2fc6994addd072` |
| minimal-prose | task-management | `c837212d545422a334476c1b692693945ffecb115b7740ac1c171ee361e6d25f` |
| minimal-prose | order-fulfilment | `6724563a4f48e5ab3609a98113f80266dfd532d0c1317957940d79b46c2cbc63` |
| full-aac | task-management | `60b54da5e03e8b362b365784ce4cf28b04ea3a90cdd8a1d36015e275b07ef246` |
| full-aac | order-fulfilment | `07b3997a8ac194b275288f6d252d99d966d07a259a7ae88f2a34af688b2f3e40` |

| Template file | File sha256 |
|---|---|
| `scripts/generator/prompts/none.md` | `cc49003c5384c6f5f65f40d688082a1a1334662756994a32d139ec82b6245895` |
| `scripts/generator/prompts/minimal-prose.md` | `7d7a78a922fe345dce479e24991a4669d8f0257e555526be4d69632e69c6563c` |
| `scripts/generator/prompts/full-aac.md` | `a24e088d446f2e282bb8449b249c8fe69aa8973eddb0c92ea46f137e38e1c10d` |

## 6. Envelope and model-usage rule (BR-U5a-46, 47)

The JSON envelope is read tolerantly (`is_error`, `subtype`, `num_turns`, `permission_denials`, `total_cost_usd`, `duration_ms`, `session_id`, `modelUsage`; a missing field is absent, never fatal) and stored after `scrubDeep` as `envelope.json` beside the tree. **Model-usage rule (pre-registered; unchanged after E1 starts):** a run is model-valid when the pinned id is a key of `modelUsage` and its output tokens are strictly larger than every other key's (a tie is not the largest share); every other key is recorded in `auxiliaryModels[]` and does not fail the run; otherwise `failed-agent`, reason `model-mismatch`. Sonnet and Opus probe envelopes with Bash enabled: _TBD at the freeze_ (`Docs/DiagnosticRuns/u5a-model-usage-*`).

## 7. Status order (BR-U5a-48; `business-logic-model.md` §5.2)

| Order | Condition | Status | `failureReason` |
|---|---|---|---|
| 1 | Infrastructure failure after 2 retries | `failed-agent` | `infrastructure` |
| 2 | Runner timeout with files written | `failed-agent` | `timeout` |
| 3 | stdout not JSON | `failed-agent` | `envelope-unreadable` |
| 4 | `skeletonIntact` false | `failed-agent` | `skeleton-tampered` |
| 5 | Model-usage rule fails | `failed-agent` | `model-mismatch` |
| 6 | `is_error` true | `failed-agent` | `agent-error` |
| 7 | Type-check errors > 0 | `failed-typecheck` | `typecheck` |
| 8 | otherwise | `ok` | — |

Skeleton integrity, the model-usage rule and the type-check of record are evaluated for every run that produced an envelope, whatever row decides. `fileCount` = `.ts` files under `<cwd>/src`; `fileCountInRange` = 20 ≤ count ≤ 100, flagged, never discarded. `generation.json` is written beside the tree; `treeSha` is the git tree sha of the generated tree (skeleton `node_modules`, `.git`, `generation.json` and `envelope.json` excluded). Failed generations are recorded and never replaced (BR-U5a-49).

## 8. Retries, usage limits, timeouts (BR-U5a-50)

- Per-call timeout `timeoutMs`, default 20 min.
- A usage or rate limit (an erroring call whose envelope result, subtype or output names a usage limit, rate limit or 429) consumes no attempt: the directory moves to `<outRoot>/interruptions/<runId>/<n>/`, listed in `interruptions[]`; the grid pauses until the reported reset plus 60 s (30 min when no reset is reported) and resumes the same cell; after 48 interruptions of one cell the grid stops.
- Infrastructure failures (spawn failure, timeout with zero files, exit before the first turn) are retried at most twice, after 30 s and 120 s, each in `attempts[]`; then `failed-agent`, reason `infrastructure`.

## 9. Grid order (BR-U5a-51)

Cells are blocked by run index; block r holds every (model, task, level) cell for run r in an order drawn from `orderSeed` with mulberry32 (one generator, consumed block by block); block r + 1 starts after block r. The schedule is written to `<outRoot>/schedule.json`. E1 = 3 models × 2 tasks × 3 levels × 3 runs = 54 (18 per block). Pilot outputs live under `<outRoot>/pilot/` (`pilot: true`) and are never joined into `so5_grid.csv`.
