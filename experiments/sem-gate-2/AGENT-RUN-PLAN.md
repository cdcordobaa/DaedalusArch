# SEM-GATE-2 follow-up: agent run plan on hxpb1 / hxpb2 with deferred R-MIRROR-SEM (exploratory; not run)

2026-11-02. Written because SEM-GATE-2 passed (`README.md`). **Exploratory**: no registered study is touched, no
counted rule list changes, R-MIRROR-SEM stays uncounted, nothing here is rescored into an earlier study. Not run.

## 1. Question

On the two renamed-copy tasks built to elicit a core-side copy of a vendor value set, does the `combined` arm (push
and pull delivery of the Hexagonal rule set, with R-MIRROR-SEM in deferred mode) lower the rate of sessions that end
with the shortcut, against the `none` arm? Secondary, descriptive: how often R-MIRROR-SEM fires, on which push, and
whether the agent then removes the copy.

## 2. Design

| Item | Value |
|---|---|
| Tasks | `hxpb1-pottery-kiln`, `hxpb2-translation-portal` (`experiments/hx-study-set/part-b/`; 3 steps each) |
| Arms | `none` (baseline frame, frozen argv) and `combined` (frame-combined, hooks on, pull MCP), as in the Hexagonal study |
| Semantic layer | `DAEDALUS_MIRROR_SEM=deferred` in the `combined` arm only (a new candidate fires from the next check on; no check waits on a call) |
| Generator | Claude only (`claude-sonnet-5-5`, the study's pinned CLI); no other provider |
| Judge | `claude-opus-5-5` through the existing CLI judge route, disk cache by content hash |
| Instrument | v1.5.9 (`INSTRUMENT_ID`), frozen for the run |
| Pilot | 2 replicates: 2 tasks × 2 arms × 2 = 8 sessions, 24 turns |
| Run | 10 replicates: 2 × 2 × 10 = 40 sessions, 120 turns (the pilot is not pooled into it) |
| Order | the driver's seeded plan (mulberry32, seed 20261029), interleaved by replicate round |
| Outcome | per session, at the final step: the task oracle's trap verdict (`oracle.ts`) and R-MIRROR-SEM on the target set in the scorer (replay judge, the hub's cache) |

## 3. Tooling (reuse, no new driver)

- Study set: a new manifest `experiments/sem-gate-2/study-set.json` in the trap-families shape with
  `exploratory.hexagonal: [hxpb1-pottery-kiln, hxpb2-translation-portal]`, empty confirmatory lists and `taskDirs`
  pointing at `experiments/hx-study-set/part-b/<task>`, passed with `--study-set`.
- Input: `experiments/v15-study/make-input.ts --study-set experiments/sem-gate-2/study-set.json --phase sem2-pilot
  --replicates 2` (then `--phase sem2-run --replicates 10`); check the printed counts and caps against §2.
- Sandbox, dry, smoke, probes, sessions, scoring and records: `experiments/v15-study/RUNBOOK.md` §0–§2, one phase per
  container, with `DAEDALUS_MIRROR_SEM=deferred` (not `off`) on the `--sessions` command and on the scorer run with
  `DAEDALUS_MIRROR_SEM=replay` (the hub's cache, zero calls). `--keep-trees` keeps every session's step trees.
- Results: `results/v1.5-study/sem2-pilot/` and `results/v1.5-study/sem2-run/` on a results branch
  (`results/v15-sem2`), not on `main`.

## 4. Pilot stop gates (all must hold before the 10-replicate run)

| # | Gate | Source |
|---|---|---|
| G1 | Hub p95 push-check latency < 5 s in every `combined` session (the driver's mechanism stop also enforces it) | hub `*.push.jsonl` |
| G2 | Delivered = scored: the delivery audit shows the hub delivered exactly the rule set the scorer scores, R-MIRROR-SEM included, in every `combined` session | `lib/delivery-audit.ts` |
| G3 | No integrity flags: edits with a hook event ≥ 95 %, fail-open ≤ 5 %, hub alive, in every `combined` session; no redraw beyond the cap | the integrity monitor, `session.json` |
| G4 | The `none` arm takes the shortcut: the oracle reports the trap in at least 1 of the 4 `none` pilot sessions (else the tasks do not draw the shape out and the run measures nothing) | `oracle.ts`, scores |
| G5 | Every R-MIRROR-SEM finding in the pilot has 0 hallucinated citations (the SEM-GATE criterion 3 check) | scorer rows |

Any red gate: stop, write the pilot record, do not start the run, report. A CLI version change mid-run is a stop
(driver exit 3), not a resume.

## 5. Reporting (exploratory)

Per arm and task: sessions with the trap at the final step, R-MIRROR-SEM firings (push number of the first firing,
whether the copy is gone at the final step), judge calls (ledger lines), calls per session and hub latency. Rates with
exact 95 % intervals; no hypothesis test is claimed as confirmatory. Every number goes to the claims ledger from the
committed records.

## 6. Budget and machine

Pilot 24 generator turns plus at most a few judge calls per `combined` session (one per new candidate question, cached);
run 120 turns. One heavy job at a time, at most one Neo4j (the hub uses the in-memory graph), jest `--maxWorkers=2`.
