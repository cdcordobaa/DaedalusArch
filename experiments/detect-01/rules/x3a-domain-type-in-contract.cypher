// id: X3a
// family: D9
// title: a published contract (contracts/, a context's public index, an inbound port view) names a domain class
// facts: role, PROP_TYPE (property types), SIGNATURE_USES (method types, APG v2)
// source: Fowler, BoundedContext: each context has its own model, with mappings between them
MATCH (c:Interface)-[r:PROP_TYPE]->(t:Class)
WHERE c.role IN ['contract', 'port-in'] AND t.role = 'domain'
RETURN DISTINCT c.filePath AS file, r.line AS line, c.name + '.' + r.property AS subject, t.name + ' (' + t.filePath + ')' AS evidence, [] AS path
ORDER BY file, line
