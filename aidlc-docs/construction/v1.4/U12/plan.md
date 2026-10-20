# U12 code-generation plan: Gemini hook confinement

**The single source of truth for U12's Code Generation.** Depth: minimal. It is a fix unit on top of U5 Part B and U11.
The design is the coordinator's brief: a hook allow-list, correct rules and the sandbox. The coordinator requested it
on 2026-10-20 after the failed S4 run on agy 1.4.2. All steps ran in one session. Under the standing delegation, the
brief is the approval of scope.

**Unit context**
- Brownfield TypeScript repo. The generator: `scripts/lib/generators/agy-gen-cli.ts`, `agy-gen-events.ts`,
  `scripts/lib/loop/agents.ts`, `scripts/v1.4/lib/gemini-homes.ts`, `scripts/generator/probes/agy-gen-confinement*.ts`.
- Read: `Docs/v1.4/gemini-generator.md`, `Docs/v1.4/gemini-s4-probe-spec.md`,
  `Docs/DiagnosticRuns/v1.4-gemini-s4-agy142-2026-10-19.md`, `results/v1.4-gemini-s4-142/s4-result-summary.json`, the
  run-2 stream logs under the S4 out-root (outside the repo; read, not copied), https://antigravity.google/docs/permissions/
  and https://agenticcontrolplane.com/controls/antigravity.
- Constraints:
  - ZERO model calls. `agy --version`, `agy mcp list` and `agy plugin list` run only against a scratch HOME.
  - Nothing under `../daedalus-sealed/` is read.
  - `jest --maxWorkers=2`. `npx tsc --noEmit -p .` is clean, and so is ESLint on the changed files.
- Out of scope: the live S4 re-run, the homes' sign-in, any protocol line, merging.

## Decisions taken inside the brief (with evidence)

