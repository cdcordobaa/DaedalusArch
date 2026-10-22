# V15-U3: S1 severity calibration, the thinking note before any call

**Status:** v1, 2026-10-22. Written and committed before the first U3 call. Unit U3 of the v1.5 cycle (`aidlc-docs/inception/v1.5/workflow-plan.md`), FR-7, role S1 of `ops/notes/v15-semantic-programme.md`. Exploratory, development material only: the v1.4 six-case set (`tests/fixtures/v1.4-c4/`, read, never changed) and six new pairs under `experiments/v15-u3/cases/`. No sealed or held-out set, no 2b data, no change to `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/` or the tag `v1.4-freeze-2026-10-20`.

## 1. Why the six-case set failed

Source: `Docs/DiagnosticRuns/v1.4-study2b-semantic-2026-10-22.md` §5 (route `claude-cli`, `claude-opus-5-5`, effort high, prompt `c4-v0.2`, 2 runs).

| What failed | Expected | Got | Exception and intent |
|---|---|---|---|
| Near-miss twin 4 (`c4-04t-superseded-adr`, FF-S04 target) | high or medium | low, low | right (no claim; contradicts) |
| Case 5 (`c4-05-intent-contradicted`, FF-S03) | high | medium, medium | right (no claim; contradicts) |
| Run-to-run severity disagreement | — | twin 3 (high, medium); twin 4's FF-S01 (medium, low) | — |

Exception claims were right on all 16 findings, with 0 false claims on twins and 0 hallucinated citations. **Every scorer failure on a case or a near-miss twin was the severity field.**

The cause is in the prompt, not in the reading. `c4-v0.2` (`src/apg-enrich/ontology/interpretation.ts`, item 4) says only: "rank the work inside the blocking tier (high, medium, low)". There is no rubric. The manifests, however, encode one implicitly:

| Manifest pattern (12 manifests) | severityAllowed |
|---|---|
| A grant covers the finding (consistent-with-declared-intent) | low or medium (5 cases) |
| The docs forbid what the code does (contradicts-declared-intent) | high or medium (twins 3, 4); high only (case 5) |
| Nothing declared | any (5 twins) |

The model ranked by **the size of the fix**. On twin 4 the fix is one injected clock, so it said low, although a current ADR forbids the import. On case 5 the controller writes through the repository, which the README forbids; it said medium. Asked for "the work", it answered about the work. The manifests meant **how far the code departs from what the team declared**. The failure is an under-specified instruction, so the remedy is a rubric, not more cases or a stronger model.

**Honest limit.** The rubric below was written knowing which two fields failed. On the six-case set it is therefore calibration, not a test: passing there shows the rubric fixes the known failure, nothing more. The new pairs (§4) are the test. Their answers are written in this commit, before any call.

## 2. What changes, and what does not

- **Changes:** item 4 of the C4 prompt only, replaced in an experiment (`experiments/v15-u3/prompt.ts`, version `c4-v0.2+u3-r1`). `rubricPrompt` renders the frozen prompt with `interpretationPrompt` and swaps that one item; it throws if the frozen item is not found.
- **Unchanged (read-only imports):** the schema, the system prompt, the context builder, the grounding (`groundC4Answer`), the merge (`a5Entry`), the scorer (`scoreC4Case`), C3 on `cypher-interp`, and the v1.4 runner's project preparation (`scripts/v1.4/c4-run.ts`).
- **Model:** `claude-sonnet-5-5` through `claude -p` (the exploratory route; no frozen judge pin), from an empty working directory, no tools, the frozen JSON schema. The v1.4 run used Opus. A small **control arm** (the frozen `c4-v0.2` prompt, same model) runs on the two failed targets, so a model effect can be told apart from a rubric effect.
- **Scope cut:** only the manifest's **target** finding is interpreted (pair 4's FF-P06 and FF-S01 findings, and pair 9's FF-S01, are not). Severity is scored on targets only. "Clean" is therefore measured on the target finding only, which is weaker than v1.4's project-wide clean.

## 3. The rubric (`c4-v0.2+u3-r1`)

