# PUZZLE-02 tool arm `mcp-detect` on P1 and P2, 2026-10-22

**Exploratory (v1.5-exp), DEV split, NOT part of Study 2b.** Run note: `ops/notes/puzzle-02-tool-arm-note.md`. Plan,
frame, order, isolation procedure and driver committed and pushed before any generator call
(`experiments/puzzle-02-tool-arm/`, commit `c5a65631`). No frozen path (`src/`, `presets/`, `scripts/lib/`,
`scripts/v1.3/`), the freeze tag or any registered Study 2b artefact was changed. Records:
`results/v1.4-puzzle-02-tool-arm/`. Comparator: the PUZZLE-01 baseline arm `none`
(`results/v1.4-puzzle-01-baseline/`), not re-run.

**Question (note §1).** With the `check_consistency` tool and the §4 instruction, does the clean-solve rate on P1 and
P2 rise above the baseline arm `none`?

## 1. Headline (per puzzle, never pooled; provisional until the author's hand read)

| | P1 `p1-transfers` `mcp-detect` | P1 baseline `none` | P2 `p2-loyalty` `mcp-detect` | P2 baseline `none` |
|---|---|---|---|---|
| Runs scored | 5 | 5 | 5 | 5 |
| **Clean solves** | **4/5** | 0/5 | **0/5 by the oracle** (3/5 if the author accepts P2-SG2-a, and P2-SG1-b for c05) | 0/5 (1/5 if c07 is accepted) |
| Clean rate, Wilson 95% | 0.80 [.38, .96] | 0.00 [0, .43] | 0.00 [0, .43] (0.60 [.23, .88] under the labels) | 0.00 [0, .43] (0.20 [.04, .62]) |
| pass^5 (plug-in) | 0 | 0 | 0 | 0 |
| Trapped | 0 | 5 | 3 (c04, c05, c10) | 5 |
| Functional failures | 1 (c11) | 0 | 2 (c01, c03) | 0 |
| SG1 oracle pass on final trees | 5/5 (D4) | 0/5 | 4/5 (D6/D10; c05 fails) | 5/5 |
| SG2 oracle pass on final trees | 5/5 (D5) | 3/5 | 0/5 (D4 across contexts) | 0/5 |
| Caught-and-fixed, step snapshots (design §5) | 0 | 0 | 0 | 0 |
| Caught-and-fixed, tool-call grain (finding, then a clean call, then a clean final tree) | **4** (c02, c07, c08, c09; c11 cleared the finding but failed tests) | n/a | 0 | n/a |
| Runs where the agent's own `check_consistency` call returned findings | 5/5 (all at step 1) | n/a | 0/5 | n/a |
| Final-tree type-check errors | 0 in every run | 0 | 0 in every run | 0 |
| Median changed lines vs seed (final) | 153 | 120 | 74 | 59 |

- **P1: the tool sees the trap and the agent acts on it.** In every P1 session the agent called `check_consistency` at
  step 1, got the R-D4 finding (one command saves two `Account` instances) and, in the same turn, rewrote the
  transfer so that a later call returned clean. No step snapshot carries a finding, which is why the snapshot-grain
  caught-and-fixed is 0 while the tool-call grain is 4. P1 SG2 (D5, the daily limit inside the aggregate) also passed
  5/5, against 3/5 in the baseline, though the tool has no rule for it.
