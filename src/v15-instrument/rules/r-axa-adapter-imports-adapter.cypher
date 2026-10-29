// id: R-AXA
// family: H3
// title: an adapter imports another adapter
// rule: Adapters meet only through the application's ports: an inbound adapter calls a use case, an outbound adapter implements a port, and the composition root wires them; one adapter never imports another (Cockburn, ports and adapters).
// fix: Call the use case (inbound) or the port (outbound) instead of the other adapter, and let the composition root connect the adapters.
// applies: files the spec puts in an adapter layer, in an adapter package folder (adapters/in/<x>, adapters/out/<x>, infrastructure/<x>)
// exempt (2026-10-29, shared helpers of the driving side): an import is not reported when BOTH hold: (1) the importer sits in a package of a driving side (`<p>/adapters/in/<x>` or `<p>/adapters/inbound/<x>`) and the target sits in that same side's `shared` or `common` folder (`<p>/adapters/in/shared/…`, same `<p>`); (2) every in-tree import of the target file is a domain or shared-kernel file, or a file of that same shared folder (library imports are allowed). So `adapters/in/http/X.ts` importing `adapters/in/shared/reply.ts` (a reply helper that imports only domain errors) is not reported; an import across sides (`adapters/in/<x>` to `adapters/out/<y>`), between two outbound packages, into another inbound package that is not the shared folder (`adapters/in/mqtt` to `adapters/in/http`), or into a shared file that imports a port, a use case or another adapter, is still reported
// identity (2026-10-29): the subject names the importing package and the imported file, so two different imports from one file are two findings
// facts: AdapterFile, ADAPTER_IMPORTS (drivingShared, targetHelperOnly)
MATCH (a:AdapterFile)-[x:ADAPTER_IMPORTS]->(b:AdapterFile)
WHERE NOT (x.drivingShared AND x.targetHelperOnly)
RETURN a.file AS file, x.line AS line, a.pkg + ' -> ' + b.file AS subject,
       a.pkg + ' imports ' + b.file + ' (' + b.pkg + '), another adapter' AS evidence,
       [] AS path
ORDER BY file, line
