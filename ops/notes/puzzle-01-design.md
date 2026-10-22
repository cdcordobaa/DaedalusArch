# PUZZLE-01: architecture puzzles for measuring whether a tool helps an agent keep architecture

**Status:** design v1, 2026-10-21. Exploratory, method development. Written and committed **before** any puzzle was
built. **Zero model or generator calls** were made for it, and none are made by anything it describes until the
author approves the pilot in §9. Nothing here changes the instrument (`src/`, `presets/`, `scripts/lib/`,
`scripts/v1.3/`), the tag `v1.4-freeze-2026-10-20`, or any Study 2b file. Comments go in `> AUTHOR:` lines.

**Split.** Every puzzle built under this note lives in a public repository, so all of them are the **DEV split**:
method development and calibration only. Confirmatory puzzles must be authored fresh, by the same procedure, and
sealed the way the Study 2b tasks were: content hashes committed in the repository, content kept outside it until the
confirmatory runs are over. A DEV puzzle is never promoted to held-out.

## 0. Summary

- **Idea.** A composed board-game puzzle (a Yu-Gi-Oh puzzle duel, a chess study) has a known winning line, an obvious
  move that loses, and only one order of moves that wins. An **architecture puzzle** is a small brownfield codebase
  plus a multi-step change request in which the shortest working move breaks an architecture rule (the **trap**), a
  clean solution exists but needs a particular order of moves, and the functional tests pass for **both** the trap
  and the clean solution, so only architecture separates them.
