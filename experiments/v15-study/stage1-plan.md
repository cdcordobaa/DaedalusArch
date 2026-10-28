# v1.5 final study, Stage 1 pilot plan: arms `none` vs `combined` on two tasks

**Committed before any generator call.** Stage 1 checks the plumbing and the cost of the final-study driver
(`experiments/v15-study/`) on two tasks. It is not study data and is never pooled with the study. Nothing here changes
`src/`, the study tasks (`experiments/trap-families/`), the admitted rule set or any sealed set.

Sources:
- the combined delivery design, `ops/notes/v15-combined-delivery-design-2026-10-26.md` (§8 is the minimal pilot);
- the driver `experiments/v15-study/run-study.ts`, its input builder `make-input.ts`, the sandbox `setup-sandbox.sh`
  and the scorer `score-study.ts`;
- the command sequence, in `RUNBOOK.md`.

## 1. Design

| Item | Value |
|---|---|
| Tasks | `t01` (DDD, first confirmatory DDD task of `study-set.json`) and `t13` (Hexagonal, first confirmatory Hexagonal task); neutral ids are those of the full study |
| Arms | `none` (baseline frame, frozen argv) and `combined` (frame + `frame-combined.txt`, gate `--settings` + pull MCP config, one delivery hub per session) |
| Replicates | 1 |
| Sessions | 2 tasks × 2 arms = **4 sessions × 3 steps = 12 step turns**; one session per cell, all steps from the seed, one step per turn, 0 repair turns |
| Order | the driver's plan: mulberry32, order seed `20261029`, over the 4 cells |
| Generator | `claude-sonnet-5-5`; the CLI pin at run time, recorded and checked before every turn |
| Input | `sh experiments/v15-study/setup-sandbox.sh 1 --tasks t01,t13 --phase stage1` (input `/srv/o/stage1/input.json`, out root `/srv/o/stage1/out`) |

## 2. Calls (hard cap, never raised)

| Phase | Cap | Planned |
|---|---|---|
| Smoke | 2 | 2 (one per arm; the combined smoke runs on the edit-gate dummy) |
| READ probe | 1 | 1 |
| Session turns | 13 (12 × 1.06, rounded up) | 12 |
| **Total** | **16** | 15 |

The dry run (`--dry`), the listing check, the fingerprint sweep and the scripted S4 checks make zero calls and run
first. Under this cap no whole-session redraw (3 turns) fits. A session lost to infrastructure is recorded as lost
and reported, not redrawn. Agent behaviour is never grounds for a redraw.

## 3. Exit criteria (all must hold)

From the combined design §8, criteria 1–5:
1. In both `combined` runs, at least 95 % of edits have a hook event, fail-open is at most 5 %, and hub p95 is under
   2 s (`session.json` → `integrity`).
2. The CLI version is identical on every turn (`turns.jsonl` → `cliVersion`), and no settings write or overlay write
   took effect (S4 `switchOff` clean; `evasion` per cell in `scores.json` reported).
3. Double reports are 0, and every key has one finding number across both channels (`scores.json` →
   `attribution.doubleReports`; the hub ledger).
4. The attribution table is produced by the scorer with no hand step, even if it is empty.
5. Both channels are seen at least once across the pilot: at least one push and one pull call. This is not required
   per run. If the agent never calls a tool, that is recorded as a finding about the mode, not as a failure.

Plus:
6. All 4 runs are scored end to end by `score-study.ts` with no manual repair, and `cells.json` is produced (4
   cells, `D` not null).
7. Per-turn wall time per arm is reported (`scores.json` → `summary.<arm>.turnWallTime`).

## 4. What Stage 1 cannot show

Any effect. With n = 1 per cell, `none` vs `combined` is a plumbing and cost check, and its counts are not read as a
direction.

## 5. Stop rules

The study's rules:
- isolation not achieved (listing, sweep, positive control) or S4 not clean: **STOP** before any call;
- the READ probe fails: **STOP**;
- a smoke fails: **STOP** and report why;
- a CLI version change before any turn, or hub p95 over 5 s: the driver stops the run;
- a hard cap is reached: the driver refuses the call.

## 6. Records

Results are committed on the branch `results/v15-stage1`, under `results/v1.5-study/stage1/`:
- `isolation/`;
- `dry/dry-result.json`, `smoke/`, `probes/`;
- `run/`: `calls.jsonl`, `turns.jsonl`, `schedule.json`, `state.json`, the sessions' `session.json`, and the hub logs;
- `scores/`: `scores.json`, `cells.json`;
- the private id map.

Rules for the records:
- No chat text and no envelopes are committed; the agent's messages are not quoted.
- Nothing is pooled with the study.
