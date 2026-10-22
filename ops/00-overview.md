# Overview: where we are (2026-10-21)

## Working mode (from 2026-10-18; still in force)
1. **One research thread at a time.** The confirmatory thread (Study 2b) is collected and scored. The exploratory thread ([`notes/explore-01-research-log.md`](notes/explore-01-research-log.md)) runs beside it and never feeds it.
2. **Think before running.** Each idea gets a note covering: what we believe and why, worked examples by hand, what would prove us wrong, and a pre-mortem. You read it and we discuss it **before any model call**.
3. **Small pilots first**, e.g. the semantic layer on 2 cases. We read the outputs together, then decide whether to scale.
4. **The director comes in at the design stage**, not only for results.

**One sentence.** The deterministic instrument is correct on the projects where we have truth, and the confirmatory Study 2b has one registered scoring pass: both the richer spec and the MCP tool reduce new blocking violations, scoped to FF-S03 on four Layered tasks with one generator. The parts the thesis leans on hardest, *meaning* and the *neural* half, are still unmeasured against a key.

**Instrument map (draft v3):** [`01-instrument-map.md`](01-instrument-map.md) covers four planes and ten parts, the artifacts between them, the chain of trust (v3: the weakest link is C3m, meaning; C2r is second, `01-instrument-map.md:196`) and the ordered work left. It has been reviewed adversarially ([`notes/rev-01-instrument-map-fable.md`](notes/rev-01-instrument-map-fable.md)).

## Inventory (2026-10-21) → [`06-open-tracks-and-capabilities.md`](06-open-tracks-and-capabilities.md)
Every open track with a tag ([FRIDAY], [DRAFT-NEXT], [FUTURE-WORK], [DROPPED]) and every built capability with its maturity. Its list of status files that disagreed (end of Part A) was fixed on 2026-10-21; see the changelog below.

## Exploratory thread (from 2026-10-21) → [`notes/explore-01-research-log.md`](notes/explore-01-research-log.md)
Alongside Study 2b, and never feeding it: are agents stressed into architecture violations, which violations can the instrument detect (symbolic, semantic, or both), and do architecture puzzles measure whether the tool helps? HEXDDD-01 pilot done (FAIL on the pass bar; the blind hand read found 9 violations, none import-level). DETECT-01 (coverage map and 7 prototype rules) and PUZZLE-01 (4 dev puzzles, all valid) are on unmerged branches; their results are in log entry 7. Sources the thread and the thesis cite are consolidated in [`../Docs/sources/sources-ledger.md`](../Docs/sources/sources-ledger.md).

