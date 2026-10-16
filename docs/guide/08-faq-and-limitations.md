# 8. FAQ and limitations

## Which languages does it support?

TypeScript only. The extractor uses the TypeScript compiler API (ts-morph) on the files your `tsconfig.json`
includes. In a test, two `.js` files added to a domain folder of `fixtures/correct-reference` (one with `require`, one
with `import`, both reaching into infrastructure) produced no findings. That project's `tsconfig.json` includes only
`src/**/*.ts`, so the `.js` files were never read.

## Do I need Neo4j?

No. On `v1.3` the CLI and the MCP server use the in-process engine (`cypher-interp`) unless `NEO4J_URI` is set. You
still need Neo4j for:

- the CI gate's full rule set (`check --engine neo4j`, PR #138). Its in-process `lexical` engine covers only
  single-file import rules;
- `evaluate --html` on the PR #140 branch as it stands (chapter 6);
- the older `report` command.

## Why does a rule half say "N/A … FLOWS_TO"?

FF-P06 (`domain-state-purity`) asks whether a domain class holds infrastructure state. It has two halves:

- **Constructor injection.** Checked from constructor parameters, and scored.
- **Fields.** This half needs `FLOWS_TO` edges (a value flowing into a field), and the extractor records very few of
  them. The field half is therefore reported as N/A with its denominator (`0 of 0 rows (FLOWS_TO edges in graph: 1)`)
  and is not scored.

In practice, a domain class that creates an infrastructure object in a field initialiser is not reliably caught. One
that receives it through the constructor is.

## Does it follow barrel files (`index.ts`)?

Yes, as an import of the barrel. In a test, a domain file importing `../../infrastructure` (an `index.ts` that
re-exports a repository) was reported as FF-S01 and FF-S04. The message names the barrel
(`imports from src/infrastructure/index.ts`), not the file behind it. The DDD style has extra checks for barrels that
form a context's public API.

## Are `require()` and dynamic `import()` covered?

When the argument is a string literal, yes. In a test, `require('../../infrastructure/repositories/InMemoryTaskRepository')`
inside a domain class was reported like a static import. When the path is computed at run time
(`require(base + name)`), no: the same dependency built from a concatenated string produced no finding. No static tool
can resolve those.

The MCP `check_file` and `check_diff` tools handle these calls differently. They report `require()` and `import()`
hits as `advisories`, not as violations.

## Do type-only imports count?

Yes. In a test, `import type { InMemoryTaskRepository } from '../../infrastructure/...'` in a domain file was
reported as FF-S01 and FF-S04, like a value import. If you want type-only imports to be allowed, this is a known
difference from tools that skip them.

## Are test files checked?

No. Extraction skips `*.spec.ts`, `*.test.ts`, `*.d.ts`, `node_modules`, `dist` and `build`. FF-CV05
(`test-file-pairing`) only reports source files that have no test file next to them. If your tests live elsewhere,
switch it off (chapter 2).

## Path aliases (`@/foo`)?

The full evaluation resolves `paths` and `baseUrl` from your `tsconfig.json` (or the one passed with `--tsconfig`). The
MCP `check_import` and `check_file` tools have only the spec, not your compiler settings. They report alias imports
under `unresolved` and do not guess.

## Monorepos?

Point `--project` at one package at a time: the folder holding its `src/` and `tsconfig.json`. `init` needs exactly
that layout.

## My code is nothing like the five styles

The styles are layered, clean-architecture, hexagonal, ddd and nestjs. `init` always picks one of them, and never
answers "none of these". If your layering is custom, `hexagonal` with your own `allowed_dependencies` list is the most
flexible: any layer graph can be written as allowed edges.

## Why do the top score and the v1.3 verdict disagree?

The top "Architectural Health Score" weights every rule, warnings included. The v1.3 verdict looks only at defining
rules. They can disagree in either direction. The exit code follows the v1.3 verdict. See
[chapter 3](03-reading-a-report.md).

## Does it use an LLM?

Not with `--symbolic-only`, which every command in this guide uses. Without that flag, `evaluate` also runs an LLM
judge. The judge needs a pinned Claude CLI install, and its findings are reported but never block in v1.3. Fix hints,
rule mining and `init` are deterministic.

## Is it fast enough for an agent loop?

On the reference fixtures: about 4 s for a full CLI evaluation (most of it start-up), about 50 ms for an MCP
`check_file` call, and about 2 s for a first `evaluate_project`, then milliseconds from cache. These are
small projects. Large codebases will take longer.
