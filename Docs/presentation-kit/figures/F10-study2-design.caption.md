# F10 · study2-design

**Title on slide:** Study 2 design: the firewall in the loop

**What it shows.** The three arms (rows) over successive feature steps (columns). In every arm each step is an agent turn followed by a snapshot point S (snapshot outside the agent's working folder, type-check, firewall score). In `daedalus-mcp` the agent can query 7 spec-only MCP tools during the step. In `gate`, a step with blocking findings triggers one repair turn (red) and the step's outcome is the post-repair snapshot. Below: the outcome and the working grid.

**One idea.** Study 2 asks whether feedback during generation slows architectural erosion across steps.

**Sources.** `Docs/v1.3/study2-outline.md`: §2 (a run is one model, task, arm, replicate; steps share the project directory; snapshot after every step), §3 (arms; the 7 tools `check_file`, `check_diff`, `suggest_placement`, `which_layer`, `check_import`, `explain_violation`, `get_architecture_spec`; gate: at most 40 findings, one repair turn), §4 (outcomes), §6 (working grid: 6 tasks × 2–3 models × 3 replicates × 3 arms; 54 blocks → 162 runs; d_z ≈ 0.42 with 54 blocks, 0.51 with 36). Outcome switch: `Docs/v1.3/pilot-outcome-memo.md` §5.

**Caveats to say.** Informal outline: every number is a working guess, nothing is pre-registered, Study 2 is not run in v1.3, and its tasks are sealed (not named here).
