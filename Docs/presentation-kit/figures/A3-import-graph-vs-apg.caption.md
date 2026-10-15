# A3 · import-graph-vs-apg

**Title on slide:** Import graph vs Architectural Property Graph

**What it shows.** The same six files of the hexagonal reference project, the "cancel a booking" slice: `BookingController` (inbound adapter), the driving port `CancelBooking`, the use case `CancelBookingService`, the driven port `BookingRepository`, its adapter `InMemoryBookingRepository`, and the domain entity `Booking`.
- **Left, an import graph:** files and import arrows only (6 arrows among these files). This is what dependency-cruiser or a plain import graph holds.
- **Right, the APG:** the same files as containers coloured by the layer the spec assigns, with the classes and interfaces they declare, and the typed edges between them: IMPLEMENTS (which class implements which port), CONSTRUCTOR_INJECTS (who receives which port), CALLS (method to method), and the APG v2 edge SIGNATURE_USES (a public method's signature names a type, here the return type). Imports are still in the APG; they are hidden on the right for clarity.

**One idea.** An import arrow says "file A mentions file B". The APG says *how*: implements a port, is injected with a port, calls a method, exposes a type in its signature. Rules about ports and adapters need those facts.

**Numbers and sources.** All edges are real extractor output: `extractAPG` with `V13_APG2_OPTIONS` on `tests/fixtures/v1.3-reference/hexagonal` (clean variant), components from the spec's layers. Edge counts drawn on the right: IMPLEMENTS 2, CONSTRUCTOR_INJECTS 2, CALLS 1, SIGNATURE_USES 1. Data: `Docs/presentation-kit/data/hexagonal.clean.apg2.json`.

**Notes.**
- Methods are drawn inside the file of their class (the APG links them with DECLARES and CONTAINS; those edges are not drawn).
- Role labels (port, use case, adapter) are not drawn: the v1.3 annotator stores a layer on every node, but a role only from name tokens, so a drawn role would be the kit's reading, not the tool's.
- SIGNATURE_USES is APG v2, an extractor option that is off by default in v1.3 (`Docs/v1.3/apg2-design.md`); every other edge type is in the default v1.3 graph.
