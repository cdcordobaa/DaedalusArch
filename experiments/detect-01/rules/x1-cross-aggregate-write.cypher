// id: X1
// family: D4
// title: one application flow writes two aggregates synchronously, with no outbox, bus or publisher between them
// facts: XCALL (calls through ports), DISPATCH (interface method -> implementing class method), repoWrite/writes
//        (repository write methods and the identity-bearing domain types they take, from SIGNATURE_USES), messaging
// source: Vernon, Effective Aggregate Design: modify one aggregate instance per transaction; use eventual consistency
//         outside the boundary
MATCH (m:Method {role: 'application'})
MATCH p1 = (m)-[:XCALL|DISPATCH*1..10]->(w1:Method {repoWrite: true})
MATCH p2 = (m)-[:XCALL|DISPATCH*1..10]->(w2:Method {repoWrite: true})
WHERE w1.id < w2.id AND w1.writeCount > 0 AND w2.writeCount > 0
  AND none(x IN w1.writes WHERE x IN w2.writes)
  AND none(n IN nodes(p1) WHERE coalesce(n.messaging, false))
  AND none(n IN nodes(p2) WHERE coalesce(n.messaging, false))
WITH m, w1, w2, min(size(nodes(p1)) + size(nodes(p2))) AS hops, collect(CASE WHEN size(nodes(p1)) >= size(nodes(p2)) THEN [n IN nodes(p1) | n.name] ELSE [n IN nodes(p2) | n.name] END)[0] AS path2
RETURN m.filePath AS file, m.startLine AS line, m.name AS subject,
       w1.name + ' + ' + w2.name AS evidence, path2 AS path
ORDER BY file, line, evidence
