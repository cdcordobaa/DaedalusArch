// id: R-D4R
// family: D4
// title: a repository method persists two or more aggregate-root instances in one call
// rule: A repository stores one aggregate per call, so each transaction stays inside one consistency boundary; several aggregates change in separate transactions, linked by domain events (Vernon, Effective Aggregate Design; Evans: one repository per aggregate root).
// fix: Replace the method with a single-aggregate save; have the command save the aggregate it changes and update the others in handlers of the events it records.
// applies: aggregate roots declared in the spec's DDD block; repository classes and interfaces (by the spec's repository globs, or named *Repository/*Repo/*Store/*Dao); write methods (void return) whose parameters hold two root instances or a collection of roots
// facts: RepositoryMethod, PERSISTS_MANY, Root
MATCH (m:RepositoryMethod)-[p:PERSISTS_MANY]->(r:Root)
RETURN m.file AS file, p.line AS line, m.name AS subject,
       m.name + ' persists ' + CASE p.form WHEN 'collection' THEN 'a collection of ' ELSE 'two or more ' END + r.name + ' aggregates in one call' AS evidence,
       [] AS path
ORDER BY file, line
