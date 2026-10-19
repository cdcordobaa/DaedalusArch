# Loop isolation, pauses, archive and telemetry for the exploratory study (S1, S2, S3, S12, D6)

**2026-10-19. BUILD-L item 6. Zero model calls, no Neo4j, no sealed read.** What is mechanical is built and tested
on stub and dry-run stores; what needs a real CLI is listed in §2 and stays with the author.

## 1. Implemented

| Gate line | What | Where | Tests |
|---|---|---|---|
| S2, S3 | Claude CLI pin and generator isolation **ON** in the exploratory plan templates (none@L2 + mcp@L2; none@L3), on the rehearsal tasks `ice-rink` and `vineyard-harvest` | `experiments/exploratory-study/` (README lists the values to confirm) | `tests/unit/scripts/loop/exploratory-plan.test.ts` (loads with `<local>` filled; pin and isolation present; `callBudget` = `planCallBudget`; tasks equal to the rehearsal tasks by per-task hash) |
| S1 | Pause durations: every usage-limit interruption now carries `pause: { startedAt, endedAt, plannedMs, ms }`, measured on the injected clock around the sleep. It reaches every call site that uses `runWithRetries` (E1 cells, loop step and repair turns, the isolated turns) and is stored in the turn record (`result.interruptions[]`). A turn with no pause records exactly what it did before | `scripts/lib/generators/retry.ts`, `types.ts` (`GenerationPause`) | `tests/unit/scripts/generators/retry-pause.test.ts`; `tests/unit/scripts/loop/isolation.test.ts` P5 now also checks the pause in the turn record |
| S12 | Archive step: a manifest (relative POSIX paths, sha256 per file, `manifestSha256` independent of location and file times) and a deterministic ustar (mtime 0, uid 0, mode 0644, manifest order) of `schedule.json`, `runs/` and `interruptions/`; work trees and symbolic links left out; `--verify` against a committed manifest; a path-free scan (home paths, secret shapes) of directories meant to be committed, reported by file and line only | `scripts/lib/loop/archive.ts`, `scripts/v1.4/loop-archive.ts` | `tests/unit/scripts/loop/archive.test.ts` (same tar bytes twice; `tar -tf`/`-xf` read it back; verify names changed and added files; scan finds and does not quote) |
| D6 | `loop-telemetry-check`: per turn non-null tokens (input, output, cache read, cache creation), `costUsd`, `numTurns`, `wallMs`, ≥ 1 attempt, every interruption with its pause, prompt text present and hashing to `promptSha256`; gate steps have `repair` (and `repairOutcome` when the repair was evaluated); `daedalus-mcp` runs were created with `--call-log`, have a `process` block and a call log per turn, every line well-formed `mcp-call/v1`, tool allowed and never denied (`evaluate_project`), `ts` inside the step window, `process.calls` equal to the line count | `scripts/lib/loop/telemetry-check.ts`, `scripts/v1.4/loop-telemetry-check.ts` | `tests/unit/scripts/loop/telemetry-check.test.ts` (complete dry-run stores pass for none, gate, daedalus-mcp; each gap is reported) |

Commands:

```bash
npx tsx scripts/loop-harness-cli.ts --plan experiments/exploratory-study/plan-L2.template.json --call-log \
  --binary <abs> --harness-root <abs> --out-root <abs> --claude-config-dir <abs>
npx tsx scripts/v1.4/loop-telemetry-check.ts <out-root>                       # D6, exit 0 required
npx tsx scripts/v1.4/loop-archive.ts --out-root <out-root> --tar <abs>.tar --manifest results/<study>/archive-manifest.json \
  --check-paths results/<study>                                                 # S12
```

## 2. Needs live runs (the author's)

1. **S3, a real login under the isolated env.** Log in once into the dedicated config dir and run one live turn
   through the harness with the template's isolation. On Linux the CLI keeps its credentials in
   `<config dir>/.credentials.json`, which the judge's frozen listing does not allow (`Docs/v1.3/loop-isolation.md`
   §4); the study runs on the author's Mac.
2. **S2, auto-update off and the pin.** Confirm `cliVersion` (placeholder `2.1.294`) against the installed CLI, and
   that `DISABLE_AUTOUPDATER=1` shows in `env-<turnId>.json` of a live turn.
3. **S4 with the MCP server attached**, per CLI × arm: the confinement probes, which must also show the call log
   appearing (`Docs/v1.3/mcp-call-log.md`, "Not done here").
4. **S1, a live pause.** The recorded usage-limit text is tested; a real limit hit during the pilot or rehearsal must
   show a `pause` with a plausible duration in the step record.
5. **D6, "one call-log line per tool call reported by the CLI envelope".** The scrubbed envelope carries no tool-call
   list the harness reads, so this half of the pass can be checked only on a live envelope (S4 probe or pilot). The
   checker then runs with exit 0 on the rehearsal out-root.
6. **S12 on real out-roots**: archive the pilot/rehearsal out-roots, commit the manifest and the tar sha256, and run
   the path-free scan and the repository's secret scan on the committed results.

Not decided here: the `vineyard-harvest` static spec (a candidate is `fixtures/v1.3-rehearsal-tasks/specs/vineyard-harvest.ddd.yaml`, for the author to approve; D15 is the author's), the `daedalus` block paths, the shared step-1 start (not
a harness feature; the templates run every cell from step 1), and the Gemini lane's plan.
