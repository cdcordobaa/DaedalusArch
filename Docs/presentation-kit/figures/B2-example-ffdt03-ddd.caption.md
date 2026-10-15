# B2-example-ffdt03-ddd

**Title on slide:** Worked rule 2 · Value-object immutability (DDD): a fixed miss

**What it shows.** FF-DT03: a value object must not be mutable. The first tool run missed a `set` accessor; extractor member facts closed it. The chain is: (1) the spec entry, (2) the Cypher the repository's compiler makes from it (trimmed; the full text is in `Docs/presentation-kit/examples/B2-example-ffdt03-ddd.md`), (3) the code that breaks it, (4) the row the tool reports.

**One idea.** A rule is a graph query compiled from the spec; a finding is a row that query returns.

**Sources of every value.**
- Spec: `presets/ddd.yaml (`ddd.value_objects`, function FF-DT03)`
- Cypher: `Docs/presentation-kit/data/compiled-cypher.json` (key B2), made by `Docs/presentation-kit/tools/compile.ts` with `V13_COMPILE_OPTIONS`.
- Code: `tests/fixtures/v1.3-reference/ddd/variants/g01-value-object-setter-accessor/overlay/src/ordering/domain/value-objects/Quantity.ts`
- Finding: `results/v1.3-reference/after-member-facts/evidence/ddd/g01-value-object-setter-accessor.json (before: results/v1.3-reference/after-fixes/raw/ddd/g01-value-object-setter-accessor.json, no finding)`

**Caveat.** Development set (AI-written reference project or planted fixture); a single example, not a rate.
