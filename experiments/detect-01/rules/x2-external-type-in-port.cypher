// id: X2
// family: H5
// title: a port method's parameter or return type is a vendor / external-module type
// facts: isPort (port-role interface, or domain interface implemented by an adapter), SIGNATURE_USES_EXTERNAL
// source: Cockburn, Hexagonal Architecture: each adapter talks to the application through a port (the port is the
//         application's, not the technology's)
MATCH (i:Interface {isPort: true})-[:CONTAINS]->(pm:Method)-[u:SIGNATURE_USES_EXTERNAL]->(t:ExternalType)
RETURN DISTINCT pm.filePath AS file, u.line AS line, pm.name AS subject, t.module + ':' + t.name AS evidence, [] AS path
ORDER BY file, line, evidence