## Study 2b (confirmatory, SO5): done and scored once
- **Collected** 2026-10-20 to 2026-10-21T02:17Z: 40 of 40 blocks per cell, 520 step turns, 0 redraws (`../Docs/DiagnosticRuns/v1.4-study2b-collection-2026-10-20.md`; PR #337).
- **Scored once** at the freeze tag, zero model calls (`../Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`; PR #339). Mean D: `none@L2` 2.75, `none@L3` 1.70, `mcp@L2` 1.32.
- **H1** (richer spec) exact p 0.0132, RR 0.62; **H2** (MCP tool) exact p 0.0001, RR 0.48: both rejected after Holm and "supported" (D and D† agree). **H3** p 0.4257, not rejected. **E** (equivalence of the two treatments) fails, so nothing is claimed about them being equal.
- **Scope, as registered:** FF-S03 (composition-root wiring) carries 100 % of the counted identities; one generator (Claude Sonnet), Layered only, 4 sealed tasks. Ledger rows C8035–C8064; nulls M175–M186.
- **Not run in this pass:** D_sem (needs the C4 bars first), evasion items 4 (literal view) and 5 (blind read of moved-only diffs).

## Track 1: the instrument → [`track-1-instrument.md`](track-1-instrument.md)

| Objective | Status | One line | Next move |
|---|---|---|---|
| **SO1** Specs and style libraries | GREEN / AMBER | the libraries exist and are sealed; the 25 construct questions are answered and ADR-V13-03 is accepted under delegation (gate V1 GREEN, `../Docs/v1.4/study2b-gate-verdict.md`). Sources are not expert-reviewed | writing (SO3-a in Ch. 3) |
| **SO2** Property graph and tooling | GREEN core | matches tsc at 1.000 on 15 external repos, and is engine-independent (2b D8 parity: 30 of 30 identical). Type flow is reframed, and edges are not human-adjudicated | N33/N38 re-runs; A2 loader smoke run |
| **SO3** Neuro-symbolic gate | AMBER | judge 0.76 vs 0.80 was dropped; C4 + C1d replace it (F3, signed 2026-10-19). Both are built (PR #282) and ran exploratorily in 2a; neither has met its bar against a seeded key | C4 pilot, then the six cases |

| Link | 1 Code→graph | 2 Spec | 3 Rules | 4 Meaning | 5 Neural | 6 Delivery (MCP) |
|---|---|---|---|---|---|---|
| Status | GREEN | RED (brownfield); declared in greenfield | GREEN / AMBER | **RED** | AMBER (built, exploratory runs only) | GREEN for Claude on Layered (2b treatment); V9 a registered limitation |

## Track 2: at scale → [`track-2-scale.md`](track-2-scale.md)

| Objective | Status | One line | Next move |
|---|---|---|---|
| **SO4** Validity at scale | RED, one GREEN | 283/283 correct on human code. The hold-out is not scored (three attempts; not spent, DELEG-H4). Every developer-behaviour criterion is null. The rater labels come after the study | your hold-out choice (below) |
| **SO5** Spec level and agent code | GREEN (Study 1), GREEN within scope (Study 2b) | Study 1's effect runs in reverse; Study 2b supports H1 and H2 for FF-S03 on 4 Layered tasks, one generator | the 2b report |

## Earlier finding still in force: what rules cannot see → [`notes/ns-01-what-rules-cannot-see.md`](notes/ns-01-what-rules-cannot-see.md)
Of the 26 seeds behind the complementarity figure, the knowledge each one needs breaks down as follows:
- **12 are K0**: a rule we never wrote. The framework-leak operator plants only where no rule looks.
- **4 are K1**: a fact we don't extract yet.
- **9 are K2s**: literal copies.
- **Only 1 is K3**: it needs meaning, which is where a model is actually needed.

The framing that followed: **the model supplies grounded facts (K2m, K3) and the rules reason over them**; the model is not an open-ended judge. DETECT-01 extends this on hand-read cases (6 of 9 misses symbolically reachable given new facts, 3 semantic-only; dev, n = 2).

**North star:** [`04-north-star.md`](04-north-star.md). **Plan:** [`03-build-list.md`](03-build-list.md). **Deadline plan:** [`05-plan-to-friday-2026-10-23.md`](05-plan-to-friday-2026-10-23.md).

## Waiting on you
*Updated 2026-10-21. The signing sheet, the V4 ADR, X-1, SO3-a and the F3 rewording are settled (`decisions.md` D8, DELEG, DELEG2, V4-ACC).*
1. **The hold-out:** fix the spec format under its own addendum (that run would count as the first scoring), or report it as "not scored" (`decisions.md` DELEG-H4).
2. **HEXDDD-01:** the one allowed revision after its FAIL (a real-repo seed), or stop (research log, open items).
3. **PUZZLE-01:** the pilot budget and the next arm, after reading the baseline; which DETECT-01 detections to promote as a versioned instrument change.
4. **EFF-01:** run it (150 sessions) or move it to future work (inventory A8).
5. **MEAN-01:** book the rater session (about 2.5 h; target 2026-11-30).
6. **Evasion item 5:** the blind read of the moved-only diffs is a human read.

See [`decisions.md`](decisions.md).

## Next moves to Friday 2026-10-23
1. **C4 pilot** (pairs 1–2: 8 calls, cap 16), then the **six-case set** (32 calls, cap 64), against the sem-01 bars (`notes/sem-01-semantic-validity-plan.md` §2). If both pass: **D_sem** on 2b (`dsem-provenance.ts`, then `study2b-analyse.ts --dsem --dsem-nonagent`), descriptive. If either fails: D_sem is reported "not run".
2. **The 2b report** and the chapter section, from the results file and ledger rows C8035–C8064.
3. **The director brief:** the 2b result, its scope and what was not run.

**Running now** (per the inventory, 2026-10-21): the PUZZLE-01 baseline in the cloud (agent alone; 20 sessions, cap 72 calls; PR #338, do not merge). Nothing runs locally.

## Changelog
- 2026-10-21: rewritten to the current state: Study 2b collected and scored, the exploratory thread, what is running, a new waiting list, and the moves to Friday. Fixes conflict 1 of the inventory (`06-open-tracks-and-capabilities.md`, end of Part A).
- 2026-10-21: pointer to the open-tracks and capabilities inventory.
- 2026-10-21: pointer to the exploratory research log (EXPLORE-01).
- 2026-10-19: map v3 and its weakest link (C3m) stated; the waiting list replaced (L4, D1 and NS-01 were settled on 2026-10-18).
- 2026-10-18: the board's decisions are settled; the waiting list is down to three.
- 2026-10-18: link to the instrument map (draft).
- 2026-10-18: working mode added; current thread = neuro-symbolic; NS-01 written.
- 2026-10-18: first version.
