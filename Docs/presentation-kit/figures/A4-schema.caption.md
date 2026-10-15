# A4 · schema

**Title on slide:** The APG schema: node and edge types

**What it shows.** Every node type and edge type the extractor writes into the Architectural Property Graph, as one compact diagram. Black: the v1.2E core used in Study 1 (6 node types: File, Class, Interface, Method, Function, Package; 9 edge types: IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS, FLOWS_TO, RE_EXPORTS). Blue: v1.3 additions, on by default (NestJS module wiring edges MODULE_IMPORTS, MODULE_PROVIDES, MODULE_EXPORTS; IMPORTS properties `viaReExport`, `reExportHop`, `dynamic`; class member facts). Orange dashed: APG v2, behind the `apg2` extractor option (3 node types: Component, Channel, IOCategory; 8 edge types: SIGNATURE_USES, BELONGS_TO, DEPENDS_ON, EXPORTS_SYMBOL, DEEP_IMPORT, PUBLISHES, SUBSCRIBES, PERFORMS_IO). "↻" marks an edge from a type to itself.

**One idea.** The graph knows more than imports: types, implementations, injections, calls, data flow, and (APG v2) signatures, components, channels and I/O.

**Sources.**
- `src/shared/types/enums.ts`: `NODE_TYPES`, `EDGE_TYPES`, `V13_EDGE_TYPES`, `APG2_NODE_TYPES`, `APG2_EDGE_TYPES`.
- `src/shared/types/apg.ts`: `ImportEdgeProperties` (`dynamic`, `viaReExport`, `reExportBarrels`, `reExportHop`).
- `Docs/v1.3/apg2-design.md`: endpoints (SIGNATURE_USES (Method | Function) → (Class | Interface); BELONGS_TO File → Component; DEPENDS_ON Component → Component; EXPORTS_SYMBOL Component → (Class | Interface | Function); DEEP_IMPORT File → File; PUBLISHES/SUBSCRIBES owner → Channel; PERFORMS_IO owner → IOCategory). "Owner" is the node that owns the code (drawn from Method).
- `src/apg-extractor/nest-module-extractor.ts`: MODULE_* edges between module and provider classes.
- Member facts: `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §1.1 and B2.
- Defaults: `src/apg-extractor/types.ts` (`V13_DEFAULT_OPTIONS`: apg2 off; `V13_APG2_OPTIONS`: on).
