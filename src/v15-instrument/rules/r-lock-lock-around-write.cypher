// id: R-LOCK
// family: D5
// title: a lock in application or adapter code stands in for an aggregate's consistency boundary
// rule: Concurrent changes to the same data are serialised by the aggregate that owns the rule (its version and repository), not by an in-process lock around the writes, which does not hold across processes (Vernon: model true invariants in consistency boundaries).
// fix: Give the invariant to an aggregate that holds the data it protects, and let its repository detect conflicting writes (an optimistic version check); remove the lock.
// applies: aggregate roots declared (or inferred); application, adapter and composition code only
// facts: Unit, LOCK_AROUND_WRITE (lock callee, roots written)
MATCH (u:Unit)-[s:LOCK_AROUND_WRITE]->(l:LockSite)
RETURN l.file AS file, s.line AS line, u.name AS subject,
       'calls ' + l.lock + ' around writes to ' + reduce(x = '', r IN s.roots | x + CASE WHEN x = '' THEN '' ELSE ', ' END + r) AS evidence,
       [] AS path
ORDER BY file, line
