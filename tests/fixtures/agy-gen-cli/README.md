# agy generator fixtures (synthetic)

SYNTHETIC, HAND-WRITTEN fixtures of the Gemini generator adapter (U5, decision CDX;
`aidlc-docs/construction/v1.4/U5/functional-design/design.md` Part B). They are modelled on the event shapes of the
labeller probe fixtures in `tests/fixtures/agy-cli/` (`init`, `step_update`, `result`), but they are NOT probe output:
no agy process produced them and no model was called. Placeholders: `<UUID>`, `<CWD>` (the turn's cwd), `<H>` (the
harness root), `<RUN>` (the loop run id), `<TYPECHECK>` (the run's exact type-check command).

- `stream-gen-completed.ndjson`: write steps, the type-check command, then finish (the `none` arm).
- `stream-gen-mcp-completed.ndjson`: a spec-only MCP call, a write, then finish (the `daedalus-mcp` arm).
- `stream-gen-model-mismatch.ndjson`: `init.model` differs from the pin.
- `stream-gen-print-timeout.ndjson` + `.stderr.txt`: exit 0, SUCCESS, an empty answer and the stderr timeout line.
- `stream-gen-denied-tool.ndjson`: a denied command (state ERROR), then a write (not an escape).
- `stream-gen-tool-escape.ndjson`: a COMPLETED `read_url_content` step (the grid stops).
- `stream-gen-usage-limit.ndjson`: an erroring call with a quota text (the usage-limit patterns are UNVERIFIED for agy).
- `gen-settings-none.json`, `gen-settings-mcp.json`: generator home settings as the harness writes them (U12,
  2026-10-19: only the seven real agy action kinds; `<TYPECHECK_RULE>` is the anchored `command(regex:^...$)` rule of
  the run's type-check). The PreToolUse hook is the first confinement layer; these rules are the second. Round 4
  (2026-10-20): `unsandboxed(*)` dropped (agy 1.4.2 logs it as invalid and ignores it). A turn written for a real
  `daedalus-mcp` home also allows `read_file(<home>/.gemini/antigravity-cli/mcp/daedalus-arch/<tool>.json)` for the
  nine allowed tools; these fixtures are checked without a home, so they do not list them.
- `stream-s4run3-g6-denied-network.ndjson`, `stream-s4run3-g8-subagent-denied.ndjson` (round 4): REAL agy 1.4.2
  stream lines from the third live S4 run (2026-10-20, `none` arm), sanitised (conversation ids replaced, paths as
  placeholders, the `init` tool list shortened). G6: four network calls, every one denied by the hook, the denied
  `npm install ... left-pad@1.3.0` parameters in the stream. G8: `invoke_subagent` as a `tool` record (ACTIVE) then a
  `subagent` record (ERROR) with the same step index, then a hook-denied `schedule`. Regression fixtures for the two
  scorer false positives of that run; with each, `hook-s4run3-g6.ndjson` and `hook-s4run3-g8.ndjson` (the run's hook logs).
- `s4-result.synthetic.json`: `"synthetic": true`, verdict pass; only the recorded dry run may use it (`allowSynthetic`).
