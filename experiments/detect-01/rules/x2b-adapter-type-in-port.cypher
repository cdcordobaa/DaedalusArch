// id: X2b
// family: H5
// title: a port method's parameter or return type is declared in an adapter
// facts: isPort, SIGNATURE_USES (APG v2), role
MATCH (i:Interface {isPort: true})-[:CONTAINS]->(pm:Method)-[:SIGNATURE_USES]->(t)
WHERE t.role = 'adapter'
RETURN DISTINCT pm.filePath AS file, pm.startLine AS line, pm.name AS subject, t.name + ' (' + t.filePath + ')' AS evidence, [] AS path
ORDER BY file, line, evidence