Go in order, stop at the first step that applies:

| Step | Condition | severityClass |
|---|---|---|
| a | A current doc or comment line grants this case on purpose (exceptionClaim true) | **low** |
| b | A current doc, ADR or comment declares the rule the code breaks (contradicts-declared-intent) | **high**: the team said no; a small fix does not lower it |
| c | Nothing declared (no-declared-intent): rank by what the dependency does | **high**: the domain or core depends on infrastructure, a framework, an adapter or I/O, or the code changes state another context owns. **medium**: a layer or port is bypassed to change state or run business logic in the wrong place. **low**: a read-only shortcut, or a dependency on a plain value type, that one file can undo |

Plus one reading rule: a superseded, rejected, proposed or expired decision grants and declares nothing by itself; a current decision that replaces it and forbids the code counts for step b. A TODO or a mention that states no rule declares nothing.

**What the rubric predicts on the v1.4 six-case set** (all within the registered manifests' allowed sets): cases 1, 2, 3, 4, 6 low (step a); twin 3, twin 4, case 5 high (step b); twin 1 low (read shortcut), twin 2 high (ORM in the domain), twin 5 medium (controller write), twin 6 medium (business rule misplaced).

## 4. The new pairs (answers first)

Six pairs in `experiments/v15-u3/cases/`, indexed with manifest hashes in `set.json`. Every twin is exception-negative (the scorer counts a claim on a twin as false). Each expectation is a **single** severity class, stricter than v1.4's ranges. Every target was checked to fire on `cypher-interp` with zero calls.

| Pair | Case (role `case`) | Expected | Near-miss twin | Expected | Axis tested |
|---|---|---|---|---|---|
| 7 | `u3-07-write-bypass`: layered, FF-S03; the controller writes through the repository; README silent | no claim, no-declared, **medium** | `u3-07t-read-shortcut`: same import, the controller only reads | no claim, no-declared, **low** | step c, write vs read (code twin) |
| 8 | `u3-08-active-legacy`: DDD, FF-DT04; an exceptions table row "Active until 2027-03-31" and a comment | claim (row 7 or comment line 1), consistent, **low** | `u3-08t-expired-legacy`: the row is "Expired 2026-08-31, not renewed" and says the decorator must be removed | no claim, contradicts, **high** | grant status (prose twin); keyword baseline built to fail |
| 9 | `u3-09-accepted-adr`: hexagonal, FF-S04; ADR-0005 Accepted permits the domain to import the UUID adapter | claim (ADR lines 7–8), consistent, **low** | `u3-09t-proposed-adr`: the same ADR, Proposed | no claim, no-declared, **high** (core imports an adapter) | ADR status beyond "superseded" (prose twin); baseline built to fail |
| 10 | `u3-10-value-type`: DDD, FF-DS02; billing's Invoice imports ordering's Money; context map silent | no claim, no-declared, **low** | `u3-10t-cross-context-write`: billing loads and saves ordering's Order through its repository | no claim, no-declared, **high** | step c, value type vs foreign write (code twin) |
| 11 | `u3-11-grant-by-pattern`: layered, FF-S03; README allows `src/presentation/*-report.controller.ts` to read repositories | claim (README line 4), consistent, **low** | `u3-11t-grant-other-file`: the grant names `admin-report.controller.ts` and excludes this file by name | no claim, contradicts, **high** | grant scope (prose twin); baseline built to fail |
| 12 | `u3-12-comment-grant`: layered, FF-S03; a site comment grants the direct write | claim (controller line 14), consistent, **low** | `u3-12t-todo-only`: the comment is "TODO: tidy this up later." | no claim, no-declared, **medium** | a TODO is not intent (prose twin) |

Severity mix over the 12 new targets: high 4, medium 2, low 6. The zero-call keyword baseline claims falsely on twins 8, 9 and 11, and misses the grants of cases 11 and 12.

## 5. Scenarios and edge cases

- **The rubric over-rides reading.** The model may set severity from the rubric but bend intentMatch to fit (for example call a Proposed ADR "consistent"). Watched through intent accuracy and the exception field, which the rubric must not move.
- **Step c ambiguity.** "Changes state another context owns" vs "a layer bypassed to change state": pair 10's twin is the first, pair 7's case the second. A model that calls both medium, or both high, shows the boundary is unclear.
- **Expired or proposed decisions.** The frozen prompt names only superseded and rejected ADRs; the rubric adds proposed and expired. A model that still claims a grant from a Proposed ADR (twin 9) fails the exception field, not only severity.
- **Scoped grants.** Twin 11 names the site file in an "allowed" sentence that excludes it. A keyword reader fails; a careful reader does not.
- **Comment grants vs comment noise.** Case 12 grants in a comment, twin 12 only says TODO. Grounding requires a comment line citation; a claim citing code is rejected by the validator.
- **Instability.** Two runs, no temperature control on the CLI. Severity is the field most likely to differ.
- **Model swap.** Sonnet instead of Opus. The control arm on twin 4 and case 5 separates the effects at 4 calls.
- **Schema failures.** One retry per call, counted in the ledger.

## 6. Measures

All per target finding and per run (2 runs), on the original set and the new set separately, never pooled into one headline:
1. **Severity agreement:** share of runs whose severityClass is in the allowed set (original) or equals the single expected class (new).
2. **Exception accuracy** and **intent accuracy:** share of runs with the expected claim (and planted citation) and the expected intentMatch.
3. **Scorer-correct** (exception, intent and severity in every run), by role; **twins clean**.
4. **Twin discrimination:** pairs where case and twin are both scorer-correct. For the new set, also whether the severity moved in the expected direction between case and twin.
5. **Stability:** share of targets where the two runs agree, per field.
6. **Grounding:** hallucinated exception citations; unresolved `cites`.
7. **Abstention:** on the targets where nothing is declared, the share of runs that say no-declared-intent and claim nothing, rather than inventing intent; and invalid answers.
8. **Control:** severity of twin 4 and case 5 under the frozen prompt, same model.

## 7. Predicted result

- Original set with the rubric: 6/6 cases correct, twins 3 and 4 correct, 0 false claims, 0 hallucinated citations. Severity agreement ≥ 22/24 runs.
- New set: ≥ 5/6 cases correct and ≥ 5/6 twins correct; severity agreement ≥ 20/24 runs; exception accuracy ≥ 23/24; the likeliest misses are twin 9 (Proposed ADR read as a grant or as contradicts) and pair 10's step-c boundary.
- Control: at least one of twin 4 and case 5 below the expected severity in at least one run (the v1.4 failure reproduces on Sonnet).
- Stability: severity agrees across runs on ≥ 20 of the 24 targets.

## 8. What counts as failure

- **U3 fails** if any of these holds on the **new set**: fewer than 5/6 cases scorer-correct; fewer than 5/6 twins scorer-correct; severity agreement below 18/24 runs; any false exception claim on a twin; any hallucinated exception citation.
- **The rubric is not shown to help** (a weaker finding, reported as such) if the control arm gets twin 4 and case 5 right in both runs: then the v1.4 failure was a model or run effect, and the rubric's gain on the original set is not evidence.
- **The original set** must still be ≥ 5/6 cases correct with twins 3 and 4 correct; falling below is a regression and a failure.
- A failed pilot gets a note on why and **one** fix (a dated revision, `c4-v0.2+u3-r2`), re-run within the cap. No tuning after seeing the new cases' results except as such a revision.

## 9. Call cap and ledger

- **Hard cap 60 calls**, never raised. Every provider call (retries included) is a line in `experiments/v15-u3/ledger.jsonl`; the runner refuses a call once the ledger holds 60 lines.
- Planned: rubric arm 24 targets × 2 runs = **48**; control arm 2 targets × 2 runs = **4**. Total 52, leaving 8 for schema retries or a revision.
- Every answer is a cassette in `experiments/v15-u3/cassettes/`; `run.ts --replay` re-scores with zero calls.

## Changelog
- 2026-10-22: v1, before any call.
