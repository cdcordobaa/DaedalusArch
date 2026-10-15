# B4-example-apg2-tf1

**Title on slide:** Worked rule 4 · A leak only the APG can see (APG v2, case TF1)

**What it shows.** A controller returns a persistence model through an inferred return type. There is no import between the two files. The chain is: (1) the spec entry, (2) the Cypher the repository's compiler makes from it (trimmed; the full text is in `Docs/presentation-kit/examples/B4-example-apg2-tf1.md`), (3) the code that breaks it, (4) the row the tool reports.

**One idea.** A rule is a graph query compiled from the spec; a finding is a row that query returns.

**Sources of every value.**
- Spec: `tests/fixtures/v1.3-apg2/cases.json (`projects.type-flow` layer model); the template is not yet a preset entry: `src/fitness-compiler/apg2-templates.ts`, parameters from `apg2Params` (`src/fitness-compiler/apg2-in-memory.ts`)`
- Cypher: `Docs/presentation-kit/data/compiled-cypher.json` (key B4), made by `Docs/presentation-kit/tools/compile.ts` with `V13_COMPILE_OPTIONS`.
- Code: `tests/fixtures/v1.3-apg2/type-flow/src/presentation/user.controller.ts (method `get`)`
- Finding: `Docs/presentation-kit/data/type-flow.boundary-type-leak.json (row `UserController.get`); live Neo4j equality: Docs/DiagnosticRuns/apg2-scope-2026-10-15/fixtures-live.json`

**Caveat.** Development set (AI-written reference project or planted fixture); a single example, not a rate.
