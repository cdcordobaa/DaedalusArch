# Build and Test live-call ledger (v1.2E, BT-F)

> **Path**: `Docs/DiagnosticRuns /` (trailing space, DV-BT-7). **Owner**: Build and Test lane (`v1.2e-build-and-test`). **Opened**: 2026-10-08 (Step 34).
> **Rule**: updated after every live run from the recorded cassette entries (`attempts` field) or the probe output. A retry counts as a call (BR-U4-CAS-06). A step that would cross a cap does not start.
> **Counting convention (DV-BT-F1)**: every live `claude -p` spawn under the judge config dir counts as a judge call, including the one stream-json init probe that `checkJudgeIsolation` runs before the first call of each record-mode run (BR-U4-ISO-06). `claude --version` spawns are not model calls and are not counted.

## Preflight (Step 34, zero live calls)

| Check | Result |
|---|---|
| `claude --version` vs `PINNED_CLI_VERSION` (BR-U4-ISO-09) | `2.1.294` = `2.1.294` (pass) |
| Judge config dir placement (`configDirPlacementProblem`, ISO-04) | none (outside the project tree) |
| Judge config dir listing vs the ADR-018 allow-list (`checkConfigListing`) | pass, 0 failures; 14 allow-list items matched (names only: `.claude.json`, `.last-cleanup`, `.last-update-result.json`, `backups`, `backups/.claude.json.backup.*`, `cache`, `cache/**`, `projects`, `projects/*`, `projects/*/memory`, `sessions`, `sessions/<digits>.*.key`, `sessions/<digits>.json`, `settings.json`) |
| Judge child env auto-update switch | `DISABLE_AUTOUPDATER=1` set in the child by `JUDGE_ENV_SET` (ADR-018 item 4) |
| Author-install auto-update switch (U4 §7 row) | **AUTHOR ACTION open**: `DISABLE_AUTOUPDATER` is not set in the author shell environment; the author's own `~/.claude` settings were not read (task secrets rule), so the install-level switch is unverified |
| ADR prose (`adrProse`, U4 §7 row) | no registered spec supplies it: the spec grammar has no ADR-prose field and no caller sets `RouterInput.adrProse`; the only occurrence outside `src/` is the token budget `adrProse: 1000` in `corpus/frozen-instrument.json`. The `## ADR context` prompt section is therefore always absent: **declared limitation**, no code change (wiring it would change the instrument before the freeze) |

## Judge (cap 40, retries included)

| # | Date | Step | Run | Calls (attempts) | Running total |
|---|---|---|---|---|---|
| — | 2026-10-08 | 34 | preflight (no live call) | 0 | 0 |

## Generator (cap 11 sessions + 3 retries; not judge calls)

| # | Date | Step | Run | Sessions | Retries | Running total |
|---|---|---|---|---|---|---|
| — | 2026-10-08 | 34 | preflight (no live session) | 0 | 0 | 0 |
