// id: X1b
// family: D4
// title: one repository write method takes two or more identity-bearing domain types (two aggregates saved as one unit)
// facts: repoWrite, writes (SIGNATURE_USES param positions to identity-bearing domain classes)
MATCH (i:Interface)-[:CONTAINS]->(w:Method {repoWrite: true})
WHERE w.writeCount >= 2
RETURN w.filePath AS file, w.startLine AS line, w.name AS subject,
       reduce(s = '', x IN w.writes | s + CASE s WHEN '' THEN '' ELSE ' + ' END + x) AS evidence, [] AS path
ORDER BY file, line
