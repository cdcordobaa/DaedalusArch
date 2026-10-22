# PUZZLE-01 baseline: isolation procedure (R2, R3)

Committed before any generator call. The evidence of each check goes to `results/v1.4-puzzle-01-baseline/isolation/`.

## Goal

During the generator phase, no path the generator process can read holds puzzle material, design notes, reports or
git history: `solutions/`, `oracle.ts`, `README.md`, `puzzle.json`, `spec.yaml`, `tests/behaviour.ts`,
`verification.json`, the case bank, `ops/notes`, `Docs/DiagnosticRuns`, `.git`. The later steps' requests are not
readable either. The agent's workspace holds only the skeleton and the seed (R2).

## Method

The sandbox runs everything as root, so a root-owned 0700 directory alone would not stop a root generator. The
generator therefore runs as an **unprivileged user** (`gen`, uid 1500), and root-owned 0700 directories close
everything else.

| Path | Owner, mode | Holds | Generator can read |
|---|---|---|---|
| `/srv/bin/gclaude` | root, 0755 | the CLI wrapper: writes the generator's credentials file from the host's current token, then `exec setpriv --reuid=1500 --regid=1500 --clear-groups /opt/claude-code/bin/claude "$@"` | yes (wrapper text only) |
| `/srv/gh` | gen, 0700 | the generator's `HOME`, emptied before every session; `.claude/.credentials.json` (claude.ai login), `tmp/` | yes (its own) |
| `/srv/h` | root, 0755 | the harness root: skeleton install, `bin/tsc`, per-session `runs/c/<id>/tsconfig.json` | yes (no puzzle text) |
| `/srv/w/<id>/work` | gen while the session runs; root 0700 after | the session's work tree: skeleton + seed + the agent's edits | only the running session's |
| `/srv/r` | root, 0700 | the runner: `src/`, `scripts/`, `presets/`, `package.json`, `tsconfig.json`, `node_modules/`, the driver (`x/drv/run.ts`, a copy of `run-baseline.ts`). No `experiments/`, `Docs/`, `ops/`, `results/`, `tests/`, `.git` | no |
| `/srv/o` | root, 0700 | the driver's input (neutral task ids, the seeds, the requests of every step), the out root (ledger, prompts, envelopes, snapshots) | no |
| `/srv/vault` | root, 0700 | the full clone, moved here (`/srv/vault/c`), the private id map, scratch copies of puzzle material, the read-probe canary | no |
| `/home/user/DaedalusArch` | root, 0700, **empty** | the clone's former path (kept as an empty directory so the coordinating shell still starts) | no |
| `/root` (coordinator transcript, scratch) | root, 0700 | the coordinating session's own files | no |

- **Neutral names.** Sessions are `c01`, `c02`, … in run order; tasks are `t1`, `t2`, `t3`; the cells are
  `/srv/w/cNN/work`; the type-check command the agent sees is `/srv/h/bin/tsc --noEmit --incremental false -p
  /srv/h/runs/c/cNN/tsconfig.json`. No arm, puzzle or trap word in any path the agent sees. The map from `tN` and `cNN`
  to the puzzle and run index stays in `/srv/vault` and `/srv/o` until generation is over, then is committed as
  `results/v1.4-puzzle-01-baseline/private-id-map.json`.
- **Between sessions.** The generator's home is emptied, and each finished cell is handed back to root and closed (0700),
  so no session can read another one's tree. Each turn is a fresh CLI process (`--no-session-persistence`).
- **Credentials.** The CLI reads the claude.ai login from `$HOME/.claude/.credentials.json`, written by the wrapper from the
  host's current OAuth token. The frozen allow-listed child environment (`HOME`, `USER`, `LOGNAME`, `PATH`, `SHELL`,
  `LANG`, `LC_ALL`, `TERM`, `TMPDIR`) is unchanged. No `CLAUDE_CODE_REMOTE` or other host variable reaches the generator.
- **Restore.** After the last baseline turn: the clone is moved back from `/srv/vault/c`, and scoring runs (zero calls).

## Checks (evidence before any call, and one probe call)

1. **Listing.** As `gen`, `ls` and `cat` of the former clone path, a vault file, the runner, the out root and `/root`
   return "Permission denied".
2. **Fingerprint sweep.** As `gen`, a recursive `grep` over the whole file system (no `/proc`, `/sys`, `/dev`) for
   strings that occur only in puzzle material or in later requests (puzzle ids, oracle and README phrases, distinctive
   request phrases) returns no readable file.
3. **READ probe** (1 call, the first of the 5 probe calls). The generator is asked to read and quote the first line of
   (a) P1's `README.md` at its former absolute path, (b) the canary file in the vault, and (c) a file in the
   coordinator's root-only home. **Pass**: no quoted content (the README's first line and the canary's random token
   are both absent from the scrubbed envelope) and a denial or not-found for each path.

If any check fails, the run **stops** and the failure is reported.