- **Why.** HEXDDD-01 (PR #332, blind hand read at c18053641) showed a strong model resisting layer-leak pressure
  (vendor SDK, HTTP header, SQL) but committing consistency and ownership violations under "saved together or not at
  all" and cross-context pressure: D4 twice, D5 three times, D9 once, H5 once. Open-ended pressure steps elicit these
  only by luck; a puzzle makes the trap the shortest path on purpose and makes the clean line checkable.
- **Main trap mechanism: consistency and ownership** (D4, D5, D6/D10). Import-level traps (H2, H5, cycles) sit on
  the easy rungs and serve as the instrument-visible positive control.
- **Each puzzle carries its own oracle**: a small hand-written check of the specific violation, written with the
  puzzle, so "violation" is not defined by the DaedalusArch instrument. The instrument's verdict is recorded
  separately; agreement between the two is a validity result, not an assumption.
- **First build:** four DEV puzzles (§6), verified mechanically with zero calls (§7). **Pilot proposal** (not run):
  4 puzzles × 2 arms × 5 runs = 40 agent sessions, cap 44 (§9).

## 1. Definition

An architecture puzzle is a tuple **(seed, tasks, clean, trap, tests, oracle, card)**:

| Part | What it is |
|---|---|
| `seed/` | A small brownfield TypeScript tree that compiles under the harness tsconfig. It carries the precedents (§3) |
| `tasks.json` | 3–5 change requests, given one per agent session, in the pilot frame ("The current directory holds an existing TypeScript service. Change request: …"). Behaviour and constraints only; pressure sentences allowed; no style, layer, folder, port, aggregate or context names; no hint at the clean line |
| `solutions/clean/` | The full end state of the intended winning line |
| `solutions/trap/` | The full end state of the shortest working line, which commits the trap violation(s) |
| `tests/` | Black-box behaviour tests through the tree's existing entry point. They pass on clean **and** trap |
| `oracle` | A script that judges the specific violation(s): passes on clean, fails on trap, one verdict per sub-goal |
| `README.md` | The winning line (ordered moves), the trap line, why the trap is shorter, the family of each trap |
| card | A case-bank card (§8) |

**The three properties** (each mechanically verified, §7):

1. **Trap property.** The trap end state is shorter to reach from the seed than the clean end state (measured as
   changed lines and touched files against the seed), it works (tests pass), and it breaks the rule (the oracle
   fails it).
2. **Winning-line property.** The clean end state exists, works (tests pass), and keeps the rule (the oracle passes
   it). Its README states the order of moves and which move must come first (usually: put the mechanism or the
   owner in place before the feature that needs it).
3. **Indistinguishability property.** Tests pass on both, so functional correctness cannot separate them; only
   architecture can.

A **sub-goal** is one task step with its own trap. A multi-sub-goal puzzle has one oracle verdict per sub-goal, so
per-sub-goal success can be scored.

## 2. Retrograde construction (checklist)

Puzzle composers work backwards from the winning combination. The procedure, in order, for each puzzle:

- [ ] **R1 Pick the rule and family.** Name the family (H1–H7, D1–D11 of HEXDDD-01 §3), its P1–P4 source sentence,
      and whether the instrument can see it (class i–iv). Prefer families the pilot showed a strong model breaks.
- [ ] **R2 Write the clean end state first.** The smallest tree in which the feature exists and the rule holds.
      Write the tests against it, through the entry point the seed will already have.
- [ ] **R3 Derive the seed by removing the feature.** Delete what the task will ask for. Keep the clean mechanism
      available if the rung says so (an outbox, a public API, a port) and note it.
- [ ] **R4 Plant the temptation.** Add the precedent (a trap-shaped existing function, or none) and the pressure
      (urgency, "small change", "saved together or not at all", a vendor type close at hand). Record it as planted
      debt; the oracle ignores planted debt and counts copies of it.
- [ ] **R5 Write the trap end state.** The shortest change from the seed that passes the tests. If a shorter
      working change exists that keeps the rule, the puzzle has no trap: go back to R4.
- [ ] **R6 Write the task text** so the shortest path is the trap: describe the behaviour, include the pressure,
      never the design. Run the hint audit (`Docs/v1.3/study2-task-design/hint-audit.mjs`) with the puzzle's spec.
- [ ] **R7 Write the oracle** for the specific violation, from the rule's source sentence, without looking at the
      instrument's output. One verdict per sub-goal.
- [ ] **R8 Verify mechanically** (§7). A failure marks the puzzle INVALID; a fix is allowed only as a logged
      revision (`revisions` in `verification.json`), never silently.
- [ ] **R9 Record the instrument's view** of seed, clean and trap, separately from the oracle.
- [ ] **R10 Write the card** (§8) and the README.

## 3. Difficulty ladder

| Parameter | Levels | Effect expected |
|---|---|---|
| **T** traps (sub-goals with a trap) | 1, 2, 3 | more chances to fail; pass^k falls fast |
| **S** steps | 3, 4, 5 | longer horizon; later steps build on earlier choices |
| **Dst** distance from the rule's owner to the edit site | 0 = same file, 1 = same module, 2 = another layer, 3 = another context | the agent must look further to see the owner |
| **Pd** precedent debt | 0 none; 1 a clean precedent only; 2 a trap-shaped precedent in the seed | a trap precedent reads as house style (T6 of HEXDDD-01) |
| **Dx** distractors | 0, 1, 2 (irrelevant but plausible files, a near-miss helper) | search cost |
| **V** instrument visibility | visible (class i), partial, invisible (class iv) | sets which arm can benefit |

**Initial rating:** `rung = 1 + [T ≥ 2] + [S ≥ 4] + [Dst ≥ 2] + [Pd = 2] + [Dx ≥ 1]`, range 1–6; reported
with the parameter vector, never alone. Rung 1–2 are easy (import-level, one trap). Rung 3–4 are the target band for
a strong model (consistency or ownership, two traps). Rung 5–6 are ceiling probes. The rating is a prior; the pilot
calibrates it (a rung whose `none` arm solves 5/5 is mis-rated or is a ceiling).

## 4. Arms

| Arm | Agent | Why |
|---|---|---|
| `none` | the agent alone, pilot frame | baseline |
| `mcp` | the agent with the DaedalusArch MCP tool (the spec tools of the Study 2 allow-list, read-only, with the puzzle's spec) | the treatment |
| `placebo` | the agent with a tool that has the same name shape, the same call signature and comparable latency, and returns a fixed, plausible, rule-free text (for example a file list and "no issues found") | separates the effect of the **rules** from the effect of **having a tool to call**: a reminder that architecture is being checked, extra turns, extra reading |

**Why the placebo.** Any arm with a tool changes the agent's behaviour even if the tool says nothing: more steps,
more reading, a cue that "architecture" matters. Without a placebo a positive `mcp` effect cannot be attributed to
the rules. The placebo is the null-information control. Its text is fixed before any call and hint-audited like the
frames. Tool calls are logged in all three arms (the placebo's call rate is itself a result).

## 5. Outcomes

Per run (one agent working through all steps of one puzzle):

| Outcome | Definition |
|---|---|
| **clean solve** | every sub-goal's oracle passes on the final tree **and** the tests pass |
| **clean-solve rate** | clean solves / runs, per puzzle × arm, Wilson interval |
| **pass^k** | 1 if all k runs of a puzzle × arm are clean solves (τ-bench style reliability); reported with the plug-in estimate `C(c,k)/C(n,k)` |
| **caught-and-fixed** | a sub-goal's oracle fails on some intermediate snapshot (per step, or per tool-call boundary from the trace) and passes on the final tree; counted per sub-goal, per arm. In `mcp` it is also linked to whether a tool call preceded the fix |
| **per-sub-goal success** | oracle pass rate per sub-goal, so a 3-trap puzzle shows *which* trap catches |
| **functional failure** | tests fail on the final tree; reported separately, never counted as clean or as trapped |
| **instrument agreement** | per sub-goal, the oracle verdict against the instrument's (new correct blocking findings vs the seed); a 2×2 table per family |

Secondary: changed lines, steps to first clean tree, tool calls per step, the placebo call rate.

**Blind-control puzzles.** Some traps are invisible to the instrument by construction (class iv: D4 cross-aggregate
or cross-context writes, D5 rule placement, D10 duplication, H5 without a vendor import). On those sub-goals the
`mcp` arm should **not** beat `placebo`: the tool reports nothing about them. If it does, the effect is generic
attention (the tool's presence), not the rules, and it bounds what the visible-trap effect can be attributed to.
Each puzzle's README and card mark every sub-goal visible / partial / invisible from the verification run (§7), not
from the design intent.

## 6. The first four DEV puzzles

| Id | Theme | Families | Sub-goals | Instrument visibility (expected) | Rung (T, S, Dst, Pd, Dx) |
|---|---|---|---|---|---|
| **P1** `p1-transfers` | DDD, one context, money transfer between two accounts, daily limit, statements | D4 (two aggregates saved in one flow), D5 (limit checked outside the aggregate) | 2 | invisible: blind control | 4 (2, 3, 1, 1, 0) |
| **P2** `p2-loyalty` | DDD, two contexts (checkout, rewards): member tier discount, threshold change, points earned on order | D6 / D10 (tier rule reached across the boundary or duplicated), D4 cross-context (synchronous write into the other context) | 2 | partial: D6 visible, D10 and D4 invisible | 5 (2, 3, 3, 2, 0) |
| **P3** `p3-shipping-quotes` | Hexagonal, vendor rates SDK, fallback, caching | H5 (vendor type or caching mechanism in the port), H2/H1b (vendor import in the core) | 2 | partial: import visible, H5 shape invisible | 4 (2, 3, 2, 2, 0) |
| **P4** `p4-library-holds` | Layered, overdue loans suspend a member | H7-like cycle / upward dependency (persistence → business) | 1 | visible: positive control | 1 (1, 3, 1, 0, 0) |

The winning line of each puzzle puts the **owner or mechanism first** (the event and its handler before the transfer;
the published tier query before the discount; the port in domain terms before the adapter; the business rule before
the store change), then the feature. The trap line writes the feature where the request lands.

## 7. Mechanical verification (zero calls)

For each puzzle, recorded in `experiments/puzzle-01/verification.json`:

1. `tsc` (harness tsconfig shape, strict) on seed, clean and trap: 0 errors each.
2. Tests on clean and trap: all pass. Tests on the seed: the feature tests fail (the feature is absent), the
   regression tests pass.
3. Oracle on clean: every sub-goal passes. Oracle on trap: every trapped sub-goal fails. Oracle on seed: passes
   (planted debt ignored).
4. Trap shorter than clean: changed lines and files against the seed.
5. Instrument (`experiments/puzzle-01/tools/instrument-score.ts`, the pilot's zero-call evaluation path on
   `cypher-interp`, check-correct on blocking findings) on seed, clean and trap; visibility per sub-goal = whether
   trap has a new correct blocking finding the clean tree does not.
6. Hint audit of `tasks.json` with the puzzle's spec (0 FAIL; WARNs given a written verdict).

A puzzle failing 1–4 or 6 is **INVALID** until a logged revision fixes it. Step 5 never invalidates a puzzle: it is a
measurement.

## 8. Case bank

`experiments/puzzle-01/case-bank/` holds one YAML card per puzzle and one per observed agent error, so every puzzle
and every error is reusable (as a seed for a new puzzle, a regression case for the instrument, or a held-out item if
re-authored). Card format:

```yaml
id: <puzzle or observation id>
kind: puzzle | observation
split: dev | held-out
family: [D4]                 # H1-H7, D1-D11
source_sentence: "<P1-P4 sentence>"
provenance:
  origin: authored | agent-run
  commit: <sha>              # where the evidence is
  file_line: <path:line>     # observations only
  run: <run/step>            # observations only
judge:
  method: oracle | coordinator blind hand read | author
  confidence: low | medium | high
  spot_check: pending | done
instrument:
  verdict: visible | partial | invisible | n/a
  rules: [FF-..]             # matching rules, if any
notes: "<one or two sentences, no chat text>"
```

## 9. Pilot plan (proposed, NOT run here)

- **Design:** 4 DEV puzzles × 2 arms (`none`, `mcp`) × 5 runs = **40 agent sessions** (one session per run, all steps
  of the puzzle in sequence, one step per turn as in HEXDDD-01), one generator (`claude-sonnet-5-5`, CLI at a recorded
  pin). **Hard cap 44** (one infrastructure redraw per puzzle × arm cell). `placebo` is added only after the pilot
  shows an `mcp` vs `none` difference worth attributing (+20 sessions, separate approval).
- **Scoring (zero calls):** tests, oracles and the instrument per step snapshot; caught-and-fixed from step snapshots
  (tool-call grain needs the trace).
- **Questions:** does each puzzle discriminate (`none` clean-solve rate strictly between 0 and 1)? Does the rung order
  hold? Do oracle and instrument agree where the instrument should see?
- **Go/no-go for a registered study:** at least 2 puzzles with `none` clean-solve rate in [0.2, 0.8].
- **When:** only with the author's written approval, and not while Study 2b scoring uses the machine.

## 10. Threats to validity

| Id | Threat | Mitigation |
|---|---|---|
| V1 Artificiality | Small, composed trees; the trap is planted, so the rate is a property of the puzzle, not of real work | Report rates per puzzle, never pooled as "the" violation rate; anchor families in observed errors (HEXDDD-01 cards); later puzzles derived from real repositories at a pin |
| V2 Leakage | DEV puzzles are public; future models may train on them; task text could hint at the line | DEV split only; confirmatory puzzles authored fresh and sealed (hashes in repo, content outside); hint audit on every task text |
| V3 Oracle bias | The oracle is written by the puzzle author with the clean solution in mind; it may reject other clean designs or accept other traps | Oracles check the rule, not the shape of the author's solution where possible; each oracle states its limits in its header; every oracle failure on an agent tree is hand-read before it counts in the pilot |
| V4 Ceiling / floor | A strong model may solve all (ceiling) or none (floor) | The ladder (§3) and the go/no-go band; rung re-rated from the pilot |
| V5 Same vendor | Claude sessions wrote the puzzles, the oracles and the trap lines, and Claude generates | Author spot-check of every puzzle; a second-vendor arm as a dated extension; stated as a limitation |
| V6 Instrument circularity | If the oracle were the instrument, `mcp` would be graded by its own rules | Independent oracles (§1); agreement reported as a validity result; blind-control sub-goals (§5) |
| V7 Test weakness | Tests that pass on both may also pass on broken trees | Seed regression tests; feature tests must fail on the seed (§7 item 2) |

## Changelog

- 2026-10-21 v1: first version, before any puzzle was built.
