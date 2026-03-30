# Functional Design Questions — Unit 2: APG Extractor

Please answer each question by filling in the letter after the `[Answer]:` tag.
If none of the options fit, choose the last option (Other) and describe your preference.

---

## Question 1
**Node ID generation strategy** — IDs must be stable across runs for Neo4j upsert deduplication in U4.

A) Deterministic SHA-256 of `{type}:{normalizedFilePath}:{name}` → first 16 hex chars (short, reproducible, collision-safe for typical codebases)
B) Full SHA-256 (longer but absolute zero collision risk)
C) Random UUID per extraction run (non-reproducible — each run produces new IDs; simplest to generate)
D) Other (please describe after [Answer]: tag below)
[Answer]: A (Deterministic SHA-256)
Rationale: Deterministic IDs are required for incremental Neo4j updates (upserts). The first 16 characters keep the graph size small and Cypher queries readable, while providing virtually zero collision risk for source code elements.
---

## Question 2
**CONSTRUCTOR_INJECTS edge detection** — what constitutes a DI relationship?

A) Decorator-based only: class must have `@Injectable`, `@Controller`, `@Service`, or similar NestJS/Angular decorator; constructor params with class/interface types become edges
B) Structural/framework-agnostic: any constructor parameter typed with a non-primitive class or interface produces an edge (no decorator required)
C) Both: decorator check first, fall back to structural detection if no decorators present
D) Other (please describe after [Answer]: tag below)
[Answer]: C (Both: decorator -> fallback to structural)
Rationale: To properly support Domain-Driven Design while being practical, the extractor must handle both framework-heavy dependency injection (like NestJS/Angular decorators) and pure TypeScript constructor injection. This captures the most complete coupling graph.
---

## Question 3
**CALLS edge scope** — what call expressions in method/function bodies produce edges?

A) Only cross-boundary calls where the callee is another extracted node (class method calling a method on a different class/service) — keeps graph lean and architecturally meaningful
B) All call expressions in method/function bodies, including same-class calls and chained calls — maximum fidelity
C) Skip CALLS edges entirely for now; add in a later iteration when evaluation engine needs them
D) Other (please describe after [Answer]: tag below)
[Answer]: A (Only cross-boundary calls to other extracted nodes)
Rationale: Extracting all internal call expressions (like `.map` or `.toString()`) would explode the Neo4j database with noise and cripple performance. Architectural firewalls only need to analyze cross-class/cross-module boundaries to calculate coupling metrics.
---

## Question 4
**Barrel import resolution** — when `import { X } from './index'` and the barrel re-exports from sub-modules:

A) Resolve transitively to the ultimate source file — IMPORTS edge points to the actual declaring file (most accurate for architectural analysis)
B) Keep IMPORTS edge to the barrel file only — no transitive resolution (simpler, faster, preserves barrel structure)
C) Resolve one level only — if barrel immediately re-exports the symbol, resolve; if it's a chain (barrel→barrel→file) stop at first barrel
D) Other (please describe after [Answer]: tag below)
[Answer]: A (Resolve transitively to the ultimate source file)
Rationale: If imports are only tracked to the barrel file (`index.ts`), the dependency graph will show massive false bottlenecks and hide true layer-skipping violations. Transitive resolution reveals how the code actually depends on each other underneath the barrel abstraction.
