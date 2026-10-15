# v1.3 reference projects (FR-V3)

One greenfield project per style (`clean-architecture`, `layered`, `nestjs`, `hexagonal`), each with a clean
variant, single-defect violating variants, near-misses, a hand-written expected graph and per-variant expected
findings. Design, sources, variant list, rule-definition questions and limits: `Docs/v1.3-reference-notes.md`.

- Never edit an `expected-findings.json` or `expected-graph.json` to match tool output; record the mismatch in the
  notes (§6) instead.
- Check offline: `npx tsx scripts/v1.3/validate-reference.ts --check`
- Live run (Neo4j): `NEO4J_URI=... NEO4J_PASSWORD=... npx tsx scripts/v1.3/validate-reference.ts`
- Type-check one project by hand: `npx tsc -p tests/fixtures/v1.3-reference/<style>/project/tsconfig.json`
