# v13-dynamic-imports

Reference cases for the v1.3 `dynamicImports` extractor option (`src/apg-extractor/types.ts`), which is ON in
`V13_DEFAULT_OPTIONS` and OFF in the frozen `V12E_DEFAULT_OPTIONS`. Neither fidelity corpus (E1, SO4) exercised it
(`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`, "What to fix" item 3).

- `expected-graph.json` is the hand-written graph: what each file imports, by line, derived from the code alone.
  Do not edit an edge to match tool output; record a mismatch under `knownApgGaps`.
- `src/application/loader.ts` holds the cases: literal `await import()`, `import().then()`, a no-substitution
  template literal, a barrel, a `paths` alias, `require()`, a `.js` extension, four non-literal specifiers, a
  type-position `import('x').T`, and one unresolvable specifier.
- `src/application/mixed.ts`: a static import and an `import()` of the same file.
- `src/domain/order-archive.ts`: domain code that reaches infrastructure only through `await import()`.
- Test: `tests/unit/apg-extractor/v13-dynamic-imports-fixture.test.ts`.

The project does not type-check on purpose: `../infrastructure/missing` does not exist, and `require` has no
`@types/node` here. The extractor does not need it to.
