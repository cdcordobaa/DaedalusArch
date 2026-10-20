# Deviations X-1 and SO3-a: the method (descriptive core, inferential additions) and the symbolic dimensions (7 → 5)

**Date:** 2026-10-19. **Status: drafted for the author's signature. Neither deviation is declared until the author signs it below.** Written by an AI session from REV-04 (`ops/notes/rev-04-gaps-and-promises-2026-10-19.md:49-50`, `:186`, `:200`) and REV-05 (`ops/notes/rev-05-first-study-fable.md:163`). Both are proposal-level deviations: they change what the thesis proposal promised, not a sealed rule or a registered study. They are listed in [`ops/notes/deviations-v14.md`](../../ops/notes/deviations-v14.md), rows 12 and 13. Zero model calls. No sealed path was read.

---

## X-1: descriptive DSR core, inferential additions pre-registered

### What the proposal says

The proposal is descriptive design-science research with "no inferential hypothesis testing" (Proposal V4, Framework, "Approach"; quoted in `rev-04:8`). Its minimum viable thesis is SO1 to SO4 (`rev-04:9`).

### What the thesis does instead

- **Study 1** was pre-registered with inferential tests. Pre-registration v1 is at `84bd30c`, 2026-10-08T20:03:37Z (`aidlc-docs/aidlc-state.md:111`). Its headline uses a Holm-adjusted test: "Holm p = 0.0003" (`Docs/v1.3/contribution-statement.md:30`).
- **Study 2** (the drift record) registers H1 and H2 with a block sign-flip test and Holm over 2 (`Docs/v1.4/study2-deviation-2026-10-19-drift.md:46`).
- REV-04 found this switch **undeclared** (`rev-04:11`, `:200`).

### The deviation

> **Deviation X-1.** The thesis keeps the proposal's descriptive design-science core. The artefact (spec language, graph, rule engine) is designed, built and evaluated descriptively against SO1 to SO4. Inferential tests are **additions**. They appear only where they were pre-registered before the data were seen: Study 1 (registration v1, 2026-10-08) and the confirmatory Study 2 (OSF, before its main run). No inferential claim is made anywhere else. The exploratory study is descriptive only (`Docs/v1.4/exploratory-study-registration.md` §8, §12).

### Why

1. **The tests were added to make two comparisons checkable, not to change the method.** A spec-level effect on generated code (Study 1) and an arm effect on drift (Study 2) are comparisons. A pre-registered test with a fixed correction is the honest way to report them.
2. **The core does not depend on them.** SO1 to SO4 are reported with descriptive figures and intervals: precision 283/283, recall per style, κ against tools (`contribution-statement.md:31`). The thesis stands without Study 2 (`rev-04:9`).
3. **Pre-registration is the guard.** Each test was fixed before its data. A test added after the data would be a fishing trip, so it is excluded.

### What the thesis can and cannot claim

- **Can:** descriptive results for SO1–SO4; Study 1's registered tests as registered; Study 2's registered tests, if it runs and passes its gate.
- **Cannot:** any p-value outside a registration; any test on exploratory data; "inferential DSR" as the method label.
- **Ch. 3** states the switch in one paragraph, with this record cited.

### What had been seen when it was written

Study 1's results (F1) were known. The tests themselves were registered before Study 1's data (`aidlc-state.md:111`). So the declaration comes late, but the tests did not. The declaration says so.

---

## SO3-a: rule count and dimensions (7 → 5 symbolic, no Security)

Source: the draft argument in `ops/notes/g13-so1-rule-count-deviation.md` §3 (`:83-95`), updated for the post-seal rules declared since it was written.

### What the proposal says

"30+ Cypher rules across 7 symbolic dimensions + 2 LLM-judged dimensions" (`Docs/v1.3/research/notion-ideas-triage.md:400`, as quoted in `g13:5`). The seven symbolic dimensions were structural, pattern, convention, testability, evolvability, cohesion and security (`notion-ideas-triage.md:372`, as quoted in `g13:5`).

### What was delivered

