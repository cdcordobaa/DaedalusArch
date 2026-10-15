# A1 · apg-hexagonal-overview

**Title on slide:** The graph the firewall reads: hexagonal reference project

**What it shows.** The Architectural Property Graph (APG) of the hexagonal reference project (hotel room booking), clean variant, at file level. Each box is a File node; each colour band is the layer the spec assigns to it (domain, application, adapters-inbound, adapters-outbound, config). Each arrow is a file-to-file IMPORTS edge, from the importing file to the imported file, coloured by the importer's layer. Outbound adapters are drawn on the right so that every arrow from them points inward, as Cockburn's picture does; only the drawing position changes, not the edge.

**One idea.** The tool does not read code text when it checks a rule; it reads this graph.

**Numbers and their sources.**
- 30 File nodes and 74 file-to-file IMPORTS edges: counted by the kit from `extractAPG` with `V13_DEFAULT_OPTIONS` on `tests/fixtures/v1.3-reference/hexagonal` (clean variant), the same call as `scripts/v1.3/ue-graph.ts`. Data file: `Docs/presentation-kit/data/hexagonal.clean.json`.
- The layers come from `scripts/v1.3/lib/layer-assignment.ts` under `tests/fixtures/v1.3-reference/hexagonal/spec.yaml`. The hand-written expected graph agrees with the tool on every edge and layer of the clean variants (`Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md` §1, "Graph": 269/269 edges and 115/115 layers over the four patch styles).
- The full graph also holds Class, Interface, Method and Function nodes and IMPLEMENTS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS and FLOWS_TO edges (110 nodes and 195 edges in total, same data file). They are left out here; A3 shows them.

**Caveat to say.** This is a reference project written for the development set (AI-written), not a real-world codebase.
