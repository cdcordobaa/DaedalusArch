# v1.5 Hexagonal study: agent pilot (§5.1), run 1: STOPPED (mechanism stop)

Pilot data, not study data. Pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` (REGISTERED 2026-10-30),
runbook `experiments/v15-study/RUNBOOK.md`. Neither was changed.

## Setup (all passed)

| Item | Value |
|---|---|
| `main` HEAD | `b830a2dd639a898802f45418158046a8f8cb017e` |
| Registration status line | "Status: REGISTERED 2026-10-30" |
| Task seal | `verify-seal.sh`: seal ok, root `db7347acf8106989`, 752 files |
| Script sha256 (§9.1, 12 files) | all 12 match |
| Rules root | 45 of 45 OK, root `098d67bd4fdc97c5` |
| CLI pin (`/opt/claude-code/bin/claude --version`) | **2.1.314** (also on every turn record) |
| make-input | 11 tasks × 2 arms × 2 replicates = 44 sessions, 132 turns; caps sessions 140, total 143 |
| setup-sandbox | listing denied, sweep empty, S4 clean (`isolation/`) |
| `--dry` | passed (`dry/`); committed and pushed before any call |
| `--smoke` | passed, 2 calls (`smoke/`) |
| `--probes` | passed, 1 call (`probes/`) |
| Hub judge check | 1 R-MIRROR-SEM judge call made as root through the hub's own caller route (`createMirrorJudge` + `cliCaller`, disk cache off, so no cache entry was written), on a made-up candidate unrelated to any task: authenticated, answer valid, model `claude-opus-5-5`, 4.9 s. This is a judge call, not a generator call |

## Sessions

Started detached at 2026-10-30T20:28:27Z. The driver stopped itself at 2026-10-30T21:01:36Z, during session **c020**
(t02, rep 0, `combined`):

> STOP: session c020: edits with a hook event 12/13 < 95 %; hub p95 7426 ms > 5 s (mechanism stop)

The RUNBOOK says this stop is exit 3: do not resume, report. **The run was not resumed and nothing was redrawn.**

| Item | Value |
|---|---|
| Sessions completed | 19 of 44 (c001–c019) |
| Session where the stop happened | c020 (all 3 steps ran; it was kept, and the integrity monitor flagged it) |
| Generator calls | smoke 2, probes 1, sessions 60 = **63 of 143** (session cap 140: 60 used) |
| Turns per arm | none 30, combined 30 (all `completed`) |
| Redraws / resumes | 0 / 0 |
| Hub judge calls (R-MIRROR-SEM) in sessions | 7 (c015 2, c016 2, c020 3), all ok, 3.6–8.5 s each; plus the 1 auth check above |
| Wall time | setup to stop about 39 min (20:22:59Z to 21:01:36Z); sessions 33 min |

### Integrity per `combined` session (from `session.json`)

| Session | Task | Edits / with hook | Fail-open | Hub p95 / max (ms) | Flagged |
|---|---|---|---|---|---|
| c001 | t01 | 9 / 9 | 0 | 462 / 488 | no |
| c002 | t03 | 10 / 10 | 0 | 448 / 503 | no |
| c005 | t07 | 8 / 8 | 0 | 455 / 460 | no |
| c006 | t11 | 12 / 12 | 0 | 487 / 500 | no |
| c008 | t06 | 10 / 10 | 0 | 322 / 408 | no |
| c011 | t10 | 12 / 12 | 0 | 340 / 361 | no |
| c015 | t09 | 16 / 16 | 0 | 4330 / 5859 | no |
| c016 | t08 | 13 / 13 | 0 | 4073 / 5093 | no |
| c018 | t04 | 9 / 9 | 0 | 311 / 382 | no |
| c020 | t02 | 13 / 12 | 0 | **7426 / 8862** | **yes** (uncovered edit: step-03, one domain-service file) |

Every `combined` session has a `deliveryAudit` in `session.json`.

## Unexpected: what caused the stop (records only; arms not compared)

In c020's push log, the only three pushes over 0.6 s (3.9 s, 7.4 s, 8.9 s) line up in time with its three
R-MIRROR-SEM judge calls (3.6 s, 7.1 s, 8.5 s). The other 23 pushes took 0.24–0.6 s. c015 and c016, the other
sessions with judge calls, had hub p95 of 4.3 s and 4.1 s, just under the 5 s limit. So the live judge, called inside
the push check, puts hub latency over the p95 stop on tasks where the candidate structure appears. The one edit
without a hook event in c020 came in step 3, after the slow pushes. This reading comes from timestamps in the records,
not from a controlled test. Deciding what to change (the stop threshold, the judge's place in the push path, or
something else) is a design decision for the author and a dated deviation. This run made none.

## Gates (a)–(e)

**Not evaluated.** The pilot stopped after 19 of 44 sessions, and the gates are defined over the full pilot. No scoring
was run and no per-arm aggregate was computed.

## Records

`isolation/`, `dry/`, `smoke/`, `probes/`; `run/` (`turns.jsonl`, `calls.jsonl`, `schedule.json`, `state.json`,
`sessions/*.json`, `hub/*.push.jsonl`, `*.calls.jsonl`, `*.ledger.json`); `sessions/` (step trees for c001–c020, from
`--keep-trees`: 20 sessions, 80 steps, tree hashes and canaries checked). The private id map was not committed: the
RUNBOOK commits it only after the run has finished generating, and this run did not finish. The files hold no canary marker,
no cost field, no chat or agent message text, and no personal path (checked).
