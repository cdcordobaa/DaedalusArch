# Edit gate: architecture findings after every edit (v1.5-exp)

**Exploratory (v1.5-exp), DEV split, NOT Study 2b.** Design: `ops/notes/v15-edit-gate-design.md` (DRAFT). Build report:
`Docs/DiagnosticRuns/edit-gate-build-2026-10-23.md`. Nothing under `src/`, `presets/`, `scripts/lib/` or `scripts/v1.3/`
changes. The checks are DETECT-02's `check_consistency` (R-D4, R-XCTX), imported read-only.

**What it does.** After every agent `Edit`, `Write` or `MultiEdit`, the checks run on the work tree. Only **new**
findings appear next to the tool result, like a compiler error. A **Stop** hook shows any findings still open, once per
turn. The agent does not decide to call anything.

## Parts

| File | Runs as | Role |
|---|---|---|
| `gate-relay.cjs` | generator user | The hook command. Sends the hook's stdin JSON to the hub's socket and prints the reply. Fails open: on an error, or after 8 s, it prints nothing |
| `hub.ts` | root | The hub. For the current cell only, it runs `check_consistency` on the whole tree with the root-only spec. It keeps findings that involve a file changed since the seed, de-duplicates them, and replies with the hook JSON. It logs one line per event to `<logDir>/<cell>.gate.jsonl` |
| `gate.ts` | (pure) | Finding keys, the per-session de-duplication, the message text, the hook replies and the work-tree path check |
| `settings.ts` | (pure) | The arm's `--settings` JSON and argv: the frozen `buildGeneratorArgs` with one value replaced |
| `run-edit-gate.ts` | root | The driver: `--dry` (zero calls), `--smoke` (1 call), `--probe` (1 call), `--sessions` (a puzzle run) |
| `setup-sandbox.sh` | root | The build smoke's sandbox layout: generator user, `/srv`, canaries, input file, the clone closed |
| `test/unit.ts` | root | Unit tests, zero calls |
| `test/fake-api.ts` | root | A scripted stand-in for the Messages API. With it, the real CLI runs the hooks at zero model calls |
| `fixtures/dummy/` | — | A dummy project (a copy of the DETECT-02 precision fixture P10, not puzzle material), its spec, and one violating edit |

### The message

```
Architecture check: src/billing/application/SettleInvoices.ts:9 [one aggregate per command; cross-context write]
Rule: …
Why: …
Write: <file:line> <store method>(…) via <call chain>
Fix: …

If you are in the middle of a change, finish it; the check runs again after each edit.
```

- At most 12 lines per finding and 3 findings per message; any more become `… and N more`.
- A finding that disappears gets one line: `resolved: <file>:<line> [<rule label>]`.
- The CLI places the text next to the tool result as `PostToolUse:Write hook additional context: …`.
- The Stop hook replies `{"decision":"block","reason":…}`. The agent then sees `Stop hook feedback: Architecture check:
  N findings still open in the code you changed. …`, then the findings.

### De-duplication

The finding key is rule | command file | command name | aggregates. The key has no line number, so a line shift keeps
the key.
- An edit shows only keys that have not been shown yet.
- A key that stays is not repeated, except by the Stop hook.
- A key that disappears is reported once, as resolved. If it comes back later, it counts as new again.
- The Stop hook blocks at most once per turn, and never when `stop_hook_active` is set.

### Confinement

- The hook runs as the generator user. It reaches only the socket.
- The hub refuses each of these, with no reply and without running the check:
  - a `file_path` outside the work tree, with symlinks resolved first;
  - a path inside `node_modules`;
  - a tree that holds a symlink pointing out of the work tree, because the root-side checker would follow it;
  - any tool other than Edit, Write or MultiEdit;
  - any other hook event;
  - an event that arrives while no cell is current.
- The hub drops `transcript_path`. It never replies with the spec path or the spec text.
- The hub logs a gaming flag when the agent creates DETECT-02's allowance overlay `detect02.allow.yaml` in its tree.
- Settings come only from `--settings`; `--setting-sources ""` stays. So a `.claude/settings.json` the agent writes is
  ignored. In the smoke, CLI 2.1.308 also refused the write itself.

## Exploratory difference from the baseline (recorded)

