# A5 · graph-photo

**Title on slide:** A photo of the graph: one class and its neighbours

**What it shows.** A Neo4j-browser-style rendering of real rows from the extracted graph: the use case `BookRoomService` of the hexagonal reference project, the file that declares it, the driving port it implements (`BookRoom`), the five driven ports it receives in its constructor (`RoomRepository`, `BookingRepository`, `GuestRepository`, `PaymentGateway`, `NotificationSender`), the two domain services it holds in fields (FLOWS_TO `AvailabilityChecker`, `PriceCalculator`), and the `application` component its file belongs to (APG v2). The query bar shows the Cypher that returns this neighbourhood; the right panel shows the node's properties.

**One idea.** The graph is ordinary, inspectable data: nodes with properties and typed relationships.

**Sources and honesty notes.**
- Every node, edge and property is taken from `extractAPG` with `V13_APG2_OPTIONS` on `tests/fixtures/v1.3-reference/hexagonal` (clean variant): `Docs/presentation-kit/data/hexagonal.clean.apg2.json` (CONSTRUCTOR_INJECTS ×5, IMPLEMENTS ×1, FLOWS_TO ×2 for BookRoomService; see also A3).
- It is drawn by the kit (Graphviz neato, Neo4j browser colours), not a screenshot of a live Neo4j; the internal node ids are not shown. In Neo4j the edges are directed; the photo omits arrowheads as the browser's compact view does.
