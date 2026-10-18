# What to build so the instrument matches the map

**The idea.** The instrument map ([`01-instrument-map.md`](01-instrument-map.md)) is the definition we agreed. This page lists what still has to be **built** so that the instrument matches it. Once everything here is done, we check the built instrument once, and then we run Study 2. The decisions behind each item are in [`decisions.md`](decisions.md).

**Status:** **Built** = exists and works. **Partial** = exists, with a known gap. **Not built.** **Out of scope** = the map defines it, but this thesis doesn't build it.

## P1 · Representation

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C1a/b Extract + fidelity | the graph is the code | **Partial.** Imports match tsc at 1.000 on 15 repos. Two extractor gaps: a `paths` alias (N33) and optional constructor parameters (N38) | fix N33 and N38 *(in progress)* | tsc parity still holds; the N38 seeds are detected | SO2 |
| C1c Query | Cypher on two engines, MCP tools for models | **Built** (parity 72,388 statements, 81 projects) | nothing; make the tool counts consistent in the docs *(in progress)* | — | SO2 |
| C1d Enrich (N1) | a model adds facts the parser can't, saved with their source | **Not built.** Design and mock only | the facts file (A2), a semantic layer that writes facts into it through the query layer, and six K3/K2m cases with twins *(design in progress)* | the 2-case pilot gives correct facts on both cases | SO3 |
| C1e Time and identity | the same violation can be followed across commits | **Partial.** Fix mining did this ad hoc | an identity rule for violations, as a reusable module *(spec in progress)* | the drift metric (C5) uses it | SO2, SO5 |

## P2 · Norms

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C2 Declared norms | style libraries and specs as declarative rules, with justified exceptions | **Partial.** Libraries sealed. Two rules missing | the **DDD cycle rule** (D5) and **application purity** (N3), each with an ADR and tests. A written construct limit for wiring imports (D2b) | both rules green in CI and declared as deviations | SO1 |
| C2 Mined or proposed norms | rules recovered from existing code | Partial (rule mining exists) | **out of scope.** Brownfield is exploratory (M2) | — | — |
| C2r Norm reliability | independent authors agree on the norms | κ 0.21, from two Claude sessions | **out of scope.** Stated as a limit | — | SO4 |

## P3 · Judgement

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C3 Detect | the graph held against the norms gives correct findings | **Partial.** Correctness 283/283. Blind recall 0.78, and four styles are below 0.90 (N105) | fix the general defects behind the blind-recall misses *(root-cause analysis in progress)* | blind recall ≥ 0.90 per Study 2 style, on development material | SO2, SO4 |
| C3m Meaning | a correct finding is an architectural problem someone would act on | **Not built.** 0 labels | a codebook, a sample of about 60 findings and a rater packet *(in progress)*. This is a procedure, not software | the codebook is dated and the rater session is booked | SO4 |
| C4 Interpret (N3) | exceptions and severity, judged in context | **Built** as the judge (F3). Under M4, interpretation runs through C1d's facts | nothing beyond C1d | — | SO3 |

## P4 · Use

| Part | What the map says | Today | Build | Done when | SO |
|---|---|---|---|---|---|
| C5 Drift | conformance across a window of commits | **Not built** as a metric | the **drift metric**, which is also Study 2's primary outcome (M3) *(design in progress)*. A description on human histories *(in progress)* | it runs on recorded agent sessions and on human histories | SO5 |
| C6 Control | the instrument in the agent loop and at the PR | **Built** (MCP server, CI gate) | the **evasion check** (M6) and the **Gemini generator adapter** (CDX) | both work on a dry run | SO5 |

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

## Changelog
- 2026-10-18: replaces the gap-closing plan with one build list per map part. The issue numbering, waves and gates are dropped as too complex.
