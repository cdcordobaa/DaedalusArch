// id: X4
// family: D5
// title: an application method throws under a numeric domain-rule guard on a value it then hands to the domain
// facts: GUARDS (numeric comparison or Number.isX test before a throw; flowsToDomain), shape (normalised condition)
// note: duplicatedInDomain = the same normalised guard also stands in a domain method or constructor-bearing class
// source: Vernon, Effective Aggregate Design: model true invariants in consistency boundaries
MATCH (m:Method {role: 'application'})-[:GUARDS]->(g:Guard {flowsToDomain: true})
OPTIONAL MATCH (d)-[:GUARDS]->(g2:Guard)
  WHERE d.role IN ['domain', 'shared-kernel'] AND g2.shape = g.shape
WITH m, g, count(g2) AS dups
RETURN m.filePath AS file, g.line AS line, m.name AS subject,
       g.cond + CASE WHEN dups > 0 THEN ' [duplicated in domain]' ELSE '' END AS evidence, [] AS path
ORDER BY file, line
