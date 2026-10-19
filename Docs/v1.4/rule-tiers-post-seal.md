# Post-seal rule tiers (v1.4)

**Date:** 2026-10-18. **Status:** post-seal, declared. **Cycle:** AI-DLC v1.4 "instrument-alignment", unit U2.

## Principle

- The sealed table `Docs/v1.3/rule-tiers.md` is not edited. Its hash in `Docs/v1.3/sealed-hashes.md` stays valid.
- This record holds only rules that were added after the seal. Each row names the ADR that adds the rule (`Docs/v1.4/adr-v14.md`).
- A rule that the sealed table already tiers keeps that tier. The post-seal change is then only the rule's membership in a style's rule set, and the row says so.
- The code holds the same rows: `POST_SEAL_RULE_TIERS` in `src/scoring-engine/rule-tiers.ts` (tiers) and `POST_SEAL_RULES` in `src/fitness-compiler/post-seal-rules.ts` (membership). The unit test `tests/unit/post-seal/post-seal-tiers.test.ts` parses this table and fails when the code disagrees with it.
- `ruleTier` reads the sealed tables first. It reaches this record only for an id they do not list, and it then reports `tierSource: post-seal`.
- The FF-P07 tiers are the author's default for question Q-C. They are marked Proposed in ADR-V14-02 until the author signs them.

## Table

| Rule | Template | Style | Tier | Construct reason | ADR |
|---|---|---|---|---|---|
| FF-S02 | no-cyclic-deps | ddd | blocking | Membership only (decision D5). The tier comes from the sealed FF-S02 row: the acyclic dependencies principle, a structural fact | ADR-V14-01 |
| FF-P07 | application-purity | clean-architecture | blocking | The delivery mechanism (the HTTP framework) is a detail outside the application. An import edge to it is a precise structural fact | ADR-V14-02 |
| FF-P07 | application-purity | hexagonal | blocking | The use case does not know the delivery mechanism. The HTTP framework belongs to an inbound adapter or to the composition root | ADR-V14-02 |
| FF-P07 | application-purity | nestjs | blocking | Through the Clean reading that the nestjs preset composes: the HTTP platform is a detail outside the application services | ADR-V14-02 |
| FF-P07 | application-purity | ddd | blocking | The application layer of a bounded context does not know the delivery mechanism. The HTTP framework belongs to the api layer or to the composition root | ADR-V14-02 |