The baseline's customizations-off flags (`GENERATOR_CUSTOMIZATIONS_OFF`, `scripts/lib/generators/argv.ts`) include
`--settings {"autoMemoryEnabled":false,"disableAllHooks":true}`. **This arm replaces that one value** with
`{"autoMemoryEnabled":false,"disableAllHooks":false,"hooks":{…}}`. The value turns hooks on and names exactly the gate's
two hooks: PostToolUse with matcher `Edit|Write|MultiEdit`, and Stop. Each hook runs `<node> /srv/h/bin/gate-relay.cjs
/srv/m/g.sock` with a 10 s timeout.
- Every other argv element is byte-identical to the frozen argv (unit test "argv").
- `--setting-sources ""` stays.
- `--disable-slash-commands` stays.
- No MCP server is added.

Hooks are on **only for this arm**. The baseline and the PUZZLE-02 pull arm keep `disableAllHooks: true`.

## How a puzzle run enables this arm

The PUZZLE-02 isolation procedure (`experiments/puzzle-02-tool-arm/isolation.md`) applies, with these changes:

1. **Runner.** Copy `experiments/edit-gate/` (without `fixtures/` and `test/`) into the root-only runner `/srv/r`,
   next to `experiments/detect-02/` (without `results/`) and `experiments/puzzle-01-baseline/run-baseline.ts`.
2. **Harness root.** Install `gate-relay.cjs` as `/srv/h/bin/gate-relay.cjs` (root, 0755; no puzzle text).
3. **Socket.** Create `/srv/m` as root with mode 0755. The hub creates `g.sock` (0666) there.
4. **Specs and logs.** Put the puzzle specs in `/srv/o/specs/tN.yaml` and the hub logs in `/srv/o/out/gate/`, all
   root-only.
5. **Close root's tsx cache.** Set `/tmp/tsx-0` to 0700. It holds compiled copies of everything root ran with `tsx`,
   and the build's fingerprint sweep found it readable. `run-edit-gate.ts` closes it before every generator spawn.
6. **Input file.** Write it in the shape of `setup-sandbox.sh`'s `/srv/o/input.json`, with:
   - `tasks`: neutral ids, seed directory, seed tree sha256, spec path, steps;
   - `runs`, `orderSeed`, `redrawPerTask`;
   - `caps`: smoke 1, probes 1, sessions 30, total 38, per note §9;
   - `isolation`: the puzzle's sweep patterns.
7. **Zero calls first.** Run `npx tsx experiments/edit-gate/run-edit-gate.ts --dry --input /srv/o/input.json`.
   - It runs the listing checks, the fingerprint sweep, the relay as the generator user, and the real CLI as the
     generator user against the scripted API (edit message, de-duplication, Stop once, switch-off).
   - It then runs a stub agent through the session pipeline.
   - It must print `"passed": true`.
8. **Then the calls.** `--smoke`, `--probe`, `--sessions`.
   - The frame is the baseline frame verbatim (`framePrompt`), with no sentence about a tool (note §5).
   - One step per turn, 0 repair turns.
   - Snapshots after every step.
   - `turns.jsonl` gets a per-step `gate` summary (edits, replies, new and resolved keys, Stop blocks, fail-open
     count, refusals).

**Fallback (B in the note).** If a CLI pin ever stops delivering hook output, use the between-turns gate that already
exists, `experiments/detect-02/mcp/push-gate.ts`: append its text to the next prompt. On CLI 2.1.308 the hook path
works, so the fallback was not needed and was not built further.

## Commands

```
npx tsx experiments/edit-gate/test/unit.ts --out results/v1.5-edit-gate-build/unit.json      # zero calls
sh experiments/edit-gate/setup-sandbox.sh                                                     # closes the clone
npx tsx experiments/edit-gate/run-edit-gate.ts --dry   --input /srv/o/input.json             # zero calls
npx tsx experiments/edit-gate/run-edit-gate.ts --smoke --input /srv/o/input.json             # 1 call
npx tsx experiments/edit-gate/run-edit-gate.ts --probe --input /srv/o/input.json             # 1 call
sh experiments/edit-gate/setup-sandbox.sh --open                                              # reopens the clone
```

In this sandbox, the skeleton install behind the proxy needs `cafile=/root/.ccr/ca-bundle.crt` in root's `~/.npmrc`.
The frozen npm environment is allow-listed and drops `NODE_EXTRA_CA_CERTS`.
