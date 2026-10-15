# B1-example-ffs01-clean

**Title on slide:** Worked rule 1 · Dependency direction (Clean Architecture)

**What it shows.** FF-S01: an import may only point inward, toward the domain. Blocking. The chain is: (1) the spec entry, (2) the Cypher the repository's compiler makes from it (trimmed; the full text is in `Docs/presentation-kit/examples/B1-example-ffs01-clean.md`), (3) the code that breaks it, (4) the row the tool reports.

**One idea.** A rule is a graph query compiled from the spec; a finding is a row that query returns.

**Sources of every value.**
- Spec: `tests/fixtures/v1.3-reference/clean-architecture/spec.yaml`
- Cypher: `Docs/presentation-kit/data/compiled-cypher.json` (key B1), made by `Docs/presentation-kit/tools/compile.ts` with `V13_COMPILE_OPTIONS`.
- Code: `tests/fixtures/v1.3-reference/clean-architecture/variants/v02-domain-uses-infrastructure-clock/variant.patch`
- Finding: `results/v1.3-reference/after-member-facts/evidence/clean-architecture/v02-domain-uses-infrastructure-clock.json`

**Caveat.** Development set (AI-written reference project or planted fixture); a single example, not a rate.
