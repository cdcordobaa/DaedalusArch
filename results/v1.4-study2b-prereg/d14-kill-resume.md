# D14: live kill-and-resume on a practice task (2026-10-20)

Gate line D14 (live kill-and-resume) for Study 2b, pre-registration `Docs/v1.4/study2b-preregistration.md` §4 (Fable review finding 10). **Practice task only; no sealed file was read or run. 2 model calls.**

| Item | Value |
|---|---|
| Task | The dress rehearsal's practice task `ice-rink` (`<shared>/daedalus-study2b/rehearsal/live/tasks.json`), cut to step 1; written to `<shared>/daedalus-study2b/rehearsal/kill-resume/tasks.json` (sha256 `fb3f17422bee01635f66b32dfb42210adfa3906aae1c44fb0e32f35924343bb6`) |
| Plan | `study2b-plans.ts --replicate 5 --no-acceptance`: `none@L2`, run index 4, 1 step turn (plan sha256 `80761a49d59c8cd936f83668dd1a5d0ec524242a5f15ffb88ea68f4ff5d26849`) |
| Binary | `<shared>/daedalus-study2b/bin/claude-2.1.304`, `--version` 2.1.304 (Claude Code), sha256 `b9ac5374839f14abf3f1f45610637c332b5daee5ce0d1634726cef87aab78e6a` (DELEG6), checked before the run |
| Harness | the repository at the prereg branch (`scripts/lib` byte-identical to X), harness root of the rehearsal's `none@L2` lane, `--call-log` |

## What happened

1. **11:31:04Z** call 1 started (attempt 1).
2. **11:31:56Z** with 3 `.ts` files in the agent's cwd, the harness's process group was killed with `SIGKILL` (exit 137). No CLI process was left running.
3. **11:31:59Z** the same command was run again (attempt 2). The harness resumed the run and wrote one `restarts.jsonl` line:

   ```json
   {"at":"2026-10-20T11:32:01.830Z","reason":"redraw","resumeAtStep":1,"restoredTo":"073749945a9c3a6169814e9e089a0ec35e3e833f","discardedHead":"073749945a9c3a6169814e9e089a0ec35e3e833f","discardedChanges":6,"setAside":"discarded/restart-1"}
   ```
4. Call 2 redrew step 1 (step record `startedAt` 11:32:01.859Z, `finishedAt` 11:33:29.183Z). The step was committed and scored (blocking 0). The console summary reports `redraws: 1, rescores: 0`. **Exit 0 at 11:33:29Z.**
5. The redrawn turn's envelope names the served model `claude-sonnet-5-5` (the only `modelUsage` key; `canonicalModel` the same).

## Reading

- **Green.** A hard kill in the middle of a turn is resumed by re-running the command; the partial step is discarded, set aside, logged as a `redraw`, and redrawn once. It is counted in the console summary and in `restarts.jsonl`, which is what the pre-registration counts per cell.
- **Not covered.** A live usage-limit pause (S1) was not injected; S1's pause-and-resume path is the one the unit tests and fault drills cover.
