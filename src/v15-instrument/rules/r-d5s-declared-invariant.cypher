// id: R-D5S
// family: D5
// title: a declared invariant is checked outside the aggregate the spec names as its owner
// rule: Each invariant the spec declares is enforced by its owner aggregate, inside its consistency boundary, so no caller decides it and no lock stands in for the boundary (Vernon: model true invariants in consistency boundaries).
// fix: Move the check into the owner aggregate named in the spec (for a set invariant, the aggregate that holds the set) and let this code call it.
// applies: invariants declared in the spec's DDD block (kind set or single); uniqueness invariants never apply; nothing when the spec declares none
// facts: Unit, INVARIANT_SITE (matched terms, collection of an `over` type), Invariant
MATCH (u:Unit)-[s:INVARIANT_SITE]->(i:Invariant)
RETURN s.file AS file, s.line AS line, u.name AS subject,
       'checks declared invariant ' + i.id + ' (' + i.statement + ') outside its owner ' + i.owner + ': if (' + s.cond + ')' AS evidence,
       [] AS path
ORDER BY file, line
