// id: R-AXA
// family: H3
// title: an adapter imports another adapter
// rule: Adapters meet only through the application's ports: an inbound adapter calls a use case, an outbound adapter implements a port, and the composition root wires them; one adapter never imports another (Cockburn, ports and adapters).
// fix: Call the use case (inbound) or the port (outbound) instead of the other adapter, and let the composition root connect the adapters.
// applies: files the spec puts in an adapter layer, in an adapter package folder (adapters/in/<x>, adapters/out/<x>, infrastructure/<x>)
// facts: AdapterFile, ADAPTER_IMPORTS
MATCH (a:AdapterFile)-[x:ADAPTER_IMPORTS]->(b:AdapterFile)
RETURN a.file AS file, x.line AS line, a.pkg AS subject,
       a.pkg + ' imports ' + b.file + ' (' + b.pkg + '), another adapter' AS evidence,
       [] AS path
ORDER BY file, line
