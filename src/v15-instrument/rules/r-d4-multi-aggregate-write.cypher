// id: R-D4
// family: D4
// title: one command persists two or more aggregate-root instances in one synchronous flow
// rule: One command changes and saves one aggregate instance; any other aggregate is updated later, by a handler of a domain event the first one records (Vernon, Effective Aggregate Design).
// fix: Save only the aggregate this command changes; have it record a domain event (stored with it, as the outbox does) and update the other aggregate(s) in a handler of that event.
// applies: aggregate roots declared in the spec's DDD block (or inferred: identity-bearing domain types taken by a repository port)
// facts: Command, WRITE_FOOTPRINT (per root: distinct instances, `many` for collections/loops), delegating
MATCH (c:Command {eventHandler: false, delegating: false})-[w:WRITE_FOOTPRINT]->(r:Root)
WITH c, sum(w.instanceCount) AS n, collect(r.name + ' x' + toString(toInteger(w.instanceCount))) AS roots, collect(w.sites) AS sites, collect(w.via) AS vias
WHERE n >= 2
RETURN c.file AS file, c.line AS line, c.name AS subject,
       'saves ' + toString(toInteger(n)) + ' aggregate instances: ' + reduce(s = '', x IN roots | s + CASE WHEN s = '' THEN '' ELSE ', ' END + x) AS evidence,
       reduce(acc = [], x IN sites | acc + x) AS path
ORDER BY file, line