| Decision | Why |
|---|---|
| The command allow rule is `command(regex:^<escaped>$)`, not `command(<exact>)` | The brief said `command(<exact>)`. But in the run-2 streams, G3 and G4 show `<type-check> --tsBuildInfoFile ../x` and `<type-check> && touch ../chain-and.txt` completing under the old rule. The rule is a prefix rule (the docs' `command(prefix)`). The regex form is anchored. The hook stays the exact-match gate. |
| `read_file` and `write_file` are file tools (path-checked) next to the `init` names | The 1.4.2 stream reports file access under these names with a `Path` parameter. G2 and G7 were flagged as escapes only by name, although both paths were inside the work directory. |
| `daedalus-mcp`: the hook allows reading `<home>/.gemini/antigravity-cli/mcp/daedalus-arch/<allowed tool>.json` | G9: agy reads an MCP tool's schema there before it calls the tool. Without this allowance, the hook would block every MCP call. |
| The hook prints `{"decision":"allow"}` for allowed calls | The hook is the primary gate. Whether a hook allow overrides a permission deny is unknown. Either way the allow-list holds. The S4 re-run shows which applies. |
| The loop checks the agy version before it writes the turn files | agy 1.4.2 re-saves settings.json on exit. Checking it after `--version` read a pruned copy (PR #288, the same order). |
| `gemini-homes.ts --create` installs the hook files into existing homes and resets the harness-owned settings keys | The homes already exist and are signed in. The pre-turn probe now requires the hook files. |

## Steps

- [x] **Step 1. The hook.** `scripts/lib/generators/agy-confine-hook.mjs`. It is plain ESM with no dependencies. It
  exports the pure `decide`, `pathArgs`, `resolveReal`, `parseConfig` and `main`. The allow-list is in
  `Docs/v1.4/gemini-generator.md` "Confinement (U12)". The hook log takes one JSON line per decision. Any internal error
  exits 2 (fail-closed).
- [x] **Step 2. The turn writer.** It writes hooks.json (one PreToolUse group, matcher `".*"`, timeout 10 s, the
  command `'<node>' '<script>' '<config>'`), the copied script and the per-turn config: realpath work directory,
  type-check, arm, log path, MCP tools. These go next to the settings and the MCP config. The hook log must lie outside
  the cwd (`GEN_AGY_HOOK_LOG_INSIDE_CWD`). The loop's log is `<H>/runs/<runId>/hooks/<turnId>.jsonl`.
- [x] **Step 3. The permission rules (layer 2).** They use only the seven real action kinds. The non-existent entries
  are removed (dated comment on `AGY_GEN_DENY`). The settings fixtures and their README are updated.
- [x] **Step 4. The home check and G0.** `checkAgyHook` is part of `checkAgyGenHome`: hooks.json must be exact (the
  only exempt hooks name), the script sha256 must equal the committed one, and the turn config must be valid. Per turn
  it must also name this turn's work directory, command and MCP tools. G0 still checks the home before any agy
  command. It then records `hooks: { loaded: seen|unverified, rewrittenByAgy }`.
- [x] **Step 5. The S4 evidence.** Each call gets a hook log. A verdict carries `hookDecisions` and fails on
  `hook-not-invoked` or `hook-error`. The G1 and G2 attempt lists accept `write_file` and `sed_file`. The stop rule
  path-checks completed file steps.
- [x] **Step 6. The sandbox (layer 3).** `--sandbox` and `enableTerminalSandbox: true` are unchanged and still checked.
- [x] **Step 7. The dry runs.** Before every scripted tool step, the scripted S4 agy runs the home's real hook (the
  hooks.json command through `/bin/sh -c`). The adapter and turn dry runs install the baseline hook files.
- [x] **Step 8. Tests.** These are new:
  - `tests/unit/scripts/generators/agy-confine-hook.test.ts`, which covers the decision function and the hook process;
  - new blocks in `agy-gen.test.ts` (the writer, the home check, the rules, the stop rule);
  - new blocks in `agy-gen-s4.test.ts` (the dry run with the hook, G0 order, hook-not-invoked, the homes `--create`, the
    G0 sub-check).

  These were adjusted: `agents-gemini.test.ts` (fixture `<CWD>` is the real cwd; baseline hooks installed).
- [x] **Step 9. Docs.**
  - `Docs/v1.4/gemini-generator.md`: the status, "Confinement (U12)" and the re-run runbook.
  - `Docs/v1.4/gemini-s4-probe-spec.md`: the status line.
  - The declared change `Docs/v1.4/gemini-confinement-change-2026-10-20.md`.
  - The `aidlc-docs/audit.md` entry.
- [x] **Step 10. Zero-call check of hook loading.** `agy --version`, `mcp list` and `plugin list` ran with a scratch
  HOME that held a hooks.json. agy printed no hooks line and wrote no log file, so the G0 sub-check records
  `unverified`. The per-call `hook-not-invoked` check is the enforced test. One process breach: early in the session,
  one bare `agy --version` ran against the user's own HOME instead of a scratch HOME. It made no model call, and its
  only output was `1.4.2`.

## Code summary

| File | Change |
|---|---|
| `scripts/lib/generators/agy-confine-hook.mjs` (new) | The PreToolUse hook. It exports `decide`, `pathArgs`, `resolveReal`, `parseConfig` and `main`, writes one JSON log line per decision, and exits 2 on any internal error. |
| `scripts/lib/generators/agy-gen-cli.ts` | Real action kinds only (dated comment on `AGY_GEN_DENY`). `commandAllowRule`. `expectedDeny` per arm. The hook constants and `AgyHookTurnConfig`. `agyHooksJson`, `installAgyHook`, `installBaselineAgyHooks`, `hookTurnConfig`, `checkAgyHook` (inside `checkAgyGenHome`, which now takes `hookSource`), `readAgyHookLog`, `hookDecisionCounts`, `agyMcpSchemaFiles`. `AgyGenCliConfig.hookSource`. The writer installs the hook. `read_file`, `write_file` and `sed_file` are file tools. |
| `scripts/lib/generators/agy-gen-events.ts` | `StopContext.workDir` and `mcpSchemaFiles`: the stop rule is path-aware for completed file steps. |
| `scripts/lib/loop/agents.ts` | Version pin before the turn files. Hook log `<H>/runs/<runId>/hooks/<turnId>.jsonl`. Path-aware stop context. |
| `scripts/v1.4/lib/gemini-homes.ts` | `--create` installs the hook files in new and existing homes and resets the harness-owned settings keys (`hookInstalled`). |
| `scripts/generator/probes/agy-gen-confinement.ts` | A hook log per call. `hookDecisions`. `hook-not-invoked` and `hook-error`. G0 `hooks` sub-check (`hooksLoadedEvidence`). The 1.4.2 names in the G1 and G2 attempt lists. |
| `scripts/generator/probes/agy-gen-confinement-dry-run.ts` | Runs the home's real hook before each scripted tool step. |
| `scripts/v1.3/lib/gemini-adapter-dry-run.ts`, `scripts/v1.4/lib/gemini-turn-dry-run.ts` | Install the baseline hook files. |
| `tests/fixtures/agy-gen-cli/gen-settings-{none,mcp}.json`, `README.md` | The corrected rules. |
| `results/v1.4-gemini-s4-dry-run/s4-result.synthetic.json` | Re-recorded: synthetic, with hook decisions and the G0 sub-check. |

**Tests.** New: `agy-confine-hook.test.ts` (13), plus 6 in `agy-gen.test.ts` and 6 in `agy-gen-s4.test.ts`. Adjusted:
`agents-gemini.test.ts`. The Gemini and generator suites (7 suites, 99 tests) pass.

The full suite (`--maxWorkers=2`) fails in 33 suites. Every failure comes from the worktree's empty `node_modules`
(`.bin/tsx` and `typescript/lib/tsc.js` are missing) or from one jest worker that crashed with SIGSEGV. None of them
touches the changed code. `u5b/imports.test.ts`, re-run alone, passes.

`tsc --noEmit -p .` and `-p tsconfig.scripts.json` are clean. ESLint is clean on the changed script files. On the
changed test files it reports only `no-unsafe-call` and `no-unsafe-member-access` on Jest's `expect`, which this
worktree does not resolve. Unchanged test files report the same.
