# Exploratory study plan templates (REV-05 §3; not Study 2, not registered)

**2026-10-19. Templates only. No model was called to write them, and nothing here has run.** The exploratory study is
the first study of REV-05 §3 and §6 item 1: estimands, no hypotheses, no Holm. Its cells are the drift record's three
(`Docs/v1.4/study2-deviation-2026-10-19-drift.md` §2), on the rehearsal tasks only (REV-05 §6 item 2), so the six
confirmatory tasks stay unseen.

| File | What it is |
|---|---|
| `tasks.json` | `ice-rink` (Layered) and `vineyard-harvest` (DDD), copied unchanged from `fixtures/v1.3-rehearsal-tasks/tasks.json` |
| `plan-L2.template.json` | Cells `none@L2` and `mcp@L2` (arms `none`, `daedalus-mcp`), frame L2 with the attention sentence |
| `plan-L3.template.json` | Cell `none@L3` (arm `none`), frame L3 with the attention sentence |

The rung is a plan-level setting (`frame.specRung`), so the three cells need two plans. Run both with `--call-log`
(gate D6) and give each its own `--out-root`.

**Hashes** (the rehearsal README §3 rule: the file, and `JSON.stringify(task)` per task):

| Item | sha256 |
|---|---|
| `tasks.json` | `690980d28ab12fb063ca3b1f8b222417881daa328fcadd590fde85dc04449bc1` |
| `ice-rink` | `71eb60fe441ba64f6a5c5cfce0a6c4abf0fe0355632bf9205260d46c243f054a` |
| `vineyard-harvest` | `71d1dd36422a2d425aa705cececbea98cdc492e4cb48b1d8bdad819c2199ad02` |

The per-task hashes equal those of the same tasks in the rehearsal file (unit test
`tests/unit/scripts/loop/exploratory-plan.test.ts`).

## Pin and isolation: ON

Both templates set `adapters[].cliVersion` and `generatorIsolation.claudeConfigDir: "<local>"`
(`Docs/v1.3/loop-isolation.md` §2). The grid then probes `claude --version` in the isolated environment before the
skeleton install and refuses a mismatch (`LOOP_CLI_VERSION_MISMATCH`), and every probe, step and repair turn runs
with an empty per-run `HOME`, the dedicated config dir and `DISABLE_AUTOUPDATER=1`.

## The author fills or confirms, before any run

1. **`cliVersion` `2.1.294`: author to confirm.** It is the judge's pin (`src/llm-critic/frozen.ts`
   `PINNED_CLI_VERSION`), used as a placeholder. Set it to the version installed, with auto-update off, on the machine
   that runs the study.
2. **`--claude-config-dir <abs>`**: the dedicated config dir, logged in once (`CLAUDE_CONFIG_DIR=<dir> claude`),
   outside the repository, the out-root and the real `~/.claude`.
3. **`daedalus` block** (L2 plan): the `/opt/daedalus/...` paths are placeholders. Point them at a build of the MCP
   server at the run commit, outside every cwd.
4. **`vineyard-harvest` spec**: the templates name the candidate static rehearsal spec
   `fixtures/v1.3-rehearsal-tasks/specs/vineyard-harvest.ddd.yaml` (`presets/ddd.yaml` constrained to `src/picking/` and
   `src/cellar/`, no aggregate declared; rehearsal README "Before any run" item 4). The author approves or replaces it;
   whether DDD runs with a static spec at all is D15. L3 and the per-task MCP spec both need it static.
5. **The shared start** (one step-1 tree per block, all cells branching at step 2) is not used by these templates:
   they run every cell from step 1. Since U13 (2026-10-20) the harness supports it (`sharedStart`); the Stage B
   templates that use it are in `stage-b/`.
6. The Gemini lane needs its own plan (a `gemini` block and a passing committed S4 result); it is not written here.

The templates assume the `layered` loop style and `taskProfiles` together with the `daedalus-mcp` arm (BUILD-L items
1 and 2).
