# MCP call log and per-step process metrics (gate line D6)

> Tooling only. Not a pre-registration. Written before the implementation (night backlog 2026-10-16, job #15 · S3).
> Everything below is OFF by default: without `--call-log` / `DAEDALUS_CALL_LOG` the server registers the same tools
> with the same handlers and answers byte-identically; without the loop's `--call-log` option no step record gains a
> field and the scripted replay stays byte-identical.

## Why

Study 2 outline §4 "Process" asks, for the `daedalus-mcp` arm, for tool calls per step and whether the first call
came before or after the first write; §7 "Tool adoption" needs the same log to separate intention-to-treat from
per-protocol figures. The readiness gate (D6) says: "No MCP call log exists".

## Server: `--call-log <abs path>` (env `DAEDALUS_CALL_LOG`)

- The path must be absolute and must not lie inside (or equal) the configured `--project`. The server refuses to
  start otherwise (exit 2, message on stderr): a log inside the agent's cwd would be visible to, and editable by, the
  agent, and would change the snapshot.
- On start the file's directory is created and the file is created empty if it does not exist (so "server ran, no
  call" is distinguishable from "server never ran"). Lines are appended, never rewritten.
- One JSONL line per tool call, written after the handler returns (also on error):

| field | type | meaning |
|---|---|---|
| `schema` | `"mcp-call/v1"` | |
| `ts` | ISO string | when the call arrived |
| `seq` | integer | 1-based call number in this server process |
| `tool` | string | registered tool name |
| `argsSha256` | hex | sha256 of the canonical JSON of the arguments (keys sorted). Raw arguments are never written: they carry file contents and diffs |
| `filesTouched` | string[] | paths only: `path`, `paths`, `from`, `resolvedPath`, `finding.file`/`filePath`, and the `+++ b/` headers of a `diff`; sorted, unique |
| `blockingCount` | integer or null | `blockingCount` of the answer (else `blockingViolationCount`) |
| `verdict` | string or null | `blockingVerdict` of the answer, else `verdict`, else `status` |
| `durationMs` | number | handler wall time |
| `error` | string or null | `isError` answer text (first 200 chars) or the thrown message |
| `treeChangedSinceStart` | boolean or null | whether the project tree (file paths, sizes, mtimes; `node_modules`, `.git` skipped) differs from the fingerprint taken when the server started; null when there is no project |

A wrapper around the narrow `register` function in `server.ts` does all of this; the tool implementations are not
touched and the answer returned to the client is the handler's own object.

## Loop: per-turn log path and the `process` block

- Option `callLog` on the loop context (CLI `--call-log`), default off. When on and the run's arm is `daedalus-mcp`,
  each turn gets `callLogPath = <H>/runs/<runId>/calls/<turnId>.jsonl` (outside `work/`), and the Claude and Codex
  agents append `--call-log <path>` to the server's arguments for that turn. Other arms never get a path.
- When on (and arm `daedalus-mcp`), the step record gains an optional `process` block:

```
process: {
  schema: 'loop-process/v1',
  logs: string[]                      // run-dir-relative paths of the turns' logs that exist
  logFound: boolean                   // at least one log file exists
  calls: number
  errors: number
  callsByTool: Record<string, number> // sorted keys
  firstCallAt: string | null
  firstCallBeforeFirstWrite: boolean | null
  firstWriteEvidence: 'server-fingerprint' | 'mtime-upper-bound' | 'none'
  latencyMs: { p50: number | null, p95: number | null }   // nearest-rank over the step's calls
}
```

- First call vs first write. Primary evidence: the first call's `treeChangedSinceStart` (the server starts with the
  CLI session, before the agent acts): `false` means nothing was written before the first call (`true` = before);
  `true` means a write came first (`false`). Fallback when the field is null: the earliest mtime among the files the
  turn left changed is an upper bound on the first write, so a first call later than it is certainly after a write
  (`false`); anything else is undetermined (`null`). No calls: `null`.
- Absent when the option is off. The replay agent never starts a server, so its records are unchanged.

## Pass criterion (fixed before implementation)

1. `--call-log` absent: tool list and every tool answer in the server test fixture are deep-equal to the answers
   without the wrapper (golden = the same server built without the option).
2. `--call-log` present: one line per call with the schema above; no line contains the `content` or `diff` text
   passed in; a relative path or a path inside `--project` is refused.
3. Loop: with a stub agent that writes a fake log, the step record carries the `process` block with the counts,
   order and nearest-rank p50/p95 computed by hand; without the option the record has no `process` key.
4. `ue-baseline-live.ts --engine cypher-interp` diff against `results/v1.3-reference/after-member-facts` is empty
   except `elapsedMs`.

## Not done here

- No live probe: no CLI login exists in the cloud, so the wiring is checked only through argv/config assertions. The
  confinement probes with the server attached (author action, S4) should also confirm the log appears.
- The neural tools are logged like any other tool, but nothing evaluates their adoption yet.
