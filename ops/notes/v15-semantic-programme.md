# V15-SEM: the semantic programme of instrument v1.5

**Status:** v1, 2026-10-22. A planning note; nothing was run for it. It replaces the short §2 of `ops/notes/v15-plan.md`.

**Why this programme.** The thesis title promises a neuro-symbolic instrument. Today the symbolic half is validated: Study 2b and the v1.3 validity work. The semantic half is built and promising, but not shown. v1.5 is the semantic version.

**Rule.** All work here is exploratory and runs on development material: fixtures, puzzles, hand-read cases, and the human DDD repositories. Each pilot gets its own short note before any call, covering the scenarios, edge cases, predicted result and what would count as failure. Validation is label-free where it can be: twins, grounded citations, stability across runs, and abstention (`ops/notes/sem-01-semantic-validity-plan.md`). Where a truth exists (fixtures, declared specs, puzzle oracles), it is used.

## Where the model is needed, and the test for each

| Role | What the model does | Why rules cannot | Evidence so far | Test |
|---|---|---|---|---|
| **S1. Interpret findings (C4)** | Says whether a finding is an exception or a violation, what the intent was, and how severe it is | Intent lives in prose and context | Study 2b precondition (`Docs/DiagnosticRuns/v1.4-study2b-semantic-2026-10-22.md`): pilot passed; six-case set 5/6, with 0 false exception claims. The one failure is the **severity** of one near-miss twin | A severity rubric, then the six-case set plus new cases; twins and stability |
| **S2. Confirm symbolic candidates** | The rules propose a candidate with exact lines; the model confirms or rejects it, citing the code | Rule placement (D5) escapes the rules in its "lock" form | Symbolic D5 caught 11 of 16 dev cases; all 5 misses are the lock form | Lift in precision and recall over the rules alone, on the dev fixtures and their twins |
| **S3. Supply facts (C1d)** | Says which classes are aggregates and which context owns what, when the spec is silent | Without declared aggregates the rules guess | On 13 human DDD repositories: 12 false hits with inferred roots, against 1 true hit with declared roots (`ops/notes/detect-02-precision-note.md`) | Do the model's facts remove the false hits and keep the true one? Repositories with declared specs give the truth |
| **S4. Infer the spec (BF-01 v3)** | Infers architecture-as-code from the code, the docs and the graph, then refines it from interpreted findings | No one wrote the rules down | BF-01 pilots (`Docs/DiagnosticRuns/v1.3-brownfield-llm-*-2026-10-19.md`): the derived spec recovered 27/27 declared findings, where the miner recovered 0/9 | Hidden-spec test on seeds with planted debt: recover the declared spec, and flag the debt rather than absorb it |
| **S5. Explain and fix** | Writes a fix hint grounded in the agent's actual code | Templated messages are generic | none yet | A puzzle arm with a grounded hint against a templated one |

## The headline comparison (SO3)

Three arms run on the same development cases:
1. **Symbolic only:** the DETECT-02 rules.
2. **Semantic only:** the model reads the code, with no graph and no rules.
3. **Both:** the rules propose, and the model confirms and supplies the missing facts.

Each arm reports recall, twin discrimination and false positives on the legitimate patterns. If "both" beats either arm alone, that supports the complementarity hypothesis. Until a final study is designed, it is reported as development evidence.

## Order and budget

| Step | Pilot | Calls (estimate) | Where |
|---|---|---|---|
| 1 | S1 severity recalibration | ~40 | cloud credits |
| 2 | S3 aggregate and ownership facts on the 13 human repositories | ~30 | cloud credits |
| 3 | S2 confirmation on the D5 candidates and the precision fixtures | ~40 | cloud credits |
| 4 | The three-arm comparison on the dev material | ~100 | local or cloud |
| 5 | S4 hidden-spec inference; S5 in a puzzle arm | later | — |

The exploratory pilots do not need the frozen judge pin. The model configuration is recorded per run, and every call is recorded so replays cost nothing.

## Changelog
- 2026-10-22: v1.
