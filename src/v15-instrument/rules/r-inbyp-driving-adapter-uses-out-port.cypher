// id: R-INBYP
// family: H3
// title: a driving adapter uses a driven port
// rule: A driving adapter turns a request into a call on an in-port (a use case) and turns the answer back; it never holds a driven (out-) port, so it never reads or writes stored state, or reaches a device, without the application (Cockburn, ports and adapters).
// fix: Add or extend a use case behind an in-port that does the work, call it from the adapter, and let the composition root hand the adapter only in-ports.
// applies: files of a driving adapter package (adapters/in/<x>, adapters/inbound/<x>) that import a driven port: a port file under ports/out (outbound, driven, secondary), or a port file a driven adapter package imports; value and type imports alike
// status (v1.5.7, 2026-11-02): exploratory, not admitted, on no row and not delivered; found by the Hexagonal study's hand read (t11: R-AXA sees adapter-to-adapter imports only)
// identity: the subject names the importing package and the port file, so two ports from one file are two findings
// facts: AdapterFile, PortFile, USES_OUT_PORT (by: path | implemented)
MATCH (a:AdapterFile)-[x:USES_OUT_PORT]->(p:PortFile)
RETURN a.file AS file, x.line AS line, a.pkg + ' -> ' + p.file AS subject,
       a.pkg + ' (a driving adapter) imports the driven port ' + p.file + ' (' + x.by + ')' AS evidence,
       [] AS path
ORDER BY file, line
