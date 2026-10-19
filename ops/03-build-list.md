# What to build so the instrument matches the map

**Focus (2026-10-18): greenfield first.** Norms are *declared* up front, from the spec and the style library. Brownfield, where an LLM derives the norms from an existing codebase, runs **in parallel as an exploratory track**, so it produces results of its own.

**The idea.** The instrument map ([`01-instrument-map.md`](01-instrument-map.md)) is the definition we agreed. This page lists what still has to be **built** so that the instrument matches it. Once everything here is done, we check the built instrument once, and then we run Study 2. The decisions behind each item are in [`decisions.md`](decisions.md).

**Status:** **Built** = exists and works. **Partial** = exists, with a known gap. **Not built.** **Out of scope** = the map defines it, but this thesis doesn't build it.

## P1 · Representation

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C1a/b Extract + fidelity | the graph is the code | **Partial.** Imports match tsc at 1.000 on 15 repos. Two extractor gaps: a `paths` alias (N33) and optional constructor parameters (N38) | fix N33 and N38: **PR #253** (open, not merged). N33: `domain` is a Node built-in, so `domain/...` imports were taken as a package before tsconfig aliases were tried; this also explains N32 (felixle, 106 edges). N38: under `strictNullChecks`, `x?: T` has no symbol, so no injection edge was written. Seeded check: 0/40 → 40/40. The 4 express `Request` seeds have a different cause: no rule covers express in application layers, which **U2's application-purity rule (N3) closes**. Still to do: re-run DDH, msc29 and felixle once their clones exist | tsc parity still holds; the N38 seeds are detected | SO2 |
| C1c Query | Cypher on two engines, MCP tools for models | **Built** (parity 72,388 statements, 81 projects) | nothing; make the tool counts consistent in the docs *(in progress)* | — | SO2 |
| C1d Enrich (N1) | a model adds facts the parser can't, saved with their source | **Not built.** Design and mock only | the facts file (A2), a semantic layer that writes facts into it through the query layer, and six K3/K2m cases with twins. Cases and contract: **done** (`ops/notes/ns-02-facts-contract-and-cases.md`, `tests/fixtures/v1.3-ontology/ns02/`). Still to build: the one-context fragmentation change (case-05 needs it), a Gemini route, and a replacement for case-06, which cheap proxies already catch, so it isn't K3. Pilot: 26 calls at 2 runs (cap 40), or 13 at 1 run read as facts | the 2-case pilot gives correct facts on both cases | SO3 |
| C1e Time and identity | the same violation can be followed across commits | **Partial.** Fix mining did this ad hoc | an identity rule for violations, as a reusable module. Spec: done (`ops/notes/g08-violation-identity.md`). It found **four different identity keys in use, and a broken cycle key in the loop**. Renames count as deaths in survival (45 of 233 blocking disappearances), so the published survival figures (N123) need a re-check once U4 lands | the drift metric (C5) uses it | SO2, SO5 |

