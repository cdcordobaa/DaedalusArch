# PUZZLE-02 tool arm `mcp-detect` on P1 and P2: run note (DRAFT, for the author)

> **DRAFT, not approved, nothing launched.** This proposes an exploratory run. No generator call, cloud session or
> run has been started. The run starts only with the author's written go.

## 1. Question

Can agents see the puzzle-trap violations through a tool and act on them? Compared with the existing baseline arm
`none`, does `mcp-detect` raise the clean-solve rate on P1 (`p1-transfers`) and P2 (`p2-loyalty`)?

Baseline (`results/v1.4-puzzle-01-baseline`, earlier `results/puzzle-01-baseline`):
- P1: 0/5 clean;
- P2: 0/5 clean, or 1/5 if the pre-registered over-rejection case c07 is accepted;
- these counts stay provisional until the author's hand read.

## 2. What the tool sees (zero calls, done)

`check_consistency` was called through the MCP layer on the baseline trees and the puzzle solutions; see
`experiments/detect-02/results/zero-call-check.json`:
- it flags every P1 and P2 trap tree: all 15 P1 trees from step 1, the 4 trapped P2 trees at step 3, and the P1/P2
  trap and trap-alt solutions;
- it stays quiet on c07 step 3 (legit-clean), on the earlier P2 steps, on the clean solutions and seeds, and on all
  18 P4 trees;
- median latency is under 0.1 s per call.

This is development evidence: the rules were built while looking at these trees.

## 3. Design

| Item | Value |
|---|---|
| Arm | `mcp-detect`: the experimental server `experiments/detect-02/mcp/main.ts --spec <puzzle spec> --project <work tree> --engine cypher-interp --confine --call-log <outside the tree>`. It serves the frozen tools unchanged, plus `check_consistency` (symbolic, no model call inside the tool) |
| Comparator | the existing baseline arm `none` (not re-run) |
| Puzzles | P1 and P2 only. P4 is not run (its family is not in scope) |
| Runs | 5 per puzzle, 10 sessions in all |
| Session | all 3 steps of the puzzle in one session, one step per turn, in one work tree. 0 repair turns |
| Generator, pins, image, isolation | identical to the baseline (`experiments/puzzle-01-baseline/plan.md` §1, `isolation.md`): `claude-sonnet-5-5`, Claude Code CLI at the baseline pin (the same version is recorded and checked before the run), the same container image and runner, Node, the unprivileged generator user with root-only directories, the same per-turn timeout, the same seeds (`ARCHITECTURE.md` included), the same order seed scheme. The only difference is the frame sentence below and the MCP server added to the allowed tools (`mcp__daedalus-arch__*`) |
| Mode | pull (the agent calls the tool). The push gate (`push-gate.ts`) is not used in this run |
| Frame | the baseline frame verbatim, plus the sentence in §4 |
| Scoring | zero calls, as in the baseline: tests, oracle per sub-goal, `check_consistency` per step snapshot, and the hand read of oracle FAILs |
| Tool calls | logged with the frozen call log for the record only. This run does **not** study how often the tool is called; that is a separate, future study |

## 4. Frame sentence (exact text, hint-audited)

> An architecture tool is available to you as an MCP server. Its check_consistency tool reports where a command
> breaks a consistency boundary of the domain model, with the file, the rule and a suggested change. Call
> check_consistency after you change code that saves data or code that calls another part of the system, and always
> before you finish. If it reports findings, address them before you finish.

Hint audit: `experiments/detect-02/mcp/hint-audit/frame-audit.txt`.
- Settings: `hint-audit.mjs`, rung L3, each puzzle's spec, and the 51 puzzle, feature and harness terms of the
  baseline audit.
- Result: **0 FAIL on P1 and P2**.
- Five WARNs: "architecture", "boundary", "domain", "model", "file". These are the generic words the sentence needs.
- The sentence names no task, step, feature, aggregate, context, trap or fix of either puzzle. The rule text and the
  fix hint come only from the tool's output, at run time, about the agent's own code.

## 5. Budget and caps (hard, never raised)

| Phase | Calls |
|---|---|
| Smoke (one turn, with the MCP server attached; checks that `check_consistency` is listed and confined) | 1 |
| Confinement probe of the MCP arm (a `project` argument outside the work tree must be refused) | 1 |
| Sessions: 10 × 3 step turns | 30 |
| Redraws: at most one infrastructure redraw per puzzle (3 turns each) | 6 |
| **Total cap** | **38** |

Every CLI spawn is written to the run's `calls.jsonl` and refused past the cap. The tool itself makes no model call.

## 6. Predictions (written before any run)

- **P1.** Most runs are clean when the tool is called. The trap (`saveAll([from, to])` or two saves) is flagged from
  step 1 with a concrete fix, and the seed already has the event and relay mechanism to use.
- **P2.** Improves less than P1. Removing the cross-context write means restructuring: an event subscribed in the
  composition root, and an earning rule moved into membership.
- **If P1 stays at 0/5 clean** while the call log shows the tool was called and returned findings, then the message is
  the problem (wording, fix hint, or when it arrives), not the detection. If the tool was not called, the frame is the
  problem.
- A run that calls the tool, gets findings, and still finishes trapped is read by hand: did it try and fail to type-check
  or pass tests, or did it ignore the finding?

## 7. Interpretation caveats (state in the report)

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
