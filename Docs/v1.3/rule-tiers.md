# v1.3 Rule Tiers (a priori)

**Committed 2026-10-14, before any v1.3 labelling, precision measurement or tuning.** The sha256 of this file is recorded in `Docs/v1.3/sealed-hashes.md`. Moving a rule to another tier later needs an ADR with a reason based on the rule's *construct*. Precision observed after this date is not an accepted reason on its own. Both AHS versions (the v1.2E weighting and the v1.3 tiers) are then reported. (Fable review, finding 5.)

## Principle

A rule is **blocking** when its condition states a **defining constraint of the architectural style**, checked as a precise structural fact (an edge exists or doesn't; a declaration is or isn't in a place). A rule is **advisory** when it is:
- a metric with a threshold (fan-out, instability, ratios);
- a proxy for a design principle (SRP, ISP);
- a naming or project convention;
- a design guideline that the style's canonical sources do not state as a constraint.

Only blocking rules can fail a v1.3 verdict. Advisory rules are reported, with counts, outside the blocking verdict. In v1.3 the LLM judge dimensions (FF-N01, FF-N02) are reported and do not block. That choice can change only by an ADR before Study 2.

**Consequence:** v1.3 AHS and verdicts are **not comparable** with Study 1 (v1.2E) AHS. Study 1 is reported only under its own registered scoring.

## Existing rules (v1.2E registry, `src/spec-parser/template-registry.ts`)

| Rule | Template | v1.2E severity | v1.3 tier | Construct reason |
|---|---|---|---|---|
| FF-S01 | dependency-direction | critical | **blocking** | The dependency rule: dependencies point inward or downward. This defines Clean, Layered and Hexagonal. |
| FF-S02 | no-cyclic-deps | critical | **blocking** | Acyclic dependencies principle; a structural fact |
| FF-S03 | no-layer-skip | critical | **blocking only for `layered`** (strict layering); advisory elsewhere | Only strict layering forbids skipping. Clean and Hexagonal allow skipping inward. |
| FF-S04 | no-domain-outward-dep | major | **blocking** | Core isolation |
| FF-P01 | domain-purity | critical | **blocking** | The domain is framework-free (Clean, Hexagonal, DDD) |
| FF-P02 | dependency-inversion | critical | advisory | A ratio with a threshold (0.85), so a proxy |
| FF-P03 | repository-pattern | critical | **blocking** | Port in the core, implementation in infrastructure or an outbound adapter: a structural placement fact |
| FF-P04 | use-case-isolation | major | advisory | Design guideline, not a defining constraint |
| FF-P05 | controller-no-entity | major | advisory | Guideline (DTOs at boundaries); styles differ on it |
| FF-P06 | domain-state-purity | critical | **blocking, partial** | Core isolation of state. The field half needs FLOWS_TO, which is near-empty: that half is reported N/A with its denominator. Only the constructor-injection half is valid. (Finding 9) |
| FF-C01..C06 | stability, fan-out, instability, orphans, fan-in, abstraction ratio | major/minor/advisory | advisory | Metric thresholds |
| FF-SO01..SO03 | SRP proxy, ISP proxy, inheritance depth | major/minor | advisory | Proxies |
| FF-CV01..CV06 | naming, test pairing, index logic | minor/advisory | advisory | Conventions |
| FF-N01, FF-N02 | judge integrity and intent | major | reported, non-blocking in v1.3 | LLM judgement; its validity is measured separately (FR-V8, V9) |

## New v1.3 rules (hexagonal #76, DDD U-C1)

The same principle applies. Each new rule gets its tier in its library notes, *before* that library is validated. The expected tiers:

| Rule (template) | Tier | Reason |
|---|---|---|
| dependency-direction-graph (hexagonal) | blocking | Defining: adapters depend on ports, and the core depends on nothing outward |
| core-isolation (hexagonal) | blocking | Defining |
| port-adapter-pattern (hexagonal) | blocking | Defining: outbound adapters implement core or application ports |
| port-dependency-inversion (hexagonal) | blocking if it is a pure edge fact; advisory if it is ratio-based | Decided from its Cypher form, recorded in the hexagonal notes |
| layer-skip-graph (hexagonal) | advisory | Hexagonal does not define strict layering |
| DDD aggregate boundary | blocking | Evans: outside objects hold references only to the root |
| DDD repository only for aggregate roots | blocking | Evans: repositories are provided only for aggregate roots |
| DDD value-object immutability | blocking | Evans: value objects are immutable. Checked as a declaration fact (readonly, no setters). |
| DDD framework-free domain | blocking | Same construct as FF-P01 |
| DDD bounded-context isolation (imports only through the declared public API or ACL) | blocking | Strategic DDD: explicit context boundaries and translation |
| DDD domain events defined in the domain | advisory | Placement guideline |
| DDD application services hold no business rules | advisory | Heuristic |
