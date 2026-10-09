# Judge Pre-registration (U4 neural path)

> **Status: FROZEN 2026-10-09** (Build and Test Step 44; BR-U4-RUB-01, POL-01, SEN-01). BR-U4-SEN-01 passed for both neural functions by the unit-level criterion: FF-N01 on 2026-10-08 (`eec1e72`, live cassettes `tests/fixtures/judge-cassettes-live/correct-reference/`) and FF-N02 on 2026-10-09 (`bbc9526`, 35 calls with the pinned CLI `2.1.294`, ADR-022 item 5). The rubric text did not change after either run, so `FROZEN_SHA256` stays `f8b2dabb…eac5a` (`src/llm-critic/frozen.ts`, asserted by `tests/unit/llm-critic/frozen.test.ts`) and RUB-03 is not re-run. The freeze is dated after the passing SEN-01 runs and before the first `experiments/*/cassettes` commit or any measured full-mode run (BR-U4-POL-01). From here on a value changes only as a registered ladder step (BR-U4-OPS-04, `Docs/threats-to-validity.md` §4) or through a new dated ADR with a full re-record.
>
> Until 2026-10-09 this file read: **Status: DRAFT until BR-U4-SEN-01 passes.** None of the lines below is frozen yet. The freeze commit (the BR-U4 §11 table plus `src/llm-critic/frozen.ts`) must be dated after the passing SEN-01 run and before the first `experiments/*/cassettes` commit (BR-U4-POL-01). After the freeze, a value changes only through a dated ladder line (BR-U4-OPS-04) or a new dated ADR with a full re-record of every affected experiment.

Sources: U4 functional design `aidlc-docs/construction/v1.2E-u4-neural-path/functional-design/business-rules.md` §1, §9 and §11; ADR-017 item 9; ADR-018; the U4 code-generation plan, Step 6 Done note (Gate H).

## Instrument

| Item | Value | Rule |
|---|---|---|
| Judge model | `claude-opus-5-5`, actual-model rule (the resolved `modelUsage` key and init `model` must equal it) | BR-U4-VRD-07, VRD-09 |
| Effort | `high` (frozen 2026-10-09). Pre-freeze timing probe: `high` median `duration_ms` 6570, `medium` 5736, over five prompts of 2.2k–19.3k characters. Switching to `medium` is possible before the freeze, and afterwards only as ladder step 3 | BR-U4-OPS-01, OPS-04 |
| Claude CLI version | `PINNED_CLI_VERSION` = **2.1.294**. Record mode stops before any call on a `claude --version` mismatch (`LLM_CLI_VERSION_DRIFT`) | BR-U4-ISO-09; ADR-018 item 4 |
| Auto-update switch | Environment variable `DISABLE_AUTOUPDATER=1`. It is in `JUDGE_ENV_ALLOW` and is set in the judge child env. The judge config dir's `settings.json` may hold only `theme` and `env.DISABLE_AUTOUPDATER` | BR-U4-ISO-09; ADR-018 items 3, 4 |
| Auto-update on the author's install | **Open (AUTHOR ACTION)**: the switch has not been applied to the author's global install yet. It must be applied before the first measured run | BR-U4-ISO-09 |
| Isolation | Dedicated `CLAUDE_CONFIG_DIR`; frozen argv with `--tools ""`; structured output from `structured_output`; per-run init probe and config-dir allow-list. The allow-list is ADR-018's: `plugins/` is forbidden, and `projects/*` and `projects/*/memory` may exist only as empty directories | BR-U4-ISO-02..06; ADR-018 items 1, 2 |
| Error classification | `is_error` plus result text, never `subtype`. The `USAGE_LIMIT` patterns stay unverified until a natural sample is seen | ADR-018 item 5 |
| Every other frozen parameter | The BR-U4 §11 table, referenced and not copied here, so there is a single source | BR-U4-POL-01 |

## Degradation ladder (BR-U4-OPS-04, frozen with the rest)

1. Reduce the reliability sub-study to repetitions 0 and 1, on the fixtures only.
2. E7 `unitCap` 20 → 10, for both functions, on every E7 project.
3. Effort `high` → `medium`, with a full re-record of every experiment recorded at `high`.

The governing rules of this ladder (allowed steps, trigger, timing, scope, record) are registered in `Docs/threats-to-validity.md` §4 (ADR-021, THR-9); this file keeps the dated lines. The ladder is triggered only by measured calls per usage window, compared against the pre-run volume estimate. A step is decided at a usage-window boundary, before any affected score is viewed, and is applied to a whole experiment. Each applied step gets a dated line below, older than the first run it affects. The judge model, `runsPerEvaluation`, the rubric, the E1 `unitCap` and the aggregation thresholds never change mid-study.

## Probe record (Part 2, OI-U4-1)

- Probe date: 2026-10-08. Gate H passed on H1–H5. The ISO-04 conflict was settled by ADR-018.
- Committed fixtures, in `tests/fixtures/claude-cli/`:
  - Scrubbed probe set: `envelope-schema-tools-off.json`, `envelope-schema-tools-on.json`, `envelope-noschema.json`, `init-clean.json`, `init-tools-off.json`, `init-tools-on.json`, `auth-error.json`, `rate-limit-event.json`, `canary-result.json`, `timing.json`, `config-allowlist.json`, `probe-values.json`.
  - Derived ISO-06 negatives: `init-extra-tool.json`, `init-mcp.json`, `init-other-model.json`, `init-apikey.json`.
- `config-allowlist.json` is the raw probe observation. The binding allow-list is ADR-018's.
- Canary residual: the ancestor-`CLAUDE.md` channel was positively controlled. The user-level `CLAUDE.md` and hook channels were not, and are repeated in Build and Test (ADR-018 item 6).

## Dated lines

_None yet. The freeze line, any ladder step and any pin move are appended here, each with its date._
