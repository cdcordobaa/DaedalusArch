# B0 · rule-anatomy

**Title on slide:** Anatomy of a rule: spec → template → Cypher → violation row

**What it shows.** The four stages every symbolic rule goes through, with one real example: the hexagonal rule FF-S01 `dependency-direction-graph`. (1) The spec entry names the rule and declares the allowed layer edges. (2) The compiler picks the template by the rule name and binds `$allowedDependencies` from the spec, under the literal edge view; its tier in hexagonal is blocking. (3) The compiled Cypher runs on the APG (shown abridged: the real text also has null checks, the `coalesce` on `viaReExport`, 9 RETURN columns and an ORDER BY; full text in `Docs/presentation-kit/data/compiled-cypher.json`, key A2). (4) Each returned row is a finding: here the planted edge of variant v01 (A2).

**One idea.** A rule is a parameterised graph query; the spec supplies the parameters.

**Sources.** `tests/fixtures/v1.3-reference/hexagonal/spec.yaml`; `src/fitness-compiler/hexagonal-templates.ts` (template `dependency-direction-graph`); `Docs/presentation-kit/data/compiled-cypher.json` (A2, produced with `V13_COMPILE_OPTIONS`); `results/v1.3-reference/after-member-facts/evidence/hexagonal/v01-domain-uses-outbound-adapter-constant.json`; edge views `Docs/v1.3/edge-views.md`; tier: `results/v1.3-reference/after-member-facts/report.md` (hexagonal FF-S01 blocking candidate yes).
