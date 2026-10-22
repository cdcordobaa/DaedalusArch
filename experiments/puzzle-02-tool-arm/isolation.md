# PUZZLE-02 tool arm: isolation procedure

Committed before any generator call. This is the baseline procedure (`experiments/puzzle-01-baseline/isolation.md`)
reused exactly, with one addition for the MCP server. Evidence goes to `results/v1.4-puzzle-02-tool-arm/isolation/`.

## Goal

As in the baseline: during the generator phase no path the generator process can read holds puzzle material, design
notes, reports or git history (`solutions/`, `oracle.ts`, `README.md`, `puzzle.json`, `spec.yaml`, `tests/`,
`verification.json`, the case bank, `ops/notes`, `Docs/DiagnosticRuns`, `.git`), nor the later steps' requests. The
workspace holds only the skeleton and the seed (with `ARCHITECTURE.md`). Added here: the puzzle spec the server reads,
the server's code and its call logs are unreadable to the generator too.

## Method (baseline table, unchanged rows)

| Path | Owner, mode | Holds | Generator can read |
|---|---|---|---|
| `/srv/bin/gclaude` | root, 0755 | the baseline wrapper, byte for byte: writes the generator's credentials file, then `setpriv --reuid=1500 --regid=1500 --clear-groups /opt/claude-code/bin/claude "$@"` | yes (wrapper text only) |
| `/srv/gh` | gen, 0700 | the generator's `HOME`, emptied before every session | yes (its own) |
| `/srv/h` | root, 0755 | harness root: skeleton install, `bin/tsc`, per-session `runs/c/<id>/tsconfig.json`, and `bin/mcp-relay.cjs` (8 lines, no puzzle text) | yes (no puzzle text) |
| `/srv/w/<id>/work` | gen while the session runs; root 0700 after | the session's work tree | only the running session's |
| `/srv/r` | root, 0700 | the runner: `src/`, `scripts/`, `presets/`, `package.json`, `tsconfig.json`, `node_modules/`, and the code the driver and server need: `experiments/puzzle-01-baseline/run-baseline.ts`, `experiments/puzzle-02-tool-arm/run-tool-arm.ts`, `experiments/detect-02/` (without `results/`), `experiments/detect-01/lib/`. No puzzle folder, `Docs/`, `ops/`, `results/`, `tests/`, `.git` | no |
| `/srv/o` | root, 0700 | the driver input, the seeds, the requests, **the two puzzle specs under neutral names (`specs/t1.yaml`, `specs/t2.yaml`)**, the private task map, and the out root (ledger, snapshots, envelopes, **MCP call logs and tap**) | no |
| `/srv/m` | root, 0755 | the hub's Unix socket `s.sock` (0666) | connect only |
| `/srv/vault` | root, 0700 | the full clone (`/srv/vault/c`), the canary | no |
| `/home/user/DaedalusArch` | root, 0700, **empty** | the clone's former path | no |
| `/root`, `/tmp/claude-0`, `/tmp/tsx-0`, `/home/claude/.claude/remote` | root, 0700 | the coordinator's files | no |

**The MCP server (the addition).** A stdio server named in `--mcp-config` is spawned by the CLI, so it would run as
the generator user and could not read the root-only spec. Instead the MCP config names a relay that joins its stdio to
the socket `/srv/m/s.sock`; the driver (root) listens there and, for each connection, spawns
`experiments/detect-02/mcp/main.ts --spec /srv/o/specs/tN.yaml --project /srv/w/cNN/work --engine cypher-interp
--confine --call-log /srv/o/out/mcp/cNN.calls.jsonl` as root, for the current cell only. The server's stderr goes to a
root-only log. With no current cell the hub closes the connection. `--confine` keeps every `spec` and `project`
argument on the configured spec and work tree.

- **Neutral names**, as in the baseline: sessions `c01`…, tasks `t1`, `t2`, cells `/srv/w/cNN/work`, the type-check
  command `/srv/h/bin/tsc --noEmit --incremental false -p /srv/h/runs/c/cNN/tsconfig.json`; the server name is
  `daedalus-arch` and the spec path the tool reports is `/srv/o/specs/tN.yaml`. The map from `tN` to the puzzle stays
  in `/srv/o` until generation is over.
- **Between sessions**, **credentials** and **restore**: as in the baseline.

## Checks (zero calls; the baseline method)

1. **Listing.** As `gen`: `ls` and `head` of the former clone path, a vault file, the runner, the out root, the specs,
   the MCP call-log directory, the server entry, `/root` and the coordinator's directories return "Permission denied".
2. **Fingerprint sweep.** As `gen`, `grep -rIlF` over `/` (no `/proc`, `/sys`, `/dev`) for the baseline's pattern set
   (puzzle ids, `PUZZLE-01`, `winning line`, `trap line`, the distinctive phrases of each later step, the canaries) plus
   the spec header line: **0 readable files**.
3. **READ probe at zero calls.** As `gen`, `head -1` of the baseline READ probe's three paths (P1 `README.md` at its
   former absolute path, the vault canary, the out-root canary): each denied, no content printed.

Then the two model-call checks of the note (§5): the smoke and the MCP confinement probe. If any check fails, the run
**stops** and the failure is reported.
