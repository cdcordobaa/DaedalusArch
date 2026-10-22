// id: R-D5
// family: D5
// title: a business decision about an aggregate is taken outside the aggregate
// rule: An invariant of an aggregate is checked inside the aggregate (its method or a value object), so no caller can bypass or duplicate it (Vernon: model true invariants in consistency boundaries).
// fix: Move the check into the aggregate method that changes the state (or into a value object it takes) and let the service call that method; keep one copy of the rule.
// applies: aggregate roots declared (or inferred); application and adapter code only
// facts: Unit, RULE_SITE, Guard (reason, duplicated)
MATCH (u:Unit)-[:RULE_SITE]->(g:Guard)
RETURN g.file AS file, g.line AS line, u.name AS subject,
       'if (' + g.cond + ') throws: ' + g.reason + CASE WHEN g.duplicated THEN ' [the aggregate also checks this: duplicated]' ELSE '' END AS evidence,
       [] AS path
ORDER BY file, line
