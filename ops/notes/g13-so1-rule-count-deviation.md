# G13: the "30+ rules over 7 symbolic dimensions" promise, counted and argued as a declared deviation

**Status:** count and draft argument for review, 2026-10-18 (map part C2). Zero calls. The count was taken by parsing the `fitness_functions` blocks of the five presets and reading the tier tables in code. The deviation text is the author's to adopt or rewrite.

**Where the promise sits.** The G13 row files it under SO1. Both registers file it under **SO3, the gate**: `Docs/v1.3/limitations-register.md:52` and `Docs/v1.3/research/distinction-readiness.md:399` (K7). The proposal's wording, as quoted in the repo, is "30+ Cypher rules across 7 symbolic dimensions + 2 LLM-judged dimensions" (`Docs/v1.3/research/notion-ideas-triage.md:400`). The seven proposed symbolic dimensions were structural, pattern, convention, testability, evolvability, cohesion and security (`notion-ideas-triage.md:372`). The proposal text itself is not in the repo; the compliance register (Notion, 2026-10-06) is the source both registers cite. **Check the objective number against the proposal before this goes into the compliance table.**

---

## 1. What exists

### 1.1 Dimensions

The code has 7 dimensions: **5 symbolic** (`structural`, `coupling`, `pattern`, `solid`, `convention`) and 2 judged by a model (`semantic`, `integrity`) (`src/shared/types/enums.ts:42-54`).

### 1.2 Rules in the presets (sealed tier table)

There are 35 distinct rule ids across `presets/*.yaml`:

- the 27 ids of the generic registry (`src/scoring-engine/rule-tiers.ts:54-89`; `Docs/v1.3/rule-tiers.md:17-34`);
- the 8 ids of the DDD library (`src/scoring-engine/rule-tiers.ts:128-145`).

**33 are symbolic and 2 are judged.**

| Dimension | Rule ids | Count | Blocking (v1.3 tier) | Advisory |
|---|---|---:|---:|---:|
| structural | FF-S01, S02, S03, S04; FF-DS01, DS02; FF-DT01 | 7 | 7 (FF-S03 only under `layered`) | 0 (FF-S03 elsewhere) |
| pattern | FF-P01 … P06; FF-DT02 … DT06 | 11 | 6: P01, P03, P06 (partial), DT02, DT03, DT04 | 5: P02, P04, P05, DT05, DT06 |
| coupling | FF-C01 … C06 | 6 | 0 | 6 |
| solid | FF-SO01 … SO03 | 3 | 0 | 3 |
| convention | FF-CV01 … CV06 | 6 | 0 | 6 |
| **symbolic total** | | **33** | **13** | **20** |
| integrity (judged) | FF-N01 | 1 | 0 (reported, never blocking in v1.3) | 1 |
| semantic (judged) | FF-N02 | 1 | 0 | 1 |
| **all** | | **35** | **13** | **22** |

Tiers come from `src/scoring-engine/rule-tiers.ts:55-88` and `:128-145`. FF-S03 is blocking only for `layered` (`:57`). FF-P06 counts only its constructor-injection half (`:64-71`). The dimension of each rule is its `dimension:` field in the preset.

### 1.3 Per style (what one project is actually checked against)

| Preset | Rule ids | Symbolic | Blocking | Source |
|---|---:|---:|---:|---|
| `clean-architecture` | 27 | 25 | 6 (S01, S02, S04, P01, P03, P06) | `presets/clean-architecture.yaml:37` on |
| `layered` | 27 | 25 | 7 (the 6, plus S03) | `presets/layered.yaml:44` on |
| `nestjs` | 27 | 25 | 6 | `presets/nestjs.yaml:100` on |
| `hexagonal` | 24 (no P04, P05, C01) | 22 | 6 | `presets/hexagonal.yaml:77` on |
| `ddd` | 10 (DS01, DS02, DT01–DT06, S01, S03) | 10 | 7 (DS01, DS02, DT01–DT04, S01) | `presets/ddd.yaml:110` on |

No single style reaches 30 rules. The largest has 27, of which 25 are symbolic.

### 1.4 Rules outside the presets

- **APG v2 templates: 9**, 4 blocking candidates and 5 advisory (`src/fitness-compiler/apg2-templates.ts:157-167`). They are opt-in (`apg2: false` by default, `Docs/v1.3/apg2-design.md:24-26`), and their tiers are "recorded here and in the design document, not in the sealed tier table" (`apg2-templates.ts:7-9`). No preset names them.
- **Planned post-seal rules: 2.** A DDD cycle rule (D5) and application purity (N3), each with an ADR and declared as a deviation (`ops/decisions.md:26-27`).

### 1.5 The count against the promise

| Reading of "30+ rules over 7 symbolic dimensions" | Count | Met? |
|---|---|---|
| distinct symbolic rules, any style | 33 (42 with APG v2; 44 with D5 and N3 as well) | **yes on count** |
| symbolic dimensions | 5 of 7 | **no** |
| rules in one style's library | at most 25 symbolic (27 with the judge) | no |
| blocking rules (the ones that can fail a verdict) | 13 distinct, in 2 dimensions (structural, pattern) | the promise did not separate tiers |

