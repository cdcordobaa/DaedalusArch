# B3-example-adapter-isolation-hex

**Title on slide:** Worked rule 3 · Adapter isolation (Hexagonal): an open question

**What it shows.** An inbound adapter imports an outbound adapter. Found today as FF-S03 (advisory); construct question Q5 asks whether it should block. The chain is: (1) the spec entry, (2) the Cypher the repository's compiler makes from it (trimmed; the full text is in `Docs/presentation-kit/examples/B3-example-adapter-isolation-hex.md`), (3) the code that breaks it, (4) the row the tool reports.

**One idea.** A rule is a graph query compiled from the spec; a finding is a row that query returns.

**Sources of every value.**
- Spec: `tests/fixtures/v1.3-reference/hexagonal/spec.yaml (`allowed_dependencies`, function FF-S03)`
- Cypher: `Docs/presentation-kit/data/compiled-cypher.json` (key B3), made by `Docs/presentation-kit/tools/compile.ts` with `V13_COMPILE_OPTIONS`.
- Code: `tests/fixtures/v1.3-reference/hexagonal/variants/v05-inbound-adapter-reads-outbound-adapter/variant.patch`
- Finding: `results/v1.3-reference/after-member-facts/evidence/hexagonal/v05-inbound-adapter-reads-outbound-adapter.json`

**Caveat.** Development set (AI-written reference project or planted fixture); a single example, not a rate.
