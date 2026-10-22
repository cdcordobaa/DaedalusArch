// id: X3b
// family: D9
// title: a public domain method returns an anonymous object shaped exactly like a published contract type
// facts: returnShape (property names of an anonymous return type), propShape and propCount of contract interfaces
MATCH (dm:Method), (c:Interface)
WHERE dm.role = 'domain' AND dm.returnShape IS NOT NULL AND c.role IN ['contract', 'port-in']
  AND c.propCount >= 3 AND dm.returnShape = c.propShape
RETURN DISTINCT dm.filePath AS file, dm.startLine AS line, dm.name AS subject, 'shape of ' + c.name + ' (' + c.filePath + ')' AS evidence, [] AS path
ORDER BY file, line