| Count | Value | Source |
|---|---|---|
| Distinct sealed rule ids in the five presets | 35: 33 symbolic, 2 judged | `g13:17-34` |
| Symbolic dimensions | 5: structural, coupling, pattern, SOLID, convention | `src/shared/types/enums.ts:42-54`; `g13:13` |
| Judged dimensions | 2: semantic, integrity | same |
| Blocking symbolic rules (v1.3 tiers) | 13, in 2 dimensions (structural, pattern) | `g13:31`, `:62` |
| Post-seal changes | FF-P07 application purity, a new pattern-dimension id (ADR-V14-02); FF-S02 joins the DDD set, membership only (ADR-V14-01) | `Docs/v1.4/adr-v14.md:63`; `Docs/v1.4/rule-tiers-post-seal.md:19-22` |
| Opt-in graph-extension templates outside the sealed table | 9 | `g13:52` |

So the count is met: 33 sealed symbolic rules, 34 with FF-P07. The dimensions are not: 5 symbolic, not 7. There is no security dimension.

### The deviation

> **Deviation SO3-a.** The proposal promised "30+ Cypher rules across 7 symbolic dimensions + 2 LLM-judged dimensions". The delivered catalogue has 33 sealed symbolic rules and 2 judged rules across five style libraries, plus one declared post-seal rule (FF-P07). The count is met. The rules sit in **5 symbolic dimensions** (structural, coupling, pattern, SOLID, convention) and 2 judged ones, not 7 symbolic ones. Testability, evolvability and cohesion survive only as advisory metrics and proxies inside coupling, SOLID and convention. **Security is not covered**: it is outside the construct, which is the architectural conformance of dependency structure.

### Why (from `g13:87-89`)

1. **Tiers decide what a rule is worth.** Only a rule that states a defining constraint as a precise structural fact can block (`Docs/v1.3/rule-tiers.md:5-13`). Testability, evolvability and cohesion can only be metrics and proxies, so as dimensions they would add advisory rows, not checks.
2. **No rule was added to reach the number.** The tiers were sealed before any v1.3 measurement. The kill list bars new blocking rules added after results (`Docs/v1.3/night-backlog-2026-10-16.md:726`). FF-P07 came from a construct gap (Q26, board decision N3), not from the count.
3. **Breadth went into styles.** Five libraries, where the proposal asked for two or three (`Docs/v1.3/limitations-register.md:50`).

### What the thesis can and cannot claim

- **Can:** 33 sealed symbolic rules (34 with FF-P07), 13 of them blocking in v1.3, compiled to Cypher from YAML across five styles.
- **Cannot:** seven symbolic dimensions; any testability, evolvability, cohesion or security score.
- Per-dimension AHS figures are over the five symbolic dimensions only.

### Lines it changes once signed (not edited here)

As listed in `g13` §4 (`:99-106`): `Docs/v1.3/limitations-register.md:52`, `Docs/v1.3/research/distinction-readiness.md:399`, and the stale rule counts in `Docs/v1.3/research/notion-ideas-triage.md`.

---

## A related item drafted, not declared: V5 scope

REV-04 lists it as a stale contradiction (`rev-04:245`), and REV-05 notes it is still unwritten (`rev-05:185`). Gate V5 asks for hold-out labelling by a qualified rater (`Docs/v1.3/study2-readiness-gate.md:121`). MEAN-01 labels external-set findings, possibly by a rater who does not meet the protocol's qualification (`ops/notes/mean-01-codebook-and-sample.md:298`, blocker B2). The V5 timing deviation is declared (drift record §7). Its **scope** is not.

**Draft.** "V5 is met in part. The independent rater labels the meaning of external-set blocking findings (MEAN-01), not the hold-out. The hold-out stays unlabelled by a human. The rater's qualification is stated as it is." This is the author's to adopt. It is not added to the deviation list until signed.

---

## Sign-off

> AUTHOR: signed — X-1 adopted as written. Signed: the author, in chat (recorded by the coordinator) Date: 2026-10-19

> AUTHOR: signed — SO3-a adopted as written. Signed: the author, in chat (recorded by the coordinator) Date: 2026-10-19

> AUTHOR: sign (optional) — V5 scope draft adopted / not adopted. Signed: __________ Date: ____-__-__

## Changelog
- 2026-10-19: first version (X-1 from REV-04 §5; SO3-a from `g13` §3, updated for ADR-V14-01 and -02; V5 scope drafted).