Earlier figures in the repo are superseded by this count: "27 FF-* IDs" (`notion-ideas-triage.md:369`, `:747`); "24/5" (`:621`); "17" (`:462`).

---

## 2. Where the four proposed dimensions went

| Proposed dimension | In v1.3 | Evidence |
|---|---|---|
| testability | partly, as conventions and advisory checks: FF-CV05 `test-file-pairing`; APG v2 `nondeterminism-in-core` ("a testability guideline", advisory) | `presets/clean-architecture.yaml:234-235`; `apg2-templates.ts:166` |
| evolvability | partly, as coupling metrics: FF-C01 `domain-stability`, C03 `component-instability`, C06 `abstraction-ratio`; APG v2 `component-sdp-violation`, `component-main-sequence-distance` | `presets/clean-architecture.yaml:124-163`; `apg2-templates.ts:160-161` |
| cohesion | partly, as SOLID proxies: FF-SO01 `single-responsibility-proxy`, SO02 `interface-segregation-proxy` | `presets/clean-architecture.yaml:172-182` |
| security | not covered as a dimension. The closest check, APG v2 `io-outside-adapters`, is about core isolation, not security | `apg2-templates.ts:165` |

`coupling` and `solid` were not in the proposed list; they were split out of the proposed structural, cohesion and evolvability concerns.

---

## 3. Draft deviation argument (for the compliance table and Ch. 3)

> **Deviation SO3-a: rule count and dimensions.** The proposal promised "30+ Cypher rules across 7 symbolic dimensions + 2 LLM-judged dimensions". The delivered catalogue has **33 symbolic rules and 2 judged rules** across the five style libraries. It also has 9 opt-in graph-extension templates, and 2 declared post-seal rules are planned. The count is met. The dimensions are not. The rules are grouped into **5 symbolic dimensions** (structural, coupling, pattern, SOLID, convention) and 2 judged ones (semantic, integrity), not 7 symbolic ones.
>
> *Why.*
>
> 1. **Tiers changed what a rule is worth.** In v1.3 a rule can fail a verdict only if it states a defining constraint of the style as a precise structural fact. Metrics, proxies and conventions are reported but never block (`Docs/v1.3/rule-tiers.md:5-13`). Under that principle, testability, evolvability and cohesion can only be expressed as metrics and proxies. Making them dimensions would add advisory rows, not checks that can fail a verdict. Instead, their measurable parts sit in the coupling, SOLID and convention dimensions (§2). Security is outside the construct: architectural conformance of dependency structure.
> 2. **No rules were added to reach the number.** The tiers were sealed before any v1.3 measurement (`Docs/v1.3/rule-tiers.md:3`; `Docs/v1.3/sealed-hashes.md`). The plan's kill list rules out new blocking rules added after seeing results, because that would be "construct-by-result" (`Docs/v1.3/night-backlog-2026-10-16.md:726`). The two post-seal rules (D5, N3) come from construct gaps found by the seeded and external tests, not from the count. They are declared as deviations with ADRs (`ops/decisions.md:26-27`).
> 3. **Breadth went into styles instead.** The proposal asked for two or three style libraries; five were delivered (`limitations-register.md:50`). Each style's defining rules are covered at the blocking tier: 6 or 7 per style (§1.3). A sixth dimension of advisory metrics would have added less to SO3's claim than a style library does.
>
> *What the thesis can and cannot claim.*
>
> - It can claim 33 symbolic rules, 13 of them blocking, compiled to Cypher from YAML specifications, across five styles.
> - It cannot claim seven symbolic dimensions, or any testability, evolvability, cohesion or security score.
> - The per-dimension AHS figures are over the five symbolic dimensions only.

---

## 4. Lines this would change (not edited here)

| File:line | Now | Proposed |
|---|---|---|
| `Docs/v1.3/limitations-register.md:52` | "'30+ rules over 7 symbolic dimensions' not reached as stated" | "33 symbolic + 2 judged rules (count met); 5 symbolic dimensions of the 7 promised (not met); deviation SO3-a, `ops/notes/g13-so1-rule-count-deviation.md` §3" |
| `Docs/v1.3/research/distinction-readiness.md:399` (K7, SO3 row) | "the '30+ rules over 7 symbolic dimensions' product line ... are the gaps" | the same count, and "argued as deviation SO3-a" |
| `Docs/v1.3/research/notion-ideas-triage.md:369`, `:621`, `:747` | "27 FF-* IDs ... the total against 30 was not counted" | "35 ids in the presets (33 symbolic: 25 generic + 8 DDD); 9 opt-in APG v2 templates outside the sealed table" |
| `ops/03-build-list.md` (C2 row, `:20`) | lists the deviation work | point to §3 here |
