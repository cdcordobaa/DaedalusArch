# Token antipatterns and a continuity plan

Date: 2026-10-24. Scope: how the October agent sessions spent tokens and how to keep long-running context without paying for it on every turn. Figures are token usage shares measured from local session logs, not billing.

## 1. Where the tokens went (October)

- About 96% of all tokens were cache reads: the same context replayed on every turn. Output was about 0.1%.
- Subagents and workflows used about 73% of the tokens; the coordinator sessions used the rest but wrote most of the output.
- One coordinator session ran 3,588 turns. Its median context was 427k tokens and its p90 was 808k. Turns above 400k context produced 77% of its tokens.

The cost of a turn is roughly the size of the context it carries. Long-lived contexts multiplied by many small turns is the main driver.

## 2. Antipatterns found

| # | Antipattern | Evidence (coordinator session) | Why it costs |
|---|---|---|---|
| A1 | One coordinator session for many days and threads | median context 427k, max 967k | every later turn replays the whole history |
| A2 | Polling cloud runs and CI in short loops | 268 RemoteTrigger calls, 20% of all tool output | each check is a full-context turn that usually says "still running" |
| A3 | Reading whole large files | 52 Read calls produced 42% of tool output; 32 of them over 20k characters | the file stays in context for every later turn |
| A4 | Unbounded shell output (logs, test runs, progress bars) | 2,156 Bash calls, 23% of tool output | noise sits in context permanently |
| A5 | Pulling full remote run logs instead of the result line | 16 run logs over 20k characters | same as A3 |
| A6 | Reading back published pages and docs to check them | Artifact and Docs reads, about 7% of tool output | the content is already known locally |
| A7 | Wide fan-out: many subagents and workflow agents per task | 187 Agent and 32 Workflow calls; subagents and workflows are about 73% of tokens | each agent rebuilds its own context; long briefs are repeated per agent |
| A8 | Subagents returning long reports | reports land in the coordinator's context and stay there | the coordinator needs the conclusion, not the working |
| A9 | Re-deriving known state after a break | re-reading files already summarised | the handoff should carry the state |
| A10 | Strong model for mechanical work | routing plan exists but is not active | mechanical steps cost the same as reasoning steps |

## 3. Plan: keep the continuity, drop the replay

The continuity of this session came from three things: the state in the conversation, the standing rules, and the identifiers (ledger ids, PR numbers, paths). Only the first one needs the long context. The plan moves it into files.

### 3.1 State lives in files

- `ops/now.md` is the live state: open threads, the next step for each, the identifiers in play, the standing constraints, and pending decisions. Keep it under 150 lines and update it at every milestone (merge, run finished, decision taken), not at the end of the day.
- Durable rules and preferences stay in the memory files; project facts stay in `ops/` and the ledger.
- A new session starts by reading `ops/now.md` and nothing else until a thread needs more.

### 3.2 Rotate before the context gets heavy

- Run `/compact` with a focus line (for example `/compact keep ops/now.md threads and ids`) when the context passes about 300k tokens, instead of letting it reach 900k.
- Start a new coordinator session when the thread changes or the day ends. Update `ops/now.md` first.
- Keep separate sessions for separate threads (slides, thesis writing, instrument), as was already done with the `slides` session.

### 3.3 Wait without polling

- Use background commands and notifications for CI and local runs; the session is woken when they finish.
- For cloud routines, have the routine write its result to a PR comment or a file, and check once after a fallback wait of 20 minutes or more.

### 3.4 Keep tool output small

- Read with line ranges or search first (`grep -n`, then a range).
- Cap shell output (`| tail -n 40`, `--silent`, `jest --silent`); write long output to the scratchpad and read only the summary.
- For remote runs, read the final result, not the full log, unless the run failed.
- Do not read back pages or docs just published.

### 3.5 Delegate narrowly

- One subagent per independent question, with a short brief that points to files instead of pasting context.
- Ask subagents for a fixed return shape (at most 15 lines, or a schema), with details written to a file.
- Workflows: use the fewest agents that cover the task; use low effort for mechanical stages.
- Model routing (a smaller model for mechanical steps) stays off until the author activates it.

### 3.6 Measure

Once a week, profile the latest sessions (context per turn, tool output by tool, polling calls) and add the result to this note. A session whose median context passes 300k is the signal to tighten 3.2.