- **P2: no finding at any point, and by the oracle no clean solve.** The tool returned `clean` on every call and on
  every step snapshot. Unlike the baseline, where 4 of 5 runs wrote points inside `PlaceOrder`, **none** of the five
  runs did: `PlaceOrder` saves only the order, and points are awarded by a sales-side handler of `OrderPlaced`,
  subscribed on the relay in `main.ts`, calling membership's published `awardPoints`. That is exactly the
  pre-registered over-rejection **P2-SG2-a** (proposed label legit-clean), the shape of baseline c07, and the shape the
  tool was built to stay quiet on. So the oracle's 0/5 and the tool's silence disagree for all five runs. The hand read
  decides. If the author accepts P2-SG2-a (and P2-SG1-b for c05's `pointsEarned <= 0` guard), P2 is 3/5. c01 and c03
  are functional failures either way.
- **Functional failures (separate, never clean or trapped).** P1 c11 fails the two daily-limit tests from step 2 on.
  P2 c01 and c03 fail the step-1 test "gold members get 10% off and silver 5%, shown separately" on the final tree.
  Each turn's harness type-check reported 0 errors. These failures are about behaviour, not architecture, and are not
  related to the tool.

## 2. Calls and isolation

| Phase | Cap | Used |
|---|---|---|
| Smoke | 1 | 1: passed on the note's criteria (see below) |
| MCP confinement probe | 1 | 1: passed |
| Sessions: 10 × 3 | 30 | 30: c01–c05, c07–c10, c11 (= the c06 redraw) |
| Redraws | 6 | 2: c06 step 1 completed, c06 step 2 was in flight when the container restarted (no result; recorded by hand in the ledger and counted as used) |
| **Total** | **38** | **34** |

- **CLI 2.1.307** (baseline 2.1.305). An exploratory difference, recorded in the plan before any call. Runner
  `release-66c6e19d9d-ext` (the baseline's), Ubuntu 24.04.5 LTS, Linux 6.18.44 x86_64, Node v22.22.0, npm 10.9.4.
- **Models.** Every completed turn (31) reports exactly `claude-sonnet-5-5` in `modelUsage`. Each turn completed on its
  first attempt, with no harness retry.
- **Smoke.** The server was listed to the CLI with all 12 tools, `check_consistency` included. Every server
  connection had `--confine`. The agent called `check_consistency` once (status `not-applicable` on the skeleton-only
  cell), with 0 permission denials. The driver also had a stricter check, that the agent's reply names the tool, which
  could not be observed: the envelope keeps only the final message, and that message answered the prompt's second
  half. The amendment is recorded in `run/smoke-result.json` (`verdictAmendment`). No extra call was made.
- **Confinement probe.** The agent called `check_consistency` with `project: /srv/w` (outside the work tree). It was
  refused with `confined:` (hub tap and frozen call log), with 0 permission denials.
- **Isolation verdict: achieved.** The baseline procedure, reused (`experiments/puzzle-02-tool-arm/isolation.md`):
  - The generator ran as uid 1500, through the baseline wrapper byte for byte.
  - The clone, runner, input, specs, call logs and records were in root-only directories, and the clone's former path
    was left empty and root-only.
  - The one addition: the MCP server ran as root behind a socket relay, so the generator never had the puzzle spec as
    a file. It saw only tool output: `get_architecture_spec` returns the parsed spec, by design of the arm.
  - Zero-call evidence (`isolation/`), as the generator user:
    - every listed path was denied, including the specs, the call logs and the server code;
    - the READ probe paths (P1 README at its former path, two canaries) were denied;
    - the fingerprint sweep over `/` found **0** readable files, with a positive control.
  - The first listing found the tsx compile cache `/tmp/tsx-0` readable. It was emptied and set to 0700 before the
    sweep and before any call.
  - After the container restart: re-sweep 0, and the listing still denied.
- **Container restart, c06.** The restart killed the driver during c06 (P1, run index 0) step 2. c06 was redrawn whole
  as c11 (P1's one redraw) with `--resume`. c06's completed step 1 is kept in the records but not scored.

## 3. Predictions (note §6)

| Prediction | Verdict |
|---|---|
| **P1.** Most runs are clean when the tool is called; the trap is flagged from step 1 with a concrete fix | **Held.** The tool was called in every run, flagged R-D4 at step 1 in 5/5, and 4/5 final trees are clean solves (the fifth is a functional failure with both oracles passing) |
| **P2.** Improves less than P1 | **Held** on the oracle count (0/5 vs 4/5), and also under the hand-read labels (3/5 vs 4/5). But the mechanism differs from the one predicted. The tool never fired. The runs avoided the in-command write anyway, and the handler stayed in sales instead of the earning rule moving into membership. The oracle fails that shape (P2-SG2-a) |
| **If P1 stays at 0/5** … the message is the problem, or the frame | **Not triggered** (P1 is 4/5) |
| A run that calls the tool, gets findings and still finishes trapped is read by hand | **Not triggered.** 0 such runs. c11 got findings, cleared them, and then failed tests |

## 4. Reading (dev, n = 5 per puzzle)

- On P1, 0/5 vs 4/5 is one of the extreme splits that 5 vs 5 can separate (R5): the Wilson intervals [0, .43] and
  [.38, .96] barely overlap. The tool-call log shows a direct path, finding → rewrite → clean call, within the step
  that introduces the trap.
- On P2, the comparison rests on the hand read: four baseline runs wrote points inside the command, and no tool-arm
  run did. The tool returned nothing on P2, so that shift cannot be credited to its findings. It may come from the
  instruction, or from the tool being present (first caveat below).
- P1 SG2 moved from 3/5 to 5/5 with no rule for it. That also points to more than the findings.

## 5. Changes after the plan commit (all logged here)

- `score-tool-arm.ts` was written after generation, as the plan said, and applies plan §5. Added after the scores were
  first seen: the **tool-call-grain caught-and-fixed** column. Design §5 names "per tool-call boundary from the trace"
  as a grain, but the plan's reading (b) used step snapshots only. **Treat this column as post hoc.**
- The smoke verdict amendment (§2 above).
- The c06 ledger line and the redraw were recorded by hand after the restart (the driver's `--resume` then ran the
  queue c11, c07–c10).

None of these changes a frame, a cap, an outcome definition or an oracle.

## 6. Caveats (note §7, verbatim)

- **Tool + instruction vs neither.** The arm's frame differs from `none` by the instruction to use an architecture
  tool, not only by the tool. The comparison is therefore tool + instruction vs neither, and it is exploratory. A
  placebo arm (the instruction with a tool that returns nothing) would separate the two, and is not proposed now.
- **Small n.** With 5 vs 5, only extreme splits (0/5 vs 4/5 or 5/5) are distinguishable (baseline plan R5; Wilson 95%
  for 0/5 is [0, .43] and for 4/5 is [.38, .96]).
- **Development material.** The detector was built and tuned on these puzzles' baseline trees, so its recall here is not
  an accuracy estimate. Its false-positive behaviour on these seeds and clean solutions is the relevant check, and was
  0 of the trees in §2.
- **Same vendor.** The generator and the authoring sessions are Claude models.
- **Not Study 2b.** This is the versioned exploratory instrument (v1.5-exp). It is never applied to Study 2b.

## 7. Hand read (author)

`results/v1.4-puzzle-02-tool-arm/oracle-verdicts-to-read.md` lists all 6 oracle FAILs on final trees: P2 SG2 in c01,
c03, c04, c05 and c10; P2 SG1 in c05. Each comes with its diff excerpt. No run got findings and still finished trapped.

Proposed categories:
- the five SG2 FAILs: P2-SG2-a (legit-clean);
- c05 SG1 (`placed.pointsEarned <= 0` in a sales handler): P2-SG1-b (legit-clean).

The functional failure c11 has no oracle FAIL. It is named here so that it is read too. All counts are
**provisional** until the author has read these.
