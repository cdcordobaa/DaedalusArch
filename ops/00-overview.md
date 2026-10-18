# Overview: where we are (2026-10-18)

## Working mode (from 2026-10-18)
1. **One research thread at a time.** Now: **the neuro-symbolic question** ([`notes/ns-01-what-rules-cannot-see.md`](notes/ns-01-what-rules-cannot-see.md)). The Study 2 pipeline is **paused for about a week**.
2. **Think before running.** Each idea gets a note covering: what we believe and why, worked examples by hand, what would prove us wrong, and a pre-mortem. You read it and we discuss it **before any model call**.
3. **Small pilots first**, e.g. the semantic layer on 2 cases. We read the outputs together, then decide whether to scale.
4. **The director comes in at the design stage**, not only for results.

**One sentence.** The deterministic instrument is correct on the projects where we have truth. The parts the thesis leans on hardest, *meaning* and the *neural* half, are still unmeasured. Study 2 is designed and runs once, earliest about Nov 18–22, and only if the pilot clears its bar.

**Instrument map (draft v2):** [`01-instrument-map.md`](01-instrument-map.md) covers four planes and ten parts, the artifacts between them, the chain of trust (the weakest link is C2r, norm reliability) and the ordered work left. It has been reviewed adversarially ([`notes/rev-01-instrument-map-fable.md`](notes/rev-01-instrument-map-fable.md)).

## Track 1: the instrument → [`track-1-instrument.md`](track-1-instrument.md)

| Objective | Status | One line | Next move |
|---|---|---|---|
| **SO1** Specs and style libraries | GREEN / AMBER / RED | the libraries exist and are sealed. Sources are not expert-reviewed, and the construct answers are not confirmed | you confirm D1 |
| **SO2** Property graph and tooling | GREEN core | matches tsc at 1.000 on 15 external repos, and is engine-independent. Type flow is reframed, and edges are not human-adjudicated | D6 |
| **SO3** Neuro-symbolic gate | AMBER / RED | judge 0.76 vs 0.80. "Rules + model beat either alone" is not shown. The semantic layer has never run on a real model | thinking note first (D4) |

| Link | 1 Code→graph | 2 Spec | 3 Rules | 4 Meaning | 5 Neural | 6 Delivery (MCP) |
|---|---|---|---|---|---|---|
| Status | GREEN | RED (brownfield) | GREEN / AMBER | **RED** | **RED** | AMBER |

## Track 2: at scale → [`track-2-scale.md`](track-2-scale.md)

| Objective | Status | One line | Next move |
|---|---|---|---|
| **SO4** Validity at scale | RED, one GREEN | 283/283 correct on human code. The hold-out is not run. Every developer-behaviour criterion is null. There is no rater | you decide D3 |
| **SO5** Spec level and agent code | GREEN (Study 1), RED (Study 2) | the floor effect is the main risk. DDD reaching the bar is about a coin flip. Readiness is 1/42 green (Oct 16) | zero-cost re-scores B2 and T1 |

## Current thread: neuro-symbolic → [`notes/ns-01-what-rules-cannot-see.md`](notes/ns-01-what-rules-cannot-see.md)
**Main finding of the note.** Of the 26 seeds behind the complementarity figure, the knowledge each one needs breaks down as follows:
- **12 are K0**: a rule we never wrote. The framework-leak operator plants only where no rule looks.
- **4 are K1**: a fact we don't extract yet.
- **9 are K2s**: literal copies.
- **Only 1 is K3**: it needs meaning, which is where a model is actually needed.

The experiments so far tested the wrong level. The proposed framing: **the model supplies grounded facts (K2m, K3) and the rules reason over them**, as in IRIS and LLift. The model is not an open-ended judge.

**North star:** [`04-north-star.md`](04-north-star.md). Each part passes its own test; the whole instrument is checked for applicability and validity; each objective needs both. **Plan:** [`03-build-list.md`](03-build-list.md). Build what the map defines, check the built instrument once, then run Study 2.

## Waiting on you
1. **L4:** the definition of a meaningful finding. It blocks the codebook and the rater's labels.
2. **D1:** the changes you want made to the decision sheet.
3. **Read NS-01.** It blocks the 2-case pilot.

Everything else was settled on 2026-10-18. See [`decisions.md`](decisions.md).

## What the agent does next (zero model calls)
Within the current thread, after you have read NS-01:
- read IRIS and LLift in full;
- draft the hand-written K3/K2m case set (expected answers first).

Study 2 work (B2, T1, F23, the prerequisites) waits until the thread pauses.

**Running now:** nothing.

## Changelog
- 2026-10-18: the board's decisions are settled; the waiting list is down to three.
- 2026-10-18: link to the instrument map (draft).
- 2026-10-18: working mode added; current thread = neuro-symbolic; NS-01 written.
- 2026-10-18: first version.