## P2 · Norms

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C2 Declared norms | style libraries and specs as declarative rules, with justified exceptions | **Partial.** Libraries sealed. Two rules missing | the **DDD cycle rule** (D5) and **application purity** (N3), each with an ADR and tests. A written construct limit for wiring imports (D2b) | both rules green in CI and declared as deviations | SO1 |
| C2 Derived norms (brownfield) | an LLM derives the implicit norms from the graph, the code, the style and the docs (role N2), and each rule cites its evidence | Partial (deterministic rule mining exists, N07) | **Exploratory track, running in parallel now** (author, 2026-10-18). A design note: **done** (`ops/notes/bf-01-brownfield-norm-derivation.md`). It has three arms: graph facts plus files, files only, and deterministic mining. The pilot is 12 sessions (at most 14) on 2 repos. The full run is 90 sessions (at most 99). Main risk: both reference spec sets were written by Claude, so a Gemini arm (via U3's route) would test for shared priors and a zero-call deterministic baseline against the 15 declared specs: **done** (`Docs/DiagnosticRuns/v1.3-brownfield-mined-baseline-2026-10-18.md`). Mapping recall and precision are 0.47 / 0.47. Rule recall is 0.41 at precision 0.86. The verdict matches on 13/15, but mostly through base rates. Blocking-finding recall is 6/273, against 184/273 for blind author B. Most of the loss comes from the layer map. The miner missed all 3 DDD repos. **LLM pilot: done** (`Docs/DiagnosticRuns/v1.3-brownfield-llm-pilot-2026-10-19.md`): 12 sessions on 2 repos. Files only (R): mapping 0.82/0.87, rules 28/36, blocking findings 27/27. Graph plus files (G): 0.65/0.91, 18/36, 18/27; one session's evidence didn't parse, and G cited no graph statistics. On the same pair the miner got 0/9 and B 0/9. All citations verified. Shared-prior risk: no cross-vendor arm yet. Next: fix the G arm, add an agy/Gemini arm, then the full 15-repo run (90 sessions, needs your OK) | the pilot reports derived-vs-declared recall, precision and verdict agreement | SO1, SO3 |
| C2r Norm reliability | independent authors agree on the norms | κ 0.21, from two Claude sessions | **out of scope.** Stated as a limit | — | SO4 |

## P3 · Judgement

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C3 Detect | the graph held against the norms gives correct findings | **Partial.** Correctness 283/283. Blind recall 0.78, and four styles are below 0.90 (N105) | Root-cause analysis **done** (`Docs/DiagnosticRuns/v1.3-blind-recall-gap-2026-10-18.md`). The 14 misses split into 5 rule or template gaps and **9 spec–manifest disagreements**; extractor gaps account for 0. The rule fixes reach only clean 0.86, Layered 0.80, NestJS 0.77, Hexagonal 0.83, DDD 1.00. Build: the 3 rule fixes, with ADRs. **You:** adjudicate the 9 disagreement rows before the freeze, since they can't be adjudicated after the hold-out | blind recall ≥ 0.90 per Study 2 style against the adjudicated reference, on development material | SO2, SO4 |
| C3m Meaning | a correct finding is an architectural problem someone would act on | **Not built.** 0 labels | codebook, sample and rater packet: **done**. 60 of 784 eligible findings, 38 repos, seed 20261018, about 2 h 25 min for the rater (`ops/notes/mean-01-codebook-and-sample.md`; packet in `audit/view/`). Still to build: the analysis script. **You:** sign off L4 and readings R3–R5 | the codebook is dated and the rater session is booked | SO4 |
| C4 Interpret (N3) | exceptions and severity, judged in context | **Built** as the judge (F3). Under M4, interpretation runs through C1d's facts | nothing beyond C1d | — | SO3 |

## P4 · Use

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C5 Drift | conformance across a window of commits | **Not built** as a metric | the **drift metric**, which is also Study 2's primary outcome (M3). Design: done (`ops/notes/s2d-01-study2-drift-design.md`). It is reviewed in REV-03, which asks for a two-task pilot, a second dated deviation, and naming D as the propagation of step-1 habits. Implementation: **AI-DLC unit U4**. A description on human histories: **done** (`Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md`) | it runs on recorded agent sessions and on human histories | SO5 |
| C6 Control | the instrument in the agent loop and at the PR | **Built** (MCP server, CI gate) | the **evasion check** (M6) and the **Gemini generator adapter** (CDX) | both work on a dry run | SO5 |

## Being built now (AI-DLC v1.4, started 2026-10-18)
The code items above run as AI-DLC units: U2 norm rules, U3 semantic facts, U4 identity and drift, U5 evasion check and Gemini adapter, U7 meaning analysis, U8 efficiency harness (design done in `ops/notes/eff-01-efficiency-design.md`; 150 sessions, which need your OK before any run). U6, the recall fixes, is design only until you adjudicate the 9 rows. U1 is the extractor fixes, in progress. Each unit ends in a PR that is not merged. **Your review of that PR is the code-approval gate.**

**Amendment A1 (2026-10-19): the graph complements reading.** It is added to U3 (a follow-up on PR #254) and U8 (before its design is fixed). See `aidlc-docs/construction/v1.4/U3/amendments/` and `U8/amendments/`, and `ops/notes/ns-03-graph-complements-reading.md`.

## Then: check the built instrument once, before Study 2

Each check is counted first, and you OK it before it runs.

1. **Freeze** the instrument.
2. **Hold-out** run once (C3). Before it, **F23**, which you do alone.
3. **Meaning labels:** the rater plus you (C3m). Needs **L4** from you.
4. **2-case neuro-symbolic pilot** (C1d). Needs you to have **read NS-01**.
5. **Efficiency test** (C1c, M5).

Then **Study 2**, with its reviewed design taken to the director first.

## What's waiting on you
- **D1:** your changes to the decision sheet.
- **L4:** what counts as a meaningful finding.
- **F23:** the overlap check, which only you may do.
- **NS-01:** read it.
- **The 9 disagreement rows (C3):** for each, decide whether the spec or the blind manifest is right. This has to happen before the freeze.

## Changelog
- 2026-10-18: replaces the gap-closing plan with one build list per map part. The issue numbering, waves and gates are dropped as too complex.
