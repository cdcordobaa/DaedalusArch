# v1.4 Gemini generator adapter: recorded dry run (U5, decision CDX)

**Scripted runner, no model call, not a measurement.** No `agy` process ran and nothing left the machine. The Gemini
generator is **not yet through its S4 probe** (`Docs/v1.4/gemini-s4-probe-spec.md`); this run only shows that the
adapter plugs into the real loop harness.

```text
npx tsx scripts/v1.3/gemini-adapter-dry-run.ts [--out results/v1.4-gemini-adapter-dry-run]
```

What ran (`scripts/v1.3/lib/gemini-adapter-dry-run.ts`):
- the real `runLoopGrid` with the real `GeminiStepAgent` (`scripts/lib/loop/agents.ts`), the plan's `gemini` block
  validated by `validatePlan`, and the config built by `agyGenConfigFromPlan`;
- a scripted `ProcessRunner` that answers `agy --version`, writes the stub generator's files (`demoStubScript`, the
  Clean stub layout: the loop harness has no Layered style, design R14) and prints a canned stream-json run;
- the stub evaluator and type-check, 2 demo tasks × {`none`, `daedalus-mcp`} × 1 run × k = 3, with `--call-log` on;
- out-root, harness root, work directories and both generator homes in one OS temp scratch directory (so the ancestor
  check saw no `.git`), removed afterwards.

What `summary.json` shows:
- **S4 guard**: the synthetic fixture `tests/fixtures/agy-gen-cli/s4-result.synthetic.json` is refused without
  `allowSynthetic` (`LOOP_GEMINI_S4_SYNTHETIC`) and accepted with it (the dry run only).
- **Probe**: one `agy --version` call, matched against the pin.
- **argv** per arm: the exact flag set, the prompt never in argv (`promptOnStdin: true`).
- **Turns**: 12 turns, all `completed`; the model check (`init.model` = the pin) holds on every turn. The stub plants
  one blocking finding at step 2, which steps 2 and 3 carry (no gate arm here).
- **env**: variable names only (`AGY_CLI_DISABLE_AUTO_UPDATE`, `HOME`, `LANG`, `PATH`, `USER`): the parent's
  `GEMINI_API_KEY` and `FOO_TOKEN` were removed.
- **Homes**: the settings with the exact per-run allow list (the run's type-check command; the nine spec-only tools in
  `daedalus-mcp`) and the deny list; the `none` home has no MCP config; the `daedalus-mcp` MCP config carries
  `--project <cwd>` and `--call-log`. The rule syntax is UNVERIFIED until S4 (G1, G5, G6, G8, G9).
- **Call log**: no MCP server ran, so every `daedalus-mcp` step has `logFound: false` (the scripted MCP step is a
  stream event only).

Paths are placeholders (`<cwd>`, `<H>`, `<spec>`, `<server-entry>`, `<node>`, `<out-root>`, `<home-none>`,
`<home-mcp>`); a test (`tests/unit/scripts/loop/agents-gemini.test.ts`) runs the same function and asserts that the
summary holds no absolute path and no environment value.
