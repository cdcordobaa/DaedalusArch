# V15-PLAN: the road to instrument v1.5 and the final study

**Status:** v1, 2026-10-22. Adopted by the author as the working plan. It is a planning note: nothing is run for it.
- Study 2b stays closed at v1.4. The tag `v1.4-freeze-2026-10-20` and the registered artefacts are never changed.
- Everything here is exploratory until a final confirmatory study is designed.
- Every step that makes a model call gets a short thinking note first: scenarios, edge cases, predicted results and failure criteria (`feedback-slow-research-mode`).

Related notes:
- `ops/notes/explore-01-research-log.md`: what happened so far.
- `ops/notes/explore-02-needs-and-gaps.md`: the full register.
- `ops/06-open-tracks-and-capabilities.md`: the inventory.
- `ops/04-north-star.md`: each part tested on its own, then the whole instrument.

## 1. Detection: the graph and its rules

| Track | Where it is | Next step | Kind |
|---|---|---|---|
| The puzzle-trap rules (multi-aggregate write, cross-context write) | Built (`experiments/detect-02/`). They flag 19/19 trap trees with 0 false positives (dev) | Precision on correct DDD patterns (outbox records, audit and idempotency writes, child entities, sagas, declared batches): fixtures for each, plus a pass over real human DDD repositories | zero-call |
| Generalisation check | Sealed set of 34 projects (`experiments/detect-02-heldout/SEAL.md`) | Run it once with the symbolic rules: recall, twin discrimination, false positives on the negatives | zero-call |
| The other families (rule placement, entity in contract, mechanism in port, concrete injection, remote call in a transaction) | Rules built, mostly unverified | The same precision and held-out treatment, family by family | zero-call |
| Calls through ports | The frozen graph never links a port call to its adapter; DETECT-02 works around it | Fix it properly in the extractor for v1.5 | build |
| Composition-root mismatch (the MCP check flags files the scorer exempts, DA1) | A known bug | Fix in v1.5 | build |

## 2. The semantic layer

- **The C4 pilot is running** (Study 2b closure, addendum 4, DA13). Its result decides how much of the semantic path we can lean on.
- **If it passes:**
  - a C4 pilot that confirms or rejects symbolic candidates for rule placement, the family where rules alone fail;
  - a C1d pilot that infers aggregates when the spec doesn't declare them.
- **If it fails:** a short note on why, and a fix, before any reuse.

## 3. Delivery: how agents meet the tool

| Track | Next step | Kind |
|---|---|---|
| Pull (`check_consistency`) | The PUZZLE-02 result is pending (`ops/notes/puzzle-02-tool-arm-note.md`) | run, under way |
| Edit gate: checks after every edit, shown like a compiler error | A design note, then build the hook on top of the existing push gate (`experiments/detect-02/mcp/push-gate.ts`) | zero-call build |
| Graph at the start: structure given before acting | A design note | zero-call |
| Message quality for every rule, not only the two new ones | Rewrite the frozen tools' findings in the same actionable format (where, rule, why, fix) | zero-call build |

## 4. Puzzles and agent pilots

- Read PUZZLE-02 when it lands. That result sets the direction.
- Hand-read the baseline's 12 failures, with the author's spot-check of 2.
- More puzzles that trap: restore P3 (Hexagonal), and add a second cross-context puzzle and a harder Layered one. Zero-call build.
- Answer keys that catch gaming: renames, "batch" wrappers, fake synchronous events.

## 5. Validity, for the jury

- **The hold-out (SO4):** never scored, because of a spec-format failure (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`). One fix under an addendum would close a gap the jury will ask about. Zero-call to prepare.
- **MEAN-01 meaning labels:** 60 items are ready, about 2.5 hours of the author's rating. This is the weakest link in the chain of trust.

## 6. Spec inference: the instrument without known rules (added 2026-10-22)

When nobody has written the rules down, the model infers the architecture as code first. The pipeline:
1. **Infer the spec** from the code, the graph and the docs: the style, which files belong to which layer or context, which classes are aggregates, and the rules the team evidently follows.
2. **Compile fitness functions from the inferred spec.** The style libraries hold rule templates, and the inferred spec instantiates them. Project-specific rules mined from the code are extra candidates.
3. **Run the rules.** Each finding is a candidate violation.
4. **Interpret each candidate semantically** (C4): is it an intended exception, or a real violation? The answer feeds back into the spec.

**The risk is circularity.** Inferring rules from code that already violates them can legitimise the violations. So inference uses intent signals independent of the code's current state:
- docs;
- the majority pattern, where outliers are candidate violations (`src/ise/majority-vote.ts`, `src/ise/outliers.ts`);
- history, meaning violations later fixed (C5 fix-mining).

**Where it is.** The BF-01 pilot and re-pilot on 2026-10-19, on 2 repos, were promising (`Docs/DiagnosticRuns/v1.3-brownfield-llm-pilot-2026-10-19.md`, `…-repilot-2026-10-19.md`):
- the model-derived spec beat the deterministic miner on every measure, and recovered all 9 declared blocking findings where the miner and a blind author recovered 0;
- the re-pilot's graph arm recovered 18/18 rules on one repo;
- the limits are 2 repos, a single vendor (Claude), and READMEs that made reading enough. Code departing from intent was never tested.

**Next steps:**
1. Check the outcome of the Gemini night run (re-pilot §8).
2. A hidden-spec test on the seeds and puzzles, where the declared spec is the truth and the planted debt is a departure from it.
3. Wire the inferred spec into the fitness compiler.
4. Add the majority and outlier signals, and the interpretation feedback.

**Gate:** the inferred spec recovers the declared one *and* flags the planted debt rather than absorbing it.

## 7. The final study, designed when v1.5 is trusted

A draft design note, zero-call, covering:
- spec × tool as a 2×2, which brings back `mcp@L3`;
- Layered **and** DDD tasks;
- more than 4 tasks, so the result can generalise over tasks, which 2b could not;
- the delivery mode the pilots pick;
- D_sem registered properly;
- a second vendor (Gemini's quota resets about Oct 25);
- possibly a brownfield arm in which the tool infers the spec itself (§6).

## 8. Releasing v1.5

When detection and delivery have earned trust:
1. Move DETECT-02 from `experiments/` into `src/` and the real MCP server.
2. Bump the version, and write a changelog.
3. Tag `v1.5`.
4. Record the decision: the v1.4 tag and the 2b artefacts stay protected.

## First three steps (all zero-call, while 2b closes)

1. Precision fixtures, the human DDD repositories and the held-out check. This is the gate for promoting the detectors.
2. The edit-gate design note. It is the delivery idea most likely to move behaviour.
3. A first draft of the final-study design, so it matures alongside v1.5.

## Changelog
- 2026-10-22: v1, adopted as the working plan; §6 (spec inference) added to the plan as first shown.
